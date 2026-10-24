/* Canvas 2D render from session state. Dusk woodland, ink outlines. */

import { hash2i } from '../core/rng.js';
import { PALETTE, LANE_WIDTH, OBSTACLES, FOX, BUNNY } from './content.js';

/** Perspective helper: z along path → screen. */
function project(lanePos, z, height, W, H) {
  const near = 28;
  const far = 320;
  const t = 1 - (z - near) / (far - near);
  const scale = 0.35 + Math.max(0, Math.min(1, t)) * 0.9;
  const pathY = H * 0.72;
  const horizon = H * 0.28;
  const depth = Math.max(0, Math.min(1, 1 - z / far));
  const y = horizon + (pathY - horizon) * (0.15 + depth * 0.85) - height * scale;
  const pathHalf = W * (0.12 + depth * 0.28);
  const x = W * 0.5 + lanePos * (pathHalf * 0.55) * (LANE_WIDTH / 56);
  return { x, y, scale, depth };
}

export function drawBackground(g, W, H, distance, threat) {
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#2a1f3a');
  grd.addColorStop(0.35, PALETTE.dusk);
  grd.addColorStop(0.7, '#243044');
  grd.addColorStop(1, PALETTE.duskDeep);
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);

  // Distant tree silhouettes — deterministic from distance.
  const scroll = distance * 0.15;
  g.fillStyle = '#121820';
  for (let i = 0; i < 14; i++) {
    const h = hash2i(i, 3, 9);
    const x = ((i * 97 - scroll) % (W + 80)) - 40;
    const treeH = 60 + h * 100;
    const base = H * 0.34;
    g.beginPath();
    g.moveTo(x, base);
    g.lineTo(x + 18 + h * 20, base - treeH);
    g.lineTo(x + 40 + h * 16, base);
    g.closePath();
    g.fill();
  }

  // Warm dusk glow near horizon.
  const glow = g.createRadialGradient(W * 0.5, H * 0.3, 10, W * 0.5, H * 0.32, W * 0.45);
  glow.addColorStop(0, 'rgba(224, 112, 64, 0.22)');
  glow.addColorStop(1, 'rgba(224, 112, 64, 0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H * 0.55);

  if (threat > 0.35) {
    const v = g.createRadialGradient(W * 0.5, H * 0.5, W * 0.2, W * 0.5, H * 0.5, W * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, `rgba(80, 10, 10, ${0.15 + threat * 0.35})`);
    g.fillStyle = v;
    g.fillRect(0, 0, W, H);
  }
}

export function drawPath(g, W, H, distance) {
  const horizon = H * 0.28;
  const bottom = H * 0.95;
  g.beginPath();
  g.moveTo(W * 0.5 - 20, horizon);
  g.lineTo(W * 0.5 + 20, horizon);
  g.lineTo(W * 0.92, bottom);
  g.lineTo(W * 0.08, bottom);
  g.closePath();
  g.fillStyle = PALETTE.path;
  g.fill();
  g.strokeStyle = PALETTE.ink;
  g.lineWidth = 2.5;
  g.stroke();

  // Lane guides + winding dash.
  g.strokeStyle = 'rgba(240, 230, 208, 0.25)';
  g.lineWidth = 1.5;
  for (const lane of [-0.5, 0.5]) {
    g.beginPath();
    g.moveTo(W * 0.5 + lane * 12, horizon + 8);
    g.lineTo(W * 0.5 + lane * W * 0.28, bottom);
    g.stroke();
  }

  const dashScroll = (distance * 2) % 40;
  g.strokeStyle = PALETTE.pathLight;
  g.setLineDash([16, 24]);
  g.lineDashOffset = -dashScroll;
  g.beginPath();
  g.moveTo(W * 0.5, horizon + 6);
  g.lineTo(W * 0.5, bottom);
  g.stroke();
  g.setLineDash([]);
}

function inkShape(g, fill, strokeFn) {
  g.fillStyle = fill;
  strokeFn(true);
  g.fill();
  g.strokeStyle = PALETTE.ink;
  g.lineWidth = 2.2;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  strokeFn(false);
  g.stroke();
}

export function drawBunny(g, W, H, player, animT) {
  const { x, y, scale } = project(player.lanePos, 12, player.height, W, H);
  const s = 18 * scale;
  const bob = Math.sin(animT * 10) * (player.jumping ? 0 : 1.2);

  g.save();
  g.translate(x, y + bob);

  // Shadow
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath();
  g.ellipse(0, 10 * scale + player.height * 0.05, 12 * scale, 4 * scale, 0, 0, Math.PI * 2);
  g.fill();

  inkShape(g, PALETTE.cream, (fillPass) => {
    g.beginPath();
    // Body
    g.ellipse(0, 0, s * 0.7, s * 0.55, 0, 0, Math.PI * 2);
  });
  // Head
  inkShape(g, PALETTE.cream, () => {
    g.beginPath();
    g.ellipse(0, -s * 0.75, s * 0.48, s * 0.42, 0, 0, Math.PI * 2);
  });
  // Ears
  for (const side of [-1, 1]) {
    inkShape(g, PALETTE.cream, () => {
      g.beginPath();
      g.ellipse(side * s * 0.28, -s * 1.35, s * 0.14, s * 0.42, side * 0.2, 0, Math.PI * 2);
    });
    g.fillStyle = '#e8a090';
    g.beginPath();
    g.ellipse(side * s * 0.28, -s * 1.3, s * 0.06, s * 0.28, side * 0.2, 0, Math.PI * 2);
    g.fill();
  }
  // Eye
  g.fillStyle = PALETTE.ink;
  g.beginPath();
  g.arc(s * 0.16, -s * 0.78, Math.max(1.2, s * 0.08), 0, Math.PI * 2);
  g.fill();
  // Tail fluff
  inkShape(g, '#fff8ee', () => {
    g.beginPath();
    g.arc(-s * 0.65, s * 0.1, s * 0.22, 0, Math.PI * 2);
  });

  g.restore();
}

export function drawFox(g, W, H, foxGap, threat, animT) {
  // Fox sits behind the bunny along the path; closer gap → larger / lower on path.
  const z = 12 + foxGap * 0.85;
  const { x, y, scale } = project(0, Math.min(280, z), 0, W, H);
  const s = (16 + threat * 10) * scale;
  const lunge = threat > 0.7 ? Math.sin(animT * 14) * 3 : 0;

  g.save();
  g.translate(x, y + 8 * scale + lunge);
  g.globalAlpha = 0.55 + threat * 0.45;

  inkShape(g, PALETTE.fox, () => {
    g.beginPath();
    g.ellipse(0, 0, s * 0.95, s * 0.45, 0, 0, Math.PI * 2);
  });
  // Head / snout — predatory
  inkShape(g, PALETTE.fox, () => {
    g.beginPath();
    g.moveTo(s * 0.4, -s * 0.35);
    g.lineTo(s * 1.25, -s * 0.05);
    g.lineTo(s * 0.45, s * 0.25);
    g.closePath();
  });
  inkShape(g, PALETTE.foxDark, () => {
    g.beginPath();
    g.ellipse(s * 0.15, -s * 0.45, s * 0.4, s * 0.35, 0, 0, Math.PI * 2);
  });
  // Ears pointed
  for (const side of [-1, 1]) {
    g.fillStyle = PALETTE.foxDark;
    g.strokeStyle = PALETTE.ink;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(side * s * 0.15, -s * 0.7);
    g.lineTo(side * s * 0.35, -s * 1.25);
    g.lineTo(side * s * 0.5, -s * 0.65);
    g.closePath();
    g.fill();
    g.stroke();
  }
  // Eye gleam
  g.fillStyle = '#f0e6d0';
  g.beginPath();
  g.arc(s * 0.35, -s * 0.5, Math.max(1, s * 0.07), 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#e03020';
  g.beginPath();
  g.arc(s * 0.37, -s * 0.5, Math.max(0.8, s * 0.035), 0, Math.PI * 2);
  g.fill();
  // Tail
  inkShape(g, PALETTE.fox, () => {
    g.beginPath();
    g.moveTo(-s * 0.8, 0);
    g.quadraticCurveTo(-s * 1.6, -s * 0.8, -s * 1.9, s * 0.1);
    g.quadraticCurveTo(-s * 1.3, s * 0.35, -s * 0.7, s * 0.15);
    g.closePath();
  });

  g.restore();
  g.globalAlpha = 1;

  // Teeth flash when very close
  if (threat > 0.75) {
    g.fillStyle = `rgba(240, 230, 208, ${0.3 + Math.sin(animT * 20) * 0.2})`;
    g.font = `bold ${Math.floor(14 + threat * 8)}px Trebuchet MS, Verdana, sans-serif`;
    g.textAlign = 'center';
    g.fillText('CLOSE', W * 0.5, H * 0.18);
  }
}

export function drawEntity(g, W, H, e) {
  const { x, y, scale, depth } = project(e.lane, e.z, 0, W, H);
  if (depth <= 0.02) return;
  g.save();
  g.translate(x, y);
  g.globalAlpha = 0.4 + depth * 0.6;

  if (e.kind === 'carrot') {
    const s = 10 * scale;
    inkShape(g, PALETTE.carrot, () => {
      g.beginPath();
      g.moveTo(0, s * 0.9);
      g.quadraticCurveTo(s * 0.55, 0, 0, -s * 0.7);
      g.quadraticCurveTo(-s * 0.55, 0, 0, s * 0.9);
    });
    g.strokeStyle = PALETTE.ink;
    g.fillStyle = PALETTE.green;
    g.beginPath();
    g.moveTo(0, -s * 0.55);
    g.lineTo(-s * 0.25, -s * 1.1);
    g.lineTo(0, -s * 0.75);
    g.lineTo(s * 0.25, -s * 1.15);
    g.closePath();
    g.fill();
    g.stroke();
  } else {
    const def = OBSTACLES[e.kind] || OBSTACLES.log;
    const w = def.width * 0.5 * scale;
    const h = def.height * scale;
    if (e.kind === 'rock') {
      inkShape(g, '#5a6678', () => {
        g.beginPath();
        g.moveTo(-w, 0);
        g.lineTo(-w * 0.7, -h);
        g.lineTo(w * 0.2, -h * 1.05);
        g.lineTo(w, -h * 0.4);
        g.lineTo(w * 0.8, 0);
        g.closePath();
      });
    } else if (e.kind === 'root') {
      inkShape(g, '#4a3828', () => {
        g.beginPath();
        g.moveTo(-w, 0);
        g.quadraticCurveTo(-w * 0.2, -h * 0.6, w * 0.3, -h);
        g.quadraticCurveTo(w, -h * 0.3, w * 0.9, 0);
        g.closePath();
      });
    } else {
      // log
      inkShape(g, '#6b4428', () => {
        g.beginPath();
        g.ellipse(0, -h * 0.35, w, h * 0.45, 0, 0, Math.PI * 2);
      });
      g.strokeStyle = PALETTE.ink;
      g.beginPath();
      g.ellipse(-w * 0.85, -h * 0.35, w * 0.18, h * 0.4, 0, 0, Math.PI * 2);
      g.stroke();
    }
  }
  g.restore();
  g.globalAlpha = 1;
}

export function drawParticles(g, W, H, particles) {
  for (const p of particles) {
    const { x, y, scale } = project(p.lane, 14, p.y, W, H);
    const a = 1 - p.age / p.life;
    g.globalAlpha = a;
    g.fillStyle = p.color;
    g.beginPath();
    g.arc(x + p.x * scale, y, Math.max(1.5, 3 * scale * a), 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

export function drawHitFlash(g, W, H, flash) {
  if (flash <= 0) return;
  g.fillStyle = `rgba(200, 40, 30, ${flash * 0.35})`;
  g.fillRect(0, 0, W, H);
}

export function drawFrame(g, W, H, session, animT) {
  if (!session) return;
  drawBackground(g, W, H, session.distance, session.foxThreat);
  drawPath(g, W, H, session.distance);

  const sorted = session.entities.slice().sort((a, b) => b.z - a.z);
  for (const e of sorted) {
    if (e.z > 12) drawEntity(g, W, H, e);
  }

  drawFox(g, W, H, session.foxGap, session.foxThreat, animT);
  drawBunny(g, W, H, session.player, animT);

  for (const e of sorted) {
    if (e.z <= 12) drawEntity(g, W, H, e);
  }

  drawParticles(g, W, H, session.particles);
  drawHitFlash(g, W, H, session.flash);

  // Unused import guard for FOX/BUNNY constants used conceptually
  void FOX.startGap;
  void BUNNY.radius;
}
