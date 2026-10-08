/* Fixed-timestep endless chase. No Math.random — seeded RNG only. */

import { makeRNG, clamp, lerp } from '../core/rng.js';
import { LANES, RUN, OBSTACLES, OBSTACLE_IDS } from './content.js';

const FIXED_DT = 1 / 60;

export class PlaySession {
  /**
   * @param {number} seed
   * @param {{ onDeath?: (reason: string) => void }} hooks
   */
  constructor(seed, hooks = {}) {
    this.rng = makeRNG(seed >>> 0);
    this.hooks = hooks;
    this.alive = true;
    this.reason = null;
    this.time = 0;
    this.distance = 0;
    this.score = 0;
    this.carrots = 0;
    this.speed = RUN.baseSpeed;
    this.foxGap = RUN.foxBaseGap;
    this.accum = 0;

    this.lane = 1;
    this.laneVisual = 1;
    this.jumpT = 0;
    this.jumping = false;
    this.jumpY = 0;

    this.nextSpawnZ = 18;
    /** @type {Array<{z:number,lane:number,kind:string,hit:boolean}>} */
    this.obstacles = [];
    /** @type {Array<{z:number,lane:number,taken:boolean}>} */
    this.pickups = [];
    /** Hit stun flash */
    this.flash = 0;
    this.hopPhase = 0;

    // Seed a clear runway.
    for (let i = 0; i < 4; i++) this.nextSpawnZ += RUN.segmentGap;
  }

  summary() {
    return {
      score: this.score,
      distance: Math.floor(this.distance),
      carrots: this.carrots,
      reason: this.reason,
      time: this.time,
    };
  }

  /** Variable-dt entry; steps fixed internally. */
  step(dt, controls) {
    if (!this.alive) return;
    this.accum += Math.min(0.05, dt);
    while (this.accum >= FIXED_DT) {
      this.accum -= FIXED_DT;
      this._fixed(FIXED_DT, controls);
      // Consume one-shots after first fixed step of the frame.
      controls = { laneDelta: 0, jump: false };
    }
  }

  _fixed(dt, controls) {
    this.time += dt;
    this.speed = clamp(
      RUN.baseSpeed + this.time * RUN.accel,
      RUN.baseSpeed,
      RUN.maxSpeed
    );
    this.distance += this.speed * dt;
    this.hopPhase += dt * (8 + this.speed * 0.15);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);

    // Lane change (one step per intent).
    if (controls.laneDelta) {
      const dir = controls.laneDelta > 0 ? 1 : -1;
      this.lane = clamp(this.lane + dir, 0, LANES - 1);
    }
    this.laneVisual = lerp(
      this.laneVisual,
      this.lane,
      clamp(RUN.laneSlide * dt, 0, 1)
    );

    // Jump.
    if (controls.jump && !this.jumping) {
      this.jumping = true;
      this.jumpT = 0;
    }
    if (this.jumping) {
      this.jumpT += dt;
      const u = this.jumpT / RUN.jumpDuration;
      if (u >= 1) {
        this.jumping = false;
        this.jumpY = 0;
      } else {
        this.jumpY = Math.sin(u * Math.PI) * RUN.jumpHeight;
      }
    }

    this._spawnAhead();
    this._collide();
    this._fox();

    // Score: distance + carrots.
    this.score =
      Math.floor(this.distance) * 10 + this.carrots * 50;

    // Cull behind camera.
    const cam = this.distance;
    this.obstacles = this.obstacles.filter((o) => o.z > cam - RUN.cullBehind);
    this.pickups = this.pickups.filter((p) => p.z > cam - RUN.cullBehind && !p.taken);
  }

  _spawnAhead() {
    const cam = this.distance;
    while (this.nextSpawnZ < cam + RUN.spawnAhead) {
      this._rollSegment(this.nextSpawnZ);
      this.nextSpawnZ += RUN.segmentGap;
    }
  }

  _rollSegment(z) {
    const r = this.rng();
    // Early game softer; later denser.
    const density = clamp(0.35 + this.time * 0.012, 0.35, 0.78);

    if (r < density * 0.55) {
      // Obstacle in one lane.
      const lane = Math.floor(this.rng() * LANES);
      const kind =
        this.rng() < 0.28
          ? 'hedge'
          : OBSTACLE_IDS[Math.floor(this.rng() * (OBSTACLE_IDS.length - 1))];
      this.obstacles.push({ z, lane, kind, hit: false });

      // Maybe a carrot in another lane.
      if (this.rng() < 0.55) {
        let cl = Math.floor(this.rng() * LANES);
        if (cl === lane) cl = (cl + 1) % LANES;
        this.pickups.push({ z, lane: cl, taken: false });
      }
    } else if (r < density) {
      // Twin obstacles leave one safe lane.
      const safe = Math.floor(this.rng() * LANES);
      for (let lane = 0; lane < LANES; lane++) {
        if (lane === safe) continue;
        const kind = this.rng() < 0.4 ? 'hedge' : 'log';
        this.obstacles.push({ z, lane, kind, hit: false });
      }
      if (this.rng() < 0.7) {
        this.pickups.push({ z: z + 1.2, lane: safe, taken: false });
      }
    } else {
      // Open stretch — sprinkle carrots.
      if (this.rng() < 0.65) {
        this.pickups.push({
          z,
          lane: Math.floor(this.rng() * LANES),
          taken: false,
        });
      }
    }
  }

  _collide() {
    const cam = this.distance;
    // Player occupies a thin slice just ahead of cam.
    const pz = cam + 0.35;
    const pl = this.lane;

    for (const o of this.obstacles) {
      if (o.hit) continue;
      if (o.lane !== pl) continue;
      if (Math.abs(o.z - pz) > 0.65) continue;

      const def = OBSTACLES[o.kind];
      const clearsJump = !def.tall && this.jumpY > 0.45;
      if (clearsJump) continue;

      o.hit = true;
      this.foxGap -= RUN.foxCloseOnHit;
      this.flash = 0.35;
      if (this.foxGap <= RUN.foxCatchGap) {
        this._die('fox');
        return;
      }
    }

    for (const p of this.pickups) {
      if (p.taken) continue;
      if (p.lane !== pl) continue;
      if (Math.abs(p.z - pz) > 0.7) continue;
      if (this.jumpY > 0.85) continue;
      p.taken = true;
      this.carrots += 1;
      // Carrots buy a little breathing room.
      this.foxGap = Math.min(RUN.foxBaseGap + 1.5, this.foxGap + 0.35);
    }
  }

  _fox() {
    // Gap slowly recovers toward base while running clean.
    if (this.flash <= 0) {
      this.foxGap = Math.min(
        RUN.foxBaseGap + 0.8,
        this.foxGap + 0.15 * FIXED_DT
      );
    }
    // Speed pressure: fox creeps closer at high speed.
    const pressure = clamp((this.speed - RUN.baseSpeed) / 20, 0, 1);
    const effective = this.foxGap - pressure * 0.6;
    if (effective <= RUN.foxCatchGap) this._die('fox');
  }

  _die(reason) {
    if (!this.alive) return;
    this.alive = false;
    this.reason = reason;
    this.hooks.onDeath?.(reason);
  }
}

/** Project a world (lane, z) into screen space. */
export function project(lane, z, camZ, W, H, jumpY = 0) {
  const rel = z - camZ;
  const depth = RUN.near + Math.max(0, rel);
  const scale = RUN.near / depth;
  const horizonY = H * 0.28;
  const groundY = H * 0.92;
  // Map scale 1 (near) → groundY, scale→0 (far) → horizonY
  const t = clamp(scale, 0.04, 1);
  const yBase = lerp(horizonY, groundY, Math.pow(t, 0.85));
  const laneSpread = W * 0.38;
  const x = W * 0.5 + (lane - 1) * laneSpread * t;
  const y = yBase - jumpY * H * 0.12 * t;
  return { x, y, scale: t, onScreen: rel > -2 && rel < RUN.far };
}
