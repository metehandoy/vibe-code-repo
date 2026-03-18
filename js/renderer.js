'use strict';

// ============================================================
// RENDERER
// ============================================================
class GameRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    clear() {
        const ctx = this.ctx;
        ctx.fillStyle = '#0a0014';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawTrack(track, camX, camY) {
        const ctx = this.ctx;
        const spine = track.spine;
        if (spine.length < 2) return;

        // Build wall paths
        const leftWall = [];
        const rightWall = [];
        for (const seg of spine) {
            const w = track.getWalls(seg);
            leftWall.push({ x: w.lx - camX, y: w.ly - camY });
            rightWall.push({ x: w.rx - camX, y: w.ry - camY });
        }

        // Track surface (dark)
        ctx.beginPath();
        ctx.moveTo(leftWall[0].x, leftWall[0].y);
        for (let i = 1; i < leftWall.length; i++) ctx.lineTo(leftWall[i].x, leftWall[i].y);
        for (let i = rightWall.length - 1; i >= 0; i--) ctx.lineTo(rightWall[i].x, rightWall[i].y);
        ctx.closePath();
        ctx.fillStyle = '#120024';
        ctx.fill();

        // Center dashes (give sense of speed on straights)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 2;
        for (let i = 0; i < spine.length; i++) {
            const seg = spine[i];
            const phase = seg.index % 4;
            if (phase >= 2) continue; // gap
            if (phase !== 0) continue; // only start on phase 0
            const j = Math.min(i + 2, spine.length - 1);
            if (j <= i) continue;
            ctx.beginPath();
            ctx.moveTo(seg.x - camX, seg.y - camY);
            ctx.lineTo(spine[j].x - camX, spine[j].y - camY);
            ctx.stroke();
        }

        // Road edge markers — periodic ticks perpendicular to the track
        for (let i = 0; i < spine.length; i += 8) {
            const seg = spine[i];
            const w = seg.width;
            const nx = Math.cos(seg.angle + Math.PI / 2);
            const ny = Math.sin(seg.angle + Math.PI / 2);
            const tickLen = 6;

            ctx.strokeStyle = 'rgba(255, 0, 255, 0.3)';
            ctx.lineWidth = 1.5;
            // Left tick
            const lx = seg.x + nx * (w / 2) - camX;
            const ly = seg.y + ny * (w / 2) - camY;
            ctx.beginPath();
            ctx.moveTo(lx, ly);
            ctx.lineTo(lx - nx * tickLen, ly - ny * tickLen);
            ctx.stroke();

            // Right tick
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
            const rx = seg.x - nx * (w / 2) - camX;
            const ry = seg.y - ny * (w / 2) - camY;
            ctx.beginPath();
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx + nx * tickLen, ry + ny * tickLen);
            ctx.stroke();
        }

        // Neon walls
        this._drawNeonLine(leftWall, '#ff00ff', 3);
        this._drawNeonLine(rightWall, '#00ffff', 3);

        // Back wall barrier (red glow across deleted track)
        if (track.backWall) {
            const bw = track.backWall;
            const nx = Math.cos(bw.angle + Math.PI / 2);
            const ny = Math.sin(bw.angle + Math.PI / 2);
            const hw = bw.width / 2;
            const pts = [
                { x: bw.x + nx * hw - camX, y: bw.y + ny * hw - camY },
                { x: bw.x - nx * hw - camX, y: bw.y - ny * hw - camY }
            ];
            this._drawNeonLine(pts, '#ff3366', 4);
        }


    }

    _drawNeonLine(points, color, width) {
        const ctx = this.ctx;
        if (points.length < 2) return;

        // Glow
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.strokeStyle = color;
        ctx.lineWidth = width + 6;
        ctx.globalAlpha = 0.15;
        ctx.stroke();
        ctx.lineWidth = width + 3;
        ctx.globalAlpha = 0.3;
        ctx.stroke();

        // Core
        ctx.lineWidth = width;
        ctx.globalAlpha = 0.9;
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    drawArrow(arrow, camX, camY, speedMult, hazardEffect) {
        const ctx = this.ctx;
        const sx = arrow.x - camX;
        const sy = arrow.y - camY;
        const a = arrow.angle;
        const len = CFG.ARROW_LENGTH;
        const hw = CFG.ARROW_WIDTH / 2;

        // Brake tyre marks
        for (const t of arrow.brakeTrail) {
            const alpha = clamp(1 - t.age / 80, 0, 1) * 0.35;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = 'rgba(40, 20, 60, 0.8)';
            ctx.fillRect(t.x - camX - 2, t.y - camY - 2, 4, 4);
        }
        ctx.globalAlpha = 1;

        // Drift trail
        for (const t of arrow.driftTrail) {
            const alpha = clamp(1 - t.age / 40, 0, 1) * 0.5;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = t.color;
            ctx.fillRect(t.x - camX - 1.5, t.y - camY - 1.5, 3, 3);
        }
        ctx.globalAlpha = 1;

        // Arrow body
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(a);

        // Token-driven color: white default, orange on boost, blue on slow
        let arrowColor, glowColor;
        if (hazardEffect && hazardEffect.type === 'speed') {
            arrowColor = '#ff8800';
            glowColor = '#ffaa00';
        } else if (hazardEffect && hazardEffect.type === 'slow') {
            arrowColor = '#4488ff';
            glowColor = '#4488ff';
        } else {
            arrowColor = '#ffffff';
            glowColor = '#ffffff';
        }

        // Glow
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = arrow.wallHitTimer > 0 ? 25 : 15;

        // Arrow shape
        ctx.beginPath();
        ctx.moveTo(len * 0.6, 0);           // tip
        ctx.lineTo(-len * 0.4, -hw);        // back left
        ctx.lineTo(-len * 0.2, 0);          // notch
        ctx.lineTo(-len * 0.4, hw);         // back right
        ctx.closePath();

        // Fill with speed-based color (wall flash overrides)
        const wallFlash = arrow.wallHitTimer > 0 ? 0.5 + Math.sin(arrow.wallHitTimer * 0.5) * 0.5 : 0;
        if (wallFlash > 0.3) {
            ctx.fillStyle = '#ff3366';
        } else {
            ctx.fillStyle = arrowColor;
        }
        ctx.fill();

        // White inner highlight
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(len * 0.4, 0);
        ctx.lineTo(-len * 0.1, -hw * 0.4);
        ctx.lineTo(0, 0);
        ctx.lineTo(-len * 0.1, hw * 0.4);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fill();

        ctx.restore();
    }

    drawHUD(distance, timeLeft, highScore, speedMult, canvasW, timeFlash, braking, hazardEffect) {
        const ctx = this.ctx;

        // Distance (top-left)
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(this._formatDist(distance), 15, 35);

        // High score as distance
        ctx.font = '12px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillText('BEST: ' + this._formatDist(highScore), 15, 52);

        // Timer (top-right)
        const timeStr = timeLeft.toFixed(1);
        ctx.textAlign = 'right';
        const isLow = timeLeft < 8;
        const isCritical = timeLeft < 4;

        if (timeFlash > 0) {
            ctx.shadowColor = '#00ffa0';
            ctx.shadowBlur = 20;
            ctx.fillStyle = '#00ffa0';
            ctx.font = 'bold 28px monospace';
        } else if (isCritical) {
            const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 150);
            ctx.shadowColor = '#ff3366';
            ctx.shadowBlur = 15 * pulse;
            ctx.fillStyle = '#ff3366';
            ctx.font = 'bold 30px monospace';
        } else if (isLow) {
            ctx.shadowColor = '#ffaa00';
            ctx.shadowBlur = 8;
            ctx.fillStyle = '#ffaa00';
            ctx.font = 'bold 26px monospace';
        } else {
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 24px monospace';
        }
        ctx.fillText(timeStr + 's', canvasW - 15, 35);
        ctx.shadowBlur = 0;

        // Speed indicator (centered)
        if (braking) {
            ctx.textAlign = 'center';
            ctx.font = 'bold 16px monospace';
            ctx.fillStyle = '#ff8800';
            ctx.shadowColor = '#ff8800';
            ctx.shadowBlur = 10;
            ctx.fillText('BRAKE', canvasW / 2, 30);
            ctx.shadowBlur = 0;
        } else if (speedMult < 0.9) {
            ctx.textAlign = 'center';
            ctx.font = 'bold 14px monospace';
            ctx.fillStyle = '#ff3366';
            ctx.fillText('SLOW', canvasW / 2, 30);
        }

        // Hazard effect indicator
        if (hazardEffect) {
            ctx.textAlign = 'center';
            ctx.font = 'bold 14px monospace';
            const remaining = Math.ceil(hazardEffect.timer / 60);
            if (hazardEffect.type === 'slow') {
                ctx.fillStyle = '#4488ff';
                ctx.shadowColor = '#4488ff';
                ctx.shadowBlur = 8;
                ctx.fillText('SLOWED ' + remaining + 's', canvasW / 2, 50);
            } else if (hazardEffect.type === 'speed') {
                ctx.fillStyle = '#ffaa00';
                ctx.shadowColor = '#ffaa00';
                ctx.shadowBlur = 8;
                ctx.fillText('BOOST ' + remaining + 's', canvasW / 2, 50);
            }
            ctx.shadowBlur = 0;
        }

        ctx.textAlign = 'left';
    }

    _formatDist(meters) {
        const m = Math.floor(meters);
        if (m < 1000) return m + 'm';
        const km = m / 1000;
        return km.toFixed(2) + 'km';
    }

    drawMenu(canvasW, canvasH, highScore) {
        const ctx = this.ctx;
        ctx.textAlign = 'center';

        ctx.shadowColor = '#ff00ff';
        ctx.shadowBlur = 30;
        ctx.fillStyle = '#ff00ff';
        ctx.font = 'bold 52px monospace';
        ctx.fillText('DRIFT', canvasW / 2, canvasH / 2 - 60);

        ctx.shadowColor = '#00ffff';
        ctx.fillStyle = '#00ffff';
        ctx.fillText('ARROW', canvasW / 2, canvasH / 2 - 5);
        ctx.shadowBlur = 0;

        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '16px monospace';
        ctx.fillText('Tap left/right to drift', canvasW / 2, canvasH / 2 + 40);

        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '13px monospace';
        ctx.fillText('Hold both sides to brake', canvasW / 2, canvasH / 2 + 58);

        ctx.fillStyle = 'rgba(0,255,160,0.5)';
        ctx.font = '13px monospace';
        ctx.fillText('Collect + tokens \u2022 Avoid hazards', canvasW / 2, canvasH / 2 + 76);

        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 400);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.4 + pulse * 0.6) + ')';
        ctx.font = 'bold 20px monospace';
        ctx.fillText('TAP TO START', canvasW / 2, canvasH / 2 + 106);

        if (highScore > 0) {
            ctx.fillStyle = '#ffee00';
            ctx.font = '15px monospace';
            ctx.fillText('RECORD: ' + this._formatDist(highScore), canvasW / 2, canvasH / 2 + 145);
        }

        ctx.textAlign = 'left';
    }

    drawGameOver(canvasW, canvasH, distance, highScore, isNewHigh, deathCause) {
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(10, 0, 20, 0.7)';
        ctx.fillRect(0, 0, canvasW, canvasH);

        ctx.textAlign = 'center';

        const deathText = deathCause === 'time' ? 'TIME UP' : 'WRECKED';
        ctx.shadowColor = '#ff3366';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#ff3366';
        ctx.font = 'bold 40px monospace';
        ctx.fillText(deathText, canvasW / 2, canvasH / 2 - 50);
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 26px monospace';
        ctx.fillText(this._formatDist(distance), canvasW / 2, canvasH / 2 + 5);

        if (isNewHigh) {
            ctx.fillStyle = '#ffee00';
            ctx.font = 'bold 16px monospace';
            ctx.fillText('NEW RECORD!', canvasW / 2, canvasH / 2 + 35);
        } else {
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font = '14px monospace';
            ctx.fillText('BEST: ' + this._formatDist(highScore), canvasW / 2, canvasH / 2 + 35);
        }

        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 400);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.4 + pulse * 0.6) + ')';
        ctx.font = '18px monospace';
        ctx.fillText('TAP TO RETRY', canvasW / 2, canvasH / 2 + 85);

        ctx.textAlign = 'left';
    }
}
