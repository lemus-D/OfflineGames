/* Seeded AI shot picker. Difficulty rows live in content.js. */

import { DIFFICULTIES, pocketCenters, TABLE } from './content.js';

/**
 * Choose a shot for the AI.
 * @param {import('./play.js').PlaySession} session
 * @param {string} difficultyId
 * @param {() => number} rng seeded 0..1
 * @returns {{ dx: number, dy: number, power: number, english: {x:number,y:number} }}
 */
export function chooseAiShot(session, difficultyId, rng) {
  const diff = DIFFICULTIES[difficultyId] || DIFFICULTIES.medium;
  const cue = session.cue;
  const pockets = pocketCenters();
  const candidates = [];

  // Only shoot the shooter's legal group (or any color while the table is open).
  const targets = session.legalTargets ? session.legalTargets() : session.objectBalls;
  for (const ball of targets) {
    if (ball.pocketed || ball.falling) continue;
    for (const pocket of pockets) {
      const shot = lineUpShot(cue, ball, pocket, session.balls);
      if (!shot) continue;
      // Prefer finishing the 8 when it is legal.
      if (ball.kind === 'eight') shot.score += 12;
      candidates.push(shot);
    }
  }

  // Break / scramble fallback — aim at pack centroid or nearest ball.
  if (!candidates.length) {
    return scrambleShot(session, diff, rng);
  }

  candidates.sort((a, b) => b.score - a.score);

  // Easy/medium sometimes skip the best line on purpose.
  let pick = candidates[0];
  if (rng() < diff.missBias && candidates.length > 1) {
    const idx = 1 + Math.floor(rng() * Math.min(4, candidates.length - 1));
    pick = candidates[idx];
  }

  // Aim jitter (radians-ish via perpendicular offset).
  const jitter = (rng() - 0.5) * 2 * diff.aimJitter;
  const px = -pick.ny * jitter;
  const py = pick.nx * jitter;
  let dx = pick.nx + px;
  let dy = pick.ny + py;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;

  let power = pick.power * diff.powerMul;
  power += (rng() - 0.5) * 2 * diff.powerJitter;
  power = Math.max(0.18, Math.min(1, power));

  // Hard sometimes uses a touch of side; easy almost never.
  const english = { x: 0, y: 0 };
  if (diff.id === 'hard' && rng() < 0.35) {
    english.x = (rng() - 0.5) * 0.35;
  } else if (diff.id === 'medium' && rng() < 0.15) {
    english.x = (rng() - 0.5) * 0.2;
  }

  return { dx, dy, power, english };
}

function lineUpShot(cue, ball, pocket, balls) {
  // Ghost-ball aim: cue → point behind object along object→pocket line.
  const ox = pocket.x - ball.x;
  const oy = pocket.y - ball.y;
  const od = Math.hypot(ox, oy);
  if (od < 1) return null;
  const onx = ox / od;
  const ony = oy / od;

  const ghostX = ball.x - onx * (cue.r + ball.r);
  const ghostY = ball.y - ony * (cue.r + ball.r);

  let dx = ghostX - cue.x;
  let dy = ghostY - cue.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.5) return null;
  const nx = dx / dist;
  const ny = dy / dist;

  // Must be approaching the ghost from the correct side (not through the object).
  const toBall = (ball.x - cue.x) * nx + (ball.y - cue.y) * ny;
  if (toBall < dist - 0.5) return null;

  if (!clearPath(cue.x, cue.y, ghostX, ghostY, cue.r * 0.92, balls, cue.id, ball.id)) {
    return null;
  }
  // Object path toward pocket roughly clear of other balls.
  if (!clearPath(ball.x, ball.y, pocket.x, pocket.y, ball.r * 0.85, balls, cue.id, ball.id)) {
    return null;
  }

  // Prefer shorter cue travel + straighter cuts.
  const cut = Math.abs(nx * onx + ny * ony); // 1 = straight
  const pocketDist = od;
  const score = cut * 40 - dist * 0.08 - pocketDist * 0.03 + (pocket.corner ? 1 : 0.5);

  // Power scales with how far cue and object need to travel.
  const power = Math.max(0.28, Math.min(0.95, 0.22 + dist / 140 + pocketDist / 220));

  return { nx, ny, power, score, ballId: ball.id };
}

function clearPath(x0, y0, x1, y1, radius, balls, ignoreA, ignoreB) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len;
  const ny = dy / len;
  for (const b of balls) {
    if (b.pocketed || b.falling) continue;
    if (b.id === ignoreA || b.id === ignoreB) continue;
    // Distance from segment to ball center.
    const fx = b.x - x0;
    const fy = b.y - y0;
    let t = fx * nx + fy * ny;
    t = Math.max(0, Math.min(len, t));
    const cx = x0 + nx * t;
    const cy = y0 + ny * t;
    if (Math.hypot(b.x - cx, b.y - cy) < radius + b.r) return false;
  }
  // Stay roughly on the table for the cue leg.
  const midX = (x0 + x1) / 2;
  const midY = (y0 + y1) / 2;
  if (Math.abs(midX) > TABLE.halfW + 2 || Math.abs(midY) > TABLE.halfH + 2) {
    // Allow paths that skim toward outside pockets.
  }
  return true;
}

function scrambleShot(session, diff, rng) {
  const cue = session.cue;
  const legal = session.legalTargets
    ? session.legalTargets().filter((b) => !b.pocketed && !b.falling)
    : [];
  const live =
    legal.length > 0
      ? legal
      : session.objectBalls.filter((b) => !b.pocketed && !b.falling && b.kind !== 'eight');
  let tx = TABLE.halfW * 0.35;
  let ty = 0;
  if (live.length) {
    const b = live[Math.floor(rng() * live.length)];
    tx = b.x;
    ty = b.y;
  }
  let dx = tx - cue.x;
  let dy = ty - cue.y;
  const len = Math.hypot(dx, dy) || 1;
  dx = dx / len + (rng() - 0.5) * diff.aimJitter * 2;
  dy = dy / len + (rng() - 0.5) * diff.aimJitter * 2;
  const n = Math.hypot(dx, dy) || 1;
  const power = Math.max(0.35, Math.min(0.9, (0.55 + rng() * 0.35) * diff.powerMul));
  return { dx: dx / n, dy: dy / n, power, english: { x: 0, y: 0 } };
}

export function difficultyThinkSec(id) {
  return (DIFFICULTIES[id] || DIFFICULTIES.medium).thinkSec;
}
