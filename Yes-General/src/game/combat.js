/* Auto-resolve tile conflict from troop counts + seeded roll. */

import { clamp } from '../core/rng.js';
import { COMBAT } from '../data/content.js';

/**
 * @param {number} atkTroops
 * @param {number} defTroops
 * @param {() => number} rng
 * @returns {{ attackerWins: boolean, winChance: number, atkLeft: number, defLeft: number }}
 */
export function resolveCombat(atkTroops, defTroops, rng) {
  const a = Math.max(0, atkTroops);
  const d = Math.max(0, defTroops);
  let winChance;
  if (a + d <= 0) winChance = 0.5;
  else winChance = a / (a + d);
  winChance = clamp(winChance, COMBAT.minWinChance, COMBAT.maxWinChance);

  const roll = rng();
  const attackerWins = roll < winChance;

  let atkLeft;
  let defLeft;
  if (attackerWins) {
    atkLeft = Math.max(0, Math.floor(a * (1 - COMBAT.winLossFrac)));
    defLeft = Math.max(0, Math.floor(d * (1 - COMBAT.defWinLossFrac)));
    if (defLeft > 0 && atkLeft > 0) defLeft = 0; // hex flips; survivors flee/die
  } else {
    atkLeft = Math.max(0, Math.floor(a * (1 - COMBAT.loseLossFrac)));
    defLeft = Math.max(0, Math.floor(d * (1 - COMBAT.defLoseLossFrac)));
  }

  return { attackerWins, winChance, atkLeft, defLeft, roll };
}
