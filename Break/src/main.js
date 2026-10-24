/* Boot, menu, HUD, frame loop for Break. */

import { CueInput, EnglishDial } from './core/input.js';
import { Save } from './core/save.js';
import { clamp } from './core/rng.js';
import {
  unlockAudio,
  playPhysics,
  playCueStrike,
  setMuted,
  isMuted,
} from './core/audio.js';
import { PHYSICS, DIFFICULTIES, pocketCenters } from './game/content.js';
import { PlaySession } from './game/play.js';
import { chooseAiShot, difficultyThinkSec } from './game/ai.js';
import {
  fitView,
  drawTable,
  drawBall,
  drawCueAndAim,
  drawEnglishDial,
  drawKitchenHint,
  drawPocketCallHints,
  screenToTable,
  tableToScreen,
} from './game/draw.js';

const canvas = document.getElementById('stage');
// Avoid desynchronized — it went black with compositing quirks on some mobile GPUs.
const g = canvas.getContext('2d', { alpha: false });
if (g) {
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
}
const cueInput = new CueInput(canvas);

function armAudio() {
  unlockAudio();
}
for (const ev of ['pointerdown', 'touchstart', 'mousedown', 'keydown']) {
  addEventListener(ev, armAudio, { capture: true, passive: true });
}

const spinCanvas = document.getElementById('spinDial');
const spinPanel = document.getElementById('spinPanel');
const spinCtx = spinCanvas.getContext('2d');
const englishDial = new EnglishDial(spinCanvas, { maxEnglish: PHYSICS.maxEnglish });

function refreshSpinHot() {
  if (!spinPanel) return;
  spinPanel.classList.toggle('hot', !!(englishDial.hover || englishDial.dragging));
}

spinPanel?.addEventListener('pointerenter', () => {
  englishDial.hover = true;
  refreshSpinHot();
});
spinPanel?.addEventListener('pointerleave', () => {
  if (!englishDial.dragging) englishDial.hover = false;
  refreshSpinHot();
});
spinCanvas.addEventListener('pointerdown', () => {
  cueInput.blocked = true;
  englishDial.hover = true;
  refreshSpinHot();
});
addEventListener('pointerup', () => {
  cueInput.blocked = false;
  refreshSpinHot();
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
/** AI think timer (seconds remaining). */
let aiThink = 0;
let selectedDifficulty = 'medium';

const els = {
  menu: document.getElementById('menu'),
  hud: document.getElementById('hud'),
  summary: document.getElementById('summary'),
  you: document.getElementById('youVal'),
  ai: document.getElementById('aiVal'),
  youSuit: document.getElementById('youSuit'),
  aiSuit: document.getElementById('aiSuit'),
  left: document.getElementById('leftVal'),
  turnLabel: document.getElementById('turnLabel'),
  msg: document.getElementById('msgVal'),
  best: document.getElementById('bestVal'),
  aiRecord: document.getElementById('aiRecordVal'),
  summaryBody: document.getElementById('summaryBody'),
  btnAgain: document.getElementById('btnAgain'),
  btnMenu: document.getElementById('btnMenu'),
  btnReset: document.getElementById('btnReset'),
  btnEasy: document.getElementById('btnEasy'),
  btnMedium: document.getElementById('btnMedium'),
  btnHard: document.getElementById('btnHard'),
  btnExtraHard: document.getElementById('btnExtraHard'),
  btnMute: document.getElementById('btnMute'),
};

let lastHudKey = '';
let lastDialKey = '';

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
  // Flat clear is cheaper than a full-canvas gradient every frame.
  g.fillStyle = '#0a1410';
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
  if (els.aiRecord) {
    const w =
      (profile.aiWins?.easy || 0) +
      (profile.aiWins?.medium || 0) +
      (profile.aiWins?.hard || 0) +
      (profile.aiWins?.extraHard || 0);
    const l =
      (profile.aiLosses?.easy || 0) +
      (profile.aiLosses?.medium || 0) +
      (profile.aiLosses?.hard || 0) +
      (profile.aiLosses?.extraHard || 0);
    els.aiRecord.textContent = `${w}–${l}`;
  }
}

function startRun(difficulty) {
  armAudio();
  selectedDifficulty = difficulty || 'medium';
  const seed = (Date.now() ^ (performance.now() * 1000)) >>> 0;
  session = new PlaySession(
    seed,
    {
      onClear() {
        endRun(true);
      },
      onSfx(events) {
        playPhysics(events);
      },
      onCueStrike(power) {
        playCueStrike(power);
      },
    },
    { mode: 'vsAi', difficulty: selectedDifficulty }
  );
  pendingShot = null;
  aiThink = 0;
  englishDial.reset();
  cueInput.enabled = true;
  cueInput.reset();
  lastHudKey = '';
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

  if (sum.mode === 'vsAi' && sum.winner) {
    profile.aiWins = profile.aiWins || { easy: 0, medium: 0, hard: 0, extraHard: 0 };
    profile.aiLosses = profile.aiLosses || { easy: 0, medium: 0, hard: 0, extraHard: 0 };
    const d = sum.difficulty || selectedDifficulty;
    if (sum.winner === 'player') profile.aiWins[d] = (profile.aiWins[d] || 0) + 1;
    if (sum.winner === 'ai') profile.aiLosses[d] = (profile.aiLosses[d] || 0) + 1;
  }

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

  let title = 'Match over';
  let reason = sum.winReason || '';
  const youSuit = sum.suits?.player === 'solid' ? 'solids' : sum.suits?.player === 'stripe' ? 'stripes' : 'open';
  const aiSuit = sum.suits?.ai === 'solid' ? 'solids' : sum.suits?.ai === 'stripe' ? 'stripes' : 'open';
  if (sum.mode === 'vsAi') {
    if (sum.winner === 'player') {
      title = 'You win';
      if (!reason) {
        reason = `Final ${sum.scores.player}–${sum.scores.ai} on ${DIFFICULTIES[sum.difficulty]?.name || 'AI'}.`;
      }
    } else if (sum.winner === 'ai') {
      title = 'AI wins';
      if (!reason) {
        reason = `Final ${sum.scores.ai}–${sum.scores.player}. Try a softer difficulty — or don't.`;
      }
    } else if (sum.winner === 'draw') {
      title = 'Draw';
      reason = reason || `Even table ${sum.scores.player}–${sum.scores.ai}.`;
    } else {
      title = 'Walk away';
      reason = reason || `You ${sum.scores.player} · AI ${sum.scores.ai} · ${sum.remaining} left.`;
    }
  } else {
    title = sum.cleared ? 'Rack cleared' : 'Walk away';
    reason = sum.cleared
      ? `Cleaned the table in ${sum.shots} shots.`
      : `Pocketed ${sum.pocketed} · ${sum.remaining} left.`;
  }

  els.summaryBody.innerHTML = `
    <p class="reason">${reason}</p>
    <div class="stat-grid">
      <div><span>You (${youSuit})</span><b>${sum.scores?.player ?? sum.pocketed}</b></div>
      <div><span>AI (${aiSuit})</span><b>${sum.scores?.ai ?? 0}</b></div>
      <div><span>Shots</span><b>${sum.shots}</b></div>
      <div><span>Scratches</span><b>${sum.scratches}</b></div>
    </div>
    <p class="muted">Difficulty: ${DIFFICULTIES[sum.difficulty]?.name || '—'} · Record ${els.aiRecord?.textContent || '—'}</p>
  `;
  const h2 = els.summary.querySelector('h2');
  if (h2) h2.textContent = title;
  show(els.summary);
}

function updateHud() {
  if (!session) return;
  const turn =
    session.phase === 'rolling'
      ? 'ROLLING'
      : session.isAiTurn
        ? 'AI TURN'
        : 'YOUR TURN';
  const key = [
    session.scores.player,
    session.scores.ai,
    session.suitHud('player'),
    session.suitHud('ai'),
    session.remaining,
    turn,
    session.message || '',
  ].join('|');
  if (key === lastHudKey) return;
  lastHudKey = key;
  if (els.you) els.you.textContent = String(session.scores.player);
  if (els.ai) els.ai.textContent = String(session.scores.ai);
  if (els.youSuit) els.youSuit.textContent = session.suitHud('player');
  if (els.aiSuit) els.aiSuit.textContent = session.suitHud('ai');
  if (els.left) els.left.textContent = String(session.remaining);
  if (els.turnLabel) els.turnLabel.textContent = turn;
  if (els.msg) els.msg.textContent = session.message || ' ';
}

function playerCanAim() {
  return (
    session &&
    state === 'playing' &&
    !session.isAiTurn &&
    (session.phase === 'aiming' || session.phase === 'ballInHand')
  );
}

function resolveAim(view) {
  if (!session) return null;
  if (!playerCanAim()) {
    cueInput.enabled = false;
    cueInput.lock();
    return null;
  }
  cueInput.enabled = true;
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
    // Soft tap near a pocket while on the 8 → call / re-call.
    if (power < 0.02 && tryCallPocketAt(cueInput.cx, cueInput.cy, view)) {
      cueInput.reset();
      updateHud();
      return null;
    }
    if (power >= 0.02 && (drag.dx !== 0 || drag.dy !== 0)) {
      if (session.needsPocketCall('player')) {
        session.message = 'Call a pocket for the 8 first — tap a hole.';
        cueInput.reset();
        updateHud();
        return null;
      }
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

  return { dx: 80, dy: 0, powerPull: 0, power: 0, pulling: false, released: false };
}

function tickAi(dt) {
  if (!session || session.mode !== 'vsAi') return;
  if (session.phase === 'won' || session.phase === 'rolling') {
    aiThink = 0;
    return;
  }

  if (session.phase === 'ballInHand' && session.turn === 'ai') {
    session.autoPlaceCue();
    aiThink = difficultyThinkSec(session.difficulty);
    return;
  }

  if (session.phase !== 'aiming' || session.turn !== 'ai') {
    aiThink = 0;
    return;
  }

  if (aiThink <= 0) aiThink = difficultyThinkSec(session.difficulty);
  aiThink -= dt;
  if (aiThink > 0) return;

  const shot = chooseAiShot(session, session.difficulty, session.rng);
  session.shoot(shot.dx, shot.dy, shot.power, shot.english);
  englishDial.reset();
  aiThink = 0;
}

function drawMenuBackdrop() {
  clearFrame();
  const view = fitView(W, H);
  if (!session) session = new PlaySession(42, {}, { mode: 'solo' });
  drawTable(g, view, animTime);
  for (const b of session.balls) drawBall(g, b, view);
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
}

function drawPlay(dt) {
  const s = session;
  tickAi(dt);
  s.step(dt);

  if (pendingShot && s.phase === 'aiming' && !s.isAiTurn) {
    s.shoot(pendingShot.dx, pendingShot.dy, pendingShot.power, pendingShot.english);
    pendingShot = null;
    englishDial.reset();
  }

  clearFrame();
  const view = fitView(W, H);
  drawTable(g, view, animTime);

  if (s.phase === 'ballInHand' && !s.isAiTurn) drawKitchenHint(g, view);

  if (
    s.phase === 'aiming' &&
    !s.isAiTurn &&
    s.onTheEight('player')
  ) {
    drawPocketCallHints(g, view, s.calledPocket.player, animTime);
  }

  for (const b of s.balls) {
    if (b.id !== 0) drawBall(g, b, view);
  }
  drawBall(g, s.cue, view);

  const aim = resolveAim(view);
  if (aim && s.phase === 'aiming' && !s.isAiTurn) {
    const legalIds = new Set(s.legalTargets('player').map((b) => b.id));
    drawCueAndAim(g, s.cue, s.balls, view, aim, englishDial.english, {
      pulling: aim.pulling,
      power: aim.power,
      legalIds,
    });
  }

  refreshSpinHot();
  const dialHot = !!(englishDial.hover || englishDial.dragging);
  const dialKey = `${englishDial.english.x.toFixed(3)}|${englishDial.english.y.toFixed(3)}|${dialHot ? 1 : 0}`;
  if (dialKey !== lastDialKey) {
    lastDialKey = dialKey;
    drawEnglishDial(spinCtx, spinCanvas.width, englishDial.english, dialHot);
  }
  updateHud();
}

function frame(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min(0.05, (ts - lastTs) / 1000);
  lastTs = ts;
  animTime += dt;

  if (state === 'menu') {
    if (!session || session.phase === 'won') {
      session = new PlaySession(42, {}, { mode: 'solo' });
    }
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

function bindDiff(btn, id) {
  if (!btn) return;
  btn.addEventListener('click', () => {
    session = null;
    startRun(id);
  });
}
function tryCallPocketAt(sx, sy, view) {
  if (!session || session.isAiTurn || !session.onTheEight('player')) return false;
  if (session.phase !== 'aiming' && session.phase !== 'ballInHand') return false;
  const world = screenToTable(sx, sy, view);
  const pockets = pocketCenters();
  let best = -1;
  let bestD = Infinity;
  for (const p of pockets) {
    const d = Math.hypot(world.x - p.x, world.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = p.id;
    }
  }
  // Generous tap target around each mouth.
  if (bestD > 16) return false;
  return session.callPocket(best, 'player');
}

bindDiff(els.btnEasy, 'easy');
bindDiff(els.btnMedium, 'medium');
bindDiff(els.btnHard, 'hard');
bindDiff(els.btnExtraHard, 'extraHard');

if (els.btnMute) {
  els.btnMute.addEventListener('click', () => {
    armAudio();
    setMuted(!isMuted());
    els.btnMute.textContent = isMuted() ? 'Sound' : 'Mute';
  });
}

els.btnAgain.addEventListener('click', () => {
  session = null;
  startRun(selectedDifficulty);
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
