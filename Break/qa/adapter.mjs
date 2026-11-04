/* Break ↔ tools/qa. Translates the game for the shared harness and holds
   no strategy — the bots choose among plain aimed shots.
   Contract: tools/qa/README.md.

   One seat: the bot is the player; the opponent is Break's own AI, played
   inside tick() exactly as main.js plays it (chooseAiShot on session.rng),
   minus the think delay. Variants are the AI difficulties, easiest first.

   Simplifications, so bot results stay about play and not interface:
   - ball in hand is auto-placed in the kitchen (session.autoPlaceCue);
   - no English, and power comes from the distances rather than being chosen;
   - on the 8, the shot carries its pocket and the adapter calls it. */

import { PlaySession } from '../src/game/play.js';
import { chooseAiShot } from '../src/game/ai.js';
import { BALL_R, DIFFICULTIES, FIXED_DT, TABLE, pocketCenters } from '../src/game/content.js';

const NO_ENGLISH = { x: 0, y: 0 };
/** Cuts thinner than this rarely drop; offering them only slows the bots. */
const MIN_CUT = 0.35;
const MAX_SHOTS = 12;

export default {
  profile: 'turn',
  seats: 1,
  variants: Object.keys(DIFFICULTIES),
  fixedDt: FIXED_DT,

  create: (seed, variant) => new PlaySession(seed, {}, { mode: 'vsAi', difficulty: variant || 'medium' }),

  awaitingDecision: (s) => s.phase === 'aiming' && s.turn === 'player' && !s.moving,

  actions: candidateShots,

  tick(s, action) {
    if (action) {
      if (s.needsPocketCall('player')) s.callPocket(action.pocket, 'player');
      s.shoot(action.dx, action.dy, action.power, NO_ENGLISH);
    } else if (s.phase === 'ballInHand' && s.turn === 'player') {
      s.autoPlaceCue();
    } else if (s.isAiTurn && s.phase === 'aiming' && !s.moving) {
      const shot = chooseAiShot(s, s.difficulty, s.rng);
      s.shoot(shot.dx, shot.dy, shot.power, shot.english);
    }
    s.step(FIXED_DT);
  },

  time: (s) => s.time,
  score: (s) => s.scores.player - s.scores.ai,
  terminal: (s) => s.phase === 'won',
  outcome(s) {
    const cause = endCause(s.winReason);
    if (s.winner === 'player') return { result: 'win', cause };
    if (s.winner === 'ai') return { result: 'lose', cause };
    return { result: 'end', cause };
  },

  // Break has no event queue: compare against the last look and report what changed.
  drainEvents(s) {
    const now = look(s);
    const before = s.qaLast;
    s.qaLast = now;
    if (!before) return [];
    const out = [];
    if (now.shots > before.shots) out.push({ kind: 'shot', by: now.turn });
    for (const who of ['player', 'ai']) {
      for (let i = before.scores[who]; i < now.scores[who]; i++) out.push({ kind: 'pot', by: who });
    }
    if (now.scratches > before.scratches) out.push({ kind: 'scratch', by: before.turn });
    if (now.turn !== before.turn) out.push({ kind: 'turn' });
    if (now.winner && !before.winner) out.push({ kind: 'end', winner: now.winner });
    return out;
  },

  mapEvent(raw) {
    if (raw.kind === 'shot') return raw.by === 'player' ? { kind: 'input' } : null;
    if (raw.kind === 'pot') return { kind: raw.by === 'player' ? 'reward' : 'danger' };
    if (raw.kind === 'scratch') return raw.by === 'player' ? { kind: 'damage', cause: 'scratch' } : null;
    if (raw.kind === 'turn') return { kind: 'turn_end' };
    if (raw.kind === 'end') return { kind: raw.winner === 'player' ? 'win' : 'lose' };
    return null;
  },

  observe: (s) => ({
    time: s.time,
    shots: s.shots,
    player: s.scores.player,
    ai: s.scores.ai,
    scratches: s.scratches,
    playerTurn: s.turn === 'player' ? 1 : 0,
    balls: s.balls.map((b) => [b.id, b.x, b.y, b.pocketed ? 1 : 0]),
  }),

  invariants(s) {
    const bad = [];
    // Once an object ball has dropped it stays down (the pocket-wedge and
    // apron soft-catch fixes were about balls coming back onto the felt).
    s.qaDown ||= [];
    for (const b of s.balls) {
      if (b.id === 0) continue;
      if (b.pocketed && !s.qaDown.includes(b.id)) s.qaDown.push(b.id);
      if (!b.pocketed && s.qaDown.includes(b.id)) bad.push(`ball ${b.id} came back out of a pocket`);
      const reach = TABLE.pocketOut + TABLE.pocketJaw;
      if (!b.pocketed && (Math.abs(b.x) > TABLE.halfW + reach || Math.abs(b.y) > TABLE.halfH + reach)) {
        bad.push(`ball ${b.id} left the table at (${b.x.toFixed(1)}, ${b.y.toFixed(1)})`);
      }
    }
    if (s.scores.player > 7 || s.scores.ai > 7) bad.push('a side has more than 7 group balls');
    if (s.balls.length !== 16) bad.push(`${s.balls.length} balls on the table`);
    return bad;
  },
};

/** play.js win reasons → a few categories, so the report groups them. */
function endCause(reason = '') {
  const who = reason.startsWith('AI') ? 'ai' : 'player';
  if (/scratched on the 8/.test(reason)) return `${who} scratched on the 8`;
  if (/pocketed the 8 early/.test(reason)) return `${who} sank the 8 early`;
  if (/missed the call/.test(reason)) return `${who} missed the 8's call`;
  if (/wins/.test(reason)) return `${who} sank the called 8`;
  return reason || 'unknown';
}

function look(s) {
  return { shots: s.shots, scores: { ...s.scores }, scratches: s.scratches, turn: s.turn, winner: s.winner };
}

/** Ghost-ball shots at every legal ball into every pocket, straightest first.
    The first entry is the most natural shot, so ties go to it. */
function candidateShots(s) {
  const cue = s.cue;
  const pockets = pocketCenters();
  const shots = [];
  for (const ball of s.legalTargets('player')) {
    if (ball.pocketed || ball.falling) continue;
    for (const pocket of pockets) {
      const ox = pocket.x - ball.x;
      const oy = pocket.y - ball.y;
      const od = Math.hypot(ox, oy);
      if (od < 1) continue;
      const ghostX = ball.x - (ox / od) * BALL_R * 2;
      const ghostY = ball.y - (oy / od) * BALL_R * 2;
      const dx = ghostX - cue.x;
      const dy = ghostY - cue.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.5) continue;
      const cut = (dx / dist) * (ox / od) + (dy / dist) * (oy / od);
      if (cut < MIN_CUT) continue;
      const power = Math.min(0.95, Math.max(0.3, 0.22 + dist / 140 + od / 220));
      shots.push({ dx: dx / dist, dy: dy / dist, power: round(power), pocket: pocket.id, cut });
    }
  }
  shots.sort((a, b) => b.cut - a.cut);
  const out = shots.slice(0, MAX_SHOTS).map(({ cut, ...shot }) => ({ ...shot, dx: round(shot.dx), dy: round(shot.dy) }));
  if (out.length) return out;

  // Nothing pots (the break, or a snooker): hit the nearest legal ball firmly.
  const near = s
    .legalTargets('player')
    .filter((b) => !b.pocketed && !b.falling)
    .sort((a, b) => Math.hypot(a.x - cue.x, a.y - cue.y) - Math.hypot(b.x - cue.x, b.y - cue.y))[0];
  const tx = near ? near.x : 0;
  const ty = near ? near.y : 0;
  const d = Math.hypot(tx - cue.x, ty - cue.y) || 1;
  return [{ dx: round((tx - cue.x) / d), dy: round((ty - cue.y) / d), power: 0.9, pocket: pockets[0].id }];
}

function round(x) {
  return Math.round(x * 1e6) / 1e6;
}
