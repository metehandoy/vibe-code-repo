# Testing Plan — End-to-End Test Scenarios

All E2E tests use **Playwright** with a local HTTP server serving `index.html`.

### E2E-01: Full Gameplay Loop (Load → Menu → Play → Die → Menu)

**Setup:** Launch page, wait for scripts to load.

**Action sequence:**
1. Verify MENU state renders ("DRIFT ARROW" text visible, "TAP TO START" pulsing).
2. Tap center of screen → verify COUNTDOWN starts (number overlay visible).
3. Wait ~1.5s → verify state transitions to PLAYING (HUD visible: distance, timer).
4. Steer right for 2 seconds → verify distance increases, arrow moves.
5. Wait for timer to expire (or steer into wall) → verify GAME_OVER renders ("WRECKED" or "TIME UP").
6. Wait 1+ second (gameOverDelay) → tap → verify return to MENU.
7. Verify high score displayed if distance > 0.

**Expected:** Complete cycle with no crashes, no console errors. All 4 states visited.

### E2E-02: Wall Death

**Setup:** Start game, wait for PLAYING.

**Action sequence:**
1. Steer hard right continuously.
2. Arrow should hit right wall within a few seconds.

**Expected:** die() called, deathCause='wall', "WRECKED" displayed, particles emitted at collision point, wallHit() audio fires.

### E2E-03: Timer Expiry Death

**Setup:** Start game, wait for PLAYING.

**Action sequence:**
1. Do nothing (no steering input). Let arrow drive straight.
2. Wait for START_TIME (30s) seconds without collecting tokens.

**Expected:** Timer reaches 0, deathCause='time', "TIME UP" displayed.

### E2E-04: Token Collection Extends Timer

**Setup:** Start game, wait for PLAYING.

**Action sequence:**
1. Steer to collect a time token (green "+" circle).
2. Observe timer value before and after collection.

**Expected:** timeLeft increases by TIME_TOKEN_VALUE (3.5s), green flash on timer (timeFlash > 0), tokenCollect() audio fires, particles emitted.

### E2E-05: Hazard Effects (Slow, Speed, Death)

**Setup:** Start game, advance to segment 80+ where hazards spawn. Seed random for deterministic hazard types if possible.

**Slow hazard sub-scenario:**
1. Steer into blue "~" hazard.
2. Verify "SLOWED" indicator appears in HUD, arrow slows down (speedMult drops toward 0.55).
3. Wait 3 seconds → effect expires.

**Speed hazard sub-scenario:**
1. Steer into orange ">" hazard.
2. Verify "BOOST" indicator appears, arrow speeds up, grip halved (more sliding).

**Death hazard sub-scenario:**
1. Steer into red "X" hazard.
2. Verify instant death, "WRECKED" displayed.

### E2E-06: High Score Persistence

**Setup:** Clear `localStorage` key `'driftArrowHigh2'`.

**Action sequence:**
1. Play game, achieve distance > 0.
2. Die → verify "NEW RECORD!" displayed.
3. Reload page.
4. Verify menu shows "RECORD: Xm" matching previous score.
5. Play again, achieve lower score.
6. Verify "NEW RECORD!" NOT displayed. "BEST: Xm" shown instead.

### E2E-07: Stress — Extended Play Session (5 minutes)

**Setup:** Start game with automated steering (alternating left/right every 2 seconds) and continuous play (auto-restart on death via tap injection).

**Action sequence:**
1. Run for 5 minutes.
2. Monitor: frame rate, JS heap size, `particles.list.length`, `tokens.tokens.length`, `hazards.hazards.length`.

**Expected:** Frame rate stable (no progressive degradation). Heap size growth < 5MB. Array lengths bounded (tokens/hazards culled, particles expire). No console errors.

### E2E-08: Stress — Rapid Input

**Setup:** Start game, wait for PLAYING.

**Action sequence:**
1. Alternate left/right touch every 50ms for 10 seconds (20 inputs/second).

**Expected:** No missed inputs, no crash. Arrow oscillates rapidly. Drift-brake may activate intermittently. Frame rate stable.

### E2E-09: `mobile.html` Smoke Test

**Setup:** Open `mobile.html` directly (file:// protocol or served).

**Action sequence:**
1. Verify menu renders.
2. Tap to start → verify gameplay works.
3. Play for 10 seconds.

**Expected:** Identical behavior to `index.html`. All JS inlined correctly. No 404 errors for missing scripts.

### E2E-10: Back Wall Death

**Setup:** Start game, wait for PLAYING.

**Action sequence:**
1. Steer to turn arrow 180° (hard left/right until facing backward).
2. Drive backward past the backWall barrier.

**Expected:** Back wall collision detected, die() called, deathCause='wall'.
