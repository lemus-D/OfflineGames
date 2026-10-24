/* Procedural SFX via Web Audio API. Zero sound files. No BGM. */

let ctx = null;
let master = null;
let sfxGain = null;
let unlocked = false;
let muted = false;
let lastBallAt = 0;
let lastCushionAt = 0;
let sharedNoise = null;
/** @type {Array<() => void>} */
let pending = [];

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
  ctx.addEventListener('statechange', () => {
    if (ctx && ctx.state === 'running') flushPending();
  });
  return ctx;
}

function now() {
  return ctx ? ctx.currentTime : 0;
}

function getNoise(seconds = 0.2) {
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

function flushPending() {
  if (!ctx || ctx.state !== 'running' || muted) return;
  const jobs = pending.splice(0, pending.length);
  for (const job of jobs) {
    try {
      job();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Run `fn` now if AudioContext is running; otherwise queue until resume.
 * Critical: scheduling into a suspended context is silent on Safari/Chrome mobile.
 */
function whenRunning(fn) {
  if (!unlocked || muted) return false;
  if (!ensure()) return false;
  if (ctx.state === 'running') {
    fn();
    return true;
  }
  pending.push(fn);
  if (ctx.state === 'suspended') ctx.resume().then(flushPending).catch(() => {});
  return false;
}

/**
 * Call from a user gesture. Creates/resumes AudioContext and plays a
 * short confirm tick so you know sound is live.
 */
export function unlockAudio() {
  const c = ensure();
  if (!c) return Promise.resolve(false);
  unlocked = true;

  const after = () => {
    flushPending();
    // One obvious tick on unlock — if you hear this, the pipeline works.
    playUnlockTick();
    return c.state === 'running';
  };

  if (c.state === 'running') {
    after();
    return Promise.resolve(true);
  }

  // resume() must be kicked off during the gesture call stack
  return c
    .resume()
    .then(after)
    .catch(() => false);
}

export function setMuted(m) {
  muted = !!m;
  if (!ensure()) return;
  master.gain.setTargetAtTime(muted ? 0 : 1, now(), 0.03);
  if (!muted) flushPending();
}

export function isMuted() {
  return muted;
}

export function isAudioUnlocked() {
  return unlocked && !!ctx && ctx.state === 'running';
}

/** Debug helpers for the running page. */
export function audioDebug() {
  return {
    unlocked,
    muted,
    state: ctx ? ctx.state : 'none',
    pending: pending.length,
    sampleRate: ctx ? ctx.sampleRate : 0,
  };
}

export function startMusic() {}
export function stopMusic() {}

/** Confirm tick — mid beep phones can actually reproduce. */
function playUnlockTick() {
  if (!ctx || ctx.state !== 'running' || muted) return;
  const t = now();
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(880, t);
  o.frequency.exponentialRampToValueAtTime(440, t + 0.08);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.45, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  o.connect(g);
  g.connect(sfxGain);
  o.start(t);
  o.stop(t + 0.14);
}

/** Cue tip strike. */
export function playCueStrike(power01) {
  whenRunning(() => {
    const p = Math.max(0.08, Math.min(1, power01));
    const t = now();

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220 + p * 80, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.12);

    const noise = ctx.createBufferSource();
    noise.buffer = getNoise();
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 900 + p * 400;
    nf.Q.value = 0.8;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.8, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);

    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.55, t + 0.002);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);

    osc.connect(g);
    g.connect(sfxGain);
    noise.connect(nf);
    nf.connect(ng);
    ng.connect(sfxGain);

    osc.start(t);
    osc.stop(t + 0.16);
    noise.start(t);
    noise.stop(t + 0.08);
  });
}

/**
 * Ball–ball crack — mid-range so laptop/phone speakers hear it.
 * (Prior version lived at 3kHz+ and was effectively silent on many devices.)
 */
export function playBallHit(impactSpeed) {
  const tMs = performance.now();
  if (tMs - lastBallAt < 12) return;
  lastBallAt = tMs;

  const speed = Number(impactSpeed) || 40;
  const s = Math.max(0.35, Math.min(1, speed / 50));

  whenRunning(() => {
    const t = now();

    // Layer A: hard snap in the 700–1400 Hz phone-speaker band
    const snap = ctx.createOscillator();
    snap.type = 'square';
    snap.frequency.setValueAtTime(1100 + s * 400, t);
    snap.frequency.exponentialRampToValueAtTime(320, t + 0.06);
    const snapF = ctx.createBiquadFilter();
    snapF.type = 'lowpass';
    snapF.frequency.value = 2400;
    const snapG = ctx.createGain();
    snapG.gain.setValueAtTime(0.0001, t);
    snapG.gain.exponentialRampToValueAtTime(0.9 * s, t + 0.0015);
    snapG.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    snap.connect(snapF);
    snapF.connect(snapG);
    snapG.connect(sfxGain);

    // Layer B: noise crack (mid, not ultra-high)
    const crack = ctx.createBufferSource();
    crack.buffer = getNoise();
    const crackF = ctx.createBiquadFilter();
    crackF.type = 'bandpass';
    crackF.frequency.value = 1400 + s * 600;
    crackF.Q.value = 1.1;
    const crackG = ctx.createGain();
    crackG.gain.setValueAtTime(0.0001, t);
    crackG.gain.exponentialRampToValueAtTime(1.0 * s, t + 0.001);
    crackG.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
    crack.connect(crackF);
    crackF.connect(crackG);
    crackG.connect(sfxGain);

    // Layer C: low knock for weight
    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(220 + s * 80, t);
    body.frequency.exponentialRampToValueAtTime(100, t + 0.08);
    const bodyG = ctx.createGain();
    bodyG.gain.setValueAtTime(0.0001, t);
    bodyG.gain.exponentialRampToValueAtTime(0.65 * s, t + 0.002);
    bodyG.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    body.connect(bodyG);
    bodyG.connect(sfxGain);

    snap.start(t);
    snap.stop(t + 0.08);
    crack.start(t);
    crack.stop(t + 0.07);
    body.start(t);
    body.stop(t + 0.12);
  });
}

/** Rail thud. */
export function playCushion(impactSpeed) {
  const tMs = performance.now();
  if (tMs - lastCushionAt < 28) return;
  lastCushionAt = tMs;
  const speed = Number(impactSpeed) || 30;
  const s = Math.max(0.3, Math.min(1, speed / 70));

  whenRunning(() => {
    const t = now();
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160 + s * 50, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.18);

    const noise = ctx.createBufferSource();
    noise.buffer = getNoise();
    const nf = ctx.createBiquadFilter();
    nf.type = 'lowpass';
    nf.frequency.value = 500;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.7 * s, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);

    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.45 * s, t + 0.002);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);

    osc.connect(g);
    g.connect(sfxGain);
    noise.connect(nf);
    nf.connect(ng);
    ng.connect(sfxGain);

    osc.start(t);
    osc.stop(t + 0.22);
    noise.start(t);
    noise.stop(t + 0.12);
  });
}

/** Pocket drop. */
export function playPocket() {
  whenRunning(() => {
    const t = now();
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.6, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(g);
    g.connect(sfxGain);
    osc.start(t);
    osc.stop(t + 0.38);
  });
}

/** Drive SFX from a physics step’s event bag. */
export function playPhysics(events) {
  if (!events || !unlocked || muted) return;
  if (events.ballHits > 0) {
    playBallHit(events.ballImpact > 0 ? events.ballImpact : 40);
  }
  if (events.cushionHits > 0) {
    playCushion(events.cushionImpact > 0 ? events.cushionImpact : 30);
  }
  if (events.pocketed && events.pocketed.length) {
    for (let i = 0; i < events.pocketed.length; i++) playPocket();
  }
}

// Expose for quick console checks on the live page.
if (typeof window !== 'undefined') {
  window.__breakAudio = {
    unlock: unlockAudio,
    hit: () => playBallHit(80),
    debug: audioDebug,
  };
}
