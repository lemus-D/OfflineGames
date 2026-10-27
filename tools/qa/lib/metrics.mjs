/* Turn episode results into per-bot numbers. Only the shared event
   vocabulary is used, so these are the same for every game:

     reward  damage  danger  death  input  win  lose  turn_end  level_end */

export function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[i];
}

const spread = (values) => ({
  p10: percentile(values, 10),
  p50: percentile(values, 50),
  p90: percentile(values, 90),
});

export function summarizeBot(episodes) {
  const seconds = episodes.map((e) => e.seconds);
  const minutes = seconds.reduce((a, b) => a + b, 0) / 60;

  const ends = {};
  for (const e of episodes) {
    const key = e.end.cause ? `${e.end.result}:${e.end.cause}` : e.end.result;
    ends[key] = (ends[key] || 0) + 1;
  }

  const counts = {};
  const firsts = {};
  for (const e of episodes) {
    const seen = new Set();
    for (const ev of e.events) {
      counts[ev.kind] = (counts[ev.kind] || 0) + 1;
      if (!seen.has(ev.kind)) {
        seen.add(ev.kind);
        (firsts[ev.kind] ||= []).push(ev.t);
      }
    }
  }

  const perMinute = {};
  const perRun = {};
  const first = {};
  for (const kind of Object.keys(counts)) {
    perMinute[kind] = minutes ? round(counts[kind] / minutes) : 0;
    perRun[kind] = round(counts[kind] / episodes.length);
    first[kind] = {
      p50: percentile(firsts[kind], 50),
      neverFraction: round(1 - firsts[kind].length / episodes.length),
    };
  }

  // Who won: seat indexes for multi-seat games, 'win' results for one seat.
  const winners = {};
  let wins = 0;
  for (const e of episodes) {
    if (e.end.winner != null) winners[e.end.winner] = (winners[e.end.winner] || 0) + 1;
    else if (e.end.result === 'draw') winners.draw = (winners.draw || 0) + 1;
    if (e.end.winner != null ? e.end.winner === 0 : e.end.result === 'win') wins += 1;
  }

  return {
    runs: episodes.length,
    variant: episodes[0]?.variant ?? null,
    seconds: spread(seconds),
    decisions: spread(episodes.map((e) => e.decisions)),
    winRate: round(wins / episodes.length),
    winners,
    score: spread(episodes.map((e) => e.score)),
    ends,
    perMinute,
    perRun,
    first,
    violations: episodes.flatMap((e) => e.violations.map((v) => ({ seed: e.seed, ...v }))).slice(0, 10),
  };
}

/** Fraction of runs where `kind` never happened (1 when it never happened at all). */
export function neverFraction(botMetrics, kind) {
  return botMetrics.first[kind] ? botMetrics.first[kind].neverFraction : 1;
}

function round(x) {
  return Math.round(x * 100) / 100;
}
