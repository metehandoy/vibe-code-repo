'use strict';

// ============================================================
// TIME TOKENS
// ============================================================
// Hazard types for road dangers
const HAZARD = { SLOW: 0, SPEED: 1, DEATH: 2 };

// These are in CFG so dev.html can tune them
if (CFG.HAZARD_RADIUS == null) CFG.HAZARD_RADIUS = 10;
if (CFG.DEATH_HAZARD_RADIUS == null) CFG.DEATH_HAZARD_RADIUS = 5;
if (CFG.HAZARD_EFFECT_DUR == null) CFG.HAZARD_EFFECT_DUR = 180; // 3 seconds at 60fps
if (CFG.TOKEN_MIN_GAP == null) CFG.TOKEN_MIN_GAP = 25;
if (CFG.TOKEN_SPAWN_CHANCE == null) CFG.TOKEN_SPAWN_CHANCE = 0.025;
if (CFG.TOKEN_NO_SPAWN_ZONE == null) CFG.TOKEN_NO_SPAWN_ZONE = 40;
if (CFG.HAZARD_MIN_GAP == null) CFG.HAZARD_MIN_GAP = 10;
if (CFG.HAZARD_SPAWN_CHANCE == null) CFG.HAZARD_SPAWN_CHANCE = 0.02;
if (CFG.HAZARD_NO_SPAWN_ZONE == null) CFG.HAZARD_NO_SPAWN_ZONE = 80;
if (CFG.HAZARD_SLOW_MULT == null) CFG.HAZARD_SLOW_MULT = 0.55;
if (CFG.HAZARD_SPEED_MULT == null) CFG.HAZARD_SPEED_MULT = 1.12;
if (CFG.OVERLAP_MARGIN == null) CFG.OVERLAP_MARGIN = 15;

class TimeTokenManager {
    constructor() {
        this.tokens = [];  // {x, y, segIdx, collected, pulse}
        this.collectFlash = 0;
        this.lastSpawnSeg = 0;
    }

    reset() {
        this.tokens = [];
        this.collectFlash = 0;
        this.lastSpawnSeg = 0;
    }

    // Called by Track.generateNext when a new segment is created
    spawnOnSegment(seg, difficulty) {
        if (seg.index < CFG.TOKEN_NO_SPAWN_ZONE) return;
        if (seg.index - this.lastSpawnSeg < CFG.TOKEN_MIN_GAP) return;
        const chance = CFG.TOKEN_SPAWN_CHANCE + difficulty * 0.01;
        if (Math.random() > chance) return;
        const nx = Math.cos(seg.angle + Math.PI / 2);
        const ny = Math.sin(seg.angle + Math.PI / 2);
        const offset = (Math.random() - 0.5) * seg.width * 0.5;
        this.tokens.push({
            x: seg.x + nx * offset,
            y: seg.y + ny * offset,
            segIdx: seg.index,
            collected: false,
            pulse: Math.random() * Math.PI * 2
        });
        this.lastSpawnSeg = seg.index;
    }

    // Remove tokens on segments that have been deleted
    cullBefore(minSegIdx) {
        this.tokens = this.tokens.filter(t => t.segIdx >= minSegIdx);
    }

    checkCollect(arrowX, arrowY, arrowFacing) {
        let timeGained = 0;
        for (const t of this.tokens) {
            if (t.collected) continue;
            const d = distToArrowWings(t.x, t.y, arrowX, arrowY, arrowFacing);
            if (d < CFG.TOKEN_RADIUS) {
                t.collected = true;
                timeGained += CFG.TIME_TOKEN_VALUE;
                this.collectFlash = 20;
            }
        }
        return timeGained;
    }

    update(dt60) {
        if (this.collectFlash > 0) this.collectFlash -= dt60;
    }

    render(ctx, camX, camY) {
        const now = Date.now() / 1000;
        for (const t of this.tokens) {
            if (t.collected) continue;
            const sx = t.x - camX;
            const sy = t.y - camY;
            const pulse = 0.8 + 0.2 * Math.sin(now * 4 + t.pulse);
            const r = CFG.TOKEN_RADIUS * pulse;

            ctx.beginPath();
            ctx.arc(sx, sy, r + 8, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 255, 160, 0.1)';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(sx, sy, r + 4, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 255, 160, 0.2)';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(sx, sy, r, 0, Math.PI * 2);
            ctx.fillStyle = '#00ffa0';
            ctx.shadowColor = '#00ffa0';
            ctx.shadowBlur = 15;
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.fillStyle = '#003320';
            ctx.font = 'bold ' + Math.floor(r * 1.2) + 'px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('+', sx, sy + 1);
            ctx.textBaseline = 'alphabetic';
            ctx.textAlign = 'left';
        }
    }
}
