# Testing Plan — Token System (tokens.js)

**Priority: P1** — Similar structure to hazards. Partially tested by existing collision tests but spawn logic and collect mechanics are untested.

#### `TimeTokenManager.checkCollect()` — `tokens.js:60-72`

| ID | Given | When | Then |
|----|-------|------|------|
| U-TOK-COL-01 | Token within TOKEN_RADIUS of arrow wing | checkCollect | Returns TIME_TOKEN_VALUE (3.5), t.collected=true |
| U-TOK-COL-02 | Token already collected | checkCollect | Skipped, returns 0 |
| U-TOK-COL-03 | Two uncollected tokens both within range | checkCollect | Returns 2 * TIME_TOKEN_VALUE, both marked collected |
| U-TOK-COL-04 | Token just outside TOKEN_RADIUS | checkCollect | Returns 0 |
| U-TOK-COL-05 | Token collected | checkCollect | collectFlash set to 20 |

#### `TimeTokenManager.spawnOnSegment()` — `tokens.js:37-53`

| ID | Given | When | Then |
|----|-------|------|------|
| U-TOK-SPN-01 | seg.index < TOKEN_NO_SPAWN_ZONE (40) | spawnOnSegment | No spawn |
| U-TOK-SPN-02 | seg.index - lastSpawnSeg < TOKEN_MIN_GAP (25) | spawnOnSegment | No spawn |
| U-TOK-SPN-03 | Random passes chance check | spawnOnSegment | Token added with correct segIdx and position within track width |
| U-TOK-SPN-04 | difficulty=1.0 | spawnOnSegment | Spawn chance = TOKEN_SPAWN_CHANCE + 0.01 = 0.035 |
