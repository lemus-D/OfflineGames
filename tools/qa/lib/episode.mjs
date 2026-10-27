/* Run one seeded game with one bot, headless, through the game's adapter.

   The loop is one fixed simulation step per tick. At decision points the bot
   picks an action; between them the adapter is ticked with `null`. Every
   action is logged against its tick, so the same run can be replayed exactly
   in Node or in the browser (src/core/qa.js). */

import { makeBot } from './bots.mjs';
import { isDecisionPoint, drainShared } from './sim.mjs';

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
 * @param {{ seed: number, bot: string, botOptions?: object, maxSeconds: number }} job
 */
export function runEpisode(adapter, job) {
  const session = adapter.create(job.seed);
  const bot = makeBot(job.bot, adapter, job.seed, job.botOptions);
  const inputs = [];
  const events = [];
  const violations = [];
  let tick = 0;

  while (!adapter.terminal(session) && adapter.time(session) < job.maxSeconds) {
    let action = null;
    if (isDecisionPoint(adapter, session, tick)) {
      action = bot.choose(session, tick);
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
    bot: job.bot,
    seconds: round(adapter.time(session)),
    ticks: tick,
    score: adapter.score(session),
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
