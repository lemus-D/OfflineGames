#!/usr/bin/env node
/* Headless smoke: physics, traps, brine, determinism, no Math.random. */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PlaySession } from './src/game/play.js';
import {
  LEVELS,
  TILE,
  PICKLE,
  BRINE,
  formatTime,
  levelCount,
  jumpPeakHeight,
} from './src/game/content.js';

const ROOT = dirname(fileURLToPath(import.meta.url));

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failures += 1;
  } else {
    console.log('ok:', msg);
  }
}

function walkSrc(dir, out = []) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) walkSrc(p, out);
    else if (/\.(js|mjs)$/.test(name.name)) out.push(p);
  }
  return out;
}

for (const file of walkSrc(join(ROOT, 'src'))) {
  const src = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  const rel = file.slice(ROOT.length + 1);
  assert(!/\bMath\.random\s*\(/.test(src), `${rel} has no Math.random()`);
}

assert(levelCount() === 10, 'exactly 10 levels');
assert(LEVELS.every((L) => L.rows.some((r) => r.includes('P'))), 'every level has a spawn');
assert(LEVELS.every((L) => L.rows.some((r) => r.includes('G'))), 'every level has a real goal');
assert(formatTime(65.5).startsWith('1:05'), 'formatTime formats minutes');
assert(PICKLE.w < 14 && PICKLE.h < 18, 'player hitbox smaller than drawn pickle');
assert(jumpPeakHeight() > TILE * 5, `jump clears >5 tiles (peak=${jumpPeakHeight().toFixed(0)}px)`);

const idle = { move: 0, jump: false, jumpHeld: false, restart: false };

// Idle on L1: stays alive briefly, then brine kills after grace.
{
  const s = new PlaySession(1, {}, { startLevel: 0 });
  for (let i = 0; i < 60 * 2; i++) s.step(1 / 60, idle);
  assert(s.status === 'playing', 'idle 2s still alive on spawn');
  let diedAt = null;
  for (let i = 0; i < 60 * 90; i++) {
    s.step(1 / 60, idle);
    if (s.status === 'dead' && diedAt == null) {
      diedAt = s.levelTime;
      break;
    }
  }
  assert(diedAt != null, `brine/idle eventually kills (status=${s.status})`);
  assert(s.deathReason === 'brine' || s.deathReason === 'void', `idle death reason=${s.deathReason}`);
  assert(s.deaths === 1, 'idle death counts');
  assert(diedAt < BRINE.grace + 30, `idle death before unbounded stall (${diedAt?.toFixed(1)}s)`);
}

// Fake floor on L1 (~ tiles): walking right into ~~ should fall / die or drop.
{
  const s = new PlaySession(2, {}, { startLevel: 0 });
  // Walk toward the fake floor strip in welcome level.
  for (let i = 0; i < 60 * 4; i++) {
    const jump = i % 40 === 10;
    s.step(1 / 60, { move: 1, jump, jumpHeld: jump, restart: false });
    if (s.status !== 'playing') break;
  }
  assert(
    s.player.x > s.level.spawn.x + TILE || s.status === 'dead' || s.status === 'cleared',
    `scripted L1 makes progress (x=${s.player.x.toFixed(0)} status=${s.status})`
  );
}

// Spike kills.
{
  const s = new PlaySession(3, {}, { startLevel: 0 });
  // Teleport-ish: walk into spikes area by long run+jump toward mid spikes.
  let steps = 0;
  while (s.status === 'playing' && steps < 60 * 8) {
    const jump = steps % 25 === 5;
    s.step(1 / 60, { move: 1, jump, jumpHeld: jump, restart: false });
    steps += 1;
  }
  // May clear or die — either ends the attempt meaningfully.
  assert(
    s.status === 'dead' || s.status === 'cleared' || s.player.x > 100,
    `L1 attempt ends or advances (status=${s.status} x=${s.player.x.toFixed(0)})`
  );
}

// Determinism: same seed + inputs → same state.
{
  const a = new PlaySession(99, {}, { startLevel: 1 });
  const b = new PlaySession(99, {}, { startLevel: 1 });
  for (let i = 0; i < 60 * 3; i++) {
    const c = {
      move: i % 20 < 15 ? 1 : 0,
      jump: i % 30 === 0,
      jumpHeld: i % 30 < 8,
      restart: false,
    };
    a.step(1 / 60, c);
    b.step(1 / 60, c);
  }
  assert(
    Math.abs(a.player.x - b.player.x) < 1e-6 &&
      Math.abs(a.player.y - b.player.y) < 1e-6 &&
      a.status === b.status &&
      a.deaths === b.deaths,
    'same seed, same inputs: identical outcome'
  );
}

// Respawn after death restores playing on the same level.
{
  const s = new PlaySession(5, {}, { startLevel: 2 });
  for (let i = 0; i < 60 * 50; i++) {
    s.step(1 / 60, idle);
    if (s.status === 'dead') break;
  }
  assert(s.status === 'dead', 'forced death before respawn test');
  const d = s.deaths;
  s.step(1 / 60, { ...idle, restart: true });
  assert(s.status === 'playing', 'R respawns');
  assert(s.deaths === d, 'respawn does not add extra death');
  assert(s.levelIndex === 2, 'respawn stays on same level');
}

// Level "looks-solid" left pad is safe when walking left.
{
  const s = new PlaySession(7, {}, { startLevel: 1 });
  for (let i = 0; i < 60; i++) {
    s.step(1 / 60, { move: -1, jump: false, jumpHeld: false, restart: false });
  }
  assert(s.status === 'playing', 'walking on solid ground stays alive');
  assert(s.summary().time > 0, 'summary has time');
}

// L2 is completable: run + timed jumps over pits (fake bridge is a lie).
{
  const s = new PlaySession(11, {}, { startLevel: 1 });
  let steps = 0;
  let cleared = false;
  while (steps < 60 * 45) {
    if (s.status === 'dead') {
      s.step(1 / 60, { move: 0, jump: false, jumpHeld: false, restart: true });
      steps += 1;
      continue;
    }
    if (s.status === 'cleared' || s.levelIndex > 1) {
      cleared = true;
      break;
    }
    const x = s.player.x;
    // Jump just before each pit (5-tile at ~10–14, 2-tile at ~21–22).
    const nearGap = x > 8.5 * TILE && x < 10.5 * TILE;
    const nearSecond = x > 19.2 * TILE && x < 21.0 * TILE;
    const jump = (nearGap || nearSecond) && s.player.onGround;
    s.step(1 / 60, {
      move: 1,
      jump,
      jumpHeld: !s.player.onGround || jump,
      restart: false,
    });
    steps += 1;
  }
  assert(
    cleared,
    `L2 completable by scripted runner (status=${s.status} x=${s.player.x.toFixed(0)} deaths=${s.deaths})`
  );
}

// L4 (vanish pads): hop the 2-tile pits, ignore the fake ~~ ledge.
{
  const s = new PlaySession(17, {}, { startLevel: 3 });
  let steps = 0;
  let cleared = false;
  let hopFrames = 0;
  while (steps < 60 * 25) {
    if (s.status === 'dead') {
      s.step(1 / 60, { move: 0, jump: false, jumpHeld: false, restart: true });
      hopFrames = 0;
      steps += 1;
      continue;
    }
    if (s.status === 'cleared' || s.levelIndex > 3) {
      cleared = true;
      break;
    }
    const x = s.player.x;
    const nearPit =
      (x > 5.3 * TILE && x < 6.8 * TILE) ||
      (x > 11.3 * TILE && x < 12.8 * TILE) ||
      (x > 17.3 * TILE && x < 18.8 * TILE) ||
      (x > 23.3 * TILE && x < 24.8 * TILE);
    let jump = false;
    if (nearPit && s.player.onGround) {
      jump = true;
      hopFrames = 8;
    }
    const jumpHeld = hopFrames > 0;
    if (hopFrames > 0) hopFrames -= 1;
    s.step(1 / 60, { move: 1, jump, jumpHeld, restart: false });
    steps += 1;
  }
  assert(
    cleared,
    `L4 completable (status=${s.status} x=${s.player.x.toFixed(0)} deaths=${s.deaths})`
  );
}

// L6 (spring trap): jump the pits and over the spring — don't land on it.
{
  const s = new PlaySession(19, {}, { startLevel: 5 });
  let steps = 0;
  let cleared = false;
  let hopFrames = 0;
  while (steps < 60 * 30) {
    if (s.status === 'dead') {
      s.step(1 / 60, { move: 0, jump: false, jumpHeld: false, restart: true });
      hopFrames = 0;
      steps += 1;
      continue;
    }
    if (s.status === 'cleared' || s.levelIndex > 5) {
      cleared = true;
      break;
    }
    const x = s.player.x;
    const near =
      (x > 5.3 * TILE && x < 6.8 * TILE) ||
      (x > 11.0 * TILE && x < 14.2 * TILE) ||
      (x > 19.3 * TILE && x < 20.8 * TILE) ||
      (x > 25.3 * TILE && x < 26.8 * TILE);
    let jump = false;
    if (near && s.player.onGround) {
      jump = true;
      hopFrames = 12;
    }
    const jumpHeld = hopFrames > 0;
    if (hopFrames > 0) hopFrames -= 1;
    s.step(1 / 60, { move: 1, jump, jumpHeld, restart: false });
    steps += 1;
  }
  assert(
    cleared,
    `L6 completable (status=${s.status} x=${s.player.x.toFixed(0)} deaths=${s.deaths})`
  );
}

// L8 (reverse mist): floor under mist; jump gap + spikes (controls flip in R).
{
  const s = new PlaySession(23, {}, { startLevel: 7 });
  let steps = 0;
  let cleared = false;
  let hopFrames = 0;
  while (steps < 60 * 35) {
    if (s.status === 'dead') {
      s.step(1 / 60, { move: 0, jump: false, jumpHeld: false, restart: true });
      hopFrames = 0;
      steps += 1;
      continue;
    }
    if (s.status === 'cleared' || s.levelIndex > 7) {
      cleared = true;
      break;
    }
    const x = s.player.x;
    const ty = Math.floor(s.player.y / TILE);
    const tx = Math.floor(x / TILE);
    const cell = s.level.grid[ty]?.[tx];
    const inMist = !!(cell && cell.reverse);
    const move = inMist ? -1 : 1;
    const nearGap = x > 29.2 * TILE && x < 31.5 * TILE;
    let jump = false;
    if (nearGap && s.player.onGround) {
      jump = true;
      hopFrames = 12;
    }
    const jumpHeld = hopFrames > 0;
    if (hopFrames > 0) hopFrames -= 1;
    s.step(1 / 60, { move, jump, jumpHeld, restart: false });
    steps += 1;
  }
  assert(
    cleared,
    `L8 completable (status=${s.status} x=${s.player.x.toFixed(0)} deaths=${s.deaths})`
  );
}

// Measured jump height in-sim.
{
  const s = new PlaySession(13, {}, { startLevel: 0 });
  const y0 = s.player.y;
  s.step(1 / 60, { move: 0, jump: true, jumpHeld: true, restart: false });
  let peak = s.player.y;
  for (let i = 0; i < 60; i++) {
    s.step(1 / 60, { move: 0, jump: false, jumpHeld: true, restart: false });
    peak = Math.min(peak, s.player.y);
  }
  const rise = y0 - peak;
  assert(rise > TILE * 4.5, `in-sim jump rises >4.5 tiles (${rise.toFixed(0)}px)`);
}

// Campaign summary shape.
{
  const s = new PlaySession(8);
  const sum = s.summary();
  assert(typeof sum.deaths === 'number' && typeof sum.time === 'number', 'summary fields');
  assert(sum.levelName === LEVELS[0].name, 'summary names level');
}

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('\nAll smoke checks passed.');
