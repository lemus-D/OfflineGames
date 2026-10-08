/* Procedural canvas drawing — dusk woodland chase. */

import { COLORS, OBSTACLES, RUN } from './content.js';
import { project, projectSession, pathBend } from './play.js';
import { lerp } from '../core/rng.js';

export function drawSky(g, W, H, anim = 0) {
  const grad = g.createLinearGradient(0, 0, 0, H * 0.62);
  grad.addColorStop(0, COLORS.skyTop);
  grad.addColorStop(0.45, COLORS.skyMid);
  grad.addColorStop(1, COLORS.skyBot);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H * 0.62);

  // Soft sun disc on the horizon.
  const sunX = W * 0.72 + Math.sin(anim * 0.05) * 8;
  const sunY = H * 0.4;
  const sun = g.createRadialGradient(sunX, sunY, 4, sunX, sunY, H * 0.16);
  sun.addColorStop(0, 'rgba(255, 220, 140, 0.85)');
  sun.addColorStop(0.4, 'rgba(255, 160, 80, 0.35)');
  sun.addColorStop(1, 'rgba(255, 120, 40, 0)');
  g.fillStyle = sun;
  g.beginPath();
  g.arc(sunX, sunY, H * 0.16, 0, Math.PI * 2);
  g.fill();

  // Far ridgeline.
  g.fillStyle = COLORS.hillFar;
  g.beginPath();
  g.moveTo(0, H * 0.46);
  for (let i = 0; i <= 12; i++) {
    const x = (i / 12) * W;
    const y = H * 0.4 + Math.sin(i * 1.3 + 0.4) * H * 0.028;
    g.lineTo(x, y);
  }
  g.lineTo(W, H * 0.62);
  g.lineTo(0, H * 0.62);
  g.closePath();
  g.fill();

  g.fillStyle = COLORS.hillNear;
  g.beginPath();
  g.moveTo(0, H * 0.5);
  for (let i = 0; i <= 10; i++) {
    const x = (i / 10) * W;
    const y = H * 0.46 + Math.sin(i * 1.9 + 2) * H * 0.022;
    g.lineTo(x, y);
  }
  g.lineTo(W, H * 0.62);
  g.lineTo(0, H * 0.62);
  g.closePath();
  g.fill();
}

function samplePath(camZ, seed, W, H, steps = 28) {
  const bendCam = pathBend(camZ, seed);
  const left = [];
  const right = [];
  const center = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const z = camZ - 1.2 + u * (RUN.far * 0.95);
    const bend = pathBend(z, seed);
    const L = project(-0.55, z, camZ, W, H, 0, bendCam, bend);
    const R = project(2.55, z, camZ, W, H, 0, bendCam, bend);
    const C = project(1, z, camZ, W, H, 0, bendCam, bend);
    left.push(L);
    right.push(R);
    center.push(C);
  }
  return { left, right, center, bendCam };
}

export function drawPath(g, W, H, camZ, anim, seed = 0x5eed) {
  const horizonY = H * 0.26;

  // Side meadow fill.
  const meadow = g.createLinearGradient(0, horizonY, 0, H);
  meadow.addColorStop(0, COLORS.grassL);
  meadow.addColorStop(1, COLORS.grassDark);
  g.fillStyle = meadow;
  g.fillRect(0, horizonY, W, H - horizonY);

  const { left, right, center } = samplePath(camZ, seed, W, H, 32);

  // Path ribbon (curved).
  g.beginPath();
  g.moveTo(left[0].x, left[0].y);
  for (let i = 1; i < left.length; i++) g.lineTo(left[i].x, left[i].y);
  for (let i = right.length - 1; i >= 0; i--) g.lineTo(right[i].x, right[i].y);
  g.closePath();
  const pathGrad = g.createLinearGradient(0, horizonY, 0, H);
  pathGrad.addColorStop(0, COLORS.pathMid);
  pathGrad.addColorStop(0.55, COLORS.path);
  pathGrad.addColorStop(1, COLORS.pathDark);
  g.fillStyle = pathGrad;
  g.fill();

  // Ink edge.
  g.strokeStyle = COLORS.pathEdge;
  g.lineWidth = 2.5;
  g.globalAlpha = 0.55;
  g.beginPath();
  g.moveTo(left[0].x, left[0].y);
  for (let i = 1; i < left.length; i++) g.lineTo(left[i].x, left[i].y);
  g.stroke();
  g.beginPath();
  g.moveTo(right[0].x, right[0].y);
  for (let i = 1; i < right.length; i++) g.lineTo(right[i].x, right[i].y);
  g.stroke();
  g.globalAlpha = 1;

  // Lane dashes that follow the bend.
  g.strokeStyle = COLORS.laneLine;
  g.lineWidth = 2;
  g.setLineDash([10, 14]);
  for (const laneEdge of [0.5, 1.5]) {
    g.beginPath();
    let started = false;
    for (let i = 0; i < 22; i++) {
      const z = camZ + 1.2 + i * 2.1;
      const bend = pathBend(z, seed);
      const p = project(laneEdge, z, camZ, W, H, 0, pathBend(camZ, seed), bend);
      if (!p.onScreen) continue;
      if (!started) {
        g.moveTo(p.x, p.y);
        started = true;
      } else g.lineTo(p.x, p.y);
    }
    g.stroke();
  }
  g.setLineDash([]);

  // Trees / stones hugging the outside of the curve.
  for (let i = 0; i < 14; i++) {
    const z = camZ + 3 + ((i * 4.8 - (camZ * 0.85) % 4.8 + 4.8) % 4.8);
    const bend = pathBend(z, seed);
    const bendCam = pathBend(camZ, seed);
    for (const side of [-1, 1]) {
      const p = project(1 + side * 2.15, z, camZ, W, H, 0, bendCam, bend);
      if (!p.onScreen || p.scale < 0.08) continue;
      const s = p.scale;
      // Pine
      g.fillStyle = COLORS.ink;
      g.fillRect(p.x - 3 * s, p.y - 55 * s, 6 * s, 40 * s);
      g.fillStyle = i % 2 ? '#1a4a28' : '#243e2a';
      g.beginPath();
      g.moveTo(p.x, p.y - 110 * s);
      g.lineTo(p.x + 28 * s, p.y - 40 * s);
      g.lineTo(p.x - 28 * s, p.y - 40 * s);
      g.closePath();
      g.fill();
      g.fillStyle = i % 3 ? '#2a6a38' : '#1e5530';
      g.beginPath();
      g.moveTo(p.x, p.y - 95 * s);
      g.lineTo(p.x + 22 * s, p.y - 48 * s);
      g.lineTo(p.x - 22 * s, p.y - 48 * s);
      g.closePath();
      g.fill();
    }
  }

  // Near ground vignette.
  const shade = g.createLinearGradient(0, H * 0.75, 0, H);
  shade.addColorStop(0, 'rgba(10, 8, 6, 0)');
  shade.addColorStop(1, 'rgba(10, 8, 6, 0.35)');
  g.fillStyle = shade;
  g.fillRect(0, H * 0.7, W, H * 0.3);

  void center;
  void anim;
}

export function drawObstacle(g, kind, x, y, scale) {
  const def = OBSTACLES[kind];
  const w = def.w * 95 * scale;
  const h = def.h * 95 * scale;

  if (kind === 'log') {
    g.fillStyle = COLORS.log;
    g.beginPath();
    g.ellipse(x, y - h * 0.35, w * 0.55, h * 0.45, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = COLORS.ink;
    g.lineWidth = Math.max(1, 1.5 * scale);
    g.stroke();
    g.fillStyle = COLORS.logRing;
    g.beginPath();
    g.ellipse(x - w * 0.4, y - h * 0.35, h * 0.32, h * 0.38, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  } else if (kind === 'rock') {
    g.fillStyle = COLORS.rock;
    g.beginPath();
    g.moveTo(x - w * 0.5, y);
    g.quadraticCurveTo(x - w * 0.55, y - h, x, y - h * 1.05);
    g.quadraticCurveTo(x + w * 0.55, y - h, x + w * 0.5, y);
    g.closePath();
    g.fill();
    g.strokeStyle = COLORS.ink;
    g.lineWidth = Math.max(1, 1.5 * scale);
    g.stroke();
    g.fillStyle = COLORS.rockLite;
    g.globalAlpha = 0.35;
    g.beginPath();
    g.ellipse(x - w * 0.12, y - h * 0.55, w * 0.15, h * 0.12, -0.4, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  } else {
    g.fillStyle = COLORS.hedge;
    g.beginPath();
    g.moveTo(x - w * 0.5, y);
    g.lineTo(x - w * 0.45, y - h * 0.7);
    g.quadraticCurveTo(x, y - h * 1.15, x + w * 0.45, y - h * 0.7);
    g.lineTo(x + w * 0.5, y);
    g.closePath();
    g.fill();
    g.strokeStyle = COLORS.ink;
    g.lineWidth = Math.max(1, 1.5 * scale);
    g.stroke();
    g.fillStyle = COLORS.hedgeLite;
    g.beginPath();
    g.ellipse(x - w * 0.2, y - h * 0.75, w * 0.22, h * 0.22, 0, 0, Math.PI * 2);
    g.ellipse(x + w * 0.18, y - h * 0.8, w * 0.25, h * 0.25, 0, 0, Math.PI * 2);
    g.ellipse(x, y - h * 0.95, w * 0.2, h * 0.2, 0, 0, Math.PI * 2);
    g.fill();
  }
}

export function drawCarrot(g, x, y, scale, t) {
  const bob = Math.sin(t * 5) * 5 * scale;
  const s = 28 * scale;
  g.save();
  g.translate(x, y - bob - s * 0.35);

  // Soft glow so pickups read at distance.
  g.fillStyle = COLORS.carrotGlow;
  g.beginPath();
  g.ellipse(0, 0, s * 0.9, s * 0.7, 0, 0, Math.PI * 2);
  g.fill();

  g.fillStyle = COLORS.carrot;
  g.beginPath();
  g.moveTo(0, s * 1.0);
  g.quadraticCurveTo(-s * 0.5, s * 0.15, 0, -s * 0.55);
  g.quadraticCurveTo(s * 0.5, s * 0.15, 0, s * 1.0);
  g.closePath();
  g.fill();
  g.fillStyle = COLORS.carrotDeep;
  g.globalAlpha = 0.35;
  g.beginPath();
  g.moveTo(0, s * 0.95);
  g.quadraticCurveTo(-s * 0.22, s * 0.2, 0, -s * 0.3);
  g.quadraticCurveTo(s * 0.05, s * 0.2, 0, s * 0.95);
  g.fill();
  g.globalAlpha = 1;

  g.strokeStyle = COLORS.ink;
  g.lineWidth = Math.max(1, 1.4 * scale);
  g.beginPath();
  g.moveTo(0, s * 1.0);
  g.quadraticCurveTo(-s * 0.5, s * 0.15, 0, -s * 0.55);
  g.quadraticCurveTo(s * 0.5, s * 0.15, 0, s * 1.0);
  g.stroke();

  g.fillStyle = COLORS.carrotTop;
  for (const ox of [-0.28, 0, 0.28]) {
    g.beginPath();
    g.ellipse(ox * s, -s * 0.78, s * 0.14, s * 0.4, ox * 0.7, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/**
 * Rabbit run cycle — rear/¾ view with hopping gait.
 * @param {number} phase run cycle radians
 */
export function drawRabbit(g, x, y, scale, phase, jumpY = 0) {
  const s = 42 * scale;
  const run = jumpY > 0.08 ? 0.15 : 1;
  const bob = Math.abs(Math.sin(phase)) * 7 * scale * run;
  const stretch = Math.sin(phase * 2) * 0.04;
  const legA = Math.sin(phase) * 10 * scale * run;
  const legB = Math.sin(phase + Math.PI) * 10 * scale * run;
  const earFlop = Math.sin(phase) * 3 * scale;

  g.save();
  g.translate(x, y - bob - jumpY * 46 * scale);
  g.scale(1 + stretch, 1 - stretch);

  // Shadow
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.beginPath();
  g.ellipse(0, bob + 12 * scale, 20 * scale, 7 * scale, 0, 0, Math.PI * 2);
  g.fill();

  // Hind legs (pushing)
  g.fillStyle = COLORS.rabbitShade;
  g.beginPath();
  g.ellipse(-11 * scale, 12 * scale + legA * 0.2, 8 * scale, 5 * scale, -0.4 + legA * 0.03, 0, Math.PI * 2);
  g.ellipse(11 * scale, 12 * scale + legB * 0.2, 8 * scale, 5 * scale, 0.4 - legB * 0.03, 0, Math.PI * 2);
  g.fill();

  // Forepaws
  g.beginPath();
  g.ellipse(-8 * scale, 6 * scale - legB * 0.15, 5 * scale, 4 * scale, 0, 0, Math.PI * 2);
  g.ellipse(8 * scale, 6 * scale - legA * 0.15, 5 * scale, 4 * scale, 0, 0, Math.PI * 2);
  g.fill();

  // Body
  g.fillStyle = COLORS.rabbit;
  g.beginPath();
  g.ellipse(0, 0, 17 * scale, 15 * scale, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = COLORS.ink;
  g.lineWidth = Math.max(1.2, 1.6 * scale);
  g.stroke();

  // Head
  g.beginPath();
  g.ellipse(0, -15 * scale, 13 * scale, 12 * scale, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  // Ears
  g.fillStyle = COLORS.rabbitEar;
  g.beginPath();
  g.ellipse(-8 * scale, -34 * scale + earFlop, 5.5 * scale, 16 * scale, -0.18, 0, Math.PI * 2);
  g.ellipse(8 * scale, -34 * scale - earFlop, 5.5 * scale, 16 * scale, 0.18, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = COLORS.rabbitPink;
  g.beginPath();
  g.ellipse(-8 * scale, -34 * scale + earFlop, 2.4 * scale, 9 * scale, -0.18, 0, Math.PI * 2);
  g.ellipse(8 * scale, -34 * scale - earFlop, 2.4 * scale, 9 * scale, 0.18, 0, Math.PI * 2);
  g.fill();

  // Face
  g.fillStyle = COLORS.rabbitEye;
  g.beginPath();
  g.arc(-5.5 * scale, -16 * scale, 2.4 * scale, 0, Math.PI * 2);
  g.arc(5.5 * scale, -16 * scale, 2.4 * scale, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = COLORS.rabbitPink;
  g.beginPath();
  g.ellipse(0, -11 * scale, 3.2 * scale, 2.2 * scale, 0, 0, Math.PI * 2);
  g.fill();

  // Tail
  g.fillStyle = '#fff8f0';
  g.beginPath();
  g.arc(0, 14 * scale + Math.sin(phase) * 2 * scale, 6 * scale, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = COLORS.ink;
  g.stroke();

  g.restore();
  void s;
}

/**
 * Big predatory fox run cycle — heavier, lower, glowing eyes.
 */
export function drawFox(g, x, y, scale, phase, snarl = false) {
  const s = scale;
  const bob = Math.abs(Math.sin(phase)) * 6 * s;
  const stretch = Math.sin(phase * 2) * 0.06;
  const legF = Math.sin(phase) * 14 * s;
  const legB = Math.sin(phase + Math.PI) * 14 * s;
  const tailLash = Math.sin(phase * 1.3) * 10 * s;
  const jaw = snarl ? 1 : 0.35 + Math.max(0, Math.sin(phase * 0.5)) * 0.25;

  g.save();
  g.translate(x, y - bob);
  g.scale(1 + stretch, 1 - stretch * 0.6);

  // Heavy shadow
  g.fillStyle = 'rgba(0,0,0,0.4)';
  g.beginPath();
  g.ellipse(0, bob + 16 * s, 38 * s, 10 * s, 0, 0, Math.PI * 2);
  g.fill();

  // Back legs
  g.fillStyle = COLORS.foxDark;
  g.beginPath();
  g.ellipse(-20 * s, 14 * s + legB * 0.15, 10 * s, 7 * s, -0.35, 0, Math.PI * 2);
  g.ellipse(8 * s, 14 * s + legF * 0.15, 10 * s, 7 * s, 0.2, 0, Math.PI * 2);
  g.fill();

  // Front legs reaching
  g.fillStyle = COLORS.foxMid;
  g.beginPath();
  g.ellipse(-6 * s, 10 * s - legF * 0.2, 8 * s, 6 * s, 0.15, 0, Math.PI * 2);
  g.ellipse(18 * s, 8 * s - legB * 0.2, 8 * s, 6 * s, -0.1, 0, Math.PI * 2);
  g.fill();

  // Long body
  g.fillStyle = COLORS.fox;
  g.beginPath();
  g.ellipse(0, 0, 36 * s, 20 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = COLORS.ink;
  g.lineWidth = Math.max(1.4, 2 * s);
  g.stroke();

  // Shoulder hump
  g.fillStyle = COLORS.foxMid;
  g.beginPath();
  g.ellipse(10 * s, -8 * s, 16 * s, 12 * s, -0.2, 0, Math.PI * 2);
  g.fill();

  // Head — large, low, predatory
  g.fillStyle = COLORS.fox;
  g.beginPath();
  g.moveTo(-6 * s, -6 * s);
  g.lineTo(8 * s, -28 * s);
  g.lineTo(30 * s, -8 * s);
  g.quadraticCurveTo(18 * s, 6 * s, -6 * s, -6 * s);
  g.closePath();
  g.fill();
  g.stroke();

  // Ears — tall sharp
  g.fillStyle = COLORS.foxDark;
  g.beginPath();
  g.moveTo(2 * s, -22 * s);
  g.lineTo(-2 * s, -44 * s);
  g.lineTo(14 * s, -26 * s);
  g.closePath();
  g.moveTo(16 * s, -22 * s);
  g.lineTo(22 * s, -46 * s);
  g.lineTo(28 * s, -20 * s);
  g.closePath();
  g.fill();
  g.stroke();

  // Chest / muzzle
  g.fillStyle = COLORS.foxWhite;
  g.beginPath();
  g.ellipse(4 * s, 6 * s, 14 * s, 11 * s, 0, 0, Math.PI * 2);
  g.ellipse(18 * s, -2 * s, 10 * s, 7 * s, 0.1, 0, Math.PI * 2);
  g.fill();

  // Glowing eyes
  g.fillStyle = COLORS.foxEyeGlow;
  g.beginPath();
  g.ellipse(8 * s, -14 * s, 7 * s, 5 * s, 0, 0, Math.PI * 2);
  g.ellipse(20 * s, -14 * s, 7 * s, 5 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = COLORS.foxEye;
  g.beginPath();
  g.ellipse(8 * s, -14 * s, 4 * s, 3.2 * s, 0, 0, Math.PI * 2);
  g.ellipse(20 * s, -14 * s, 4 * s, 3.2 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = COLORS.ink;
  g.beginPath();
  g.ellipse(8 * s, -14 * s, 1.4 * s, 2.8 * s, 0, 0, Math.PI * 2);
  g.ellipse(20 * s, -14 * s, 1.4 * s, 2.8 * s, 0, 0, Math.PI * 2);
  g.fill();

  // Snarl / open jaw
  g.fillStyle = COLORS.ink;
  g.beginPath();
  g.ellipse(18 * s, 2 * s, 7 * s, 4 * s * jaw, 0, 0, Math.PI * 2);
  g.fill();
  if (snarl || jaw > 0.5) {
    g.fillStyle = '#f4f0e8';
    g.fillRect(14 * s, -2 * s, 3.2 * s, 5 * s);
    g.fillRect(19 * s, -2 * s, 3.2 * s, 5 * s);
    g.fillStyle = '#c04040';
    g.beginPath();
    g.ellipse(18 * s, 4 * s, 4 * s, 2 * s, 0, 0, Math.PI * 2);
    g.fill();
  }

  // Big lashing tail
  g.fillStyle = COLORS.fox;
  g.beginPath();
  g.moveTo(-28 * s, 2 * s);
  g.quadraticCurveTo(-55 * s + tailLash, -18 * s, -48 * s, 18 * s + tailLash * 0.3);
  g.quadraticCurveTo(-34 * s, 14 * s, -28 * s, 2 * s);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = COLORS.foxWhite;
  g.beginPath();
  g.ellipse(-50 * s + tailLash * 0.3, 14 * s, 9 * s, 7 * s, 0.3, 0, Math.PI * 2);
  g.fill();

  g.restore();
}

export function drawCollectFx(g, fx, session, W, H) {
  const p = projectSession(session, fx.lane, fx.z, W, H);
  const u = fx.age / fx.life;
  const x = p.x + fx.vx * fx.age * 0.02;
  const y = p.y + fx.vy * fx.age * 0.02 - 20 * u;
  g.globalAlpha = 1 - u;
  g.fillStyle = COLORS.carrot;
  g.beginPath();
  g.arc(x, y, 4 * p.scale * (1.2 - u), 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
}

export function drawHitFlash(g, W, H, flash) {
  if (flash <= 0) return;
  g.fillStyle = `rgba(180, 30, 20, ${flash * 0.5})`;
  g.fillRect(0, 0, W, H);
}

export function drawWorld(g, W, H, session, anim) {
  const cam = session.distance;
  const seed = session.seed;
  drawSky(g, W, H, anim);
  drawPath(g, W, H, cam, anim, seed);

  /** @type {Array<{z:number, draw:()=>void}>} */
  const stack = [];

  for (const o of session.obstacles) {
    if (o.hit) continue;
    const p = projectSession(session, o.lane, o.z, W, H);
    if (!p.onScreen) continue;
    stack.push({
      z: o.z,
      draw: () => drawObstacle(g, o.kind, p.x, p.y, p.scale),
    });
  }
  for (const c of session.pickups) {
    if (c.taken) continue;
    const p = projectSession(session, c.lane, c.z, W, H);
    if (!p.onScreen) continue;
    stack.push({
      z: c.z,
      draw: () => drawCarrot(g, p.x, p.y, Math.max(0.35, p.scale * 1.15), anim),
    });
  }

  stack.sort((a, b) => a.z - b.z);
  for (const item of stack) item.draw();

  for (const fx of session.collectFx) drawCollectFx(g, fx, session, W, H);

  // Both runners follow the same bent ribbon.
  const close = 1 - Math.min(
    1,
    Math.max(0, session.foxGap - RUN.foxCatchGap) /
      (RUN.foxBaseGap - RUN.foxCatchGap)
  );
  const rabbitZ = cam + 0.35;
  const foxZ = cam - session.foxGap * 0.55;
  const rabbitP = projectSession(session, session.laneVisual, rabbitZ, W, H, session.jumpY);
  const foxP = projectSession(session, session.laneVisual, Math.max(foxZ, cam - 4.5), W, H);

  // Screen anchors keep them readable; X still follows the turn.
  const rabbitY = lerp(H * 0.7, rabbitP.y, 0.25) - session.jumpY * H * 0.1;
  const foxY = lerp(H * 0.9, H * 0.78, close);
  // Fox is intentionally huge vs the rabbit.
  const foxScale = lerp(1.55, 2.25, close);
  const snarl = close > 0.25;

  drawFox(g, foxP.x, foxY, foxScale, session.foxHop, snarl);
  drawRabbit(g, rabbitP.x, rabbitY, 1.05, session.hopPhase, session.jumpY);

  // Bank the whole chase slightly into the turn (camera lean).
  // Applied by shifting already-drawn? Skip post-transform; X bend is enough.

  drawHitFlash(g, W, H, session.flash);
}
