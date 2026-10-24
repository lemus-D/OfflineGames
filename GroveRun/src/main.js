/* Boot, menus, frame loop, DOM HUD, SW registration. */

import { Input } from './core/input.js';
import { Save } from './core/save.js';
import { Audio } from './core/audio.js';
import { PlaySession } from './game/play.js';
import { drawFrame } from './game/draw.js';

const canvas = document.getElementById('stage');
const g = canvas.getContext('2d', { alpha: false, desynchronized: true });
const input = new Input(canvas);
const audio = new Audio();

let W = 0,
  H = 0,
  dpr = 1;
let profile = Save.loadProfile();

/** @type {'menu'|'playing'|'summary'} */
let state = 'menu';
/** @type {PlaySession|null} */
let session = null;
let animTime = 0;
let lastTs = 0;
let hudAccum = 0;
const HUD_DT = 1 / 12;

const els = {
  menu: document.getElementById('menu'),
  hud: document.getElementById('hud'),
  summary: document.getElementById('summary'),
  score: document.getElementById('scoreVal'),
  dist: document.getElementById('distVal'),
  carrots: document.getElementById('carrotVal'),
  fox: document.getElementById('foxVal'),
  best: document.getElementById('bestVal'),
  summaryBody: document.getElementById('summaryBody'),
  btnPlay: document.getElementById('btnPlay'),
  btnAgain: document.getElementById('btnAgain'),
  btnMenu: document.getElementById('btnMenu'),
};

function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = canvas.clientWidth;
  H = canvas.clientHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.imageSmoothingEnabled = false;
}
addEventListener('resize', resize);

function clearFrame() {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#0e1522';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.imageSmoothingEnabled = false;
}

function show(el) {
  el.classList.remove('hidden');
}
function hide(el) {
  el.classList.add('hidden');
}

function refreshMenuMeta() {
  if (els.best) els.best.textContent = String(profile.bestScore);
}

function startRun() {
  audio.init();
  audio.resume();
  audio.click();
  const seed = (Date.now() ^ (performance.now() * 1000)) >>> 0;
  session = new PlaySession(seed, {
    onDeath() {
      endRun();
    },
  });
  hudAccum = HUD_DT;
  state = 'playing';
  hide(els.menu);
  hide(els.summary);
  show(els.hud);
}

function endRun() {
  if (!session) return;
  const sum = session.summary();
  profile.runs += 1;
  profile.bestScore = Math.max(profile.bestScore, sum.score);
  profile.bestDistance = Math.max(profile.bestDistance, sum.distance);
  profile.bestCarrots = Math.max(profile.bestCarrots, sum.carrots);
  Save.writeProfile(profile);

  const reason =
    sum.reason === 'fox'
      ? 'The fox caught you.'
      : sum.reason === 'obstacle'
        ? 'You hit a rock hard.'
        : 'Run over.';
  const near =
    sum.reason === 'fox'
      ? 'So close — one more clean dodge.'
      : `Fox was still ${sum.foxGap} back.`;

  state = 'summary';
  hide(els.hud);
  els.summaryBody.innerHTML = `
    <p class="reason">${reason}</p>
    <div class="stat-grid">
      <div><span>Score</span><b>${sum.score}</b></div>
      <div><span>Distance</span><b>${sum.distance}</b></div>
      <div><span>Carrots</span><b>${sum.carrots}</b></div>
      <div><span>Best</span><b>${profile.bestScore}</b></div>
    </div>
    <p class="muted">${near}</p>
  `;
  show(els.summary);
  refreshMenuMeta();
}

function drainAudio() {
  if (!session) return;
  for (const ev of session.drainEvents()) {
    if (ev.kind === 'lane') audio.lane();
    else if (ev.kind === 'jump') audio.jump();
    else if (ev.kind === 'carrot') audio.carrot();
    else if (ev.kind === 'hit') audio.hit();
    else if (ev.kind === 'threat') audio.threat();
    else if (ev.kind === 'die') audio.die();
  }
}

function updateHud() {
  if (!session || !els.score) return;
  els.score.textContent = String(session.score);
  if (els.dist) els.dist.textContent = String(Math.floor(session.distance));
  if (els.carrots) els.carrots.textContent = String(session.carrots);
  if (els.fox) {
    const gap = Math.floor(session.foxGap);
    els.fox.textContent = String(gap);
    els.fox.dataset.threat = session.foxThreat > 0.55 ? '1' : '0';
  }
}

els.btnPlay?.addEventListener('click', () => startRun());
els.btnAgain?.addEventListener('click', () => startRun());
els.btnMenu?.addEventListener('click', () => {
  audio.init();
  audio.click();
  state = 'menu';
  session = null;
  hide(els.summary);
  hide(els.hud);
  show(els.menu);
  refreshMenuMeta();
});

function frame(ts) {
  const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
  lastTs = ts;
  animTime += dt;

  clearFrame();

  if (state === 'menu') {
    // Idle attract: fake session pose without mutating profile.
    drawAttract(dt);
  } else if (state === 'playing' && session) {
    const controls = input.controls();
    session.step(dt, controls);
    drainAudio();
    hudAccum += dt;
    if (hudAccum >= HUD_DT) {
      hudAccum = 0;
      updateHud();
    }
    drawFrame(g, W, H, session, animTime);
  } else if (state === 'summary' && session) {
    drawFrame(g, W, H, session, animTime);
  }

  input.endFrame();
  requestAnimationFrame(frame);
}

let attract = null;
function drawAttract(dt) {
  if (!attract) {
    attract = new PlaySession(2026);
  }
  // Slow auto demo — no death hook.
  attract.hooks = {};
  if (attract.player.alive) {
    attract.step(dt * 0.5, { laneDelta: 0, jump: false });
  } else {
    attract = new PlaySession((attract.seed + 17) >>> 0);
  }
  drawFrame(g, W, H, attract, animTime);
}

refreshMenuMeta();
resize();
requestAnimationFrame(frame);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
