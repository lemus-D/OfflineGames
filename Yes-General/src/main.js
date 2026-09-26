/* Boot, menu, HUD, tutorial, tooltips, input → match actions. */

import { Save } from './core/save.js';
import { MODES, DIFFICULTIES } from './data/content.js';
import {
  createMatch,
  endTurn,
  tryBuild,
  tryRecruit,
  tryAttack,
  tryMove,
  scoreCiv,
  tileSummary,
  actionPreview,
  hexKey,
  hexNeighbors,
} from './game/match.js';
import { drawMatch, screenToHex, cameraForMap } from './game/render.js';

const canvas = document.getElementById('stage');
const g = canvas.getContext('2d');

let W = 0,
  H = 0,
  dpr = 1;
let profile = Save.loadProfile();
/** @type {'menu'|'playing'|'summary'} */
let state = 'menu';
/** @type {ReturnType<typeof createMatch>|null} */
let match = null;
let cam = { x: 0, y: 0 };
let selectedMode = profile.lastMode in MODES ? profile.lastMode : 'standard';
let selectedDiff = profile.lastDifficulty in DIFFICULTIES ? profile.lastDifficulty : 'normal';
/** From-hex for attack/move when clicking a second hex. */
let orderFrom = null;
let pendingStart = false;

const els = {
  menu: document.getElementById('menu'),
  hud: document.getElementById('hud'),
  side: document.getElementById('side'),
  summary: document.getElementById('summary'),
  tutorial: document.getElementById('tutorial'),
  tooltip: document.getElementById('tooltip'),
  modeSelect: document.getElementById('modeSelect'),
  diffSelect: document.getElementById('diffSelect'),
  btnPlay: document.getElementById('btnPlay'),
  btnAgain: document.getElementById('btnAgain'),
  btnMenu: document.getElementById('btnMenu'),
  btnGather: document.getElementById('btnGather'),
  btnRecruit: document.getElementById('btnRecruit'),
  btnWonder: document.getElementById('btnWonder'),
  btnEnd: document.getElementById('btnEnd'),
  btnTutorialGo: document.getElementById('btnTutorialGo'),
  btnTutorialSkip: document.getElementById('btnTutorialSkip'),
  turnVal: document.getElementById('turnVal'),
  stockVal: document.getElementById('stockVal'),
  scoreVal: document.getElementById('scoreVal'),
  eventVal: document.getElementById('eventVal'),
  tileTitle: document.getElementById('tileTitle'),
  tileBody: document.getElementById('tileBody'),
  log: document.getElementById('log'),
  summaryTitle: document.getElementById('summaryTitle'),
  summaryBody: document.getElementById('summaryBody'),
  recordVal: document.getElementById('recordVal'),
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

function setDisabled(btn, off) {
  btn.classList.toggle('is-disabled', off);
  btn.setAttribute('aria-disabled', off ? 'true' : 'false');
}

function refreshMenuChoices() {
  els.modeSelect.innerHTML = '';
  for (const m of Object.values(MODES)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice' + (m.id === selectedMode ? ' selected' : '');
    btn.textContent = `${m.name} (${m.turns}t)`;
    btn.addEventListener('click', () => {
      selectedMode = m.id;
      refreshMenuChoices();
    });
    els.modeSelect.appendChild(btn);
  }
  els.diffSelect.innerHTML = '';
  for (const d of Object.values(DIFFICULTIES)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice' + (d.id === selectedDiff ? ' selected' : '');
    btn.textContent = `${d.name} · ${d.aiCount} AI`;
    btn.addEventListener('click', () => {
      selectedDiff = d.id;
      refreshMenuChoices();
    });
    els.diffSelect.appendChild(btn);
  }
  els.recordVal.textContent = `${profile.wins}–${profile.losses}`;
}

function beginMatch() {
  profile.lastMode = selectedMode;
  profile.lastDifficulty = selectedDiff;
  Save.writeProfile(profile);

  const seed = (Date.now() ^ (performance.now() * 1000)) >>> 0;
  match = createMatch(selectedMode, selectedDiff, seed);
  cam = cameraForMap(match);
  orderFrom = null;
  state = 'playing';
  hide(els.menu);
  hide(els.summary);
  hide(els.tutorial);
  show(els.hud);
  show(els.side);
  refreshHud();
  refreshTilePanel();
}

function requestStart() {
  if (!profile.tutorialDone) {
    pendingStart = true;
    hide(els.menu);
    show(els.tutorial);
    return;
  }
  beginMatch();
}

function finishTutorial(skip) {
  profile.tutorialDone = true;
  Save.writeProfile(profile);
  hide(els.tutorial);
  if (pendingStart || skip) {
    pendingStart = false;
    beginMatch();
  } else {
    show(els.menu);
  }
}

function finishIfEnded() {
  if (!match || match.phase !== 'ended') return;
  const player = match.civs.find((c) => c.isPlayer);
  const won = match.winnerId === 'player';
  if (won) profile.wins += 1;
  else profile.losses += 1;
  const sc = player ? scoreCiv(match, player) : 0;
  profile.bestScore = Math.max(profile.bestScore, sc);
  Save.writeProfile(profile);

  state = 'summary';
  hide(els.hud);
  hide(els.side);
  hideTooltip();
  const reason =
    match.winReason === 'wonder'
      ? 'Ancient Wonder completed.'
      : match.winReason === 'conquest'
        ? 'The map was conquered.'
        : 'Turns exhausted — scored on land and stockpile.';
  els.summaryTitle.textContent = won ? 'Victory' : 'Defeat';
  els.summaryBody.innerHTML = `
    <p style="color:var(--muted)">${reason}</p>
    <p>Your score: <b>${sc}</b> · Best: <b>${profile.bestScore}</b></p>
    <p style="color:var(--muted);font-size:0.85rem">Winner: ${
      match.civs.find((c) => c.id === match.winnerId)?.name || '?'
    }</p>
  `;
  show(els.summary);
}

function refreshHud() {
  if (!match) return;
  const player = match.civs.find((c) => c.isPlayer);
  els.turnVal.textContent = `${match.turn} / ${match.maxTurns}`;
  if (player) {
    const s = player.stock;
    els.stockVal.textContent = `Food ${s.food} · Wood ${s.wood} · Stone ${s.stone} · Ore ${s.ore}`;
    els.scoreVal.textContent = String(scoreCiv(match, player));
  }
  els.eventVal.textContent = match.lastEvent || '—';
  els.log.innerHTML = match.log
    .slice(0, 8)
    .map((l) => `<div>${l}</div>`)
    .join('');
}

function refreshTilePanel() {
  if (!match) return;
  const info = tileSummary(match, match.selectedKey);
  if (!info) {
    els.tileTitle.textContent = 'Hex';
    els.tileBody.textContent = 'Select a hex.';
    return;
  }
  const owner = info.owner ? info.owner.name : 'Neutral';
  els.tileTitle.textContent = info.isCapital ? `Capital · ${info.resource.name}` : info.resource.name;
  els.tileBody.textContent = `${owner} · troops ${info.troops}${
    info.buildingId ? ` · ${info.buildingId}` : ''
  }${orderFrom ? ` · order from ${orderFrom}` : ''}`;

  const gPrev = actionPreview(match, 'player', match.selectedKey, 'gather');
  const rPrev = actionPreview(match, 'player', match.selectedKey, 'recruit');
  const wPrev = actionPreview(match, 'player', match.selectedKey, 'wonder');
  setDisabled(els.btnGather, !gPrev.ok);
  setDisabled(els.btnRecruit, !rPrev.ok);
  setDisabled(els.btnWonder, !wPrev.ok);
  setDisabled(els.btnEnd, false);
  els.btnGather.textContent = gPrev.title || 'Build gather';
}

function hideTooltip() {
  hide(els.tooltip);
}

function showTooltipFor(btn, clientX, clientY) {
  if (!match || state !== 'playing') {
    hideTooltip();
    return;
  }
  const action = btn.dataset.action;
  if (!action) {
    hideTooltip();
    return;
  }
  const prev = actionPreview(match, 'player', match.selectedKey, action);
  const needOrBlock = prev.ok
    ? ''
    : prev.need || (prev.blockers.length ? prev.blockers.join(' ') : '');
  els.tooltip.innerHTML = `
    <div class="tt-title">${prev.title}</div>
    <div class="tt-line">${prev.effect}</div>
    <div class="tt-line">Cost: ${prev.cost}</div>
    <div class="${prev.ok ? 'tt-ok' : 'tt-bad'}">${
      prev.ok ? 'Ready' : needOrBlock || 'Unavailable'
    }</div>
  `;
  show(els.tooltip);
  const pad = 12;
  const tw = els.tooltip.offsetWidth;
  const th = els.tooltip.offsetHeight;
  let left = clientX + 14;
  let top = clientY + 14;
  if (left + tw > innerWidth - pad) left = clientX - tw - 10;
  if (top + th > innerHeight - pad) top = clientY - th - 10;
  els.tooltip.style.left = `${Math.max(pad, left)}px`;
  els.tooltip.style.top = `${Math.max(pad, top)}px`;
}

function bindActionButton(btn, action, handler) {
  if (!btn) return;
  btn.addEventListener('click', (ev) => {
    if (btn.classList.contains('is-disabled')) {
      showTooltipFor(btn, ev.clientX, ev.clientY);
      return;
    }
    handler();
  });
  btn.addEventListener('pointerenter', (ev) => showTooltipFor(btn, ev.clientX, ev.clientY));
  btn.addEventListener('pointermove', (ev) => showTooltipFor(btn, ev.clientX, ev.clientY));
  btn.addEventListener('pointerleave', hideTooltip);
  btn.dataset.action = action;
}

function onCanvasClick(ev) {
  if (state !== 'playing' || !match) return;
  const rect = canvas.getBoundingClientRect();
  const mx = ev.clientX - rect.left;
  const my = ev.clientY - rect.top;
  const key = screenToHex(mx, my, W, H, cam);
  if (!match.tiles.has(key)) return;

  const tile = match.tiles.get(key);
  const player = match.civs.find((c) => c.isPlayer);

  if (orderFrom && orderFrom !== key) {
    const from = match.tiles.get(orderFrom);
    const adj = hexNeighbors(from.q, from.r).some((n) => hexKey(n.q, n.r) === key);
    if (adj && from.ownerId === 'player' && from.troops > 0) {
      if (tile.ownerId === 'player') {
        tryMove(match, 'player', orderFrom, key, from.troops);
      } else {
        tryAttack(match, 'player', orderFrom, key);
      }
      orderFrom = null;
      match.selectedKey = key;
      refreshHud();
      refreshTilePanel();
      finishIfEnded();
      return;
    }
  }

  match.selectedKey = key;
  if (tile.ownerId === player.id && tile.troops > 0) orderFrom = key;
  else orderFrom = null;
  refreshTilePanel();
}

function frame() {
  if (match && (state === 'playing' || state === 'summary')) {
    drawMatch(g, W, H, match, cam);
  } else {
    g.clearRect(0, 0, W, H);
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#2a2118');
    bg.addColorStop(1, '#1a1410');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
  }
  requestAnimationFrame(frame);
}

els.btnPlay.addEventListener('click', requestStart);
els.btnAgain.addEventListener('click', requestStart);
els.btnMenu.addEventListener('click', () => {
  hide(els.summary);
  show(els.menu);
  state = 'menu';
  match = null;
  refreshMenuChoices();
});

els.btnTutorialGo?.addEventListener('click', () => finishTutorial(false));
els.btnTutorialSkip?.addEventListener('click', () => finishTutorial(true));

bindActionButton(els.btnGather, 'gather', () => {
  if (!match) return;
  const info = tileSummary(match, match.selectedKey);
  if (!info?.gatherBuilding) return;
  tryBuild(match, 'player', match.selectedKey, info.gatherBuilding);
  refreshHud();
  refreshTilePanel();
  finishIfEnded();
});

bindActionButton(els.btnRecruit, 'recruit', () => {
  if (!match) return;
  tryRecruit(match, 'player', match.selectedKey);
  refreshHud();
  refreshTilePanel();
});

bindActionButton(els.btnWonder, 'wonder', () => {
  if (!match) return;
  tryBuild(match, 'player', match.selectedKey, 'wonder');
  refreshHud();
  refreshTilePanel();
  finishIfEnded();
});

bindActionButton(els.btnEnd, 'end', () => {
  if (!match || match.phase !== 'play') return;
  endTurn(match);
  orderFrom = null;
  refreshHud();
  refreshTilePanel();
  finishIfEnded();
});

canvas.addEventListener('click', onCanvasClick);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

refreshMenuChoices();
resize();
show(els.menu);
hide(els.hud);
hide(els.side);
hide(els.summary);
hide(els.tutorial);
hideTooltip();
requestAnimationFrame(frame);
