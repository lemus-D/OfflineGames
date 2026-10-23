#!/usr/bin/env node
/* Headless smoke: rack, shoot, English, aim predict, no Math.random. */
import { readFileSync } from 'node:fs';
import { PlaySession } from './src/game/play.js';
import {
  BALLS,
  RACK_ORDER,
  scoreClear,
  CUE_BALL,
  BALL_R,
  PHYSICS,
  TABLE,
  DIFFICULTIES,
  pocketCenters,
} from './src/game/content.js';
import { anyMoving, applyCueShot, stepPhysics, createBall } from './src/game/physics.js';
import { predictAim, ghostForStraight } from './src/game/aim.js';
import { chooseAiShot } from './src/game/ai.js';
import { makeRNG } from './src/core/rng.js';

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
  'src/game/ai.js',
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
assert(PHYSICS.rollingDrag >= 20, 'cloth drag high enough to avoid ice glide');
assert(PHYSICS.ballFriction > 0, 'ball–ball friction present');
assert(TABLE.pocketMouth < TABLE.pocketR * 0.6, 'pocket mouth stricter than visual rim');
assert(
  (TABLE.pocketMouthCorner || TABLE.pocketMouth) > TABLE.pocketMouth,
  'corner mouth more forgiving than side'
);

// Firm stroke should die around one table length — not skate forever.
{
  const cue = createBall(CUE_BALL, 0, 0);
  applyCueShot(cue, 1, 0, 0.85);
  let dist = 0;
  let steps = 0;
  while (anyMoving([cue]) && steps < 180 * 40) {
    const x0 = cue.x;
    const y0 = cue.y;
    stepPhysics([cue], 1 / 180);
    dist += Math.hypot(cue.x - x0, cue.y - y0);
    steps += 1;
  }
  const lengths = dist / (TABLE.halfW * 2);
  assert(lengths > 0.55 && lengths < 1.35, `firm stroke ~1 table length (got ${lengths.toFixed(2)})`);
  console.log(`ok: firm stroke travel ${lengths.toFixed(2)} table lengths in ${steps} steps`);
}
assert(
  pocketCenters().every(
    (p) => Math.abs(p.x) >= TABLE.halfW - 0.01 || Math.abs(p.y) >= TABLE.halfH - 0.01
  ),
  'pockets sit at or outside the felt edge'
);
assert(
  pocketCenters().every((p) => {
    const outside =
      Math.abs(p.x) > TABLE.halfW + 1 || Math.abs(p.y) > TABLE.halfH + 1;
    return outside;
  }),
  'pocket centers are off the felt (holes beside the table)'
);

// Deep in an off-table mouth still pockets + animates.
{
  const p = pocketCenters()[0];
  const deep = createBall(BALLS[1], p.x, p.y);
  stepPhysics([deep], 1 / 180);
  assert(deep.pocketed && deep.falling, 'center-in-mouth starts fall animation');
  for (let i = 0; i < 180; i++) stepPhysics([deep], 1 / 180);
  assert(!deep.falling, 'fall animation completes');
}

// Jaw clip into a corner pocket should drop, not bounce back onto the felt.
{
  const corner = pocketCenters().find((p) => p.corner && p.x > 0 && p.y > 0);
  const ball = createBall(BALLS[2], TABLE.halfW - BALL_R * 2.2, TABLE.halfH - BALL_R * 3.4);
  // Aim just off-center into the mouth — classic tip-reject line.
  const dx = corner.x - ball.x;
  const dy = corner.y - ball.y + 1.8;
  const len = Math.hypot(dx, dy) || 1;
  ball.vx = (dx / len) * 78;
  ball.vy = (dy / len) * 78;
  let steps = 0;
  while (!ball.pocketed && anyMoving([ball]) && steps < 180 * 8) {
    stepPhysics([ball], 1 / 180);
    steps += 1;
  }
  assert(ball.pocketed, `corner jaw clip pockets (dist left=${Math.hypot(ball.x - corner.x, ball.y - corner.y).toFixed(2)}, steps=${steps})`);
  console.log(`ok: corner jaw clip pocketed in ${steps} steps`);
}

// AI difficulties exist and produce a legal shot.
{
  assert(DIFFICULTIES.easy && DIFFICULTIES.medium && DIFFICULTIES.hard, 'three difficulties');
  const s = new PlaySession(11, {}, { mode: 'vsAi', difficulty: 'hard' });
  assert(s.mode === 'vsAi' && s.turn === 'player', 'vs AI starts on player turn');
  assert(s.openTable, 'match starts with open table');
  assert(s.legalTargets().every((b) => b.kind !== 'eight'), 'open table: 8 is not a legal target');
  const rng = makeRNG(99);
  for (const id of ['easy', 'medium', 'hard']) {
    const shot = chooseAiShot(s, id, rng);
    assert(shot && shot.power > 0.1, `${id} AI returns a shot`);
    assert(Number.isFinite(shot.dx) && Number.isFinite(shot.dy), `${id} aim finite`);
  }
  // Simulate a miss → turn flips to AI.
  s.shoot(0, 1, 0.3);
  let steps = 0;
  while ((s.moving || s.phase === 'rolling') && steps < 60 * 20) {
    s.step(1 / 60);
    steps += 1;
  }
  assert(s.turn === 'ai' || s.phase === 'won' || s.lastPocketed.length > 0, 'miss or pocket resolved');
}

// 8-ball suit assignment: first group pocketed claims that suit.
{
  const s = new PlaySession(3, {}, { mode: 'vsAi', difficulty: 'easy' });
  assert(s.openTable && !s.suits.player && !s.suits.ai, 'suits unset at start');
  // Force a solid pocket without physics: mimic post-shot resolve inputs.
  s.turn = 'player';
  s.lastPocketed = [3]; // solid
  s.phase = 'rolling';
  // Drive resolve by calling private path via settled shot: pocket ball 3 in place.
  const solid = s.balls.find((b) => b.id === 3);
  const stripe = s.balls.find((b) => b.id === 11);
  solid.pocketed = true;
  solid.falling = false;
  s.pocketedCount = 1;
  s._resolveShot();
  assert(!s.openTable, 'table closes after one group is made');
  assert(s.suits.player === 'solid', 'player claims solids');
  assert(s.suits.ai === 'stripe', 'AI gets stripes');
  assert(s.scores.player === 1, 'solid pocket tallies for player');
  assert(s.turn === 'player', 'legal pocket keeps the turn');
  assert(
    s.legalTargets().every((b) => b.kind === 'solid'),
    'after claim, only solids are legal'
  );

  // Opponent's ball alone does not keep the turn.
  s.lastPocketed = [11];
  stripe.pocketed = true;
  s.pocketedCount = 2;
  s.phase = 'rolling';
  s._resolveShot();
  assert(s.scores.ai === 1, 'stripe credits AI');
  assert(s.turn === 'ai', 'pocketing only opponent suit ends turn');
  assert(
    s.legalTargets('ai').every((b) => b.kind === 'stripe'),
    'AI legal targets are stripes'
  );
}

// Early 8 is a loss.
{
  const s = new PlaySession(5, {}, { mode: 'vsAi', difficulty: 'medium' });
  s.openTable = false;
  s.suits.player = 'solid';
  s.suits.ai = 'stripe';
  s.turn = 'player';
  s.lastPocketed = [8];
  const eight = s.balls.find((b) => b.id === 8);
  eight.pocketed = true;
  s.pocketedCount = 1;
  s.phase = 'rolling';
  s._resolveShot();
  assert(s.phase === 'won' && s.winner === 'ai', 'early 8 loses to AI');
}

// Corner pockets sit closer to the cloth than the prior k=0.55 layout.
{
  const corners = pocketCenters().filter((p) => p.corner);
  for (const p of corners) {
    const outX = Math.abs(p.x) - TABLE.halfW;
    const outY = Math.abs(p.y) - TABLE.halfH;
    assert(outX > 0 && outY > 0, 'corner still outside felt');
    assert(outX < TABLE.pocketOut * 0.5, `corner closer on x (out=${outX.toFixed(2)})`);
    assert(outY < TABLE.pocketOut * 0.5, `corner closer on y (out=${outY.toFixed(2)})`);
  }
}

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('\nAll smoke checks passed.');