# Testing Plan — Regression Test Candidates

Tests that should run on **every commit** via CI. Each earns this status because it guards a fragile area identified in the risk map or protects core gameplay invariants.

### Tier 1: Must-pass (block merge)

| Test ID(s) | System | Why it's a regression gate |
|------------|--------|---------------------------|
| U-DPS-05 | `distPointToSeg` zero-length segment | Guards the `lenSq === 0` edge case at `utils.js:13`. If this guard is accidentally removed, any zero-length track segment causes division by zero, producing NaN that propagates through all collision checks. |
| U-ANG-07 | `angleDiff` wrap-around | Guards the `normalizeAngle` while-loop at `utils.js:44-48`. If wrap logic breaks, drift physics produces incorrect angles, causing arrow to teleport or spin. Every physics frame depends on this. |
| U-ARR-REC-05 | Arrow recovery capped by maxSpeed | Guards the hazard slow mechanic at `arrow.js:121-122`. If the `maxSpeed` cap is removed, slow hazards have no effect — the arrow instantly recovers to full speed. Core gameplay balance. |
| U-ARR-DRG-04 | Drift drag floor at 0.5 | Guards `Math.max(0.5, ...)` at `arrow.js:102`. Without this floor, extreme drifts could reduce speedMult to 0, freezing the arrow permanently. |
| U-HAZ-COL-04, U-HAZ-COL-05 | Hazard cancellation (slow cancels speed and vice versa) | Guards the additive stack logic at `hazards.js:62-77`. If cancellation breaks, effects only accumulate — players get permanently slowed/boosted. |
| U-HAZ-GSM-04 | getSpeedMult returns 1 when timer expired | Guards the timer-expiry reset at `hazards.js:92-94`. Without this, expired effects could persist forever. |
| U-GSM-01 through U-GSM-07 | State machine transitions | Guards the 4-state lifecycle. Any broken transition = stuck game. MENU→COUNTDOWN→PLAYING→GAME_OVER→MENU must all work. |
| U-DIE-01, U-DIE-02, U-DIE-04 | Death cause classification + high score | Guards `die()` at `game.js:88-104`. Wrong deathCause = wrong game-over text. Broken high score = lost player progress. |
| U-WALL-02, U-WALL-03 | Wall collision detects wing tips | Guards the 3-point collision at `game.js:124-131`. If any corner point check is removed, the arrow partially phases through walls. |
| U-TRK-WID-06 | All track widths in valid range | Guards width computation at `track.js:226-242`. Width outside [MIN_TRACK_WIDTH, TRACK_WIDTH] causes impossible-to-navigate or too-easy sections. The 5 interacting width factors make regression likely on parameter changes. |
| U-TRK-INI-01 | Track init generates expected segment count | Guards initial generation at `track.js:50`. If LOOK_AHEAD, LOOK_BEHIND, or the +20 buffer changes, the arrow may spawn off-track or the game may stall generating segments. |

### Tier 2: Should-pass (warn but don't block)

| Test ID(s) | System | Why |
|------------|--------|-----|
| U-INP-TCH-03 | Two-touch brake detection | Mobile brake is a core mechanic. Regression here = unplayable on touch. |
| U-TOK-SPN-01, U-TOK-SPN-02 | Token spawn zone and gap | If broken, tokens flood or disappear, breaking game pacing. |
| U-HAZ-SPN-01 | Hazard no-spawn zone | If broken, hazards appear immediately at game start = unfair deaths. |
| U-ARR-DB-03 | Drift-brake activates after 150ms | If delay breaks, drift-brake either never activates or activates instantly. |
| U-CFG-02 | Falsy CFG guard bug | Documents known bug. Regression test ensures it's not silently "fixed" in a way that breaks other defaults. |
| I-CULL-01 | Segment culling removes old tokens/hazards | If broken, arrays grow unbounded → memory leak → frame rate degradation. |
| I-SPN-01 | Initial track has tokens and hazards | If broken, first 30s of gameplay has no pickups → boring + impossible (timer runs out). |

### Tier 3: Smoke tests (fast, catch catastrophic failures)

| Test | What it catches |
|------|----------------|
| E2E-01 (abbreviated: load → tap → play 3s) | Scripts load in order, game boots, basic gameplay works |
| E2E-09 | `mobile.html` build is not broken |
