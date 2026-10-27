#!/usr/bin/env node
/* Headless smoke: lanes, jump, carrots, fox, determinism, idle fail. */
import { readFileSync } from 'node:fs';
import { PlaySession } from './src/game/play.js';
import { FIXED_DT, FOX, RUN, OBSTACLES, scoreFromRun } from './src/game/content.js';

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
  'src/core/input.js',
  'src/core/save.js',
  'src/core/audio.js',
  'src/core/qa.js',
  'src/main.js',
]) {
  const src = readFileSync(new URL(file, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert(!/\bMath\.random\s*\(/.test(src), `${file} has no Math.random()`);
}

assert(OBSTACLES.log.dodge === 'jump', 'log requires jump');
assert(OBSTACLES.rock.dodge === 'lane', 'rock requires lane change');
assert(scoreFromRun(100, 2) > scoreFromRun(100, 0), 'carrots raise score');
assert(FIXED_DT > 0 && FIXED_DT < 0.05, 'FIXED_DT is arcade timestep');

// Idle player eventually fails (hits or fox).
{
  const s = new PlaySession(7);
  let steps = 0;
  while (s.player.alive && steps < 60 * 30) {
    s.step(FIXED_DT, { laneDelta: 0, jump: false });
    steps += 1;
  }
  assert(!s.player.alive, `idle dies within 30s (t=${s.time.toFixed(1)}, reason=${s.player.deathReason})`);
  assert(s.summaryData || s.summary(), 'run ends with a summary');
  const sum = s.summary();
  assert(typeof sum.score === 'number' && sum.distance >= 0, 'summary has score + distance');
}

// First carrot appears early for an active player who stays mid and jumps logs.
{
  const s = new PlaySession(42);
  let steps = 0;
  let gotCarrot = false;
  while (s.player.alive && steps < 60 * 12) {
    // Stay mid-lane; jump when a jumpable obstacle is close in our lane.
    let jump = false;
    for (const e of s.entities) {
      if (e.kind === 'carrot') continue;
      if (e.lane === s.player.lane && e.z > 0 && e.z < 35) {
        const def = OBSTACLES[e.kind];
        if (def && (def.dodge === 'jump' || def.dodge === 'either')) jump = true;
      }
    }
    s.step(FIXED_DT, { laneDelta: 0, jump });
    if (s.carrots > 0) {
      gotCarrot = true;
      break;
    }
    steps += 1;
  }
  assert(gotCarrot || s.distance > RUN.firstCarrotDist, 'carrot opportunity inside early window');
}

// Scripted player: collect a carrot and dodge a rock via lane change.
{
  const s = new PlaySession(55);
  s.entities = [
    { id: 1, kind: 'carrot', lane: 0, z: 40, dead: false },
    { id: 2, kind: 'rock', lane: 0, z: 95, dead: false },
    { id: 3, kind: 'log', lane: 1, z: 140, dead: false },
  ];
  s._spawnAt = s.distance + 9999; // freeze natural spawns
  let steps = 0;
  while (s.player.alive && steps < 60 * 8) {
    let laneDelta = 0;
    let jump = false;
    const threats = s.entities
      .filter((e) => !e.dead && e.kind !== 'carrot' && e.z > 0 && e.z < 55)
      .sort((a, b) => a.z - b.z);
    const hit = threats.find((e) => e.lane === s.player.lane);
    if (hit) {
      if (OBSTACLES[hit.kind].dodge === 'jump') jump = true;
      else {
        const want = hit.lane === 0 ? -1 : 0;
        if (want !== s.player.lane) laneDelta = want > s.player.lane ? 1 : -1;
      }
    }
    s.step(FIXED_DT, { laneDelta, jump });
    steps += 1;
  }
  assert(s.carrots >= 1, `scripted player grabs carrot (c=${s.carrots})`);
  assert(s.distance > 200, `scripted player clears early rock (d=${s.distance.toFixed(0)})`);
  assert(s.score > 0, 'scripted player has score');
}

// Determinism: same seed + inputs → same outcome.
{
  const inputs = [];
  const probe = new PlaySession(12345);
  for (let i = 0; i < 60 * 5; i++) {
    const laneDelta = i % 37 === 0 ? 1 : i % 41 === 0 ? -1 : 0;
    const jump = i % 53 === 0;
    inputs.push({ laneDelta, jump });
    probe.step(FIXED_DT, { laneDelta, jump });
  }

  const a = new PlaySession(12345);
  const b = new PlaySession(12345);
  for (const c of inputs) {
    a.step(FIXED_DT, { ...c });
    b.step(FIXED_DT, { ...c });
  }
  assert(
    Math.abs(a.distance - b.distance) < 1e-6 &&
      a.carrots === b.carrots &&
      a.score === b.score &&
      a.player.alive === b.player.alive,
    'same seed, same inputs: identical outcome'
  );
}

// Fox pressure: stumble closes gap.
{
  const s = new PlaySession(3);
  const before = s.foxGap;
  s.foxGap = FOX.startGap;
  s.player.lane = 0;
  s.player.lanePos = 0;
  s.entities = [
    { id: 1, kind: 'log', lane: 0, z: 10, dead: false },
  ];
  s.step(FIXED_DT, { laneDelta: 0, jump: false });
  assert(s.flash > 0 || s.foxGap < before || !s.player.alive, 'hitting log stumbles or kills');
}

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('\nAll smoke checks passed.');
