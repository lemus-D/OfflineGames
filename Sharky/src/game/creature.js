/* One parametric body plan. A species is ~14 numbers; one draw function. */

import { makeRNG, lerp } from '../core/rng.js';

function spineAt(u, t, s, speed) {
  const amp = 0.12 * s.bend * (0.25 + u * u);
  return Math.sin(u * 4.2 - t * speed) * amp;
}

/**
 * Draw a creature centered at (x, y) facing ±1 along X.
 * Eye radius scales with sqrt(length) — linear scaling reads as cartoon minnows.
 */
export function drawCreature(g, s, x, y, len, t, speed, facing, opts = {}) {
  const d = len * s.bodyDepth;
  g.save();
  g.translate(x, y);
  g.scale(facing, 1);

  if (opts.outline) {
    g.shadowColor = opts.outline;
    g.shadowBlur = Math.max(4, len * 0.08);
  }

  const N = 26;
  const top = [],
    bot = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const prof =
      Math.pow(Math.sin(Math.PI * Math.pow(u, 0.62)), 0.85) * lerp(1, 0.3, Math.pow(u, 2.1));
    const px = lerp(-len * 0.5, len * 0.46, u);
    const py = spineAt(u, t, s, speed) * len;
    const half = prof * d * 0.5;
    top.push([px, py - half * lerp(1, s.noseSharp, 1 - u)]);
    bot.push([px, py + half]);
  }

  const tailX = lerp(-len * 0.5, len * 0.46, 1);
  const tailY = spineAt(1, t, s, speed) * len;

  const span = d * s.tailSpan;
  g.beginPath();
  g.moveTo(tailX, tailY);
  if (s.tailKind === 'round') {
    g.quadraticCurveTo(tailX + len * 0.14, tailY - span * 0.6, tailX + len * 0.1, tailY);
    g.quadraticCurveTo(tailX + len * 0.14, tailY + span * 0.6, tailX, tailY);
  } else {
    const reach = s.tailKind === 'lunate' ? 0.2 : 0.15;
    g.lineTo(tailX + len * reach, tailY - span);
    g.quadraticCurveTo(tailX + len * 0.06, tailY, tailX + len * reach, tailY + span);
  }
  g.closePath();
  g.fillStyle = `hsl(${s.hue2} ${s.sat}% ${s.light * 0.72}%)`;
  g.fill();

  const shoulder = Math.round(N * 0.34),
    mid = Math.round(N * 0.52);
  g.beginPath();
  g.moveTo(top[shoulder][0], top[shoulder][1]);
  g.quadraticCurveTo(
    top[mid][0] - len * 0.02,
    top[mid][1] - d * s.dorsal,
    top[mid + 4][0],
    top[mid + 4][1]
  );
  g.closePath();
  g.fillStyle = `hsl(${s.hue2} ${s.sat}% ${s.light * 0.66}%)`;
  g.fill();

  g.beginPath();
  g.moveTo(bot[shoulder][0], bot[shoulder][1]);
  g.quadraticCurveTo(
    bot[shoulder][0] + len * 0.06,
    bot[shoulder][1] + d * s.pectoral,
    bot[mid][0],
    bot[mid][1]
  );
  g.closePath();
  g.fillStyle = `hsl(${s.hue2} ${s.sat}% ${s.light * 0.58}%)`;
  g.fill();

  g.beginPath();
  g.moveTo(top[0][0], top[0][1]);
  for (let i = 1; i <= N; i++) g.lineTo(top[i][0], top[i][1]);
  for (let i = N; i >= 0; i--) g.lineTo(bot[i][0], bot[i][1]);
  g.closePath();

  const grad = g.createLinearGradient(0, -d * 0.6, 0, d * 0.6);
  grad.addColorStop(0, `hsl(${s.hue} ${s.sat}% ${s.light}%)`);
  grad.addColorStop(0.55, `hsl(${s.hue} ${s.sat * 0.9}% ${s.light * 0.74}%)`);
  grad.addColorStop(1, `hsl(${s.hue2} ${s.sat * 0.5}% ${Math.min(92, s.light * 1.5)}%)`);
  g.fillStyle = grad;
  g.fill();

  if (s.pattern !== 'none') {
    g.save();
    g.clip();
    g.fillStyle = `hsla(${s.hue} ${s.sat + 10}% ${s.light * 0.5}% / 0.5)`;
    if (s.pattern === 'stripes') {
      for (let i = 0; i < 7; i++) {
        const px = lerp(-len * 0.42, len * 0.4, i / 6);
        g.fillRect(px, -d, len * 0.028, d * 2);
      }
    } else if (s.pattern === 'spots') {
      const rng = makeRNG(s.seed ^ 0x9e37);
      for (let i = 0; i < 22; i++) {
        g.beginPath();
        g.arc(
          lerp(-len * 0.45, len * 0.42, rng()),
          lerp(-d * 0.45, d * 0.45, rng()),
          len * 0.018 * (0.5 + rng()),
          0,
          7
        );
        g.fill();
      }
    } else {
      g.fillRect(-len * 0.5, d * 0.12, len, d);
    }
    g.restore();
  }

  const eyeR = Math.sqrt(len) * s.eye * 5.1;
  const ex = -len * 0.34,
    ey = spineAt(0.1, t, s, speed) * len - d * 0.12;
  g.beginPath();
  g.arc(ex, ey, eyeR, 0, 7);
  g.fillStyle = '#f4f8fb';
  g.fill();
  g.beginPath();
  g.arc(ex - eyeR * 0.22, ey, eyeR * 0.52, 0, 7);
  g.fillStyle = '#0a1016';
  g.fill();

  if (s.jaw > 0.35) {
    g.beginPath();
    g.moveTo(-len * 0.5, ey + d * 0.16);
    g.lineTo(-len * 0.3, ey + d * 0.26);
    g.lineWidth = Math.max(1, len * 0.012);
    g.strokeStyle = '#0b1118cc';
    g.stroke();
    const teeth = Math.round(3 + s.jaw * 5);
    g.fillStyle = '#f7fbfd';
    for (let i = 0; i < teeth; i++) {
      const u = teeth <= 1 ? 0 : i / (teeth - 1);
      const tx = lerp(-len * 0.485, -len * 0.315, u);
      const ty = lerp(ey + d * 0.165, ey + d * 0.255, u);
      const h = len * 0.022 * s.jaw;
      g.beginPath();
      g.moveTo(tx, ty);
      g.lineTo(tx + h * 0.7, ty);
      g.lineTo(tx + h * 0.35, ty - h);
      g.closePath();
      g.fill();
    }
  }

  g.shadowBlur = 0;
  g.restore();
}

/** Length in world pixels from mass. Thresholds stay coherent as fractions of length. */
export function lengthFromMass(mass) {
  return 28 * Math.pow(mass, 0.55);
}

export function massFromLength(len) {
  return Math.pow(len / 28, 1 / 0.55);
}
