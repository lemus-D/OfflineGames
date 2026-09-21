/* Water, sky/surface, light, seabed, structures, particulate. */

import { makeRNG, fbm, clamp } from '../core/rng.js';
import { SURFACE_Y, WORLD_FLOOR } from './structures.js';

const LW = 128,
  LH = 72;
let lightCv = null,
  lightCtx = null,
  lightImg = null,
  lightStamp = -1e9;

/** Caustics/shafts — rebuilt ~15 Hz, not every paint. Dominates frame cost otherwise. */
function lightLayer(t) {
  if (!lightCv) {
    lightCv = document.createElement('canvas');
    lightCv.width = LW;
    lightCv.height = LH;
    lightCtx = lightCv.getContext('2d', { willReadFrequently: true });
    lightImg = lightCtx.createImageData(LW, LH);
  }
  if (t - lightStamp < 1 / 15 && lightStamp >= 0) return lightCv;
  lightStamp = t;

  const px = lightImg.data;
  for (let y = 0; y < LH; y++) {
    const depth = y / LH;
    const causticFade = Math.max(0, 1 - depth / 0.55);
    const rayFade = Math.max(0, 1 - depth / 0.95);
    for (let x = 0; x < LW; x++) {
      // Fewer fbm octaves than the spike — still reads as water, much cheaper.
      const mesh =
        (fbm(x * 0.105 + t * 0.3, y * 0.165, 2, 2.07, 0.5, 11) +
          fbm(x * 0.14 - t * 0.22, y * 0.205, 1, 2.07, 0.5, 29)) *
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

  // Pillar — slightly tapered.
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

  // Sky (flat gradient — no clouds).
  if (surfaceScreenY > 0) {
    const skyH = Math.min(H, surfaceScreenY);
    const sky = g.createLinearGradient(0, 0, 0, skyH);
    sky.addColorStop(0, '#7ec8e8');
    sky.addColorStop(0.55, '#4aa3c8');
    sky.addColorStop(1, '#2e93b8');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, skyH);
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
    g.drawImage(lightLayer(t), 0, waterTop, W, H - waterTop);
    g.restore();

    g.fillStyle = `rgba(2,12,22,${0.12 + depthFrac * 0.48})`;
    g.fillRect(0, waterTop, W, H - waterTop);
  }

  // Surface wave line (coarser step).
  if (surfaceScreenY > -30 && surfaceScreenY < H + 30) {
    g.beginPath();
    for (let x = 0; x <= W; x += 16) {
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
    g.lineTo(W, surfaceScreenY + 18);
    g.lineTo(0, surfaceScreenY + 18);
    g.closePath();
    g.fillStyle = 'rgba(180,230,250,0.12)';
    g.fill();
  }

  // Structures.
  for (let i = 0; i < structures.length; i++) {
    drawStructure(g, structures[i], originX, originY, W, H);
  }

  // Seabed — cheap sine profile instead of per-segment fbm.
  const bedY = floorY - originY;
  if (bedY < H + 80) {
    g.beginPath();
    g.moveTo(0, Math.max(bedY, H));
    for (let x = 0; x <= W; x += 32) {
      const wx = originX + x;
      g.lineTo(x, bedY - 18 - 14 * Math.sin(wx * 0.008) - 8 * Math.sin(wx * 0.023));
    }
    g.lineTo(W, H + 40);
    g.lineTo(0, H + 40);
    g.closePath();
    g.fillStyle = 'rgba(3,22,30,0.92)';
    g.fill();
  }

  // Sparse particulate.
  if (surfaceScreenY < H) {
    const prng = makeRNG(0x5eed);
    g.fillStyle = 'rgba(200,235,245,0.28)';
    for (let i = 0; i < 70; i++) {
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
