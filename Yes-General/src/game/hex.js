/* Axial hex math + seeded map generation. */

import { makeRNG, pickWeighted } from '../core/rng.js';
import { RESOURCE_SPAWN_WEIGHTS, RESOURCES } from '../data/content.js';

/** Flat-top axial neighbors (q, r). */
export const HEX_DIRS = [
  [+1, 0],
  [+1, -1],
  [0, -1],
  [-1, 0],
  [-1, +1],
  [0, +1],
];

export function hexKey(q, r) {
  return `${q},${r}`;
}

export function parseKey(key) {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

export function hexNeighbors(q, r) {
  return HEX_DIRS.map(([dq, dr]) => ({ q: q + dq, r: r + dr }));
}

export function hexDistance(a, b) {
  const aq = a.q,
    ar = a.r,
    as_ = -aq - ar;
  const bq = b.q,
    br = b.r,
    bs = -bq - br;
  return Math.max(Math.abs(aq - bq), Math.abs(ar - br), Math.abs(as_ - bs));
}

/** Pixel center for flat-top hex. */
export function hexToPixel(q, r, size) {
  const x = size * ((3 / 2) * q);
  const y = size * ((Math.sqrt(3) / 2) * q + Math.sqrt(3) * r);
  return { x, y };
}

/** Inverse of hexToPixel (approx → nearest axial). */
export function pixelToHex(x, y, size) {
  const q = ((2 / 3) * x) / size;
  const r = ((-1 / 3) * x + (Math.sqrt(3) / 3) * y) / size;
  return hexRound(q, r);
}

function hexRound(q, r) {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  let rs = Math.round(s);
  const qDiff = Math.abs(rq - q);
  const rDiff = Math.abs(rr - r);
  const sDiff = Math.abs(rs - s);
  if (qDiff > rDiff && qDiff > sDiff) rq = -rr - rs;
  else if (rDiff > sDiff) rr = -rq - rs;
  return { q: rq, r: rr };
}

/**
 * Generate a hex disk of given radius.
 * @returns {Map<string, HexTile>}
 */
export function generateMap(seed, radius) {
  const rng = makeRNG(seed);
  const ids = RESOURCE_SPAWN_WEIGHTS.map((w) => w.id);
  const weights = RESOURCE_SPAWN_WEIGHTS.map((w) => w.weight);
  /** @type {Map<string, object>} */
  const tiles = new Map();

  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) {
      const resId = ids[pickWeighted(weights, rng)];
      const res = RESOURCES[resId];
      tiles.set(hexKey(q, r), {
        q,
        r,
        resourceId: resId,
        ownerId: null,
        buildingId: null,
        hasRoad: false,
        isCapital: false,
        troops: 0,
        landValue: res.landValue,
      });
    }
  }
  return tiles;
}

/** Pick N distinct tiles far from each other for capitals. */
export function placeCapitals(tiles, count, rng) {
  const keys = [...tiles.keys()];
  const picks = [];
  const minDist = Math.max(2, Math.floor(Math.sqrt(keys.length) / count));

  for (let n = 0; n < count; n++) {
    let best = null;
    let bestScore = -1;
    // Sample candidates.
    for (let t = 0; t < 40; t++) {
      const key = keys[(rng() * keys.length) | 0];
      const tile = tiles.get(key);
      if (picks.some((p) => hexDistance(tile, parseKey(p)) < minDist)) continue;
      const edge =
        Math.abs(tile.q) + Math.abs(tile.r) + Math.abs(-tile.q - tile.r);
      if (edge > bestScore) {
        bestScore = edge;
        best = key;
      }
    }
    if (!best) {
      best = keys.find((k) => !picks.includes(k)) || keys[0];
    }
    picks.push(best);
  }
  return picks;
}
