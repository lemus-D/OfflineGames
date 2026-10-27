/* Checks every profile shares. */

/** { bot, kind, minPerMin | maxPerMin | minPerRun, why } from expect.json. */
export function eventRule(m, rule, defaultKey) {
  const key = rule.bot || defaultKey;
  const bot = m[key];
  if (!bot) return { id: `events:${rule.kind}`, status: 'fail', detail: `no "${key}" matchup to measure`, why: rule.why };
  const perMin = bot.perMinute[rule.kind] ?? 0;
  const perRun = bot.perRun[rule.kind] ?? 0;
  const fails = [];
  if (rule.minPerMin != null && perMin < rule.minPerMin) fails.push(`${perMin}/min < ${rule.minPerMin}`);
  if (rule.maxPerMin != null && perMin > rule.maxPerMin) fails.push(`${perMin}/min > ${rule.maxPerMin}`);
  if (rule.minPerRun != null && perRun < rule.minPerRun) fails.push(`${perRun}/run < ${rule.minPerRun}`);
  return {
    id: `events:${rule.kind}`,
    status: fails.length ? 'fail' : 'pass',
    detail: `${key}: ${rule.kind} ${perMin}/min, ${perRun}/run${fails.length ? ' — ' + fails.join(', ') : ''}`,
    why: rule.why,
  };
}

export function invariantsCheck(m) {
  const violations = Object.values(m).flatMap((b) => b.violations);
  return {
    id: 'invariants',
    status: violations.length ? 'fail' : 'pass',
    detail: violations.length
      ? violations.slice(0, 3).map((v) => `seed ${v.seed} tick ${v.tick}: ${v.name}`).join('; ')
      : 'no violations in any bot run',
    why: 'States the game says can never happen.',
  };
}
