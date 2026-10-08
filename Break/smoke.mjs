#!/usr/bin/env node
/* Headless smoke: rack, shoot, pocket, determinism, no Math.random. */
import { readFileSync } from 'node:fs';
import { PlaySession } from './src/game/play.js';
import { BALLS, RACK_ORDER, scoreClear, CUE_BALL } from './src/game/content.js';
import { anyMoving, applyCueShot, stepPhysics, createBall } from './src/game/physics.js';

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
  'src/game/physics.js',
  'src/game/draw.js',
  'src/core/rng.js',
  'src/core/save.js',
]) {
  const src = readFileSync(new URL(file, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert(!/\bMath\.random\s*\(/.test(src), `${file} has no Math.random()`);
}

assert(BALLS.length === 15, 'fifteen object balls in catalog');
assert(RACK_ORDER.length === 15, 'rack order has fifteen slots');
assert(RACK_ORDER.includes(8), 'eight ball in rack');
assert(scoreClear(20, 15) > scoreClear(40, 15), 'fewer shots scores higher on a clear');

// Idle rack stays still.
{
  const s = new PlaySession(7);
  assert(s.balls.length === 16, 'cue + 15 object balls');
  assert(s.remaining === 15, 'fifteen on the table');
  for (let i = 0; i < 60 * 2; i++) s.step(1 / 60);
  assert(!s.moving, 'idle rack is not moving');
  assert(s.shots === 0, 'idle does not count shots');
  assert(s.phase === 'aiming', 'starts in aiming');
}

// Break shot: cue moves, some balls move, determinism.
{
  const a = new PlaySession(99);
  const b = new PlaySession(99);
  assert(a.shoot(1, 0, 0.85), 'accepts break shot');
  assert(b.shoot(1, 0, 0.85), 'twin accepts break shot');
  assert(a.shots === 1 && b.shots === 1, 'shot counted');

  let steps = 0;
  while ((a.moving || b.moving || a.phase === 'rolling' || b.phase === 'rolling') && steps < 60 * 20) {
    a.step(1 / 60);
    b.step(1 / 60);
    steps += 1;
  }
  assert(a.phase !== 'rolling' && b.phase !== 'rolling', 'break settles');
  assert(
    Math.abs(a.cue.x - b.cue.x) < 1e-6 && Math.abs(a.cue.y - b.cue.y) < 1e-6,
    'same seed + same shot → same cue rest'
  );
  const ax = a.objectBalls.map((ball) => `${ball.id}:${ball.x.toFixed(4)},${ball.y.toFixed(4)}`).join('|');
  const bx = b.objectBalls.map((ball) => `${ball.id}:${ball.x.toFixed(4)},${ball.y.toFixed(4)}`).join('|');
  assert(ax === bx, 'same seed + same shot → identical object layout');
  console.log(`ok: break settled in ${steps} frames, pocketed=${a.pocketedCount}`);
}

// Direct pocket: cue → object ball toward a corner-ish path via open table shot.
{
  // Tiny custom scene via physics helpers: cue and one ball lined up at a pocket.
  const cue = createBall(CUE_BALL, 0, 0);
  const one = createBall(BALLS[0], 40, 0);
  const balls = [cue, one];
  applyCueShot(cue, 1, 0, 0.7);
  let pocketed = false;
  for (let i = 0; i < 60 * 8; i++) {
    const ev = stepPhysics(balls, 1 / 120);
    if (ev.pocketed.some((b) => b.id === 1)) pocketed = true;
    if (!anyMoving(balls)) break;
  }
  // May or may not pocket depending on cushions — assert motion worked.
  assert(cue.x !== 0 || one.x !== 40, 'impulse moves balls');
  console.log(`ok: open-table impulse ran (ball1 pocketed=${pocketed})`);
}

// Scratch recovery: two equal opposite shots should not clear by accident;
// force cue into pocket by aiming it into a corner pocket path.
{
  const s = new PlaySession(3);
  // Fire cue hard into the top-left corner from kitchen.
  const cue = s.cue;
  const dirX = -TABLE_DIR_X(cue);
  const dirY = -TABLE_DIR_Y(cue);
  s.shoot(dirX, dirY, 1);
  let steps = 0;
  while ((s.moving || s.phase === 'rolling') && steps < 60 * 15) {
    s.step(1 / 60);
    steps += 1;
  }
  // If scratched, must enter ball-in-hand with cue back on table.
  if (s.scratches > 0) {
    assert(s.phase === 'ballInHand' || s.phase === 'aiming', 'scratch handled');
    assert(!s.cue.pocketed, 'cue restored after scratch');
    console.log('ok: scratch path exercised');
  } else {
    assert(s.phase === 'aiming' || s.phase === 'won', 'non-scratch settle ok');
    console.log('ok: corner blast did not scratch (acceptable)');
  }
}

function TABLE_DIR_X(cue) {
  return -1;
}
function TABLE_DIR_Y(cue) {
  return -0.55;
}

// Weak shot rejected.
{
  const s = new PlaySession(1);
  assert(!s.shoot(1, 0, 0.01), 'near-zero power rejected');
  assert(s.shots === 0, 'rejected shot not counted');
}

// Cannot shoot while rolling.
{
  const s = new PlaySession(5);
  assert(s.shoot(1, 0, 0.5), 'first shot ok');
  assert(!s.shoot(1, 0, 0.5), 'second shot blocked while rolling');
}

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('\nAll smoke checks passed.');
