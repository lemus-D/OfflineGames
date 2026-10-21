/* Canvas 2D — Mario-ish pixel world + limb pickle animations. */

import { hash2i } from '../core/rng.js';
import { TILE, PICKLE, BRINE } from './content.js';

export const PALETTE = {
  skyTop: '#5BA8E8',
  skyBot: '#B8E4F8',
  hillFar: '#5CB85C',
  hillFarShade: '#3A9A3A',
  hillNear: '#48A048',
  hillNearShade: '#2E7A2E',
  cloud: '#FFFFFF',
  cloudLine: '#6A9EC8',
  grass: '#4CD050',
  grassDark: '#2E9A30',
  dirt: '#C47838',
  dirtDark: '#8A5020',
  dirtHi: '#E0A060',
  block: '#B07040',
  blockHi: '#D49858',
  blockLo: '#6E3C18',
  blockEdge: '#3A2010',
  crumbly: '#A88858',
  plat: '#E8C060',
  spike: '#2A2430',
  spring: '#F0E050',
  springBase: '#D04040',
  reverse: 'rgba(160, 90, 210, 0.28)',
  pickle: '#4CA838',
  pickleHi: '#78D050',
  pickleLo: '#2E7020',
  pickleBump: '#3A8028',
  stem: '#6A4420',
  limb: '#1A1810',
  shoe: '#5A3020',
  goalPole: '#E8E8E0',
  goalFlag: '#E03030',
  fakeFlag: '#707080',
  dust: '#D8C090',
  bush: '#38A038',
};

function snap(v) {
  return Math.round(v);
}

function px(g, x, y, w, h, color) {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
}

/** Smiling Mario-style cloud. */
function drawCloud(g, x, y, scale, face = true) {
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);
  // Puffy body
  px(g, 4, 10, 28, 12, PALETTE.cloud);
  px(g, 10, 4, 16, 10, PALETTE.cloud);
  px(g, 0, 12, 10, 8, PALETTE.cloud);
  px(g, 30, 12, 10, 8, PALETTE.cloud);
  // Soft outline nubs
  px(g, 8, 2, 6, 4, PALETTE.cloud);
  px(g, 22, 2, 6, 4, PALETTE.cloud);
  if (face) {
    px(g, 14, 10, 2, 3, '#2A2A2A');
    px(g, 22, 10, 2, 3, '#2A2A2A');
    g.strokeStyle = '#2A2A2A';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(19, 16, 4, 0.15 * Math.PI, 0.85 * Math.PI);
    g.stroke();
  }
  g.restore();
}

function drawHill(g, x, y, r, fill, shade) {
  g.fillStyle = fill;
  g.beginPath();
  g.arc(x, y, r, Math.PI, 0);
  g.lineTo(x + r, y + 4);
  g.lineTo(x - r, y + 4);
  g.closePath();
  g.fill();
  g.fillStyle = shade;
  g.beginPath();
  g.moveTo(x - r * 0.15, y);
  g.arc(x, y, r, Math.PI, Math.PI * 1.45, false);
  g.lineTo(x - r * 0.2, y + 4);
  g.closePath();
  g.fill();
}

export function drawSky(g, W, H, camX, time) {
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, PALETTE.skyTop);
  grad.addColorStop(1, PALETTE.skyBot);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  const wrap = (v, span) => ((v % span) + span) % span;

  // Far hills
  const baseY = H * 0.78;
  for (let i = -1; i < 8; i++) {
    const hx = wrap(i * 160 - camX * 0.2, W + 200) - 20;
    drawHill(g, hx, baseY, 70, PALETTE.hillFar, PALETTE.hillFarShade);
  }
  for (let i = -1; i < 6; i++) {
    const hx = wrap(i * 220 - camX * 0.35, W + 260) + 20;
    drawHill(g, hx, baseY + 10, 55, PALETTE.hillNear, PALETTE.hillNearShade);
  }

  // Smiling clouds (in front of far sky, behind hills visually by y)
  for (let i = 0; i < 6; i++) {
    const drift = time * (10 + i * 3);
    const cx = wrap(i * 190 + 60 - camX * 0.15 - drift, W + 180) - 50;
    const cy = 18 + (i % 3) * 32 + Math.sin(time * 0.6 + i) * 3;
    drawCloud(g, cx, cy, 2.1 + (i % 2) * 0.35, true);
  }
}

function hasSolidAbove(level, tx, ty) {
  if (ty <= 0) return false;
  const c = level.grid[ty - 1][tx];
  return c && c.solid && !c.gone;
}

function drawGroundTile(g, x, y, grassy) {
  // Dirt body with clods
  px(g, x, y, TILE, TILE, PALETTE.dirt);
  px(g, x + 2, y + 7, 4, 3, PALETTE.dirtDark);
  px(g, x + 9, y + 10, 4, 3, PALETTE.dirtDark);
  px(g, x + 5, y + 12, 5, 2, PALETTE.dirtHi);
  px(g, x + 1, y + TILE - 2, TILE - 2, 1, PALETTE.dirtDark);
  if (grassy) {
    px(g, x, y, TILE, 6, PALETTE.grass);
    px(g, x, y + 5, TILE, 2, PALETTE.grassDark);
    // Tall blades
    for (let i = 0; i < 5; i++) {
      const bx = x + 1 + i * 3;
      px(g, bx, y - 3, 2, 4, i % 2 ? PALETTE.grassDark : PALETTE.grass);
    }
  } else {
    px(g, x, y, TILE, 2, PALETTE.dirtHi);
  }
}

function drawBlock(g, x, y, crumbly = false) {
  const fill = crumbly ? PALETTE.crumbly : PALETTE.block;
  const hi = crumbly ? '#C8A878' : PALETTE.blockHi;
  const lo = crumbly ? '#705838' : PALETTE.blockLo;
  px(g, x, y, TILE, TILE, PALETTE.blockEdge);
  px(g, x + 1, y + 1, TILE - 2, TILE - 2, fill);
  // Bevel highlight
  px(g, x + 2, y + 2, TILE - 5, 2, hi);
  px(g, x + 2, y + 2, 2, TILE - 5, hi);
  // Shadow corner
  px(g, x + TILE - 3, y + 3, 1, TILE - 5, lo);
  px(g, x + 3, y + TILE - 3, TILE - 5, 1, lo);
  // Diagonal crack
  px(g, x + 5, y + 5, 6, 1, lo);
  px(g, x + 9, y + 8, 4, 1, lo);
}

function drawPlat(g, x, y) {
  px(g, x, y, TILE, 5, PALETTE.plat);
  px(g, x, y, TILE, 2, '#FFF0A0');
  px(g, x, y + 4, TILE, 1, '#B88830');
}

function drawSpike(g, x, y) {
  g.fillStyle = PALETTE.spike;
  g.beginPath();
  g.moveTo(x + 1, y + TILE);
  g.lineTo(x + TILE / 2, y + 1);
  g.lineTo(x + TILE - 1, y + TILE);
  g.closePath();
  g.fill();
  px(g, x + TILE / 2 - 1, y + 4, 2, 4, '#4A4450');
}

function drawSpring(g, x, y) {
  px(g, x + 2, y + TILE - 5, TILE - 4, 5, PALETTE.springBase);
  px(g, x + 4, y + 3, TILE - 8, TILE - 8, PALETTE.spring);
  px(g, x + 5, y + 4, TILE - 10, 2, '#FFF8A0');
  px(g, x + 5, y + 8, TILE - 10, 1, '#C0A020');
}

function drawGoal(g, x, y, time, fake = false) {
  const px0 = x + TILE / 2;
  px(g, px0 - 1, y - TILE * 2, 2, TILE * 3, PALETTE.goalPole);
  const wave = Math.sin(time * 6 + x * 0.1) * 2;
  g.fillStyle = fake ? PALETTE.fakeFlag : PALETTE.goalFlag;
  g.beginPath();
  g.moveTo(px0 + 1, y - TILE * 2);
  g.lineTo(px0 + 13 + wave, y - TILE * 2 + 6);
  g.lineTo(px0 + 1, y - TILE * 2 + 12);
  g.closePath();
  g.fill();
  if (fake) px(g, px0 + 3, y - TILE * 2 + 4, 5, 2, '#C0C0C8');
}

function drawReverse(g, x, y, time) {
  g.fillStyle = PALETTE.reverse;
  g.fillRect(x, y, TILE, TILE);
  const a = 0.3 + Math.sin(time * 4 + x) * 0.12;
  g.fillStyle = `rgba(220,150,255,${a})`;
  g.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
}

function drawBush(g, x, y) {
  px(g, x + 2, y + 6, 12, 8, PALETTE.bush);
  px(g, x + 5, y + 2, 8, 8, PALETTE.bush);
  px(g, x + 1, y + 8, 4, 4, '#2E802E');
}

export function drawLevel(g, level, camX, camY, scale, time, viewW, viewH) {
  const g0 = level.grid;
  const tx0 = Math.floor(camX / TILE) - 1;
  const ty0 = Math.floor(camY / TILE) - 1;
  const tx1 = tx0 + Math.ceil(viewW / TILE) + 3;
  const ty1 = ty0 + Math.ceil(viewH / TILE) + 3;

  // Decorative bushes on long ground runs (deterministic).
  for (let ty = Math.max(0, ty0); ty < Math.min(level.h, ty1); ty++) {
    for (let tx = Math.max(0, tx0); tx < Math.min(level.w, tx1); tx++) {
      const cell = g0[ty][tx];
      if (!cell || cell.gone) continue;
      if (cell.draw === 'ground' && !hasSolidAbove(level, tx, ty)) {
        if (hash2i(tx, ty, 44) > 0.88) {
          const sx = snap((tx * TILE - camX) * scale);
          const sy = snap((ty * TILE - camY) * scale);
          g.save();
          g.translate(sx, sy - 10 * scale);
          g.scale(scale, scale);
          drawBush(g, 0, 0);
          g.restore();
        }
      }
    }
  }

  for (let ty = Math.max(0, ty0); ty < Math.min(level.h, ty1); ty++) {
    for (let tx = Math.max(0, tx0); tx < Math.min(level.w, tx1); tx++) {
      const cell = g0[ty][tx];
      if (!cell || cell.gone || cell.draw === 'empty') continue;
      if (cell.invisible && !cell.revealed) continue;

      const sx = snap((tx * TILE - camX) * scale);
      const sy = snap((ty * TILE - camY) * scale);

      g.save();
      g.translate(sx, sy);
      g.scale(scale, scale);

      const shaking =
        (cell.vanish || cell.crumbly) && cell.timer > 0
          ? Math.sin(time * 40) * 1.2
          : 0;
      if (shaking) g.translate(shaking, 0);

      switch (cell.draw) {
        case 'ground':
          drawGroundTile(g, 0, 0, !hasSolidAbove(level, tx, ty));
          break;
        case 'block':
          drawBlock(g, 0, 0, false);
          break;
        case 'crumbly':
          drawBlock(g, 0, 0, true);
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
        case 'brick': // legacy alias
          drawBlock(g, 0, 0, false);
          break;
        default:
          break;
      }
      g.restore();
    }
  }
}

/**
 * Limb pickle: idle / walk / jump / dead.
 * Uses p.walkCycle, p.onGround, p.vy, p.facing, p.squish, p.anim.
 */
export function drawPickle(g, p, camX, camY, scale, dead) {
  const sx = snap((p.x - camX) * scale);
  const sy = snap((p.y - camY) * scale);
  const s = scale * (dead ? 0.75 : 1);
  const sq = p.squish || 1;
  const facing = p.facing || 1;
  const onGround = !!p.onGround;
  const walking = onGround && Math.abs(p.vx || 0) > 18 && !dead;
  const jumping = !onGround && !dead;
  const cycle = p.walkCycle || 0;
  const bob = walking ? Math.sin(cycle) * 1.2 : Math.sin((p.anim || 0) * 4) * 0.4;

  g.save();
  g.translate(sx, sy);
  g.scale(facing * s, s);
  g.scale(1 / sq, sq);
  g.translate(0, bob);

  // Leg angles
  let legL = 0;
  let legR = 0;
  let armL = 0.4;
  let armR = -0.35;
  if (walking) {
    legL = Math.sin(cycle) * 0.7;
    legR = Math.sin(cycle + Math.PI) * 0.7;
    armL = Math.sin(cycle + Math.PI) * 0.55;
    armR = Math.sin(cycle) * 0.55;
  } else if (jumping) {
    const up = (p.vy || 0) < 0;
    legL = up ? 0.35 : 0.55;
    legR = up ? -0.15 : 0.25;
    armL = up ? -1.1 : -0.5;
    armR = up ? -0.9 : -0.35;
  }

  const bodyW = 7;
  const bodyH = 9;

  function limb(ox, oy, len, ang, thick = 2.5) {
    g.save();
    g.translate(ox, oy);
    g.rotate(ang);
    px(g, -thick / 2, 0, thick, len, PALETTE.limb);
    g.restore();
  }

  // Back arm + leg
  limb(-bodyW + 1, -2, 7, armL, 2.5);
  limb(-2.5, bodyH - 2, 7, legL, 2.5);
  g.save();
  g.translate(-2.5, bodyH - 2);
  g.rotate(legL);
  px(g, -2, 6, 5, 2.5, PALETTE.shoe);
  g.restore();

  // Body
  g.fillStyle = dead ? '#5A7040' : PALETTE.pickle;
  g.beginPath();
  g.ellipse(0, -1, bodyW, bodyH, 0, 0, Math.PI * 2);
  g.fill();
  // Outline
  g.strokeStyle = PALETTE.pickleLo;
  g.lineWidth = 1;
  g.beginPath();
  g.ellipse(0, -1, bodyW, bodyH, 0, 0, Math.PI * 2);
  g.stroke();

  g.fillStyle = dead ? '#708050' : PALETTE.pickleHi;
  g.beginPath();
  g.ellipse(-2, -4, bodyW * 0.4, bodyH * 0.35, -0.3, 0, Math.PI * 2);
  g.fill();
  // Bumps
  px(g, -4, -5, 2, 2, PALETTE.pickleBump);
  px(g, 2, -2, 2, 2, PALETTE.pickleBump);
  px(g, -3, 2, 2, 2, PALETTE.pickleBump);
  px(g, 3, 3, 2, 2, PALETTE.pickleBump);

  // Stem
  px(g, -1, -bodyH - 4, 2, 5, PALETTE.stem);
  px(g, -2, -bodyH - 5, 4, 2, PALETTE.stem);

  // Face
  if (!dead) {
    px(g, 1, -4, 4, 4, '#FFF');
    px(g, 2, -3, 2, 2, '#1A1810');
    g.strokeStyle = '#1A1810';
    g.lineWidth = 1.25;
    g.beginPath();
    g.arc(2, 1, 3, 0.15 * Math.PI, 0.85 * Math.PI);
    g.stroke();
  } else {
    g.strokeStyle = '#1A1810';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, -5);
    g.lineTo(4, -1);
    g.moveTo(4, -5);
    g.lineTo(0, -1);
    g.stroke();
  }

  // Front arm + leg
  limb(bodyW - 2, -2, 7, armR, 2.5);
  limb(2.5, bodyH - 2, 7, legR, 2.5);
  g.save();
  g.translate(2.5, bodyH - 2);
  g.rotate(legR);
  px(g, -2, 6, 5, 2.5, PALETTE.shoe);
  g.restore();

  g.restore();
}

export function drawBrine(g, brineY, camX, camY, scale, W, H, time) {
  const sy = snap((brineY - camY) * scale);
  if (sy > H + 20) return;
  g.fillStyle = BRINE.color;
  g.globalAlpha = 0.72;
  g.fillRect(0, Math.max(0, sy), W, H - sy + 40);
  g.globalAlpha = 1;
  g.fillStyle = '#C0E050';
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
        const px0 = sx + Math.sin(h * 20 + f.age * 4) * 30 * scale;
        const py0 = sy - t * 50 * scale + (h - 0.5) * 20;
        g.fillRect(px0, py0, 3 * scale, 3 * scale);
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

/** Decorative ground strip for the menu. */
export function drawMenuGround(g, W, H, scale = 3) {
  const tiles = Math.ceil(W / (TILE * scale)) + 1;
  for (let i = 0; i < tiles; i++) {
    g.save();
    g.translate(i * TILE * scale, H - TILE * scale);
    g.scale(scale, scale);
    drawGroundTile(g, 0, 0, true);
    g.restore();
  }
}
