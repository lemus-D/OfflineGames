/* Pointer aim for the cue: drag back from the cue ball to set power + direction. */

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
    this.enabled = true;

    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      const t = e.touches ? e.touches[0] || e.changedTouches[0] : e;
      return {
        x: ((t.clientX - r.left) / r.width) * canvas.clientWidth,
        y: ((t.clientY - r.top) / r.height) * canvas.clientHeight,
      };
    };

    const down = (e) => {
      if (!this.enabled || this.mode === 'locked') return;
      e.preventDefault();
      const p = pos(e);
      this.pointerDown = true;
      this.sx = p.x;
      this.sy = p.y;
      this.cx = p.x;
      this.cy = p.y;
      this.mode = 'aiming';
    };
    const move = (e) => {
      if (!this.pointerDown) return;
      e.preventDefault();
      const p = pos(e);
      this.cx = p.x;
      this.cy = p.y;
    };
    const up = (e) => {
      if (!this.pointerDown) return;
      e.preventDefault();
      const p = pos(e);
      this.cx = p.x;
      this.cy = p.y;
      this.pointerDown = false;
    };

    canvas.addEventListener('mousedown', down);
    canvas.addEventListener('mousemove', move);
    addEventListener('mouseup', up);
    canvas.addEventListener('touchstart', down, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', up, { passive: false });
    canvas.addEventListener('touchcancel', up, { passive: false });
  }

  /** Screen-space aim vector: from current pointer toward start (shot direction). */
  aimScreen() {
    if (this.mode !== 'aiming') return null;
    return {
      dx: this.sx - this.cx,
      dy: this.sy - this.cy,
      powerPull: Math.hypot(this.sx - this.cx, this.sy - this.cy),
      released: !this.pointerDown,
    };
  }

  reset() {
    this.mode = 'idle';
    this.pointerDown = false;
  }

  lock() {
    this.mode = 'locked';
    this.pointerDown = false;
  }

  unlock() {
    if (this.mode === 'locked') this.mode = 'idle';
  }
}
