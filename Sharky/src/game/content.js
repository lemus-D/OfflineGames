/* Content tables only — animals, prey templates, predators, upgrades.
   Applied by a single fold function; never special-cased in play code. */

import { lerp } from '../core/rng.js';

/** @typedef {{ id: string, name: string, unlockMilestone: number, biteRatio: number, speed: number, hungerDrain: number, turn: number, boostCost: number, species: object, exclusives: string[] }} AnimalDef */

export const ANIMALS = {
  'reef-shark': {
    id: 'reef-shark',
    name: 'Reef Shark',
    unlockMilestone: 0,
    biteRatio: 1.0,
    speed: 1.0,
    hungerDrain: 1.0,
    turn: 1.0,
    boostCost: 1.0,
    exclusives: ['reef-ambush', 'reef-cartilage'],
    species: {
      bodyDepth: 0.3,
      noseSharp: 1.0,
      tailKind: 'lunate',
      tailSpan: 0.95,
      dorsal: 0.62,
      pectoral: 0.34,
      eye: 0.055,
      jaw: 1,
      pattern: 'belly',
      bend: 0.8,
      hue: 205,
      hue2: 200,
      sat: 14,
      light: 46,
      seed: 31337,
    },
  },
  gulper: {
    id: 'gulper',
    name: 'Gulper',
    unlockMilestone: 2,
    biteRatio: 1.6,
    speed: 0.72,
    hungerDrain: 1.45,
    turn: 0.85,
    boostCost: 1.15,
    exclusives: ['gulper-feast', 'gulper-yawn'],
    species: {
      bodyDepth: 0.48,
      noseSharp: 0.42,
      tailKind: 'round',
      tailSpan: 0.7,
      dorsal: 0.18,
      pectoral: 0.22,
      eye: 0.09,
      jaw: 0.85,
      pattern: 'none',
      bend: 1.15,
      hue: 275,
      hue2: 300,
      sat: 28,
      light: 38,
      seed: 4242,
    },
  },
  'pistol-shrimp': {
    id: 'pistol-shrimp',
    name: 'Pistol Shrimp',
    unlockMilestone: 4,
    biteRatio: 0.6,
    speed: 1.45,
    hungerDrain: 0.7,
    turn: 1.35,
    boostCost: 0.8,
    exclusives: ['shrimp-stun', 'shrimp-snap'],
    species: {
      bodyDepth: 0.36,
      noseSharp: 0.7,
      tailKind: 'fork',
      tailSpan: 0.85,
      dorsal: 0.12,
      pectoral: 0.4,
      eye: 0.11,
      jaw: 0.2,
      pattern: 'stripes',
      bend: 1.4,
      hue: 12,
      hue2: 35,
      sat: 55,
      light: 52,
      seed: 777,
    },
  },
};

/** Unlock milestones are counted as lifetime runs completed. */
export const UNLOCK_BY_RUNS = {
  0: 'reef-shark',
  2: 'gulper',
  4: 'pistol-shrimp',
};

export const SHARED_UPGRADES = [
  {
    id: 'wider-jaw',
    name: 'Wider Jaw',
    desc: 'Bite ratio +0.15',
    apply: (s) => {
      s.biteRatio += 0.15;
    },
  },
  {
    id: 'slick-skin',
    name: 'Slick Skin',
    desc: 'Top speed +12%',
    apply: (s) => {
      s.speed *= 1.12;
    },
  },
  {
    id: 'efficient-gut',
    name: 'Efficient Gut',
    desc: 'Hunger drain −15%',
    apply: (s) => {
      s.hungerDrain *= 0.85;
    },
  },
  {
    id: 'second-wind',
    name: 'Second Wind',
    desc: 'Survive one lethal hit',
    apply: (s) => {
      s.secondWind = true;
    },
  },
  {
    id: 'panic-dash',
    name: 'Panic Dash',
    desc: 'Free boost for 2s after a hit',
    apply: (s) => {
      s.panicDash = true;
    },
  },
  {
    id: 'chum-sense',
    name: 'Chum Sense',
    desc: 'Outline nearby prey',
    apply: (s) => {
      s.chumSense = true;
    },
  },
  {
    id: 'growth-spurt',
    name: 'Growth Spurt',
    desc: 'Mass per meal +20%',
    apply: (s) => {
      s.growthMul *= 1.2;
    },
  },
  {
    id: 'thick-hide',
    name: 'Thick Hide',
    desc: 'Predators need 1.25× mass',
    apply: (s) => {
      s.predatorAdvantage = 1.25;
    },
  },
];

export const EXCLUSIVE_UPGRADES = {
  'reef-ambush': {
    id: 'reef-ambush',
    name: 'Reef Ambush',
    desc: 'Boost acceleration +25%',
    apply: (s) => {
      s.boostAccel *= 1.25;
    },
  },
  'reef-cartilage': {
    id: 'reef-cartilage',
    name: 'Cartilage Spring',
    desc: 'Turn rate +18%',
    apply: (s) => {
      s.turn *= 1.18;
    },
  },
  'gulper-feast': {
    id: 'gulper-feast',
    name: 'Oversize Feast',
    desc: 'Oversized prey heals hunger +30%',
    apply: (s) => {
      s.oversizeHeal = 0.3;
    },
  },
  'gulper-yawn': {
    id: 'gulper-yawn',
    name: 'Abyssal Yawn',
    desc: 'Bite ratio +0.25',
    apply: (s) => {
      s.biteRatio += 0.25;
    },
  },
  'shrimp-stun': {
    id: 'shrimp-stun',
    name: 'Sonic Stun',
    desc: 'Boost briefly stuns predators',
    apply: (s) => {
      s.boostStun = 1.2;
    },
  },
  'shrimp-snap': {
    id: 'shrimp-snap',
    name: 'Snap Chain',
    desc: 'Stun lasts longer',
    apply: (s) => {
      s.boostStun = (s.boostStun || 0.8) + 0.8;
    },
  },
};

export const ALL_UPGRADES = Object.fromEntries([
  ...SHARED_UPGRADES.map((u) => [u.id, u]),
  ...Object.values(EXCLUSIVE_UPGRADES).map((u) => [u.id, u]),
]);

/** Prey / predator templates: relative mass band + species seed recipe. */
export const FAUNA = [
  { kind: 'prey', name: 'minnow', massMin: 0.08, massMax: 0.22, speed: 0.7, hue: 48 },
  { kind: 'prey', name: 'sardine', massMin: 0.2, massMax: 0.45, speed: 0.85, hue: 190 },
  { kind: 'prey', name: 'parrot', massMin: 0.4, massMax: 0.75, speed: 0.75, hue: 140 },
  { kind: 'prey', name: 'grouper', massMin: 0.65, massMax: 0.95, speed: 0.55, hue: 30 },
  { kind: 'predator', name: 'barracuda', massMin: 1.15, massMax: 1.8, speed: 1.05, hue: 210 },
  { kind: 'predator', name: 'mako', massMin: 1.6, massMax: 2.6, speed: 1.15, hue: 200 },
  { kind: 'predator', name: 'leviathan', massMin: 2.4, massMax: 4.0, speed: 0.9, hue: 220 },
];

/** Growth milestones (player mass) that pause for an upgrade draft. */
export const GROWTH_MILESTONES = [1.35, 1.9, 2.6, 3.5, 4.8, 6.5];

export const BASE_STATS = {
  biteRatio: 1,
  speed: 1,
  hungerDrain: 1,
  turn: 1,
  boostCost: 1,
  growthMul: 1,
  predatorAdvantage: 1,
  boostAccel: 1,
  secondWind: false,
  panicDash: false,
  chumSense: false,
  oversizeHeal: 0,
  boostStun: 0,
};

/** Fold animal base + picked upgrades into active run stats. */
export function foldStats(animalId, upgradeIds) {
  const animal = ANIMALS[animalId];
  const s = {
    ...BASE_STATS,
    biteRatio: animal.biteRatio,
    speed: animal.speed,
    hungerDrain: animal.hungerDrain,
    turn: animal.turn,
    boostCost: animal.boostCost,
  };
  for (const id of upgradeIds) {
    const u = ALL_UPGRADES[id];
    if (u) u.apply(s);
  }
  return s;
}

export function upgradePoolFor(animalId) {
  const animal = ANIMALS[animalId];
  const pool = [...SHARED_UPGRADES];
  for (const id of animal.exclusives) {
    if (EXCLUSIVE_UPGRADES[id]) pool.push(EXCLUSIVE_UPGRADES[id]);
  }
  return pool;
}

/** Draw three distinct upgrades; rng is seeded. */
export function draftUpgrades(animalId, ownedIds, rng) {
  const owned = new Set(ownedIds);
  const pool = upgradePoolFor(animalId).filter((u) => !owned.has(u.id));
  const picks = [];
  const bag = pool.slice();
  while (picks.length < 3 && bag.length) {
    const i = (rng() * bag.length) | 0;
    picks.push(bag.splice(i, 1)[0]);
  }
  // If pool exhausted, allow duplicates from shared.
  while (picks.length < 3) {
    const u = SHARED_UPGRADES[(rng() * SHARED_UPGRADES.length) | 0];
    if (!picks.find((p) => p.id === u.id)) picks.push(u);
    else break;
  }
  return picks;
}

export function speciesFromFauna(template, seed, rng) {
  const hue = template.hue + (rng() - 0.5) * 24;
  return {
    seed,
    bodyDepth: lerp(0.26, 0.48, rng()),
    noseSharp: lerp(0.4, 1.0, rng()),
    tailKind: ['fork', 'lunate', 'round'][(rng() * 3) | 0],
    tailSpan: lerp(0.55, 1.0, rng()),
    dorsal: lerp(0.1, 0.45, rng()),
    pectoral: lerp(0.12, 0.3, rng()),
    eye: lerp(0.05, 0.11, rng()),
    jaw: template.kind === 'predator' ? lerp(0.7, 1, rng()) : lerp(0, 0.45, rng()),
    pattern: ['none', 'stripes', 'spots', 'belly'][(rng() * 4) | 0],
    bend: lerp(0.6, 1.4, rng()),
    hue,
    hue2: (hue + lerp(10, 40, rng())) % 360,
    sat: lerp(22, 60, rng()),
    light: lerp(36, 62, rng()),
  };
}

export function unlockAnimals(profile) {
  const unlocked = { ...profile.unlocked };
  for (const [runsNeed, id] of Object.entries(UNLOCK_BY_RUNS)) {
    if (profile.runs >= Number(runsNeed)) unlocked[id] = true;
  }
  return unlocked;
}
