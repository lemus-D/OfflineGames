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
   * Corners use a slightly wider mouth so jaw clips fall instead of kicking out.
   */
  pocketMouth: 2.95,
  pocketMouthCorner: 3.55,
  /** Capture / funnel radius around off-table pocket centers. */
  pocketJaw: 8.4,
  /**
   * How far outside the felt the pocket centers sit (into the wood rail).
   * Close enough that the mouth meets the corner, without the disc on the cloth.
   */
  pocketOut: 6.2,
  pocketOutSide: 6.4,
  /** Half-width of the rail opening / cushion jaw into each pocket. */
  railGap: 8.8,
  /** Extra rail opening at corners so the tip does not reject near-misses. */
  railGapCorner: 10.5,
  /** Visual cushion thickness (drawn along the felt edge). */
  cushionFace: 3.8,
};

export const BALL_R = 2.85;

export const PHYSICS = {
  /** Relative ball mass — higher = heavier (same cue stroke → less speed). */
  ballMass: 1.45,
  /**
   * Cloth drag (units/s²). Higher = less “ice”. Tuned so a firm stroke
   * dies in about one table length, not a long glide.
   */
  rollingDrag: 22,
  /** Extra drag while sliding (spin not matching travel). */
  slidingDrag: 18,
  /** Mild speed-proportional cloth bite (units/s per unit speed). */
  rollingDragVel: 0.07,
  /** Settle sooner so balls don’t creep forever. */
  stopSpeed: 0.18,
  cushionRestitution: 0.58,
  /** Fraction of tangent speed killed on rail. */
  cushionFriction: 0.58,
  /** Ball–ball normal restitution — a touch dead so packs calm down. */
  ballRestitution: 0.9,
  /** Tangential friction on ball–ball hits (kills skating past). */
  ballFriction: 0.22,
  /** Max cue impulse magnitude before mass (world units / sec). */
  maxShotSpeed: 230,
  /** How strongly tip English becomes stored spin. */
  englishToSpin: 0.5,
  /** Side spin kick on cushions. */
  sideOnCushion: 0.32,
  /** Throw: side spin nudges object ball on contact. */
  throwFactor: 0.16,
  /** Follow / draw blend into cue residual after a hit. */
  followFactor: 0.42,
  drawFactor: 0.4,
  /** Per-step spin fade at 180 Hz — lower = cloth eats English faster. */
  spinDecay: 0.982,
  /** Cap |english| tip offset. */
  maxEnglish: 0.88,
  /** Screen pixels of drag that maps to max power (room to swivel on touch). */
  maxPullPx: 200,
  minPullPx: 10,
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

/**
 * Pocket centers sit in the wood rails, outside the felt rectangle.
 * Corner holes sit on the diagonal out from each corner; side holes
 * sit centered on the long rails.
 */
export function pocketCenters() {
  const w = TABLE.halfW;
  const h = TABLE.halfH;
  const c = TABLE.pocketOut;
  const s = TABLE.pocketOutSide;
  // Corners sit just off the felt corner, still in the wood.
  // Lower k = closer to the cloth corner (easier to drop).
  const k = 0.38;
  return [
    { id: 0, key: 'tl', label: 'top-left', x: -w - c * k, y: -h - c * k, corner: true },
    { id: 1, key: 'top', label: 'top side', x: 0, y: -h - s * 0.7, corner: false },
    { id: 2, key: 'tr', label: 'top-right', x: w + c * k, y: -h - c * k, corner: true },
    { id: 3, key: 'bl', label: 'bottom-left', x: -w - c * k, y: h + c * k, corner: true },
    { id: 4, key: 'bot', label: 'bottom side', x: 0, y: h + s * 0.7, corner: false },
    { id: 5, key: 'br', label: 'bottom-right', x: w + c * k, y: h + c * k, corner: true },
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
    blurb: 'Sharp aim, few gifts.',
    aimJitter: 0.014,
    powerJitter: 0.03,
    powerMul: 1.0,
    thinkSec: 0.28,
    missBias: 0.012,
  },
  extraHard: {
    id: 'extraHard',
    name: 'Extra Hard',
    blurb: 'Near-perfect lines. Good luck.',
    aimJitter: 0.004,
    powerJitter: 0.012,
    powerMul: 1.0,
    thinkSec: 0.18,
    missBias: 0,
  },
};

export const DIFFICULTY_IDS = ['easy', 'medium', 'hard', 'extraHard'];

export function scoreClear(shots, pocketed) {
  if (pocketed < 15) return Math.max(0, pocketed * 10 - shots);
  return Math.max(1, 500 - shots * 8);
}
