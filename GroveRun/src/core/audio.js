/* Procedural WebAudio. Minimal set: action, reward, danger/fail. */

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
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  lane() {
    this._beep(180, 0.07, 'triangle', 0.07, -40);
  }

  jump() {
    this._beep(320, 0.1, 'sine', 0.09, 160);
  }

  carrot() {
    this._beep(520, 0.1, 'square', 0.06, 200);
    this._beep(720, 0.12, 'sine', 0.04, 80);
  }

  hit() {
    this._beep(120, 0.22, 'sawtooth', 0.09, -50);
  }

  threat() {
    this._beep(70, 0.15, 'sawtooth', 0.04, -20);
  }

  die() {
    this._beep(90, 0.45, 'sawtooth', 0.11, -55);
    this._beep(60, 0.55, 'triangle', 0.06, -30);
  }

  click() {
    this._beep(480, 0.05, 'square', 0.04, 0);
  }
}
