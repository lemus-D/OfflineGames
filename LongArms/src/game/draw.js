/* Canvas 2D: Basket Random-ish flat court + remorphing noodle bodies. */

import { COURT, HOOP, BALL } from './content.js';

const PAL = {
  sky: '#7ec8f0',
  skyDeep: '#5aaee0',
  wall: '#d9efe8',
  floor: '#f0c987',
  line: '#ffffff',
  ink: '#222033',
  rim: '#ff4d4d',
  net: '#f7f7f7',
  backboard: '#f4f4f4',
  ball: '#ff7a1a',
  ballLine: '#222033',
};

/**
 * @param {number} W
 * @param {number} H
 * @param {number} [camX]
 */
export function camera(W, H, camX = 0) {
  const viewW = 420;
  const scale = Math.min(W / viewW, (H - 40) / 300);
  const ox = W / 2;
  const oy = H - 28;
  const focus = camX;
  return {
    scale,
    focus,
    toScreen(x, y) {
      return {
        x: ox + (x - focus) * scale,
        y: oy - y * scale,
      };
    },
  };
}

export function drawBackground(g, W, H, cam) {
  const grd = g.createLinearGradient(0, 0, 0, H * 0.7);
  grd.addColorStop(0, PAL.sky);
  grd.addColorStop(1, PAL.skyDeep);
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);

  const floorY = cam.toScreen(0, 0).y;
  const wallTop = cam.toScreen(0, 280).y;

  g.fillStyle = PAL.wall;
  g.fillRect(0, wallTop, W, Math.max(0, floorY - wallTop));

  // Soft crowd blobs
  for (let i = 0; i < 14; i++) {
    const x = ((i * 97) % W) + 10;
    g.fillStyle = i % 2 ? 'rgba(255,255,255,0.25)' : 'rgba(30,40,60,0.12)';
    g.beginPath();
    g.arc(x, wallTop + 28 + (i % 3) * 8, 10 + (i % 4), 0, Math.PI * 2);
    g.fill();
  }

  g.fillStyle = PAL.floor;
  g.fillRect(0, floorY, W, H - floorY + 2);

  g.strokeStyle = PAL.line;
  g.lineWidth = Math.max(2, 3 * cam.scale);
  g.beginPath();
  g.moveTo(0, floorY);
  g.lineTo(W, floorY);
  g.stroke();

  // Center line + circle in world
  const mid = cam.toScreen(COURT.midX, 0);
  g.beginPath();
  g.moveTo(mid.x, floorY);
  g.lineTo(mid.x, floorY - 8);
  g.stroke();
  g.beginPath();
  g.arc(mid.x, floorY, 42 * cam.scale, Math.PI, 0);
  g.stroke();

  // Key under hoop
  const k0 = cam.toScreen(HOOP.x - 70, 0);
  const k1 = cam.toScreen(HOOP.x + 10, 0);
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.strokeRect(k0.x, floorY - 70 * cam.scale, k1.x - k0.x, 70 * cam.scale);
}

export function drawHoop(g, cam) {
  const s = cam.scale;
  const board = cam.toScreen(HOOP.backboardX, HOOP.backboardTop);
  const boardBot = cam.toScreen(HOOP.backboardX, HOOP.backboardBot);
  const rim = cam.toScreen(HOOP.x, HOOP.rimY);
  const pole = cam.toScreen(HOOP.backboardX + 6, 0);

  g.strokeStyle = PAL.ink;
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(pole.x, pole.y);
  g.lineTo(boardBot.x + 4, boardBot.y);
  g.stroke();

  const bh = boardBot.y - board.y;
  g.fillStyle = PAL.backboard;
  g.strokeStyle = PAL.ink;
  g.lineWidth = 3;
  g.fillRect(board.x - 8, board.y, 18 * s + 10, bh);
  g.strokeRect(board.x - 8, board.y, 18 * s + 10, bh);
  g.strokeStyle = PAL.rim;
  g.lineWidth = 3;
  g.strokeRect(board.x - 2, board.y + bh * 0.3, 12 * s, bh * 0.35);

  g.strokeStyle = PAL.rim;
  g.lineWidth = 5;
  g.beginPath();
  g.ellipse(rim.x, rim.y, HOOP.rimR * s, 4.5 * s, 0, 0, Math.PI * 2);
  g.stroke();

  g.strokeStyle = PAL.net;
  g.lineWidth = 1.5;
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const x0 = rim.x - HOOP.rimR * s + t * HOOP.rimR * 2 * s;
    g.beginPath();
    g.moveTo(x0, rim.y);
    g.lineTo(rim.x + (t - 0.5) * 12 * s, rim.y + 26 * s);
    g.stroke();
  }
}

export function drawGuy(g, cam, guy, pose, holding) {
  const p = cam.toScreen(pose.x, pose.y);
  const s = cam.scale;
  const m = guy.morph;
  const face = guy.facing;
  const stretch = guy.stretch || 0;

  const bodyW = 22 * m.body * s;
  const bodyH = 28 * m.body * s;
  const headR = 12 * m.head * s;
  const legLen = 18 * m.leg * s;
  const armLen = (PHYSICS_ARM(m) + stretch * 18) * s;

  g.save();
  g.translate(p.x, p.y);

  // Shadow
  g.fillStyle = 'rgba(34,32,51,0.18)';
  g.beginPath();
  g.ellipse(0, guy.bodyR * s + 2, 16 * m.body * s, 5 * s, 0, 0, Math.PI * 2);
  g.fill();

  const swing = Math.sin(pose.x * 0.12) * (guy.airborne ? 0.15 : 0.55);

  // Legs
  g.strokeStyle = guy.def.skin;
  g.lineWidth = Math.max(3, 4.5 * s);
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-bodyW * 0.25, 0);
  g.lineTo((-10 - swing * 10) * s, legLen);
  g.moveTo(bodyW * 0.25, 0);
  g.lineTo((10 + swing * 10) * s, legLen);
  g.stroke();

  // Shoes
  g.fillStyle = PAL.ink;
  g.fillRect((-16 - swing * 10) * s, legLen - 2, 11 * s, 5 * s);
  g.fillRect((5 + swing * 10) * s, legLen - 2, 11 * s, 5 * s);

  // Torso
  g.fillStyle = guy.def.jersey;
  g.strokeStyle = PAL.ink;
  g.lineWidth = 3;
  g.beginPath();
  g.rect(-bodyW / 2, -bodyH, bodyW, bodyH);
  g.fill();
  g.stroke();

  // Number-ish dash
  g.strokeStyle = guy.def.accent;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(-4 * s, -bodyH * 0.55);
  g.lineTo(4 * s, -bodyH * 0.55);
  g.stroke();

  // Head
  g.fillStyle = guy.def.skin;
  g.beginPath();
  g.arc(0, -bodyH - headR * 0.15, headR, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = PAL.ink;
  g.lineWidth = 3;
  g.stroke();

  // Face
  g.fillStyle = PAL.ink;
  g.beginPath();
  g.arc(face * headR * 0.25, -bodyH - headR * 0.25, 2 * s, 0, Math.PI * 2);
  g.arc(face * headR * 0.55, -bodyH - headR * 0.25, 2 * s, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 2;
  g.beginPath();
  g.arc(face * headR * 0.4, -bodyH + headR * 0.05, 3.5 * s, 0.15, Math.PI - 0.15);
  g.stroke();

  // Arms (the whole joke)
  g.strokeStyle = guy.def.skin;
  g.lineWidth = Math.max(3, 5 * s * Math.min(1.4, m.arm * 0.7));
  const handX = face * armLen;
  const handY = -bodyH * 0.35 - stretch * 16 * s;
  g.beginPath();
  g.moveTo(face * bodyW * 0.45, -bodyH * 0.7);
  g.quadraticCurveTo(face * armLen * 0.5, -bodyH - stretch * 20 * s, handX, handY);
  g.stroke();
  g.beginPath();
  g.moveTo(-face * bodyW * 0.4, -bodyH * 0.65);
  g.quadraticCurveTo(-face * 22 * s, -bodyH * 0.1, -face * 18 * s, 6 * s);
  g.stroke();

  g.fillStyle = guy.def.skin;
  g.strokeStyle = PAL.ink;
  g.lineWidth = 2;
  g.beginPath();
  g.arc(handX, handY, 5.5 * s, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  if (holding) {
    g.strokeStyle = 'rgba(255,122,26,0.55)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(handX, handY, 9 * s, 0, Math.PI * 2);
    g.stroke();
  }

  g.restore();
}

function PHYSICS_ARM(m) {
  return 36 * m.arm;
}

export function drawBall(g, cam, pose) {
  const p = cam.toScreen(pose.x, pose.y);
  const s = cam.scale;
  const r = BALL.radius * s;

  g.fillStyle = 'rgba(34,32,51,0.16)';
  g.beginPath();
  g.ellipse(p.x, cam.toScreen(pose.x, 0).y + 2, r * 0.95, r * 0.35, 0, 0, Math.PI * 2);
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
  g.arc(p.x, p.y, r * 0.55, -0.9, 0.9);
  g.stroke();
  g.beginPath();
  g.moveTo(p.x, p.y - r);
  g.quadraticCurveTo(p.x + r * 0.35, p.y, p.x, p.y + r);
  g.stroke();
}

export function drawParticles(g, cam, particles) {
  for (const p of particles) {
    const sp = cam.toScreen(p.x, p.y);
    const t = 1 - p.age / p.life;
    g.globalAlpha = t;
    g.fillStyle = p.color;
    g.beginPath();
    g.arc(sp.x, sp.y, 5 * t * cam.scale, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

/** Basket Random-style dunk close-up flash. */
export function drawDunkCinema(g, W, H, dunking, guy) {
  if (!dunking) return;
  const t = dunking.t / dunking.life;
  g.fillStyle = `rgba(10,14,28,${0.55 * (1 - t)})`;
  g.fillRect(0, 0, W, H);

  const cx = W * 0.5;
  const cy = H * 0.42;
  const zoom = 1.6 + Math.sin(t * Math.PI) * 0.35;
  g.save();
  g.translate(cx, cy);
  g.scale(zoom, zoom);

  // Giant arm slam silhouette
  g.strokeStyle = guy.def.skin;
  g.lineWidth = 14;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-40, 30);
  g.quadraticCurveTo(-10, -80, 50, -40);
  g.stroke();

  g.fillStyle = guy.def.jersey;
  g.strokeStyle = PAL.ink;
  g.lineWidth = 4;
  g.beginPath();
  g.rect(-28, -10, 40, 50);
  g.fill();
  g.stroke();

  g.fillStyle = PAL.ball;
  g.beginPath();
  g.arc(55, -45, 18, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  g.fillStyle = '#fff';
  g.font = '800 22px "Trebuchet MS", sans-serif';
  g.textAlign = 'center';
  g.fillText('SLAM!', 0, 70);
  g.restore();
}

export function drawRemorphBanner(g, W, H, alpha = 1) {
  g.globalAlpha = alpha;
  g.fillStyle = 'rgba(34,32,51,0.35)';
  g.fillRect(0, H * 0.38, W, 54);
  g.fillStyle = '#ffe66d';
  g.font = '800 28px "Trebuchet MS", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('RANDOM BODIES!', W / 2, H * 0.38 + 27);
  g.globalAlpha = 1;
}

export function drawJumpPad(g, W, H) {
  const padW = Math.min(120, W * 0.28);
  const padH = Math.min(72, H * 0.12);
  const x = W - padW - 16;
  const y = H - padH - 18;
  g.fillStyle = 'rgba(34,32,51,0.5)';
  g.strokeStyle = 'rgba(255,255,255,0.75)';
  g.lineWidth = 3;
  g.beginPath();
  g.roundRect(x, y, padW, padH, 14);
  g.fill();
  g.stroke();
  g.fillStyle = '#fff';
  g.font = `700 ${Math.round(padH * 0.32)}px "Trebuchet MS", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('JUMP', x + padW / 2, y + padH / 2);
  return { x, y, w: padW, h: padH };
}

export function drawMoveHint(g, W, H) {
  const zoneW = W * 0.42;
  g.fillStyle = 'rgba(34,32,51,0.22)';
  g.beginPath();
  g.roundRect(12, H - 70, zoneW, 52, 14);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.font = '600 13px "Trebuchet MS", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('MOVE', 12 + zoneW / 2, H - 44);
}
