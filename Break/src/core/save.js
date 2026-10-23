/* Namespaced, versioned localStorage. Keys always start with break.v1. */

const PROFILE_KEY = 'break.v1.profile';
const SCHEMA = 3;

const emptyAi = () => ({ easy: 0, medium: 0, hard: 0, extraHard: 0 });

const DEFAULT_PROFILE = () => ({
  schema: SCHEMA,
  bestShots: 0,
  bestClears: 0,
  runs: 0,
  clears: 0,
  totalShots: 0,
  totalPocketed: 0,
  /** Wins vs AI by difficulty id. */
  aiWins: emptyAi(),
  aiLoss: emptyAi(),
});

function normalizeAi(map) {
  const base = emptyAi();
  if (!map || typeof map !== 'object') return base;
  for (const id of Object.keys(base)) {
    base[id] = Math.max(0, Math.floor(Number(map[id]) || 0));
  }
  return base;
}

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
    aiWins: normalizeAi(raw.aiWins),
    aiLosses: normalizeAi(raw.aiLosses),
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
