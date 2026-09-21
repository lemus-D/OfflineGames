/* Simulation: movement, spawning, collision, hunger, structures, crabs, surface.
   Fixed timestep. No Math.random() — seeded RNG only. */

import { makeRNG, clamp, lerp } from '../core/rng.js';
import {
  ANIMALS,
  FAUNA,
  CRAB,
  GROWTH_MILESTONES,
  foldStats,
  draftUpgrades,
  speciesFromFauna,
} from './content.js';
import { lengthFromMass, turnAngle } from './creature.js';
import {
  SURFACE_Y,
  WORLD_FLOOR,
  AIR_CEIL,
  ensureStructureChunks,
  allStructures,
  resolveStructurePush,
  randomSurfacePose,
} from './structures.js';

const FIXED_DT = 1 / 60;
const SPAWN_MARGIN = 520;
const SPAWN_GRACE = 4.5;
const EARLY_PREY_WINDOW = 14;
const PREDATOR_MIN_SPAWN_DIST = SPAWN_MARGIN * 1.15;
const GRAVITY = 980;
const AIR_DRAG = 0.992;

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
      angle: 0, // radians, 0 = nose right
      hunger: 1,
      alive: true,
      deathReason: null,
      secondWindUsed: false,
      panicUntil: 0,
      stunPulseUntil: 0,
      airborne: false,
      wasAirborne: false,
    };

    this.creatures = [];
    this.score = 0;
    this.eaten = 0;
    this.time = 0;
    this.simAccum = 0;
    this.paused = false;
    this.draft = null;
    this.camera = { x: 0, y: 900, zoom: 1 };
    this._spawnTimer = SPAWN_GRACE * 0.45;
    this._crabTimer = 1.2;
    this._nextId = 1;
    this._graceUntil = SPAWN_GRACE;
    this.chunks = new Map();
    this.splashes = [];

    ensureStructureChunks(this.chunks, 0, this.seed);
    for (let i = 0; i < 28; i++) this._spawnNear(true);
    for (let i = 0; i < 10; i++) this._spawnCrab(true);
  }

  get length() {
    return lengthFromMass(this.player.mass);
  }

  get structures() {
    return allStructures(this.chunks);
  }

  topSpeed() {
    return 210 * this.stats.speed * (0.85 + 0.15 / Math.sqrt(this.player.mass));
  }

  turnRate() {
    return 4.2 * this.stats.turn * (1 / Math.pow(this.player.mass, 0.35));
  }

  step(frameDt, aim) {
    if (!this.player.alive) return;
    if (this.draft) return;

    this.simAccum += Math.min(frameDt, 0.05);
    while (this.simAccum >= FIXED_DT) {
      this._fixedStep(FIXED_DT, aim);
      this.simAccum -= FIXED_DT;
    }
    this._updateCamera(frameDt);
    this._updateSplashes(frameDt);
  }

  _fixedStep(dt, aim) {
    this.time += dt;
    const p = this.player;
    const len = this.length;
    const top = this.topSpeed();

    ensureStructureChunks(this.chunks, p.x, this.seed);

    let ax = 0,
      ay = 0;
    if (aim.mag > 8) {
      ax = aim.ax / aim.mag;
      ay = aim.ay / aim.mag;
    }

    const inAir = p.y < SURFACE_Y;
    p.wasAirborne = p.airborne;
    p.airborne = inAir;

    if (inAir) {
      // Air: gravity + light steering, then fall back into the water.
      const airAccel = top * 0.55;
      p.vx += ax * airAccel * dt;
      p.vy += ay * airAccel * 0.35 * dt;
      p.vy += GRAVITY * dt;
      p.vx *= Math.pow(AIR_DRAG, dt * 60);
      const spd = Math.hypot(p.vx, p.vy);
      const maxAir = top * 1.35;
      if (spd > maxAir) {
        p.vx = (p.vx / spd) * maxAir;
        p.vy = (p.vy / spd) * maxAir;
      }
    } else {
      const boosting =
        aim.boost && (p.panicUntil > this.time || p.hunger > 0.08);
      const boostMul = boosting ? 1.55 * this.stats.boostAccel : 1;
      if (boosting && p.panicUntil <= this.time) {
        p.hunger = Math.max(0, p.hunger - dt * 0.22 * this.stats.boostCost);
      }
      if (boosting && this.stats.boostStun > 0) {
        p.stunPulseUntil = this.time + this.stats.boostStun;
      }

      const accel = top * 2.4 * boostMul;
      p.vx += ax * accel * dt;
      p.vy += ay * accel * dt;
      const drag = Math.pow(0.984, boostMul > 1 ? 0.7 : 1);
      const damp = Math.pow(drag, dt * 60);
      p.vx *= damp;
      p.vy *= damp;

      const spd = Math.hypot(p.vx, p.vy);
      const maxSpd = top * boostMul;
      if (spd > maxSpd) {
        p.vx = (p.vx / spd) * maxSpd;
        p.vy = (p.vy / spd) * maxSpd;
      }
    }

    // Face velocity (any angle).
    const vspd = Math.hypot(p.vx, p.vy);
    if (vspd > 10) {
      const want = Math.atan2(p.vy, p.vx);
      p.angle = turnAngle(p.angle, want, this.turnRate() * dt);
    } else if (aim.mag > 8) {
      p.angle = turnAngle(p.angle, Math.atan2(ay, ax), this.turnRate() * dt);
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Surface crossing splash.
    if (p.wasAirborne && !p.airborne && p.vy > 40) {
      this._splash(p.x, SURFACE_Y, Math.min(1.4, p.vy / 400));
      p.vy *= 0.55;
      p.vx *= 0.85;
    } else if (!p.wasAirborne && p.airborne && p.vy < -80) {
      this._splash(p.x, SURFACE_Y, Math.min(1.2, -p.vy / 380));
    }

    // Soft structure collision (underwater / on surface).
    const push = resolveStructurePush(p.x, p.y, len * 0.28, this.structures);
    p.x += push.dx;
    p.y += push.dy;
    if (push.dx || push.dy) {
      p.vx *= 0.7;
      p.vy *= 0.7;
    }

    p.y = clamp(p.y, AIR_CEIL + len * 0.2, WORLD_FLOOR - len * 0.25);

    // Hunger only drains underwater (air time is short).
    if (!inAir) {
      p.hunger -= dt * 0.028 * this.stats.hungerDrain;
      if (p.hunger <= 0) {
        p.hunger = 0;
        this._kill('starved');
        return;
      }
    }

    this._updateCreatures(dt, len);
    this._spawnTimer -= dt;
    if (this._spawnTimer <= 0) {
      this._spawnNear(false);
      this._spawnTimer = lerp(0.35, 0.9, this.rng());
    }
    this._crabTimer -= dt;
    if (this._crabTimer <= 0) {
      this._spawnCrab(false);
      this._crabTimer = lerp(1.4, 2.8, this.rng());
    }
    this._collide(len);
    this._checkMilestones();
  }

  _splash(x, y, power) {
    this.splashes.push({ x, y, life: 0.55, power, age: 0 });
    if (this.splashes.length > 12) this.splashes.shift();
  }

  _updateSplashes(dt) {
    for (const s of this.splashes) s.age += dt;
    this.splashes = this.splashes.filter((s) => s.age < s.life);
  }

  _updateCamera(frameDt) {
    const p = this.player;
    const lead = 0.35;
    const targetX = p.x + p.vx * lead;
    const targetY = p.y + p.vy * lead * 0.6;
    const targetZoom = clamp(1.15 / Math.pow(this.player.mass, 0.22), 0.45, 1.2);
    const k = 1 - Math.pow(0.001, frameDt);
    this.camera.x += (targetX - this.camera.x) * k;
    this.camera.y += (targetY - this.camera.y) * k;
    this.camera.zoom += (targetZoom - this.camera.zoom) * k * 0.6;
  }

  _spawnNear(initial) {
    const p = this.player;
    const ang = this.rng() * Math.PI * 2;

    const roll = this.rng();
    const early = !initial && this.time < EARLY_PREY_WINDOW;
    let template;
    if (initial || early || roll < 0.72) {
      template = FAUNA[(this.rng() * 4) | 0];
    } else if (roll < 0.9) {
      template = FAUNA[4 + ((this.rng() * 2) | 0)];
    } else {
      template = FAUNA[4 + ((this.rng() * 3) | 0)];
    }

    let dist = initial
      ? 160 + this.rng() * 680
      : SPAWN_MARGIN * (0.7 + this.rng() * 0.8);
    if (template.kind === 'predator') {
      dist = Math.max(dist, PREDATOR_MIN_SPAWN_DIST);
    }

    const x = p.x + Math.cos(ang) * dist;
    // Keep fish below the surface.
    const y = clamp(
      p.y + Math.sin(ang) * dist * 0.7,
      SURFACE_Y + 80,
      WORLD_FLOOR - 80
    );

    const rel = lerp(template.massMin, template.massMax, this.rng());
    const mass = Math.max(0.05, p.mass * rel);
    const seed = (this.rng() * 0xffffffff) | 0;
    const species = speciesFromFauna(template, seed, this.rng);
    if (template.kind === 'predator') species.jaw = Math.max(species.jaw, 0.75);

    const angle = this.rng() * Math.PI * 2;
    const spd = (40 + this.rng() * 80) * template.speed;
    this.creatures.push({
      id: this._nextId++,
      form: 'fish',
      kind: template.kind,
      name: template.name,
      x,
      y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd * 0.4,
      mass,
      angle,
      species,
      speedMul: template.speed,
      stunnedUntil: 0,
    });

    this._trimCreatures();
  }

  _spawnCrab(initial) {
    const p = this.player;
    const structs = this.structures;
    let pose = null;
    const preferWall = this.rng() < 0.45 && structs.length > 0;
    if (preferWall) {
      pose = randomSurfacePose(structs, this.rng);
    }
    if (!pose) {
      // Ocean floor crab.
      const dir = this.rng() < 0.5 ? -1 : 1;
      const dist = initial ? 80 + this.rng() * 700 : 200 + this.rng() * SPAWN_MARGIN;
      pose = {
        x: p.x + dir * dist,
        y: WORLD_FLOOR - 18 - this.rng() * 10,
        angle: dir > 0 ? 0 : Math.PI,
        surf: null,
        u: this.rng(),
      };
    }

    // Don't drop crabs on top of the player at dive-in.
    if (Math.hypot(pose.x - p.x, pose.y - p.y) < 90) return;

    const rel = lerp(CRAB.massMin, CRAB.massMax, this.rng());
    const mass = Math.max(0.04, p.mass * rel);
    const crawlDir = this.rng() < 0.5 ? -1 : 1;
    this.creatures.push({
      id: this._nextId++,
      form: 'crab',
      kind: 'prey',
      name: 'crab',
      x: pose.x,
      y: pose.y,
      vx: 0,
      vy: 0,
      mass,
      angle: pose.angle,
      hue: CRAB.hue + (this.rng() - 0.5) * 16,
      speedMul: CRAB.speed,
      crawlDir,
      surf: pose.surf,
      surfU: pose.u ?? 0,
      stunnedUntil: 0,
    });
    this._trimCreatures();
  }

  _trimCreatures() {
    const p = this.player;
    if (this.creatures.length > 70) {
      this.creatures.sort(
        (a, b) =>
          Math.hypot(b.x - p.x, b.y - p.y) - Math.hypot(a.x - p.x, a.y - p.y)
      );
      this.creatures.length = 60;
    }
  }

  _updateCreatures(dt, playerLen) {
    const p = this.player;
    for (const c of this.creatures) {
      if (c.form === 'crab') {
        this._updateCrab(c, dt);
        continue;
      }

      if (c.stunnedUntil > this.time) {
        c.vx *= 0.9;
        c.vy *= 0.9;
      } else if (
        c.kind === 'predator' &&
        this.time >= this._graceUntil &&
        c.mass > p.mass * this.stats.predatorAdvantage * 0.95
      ) {
        const dx = p.x - c.x,
          dy = p.y - c.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < 900) {
          const chase = 160 * c.speedMul;
          c.vx += (dx / d) * chase * dt;
          c.vy += (dy / d) * chase * dt;
        }
      } else {
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
      c.y = clamp(c.y, SURFACE_Y + 40, WORLD_FLOOR - 40);
      if (spd > 8) {
        c.angle = turnAngle(c.angle, Math.atan2(c.vy, c.vx), 6 * dt);
      }

      if (p.stunPulseUntil > this.time && c.kind === 'predator') {
        const d = Math.hypot(c.x - p.x, c.y - p.y);
        if (d < playerLen * 2.2) c.stunnedUntil = this.time + 1.4;
      }
    }

    this.creatures = this.creatures.filter((c) => {
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      return d < SPAWN_MARGIN * 2.6;
    });
  }

  _updateCrab(c, dt) {
    const crawl = 55 * c.speedMul;
    if (c.surf) {
      c.surfU += c.crawlDir * (crawl / Math.max(40, c.surf.len)) * dt;
      if (c.surfU < 0 || c.surfU > 1) {
        c.crawlDir *= -1;
        c.surfU = clamp(c.surfU, 0, 1);
      }
      c.x = c.surf.x + c.surf.tx * c.surf.len * c.surfU;
      c.y = c.surf.y + c.surf.ty * c.surf.len * c.surfU;
      const want = Math.atan2(c.surf.ty * c.crawlDir, c.surf.tx * c.crawlDir);
      c.angle = turnAngle(c.angle, want, 8 * dt);
      c.vx = c.surf.tx * c.crawlDir * crawl;
      c.vy = c.surf.ty * c.crawlDir * crawl;
    } else {
      // Floor crab.
      c.vx = c.crawlDir * crawl;
      c.vy = 0;
      c.x += c.vx * dt;
      c.y = WORLD_FLOOR - 18 + Math.sin(this.time * 3 + c.id) * 2;
      // Occasional turn-around, keyed by id + time (no extra RNG draw).
      if (((c.id * 17 + ((this.time * 3) | 0)) % 180) === 0) c.crawlDir *= -1;
      c.angle = turnAngle(c.angle, c.crawlDir > 0 ? 0 : Math.PI, 8 * dt);
    }
  }

  _collide(playerLen) {
    const p = this.player;
    const bite = this.stats.biteRatio;
    const remain = [];

    for (const c of this.creatures) {
      const clen =
        c.form === 'crab' ? lengthFromMass(c.mass) * 0.85 : lengthFromMass(c.mass);
      const dist = Math.hypot(c.x - p.x, c.y - p.y);
      const hitR = (playerLen + clen) * (c.form === 'crab' ? 0.34 : 0.28);
      if (dist > hitR) {
        remain.push(c);
        continue;
      }

      if (c.mass <= p.mass * bite) {
        const gain = c.mass * 0.22 * this.stats.growthMul;
        const oversize = c.mass > p.mass;
        p.mass += gain;
        p.hunger = Math.min(1, p.hunger + 0.28 + (c.mass / p.mass) * 0.2);
        if (c.form === 'crab') p.hunger = Math.min(1, p.hunger + 0.08);
        if (oversize && this.stats.oversizeHeal) {
          p.hunger = Math.min(1, p.hunger + this.stats.oversizeHeal);
        }
        this.score += Math.round(10 + c.mass * 40 + (c.form === 'crab' ? 8 : 0));
        this.eaten += 1;
        this.hooks.onEat?.(c, oversize);
        continue;
      }

      if (
        c.kind === 'predator' &&
        c.mass >= p.mass * this.stats.predatorAdvantage
      ) {
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

export { WORLD_FLOOR, SURFACE_Y, AIR_CEIL, FIXED_DT };
