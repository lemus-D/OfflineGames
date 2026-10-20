#!/usr/bin/env node
/* Gate 0 of docs/QUALITY-BAR.md — the mechanical checks a game must pass
   before anyone plays it.

     node .cursor/skills/game-qc/scripts/check-game.mjs <GameDir> [--no-smoke]

   Zero dependencies. Prints ok:/warn:/FAIL: lines, exits 1 on any FAIL. */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const noSmoke = args.includes('--no-smoke');
const target = args.find((a) => !a.startsWith('--'));
if (!target) {
  console.error('usage: check-game.mjs <GameDir> [--no-smoke]');
  process.exit(2);
}

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const GAME = path.resolve(target);
const NAME = path.basename(GAME);

let failures = 0;
let warnings = 0;
const ok = (m) => console.log('ok:   ' + m);
const warn = (m) => {
  warnings += 1;
  console.log('warn: ' + m);
};
const fail = (m) => {
  failures += 1;
  console.error('FAIL: ' + m);
};
const check = (cond, m) => (cond ? ok(m) : fail(m));

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const rel = (f) => path.relative(GAME, f).split(path.sep).join('/');
const read = (f) => readFileSync(f, 'utf8');
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

if (!existsSync(GAME) || !statSync(GAME).isDirectory()) {
  console.error(`FAIL: ${target} is not a directory`);
  process.exit(1);
}

console.log(`\nGate 0 — ${NAME}\n`);

// --- House layout -----------------------------------------------------------

// Every game, whatever its genre, ships these.
const REQUIRED = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'server.js',
  'package.json',
  'smoke.mjs',
  'src/main.js',
  'src/core/rng.js',
  'src/core/save.js',
];
for (const f of REQUIRED) check(existsSync(path.join(GAME, f)), `present: ${f}`);

const files = walk(GAME);
const jsFiles = files.filter((f) => /\.(m?js)$/.test(f));
const srcFiles = jsFiles.filter((f) => rel(f).startsWith('src/'));

// The house layout for a real-time game. A turn-based game (Yes-General) may
// legitimately differ; the plan should say so, hence warnings not failures.
const EXPECTED = ['src/core/input.js', 'src/core/audio.js', 'src/game/play.js', 'src/game/draw.js'];
for (const f of EXPECTED) {
  if (existsSync(path.join(GAME, f))) ok(`present: ${f}`);
  else warn(`missing ${f} — expected by the house layout (AGENTS.md); fine only with a reason in the plan`);
}

const contentFiles = srcFiles.filter((f) => /\/content\.js$/.test(f));
check(contentFiles.length > 0, `content table module present (${contentFiles.map(rel).join(', ') || 'none'}) — content lives in data (standard 5)`);

const planFiles = readdirSync(GAME).filter((f) => /PLAN\.md$/i.test(f));
check(planFiles.length > 0, `plan file present (${planFiles.join(', ') || 'none'})`);

// --- Syntax -----------------------------------------------------------------

let syntaxBad = 0;
for (const f of jsFiles) {
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) {
    syntaxBad += 1;
    fail(`node --check ${rel(f)}\n${r.stderr.trim()}`);
  }
}
if (syntaxBad === 0) ok(`node --check passes on ${jsFiles.length} files`);

// --- Determinism ------------------------------------------------------------

const randomHits = srcFiles.filter((f) => /\bMath\.random\s*\(/.test(stripComments(read(f))));
check(randomHits.length === 0, `no Math.random() under src/${randomHits.length ? ' — ' + randomHits.map(rel).join(', ') : ''}`);

const usesRaf = srcFiles.some((f) => /requestAnimationFrame/.test(stripComments(read(f))));
const simSrc = srcFiles.map((f) => stripComments(read(f))).join('\n');
if (/FIXED_DT/.test(simSrc)) ok('FIXED_DT defined (fixed-timestep simulation)');
else if (usesRaf) warn('real-time frame loop but no FIXED_DT — the simulation should step on a fixed dt (D9)');
else ok('no frame loop found; fixed-timestep rule does not apply (turn-based)');

// --- Zero asset files -------------------------------------------------------

const ASSET_EXT = /\.(png|jpe?g|gif|webp|avif|bmp|ico|svg|mp3|wav|ogg|m4a|flac|aac|mp4|webm|woff2?|ttf|otf|eot)$/i;
const assets = files.filter((f) => ASSET_EXT.test(f));
check(assets.length === 0, `zero asset files${assets.length ? ' — ' + assets.map(rel).join(', ') : ''}`);

// --- Service worker precache -----------------------------------------------

const swPath = path.join(GAME, 'sw.js');
if (existsSync(swPath)) {
  const sw = read(swPath);
  const m = sw.match(/PRECACHE\s*=\s*\[([\s\S]*?)\]/);
  if (!m) fail('sw.js has no PRECACHE = [ ... ] array');
  else {
    const listed = [...m[1].matchAll(/['"`]([^'"`]+)['"`]/g)]
      .map((x) => x[1])
      .filter((p) => p !== './' && p !== '.' && p !== '/')
      .map((p) => p.replace(/^\.\//, ''));
    const shouldHave = ['index.html', 'manifest.webmanifest', ...srcFiles.map(rel)];
    const missing = shouldHave.filter((f) => !listed.includes(f));
    const stale = listed.filter((f) => !existsSync(path.join(GAME, f)));
    check(missing.length === 0, `sw.js precaches every shipped file${missing.length ? ' — missing: ' + missing.join(', ') : ''}`);
    check(stale.length === 0, `sw.js lists only files that exist${stale.length ? ' — stale: ' + stale.join(', ') : ''}`);
    const cache = sw.match(/CACHE\s*=\s*['"`]([^'"`]+)['"`]/);
    if (!cache) fail('sw.js has no versioned CACHE name');
    else if (!/-v\d+$/.test(cache[1])) warn(`CACHE name "${cache[1]}" is not versioned like "<game>-vN"`);
    else ok(`sw.js cache name versioned: ${cache[1]}`);
  }
}

// --- Saves ------------------------------------------------------------------

const savePath = path.join(GAME, 'src/core/save.js');
if (existsSync(savePath)) {
  const save = read(savePath);
  const prefixed = save.match(/['"`]([a-z0-9-]+)\.v(\d+)\./);
  check(!!prefixed, `save.js keys are namespaced and versioned (<game>.vN.)${prefixed ? ' — ' + prefixed[1] + '.v' + prefixed[2] + '.' : ''}`);
  check(/schema/.test(save), 'save.js profile carries a schema field');
  const leaks = srcFiles.filter((f) => f !== savePath && /localStorage/.test(stripComments(read(f))));
  check(leaks.length === 0, `localStorage touched only in save.js${leaks.length ? ' — also in: ' + leaks.map(rel).join(', ') : ''}`);
}

// --- Manifest ---------------------------------------------------------------

const manifestPath = path.join(GAME, 'manifest.webmanifest');
if (existsSync(manifestPath)) {
  try {
    const mf = JSON.parse(read(manifestPath));
    check(!!mf.name, 'manifest has name');
    check(!!mf.start_url, 'manifest has start_url');
    check(mf.display === 'standalone' || mf.display === 'fullscreen', `manifest display is standalone/fullscreen (${mf.display})`);
    const icons = Array.isArray(mf.icons) ? mf.icons : [];
    check(icons.length > 0, 'manifest has at least one icon');
    const badIcon = icons.find((i) => !(typeof i.src === 'string' && (i.src.startsWith('data:') || existsSync(path.join(GAME, i.src)))));
    check(!badIcon, 'manifest icons are data: URIs or existing files');
  } catch (e) {
    fail(`manifest.webmanifest is not valid JSON: ${e.message}`);
  }
}

// --- index.html / main.js ---------------------------------------------------

if (existsSync(path.join(GAME, 'index.html'))) {
  const html = read(path.join(GAME, 'index.html'));
  check(/rel=["']manifest["']/.test(html), 'index.html links the manifest');
  check(/<meta[^>]+name=["']viewport["']/.test(html), 'index.html has a viewport meta');
}
const allSrc = srcFiles.concat(existsSync(path.join(GAME, 'index.html')) ? [path.join(GAME, 'index.html')] : []);
check(allSrc.some((f) => /serviceWorker\.register/.test(read(f))), 'service worker is registered');

// --- package.json -----------------------------------------------------------

if (existsSync(path.join(GAME, 'package.json'))) {
  try {
    const pkg = JSON.parse(read(path.join(GAME, 'package.json')));
    check(pkg.scripts && pkg.scripts.start, 'package.json has start script');
    check(pkg.scripts && pkg.scripts.smoke, 'package.json has smoke script');
    check(!pkg.dependencies || Object.keys(pkg.dependencies).length === 0, 'package.json has no runtime dependencies');
    check(pkg.type === 'module', 'package.json is type: module');
  } catch (e) {
    fail(`package.json is not valid JSON: ${e.message}`);
  }
}

// --- Port uniqueness across the repo ---------------------------------------

const portOf = (serverJs) => {
  const m = read(serverJs).match(/\|\|\s*(\d{4,5})/);
  return m ? Number(m[1]) : null;
};
if (existsSync(path.join(GAME, 'server.js'))) {
  const mine = portOf(path.join(GAME, 'server.js'));
  if (mine == null) warn('could not read default port from server.js');
  else {
    const others = readdirSync(REPO)
      .filter((d) => !d.startsWith('.') && d !== NAME && existsSync(path.join(REPO, d, 'server.js')))
      .map((d) => ({ d, port: portOf(path.join(REPO, d, 'server.js')) }))
      .filter((x) => x.port === mine);
    check(others.length === 0, `default port ${mine} is unique in the repo${others.length ? ' — also used by ' + others.map((x) => x.d).join(', ') : ''}`);
  }
}

// --- Smoke ------------------------------------------------------------------

if (noSmoke) warn('smoke skipped (--no-smoke)');
else if (existsSync(path.join(GAME, 'smoke.mjs'))) {
  const r = spawnSync(process.execPath, ['smoke.mjs'], { cwd: GAME, encoding: 'utf8' });
  const lines = (r.stdout + r.stderr).trim().split('\n');
  check(r.status === 0, `npm run smoke exits 0 (${lines.length} lines)`);
  if (r.status !== 0) console.error(lines.filter((l) => /FAIL|Error/.test(l)).join('\n'));
  const smoke = stripComments(read(path.join(GAME, 'smoke.mjs')));
  const asserts = (smoke.match(/\bassert\s*\(/g) || []).length;
  if (asserts < 8) warn(`smoke.mjs has only ${asserts} asserts — it should drive PlaySession (determinism, idle-loses, progress, run-ends)`);
  else ok(`smoke.mjs has ${asserts} asserts`);
  const importsGame = /from\s+['"]\.\/src\/(game|data)\//.test(smoke);
  if (!importsGame) warn('smoke.mjs does not import from src/game/ — it should drive the simulation headlessly');
}

// --- Summary ----------------------------------------------------------------

console.log(`\n${failures === 0 ? 'Gate 0 PASS' : 'Gate 0 FAIL'} — ${failures} failure(s), ${warnings} warning(s)\n`);
process.exit(failures === 0 ? 0 : 1);
