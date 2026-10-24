/* Unfair platformer sim. Fixed timestep. No Math.random. */

import { clamp } from '../core/rng.js';
import {
  FIXED_DT,
  TILE,
  PICKLE,
  BRINE,
  TILES,
  LEVELS,
} from './content.js';

function padRows(rows) {
  let w = 0;
  for (const r of rows) w = Math.max(w, r.length);
  return rows.map((r) => r.padEnd(w, '.'));
}

function parseLevel(def) {
  const rows = padRows(def.rows);
  const h = rows.length;
  const w = rows[0].length;
  const grid = [];
  let spawn = { x: TILE * 2, y: TILE * (h - 3) };

  for (let ty = 0; ty < h; ty++) {
    grid[ty] = [];
    for (let tx = 0; tx < w; tx++) {
      const ch = rows[ty][tx];
      const spec = TILES[ch] || TILES['.'];
      const cell = {
        ch,
        id: spec.id,
        solid: !!spec.solid,
        oneWay: !!spec.oneWay,
        hazard: spec.hazard || null,
        vanish: !!spec.vanish,
        invisible: !!spec.invisible,
        spring: spec.spring || 0,
        crumbly: !!spec.crumbly,
        reverse: !!spec.reverse,
        goal: !!spec.goal,
        draw: spec.draw,
        revealed: !spec.invisible,
        gone: false,
        timer: 0,
      };
      if (ch === 'P') {
        spawn = {
          x: tx * TILE + TILE / 2,
          y: ty * TILE + TILE - PICKLE.h / 2,
        };
      }
      grid[ty][tx] = cell;
    }
  }
  return {
    grid,
    w,
    h,
    spawn,
    name: def.name,
    hint: def.hint,
    id: def.id,
    brineGrace: def.brineGrace != null ? def.brineGrace : BRINE.grace,
  };
}

function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export class PlaySession {
  /**
   * @param {number} seed
   * @param {object} [hooks]
   * @param {{ startLevel?: number }} [opts]
   */
  constructor(seed = 1, hooks = {}, opts = {}) {
    this.seed = seed >>> 0;
    this.hooks = hooks;
    this.levelIndex = Math.max(0, Math.min(LEVELS.length - 1, opts.startLevel || 0));
    this.deaths = 0;
    this.campaignTime = 0;
    this.cleared = false;
    this.won = false;
    this.events = [];
    this.fx = [];
    this.shake = 0;
    this.flash = 0;
    this.simAccum = 0;
    this._loadLevel(this.levelIndex);
  }

  _loadLevel(index) {
    const def = LEVELS[index];
    this.level = parseLevel(def);
    this.levelIndex = index;
    this.levelTime = 0;
    this.brineY = this.level.h * TILE + TILE * 2;
    this.brineActive = false;
    this.brineWarning = false;
    this.status = 'playing'; // playing | dead | cleared | won
    this.deathReason = null;
    this.deathTimer = 0;
    this.clearTimer = 0;
    this.reverse = false;

    const s = this.level.spawn;
    this.player = {
      x: s.x,
      y: s.y,
      vx: 0,
      vy: 0,
      onGround: false,
      coyote: 0,
      buffer: 0,
      facing: 1,
      squish: 1,
      alive: true,
      anim: 0,
      walkCycle: 0,
    };
  }

  summary() {
    return {
      won: this.won,
      cleared: this.cleared || this.won,
      levelIndex: this.levelIndex,
      levelName: this.level.name,
      deaths: this.deaths,
      time: this.campaignTime,
      deathReason: this.deathReason,
      reason: this.won
        ? 'clear'
        : this.status === 'dead'
          ? this.deathReason
          : 'quit',
    };
  }

  /**
   * @param {number} frameDt
   * @param {{ move: number, jump: boolean, jumpHeld: boolean, restart: boolean }} controls
   */
  step(frameDt, controls) {
    const c = controls || { move: 0, jump: false, jumpHeld: false, restart: false };

    if (this.status === 'dead') {
      this.deathTimer += frameDt;
      if (c.restart || this.deathTimer > 1.1) this._respawn();
      this._tickFx(frameDt);
      return;
    }

    if (this.status === 'cleared') {
      this.clearTimer += frameDt;
      if (this.clearTimer > 1.2) this._advance();
      this._tickFx(frameDt);
      return;
    }

    if (this.status === 'won') {
      this._tickFx(frameDt);
      return;
    }

    this.simAccum += Math.min(frameDt, 0.05);
    while (this.simAccum >= FIXED_DT) {
      this._fixedStep(FIXED_DT, c);
      this.simAccum -= FIXED_DT;
    }
    this._tickFx(frameDt);
  }

  _tickFx(dt) {
    this.shake = Math.max(0, this.shake - dt * 4);
    this.flash = Math.max(0, this.flash - dt * 3);
    for (const f of this.fx) f.age += dt;
    this.fx = this.fx.filter((f) => f.age < f.life);
  }

  _respawn() {
    this._loadLevel(this.levelIndex);
  }

  _advance() {
    if (this.levelIndex >= LEVELS.length - 1) {
      this.status = 'won';
      this.won = true;
      this.cleared = true;
      this.hooks.onWin?.(this.summary());
      return;
    }
    this._loadLevel(this.levelIndex + 1);
  }

  _kill(reason) {
    if (this.status !== 'playing') return;
    const p = this.player;
    p.alive = false;
    this.status = 'dead';
    this.deathReason = reason;
    this.deathTimer = 0;
    this.deaths += 1;
    this.shake = 0.45;
    this.flash = 0.35;
    this.events.push({ kind: 'die', x: p.x, y: p.y, reason });
    this.fx.push({ kind: 'splat', x: p.x, y: p.y, age: 0, life: 0.6 });
    this.hooks.onDeath?.(this.summary());
  }

  _clearLevel() {
    if (this.status !== 'playing') return;
    this.status = 'cleared';
    this.clearTimer = 0;
    this.events.push({ kind: 'clear', x: this.player.x, y: this.player.y });
    this.fx.push({
      kind: 'confetti',
      x: this.player.x,
      y: this.player.y,
      age: 0,
      life: 1.2,
    });
    this.hooks.onClear?.(this.summary());
  }

  _fixedStep(dt, { move = 0, jump = false, jumpHeld = false }) {
    this.levelTime += dt;
    this.campaignTime += dt;
    const p = this.player;
    p.anim += dt;
    if (p.onGround && Math.abs(p.vx) > 18) {
      p.walkCycle += dt * (10 + Math.abs(p.vx) * 0.08);
    }

    // Brine pressure — idle / stall loses. Early levels get longer grace.
    const grace = this.level.brineGrace;
    this.brineWarning =
      !this.brineActive && this.levelTime >= grace - BRINE.warnBefore;
    if (this.levelTime >= grace) {
      if (!this.brineActive) {
        this.brineActive = true;
        this.brineWarning = false;
        this.brineY = this.level.h * TILE + TILE;
      }
      this.brineY -= BRINE.riseSpeed * dt;
    }

    // Reverse zone check (feet).
    this.reverse = this._inReverse(p.x, p.y);
    const moveDir = this.reverse ? -move : move;

    // Jump buffer / coyote
    if (jump) p.buffer = PICKLE.buffer;
    else p.buffer = Math.max(0, p.buffer - dt);
    if (p.onGround) p.coyote = PICKLE.coyote;
    else p.coyote = Math.max(0, p.coyote - dt);

    // Horizontal
    if (moveDir !== 0) {
      p.vx += moveDir * PICKLE.accel * dt;
      p.facing = moveDir > 0 ? 1 : -1;
    } else if (p.onGround) {
      p.vx *= PICKLE.friction;
      if (Math.abs(p.vx) < 8) p.vx = 0;
    } else {
      p.vx *= PICKLE.airFriction;
    }
    p.vx = clamp(p.vx, -PICKLE.maxRun, PICKLE.maxRun);

    // Jump
    if (p.buffer > 0 && p.coyote > 0) {
      p.vy = PICKLE.jumpVel;
      p.onGround = false;
      p.coyote = 0;
      p.buffer = 0;
      p.squish = 1.25;
      this.events.push({ kind: 'jump', x: p.x, y: p.y });
    }
    if (!jumpHeld && p.vy < 0) {
      p.vy *= PICKLE.cutJumpMul ** (dt * 60 * 0.15);
    }

    // Gravity
    p.vy += PICKLE.gravity * dt;
    if (p.vy > PICKLE.maxFall) p.vy = PICKLE.maxFall;

    // Integrate + collide
    p.onGround = false;
    this._moveAxis(p, p.vx * dt, 0);
    this._moveAxis(p, 0, p.vy * dt);

    // Squish recover
    p.squish += (1 - p.squish) * Math.min(1, dt * 12);

    // Hazards / goals / brine
    this._interactTiles(p);
    if (p.y - PICKLE.h / 2 > this.level.h * TILE + TILE * 2) {
      this._kill('void');
      return;
    }
    const feet = p.y + PICKLE.h / 2;
    if (this.brineActive && feet > this.brineY) {
      this._kill('brine');
      return;
    }

    // Crumbly / vanish timers
    this._tickTiles(dt);
  }

  _moveAxis(p, dx, dy) {
    p.x += dx;
    p.y += dy;
    const hw = PICKLE.w / 2;
    const hh = PICKLE.h / 2;
    const left = p.x - hw;
    const right = p.x + hw;
    const top = p.y - hh;
    const bottom = p.y + hh;

    const tx0 = Math.floor(left / TILE) - 1;
    const tx1 = Math.floor(right / TILE) + 1;
    const ty0 = Math.floor(top / TILE) - 1;
    const ty1 = Math.floor(bottom / TILE) + 1;

    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const cell = this._cell(tx, ty);
        if (!cell || cell.gone || !cell.solid) continue;

        const bx = tx * TILE;
        const by = ty * TILE;

        if (cell.oneWay) {
          // Only collide when falling onto the top.
          if (dy <= 0) continue;
          const prevBottom = bottom - dy;
          if (prevBottom > by + 2) continue;
          if (!aabb(left, top, PICKLE.w, PICKLE.h, bx, by, TILE, 4)) continue;
          p.y = by - hh;
          p.vy = 0;
          p.onGround = true;
          this._standOn(cell, tx, ty);
          continue;
        }

        if (!aabb(left, p.y - hh, PICKLE.w, PICKLE.h, bx, by, TILE, TILE)) {
          continue;
        }

        if (cell.invisible && !cell.revealed) cell.revealed = true;

        if (dx > 0) {
          p.x = bx - hw;
          p.vx = 0;
        } else if (dx < 0) {
          p.x = bx + TILE + hw;
          p.vx = 0;
        } else if (dy > 0) {
          p.y = by - hh;
          p.vy = 0;
          p.onGround = true;
          this._standOn(cell, tx, ty);
          if (cell.spring) {
            p.vy = -cell.spring;
            p.onGround = false;
            p.squish = 1.35;
            this.events.push({ kind: 'spring', x: p.x, y: p.y });
          }
        } else if (dy < 0) {
          p.y = by + TILE + hh;
          p.vy = 0;
        }
      }
    }

    // World left clamp
    if (p.x < hw) {
      p.x = hw;
      p.vx = 0;
    }
  }

  _standOn(cell) {
    if (cell.vanish && cell.timer <= 0) {
      cell.timer = 0.55; // tense, but long enough to hop off
    }
    if (cell.crumbly && cell.timer <= 0) {
      cell.timer = 0.55;
    }
  }

  _tickTiles(dt) {
    const g = this.level.grid;
    for (let ty = 0; ty < this.level.h; ty++) {
      for (let tx = 0; tx < this.level.w; tx++) {
        const c = g[ty][tx];
        if (c.gone) continue;
        if ((c.vanish || c.crumbly) && c.timer > 0) {
          c.timer -= dt;
          if (c.timer <= 0) {
            c.gone = true;
            this.events.push({
              kind: 'vanish',
              x: tx * TILE + TILE / 2,
              y: ty * TILE + TILE / 2,
            });
            this.fx.push({
              kind: 'poof',
              x: tx * TILE + TILE / 2,
              y: ty * TILE + TILE / 2,
              age: 0,
              life: 0.35,
            });
          }
        }
      }
    }
  }

  _cell(tx, ty) {
    if (ty < 0 || ty >= this.level.h || tx < 0 || tx >= this.level.w) return null;
    return this.level.grid[ty][tx];
  }

  _inReverse(x, y) {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    const c = this._cell(tx, ty);
    return !!(c && c.reverse && !c.gone);
  }

  _interactTiles(p) {
    const hw = PICKLE.w / 2;
    const hh = PICKLE.h / 2;
    const left = p.x - hw + 1;
    const top = p.y - hh + 1;
    const tw = PICKLE.w - 2;
    const th = PICKLE.h - 2;

    const tx0 = Math.floor(left / TILE);
    const tx1 = Math.floor((left + tw) / TILE);
    const ty0 = Math.floor(top / TILE);
    const ty1 = Math.floor((top + th) / TILE);

    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const cell = this._cell(tx, ty);
        if (!cell || cell.gone) continue;
        const bx = tx * TILE;
        const by = ty * TILE;
        if (!aabb(left, top, tw, th, bx, by, TILE, TILE)) continue;

        if (cell.hazard === 'spike' || cell.hazard === 'fakeGoal') {
          this._kill(cell.hazard === 'fakeGoal' ? 'fakeGoal' : 'spike');
          return;
        }
        if (cell.goal) {
          this._clearLevel();
          return;
        }
      }
    }
  }

  /** Drain and return pending events (for audio / particles in main). */
  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}
