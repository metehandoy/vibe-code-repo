# Testing Plan — Camera System (game.js)

**Priority: P1** — Camera logic is tightly coupled with gameplay feel. Zoom, directional positioning, and curvature offset are all computed per frame and directly affect playability at varying speeds.

**Test file:** `tests/camera-tests.html`

#### Zoom Calculation — `game.js:309-315`

`targetZoom = clamp(1 / Math.pow(speedRatio, 0.35), 0.55, 1.15)`

| ID | Given | When | Then |
|----|-------|------|------|
| U-CAM-01 | ARROW_SPEED=3.5, speedMult=1.0 (ratio=1.0) | compute targetZoom | ≈ 1.0 (neutral zoom) |
| U-CAM-02 | speedMult=1.35 (ratio=1.35) | compute targetZoom | < 1.0 (zoom out) |
| U-CAM-03 | speedMult=0.55 (ratio=0.55) | compute targetZoom | > 1.0 (zoom in) |
| U-CAM-04 | ARROW_SPEED=10 (ratio≈2.86) | compute targetZoom | < 0.75 |
| U-CAM-05 | ARROW_SPEED=10, speedMult=1.35 (ratio≈3.86) | compute targetZoom | ≥ 0.55 (floor clamp) |
| U-CAM-06 | speedMult=0.05 (ratio=0.05) | compute targetZoom | ≤ 1.15 (ceiling clamp) |
| U-CAM-07 | ratio 0.5, 1.0, 2.0 | compare zoom values | monotonically decreasing |

#### Directional Screen Offset — `game.js:317-325`

`screenOff = dir * screenDim * 0.28`

| ID | Given | When | Then |
|----|-------|------|------|
| U-CAM-08 | moveAngle = -PI/2 (up) | compute offsets | screenOffX ≈ 0, screenOffY < 0 |
| U-CAM-09 | moveAngle = 0 (right) | compute offsets | screenOffX > 0, screenOffY ≈ 0 |
| U-CAM-10 | moveAngle = PI/2 (down) | compute offsets | screenOffY > 0 |
| U-CAM-11 | moveAngle = PI (left) | compute offsets | screenOffX < 0 |
| U-CAM-12 | moveAngle = 0 (right) | check magnitude | abs(screenOffX) = 0.28 × screenW |
| U-CAM-13 | moveAngle = -PI/2 (up) | check magnitude | abs(screenOffY) = 0.28 × screenH |
| U-CAM-14 | moveAngle = PI/4 (down-right) | compute offsets | both offsets positive |

#### Look-Ahead Distance — `game.js:327-328`

`lookAheadDist = 40 + 30 * max(0, speedRatio - 1)`

| ID | Given | When | Then |
|----|-------|------|------|
| U-CAM-15 | speedRatio = 1.0 | compute lookAhead | = 40 |
| U-CAM-16 | speedRatio = 2.0 | compute lookAhead | = 70 |
| U-CAM-17 | speedRatio = 0.5 | compute lookAhead | = 40 (does not shrink) |
| U-CAM-18 | speedRatio = 3.0 | compute lookAhead | = 100 |
| U-CAM-19 | ratios 1.0, 1.5, 2.0 | compare values | monotonically increasing |

#### Camera Lerp Speed — `game.js:356-358`

`camSpeed = baseCamSpeed + 0.03 * max(0, speedRatio - 1)`

| ID | Given | When | Then |
|----|-------|------|------|
| U-CAM-20 | ratio=1, drifting=false | compute camSpeed | = 0.07 |
| U-CAM-21 | ratio=1, drifting=true | compute camSpeed | = 0.04 |
| U-CAM-22 | ratio=2, drifting=false | compute camSpeed | = 0.10 |
| U-CAM-23 | ratio=0.5, drifting=false | compute camSpeed | = 0.07 (no reduction) |
| U-CAM-24 | ratio=2, drifting=true | compute camSpeed | = 0.07 |
| U-CAM-25 | ratios 1.0, 2.0, 3.0 | compare values | monotonically increasing |

#### Curvature Offset — `game.js:330-351`

| ID | Given | When | Then |
|----|-------|------|------|
| U-CAM-26 | straight track (all same angle) | compute curvature | totalCurve = 0 |
| U-CAM-27 | right curve, moving up | compute offset | curveOffX > 0 (camera shifts right → arrow left) |
| U-CAM-28 | left curve, moving up | compute avgCurve | avgCurve < 0 |
| U-CAM-29 | extreme curvature (avgCurve=2.0) | compute strength | capped at 100 |

#### Camera Target Composition — `game.js:353-355`

| ID | Given | When | Then |
|----|-------|------|------|
| U-CAM-30 | moving up, straight track | compute arrow screen pos | arrow in bottom half |
| U-CAM-31 | moving up, straight track | compute arrow screen pos | arrow horizontally centered |
| U-CAM-32 | moving right, straight track | compute arrow screen pos | arrow in left half |
| U-CAM-33 | moving right, straight track | compute arrow screen pos | arrow vertically centered |
| U-CAM-34 | moving up, right curvature | compute arrow screen pos | arrow in bottom-left |
| U-CAM-35 | moving up, left curvature | compute arrow screen pos | arrow in bottom-right |

#### Start Camera Snap — `game.js:82-88`

| ID | Given | When | Then |
|----|-------|------|------|
| U-CAM-36 | after startGame() | check camX, camY | matches snap formula with fraction=0.28 |
| U-CAM-37 | after startGame() | check camZoom | = 1.0 |
| U-CAM-38 | after startGame() | check arrow screen pos | arrow in bottom half (initial direction is up) |

#### Zoom Smoothing (Multi-Frame) — `game.js:315`

| ID | Given | When | Then |
|----|-------|------|------|
| U-CAM-39 | camZoom=1.0, target=0.75 | 1 lerp step | between 1.0 and 0.75 |
| U-CAM-40 | after 20 lerp steps | compare to 1-step | closer to target |
| U-CAM-41 | after 20 lerp steps | check overshoot | > target (no overshoot) |
| U-CAM-42 | after 100 lerp steps | check convergence | ≈ target (within 0.01) |

#### Integrated Camera Update — `game.js` (via Game instance)

| ID | Given | When | Then |
|----|-------|------|------|
| U-CAM-43 | game running at default speed | 30 frames of updatePlaying | camera position changed |
| U-CAM-44 | game running at default speed | 30 frames of updatePlaying | zoom ≈ 1.0 |
| U-CAM-45 | ARROW_SPEED=10 | 60 frames of updatePlaying | zoom < 0.85 |
