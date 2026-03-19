# Runtime Behavior Documentation

This directory contains the runtime behavior analysis for Drift Arrow, split into focused topic files from the original `docs/repo-behavior.md`.

- [Game Loop and Lifecycle](game-loop-lifecycle.md) — requestAnimationFrame loop, delta time, state machine, and full game lifecycle
- [Player and Input Systems](player-input.md) — Touch/keyboard/mouse input handling and drift physics mechanics
- [Rendering and Animation](rendering-animation.md) — Canvas 2D draw call sequence, camera, glow effects, and track generation agent
- [Combat / Core Interaction](combat-interaction.md) — Wall collision, token/hazard collection, scoring, and death conditions
- [UI and Menus](ui-menus.md) — Screen flow, canvas-drawn UI, HUD data sources, and transition animations
- [Audio](audio.md) — Web Audio API synthesis, sound effects, and AudioContext lifecycle
- [Data and Persistence](data-persistence.md) — CFG configuration system, localStorage usage, and hardcoded values
- [Cross-Cutting Concerns](cross-cutting.md) — Global state, timing dependencies, memory management, and known issues
