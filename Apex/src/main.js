/* Boot, menu, HUD, frame loop. */

import { Input } from './core/input.js';
import { Save } from './core/save.js';
import { clamp } from './core/rng.js';
import { PlaySession } from './game/play.js';
import { tiltDegrees } from './game/content.js';
import {
  drawSky,
  drawPickup,
  drawRocket,
  drawCollectFx,
  drawHitFlash,
  worldToScreen,
} from './game/draw.js';

const canvas = document.getElementById('stage');
const g = canvas.getContext('2d');
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
let menuAltitude = 0;

const els = {
  menu: document.getElementById('menu'),
  hud: document.getElementById('hud'),
  summary: document.getElementById('summary'),
  fuelFill: document.getElementById('fuelFill'),
  fuelVal: document.getElementById('fuelVal'),
  fuelGauge: document.getElementById('fuelGauge'),
  score: document.getElementById('scoreVal'),
  altitude: document.getElementById('altVal'),
  altTicks: document.getElementById('altTicks'),
  tiltHorizon: document.getElementById('tiltHorizon'),
  tiltVal: document.getElementById('tiltVal'),
  coins: document.getElementById('coinVal'),
  peak: document.getElementById('peakVal'),
  best: document.getElementById('bestVal'),
  bestAlt: document.getElementById('bestAltVal'),
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

function show(el) {
  el.classList.remove('hidden');
}
function hide(el) {
  el.classList.add('hidden');
}

function refreshMenuMeta() {
  els.best.textContent = String(profile.bestScore);
  els.bestAlt.textContent = String(profile.bestAltitude);
}

function startRun() {
  const seed = (Date.now() ^ (performance.now() * 1000)) >>> 0;
  session = new PlaySession(seed, {
    onDeath() {
      endRun();
    },
  });
  state = 'playing';
  hide(els.menu);
  hide(els.summary);
  show(els.hud);
}

function endRun() {
  if (!session) return;
  const sum = session.summary();
  profile.runs += 1;
  profile.totalCoins += sum.coins;
  profile.bestScore = Math.max(profile.bestScore, sum.score);
  profile.bestAltitude = Math.max(profile.bestAltitude, sum.altitude);
  profile.bestCoins = Math.max(profile.bestCoins, sum.coins);
  Save.writeProfile(profile);

  state = 'summary';
  hide(els.hud);
  const reason =
    sum.reason === 'meteor'
      ? 'A meteor drained your tanks. You fell.'
      : sum.reason === 'fuel'
        ? 'Out of fuel. Free fall.'
        : 'Slammed into the ground.';
  els.summaryBody.innerHTML = `
    <p class="reason">${reason}</p>
    <div class="stat-grid">
      <div><span>Score</span><b>${sum.score}</b></div>
      <div><span>Altitude</span><b>${sum.altitude}</b></div>
      <div><span>Coins</span><b>${sum.coins}</b></div>
      <div><span>Best</span><b>${profile.bestScore}</b></div>
    </div>
    <p class="muted">Runs: ${profile.runs} · Lifetime coins: ${profile.totalCoins}</p>
  `;
  show(els.summary);
}

function drawSession(dt, playing) {
  const s = session;
  const p = s.player;
  const camY = p.y;

  if (playing) s.step(dt, input.controls());

  g.imageSmoothingEnabled = false;
  drawSky(g, W, H, p.y, animTime);

  for (const u of s.pickups) {
    const scr = worldToScreen(u.x, u.y, camY, W, H);
    if (scr.y < -80 || scr.y > H + 80) continue;
    drawPickup(g, u.kind, scr.x, scr.y, u.r * scr.scale, u.spin, animTime);
  }

  for (const fx of s.collectFx) drawCollectFx(g, fx, camY, W, H, animTime);

  const rocketScr = worldToScreen(p.x, p.y, camY, W, H);
  drawRocket(
    g,
    rocketScr.x,
    rocketScr.y,
    rocketScr.scale * 0.85,
    p.tilt,
    animTime,
    playing ? p.thrusting : p.alive
  );

  drawHitFlash(g, W, H, s.flash);

  if (playing) updateGauges(s);
}

function updateGauges(s) {
  const p = s.player;
  const fuelPct = clamp(p.fuel, 0, 1);
  if (els.fuelFill) els.fuelFill.style.height = `${fuelPct * 100}%`;
  if (els.fuelVal) els.fuelVal.textContent = `${Math.round(fuelPct * 100)}%`;
  if (els.fuelGauge) els.fuelGauge.classList.toggle('low', fuelPct < 0.28);

  const alt = Math.max(0, Math.floor(p.y));
  if (els.altitude) els.altitude.textContent = String(alt);
  // Scroll the tape so current altitude sits on the yellow needle.
  if (els.altTicks) {
    const pxPerUnit = 0.12;
    els.altTicks.style.transform = `translateY(${-((alt * pxPerUnit) % 10)}px)`;
  }

  const deg = tiltDegrees(p.tilt);
  if (els.tiltVal) els.tiltVal.textContent = `${deg}°`;
  // Horizon rolls opposite the rocket so the wing mark reads as attitude.
  if (els.tiltHorizon) els.tiltHorizon.style.transform = `rotate(${-p.tilt}rad)`;

  if (els.score) els.score.textContent = String(s.score);
  if (els.coins) els.coins.textContent = String(s.coins);
  if (!els.peak) els.peak = document.getElementById('peakVal');
  if (els.peak) els.peak.textContent = String(Math.floor(p.peakY));
}

function drawMenuBackdrop(dt) {
  menuAltitude += dt * 40;
  g.imageSmoothingEnabled = false;
  drawSky(g, W, H, menuAltitude, animTime);
  const x = W * 0.62 + Math.sin(animTime * 0.7) * 18;
  const y = H * 0.52 + Math.sin(animTime * 1.1) * 10;
  const thrusting = Math.sin(animTime * 3) > -0.2;
  drawRocket(g, x, y, 2.4, Math.sin(animTime) * 0.25, animTime, thrusting);
  drawPickup(g, 'fuel', W * 0.78, H * 0.28, 22, animTime, animTime);
  drawPickup(g, 'coin', W * 0.22, H * 0.38, 16, -animTime * 1.4, animTime);
  drawPickup(g, 'meteor', W * 0.85, H * 0.68, 24, animTime * 0.8, animTime);
}

function frame(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min(0.05, (ts - lastTs) / 1000);
  lastTs = ts;
  animTime += dt;

  if (state === 'menu' || state === 'summary') {
    drawMenuBackdrop(dt);
  } else if (session) {
    drawSession(dt, state === 'playing');
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

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

refreshMenuMeta();
resize();
show(els.menu);
hide(els.hud);
hide(els.summary);
requestAnimationFrame(frame);
