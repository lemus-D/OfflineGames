/* Namespaced, versioned localStorage. Keys always start with apex.v1. */

import { emptyUpgrades, normalizeUpgrades } from '../game/upgrades.js';

const PROFILE_KEY = 'apex.v1.profile';
const SCHEMA = 2;

const DEFAULT_PROFILE = () => ({
  schema: SCHEMA,
  bestScore: 0,
  bestAltitude: 0,
  bestCoins: 0,
  runs: 0,
  totalCoins: 0,
  /** Spendable coins for the hangar shop. */
  bankCoins: 0,
  upgrades: emptyUpgrades(),
  passedMoon: false,
  passedMars: false,
});

function migrate(raw) {
  if (!raw || typeof raw !== 'object') return DEFAULT_PROFILE();
  const base = DEFAULT_PROFILE();
  const merged = { ...base, ...raw, schema: SCHEMA };

  // v1 → v2: lifetime total becomes the bank if bank is missing.
  if (raw.schema === 1 || raw.bankCoins == null) {
    const lifetime = Number(raw.totalCoins) || 0;
    merged.bankCoins = Number(raw.bankCoins);
    if (!Number.isFinite(merged.bankCoins)) merged.bankCoins = lifetime;
  }

  merged.bankCoins = Math.max(0, Math.floor(Number(merged.bankCoins) || 0));
  merged.totalCoins = Math.max(0, Math.floor(Number(merged.totalCoins) || 0));
  merged.upgrades = normalizeUpgrades(merged.upgrades);
  return merged;
}

export const Save = {
  loadProfile() {
    try {
      const raw = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
      const profile = migrate(raw);
      // Persist schema bumps (e.g. v1 → bankCoins) so they stick.
      if (!raw || raw.schema !== SCHEMA) {
        Save.writeProfile(profile);
      }
      return profile;
    } catch {
      return DEFAULT_PROFILE();
    }
  },

  writeProfile(profile) {
    try {
      const clean = {
        ...profile,
        schema: SCHEMA,
        bankCoins: Math.max(0, Math.floor(Number(profile.bankCoins) || 0)),
        upgrades: normalizeUpgrades(profile.upgrades),
      };
      localStorage.setItem(PROFILE_KEY, JSON.stringify(clean));
      return true;
    } catch {
      return false;
    }
  },
};
