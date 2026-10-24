/* Keyboard + pointer/touch → laneDelta + jump (edge-triggered). */

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this._laneQueued = 0;
    this._jumpQueued = false;
    this._touchStart = null;
    this._rect = () => canvas.getBoundingClientRect();

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const c = e.code;
      if (
        ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'KeyW'].includes(
          c
        )
      ) {
        e.preventDefault();
      }
      this.keys.add(c);
      this.pressed.add(c);
      if (c === 'ArrowLeft' || c === 'KeyA') this._laneQueued = -1;
      if (c === 'ArrowRight' || c === 'KeyD') this._laneQueued = 1;
      if (c === 'ArrowUp' || c === 'KeyW' || c === 'Space') this._jumpQueued = true;
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => {
      this.keys.clear();
      this._touchStart = null;
    });

    const onDown = (clientX, clientY) => {
      const r = this._rect();
      this._touchStart = {
        x: clientX - r.left,
        y: clientY - r.top,
        w: r.width,
        h: r.height,
        t: performance.now(),
      };
    };
    const onUp = (clientX, clientY) => {
      if (!this._touchStart) return;
      const r = this._rect();
      const x = clientX - r.left;
      const y = clientY - r.top;
      const dx = x - this._touchStart.x;
      const dy = y - this._touchStart.y;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      const swipeMin = Math.min(r.width, r.height) * 0.06;

      if (absX > swipeMin || absY > swipeMin) {
        if (absY > absX && dy < 0) this._jumpQueued = true;
        else if (absX >= absY) this._laneQueued = dx < 0 ? -1 : 1;
      } else {
        // Tap zones: left third / right third / upper half = jump.
        const nx = this._touchStart.x / this._touchStart.w;
        const ny = this._touchStart.y / this._touchStart.h;
        if (ny < 0.42) this._jumpQueued = true;
        else if (nx < 0.33) this._laneQueued = -1;
        else if (nx > 0.66) this._laneQueued = 1;
        else this._jumpQueued = true;
      }
      this._touchStart = null;
    };

    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture?.(e.pointerId);
      onDown(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointerup', (e) => onUp(e.clientX, e.clientY));
    canvas.addEventListener('pointercancel', () => {
      this._touchStart = null;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /**
   * Edge-triggered controls for this frame.
   * @returns {{ laneDelta: number, jump: boolean }}
   */
  controls() {
    const laneDelta = this._laneQueued;
    const jump = this._jumpQueued;
    this._laneQueued = 0;
    this._jumpQueued = false;
    return { laneDelta, jump };
  }

  endFrame() {
    this.pressed.clear();
  }
}
