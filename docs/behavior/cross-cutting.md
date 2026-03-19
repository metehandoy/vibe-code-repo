# Runtime Behavior — Cross-Cutting Concerns

### Event/pub-sub systems

There is **no formal event system**. Communication is direct method calls between objects held by the `Game` class. The one callback-style pattern is:

- `track.onSegmentGenerated` (track.js:253, set in game.js:45-48): A function reference on the Track object, called each time a new segment is generated. Used to trigger token/hazard spawning. This is set in `startGame()` and never cleared.

### Global/shared state

| Global | Defined in | Used by |
|--------|-----------|---------|
| `CFG` | config.js:14 | Every file — read extensively, mutated by dev.html and tokens.js |
| `STATE` | game.js:6 | game.js only |
| `HAZARD` | tokens.js:7 | tokens.js, hazards.js |
| `lerp`, `clamp`, `dist`, etc. | utils.js | arrow.js, track.js, particles.js, hazards.js, game.js, renderer.js |
| `window.__DRIFT_CFG_LIVE` | bootstrap.js:7 | dev.html panel |
| `__hashCfg` | config.js:7 | config.js only (local to init) |

All files share the global scope. There are no module boundaries — any file can read/write any global. The `'use strict'` per file prevents accidental implicit globals but doesn't prevent intentional ones.

### Timing dependencies

1. **Script load order is critical.** `index.html` loads scripts in dependency order. `config.js` must load before everything (defines CFG). `utils.js` before track/arrow/particles (defines math helpers). `tokens.js` before `hazards.js` (defines HAZARD enum). `game.js` before `bootstrap.js` (defines Game class).

2. **`tokens.js` mutates `CFG` at load time** (lines 10-21). This must happen after `config.js` but before any code reads these CFG properties. Since it runs at script load (not in a constructor), the order `config.js → ... → tokens.js` in index.html is sufficient.

3. **AudioContext creation requires user gesture.** `audio.init()` is called in `startGame()`, which is triggered by a tap/click from MENU state. The `_ensure()` fallback handles the case where the context was suspended.

4. **No race conditions with asset loading** — there are no assets to load. All code is synchronous script execution.

5. **First-frame dt anomaly:** `lastTime` starts at 0, so the first frame uses the fallback `dt = 16.67ms` (game.js:316). This is correct behavior — prevents a huge initial dt.

### Memory management

**Object pooling:** None. All particles, trail points, tokens, and hazards are created with object literals (`{}`/`push()`) and removed via `splice()` or `filter()`.

**Potential leak: drift trail splice.** `arrow.driftTrail` grows by 2 entries/frame while drifting, culled at age > 40 frames. Max size is ~80 entries. The `splice(i, 1)` in a reverse loop is correct but allocates a new backing array on each splice. Not a leak, but generates GC pressure.

**Potential leak: particles.** `particles.list` uses the same pattern — `push()` to add, `splice(i, 1)` to remove. Bounded by particle lifetimes (15-40 frames) and emit counts (2-30 per burst).

**Potential leak: tokens/hazards filter.** `cullBefore()` in both `TimeTokenManager` and `HazardManager` creates a new array via `.filter()` each frame when culling occurs. The old array is discarded. This is standard JS but adds GC pressure.

**Event listener cleanup:** None. The `InputManager` constructor attaches 9 event listeners (lines 15-59) that are never removed. The `Game` constructor adds a resize listener (line 34) that is never removed. Since the game is a single-page app that runs until the tab closes, this is not a practical leak.

**Web Audio nodes:** `wallHit()` and `tokenCollect()` create oscillator+gain nodes that auto-dispose after `stop()`. `startDrift()`/`stopDrift()` manually manage a persistent node set. The `setTimeout` in `stopDrift()` could leave orphaned nodes if the page is navigated before the timeout fires, but this is trivial.

### TODO/FIXME/HACK comments

**None found.** No TODO, FIXME, HACK, XXX, or WORKAROUND comments exist anywhere in the `js/` source files.

### Potential bugs and concerns flagged

1. **No dt cap** (`game.js:316-318`): After a long tab-background period, the first frame could have dt60 >> 1, causing physics teleportation. A simple `dt60 = Math.min(dt60, 3)` cap would prevent this.

2. **Vestigial `arrow.alive`** (`arrow.js:17`): Set to true in reset(), never read or set to false. Dead code.

3. **Vestigial `arrow.wallHitTimer` rendering** (`renderer.js:179`): The renderer checks `arrow.wallHitTimer > 0` for a glow flash effect, and the arrow decrements it each frame (`arrow.js:127`), but no code ever sets it to a positive value — wall hits are instant death. This was likely from a previous non-lethal wall bounce mechanic.

4. **~~Falsy CFG guard in tokens.js~~** (lines 10-21): **Fixed** — changed from `if (!CFG.HAZARD_RADIUS)` to `if (CFG.HAZARD_RADIUS == null)`. Values can now be legitimately set to 0.

5. **~~Duplicate dead-state check~~** (`game.js:214`): **Fixed** — the redundant third `if (this.state !== STATE.PLAYING) return;` has been removed.

6. **Linear scan in `track.findClosest()`** (`track.js:287-294`): Iterates all spine segments (~220) every frame to find the closest. Called twice per frame in `updatePlaying()` (lines 207 via `checkWallCollision` and 217 directly). Could use the known `currentSegIdx` to limit the search window.

7. **`track.getSegment()` linear scan** (`track.js:279-284`): O(n) lookup by index. Not called in the hot loop, but could use binary search or offset calculation since indices are sequential.

8. **No high-DPR canvas scaling** (`renderer.js:12-15`): On retina displays, the game renders at 1× CSS pixel resolution. Text and lines may appear blurry on high-DPR screens. This is likely intentional for performance.
