/* Simple AI stub. Respects stamina; splits stacks when useful. */

import { hexKey, hexNeighbors } from './hex.js';
import { BUILDINGS, GATHER_FOR_RESOURCE } from '../data/content.js';

/**
 * @param {object} match
 * @param {object} civ
 * @param {{ tryBuild: Function, tryRecruit: Function, tryAttack: Function, tryMove: Function }} api
 */
export function aiTakeTurn(match, civ, api) {
  const skill = match.difficulty.aiSkill;
  const owned = () => [...match.tiles.entries()].filter(([, t]) => t.ownerId === civ.id);

  let econTries = 2 + Math.floor(skill * 3);
  while (econTries-- > 0) {
    const list = owned();
    const gather = list.filter(([, t]) => {
      const need = GATHER_FOR_RESOURCE[t.resourceId];
      return need && !t.buildingId && !t.isCapital;
    });
    if (gather.length && match.rng() < 0.7) {
      const [key, tile] = gather[(match.rng() * gather.length) | 0];
      const bid = GATHER_FOR_RESOURCE[tile.resourceId];
      if (!api.tryBuild(match, civ.id, key, bid).ok) break;
      continue;
    }
    const wallNeed = list.filter(([, t]) => !t.hasWalls && t.troops > 0);
    if (wallNeed.length && match.rng() < skill * 0.5) {
      const [key] = wallNeed[(match.rng() * wallNeed.length) | 0];
      api.tryBuild(match, civ.id, key, 'walls');
    }
    break;
  }

  let recruitTries = 1 + Math.floor(skill * 2);
  while (recruitTries-- > 0) {
    const capKey = hexKey(civ.capital.q, civ.capital.r);
    if (!api.tryRecruit(match, civ.id, capKey).ok) break;
  }

  let actions = 2 + Math.floor(skill * 4);
  while (actions-- > 0) {
    const list = owned();
    let best = null;
    let bestScore = -1;
    for (const [key, tile] of list) {
      if (tile.troops < 2 || tile.stamina <= 0) continue;
      for (const n of hexNeighbors(tile.q, tile.r)) {
        const nk = hexKey(n.q, n.r);
        const nt = match.tiles.get(nk);
        if (!nt || nt.ownerId === civ.id) continue;
        const send = Math.max(1, Math.floor(tile.troops * (0.5 + skill * 0.4)));
        const ratio = send / Math.max(1, nt.troops * (nt.hasWalls ? 1.5 : 1));
        const score = ratio + (nt.ownerId ? 0.4 : 0.15) + match.rng() * 0.05;
        if (score > bestScore) {
          bestScore = score;
          best = { from: key, to: nk, send };
        }
      }
    }
    if (!best || bestScore < 0.85) break;
    api.tryAttack(match, civ.id, best.from, best.to, best.send);
    if (match.phase !== 'play') return;
  }

  if (match.turn > match.maxTurns * 0.5) {
    const capKey = hexKey(civ.capital.q, civ.capital.r);
    api.tryBuild(match, civ.id, capKey, BUILDINGS.wonder.id);
  }
}
