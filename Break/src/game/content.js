/* Table geometry, ball catalog, tunables. Content lives here; play applies it. */

export const FIXED_DT = 1 / 180;

/** Playing surface in world units (2:1 table). Origin at center. */
export const TABLE = {
  halfW: 112,
  halfH: 56,
  cushion: 5.2,
  /** Visual pocket opening (drawing). */
  pocketR: 5.5,
  /**
   * Distance from pocket center the ball *center* must reach to drop.
   * Much tighter than pocketR so grazing the rim does not count.
   */
  pocketMouth: 2.75,
  /** Capture / funnel radius around off-table pocket centers. */
  pocketJaw: 7.2,
  /**
   * How far outside the felt the pocket centers sit.
   * Pockets are holes beside the table, not discs on the cloth.
   */
  pocketOut: 6.4,
  pocketOutSide: 6.8,
  /** Half-width of the rail opening that leads into each pocket. */
  railGap: 7.2,
};

export const BALL_R = 2.85;

export const PHYSICS = {
  /** Relative ball mass — higher = heavier (same cue stroke → less speed). */
  ballMass: 1.45,
  /** Linear drag accel (units/s²) — slightly slicker cloth. */
  rollingDrag: 15,
  /** Extra drag while |spin| is high (sliding). */
  slidingDrag: 8,
  stopSpeed: 0.07,
  cushionRestitution: 0.68,
  /** Fraction of tangent speed killed on rail. */
  cushionFriction: 0.42,
  ballRestitution: 0.94,
  /** Max cue impulse magnitude before mass (world units / sec). */
  maxShotSpeed: 160,
  /** How strongly tip English becomes stored spin. */
  englishToSpin: 0.55,
  /** Side spin kick on cushions. */
  sideOnCushion: 0.38,
  /** Throw: side spin nudges object ball on contact. */
  throwFactor: 0.18,
  /** Follow / draw blend into cue residual after a hit. */
  followFactor: 0.5,
  drawFactor: 0.48,
  spinDecay: 0.992,
  /** Cap |english| tip offset. */
  maxEnglish: 0.88,
  /** Screen pixels of drag that maps to max power. */
  maxPullPx: 170,
  minPullPx: 8,
  /** Seconds for the pocket fall-in animation. */
  pocketFallDur: 0.38,
};

/** Object ball rows: number, solid/stripe, color. Cue is separate. */
export const BALLS = [
  { id: 1, kind: 'solid', color: '#e8b020', label: '1' },
  { id: 2, kind: 'solid', color: '#2a5aa8', label: '2' },
  { id: 3, kind: 'solid', color: '#c43c3c', label: '3' },
  { id: 4, kind: 'solid', color: '#6b2d8a', label: '4' },
  { id: 5, kind: 'solid', color: '#d06020', label: '5' },
  { id: 6, kind: 'solid', color: '#1a7a3c', label: '6' },
  { id: 7, kind: 'solid', color: '#7a1a1a', label: '7' },
  { id: 8, kind: 'eight', color: '#141414', label: '8' },
  { id: 9, kind: 'stripe', color: '#e8b020', label: '9' },
  { id: 10, kind: 'stripe', color: '#2a5aa8', label: '10' },
  { id: 11, kind: 'stripe', color: '#c43c3c', label: '11' },
  { id: 12, kind: 'stripe', color: '#6b2d8a', label: '12' },
  { id: 13, kind: 'stripe', color: '#d06020', label: '13' },
  { id: 14, kind: 'stripe', color: '#1a7a3c', label: '14' },
  { id: 15, kind: 'stripe', color: '#7a1a1a', label: '15' },
];

export const CUE_BALL = {
  id: 0,
  kind: 'cue',
  color: '#f4f0e8',
  label: '',
};

/** Standard triangle rack order (rows of 1..5), apex toward cue. */
export const RACK_ORDER = [
  1,
  9, 2,
  10, 8, 3,
  11, 4, 12, 5,
  13, 6, 14, 7, 15,
];

/** Cue ball kitchen start (left half). */
export const CUE_START = { x: -TABLE.halfW * 0.5, y: 0 };

/** Apex of the rack (right side of table). */
export const RACK_APEX = { x: TABLE.halfW * 0.35, y: 0 };

/** Pocket centers sit just off the felt, in the rail / apron. */
export function pocketCenters() {
  const w = TABLE.halfW;
  const h = TABLE.halfH;
  const c = TABLE.pocketOut;
  const s = TABLE.pocketOutSide;
  return [
    { x: -w - c * 0.72, y: -h - c * 0.72, corner: true },
    { x: 0, y: -h - s, corner: false },
    { x: w + c * 0.72, y: -h - c * 0.72, corner: true },
    { x: -w - c * 0.72, y: h + c * 0.72, corner: true },
    { x: 0, y: h + s, corner: false },
    { x: w + c * 0.72, y: h + c * 0.72, corner: true },
  ];
}

/** AI difficulty rows — content, not logic. */
export const DIFFICULTIES = {
  easy: {
    id: 'easy',
    name: 'Easy',
    blurb: 'Wobbly aim, soft breaks.',
    aimJitter: 0.16,
    powerJitter: 0.22,
    powerMul: 0.72,
    thinkSec: 0.85,
    missBias: 0.45,
  },
  medium: {
    id: 'medium',
    name: 'Medium',
    blurb: 'Decent lines, occasional miss.',
    aimJitter: 0.07,
    powerJitter: 0.12,
    powerMul: 0.88,
    thinkSec: 0.55,
    missBias: 0.18,
  },
  hard: {
    id: 'hard',
    name: 'Hard',
    blurb: 'Tight cuts, firm pace.',
    aimJitter: 0.025,
    powerJitter: 0.05,
    powerMul: 0.98,
    thinkSec: 0.35,
    missBias: 0.04,
  },
};

export const DIFFICULTY_IDS = ['easy', 'medium', 'hard'];

export function scoreClear(shots, pocketed) {
  if (pocketed < 15) return Math.max(0, pocketed * 10 - shots);
  return Math.max(1, 500 - shots * 8);
}
