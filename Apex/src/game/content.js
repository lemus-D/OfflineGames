/* Tunables and pickup table. Content lives here; play.js applies it. */

export const FIXED_DT = 1 / 60;

/** World half-width; X wraps so the map is infinite side-to-side. */
export const WORLD_HALF_W = 220;
/** Full wrap period on X. */
export const WORLD_W = WORLD_HALF_W * 2;

/** Wrap world X into [-WORLD_HALF_W, WORLD_HALF_W). */
export function wrapX(x) {
  const w = WORLD_W;
  x = ((((x + WORLD_HALF_W) % w) + w) % w) - WORLD_HALF_W;
  return x;
}

/** Shortest signed ΔX across the wrap (for physics / collision). */
export function deltaX(from, to) {
  return wrapX(to - from);
}

/** Launch pad in world space. Deck is the top surface; ground is y = 0. */
export const PAD = {
  x: 0,
  /** World Y of the platform deck the rocket sits on. */
  deckY: 28,
  /** Half-width of the deck. */
  halfW: 48,
};

export const ROCKET = {
  /** Accel along the rocket's nose while boosting (world units / sec²). */
  thrustAccel: 780,
  /** Downward accel when not thrusting. */
  gravity: 520,
  maxClimbSpeed: 300,
  maxFallSpeed: 360,
  maxSpeed: 340,
  /** How fast left/right rotates the nose (rad / sec). */
  tiltRate: 2.8,
  /** Full free rotation — no max lean clamp. */
  freeRotate: true,
  drag: 0.985,
  radius: 16,
  startFuel: 1,
  /** Hull hit points (absolute). Asteroids chip this down. */
  startHealth: 1,
  healthMax: 1,
  /** Fuel burned per second while boosting. */
  burnRate: 0.12,
  /** Sit on the pad deck (sprite center above the deck). */
  startY: PAD.deckY + 18,
};

/** Pickup kinds as data rows. */
export const PICKUPS = {
  fuel: {
    id: 'fuel',
    radius: 18,
    fuelGain: 0.28,
    healthDamage: 0,
    score: 5,
    weight: 0.36,
  },
  coin: {
    id: 'coin',
    radius: 11,
    fuelGain: 0,
    healthDamage: 0,
    score: 25,
    weight: 0.4,
  },
  meteor: {
    id: 'meteor',
    radius: 18,
    /** Small splash of fuel loss; hull takes the real hit. */
    fuelGain: -0.06,
    healthDamage: 0.34,
    score: 0,
    /** Slightly rarer so the sky stays more pickups than hazards. */
    weight: 0.12,
  },
  blackhole: {
    id: 'blackhole',
    radius: 42,
    fuelGain: 0,
    healthDamage: 0,
    score: 0,
    weight: 0.035,
    /** Min world Y before this kind may spawn. */
    minY: 900,
    /** Pull strength (accel ≈ pull / dist², capped). */
    pull: 220000,
    /** Soft max pull accel. */
    pullCap: 2200,
    /** Event-horizon radius as a fraction of entity radius. */
    horizonMul: 0.4,
  },
};

export const SPAWN = {
  /** Distance above rocket to keep / place bands. */
  ahead: 520,
  /** Distance below rocket to keep / refill bands (for falling collects). */
  behind: 520,
  /** Spacing between spawn bands (world Y). */
  bandGap: 95,
  /** How many items per band (min/max inclusive). */
  perBandMin: 1,
  perBandMax: 3,
  /** Horizontal spread fraction of world width. */
  spread: 0.92,
  /** Extra margin before culling / forgetting a band. */
  cullPad: 120,
};

export function scoreFromRun(altitude, coins, pickupScore) {
  return Math.floor(altitude) + coins * 10 + pickupScore;
}

/** Wrap angle to (-π, π]. */
export function wrapAngle(a) {
  const t = Math.PI * 2;
  a = ((a % t) + t) % t;
  if (a > Math.PI) a -= t;
  return a;
}

/** Display degrees 0–359, 0 = nose up. */
export function tiltDegrees(tiltRad) {
  let deg = Math.round((tiltRad * 180) / Math.PI);
  deg = ((deg % 360) + 360) % 360;
  return deg;
}
