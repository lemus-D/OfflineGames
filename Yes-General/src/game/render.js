/* Canvas 2D hex map renderer + tiny troop sprites. */

import { hexToPixel, hexKey } from './hex.js';
import { RESOURCES, PLAYER_COLORS } from '../data/content.js';

const HEX_SIZE = 34;

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

/** Little bronze-age spearman. */
function drawTroopSprite(g, x, y, color, scale = 1) {
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);

  // Shadow
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath();
  g.ellipse(0, 7, 5, 2, 0, 0, Math.PI * 2);
  g.fill();

  // Legs
  g.strokeStyle = color;
  g.lineWidth = 1.4;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-2, 6);
  g.lineTo(0, 1);
  g.lineTo(2.5, 6);
  g.stroke();

  // Body
  g.beginPath();
  g.moveTo(0, 1);
  g.lineTo(0, -4);
  g.stroke();

  // Shield
  g.fillStyle = '#c4a574';
  g.beginPath();
  g.ellipse(-3.2, -1, 2.2, 2.8, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#5a3d1e';
  g.lineWidth = 0.8;
  g.stroke();

  // Spear
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

  // Head
  g.fillStyle = '#e8c49a';
  g.beginPath();
  g.arc(0, -6.2, 2.1, 0, Math.PI * 2);
  g.fill();
  // Helm crest
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(-1.5, -7.2);
  g.quadraticCurveTo(0, -10, 1.5, -7.2);
  g.fill();

  g.restore();
}

/**
 * @param {CanvasRenderingContext2D} g
 * @param {number} W
 * @param {number} H
 * @param {object} match
 * @param {{x:number,y:number}} cam
 */
export function drawMatch(g, W, H, match, cam) {
  g.clearRect(0, 0, W, H);

  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#2a2118');
  bg.addColorStop(0.5, '#1a1410');
  bg.addColorStop(1, '#241c14');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  const civColor = (id) => match.civs.find((c) => c.id === id)?.color || '#888';

  for (const tile of match.tiles.values()) {
    const { x, y } = hexToPixel(tile.q, tile.r, HEX_SIZE);
    const sx = x - cam.x + W / 2;
    const sy = y - cam.y + H / 2;
    if (sx < -60 || sy < -60 || sx > W + 60 || sy > H + 60) continue;

    const res = RESOURCES[tile.resourceId];
    drawHexPath(g, sx, sy, HEX_SIZE - 1);
    g.fillStyle = res?.color || '#555';
    g.fill();

    // Soft region tint (home partitions).
    if (tile.regionId >= 0) {
      const rc = PLAYER_COLORS[tile.regionId % PLAYER_COLORS.length];
      g.fillStyle = rc + '22';
      drawHexPath(g, sx, sy, HEX_SIZE - 1);
      g.fill();
    }

    if (tile.ownerId) {
      g.fillStyle = civColor(tile.ownerId) + '88';
      drawHexPath(g, sx, sy, HEX_SIZE - 1);
      g.fill();
    }

    const selected = match.selectedKey === hexKey(tile.q, tile.r);
    g.strokeStyle = selected ? '#f5e6c8' : 'rgba(20,14,10,0.55)';
    g.lineWidth = selected ? 2.5 : 1;
    drawHexPath(g, sx, sy, HEX_SIZE - 1);
    g.stroke();

    if (tile.buildingId) {
      g.fillStyle = '#f0e0c0';
      g.beginPath();
      g.arc(sx - 8, sy - 8, 3.2, 0, Math.PI * 2);
      g.fill();
    }

    if (tile.isCapital) {
      g.strokeStyle = '#fff3c4';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(sx, sy - 2, 11, 0, Math.PI * 2);
      g.stroke();
    }

    if (tile.troops > 0) {
      const color = tile.ownerId ? civColor(tile.ownerId) : '#aaa';
      drawTroopSprite(g, sx + 6, sy + 2, color, 1);
      g.fillStyle = 'rgba(15,10,6,0.78)';
      g.fillRect(sx - 14, sy + 10, 18, 10);
      g.fillStyle = '#f2e8d5';
      g.font = 'bold 9px Georgia, serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(tile.troops), sx - 5, sy + 15);
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
