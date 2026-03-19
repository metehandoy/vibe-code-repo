# Risk & Complexity — General Fragile Areas

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
Set to `true` before `die()` on wall hit (game.js:144) and back wall hit (game.js:169). Death hazards set it to `false` (game.js:261) so they correctly produce `deathCause = 'other'`. Checked in `die()` to set `deathCause` (game.js:92). **Fixed** — previously death hazards incorrectly set `diedFromWall = true`, causing "WRECKED" to display instead of a hazard-specific message.

**`arrow.alive` — never used:**
Set to `true` in `reset()` (arrow.js:17), never checked anywhere. If code were added that checks `arrow.alive`, it would always be true even after death. Vestigial from a removed feature.

**Track `minSegIdx` check:**
`game.js:202` — `if (this.track.minSegIdx > 0)`. **Fixed** — previously used a falsy check (`if (this.track.minSegIdx)`) which would skip culling when `minSegIdx === 0`. Now uses an explicit `> 0` comparison.

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
- `parseInt(localStorage.getItem('driftArrowHigh2') || '0', 10)` (game.js:21): Now wrapped in try-catch — **fixed**. If localStorage throws (e.g., Safari private mode), `highScore` defaults to 0. If localStorage returns invalid data, `parseInt("garbage", 10)` returns NaN. The `|| '0'` fallback handles null/undefined but not corrupt values. **Low risk** — requires manual localStorage corruption.

**`normalizeAngle` infinite loop risk:**
`utils.js:44-48` uses while-loops to normalize: `while (a > Math.PI) a -= Math.PI * 2`. If `a` is `Infinity` or `NaN`, this loops forever. However, `normalizeAngle` is only called via `angleDiff()` which subtracts two finite angles. No risk of infinite input in practice.
