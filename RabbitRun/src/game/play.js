/* Fixed-timestep endless chase. No Math.random — seeded RNG only. */

import { makeRNG, clamp, lerp } from '../core/rng.js';
import { LANES, RUN, OBSTACLES, OBSTACLE_IDS } from './content.js';

const FIXED_DT = 1 / 60;

/**
 * Smooth path centerline bend in lane-widths.
 * Discrete seeded turns + gentle wander so both runners share one ribbon.
 */
export function pathBend(z, seed) {
  const spacing = RUN.turnSpacing;
  const i0 = Math.floor(z / spacing);
  let bend = 0;
  // Blend a few nearby turn keypoints.
  for (let i = i0 - 1; i <= i0 + 2; i++) {
    if (i < 0) continue;
    const rng = makeRNG((seed ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0);
    const dir = rng() < 0.5 ? -1 : 1;
    const strength = (0.55 + rng() * 0.45) * RUN.turnAmp * dir;
    const center = (i + 0.5) * spacing;
    const half = spacing * 0.42;
    const t = clamp(1 - Math.abs(z - center) / half, 0, 1);
    const s = t * t * (3 - 2 * t);
    bend += strength * s;
  }
  // Soft continuous wander so straights aren't dead-flat.
  bend += Math.sin(z * 0.045 + seed * 0.001) * 0.22;
  bend += Math.sin(z * 0.11 + 1.7) * 0.1;
  return bend;
}

export class PlaySession {
  /**
   * @param {number} seed
   * @param {{ onDeath?: (reason: string) => void }} hooks
   */
  constructor(seed, hooks = {}) {
    this.seed = seed >>> 0;
    this.rng = makeRNG(this.seed);
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
    /** @type {Array<{x:number,y:number,age:number,life:number,vx:number,vy:number}>} */
    this.collectFx = [];
    /** Hit stun flash */
    this.flash = 0;
    this.hopPhase = 0;
    this.foxHop = 0.4;

    // Seed a clear runway.
    for (let i = 0; i < 4; i++) this.nextSpawnZ += RUN.segmentGap;
  }

  bendAt(z) {
    return pathBend(z, this.seed);
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
    // Slower, heavier gait so rear-view pumps read clearly.
    const cadence = 6.2 + this.speed * 0.18;
    this.hopPhase += dt * cadence;
    this.foxHop += dt * (cadence * 1.05);
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
    this._fx(dt);

    // Score: distance + carrots.
    this.score = Math.floor(this.distance) * 10 + this.carrots * 50;

    // Cull behind camera.
    const cam = this.distance;
    this.obstacles = this.obstacles.filter((o) => o.z > cam - RUN.cullBehind);
    this.pickups = this.pickups.filter(
      (p) => p.z > cam - RUN.cullBehind && !p.taken
    );
  }

  _fx(dt) {
    for (const fx of this.collectFx) fx.age += dt;
    this.collectFx = this.collectFx.filter((fx) => fx.age < fx.life);
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
    const density = clamp(0.32 + this.time * 0.012, 0.32, 0.78);

    if (r < density * 0.5) {
      // Obstacle in one lane + carrot bait in another.
      const lane = Math.floor(this.rng() * LANES);
      const kind =
        this.rng() < 0.28
          ? 'hedge'
          : OBSTACLE_IDS[Math.floor(this.rng() * (OBSTACLE_IDS.length - 1))];
      this.obstacles.push({ z, lane, kind, hit: false });

      if (this.rng() < 0.75) {
        let cl = Math.floor(this.rng() * LANES);
        if (cl === lane) cl = (cl + 1) % LANES;
        this.pickups.push({ z, lane: cl, taken: false });
      }
    } else if (r < density) {
      // Twin obstacles leave one safe lane — carrot on the safe line.
      const safe = Math.floor(this.rng() * LANES);
      for (let lane = 0; lane < LANES; lane++) {
        if (lane === safe) continue;
        const kind = this.rng() < 0.4 ? 'hedge' : 'log';
        this.obstacles.push({ z, lane, kind, hit: false });
      }
      this.pickups.push({ z: z + 0.8, lane: safe, taken: false });
      if (this.rng() < 0.55) {
        this.pickups.push({ z: z + 2.0, lane: safe, taken: false });
      }
    } else {
      // Open stretch — carrot trail the rabbit wants to weave through.
      const lane = Math.floor(this.rng() * LANES);
      const n = 1 + Math.floor(this.rng() * RUN.carrotTrail);
      for (let i = 0; i < n; i++) {
        const swing =
          this.rng() < 0.35 ? clamp(lane + (this.rng() < 0.5 ? -1 : 1), 0, 2) : lane;
        this.pickups.push({
          z: z + i * 1.15,
          lane: swing,
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
      this.foxGap = Math.min(RUN.foxBaseGap + 1.5, this.foxGap + 0.4);
      // Screen-space-ish burst; draw maps with current camera later.
      for (let i = 0; i < 6; i++) {
        const a = this.rng() * Math.PI * 2;
        const sp = 40 + this.rng() * 80;
        this.collectFx.push({
          lane: pl,
          z: pz,
          age: 0,
          life: 0.45 + this.rng() * 0.25,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 40,
        });
      }
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

/**
 * Project a world (lane, z) into screen space, following the bent path.
 * @param {number} [bendCam] path bend at camera (defaults to 0 for menu draws)
 * @param {number} [bendHere] path bend at z
 */
export function project(
  lane,
  z,
  camZ,
  W,
  H,
  jumpY = 0,
  bendCam = 0,
  bendHere = 0
) {
  const rel = z - camZ;
  const depth = RUN.near + Math.max(0, rel);
  const scale = RUN.near / depth;
  const horizonY = H * 0.26;
  const groundY = H * 0.94;
  const t = clamp(scale, 0.04, 1);
  const yBase = lerp(horizonY, groundY, Math.pow(t, 0.85));
  const laneSpread = W * 0.34;
  // Path center follows bend; lanes are offsets from that ribbon.
  const worldLat = bendHere + (lane - 1);
  const camLat = bendCam;
  const x = W * 0.5 + (worldLat - camLat) * laneSpread * t;
  const y = yBase - jumpY * H * 0.12 * t;
  return { x, y, scale: t, onScreen: rel > -3 && rel < RUN.far, bend: bendHere };
}

/** Convenience: project using a live session's bend seed. */
export function projectSession(session, lane, z, W, H, jumpY = 0) {
  const camZ = session.distance;
  return project(
    lane,
    z,
    camZ,
    W,
    H,
    jumpY,
    session.bendAt(camZ),
    session.bendAt(z)
  );
}
