#!/usr/bin/env node
/* Side-by-side compare of two QA runs of the same game.

     node tools/qa/compare.mjs <Game> <before> <after>

   <before>/<after> are run labels (folders under tools/qa/out/<Game>/,
   usually short shas). Writes tools/qa/out/<Game>/compare/<before>__<after>/:

     compare.md      checks that changed, before → after numbers, image list
     pairs/*.png     one image per key moment: before on the left, after on
                     the right — what a critic compares pairwise
     index.html      the same for a human, in a browser

   Pairs are exact (same instant of the same play) when both runs were fed
   the same inputs — always true for a drawing-only change, and true for any
   change when <after> was run with --replay-from <before>. compare.md says
   which it was. */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readPng, sideBySide } from './lib/image.mjs';
import { encodePng } from './lib/png.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Numbers worth a before → after line, per profile. */
const NUMBERS = {
  arcade: [
    ['seconds p50', (m) => m.seconds.p50],
    ['score p50', (m) => m.score.p50],
    ['reward/min', (m) => m.perMinute.reward ?? 0],
    ['damage/min', (m) => m.perMinute.damage ?? 0],
    ['danger/min', (m) => m.perMinute.danger ?? 0],
  ],
  turn: [
    ['turns p50', (m) => m.decisions.p50],
    ['first seat won', (m) => m.winRate],
  ],
};

export function compare(game, before, after) {
  const base = path.join(HERE, 'out', game);
  const load = (label) => {
    const file = path.join(base, label, 'results.json');
    if (!existsSync(file)) throw new Error(`no QA run "${label}" for ${game} — run tools/qa/run.mjs first`);
    return JSON.parse(readFileSync(file, 'utf8'));
  };
  const A = load(before);
  const B = load(after);
  const outDir = path.join(base, 'compare', `${before}__${after}`);
  mkdirSync(path.join(outDir, 'pairs'), { recursive: true });

  // Checks whose status moved.
  const statusOf = (r) => Object.fromEntries(r.checks.map((c) => [c.id, c]));
  const a = statusOf(A);
  const b = statusOf(B);
  const changed = [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter((id) => a[id]?.status !== b[id]?.status)
    .map((id) => ({ id, before: a[id]?.status ?? '—', after: b[id]?.status ?? '—', detail: b[id]?.detail ?? a[id]?.detail ?? '' }));
  const regressions = changed.filter((c) => c.after === 'fail').length;
  const fixes = changed.filter((c) => c.before === 'fail' && c.after === 'pass').length;

  // Before → after numbers for every matchup both runs measured.
  const numbers = [];
  if (A.metrics && B.metrics) {
    for (const key of Object.keys(B.metrics).filter((k) => A.metrics[k])) {
      for (const [label, get] of NUMBERS[B.profile] || []) {
        const x = get(A.metrics[key]);
        const y = get(B.metrics[key]);
        if (x !== y) numbers.push({ key, label, before: x, after: y });
      }
    }
  }

  // Pairs are exact only when both builds were fed the same inputs.
  const same = JSON.stringify(A.replays?.moments?.inputs) === JSON.stringify(B.replays?.moments?.inputs);
  const inputs = same
    ? 'identical — each pair is the same instant of the same play'
    : `different — the bot played differently in ${after}. Pairs show the same seed and moment type, not the same play. For exact pairs re-run ${after} with --replay-from ${before}`;

  // One composited image per key moment both runs captured.
  const pairs = [];
  const shotsA = Object.fromEntries((A.moments || []).filter((m) => m.file).map((m) => [m.name, m.file]));
  for (const m of B.moments || []) {
    if (!m.file || !shotsA[m.name]) {
      pairs.push({ name: m.name, note: m.file ? `only in ${after}` : m.note || 'not captured' });
      continue;
    }
    const file = `pairs/${m.name}.png`;
    const left = readPng(path.join(base, before, shotsA[m.name]));
    const right = readPng(path.join(base, after, m.file));
    writeFileSync(path.join(outDir, file), encodePng(sideBySide(left, right)));
    pairs.push({ name: m.name, file, a: `../../${before}/${shotsA[m.name]}`, b: `../../${after}/${m.file}` });
  }

  writeFileSync(path.join(outDir, 'compare.md'), markdown({ game, before, after, changed, regressions, fixes, numbers, pairs, inputs }));
  writeFileSync(path.join(outDir, 'index.html'), html({ game, before, after, changed, numbers, pairs, inputs }));
  return { outDir, regressions, fixes, changed, numbers, pairs, same };
}

function markdown({ game, before, after, changed, regressions, fixes, numbers, pairs, inputs }) {
  const lines = [`# Compare — ${game}: ${before} → ${after}`, ''];
  lines.push(`${fixes} check(s) fixed, ${regressions} newly failing.`, '');
  lines.push('## Checks that changed', '');
  if (!changed.length) lines.push('None.', '');
  else {
    lines.push('| Check | Before | After | Now |', '|---|---|---|---|');
    for (const c of changed) lines.push(`| ${c.id} | ${c.before} | ${c.after} | ${esc(c.detail)} |`);
    lines.push('');
  }
  lines.push('## Numbers that moved', '');
  if (!numbers.length) lines.push('None (or one run had no bot tier).', '');
  else {
    lines.push('| Matchup | Measure | Before | After |', '|---|---|---|---|');
    for (const n of numbers) lines.push(`| ${n.key} | ${n.label} | ${fmt(n.before)} | ${fmt(n.after)} |`);
    lines.push('');
  }
  lines.push('## Key-moment pairs', '');
  lines.push(`Each image: **${before} on the left, ${after} on the right**. Inputs: ${inputs}.`, '');
  for (const p of pairs) lines.push(`- ${p.name}: ${p.file || p.note}`);
  lines.push('');
  return lines.join('\n');
}

function html({ game, before, after, changed, numbers, pairs, inputs }) {
  const rows = (list, cells) => list.map((x) => `<tr>${cells(x).map((c) => `<td>${escHtml(c)}</td>`).join('')}</tr>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(game)} compare</title>
<style>
  :root { --bg: #f6f5f2; --ink: #1d1d1f; --muted: #6b6b70; --line: #ddd9d2; --fail: #b3261e; --pass: #1e7a3c; }
  @media (prefers-color-scheme: dark) { :root { --bg: #151517; --ink: #ececee; --muted: #9a9aa0; --line: #2c2c30; --fail: #ff6b60; --pass: #5fd08a; } }
  body { margin: 0; padding: 24px 16px; background: var(--bg); color: var(--ink); font: 15px/1.5 system-ui, sans-serif; }
  main { max-width: 1200px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 4px; } h2 { font-size: 16px; margin: 32px 0 8px; }
  p { color: var(--muted); margin: 0; }
  table { border-collapse: collapse; width: 100%; } td, th { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .pair figure { margin: 0; } .pair img { width: 100%; height: auto; border: 1px solid var(--line); }
  figcaption { color: var(--muted); font-size: 13px; }
</style>
</head>
<body>
<main>
  <h1>${escHtml(game)}: ${escHtml(before)} → ${escHtml(after)}</h1>
  <p>Left is ${escHtml(before)}, right is ${escHtml(after)}. Inputs: ${escHtml(inputs)}.</p>
  <h2>Checks that changed</h2>
  ${changed.length ? `<table><tr><th>Check</th><th>Before</th><th>After</th><th>Now</th></tr>${rows(changed, (c) => [c.id, c.before, c.after, c.detail])}</table>` : '<p>None.</p>'}
  <h2>Numbers that moved</h2>
  ${numbers.length ? `<table><tr><th>Matchup</th><th>Measure</th><th>Before</th><th>After</th></tr>${rows(numbers, (n) => [n.key, n.label, fmt(n.before), fmt(n.after)])}</table>` : '<p>None.</p>'}
  ${pairs
    .map((p) =>
      p.file
        ? `<h2>${escHtml(p.name)}</h2><div class="pair"><figure><img src="${p.a}" alt="${escHtml(p.name)} before"><figcaption>${escHtml(before)}</figcaption></figure><figure><img src="${p.b}" alt="${escHtml(p.name)} after"><figcaption>${escHtml(after)}</figcaption></figure></div>`
        : `<h2>${escHtml(p.name)}</h2><p>${escHtml(p.note)}</p>`
    )
    .join('\n  ')}
</main>
</body>
</html>
`;
}

function fmt(x) {
  return typeof x === 'number' ? String(Math.round(x * 100) / 100) : String(x);
}

function esc(s) {
  return String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function escHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [game, before, after] = process.argv.slice(2);
  if (!game || !before || !after) {
    console.error('usage: node tools/qa/compare.mjs <Game> <before-label> <after-label>');
    process.exit(2);
  }
  const r = compare(game, before, after);
  console.log(`${r.fixes} fixed, ${r.regressions} newly failing, ${r.numbers.length} numbers moved, ${r.pairs.filter((p) => p.file).length} image pairs (${r.same ? 'identical inputs' : 'different inputs'})`);
  console.log(`compare: ${path.relative(process.cwd(), path.join(r.outDir, 'compare.md'))}`);
  console.log(`browser: ${path.relative(process.cwd(), path.join(r.outDir, 'index.html'))}`);
}
