/* The bot ladder. Every bot uses only the adapter contract, so the same four
   play every game:

     idle      never acts — does the game punish doing nothing?
     random    uniform random actions — the floor
     humanish  short lookahead, a reaction delay and a little noise
     searcher  longer lookahead, more rollouts — the best play we can get

   Search works because the simulation is deterministic and copyable. At each
   decision the bot tries every action on copies of the session, plays each
   copy forward with a cheap rollout policy, and keeps the action whose
   futures score best. Nothing game-specific is written here. */

import { makeRNG, mixSeed, pick } from './rng.mjs';
import { cloneSession, isDecisionPoint } from './sim.mjs';

export const BOTS = ['idle', 'random', 'humanish', 'searcher'];

/** horizon is in decisions; reactionS in seconds of game time. Profiles and
    qa/expect.json may override any of these per bot. */
export const BOT_DEFAULTS = {
  idle: {},
  random: {},
  humanish: { horizon: 12, rollouts: 2, reactionS: 0.25, noise: 0.05, idleBias: 0.7 },
  searcher: { horizon: 20, rollouts: 4, reactionS: 0, noise: 0, idleBias: 0.7 },
};

/** A rollout never runs longer than this, even for slow turn resolution. */
const MAX_ROLLOUT_S = 60;
const BIG = 1e9;

export function makeBot(kind, adapter, seed, options = {}) {
  const opts = { ...BOT_DEFAULTS[kind], ...options };
  const rng = makeRNG(mixSeed(seed, BOTS.indexOf(kind) + 1));

  if (kind === 'idle') return { choose: (s) => adapter.actions(s)[0] };
  if (kind === 'random') return { choose: (s) => pick(rng, adapter.actions(s)) };
  if (kind === 'humanish' || kind === 'searcher') return searchBot(adapter, seed, opts, rng);
  throw new Error(`unknown bot "${kind}"`);
}

function searchBot(adapter, seed, opts, rng) {
  const decisionS = adapter.ticksPerDecision ? adapter.ticksPerDecision * adapter.fixedDt : 0;
  const delay = decisionS ? Math.round(opts.reactionS / decisionS) : 0;
  // A human acts on what they saw a moment ago: plans go through a queue.
  const queue = [];

  return {
    choose(session, tick) {
      // Plan from where the already-committed moves will leave us.
      let view = session;
      let viewTick = tick;
      if (queue.length) {
        view = cloneSession(adapter, session);
        for (const action of queue) viewTick = playDecision(adapter, view, viewTick, action);
      }
      const actions = adapter.actions(view);
      let planned = adapter.terminal(view) ? actions[0] : bestAction(adapter, view, viewTick, actions, opts, seed);
      if (opts.noise && rng() < opts.noise) planned = pick(rng, actions);
      if (!delay) return planned;
      queue.push(planned);
      return queue.length > delay ? queue.shift() : adapter.actions(session)[0];
    },
  };
}

/** Apply one action, then tick until the next decision point. Returns that tick. */
function playDecision(adapter, session, tick, action) {
  adapter.tick(session, action);
  tick += 1;
  while (!adapter.terminal(session) && !isDecisionPoint(adapter, session, tick)) {
    adapter.tick(session, null);
    tick += 1;
  }
  return tick;
}

function bestAction(adapter, session, tick, actions, opts, seed) {
  if (actions.length === 1) return actions[0];
  let best = actions[0];
  let bestValue = -Infinity;
  for (const action of actions) {
    let total = 0;
    for (let r = 0; r < opts.rollouts; r++) {
      // Same random stream per rollout index for every action, so the
      // actions are compared against the same futures.
      total += rollout(adapter, session, tick, action, opts, makeRNG(mixSeed(seed, tick, r)));
    }
    // Strictly greater: ties keep the earlier action, and actions[0] is
    // "do nothing", so the bot does not twitch when nothing matters.
    if (total / opts.rollouts > bestValue) {
      best = action;
      bestValue = total / opts.rollouts;
    }
  }
  return best;
}

function rollout(adapter, session, tick, first, opts, rng) {
  const copy = cloneSession(adapter, session);
  const maxTicks = Math.ceil(MAX_ROLLOUT_S / adapter.fixedDt);
  let decisions = 0;
  for (let n = 0; n < maxTicks && !adapter.terminal(copy); n++) {
    let action = null;
    if (n === 0) action = first;
    else if (isDecisionPoint(adapter, copy, tick + n)) {
      if (++decisions >= opts.horizon) break;
      const actions = adapter.actions(copy);
      action = rng() < opts.idleBias ? actions[0] : pick(rng, actions);
    }
    adapter.tick(copy, action);
  }
  return valueOf(adapter, copy);
}

/** Survive first, then score. Dying later beats dying sooner. */
function valueOf(adapter, s) {
  if (!adapter.terminal(s)) return adapter.score(s);
  const { result } = adapter.outcome(s);
  if (result === 'win') return BIG - adapter.time(s);
  if (result === 'death' || result === 'lose') return -BIG + adapter.time(s);
  return adapter.score(s);
}
