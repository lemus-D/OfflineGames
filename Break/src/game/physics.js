/* Circle balls, cushions, pockets. Pure functions / mutators on ball state. */

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
    pocketed: false,
    r: BALL_R,
  };
}

export function anyMoving(balls) {
  const lim = PHYSICS.stopSpeed;
  for (const b of balls) {
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
    }
  }
}

/**
 * Integrate one fixed step. Returns events:
 * `{ pocketed: Ball[], cushionHits: number, ballHits: number }`
 */
export function stepPhysics(balls, dt) {
  const events = { pocketed: [], cushionHits: 0, ballHits: 0 };
  const active = balls.filter((b) => !b.pocketed);

  for (const b of active) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.vx *= PHYSICS.friction;
    b.vy *= PHYSICS.friction;
  }

  // Ball–ball collisions (equal mass, elastic).
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      if (resolveBallBall(active[i], active[j])) events.ballHits += 1;
    }
  }

  for (const b of active) {
    if (resolveCushions(b)) events.cushionHits += 1;
  }

  for (const b of active) {
    if (tryPocket(b)) events.pocketed.push(b);
  }

  settle(balls);
  return events;
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
  return true;
}

function resolveCushions(b) {
  const maxX = TABLE.halfW - b.r;
  const maxY = TABLE.halfH - b.r;
  let hit = false;
  // Skip cushion near pockets so balls can fall in.
  const nearPocket = pockets.some(
    (p) => Math.hypot(b.x - p.x, b.y - p.y) < TABLE.pocketR + b.r * 0.85
  );
  if (nearPocket) return false;

  if (b.x < -maxX) {
    b.x = -maxX;
    b.vx = Math.abs(b.vx) * PHYSICS.cushionRestitution;
    hit = true;
  } else if (b.x > maxX) {
    b.x = maxX;
    b.vx = -Math.abs(b.vx) * PHYSICS.cushionRestitution;
    hit = true;
  }
  if (b.y < -maxY) {
    b.y = -maxY;
    b.vy = Math.abs(b.vy) * PHYSICS.cushionRestitution;
    hit = true;
  } else if (b.y > maxY) {
    b.y = maxY;
    b.vy = -Math.abs(b.vy) * PHYSICS.cushionRestitution;
    hit = true;
  }
  return hit;
}

function tryPocket(b) {
  for (const p of pockets) {
    const catchR = p.corner ? TABLE.pocketR : TABLE.pocketR * 0.92;
    if (Math.hypot(b.x - p.x, b.y - p.y) < catchR) {
      b.pocketed = true;
      b.vx = 0;
      b.vy = 0;
      b.x = p.x;
      b.y = p.y;
      return true;
    }
  }
  return false;
}

/** Place cue ball in kitchen without overlapping others. */
export function placeCueBall(cue, others, x, y) {
  const maxX = -BALL_R; // kitchen: left half
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
  cue.pocketed = false;
}

export function applyCueShot(cue, dirX, dirY, power01) {
  const len = Math.hypot(dirX, dirY) || 1;
  const nx = dirX / len;
  const ny = dirY / len;
  const speed = PHYSICS.maxShotSpeed * Math.max(0, Math.min(1, power01));
  cue.vx = nx * speed;
  cue.vy = ny * speed;
}
