/* Real-time arcade profile: endless or survival runs that end in death.
   Picked when the QC brief says `shape: real-time arcade`.

   Every check compares bots on the ladder or a bot against the brief, so
   nothing here knows which game it is looking at. Game-specific promises go
   in <Game>/qa/expect.json. */

import { neverFraction } from '../lib/metrics.mjs';

export const name = 'arcade';

/** Longest a bot run may last before it is cut off and counted "capped". */
export function maxSeconds({ runBand }) {
  return runBand ? Math.max(60, runBand[1] * 1.5) : 600;
}

export function checks(m, { runBand, expect }) {
  const out = [];
  const add = (id, status, detail, why) => out.push({ id, status, detail, why });
  const s = (x) => (x == null ? '—' : `${Math.round(x)} s`);

  // Doing nothing should lose, and soon.
  const idleLimit = expect.idleDiesWithinS ?? 30;
  const idleCapped = m.idle.ends.capped || 0;
  add(
    'idle-loses',
    !idleCapped && m.idle.seconds.p90 <= idleLimit ? 'pass' : 'fail',
    `idle p90 ${s(m.idle.seconds.p90)} (limit ${idleLimit} s), ${idleCapped}/${m.idle.runs} never died`,
    'A run you can win by not touching anything has no pressure.'
  );

  // Playing well should beat mashing.
  const ratio = expect.skillRatio ?? 2;
  const human = m.humanish.seconds.p50;
  const random = m.random.seconds.p50;
  add(
    'skill-matters',
    human >= random * ratio ? 'pass' : 'fail',
    `humanish p50 ${s(human)} vs random p50 ${s(random)} (needs ×${ratio})`,
    'If random input survives as long as a decent player, skill does not matter.'
  );

  if (runBand) {
    const [lo, hi] = runBand;
    add(
      'run-band',
      human >= lo && human <= hi ? 'pass' : 'fail',
      `humanish p50 ${s(human)}; brief run_band ${lo}–${hi} s`,
      'A decent player\'s typical run should land inside the brief\'s run length.'
    );
    add(
      'strong-player-lasts',
      m.searcher.seconds.p10 >= lo ? 'pass' : 'fail',
      `searcher p10 ${s(m.searcher.seconds.p10)}; band starts at ${lo} s`,
      'If even the best bot dies early, deaths are unavoidable rather than skill-based.'
    );
  }

  const searcherCapped = m.searcher.ends.capped || 0;
  add(
    'has-ceiling',
    searcherCapped < m.searcher.runs ? 'pass' : 'warn',
    `${searcherCapped}/${m.searcher.runs} searcher runs hit the time cap`,
    'When a strong player never dies, difficulty stops climbing somewhere.'
  );

  // The first reward should be reachable, and early.
  const missRate = neverFraction(m.humanish, 'reward');
  const firstReward = m.humanish.first.reward?.p50 ?? null;
  const rewardLimit = expect.firstRewardS;
  const rewardOk = missRate <= 0.1 && (rewardLimit == null || (firstReward != null && firstReward <= rewardLimit));
  add(
    'first-reward',
    rewardOk ? 'pass' : 'fail',
    `humanish: no reward in ${Math.round(missRate * 100)}% of runs; first reward p50 ${s(firstReward)}` +
      (rewardLimit != null ? ` (limit ${rewardLimit} s)` : ''),
    'A player who never gets the first reward does not learn what the game is about.'
  );

  for (const rule of expect.events || []) out.push(eventRule(m, rule));

  const violations = Object.values(m).flatMap((b) => b.violations);
  add(
    'invariants',
    violations.length ? 'fail' : 'pass',
    violations.length
      ? violations.slice(0, 3).map((v) => `seed ${v.seed} tick ${v.tick}: ${v.name}`).join('; ')
      : 'no violations in any bot run',
    'States the game says can never happen.'
  );

  return out;
}

/** { bot, kind, minPerMin | maxPerMin | minPerRun, why } from expect.json. */
function eventRule(m, rule) {
  const bot = m[rule.bot || 'humanish'];
  const perMin = bot.perMinute[rule.kind] ?? 0;
  const perRun = bot.perRun[rule.kind] ?? 0;
  const fails = [];
  if (rule.minPerMin != null && perMin < rule.minPerMin) fails.push(`${perMin}/min < ${rule.minPerMin}`);
  if (rule.maxPerMin != null && perMin > rule.maxPerMin) fails.push(`${perMin}/min > ${rule.maxPerMin}`);
  if (rule.minPerRun != null && perRun < rule.minPerRun) fails.push(`${perRun}/run < ${rule.minPerRun}`);
  return {
    id: `events:${rule.kind}`,
    status: fails.length ? 'fail' : 'pass',
    detail: `${rule.bot || 'humanish'}: ${rule.kind} ${perMin}/min, ${perRun}/run${fails.length ? ' — ' + fails.join(', ') : ''}`,
    why: rule.why,
  };
}
