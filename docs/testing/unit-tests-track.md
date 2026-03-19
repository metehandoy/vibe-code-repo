# Testing Plan — Track Generation (track.js)

**Priority: P0** — #2 complexity hotspot. Zero test coverage. Small parameter changes can dramatically alter track shape (risk map). Regression tests essential.

#### `Track.init()` — `track.js:29-53`

| ID | Given | When | Then |
|----|-------|------|------|
| U-TRK-INI-01 | init(400, 300) | After init | spine.length === LOOK_AHEAD + LOOK_BEHIND + 20 (240) |
| U-TRK-INI-02 | init called | After init | agentWanderPhase and agentRhythmPhase are randomized |
| U-TRK-INI-03 | init called | After init | All segments have valid x, y, angle, width, index properties |
| U-TRK-INI-04 | init called | After init | First segment starts near startX, startY |

#### `Track.generateNext()` — Width computation (`track.js:226-242`)

| ID | Given | When | Then |
|----|-------|------|------|
| U-TRK-WID-01 | segmentIndex < 30 (runway) | generateNext | Width is wide (near TRACK_WIDTH due to effectiveMin) |
| U-TRK-WID-02 | segmentIndex = 500 | generateNext | effectiveMin = MIN_TRACK_WIDTH (fully ramped) |
| U-TRK-WID-03 | segmentIndex = 250 | generateNext | effectiveMin between MIN_TRACK_WIDTH and 2*MIN_TRACK_WIDTH |
| U-TRK-WID-04 | High curvature (large moveDiff) | generateNext | Width narrows (curvature coupling) |
| U-TRK-WID-05 | difficulty=1.0 | generateNext | Width reduced by 0.4*(TRACK_WIDTH-MIN_TRACK_WIDTH) |
| U-TRK-WID-06 | All widths over 1000 segments | iterate | All widths in [MIN_TRACK_WIDTH, TRACK_WIDTH] |

#### `Track.generateNext()` — Runway behavior (`track.js:97-99`)

| ID | Given | When | Then |
|----|-------|------|------|
| U-TRK-RUN-01 | segmentIndex < 30 | generateNext | wanderAmp = WANDER_AMPLITUDE * 0.15 (gentle curves) |
| U-TRK-RUN-02 | segmentIndex < 30 | generateNext | No event impulses (event_raw=0) |
| U-TRK-RUN-03 | segmentIndex = 30 | generateNext | postRunwayRamp = 0 (offset just starting) |

#### `Track.findClosest()` — `track.js:287-294`

| ID | Given | When | Then |
|----|-------|------|------|
| U-TRK-FC-01 | Point exactly on a segment | findClosest | Returns that segment |
| U-TRK-FC-02 | Point between two segments | findClosest | Returns the nearer one |
| U-TRK-FC-03 | Empty spine | findClosest | Returns null |

#### `Track.update()` — `track.js:259-277`

| ID | Given | When | Then |
|----|-------|------|------|
| U-TRK-UPD-01 | arrowSegIdx advanced beyond LOOK_BEHIND | update | Old segments trimmed, backWall set at removed segment |
| U-TRK-UPD-02 | arrowSegIdx near spine end | update | New segments generated ahead to maintain LOOK_AHEAD buffer |
| U-TRK-UPD-03 | update called | After update | minSegIdx set to first spine segment's index |

#### `Track._wouldOverlapRecent()` — `track.js:74-91`

| ID | Given | When | Then |
|----|-------|------|------|
| U-TRK-OVL-01 | Candidate at same position as recent segment | check | Returns true |
| U-TRK-OVL-02 | Candidate far from all segments | check | Returns false |
| U-TRK-OVL-03 | Spine length < 15 | check | Returns false (insufficient data) |
