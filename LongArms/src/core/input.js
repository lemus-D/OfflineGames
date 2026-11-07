/* Keyboard + pointer/touch → { move, jump } for LongArms. */

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.pointer = { x: 0, y: 0, active: false, down: false };
    this._rect = () => canvas.getBoundingClientRect();
    /** On-screen jump button hit zone in CSS pixels (set by main). */
    this.jumpPad = { x: 0, y: 0, w: 0, h: 0 };
    this._touchJump = false;
    this._touchMove = 0;

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const c = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c)) {
        e.preventDefault();
      }
      this.keys.add(c);
      this.pressed.add(c);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => {
      this.keys.clear();
      this._touchJump = false;
      this._touchMove = 0;
    });

    const setPointer = (clientX, clientY, down) => {
      const r = this._rect();
      this.pointer.x = ((clientX - r.left) / r.width) * canvas.clientWidth;
      this.pointer.y = ((clientY - r.top) / r.height) * canvas.clientHeight;
      this.pointer.active = true;
      if (down != null) this.pointer.down = down;
      this._updateTouchAxes();
    };

    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture?.(e.pointerId);
      setPointer(e.clientX, e.clientY, true);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (this.pointer.down) setPointer(e.clientX, e.clientY, null);
    });
    canvas.addEventListener('pointerup', (e) => {
      setPointer(e.clientX, e.clientY, false);
      this._touchJump = false;
      this._touchMove = 0;
    });
    canvas.addEventListener('pointercancel', () => {
      this.pointer.down = false;
      this._touchJump = false;
      this._touchMove = 0;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setJumpPad(x, y, w, h) {
    this.jumpPad = { x, y, w, h };
  }

  _updateTouchAxes() {
    if (!this.pointer.down) {
      this._touchJump = false;
      this._touchMove = 0;
      return;
    }
    const { x, y } = this.pointer;
    const pad = this.jumpPad;
    this._touchJump =
      x >= pad.x && x <= pad.x + pad.w && y >= pad.y && y <= pad.y + pad.h;

    const W = this.canvas.clientWidth || 1;
    // Left 55% of screen: horizontal move from center of that zone
    if (x < W * 0.55) {
      const mid = W * 0.28;
      this._touchMove = Math.max(-1, Math.min(1, (x - mid) / (W * 0.22)));
    } else if (!this._touchJump) {
      this._touchMove = 0;
    }
  }

  down(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  hit(...codes) {
    return codes.some((c) => this.pressed.has(c));
  }

  endFrame() {
    this.pressed.clear();
  }

  /** @returns {{ move: number, jump: boolean }} */
  controls() {
    let move = this._touchMove;
    if (this.down('KeyA', 'ArrowLeft')) move = -1;
    if (this.down('KeyD', 'ArrowRight')) move = 1;
    if (this.down('KeyA', 'ArrowLeft') && this.down('KeyD', 'ArrowRight')) move = 0;

    const jump =
      this.down('Space', 'KeyW', 'ArrowUp') || this._touchJump || this.hit('Space', 'KeyW', 'ArrowUp');

    return { move, jump };
  }
}
