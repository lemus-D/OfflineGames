/* Simulation: climb, steer, spawn pickups, collide.
   Fixed timestep. No Math.random() — seeded RNG only. */

import { makeRNG, clamp } from '../core/rng.js';
import {
  FIXED_DT,
  WORLD_HALF_W,
  ROCKET,
  PICKUPS,
  SPAWN,
  scoreFromRun,
} from './content.js';

function pickKind(rng) {
  const entries = Object.values(PICKUPS);
  let total = 0;
  for (const e of entries) total += e.weight;
  let roll = rng() * total;
  for (const e of entries) {
    roll -= e.weight;
    if (roll <= 0) return e.id;
  }
  return entries[entries.length - 1].id;
}

export class PlaySession {
  constructor(seed, hooks = {}) {
    this.seed = seed >>> 0;
    this.rng = makeRNG(this.seed);
    this.hooks = hooks;

    this.player = {
      x: 0,
      y: 0, // altitude — increases as we climb
      vx: 0,
      fuel: ROCKET.startFuel,
      alive: true,
      deathReason: null,
      tilt: 0, // visual lean
    };

    this.pickups = [];
    this.coins = 0;
    this.pickupScore = 0;
    this.time = 0;
    this.simAccum = 0;
    this._nextBandY = 120;
    this._nextId = 1;
    this.flash = 0; // hit flash timer
    this.collectFx = [];

    // Seed a few bands so the first screen isn't empty.
    while (this._nextBandY < SPAWN.ahead) this._spawnBand(this._nextBandY);
  }

  get altitude() {
    return this.player.y;
  }

  get score() {
    return scoreFromRun(this.player.y, this.coins, this.pickupScore);
  }

  step(frameDt, steer) {
    if (!this.player.alive) return;
    this.simAccum += Math.min(frameDt, 0.05);
    while (this.simAccum >= FIXED_DT) {
      this._fixedStep(FIXED_DT, steer);
      this.simAccum -= FIXED_DT;
    }
  }

  _fixedStep(dt, steer) {
    this.time += dt;
    const p = this.player;

    // Climb + lateral steer.
    p.y += ROCKET.climbSpeed * dt;
    p.vx += steer * ROCKET.steerAccel * dt;
    p.vx = clamp(p.vx, -ROCKET.maxSteerSpeed, ROCKET.maxSteerSpeed);
    p.vx *= Math.pow(ROCKET.drag, dt * 60);
    p.x += p.vx * dt;

    if (p.x < -WORLD_HALF_W) {
      p.x = -WORLD_HALF_W;
      p.vx = Math.abs(p.vx) * 0.35;
    } else if (p.x > WORLD_HALF_W) {
      p.x = WORLD_HALF_W;
      p.vx = -Math.abs(p.vx) * 0.35;
    }

    p.tilt = lerpTilt(p.tilt, clamp(p.vx / ROCKET.maxSteerSpeed, -1, 1), dt * 10);

    // Burn fuel while climbing.
    p.fuel -= ROCKET.burnRate * dt;
    if (p.fuel <= 0) {
      p.fuel = 0;
      p.alive = false;
      p.deathReason = 'fuel';
      this.hooks.onDeath?.(this.summary());
      return;
    }

    // Spawn bands ahead.
    while (this._nextBandY < p.y + SPAWN.ahead) {
      this._spawnBand(this._nextBandY);
    }

    // Move meteors slightly (drift).
    for (const u of this.pickups) {
      if (u.kind === 'meteor') {
        u.x += u.driftX * dt;
        u.y += u.driftY * dt;
        if (u.x < -WORLD_HALF_W - 40) u.x = WORLD_HALF_W + 40;
        if (u.x > WORLD_HALF_W + 40) u.x = -WORLD_HALF_W - 40;
      }
      u.spin += u.spinRate * dt;
    }

    this._collide();
    this._cull();

    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);
    for (let i = this.collectFx.length - 1; i >= 0; i--) {
      this.collectFx[i].age += dt;
      if (this.collectFx[i].age >= this.collectFx[i].life) this.collectFx.splice(i, 1);
    }
  }

  _spawnBand(bandY) {
    const n =
      SPAWN.perBandMin +
      Math.floor(this.rng() * (SPAWN.perBandMax - SPAWN.perBandMin + 1));
    const used = [];
    for (let i = 0; i < n; i++) {
      const kind = pickKind(this.rng);
      const def = PICKUPS[kind];
      let x = (this.rng() * 2 - 1) * WORLD_HALF_W * SPAWN.spread;
      // Soft separation so items in a band don't stack.
      for (let tries = 0; tries < 6; tries++) {
        if (used.every((ux) => Math.abs(ux - x) > 36)) break;
        x = (this.rng() * 2 - 1) * WORLD_HALF_W * SPAWN.spread;
      }
      used.push(x);
      const y = bandY + (this.rng() - 0.5) * 28;
      this.pickups.push({
        id: this._nextId++,
        kind,
        x,
        y,
        r: def.radius * (0.85 + this.rng() * 0.3),
        spin: this.rng() * Math.PI * 2,
        spinRate: (this.rng() - 0.5) * 4,
        driftX: kind === 'meteor' ? (this.rng() - 0.5) * 40 : 0,
        driftY: kind === 'meteor' ? -20 - this.rng() * 40 : 0,
      });
    }
    this._nextBandY += SPAWN.bandGap * (0.85 + this.rng() * 0.35);
  }

  _collide() {
    const p = this.player;
    const pr = ROCKET.radius;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const u = this.pickups[i];
      const dx = u.x - p.x;
      const dy = u.y - p.y;
      const hitR = pr + u.r * 0.75;
      if (dx * dx + dy * dy > hitR * hitR) continue;

      const def = PICKUPS[u.kind];
      p.fuel = clamp(p.fuel + def.fuelGain, 0, 1.15);
      this.pickupScore += def.score;
      if (u.kind === 'coin') {
        this.coins += 1;
        this.hooks.onCoin?.();
      } else if (u.kind === 'fuel') {
        this.hooks.onFuel?.();
      } else if (u.kind === 'meteor') {
        this.flash = 0.22;
        this.hooks.onMeteor?.();
      }

      this.collectFx.push({
        x: u.x,
        y: u.y,
        kind: u.kind,
        age: 0,
        life: 0.35,
      });
      this.pickups.splice(i, 1);

      if (p.fuel <= 0) {
        p.fuel = 0;
        p.alive = false;
        p.deathReason = 'meteor';
        this.hooks.onDeath?.(this.summary());
        return;
      }
    }
  }

  _cull() {
    const floor = this.player.y - SPAWN.cullBelow;
    this.pickups = this.pickups.filter((u) => u.y > floor);
  }

  summary() {
    return {
      score: this.score,
      altitude: Math.floor(this.player.y),
      coins: this.coins,
      time: this.time,
      reason: this.player.deathReason || 'fuel',
    };
  }
}

function lerpTilt(a, b, t) {
  return a + (b - a) * clamp(t, 0, 1);
}
