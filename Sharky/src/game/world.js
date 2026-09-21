/* Water, sky/surface, light, kelp, seabed, structures, particulate. */

import { makeRNG, vnoise, fbm, clamp } from '../core/rng.js';
import { SURFACE_Y, WORLD_FLOOR } from './structures.js';

const LW = 160,
  LH = 90;
let lightCv = null,
  lightCtx = null,
  lightImg = null;

function lightLayer(t) {
  if (!lightCv) {
    lightCv = document.createElement('canvas');
    lightCv.width = LW;
    lightCv.height = LH;
    lightCtx = lightCv.getContext('2d');
    lightImg = lightCtx.createImageData(LW, LH);
  }
  const px = lightImg.data;
  for (let y = 0; y < LH; y++) {
    const depth = y / LH;
    const causticFade = Math.max(0, 1 - depth / 0.55);
    const rayFade = Math.max(0, 1 - depth / 0.95);
    for (let x = 0; x < LW; x++) {
      const mesh =
        (fbm(x * 0.105 + t * 0.3, y * 0.165, 3, 2.07, 0.5, 11) +
          fbm(x * 0.14 - t * 0.22, y * 0.205, 2, 2.07, 0.5, 29)) *
        0.5;
      const caustic = clamp((mesh - 0.5) * 3.2, 0, 1) * causticFade;
      const phase = x * 0.115 + depth * 1.5 + t * 0.22 + Math.sin(x * 0.021) * 1.6;
      const shaft = Math.pow(Math.max(0, Math.sin(phase)), 7) * rayFade;
      const v = clamp(caustic * 0.8 + shaft * 0.55, 0, 1);
      const o = (y * LW + x) * 4;
      px[o] = 175;
      px[o + 1] = 238;
      px[o + 2] = 255;
      px[o + 3] = v * 128;
    }
  }
  lightCtx.putImageData(lightImg, 0, 0);
  return lightCv;
}

function drawStructure(g, s, originX, originY, viewW, viewH) {
  const sx = s.x - originX;
  const sy = s.y - originY;
  if (sx + s.w < -40 || sx > viewW + 40 || sy + s.h < -40 || sy > viewH + 40) return;

  if (s.kind === 'arch') {
    const pw = s.pillarW;
    g.fillStyle = `hsla(${s.hue} 28% 28% / 0.92)`;
    g.fillRect(sx, sy + s.h * 0.35, pw, s.h * 0.65);
    g.fillRect(sx + s.w - pw, sy + s.h * 0.35, pw, s.h * 0.65);
    g.beginPath();
    g.moveTo(sx, sy + s.h * 0.38);
    g.quadraticCurveTo(sx + s.w * 0.5, sy - s.h * 0.08, sx + s.w, sy + s.h * 0.38);
    g.lineTo(sx + s.w - pw * 0.4, sy + s.h * 0.38);
    g.quadraticCurveTo(sx + s.w * 0.5, sy + s.h * 0.12, sx + pw * 0.4, sy + s.h * 0.38);
    g.closePath();
    g.fill();
    return;
  }

  if (s.kind === 'ruin') {
    g.fillStyle = `hsla(${s.hue} 18% 36% / 0.88)`;
    g.fillRect(sx, sy, s.w, s.h);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < 4; i++) {
      g.fillRect(sx + s.w * (0.15 + i * 0.2), sy + s.h * 0.2, s.w * 0.1, s.h * 0.22);
    }
    return;
  }

  // Pillar default — slightly tapered.
  g.fillStyle = `hsla(${s.hue} 30% 26% / 0.94)`;
  g.beginPath();
  g.moveTo(sx + s.w * 0.12, sy + s.h);
  g.lineTo(sx, sy);
  g.lineTo(sx + s.w, sy);
  g.lineTo(sx + s.w * 0.88, sy + s.h);
  g.closePath();
  g.fill();
  g.fillStyle = `hsla(${s.hue} 25% 18% / 0.5)`;
  g.fillRect(sx + s.w * 0.2, sy + s.h * 0.15, s.w * 0.15, s.h * 0.5);
}

/**
 * Draw the ocean + sky, parallaxed to camera.
 * World Y increases downward; surface is y = SURFACE_Y; seabed near WORLD_FLOOR.
 */
export function drawWorld(g, W, H, t, camX, camY, structures = [], floorY = WORLD_FLOOR) {
  const originX = camX - W * 0.5;
  const originY = camY - H * 0.5;
  const surfaceScreenY = SURFACE_Y - originY;

  // Sky (above the surface).
  if (surfaceScreenY > 0) {
    const skyH = Math.min(H, surfaceScreenY);
    const sky = g.createLinearGradient(0, 0, 0, skyH);
    sky.addColorStop(0, '#7ec8e8');
    sky.addColorStop(0.55, '#4aa3c8');
    sky.addColorStop(1, '#2e93b8');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, skyH);

    // Soft clouds.
    g.fillStyle = 'rgba(255,255,255,0.18)';
    for (let i = 0; i < 6; i++) {
      const cx = ((i * 211 + t * 8) % (W + 200)) - 100;
      const cy = 40 + (i * 37) % Math.max(20, skyH - 60);
      g.beginPath();
      g.ellipse(cx, cy, 70 + i * 8, 18 + i * 2, 0, 0, 7);
      g.fill();
    }
  }

  // Water fill below surface.
  const waterTop = Math.max(0, surfaceScreenY);
  if (waterTop < H) {
    const depthFrac = clamp((camY - SURFACE_Y) / floorY, 0, 1);
    const water = g.createLinearGradient(0, waterTop, 0, H);
    water.addColorStop(0, '#2e93b8');
    water.addColorStop(0.22, '#12607f');
    water.addColorStop(0.62, '#06324a');
    water.addColorStop(1, '#02121d');
    g.fillStyle = water;
    g.fillRect(0, waterTop, W, H - waterTop);

    g.save();
    g.beginPath();
    g.rect(0, waterTop, W, H - waterTop);
    g.clip();
    g.globalCompositeOperation = 'lighter';
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(lightLayer(t), 0, 0, W, H);
    g.restore();

    g.fillStyle = `rgba(2,12,22,${0.12 + depthFrac * 0.48})`;
    g.fillRect(0, waterTop, W, H - waterTop);
  }

  // Surface wave line.
  if (surfaceScreenY > -30 && surfaceScreenY < H + 30) {
    g.beginPath();
    for (let x = 0; x <= W; x += 10) {
      const wx = originX + x;
      const wave =
        Math.sin(wx * 0.012 + t * 2.1) * 5 + Math.sin(wx * 0.031 - t * 1.4) * 2.5;
      const y = surfaceScreenY + wave;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.strokeStyle = 'rgba(220,245,255,0.55)';
    g.lineWidth = 2.5;
    g.stroke();
    // Foam band.
    g.lineTo(W, surfaceScreenY + 18);
    g.lineTo(0, surfaceScreenY + 18);
    g.closePath();
    g.fillStyle = 'rgba(180,230,250,0.12)';
    g.fill();
  }

  // Structures.
  for (const s of structures) drawStructure(g, s, originX, originY, W, H);

  // Kelp rooted near the seabed.
  for (let i = 0; i < 22; i++) {
    const worldX = Math.floor(camX / 180) * 180 + i * 90 - 400;
    const bx = worldX - originX;
    if (bx < -80 || bx > W + 80) continue;
    const h = 180 + 220 * vnoise(i * 7.3 + Math.floor(camX / 900), 1.2, 3);
    const baseY = floorY - originY;
    const pts = [[bx, baseY]];
    for (let k = 1; k <= 8; k++) {
      const u = k / 8;
      const sway = Math.sin(t * 0.8 + i * 1.7 + u * 2.4) * 30 * u * u;
      pts.push([bx + sway, baseY - h * u]);
    }
    g.strokeStyle = 'rgba(5,30,30,0.70)';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts) g.lineTo(p[0], p[1]);
    g.lineWidth = 5 + 5 * vnoise(i * 3.7, 0.5, 9);
    g.stroke();
    g.lineWidth = 2.5;
    for (let k = 2; k < pts.length; k += 2) {
      const side = k % 4 === 0 ? 1 : -1;
      g.beginPath();
      g.moveTo(pts[k][0], pts[k][1]);
      g.quadraticCurveTo(
        pts[k][0] + side * 22,
        pts[k][1] + 6,
        pts[k][0] + side * 34,
        pts[k][1] + 20
      );
      g.stroke();
    }
  }

  // Seabed.
  const bedY = floorY - originY;
  if (bedY < H + 80) {
    g.beginPath();
    g.moveTo(0, Math.max(bedY, H));
    for (let x = 0; x <= W; x += 24) {
      const wx = originX + x;
      g.lineTo(x, bedY - 14 - 26 * fbm(wx * 0.004, 0.7, 3, 2.07, 0.5, 41));
    }
    g.lineTo(W, H + 40);
    g.lineTo(0, H + 40);
    g.closePath();
    g.fillStyle = 'rgba(3,22,30,0.92)';
    g.fill();
  }

  // Particulate (underwater only).
  if (surfaceScreenY < H) {
    const prng = makeRNG(0x5eed);
    g.fillStyle = 'rgba(200,235,245,0.28)';
    for (let i = 0; i < 160; i++) {
      const px = ((prng() * W * 2 + t * 9 - originX * 0.15) % W + W) % W;
      const py =
        ((prng() * H * 2 + Math.sin(t * 0.5 + i) * 6 + t * 4 - originY * 0.08) % H + H) % H;
      if (py > surfaceScreenY) g.fillRect(px, py, 1.6, 1.6);
    }
  }

  // Vignette.
  const vg = g.createRadialGradient(
    W / 2,
    H / 2,
    Math.min(W, H) * 0.34,
    W / 2,
    H / 2,
    Math.max(W, H) * 0.78
  );
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,8,16,0.55)');
  g.fillStyle = vg;
  g.fillRect(0, 0, W, H);
}
