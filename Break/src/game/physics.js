/* Circle balls, cushions, pockets, English. Mutators on ball state. */

import { TABLE, BALL_R, PHYSICS, pocketCenters } from './content.js';

const pockets = pocketCenters();

export function createBall(def, x, y) {
  return {
    id: def.id,
    kind: def.kind,
    color: def.color,
    label: def.label,
    x,
    y,
    vx: 0,
    vy: 0,
    /** Side English (about table normal). */
    sideSpin: 0,
    /** Forward spin: +follow / -draw. */
    forwardSpin: 0,
    pocketed: false,
    /** Mid fall-into-pocket animation. */
    falling: false,
    fallAge: 0,
    fallFromX: 0,
    fallFromY: 0,
    fallPocketX: 0,
    fallPocketY: 0,
    r: BALL_R,
  };
}

export function anyMoving(balls) {
  const lim = PHYSICS.stopSpeed;
  const fallDur = PHYSICS.pocketFallDur;
  for (const b of balls) {
    if (b.falling && b.fallAge < fallDur) return true;
    if (b.pocketed) continue;
    if (Math.hypot(b.vx, b.vy) > lim) return true;
  }
  return false;
}

export function settle(balls) {
  const lim = PHYSICS.stopSpeed;
  for (const b of balls) {
    if (b.pocketed) continue;
    if (Math.hypot(b.vx, b.vy) <= lim) {
      b.vx = 0;
      b.vy = 0;
      // Spin dies with the roll — don't leave the table "hot" forever.
      b.sideSpin = 0;
      b.forwardSpin = 0;
    }
  }
}

/**
 * Integrate one fixed step. Returns events:
 * `{ pocketed: Ball[], cushionHits: number, ballHits: number }`
 */
export function stepPhysics(balls, dt) {
  const events = { pocketed: [], cushionHits: 0, ballHits: 0 };

  // Advance pocket drop animations (no collisions while falling).
  for (const b of balls) {
    if (!b.falling) continue;
    b.fallAge += dt;
    const t = Math.min(1, b.fallAge / PHYSICS.pocketFallDur);
    const e = t * t * (3 - 2 * t); // smoothstep
    b.x = b.fallFromX + (b.fallPocketX - b.fallFromX) * e;
    b.y = b.fallFromY + (b.fallPocketY - b.fallFromY) * e;
    if (t >= 1) b.falling = false;
  }

  const active = balls.filter((b) => !b.pocketed && !b.falling);

  for (const b of active) {
    integrateBall(b, dt);
  }

  // Multiple collision passes keep racks from sticking.
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        if (resolveBallBall(active[i], active[j])) {
          if (pass === 0) events.ballHits += 1;
        }
      }
    }
  }

  for (const b of active) {
    if (resolveCushions(b)) events.cushionHits += 1;
  }

  for (const b of active) {
    if (tryPocket(b, dt)) events.pocketed.push(b);
  }

  settle(balls);
  return events;
}

function integrateBall(b, dt) {
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  const spd = Math.hypot(b.vx, b.vy);
  if (spd > 1e-8) {
    const sliding =
      Math.abs(b.sideSpin) + Math.abs(b.forwardSpin) > spd * 0.15
        ? PHYSICS.slidingDrag
        : 0;
    const drag = (PHYSICS.rollingDrag + sliding) * dt;
    const newSpd = Math.max(0, spd - drag);
    b.vx *= newSpd / spd;
    b.vy *= newSpd / spd;

    // Mild curve from lingering side spin while moving (massé-lite).
    if (Math.abs(b.sideSpin) > 0.01 && newSpd > 1) {
      const curve = b.sideSpin * 0.012 * dt;
      const nx = b.vx / (newSpd || 1);
      const ny = b.vy / (newSpd || 1);
      b.vx += -ny * curve * newSpd;
      b.vy += nx * curve * newSpd;
    }

    // Follow/draw gently feeds into velocity along travel.
    if (Math.abs(b.forwardSpin) > 0.01) {
      const feed = b.forwardSpin * 0.08 * dt;
      b.vx += (b.vx / spd) * feed;
      b.vy += (b.vy / spd) * feed;
      b.forwardSpin *= 0.998;
    }
  }

  b.sideSpin *= PHYSICS.spinDecay;
  b.forwardSpin *= PHYSICS.spinDecay;
}

function resolveBallBall(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const min = a.r + b.r;
  if (dist === 0 || dist >= min) return false;

  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = min - dist;
  a.x -= nx * overlap * 0.5;
  a.y -= ny * overlap * 0.5;
  b.x += nx * overlap * 0.5;
  b.y += ny * overlap * 0.5;

  const dvx = a.vx - b.vx;
  const dvy = a.vy - b.vy;
  const vn = dvx * nx + dvy * ny;
  if (vn <= 0) return false;

  const e = PHYSICS.ballRestitution;
  const impulse = ((1 + e) * vn) / 2;
  a.vx -= impulse * nx;
  a.vy -= impulse * ny;
  b.vx += impulse * nx;
  b.vy += impulse * ny;

  // Throw from side English on the hitter.
  const throwSpin = a.sideSpin * PHYSICS.throwFactor;
  b.vx += -ny * throwSpin;
  b.vy += nx * throwSpin;
  a.sideSpin *= 0.55;
  b.sideSpin += throwSpin * 0.35;

  // Follow / draw: reshape cue residual after transferring the normal component.
  const hitSpeed = Math.abs(vn);
  if (Math.abs(a.forwardSpin) > 0.05 && hitSpeed > 0.5) {
    const tangX = a.vx;
    const tangY = a.vy;
    const follow = a.forwardSpin > 0 ? PHYSICS.followFactor : PHYSICS.drawFactor;
    const sign = a.forwardSpin > 0 ? 1 : -1;
    a.vx = tangX * 0.7 + nx * sign * hitSpeed * follow * Math.min(1, Math.abs(a.forwardSpin) / 30);
    a.vy = tangY * 0.7 + ny * sign * hitSpeed * follow * Math.min(1, Math.abs(a.forwardSpin) / 30);
    a.forwardSpin *= 0.4;
  }

  return true;
}

function resolveCushions(b) {
  const maxX = TABLE.halfW - b.r;
  const maxY = TABLE.halfH - b.r;
  let hit = false;

  // Only open the rails over the real jaw — not a huge rim that eats grazers.
  const nearPocket = pockets.some(
    (p) => Math.hypot(b.x - p.x, b.y - p.y) < TABLE.pocketJaw
  );
  if (nearPocket) return false;

  if (b.x < -maxX) {
    b.x = -maxX;
    bounceRail(b, 1, 0);
    hit = true;
  } else if (b.x > maxX) {
    b.x = maxX;
    bounceRail(b, -1, 0);
    hit = true;
  }
  if (b.y < -maxY) {
    b.y = -maxY;
    bounceRail(b, 0, 1);
    hit = true;
  } else if (b.y > maxY) {
    b.y = maxY;
    bounceRail(b, 0, -1);
    hit = true;
  }
  return hit;
}

function bounceRail(b, nx, ny) {
  // Normal reflection.
  const vn = b.vx * nx + b.vy * ny;
  if (vn >= 0) {
    b.vx -= (1 + PHYSICS.cushionRestitution) * vn * nx;
    b.vy -= (1 + PHYSICS.cushionRestitution) * vn * ny;
  } else {
    // Already leaving — still damp if embedded.
    b.vx -= (1 + PHYSICS.cushionRestitution) * vn * nx;
    b.vy -= (1 + PHYSICS.cushionRestitution) * vn * ny;
  }

  // Tangent damping + side-spin kick along the rail.
  const tx = -ny;
  const ty = nx;
  let vt = b.vx * tx + b.vy * ty;
  vt *= 1 - PHYSICS.cushionFriction;
  vt += b.sideSpin * PHYSICS.sideOnCushion;
  // Rebuild velocity from n/t (normal already applied via reflection above).
  const vn2 = b.vx * nx + b.vy * ny;
  b.vx = vn2 * nx + vt * tx;
  b.vy = vn2 * ny + vt * ty;
  b.sideSpin *= -0.55;
  b.forwardSpin *= 0.85;
}

function tryPocket(b, dt) {
  for (const p of pockets) {
    const dist = Math.hypot(b.x - p.x, b.y - p.y);
    const mouth = p.corner ? TABLE.pocketMouth : TABLE.pocketMouth * 0.9;

    // Soft funnel only when already driving into the hole — never magnets on a graze.
    if (dist < TABLE.pocketJaw && dist > mouth) {
      const inv = 1 / (dist || 1);
      const nx = (p.x - b.x) * inv;
      const ny = (p.y - b.y) * inv;
      const toward = b.vx * nx + b.vy * ny;
      if (toward > 10) {
        b.vx += nx * 32 * dt;
        b.vy += ny * 32 * dt;
      }
    }

    // Drop only when the ball center is deep in the mouth (not just touching the rim).
    if (dist < mouth) {
      b.pocketed = true;
      b.falling = true;
      b.fallAge = 0;
      b.fallFromX = b.x;
      b.fallFromY = b.y;
      b.fallPocketX = p.x;
      b.fallPocketY = p.y;
      b.vx = 0;
      b.vy = 0;
      b.sideSpin = 0;
      b.forwardSpin = 0;
      return true;
    }
  }
  return false;
}

/** Place cue ball in kitchen without overlapping others. */
export function placeCueBall(cue, others, x, y) {
  const maxX = -BALL_R;
  const maxY = TABLE.halfH - BALL_R;
  let cx = Math.max(-TABLE.halfW + BALL_R, Math.min(maxX, x));
  let cy = Math.max(-maxY, Math.min(maxY, y));

  for (let n = 0; n < 40; n++) {
    let ok = true;
    for (const o of others) {
      if (o.pocketed || o.id === cue.id) continue;
      const d = Math.hypot(cx - o.x, cy - o.y);
      if (d < cue.r + o.r + 0.05) {
        ok = false;
        const ang = Math.atan2(cy - o.y, cx - o.x) || 0;
        cx = o.x + Math.cos(ang) * (cue.r + o.r + 0.2);
        cy = o.y + Math.sin(ang) * (cue.r + o.r + 0.2);
        cx = Math.max(-TABLE.halfW + BALL_R, Math.min(maxX, cx));
        cy = Math.max(-maxY, Math.min(maxY, cy));
        break;
      }
    }
    if (ok) break;
  }
  cue.x = cx;
  cue.y = cy;
  cue.vx = 0;
  cue.vy = 0;
  cue.sideSpin = 0;
  cue.forwardSpin = 0;
  cue.pocketed = false;
  cue.falling = false;
  cue.fallAge = 0;
}

/**
 * @param english {{x:number,y:number}} tip offset on cue ball face, x=side y=follow/draw, -1..1
 */
export function applyCueShot(cue, dirX, dirY, power01, english = { x: 0, y: 0 }) {
  const len = Math.hypot(dirX, dirY) || 1;
  const nx = dirX / len;
  const ny = dirY / len;
  const power = Math.max(0, Math.min(1, power01));
  const mass = PHYSICS.ballMass || 1;
  const speed = (PHYSICS.maxShotSpeed * power) / mass;
  cue.vx = nx * speed;
  cue.vy = ny * speed;

  const ex = clampEng(english.x);
  const ey = clampEng(english.y);
  // Tip offset reduces a bit of center-hit efficiency.
  const tipOff = Math.hypot(ex, ey);
  const efficiency = 1 - tipOff * 0.12;
  cue.vx *= efficiency;
  cue.vy *= efficiency;

  cue.sideSpin = ex * speed * PHYSICS.englishToSpin;
  cue.forwardSpin = ey * speed * PHYSICS.englishToSpin;
}

function clampEng(v) {
  const m = PHYSICS.maxEnglish;
  return Math.max(-m, Math.min(m, Number(v) || 0));
}
