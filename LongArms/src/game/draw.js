/* Canvas 2D: goofy rubber-hose basketball court. */

import { hash2i } from '../core/rng.js';
import { COURT, HOOP, BALL } from './content.js';

const PAL = {
  skyTop: '#9ad9d4',
  skyBot: '#6eb8c0',
  wall: '#f0d9b0',
  wallStripe: '#e2c498',
  floor: '#e8b86a',
  floorLine: '#f5d9a8',
  ink: '#1a1a2e',
  rim: '#e85d4c',
  net: '#f8f4ec',
  backboard: '#f4f0e6',
  ball: '#f07828',
  ballLine: '#1a1a2e',
};

/**
 * Map world → screen. Origin: floor center bottomish.
 * @param {number} W
 * @param {number} H
 */
export function camera(W, H) {
  const worldW = COURT.maxX - COURT.minX;
  const pad = 24;
  const scale = Math.min((W - pad * 2) / worldW, (H - 80) / 280);
  const ox = W / 2;
  const oy = H - 36;
  return {
    scale,
    toScreen(x, y) {
      return {
        x: ox + (x - (COURT.minX + COURT.maxX) / 2) * scale,
        y: oy - y * scale,
      };
    },
  };
}

export function drawBackground(g, W, H, cam, seed = 1) {
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, PAL.skyTop);
  grd.addColorStop(1, PAL.skyBot);
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);

  // Gym wall
  const wallTop = cam.toScreen(0, 260).y;
  const floorY = cam.toScreen(0, 0).y;
  g.fillStyle = PAL.wall;
  g.fillRect(0, wallTop, W, floorY - wallTop);

  // Window stripes
  for (let i = 0; i < 5; i++) {
    const wx = W * (0.12 + i * 0.18);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(wx, wallTop + 20, 36, Math.max(40, floorY - wallTop - 80));
    g.strokeStyle = PAL.ink;
    g.lineWidth = 2;
    g.strokeRect(wx, wallTop + 20, 36, Math.max(40, floorY - wallTop - 80));
  }

  // Floor
  g.fillStyle = PAL.floor;
  g.fillRect(0, floorY, W, H - floorY);
  g.strokeStyle = PAL.floorLine;
  g.lineWidth = 3;
  for (let i = 0; i < 8; i++) {
    const y = floorY + 8 + i * 14;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y + hash2i(i, 2, seed) * 4 - 2);
    g.stroke();
  }

  // Court key outline
  const left = cam.toScreen(COURT.minX + 20, 0);
  const right = cam.toScreen(COURT.maxX - 20, 0);
  g.strokeStyle = 'rgba(26,26,46,0.35)';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(left.x, floorY - 2);
  g.lineTo(right.x, floorY - 2);
  g.stroke();

  // Center circle
  const mid = cam.toScreen(COURT.midX, 0);
  g.beginPath();
  g.arc(mid.x, floorY - 2, 36 * cam.scale, Math.PI, 0);
  g.stroke();
}

export function drawHoop(g, cam) {
  const boardTL = cam.toScreen(HOOP.backboardX - 2, HOOP.backboardTop);
  const boardBR = cam.toScreen(HOOP.backboardX + 6, HOOP.backboardBot);
  const rim = cam.toScreen(HOOP.x, HOOP.rimY);
  const s = cam.scale;

  // Pole
  g.strokeStyle = PAL.ink;
  g.lineWidth = 5;
  const poleBase = cam.toScreen(HOOP.backboardX + 4, 0);
  g.beginPath();
  g.moveTo(poleBase.x, poleBase.y);
  g.lineTo(boardBR.x + 4, boardBR.y);
  g.stroke();

  // Backboard
  g.fillStyle = PAL.backboard;
  g.strokeStyle = PAL.ink;
  g.lineWidth = 3;
  const bw = Math.abs(boardBR.x - boardTL.x) + 10;
  const bh = Math.abs(boardBR.y - boardTL.y);
  g.fillRect(boardTL.x - 4, boardTL.y, bw, bh);
  g.strokeRect(boardTL.x - 4, boardTL.y, bw, bh);
  g.strokeStyle = PAL.rim;
  g.lineWidth = 3;
  g.strokeRect(boardTL.x + 6, boardTL.y + bh * 0.35, bw * 0.45, bh * 0.35);

  // Rim
  g.strokeStyle = PAL.rim;
  g.lineWidth = 4;
  g.beginPath();
  g.ellipse(rim.x, rim.y, HOOP.rimR * s, 5 * s, 0, 0, Math.PI * 2);
  g.stroke();

  // Net
  g.strokeStyle = PAL.net;
  g.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const x0 = rim.x - HOOP.rimR * s + t * HOOP.rimR * 2 * s;
    g.beginPath();
    g.moveTo(x0, rim.y);
    g.quadraticCurveTo(rim.x + (t - 0.5) * 8, rim.y + 18 * s, rim.x + (t - 0.5) * 10 * s, rim.y + 28 * s);
    g.stroke();
  }
}

export function drawGuy(g, cam, guy, pose, holding) {
  const p = cam.toScreen(pose.x, pose.y);
  const s = cam.scale;
  const def = guy.def;
  const face = guy.facing;
  const stretch = guy.stretch || 0;
  const arm = (def.armLen + stretch * 22) * s;

  g.save();
  g.translate(p.x, p.y);

  // Shadow
  g.fillStyle = 'rgba(26,26,46,0.18)';
  g.beginPath();
  g.ellipse(0, def.bodyR * s + 2, 18 * s, 5 * s, 0, 0, Math.PI * 2);
  g.fill();

  // Legs (goofy)
  g.strokeStyle = PAL.ink;
  g.lineWidth = 4;
  g.lineCap = 'round';
  const legSwing = Math.sin((pose.x + pose.y) * 0.08) * (guy.airborne ? 0.2 : 0.5);
  g.beginPath();
  g.moveTo(-6 * s, 0);
  g.lineTo((-10 - legSwing * 8) * s, def.bodyR * s);
  g.moveTo(6 * s, 0);
  g.lineTo((10 + legSwing * 8) * s, def.bodyR * s);
  g.stroke();

  // Shoes
  g.fillStyle = PAL.ink;
  g.fillRect((-16 - legSwing * 8) * s, def.bodyR * s - 2, 12 * s, 6 * s);
  g.fillRect((4 + legSwing * 8) * s, def.bodyR * s - 2, 12 * s, 6 * s);

  // Torso
  g.fillStyle = def.jersey;
  g.strokeStyle = PAL.ink;
  g.lineWidth = 3;
  g.beginPath();
  g.roundRect(-12 * s, -28 * s, 24 * s, 32 * s, 8 * s);
  g.fill();
  g.stroke();

  // Head
  g.fillStyle = def.skin;
  g.beginPath();
  g.arc(0, -40 * s, 14 * s, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  // Face
  g.fillStyle = PAL.ink;
  g.beginPath();
  g.arc(face * 4 * s, -42 * s, 2.2 * s, 0, Math.PI * 2);
  g.arc(face * 9 * s, -42 * s, 2.2 * s, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 2;
  g.beginPath();
  g.arc(face * 6 * s, -36 * s, 4 * s, 0.1, Math.PI - 0.1);
  g.stroke();

  // Noodle arms
  g.strokeStyle = def.skin;
  g.lineWidth = 5 * s;
  const handX = face * arm;
  const handY = (-8 + stretch * -12) * s;
  g.beginPath();
  g.moveTo(face * 10 * s, -18 * s);
  g.quadraticCurveTo(face * arm * 0.55, (-30 - stretch * 20) * s, handX, handY);
  g.stroke();
  // Second arm
  g.beginPath();
  g.moveTo(-face * 8 * s, -16 * s);
  g.quadraticCurveTo(-face * 20 * s, 0, -face * 16 * s, 10 * s);
  g.stroke();

  // Hands
  g.fillStyle = def.skin;
  g.strokeStyle = PAL.ink;
  g.lineWidth = 2;
  g.beginPath();
  g.arc(handX, handY, 6 * s, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  if (holding) {
    // Ball drawn separately at world pos; highlight grip
    g.strokeStyle = 'rgba(240,120,40,0.5)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(handX, handY, 10 * s, 0, Math.PI * 2);
    g.stroke();
  }

  g.restore();
}

export function drawBall(g, cam, pose) {
  const p = cam.toScreen(pose.x, pose.y);
  const s = cam.scale;
  const r = BALL.radius * s;

  g.fillStyle = 'rgba(26,26,46,0.15)';
  g.beginPath();
  g.ellipse(p.x, cam.toScreen(pose.x, 0).y + 2, r * 0.9, r * 0.35, 0, 0, Math.PI * 2);
  g.fill();

  g.fillStyle = PAL.ball;
  g.strokeStyle = PAL.ink;
  g.lineWidth = 2.5;
  g.beginPath();
  g.arc(p.x, p.y, r, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  g.strokeStyle = PAL.ballLine;
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(p.x, p.y, r * 0.55, -0.8, 0.8);
  g.stroke();
  g.beginPath();
  g.moveTo(p.x, p.y - r);
  g.quadraticCurveTo(p.x + r * 0.4, p.y, p.x, p.y + r);
  g.stroke();
}

export function drawParticles(g, cam, particles) {
  for (const p of particles) {
    const sp = cam.toScreen(p.x, p.y);
    const t = 1 - p.age / p.life;
    g.globalAlpha = t;
    g.fillStyle = p.color;
    g.beginPath();
    g.arc(sp.x, sp.y, 4 * t * cam.scale, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

export function drawJumpPad(g, W, H) {
  const padW = Math.min(120, W * 0.28);
  const padH = Math.min(72, H * 0.12);
  const x = W - padW - 16;
  const y = H - padH - 18;
  g.fillStyle = 'rgba(26,26,46,0.45)';
  g.strokeStyle = 'rgba(248,244,236,0.7)';
  g.lineWidth = 3;
  g.beginPath();
  g.roundRect(x, y, padW, padH, 16);
  g.fill();
  g.stroke();
  g.fillStyle = '#f8f4ec';
  g.font = `700 ${Math.round(padH * 0.32)}px "Trebuchet MS", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('JUMP', x + padW / 2, y + padH / 2);
  return { x, y, w: padW, h: padH };
}

export function drawMoveHint(g, W, H) {
  const zoneW = W * 0.42;
  g.fillStyle = 'rgba(26,26,46,0.2)';
  g.beginPath();
  g.roundRect(12, H - 70, zoneW, 52, 14);
  g.fill();
  g.fillStyle = 'rgba(248,244,236,0.65)';
  g.font = '600 13px "Trebuchet MS", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('MOVE', 12 + zoneW / 2, H - 44);
}
