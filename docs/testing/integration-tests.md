# Testing Plan — Integration Test Specifications

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

**Contract:** `game.js:202-205` — when `track.minSegIdx > 0`, `tokens.cullBefore()` and `hazards.cullBefore()` are called with that value. **Fixed** — previously used a falsy check.

| ID | Scenario | Setup | Expected |
|----|----------|-------|----------|
| I-CULL-01 | Arrow advances, old segments trimmed | track.update() trims segments | track.minSegIdx > 0, tokens/hazards with segIdx < minSegIdx removed |
| I-CULL-02 | No segments trimmed yet | track.minSegIdx = 0 | Culling skipped (correct — `> 0` check, **fixed** from previous falsy guard) |
| I-CULL-03 | Collected token on culled segment | Token with collected=true on old segment | Removed by cullBefore, reducing array size |
| I-CULL-04 | Hit hazard on culled segment | Hazard with hit=true on old segment | Removed by cullBefore |

### 3.6 Death Hazard → die() Flag Chain (Boundary: state consistency)

**Contract:** Death hazard collision at `game.js:259-264` sets `diedFromWall = false` then calls `die()`. `die()` checks `diedFromWall` to set `deathCause`. **Fixed** — previously death hazard incorrectly set `diedFromWall = true`.

| ID | Scenario | Setup | Expected |
|----|----------|-------|----------|
| I-DEATH-01 | Wall collision death | Arrow hits wall | deathCause = 'wall', diedFromWall was set true at line 144 |
| I-DEATH-02 | Timer expiry death | timeLeft reaches 0 | deathCause = 'time' |
| I-DEATH-03 | Death hazard | Arrow hits DEATH hazard | deathCause = 'other' (diedFromWall=false at line 261). **Fixed** — previously produced deathCause = 'wall'. |
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
