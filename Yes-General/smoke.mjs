#!/usr/bin/env node
/* Headless smoke: stamina, split moves, partitions, no Math.random. */
import { readFileSync } from 'node:fs';
import {
  createMatch,
  endTurn,
  tryRecruit,
  tryAttack,
  tryMove,
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

for (const seed of [1, 42, 99, 12345, 777777]) {
  const m = createMatch('short', 'easy', seed);
  assert(m.tiles.size > 20, `seed ${seed}: map has tiles (${m.tiles.size})`);
  assert(m.civs.length === 2, `seed ${seed}: player + 1 AI`);

  const player = m.civs[0];
  const capKey = hexKey(player.capital.q, player.capital.r);
  const cap = m.tiles.get(capKey);
  assert(cap.stamina === TROOP_STAMINA_MAX, `seed ${seed}: starting stamina full`);

  // Split-move onto an owned neighbor if any.
  const ownNeigh = hexNeighbors(cap.q, cap.r)
    .map((n) => hexKey(n.q, n.r))
    .find((k) => m.tiles.get(k)?.ownerId === 'player');
  if (ownNeigh) {
    const before = cap.troops;
    const send = Math.max(1, Math.floor(before / 2));
    const res = tryMove(m, 'player', capKey, ownNeigh, send);
    assert(res.ok, `seed ${seed}: split move ok`);
    assert(cap.troops === before - send, `seed ${seed}: split left remainder`);
    assert(m.tiles.get(ownNeigh).troops >= send, `seed ${seed}: join/split arrived`);
    assert(m.tiles.get(ownNeigh).stamina === TROOP_STAMINA_MAX - 1, `seed ${seed}: stamina spent`);
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
