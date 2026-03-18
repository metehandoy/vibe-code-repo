'use strict';

// ============================================================
// UTILS
// ============================================================
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function dist(x1, y1, x2, y2) { return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2); }
// Closest distance from point (px,py) to line segment (ax,ay)-(bx,by)
function distPointToSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return dist(px, py, ax, ay);
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / lenSq, 0, 1);
    return dist(px, py, ax + t * dx, ay + t * dy);
}
// Min distance from point to arrow's two outer wing edges (tip→backLeft, tip→backRight)
function distToArrowWings(px, py, arrowX, arrowY, facing) {
    const cos = Math.cos(facing), sin = Math.sin(facing);
    const nx = -sin, ny = cos; // perpendicular
    const tipX = arrowX + cos * CFG.ARROW_LENGTH * 0.6;
    const tipY = arrowY + sin * CFG.ARROW_LENGTH * 0.6;
    const backX = arrowX - cos * CFG.ARROW_LENGTH * 0.4;
    const backY = arrowY - sin * CFG.ARROW_LENGTH * 0.4;
    const hw = CFG.ARROW_WIDTH / 2;
    const d1 = distPointToSeg(px, py, tipX, tipY, backX + nx * hw, backY + ny * hw);
    const d2 = distPointToSeg(px, py, tipX, tipY, backX - nx * hw, backY - ny * hw);
    return Math.min(d1, d2);
}

// Simple hash-based value noise — output range: -1..1
function valueNoise(t) {
    const i = Math.floor(t);
    const f = t - i;
    const smooth = f * f * (3 - 2 * f);
    const hash = (n) => {
        const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
        return x - Math.floor(x);
    };
    return lerp(hash(i) * 2 - 1, hash(i + 1) * 2 - 1, smooth);
}

// Normalize angle to [-PI, PI]
function normalizeAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
}

// Shortest angular difference from a to b
function angleDiff(a, b) {
    return normalizeAngle(b - a);
}
