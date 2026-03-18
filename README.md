# Drift Arrow

A neon synthwave endless drifting game. Control an arrow through a procedurally generated track, collect time tokens, dodge hazards, and survive as long as possible.

## How to Play

1. Open `index.html` in a browser — no server required
2. **Tap left side** of screen to steer left, **right side** to steer right
3. Hold longer for tighter drifts
4. Collect **green tokens** to add time
5. Hit **orange tokens** for a speed boost (more sliding, faster)
6. Avoid **red tokens** — they slow you down
7. Don't hit the walls or go backwards

## Controls

| Action | Mobile | Desktop |
|--------|--------|---------|
| Steer left/right | Tap/hold left or right side | A/D or ← → arrow keys |
| Brake / drift-brake | Hold both sides | Space or ↓ |

## Features

- Procedural track generation — every run is a different path
- Difficulty ramps up over time: narrower track, more hazards
- Three hazard types: slow (red), speed boost (orange), instant death (white)
- Time token pickups extend your run
- Neon synthwave visuals with glow effects and drift trails
- Synthesized audio — no audio files
- High score persistence

## Dev Tool

Open `dev.html` in a browser for a live parameter tuner. The game runs
full-screen with a slide-in panel (desktop: left edge, mobile: bottom sheet)
giving sliders for every `CFG` value. Hit **Apply + Restart** to reload the
game with your changes. Settings are saved to `localStorage`.
