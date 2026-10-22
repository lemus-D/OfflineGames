/* Match session: rack, turns, AI or solo. Fixed timestep. No Math.random(). */

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
    this.scores = { player: 0, ai: 0 };
    /** @type {'player'|'ai'|'draw'|null} */
    this.winner = null;
    this.lastPocketed = [];
    this.needsBallInHand = false;
    this.message =
      this.mode === 'vsAi'
        ? `Your break · ${DIFFICULTIES[this.difficulty].name} AI.`
        : 'Aim with the cursor · pull back away from the target for power.';
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
      winner: this.winner,
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

  /** Place cue after a scratch (ball in hand, kitchen). */
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

  /** AI auto-places cue in the kitchen after a foul against it. */
  autoPlaceCue() {
    if (this.phase !== 'ballInHand') return false;
    const jx = (this.rng() - 0.5) * 8;
    const jy = (this.rng() - 0.5) * 10;
    return this.placeCue(CUE_START.x + jx, CUE_START.y + jy);
  }

  /**
   * @param {number} frameDt
   */
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

  _resolveShot() {
    const cue = this.cue;
    const scratched = cue.pocketed;
    const made = this.lastPocketed.length;
    const shooter = this.turn;

    if (scratched) {
      this.scratches += 1;
      // Foul: no points for any object balls on a scratch this stroke.
      placeCueBall(cue, this.balls, CUE_START.x, CUE_START.y);
      if (this.mode === 'vsAi') {
        this.turn = shooter === 'player' ? 'ai' : 'player';
        this.needsBallInHand = true;
        this.phase = 'ballInHand';
        this.message =
          shooter === 'player'
            ? 'Scratch — AI ball in hand.'
            : 'AI scratched — your ball in hand. Tap the kitchen to place.';
        // AI receives ball-in-hand → auto place next tick via main.
        if (this.turn === 'ai') {
          this.autoPlaceCue();
        }
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

    if (made > 0) {
      if (this.mode === 'vsAi') {
        this.scores[shooter] += made;
      }
    }

    if (this.remaining === 0) {
      this.phase = 'won';
      if (this.mode === 'vsAi') {
        if (this.scores.player > this.scores.ai) this.winner = 'player';
        else if (this.scores.ai > this.scores.player) this.winner = 'ai';
        else this.winner = 'draw';
        this.message =
          this.winner === 'player'
            ? `You win ${this.scores.player}–${this.scores.ai}.`
            : this.winner === 'ai'
              ? `AI wins ${this.scores.ai}–${this.scores.player}.`
              : `Draw ${this.scores.player}–${this.scores.ai}.`;
      } else {
        this.winner = 'player';
        this.message = `Table cleared in ${this.shots} shots.`;
      }
      this.hooks.onClear?.(this);
      return;
    }

    if (this.mode === 'vsAi') {
      if (made > 0) {
        // Continue turn.
        this.phase = 'aiming';
        this.message =
          shooter === 'player'
            ? `You pocketed ${this.lastPocketed.join(', ')}. Shoot again.`
            : `AI pocketed ${this.lastPocketed.join(', ')}.`;
        this.hooks.onTurn?.(this);
      } else {
        this.turn = shooter === 'player' ? 'ai' : 'player';
        this.phase = 'aiming';
        this.message =
          this.turn === 'player' ? 'Your turn.' : 'AI thinking…';
        this.hooks.onTurn?.(this);
      }
    } else {
      this.phase = 'aiming';
      if (made > 0) {
        this.message = `Pocketed ${this.lastPocketed.join(', ')}. ${this.remaining} left.`;
      } else {
        this.message = 'No pocket. Aim again.';
      }
    }
  }
}
