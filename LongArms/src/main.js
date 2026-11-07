/* Boot, menus, HUD, frame loop for LongArms. */

import { Input } from './core/input.js';
import { Save } from './core/save.js';
import { Audio } from './core/audio.js';
import { PlaySession } from './game/play.js';
import { MATCH } from './game/content.js';
import {
  camera,
  drawBackground,
  drawHoop,
  drawGuy,
  drawBall,
  drawParticles,
  drawJumpPad,
  drawMoveHint,
} from './game/draw.js';

const canvas = document.getElementById('stage');
const g = canvas.getContext('2d', { alpha: false, desynchronized: true });
const input = new Input(canvas);
const audio = new Audio();

let W = 0;
let H = 0;
let dpr = 1;
let profile = Save.loadProfile();

/** @type {'menu'|'playing'|'summary'} */
let state = 'menu';
/** @type {PlaySession|null} */
let session = null;
let lastTs = 0;
let showTouch = false;

const els = {
  menu: document.getElementById('menu'),
  hud: document.getElementById('hud'),
  summary: document.getElementById('summary'),
  scoreYou: document.getElementById('scoreYou'),
  scoreThem: document.getElementById('scoreThem'),
  clock: document.getElementById('clockVal'),
  best: document.getElementById('bestVal'),
  wins: document.getElementById('winsVal'),
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
}
addEventListener('resize', resize);

function clearFrame() {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.fillStyle = '#7ec8c4';
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
  if (els.best) els.best.textContent = String(profile.bestScore || 0);
  if (els.wins) els.wins.textContent = String(profile.wins || 0);
}

function startGame() {
  audio.init();
  audio.resume();
  audio.click();
  session = new PlaySession((Date.now() ^ (profile.runs * 9973)) >>> 0);
  state = 'playing';
  hide(els.menu);
  hide(els.summary);
  show(els.hud);
  updateHud();
}

function endGame() {
  const sum = session.summary;
  if (!sum) return;
  profile.runs = (profile.runs || 0) + 1;
  if (sum.you > (profile.bestScore || 0)) profile.bestScore = sum.you;
  if (sum.won) profile.wins = (profile.wins || 0) + 1;
  Save.writeProfile(profile);
  refreshMenuMeta();

  state = 'summary';
  hide(els.hud);
  show(els.summary);
  const title = sum.won ? 'You win!' : 'Noodle wins';
  els.summaryBody.innerHTML = `
    <p class="sum-title">${title}</p>
    <p class="sum-score">${sum.you} – ${sum.them}</p>
    <p class="sum-near">${sum.nearMiss}</p>
    <p class="sum-meta">Your points this match: <strong>${sum.you}</strong> · Best: ${profile.bestScore}</p>
  `;
  if (sum.won) audio.win();
  else audio.lose();
}

function updateHud() {
  if (!session) return;
  els.scoreYou.textContent = String(session.scoreHuman);
  els.scoreThem.textContent = String(session.scoreAi);
  const clock = session.ball.holder ? Math.ceil(Math.max(0, session.shotClock)) : '—';
  els.clock.textContent = String(clock);
  els.clock.classList.toggle('warn', session.ball.holder && session.shotClock <= MATCH.shotClockWarn);
}

function handleEvents(events) {
  for (const e of events) {
    switch (e.kind) {
      case 'jump':
        audio.jump();
        break;
      case 'throw':
        audio.throw();
        break;
      case 'score':
        audio.score();
        break;
      case 'bounce':
        audio.bounce();
        break;
      case 'steal':
        audio.steal();
        break;
      case 'pickup':
        audio.pickup();
        break;
      case 'clock_warn':
        audio.clockWarn();
        break;
      case 'turnover':
        audio.turnover();
        break;
      default:
        break;
    }
  }
}

function frame(ts) {
  const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
  lastTs = ts;

  clearFrame();
  const cam = camera(W, H);

  if (state === 'menu') {
    drawBackground(g, W, H, cam, 7);
    drawHoop(g, cam);
  } else if (state === 'playing' && session) {
    const controls = input.controls();
    session.step(dt, controls);
    const events = session.drainEvents();
    handleEvents(events);
    updateHud();

    const pose = session.renderPose();
    drawBackground(g, W, H, cam, session.seed);
    drawHoop(g, cam);
    drawGuy(g, cam, session.ai, { ...session.ai, ...pose.ai }, session.ball.holder === 'ai');
    drawGuy(g, cam, session.human, { ...session.human, ...pose.human }, session.ball.holder === 'human');
    drawBall(g, cam, pose.ball);
    drawParticles(g, cam, session.particles);

    if (showTouch) {
      const pad = drawJumpPad(g, W, H);
      input.setJumpPad(pad.x, pad.y, pad.w, pad.h);
      drawMoveHint(g, W, H);
    }

    if (session.over) endGame();
  } else if (state === 'summary' && session) {
    drawBackground(g, W, H, cam, session.seed);
    drawHoop(g, cam);
  }

  input.endFrame();
  requestAnimationFrame(frame);
}

els.btnPlay?.addEventListener('click', startGame);
els.btnAgain?.addEventListener('click', startGame);
els.btnMenu?.addEventListener('click', () => {
  audio.click();
  state = 'menu';
  session = null;
  hide(els.summary);
  hide(els.hud);
  show(els.menu);
  refreshMenuMeta();
});

addEventListener('keydown', (e) => {
  if (e.code === 'Enter' || e.code === 'Space') {
    if (state === 'menu') startGame();
    else if (state === 'summary') startGame();
  }
});

function refreshTouchChrome() {
  showTouch =
    matchMedia('(pointer: coarse)').matches ||
    'ontouchstart' in window ||
    (canvas.clientWidth > 0 && canvas.clientWidth < 700);
}
refreshTouchChrome();
matchMedia('(pointer: coarse)').addEventListener?.('change', refreshTouchChrome);
addEventListener('resize', refreshTouchChrome);

refreshMenuMeta();
resize();
show(els.menu);
hide(els.hud);
hide(els.summary);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

requestAnimationFrame(frame);
