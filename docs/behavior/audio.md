# Runtime Behavior — Audio

### AudioContext initialization (`audio.js:7-12`)

```js
init() {
    try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { this.ctx = null; }
}
```

- `init()` is called in `startGame()` (game.js:38), which runs on the first tap from MENU.
- This satisfies the **mobile autoplay policy** — AudioContext is created inside a user-gesture event handler.
- `_ensure()` (line 13-17): Fallback — if ctx is null, tries `init()` again. If ctx is suspended, calls `ctx.resume()`. Returns boolean success.
- The `webkitAudioContext` fallback handles older Safari versions.

### Sound loading strategy

**No loading** — all sounds are **synthesized at runtime** via oscillators and gain envelopes. Zero audio assets. Every sound is created, played, and disposed per-invocation.

### Sound effects

| Method | Trigger | Sound design |
|--------|---------|-------------|
| `wallHit()` (line 18) | Wall collision, death hazard, back wall | Sawtooth 250→80Hz sweep, 0.15s, gain 0.2→0 |
| `startDrift()` (line 32) | Drift amount > 0.1 | Two oscillators (sine 85Hz + triangle 127Hz) through lowpass filter. Continuous hum. |
| `updateDrift(amount)` (line 63) | Each frame while drifting | Modulates filter frequency (200-800Hz) and gain (0.03-0.09) based on drift intensity |
| `stopDrift()` (line 74) | Drift amount ≤ 0.1 | Fades gain to 0 over 100ms, then stops oscillators via setTimeout(300ms) |
| `tokenCollect()` (line 83) | Time token collected | Random pentatonic note (C5-C6), two sine oscillators (fundamental + fifth), 0.5s decay |

### Music

There is **no background music**. Only sound effects.

### Drift sound lifecycle issue

`stopDrift()` (line 79) uses `setTimeout(cleanup, 300)` to stop oscillators after fade-out. The `_driftNode` reference is set to null immediately (line 81), but the oscillators continue playing (at near-zero gain) for 300ms. If `startDrift()` is called within that 300ms window, a new drift node is created while old oscillators haven't stopped yet. This is functionally fine (the old ones are at zero gain) but creates orphaned Web Audio nodes that won't be garbage collected until they stop.
