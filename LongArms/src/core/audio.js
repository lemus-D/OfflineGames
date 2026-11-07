/* Procedural WebAudio for LongArms. Gated on user gesture via init/resume. */

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
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  jump() {
    this._beep(180, 0.12, 'triangle', 0.1, 220);
  }

  throw() {
    this._beep(140, 0.16, 'sawtooth', 0.07, 160);
  }

  score() {
    this._beep(392, 0.12, 'sine', 0.1, 80);
    this._beep(523, 0.18, 'triangle', 0.08, 40);
  }

  bounce() {
    this._beep(90, 0.06, 'square', 0.04, -20);
  }

  steal() {
    this._beep(210, 0.1, 'square', 0.08, -80);
  }

  clockWarn() {
    this._beep(660, 0.08, 'square', 0.06, 0);
  }

  turnover() {
    this._beep(120, 0.2, 'sawtooth', 0.07, -40);
  }

  win() {
    this._beep(330, 0.15, 'triangle', 0.1, 100);
    this._beep(440, 0.2, 'sine', 0.08, 120);
    this._beep(554, 0.28, 'sine', 0.07, 80);
  }

  lose() {
    this._beep(220, 0.25, 'sawtooth', 0.08, -60);
    this._beep(140, 0.35, 'triangle', 0.07, -40);
  }

  click() {
    this._beep(520, 0.05, 'square', 0.04, 0);
  }

  pickup() {
    this._beep(300, 0.08, 'triangle', 0.06, 100);
  }
}
