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
  RESOURCE_SCORE,
  PLAYER_COLORS,
} from '../data/content.js';
import { generateMap, placeCapitals, hexKey, hexNeighbors, parseKey } from './hex.js';
import { connectedToCapital } from './roads.js';
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
  const capitalKeys = placeCapitals(tiles, civCount, rng);

  /** @type {object[]} */
  const civs = [];
  for (let i = 0; i < civCount; i++) {
    const id = i === 0 ? 'player' : `ai-${i}`;
    const capKey = capitalKeys[i];
    const cap = tiles.get(capKey);
    cap.ownerId = id;
    cap.isCapital = true;
    cap.hasRoad = true;
    cap.troops = STARTING_TROOPS;
    // Capital starts gathering food without a farm (hub).
    if (cap.resourceId === 'barren') cap.resourceId = 'food';

    civs.push({
      id,
      name: i === 0 ? 'You' : `Rival ${i}`,
      isPlayer: i === 0,
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      capital: { q: cap.q, r: cap.r },
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
    phase: 'play', // play | ended
    winnerId: null,
    winReason: null,
    log: [],
    selectedKey: capitalKeys[0],
    rng,
    lastEvent: null,
  };
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

function pushLog(match, msg) {
  match.log.unshift(msg);
  if (match.log.length > 40) match.log.length = 40;
}

export function collectYields(match, civ) {
  if (!civ.alive) return;
  const connected = connectedToCapital(match.tiles, civ.id, civ.capital);
  const mul = civ.yieldMul;
  for (const [key, tile] of match.tiles) {
    if (tile.ownerId !== civ.id) continue;
    const res = RESOURCES[tile.resourceId];
    if (!res || res.yieldPerTurn <= 0) continue;
    const need = GATHER_FOR_RESOURCE[tile.resourceId];
    const hasGather = tile.isCapital || (need && tile.buildingId === need);
    if (!hasGather) continue;
    if (!tile.isCapital && !connected.has(key)) continue;
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
      if (t.hasRoad && !t.isCapital && match.rng() < ev.roadBreakChance) {
        t.hasRoad = false;
      }
    }
    // Risk losing a non-capital border tile.
    if (match.rng() < ev.territoryRisk) {
      const candidates = owned.filter((t) => !t.isCapital);
      if (candidates.length) {
        const t = candidates[(match.rng() * candidates.length) | 0];
        t.ownerId = null;
        t.buildingId = null;
        t.hasRoad = false;
        t.troops = 0;
        pushLog(match, `${ev.name}: lost territory at (${t.q},${t.r}).`);
      }
    }
    pushLog(match, `${ev.name}: lost ${lostTroops} troops.`);
  } else if (ev.kind === 'roads') {
    let broken = 0;
    for (const t of match.tiles.values()) {
      if (t.ownerId !== civ.id || t.isCapital || !t.hasRoad) continue;
      if (match.rng() < ev.roadBreakChance) {
        t.hasRoad = false;
        broken += 1;
      }
    }
    pushLog(match, `${ev.name}: ${broken} road(s) destroyed.`);
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

  // Whole map owned by a single civ (no neutrals).
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

/** Build gather / road / wonder on selected owned hex. */
export function tryBuild(match, civId, tileKey, buildingId) {
  if (match.phase !== 'play') return { ok: false, reason: 'ended' };
  const civ = civById(match, civId);
  const tile = match.tiles.get(tileKey);
  const def = BUILDINGS[buildingId];
  if (!civ?.alive || !tile || !def) return { ok: false, reason: 'bad' };
  if (tile.ownerId !== civId) return { ok: false, reason: 'not-yours' };
  if (!canAfford(civ.stock, def.cost)) return { ok: false, reason: 'cost' };

  if (def.on === 'road') {
    if (tile.hasRoad || tile.isCapital) return { ok: false, reason: 'has-road' };
    pay(civ.stock, def.cost);
    tile.hasRoad = true;
    pushLog(match, `${civ.name} built a road at (${tile.q},${tile.r}).`);
    return { ok: true };
  }

  if (def.on === 'wonder') {
    if (!tile.isCapital) return { ok: false, reason: 'wonder-capital' };
    pay(civ.stock, def.cost);
    civ.wonderBuilt = true;
    tile.buildingId = 'wonder';
    pushLog(match, `${civ.name} raised the Ancient Wonder!`);
    checkWonder(match, civ);
    return { ok: true };
  }

  if (def.on === 'gather') {
    const need = GATHER_FOR_RESOURCE[tile.resourceId];
    if (need !== buildingId) return { ok: false, reason: 'wrong-building' };
    if (tile.buildingId) return { ok: false, reason: 'has-building' };
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
  tile.troops += TROOPS_PER_RECRUIT;
  return { ok: true };
}

/**
 * Attack from owned hex into adjacent enemy/neutral hex.
 * Moves all troops from fromKey into the fight.
 */
export function tryAttack(match, civId, fromKey, toKey) {
  if (match.phase !== 'play') return { ok: false, reason: 'ended' };
  const civ = civById(match, civId);
  const from = match.tiles.get(fromKey);
  const to = match.tiles.get(toKey);
  if (!civ?.alive || !from || !to) return { ok: false, reason: 'bad' };
  if (from.ownerId !== civId || from.troops <= 0) return { ok: false, reason: 'no-troops' };
  if (to.ownerId === civId) return { ok: false, reason: 'own' };

  const adj = hexNeighbors(from.q, from.r).some(
    (n) => hexKey(n.q, n.r) === toKey
  );
  if (!adj) return { ok: false, reason: 'not-adjacent' };

  const atk = from.troops;
  const def = to.troops;
  from.troops = 0;

  // Neutral empty: just take it.
  if (!to.ownerId && def <= 0) {
    to.ownerId = civId;
    to.troops = atk;
    to.buildingId = null;
    to.hasRoad = false;
    to.isCapital = false;
    pushLog(match, `${civ.name} claimed (${to.q},${to.r}).`);
    checkConquest(match);
    return { ok: true, claimed: true };
  }

  const result = resolveCombat(atk, def, match.rng);
  if (result.attackerWins) {
    const loser = to.ownerId ? civById(match, to.ownerId) : null;
    if (to.isCapital && loser) {
      // Capital fall: wipe the loser's other tiles, then claim this hex.
      loser.alive = false;
      for (const t of match.tiles.values()) {
        if (t.ownerId === loser.id && t !== to) {
          t.ownerId = null;
          t.buildingId = null;
          t.hasRoad = false;
          t.isCapital = false;
          t.troops = 0;
        }
      }
      to.ownerId = civId;
      to.troops = result.atkLeft;
      to.buildingId = null;
      to.hasRoad = false;
      to.isCapital = false;
      pushLog(match, `${civ.name} sacked ${loser.name}'s capital!`);
    } else {
      to.ownerId = civId;
      to.troops = result.atkLeft;
      to.buildingId = null;
      to.hasRoad = false;
      to.isCapital = false;
      pushLog(
        match,
        `${civ.name} took (${to.q},${to.r}) (${Math.round(result.winChance * 100)}% odds).`
      );
    }
  } else {
    to.troops = result.defLeft;
    from.troops = result.atkLeft; // survivors retreat
    pushLog(
      match,
      `${civ.name} failed at (${to.q},${to.r}) (${Math.round(result.winChance * 100)}% odds).`
    );
  }

  checkConquest(match);
  return { ok: true, ...result };
}

/** Move troops between adjacent owned hexes. */
export function tryMove(match, civId, fromKey, toKey, amount) {
  if (match.phase !== 'play') return { ok: false, reason: 'ended' };
  const from = match.tiles.get(fromKey);
  const to = match.tiles.get(toKey);
  if (!from || !to || from.ownerId !== civId || to.ownerId !== civId) {
    return { ok: false, reason: 'bad' };
  }
  const adj = hexNeighbors(from.q, from.r).some((n) => hexKey(n.q, n.r) === toKey);
  if (!adj) return { ok: false, reason: 'not-adjacent' };
  const n = Math.min(amount, from.troops);
  if (n <= 0) return { ok: false, reason: 'no-troops' };
  from.troops -= n;
  to.troops += n;
  return { ok: true };
}

/**
 * End player turn: collect for player, events, then each AI acts + collects.
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

  const aiApi = { tryBuild, tryRecruit, tryAttack };
  for (const civ of match.civs) {
    if (civ.isPlayer || !civ.alive) continue;
    aiTakeTurn(match, civ, aiApi);
    if (match.phase !== 'play') return;
    collectYields(match, civ);
    applyEvent(match, civ);
    tickModifiers(civ);
    if (checkWonder(match, civ)) return;
    if (checkConquest(match)) return;
  }

  match.turn += 1;
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
  const connected =
    owner &&
    connectedToCapital(match.tiles, owner.id, owner.capital).has(key);
  return {
    key,
    q: tile.q,
    r: tile.r,
    resource: res,
    owner,
    buildingId: tile.buildingId,
    hasRoad: tile.hasRoad || tile.isCapital,
    isCapital: tile.isCapital,
    troops: tile.troops,
    connected: !!connected || tile.isCapital,
    gatherBuilding: gatherBuildingForTile(tile),
  };
}

export { parseKey, hexKey, hexNeighbors, BUILDINGS, RESOURCES, TROOP_COST, TROOPS_PER_RECRUIT };
