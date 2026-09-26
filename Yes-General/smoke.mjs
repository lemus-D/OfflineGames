#!/usr/bin/env node
/* Headless smoke: map + turns + combat determinism, no Math.random in sim. */
import { readFileSync } from 'node:fs';
import { createMatch, endTurn, tryRecruit, tryAttack, scoreCiv } from './src/game/match.js';
import { resolveCombat } from './src/game/combat.js';
import { makeRNG } from './src/core/rng.js';
import { hexKey, hexNeighbors } from './src/game/hex.js';

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
  'src/game/roads.js',
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
}

// Combat odds are deterministic for a seed.
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

  const player = m.civs[0];
  const capKey = hexKey(player.capital.q, player.capital.r);
  tryRecruit(m, 'player', capKey);
  assert(
    m.tiles.get(capKey).troops > 12,
    `seed ${seed}: recruit increases troops`
  );

  // Advance several turns — should stay in play or end cleanly.
  for (let i = 0; i < 8; i++) {
    if (m.phase !== 'play') break;
    endTurn(m);
  }
  assert(m.turn >= 2 || m.phase === 'ended', `seed ${seed}: turns advanced`);
  assert(scoreCiv(m, player) >= 0, `seed ${seed}: score non-negative`);

  // If still playing, try one attack into a neighbor if possible.
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
