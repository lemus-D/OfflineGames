/* Simple AI stub. Spends freely within the turn like the player. */

import { hexKey, hexNeighbors } from './hex.js';
import { BUILDINGS, GATHER_FOR_RESOURCE } from '../data/content.js';

/**
 * @param {object} match
 * @param {object} civ
 * @param {{ tryBuild: Function, tryRecruit: Function, tryAttack: Function }} api
 */
export function aiTakeTurn(match, civ, api) {
  const skill = match.difficulty.aiSkill;
  const owned = () => [...match.tiles.entries()].filter(([, t]) => t.ownerId === civ.id);

  // Economy loop — keep building while affordable.
  let econTries = 2 + Math.floor(skill * 3);
  while (econTries-- > 0) {
    const list = owned();
    const candidates = list.filter(([, t]) => {
      const need = GATHER_FOR_RESOURCE[t.resourceId];
      return need && !t.buildingId && !t.isCapital;
    });
    if (!candidates.length) break;
    const [key, tile] = candidates[(match.rng() * candidates.length) | 0];
    const bid = GATHER_FOR_RESOURCE[tile.resourceId];
    const res = api.tryBuild(match, civ.id, key, bid);
    if (!res.ok) break;
  }

  // Recruit a few times at capital / strong tiles.
  let recruitTries = 1 + Math.floor(skill * 2);
  while (recruitTries-- > 0) {
    const capKey = hexKey(civ.capital.q, civ.capital.r);
    const res = api.tryRecruit(match, civ.id, capKey);
    if (!res.ok) break;
  }

  // Attacks until odds look poor.
  let attacks = 1 + Math.floor(skill * 3);
  while (attacks-- > 0) {
    const list = owned();
    let best = null;
    let bestScore = -1;
    for (const [key, tile] of list) {
      if (tile.troops < 3) continue;
      for (const n of hexNeighbors(tile.q, tile.r)) {
        const nk = hexKey(n.q, n.r);
        const nt = match.tiles.get(nk);
        if (!nt || nt.ownerId === civ.id) continue;
        const ratio = tile.troops / Math.max(1, nt.troops);
        const score = ratio + (nt.ownerId ? 0.4 : 0.15) + match.rng() * 0.05;
        if (score > bestScore) {
          bestScore = score;
          best = { from: key, to: nk };
        }
      }
    }
    if (!best || bestScore < 0.85) break;
    api.tryAttack(match, civ.id, best.from, best.to);
    if (match.phase !== 'play') return;
  }

  if (match.turn > match.maxTurns * 0.5) {
    const capKey = hexKey(civ.capital.q, civ.capital.r);
    api.tryBuild(match, civ.id, capKey, BUILDINGS.wonder.id);
  }
}
