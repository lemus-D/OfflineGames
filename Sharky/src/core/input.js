/* Pointer + touch + keyboard → one aim vector and boost flag. */

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.pointer = { x: 0, y: 0, active: false, down: false };
    this.boost = false;
    this._rect = () => canvas.getBoundingClientRect();

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
      this.boost = false;
    });

    const setPointer = (clientX, clientY, down) => {
      const r = this._rect();
      this.pointer.x = ((clientX - r.left) / r.width) * canvas.clientWidth;
      this.pointer.y = ((clientY - r.top) / r.height) * canvas.clientHeight;
      this.pointer.active = true;
      if (down != null) this.pointer.down = down;
    };

    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture?.(e.pointerId);
      setPointer(e.clientX, e.clientY, true);
    });
    canvas.addEventListener('pointermove', (e) => {
      setPointer(e.clientX, e.clientY, null);
    });
    canvas.addEventListener('pointerup', (e) => {
      setPointer(e.clientX, e.clientY, false);
    });
    canvas.addEventListener('pointercancel', () => {
      this.pointer.down = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  hit(...codes) {
    return codes.some((c) => this.pressed.has(c));
  }

  /** Consume edge presses once per frame. */
  endFrame() {
    this.pressed.clear();
  }

  /**
   * Aim vector in screen space relative to a screen-space player position.
   * Returns { ax, ay, mag, boost }.
   */
  aim(screenX, screenY) {
    let ax = 0,
      ay = 0;
    if (this.pointer.active) {
      ax = this.pointer.x - screenX;
      ay = this.pointer.y - screenY;
    }
    if (this.down('KeyW', 'ArrowUp')) ay -= 1;
    if (this.down('KeyS', 'ArrowDown')) ay += 1;
    if (this.down('KeyA', 'ArrowLeft')) ax -= 1;
    if (this.down('KeyD', 'ArrowRight')) ax += 1;

    // Keyboard-only: give a unit direction so drag still works.
    if (!this.pointer.active || (Math.abs(ax) < 1 && Math.abs(ay) < 1 && this._keyboardActive())) {
      ax = 0;
      ay = 0;
      if (this.down('KeyW', 'ArrowUp')) ay -= 180;
      if (this.down('KeyS', 'ArrowDown')) ay += 180;
      if (this.down('KeyA', 'ArrowLeft')) ax -= 180;
      if (this.down('KeyD', 'ArrowRight')) ax += 180;
    }

    const mag = Math.hypot(ax, ay);
    const boost = this.down('Space') || this.pointer.down;
    return { ax, ay, mag, boost };
  }

  _keyboardActive() {
    return this.down(
      'KeyW',
      'KeyA',
      'KeyS',
      'KeyD',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight'
    );
  }
}
