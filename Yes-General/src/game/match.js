/* Match state: turns, stockpiles, build/recruit/attack, events, victory. */

import { makeRNG } from '../core/rng.js';
import {
  MODES,
  DIFFICULTIES,
  RESOURCES,
  BUILDINGS,
  GATHER_FOR_RESOURCE,
  EVENTS,
  STARTING_STOCK,
  TROOP_COST,
  TROOPS_PER_RECRUIT,
  STARTING_TROOPS,
  TROOP_STAMINA_MAX,
  RESOURCE_SCORE,
  PLAYER_COLORS,
  RESOURCE_LABELS,
  COMBAT,
} from '../data/content.js';
import { generateMap, partitionAndPlace, hexKey, hexNeighbors, parseKey } from './hex.js';
import { resolveCombat } from './combat.js';
import { aiTakeTurn } from './ai.js';

/**
 * @param {string} modeId
 * @param {string} difficultyId
 * @param {number} seed
 */
export function createMatch(modeId, difficultyId, seed) {
  const mode = MODES[modeId] || MODES.standard;
  const difficulty = DIFFICULTIES[difficultyId] || DIFFICULTIES.normal;
  const rng = makeRNG(seed >>> 0);
  const tiles = generateMap(seed ^ 0x9e3779b9, mode.mapRadius);

  const civCount = 1 + difficulty.aiCount;
  const capitalKeys = partitionAndPlace(tiles, civCount, rng);

  /** @type {object[]} */
  const civs = [];
  for (let i = 0; i < civCount; i++) {
    const id = i === 0 ? 'player' : `ai-${i}`;
    const capKey = capitalKeys[i];
    const cap = tiles.get(capKey);

    for (const tile of tiles.values()) {
      if (tile.ownerId === `__pending_${i}`) tile.ownerId = id;
    }

    cap.ownerId = id;
    cap.isCapital = true;
    cap.troops = STARTING_TROOPS;
    cap.stamina = TROOP_STAMINA_MAX;
    if (cap.resourceId === 'barren') cap.resourceId = 'food';

    civs.push({
      id,
      name: i === 0 ? 'You' : `Rival ${i}`,
      isPlayer: i === 0,
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      capital: { q: cap.q, r: cap.r },
      regionId: i,
      stock: { ...STARTING_STOCK },
      alive: true,
      wonderBuilt: false,
      yieldMul: 1,
      yieldMulTurns: 0,
    });
  }

  return {
    seed,
    mode,
    difficulty,
    tiles,
    civs,
    turn: 1,
    maxTurns: mode.turns,
    phase: 'play',
    winnerId: null,
    winReason: null,
    log: ['Claim land, build gatherers, recruit, attack — spend freely until End turn.'],
    selectedKey: capitalKeys[0],
    /** How many troops the player will send on the next move/attack. */
    detachCount: STARTING_TROOPS,
    rng,
    lastEvent: null,
  };
}

/** Restore full stamina for every stack owned by a civ. */
export function refreshStamina(match, civId) {
  for (const t of match.tiles.values()) {
    if (t.ownerId === civId && t.troops > 0) t.stamina = TROOP_STAMINA_MAX;
    if (t.ownerId === civId && t.troops <= 0) t.stamina = 0;
  }
}

function civById(match, id) {
  return match.civs.find((c) => c.id === id);
}

export function scoreCiv(match, civ) {
  let land = 0;
  let stock = 0;
  for (const tile of match.tiles.values()) {
    if (tile.ownerId === civ.id) land += tile.landValue;
  }
  for (const [rid, amt] of Object.entries(civ.stock)) {
    stock += (RESOURCE_SCORE[rid] || 0) * amt;
  }
  return land + stock;
}

function canAfford(stock, cost) {
  for (const [k, v] of Object.entries(cost)) {
    if ((stock[k] || 0) < v) return false;
  }
  return true;
}

function pay(stock, cost) {
  for (const [k, v] of Object.entries(cost)) {
    stock[k] = (stock[k] || 0) - v;
  }
}

function formatCost(cost) {
  const parts = [];
  for (const [k, v] of Object.entries(cost)) {
    if (v > 0) parts.push(`${v} ${RESOURCE_LABELS[k] || k}`);
  }
  return parts.length ? parts.join(', ') : 'Free';
}

function missingCost(stock, cost) {
  const parts = [];
  for (const [k, v] of Object.entries(cost)) {
    const have = stock[k] || 0;
    if (have < v) parts.push(`${v - have} more ${RESOURCE_LABELS[k] || k}`);
  }
  return parts;
}

function pushLog(match, msg) {
  match.log.unshift(msg);
  if (match.log.length > 40) match.log.length = 40;
}

export function collectYields(match, civ) {
  if (!civ.alive) return;
  const mul = civ.yieldMul;
  for (const tile of match.tiles.values()) {
    if (tile.ownerId !== civ.id) continue;
    const res = RESOURCES[tile.resourceId];
    if (!res || res.yieldPerTurn <= 0) continue;
    const need = GATHER_FOR_RESOURCE[tile.resourceId];
    const hasGather = tile.isCapital || (need && tile.buildingId === need);
    if (!hasGather) continue;
    const amt = Math.max(0, Math.floor(res.yieldPerTurn * mul));
    civ.stock[res.id] = (civ.stock[res.id] || 0) + amt;
  }
}

function tickModifiers(civ) {
  if (civ.yieldMulTurns > 0) {
    civ.yieldMulTurns -= 1;
    if (civ.yieldMulTurns <= 0) {
      civ.yieldMul = 1;
      civ.yieldMulTurns = 0;
    }
  }
}

function applyEvent(match, civ) {
  const chance = match.difficulty.eventChance;
  if (match.rng() > chance) return null;

  const list = Object.values(EVENTS);
  let total = 0;
  for (const e of list) total += e.weight;
  let roll = match.rng() * total;
  let ev = list[0];
  for (const e of list) {
    roll -= e.weight;
    if (roll <= 0) {
      ev = e;
      break;
    }
  }

  if (ev.kind === 'yield') {
    civ.yieldMul = ev.yieldMul;
    civ.yieldMulTurns = ev.turns;
    pushLog(match, `${ev.name}: yields cut for ${ev.turns} turns.`);
  } else if (ev.kind === 'raid') {
    let lostTroops = 0;
    const owned = [...match.tiles.values()].filter((t) => t.ownerId === civ.id);
    for (const t of owned) {
      const loss = Math.floor(t.troops * ev.troopLoss);
      t.troops -= loss;
      lostTroops += loss;
    }
    if (match.rng() < ev.territoryRisk) {
      const candidates = owned.filter((t) => !t.isCapital);
      if (candidates.length) {
        const t = candidates[(match.rng() * candidates.length) | 0];
        t.ownerId = null;
        t.buildingId = null;
        t.hasWalls = false;
        t.troops = 0;
        t.stamina = 0;
        pushLog(match, `${ev.name}: lost territory at (${t.q},${t.r}).`);
      }
    }
    pushLog(match, `${ev.name}: lost ${lostTroops} troops.`);
  }

  match.lastEvent = ev.id;
  return ev;
}

function checkWonder(match, civ) {
  if (civ.wonderBuilt) {
    match.phase = 'ended';
    match.winnerId = civ.id;
    match.winReason = 'wonder';
    pushLog(match, `${civ.name} completed the Ancient Wonder!`);
    return true;
  }
  return false;
}

function checkConquest(match) {
  const aliveOwners = new Set();
  for (const t of match.tiles.values()) {
    if (t.ownerId) aliveOwners.add(t.ownerId);
  }
  for (const civ of match.civs) {
    if (!aliveOwners.has(civ.id)) civ.alive = false;
  }

  const living = match.civs.filter((c) => c.alive);
  if (living.length === 1) {
    match.phase = 'ended';
    match.winnerId = living[0].id;
    match.winReason = 'conquest';
    pushLog(match, `${living[0].name} conquered the map.`);
    return true;
  }

  let sole = null;
  for (const t of match.tiles.values()) {
    if (!t.ownerId) return false;
    if (sole === null) sole = t.ownerId;
    else if (sole !== t.ownerId) return false;
  }
  if (sole) {
    const civ = civById(match, sole);
    match.phase = 'ended';
    match.winnerId = sole;
    match.winReason = 'conquest';
    pushLog(match, `${civ.name} owns every hex.`);
    return true;
  }
  return false;
}

function checkTimed(match) {
  if (match.turn < match.maxTurns) return false;
  let best = null;
  let bestScore = -1;
  for (const civ of match.civs) {
    if (!civ.alive) continue;
    const s = scoreCiv(match, civ);
    if (s > bestScore) {
      bestScore = s;
      best = civ;
    }
  }
  if (best) {
    match.phase = 'ended';
    match.winnerId = best.id;
    match.winReason = 'score';
    pushLog(match, `Time up — ${best.name} wins on score (${bestScore}).`);
    return true;
  }
  return false;
}

/** Build gather / wonder / walls on selected owned hex. */
export function tryBuild(match, civId, tileKey, buildingId) {
  if (match.phase !== 'play') return { ok: false, reason: 'ended' };
  const civ = civById(match, civId);
  const tile = match.tiles.get(tileKey);
  const def = BUILDINGS[buildingId];
  if (!civ?.alive || !tile || !def) return { ok: false, reason: 'bad' };
  if (tile.ownerId !== civId) return { ok: false, reason: 'not-yours' };
  if (!canAfford(civ.stock, def.cost)) return { ok: false, reason: 'cost' };

  if (def.on === 'wonder') {
    if (!tile.isCapital) return { ok: false, reason: 'wonder-capital' };
    pay(civ.stock, def.cost);
    civ.wonderBuilt = true;
    tile.buildingId = 'wonder';
    pushLog(match, `${civ.name} raised the Ancient Wonder!`);
    checkWonder(match, civ);
    return { ok: true };
  }

  if (def.on === 'walls') {
    if (tile.hasWalls) return { ok: false, reason: 'has-walls' };
    pay(civ.stock, def.cost);
    tile.hasWalls = true;
    pushLog(match, `${civ.name} raised stone walls at (${tile.q},${tile.r}).`);
    return { ok: true };
  }

  if (def.on === 'gather') {
    const need = GATHER_FOR_RESOURCE[tile.resourceId];
    if (need !== buildingId) return { ok: false, reason: 'wrong-building' };
    if (tile.buildingId) return { ok: false, reason: 'has-building' };
    if (tile.isCapital) return { ok: false, reason: 'capital' };
    pay(civ.stock, def.cost);
    tile.buildingId = buildingId;
    pushLog(match, `${civ.name} built ${def.name} at (${tile.q},${tile.r}).`);
    return { ok: true };
  }

  return { ok: false, reason: 'unknown' };
}

export function tryRecruit(match, civId, tileKey) {
  if (match.phase !== 'play') return { ok: false, reason: 'ended' };
  const civ = civById(match, civId);
  const tile = match.tiles.get(tileKey);
  if (!civ?.alive || !tile || tile.ownerId !== civId) return { ok: false, reason: 'bad' };
  if (!canAfford(civ.stock, TROOP_COST)) return { ok: false, reason: 'cost' };
  pay(civ.stock, TROOP_COST);
  const wasEmpty = tile.troops <= 0;
  tile.troops += TROOPS_PER_RECRUIT;
  if (wasEmpty) tile.stamina = TROOP_STAMINA_MAX;
  return { ok: true };
}

/**
 * Attack from owned hex into adjacent enemy/neutral hex with `amount` troops.
 */
export function tryAttack(match, civId, fromKey, toKey, amount) {
  if (match.phase !== 'play') return { ok: false, reason: 'ended' };
  const civ = civById(match, civId);
  const from = match.tiles.get(fromKey);
  const to = match.tiles.get(toKey);
  if (!civ?.alive || !from || !to) return { ok: false, reason: 'bad' };
  if (from.ownerId !== civId || from.troops <= 0) return { ok: false, reason: 'no-troops' };
  if (from.stamina <= 0) return { ok: false, reason: 'no-stamina' };
  if (to.ownerId === civId) return { ok: false, reason: 'own' };

  const adj = hexNeighbors(from.q, from.r).some((n) => hexKey(n.q, n.r) === toKey);
  if (!adj) return { ok: false, reason: 'not-adjacent' };

  const atk = Math.min(Math.max(1, amount | 0), from.troops);
  const def = to.troops;
  const moveStam = from.stamina - 1;
  from.troops -= atk;
  if (from.troops <= 0) from.stamina = 0;

  if (!to.ownerId && def <= 0) {
    to.ownerId = civId;
    to.troops = atk;
    to.stamina = moveStam;
    to.buildingId = null;
    to.hasWalls = false;
    to.isCapital = false;
    pushLog(match, `${civ.name} claimed (${to.q},${to.r}) with ${atk}.`);
    checkConquest(match);
    return { ok: true, claimed: true };
  }

  const defMul = to.hasWalls ? COMBAT.wallsDefenseMul : 1;
  const result = resolveCombat(atk, def, match.rng, defMul);
  if (result.attackerWins) {
    const loser = to.ownerId ? civById(match, to.ownerId) : null;
    if (to.isCapital && loser) {
      loser.alive = false;
      for (const t of match.tiles.values()) {
        if (t.ownerId === loser.id && t !== to) {
          t.ownerId = null;
          t.buildingId = null;
          t.hasWalls = false;
          t.isCapital = false;
          t.troops = 0;
          t.stamina = 0;
        }
      }
      to.ownerId = civId;
      to.troops = result.atkLeft;
      to.stamina = result.atkLeft > 0 ? moveStam : 0;
      to.buildingId = null;
      to.hasWalls = false;
      to.isCapital = false;
      pushLog(match, `${civ.name} sacked ${loser.name}'s capital!`);
    } else {
      to.ownerId = civId;
      to.troops = result.atkLeft;
      to.stamina = result.atkLeft > 0 ? moveStam : 0;
      to.buildingId = null;
      to.hasWalls = false;
      to.isCapital = false;
      pushLog(
        match,
        `${civ.name} took (${to.q},${to.r}) with ${atk} (${Math.round(result.winChance * 100)}%).`
      );
    }
  } else {
    to.troops = result.defLeft;
    if (result.atkLeft > 0) {
      from.troops += result.atkLeft;
      from.stamina = Math.min(from.stamina || moveStam, moveStam);
    }
    pushLog(
      match,
      `${civ.name} failed at (${to.q},${to.r}) (${Math.round(result.winChance * 100)}%).`
    );
  }

  checkConquest(match);
  return { ok: true, ...result };
}

/** Passable for peaceful march: own land or empty hexes. */
function isPassable(tile, civId) {
  return !!tile && (tile.ownerId === civId || tile.ownerId === null);
}

/**
 * BFS reachable destinations within stamina.
 * @returns {Map<string, number>} key → stamina cost (path length)
 */
export function reachableMoves(match, fromKey, civId) {
  const from = match.tiles.get(fromKey);
  /** @type {Map<string, number>} */
  const dist = new Map();
  if (!from || from.ownerId !== civId || from.stamina <= 0) return dist;

  const max = from.stamina;
  const queue = [fromKey];
  dist.set(fromKey, 0);
  while (queue.length) {
    const key = queue.shift();
    const d = dist.get(key);
    if (d >= max) continue;
    const tile = match.tiles.get(key);
    for (const n of hexNeighbors(tile.q, tile.r)) {
      const nk = hexKey(n.q, n.r);
      if (dist.has(nk)) continue;
      const nt = match.tiles.get(nk);
      if (!isPassable(nt, civId)) continue;
      dist.set(nk, d + 1);
      queue.push(nk);
    }
  }
  dist.delete(fromKey); // destination only — not the origin
  return dist;
}

/** Adjacent enemy hexes you can attack from here (costs 1 stamina). */
export function adjacentAttackTargets(match, fromKey, civId) {
  const from = match.tiles.get(fromKey);
  const keys = [];
  if (!from || from.ownerId !== civId || from.stamina <= 0) return keys;
  for (const n of hexNeighbors(from.q, from.r)) {
    const nk = hexKey(n.q, n.r);
    const nt = match.tiles.get(nk);
    if (nt && nt.ownerId && nt.ownerId !== civId) keys.push(nk);
  }
  return keys;
}

/**
 * March `amount` troops along a path to toKey (own or empty), spending
 * path-length stamina. Joins if destination is already yours.
 */
export function tryMarch(match, civId, fromKey, toKey, amount) {
  if (match.phase !== 'play') return { ok: false, reason: 'ended' };
  const from = match.tiles.get(fromKey);
  const to = match.tiles.get(toKey);
  if (!from || !to || from.ownerId !== civId) return { ok: false, reason: 'bad' };
  if (from.stamina <= 0) return { ok: false, reason: 'no-stamina' };
  if (!isPassable(to, civId)) return { ok: false, reason: 'blocked' };
  if (fromKey === toKey) return { ok: false, reason: 'same' };

  const reach = reachableMoves(match, fromKey, civId);
  const cost = reach.get(toKey);
  if (cost == null || cost > from.stamina) return { ok: false, reason: 'out-of-range' };

  const n = Math.min(Math.max(1, amount | 0), from.troops);
  if (n <= 0) return { ok: false, reason: 'no-troops' };

  const moveStam = from.stamina - cost;
  from.troops -= n;
  if (from.troops <= 0) from.stamina = 0;

  // Claiming empty land along the way isn't done — only the destination stack moves.
  if (to.ownerId === null) {
    to.ownerId = civId;
    to.troops = n;
    to.stamina = moveStam;
    to.isCapital = false;
    pushLog(match, `${civById(match, civId).name} marched ${n} to (${to.q},${to.r}) (−${cost} stam).`);
    checkConquest(match);
    return { ok: true, moved: n, cost, claimed: true };
  }

  if (to.troops > 0) to.stamina = Math.min(to.stamina, moveStam);
  else to.stamina = moveStam;
  to.troops += n;
  pushLog(match, `${civById(match, civId).name} marched ${n} to (${to.q},${to.r}) (−${cost} stam).`);
  return { ok: true, moved: n, cost, joined: true };
}

/** Adjacent move helper (AI); prefers tryMarch for multi-hex. */
export function tryMove(match, civId, fromKey, toKey, amount) {
  return tryMarch(match, civId, fromKey, toKey, amount);
}

/**
 * Preview an action for tooltips.
 * @param {'gather'|'recruit'|'wonder'|'walls'|'end'} action
 */
export function actionPreview(match, civId, tileKey, action) {
  const civ = civById(match, civId);
  const tile = match.tiles.get(tileKey);
  const base = { ok: false, title: '', effect: '', cost: '', need: '', blockers: [] };

  if (action === 'end') {
    return {
      ok: true,
      title: 'End turn',
      effect:
        'Collect yields, roll events, rivals act. Your armies restore 3 stamina next turn.',
      cost: 'Free',
      need: '',
      blockers: [],
    };
  }

  if (!civ || !tile) {
    return { ...base, title: 'Action', blockers: ['Select a hex first.'] };
  }

  if (action === 'recruit') {
    const cost = TROOP_COST;
    const missing = missingCost(civ.stock, cost);
    const blockers = [];
    if (tile.ownerId !== civId) blockers.push('Must own this hex.');
    if (missing.length) blockers.push(`Need ${missing.join(', ')}.`);
    return {
      ok: blockers.length === 0,
      title: 'Recruit',
      effect: `Raise ${TROOPS_PER_RECRUIT} troops on this hex.`,
      cost: formatCost(cost),
      need: missing.length ? `Missing: ${missing.join(', ')}` : '',
      blockers,
    };
  }

  if (action === 'gather') {
    const bid = GATHER_FOR_RESOURCE[tile.resourceId];
    if (!bid) {
      return {
        ok: false,
        title: 'Build gather',
        effect: 'Barren land has no gather building.',
        cost: '—',
        need: '',
        blockers: ['This hex has no resource to gather.'],
      };
    }
    const def = BUILDINGS[bid];
    const missing = missingCost(civ.stock, def.cost);
    const blockers = [];
    if (tile.ownerId !== civId) blockers.push('Must own this hex.');
    if (tile.isCapital) blockers.push('Capital already gathers without a building.');
    if (tile.buildingId) blockers.push('This hex already has a building.');
    if (missing.length) blockers.push(`Need ${missing.join(', ')}.`);
    const res = RESOURCES[tile.resourceId];
    return {
      ok: blockers.length === 0,
      title: `Build ${def.name}`,
      effect: `${def.effect} (+${res.yieldPerTurn} ${res.name}/turn).`,
      cost: formatCost(def.cost),
      need: missing.length ? `Missing: ${missing.join(', ')}` : '',
      blockers,
    };
  }

  if (action === 'walls') {
    const def = BUILDINGS.walls;
    const missing = missingCost(civ.stock, def.cost);
    const blockers = [];
    if (tile.ownerId !== civId) blockers.push('Must own this hex.');
    if (tile.hasWalls) blockers.push('Walls already stand here.');
    if (missing.length) blockers.push(`Need ${missing.join(', ')}.`);
    return {
      ok: blockers.length === 0,
      title: def.name,
      effect: def.effect,
      cost: formatCost(def.cost),
      need: missing.length ? `Missing: ${missing.join(', ')}` : '',
      blockers,
    };
  }

  if (action === 'wonder') {
    const def = BUILDINGS.wonder;
    const missing = missingCost(civ.stock, def.cost);
    const blockers = [];
    if (tile.ownerId !== civId) blockers.push('Must own this hex.');
    if (!tile.isCapital) blockers.push('Wonder must be built on your capital.');
    if (missing.length) blockers.push(`Need ${missing.join(', ')}.`);
    return {
      ok: blockers.length === 0,
      title: def.name,
      effect: def.effect,
      cost: formatCost(def.cost),
      need: missing.length ? `Missing: ${missing.join(', ')}` : '',
      blockers,
    };
  }

  return base;
}

/**
 * End player turn: collect for player, events, then each AI acts + collects.
 * Player may spend freely all turn; this is the only phase gate.
 */
export function endTurn(match) {
  if (match.phase !== 'play') return;

  const player = match.civs.find((c) => c.isPlayer);
  if (player?.alive) {
    collectYields(match, player);
    applyEvent(match, player);
    tickModifiers(player);
    if (checkWonder(match, player)) return;
  }
  if (checkConquest(match)) return;

  const aiApi = { tryBuild, tryRecruit, tryAttack, tryMove };
  for (const civ of match.civs) {
    if (civ.isPlayer || !civ.alive) continue;
    refreshStamina(match, civ.id);
    aiTakeTurn(match, civ, aiApi);
    if (match.phase !== 'play') return;
    collectYields(match, civ);
    applyEvent(match, civ);
    tickModifiers(civ);
    if (checkWonder(match, civ)) return;
    if (checkConquest(match)) return;
  }

  match.turn += 1;
  if (player?.alive) refreshStamina(match, player.id);
  if (checkTimed(match)) return;
}

export function gatherBuildingForTile(tile) {
  return GATHER_FOR_RESOURCE[tile.resourceId] || null;
}

export function tileSummary(match, key) {
  const tile = match.tiles.get(key);
  if (!tile) return null;
  const res = RESOURCES[tile.resourceId];
  const owner = tile.ownerId ? civById(match, tile.ownerId) : null;
  return {
    key,
    q: tile.q,
    r: tile.r,
    resource: res,
    owner,
    buildingId: tile.buildingId,
    hasWalls: !!tile.hasWalls,
    isCapital: tile.isCapital,
    troops: tile.troops,
    stamina: tile.stamina || 0,
    staminaMax: TROOP_STAMINA_MAX,
    regionId: tile.regionId,
    gatherBuilding: gatherBuildingForTile(tile),
  };
}

export {
  parseKey,
  hexKey,
  hexNeighbors,
  BUILDINGS,
  RESOURCES,
  TROOP_COST,
  TROOPS_PER_RECRUIT,
  TROOP_STAMINA_MAX,
};
