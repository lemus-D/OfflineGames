/* Procedural table + balls + cue guide. Zero image assets. */

import { TABLE, pocketCenters, PHYSICS } from './content.js';

export function tableToScreen(x, y, view) {
  return {
    x: view.cx + x * view.scale,
    y: view.cy + y * view.scale,
  };
}

export function screenToTable(sx, sy, view) {
  return {
    x: (sx - view.cx) / view.scale,
    y: (sy - view.cy) / view.scale,
  };
}

export function fitView(W, H) {
  const margin = 28;
  const rail = TABLE.cushion;
  const worldW = (TABLE.halfW + rail) * 2;
  const worldH = (TABLE.halfH + rail) * 2;
  const scale = Math.min((W - margin * 2) / worldW, (H - margin * 2) / worldH);
  return { cx: W * 0.5, cy: H * 0.52, scale };
}

function feltPattern(g, x, y, w, h) {
  const grad = g.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, '#1f5a38');
  grad.addColorStop(0.45, '#2a6e45');
  grad.addColorStop(1, '#184a2e');
  g.fillStyle = grad;
  g.fillRect(x, y, w, h);

  g.save();
  g.globalAlpha = 0.07;
  g.strokeStyle = '#0a2014';
  g.lineWidth = 1;
  for (let i = -h; i < w + h; i += 7) {
    g.beginPath();
    g.moveTo(x + i, y);
    g.lineTo(x + i + h, y + h);
    g.stroke();
  }
  g.restore();
}

export function drawTable(g, view, animTime) {
  const rail = TABLE.cushion * view.scale;
  const left = view.cx - TABLE.halfW * view.scale;
  const top = view.cy - TABLE.halfH * view.scale;
  const tw = TABLE.halfW * 2 * view.scale;
  const th = TABLE.halfH * 2 * view.scale;

  // Wood frame
  g.fillStyle = '#3a2414';
  g.beginPath();
  roundRect(g, left - rail - 6, top - rail - 6, tw + rail * 2 + 12, th + rail * 2 + 12, 10);
  g.fill();

  g.fillStyle = '#5a3820';
  g.beginPath();
  roundRect(g, left - rail, top - rail, tw + rail * 2, th + rail * 2, 8);
  g.fill();

  // Rails
  g.fillStyle = '#2a1810';
  g.fillRect(left - rail, top - rail, tw + rail * 2, rail);
  g.fillRect(left - rail, top + th, tw + rail * 2, rail);
  g.fillRect(left - rail, top, rail, th);
  g.fillRect(left + tw, top, rail, th);

  // Felt
  feltPattern(g, left, top, tw, th);

  // Head string + spot
  g.save();
  g.strokeStyle = 'rgba(220, 230, 210, 0.18)';
  g.setLineDash([4, 6]);
  g.beginPath();
  g.moveTo(view.cx - TABLE.halfW * 0.5 * view.scale, top + 4);
  g.lineTo(view.cx - TABLE.halfW * 0.5 * view.scale, top + th - 4);
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = 'rgba(240, 230, 180, 0.35)';
  g.beginPath();
  g.arc(view.cx + TABLE.halfW * 0.35 * view.scale, view.cy, 2.2, 0, Math.PI * 2);
  g.fill();
  g.restore();

  // Pockets
  for (const p of pocketCenters()) {
    const s = tableToScreen(p.x, p.y, view);
    const pr = TABLE.pocketR * view.scale * (p.corner ? 1.05 : 0.95);
    g.fillStyle = '#050806';
    g.beginPath();
    g.arc(s.x, s.y, pr, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(20, 12, 8, 0.8)';
    g.lineWidth = 2;
    g.stroke();
  }

  // Soft underlight shimmer
  g.save();
  g.globalAlpha = 0.04 + Math.sin(animTime * 0.7) * 0.015;
  const glow = g.createRadialGradient(view.cx, view.cy, 10, view.cx, view.cy, tw * 0.55);
  glow.addColorStop(0, '#c8f0c0');
  glow.addColorStop(1, 'transparent');
  g.fillStyle = glow;
  g.fillRect(left, top, tw, th);
  g.restore();
}

function roundRect(g, x, y, w, h, r) {
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function drawBall(g, ball, view) {
  if (ball.pocketed && ball.id !== 0) return;
  const s = tableToScreen(ball.x, ball.y, view);
  const r = ball.r * view.scale;

  g.save();
  g.beginPath();
  g.arc(s.x + r * 0.15, s.y + r * 0.2, r, 0, Math.PI * 2);
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.fill();

  const body = g.createRadialGradient(
    s.x - r * 0.35,
    s.y - r * 0.4,
    r * 0.1,
    s.x,
    s.y,
    r
  );
  if (ball.kind === 'stripe') {
    body.addColorStop(0, '#fff8f0');
    body.addColorStop(0.45, '#fff8f0');
    body.addColorStop(0.46, ball.color);
    body.addColorStop(1, shade(ball.color, 0.65));
  } else {
    body.addColorStop(0, tint(ball.color, 0.35));
    body.addColorStop(0.55, ball.color);
    body.addColorStop(1, shade(ball.color, 0.55));
  }
  g.beginPath();
  g.arc(s.x, s.y, r, 0, Math.PI * 2);
  g.fillStyle = body;
  g.fill();

  if (ball.kind === 'stripe') {
    g.beginPath();
    g.arc(s.x, s.y, r, 0, Math.PI * 2);
    g.strokeStyle = ball.color;
    g.lineWidth = r * 0.55;
    g.stroke();
    g.beginPath();
    g.arc(s.x, s.y, r * 0.55, 0, Math.PI * 2);
    g.fillStyle = '#f8f4ec';
    g.fill();
  }

  if (ball.label) {
    g.fillStyle = ball.kind === 'eight' ? '#f4f0e8' : '#1a1410';
    if (ball.kind !== 'stripe' && ball.kind !== 'eight') {
      g.beginPath();
      g.arc(s.x, s.y, r * 0.42, 0, Math.PI * 2);
      g.fillStyle = '#f4f0e8';
      g.fill();
      g.fillStyle = '#1a1410';
    }
    g.font = `bold ${Math.max(8, r * 0.7)}px "Trebuchet MS", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(ball.label, s.x, s.y + 0.5);
  }

  g.beginPath();
  g.arc(s.x - r * 0.28, s.y - r * 0.32, r * 0.18, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255,255,255,0.45)';
  g.fill();
  g.restore();
}

export function drawCueGuide(g, cue, view, aim) {
  if (!cue || cue.pocketed || !aim) return;
  const origin = tableToScreen(cue.x, cue.y, view);
  const pull = aim.powerPull;
  if (pull < 2) return;

  const ang = Math.atan2(aim.dy, aim.dx);
  const power = Math.min(1, Math.max(0, (pull - PHYSICS.minPullPx) / (PHYSICS.maxPullPx - PHYSICS.minPullPx)));
  const cueLen = (40 + power * 70) * (view.scale / 3.2);
  const tipGap = cue.r * view.scale + 4;

  // Aim line
  g.save();
  g.strokeStyle = `rgba(244, 240, 220, ${0.25 + power * 0.45})`;
  g.lineWidth = 1.5;
  g.setLineDash([6, 8]);
  g.beginPath();
  g.moveTo(origin.x, origin.y);
  g.lineTo(
    origin.x + Math.cos(ang) * 180 * (view.scale / 3),
    origin.y + Math.sin(ang) * 180 * (view.scale / 3)
  );
  g.stroke();
  g.setLineDash([]);

  // Cue stick behind ball (opposite aim)
  const bx = origin.x - Math.cos(ang) * tipGap;
  const by = origin.y - Math.sin(ang) * tipGap;
  const ex = origin.x - Math.cos(ang) * (tipGap + cueLen + power * 30);
  const ey = origin.y - Math.sin(ang) * (tipGap + cueLen + power * 30);

  const stick = g.createLinearGradient(ex, ey, bx, by);
  stick.addColorStop(0, '#3a2210');
  stick.addColorStop(0.7, '#c4a06a');
  stick.addColorStop(1, '#e8d2a8');
  g.strokeStyle = stick;
  g.lineWidth = Math.max(3, 4 * (view.scale / 3));
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(ex, ey);
  g.lineTo(bx, by);
  g.stroke();

  // Power meter
  const mx = origin.x + 18;
  const my = origin.y - 28;
  g.fillStyle = 'rgba(10, 16, 12, 0.55)';
  g.fillRect(mx, my, 52, 8);
  g.fillStyle = power > 0.75 ? '#e07040' : '#d4c078';
  g.fillRect(mx, my, 52 * power, 8);
  g.strokeStyle = 'rgba(240,230,200,0.35)';
  g.strokeRect(mx, my, 52, 8);
  g.restore();
}

export function drawKitchenHint(g, view) {
  const left = view.cx - TABLE.halfW * view.scale;
  const top = view.cy - TABLE.halfH * view.scale;
  const w = TABLE.halfW * view.scale;
  const h = TABLE.halfH * 2 * view.scale;
  g.save();
  g.fillStyle = 'rgba(212, 192, 120, 0.12)';
  g.fillRect(left, top, w, h);
  g.strokeStyle = 'rgba(212, 192, 120, 0.35)';
  g.setLineDash([5, 5]);
  g.strokeRect(left + 1, top + 1, w - 2, h - 2);
  g.restore();
}

function shade(hex, m) {
  const { r, g, b } = parse(hex);
  return `rgb(${(r * m) | 0},${(g * m) | 0},${(b * m) | 0})`;
}
function tint(hex, a) {
  const { r, g, b } = parse(hex);
  return `rgb(${(r + (255 - r) * a) | 0},${(g + (255 - g) * a) | 0},${(b + (255 - b) * a) | 0})`;
}
function parse(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}
