/* Tunables and content tables. No logic beyond pure helpers. */

export const FIXED_DT = 1 / 60;

/** Three lanes: -1 left, 0 mid, 1 right. */
export const LANES = [-1, 0, 1];
export const LANE_COUNT = 3;
export const LANE_WIDTH = 56;

export const BUNNY = {
  radius: 14,
  jumpHeight: 52,
  jumpDuration: 0.42,
  laneSwitchTime: 0.12,
  hitInvuln: 0.35,
};

/** Obstacle kinds — each forces a different dodge. */
export const OBSTACLES = {
  log: {
    id: 'log',
    /** Must jump; occupies one lane. */
    dodge: 'jump',
    width: 44,
    height: 18,
    depth: 22,
    weight: 0.34,
  },
  rock: {
    id: 'rock',
    /** Must change lane; too tall to jump. */
    dodge: 'lane',
    width: 36,
    height: 40,
    depth: 28,
    weight: 0.38,
  },
  root: {
    id: 'root',
    /** Jump or lane both work. */
    dodge: 'either',
    width: 40,
    height: 22,
    depth: 24,
    weight: 0.28,
  },
};

export const PICKUPS = {
  carrot: {
    id: 'carrot',
    score: 25,
    /** Slight fox-gap relief when grabbed. */
    gapRelief: 8,
    radius: 12,
    weight: 1,
  },
};

export const FOX = {
  /** Starting gap behind bunny (world units along path). */
  startGap: 140,
  /** Gap closes this much on a stumble (hit soft). */
  stumbleClose: 48,
  /** Soft hit: lose this much gap; if gap ≤ catchGap → caught. */
  catchGap: 18,
  /** Passive close rate (units / sec) so idle pressure exists even without hits. */
  creepPerSec: 1.2,
  /** Gap opens slowly while clean running. */
  recoverPerSec: 2.8,
  maxGap: 180,
  minVisualGap: 8,
};

export const RUN = {
  /** Forward scroll speed at t=0 (world units / sec). */
  baseSpeed: 160,
  /** Extra speed per second of run. */
  accel: 3.2,
  maxSpeed: 340,
  /** Distance score per world unit. */
  scorePerUnit: 0.35,
  /** Spawn spacing along path early / late. */
  spawnGapMin: 95,
  spawnGapMax: 160,
  /** First carrot target distance. */
  firstCarrotDist: 70,
  /** Soft hit vs hard: rock is hard (instant fail); log/root soft if jumped wrong. */
};

export const PALETTE = {
  dusk: '#1a2438',
  duskDeep: '#0e1522',
  cream: '#f0e6d0',
  orange: '#e07040',
  fox: '#c45a2a',
  foxDark: '#6b2a12',
  path: '#6b5344',
  pathLight: '#8a6e58',
  ink: '#0e1218',
  leaf: '#3d5a45',
  carrot: '#f07830',
  green: '#6a9a4a',
};

export function speedAt(time) {
  const s = RUN.baseSpeed + time * RUN.accel;
  return s > RUN.maxSpeed ? RUN.maxSpeed : s;
}

export function scoreFromRun(distance, carrots) {
  return Math.floor(distance * RUN.scorePerUnit) + carrots * PICKUPS.carrot.score;
}

/** Weighted pick among obstacle ids. */
export function pickObstacleKind(rng) {
  const rows = Object.values(OBSTACLES);
  let total = 0;
  for (const r of rows) total += r.weight;
  let roll = rng() * total;
  for (const r of rows) {
    roll -= r.weight;
    if (roll <= 0) return r.id;
  }
  return rows[rows.length - 1].id;
}
