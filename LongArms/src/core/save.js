/* Namespaced, versioned localStorage. Keys always start with longarms.v1. */

const PROFILE_KEY = 'longarms.v1.profile';
const SCHEMA = 1;

const DEFAULT_PROFILE = () => ({
  schema: SCHEMA,
  bestScore: 0,
  wins: 0,
  runs: 0,
});

function migrate(raw) {
  if (!raw || typeof raw !== 'object') return DEFAULT_PROFILE();
  const base = DEFAULT_PROFILE();
  return {
    ...base,
    ...raw,
    schema: SCHEMA,
    bestScore: Math.max(0, Math.floor(Number(raw.bestScore) || 0)),
    wins: Math.max(0, Math.floor(Number(raw.wins) || 0)),
    runs: Math.max(0, Math.floor(Number(raw.runs) || 0)),
  };
}

export const Save = {
  loadProfile() {
    try {
      const raw = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
      const profile = migrate(raw);
      if (!raw || raw.schema !== SCHEMA) Save.writeProfile(profile);
      return profile;
    } catch {
      const fresh = DEFAULT_PROFILE();
      Save.writeProfile(fresh);
      return fresh;
    }
  },

  writeProfile(profile) {
    try {
      const clean = migrate(profile);
      localStorage.setItem(PROFILE_KEY, JSON.stringify(clean));
      return true;
    } catch {
      return false;
    }
  },
};
