# Runtime Behavior — Player and Input Systems

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
