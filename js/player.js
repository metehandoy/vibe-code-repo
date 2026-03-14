// player.js — Player entity with gravity, movement, collision

import { clamp } from './utils.js';

const SIZE = 20;
const GRAVITY = 900;
const MAX_FALL_SPEED = 600;
const FLIP_COOLDOWN = 0.15;
const BASE_SPEED = 180;
const SPEED_INCREASE = 0.5; // pixels per second per pixel traveled

export class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.w = SIZE;
        this.h = SIZE;
        this.vx = BASE_SPEED;
        this.vy = 0;
        this.gravityDir = 1; // 1 = down, -1 = up
        this.flipCooldown = 0;
        this.alive = true;
        this.distance = 0;
        this.squash = 1; // for flip animation: <1 = squashed, >1 = stretched
        this.color = '#00E5FF';
        this.trailTimer = 0;
    }

    get speed() {
        return BASE_SPEED + this.distance * SPEED_INCREASE * 0.01;
    }

    flipGravity() {
        if (this.flipCooldown > 0) return false;
        this.gravityDir *= -1;
        this.vy = 0;
        this.flipCooldown = FLIP_COOLDOWN;
        this.squash = 0.5;
        return true;
    }

    update(dt, worldRotation) {
        if (!this.alive) return;

        this.flipCooldown = Math.max(0, this.flipCooldown - dt);

        // Squash recovery
        this.squash += (1 - this.squash) * 10 * dt;

        // Determine effective movement based on world rotation
        const rotSteps = Math.round(worldRotation / (Math.PI / 2)) % 4;
        const speed = this.speed;

        // Apply auto-run in world space
        switch (rotSteps) {
            case 0: this.vx = speed; break;
            case 1: this.vx = 0; this.vy = speed * this.gravityDir; break;
            case 2: this.vx = -speed; break;
            case 3: this.vx = 0; this.vy = -speed * this.gravityDir; break;
        }

        // Apply gravity based on rotation
        let gx = 0, gy = 0;
        switch (rotSteps) {
            case 0: gy = GRAVITY * this.gravityDir; break;
            case 1: gx = GRAVITY * this.gravityDir; break;
            case 2: gy = -GRAVITY * this.gravityDir; break;
            case 3: gx = -GRAVITY * this.gravityDir; break;
        }

        if (rotSteps === 0 || rotSteps === 2) {
            this.vy += gy * dt;
            this.vy = clamp(this.vy, -MAX_FALL_SPEED, MAX_FALL_SPEED);
        } else {
            // During 90/270 rotation, auto-run is vertical, gravity is horizontal
            this.vx += gx * dt;
            this.vx = clamp(this.vx, -MAX_FALL_SPEED, MAX_FALL_SPEED);
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        this.distance = Math.max(this.distance, this.x);
        this.trailTimer -= dt;
    }

    getRect() {
        return { x: this.x, y: this.y, w: this.w, h: this.h };
    }

    render(ctx) {
        ctx.save();
        const cx = this.x + this.w / 2;
        const cy = this.y + this.h / 2;
        ctx.translate(cx, cy);
        ctx.scale(this.squash, 2 - this.squash);

        // Glow
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 12;

        // Body
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);

        // Eyes
        ctx.shadowBlur = 0;
        const eyeY = this.gravityDir > 0 ? -2 : 2;
        ctx.fillStyle = '#000';
        ctx.fillRect(-4, eyeY - 2, 3, 3);
        ctx.fillRect(2, eyeY - 2, 3, 3);
        // Pupils (white dot)
        ctx.fillStyle = '#FFF';
        ctx.fillRect(-3, eyeY - 1, 1, 1);
        ctx.fillRect(3, eyeY - 1, 1, 1);

        ctx.restore();
    }
}
