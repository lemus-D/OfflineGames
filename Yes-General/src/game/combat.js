/* Auto-resolve tile conflict from troop counts + seeded roll. */

import { clamp } from '../core/rng.js';
import { COMBAT } from '../data/content.js';

/**
 * @param {number} atkTroops
 * @param {number} defTroops
 * @param {() => number} rng
 * @param {number} [defMul=1] effective defender multiplier (e.g. stone walls)
 */
export function resolveCombat(atkTroops, defTroops, rng, defMul = 1) {
  const a = Math.max(0, atkTroops);
  const rawDef = Math.max(0, defTroops);
  const dEff = rawDef * Math.max(0.1, defMul);
  let winChance;
  if (a + dEff <= 0) winChance = 0.5;
  else winChance = a / (a + dEff);
  winChance = clamp(winChance, COMBAT.minWinChance, COMBAT.maxWinChance);

  const roll = rng();
  const attackerWins = roll < winChance;

  let atkLeft;
  let defLeft;
  if (attackerWins) {
    atkLeft = Math.max(0, Math.floor(a * (1 - COMBAT.winLossFrac)));
    defLeft = Math.max(0, Math.floor(rawDef * (1 - COMBAT.defWinLossFrac)));
    if (defLeft > 0 && atkLeft > 0) defLeft = 0;
  } else {
    atkLeft = Math.max(0, Math.floor(a * (1 - COMBAT.loseLossFrac)));
    defLeft = Math.max(0, Math.floor(rawDef * (1 - COMBAT.defLoseLossFrac)));
  }

  return { attackerWins, winChance, atkLeft, defLeft, roll };
}
