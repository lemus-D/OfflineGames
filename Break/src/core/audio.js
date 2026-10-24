/* Procedural SFX via Web Audio API. Zero sound files. No background music. */

let ctx = null;
let master = null;
let sfxGain = null;
let unlocked = false;
let unlocking = null;
let muted = false;
let lastBallAt = 0;
let lastCushionAt = 0;
let sharedNoise = null;

function ensure() {
  if (ctx) return ctx;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);

  sfxGain = ctx.createGain();
  sfxGain.gain.value = 1;
  sfxGain.connect(master);
  return ctx;
}

function now() {
  return ctx ? ctx.currentTime : 0;
}

function getNoise(seconds = 0.15) {
  const c = ensure();
  if (sharedNoise && sharedNoise.duration >= seconds - 0.001) return sharedNoise;
  const len = Math.max(1, Math.floor(c.sampleRate * seconds));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  let s = 0x2f6e2b1;
  for (let i = 0; i < len; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    data[i] = ((s >>> 8) / 0x1000000) * 2 - 1;
  }
  sharedNoise = buf;
  return buf;
}

/**
 * Must run from a user gesture. Marks unlocked immediately so SFX in the
 * same interaction are allowed, then resumes the context.
 */
export function unlockAudio() {
  const c = ensure();
  if (!c) return Promise.resolve(false);
  // Allow SFX immediately — don't wait on the resume promise.
  unlocked = true;
  if (c.state === 'running') return Promise.resolve(true);
  if (unlocking) return unlocking;

  unlocking = (async () => {
    try {
      if (c.state === 'suspended') await c.resume();
      // Prime unlock (iOS / Safari)
      const buf = c.createBuffer(1, 1, c.sampleRate);
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(c.destination);
      src.start(0);
      return c.state === 'running';
    } catch {
      return false;
    } finally {
      unlocking = null;
    }
  })();

  return unlocking;
}

export function setMuted(m) {
  muted = !!m;
  if (!ensure()) return;
  master.gain.setTargetAtTime(muted ? 0 : 1, now(), 0.04);
}

export function isMuted() {
  return muted;
}

export function isAudioUnlocked() {
  return unlocked && !!ctx;
}

/** No-op kept so older call sites don't break. */
export function startMusic() {}
export function stopMusic() {}

function envGain(peak, attack, decay) {
  const g = ctx.createGain();
  const t = now();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return g;
}

function alive() {
  if (!unlocked || muted) return false;
  if (!ensure()) return false;
  if (ctx.state === 'suspended') ctx.resume();
  return true;
}

/** Cue tip strike — wood tap scaled by power. */
export function playCueStrike(power01) {
  if (!alive()) return;
  const p = Math.max(0.05, Math.min(1, power01));
  const t = now();

  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(180 + p * 100, t);
  osc.frequency.exponentialRampToValueAtTime(70, t + 0.1);

  const click = ctx.createBufferSource();
  click.buffer = getNoise();
  const clickF = ctx.createBiquadFilter();
  clickF.type = 'bandpass';
  clickF.frequency.value = 1200 + p * 600;
  clickF.Q.value = 0.9;

  const g = envGain(0.7 + p * 0.3, 0.002, 0.12);
  const cg = envGain(0.45 + p * 0.35, 0.001, 0.05);

  osc.connect(g);
  g.connect(sfxGain);
  click.connect(clickF);
  clickF.connect(cg);
  cg.connect(sfxGain);

  osc.start(t);
  osc.stop(t + 0.14);
  click.start(t);
  click.stop(t + 0.06);
}

/**
 * Ball–ball clack — mid thump + short noise so phone speakers can hear it.
 * @param {number} impactSpeed relative normal speed from physics
 */
export function playBallHit(impactSpeed) {
  if (!alive()) return;
  const tMs = performance.now();
  // Allow a dense break pack to click, but not scream every substep.
  if (tMs - lastBallAt < 18) return;
  lastBallAt = tMs;

  const s = Math.max(0.12, Math.min(1, (Number(impactSpeed) || 20) / 70));
  const t = now();

  // Body thump (what you hear on a table)
  const thump = ctx.createOscillator();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(190 + s * 120, t);
  thump.frequency.exponentialRampToValueAtTime(90, t + 0.09);

  // Bright click layer
  const click = ctx.createOscillator();
  click.type = 'triangle';
  click.frequency.setValueAtTime(620 + s * 280, t);
  click.frequency.exponentialRampToValueAtTime(240, t + 0.05);

  const noise = ctx.createBufferSource();
  noise.buffer = getNoise();
  const nf = ctx.createBiquadFilter();
  nf.type = 'bandpass';
  nf.frequency.value = 900 + s * 500;
  nf.Q.value = 0.8;

  const tg = envGain(0.75 * s + 0.25, 0.001, 0.11);
  const cg = envGain(0.4 * s + 0.15, 0.001, 0.05);
  const ng = envGain(0.5 * s + 0.2, 0.001, 0.045);

  thump.connect(tg);
  tg.connect(sfxGain);
  click.connect(cg);
  cg.connect(sfxGain);
  noise.connect(nf);
  nf.connect(ng);
  ng.connect(sfxGain);

  thump.start(t);
  thump.stop(t + 0.12);
  click.start(t);
  click.stop(t + 0.07);
  noise.start(t);
  noise.stop(t + 0.05);
}

/** Rail thud. */
export function playCushion(impactSpeed) {
  if (!alive()) return;
  const tMs = performance.now();
  if (tMs - lastCushionAt < 30) return;
  lastCushionAt = tMs;

  const s = Math.max(0.12, Math.min(1, (Number(impactSpeed) || 20) / 80));
  const t = now();

  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(130 + s * 60, t);
  osc.frequency.exponentialRampToValueAtTime(50, t + 0.16);

  const noise = ctx.createBufferSource();
  noise.buffer = getNoise();
  const nf = ctx.createBiquadFilter();
  nf.type = 'lowpass';
  nf.frequency.value = 380 + s * 200;

  const g = envGain(0.55 * s + 0.25, 0.002, 0.16);
  const ng = envGain(0.4 * s + 0.15, 0.002, 0.1);

  osc.connect(g);
  g.connect(sfxGain);
  noise.connect(nf);
  nf.connect(ng);
  ng.connect(sfxGain);

  osc.start(t);
  osc.stop(t + 0.2);
  noise.start(t);
  noise.stop(t + 0.1);
}

/** Soft pocket drop. */
export function playPocket() {
  if (!alive()) return;
  const t = now();
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(210, t);
  osc.frequency.exponentialRampToValueAtTime(65, t + 0.28);
  const g = envGain(0.55, 0.008, 0.3);
  osc.connect(g);
  g.connect(sfxGain);
  osc.start(t);
  osc.stop(t + 0.35);
}

/** Drive SFX from a physics step’s event bag. */
export function playPhysics(events) {
  if (!events || !unlocked || muted) return;
  if (events.ballHits > 0) {
    playBallHit(events.ballImpact > 0 ? events.ballImpact : 25);
  }
  if (events.cushionHits > 0) {
    playCushion(events.cushionImpact > 0 ? events.cushionImpact : 20);
  }
  if (events.pocketed && events.pocketed.length) {
    for (let i = 0; i < events.pocketed.length; i++) playPocket();
  }
}
