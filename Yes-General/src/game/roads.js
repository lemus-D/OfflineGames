/* Road connectivity: yield reaches stockpile only if path to capital. */

import { hexKey, hexNeighbors } from './hex.js';

/**
 * BFS from capital through owner hexes that have roads (capital counts as hub).
 * @param {Map<string, object>} tiles
 * @param {string} ownerId
 * @param {{q:number,r:number}} capital
 * @returns {Set<string>} keys connected to capital
 */
export function connectedToCapital(tiles, ownerId, capital) {
  const start = hexKey(capital.q, capital.r);
  const seen = new Set();
  const queue = [start];
  seen.add(start);

  while (queue.length) {
    const key = queue.shift();
    const tile = tiles.get(key);
    if (!tile || tile.ownerId !== ownerId) continue;
    const { q, r } = tile;
    for (const n of hexNeighbors(q, r)) {
      const nk = hexKey(n.q, n.r);
      if (seen.has(nk)) continue;
      const nt = tiles.get(nk);
      if (!nt || nt.ownerId !== ownerId) continue;
      if (!nt.hasRoad && !nt.isCapital) continue;
      seen.add(nk);
      queue.push(nk);
    }
  }
  return seen;
}

/** Whether a specific owned tile can deliver yield. */
export function canDeliver(tiles, ownerId, capital, tileKey) {
  const tile = tiles.get(tileKey);
  if (!tile || tile.ownerId !== ownerId) return false;
  if (tile.isCapital) return true;
  if (!tile.hasRoad) return false;
  return connectedToCapital(tiles, ownerId, capital).has(tileKey);
}
