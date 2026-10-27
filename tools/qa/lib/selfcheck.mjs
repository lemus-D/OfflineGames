/* Checks on the adapter itself, run before any bot. If these fail, every
   number after them is noise. */

import { runEpisode } from './episode.mjs';
import { cloneSession, isDecisionPoint } from './sim.mjs';
import { makeRNG, pick } from './rng.mjs';

const REQUIRED = [
  'fixedDt',
  'create',
  'actions',
  'tick',
  'time',
  'score',
  'terminal',
  'outcome',
  'drainEvents',
  'mapEvent',
  'observe',
  'invariants',
];

/** Rebuild a run from its seed and input log — what the browser replay does. */
export function replay(adapter, seed, inputs, ticks, variant) {
  const session = adapter.create(seed, variant);
  const byTick = new Map(inputs);
  for (let t = 0; t < ticks; t++) {
    adapter.tick(session, byTick.has(t) ? byTick.get(t) : null);
    adapter.drainEvents(session);
  }
  return session;
}

export function selfCheck(adapter) {
  const checks = [];
  const add = (id, ok, detail) => checks.push({ id, status: ok ? 'pass' : 'fail', detail });

  const missing = REQUIRED.filter((k) => adapter[k] === undefined);
  if (!adapter.ticksPerDecision && !adapter.awaitingDecision) missing.push('ticksPerDecision or awaitingDecision');
  if ((adapter.seats || 1) > 1 && !adapter.seat) missing.push('seat (needed when seats > 1)');
  add('adapter-contract', !missing.length, missing.length ? `missing: ${missing.join(', ')}` : 'all members present');
  if (missing.length) return checks;

  // Same seed, same bot → same run.
  const seats = adapter.seats || 1;
  const job = {
    seed: 1234,
    key: 'random',
    players: Array.from({ length: seats }, () => ({ name: 'random', spec: { type: 'random' } })),
    variant: adapter.variants?.[0],
    maxSeconds: 20,
    maxDecisions: 200,
  };
  const a = runEpisode(adapter, job);
  const b = runEpisode(adapter, job);
  const sameRun = a.ticks === b.ticks && json(a.final) === json(b.final) && json(a.events) === json(b.events);
  add('deterministic', sameRun, sameRun ? `seed 1234 twice: identical over ${a.ticks} ticks` : 'two runs of seed 1234 diverged');

  // The input log alone reproduces the run. Browser replays depend on this.
  const replayed = replay(adapter, job.seed, a.inputs, a.ticks, job.variant);
  const sameReplay = json(adapter.observe(replayed)) === json(a.final);
  add('replayable', sameReplay, sameReplay ? 'input log reproduces the run' : 'replaying the input log ends in a different state');

  // A copy taken mid-run is independent and faithful.
  const session = adapter.create(99, job.variant);
  let tick = drive(adapter, session, 0, 2, 7);
  const before = json(adapter.observe(session));
  const copy = cloneSession(adapter, session);
  drive(adapter, copy, tick, 3, 8);
  const untouched = json(adapter.observe(session)) === before;
  drive(adapter, session, tick, 3, 8);
  const faithful = json(adapter.observe(session)) === json(adapter.observe(copy));
  add(
    'cloneable',
    untouched && faithful,
    !untouched
      ? 'advancing a copy changed the original (shared state — a function without clone()?)'
      : !faithful
        ? 'copy and original diverged on the same inputs (rng or other state not copied)'
        : 'copies are independent and continue identically'
  );

  return checks;
}

/** Play `seconds` of seeded random actions; returns the tick reached. */
function drive(adapter, session, tick, seconds, seed) {
  const rng = makeRNG(seed);
  const end = tick + Math.round(seconds / adapter.fixedDt);
  for (; tick < end && !adapter.terminal(session); tick++) {
    const action = isDecisionPoint(adapter, session, tick) ? pick(rng, adapter.actions(session)) : null;
    adapter.tick(session, action);
    adapter.drainEvents(session);
  }
  return tick;
}

function json(x) {
  return JSON.stringify(x);
}
