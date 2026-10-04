/* 8-bit procedural art: sky, stars, rocket, gas cans, coins, meteors.
   No asset files. Snapped pixels, flat palette, no gradients. */

import { clamp, hash2i } from '../core/rng.js';
import { WORLD_HALF_W } from './content.js';

/** NES-ish palette */
const P = {
  ink: '#1a1c2c',
  skyLo: '#3d5c94',
  skyMid: '#29366f',
  skyHi: '#0f1020',
  ground: '#c46c2e',
  groundDk: '#8a3e18',
  cloud: '#c0cbdc',
  star: '#f4f4f4',
  white: '#f4f4f4',
  gray: '#a0a0b0',
  grayDk: '#5a5a6e',
  red: '#e43b44',
  redDk: '#9a2130',
  orange: '#f77622',
  yellow: '#fee761',
  gold: '#e8b020',
  goldDk: '#a86a12',
  blue: '#3ca0d0',
  blueDk: '#1e5c8c',
  brown: '#6b3e26',
  brownDk: '#3e2414',
  green: '#33a05b',
};

export function worldToScreen(wx, wy, camY, W, H) {
  const scale = Math.min(W, H) / (WORLD_HALF_W * 1.85);
  return {
    x: W * 0.5 + wx * scale,
    y: H * 0.62 - (wy - camY) * scale,
    scale,
  };
}

function snap(v) {
  return Math.round(v);
}

/** Draw a pixel sprite from a string grid. `.` = empty. */
function blit(g, x, y, px, rows, colors) {
  const ox = snap(x);
  const oy = snap(y);
  for (let row = 0; row < rows.length; row++) {
    const line = rows[row];
    for (let col = 0; col < line.length; col++) {
      const ch = line[col];
      if (ch === '.' || ch === ' ') continue;
      const c = colors[ch];
      if (!c) continue;
      g.fillStyle = c;
      g.fillRect(ox + col * px, oy + row * px, px, px);
    }
  }
}

export function drawSky(g, W, H, altitude, time) {
  g.imageSmoothingEnabled = false;

  const t = clamp(altitude / 3500, 0, 1);
  // Flat color bands — 8-bit sky, not a smooth gradient.
  const bands = t < 0.35
    ? [P.skyHi, P.skyMid, P.skyLo, P.ground]
    : t < 0.7
      ? [P.skyHi, P.skyHi, P.skyMid, P.skyLo]
      : [P.ink, P.skyHi, P.skyHi, P.skyMid];

  const h = H / bands.length;
  for (let i = 0; i < bands.length; i++) {
    g.fillStyle = bands[i];
    g.fillRect(0, snap(i * h), W, Math.ceil(h) + 1);
  }

  // Blocky stars
  const starAlpha = clamp((altitude - 300) / 1600, 0, 1);
  if (starAlpha > 0.05) {
    g.globalAlpha = starAlpha;
    g.fillStyle = P.star;
    const cols = 16;
    const rows = 22;
    const scroll = Math.floor(altitude / 28);
    for (let iy = 0; iy < rows; iy++) {
      for (let ix = 0; ix < cols; ix++) {
        const n = hash2i(ix, iy + scroll, 91);
        if (n < 0.78) continue;
        const x = snap(((ix + 0.3) / cols) * W);
        const y = snap((((iy + (altitude * 0.003) % 1) / rows) * H + H) % H);
        const s = n > 0.93 ? 3 : 2;
        g.fillRect(x, y, s, s);
      }
    }
    g.globalAlpha = 1;
  }

  // Chunk clouds near ground
  if (t < 0.5) {
    g.fillStyle = P.cloud;
    g.globalAlpha = 0.35 * (1 - t / 0.5);
    for (let i = 0; i < 4; i++) {
      const cx = snap((0.15 + i * 0.22) * W + Math.sin(time * 0.4 + i) * 8);
      const cy = snap(H * (0.58 + i * 0.07));
      g.fillRect(cx, cy, 48, 10);
      g.fillRect(cx + 10, cy - 8, 28, 8);
      g.fillRect(cx + 18, cy + 8, 22, 6);
    }
    g.globalAlpha = 1;
  }

  // Ground strip when near pad
  if (altitude < 220) {
    const gy = snap(H * 0.62 + altitude * (Math.min(W, H) / (WORLD_HALF_W * 1.85)));
    if (gy < H) {
      g.fillStyle = P.groundDk;
      g.fillRect(0, gy, W, H - gy);
      g.fillStyle = P.ground;
      g.fillRect(0, gy, W, 8);
      g.fillStyle = P.green;
      for (let x = 0; x < W; x += 12) {
        if (hash2i(x, 3, 2) > 0.55) g.fillRect(x, gy - 4, 4, 4);
      }
    }
  }
}

const ROCKET_SPRITE = [
  '..wwww..',
  '.wyyyww.',
  'wwyyyyww',
  'wwbbyyww',
  'wwbbyyww',
  'wwyyyyww',
  'rwwwwwwr',
  'rr....rr',
];

const ROCKET_COLORS = {
  w: P.white,
  y: P.gray,
  b: P.blue,
  r: P.red,
};

const FLAME_A = ['..o..', '.oyo.', 'oyyyo', '.o.o.'];
const FLAME_B = ['.o.o.', 'oyoyo', '.yyy.', '..o..'];
const FLAME_COLORS = { o: P.orange, y: P.yellow };

/** Classic red jerry can / gas canister. */
const CAN_SPRITE = [
  '..kkkk..',
  '.kkrrkk.',
  'kkrrrrkk',
  'krrrrrrk',
  'krrYYrrk',
  'krrrrrrk',
  'krrrrrrk',
  '.kkkkkk.',
];

const CAN_COLORS = {
  k: P.ink,
  r: P.red,
  Y: P.yellow,
};

const COIN_SPRITE = [
  '..yyyy..',
  '.yyGGyy.',
  'yyGGGGyy',
  'yGG$$GGy',
  'yGG$$GGy',
  'yyGGGGyy',
  '.yyGGyy.',
  '..yyyy..',
];

const COIN_COLORS = {
  y: P.yellow,
  G: P.gold,
  $: P.goldDk,
};

const METEOR_SPRITE = [
  '..mmmm..',
  '.mddmmm.',
  'mmmdmomm',
  'mmmmmomm',
  'mommmmmm',
  'mmommdmm',
  '.mmmmmm.',
  '..mmmm..',
];

const METEOR_COLORS = {
  m: P.brown,
  d: P.brownDk,
  o: P.orange,
};

export function drawPickup(g, kind, x, y, r, spin, time) {
  g.imageSmoothingEnabled = false;
  const px = Math.max(2, Math.round(r / 4));
  const bob = Math.sin(time * 5 + spin) * px * 0.4;

  if (kind === 'fuel') {
    const w = 8 * px;
    const h = 8 * px;
    blit(g, x - w / 2, y - h / 2 + bob, px, CAN_SPRITE, CAN_COLORS);
    // Spout / handle accent
    g.fillStyle = P.gray;
    g.fillRect(snap(x + w * 0.25), snap(y - h / 2 + bob - px), px * 2, px);
    g.fillStyle = P.redDk;
    g.fillRect(snap(x - w * 0.15), snap(y - h / 2 + bob), px * 3, px);
  } else if (kind === 'coin') {
    const w = 8 * px;
    blit(g, x - w / 2, y - w / 2 + bob, px, COIN_SPRITE, COIN_COLORS);
  } else {
    const w = 8 * px;
    // 4-way rotate feel without smooth spin
    const frame = Math.floor(((spin % (Math.PI * 2)) + Math.PI * 2) / (Math.PI / 2)) % 2;
    g.save();
    g.translate(snap(x), snap(y));
    if (frame) g.scale(-1, 1);
    blit(g, -w / 2, -w / 2, px, METEOR_SPRITE, METEOR_COLORS);
    g.restore();
  }
}

export function drawRocket(g, x, y, scale, tilt, time, thrusting) {
  g.imageSmoothingEnabled = false;
  const px = Math.max(2, Math.round(scale * 3.2));
  const lean = Math.round(tilt * px * 1.2);

  if (thrusting) {
    const flame = Math.floor(time * 12) % 2 === 0 ? FLAME_A : FLAME_B;
    blit(g, x - (5 * px) / 2 + lean, y + 7 * px, px, flame, FLAME_COLORS);
  }

  blit(g, x - (8 * px) / 2 + lean, y - (8 * px) / 2, px, ROCKET_SPRITE, ROCKET_COLORS);

  // Nose tip
  g.fillStyle = P.red;
  g.fillRect(snap(x - px + lean), snap(y - 5 * px), px * 2, px);
}

export function drawCollectFx(g, fx, camY, W, H, time) {
  const u = fx.age / fx.life;
  const scr = worldToScreen(fx.x, fx.y, camY, W, H);
  const s = Math.max(2, Math.round((6 + u * 14) * scr.scale * 0.15));
  g.imageSmoothingEnabled = false;
  g.fillStyle =
    fx.kind === 'meteor' ? P.orange : fx.kind === 'coin' ? P.yellow : P.red;
  g.globalAlpha = 1 - u;
  g.fillRect(snap(scr.x - s), snap(scr.y - s), s * 2, 2);
  g.fillRect(snap(scr.x - s), snap(scr.y + s), s * 2, 2);
  g.fillRect(snap(scr.x - s), snap(scr.y - s), 2, s * 2);
  g.fillRect(snap(scr.x + s), snap(scr.y - s), 2, s * 2);
  g.globalAlpha = 1;
}

export function drawHitFlash(g, W, H, flash) {
  if (flash <= 0) return;
  g.fillStyle = P.red;
  g.globalAlpha = flash * 0.35;
  g.fillRect(0, 0, W, H);
  g.globalAlpha = 1;
}
