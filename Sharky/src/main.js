/* Boot, run states, HUD, frame loop. */

import { Input } from './core/input.js';
import { Save } from './core/save.js';
import { Audio } from './core/audio.js';
import { clamp } from './core/rng.js';
import { ANIMALS, unlockAnimals } from './game/content.js';
import { drawCreature, lengthFromMass } from './game/creature.js';
import { drawWorld } from './game/world.js';
import { PlaySession, WORLD_FLOOR } from './game/play.js';

const canvas = document.getElementById('stage');
const g = canvas.getContext('2d');
const input = new Input(canvas);
const audio = new Audio();

let W = 0,
  H = 0,
  dpr = 1;
let profile = Save.loadProfile();
profile.unlocked = unlockAnimals(profile);
Save.writeProfile(profile);

/** @type {'menu'|'playing'|'draft'|'summary'} */
let state = 'menu';
/** @type {PlaySession|null} */
let session = null;
let selectedAnimal = profile.lastAnimal in profile.unlocked ? profile.lastAnimal : 'reef-shark';
let animTime = 0;
let lastTs = 0;

const els = {
  menu: document.getElementById('menu'),
  hud: document.getElementById('hud'),
  draft: document.getElementById('draft'),
  summary: document.getElementById('summary'),
  hungerFill: document.getElementById('hungerFill'),
  score: document.getElementById('scoreVal'),
  mass: document.getElementById('massVal'),
  animalLabel: document.getElementById('animalLabel'),
  best: document.getElementById('bestVal'),
  animalSelect: document.getElementById('animalSelect'),
  draftCards: document.getElementById('draftCards'),
  summaryBody: document.getElementById('summaryBody'),
  btnPlay: document.getElementById('btnPlay'),
  btnAgain: document.getElementById('btnAgain'),
  btnMenu: document.getElementById('btnMenu'),
  exportBox: document.getElementById('exportBox'),
  btnExport: document.getElementById('btnExport'),
  btnImport: document.getElementById('btnImport'),
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

function refreshAnimalSelect() {
  profile.unlocked = unlockAnimals(profile);
  const box = els.animalSelect;
  box.innerHTML = '';
  for (const a of Object.values(ANIMALS)) {
    const unlocked = !!profile.unlocked[a.id];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'animal-btn' + (a.id === selectedAnimal ? ' selected' : '');
    btn.disabled = !unlocked;
    btn.innerHTML = `<b>${a.name}</b><span>${unlocked ? `bite ${a.biteRatio.toFixed(1)}×` : `unlock at ${a.unlockMilestone} runs`}</span>`;
    btn.addEventListener('click', () => {
      if (!unlocked) return;
      selectedAnimal = a.id;
      audio.init();
      audio.click();
      refreshAnimalSelect();
    });
    box.appendChild(btn);
  }
  els.best.textContent = String(profile.bestScore);
}

function startRun() {
  audio.init();
  audio.resume();
  audio.click();
  profile.lastAnimal = selectedAnimal;
  Save.writeProfile(profile);

  const seed = (Date.now() ^ (performance.now() * 1000)) >>> 0;
  session = new PlaySession(selectedAnimal, seed, {
    onEat(c) {
      audio.eat(clamp(c.mass / session.player.mass, 0, 1));
    },
    onHurt() {
      audio.hurt();
    },
    onDeath() {
      audio.die();
      endRun();
    },
    onDraft() {
      state = 'draft';
      renderDraft();
      show(els.draft);
    },
    onPick() {
      audio.pick();
      audio.grow();
    },
  });

  state = 'playing';
  hide(els.menu);
  hide(els.summary);
  hide(els.draft);
  show(els.hud);
  els.animalLabel.textContent = ANIMALS[selectedAnimal].name;
}

function endRun() {
  if (!session) return;
  const sum = session.summary();
  profile.runs += 1;
  profile.totalEaten += sum.eaten;
  profile.bestScore = Math.max(profile.bestScore, sum.score);
  profile.bestMass = Math.max(profile.bestMass, sum.mass);
  profile.unlocked = unlockAnimals(profile);
  Save.writeProfile(profile);

  state = 'summary';
  hide(els.hud);
  hide(els.draft);
  const reason =
    sum.reason === 'starved' ? 'Starved in the open water.' : 'Swallowed by something bigger.';
  els.summaryBody.innerHTML = `
    <p class="reason">${reason}</p>
    <div class="stat-grid">
      <div><span>Score</span><b>${sum.score}</b></div>
      <div><span>Mass</span><b>${sum.mass.toFixed(2)}</b></div>
      <div><span>Eaten</span><b>${sum.eaten}</b></div>
      <div><span>Best</span><b>${profile.bestScore}</b></div>
    </div>
    <p class="muted">Runs: ${profile.runs} · Lifetime eaten: ${profile.totalEaten}</p>
  `;
  show(els.summary);
}

function renderDraft() {
  const picks = session.draft?.picks || [];
  els.draftCards.innerHTML = '';
  for (const u of picks) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'draft-card';
    btn.innerHTML = `<b>${u.name}</b><span>${u.desc}</span>`;
    btn.addEventListener('click', () => {
      session.chooseUpgrade(u.id);
      hide(els.draft);
      state = 'playing';
    });
    els.draftCards.appendChild(btn);
  }
}

function worldToScreen(wx, wy, cam) {
  const z = cam.zoom;
  return {
    x: W * 0.5 + (wx - cam.x) * z,
    y: H * 0.5 + (wy - cam.y) * z,
  };
}

function drawPlaying(dt) {
  const s = session;
  const cam = s.camera;
  const p = s.player;
  const screenP = worldToScreen(p.x, p.y, cam);
  const aim = input.aim(screenP.x, screenP.y);

  if (state === 'playing') s.step(dt, aim);

  drawWorld(g, W, H, animTime, cam.x, cam.y, WORLD_FLOOR);

  // Creatures.
  const sorted = s.creatures.slice().sort((a, b) => a.mass - b.mass);
  for (const c of sorted) {
    const sp = worldToScreen(c.x, c.y, cam);
    const len = lengthFromMass(c.mass) * cam.zoom;
    if (sp.x < -120 || sp.x > W + 120 || sp.y < -120 || sp.y > H + 120) continue;
    const outline =
      s.stats.chumSense && c.mass <= p.mass * s.stats.biteRatio ? 'rgba(120,255,200,0.9)' : null;
    const back = clamp(1 - c.mass / (p.mass * 2.5), 0, 0.55);
    g.globalAlpha = 1 - back * 0.5;
    drawCreature(
      g,
      c.species,
      sp.x,
      sp.y,
      len,
      animTime,
      4 + c.speedMul * 3,
      c.facing,
      outline ? { outline } : {}
    );
    g.globalAlpha = 1;
  }

  // Player.
  const plen = s.length * cam.zoom;
  const swimSpeed = 3 + Math.hypot(p.vx, p.vy) / 40;
  drawCreature(g, s.animal.species, screenP.x, screenP.y, plen, animTime, swimSpeed, p.facing);

  // Aim hint.
  if (aim.mag > 12) {
    g.strokeStyle = 'rgba(180,230,245,0.25)';
    g.beginPath();
    g.moveTo(screenP.x, screenP.y);
    g.lineTo(screenP.x + aim.ax * 0.25, screenP.y + aim.ay * 0.25);
    g.stroke();
  }

  // HUD values.
  els.hungerFill.style.width = `${clamp(p.hunger, 0, 1) * 100}%`;
  els.hungerFill.classList.toggle('low', p.hunger < 0.28);
  els.score.textContent = String(s.score);
  els.mass.textContent = s.player.mass.toFixed(2);
}

function drawMenuBackdrop(dt) {
  animTime += dt;
  const camX = Math.sin(animTime * 0.15) * 200;
  const camY = 1000 + Math.sin(animTime * 0.11) * 80;
  drawWorld(g, W, H, animTime, camX, camY, WORLD_FLOOR);
  const a = ANIMALS[selectedAnimal] || ANIMALS['reef-shark'];
  drawCreature(g, a.species, W * 0.72, H * 0.55, 160, animTime, 6, -1);
}

function frame(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min(0.05, (ts - lastTs) / 1000);
  lastTs = ts;
  animTime += dt;

  if (state === 'menu' || state === 'summary') {
    drawMenuBackdrop(dt);
  } else if (session) {
    drawPlaying(dt);
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
  refreshAnimalSelect();
});

els.btnExport.addEventListener('click', () => {
  audio.init();
  audio.click();
  els.exportBox.value = Save.exportCode(profile);
  els.exportBox.select();
});
els.btnImport.addEventListener('click', () => {
  audio.init();
  const next = Save.importCode(els.exportBox.value);
  if (next) {
    profile = next;
    profile.unlocked = unlockAnimals(profile);
    audio.pick();
    refreshAnimalSelect();
  } else {
    audio.hurt();
  }
});

// Register service worker when served over http(s).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

refreshAnimalSelect();
resize();
show(els.menu);
hide(els.hud);
hide(els.draft);
hide(els.summary);
requestAnimationFrame(frame);
