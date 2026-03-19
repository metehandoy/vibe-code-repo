# Risk & Complexity — Integration Boundaries

### Boundary 1: Game → Arrow (Tight coupling)

`game.js:179` → `arrow.update(dir, dt60, braking, hazardMult, hazardMult > 1)`

Game reads `input.getDir()` and `input.isBraking()`, then reads `hazards.getSpeedMult()`, and passes all four values into Arrow. Game also directly mutates `arrow.speedMult` in three places after the update call (braking at line 183, backward detection at line 233, hazard lerp at line 278).

**Coupling: Tight.** Game reaches into arrow's internal state to modify `speedMult` from three separate locations outside the update method. The arrow's `update()` also modifies `speedMult` internally (drift drag, recovery). Order of these writes matters.

### Boundary 2: Game → Track → Tokens/Hazards (Callback coupling)

`game.js:45-48` sets `track.onSegmentGenerated`, which calls `tokens.spawnOnSegment()` and `hazards.spawnOnSegment()` from inside `track.generateNext()` (track.js:253).

**Coupling: Medium.** The callback pattern is looser than direct method calls, but the callback is set once and never cleared. `track.generateNext()` is called both during `track.init()` (initial batch) and `track.update()` (incremental), so the callback fires in both contexts.

### Boundary 3: Game → Track (findClosest → collision/distance)

`game.js:108` — `checkWallCollision()` calls `track.findClosest()` to get the nearest segment, then does collision math inline.
`game.js:217` — `updatePlaying()` calls `track.findClosest()` again for distance tracking.

**Coupling: Tight.** Wall collision logic in Game directly computes perpendicular distances against track segment properties (`angle`, `width`, `x`, `y`). The collision math is in Game, not in Track. The `findClosest()` result is also used for backward detection and segment culling.

### Boundary 4: Game → Hazards → Arrow (Speed effect chain)

`game.js:178` — reads `hazards.getSpeedMult()` → passes to `arrow.update()` as `maxSpeed`.
`game.js:275-279` — reads `hazards.getSpeedMult()` again → lerps `arrow.speedMult` toward target.
`game.js:179` — passes `hazardMult > 1` as `boostActive` to arrow (halves grip).

**Coupling: Tight.** The hazard system outputs a multiplier, but Game applies it in two separate ways (cap in arrow.update AND lerp after). The same `getSpeedMult()` is called twice per frame (lines 178 and 275).

### Boundary 5: Game → Audio (Direct calls)

`game.js:38` — `audio.init()` in startGame.
`game.js:190-194` — `audio.startDrift()`/`updateDrift()`/`stopDrift()` based on arrow drift state.
`game.js:143,168` — `audio.wallHit()` on wall/back-wall death.
`game.js:252` — `audio.tokenCollect()` on token pickup.

**Coupling: Medium.** Audio calls are fire-and-forget. Audio gracefully handles missing context (`_ensure()` pattern). Game never reads audio state.

### Boundary 6: Game → Renderer (Direct method calls)

`game.js:346-405` — `render()` calls multiple renderer methods: `clear()`, `drawTrack()`, `drawArrow()`, `drawHUD()`, `drawMenu()`, `drawGameOver()`.
`game.js:359-365` — tokens, hazards, and particles render themselves via their own `render(ctx, camX, camY)`.

**Coupling: Medium.** GameRenderer receives drawing data as method parameters. But tokens/hazards/particles receive the raw `ctx` and draw directly, bypassing the renderer abstraction. The camera offset (`camX`, `camY`) is passed to everything manually.

### Boundary 7: Tokens/Hazards → Utils (distToArrowWings)

`tokens.js:64` — `distToArrowWings(t.x, t.y, arrowX, arrowY, arrowFacing)`
`hazards.js:55` — `distToArrowWings(h.x, h.y, arrowX, arrowY, arrowFacing)`

**Coupling: Loose.** Pure function call with value parameters. No shared state.

### Boundary 8: Input → Game (Polling pattern)

Game polls input each frame: `input.getDir()` (game.js:176), `input.isBraking()` (game.js:177), `input.consumeTap()` (game.js:322, 339).

**Coupling: Loose.** Input manager maintains state independently; Game reads it via clean accessor methods. No callbacks or events.

### Boundary 9: Track segment culling → Token/Hazard culling

`game.js:201-204` — when `track.minSegIdx` is truthy, calls `tokens.cullBefore()` and `hazards.cullBefore()`.

**Coupling: Medium.** Track's `minSegIdx` is set as a side effect of `track.update()`. **Fixed** — the check is now `if (this.track.minSegIdx > 0)` instead of a falsy guard.

### Boundary 10: Config (CFG) → Everything

Every file reads `CFG` directly from the global scope. `tokens.js` mutates `CFG` at load time (lines 10-21). `dev.html` mutates `CFG` via slider panel.

**Coupling: Extremely tight / global.** No indirection, no getter/setter, no validation. Any file can read any CFG property at any time. Runtime mutations take effect immediately.
