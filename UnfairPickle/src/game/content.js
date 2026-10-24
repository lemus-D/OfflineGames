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
  maxRun: 165,
  friction: 0.7,
  airFriction: 0.94,
  gravity: 1550,
  jumpVel: -560,
  cutJumpMul: 0.42,
  coyote: 0.08,
  buffer: 0.12,
  maxFall: 520,
};

/**
 * Seconds before brine starts rising. Idle / stall loses.
 * Per-level `brineGrace` overrides this.
 */
export const BRINE = {
  grace: 48,
  warnBefore: 8,
  riseSpeed: 30,
  color: '#9cbc2e',
};

/**
 * Tile legend (char → behaviour).
 * solid: collides  draw: how it looks (may differ — that's the unfair bit)
 * Spikes (^) belong in ground pits only — never floating mid-air.
 * Invisible (?) ceilings are the "bonk" trap instead of floating spikes.
 */
export const TILES = {
  '.': { id: 'empty', solid: false, draw: 'empty' },
  '#': { id: 'ground', solid: true, draw: 'ground' },
  B: { id: 'block', solid: true, draw: 'block' },
  '=': { id: 'plat', solid: true, oneWay: true, draw: 'plat' },
  '^': { id: 'spike', solid: false, hazard: 'spike', draw: 'spike' },
  v: { id: 'fakeSpike', solid: false, draw: 'spike' },
  '~': { id: 'fakeFloor', solid: false, draw: 'ground' },
  // Vanish looks like a normal brick — Unfair Mario style.
  '*': { id: 'vanish', solid: true, vanish: true, draw: 'block' },
  '?': { id: 'invis', solid: true, invisible: true, draw: 'block' },
  S: { id: 'spring', solid: true, spring: 680, draw: 'spring' },
  G: { id: 'goal', solid: false, goal: true, draw: 'goal' },
  F: { id: 'fakeGoal', solid: false, hazard: 'fakeGoal', draw: 'goal' },
  C: { id: 'crumbly', solid: true, crumbly: true, draw: 'crumbly' },
  R: { id: 'reverse', solid: false, reverse: true, draw: 'reverse' },
  P: { id: 'spawn', solid: false, draw: 'empty' },
};

/**
 * Harder Unfair-Mario-inspired maps.
 * Denser lies, early fake flags, vanish-as-brick, invis bonk ceilings over bait —
 * spikes stay in ground pits only (no floating mid-air rows).
 * Gaps over void stay ≤ 5 tiles so a running jump still clears.
 */
export const LEVELS = [
  {
    id: 'welcome',
    name: 'Welcome, Dill',
    hint: 'Trust nothing. Especially the grass.',
    brineGrace: 60,
    rows: [
      // Two fake-floor pits. Second gap has an invis bonk if you leap too high.
      '........................................',
      '......................????..............',
      '........................................',
      '....P......~~~~......~~~~.....G.........',
      '###########....######....###############',
      '###########....######....###############',
    ],
  },
  {
    id: 'looks-solid',
    name: 'Looks Solid',
    hint: 'That floor ahead? Nope. Twice. And that flag?',
    brineGrace: 55,
    rows: [
      '..............................................',
      '..............................................',
      '..............................................',
      '....P.....~~~~~..~~~~~..F....G................',
      '##########....####....####..##################',
      '##########....####....####..##################',
    ],
  },
  {
    id: 'fake-flag',
    name: 'The Other Flag',
    hint: 'First flag is a lie. So is the grass after it.',
    brineGrace: 55,
    rows: [
      '..............................................',
      '..............................................',
      '..............................................',
      '....P..........F......~~~~........G...........',
      '################....####....##################',
      '################....####....##################',
    ],
  },
  {
    id: 'vanish',
    name: 'Standing Room',
    hint: 'Do not linger. At all.',
    brineGrace: 50,
    rows: [
      // Vanish pads that look like bricks; ~~ mid-bridge is a lie.
      '..............................................',
      '..............................................',
      '..............................................',
      '....P.............~~~~................G.......',
      '######..****..****..****..****..##############',
      '######..........................##############',
    ],
  },
  {
    id: 'ghost-bricks',
    name: 'Ghost Bricks',
    hint: 'Air that hits back.',
    brineGrace: 50,
    rows: [
      // Invisible bridge with a fake midsection; high invis ceiling over the void.
      '..............................................',
      '..........????????............................',
      '..............................................',
      '....P.....????~~~~??????......G...............',
      '######..................######################',
      '######..................######################',
    ],
  },
  {
    id: 'spring-trap',
    name: 'Helpful Spring',
    hint: 'Helpful is relative.',
    brineGrace: 48,
    rows: [
      // Spring is bait under an invis ceiling — hop the pads, don't bounce.
      '..............................................',
      '..............????............................',
      '..............................................',
      '....P.............................G...........',
      '######..****..S.***..****..###################',
      '######......................##################',
    ],
  },
  {
    id: 'crumbly-path',
    name: 'Crumb Trail',
    hint: 'Keep moving. Or else.',
    brineGrace: 48,
    rows: [
      // Crumbly ground-row pads; fake floor lies in the long gap.
      '..............................................',
      '..............................................',
      '..............................................',
      '....P....................................G....',
      '#####..CCCC..CCCC......CCCC....CCCC###########',
      '#####.............~~~~........................',
    ],
  },
  {
    id: 'reverse',
    name: 'Brain Pickle',
    hint: 'Left is right in the mist. Then the floor lies.',
    brineGrace: 60,
    rows: [
      // Mist on solid ground, then a fake-floor pit before the goal.
      '..............................................',
      '..............................................',
      '..............................................',
      '....P....RRRRRRRRRRRRRRRRRR.....~~~~..G.......',
      '################################....##########',
      '################################....##########',
    ],
  },
  {
    id: 'combo',
    name: 'Everything Bagel',
    hint: 'All of the above. Faster.',
    brineGrace: 55,
    rows: [
      // One segment per prior trick; ground spike pit only; invis over early bait.
      '........................................................',
      '..............????......................................',
      '........................................................',
      '....P.....................F.................G...........',
      '######..****~~CCCC....^^.#####..****?###################',
      '######...................#####......####################',
    ],
  },
  {
    id: 'finale',
    name: 'Jar Escape',
    hint: 'One clean run. Or not.',
    brineGrace: 60,
    rows: [
      // Ground-row finale; invis ceiling over the early spike leap (punishes big jumps).
      '................................................................',
      '........????....................................................',
      '................................................................',
      '....P.........................F.................RRRR....G.......',
      '######..^^..####~~****..CCCC#####..****?########################',
      '######......####........#####......#############################',
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
