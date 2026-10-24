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
  accel: 2600,
  maxRun: 160,
  friction: 0.7,
  airFriction: 0.94,
  gravity: 1550,
  jumpVel: -560,
  cutJumpMul: 0.42,
  coyote: 0.1,
  buffer: 0.14,
  maxFall: 520,
};

/**
 * Seconds before brine starts rising. Idle / stall loses.
 * Per-level `brineGrace` overrides this (early levels get more learning time).
 */
export const BRINE = {
  grace: 55,
  warnBefore: 10,
  riseSpeed: 26,
  color: '#9cbc2e',
};

/**
 * Tile legend (char → behaviour).
 * solid: collides  draw: how it looks (may differ — that's the unfair bit)
 * Spikes (^) belong in ground pits only — never floating mid-air.
 */
export const TILES = {
  '.': { id: 'empty', solid: false, draw: 'empty' },
  '#': { id: 'ground', solid: true, draw: 'ground' },
  B: { id: 'block', solid: true, draw: 'block' },
  '=': { id: 'plat', solid: true, oneWay: true, draw: 'plat' },
  '^': { id: 'spike', solid: false, hazard: 'spike', draw: 'spike' },
  v: { id: 'fakeSpike', solid: false, draw: 'spike' },
  '~': { id: 'fakeFloor', solid: false, draw: 'ground' }, // looks like ground
  '*': { id: 'vanish', solid: true, vanish: true, draw: 'vanish' },
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
 * Spike pits sit on the ground row in open gaps (not floating).
 */
export const LEVELS = [
  {
    id: 'welcome',
    name: 'Welcome, Dill',
    hint: 'Jump the gap. That grass is a lie.',
    brineGrace: 90,
    rows: [
      // One lesson: fake floor over a pit. No floating spikes, no upper trap route.
      '........................................',
      '........................................',
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
    brineGrace: 75,
    rows: [
      '..............................................',
      '..............................................',
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
    brineGrace: 70,
    rows: [
      // Open ground so the fake flag is the punchline — not a gauntlet first.
      '..............................................',
      '..............................................',
      '..............................................',
      '....P...............F...........G.............',
      '######################....####################',
      '######################....####################',
    ],
  },
  {
    id: 'vanish',
    name: 'Standing Room',
    hint: 'Do not linger.',
    brineGrace: 65,
    rows: [
      // Vanish pads (purple X) — keep hopping; ~~ is a fake bridge lie.
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
    brineGrace: 65,
    rows: [
      // Softer teach: short void, invisible bridge, then solid to goal. No spikes.
      '..............................................',
      '..............................................',
      '..............................................',
      '....P.........????............G...............',
      '######....................####################',
      '######....................####################',
    ],
  },
  {
    id: 'spring-trap',
    name: 'Helpful Spring',
    hint: 'Helpful is relative.',
    brineGrace: 60,
    rows: [
      '..............................................',
      '..............................................',
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
    brineGrace: 60,
    rows: [
      // Crumbly islands; fake floor in the long gap (no floating spikes).
      '..............................................',
      '..............................................',
      '..............................................',
      '....P..CCCC..CCCC......CCCC....CCCC..G........',
      '#####.............~~~~......................##',
      '#####.......................................##',
    ],
  },
  {
    id: 'reverse',
    name: 'Brain Pickle',
    hint: 'Left is right in the mist.',
    brineGrace: 75,
    rows: [
      // Mist on continuous solid ground — reverse is the only trick.
      '..............................................',
      '..............................................',
      '..............................................',
      '....P....RRRRRRRRRRRRRRRRRR...........G.......',
      '##############################################',
      '##############################################',
    ],
  },
  {
    id: 'combo',
    name: 'Everything Bagel',
    hint: 'All of the above.',
    brineGrace: 70,
    rows: [
      // One segment per prior trick; ground spike pit only (not floating).
      '........................................................',
      '........................................................',
      '........................................................',
      '....P.....................F.................G...........',
      '######..****~~CCCC....^^.#####..****..?.################',
      '######...................#####........#..################',
    ],
  },
  {
    id: 'finale',
    name: 'Jar Escape',
    hint: 'One clean run. Or not.',
    brineGrace: 70,
    rows: [
      // Ground-row finale; thinned vs kitchen-sink — spike pit stays on the floor.
      '................................................................',
      '................................................................',
      '................................................................',
      '....P.........................F.................RRRR....G.......',
      '######..^^..####~~****..CCCC#####..****..?.#####################',
      '######......####........#####........#..#####################',
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

/** Friendly death labels for the HUD. */
export function deathLabel(reason) {
  switch (reason) {
    case 'spike':
      return 'spikes';
    case 'fakeGoal':
      return 'fake flag';
    case 'brine':
      return 'brine';
    case 'void':
      return 'the void';
    default:
      return reason || 'something';
  }
}
