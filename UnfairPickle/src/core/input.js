/* Keyboard platformer controls. Brief: keyboard only this version. */

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const c = e.code;
      if (
        ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c)
      ) {
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

  /** @returns {{ move: number, jump: boolean, jumpHeld: boolean, restart: boolean }} */
  controls() {
    let move = 0;
    if (this.down('KeyA', 'ArrowLeft')) move -= 1;
    if (this.down('KeyD', 'ArrowRight')) move += 1;
    return {
      move,
      jump: this.hit('Space', 'ArrowUp', 'KeyW'),
      jumpHeld: this.down('Space', 'ArrowUp', 'KeyW'),
      restart: this.hit('KeyR'),
    };
  }
}
