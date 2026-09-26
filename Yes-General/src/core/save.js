/* Namespaced, versioned localStorage. Keys always start with yes-general.v1. */

const PROFILE_KEY = 'yes-general.v1.profile';
const SCHEMA = 1;

const DEFAULT_PROFILE = () => ({
  schema: SCHEMA,
  wins: 0,
  losses: 0,
  bestScore: 0,
  lastMode: 'standard',
  lastDifficulty: 'normal',
});

function migrate(raw) {
  if (!raw || typeof raw !== 'object') return DEFAULT_PROFILE();
  if (raw.schema !== SCHEMA) return DEFAULT_PROFILE();
  const base = DEFAULT_PROFILE();
  return { ...base, ...raw, schema: SCHEMA };
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
