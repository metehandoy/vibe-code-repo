# Testing Plan — Implementation Roadmap

### Phase A: Foundation — Test Tooling Setup

**Effort: Small (S)**
**Prerequisites:** None.

**Tasks:**
1. Initialize `package.json` with `vitest` and `playwright` as devDependencies.
2. Create `vitest.config.js` with jsdom environment.
3. Create global test setup file that:
   - Defines `CFG` as a global (mirroring `config.js` defaults).
   - Defines utility functions (`lerp`, `clamp`, `dist`, `distPointToSeg`, `distToArrowWings`, `valueNoise`, `normalizeAngle`, `angleDiff`) as globals.
   - Defines `HAZARD` enum and `STATE` enum as globals.
   - Provides Canvas 2D context mock (no-op for all draw methods).
   - Provides `localStorage` mock (jsdom has one, but add error-throwing variant).
   - Provides `AudioContext` mock class.
4. Create `test-helpers.js` with `createArrowAt()`, `createStraightTrack()`, `createGameWithMocks()`, `stepGame()`.
5. Port existing `collision-tests.html` assertions to Vitest format as `tests/collision.test.js` — validates the setup works.
6. Configure CI (`ci.yml`) to run `npx vitest run` alongside existing Puppeteer tests.
7. Set up Playwright config with device profiles (iPhone 14, iPad, desktop Chrome).

**Deliverable:** `npm test` runs and passes with ported collision tests. Playwright can open `index.html` on localhost.

### Phase B: Core — P0 Unit Tests

**Effort: Large (L)**
**Prerequisites:** Phase A complete.

**Tasks:**
1. **Arrow physics tests** (`tests/arrow.test.js`): All U-ARR-* tests. This is the largest test file — covers steering, grip, drift drag, recovery, drift-brake state machine, position update, realignment, trail. ~35 test cases.
2. **Hazard effect system tests** (`tests/hazards.test.js`): All U-HAZ-* tests. Effect stack, cancellation, timer expiry, getSpeedMult, spawn logic. ~20 test cases.
3. **Game state machine tests** (`tests/game-state.test.js`): All U-GSM-*, U-DIE-*, U-START-*, U-DT-*, U-TIMER-*, U-BACK-*, U-WALL-*, U-BWALL-* tests. Requires Game with mocked subsystems. ~30 test cases.
4. **Track generation tests** (`tests/track.test.js`): All U-TRK-* tests. Init, width computation, runway behavior, findClosest, update, overlap detection. ~15 test cases. Seed `Math.random` for determinism.
5. **Token system tests** (`tests/tokens.test.js`): All U-TOK-* tests. Spawn, collect, cull. ~10 test cases.

**Deliverable:** ~110 unit tests covering all P0 systems. All regression Tier 1 tests passing.

### Phase C: Integration — System Boundary Tests

**Effort: Medium (M)**
**Prerequisites:** Phase B complete (unit tests validate individual systems, so integration tests can focus on boundaries).

**Tasks:**
1. **Speed multiplier chain** (`tests/integration/speed-chain.test.js`): I-SPD-01 through I-SPD-04. Requires real Arrow + HazardManager + Game.updatePlaying() with controlled inputs.
2. **Spawn callback** (`tests/integration/spawning.test.js`): I-SPN-01 through I-SPN-05, I-CB-01, I-CB-02. Requires real Track + TokenManager + HazardManager.
3. **Collision integration** (`tests/integration/collision.test.js`): I-WALL-01 through I-WALL-05. Real Track + Arrow + Game.checkWallCollision().
4. **Culling chain** (`tests/integration/culling.test.js`): I-CULL-01 through I-CULL-04. Real Track + TokenManager + HazardManager + Game.updatePlaying().
5. **Death flag chain** (`tests/integration/death.test.js`): I-DEATH-01 through I-DEATH-04. Documents the `diedFromWall` bug.
6. **Audio lifecycle** (`tests/integration/audio.test.js`): I-AUD-01 through I-AUD-05. Mocked AudioContext.

**Deliverable:** ~25 integration tests covering all 9 integration boundaries from the risk map.

### Phase D: Mobile — Touch, Viewport, Lifecycle, Browser Tests

**Effort: Medium (M)**
**Prerequisites:** Phase A (Playwright setup). Can run in parallel with Phase B/C.

**Tasks:**
1. **Touch input E2E** (`tests/e2e/touch.spec.js`): M-TCH-01 through M-TCH-15. Playwright touch emulation on iPhone 14 profile.
2. **Viewport tests** (`tests/e2e/viewport.spec.js`): M-VP-01 through M-VP-11. Multiple device profiles.
3. **Lifecycle tests** (`tests/e2e/lifecycle.spec.js`): M-LIFE-01 through M-LIFE-05. Tab visibility API via `page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))` or `page.context().pages()` switching.
4. **Audio tests** (`tests/e2e/audio.spec.js`): M-AUD-01 through M-AUD-05. Chrome and WebKit profiles.
5. **Performance baseline** (`tests/e2e/performance.spec.js`): M-PERF-01 through M-PERF-05. Frame time measurements.

**Deliverable:** ~30 E2E tests covering mobile-specific risks. Browser matrix validated.

### Phase E: Expansion — P1 Tests, E2E Scenarios, Visual Regression

**Effort: Medium (M)**
**Prerequisites:** Phases B-D complete.

**Tasks:**
1. **P1 unit tests**: Input manager (U-INP-*), audio state (U-AUD-*), config defaults (U-CFG-*), renderer format (U-FMT-*). ~25 tests.
2. **P2 unit tests**: Particles (U-PRT-*). ~5 tests.
3. **Full E2E scenarios** (`tests/e2e/gameplay.spec.js`): E2E-01 through E2E-10. Full gameplay loops, stress tests, persistence.
4. **Visual regression (optional)**: If warranted, add Playwright screenshot comparison for: menu screen, HUD layout, game-over screen. Use `toHaveScreenshot()` with generous thresholds (neon glow and pulse animations vary frame-to-frame).
5. **`mobile.html` smoke test** in CI: E2E-09 as a separate CI job.

**Deliverable:** Complete test suite. ~170 total tests (110 unit + 25 integration + 35 E2E).

### Phase Summary

| Phase | Effort | Tests | Depends on | Key deliverable |
|-------|--------|-------|------------|-----------------|
| A: Foundation | S | ~5 (ported) | Nothing | Tooling works, CI integrated |
| B: Core P0 | L | ~110 | A | All critical game logic tested |
| C: Integration | M | ~25 | B | System boundaries verified |
| D: Mobile | M | ~30 | A | Touch, viewport, lifecycle, audio covered |
| E: Expansion | M | ~30 | B-D | Full coverage, E2E scenarios, optional visual |
| **Total** | | **~200** | | |
