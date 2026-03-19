# Testing Plan — Game State Machine (game.js)

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
