#!/usr/bin/env node
/* Headless smoke: thrust climb, collect, no Math.random in sim modules. */
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

const idle = { steer: 0, thrust: false };
const boost = { steer: 0, thrust: true };

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

// No thrust: stay on the pad, fuel untouched.
{
  const s = new PlaySession(7);
  for (let i = 0; i < 60 * 2; i++) s.step(1 / 60, idle);
  assert(s.player.alive, 'idle on pad stays alive');
  assert(s.player.y <= ROCKET.startY + 1, 'idle does not auto-climb');
  assert(s.player.fuel === ROCKET.startFuel, 'idle does not burn fuel');
}

// Thrust climbs and burns; release falls and can crash.
{
  const s = new PlaySession(11);
  for (let i = 0; i < 60 * 2; i++) s.step(1 / 60, boost);
  assert(s.player.y > 100, `boost climbs (y=${s.player.y.toFixed(0)})`);
  assert(s.player.fuel < ROCKET.startFuel, 'boost burns fuel');
  assert(s.player.thrusting, 'thrusting flag set while holding boost');

  // Coast — should start falling.
  for (let i = 0; i < 60; i++) s.step(1 / 60, idle);
  assert(s.player.vy < 0, 'release boost → falling');

  // Keep falling until crash or timeout.
  let steps = 0;
  while (s.player.alive && steps < 60 * 20) {
    s.step(1 / 60, idle);
    steps += 1;
  }
  assert(!s.player.alive, 'fall ends in crash');
  assert(s.player.deathReason === 'crash' || s.player.deathReason === 'fuel', 'crash/fuel death');
}

for (const seed of [1, 42, 99, 12345, 777777]) {
  const s = new PlaySession(seed);

  assert(s.pickups.length > 0, `seed ${seed}: initial bands spawned`);
  assert(s.player.fuel === ROCKET.startFuel, `seed ${seed}: full tanks`);

  // Boost while tilting left, then right — angled thrust should move X.
  for (let i = 0; i < 60; i++) s.step(1 / 60, { steer: -1, thrust: true });
  assert(s.player.tilt < -0.2, `seed ${seed}: tilts left`);
  const leftX = s.player.x;
  for (let i = 0; i < 120; i++) s.step(1 / 60, { steer: 1, thrust: true });
  assert(s.player.tilt > 0.2, `seed ${seed}: tilts right`);
  assert(s.player.x > leftX, `seed ${seed}: angled thrust moves rocket`);
  assert(s.player.peakY > 80, `seed ${seed}: gained altitude`);

  // Chase fuel/coins with boost for up to 15s.
  let steps = 0;
  const coinsBefore = s.coins;
  const scoreBefore = s.pickupScore;
  while (s.player.alive && steps < 60 * 15) {
    let target = null;
    let best = Infinity;
    for (const u of s.pickups) {
      if (u.kind === 'meteor') continue;
      if (u.y < s.player.y - 40) continue;
      const d = Math.hypot(u.x - s.player.x, u.y - s.player.y);
      const score = d + (u.kind === 'fuel' ? 0 : 40);
      if (score < best) {
        best = score;
        target = u;
      }
    }
    let steer = 0;
    let thrust = true;
    if (target) {
      const dx = target.x - s.player.x;
      const dy = target.y - s.player.y;
      if (dx < -8) steer = -1;
      else if (dx > 8) steer = 1;
      // Coast a bit if target is below.
      if (dy < -30 && s.player.vy > 40) thrust = false;
    }
    if (s.player.fuel < 0.08) thrust = false;
    s.step(1 / 60, { steer, thrust });
    steps += 1;
  }

  assert(s.player.peakY > 200, `seed ${seed}: meaningful altitude`);
  assert(
    s.coins > coinsBefore || s.pickupScore > scoreBefore || s.player.peakY > 400,
    `seed ${seed}: collected or climbed`
  );
  console.log(
    `ok: seed ${seed}: coins=${s.coins} pickupScore=${s.pickupScore} alt=${Math.floor(s.player.peakY)}`
  );
}

// Determinism: same seed + same inputs → same outcome.
const a = new PlaySession(999);
const b = new PlaySession(999);
for (let i = 0; i < 60 * 3; i++) {
  a.step(1 / 60, boost);
  b.step(1 / 60, boost);
}
while (a.player.alive) a.step(1 / 60, idle);
while (b.player.alive) b.step(1 / 60, idle);
assert(
  Math.abs(a.player.peakY - b.player.peakY) < 0.001 && a.score === b.score,
  'same seed, same inputs: identical outcome'
);

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('\nAll smoke checks passed.');
