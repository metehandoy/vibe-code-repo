# Repository Survey — Drift Arrow

## 1. Directory Tree

```
/
├── .github/
│   └── workflows/
│       └── ci.yml
├── js/
│   ├── config.js
│   ├── utils.js
│   ├── track.js
│   ├── arrow.js
│   ├── particles.js
│   ├── tokens.js
│   ├── hazards.js
│   ├── input.js
│   ├── audio.js
│   ├── renderer.js
│   ├── game.js
│   └── bootstrap.js
├── scripts/
│   ├── build-mobile.py
│   └── sync-dev.py
├── tests/
│   └── collision-tests.html
├── index.html
├── mobile.html          (auto-generated)
├── dev.html             (auto-generated game section)
├── CLAUDE.md
└── README.md
```

**Naming conventions:** lowercase, hyphen-separated for multi-word filenames. JS files are named after their primary class or concern (one class per file). No nested subdirectories within `js/`.

## 2. Tech Stack

| Aspect | Detail |
|--------|--------|
| **Language** | Vanilla JavaScript ES6+ (classes, const/let, arrow functions, template literals) |
| **Rendering** | Canvas 2D API — no WebGL, no DOM-based rendering, no framework |
| **Module system** | Global scope via `<script>` tags in dependency order — no ES modules, no bundler |
| **Build tooling** | Two Python 3 scripts: `sync-dev.py` (pre-commit hook) and `build-mobile.py` (post-commit hook) |
| **Package manager** | None — zero `package.json`, zero `node_modules` |
| **Third-party libraries** | None whatsoever — all audio, rendering, physics, and input are hand-rolled |
| **Audio** | Web Audio API (runtime synthesis — no audio asset files) |
| **Test runner** | Custom HTML test harness run via Puppeteer in CI |
| **CI** | GitHub Actions (`ci.yml`) — headless collision tests + HTML structure validation |

## 3. Entry Points

| Entry Point | Purpose | How It Connects |
|-------------|---------|-----------------|
| **`index.html`** | Primary development shell | Loads 12 `<script>` tags from `js/` in order; requires local HTTP server |
| **`mobile.html`** | Production single-file build | All JS concatenated inline; works offline with `file://` |
| **`dev.html`** | Live parameter tuning | Embeds game + slider overlay panel; game code auto-synced from `js/` |
| **`js/bootstrap.js`** | Game kickoff script | Exposes `CFG` on `window`, creates canvas ref, instantiates `Game`, calls `game.start()` |
| **`js/game.js`** | Game loop entry | `Game.start()` → `requestAnimationFrame` loop; `STATE` enum drives state machine (MENU → COUNTDOWN → PLAYING → GAME_OVER) |

**Connection flow:** `index.html` loads scripts → `bootstrap.js` runs last → creates `new Game(canvas)` → calls `game.start()` → enters `requestAnimationFrame` loop in `game.js`.

## 4. File Catalog

| Path | Category | Brief Purpose |
|------|----------|---------------|
| `js/game.js` | Core gameplay | Main game loop, state machine (MENU/COUNTDOWN/PLAYING/GAME_OVER), physics integration, difficulty ramp |
| `js/bootstrap.js` | Core gameplay | Canvas init, exposes CFG globally, instantiates and starts Game |
| `js/arrow.js` | Player / input handling | Player arrow controller: drift physics, steering velocity, speed multipliers, wall collision response |
| `js/input.js` | Touch / mobile input handling | Keyboard (A/D, arrows, space), mouse, and touch input; drift-brake detection (150ms threshold) |
| `js/track.js` | Physics / movement / collision | Procedural track generation via agent-based steering with 6 behavioral forces; segment management; backWall barrier |
| `js/utils.js` | Utilities / helpers | `lerp`, `clamp`, `dist`, `distPointToSeg`, `distToArrowWings`, `valueNoise`, `normalizeAngle`, `angleDiff` |
| `js/tokens.js` | Combat / interaction systems | Time token spawning/collection; `HAZARD` enum (SLOW/SPEED/DEATH); runtime CFG defaults for token/hazard tuning |
| `js/hazards.js` | Combat / interaction systems | Hazard spawning (slow/speed/death); effect stack; `getSpeedMult()` returns active multiplier (0.55 / 1.35 / 1.0) |
| `js/particles.js` | Rendering / animation | Particle emission, physics (gravity/drag), wall spark effects |
| `js/renderer.js` | Rendering / animation | Canvas 2D renderer: camera transform, track walls, arrow, HUD, glow effects (shadowBlur), tokens, hazards |
| `js/audio.js` | Audio | Web Audio API synthesis: wallHit, collect, boost, slowHit sounds; autoplay-policy-safe lazy init |
| `js/config.js` | Data / config | `CFG` object with ~51 tunable parameters; URL hash override support |
| `index.html` | Core gameplay (shell) | HTML shell loading all JS modules via script tags |
| `mobile.html` | Build / CI / tooling (output) | Auto-generated single-file build for offline/mobile deployment |
| `dev.html` | UI / HUD / menus | Dev tuner: full-screen game + slide-in parameter panel with Apply + Restart |
| `tests/collision-tests.html` | Tests | Custom headless test harness: collision geometry, token collection, hazard detection, wall hits |
| `scripts/build-mobile.py` | Build / CI / tooling | Concatenates all JS into single inline script in `mobile.html` |
| `scripts/sync-dev.py` | Build / CI / tooling | Syncs `js/*.js` into `dev.html` with 4 dev-specific patches |
| `.github/workflows/ci.yml` | Build / CI / tooling | GitHub Actions: Puppeteer headless tests + HTML file validation |
| `CLAUDE.md` | Other (documentation) | Detailed project architecture, conventions, and AI-assistant instructions |
| `README.md` | Other (documentation) | Player-facing docs: controls, features, project structure |

### Category Summary

| Category | Files |
|----------|-------|
| Core gameplay | `game.js`, `bootstrap.js`, `index.html` |
| Player / input handling | `arrow.js` |
| Touch / mobile input handling | `input.js` |
| Physics / movement / collision | `track.js` |
| Combat / interaction systems | `tokens.js`, `hazards.js` |
| Rendering / animation | `renderer.js`, `particles.js` |
| Audio | `audio.js` |
| UI / HUD / menus | `dev.html` |
| Data / config | `config.js` |
| Utilities / helpers | `utils.js` |
| Tests | `tests/collision-tests.html` |
| Build / CI / tooling | `build-mobile.py`, `sync-dev.py`, `ci.yml`, `mobile.html` |
| Documentation | `CLAUDE.md`, `README.md` |
| AI / NPC behavior | None |
| Networking | None |
| Assets (sprites, sounds, data) | None — all visuals are Canvas 2D draw calls; all audio is synthesized at runtime |

## 5. Existing Test Infrastructure

| Item | Detail |
|------|--------|
| **Test file** | `tests/collision-tests.html` (~18 KB) |
| **Framework** | Custom — no Jest, Mocha, or external test library |
| **Imports** | Loads `js/config.js`, `js/utils.js`, `js/tokens.js` directly via `<script>` tags |
| **Test scope** | Collision geometry (`distPointToSeg`, `distToArrowWings`), token collection radius, hazard detection, wall-hit distance checks |
| **Execution** | Browser: open `tests/collision-tests.html` directly. CI: Puppeteer headless via `ci.yml` |
| **Pass/fail signal** | DOM element `<div class="summary">` gains class `all-pass` or `has-fail`; CI checks for `all-pass` |
| **CI pipeline** | GitHub Actions on push/PR to main/master: (1) headless Puppeteer test job, (2) HTML structure validation job |

## 6. Documentation & Architecture Comments

| Source | Content |
|--------|---------|
| **`CLAUDE.md`** | Comprehensive: full file table, architecture overview, CFG parameter groups, development workflow, build script details, code conventions, physics/rendering notes, 12 "important notes for AI assistants" |
| **`README.md`** | Player-facing: how to play, controls table, features list, dev tool usage, project structure tree |
| **Inline comments** | Section headers in JS files use `// ============` blocks. Game states documented via `STATE` enum. Build scripts have inline doc comments explaining each transformation step |

## 7. Mobile-Specific Configuration

| Feature | Present? | Detail |
|---------|----------|--------|
| **Viewport meta** | Yes | `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no` |
| **Apple web app meta** | Yes | `apple-mobile-web-app-capable: yes`, `apple-mobile-web-app-status-bar-style: black-translucent` |
| **touch-action CSS** | Yes | `touch-action: none` on `body` — prevents browser gestures |
| **User-select prevention** | Yes | `-webkit-touch-callout: none; -webkit-user-select: none; user-select: none` |
| **manifest.json / PWA** | No | No web app manifest, no service worker |
| **Orientation lock** | No | No screen orientation API usage |
| **Responsive scaling** | Yes | Canvas `width: 100%; height: 100%` with resize handling in renderer |
| **Touch input** | Yes | Primary input method; left/right screen halves for steering; both-sides hold for brake; 150ms drift-brake threshold |
| **Offline support** | Partial | `mobile.html` works with `file://` (zero dependencies) but no service worker for true PWA offline |
| **Single-file mobile build** | Yes | `mobile.html` — all JS inlined, works without server |
