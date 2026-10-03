/* Tunables and pickup table. Content lives here; play.js applies it. */

export const FIXED_DT = 1 / 60;

/** World half-width the rocket can travel in. */
export const WORLD_HALF_W = 220;

export const ROCKET = {
  climbSpeed: 160, // world units / sec upward
  steerAccel: 520,
  maxSteerSpeed: 210,
  drag: 0.9, // per-frame factor at 60 Hz
  radius: 14,
  startFuel: 1,
  burnRate: 0.085, // fuel / sec at base climb
};

/** Pickup kinds as data rows. */
export const PICKUPS = {
  fuel: {
    id: 'fuel',
    radius: 16,
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
  /** Distance above rocket to place new bands. */
  ahead: 520,
  /** Spacing between spawn bands (world Y). */
  bandGap: 95,
  /** How many items per band (min/max inclusive). */
  perBandMin: 1,
  perBandMax: 3,
  /** Horizontal spread fraction of world width. */
  spread: 0.92,
  /** Cull pickups this far below the rocket. */
  cullBelow: 280,
};

export function scoreFromRun(altitude, coins, pickupScore) {
  return Math.floor(altitude) + coins * 10 + pickupScore;
}
