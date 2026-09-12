#!/usr/bin/env node
/* Headless smoke: survive grace, eat toward a draft, never Math.random in play. */
import { readFileSync } from 'node:fs';
import { PlaySession } from './src/game/play.js';
import { GROWTH_MILESTONES } from './src/game/content.js';

function aimToward(session, tx, ty) {
  const dx = tx - session.player.x;
  const dy = ty - session.player.y;
  return { ax: dx, ay: dy, mag: Math.hypot(dx, dy), boost: false };
}

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failures += 1;
  } else {
    console.log('ok:', msg);
  }
}

// D9: no Math.random in simulation modules.
for (const file of [
  'src/game/play.js',
  'src/game/content.js',
  'src/game/creature.js',
  'src/game/world.js',
  'src/core/rng.js',
]) {
  const src = readFileSync(new URL(file, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert(!/\bMath\.random\s*\(/.test(src), `${file} has no Math.random()`);
}

for (const seed of [1, 42, 99, 12345, 777777]) {
  const s = new PlaySession('reef-shark', seed);
  assert(
    s.creatures.every((c) => c.kind === 'prey'),
    `seed ${seed}: initial school is prey-only`
  );

  // Idle through grace — must stay alive.
  for (let i = 0; i < 60 * 5; i++) {
    s.step(1 / 60, { ax: 0, ay: 0, mag: 0, boost: false });
  }
  assert(s.player.alive, `seed ${seed}: alive after 5s idle`);
  assert(s.time >= 4.5, `seed ${seed}: sim time advanced`);

  // Chase nearest prey for up to 40s or until draft.
  let steps = 0;
  while (s.player.alive && !s.draft && steps < 60 * 40) {
    const prey = s.creatures
      .filter((c) => c.mass <= s.player.mass * s.stats.biteRatio)
      .sort(
        (a, b) =>
          Math.hypot(a.x - s.player.x, a.y - s.player.y) -
          Math.hypot(b.x - s.player.x, b.y - s.player.y)
      )[0];
    if (prey) s.step(1 / 60, aimToward(s, prey.x, prey.y));
    else s.step(1 / 60, { ax: 1, ay: 0, mag: 180, boost: false });
    steps += 1;
  }

  assert(s.eaten > 0, `seed ${seed}: ate at least one prey (eaten=${s.eaten})`);
  assert(s.player.mass > 1, `seed ${seed}: grew (mass=${s.player.mass.toFixed(2)})`);

  if (s.draft) {
    const pick = s.draft.picks[0];
    s.chooseUpgrade(pick.id);
    assert(!s.draft, `seed ${seed}: draft resolved`);
    assert(s.upgrades.includes(pick.id), `seed ${seed}: upgrade applied`);
  } else {
    // Not every seed must hit a milestone in 40s, but mass should approach one.
    assert(
      s.player.mass >= GROWTH_MILESTONES[0] * 0.85 || s.eaten >= 4,
      `seed ${seed}: meaningful progress without draft`
    );
  }
}

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('\nAll smoke checks passed.');
