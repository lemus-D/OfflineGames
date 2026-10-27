/* A tiny dodge game used only to test the harness. Three lanes; rocks fall
   every half second; coins now and then. Built like the real games: seeded
   rng, fixed timestep, events queue. */

const FIXED_DT = 1 / 60;

function makeRNG(seed, { cloneable = true } = {}) {
  let a = seed >>> 0;
  function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  if (cloneable) {
    rng.clone = () => {
      const copy = makeRNG(0);
      copy.setState(a);
      return copy;
    };
    rng.setState = (v) => {
      a = v;
    };
  }
  return rng;
}

class Toy {
  constructor(seed, opts) {
    this.rng = makeRNG(seed, opts);
    this.lane = 1;
    this.time = 0;
    this.coins = 0;
    this.alive = true;
    this.drops = [];
    this.nextDrop = 0.5;
    this.events = [];
  }

  step(move) {
    if (!this.alive) return;
    this.time += FIXED_DT;
    if (move) {
      this.lane = Math.max(0, Math.min(2, this.lane + move));
      this.events.push({ kind: 'move' });
    }
    if (this.time >= this.nextDrop) {
      this.nextDrop += 0.5;
      const kind = this.rng() < 0.25 ? 'coin' : 'rock';
      this.drops.push({ kind, lane: Math.floor(this.rng() * 3), y: 3 });
    }
    for (const d of this.drops) d.y -= 3 * FIXED_DT;
    for (const d of this.drops) {
      if (d.y > 0 || d.done) continue;
      d.done = true;
      if (d.lane !== this.lane) continue;
      if (d.kind === 'coin') {
        this.coins += 1;
        this.events.push({ kind: 'coin' });
      } else {
        this.alive = false;
        this.events.push({ kind: 'crash' });
      }
    }
    this.drops = this.drops.filter((d) => !d.done);
  }
}

export function makeToyAdapter(opts = {}) {
  const MOVES = { stay: 0, left: -1, right: 1 };
  return {
    profile: 'arcade',
    fixedDt: FIXED_DT,
    ticksPerDecision: 6,
    create: (seed) => new Toy(seed, opts),
    actions: () => ['stay', 'left', 'right'],
    tick: (s, action) => s.step(MOVES[action ?? 'stay']),
    time: (s) => s.time,
    score: (s) => s.time + 5 * s.coins,
    terminal: (s) => !s.alive,
    outcome: () => ({ result: 'death', cause: 'rock' }),
    drainEvents(s) {
      const out = s.events;
      s.events = [];
      return out;
    },
    mapEvent: (raw) =>
      ({ move: { kind: 'input' }, coin: { kind: 'reward' }, crash: { kind: 'death', cause: 'rock' } })[raw.kind] || null,
    observe: (s) => ({ time: s.time, lane: s.lane, coins: s.coins, drops: s.drops.map((d) => [d.lane, d.y]) }),
    invariants: (s) => (s.lane < 0 || s.lane > 2 ? ['lane out of range'] : []),
  };
}
