/* Keyboard-only steering for MVP: left / right. */

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();

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
    addEventListener('blur', () => this.keys.clear());
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

  /** Horizontal steer: -1 left, +1 right, 0 none. */
  steer() {
    let x = 0;
    if (this.down('KeyA', 'ArrowLeft')) x -= 1;
    if (this.down('KeyD', 'ArrowRight')) x += 1;
    return x;
  }
}
