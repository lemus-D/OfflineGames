#!/usr/bin/env node
/* Headless smoke: stamina, path-claim marches, partitions, no Math.random. */
import { readFileSync } from 'node:fs';
import {
  createMatch,
  endTurn,
  tryRecruit,
  tryAttack,
  tryMarch,
  reachableMoves,
  moveTargets,
  scoreCiv,
} from './src/game/match.js';
import { resolveCombat } from './src/game/combat.js';
import { makeRNG } from './src/core/rng.js';
import { hexKey, hexNeighbors, hexDistance } from './src/game/hex.js';
import { START_CLAIM_RADIUS, TROOP_STAMINA_MAX } from './src/data/content.js';

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failures += 1;
  } else {
    console.log('ok:', msg);
  }
}

for (const file of [
  'src/game/match.js',
  'src/game/hex.js',
  'src/game/combat.js',
  'src/game/ai.js',
  'src/game/render.js',
  'src/data/content.js',
  'src/core/rng.js',
]) {
  const src = readFileSync(new URL(file, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert(!/\bMath\.random\s*\(/.test(src), `${file} has no Math.random()`);
  assert(!/\bhasRoad\b/.test(src), `${file} has no road remnants`);
}

{
  const r1 = makeRNG(99);
  const r2 = makeRNG(99);
  const a = resolveCombat(20, 10, r1);
  const b = resolveCombat(20, 10, r2);
  assert(a.attackerWins === b.attackerWins && a.roll === b.roll, 'combat deterministic for seed');
  assert(a.winChance > 0.5, 'larger force has higher win chance');
  const walled = resolveCombat(20, 10, makeRNG(1), 1.5);
  const plain = resolveCombat(20, 10, makeRNG(1), 1);
  assert(walled.winChance < plain.winChance, 'walls lower attacker win chance');
}

{
  // Path claim: march 2+ steps → every hex on the shortest path is owned after.
  const m = createMatch('short', 'easy', 42);
  const player = m.civs[0];
  const capKey = hexKey(player.capital.q, player.capital.r);
  const reach = reachableMoves(m, capKey, 'player');
  const far = [...reach.entries()].find(([, cost]) => cost >= 2);
  assert(far, 'path-claim fixture: has a 2+ step destination');
  const [dest, cost] = far;
  const send = Math.max(1, Math.floor(m.tiles.get(capKey).troops / 2));
  const res = tryMarch(m, 'player', capKey, dest, send);
  assert(res.ok && res.path?.length === cost + 1, 'path-claim: path length matches cost');
  for (let i = 1; i < res.path.length; i++) {
    assert(m.tiles.get(res.path[i]).ownerId === 'player', `path-claim: hex ${res.path[i]} owned`);
  }
  assert(m.tiles.get(dest).troops >= send, 'path-claim: troops at destination');
  assert(typeof res.claimed === 'number', 'path-claim: claimed count reported');
}

{
  const m = createMatch('short', 'easy', 1);
  const player = m.civs[0];
  const capKey = hexKey(player.capital.q, player.capital.r);
  const { moves, attacks } = moveTargets(m, capKey, 'player');
  assert(moves.size > 0, 'moveTargets: peaceful moves');
  assert(Array.isArray(attacks), 'moveTargets: attacks array');
}

for (const seed of [1, 42, 99, 12345, 777777]) {
  const m = createMatch('short', 'easy', seed);
  assert(m.tiles.size > 20, `seed ${seed}: map has tiles (${m.tiles.size})`);
  assert(m.civs.length === 2, `seed ${seed}: player + 1 AI`);

  const player = m.civs[0];
  const capKey = hexKey(player.capital.q, player.capital.r);
  const cap = m.tiles.get(capKey);
  assert(cap.stamina === TROOP_STAMINA_MAX, `seed ${seed}: starting stamina full`);

  let claimed = 0;
  for (const t of m.tiles.values()) {
    if (t.ownerId === 'player') {
      claimed += 1;
      assert(
        hexDistance(t, player.capital) <= START_CLAIM_RADIUS,
        `seed ${seed}: claim radius`
      );
    }
  }
  assert(claimed >= 3, `seed ${seed}: start blob (${claimed})`);

  const reach = reachableMoves(m, capKey, 'player');
  assert(reach.size > 0, `seed ${seed}: has reachable move tiles (${reach.size})`);
  const dest = [...reach.keys()][0];
  const cost = reach.get(dest);
  const before = cap.troops;
  const send = Math.max(1, Math.floor(before / 2));
  const res = tryMarch(m, 'player', capKey, dest, send);
  assert(res.ok, `seed ${seed}: march ok`);
  assert(cap.troops === before - send, `seed ${seed}: split left remainder`);
  assert(m.tiles.get(dest).troops >= send, `seed ${seed}: marched arrived`);
  assert(
    m.tiles.get(dest).stamina === TROOP_STAMINA_MAX - cost,
    `seed ${seed}: stamina spent by path cost`
  );
  if (res.path) {
    for (let i = 1; i < res.path.length; i++) {
      assert(
        m.tiles.get(res.path[i]).ownerId === 'player',
        `seed ${seed}: path hex claimed`
      );
    }
  }

  tryRecruit(m, 'player', capKey);
  assert(m.tiles.get(capKey).troops > 0, `seed ${seed}: recruit works`);

  for (let i = 0; i < 6; i++) {
    if (m.phase !== 'play') break;
    endTurn(m);
  }
  assert(m.turn >= 2 || m.phase === 'ended', `seed ${seed}: turns advanced`);
  if (m.phase === 'play') {
    const after = m.tiles.get(capKey);
    if (after.troops > 0) {
      assert(after.stamina === TROOP_STAMINA_MAX, `seed ${seed}: stamina refreshed after turns`);
    }
  }

  assert(scoreCiv(m, player) >= 0, `seed ${seed}: score non-negative`);
  assert(
    hexDistance(player.capital, m.civs[1].capital) >= 3,
    `seed ${seed}: capitals separated`
  );

  if (m.phase === 'play') {
    const from = m.tiles.get(capKey);
    const neigh = hexNeighbors(from.q, from.r)
      .map((n) => hexKey(n.q, n.r))
      .find((k) => m.tiles.has(k) && m.tiles.get(k).ownerId !== 'player');
    if (neigh && from.troops > 2 && from.stamina > 0) {
      const send = Math.floor(from.troops / 2);
      const leftBefore = from.troops;
      tryAttack(m, 'player', capKey, neigh, send);
      assert(
        m.tiles.get(capKey).troops < leftBefore || m.tiles.get(neigh).ownerId === 'player',
        `seed ${seed}: partial attack resolved`
      );
    }
  }
}

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('\nAll smoke checks passed.');
