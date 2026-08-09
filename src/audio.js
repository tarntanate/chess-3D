// เสียงประกอบสังเคราะห์ด้วย Web Audio API (ไม่ต้องโหลดไฟล์เสียงจากภายนอก)
// เทคนิค: modal synthesis จำลองเสียงไม้เคาะ + คอนโวลูชันรีเวิร์บ + คอมเพรสเซอร์

export class SoundFX {
    constructor() {
        this.enabled = true;
        this.ctx = null;
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

            // สายสัญญาณหลัก: dry + reverb → compressor → master
            this.comp = this.ctx.createDynamicsCompressor();
            this.comp.threshold.value = -16;
            this.comp.knee.value = 18;
            this.comp.ratio.value = 5;
            this.comp.attack.value = 0.002;
            this.comp.release.value = 0.18;

            this.master = this.ctx.createGain();
            this.master.gain.value = 0.6;
            this.comp.connect(this.master).connect(this.ctx.destination);

            this.dry = this.ctx.createGain();
            this.dry.gain.value = 1.0;
            this.dry.connect(this.comp);

            this.reverb = this.ctx.createConvolver();
            this.reverb.buffer = this._impulseResponse(1.6, 2.8);
            this.wet = this.ctx.createGain();
            this.wet.gain.value = 0.22;
            this.reverb.connect(this.wet).connect(this.comp);

            // บัฟเฟอร์ noise ใช้ซ้ำ
            const len = Math.floor(this.ctx.sampleRate * 0.5);
            this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
            const d = this.noise.getChannelData(0);
            for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return true;
    }

    /** สร้าง impulse response แบบ noise เสื่อมพลังงานเอ็กซ์โพเนนเชียล (ห้องไม้เล็ก ๆ) */
    _impulseResponse(seconds, decay) {
        const rate = this.ctx.sampleRate;
        const len = Math.floor(rate * seconds);
        const buf = this.ctx.createBuffer(2, len, rate);
        for (let ch = 0; ch < 2; ch++) {
            const data = buf.getChannelData(ch);
            for (let i = 0; i < len; i++) {
                const t = i / len;
                // early reflections หนาแน่นช่วงแรก แล้วจางลง
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (i < rate * 0.01 ? 0.55 : 1);
            }
        }
        return buf;
    }

    /** จุดต่อปลายทางพร้อม pan ให้เสียงมีตำแหน่งในสเตอริโอ */
    _out(pan = 0) {
        const p = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : this.ctx.createGain();
        if (p.pan) p.pan.value = pan;
        const send = this.ctx.createGain();
        p.connect(this.dry);
        p.connect(this.reverb);
        send.connect(p);
        return send;
    }

    /**
     * เสียงไม้กระทบ (modal synthesis): โหมดสั่นพ้องหลายความถี่แบบอินฮาร์โมนิก
     * เลียนแบบ wood block / หมากไม้ลงกระดาน
     */
    _knock(t, { base = 640, gain = 0.8, decay = 0.09, thump = 0.5, bright = 1, pan = 0 } = {}) {
        const out = this._out(pan);
        out.gain.value = gain;

        // โหมดสั่นของแท่งไม้ (อัตราส่วนอินฮาร์โมนิก) + สุ่มเพี้ยนเล็กน้อยให้ไม่ซ้ำกันทุกครั้ง
        const modes = [
            { r: 1.0, g: 1.0, d: 1.0 },
            { r: 2.31, g: 0.42 * bright, d: 0.62 },
            { r: 3.52, g: 0.22 * bright, d: 0.42 },
            { r: 4.97, g: 0.10 * bright, d: 0.30 }
        ];
        const detune = 1 + (Math.random() - 0.5) * 0.06;
        for (const m of modes) {
            const o = this.ctx.createOscillator();
            o.type = 'sine';
            o.frequency.value = base * m.r * detune;
            const g = this.ctx.createGain();
            const dur = decay * m.d;
            g.gain.setValueAtTime(m.g, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            o.connect(g).connect(out);
            o.start(t);
            o.stop(t + dur + 0.05);
        }

        // transient noise สั้น ๆ ตอนกระทบ
        const src = this.ctx.createBufferSource();
        src.buffer = this.noise;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = base * 3.2;
        bp.Q.value = 1.2;
        const ng = this.ctx.createGain();
        ng.gain.setValueAtTime(0.55, t);
        ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
        src.connect(bp).connect(ng).connect(out);
        src.start(t);
        src.stop(t + 0.05);

        // ตัวกระดานสั่นต่ำ ๆ (thump)
        if (thump > 0) {
            const o = this.ctx.createOscillator();
            o.type = 'sine';
            o.frequency.setValueAtTime(120, t);
            o.frequency.exponentialRampToValueAtTime(55, t + 0.12);
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(thump, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
            o.connect(g).connect(out);
            o.start(t);
            o.stop(t + 0.2);
        }
    }

    /** โน้ตนุ่ม ๆ สองชั้น (detune คู่) สำหรับเมโลดี้/แจ้งเตือน */
    _note(t, freq, { dur = 0.3, gain = 0.14, type = 'triangle', pan = 0, slideTo = null } = {}) {
        const out = this._out(pan);
        out.gain.value = 1;
        for (const cents of [-4, 4]) {
            const o = this.ctx.createOscillator();
            o.type = type;
            o.frequency.setValueAtTime(freq, t);
            o.detune.value = cents;
            if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.0001, t);
            g.gain.linearRampToValueAtTime(gain / 2, t + 0.015);
            g.gain.setTargetAtTime(0.0001, t + dur * 0.35, dur * 0.28);
            o.connect(g).connect(out);
            o.start(t);
            o.stop(t + dur + 0.25);
        }
    }

    _chord(t, freqs, { step = 0, dur = 0.5, gain = 0.13, type = 'triangle' } = {}) {
        freqs.forEach((f, i) => {
            const pan = (i / Math.max(1, freqs.length - 1) - 0.5) * 0.7;
            this._note(t + i * step, f, { dur, gain, type, pan });
        });
    }

    /** เสียงหมากถูกกวาดออกจากกระดาน */
    _sweep(t, { pan = 0 } = {}) {
        const out = this._out(pan);
        out.gain.value = 1;
        const src = this.ctx.createBufferSource();
        src.buffer = this.noise;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 2.2;
        bp.frequency.setValueAtTime(900, t);
        bp.frequency.exponentialRampToValueAtTime(2400, t + 0.1);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.28, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        src.connect(bp).connect(g).connect(out);
        src.start(t);
        src.stop(t + 0.2);
    }

    play(name) {
        if (!this.enabled || !this._ensure()) return;
        const t = this.ctx.currentTime + 0.01;
        const pan = (Math.random() - 0.5) * 0.35;
        switch (name) {
            case 'select':
                // แตะเบา ๆ สูง ๆ เหมือนใช้เล็บเคาะ
                this._knock(t, { base: 1750, gain: 0.16, decay: 0.035, thump: 0, bright: 0.5, pan });
                break;

            case 'move':
                // หมากไม้ลงกระดาน
                this._knock(t, { base: 620 + Math.random() * 90, gain: 0.7, decay: 0.085, thump: 0.4, pan });
                break;

            case 'capture':
                // กวาดหมากออก + กระแทกสองจังหวะ หนักแน่น
                this._sweep(t, { pan: -pan });
                this._knock(t + 0.045, { base: 430, gain: 0.95, decay: 0.13, thump: 0.85, bright: 1.3, pan });
                this._knock(t + 0.1, { base: 950, gain: 0.3, decay: 0.05, thump: 0, bright: 0.7, pan: pan * 1.5 });
                break;

            case 'lost':
                // หมากเราถูกกิน: กระแทกทึบ + โน้ตต่ำหม่น
                this._sweep(t, { pan });
                this._knock(t + 0.045, { base: 300, gain: 0.9, decay: 0.15, thump: 1.0, bright: 0.8, pan });
                this._note(t + 0.1, 196, { dur: 0.5, gain: 0.12, type: 'sine', slideTo: 147, pan: 0 });
                break;

            case 'castle':
                // ขุนและเรือลงกระดานคนละจังหวะ ซ้าย-ขวา
                this._knock(t, { base: 600, gain: 0.6, decay: 0.08, thump: 0.35, pan: -0.3 });
                this._knock(t + 0.16, { base: 520, gain: 0.75, decay: 0.1, thump: 0.5, pan: 0.3 });
                break;

            case 'promote':
                // ระฆังไล่ขึ้น สดใส
                this._knock(t, { base: 640, gain: 0.55, decay: 0.08, thump: 0.3, pan: 0 });
                this._chord(t + 0.06, [523.25, 659.25, 783.99, 1046.5], { step: 0.07, dur: 0.55, gain: 0.13 });
                this._note(t + 0.34, 1568, { dur: 0.7, gain: 0.09, type: 'sine', pan: 0 });
                break;

            case 'check':
                // เตือนภัยสองโน้ต เร่งเร้า
                this._note(t, 740, { dur: 0.14, gain: 0.16, type: 'square', pan: -0.2 });
                this._note(t + 0.13, 988, { dur: 0.3, gain: 0.17, type: 'square', pan: 0.2 });
                break;

            case 'undo':
                this._note(t, 520, { dur: 0.2, gain: 0.1, type: 'triangle', slideTo: 260, pan });
                this._knock(t + 0.12, { base: 700, gain: 0.3, decay: 0.05, thump: 0, pan: -pan });
                break;

            case 'win':
                // แฟนแฟร์ C เมเจอร์ + โน้ตยอด
                this._chord(t, [523.25, 659.25, 783.99], { step: 0.09, dur: 0.65, gain: 0.14 });
                this._chord(t + 0.32, [1046.5, 1318.5], { step: 0.06, dur: 1.0, gain: 0.12 });
                break;

            case 'lose':
                // ไมเนอร์ไล่ลง ช้า หม่น
                this._chord(t, [440, 349.23, 261.63], { step: 0.2, dur: 0.9, gain: 0.13, type: 'sine' });
                this._note(t + 0.62, 196, { dur: 1.2, gain: 0.1, type: 'sine', pan: 0 });
                break;

            case 'draw':
                this._chord(t, [392, 493.88], { step: 0.12, dur: 0.8, gain: 0.12, type: 'sine' });
                break;

            default:
                break;
        }
    }
}
