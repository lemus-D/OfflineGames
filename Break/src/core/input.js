/* Pointer aim + English dial. Hover aims; drag back for power (aim locked). */

export class CueInput {
  constructor(canvas) {
    this.canvas = canvas;
    /** @type {'idle'|'aiming'|'locked'} */
    this.mode = 'idle';
    this.pointerDown = false;
    this.sx = 0;
    this.sy = 0;
    this.cx = 0;
    this.cy = 0;
    /** Latest pointer in canvas CSS pixels (for hover aim). */
    this.px = 0;
    this.py = 0;
    this.hasPointer = false;
    this.enabled = true;
    /** When true, table ignore events (spin dial capturing). */
    this.blocked = false;
    /**
     * Aim direction locked at pull start (screen space, unit-ish).
     * Shot goes along this; drag opposite increases power.
     */
    this.lockDx = 1;
    this.lockDy = 0;
    this.hasLock = false;
    /** Optional cue screen pos provider set by main each frame. */
    this.cueScreen = null;

    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      const t = e.touches ? e.touches[0] || e.changedTouches[0] : e;
      return {
        x: ((t.clientX - r.left) / r.width) * canvas.clientWidth,
        y: ((t.clientY - r.top) / r.height) * canvas.clientHeight,
      };
    };

    const track = (e) => {
      const p = pos(e);
      this.px = p.x;
      this.py = p.y;
      this.hasPointer = true;
    };

    const down = (e) => {
      if (!this.enabled || this.mode === 'locked' || this.blocked) return;
      e.preventDefault();
      const p = pos(e);
      this.pointerDown = true;
      this.sx = p.x;
      this.sy = p.y;
      this.cx = p.x;
      this.cy = p.y;
      this.px = p.x;
      this.py = p.y;
      this.hasPointer = true;
      this.mode = 'aiming';

      // Lock aim: cue → pointer (hover aim). Fallback to last lock / right.
      if (this.cueScreen) {
        let adx = p.x - this.cueScreen.x;
        let ady = p.y - this.cueScreen.y;
        let len = Math.hypot(adx, ady);
        if (len < 8) {
          adx = this.lockDx;
          ady = this.lockDy;
          len = Math.hypot(adx, ady) || 1;
        }
        this.lockDx = adx / len;
        this.lockDy = ady / len;
        this.hasLock = true;
      }
    };
    const move = (e) => {
      track(e);
      if (!this.pointerDown) return;
      e.preventDefault();
      this.cx = this.px;
      this.cy = this.py;
    };
    const up = (e) => {
      track(e);
      if (!this.pointerDown) return;
      e.preventDefault();
      this.cx = this.px;
      this.cy = this.py;
      this.pointerDown = false;
    };

    canvas.addEventListener('mousedown', down);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseenter', track);
    canvas.addEventListener('mouseleave', () => {
      this.hasPointer = false;
    });
    addEventListener('mouseup', up);
    canvas.addEventListener('touchstart', down, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', up, { passive: false });
    canvas.addEventListener('touchcancel', up, { passive: false });
  }

  /**
   * While pulling: aim stays locked; power = drag projected opposite the aim.
   * On release: same locked aim + measured power.
   */
  aimScreen() {
    if (this.mode !== 'aiming') return null;
    const dragX = this.sx - this.cx;
    const dragY = this.sy - this.cy;
    // Component of the pull-back along the opposite of aim (= along aim as shot dir).
    // Dragging opposite the aim direction increases power.
    const along = this.hasLock
      ? Math.max(0, -(dragX * this.lockDx + dragY * this.lockDy))
      : Math.hypot(dragX, dragY);
    const dx = this.hasLock ? this.lockDx * Math.max(along, 1) : dragX;
    const dy = this.hasLock ? this.lockDy * Math.max(along, 1) : dragY;
    return {
      dx,
      dy,
      powerPull: this.hasLock ? along : Math.hypot(dragX, dragY),
      released: !this.pointerDown,
      pulling: this.pointerDown,
    };
  }

  reset() {
    this.mode = 'idle';
    this.pointerDown = false;
    this.hasLock = false;
  }

  lock() {
    this.mode = 'locked';
    this.pointerDown = false;
    this.hasLock = false;
  }

  unlock() {
    if (this.mode === 'locked') this.mode = 'idle';
  }
}

/**
 * English tip picker on a cue-ball face dial.
 * english: {x, y} in -max..max (x right, y follow/top).
 */
export class EnglishDial {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ maxEnglish: number }} opts
   */
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.maxEnglish = opts.maxEnglish;
    this.english = { x: 0, y: 0 };
    this.dragging = false;
    this.hover = false;

    const read = (e) => {
      const r = canvas.getBoundingClientRect();
      const t = e.touches ? e.touches[0] || e.changedTouches[0] : e;
      const x = ((t.clientX - r.left) / r.width) * 2 - 1;
      const y = -(((t.clientY - r.top) / r.height) * 2 - 1);
      const len = Math.hypot(x, y);
      const scale = len > 1 ? 1 / len : 1;
      this.english.x = x * scale * this.maxEnglish;
      this.english.y = y * scale * this.maxEnglish;
    };

    const down = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dragging = true;
      this.hover = true;
      read(e);
    };
    const move = (e) => {
      if (!this.dragging) return;
      e.preventDefault();
      read(e);
    };
    const up = () => {
      this.dragging = false;
    };

    canvas.addEventListener('mousedown', down);
    canvas.addEventListener('mousemove', (e) => {
      this.hover = true;
      move(e);
    });
    canvas.addEventListener('mouseleave', () => {
      this.hover = false;
    });
    addEventListener('mouseup', up);
    canvas.addEventListener('touchstart', down, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', up, { passive: false });
    canvas.addEventListener('dblclick', (e) => {
      e.preventDefault();
      this.english.x = 0;
      this.english.y = 0;
    });
  }

  reset() {
    this.english.x = 0;
    this.english.y = 0;
  }
}
