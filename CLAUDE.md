# CLAUDE.md - Drift Arrow

## Project Overview

Drift Arrow is a neon synthwave endless drifting browser game. The player controls an arrow through a procedurally generated track, collecting time tokens, avoiding hazards, and surviving as long as possible. Game logic is split into modular JS files under `js/`, with a build script that merges them into a single `dist/mobile.html` for zero-dependency mobile deployment.

## Repository Structure
/
├── index.html              # Game shell — loads JS modules via  tags
├── dev.html                # Dev tuner — game embedded + overlay panel
├── js/
│   ├── config.js           # CFG parameters + URL hash override logic
│   ├── utils.js            # lerp, clamp, dist, noise, angle helpers
│   ├── track.js            # Procedural track generation (Track class)
│   ├── arrow.js            # Player controller (Arrow class)
│   ├── particles.js        # Particle effects (Particles class)
│   ├── tokens.js           # Time tokens (TimeTokenManager) + HAZARD enum + CFG defaults
│   ├── hazards.js          # Road hazards (HazardManager class)
│   ├── input.js            # Keyboard/mouse/touch input (InputManager class)
│   ├── audio.js            # Synthesized audio (GameAudio class)
│   ├── renderer.js         # Canvas 2D rendering (GameRenderer class)
│   ├── game.js             # Main loop + state machine (Game class + STATE enum)
│   └── bootstrap.js        # Canvas init, exposes CFG, starts Game
├── dist/
│   └── mobile.html         # Single-file build (auto-generated, works offline)
├── docs/
│   ├── README.md           # Documentation index with links to all docs
│   ├── survey.md           # Repository survey (tech stack, file catalog)
│   ├── behavior/           # Runtime behavior analysis (8 files by system)
│   ├── risk/               # Risk & complexity analysis (6 files by category)
│   └── testing/            # Testing plan (~245 specs, 18 files by system/type)
├── tests/
│   ├── collision-tests.html  # Collision/geometry tests (imports js/ modules)
│   └── camera-tests.html    # Camera zoom, positioning & look-ahead tests
├── scripts/
│   ├── sync-dev.py         # Concatenates js/.js into dev.html with patches
│   └── build-mobile.py     # Merges js/.js into single dist/mobile.html
├── .github/workflows/
│   └── ci.yml              # CI: all test suites + file validation
├── README.md               # Player-facing documentation
└── CLAUDE.md               # This file
There is no build system, no package manager, no bundler. The game runs by opening `index.html` via a local server (needed for `<script src>` loading), or by opening `dist/mobile.html` directly in a browser (works with `file://`).

## Architecture

Game code lives in 12 JS files under `js/`, loaded by `index.html` in order via `<script>` tags. All files share the global scope (`'use strict'` mode per file).

| File | Contents |
|------|----------|
| `config.js` | `CFG` object — tunable game parameters (mutated directly by dev.html) |
| `utils.js` | `lerp`, `clamp`, `dist`, `distPointToSeg`, `distToArrowWings`, `valueNoise`, `normalizeAngle`, `angleDiff` |
| `track.js` | `Track` class — procedural track generation via agent-based steering with 6 behavioral forces (wander, rhythm, events, avoidance, centering, offset). Generates new segments ahead, trims old ones behind, maintains a single `backWall` barrier at the cut point |
| `arrow.js` | `Arrow` class — drift physics, steering velocity, speed multipliers, wall collision, drift trails. `update(inputDir, dt60, braking, maxSpeed, boostActive)` — `maxSpeed` caps recovery (used by hazard slow), `boostActive` halves grip for extra sliding |
| `particles.js` | `Particles` class — visual particle effect system |
| `tokens.js` | `TimeTokenManager` class + `HAZARD` enum + runtime CFG defaults for hazard/token tuning |
| `hazards.js` | `HazardManager` class — spawns slow/speed/death tokens. `getSpeedMult()` returns the active multiplier (0.55 slow, 1.35 speed, 1 neutral) |
| `input.js` | `InputManager` class — keyboard, mouse, and touch input |
| `audio.js` | `GameAudio` class — synthesized audio via Web Audio API (no audio files) |
| `renderer.js` | `GameRenderer` class — Canvas 2D rendering: track, arrow, particles, HUD, glow effects |
| `game.js` | `Game` class + `STATE` enum — main game loop, state machine (MENU / COUNTDOWN / PLAYING / GAME_OVER), physics integration |
| `bootstrap.js` | Creates canvas, exposes `CFG` on `window`, instantiates and starts `Game` |

## Configuration System

Game parameters are defined in the `CFG` object in `js/config.js`. In `index.html` the object supports URL hash overrides. In `dev.html` the same object is patched at load time with any saved `localStorage` values, and the dev panel mutates it directly on Apply.

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
Open `index.html` via a local server (`npx serve .`, Python `http.server`, etc.) or open `dist/mobile.html` directly in any browser.

### Tuning Parameters
Open `dev.html`. The game runs full-screen; the dev panel is a fixed overlay:
- **Desktop**: slides in from the left edge — click **DEV ▶** to open
- **Mobile**: slides up from the bottom — tap **DEV ▶** to open; use ▲/▼ buttons to scroll the param list

Hit **Apply + Restart** to write slider values into `CFG` and restart the game. Settings persist to `localStorage`.

### Making Changes
Edit the JS files in `js/`. Refresh the browser to see changes.

After committing:
- **Pre-commit hook** runs `scripts/sync-dev.py` to update `dev.html` from `js/*.js` and stages it
- **Post-commit hook** runs `scripts/build-mobile.py` to regenerate `dist/mobile.html`

To run manually without committing:
python3 scripts/sync-dev.py
python3 scripts/build-mobile.py
### How sync-dev.py Works
It reads all JS files from `js/` in load order, concatenates them, applies four patches, and replaces the content between marker comments in `dev.html`:

1. Strips the URL-hash CFG init → plain `const CFG = { … }`
2. Injects a `localStorage` overlay after the CFG closing `};`
3. Adds `this.stopped` / `stop()` to `Game` so old loops can be killed on restart
4. Replaces the one-shot bootstrap with a restartable `_startGame()` helper

The markers in `dev.html` that delimit the game code section:
// === GAME CODE BEGIN (auto-synced from index.html) ===
// === GAME CODE END ===
### How build-mobile.py Works
It reads `index.html` for the HTML shell, reads all `js/*.js` files in order, strips per-file `'use strict'` directives, and combines everything into a single `dist/mobile.html` with one inline `<script>` block. This file has zero external dependencies and works with `file://`.

### Running Tests
Tests are in `tests/`. Each test file is a standalone HTML page that imports the needed `js/*.js` modules and runs assertions in-browser. CI runs them all headlessly via Puppeteer.

- `collision-tests.html` — collision geometry, token collection, hazard detection, wall hits
- `camera-tests.html` — camera zoom, directional positioning, look-ahead, curvature offset, lerp speed, start snap

Additional test suites: `utils-tests.html`, `arrow-tests.html`, `hazard-tests.html`, `track-tests.html`, `token-tests.html`, `game-state-tests.html`.

## Key Conventions

### Code Style
- Vanilla JavaScript ES6+ (classes, const/let, arrow functions, template literals)
- No TypeScript, no transpilation
- `'use strict'` mode per file
- Section headers use `// ============` comment blocks
- One class per file, files named after their primary export
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

1. **Read index files first, not entire directories.** This repo has detailed index files that map every file and its purpose. Before reading source files, consult the relevant index to find exactly which file and which section you need — then read only those specific lines with offset/limit. This saves significant context space.
   - **This file (`CLAUDE.md`)** — start here. The Architecture table and Repository Structure tree tell you which `js/*.js` file owns each system.
   - **`docs/README.md`** — index of all documentation. Links to behavior analysis, risk analysis, and testing specs by system. Read a specific doc only when you need deep detail on that system.
   - **`docs/testing/README.md`** — index of all test spec files. Find the right `unit-tests-*.md` for the system you're working on instead of reading all test files.
   - **`js/config.js`** — all tunable parameters with their defaults. Read this before changing game feel.
   - **`index.html`** — the `<script>` tag order shows the full dependency chain.

   **Anti-pattern:** Do not read every `js/*.js` file to understand the codebase. Read the Architecture table above, identify the 1–2 files relevant to your task, then read only those files (or specific line ranges within them).

2. **Modular JS files**: Game code lives in `js/*.js`. Each file is one logical unit (one class or set of related functions). Files share the global scope and are loaded in dependency order by `index.html`.

2. **dist/mobile.html is auto-generated**: Never edit `dist/mobile.html` directly — it is rebuilt by `scripts/build-mobile.py` on every commit via the post-commit hook.

3. **Sync dev.html after editing JS files**: Run `python3 scripts/sync-dev.py` or just commit — the pre-commit hook does it automatically.

4. **No build step for development**: Changes to `js/*.js` take effect immediately on browser refresh (when using a local server).

5. **Tests exist**: Run `tests/collision-tests.html` in a browser or via CI. Tests import game modules directly — keep test values in sync with `js/config.js`.

6. **Performance matters**: This is a 60fps game loop. Avoid allocations in hot paths (`update` and `render` methods). Reuse objects where possible.

7. **Mobile-first**: Touch input is the primary control method. Always verify changes work on mobile viewports. Use `dist/mobile.html` for testing on actual devices.

8. **Config changes**: Prefer adjusting `CFG` values over changing physics code when tuning game feel.

9. **Track generation**: The `Track` class generates segments on-the-fly using agent steering. Small changes to the agent forces or noise parameters can dramatically alter track shape — test thoroughly. Do not change `agentWanderPhase` / `agentRhythmPhase` init without ensuring they remain randomised.

10. **Hazard speed system**: `Arrow.update()` takes `maxSpeed` and `boostActive` from the active hazard multiplier. Any new speed effects must go through this interface to interact correctly with drift recovery.

11. **backWall**: There is only one rear barrier — `track.backWall`. It is set at game start (first spine segment) and updated as segments are trimmed. Do not reintroduce a separate `startWall`.

12. **Script load order matters**: `index.html` loads JS files in a specific order (config → utils → track → arrow → particles → tokens → hazards → input → audio → renderer → game → bootstrap). New files must be added to this order in `index.html`, `scripts/sync-dev.py`, and `scripts/build-mobile.py`.
