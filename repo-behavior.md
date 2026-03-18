# Runtime Behavior Analysis — Drift Arrow

## 1. Game Loop and Lifecycle

### Loop mechanism

The game uses **`requestAnimationFrame`** — no `setInterval`, no framework loop.

- `bootstrap.js:11` — `game.start()` is called once on page load.
- `game.js:413-415` — `start()` calls `requestAnimationFrame((t) => this.loop(t))`.
- `game.js:407-411` — `loop(timestamp)` calls `update(timestamp)` then `render()`, then unconditionally schedules the next frame via `requestAnimationFrame`. The loop **never stops** — it runs even on MENU and GAME_OVER screens.

### Delta time handling

`game.js:315-318`:
```js
const dt = this.lastTime ? timestamp - this.lastTime : 16.67;
this.lastTime = timestamp;
const dt60 = dt / 16.67; // normalize to 60fps
```

This is a **variable timestep normalized to 60fps**. `dt60` is 1.0 at exactly 60fps, ~2.0 at 30fps. There is **no fixed timestep accumulator** — a single large `dt60` is passed through all physics. At very low frame rates (e.g., tab in background at 1fps), `dt60` could be ~60, causing physics to overshoot. The first frame defaults to 16.67ms since `this.lastTime` starts at 0.

**Potential issue:** No cap on `dt60`. A long frame (e.g., returning from a backgrounded tab) could cause the arrow to teleport through walls. The `requestAnimationFrame` callback typically doesn't fire when the tab is inactive, but the first frame after re-focus would have a very large dt.

### Full lifecycle

```
Page load
  ↓
index.html loads 12 <script> tags in order (no async/defer)
  ↓
bootstrap.js executes:
  - Exposes CFG on window.__DRIFT_CFG_LIVE
  - Gets canvas element
  - new Game(canvas)
  - game.start()
  ↓
Game constructor (game.js:9-35):
  - Creates all subsystems: GameRenderer, InputManager, GameAudio, Particles, Track, Arrow, TimeTokenManager, HazardManager
  - Reads highScore from localStorage
  - Initializes state to STATE.MENU
  - Calls renderer.resize() and binds window resize listener
  ↓
game.start() → requestAnimationFrame loop begins
  ↓
STATE.MENU:
  - Renders title screen (drawMenu)
  - Waits for input.consumeTap() → calls startGame()
  ↓
startGame() (game.js:37-86):
  - audio.init() — creates AudioContext (first user interaction, satisfies autoplay policy)
  - Resets tokens and hazards
  - Wires track.onSegmentGenerated callback for token/hazard spawning
  - track.init(cx, cy) — generates initial LOOK_AHEAD + LOOK_BEHIND + 20 segments
  - Places arrow on segment 5 of spine
  - Sets backWall at segment 0
  - Snaps camera to arrow position
  - Sets countdownTimer = 90 frames (~1.5s)
  - Transitions to STATE.COUNTDOWN
  ↓
STATE.COUNTDOWN (game.js:325-329):
  - Decrements countdownTimer by dt60 each frame
  - Renders track + arrow + "3, 2, 1, GO!" overlay
  - No player input processed during countdown
  - When timer ≤ 0 → STATE.PLAYING
  ↓
STATE.PLAYING (game.js:332-333):
  - Calls updatePlaying(dt60) — full game simulation
  - Death conditions exit to STATE.GAME_OVER via die()
  ↓
die() (game.js:88-104):
  - Sets STATE.GAME_OVER
  - Stops drift audio
  - Records death cause ('time', 'wall', or 'other')
  - Sets gameOverDelay = 60 frames (~1s) — prevents immediate tap-through
  - Emits explosion particles
  - Checks/saves high score to localStorage
  ↓
STATE.GAME_OVER (game.js:336-343):
  - Updates particles (explosion continues)
  - Decrements gameOverDelay
  - Once delay expires, waits for consumeTap()
  - On tap → STATE.MENU (NOT directly to new game)
  ↓
STATE.MENU (cycle restarts)
```

### No pause/resume

There is **no pause state**. The game has exactly 4 states: `MENU`, `COUNTDOWN`, `PLAYING`, `GAME_OVER`. There is no visibility change handler — if the tab is backgrounded, the `requestAnimationFrame` loop simply stops receiving callbacks and resumes on re-focus with a potentially large dt.

### No asset loading phase

There are zero external assets — no images, no audio files, no JSON data. All visuals are Canvas 2D draw calls; all audio is Web Audio synthesis. The game is playable the instant scripts finish loading.

---

## 2. Player and Input Systems

### Input handling (`input.js`)

**Events bound:**

| Event | Target | Purpose |
|-------|--------|---------|
| `touchstart` | canvas | Set `anyTap`, determine left/right from touch X |
| `touchmove` | canvas | Re-evaluate left/right as finger moves |
| `touchend` | canvas | Re-evaluate (remaining touches after lift) |
| `touchcancel` | canvas | Clear left/right |
| `mousedown` | canvas | Set `anyTap`, determine left/right from mouse X |
| `mousemove` | canvas | Update left/right while button held |
| `mouseup` | canvas | Clear left/right |
| `keydown` | document | A/Left → leftDown, D/Right → rightDown, Space → brakeDown |
| `keyup` | document | Clear corresponding keys |
| `touchmove` | document | `e.preventDefault()` — global scroll suppression (line 59) |

All touch listeners on canvas use `{ passive: false }` and call `e.preventDefault()`.

**Input normalization:**

- `getDir()` (line 78): returns -1 (left), +1 (right), or 0 (none/both). If both sides are pressed, returns 0 (interpreted as brake, not steer).
- `isBraking()` (line 85): true if space key OR both left+right pressed.
- `consumeTap()` (line 89): one-shot flag for menu/game-over transitions. Set by any touch/mouse/key event, cleared on read.

**Touch handling specifics:**

- `_handleTouches(touches)` (line 62): iterates `e.touches` (all current touches, not just changed). Resets left/right each call, then sets flags based on `touch.clientX < canvas.width / 2`.
- **Multi-touch:** Supported implicitly — iterating all touches means one finger on the left and one on the right both set their respective flags, triggering brake (both pressed).
- **Touch coordinate mapping:** Raw `clientX` compared to `canvas.width / 2`. No DPR or offset correction — uses the CSS-styled canvas width, not the backing store width. Since the canvas CSS is `width: 100%`, `clientX` maps directly to the visual midpoint.
- **Touch area sizing:** The entire left half of the screen is "steer left", the right half is "steer right". No virtual buttons or dead zones.

**Potential issue:** `_handleTouches` uses `this.canvas.width` (the backing store pixel width set by `resize()`) but `touches[i].clientX` is in CSS pixels. On high-DPR screens, `canvas.width = window.innerWidth` (set in `renderer.js:13`), which equals CSS pixels since no DPR scaling is applied. So this works correctly **only because the renderer does not apply DPR scaling**.

### Movement mechanics (`arrow.js`)

**Physics model:** Drift-based steering with velocity-direction lag.

Two angles:
- `facing` — where the arrow nose points (controlled by steering input)
- `moveAngle` — actual velocity direction (catches up to facing via grip)

**Per-frame update (`arrow.js:31-167`):**

1. **Drift+brake detection** (lines 38-58): Complex state machine detecting simultaneous steer+brake. Requires 150ms hold (`_driftBrakeDelay`) before activating. Keeps the drift angle stable while braking.

2. **Steering** (lines 62-70): `steerVel` accumulates from input direction at `STEER_RATE`, clamped to `±STEER_MAX`. When no input, decays at 0.85^dt60. Applied to `facing` angle.

3. **Realignment** (lines 77-80): When not pressing direction and not drift-braking, `facing` gradually aligns toward `moveAngle` at `REALIGN_RATE`.

4. **Grip / drift core** (lines 85-93): `moveAngle` approaches `facing` by `angleDiff * GRIP * dt60`. Low grip = more sliding. During boost, grip is halved (line 86). During drift-brake, facing rotates by the same grip delta to lock the slide angle (lines 91-92).

5. **Drift drag** (lines 100-102): Exponential drag from drift amount — `driftAmount^DRIFT_DRAG_EXP * DRIFT_DRAG_SCALE`. Floors speedMult at 0.5.

6. **Position update** (lines 105-108): Movement along `moveAngle` (not facing) at `ARROW_SPEED * speedMult * dt60`.

7. **Speed recovery** (lines 112-124): Three recovery rates depending on state:
   - Releasing after drift (no input, low drift): `SPEED_RECOVERY_RELEASE` (fastest, 0.06)
   - Straight driving (very low drift): `SPEED_RECOVERY * 2` (0.024)
   - While drifting: `SPEED_RECOVERY * 0.3` (0.0036, very slow)
   - Recovery is capped by `maxSpeed` argument (from hazard system)

8. **Drift trail** (lines 130-166): Emits two trail points per frame when drifting. Color blends between cyan and magenta based on slide direction. Trail points age and are culled after 40 frames via `splice()`.

**Player state:**

| Property | Purpose |
|----------|---------|
| `speedMult` | Current speed multiplier (1.0 = normal, 0.5 min from drift drag) |
| `drifting` | Boolean, true when drift angle > 0.05 rad |
| `driftAmount` | Absolute drift angle in radians |
| `alive` | Set in reset() but **never checked or set to false anywhere** — vestigial |
| `currentSegIdx` | Updated by `checkWallCollision` for track-relative positioning |
| `wallHitTimer` | Decremented each frame, used for visual flash — but **never set to a positive value** in current code (wall hits are instant death) |

**Potential issue:** `arrow.alive` is initialized to `true` in `reset()` but never read or set to `false`. It's dead code. Similarly, `wallHitTimer` is decremented (line 127) and checked in renderer (line 179) but never incremented — walls are instant death, so the flash code is unreachable.

**Potential issue:** `driftTrail.splice(i, 1)` in a reverse loop (lines 161-166) is O(n²) in the worst case. With ~80 trail points max (2 per frame × 40 frame lifetime), this is fine at small scale but would not scale.

---

## 3. Rendering and Animation

### Draw call sequence per frame (`game.js:346-405`)

```
render() {
  1. renderer.clear()                    — fill screen with #0a0014

  IF STATE.MENU:
    2. renderer.drawMenu()               — title text + controls
    RETURN (nothing else drawn)

  OTHERWISE (COUNTDOWN, PLAYING, GAME_OVER):
    2. renderer.drawTrack(track, camX, camY)
       a. Build left/right wall point arrays from spine
       b. Track surface fill (#120024 polygon)
       c. Center dashes (white, every 4th segment)
       d. Road edge markers (magenta left, cyan right, every 8th segment)
       e. Neon wall lines (magenta left, cyan right) via _drawNeonLine (3-pass glow)
       f. Back wall barrier (red glow line)
    3. tokens.render(ctx, camX, camY)    — green pulsing circles with "+"
    4. hazards.render(ctx, camX, camY)   — colored circles with symbols (~, >, X)
    5. particles.render(ctx, camX, camY) — alpha-faded rectangles
    6. renderer.drawArrow(arrow, ...)    — brake trail, drift trail, arrow shape with glow
       (only in PLAYING and COUNTDOWN states)

  IF STATE.PLAYING:
    7. renderer.drawHUD(...)             — distance, timer, speed indicator, hazard effect

  IF STATE.COUNTDOWN:
    7. Countdown overlay: dark scrim + pulsing number + "GET READY"

  IF STATE.GAME_OVER:
    7. renderer.drawGameOver(...)        — dark scrim + death text + score + "TAP TO RETRY"
}
```

**Layer order:** Track (background) → tokens → hazards → particles → arrow (foreground) → UI overlay (screen-space). All drawn in a single Canvas 2D context, no offscreen buffers.

### Canvas scaling (`renderer.js:12-15`)

```js
resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
}
```

The canvas backing store is set to exactly `window.innerWidth × window.innerHeight` CSS pixels. **No DPR (device pixel ratio) scaling.** On a 2× retina display, each CSS pixel maps to one canvas pixel, meaning the game renders at half the physical resolution. This is a deliberate performance trade-off — a 60fps game loop on mobile benefits from fewer pixels.

The resize listener is attached in `Game` constructor (line 34): `window.addEventListener('resize', () => this.renderer.resize())`.

### Camera system (`game.js:302-312`)

Camera follows the arrow along the **movement direction** (not facing), with adaptive look-ahead:
- `lookAheadDist = 80 * speedFactor` — look-ahead shrinks when slow/drifting
- Camera lerps toward target at 0.04 (drifting) or 0.07 (normal) per dt60-frame
- Camera is snapped (not lerped) on game start (line 78-81)

### Glow effects

The neon aesthetic uses two techniques:
1. **`_drawNeonLine`** (renderer.js:110-131): Draws each polyline 3 times with decreasing width and increasing alpha (outer glow → core). Uses `globalAlpha`, not `shadowBlur`.
2. **`shadowBlur`/`shadowColor`**: Used for arrow glow (line 178-179), token glow (tokens.js:100-102), hazard glow (hazards.js:160-161), and HUD text glow.

### Sprite/animation system

There are **no sprites, no sprite sheets, no animation frames**. All visuals are procedural:
- Arrow is a drawn polygon (lines 182-187 of renderer.js)
- Tokens are `arc()` circles with text
- Hazards are `arc()` circles with text symbols
- Particles are `fillRect()` squares
- Track is polyline walls and polygon fill

### Optimization (or lack thereof)

- **No offscreen canvas** — everything is drawn directly to the main canvas each frame.
- **No object pooling for rendering** — particles use `splice()` for removal, drift trail uses `push()`/`splice()`.
- **No culling** — all spine segments, tokens, and hazards in their respective arrays are drawn, even if off-screen. For the track this is bounded by LOOK_AHEAD + LOOK_BEHIND segments (~220), which is manageable.
- **Tokens/hazards iterate full arrays** for rendering even though `cullBefore()` keeps the arrays bounded.

---

## 4. AI / NPC Systems

There are **no AI-controlled NPCs** in the game.

However, the **track generation agent** (`track.js`) uses AI-like behavioral steering:

- **Agent-based procedural generation**: A simulated agent steers through space using 5 weighted behavioral forces blended into a single steering input (lines 101-186).
- **Decision model**: Weighted sum of continuous forces, not a state machine. Forces: wander (noise), rhythm (sine oscillation), event impulses (decaying curvature), avoidance (repulsion from old track), centering (restoring force toward reference angle).
- **Difficulty scaling**: `this.difficulty` ramps from 0 to 1 over time via `segmentIndex * DIFFICULTY_RAMP`. Affects rhythm amplitude (line 156), event intensity (line 164), width narrowing (line 234), and hazard/token spawn chances.
- **No spawning/despawning of the agent** — it's a single persistent generator, not an entity.

---

## 5. Combat / Core Interaction

### Hit detection approach

**All collision uses circle-to-line-segment or point-to-point distance checks — no bounding boxes, no spatial partitioning.**

Three collision systems:

#### 1. Wall collision (`game.js:106-148`)
- Finds closest spine segment to arrow via `track.findClosest()` (linear scan, O(n))
- Computes perpendicular (normal) to track at that segment
- Tests **3 arrow corner points** (tip, back-left wing, back-right wing) against segment half-width
- Uses cross product (signed perpendicular distance) against the segment normal
- If any point exceeds half-width → **instant death** (wall hit)

#### 2. Back wall collision (`game.js:151-172`)
- Checks if arrow is behind the `backWall` barrier (behind = negative dot product along wall's forward direction)
- Also checks lateral distance < wall half-width
- **Instant death** if behind and within lateral bounds

#### 3. Token/hazard collection (`tokens.js:60-71`, `hazards.js:51-87`)
- Both use `distToArrowWings()` from `utils.js:18-29`
- `distToArrowWings` computes min distance from token/hazard center to the arrow's two wing edges (tip→back-left, tip→back-right line segments)
- Compared against `TOKEN_RADIUS` (10), `HAZARD_RADIUS` (10), or `DEATH_HAZARD_RADIUS` (5)
- Linear scan over all tokens/hazards each frame

### Scoring logic

- **Distance tracking** (`game.js:217-222`): Distance increases when the arrow passes new segments. `segsPassed * METERS_PER_SEGMENT` (0.03m per segment). Distance is the score.
- **High score**: `Math.floor(distance)`, stored in `localStorage` key `'driftArrowHigh2'` (game.js:99-103).

### Death conditions (checked each frame during PLAYING)

1. **Wall hit**: Arrow corner point crosses track wall boundary → `die()`
2. **Back wall hit**: Arrow moves behind the trimmed-segment barrier → `die()`
3. **Time out**: `timeLeft ≤ 0` → `die()` (game.js:241-244)
4. **Death hazard**: Collecting a DEATH-type hazard → `die()` (game.js:259-264)

### Hazard effect system (`hazards.js`)

- **Effect stack** (line 9): Integer counter. Positive = speed boost, negative = slow. Hitting a slow when boosted cancels one stack level and vice versa.
- **Effect timer** (line 10): Shared timer for all effects. Reset to `HAZARD_EFFECT_DUR` (180 frames = 3s) on each new hit. When timer expires, stack resets to 0.
- **Speed multiplier output**: `getSpeedMult()` returns `HAZARD_SLOW_MULT` (0.55), `HAZARD_SPEED_MULT` (1.35), or 1.0.
- **Applied in `updatePlaying`** (game.js:275-279): Arrow's speedMult lerps toward the hazard multiplier at rate 0.05/frame.

### Backward detection (`game.js:225-236`)

If the arrow is 3+ segments behind its peak, a progressive brake ramps up over ~1 second. Speed mult is clamped above 0.1. Prevents the player from cheating by going backward.

---

## 6. UI and Menus

### Screen/menu flow

```
STATE.MENU → [tap] → STATE.COUNTDOWN → [timer] → STATE.PLAYING → [death] → STATE.GAME_OVER → [tap] → STATE.MENU
```

There is **no pause screen**, no settings screen, no level select. The game has exactly these 4 screens.

### Rendering approach

**All UI is canvas-drawn** — no HTML/DOM overlays, no CSS UI elements. Every screen is rendered in `game.js:render()` using `ctx.fillText()`, `ctx.fillRect()`, etc.

| Screen | Renderer method | Key elements |
|--------|----------------|--------------|
| Menu | `renderer.drawMenu()` (renderer.js:301-340) | "DRIFT ARROW" title with neon glow, control instructions, pulsing "TAP TO START", high score |
| Countdown | Inline in `render()` (game.js:380-399) | Dark scrim, pulsing number (3, 2, 1, GO!), "GET READY" subtitle |
| Playing HUD | `renderer.drawHUD()` (renderer.js:212-292) | Distance (top-left), timer (top-right), BRAKE/SLOW indicator (center-top), hazard effect timer (center) |
| Game Over | `renderer.drawGameOver()` (renderer.js:342-377) | Dark scrim, "WRECKED"/"TIME UP", distance score, NEW RECORD flag, pulsing "TAP TO RETRY" |

### Data sources for UI

- Distance: `this.distance` (game.js:221)
- Timer: `this.timeLeft` (game.js:240)
- High score: `this.highScore` (read from localStorage in constructor)
- Speed: `this.arrow.speedMult`
- Hazard effect: `this.hazards.getActiveEffect()`
- Death cause: `this.deathCause` (set in `die()`)

### Transitions/animations

- **Menu "TAP TO START"**: Pulsing opacity via `Math.sin(Date.now() / 400)` (renderer.js:328)
- **Countdown numbers**: Pulsing scale via `Math.sin()` (game.js:382)
- **Timer warning**: Color changes at <8s (orange) and <4s (red pulsing) (renderer.js:229-252)
- **Time flash**: Green glow on timer for 30 frames after token collect (renderer.js:232-235)
- **Game over delay**: 60-frame delay before tap-to-retry is active (game.js:94, 339)
- **Game over "TAP TO RETRY"**: Same pulse animation as menu start

No smooth transitions between screens — state changes are instant (one frame).

---

## 7. Audio

### AudioContext initialization (`audio.js:7-12`)

```js
init() {
    try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { this.ctx = null; }
}
```

- `init()` is called in `startGame()` (game.js:38), which runs on the first tap from MENU.
- This satisfies the **mobile autoplay policy** — AudioContext is created inside a user-gesture event handler.
- `_ensure()` (line 13-17): Fallback — if ctx is null, tries `init()` again. If ctx is suspended, calls `ctx.resume()`. Returns boolean success.
- The `webkitAudioContext` fallback handles older Safari versions.

### Sound loading strategy

**No loading** — all sounds are **synthesized at runtime** via oscillators and gain envelopes. Zero audio assets. Every sound is created, played, and disposed per-invocation.

### Sound effects

| Method | Trigger | Sound design |
|--------|---------|-------------|
| `wallHit()` (line 18) | Wall collision, death hazard, back wall | Sawtooth 250→80Hz sweep, 0.15s, gain 0.2→0 |
| `startDrift()` (line 32) | Drift amount > 0.1 | Two oscillators (sine 85Hz + triangle 127Hz) through lowpass filter. Continuous hum. |
| `updateDrift(amount)` (line 63) | Each frame while drifting | Modulates filter frequency (200-800Hz) and gain (0.03-0.09) based on drift intensity |
| `stopDrift()` (line 74) | Drift amount ≤ 0.1 | Fades gain to 0 over 100ms, then stops oscillators via setTimeout(300ms) |
| `tokenCollect()` (line 83) | Time token collected | Random pentatonic note (C5-C6), two sine oscillators (fundamental + fifth), 0.5s decay |

### Music

There is **no background music**. Only sound effects.

### Drift sound lifecycle issue

`stopDrift()` (line 79) uses `setTimeout(cleanup, 300)` to stop oscillators after fade-out. The `_driftNode` reference is set to null immediately (line 81), but the oscillators continue playing (at near-zero gain) for 300ms. If `startDrift()` is called within that 300ms window, a new drift node is created while old oscillators haven't stopped yet. This is functionally fine (the old ones are at zero gain) but creates orphaned Web Audio nodes that won't be garbage collected until they stop.

---

## 8. Data and Persistence

### Hardcoded vs. configurable

**All gameplay parameters** are in the `CFG` object (`config.js`), making them tunable via:
1. Direct code edit
2. URL hash overrides: `index.html#{"ARROW_SPEED":5}` (config.js:8-12)
3. dev.html slider panel (writes to CFG directly + localStorage)

**Hardcoded values** that are NOT in CFG:
- Countdown duration: 90 frames (game.js:84)
- Game over delay: 60 frames (game.js:94)
- Camera look-ahead: 80px base (game.js:305)
- Camera lerp speeds: 0.04 / 0.07 (game.js:310)
- Backward detection threshold: 3 segments (game.js:229)
- Backward brake ramp time: 60 frames (game.js:232)
- Drift trail lifetime: 40 frames (arrow.js:163)
- Particle drag: 0.96 (particles.js:31)
- Drift color blend rate: 0.08 (arrow.js:139)
- All audio frequencies, durations, and gain values
- Hazard type probabilities: 35% slow, 35% speed, 30% death (hazards.js:32-35)
- Initial track generation count: LOOK_AHEAD + LOOK_BEHIND + 20 segments (track.js:50)

### localStorage usage

| Key | Read | Write | Content |
|-----|------|-------|---------|
| `'driftArrowHigh2'` | Game constructor (game.js:20) | `die()` if new high (game.js:102) | Integer string — high score in meters |
| `'driftArrowDevConfig'` | dev.html on load (via sync-dev.py patch) | dev.html "Apply" button | JSON object of CFG overrides |

**No IndexedDB, no cookies, no sessionStorage.**

### Save format

High score is stored as a plain integer string: `String(this.highScore)`. Parsed via `parseInt(... || '0', 10)`. No versioning, no validation beyond `parseInt` fallback to 0.

### Default values and valid ranges

All defaults are in `config.js:14-65` and `tokens.js:10-21`. There are no explicit range validators — CFG values are used directly in math. Invalid values (e.g., negative TRACK_WIDTH) would cause visual/physics glitches but not crashes.

The `tokens.js` defaults use a guard pattern:
```js
if (!CFG.HAZARD_RADIUS) CFG.HAZARD_RADIUS = 10;
```

**Potential issue:** This guard uses falsy check, not `=== undefined`. A value of `0` would be treated as "not set" and overwritten with the default. Setting `HAZARD_RADIUS: 0` via URL hash would be silently corrected to 10.

---

## 9. Cross-Cutting Concerns

### Event/pub-sub systems

There is **no formal event system**. Communication is direct method calls between objects held by the `Game` class. The one callback-style pattern is:

- `track.onSegmentGenerated` (track.js:253, set in game.js:45-48): A function reference on the Track object, called each time a new segment is generated. Used to trigger token/hazard spawning. This is set in `startGame()` and never cleared.

### Global/shared state

| Global | Defined in | Used by |
|--------|-----------|---------|
| `CFG` | config.js:14 | Every file — read extensively, mutated by dev.html and tokens.js |
| `STATE` | game.js:6 | game.js only |
| `HAZARD` | tokens.js:7 | tokens.js, hazards.js |
| `lerp`, `clamp`, `dist`, etc. | utils.js | arrow.js, track.js, particles.js, hazards.js, game.js, renderer.js |
| `window.__DRIFT_CFG_LIVE` | bootstrap.js:7 | dev.html panel |
| `__hashCfg` | config.js:7 | config.js only (local to init) |

All files share the global scope. There are no module boundaries — any file can read/write any global. The `'use strict'` per file prevents accidental implicit globals but doesn't prevent intentional ones.

### Timing dependencies

1. **Script load order is critical.** `index.html` loads scripts in dependency order. `config.js` must load before everything (defines CFG). `utils.js` before track/arrow/particles (defines math helpers). `tokens.js` before `hazards.js` (defines HAZARD enum). `game.js` before `bootstrap.js` (defines Game class).

2. **`tokens.js` mutates `CFG` at load time** (lines 10-21). This must happen after `config.js` but before any code reads these CFG properties. Since it runs at script load (not in a constructor), the order `config.js → ... → tokens.js` in index.html is sufficient.

3. **AudioContext creation requires user gesture.** `audio.init()` is called in `startGame()`, which is triggered by a tap/click from MENU state. The `_ensure()` fallback handles the case where the context was suspended.

4. **No race conditions with asset loading** — there are no assets to load. All code is synchronous script execution.

5. **First-frame dt anomaly:** `lastTime` starts at 0, so the first frame uses the fallback `dt = 16.67ms` (game.js:316). This is correct behavior — prevents a huge initial dt.

### Memory management

**Object pooling:** None. All particles, trail points, tokens, and hazards are created with object literals (`{}`/`push()`) and removed via `splice()` or `filter()`.

**Potential leak: drift trail splice.** `arrow.driftTrail` grows by 2 entries/frame while drifting, culled at age > 40 frames. Max size is ~80 entries. The `splice(i, 1)` in a reverse loop is correct but allocates a new backing array on each splice. Not a leak, but generates GC pressure.

**Potential leak: particles.** `particles.list` uses the same pattern — `push()` to add, `splice(i, 1)` to remove. Bounded by particle lifetimes (15-40 frames) and emit counts (2-30 per burst).

**Potential leak: tokens/hazards filter.** `cullBefore()` in both `TimeTokenManager` and `HazardManager` creates a new array via `.filter()` each frame when culling occurs. The old array is discarded. This is standard JS but adds GC pressure.

**Event listener cleanup:** None. The `InputManager` constructor attaches 9 event listeners (lines 15-59) that are never removed. The `Game` constructor adds a resize listener (line 34) that is never removed. Since the game is a single-page app that runs until the tab closes, this is not a practical leak.

**Web Audio nodes:** `wallHit()` and `tokenCollect()` create oscillator+gain nodes that auto-dispose after `stop()`. `startDrift()`/`stopDrift()` manually manage a persistent node set. The `setTimeout` in `stopDrift()` could leave orphaned nodes if the page is navigated before the timeout fires, but this is trivial.

### TODO/FIXME/HACK comments

**None found.** No TODO, FIXME, HACK, XXX, or WORKAROUND comments exist anywhere in the `js/` source files.

### Potential bugs and concerns flagged

1. **No dt cap** (`game.js:316-318`): After a long tab-background period, the first frame could have dt60 >> 1, causing physics teleportation. A simple `dt60 = Math.min(dt60, 3)` cap would prevent this.

2. **Vestigial `arrow.alive`** (`arrow.js:17`): Set to true in reset(), never read or set to false. Dead code.

3. **Vestigial `arrow.wallHitTimer` rendering** (`renderer.js:179`): The renderer checks `arrow.wallHitTimer > 0` for a glow flash effect, and the arrow decrements it each frame (`arrow.js:127`), but no code ever sets it to a positive value — wall hits are instant death. This was likely from a previous non-lethal wall bounce mechanic.

4. **Falsy CFG guard in tokens.js** (lines 10-21): `if (!CFG.HAZARD_RADIUS)` treats 0 as "unset". Any attempt to set these values to 0 via URL hash would be silently overridden.

5. **Duplicate dead-state check** (`game.js:214`): `if (this.state !== STATE.PLAYING) return;` appears three times in `updatePlaying()` (lines 208, 212, 214). The third one at line 214 is redundant — line 212 already returns if not PLAYING, and nothing between 212 and 214 can change state.

6. **Linear scan in `track.findClosest()`** (`track.js:287-294`): Iterates all spine segments (~220) every frame to find the closest. Called twice per frame in `updatePlaying()` (lines 207 via `checkWallCollision` and 217 directly). Could use the known `currentSegIdx` to limit the search window.

7. **`track.getSegment()` linear scan** (`track.js:279-284`): O(n) lookup by index. Not called in the hot loop, but could use binary search or offset calculation since indices are sequential.

8. **No high-DPR canvas scaling** (`renderer.js:12-15`): On retina displays, the game renders at 1× CSS pixel resolution. Text and lines may appear blurry on high-DPR screens. This is likely intentional for performance.
