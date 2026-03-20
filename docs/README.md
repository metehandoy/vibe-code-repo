# Drift Arrow — Documentation Index

## Overview

- [**survey.md**](survey.md) — Repository survey: directory tree, tech stack, entry points, file catalog, test infrastructure, mobile configuration

## Runtime Behavior Analysis

Detailed analysis of how the game works at runtime. Split by system.

- [**game-loop-lifecycle.md**](behavior/game-loop-lifecycle.md) — Game loop mechanism, delta time handling, full lifecycle flow, pause/resume behavior
- [**player-input.md**](behavior/player-input.md) — Input handling (touch/mouse/keyboard), movement mechanics, drift physics, player state
- [**rendering-animation.md**](behavior/rendering-animation.md) — Draw call sequence, canvas scaling, camera system, glow effects, optimization notes, track generation agent
- [**combat-interaction.md**](behavior/combat-interaction.md) — Hit detection, wall/token/hazard collision, scoring, death conditions, hazard effects, backward detection
- [**ui-menus.md**](behavior/ui-menus.md) — Screen/menu flow, HUD rendering, transitions and animations
- [**audio.md**](behavior/audio.md) — AudioContext initialization, sound synthesis, drift sound lifecycle
- [**data-persistence.md**](behavior/data-persistence.md) — CFG configuration, localStorage usage, save format, default values
- [**cross-cutting.md**](behavior/cross-cutting.md) — Event systems, global state, timing dependencies, memory management, potential bugs

## Risk & Complexity Analysis

Identified risks, complexity hotspots, and fragile areas.

- [**complexity-hotspots.md**](risk/complexity-hotspots.md) — Top 10 complexity-ranked functions/systems
- [**integration-boundaries.md**](risk/integration-boundaries.md) — 10 integration boundaries with coupling analysis
- [**mobile-risks.md**](risk/mobile-risks.md) — Touch input edge cases, viewport/scaling, performance, audio, tab lifecycle
- [**fragile-areas.md**](risk/fragile-areas.md) — Floating point issues, timing-dependent logic, state inconsistencies, missing checks, math edge cases
- [**untested-surface.md**](risk/untested-surface.md) — What tests cover vs. what is NOT tested (~90% untested)
- [**browser-dependencies.md**](risk/browser-dependencies.md) — Core APIs, vendor prefixes, browser-specific risks, missing CSS

## Testing Plan

~200 test specifications organized by system and test type.

- [**strategy-overview.md**](testing/strategy-overview.md) — Framework choice (Vitest + Playwright), test pyramid, infrastructure, mocking strategy
- **Unit Test Specifications:**
  - [**unit-tests-utils.md**](testing/unit-tests-utils.md) — `utils.js` functions: lerp, clamp, distPointToSeg, distToArrowWings, normalizeAngle, angleDiff, valueNoise
  - [**unit-tests-arrow.md**](testing/unit-tests-arrow.md) — Arrow physics: steering, grip/drift, speed recovery, drift drag, drift-brake state machine, position, trail
  - [**unit-tests-hazards.md**](testing/unit-tests-hazards.md) — Hazard system: collision, effect stack, cancellation, timer, getSpeedMult, spawn, cull
  - [**unit-tests-tokens.md**](testing/unit-tests-tokens.md) — Token system: checkCollect, spawnOnSegment
  - [**unit-tests-track.md**](testing/unit-tests-track.md) — Track generation: init, width computation, runway, findClosest, update, overlap
  - [**unit-tests-game-state.md**](testing/unit-tests-game-state.md) — Game state machine: transitions, die(), startGame(), delta time, timer, backward detection, wall collision
  - [**unit-tests-input.md**](testing/unit-tests-input.md) — Input manager: getDir, isBraking, consumeTap, touch handling
  - [**unit-tests-particles.md**](testing/unit-tests-particles.md) — Particles: emit, update
  - [**unit-tests-audio.md**](testing/unit-tests-audio.md) — Audio: _ensure, startDrift/stopDrift lifecycle
  - [**unit-tests-config.md**](testing/unit-tests-config.md) — Config: CFG defaults, falsy guard (**fixed**), _formatDist
  - [**unit-tests-camera.md**](testing/unit-tests-camera.md) — Camera system: zoom, directional positioning, look-ahead, curvature offset, lerp speed, start snap
- [**integration-tests.md**](testing/integration-tests.md) — 8 integration test suites covering system boundaries
- [**mobile-tests.md**](testing/mobile-tests.md) — Touch, viewport, performance, lifecycle, audio, browser matrix tests
- [**e2e-tests.md**](testing/e2e-tests.md) — 10 end-to-end scenarios (full gameplay, wall death, tokens, hazards, stress)
- [**regression-candidates.md**](testing/regression-candidates.md) — Tier 1/2/3 regression tests for CI
- [**what-not-to-test.md**](testing/what-not-to-test.md) — Areas to skip or test lightly
- [**implementation-roadmap.md**](testing/implementation-roadmap.md) — Phased rollout plan (A through E)
