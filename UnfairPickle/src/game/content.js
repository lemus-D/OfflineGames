/* Tiles, physics, and ten unfair level maps. Data only — play.js applies it. */

export const FIXED_DT = 1 / 60;
export const TILE = 16;

/** Player physics. Hitbox is smaller than the drawn pickle (forgiving). */
export const PICKLE = {
  w: 10,
  h: 14,
  accel: 2200,
  maxRun: 130,
  friction: 0.72,
  airFriction: 0.9,
  gravity: 1950,
  jumpVel: -410,
  cutJumpMul: 0.45,
  coyote: 0.09,
  buffer: 0.12,
  maxFall: 520,
};

/** Seconds before brine starts rising on a level. Idle / stall loses. */
export const BRINE = {
  grace: 22,
  riseSpeed: 28,
  /** Visual color */
  color: '#9cbc2e',
};

/**
 * Tile legend (char → behaviour).
 * solid: collides  draw: how it looks (may differ — that's the unfair bit)
 */
export const TILES = {
  '.': { id: 'empty', solid: false, draw: 'empty' },
  '#': { id: 'brick', solid: true, draw: 'brick' },
  '=': { id: 'plat', solid: true, oneWay: true, draw: 'plat' },
  '^': { id: 'spike', solid: false, hazard: 'spike', draw: 'spike' },
  v: { id: 'fakeSpike', solid: false, draw: 'spike' }, // looks deadly, safe
  '~': { id: 'fakeFloor', solid: false, draw: 'brick' }, // looks solid, falls through
  '*': { id: 'vanish', solid: true, vanish: true, draw: 'brick' },
  '?': { id: 'invis', solid: true, invisible: true, draw: 'brick' },
  S: { id: 'spring', solid: true, spring: 560, draw: 'spring' },
  G: { id: 'goal', solid: false, goal: true, draw: 'goal' },
  F: { id: 'fakeGoal', solid: false, hazard: 'fakeGoal', draw: 'goal' },
  C: { id: 'crumbly', solid: true, crumbly: true, draw: 'crumbly' },
  R: { id: 'reverse', solid: false, reverse: true, draw: 'reverse' },
  P: { id: 'spawn', solid: false, draw: 'empty' },
};

/**
 * Level rows are top → bottom. Width may vary; pads with '.' on the right.
 * P = spawn, G = real goal, F = fake goal.
 */
export const LEVELS = [
  {
    id: 'welcome',
    name: 'Welcome, Dill',
    hint: 'Jump right. Trust nothing.',
    rows: [
      '................................',
      '................................',
      '................................',
      '..............^^^^..............',
      '.........##........##...........',
      '................................',
      '....P........~~...........G.....',
      '################################',
    ],
  },
  {
    id: 'looks-solid',
    name: 'Looks Solid',
    hint: 'That floor ahead? Nope.',
    rows: [
      '........................................',
      '........................................',
      '......................####..............',
      '......................#..#..............',
      '.............~~~~.....####......G.......',
      '....P...................................',
      '########............####################',
      '########............####################',
    ],
  },
  {
    id: 'fake-flag',
    name: 'The Other Flag',
    hint: 'First flag is a lie.',
    rows: [
      '..............................................',
      '..............................................',
      '.....................####.....................',
      '..............^^^^..#..#......................',
      '....P.........####..####.....F..........G.....',
      '#######..........................#############',
      '#######..........................#############',
    ],
  },
  {
    id: 'vanish',
    name: 'Standing Room',
    hint: 'Do not linger.',
    rows: [
      '........................................',
      '........................................',
      '........................................',
      '..............^^^^......................',
      '....P....********..........****...G.....',
      '######.....................#############',
      '######.....................#############',
    ],
  },
  {
    id: 'ghost-bricks',
    name: 'Ghost Bricks',
    hint: 'Air that hits back.',
    rows: [
      '..............................................',
      '..............................................',
      '...............????...........................',
      '........^^^^..................................',
      '....P.................####........G...........',
      '######....~~~~.......####.....###############',
      '######...............####.....###############',
    ],
  },
  {
    id: 'spring-trap',
    name: 'Helpful Spring',
    hint: 'Helpful is relative.',
    rows: [
      '..............................................',
      '.................^^^^.........................',
      '.................####.........................',
      '..............................................',
      '....P......S.......................G..........',
      '#######.........v.........####################',
      '#######.........v.........####################',
    ],
  },
  {
    id: 'crumbly-path',
    name: 'Crumb Trail',
    hint: 'Keep moving.',
    rows: [
      '..............................................',
      '..............................................',
      '....................^^^^......................',
      '....P..CCCC..CCCC.......CCCC.....CCCC..G......',
      '#####..............~~~~....................###',
      '#####......................................###',
    ],
  },
  {
    id: 'reverse',
    name: 'Brain Pickle',
    hint: 'Left is right in the mist.',
    rows: [
      '..............................................',
      '..............................................',
      '..........RRRRRRRRRRRRRR......................',
      '....P.....RRRRRRRRRRRRRR........^^^^....G.....',
      '#######.......................###############',
      '#######.......................###############',
    ],
  },
  {
    id: 'combo',
    name: 'Everything Bagel',
    hint: 'All of the above.',
    rows: [
      '........................................................',
      '................????....................................',
      '.........^^^^........S....^^^^..........................',
      '....P..****..~~..CCCC.........F.....****...?....G......',
      '#####.......................####......................##',
      '#####.......................####......................##',
    ],
  },
  {
    id: 'finale',
    name: 'Jar Escape',
    hint: 'One clean run. Or not.',
    rows: [
      '................................................................',
      '..............????..............^^^^............................',
      '........~~~~......S....****.........CCCC....RRRR................',
      '....P.............................F..............****...?..G....',
      '#####..^^^^..####.............####...........................##',
      '#####........####.............####.....v.....................##',
      '#####........####.............####...........................##',
    ],
  },
];

export function levelCount() {
  return LEVELS.length;
}

export function formatTime(sec) {
  if (sec == null || !Number.isFinite(sec)) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec % 1) * 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}
