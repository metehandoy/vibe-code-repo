'use strict';

// ============================================================
// PROCEDURAL TRACK
// ============================================================

class Track {
    constructor() {
        this.spine = [];
        this.difficulty = 0;
        this.segmentIndex = 0;
        // Agent physics state
        this.agentX = 0;
        this.agentY = 0;
        this.agentFacing = -Math.PI / 2;
        this.agentMoveAngle = -Math.PI / 2;
        this.agentSteerVel = 0;
        // Agent behavioral state
        this.agentWanderPhase = 0;
        this.agentRhythmPhase = 0;
        this.agentEventTimer = 0;
        this.agentEventCurvature = 0;
        this.agentEventDir = 1;
        // Track center tracking for spine angle computation
        this.prevCenterX = 0;
        this.prevCenterY = 0;
    }

    init(startX, startY) {
        this.spine = [];
        this.segmentIndex = 0;
        this.difficulty = 0;
        this.backWall = null;
        // Agent physics reset
        this.agentX = startX;
        this.agentY = startY;
        this.agentFacing = -Math.PI / 2;
        this.agentMoveAngle = -Math.PI / 2;
        this.agentSteerVel = 0;
        // Agent behavioral state reset — randomise phases so each run differs
        this.agentWanderPhase = Math.random() * 1000;
        this.agentRhythmPhase = Math.random() * Math.PI * 2;
        this.agentEventTimer = CFG.EVENT_INTERVAL_MIN + Math.floor(Math.random() * 20);
        this.agentEventCurvature = 0;
        this.agentEventDir = 1;
        // Center tracking
        this.prevCenterX = startX;
        this.prevCenterY = startY;

        for (let i = 0; i < CFG.LOOK_AHEAD + CFG.LOOK_BEHIND + 20; i++) {
            this.generateNext();
        }
    }

    // Returns the minimum distance from (cx,cy) to any non-recent spine segment
    _minDistToOldTrack(cx, cy) {
        const recentThreshold = 60;
        const len = this.spine.length;
        if (len < recentThreshold) return Infinity;
        const checkEnd = len - recentThreshold;
        let minD2 = Infinity;
        for (let i = 0; i < checkEnd; i++) {
            const s = this.spine[i];
            const dx = cx - s.x;
            const dy = cy - s.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < minD2) minD2 = d2;
        }
        return Math.sqrt(minD2);
    }

    // Check if candidate position would cause wall overlap with RECENT segments
    // Returns true if walls would overlap
    _wouldOverlapRecent(cx, cy, candWidth) {
        const skipLast = 10;
        const checkWindow = 120;
        const len = this.spine.length;
        if (len < skipLast + 5) return false;
        const checkStart = Math.max(0, len - checkWindow);
        const checkEnd = len - skipLast;
        const margin = CFG.OVERLAP_MARGIN;
        for (let i = checkStart; i < checkEnd; i++) {
            const s = this.spine[i];
            const dx = cx - s.x;
            const dy = cy - s.y;
            const centerDist = Math.sqrt(dx * dx + dy * dy);
            const combinedHW = (candWidth + s.width) / 2;
            if (centerDist < combinedHW + margin) return true;
        }
        return false;
    }

    generateNext() {
        this.segmentIndex++;
        this.difficulty = Math.min(1, this.segmentIndex * CFG.DIFFICULTY_RAMP);

        const isRunway = this.segmentIndex < 30;
        // Ramp offset amplitude from 0 → full over ~40 segments after runway
        const postRunwayRamp = isRunway ? 0 : Math.min(1, (this.segmentIndex - 30) / 40);

        // ---- Behavior 1: Wander (multi-octave value noise → steering input) ----
        this.agentWanderPhase += CFG.WANDER_FREQUENCY;
        const wanderAmp = isRunway ? CFG.WANDER_AMPLITUDE * 0.15 : CFG.WANDER_AMPLITUDE;
        const n1 = valueNoise(this.agentWanderPhase * 1.0);
        const n2 = valueNoise(this.agentWanderPhase * 2.37) * 0.5;
        const n3 = valueNoise(this.agentWanderPhase * 5.81) * 0.25;
        const wander_raw = (n1 + n2 + n3) * wanderAmp;

        // ---- Behavior 2: Avoidance (steers agent away from old track) ----
        let avoidance_raw = 0;
        if (this.spine.length > 60) {
            const lookaheadSteps = [1, 3, 8, 15, 25];
            const avoidRadius = CFG.AVOIDANCE_RADIUS;
            let maxStrength = 0;
            let bestDir = 0;

            for (const step of lookaheadSteps) {
                const lx = this.agentX + Math.cos(this.agentMoveAngle) * CFG.SEGMENT_LENGTH * step;
                const ly = this.agentY + Math.sin(this.agentMoveAngle) * CFG.SEGMENT_LENGTH * step;
                const d = this._minDistToOldTrack(lx, ly);
                if (d < avoidRadius) {
                    const strength = Math.pow(1 - d / avoidRadius, 2);
                    if (strength > maxStrength) {
                        maxStrength = strength;
                        const checkEnd = this.spine.length - 60;
                        let nearX = 0, nearY = 0, minD2 = Infinity;
                        for (let i = 0; i < checkEnd; i++) {
                            const s = this.spine[i];
                            const dx2 = lx - s.x, dy2 = ly - s.y;
                            const d2 = dx2 * dx2 + dy2 * dy2;
                            if (d2 < minD2) { minD2 = d2; nearX = s.x; nearY = s.y; }
                        }
                        const toNearX = nearX - lx;
                        const toNearY = nearY - ly;
                        const rightX = Math.cos(this.agentMoveAngle + Math.PI / 2);
                        const rightY = Math.sin(this.agentMoveAngle + Math.PI / 2);
                        const dot = toNearX * rightX + toNearY * rightY;
                        bestDir = dot > 0 ? -1 : 1;
                    }
                }
            }
            avoidance_raw = bestDir * maxStrength;

            // Hard override: if agent's next step overlaps recent segments, force avoidance
            const estWidth = this.spine.length > 0 ? this.spine[this.spine.length - 1].width : CFG.TRACK_WIDTH;
            const nextX = this.agentX + Math.cos(this.agentMoveAngle) * CFG.SEGMENT_LENGTH;
            const nextY = this.agentY + Math.sin(this.agentMoveAngle) * CFG.SEGMENT_LENGTH;
            if (this._wouldOverlapRecent(nextX, nextY, estWidth)) {
                const overrideDir = bestDir !== 0 ? bestDir : 1;
                avoidance_raw = overrideDir * 2.0;
            }
        }

        // ---- Behavior 3: Rhythm (periodic oscillation → steering input) ----
        this.agentRhythmPhase += CFG.RHYTHM_FREQUENCY;
        const rhythm_raw = Math.sin(this.agentRhythmPhase) * CFG.RHYTHM_AMPLITUDE * (0.5 + this.difficulty * 0.5);

        // ---- Behavior 4: Challenge events (decaying impulse → steering input) ----
        let event_raw = 0;
        if (!isRunway) {
            this.agentEventTimer--;
            if (this.agentEventTimer <= 0) {
                this.agentEventDir = -this.agentEventDir;
                this.agentEventCurvature = CFG.EVENT_INTENSITY * (0.7 + this.difficulty * 0.3);
                const range = CFG.EVENT_INTERVAL_MAX - CFG.EVENT_INTERVAL_MIN;
                this.agentEventTimer = CFG.EVENT_INTERVAL_MIN + Math.floor(Math.random() * range);
            }
            event_raw = this.agentEventDir * this.agentEventCurvature;
            this.agentEventCurvature *= CFG.EVENT_DECAY;
            if (this.agentEventCurvature < 0.005) this.agentEventCurvature = 0;
        }

        // ---- Behavior 5: Centering (restoring force based on agentFacing) ----
        const referenceAngle = -Math.PI / 2;
        let facingDrift = this.agentFacing - referenceAngle;
        while (facingDrift > Math.PI) facingDrift -= Math.PI * 2;
        while (facingDrift < -Math.PI) facingDrift += Math.PI * 2;
        const centering_raw = -facingDrift;

        // ---- Blend behaviors → steering input [-1, 1] ----
        const blended = wander_raw    * CFG.WANDER_WEIGHT
                      + avoidance_raw * CFG.AVOIDANCE_WEIGHT
                      + rhythm_raw    * CFG.RHYTHM_WEIGHT
                      + event_raw     * CFG.EVENT_WEIGHT
                      + centering_raw * CFG.CENTERING_WEIGHT;
        const inputDir = clamp(blended, -1, 1);

        // ---- Agent drift physics (mirrors Arrow.update()) ----
        if (inputDir !== 0) {
            this.agentSteerVel += inputDir * CFG.AGENT_STEER_RATE;
            this.agentSteerVel = clamp(this.agentSteerVel, -CFG.AGENT_STEER_MAX, CFG.AGENT_STEER_MAX);
        } else {
            this.agentSteerVel *= 0.85;
            if (Math.abs(this.agentSteerVel) < 0.0001) this.agentSteerVel = 0;
        }
        this.agentFacing += this.agentSteerVel;

        // moveAngle catches up to facing (drift lag)
        let moveDiff = this.agentFacing - this.agentMoveAngle;
        while (moveDiff > Math.PI) moveDiff -= Math.PI * 2;
        while (moveDiff < -Math.PI) moveDiff += Math.PI * 2;
        this.agentMoveAngle += moveDiff * CFG.AGENT_GRIP;

        // Step position along moveAngle (not facing)
        this.agentX += Math.cos(this.agentMoveAngle) * CFG.SEGMENT_LENGTH;
        this.agentY += Math.sin(this.agentMoveAngle) * CFG.SEGMENT_LENGTH;

        // ---- Track center offset from agent path ----
        const perpX = Math.cos(this.agentMoveAngle + Math.PI / 2);
        const perpY = Math.sin(this.agentMoveAngle + Math.PI / 2);
        const prevWidth = this.spine.length > 0 ? this.spine[this.spine.length - 1].width : CFG.TRACK_WIDTH;
        const maxOffset = Math.max(0, prevWidth / 2 - CFG.AGENT_MARGIN);
        const effectiveAmp = CFG.OFFSET_AMPLITUDE * postRunwayRamp;
        const offsetNoise = valueNoise(this.segmentIndex * CFG.OFFSET_FREQUENCY);
        const offset = offsetNoise * maxOffset * effectiveAmp;
        const centerX = this.agentX + perpX * offset;
        const centerY = this.agentY + perpY * offset;

        // ---- Spine angle from consecutive center positions ----
        const dx = centerX - this.prevCenterX;
        const dy = centerY - this.prevCenterY;
        const segAngle = Math.atan2(dy, dx);
        this.prevCenterX = centerX;
        this.prevCenterY = centerY;

        // ---- Width: agent drift-amount coupled, ramped in by distance ----
        const maxWidth = CFG.TRACK_WIDTH;
        const minWidth = CFG.MIN_TRACK_WIDTH;
        const driftAmount = Math.abs(moveDiff); // facing-moveAngle lag before this step's update
        const curvatureFraction = clamp(driftAmount / 0.5, 0, 1);
        // Ramp coupling from 0 → full over first 300 segments so early game stays wide
        const couplingRamp = clamp(this.segmentIndex / 300, 0, 1);
        const baseWidth = lerp(maxWidth, minWidth, curvatureFraction * CFG.WIDTH_CURVATURE_COUPLING * couplingRamp);
        const difficultyNarrow = this.difficulty * 0.4 * (maxWidth - minWidth);
        const breathingPulse = Math.sin(this.segmentIndex * 0.015) * 12;
        // Effective minimum ramps from 2× minWidth down to minWidth over first 500 segments
        const effectiveMin = lerp(minWidth * 2, minWidth, clamp(this.segmentIndex / 500, 0, 1));
        const targetWidth = clamp(baseWidth - difficultyNarrow + breathingPulse, effectiveMin, maxWidth);
        let smoothW = targetWidth;
        if (this.spine.length > 0) {
            smoothW = lerp(this.spine[this.spine.length - 1].width, targetWidth, CFG.WIDTH_TRANSITION_RATE);
        }

        const newSeg = {
            x: centerX,
            y: centerY,
            angle: segAngle,
            width: smoothW,
            index: this.segmentIndex
        };
        this.spine.push(newSeg);

        if (this.onSegmentGenerated) {
            this.onSegmentGenerated(newSeg, this.difficulty);
        }
    }

    // Trim old segments and generate new ones
    update(arrowSegIdx) {
        this.minSegIdx = this.spine.length > 0 ? this.spine[0].index : 0;
        // Remove segments far behind — store a back wall at the cut point
        while (this.spine.length > 0 && this.spine[0].index < arrowSegIdx - CFG.LOOK_BEHIND) {
            const removed = this.spine.shift();
            this.backWall = {
                x: removed.x,
                y: removed.y,
                angle: removed.angle,
                width: removed.width + 40
            };
            this.minSegIdx = this.spine.length > 0 ? this.spine[0].index : removed.index;
        }
        // Generate ahead
        const needed = arrowSegIdx + CFG.LOOK_AHEAD;
        while (this.spine.length === 0 || this.spine[this.spine.length - 1].index < needed) {
            this.generateNext();
        }
    }

    getSegment(idx) {
        for (const s of this.spine) {
            if (s.index === idx) return s;
        }
        return null;
    }

    // Find closest segment to a point
    findClosest(px, py) {
        let best = null, bestDist = Infinity;
        for (const s of this.spine) {
            const d = dist(px, py, s.x, s.y);
            if (d < bestDist) { bestDist = d; best = s; }
        }
        return best;
    }

    // Get left and right wall points for a segment
    getWalls(seg) {
        const nx = Math.cos(seg.angle + Math.PI / 2);
        const ny = Math.sin(seg.angle + Math.PI / 2);
        const hw = seg.width / 2;
        return {
            lx: seg.x + nx * hw, ly: seg.y + ny * hw,
            rx: seg.x - nx * hw, ry: seg.y - ny * hw,
        };
    }
}
