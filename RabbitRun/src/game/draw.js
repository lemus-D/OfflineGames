/* Procedural canvas drawing — dusk woodland chase. */

import { COLORS, OBSTACLES, RUN } from './content.js';
import { project, projectSession, pathBend } from './play.js';
import { lerp, clamp } from '../core/rng.js';

export function drawSky(g, W, H, anim = 0) {
  const grad = g.createLinearGradient(0, 0, 0, H * 0.55);
  grad.addColorStop(0, COLORS.skyTop);
  grad.addColorStop(0.35, COLORS.skyMid);
  grad.addColorStop(0.72, '#c87848');
  grad.addColorStop(1, COLORS.skyBot);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H * 0.55);

  // Setting sun — keep the warm band readable above the hills.
  const sunX = W * 0.7 + Math.sin(anim * 0.05) * 8;
  const sunY = H * 0.34;
  const sun = g.createRadialGradient(sunX, sunY, 2, sunX, sunY, H * 0.2);
  sun.addColorStop(0, 'rgba(255, 230, 160, 0.95)');
  sun.addColorStop(0.35, 'rgba(255, 150, 70, 0.45)');
  sun.addColorStop(1, 'rgba(255, 100, 40, 0)');
  g.fillStyle = sun;
  g.beginPath();
  g.arc(sunX, sunY, H * 0.2, 0, Math.PI * 2);
  g.fill();

  // Far ridgeline under the glow.
  g.fillStyle = COLORS.hillFar;
  g.beginPath();
  g.moveTo(0, H * 0.42);
  for (let i = 0; i <= 12; i++) {
    const x = (i / 12) * W;
    const y = H * 0.38 + Math.sin(i * 1.3 + 0.4) * H * 0.024;
    g.lineTo(x, y);
  }
  g.lineTo(W, H * 0.55);
  g.lineTo(0, H * 0.55);
  g.closePath();
  g.fill();

  g.fillStyle = COLORS.hillNear;
  g.beginPath();
  g.moveTo(0, H * 0.48);
  for (let i = 0; i <= 10; i++) {
    const x = (i / 10) * W;
    const y = H * 0.44 + Math.sin(i * 1.9 + 2) * H * 0.02;
    g.lineTo(x, y);
  }
  g.lineTo(W, H * 0.55);
  g.lineTo(0, H * 0.55);
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

  // Packed-earth stripes following the ribbon.
  g.strokeStyle = 'rgba(90, 50, 20, 0.18)';
  g.lineWidth = 3;
  for (let i = 2; i < center.length - 1; i += 2) {
    g.beginPath();
    g.moveTo(left[i].x * 0.35 + center[i].x * 0.65, left[i].y);
    g.lineTo(right[i].x * 0.35 + center[i].x * 0.65, right[i].y);
    g.stroke();
  }

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

  // Pines hugging the outside of the curve — big enough to frame the chase.
  for (let i = 0; i < 14; i++) {
    const z = camZ + 2.5 + ((i * 4.6 - (camZ * 0.85) % 4.6 + 4.6) % 4.6);
    const bend = pathBend(z, seed);
    const bendCam = pathBend(camZ, seed);
    for (const side of [-1, 1]) {
      const p = project(1 + side * 2.0, z, camZ, W, H, 0, bendCam, bend);
      if (!p.onScreen || p.scale < 0.05) continue;
      const s = p.scale * 2.15;
      g.fillStyle = '#2a1a10';
      g.fillRect(p.x - 5 * s, p.y - 85 * s, 10 * s, 70 * s);
      g.fillStyle = i % 2 ? '#163822' : '#1c4530';
      g.beginPath();
      g.moveTo(p.x, p.y - 190 * s);
      g.lineTo(p.x + 52 * s, p.y - 55 * s);
      g.lineTo(p.x - 52 * s, p.y - 55 * s);
      g.closePath();
      g.fill();
      g.fillStyle = i % 3 ? '#245a38' : '#1a4a2c';
      g.beginPath();
      g.moveTo(p.x, p.y - 160 * s);
      g.lineTo(p.x + 42 * s, p.y - 70 * s);
      g.lineTo(p.x - 42 * s, p.y - 70 * s);
      g.closePath();
      g.fill();
      g.fillStyle = '#2f6a40';
      g.beginPath();
      g.moveTo(p.x, p.y - 135 * s);
      g.lineTo(p.x + 30 * s, p.y - 78 * s);
      g.lineTo(p.x - 30 * s, p.y - 78 * s);
      g.closePath();
      g.fill();
      g.strokeStyle = COLORS.ink;
      g.lineWidth = Math.max(1, 1.4 * s);
      g.stroke();
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
  const w = def.w * 125 * scale;
  const h = def.h * 125 * scale;

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
 * Rabbit from behind — fleeing hop.
 * Camera sees: cotton tail, pumping haunches, back, ear backs flopping.
 */
export function drawRabbit(g, x, y, scale, phase, jumpY = 0) {
  const sc = scale;
  const air = jumpY > 0.08;
  const run = air ? 0.25 : 1;
  // Hop: gather (compress) then spring (extend).
  const plant = Math.sin(phase); // -1..1
  const bob = (0.5 + 0.5 * Math.abs(plant)) * 9 * sc * run;
  const squash = air ? 0 : plant * 0.08;
  const sway = Math.sin(phase * 0.5) * 2.5 * sc * run;
  // Hind feet: opposite push — down/back when planting.
  const legL = Math.sin(phase) * 16 * sc * run;
  const legR = Math.sin(phase + Math.PI) * 16 * sc * run;
  const earL = Math.sin(phase + 0.4) * 7 * sc;
  const earR = Math.sin(phase + 0.4 + Math.PI) * 7 * sc;

  g.save();
  g.translate(x + sway, y - bob - jumpY * 48 * sc);
  g.scale(1 + squash, 1 - squash);

  // Shadow under rear
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath();
  g.ellipse(0, bob + 14 * sc, 22 * sc, 7 * sc, 0, 0, Math.PI * 2);
  g.fill();

  // Big hind feet / calves (closest to camera, pumping)
  g.fillStyle = COLORS.rabbitShade;
  g.strokeStyle = COLORS.ink;
  g.lineWidth = Math.max(1.2, 1.5 * sc);
  for (const [sx, leg] of [
    [-1, legL],
    [1, legR],
  ]) {
    const footY = 16 * sc + Math.max(0, leg) * 0.35;
    const push = Math.max(0, -leg) * 0.25; // retracted up when swinging
    g.beginPath();
    g.moveTo(sx * 6 * sc, 4 * sc);
    g.lineTo(sx * 18 * sc, 6 * sc + push);
    g.lineTo(sx * 20 * sc, footY);
    g.lineTo(sx * 8 * sc, footY + 2 * sc);
    g.lineTo(sx * 4 * sc, 10 * sc);
    g.closePath();
    g.fill();
    g.stroke();
    // Pad
    g.fillStyle = COLORS.rabbitPink;
    g.beginPath();
    g.ellipse(sx * 14 * sc, footY + 1 * sc, 5 * sc, 2.5 * sc, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = COLORS.rabbitShade;
  }

  // Haunches — wide rear end
  g.fillStyle = COLORS.rabbit;
  g.beginPath();
  g.ellipse(0, 4 * sc, 20 * sc, 16 * sc, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  // Back / shoulders farther up the trail
  g.beginPath();
  g.ellipse(0, -10 * sc, 14 * sc, 12 * sc, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  // Cotton tail — signature rear-view cue, bouncing on the rump
  const tailBob = Math.sin(phase * 2) * 3 * sc * run;
  g.fillStyle = '#fff8f0';
  g.beginPath();
  g.arc(0, 12 * sc + tailBob, 8 * sc, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = COLORS.ink;
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.beginPath();
  g.arc(-2 * sc, 10 * sc + tailBob, 3 * sc, 0, Math.PI * 2);
  g.fill();

  // Head from behind (no face) — tucked forward
  g.fillStyle = COLORS.rabbit;
  g.beginPath();
  g.ellipse(0, -22 * sc, 11 * sc, 10 * sc, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = COLORS.ink;
  g.stroke();

  // Ears from behind — tall, flopping with the hop (backs of ears)
  for (const [sx, flop] of [
    [-1, earL],
    [1, earR],
  ]) {
    g.save();
    g.translate(sx * 6 * sc, -28 * sc);
    g.rotate(sx * 0.12 + flop * 0.02);
    g.fillStyle = COLORS.rabbitEar;
    g.beginPath();
    g.ellipse(0, -12 * sc + flop * 0.3, 5 * sc, 16 * sc, sx * 0.08, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // Inner pink just peeking at edges
    g.fillStyle = COLORS.rabbitPink;
    g.globalAlpha = 0.45;
    g.beginPath();
    g.ellipse(sx * 1.2 * sc, -12 * sc + flop * 0.3, 2 * sc, 10 * sc, sx * 0.08, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    g.restore();
  }

  g.restore();
}

/**
 * Fox from behind — galloping chase.
 * Camera sees: streaming tail, pounding haunches, back, head up-trail;
 * when close, a shoulder-glance with slit eyes + fangs.
 */
export function drawFox(g, x, y, scale, phase, snarl = false) {
  const s = scale;
  const plant = Math.sin(phase);
  const bob = (0.45 + 0.55 * Math.abs(plant)) * 6 * s;
  const squash = plant * 0.07;
  const sway = Math.sin(phase * 0.5) * 3 * s;
  const legL = Math.sin(phase) * 18 * s;
  const legR = Math.sin(phase + Math.PI) * 18 * s;
  const tailLash = Math.sin(phase * 1.3) * 16 * s;

  g.save();
  g.translate(x + sway, y - bob);
  g.scale(1 + squash * 0.6, 1 - squash * 0.5);

  // Shadow
  g.fillStyle = 'rgba(0,0,0,0.5)';
  g.beginPath();
  g.ellipse(0, bob + 22 * s, 50 * s, 12 * s, 0, 0, Math.PI * 2);
  g.fill();

  // Tail streams toward camera / to the side (between us and the body)
  g.fillStyle = COLORS.foxDark;
  g.strokeStyle = COLORS.ink;
  g.lineWidth = Math.max(1.5, 2.2 * s);
  g.beginPath();
  g.moveTo(0, 10 * s);
  g.quadraticCurveTo(
    -8 * s + tailLash,
    28 * s,
    4 * s + tailLash * 0.4,
    42 * s + Math.abs(tailLash) * 0.15
  );
  g.quadraticCurveTo(18 * s + tailLash * 0.2, 30 * s, 8 * s, 12 * s);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = '#d8c8b0';
  g.beginPath();
  g.moveTo(2 * s + tailLash * 0.35, 36 * s);
  g.lineTo(10 * s + tailLash * 0.4, 48 * s);
  g.lineTo(-6 * s + tailLash * 0.2, 44 * s);
  g.closePath();
  g.fill();

  // Hind legs — big, low, pounding (closest)
  g.fillStyle = COLORS.foxDark;
  for (const [sx, leg] of [
    [-1, legL],
    [1, legR],
  ]) {
    const footY = 20 * s + Math.max(0, leg) * 0.4;
    const lift = Math.max(0, -leg) * 0.3;
    g.beginPath();
    g.moveTo(sx * 8 * s, 2 * s);
    g.lineTo(sx * 26 * s, 4 * s + lift);
    g.lineTo(sx * 28 * s, footY);
    g.lineTo(sx * 12 * s, footY + 2 * s);
    g.lineTo(sx * 4 * s, 12 * s);
    g.closePath();
    g.fill();
    g.stroke();
  }

  // Haunches — wide predator rear
  g.fillStyle = COLORS.fox;
  g.beginPath();
  g.moveTo(-28 * s, 0);
  g.lineTo(-32 * s, 14 * s);
  g.lineTo(0, 20 * s);
  g.lineTo(32 * s, 14 * s);
  g.lineTo(28 * s, 0);
  g.lineTo(18 * s, -10 * s);
  g.lineTo(0, -6 * s);
  g.lineTo(-18 * s, -10 * s);
  g.closePath();
  g.fill();
  g.stroke();

  // Forelegs reaching up-trail under the ribs
  g.fillStyle = COLORS.foxMid;
  for (const [sx, leg] of [
    [-1, legR],
    [1, legL],
  ]) {
    g.beginPath();
    g.moveTo(sx * 4 * s, -4 * s);
    g.lineTo(sx * 12 * s, -8 * s - Math.max(0, -leg) * 0.2);
    g.lineTo(sx * 14 * s, 8 * s - leg * 0.15);
    g.lineTo(sx * 2 * s, 6 * s);
    g.closePath();
    g.fill();
    g.stroke();
  }

  // Torso / shoulders farther up the path
  g.fillStyle = COLORS.foxMid;
  g.beginPath();
  g.moveTo(-16 * s, -8 * s);
  g.lineTo(-12 * s, -22 * s);
  g.lineTo(0, -26 * s);
  g.lineTo(12 * s, -22 * s);
  g.lineTo(16 * s, -8 * s);
  g.lineTo(0, -2 * s);
  g.closePath();
  g.fill();
  g.stroke();

  // Spiked dorsal fur
  g.fillStyle = COLORS.foxDark;
  g.beginPath();
  g.moveTo(-10 * s, -14 * s);
  g.lineTo(-8 * s, -32 * s);
  g.lineTo(0, -20 * s);
  g.lineTo(8 * s, -34 * s);
  g.lineTo(10 * s, -14 * s);
  g.closePath();
  g.fill();

  // Head facing AWAY (up trail) — back of skull + ear backs
  g.fillStyle = COLORS.fox;
  g.beginPath();
  g.ellipse(0, -30 * s, 12 * s, 11 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  // Ear backs (tall points)
  g.fillStyle = COLORS.foxDark;
  g.beginPath();
  g.moveTo(-8 * s, -34 * s);
  g.lineTo(-12 * s, -54 * s);
  g.lineTo(0, -38 * s);
  g.closePath();
  g.moveTo(8 * s, -34 * s);
  g.lineTo(12 * s, -54 * s);
  g.lineTo(0, -38 * s);
  g.closePath();
  g.fill();
  g.stroke();

  // When close: glance over right shoulder — slit eye + fang flash
  if (snarl) {
    g.save();
    g.translate(14 * s, -24 * s);
    g.rotate(-0.55);
    g.fillStyle = COLORS.foxMid;
    g.beginPath();
    g.moveTo(-6 * s, -4 * s);
    g.lineTo(10 * s, -8 * s);
    g.lineTo(14 * s, 4 * s);
    g.lineTo(0, 8 * s);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = COLORS.foxEyeGlow;
    g.beginPath();
    g.ellipse(4 * s, -1 * s, 5 * s, 3 * s, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = COLORS.foxEye;
    g.fillRect(1.5 * s, -1.8 * s, 5 * s, 1.5 * s);
    g.fillStyle = COLORS.ink;
    g.fillRect(3.5 * s, -2.4 * s, 1.2 * s, 2.6 * s);
    g.fillStyle = '#1a0806';
    g.beginPath();
    g.ellipse(8 * s, 5 * s, 5 * s, 3.5 * s, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#f0e8dc';
    g.beginPath();
    g.moveTo(5 * s, 3 * s);
    g.lineTo(7 * s, 3 * s);
    g.lineTo(6 * s, 9 * s);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(9 * s, 3 * s);
    g.lineTo(11 * s, 3 * s);
    g.lineTo(10.5 * s, 9 * s);
    g.closePath();
    g.fill();
    g.restore();
  }

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
  const rabbitY = lerp(H * 0.68, rabbitP.y, 0.22) - session.jumpY * H * 0.1;
  const foxY = lerp(H * 0.92, H * 0.8, close);
  // Fox looms — always bigger than the rabbit, meaner when close.
  const foxScale = lerp(1.9, 2.7, close);
  const snarl = close > 0.18;

  // Lean both runners into the bend so turns read in their pose.
  const bendNow = session.bendAt(cam);
  const bendAhead = session.bendAt(cam + 6);
  const lean = clamp((bendAhead - bendNow) * 0.18, -0.35, 0.35);

  g.save();
  g.translate(foxP.x, foxY);
  g.rotate(lean * 0.85);
  drawFox(g, 0, 0, foxScale, session.foxHop, snarl);
  g.restore();

  g.save();
  g.translate(rabbitP.x, rabbitY);
  g.rotate(lean);
  drawRabbit(g, 0, 0, 1.0, session.hopPhase, session.jumpY);
  g.restore();

  drawHitFlash(g, W, H, session.flash);
}
