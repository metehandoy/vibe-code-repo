# Testing Plan — Drift Arrow

## 1. Testing Strategy Overview

### Recommended Framework: Vitest + Playwright

**Vitest** for unit and integration tests of game logic. Justification:
- Native ESM support — the codebase uses ES6+ classes and `'use strict'` per file. Vitest can import these directly with minimal shimming.
- No bundler requirement — aligns with the project's zero-dependency philosophy. Vitest needs only a `package.json` devDependency.
- Fast execution — Vitest's watch mode and parallel test runner suit a 60fps game loop where rapid iteration on physics constants is common.
- jsdom environment — Vitest can run with `jsdom` or `happy-dom` to provide `window`, `document`, `localStorage`, and stub Canvas/AudioContext without a real browser.

**Playwright** for E2E and mobile-specific tests. Justification:
- Real browser rendering — the game uses Canvas 2D, `shadowBlur`, `requestAnimationFrame`, Web Audio, and touch events. These cannot be fully tested in jsdom.
- Mobile emulation — Playwright supports device emulation (viewport, touch, DPR) and can test orientation changes, which the risk map identifies as untested.
- Chromium + WebKit + Firefox — covers the browser matrix (Chrome Android, iOS Safari via WebKit, Firefox desktop).
- CI-compatible — already runs headless Puppeteer in CI; Playwright is a direct upgrade with better mobile support.

**Migration from existing tests:** The current `tests/collision-tests.html` uses a custom browser harness with ~30 assertions. These should be ported to Vitest unit tests for consistency, then the HTML file retained as a smoke test only.

### Test Pyramid

```
        ╱╲
       ╱E2E╲         ~10 scenarios (Playwright)
      ╱──────╲        Full gameplay loops, mobile lifecycle, visual smoke
     ╱ Integr. ╲      ~25 test suites (Vitest + jsdom)
    ╱────────────╲    System boundaries, state machine, multi-system interactions
   ╱   Unit Tests  ╲  ~60 test suites (Vitest)
  ╱──────────────────╲ Pure logic: math, physics, collision, spawning, effect stack
```

**Ratio: 60% unit / 30% integration / 10% E2E.**

This is shifted toward unit tests compared to a typical web app because:
1. Most game logic (physics, collision, spawning, scoring) is pure computation extractable from the render loop.
2. The rendering layer is thin — procedural draw calls with no complex DOM. Visual regression tests have low ROI since the aesthetics are simple geometric shapes.
3. Mobile/browser-specific behavior (touch, audio, lifecycle) genuinely requires a real browser, but these are a small number of high-value E2E scenarios rather than exhaustive permutations.

### Test Infrastructure

**Running game logic without a browser:**

Most classes can be instantiated directly in Vitest with jsdom:
- `Arrow`, `Particles`, `TimeTokenManager`, `HazardManager` — no DOM dependencies. Only require `CFG` and utility functions in global scope.
- `Track` — no DOM dependencies. Requires `CFG`, `lerp`, `clamp`, `valueNoise`, `dist`.
- `Game` — requires a canvas element (jsdom can provide a stub `<canvas>`), but the Canvas 2D context must be mocked for `getContext('2d')`.
- `InputManager` — requires a canvas element for event binding. jsdom supports `addEventListener` but not real touch/mouse events; synthetic events work for unit tests.
- `GameAudio` — requires `AudioContext`. Must be fully mocked.
- `GameRenderer` — requires Canvas 2D context. Must be mocked or tested via Playwright.

**Mocking strategy:**

| Browser API | Mock approach |
|-------------|---------------|
| `Canvas 2D` (`getContext('2d')`) | Stub object returning no-ops for all draw methods. Track call counts for render integration tests. |
| `AudioContext` / `webkitAudioContext` | Mock class with `createOscillator()`, `createGain()`, `createBiquadFilter()` returning stub nodes. Track `start()`/`stop()` calls. |
| `requestAnimationFrame` | Replace with manual `game.loop(timestamp)` calls in tests. Inject specific timestamps to control dt60. |
| `localStorage` | jsdom provides a working implementation. For error tests (Safari private mode), replace with throwing stub. |
| Touch events | Construct synthetic `TouchEvent` with `touches` array containing `{clientX, clientY}` objects. |
| `window.innerWidth/Height` | Set directly on jsdom's `window` object before calling `renderer.resize()`. |
| `Date.now()` | Use `vi.useFakeTimers()` for pulse animation tests. |
| `Math.random()` | Use `vi.spyOn(Math, 'random')` with `.mockReturnValue()` for deterministic spawn/type tests. |

**Fixture setup for game state:**

```js
// test-helpers.js — shared across all test files
function createTestCFG(overrides = {}) {
  return { ...DEFAULT_CFG, ...overrides };
}

function createArrowAt(x, y, facing = 0) {
  const arrow = new Arrow();
  arrow.reset(x, y);
  arrow.facing = facing;
  arrow.moveAngle = facing;
  return arrow;
}

function createStraightTrack(startX, startY, count = 50, angle = -Math.PI/2, width = 140) {
  // Returns a Track-like object with a straight spine for deterministic collision tests
}

function createGameWithMocks() {
  // Returns { game, canvas, ctx, audioMock, inputMock }
  // Canvas stub, mocked audio, controllable input
}

function stepGame(game, frames = 1, dt60 = 1.0) {
  // Manually advance game loop by N frames at given dt60
  for (let i = 0; i < frames; i++) {
    game.update(game.lastTime + 16.67);
  }
}
```

### What CAN vs. CANNOT be unit tested

**Unit testable in isolation (no browser needed):**
- All `utils.js` functions — pure math
- `Arrow.update()` — pure physics given inputs (dir, dt60, braking, maxSpeed, boostActive)
- `Arrow.reset()` — state initialization
- `Track.generateNext()` — procedural generation (deterministic with seeded random)
- `Track.findClosest()`, `Track.getWalls()`, `Track.getSegment()` — data lookups
- `TimeTokenManager.spawnOnSegment()`, `.checkCollect()`, `.cullBefore()` — spawn/collect logic
- `HazardManager.spawnOnSegment()`, `.checkCollision()`, `.update()`, `.getSpeedMult()`, `.getActiveEffect()` — effect stack
- `Particles.emit()`, `.update()` — particle lifecycle
- `Game.checkWallCollision()`, `.checkBackWallCollision()` — with mocked track/arrow state
- `Game.die()` — state transitions and scoring (with mocked localStorage)
- `Game.update()` — state machine transitions (with mocked subsystems)
- `InputManager.getDir()`, `.isBraking()`, `.consumeTap()` — polling logic given flag state
- `GameRenderer._formatDist()` — pure string formatting
- `GameAudio._ensure()` — context state checks (with mocked AudioContext)

**Requires headless browser (Playwright):**
- Actual Canvas 2D rendering output (visual regression)
- Touch event coordinate mapping with real DPR and viewport
- `requestAnimationFrame` timing behavior across tab visibility changes
- Web Audio API playback and suspend/resume lifecycle
- `localStorage` in Safari private browsing mode
- Orientation change and resize event sequencing
- `shadowBlur` performance profiling

---

## 2. Unit Test Specifications

### 2.1 Utility Functions (`utils.js`)

**Priority: P1** — Foundation for all collision and physics. Already partially tested in existing harness, but needs formal coverage.

**Functions:** `lerp`, `clamp`, `dist`, `distPointToSeg`, `distToArrowWings`, `valueNoise`, `normalizeAngle`, `angleDiff`

#### `lerp(a, b, t)` — `utils.js:6`

| ID | Given | When | Then |
|----|-------|------|------|
| U-LERP-01 | a=0, b=10, t=0.5 | lerp called | Returns 5 |
| U-LERP-02 | a=0, b=10, t=0 | lerp called | Returns 0 (exact start) |
| U-LERP-03 | a=0, b=10, t=1 | lerp called | Returns 10 (exact end) |
| U-LERP-04 | a=5, b=5, t=0.5 | lerp called | Returns 5 (degenerate: a===b) |
| U-LERP-05 | a=0, b=10, t=-0.5 | lerp called | Returns -5 (extrapolation, no clamp) |
| U-LERP-06 | a=0, b=10, t=1.5 | lerp called | Returns 15 (extrapolation beyond 1) |

**Edge cases:** NaN inputs → returns NaN (no guard). Infinity inputs.

#### `clamp(v, lo, hi)` — `utils.js:7`

| ID | Given | When | Then |
|----|-------|------|------|
| U-CLAMP-01 | v=5, lo=0, hi=10 | clamp called | Returns 5 (in range) |
| U-CLAMP-02 | v=-5, lo=0, hi=10 | clamp called | Returns 0 (clamped low) |
| U-CLAMP-03 | v=15, lo=0, hi=10 | clamp called | Returns 10 (clamped high) |
| U-CLAMP-04 | v=0, lo=0, hi=0 | clamp called | Returns 0 (degenerate: lo===hi) |

#### `distPointToSeg(px, py, ax, ay, bx, by)` — `utils.js:10-16`

| ID | Given | When | Then |
|----|-------|------|------|
| U-DPS-01 | Point on segment midpoint | distPointToSeg called | Returns 0 |
| U-DPS-02 | Point perpendicular to segment midpoint at distance 10 | distPointToSeg called | Returns 10 |
| U-DPS-03 | Point beyond segment end, nearest to endpoint B | distPointToSeg called | Returns dist to B |
| U-DPS-04 | Point beyond segment start, nearest to endpoint A | distPointToSeg called | Returns dist to A |
| U-DPS-05 | **Zero-length segment** (A===B) | distPointToSeg called | Returns dist(point, A) — exercises `lenSq === 0` guard at line 13 |
| U-DPS-06 | Point exactly at endpoint A | distPointToSeg called | Returns 0 |

#### `distToArrowWings(px, py, arrowX, arrowY, facing)` — `utils.js:18-29`

| ID | Given | When | Then |
|----|-------|------|------|
| U-DAW-01 | Point at arrow tip | distToArrowWings called | Returns ~0 |
| U-DAW-02 | Point at back-left wing | distToArrowWings called | Returns ~0 |
| U-DAW-03 | Point at back-right wing | distToArrowWings called | Returns ~0 |
| U-DAW-04 | Point at midpoint of left wing edge | distToArrowWings called | Returns ~0 |
| U-DAW-05 | Point far away (100, 100) | distToArrowWings called | Returns > 50 |
| U-DAW-06 | Arrow rotated 90° (facing=π/2), point at new tip | distToArrowWings called | Returns ~0 |
| U-DAW-07 | Symmetric points equidistant left and right | distToArrowWings called | Returns equal distances |

**Edge cases:** facing = 0, π, -π, 2π (large angle). Arrow at origin vs. offset position.

#### `normalizeAngle(a)` / `angleDiff(a, b)` — `utils.js:44-53`

| ID | Given | When | Then |
|----|-------|------|------|
| U-ANG-01 | a = 0 | normalizeAngle called | Returns 0 |
| U-ANG-02 | a = 2π | normalizeAngle called | Returns ~0 (within float tolerance) |
| U-ANG-03 | a = -2π | normalizeAngle called | Returns ~0 |
| U-ANG-04 | a = 3π | normalizeAngle called | Returns ~π (or ~-π) |
| U-ANG-05 | a = 100π | normalizeAngle called | Returns value in [-π, π] |
| U-ANG-06 | a = 0, b = π/2 | angleDiff called | Returns π/2 |
| U-ANG-07 | a = -π+0.1, b = π-0.1 | angleDiff called | Returns ~-0.2 (shortest path wraps around) |
| U-ANG-08 | a = 0, b = 0 | angleDiff called | Returns 0 (identical angles) |

**Edge cases:** Very large accumulated angles (±500π). Exact ±π boundary.

#### `valueNoise(t)` — `utils.js:32-41`

| ID | Given | When | Then |
|----|-------|------|------|
| U-NOISE-01 | t = 0 | valueNoise called | Returns value in [-1, 1] |
| U-NOISE-02 | t = 0.5 | valueNoise called | Returns value in [-1, 1] (mid-interpolation) |
| U-NOISE-03 | t = integer | valueNoise called | Returns hash-based value (no interpolation) |
| U-NOISE-04 | t = negative | valueNoise called | Returns value in [-1, 1] |
| U-NOISE-05 | Sequential t values | valueNoise called 100 times with t+0.1 | All values in [-1, 1], values change smoothly |

---

### 2.2 Arrow Physics (`arrow.js`)

**Priority: P0** — Core gameplay feel. The #3 complexity hotspot with zero existing test coverage. Drift-brake state machine identified as the most intricate logic in the codebase (risk map Rank 3).

#### `Arrow.reset(x, y)` — `arrow.js:10-29`

| ID | Given | When | Then |
|----|-------|------|------|
| U-ARR-RST-01 | Any prior state | reset(100, 200) called | x=100, y=200, facing=-π/2, moveAngle=-π/2, speedMult=1, steerVel=0 |
| U-ARR-RST-02 | Arrow was drifting with trail data | reset called | driftTrail=[], driftAmount=0, drifting=false |
| U-ARR-RST-03 | Drift-brake was active | reset called | _driftBrakeActive=false, _driftBrakeTimer=0, _lastInputDir=0 |

#### `Arrow.update()` — Steering (`arrow.js:62-73`)

| ID | Given | When | Then |
|----|-------|------|------|
| U-ARR-STR-01 | Arrow at rest, steerVel=0 | update(inputDir=1, dt60=1) | steerVel increases by STEER_RATE, facing rotates right |
| U-ARR-STR-02 | steerVel at STEER_MAX | update(inputDir=1, dt60=1) | steerVel stays at STEER_MAX (clamped) |
| U-ARR-STR-03 | steerVel=0.03, no input | update(inputDir=0, dt60=1) | steerVel *= 0.85 (decay) |
| U-ARR-STR-04 | steerVel=0.0005, no input | update(inputDir=0, dt60=1) | steerVel snaps to 0 (below 0.001 threshold) |
| U-ARR-STR-05 | Steering left | update(inputDir=-1, dt60=1) for 10 frames | facing decreases (turns left), clamped at -STEER_MAX |

#### `Arrow.update()` — Grip / Drift core (`arrow.js:85-97`)

| ID | Given | When | Then |
|----|-------|------|------|
| U-ARR-GRP-01 | facing=0, moveAngle=-0.5 | update(0, dt60=1) | moveAngle approaches facing by angleDiff * GRIP |
| U-ARR-GRP-02 | facing=0, moveAngle=-0.5, boostActive=true | update | Grip halved → moveAngle moves half as fast toward facing |
| U-ARR-GRP-03 | Large angleDiff (π/2) | update for 100 frames | moveAngle converges toward facing, never overshoots |
| U-ARR-GRP-04 | driftAmount > 0.05 after update | update | drifting === true |
| U-ARR-GRP-05 | driftAmount < 0.05 after update | update | drifting === false |

#### `Arrow.update()` — Speed recovery (`arrow.js:112-124`)

| ID | Given | When | Then |
|----|-------|------|------|
| U-ARR-REC-01 | speedMult=0.6, no input, low drift (<0.15) | update(0, dt60=1, braking=false) | speedMult increases by SPEED_RECOVERY_RELEASE (0.06) |
| U-ARR-REC-02 | speedMult=0.6, no input, low drift (<0.05) | update(0, dt60=1, braking=false) | speedMult increases by SPEED_RECOVERY*2 (0.024) |
| U-ARR-REC-03 | speedMult=0.6, actively drifting (>0.05) | update(1, dt60=1, braking=false) | speedMult increases by SPEED_RECOVERY*0.3 (0.0036) |
| U-ARR-REC-04 | speedMult=0.6, braking=true | update(0, dt60=1, braking=true) | No recovery (braking skips recovery block) |
| U-ARR-REC-05 | speedMult=0.9, maxSpeed=0.8 | update | speedMult does NOT exceed maxSpeed (capped at 0.8) |
| U-ARR-REC-06 | speedMult=0.7, maxSpeed=1.0 | update for 100 frames, no drift | speedMult reaches 1.0 and stays there |

#### `Arrow.update()` — Drift drag (`arrow.js:99-102`)

| ID | Given | When | Then |
|----|-------|------|------|
| U-ARR-DRG-01 | driftAmount=0 | update | dragLoss=0, speedMult unchanged by drag |
| U-ARR-DRG-02 | driftAmount=0.5 | update | dragLoss = 0.5^2 * 0.008 = 0.002 per frame |
| U-ARR-DRG-03 | driftAmount=1.0 (extreme) | update | dragLoss = 1.0 * 0.008 = 0.008, speedMult floored at 0.5 |
| U-ARR-DRG-04 | speedMult already at 0.5, large drift | update | speedMult stays at 0.5 (floor) |

#### `Arrow.update()` — Drift-brake state machine (`arrow.js:38-60`)

| ID | Given | When | Then |
|----|-------|------|------|
| U-ARR-DB-01 | Steering right, not braking | update(1, dt60=1, false) | _lastInputDir=1, _driftBrakeActive=false |
| U-ARR-DB-02 | Was steering right, now braking+right | update(1, dt60=1, true) for 9 frames (150ms at 60fps) | _driftBrakeTimer accumulates, _driftBrakeActive=false until 150ms |
| U-ARR-DB-03 | Was steering right, now braking+right | update(1, dt60=1, true) for 10+ frames | _driftBrakeActive=true after 150ms |
| U-ARR-DB-04 | Drift-brake active | update(0, dt60=1, false) | _driftBrakeActive=false, _driftBrakeTimer=0 (cleared) |
| U-ARR-DB-05 | Drift-brake active | update continues | facing co-rotates with moveAngle (line 92), drift angle locked |
| U-ARR-DB-06 | Braking with no prior direction, not drifting | update(0, dt60=1, true) | wantsDriftBrake=false, normal brake behavior |

#### `Arrow.update()` — Position update (`arrow.js:104-108`)

| ID | Given | When | Then |
|----|-------|------|------|
| U-ARR-POS-01 | moveAngle=0, speedMult=1, dt60=1 | update | x increases by ARROW_SPEED, y unchanged |
| U-ARR-POS-02 | moveAngle=π/2, speedMult=0.5, dt60=2 | update | y increases by ARROW_SPEED * 0.5 * 2 |
| U-ARR-POS-03 | dt60=0 (edge) | update | Position unchanged |

#### `Arrow.update()` — Realignment (`arrow.js:77-80`)

| ID | Given | When | Then |
|----|-------|------|------|
| U-ARR-RAL-01 | facing=0.5, moveAngle=0, no input, no drift-brake | update | facing moves toward moveAngle by REALIGN_RATE |
| U-ARR-RAL-02 | facing=0.5, moveAngle=0, inputDir=1 | update | No realignment (inputDir !== 0) |
| U-ARR-RAL-03 | facing=0.5, moveAngle=0, drift-brake active | update | No realignment (driftBraking skips) |

#### `Arrow.update()` — Drift trail (`arrow.js:130-166`)

| ID | Given | When | Then |
|----|-------|------|------|
| U-ARR-TRL-01 | Arrow drifting (driftAmount > 0.05) | update | 2 trail points pushed to driftTrail |
| U-ARR-TRL-02 | Arrow not drifting | update | No new trail points |
| U-ARR-TRL-03 | Trail point age > 40 | update | Point removed via splice |
| U-ARR-TRL-04 | Arrow drifting for 50 frames | check trail length | Length ≤ ~80 (2/frame, culled at 40 frames) |

---

### 2.3 Hazard Effect System (`hazards.js`)

**Priority: P0** — Effect stack cancellation logic is the #5 complexity hotspot. Untested despite medium complexity and subtle interaction with arrow speed.

#### `HazardManager.checkCollision()` — `hazards.js:51-87`

| ID | Given | When | Then |
|----|-------|------|------|
| U-HAZ-COL-01 | SLOW hazard at arrow tip, effectStack=0 | checkCollision | Returns 'slow', effectStack=-1, effectTimer=HAZARD_EFFECT_DUR |
| U-HAZ-COL-02 | SPEED hazard at arrow tip, effectStack=0 | checkCollision | Returns 'speed', effectStack=1, effectTimer=HAZARD_EFFECT_DUR |
| U-HAZ-COL-03 | DEATH hazard at arrow tip | checkCollision | Returns 'death', no stack change |
| U-HAZ-COL-04 | SLOW hazard, effectStack=1 (boosted) | checkCollision | effectStack=0, effectTimer=0 (cancellation) |
| U-HAZ-COL-05 | SPEED hazard, effectStack=-1 (slowed) | checkCollision | effectStack=0, effectTimer=0 (cancellation) |
| U-HAZ-COL-06 | SLOW hazard, effectStack=-1 (already slowed) | checkCollision | effectStack=-2, effectTimer reset (stacking) |
| U-HAZ-COL-07 | SPEED hazard, effectStack=2 (double boosted) | checkCollision | effectStack=3, effectTimer reset |
| U-HAZ-COL-08 | Hazard already hit (h.hit=true) | checkCollision | Skipped, returns null |
| U-HAZ-COL-09 | Hazard just outside radius | checkCollision | Returns null (no hit) |
| U-HAZ-COL-10 | DEATH hazard uses DEATH_HAZARD_RADIUS (5), not HAZARD_RADIUS (10) | checkCollision at distance 7 | No hit for DEATH, would hit for SLOW |

#### `HazardManager.update()` — `hazards.js:89-97`

| ID | Given | When | Then |
|----|-------|------|------|
| U-HAZ-UPD-01 | effectTimer=180, effectStack=-1 | update(dt60=1) | effectTimer=179 |
| U-HAZ-UPD-02 | effectTimer=1, effectStack=-2 | update(dt60=1) | effectTimer=0, effectStack=0 (reset on expiry) |
| U-HAZ-UPD-03 | effectTimer=0 | update(dt60=1) | No change (already expired) |

#### `HazardManager.getSpeedMult()` — `hazards.js:99-104`

| ID | Given | When | Then |
|----|-------|------|------|
| U-HAZ-GSM-01 | effectStack=0 | getSpeedMult | Returns 1 |
| U-HAZ-GSM-02 | effectStack=-1, effectTimer=100 | getSpeedMult | Returns HAZARD_SLOW_MULT (0.55) |
| U-HAZ-GSM-03 | effectStack=1, effectTimer=100 | getSpeedMult | Returns HAZARD_SPEED_MULT (1.35) |
| U-HAZ-GSM-04 | effectStack=-1, effectTimer=0 | getSpeedMult | Returns 1 (timer expired) |
| U-HAZ-GSM-05 | effectStack=5, effectTimer=100 | getSpeedMult | Returns HAZARD_SPEED_MULT (magnitude irrelevant) |

#### `HazardManager.spawnOnSegment()` — `hazards.js:21-44`

| ID | Given | When | Then |
|----|-------|------|------|
| U-HAZ-SPN-01 | seg.index < HAZARD_NO_SPAWN_ZONE (80) | spawnOnSegment | No spawn (early exit) |
| U-HAZ-SPN-02 | seg.index - lastSpawnSeg < HAZARD_MIN_GAP (10) | spawnOnSegment | No spawn (gap enforcement) |
| U-HAZ-SPN-03 | Math.random returns 0.001 (below chance) | spawnOnSegment | Hazard spawned, lastSpawnSeg updated |
| U-HAZ-SPN-04 | Math.random returns 0.99 (above chance) | spawnOnSegment | No spawn |
| U-HAZ-SPN-05 | Math.random < 0.35 for type roll | spawnOnSegment | Type is HAZARD.SLOW |
| U-HAZ-SPN-06 | Math.random in [0.35, 0.70) for type roll | spawnOnSegment | Type is HAZARD.SPEED |
| U-HAZ-SPN-07 | Math.random >= 0.70 for type roll | spawnOnSegment | Type is HAZARD.DEATH |

#### `HazardManager.cullBefore()` — `hazards.js:46-48`

| ID | Given | When | Then |
|----|-------|------|------|
| U-HAZ-CUL-01 | 5 hazards with segIdx [10,20,30,40,50] | cullBefore(25) | 3 hazards remain (segIdx >= 25) |
| U-HAZ-CUL-02 | Empty array | cullBefore(100) | Remains empty, no error |

---

### 2.4 Token System (`tokens.js`)

**Priority: P1** — Similar structure to hazards. Partially tested by existing collision tests but spawn logic and collect mechanics are untested.

#### `TimeTokenManager.checkCollect()` — `tokens.js:60-72`

| ID | Given | When | Then |
|----|-------|------|------|
| U-TOK-COL-01 | Token within TOKEN_RADIUS of arrow wing | checkCollect | Returns TIME_TOKEN_VALUE (3.5), t.collected=true |
| U-TOK-COL-02 | Token already collected | checkCollect | Skipped, returns 0 |
| U-TOK-COL-03 | Two uncollected tokens both within range | checkCollect | Returns 2 * TIME_TOKEN_VALUE, both marked collected |
| U-TOK-COL-04 | Token just outside TOKEN_RADIUS | checkCollect | Returns 0 |
| U-TOK-COL-05 | Token collected | checkCollect | collectFlash set to 20 |

#### `TimeTokenManager.spawnOnSegment()` — `tokens.js:37-53`

| ID | Given | When | Then |
|----|-------|------|------|
| U-TOK-SPN-01 | seg.index < TOKEN_NO_SPAWN_ZONE (40) | spawnOnSegment | No spawn |
| U-TOK-SPN-02 | seg.index - lastSpawnSeg < TOKEN_MIN_GAP (25) | spawnOnSegment | No spawn |
| U-TOK-SPN-03 | Random passes chance check | spawnOnSegment | Token added with correct segIdx and position within track width |
| U-TOK-SPN-04 | difficulty=1.0 | spawnOnSegment | Spawn chance = TOKEN_SPAWN_CHANCE + 0.01 = 0.035 |

---

### 2.5 Track Generation (`track.js`)

**Priority: P0** — #2 complexity hotspot. Zero test coverage. Small parameter changes can dramatically alter track shape (risk map). Regression tests essential.

#### `Track.init()` — `track.js:29-53`

| ID | Given | When | Then |
|----|-------|------|------|
| U-TRK-INI-01 | init(400, 300) | After init | spine.length === LOOK_AHEAD + LOOK_BEHIND + 20 (240) |
| U-TRK-INI-02 | init called | After init | agentWanderPhase and agentRhythmPhase are randomized |
| U-TRK-INI-03 | init called | After init | All segments have valid x, y, angle, width, index properties |
| U-TRK-INI-04 | init called | After init | First segment starts near startX, startY |

#### `Track.generateNext()` — Width computation (`track.js:226-242`)

| ID | Given | When | Then |
|----|-------|------|------|
| U-TRK-WID-01 | segmentIndex < 30 (runway) | generateNext | Width is wide (near TRACK_WIDTH due to effectiveMin) |
| U-TRK-WID-02 | segmentIndex = 500 | generateNext | effectiveMin = MIN_TRACK_WIDTH (fully ramped) |
| U-TRK-WID-03 | segmentIndex = 250 | generateNext | effectiveMin between MIN_TRACK_WIDTH and 2*MIN_TRACK_WIDTH |
| U-TRK-WID-04 | High curvature (large moveDiff) | generateNext | Width narrows (curvature coupling) |
| U-TRK-WID-05 | difficulty=1.0 | generateNext | Width reduced by 0.4*(TRACK_WIDTH-MIN_TRACK_WIDTH) |
| U-TRK-WID-06 | All widths over 1000 segments | iterate | All widths in [MIN_TRACK_WIDTH, TRACK_WIDTH] |

#### `Track.generateNext()` — Runway behavior (`track.js:97-99`)

| ID | Given | When | Then |
|----|-------|------|------|
| U-TRK-RUN-01 | segmentIndex < 30 | generateNext | wanderAmp = WANDER_AMPLITUDE * 0.15 (gentle curves) |
| U-TRK-RUN-02 | segmentIndex < 30 | generateNext | No event impulses (event_raw=0) |
| U-TRK-RUN-03 | segmentIndex = 30 | generateNext | postRunwayRamp = 0 (offset just starting) |

#### `Track.findClosest()` — `track.js:287-294`

| ID | Given | When | Then |
|----|-------|------|------|
| U-TRK-FC-01 | Point exactly on a segment | findClosest | Returns that segment |
| U-TRK-FC-02 | Point between two segments | findClosest | Returns the nearer one |
| U-TRK-FC-03 | Empty spine | findClosest | Returns null |

#### `Track.update()` — `track.js:259-277`

| ID | Given | When | Then |
|----|-------|------|------|
| U-TRK-UPD-01 | arrowSegIdx advanced beyond LOOK_BEHIND | update | Old segments trimmed, backWall set at removed segment |
| U-TRK-UPD-02 | arrowSegIdx near spine end | update | New segments generated ahead to maintain LOOK_AHEAD buffer |
| U-TRK-UPD-03 | update called | After update | minSegIdx set to first spine segment's index |

#### `Track._wouldOverlapRecent()` — `track.js:74-91`

| ID | Given | When | Then |
|----|-------|------|------|
| U-TRK-OVL-01 | Candidate at same position as recent segment | check | Returns true |
| U-TRK-OVL-02 | Candidate far from all segments | check | Returns false |
| U-TRK-OVL-03 | Spine length < 15 | check | Returns false (insufficient data) |

---

### 2.6 Game State Machine (`game.js`)

**Priority: P0** — #1 complexity hotspot. The state machine and `updatePlaying()` orchestration have zero coverage. All death paths must be verified.

#### `Game.update()` — State transitions (`game.js:315-343`)

| ID | Given | When | Then |
|----|-------|------|------|
| U-GSM-01 | state=MENU, consumeTap()=true | update | startGame() called, state → COUNTDOWN |
| U-GSM-02 | state=MENU, consumeTap()=false | update | state remains MENU |
| U-GSM-03 | state=COUNTDOWN, countdownTimer=1 | update(dt60=1) | countdownTimer=0, state → PLAYING |
| U-GSM-04 | state=COUNTDOWN, countdownTimer=50 | update(dt60=1) | countdownTimer=49, state remains COUNTDOWN |
| U-GSM-05 | state=GAME_OVER, gameOverDelay=1 | update(dt60=1), consumeTap=true | state → MENU |
| U-GSM-06 | state=GAME_OVER, gameOverDelay=30 | update(dt60=1), consumeTap=true | state remains GAME_OVER (delay not expired) |
| U-GSM-07 | state=GAME_OVER, gameOverDelay=-5 | update(dt60=1), consumeTap=false | state remains GAME_OVER (no tap) |

#### `Game.die()` — `game.js:88-104`

| ID | Given | When | Then |
|----|-------|------|------|
| U-DIE-01 | timeLeft <= 0 | die() | deathCause = 'time' |
| U-DIE-02 | diedFromWall = true, timeLeft > 0 | die() | deathCause = 'wall' |
| U-DIE-03 | diedFromWall = false, timeLeft > 0 | die() | deathCause = 'other' |
| U-DIE-04 | distance=150, highScore=100 | die() | highScore=150, isNewHigh=true, localStorage updated |
| U-DIE-05 | distance=50, highScore=100 | die() | highScore=100, isNewHigh=false |
| U-DIE-06 | Any state | die() | state=GAME_OVER, gameOverDelay=60, particles emitted |

#### `Game.startGame()` — `game.js:37-86`

| ID | Given | When | Then |
|----|-------|------|------|
| U-START-01 | state=MENU | startGame() | audio.init() called, track.init() called, state=COUNTDOWN |
| U-START-02 | After startGame | check arrow | Arrow placed at spine[5] with matching facing and moveAngle |
| U-START-03 | After startGame | check state | countdownTimer=90, timeLeft=START_TIME, distance=0 |
| U-START-04 | After startGame | check track | backWall set at spine[0] with width = seg.width + 40 |
| U-START-05 | After startGame | check callback | track.onSegmentGenerated is a function |

#### `Game.updatePlaying()` — Delta time (`game.js:315-318`)

| ID | Given | When | Then |
|----|-------|------|------|
| U-DT-01 | lastTime=0, timestamp=1000 | update(1000) | dt=16.67 (fallback), dt60=1.0 |
| U-DT-02 | lastTime=1000, timestamp=1016.67 | update(1016.67) | dt60=1.0 (exactly 60fps) |
| U-DT-03 | lastTime=1000, timestamp=1033.34 | update(1033.34) | dt60=2.0 (30fps) |
| U-DT-04 | lastTime=1000, timestamp=6000 | update(6000) | dt60=~300 (**no cap — risk map §3.5**) |

#### `Game.updatePlaying()` — Timer countdown (`game.js:239-244`)

| ID | Given | When | Then |
|----|-------|------|------|
| U-TIMER-01 | timeLeft=10.0, dt60=1 | updatePlaying | timeLeft = 10.0 - (1 * 16.67/1000) ≈ 9.983 |
| U-TIMER-02 | timeLeft=0.01, dt60=1 | updatePlaying | timeLeft=0, die() called with deathCause='time' |
| U-TIMER-03 | Token collected this frame | updatePlaying | timeLeft increased by TIME_TOKEN_VALUE before timer check |

#### `Game.updatePlaying()` — Backward detection (`game.js:224-236`)

| ID | Given | When | Then |
|----|-------|------|------|
| U-BACK-01 | Arrow advances past peakSegIdx | updatePlaying | peakSegIdx updated, backwardTimer=0 |
| U-BACK-02 | Arrow 4 segments behind peak | updatePlaying | backwardTimer increments, speedMult decreases |
| U-BACK-03 | Arrow 2 segments behind peak | updatePlaying | No backward penalty (threshold is 3) |
| U-BACK-04 | Backward for 60+ frames | updatePlaying | brakeFactor=1.0 (fully ramped), speedMult ≥ 0.1 |

#### `Game.checkWallCollision()` — `game.js:106-148`

| ID | Given | When | Then |
|----|-------|------|------|
| U-WALL-01 | Arrow centered on straight track | checkWallCollision | No death, arrow.currentSegIdx updated |
| U-WALL-02 | Arrow tip past right wall | checkWallCollision | die() called, diedFromWall=true, particles emitted |
| U-WALL-03 | Arrow back-left wing past left wall | checkWallCollision | die() called |
| U-WALL-04 | findClosest returns null (empty spine) | checkWallCollision | Early return, no crash |

#### `Game.checkBackWallCollision()` — `game.js:151-172`

| ID | Given | When | Then |
|----|-------|------|------|
| U-BWALL-01 | Arrow ahead of backWall | checkBackWallCollision | No death |
| U-BWALL-02 | Arrow behind backWall and within lateral bounds | checkBackWallCollision | die() called |
| U-BWALL-03 | Arrow behind backWall but outside lateral bounds | checkBackWallCollision | No death (too far to the side) |
| U-BWALL-04 | backWall is null | checkBackWallCollision | Early return |

---

### 2.7 Input Manager (`input.js`)

**Priority: P1** — Loosely coupled, simple logic. But touch coordinate edge cases are a mobile risk (risk map §3.1).

#### `InputManager.getDir()` — `input.js:78-83`

| ID | Given | When | Then |
|----|-------|------|------|
| U-INP-DIR-01 | leftDown=true, rightDown=false | getDir() | Returns -1 |
| U-INP-DIR-02 | leftDown=false, rightDown=true | getDir() | Returns 1 |
| U-INP-DIR-03 | leftDown=true, rightDown=true | getDir() | Returns 0 (both pressed) |
| U-INP-DIR-04 | leftDown=false, rightDown=false | getDir() | Returns 0 (nothing pressed) |

#### `InputManager.isBraking()` — `input.js:85-87`

| ID | Given | When | Then |
|----|-------|------|------|
| U-INP-BRK-01 | brakeDown=true | isBraking() | Returns true |
| U-INP-BRK-02 | leftDown=true, rightDown=true | isBraking() | Returns true |
| U-INP-BRK-03 | leftDown=true, brakeDown=false | isBraking() | Returns false |

#### `InputManager.consumeTap()` — `input.js:89-93`

| ID | Given | When | Then |
|----|-------|------|------|
| U-INP-TAP-01 | anyTap=true | consumeTap() | Returns true, anyTap becomes false |
| U-INP-TAP-02 | anyTap=false | consumeTap() | Returns false |
| U-INP-TAP-03 | anyTap=true | consumeTap() twice | First returns true, second returns false |

#### `InputManager._handleTouches()` — `input.js:62-69`

| ID | Given | When | Then |
|----|-------|------|------|
| U-INP-TCH-01 | Single touch at x=100, canvas.width=800 | _handleTouches | leftDown=true, rightDown=false |
| U-INP-TCH-02 | Single touch at x=500, canvas.width=800 | _handleTouches | leftDown=false, rightDown=true |
| U-INP-TCH-03 | Two touches: x=100 and x=500 | _handleTouches | leftDown=true, rightDown=true (brake) |
| U-INP-TCH-04 | Touch exactly at midpoint (x=400, width=800) | _handleTouches | rightDown=true (>= comparison at line 68) |
| U-INP-TCH-05 | Empty touches array (all fingers lifted) | _handleTouches | leftDown=false, rightDown=false |

---

### 2.8 Particles (`particles.js`)

**Priority: P2** — Simple, low-risk system. But GC pressure from splice() is a performance concern (risk map §3.3).

#### `Particles.emit()` — `particles.js:9-18`

| ID | Given | When | Then |
|----|-------|------|------|
| U-PRT-EMT-01 | emit(0, 0, 10, '#ff0000', 1, 3, 25) | After emit | list.length increased by 10 |
| U-PRT-EMT-02 | Any emission | After emit | All particles have life=maxLife, valid vx/vy, correct color |

#### `Particles.update()` — `particles.js:26-35`

| ID | Given | When | Then |
|----|-------|------|------|
| U-PRT-UPD-01 | Particle with life=1 | update(dt60=1) | life=0, particle removed |
| U-PRT-UPD-02 | Particle with life=25 | update(dt60=1) | life=24, position updated by vx/vy, velocity *= 0.96 |
| U-PRT-UPD-03 | 50 particles, all expired | update(dt60=100) | list.length=0 |

---

### 2.9 Audio (`audio.js`)

**Priority: P1** — Drift sound lifecycle issue identified in risk map (§3.4). iOS-specific risks require E2E, but logic tests can cover state management.

#### `GameAudio._ensure()` — `audio.js:13-17`

| ID | Given | When | Then |
|----|-------|------|------|
| U-AUD-ENS-01 | ctx=null | _ensure() | Calls init(), returns true if ctx created |
| U-AUD-ENS-02 | ctx.state='suspended' | _ensure() | Calls ctx.resume(), returns true |
| U-AUD-ENS-03 | ctx.state='running' | _ensure() | Returns true, no resume call |
| U-AUD-ENS-04 | AudioContext throws on creation | _ensure() | Returns false, ctx remains null |

#### `GameAudio.startDrift() / stopDrift()` — `audio.js:32-82`

| ID | Given | When | Then |
|----|-------|------|------|
| U-AUD-DRF-01 | _driftNode=null | startDrift() | _driftNode set, oscillators started |
| U-AUD-DRF-02 | _driftNode already set | startDrift() | Returns immediately (no duplicate) |
| U-AUD-DRF-03 | _driftNode set | stopDrift() | _driftNode=null immediately, cleanup scheduled at 300ms |
| U-AUD-DRF-04 | stopDrift() then startDrift() within 300ms | sequence | New _driftNode created (old nodes still cleaning up) |

---

### 2.10 Config (`config.js` + `tokens.js` CFG defaults)

**Priority: P1** — Falsy-guard bug identified in risk map §4.3.

#### CFG defaults in `tokens.js:10-21`

| ID | Given | When | Then |
|----|-------|------|------|
| U-CFG-01 | CFG.HAZARD_RADIUS = undefined | tokens.js loads | CFG.HAZARD_RADIUS = 10 |
| U-CFG-02 | CFG.HAZARD_RADIUS = 0 | tokens.js loads | **BUG: CFG.HAZARD_RADIUS = 10** (falsy guard treats 0 as unset) |
| U-CFG-03 | CFG.HAZARD_RADIUS = 15 | tokens.js loads | CFG.HAZARD_RADIUS = 15 (preserved) |

#### `GameRenderer._formatDist()` — `renderer.js:294-299`

| ID | Given | When | Then |
|----|-------|------|------|
| U-FMT-01 | meters=0 | _formatDist | Returns '0m' |
| U-FMT-02 | meters=999 | _formatDist | Returns '999m' |
| U-FMT-03 | meters=1000 | _formatDist | Returns '1.00km' |
| U-FMT-04 | meters=1500.5 | _formatDist | Returns '1.50km' |

---

## 3. Integration Test Specifications

### 3.1 Game → Arrow Speed Multiplier Chain (Boundary 1 + 4)

**Contract:** Game calls `arrow.update(dir, dt60, braking, hazardMult, boostActive)`, then externally modifies `arrow.speedMult` via braking (line 183), backward detection (line 233), and hazard lerp (line 278). The order of these writes determines final speedMult.

**Setup:** Create Game with mocked subsystems. Set arrow and track to known positions. Control `hazards.getSpeedMult()` return value.

| ID | Scenario | Setup | Expected |
|----|----------|-------|----------|
| I-SPD-01 | Braking while slow hazard active | hazardMult=0.55, braking=true, arrow.speedMult=0.8 | speedMult decreases from both braking (line 183) AND hazard lerp (line 278); final value < 0.55 |
| I-SPD-02 | Speed boost during drift | hazardMult=1.35, drifting with driftAmount=0.5 | Drift drag (arrow.js:101) fights recovery; boost halves grip (line 86); speedMult settles between 0.5 and 1.35 |
| I-SPD-03 | Backward penalty + hazard slow | Arrow 5 segs behind peak, hazardMult=0.55 | Both backward brake (line 233) and hazard lerp (line 278) compound; speedMult ≥ 0.1 floor |
| I-SPD-04 | Recovery capped by maxSpeed | hazardMult=0.55, arrow recovering from drift | speedMult recovery capped at 0.55, not 1.0 (arrow.js:121-122) |

**Teardown:** None (stateless per test).

### 3.2 Track → Token/Hazard Spawning Callback (Boundary 2)

**Contract:** `track.onSegmentGenerated` callback fires during both `track.init()` (initial batch of ~240 segments) and `track.update()` (incremental). Tokens and hazards spawn independently via this callback.

**Setup:** Create Track, TokenManager, HazardManager. Wire the callback as in `game.js:45-48`. Seed `Math.random` for determinism.

| ID | Scenario | Setup | Expected |
|----|----------|-------|----------|
| I-SPN-01 | Initial track generation spawns tokens and hazards | track.init(), check managers | Tokens appear after TOKEN_NO_SPAWN_ZONE (seg 40), hazards after HAZARD_NO_SPAWN_ZONE (seg 80) |
| I-SPN-02 | No spawn zone respected during init | Check first token segIdx | segIdx ≥ 40 |
| I-SPN-03 | Gap enforcement across init batch | Count token pairs closer than TOKEN_MIN_GAP | Zero pairs violate gap |
| I-SPN-04 | Incremental generation via update() | track.update(arrowSegIdx) generates new segs | Callback fires for new segments, tokens/hazards may spawn |
| I-SPN-05 | Callback fires during both init and update | Count total callback invocations | init: ~240, update: depends on arrowSegIdx advance |

**Failure mode:** If callback is not set before `track.init()`, no tokens spawn during the initial 240 segments. The callback is set in `startGame()` (line 45) before `track.init()` (line 50).

### 3.3 Track findClosest → Wall Collision (Boundary 3)

**Contract:** `Game.checkWallCollision()` calls `track.findClosest()` to get the nearest segment, then tests 3 arrow corner points against that segment's perpendicular. Death if any point exceeds half-width.

**Setup:** Create Track with known straight segments. Place Arrow at precise positions.

| ID | Scenario | Setup | Expected |
|----|----------|-------|----------|
| I-WALL-01 | Arrow centered on straight track | Arrow at segment center | No death, currentSegIdx updated |
| I-WALL-02 | Arrow drifting into wall | Arrow offset toward wall with tip crossing | die() called, diedFromWall=true |
| I-WALL-03 | Arrow at sharp curve, straddling two segments | Arrow between two segments with different angles | **Risk case**: findClosest returns one segment; collision check may miss wall on the other segment's geometry |
| I-WALL-04 | Arrow between two segments, closest segment is behind | Arrow tip near next segment | Check that correct segment is used — findClosest uses Euclidean distance, not along-track distance |
| I-WALL-05 | Narrow track section (MIN_TRACK_WIDTH=38) | Arrow with full ARROW_WIDTH (10) on narrow track | Arrow wing tips approach wall at offset = (38/2 - 10/2) = 14 pixels clearance |

**Failure mode:** `findClosest()` returns null → early return (safe). Returns wrong segment at curve → false death or missed wall.

### 3.4 Hazard Speed Effect → Arrow maxSpeed (Boundary 4)

**Contract:** `hazards.getSpeedMult()` returns 0.55 (slow), 1.35 (speed), or 1.0 (neutral). This is passed as `maxSpeed` to `arrow.update()` AND used in a separate lerp (game.js:275-279). `getSpeedMult()` is called twice per frame (lines 178 and 275).

**Setup:** Create HazardManager with pre-set effectStack and effectTimer. Create Arrow.

| ID | Scenario | Setup | Expected |
|----|----------|-------|----------|
| I-HSPD-01 | Slow effect active, arrow at full speed | effectStack=-1, effectTimer=100, arrow.speedMult=1.0 | After updatePlaying: arrow.speedMult lerps toward 0.55 |
| I-HSPD-02 | Speed effect active, arrow at normal speed | effectStack=1, effectTimer=100 | arrow.speedMult lerps toward 1.35 and boostActive halves grip |
| I-HSPD-03 | Effect expires mid-gameplay | effectTimer=1, dt60=1 | hazards.update() sets effectStack=0; next frame getSpeedMult()=1, arrow recovers |
| I-HSPD-04 | Slow cancels boost | effectStack=1, slow hazard hit | effectStack=0, effectTimer=0, getSpeedMult()=1 immediately |

### 3.5 Track Segment Culling → Token/Hazard Culling (Boundary 9)

**Contract:** `game.js:201-204` — when `track.minSegIdx` is truthy, `tokens.cullBefore()` and `hazards.cullBefore()` are called with that value.

| ID | Scenario | Setup | Expected |
|----|----------|-------|----------|
| I-CULL-01 | Arrow advances, old segments trimmed | track.update() trims segments | track.minSegIdx > 0, tokens/hazards with segIdx < minSegIdx removed |
| I-CULL-02 | No segments trimmed yet | track.minSegIdx = 0 | **Falsy check skips culling** — tokens/hazards retained (fragile, risk map §4.3) |
| I-CULL-03 | Collected token on culled segment | Token with collected=true on old segment | Removed by cullBefore, reducing array size |
| I-CULL-04 | Hit hazard on culled segment | Hazard with hit=true on old segment | Removed by cullBefore |

### 3.6 Death Hazard → die() Flag Chain (Boundary: state consistency)

**Contract:** Death hazard collision at `game.js:259-264` sets `diedFromWall = true` then calls `die()`. `die()` checks `diedFromWall` to set `deathCause`. **Bug identified in risk map §4.3:** death hazard sets `diedFromWall = true` but it's not a wall hit.

| ID | Scenario | Setup | Expected |
|----|----------|-------|----------|
| I-DEATH-01 | Wall collision death | Arrow hits wall | deathCause = 'wall', diedFromWall was set true at line 144 |
| I-DEATH-02 | Timer expiry death | timeLeft reaches 0 | deathCause = 'time' |
| I-DEATH-03 | Death hazard | Arrow hits DEATH hazard | **Current: deathCause = 'wall'** (bug — diedFromWall=true at line 262). **Expected after fix: deathCause = 'other' or 'hazard'** |
| I-DEATH-04 | Back wall death | Arrow behind backWall | deathCause = 'wall', diedFromWall set at line 169 |

### 3.7 Audio Lifecycle (Boundary 5)

**Contract:** Game calls `audio.init()` once in `startGame()`, then manages drift sound via `startDrift()`/`stopDrift()` per frame, and fires `wallHit()`/`tokenCollect()` on events. Audio gracefully degrades if AudioContext is unavailable.

| ID | Scenario | Setup | Expected |
|----|----------|-------|----------|
| I-AUD-01 | First game start | audio.ctx=null, startGame() called | audio.init() creates AudioContext |
| I-AUD-02 | Drift starts and stops | Arrow drift amount crosses 0.1 threshold | startDrift() called when > 0.1, stopDrift() when ≤ 0.1 |
| I-AUD-03 | Rapid drift on/off cycling | Drift amount oscillates around 0.1 over 10 frames | startDrift/stopDrift alternate; no crash from orphaned nodes |
| I-AUD-04 | AudioContext unavailable (WebView) | AudioContext constructor throws | All audio methods return silently, game continues |
| I-AUD-05 | Wall death triggers audio | Wall collision | audio.wallHit() called before die() |

### 3.8 Segment Generation Callback During Init vs Update (Boundary 2 continued)

**Contract:** The callback set at `game.js:45-48` must fire during `track.init()` to populate the initial segment batch with tokens/hazards.

| ID | Scenario | Setup | Expected |
|----|----------|-------|----------|
| I-CB-01 | startGame() sequence | Full startGame() with real Track, TokenManager, HazardManager | After init: tokens.tokens.length > 0 (some spawned in initial 240 segments) |
| I-CB-02 | Callback not set before init | track.onSegmentGenerated = null, track.init() | No tokens/hazards spawned. After callback is set, only new segments get tokens. |

---

## 4. Mobile-Specific Test Specifications

All tests in this section require **Playwright** with device emulation unless noted.

### 4.1 Touch Input Tests

#### Tap, hold, and release

| ID | Scenario | Device | Expected |
|----|----------|--------|----------|
| M-TCH-01 | Single tap left side | iPhone 14 (390px wide) | leftDown=true, getDir()=-1 |
| M-TCH-02 | Single tap right side | iPhone 14 | rightDown=true, getDir()=1 |
| M-TCH-03 | Tap and hold left, then release | iPhone 14 | leftDown=true during hold, leftDown=false after release |
| M-TCH-04 | Tap left then drag to right without lifting | iPhone 14 | Switches from leftDown to rightDown as touch crosses midpoint |

#### Multi-touch

| ID | Scenario | Device | Expected |
|----|----------|--------|----------|
| M-TCH-05 | Two fingers: one left, one right simultaneously | Any | leftDown=true AND rightDown=true → isBraking()=true, getDir()=0 |
| M-TCH-06 | Three fingers: two left, one right | Any | leftDown=true AND rightDown=true (brake, same as two) |
| M-TCH-07 | Release one of two fingers (brake → steer) | Any | After lifting right finger, only leftDown remains → getDir()=-1 |
| M-TCH-08 | `touchcancel` on one of two active touches | Any | Both flags cleared (input.js:29-30), brief input drop. Verify game doesn't crash. |

#### Edge-of-screen touches

| ID | Scenario | Device | Expected |
|----|----------|--------|----------|
| M-TCH-09 | Touch at x=0 (leftmost pixel) | iPhone 14 | leftDown=true (no dead zone) |
| M-TCH-10 | Touch at x=389 (rightmost pixel on 390px device) | iPhone 14 | rightDown=true |
| M-TCH-11 | Touch at exact midpoint (x=195 on 390px) | iPhone 14 | rightDown=true (clientX < 195 is left, >= is right per line 67-68) |

#### Rapid input / input during transitions

| ID | Scenario | Device | Expected |
|----|----------|--------|----------|
| M-TCH-12 | Rapid tap-release-tap (10 taps in 1 second) | Any | Each tap registers as leftDown/rightDown. No missed inputs. |
| M-TCH-13 | Tap during COUNTDOWN state | Any | Input ignored for steering (COUNTDOWN doesn't call updatePlaying). anyTap consumed but no effect. |
| M-TCH-14 | Tap during GAME_OVER before delay expires | Any | consumeTap returns true but gameOverDelay > 0 prevents transition |
| M-TCH-15 | Touch held through state transition (COUNTDOWN→PLAYING) | Any | Steering activates immediately when PLAYING starts |

### 4.2 Viewport / Scaling Tests

#### Aspect ratios

| ID | Scenario | Viewport | Expected |
|----|----------|----------|----------|
| M-VP-01 | Standard phone portrait | 390×844 (iPhone 14) | Canvas fills viewport. HUD visible. Touch midpoint at 195. |
| M-VP-02 | Standard phone landscape | 844×390 (iPhone 14 rotated) | Canvas fills viewport. Timer at x=829 visible. |
| M-VP-03 | Tall phone | 360×800 (19.5:9 Samsung) | No clipping. Track visible ahead of arrow. |
| M-VP-04 | Tablet portrait | 768×1024 (iPad) | Menu text centered correctly. Game playable. |
| M-VP-05 | Tablet landscape | 1024×768 (iPad) | Wide viewport, track doesn't fill horizontally but game works. |
| M-VP-06 | Desktop ultrawide | 2560×1080 | Game renders. Large empty space beside track is acceptable. |

#### Orientation change during gameplay

| ID | Scenario | Action | Expected |
|----|----------|--------|----------|
| M-VP-07 | Rotate portrait→landscape during PLAYING | Trigger orientation change | Canvas resizes (renderer.resize() fires). Game continues. Camera stays on arrow. Touch midpoint updates. |
| M-VP-08 | Rotate during COUNTDOWN | Trigger orientation change | Countdown continues. Canvas resizes. Number overlay re-centers. |
| M-VP-09 | Rapid rotation (back and forth) | 3 rotations in 2 seconds | No crash. At most 1-frame render glitch per rotation. |

#### Notch / safe area

| ID | Scenario | Device | Expected |
|----|----------|--------|----------|
| M-VP-10 | HUD timer in landscape with notch | iPhone 14 Pro (dynamic island) | Timer at canvasW-15 — verify not obscured. **Known issue: no safe-area padding.** |
| M-VP-11 | Menu text with notch in portrait | iPhone 14 Pro | Title text at center — should not be obscured in portrait. |

### 4.3 Performance Tests

| ID | Scenario | Measurement | Threshold |
|----|----------|-------------|-----------|
| M-PERF-01 | Steady gameplay, 60 frames | Measure frame times via performance.now() | 95th percentile < 16.67ms |
| M-PERF-02 | Death explosion (50 particles) | Frame time during emission frame | < 20ms (allow 1 frame spike) |
| M-PERF-03 | Many tokens visible (seed track for dense spawning) | Frame time with 15+ tokens rendering | < 16.67ms on desktop, track degradation on mobile |
| M-PERF-04 | Memory growth over 5 minutes of gameplay | Measure JS heap size at start and end | Growth < 2MB (no unbounded leak) |
| M-PERF-05 | `shadowBlur` impact | Compare frame times with shadowBlur=15 vs shadowBlur=0 | Measure delta on mobile WebKit emulation |

### 4.4 Lifecycle Tests

| ID | Scenario | Action | Expected |
|----|----------|--------|----------|
| M-LIFE-01 | Tab backgrounded during PLAYING for 5 seconds | Switch tab, wait 5s, return | **Current behavior:** dt60 = ~300, arrow teleports, likely dies. **Verify:** no crash, game shows GAME_OVER or continues. |
| M-LIFE-02 | Tab backgrounded during COUNTDOWN | Switch tab, wait 3s, return | Countdown completes instantly (dt60 large), game enters PLAYING. |
| M-LIFE-03 | Tab backgrounded during MENU | Switch tab, wait 10s, return | Menu still displayed. No state change. |
| M-LIFE-04 | Tab backgrounded during GAME_OVER | Switch tab, wait 5s, return | gameOverDelay expires instantly. Next tap goes to MENU. |
| M-LIFE-05 | Screen lock and unlock (mobile) | Lock screen, wait 5s, unlock | Same as tab background — rAF stops, resumes with large dt. |

### 4.5 Audio Tests

| ID | Scenario | Browser | Expected |
|----|----------|---------|----------|
| M-AUD-01 | First game start creates AudioContext | Chrome Android | AudioContext created on tap from MENU. Verify ctx.state !== 'suspended'. |
| M-AUD-02 | Drift sound plays during drift | Chrome Android | audio._driftNode is non-null while drifting. |
| M-AUD-03 | Audio resumes after tab background | Chrome Android | Background tab, return, trigger wallHit. Verify sound plays (_ensure resumes context). |
| M-AUD-04 | Audio on iOS Safari after background | WebKit (Playwright) | **Known risk:** _ensure() calls resume() from game loop, not gesture handler. Verify whether audio works after return. |
| M-AUD-05 | webkitAudioContext fallback | Older Safari emulation | Verify `window.webkitAudioContext` path works. |

### 4.6 Browser Matrix

| Browser | Version | Platform | Priority | Known Risks |
|---------|---------|----------|----------|-------------|
| Chrome | Latest | Android | P0 | Pull-to-refresh interference, no `apple-mobile-web-app-capable` |
| Safari | Latest | iOS 16+ | P0 | AudioContext resume in gesture only, `shadowBlur` perf, `localStorage` private mode |
| Firefox | Latest | Desktop | P1 | No touch events (mouse/keyboard only), no `webkitAudioContext` |
| Chrome | Latest | Desktop | P1 | Baseline reference for all behavior |
| Safari | 14.1+ | macOS | P1 | Older `webkitAudioContext` fallback path |
| Samsung Internet | Latest | Android | P2 | Chrome-based, bottom toolbar affects `innerHeight` |
| In-app WebView | Facebook/Twitter | iOS/Android | P2 | `AudioContext` may be unavailable, `localStorage` may not persist |

---

## 5. End-to-End Test Scenarios

All E2E tests use **Playwright** with a local HTTP server serving `index.html`.

### E2E-01: Full Gameplay Loop (Load → Menu → Play → Die → Menu)

**Setup:** Launch page, wait for scripts to load.

**Action sequence:**
1. Verify MENU state renders ("DRIFT ARROW" text visible, "TAP TO START" pulsing).
2. Tap center of screen → verify COUNTDOWN starts (number overlay visible).
3. Wait ~1.5s → verify state transitions to PLAYING (HUD visible: distance, timer).
4. Steer right for 2 seconds → verify distance increases, arrow moves.
5. Wait for timer to expire (or steer into wall) → verify GAME_OVER renders ("WRECKED" or "TIME UP").
6. Wait 1+ second (gameOverDelay) → tap → verify return to MENU.
7. Verify high score displayed if distance > 0.

**Expected:** Complete cycle with no crashes, no console errors. All 4 states visited.

### E2E-02: Wall Death

**Setup:** Start game, wait for PLAYING.

**Action sequence:**
1. Steer hard right continuously.
2. Arrow should hit right wall within a few seconds.

**Expected:** die() called, deathCause='wall', "WRECKED" displayed, particles emitted at collision point, wallHit() audio fires.

### E2E-03: Timer Expiry Death

**Setup:** Start game, wait for PLAYING.

**Action sequence:**
1. Do nothing (no steering input). Let arrow drive straight.
2. Wait for START_TIME (30s) seconds without collecting tokens.

**Expected:** Timer reaches 0, deathCause='time', "TIME UP" displayed.

### E2E-04: Token Collection Extends Timer

**Setup:** Start game, wait for PLAYING.

**Action sequence:**
1. Steer to collect a time token (green "+" circle).
2. Observe timer value before and after collection.

**Expected:** timeLeft increases by TIME_TOKEN_VALUE (3.5s), green flash on timer (timeFlash > 0), tokenCollect() audio fires, particles emitted.

### E2E-05: Hazard Effects (Slow, Speed, Death)

**Setup:** Start game, advance to segment 80+ where hazards spawn. Seed random for deterministic hazard types if possible.

**Slow hazard sub-scenario:**
1. Steer into blue "~" hazard.
2. Verify "SLOWED" indicator appears in HUD, arrow slows down (speedMult drops toward 0.55).
3. Wait 3 seconds → effect expires.

**Speed hazard sub-scenario:**
1. Steer into orange ">" hazard.
2. Verify "BOOST" indicator appears, arrow speeds up, grip halved (more sliding).

**Death hazard sub-scenario:**
1. Steer into red "X" hazard.
2. Verify instant death, "WRECKED" displayed.

### E2E-06: High Score Persistence

**Setup:** Clear `localStorage` key `'driftArrowHigh2'`.

**Action sequence:**
1. Play game, achieve distance > 0.
2. Die → verify "NEW RECORD!" displayed.
3. Reload page.
4. Verify menu shows "RECORD: Xm" matching previous score.
5. Play again, achieve lower score.
6. Verify "NEW RECORD!" NOT displayed. "BEST: Xm" shown instead.

### E2E-07: Stress — Extended Play Session (5 minutes)

**Setup:** Start game with automated steering (alternating left/right every 2 seconds) and continuous play (auto-restart on death via tap injection).

**Action sequence:**
1. Run for 5 minutes.
2. Monitor: frame rate, JS heap size, `particles.list.length`, `tokens.tokens.length`, `hazards.hazards.length`.

**Expected:** Frame rate stable (no progressive degradation). Heap size growth < 5MB. Array lengths bounded (tokens/hazards culled, particles expire). No console errors.

### E2E-08: Stress — Rapid Input

**Setup:** Start game, wait for PLAYING.

**Action sequence:**
1. Alternate left/right touch every 50ms for 10 seconds (20 inputs/second).

**Expected:** No missed inputs, no crash. Arrow oscillates rapidly. Drift-brake may activate intermittently. Frame rate stable.

### E2E-09: `mobile.html` Smoke Test

**Setup:** Open `mobile.html` directly (file:// protocol or served).

**Action sequence:**
1. Verify menu renders.
2. Tap to start → verify gameplay works.
3. Play for 10 seconds.

**Expected:** Identical behavior to `index.html`. All JS inlined correctly. No 404 errors for missing scripts.

### E2E-10: Back Wall Death

**Setup:** Start game, wait for PLAYING.

**Action sequence:**
1. Steer to turn arrow 180° (hard left/right until facing backward).
2. Drive backward past the backWall barrier.

**Expected:** Back wall collision detected, die() called, deathCause='wall'.

---

## 6. Regression Test Candidates

Tests that should run on **every commit** via CI. Each earns this status because it guards a fragile area identified in the risk map or protects core gameplay invariants.

### Tier 1: Must-pass (block merge)

| Test ID(s) | System | Why it's a regression gate |
|------------|--------|---------------------------|
| U-DPS-05 | `distPointToSeg` zero-length segment | Guards the `lenSq === 0` edge case at `utils.js:13`. If this guard is accidentally removed, any zero-length track segment causes division by zero, producing NaN that propagates through all collision checks. |
| U-ANG-07 | `angleDiff` wrap-around | Guards the `normalizeAngle` while-loop at `utils.js:44-48`. If wrap logic breaks, drift physics produces incorrect angles, causing arrow to teleport or spin. Every physics frame depends on this. |
| U-ARR-REC-05 | Arrow recovery capped by maxSpeed | Guards the hazard slow mechanic at `arrow.js:121-122`. If the `maxSpeed` cap is removed, slow hazards have no effect — the arrow instantly recovers to full speed. Core gameplay balance. |
| U-ARR-DRG-04 | Drift drag floor at 0.5 | Guards `Math.max(0.5, ...)` at `arrow.js:102`. Without this floor, extreme drifts could reduce speedMult to 0, freezing the arrow permanently. |
| U-HAZ-COL-04, U-HAZ-COL-05 | Hazard cancellation (slow cancels speed and vice versa) | Guards the additive stack logic at `hazards.js:62-77`. If cancellation breaks, effects only accumulate — players get permanently slowed/boosted. |
| U-HAZ-GSM-04 | getSpeedMult returns 1 when timer expired | Guards the timer-expiry reset at `hazards.js:92-94`. Without this, expired effects could persist forever. |
| U-GSM-01 through U-GSM-07 | State machine transitions | Guards the 4-state lifecycle. Any broken transition = stuck game. MENU→COUNTDOWN→PLAYING→GAME_OVER→MENU must all work. |
| U-DIE-01, U-DIE-02, U-DIE-04 | Death cause classification + high score | Guards `die()` at `game.js:88-104`. Wrong deathCause = wrong game-over text. Broken high score = lost player progress. |
| U-WALL-02, U-WALL-03 | Wall collision detects wing tips | Guards the 3-point collision at `game.js:124-131`. If any corner point check is removed, the arrow partially phases through walls. |
| U-TRK-WID-06 | All track widths in valid range | Guards width computation at `track.js:226-242`. Width outside [MIN_TRACK_WIDTH, TRACK_WIDTH] causes impossible-to-navigate or too-easy sections. The 5 interacting width factors make regression likely on parameter changes. |
| U-TRK-INI-01 | Track init generates expected segment count | Guards initial generation at `track.js:50`. If LOOK_AHEAD, LOOK_BEHIND, or the +20 buffer changes, the arrow may spawn off-track or the game may stall generating segments. |

### Tier 2: Should-pass (warn but don't block)

| Test ID(s) | System | Why |
|------------|--------|-----|
| U-INP-TCH-03 | Two-touch brake detection | Mobile brake is a core mechanic. Regression here = unplayable on touch. |
| U-TOK-SPN-01, U-TOK-SPN-02 | Token spawn zone and gap | If broken, tokens flood or disappear, breaking game pacing. |
| U-HAZ-SPN-01 | Hazard no-spawn zone | If broken, hazards appear immediately at game start = unfair deaths. |
| U-ARR-DB-03 | Drift-brake activates after 150ms | If delay breaks, drift-brake either never activates or activates instantly. |
| U-CFG-02 | Falsy CFG guard bug | Documents known bug. Regression test ensures it's not silently "fixed" in a way that breaks other defaults. |
| I-CULL-01 | Segment culling removes old tokens/hazards | If broken, arrays grow unbounded → memory leak → frame rate degradation. |
| I-SPN-01 | Initial track has tokens and hazards | If broken, first 30s of gameplay has no pickups → boring + impossible (timer runs out). |

### Tier 3: Smoke tests (fast, catch catastrophic failures)

| Test | What it catches |
|------|----------------|
| E2E-01 (abbreviated: load → tap → play 3s) | Scripts load in order, game boots, basic gameplay works |
| E2E-09 | `mobile.html` build is not broken |

---

## 7. What NOT to Test

### Skip entirely

| Area | Reason |
|------|--------|
| **Canvas 2D rendering internals** | `ctx.fillRect()`, `ctx.arc()`, `ctx.stroke()` are browser engine internals. Testing that `fillRect` fills a rectangle is testing the browser, not the game. |
| **Exact pixel output of draw calls** | Visual regression testing for procedural neon glow effects has very low ROI. The aesthetics are simple shapes — any rendering bug is immediately visible during manual play. |
| **`Math.sin`/`Math.cos` accuracy** | JavaScript math functions are IEEE 754 compliant. Testing their correctness is testing the JS engine. |
| **`requestAnimationFrame` timing precision** | Browser-level scheduling. The game uses whatever timestamp rAF provides. |
| **CSS layout of `index.html` / `mobile.html`** | The game is 100% canvas-rendered. CSS only sets `margin: 0`, `overflow: hidden`, `touch-action: none`. These are not game-critical beyond the initial setup (covered by E2E smoke test). |
| **`scripts/build-mobile.py` and `scripts/sync-dev.py` internals** | Python build scripts are already validated by CI (HTML structure check). Testing Python string concatenation logic is not game testing. |
| **`dev.html` slider panel** | Development tool, not production. If it breaks, only developers are affected, and they'll notice immediately. |
| **Trivial getters** | `Arrow.angle` getter (line 170) just returns `this.facing`. `HazardManager.getActiveEffect()` is a simple conditional return. Not worth individual test cases. |
| **`Particles.render()` / `tokens.render()` / `hazards.render()`** | These are pure Canvas 2D draw sequences with no branching logic beyond "skip if collected/hit". The rendering is visual-only and the conditional skip is implicitly tested by collection/hit tests. |
| **`GameRenderer.drawMenu()` / `drawGameOver()` text content** | Testing that `ctx.fillText('DRIFT', x, y)` outputs "DRIFT" is testing the browser. The E2E smoke test verifies these screens appear. |
| **`valueNoise` internal hash function** | The hash at `utils.js:36-38` uses `Math.sin` for pseudo-randomness. Testing that specific seeds produce specific values couples tests to an implementation detail with no gameplay contract. Only test that output range is [-1, 1]. |

### Test lightly (1-2 cases max, not exhaustive)

| Area | Reason |
|------|--------|
| `GameRenderer._formatDist()` | Pure function, 4 cases cover all branches. Don't add more. |
| `Particles.emit()` count | One test verifying `list.length` increases is sufficient. Particle physics details are visual-only. |
| `camera lerp` (`game.js:302-312`) | One test that camX/camY converge toward the arrow over frames. Exact lerp math is a visual feel concern. |

---

## 8. Implementation Roadmap

### Phase A: Foundation — Test Tooling Setup

**Effort: Small (S)**
**Prerequisites:** None.

**Tasks:**
1. Initialize `package.json` with `vitest` and `playwright` as devDependencies.
2. Create `vitest.config.js` with jsdom environment.
3. Create global test setup file that:
   - Defines `CFG` as a global (mirroring `config.js` defaults).
   - Defines utility functions (`lerp`, `clamp`, `dist`, `distPointToSeg`, `distToArrowWings`, `valueNoise`, `normalizeAngle`, `angleDiff`) as globals.
   - Defines `HAZARD` enum and `STATE` enum as globals.
   - Provides Canvas 2D context mock (no-op for all draw methods).
   - Provides `localStorage` mock (jsdom has one, but add error-throwing variant).
   - Provides `AudioContext` mock class.
4. Create `test-helpers.js` with `createArrowAt()`, `createStraightTrack()`, `createGameWithMocks()`, `stepGame()`.
5. Port existing `collision-tests.html` assertions to Vitest format as `tests/collision.test.js` — validates the setup works.
6. Configure CI (`ci.yml`) to run `npx vitest run` alongside existing Puppeteer tests.
7. Set up Playwright config with device profiles (iPhone 14, iPad, desktop Chrome).

**Deliverable:** `npm test` runs and passes with ported collision tests. Playwright can open `index.html` on localhost.

### Phase B: Core — P0 Unit Tests

**Effort: Large (L)**
**Prerequisites:** Phase A complete.

**Tasks:**
1. **Arrow physics tests** (`tests/arrow.test.js`): All U-ARR-* tests. This is the largest test file — covers steering, grip, drift drag, recovery, drift-brake state machine, position update, realignment, trail. ~35 test cases.
2. **Hazard effect system tests** (`tests/hazards.test.js`): All U-HAZ-* tests. Effect stack, cancellation, timer expiry, getSpeedMult, spawn logic. ~20 test cases.
3. **Game state machine tests** (`tests/game-state.test.js`): All U-GSM-*, U-DIE-*, U-START-*, U-DT-*, U-TIMER-*, U-BACK-*, U-WALL-*, U-BWALL-* tests. Requires Game with mocked subsystems. ~30 test cases.
4. **Track generation tests** (`tests/track.test.js`): All U-TRK-* tests. Init, width computation, runway behavior, findClosest, update, overlap detection. ~15 test cases. Seed `Math.random` for determinism.
5. **Token system tests** (`tests/tokens.test.js`): All U-TOK-* tests. Spawn, collect, cull. ~10 test cases.

**Deliverable:** ~110 unit tests covering all P0 systems. All regression Tier 1 tests passing.

### Phase C: Integration — System Boundary Tests

**Effort: Medium (M)**
**Prerequisites:** Phase B complete (unit tests validate individual systems, so integration tests can focus on boundaries).

**Tasks:**
1. **Speed multiplier chain** (`tests/integration/speed-chain.test.js`): I-SPD-01 through I-SPD-04. Requires real Arrow + HazardManager + Game.updatePlaying() with controlled inputs.
2. **Spawn callback** (`tests/integration/spawning.test.js`): I-SPN-01 through I-SPN-05, I-CB-01, I-CB-02. Requires real Track + TokenManager + HazardManager.
3. **Collision integration** (`tests/integration/collision.test.js`): I-WALL-01 through I-WALL-05. Real Track + Arrow + Game.checkWallCollision().
4. **Culling chain** (`tests/integration/culling.test.js`): I-CULL-01 through I-CULL-04. Real Track + TokenManager + HazardManager + Game.updatePlaying().
5. **Death flag chain** (`tests/integration/death.test.js`): I-DEATH-01 through I-DEATH-04. Documents the `diedFromWall` bug.
6. **Audio lifecycle** (`tests/integration/audio.test.js`): I-AUD-01 through I-AUD-05. Mocked AudioContext.

**Deliverable:** ~25 integration tests covering all 9 integration boundaries from the risk map.

### Phase D: Mobile — Touch, Viewport, Lifecycle, Browser Tests

**Effort: Medium (M)**
**Prerequisites:** Phase A (Playwright setup). Can run in parallel with Phase B/C.

**Tasks:**
1. **Touch input E2E** (`tests/e2e/touch.spec.js`): M-TCH-01 through M-TCH-15. Playwright touch emulation on iPhone 14 profile.
2. **Viewport tests** (`tests/e2e/viewport.spec.js`): M-VP-01 through M-VP-11. Multiple device profiles.
3. **Lifecycle tests** (`tests/e2e/lifecycle.spec.js`): M-LIFE-01 through M-LIFE-05. Tab visibility API via `page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))` or `page.context().pages()` switching.
4. **Audio tests** (`tests/e2e/audio.spec.js`): M-AUD-01 through M-AUD-05. Chrome and WebKit profiles.
5. **Performance baseline** (`tests/e2e/performance.spec.js`): M-PERF-01 through M-PERF-05. Frame time measurements.

**Deliverable:** ~30 E2E tests covering mobile-specific risks. Browser matrix validated.

### Phase E: Expansion — P1 Tests, E2E Scenarios, Visual Regression

**Effort: Medium (M)**
**Prerequisites:** Phases B-D complete.

**Tasks:**
1. **P1 unit tests**: Input manager (U-INP-*), audio state (U-AUD-*), config defaults (U-CFG-*), renderer format (U-FMT-*). ~25 tests.
2. **P2 unit tests**: Particles (U-PRT-*). ~5 tests.
3. **Full E2E scenarios** (`tests/e2e/gameplay.spec.js`): E2E-01 through E2E-10. Full gameplay loops, stress tests, persistence.
4. **Visual regression (optional)**: If warranted, add Playwright screenshot comparison for: menu screen, HUD layout, game-over screen. Use `toHaveScreenshot()` with generous thresholds (neon glow and pulse animations vary frame-to-frame).
5. **`mobile.html` smoke test** in CI: E2E-09 as a separate CI job.

**Deliverable:** Complete test suite. ~170 total tests (110 unit + 25 integration + 35 E2E).

### Phase Summary

| Phase | Effort | Tests | Depends on | Key deliverable |
|-------|--------|-------|------------|-----------------|
| A: Foundation | S | ~5 (ported) | Nothing | Tooling works, CI integrated |
| B: Core P0 | L | ~110 | A | All critical game logic tested |
| C: Integration | M | ~25 | B | System boundaries verified |
| D: Mobile | M | ~30 | A | Touch, viewport, lifecycle, audio covered |
| E: Expansion | M | ~30 | B-D | Full coverage, E2E scenarios, optional visual |
| **Total** | | **~200** | | |
