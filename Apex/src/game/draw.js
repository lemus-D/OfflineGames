/* 8-bit procedural art: sky, stars, rocket, gas cans, coins, meteors, black holes.
   No asset files. Snapped pixels, flat palette. Sky color follows altitude.
   Camera tracks X+Y; world X wraps for an infinite side-to-side map. */

import { clamp, hash2i } from '../core/rng.js';
import { WORLD_HALF_W, wrapX, PAD } from './content.js';
import { gameToKm, skyColorAtKm, bodiesNear, bodyVisualScale } from './altitude.js';

/** NES-ish palette */
const P = {
  ink: '#0f1020',
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
  brown: '#6b3e26',
  brownDk: '#3e2414',
  green: '#33a05b',
  moon: '#c8c8d0',
  moonDk: '#787888',
  mars: '#c45a3a',
  marsDk: '#7a2e18',
  marsLt: '#e08050',
  venus: '#e8d0a0',
  venusDk: '#b09060',
  sun: '#ffe08a',
  sunCore: '#ffc040',
  sunHot: '#ff6a20',
  jupiter: '#d0a070',
  jupiterBand: '#c07040',
  jupiterLt: '#f0d0a8',
  saturn: '#e0c888',
  saturnDk: '#b09050',
  ring: '#d8c8a0',
  uranus: '#7ec8d0',
  uranusDk: '#3a8898',
  neptune: '#3a6ad0',
  neptuneDk: '#1e3e90',
  pluto: '#b0a090',
  plutoDk: '#706050',
  mercury: '#9a9088',
  mercuryDk: '#5a5048',
  mercuryLt: '#c8c0b4',
  rock: '#8a7060',
  rockLt: '#b09880',
  void: '#05060c',
  accretion: '#e07040',
  accretionLt: '#ffc878',
  disk: '#6a3a88',
};

/**
 * World → screen. camX/camY are camera world anchors; X is wrap-relative
 * so the map reads as infinite side-to-side.
 * Legacy call: worldToScreen(wx, wy, camY, W, H) still works (camX = 0).
 */
export function worldToScreen(wx, wy, camYOrCamX, WOrCamY, HOrW, maybeH) {
  let camX = 0;
  let camY;
  let W;
  let H;
  if (maybeH !== undefined) {
    camX = camYOrCamX;
    camY = WOrCamY;
    W = HOrW;
    H = maybeH;
  } else {
    camY = camYOrCamX;
    W = WOrCamY;
    H = HOrW;
  }
  const scale = Math.min(W, H) / (WORLD_HALF_W * 1.85);
  const relX = wrapX(wx - camX);
  return {
    x: W * 0.5 + relX * scale,
    y: H * 0.62 - (wy - camY) * scale,
    scale,
  };
}

function snap(v) {
  return Math.round(v);
}

function rgb([r, g, b]) {
  return `rgb(${r},${g},${b})`;
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

/** Pre-rasterize a sprite so rotation uses one drawImage (no fillRect smear). */
const spriteCache = new Map();
function spriteCanvas(key, rows, colors, px) {
  const id = `${key}@${px}`;
  let c = spriteCache.get(id);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = rows[0].length * px;
  c.height = rows.length * px;
  const cg = c.getContext('2d');
  cg.imageSmoothingEnabled = false;
  blit(cg, 0, 0, px, rows, colors);
  spriteCache.set(id, c);
  return c;
}

/** @param {number} [camX=0] camera world X — scrolls ground/stars horizontally */
export function drawSky(g, W, H, altitude, time, camX = 0) {
  g.imageSmoothingEnabled = false;
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';

  const km = gameToKm(altitude);
  const col = skyColorAtKm(km);
  g.fillStyle = rgb(col);
  g.fillRect(0, 0, W, H);

  const scale = Math.min(W, H) / (WORLD_HALF_W * 1.85);
  const xScroll = camX * scale;

  // Thermosphere aurora shimmer (very subtle).
  if (km > 85 && km < 600) {
    const a = clamp((km - 85) / 200, 0, 0.12) * (1 - clamp((km - 400) / 200, 0, 1));
    g.globalAlpha = a * (0.7 + Math.sin(time * 2) * 0.3);
    g.fillStyle = '#3dcea0';
    g.fillRect(0, 0, W, snap(H * 0.35));
    g.fillStyle = '#c45a9a';
    g.fillRect(0, snap(H * 0.2), W, snap(H * 0.25));
    g.globalAlpha = 1;
  }

  // Ground + clouds only in low troposphere.
  if (km < 8) {
    const gy = snap(H * 0.62 + altitude * scale);
    if (gy < H && gy > 0) {
      g.fillStyle = P.groundDk;
      g.fillRect(0, gy, W, H - gy);
      g.fillStyle = P.ground;
      g.fillRect(0, gy, W, 8);
      g.fillStyle = P.green;
      const grassOff = Math.floor(xScroll) % 12;
      for (let x = -12; x < W + 12; x += 12) {
        const gx = x - grassOff;
        if (hash2i(Math.floor((gx + camX) / 12), 3, 2) > 0.55) {
          g.fillRect(gx, gy - 4, 4, 4);
        }
      }
    }
    g.fillStyle = P.cloud;
    g.globalAlpha = 0.3 * (1 - km / 8);
    for (let i = 0; i < 3; i++) {
      const base = (0.2 + i * 0.25) * W + Math.sin(time * 0.4 + i) * 8;
      const cx = snap((((base - xScroll * 0.35) % (W + 80)) + W + 80) % (W + 80) - 40);
      const cy = snap(H * (0.55 + i * 0.08));
      g.fillRect(cx, cy, 44, 10);
      g.fillRect(cx + 10, cy - 8, 24, 8);
    }
    g.globalAlpha = 1;
  }

  // Stars fade in through mesosphere / thermosphere.
  const starAlpha = clamp((km - 40) / 80, 0, 1);
  if (starAlpha > 0.04) {
    g.globalAlpha = starAlpha;
    g.fillStyle = P.star;
    const cols = 16;
    const rows = 22;
    const scrollY = Math.floor(altitude / 28);
    const scrollX = Math.floor(camX / 40);
    for (let iy = 0; iy < rows; iy++) {
      for (let ix = 0; ix < cols; ix++) {
        const n = hash2i(ix + scrollX, iy + scrollY, 91);
        if (n < 0.78) continue;
        const x = snap(((((ix + 0.3) / cols) * W - xScroll * 0.15) % W + W) % W);
        const y = snap((((iy + (altitude * 0.003) % 1) / rows) * H + H) % H);
        const s = n > 0.93 ? 3 : 2;
        g.fillRect(x, y, s, s);
      }
    }
    g.globalAlpha = 1;
  }
}

const MOON_SPRITE = [
  '....mmmmmm....',
  '..mmmmmmmmmm..',
  '.mmmmdmmmmmmm.',
  '.mmmmmmmmmdmm.',
  'mmmdmmmmmmmmmm',
  'mmmmmmmmdmmmmm',
  'mmmmmmmmmmmmmm',
  'mmmmdmmmmmmmmm',
  'mmmmmmmmmdmmmm',
  'mmmmmmmmmmmmmm',
  '.mmmmmdmmmmm.',
  '.mmmmmmmmmmm.',
  '..mmmmmmmmmm..',
  '....mmmmmm....',
];
const MOON_COLORS = { m: P.moon, d: P.moonDk };

const MARS_SPRITE = [
  '....rrrrrr....',
  '..rrRRrrRRrr..',
  '.rrrrrrrrrrrr.',
  '.rrRrrrrrrrRr.',
  'rrrrrrDrrrrrrr',
  'rrrRrrrrrrRrrr',
  'rrrrrrrrrrrrrr',
  'rrRrrrDrrrrRrr',
  'rrrrrrrrrrrrrr',
  '.rrrrRrrrrrrr.',
  '.rrrrrrrrrrrr.',
  '..rrrrrrrrrr..',
  '....rrrrrr....',
];
const MARS_COLORS = { r: P.mars, R: P.marsLt, D: P.marsDk };

const VENUS_SPRITE = [
  '....vvvvvv....',
  '..vvvvvvvvvv..',
  '.vvvvVvvvvvvv.',
  '.vvvvvvvvvvvv.',
  'vvvvvvvvvvvvvv',
  'vvvVvvvvvvVvvv',
  'vvvvvvvvvvvvvv',
  'vvvvvvVvvvvvvv',
  'vvvvvvvvvvvvvv',
  '.vvvvvvvvvvvv.',
  '.vvvvVvvvvvvv.',
  '..vvvvvvvvvv..',
  '....vvvvvv....',
];
const VENUS_COLORS = { v: P.venus, V: P.venusDk };

const MERCURY_SPRITE = [
  '....hhhhhh....',
  '..hhhhhhhhhh..',
  '.hhhHhhhhhhhh.',
  '.hhhhhhhhhHhh.',
  'hhhhDhhhhhhhhh',
  'hhhHhhhhhhHhhh',
  'hhhhhhhhhhhhhh',
  'hhHhhhDhhhhHhh',
  'hhhhhhhhhhhhhh',
  '.hhhhHhhhhhhh.',
  '.hhhhhhhhhhhh.',
  '..hhhhhhhhhh..',
  '....hhhhhh....',
];
const MERCURY_COLORS = { h: P.mercury, H: P.mercuryLt, D: P.mercuryDk };

const SUN_SPRITE = [
  '......yy......',
  '......yy......',
  '..y..yyyy..y..',
  '...yyyyyyyy...',
  '..yyYYccYYyy..',
  '.yyYccccccYyy.',
  'yyYcccHHcccYyy',
  'yyYccHHHHccYyy',
  'yyYcccHHcccYyy',
  '.yyYccccccYyy.',
  '..yyYYccYYyy..',
  '...yyyyyyyy...',
  '..y..yyyy..y..',
  '......yy......',
  '......yy......',
];
const SUN_COLORS = { y: P.sun, Y: P.sunCore, c: P.sunCore, H: P.sunHot };

const JUPITER_SPRITE = [
  '....jjjjjj....',
  '..jjJJjjJJjj..',
  '.jjjjjjjjjjjj.',
  '.jBBBBBBBBjjj.',
  'jjjjjjjjjjjjjj',
  'jjJjjjjjjjJjjj',
  'jBBBBBBBBjjjjj',
  'jjjjRRjjjjjjjj',
  'jjjjjjjjjjjjjj',
  '.jBBBBBBBBjjj.',
  '.jjjjjjjjjjjj.',
  '..jjjjjjjjjj..',
  '....jjjjjj....',
];
const JUPITER_COLORS = { j: P.jupiter, J: P.jupiterLt, B: P.jupiterBand, R: P.red };

const SATURN_SPRITE = [
  '......ssss......',
  '....ssssssss....',
  '...ssSSssSSss...',
  '..ssssssssssss..',
  'rrrrrrssssrrrrrr',
  'rrrrssssssssrrrr',
  '..ssssDDssssss..',
  '...ssssssssss...',
  '....ssssssss....',
  '......ssss......',
];
const SATURN_COLORS = { s: P.saturn, S: P.saturnDk, D: P.goldDk, r: P.ring };

const URANUS_SPRITE = [
  '....uuuuuu....',
  '..uuuuuuuuuu..',
  '.uuuuUuuuuuuu.',
  '.uuuuuuuuuuuu.',
  'uuuuuuuuuuuuuu',
  'uuuUuuuuuuUuuu',
  'uuuuuuuuuuuuuu',
  'uuuuuuUuuuuuuu',
  'uuuuuuuuuuuuuu',
  '.uuuuuuuuuuuu.',
  '.uuuuUuuuuuuu.',
  '..uuuuuuuuuu..',
  '....uuuuuu....',
];
const URANUS_COLORS = { u: P.uranus, U: P.uranusDk };

const NEPTUNE_SPRITE = [
  '....nnnnnn....',
  '..nnnnnnnnnn..',
  '.nnnnNnnnnnnn.',
  '.nnnnnnnnnnnn.',
  'nnnnnnnnnnnnnn',
  'nnnNnnnnnnNnnn',
  'nnnnnnDDnnnnnn',
  'nnnnnnnnnnnnnn',
  'nnnnnnnnnnnnnn',
  '.nnnnnnnnnnnn.',
  '.nnnnNnnnnnnn.',
  '..nnnnnnnnnn..',
  '....nnnnnn....',
];
const NEPTUNE_COLORS = { n: P.neptune, N: P.neptuneDk, D: P.white };

const PLUTO_SPRITE = [
  '...pppp...',
  '..ppPPpp..',
  '.pppppppp.',
  '.ppPpppPp.',
  'ppppdppppp',
  'pppPpppppp',
  'pppppppppp',
  '.ppppPppp.',
  '.pppppppp.',
  '..pppppp..',
  '...pppp...',
];
const PLUTO_COLORS = { p: P.pluto, P: P.rockLt, d: P.plutoDk };

const BODY_ART = {
  moon: { rows: MOON_SPRITE, colors: MOON_COLORS, halo: P.moon },
  mars: { rows: MARS_SPRITE, colors: MARS_COLORS, halo: P.mars },
  venus: { rows: VENUS_SPRITE, colors: VENUS_COLORS, halo: P.venus },
  mercury: { rows: MERCURY_SPRITE, colors: MERCURY_COLORS, halo: P.mercury },
  sun: { rows: SUN_SPRITE, colors: SUN_COLORS, halo: P.sun },
  jupiter: { rows: JUPITER_SPRITE, colors: JUPITER_COLORS, halo: P.jupiter },
  saturn: { rows: SATURN_SPRITE, colors: SATURN_COLORS, halo: P.saturn },
  uranus: { rows: URANUS_SPRITE, colors: URANUS_COLORS, halo: P.uranus },
  neptune: { rows: NEPTUNE_SPRITE, colors: NEPTUNE_COLORS, halo: P.neptune },
  pluto: { rows: PLUTO_SPRITE, colors: PLUTO_COLORS, halo: P.pluto },
};

function drawAsteroidBelt(g, body, camX, camY, W, H, time, near) {
  const count = 14;
  for (let i = 0; i < count; i++) {
    const n = hash2i(i, 7, 3);
    const ox = (n * 2 - 1) * 200;
    const oy = (hash2i(i, 11, 5) - 0.5) * 80;
    const scr = worldToScreen(body.x + ox, body.gameY + oy, camX, camY, W, H);
    const px = Math.max(2, Math.round(2 + near * 3 + n * 2));
    const bob = Math.sin(time * 1.2 + i) * 2;
    g.fillStyle = n > 0.55 ? P.rockLt : P.rock;
    g.fillRect(snap(scr.x - px), snap(scr.y - px + bob), px * 2, px * 2);
    if (n > 0.7) {
      g.fillStyle = P.brownDk;
      g.fillRect(snap(scr.x), snap(scr.y + bob), px, px);
    }
  }
}

/** Draw solar-system bodies when the camera is near their game altitude. */
export function drawCelestials(g, W, H, camY, time, camX = 0) {
  g.imageSmoothingEnabled = false;
  for (const body of bodiesNear(camY, 1800)) {
    const dist = Math.abs(body.gameY - camY);
    const near = 1 - clamp(dist / 1800, 0, 1);

    if (body.art === 'belt') {
      drawAsteroidBelt(g, body, camX, camY, W, H, time, near);
      if (near > 0.45) {
        g.fillStyle = '#e8eef8';
        g.font = 'bold 12px Courier New, monospace';
        g.textAlign = 'center';
        const scr = worldToScreen(body.x, body.gameY, camX, camY, W, H);
        g.fillText(body.name.toUpperCase(), snap(scr.x), snap(scr.y + 40));
      }
      continue;
    }

    const art = BODY_ART[body.art] || BODY_ART.moon;
    const scr = worldToScreen(body.x, body.gameY, camX, camY, W, H);
    // Relative size from real mean radius (compressed power curve).
    const sizeMul = bodyVisualScale(body.radiusKm);
    const basePx = 3 + near * 3;
    const px = Math.max(2, Math.round(basePx * sizeMul));
    const sheet = spriteCanvas(`${body.art}@${px}`, art.rows, art.colors, px);
    const w = sheet.width;
    const h = sheet.height;
    if (scr.y < -h || scr.y > H + h) continue;
    // Skip if wrapped far off the sides (keep a generous margin for giants).
    if (scr.x < -w * 1.2 || scr.x > W + w * 1.2) continue;

    g.globalAlpha = 0.12 + near * 0.22;
    g.fillStyle = art.halo;
    g.fillRect(snap(scr.x - w * 0.55), snap(scr.y - h * 0.55), snap(w * 1.1), snap(h * 1.1));
    g.globalAlpha = 1;

    g.imageSmoothingEnabled = false;
    g.drawImage(
      sheet,
      snap(scr.x - w / 2),
      snap(scr.y - h / 2 + Math.sin(time * 0.6 + body.gameY) * 2)
    );

    if (near > 0.45) {
      g.fillStyle = '#e8eef8';
      g.font = 'bold 12px Courier New, monospace';
      g.textAlign = 'center';
      g.fillText(body.name.toUpperCase(), snap(scr.x), snap(scr.y + h / 2 + 16));
    }
  }
}

export function drawFlybyBanner(g, W, H, text, age, life) {
  if (!text || age >= life) return;
  const u = age / life;
  g.save();
  g.globalAlpha = u < 0.15 ? u / 0.15 : u > 0.75 ? (1 - u) / 0.25 : 1;
  g.fillStyle = '#05070c';
  g.fillRect(W * 0.5 - 120, H * 0.18, 240, 36);
  g.strokeStyle = '#fee761';
  g.lineWidth = 2;
  g.strokeRect(W * 0.5 - 120, H * 0.18, 240, 36);
  g.fillStyle = '#fee761';
  g.font = 'bold 16px Courier New, monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, W * 0.5, H * 0.18 + 18);
  g.restore();
}

/**
 * 8-bit launch pad at world (PAD.x, 0) with a deck at PAD.deckY.
 * Drawn when the camera is still near the ground.
 */
export function drawLaunchPad(g, W, H, camY, camX = 0) {
  if (camY > 520) return;
  g.imageSmoothingEnabled = false;

  const deck = worldToScreen(PAD.x, PAD.deckY, camX, camY, W, H);
  const ground = worldToScreen(PAD.x, 0, camX, camY, W, H);
  const left = worldToScreen(PAD.x - PAD.halfW, PAD.deckY, camX, camY, W, H);
  const right = worldToScreen(PAD.x + PAD.halfW, PAD.deckY, camX, camY, W, H);
  const deckW = Math.max(8, right.x - left.x);
  const deckH = Math.max(4, Math.round(6 * deck.scale * 0.08));
  const legW = Math.max(3, Math.round(4 * deck.scale * 0.08));
  const groundY = snap(ground.y);

  g.fillStyle = '#5a5a6e';
  g.fillRect(snap(left.x - 8), groundY - 4, snap(deckW + 16), 10);
  g.fillStyle = '#3a3a4a';
  g.fillRect(snap(left.x - 8), groundY + 2, snap(deckW + 16), 6);

  const legInset = Math.round(deckW * 0.12);
  g.fillStyle = '#8a93a8';
  g.fillRect(snap(left.x + legInset), snap(deck.y), legW, Math.max(4, groundY - snap(deck.y)));
  g.fillRect(snap(right.x - legInset - legW), snap(deck.y), legW, Math.max(4, groundY - snap(deck.y)));
  g.fillStyle = '#6a7388';
  g.fillRect(snap(left.x + legInset), snap((deck.y + groundY) / 2), snap(deckW - legInset * 2), 3);

  g.fillStyle = '#c0cbdc';
  g.fillRect(snap(left.x), snap(deck.y - deckH), snap(deckW), deckH + 2);
  g.fillStyle = '#e8eef8';
  g.fillRect(snap(left.x), snap(deck.y - deckH), snap(deckW), 3);
  g.fillStyle = '#fee761';
  for (let x = snap(left.x) + 4; x < snap(right.x) - 6; x += 14) {
    g.fillRect(x, snap(deck.y - deckH + 4), 8, Math.max(2, deckH - 4));
  }
  g.fillStyle = '#1a1c2c';
  for (let x = snap(left.x) + 11; x < snap(right.x) - 6; x += 14) {
    g.fillRect(x, snap(deck.y - deckH + 4), 3, Math.max(2, deckH - 4));
  }

  const towerX = snap(right.x + 6);
  g.fillStyle = '#8a93a8';
  g.fillRect(towerX, snap(deck.y - 52 * deck.scale * 0.08), 5, Math.max(8, groundY - snap(deck.y - 52 * deck.scale * 0.08)));
  g.fillStyle = '#fee761';
  g.fillRect(towerX - 1, snap(deck.y - 52 * deck.scale * 0.08), 7, 4);
  g.fillStyle = '#6a7388';
  g.fillRect(snap(right.x - 4), snap(deck.y - 28 * deck.scale * 0.08), snap(towerX - right.x + 4), 3);

  g.fillStyle = '#1a1c2c';
  g.font = `bold ${Math.max(9, Math.round(11 * deck.scale * 0.08))}px Courier New, monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('PAD-1', snap(deck.x), snap(deck.y - deckH / 2));
}

/** Long slim rocket (17 rows × 7 cols). */
const ROCKET_SPRITE = [
  '...r...',
  '..rrr..',
  '.wwyww.',
  '.wwyww.',
  '.wwyww.',
  '.wwyww.',
  '.wbbyw.',
  '.wbbyw.',
  '.wwyww.',
  '.wwyww.',
  '.wwyww.',
  '.wwyww.',
  '.wwyww.',
  '.wwyww.',
  'rwwwwwr',
  'rr...rr',
  'r.....r',
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

function drawBlackHole(g, x, y, r, spin, time) {
  const px = Math.max(2, Math.round(r / 5));
  const cx = snap(x);
  const cy = snap(y);
  const outer = Math.max(10, snap(r));
  const mid = Math.max(6, snap(r * 0.62));
  const core = Math.max(3, snap(r * 0.28));

  // Accretion disk (flat ellipse band).
  g.save();
  g.translate(cx, cy);
  g.rotate(spin * 0.35 + time * 0.4);
  g.fillStyle = P.disk;
  g.globalAlpha = 0.55;
  g.fillRect(-outer, -Math.max(2, px), outer * 2, Math.max(4, px * 2));
  g.fillStyle = P.accretion;
  g.globalAlpha = 0.85;
  g.fillRect(-outer + px, -Math.max(2, px - 1), outer * 2 - px * 2, Math.max(3, px));
  g.fillStyle = P.accretionLt;
  g.globalAlpha = 0.7;
  g.fillRect(-mid, -Math.max(1, px - 2), mid * 2, Math.max(2, px - 1));
  g.restore();

  // Event horizon + hot ring.
  g.globalAlpha = 1;
  g.fillStyle = P.void;
  g.fillRect(cx - core, cy - core, core * 2, core * 2);
  g.fillStyle = P.ink;
  g.fillRect(cx - core + 1, cy - core + 1, Math.max(2, core * 2 - 2), Math.max(2, core * 2 - 2));
  g.fillStyle = P.accretionLt;
  g.fillRect(cx - mid, cy - 1, mid * 2, 2);
  g.fillRect(cx - 1, cy - mid, 2, mid * 2);
  // Photon-ring ticks.
  g.fillStyle = P.accretion;
  const tick = Math.max(2, px);
  for (let i = 0; i < 6; i++) {
    const a = spin + i * (Math.PI / 3) + time;
    const tx = snap(cx + Math.cos(a) * mid);
    const ty = snap(cy + Math.sin(a) * mid * 0.55);
    g.fillRect(tx, ty, tick, tick);
  }
}

export function drawPickup(g, kind, x, y, r, spin, time) {
  g.imageSmoothingEnabled = false;
  const px = Math.max(2, Math.round(r / 4));
  const bob = Math.sin(time * 5 + spin) * px * 0.4;

  if (kind === 'fuel') {
    const w = 8 * px;
    const h = 8 * px;
    blit(g, x - w / 2, y - h / 2 + bob, px, CAN_SPRITE, CAN_COLORS);
    g.fillStyle = P.gray;
    g.fillRect(snap(x + w * 0.25), snap(y - h / 2 + bob - px), px * 2, px);
    g.fillStyle = P.redDk;
    g.fillRect(snap(x - w * 0.15), snap(y - h / 2 + bob), px * 3, px);
  } else if (kind === 'coin') {
    const w = 8 * px;
    blit(g, x - w / 2, y - w / 2 + bob, px, COIN_SPRITE, COIN_COLORS);
  } else if (kind === 'blackhole') {
    drawBlackHole(g, x, y, r, spin, time);
  } else {
    const w = 8 * px;
    const frame = Math.floor(((spin % (Math.PI * 2)) + Math.PI * 2) / (Math.PI / 2)) % 2;
    g.save();
    g.translate(snap(x), snap(y));
    if (frame) g.scale(-1, 1);
    blit(g, -w / 2, -w / 2, px, METEOR_SPRITE, METEOR_COLORS);
    g.restore();
  }
}

/** Scratch canvas: compose upright rocket+flame, then one rotated blit. */
let rocketPose = null;
function poseCanvas(w, h) {
  if (!rocketPose || rocketPose.width < w || rocketPose.height < h) {
    rocketPose = document.createElement('canvas');
    rocketPose.width = Math.max(w, 64);
    rocketPose.height = Math.max(h, 96);
  }
  return rocketPose;
}

/**
 * Single rotated drawImage of a precomposed upright sprite.
 * Opaque parent canvas + one blit kills high-speed afterimages.
 */
export function drawRocket(g, x, y, scale, tilt, time, thrusting) {
  g.imageSmoothingEnabled = false;
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';

  const px = Math.max(2, Math.round(scale * 3.1));
  const sheet = spriteCanvas('rocket', ROCKET_SPRITE, ROCKET_COLORS, px);
  const bodyW = sheet.width;
  const bodyH = sheet.height;
  const flameH = thrusting ? 4 * px : 0;
  const pad = px * 2;
  const poseW = bodyW + pad * 2;
  const poseH = bodyH + flameH + pad * 2;
  const pose = poseCanvas(poseW, poseH);
  const pg = pose.getContext('2d', { alpha: true });
  pg.setTransform(1, 0, 0, 1, 0, 0);
  pg.globalAlpha = 1;
  pg.globalCompositeOperation = 'source-over';
  pg.imageSmoothingEnabled = false;
  pg.clearRect(0, 0, pose.width, pose.height);

  const ox = pad;
  const oy = pad;
  if (thrusting) {
    const flame = Math.floor(time * 8) % 2 === 0 ? FLAME_A : FLAME_B;
    const flameSheet = spriteCanvas(flame === FLAME_A ? 'flameA' : 'flameB', flame, FLAME_COLORS, px);
    pg.drawImage(flameSheet, ox + Math.floor((bodyW - flameSheet.width) / 2), oy + bodyH - px * 2);
  }
  pg.drawImage(sheet, ox, oy);

  // Device-pixel snap of the screen anchor (parent transform is CSS-scaled).
  const ax = Math.round(x);
  const ay = Math.round(y);

  g.save();
  g.translate(ax, ay);
  g.rotate(tilt);
  g.imageSmoothingEnabled = false;
  g.drawImage(pose, 0, 0, poseW, poseH, Math.round(-poseW / 2), Math.round(-poseH / 2), poseW, poseH);
  g.restore();
}

export function drawCollectFx(g, fx, camY, W, H, time, camX = 0) {
  const u = fx.age / fx.life;
  const scr = worldToScreen(fx.x, fx.y, camX, camY, W, H);
  const s = Math.max(2, Math.round((6 + u * 14) * scr.scale * 0.15));
  g.imageSmoothingEnabled = false;
  g.fillStyle =
    fx.kind === 'meteor'
      ? P.orange
      : fx.kind === 'blackhole'
        ? P.accretion
        : fx.kind === 'coin'
          ? P.yellow
          : P.red;
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
