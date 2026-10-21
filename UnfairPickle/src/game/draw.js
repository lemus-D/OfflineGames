/* Canvas 2D pixel art from session state. */

import { hash2i } from '../core/rng.js';
import { TILE, PICKLE, BRINE } from './content.js';

export const PALETTE = {
  skyTop: '#5ec4d4',
  skyBot: '#c8f0c0',
  hillFar: '#3a9a78',
  hillNear: '#2d7a5a',
  brick: '#c45c38',
  brickHi: '#e07850',
  brickLo: '#8a3820',
  plat: '#d4a050',
  spike: '#2a2430',
  spring: '#e8e060',
  springBase: '#c04040',
  crumbly: '#a08060',
  reverse: 'rgba(180, 100, 200, 0.22)',
  pickle: '#3d8a3a',
  pickleHi: '#6cbc4a',
  pickleLo: '#245828',
  pickleBump: '#2e6e2c',
  stem: '#5a3a18',
  goalPole: '#f0f0e8',
  goalFlag: '#e04040',
  dust: '#d8c090',
};

function snap(v) {
  return Math.round(v);
}

export function drawSky(g, W, H, camX, time) {
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, PALETTE.skyTop);
  grad.addColorStop(1, PALETTE.skyBot);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  // Far hills
  g.fillStyle = PALETTE.hillFar;
  g.beginPath();
  g.moveTo(0, H);
  for (let x = 0; x <= W + 40; x += 40) {
    const wx = camX * 0.25 + x;
    const y = H * 0.62 + Math.sin(wx * 0.01 + time * 0.2) * 18;
    g.lineTo(x, y);
  }
  g.lineTo(W, H);
  g.fill();

  g.fillStyle = PALETTE.hillNear;
  g.beginPath();
  g.moveTo(0, H);
  for (let x = 0; x <= W + 32; x += 32) {
    const wx = camX * 0.45 + x;
    const y = H * 0.72 + Math.sin(wx * 0.014) * 14;
    g.lineTo(x, y);
  }
  g.lineTo(W, H);
  g.fill();
}

function drawBrick(g, x, y, crumbly = false) {
  g.fillStyle = crumbly ? PALETTE.crumbly : PALETTE.brick;
  g.fillRect(x, y, TILE, TILE);
  g.fillStyle = crumbly ? '#c0a078' : PALETTE.brickHi;
  g.fillRect(x + 1, y + 1, TILE - 2, 3);
  g.fillStyle = crumbly ? '#705848' : PALETTE.brickLo;
  g.fillRect(x + 1, y + TILE - 3, TILE - 2, 2);
  g.fillStyle = 'rgba(0,0,0,0.15)';
  g.fillRect(x + TILE / 2 - 1, y, 2, TILE);
  g.fillRect(x, y + TILE / 2 - 1, TILE, 2);
}

function drawPlat(g, x, y) {
  g.fillStyle = PALETTE.plat;
  g.fillRect(x, y, TILE, 5);
  g.fillStyle = '#f0c878';
  g.fillRect(x, y, TILE, 2);
}

function drawSpike(g, x, y) {
  g.fillStyle = PALETTE.spike;
  g.beginPath();
  g.moveTo(x + 2, y + TILE);
  g.lineTo(x + TILE / 2, y + 2);
  g.lineTo(x + TILE - 2, y + TILE);
  g.closePath();
  g.fill();
}

function drawSpring(g, x, y) {
  g.fillStyle = PALETTE.springBase;
  g.fillRect(x + 3, y + TILE - 5, TILE - 6, 5);
  g.fillStyle = PALETTE.spring;
  g.fillRect(x + 4, y + 4, TILE - 8, TILE - 9);
  g.fillStyle = '#fff8a0';
  g.fillRect(x + 5, y + 5, TILE - 10, 2);
}

function drawGoal(g, x, y, time, fake = false) {
  const px = x + TILE / 2;
  g.fillStyle = PALETTE.goalPole;
  g.fillRect(px - 1, y - TILE * 2, 2, TILE * 3);
  const wave = Math.sin(time * 6 + x * 0.1) * 2;
  g.fillStyle = fake ? '#606070' : PALETTE.goalFlag;
  g.beginPath();
  g.moveTo(px + 1, y - TILE * 2);
  g.lineTo(px + 12 + wave, y - TILE * 2 + 6);
  g.lineTo(px + 1, y - TILE * 2 + 12);
  g.closePath();
  g.fill();
  if (fake) {
    g.fillStyle = '#c0c0c8';
    g.fillRect(px + 3, y - TILE * 2 + 4, 4, 2);
  }
}

function drawReverse(g, x, y, time) {
  g.fillStyle = PALETTE.reverse;
  g.fillRect(x, y, TILE, TILE);
  g.fillStyle = `rgba(220,140,255,${0.25 + Math.sin(time * 4 + x) * 0.1})`;
  g.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
}

export function drawLevel(g, level, camX, camY, scale, time, viewW, viewH) {
  const g0 = level.grid;
  const tx0 = Math.floor(camX / TILE) - 1;
  const ty0 = Math.floor(camY / TILE) - 1;
  const tx1 = tx0 + Math.ceil(viewW / (TILE * scale)) + 3;
  const ty1 = ty0 + Math.ceil(viewH / (TILE * scale)) + 3;

  for (let ty = Math.max(0, ty0); ty < Math.min(level.h, ty1); ty++) {
    for (let tx = Math.max(0, tx0); tx < Math.min(level.w, tx1); tx++) {
      const cell = g0[ty][tx];
      if (!cell || cell.gone || cell.draw === 'empty') continue;
      if (cell.invisible && !cell.revealed) continue;

      const sx = snap((tx * TILE - camX) * scale);
      const sy = snap((ty * TILE - camY) * scale);
      const t = TILE * scale;

      g.save();
      // Local draw in tile-pixel space via scale
      g.translate(sx, sy);
      g.scale(scale, scale);

      const shaking =
        (cell.vanish || cell.crumbly) && cell.timer > 0
          ? Math.sin(time * 40) * 1.2
          : 0;
      if (shaking) g.translate(shaking, 0);

      switch (cell.draw) {
        case 'brick':
          drawBrick(g, 0, 0, false);
          break;
        case 'crumbly':
          drawBrick(g, 0, 0, true);
          break;
        case 'plat':
          drawPlat(g, 0, 0);
          break;
        case 'spike':
          drawSpike(g, 0, 0);
          break;
        case 'spring':
          drawSpring(g, 0, 0);
          break;
        case 'goal':
          drawGoal(g, 0, 0, time, cell.hazard === 'fakeGoal');
          break;
        case 'reverse':
          drawReverse(g, 0, 0, time);
          break;
        default:
          break;
      }
      g.restore();
      void t;
    }
  }
}

export function drawPickle(g, p, camX, camY, scale, dead) {
  const sx = snap((p.x - camX) * scale);
  const sy = snap((p.y - camY) * scale);
  const s = scale * (dead ? 0.7 : 1);
  const sq = p.squish || 1;

  g.save();
  g.translate(sx, sy);
  g.scale(p.facing * s, s);
  g.scale(1 / sq, sq);

  const hw = PICKLE.w / 2 + 2;
  const hh = PICKLE.h / 2 + 2;

  // Body
  g.fillStyle = dead ? '#5a7040' : PALETTE.pickle;
  g.beginPath();
  g.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
  g.fill();

  // Highlight
  g.fillStyle = dead ? '#708050' : PALETTE.pickleHi;
  g.beginPath();
  g.ellipse(-2, -3, hw * 0.35, hh * 0.4, -0.3, 0, Math.PI * 2);
  g.fill();

  // Bumps
  g.fillStyle = PALETTE.pickleBump;
  for (let i = 0; i < 5; i++) {
    const bx = -3 + (i % 3) * 3;
    const by = -4 + Math.floor(i / 3) * 5;
    g.fillRect(bx, by, 2, 2);
  }

  // Stem
  g.fillStyle = PALETTE.stem;
  g.fillRect(-1, -hh - 3, 2, 4);

  // Eye
  if (!dead) {
    g.fillStyle = '#fff';
    g.fillRect(2, -3, 3, 3);
    g.fillStyle = '#1a1810';
    g.fillRect(3, -2, 2, 2);
  } else {
    g.strokeStyle = '#1a1810';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(1, -4);
    g.lineTo(5, 0);
    g.moveTo(5, -4);
    g.lineTo(1, 0);
    g.stroke();
  }

  g.restore();
}

export function drawBrine(g, brineY, camX, camY, scale, W, H, time) {
  const sy = snap((brineY - camY) * scale);
  if (sy > H + 20) return;
  g.fillStyle = BRINE.color;
  g.globalAlpha = 0.72;
  g.fillRect(0, Math.max(0, sy), W, H - sy + 40);
  g.globalAlpha = 1;
  // Surface ripples
  g.fillStyle = '#c0e050';
  for (let x = 0; x < W; x += 12) {
    const wave = Math.sin(time * 5 + x * 0.08 + camX * 0.02) * 3;
    g.fillRect(x, sy + wave - 2, 10, 3);
  }
}

export function drawFx(g, fx, camX, camY, scale) {
  for (const f of fx) {
    const sx = snap((f.x - camX) * scale);
    const sy = snap((f.y - camY) * scale);
    const t = f.age / f.life;
    if (f.kind === 'poof' || f.kind === 'splat') {
      g.fillStyle = f.kind === 'splat' ? PALETTE.pickleHi : PALETTE.dust;
      g.globalAlpha = 1 - t;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const r = t * 18 * scale;
        g.fillRect(sx + Math.cos(a) * r - 2, sy + Math.sin(a) * r - 2, 4, 4);
      }
      g.globalAlpha = 1;
    } else if (f.kind === 'confetti') {
      for (let i = 0; i < 12; i++) {
        const h = hash2i(i, Math.floor(f.x), 9);
        g.fillStyle = h > 0.5 ? PALETTE.goalFlag : PALETTE.spring;
        g.globalAlpha = 1 - t;
        const px = sx + Math.sin(h * 20 + f.age * 4) * 30 * scale;
        const py = sy - t * 50 * scale + (h - 0.5) * 20;
        g.fillRect(px, py, 3 * scale, 3 * scale);
      }
      g.globalAlpha = 1;
    }
  }
}

export function drawFlash(g, W, H, flash) {
  if (flash <= 0) return;
  g.fillStyle = `rgba(255, 220, 200, ${flash * 0.55})`;
  g.fillRect(0, 0, W, H);
}
