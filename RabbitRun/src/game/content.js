/* Tunables and content tables for Rabbit Run. */

export const LANES = 3;

export const RUN = {
  /** Starting forward speed (world units / sec). */
  baseSpeed: 14,
  /** Extra speed gained per second of survival. */
  accel: 0.35,
  /** Soft cap so it stays readable. */
  maxSpeed: 32,
  /** How far ahead we keep segments spawned. */
  spawnAhead: 60,
  /** How far behind we cull. */
  cullBehind: 10,
  /** Spacing between obstacle/carrot rolls. */
  segmentGap: 4.2,
  /** Jump: height peak and duration feel. */
  jumpHeight: 1.15,
  jumpDuration: 0.55,
  /** Lane slide lerp speed (lanes per second toward target). */
  laneSlide: 10,
  /** Fox sits this many units behind when gap is healthy. */
  foxBaseGap: 5.2,
  /** Obstacle hit shrinks the fox gap by this much. */
  foxCloseOnHit: 2.2,
  /** Fox catches you when gap ≤ this. */
  foxCatchGap: 1.15,
  /** Near/far for perspective projection. */
  near: 2.2,
  far: 52,
  /** Path turn strength (lane-widths of centerline sway). */
  turnAmp: 1.65,
  /** How often discrete bends are rolled (world units). */
  turnSpacing: 28,
  /** Carrot trail length on open stretches. */
  carrotTrail: 3,
};

/** Obstacle kinds. tall = cannot jump over. */
export const OBSTACLES = {
  log: { id: 'log', tall: false, w: 0.85, h: 0.45 },
  rock: { id: 'rock', tall: false, w: 0.7, h: 0.55 },
  hedge: { id: 'hedge', tall: true, w: 0.95, h: 1.15 },
};

export const OBSTACLE_IDS = Object.keys(OBSTACLES);

/** Dusk woodland palette — warm path, cool sky, ink edges. */
export const COLORS = {
  skyTop: '#1b2a44',
  skyMid: '#3d5a7a',
  skyBot: '#e8b070',
  hillFar: '#2a4a3a',
  hillNear: '#1e3a2c',
  grassL: '#2f5a38',
  grassR: '#254a30',
  grassDark: '#1a3422',
  path: '#c49a5a',
  pathMid: '#a87a42',
  pathDark: '#7a5528',
  pathEdge: '#5a3a18',
  laneLine: 'rgba(255, 236, 190, 0.28)',
  ink: '#1a1410',
  rabbit: '#f2e6d0',
  rabbitShade: '#d8c4a8',
  rabbitEar: '#e8c8b0',
  rabbitPink: '#e89888',
  rabbitEye: '#2a2018',
  fox: '#9a2e0c',
  foxMid: '#7a2208',
  foxDark: '#3a0e06',
  foxWhite: '#e8d8c4',
  foxEye: '#ffb010',
  foxEyeGlow: 'rgba(255, 120, 20, 0.55)',
  carrot: '#ff7a28',
  carrotDeep: '#d05010',
  carrotTop: '#3d9a3a',
  carrotGlow: 'rgba(255, 160, 60, 0.35)',
  log: '#5a3218',
  logRing: '#d4b890',
  rock: '#6a7078',
  rockLite: '#9aa0a8',
  hedge: '#1e5a28',
  hedgeLite: '#3a8a40',
};
