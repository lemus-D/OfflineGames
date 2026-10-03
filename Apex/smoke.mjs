#!/usr/bin/env node
/* Headless smoke: climb, collect, no Math.random in sim modules. */
import { readFileSync } from 'node:fs';
import { PlaySession } from './src/game/play.js';
import { ROCKET } from './src/game/content.js';

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
  'src/game/play.js',
  'src/game/content.js',
  'src/game/draw.js',
  'src/core/rng.js',
]) {
  const src = readFileSync(new URL(file, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert(!/\bMath\.random\s*\(/.test(src), `${file} has no Math.random()`);
}

// Idle death: no steering, eventually out of fuel (meteors may hurry it along).
{
  const s = new PlaySession(7);
  let steps = 0;
  while (s.player.alive && steps < 60 * 30) {
    s.step(1 / 60, 0);
    steps += 1;
  }
  assert(!s.player.alive, 'idle run ends');
  assert(s.player.fuel === 0, 'idle death empties fuel');
  assert(s.player.y > 200, `idle climb gained altitude (y=${s.player.y.toFixed(0)})`);
}

for (const seed of [1, 42, 99, 12345, 777777]) {
  const s = new PlaySession(seed);

  assert(s.pickups.length > 0, `seed ${seed}: initial bands spawned`);
  assert(s.player.fuel === ROCKET.startFuel, `seed ${seed}: full tanks`);

  const startY = s.player.y;
  for (let i = 0; i < 60 * 2; i++) s.step(1 / 60, 0);
  assert(s.player.y > startY + 100, `seed ${seed}: climbed (y=${s.player.y.toFixed(0)})`);

  // Steer hard left then right.
  for (let i = 0; i < 60; i++) s.step(1 / 60, -1);
  const leftX = s.player.x;
  for (let i = 0; i < 120; i++) s.step(1 / 60, 1);
  assert(s.player.x > leftX, `seed ${seed}: steering moves rocket`);

  // Chase fuel/coins for up to 20s — expect some collection or survival progress.
  let steps = 0;
  const coinsBefore = s.coins;
  const scoreBefore = s.pickupScore;
  while (s.player.alive && steps < 60 * 20) {
    let target = null;
    let best = Infinity;
    for (const u of s.pickups) {
      if (u.kind === 'meteor') continue;
      if (u.y < s.player.y - 20) continue;
      const d = Math.hypot(u.x - s.player.x, u.y - s.player.y);
      const score = d + (u.kind === 'fuel' ? 0 : 40);
      if (score < best) {
        best = score;
        target = u;
      }
    }
    let steer = 0;
    if (target) {
      const dx = target.x - s.player.x;
      if (dx < -8) steer = -1;
      else if (dx > 8) steer = 1;
    }
    s.step(1 / 60, steer);
    steps += 1;
  }

  assert(s.player.y > 500, `seed ${seed}: meaningful altitude`);
  assert(
    s.coins > coinsBefore || s.pickupScore > scoreBefore || s.player.alive,
    `seed ${seed}: collected or still flying`
  );
  console.log(
    `ok: seed ${seed}: coins=${s.coins} pickupScore=${s.pickupScore} alt=${Math.floor(s.player.y)}`
  );
}

// Determinism: same seed → same death altitude.
const a = new PlaySession(999);
const b = new PlaySession(999);
while (a.player.alive) a.step(1 / 60, 0);
while (b.player.alive) b.step(1 / 60, 0);
assert(
  Math.abs(a.player.y - b.player.y) < 0.001 && a.score === b.score,
  'same seed, idle steer: identical outcome'
);

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('\nAll smoke checks passed.');
