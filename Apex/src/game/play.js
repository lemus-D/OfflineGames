/* Simulation: thrust-on-demand climb, free tilt, spawn pickups, collide.
   Fixed timestep. No Math.random() — seeded RNG only.
   World X wraps (infinite side-to-side). Asteroids damage hull; black holes pull. */

import { makeRNG, clamp } from '../core/rng.js';
import {
  FIXED_DT,
  WORLD_HALF_W,
  wrapX,
  deltaX,
  ROCKET,
  PICKUPS,
  SPAWN,
  pickupWeight,
  bandItemBudget,
  scoreFromRun,
  wrapAngle,
} from './content.js';
import { foldStats } from './upgrades.js';

function pickKind(rng, bandY) {
  const entries = Object.values(PICKUPS)
    .map((e) => ({ e, w: pickupWeight(e, bandY) }))
    .filter((row) => row.w > 0);
  let total = 0;
  for (const row of entries) total += row.w;
  let roll = rng() * total;
  for (const row of entries) {
    roll -= row.w;
    if (roll <= 0) return row.e.id;
  }
  return entries[entries.length - 1].e.id;
}

export class PlaySession {
  /**
   * @param {number} seed
   * @param {object} [hooks]
   * @param {object} [upgradesOrStats] owned levels `{tank,thrust,...}` or pre-folded stats
   */
  constructor(seed, hooks = {}, upgradesOrStats = {}) {
    this.seed = seed >>> 0;
    this.rng = makeRNG(this.seed);
    this.hooks = hooks;

    const stats =
      upgradesOrStats && typeof upgradesOrStats.fuelMax === 'number'
        ? upgradesOrStats
        : foldStats(upgradesOrStats);
    this.stats = stats;

    this.player = {
      x: 0,
      y: ROCKET.startY,
      vx: 0,
      vy: 0,
      fuel: stats.fuelStart,
      fuelMax: stats.fuelMax,
      health: stats.healthStart ?? ROCKET.startHealth,
      healthMax: stats.healthMax ?? ROCKET.healthMax,
      alive: true,
      deathReason: null,
      tilt: 0, // radians, 0 = nose up; free wrap
      thrusting: false,
      airborne: false,
      peakY: ROCKET.startY,
    };

    this.pickups = [];
    this.coins = 0;
    this.pickupScore = 0;
    this.time = 0;
    this.simAccum = 0;
    this._nextId = 1;
    this.flash = 0;
    this.collectFx = [];
    this._meteorDrain = false;
    this._hullBreach = false;
    /** @type {Set<number>} band indices that currently have pickups spawned */
    this._filledBands = new Set();

    this._ensureBandsAround(this.player.y);
  }

  get altitude() {
    return this.player.peakY;
  }

  get score() {
    return scoreFromRun(this.player.peakY, this.coins, this.pickupScore);
  }

  /**
   * @param {number} frameDt
   * @param {{ steer: number, thrust: boolean }} controls
   */
  step(frameDt, controls) {
    if (!this.player.alive) return;
    const c = controls || { steer: 0, thrust: false };
    this.simAccum += Math.min(frameDt, 0.05);
    while (this.simAccum >= FIXED_DT) {
      this._fixedStep(FIXED_DT, c);
      this.simAccum -= FIXED_DT;
    }
  }

  _fixedStep(dt, { steer = 0, thrust = false }) {
    this.time += dt;
    const p = this.player;
    const st = this.stats;

    // Free 360° rotation — hold left/right to spin the whole way.
    if (steer !== 0) {
      p.tilt += steer * ROCKET.tiltRate * dt;
      p.tilt = wrapAngle(p.tilt);
    }

    const boosting = thrust && p.fuel > 0;
    p.thrusting = boosting;

    // On the pad: no gravity until the first boost. Still free to spin.
    if (!p.airborne) {
      p.y = ROCKET.startY;
      p.vy = 0;
      p.vx = 0;
      if (!boosting) {
        this._ensureBandsAround(p.y);
        return;
      }
      p.airborne = true;
    }

    if (boosting) {
      // tilt 0 = straight up (+y); positive tilt tips nose to the right.
      const dirX = Math.sin(p.tilt);
      const dirY = Math.cos(p.tilt);
      const accel = ROCKET.thrustAccel * st.thrustMul;
      p.vx += dirX * accel * dt;
      p.vy += dirY * accel * dt;
      p.fuel -= ROCKET.burnRate * dt;
      if (p.fuel < 0) p.fuel = 0;
    }

    // Black-hole gravity before integrating position.
    if (this._applyBlackHoles(dt)) return;

    p.vy -= ROCKET.gravity * dt;

    const maxClimb = ROCKET.maxClimbSpeed * st.maxClimbMul;
    const maxSpeed = ROCKET.maxSpeed * st.maxSpeedMul;
    p.vy = clamp(p.vy, -ROCKET.maxFallSpeed, maxClimb);
    const spd = Math.hypot(p.vx, p.vy);
    if (spd > maxSpeed) {
      p.vx = (p.vx / spd) * maxSpeed;
      p.vy = (p.vy / spd) * maxSpeed;
    }
    p.vx *= Math.pow(ROCKET.drag, dt * 60);

    p.x = wrapX(p.x + p.vx * dt);
    p.y += p.vy * dt;

    if (p.y <= 0) {
      p.y = 0;
      p.alive = false;
      p.deathReason = this._hullBreach
        ? 'hull'
        : this._meteorDrain
          ? 'meteor'
          : p.fuel <= 0
            ? 'fuel'
            : 'crash';
      this.hooks.onDeath?.(this.summary());
      return;
    }

    if (p.y > p.peakY) p.peakY = p.y;

    // Keep pickups above AND below so falling runs can still scoop fuel/coins.
    this._ensureBandsAround(p.y);

    for (const u of this.pickups) {
      if (u.kind === 'meteor') {
        u.x = wrapX(u.x + u.driftX * dt);
        u.y += u.driftY * dt;
      } else if (u.kind === 'blackhole') {
        u.spin += u.spinRate * dt;
        continue;
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

  /**
   * Pull the ship toward nearby black holes. Returns true if the run ended.
   */
  _applyBlackHoles(dt) {
    const p = this.player;
    for (const u of this.pickups) {
      if (u.kind !== 'blackhole') continue;
      const def = PICKUPS.blackhole;
      const dx = deltaX(p.x, u.x);
      const dy = u.y - p.y;
      const dist = Math.hypot(dx, dy);
      const horizon = u.r * (def.horizonMul || 0.4);
      if (dist < horizon + ROCKET.radius * 0.35) {
        p.alive = false;
        p.deathReason = 'blackhole';
        this.flash = 0.35;
        this.hooks.onDeath?.(this.summary());
        return true;
      }
      if (dist < 1 || dist > u.r * 6.5) continue;
      const pull = def.pull || 22000;
      const accel = Math.min(def.pullCap || 900, pull / (dist * dist));
      p.vx += (dx / dist) * accel * dt;
      p.vy += (dy / dist) * accel * dt;
    }
    return false;
  }

  _bandIndex(y) {
    return Math.floor(y / SPAWN.bandGap);
  }

  _ensureBandsAround(y) {
    const lo = this._bandIndex(Math.max(0, y - SPAWN.behind));
    const hi = this._bandIndex(y + SPAWN.ahead);
    for (let i = lo; i <= hi; i++) {
      if (i < 0 || this._filledBands.has(i)) continue;
      this._filledBands.add(i);
      this._spawnBandAt(i * SPAWN.bandGap);
    }
  }

  _spawnBandAt(bandY) {
    const n = bandItemBudget(this.rng, bandY);
    const used = [];
    for (let i = 0; i < n; i++) {
      const kind = pickKind(this.rng, bandY);
      const def = PICKUPS[kind];
      let x = (this.rng() * 2 - 1) * WORLD_HALF_W * SPAWN.spread;
      for (let tries = 0; tries < 6; tries++) {
        if (used.every((ux) => Math.abs(deltaX(ux, x)) > 36)) break;
        x = (this.rng() * 2 - 1) * WORLD_HALF_W * SPAWN.spread;
      }
      used.push(x);
      const y = bandY + (this.rng() - 0.5) * 28;
      if (y < 40) continue; // keep clear of the pad
      // Black holes need breathing room — skip crowded / low bands.
      if (kind === 'blackhole' && y < (def.minY || 900)) continue;
      this.pickups.push({
        id: this._nextId++,
        kind,
        x: wrapX(x),
        y,
        r: def.radius * (0.85 + this.rng() * 0.3),
        spin: this.rng() * Math.PI * 2,
        spinRate:
          kind === 'meteor'
            ? (this.rng() - 0.5) * 3
            : kind === 'blackhole'
              ? 1.2 + this.rng() * 1.5
              : 0,
        driftX: kind === 'meteor' ? (this.rng() - 0.5) * 40 : 0,
        driftY: kind === 'meteor' ? -20 - this.rng() * 40 : 0,
        band: this._bandIndex(bandY),
      });
    }
  }

  _collide() {
    const p = this.player;
    const st = this.stats;
    const pr = ROCKET.radius;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const u = this.pickups[i];
      // Black holes are field hazards — handled in _applyBlackHoles.
      if (u.kind === 'blackhole') continue;

      const dx = deltaX(p.x, u.x);
      const dy = u.y - p.y;
      const hitR = pr + u.r * 0.75;
      if (dx * dx + dy * dy > hitR * hitR) continue;

      const def = PICKUPS[u.kind];
      let gain = def.fuelGain;
      if (gain > 0) gain *= st.fuelPickupMul;
      else if (gain < 0) gain *= st.meteorDrainMul;
      p.fuel = clamp(p.fuel + gain, 0, p.fuelMax);

      if (def.healthDamage > 0) {
        const dmg = def.healthDamage * (st.healthDamageMul ?? 1);
        p.health = clamp(p.health - dmg, 0, p.healthMax);
        this.flash = 0.22;
        this._hullBreach = true;
        this._meteorDrain = true;
        this.hooks.onMeteor?.();
        if (p.health <= 0) {
          p.alive = false;
          p.deathReason = 'hull';
          this.collectFx.push({
            x: u.x,
            y: u.y,
            kind: u.kind,
            age: 0,
            life: 0.35,
          });
          this.pickups.splice(i, 1);
          this.hooks.onDeath?.(this.summary());
          return;
        }
      }

      this.pickupScore += def.score;
      if (u.kind === 'coin') {
        this.coins += 1;
        this.hooks.onCoin?.();
      } else if (u.kind === 'fuel') {
        this.hooks.onFuel?.();
      } else if (u.kind === 'meteor') {
        // flash / flags already set above when healthDamage applies
        if (!(def.healthDamage > 0)) {
          this.flash = 0.22;
          this._meteorDrain = true;
          this.hooks.onMeteor?.();
        }
      }

      this.collectFx.push({
        x: u.x,
        y: u.y,
        kind: u.kind,
        age: 0,
        life: 0.35,
      });
      this.pickups.splice(i, 1);
    }
  }

  _cull() {
    const y = this.player.y;
    const lo = y - SPAWN.behind - SPAWN.cullPad;
    const hi = y + SPAWN.ahead + SPAWN.cullPad;
    this.pickups = this.pickups.filter((u) => u.y >= lo && u.y <= hi);

    // Forget band markers outside the window so descent can refill them.
    const minB = this._bandIndex(Math.max(0, lo)) - 1;
    const maxB = this._bandIndex(hi) + 1;
    for (const b of [...this._filledBands]) {
      if (b < minB || b > maxB) this._filledBands.delete(b);
    }
  }

  summary() {
    return {
      score: this.score,
      altitude: Math.floor(this.player.peakY),
      coins: this.coins,
      time: this.time,
      reason: this.player.deathReason || 'crash',
    };
  }
}
