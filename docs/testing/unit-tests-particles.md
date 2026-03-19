# Testing Plan — Particles (particles.js)

**Priority: P2** — Simple, low-risk system. But GC pressure from splice() is a performance concern (risk map §3.3).

#### `Particles.emit()` — `particles.js:9-18`

| ID | Given | When | Then |
|----|-------|------|------|
| U-PRT-EMT-01 | emit(0, 0, 10, '#ff0000', 1, 3, 25) | After emit | list.length increased by 10 |
| U-PRT-EMT-02 | Any emission | After emit | All particles have life=maxLife, valid vx/vy, correct color |

#### `Particles.update()` — `particles.js:26-35`

| ID | Given | When | Then |
|----|-------|------|------|
| U-PRT-UPD-01 | Particle with life=1 | update(dt60=1) | life=0, particle removed |
| U-PRT-UPD-02 | Particle with life=25 | update(dt60=1) | life=24, position updated by vx/vy, velocity *= 0.96 |
| U-PRT-UPD-03 | 50 particles, all expired | update(dt60=100) | list.length=0 |
