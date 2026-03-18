'use strict';

// ============================================================
// ROAD HAZARDS
// ============================================================
class HazardManager {
    constructor() {
        this.hazards = [];  // {x, y, segIdx, type, hit}
        this.effectStack = 0; // positive = speed, negative = slow, 0 = neutral
        this.effectTimer = 0;
        this.lastSpawnSeg = 0;
    }

    reset() {
        this.hazards = [];
        this.effectStack = 0;
        this.effectTimer = 0;
        this.lastSpawnSeg = 0;
    }

    spawnOnSegment(seg, difficulty) {
        // Start spawning after some distance; ~2.5% chance per segment
        if (seg.index < CFG.HAZARD_NO_SPAWN_ZONE) return;
        if (seg.index - this.lastSpawnSeg < CFG.HAZARD_MIN_GAP) return;
        const chance = CFG.HAZARD_SPAWN_CHANCE + difficulty * 0.015;
        if (Math.random() > chance) return;
        const nx = Math.cos(seg.angle + Math.PI / 2);
        const ny = Math.sin(seg.angle + Math.PI / 2);
        const offset = (Math.random() - 0.5) * seg.width * 0.4;
        // Pick type: death is rarer
        let type;
        const r = Math.random();
        if (r < 0.35) type = HAZARD.SLOW;
        else if (r < 0.70) type = HAZARD.SPEED;
        else type = HAZARD.DEATH;
        this.hazards.push({
            x: seg.x + nx * offset,
            y: seg.y + ny * offset,
            segIdx: seg.index,
            type: type,
            hit: false
        });
        this.lastSpawnSeg = seg.index;
    }

    cullBefore(minSegIdx) {
        this.hazards = this.hazards.filter(h => h.segIdx >= minSegIdx);
    }

    // Returns: null, 'slow', 'speed', or 'death'
    checkCollision(arrowX, arrowY, arrowFacing) {
        for (const h of this.hazards) {
            if (h.hit) continue;
            // Check distance from hazard center to arrow's two wing edges
            const d = distToArrowWings(h.x, h.y, arrowX, arrowY, arrowFacing);
            const radius = h.type === HAZARD.DEATH ? CFG.DEATH_HAZARD_RADIUS : CFG.HAZARD_RADIUS;
            if (d < radius) {
                h.hit = true;
                if (h.type === HAZARD.DEATH) return 'death';
                if (h.type === HAZARD.SLOW) {
                    // Additive: slow cancels speed, stacking extends timer
                    if (this.effectStack > 0) {
                        // Cancel speed effect
                        this.effectStack--;
                        if (this.effectStack === 0) this.effectTimer = 0;
                    } else {
                        this.effectStack--;
                        this.effectTimer = CFG.HAZARD_EFFECT_DUR; // reset/extend timer
                    }
                    return 'slow';
                }
                if (h.type === HAZARD.SPEED) {
                    // Additive: speed cancels slow, stacking extends timer
                    if (this.effectStack < 0) {
                        // Cancel slow effect
                        this.effectStack++;
                        if (this.effectStack === 0) this.effectTimer = 0;
                    } else {
                        this.effectStack++;
                        this.effectTimer = CFG.HAZARD_EFFECT_DUR; // reset/extend timer
                    }
                    return 'speed';
                }
            }
        }
        return null;
    }

    update(dt60) {
        if (this.effectTimer > 0) {
            this.effectTimer -= dt60;
            if (this.effectTimer <= 0) {
                this.effectTimer = 0;
                this.effectStack = 0;
            }
        }
    }

    getSpeedMult() {
        if (this.effectStack === 0 || this.effectTimer <= 0) return 1;
        if (this.effectStack < 0) return CFG.HAZARD_SLOW_MULT;
        if (this.effectStack > 0) return CFG.HAZARD_SPEED_MULT;
        return 1;
    }

    getActiveEffect() {
        if (this.effectStack === 0 || this.effectTimer <= 0) return null;
        return {
            type: this.effectStack < 0 ? 'slow' : 'speed',
            timer: this.effectTimer
        };
    }

    render(ctx, camX, camY) {
        const now = Date.now() / 1000;
        for (const h of this.hazards) {
            if (h.hit) continue;
            const sx = h.x - camX;
            const sy = h.y - camY;

            let color, symbolColor, symbol, glowColor, strokeColor;
            if (h.type === HAZARD.SLOW) {
                color = '#4488ff';
                glowColor = 'rgba(68, 136, 255, 0.15)';
                strokeColor = '#aaccff';
                symbolColor = '#ffffff';
                symbol = '~';
            } else if (h.type === HAZARD.SPEED) {
                color = '#ffaa00';
                glowColor = 'rgba(255, 170, 0, 0.15)';
                strokeColor = '#ffdd88';
                symbolColor = '#ffffff';
                symbol = '>';
            } else {
                color = '#ff2244';
                glowColor = null;
                strokeColor = '#ff2244';
                symbolColor = '#ffffff';
                symbol = 'X';
            }

            const isDeath = h.type === HAZARD.DEATH;
            const baseRadius = isDeath ? CFG.DEATH_HAZARD_RADIUS : CFG.HAZARD_RADIUS;
            const pulse = isDeath ? 1 : 0.85 + 0.15 * Math.sin(now * 5 + h.segIdx);
            const r = baseRadius * pulse;

            // Outer glow (skip for death — keep it solid and clean)
            if (glowColor) {
                ctx.beginPath();
                ctx.arc(sx, sy, r + 8, 0, Math.PI * 2);
                ctx.fillStyle = glowColor;
                ctx.fill();
            }

            // Core fill
            ctx.beginPath();
            ctx.arc(sx, sy, r, 0, Math.PI * 2);
            ctx.fillStyle = color;
            if (!isDeath) {
                ctx.shadowColor = color;
                ctx.shadowBlur = 15;
            }
            ctx.fill();
            ctx.shadowBlur = 0;

            // Outline ring
            ctx.beginPath();
            ctx.arc(sx, sy, r + 1, 0, Math.PI * 2);
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = isDeath ? 2.5 : 2;
            ctx.stroke();

            // Symbol (white for contrast)
            ctx.fillStyle = symbolColor;
            ctx.font = 'bold ' + Math.floor(r * 1.4) + 'px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(symbol, sx, sy + 1);
            ctx.textBaseline = 'alphabetic';
            ctx.textAlign = 'left';
        }
    }
}
