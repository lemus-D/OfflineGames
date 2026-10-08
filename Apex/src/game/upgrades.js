/* Upgrade catalog + stat folding. Content in data; one buyer applies it. */

export const UPGRADES = {
  tank: {
    id: 'tank',
    name: 'Tanker',
    desc: 'Bigger tank. Launch with a full load.',
    maxLevel: 5,
    costs: [8, 18, 36, 70, 120],
  },
  thrust: {
    id: 'thrust',
    name: 'Thrusters',
    desc: 'Climb and cruise faster.',
    maxLevel: 5,
    costs: [8, 18, 36, 70, 120],
  },
  scoop: {
    id: 'scoop',
    name: 'Fuel Scoop',
    desc: 'Gas cans refill more.',
    maxLevel: 5,
    costs: [6, 14, 30, 60, 100],
  },
  hull: {
    id: 'hull',
    name: 'Hull Plating',
    desc: 'Asteroids chip less hull integrity.',
    maxLevel: 5,
    costs: [10, 20, 40, 80, 140],
  },
};

export const UPGRADE_IDS = Object.keys(UPGRADES);

export function emptyUpgrades() {
  return { tank: 0, thrust: 0, scoop: 0, hull: 0 };
}

/** Merge saved upgrade levels onto defaults. */
export function normalizeUpgrades(raw) {
  const base = emptyUpgrades();
  if (!raw || typeof raw !== 'object') return base;
  for (const id of UPGRADE_IDS) {
    const n = Number(raw[id]) || 0;
    base[id] = Math.max(0, Math.min(UPGRADES[id].maxLevel, Math.floor(n)));
  }
  return base;
}

/**
 * Fold owned upgrade levels into runtime stats.
 * Kept modest so maxed ships still take skill — not a free climb.
 * fuel is stored in absolute tank units (not 0–1 only).
 */
export function foldStats(upgrades = {}) {
  const u = normalizeUpgrades(upgrades);
  const tank = u.tank;
  const thrust = u.thrust;
  const scoop = u.scoop;
  const hull = u.hull;

  const fuelMax = 1 + tank * 0.12; // 1.00 → 1.60
  const healthMax = 1 + hull * 0.08; // 1.00 → 1.40
  return {
    upgrades: u,
    fuelMax,
    fuelStart: fuelMax, // launch full
    healthMax,
    healthStart: healthMax,
    thrustMul: 1 + thrust * 0.06, // → 1.30
    maxSpeedMul: 1 + thrust * 0.05, // → 1.25
    maxClimbMul: 1 + thrust * 0.05,
    fuelPickupMul: 1 + scoop * 0.12, // → 1.60
    /** Multiplier on meteor fuel splash (negative gains). */
    meteorDrainMul: Math.max(0.55, 1 - hull * 0.08), // → 0.60
    /** Multiplier on asteroid hull damage. */
    healthDamageMul: Math.max(0.5, 1 - hull * 0.1), // → 0.50
  };
}

export function nextCost(id, level) {
  const def = UPGRADES[id];
  if (!def) return null;
  if (level >= def.maxLevel) return null;
  return def.costs[level];
}

/**
 * Try to buy one level. Mutates profile. Returns { ok, reason? }.
 */
export function buyUpgrade(profile, id) {
  const def = UPGRADES[id];
  if (!def) return { ok: false, reason: 'unknown' };
  profile.upgrades = normalizeUpgrades(profile.upgrades);
  const level = profile.upgrades[id] || 0;
  if (level >= def.maxLevel) return { ok: false, reason: 'max' };
  const cost = def.costs[level];
  const bank = Number(profile.bankCoins) || 0;
  if (bank < cost) return { ok: false, reason: 'broke' };
  profile.bankCoins = bank - cost;
  profile.upgrades[id] = level + 1;
  return { ok: true, cost, level: level + 1 };
}
