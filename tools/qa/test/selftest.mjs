#!/usr/bin/env node
/* Tests for the harness itself, on a toy game: npm test (in tools/qa). */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { BOTS } from '../lib/bots.mjs';
import { parseDurations, readBrief } from '../lib/brief.mjs';
import { runEpisode } from '../lib/episode.mjs';
import { summarizeBot } from '../lib/metrics.mjs';
import { selfCheck } from '../lib/selfcheck.mjs';
import * as arcade from '../profiles/arcade.mjs';
import { makeToyAdapter } from './toy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
let failures = 0;
function assert(cond, msg) {
  console.log(`${cond ? 'ok' : 'FAIL'}: ${msg}`);
  if (!cond) failures += 1;
}

// Durations and the brief.
assert(JSON.stringify(parseDurations('45 s – 4 min')) === '[45,240]', 'run_band "45 s – 4 min" → [45, 240]');
assert(JSON.stringify(parseDurations('90 seconds')) === '[90,90]', 'single duration → [d, d]');
assert(parseDurations('long') === null, 'no duration → null');
const brief = readBrief(path.join(ROOT, 'GroveRun'));
assert(brief.shape === 'real-time arcade' && brief.inputs === 'both', 'reads the GroveRun QC brief table');

// The self-check passes a good adapter and catches a shared rng.
const toy = makeToyAdapter();
const good = selfCheck(toy);
assert(good.every((c) => c.status === 'pass'), `good adapter passes self-check (${good.map((c) => c.id).join(', ')})`);
const broken = selfCheck(makeToyAdapter({ cloneable: false }));
assert(
  broken.find((c) => c.id === 'cloneable')?.status === 'fail',
  'rng without clone() fails the cloneable check'
);
const missing = selfCheck({ ...toy, observe: undefined });
assert(missing[0].status === 'fail' && /observe/.test(missing[0].detail), 'missing contract member is named');

// The ladder: doing nothing loses, search beats random.
const runs = {};
for (const bot of BOTS) {
  runs[bot] = summarizeBot(
    Array.from({ length: 6 }, (_, i) => runEpisode(toy, { seed: i + 1, bot, maxSeconds: 60 }))
  );
}
assert(runs.idle.seconds.p50 < 10, `idle dies fast (p50 ${runs.idle.seconds.p50} s)`);
assert(
  runs.searcher.seconds.p50 > runs.random.seconds.p50 * 2,
  `searcher outlasts random (p50 ${runs.searcher.seconds.p50} s vs ${runs.random.seconds.p50} s)`
);
assert(
  runs.humanish.seconds.p50 > runs.random.seconds.p50,
  `humanish outlasts random (p50 ${runs.humanish.seconds.p50} s vs ${runs.random.seconds.p50} s)`
);

// Same job, same result — bots are seeded too.
const a = runEpisode(toy, { seed: 3, bot: 'humanish', maxSeconds: 30 });
const b = runEpisode(toy, { seed: 3, bot: 'humanish', maxSeconds: 30 });
assert(JSON.stringify(a) === JSON.stringify(b), 'search bots are deterministic');

// The profile produces a full check list without throwing.
const checks = arcade.checks(runs, { runBand: [10, 60], expect: { firstRewardS: 5 } });
assert(checks.length >= 7 && checks.every((c) => ['pass', 'fail', 'warn'].includes(c.status)), `arcade profile returns ${checks.length} checks`);

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('\nHarness self-test passed.');
