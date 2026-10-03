/* Procedural art: sky, stars, rocket, pickups. Zero asset files. */

import { clamp, lerp, hash2i } from '../core/rng.js';
import { WORLD_HALF_W } from './content.js';

export function worldToScreen(wx, wy, camY, W, H) {
  // Larger scale = bigger rocket/pickups on screen (world half-width still clamps play).
  const scale = Math.min(W, H) / (WORLD_HALF_W * 1.85);
  return {
    x: W * 0.5 + wx * scale,
    y: H * 0.62 - (wy - camY) * scale,
    scale,
  };
}

export function drawSky(g, W, H, altitude, time) {
  // Warm ground glow → cold space. No purple default look.
  const t = clamp(altitude / 3500, 0, 1);
  const top = mixRgb([8, 14, 28], [2, 4, 10], t);
  const mid = mixRgb([28, 52, 88], [6, 10, 22], t);
  const bot = mixRgb([210, 140, 78], [12, 18, 36], Math.min(1, t * 1.4));

  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, rgb(top));
  grad.addColorStop(0.45, rgb(mid));
  grad.addColorStop(1, rgb(bot));
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  // Stars fade in with altitude.
  const starAlpha = clamp((altitude - 400) / 1800, 0, 0.95);
  if (starAlpha > 0.02) {
    g.fillStyle = `rgba(230,240,255,${starAlpha})`;
    const cols = 18;
    const rows = 28;
    for (let iy = 0; iy < rows; iy++) {
      for (let ix = 0; ix < cols; ix++) {
        const n = hash2i(ix, iy + Math.floor(altitude / 40), 91);
        if (n < 0.72) continue;
        const x = ((ix + hash2i(ix, iy, 3)) / cols) * W;
        const y =
          (((iy + hash2i(ix, iy, 7) + (altitude * 0.002) % 1) / rows) * H + H) % H;
        const r = 0.6 + n * 1.4;
        g.beginPath();
        g.arc(x, y, r, 0, 7);
        g.fill();
      }
    }
  }

  // Thin cloud wisps near the ground.
  if (t < 0.55) {
    g.fillStyle = `rgba(255,245,230,${(1 - t / 0.55) * 0.12})`;
    for (let i = 0; i < 5; i++) {
      const y = H * (0.55 + i * 0.08) + Math.sin(time * 0.3 + i) * 6;
      g.beginPath();
      g.ellipse(W * (0.2 + i * 0.15), y, 80 + i * 20, 10, 0, 0, 7);
      g.fill();
    }
  }
}

export function drawPickup(g, kind, x, y, r, spin, time) {
  g.save();
  g.translate(x, y);
  g.rotate(spin);

  if (kind === 'fuel') {
    const pulse = 0.85 + Math.sin(time * 6 + spin) * 0.15;
    g.fillStyle = 'rgba(80, 220, 170, 0.22)';
    g.beginPath();
    g.arc(0, 0, r * 1.55 * pulse, 0, 7);
    g.fill();
    const fg = g.createRadialGradient(0, 0, 0, 0, 0, r);
    fg.addColorStop(0, '#e8fff4');
    fg.addColorStop(0.45, '#4fd4a0');
    fg.addColorStop(1, '#1a7a58');
    g.fillStyle = fg;
    g.beginPath();
    g.arc(0, 0, r, 0, 7);
    g.fill();
    g.strokeStyle = 'rgba(200,255,230,0.7)';
    g.lineWidth = 1.5;
    g.stroke();
  } else if (kind === 'coin') {
    g.fillStyle = 'rgba(255, 200, 80, 0.2)';
    g.beginPath();
    g.arc(0, 0, r * 1.4, 0, 7);
    g.fill();
    const cg = g.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
    cg.addColorStop(0, '#fff2b0');
    cg.addColorStop(0.55, '#e8a820');
    cg.addColorStop(1, '#9a5a10');
    g.fillStyle = cg;
    g.beginPath();
    g.ellipse(0, 0, r, r * 0.82, 0, 0, 7);
    g.fill();
    g.strokeStyle = 'rgba(255,230,140,0.85)';
    g.lineWidth = 1.5;
    g.stroke();
    g.fillStyle = 'rgba(120,70,10,0.55)';
    g.font = `bold ${Math.max(9, r)}px Trebuchet MS, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('$', 0, 1);
  } else {
    // Meteor
    g.fillStyle = 'rgba(255, 90, 50, 0.18)';
    g.beginPath();
    g.arc(0, 0, r * 1.35, 0, 7);
    g.fill();
    g.fillStyle = '#5a4036';
    g.beginPath();
    jagged(g, r, 7, spin);
    g.fill();
    g.fillStyle = '#3a2820';
    g.beginPath();
    g.arc(-r * 0.2, -r * 0.1, r * 0.35, 0, 7);
    g.fill();
    g.beginPath();
    g.arc(r * 0.25, r * 0.2, r * 0.22, 0, 7);
    g.fill();
    // Ember rim
    g.strokeStyle = 'rgba(255,140,60,0.55)';
    g.lineWidth = 2;
    g.beginPath();
    jagged(g, r, 7, spin);
    g.stroke();
  }

  g.restore();
}

function jagged(g, r, sides, seed) {
  g.moveTo(r, 0);
  for (let i = 1; i <= sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const rr = r * (0.72 + ((Math.sin(seed * 3 + i * 2.1) + 1) * 0.5) * 0.4);
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.closePath();
}

export function drawRocket(g, x, y, scale, tilt, time, thrusting) {
  g.save();
  g.translate(x, y);
  g.rotate(tilt * 0.35);
  const s = scale;

  // Exhaust
  if (thrusting) {
    const flicker = 0.75 + Math.sin(time * 40) * 0.25;
    for (let i = 3; i >= 0; i--) {
      const h = (18 + i * 10) * s * flicker;
      const w = (6 + i * 3) * s;
      g.fillStyle = i === 0 ? 'rgba(255,245,200,0.9)' : `rgba(255,${140 - i * 20},${40},0.${6 - i})`;
      g.beginPath();
      g.moveTo(-w, 12 * s);
      g.lineTo(0, 12 * s + h);
      g.lineTo(w, 12 * s);
      g.closePath();
      g.fill();
    }
  }

  // Fins
  g.fillStyle = '#c45a3a';
  g.beginPath();
  g.moveTo(-10 * s, 8 * s);
  g.lineTo(-18 * s, 16 * s);
  g.lineTo(-8 * s, 14 * s);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(10 * s, 8 * s);
  g.lineTo(18 * s, 16 * s);
  g.lineTo(8 * s, 14 * s);
  g.closePath();
  g.fill();

  // Body
  const body = g.createLinearGradient(-12 * s, 0, 12 * s, 0);
  body.addColorStop(0, '#d8dde8');
  body.addColorStop(0.45, '#f4f6fa');
  body.addColorStop(1, '#a8b0c0');
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(0, -22 * s);
  g.quadraticCurveTo(12 * s, -8 * s, 11 * s, 10 * s);
  g.lineTo(7 * s, 14 * s);
  g.lineTo(-7 * s, 14 * s);
  g.lineTo(-11 * s, 10 * s);
  g.quadraticCurveTo(-12 * s, -8 * s, 0, -22 * s);
  g.closePath();
  g.fill();

  // Nose
  g.fillStyle = '#e07040';
  g.beginPath();
  g.moveTo(0, -22 * s);
  g.quadraticCurveTo(8 * s, -12 * s, 6 * s, -6 * s);
  g.lineTo(-6 * s, -6 * s);
  g.quadraticCurveTo(-8 * s, -12 * s, 0, -22 * s);
  g.closePath();
  g.fill();

  // Window
  g.fillStyle = '#1a3048';
  g.beginPath();
  g.arc(0, -2 * s, 4.5 * s, 0, 7);
  g.fill();
  g.fillStyle = 'rgba(160,210,240,0.55)';
  g.beginPath();
  g.arc(-1 * s, -3 * s, 2 * s, 0, 7);
  g.fill();

  // Stripe
  g.fillStyle = '#2a6a8a';
  g.fillRect(-8 * s, 4 * s, 16 * s, 3 * s);

  g.restore();
}

export function drawCollectFx(g, fx, camY, W, H, time) {
  const u = fx.age / fx.life;
  const scr = worldToScreen(fx.x, fx.y, camY, W, H);
  g.save();
  g.globalAlpha = 1 - u;
  g.strokeStyle =
    fx.kind === 'meteor' ? 'rgba(255,120,60,0.9)' : fx.kind === 'coin' ? '#ffd060' : '#6fecc0';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(scr.x, scr.y, (8 + u * 22) * scr.scale, 0, 7);
  g.stroke();
  g.restore();
}

export function drawHitFlash(g, W, H, flash) {
  if (flash <= 0) return;
  g.fillStyle = `rgba(255, 80, 40, ${flash * 0.35})`;
  g.fillRect(0, 0, W, H);
}

function mixRgb(a, b, t) {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ];
}

function rgb([r, g, b]) {
  return `rgb(${r},${g},${b})`;
}
