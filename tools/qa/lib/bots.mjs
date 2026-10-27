/* Bots. Every bot uses only the adapter contract, so the same ones play
   every game. A profile names its ladder (tools/qa/profiles/*.mjs); each
   rung is a spec with a type:

     idle    never acts — does the game punish doing nothing?
     random  uniform random actions — the floor
     search  lookahead: try every action on copies of the session, play each
             copy forward with a cheap rollout policy, keep the action whose
             futures score best for the seat that is choosing

   Search works because the simulation is deterministic and copyable.
   Nothing game-specific is written here.

   Search options: horizon (decisions to look ahead), rollouts (per action),
   reactionS (delay before a plan takes effect), noise (chance of a random
   action), idleBias (how often rollouts choose "do nothing"). */

import { makeRNG, mixSeed, pick } from './rng.mjs';
import { cloneSession, isDecisionPoint, seatOf } from './sim.mjs';

/** A rollout never runs longer than this, even for slow turn resolution. */
const MAX_ROLLOUT_S = 60;
const BIG = 1e9;

export function makeBot(spec, adapter, seed, salt) {
  const rng = makeRNG(mixSeed(seed, salt));
  if (spec.type === 'idle') return { choose: (s) => adapter.actions(s)[0] };
  if (spec.type === 'random') return { choose: (s) => pick(rng, adapter.actions(s)) };
  if (spec.type === 'search') return searchBot(adapter, seed, spec, rng);
  throw new Error(`unknown bot type "${spec.type}"`);
}

function searchBot(adapter, seed, opts, rng) {
  const decisionS = adapter.ticksPerDecision ? adapter.ticksPerDecision * adapter.fixedDt : 0;
  const delay = decisionS && opts.reactionS ? Math.round(opts.reactionS / decisionS) : 0;
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
  const me = seatOf(adapter, session);
  let best = actions[0];
  let bestValue = -Infinity;
  for (const action of actions) {
    let total = 0;
    for (let r = 0; r < opts.rollouts; r++) {
      // Same random stream per rollout index for every action, so the
      // actions are compared against the same futures.
      total += rollout(adapter, session, tick, action, opts, me, makeRNG(mixSeed(seed, tick, r)));
    }
    // Strictly greater: ties keep the earlier action, and actions[0] is
    // "do nothing" (or the default move), so the bot does not twitch.
    if (total / opts.rollouts > bestValue) {
      best = action;
      bestValue = total / opts.rollouts;
    }
  }
  return best;
}

function rollout(adapter, session, tick, first, opts, me, rng) {
  const copy = cloneSession(adapter, session);
  const maxTicks = Math.ceil(MAX_ROLLOUT_S / adapter.fixedDt);
  let decisions = 0;
  for (let n = 0; n < maxTicks && !adapter.terminal(copy); n++) {
    let action = null;
    if (n === 0) action = first;
    else if (isDecisionPoint(adapter, copy, tick + n)) {
      if (++decisions >= opts.horizon) break;
      const actions = adapter.actions(copy);
      action = rng() < (opts.idleBias ?? 0) ? actions[0] : pick(rng, actions);
    }
    adapter.tick(copy, action);
  }
  return valueOf(adapter, copy, me);
}

/** Survive (or win) first, then score — always from the choosing seat's side. */
function valueOf(adapter, s, me) {
  if (!adapter.terminal(s)) return adapter.score(s, me);
  const { result, winner } = adapter.outcome(s);
  const won = winner != null ? winner === me : result === 'win';
  const lost = winner != null ? winner !== me : result === 'death' || result === 'lose';
  if (won) return BIG - adapter.time(s);
  if (lost) return -BIG + adapter.time(s);
  return adapter.score(s, me);
}
