// renderer.js — All drawing/rendering logic

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.bgHue = 220;
        this.starRotation = 0;
    }

    clear() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        // Gradient background
        this.bgHue = (this.bgHue + 0.02) % 360;
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, `hsl(${this.bgHue}, 30%, 8%)`);
        grad.addColorStop(1, `hsl(${(this.bgHue + 30) % 360}, 40%, 12%)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
    }

    drawBackgroundGrid(cameraX, cameraY) {
        const ctx = this.ctx;
        const spacing = 60;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        const offsetX = -(cameraX * 0.3) % spacing;
        const offsetY = -(cameraY * 0.3) % spacing;
        for (let x = offsetX; x < this.canvas.width; x += spacing) {
            for (let y = offsetY; y < this.canvas.height; y += spacing) {
                ctx.fillRect(x, y, 2, 2);
            }
        }
    }

    beginWorldTransform(cameraX, cameraY, rotation, canvasW, canvasH) {
        const ctx = this.ctx;
        ctx.save();
        // Rotate around center of canvas
        ctx.translate(canvasW / 2, canvasH / 2);
        ctx.rotate(rotation);
        ctx.translate(-canvasW / 2, -canvasH / 2);
        // Camera offset
        ctx.translate(-cameraX, -cameraY);
    }

    endWorldTransform() {
        this.ctx.restore();
    }

    drawPlatforms(platforms) {
        const ctx = this.ctx;
        for (const p of platforms) {
            // Main platform
            ctx.fillStyle = '#1A2A3A';
            ctx.fillRect(p.x, p.y, p.w, p.h);
            // Top edge highlight
            ctx.fillStyle = '#2A4A6A';
            ctx.fillRect(p.x, p.y, p.w, 2);
            // Grid lines
            ctx.strokeStyle = 'rgba(42, 74, 106, 0.3)';
            ctx.lineWidth = 0.5;
            for (let gx = p.x; gx < p.x + p.w; gx += 20) {
                ctx.beginPath();
                ctx.moveTo(gx, p.y);
                ctx.lineTo(gx, p.y + p.h);
                ctx.stroke();
            }
        }
    }

    drawSpikes(spikes) {
        const ctx = this.ctx;
        for (const s of spikes) {
            ctx.fillStyle = '#FF4444';
            ctx.shadowColor = '#FF4444';
            ctx.shadowBlur = 6;
            ctx.beginPath();
            if (s.dir === 'up') {
                ctx.moveTo(s.x, s.y + s.h);
                ctx.lineTo(s.x + s.w / 2, s.y);
                ctx.lineTo(s.x + s.w, s.y + s.h);
            } else {
                ctx.moveTo(s.x, s.y);
                ctx.lineTo(s.x + s.w / 2, s.y + s.h);
                ctx.lineTo(s.x + s.w, s.y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }

    drawStars(stars, time) {
        const ctx = this.ctx;
        this.starRotation += 0.03;
        for (const s of stars) {
            if (s.collected) continue;
            ctx.save();
            const cx = s.x + s.w / 2;
            const cy = s.y + s.h / 2;
            ctx.translate(cx, cy);
            ctx.rotate(this.starRotation);
            // Diamond shape
            ctx.fillStyle = '#FFD700';
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 10;
            const half = s.w / 2;
            ctx.beginPath();
            ctx.moveTo(0, -half);
            ctx.lineTo(half, 0);
            ctx.lineTo(0, half);
            ctx.lineTo(-half, 0);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;
            // Inner sparkle
            ctx.fillStyle = '#FFEC8B';
            const inner = half * 0.4;
            ctx.beginPath();
            ctx.moveTo(0, -inner);
            ctx.lineTo(inner, 0);
            ctx.lineTo(0, inner);
            ctx.lineTo(-inner, 0);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
    }

    drawHUD(score, highScore, rotationTimer, rotationInterval, gravityDir, canvasW) {
        const ctx = this.ctx;

        // Score
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`Score: ${score}`, 15, 35);

        // High score
        ctx.font = '14px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText(`Best: ${highScore}`, 15, 55);

        // Rotation countdown ring
        const ringX = canvasW - 40;
        const ringY = 40;
        const ringR = 22;
        const progress = rotationTimer / rotationInterval;

        ctx.beginPath();
        ctx.arc(ringX, ringY, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(ringX, ringY, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        ctx.strokeStyle = progress < 0.3 ? '#FF4444' : '#00E5FF';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Timer text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(Math.ceil(rotationTimer), ringX, ringY + 5);

        // Gravity arrow
        const arrowX = canvasW / 2;
        const arrowY = 30;
        ctx.fillStyle = 'rgba(0, 229, 255, 0.6)';
        ctx.beginPath();
        if (gravityDir > 0) {
            ctx.moveTo(arrowX - 8, arrowY - 5);
            ctx.lineTo(arrowX + 8, arrowY - 5);
            ctx.lineTo(arrowX, arrowY + 8);
        } else {
            ctx.moveTo(arrowX - 8, arrowY + 5);
            ctx.lineTo(arrowX + 8, arrowY + 5);
            ctx.lineTo(arrowX, arrowY - 8);
        }
        ctx.closePath();
        ctx.fill();

        ctx.textAlign = 'left';
    }

    drawMenu(canvasW, canvasH, highScore) {
        const ctx = this.ctx;

        // Title
        ctx.fillStyle = '#00E5FF';
        ctx.font = 'bold 48px monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#00E5FF';
        ctx.shadowBlur = 20;
        ctx.fillText('GRAVITY', canvasW / 2, canvasH / 2 - 60);
        ctx.fillStyle = '#FF4444';
        ctx.shadowColor = '#FF4444';
        ctx.fillText('SHIFT', canvasW / 2, canvasH / 2 - 10);
        ctx.shadowBlur = 0;

        // Instructions
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '18px monospace';
        ctx.fillText('Tap to flip gravity', canvasW / 2, canvasH / 2 + 40);

        // Tap to start (pulsing)
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 500);
        ctx.fillStyle = `rgba(255,255,255,${0.5 + pulse * 0.5})`;
        ctx.font = 'bold 22px monospace';
        ctx.fillText('TAP TO START', canvasW / 2, canvasH / 2 + 90);

        // High score
        if (highScore > 0) {
            ctx.fillStyle = 'rgba(255, 215, 0, 0.8)';
            ctx.font = '16px monospace';
            ctx.fillText(`High Score: ${highScore}`, canvasW / 2, canvasH / 2 + 130);
        }

        ctx.textAlign = 'left';
    }

    drawGameOver(canvasW, canvasH, score, highScore, isNewHigh) {
        const ctx = this.ctx;

        // Overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, canvasW, canvasH);

        ctx.textAlign = 'center';

        // Game Over text
        ctx.fillStyle = '#FF4444';
        ctx.font = 'bold 42px monospace';
        ctx.shadowColor = '#FF4444';
        ctx.shadowBlur = 15;
        ctx.fillText('GAME OVER', canvasW / 2, canvasH / 2 - 50);
        ctx.shadowBlur = 0;

        // Score
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 28px monospace';
        ctx.fillText(`Score: ${score}`, canvasW / 2, canvasH / 2 + 10);

        // New high score
        if (isNewHigh) {
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 18px monospace';
            ctx.fillText('NEW HIGH SCORE!', canvasW / 2, canvasH / 2 + 45);
        } else {
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '16px monospace';
            ctx.fillText(`Best: ${highScore}`, canvasW / 2, canvasH / 2 + 45);
        }

        // Tap to retry
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 500);
        ctx.fillStyle = `rgba(255,255,255,${0.5 + pulse * 0.5})`;
        ctx.font = '20px monospace';
        ctx.fillText('TAP TO RETRY', canvasW / 2, canvasH / 2 + 95);

        ctx.textAlign = 'left';
    }
}
