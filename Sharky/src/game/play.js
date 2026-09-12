/* Simulation: movement, spawning, collision, hunger.
   Fixed timestep. No Math.random() — seeded RNG only. */

import { makeRNG, clamp, lerp } from '../core/rng.js';
import {
  ANIMALS,
  FAUNA,
  GROWTH_MILESTONES,
  foldStats,
  draftUpgrades,
  speciesFromFauna,
} from './content.js';
import { lengthFromMass } from './creature.js';

const FIXED_DT = 1 / 60;
const WORLD_FLOOR = 2200;
const WORLD_CEIL = 40;
const SPAWN_MARGIN = 520;
/** Seconds after dive-in before predators may chase or kill. */
const SPAWN_GRACE = 4.5;
/** After grace, keep predator spawns rare until the player has settled in. */
const EARLY_PREY_WINDOW = 14;
/** Minimum spawn distance for predators (world px). */
const PREDATOR_MIN_SPAWN_DIST = SPAWN_MARGIN * 1.15;

export class PlaySession {
  constructor(animalId, seed, hooks = {}) {
    this.animalId = animalId;
    this.animal = ANIMALS[animalId];
    this.seed = seed >>> 0;
    this.rng = makeRNG(this.seed);
    this.hooks = hooks;

    this.upgrades = [];
    this.stats = foldStats(animalId, this.upgrades);
    this.milestonesHit = new Set();

    this.player = {
      x: 0,
      y: 900,
      vx: 0,
      vy: 0,
      mass: 1,
      facing: 1,
      hunger: 1,
      alive: true,
      deathReason: null,
      secondWindUsed: false,
      panicUntil: 0,
      stunPulseUntil: 0,
    };

    this.creatures = [];
    this.score = 0;
    this.eaten = 0;
    this.time = 0;
    this.simAccum = 0;
    this.paused = false;
    this.draft = null; // { picks: Upgrade[] } while choosing
    this.camera = { x: 0, y: 900, zoom: 1 };
    // Delay first ambient spawn so dive-in is not a predator drop.
    this._spawnTimer = SPAWN_GRACE * 0.45;
    this._nextId = 1;
    this._graceUntil = SPAWN_GRACE;

    // Seed initial school — prey only (see _spawnNear).
    for (let i = 0; i < 28; i++) this._spawnNear(true);
  }

  get length() {
    return lengthFromMass(this.player.mass);
  }

  topSpeed() {
    // Base cruise scales gently with size so big animals cover water, but
    // turn rate penalty below is the real trade.
    return 210 * this.stats.speed * (0.85 + 0.15 / Math.sqrt(this.player.mass));
  }

  turnRate() {
    return 4.2 * this.stats.turn * (1 / Math.pow(this.player.mass, 0.35));
  }

  /** Screen-space aim from input; screen player pos provided by main. */
  step(frameDt, aim) {
    if (!this.player.alive) return;
    if (this.draft) return;

    this.simAccum += Math.min(frameDt, 0.05);
    while (this.simAccum >= FIXED_DT) {
      this._fixedStep(FIXED_DT, aim);
      this.simAccum -= FIXED_DT;
    }
    this._updateCamera(frameDt);
  }

  _fixedStep(dt, aim) {
    this.time += dt;
    const p = this.player;
    const len = this.length;
    const top = this.topSpeed();

    let ax = 0,
      ay = 0;
    if (aim.mag > 8) {
      ax = aim.ax / aim.mag;
      ay = aim.ay / aim.mag;
    }

    const boosting =
      aim.boost && (p.panicUntil > this.time || p.hunger > 0.08);
    const boostMul = boosting ? 1.55 * this.stats.boostAccel : 1;
    if (boosting && p.panicUntil <= this.time) {
      p.hunger = Math.max(0, p.hunger - dt * 0.22 * this.stats.boostCost);
    }
    if (boosting && this.stats.boostStun > 0) {
      p.stunPulseUntil = this.time + this.stats.boostStun;
    }

    // Acceleration + drag (water feel).
    const accel = top * 2.4 * boostMul;
    p.vx += ax * accel * dt;
    p.vy += ay * accel * dt;
    const drag = Math.pow(0.984, boostMul > 1 ? 0.7 : 1);
    // Approximate continuous drag for fixed dt.
    const damp = Math.pow(drag, dt * 60);
    p.vx *= damp;
    p.vy *= damp;

    // Soft speed clamp.
    const spd = Math.hypot(p.vx, p.vy);
    const maxSpd = top * boostMul;
    if (spd > maxSpd) {
      p.vx = (p.vx / spd) * maxSpd;
      p.vy = (p.vy / spd) * maxSpd;
    }

    // Turn facing toward velocity / aim.
    if (ax !== 0 || Math.abs(p.vx) > 12) {
      const want = ax !== 0 ? Math.sign(ax) : Math.sign(p.vx);
      if (want !== 0) p.facing = want;
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.y = clamp(p.y, WORLD_CEIL + len * 0.3, WORLD_FLOOR - len * 0.25);

    // Hunger drain.
    p.hunger -= dt * 0.028 * this.stats.hungerDrain;
    if (p.hunger <= 0) {
      p.hunger = 0;
      this._kill('starved');
      return;
    }

    this._updateCreatures(dt, len);
    this._spawnTimer -= dt;
    if (this._spawnTimer <= 0) {
      this._spawnNear(false);
      this._spawnTimer = lerp(0.35, 0.9, this.rng());
    }
    this._collide(len);
    this._checkMilestones();
  }

  _updateCamera(frameDt) {
    const p = this.player;
    const lead = 0.35;
    const targetX = p.x + p.vx * lead;
    const targetY = p.y + p.vy * lead * 0.6;
    // Pull back as the player grows.
    const targetZoom = clamp(1.15 / Math.pow(this.player.mass, 0.22), 0.45, 1.2);
    const k = 1 - Math.pow(0.001, frameDt);
    this.camera.x += (targetX - this.camera.x) * k;
    this.camera.y += (targetY - this.camera.y) * k;
    this.camera.zoom += (targetZoom - this.camera.zoom) * k * 0.6;
  }

  _spawnNear(initial) {
    const p = this.player;
    const ang = this.rng() * Math.PI * 2;

    // Bias fauna band toward current mass. Initial school is prey-only so
    // dive-in never places a lethal predator on top of the player.
    const roll = this.rng();
    const early = !initial && this.time < EARLY_PREY_WINDOW;
    let template;
    if (initial || early || roll < 0.72) {
      template = FAUNA[(this.rng() * 4) | 0]; // prey tiers 0–3
    } else if (roll < 0.9) {
      template = FAUNA[4 + ((this.rng() * 2) | 0)]; // barracuda / mako
    } else {
      template = FAUNA[4 + ((this.rng() * 3) | 0)]; // barracuda–leviathan
    }

    let dist = initial
      ? 160 + this.rng() * 680
      : SPAWN_MARGIN * (0.7 + this.rng() * 0.8);
    if (template.kind === 'predator') {
      dist = Math.max(dist, PREDATOR_MIN_SPAWN_DIST);
    }

    const x = p.x + Math.cos(ang) * dist;
    const y = clamp(
      p.y + Math.sin(ang) * dist * 0.7,
      WORLD_CEIL + 60,
      WORLD_FLOOR - 80
    );

    const rel = lerp(template.massMin, template.massMax, this.rng());
    const mass = Math.max(0.05, p.mass * rel);
    const seed = (this.rng() * 0xffffffff) | 0;
    const species = speciesFromFauna(template, seed, this.rng);
    if (template.kind === 'predator') species.jaw = Math.max(species.jaw, 0.75);

    const facing = this.rng() < 0.5 ? -1 : 1;
    this.creatures.push({
      id: this._nextId++,
      kind: template.kind,
      name: template.name,
      x,
      y,
      vx: facing * (40 + this.rng() * 80) * template.speed,
      vy: (this.rng() - 0.5) * 30,
      mass,
      facing,
      species,
      speedMul: template.speed,
      stunnedUntil: 0,
    });

    // Cap population.
    if (this.creatures.length > 55) {
      this.creatures.sort(
        (a, b) =>
          Math.hypot(b.x - p.x, b.y - p.y) - Math.hypot(a.x - p.x, a.y - p.y)
      );
      this.creatures.length = 50;
    }
  }

  _updateCreatures(dt, playerLen) {
    const p = this.player;
    for (const c of this.creatures) {
      if (c.stunnedUntil > this.time) {
        c.vx *= 0.9;
        c.vy *= 0.9;
      } else if (
        c.kind === 'predator' &&
        this.time >= this._graceUntil &&
        c.mass > p.mass * this.stats.predatorAdvantage * 0.95
      ) {
        // Chase player (after spawn grace).
        const dx = p.x - c.x,
          dy = p.y - c.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < 900) {
          const chase = 160 * c.speedMul;
          c.vx += (dx / d) * chase * dt;
          c.vy += (dy / d) * chase * dt;
        }
      } else {
        // Wander / flee if smaller than player and close.
        const dx = p.x - c.x,
          dy = p.y - c.y;
        const d = Math.hypot(dx, dy) || 1;
        if (c.mass < p.mass * this.stats.biteRatio && d < 280) {
          c.vx -= (dx / d) * 200 * dt;
          c.vy -= (dy / d) * 200 * dt;
        } else {
          c.vy += Math.sin(this.time * 1.3 + c.id) * 20 * dt;
        }
      }

      const max = 140 * c.speedMul;
      const spd = Math.hypot(c.vx, c.vy);
      if (spd > max) {
        c.vx = (c.vx / spd) * max;
        c.vy = (c.vy / spd) * max;
      }
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.y = clamp(c.y, WORLD_CEIL + 40, WORLD_FLOOR - 40);
      if (Math.abs(c.vx) > 8) c.facing = Math.sign(c.vx);

      // Stun pulse from shrimp boost.
      if (p.stunPulseUntil > this.time && c.kind === 'predator') {
        const d = Math.hypot(c.x - p.x, c.y - p.y);
        if (d < playerLen * 2.2) c.stunnedUntil = this.time + 1.4;
      }
    }

    // Despawn far ones.
    this.creatures = this.creatures.filter((c) => {
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      return d < SPAWN_MARGIN * 2.4;
    });
  }

  _collide(playerLen) {
    const p = this.player;
    const bite = this.stats.biteRatio;
    const remain = [];

    for (const c of this.creatures) {
      const clen = lengthFromMass(c.mass);
      const dist = Math.hypot(c.x - p.x, c.y - p.y);
      const hitR = (playerLen + clen) * 0.28;
      if (dist > hitR) {
        remain.push(c);
        continue;
      }

      if (c.mass <= p.mass * bite) {
        // Eat.
        const gain = c.mass * 0.22 * this.stats.growthMul;
        const oversize = c.mass > p.mass;
        p.mass += gain;
        p.hunger = Math.min(1, p.hunger + 0.28 + (c.mass / p.mass) * 0.2);
        if (oversize && this.stats.oversizeHeal) {
          p.hunger = Math.min(1, p.hunger + this.stats.oversizeHeal);
        }
        this.score += Math.round(10 + c.mass * 40);
        this.eaten += 1;
        this.hooks.onEat?.(c, oversize);
        continue;
      }

      // Predator contact — only true predators can swallow the player.
      // Oversized prey (e.g. grouper just above bite mass) must not kill.
      if (
        c.kind === 'predator' &&
        c.mass >= p.mass * this.stats.predatorAdvantage
      ) {
        // Spawn grace: contact knocks back but does not kill.
        if (this.time < this._graceUntil) {
          const dx = c.x - p.x,
            dy = c.y - p.y;
          const d = Math.hypot(dx, dy) || 1;
          c.vx += (dx / d) * 180;
          c.vy += (dy / d) * 180;
          p.vx -= (dx / d) * 120;
          p.vy -= (dy / d) * 120;
          remain.push(c);
          continue;
        }
        if (this.stats.secondWind && !p.secondWindUsed) {
          p.secondWindUsed = true;
          p.hunger = Math.max(p.hunger, 0.35);
          if (this.stats.panicDash) p.panicUntil = this.time + 2;
          // Knock back predator.
          const dx = c.x - p.x,
            dy = c.y - p.y;
          const d = Math.hypot(dx, dy) || 1;
          c.vx += (dx / d) * 220;
          c.vy += (dy / d) * 220;
          p.vx -= (dx / d) * 180;
          p.vy -= (dy / d) * 180;
          this.hooks.onHurt?.();
          remain.push(c);
          continue;
        }
        this._kill('eaten');
        remain.push(c);
        return;
      }

      remain.push(c);
    }
    this.creatures = remain;
  }

  _checkMilestones() {
    for (const m of GROWTH_MILESTONES) {
      if (this.player.mass >= m && !this.milestonesHit.has(m)) {
        this.milestonesHit.add(m);
        const picks = draftUpgrades(this.animalId, this.upgrades, this.rng);
        if (picks.length) {
          this.draft = { picks, milestone: m };
          this.hooks.onDraft?.(picks);
        }
        break;
      }
    }
  }

  chooseUpgrade(upgradeId) {
    if (!this.draft) return;
    const pick = this.draft.picks.find((u) => u.id === upgradeId);
    if (!pick) return;
    this.upgrades.push(pick.id);
    this.stats = foldStats(this.animalId, this.upgrades);
    this.draft = null;
    this.hooks.onPick?.(pick);
  }

  _kill(reason) {
    if (!this.player.alive) return;
    this.player.alive = false;
    this.player.deathReason = reason;
    this.hooks.onDeath?.(reason);
  }

  summary() {
    return {
      score: this.score,
      mass: this.player.mass,
      eaten: this.eaten,
      reason: this.player.deathReason,
      animalId: this.animalId,
      upgrades: this.upgrades.slice(),
      time: this.time,
    };
  }
}

export { WORLD_FLOOR, FIXED_DT };
