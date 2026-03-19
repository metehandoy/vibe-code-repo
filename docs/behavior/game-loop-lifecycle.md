# Runtime Behavior — Game Loop and Lifecycle

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
