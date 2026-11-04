/* Ghost-ball aim prediction: contact circle + object/cue leave angles. */

import { BALL_R } from './content.js';

/**
 * Cast aim ray from cue; return first object hit and predicted paths.
 * @param {{x:number,y:number,r:number}} cue
 * @param {Array<{id:number,x:number,y:number,r:number,pocketed:boolean}>} balls
 * @param {number} dirX
 * @param {number} dirY
 * @param {{x:number,y:number}} [english] tip offset -1..1 for cue-path bias preview
 */
export function predictAim(cue, balls, dirX, dirY, english = { x: 0, y: 0 }) {
  const len = Math.hypot(dirX, dirY);
  if (!cue || len < 1e-8) return null;
  const nx = dirX / len;
  const ny = dirY / len;

  let bestT = Infinity;
  let target = null;

  for (const b of balls) {
    if (b.pocketed || b.id === cue.id) continue;
    const hit = rayCircle(cue.x, cue.y, nx, ny, b.x, b.y, cue.r + b.r);
    if (hit != null && hit > 0.02 && hit < bestT) {
      bestT = hit;
      target = b;
    }
  }

  // Aim line end: first hit or far table cast.
  const aimDist = target ? bestT : 220;
  const aimEnd = { x: cue.x + nx * aimDist, y: cue.y + ny * aimDist };

  if (!target) {
    return {
      nx,
      ny,
      aimEnd,
      ghost: null,
      target: null,
      contact: null,
      objectDir: null,
      cueDir: null,
      cutDeg: null,
    };
  }

  const gx = cue.x + nx * bestT;
  const gy = cue.y + ny * bestT;
  const ghost = { x: gx, y: gy, r: cue.r };

  let ox = target.x - gx;
  let oy = target.y - gy;
  const ol = Math.hypot(ox, oy) || 1;
  ox /= ol;
  oy /= ol;

  // Contact point on the object ball surface.
  const contact = {
    x: target.x - ox * target.r,
    y: target.y - oy * target.r,
  };

  // Object leaves along collision normal.
  const objectDir = { x: ox, y: oy };

  // Stun 90° rule: cue leaves along tangent; english biases it.
  let tx = -oy;
  let ty = ox;
  // Pick the tangent closer to the original aim (natural deflection side).
  if (tx * nx + ty * ny < 0) {
    tx = -tx;
    ty = -ty;
  }
  // Mix in follow/draw and a touch of side for the preview.
  const follow = Math.max(-1, Math.min(1, english.y || 0));
  const side = Math.max(-1, Math.min(1, english.x || 0));
  let cx = tx * (0.85 - Math.abs(follow) * 0.35) + nx * (follow * 0.55);
  let cy = ty * (0.85 - Math.abs(follow) * 0.35) + ny * (follow * 0.55);
  cx += -ny * side * 0.35;
  cy += nx * side * 0.35;
  const cl = Math.hypot(cx, cy) || 1;
  const cueDir = { x: cx / cl, y: cy / cl };

  // Cut angle: deviation of object path from aim line.
  const cutCos = Math.max(-1, Math.min(1, ox * nx + oy * ny));
  const cutDeg = (Math.acos(cutCos) * 180) / Math.PI;

  return {
    nx,
    ny,
    aimEnd,
    ghost,
    target,
    contact,
    objectDir,
    cueDir,
    cutDeg,
  };
}

function rayCircle(ox, oy, dx, dy, cx, cy, r) {
  const fx = ox - cx;
  const fy = oy - cy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - 4 * c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t1 = (-b - s) / 2;
  const t2 = (-b + s) / 2;
  if (t1 > 0.01) return t1;
  if (t2 > 0.01) return t2;
  return null;
}

/** Useful for tests: straight-on ghost sits 2R behind the object along the line. */
export function ghostForStraight(cue, target) {
  const dx = target.x - cue.x;
  const dy = target.y - cue.y;
  const d = Math.hypot(dx, dy) || 1;
  const nx = dx / d;
  const ny = dy / d;
  const gap = cue.r + target.r;
  return {
    x: target.x - nx * gap,
    y: target.y - ny * gap,
    r: BALL_R,
  };
}
