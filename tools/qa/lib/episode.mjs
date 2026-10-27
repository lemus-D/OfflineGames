/* Run one seeded game with one bot, headless, through the game's adapter.

   The loop is one fixed simulation step per tick. At decision points the bot
   picks an action; between them the adapter is ticked with `null`. Every
   action is logged against its tick, so the same run can be replayed exactly
   in Node or in the browser (src/core/qa.js). */

import { makeBot } from './bots.mjs';
import { drainShared, isDecisionPoint, seatOf } from './sim.mjs';

/** Non-finite numbers anywhere in observe() — NaN positions, Infinity speeds. */
export function nonFinite(obs, prefix = '') {
  const bad = [];
  for (const [k, v] of Object.entries(obs)) {
    if (typeof v === 'number' && !Number.isFinite(v)) bad.push(prefix + k);
    else if (v && typeof v === 'object') bad.push(...nonFinite(v, `${prefix}${k}.`));
  }
  return bad;
}

/**
 * @param {object} adapter  the game's qa/adapter.mjs default export
 * @param {{
 *   seed: number,
 *   key: string,                              matchup label, e.g. "searcher" or "searcher vs random"
 *   players: { name: string, spec: object }[], one per seat
 *   variant?: string,                         passed to adapter.create (e.g. AI difficulty)
 *   maxSeconds: number,
 *   maxDecisions?: number,
 * }} job
 */
export function runEpisode(adapter, job) {
  const session = adapter.create(job.seed, job.variant);
  const bots = job.players.map((p, seat) => makeBot(p.spec, adapter, job.seed, seat * 101 + p.name.length));
  const maxDecisions = job.maxDecisions ?? Infinity;
  const inputs = [];
  const events = [];
  const violations = [];
  let tick = 0;

  while (!adapter.terminal(session) && adapter.time(session) < job.maxSeconds && inputs.length < maxDecisions) {
    let action = null;
    if (isDecisionPoint(adapter, session, tick)) {
      action = bots[seatOf(adapter, session)].choose(session, tick);
      inputs.push([tick, action]);
    }
    adapter.tick(session, action);

    for (const ev of drainShared(adapter, session)) {
      events.push({ ...ev, tick, t: round(adapter.time(session)) });
    }
    if (violations.length < 20) {
      for (const name of nonFinite(adapter.observe(session))) violations.push({ tick, name: `non-finite ${name}` });
      for (const name of adapter.invariants(session)) violations.push({ tick, name });
    }
    tick += 1;
  }

  const terminal = adapter.terminal(session);
  return {
    seed: job.seed,
    key: job.key,
    variant: job.variant ?? null,
    seconds: round(adapter.time(session)),
    ticks: tick,
    decisions: inputs.length,
    score: adapter.score(session, 0),
    end: terminal ? adapter.outcome(session) : { result: 'capped' },
    final: adapter.observe(session),
    events,
    inputs,
    violations,
  };
}

function round(x) {
  return Math.round(x * 1000) / 1000;
}
