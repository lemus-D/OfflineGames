/* Procedural WebAudio. Gated on ready + first gesture. */

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
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.ready = true;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  _beep(freq, dur, type = 'square', gain = 0.1, slide = 0) {
    if (!this.ready) return;
    this.resume();
    const t0 = this.now();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) {
      o.frequency.exponentialRampToValueAtTime(
        Math.max(40, freq + slide),
        t0 + dur
      );
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  jump() {
    this._beep(320, 0.08, 'square', 0.07, 180);
  }

  land() {
    this._beep(90, 0.06, 'triangle', 0.08, -30);
  }

  spring() {
    this._beep(200, 0.12, 'square', 0.09, 400);
  }

  vanish() {
    this._beep(180, 0.1, 'sawtooth', 0.06, -80);
  }

  die() {
    this._beep(110, 0.35, 'sawtooth', 0.12, -70);
    this._beep(70, 0.4, 'triangle', 0.08, -40);
  }

  clear() {
    this._beep(440, 0.1, 'square', 0.08, 0);
    this._beep(554, 0.12, 'square', 0.07, 0);
    this._beep(659, 0.18, 'square', 0.09, 80);
  }

  click() {
    this._beep(520, 0.04, 'square', 0.04, 0);
  }
}
