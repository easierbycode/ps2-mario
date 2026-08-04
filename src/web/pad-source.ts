// PadSource for 5velte-ps2's Phaser host: answers PS2 button-mask queries
// from the keyboard and connected Gamepads (standard mapping). refresh()
// runs once per frame, before runtime.tick(), so justPressed edges line up
// with game frames.
//
// Mario's 2-player mode reads pad ports the way a real PS2 does, so this
// source fans out per port: the k-th connected gamepad answers port k, and
// the keyboard merges into port 0. The base runtime's Pads ignores ports —
// ps2-scene.ts overlays a port-aware Pads global on top of this source.

import { PAD_BUTTONS } from '5velte-ps2'
import type { PadSource } from '5velte-ps2/phaser'

export const MAX_PORTS = 4

export type AxisName = 'lx' | 'ly' | 'rx' | 'ry'

// Standard-mapping gamepad button index -> PS2 mask.
//
// The control scheme is SMB's, and it maps by position on every pad whatever
// the labels say: A (jump) is the bottom face button, B (run / fireball) the
// left one. The standard mapping is already positional, so the indices line
// up with the PS2's own face-button layout.
const GAMEPAD_MAP: Array<number | undefined> = [
  PAD_BUTTONS.CROSS, // 0 bottom face — A / jump
  PAD_BUTTONS.CIRCLE, // 1 right face
  PAD_BUTTONS.SQUARE, // 2 left face — B / run / fireball
  PAD_BUTTONS.TRIANGLE, // 3 top face — the debug boost
  PAD_BUTTONS.L1, // 4
  PAD_BUTTONS.R1, // 5
  PAD_BUTTONS.L2, // 6
  PAD_BUTTONS.R2, // 7
  PAD_BUTTONS.SELECT, // 8
  PAD_BUTTONS.START, // 9
  PAD_BUTTONS.L3, // 10
  PAD_BUTTONS.R3, // 11
  PAD_BUTTONS.UP, // 12
  PAD_BUTTONS.DOWN, // 13
  PAD_BUTTONS.LEFT, // 14
  PAD_BUTTONS.RIGHT, // 15
]

const KEY_MAP: Record<string, number> = {
  ArrowUp: PAD_BUTTONS.UP,
  ArrowDown: PAD_BUTTONS.DOWN,
  ArrowLeft: PAD_BUTTONS.LEFT,
  ArrowRight: PAD_BUTTONS.RIGHT,
  KeyW: PAD_BUTTONS.UP,
  KeyS: PAD_BUTTONS.DOWN,
  KeyA: PAD_BUTTONS.LEFT,
  KeyD: PAD_BUTTONS.RIGHT,
  Space: PAD_BUTTONS.CROSS,
  KeyX: PAD_BUTTONS.CROSS,
  ShiftLeft: PAD_BUTTONS.SQUARE,
  KeyZ: PAD_BUTTONS.SQUARE,
  KeyC: PAD_BUTTONS.CIRCLE,
  KeyV: PAD_BUTTONS.TRIANGLE,
  Enter: PAD_BUTTONS.START,
  Backspace: PAD_BUTTONS.SELECT,
}

/** analog stick pushed at least this far counts as a d-pad press */
const STICK_THRESHOLD = 0.5

export class WebPadSource implements PadSource {
  private keysDown = new Set<string>()
  private cur = new Array<number>(MAX_PORTS).fill(0)
  private prev = new Array<number>(MAX_PORTS).fill(0)
  private axes: Record<AxisName, number>[] = Array.from({ length: MAX_PORTS }, () => ({
    lx: 0, ly: 0, rx: 0, ry: 0,
  }))

  private onKeyDown = (e: KeyboardEvent) => {
    if (KEY_MAP[e.code] !== undefined) {
      e.preventDefault()
      this.keysDown.add(e.code)
    }
  }

  private onKeyUp = (e: KeyboardEvent) => {
    this.keysDown.delete(e.code)
  }

  constructor() {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
  }

  destroy() {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
  }

  /** call once per frame, before runtime.tick() */
  refresh() {
    const gamepads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : []
    const connected = Array.prototype.filter.call(
      gamepads,
      (p: Gamepad | null) => p && p.connected,
    ) as Gamepad[]

    for (let port = 0; port < MAX_PORTS; port++) {
      this.prev[port] = this.cur[port]

      let mask = 0
      // the keyboard is port 0's controller
      if (port === 0) for (const code of this.keysDown) mask |= KEY_MAP[code] ?? 0

      const axes = this.axes[port]
      axes.lx = axes.ly = axes.rx = axes.ry = 0

      // the k-th connected gamepad answers port k
      const pad = connected[port]
      if (pad) {
        pad.buttons.forEach((b, i) => {
          if (b.pressed && GAMEPAD_MAP[i] !== undefined) mask |= GAMEPAD_MAP[i]!
        })
        axes.lx = pad.axes[0] ?? 0
        axes.ly = pad.axes[1] ?? 0
        axes.rx = pad.axes[2] ?? 0
        axes.ry = pad.axes[3] ?? 0
        // the game only reads the d-pad, so fold the left stick into it
        if (axes.lx <= -STICK_THRESHOLD) mask |= PAD_BUTTONS.LEFT
        if (axes.lx >= STICK_THRESHOLD) mask |= PAD_BUTTONS.RIGHT
        if (axes.ly <= -STICK_THRESHOLD) mask |= PAD_BUTTONS.UP
        if (axes.ly >= STICK_THRESHOLD) mask |= PAD_BUTTONS.DOWN
      }

      this.cur[port] = mask
    }
  }

  // per-port queries, used by the port-aware Pads overlay in ps2-scene.ts
  portHeld(port: number, mask: number) {
    return ((this.cur[port] ?? 0) & mask) !== 0
  }

  portFresh(port: number, mask: number) {
    return ((this.cur[port] ?? 0) & mask) !== 0 && ((this.prev[port] ?? 0) & mask) === 0
  }

  // PadSource contract — the host's own single-port view answers as port 0
  held(mask: number) {
    return this.portHeld(0, mask)
  }

  fresh(mask: number) {
    return this.portFresh(0, mask)
  }

  axis(name: AxisName) {
    return this.axes[0][name] ?? 0
  }
}
