/* report.md — the compact summary an agent (or the owner) reads instead of
   the raw results.json. Kept short on purpose: it goes into LLM context. */

const MARK = { pass: 'PASS', fail: 'FAIL', warn: 'WARN', skip: 'skip' };

export function renderReport({ game, label, profile, brief, runBand, seeds, checks, metrics, moments }) {
  const lines = [];
  const failed = checks.filter((c) => c.status === 'fail').length;
  lines.push(`# QA — ${game} @ ${label}`);
  lines.push('');
  lines.push(
    `Profile: ${profile} · run_band: ${runBand ? `${runBand[0]}–${runBand[1]} s` : 'not in brief'} · ` +
      `inputs: ${brief.inputs || '—'} · seeds per bot: ${seeds}`
  );
  lines.push(`Result: **${failed ? `${failed} failing check(s)` : 'all checks pass'}**`);
  lines.push('');

  lines.push('## Checks');
  lines.push('');
  lines.push('| | Check | Detail | Why it matters |');
  lines.push('|---|---|---|---|');
  for (const c of checks) {
    lines.push(`| ${MARK[c.status]} | ${c.id} | ${esc(c.detail)} | ${esc(c.why || '')} |`);
  }
  lines.push('');

  if (metrics) {
    const kinds = [...new Set(Object.values(metrics).flatMap((m) => Object.keys(m.perMinute)))].sort();
    lines.push('## Bots');
    lines.push('');
    lines.push(`| Bot | Seconds p10 / p50 / p90 | Score p50 | How runs ended | ${kinds.map((k) => `${k}/min`).join(' | ')} |`);
    lines.push(`|---|---|---|---|${kinds.map(() => '---').join('|')}|`);
    for (const [bot, m] of Object.entries(metrics)) {
      const ends = Object.entries(m.ends)
        .map(([k, n]) => `${k} ×${n}`)
        .join(', ');
      const secs = [m.seconds.p10, m.seconds.p50, m.seconds.p90].map((x) => Math.round(x)).join(' / ');
      lines.push(`| ${bot} | ${secs} | ${m.score.p50} | ${ends} | ${kinds.map((k) => m.perMinute[k] ?? 0).join(' | ')} |`);
    }
    lines.push('');
  }

  if (moments?.length) {
    lines.push('## Key moments');
    lines.push('');
    lines.push('Same seed and inputs every round, so these frames pair up exactly across builds.');
    lines.push('');
    lines.push('| Moment | Tick | Screenshot |');
    lines.push('|---|---|---|');
    for (const m of moments) lines.push(`| ${m.name} | ${m.tick ?? '—'} | ${m.file || m.note || '—'} |`);
    lines.push('');
  }

  return lines.join('\n');
}

function esc(s) {
  return String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
