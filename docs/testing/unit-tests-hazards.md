# Testing Plan — Hazard Effect System (hazards.js)

**Priority: P0** — Effect stack cancellation logic is the #5 complexity hotspot. Untested despite medium complexity and subtle interaction with arrow speed.

#### `HazardManager.checkCollision()` — `hazards.js:51-87`

| ID | Given | When | Then |
|----|-------|------|------|
| U-HAZ-COL-01 | SLOW hazard at arrow tip, effectStack=0 | checkCollision | Returns 'slow', effectStack=-1, effectTimer=HAZARD_EFFECT_DUR |
| U-HAZ-COL-02 | SPEED hazard at arrow tip, effectStack=0 | checkCollision | Returns 'speed', effectStack=1, effectTimer=HAZARD_EFFECT_DUR |
| U-HAZ-COL-03 | DEATH hazard at arrow tip | checkCollision | Returns 'death', no stack change |
| U-HAZ-COL-04 | SLOW hazard, effectStack=1 (boosted) | checkCollision | effectStack=0, effectTimer=0 (cancellation) |
| U-HAZ-COL-05 | SPEED hazard, effectStack=-1 (slowed) | checkCollision | effectStack=0, effectTimer=0 (cancellation) |
| U-HAZ-COL-06 | SLOW hazard, effectStack=-1 (already slowed) | checkCollision | effectStack=-2, effectTimer reset (stacking) |
| U-HAZ-COL-07 | SPEED hazard, effectStack=2 (double boosted) | checkCollision | effectStack=3, effectTimer reset |
| U-HAZ-COL-08 | Hazard already hit (h.hit=true) | checkCollision | Skipped, returns null |
| U-HAZ-COL-09 | Hazard just outside radius | checkCollision | Returns null (no hit) |
| U-HAZ-COL-10 | DEATH hazard uses DEATH_HAZARD_RADIUS (5), not HAZARD_RADIUS (10) | checkCollision at distance 7 | No hit for DEATH, would hit for SLOW |

#### `HazardManager.update()` — `hazards.js:89-97`

| ID | Given | When | Then |
|----|-------|------|------|
| U-HAZ-UPD-01 | effectTimer=180, effectStack=-1 | update(dt60=1) | effectTimer=179 |
| U-HAZ-UPD-02 | effectTimer=1, effectStack=-2 | update(dt60=1) | effectTimer=0, effectStack=0 (reset on expiry) |
| U-HAZ-UPD-03 | effectTimer=0 | update(dt60=1) | No change (already expired) |

#### `HazardManager.getSpeedMult()` — `hazards.js:99-104`

| ID | Given | When | Then |
|----|-------|------|------|
| U-HAZ-GSM-01 | effectStack=0 | getSpeedMult | Returns 1 |
| U-HAZ-GSM-02 | effectStack=-1, effectTimer=100 | getSpeedMult | Returns HAZARD_SLOW_MULT (0.55) |
| U-HAZ-GSM-03 | effectStack=1, effectTimer=100 | getSpeedMult | Returns HAZARD_SPEED_MULT (1.35) |
| U-HAZ-GSM-04 | effectStack=-1, effectTimer=0 | getSpeedMult | Returns 1 (timer expired) |
| U-HAZ-GSM-05 | effectStack=5, effectTimer=100 | getSpeedMult | Returns HAZARD_SPEED_MULT (magnitude irrelevant) |

#### `HazardManager.spawnOnSegment()` — `hazards.js:21-44`

| ID | Given | When | Then |
|----|-------|------|------|
| U-HAZ-SPN-01 | seg.index < HAZARD_NO_SPAWN_ZONE (80) | spawnOnSegment | No spawn (early exit) |
| U-HAZ-SPN-02 | seg.index - lastSpawnSeg < HAZARD_MIN_GAP (10) | spawnOnSegment | No spawn (gap enforcement) |
| U-HAZ-SPN-03 | Math.random returns 0.001 (below chance) | spawnOnSegment | Hazard spawned, lastSpawnSeg updated |
| U-HAZ-SPN-04 | Math.random returns 0.99 (above chance) | spawnOnSegment | No spawn |
| U-HAZ-SPN-05 | Math.random < 0.35 for type roll | spawnOnSegment | Type is HAZARD.SLOW |
| U-HAZ-SPN-06 | Math.random in [0.35, 0.70) for type roll | spawnOnSegment | Type is HAZARD.SPEED |
| U-HAZ-SPN-07 | Math.random >= 0.70 for type roll | spawnOnSegment | Type is HAZARD.DEATH |

#### `HazardManager.cullBefore()` — `hazards.js:46-48`

| ID | Given | When | Then |
|----|-------|------|------|
| U-HAZ-CUL-01 | 5 hazards with segIdx [10,20,30,40,50] | cullBefore(25) | 3 hazards remain (segIdx >= 25) |
| U-HAZ-CUL-02 | Empty array | cullBefore(100) | Remains empty, no error |
