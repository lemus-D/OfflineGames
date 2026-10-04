/* Upgrade catalog + stat folding. Content in data; one buyer applies it. */

export const UPGRADES = {
  tank: {
    id: 'tank',
    name: 'Tanker',
    desc: 'Bigger tank. Launch with a full load.',
    maxLevel: 5,
    costs: [5, 12, 25, 50, 90],
  },
  thrust: {
    id: 'thrust',
    name: 'Thrusters',
    desc: 'Climb and cruise faster.',
    maxLevel: 5,
    costs: [5, 12, 25, 50, 90],
  },
  scoop: {
    id: 'scoop',
    name: 'Fuel Scoop',
    desc: 'Gas cans refill more.',
    maxLevel: 5,
    costs: [4, 10, 22, 45, 80],
  },
  hull: {
    id: 'hull',
    name: 'Hull Plating',
    desc: 'Meteors steal less fuel.',
    maxLevel: 5,
    costs: [6, 14, 28, 55, 100],
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
 * fuel is stored in absolute tank units (not 0–1 only).
 */
export function foldStats(upgrades = {}) {
  const u = normalizeUpgrades(upgrades);
  const tank = u.tank;
  const thrust = u.thrust;
  const scoop = u.scoop;
  const hull = u.hull;

  const fuelMax = 1 + tank * 0.25; // 1.00 → 2.25
  return {
    upgrades: u,
    fuelMax,
    fuelStart: fuelMax, // launch full
    thrustMul: 1 + thrust * 0.14,
    maxSpeedMul: 1 + thrust * 0.12,
    maxClimbMul: 1 + thrust * 0.12,
    fuelPickupMul: 1 + scoop * 0.28,
    /** Multiplier on meteor fuel loss (negative gains). */
    meteorDrainMul: Math.max(0.2, 1 - hull * 0.16),
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
