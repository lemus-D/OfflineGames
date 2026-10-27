/* Seeded PRNG for the harness's own choices (random bots, rollouts).
   Same mulberry32 the games use; copied, not shared (AGENTS.md rule 8). */

export function makeRNG(seed = 0x5eed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mix a few integers into one seed, so (seed, tick, rollout) gives a stable stream. */
export function mixSeed(...parts) {
  let h = 0x9e3779b9;
  for (const p of parts) {
    h = Math.imul(h ^ (p | 0), 0x85ebca6b);
    h ^= h >>> 13;
  }
  return h >>> 0;
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}
