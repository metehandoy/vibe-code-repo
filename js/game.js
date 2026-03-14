// game.js — Game loop, state management, main orchestrator

import { Player } from './player.js';
import { Level } from './level.js';
import { Renderer } from './renderer.js';
import { Input } from './input.js';
import { ParticleSystem } from './particles.js';
import { Audio } from './audio.js';
import { rectOverlap, easeInOutCubic, lerp } from './utils.js';

const STATES = { MENU: 0, PLAYING: 1, GAME_OVER: 2 };
const BASE_ROTATION_INTERVAL = 10;
const MIN_ROTATION_INTERVAL = 6;
const ROTATION_DURATION = 1.0;
const OFFSCREEN_MARGIN = 200;

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new Renderer(canvas);
        this.input = new Input(canvas);
        this.particles = new ParticleSystem();
        this.audio = new Audio();
        this.state = STATES.MENU;
        this.highScore = parseInt(localStorage.getItem('gravityShiftHigh') || '0', 10);
        this.lastTime = 0;
        this.gameOverDelay = 0;

        // Rotation state
        this.worldRotation = 0;
        this.targetRotation = 0;
        this.rotationTimer = BASE_ROTATION_INTERVAL;
        this.rotationInterval = BASE_ROTATION_INTERVAL;
        this.isRotating = false;
        this.rotationProgress = 0;
        this.rotationFrom = 0;

        this.player = null;
        this.level = null;
        this.cameraX = 0;
        this.cameraY = 0;
        this.score = 0;
        this.starsCollected = 0;
        this.isNewHigh = false;

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    startGame() {
        this.audio.init();
        this.player = new Player(100, this.canvas.height - 100);
        this.level = new Level(this.canvas.height);
        this.cameraX = 0;
        this.cameraY = 0;
        this.score = 0;
        this.starsCollected = 0;
        this.worldRotation = 0;
        this.targetRotation = 0;
        this.rotationTimer = this.rotationInterval;
        this.isRotating = false;
        this.isNewHigh = false;
        this.gameOverDelay = 0;
        this.state = STATES.PLAYING;
    }

    die() {
        if (!this.player.alive) return;
        this.player.alive = false;
        this.particles.burstDeath(
            this.player.x + this.player.w / 2,
            this.player.y + this.player.h / 2
        );
        this.audio.death();

        // Calculate final score
        this.score = Math.floor(this.player.distance / 10) + this.starsCollected * 50;
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.isNewHigh = true;
            localStorage.setItem('gravityShiftHigh', String(this.highScore));
        }
        this.gameOverDelay = 0.8;
        this.state = STATES.GAME_OVER;
    }

    update(dt) {
        if (dt > 0.1) dt = 0.1; // Cap delta to prevent physics explosions

        switch (this.state) {
            case STATES.MENU:
                if (this.input.consume()) {
                    this.startGame();
                }
                break;

            case STATES.PLAYING:
                this.updatePlaying(dt);
                break;

            case STATES.GAME_OVER:
                this.gameOverDelay -= dt;
                this.particles.update(dt);
                if (this.gameOverDelay <= 0 && this.input.consume()) {
                    this.state = STATES.MENU;
                }
                break;
        }
    }

    updatePlaying(dt) {
        // Handle gravity flip input
        if (this.input.consume()) {
            if (this.player.flipGravity()) {
                this.audio.flipGravity(this.player.gravityDir);
            }
        }

        // Update rotation timer
        if (!this.isRotating) {
            this.rotationTimer -= dt;
            if (this.rotationTimer <= 0) {
                this.isRotating = true;
                this.rotationProgress = 0;
                this.rotationFrom = this.worldRotation;
                this.targetRotation = this.worldRotation + Math.PI / 2;
                this.audio.rotate();
                // Decrease interval with difficulty
                const diff = Math.min(this.player.distance / 5000, 1);
                this.rotationInterval = lerp(BASE_ROTATION_INTERVAL, MIN_ROTATION_INTERVAL, diff);
            }
        } else {
            this.rotationProgress += dt / ROTATION_DURATION;
            if (this.rotationProgress >= 1) {
                this.rotationProgress = 1;
                this.worldRotation = this.targetRotation;
                this.isRotating = false;
                this.rotationTimer = this.rotationInterval;
            } else {
                this.worldRotation = lerp(
                    this.rotationFrom,
                    this.targetRotation,
                    easeInOutCubic(this.rotationProgress)
                );
            }
        }

        // Update player
        this.player.update(dt, this.worldRotation);

        // Collision with platforms
        const platforms = this.level.getAllPlatforms();
        const pRect = this.player.getRect();

        for (const plat of platforms) {
            if (!rectOverlap(pRect, plat)) continue;

            // Resolve collision
            const overlapTop = (pRect.y + pRect.h) - plat.y;
            const overlapBottom = (plat.y + plat.h) - pRect.y;
            const overlapLeft = (pRect.x + pRect.w) - plat.x;
            const overlapRight = (plat.x + plat.w) - pRect.x;

            const minOverlap = Math.min(overlapTop, overlapBottom, overlapLeft, overlapRight);

            if (minOverlap === overlapTop && this.player.vy > 0) {
                this.player.y = plat.y - this.player.h;
                this.player.vy = 0;
            } else if (minOverlap === overlapBottom && this.player.vy < 0) {
                this.player.y = plat.y + plat.h;
                this.player.vy = 0;
            } else if (minOverlap === overlapLeft) {
                this.player.x = plat.x - this.player.w;
            } else if (minOverlap === overlapRight) {
                this.player.x = plat.x + plat.w;
            }
        }

        // Collision with spikes
        const spikes = this.level.getAllSpikes();
        for (const spike of spikes) {
            // Use a slightly smaller hitbox for spikes (more forgiving)
            const spikeRect = {
                x: spike.x + 3, y: spike.y + 3,
                w: spike.w - 6, h: spike.h - 6
            };
            if (rectOverlap(this.player.getRect(), spikeRect)) {
                this.die();
                return;
            }
        }

        // Star collection
        const stars = this.level.getAllStars();
        for (const star of stars) {
            if (rectOverlap(this.player.getRect(), star)) {
                star.collected = true;
                this.starsCollected++;
                this.particles.burstStar(star.x + star.w / 2, star.y + star.h / 2);
                this.audio.collectStar();
            }
        }

        // Off-screen death check
        const px = this.player.x - this.cameraX;
        const py = this.player.y - this.cameraY;
        if (py < -OFFSCREEN_MARGIN || py > this.canvas.height + OFFSCREEN_MARGIN ||
            px < -OFFSCREEN_MARGIN * 2) {
            this.die();
            return;
        }

        // Player trail
        if (this.player.trailTimer <= 0) {
            this.particles.trail(
                this.player.x + this.player.w / 2,
                this.player.y + this.player.h / 2,
                this.player.color
            );
            this.player.trailTimer = 0.05;
        }

        // Update camera
        this.cameraX = lerp(this.cameraX, this.player.x - this.canvas.width * 0.3, 5 * dt);
        this.cameraY = 0;

        // Update level
        this.level.update(this.cameraX);

        // Update particles
        this.particles.update(dt);

        // Update score
        this.score = Math.floor(this.player.distance / 10) + this.starsCollected * 50;
    }

    render() {
        const w = this.canvas.width;
        const h = this.canvas.height;

        this.renderer.clear();

        if (this.state === STATES.MENU) {
            this.renderer.drawBackgroundGrid(0, 0);
            this.renderer.drawMenu(w, h, this.highScore);
            return;
        }

        // Draw background grid (no rotation)
        this.renderer.drawBackgroundGrid(this.cameraX, this.cameraY);

        // Begin rotated world rendering
        this.renderer.beginWorldTransform(this.cameraX, this.cameraY, this.worldRotation, w, h);

        // Draw level
        if (this.level) {
            this.renderer.drawPlatforms(this.level.getAllPlatforms());
            this.renderer.drawSpikes(this.level.getAllSpikes());
            this.renderer.drawStars(this.level.getAllStars());
        }

        // Draw player
        if (this.player) {
            this.player.render(this.renderer.ctx);
        }

        // Draw particles (in world space)
        this.particles.render(this.renderer.ctx);

        this.renderer.endWorldTransform();

        // HUD (no rotation)
        if (this.state === STATES.PLAYING) {
            this.renderer.drawHUD(
                this.score, this.highScore,
                this.rotationTimer, this.rotationInterval,
                this.player.gravityDir, w
            );
        }

        if (this.state === STATES.GAME_OVER) {
            this.renderer.drawGameOver(w, h, this.score, this.highScore, this.isNewHigh);
        }
    }

    loop(timestamp) {
        const dt = this.lastTime ? (timestamp - this.lastTime) / 1000 : 1 / 60;
        this.lastTime = timestamp;

        this.update(dt);
        this.render();

        requestAnimationFrame((t) => this.loop(t));
    }

    start() {
        requestAnimationFrame((t) => this.loop(t));
    }
}
