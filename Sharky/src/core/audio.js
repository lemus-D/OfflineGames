/* Procedural WebAudio. Every public method is gated on `ready`. */

export class Audio {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.master = null;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    this.ready = true;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  _beep(freq, dur, type = 'sine', gain = 0.12, slide = 0) {
    if (!this.ready) return;
    this.resume();
    const t0 = this.now();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  eat(sizeFrac = 0.5) {
    this._beep(220 + sizeFrac * 280, 0.12, 'triangle', 0.14, 180);
  }

  grow() {
    this._beep(180, 0.18, 'sine', 0.1, 220);
    this._beep(360, 0.22, 'sine', 0.06, 120);
  }

  hurt() {
    this._beep(120, 0.25, 'sawtooth', 0.08, -60);
  }

  die() {
    this._beep(90, 0.5, 'sawtooth', 0.1, -50);
  }

  pick() {
    this._beep(440, 0.1, 'square', 0.06, 200);
  }

  click() {
    this._beep(520, 0.05, 'square', 0.04, 0);
  }
}
