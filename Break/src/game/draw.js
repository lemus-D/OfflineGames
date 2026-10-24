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
  const margin = 40;
  const rail = TABLE.cushion;
  const out = Math.max(TABLE.pocketOut || 0, TABLE.pocketOutSide || 0) + TABLE.pocketR;
  const worldW = (TABLE.halfW + rail + out * 0.35) * 2;
  const worldH = (TABLE.halfH + rail + out * 0.35) * 2;
  const scale = Math.min((W - margin * 2) / worldW, (H - margin * 2) / worldH);
  return { cx: W * 0.5, cy: H * 0.5, scale, W, H };
}

/** Offscreen cache for the static table (felt weave is expensive per frame). */
let _tableCache = { canvas: null, key: '' };

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

/**
 * Reference-style table: continuous rails, pockets recessed in the wood,
 * cushion segments that open cleanly into each mouth (no green over the hole).
 * Static geometry is cached to an offscreen canvas for smooth frames.
 */
export function drawTable(g, view, animTime) {
  const S = view.scale;
  const left = view.cx - TABLE.halfW * S;
  const top = view.cy - TABLE.halfH * S;
  const tw = TABLE.halfW * 2 * S;
  const th = TABLE.halfH * 2 * S;
  const cssW = view.W || Math.ceil(view.cx * 2);
  const cssH = view.H || Math.ceil(view.cy * 2);
  const key = `${cssW}|${cssH}|${S.toFixed(4)}|${view.cx.toFixed(1)}|${view.cy.toFixed(1)}`;

  if (typeof document !== 'undefined') {
    if (!_tableCache.canvas || _tableCache.key !== key) {
      const c = _tableCache.canvas || document.createElement('canvas');
      c.width = Math.max(1, Math.ceil(cssW));
      c.height = Math.max(1, Math.ceil(cssH));
      const cg = c.getContext('2d', { alpha: false });
      cg.setTransform(1, 0, 0, 1, 0, 0);
      cg.fillStyle = '#0c1810';
      cg.fillRect(0, 0, c.width, c.height);
      paintStaticTable(cg, view);
      _tableCache = { canvas: c, key };
    }
    g.drawImage(_tableCache.canvas, 0, 0);
  } else {
    paintStaticTable(g, view);
  }

  // Cheap living light — only this animates each frame
  g.save();
  g.globalAlpha = 0.025 + Math.sin(animTime * 0.55) * 0.012;
  const glow = g.createRadialGradient(view.cx, view.cy, 8, view.cx, view.cy, tw * 0.55);
  glow.addColorStop(0, '#d8f5d0');
  glow.addColorStop(1, 'transparent');
  g.fillStyle = glow;
  g.fillRect(left, top, tw, th);
  g.restore();
}

function paintStaticTable(g, view) {
  const S = view.scale;
  const rail = TABLE.cushion * S;
  const face = (TABLE.cushionFace || 3.2) * S;
  const gap = TABLE.railGap * S;
  const left = view.cx - TABLE.halfW * S;
  const top = view.cy - TABLE.halfH * S;
  const tw = TABLE.halfW * 2 * S;
  const th = TABLE.halfH * 2 * S;
  const right = left + tw;
  const bottom = top + th;
  const woodTone = '#2e1a0e';

  const pad = Math.max(14, TABLE.pocketOut * S * 0.75);
  const fx = left - rail - pad;
  const fy = top - rail - pad;
  const fw = tw + rail * 2 + pad * 2;
  const fh = th + rail * 2 + pad * 2;
  const wood = g.createLinearGradient(fx, fy, fx + fw, fy + fh);
  wood.addColorStop(0, '#5a3a22');
  wood.addColorStop(0.45, '#3e2614');
  wood.addColorStop(1, '#2a180c');
  g.fillStyle = wood;
  g.beginPath();
  roundRect(g, fx, fy, fw, fh, 14);
  g.fill();
  g.strokeStyle = 'rgba(220, 180, 110, 0.2)';
  g.lineWidth = 2;
  g.beginPath();
  roundRect(g, fx + 3, fy + 3, fw - 6, fh - 6, 12);
  g.stroke();

  g.fillStyle = '#24160c';
  g.fillRect(left - rail, top - rail, tw + rail * 2, rail);
  g.fillRect(left - rail, bottom, tw + rail * 2, rail);
  g.fillRect(left - rail, top, rail, th);
  g.fillRect(right, top, rail, th);

  feltPattern(g, left, top, tw, th);
  punchPocketMouths(g, left, top, right, bottom, gap, face, rail, woodTone);
  drawCushions(g, left, top, right, bottom, face, gap);

  for (const p of pocketCenters()) {
    drawRailPocket(
      g,
      tableToScreen(p.x, p.y, view),
      TABLE.pocketR * S * (p.corner ? 1.02 : 0.92)
    );
  }

  drawDiamonds(g, left, top, tw, th, rail, gap);

  g.save();
  g.strokeStyle = 'rgba(220, 230, 210, 0.22)';
  g.setLineDash([5, 7]);
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(view.cx - TABLE.halfW * 0.5 * S, top + face + 2);
  g.lineTo(view.cx - TABLE.halfW * 0.5 * S, bottom - face - 2);
  g.stroke();
  g.setLineDash([]);
  const spot = tableToScreen(TABLE.halfW * 0.35, 0, view);
  g.fillStyle = 'rgba(240, 230, 180, 0.5)';
  g.beginPath();
  g.arc(spot.x, spot.y, 2.4, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** Fill rail gaps with wood so green felt never shows in a pocket mouth. */
function punchPocketMouths(g, left, top, right, bottom, gap, face, rail, woodTone) {
  const midX = (left + right) / 2;
  g.fillStyle = woodTone;

  // Side pockets — cover the mouth slot through felt edge + rail
  g.fillRect(midX - gap, top - rail, gap * 2, rail + 2);
  g.fillRect(midX - gap, bottom - 2, gap * 2, rail + 2);

  // Corner mouths — small wood patches at each felt corner
  const c = gap * 0.95;
  g.fillRect(left - 2, top - 2, c, c);
  g.fillRect(right - c + 2, top - 2, c, c);
  g.fillRect(left - 2, bottom - c + 2, c, c);
  g.fillRect(right - c + 2, bottom - c + 2, c, c);
  // Also clear into the rail at corners
  g.fillRect(left - rail, top - rail, c + rail * 0.35, c + rail * 0.35);
  g.fillRect(right - c + rail * 0.65, top - rail, c + rail * 0.35, c + rail * 0.35);
  g.fillRect(left - rail, bottom - c + rail * 0.65, c + rail * 0.35, c + rail * 0.35);
  g.fillRect(right - c + rail * 0.65, bottom - c + rail * 0.65, c + rail * 0.35, c + rail * 0.35);
}

/** Cushion strips between pocket mouths — rounded ends, nothing over the holes. */
function drawCushions(g, left, top, right, bottom, face, gap) {
  const jaw = gap;
  const cushionFill = '#2f6b4a';
  const cushionEdge = '#1e4a32';
  const lip = '#3d8a5c';
  const midX = (left + right) / 2;

  function hSeg(yInner, yOuter, x0, x1) {
    if (x1 - x0 < 6) return;
    const r = Math.min(face * 0.9, (x1 - x0) * 0.2);
    g.beginPath();
    g.moveTo(x0 + r, yInner);
    g.lineTo(x1 - r, yInner);
    // right end rounds out into the rail (toward pocket), not over it
    g.quadraticCurveTo(x1, yInner, x1, yOuter);
    g.lineTo(x0, yOuter);
    g.quadraticCurveTo(x0, yInner, x0 + r, yInner);
    g.closePath();
    g.fillStyle = cushionFill;
    g.fill();
    g.strokeStyle = cushionEdge;
    g.lineWidth = 1;
    g.stroke();
    g.beginPath();
    g.moveTo(x0 + r * 0.6, yInner);
    g.lineTo(x1 - r * 0.6, yInner);
    g.strokeStyle = lip;
    g.lineWidth = 2;
    g.stroke();
  }

  function vSeg(xInner, xOuter, y0, y1) {
    if (y1 - y0 < 6) return;
    const r = Math.min(face * 0.9, (y1 - y0) * 0.2);
    g.beginPath();
    g.moveTo(xInner, y0 + r);
    g.lineTo(xInner, y1 - r);
    g.quadraticCurveTo(xInner, y1, xOuter, y1);
    g.lineTo(xOuter, y0);
    g.quadraticCurveTo(xInner, y0, xInner, y0 + r);
    g.closePath();
    g.fillStyle = cushionFill;
    g.fill();
    g.strokeStyle = cushionEdge;
    g.lineWidth = 1;
    g.stroke();
    g.beginPath();
    g.moveTo(xInner, y0 + r * 0.6);
    g.lineTo(xInner, y1 - r * 0.6);
    g.strokeStyle = lip;
    g.lineWidth = 2;
    g.stroke();
  }

  // Corner mouths use a wider visual gap so the tip matches the forgiving physics.
  const cJaw = gap * ((TABLE.railGapCorner || TABLE.railGap) / TABLE.railGap);

  // Long rails: two segments each (split by side pocket) — corner ends use cJaw
  hSeg(top, top - face, left + cJaw, midX - jaw);
  hSeg(top, top - face, midX + jaw, right - cJaw);
  hSeg(bottom, bottom + face, left + cJaw, midX - jaw);
  hSeg(bottom, bottom + face, midX + jaw, right - cJaw);
  // Short rails: one segment each (corner mouths only)
  vSeg(left, left - face, top + cJaw, bottom - cJaw);
  vSeg(right, right + face, top + cJaw, bottom - cJaw);
}

function drawRailPocket(g, s, pr) {
  g.beginPath();
  g.arc(s.x, s.y, pr + 3.2, 0, Math.PI * 2);
  g.fillStyle = '#1a1008';
  g.fill();
  g.strokeStyle = 'rgba(180, 140, 80, 0.4)';
  g.lineWidth = 1.5;
  g.stroke();
  const hole = g.createRadialGradient(s.x - 1, s.y - 1, 1, s.x, s.y, pr);
  hole.addColorStop(0, '#1a2218');
  hole.addColorStop(0.45, '#060806');
  hole.addColorStop(1, '#000');
  g.beginPath();
  g.arc(s.x, s.y, pr, 0, Math.PI * 2);
  g.fillStyle = hole;
  g.fill();
}

function drawDiamonds(g, left, top, tw, th, rail, gap) {
  g.fillStyle = '#d8c8a0';
  const places = [];
  // Long rails: two diamonds each half (skip pocket mouths)
  for (const t of [0.2, 0.35, 0.65, 0.8]) {
    places.push({ x: left + tw * t, y: top - rail * 0.55 });
    places.push({ x: left + tw * t, y: top + th + rail * 0.55 });
  }
  for (const t of [0.28, 0.5, 0.72]) {
    places.push({ x: left - rail * 0.55, y: top + th * t });
    places.push({ x: left + tw + rail * 0.55, y: top + th * t });
  }
  for (const p of places) {
    // Keep diamonds off pocket mouths
    const midX = left + tw / 2;
    if (Math.abs(p.x - midX) < gap * 0.85 && (p.y < top || p.y > top + th)) continue;
    g.beginPath();
    g.moveTo(p.x, p.y - 2.2);
    g.lineTo(p.x + 2, p.y);
    g.lineTo(p.x, p.y + 2.2);
    g.lineTo(p.x - 2, p.y);
    g.closePath();
    g.fill();
  }
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
  if (ball.pocketed && !ball.falling) return;

  const fallT = ball.falling
    ? Math.min(1, ball.fallAge / (PHYSICS.pocketFallDur || 0.38))
    : 0;
  // Ease into the hole: shrink, sink, fade.
  const sink = fallT * fallT;
  const scale = 1 - sink * 0.82;
  const alpha = 1 - sink * 0.95;

  const s = tableToScreen(ball.x, ball.y, view);
  const r = ball.r * view.scale * scale;
  if (r < 0.4) return;

  g.save();
  g.globalAlpha = alpha;

  // Contact shadow (shrinks with the fall)
  if (!ball.falling || fallT < 0.85) {
    g.beginPath();
    g.ellipse(
      s.x + r * 0.08,
      s.y + r * 0.55 + sink * 6,
      r * 0.85 * (1 - sink * 0.5),
      r * 0.28 * (1 - sink * 0.5),
      0,
      0,
      Math.PI * 2
    );
    g.fillStyle = `rgba(0,0,0,${0.32 * (1 - sink)})`;
    g.fill();
  }

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
 * opts.legalIds: Set of ball ids that are legal to hit (wrong target → ✕).
 */
export function drawCueAndAim(g, cue, balls, view, aim, english, opts = {}) {
  if (!cue || cue.pocketed || !aim) return;
  const pulling = !!opts.pulling;
  const power = opts.power || 0;
  const legalIds = opts.legalIds || null;
  const ang = Math.atan2(aim.dy, aim.dx);
  const origin = tableToScreen(cue.x, cue.y, view);

  const pred = predictAim(cue, balls, aim.dx / view.scale, aim.dy / view.scale, english);
  const illegal =
    !!(pred && pred.target && legalIds && !legalIds.has(pred.target.id));

  g.save();

  // Aim guide to ghost / far end
  if (pred) {
    const end = tableToScreen(pred.aimEnd.x, pred.aimEnd.y, view);
    g.strokeStyle = illegal
      ? `rgba(220, 80, 70, ${0.35 + power * 0.35})`
      : `rgba(244, 240, 220, ${0.22 + power * 0.35})`;
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
      g.strokeStyle = illegal ? 'rgba(220, 90, 80, 0.85)' : 'rgba(244, 240, 220, 0.75)';
      g.lineWidth = 1.6;
      g.setLineDash([3, 3]);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = illegal ? 'rgba(200, 50, 40, 0.12)' : 'rgba(244, 240, 220, 0.08)';
      g.fill();

      // Contact mark on the object ball
      if (pred.contact) {
        const cs = tableToScreen(pred.contact.x, pred.contact.y, view);
        g.beginPath();
        g.arc(cs.x, cs.y, Math.max(3, gr * 0.28), 0, Math.PI * 2);
        g.fillStyle = illegal ? 'rgba(230, 90, 80, 0.95)' : 'rgba(255, 220, 100, 0.9)';
        g.fill();
        g.strokeStyle = 'rgba(40, 30, 10, 0.55)';
        g.lineWidth = 1;
        g.stroke();
      }

      // Object ball leave path — muted when illegal
      if (pred.objectDir && !illegal) {
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
      if (pred.cueDir && !illegal) {
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

      // Cut angle readout — or ✕ when aiming at a ball you shouldn't hit
      if (illegal) {
        const label = '✕';
        g.font = '700 16px "Trebuchet MS", sans-serif';
        const tw = Math.max(18, g.measureText(label).width);
        g.fillStyle = 'rgba(40, 10, 10, 0.7)';
        g.fillRect(gs.x - tw / 2 - 6, gs.y - gr - 24, tw + 12, 20);
        g.fillStyle = '#f07060';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(label, gs.x, gs.y - gr - 14);
      } else if (pred.cutDeg != null) {
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

  // Cue stick behind the ball — tapered shaft, not a matchstick stroke
  const tipGap = cue.r * view.scale + 3 + (pulling ? power * 40 : 10);
  const cueLen = (128 + power * 28) * (view.scale / 3.2);
  const tipX = origin.x - Math.cos(ang) * tipGap;
  const tipY = origin.y - Math.sin(ang) * tipGap;
  const buttX = origin.x - Math.cos(ang) * (tipGap + cueLen);
  const buttY = origin.y - Math.sin(ang) * (tipGap + cueLen);
  drawCueStick(g, tipX, tipY, buttX, buttY, view.scale);

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

/** Tapered maple cue: butt → wrap → shaft → ferrule → chalk tip. */
function drawCueStick(g, tipX, tipY, buttX, buttY, scale) {
  const dx = tipX - buttX;
  const dy = tipY - buttY;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const k = scale / 3.2;
  const buttW = Math.max(5.2, 6.8 * k);
  const tipW = Math.max(1.6, 2.15 * k);

  function widthAt(t) {
    // t=0 butt, t=1 tip — gentle taper with a thicker butt
    return buttW + (tipW - buttW) * (0.15 + 0.85 * t * t);
  }

  function point(t, side) {
    const w = widthAt(t);
    return {
      x: buttX + ux * len * t + px * w * side,
      y: buttY + uy * len * t + py * w * side,
    };
  }

  function seg(t0, t1) {
    const a = point(t0, -1);
    const b = point(t0, 1);
    const c = point(t1, 1);
    const d = point(t1, -1);
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.lineTo(c.x, c.y);
    g.lineTo(d.x, d.y);
    g.closePath();
  }

  // Soft contact shadow under the stick
  g.save();
  g.translate(1.6, 2.2);
  g.globalAlpha = 0.28;
  seg(0, 1);
  g.fillStyle = '#000';
  g.fill();
  g.restore();

  // Butt (dark rosewood)
  seg(0, 0.22);
  const buttGrad = g.createLinearGradient(buttX, buttY, buttX + ux * len * 0.22, buttY + uy * len * 0.22);
  buttGrad.addColorStop(0, '#1a0e08');
  buttGrad.addColorStop(0.4, '#4a2814');
  buttGrad.addColorStop(1, '#3a1e10');
  g.fillStyle = buttGrad;
  g.fill();

  // Irish linen wrap
  seg(0.2, 0.34);
  g.fillStyle = '#2a2420';
  g.fill();
  g.save();
  g.globalAlpha = 0.35;
  g.strokeStyle = '#6a6058';
  g.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    const t = 0.21 + i * 0.018;
    const p0 = point(t, -1);
    const p1 = point(t, 1);
    g.beginPath();
    g.moveTo(p0.x, p0.y);
    g.lineTo(p1.x, p1.y);
    g.stroke();
  }
  g.restore();

  // Maple shaft
  seg(0.32, 0.9);
  const shaftGrad = g.createLinearGradient(
    buttX + ux * len * 0.32,
    buttY + uy * len * 0.32,
    tipX,
    tipY
  );
  shaftGrad.addColorStop(0, '#8a6238');
  shaftGrad.addColorStop(0.35, '#d2b07a');
  shaftGrad.addColorStop(0.7, '#e8d2a0');
  shaftGrad.addColorStop(1, '#f0e0b8');
  g.fillStyle = shaftGrad;
  g.fill();

  // Light edge highlight along the taper
  g.strokeStyle = 'rgba(255, 245, 220, 0.35)';
  g.lineWidth = 1;
  g.beginPath();
  const h0 = point(0.34, -0.55);
  const h1 = point(0.88, -0.55);
  g.moveTo(h0.x, h0.y);
  g.lineTo(h1.x, h1.y);
  g.stroke();

  // Ferrule
  seg(0.9, 0.965);
  g.fillStyle = '#e8eef0';
  g.fill();
  g.strokeStyle = 'rgba(40, 50, 55, 0.35)';
  g.lineWidth = 0.8;
  g.stroke();

  // Leather tip + chalk face
  seg(0.96, 1);
  g.fillStyle = '#6a3a22';
  g.fill();
  g.beginPath();
  g.arc(tipX, tipY, tipW * 1.05, 0, Math.PI * 2);
  g.fillStyle = '#5eb8b0';
  g.fill();
  g.strokeStyle = 'rgba(20, 40, 40, 0.4)';
  g.lineWidth = 0.8;
  g.stroke();
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

/**
 * Highlight pockets when calling the 8. calledId may be null (pick mode).
 */
export function drawPocketCallHints(g, view, calledId, pulse = 0) {
  const pockets = pocketCenters();
  g.save();
  for (const p of pockets) {
    const s = tableToScreen(p.x, p.y, view);
    const pr = TABLE.pocketR * view.scale * (p.corner ? 1.05 : 0.95);
    const isCalled = calledId != null && p.id === calledId;
    const glow = isCalled
      ? 0.55 + Math.sin(pulse * 4) * 0.15
      : calledId == null
        ? 0.28 + Math.sin(pulse * 3 + p.id) * 0.08
        : 0.1;
    g.beginPath();
    g.arc(s.x, s.y, pr + (isCalled ? 7 : 4), 0, Math.PI * 2);
    g.strokeStyle = isCalled
      ? `rgba(232, 200, 90, ${glow})`
      : `rgba(200, 220, 180, ${glow})`;
    g.lineWidth = isCalled ? 3 : 1.5;
    g.stroke();
    if (isCalled) {
      g.font = '700 10px "Trebuchet MS", sans-serif';
      g.fillStyle = 'rgba(232, 200, 90, 0.95)';
      g.textAlign = 'center';
      g.textBaseline = 'bottom';
      g.fillText('CALLED', s.x, s.y - pr - 8);
    }
  }
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
