# Drift Arrow

A neon synthwave endless drifting game. Control an arrow through a procedurally generated track, collect time tokens, dodge hazards, and survive as long as possible.

## How to Play

1. Open `index.html` in a browser (requires a local server or `http://` for JS module loading)
2. **Tap left side** of screen to steer left, **right side** to steer right
3. Hold longer for tighter drifts
4. Collect **green tokens** to add time
5. Hit **orange tokens** for a speed boost (more sliding, faster)
6. Avoid **red tokens** — they slow you down
7. Don't hit the walls or go backwards

**Mobile?** Open `mobile.html` directly — it's a single self-contained file that works with `file://` and needs no server.

## Controls

| Action | Mobile | Desktop |
|--------|--------|---------|
| Steer left/right | Tap/hold left or right side | A/D or ← → arrow keys |
| Brake / drift-brake | Hold both sides | Space or ↓ |

## Features

- Procedural track generation — every run is a different path
- Difficulty ramps up over time: narrower track, more hazards
- Three hazard types: slow (blue), speed boost (orange), instant death (red)
- Time token pickups extend your run
- Neon synthwave visuals with glow effects and drift trails
- Synthesized audio — no audio files
- High score persistence

## Dev Tool

Open `dev.html` in a browser for a live parameter tuner. The game runs
full-screen with a slide-in panel (desktop: left edge, mobile: bottom sheet)
giving sliders for every `CFG` value. Hit **Apply + Restart** to reload the
game with your changes. Settings are saved to `localStorage`.

## Project Structure
/
├── index.html              # Game shell — loads JS modules via  tags
├── mobile.html             # Single-file build (auto-generated, works offline)
├── dev.html                # Dev tuner — game embedded + overlay panel
├── js/
│   ├── config.js           # CFG parameters
│   ├── utils.js            # Math helpers + noise functions
│   ├── track.js            # Procedural track generation
│   ├── arrow.js            # Player controller + drift physics
│   ├── particles.js        # Particle effects
│   ├── tokens.js           # Time tokens + hazard constants
│   ├── hazards.js          # Road hazard manager
│   ├── input.js            # Keyboard/mouse/touch input
│   ├── audio.js            # Synthesized audio (Web Audio API)
│   ├── renderer.js         # Canvas 2D rendering
│   ├── game.js             # Main game loop + state machine
│   └── bootstrap.js        # Canvas init + game start
├── tests/
│   └── collision-tests.html  # Headless collision/geometry tests
├── scripts/
│   ├── sync-dev.py         # Syncs JS modules into dev.html
│   └── build-mobile.py     # Merges JS modules into mobile.html
└── .github/workflows/
    └── ci.yml              # CI: collision tests + HTML validation
