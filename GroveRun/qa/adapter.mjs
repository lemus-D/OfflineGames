/* GroveRun ↔ tools/qa. Translates the game for the shared harness and holds
   no strategy — the bots find their own way through it.
   Contract: tools/qa/README.md. */

import { PlaySession } from '../src/game/play.js';
import { FIXED_DT, FOX, RUN } from '../src/game/content.js';

const CONTROLS = {
  none: { laneDelta: 0, jump: false },
  left: { laneDelta: -1, jump: false },
  right: { laneDelta: 1, jump: false },
  jump: { laneDelta: 0, jump: true },
};

/** GroveRun event → shared vocabulary. */
const EVENTS = {
  lane: 'input',
  jump: 'input',
  carrot: 'reward',
  hit: 'damage',
  threat: 'danger',
  die: 'death',
};

export default {
  profile: 'arcade',
  fixedDt: FIXED_DT,
  ticksPerDecision: 6, // ten decisions a second

  create: (seed) => new PlaySession(seed),

  actions(s) {
    const out = ['none', 'jump'];
    if (s.player.lane > -1) out.push('left');
    if (s.player.lane < 1) out.push('right');
    return out;
  },

  tick(s, action) {
    // step() clears edge inputs on the object it is given, so hand it a copy.
    s.step(FIXED_DT, { ...CONTROLS[action ?? 'none'] });
  },

  time: (s) => s.time,
  score: (s) => s.score,
  terminal: (s) => !s.player.alive,
  outcome: (s) => ({ result: 'death', cause: s.player.deathReason }),

  drainEvents: (s) => s.drainEvents(),
  mapEvent(raw) {
    const kind = EVENTS[raw.kind];
    if (!kind) return null;
    if (kind === 'damage') return { kind, cause: raw.kindObs };
    if (kind === 'death') return { kind, cause: raw.reason };
    return { kind };
  },

  observe: (s) => ({
    time: s.time,
    distance: s.distance,
    speed: s.speed,
    carrots: s.carrots,
    foxGap: s.foxGap,
    lane: s.player.lane,
    lanePos: s.player.lanePos,
    height: s.player.height,
    entities: s.entities.map((e) => [e.kind, e.lane, e.z]),
  }),

  invariants(s) {
    const p = s.player;
    const bad = [];
    if (![-1, 0, 1].includes(p.lane)) bad.push(`lane ${p.lane} is not a lane`);
    if (p.lanePos < -1 || p.lanePos > 1) bad.push(`lanePos ${p.lanePos} is off the path`);
    if (p.height < 0) bad.push('bunny below the ground');
    if (s.speed > RUN.maxSpeed) bad.push(`speed ${s.speed} above RUN.maxSpeed`);
    if (s.foxGap > FOX.maxGap) bad.push(`foxGap ${s.foxGap} above FOX.maxGap`);
    if (s.entities.length > 200) bad.push(`${s.entities.length} entities alive (leak?)`);
    return bad;
  },
};
