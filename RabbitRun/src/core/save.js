/* Namespaced, versioned localStorage. Keys always start with rabbit.v1. */

const PROFILE_KEY = 'rabbit.v1.profile';
const SCHEMA = 1;

const DEFAULT_PROFILE = () => ({
  schema: SCHEMA,
  bestScore: 0,
  bestDistance: 0,
  bestCarrots: 0,
  runs: 0,
  totalCarrots: 0,
});

function migrate(raw) {
  if (!raw || typeof raw !== 'object') return DEFAULT_PROFILE();
  return { ...DEFAULT_PROFILE(), ...raw, schema: SCHEMA };
}

export const Save = {
  loadProfile() {
    try {
      const raw = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
      const profile = migrate(raw);
      if (!raw || raw.schema !== SCHEMA) Save.writeProfile(profile);
      return profile;
    } catch {
      return DEFAULT_PROFILE();
    }
  },

  writeProfile(profile) {
    try {
      localStorage.setItem(
        PROFILE_KEY,
        JSON.stringify({ ...profile, schema: SCHEMA })
      );
      return true;
    } catch {
      return false;
    }
  },
};
