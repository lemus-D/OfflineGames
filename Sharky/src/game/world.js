/* Water, light layer, kelp, seabed, particulate — noise, not creatures. */

import { makeRNG, vnoise, fbm, clamp } from '../core/rng.js';

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

/**
 * Draw the ocean parallaxed to camera (camX, camY).
 * World Y increases downward; seabed sits near world Y = floorY.
 */
export function drawWorld(g, W, H, t, camX, camY, floorY = 2200) {
  const sky = g.createLinearGradient(0, 0, 0, H);
  // Depth tint from camera Y.
  const depthFrac = clamp(camY / floorY, 0, 1);
  sky.addColorStop(0, depthFrac < 0.35 ? '#2e93b8' : '#1a6a8a');
  sky.addColorStop(0.22, '#12607f');
  sky.addColorStop(0.62, '#06324a');
  sky.addColorStop(1, '#02121d');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  g.save();
  g.globalCompositeOperation = 'lighter';
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(lightLayer(t), 0, 0, W, H);
  g.restore();

  // Murk thickens with depth.
  g.fillStyle = `rgba(2,12,22,${0.15 + depthFrac * 0.45})`;
  g.fillRect(0, 0, W, H);

  const originX = camX - W * 0.5;
  const originY = camY - H * 0.5;

  // Kelp rooted near the seabed, scrolled with camera.
  for (let i = 0; i < 22; i++) {
    const worldX = Math.floor(camX / 180) * 180 + i * 90 - 400;
    const bx = worldX - originX;
    if (bx < -80 || bx > W + 80) continue;
    const h = 180 + 220 * vnoise(i * 7.3, 1.2, 3);
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

  // Seabed strip.
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

  // Suspended particulate, camera-relative.
  const prng = makeRNG(0x5eed);
  g.fillStyle = 'rgba(200,235,245,0.28)';
  for (let i = 0; i < 180; i++) {
    const px = ((prng() * W * 2 + t * 9 - originX * 0.15) % W + W) % W;
    const py = ((prng() * H * 2 + Math.sin(t * 0.5 + i) * 6 + t * 4 - originY * 0.08) % H + H) % H;
    g.fillRect(px, py, 1.6, 1.6);
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
