# CLAUDE.md - Drift Arrow

## Project Overview

Drift Arrow is a neon synthwave endless drifting browser game. The player controls an arrow through a procedurally generated track, collecting time tokens, avoiding hazards, and surviving as long as possible. Built as a single self-contained HTML file with zero external dependencies.

## Repository Structure

```
/
├── index.html        # Complete game — all code, styles, and logic (~2000 lines)
├── dev.html          # Dev tuner — full game embedded + fixed overlay panel
├── scripts/
│   └── sync-dev.py   # Copies game code from index.html into dev.html
├── README.md         # Player-facing documentation
└── CLAUDE.md         # This file
```

There is no build system, no package manager, no bundler, and no test framework. The game runs by opening `index.html` directly in a browser (works with both `file://` and `http://`).

## Architecture (index.html)

The entire game is a single `<script>` block using `'use strict'` mode with class-based organization:

| Section | Description |
|---------|-------------|
| `CFG` | Tunable game parameters (plain object, mutated directly by dev.html) |
| Utils | `lerp`, `clamp`, `dist`, `distPointToSeg`, `distToArrowWings` helpers |
| `Track` | Procedural track generation via agent-based steering with 6 behavioral forces (wander, rhythm, events, avoidance, centering, offset). Generates new segments ahead, trims old ones behind, maintains a single `backWall` barrier at the cut point |
| `Arrow` | Player controller — drift physics, steering velocity, speed multipliers, wall collision, drift trails. `update(inputDir, dt60, braking, maxSpeed, boostActive)` — `maxSpeed` caps recovery (used by hazard slow), `boostActive` halves grip for extra sliding |
| `Particles` | Visual particle effect system |
| `TimeTokenManager` | Spawns and manages time-bonus tokens |
| `HazardManager` | Spawns slow/speed/death tokens. `getSpeedMult()` returns the active multiplier (0.55 slow, 1.35 speed, 1 neutral) |
| `InputManager` | Keyboard, mouse, and touch input |
| `GameAudio` | Synthesized audio via Web Audio API (no audio files) |
| `GameRenderer` | Canvas 2D rendering — track, arrow, particles, HUD, glow effects |
| `Game` | Main game loop, state machine (MENU / COUNTDOWN / PLAYING / GAME_OVER), physics integration |
| Bootstrap | Creates canvas, instantiates and starts `Game` |

## Configuration System

Game parameters are defined in the `CFG` object at the top of `index.html`. In `index.html` the object is a plain const — no URL hash overrides. In `dev.html` the same object is patched at load time with any saved `localStorage` values, and the dev panel mutates it directly on Apply.

Key parameter groups:
- **Arrow/Driving**: `ARROW_SPEED`, `STEER_RATE`, `STEER_MAX`, `GRIP`, `REALIGN_RATE`, `DRIFT_DRAG_EXP`, `DRIFT_DRAG_SCALE`, `ARROW_LENGTH`, `ARROW_WIDTH`
- **Braking**: `BRAKE_DECEL`, `BRAKE_MIN_SPEED`
- **Speed Recovery**: `SPEED_RECOVERY`, `SPEED_RECOVERY_RELEASE`
- **Track Shape**: `TRACK_WIDTH`, `MIN_TRACK_WIDTH`, `SEGMENT_LENGTH`, `LOOK_AHEAD`, `LOOK_BEHIND`
- **Agent Steering**: `WANDER_*`, `RHYTHM_*`, `EVENT_*`, `AVOIDANCE_*`, `CENTERING_WEIGHT`, `WIDTH_CURVATURE_COUPLING`, `WIDTH_TRANSITION_RATE`
- **Agent Physics**: `AGENT_STEER_RATE`, `AGENT_STEER_MAX`, `AGENT_GRIP`, `OFFSET_FREQUENCY`, `OFFSET_AMPLITUDE`, `AGENT_MARGIN`
- **Difficulty**: `DIFFICULTY_RAMP`, `METERS_PER_SEGMENT`
- **Timer/Tokens**: `START_TIME`, `TIME_TOKEN_VALUE`, `TOKEN_RADIUS`
- **Hazards**: `HAZARD_RADIUS`, `HAZARD_EFFECT_DUR`, `HAZARD_SLOW_MULT`, `HAZARD_SPEED_MULT`

## Development Workflow

### Running the Game
Open `index.html` in any modern browser. No server required.

### Tuning Parameters
Open `dev.html`. The game runs full-screen; the dev panel is a fixed overlay:
- **Desktop**: slides in from the left edge — click **DEV ▶** to open
- **Mobile**: slides up from the bottom — tap **DEV ▶** to open; use ▲/▼ buttons to scroll the param list

Hit **Apply + Restart** to write slider values into `CFG` and restart the game. Settings persist to `localStorage`.

### Making Changes to index.html
All game logic lives in `index.html`. Edit it, refresh the browser.

After committing, `dev.html` is kept in sync automatically — a **pre-commit hook** (`.git/hooks/pre-commit`) runs `scripts/sync-dev.py` whenever `index.html` is staged, updates `dev.html`, and stages it into the same commit.

To sync manually without committing:
```
python3 scripts/sync-dev.py
```

### How sync-dev.py Works
It extracts the `<script>` block from `index.html`, applies four patches, and replaces the content between marker comments in `dev.html`:

1. Strips the URL-hash CFG init → plain `const CFG = { … }`
2. Injects a `localStorage` overlay after the CFG closing `};`
3. Adds `this.stopped` / `stop()` to `Game` so old loops can be killed on restart
4. Replaces the one-shot bootstrap with a restartable `_startGame()` helper

The markers in `dev.html` that delimit the game code section:
```
// === GAME CODE BEGIN (auto-synced from index.html) ===
// === GAME CODE END ===
```

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
- Drift mechanics: arrow velocity direction lags behind heading angle based on `GRIP`
- Speed multiplier system: `Arrow.speedMult` is capped by the hazard `maxSpeed` argument so slow tokens prevent full recovery; boost tokens pass `boostActive=true` which halves `GRIP` for extra sliding
- Wall collision uses point-to-line-segment distance checks
- Track segments are generated procedurally ahead of the player and trimmed behind; `track.backWall` marks the trimming cut-point and doubles as the starting barrier

### Track Generation
- Agent-based: a simulated "agent" steers itself using weighted behavioral forces (wander noise, rhythm oscillation, event impulses, self-avoidance, centering)
- `agentWanderPhase` and `agentRhythmPhase` are randomised on each `init()` so every run produces a different path
- Track width ramps from `2×MIN_TRACK_WIDTH` down to `MIN_TRACK_WIDTH` over the first ~500 segments so the early game starts wide
- The actual road is offset from the agent path by a slow sine wave (`OFFSET_FREQUENCY`, `OFFSET_AMPLITUDE`)

### Input
- Three input modes: touch (primary/mobile), keyboard, mouse
- Left/right steering only — no explicit forward/back movement
- Brake via spacebar, down-arrow, or holding both touch sides

### Audio
- All sounds are synthesized at runtime via Web Audio API
- No audio files — oscillators and gain envelopes create all effects
- Audio context created on first user interaction (browser autoplay policy)

## Important Notes for AI Assistants

1. **Single-file architecture**: All game code is in `index.html`. Do not create separate `.js` files unless explicitly asked — the monolithic design is intentional for zero-dependency deployment.

2. **Sync dev.html after editing index.html**: Run `python3 scripts/sync-dev.py` or just commit with `index.html` staged — the pre-commit hook does it automatically.

3. **No build step**: Changes to `index.html` take effect immediately on browser refresh.

4. **No tests**: Verify changes by playing the game in a browser. Use `dev.html` for parameter tuning.

5. **Performance matters**: This is a 60fps game loop. Avoid allocations in hot paths (`update` and `render` methods). Reuse objects where possible.

6. **Mobile-first**: Touch input is the primary control method. Always verify changes work on mobile viewports.

7. **Config changes**: Prefer adjusting `CFG` values over changing physics code when tuning game feel.

8. **Track generation**: The `Track` class generates segments on-the-fly using agent steering. Small changes to the agent forces or noise parameters can dramatically alter track shape — test thoroughly. Do not change `agentWanderPhase` / `agentRhythmPhase` init without ensuring they remain randomised.

9. **Hazard speed system**: `Arrow.update()` takes `maxSpeed` and `boostActive` from the active hazard multiplier. Any new speed effects must go through this interface to interact correctly with drift recovery.

10. **backWall**: There is only one rear barrier — `track.backWall`. It is set at game start (first spine segment) and updated as segments are trimmed. Do not reintroduce a separate `startWall`.
