#!/usr/bin/env node
/* Headless smoke: thrust climb, free tilt, fall collects, upgrades, no Math.random. */
import { readFileSync } from 'node:fs';
import { PlaySession } from './src/game/play.js';
import { ROCKET, PICKUPS, wrapAngle, tiltDegrees } from './src/game/content.js';
import { gameToKm, CELESTIAL, ATM_GAME_UNITS, ATM_KM, layerAtKm } from './src/game/altitude.js';
import {
  foldStats,
  buyUpgrade,
  emptyUpgrades,
  UPGRADES,
} from './src/game/upgrades.js';

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failures += 1;
  } else {
    console.log('ok:', msg);
  }
}

const idle = { steer: 0, thrust: false };
const boost = { steer: 0, thrust: true };

for (const file of [
  'src/game/play.js',
  'src/game/content.js',
  'src/game/draw.js',
  'src/game/altitude.js',
  'src/game/upgrades.js',
  'src/core/rng.js',
]) {
  const src = readFileSync(new URL(file, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert(!/\bMath\.random\s*\(/.test(src), `${file} has no Math.random()`);
}

assert(tiltDegrees(0) === 0, 'tiltDegrees upright is 0');
assert(tiltDegrees(Math.PI) === 180, 'tiltDegrees π is 180');
assert(Math.abs(wrapAngle(Math.PI * 3) - Math.PI) < 1e-9, 'wrapAngle wraps');

assert(Math.abs(gameToKm(0)) < 0.01, 'sea level ~0 km');
assert(Math.abs(gameToKm(ATM_GAME_UNITS) - ATM_KM) < 0.01, 'atm top maps to 100 km');
assert(layerAtKm(5).id === 'troposphere', '5 km is troposphere');
assert(layerAtKm(30).id === 'stratosphere', '30 km is stratosphere');
assert(layerAtKm(70).id === 'mesosphere', '70 km is mesosphere');
assert(CELESTIAL[0].id === 'moon', 'first celestial is moon');
assert(gameToKm(CELESTIAL[0].gameY) > 1e5, 'moon altitude is lunar-scale km');
assert(
  CELESTIAL.every((c, i) => i === 0 || c.gameY > CELESTIAL[i - 1].gameY),
  'celestials ordered by ascending gameY'
);
assert(
  CELESTIAL.every((c, i) => i === 0 || c.realKm > CELESTIAL[i - 1].realKm),
  'celestials ordered by ascending realKm'
);
const ids = new Set(CELESTIAL.map((c) => c.id));
for (const need of ['moon', 'venus', 'mars', 'sun', 'belt', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']) {
  assert(ids.has(need), `celestial catalog includes ${need}`);
}
assert(gameToKm(100) < gameToKm(1000), 'gameToKm monotonic');
assert(gameToKm(CELESTIAL[0].gameY) < gameToKm(CELESTIAL[CELESTIAL.length - 1].gameY), 'moon km < pluto km');

// No thrust: stay on the pad.
{
  const s = new PlaySession(7);
  for (let i = 0; i < 60 * 2; i++) s.step(1 / 60, idle);
  assert(s.player.alive, 'idle on pad stays alive');
  assert(s.player.y <= ROCKET.startY + 1, 'idle does not auto-climb');
  assert(s.player.fuel === ROCKET.startFuel, 'idle does not burn fuel');
}

// Full spin past 180°.
{
  const s = new PlaySession(3);
  for (let i = 0; i < 60 * 2; i++) s.step(1 / 60, { steer: 1, thrust: false });
  assert(Math.abs(s.player.tilt) > 1.5 || s.player.tilt < -0.5, 'can rotate past old max lean');
  // Keep spinning — should wrap, not clamp.
  for (let i = 0; i < 60 * 3; i++) s.step(1 / 60, { steer: 1, thrust: false });
  assert(Number.isFinite(s.player.tilt), 'tilt stays finite after full spins');
  assert(s.player.tilt >= -Math.PI - 0.01 && s.player.tilt <= Math.PI + 0.01, 'tilt wrapped');
}

// Thrust climbs; release falls; pickups still exist below while falling.
{
  const s = new PlaySession(11);
  for (let i = 0; i < 60 * 3; i++) s.step(1 / 60, boost);
  assert(s.player.y > 200, `boost climbs (y=${s.player.y.toFixed(0)})`);
  const peak = s.player.y;

  // Fall for a bit — bands below should refill.
  for (let i = 0; i < 60 * 2; i++) s.step(1 / 60, idle);
  assert(s.player.vy < 0, 'release boost → falling');
  const below = s.pickups.filter((u) => u.y < s.player.y && u.y > s.player.y - 400);
  assert(below.length > 0, `falling still has pickups below (n=${below.length})`);
  assert(s.player.y < peak, 'actually descended');
}

for (const seed of [1, 42, 99, 12345, 777777]) {
  const s = new PlaySession(seed);
  assert(s.pickups.length > 0, `seed ${seed}: initial bands spawned`);

  // Tip a little left, then boost — should drift left.
  for (let i = 0; i < 12; i++) s.step(1 / 60, { steer: -1, thrust: false });
  assert(s.player.tilt < -0.3, `seed ${seed}: tilts left`);
  for (let i = 0; i < 45; i++) s.step(1 / 60, { steer: 0, thrust: true });
  assert(s.player.x < -5, `seed ${seed}: left attitude thrusts left (x=${s.player.x.toFixed(0)})`);

  // Straighten up and climb / chase pickups.
  let steps = 0;
  const coinsBefore = s.coins;
  while (s.player.alive && steps < 60 * 16) {
    let target = null;
    let best = Infinity;
    for (const u of s.pickups) {
      if (u.kind === 'meteor') continue;
      const d = Math.hypot(u.x - s.player.x, u.y - s.player.y);
      const score = d + (u.kind === 'fuel' ? 0 : 30);
      if (score < best) {
        best = score;
        target = u;
      }
    }
    let steer = 0;
    let thrust = s.player.fuel > 0.05;
    if (target) {
      const dx = target.x - s.player.x;
      const dy = target.y - s.player.y;
      const want = Math.atan2(dx, dy);
      const err = wrapAngle(want - s.player.tilt);
      if (err < -0.1) steer = -1;
      else if (err > 0.1) steer = 1;
    } else {
      // Prefer nose-up when hunting.
      const err = wrapAngle(0 - s.player.tilt);
      if (err < -0.12) steer = -1;
      else if (err > 0.12) steer = 1;
    }
    s.step(1 / 60, { steer, thrust });
    steps += 1;
  }

  assert(s.player.peakY > 150, `seed ${seed}: meaningful altitude`);
  assert(
    s.coins > coinsBefore || s.pickupScore > 0 || s.player.peakY > 200,
    `seed ${seed}: collected or climbed`
  );
  console.log(
    `ok: seed ${seed}: coins=${s.coins} pickupScore=${s.pickupScore} alt=${Math.floor(s.player.peakY)}`
  );
}

const a = new PlaySession(999);
const b = new PlaySession(999);
for (let i = 0; i < 60 * 3; i++) {
  a.step(1 / 60, boost);
  b.step(1 / 60, boost);
}
while (a.player.alive) a.step(1 / 60, idle);
while (b.player.alive) b.step(1 / 60, idle);
assert(
  Math.abs(a.player.peakY - b.player.peakY) < 0.001 && a.score === b.score,
  'same seed, same inputs: identical outcome'
);

// —— Upgrades ——
{
  const base = foldStats(emptyUpgrades());
  assert(base.fuelMax === 1 && base.fuelStart === 1, 'stock tank is 1.0');
  assert(base.thrustMul === 1, 'stock thrust mul is 1');
  assert(base.fuelPickupMul === 1, 'stock scoop mul is 1');
  assert(base.meteorDrainMul === 1, 'stock hull mul is 1');

  const maxed = foldStats({ tank: 5, thrust: 5, scoop: 5, hull: 5 });
  assert(maxed.fuelMax > base.fuelMax, 'tank upgrade raises fuelMax');
  assert(maxed.thrustMul > base.thrustMul, 'thrust upgrade raises thrustMul');
  assert(maxed.fuelPickupMul > base.fuelPickupMul, 'scoop upgrade raises pickup');
  assert(maxed.meteorDrainMul < base.meteorDrainMul, 'hull upgrade lowers meteor drain');

  const stock = new PlaySession(55, {}, emptyUpgrades());
  const tanker = new PlaySession(55, {}, { tank: 5 });
  assert(stock.player.fuel === 1, 'stock starts with 1 fuel');
  assert(tanker.player.fuelMax === foldStats({ tank: 5 }).fuelMax, 'tanker fuelMax applied');
  assert(tanker.player.fuel === tanker.player.fuelMax, 'tanker launches full');

  // Thrusters climb farther on the same seed / burn window.
  const slow = new PlaySession(77, {}, emptyUpgrades());
  const fast = new PlaySession(77, {}, { thrust: 5 });
  for (let i = 0; i < 60 * 3; i++) {
    slow.step(1 / 60, boost);
    fast.step(1 / 60, boost);
  }
  assert(fast.player.y > slow.player.y + 20, `thrust upgrade climbs higher (${fast.player.y.toFixed(0)} > ${slow.player.y.toFixed(0)})`);

  // Scoop: fuel pickup yields more absolute fuel.
  const scoopStats = foldStats({ scoop: 5 });
  const scooped = PICKUPS.fuel.fuelGain * scoopStats.fuelPickupMul;
  assert(scooped > PICKUPS.fuel.fuelGain, 'scoop multiplies fuel gain');

  // Hull: meteor takes less.
  const hullStats = foldStats({ hull: 5 });
  const drained = Math.abs(PICKUPS.meteor.fuelGain * hullStats.meteorDrainMul);
  assert(drained < Math.abs(PICKUPS.meteor.fuelGain), 'hull reduces meteor fuel loss');

  // Buyer spends bank coins.
  const profile = {
    bankCoins: 20,
    upgrades: emptyUpgrades(),
  };
  const bought = buyUpgrade(profile, 'tank');
  assert(bought.ok, 'can buy tank with coins');
  assert(profile.upgrades.tank === 1, 'tank level became 1');
  assert(profile.bankCoins === 20 - UPGRADES.tank.costs[0], 'coins deducted');
  const broke = buyUpgrade({ bankCoins: 0, upgrades: emptyUpgrades() }, 'tank');
  assert(!broke.ok && broke.reason === 'broke', 'cannot buy when broke');
}

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('\nAll smoke checks passed.');

