/* Chunked procedural ocean structures — pillars, arches, ruins, shelves.
   Deterministic from (chunkX, worldSeed). Surfaces are crawl ledges for crabs. */

import { makeRNG, lerp, clamp } from '../core/rng.js';

export const CHUNK_W = 900;
export const SURFACE_Y = 0;
export const WORLD_FLOOR = 2200;
export const AIR_CEIL = -480;

/**
 * @typedef {{ x: number, y: number, w: number, h: number, kind: string, surfaces: {x:number,y:number,tx:number,ty:number,len:number}[] }} Structure
 */

function chunkRng(chunkX, worldSeed) {
  // Fold chunk + world seed into a 32-bit mulberry seed.
  const a = Math.imul(chunkX | 0, 0x9e3779b1) ^ (worldSeed | 0);
  return makeRNG(a >>> 0);
}

/** Build crawl surfaces: floor ledge on top + both vertical walls. */
function boxSurfaces(x, y, w, h) {
  // y is top of box, h grows downward (world Y+ is down).
  return [
    { x: x, y: y, tx: 1, ty: 0, len: w }, // top ledge
    { x: x, y: y, tx: 0, ty: 1, len: h }, // left wall downward
    { x: x + w, y: y, tx: 0, ty: 1, len: h }, // right wall
  ];
}

function makePillar(rng, baseX) {
  const w = lerp(48, 110, rng());
  const h = lerp(220, 620, rng());
  const x = baseX + lerp(40, CHUNK_W - w - 40, rng());
  const y = WORLD_FLOOR - h;
  return {
    kind: 'pillar',
    x,
    y,
    w,
    h,
    hue: lerp(28, 48, rng()),
    surfaces: boxSurfaces(x, y, w, h),
  };
}

function makeArch(rng, baseX) {
  const w = lerp(160, 280, rng());
  const h = lerp(180, 340, rng());
  const x = baseX + lerp(40, CHUNK_W - w - 40, rng());
  const y = WORLD_FLOOR - h;
  const pillarW = lerp(28, 48, rng());
  const surfaces = [
    ...boxSurfaces(x, y + h * 0.35, pillarW, h * 0.65),
    ...boxSurfaces(x + w - pillarW, y + h * 0.35, pillarW, h * 0.65),
    { x: x + pillarW * 0.5, y: y, tx: 1, ty: 0, len: w - pillarW }, // arch top
  ];
  return {
    kind: 'arch',
    x,
    y,
    w,
    h,
    pillarW,
    hue: lerp(16, 36, rng()),
    surfaces,
  };
}

function makeRuin(rng, baseX) {
  const w = lerp(120, 220, rng());
  const h = lerp(140, 300, rng());
  const x = baseX + lerp(40, CHUNK_W - w - 40, rng());
  const y = WORLD_FLOOR - h;
  return {
    kind: 'ruin',
    x,
    y,
    w,
    h,
    hue: lerp(200, 220, rng()),
    surfaces: boxSurfaces(x, y, w, h),
  };
}

/** Structures for one horizontal chunk — always rooted on the seabed. */
export function structuresForChunk(chunkX, worldSeed) {
  const rng = chunkRng(chunkX, worldSeed);
  const baseX = chunkX * CHUNK_W;
  const n = 1 + ((rng() * 3) | 0);
  const out = [];
  const builders = [makePillar, makeArch, makeRuin];
  for (let i = 0; i < n; i++) {
    const build = builders[(rng() * builders.length) | 0];
    out.push(build(rng, baseX));
  }
  return out;
}

/** Ensure chunks covering [camX - margin, camX + margin] exist in the map. */
export function ensureStructureChunks(chunkMap, camX, worldSeed, margin = 2400) {
  const lo = Math.floor((camX - margin) / CHUNK_W);
  const hi = Math.floor((camX + margin) / CHUNK_W);
  for (let cx = lo; cx <= hi; cx++) {
    if (!chunkMap.has(cx)) {
      chunkMap.set(cx, structuresForChunk(cx, worldSeed));
    }
  }
  // Drop far chunks.
  for (const key of chunkMap.keys()) {
    if (key < lo - 2 || key > hi + 2) chunkMap.delete(key);
  }
}

export function allStructures(chunkMap) {
  const list = [];
  for (const arr of chunkMap.values()) {
    for (const s of arr) list.push(s);
  }
  return list;
}

/** Soft AABB push-out. Returns {x,y} delta. */
export function resolveStructurePush(px, py, radius, structures) {
  let dx = 0,
    dy = 0;
  for (const s of structures) {
    const left = s.x,
      right = s.x + s.w,
      top = s.y,
      bot = s.y + s.h;
    const cx = clamp(px, left, right);
    const cy = clamp(py, top, bot);
    const ox = px - cx,
      oy = py - cy;
    const d = Math.hypot(ox, oy);
    if (d < 1e-4) {
      // Centered inside — push toward nearest edge.
      const dl = px - left,
        dr = right - px,
        dt = py - top,
        db = bot - py;
      const m = Math.min(dl, dr, dt, db);
      if (m === dl) dx -= radius + dl;
      else if (m === dr) dx += radius + dr;
      else if (m === dt) dy -= radius + dt;
      else dy += radius + db;
      continue;
    }
    if (d < radius) {
      const push = (radius - d) / d;
      dx += ox * push;
      dy += oy * push;
    }
  }
  return { dx, dy };
}

/** Pick a random crawl pose on a structure surface. */
export function randomSurfacePose(structures, rng) {
  if (!structures.length) return null;
  const s = structures[(rng() * structures.length) | 0];
  if (!s.surfaces.length) return null;
  const surf = s.surfaces[(rng() * s.surfaces.length) | 0];
  const u = rng();
  const x = surf.x + surf.tx * surf.len * u;
  const y = surf.y + surf.ty * surf.len * u;
  // Tangent angle for crab facing.
  const angle = Math.atan2(surf.ty, surf.tx);
  return { x, y, angle, surf, structure: s, u };
}
