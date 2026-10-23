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

  // Capture before cushions so a jaw clip / apron wall cannot bounce out of a mouth.
  const stillActive = [];
  for (const b of active) {
    if (tryPocket(b, dt)) events.pocketed.push(b);
    else stillActive.push(b);
  }

  for (const b of stillActive) {
    if (b.pocketed || b.falling) continue;
    const rail = resolveCushions(b);
    if (rail === 'pocketed') events.pocketed.push(b);
    else if (rail) events.cushionHits += 1;
  }

  // Second pass after rail motion — balls that cleared the tip into the hole.
  for (const b of stillActive) {
    if (b.pocketed || b.falling) continue;
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
    // High spin vs travel ⇒ still sliding on the cloth; bite harder.
    const spinMag = Math.abs(b.sideSpin) + Math.abs(b.forwardSpin);
    const sliding = spinMag > spd * 0.12 ? PHYSICS.slidingDrag : 0;
    const velDrag = (PHYSICS.rollingDragVel || 0) * spd;
    const drag = (PHYSICS.rollingDrag + sliding + velDrag) * dt;
    const newSpd = Math.max(0, spd - drag);
    b.vx *= newSpd / spd;
    b.vy *= newSpd / spd;

    // Mild curve from lingering side spin while moving (massé-lite).
    if (Math.abs(b.sideSpin) > 0.01 && newSpd > 1) {
      const curve = b.sideSpin * 0.008 * dt;
      const nx = b.vx / (newSpd || 1);
      const ny = b.vy / (newSpd || 1);
      b.vx += -ny * curve * newSpd;
      b.vy += nx * curve * newSpd;
    }

    // Follow/draw gently feeds into velocity — keep small so cloth still wins.
    if (Math.abs(b.forwardSpin) > 0.01) {
      const feed = b.forwardSpin * 0.035 * dt;
      b.vx += (b.vx / spd) * feed;
      b.vy += (b.vy / spd) * feed;
      b.forwardSpin *= 0.99;
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

  // Tangential friction — stops balls skating past each other like ice.
  const dvx2 = a.vx - b.vx;
  const dvy2 = a.vy - b.vy;
  const vt = dvx2 * -ny + dvy2 * nx;
  const jf = vt * (PHYSICS.ballFriction || 0) * 0.5;
  a.vx -= -ny * jf;
  a.vy -= nx * jf;
  b.vx += -ny * jf;
  b.vy += nx * jf;

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

function gapForPocket(p) {
  return p.corner ? TABLE.railGapCorner || TABLE.railGap : TABLE.railGap;
}

/** True when this rail has a cutout leading into an off-table pocket. */
function railOpenAt(b, side) {
  for (const p of pockets) {
    const gap = gapForPocket(p);
    if (side === 'left' && p.x < -1) {
      const ey = Math.max(-TABLE.halfH, Math.min(TABLE.halfH, p.y));
      if (Math.abs(b.y - ey) < gap) return true;
    }
    if (side === 'right' && p.x > 1) {
      const ey = Math.max(-TABLE.halfH, Math.min(TABLE.halfH, p.y));
      if (Math.abs(b.y - ey) < gap) return true;
    }
    if (side === 'top' && p.y < -1) {
      const ex = Math.max(-TABLE.halfW, Math.min(TABLE.halfW, p.x));
      if (Math.abs(b.x - ex) < gap) return true;
    }
    if (side === 'bottom' && p.y > 1) {
      const ex = Math.max(-TABLE.halfW, Math.min(TABLE.halfW, p.x));
      if (Math.abs(b.x - ex) < gap) return true;
    }
  }
  return false;
}

/** Nearest pocket within capture range, if any. */
function nearestPocket(b, rangeMul = 1) {
  let best = null;
  for (const p of pockets) {
    const dist = Math.hypot(b.x - p.x, b.y - p.y);
    const range = (p.corner ? TABLE.pocketJaw * 1.12 : TABLE.pocketJaw) * rangeMul;
    if (dist < range && (!best || dist < best.dist)) best = { p, dist };
  }
  return best;
}

/**
 * At a pocket mouth, skip the hard cushion bounce when the ball is in the
 * jaw and not clearly fleeing the hole — stops tip rejects that kick out.
 */
function shouldSkipRailForPocket(b) {
  const near = nearestPocket(b, 1.05);
  if (!near) return false;
  const inv = 1 / (near.dist || 1);
  const nx = (near.p.x - b.x) * inv;
  const ny = (near.p.y - b.y) * inv;
  const toward = b.vx * nx + b.vy * ny;
  const mouth = near.p.corner
    ? TABLE.pocketMouthCorner || TABLE.pocketMouth
    : TABLE.pocketMouth;
  // Already deep in the mouth, or drifting into / along the jaw.
  if (near.dist < mouth * 2.4) return true;
  if (toward > -8) return true;
  return false;
}

/**
 * Ball already past the felt into a pocket well — sink it instead of
 * bouncing off the apron wall back onto the table.
 * @returns {boolean}
 */
function captureIfInPocketWell(b) {
  const offX = Math.abs(b.x) > TABLE.halfW + 0.15;
  const offY = Math.abs(b.y) > TABLE.halfH + 0.15;
  if (!offX && !offY) return false;

  for (const p of pockets) {
    const dist = Math.hypot(b.x - p.x, b.y - p.y);
    const jaw = p.corner ? TABLE.pocketJaw * 1.45 : TABLE.pocketJaw * 1.2;
    const sameX = !p.corner || Math.sign(p.x) === Math.sign(b.x || p.x);
    const sameY = !p.corner || Math.sign(p.y) === Math.sign(b.y || p.y);

    // Deep in the corner quadrant (through both wedges).
    if (p.corner && offX && offY && sameX && sameY && dist < jaw * 1.15) {
      beginPocketFall(b, p);
      return true;
    }
    // Through one wedge into the hole apron near this pocket.
    if (dist < jaw && (offX || offY)) {
      if (p.corner && !(sameX && sameY)) continue;
      beginPocketFall(b, p);
      return true;
    }
  }
  return false;
}

/**
 * Apron limit past a rail cutout. Near a pocket → sink. Never teleport
 * back onto the felt (that was the “went in then bounced out” bug).
 * @returns {'pocketed'|'hit'|false}
 */
function hitApronLimit(b, nx, ny, limitCoord, isX) {
  const past = isX
    ? (nx > 0 ? b.x < limitCoord : b.x > limitCoord)
    : (ny > 0 ? b.y < limitCoord : b.y > limitCoord);
  if (!past) return false;

  const near = nearestPocket(b, 2.2);
  if (near && near.dist < TABLE.pocketJaw * 1.8) {
    beginPocketFall(b, near.p);
    return 'pocketed';
  }
  // Lost in the wood with no hole nearby — damp and nudge inward, no slam.
  if (isX) b.x = nx > 0 ? -TABLE.halfW + b.r : TABLE.halfW - b.r;
  else b.y = ny > 0 ? -TABLE.halfH + b.r : TABLE.halfH - b.r;
  b.vx *= 0.2;
  b.vy *= 0.2;
  bounceRail(b, nx, ny);
  b.vx *= 0.35;
  b.vy *= 0.35;
  return 'hit';
}

function resolveCushions(b) {
  if (captureIfInPocketWell(b)) return 'pocketed';

  const maxX = TABLE.halfW - b.r;
  const maxY = TABLE.halfH - b.r;
  let hit = false;
  const skipRail = shouldSkipRailForPocket(b);
  const apronX = TABLE.halfW + TABLE.pocketOut + TABLE.pocketR * 0.85;
  const apronY = TABLE.halfH + TABLE.pocketOutSide + TABLE.pocketR * 0.85;

  // Off-felt pockets: skip the rail only at the cutout; otherwise bounce.
  if (b.x < -maxX) {
    if (railOpenAt(b, 'left') || skipRail) {
      const r = hitApronLimit(b, 1, 0, -apronX, true);
      if (r === 'pocketed') return 'pocketed';
      if (r) hit = true;
    } else {
      b.x = -maxX;
      bounceRail(b, 1, 0);
      hit = true;
    }
  } else if (b.x > maxX) {
    if (railOpenAt(b, 'right') || skipRail) {
      const r = hitApronLimit(b, -1, 0, apronX, true);
      if (r === 'pocketed') return 'pocketed';
      if (r) hit = true;
    } else {
      b.x = maxX;
      bounceRail(b, -1, 0);
      hit = true;
    }
  }

  if (b.pocketed) return 'pocketed';

  if (b.y < -maxY) {
    if (railOpenAt(b, 'top') || skipRail) {
      const r = hitApronLimit(b, 0, 1, -apronY, false);
      if (r === 'pocketed') return 'pocketed';
      if (r) hit = true;
    } else {
      b.y = -maxY;
      bounceRail(b, 0, 1);
      hit = true;
    }
  } else if (b.y > maxY) {
    if (railOpenAt(b, 'bottom') || skipRail) {
      const r = hitApronLimit(b, 0, -1, apronY, false);
      if (r === 'pocketed') return 'pocketed';
      if (r) hit = true;
    } else {
      b.y = maxY;
      bounceRail(b, 0, -1);
      hit = true;
    }
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

function beginPocketFall(b, p) {
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
}

function tryPocket(b, dt) {
  if (captureIfInPocketWell(b)) return true;

  for (const p of pockets) {
    const dist = Math.hypot(b.x - p.x, b.y - p.y);
    const mouth = p.corner
      ? TABLE.pocketMouthCorner || TABLE.pocketMouth
      : TABLE.pocketMouth * 0.95;
    const jaw = p.corner ? TABLE.pocketJaw * 1.2 : TABLE.pocketJaw;

    // Funnel into the hole when in the jaw — stronger near the tip so corner
    // clips drop instead of rattling back onto the felt.
    if (dist < jaw && dist > mouth) {
      const inv = 1 / (dist || 1);
      const nx = (p.x - b.x) * inv;
      const ny = (p.y - b.y) * inv;
      const toward = b.vx * nx + b.vy * ny;
      const spd = Math.hypot(b.vx, b.vy);
      const offFelt =
        Math.abs(b.x) > TABLE.halfW - b.r * 0.35 ||
        Math.abs(b.y) > TABLE.halfH - b.r * 0.35;
      if (toward > 0 || (offFelt && toward > -28) || (spd < 14 && dist < jaw * 0.8)) {
        const pull = p.corner ? 110 : 64;
        b.vx += nx * pull * dt;
        b.vy += ny * pull * dt;
        // Kill fleeing speed so a tip graze / apron skim cannot bounce out.
        if (toward < 0 && offFelt) {
          b.vx -= nx * toward;
          b.vy -= ny * toward;
        }
      }
    }

    const offTable =
      Math.abs(b.x) > TABLE.halfW + 0.25 || Math.abs(b.y) > TABLE.halfH + 0.25;
    // Off-felt near the hole ⇒ sunk (this is past the wedge into the pocket).
    const inHole =
      offTable && dist < (p.corner ? jaw * 0.92 : jaw * 0.8);
    if (dist < mouth || inHole) {
      beginPocketFall(b, p);
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
