# Risk & Complexity — External / Browser Dependencies

### Core APIs used

| API | Used in | Vendor prefix? | Cross-browser notes |
|-----|---------|---------------|---------------------|
| **Canvas 2D** | renderer.js, tokens.js, hazards.js, particles.js, game.js | No | Universal support. `shadowBlur` performance varies heavily — slow on mobile Safari, GPU-accelerated on Chrome. |
| **requestAnimationFrame** | game.js:410, 414 | No | Universal. Throttled to display refresh rate. Stops firing when tab is inactive (all modern browsers). |
| **Web Audio API** | audio.js | `webkitAudioContext` fallback (line 10) | Safari required `webkitAudioContext` until Safari 14.1 (2021). The fallback handles this. |
| **AudioContext.resume()** | audio.js:16 | No | Required for autoplay policy. Chrome auto-suspends on creation; Safari requires explicit user gesture for resume. |
| **Touch Events** | input.js:15-31 | No | Not supported on Firefox desktop (no touch screen). Fine on all mobile browsers. |
| **localStorage** | game.js:21,106; config.js; dev.html | No | Available everywhere. May throw in private browsing mode on older Safari. **Fixed** — Game constructor now wraps `localStorage` access in try-catch, defaulting to 0. |
| **window.innerWidth/Height** | renderer.js:13-14 | No | Universal. Returns CSS pixels. On iOS Safari, may change when the URL bar hides/shows — triggers resize. |
| **Date.now()** | renderer.js:238,328,371; tokens.js:79; hazards.js:115 | No | Universal. Used for UI pulse animations. |
| **JSON.parse** | config.js:10 | No | Used for URL hash config parsing. Wrapped in try/catch. |

### Vendor-prefixed features

| Property | Used in | Status |
|----------|---------|--------|
| `-webkit-touch-callout: none` | index.html:14 | Safari-only CSS. Prevents callout menu on long-press. No equivalent for other browsers (not needed). |
| `-webkit-user-select: none` | index.html:14 | Superseded by unprefixed `user-select: none` (also present). The prefixed version handles older Safari/Chrome. |
| `webkitAudioContext` | audio.js:10 | Fallback for Safari < 14.1. Modern Safari uses unprefixed `AudioContext`. |

### Browser-specific behavioral risks

**iOS Safari:**
- `AudioContext.resume()` must be inside a user gesture handler. The `_ensure()` pattern calling `resume()` from the game loop (not a touch handler) may silently fail. Drift sound may break after backgrounding.
- `setTimeout` throttled to 1-second minimum in backgrounded tabs (iOS 15+). The 300ms drift cleanup in `stopDrift()` may be delayed.
- Canvas `shadowBlur` is software-rendered on older iOS devices. Heavy glow usage (tokens, hazards) will drop frames.
- `localStorage` throws `QuotaExceededError` in private browsing mode on Safari < 14. **Fixed** — the Game constructor now wraps localStorage access in try-catch.

**Samsung Internet:**
- Generally follows Chrome behavior. No known specific risks for this codebase.
- May have slightly different `innerWidth`/`innerHeight` behavior with its bottom toolbar.

**Firefox (desktop):**
- No touch events — only mouse and keyboard. All mouse handlers are bound, so this works.
- `AudioContext` not prefixed. Works without the `webkit` fallback.

**Chrome Android:**
- Full-screen mode via `apple-mobile-web-app-capable` meta tag is **ignored** — this is an Apple-only feature. Chrome uses `manifest.json` + `display: standalone` for PWA full-screen, which is not present.
- Pull-to-refresh may intercept downward touches. The `touch-action: none` CSS should prevent this, but `overscroll-behavior: none` would be more robust.

**WebView (in-app browsers):**
- Some in-app WebViews (e.g., Facebook, Twitter) have restricted APIs. `AudioContext` may not be available. The `try/catch` in `audio.init()` handles this gracefully (sets `ctx = null`).
- `localStorage` may not persist between WebView sessions.

### Missing modern mobile CSS

| Feature | Risk | Recommendation |
|---------|------|----------------|
| `viewport-fit=cover` | Notched devices may not use full screen | Add to viewport meta |
| `env(safe-area-inset-*)` | HUD elements may be obscured by notch | Add padding to HUD positioning |
| `overscroll-behavior: none` | Pull-to-refresh may interfere on Chrome Android | Add to body CSS |
| `screen.orientation.lock('portrait')` | Rotation disrupts gameplay | Consider locking or handling gracefully |
