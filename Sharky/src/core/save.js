/* Namespaced, versioned localStorage. Keys always start with sharky.v1. */

const PROFILE_KEY = 'sharky.v1.profile';
const SCHEMA = 1;

const DEFAULT_PROFILE = () => ({
  schema: SCHEMA,
  bestScore: 0,
  bestMass: 0,
  runs: 0,
  totalEaten: 0,
  unlocked: { 'reef-shark': true },
  lastAnimal: 'reef-shark',
});

function migrate(raw) {
  if (!raw || typeof raw !== 'object') return DEFAULT_PROFILE();
  if (raw.schema !== SCHEMA) return DEFAULT_PROFILE();
  const base = DEFAULT_PROFILE();
  return {
    ...base,
    ...raw,
    unlocked: { ...base.unlocked, ...(raw.unlocked || {}) },
    schema: SCHEMA,
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

  /** Base64 export of the profile JSON. */
  exportCode(profile) {
    const json = JSON.stringify({ ...profile, schema: SCHEMA });
    return btoa(unescape(encodeURIComponent(json)));
  },

  importCode(code) {
    try {
      const json = decodeURIComponent(escape(atob(code.trim())));
      const raw = JSON.parse(json);
      const profile = migrate(raw);
      this.writeProfile(profile);
      return profile;
    } catch {
      return null;
    }
  },
};
