/* Namespaced, versioned localStorage. Keys always start with break.v1. */

const PROFILE_KEY = 'break.v1.profile';
const SCHEMA = 1;

const DEFAULT_PROFILE = () => ({
  schema: SCHEMA,
  bestShots: 0,
  bestClears: 0,
  runs: 0,
  clears: 0,
  totalShots: 0,
  totalPocketed: 0,
});

function migrate(raw) {
  if (!raw || typeof raw !== 'object') return DEFAULT_PROFILE();
  const base = DEFAULT_PROFILE();
  return {
    ...base,
    ...raw,
    schema: SCHEMA,
    bestShots: Math.max(0, Math.floor(Number(raw.bestShots) || 0)),
    bestClears: Math.max(0, Math.floor(Number(raw.bestClears) || 0)),
    runs: Math.max(0, Math.floor(Number(raw.runs) || 0)),
    clears: Math.max(0, Math.floor(Number(raw.clears) || 0)),
    totalShots: Math.max(0, Math.floor(Number(raw.totalShots) || 0)),
    totalPocketed: Math.max(0, Math.floor(Number(raw.totalPocketed) || 0)),
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
      return DEFAULT_PROFILE();
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
