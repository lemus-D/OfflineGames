/* Boot, menu, HUD, frame loop. */

import { Input } from './core/input.js';
import { Save } from './core/save.js';
import { PlaySession } from './game/play.js';
import { drawWorld, drawSky, drawPath, drawRabbit, drawFox, drawCarrot } from './game/draw.js';

const canvas = document.getElementById('stage');
const g = canvas.getContext('2d', { alpha: false, desynchronized: true });
const input = new Input();

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

const els = {
  menu: document.getElementById('menu'),
  hud: document.getElementById('hud'),
  summary: document.getElementById('summary'),
  score: document.getElementById('scoreVal'),
  dist: document.getElementById('distVal'),
  carrots: document.getElementById('carrotVal'),
  gap: document.getElementById('gapVal'),
  best: document.getElementById('bestVal'),
  bestDist: document.getElementById('bestDistVal'),
  summaryBody: document.getElementById('summaryBody'),
  btnPlay: document.getElementById('btnPlay'),
  btnAgain: document.getElementById('btnAgain'),
  btnMenu: document.getElementById('btnMenu'),
  touch: document.getElementById('touch'),
};

function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = canvas.clientWidth;
  H = canvas.clientHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.imageSmoothingEnabled = true;
}
addEventListener('resize', resize);

function clearFrame() {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#1a2e1a';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function show(el) {
  el.classList.remove('hidden');
}
function hide(el) {
  el.classList.add('hidden');
}

function refreshMenuMeta() {
  if (els.best) els.best.textContent = String(profile.bestScore);
  if (els.bestDist) els.bestDist.textContent = String(profile.bestDistance);
}

function startRun() {
  const seed = (Date.now() ^ (performance.now() * 1000)) >>> 0;
  session = new PlaySession(seed, {
    onDeath() {
      endRun();
    },
  });
  // Demo / tooling hook — not part of save schema.
  globalThis.__rabbitSession = session;
  globalThis.__rabbitState = () => state;
  state = 'playing';
  hide(els.menu);
  hide(els.summary);
  show(els.hud);
  show(els.touch);
}

function endRun() {
  if (!session) return;
  const sum = session.summary();
  profile.runs += 1;
  profile.totalCarrots += sum.carrots;
  profile.bestScore = Math.max(profile.bestScore, sum.score);
  profile.bestDistance = Math.max(profile.bestDistance, sum.distance);
  profile.bestCarrots = Math.max(profile.bestCarrots, sum.carrots);
  Save.writeProfile(profile);

  state = 'summary';
  hide(els.hud);
  hide(els.touch);
  const reason =
    sum.reason === 'fox'
      ? 'The fox caught you.'
      : 'You tripped on the trail.';
  els.summaryBody.innerHTML = `
    <p class="reason">${reason}</p>
    <div class="stat-grid">
      <div><span>Score</span><b>${sum.score}</b></div>
      <div><span>Distance</span><b>${sum.distance}m</b></div>
      <div><span>Carrots</span><b>${sum.carrots}</b></div>
      <div><span>Best</span><b>${profile.bestScore}</b></div>
    </div>
    <p class="muted">Runs: ${profile.runs} · Lifetime carrots: ${profile.totalCarrots}</p>
  `;
  show(els.summary);
}

function updateHud() {
  if (!session) return;
  if (els.score) els.score.textContent = String(session.score);
  if (els.dist) els.dist.textContent = `${Math.floor(session.distance)}m`;
  if (els.carrots) els.carrots.textContent = String(session.carrots);
  if (els.gap) {
    const pct = Math.round((session.foxGap / 6.5) * 100);
    els.gap.textContent = `${Math.max(0, pct)}%`;
    els.gap.classList.toggle('danger', session.foxGap < 2.5);
  }
}

function drawMenuBackdrop(dt) {
  clearFrame();
  drawSky(g, W, H);
  drawPath(g, W, H, animTime * 6, animTime);
  drawCarrot(g, W * 0.22, H * 0.55, 1.2, animTime);
  drawCarrot(g, W * 0.78, H * 0.48, 0.9, animTime + 1);
  drawFox(g, W * 0.28, H * 0.78, 1.1, animTime * 4, true);
  drawRabbit(g, W * 0.62, H * 0.72, 1.25, animTime * 5, 0);
  void dt;
}

function frame(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min(0.05, (ts - lastTs) / 1000);
  lastTs = ts;
  animTime += dt;

  if (state === 'menu' || state === 'summary') {
    drawMenuBackdrop(dt);
  } else if (session) {
    if (state === 'playing') {
      session.step(dt, input.controls());
      updateHud();
    }
    clearFrame();
    drawWorld(g, W, H, session, animTime);
  }

  input.endFrame();
  requestAnimationFrame(frame);
}

els.btnPlay.addEventListener('click', startRun);
els.btnAgain.addEventListener('click', startRun);
els.btnMenu.addEventListener('click', () => {
  hide(els.summary);
  show(els.menu);
  state = 'menu';
  refreshMenuMeta();
});

// On-screen touch controls.
document.getElementById('btnLeft')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  input.queueLane(-1);
});
document.getElementById('btnRight')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  input.queueLane(1);
});
document.getElementById('btnJump')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  input.queueJump();
});

// Swipe gestures on canvas.
let touchStart = null;
canvas.addEventListener(
  'touchstart',
  (e) => {
    if (state !== 'playing') return;
    const t = e.changedTouches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  },
  { passive: true }
);
canvas.addEventListener(
  'touchend',
  (e) => {
    if (!touchStart || state !== 'playing') return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) {
      input.queueJump();
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) {
      input.queueLane(dx > 0 ? 1 : -1);
    } else if (dy < 0) {
      input.queueJump();
    }
  },
  { passive: true }
);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

refreshMenuMeta();
resize();
show(els.menu);
hide(els.hud);
hide(els.summary);
hide(els.touch);
requestAnimationFrame(frame);
