# Risk & Complexity — Complexity Hotspots

Ranked by estimated complexity (branching logic, state dependencies, call depth).

### Rank 1 — `game.js: updatePlaying()` (lines 175–313)

**Estimated complexity: Very High**

The single largest function in the codebase. Orchestrates the entire per-frame game simulation in one ~140-line method with:
- 8+ conditional branches (braking, drifting, wall death, back-wall death, timeout death, hazard death, backward detection, token collect)
- 4 separate death exit paths, each requiring a state check after the call (`if (this.state !== STATE.PLAYING) return;`)
- Calls into 7 subsystems: `input`, `arrow`, `audio`, `track`, `tokens`, `hazards`, `particles`
- Reads and writes 12+ instance variables: `distance`, `timeLeft`, `lastSegPassed`, `peakSegIdx`, `backwardTimer`, `timeFlash`, `prevSpeedMult`, `speedParticleTimer`, `camX`, `camY`, `diedFromWall`, `countdownTimer`
- Order-dependent: wall collision must happen before distance tracking; hazard collision must happen before hazard speed application; camera must be last

**Risk:** Any new gameplay feature will likely need to be wired into this function, increasing its complexity further. The multiple interleaved death-check-and-return patterns make it easy to add code in the wrong place relative to a state transition.

### Rank 2 — `track.js: generateNext()` (lines 93–256)

**Estimated complexity: Very High**

The procedural track generator with 5 behavioral forces blended via weighted sum:
- 6 distinct behavioral sections, each with their own state variables
- Multi-lookahead avoidance (5 probe distances with nested loops, lines 112-152)
- Wall overlap detection with O(n) scan of recent segments (lines 74-91)
- Width computation with 5 interacting factors: curvature coupling, difficulty, breathing pulse, effective minimum ramp, and smoothing (lines 227-242)
- Agent drift physics that mirrors `Arrow.update()` but with different constants (lines 188-206)
- Segment callback invocation at the end (line 253) couples generation to spawning

**Risk:** Small parameter changes can produce drastically different track shapes. The avoidance system has nested loops that scan up to 120 segments per call. Width computation has 5 multiplicative/additive factors that interact non-linearly.

### Rank 3 — `arrow.js: update()` (lines 31–167)

**Estimated complexity: High**

The drift physics core with a complex drift-brake state machine:
- 3-way drift-brake detection logic (lines 38-58) with timer, last-direction memory, and active flag
- 7 sequential physics steps that must execute in order (steering → realign → grip → drift drag → position → recovery → trail)
- Conditional grip halving for boost (line 86)
- Conditional facing co-rotation during drift-brake (lines 91-92)
- 3-tier speed recovery rate selection (lines 113-120)
- Drift trail color blending with lazy init of `_driftColorBlend` (line 138)

**Risk:** The drift-brake state machine (`_driftBrakeActive`, `_driftBrakeTimer`, `_lastInputDir`) is the most intricate input-handling logic in the codebase. Edge cases around rapid input changes (tap-release-tap sequences) could cause unexpected drift-lock or brake behavior.

### Rank 4 — `game.js: render()` (lines 346–405)

**Estimated complexity: Medium-High**

The render orchestrator with state-dependent draw paths:
- 4 state branches (MENU early-returns; COUNTDOWN/PLAYING/GAME_OVER share track rendering)
- COUNTDOWN overlay is drawn inline (not delegated to renderer) with manual `ctx.save()/restore()`
- Tokens, hazards, and particles render themselves via their own `render()` methods on the shared ctx
- Arrow rendering is conditional on state (PLAYING or COUNTDOWN only)
- HUD is conditional on PLAYING only
- Layer ordering is implicit in call order — no z-index system

**Risk:** Adding new visual elements requires understanding the implicit layer order. The COUNTDOWN overlay being inline (not in GameRenderer) is inconsistent with other screens.

### Rank 5 — `hazards.js: checkCollision()` (lines 51–87)

**Estimated complexity: Medium**

Effect stack management with cancellation logic:
- 3 hazard types with different collision radii and outcomes
- Additive/cancellation stack: slow cancels speed (and vice versa) with timer management
- 4 distinct branches: death → return, slow (cancel speed or stack) → return, speed (cancel slow or stack) → return, miss
- Timer reset semantics: resets on every hit regardless of stack direction

**Risk:** The stack integer allows unbounded growth (e.g., hitting 5 speed tokens pushes effectStack to 5), but `getSpeedMult()` only distinguishes positive vs. negative — not magnitude. This means stacking provides no benefit beyond requiring more cancellations. Not a bug, but potentially confusing behavior.

### Rank 6 — `game.js: checkWallCollision()` (lines 106–148)

**Estimated complexity: Medium**

3-point collision with per-point perpendicular distance check:
- Depends on `track.findClosest()` finding the correct segment (fragile if track curves sharply)
- Constructs 3 arrow corner points using facing angle trigonometry
- Cross product for signed perpendicular distance
- Immediate death on any point crossing the wall boundary

**Risk:** Uses only the *single* closest segment for collision. If the arrow straddles two segments with different angles (at a sharp curve), it checks against only one — potentially missing a wall or false-triggering. The linear scan in `findClosest()` is called twice per frame (here and at line 217).

### Rank 7 — `renderer.js: drawTrack()` (lines 23–108)

**Estimated complexity: Medium**

Iterates full spine twice (wall point generation + rendering passes):
- Builds two wall-point arrays by iterating all spine segments
- 4 rendering passes: surface fill, center dashes, edge markers, neon wall lines
- Each neon line is a 3-pass glow effect (`_drawNeonLine`)
- Back wall rendering with perpendicular calculation

**Risk:** The number of draw calls scales linearly with spine length (~220 segments). Each neon line gets 3 stroke passes. Total track draw calls per frame: ~8 (surface, dashes loop, markers loop, 2 walls × 3 passes, back wall × 3 passes). On low-end mobile, the glow passes with `globalAlpha` changes are the most expensive.

### Rank 8 — `renderer.js: drawHUD()` (lines 212–292)

**Estimated complexity: Medium**

Multi-state HUD with conditional styling:
- Timer display with 3 visual modes: normal, low (<8s, orange), critical (<4s, pulsing red)
- Time flash overlay when token collected
- Brake indicator
- Speed indicator
- Hazard effect indicator with type-dependent color and countdown

**Risk:** Uses `Date.now()` for pulse animations (lines 238, 276) instead of the game's own `dt60` timer. This means HUD animations run at wall-clock time while gameplay runs at game-time. If the game were ever paused (currently it isn't), HUD animations would continue pulsing.

### Rank 9 — `audio.js: startDrift()/updateDrift()/stopDrift()` (lines 32–82)

**Estimated complexity: Medium**

Continuous audio lifecycle management:
- Guard against double-start (`if (this._driftNode) return`)
- Two oscillators + filter + gain node chain
- `updateDrift()` modulates 3 parameters each frame via `setTargetAtTime`
- `stopDrift()` sets null immediately but uses setTimeout for cleanup
- Re-entrant potential within 300ms cleanup window

**Risk:** The 300ms cleanup window in `stopDrift()` means rapid drift on/off cycling creates orphaned Web Audio nodes. Each cycle leaks 2 oscillators + 1 filter + 1 gain until the setTimeout fires. Under heavy drifting, this could accumulate.

### Rank 10 — `tokens.js: spawnOnSegment()` + `hazards.js: spawnOnSegment()` (tokens.js:37–53, hazards.js:21–44)

**Estimated complexity: Medium-Low**

Spawn logic with gap enforcement and difficulty scaling:
- Minimum segment gap (`TOKEN_MIN_GAP`, `HAZARD_MIN_GAP`) between spawns
- No-spawn zone at track start (`TOKEN_NO_SPAWN_ZONE`, `HAZARD_NO_SPAWN_ZONE`)
- Random probability check with difficulty modifier
- Random lateral offset within track width

**Risk:** Tokens and hazards are spawned independently with no cross-system coordination. A token and a hazard can spawn on the same segment at overlapping positions. No overlap check between the two systems.
