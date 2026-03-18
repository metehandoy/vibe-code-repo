'use strict';

// ============================================================
// PARTICLES
// ============================================================
class Particles {
    constructor() { this.list = []; }

    emit(x, y, count, color, spread, speed, life) {
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = speed * (0.5 + Math.random() * 0.5);
            this.list.push({
                x, y, vx: Math.cos(a) * s * spread + (Math.random() - 0.5) * speed,
                vy: Math.sin(a) * s * spread + (Math.random() - 0.5) * speed,
                life, maxLife: life, color, size: 2 + Math.random() * 3
            });
        }
    }

    sparkWall(x, y) {
        this.emit(x, y, 12, '#ff3366', 1, 3, 25);
        this.emit(x, y, 6, '#ffffff', 1, 2, 15);
    }

    update(dt60) {
        for (let i = this.list.length - 1; i >= 0; i--) {
            const p = this.list[i];
            p.x += p.vx * dt60;
            p.y += p.vy * dt60;
            p.vx *= 0.96;
            p.vy *= 0.96;
            p.life -= dt60;
            if (p.life <= 0) this.list.splice(i, 1);
        }
    }

    render(ctx, camX, camY) {
        for (const p of this.list) {
            const alpha = clamp(p.life / p.maxLife, 0, 1);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            const sz = p.size * alpha;
            ctx.fillRect(p.x - camX - sz / 2, p.y - camY - sz / 2, sz, sz);
        }
        ctx.globalAlpha = 1;
    }
}
