# Runtime Behavior — UI and Menus

### Screen/menu flow

```
STATE.MENU → [tap] → STATE.COUNTDOWN → [timer] → STATE.PLAYING → [death] → STATE.GAME_OVER → [tap] → STATE.MENU
```

There is **no pause screen**, no settings screen, no level select. The game has exactly these 4 screens.

### Rendering approach

**All UI is canvas-drawn** — no HTML/DOM overlays, no CSS UI elements. Every screen is rendered in `game.js:render()` using `ctx.fillText()`, `ctx.fillRect()`, etc.

| Screen | Renderer method | Key elements |
|--------|----------------|--------------|
| Menu | `renderer.drawMenu()` (renderer.js:301-340) | "DRIFT ARROW" title with neon glow, control instructions, pulsing "TAP TO START", high score |
| Countdown | Inline in `render()` (game.js:380-399) | Dark scrim, pulsing number (3, 2, 1, GO!), "GET READY" subtitle |
| Playing HUD | `renderer.drawHUD()` (renderer.js:212-292) | Distance (top-left), timer (top-right), BRAKE/SLOW indicator (center-top), hazard effect timer (center) |
| Game Over | `renderer.drawGameOver()` (renderer.js:342-377) | Dark scrim, "WRECKED"/"TIME UP", distance score, NEW RECORD flag, pulsing "TAP TO RETRY" |

### Data sources for UI

- Distance: `this.distance` (game.js:221)
- Timer: `this.timeLeft` (game.js:240)
- High score: `this.highScore` (read from localStorage in constructor)
- Speed: `this.arrow.speedMult`
- Hazard effect: `this.hazards.getActiveEffect()`
- Death cause: `this.deathCause` (set in `die()`)

### Transitions/animations

- **Menu "TAP TO START"**: Pulsing opacity via `Math.sin(Date.now() / 400)` (renderer.js:328)
- **Countdown numbers**: Pulsing scale via `Math.sin()` (game.js:382)
- **Timer warning**: Color changes at <8s (orange) and <4s (red pulsing) (renderer.js:229-252)
- **Time flash**: Green glow on timer for 30 frames after token collect (renderer.js:232-235)
- **Game over delay**: 60-frame delay before tap-to-retry is active (game.js:94, 339)
- **Game over "TAP TO RETRY"**: Same pulse animation as menu start

No smooth transitions between screens — state changes are instant (one frame).
