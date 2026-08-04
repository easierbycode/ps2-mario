// PadSource for 5velte-ps2's Phaser host: answers PS2 button-mask queries
// from the keyboard and connected Gamepads. refresh() runs once per frame,
// before runtime.tick(), so justPressed edges line up with game frames.
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

/** where a pad puts the four face buttons — by position, not by label */
type ButtonLayout = {
  bottom: number
  right: number
  left: number
  top: number
  l1?: number
  r1?: number
  select?: number
  start?: number
}

type PadProfile = {
  name: string
  /** gamepad button index -> PS2 mask */
  buttons: Array<number | undefined>
  /** ids this profile claims, matched when the browser has no mapping */
  match?: RegExp
}

/** a sparse index -> mask table from a pad's physical layout */
function layout(l: ButtonLayout): Array<number | undefined> {
  const map: Array<number | undefined> = []
  map[l.bottom] = PAD_BUTTONS.CROSS
  map[l.right] = PAD_BUTTONS.CIRCLE
  map[l.left] = PAD_BUTTONS.SQUARE
  map[l.top] = PAD_BUTTONS.TRIANGLE
  if (l.l1 !== undefined) map[l.l1] = PAD_BUTTONS.L1
  if (l.r1 !== undefined) map[l.r1] = PAD_BUTTONS.R1
  if (l.select !== undefined) map[l.select] = PAD_BUTTONS.SELECT
  if (l.start !== undefined) map[l.start] = PAD_BUTTONS.START
  return map
}

const STANDARD: PadProfile = { name: 'standard', buttons: GAMEPAD_MAP }

// The browser only reports mapping "standard" for pads it recognises;
// everything else comes back in raw HID order, and the standard table above
// then lands almost nowhere. That is the SNES pad story exactly: the USB
// SNES clones put SELECT and START on 8 and 9 like the standard mapping
// does, so such a pad could start the game and then do nothing in it.

// DragonRise (vendor 0079), GreenAsia (0e8f), PCS "twin USB" (0810) and the
// rest of the USB SNES/NES clone family: face buttons in SNES report order
// (X, A, B, Y), d-pad on axes 0/1.
const RETRO: PadProfile = {
  name: 'retro',
  buttons: layout({ bottom: 2, right: 1, left: 3, top: 0, l1: 4, r1: 5, select: 8, start: 9 }),
}

// 8BitDo's SN30 / SF30 family in D mode, d-pad on the hat. Their X-input and
// Switch modes come back as standard mappings and never reach here.
const EIGHTBITDO: PadProfile = {
  name: '8bitdo',
  match: /2dc8|c82d|8bitdo/i,
  buttons: layout({ bottom: 1, right: 0, left: 4, top: 3, l1: 6, r1: 7, select: 10, start: 11 }),
}

/** profiles for unmapped pads, most specific first; RETRO is the fallback */
const DINPUT_PROFILES = [EIGHTBITDO, RETRO]

/**
 * `?pad=retro`, `?pad=8bitdo` or `?pad=standard` forces a profile, the same
 * runtime lever `?debug` is. A pad nobody has profiled yet gets treated as a
 * SNES clone, which is the common case but not the only one.
 */
const FORCED_PROFILE =
  typeof location !== 'undefined'
    ? (new URLSearchParams(location.search).get('pad') ?? '').toLowerCase()
    : ''

function pickProfile(pad: Gamepad): PadProfile {
  const forced = [STANDARD, ...DINPUT_PROFILES].find((p) => p.name === FORCED_PROFILE)
  if (forced) return forced
  if (pad.mapping === 'standard') return STANDARD
  const known = DINPUT_PROFILES.find((p) => p.match?.test(pad.id))
  if (known) return known
  // An unrecognised pad that still reports buttons up at 12-15 keeps its
  // d-pad there, standard-mapping style; the SNES clones stop at 10 or 12
  // buttons. Only those get reshuffled — a big pad the browser merely failed
  // to name is likelier to be standard-shaped than SNES-shaped.
  return pad.buttons.length < 14 ? RETRO : STANDARD
}

// --- friendly names -------------------------------------------------------
//
// The title screen's ASSIGN PADS menu names a port ("PAD 2") because that is
// all a PS2 knows about it. The browser knows more: every Gamepad carries an
// id, so the menu can say DUAL SHOCK 4 or SNES CONTROLLER and a player can
// tell which row is theirs without unplugging anything to find out.

/** long enough for SNES CONTROLLER, short enough to keep the menu one line */
const MAX_NAME = 16

/**
 * The vendor:product pair a browser buries in the pad id.
 *
 * Chrome appends "(STANDARD GAMEPAD Vendor: 054c Product: 09cc)"; Firefox
 * puts the same two ids up front as "054c-09cc-Wireless Controller".
 */
function modelKey(id: string) {
  const chrome = /vendor:\s*([0-9a-f]{4})\s+product:\s*([0-9a-f]{4})/i.exec(id)
  const firefox = /^([0-9a-f]{4})-([0-9a-f]{4})/i.exec(id)
  const found = chrome ?? firefox
  return found ? `${found[1]}:${found[2]}`.toLowerCase() : ''
}

/** the models worth naming exactly, by vendor:product */
const MODEL_NAMES: Record<string, string> = {
  '054c:0268': 'DUAL SHOCK 3',
  '054c:05c4': 'DUAL SHOCK 4',
  '054c:09cc': 'DUAL SHOCK 4',
  '054c:0ba0': 'DUAL SHOCK 4',
  '054c:0ce6': 'DUALSENSE',
  '054c:0df2': 'DUALSENSE',
  '057e:2006': 'JOY-CON L',
  '057e:2007': 'JOY-CON R',
  '057e:2009': 'SWITCH PRO',
  '057e:200e': 'JOY-CON',
  '057e:2017': 'SNES CONTROLLER',
  '057e:2019': 'N64 CONTROLLER',
  '18d1:9400': 'STADIA',
  '1949:0402': 'LUNA',
}

/** what a pad calls itself, when the exact model isn't in the table */
const NAME_PATTERNS: Array<[RegExp, string]> = [
  [/dualsense/i, 'DUALSENSE'],
  [/dual\s*shock|playstation|\bps[2345]\b/i, 'DUAL SHOCK'],
  [/xbox|x-?input/i, 'XBOX PAD'],
  [/stadia/i, 'STADIA'],
  [/luna/i, 'LUNA'],
  [/steam/i, 'STEAM PAD'],
  [/joy-?con/i, 'JOY-CON'],
  [/pro controller/i, 'SWITCH PRO'],
  [/8bitdo/i, '8BITDO PAD'],
  [/super nintendo|\bsnes\b|\bsfc\b/i, 'SNES CONTROLLER'],
  [/famicom|\bnes\b/i, 'NES CONTROLLER'],
  [/nintendo 64|\bn64\b/i, 'N64 CONTROLLER'],
  [/mega ?drive|genesis/i, 'GENESIS PAD'],
  [/saturn/i, 'SATURN PAD'],
  [/logitech/i, 'LOGITECH PAD'],
]

/**
 * Vendors whose no-name pads are all the same thing. The clone family the
 * RETRO profile exists for ships as "USB Gamepad" and nothing else, so its
 * vendor id is the only place SNES is written down.
 */
const VENDOR_NAMES: Record<string, string> = {
  '0079': 'SNES CONTROLLER', // DragonRise
  '0e8f': 'SNES CONTROLLER', // GreenAsia
  '0810': 'SNES CONTROLLER', // PCS "twin USB"
  '2dc8': '8BITDO PAD',
  '054c': 'PLAYSTATION',
  '045e': 'XBOX PAD',
  '057e': 'NINTENDO PAD',
  '18d1': 'STADIA',
  '1949': 'LUNA',
  '28de': 'STEAM PAD',
  '046d': 'LOGITECH PAD',
}

/** the id with the browser's bookkeeping stripped off, as a last resort */
function cleanId(id: string) {
  const bare = id
    .replace(/\([^)]*\)/g, ' ') // Chrome's "(STANDARD GAMEPAD Vendor: ...)"
    .replace(/^[0-9a-f]{4}-[0-9a-f]{4}-/i, ' ') // Firefox's leading ids
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
  if (!bare) return 'GAMEPAD'
  if (bare.length <= MAX_NAME) return bare
  // cut on a word boundary when there is one to cut on
  const cut = bare.slice(0, MAX_NAME)
  const space = cut.lastIndexOf(' ')
  return (space > MAX_NAME / 2 ? cut.slice(0, space) : cut).trim()
}

/** a name for the ASSIGN PADS menu — the model when we know it, else the id */
function friendlyName(pad: Gamepad) {
  const key = modelKey(pad.id)
  const model = MODEL_NAMES[key]
  if (model) return model
  const called = NAME_PATTERNS.find(([re]) => re.test(pad.id))
  if (called) return called[1]
  const vendor = VENDOR_NAMES[key.slice(0, 4)]
  if (vendor) return vendor
  return cleanId(pad.id)
}

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

/** the HID hat switch's usual axis slot on an unmapped pad */
const HAT_AXIS = 9

/** the hat's eight positions, clockwise from north */
const HAT_MASKS = [
  PAD_BUTTONS.UP,
  PAD_BUTTONS.UP | PAD_BUTTONS.RIGHT,
  PAD_BUTTONS.RIGHT,
  PAD_BUTTONS.DOWN | PAD_BUTTONS.RIGHT,
  PAD_BUTTONS.DOWN,
  PAD_BUTTONS.DOWN | PAD_BUTTONS.LEFT,
  PAD_BUTTONS.LEFT,
  PAD_BUTTONS.UP | PAD_BUTTONS.LEFT,
]

/**
 * Decode an HID hat switch: the eight directions arrive evenly spaced from
 * -1 (north) to 1 (north-west), and the centred null state sits outside that
 * range (~1.29). A driver that parks the hat at exactly 0 is indistinguishable
 * from "south-ish", so 0 counts as centred rather than a phantom DOWN.
 */
function hatMask(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return 0
  if (value === 0 || Math.abs(value) > 1.05) return 0
  return HAT_MASKS[Math.round((value + 1) * 3.5)] ?? 0
}

export class WebPadSource implements PadSource {
  private keysDown = new Set<string>()
  private cur = new Array<number>(MAX_PORTS).fill(0)
  private prev = new Array<number>(MAX_PORTS).fill(0)
  private axes: Record<AxisName, number>[] = Array.from({ length: MAX_PORTS }, () => ({
    lx: 0, ly: 0, rx: 0, ry: 0,
  }))
  /** profile per pad, resolved once and logged so a bad guess is visible */
  private profiles = new Map<string, PadProfile>()
  /** friendly name of whatever answers each port, '' for an empty one */
  private names = new Array<string>(MAX_PORTS).fill('')
  /** name per pad id — refresh() runs every frame, the regexes need not */
  private nameCache = new Map<string, string>()

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
      this.names[port] = pad ? this.nameFor(pad) : ''
      if (pad) {
        const profile = this.profileFor(pad)
        pad.buttons.forEach((b, i) => {
          if (b.pressed && profile.buttons[i] !== undefined) mask |= profile.buttons[i]!
        })
        axes.lx = pad.axes[0] ?? 0
        axes.ly = pad.axes[1] ?? 0
        axes.rx = pad.axes[2] ?? 0
        axes.ry = pad.axes[3] ?? 0
        // the game only reads the d-pad, so fold the left stick into it —
        // and on an unmapped pad that is where the d-pad itself usually is
        if (axes.lx <= -STICK_THRESHOLD) mask |= PAD_BUTTONS.LEFT
        if (axes.lx >= STICK_THRESHOLD) mask |= PAD_BUTTONS.RIGHT
        if (axes.ly <= -STICK_THRESHOLD) mask |= PAD_BUTTONS.UP
        if (axes.ly >= STICK_THRESHOLD) mask |= PAD_BUTTONS.DOWN
        // the rest of them hang it off a hat instead. A standard mapping
        // never has one — its d-pad is buttons 12-15 — so only look here.
        if (profile !== STANDARD && pad.axes.length > HAT_AXIS) {
          mask |= hatMask(pad.axes[HAT_AXIS])
        }
      }

      this.cur[port] = mask
    }
  }

  private profileFor(pad: Gamepad) {
    const key = `${pad.index}:${pad.id}`
    const known = this.profiles.get(key)
    if (known) return known

    const profile = pickProfile(pad)
    this.profiles.set(key, profile)
    console.info(
      `[ps2-mario] pad ${pad.index} "${pad.id}" (mapping "${pad.mapping || 'none'}")` +
        ` -> ${this.nameFor(pad)}, ${profile.name} buttons.` +
        ` Wrong? try ?pad=retro, ?pad=8bitdo or ?pad=standard`,
    )
    return profile
  }

  private nameFor(pad: Gamepad) {
    const known = this.nameCache.get(pad.id)
    if (known !== undefined) return known
    const name = friendlyName(pad)
    this.nameCache.set(pad.id, name)
    return name
  }

  /**
   * What to call the pad on a port, for the ASSIGN PADS menu. Empty when
   * nothing is plugged in there, and the menu falls back to the port number.
   */
  portName(port: number) {
    return this.names[port] ?? ''
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
