# Runtime Behavior — Rendering and Animation

### Draw call sequence per frame (`game.js:346-405`)

```
render() {
  1. renderer.clear()                    — fill screen with #0a0014

  IF STATE.MENU:
    2. renderer.drawMenu()               — title text + controls
    RETURN (nothing else drawn)

  OTHERWISE (COUNTDOWN, PLAYING, GAME_OVER):
    2. renderer.drawTrack(track, camX, camY)
       a. Build left/right wall point arrays from spine
       b. Track surface fill (#120024 polygon)
       c. Center dashes (white, every 4th segment)
       d. Road edge markers (magenta left, cyan right, every 8th segment)
       e. Neon wall lines (magenta left, cyan right) via _drawNeonLine (3-pass glow)
       f. Back wall barrier (red glow line)
    3. tokens.render(ctx, camX, camY)    — green pulsing circles with "+"
    4. hazards.render(ctx, camX, camY)   — colored circles with symbols (~, >, X)
    5. particles.render(ctx, camX, camY) — alpha-faded rectangles
    6. renderer.drawArrow(arrow, ...)    — brake trail, drift trail, arrow shape with glow
       (only in PLAYING and COUNTDOWN states)

  IF STATE.PLAYING:
    7. renderer.drawHUD(...)             — distance, timer, speed indicator, hazard effect

  IF STATE.COUNTDOWN:
    7. Countdown overlay: dark scrim + pulsing number + "GET READY"

  IF STATE.GAME_OVER:
    7. renderer.drawGameOver(...)        — dark scrim + death text + score + "TAP TO RETRY"
}
```

**Layer order:** Track (background) → tokens → hazards → particles → arrow (foreground) → UI overlay (screen-space). All drawn in a single Canvas 2D context, no offscreen buffers.

### Canvas scaling (`renderer.js:12-15`)

```js
resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
}
```

The canvas backing store is set to exactly `window.innerWidth × window.innerHeight` CSS pixels. **No DPR (device pixel ratio) scaling.** On a 2× retina display, each CSS pixel maps to one canvas pixel, meaning the game renders at half the physical resolution. This is a deliberate performance trade-off — a 60fps game loop on mobile benefits from fewer pixels.

The resize listener is attached in `Game` constructor (line 34): `window.addEventListener('resize', () => this.renderer.resize())`.

### Camera system (`game.js:302-312`)

Camera follows the arrow along the **movement direction** (not facing), with adaptive look-ahead:
- `lookAheadDist = 80 * speedFactor` — look-ahead shrinks when slow/drifting
- Camera lerps toward target at 0.04 (drifting) or 0.07 (normal) per dt60-frame
- Camera is snapped (not lerped) on game start (line 78-81)

### Glow effects

The neon aesthetic uses two techniques:
1. **`_drawNeonLine`** (renderer.js:110-131): Draws each polyline 3 times with decreasing width and increasing alpha (outer glow → core). Uses `globalAlpha`, not `shadowBlur`.
2. **`shadowBlur`/`shadowColor`**: Used for arrow glow (line 178-179), token glow (tokens.js:100-102), hazard glow (hazards.js:160-161), and HUD text glow.

### Sprite/animation system

There are **no sprites, no sprite sheets, no animation frames**. All visuals are procedural:
- Arrow is a drawn polygon (lines 182-187 of renderer.js)
- Tokens are `arc()` circles with text
- Hazards are `arc()` circles with text symbols
- Particles are `fillRect()` squares
- Track is polyline walls and polygon fill

### Optimization (or lack thereof)

- **No offscreen canvas** — everything is drawn directly to the main canvas each frame.
- **No object pooling for rendering** — particles use `splice()` for removal, drift trail uses `push()`/`splice()`.
- **No culling** — all spine segments, tokens, and hazards in their respective arrays are drawn, even if off-screen. For the track this is bounded by LOOK_AHEAD + LOOK_BEHIND segments (~220), which is manageable.
- **Tokens/hazards iterate full arrays** for rendering even though `cullBefore()` keeps the arrays bounded.

---

### Note: Track Generation Agent (AI / NPC Systems)

There are **no AI-controlled NPCs** in the game.

However, the **track generation agent** (`track.js`) uses AI-like behavioral steering:

- **Agent-based procedural generation**: A simulated agent steers through space using 5 weighted behavioral forces blended into a single steering input (lines 101-186).
- **Decision model**: Weighted sum of continuous forces, not a state machine. Forces: wander (noise), rhythm (sine oscillation), event impulses (decaying curvature), avoidance (repulsion from old track), centering (restoring force toward reference angle).
- **Difficulty scaling**: `this.difficulty` ramps from 0 to 1 over time via `segmentIndex * DIFFICULTY_RAMP`. Affects rhythm amplitude (line 156), event intensity (line 164), width narrowing (line 234), and hazard/token spawn chances.
- **No spawning/despawning of the agent** — it's a single persistent generator, not an entity.
