#!/usr/bin/env node
/* Headless smoke: determinism, remorph, idle pressure, scripted score. */
import { readFileSync } from 'node:fs';
import { PlaySession } from './src/game/play.js';
import { MATCH, HOOP } from './src/game/content.js';

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failures += 1;
  } else {
    console.log('ok:', msg);
  }
}

function snap(s) {
  return JSON.stringify({
    t: +s.time.toFixed(4),
    hx: +s.human.x.toFixed(3),
    hy: +s.human.y.toFixed(3),
    ax: +s.ai.x.toFixed(3),
    bx: +s.ball.x.toFixed(3),
    by: +s.ball.y.toFixed(3),
    holder: s.ball.holder,
    hs: s.human.score,
    as: s.ai.score,
    phase: s.phase,
    clock: +s.shotClock.toFixed(3),
    harm: +s.human.morph.arm.toFixed(4),
    aarm: +s.ai.morph.arm.toFixed(4),
  });
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

// Determinism: identical seed + inputs → identical state (including morphs).
{
  const seed = 42;
  const a = new PlaySession(seed);
  const b = new PlaySession(seed);
  assert(snap(a) === snap(b), 'same seed → same initial morph/state');
  const script = [];
  for (let i = 0; i < 60 * 8; i++) {
    script.push({ move: i % 40 < 20 ? 1 : -0.2, jump: i % 55 === 30 });
  }
  for (const c of script) {
    a.step(1 / 60, c);
    b.step(1 / 60, c);
  }
  assert(snap(a) === snap(b), 'same seed + inputs → same state');
}

// Idle: AI should put points on the board inside 30s.
{
  const s = new PlaySession(99);
  for (let i = 0; i < 60 * 30; i++) {
    s.step(1 / 60, { move: 0, jump: false });
    if (s.over) break;
  }
  assert(s.time >= 8, `idle advanced time (t=${s.time.toFixed(1)})`);
  assert(
    s.ai.score > 0 || s.over || s.human.score + s.ai.score > 0,
    `idle under pressure within 30s (ai=${s.ai.score}, human=${s.human.score}, phase=${s.phase})`
  );
}

// Idle long enough: AI often wins game-to-5.
{
  let aiWins = 0;
  for (const seed of [3, 11, 77, 404, 9001]) {
    const s = new PlaySession(seed);
    for (let i = 0; i < 60 * 120; i++) {
      s.step(1 / 60, { move: 0, jump: false });
      if (s.over) break;
    }
    if (s.winner === 'ai') aiWins += 1;
  }
  assert(aiWins >= 3, `idle loses often (AI wins ${aiWins}/5 within 120s)`);
}

// Scripted aggressor + remorph after a make.
{
  let scored = false;
  let finishedWell = false;
  let remorphed = false;
  for (const seed of [12345, 222, 808, 4242, 50, 7, 99]) {
    const s = new PlaySession(seed);
    const arm0 = s.human.morph.arm;
    let steps = 0;
    while (!s.over && steps < 60 * 120) {
      let move = 0;
      let jump = false;
      if (s.ball.holder === 'human') {
        const dist = HOOP.x - s.human.x;
        move = dist > 90 ? 1 : dist < 50 ? -0.2 : 0.4;
        if (dist >= 35 && dist <= 210 && !s.human.airborne) jump = true;
      } else if (!s.ball.holder) {
        move = Math.sign(s.ball.x - s.human.x) || 1;
        if (Math.abs(s.ball.x - s.human.x) < 60) jump = s.ball.y > s.human.y + 6;
      } else {
        move = Math.sign(s.ai.x - s.human.x) || 1;
        if (Math.abs(s.ai.x - s.human.x) < 55 && !s.human.airborne) jump = true;
      }
      s.step(1 / 60, { move, jump });
      steps += 1;
      if (s.human.score > 0 && s.remorphs > 1 && s.human.morph.arm !== arm0) remorphed = true;
    }
    if (s.human.score > 0) scored = true;
    if (s.human.score >= 2 || (s.over && s.winner === 'human')) finishedWell = true;
    if (scored && finishedWell) break;
  }
  assert(scored, 'scripted player scored on at least one seed');
  assert(finishedWell, 'scripted player made meaningful progress');
  assert(remorphed, 'bodies remorph after a scored basket');
}

// Finished match exposes summary with near-miss line.
{
  const s = new PlaySession(7);
  for (let i = 0; i < 60 * 120; i++) {
    s.step(1 / 60, { move: i % 30 < 18 ? 1 : 0, jump: i % 48 === 10 });
    if (s.over) break;
  }
  if (!s.over) {
    s.human.score = MATCH.winScore;
    s.winner = 'human';
    s.phase = 'over';
  }
  const sum = s.summary;
  assert(!!sum, 'summary present when over');
  assert(typeof sum.nearMiss === 'string' && sum.nearMiss.length > 0, 'summary has near-miss line');
  assert(typeof sum.you === 'number' && typeof sum.them === 'number', 'summary has scores');
  assert(typeof sum.remorphs === 'number', 'summary reports remorph count');
}

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('\nAll smoke checks passed.');
