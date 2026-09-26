/* Axial hex math, seeded map generation, Voronoi nation partitions. */

import { makeRNG, pickWeighted } from '../core/rng.js';
import { RESOURCE_SPAWN_WEIGHTS, RESOURCES, START_CLAIM_RADIUS } from '../data/content.js';

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

/**
 * Generate a hex disk of given radius.
 * @returns {Map<string, object>}
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
        hasWalls: false,
        isCapital: false,
        troops: 0,
        stamina: 0,
        landValue: res.landValue,
        regionId: -1,
      });
    }
  }
  return tiles;
}

/**
 * Farthest-point sample `count` seeds, Voronoi-partition the map, place a
 * capital in each region, and claim a ~5-tile-wide (radius 2) starting blob.
 * @returns {string[]} capital keys in civ order
 */
export function partitionAndPlace(tiles, count, rng) {
  const keys = [...tiles.keys()];
  if (!keys.length || count < 1) return [];

  const coords = keys.map((k) => {
    const t = tiles.get(k);
    return { key: k, q: t.q, r: t.r };
  });

  // Prefer edge-ish first seed, then maximize distance from chosen seeds.
  let first = coords[0];
  let firstScore = -1;
  for (let t = 0; t < Math.min(80, coords.length); t++) {
    const c = coords[(rng() * coords.length) | 0];
    const edge = Math.abs(c.q) + Math.abs(c.r) + Math.abs(-c.q - c.r);
    if (edge > firstScore) {
      firstScore = edge;
      first = c;
    }
  }

  /** @type {{key:string,q:number,r:number}[]} */
  const seeds = [first];
  while (seeds.length < count) {
    let best = null;
    let bestMin = -1;
    for (let t = 0; t < Math.min(120, coords.length); t++) {
      const c = coords[(rng() * coords.length) | 0];
      if (seeds.some((s) => s.key === c.key)) continue;
      let minD = Infinity;
      for (const s of seeds) minD = Math.min(minD, hexDistance(c, s));
      if (minD > bestMin) {
        bestMin = minD;
        best = c;
      }
    }
    if (!best) {
      best = coords.find((c) => !seeds.some((s) => s.key === c.key));
    }
    if (!best) break;
    seeds.push(best);
  }

  // Voronoi: nearest seed owns the region.
  for (const tile of tiles.values()) {
    let bestI = 0;
    let bestD = Infinity;
    for (let i = 0; i < seeds.length; i++) {
      const d = hexDistance(tile, seeds[i]);
      if (d < bestD || (d === bestD && i < bestI)) {
        bestD = d;
        bestI = i;
      }
    }
    tile.regionId = bestI;
  }

  // Capitals at seeds; claim START_CLAIM_RADIUS blob inside own region.
  const capitalKeys = [];
  for (let i = 0; i < seeds.length; i++) {
    const seed = seeds[i];
    let capKey = seed.key;
    // Prefer a non-barren tile in-region near the seed.
    let best = null;
    let bestScore = -Infinity;
    for (const tile of tiles.values()) {
      if (tile.regionId !== i) continue;
      const d = hexDistance(tile, seed);
      if (d > 1) continue;
      const score = (tile.resourceId === 'barren' ? -2 : 1) - d + rng() * 0.01;
      if (score > bestScore) {
        bestScore = score;
        best = tile;
      }
    }
    if (best) capKey = hexKey(best.q, best.r);
    capitalKeys.push(capKey);

    const cap = tiles.get(capKey);
    for (const tile of tiles.values()) {
      if (tile.regionId !== i) continue;
      if (hexDistance(tile, cap) <= START_CLAIM_RADIUS) {
        tile.ownerId = `__pending_${i}`;
      }
    }
  }

  return capitalKeys;
}
