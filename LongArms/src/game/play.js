/* Basket Random-ish 1v1: seeded remorphs, floaty bumps, jump-throws / dunks. */

import { makeRNG, clamp, lerp } from '../core/rng.js';
import {
  FIXED_DT,
  COURT,
  HOOP,
  BALL,
  PLAYERS,
  MATCH,
  AI,
  PHYSICS,
  MORPH,
} from './content.js';

function rollMorph(rng) {
  const pick = (range) => lerp(range[0], range[1], rng());
  return {
    arm: pick(MORPH.arm),
    leg: pick(MORPH.leg),
    body: pick(MORPH.body),
    head: pick(MORPH.head),
    speed: pick(MORPH.speed),
    jump: pick(MORPH.jump),
    reach: pick(MORPH.reach),
  };
}

function makeGuy(def, x, facing, morph) {
  const bodyR = def.bodyR * morph.body;
  return {
    id: def.id,
    def,
    morph,
    x,
    y: COURT.floorY + bodyR,
    vx: 0,
    vy: 0,
    facing,
    airborne: false,
    jumpLocked: false,
    score: 0,
    stretch: 0,
    dribble: 0,
    bodyR,
  };
}

function applyMorph(guy, morph) {
  guy.morph = morph;
  guy.bodyR = guy.def.bodyR * morph.body;
  if (!guy.airborne) guy.y = COURT.floorY + guy.bodyR;
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

    const mHuman = rollMorph(this.rng);
    const mAi = rollMorph(this.rng);
    this.human = makeGuy(PLAYERS.human, COURT.midX - 80, 1, mHuman);
    this.ai = makeGuy(PLAYERS.ai, COURT.midX + 80, -1, mAi);

    this.ball = {
      x: COURT.midX,
      y: 130,
      vx: 0,
      vy: 60,
      holder: null,
      free: true,
    };

    this.time = 0;
    this.simAccum = 0;
    this.renderAlpha = 0;
    this.shotClock = MATCH.shotClock;
    this.phase = 'tip'; // tip | live | scored | remorph | over
    this.phaseTimer = MATCH.tipOffDelay;
    this.lastScorer = null;
    this.winner = null;
    this.events = [];
    this.particles = [];
    this.remorphs = 1;
    this.dunking = null; // { who, t, life }
    this._stealCd = 0;
    this._pickupLock = 0;
    this._aiThink = 0;
    this._aiMove = 0;
    this._aiJumpFrames = 0;
    this._lastThrower = null;
    this._wasDunk = false;
    this._prevHuman = { x: this.human.x, y: this.human.y };
    this._prevAi = { x: this.ai.x, y: this.ai.y };
    this._prevBall = { x: this.ball.x, y: this.ball.y };
    this.camX = 0;
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
      near = them >= MATCH.winScore - 1 ? `Squeaker — Blue had ${them}.` : `Chaos win ${you}–${them}.`;
    } else {
      const need = MATCH.winScore - you;
      near =
        need <= 1
          ? `One more bucket and you’d have taken it.`
          : `Blue hit ${MATCH.winScore} first (${them}–${you}).`;
    }
    return {
      won,
      you,
      them,
      nearMiss: near,
      remorphs: this.remorphs,
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
    const focus = this.ball.holder
      ? this.ball.holder === 'human'
        ? this.human.x
        : this.ai.x
      : this.ball.x;
    this.camX += (focus - this.camX) * Math.min(1, frameDt * 6);
  }

  renderPose() {
    const a = this.renderAlpha;
    const lerp2 = (p, c) => ({ x: p.x + (c.x - p.x) * a, y: p.y + (c.y - p.y) * a });
    return {
      human: lerp2(this._prevHuman, this.human),
      ai: lerp2(this._prevAi, this.ai),
      ball: lerp2(this._prevBall, this.ball),
      camX: this.camX,
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
    if (this.dunking) {
      this.dunking.t += dt;
      if (this.dunking.t >= this.dunking.life) this.dunking = null;
    }

    if (this.phase === 'tip' || this.phase === 'scored' || this.phase === 'remorph') {
      this.phaseTimer -= dt;
      this._integrateGuy(this.human, dt);
      this._integrateGuy(this.ai, dt);
      if (this.phase === 'tip') this._integrateBall(dt);
      if (this.phaseTimer <= 0) {
        if (this.phase === 'scored') {
          this._doRemorph();
          this.phase = 'remorph';
          this.phaseTimer = MATCH.remorphFlash;
          return;
        }
        this.phase = 'live';
        if (this.lastScorer) {
          const giver = this.lastScorer === 'human' ? 'ai' : 'human';
          this._resetInbound(giver);
        }
      }
      return;
    }

    const humanMove = clamp(controls.move || 0, -1, 1);
    const humanJump = !!controls.jump;
    this._driveGuy(this.human, humanMove, humanJump, dt);

    const aiCtrl = this._aiControls(dt);
    this._driveGuy(this.ai, aiCtrl.move, aiCtrl.jump, dt);

    this._bumpGuys();
    this._integrateBall(dt);
    this._tryPickups();
    this._trySteals();
    this._checkScore();
    this._tickShotClock(dt);
    this._checkWin();
  }

  _doRemorph() {
    applyMorph(this.human, rollMorph(this.rng));
    applyMorph(this.ai, rollMorph(this.rng));
    this.remorphs += 1;
    this.events.push({
      kind: 'remorph',
      human: { ...this.human.morph },
      ai: { ...this.ai.morph },
    });
    this._spawnRemorphFx(this.human.x, this.human.y + 40);
    this._spawnRemorphFx(this.ai.x, this.ai.y + 40);
  }

  _resetInbound(who) {
    this.human.x = COURT.midX - 70;
    this.ai.x = COURT.midX + 70;
    this.human.vx = this.ai.vx = 0;
    this.human.vy = this.ai.vy = 0;
    this.human.y = COURT.floorY + this.human.bodyR;
    this.ai.y = COURT.floorY + this.ai.bodyR;
    this.human.facing = 1;
    this.ai.facing = -1;
    this.ball.x = COURT.midX;
    this.ball.y = 110;
    this.ball.vx = (this.rng() - 0.5) * 30;
    this.ball.vy = 40;
    this.ball.holder = null;
    this.ball.free = true;
    // Brief free tip then first grab — or hand to inbound team
    this._giveBall(who);
    const holder = who === 'human' ? this.human : this.ai;
    holder.x = COURT.midX - (who === 'human' ? 40 : -40);
    this.shotClock = MATCH.shotClock;
  }

  _driveGuy(guy, move, jumpPressed, dt) {
    const m = guy.morph;
    const speed = PHYSICS.baseSpeed * m.speed;
    const accel = PHYSICS.baseAccel * (0.85 + 0.3 * m.leg);

    if (!guy.airborne) {
      guy.vx += move * accel * dt;
      guy.vx = clamp(guy.vx, -speed, speed);
      if (Math.abs(move) < 0.05) guy.vx *= PHYSICS.moveDrag;
      if (Math.abs(move) > 0.1) guy.facing = move > 0 ? 1 : -1;
      if (this.ball.holder === guy.id && Math.abs(guy.vx) > 40) {
        guy.dribble += dt * (4 + Math.abs(guy.vx) * 0.02);
        if (Math.floor(guy.dribble) !== Math.floor(guy.dribble - dt * 4)) {
          this.events.push({ kind: 'dribble', who: guy.id, x: guy.x, y: guy.y });
        }
      }
    } else {
      guy.vx += move * accel * 0.4 * dt;
      guy.vx = clamp(guy.vx, -speed * 1.15, speed * 1.15);
    }

    const wantsJump = jumpPressed && !guy.jumpLocked;
    if (wantsJump && !guy.airborne) {
      guy.vy = PHYSICS.baseJump * m.jump;
      guy.airborne = true;
      guy.jumpLocked = true;
      guy.stretch = 1;
      this.events.push({ kind: 'jump', who: guy.id, x: guy.x, y: guy.y });
      if (this.ball.holder === guy.id) this._throwFrom(guy);
    }
    if (!jumpPressed) guy.jumpLocked = false;

    this._integrateGuy(guy, dt);
  }

  _integrateGuy(guy, dt) {
    guy.vy -= PHYSICS.gravity * dt;
    if (guy.vy < -PHYSICS.maxFall) guy.vy = -PHYSICS.maxFall;
    guy.x += guy.vx * dt;
    guy.y += guy.vy * dt;
    guy.x = clamp(guy.x, COURT.minX + guy.bodyR, COURT.maxX - guy.bodyR);

    const floor = COURT.floorY + guy.bodyR;
    if (guy.y <= floor) {
      guy.y = floor;
      if (guy.vy < -120) guy.vy *= -0.25;
      else guy.vy = 0;
      guy.airborne = false;
      guy.stretch = Math.max(0, guy.stretch - dt * 5);
    } else {
      guy.airborne = true;
      guy.stretch = Math.max(0.15, guy.stretch - dt * 1.2);
    }
  }

  _bumpGuys() {
    const a = this.human;
    const b = this.ai;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const minD = a.bodyR + b.bodyR - 4;
    const dist = Math.hypot(dx, dy) || 0.001;
    if (dist < minD) {
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = minD - dist;
      a.x -= nx * overlap * 0.5;
      b.x += nx * overlap * 0.5;
      a.y -= ny * overlap * 0.35;
      b.y += ny * overlap * 0.35;
      const push = PHYSICS.bumpPower * overlap * 0.02;
      a.vx -= nx * push;
      b.vx += nx * push;
      a.vy -= ny * push * 0.5;
      b.vy += ny * push * 0.5;
    }
  }

  _throwFrom(guy) {
    const m = guy.morph;
    const startX = guy.x + guy.facing * (BALL.holdOffsetX + m.arm * 8);
    const startY = guy.y + BALL.holdOffsetY + guy.bodyR * 0.2 + 8;
    const distToRim = Math.hypot(HOOP.x - startX, HOOP.rimY - startY);
    const dunk =
      distToRim < HOOP.dunkRange * (0.95 + 0.25 * m.arm) && guy.y > guy.bodyR + 6;

    this._lastThrower = guy.id;
    this._wasDunk = dunk;
    this._pickupLock = dunk ? 0.7 : 0.55;
    this.ball.holder = null;
    this.ball.free = true;
    this.ball.x = startX;
    this.ball.y = startY;

    let targetX = HOOP.x;
    let targetY = HOOP.rimY + (dunk ? -2 : 6);
    let t = dunk ? 0.26 : clamp(0.38 + distToRim / 380, 0.36, 0.95);

    if (guy.id === 'ai') {
      // Mild miss — idle AI must still finish games.
      const miss = dunk ? AI.missBias * 0.4 : AI.missBias;
      targetX += (this.rng() - 0.5) * 24 * miss * 4;
      targetY += (this.rng() - 0.5) * 16 * miss * 4;
      t += (this.rng() - 0.5) * 0.05;
    } else {
      targetX += (this.rng() - 0.5) * 8;
      targetY += (this.rng() - 0.5) * 6;
    }

    if (dunk) {
      // Slam path: hard into the rim
      this.ball.vx = (targetX - startX) / Math.max(0.18, t);
      this.ball.vy = (targetY - startY) / Math.max(0.18, t) + 40;
      guy.stretch = 1.6;
      this.events.push({ kind: 'dunk', who: guy.id, x: startX, y: startY });
    } else {
      const dx = targetX - startX;
      const dy = targetY - startY;
      let vx = dx / t;
      let vy = (dy + 0.5 * BALL.gravity * t * t) / t;
      const spd = Math.hypot(vx, vy);
      const maxSpd = 420 * (0.85 + 0.2 * m.arm);
      if (spd > maxSpd) {
        vx *= maxSpd / spd;
        vy *= maxSpd / spd;
      }
      this.ball.vx = vx;
      this.ball.vy = vy;
      guy.stretch = 1.35;
      this.events.push({ kind: 'throw', who: guy.id, x: startX, y: startY });
    }
  }

  _integrateBall(dt) {
    if (this.ball.holder) {
      const guy = this.ball.holder === 'human' ? this.human : this.ai;
      const m = guy.morph;
      const bob = this.ball.holder && !guy.airborne ? Math.abs(Math.sin(guy.dribble * Math.PI)) * 14 : 0;
      this.ball.x = guy.x + guy.facing * (BALL.holdOffsetX + m.arm * 10 + guy.stretch * 8);
      this.ball.y = guy.y + BALL.holdOffsetY + m.body * 6 - bob;
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

    if (this.ball.y - BALL.radius <= COURT.floorY) {
      this.ball.y = COURT.floorY + BALL.radius;
      this.ball.vy *= -BALL.bounce;
      this.ball.vx *= BALL.floorFriction;
      if (Math.abs(this.ball.vy) < 50) this.ball.vy = 0;
      this.events.push({ kind: 'bounce', x: this.ball.x, y: this.ball.y });
    }

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
    if (this.ball.vy > 300) return;
    let best = null;
    let bestD = Infinity;
    for (const guy of [this.human, this.ai]) {
      const reach = PHYSICS.baseReach * guy.morph.reach * (guy.airborne ? 1.2 : 1);
      const d = Math.hypot(this.ball.x - guy.x, this.ball.y - (guy.y + 12));
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
    const d = Math.hypot(thief.x - holder.x, thief.y - holder.y);
    const reach = AI.contestReach * 0.5 * (thief.morph.arm + holder.morph.arm);
    if (d < reach && thief.airborne && thief.stretch > 0.65) {
      const chance = holder.id === 'human' ? 0.14 : 0.26;
      if (this.rng() < chance) {
        this.ball.holder = null;
        this.ball.free = true;
        this.ball.vx = thief.facing * 140 + (this.rng() - 0.5) * 90;
        this.ball.vy = 200 + this.rng() * 90;
        this._stealCd = MATCH.stealCooldown;
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
    const crossed =
      dy >= -10 && dy <= 16 && Math.abs(dx) < HOOP.rimR + 6 && this.ball.vy < 0;
    if ((near && swishing) || crossed) this._score(this._lastThrower, this._wasDunk);
  }

  _score(who, wasDunk) {
    const guy = who === 'human' ? this.human : this.ai;
    guy.score += 1; // Basket Random style: 1 point per basket
    this.lastScorer = who;
    this.phase = 'scored';
    this.phaseTimer = MATCH.afterScoreDelay;
    this.ball.holder = null;
    this.ball.free = true;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.x = HOOP.x;
    this.ball.y = HOOP.rimY - 10;
    this.human.vx = this.ai.vx = 0;
    this.human.vy = this.ai.vy = 0;
    this._spawnScoreFx(HOOP.x, HOOP.rimY);
    if (wasDunk) {
      this.dunking = { who, t: 0, life: 0.85 };
      this.events.push({ kind: 'score', who, dunk: true, human: this.human.score, ai: this.ai.score });
    } else {
      this.events.push({ kind: 'score', who, dunk: false, human: this.human.score, ai: this.ai.score });
    }
    this._lastThrower = null;
    this._wasDunk = false;
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
      this.ball.vx = (loser === 'human' ? -1 : 1) * 100;
      this.ball.vy = 220;
      this.shotClock = MATCH.shotClock;
      this.events.push({ kind: 'turnover', who: loser, x: this.ball.x, y: this.ball.y });
    }
  }

  _checkWin() {
    if (this.phase !== 'live' && this.phase !== 'scored' && this.phase !== 'remorph') return;
    // Only crown a winner after the scored/remorph beat finishes into live check —
    // allow check during scored so match can end on the bucket.
    if (this.human.score >= MATCH.winScore) {
      this.winner = 'human';
      this.phase = 'over';
      this.dunking = null;
      this.events.push({ kind: 'win', who: 'human' });
    } else if (this.ai.score >= MATCH.winScore) {
      this.winner = 'ai';
      this.phase = 'over';
      this.dunking = null;
      this.events.push({ kind: 'lose', who: 'human' });
    }
  }

  _aiControls(dt) {
    if (this._aiJumpFrames > 0) {
      this._aiJumpFrames -= 1;
      return { move: this._aiMove || 0, jump: true };
    }
    this._aiThink -= dt;
    if (this._aiThink > 0) return { move: this._aiMove || 0, jump: false };
    this._aiThink = 1 / AI.thinkHz;

    let move = 0;
    const me = this.ai;
    const ball = this.ball;

    if (ball.holder === 'ai') {
      const dist = HOOP.x - me.x;
      me.facing = 1;
      if (dist > AI.jumpRangeMax) move = 1;
      else if (dist < 40) move = -0.35;
      else {
        move = dist > 90 ? 0.55 : 0.2;
        // Prefer shooting from the sweet band; dunk attempts when close.
        if (!me.airborne && dist >= 45 && dist <= AI.jumpRangeMax && this.rng() < 0.75) {
          this._aiJumpFrames = 3;
        }
      }
      if (this.shotClock < 3.2 && !me.airborne) this._aiJumpFrames = 3;
    } else if (ball.holder === 'human') {
      move = Math.sign(this.human.x - me.x) || 1;
      if (Math.abs(this.human.x - me.x) < AI.contestReach && !me.airborne && this.rng() < 0.2) {
        this._aiJumpFrames = 2;
      }
    } else {
      move = Math.sign(ball.x - me.x) || 1;
      if (Math.abs(ball.x - me.x) < 60 && ball.y > me.y + 8 && !me.airborne && this.rng() < 0.5) {
        this._aiJumpFrames = 2;
      }
    }

    this._aiMove = move;
    return { move, jump: false };
  }

  _spawnScoreFx(x, y) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * (90 + this.rng() * 140),
        vy: Math.sin(a) * (90 + this.rng() * 140),
        life: 0.5 + this.rng() * 0.35,
        age: 0,
        color: i % 2 ? '#ffffff' : '#ff7a1a',
      });
    }
  }

  _spawnRemorphFx(x, y) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * (60 + this.rng() * 80),
        vy: Math.sin(a) * (60 + this.rng() * 80),
        life: 0.4 + this.rng() * 0.2,
        age: 0,
        color: i % 2 ? '#ffe66d' : '#7bed9f',
      });
    }
  }

  _ageParticles(dt) {
    for (const p of this.particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= 380 * dt;
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
  }
}
