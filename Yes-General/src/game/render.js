/* Canvas 2D hex map: ownership, resource/building icons, troops + stamina. */

import { hexToPixel, hexKey } from './hex.js';
import { RESOURCES, PLAYER_COLORS, TROOP_STAMINA_MAX } from '../data/content.js';

const HEX_SIZE = 34;
const ICON_SCALE = 1.85;
const TROOP_SCALE = 1.35;

function hexCorner(cx, cy, size, i) {
  const angle = (Math.PI / 180) * 60 * i;
  return { x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle) };
}

function drawHexPath(g, cx, cy, size) {
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const p = hexCorner(cx, cy, size, i);
    if (i === 0) g.moveTo(p.x, p.y);
    else g.lineTo(p.x, p.y);
  }
  g.closePath();
}

function drawResourceIcon(g, x, y, resourceId) {
  g.save();
  g.translate(x, y);
  g.scale(ICON_SCALE, ICON_SCALE);
  if (resourceId === 'food') {
    g.fillStyle = '#e8d070';
    g.beginPath();
    g.moveTo(0, -5);
    g.quadraticCurveTo(4, -1, 0, 5);
    g.quadraticCurveTo(-4, -1, 0, -5);
    g.fill();
    g.strokeStyle = '#6a5020';
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(0, -5);
    g.lineTo(0, 5);
    g.stroke();
  } else if (resourceId === 'wood') {
    g.fillStyle = '#3d6b2e';
    g.beginPath();
    g.moveTo(0, -6);
    g.lineTo(5, 2);
    g.lineTo(-5, 2);
    g.closePath();
    g.fill();
    g.fillStyle = '#6b4423';
    g.fillRect(-1.2, 2, 2.4, 4);
  } else if (resourceId === 'stone') {
    g.fillStyle = '#b0aaa4';
    g.beginPath();
    g.moveTo(-5, 2);
    g.lineTo(-2, -4);
    g.lineTo(3, -5);
    g.lineTo(5, 1);
    g.lineTo(1, 5);
    g.closePath();
    g.fill();
    g.strokeStyle = '#5a5550';
    g.lineWidth = 0.7;
    g.stroke();
  } else if (resourceId === 'ore') {
    g.fillStyle = '#8a6230';
    g.beginPath();
    g.moveTo(0, -5);
    g.lineTo(5, 0);
    g.lineTo(0, 5);
    g.lineTo(-5, 0);
    g.closePath();
    g.fill();
    g.fillStyle = '#d4a04a';
    g.beginPath();
    g.arc(0, 0, 1.8, 0, Math.PI * 2);
    g.fill();
  } else {
    g.strokeStyle = '#8a7a6a';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(-4, -4);
    g.lineTo(4, 4);
    g.moveTo(4, -4);
    g.lineTo(-4, 4);
    g.stroke();
  }
  g.restore();
}

function drawBuildingIcon(g, x, y, buildingId) {
  g.save();
  g.translate(x, y);
  g.scale(ICON_SCALE, ICON_SCALE);
  if (buildingId === 'farm') {
    g.fillStyle = '#c4a060';
    g.fillRect(-5, -1, 10, 6);
    g.fillStyle = '#a04030';
    g.beginPath();
    g.moveTo(-6, -1);
    g.lineTo(0, -6);
    g.lineTo(6, -1);
    g.closePath();
    g.fill();
  } else if (buildingId === 'camp') {
    g.fillStyle = '#6b4423';
    g.fillRect(-1, -2, 2, 7);
    g.strokeStyle = '#8a6230';
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(-5, 2);
    g.lineTo(0, -5);
    g.lineTo(5, 2);
    g.stroke();
  } else if (buildingId === 'quarry') {
    g.fillStyle = '#9a9590';
    g.fillRect(-5, 0, 10, 5);
    g.fillStyle = '#6a6560';
    g.fillRect(-3, -4, 3, 4);
    g.fillRect(1, -6, 3, 6);
  } else if (buildingId === 'mine') {
    g.fillStyle = '#3a3028';
    g.beginPath();
    g.moveTo(-6, 4);
    g.lineTo(-3, -4);
    g.lineTo(3, -4);
    g.lineTo(6, 4);
    g.closePath();
    g.fill();
    g.fillStyle = '#1a1410';
    g.beginPath();
    g.arc(0, 1, 2.5, Math.PI, 0);
    g.fill();
  } else if (buildingId === 'wonder') {
    g.fillStyle = '#e8d4a8';
    g.fillRect(-2, -2, 4, 8);
    g.beginPath();
    g.moveTo(-5, -2);
    g.lineTo(0, -8);
    g.lineTo(5, -2);
    g.closePath();
    g.fill();
  } else {
    g.fillStyle = '#f0e0c0';
    g.beginPath();
    g.arc(0, 0, 3, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

function drawWallsIcon(g, x, y) {
  g.save();
  g.translate(x, y);
  g.scale(ICON_SCALE, ICON_SCALE);
  g.fillStyle = '#9a9590';
  g.fillRect(-6, -1, 3.5, 6);
  g.fillRect(-1.5, -3, 3.5, 8);
  g.fillRect(3, -1, 3.5, 6);
  g.strokeStyle = '#5a5550';
  g.lineWidth = 0.6;
  g.strokeRect(-6, -1, 3.5, 6);
  g.strokeRect(-1.5, -3, 3.5, 8);
  g.strokeRect(3, -1, 3.5, 6);
  g.restore();
}

function drawTroopSprite(g, x, y, color, scale = 1) {
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath();
  g.ellipse(0, 7, 5, 2, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = color;
  g.lineWidth = 1.4;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-2, 6);
  g.lineTo(0, 1);
  g.lineTo(2.5, 6);
  g.stroke();
  g.beginPath();
  g.moveTo(0, 1);
  g.lineTo(0, -4);
  g.stroke();
  g.fillStyle = '#c4a574';
  g.beginPath();
  g.ellipse(-3.2, -1, 2.2, 2.8, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#d8c8a0';
  g.lineWidth = 1.1;
  g.beginPath();
  g.moveTo(2, 5);
  g.lineTo(3.5, -8);
  g.stroke();
  g.fillStyle = '#b8b0a0';
  g.beginPath();
  g.moveTo(3.5, -8);
  g.lineTo(2.2, -6.2);
  g.lineTo(4.8, -6.2);
  g.closePath();
  g.fill();
  g.fillStyle = '#e8c49a';
  g.beginPath();
  g.arc(0, -6.2, 2.1, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(-1.5, -7.2);
  g.quadraticCurveTo(0, -10, 1.5, -7.2);
  g.fill();
  g.restore();
}

function drawStaminaBar(g, x, y, stamina, max) {
  const w = 16;
  const h = 3;
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.fillRect(x - w / 2, y, w, h);
  const fill = Math.max(0, Math.min(1, stamina / max));
  g.fillStyle = fill > 0.34 ? '#6ecf7a' : fill > 0 ? '#e0b050' : '#a04030';
  g.fillRect(x - w / 2, y, w * fill, h);
  // pip marks
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 0.6;
  for (let i = 1; i < max; i++) {
    const px = x - w / 2 + (w * i) / max;
    g.beginPath();
    g.moveTo(px, y);
    g.lineTo(px, y + h);
    g.stroke();
  }
}

/**
 * @param {CanvasRenderingContext2D} g
 * @param {number} W
 * @param {number} H
 * @param {object} match
 * @param {{x:number,y:number}} cam
 * @param {{ move?: Set<string>, attack?: Set<string> }} [highlights]
 */
export function drawMatch(g, W, H, match, cam, highlights = {}) {
  g.clearRect(0, 0, W, H);

  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#2a2118');
  bg.addColorStop(0.5, '#1a1410');
  bg.addColorStop(1, '#241c14');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  const civColor = (id) => match.civs.find((c) => c.id === id)?.color || '#888';
  const playerId = 'player';

  for (const tile of match.tiles.values()) {
    const { x, y } = hexToPixel(tile.q, tile.r, HEX_SIZE);
    const sx = x - cam.x + W / 2;
    const sy = y - cam.y + H / 2;
    if (sx < -60 || sy < -60 || sx > W + 60 || sy > H + 60) continue;

    const res = RESOURCES[tile.resourceId];
    drawHexPath(g, sx, sy, HEX_SIZE - 1);
    g.fillStyle = res?.color || '#555';
    g.fill();

    if (tile.regionId >= 0 && !tile.ownerId) {
      const rc = PLAYER_COLORS[tile.regionId % PLAYER_COLORS.length];
      g.fillStyle = rc + '18';
      drawHexPath(g, sx, sy, HEX_SIZE - 1);
      g.fill();
    }

    if (tile.ownerId) {
      const col = civColor(tile.ownerId);
      const strong = tile.ownerId === playerId;
      g.fillStyle = col + (strong ? 'aa' : '77');
      drawHexPath(g, sx, sy, HEX_SIZE - 1);
      g.fill();
      // Ownership ring — thicker for you.
      g.strokeStyle = col;
      g.lineWidth = strong ? 3.2 : 2.2;
      drawHexPath(g, sx, sy, HEX_SIZE - 3);
      g.stroke();
    }

    const key = hexKey(tile.q, tile.r);
    const selected = match.selectedKey === key;
    const moveHl = highlights.move?.has(key);
    const atkHl = highlights.attack?.has(key);
    if (moveHl) {
      g.fillStyle = 'rgba(120, 200, 120, 0.38)';
      drawHexPath(g, sx, sy, HEX_SIZE - 1);
      g.fill();
    }
    if (atkHl) {
      g.fillStyle = 'rgba(220, 90, 60, 0.4)';
      drawHexPath(g, sx, sy, HEX_SIZE - 1);
      g.fill();
    }
    g.strokeStyle = selected
      ? '#fff3c4'
      : moveHl
        ? '#8fd98f'
        : atkHl
          ? '#e07a5f'
          : 'rgba(20,14,10,0.5)';
    g.lineWidth = selected || moveHl || atkHl ? 2.6 : 1;
    drawHexPath(g, sx, sy, HEX_SIZE - 1);
    g.stroke();

    // Resource icon (top-left).
    drawResourceIcon(g, sx - 11, sy - 9, tile.resourceId);

    // Structure icons (top-right / below if both).
    if (tile.buildingId) drawBuildingIcon(g, sx + 11, sy - 9, tile.buildingId);
    if (tile.hasWalls) {
      drawWallsIcon(g, sx + 11, sy + (tile.buildingId ? 8 : -9));
    }

    if (tile.isCapital) {
      g.strokeStyle = '#fff3c4';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(sx, sy - 1, 12, 0, Math.PI * 2);
      g.stroke();
    }

    if (tile.troops > 0) {
      const color = tile.ownerId ? civColor(tile.ownerId) : '#aaa';
      drawTroopSprite(g, sx + 8, sy + 4, color, TROOP_SCALE);
      g.fillStyle = 'rgba(15,10,6,0.8)';
      g.fillRect(sx - 15, sy + 11, 18, 10);
      g.fillStyle = '#f2e8d5';
      g.font = 'bold 9px Georgia, serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(tile.troops), sx - 6, sy + 16);
      drawStaminaBar(g, sx - 6, sy + 22, tile.stamina || 0, TROOP_STAMINA_MAX);
    }
  }
}

export function screenToHex(mx, my, W, H, cam) {
  const x = mx - W / 2 + cam.x;
  const y = my - H / 2 + cam.y;
  const q = ((2 / 3) * x) / HEX_SIZE;
  const r = ((-1 / 3) * x + (Math.sqrt(3) / 3) * y) / HEX_SIZE;
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  let rs = Math.round(s);
  const qDiff = Math.abs(rq - q);
  const rDiff = Math.abs(rr - r);
  const sDiff = Math.abs(rs - s);
  if (qDiff > rDiff && qDiff > sDiff) rq = -rr - rs;
  else if (rDiff > sDiff) rr = -rq - rs;
  return hexKey(rq, rr);
}

export function cameraForMap(match) {
  let sx = 0,
    sy = 0,
    n = 0;
  for (const t of match.tiles.values()) {
    const p = hexToPixel(t.q, t.r, HEX_SIZE);
    sx += p.x;
    sy += p.y;
    n += 1;
  }
  return { x: sx / n, y: sy / n };
}
