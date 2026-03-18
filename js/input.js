'use strict';

// ============================================================
// INPUT
// ============================================================
class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.leftDown = false;
        this.rightDown = false;
        this.anyTap = false;
        this.brakeDown = false;

        // Touch
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.anyTap = true;
            this._handleTouches(e.touches);
        }, { passive: false });
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this._handleTouches(e.touches);
        }, { passive: false });
        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this._handleTouches(e.touches);
        }, { passive: false });
        canvas.addEventListener('touchcancel', (e) => {
            this.leftDown = false;
            this.rightDown = false;
        });

        // Mouse
        canvas.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.anyTap = true;
            this._handleMouse(e);
        });
        canvas.addEventListener('mousemove', (e) => {
            if (e.buttons & 1) this._handleMouse(e);
        });
        canvas.addEventListener('mouseup', () => {
            this.leftDown = false;
            this.rightDown = false;
        });

        // Keyboard
        document.addEventListener('keydown', (e) => {
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') { this.leftDown = true; this.anyTap = true; }
            if (e.code === 'ArrowRight' || e.code === 'KeyD') { this.rightDown = true; this.anyTap = true; }
            if (e.code === 'Space') { this.brakeDown = true; this.anyTap = true; e.preventDefault(); }
        });
        document.addEventListener('keyup', (e) => {
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.leftDown = false;
            if (e.code === 'ArrowRight' || e.code === 'KeyD') this.rightDown = false;
            if (e.code === 'Space') this.brakeDown = false;
        });

        document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    }

    _handleTouches(touches) {
        this.leftDown = false;
        this.rightDown = false;
        const mid = this.canvas.width / 2;
        for (let i = 0; i < touches.length; i++) {
            if (touches[i].clientX < mid) this.leftDown = true;
            else this.rightDown = true;
        }
    }

    _handleMouse(e) {
        const mid = this.canvas.width / 2;
        this.leftDown = e.clientX < mid;
        this.rightDown = e.clientX >= mid;
    }

    getDir() {
        if (this.leftDown && this.rightDown) return 0; // braking — no steer
        if (this.leftDown) return -1;
        if (this.rightDown) return 1;
        return 0;
    }

    isBraking() {
        return this.brakeDown || (this.leftDown && this.rightDown);
    }

    consumeTap() {
        const t = this.anyTap;
        this.anyTap = false;
        return t;
    }
}
