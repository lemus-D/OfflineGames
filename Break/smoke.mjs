#!/usr/bin/env node
/* Headless smoke: rack, shoot, English, aim predict, no Math.random. */
import { readFileSync } from 'node:fs';
import { PlaySession } from './src/game/play.js';
import { BALLS, RACK_ORDER, scoreClear, CUE_BALL, BALL_R, PHYSICS, TABLE } from './src/game/content.js';
import { anyMoving, applyCueShot, stepPhysics, createBall } from './src/game/physics.js';
import { predictAim, ghostForStraight } from './src/game/aim.js';

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
  'src/game/aim.js',
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

// Break shot determinism.
{
  const a = new PlaySession(99);
  const b = new PlaySession(99);
  assert(a.shoot(1, 0, 0.85), 'accepts break shot');
  assert(b.shoot(1, 0, 0.85), 'twin accepts break shot');

  let steps = 0;
  while ((a.moving || b.moving || a.phase === 'rolling' || b.phase === 'rolling') && steps < 60 * 25) {
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

// Aim prediction: straight shot ghost sits 2R behind target.
{
  const cue = createBall(CUE_BALL, 0, 0);
  const one = createBall(BALLS[0], 40, 0);
  const pred = predictAim(cue, [cue, one], 1, 0);
  assert(pred && pred.ghost && pred.target && pred.target.id === 1, 'predict finds ball 1');
  const g = ghostForStraight(cue, one);
  assert(Math.abs(pred.ghost.x - g.x) < 0.05, `ghost x ~ straight (${pred.ghost.x.toFixed(2)} vs ${g.x.toFixed(2)})`);
  assert(Math.abs(pred.ghost.y) < 0.05, 'ghost y on axis');
  assert(pred.contact, 'contact point present');
  assert(pred.objectDir && pred.objectDir.x > 0.9, 'object leaves forward on straight');
  assert(pred.cutDeg != null && pred.cutDeg < 5, `straight cut ~0° (got ${pred.cutDeg?.toFixed(1)})`);
}

// Cut angle: aim past the ball center → nonzero cut.
{
  const cue = createBall(CUE_BALL, 0, 0);
  const one = createBall(BALLS[0], 40, 0);
  // Offset small enough to still graze the 2R collision circle.
  const pred = predictAim(cue, [cue, one], 40, 3.5);
  assert(pred && pred.ghost, 'cut aim finds ghost');
  assert(pred.cutDeg > 5, `cut angle > 5° (got ${pred.cutDeg?.toFixed(1)})`);
  assert(pred.objectDir && pred.cueDir, 'both leave dirs present');
}

// English applies spin and changes cushion outcome vs center hit.
{
  const center = createBall(CUE_BALL, 0, 0);
  const english = createBall(CUE_BALL, 0, 0);
  applyCueShot(center, 1, 0.2, 0.7, { x: 0, y: 0 });
  applyCueShot(english, 1, 0.2, 0.7, { x: 0.8, y: 0 });
  assert(Math.abs(english.sideSpin) > Math.abs(center.sideSpin), 'side English stores sideSpin');
  assert(Math.abs(center.sideSpin) < 1e-6, 'center hit has no sideSpin');

  // Run both into the right rail-ish area.
  for (let i = 0; i < 180 * 3; i++) {
    stepPhysics([center], 1 / 180);
    stepPhysics([english], 1 / 180);
  }
  assert(
    Math.abs(center.y - english.y) > 0.05 || Math.abs(center.vy - english.vy) > 0.05 ||
      Math.abs(center.x - english.x) > 0.05,
    'English changes path vs center hit'
  );
  console.log(
    `ok: english path delta dx=${(english.x - center.x).toFixed(2)} dy=${(english.y - center.y).toFixed(2)}`
  );
}

// Follow English stores forwardSpin.
{
  const cue = createBall(CUE_BALL, 0, 0);
  applyCueShot(cue, 1, 0, 0.6, { x: 0, y: 0.7 });
  assert(cue.forwardSpin > 0, 'topspin is positive forwardSpin');
}

// Direct impulse moves balls.
{
  const cue = createBall(CUE_BALL, 0, 0);
  const one = createBall(BALLS[0], 40, 0);
  const balls = [cue, one];
  applyCueShot(cue, 1, 0, 0.7);
  for (let i = 0; i < 60 * 8; i++) {
    stepPhysics(balls, 1 / 180);
    if (!anyMoving(balls)) break;
  }
  assert(cue.x !== 0 || one.x !== 40, 'impulse moves balls');
}

// Weak shot rejected / rolling lock.
{
  const s = new PlaySession(1);
  assert(!s.shoot(1, 0, 0.01), 'near-zero power rejected');
  assert(s.shots === 0, 'rejected shot not counted');
  assert(s.shoot(1, 0, 0.5, { x: 0.2, y: -0.1 }), 'first shot with english ok');
  assert(!s.shoot(1, 0, 0.5), 'second shot blocked while rolling');
}

assert(BALL_R > 0 && PHYSICS.maxEnglish > 0, 'tunables sane');

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('\nAll smoke checks passed.');