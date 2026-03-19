# Risk & Complexity — Mobile-Specific Risks

### 3.1 Touch Input Edge Cases

**Simultaneous touches — both sides = brake (works correctly):**
`input.js:62-69` — `_handleTouches()` iterates `e.touches` (all current touches). One finger left + one finger right → both `leftDown` and `rightDown` set → `getDir()` returns 0, `isBraking()` returns true. This is correct.

**Touch near screen edge:**
No dead zones. A touch at x=0 is "left" and a touch at x=screenWidth is "right". On devices with edge gestures (swipe from edge for back navigation), the browser may intercept touches at the very edge before they reach the canvas, causing missed inputs. The `touch-action: none` CSS only prevents scrolling/zooming — it does not prevent browser navigation gestures.

**Touch-and-drag vs. tap disambiguation:**
`_handleTouches` is called on `touchstart`, `touchmove`, and `touchend`. There is no distinction between a tap and a hold — both set `leftDown`/`rightDown`. Dragging a finger from left to right mid-touch will switch from left-steer to right-steer, which is intentional for this game. However, `anyTap` is only set on `touchstart` (line 17), not on `touchend`. This means a finger already on screen from a previous frame won't re-trigger `consumeTap()` for menu transitions — the user must lift and re-touch.

**Touch target sizing:**
The entire screen is split at the midpoint (`canvas.width / 2`). On narrow phones in portrait, each "button" is ~180px wide — adequate. On wide tablets in landscape, each half is ~500px+. No minimum size concern. However, the split point uses `this.canvas.width` (backing store pixels) vs. `touches[i].clientX` (CSS pixels). As noted in repo-behavior.md, this only works because no DPR scaling is applied. **If DPR scaling were ever added to the renderer, touch input would break** — the midpoint would be at 2× the visual center.

**Three or more simultaneous touches:**
The `_handleTouches` loop processes all touches. Three touches (e.g., left + right + stray) would set both left and right → brake. A third touch cannot cause unexpected behavior because the state is binary (left/right flags). However, `touchcancel` (line 28-31) clears both flags without checking remaining touches, which could briefly drop input if one of multiple touches is cancelled.

### 3.2 Screen / Viewport

**Aspect ratio variation:**
Canvas is always `window.innerWidth × window.innerHeight` (renderer.js:13-14). All rendering uses pixel coordinates. HUD elements are positioned relative to edges (distance at x=15, timer at canvasW-15). Menu text is centered at `canvasW/2, canvasH/2`. These adapt naturally to any aspect ratio.

**However:** The camera look-ahead is a fixed 80px (game.js:305). On very tall portrait screens, the arrow is near the bottom with lots of empty space ahead. On very wide landscape screens, the track fills less of the viewport vertically. No aspect-ratio-dependent camera scaling exists.

**Orientation change mid-game:**
`window.addEventListener('resize', () => this.renderer.resize())` (game.js:34). The resize handler sets canvas dimensions to the new `innerWidth/innerHeight`. The game loop continues uninterrupted. However:
- Canvas resizing clears all canvas state (transforms, styles, etc.) — the next `render()` call redraws from scratch, so this is fine.
- Camera position (`camX`, `camY`) is in world coordinates and unaffected by resize.
- Touch midpoint (`canvas.width / 2`) updates immediately since `_handleTouches` reads `this.canvas.width` each time.
- **No orientation lock.** The game doesn't call `screen.orientation.lock()`. Rotation is possible at any time. No prompt to rotate.

**Notch / safe area:**
The viewport meta tag does not include `viewport-fit=cover`. On notched devices, the canvas may not extend behind the notch. HUD elements at x=15 and canvasW-15 have no safe-area-inset padding. On iPhone with notch in landscape, the timer (top-right) could be obscured. The `apple-mobile-web-app-capable: yes` meta may cause full-screen mode on iOS which can differ in safe area handling.

**Resize during gameplay:**
No debounce on resize. Rapid resize events (e.g., drag-resizing a desktop window) trigger multiple `resize()` calls that clear and re-set canvas dimensions. Each clear wipes the canvas, but since the game redraws every frame, the visual glitch is at most one frame of a blank/partially-rendered canvas.

### 3.3 Performance

**Frame budget:**
At 60fps, the frame budget is 16.67ms. The main per-frame costs:
1. `updatePlaying()`: Two `findClosest()` calls scanning ~220 segments each = ~440 distance checks. Token/hazard collision scans (bounded arrays). Track generation (one `generateNext()` per frame at speed 3.5 = ~0.3 segments/frame average, but batched when falling behind). Agent avoidance with nested loops.
2. `render()`: Track drawing iterates ~220 segments multiple times. Neon lines are 3 draw calls each. `shadowBlur` on tokens and hazards triggers GPU compositing per element.

**`shadowBlur` is the biggest mobile GPU risk.** Each `ctx.shadowBlur = 15` call on tokens (tokens.js:101) and hazards (hazards.js:160) forces the browser to render a gaussian blur per element. With 10+ tokens and 5+ hazards visible, this is 15+ blurred draws per frame. On low-end mobile GPUs, this alone can exceed the frame budget. Desktop browsers hardware-accelerate this; mobile Safari and older Android Chrome may fall back to software rendering.

**Garbage collection pressure:**
- `particles.list` uses `splice()` per dead particle — O(n) array shift per removal, generating intermediate arrays. With burst emissions (30 particles from death at game.js:95), the GC impact of 30 individual splices in one frame is noticeable on low-end devices.
- `tokens.cullBefore()` and `hazards.cullBefore()` create new arrays via `.filter()` every frame that culling occurs.
- `arrow.driftTrail` splice in reverse loop: up to 80 splice calls per frame worst case.
- Drift trail creates 2 new objects per frame with string concatenation for color (`'rgb(' + cr + ',' + cg + ',' + cb + ')'` at arrow.js:145).

**No particle cap:** `Particles.emit()` (particles.js:9) pushes particles unconditionally. A death explosion emits 50 particles (game.js:95-96). Multiple rapid deaths (e.g., via dev.html restart) could accumulate if particles from the previous death haven't expired. In practice, the 1.5s countdown between games prevents this.

### 3.4 Audio

**Autoplay policy:**
`audio.init()` creates `AudioContext` inside `startGame()`, which is called from `input.consumeTap()` in the MENU state — inside a user gesture handler chain. This satisfies Chrome and Safari's autoplay policy. The `_ensure()` fallback (audio.js:13-17) handles the case where the context was suspended by calling `ctx.resume()`.

**AudioContext after backgrounding:**
When a mobile tab is backgrounded, most browsers suspend the AudioContext. On re-focus, `_ensure()` calls `ctx.resume()`, which should re-activate it. However:
- `_ensure()` is only called inside `wallHit()`, `startDrift()`, and `tokenCollect()`. If the user returns to the game and nothing triggers these methods immediately, the AudioContext may stay suspended. The drift sound check (game.js:190-194) runs every frame and calls `startDrift()` → `_ensure()` if drifting, but if the player isn't drifting on return, audio stays muted until the next event.
- **iOS Safari specifically:** iOS suspends AudioContext more aggressively. `ctx.resume()` must be called inside a user gesture handler, not just at any time. The `_ensure()` pattern may fail to resume on iOS if called from the game loop (not a touch event). This means after backgrounding on iOS, audio may silently stop working until the next `startGame()` call (which is inside a tap handler).

**Drift sound on iOS:**
`startDrift()` creates oscillators that play indefinitely until `stopDrift()` fades them. On iOS Safari, oscillators may be silently killed when backgrounded. On return, `_driftNode` is still non-null but the oscillators are dead. `startDrift()` checks `if (this._driftNode) return` — so it won't create new ones. **Result: drift sound permanently broken after backgrounding on iOS until a new game starts** (which resets via `stopDrift()` setting `_driftNode = null`).

### 3.5 Browser Tab Lifecycle

**Tab switch / screen off:**
- `requestAnimationFrame` stops firing when the tab is inactive. The game loop freezes.
- `this.lastTime` retains the timestamp of the last active frame. On re-focus, the first `requestAnimationFrame` callback receives a timestamp many seconds/minutes later.
- `dt = timestamp - this.lastTime` could be 5,000ms+ → `dt60 = 300+`.
- **Impact:** With dt60=300 at 60fps normalization:
  - `arrow.update()`: Arrow moves 300× normal distance in one step → teleports through walls.
  - `this.timeLeft -= dtSec`: Timer drops by 5+ seconds instantly → likely immediate death from timeout.
  - `this.countdownTimer -= dt60`: Countdown jumps by 300 → countdown completes instantly (minor, just means no countdown on return).
  - `particles.update()`: All particles instantly expire (harmless).
  - `steerVel *= Math.pow(0.85, 300)` → steerVel ≈ 0 (harmless).

**No `visibilitychange` handler:** The game does not listen for `document.visibilitychange`. It cannot pause on background, reset the timer, or handle any lifecycle event. This is the single most impactful mobile-specific risk.
