/* Tunables and tables. Content lives here; play.js applies it. */

export const FIXED_DT = 1 / 60;

/** Half-court world: floor at y=0, hoop on the +X end. Basket Random shape. */
export const COURT = {
  minX: -260,
  maxX: 260,
  floorY: 0,
  midX: 0,
  ceilingY: 340,
};

export const HOOP = {
  x: 210,
  rimY: 150,
  rimR: 20,
  backboardX: 232,
  backboardTop: 210,
  backboardBot: 115,
  scoreRadius: 24,
  scoreVyMax: 360,
  /** Inside this distance a jump-throw becomes a dunk attempt. */
  dunkRange: 78,
};

export const BALL = {
  radius: 11,
  gravity: 820,
  bounce: 0.72,
  floorFriction: 0.9,
  airDrag: 0.997,
  holdOffsetX: 18,
  holdOffsetY: 10,
};

/** Base looks; morph multiplies the play feel. */
export const PLAYERS = {
  human: {
    id: 'human',
    name: 'Red',
    bodyR: 18,
    jersey: '#e23b3b',
    skin: '#f0c8a0',
    accent: '#fff',
  },
  ai: {
    id: 'ai',
    name: 'Blue',
    bodyR: 18,
    jersey: '#2f6fe0',
    skin: '#e8b890',
    accent: '#fff',
  },
};

/**
 * Basket Random morph ranges. Each point rolls a new morph from the RNG.
 * Values multiply base movement / limbs.
 */
export const MORPH = {
  arm: [0.7, 2.2],
  leg: [0.55, 1.8],
  body: [0.7, 1.55],
  head: [0.75, 1.6],
  speed: [0.55, 1.35],
  jump: [0.7, 1.45],
  reach: [0.75, 1.6],
};

export const MATCH = {
  winScore: 5,
  shotClock: 12,
  shotClockWarn: 4,
  tipOffDelay: 0.9,
  afterScoreDelay: 1.15,
  remorphFlash: 0.55,
  stealCooldown: 0.5,
};

export const AI = {
  jumpRangeMin: 50,
  jumpRangeMax: 125,
  missBias: 0.12,
  thinkHz: 11,
  contestReach: 44,
};

/** Floaty, rude — Basket Random tuning pads. */
export const PHYSICS = {
  gravity: 1180,
  moveDrag: 0.88,
  maxFall: 780,
  bumpPower: 220,
  baseSpeed: 200,
  baseAccel: 1500,
  baseJump: 460,
  baseReach: 46,
  baseArm: 42,
};
