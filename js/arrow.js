'use strict';

// ============================================================
// ARROW (PLAYER)
// ============================================================

class Arrow {
    constructor() { this.reset(0, 0); }

    reset(x, y) {
        this.x = x;
        this.y = y;
        this.facing = -Math.PI / 2;   // where the arrow nose points
        this.moveAngle = -Math.PI / 2; // actual velocity direction
        this.steerVel = 0;             // current steering angular velocity
        this.speedMult = 1;
        this.alive = true;
        this.totalDistance = 0;
        this.currentSegIdx = 0;
        this.wallHitTimer = 0;
        this.drifting = false;
        this.driftAmount = 0;          // how much we're sliding (for visuals)
        this.driftTrail = [];
        this.brakeTrail = [];
        this._lastInputDir = 0;        // previous frame's input direction
        this._driftBrakeActive = false; // drift+brake mode (mobile: brake right after drift)
        this._driftBrakeTimer = 0;     // ms held before drift+brake engages
        this._driftBrakeDelay = 150;   // ms required to confirm drift+brake
    }

    update(inputDir, dt60, braking, maxSpeed = 1, boostActive = false) {
        // inputDir: -1 = left, 0 = none, +1 = right
        // Direct controls: tap left = turn left, tap right = turn right

        // Drift+brake detection with 150ms confirmation delay:
        // Keyboard: holding direction + brake simultaneously
        // Mobile/touch: braking immediately after drifting (no gap between inputs)
        const dtMs = dt60 * (1000 / 60);
        const wantsDriftBrake = (braking && inputDir !== 0) ||
            (braking && inputDir === 0 && this._lastInputDir !== 0 && this.drifting);

        if (inputDir !== 0 && !braking) {
            // Currently steering — remember direction, ready for drift+brake
            this._lastInputDir = inputDir;
            this._driftBrakeActive = false;
            this._driftBrakeTimer = 0;
        } else if (wantsDriftBrake) {
            // Accumulate timer; only activate after delay
            this._driftBrakeTimer += dtMs;
            if (this._driftBrakeTimer >= this._driftBrakeDelay) {
                this._driftBrakeActive = true;
            }
        } else if (!braking && inputDir === 0) {
            // Nothing held — clear state
            this._driftBrakeActive = false;
            this._driftBrakeTimer = 0;
            this._lastInputDir = 0;
        }

        const driftBraking = this._driftBrakeActive;

        if (inputDir !== 0) {
            // Steer the facing angle (allowed during drift+brake too)
            this.steerVel += inputDir * CFG.STEER_RATE * dt60;
            this.steerVel = clamp(this.steerVel, -CFG.STEER_MAX, CFG.STEER_MAX);
        } else {
            // Dampen steering velocity when not pressing
            this.steerVel *= Math.pow(0.85, dt60);
            if (Math.abs(this.steerVel) < 0.001) this.steerVel = 0;
        }

        // Apply steering to facing angle
        this.facing += this.steerVel * dt60;

        // When not pressing direction, gradually realign facing to movement direction
        // During drift+brake, skip realign to lock the drift angle
        if (inputDir === 0 && !driftBraking) {
            const diff = angleDiff(this.facing, this.moveAngle);
            this.facing += diff * CFG.REALIGN_RATE * dt60;
        }

        // Movement: velocity direction slowly catches up to facing direction
        // This is the core drift mechanic — low GRIP = more sliding
        // During speed boost, grip is halved so the arrow slides more
        const diff = angleDiff(this.moveAngle, this.facing);
        const effectiveGrip = boostActive ? CFG.GRIP * 0.5 : CFG.GRIP;
        const gripDelta = diff * effectiveGrip * dt60;
        this.moveAngle += gripDelta;
        if (driftBraking) {
            // Rotate facing by the same amount so the drift angle stays stable
            // The arrow keeps curving but the slide angle doesn't grow or shrink
            this.facing += gripDelta;
        }

        // Calculate drift amount (angle between facing and movement)
        this.driftAmount = Math.abs(angleDiff(this.facing, this.moveAngle));
        this.drifting = this.driftAmount > 0.05;

        // Drift drag: exponential curve — small drifts barely slow, big drifts drain hard
        // driftAmount is in radians, ~0.05 = tiny drift, ~1.0 = extreme sideways
        const dragLoss = Math.pow(this.driftAmount, CFG.DRIFT_DRAG_EXP) * CFG.DRIFT_DRAG_SCALE * dt60;
        this.speedMult = Math.max(0.5, this.speedMult - dragLoss);

        // Move along VELOCITY direction (not facing direction)
        const speed = CFG.ARROW_SPEED * this.speedMult * dt60;
        this.x += Math.cos(this.moveAngle) * speed;
        this.y += Math.sin(this.moveAngle) * speed;
        this.totalDistance += speed;

        // Recover speed: fast burst when releasing drift, slower while drifting
        // No recovery while braking (unless drift+brake — that only locks angle)
        if (!braking || driftBraking) {
            let recoveryRate;
            if (inputDir === 0 && this.driftAmount < 0.15) {
                recoveryRate = CFG.SPEED_RECOVERY_RELEASE;
            } else if (this.driftAmount < 0.05) {
                recoveryRate = CFG.SPEED_RECOVERY * 2;
            } else {
                recoveryRate = CFG.SPEED_RECOVERY * 0.3;
            }
            if (this.speedMult < maxSpeed) {
                this.speedMult = Math.min(maxSpeed, this.speedMult + recoveryRate * dt60);
            }
        }

        // Wall hit timer
        if (this.wallHitTimer > 0) this.wallHitTimer -= dt60;

        // Drift trail — emit from rear when sliding
        if (this.drifting) {
            const backX = this.x - Math.cos(this.facing) * CFG.ARROW_LENGTH * 0.4;
            const backY = this.y - Math.sin(this.facing) * CFG.ARROW_LENGTH * 0.4;
            const nx = Math.cos(this.facing + Math.PI / 2);
            const ny = Math.sin(this.facing + Math.PI / 2);
            const slideDir = angleDiff(this.facing, this.moveAngle);
            // Smooth blend: track a running blend value (0=cyan, 1=magenta)
            const targetBlend = slideDir > 0 ? 1 : 0;
            if (this._driftColorBlend === undefined) this._driftColorBlend = targetBlend;
            this._driftColorBlend += (targetBlend - this._driftColorBlend) * 0.08 * dt60;
            const b = this._driftColorBlend;
            // Lerp between cyan (#00ffff) and magenta (#ff00ff)
            const cr = Math.round(255 * b);
            const cg = Math.round(255 * (1 - b));
            const cb = 255;
            const trailColor = 'rgb(' + cr + ',' + cg + ',' + cb + ')';
            this.driftTrail.push({
                x: backX + nx * CFG.ARROW_WIDTH * 0.4,
                y: backY + ny * CFG.ARROW_WIDTH * 0.4,
                age: 0,
                color: trailColor
            });
            this.driftTrail.push({
                x: backX - nx * CFG.ARROW_WIDTH * 0.4,
                y: backY - ny * CFG.ARROW_WIDTH * 0.4,
                age: 0,
                color: trailColor
            });
        }

        // Age and cull trail
        for (let i = this.driftTrail.length - 1; i >= 0; i--) {
            this.driftTrail[i].age += dt60;
            if (this.driftTrail[i].age > 40) {
                this.driftTrail.splice(i, 1);
            }
        }
    }

    // The angle used for rendering the arrow visual
    get angle() { return this.facing; }
}
