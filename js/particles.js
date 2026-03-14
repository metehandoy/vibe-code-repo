// particles.js — Pool-based particle system

const MAX_PARTICLES = 300;

class Particle {
    constructor() {
        this.active = false;
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.life = 0;
        this.maxLife = 0;
        this.size = 0;
        this.color = '';
        this.shrink = true;
    }

    reset(x, y, vx, vy, life, size, color, shrink = true) {
        this.active = true;
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.life = life;
        this.maxLife = life;
        this.size = size;
        this.color = color;
        this.shrink = shrink;
    }

    update(dt) {
        if (!this.active) return;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vy += 200 * dt; // slight gravity on particles
        this.life -= dt;
        if (this.life <= 0) this.active = false;
    }
}

export class ParticleSystem {
    constructor() {
        this.pool = [];
        for (let i = 0; i < MAX_PARTICLES; i++) {
            this.pool.push(new Particle());
        }
    }

    _get() {
        for (const p of this.pool) {
            if (!p.active) return p;
        }
        return null;
    }

    emit(x, y, count, config) {
        for (let i = 0; i < count; i++) {
            const p = this._get();
            if (!p) return;
            const angle = config.angleBase + (Math.random() - 0.5) * config.angleSpread;
            const speed = config.speedMin + Math.random() * (config.speedMax - config.speedMin);
            p.reset(
                x + (Math.random() - 0.5) * (config.offsetX || 0),
                y + (Math.random() - 0.5) * (config.offsetY || 0),
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                config.life + Math.random() * (config.lifeVar || 0),
                config.size + Math.random() * (config.sizeVar || 0),
                config.colors[Math.floor(Math.random() * config.colors.length)],
                config.shrink !== false
            );
        }
    }

    burstStar(x, y) {
        this.emit(x, y, 10, {
            angleBase: 0, angleSpread: Math.PI * 2,
            speedMin: 80, speedMax: 200,
            life: 0.4, lifeVar: 0.2,
            size: 3, sizeVar: 2,
            colors: ['#FFD700', '#FFA500', '#FFEC8B', '#FFFFFF'],
            shrink: true
        });
    }

    burstDeath(x, y) {
        this.emit(x, y, 25, {
            angleBase: 0, angleSpread: Math.PI * 2,
            speedMin: 100, speedMax: 300,
            life: 0.6, lifeVar: 0.3,
            size: 4, sizeVar: 3,
            colors: ['#FF4444', '#FF6644', '#FF8844', '#FFAA44'],
            shrink: true
        });
    }

    trail(x, y, color) {
        this.emit(x, y, 1, {
            angleBase: Math.PI, angleSpread: 0.5,
            speedMin: 10, speedMax: 40,
            life: 0.3, lifeVar: 0.1,
            size: 2, sizeVar: 1,
            colors: [color],
            shrink: true
        });
    }

    update(dt) {
        for (const p of this.pool) {
            p.update(dt);
        }
    }

    render(ctx) {
        for (const p of this.pool) {
            if (!p.active) continue;
            const alpha = p.life / p.maxLife;
            const size = p.shrink ? p.size * alpha : p.size;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
        }
        ctx.globalAlpha = 1;
    }
}
