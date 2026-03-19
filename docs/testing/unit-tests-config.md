# Testing Plan — Config (config.js + tokens.js)

**Priority: P1** — Falsy-guard bug identified in risk map §4.3. **Fixed** — guards changed from `!CFG.X` to `CFG.X == null`.

#### CFG defaults in `tokens.js:10-21`

| ID | Given | When | Then |
|----|-------|------|------|
| U-CFG-01 | CFG.HAZARD_RADIUS = undefined | tokens.js loads | CFG.HAZARD_RADIUS = 10 |
| U-CFG-02 | CFG.HAZARD_RADIUS = 0 | tokens.js loads | CFG.HAZARD_RADIUS = 0 (preserved — **fixed**, null check allows 0) |
| U-CFG-03 | CFG.HAZARD_RADIUS = 15 | tokens.js loads | CFG.HAZARD_RADIUS = 15 (preserved) |

#### `GameRenderer._formatDist()` — `renderer.js:294-299`

| ID | Given | When | Then |
|----|-------|------|------|
| U-FMT-01 | meters=0 | _formatDist | Returns '0m' |
| U-FMT-02 | meters=999 | _formatDist | Returns '999m' |
| U-FMT-03 | meters=1000 | _formatDist | Returns '1.00km' |
| U-FMT-04 | meters=1500.5 | _formatDist | Returns '1.50km' |
