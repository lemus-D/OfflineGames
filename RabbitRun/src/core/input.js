/* Keyboard: lane change + jump. Touch/swipe buttons wired from main. */

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    /** Queued one-shot intents from touch UI. */
    this._laneDelta = 0;
    this._jumpQueued = false;

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

  queueLane(delta) {
    this._laneDelta += delta;
  }

  queueJump() {
    this._jumpQueued = true;
  }

  endFrame() {
    this.pressed.clear();
    this._laneDelta = 0;
    this._jumpQueued = false;
  }

  /** Combined controls for the sim. */
  controls() {
    let laneDelta = this._laneDelta;
    if (this.hit('KeyA', 'ArrowLeft')) laneDelta -= 1;
    if (this.hit('KeyD', 'ArrowRight')) laneDelta += 1;
    const jump =
      this._jumpQueued || this.hit('Space', 'ArrowUp', 'KeyW');
    return { laneDelta, jump };
  }
}
