# Testing Plan — What NOT to Test

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
