'use strict';

// ============================================================
// GAME
// ============================================================
const STATE = { MENU: 0, COUNTDOWN: 1, PLAYING: 2, GAME_OVER: 3 };

class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new GameRenderer(canvas);
        this.input = new InputManager(canvas);
        this.audio = new GameAudio();
        this.particles = new Particles();
        this.track = new Track();
        this.arrow = new Arrow();
        this.tokens = new TimeTokenManager();
        this.hazards = new HazardManager();
        this.state = STATE.MENU;
        try {
            this.highScore = parseInt(localStorage.getItem('driftArrowHigh2') || '0', 10);
        } catch (e) {
            this.highScore = 0;
        }
        this.distance = 0;
        this.timeLeft = 0;
        this.isNewHigh = false;
        this.gameOverDelay = 0;
        this.lastSegPassed = 0;
        this.lastTime = 0;
        this.camX = 0;
        this.camY = 0;
        this.camZoom = 1;
        this.timeFlash = 0;
        this.prevSpeedMult = 1;
        this.speedParticleTimer = 0;

        this.renderer.resize();
        window.addEventListener('resize', () => this.renderer.resize());
    }

    startGame() {
        this.audio.init();
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2 + 100;
        this.tokens.reset();
        this.hazards.reset();

        // Set up segment generation callback for tokens and hazards
        this.track.onSegmentGenerated = (seg, diff) => {
            this.tokens.spawnOnSegment(seg, diff);
            this.hazards.spawnOnSegment(seg, diff);
        };

        this.track.init(cx, cy);

        // Place arrow a few segments ahead of the very start so the wall doesn't kill instantly
        const spawnSeg = this.track.spine[Math.min(5, this.track.spine.length - 1)];
        this.arrow.reset(spawnSeg.x, spawnSeg.y);
        this.arrow.facing = spawnSeg.angle;
        this.arrow.moveAngle = spawnSeg.angle;
        this.distance = 0;
        this.timeLeft = CFG.START_TIME;
        this.isNewHigh = false;
        this.gameOverDelay = 0;
        this.lastSegPassed = 0;
        this.peakSegIdx = 0;
        this.backwardTimer = 0;
        this.timeFlash = 0;
        this.diedFromWall = false;

        // Place a back wall behind the starting point so the player can't turn back
        const startSeg = this.track.spine[0];
        if (startSeg) {
            this.track.backWall = {
                x: startSeg.x,
                y: startSeg.y,
                angle: startSeg.angle,
                width: startSeg.width + 40
            };
        }

        // Snap camera immediately to start position (matching directional offset logic)
        const snapDirX = Math.cos(this.arrow.moveAngle);
        const snapDirY = Math.sin(this.arrow.moveAngle);
        const snapFraction = 0.28;
        this.camX = this.arrow.x + snapDirX * 40 + snapDirX * this.canvas.width * snapFraction - this.canvas.width / 2;
        this.camY = this.arrow.y + snapDirY * 40 + snapDirY * this.canvas.height * snapFraction - this.canvas.height / 2;
        this.camZoom = 1;

        // Enter countdown state
        this.countdownTimer = 90; // ~1.5 seconds at 60fps
        this.state = STATE.COUNTDOWN;
    }

    die() {
        this.state = STATE.GAME_OVER;
        this.audio.stopDrift();
        if (this.timeLeft <= 0) this.deathCause = 'time';
        else if (this.diedFromWall) this.deathCause = 'wall';
        else this.deathCause = 'other';
        this.gameOverDelay = 60;
        this.particles.emit(this.arrow.x, this.arrow.y, 30, '#ff3366', 1.5, 4, 40);
        this.particles.emit(this.arrow.x, this.arrow.y, 20, '#ffee00', 1, 3, 30);

        const score = Math.floor(this.distance);
        if (score > this.highScore) {
            this.highScore = score;
            this.isNewHigh = true;
            try { localStorage.setItem('driftArrowHigh2', String(this.highScore)); } catch (e) {}
        }
    }

    checkWallCollision() {
        const arrow = this.arrow;
        const seg = this.track.findClosest(arrow.x, arrow.y);
        if (!seg) return;

        arrow.currentSegIdx = seg.index;

        // Wall normal: perpendicular to track direction
        const nx = Math.cos(seg.angle + Math.PI / 2);
        const ny = Math.sin(seg.angle + Math.PI / 2);
        const hw = seg.width / 2;

        // Check the three arrow corner points (matching visual wing edges)
        const cos = Math.cos(arrow.facing), sin = Math.sin(arrow.facing);
        const wnx = -sin, wny = cos; // perpendicular to arrow facing
        const len = CFG.ARROW_LENGTH;
        const ahw = CFG.ARROW_WIDTH / 2;

        const points = [
            // tip
            [arrow.x + cos * len * 0.6, arrow.y + sin * len * 0.6],
            // back-left wing
            [arrow.x - cos * len * 0.4 - wnx * ahw, arrow.y - sin * len * 0.4 - wny * ahw],
            // back-right wing
            [arrow.x - cos * len * 0.4 + wnx * ahw, arrow.y - sin * len * 0.4 + wny * ahw]
        ];

        for (const pt of points) {
            const dx = pt[0] - seg.x;
            const dy = pt[1] - seg.y;
            const cross = dx * nx + dy * ny;
            if (Math.abs(cross) > hw) {
                const side = cross > 0 ? 1 : -1;
                const hitX = seg.x + nx * hw * side;
                const hitY = seg.y + ny * hw * side;
                this.particles.emit(hitX, hitY, 15, '#ff3366', 1.5, 3, 25);
                this.particles.emit(hitX, hitY, 8, '#ffffff', 1, 2, 15);
                this.audio.wallHit();
                this.diedFromWall = true;
                this.die();
                return;
            }
        }
    }

    checkBackWallCollision() {
        const bw = this.track.backWall;
        if (!bw) return;
        const arrow = this.arrow;
        // The back wall is perpendicular to track direction at the cut point
        // Check if arrow is behind the wall (on the deleted side)
        const fwdX = Math.cos(bw.angle);
        const fwdY = Math.sin(bw.angle);
        const dx = arrow.x - bw.x;
        const dy = arrow.y - bw.y;
        const along = dx * fwdX + dy * fwdY;
        // Also check lateral distance so it only triggers when near the wall
        const nx = -fwdY;
        const ny = fwdX;
        const lateral = Math.abs(dx * nx + dy * ny);
        if (along < 0 && lateral < bw.width / 2) {
            this.particles.emit(bw.x, bw.y, 15, '#ff3366', 1.5, 3, 25);
            this.audio.wallHit();
            this.diedFromWall = true;
            this.die();
        }
    }


    updatePlaying(dt60) {
        const dir = this.input.getDir();
        const braking = this.input.isBraking();
        const _hazardMult = this.hazards.getSpeedMult();
        this.arrow.update(dir, dt60, braking, _hazardMult, _hazardMult > 1);

        // Braking: decel only when not drifting; handbrake preserves speed
        if (braking && !this.arrow.drifting) {
            this.arrow.speedMult = Math.max(
                CFG.BRAKE_MIN_SPEED,
                this.arrow.speedMult - CFG.BRAKE_DECEL * dt60
            );
        }

        // Drift sound management
        if (this.arrow.drifting && this.arrow.driftAmount > 0.1) {
            this.audio.startDrift();
            this.audio.updateDrift(this.arrow.driftAmount);
        } else {
            this.audio.stopDrift();
        }

        // Update track (generates new segments via callback, culls old ones)
        this.track.update(this.arrow.currentSegIdx);

        // Cull tokens and hazards on deleted segments
        if (this.track.minSegIdx > 0) {
            this.tokens.cullBefore(this.track.minSegIdx);
            this.hazards.cullBefore(this.track.minSegIdx);
        }

        // Wall collision
        this.checkWallCollision();
        if (this.state !== STATE.PLAYING) return;

        // Back wall collision (barrier at deleted track)
        this.checkBackWallCollision();
        if (this.state !== STATE.PLAYING) return;

        // Distance tracking: convert segments to meters
        const seg = this.track.findClosest(this.arrow.x, this.arrow.y);
        if (seg && seg.index > this.lastSegPassed) {
            const segsPassed = seg.index - this.lastSegPassed;
            this.lastSegPassed = seg.index;
            this.distance += segsPassed * CFG.METERS_PER_SEGMENT;
        }

        // Backward detection: if arrow is behind peak, slow down
        if (seg) {
            if (seg.index > this.peakSegIdx) {
                this.peakSegIdx = seg.index;
                this.backwardTimer = 0;
            } else if (seg.index < this.peakSegIdx - 3) {
                // Going backward — ramp up slowdown over ~1 second (60 frames)
                this.backwardTimer += dt60;
                const brakeFactor = clamp(this.backwardTimer / 60, 0, 1);
                this.arrow.speedMult *= (1 - brakeFactor * 0.08 * dt60);
                this.arrow.speedMult = Math.max(0.1, this.arrow.speedMult);
            }
        }

        // Countdown timer
        const dtSec = dt60 * 16.67 / 1000;
        this.timeLeft -= dtSec;
        if (this.timeLeft <= 0) {
            this.timeLeft = 0;
            this.die();
            return;
        }

        // Time tokens: collect (spawning handled by track callback)
        const gained = this.tokens.checkCollect(this.arrow.x, this.arrow.y, this.arrow.facing);
        if (gained > 0) {
            this.timeLeft += gained;
            this.timeFlash = 30;
            this.audio.tokenCollect();
            this.particles.emit(this.arrow.x, this.arrow.y, 12, '#00ffa0', 1.2, 3, 20);
        }
        this.tokens.update(dt60);

        // Road hazards: check collision
        const hazardHit = this.hazards.checkCollision(this.arrow.x, this.arrow.y, this.arrow.facing);
        if (hazardHit === 'death') {
            this.particles.emit(this.arrow.x, this.arrow.y, 25, '#ff2244', 1.5, 4, 35);
            this.audio.wallHit();
            this.diedFromWall = false;
            this.die();
            return;
        } else if (hazardHit === 'slow') {
            this.particles.emit(this.arrow.x, this.arrow.y, 20, '#4488ff', 1.5, 4, 30);
            this.particles.emit(this.arrow.x, this.arrow.y, 10, '#88bbff', 1, 2, 20);
        } else if (hazardHit === 'speed') {
            this.particles.emit(this.arrow.x, this.arrow.y, 20, '#ff8800', 1.5, 4, 30);
            this.particles.emit(this.arrow.x, this.arrow.y, 10, '#ffcc44', 1, 2, 20);
        }
        this.hazards.update(dt60);

        // Apply hazard speed effect — lerp toward target, not multiplicative
        const hazardMult = this.hazards.getSpeedMult();
        if (hazardMult !== 1) {
            const target = hazardMult;
            this.arrow.speedMult = lerp(this.arrow.speedMult, target, 0.05 * dt60);
        }

        // Token effect particles: continuous trail matching arrow color
        this.speedParticleTimer -= dt60;
        const activeEffect = this.hazards.getActiveEffect();
        if (activeEffect && this.speedParticleTimer <= 0) {
            if (activeEffect.type === 'speed') {
                // Boost: orange sparks trailing behind
                this.particles.emit(this.arrow.x, this.arrow.y, 3, '#ff8800', 0.8, 2, 15);
                this.speedParticleTimer = 3;
            } else if (activeEffect.type === 'slow') {
                // Slow: blue sparks
                this.particles.emit(this.arrow.x, this.arrow.y, 2, '#4488ff', 0.8, 2, 12);
                this.speedParticleTimer = 5;
            }
        }

        // Particles
        this.particles.update(dt60);

        // Time flash decay
        if (this.timeFlash > 0) this.timeFlash -= dt60;

        // Camera: speed-adaptive zoom, directional positioning, curvature-aware
        const effectiveSpeed = CFG.ARROW_SPEED * this.arrow.speedMult;
        const baseSpeed = 3.5;
        const speedRatio = effectiveSpeed / baseSpeed;

        // Zoom: zoom out when faster, zoom in when slower
        const targetZoom = clamp(1 / Math.pow(speedRatio, 0.35), 0.55, 1.15);
        this.camZoom = lerp(this.camZoom, targetZoom, 0.05 * dt60);

        // Movement direction components
        const dirX = Math.cos(this.arrow.moveAngle);
        const dirY = Math.sin(this.arrow.moveAngle);

        // Position arrow opposite to movement direction on screen:
        // moving up → arrow near bottom, moving right → arrow near left, etc.
        const screenFraction = 0.28;
        const screenOffX = dirX * this.canvas.width * screenFraction;
        const screenOffY = dirY * this.canvas.height * screenFraction;

        // Additional world-space look-ahead (scales with speed)
        const lookAheadDist = 40 + 30 * Math.max(0, speedRatio - 1);

        // Curvature offset: bias camera toward upcoming curves
        // e.g. going up + curving right → arrow shifts toward bottom-left
        let curveOffX = 0, curveOffY = 0;
        const closestSeg = this.track.findClosest(this.arrow.x, this.arrow.y);
        if (closestSeg) {
            let totalCurve = 0, count = 0;
            for (const s of this.track.spine) {
                const ahead = s.index - closestSeg.index;
                if (ahead > 2 && ahead < 40) {
                    totalCurve += angleDiff(closestSeg.angle, s.angle);
                    count++;
                }
            }
            if (count > 0) {
                const avgCurve = totalCurve / count;
                const perpAngle = this.arrow.moveAngle + Math.PI / 2;
                const curveStrength = clamp(Math.abs(avgCurve) * 200, 0, 100);
                const curveDir = avgCurve > 0 ? 1 : -1;
                curveOffX = Math.cos(perpAngle) * curveStrength * curveDir;
                curveOffY = Math.sin(perpAngle) * curveStrength * curveDir;
            }
        }

        // Combine: center on arrow, then shift by look-ahead + screen offset + curvature
        const targetCamX = this.arrow.x + dirX * lookAheadDist + screenOffX + curveOffX - this.canvas.width / 2;
        const targetCamY = this.arrow.y + dirY * lookAheadDist + screenOffY + curveOffY - this.canvas.height / 2;
        // Camera lerp: slower when drifting (smooth blend), faster at high speeds
        const driftBlend = clamp(this.arrow.driftAmount / 0.3, 0, 1);
        const baseCamSpeed = lerp(0.07, 0.04, driftBlend);
        const camSpeed = baseCamSpeed + 0.03 * Math.max(0, speedRatio - 1);
        this.camX = lerp(this.camX, targetCamX, camSpeed * dt60);
        this.camY = lerp(this.camY, targetCamY, camSpeed * dt60);
    }

    update(timestamp) {
        const dt = this.lastTime ? timestamp - this.lastTime : 16.67;
        this.lastTime = timestamp;
        const dt60 = dt / 16.67; // normalize to 60fps

        switch (this.state) {
            case STATE.MENU:
                if (this.input.consumeTap()) this.startGame();
                break;

            case STATE.COUNTDOWN:
                this.countdownTimer -= dt60;
                if (this.countdownTimer <= 0) {
                    this.state = STATE.PLAYING;
                }
                break;

            case STATE.PLAYING:
                this.updatePlaying(dt60);
                break;

            case STATE.GAME_OVER:
                this.particles.update(dt60);
                this.gameOverDelay -= dt60;
                if (this.gameOverDelay <= 0 && this.input.consumeTap()) {
                    this.state = STATE.MENU;
                }
                break;
        }
    }

    render() {
        const w = this.canvas.width, h = this.canvas.height;
        this.renderer.clear();

        if (this.state === STATE.MENU) {
            this.renderer.drawMenu(w, h, this.highScore);
            return;
        }

        // Apply zoom transform centered on screen
        const ctx = this.renderer.ctx;
        const zoom = this.camZoom;
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.scale(zoom, zoom);
        ctx.translate(-w / 2, -h / 2);

        // Draw track
        this.renderer.drawTrack(this.track, this.camX, this.camY);

        // Draw time tokens
        this.tokens.render(ctx, this.camX, this.camY);

        // Draw hazards
        this.hazards.render(ctx, this.camX, this.camY);

        // Draw particles
        this.particles.render(ctx, this.camX, this.camY);

        // Draw arrow
        if (this.state === STATE.PLAYING || this.state === STATE.COUNTDOWN) {
            this.renderer.drawArrow(this.arrow, this.camX, this.camY, this.arrow.speedMult, this.hazards.getActiveEffect());
        }

        ctx.restore(); // Remove zoom transform

        // HUD
        if (this.state === STATE.PLAYING) {
            const braking = this.input.isBraking();
            const hazardEffect = this.hazards.getActiveEffect();
            this.renderer.drawHUD(this.distance, this.timeLeft, this.highScore, this.arrow.speedMult, w, this.timeFlash, braking, hazardEffect);
        }

        // Countdown overlay
        if (this.state === STATE.COUNTDOWN) {
            const countNum = Math.ceil(this.countdownTimer / 60);
            const pulse = 1 + 0.3 * Math.sin((this.countdownTimer % 60) / 60 * Math.PI);
            const ctx = this.renderer.ctx;
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${Math.floor(80 * pulse)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = '#00ffa0';
            ctx.shadowBlur = 30;
            ctx.fillText(countNum > 0 ? String(countNum) : 'GO!', w / 2, h / 2);
            ctx.shadowBlur = 0;
            ctx.font = '18px sans-serif';
            ctx.fillStyle = '#aaaaaa';
            ctx.fillText('GET READY', w / 2, h / 2 + 60);
            ctx.restore();
        }

        if (this.state === STATE.GAME_OVER) {
            // Still show track and particles
            this.renderer.drawGameOver(w, h, this.distance, this.highScore, this.isNewHigh, this.deathCause);
        }
    }

    loop(timestamp) {
        this.update(timestamp);
        this.render();
        requestAnimationFrame((t) => this.loop(t));
    }

    start() {
        requestAnimationFrame((t) => this.loop(t));
    }
}
