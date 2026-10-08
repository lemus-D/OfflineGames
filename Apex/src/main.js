/* Boot, menu, HUD, frame loop. */

import { Input } from './core/input.js';
import { Save } from './core/save.js';
import { clamp } from './core/rng.js';
import { PlaySession } from './game/play.js';
import { tiltDegrees, ROCKET } from './game/content.js';
import {
  gameToKm,
  formatAltitudeKm,
  layerAtKm,
  nextCelestial,
  CELESTIAL,
} from './game/altitude.js';
import {
  UPGRADES,
  UPGRADE_IDS,
  nextCost,
  buyUpgrade,
  foldStats,
} from './game/upgrades.js';
import {
  drawSky,
  drawPickup,
  drawRocket,
  drawCollectFx,
  drawHitFlash,
  drawCelestials,
  drawFlybyBanner,
  drawLaunchPad,
  worldToScreen,
} from './game/draw.js';

const canvas = document.getElementById('stage');
// Opaque buffer — translucent canvases can composite prior frames (ghost trails).
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
let menuAltitude = 0;

/** @type {{ text: string, age: number, life: number }|null} */
let flyby = null;
const flybySeen = new Set();

const els = {
  menu: document.getElementById('menu'),
  hud: document.getElementById('hud'),
  summary: document.getElementById('summary'),
  fuelFill: document.getElementById('fuelFill'),
  fuelVal: document.getElementById('fuelVal'),
  fuelGauge: document.getElementById('fuelGauge'),
  healthFill: document.getElementById('healthFill'),
  healthVal: document.getElementById('healthVal'),
  healthGauge: document.getElementById('healthGauge'),
  score: document.getElementById('scoreVal'),
  altitude: document.getElementById('altVal'),
  layerVal: document.getElementById('layerVal'),
  altTicks: document.getElementById('altTicks'),
  tiltHorizon: document.getElementById('tiltHorizon'),
  tiltVal: document.getElementById('tiltVal'),
  velFill: document.getElementById('velFill'),
  velVal: document.getElementById('velVal'),
  velDir: document.getElementById('velDir'),
  velGauge: document.getElementById('velGauge'),
  coins: document.getElementById('coinVal'),
  peak: document.getElementById('peakVal'),
  nextBody: document.getElementById('nextBodyVal'),
  nextDist: document.getElementById('nextDistVal'),
  nextFill: document.getElementById('nextFill'),
  best: document.getElementById('bestVal'),
  bestAlt: document.getElementById('bestAltVal'),
  bank: document.getElementById('bankVal'),
  shop: document.getElementById('shop'),
  flybyMeta: document.getElementById('flybyMeta'),
  summaryBody: document.getElementById('summaryBody'),
  btnPlay: document.getElementById('btnPlay'),
  btnAgain: document.getElementById('btnAgain'),
  btnMenu: document.getElementById('btnMenu'),
};

function flybyNames() {
  const names = [];
  for (const body of CELESTIAL) {
    if (profile.flybys?.[body.id]) names.push(body.name);
  }
  return names;
}

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

/** Full-buffer clear in device pixels, then restore CSS-pixel transform. */
function clearFrame() {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#070b14';
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

function refreshShop() {
  if (!els.shop) return;
  const bank = Number(profile.bankCoins) || 0;
  if (els.bank) els.bank.textContent = String(bank);

  els.shop.innerHTML = '';
  for (const id of UPGRADE_IDS) {
    const def = UPGRADES[id];
    const level = profile.upgrades?.[id] || 0;
    const cost = nextCost(id, level);
    const maxed = cost == null;
    const canBuy = !maxed && bank >= cost;

    const row = document.createElement('div');
    row.className = 'shop-row';
    row.innerHTML = `
      <div class="name">${def.name}</div>
      <div class="lvl">${maxed ? 'MAX' : `Lv ${level}/${def.maxLevel}`}</div>
      <div class="desc">${def.desc}</div>
      <button type="button" class="btn buy" data-id="${id}" ${
        canBuy ? '' : 'disabled'
      }>${maxed ? 'Owned' : `${cost}¢`}</button>
    `;
    els.shop.appendChild(row);
  }

  els.shop.querySelectorAll('button.buy').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const result = buyUpgrade(profile, id);
      if (!result.ok) return;
      Save.writeProfile(profile);
      refreshShop();
      refreshMenuMeta();
    });
  });
}

function refreshMenuMeta() {
  const peakKm = formatAltitudeKm(gameToKm(profile.bestAltitude || 0));
  if (els.best) els.best.textContent = String(profile.bestScore);
  if (els.bestAlt) els.bestAlt.textContent = peakKm;
  if (els.bank) els.bank.textContent = String(Number(profile.bankCoins) || 0);
  if (els.flybyMeta) {
    const bits = flybyNames();
    els.flybyMeta.textContent = bits.length
      ? `Flybys: ${bits.map((n) => `${n} ✓`).join(' · ')}`
      : '';
  }
  refreshShop();
}

function startRun() {
  const seed = (Date.now() ^ (performance.now() * 1000)) >>> 0;
  const stats = foldStats(profile.upgrades);
  session = new PlaySession(
    seed,
    {
      onDeath() {
        endRun();
      },
    },
    stats
  );
  flyby = null;
  flybySeen.clear();
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
  profile.bankCoins = (Number(profile.bankCoins) || 0) + sum.coins;
  profile.bestScore = Math.max(profile.bestScore, sum.score);
  profile.bestAltitude = Math.max(profile.bestAltitude, sum.altitude);
  profile.bestCoins = Math.max(profile.bestCoins, sum.coins);
  Save.writeProfile(profile);

  state = 'summary';
  hide(els.hud);
  const reason =
    sum.reason === 'hull'
      ? 'Hull breached by asteroids. Systems offline.'
      : sum.reason === 'blackhole'
        ? 'Pulled past the event horizon. Run over.'
        : sum.reason === 'meteor'
          ? 'Asteroid swarm tore the ship apart.'
          : sum.reason === 'fuel'
            ? 'Out of fuel. Free fall.'
            : 'Slammed into the ground.';
  const peakKm = formatAltitudeKm(gameToKm(sum.altitude));
  const layer = layerAtKm(gameToKm(sum.altitude)).name;
  const eggs = flybyNames();
  els.summaryBody.innerHTML = `
    <p class="reason">${reason}</p>
    <div class="stat-grid">
      <div><span>Score</span><b>${sum.score}</b></div>
      <div><span>Peak</span><b>${peakKm}</b></div>
      <div><span>Coins</span><b>+${sum.coins}</b></div>
      <div><span>Bank</span><b>${profile.bankCoins}</b></div>
    </div>
    <p class="muted">Runs: ${profile.runs} · Lifetime coins: ${profile.totalCoins} · ${layer}${
      eggs.length ? ` · Flybys: ${eggs.join(', ')}` : ''
    }</p>
  `;
  show(els.summary);
}

function checkFlybys(s, dt) {
  const y = s.player.peakY;
  profile.flybys = profile.flybys || {};
  for (const body of CELESTIAL) {
    if (flybySeen.has(body.id)) continue;
    if (y >= body.gameY) {
      flybySeen.add(body.id);
      flyby = { text: body.label, age: 0, life: 2.8 };
      profile.flybys[body.id] = true;
      Save.writeProfile(profile);
    }
  }
  if (flyby) {
    flyby.age += dt;
    if (flyby.age >= flyby.life) flyby = null;
  }
}

function drawSession(dt, playing) {
  const s = session;
  const p = s.player;
  const camY = p.y;
  const camX = p.x;

  if (playing) {
    s.step(dt, input.controls());
    checkFlybys(s, dt);
  }

  clearFrame();
  // Integer camera keeps world scroll on whole pixels at high speed.
  const viewY = Math.round(camY);
  const viewX = camX;
  drawSky(g, W, H, viewY, animTime, viewX);
  drawLaunchPad(g, W, H, viewY, viewX);
  drawCelestials(g, W, H, viewY, animTime, viewX);

  for (const u of s.pickups) {
    const scr = worldToScreen(u.x, u.y, viewX, viewY, W, H);
    const margin = u.kind === 'blackhole' ? 120 : 80;
    if (scr.y < -margin || scr.y > H + margin) continue;
    if (scr.x < -margin || scr.x > W + margin) continue;
    const drawR = u.kind === 'blackhole' ? u.r * scr.scale * 0.55 : u.r * scr.scale;
    drawPickup(g, u.kind, scr.x, scr.y, drawR, u.spin, animTime);
  }

  for (const fx of s.collectFx) drawCollectFx(g, fx, viewY, W, H, animTime, viewX);

  // Pin the player to screen center — camera follows X+Y (infinite sides).
  const scr = worldToScreen(p.x, p.y, viewX, viewY, W, H);
  drawRocket(
    g,
    scr.x,
    scr.y,
    scr.scale * 0.85,
    p.tilt,
    animTime,
    playing ? p.thrusting : p.alive
  );

  drawHitFlash(g, W, H, s.flash);
  if (flyby) drawFlybyBanner(g, W, H, flyby.text, flyby.age, flyby.life);

  if (playing) updateGauges(s);
}

function updateGauges(s) {
  const p = s.player;
  const fuelMax = p.fuelMax || 1;
  const fuelPct = clamp(p.fuel / fuelMax, 0, 1);
  if (els.fuelFill) els.fuelFill.style.height = `${fuelPct * 100}%`;
  if (els.fuelVal) els.fuelVal.textContent = `${Math.round(fuelPct * 100)}%`;
  if (els.fuelGauge) els.fuelGauge.classList.toggle('low', fuelPct < 0.28);

  const healthMax = p.healthMax || 1;
  const healthPct = clamp(p.health / healthMax, 0, 1);
  if (els.healthFill) els.healthFill.style.height = `${healthPct * 100}%`;
  if (els.healthVal) els.healthVal.textContent = `${Math.round(healthPct * 100)}%`;
  if (els.healthGauge) els.healthGauge.classList.toggle('low', healthPct < 0.34);

  const km = gameToKm(Math.max(0, p.y));
  const peakKm = gameToKm(Math.max(0, p.peakY));
  if (els.altitude) els.altitude.textContent = formatAltitudeKm(km);
  if (els.layerVal) els.layerVal.textContent = layerAtKm(km).name;
  if (els.altTicks) {
    const pxPerUnit = 0.12;
    els.altTicks.style.transform = `translateY(${-((Math.floor(p.y) * pxPerUnit) % 10)}px)`;
  }

  const deg = tiltDegrees(p.tilt);
  if (els.tiltVal) els.tiltVal.textContent = `${deg}°`;
  if (els.tiltHorizon) els.tiltHorizon.style.transform = `rotate(${-p.tilt}rad)`;

  const speed = Math.hypot(p.vx, p.vy);
  const maxSpd = ROCKET.maxSpeed * (s.stats?.maxSpeedMul || 1);
  const velPct = clamp(speed / Math.max(1, maxSpd), 0, 1);
  if (els.velFill) els.velFill.style.width = `${velPct * 100}%`;
  if (els.velVal) els.velVal.textContent = String(Math.round(speed));
  if (els.velDir) {
    if (!p.airborne || speed < 8) els.velDir.textContent = 'PAD';
    else if (p.vy > 12) els.velDir.textContent = 'CLIMB ↑';
    else if (p.vy < -12) els.velDir.textContent = 'FALL ↓';
    else els.velDir.textContent = 'COAST';
  }
  if (els.velGauge) els.velGauge.classList.toggle('falling', p.vy < -12);

  if (els.score) els.score.textContent = String(s.score);
  if (els.coins) els.coins.textContent = String(s.coins);
  if (!els.peak) els.peak = document.getElementById('peakVal');
  if (els.peak) els.peak.textContent = formatAltitudeKm(peakKm);

  const nav = nextCelestial(p.y);
  if (els.nextBody && els.nextDist && els.nextFill) {
    if (!nav.body) {
      els.nextBody.textContent = 'Deep space';
      els.nextDist.textContent = 'Past Pluto';
      els.nextFill.style.width = '100%';
    } else if (nav.remainGame < 400) {
      els.nextBody.textContent = nav.body.name;
      els.nextDist.textContent = 'CLOSE';
      els.nextFill.style.width = `${Math.round(nav.progress * 100)}%`;
    } else {
      els.nextBody.textContent = nav.body.name;
      els.nextDist.textContent = `↑ ${formatAltitudeKm(nav.remainKm)}`;
      els.nextFill.style.width = `${Math.round(nav.progress * 100)}%`;
    }
  }
}

function drawMenuBackdrop(dt) {
  // Hold on the pad a moment, then drift up through the atmosphere.
  menuAltitude += dt * 40;
  if (menuAltitude > 3800) menuAltitude = 0;
  clearFrame();
  const onPad = menuAltitude < 90;
  const cam = onPad ? ROCKET.startY : menuAltitude;
  drawSky(g, W, H, cam, animTime, 0);
  drawLaunchPad(g, W, H, cam, 0);
  if (!onPad) drawCelestials(g, W, H, cam, animTime, 0);
  if (onPad) {
    const padScr = worldToScreen(0, ROCKET.startY, 0, cam, W, H);
    const thrusting = menuAltitude > 50 && Math.sin(animTime * 3) > -0.2;
    drawRocket(g, padScr.x, padScr.y, padScr.scale * 0.85, 0, animTime, thrusting);
  } else {
    const x = W * 0.62 + Math.sin(animTime * 0.7) * 18;
    const y = H * 0.52 + Math.sin(animTime * 1.1) * 10;
    drawRocket(g, x, y, 2.4, Math.sin(animTime) * 0.25, animTime, true);
  }
  drawPickup(g, 'fuel', W * 0.78, H * 0.28, 22, animTime, animTime);
  drawPickup(g, 'coin', W * 0.22, H * 0.38, 16, -animTime * 1.4, animTime);
  drawPickup(g, 'meteor', W * 0.85, H * 0.68, 24, animTime * 0.8, animTime);
  drawPickup(g, 'blackhole', W * 0.18, H * 0.72, 28, animTime * 0.9, animTime);
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
