/* Tunables and pickup table. Content lives here; play.js applies it. */

export const FIXED_DT = 1 / 60;

/** World half-width the rocket can travel in. */
export const WORLD_HALF_W = 220;

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
  /** Fuel burned per second while boosting. */
  burnRate: 0.12,
  /** Start height above the pad. */
  startY: 48,
};

/** Pickup kinds as data rows. */
export const PICKUPS = {
  fuel: {
    id: 'fuel',
    radius: 18,
    fuelGain: 0.28,
    score: 5,
    weight: 0.38,
  },
  coin: {
    id: 'coin',
    radius: 11,
    fuelGain: 0,
    score: 25,
    weight: 0.42,
  },
  meteor: {
    id: 'meteor',
    radius: 18,
    fuelGain: -0.22,
    score: 0,
    weight: 0.2,
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
