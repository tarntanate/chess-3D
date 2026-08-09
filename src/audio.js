// เสียงประกอบสังเคราะห์ด้วย Web Audio API (ไม่ต้องโหลดไฟล์เสียงจากภายนอก)

export class SoundFX {
    constructor() {
        this.enabled = true;
        this.ctx = null;
        this.master = null;
        this.noise = null;
    }

    /** ต้องเรียกจากการกดของผู้ใช้ครั้งแรก เพราะนโยบาย autoplay ของเบราว์เซอร์ */
    unlock() {
        this._ensure();
    }

    setEnabled(on) {
        this.enabled = on;
        if (on) this._ensure();
    }

    _ensure() {
        if (!this.ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return false;
            this.ctx = new AC();
            this.master = this.ctx.createGain();
            this.master.gain.value = 0.5;
            this.master.connect(this.ctx.destination);

            const len = Math.floor(this.ctx.sampleRate * 0.4);
            this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
            const data = this.noise.getChannelData(0);
            for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return true;
    }

    _click(t, { freq = 1600, q = 5, dur = 0.08, gain = 0.45 } = {}) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noise;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = freq;
        bp.Q.value = q;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(gain, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(bp).connect(g).connect(this.master);
        src.start(t);
        src.stop(t + dur + 0.02);
    }

    _tone(t, { freq, dur = 0.18, gain = 0.18, type = 'triangle', slideTo = null } = {}) {
        const o = this.ctx.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(gain, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(this.master);
        o.start(t);
        o.stop(t + dur + 0.03);
    }

    _arpeggio(t, freqs, { step = 0.09, dur = 0.32, gain = 0.16, type = 'triangle' } = {}) {
        freqs.forEach((f, i) => this._tone(t + i * step, { freq: f, dur, gain, type }));
    }

    play(name) {
        if (!this.enabled || !this._ensure()) return;
        const t = this.ctx.currentTime + 0.01;
        switch (name) {
            case 'select':
                this._click(t, { freq: 2800, q: 12, dur: 0.03, gain: 0.14 });
                break;
            case 'move':
                this._click(t, { freq: 1500, q: 4, dur: 0.07, gain: 0.42 });
                this._tone(t, { freq: 180, dur: 0.09, gain: 0.12, type: 'sine' });
                break;
            case 'capture':
                this._click(t, { freq: 850, q: 2, dur: 0.15, gain: 0.55 });
                this._click(t + 0.02, { freq: 2600, q: 9, dur: 0.06, gain: 0.28 });
                this._tone(t, { freq: 130, dur: 0.18, gain: 0.22, type: 'sine' });
                break;
            case 'lost':   // หมากของเราถูกกิน — เสียงทึบและต่ำกว่า
                this._click(t, { freq: 520, q: 1.5, dur: 0.2, gain: 0.5 });
                this._tone(t, { freq: 98, dur: 0.26, gain: 0.26, type: 'sine', slideTo: 70 });
                break;
            case 'castle':
                this._click(t, { freq: 1500, q: 4, dur: 0.07, gain: 0.38 });
                this._click(t + 0.13, { freq: 1300, q: 4, dur: 0.08, gain: 0.42 });
                this._tone(t + 0.13, { freq: 170, dur: 0.1, gain: 0.12, type: 'sine' });
                break;
            case 'promote':
                this._arpeggio(t, [523, 659, 784, 1046], { step: 0.07, dur: 0.35, gain: 0.15 });
                break;
            case 'check':
                this._tone(t, { freq: 880, dur: 0.11, gain: 0.17 });
                this._tone(t + 0.12, { freq: 1174, dur: 0.22, gain: 0.17 });
                break;
            case 'undo':
                this._tone(t, { freq: 420, dur: 0.16, gain: 0.14, type: 'sawtooth', slideTo: 200 });
                break;
            case 'win':
                this._arpeggio(t, [523, 659, 784, 1046], { step: 0.1, dur: 0.5, gain: 0.18 });
                break;
            case 'lose':
                this._arpeggio(t, [523, 466, 392, 311], { step: 0.16, dur: 0.6, gain: 0.16 });
                break;
            case 'draw':
                this._tone(t, { freq: 440, dur: 0.4, gain: 0.14 });
                this._tone(t + 0.18, { freq: 415, dur: 0.5, gain: 0.14 });
                break;
            default:
                break;
        }
    }
}
