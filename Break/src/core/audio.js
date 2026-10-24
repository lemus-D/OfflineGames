/* Procedural audio via Web Audio API. Zero sound files. */

let ctx = null;
let master = null;
let musicGain = null;
let sfxGain = null;
let musicNodes = [];
let musicTimer = null;
let unlocked = false;
let muted = false;
let lastBallAt = 0;
let lastCushionAt = 0;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.7;
  master.connect(ctx.destination);

  musicGain = ctx.createGain();
  musicGain.gain.value = 0.12;
  musicGain.connect(master);

  sfxGain = ctx.createGain();
  sfxGain.gain.value = 0.55;
  sfxGain.connect(master);
  return ctx;
}

function now() {
  return ctx ? ctx.currentTime : 0;
}

/** Resume context after a user gesture (browsers block autoplay). */
export function unlockAudio() {
  const c = ensure();
  if (!c) return;
  if (c.state === 'suspended') c.resume();
  unlocked = true;
  if (!muted) startMusic();
}

export function setMuted(m) {
  muted = !!m;
  if (!ensure()) return;
  master.gain.setTargetAtTime(muted ? 0 : 0.7, now(), 0.05);
  if (muted) stopMusic();
  else if (unlocked) startMusic();
}

export function isMuted() {
  return muted;
}

function noiseBuffer(seconds = 0.2) {
  const c = ensure();
  const len = Math.max(1, Math.floor(c.sampleRate * seconds));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  // Deterministic-ish hash noise (not Math.random — fine for audio buffer)
  let s = 0x2f6e2b1;
  for (let i = 0; i < len; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    data[i] = ((s >>> 8) / 0x1000000) * 2 - 1;
  }
  return buf;
}

function envGain(peak, attack, decay) {
  const g = ctx.createGain();
  const t = now();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return g;
}

/** Soft felt-hall pad + sparse warm plucks. */
export function startMusic() {
  const c = ensure();
  if (!c || muted || musicTimer) return;
  if (c.state === 'suspended') c.resume();

  // Low warm drone
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 55;
  const osc2 = c.createOscillator();
  osc2.type = 'triangle';
  osc2.frequency.value = 82.5;
  const drone = c.createGain();
  drone.gain.value = 0.22;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 320;
  filter.Q.value = 0.6;
  osc.connect(drone);
  osc2.connect(drone);
  drone.connect(filter);
  filter.connect(musicGain);
  osc.start();
  osc2.start();
  musicNodes = [osc, osc2, drone, filter];

  // Occasional pentatonic plucks (A minor-ish, warm)
  const notes = [220, 261.63, 293.66, 329.63, 392, 440];
  let step = 0;
  musicTimer = setInterval(() => {
    if (!ctx || muted || !unlocked) return;
    step += 1;
    if (step % 2 !== 0) return; // every other beat
    const n = notes[step % notes.length];
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = n;
    const g = envGain(0.09, 0.01, 0.85);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1200;
    o.connect(f);
    f.connect(g);
    g.connect(musicGain);
    o.start();
    o.stop(now() + 1.0);
  }, 720);
}

export function stopMusic() {
  if (musicTimer) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
  for (const n of musicNodes) {
    try {
      if (n.stop) n.stop();
      if (n.disconnect) n.disconnect();
    } catch {
      /* already stopped */
    }
  }
  musicNodes = [];
}

/** Cue tip strike — wood tap scaled by power. */
export function playCueStrike(power01) {
  if (!unlocked || muted || !ensure()) return;
  const p = Math.max(0.05, Math.min(1, power01));
  const t = now();

  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(180 + p * 90, t);
  osc.frequency.exponentialRampToValueAtTime(70, t + 0.08);

  const click = ctx.createBufferSource();
  click.buffer = noiseBuffer(0.05);
  const clickF = ctx.createBiquadFilter();
  clickF.type = 'bandpass';
  clickF.frequency.value = 1400 + p * 800;
  clickF.Q.value = 1.2;

  const g = envGain(0.22 + p * 0.35, 0.002, 0.09);
  const cg = envGain(0.12 + p * 0.2, 0.001, 0.04);

  osc.connect(g);
  g.connect(sfxGain);
  click.connect(clickF);
  clickF.connect(cg);
  cg.connect(sfxGain);

  osc.start(t);
  osc.stop(t + 0.12);
  click.start(t);
  click.stop(t + 0.05);
}

/** Ball–ball click / clack. */
export function playBallHit(impactSpeed) {
  if (!unlocked || muted || !ensure()) return;
  const tMs = performance.now();
  if (tMs - lastBallAt < 28) return;
  lastBallAt = tMs;

  const s = Math.max(0.05, Math.min(1, impactSpeed / 90));
  const t = now();

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(520 + s * 480, t);
  osc.frequency.exponentialRampToValueAtTime(180, t + 0.06);

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(0.04);
  const nf = ctx.createBiquadFilter();
  nf.type = 'highpass';
  nf.frequency.value = 800;

  const g = envGain(0.16 + s * 0.4, 0.001, 0.07);
  const ng = envGain(0.08 + s * 0.18, 0.001, 0.035);

  osc.connect(g);
  g.connect(sfxGain);
  noise.connect(nf);
  nf.connect(ng);
  ng.connect(sfxGain);

  osc.start(t);
  osc.stop(t + 0.09);
  noise.start(t);
  noise.stop(t + 0.04);
}

/** Rail thud. */
export function playCushion(impactSpeed) {
  if (!unlocked || muted || !ensure()) return;
  const tMs = performance.now();
  if (tMs - lastCushionAt < 40) return;
  lastCushionAt = tMs;

  const s = Math.max(0.05, Math.min(1, impactSpeed / 100));
  const t = now();

  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(140 + s * 60, t);
  osc.frequency.exponentialRampToValueAtTime(55, t + 0.12);

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(0.08);
  const nf = ctx.createBiquadFilter();
  nf.type = 'lowpass';
  nf.frequency.value = 400 + s * 200;

  const g = envGain(0.14 + s * 0.28, 0.002, 0.14);
  const ng = envGain(0.1 + s * 0.15, 0.002, 0.1);

  osc.connect(g);
  g.connect(sfxGain);
  noise.connect(nf);
  nf.connect(ng);
  ng.connect(sfxGain);

  osc.start(t);
  osc.stop(t + 0.16);
  noise.start(t);
  noise.stop(t + 0.08);
}

/** Soft pocket drop. */
export function playPocket() {
  if (!unlocked || muted || !ensure()) return;
  const t = now();
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.exponentialRampToValueAtTime(70, t + 0.28);
  const g = envGain(0.22, 0.01, 0.3);
  osc.connect(g);
  g.connect(sfxGain);
  osc.start(t);
  osc.stop(t + 0.35);
}

/** Drive SFX from a physics step’s event bag. */
export function playPhysics(events) {
  if (!events || !unlocked || muted) return;
  if (events.ballHits > 0 && events.ballImpact > 2) {
    playBallHit(events.ballImpact);
  }
  if (events.cushionHits > 0 && events.cushionImpact > 2) {
    playCushion(events.cushionImpact);
  }
  if (events.pocketed && events.pocketed.length) {
    for (let i = 0; i < events.pocketed.length; i++) playPocket();
  }
}
