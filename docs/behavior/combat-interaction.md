# Runtime Behavior — Combat / Core Interaction

### Hit detection approach

**All collision uses circle-to-line-segment or point-to-point distance checks — no bounding boxes, no spatial partitioning.**

Three collision systems:

#### 1. Wall collision (`game.js:106-148`)
- Finds closest spine segment to arrow via `track.findClosest()` (linear scan, O(n))
- Computes perpendicular (normal) to track at that segment
- Tests **3 arrow corner points** (tip, back-left wing, back-right wing) against segment half-width
- Uses cross product (signed perpendicular distance) against the segment normal
- If any point exceeds half-width → **instant death** (wall hit)

#### 2. Back wall collision (`game.js:151-172`)
- Checks if arrow is behind the `backWall` barrier (behind = negative dot product along wall's forward direction)
- Also checks lateral distance < wall half-width
- **Instant death** if behind and within lateral bounds

#### 3. Token/hazard collection (`tokens.js:60-71`, `hazards.js:51-87`)
- Both use `distToArrowWings()` from `utils.js:18-29`
- `distToArrowWings` computes min distance from token/hazard center to the arrow's two wing edges (tip→back-left, tip→back-right line segments)
- Compared against `TOKEN_RADIUS` (10), `HAZARD_RADIUS` (10), or `DEATH_HAZARD_RADIUS` (5)
- Linear scan over all tokens/hazards each frame

### Scoring logic

- **Distance tracking** (`game.js:217-222`): Distance increases when the arrow passes new segments. `segsPassed * METERS_PER_SEGMENT` (0.03m per segment). Distance is the score.
- **High score**: `Math.floor(distance)`, stored in `localStorage` key `'driftArrowHigh2'` (game.js:99-103).

### Death conditions (checked each frame during PLAYING)

1. **Wall hit**: Arrow corner point crosses track wall boundary → `die()`
2. **Back wall hit**: Arrow moves behind the trimmed-segment barrier → `die()`
3. **Time out**: `timeLeft ≤ 0` → `die()` (game.js:241-244)
4. **Death hazard**: Collecting a DEATH-type hazard → `die()` (game.js:259-264)

### Hazard effect system (`hazards.js`)

- **Effect stack** (line 9): Integer counter. Positive = speed boost, negative = slow. Hitting a slow when boosted cancels one stack level and vice versa.
- **Effect timer** (line 10): Shared timer for all effects. Reset to `HAZARD_EFFECT_DUR` (180 frames = 3s) on each new hit. When timer expires, stack resets to 0.
- **Speed multiplier output**: `getSpeedMult()` returns `HAZARD_SLOW_MULT` (0.55), `HAZARD_SPEED_MULT` (1.35), or 1.0.
- **Applied in `updatePlaying`** (game.js:275-279): Arrow's speedMult lerps toward the hazard multiplier at rate 0.05/frame.

### Backward detection (`game.js:225-236`)

If the arrow is 3+ segments behind its peak, a progressive brake ramps up over ~1 second. Speed mult is clamped above 0.1. Prevents the player from cheating by going backward.
