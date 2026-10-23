/* Match session: 8-ball suits, turns, AI. Fixed timestep. No Math.random(). */

import { makeRNG } from '../core/rng.js';
import {
  FIXED_DT,
  BALLS,
  CUE_BALL,
  RACK_ORDER,
  CUE_START,
  RACK_APEX,
  BALL_R,
  scoreClear,
  DIFFICULTIES,
} from './content.js';
import {
  createBall,
  anyMoving,
  stepPhysics,
  placeCueBall,
  applyCueShot,
} from './physics.js';

function ballDef(id) {
  if (id === 0) return CUE_BALL;
  return BALLS.find((b) => b.id === id);
}

export function groupOf(ballOrId) {
  if (ballOrId && typeof ballOrId === 'object') return ballOrId.kind;
  if (ballOrId === 0) return 'cue';
  if (ballOrId === 8) return 'eight';
  if (ballOrId >= 1 && ballOrId <= 7) return 'solid';
  if (ballOrId >= 9 && ballOrId <= 15) return 'stripe';
  return null;
}

function other(who) {
  return who === 'player' ? 'ai' : 'player';
}

export function suitLabel(suit) {
  if (suit === 'solid') return 'solids';
  if (suit === 'stripe') return 'stripes';
  if (suit === 'eight') return '8-ball';
  return 'open';
}

/** Build a tight triangle rack; tiny seeded jitter so breaks aren't identical. */
function rackPositions(rng) {
  const gap = BALL_R * 2 + 0.02;
  const apex = RACK_APEX;
  const positions = [];
  let idx = 0;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col <= row; col++) {
      const x = apex.x + row * gap * Math.cos(Math.PI / 6);
      const y = apex.y + (col - row / 2) * gap;
      const jx = (rng() - 0.5) * 0.04;
      const jy = (rng() - 0.5) * 0.04;
      positions.push({ id: RACK_ORDER[idx], x: x + jx, y: y + jy });
      idx += 1;
    }
  }
  return positions;
}

export class PlaySession {
  /**
   * @param {number} seed
   * @param {{ onClear?: Function, onScratch?: Function, onTurn?: Function }} [hooks]
   * @param {{ mode?: 'solo'|'vsAi', difficulty?: string }} [opts]
   */
  constructor(seed, hooks = {}, opts = {}) {
    this.seed = seed >>> 0;
    this.rng = makeRNG(this.seed);
    this.hooks = hooks;

    this.mode = opts.mode === 'vsAi' ? 'vsAi' : 'solo';
    this.difficulty = DIFFICULTIES[opts.difficulty] ? opts.difficulty : 'medium';

    this.balls = [];
    const cue = createBall(CUE_BALL, CUE_START.x, CUE_START.y);
    this.balls.push(cue);
    for (const p of rackPositions(this.rng)) {
      this.balls.push(createBall(ballDef(p.id), p.x, p.y));
    }

    this.shots = 0;
    this.pocketedCount = 0;
    this.scratches = 0;
    this.time = 0;
    this.simAccum = 0;
    this.phase = 'aiming'; // aiming | rolling | ballInHand | won
    /** @type {'player'|'ai'} */
    this.turn = 'player';
    /** Count of each side's group balls pocketed (0–7). */
    this.scores = { player: 0, ai: 0 };
    /** @type {{ player: null|'solid'|'stripe', ai: null|'solid'|'stripe' }} */
    this.suits = { player: null, ai: null };
    this.openTable = true;
    /** @type {'player'|'ai'|'draw'|null} */
    this.winner = null;
    this.winReason = '';
    this.lastPocketed = [];
    this.needsBallInHand = false;
    this.message =
      this.mode === 'vsAi'
        ? `Your break · ${DIFFICULTIES[this.difficulty].name} AI · table is open.`
        : 'Aim · pull back for power · drag sideways to fine-tune the line.';
  }

  get cue() {
    return this.balls.find((b) => b.id === 0);
  }

  get objectBalls() {
    return this.balls.filter((b) => b.id !== 0);
  }

  get remaining() {
    return this.objectBalls.filter((b) => !b.pocketed).length;
  }

  get moving() {
    return anyMoving(this.balls);
  }

  get isAiTurn() {
    return this.mode === 'vsAi' && this.turn === 'ai';
  }

  remainingOf(suit) {
    if (!suit || suit === 'eight') {
      const eight = this.balls.find((b) => b.id === 8);
      return eight && !eight.pocketed ? 1 : 0;
    }
    return this.objectBalls.filter((b) => !b.pocketed && b.kind === suit).length;
  }

  /** Balls the current shooter is allowed to target. */
  legalTargets(who = this.turn) {
    if (this.openTable || !this.suits[who]) {
      return this.objectBalls.filter((b) => !b.pocketed && b.kind !== 'eight');
    }
    const suit = this.suits[who];
    const group = this.objectBalls.filter((b) => !b.pocketed && b.kind === suit);
    if (group.length) return group;
    return this.objectBalls.filter((b) => !b.pocketed && b.kind === 'eight');
  }

  /** Short HUD label: YOU · SOLIDS / AI · 8 / etc. */
  suitHud(who) {
    const base = who === 'player' ? 'YOU' : 'AI';
    if (this.openTable || !this.suits[who]) return `${base} · OPEN`;
    const suit = this.suits[who];
    if (this.remainingOf(suit) === 0) return `${base} · 8`;
    return `${base} · ${suit === 'solid' ? 'SOLIDS' : 'STRIPES'}`;
  }

  summary() {
    return {
      shots: this.shots,
      pocketed: this.pocketedCount,
      remaining: this.remaining,
      scratches: this.scratches,
      cleared: this.phase === 'won',
      score: scoreClear(this.shots, this.pocketedCount),
      mode: this.mode,
      difficulty: this.difficulty,
      scores: { ...this.scores },
      suits: { ...this.suits },
      openTable: this.openTable,
      winner: this.winner,
      winReason: this.winReason,
      turn: this.turn,
    };
  }

  /**
   * Fire a shot. dir is world-space aim; power01 in [0,1].
   * @param {{x:number,y:number}} [english]
   */
  shoot(dirX, dirY, power01, english = { x: 0, y: 0 }) {
    if (this.phase !== 'aiming' && this.phase !== 'ballInHand') return false;
    if (this.moving) return false;
    const cue = this.cue;
    if (!cue || cue.pocketed) return false;
    if (power01 < 0.02) return false;

    applyCueShot(cue, dirX, dirY, power01, english);
    this.shots += 1;
    this.phase = 'rolling';
    this.message = this.isAiTurn ? 'AI shooting…' : '';
    this.lastPocketed = [];
    return true;
  }

  placeCue(x, y) {
    if (this.phase !== 'ballInHand') return false;
    placeCueBall(this.cue, this.balls, x, y);
    this.phase = 'aiming';
    this.needsBallInHand = false;
    this.message = this.isAiTurn
      ? 'AI ball in hand…'
      : 'Ball in hand. Aim your next shot.';
    this.hooks.onTurn?.(this);
    return true;
  }

  autoPlaceCue() {
    if (this.phase !== 'ballInHand') return false;
    const jx = (this.rng() - 0.5) * 8;
    const jy = (this.rng() - 0.5) * 10;
    return this.placeCue(CUE_START.x + jx, CUE_START.y + jy);
  }

  step(frameDt) {
    if (this.phase === 'won') return;
    this.simAccum += Math.min(frameDt, 0.05);
    while (this.simAccum >= FIXED_DT) {
      this._fixedStep(FIXED_DT);
      this.simAccum -= FIXED_DT;
    }
  }

  _fixedStep(dt) {
    this.time += dt;
    if (this.phase !== 'rolling') return;

    const events = stepPhysics(this.balls, dt);
    for (const b of events.pocketed) {
      if (b.id === 0) continue;
      this.pocketedCount += 1;
      this.lastPocketed.push(b.id);
    }

    if (this.moving) return;
    this._resolveShot();
  }

  _endGame(winner, reason) {
    this.phase = 'won';
    this.winner = winner;
    this.winReason = reason;
    this.message = reason;
    this.hooks.onClear?.(this);
  }

  _assignSuits(shooter, pocketedIds) {
    if (!this.openTable) return false;
    const groups = new Set();
    for (const id of pocketedIds) {
      const g = groupOf(id);
      if (g === 'solid' || g === 'stripe') groups.add(g);
    }
    // Both groups on one stroke (common on the break) — stay open.
    if (groups.size !== 1) return false;
    const g = [...groups][0];
    this.suits[shooter] = g;
    this.suits[other(shooter)] = g === 'solid' ? 'stripe' : 'solid';
    this.openTable = false;
    return true;
  }

  _countLegalFor(shooter, pocketedIds) {
    if (this.openTable || !this.suits[shooter]) {
      return pocketedIds.filter((id) => {
        const g = groupOf(id);
        return g === 'solid' || g === 'stripe';
      }).length;
    }
    const suit = this.suits[shooter];
    return pocketedIds.filter((id) => groupOf(id) === suit).length;
  }

  _tallyScores(pocketedIds) {
    for (const id of pocketedIds) {
      const g = groupOf(id);
      if (g !== 'solid' && g !== 'stripe') continue;
      if (this.suits.player === g) this.scores.player += 1;
      else if (this.suits.ai === g) this.scores.ai += 1;
    }
    this.scores.player = Math.min(7, this.scores.player);
    this.scores.ai = Math.min(7, this.scores.ai);
  }

  _onEightMessage(shooter) {
    if (this.openTable || !this.suits[shooter]) return '';
    if (this.remainingOf(this.suits[shooter]) > 0) return '';
    if (shooter === 'player') {
      return this.suits.player === 'solid'
        ? 'Your solids are clear — shoot the 8.'
        : 'Your stripes are clear — shoot the 8.';
    }
    return 'AI is on the 8.';
  }

  _resolveShot() {
    const cue = this.cue;
    const scratched = !!(cue && cue.pocketed);
    const pocketedIds = this.lastPocketed.slice();
    const eightDown = pocketedIds.includes(8);
    const shooter = this.turn;
    const opp = other(shooter);

    // —— Scratch ——
    if (scratched) {
      this.scratches += 1;
      placeCueBall(cue, this.balls, CUE_START.x, CUE_START.y);

      // Scratch while pocketing the 8 is a loss.
      if (eightDown) {
        this._endGame(
          this.mode === 'vsAi' ? opp : null,
          `${labelWho(shooter)} scratched on the 8.`
        );
        return;
      }

      if (this.mode === 'vsAi') {
        this.turn = opp;
        this.needsBallInHand = true;
        this.phase = 'ballInHand';
        this.message =
          shooter === 'player'
            ? 'Scratch — AI ball in hand.'
            : 'AI scratched — your ball in hand. Tap the kitchen to place.';
        if (this.turn === 'ai') this.autoPlaceCue();
        this.hooks.onScratch?.(this);
        this.hooks.onTurn?.(this);
      } else {
        this.needsBallInHand = true;
        this.phase = 'ballInHand';
        this.message = 'Scratch — ball in hand. Tap the kitchen to place, then aim.';
        this.hooks.onScratch?.(this);
      }
      return;
    }

    // —— 8-ball outcomes ——
    if (eightDown) {
      const suit = this.suits[shooter];
      // Early 8 if table still open, no suit yet, or group balls remain.
      const early = this.openTable || !suit || this.remainingOf(suit) > 0;
      if (early) {
        this._endGame(
          this.mode === 'vsAi' ? opp : null,
          `${labelWho(shooter)} pocketed the 8 early.`
        );
      } else {
        this._endGame(
          this.mode === 'vsAi' ? shooter : 'player',
          `${labelWho(shooter)} wins — 8-ball.`
        );
      }
      return;
    }

    // —— Suit assignment (open table) ——
    const assigned = pocketedIds.length ? this._assignSuits(shooter, pocketedIds) : false;
    this._tallyScores(pocketedIds);

    const legal = this._countLegalFor(shooter, pocketedIds);
    const keepTurn = legal > 0;

    if (this.mode === 'vsAi') {
      this.phase = 'aiming';
      if (keepTurn) {
        let msg;
        if (assigned) {
          msg =
            shooter === 'player'
              ? `You are ${suitLabel(this.suits.player)} · AI is ${suitLabel(this.suits.ai)}. Shoot again.`
              : `AI claims ${suitLabel(this.suits.ai)} · you are ${suitLabel(this.suits.player)}.`;
        } else if (this.openTable) {
          msg =
            shooter === 'player'
              ? `Pocketed ${pocketedIds.join(', ')}. Table still open. Shoot again.`
              : `AI pocketed ${pocketedIds.join(', ')}.`;
        } else {
          msg =
            shooter === 'player'
              ? `Pocketed ${pocketedIds.join(', ')}. Shoot ${suitLabel(this.suits.player)} again.`
              : `AI pocketed ${pocketedIds.join(', ')}.`;
        }
        const eightMsg = this._onEightMessage(shooter);
        this.message = eightMsg || msg;
        this.hooks.onTurn?.(this);
      } else {
        this.turn = opp;
        if (assigned && shooter === 'player') {
          this.message = `You are ${suitLabel(this.suits.player)} · AI is ${suitLabel(this.suits.ai)}. AI thinking…`;
        } else if (this.turn === 'player') {
          this.message = this.openTable
            ? 'Your turn — table is open.'
            : `Your turn — shoot ${suitLabel(this.suits.player)}.`;
        } else {
          this.message = 'AI thinking…';
        }
        this.hooks.onTurn?.(this);
      }
    } else {
      this.phase = 'aiming';
      if (assigned) {
        this.message = `You are ${suitLabel(this.suits.player)}.`;
      } else {
        this.message = pocketedIds.length
          ? `Pocketed ${pocketedIds.join(', ')}.`
          : 'No pocket. Aim again.';
      }
    }
  }
}

function labelWho(who) {
  return who === 'player' ? 'You' : 'AI';
}
