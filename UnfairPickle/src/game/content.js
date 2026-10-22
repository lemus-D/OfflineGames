/* Tiles, physics, and ten unfair level maps. Data only — play.js applies it. */

export const FIXED_DT = 1 / 60;
export const TILE = 16;

/** Dev builds unlock every level in the select screen. Flip off for release. */
export const DEV_UNLOCK_ALL = true;

/**
 * Mario-ish feel. Max jump ≈ 6 tiles; running jump clears ≈ 6–7 tile gaps.
 * Hitbox smaller than the drawn pickle (forgiving).
 */
export const PICKLE = {
  w: 10,
  h: 14,
  accel: 2400,
  maxRun: 160,
  friction: 0.7,
  airFriction: 0.92,
  gravity: 1550,
  jumpVel: -560,
  cutJumpMul: 0.42,
  coyote: 0.1,
  buffer: 0.14,
  maxFall: 520,
};

/** Seconds before brine starts rising. Idle / stall loses. */
export const BRINE = {
  grace: 40,
  riseSpeed: 26,
  color: '#9cbc2e',
};

/**
 * Tile legend (char → behaviour).
 * solid: collides  draw: how it looks (may differ — that's the unfair bit)
 */
export const TILES = {
  '.': { id: 'empty', solid: false, draw: 'empty' },
  '#': { id: 'ground', solid: true, draw: 'ground' },
  B: { id: 'block', solid: true, draw: 'block' },
  '=': { id: 'plat', solid: true, oneWay: true, draw: 'plat' },
  '^': { id: 'spike', solid: false, hazard: 'spike', draw: 'spike' },
  v: { id: 'fakeSpike', solid: false, draw: 'spike' },
  '~': { id: 'fakeFloor', solid: false, draw: 'ground' }, // looks like ground
  '*': { id: 'vanish', solid: true, vanish: true, draw: 'block' },
  '?': { id: 'invis', solid: true, invisible: true, draw: 'block' },
  S: { id: 'spring', solid: true, spring: 620, draw: 'spring' },
  G: { id: 'goal', solid: false, goal: true, draw: 'goal' },
  F: { id: 'fakeGoal', solid: false, hazard: 'fakeGoal', draw: 'goal' },
  C: { id: 'crumbly', solid: true, crumbly: true, draw: 'crumbly' },
  R: { id: 'reverse', solid: false, reverse: true, draw: 'reverse' },
  P: { id: 'spawn', solid: false, draw: 'empty' },
};

/**
 * Levels sized for the jump budget above.
 * Gaps over open void are ≤ 6 tiles unless a spring / mid platform helps.
 * P = spawn, G = real goal, F = fake goal.
 */
export const LEVELS = [
  {
    id: 'welcome',
    name: 'Welcome, Dill',
    hint: 'Jump right. Trust nothing.',
    rows: [
      '........................................',
      '........................................',
      '..............^^^^......................',
      '..........BBBB....BBBB..................',
      '........................................',
      '....P......~~~~...............G.........',
      '###########....#########################',
      '###########....#########################',
    ],
  },
  {
    id: 'looks-solid',
    name: 'Looks Solid',
    hint: 'That floor ahead? Nope.',
    rows: [
      '..............................................',
      '..............................................',
      '................BBBB..........................',
      '..............................................',
      '....P.....~~~~~......BB........G..............',
      '##########.....######..#######################',
      '##########.....######..#######################',
    ],
  },
  {
    id: 'fake-flag',
    name: 'The Other Flag',
    hint: 'First flag is a lie.',
    rows: [
      '..............................................',
      '..............................................',
      '...............^^^^...........................',
      '.............BBBB..BBBB.......................',
      '....P.....................F...........G.......',
      '##########..............####....##############',
      '##########..............####....##############',
    ],
  },
  {
    id: 'vanish',
    name: 'Standing Room',
    hint: 'Do not linger.',
    rows: [
      '..............................................',
      '..............................................',
      '..............................................',
      '....P.............~~~~................G.......',
      '######..****..****..****..####################',
      '######....................####################',
    ],
  },
  {
    id: 'ghost-bricks',
    name: 'Ghost Bricks',
    hint: 'Air that hits back.',
    rows: [
      '..............................................',
      '..............................................',
      '.............????.............................',
      '........^^^^..................................',
      '....P..............BBBB...........G...........',
      '######...~~~~......####......#################',
      '######.............####......#################',
    ],
  },
  {
    id: 'spring-trap',
    name: 'Helpful Spring',
    hint: 'Helpful is relative.',
    rows: [
      '..............................................',
      '..............^^..............................',
      '..............................................',
      '....P.............................G...........',
      '######..****..S.****..****..##################',
      '######......................##################',
    ],
  },
  {
    id: 'crumbly-path',
    name: 'Crumb Trail',
    hint: 'Keep moving.',
    rows: [
      '..............................................',
      '..............................................',
      '...................^^^^.......................',
      '....P..CCCC..CCCC......CCCC....CCCC..G........',
      '#####.............~~~~......................##',
      '#####.......................................##',
    ],
  },
  {
    id: 'reverse',
    name: 'Brain Pickle',
    hint: 'Left is right in the mist.',
    rows: [
      '..............................................',
      '..............................................',
      '.........RRRRRRRRRRRR.........................',
      '....P....RRRRRRRRRRRR.........^^^^....G.......',
      '######......................##################',
      '######......................##################',
    ],
  },
  {
    id: 'combo',
    name: 'Everything Bagel',
    hint: 'All of the above.',
    rows: [
      '........................................................',
      '..............????......................................',
      '........^^^^.......S....^^^^............................',
      '....P..****..~~..CCCC........F....****..?.....G.........',
      '#####.....................####......................####',
      '#####.....................####......................####',
    ],
  },
  {
    id: 'finale',
    name: 'Jar Escape',
    hint: 'One clean run. Or not.',
    rows: [
      '................................................................',
      '.............????.............^^^^..............................',
      '.......~~~~.....S...****........CCCC...RRRR.....................',
      '....P..........................F.............****..?..G.........',
      '#####.^^^^.####.............####............................####',
      '#####......####.............####....v.......................####',
      '#####......####.............####............................####',
    ],
  },
];

export function levelCount() {
  return LEVELS.length;
}

/** Peak jump height in world units (full hold). */
export function jumpPeakHeight() {
  return (PICKLE.jumpVel * PICKLE.jumpVel) / (2 * PICKLE.gravity);
}

export function formatTime(sec) {
  if (sec == null || !Number.isFinite(sec)) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec % 1) * 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}
