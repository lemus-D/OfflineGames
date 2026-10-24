/* Namespaced, versioned localStorage. Keys always start with grove-run.v1. */

const PROFILE_KEY = 'grove-run.v1.profile';
const SCHEMA = 1;

const DEFAULT_PROFILE = () => ({
  schema: SCHEMA,
  bestScore: 0,
  bestDistance: 0,
  bestCarrots: 0,
  runs: 0,
});

function migrate(raw) {
  if (!raw || typeof raw !== 'object') return DEFAULT_PROFILE();
  if (raw.schema !== SCHEMA) return DEFAULT_PROFILE();
  const base = DEFAULT_PROFILE();
  return {
    ...base,
    ...raw,
    schema: SCHEMA,
    bestScore: Math.max(0, Math.floor(Number(raw.bestScore) || 0)),
    bestDistance: Math.max(0, Math.floor(Number(raw.bestDistance) || 0)),
    bestCarrots: Math.max(0, Math.floor(Number(raw.bestCarrots) || 0)),
    runs: Math.max(0, Math.floor(Number(raw.runs) || 0)),
  };
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
