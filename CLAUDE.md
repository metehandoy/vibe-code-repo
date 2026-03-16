# CLAUDE.md - Drift Arrow

## Project Overview

Drift Arrow is a neon synthwave endless drifting browser game. The player controls an arrow through a procedurally generated track, collecting time tokens, avoiding hazards, and building combos. Built as a single self-contained HTML file with zero external dependencies.

## Repository Structure

```
/
├── index.html   # Complete game (1966 lines) — all code, styles, and logic
├── dev.html     # Development parameter tuner — iframe + live config editor
├── README.md    # Player-facing documentation
└── CLAUDE.md    # This file
```

There is no build system, no package manager, no bundler, no CI/CD, and no test framework. The game runs by opening `index.html` directly in a browser (works with both `file://` and `http://`).

## Architecture (index.html)

The entire game is a single `<script>` block using `'use strict'` mode with class-based organization:

| Lines | Section | Description |
|-------|---------|-------------|
| 24-60 | `CFG` (Config) | 24 tunable game parameters with URL hash override support |
| 62-75 | Utils | `lerp`, `clamp`, `dist`, `distPointToSeg` helper functions |
| 77-455 | `Track` class | Procedural track generation with 6 pattern types (STRAIGHT, CURVE, CHICANE, HAIRPIN, SPIRAL, SLALOM), overlap avoidance, width variation |
| 457-595 | `Arrow` class | Player controller — drift physics, steering, speed multipliers, wall collision, drift trails |
| 597-662 | `Particles` class | Visual particle effect system |
| 644-762 | `TimeTokenManager` | Spawns and manages time-bonus tokens along the track |
| 763-945 | `HazardManager` | Spawns and manages obstacles that slow the player |
| 946-1037 | `InputManager` | Keyboard, mouse, and touch input handling |
| 1039-1157 | `GameAudio` | Synthesized audio via Web Audio API (no audio files) |
| 1159-1540 | `GameRenderer` | Canvas 2D rendering — track, arrow, particles, UI, glow effects |
| 1538-1954 | `Game` class | Main game loop, state machine (menu/playing/dead), physics integration |
| 1955-1966 | Bootstrap | Canvas initialization and game start |

## Configuration System

Game parameters are defined in the `CFG` object (lines 24-60 of `index.html`). Override priority:

1. URL hash JSON (`#{"ARROW_SPEED":4}`) — highest priority
2. `window.__DRIFT_CFG` global — for programmatic override
3. Hardcoded defaults in `index.html`

Key parameter groups:
- **Arrow/Driving**: `ARROW_SPEED`, `STEER_RATE`, `STEER_MAX`, `GRIP`, `REALIGN_RATE`, `DRIFT_DRAG_EXP`, `DRIFT_DRAG_SCALE`, `ARROW_LENGTH`, `ARROW_WIDTH`
- **Braking**: `BRAKE_DECEL`, `BRAKE_MIN_SPEED`
- **Speed Recovery**: `SPEED_RECOVERY`, `SPEED_RECOVERY_RELEASE`
- **Track Shape**: `TRACK_WIDTH`, `MIN_TRACK_WIDTH`, `SEGMENT_LENGTH`, `LOOK_AHEAD`, `LOOK_BEHIND`
- **Difficulty**: `DIFFICULTY_RAMP`, `METERS_PER_SEGMENT`
- **Timer/Tokens**: `START_TIME`, `TIME_TOKEN_VALUE`, `TOKEN_RADIUS`

## Development Workflow

### Running the Game
Open `index.html` in any modern browser. No server required.

### Tuning Parameters
Open `dev.html` to get a side-by-side parameter editor. It:
- Loads the game in an iframe
- Provides number inputs for all `CFG` values
- Passes config via URL hash to the iframe
- Persists settings to `localStorage`

### Making Changes
- All game logic is in `index.html` — edit that single file
- `dev.html` is only for the tuning UI and rarely needs changes
- Test changes by refreshing the browser

## Key Conventions

### Code Style
- Vanilla JavaScript ES6+ (classes, const/let, arrow functions, template literals)
- No TypeScript, no transpilation
- `'use strict'` mode
- Section headers use `// ============` comment blocks
- Classes are self-contained with clear responsibilities
- No external dependencies whatsoever

### Rendering
- All rendering goes through `GameRenderer` using Canvas 2D API
- Coordinate system: world-space with camera transform centered on the arrow
- Glow effects use `ctx.shadowBlur` and `ctx.shadowColor`
- UI elements rendered in screen-space after restoring the transform

### Physics
- Fixed-step game loop via `requestAnimationFrame`
- Drift mechanics: arrow velocity lags behind heading angle based on `GRIP`
- Speed multiplier system with drift drag (`DRIFT_DRAG_EXP`, `DRIFT_DRAG_SCALE`)
- Wall collision uses point-to-line-segment distance checks
- Track segments are generated procedurally ahead of the player and trimmed behind

### Input
- Three input modes: touch (primary/mobile), keyboard, mouse
- Left/right steering only — no explicit forward/back movement by default
- Brake via spacebar or down-arrow on keyboard

### Audio
- All sounds are synthesized at runtime via Web Audio API
- No audio files — oscillators and gain envelopes create all effects
- Audio context created on first user interaction (browser autoplay policy)

## Important Notes for AI Assistants

1. **Single-file architecture**: All game code is in `index.html`. Do not create separate `.js` files unless explicitly asked — the monolithic design is intentional for zero-dependency deployment.

2. **No build step**: Changes take effect immediately on browser refresh. There is nothing to compile or bundle.

3. **No tests**: There is no test suite. Verify changes by playing the game in a browser. Use `dev.html` for parameter tuning.

4. **Performance matters**: This is a 60fps game loop. Avoid allocations in hot paths (the `update` and `render` methods). Reuse objects where possible.

5. **Mobile-first**: Touch input is the primary control method. Always test that changes work on mobile viewports and touch events.

6. **Canvas rendering**: All visuals are drawn procedurally on a `<canvas>`. There are no DOM elements for game UI — everything is painted via Canvas 2D API calls.

7. **Config changes**: When modifying game feel or balance, prefer adjusting `CFG` values over changing physics code. The config system exists specifically for tuning.

8. **Procedural generation**: Track is generated on-the-fly using patterns. The `Track` class handles overlap avoidance to prevent self-intersecting paths. Be careful modifying generation logic — small changes can cause visual glitches or impossible tracks.
