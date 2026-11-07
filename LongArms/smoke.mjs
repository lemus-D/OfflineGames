#!/usr/bin/env node
/* Headless smoke: determinism, idle pressure, scripted score, no Math.random. */
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

// Determinism: identical seed + inputs → identical state.
{
  const seed = 42;
  const a = new PlaySession(seed);
  const b = new PlaySession(seed);
  const script = [];
  for (let i = 0; i < 60 * 8; i++) {
    const move = i % 40 < 20 ? 1 : -0.2;
    const jump = i % 55 === 30;
    script.push({ move, jump });
  }
  for (const c of script) {
    a.step(1 / 60, c);
    b.step(1 / 60, c);
  }
  assert(snap(a) === snap(b), 'same seed + inputs → same state');
}

// Idle: AI should put points on the board (pressure) inside 30s.
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

// Idle long enough: AI often wins game-to-12.
{
  let aiWins = 0;
  for (const seed of [3, 11, 77, 404, 9001]) {
    const s = new PlaySession(seed);
    for (let i = 0; i < 60 * 180; i++) {
      s.step(1 / 60, { move: 0, jump: false });
      if (s.over) break;
    }
    if (s.winner === 'ai') aiWins += 1;
  }
  assert(aiWins >= 3, `idle loses often (AI wins ${aiWins}/5 within 180s)`);
}

// Scripted aggressor: chase ball, contest, run to hoop, jump-throw.
{
  let scored = false;
  let finishedWell = false;
  for (const seed of [12345, 222, 808, 4242, 50]) {
    const s = new PlaySession(seed);
    let steps = 0;
    while (!s.over && steps < 60 * 90) {
      let move = 0;
      let jump = false;
      if (s.ball.holder === 'human') {
        const dist = HOOP.x - s.human.x;
        move = dist > 90 ? 1 : dist < 50 ? -0.2 : 0.35;
        // Jump-throw once inside a wide scoring band.
        if (dist >= 40 && dist <= 200 && !s.human.airborne) jump = true;
      } else if (!s.ball.holder) {
        move = Math.sign(s.ball.x - s.human.x) || 1;
        if (Math.abs(s.ball.x - s.human.x) < 55) jump = s.ball.y > s.human.y + 8;
      } else {
        // Contest the AI handler.
        move = Math.sign(s.ai.x - s.human.x) || 1;
        if (Math.abs(s.ai.x - s.human.x) < 50 && !s.human.airborne) jump = true;
      }
      s.step(1 / 60, { move, jump });
      steps += 1;
    }
    if (s.human.score > 0) scored = true;
    if (s.human.score >= 2 || (s.over && s.winner === 'human')) finishedWell = true;
    if (scored && finishedWell) break;
  }
  assert(scored, 'scripted player scored on at least one seed');
  assert(finishedWell, 'scripted player made meaningful progress');
}

// Finished match exposes summary with near-miss line.
{
  const s = new PlaySession(7);
  // Force a quick finish by injecting scores if needed after some play
  for (let i = 0; i < 60 * 120; i++) {
    const move = i % 30 < 18 ? 1 : 0;
    const jump = i % 48 === 10;
    s.step(1 / 60, { move, jump });
    if (s.over) break;
  }
  if (!s.over) {
    // Deterministic shove to terminal state for the assertion surface
    s.human.score = MATCH.winScore;
    s.winner = 'human';
    s.phase = 'over';
  }
  const sum = s.summary;
  assert(!!sum, 'summary present when over');
  assert(typeof sum.nearMiss === 'string' && sum.nearMiss.length > 0, 'summary has near-miss line');
  assert(typeof sum.you === 'number' && typeof sum.them === 'number', 'summary has scores');
}

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('\nAll smoke checks passed.');
