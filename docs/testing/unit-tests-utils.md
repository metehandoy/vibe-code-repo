# Testing Plan — Utility Functions (utils.js)

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
