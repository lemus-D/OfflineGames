/* Canvas 2D hex map renderer. */

import { hexToPixel, hexKey } from './hex.js';
import { RESOURCES } from '../data/content.js';

const HEX_SIZE = 34;

function hexCorner(cx, cy, size, i) {
  const angle = ((Math.PI / 180) * 60 * i);
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

/**
 * @param {CanvasRenderingContext2D} g
 * @param {number} W
 * @param {number} H
 * @param {object} match
 * @param {{x:number,y:number}} cam
 */
export function drawMatch(g, W, H, match, cam) {
  g.clearRect(0, 0, W, H);

  // Warm bronze-age ground.
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

    if (tile.ownerId) {
      g.fillStyle = civColor(tile.ownerId) + '99';
      drawHexPath(g, sx, sy, HEX_SIZE - 1);
      g.fill();
    }

    const selected = match.selectedKey === hexKey(tile.q, tile.r);
    g.strokeStyle = selected ? '#f5e6c8' : 'rgba(20,14,10,0.55)';
    g.lineWidth = selected ? 2.5 : 1;
    drawHexPath(g, sx, sy, HEX_SIZE - 1);
    g.stroke();

    // Road mark.
    if (tile.hasRoad || tile.isCapital) {
      g.strokeStyle = 'rgba(245, 220, 160, 0.75)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(sx - 8, sy);
      g.lineTo(sx + 8, sy);
      g.moveTo(sx, sy - 8);
      g.lineTo(sx, sy + 8);
      g.stroke();
    }

    // Building dot.
    if (tile.buildingId) {
      g.fillStyle = '#f0e0c0';
      g.beginPath();
      g.arc(sx, sy - 6, 3.5, 0, Math.PI * 2);
      g.fill();
    }

    // Capital ring.
    if (tile.isCapital) {
      g.strokeStyle = '#fff3c4';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(sx, sy, 10, 0, Math.PI * 2);
      g.stroke();
    }

    // Troops.
    if (tile.troops > 0) {
      g.fillStyle = 'rgba(15,10,6,0.75)';
      g.fillRect(sx - 10, sy + 6, 20, 11);
      g.fillStyle = '#f2e8d5';
      g.font = 'bold 9px Georgia, serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(tile.troops), sx, sy + 11.5);
    }
  }
}

export function screenToHex(mx, my, W, H, cam) {
  const x = mx - W / 2 + cam.x;
  const y = my - H / 2 + cam.y;
  const q = ((2 / 3) * x) / HEX_SIZE;
  const r = ((-1 / 3) * x + (Math.sqrt(3) / 3) * y) / HEX_SIZE;
  // round
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
