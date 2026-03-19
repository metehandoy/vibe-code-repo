# Testing Plan — Input Manager (input.js)

**Priority: P1** — Loosely coupled, simple logic. But touch coordinate edge cases are a mobile risk (risk map §3.1).

#### `InputManager.getDir()` — `input.js:78-83`

| ID | Given | When | Then |
|----|-------|------|------|
| U-INP-DIR-01 | leftDown=true, rightDown=false | getDir() | Returns -1 |
| U-INP-DIR-02 | leftDown=false, rightDown=true | getDir() | Returns 1 |
| U-INP-DIR-03 | leftDown=true, rightDown=true | getDir() | Returns 0 (both pressed) |
| U-INP-DIR-04 | leftDown=false, rightDown=false | getDir() | Returns 0 (nothing pressed) |

#### `InputManager.isBraking()` — `input.js:85-87`

| ID | Given | When | Then |
|----|-------|------|------|
| U-INP-BRK-01 | brakeDown=true | isBraking() | Returns true |
| U-INP-BRK-02 | leftDown=true, rightDown=true | isBraking() | Returns true |
| U-INP-BRK-03 | leftDown=true, brakeDown=false | isBraking() | Returns false |

#### `InputManager.consumeTap()` — `input.js:89-93`

| ID | Given | When | Then |
|----|-------|------|------|
| U-INP-TAP-01 | anyTap=true | consumeTap() | Returns true, anyTap becomes false |
| U-INP-TAP-02 | anyTap=false | consumeTap() | Returns false |
| U-INP-TAP-03 | anyTap=true | consumeTap() twice | First returns true, second returns false |

#### `InputManager._handleTouches()` — `input.js:62-69`

| ID | Given | When | Then |
|----|-------|------|------|
| U-INP-TCH-01 | Single touch at x=100, canvas.width=800 | _handleTouches | leftDown=true, rightDown=false |
| U-INP-TCH-02 | Single touch at x=500, canvas.width=800 | _handleTouches | leftDown=false, rightDown=true |
| U-INP-TCH-03 | Two touches: x=100 and x=500 | _handleTouches | leftDown=true, rightDown=true (brake) |
| U-INP-TCH-04 | Touch exactly at midpoint (x=400, width=800) | _handleTouches | rightDown=true (>= comparison at line 68) |
| U-INP-TCH-05 | Empty touches array (all fingers lifted) | _handleTouches | leftDown=false, rightDown=false |
