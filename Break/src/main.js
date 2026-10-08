/* Boot, menu, HUD, frame loop for Break. */

import { CueInput, EnglishDial } from './core/input.js';
import { Save } from './core/save.js';
import { clamp } from './core/rng.js';
import { PHYSICS } from './game/content.js';
import { PlaySession } from './game/play.js';
import {
  fitView,
  drawTable,
  drawBall,
  drawCueAndAim,
  drawEnglishDial,
  drawKitchenHint,
  screenToTable,
  tableToScreen,
} from './game/draw.js';

const canvas = document.getElementById('stage');
const g = canvas.getContext('2d', { alpha: false, desynchronized: true });
const cueInput = new CueInput(canvas);

const spinCanvas = document.getElementById('spinDial');
const spinCtx = spinCanvas.getContext('2d');
const englishDial = new EnglishDial(spinCanvas, { maxEnglish: PHYSICS.maxEnglish });

// Block table aim while using the English dial.
spinCanvas.addEventListener('pointerdown', () => {
  cueInput.blocked = true;
});
addEventListener('pointerup', () => {
  cueInput.blocked = false;
});

let W = 0;
let H = 0;
let dpr = 1;
let profile = Save.loadProfile();

/** @type {'menu'|'playing'|'summary'} */
let state = 'menu';
/** @type {PlaySession|null} */
let session = null;
let animTime = 0;
let lastTs = 0;
/** Pending shot from a completed drag (applied next aiming frame). */
let pendingShot = null;

const els = {
  menu: document.getElementById('menu'),
  hud: document.getElementById('hud'),
  summary: document.getElementById('summary'),
  shots: document.getElementById('shotsVal'),
  left: document.getElementById('leftVal'),
  msg: document.getElementById('msgVal'),
  best: document.getElementById('bestVal'),
  clears: document.getElementById('clearsVal'),
  summaryBody: document.getElementById('summaryBody'),
  btnPlay: document.getElementById('btnPlay'),
  btnAgain: document.getElementById('btnAgain'),
  btnMenu: document.getElementById('btnMenu'),
  btnReset: document.getElementById('btnReset'),
  spinPanel: document.getElementById('spinPanel'),
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
  const bg = g.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, '#1a2a1e');
  bg.addColorStop(0.55, '#0c1810');
  bg.addColorStop(1, '#060c08');
  g.fillStyle = bg;
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
  if (els.best) {
    els.best.textContent = profile.bestShots > 0 ? String(profile.bestShots) : '—';
  }
  if (els.clears) els.clears.textContent = String(profile.clears || 0);
}

function startRun() {
  const seed = (Date.now() ^ (performance.now() * 1000)) >>> 0;
  session = new PlaySession(seed, {
    onClear() {
      endRun(true);
    },
  });
  pendingShot = null;
  englishDial.reset();
  cueInput.enabled = true;
  cueInput.reset();
  state = 'playing';
  hide(els.menu);
  hide(els.summary);
  show(els.hud);
  updateHud();
}

function endRun(cleared) {
  if (!session) return;
  const sum = session.summary();
  profile.runs += 1;
  profile.totalShots += sum.shots;
  profile.totalPocketed += sum.pocketed;
  if (cleared || sum.cleared) {
    profile.clears += 1;
    if (profile.bestShots === 0 || sum.shots < profile.bestShots) {
      profile.bestShots = sum.shots;
    }
    profile.bestClears = Math.max(profile.bestClears, 1);
  }
  Save.writeProfile(profile);

  state = 'summary';
  hide(els.hud);
  cueInput.enabled = false;
  const title = sum.cleared ? 'Rack cleared' : 'Walk away';
  els.summaryBody.innerHTML = `
    <p class="reason">${sum.cleared ? `Cleaned the table in ${sum.shots} shots.` : `Pocketed ${sum.pocketed} · ${sum.remaining} left.`}</p>
    <div class="stat-grid">
      <div><span>Shots</span><b>${sum.shots}</b></div>
      <div><span>Pocketed</span><b>${sum.pocketed}</b></div>
      <div><span>Scratches</span><b>${sum.scratches}</b></div>
      <div><span>Score</span><b>${sum.score}</b></div>
    </div>
    <p class="muted">Best clear: ${profile.bestShots || '—'} shots · Clears: ${profile.clears}</p>
  `;
  const h2 = els.summary.querySelector('h2');
  if (h2) h2.textContent = title;
  show(els.summary);
}

function updateHud() {
  if (!session) return;
  if (els.shots) els.shots.textContent = String(session.shots);
  if (els.left) els.left.textContent = String(session.remaining);
  if (els.msg) els.msg.textContent = session.message || ' ';
}

/**
 * Build screen-space aim for drawing / shooting.
 * Hover: aim cue → pointer. Dragging: pull-back vector sets aim + power.
 */
function resolveAim(view) {
  if (!session) return null;
  const aiming = session.phase === 'aiming' || session.phase === 'ballInHand';
  cueInput.enabled = aiming && state === 'playing';
  if (!aiming) {
    cueInput.lock();
    return null;
  }
  cueInput.unlock();

  if (session.phase === 'ballInHand') {
    const drag = cueInput.aimScreen();
    if (drag && drag.released) {
      const world = screenToTable(cueInput.cx, cueInput.cy, view);
      session.placeCue(world.x, world.y);
      cueInput.reset();
      updateHud();
    }
    return null;
  }

  // Keep cue screen pos fresh so pull-start can lock aim cue → pointer.
  if (session.cue) {
    cueInput.cueScreen = tableToScreen(session.cue.x, session.cue.y, view);
  }

  const drag = cueInput.aimScreen();
  if (drag && drag.pulling) {
    const power = clamp(
      (drag.powerPull - PHYSICS.minPullPx) / (PHYSICS.maxPullPx - PHYSICS.minPullPx),
      0,
      1
    );
    return {
      dx: drag.dx,
      dy: drag.dy,
      powerPull: drag.powerPull,
      power,
      pulling: true,
      released: false,
    };
  }

  if (drag && drag.released) {
    const power = clamp(
      (drag.powerPull - PHYSICS.minPullPx) / (PHYSICS.maxPullPx - PHYSICS.minPullPx),
      0,
      1
    );
    if (power >= 0.02 && (drag.dx !== 0 || drag.dy !== 0)) {
      pendingShot = {
        dx: drag.dx / view.scale,
        dy: drag.dy / view.scale,
        power,
        english: { ...englishDial.english },
      };
    }
    cueInput.reset();
    return null;
  }

  // Hover aim toward pointer.
  if (cueInput.hasPointer && session.cue) {
    const cueS = cueInput.cueScreen;
    const dx = cueInput.px - cueS.x;
    const dy = cueInput.py - cueS.y;
    if (Math.hypot(dx, dy) > 4) {
      const len = Math.hypot(dx, dy);
      cueInput.lockDx = dx / len;
      cueInput.lockDy = dy / len;
      return { dx, dy, powerPull: 0, power: 0, pulling: false, released: false };
    }
  }

  // Default aim toward the rack apex.
  return { dx: 80, dy: 0, powerPull: 0, power: 0, pulling: false, released: false };
}

function drawMenuBackdrop() {
  clearFrame();
  const view = fitView(W, H);
  if (!session) session = new PlaySession(42);
  drawTable(g, view, animTime);
  for (const b of session.balls) drawBall(g, b, view);
  // Resting cue preview aimed at the rack.
  if (session.cue) {
    drawCueAndAim(
      g,
      session.cue,
      session.balls,
      view,
      { dx: 90, dy: 0, powerPull: 0 },
      { x: 0, y: 0 },
      { pulling: false, power: 0 }
    );
  }
  g.save();
  g.globalAlpha = 0.07 + Math.sin(animTime * 1.1) * 0.025;
  g.fillStyle = '#d4c078';
  g.beginPath();
  g.arc(W * 0.72, H * 0.32, 100, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function drawPlay(dt) {
  const s = session;
  s.step(dt);
  if (pendingShot && s.phase === 'aiming') {
    s.shoot(pendingShot.dx, pendingShot.dy, pendingShot.power, pendingShot.english);
    pendingShot = null;
    // Fresh tip each stroke — don't leave last English armed.
    englishDial.reset();
  }

  clearFrame();
  const view = fitView(W, H);
  drawTable(g, view, animTime);

  if (s.phase === 'ballInHand') drawKitchenHint(g, view);

  for (const b of s.balls) {
    if (b.id !== 0) drawBall(g, b, view);
  }
  drawBall(g, s.cue, view);

  const aim = resolveAim(view);
  if (aim && s.phase === 'aiming') {
    drawCueAndAim(g, s.cue, s.balls, view, aim, englishDial.english, {
      pulling: aim.pulling,
      power: aim.power,
    });
  }

  drawEnglishDial(spinCtx, spinCanvas.width, englishDial.english, englishDial.hover || englishDial.dragging);
  updateHud();
}

function frame(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min(0.05, (ts - lastTs) / 1000);
  lastTs = ts;
  animTime += dt;

  if (state === 'menu') {
    if (!session || session.phase === 'won') session = new PlaySession(42);
    drawMenuBackdrop();
  } else if (state === 'summary') {
    clearFrame();
    const view = fitView(W, H);
    if (session) {
      drawTable(g, view, animTime);
      for (const b of session.balls) drawBall(g, b, view);
    }
  } else if (session) {
    drawPlay(dt);
  }

  requestAnimationFrame(frame);
}

els.btnPlay.addEventListener('click', () => {
  session = null;
  startRun();
});
els.btnAgain.addEventListener('click', () => {
  session = null;
  startRun();
});
els.btnMenu.addEventListener('click', () => {
  hide(els.summary);
  show(els.menu);
  state = 'menu';
  session = null;
  refreshMenuMeta();
});
if (els.btnReset) {
  els.btnReset.addEventListener('click', () => {
    if (state !== 'playing') return;
    endRun(false);
  });
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

refreshMenuMeta();
resize();
show(els.menu);
hide(els.hud);
hide(els.summary);
drawEnglishDial(spinCtx, spinCanvas.width, englishDial.english, false);
requestAnimationFrame(frame);
