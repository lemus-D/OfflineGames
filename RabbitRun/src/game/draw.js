/* Procedural canvas drawing — rabbit, fox, path, props. */

import { COLORS, OBSTACLES, RUN } from './content.js';
import { project } from './play.js';
import { lerp } from '../core/rng.js';

export function drawSky(g, W, H) {
  const grad = g.createLinearGradient(0, 0, 0, H * 0.55);
  grad.addColorStop(0, COLORS.skyTop);
  grad.addColorStop(1, COLORS.skyBot);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H * 0.55);

  // Soft hills on the horizon.
  g.fillStyle = '#5aa050';
  g.beginPath();
  g.moveTo(0, H * 0.42);
  for (let i = 0; i <= 8; i++) {
    const x = (i / 8) * W;
    const y = H * 0.38 + Math.sin(i * 1.7) * H * 0.03;
    g.lineTo(x, y);
  }
  g.lineTo(W, H * 0.55);
  g.lineTo(0, H * 0.55);
  g.closePath();
  g.fill();
}

export function drawPath(g, W, H, camZ, anim) {
  const horizonY = H * 0.28;
  const groundY = H * 0.98;

  // Side grass.
  g.fillStyle = COLORS.grassL;
  g.fillRect(0, horizonY, W, H - horizonY);

  // Path trapezoid.
  const nearHalf = W * 0.42;
  const farHalf = W * 0.04;
  g.fillStyle = COLORS.path;
  g.beginPath();
  g.moveTo(W * 0.5 - farHalf, horizonY);
  g.lineTo(W * 0.5 + farHalf, horizonY);
  g.lineTo(W * 0.5 + nearHalf, groundY);
  g.lineTo(W * 0.5 - nearHalf, groundY);
  g.closePath();
  g.fill();

  // Lane dashes scrolling with distance.
  g.strokeStyle = COLORS.laneLine;
  g.lineWidth = 2;
  const dashPeriod = 3.2;
  for (let laneEdge = 0.5; laneEdge <= 1.5; laneEdge += 1) {
    g.beginPath();
    for (let i = 0; i < 18; i++) {
      const z0 = camZ + 1.5 + ((i * dashPeriod - (camZ % dashPeriod) + dashPeriod) % dashPeriod);
      const z1 = z0 + dashPeriod * 0.45;
      const a = project(laneEdge, z0, camZ, W, H);
      const b = project(laneEdge, z1, camZ, W, H);
      if (!a.onScreen && !b.onScreen) continue;
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
    }
    g.stroke();
  }

  // Tree silhouettes scrolling on sides.
  g.fillStyle = '#1e4a1c';
  for (let i = 0; i < 12; i++) {
    const z = camZ + 4 + ((i * 5.5 - (camZ * 0.9) % 5.5 + 5.5) % 5.5);
    for (const side of [-1, 1]) {
      const p = project(1 + side * 1.85, z, camZ, W, H);
      if (!p.onScreen) continue;
      const s = p.scale;
      const trunkH = H * 0.18 * s;
      const trunkW = 8 * s;
      g.fillStyle = '#3a2818';
      g.fillRect(p.x - trunkW * 0.5, p.y - trunkH, trunkW, trunkH);
      g.fillStyle = i % 2 === 0 ? '#1e5a20' : '#266828';
      g.beginPath();
      g.ellipse(p.x, p.y - trunkH - 10 * s, 28 * s, 36 * s, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  // Subtle path shading near camera.
  const shade = g.createLinearGradient(0, groundY - 40, 0, groundY);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(40,28,12,0.18)');
  g.fillStyle = shade;
  g.fillRect(0, groundY - 50, W, 60);

  void anim;
}

export function drawObstacle(g, kind, x, y, scale) {
  const def = OBSTACLES[kind];
  const w = def.w * 90 * scale;
  const h = def.h * 90 * scale;

  if (kind === 'log') {
    g.fillStyle = COLORS.log;
    g.beginPath();
    g.ellipse(x, y - h * 0.35, w * 0.55, h * 0.45, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#8a5a30';
    g.beginPath();
    g.ellipse(x - w * 0.35, y - h * 0.35, h * 0.35, h * 0.4, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#d4b890';
    g.beginPath();
    g.ellipse(x - w * 0.35, y - h * 0.35, h * 0.18, h * 0.22, 0, 0, Math.PI * 2);
    g.fill();
  } else if (kind === 'rock') {
    g.fillStyle = COLORS.rock;
    g.beginPath();
    g.moveTo(x - w * 0.5, y);
    g.quadraticCurveTo(x - w * 0.55, y - h, x, y - h * 1.05);
    g.quadraticCurveTo(x + w * 0.55, y - h, x + w * 0.5, y);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.beginPath();
    g.ellipse(x - w * 0.12, y - h * 0.55, w * 0.15, h * 0.12, -0.4, 0, Math.PI * 2);
    g.fill();
  } else {
    // hedge
    g.fillStyle = COLORS.hedge;
    g.beginPath();
    g.moveTo(x - w * 0.5, y);
    g.lineTo(x - w * 0.45, y - h * 0.7);
    g.quadraticCurveTo(x, y - h * 1.15, x + w * 0.45, y - h * 0.7);
    g.lineTo(x + w * 0.5, y);
    g.closePath();
    g.fill();
    g.fillStyle = '#3d8c3a';
    g.beginPath();
    g.ellipse(x - w * 0.2, y - h * 0.75, w * 0.22, h * 0.22, 0, 0, Math.PI * 2);
    g.ellipse(x + w * 0.18, y - h * 0.8, w * 0.25, h * 0.25, 0, 0, Math.PI * 2);
    g.ellipse(x, y - h * 0.95, w * 0.2, h * 0.2, 0, 0, Math.PI * 2);
    g.fill();
  }
}

export function drawCarrot(g, x, y, scale, t) {
  const bob = Math.sin(t * 4) * 4 * scale;
  const s = 22 * scale;
  g.save();
  g.translate(x, y - bob - s * 0.3);
  g.fillStyle = COLORS.carrot;
  g.beginPath();
  g.moveTo(0, s * 0.9);
  g.quadraticCurveTo(-s * 0.45, s * 0.1, 0, -s * 0.5);
  g.quadraticCurveTo(s * 0.45, s * 0.1, 0, s * 0.9);
  g.fill();
  g.fillStyle = COLORS.carrotTop;
  for (const ox of [-0.25, 0, 0.25]) {
    g.beginPath();
    g.ellipse(ox * s, -s * 0.7, s * 0.12, s * 0.35, ox * 0.6, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

export function drawRabbit(g, x, y, scale, hop, jumpY) {
  const s = 38 * scale;
  const bob = Math.abs(Math.sin(hop)) * 6 * scale * (jumpY > 0.05 ? 0.2 : 1);
  g.save();
  g.translate(x, y - bob - jumpY * 40 * scale);

  // Shadow
  g.fillStyle = 'rgba(0,0,0,0.22)';
  g.beginPath();
  g.ellipse(0, bob + 8 * scale, 18 * scale, 6 * scale, 0, 0, Math.PI * 2);
  g.fill();

  // Hind legs
  g.fillStyle = COLORS.rabbitEar;
  g.beginPath();
  g.ellipse(-10 * scale, 10 * scale, 7 * scale, 5 * scale, -0.3, 0, Math.PI * 2);
  g.ellipse(10 * scale, 10 * scale, 7 * scale, 5 * scale, 0.3, 0, Math.PI * 2);
  g.fill();

  // Body
  g.fillStyle = COLORS.rabbit;
  g.beginPath();
  g.ellipse(0, 0, 16 * scale, 14 * scale, 0, 0, Math.PI * 2);
  g.fill();

  // Head
  g.beginPath();
  g.ellipse(0, -14 * scale, 12 * scale, 11 * scale, 0, 0, Math.PI * 2);
  g.fill();

  // Ears
  g.fillStyle = COLORS.rabbitEar;
  g.beginPath();
  g.ellipse(-7 * scale, -32 * scale, 5 * scale, 14 * scale, -0.15, 0, Math.PI * 2);
  g.ellipse(7 * scale, -32 * scale, 5 * scale, 14 * scale, 0.15, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = COLORS.rabbitPink;
  g.beginPath();
  g.ellipse(-7 * scale, -32 * scale, 2.2 * scale, 8 * scale, -0.15, 0, Math.PI * 2);
  g.ellipse(7 * scale, -32 * scale, 2.2 * scale, 8 * scale, 0.15, 0, Math.PI * 2);
  g.fill();

  // Eyes + nose
  g.fillStyle = COLORS.rabbitEye;
  g.beginPath();
  g.arc(-5 * scale, -15 * scale, 2.2 * scale, 0, Math.PI * 2);
  g.arc(5 * scale, -15 * scale, 2.2 * scale, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = COLORS.rabbitPink;
  g.beginPath();
  g.ellipse(0, -10 * scale, 3 * scale, 2 * scale, 0, 0, Math.PI * 2);
  g.fill();

  // Tail fluff
  g.fillStyle = '#fff8f0';
  g.beginPath();
  g.arc(0, 12 * scale, 5 * scale, 0, Math.PI * 2);
  g.fill();

  g.restore();
  void s;
}

export function drawFox(g, x, y, scale, hop, snarl) {
  const bob = Math.abs(Math.sin(hop * 1.15 + 1)) * 5 * scale;
  g.save();
  g.translate(x, y - bob);

  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath();
  g.ellipse(0, bob + 10 * scale, 22 * scale, 7 * scale, 0, 0, Math.PI * 2);
  g.fill();

  // Body
  g.fillStyle = COLORS.fox;
  g.beginPath();
  g.ellipse(0, 2 * scale, 22 * scale, 14 * scale, 0, 0, Math.PI * 2);
  g.fill();

  // Head
  g.beginPath();
  g.moveTo(-14 * scale, -8 * scale);
  g.lineTo(0, -22 * scale);
  g.lineTo(14 * scale, -8 * scale);
  g.quadraticCurveTo(0, -2 * scale, -14 * scale, -8 * scale);
  g.fill();

  // Ears
  g.fillStyle = COLORS.foxDark;
  g.beginPath();
  g.moveTo(-10 * scale, -18 * scale);
  g.lineTo(-14 * scale, -32 * scale);
  g.lineTo(-2 * scale, -20 * scale);
  g.moveTo(10 * scale, -18 * scale);
  g.lineTo(14 * scale, -32 * scale);
  g.lineTo(2 * scale, -20 * scale);
  g.fill();

  // White chest / muzzle
  g.fillStyle = COLORS.foxWhite;
  g.beginPath();
  g.ellipse(0, 4 * scale, 10 * scale, 8 * scale, 0, 0, Math.PI * 2);
  g.ellipse(0, -6 * scale, 7 * scale, 5 * scale, 0, 0, Math.PI * 2);
  g.fill();

  // Eyes
  g.fillStyle = '#1a1008';
  g.beginPath();
  g.ellipse(-5 * scale, -12 * scale, 2.5 * scale, 3 * scale, 0, 0, Math.PI * 2);
  g.ellipse(5 * scale, -12 * scale, 2.5 * scale, 3 * scale, 0, 0, Math.PI * 2);
  g.fill();

  // Snarl mouth when close
  if (snarl) {
    g.fillStyle = '#1a1008';
    g.beginPath();
    g.ellipse(0, -2 * scale, 5 * scale, 3 * scale, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#f0f0f0';
    g.fillRect(-3.5 * scale, -5 * scale, 2.5 * scale, 4 * scale);
    g.fillRect(1 * scale, -5 * scale, 2.5 * scale, 4 * scale);
  }

  // Tail
  g.fillStyle = COLORS.fox;
  g.beginPath();
  g.moveTo(-18 * scale, 4 * scale);
  g.quadraticCurveTo(-40 * scale, -10 * scale, -28 * scale, 16 * scale);
  g.quadraticCurveTo(-20 * scale, 10 * scale, -18 * scale, 4 * scale);
  g.fill();
  g.fillStyle = COLORS.foxWhite;
  g.beginPath();
  g.ellipse(-30 * scale, 12 * scale, 6 * scale, 5 * scale, 0.4, 0, Math.PI * 2);
  g.fill();

  g.restore();
}

export function drawHitFlash(g, W, H, flash) {
  if (flash <= 0) return;
  g.fillStyle = `rgba(200,40,20,${flash * 0.45})`;
  g.fillRect(0, 0, W, H);
}

export function drawWorld(g, W, H, session, anim) {
  const cam = session.distance;
  drawSky(g, W, H);
  drawPath(g, W, H, cam, anim);

  // Collect drawable props sorted far → near.
  /** @type {Array<{z:number, draw:()=>void}>} */
  const stack = [];

  for (const o of session.obstacles) {
    if (o.hit) continue;
    const p = project(o.lane, o.z, cam, W, H);
    if (!p.onScreen) continue;
    stack.push({
      z: o.z,
      draw: () => drawObstacle(g, o.kind, p.x, p.y, p.scale),
    });
  }
  for (const c of session.pickups) {
    if (c.taken) continue;
    const p = project(c.lane, c.z, cam, W, H);
    if (!p.onScreen) continue;
    stack.push({
      z: c.z,
      draw: () => drawCarrot(g, p.x, p.y, p.scale, anim),
    });
  }

  stack.sort((a, b) => a.z - b.z);
  for (const item of stack) item.draw();

  // Fox sits behind the rabbit on screen; gap maps to how close it looms.
  const close = 1 - Math.min(1, Math.max(0, session.foxGap - RUN.foxCatchGap) / (RUN.foxBaseGap - RUN.foxCatchGap));
  const rabbitX = project(session.laneVisual, cam + 0.35, cam, W, H).x;
  const foxY = lerp(H * 0.93, H * 0.84, close);
  const foxScale = lerp(0.95, 1.45, close);
  drawFox(g, rabbitX, foxY, foxScale, session.hopPhase, close > 0.4);

  // Rabbit near camera.
  const rabbitY = H * 0.72 - session.jumpY * H * 0.1;
  drawRabbit(g, rabbitX, rabbitY, 1.1, session.hopPhase, session.jumpY);

  drawHitFlash(g, W, H, session.flash);
}
