/* Tier 2: drive the real page in Chromium.

   Some checks need nothing but the page (console errors, blank canvas,
   layout, frame time, audio, offline). The rest go through the game's
   src/core/qa.js hook and two attributes in index.html:

     [data-qa=start]  the button that starts a run — clicked for real, so
                      audio unlocks exactly as it does for a player
     [data-qa=hud]    the in-run HUD overlay
     window.__qa      arm/resume a replay, rects, events, screen state

   Key moments are replays of a Node bot run (same seed, same inputs), paused
   on exact ticks, so screenshots from two builds pair up frame for frame. */

import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { chromium } from 'playwright';

import { requiredInputs } from './lib/brief.mjs';
import { decodePng, imageStats } from './lib/png.mjs';

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  portrait: { width: 390, height: 844 },
  landscape: { width: 844, height: 390 },
};

/** Taps every input-family probe tries, as fractions of the viewport. */
const DEFAULT_TAPS = [
  [0.15, 0.75],
  [0.85, 0.75],
  [0.5, 0.25],
];
const DEFAULT_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'KeyA', 'KeyD', 'KeyW', 'Enter'];

/** Taps every AudioContext that reaches its destination and records peak RMS. */
const AUDIO_TAP = `(() => {
  window.__qaAudio = { contexts: [], peak: 0 };
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    const result = connect.call(this, dest, ...rest);
    if (dest instanceof AudioDestinationNode) {
      const ctx = this.context;
      if (!ctx.__qaTap) {
        const tap = ctx.createAnalyser();
        tap.fftSize = 2048;
        ctx.__qaTap = tap;
        window.__qaAudio.contexts.push(ctx);
        const buf = new Float32Array(tap.fftSize);
        setInterval(() => {
          tap.getFloatTimeDomainData(buf);
          let sum = 0;
          for (const v of buf) sum += v * v;
          window.__qaAudio.peak = Math.max(window.__qaAudio.peak, Math.sqrt(sum / buf.length));
        }, 40);
      }
      connect.call(this, ctx.__qaTap);
    }
    return result;
  };
})();`;

export async function runProbes({ gameDir, brief, expect, adapter, replays, outDir }) {
  const checks = [];
  const consoleErrors = [];
  const add = (id, status, detail, why) => checks.push({ id, status, detail, why });
  const inputs = requiredInputs(brief);
  const fixedDt = adapter.fixedDt;

  const server = await startServer(gameDir);
  const browser = await launch();
  const ctx = { browser, url: server.url, consoleErrors };

  // Each probe is isolated: one crashing probe reports itself and the rest still run.
  const probe = async (id, why, fn) => {
    try {
      await fn();
    } catch (err) {
      add(id, 'fail', `probe could not finish: ${String(err.message || err).split('\n')[0]}`, why);
    }
  };

  let moments = [];
  try {
    const layoutIssues = [];

    await probe('qa-hook', 'Everything below needs the page and its ?qa=1 hook.', async () => {
      const { page, context } = await openPage(ctx, { viewport: VIEWPORTS.desktop });
      add('qa-hook', 'pass', 'page boots and window.__qa is ready');

      await sleep(800);
      blankCheck(add, 'canvas-drawn:menu', await canvasStats(page));
      layoutIssues.push(...tagged('desktop/menu', await layoutProblems(page)));

      // A long-lived run (the strong bot's) to look at real play.
      const long = replays.searcher || replays.humanish;
      await startRun(page, { seed: long.seed, inputs: long.inputs, speed: 1 });
      await sleep(1500);
      blankCheck(add, 'canvas-drawn:play', await canvasStats(page));
      layoutIssues.push(...tagged('desktop/playing', await layoutProblems(page)));

      const cleared = await clearsEachFrame(page);
      add(
        'clears-each-frame',
        cleared.skipped ? 'skip' : cleared.left === 0 ? 'pass' : 'fail',
        cleared.skipped || `${cleared.left}/${cleared.total} marker pixels survived three frames`,
        'A canvas that is not fully repainted each frame smears moving sprites into ghosts.'
      );

      await sleep(1500);
      if (/^none$/i.test(brief.sound || '')) add('audio', 'skip', 'brief says sound: none');
      else {
        const audio = await page.evaluate(() => ({
          states: window.__qaAudio.contexts.map((c) => c.state),
          peak: window.__qaAudio.peak,
        }));
        const running = audio.states.includes('running');
        add(
          'audio',
          running && audio.peak > 0.003 ? 'pass' : 'fail',
          `contexts: [${audio.states.join(', ') || 'none'}], peak RMS ${audio.peak.toFixed(4)} after 3 s of play`,
          'Sound should be audible after the first tap, without the player doing anything special.'
        );
      }

      const frames = await frameTimes(page, expect.cpuThrottle ?? 4);
      const limit = expect.frameP95Ms ?? 50;
      add(
        'frame-time',
        frames.p95 <= limit ? 'pass' : frames.p95 <= limit * 1.5 ? 'warn' : 'fail',
        `p50 ${frames.p50} ms, p95 ${frames.p95} ms, ${frames.longPct}% frames > 50 ms at ${expect.cpuThrottle ?? 4}× CPU throttle (limit p95 ${limit} ms)`,
        'Jank under a slow phone CPU is what players feel as lag.'
      );
      await context.close();
    });

    const shapes = /portrait/i.test(brief.orientation || '')
      ? ['portrait']
      : /landscape/i.test(brief.orientation || '')
        ? ['landscape']
        : ['portrait', 'landscape'];
    for (const shape of ['desktop', ...shapes]) {
      await probe(`layout:${shape}`, 'Layout pass at this viewport.', async () => {
        layoutIssues.push(...(await layoutPass(ctx, shape, shape !== 'desktop')));
      });
    }
    add(
      'layout',
      layoutIssues.length ? 'fail' : 'pass',
      layoutIssues.length ? layoutIssues.slice(0, 8).join('; ') : `menu, play and summary fit at desktop, ${shapes.join(', ')}`,
      'Clipped, scrolling or off-screen UI (the Apex shop rows were this).'
    );

    if (inputs.keyboard) {
      await probe('keyboard-input', 'Brief requires keyboard.', async () => {
        const { page, context } = await openPage(ctx, { viewport: VIEWPORTS.desktop });
        await startRun(page, null);
        for (const key of expect.keys || DEFAULT_KEYS) {
          await page.keyboard.press(key);
          await sleep(150);
        }
        inputCheck(add, 'keyboard-input', await page.evaluate(() => window.__qa.events()), 'keys');
        await context.close();
      });
    }
    if (inputs.touch) {
      await probe('touch-input', 'Brief requires touch.', async () => {
        const { page, context } = await openPage(ctx, { viewport: VIEWPORTS.portrait, touch: true });
        await startRun(page, null, { touch: true });
        for (const [fx, fy] of expect.taps || DEFAULT_TAPS) {
          await page.touchscreen.tap(Math.round(fx * VIEWPORTS.portrait.width), Math.round(fy * VIEWPORTS.portrait.height));
          await sleep(250);
        }
        inputCheck(add, 'touch-input', await page.evaluate(() => window.__qa.events()), 'taps');
        await context.close();
      });
    }

    if (replays.humanish) {
      await probe('moments', 'Key-moment screenshots for the critic and A/B pairing.', async () => {
        const viewport = inputs.touch ? VIEWPORTS.portrait : VIEWPORTS.desktop;
        const result = await captureMoments(ctx, replays.humanish, fixedDt, viewport, inputs.touch, outDir);
        moments = result.moments;
        add(
          'replay-matches',
          result.mismatches.length ? 'fail' : 'pass',
          result.mismatches.length
            ? `browser and Node disagree: ${result.mismatches.join('; ')}`
            : `browser replay of seed ${replays.humanish.seed} matched the Node run at ${result.frames.length} paused frames`,
          'If the browser does not replay the bot run exactly, the key-moment frames are not comparable.'
        );
        const rules = [
          { rule: 'onScreen', role: 'player' },
          { rule: 'minSize', role: 'player', px: expect.minSpritePx ?? 24 },
          { rule: 'hudClear', role: 'player' },
          ...(expect.rects || []),
        ];
        for (const rule of rules) checks.push(rectRule(rule, result.frames));
      });
    }

    await probe('offline', 'Installed games must boot with no network.', async () => {
      const stats = await offlineBoot(ctx);
      add(
        'offline',
        stats && stats.lumStd >= 0.02 && stats.distinctColours >= 4 ? 'pass' : 'fail',
        stats ? `after server-kill-equivalent reload: lumStd ${stats.lumStd}, ${stats.distinctColours} colours` : 'no canvas after offline reload',
        'Second launch with no network is the whole product promise.'
      );
    });

    add(
      'console-clean',
      consoleErrors.length ? 'fail' : 'pass',
      consoleErrors.length ? consoleErrors.slice(0, 5).join(' | ') : 'no console errors or page errors in any probe',
      'Errors in the console are bugs a player hits before we do.'
    );
  } finally {
    await browser.close();
    server.stop();
  }
  return { checks, moments };
}

// --- page plumbing ----------------------------------------------------------

async function launch() {
  try {
    return await chromium.launch({ channel: 'chrome' });
  } catch {
    return chromium.launch();
  }
}

async function freePort() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

/** Every game's server.js takes the port as its first argument. */
async function startServer(gameDir) {
  const port = await freePort();
  const child = spawn(process.execPath, ['server.js', String(port)], { cwd: gameDir, stdio: 'ignore' });
  const url = `http://localhost:${port}/`;
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(url)).ok) return { url, stop: () => child.kill() };
    } catch {
      // not listening yet
    }
    await sleep(100);
  }
  child.kill();
  throw new Error(`dev server in ${gameDir} did not start`);
}

async function openPage(ctx, { viewport, touch = false, qa = true }) {
  const context = await ctx.browser.newContext({ viewport, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
  await context.addInitScript(AUDIO_TAP);
  const page = await context.newPage();
  const where = `${viewport.width}×${viewport.height}`;
  page.on('console', (m) => {
    if (m.type() === 'error') ctx.consoleErrors.push(`${where}: ${m.text()}`);
  });
  page.on('pageerror', (e) => ctx.consoleErrors.push(`${where}: ${e.message}`));
  await page.goto(qa ? `${ctx.url}?qa=1` : ctx.url);
  if (qa) await page.waitForFunction(() => window.__qa?.ready === true, null, { timeout: 10000 });
  return { context, page };
}

/** Arm a replay (or none, for real input), then press the real start button. */
async function startRun(page, replay, { touch = false } = {}) {
  await page.evaluate((r) => (r ? window.__qa.arm(r) : window.__qa.disarm()), replay);
  const start = page.locator('[data-qa=start]').first();
  if (touch) await start.tap();
  else await start.click();
  await waitState(page, 'playing', 5000);
}

function waitState(page, state, timeout) {
  return page.waitForFunction((s) => window.__qa.state() === s, state, { timeout });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function tagged(where, issues) {
  return issues.map((i) => `${where}: ${i}`);
}

// --- generic checks ---------------------------------------------------------

async function canvasStats(page) {
  const handle = await page.evaluateHandle(
    () =>
      [...document.querySelectorAll('canvas')].sort(
        (a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight
      )[0] || null
  );
  const el = handle.asElement();
  return el ? imageStats(decodePng(await el.screenshot())) : null;
}

function blankCheck(add, id, stats) {
  let status = 'pass';
  let detail = stats ? `lumStd ${stats.lumStd}, ${stats.distinctColours} colours, ${Math.round(stats.nearBlack * 100)}% near-black` : 'no canvas';
  if (!stats || stats.lumStd < 0.02 || stats.distinctColours < 4) status = 'fail';
  else if (stats.nearBlack > 0.97) status = 'fail';
  add(id, status, detail, 'A blank or black canvas (Break\'s black table was this).');
}

/** Paint magenta markers straight onto the canvas; a full repaint erases them. */
async function clearsEachFrame(page) {
  return page.evaluate(async () => {
    const c = [...document.querySelectorAll('canvas')].sort(
      (a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight
    )[0];
    const g = c && c.getContext('2d');
    if (!g) return { skipped: 'no 2D canvas' };
    const points = [
      [0.1, 0.1],
      [0.5, 0.5],
      [0.9, 0.9],
    ].map(([fx, fy]) => [Math.floor(c.width * fx), Math.floor(c.height * fy)]);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#ff00ff';
    for (const [x, y] of points) g.fillRect(x - 3, y - 3, 6, 6);
    g.restore();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))));
    const left = points.filter(([x, y]) => {
      const d = g.getImageData(x, y, 1, 1).data;
      return d[0] > 240 && d[1] < 20 && d[2] > 240;
    }).length;
    return { left, total: points.length };
  });
}

/** Visible UI that is off-screen, or clipped / scrolling inside its box. */
async function layoutProblems(page) {
  return page.evaluate(() => {
    const out = [];
    const vw = innerWidth;
    const vh = innerHeight;
    const name = (el) => el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + (el.classList[0] ? `.${el.classList[0]}` : '');
    for (const el of document.querySelectorAll('body *')) {
      if (el.tagName === 'CANVAS' || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
      if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const hasText =
        el.tagName === 'BUTTON' || [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (hasText && (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1)) {
        out.push(`${name(el)} off-screen`);
      }
      const cs = getComputedStyle(el);
      const clips = /(hidden|auto|scroll|clip)/.test(cs.overflowX + cs.overflowY);
      if (clips && (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2)) {
        out.push(`${name(el)} content clipped or needs scrolling (${el.scrollHeight}px in ${el.clientHeight}px)`);
      }
    }
    return out;
  });
}

async function layoutPass(ctx, shape, touch) {
  const { page, context } = await openPage(ctx, { viewport: VIEWPORTS[shape], touch });
  const issues = [];
  if (shape !== 'desktop') issues.push(...tagged(`${shape}/menu`, await layoutProblems(page)));
  // The idle bot reaches the summary screen quickly.
  await startRun(page, { seed: 1, inputs: [], speed: 8 }, { touch });
  await sleep(300);
  if (shape !== 'desktop') issues.push(...tagged(`${shape}/playing`, await layoutProblems(page)));
  try {
    await waitState(page, 'summary', 60000);
    await sleep(400);
    issues.push(...tagged(`${shape}/summary`, await layoutProblems(page)));
  } catch {
    issues.push(`${shape}/summary: not reached in 60 s with no input (not checked)`);
  }
  await context.close();
  return issues;
}

async function frameTimes(page, rate) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  const deltas = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const out = [];
        let last = 0;
        const end = performance.now() + 5000;
        const frame = (t) => {
          if (last) out.push(t - last);
          last = t;
          if (t < end) requestAnimationFrame(frame);
          else resolve(out);
        };
        requestAnimationFrame(frame);
      })
  );
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const sorted = deltas.sort((a, b) => a - b);
  const at = (p) => Math.round(sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] * 10) / 10;
  return { p50: at(0.5), p95: at(0.95), longPct: Math.round((100 * deltas.filter((d) => d > 50).length) / deltas.length) };
}

function inputCheck(add, id, events, what) {
  const n = events.filter((e) => e.kind === 'input').length;
  add(
    id,
    n >= 2 ? 'pass' : 'fail',
    `${n} input events from scripted ${what}`,
    'The brief\'s required input family has to actually move the game.'
  );
}

async function offlineBoot(ctx) {
  const { page, context } = await openPage(ctx, { viewport: VIEWPORTS.desktop, qa: false });
  await page.evaluate(() => navigator.serviceWorker?.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 10000 });
  await context.setOffline(true);
  await page.reload();
  await sleep(1000);
  const stats = await canvasStats(page);
  await context.close();
  return stats;
}

// --- key moments ------------------------------------------------------------

/** Ticks worth a screenshot, from the Node bot run's events. */
function pickMoments(replay, fixedDt) {
  const first = (kind) => replay.events.find((e) => e.kind === kind);
  // An event logged at tick k happened during the (k+1)th tick.
  const after = (ev, frames) => ev && ev.tick + 1 + frames;
  const wanted = [
    { name: 'early', tick: Math.round(3 / fixedDt) },
    { name: 'first-reward', tick: after(first('reward'), 2) },
    { name: 'first-damage', tick: after(first('damage'), 2) },
    { name: 'first-danger', tick: after(first('danger'), 0) },
    { name: 'before-end', tick: (first('death') || first('lose') || first('win'))?.tick },
  ];
  const seen = new Set();
  return wanted.map((m) => {
    if (m.tick == null) return { name: m.name, note: 'did not happen in this run' };
    if (m.tick > replay.ticks) return { name: m.name, note: 'too close to the end of the run' };
    if (seen.has(m.tick)) return { name: m.name, note: 'same frame as an earlier moment' };
    seen.add(m.tick);
    return m;
  });
}

async function captureMoments(ctx, replay, fixedDt, viewport, touch, outDir) {
  mkdirSync(path.join(outDir, 'moments'), { recursive: true });
  const moments = pickMoments(replay, fixedDt);
  const timed = moments.filter((m) => m.tick != null && !m.note).sort((a, b) => a.tick - b.tick);
  const frames = [];
  const mismatches = [];

  const { page, context } = await openPage(ctx, { viewport, touch });
  await startRun(page, { seed: replay.seed, inputs: replay.inputs, pauseAt: timed.map((m) => m.tick), speed: 8 }, { touch });
  for (const m of timed) {
    await page.waitForFunction((t) => window.__qa.paused() === t, m.tick, { timeout: 120000 });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    m.file = `moments/${m.name}.png`;
    await page.screenshot({ path: path.join(outDir, m.file) });
    const info = await page.evaluate(() => {
      const c = [...document.querySelectorAll('canvas')].sort(
        (a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight
      )[0];
      const cr = c.getBoundingClientRect();
      const box = (r) => ({ x: r.x, y: r.y, w: r.width, h: r.height });
      const hud = [...document.querySelectorAll('[data-qa=hud] > *')]
        .filter((el) => el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
        .map((el) => box(el.getBoundingClientRect()))
        .filter((r) => r.w && r.h);
      return {
        viewport: { w: innerWidth, h: innerHeight },
        canvas: box(cr),
        rects: window.__qa.rects(),
        hud,
        eventCount: window.__qa.events().length,
      };
    });
    const expected = replay.events.filter((e) => e.tick < m.tick).length;
    if (info.eventCount !== expected) mismatches.push(`${m.name}: ${info.eventCount} events in browser, ${expected} in Node`);
    frames.push({ name: m.name, ...info });
    await page.evaluate(() => window.__qa.resume());
  }

  const ended = moments.find((m) => m.name === 'before-end' && m.file);
  if (ended) {
    try {
      await waitState(page, 'summary', 30000);
      await sleep(400);
      await page.screenshot({ path: path.join(outDir, 'moments/summary.png') });
      moments.push({ name: 'summary', tick: null, file: 'moments/summary.png' });
    } catch {
      mismatches.push('run did not end in the browser where it ended in Node');
    }
  }
  await context.close();
  return { moments, frames, mismatches };
}

/** Rules about where things are drawn, checked at every key moment. */
function rectRule(rule, frames) {
  const subject = rule.role || `${rule.a}-${rule.b}`;
  const violations = [];
  let evaluated = 0;
  for (const f of frames) {
    const of = (role) =>
      f.rects.filter((r) => r.role === role).map((r) => ({ ...r, x: r.x + f.canvas.x, y: r.y + f.canvas.y }));
    const centre = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
    if (rule.rule === 'visible') {
      evaluated += 1;
      if (!of(rule.role).length) violations.push(`${f.name}: not drawn`);
    } else if (rule.rule === 'onScreen' || rule.rule === 'minSize' || rule.rule === 'hudClear') {
      for (const r of of(rule.role)) {
        evaluated += 1;
        if (rule.rule === 'onScreen' && (r.x < 0 || r.y < 0 || r.x + r.w > f.viewport.w || r.y + r.h > f.viewport.h)) {
          violations.push(`${f.name}: partly off-screen`);
        }
        if (rule.rule === 'minSize' && Math.min(r.w, r.h) < rule.px) {
          violations.push(`${f.name}: ${Math.round(Math.min(r.w, r.h))} px`);
        }
        if (rule.rule === 'hudClear' && f.hud.some((h) => overlaps(r, h))) violations.push(`${f.name}: under the HUD`);
      }
    } else {
      const b = of(rule.b)[0];
      if (!b) continue;
      evaluated += 1;
      const a = of(rule.a)[0];
      if (!a) {
        violations.push(`${f.name}: ${rule.a} not drawn`);
        continue;
      }
      const ca = centre(a);
      const cb = centre(b);
      const holds =
        rule.rule === 'below' ? ca.y > cb.y : rule.rule === 'above' ? ca.y < cb.y : rule.rule === 'leftOf' ? ca.x < cb.x : ca.x > cb.x;
      if (!holds) violations.push(`${f.name}: ${rule.a} is not ${rule.rule} ${rule.b}`);
    }
  }
  return {
    id: `draw:${rule.rule}:${subject}`,
    status: !evaluated ? 'skip' : violations.length ? 'fail' : 'pass',
    detail: !evaluated
      ? `nothing to check — no "${rule.role || rule.b}" rects at the key moments`
      : violations.length
        ? violations.join('; ')
        : `holds at ${frames.length} key moments${rule.px ? ` (min ${rule.px} px)` : ''}`,
    why: rule.why || RULE_WHY[rule.rule],
  };
}

const RULE_WHY = {
  onScreen: 'The player has to be on screen to be played.',
  minSize: 'Sprites too small to read (Apex needed two zoom fixes for this).',
  hudClear: 'HUD covering the player hides the thing being controlled.',
  visible: 'Something the pitch promises should be on screen.',
};

function overlaps(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
