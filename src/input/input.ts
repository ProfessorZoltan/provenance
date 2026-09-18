// Unified input. Keyboard and the standard-mapping Gamepad API both produce the same semantic buttons,
// and the body's data-device attribute tells the UI which glyphs to show in prompts.

export type Button =
  | 'up' | 'down' | 'left' | 'right'
  | 'a' | 'b' | 'x' | 'y' | 'lb' | 'rb' | 'lt' | 'rt' | 'start' | 'select'
  | 'scrollUp' | 'scrollDown';

export type Device = 'keyboard' | 'gamepad';
export type Handler = (btn: Button) => void;

const KEYS: Record<string, Button> = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Enter: 'a', Space: 'a', Escape: 'b', Backspace: 'b', KeyX: 'x', KeyY: 'y',
  KeyQ: 'lb', KeyE: 'rb', KeyZ: 'lt', KeyC: 'rt', KeyM: 'start', Tab: 'select',
  PageUp: 'scrollUp', PageDown: 'scrollDown',
};

const PAD_BUTTONS: Record<number, Button> = {
  0: 'a', 1: 'b', 2: 'x', 3: 'y', 4: 'lb', 5: 'rb', 6: 'lt', 7: 'rt', 8: 'select', 9: 'start',
  12: 'up', 13: 'down', 14: 'left', 15: 'right',
};

export class Input {
  private handlers = new Set<Handler>();
  private device: Device = 'keyboard';
  private held = new Map<string, number>();
  private padConnected = false;
  private raf = 0;
  private onDeviceChange: ((d: Device) => void)[] = [];
  private paused = false;

  constructor() {
    window.addEventListener('keydown', (e) => {
      const btn = KEYS[e.code];
      if (!btn) return;
      if (e.code === 'Tab' || e.code === 'Space' || e.code === 'Backspace' || e.code.startsWith('Arrow')) e.preventDefault();
      if (e.repeat && !['up', 'down', 'left', 'right', 'scrollUp', 'scrollDown'].includes(btn)) return;
      this.setDevice('keyboard');
      this.emit(btn);
    });
    window.addEventListener('gamepadconnected', () => { this.padConnected = true; this.setDevice('gamepad'); });
    window.addEventListener('gamepaddisconnected', () => { this.padConnected = false; });
    this.poll = this.poll.bind(this);
    this.raf = requestAnimationFrame(this.poll);
  }

  on(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  deviceChanged(cb: (d: Device) => void): void {
    this.onDeviceChange.push(cb);
  }

  getDevice(): Device {
    return this.device;
  }

  hasGamepad(): boolean {
    return this.padConnected;
  }

  setPaused(p: boolean): void {
    this.paused = p;
  }

  emit(btn: Button): void {
    if (this.paused) return;
    for (const h of [...this.handlers]) h(btn);
  }

  private setDevice(d: Device): void {
    if (this.device === d) return;
    this.device = d;
    document.body.dataset.device = d;
    for (const cb of this.onDeviceChange) cb(d);
  }

  private poll(): void {
    this.raf = requestAnimationFrame(this.poll);
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    const now = performance.now();
    for (const pad of pads) {
      if (!pad) continue;
      this.padConnected = true;
      const pressed = new Set<Button>();
      pad.buttons.forEach((b, i) => {
        const btn = PAD_BUTTONS[i];
        if (btn && (b.pressed || b.value > 0.6)) pressed.add(btn);
      });
      const ax = pad.axes[0] ?? 0, ay = pad.axes[1] ?? 0, ry = pad.axes[3] ?? 0;
      if (ay < -0.5) pressed.add('up');
      if (ay > 0.5) pressed.add('down');
      if (ax < -0.5) pressed.add('left');
      if (ax > 0.5) pressed.add('right');
      if (ry < -0.5) pressed.add('scrollUp');
      if (ry > 0.5) pressed.add('scrollDown');
      for (const btn of pressed) {
        const key = `${pad.index}:${btn}`;
        const since = this.held.get(key);
        const repeatable = ['up', 'down', 'left', 'right', 'scrollUp', 'scrollDown'].includes(btn);
        if (since === undefined) {
          this.held.set(key, now);
          this.setDevice('gamepad');
          this.emit(btn);
        } else if (repeatable && now - since > 380) {
          this.held.set(key, now - 260);
          this.emit(btn);
        }
      }
      for (const key of [...this.held.keys()]) {
        if (key.startsWith(`${pad.index}:`) && !pressed.has(key.split(':')[1] as Button)) this.held.delete(key);
      }
    }
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
  }
}
