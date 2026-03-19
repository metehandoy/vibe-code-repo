# Testing Plan — Mobile-Specific Test Specifications

All tests in this section require **Playwright** with device emulation unless noted.

### 4.1 Touch Input Tests

#### Tap, hold, and release

| ID | Scenario | Device | Expected |
|----|----------|--------|----------|
| M-TCH-01 | Single tap left side | iPhone 14 (390px wide) | leftDown=true, getDir()=-1 |
| M-TCH-02 | Single tap right side | iPhone 14 | rightDown=true, getDir()=1 |
| M-TCH-03 | Tap and hold left, then release | iPhone 14 | leftDown=true during hold, leftDown=false after release |
| M-TCH-04 | Tap left then drag to right without lifting | iPhone 14 | Switches from leftDown to rightDown as touch crosses midpoint |

#### Multi-touch

| ID | Scenario | Device | Expected |
|----|----------|--------|----------|
| M-TCH-05 | Two fingers: one left, one right simultaneously | Any | leftDown=true AND rightDown=true → isBraking()=true, getDir()=0 |
| M-TCH-06 | Three fingers: two left, one right | Any | leftDown=true AND rightDown=true (brake, same as two) |
| M-TCH-07 | Release one of two fingers (brake → steer) | Any | After lifting right finger, only leftDown remains → getDir()=-1 |
| M-TCH-08 | `touchcancel` on one of two active touches | Any | Both flags cleared (input.js:29-30), brief input drop. Verify game doesn't crash. |

#### Edge-of-screen touches

| ID | Scenario | Device | Expected |
|----|----------|--------|----------|
| M-TCH-09 | Touch at x=0 (leftmost pixel) | iPhone 14 | leftDown=true (no dead zone) |
| M-TCH-10 | Touch at x=389 (rightmost pixel on 390px device) | iPhone 14 | rightDown=true |
| M-TCH-11 | Touch at exact midpoint (x=195 on 390px) | iPhone 14 | rightDown=true (clientX < 195 is left, >= is right per line 67-68) |

#### Rapid input / input during transitions

| ID | Scenario | Device | Expected |
|----|----------|--------|----------|
| M-TCH-12 | Rapid tap-release-tap (10 taps in 1 second) | Any | Each tap registers as leftDown/rightDown. No missed inputs. |
| M-TCH-13 | Tap during COUNTDOWN state | Any | Input ignored for steering (COUNTDOWN doesn't call updatePlaying). anyTap consumed but no effect. |
| M-TCH-14 | Tap during GAME_OVER before delay expires | Any | consumeTap returns true but gameOverDelay > 0 prevents transition |
| M-TCH-15 | Touch held through state transition (COUNTDOWN→PLAYING) | Any | Steering activates immediately when PLAYING starts |

### 4.2 Viewport / Scaling Tests

#### Aspect ratios

| ID | Scenario | Viewport | Expected |
|----|----------|----------|----------|
| M-VP-01 | Standard phone portrait | 390×844 (iPhone 14) | Canvas fills viewport. HUD visible. Touch midpoint at 195. |
| M-VP-02 | Standard phone landscape | 844×390 (iPhone 14 rotated) | Canvas fills viewport. Timer at x=829 visible. |
| M-VP-03 | Tall phone | 360×800 (19.5:9 Samsung) | No clipping. Track visible ahead of arrow. |
| M-VP-04 | Tablet portrait | 768×1024 (iPad) | Menu text centered correctly. Game playable. |
| M-VP-05 | Tablet landscape | 1024×768 (iPad) | Wide viewport, track doesn't fill horizontally but game works. |
| M-VP-06 | Desktop ultrawide | 2560×1080 | Game renders. Large empty space beside track is acceptable. |

#### Orientation change during gameplay

| ID | Scenario | Action | Expected |
|----|----------|--------|----------|
| M-VP-07 | Rotate portrait→landscape during PLAYING | Trigger orientation change | Canvas resizes (renderer.resize() fires). Game continues. Camera stays on arrow. Touch midpoint updates. |
| M-VP-08 | Rotate during COUNTDOWN | Trigger orientation change | Countdown continues. Canvas resizes. Number overlay re-centers. |
| M-VP-09 | Rapid rotation (back and forth) | 3 rotations in 2 seconds | No crash. At most 1-frame render glitch per rotation. |

#### Notch / safe area

| ID | Scenario | Device | Expected |
|----|----------|--------|----------|
| M-VP-10 | HUD timer in landscape with notch | iPhone 14 Pro (dynamic island) | Timer at canvasW-15 — verify not obscured. **Known issue: no safe-area padding.** |
| M-VP-11 | Menu text with notch in portrait | iPhone 14 Pro | Title text at center — should not be obscured in portrait. |

### 4.3 Performance Tests

| ID | Scenario | Measurement | Threshold |
|----|----------|-------------|-----------|
| M-PERF-01 | Steady gameplay, 60 frames | Measure frame times via performance.now() | 95th percentile < 16.67ms |
| M-PERF-02 | Death explosion (50 particles) | Frame time during emission frame | < 20ms (allow 1 frame spike) |
| M-PERF-03 | Many tokens visible (seed track for dense spawning) | Frame time with 15+ tokens rendering | < 16.67ms on desktop, track degradation on mobile |
| M-PERF-04 | Memory growth over 5 minutes of gameplay | Measure JS heap size at start and end | Growth < 2MB (no unbounded leak) |
| M-PERF-05 | `shadowBlur` impact | Compare frame times with shadowBlur=15 vs shadowBlur=0 | Measure delta on mobile WebKit emulation |

### 4.4 Lifecycle Tests

| ID | Scenario | Action | Expected |
|----|----------|--------|----------|
| M-LIFE-01 | Tab backgrounded during PLAYING for 5 seconds | Switch tab, wait 5s, return | **Current behavior:** dt60 = ~300, arrow teleports, likely dies. **Verify:** no crash, game shows GAME_OVER or continues. |
| M-LIFE-02 | Tab backgrounded during COUNTDOWN | Switch tab, wait 3s, return | Countdown completes instantly (dt60 large), game enters PLAYING. |
| M-LIFE-03 | Tab backgrounded during MENU | Switch tab, wait 10s, return | Menu still displayed. No state change. |
| M-LIFE-04 | Tab backgrounded during GAME_OVER | Switch tab, wait 5s, return | gameOverDelay expires instantly. Next tap goes to MENU. |
| M-LIFE-05 | Screen lock and unlock (mobile) | Lock screen, wait 5s, unlock | Same as tab background — rAF stops, resumes with large dt. |

### 4.5 Audio Tests

| ID | Scenario | Browser | Expected |
|----|----------|---------|----------|
| M-AUD-01 | First game start creates AudioContext | Chrome Android | AudioContext created on tap from MENU. Verify ctx.state !== 'suspended'. |
| M-AUD-02 | Drift sound plays during drift | Chrome Android | audio._driftNode is non-null while drifting. |
| M-AUD-03 | Audio resumes after tab background | Chrome Android | Background tab, return, trigger wallHit. Verify sound plays (_ensure resumes context). |
| M-AUD-04 | Audio on iOS Safari after background | WebKit (Playwright) | **Known risk:** _ensure() calls resume() from game loop, not gesture handler. Verify whether audio works after return. |
| M-AUD-05 | webkitAudioContext fallback | Older Safari emulation | Verify `window.webkitAudioContext` path works. |

### 4.6 Browser Matrix

| Browser | Version | Platform | Priority | Known Risks |
|---------|---------|----------|----------|-------------|
| Chrome | Latest | Android | P0 | Pull-to-refresh interference, no `apple-mobile-web-app-capable` |
| Safari | Latest | iOS 16+ | P0 | AudioContext resume in gesture only, `shadowBlur` perf, `localStorage` private mode |
| Firefox | Latest | Desktop | P1 | No touch events (mouse/keyboard only), no `webkitAudioContext` |
| Chrome | Latest | Desktop | P1 | Baseline reference for all behavior |
| Safari | 14.1+ | macOS | P1 | Older `webkitAudioContext` fallback path |
| Samsung Internet | Latest | Android | P2 | Chrome-based, bottom toolbar affects `innerHeight` |
| In-app WebView | Facebook/Twitter | iOS/Android | P2 | `AudioContext` may be unavailable, `localStorage` may not persist |
