/* Deterministic seeded PRNG + helpers.
   Copied per D7 — free to diverge. */

export function makeRNG(seed = 0x5eed) {
  let a = seed >>> 0;
  function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  // Exposed so a whole session can be copied mid-run: tools/qa search bots
  // try moves on a copy instead of rebuilding the session from its seed.
  Object.defineProperty(rng, 'state', {
    get: () => a,
    set: (v) => {
      a = v;
    },
  });
  rng.clone = () => {
    const copy = makeRNG();
    copy.state = a;
    return copy;
  };
  return rng;
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
