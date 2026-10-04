/* Namespaced, versioned localStorage. Keys always start with apex.v1. */

const PROFILE_KEY = 'apex.v1.profile';
const SCHEMA = 1;

const DEFAULT_PROFILE = () => ({
  schema: SCHEMA,
  bestScore: 0,
  bestAltitude: 0,
  bestCoins: 0,
  runs: 0,
  totalCoins: 0,
  passedMoon: false,
  passedMars: false,
});

function migrate(raw) {
  if (!raw || typeof raw !== 'object') return DEFAULT_PROFILE();
  if (raw.schema !== SCHEMA) return DEFAULT_PROFILE();
  return { ...DEFAULT_PROFILE(), ...raw, schema: SCHEMA };
}

export const Save = {
  loadProfile() {
    try {
      const raw = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
      return migrate(raw);
    } catch {
      return DEFAULT_PROFILE();
    }
  },

  writeProfile(profile) {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...profile, schema: SCHEMA }));
      return true;
    } catch {
      return false;
    }
  },
};
