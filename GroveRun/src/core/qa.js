/* Test hook for tools/qa: replays, key-moment pauses, draw rects, events.
   Does nothing unless the page is opened with ?qa=1, so it ships harmlessly.
   Copied into each game as src/core/qa.js, like rng.js. See tools/qa/README.md. */

const enabled = typeof location !== 'undefined' && new URLSearchParams(location.search).has('qa');

let adapter = null;
let replay = null;
let rects = [];
let events = [];
let view = { state: () => 'unknown' };

export const qa = {
  enabled,

  /** main.js: how probes read the screen — state() is 'menu' | 'playing' | 'summary'. */
  expose(v) {
    view = v;
  },

  /** main.js, top of every frame. */
  beginFrame() {
    if (enabled) rects = [];
  },

  /** draw code: where something was drawn, in canvas CSS pixels.
      Roles: 'player', 'hazard', 'pickup', or any game role expect.json names. */
  rect(role, x, y, w, h) {
    if (enabled) rects.push({ role, x, y, w, h });
  },

  /** main.js, for each raw simulation event it drains. */
  record(raw) {
    if (!adapter) return;
    const ev = adapter.mapEvent(raw);
    if (ev) events.push(ev);
  },

  /** main.js, when a run starts: the seed to use. Starts an armed replay. */
  seed(fallback) {
    if (!replay) return fallback;
    Object.assign(replay, { running: true, tick: 0, acc: 0, paused: null });
    events = [];
    return replay.seed;
  },

  /** main.js, when a run starts in a game with variants (e.g. AI difficulty):
      the variant to use. The armed replay's variant wins. */
  variant(fallback) {
    return replay && replay.variant != null ? replay.variant : fallback;
  },

  replaying() {
    return !!replay && replay.running;
  },

  /** Animation clock. During a replay it follows ticks, so a paused frame is
      identical between builds. */
  clock(fallback) {
    return this.replaying() ? replay.tick * adapter.fixedDt : fallback;
  },

  /** main.js, instead of session.step(), while replaying. */
  step(session, dt) {
    const r = replay;
    if (r.paused !== null || adapter.terminal(session)) return;
    r.acc += Math.min(dt, 0.05) * r.speed;
    while (r.acc >= adapter.fixedDt && !adapter.terminal(session)) {
      r.acc -= adapter.fixedDt;
      adapter.tick(session, r.inputs.has(r.tick) ? r.inputs.get(r.tick) : null);
      r.tick += 1;
      if (r.pauseAt.has(r.tick)) {
        r.paused = r.tick;
        r.acc = 0;
        break;
      }
    }
  },
};

if (enabled) {
  window.__qa = {
    ready: false,
    arm({ seed, variant = null, inputs = [], pauseAt = [], speed = 1 }) {
      replay = { seed, variant, inputs: new Map(inputs), pauseAt: new Set(pauseAt), speed, running: false, tick: 0, acc: 0, paused: null };
    },
    disarm() {
      replay = null;
      events = [];
    },
    paused: () => (replay ? replay.paused : null),
    resume() {
      if (replay) replay.paused = null;
    },
    rects: () => rects.slice(),
    events: () => events.slice(),
    state: () => view.state(),
  };
  import('../../qa/adapter.mjs').then((m) => {
    adapter = m.default;
    window.__qa.ready = true;
  });
}
