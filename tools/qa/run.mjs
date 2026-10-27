#!/usr/bin/env node
/* tools/qa entry point — the same command for every game, agent and platform.

     node tools/qa/run.mjs <Game> [--tier bots|probes|all] [--seeds 20] [--label name] [--final]
                           [--replay-from <label>]

   Tier 1 (bots) plays the simulation headless through <Game>/qa/adapter.mjs.
   Tier 2 (probes) drives the real page in Chromium through src/core/qa.js.
   Writes tools/qa/out/<Game>/<label>/{report.md, results.json, moments/}
   and exits 1 if any check fails. --final (last critic round only) also
   records recording.webm for the owner and moments/filmstrip.png for the
   critic's motion review. --replay-from replays an earlier run's exact
   inputs, so key moments pair up with that run's even after gameplay changed. */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';

import { parseDurations, readBrief, readExpect } from './lib/brief.mjs';
import { runEpisode } from './lib/episode.mjs';
import { allJobs, makeJob, summarizeAll } from './lib/ladder.mjs';
import { renderReport } from './lib/report.mjs';
import { selfCheck } from './lib/selfcheck.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

const PROFILES = {
  arcade: () => import('./profiles/arcade.mjs'),
  turn: () => import('./profiles/turn.mjs'),
};

function parseArgs(argv) {
  const args = { tier: 'all', seeds: 20, label: null, game: null, final: false, replayFrom: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--tier') args.tier = argv[++i];
    else if (a === '--seeds') args.seeds = Number(argv[++i]);
    else if (a === '--label') args.label = argv[++i];
    else if (a === '--final') args.final = true;
    else if (a === '--replay-from') args.replayFrom = argv[++i];
    else if (!args.game) args.game = a;
  }
  if (!args.game || !['bots', 'probes', 'all'].includes(args.tier) || !(args.seeds > 0)) {
    console.error('usage: node tools/qa/run.mjs <Game> [--tier bots|probes|all] [--seeds 20] [--label name] [--final]');
    process.exit(2);
  }
  return args;
}

/** Short git sha of HEAD, "-dirty" when the game has uncommitted changes. */
function buildLabel(gameDir) {
  try {
    const sha = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
    const dirty = execSync(`git status --porcelain -- "${gameDir}"`, { cwd: ROOT }).toString().trim();
    return dirty ? `${sha}-dirty` : sha;
  } catch {
    return 'nogit';
  }
}

function runJobs(jobs, adapterUrl) {
  const size = Math.min(jobs.length, availableParallelism());
  const results = new Array(jobs.length);
  let next = 0;
  let done = 0;
  return new Promise((resolve, reject) => {
    for (let w = 0; w < size; w++) {
      const worker = new Worker(path.join(HERE, 'lib/worker.mjs'), { workerData: { adapterUrl } });
      worker.on('error', reject);
      const feed = () => {
        if (next >= jobs.length) {
          worker.terminate();
          return;
        }
        const i = next++;
        worker.once('message', (episode) => {
          results[i] = episode;
          done += 1;
          process.stdout.write(`\r  bots: ${done}/${jobs.length} runs`);
          if (done === jobs.length) {
            process.stdout.write('\n');
            resolve(results);
          }
          feed();
        });
        worker.postMessage(jobs[i]);
      };
      feed();
    }
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const gameDir = path.resolve(ROOT, args.game);
  const adapterPath = path.join(gameDir, 'qa', 'adapter.mjs');
  if (!existsSync(adapterPath)) {
    console.error(`no adapter at ${path.relative(ROOT, adapterPath)} — see tools/qa/README.md`);
    process.exit(2);
  }

  const brief = readBrief(gameDir);
  const expect = readExpect(gameDir);
  const runBand = parseDurations(brief.run_band);
  const adapterUrl = pathToFileURL(adapterPath).href;
  const adapter = (await import(adapterUrl)).default;
  const profileName = adapter.profile;
  if (!PROFILES[profileName]) {
    console.error(`no "${profileName}" profile yet — have: ${Object.keys(PROFILES).join(', ')}`);
    process.exit(2);
  }
  const profile = await PROFILES[profileName]();
  const label = args.label || buildLabel(gameDir);
  const outDir = path.join(HERE, 'out', path.basename(gameDir), label);
  mkdirSync(outDir, { recursive: true });

  console.log(`QA ${path.basename(gameDir)} @ ${label} — profile ${profileName}, tier ${args.tier}`);

  const checks = selfCheck(adapter);
  const adapterOk = checks.every((c) => c.status !== 'fail');
  const limits = profile.limits({ runBand, expect });
  const keys = profile.replayKeys(adapter);
  const toJob = (matchup, seed) => makeJob(profile, expect, limits, matchup, seed);
  let metrics = null;
  let moments = [];
  const replays = {};

  if (adapterOk) {
    const all = profile.matchups(adapter);
    let episodes;
    if (args.tier === 'probes') {
      // Probes still need runs to replay: the key-moment one and a long one.
      episodes = all.filter((m) => m.key === keys.moments || m.key === keys.long).map((m) => runEpisode(adapter, toJob(m, 1)));
    } else {
      episodes = await runJobs(allJobs(profile, adapter, expect, limits, args.seeds), adapterUrl);
      metrics = summarizeAll(profile, adapter, episodes);
      checks.push(...profile.checks(metrics, { adapter, runBand, expect, brief }));
    }
    for (const [role, key] of Object.entries(keys)) {
      const ep = episodes.find((e) => e.key === key && e.seed === 1);
      if (ep) replays[role] = { key, seed: ep.seed, variant: ep.variant, ticks: ep.ticks, inputs: ep.inputs, events: ep.events };
    }
    if (args.replayFrom) {
      const earlier = path.join(HERE, 'out', path.basename(gameDir), args.replayFrom, 'results.json');
      if (!existsSync(earlier)) throw new Error(`--replay-from: no run "${args.replayFrom}"`);
      const from = JSON.parse(readFileSync(earlier, 'utf8')).replays;
      for (const role of Object.keys(from)) replays[role] = { ...from[role], from: args.replayFrom };
    }

    if (args.tier !== 'bots') {
      const { runProbes } = await import('./probes.mjs');
      const probed = await runProbes({ gameDir, brief, expect, adapter, replays, outDir, final: args.final });
      checks.push(...probed.checks);
      moments = probed.moments;
    }
  }

  const results = { game: path.basename(gameDir), label, profile: profileName, brief, runBand, checks, metrics, moments, replays };
  writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(results, null, 2));
  writeFileSync(
    path.join(outDir, 'report.md'),
    renderReport({ ...results, seeds: args.tier === 'probes' ? 0 : args.seeds })
  );

  for (const c of checks) console.log(`  ${c.status.toUpperCase().padEnd(4)} ${c.id} — ${c.detail}`);
  console.log(`\nreport: ${path.relative(process.cwd(), path.join(outDir, 'report.md'))}`);
  process.exit(checks.some((c) => c.status === 'fail') ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
