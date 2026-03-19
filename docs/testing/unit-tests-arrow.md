# Testing Plan — Arrow Physics (arrow.js)

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
