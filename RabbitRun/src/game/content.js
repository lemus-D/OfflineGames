/* Tunables and content tables for Rabbit Run MVP. */

export const LANES = 3;

export const RUN = {
  /** Starting forward speed (world units / sec). */
  baseSpeed: 14,
  /** Extra speed gained per second of survival. */
  accel: 0.35,
  /** Soft cap so it stays readable. */
  maxSpeed: 32,
  /** How far ahead we keep segments spawned. */
  spawnAhead: 55,
  /** How far behind we cull. */
  cullBehind: 8,
  /** Spacing between obstacle/carrot rolls. */
  segmentGap: 4.5,
  /** Jump: height peak and duration feel. */
  jumpHeight: 1.15,
  jumpDuration: 0.55,
  /** Lane slide lerp speed (lanes per second toward target). */
  laneSlide: 10,
  /** Fox sits this many units behind when gap is healthy. */
  foxBaseGap: 5.5,
  /** Obstacle hit shrinks the fox gap by this much. */
  foxCloseOnHit: 2.2,
  /** Fox catches you when gap ≤ this. */
  foxCatchGap: 1.15,
  /** Near/far for perspective projection. */
  near: 2.2,
  far: 48,
};

/** Obstacle kinds. tall = cannot jump over. */
export const OBSTACLES = {
  log: { id: 'log', tall: false, w: 0.85, h: 0.45 },
  rock: { id: 'rock', tall: false, w: 0.7, h: 0.55 },
  hedge: { id: 'hedge', tall: true, w: 0.95, h: 1.15 },
};

export const OBSTACLE_IDS = Object.keys(OBSTACLES);

export const COLORS = {
  skyTop: '#7ec8e8',
  skyBot: '#c8e8a8',
  grassL: '#3d8c3a',
  grassR: '#2f6e2c',
  path: '#c4a86a',
  pathDark: '#a8885a',
  laneLine: 'rgba(255,255,255,0.22)',
  rabbit: '#efe6d4',
  rabbitEar: '#e8d5c0',
  rabbitPink: '#e8a090',
  rabbitEye: '#2a2018',
  fox: '#e07030',
  foxDark: '#a84818',
  foxWhite: '#f5efe6',
  carrot: '#e87828',
  carrotTop: '#3a9a3a',
  log: '#6b4423',
  rock: '#7a7e86',
  hedge: '#2a6a28',
};
