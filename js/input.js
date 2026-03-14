// input.js — Touch and keyboard input handling

export class Input {
    constructor(canvas) {
        this.canvas = canvas;
        this.tapped = false;
        this._bound = false;
        this.bind();
    }

    bind() {
        if (this._bound) return;
        this._bound = true;

        const onTap = (e) => {
            e.preventDefault();
            this.tapped = true;
        };

        this.canvas.addEventListener('touchstart', onTap, { passive: false });
        this.canvas.addEventListener('mousedown', onTap);

        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown') {
                e.preventDefault();
                this.tapped = true;
            }
        });

        // Prevent scrolling and zooming on mobile
        document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    }

    consume() {
        const was = this.tapped;
        this.tapped = false;
        return was;
    }
}
