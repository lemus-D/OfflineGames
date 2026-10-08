/* Table geometry, ball catalog, tunables. Content lives here; play applies it. */

export const FIXED_DT = 1 / 120;

/** Playing surface in world units (2:1 table). Origin at center. */
export const TABLE = {
  halfW: 112,
  halfH: 56,
  cushion: 4.2,
  pocketR: 5.6,
  /** Corner / side pocket centers relative to rail insides. */
  pocketInset: 0.35,
};

export const BALL_R = 2.85;

export const PHYSICS = {
  friction: 0.992,
  stopSpeed: 0.04,
  cushionRestitution: 0.78,
  ballRestitution: 0.98,
  /** Max cue impulse magnitude (world units / sec). */
  maxShotSpeed: 95,
  /** Screen pixels of drag that maps to max power (scaled in main). */
  maxPullPx: 160,
  minPullPx: 8,
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

export function pocketCenters() {
  const { halfW: w, halfH: h, pocketInset: i } = TABLE;
  return [
    { x: -w + i, y: -h + i, corner: true },
    { x: 0, y: -h - 0.4, corner: false },
    { x: w - i, y: -h + i, corner: true },
    { x: -w + i, y: h - i, corner: true },
    { x: 0, y: h + 0.4, corner: false },
    { x: w - i, y: h - i, corner: true },
  ];
}

export function scoreClear(shots, pocketed) {
  // Lower shots is better; pocketed is usually 15 on a clear.
  if (pocketed < 15) return Math.max(0, pocketed * 10 - shots);
  return Math.max(1, 500 - shots * 8);
}
