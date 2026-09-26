#!/usr/bin/env node
/* Headless smoke: partitions, turns, combat determinism, no Math.random. */
import { readFileSync } from 'node:fs';
import { createMatch, endTurn, tryRecruit, tryAttack, scoreCiv } from './src/game/match.js';
import { resolveCombat } from './src/game/combat.js';
import { makeRNG } from './src/core/rng.js';
import { hexKey, hexNeighbors, hexDistance } from './src/game/hex.js';
import { START_CLAIM_RADIUS } from './src/data/content.js';

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
}

for (const seed of [1, 42, 99, 12345, 777777]) {
  const m = createMatch('short', 'easy', seed);
  assert(m.tiles.size > 20, `seed ${seed}: map has tiles (${m.tiles.size})`);
  assert(m.civs.length === 2, `seed ${seed}: player + 1 AI`);
  assert(
    m.civs.every((c) => m.tiles.get(hexKey(c.capital.q, c.capital.r))?.isCapital),
    `seed ${seed}: capitals placed`
  );

  // Capitals in different regions and reasonably far apart.
  const [a, b] = m.civs;
  const d = hexDistance(a.capital, b.capital);
  assert(d >= 3, `seed ${seed}: capitals separated (d=${d})`);
  assert(a.regionId !== b.regionId, `seed ${seed}: distinct regions`);

  // Starting claim ~5 tiles wide (radius 2) around capital in-region.
  let claimed = 0;
  for (const t of m.tiles.values()) {
    if (t.ownerId === 'player') {
      claimed += 1;
      assert(
        hexDistance(t, a.capital) <= START_CLAIM_RADIUS,
        `seed ${seed}: player claim within start radius`
      );
    }
  }
  assert(claimed >= 3, `seed ${seed}: player starts with a blob (${claimed} tiles)`);

  const player = m.civs[0];
  const capKey = hexKey(player.capital.q, player.capital.r);
  tryRecruit(m, 'player', capKey);
  assert(m.tiles.get(capKey).troops > 12, `seed ${seed}: recruit increases troops`);

  for (let i = 0; i < 8; i++) {
    if (m.phase !== 'play') break;
    endTurn(m);
  }
  assert(m.turn >= 2 || m.phase === 'ended', `seed ${seed}: turns advanced`);
  assert(scoreCiv(m, player) >= 0, `seed ${seed}: score non-negative`);

  if (m.phase === 'play') {
    const from = m.tiles.get(capKey);
    const neigh = hexNeighbors(from.q, from.r)
      .map((n) => hexKey(n.q, n.r))
      .find((k) => m.tiles.has(k) && m.tiles.get(k).ownerId !== 'player');
    if (neigh && from.troops > 0) {
      const before = from.troops;
      tryAttack(m, 'player', capKey, neigh);
      assert(
        m.tiles.get(capKey).troops < before || m.tiles.get(neigh).ownerId === 'player',
        `seed ${seed}: attack resolved`
      );
    }
  }
}

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('\nAll smoke checks passed.');
