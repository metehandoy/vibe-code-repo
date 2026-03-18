# Risk & Complexity Analysis — Drift Arrow

## 1. Complexity Hotspots

Ranked by estimated complexity (branching logic, state dependencies, call depth).

### Rank 1 — `game.js: updatePlaying()` (lines 175–313)

**Estimated complexity: Very High**

The single largest function in the codebase. Orchestrates the entire per-frame game simulation in one ~140-line method with:
- 8+ conditional branches (braking, drifting, wall death, back-wall death, timeout death, hazard death, backward detection, token collect)
- 4 separate death exit paths, each requiring a state check after the call (`if (this.state !== STATE.PLAYING) return;`)
- Calls into 7 subsystems: `input`, `arrow`, `audio`, `track`, `tokens`, `hazards`, `particles`
- Reads and writes 12+ instance variables: `distance`, `timeLeft`, `lastSegPassed`, `peakSegIdx`, `backwardTimer`, `timeFlash`, `prevSpeedMult`, `speedParticleTimer`, `camX`, `camY`, `diedFromWall`, `countdownTimer`
- Order-dependent: wall collision must happen before distance tracking; hazard collision must happen before hazard speed application; camera must be last

**Risk:** Any new gameplay feature will likely need to be wired into this function, increasing its complexity further. The multiple interleaved death-check-and-return patterns make it easy to add code in the wrong place relative to a state transition.

### Rank 2 — `track.js: generateNext()` (lines 93–256)

**Estimated complexity: Very High**

The procedural track generator with 5 behavioral forces blended via weighted sum:
- 6 distinct behavioral sections, each with their own state variables
- Multi-lookahead avoidance (5 probe distances with nested loops, lines 112-152)
- Wall overlap detection with O(n) scan of recent segments (lines 74-91)
- Width computation with 5 interacting factors: curvature coupling, difficulty, breathing pulse, effective minimum ramp, and smoothing (lines 227-242)
- Agent drift physics that mirrors `Arrow.update()` but with different constants (lines 188-206)
- Segment callback invocation at the end (line 253) couples generation to spawning

**Risk:** Small parameter changes can produce drastically different track shapes. The avoidance system has nested loops that scan up to 120 segments per call. Width computation has 5 multiplicative/additive factors that interact non-linearly.

### Rank 3 — `arrow.js: update()` (lines 31–167)

**Estimated complexity: High**

The drift physics core with a complex drift-brake state machine:
- 3-way drift-brake detection logic (lines 38-58) with timer, last-direction memory, and active flag
- 7 sequential physics steps that must execute in order (steering → realign → grip → drift drag → position → recovery → trail)
- Conditional grip halving for boost (line 86)
- Conditional facing co-rotation during drift-brake (lines 91-92)
- 3-tier speed recovery rate selection (lines 113-120)
- Drift trail color blending with lazy init of `_driftColorBlend` (line 138)

**Risk:** The drift-brake state machine (`_driftBrakeActive`, `_driftBrakeTimer`, `_lastInputDir`) is the most intricate input-handling logic in the codebase. Edge cases around rapid input changes (tap-release-tap sequences) could cause unexpected drift-lock or brake behavior.

### Rank 4 — `game.js: render()` (lines 346–405)

**Estimated complexity: Medium-High**

The render orchestrator with state-dependent draw paths:
- 4 state branches (MENU early-returns; COUNTDOWN/PLAYING/GAME_OVER share track rendering)
- COUNTDOWN overlay is drawn inline (not delegated to renderer) with manual `ctx.save()/restore()`
- Tokens, hazards, and particles render themselves via their own `render()` methods on the shared ctx
- Arrow rendering is conditional on state (PLAYING or COUNTDOWN only)
- HUD is conditional on PLAYING only
- Layer ordering is implicit in call order — no z-index system

**Risk:** Adding new visual elements requires understanding the implicit layer order. The COUNTDOWN overlay being inline (not in GameRenderer) is inconsistent with other screens.

### Rank 5 — `hazards.js: checkCollision()` (lines 51–87)

**Estimated complexity: Medium**

Effect stack management with cancellation logic:
- 3 hazard types with different collision radii and outcomes
- Additive/cancellation stack: slow cancels speed (and vice versa) with timer management
- 4 distinct branches: death → return, slow (cancel speed or stack) → return, speed (cancel slow or stack) → return, miss
- Timer reset semantics: resets on every hit regardless of stack direction

**Risk:** The stack integer allows unbounded growth (e.g., hitting 5 speed tokens pushes effectStack to 5), but `getSpeedMult()` only distinguishes positive vs. negative — not magnitude. This means stacking provides no benefit beyond requiring more cancellations. Not a bug, but potentially confusing behavior.

### Rank 6 — `game.js: checkWallCollision()` (lines 106–148)

**Estimated complexity: Medium**

3-point collision with per-point perpendicular distance check:
- Depends on `track.findClosest()` finding the correct segment (fragile if track curves sharply)
- Constructs 3 arrow corner points using facing angle trigonometry
- Cross product for signed perpendicular distance
- Immediate death on any point crossing the wall boundary

**Risk:** Uses only the *single* closest segment for collision. If the arrow straddles two segments with different angles (at a sharp curve), it checks against only one — potentially missing a wall or false-triggering. The linear scan in `findClosest()` is called twice per frame (here and at line 217).

### Rank 7 — `renderer.js: drawTrack()` (lines 23–108)

**Estimated complexity: Medium**

Iterates full spine twice (wall point generation + rendering passes):
- Builds two wall-point arrays by iterating all spine segments
- 4 rendering passes: surface fill, center dashes, edge markers, neon wall lines
- Each neon line is a 3-pass glow effect (`_drawNeonLine`)
- Back wall rendering with perpendicular calculation

**Risk:** The number of draw calls scales linearly with spine length (~220 segments). Each neon line gets 3 stroke passes. Total track draw calls per frame: ~8 (surface, dashes loop, markers loop, 2 walls × 3 passes, back wall × 3 passes). On low-end mobile, the glow passes with `globalAlpha` changes are the most expensive.

### Rank 8 — `renderer.js: drawHUD()` (lines 212–292)

**Estimated complexity: Medium**

Multi-state HUD with conditional styling:
- Timer display with 3 visual modes: normal, low (<8s, orange), critical (<4s, pulsing red)
- Time flash overlay when token collected
- Brake indicator
- Speed indicator
- Hazard effect indicator with type-dependent color and countdown

**Risk:** Uses `Date.now()` for pulse animations (lines 238, 276) instead of the game's own `dt60` timer. This means HUD animations run at wall-clock time while gameplay runs at game-time. If the game were ever paused (currently it isn't), HUD animations would continue pulsing.

### Rank 9 — `audio.js: startDrift()/updateDrift()/stopDrift()` (lines 32–82)

**Estimated complexity: Medium**

Continuous audio lifecycle management:
- Guard against double-start (`if (this._driftNode) return`)
- Two oscillators + filter + gain node chain
- `updateDrift()` modulates 3 parameters each frame via `setTargetAtTime`
- `stopDrift()` sets null immediately but uses setTimeout for cleanup
- Re-entrant potential within 300ms cleanup window

**Risk:** The 300ms cleanup window in `stopDrift()` means rapid drift on/off cycling creates orphaned Web Audio nodes. Each cycle leaks 2 oscillators + 1 filter + 1 gain until the setTimeout fires. Under heavy drifting, this could accumulate.

### Rank 10 — `tokens.js: spawnOnSegment()` + `hazards.js: spawnOnSegment()` (tokens.js:37–53, hazards.js:21–44)

**Estimated complexity: Medium-Low**

Spawn logic with gap enforcement and difficulty scaling:
- Minimum segment gap (`TOKEN_MIN_GAP`, `HAZARD_MIN_GAP`) between spawns
- No-spawn zone at track start (`TOKEN_NO_SPAWN_ZONE`, `HAZARD_NO_SPAWN_ZONE`)
- Random probability check with difficulty modifier
- Random lateral offset within track width

**Risk:** Tokens and hazards are spawned independently with no cross-system coordination. A token and a hazard can spawn on the same segment at overlapping positions. No overlap check between the two systems.

---

## 2. Integration Boundaries

### Boundary 1: Game → Arrow (Tight coupling)

`game.js:179` → `arrow.update(dir, dt60, braking, hazardMult, hazardMult > 1)`

Game reads `input.getDir()` and `input.isBraking()`, then reads `hazards.getSpeedMult()`, and passes all four values into Arrow. Game also directly mutates `arrow.speedMult` in three places after the update call (braking at line 183, backward detection at line 233, hazard lerp at line 278).

**Coupling: Tight.** Game reaches into arrow's internal state to modify `speedMult` from three separate locations outside the update method. The arrow's `update()` also modifies `speedMult` internally (drift drag, recovery). Order of these writes matters.

### Boundary 2: Game → Track → Tokens/Hazards (Callback coupling)

`game.js:45-48` sets `track.onSegmentGenerated`, which calls `tokens.spawnOnSegment()` and `hazards.spawnOnSegment()` from inside `track.generateNext()` (track.js:253).

**Coupling: Medium.** The callback pattern is looser than direct method calls, but the callback is set once and never cleared. `track.generateNext()` is called both during `track.init()` (initial batch) and `track.update()` (incremental), so the callback fires in both contexts.

### Boundary 3: Game → Track (findClosest → collision/distance)

`game.js:108` — `checkWallCollision()` calls `track.findClosest()` to get the nearest segment, then does collision math inline.
`game.js:217` — `updatePlaying()` calls `track.findClosest()` again for distance tracking.

**Coupling: Tight.** Wall collision logic in Game directly computes perpendicular distances against track segment properties (`angle`, `width`, `x`, `y`). The collision math is in Game, not in Track. The `findClosest()` result is also used for backward detection and segment culling.

### Boundary 4: Game → Hazards → Arrow (Speed effect chain)

`game.js:178` — reads `hazards.getSpeedMult()` → passes to `arrow.update()` as `maxSpeed`.
`game.js:275-279` — reads `hazards.getSpeedMult()` again → lerps `arrow.speedMult` toward target.
`game.js:179` — passes `hazardMult > 1` as `boostActive` to arrow (halves grip).

**Coupling: Tight.** The hazard system outputs a multiplier, but Game applies it in two separate ways (cap in arrow.update AND lerp after). The same `getSpeedMult()` is called twice per frame (lines 178 and 275).

### Boundary 5: Game → Audio (Direct calls)

`game.js:38` — `audio.init()` in startGame.
`game.js:190-194` — `audio.startDrift()`/`updateDrift()`/`stopDrift()` based on arrow drift state.
`game.js:143,168` — `audio.wallHit()` on wall/back-wall death.
`game.js:252` — `audio.tokenCollect()` on token pickup.

**Coupling: Medium.** Audio calls are fire-and-forget. Audio gracefully handles missing context (`_ensure()` pattern). Game never reads audio state.

### Boundary 6: Game → Renderer (Direct method calls)

`game.js:346-405` — `render()` calls multiple renderer methods: `clear()`, `drawTrack()`, `drawArrow()`, `drawHUD()`, `drawMenu()`, `drawGameOver()`.
`game.js:359-365` — tokens, hazards, and particles render themselves via their own `render(ctx, camX, camY)`.

**Coupling: Medium.** GameRenderer receives drawing data as method parameters. But tokens/hazards/particles receive the raw `ctx` and draw directly, bypassing the renderer abstraction. The camera offset (`camX`, `camY`) is passed to everything manually.

### Boundary 7: Tokens/Hazards → Utils (distToArrowWings)

`tokens.js:64` — `distToArrowWings(t.x, t.y, arrowX, arrowY, arrowFacing)`
`hazards.js:55` — `distToArrowWings(h.x, h.y, arrowX, arrowY, arrowFacing)`

**Coupling: Loose.** Pure function call with value parameters. No shared state.

### Boundary 8: Input → Game (Polling pattern)

Game polls input each frame: `input.getDir()` (game.js:176), `input.isBraking()` (game.js:177), `input.consumeTap()` (game.js:322, 339).

**Coupling: Loose.** Input manager maintains state independently; Game reads it via clean accessor methods. No callbacks or events.

### Boundary 9: Track segment culling → Token/Hazard culling

`game.js:201-204` — when `track.minSegIdx` is truthy, calls `tokens.cullBefore()` and `hazards.cullBefore()`.

**Coupling: Medium.** Track's `minSegIdx` is set as a side effect of `track.update()`. The falsy check `if (this.track.minSegIdx)` would fail to cull if `minSegIdx` is 0 — see fragile areas.

### Boundary 10: Config (CFG) → Everything

Every file reads `CFG` directly from the global scope. `tokens.js` mutates `CFG` at load time (lines 10-21). `dev.html` mutates `CFG` via slider panel.

**Coupling: Extremely tight / global.** No indirection, no getter/setter, no validation. Any file can read any CFG property at any time. Runtime mutations take effect immediately.

---

## 3. Mobile-Specific Risks

### 3.1 Touch Input Edge Cases

**Simultaneous touches — both sides = brake (works correctly):**
`input.js:62-69` — `_handleTouches()` iterates `e.touches` (all current touches). One finger left + one finger right → both `leftDown` and `rightDown` set → `getDir()` returns 0, `isBraking()` returns true. This is correct.

**Touch near screen edge:**
No dead zones. A touch at x=0 is "left" and a touch at x=screenWidth is "right". On devices with edge gestures (swipe from edge for back navigation), the browser may intercept touches at the very edge before they reach the canvas, causing missed inputs. The `touch-action: none` CSS only prevents scrolling/zooming — it does not prevent browser navigation gestures.

**Touch-and-drag vs. tap disambiguation:**
`_handleTouches` is called on `touchstart`, `touchmove`, and `touchend`. There is no distinction between a tap and a hold — both set `leftDown`/`rightDown`. Dragging a finger from left to right mid-touch will switch from left-steer to right-steer, which is intentional for this game. However, `anyTap` is only set on `touchstart` (line 17), not on `touchend`. This means a finger already on screen from a previous frame won't re-trigger `consumeTap()` for menu transitions — the user must lift and re-touch.

**Touch target sizing:**
The entire screen is split at the midpoint (`canvas.width / 2`). On narrow phones in portrait, each "button" is ~180px wide — adequate. On wide tablets in landscape, each half is ~500px+. No minimum size concern. However, the split point uses `this.canvas.width` (backing store pixels) vs. `touches[i].clientX` (CSS pixels). As noted in repo-behavior.md, this only works because no DPR scaling is applied. **If DPR scaling were ever added to the renderer, touch input would break** — the midpoint would be at 2× the visual center.

**Three or more simultaneous touches:**
The `_handleTouches` loop processes all touches. Three touches (e.g., left + right + stray) would set both left and right → brake. A third touch cannot cause unexpected behavior because the state is binary (left/right flags). However, `touchcancel` (line 28-31) clears both flags without checking remaining touches, which could briefly drop input if one of multiple touches is cancelled.

### 3.2 Screen / Viewport

**Aspect ratio variation:**
Canvas is always `window.innerWidth × window.innerHeight` (renderer.js:13-14). All rendering uses pixel coordinates. HUD elements are positioned relative to edges (distance at x=15, timer at canvasW-15). Menu text is centered at `canvasW/2, canvasH/2`. These adapt naturally to any aspect ratio.

**However:** The camera look-ahead is a fixed 80px (game.js:305). On very tall portrait screens, the arrow is near the bottom with lots of empty space ahead. On very wide landscape screens, the track fills less of the viewport vertically. No aspect-ratio-dependent camera scaling exists.

**Orientation change mid-game:**
`window.addEventListener('resize', () => this.renderer.resize())` (game.js:34). The resize handler sets canvas dimensions to the new `innerWidth/innerHeight`. The game loop continues uninterrupted. However:
- Canvas resizing clears all canvas state (transforms, styles, etc.) — the next `render()` call redraws from scratch, so this is fine.
- Camera position (`camX`, `camY`) is in world coordinates and unaffected by resize.
- Touch midpoint (`canvas.width / 2`) updates immediately since `_handleTouches` reads `this.canvas.width` each time.
- **No orientation lock.** The game doesn't call `screen.orientation.lock()`. Rotation is possible at any time. No prompt to rotate.

**Notch / safe area:**
The viewport meta tag does not include `viewport-fit=cover`. On notched devices, the canvas may not extend behind the notch. HUD elements at x=15 and canvasW-15 have no safe-area-inset padding. On iPhone with notch in landscape, the timer (top-right) could be obscured. The `apple-mobile-web-app-capable: yes` meta may cause full-screen mode on iOS which can differ in safe area handling.

**Resize during gameplay:**
No debounce on resize. Rapid resize events (e.g., drag-resizing a desktop window) trigger multiple `resize()` calls that clear and re-set canvas dimensions. Each clear wipes the canvas, but since the game redraws every frame, the visual glitch is at most one frame of a blank/partially-rendered canvas.

### 3.3 Performance

**Frame budget:**
At 60fps, the frame budget is 16.67ms. The main per-frame costs:
1. `updatePlaying()`: Two `findClosest()` calls scanning ~220 segments each = ~440 distance checks. Token/hazard collision scans (bounded arrays). Track generation (one `generateNext()` per frame at speed 3.5 = ~0.3 segments/frame average, but batched when falling behind). Agent avoidance with nested loops.
2. `render()`: Track drawing iterates ~220 segments multiple times. Neon lines are 3 draw calls each. `shadowBlur` on tokens and hazards triggers GPU compositing per element.

**`shadowBlur` is the biggest mobile GPU risk.** Each `ctx.shadowBlur = 15` call on tokens (tokens.js:101) and hazards (hazards.js:160) forces the browser to render a gaussian blur per element. With 10+ tokens and 5+ hazards visible, this is 15+ blurred draws per frame. On low-end mobile GPUs, this alone can exceed the frame budget. Desktop browsers hardware-accelerate this; mobile Safari and older Android Chrome may fall back to software rendering.

**Garbage collection pressure:**
- `particles.list` uses `splice()` per dead particle — O(n) array shift per removal, generating intermediate arrays. With burst emissions (30 particles from death at game.js:95), the GC impact of 30 individual splices in one frame is noticeable on low-end devices.
- `tokens.cullBefore()` and `hazards.cullBefore()` create new arrays via `.filter()` every frame that culling occurs.
- `arrow.driftTrail` splice in reverse loop: up to 80 splice calls per frame worst case.
- Drift trail creates 2 new objects per frame with string concatenation for color (`'rgb(' + cr + ',' + cg + ',' + cb + ')'` at arrow.js:145).

**No particle cap:** `Particles.emit()` (particles.js:9) pushes particles unconditionally. A death explosion emits 50 particles (game.js:95-96). Multiple rapid deaths (e.g., via dev.html restart) could accumulate if particles from the previous death haven't expired. In practice, the 1.5s countdown between games prevents this.

### 3.4 Audio

**Autoplay policy:**
`audio.init()` creates `AudioContext` inside `startGame()`, which is called from `input.consumeTap()` in the MENU state — inside a user gesture handler chain. This satisfies Chrome and Safari's autoplay policy. The `_ensure()` fallback (audio.js:13-17) handles the case where the context was suspended by calling `ctx.resume()`.

**AudioContext after backgrounding:**
When a mobile tab is backgrounded, most browsers suspend the AudioContext. On re-focus, `_ensure()` calls `ctx.resume()`, which should re-activate it. However:
- `_ensure()` is only called inside `wallHit()`, `startDrift()`, and `tokenCollect()`. If the user returns to the game and nothing triggers these methods immediately, the AudioContext may stay suspended. The drift sound check (game.js:190-194) runs every frame and calls `startDrift()` → `_ensure()` if drifting, but if the player isn't drifting on return, audio stays muted until the next event.
- **iOS Safari specifically:** iOS suspends AudioContext more aggressively. `ctx.resume()` must be called inside a user gesture handler, not just at any time. The `_ensure()` pattern may fail to resume on iOS if called from the game loop (not a touch event). This means after backgrounding on iOS, audio may silently stop working until the next `startGame()` call (which is inside a tap handler).

**Drift sound on iOS:**
`startDrift()` creates oscillators that play indefinitely until `stopDrift()` fades them. On iOS Safari, oscillators may be silently killed when backgrounded. On return, `_driftNode` is still non-null but the oscillators are dead. `startDrift()` checks `if (this._driftNode) return` — so it won't create new ones. **Result: drift sound permanently broken after backgrounding on iOS until a new game starts** (which resets via `stopDrift()` setting `_driftNode = null`).

### 3.5 Browser Tab Lifecycle

**Tab switch / screen off:**
- `requestAnimationFrame` stops firing when the tab is inactive. The game loop freezes.
- `this.lastTime` retains the timestamp of the last active frame. On re-focus, the first `requestAnimationFrame` callback receives a timestamp many seconds/minutes later.
- `dt = timestamp - this.lastTime` could be 5,000ms+ → `dt60 = 300+`.
- **Impact:** With dt60=300 at 60fps normalization:
  - `arrow.update()`: Arrow moves 300× normal distance in one step → teleports through walls.
  - `this.timeLeft -= dtSec`: Timer drops by 5+ seconds instantly → likely immediate death from timeout.
  - `this.countdownTimer -= dt60`: Countdown jumps by 300 → countdown completes instantly (minor, just means no countdown on return).
  - `particles.update()`: All particles instantly expire (harmless).
  - `steerVel *= Math.pow(0.85, 300)` → steerVel ≈ 0 (harmless).

**No `visibilitychange` handler:** The game does not listen for `document.visibilitychange`. It cannot pause on background, reset the timer, or handle any lifecycle event. This is the single most impactful mobile-specific risk.

---

## 4. General Fragile Areas

### 4.1 Floating Point in Physics/Collision

**Angle accumulation drift:**
`arrow.facing` and `arrow.moveAngle` are accumulated every frame (arrow.js:73, 88). `normalizeAngle()` is only called inside `angleDiff()` — never on the raw angles themselves. Over thousands of frames, `facing` could grow to values like 500π+. While JavaScript handles this correctly for `Math.cos()/Math.sin()`, the `angleDiff()` function normalizes the *difference* (utils.js:51-53), which works regardless of the absolute magnitude. **No practical risk here**, but the absolute angle values will grow unbounded.

**Track agent angles have the same pattern:** `agentFacing` and `agentMoveAngle` (track.js:196, 202) accumulate without normalization. The centering force (track.js:175-178) normalizes `facingDrift` inline, so this is handled locally.

**Near-zero drift amount:**
`arrow.driftAmount = Math.abs(angleDiff(this.facing, this.moveAngle))` (arrow.js:96). The threshold for `drifting` is `> 0.05` (line 97). Values between 0 and 0.05 are non-drifting. The `DRIFT_DRAG_EXP` of 2.0 means drag is `(0.05)^2 * 0.008 = 0.00002` per frame — negligible. No division-by-zero risk. However, `Math.pow(driftAmount, 2.0)` with driftAmount in [0, π] gives drag up to `9.87 * 0.008 = 0.079` per frame at maximum sideways — a 7.9% speedMult loss. This is correctly clamped at 0.5 minimum (line 102).

**Speed multiplier convergence:**
`arrow.speedMult` is modified by 4 independent systems per frame: drift drag (line 102), recovery (line 122), braking (game.js:183), hazard lerp (game.js:278), and backward detection (game.js:233). The order matters — braking applies after arrow.update() completes, and hazard lerp applies later still. In a single frame with large dt60, these could compound: e.g., drift drag drops to 0.5, then braking subtracts 0.02, then hazard lerps toward 0.55. The minimum clamps (0.5 for drift drag, `BRAKE_MIN_SPEED` for braking, 0.1 for backward) prevent hitting 0, but the interactions are hard to reason about.

### 4.2 Timing-Dependent Logic

**Countdown in frames, not seconds:**
`this.countdownTimer = 90` (game.js:84) counts down by `dt60` each frame (line 326). At 30fps, dt60=2 so the countdown takes 45 frames = 0.75 seconds (should be 1.5s). At 120fps, dt60=0.5 so it takes 180 frames = 1.5s. The countdown number display (`Math.ceil(this.countdownTimer / 60)`) would show "2" for 30 frames then "1" for 30 frames at 60fps. At 30fps, it would show "2" for 15 frames then "1" for 15 frames — visually faster but the total gameplay time is the same since `dt60` normalizes.

**Game over delay in frames:**
`this.gameOverDelay = 60` (game.js:94). Same dt60-normalized countdown. The actual wall-clock delay varies with frame rate but the "game-time" is consistent.

**Hazard effect duration in frames:**
`CFG.HAZARD_EFFECT_DUR = 180` (tokens.js:12). Counted down by `dt60` (hazards.js:91). At 60fps this is 3 seconds. At 30fps this is still ~3 seconds (180 / (30 * 2 dt60-per-frame) = 3). Correctly frame-rate-independent.

**Drift-brake delay in milliseconds:**
`_driftBrakeDelay = 150` (arrow.js:28). Accumulated via `dtMs = dt60 * (1000/60)` (arrow.js:38, 49). This is correctly converted to wall-clock milliseconds. No frame-rate issue.

**Audio setTimeout:**
`stopDrift()` uses `setTimeout(cleanup, 300)` (audio.js:79). This is wall-clock time, not game-time. In a backgrounded tab, setTimeout continues to fire (on most browsers), so the cleanup happens correctly even if the game loop is paused. However, on iOS Safari, `setTimeout` may be throttled in backgrounded tabs — the cleanup could be delayed beyond 300ms.

### 4.3 State Inconsistencies

**Hit tokens/hazards remain in arrays:**
When a token is collected, `t.collected = true` (tokens.js:65) but it stays in the `tokens` array. It's skipped in `checkCollect()` and `render()` via `if (t.collected) continue`. It's eventually removed by `cullBefore()` when its segment is trimmed. **Not a bug**, but collected tokens consume memory and iteration cycles until culled.

Same pattern for hazards: `h.hit = true` (hazards.js:58) but stays in array.

**`diedFromWall` flag:**
Set to `true` before `die()` on wall hit (game.js:144), back wall hit (game.js:169), and death hazard (game.js:262). Checked in `die()` to set `deathCause` (game.js:92). However, `diedFromWall` is set `true` for death hazards too (line 262), even though those aren't wall hits. This means a death hazard collision shows "WRECKED" instead of a more specific message. **Likely a bug** — should be `this.diedFromWall = false` before `this.die()` at line 263, or the death hazard block should not set the flag.

**`arrow.alive` — never used:**
Set to `true` in `reset()` (arrow.js:17), never checked anywhere. If code were added that checks `arrow.alive`, it would always be true even after death. Vestigial from a removed feature.

**Track `minSegIdx` falsy-check:**
`game.js:201` — `if (this.track.minSegIdx)`. If `minSegIdx` is 0 (which it is when no segments have been trimmed), this evaluates to false, skipping culling. In practice, culling only matters after segments *have* been trimmed (at which point minSegIdx > 0), so this is not a current bug. But it's fragile — if the initial segment index were ever 0 and segments were trimmed from a different start, the check would fail.

### 4.4 Missing Null/Bounds Checks

**`track.findClosest()` returns null if spine is empty:**
`game.js:108` — `checkWallCollision()` calls `findClosest()` and checks `if (!seg) return`. Correct.
`game.js:217` — `updatePlaying()` checks `if (seg && seg.index > ...)`. Correct.
`game.js:225` — backward detection checks `if (seg)`. Correct.

**`track.spine[Math.min(5, ...)]` in startGame:**
`game.js:53` — `this.track.spine[Math.min(5, this.track.spine.length - 1)]`. If `track.init()` failed to generate any segments, `spine.length - 1` would be -1, and `Math.min(5, -1) = -1` → accessing `spine[-1] = undefined` → crash on `spawnSeg.x`. However, `track.init()` generates `LOOK_AHEAD + LOOK_BEHIND + 20 = 240` segments, so this is not a practical risk.

**`this.track.backWall` null check:**
`checkBackWallCollision()` (game.js:152) checks `if (!bw) return`. `drawTrack()` (renderer.js:95) checks `if (track.backWall)`. Both correct.

**Hazard/token arrays during `filter()`:**
`cullBefore()` creates new arrays. If called during iteration, this would be safe since JavaScript doesn't have concurrent iteration issues. But `cullBefore()` is called in `updatePlaying()` before collision checks, so the filtered array is what collision checks iterate. Correct order.

### 4.5 Edge Cases in Math

**Division by zero:**
- `distPointToSeg()` (utils.js:12): `lenSq = dx*dx + dy*dy`. If the segment has zero length (start == end), `lenSq === 0` and the function returns `dist(px, py, ax, ay)`. Correctly handled.
- No other division in physics code. All denominators are either constants or clamped values.

**NaN propagation:**
- `Math.atan2(0, 0)` returns 0. Used in `track.js:222` for `segAngle`. If consecutive center positions are identical (`dx=0, dy=0`), the segment angle would be 0. This can happen if the agent stops moving (speedMult = 0), but the agent always moves at `CFG.SEGMENT_LENGTH` per step (track.js:205-206), so dx/dy are never both zero.
- `Math.pow(driftAmount, CFG.DRIFT_DRAG_EXP)` (arrow.js:101): `driftAmount` is always ≥ 0 (`Math.abs()` result). `DRIFT_DRAG_EXP` is 2.0. `Math.pow(0, 2) = 0`, `Math.pow(positive, 2) = positive`. No NaN risk.
- `parseInt(localStorage.getItem('driftArrowHigh2') || '0', 10)` (game.js:20): If localStorage returns invalid data, `parseInt("garbage", 10)` returns NaN. The `|| '0'` fallback handles null/undefined but not corrupt values. NaN would propagate to `this.highScore`, causing `score > this.highScore` to be false (NaN comparison). High score would display as "NaN m" in the HUD. **Low risk** — requires manual localStorage corruption.

**`normalizeAngle` infinite loop risk:**
`utils.js:44-48` uses while-loops to normalize: `while (a > Math.PI) a -= Math.PI * 2`. If `a` is `Infinity` or `NaN`, this loops forever. However, `normalizeAngle` is only called via `angleDiff()` which subtracts two finite angles. No risk of infinite input in practice.

---

## 5. Untested Surface Area

### What tests cover

The test file (`tests/collision-tests.html`) loads 3 modules: `config.js`, `utils.js`, `tokens.js`. It tests:

| Area | Test sections | Coverage |
|------|---------------|----------|
| `getArrowCorners()` | Arrow Wing Geometry | Arrow corner point calculation at facing=0 and facing=-π/2 |
| `distToArrowWings()` | distToArrowWings Distance Checks | Point at tip, at corners, at midpoint, far away, above center |
| Token collection | Token Collection | Token at tip, at wing, far away, just outside radius, just inside radius |
| Hazard collision (slow/speed) | Hazard Collision (Slow/Speed) | Hazard at tip, at wing, far away, just outside radius |
| Death hazard radius | Death Hazard Radius | Smaller radius confirmed, boundary testing between DEATH and SLOW radii |
| Wall collision | Wall Collision (Wing Tips) | Centered arrow, wing past wall, safe inside, narrow track, rotated track |
| Collision symmetry | Collision Symmetry | Left/right symmetry, 180° rotation symmetry |
| Edge cases | Edge Cases | Point at center, very small angles, negative facing |

**Total: ~30 assertions across 8 sections.** All are pure-function unit tests. No integration tests. No DOM interaction tests.

### What is NOT tested

| Area | Risk | Why it matters |
|------|------|----------------|
| **Game state machine** | HIGH | MENU→COUNTDOWN→PLAYING→GAME_OVER transitions, startGame() init, die() cleanup — zero coverage |
| **Arrow physics** | HIGH | Drift mechanics, steering, grip, speed recovery, drift-brake — the core gameplay feel has no tests |
| **Track generation** | HIGH | Agent steering, behavioral forces, width computation, overlap detection — small param changes cause dramatic differences with no regression tests |
| **Delta time normalization** | HIGH | dt60 calculations, frame-rate independence of all timers — untested |
| **Input manager** | MEDIUM | Touch/mouse/keyboard event handling, getDir(), isBraking(), consumeTap() — no tests |
| **Renderer** | MEDIUM | Canvas draw calls, camera transform, HUD display, menu/game-over screens — visual output untested |
| **Audio** | MEDIUM | AudioContext lifecycle, drift sound start/stop/update, iOS resume behavior — untested |
| **Hazard effect stack** | MEDIUM | Cancellation logic, stacking, timer management — the math is untested |
| **Backward detection** | LOW | Progressive braking when going backward — untested |
| **Camera follow** | LOW | Lerp smoothing, look-ahead scaling — untested |
| **Particle system** | LOW | Emission, aging, culling — simple but untested |
| **localStorage** | LOW | High score save/load, NaN handling — untested |
| **Mobile lifecycle** | HIGH | Tab backgrounding, large dt spikes, AudioContext suspension — zero coverage |
| **Orientation/resize** | MEDIUM | Canvas resize during gameplay, touch midpoint recalculation — untested |

**Summary:** Tests cover only collision geometry (a pure-math subset of the physics). The entire game loop, state machine, input handling, rendering, audio, and mobile-specific behavior are untested. Roughly **90%+ of the runtime code has no test coverage**.

---

## 6. External / Browser Dependencies

### Core APIs used

| API | Used in | Vendor prefix? | Cross-browser notes |
|-----|---------|---------------|---------------------|
| **Canvas 2D** | renderer.js, tokens.js, hazards.js, particles.js, game.js | No | Universal support. `shadowBlur` performance varies heavily — slow on mobile Safari, GPU-accelerated on Chrome. |
| **requestAnimationFrame** | game.js:410, 414 | No | Universal. Throttled to display refresh rate. Stops firing when tab is inactive (all modern browsers). |
| **Web Audio API** | audio.js | `webkitAudioContext` fallback (line 10) | Safari required `webkitAudioContext` until Safari 14.1 (2021). The fallback handles this. |
| **AudioContext.resume()** | audio.js:16 | No | Required for autoplay policy. Chrome auto-suspends on creation; Safari requires explicit user gesture for resume. |
| **Touch Events** | input.js:15-31 | No | Not supported on Firefox desktop (no touch screen). Fine on all mobile browsers. |
| **localStorage** | game.js:20,102; config.js; dev.html | No | Available everywhere. May throw in private browsing mode on older Safari. Game catches nothing — `localStorage.getItem()` would throw, crashing the Game constructor. |
| **window.innerWidth/Height** | renderer.js:13-14 | No | Universal. Returns CSS pixels. On iOS Safari, may change when the URL bar hides/shows — triggers resize. |
| **Date.now()** | renderer.js:238,328,371; tokens.js:79; hazards.js:115 | No | Universal. Used for UI pulse animations. |
| **JSON.parse** | config.js:10 | No | Used for URL hash config parsing. Wrapped in try/catch. |

### Vendor-prefixed features

| Property | Used in | Status |
|----------|---------|--------|
| `-webkit-touch-callout: none` | index.html:14 | Safari-only CSS. Prevents callout menu on long-press. No equivalent for other browsers (not needed). |
| `-webkit-user-select: none` | index.html:14 | Superseded by unprefixed `user-select: none` (also present). The prefixed version handles older Safari/Chrome. |
| `webkitAudioContext` | audio.js:10 | Fallback for Safari < 14.1. Modern Safari uses unprefixed `AudioContext`. |

### Browser-specific behavioral risks

**iOS Safari:**
- `AudioContext.resume()` must be inside a user gesture handler. The `_ensure()` pattern calling `resume()` from the game loop (not a touch handler) may silently fail. Drift sound may break after backgrounding.
- `setTimeout` throttled to 1-second minimum in backgrounded tabs (iOS 15+). The 300ms drift cleanup in `stopDrift()` may be delayed.
- Canvas `shadowBlur` is software-rendered on older iOS devices. Heavy glow usage (tokens, hazards) will drop frames.
- `localStorage` throws `QuotaExceededError` in private browsing mode on Safari < 14. The Game constructor (line 20) does not catch this.

**Samsung Internet:**
- Generally follows Chrome behavior. No known specific risks for this codebase.
- May have slightly different `innerWidth`/`innerHeight` behavior with its bottom toolbar.

**Firefox (desktop):**
- No touch events — only mouse and keyboard. All mouse handlers are bound, so this works.
- `AudioContext` not prefixed. Works without the `webkit` fallback.

**Chrome Android:**
- Full-screen mode via `apple-mobile-web-app-capable` meta tag is **ignored** — this is an Apple-only feature. Chrome uses `manifest.json` + `display: standalone` for PWA full-screen, which is not present.
- Pull-to-refresh may intercept downward touches. The `touch-action: none` CSS should prevent this, but `overscroll-behavior: none` would be more robust.

**WebView (in-app browsers):**
- Some in-app WebViews (e.g., Facebook, Twitter) have restricted APIs. `AudioContext` may not be available. The `try/catch` in `audio.init()` handles this gracefully (sets `ctx = null`).
- `localStorage` may not persist between WebView sessions.

### Missing modern mobile CSS

| Feature | Risk | Recommendation |
|---------|------|----------------|
| `viewport-fit=cover` | Notched devices may not use full screen | Add to viewport meta |
| `env(safe-area-inset-*)` | HUD elements may be obscured by notch | Add padding to HUD positioning |
| `overscroll-behavior: none` | Pull-to-refresh may interfere on Chrome Android | Add to body CSS |
| `screen.orientation.lock('portrait')` | Rotation disrupts gameplay | Consider locking or handling gracefully |
