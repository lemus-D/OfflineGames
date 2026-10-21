/* Namespaced, versioned localStorage. Keys always start with unfair-pickle.v1. */

const PROFILE_KEY = 'unfair-pickle.v1.profile';
const SCHEMA = 1;

const DEFAULT_PROFILE = () => ({
  schema: SCHEMA,
  bestClearTime: null,
  fewestDeaths: null,
  clears: 0,
  runs: 0,
  totalDeaths: 0,
});

function migrate(raw) {
  if (!raw || typeof raw !== 'object') return DEFAULT_PROFILE();
  const base = DEFAULT_PROFILE();
  const merged = { ...base, ...raw, schema: SCHEMA };
  merged.clears = Math.max(0, Math.floor(Number(merged.clears) || 0));
  merged.runs = Math.max(0, Math.floor(Number(merged.runs) || 0));
  merged.totalDeaths = Math.max(0, Math.floor(Number(merged.totalDeaths) || 0));
  if (merged.bestClearTime != null) {
    const t = Number(merged.bestClearTime);
    merged.bestClearTime = Number.isFinite(t) && t > 0 ? t : null;
  }
  if (merged.fewestDeaths != null) {
    const d = Math.floor(Number(merged.fewestDeaths));
    merged.fewestDeaths = Number.isFinite(d) && d >= 0 ? d : null;
  }
  return merged;
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
        JSON.stringify({ ...migrate(profile), schema: SCHEMA })
      );
      return true;
    } catch {
      return false;
    }
  },
};
