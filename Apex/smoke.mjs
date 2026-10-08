#!/usr/bin/env node
/* Headless smoke: thrust climb, free tilt, fall collects, upgrades, wrap, hull, holes. */
import { readFileSync } from 'node:fs';
import { PlaySession } from './src/game/play.js';
import {
  ROCKET,
  PICKUPS,
  WORLD_HALF_W,
  wrapX,
  deltaX,
  wrapAngle,
  tiltDegrees,
  pickupWeight,
  bandItemBudget,
  HAZARD_SCALE,
  SPAWN,
} from './src/game/content.js';
import { makeRNG } from './src/core/rng.js';
import {
  gameToKm,
  CELESTIAL,
  ATM_GAME_UNITS,
  ATM_KM,
  layerAtKm,
  nextCelestial,
  bodyVisualScale,
} from './src/game/altitude.js';
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

assert(Math.abs(wrapX(WORLD_HALF_W) + WORLD_HALF_W) < 1e-9, 'wrapX at +half → -half');
assert(Math.abs(wrapX(-WORLD_HALF_W - 10) - (WORLD_HALF_W - 10)) < 1e-6, 'wrapX negative side');
assert(Math.abs(deltaX(-200, 200)) < Math.abs(200 - -200), 'deltaX prefers short wrap');
assert(PICKUPS.meteor.healthDamage > 0, 'meteors deal hull damage');
assert(PICKUPS.blackhole.pull > 0, 'black holes have pull');
assert(PICKUPS.blackhole.minY > 0, 'black holes spawn above pad');

{
  const mLow = pickupWeight(PICKUPS.meteor, 0);
  const mMid = pickupWeight(PICKUPS.meteor, (HAZARD_SCALE.meteorStartY + HAZARD_SCALE.meteorFullY) / 2);
  const mHigh = pickupWeight(PICKUPS.meteor, HAZARD_SCALE.meteorFullY);
  assert(mLow < mMid && mMid < mHigh, 'meteor weight ramps with altitude');
  assert(pickupWeight(PICKUPS.blackhole, 100) === 0, 'no black holes near pad');
  const bLow = pickupWeight(PICKUPS.blackhole, PICKUPS.blackhole.minY);
  const bHigh = pickupWeight(PICKUPS.blackhole, HAZARD_SCALE.blackholeFullY);
  assert(bLow < bHigh, 'blackhole weight ramps after unlock');
  const rng = makeRNG(99);
  let sawDense = false;
  for (let i = 0; i < 80; i++) {
    if (bandItemBudget(rng, HAZARD_SCALE.densifyFullY) > SPAWN.perBandMax) {
      sawDense = true;
      break;
    }
  }
  assert(sawDense, 'high bands sometimes exceed low perBandMax');
}

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
for (const need of [
  'moon',
  'venus',
  'mars',
  'mercury',
  'sun',
  'belt',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
]) {
  assert(ids.has(need), `celestial catalog includes ${need}`);
}
assert(
  CELESTIAL.find((c) => c.id === 'venus').realKm <
    CELESTIAL.find((c) => c.id === 'mercury').realKm,
  'Venus closer than Mercury at closest approach'
);
assert(
  CELESTIAL.find((c) => c.id === 'mars').gameY <
    CELESTIAL.find((c) => c.id === 'mercury').gameY,
  'Mars before Mercury in climb order'
);
assert(gameToKm(100) < gameToKm(1000), 'gameToKm monotonic');
assert(gameToKm(CELESTIAL[0].gameY) < gameToKm(CELESTIAL[CELESTIAL.length - 1].gameY), 'moon km < pluto km');

{
  const moon = CELESTIAL.find((c) => c.id === 'moon');
  const jupiter = CELESTIAL.find((c) => c.id === 'jupiter');
  const sun = CELESTIAL.find((c) => c.id === 'sun');
  const pluto = CELESTIAL.find((c) => c.id === 'pluto');
  assert(moon.radiusKm > 0 && jupiter.radiusKm > moon.radiusKm, 'Jupiter radius > Moon');
  assert(sun.radiusKm > jupiter.radiusKm, 'Sun radius > Jupiter');
  assert(
    bodyVisualScale(sun.radiusKm) > bodyVisualScale(jupiter.radiusKm) &&
      bodyVisualScale(jupiter.radiusKm) > bodyVisualScale(moon.radiusKm) &&
      bodyVisualScale(moon.radiusKm) > bodyVisualScale(pluto.radiusKm),
    'visual scales ordered Sun > Jupiter > Moon > Pluto'
  );
}

{
  const fromPad = nextCelestial(0);
  assert(fromPad.body?.id === 'moon', 'from pad, next is Moon');
  assert(fromPad.remainKm > 1e5, 'Moon is far from the pad in story-km');
  const mid = nextCelestial((CELESTIAL[0].gameY + CELESTIAL[1].gameY) / 2);
  assert(mid.body?.id === 'venus', 'after Moon, next is Venus');
  const past = nextCelestial(CELESTIAL[CELESTIAL.length - 1].gameY + 10);
  assert(past.body == null, 'past Pluto, no next body');
}

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

// Side-to-side wrap: fly hard sideways and stay inside world half-width.
{
  const s = new PlaySession(19);
  for (let i = 0; i < 20; i++) s.step(1 / 60, { steer: 1, thrust: false });
  for (let i = 0; i < 60 * 4; i++) s.step(1 / 60, { steer: 0, thrust: true });
  assert(s.player.airborne, 'side fly left the pad');
  assert(
    s.player.x >= -WORLD_HALF_W - 0.01 && s.player.x < WORLD_HALF_W + 0.01,
    `player X wrapped into band (x=${s.player.x.toFixed(1)})`
  );
}

// Hull damage from asteroids ends the run when health hits 0.
{
  const s = new PlaySession(21);
  s.player.airborne = true;
  s.player.y = 200;
  s.player.peakY = 200;
  const before = s.player.health;
  s.pickups = [
    {
      id: 999,
      kind: 'meteor',
      x: s.player.x,
      y: s.player.y,
      r: 20,
      spin: 0,
      spinRate: 0,
      driftX: 0,
      driftY: 0,
      band: 0,
    },
  ];
  s.step(1 / 60, idle);
  assert(s.player.health < before, 'meteor chips hull');
  // Stack enough hits to kill.
  for (let i = 0; i < 8 && s.player.alive; i++) {
    s.pickups.push({
      id: 1000 + i,
      kind: 'meteor',
      x: s.player.x,
      y: s.player.y,
      r: 20,
      spin: 0,
      spinRate: 0,
      driftX: 0,
      driftY: 0,
      band: 0,
    });
    s.step(1 / 60, idle);
  }
  assert(!s.player.alive, 'hull breach ends run');
  assert(s.player.deathReason === 'hull', 'death reason is hull');
}

// Black hole pull + event-horizon kill.
{
  const s = new PlaySession(33);
  s.player.airborne = true;
  s.player.y = 1200;
  s.player.peakY = 1200;
  s.player.vx = 0;
  s.player.vy = 0;
  s.pickups = [
    {
      id: 1,
      kind: 'blackhole',
      x: s.player.x + 4,
      y: s.player.y + 4,
      r: 42,
      spin: 0,
      spinRate: 1,
      driftX: 0,
      driftY: 0,
      band: 0,
    },
  ];
  s.step(1 / 60, idle);
  assert(!s.player.alive, 'event horizon kills');
  assert(s.player.deathReason === 'blackhole', 'death reason is blackhole');
}

// Soft pull changes velocity when outside the horizon.
{
  const s = new PlaySession(34);
  s.player.airborne = true;
  s.player.y = 1200;
  s.player.peakY = 1200;
  s.player.vx = 0;
  s.player.vy = 0;
  s.pickups = [
    {
      id: 2,
      kind: 'blackhole',
      x: s.player.x + 90,
      y: s.player.y,
      r: 42,
      spin: 0,
      spinRate: 1,
      driftX: 0,
      driftY: 0,
      band: 0,
    },
  ];
  for (let i = 0; i < 8; i++) s.step(1 / 60, idle);
  assert(s.player.alive, 'far from horizon stays alive');
  assert(s.player.vx > 1, `black hole pulls sideways (vx=${s.player.vx.toFixed(2)})`);
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
  assert(base.healthMax === 1 && base.healthStart === 1, 'stock hull is 1.0');
  assert(base.thrustMul === 1, 'stock thrust mul is 1');
  assert(base.fuelPickupMul === 1, 'stock scoop mul is 1');
  assert(base.meteorDrainMul === 1, 'stock meteor drain mul is 1');
  assert(base.healthDamageMul === 1, 'stock health damage mul is 1');

  const maxed = foldStats({ tank: 5, thrust: 5, scoop: 5, hull: 5 });
  assert(maxed.fuelMax > base.fuelMax, 'tank upgrade raises fuelMax');
  assert(maxed.thrustMul > base.thrustMul, 'thrust upgrade raises thrustMul');
  assert(maxed.fuelPickupMul > base.fuelPickupMul, 'scoop upgrade raises pickup');
  assert(maxed.meteorDrainMul < base.meteorDrainMul, 'hull upgrade lowers meteor drain');
  assert(maxed.healthMax > base.healthMax, 'hull upgrade raises healthMax');
  assert(maxed.healthDamageMul < base.healthDamageMul, 'hull upgrade lowers health damage');

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
  assert(fast.player.y > slow.player.y + 8, `thrust upgrade climbs higher (${fast.player.y.toFixed(0)} > ${slow.player.y.toFixed(0)})`);

  // Scoop: fuel pickup yields more absolute fuel.
  const scoopStats = foldStats({ scoop: 5 });
  const scooped = PICKUPS.fuel.fuelGain * scoopStats.fuelPickupMul;
  assert(scooped > PICKUPS.fuel.fuelGain, 'scoop multiplies fuel gain');

  // Hull: meteor takes less fuel splash and less hull damage.
  const hullStats = foldStats({ hull: 5 });
  const drained = Math.abs(PICKUPS.meteor.fuelGain * hullStats.meteorDrainMul);
  assert(drained < Math.abs(PICKUPS.meteor.fuelGain), 'hull reduces meteor fuel loss');
  const dmg =
    PICKUPS.meteor.healthDamage * hullStats.healthDamageMul;
  assert(dmg < PICKUPS.meteor.healthDamage, 'hull reduces asteroid hull damage');

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

