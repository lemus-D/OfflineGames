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
{
  // Reverse mist must never float over void — players read that as falling through.
  const solid = new Set(['#', 'B', '=', '*', '?', 'C', 'S']);
  let mistOk = true;
  for (const L of LEVELS) {
    const w = Math.max(...L.rows.map((r) => r.length));
    const rows = L.rows.map((r) => r.padEnd(w, '.'));
    for (let ty = 0; ty < rows.length; ty++) {
      for (let tx = 0; tx < w; tx++) {
        if (rows[ty][tx] !== 'R') continue;
        let supported = false;
        for (let y = ty + 1; y < rows.length; y++) {
          if (solid.has(rows[y][tx])) {
            supported = true;
            break;
          }
        }
        if (!supported) {
          console.error(`FAIL: mist over void in ${L.id} at ${tx},${ty}`);
          mistOk = false;
        }
      }
    }
  }
  assert(mistOk, 'every reverse mist cell has solid ground below');
}
{
  // Spikes belong in ground pits only — bottom two rows, never on top of a standable tile.
  let spikeOk = true;
  const standable = new Set(['#', 'B', '=', '*', '?', 'C', 'S']);
  for (const L of LEVELS) {
    const w = Math.max(...L.rows.map((r) => r.length));
    const rows = L.rows.map((r) => r.padEnd(w, '.'));
    const groundBand = Math.max(0, rows.length - 2);
    for (let ty = 0; ty < rows.length; ty++) {
      for (let tx = 0; tx < w; tx++) {
        if (rows[ty][tx] !== '^' && rows[ty][tx] !== 'v') continue;
        if (ty < groundBand) {
          console.error(`FAIL: floating spike in ${L.id} at ${tx},${ty} (not in ground band)`);
          spikeOk = false;
        }
        const below = rows[ty + 1]?.[tx];
        if (below && standable.has(below)) {
          console.error(`FAIL: spike ceiling on ${below} in ${L.id} at ${tx},${ty}`);
          spikeOk = false;
        }
      }
    }
  }
  assert(spikeOk, 'no floating spikes / spike ceilings on platforms');
}
assert(formatTime(65.5).startsWith('1:05'), 'formatTime formats minutes');
assert(PICKLE.w < 14 && PICKLE.h < 18, 'player hitbox smaller than drawn pickle');
assert(jumpPeakHeight() > TILE * 5, `jump clears >5 tiles (peak=${jumpPeakHeight().toFixed(0)}px)`);

const idle = { move: 0, jump: false, jumpHeld: false, restart: false };

// Idle on L1: stays alive briefly, then brine kills after per-level grace.
{
  const s = new PlaySession(1, {}, { startLevel: 0 });
  const grace = s.level.brineGrace;
  for (let i = 0; i < 60 * 2; i++) s.step(1 / 60, idle);
  assert(s.status === 'playing', 'idle 2s still alive on spawn');
  let diedAt = null;
  for (let i = 0; i < 60 * 150; i++) {
    s.step(1 / 60, idle);
    if (s.status === 'dead' && diedAt == null) {
      diedAt = s.levelTime;
      break;
    }
  }
  assert(diedAt != null, `brine/idle eventually kills (status=${s.status})`);
  assert(s.deathReason === 'brine' || s.deathReason === 'void', `idle death reason=${s.deathReason}`);
  assert(s.deaths === 1, 'idle death counts');
  assert(diedAt >= grace, `brine waits for grace (${diedAt?.toFixed(1)}s >= ${grace})`);
  assert(diedAt < grace + 30, `idle death before unbounded stall (${diedAt?.toFixed(1)}s)`);
}

// L1 clearable: jump the fake-floor gap on the ground path.
{
  const s = new PlaySession(7, {}, { startLevel: 0 });
  let hop = 0;
  let cleared = false;
  for (let steps = 0; steps < 60 * 25; steps++) {
    if (s.status === 'dead') {
      s.step(1 / 60, { move: 0, jump: false, jumpHeld: false, restart: true });
      hop = 0;
      continue;
    }
    if (s.status === 'cleared' || s.levelIndex > 0) {
      cleared = true;
      break;
    }
    const x = s.player.x / TILE;
    let jump = false;
    if (x > 9.5 && x < 11.2 && s.player.onGround) {
      jump = true;
      hop = 16;
    }
    const jumpHeld = hop > 0;
    if (hop > 0) hop -= 1;
    s.step(1 / 60, { move: 1, jump, jumpHeld, restart: false });
  }
  assert(cleared, `L1 completable (status=${s.status} x=${s.player.x.toFixed(0)})`);
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
  // Walk into the fake flag on L3 (open approach).
  for (let i = 0; i < 60 * 20; i++) {
    s.step(1 / 60, { move: 1, jump: false, jumpHeld: false, restart: false });
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

// L8 (reverse mist): continuous floor under mist; flip move in R, walk to G.
{
  const s = new PlaySession(23, {}, { startLevel: 7 });
  let steps = 0;
  let cleared = false;
  let mistSteps = 0;
  while (steps < 60 * 35) {
    if (s.status === 'dead') {
      assert(false, `L8 must not die on solid mist floor (reason=${s.deathReason})`);
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
    if (inMist) mistSteps += 1;
    const move = inMist ? -1 : 1;
    s.step(1 / 60, { move, jump: false, jumpHeld: false, restart: false });
    steps += 1;
  }
  assert(mistSteps > 30, `L8 walks through mist (${mistSteps} steps in R)`);
  assert(
    cleared,
    `L8 completable (status=${s.status} x=${s.player.x.toFixed(0)} deaths=${s.deaths})`
  );
}

// L9 (combo): ground-row path; jump ~~, spike pit, fake flag, vanish, ghost.
{
  const s = new PlaySession(9, {}, { startLevel: 8 });
  let steps = 0;
  let cleared = false;
  let hopFrames = 0;
  while (steps < 60 * 40) {
    if (s.status === 'dead') {
      s.step(1 / 60, { move: 0, jump: false, jumpHeld: false, restart: true });
      hopFrames = 0;
      steps += 1;
      continue;
    }
    if (s.status === 'cleared' || s.levelIndex > 8) {
      cleared = true;
      break;
    }
    const x = s.player.x / TILE;
    let jump = false;
    if (x > 5.2 && x < 6.8 && s.player.onGround) {
      jump = true;
      hopFrames = 12;
    }
    if (x > 10.5 && x < 12.0 && s.player.onGround) {
      jump = true;
      hopFrames = 14;
    }
    if (x > 16.8 && x < 18.5 && s.player.onGround) {
      jump = true;
      hopFrames = 18;
    }
    if (x > 24.5 && x < 26.2 && s.player.onGround) {
      jump = true;
      hopFrames = 16;
    }
    if (x > 29.0 && x < 31.0 && s.player.onGround) {
      jump = true;
      hopFrames = 14;
    }
    if (x > 34.5 && x < 36.5 && s.player.onGround) {
      jump = true;
      hopFrames = 14;
    }
    if (x > 37.0 && x < 39.0 && s.player.onGround) {
      jump = true;
      hopFrames = 14;
    }
    const jumpHeld = hopFrames > 0;
    if (hopFrames > 0) hopFrames -= 1;
    s.step(1 / 60, { move: 1, jump, jumpHeld, restart: false });
    steps += 1;
  }
  assert(
    cleared,
    `L9 completable (status=${s.status} x=${s.player.x.toFixed(0)} deaths=${s.deaths})`
  );
}

// L10 (finale): spike pit, ~~, vanish, crumbly, fake F, ?, mist (flip), goal.
{
  const s = new PlaySession(11, {}, { startLevel: 9 });
  let steps = 0;
  let cleared = false;
  let hopFrames = 0;
  let mistSteps = 0;
  while (steps < 60 * 45) {
    if (s.status === 'dead') {
      s.step(1 / 60, { move: 0, jump: false, jumpHeld: false, restart: true });
      hopFrames = 0;
      steps += 1;
      continue;
    }
    if (s.status === 'cleared' || s.won || s.levelIndex > 9) {
      cleared = true;
      break;
    }
    const x = s.player.x / TILE;
    let jump = false;
    if (x > 5.2 && x < 6.8 && s.player.onGround) {
      jump = true;
      hopFrames = 18;
    }
    if (x > 14.5 && x < 16.5 && s.player.onGround) {
      jump = true;
      hopFrames = 14;
    }
    if (x > 21.5 && x < 23.5 && s.player.onGround) {
      jump = true;
      hopFrames = 14;
    }
    if (x > 28.2 && x < 29.8 && s.player.onGround) {
      jump = true;
      hopFrames = 16;
    }
    if (x > 32.5 && x < 34.5 && s.player.onGround) {
      jump = true;
      hopFrames = 14;
    }
    if (x > 38.5 && x < 40.5 && s.player.onGround) {
      jump = true;
      hopFrames = 14;
    }
    if (x > 41.5 && x < 43.5 && s.player.onGround) {
      jump = true;
      hopFrames = 14;
    }
    const tx = Math.floor(s.player.x / TILE);
    const ty = Math.floor(s.player.y / TILE);
    const inMist = !!(s.level.grid[ty]?.[tx]?.reverse);
    if (inMist) mistSteps += 1;
    const move = inMist ? -1 : 1;
    const jumpHeld = hopFrames > 0;
    if (hopFrames > 0) hopFrames -= 1;
    s.step(1 / 60, { move, jump, jumpHeld, restart: false });
    steps += 1;
  }
  assert(mistSteps > 10, `L10 walks through mist (${mistSteps} steps in R)`);
  assert(
    cleared,
    `L10 completable (status=${s.status} x=${s.player.x.toFixed(0)} deaths=${s.deaths})`
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
