# Risk & Complexity — Untested Surface Area

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
