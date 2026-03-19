# Testing Plan — Audio (audio.js)

**Priority: P1** — Drift sound lifecycle issue identified in risk map (§3.4). iOS-specific risks require E2E, but logic tests can cover state management.

#### `GameAudio._ensure()` — `audio.js:13-17`

| ID | Given | When | Then |
|----|-------|------|------|
| U-AUD-ENS-01 | ctx=null | _ensure() | Calls init(), returns true if ctx created |
| U-AUD-ENS-02 | ctx.state='suspended' | _ensure() | Calls ctx.resume(), returns true |
| U-AUD-ENS-03 | ctx.state='running' | _ensure() | Returns true, no resume call |
| U-AUD-ENS-04 | AudioContext throws on creation | _ensure() | Returns false, ctx remains null |

#### `GameAudio.startDrift() / stopDrift()` — `audio.js:32-82`

| ID | Given | When | Then |
|----|-------|------|------|
| U-AUD-DRF-01 | _driftNode=null | startDrift() | _driftNode set, oscillators started |
| U-AUD-DRF-02 | _driftNode already set | startDrift() | Returns immediately (no duplicate) |
| U-AUD-DRF-03 | _driftNode set | stopDrift() | _driftNode=null immediately, cleanup scheduled at 300ms |
| U-AUD-DRF-04 | stopDrift() then startDrift() within 300ms | sequence | New _driftNode created (old nodes still cleaning up) |
