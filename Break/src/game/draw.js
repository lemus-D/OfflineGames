/* Procedural table + balls + cue + aim assist. Zero image assets. */

import { TABLE, pocketCenters, PHYSICS, BALL_R } from './content.js';
import { predictAim } from './aim.js';

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
  const margin = 36;
  const rail = TABLE.cushion;
  const worldW = (TABLE.halfW + rail) * 2;
  const worldH = (TABLE.halfH + rail) * 2;
  const scale = Math.min((W - margin * 2) / worldW, (H - margin * 2) / worldH);
  return { cx: W * 0.5, cy: H * 0.5, scale };
}

function feltPattern(g, x, y, w, h) {
  const grad = g.createRadialGradient(
    x + w * 0.45,
    y + h * 0.4,
    h * 0.1,
    x + w * 0.5,
    y + h * 0.5,
    w * 0.7
  );
  grad.addColorStop(0, '#348a52');
  grad.addColorStop(0.45, '#2a6e45');
  grad.addColorStop(1, '#1a4a30');
  g.fillStyle = grad;
  g.fillRect(x, y, w, h);

  // Cloth weave
  g.save();
  g.globalAlpha = 0.06;
  g.strokeStyle = '#0c2418';
  g.lineWidth = 1;
  for (let i = -h; i < w + h; i += 5) {
    g.beginPath();
    g.moveTo(x + i, y);
    g.lineTo(x + i + h, y + h);
    g.stroke();
  }
  g.globalAlpha = 0.04;
  g.strokeStyle = '#b8e0c0';
  for (let i = -h; i < w + h; i += 9) {
    g.beginPath();
    g.moveTo(x + i + 3, y);
    g.lineTo(x + i + 3 + h, y + h);
    g.stroke();
  }
  g.restore();

  // Soft vignette
  const vig = g.createRadialGradient(
    x + w / 2,
    y + h / 2,
    h * 0.2,
    x + w / 2,
    y + h / 2,
    w * 0.65
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.22)');
  g.fillStyle = vig;
  g.fillRect(x, y, w, h);
}

function drawWoodFrame(g, left, top, tw, th, rail) {
  const pad = 8;
  const x = left - rail - pad;
  const y = top - rail - pad;
  const w = tw + rail * 2 + pad * 2;
  const h = th + rail * 2 + pad * 2;

  const outer = g.createLinearGradient(x, y, x + w, y + h);
  outer.addColorStop(0, '#4a2e18');
  outer.addColorStop(0.4, '#6b4224');
  outer.addColorStop(1, '#3a2210');
  g.fillStyle = outer;
  g.beginPath();
  roundRect(g, x, y, w, h, 12);
  g.fill();

  // Inner bevel
  g.strokeStyle = 'rgba(230, 190, 120, 0.22)';
  g.lineWidth = 2;
  g.beginPath();
  roundRect(g, x + 3, y + 3, w - 6, h - 6, 10);
  g.stroke();

  // Rail cushions (green-edged wood)
  const railGrad = g.createLinearGradient(0, top - rail, 0, top);
  railGrad.addColorStop(0, '#3d2614');
  railGrad.addColorStop(1, '#1e4a32');
  g.fillStyle = '#2c1a0e';
  g.fillRect(left - rail, top - rail, tw + rail * 2, rail);
  g.fillRect(left - rail, top + th, tw + rail * 2, rail);
  g.fillRect(left - rail, top, rail, th);
  g.fillRect(left + tw, top, rail, th);

  // Cloth lip on cushions
  g.fillStyle = '#245a3a';
  g.fillRect(left - 2, top - 3, tw + 4, 3);
  g.fillRect(left - 2, top + th, tw + 4, 3);
  g.fillRect(left - 3, top - 2, 3, th + 4);
  g.fillRect(left + tw, top - 2, 3, th + 4);
}

function drawDiamonds(g, left, top, tw, th, rail) {
  g.fillStyle = '#e8d2a0';
  const places = [
    // long rails — 3 diamonds each half
    ...[0.25, 0.5, 0.75].map((t) => ({ x: left + tw * t, y: top - rail * 0.55 })),
    ...[0.25, 0.5, 0.75].map((t) => ({ x: left + tw * t, y: top + th + rail * 0.55 })),
    // short rails
    ...[0.25, 0.5, 0.75].map((t) => ({ x: left - rail * 0.55, y: top + th * t })),
    ...[0.25, 0.5, 0.75].map((t) => ({ x: left + tw + rail * 0.55, y: top + th * t })),
  ];
  for (const p of places) {
    g.beginPath();
    g.moveTo(p.x, p.y - 2.4);
    g.lineTo(p.x + 2.2, p.y);
    g.lineTo(p.x, p.y + 2.4);
    g.lineTo(p.x - 2.2, p.y);
    g.closePath();
    g.fill();
  }
}

export function drawTable(g, view, animTime) {
  const rail = TABLE.cushion * view.scale;
  const left = view.cx - TABLE.halfW * view.scale;
  const top = view.cy - TABLE.halfH * view.scale;
  const tw = TABLE.halfW * 2 * view.scale;
  const th = TABLE.halfH * 2 * view.scale;

  drawWoodFrame(g, left, top, tw, th, rail);
  feltPattern(g, left, top, tw, th);
  drawDiamonds(g, left, top, tw, th, rail);

  // Head string + foot spot
  g.save();
  g.strokeStyle = 'rgba(220, 230, 210, 0.2)';
  g.setLineDash([5, 7]);
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(view.cx - TABLE.halfW * 0.5 * view.scale, top + 6);
  g.lineTo(view.cx - TABLE.halfW * 0.5 * view.scale, top + th - 6);
  g.stroke();
  g.setLineDash([]);

  const spot = tableToScreen(TABLE.halfW * 0.35, 0, view);
  g.fillStyle = 'rgba(240, 230, 180, 0.5)';
  g.beginPath();
  g.arc(spot.x, spot.y, 2.4, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(240, 230, 180, 0.35)';
  g.beginPath();
  g.arc(spot.x, spot.y, 4.5, 0, Math.PI * 2);
  g.stroke();
  g.restore();

  // Pockets with leather rims
  for (const p of pocketCenters()) {
    const s = tableToScreen(p.x, p.y, view);
    const pr = TABLE.pocketR * view.scale * (p.corner ? 1.08 : 0.95);
    g.beginPath();
    g.arc(s.x, s.y, pr + 2.5, 0, Math.PI * 2);
    g.fillStyle = '#1a1008';
    g.fill();
    const hole = g.createRadialGradient(s.x - 1, s.y - 1, 1, s.x, s.y, pr);
    hole.addColorStop(0, '#1a2218');
    hole.addColorStop(0.55, '#050806');
    hole.addColorStop(1, '#000');
    g.beginPath();
    g.arc(s.x, s.y, pr, 0, Math.PI * 2);
    g.fillStyle = hole;
    g.fill();
  }

  g.save();
  g.globalAlpha = 0.035 + Math.sin(animTime * 0.6) * 0.012;
  const glow = g.createRadialGradient(view.cx, view.cy, 10, view.cx, view.cy, tw * 0.55);
  glow.addColorStop(0, '#d8f5d0');
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
  // Contact shadow
  g.beginPath();
  g.ellipse(s.x + r * 0.08, s.y + r * 0.55, r * 0.85, r * 0.28, 0, 0, Math.PI * 2);
  g.fillStyle = 'rgba(0,0,0,0.32)';
  g.fill();

  const body = g.createRadialGradient(
    s.x - r * 0.32,
    s.y - r * 0.38,
    r * 0.08,
    s.x,
    s.y + r * 0.1,
    r * 1.05
  );

  if (ball.kind === 'stripe') {
    body.addColorStop(0, '#fffaf2');
    body.addColorStop(1, '#e8e0d4');
    g.beginPath();
    g.arc(s.x, s.y, r, 0, Math.PI * 2);
    g.fillStyle = body;
    g.fill();

    // Equatorial stripe band
    g.save();
    g.beginPath();
    g.arc(s.x, s.y, r, 0, Math.PI * 2);
    g.clip();
    const band = g.createLinearGradient(s.x, s.y - r, s.x, s.y + r);
    band.addColorStop(0, 'rgba(0,0,0,0)');
    band.addColorStop(0.28, 'rgba(0,0,0,0)');
    band.addColorStop(0.32, ball.color);
    band.addColorStop(0.5, shade(ball.color, 0.85));
    band.addColorStop(0.68, ball.color);
    band.addColorStop(0.72, 'rgba(0,0,0,0)');
    band.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = band;
    g.fillRect(s.x - r, s.y - r, r * 2, r * 2);
    g.restore();

    g.beginPath();
    g.arc(s.x, s.y, r * 0.48, 0, Math.PI * 2);
    g.fillStyle = '#f8f4ec';
    g.fill();
  } else if (ball.kind === 'cue') {
    body.addColorStop(0, '#ffffff');
    body.addColorStop(0.45, '#f4f0e8');
    body.addColorStop(1, '#c8c0b4');
    g.beginPath();
    g.arc(s.x, s.y, r, 0, Math.PI * 2);
    g.fillStyle = body;
    g.fill();
  } else if (ball.kind === 'eight') {
    body.addColorStop(0, '#3a3a3a');
    body.addColorStop(0.5, '#1a1a1a');
    body.addColorStop(1, '#050505');
    g.beginPath();
    g.arc(s.x, s.y, r, 0, Math.PI * 2);
    g.fillStyle = body;
    g.fill();
    g.beginPath();
    g.arc(s.x, s.y, r * 0.42, 0, Math.PI * 2);
    g.fillStyle = '#f4f0e8';
    g.fill();
  } else {
    body.addColorStop(0, tint(ball.color, 0.4));
    body.addColorStop(0.5, ball.color);
    body.addColorStop(1, shade(ball.color, 0.5));
    g.beginPath();
    g.arc(s.x, s.y, r, 0, Math.PI * 2);
    g.fillStyle = body;
    g.fill();
    g.beginPath();
    g.arc(s.x, s.y, r * 0.42, 0, Math.PI * 2);
    g.fillStyle = '#f4f0e8';
    g.fill();
  }

  if (ball.label) {
    g.fillStyle = '#1a1410';
    g.font = `bold ${Math.max(9, r * 0.72)}px "Trebuchet MS", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(ball.label, s.x, s.y + 0.5);
  }

  // Specular
  g.beginPath();
  g.ellipse(s.x - r * 0.28, s.y - r * 0.32, r * 0.22, r * 0.14, -0.5, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.fill();

  // Rim
  g.beginPath();
  g.arc(s.x, s.y, r - 0.4, 0, Math.PI * 2);
  g.strokeStyle = 'rgba(0,0,0,0.22)';
  g.lineWidth = 1;
  g.stroke();
  g.restore();
}

/**
 * Cue stick, power, ghost ball, contact mark, object/cue leave angles.
 */
export function drawCueAndAim(g, cue, balls, view, aim, english, opts = {}) {
  if (!cue || cue.pocketed || !aim) return;
  const pulling = !!opts.pulling;
  const power = opts.power || 0;
  const ang = Math.atan2(aim.dy, aim.dx);
  const origin = tableToScreen(cue.x, cue.y, view);

  const pred = predictAim(cue, balls, aim.dx / view.scale, aim.dy / view.scale, english);

  g.save();

  // Aim guide to ghost / far end
  if (pred) {
    const end = tableToScreen(pred.aimEnd.x, pred.aimEnd.y, view);
    g.strokeStyle = `rgba(244, 240, 220, ${0.22 + power * 0.35})`;
    g.lineWidth = 1.4;
    g.setLineDash([5, 7]);
    g.beginPath();
    g.moveTo(origin.x, origin.y);
    g.lineTo(end.x, end.y);
    g.stroke();
    g.setLineDash([]);

    if (pred.ghost) {
      const gs = tableToScreen(pred.ghost.x, pred.ghost.y, view);
      const gr = BALL_R * view.scale;

      // Ghost ball (where cue center will be)
      g.beginPath();
      g.arc(gs.x, gs.y, gr, 0, Math.PI * 2);
      g.strokeStyle = 'rgba(244, 240, 220, 0.75)';
      g.lineWidth = 1.6;
      g.setLineDash([3, 3]);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = 'rgba(244, 240, 220, 0.08)';
      g.fill();

      // Contact mark on the object ball
      if (pred.contact) {
        const cs = tableToScreen(pred.contact.x, pred.contact.y, view);
        g.beginPath();
        g.arc(cs.x, cs.y, Math.max(3, gr * 0.28), 0, Math.PI * 2);
        g.fillStyle = 'rgba(255, 220, 100, 0.9)';
        g.fill();
        g.strokeStyle = 'rgba(40, 30, 10, 0.55)';
        g.lineWidth = 1;
        g.stroke();
      }

      // Object ball leave path
      if (pred.objectDir) {
        const len = 70 * (view.scale / 3.2);
        const ts = tableToScreen(pred.target.x, pred.target.y, view);
        g.strokeStyle = 'rgba(120, 220, 160, 0.85)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(ts.x, ts.y);
        g.lineTo(ts.x + pred.objectDir.x * len, ts.y + pred.objectDir.y * len);
        g.stroke();
        drawArrowHead(
          g,
          ts.x + pred.objectDir.x * len,
          ts.y + pred.objectDir.y * len,
          Math.atan2(pred.objectDir.y, pred.objectDir.x),
          'rgba(120, 220, 160, 0.9)'
        );
      }

      // Cue ball leave path (deflection / follow)
      if (pred.cueDir) {
        const len = 48 * (view.scale / 3.2);
        g.strokeStyle = 'rgba(240, 200, 120, 0.8)';
        g.lineWidth = 1.8;
        g.setLineDash([4, 4]);
        g.beginPath();
        g.moveTo(gs.x, gs.y);
        g.lineTo(gs.x + pred.cueDir.x * len, gs.y + pred.cueDir.y * len);
        g.stroke();
        g.setLineDash([]);
      }

      // Cut angle readout
      if (pred.cutDeg != null) {
        g.fillStyle = 'rgba(10, 16, 12, 0.55)';
        const label = `${Math.round(pred.cutDeg)}° cut`;
        g.font = '600 11px "Trebuchet MS", sans-serif';
        const tw = g.measureText(label).width;
        g.fillRect(gs.x - tw / 2 - 5, gs.y - gr - 22, tw + 10, 16);
        g.fillStyle = '#e8f0e4';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(label, gs.x, gs.y - gr - 14);
      }
    }
  }

  // Cue stick behind the ball
  const tipGap = cue.r * view.scale + 3 + (pulling ? power * 36 : 8);
  const cueLen = (95 + power * 20) * (view.scale / 3.2);
  const bx = origin.x - Math.cos(ang) * tipGap;
  const by = origin.y - Math.sin(ang) * tipGap;
  const ex = origin.x - Math.cos(ang) * (tipGap + cueLen);
  const ey = origin.y - Math.sin(ang) * (tipGap + cueLen);

  // Stick shadow
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = Math.max(4, 5.5 * (view.scale / 3));
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(ex + 1.5, ey + 2);
  g.lineTo(bx + 1.5, by + 2);
  g.stroke();

  const stick = g.createLinearGradient(ex, ey, bx, by);
  stick.addColorStop(0, '#2a180c');
  stick.addColorStop(0.15, '#5a3420');
  stick.addColorStop(0.55, '#c4a06a');
  stick.addColorStop(0.82, '#e8d2a8');
  stick.addColorStop(0.92, '#1a6a9a');
  stick.addColorStop(1, '#d8ece8');
  g.strokeStyle = stick;
  g.lineWidth = Math.max(3.2, 4.4 * (view.scale / 3));
  g.beginPath();
  g.moveTo(ex, ey);
  g.lineTo(bx, by);
  g.stroke();

  // Tip chalk face
  g.beginPath();
  g.arc(bx, by, Math.max(2.2, 2.8 * (view.scale / 3)), 0, Math.PI * 2);
  g.fillStyle = '#7ec8c0';
  g.fill();

  // Power meter near cue
  if (pulling || power > 0.01) {
    const mx = origin.x + 22;
    const my = origin.y - 34;
    g.fillStyle = 'rgba(10, 16, 12, 0.65)';
    g.fillRect(mx, my, 56, 9);
    const pcol = power > 0.8 ? '#e07040' : power > 0.45 ? '#e0c060' : '#88c090';
    g.fillStyle = pcol;
    g.fillRect(mx, my, 56 * power, 9);
    g.strokeStyle = 'rgba(240,230,200,0.4)';
    g.strokeRect(mx, my, 56, 9);
  }

  g.restore();
}

function drawArrowHead(g, x, y, ang, color) {
  const s = 6;
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x - Math.cos(ang - 0.4) * s, y - Math.sin(ang - 0.4) * s);
  g.lineTo(x - Math.cos(ang + 0.4) * s, y - Math.sin(ang + 0.4) * s);
  g.closePath();
  g.fill();
}

/** Draw English dial onto a small canvas (tip hit point on cue ball). */
export function drawEnglishDial(g, size, english, hover) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;

  g.clearRect(0, 0, size, size);
  g.fillStyle = 'rgba(8, 14, 10, 0.2)';
  g.beginPath();
  g.arc(cx, cy, r + 8, 0, Math.PI * 2);
  g.fill();

  const ball = g.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
  ball.addColorStop(0, '#ffffff');
  ball.addColorStop(0.55, '#f0ebe3');
  ball.addColorStop(1, '#b8b0a4');
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fillStyle = ball;
  g.fill();
  g.strokeStyle = 'rgba(40, 30, 20, 0.45)';
  g.lineWidth = 1.5;
  g.stroke();

  // Crosshair
  g.strokeStyle = 'rgba(40, 50, 40, 0.25)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(cx - r, cy);
  g.lineTo(cx + r, cy);
  g.moveTo(cx, cy - r);
  g.lineTo(cx, cy + r);
  g.stroke();

  // Labels
  g.fillStyle = 'rgba(40, 50, 40, 0.55)';
  g.font = '600 8px "Trebuchet MS", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('T', cx, cy - r + 8);
  g.fillText('D', cx, cy + r - 8);
  g.fillText('L', cx - r + 7, cy);
  g.fillText('R', cx + r - 7, cy);

  const maxE = PHYSICS.maxEnglish;
  const tipX = cx + (english.x / maxE) * r * 0.92;
  const tipY = cy - (english.y / maxE) * r * 0.92;

  g.beginPath();
  g.arc(tipX, tipY, hover ? 6 : 5, 0, Math.PI * 2);
  g.fillStyle = '#1a6a9a';
  g.fill();
  g.strokeStyle = '#d8ece8';
  g.lineWidth = 1.5;
  g.stroke();
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

/** @deprecated kept for smoke import stability — prefer drawCueAndAim */
export function drawCueGuide(g, cue, view, aim) {
  drawCueAndAim(g, cue, [], view, aim, { x: 0, y: 0 }, {
    pulling: true,
    power: Math.min(1, Math.max(0, (aim.powerPull - PHYSICS.minPullPx) / (PHYSICS.maxPullPx - PHYSICS.minPullPx))),
  });
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
