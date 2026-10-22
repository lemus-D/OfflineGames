/* Boot, menu, HUD, frame loop. */

import { Input } from './core/input.js';
import { Save } from './core/save.js';
import { Audio } from './core/audio.js';
import { PlaySession } from './game/play.js';
import { LEVELS, formatTime, TILE } from './game/content.js';
import {
  drawSky,
  drawLevel,
  drawPickle,
  drawBrine,
  drawFx,
  drawFlash,
  drawMenuGround,
} from './game/draw.js';

const canvas = document.getElementById('stage');
const g = canvas.getContext('2d', { alpha: false, desynchronized: true });
const input = new Input();
const audio = new Audio();

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
const SCALE = 3;

const els = {
  menu: document.getElementById('menu'),
  hud: document.getElementById('hud'),
  summary: document.getElementById('summary'),
  levelVal: document.getElementById('levelVal'),
  deathVal: document.getElementById('deathVal'),
  timeVal: document.getElementById('timeVal'),
  hintVal: document.getElementById('hintVal'),
  bestTime: document.getElementById('bestTime'),
  bestDeaths: document.getElementById('bestDeaths'),
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
  g.fillStyle = '#5BA8E8';
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
  if (els.bestTime) els.bestTime.textContent = formatTime(profile.bestClearTime);
  if (els.bestDeaths) {
    els.bestDeaths.textContent =
      profile.fewestDeaths == null ? '—' : String(profile.fewestDeaths);
  }
}

function armAudio() {
  audio.init();
  audio.resume();
}

function startRun() {
  armAudio();
  audio.click();
  const seed = (Date.now() ^ (performance.now() * 1000)) >>> 0;
  session = new PlaySession(seed, {
    onWin(sum) {
      endCampaign(sum);
    },
  });
  profile.runs += 1;
  Save.writeProfile(profile);
  state = 'playing';
  hide(els.menu);
  hide(els.summary);
  show(els.hud);
}

function endCampaign(sum) {
  const time = sum.time;
  const deaths = sum.deaths;
  profile.clears += 1;
  profile.totalDeaths += deaths;

  let near = '';
  if (profile.bestClearTime == null || time < profile.bestClearTime) {
    near = profile.bestClearTime == null
      ? 'First jar escape!'
      : `New best — beat old by ${formatTime(profile.bestClearTime - time)}`;
    profile.bestClearTime = time;
  } else {
    near = `${formatTime(time - profile.bestClearTime)} shy of your best`;
  }
  if (profile.fewestDeaths == null || deaths < profile.fewestDeaths) {
    near += profile.fewestDeaths == null
      ? ''
      : ` · fewer deaths than best (${profile.fewestDeaths})`;
    profile.fewestDeaths = deaths;
  } else if (profile.fewestDeaths != null) {
    near += ` · ${deaths - profile.fewestDeaths} more deaths than best`;
  }
  Save.writeProfile(profile);

  state = 'summary';
  hide(els.hud);
  els.summaryBody.innerHTML = `
    <p class="reason">You escaped the jar.</p>
    <div class="stat-grid">
      <div><span>Time</span><b>${formatTime(time)}</b></div>
      <div><span>Deaths</span><b>${deaths}</b></div>
      <div><span>Best time</span><b>${formatTime(profile.bestClearTime)}</b></div>
      <div><span>Fewest deaths</span><b>${profile.fewestDeaths}</b></div>
    </div>
    <p class="muted">${near}</p>
  `;
  show(els.summary);
}

function updateHud() {
  if (!session) return;
  if (els.levelVal) {
    els.levelVal.textContent = `${session.levelIndex + 1}/${LEVELS.length} · ${session.level.name}`;
  }
  if (els.deathVal) els.deathVal.textContent = String(session.deaths);
  if (els.timeVal) els.timeVal.textContent = formatTime(session.campaignTime);
  if (els.hintVal) {
    if (session.status === 'dead') {
      els.hintVal.textContent = `Ouch (${session.deathReason}). R or wait to retry.`;
    } else if (session.status === 'cleared') {
      els.hintVal.textContent = 'Level clear!';
    } else {
      els.hintVal.textContent = session.level.hint;
    }
  }
}

function drainAudio() {
  if (!session) return;
  for (const e of session.drainEvents()) {
    if (e.kind === 'jump') audio.jump();
    else if (e.kind === 'spring') audio.spring();
    else if (e.kind === 'vanish') audio.vanish();
    else if (e.kind === 'die') audio.die();
    else if (e.kind === 'clear') audio.clear();
  }
}

function cameraFor(s) {
  const viewW = W / SCALE;
  const viewH = H / SCALE;
  const levelW = s.level.w * TILE;
  const levelH = s.level.h * TILE;
  const maxCamX = Math.max(0, levelW - viewW);
  let camX = s.player.x - viewW * 0.35;
  camX = Math.max(0, Math.min(camX, maxCamX));

  // Pin the level floor to the bottom of the screen.
  // Short levels use a negative camY so ground isn't floating mid-view.
  let camY;
  if (levelH <= viewH) {
    camY = levelH - viewH;
  } else {
    const maxCamY = levelH - viewH;
    camY = s.player.y - viewH * 0.62;
    camY = Math.max(0, Math.min(camY, maxCamY));
  }
  if (s.shake > 0) {
    camX += Math.sin(animTime * 70) * s.shake * 6;
    camY += Math.cos(animTime * 55) * s.shake * 4;
    camX = Math.max(0, Math.min(camX, maxCamX));
    if (levelH > viewH) {
      camY = Math.max(0, Math.min(camY, levelH - viewH));
    } else {
      camY = levelH - viewH;
    }
  }
  return { camX, camY, viewW, viewH };
}

function drawSession(playing) {
  const s = session;
  clearFrame();
  const { camX, camY, viewW, viewH } = cameraFor(s);

  drawSky(g, W, H, camX, animTime);
  drawLevel(g, s.level, camX, camY, SCALE, animTime, viewW, viewH);
  if (s.brineActive) {
    drawBrine(g, s.brineY, camX, camY, SCALE, W, H, animTime);
  }
  drawPickle(g, s.player, camX, camY, SCALE, s.status === 'dead');
  drawFx(g, s.fx, camX, camY, SCALE);
  drawFlash(g, W, H, s.flash);

  if (playing) updateHud();
}

function drawMenuBackdrop() {
  clearFrame();
  drawSky(g, W, H, animTime * 20, animTime);
  drawMenuGround(g, W, H, 3);
  const walking = Math.sin(animTime * 3) > -0.2;
  const demo = {
    x: 100 + Math.sin(animTime * 0.7) * 30,
    y: H / 3 - 24 - (walking ? 0 : Math.abs(Math.sin(animTime * 5)) * 28),
    vx: walking ? 80 : 0,
    vy: walking ? 0 : -200,
    facing: 1,
    onGround: walking,
    walkCycle: animTime * 12,
    squish: 1 + Math.sin(animTime * 6) * 0.06,
    anim: animTime,
  };
  drawPickle(g, demo, 0, 0, 4, false);
}

function frame(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min(0.05, (ts - lastTs) / 1000);
  lastTs = ts;
  animTime += dt;

  if (state === 'menu') {
    drawMenuBackdrop();
  } else if (session) {
    if (state === 'playing') {
      session.step(dt, input.controls());
      drainAudio();
    }
    drawSession(state === 'playing' || state === 'summary');
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
  session = null;
  refreshMenuMeta();
});

addEventListener('keydown', (e) => {
  if (e.code === 'Enter' && state === 'menu') startRun();
  if (e.code === 'Enter' && state === 'summary') startRun();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

refreshMenuMeta();
resize();
show(els.menu);
hide(els.hud);
hide(els.summary);
requestAnimationFrame(frame);
