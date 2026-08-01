// PadSource for 5velte-ps2's Phaser host: answers PS2 button-mask queries
// from the keyboard and the first connected Gamepad (standard mapping).
// refresh() runs once per frame, before runtime.tick(), so justPressed edges
// line up with game frames.
//
// Mario is single-player, so the base runtime's single-port Pads is enough —
// no per-port fan-out like the 4-player builds need.

import { PAD_BUTTONS } from '5velte-ps2'
import type { PadSource } from '5velte-ps2/phaser'

export type AxisName = 'lx' | 'ly' | 'rx' | 'ry'

// Standard-mapping gamepad button index -> PS2 mask.
//
// The control scheme is SMB's: bottom face button is A (jump = CROSS) and
// the left face button is B (run / boost / fireball = SQUARE). The right
// face button — the one labelled B on an Xbox-layout pad — is mapped to
// SQUARE as well, so "press B to run" is true whichever label the pad wears;
// it also keeps CIRCLE, so the Konami code (…B A) stays enterable there.
const GAMEPAD_MAP: Array<number | undefined> = [
  PAD_BUTTONS.CROSS, // 0 bottom face — A / jump
  PAD_BUTTONS.SQUARE | PAD_BUTTONS.CIRCLE, // 1 right face — the "B" button
  PAD_BUTTONS.SQUARE, // 2 left face — B / run / boost / fireball
  PAD_BUTTONS.TRIANGLE, // 3 top face
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
  private cur = 0
  private prev = 0
  private axes: Record<AxisName, number> = { lx: 0, ly: 0, rx: 0, ry: 0 }

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
    this.prev = this.cur

    let mask = 0
    for (const code of this.keysDown) mask |= KEY_MAP[code] ?? 0

    this.axes.lx = this.axes.ly = this.axes.rx = this.axes.ry = 0

    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : []
    const pad = Array.prototype.find.call(pads, (p: Gamepad | null) => p && p.connected) as Gamepad | undefined
    if (pad) {
      pad.buttons.forEach((b, i) => {
        if (b.pressed && GAMEPAD_MAP[i] !== undefined) mask |= GAMEPAD_MAP[i]!
      })
      this.axes.lx = pad.axes[0] ?? 0
      this.axes.ly = pad.axes[1] ?? 0
      this.axes.rx = pad.axes[2] ?? 0
      this.axes.ry = pad.axes[3] ?? 0
      // the game only reads the d-pad, so fold the left stick into it
      if (this.axes.lx <= -STICK_THRESHOLD) mask |= PAD_BUTTONS.LEFT
      if (this.axes.lx >= STICK_THRESHOLD) mask |= PAD_BUTTONS.RIGHT
      if (this.axes.ly <= -STICK_THRESHOLD) mask |= PAD_BUTTONS.UP
      if (this.axes.ly >= STICK_THRESHOLD) mask |= PAD_BUTTONS.DOWN
    }

    this.cur = mask
  }

  // PadSource contract
  held(mask: number) {
    return (this.cur & mask) !== 0
  }

  fresh(mask: number) {
    return (this.cur & mask) !== 0 && (this.prev & mask) === 0
  }

  axis(name: AxisName) {
    return this.axes[name] ?? 0
  }
}
