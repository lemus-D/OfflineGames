/* Deep copy of a live game session, keeping class prototypes.

   Functions are shared by reference (hooks, helpers) unless they carry their
   own clone(), which is how a game's seeded rng is copied with its state.
   A function that closes over state but has no clone() would be shared
   between copies; the self-check catches that, because the copy and the
   original then drift apart. */

export function cloneState(value, seen = new Map()) {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return value;
  if (seen.has(value)) return seen.get(value);

  if (typeof value === 'function') {
    const copy = typeof value.clone === 'function' ? value.clone() : value;
    seen.set(value, copy);
    return copy;
  }
  if (ArrayBuffer.isView(value)) {
    const copy = value.slice();
    seen.set(value, copy);
    return copy;
  }
  if (Array.isArray(value)) {
    const copy = [];
    seen.set(value, copy);
    for (const item of value) copy.push(cloneState(item, seen));
    return copy;
  }
  if (value instanceof Map) {
    const copy = new Map();
    seen.set(value, copy);
    for (const [k, v] of value) copy.set(cloneState(k, seen), cloneState(v, seen));
    return copy;
  }
  if (value instanceof Set) {
    const copy = new Set();
    seen.set(value, copy);
    for (const v of value) copy.add(cloneState(v, seen));
    return copy;
  }

  const copy = Object.create(Object.getPrototypeOf(value));
  seen.set(value, copy);
  for (const key of Object.keys(value)) copy[key] = cloneState(value[key], seen);
  return copy;
}
