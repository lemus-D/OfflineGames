/* Simulation: half-court 1v1, jump-throws, AI. Fixed timestep. No Math.random. */

import { makeRNG, clamp } from '../core/rng.js';
import {
  FIXED_DT,
  COURT,
  HOOP,
  BALL,
  PLAYERS,
  MATCH,
  AI,
  PHYSICS,
} from './content.js';

function makeGuy(def, x, facing) {
  return {
    id: def.id,
    def,
    x,
    y: COURT.floorY + def.bodyR,
    vx: 0,
    vy: 0,
    facing,
    airborne: false,
    jumpLocked: false,
    score: 0,
    stretch: 0,
  };
}

export class PlaySession {
  /**
   * @param {number} seed
   * @param {object} [hooks]
   */
  constructor(seed, hooks = {}) {
    this.seed = seed >>> 0;
    this.rng = makeRNG(this.seed);
    this.hooks = hooks;

    this.human = makeGuy(PLAYERS.human, COURT.minX + 60, 1);
    this.ai = makeGuy(PLAYERS.ai, COURT.maxX - 90, -1);

    this.ball = {
      x: COURT.midX,
      y: 120,
      vx: 0,
      vy: 40,
      holder: null, // 'human' | 'ai' | null
      free: true,
    };

    this.time = 0;
    this.simAccum = 0;
    this.renderAlpha = 0;
    this.shotClock = MATCH.shotClock;
    this.phase = 'tip'; // tip | live | scored | over
    this.phaseTimer = MATCH.tipOffDelay;
    this.lastScorer = null;
    this.winner = null; // 'human' | 'ai'
    this.events = [];
    this.particles = [];
    this._stealCd = 0;
    this._pickupLock = 0;
    this._aiThink = 0;
    this._aiMove = 0;
    this._aiJumpFrames = 0;
    this._lastThrower = null;
    this._prevHuman = { x: this.human.x, y: this.human.y };
    this._prevAi = { x: this.ai.x, y: this.ai.y };
    this._prevBall = { x: this.ball.x, y: this.ball.y };
    this.nearMiss = null;
  }

  get scoreHuman() {
    return this.human.score;
  }

  get scoreAi() {
    return this.ai.score;
  }

  get over() {
    return this.phase === 'over';
  }

  get summary() {
    if (!this.over) return null;
    const you = this.human.score;
    const them = this.ai.score;
    const won = this.winner === 'human';
    let near;
    if (won) {
      near = them >= MATCH.winScore - 2 ? `Close one — they had ${them}.` : `You rolled them ${you}–${them}.`;
    } else {
      const need = MATCH.winScore - you;
      near =
        need <= 2
          ? `So close — you needed ${need} more point${need === 1 ? '' : 's'}.`
          : `Noodle got to ${MATCH.winScore} first (${them}–${you}).`;
    }
    return {
      won,
      you,
      them,
      nearMiss: near,
      time: this.time,
    };
  }

  /**
   * @param {number} frameDt
   * @param {{ move: number, jump: boolean }} controls
   */
  step(frameDt, controls) {
    if (this.phase === 'over') return;
    this.simAccum += Math.min(frameDt, 0.05);
    while (this.simAccum >= FIXED_DT) {
      this._prevHuman = { x: this.human.x, y: this.human.y };
      this._prevAi = { x: this.ai.x, y: this.ai.y };
      this._prevBall = { x: this.ball.x, y: this.ball.y };
      this._fixedStep(FIXED_DT, controls);
      this.simAccum -= FIXED_DT;
    }
    this.renderAlpha = this.simAccum / FIXED_DT;
  }

  renderPose() {
    const a = this.renderAlpha;
    const lerp = (p, c) => ({ x: p.x + (c.x - p.x) * a, y: p.y + (c.y - p.y) * a });
    return {
      human: lerp(this._prevHuman, this.human),
      ai: lerp(this._prevAi, this.ai),
      ball: lerp(this._prevBall, this.ball),
    };
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  _fixedStep(dt, controls) {
    this.time += dt;
    this._stealCd = Math.max(0, this._stealCd - dt);
    this._pickupLock = Math.max(0, this._pickupLock - dt);
    this._ageParticles(dt);

    if (this.phase === 'tip' || this.phase === 'scored') {
      this.phaseTimer -= dt;
      this._integrateGuy(this.human, 0, false, dt);
      this._integrateGuy(this.ai, 0, false, dt);
      if (this.phase === 'tip') this._integrateBall(dt);
      if (this.phaseTimer <= 0) {
        this.phase = 'live';
        if (this.lastScorer) {
          // Loser of the basket gets the ball at midcourt.
          const giver = this.lastScorer === 'human' ? this.ai : this.human;
          this._giveBall(giver.id === 'human' ? 'human' : 'ai');
          this.shotClock = MATCH.shotClock;
        }
      }
      return;
    }

    // Live play
    const humanJump = !!controls.jump;
    const humanMove = clamp(controls.move || 0, -1, 1);
    this._driveGuy(this.human, humanMove, humanJump, dt);

    const aiCtrl = this._aiControls(dt);
    this._driveGuy(this.ai, aiCtrl.move, aiCtrl.jump, dt);

    this._integrateBall(dt);
    this._tryPickups();
    this._trySteals();
    this._checkScore();
    this._tickShotClock(dt);
    this._checkWin();
  }

  _driveGuy(guy, move, jumpPressed, dt) {
    const def = guy.def;
    if (!guy.airborne) {
      guy.vx += move * def.accel * dt;
      const max = def.speed;
      guy.vx = clamp(guy.vx, -max, max);
      if (Math.abs(move) < 0.05) guy.vx *= PHYSICS.moveDrag;
      if (Math.abs(move) > 0.1) guy.facing = move > 0 ? 1 : -1;
    } else {
      guy.vx += move * def.accel * 0.35 * dt;
      guy.vx = clamp(guy.vx, -def.speed * 1.1, def.speed * 1.1);
    }

    const wantsJump = jumpPressed && !guy.jumpLocked;
    if (wantsJump && !guy.airborne) {
      guy.vy = def.jumpVel;
      guy.airborne = true;
      guy.jumpLocked = true;
      guy.stretch = 1;
      this.events.push({ kind: 'jump', who: guy.id, x: guy.x, y: guy.y });

      if (this.ball.holder === guy.id) {
        this._throwFrom(guy);
      }
    }
    if (!jumpPressed) guy.jumpLocked = false;

    this._integrateGuy(guy, move, jumpPressed, dt);
  }

  _integrateGuy(guy, _move, _jump, dt) {
    guy.vy -= PHYSICS.gravity * dt;
    if (guy.vy < -PHYSICS.maxFall) guy.vy = -PHYSICS.maxFall;
    guy.x += guy.vx * dt;
    guy.y += guy.vy * dt;
    guy.x = clamp(guy.x, COURT.minX + guy.def.bodyR, COURT.maxX - guy.def.bodyR);

    const floor = COURT.floorY + guy.def.bodyR;
    if (guy.y <= floor) {
      guy.y = floor;
      guy.vy = 0;
      guy.airborne = false;
      guy.stretch = Math.max(0, guy.stretch - dt * 4);
    } else {
      guy.airborne = true;
      guy.stretch = Math.max(0.2, guy.stretch - dt * 1.5);
    }

    // Soft separation so they don't stack forever
    const other = guy === this.human ? this.ai : this.human;
    const dx = guy.x - other.x;
    const minD = guy.def.bodyR + other.def.bodyR - 2;
    if (Math.abs(dx) < minD && Math.abs(guy.y - other.y) < guy.def.bodyR * 1.6) {
      const push = (minD - Math.abs(dx)) * 0.5 * (dx < 0 ? -1 : 1);
      guy.x += push;
      other.x -= push;
    }
  }

  _throwFrom(guy) {
    const def = guy.def;
    const startX = guy.x + guy.facing * (BALL.holdOffsetX + 8);
    const startY = guy.y + BALL.holdOffsetY + 12;
    let targetX = HOOP.x;
    let targetY = HOOP.rimY + 6;
    const dist = Math.hypot(targetX - startX, targetY - startY);

    // Flight time grows with distance so lobs clear the rim.
    let t = clamp(0.45 + dist / 420, 0.4, 1.05);
    if (guy.id === 'ai') {
      targetX += (this.rng() - 0.5) * 28 * AI.missBias * 4;
      targetY += (this.rng() - 0.5) * 18 * AI.missBias * 4;
      t += (this.rng() - 0.5) * 0.08;
    } else {
      targetX += (this.rng() - 0.5) * 8;
      targetY += (this.rng() - 0.5) * 6;
    }

    const dx = targetX - startX;
    const dy = targetY - startY;
    // Ball uses BALL.gravity; solve for initial velocity.
    let vx = dx / t;
    let vy = (dy + 0.5 * BALL.gravity * t * t) / t;

    // Cap wild rockets from point-blank.
    const spd = Math.hypot(vx, vy);
    const maxSpd = def.throwSpeed * 1.35;
    if (spd > maxSpd) {
      vx *= maxSpd / spd;
      vy *= maxSpd / spd;
    }

    this._lastThrower = guy.id;
    this._pickupLock = 0.45;
    this.ball.holder = null;
    this.ball.free = true;
    this.ball.x = startX;
    this.ball.y = startY;
    this.ball.vx = vx;
    this.ball.vy = vy;
    guy.stretch = 1.35;
    this.events.push({ kind: 'throw', who: guy.id, x: this.ball.x, y: this.ball.y });
  }

  _integrateBall(dt) {
    if (this.ball.holder) {
      const guy = this.ball.holder === 'human' ? this.human : this.ai;
      this.ball.x = guy.x + guy.facing * (BALL.holdOffsetX + guy.stretch * 10);
      this.ball.y = guy.y + BALL.holdOffsetY + guy.stretch * 6;
      this.ball.vx = guy.vx;
      this.ball.vy = guy.vy;
      return;
    }

    this.ball.vy -= BALL.gravity * dt;
    this.ball.vx *= BALL.airDrag;
    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;

    // Backboard
    if (
      this.ball.x + BALL.radius > HOOP.backboardX &&
      this.ball.y < HOOP.backboardTop &&
      this.ball.y > HOOP.backboardBot &&
      this.ball.vx > 0
    ) {
      this.ball.x = HOOP.backboardX - BALL.radius;
      this.ball.vx *= -BALL.bounce;
      this.events.push({ kind: 'bounce', x: this.ball.x, y: this.ball.y });
    }

    // Floor
    if (this.ball.y - BALL.radius <= COURT.floorY) {
      this.ball.y = COURT.floorY + BALL.radius;
      this.ball.vy *= -BALL.bounce;
      this.ball.vx *= BALL.floorFriction;
      if (Math.abs(this.ball.vy) < 40) this.ball.vy = 0;
      this.events.push({ kind: 'bounce', x: this.ball.x, y: this.ball.y });
    }

    // Walls
    if (this.ball.x - BALL.radius < COURT.minX) {
      this.ball.x = COURT.minX + BALL.radius;
      this.ball.vx *= -BALL.bounce;
    }
    if (this.ball.x + BALL.radius > COURT.maxX) {
      this.ball.x = COURT.maxX - BALL.radius;
      this.ball.vx *= -BALL.bounce;
    }
    if (this.ball.y + BALL.radius > COURT.ceilingY) {
      this.ball.y = COURT.ceilingY - BALL.radius;
      this.ball.vy *= -BALL.bounce;
    }
  }

  _tryPickups() {
    if (this.ball.holder || !this.ball.free || this._pickupLock > 0) return;
    // Prefer the closer guy; skip if ball is still screaming upward off a pass.
    if (this.ball.vy > 280) return;
    let best = null;
    let bestD = Infinity;
    for (const guy of [this.human, this.ai]) {
      const reach = guy.def.reach * (guy.airborne ? 1.15 : 1);
      const dx = this.ball.x - guy.x;
      const dy = this.ball.y - (guy.y + 10);
      const d = Math.hypot(dx, dy);
      if (d < reach && d < bestD) {
        best = guy;
        bestD = d;
      }
    }
    if (best) {
      this._giveBall(best.id);
      this.events.push({ kind: 'pickup', who: best.id, x: best.x, y: best.y });
    }
  }

  _trySteals() {
    if (!this.ball.holder || this._stealCd > 0) return;
    const holder = this.ball.holder === 'human' ? this.human : this.ai;
    const thief = holder === this.human ? this.ai : this.human;
    const dx = thief.x - holder.x;
    const dy = thief.y - holder.y;
    // Must be a committed jump contest, not a brush.
    if (Math.hypot(dx, dy) < AI.contestReach * 0.85 && thief.airborne && thief.stretch > 0.7) {
      const chance = holder.id === 'human' ? 0.16 : 0.28;
      if (this.rng() < chance) {
        this.ball.holder = null;
        this.ball.free = true;
        this.ball.vx = thief.facing * 120 + (this.rng() - 0.5) * 80;
        this.ball.vy = 180 + this.rng() * 80;
        this._stealCd = MATCH.stealCooldown * 1.4;
        this.shotClock = MATCH.shotClock;
        this.events.push({ kind: 'steal', who: thief.id, x: this.ball.x, y: this.ball.y });
      }
    }
  }

  _giveBall(who) {
    this.ball.holder = who;
    this.ball.free = false;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.shotClock = MATCH.shotClock;
  }

  _checkScore() {
    if (this.ball.holder || !this._lastThrower) return;
    const dx = this.ball.x - HOOP.x;
    const dy = this.ball.y - HOOP.rimY;
    const near = Math.hypot(dx, dy) < HOOP.scoreRadius;
    const swishing = this.ball.vy < 0 && this.ball.vy > -HOOP.scoreVyMax;
    // Also accept a downward cross through the rim band.
    const crossed =
      dy >= -8 &&
      dy <= 14 &&
      Math.abs(dx) < HOOP.rimR + 4 &&
      this.ball.vy < 0;
    if ((near && swishing) || crossed) {
      this._score(this._lastThrower);
    }
  }

  _score(who) {
    const guy = who === 'human' ? this.human : this.ai;
    guy.score += 2;
    this.lastScorer = who;
    this.phase = 'scored';
    this.phaseTimer = MATCH.afterScoreDelay;
    this.ball.holder = null;
    this.ball.free = true;
    this.ball.x = COURT.midX;
    this.ball.y = 140;
    this.ball.vx = (this.rng() - 0.5) * 40;
    this.ball.vy = 20;
    // Inbound spots: receiver nearer midcourt, defender near the arc.
    this.human.x = COURT.midX - 70;
    this.human.vx = 0;
    this.human.vy = 0;
    this.human.y = COURT.floorY + this.human.def.bodyR;
    this.ai.x = COURT.midX + 50;
    this.ai.vx = 0;
    this.ai.vy = 0;
    this.ai.y = COURT.floorY + this.ai.def.bodyR;
    this._spawnScoreFx(HOOP.x, HOOP.rimY);
    this.events.push({ kind: 'score', who, x: HOOP.x, y: HOOP.rimY, human: this.human.score, ai: this.ai.score });
    this._lastThrower = null;
  }

  _tickShotClock(dt) {
    if (!this.ball.holder) return;
    this.shotClock -= dt;
    if (this.shotClock <= MATCH.shotClockWarn && this.shotClock + dt > MATCH.shotClockWarn) {
      this.events.push({ kind: 'clock_warn' });
    }
    if (this.shotClock <= 0) {
      const loser = this.ball.holder;
      this.ball.holder = null;
      this.ball.free = true;
      this.ball.vx = (loser === 'human' ? -1 : 1) * 90;
      this.ball.vy = 200;
      this.shotClock = MATCH.shotClock;
      this.events.push({ kind: 'turnover', who: loser, x: this.ball.x, y: this.ball.y });
    }
  }

  _checkWin() {
    if (this.human.score >= MATCH.winScore) {
      this.winner = 'human';
      this.phase = 'over';
      this.nearMiss = this.summary?.nearMiss;
      this.events.push({ kind: 'win', who: 'human' });
    } else if (this.ai.score >= MATCH.winScore) {
      this.winner = 'ai';
      this.phase = 'over';
      this.nearMiss = this.summary?.nearMiss;
      this.events.push({ kind: 'lose', who: 'human' });
    }
  }

  _aiControls(dt) {
    if (this._aiJumpFrames > 0) {
      this._aiJumpFrames -= 1;
      return { move: this._aiMove || 0, jump: true };
    }

    this._aiThink -= dt;
    if (this._aiThink > 0) {
      return { move: this._aiMove || 0, jump: false };
    }
    this._aiThink = 1 / AI.thinkHz;

    let move = 0;
    const me = this.ai;
    const ball = this.ball;

    if (ball.holder === 'ai') {
      const dist = HOOP.x - me.x;
      me.facing = 1;
      if (dist > AI.jumpRangeMax) move = 1;
      else if (dist < AI.jumpRangeMin * 0.75) move = -0.5;
      else {
        move = 0.25;
        if (!me.airborne && dist >= AI.jumpRangeMin && dist <= AI.jumpRangeMax) {
          if (this.rng() < 0.55) this._aiJumpFrames = 3;
        }
      }
      // Shot clock panic
      if (this.shotClock < 2.5 && !me.airborne && dist < AI.jumpRangeMax + 40) {
        this._aiJumpFrames = 3;
      }
    } else if (ball.holder === 'human') {
      move = Math.sign(this.human.x - me.x) || 1;
      if (Math.abs(this.human.x - me.x) < AI.contestReach + 18 && !me.airborne) {
        if (this.rng() < 0.18) this._aiJumpFrames = 2;
      }
    } else {
      move = Math.sign(ball.x - me.x) || 1;
      if (Math.abs(ball.x - me.x) < 55 && ball.y > me.y + 10 && !me.airborne) {
        if (this.rng() < 0.55) this._aiJumpFrames = 2;
      }
    }

    this._aiMove = move;
    return { move, jump: false };
  }

  _spawnScoreFx(x, y) {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * (80 + this.rng() * 120),
        vy: Math.sin(a) * (80 + this.rng() * 120),
        life: 0.45 + this.rng() * 0.3,
        age: 0,
        color: i % 2 ? '#fff4c8' : '#f07828',
      });
    }
  }

  _ageParticles(dt) {
    for (const p of this.particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= 400 * dt;
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
  }
}
