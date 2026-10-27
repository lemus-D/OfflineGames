/* Turn a profile's ladder and matchups into episode jobs, and episodes back
   into per-matchup metrics. Shared by run.mjs and the self-test. */

import { summarizeBot } from './metrics.mjs';

export function makeJob(profile, expect, limits, matchup, seed) {
  return {
    seed,
    key: matchup.key,
    variant: matchup.variant,
    players: matchup.players.map((name) => ({ name, spec: { ...profile.ladder[name], ...expect.bots?.[name] } })),
    ...limits,
  };
}

export function allJobs(profile, adapter, expect, limits, seeds) {
  return profile
    .matchups(adapter)
    .flatMap((m) => Array.from({ length: seeds }, (_, i) => makeJob(profile, expect, limits, m, i + 1)));
}

export function summarizeAll(profile, adapter, episodes) {
  return Object.fromEntries(
    profile.matchups(adapter).map((m) => [m.key, summarizeBot(episodes.filter((e) => e.key === m.key))])
  );
}
