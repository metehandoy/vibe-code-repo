# Testing Plan — Index

This directory contains the Drift Arrow testing plan, split into individual sections for easier navigation.

## Contents

- [Strategy Overview](strategy-overview.md) - Recommended frameworks, test pyramid, infrastructure, and what can vs. cannot be unit tested
- [Integration Tests](integration-tests.md) - Integration test specifications covering system boundary interactions
- [Mobile Tests](mobile-tests.md) - Mobile-specific test specifications for touch, viewport, performance, lifecycle, and audio
- [End-to-End Tests](e2e-tests.md) - Full end-to-end test scenarios using Playwright
- [Regression Candidates](regression-candidates.md) - Regression test candidates organized by tier for CI gating
- [What NOT to Test](what-not-to-test.md) - Areas to skip or test only lightly
- [Implementation Roadmap](implementation-roadmap.md) - Phased rollout plan for the test suite

### Unit Test Specifications

- [Utility Functions (utils.js)](unit-tests-utils.md) - Unit tests for lerp, clamp, distPointToSeg, distToArrowWings, normalizeAngle, angleDiff, and valueNoise
- [Arrow Physics (arrow.js)](unit-tests-arrow.md) - Unit tests for steering, grip/drift, speed recovery, drift drag, drift-brake state machine, position, realignment, and trail
- [Hazard Effect System (hazards.js)](unit-tests-hazards.md) - Unit tests for hazard collision, effect stack, update/expiry, getSpeedMult, spawning, and culling
- [Token System (tokens.js)](unit-tests-tokens.md) - Unit tests for token collection, spawning, and gap enforcement
- [Track Generation (track.js)](unit-tests-track.md) - Unit tests for track init, width computation, runway behavior, findClosest, update, and overlap detection
- [Game State Machine (game.js)](unit-tests-game-state.md) - Unit tests for state transitions, die(), startGame(), delta time, timer, backward detection, and wall collision
- [Input Manager (input.js)](unit-tests-input.md) - Unit tests for getDir, isBraking, consumeTap, and touch handling
- [Particles (particles.js)](unit-tests-particles.md) - Unit tests for particle emission and update lifecycle
- [Audio (audio.js)](unit-tests-audio.md) - Unit tests for AudioContext ensure, drift sound start/stop lifecycle
- [Config (config.js + tokens.js)](unit-tests-config.md) - Unit tests for CFG defaults, falsy-guard bug, and _formatDist
