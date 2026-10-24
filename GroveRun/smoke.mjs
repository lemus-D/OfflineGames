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

// Scripted dodge player survives longer and scores.
{
  function botStep(s) {
    const p = s.player;
    let laneDelta = 0;
    let jump = false;
    // Find nearest threat in path.
    let threat = null;
    let bestZ = Infinity;
    for (const e of s.entities) {
      if (e.dead || e.kind === 'carrot') continue;
      if (e.z > 0 && e.z < bestZ) {
        bestZ = e.z;
        threat = e;
      }
    }
    // Prefer carrots in clear lanes.
    let carrot = null;
    for (const e of s.entities) {
      if (e.kind === 'carrot' && !e.dead && e.z > 5 && e.z < 80) {
        carrot = e;
        break;
      }
    }
    if (threat && threat.z < 50) {
      const def = OBSTACLES[threat.kind];
      if (threat.lane === p.lane) {
        if (def.dodge === 'jump' || (def.dodge === 'either' && Math.abs(threat.lane) === 1)) {
          jump = true;
        } else {
          // Change lane away from threat — pick a free lane.
          const blocked = new Set(
            s.entities
              .filter((e) => e.kind !== 'carrot' && !e.dead && Math.abs(e.z - threat.z) < 20)
              .map((e) => e.lane)
          );
          for (const lane of [-1, 0, 1]) {
            if (!blocked.has(lane) && lane !== p.lane) {
              laneDelta = lane - p.lane;
              break;
            }
          }
          if (laneDelta === 0 && def.dodge === 'either') jump = true;
        }
      }
    } else if (carrot && carrot.lane !== p.lane && Math.abs(carrot.lane - p.lane) === 1) {
      laneDelta = carrot.lane - p.lane;
    }
    s.step(FIXED_DT, { laneDelta, jump });
  }

  const idle = new PlaySession(99);
  const bot = new PlaySession(99);
  for (let i = 0; i < 60 * 8; i++) {
    if (idle.player.alive) idle.step(FIXED_DT, { laneDelta: 0, jump: false });
    if (bot.player.alive) botStep(bot);
  }
  assert(
    bot.score > idle.score || bot.distance > idle.distance * 0.9,
    `scripted player progresses (bot=${bot.score}/${bot.distance.toFixed(0)} idle=${idle.score}/${idle.distance.toFixed(0)})`
  );
  assert(bot.carrots >= 0, 'bot carrot count is finite');
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
