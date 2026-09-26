/* Simple AI stub. Full search + weighted eval comes later.
   Skill (0..1) biases toward attack vs economy. */

import { hexKey, hexNeighbors } from './hex.js';
import { BUILDINGS, GATHER_FOR_RESOURCE } from '../data/content.js';

/**
 * @param {object} match
 * @param {object} civ
 * @param {{ tryBuild: Function, tryRecruit: Function, tryAttack: Function }} api
 */
export function aiTakeTurn(match, civ, api) {
  const skill = match.difficulty.aiSkill;
  const owned = [...match.tiles.entries()].filter(([, t]) => t.ownerId === civ.id);
  if (!owned.length) return;

  // Economy: build gather / roads on a few tiles.
  const econActions = 1 + (match.rng() < skill ? 1 : 0);
  for (let i = 0; i < econActions; i++) {
    const candidates = owned.filter(([, t]) => {
      const need = GATHER_FOR_RESOURCE[t.resourceId];
      return need && !t.buildingId && !t.isCapital;
    });
    if (candidates.length && match.rng() < 0.55 + skill * 0.3) {
      const [key, tile] = candidates[(match.rng() * candidates.length) | 0];
      const bid = GATHER_FOR_RESOURCE[tile.resourceId];
      api.tryBuild(match, civ.id, key, bid);
      continue;
    }
    const roadNeed = owned.filter(([, t]) => !t.hasRoad && !t.isCapital);
    if (roadNeed.length) {
      const [key] = roadNeed[(match.rng() * roadNeed.length) | 0];
      api.tryBuild(match, civ.id, key, 'road');
    }
  }

  // Recruit at capital sometimes.
  if (match.rng() < 0.4 + skill * 0.3) {
    const capKey = hexKey(civ.capital.q, civ.capital.r);
    api.tryRecruit(match, civ.id, capKey);
  }

  // Attack: pick strongest border stack into weakest adjacent target.
  const attacks = 1 + (match.rng() < skill ? 1 : 0);
  for (let a = 0; a < attacks; a++) {
    let best = null;
    let bestScore = -1;
    for (const [key, tile] of owned) {
      if (tile.troops < 3) continue;
      for (const n of hexNeighbors(tile.q, tile.r)) {
        const nk = hexKey(n.q, n.r);
        const nt = match.tiles.get(nk);
        if (!nt || nt.ownerId === civ.id) continue;
        const ratio = tile.troops / Math.max(1, nt.troops);
        const score = ratio + (nt.ownerId ? 0.5 : 0.2) + match.rng() * 0.1;
        if (score > bestScore) {
          bestScore = score;
          best = { from: key, to: nk };
        }
      }
    }
    if (best && (bestScore > 0.9 || match.rng() < skill)) {
      api.tryAttack(match, civ.id, best.from, best.to);
      if (match.phase !== 'play') return;
    }
  }

  // Wonder rush if rich enough late game.
  if (match.turn > match.maxTurns * 0.55 && match.rng() < skill * 0.4) {
    const capKey = hexKey(civ.capital.q, civ.capital.r);
    api.tryBuild(match, civ.id, capKey, BUILDINGS.wonder.id);
  }
}
