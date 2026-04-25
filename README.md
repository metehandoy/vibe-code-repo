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

**Mobile?** Open `dist/mobile.html` directly — it's a single self-contained file that works with `file://` and needs no server.

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

## Packaging as a Native App

`scripts/package-mobile.py` wraps `dist/mobile.html` in a Capacitor WebView shell and produces installable app files.

### Android APK

**Prerequisites** — install once:

```bash
# 1. Download Android command-line tools from:
#    https://developer.android.com/studio#command-line-tools-only
mkdir -p ~/android-sdk/cmdline-tools/latest
unzip commandlinetools-*.zip -d ~/android-sdk/cmdline-tools/latest --strip 1
export ANDROID_HOME=~/android-sdk

# 2. Install the required SDK components
$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager \
    "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```

**Build:**

```bash
python3 scripts/package-mobile.py
# → dist/drift-arrow-debug.apk
```

**Install on device via USB:**

```bash
adb install -r dist/drift-arrow-debug.apk
```

Or transfer `dist/drift-arrow-debug.apk` to your phone and open it (enable *Install unknown apps* in Settings → Security first).

For a release build (needs a signing keystore):

```bash
python3 scripts/package-mobile.py --release
```

### iOS IPA (macOS + Xcode only)

```bash
python3 scripts/package-mobile.py --ios
```

This prints the full Xcode / `xcodebuild` steps. Requires macOS with Xcode ≥ 15 and an Apple Developer account for device/distribution builds.

### Other options

```
--all     Build Android and print iOS steps
--clean   Wipe build/ before starting
```

## Dev Tool

Open `dev.html` in a browser for a live parameter tuner. The game runs
full-screen with a slide-in panel (desktop: left edge, mobile: bottom sheet)
giving sliders for every `CFG` value. Hit **Apply + Restart** to reload the
game with your changes. Settings are saved to `localStorage`.

## Project Structure
<code>
├── index.html              # Game shell — loads JS modules via  tags
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
├── dist/
│   └── mobile.html         # Single-file build (auto-generated, works offline)
├── docs/
│   ├── README.md           # Documentation index
│   ├── survey.md           # Repository survey
│   ├── behavior/           # Runtime behavior analysis (8 files)
│   ├── risk/               # Risk & complexity analysis (6 files)
│   └── testing/            # Testing plan (18 files)
├── tests/
│   ├── collision-tests.html  # Collision/geometry tests
│   └── camera-tests.html    # Camera zoom, positioning & look-ahead tests
├── scripts/
│   ├── sync-dev.py         # Syncs JS modules into dev.html
│   ├── build-mobile.py     # Merges JS modules into dist/mobile.html
│   └── package-mobile.py   # Packages dist/mobile.html as .apk / .ipa
└── .github/workflows/
    └── ci.yml              # CI: all test suites + HTML validation
</code>
