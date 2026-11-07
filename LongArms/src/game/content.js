/* Tunables and tables. Content lives here; play.js applies it. */

export const FIXED_DT = 1 / 60;

/** Half-court world: floor at y=0, hoop on the +X end. */
export const COURT = {
  minX: -220,
  maxX: 220,
  floorY: 0,
  midX: 0,
  ceilingY: 320,
};

export const HOOP = {
  x: 190,
  rimY: 145,
  rimR: 18,
  backboardX: 208,
  backboardTop: 200,
  backboardBot: 110,
  /** Ball center must be near rim with low |vy| to count a make. */
  scoreRadius: 22,
  scoreVyMax: 320,
};

export const BALL = {
  radius: 10,
  gravity: 980,
  bounce: 0.62,
  floorFriction: 0.86,
  airDrag: 0.995,
  holdOffsetX: 22,
  holdOffsetY: 18,
};

/** Player archetypes — reach/armLen change grab and throw feel. */
export const PLAYERS = {
  human: {
    id: 'human',
    name: 'Stretch',
    reach: 52,
    armLen: 58,
    bodyR: 16,
    speed: 230,
    accel: 1600,
    jumpVel: 430,
    throwSpeed: 400,
    throwArc: 0.55,
    jersey: '#e85d4c',
    skin: '#f2c4a0',
  },
  ai: {
    id: 'ai',
    name: 'Noodle',
    reach: 48,
    armLen: 56,
    bodyR: 16,
    speed: 185,
    accel: 1200,
    jumpVel: 400,
    throwSpeed: 360,
    throwArc: 0.52,
    jersey: '#3d6ea5',
    skin: '#e8b890',
  },
};

export const MATCH = {
  /** First to this many points (2 per basket). Tuned toward the brief run band. */
  winScore: 12,
  shotClock: 10,
  shotClockWarn: 3,
  tipOffDelay: 0.7,
  afterScoreDelay: 0.9,
  stealCooldown: 0.45,
};

export const AI = {
  jumpRangeMin: 75,
  jumpRangeMax: 120,
  missBias: 0.4,
  thinkHz: 8,
  contestReach: 38,
};

/** Tuning pads — numbers only, same play verb. */
export const PHYSICS = {
  gravity: 1600,
  moveDrag: 0.82,
  maxFall: 900,
};
