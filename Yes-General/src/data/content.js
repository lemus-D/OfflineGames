/* Content tables only — modes, difficulty, resources, buildings, events, combat.
   Applied by the match engine; never special-cased by id in turn logic. */

/** @typedef {{ id: string, name: string, turns: number, mapRadius: number }} ModeDef */
/** @typedef {{ id: string, name: string, aiCount: number, aiSkill: number, eventChance: number }} DifficultyDef */
/** @typedef {{ id: string, name: string, color: string, landValue: number, needsBuilding: string|null, yieldPerTurn: number }} ResourceDef */
/** @typedef {{ id: string, name: string, cost: Record<string, number>, on: 'gather'|'wonder'|'walls', effect: string }} BuildingDef */

export const MODES = {
  short: { id: 'short', name: 'Short', turns: 24, mapRadius: 4 },
  standard: { id: 'standard', name: 'Standard', turns: 40, mapRadius: 5 },
  long: { id: 'long', name: 'Long', turns: 60, mapRadius: 6 },
};

export const DIFFICULTIES = {
  easy: { id: 'easy', name: 'Easy', aiCount: 1, aiSkill: 0.35, eventChance: 0.08 },
  normal: { id: 'normal', name: 'Normal', aiCount: 2, aiSkill: 0.55, eventChance: 0.14 },
  hard: { id: 'hard', name: 'Hard', aiCount: 3, aiSkill: 0.75, eventChance: 0.22 },
};

export const RESOURCES = {
  food: {
    id: 'food',
    name: 'Food',
    color: '#6a9f4c',
    landValue: 2,
    needsBuilding: 'farm',
    yieldPerTurn: 3,
  },
  wood: {
    id: 'wood',
    name: 'Wood',
    color: '#5c7a3a',
    landValue: 2,
    needsBuilding: 'camp',
    yieldPerTurn: 2,
  },
  stone: {
    id: 'stone',
    name: 'Stone',
    color: '#8a8580',
    landValue: 3,
    needsBuilding: 'quarry',
    yieldPerTurn: 2,
  },
  ore: {
    id: 'ore',
    name: 'Ore',
    color: '#7a5a3a',
    landValue: 4,
    needsBuilding: 'mine',
    yieldPerTurn: 1,
  },
  barren: {
    id: 'barren',
    name: 'Barren',
    color: '#6b5e4e',
    landValue: 1,
    needsBuilding: null,
    yieldPerTurn: 0,
  },
};

export const RESOURCE_SPAWN_WEIGHTS = [
  { id: 'food', weight: 3 },
  { id: 'wood', weight: 3 },
  { id: 'stone', weight: 2 },
  { id: 'ore', weight: 1 },
  { id: 'barren', weight: 2 },
];

export const BUILDINGS = {
  farm: {
    id: 'farm',
    name: 'Farm',
    on: 'gather',
    cost: { food: 0, wood: 2, stone: 3, ore: 0 },
    effect: 'Harvests food from this hex each turn.',
  },
  camp: {
    id: 'camp',
    name: 'Lumber Camp',
    on: 'gather',
    cost: { food: 1, wood: 2, stone: 2, ore: 0 },
    effect: 'Harvests wood from this hex each turn.',
  },
  quarry: {
    id: 'quarry',
    name: 'Quarry',
    on: 'gather',
    cost: { food: 2, wood: 3, stone: 0, ore: 0 },
    effect: 'Harvests stone from this hex each turn.',
  },
  mine: {
    id: 'mine',
    name: 'Mine',
    on: 'gather',
    cost: { food: 2, wood: 3, stone: 5, ore: 0 },
    effect: 'Harvests ore from this hex each turn.',
  },
  walls: {
    id: 'walls',
    name: 'Stone Walls',
    on: 'walls',
    cost: { food: 0, wood: 2, stone: 6, ore: 0 },
    effect: 'Defenders on this hex fight at 1.5× strength.',
  },
  wonder: {
    id: 'wonder',
    name: 'Ancient Wonder',
    on: 'wonder',
    cost: { food: 30, wood: 30, stone: 55, ore: 20 },
    effect:
      'A victory monument at your capital — finish it to win the game immediately (like an ancient Wonder of the World).',
  },
};

export const GATHER_FOR_RESOURCE = {
  food: 'farm',
  wood: 'camp',
  stone: 'quarry',
  ore: 'mine',
};

export const EVENTS = {
  famine: {
    id: 'famine',
    name: 'Famine',
    weight: 3,
    kind: 'yield',
    turns: 3,
    yieldMul: 0.4,
  },
  raid: {
    id: 'raid',
    name: 'Raid',
    weight: 3,
    kind: 'raid',
    troopLoss: 0.25,
    territoryRisk: 0.15,
  },
  plague: {
    id: 'plague',
    name: 'Plague',
    weight: 2,
    kind: 'raid',
    troopLoss: 0.35,
    territoryRisk: 0.05,
  },
};

export const COMBAT = {
  minWinChance: 0.08,
  maxWinChance: 0.92,
  winLossFrac: 0.2,
  loseLossFrac: 0.55,
  defWinLossFrac: 0.6,
  defLoseLossFrac: 0.15,
  /** Multiplier applied to defender troop count when stone walls present. */
  wallsDefenseMul: 1.5,
};

export const STARTING_STOCK = { food: 8, wood: 6, stone: 8, ore: 0 };

/** Troops cost food only. Stone is for buildings and walls. */
export const TROOP_COST = { food: 2, wood: 0, stone: 0, ore: 0 };
export const TROOPS_PER_RECRUIT = 5;
export const STARTING_TROOPS = 12;
export const TROOP_STAMINA_MAX = 3;

export const START_CLAIM_RADIUS = 2;

export const RESOURCE_SCORE = { food: 1, wood: 1, stone: 3, ore: 4 };

export const PLAYER_COLORS = ['#d4a04a', '#4a8fd4', '#d45a4a', '#7a4ad4', '#4ad49a'];

export const RESOURCE_LABELS = {
  food: 'Food',
  wood: 'Wood',
  stone: 'Stone',
  ore: 'Ore',
};
