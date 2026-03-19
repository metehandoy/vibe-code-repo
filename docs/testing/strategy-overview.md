# Testing Plan — Testing Strategy Overview

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
