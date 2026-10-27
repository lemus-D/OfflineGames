/* A turn-based toy for testing the harness: Nim. A pile of 15–25 sticks
   (from the seed); take 1–3 per turn; whoever takes the last stick wins.
   Perfect play leaves the opponent a multiple of four.

   seats: 2 — two bots play each other.
   seats: 1 — the bot plays the toy's own AI; variants 'easy' (random) and
              'hard' (perfect), like a game's difficulty setting. */

function makeRNG(seed) {
  let a = seed >>> 0;
  function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  rng.clone = () => {
    const copy = makeRNG(0);
    copy.setState(a);
    return copy;
  };
  rng.setState = (v) => {
    a = v;
  };
  return rng;
}

class Nim {
  constructor(seed, ai) {
    this.rng = makeRNG(seed);
    this.pile = 15 + Math.floor(this.rng() * 11);
    this.turn = 0;
    this.moves = 0;
    this.winner = null;
    this.ai = ai;
    this.events = [];
  }

  take(n, seat) {
    n = Math.max(1, Math.min(3, n, this.pile));
    this.pile -= n;
    this.moves += 1;
    this.events.push({ kind: 'take', seat });
    if (this.pile === 0) {
      this.winner = seat;
      return;
    }
    this.turn = 1 - this.turn;
  }

  /** One tick = one move. In one-seat mode the AI answers in the same tick. */
  play(n) {
    if (this.winner !== null) return;
    this.take(n, this.turn);
    if (this.ai && this.winner === null) {
      const perfect = this.pile % 4;
      const move = this.ai === 'hard' && perfect ? perfect : 1 + Math.floor(this.rng() * 3);
      this.take(move, 1);
    }
  }
}

export function makeNimAdapter({ seats = 2 } = {}) {
  return {
    profile: 'turn',
    seats,
    variants: seats === 1 ? ['easy', 'hard'] : undefined,
    fixedDt: 1,
    awaitingDecision: (s) => s.winner === null,
    seat: (s) => s.turn,
    create: (seed, variant) => new Nim(seed, seats === 1 ? variant || 'easy' : null),
    actions: (s) => [1, 2, 3].filter((n) => n <= s.pile),
    tick: (s, n) => s.play(n ?? 1),
    time: (s) => s.moves,
    score: () => 0,
    terminal: (s) => s.winner !== null,
    outcome: (s) => ({ result: 'win', winner: s.winner }),
    drainEvents(s) {
      const out = s.events;
      s.events = [];
      return out;
    },
    mapEvent: (raw) => (raw.kind === 'take' ? { kind: 'turn_end', seat: raw.seat } : null),
    observe: (s) => ({ pile: s.pile, turn: s.turn, moves: s.moves }),
    invariants: (s) => (s.pile < 0 ? ['negative pile'] : []),
  };
}
