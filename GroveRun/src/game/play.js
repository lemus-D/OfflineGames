/* GroveRun simulation: lanes, jump, obstacles, carrots, fox gap.
   Fixed timestep. No Math.random — seeded RNG only. No DOM/canvas. */

import { makeRNG, clamp } from '../core/rng.js';
import {
  FIXED_DT,
  BUNNY,
  OBSTACLES,
  PICKUPS,
  FOX,
  RUN,
  LANES,
  pickObstacleKind,
  speedAt,
  scoreFromRun,
} from './content.js';

export class PlaySession {
  /**
   * @param {number} seed
   * @param {{ onDeath?: Function }} [hooks]
   */
  constructor(seed, hooks = {}) {
    this.seed = seed >>> 0;
    this.rng = makeRNG(this.seed);
    this.hooks = hooks;

    this.player = {
      lane: 0,
      /** Visual lane position (-1..1), lerps during switch. */
      lanePos: 0,
      switching: false,
      switchFrom: 0,
      switchTo: 0,
      switchT: 0,
      jumping: false,
      jumpT: 0,
      height: 0,
      alive: true,
      deathReason: null,
      invuln: 0,
    };

    this.distance = 0;
    this.time = 0;
    this.speed = RUN.baseSpeed;
    this.carrots = 0;
    this.foxGap = FOX.startGap;
    this.foxThreat = 0;
    this.simAccum = 0;
    this.renderAlpha = 0;
    this._nextId = 1;
    this._spawnAt = RUN.firstCarrotDist * 0.55;
    this._carrotGiven = false;
    this._firstCarrotAt = RUN.firstCarrotDist;
    this.entities = [];
    this.events = [];
    this.particles = [];
    this.flash = 0;
    this.nearMiss = false;
    this.summaryData = null;

    // Seed a few early entities so the path isn't empty.
    this._spawnWave(40);
    this._spawnWave(RUN.firstCarrotDist);
    this._spawnWave(RUN.firstCarrotDist + 90);
  }

  get score() {
    return scoreFromRun(this.distance, this.carrots);
  }

  /**
   * @param {number} frameDt
   * @param {{ laneDelta: number, jump: boolean }} controls
   */
  step(frameDt, controls) {
    if (!this.player.alive) {
      this.renderAlpha = 0;
      return;
    }
    const c = controls || { laneDelta: 0, jump: false };
    this.simAccum += Math.min(frameDt, 0.05);
    while (this.simAccum >= FIXED_DT) {
      this._fixedStep(FIXED_DT, c);
      this.simAccum -= FIXED_DT;
      // Edge inputs only apply once per frame request.
      c.laneDelta = 0;
      c.jump = false;
    }
    this.renderAlpha = this.simAccum / FIXED_DT;
  }

  _fixedStep(dt, controls) {
    this.time += dt;
    this.speed = speedAt(this.time);
    this.distance += this.speed * dt;

    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);
    if (this.player.invuln > 0) this.player.invuln = Math.max(0, this.player.invuln - dt);

    this._updateLane(dt, controls);
    this._updateJump(dt, controls);
    this._updateFox(dt);
    this._advanceEntities(dt);
    this._spawnAhead();
    this._collide();
    this._ageParticles(dt);

    if (this.player.alive && this.foxGap <= FOX.catchGap) {
      this._die('fox');
    }
  }

  _updateLane(dt, { laneDelta = 0 }) {
    const p = this.player;
    if (!p.switching && laneDelta !== 0) {
      const next = clamp(p.lane + (laneDelta > 0 ? 1 : -1), -1, 1);
      if (next !== p.lane) {
        p.switching = true;
        p.switchFrom = p.lanePos;
        p.switchTo = next;
        p.switchT = 0;
        p.lane = next;
        this.events.push({ kind: 'lane' });
        this._burst(0, 4, '#c4a882');
      }
    }
    if (p.switching) {
      p.switchT += dt / BUNNY.laneSwitchTime;
      if (p.switchT >= 1) {
        p.switchT = 1;
        p.switching = false;
        p.lanePos = p.switchTo;
      } else {
        const t = p.switchT;
        const ease = t * t * (3 - 2 * t);
        p.lanePos = p.switchFrom + (p.switchTo - p.switchFrom) * ease;
      }
    } else {
      p.lanePos = p.lane;
    }
  }

  _updateJump(dt, { jump = false }) {
    const p = this.player;
    if (!p.jumping && jump) {
      p.jumping = true;
      p.jumpT = 0;
      this.events.push({ kind: 'jump' });
    }
    if (p.jumping) {
      p.jumpT += dt / BUNNY.jumpDuration;
      if (p.jumpT >= 1) {
        p.jumping = false;
        p.jumpT = 0;
        p.height = 0;
      } else {
        // Parabola peak at 0.5.
        const t = p.jumpT;
        p.height = BUNNY.jumpHeight * 4 * t * (1 - t);
      }
    }
  }

  _updateFox(dt) {
    // Creep closes the gap; clean recovery opens it.
    this.foxGap -= FOX.creepPerSec * dt;
    if (this.player.invuln <= 0 && !this.nearMiss) {
      this.foxGap += FOX.recoverPerSec * dt;
    }
    this.foxGap = clamp(this.foxGap, FOX.minVisualGap, FOX.maxGap);
    this.foxThreat = clamp(1 - (this.foxGap - FOX.catchGap) / (FOX.startGap - FOX.catchGap), 0, 1);
    this.nearMiss = this.foxGap < FOX.startGap * 0.45;
    if (this.nearMiss && (Math.floor(this.time * 4) !== Math.floor((this.time - dt) * 4))) {
      this.events.push({ kind: 'threat' });
    }
  }

  _advanceEntities(dt) {
    const move = this.speed * dt;
    for (const e of this.entities) {
      e.z -= move;
    }
    this.entities = this.entities.filter((e) => e.z > -40 && !e.dead);
  }

  _spawnAhead() {
    while (this._spawnAt < this.distance + 420) {
      this._spawnWave(this._spawnAt);
      const span = RUN.spawnGapMax - RUN.spawnGapMin;
      // Tighter gaps as speed rises.
      const t = clamp((this.speed - RUN.baseSpeed) / (RUN.maxSpeed - RUN.baseSpeed), 0, 1);
      const gap = RUN.spawnGapMax - span * t * 0.7 - this.rng() * span * 0.25;
      this._spawnAt += Math.max(RUN.spawnGapMin * 0.85, gap);
    }
  }

  _spawnWave(atDist) {
    const z = atDist - this.distance + 280;
    if (z < 40) return;

    // Guarantee an early carrot on mid lane (readable first reward < 5 s).
    if (!this._carrotGiven && atDist >= this._firstCarrotAt - 5) {
      this._carrotGiven = true;
      this.entities.push({
        id: this._nextId++,
        kind: 'carrot',
        lane: 0,
        z,
        dead: false,
      });
      // Soft obstacle in a side lane so idle still fails soon after.
      const obsLane = this.rng() < 0.5 ? -1 : 1;
      this.entities.push({
        id: this._nextId++,
        kind: 'log',
        lane: obsLane,
        z: z + 70,
        dead: false,
      });
      // Mid-lane rock shortly after so standing still still dies.
      this.entities.push({
        id: this._nextId++,
        kind: 'rock',
        lane: 0,
        z: z + 130,
        dead: false,
      });
      return;
    }

    const roll = this.rng();
    if (roll < 0.38) {
      // Single obstacle.
      const kind = pickObstacleKind(this.rng);
      this.entities.push({
        id: this._nextId++,
        kind,
        lane: LANES[Math.floor(this.rng() * 3)],
        z,
        dead: false,
      });
    } else if (roll < 0.62) {
      // Two-lane block — one safe lane.
      const blocked = new Set();
      while (blocked.size < 2) blocked.add(LANES[Math.floor(this.rng() * 3)]);
      for (const lane of blocked) {
        this.entities.push({
          id: this._nextId++,
          kind: pickObstacleKind(this.rng),
          lane,
          z,
          dead: false,
        });
      }
    } else if (roll < 0.88) {
      // Carrot + optional obstacle offset.
      this.entities.push({
        id: this._nextId++,
        kind: 'carrot',
        lane: LANES[Math.floor(this.rng() * 3)],
        z,
        dead: false,
      });
      if (this.rng() < 0.55) {
        this.entities.push({
          id: this._nextId++,
          kind: pickObstacleKind(this.rng),
          lane: LANES[Math.floor(this.rng() * 3)],
          z: z + 40 + this.rng() * 30,
          dead: false,
        });
      }
    } else {
      // Empty beat — breathing room.
    }
  }

  _collide() {
    const p = this.player;
    if (!p.alive || p.invuln > 0) return;

    for (const e of this.entities) {
      if (e.dead) continue;
      if (e.z < -8 || e.z > 28) continue;
      const sameLane = Math.abs(e.lane - p.lanePos) < 0.45;
      if (!sameLane) continue;

      if (e.kind === 'carrot') {
        e.dead = true;
        this.carrots += 1;
        this.foxGap = clamp(this.foxGap + PICKUPS.carrot.gapRelief, FOX.minVisualGap, FOX.maxGap);
        this.events.push({ kind: 'carrot', lane: e.lane });
        this._burst(e.lane, 8, '#f07830');
        continue;
      }

      const def = OBSTACLES[e.kind];
      if (!def) continue;

      const jumpingClear =
        p.jumping && p.height > def.height * 0.55 && (def.dodge === 'jump' || def.dodge === 'either');

      if (jumpingClear) {
        // Cleared.
        continue;
      }

      // Hit.
      e.dead = true;
      if (def.dodge === 'lane' && def.id === 'rock') {
        this._die('obstacle');
        return;
      }
      // Soft stumble — fox closes in.
      this.foxGap -= FOX.stumbleClose;
      this.flash = 1;
      p.invuln = BUNNY.hitInvuln;
      this.events.push({ kind: 'hit', kindObs: e.kind });
      this._burst(p.lanePos, 10, '#e07040');
      if (this.foxGap <= FOX.catchGap) {
        this._die('fox');
        return;
      }
    }
  }

  _burst(lane, n, color) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        lane,
        x: (this.rng() - 0.5) * 20,
        y: this.rng() * 16,
        vx: (this.rng() - 0.5) * 80,
        vy: -20 - this.rng() * 60,
        life: 0.35 + this.rng() * 0.25,
        age: 0,
        color,
      });
    }
  }

  _ageParticles(dt) {
    for (const p of this.particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 180 * dt;
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
  }

  _die(reason) {
    if (!this.player.alive) return;
    this.player.alive = false;
    this.player.deathReason = reason;
    this.flash = 1;
    this.events.push({ kind: 'die', reason });
    this.summaryData = this.summary();
    if (this.hooks.onDeath) this.hooks.onDeath(this.summaryData);
  }

  summary() {
    return {
      score: this.score,
      distance: Math.floor(this.distance),
      carrots: this.carrots,
      time: this.time,
      reason: this.player.deathReason,
      foxGap: Math.floor(this.foxGap),
      nearMissGap: Math.floor(this.foxGap),
    };
  }

  /** Drain and clear the event queue. */
  drainEvents() {
    const out = this.events;
    this.events = [];
    return out;
  }
}
