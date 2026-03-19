# Runtime Behavior — Data and Persistence

### Hardcoded vs. configurable

**All gameplay parameters** are in the `CFG` object (`config.js`), making them tunable via:
1. Direct code edit
2. URL hash overrides: `index.html#{"ARROW_SPEED":5}` (config.js:8-12)
3. dev.html slider panel (writes to CFG directly + localStorage)

**Hardcoded values** that are NOT in CFG:
- Countdown duration: 90 frames (game.js:84)
- Game over delay: 60 frames (game.js:94)
- Camera look-ahead: 80px base (game.js:305)
- Camera lerp speeds: 0.04 / 0.07 (game.js:310)
- Backward detection threshold: 3 segments (game.js:229)
- Backward brake ramp time: 60 frames (game.js:232)
- Drift trail lifetime: 40 frames (arrow.js:163)
- Particle drag: 0.96 (particles.js:31)
- Drift color blend rate: 0.08 (arrow.js:139)
- All audio frequencies, durations, and gain values
- Hazard type probabilities: 35% slow, 35% speed, 30% death (hazards.js:32-35)
- Initial track generation count: LOOK_AHEAD + LOOK_BEHIND + 20 segments (track.js:50)

### localStorage usage

| Key | Read | Write | Content |
|-----|------|-------|---------|
| `'driftArrowHigh2'` | Game constructor (game.js:20) | `die()` if new high (game.js:102) | Integer string — high score in meters |
| `'driftArrowDevConfig'` | dev.html on load (via sync-dev.py patch) | dev.html "Apply" button | JSON object of CFG overrides |

**No IndexedDB, no cookies, no sessionStorage.**

### Save format

High score is stored as a plain integer string: `String(this.highScore)`. Parsed via `parseInt(... || '0', 10)`. No versioning, no validation beyond `parseInt` fallback to 0.

### Default values and valid ranges

All defaults are in `config.js:14-65` and `tokens.js:10-21`. There are no explicit range validators — CFG values are used directly in math. Invalid values (e.g., negative TRACK_WIDTH) would cause visual/physics glitches but not crashes.

The `tokens.js` defaults use a guard pattern:
```js
if (!CFG.HAZARD_RADIUS) CFG.HAZARD_RADIUS = 10;
```

**Potential issue:** This guard uses falsy check, not `=== undefined`. A value of `0` would be treated as "not set" and overwritten with the default. Setting `HAZARD_RADIUS: 0` via URL hash would be silently corrected to 10.
