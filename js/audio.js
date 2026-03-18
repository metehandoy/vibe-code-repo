'use strict';

// ============================================================
// AUDIO
// ============================================================
class GameAudio {
    constructor() { this.ctx = null; }
    init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) { this.ctx = null; }
    }
    _ensure() {
        if (!this.ctx) this.init();
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
        return !!this.ctx;
    }
    wallHit() {
        if (!this._ensure()) return;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.connect(g); g.connect(this.ctx.destination);
        o.type = 'sawtooth';
        const t = this.ctx.currentTime;
        o.frequency.setValueAtTime(250, t);
        o.frequency.linearRampToValueAtTime(80, t + 0.15);
        g.gain.setValueAtTime(0.2, t);
        g.gain.linearRampToValueAtTime(0, t + 0.15);
        o.start(t); o.stop(t + 0.15);
    }
    // Continuous drift hum — call startDrift/stopDrift to manage
    startDrift() {
        if (!this._ensure()) return;
        if (this._driftNode) return; // already playing
        const ctx = this.ctx;

        // Soft filtered noise-like hum using detuned oscillators
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        const g = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        o1.type = 'sine';
        o2.type = 'triangle';
        o1.frequency.setValueAtTime(85, ctx.currentTime);
        o2.frequency.setValueAtTime(127, ctx.currentTime); // fifth above
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, ctx.currentTime);
        filter.Q.setValueAtTime(5, ctx.currentTime);

        o1.connect(filter);
        o2.connect(filter);
        filter.connect(g);
        g.connect(ctx.destination);
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.15);

        o1.start();
        o2.start();
        this._driftNode = { o1, o2, g, filter };
    }

    updateDrift(driftAmount) {
        if (!this._driftNode) return;
        const ctx = this.ctx;
        const n = this._driftNode;
        // Modulate filter and volume with drift intensity
        const intensity = clamp(driftAmount / 0.8, 0, 1);
        n.filter.frequency.setTargetAtTime(200 + intensity * 600, ctx.currentTime, 0.05);
        n.g.gain.setTargetAtTime(0.03 + intensity * 0.06, ctx.currentTime, 0.05);
        n.o1.frequency.setTargetAtTime(75 + intensity * 60, ctx.currentTime, 0.1);
    }

    stopDrift() {
        if (!this._driftNode) return;
        const ctx = this.ctx;
        const n = this._driftNode;
        n.g.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
        const cleanup = () => { try { n.o1.stop(); n.o2.stop(); } catch(e){} };
        setTimeout(cleanup, 300);
        this._driftNode = null;
    }
    tokenCollect() {
        if (!this._ensure()) return;
        const ctx = this.ctx;
        const t = ctx.currentTime;

        // Pick a random pentatonic note for variety (C, D, E, G, A across octaves)
        const notes = [523, 587, 659, 784, 880, 1047, 1175, 1319];
        const baseFreq = notes[Math.floor(Math.random() * notes.length)];
        // Slight random detune for organic feel
        const detune = (Math.random() - 0.5) * 30;

        // Soft sine chime — main tone
        const o1 = ctx.createOscillator();
        const g1 = ctx.createGain();
        o1.type = 'sine';
        o1.frequency.setValueAtTime(baseFreq, t);
        o1.detune.setValueAtTime(detune, t);
        o1.connect(g1);
        g1.gain.setValueAtTime(0, t);
        g1.gain.linearRampToValueAtTime(0.12, t + 0.02);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

        // Soft harmonic overtone (octave + fifth above)
        const o2 = ctx.createOscillator();
        const g2 = ctx.createGain();
        o2.type = 'sine';
        o2.frequency.setValueAtTime(baseFreq * 1.5, t);
        o2.detune.setValueAtTime(-detune, t);
        o2.connect(g2);
        g2.gain.setValueAtTime(0, t);
        g2.gain.linearRampToValueAtTime(0.05, t + 0.01);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

        g1.connect(ctx.destination);
        g2.connect(ctx.destination);
        o1.start(t); o1.stop(t + 0.5);
        o2.start(t); o2.stop(t + 0.35);
    }
}
