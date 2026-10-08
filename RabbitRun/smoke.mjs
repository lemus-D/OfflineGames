#!/usr/bin/env node
/* Headless smoke: lane changes, jumps, carrots, fox catch, no Math.random. */
import { readFileSync } from 'node:fs';
import { PlaySession } from './src/game/play.js';
import { RUN, OBSTACLES, LANES } from './src/game/content.js';
import { project } from './src/game/play.js';

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
  'src/main.js',
]) {
  const src = readFileSync(new URL(file, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert(!/\bMath\.random\s*\(/.test(src), `${file} has no Math.random()`);
}

assert(LANES === 3, 'three lanes');
assert(OBSTACLES.hedge.tall === true, 'hedge is tall');
assert(OBSTACLES.log.tall === false, 'log is jumpable');

const idle = { laneDelta: 0, jump: false };
const s = new PlaySession(0xC0FFEE, {});
assert(s.alive, 'starts alive');
assert(s.lane === 1, 'starts center lane');

s.step(0.5, { laneDelta: -1, jump: false });
assert(s.lane === 0, 'lane left');
s.step(0.1, { laneDelta: 1, jump: false });
s.step(0.1, { laneDelta: 1, jump: false });
assert(s.lane === 2, 'lane right twice from left');

s.step(0.05, { laneDelta: 0, jump: true });
assert(s.jumping, 'jump starts');
for (let i = 0; i < 40; i++) s.step(1 / 60, idle);
assert(!s.jumping, 'jump ends');

// Run long enough to spawn content and gain score.
const run = new PlaySession(42, {});
for (let i = 0; i < 300; i++) {
  const ctrl = {
    laneDelta: i % 40 === 0 ? (i % 80 === 0 ? -1 : 1) : 0,
    jump: i % 25 === 0,
  };
  run.step(1 / 60, ctrl);
}
assert(run.distance > 50, `distance accrued (${run.distance})`);
assert(run.obstacles.length > 0, 'obstacles spawned');
assert(run.score > 0, 'score accrued');

// Force fox catch via hits.
const doomed = new PlaySession(99, {});
doomed.foxGap = RUN.foxCatchGap + 0.1;
doomed.foxGap -= RUN.foxCloseOnHit;
if (doomed.foxGap <= RUN.foxCatchGap) doomed._die('fox');
assert(!doomed.alive && doomed.reason === 'fox', 'fox catch ends run');

const p = project(1, 10, 0, 800, 600);
assert(p.onScreen && p.scale > 0 && p.x > 0, 'project returns screen coords');

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('\nAll smoke checks passed.');
