#!/usr/bin/env node
/* Tests for the harness itself, on toy games: npm test (in tools/qa). */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseDurations, readBrief } from '../lib/brief.mjs';
import { runEpisode } from '../lib/episode.mjs';
import { allJobs, summarizeAll } from '../lib/ladder.mjs';
import { selfCheck } from '../lib/selfcheck.mjs';
import * as arcade from '../profiles/arcade.mjs';
import * as turn from '../profiles/turn.mjs';
import { makeToyAdapter } from './toy.mjs';
import { makeNimAdapter } from './toy-turn.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
let failures = 0;
function assert(cond, msg) {
  console.log(`${cond ? 'ok' : 'FAIL'}: ${msg}`);
  if (!cond) failures += 1;
}

/** Run a profile's whole ladder in-process (run.mjs does this in workers). */
function ladder(profile, adapter, seeds, expect = {}, runBand = null) {
  const limits = profile.limits({ runBand, expect });
  const episodes = allJobs(profile, adapter, expect, limits, seeds).map((job) => runEpisode(adapter, job));
  return summarizeAll(profile, adapter, episodes);
}

const byId = (checks, id) => checks.find((c) => c.id === id);

// --- Brief ------------------------------------------------------------------

assert(JSON.stringify(parseDurations('45 s – 4 min')) === '[45,240]', 'run_band "45 s – 4 min" → [45, 240]');
assert(JSON.stringify(parseDurations('90 seconds')) === '[90,90]', 'single duration → [d, d]');
assert(parseDurations('long') === null, 'no duration → null');
const brief = readBrief(path.join(ROOT, 'GroveRun'));
assert(brief.shape === 'real-time arcade' && brief.inputs === 'both', 'reads the GroveRun QC brief table');

// --- Adapter self-check -----------------------------------------------------

const toy = makeToyAdapter();
const good = selfCheck(toy);
assert(good.every((c) => c.status === 'pass'), `good adapter passes self-check (${good.map((c) => c.id).join(', ')})`);
assert(byId(selfCheck(makeToyAdapter({ cloneable: false })), 'cloneable').status === 'fail', 'rng without clone() fails the cloneable check');
const missing = selfCheck({ ...toy, observe: undefined });
assert(missing[0].status === 'fail' && /observe/.test(missing[0].detail), 'missing contract member is named');
const noSeat = selfCheck({ ...makeNimAdapter(), seat: undefined });
assert(noSeat[0].status === 'fail' && /seat/.test(noSeat[0].detail), 'two-seat adapter without seat() is rejected');

// --- Arcade ladder ----------------------------------------------------------

const am = ladder(arcade, toy, 6, {}, [10, 60]);
assert(am.idle.seconds.p50 < 10, `arcade: idle dies fast (p50 ${am.idle.seconds.p50} s)`);
assert(am.searcher.seconds.p50 > am.random.seconds.p50 * 2, `arcade: searcher outlasts random (${am.searcher.seconds.p50} vs ${am.random.seconds.p50} s)`);
assert(am.humanish.seconds.p50 > am.random.seconds.p50, `arcade: humanish outlasts random (${am.humanish.seconds.p50} vs ${am.random.seconds.p50} s)`);
const ac = arcade.checks(am, { runBand: [10, 60], expect: { firstRewardS: 5 } });
assert(ac.length >= 7 && ac.every((c) => ['pass', 'fail', 'warn'].includes(c.status)), `arcade profile returns ${ac.length} checks`);

const a1 = runEpisode(toy, { seed: 3, key: 'humanish', players: [{ name: 'humanish', spec: arcade.ladder.humanish }], maxSeconds: 30 });
const a2 = runEpisode(toy, { seed: 3, key: 'humanish', players: [{ name: 'humanish', spec: arcade.ladder.humanish }], maxSeconds: 30 });
assert(JSON.stringify(a1) === JSON.stringify(a2), 'search bots are deterministic');

// --- Turn-based, two seats --------------------------------------------------

const nim2 = makeNimAdapter({ seats: 2 });
assert(selfCheck(nim2).every((c) => c.status === 'pass'), 'Nim (2 seats) passes self-check');
const tm = ladder(turn, nim2, 20);
const tc = turn.checks(tm, { adapter: nim2, runBand: null, expect: {} });
for (const id of ['games-finish', 'skill-matters', 'ladder-ordered']) {
  assert(byId(tc, id).status === 'pass', `turn/2 seats: ${id} — ${byId(tc, id).detail}`);
}
assert(byId(tc, 'seat-balance') !== undefined, `turn/2 seats: seat-balance reported — ${byId(tc, 'seat-balance').detail}`);
assert(byId(tc, 'game-length').status === 'skip', 'turn/2 seats: game length skipped without turns or secondsPerTurn');
const withTurns = turn.checks(tm, { adapter: nim2, runBand: null, expect: { turns: [1, 2] } });
assert(byId(withTurns, 'game-length').status === 'fail', 'turn: game-length fails outside expect.turns');

// --- Turn-based, one seat vs the game's AI with difficulty variants ---------

const nim1 = makeNimAdapter({ seats: 1 });
assert(selfCheck(nim1).every((c) => c.status === 'pass'), 'Nim (vs AI) passes self-check');
const vm = ladder(turn, nim1, 20);
assert(Object.keys(vm).includes('searcher @ hard'), `one-seat matchups are per variant (${Object.keys(vm).join(', ')})`);
const vc = turn.checks(vm, { adapter: nim1, runBand: null, expect: {} });
for (const id of ['games-finish', 'skill-matters', 'variants-ordered']) {
  assert(byId(vc, id).status === 'pass', `turn/vs AI: ${id} — ${byId(vc, id).detail}`);
}

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('\nHarness self-test passed.');
