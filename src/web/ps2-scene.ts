// The browser host scene. Preloads every ps2/assets PNG as a texture keyed
// by its AthenaEnv path ("assets/sprites/mario.png"), serves the Tiled maps
// through the `std` file shim, rasterises the game's TTF into the bitmap
// font the Phaser host draws text with, then imports the very same
// ps2/main.js that boots on real hardware and drives it one tick per frame.

import Phaser from 'phaser'
import { createRuntime, type PS2Runtime } from '5velte-ps2'
import { createPhaserHost, registerCanvasBitmapFont } from '5velte-ps2/phaser'
import { WebPadSource } from './pad-source.ts'

const assetUrls = import.meta.glob('../../ps2/assets/**/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

// Tiled maps, read at runtime through std.loadFile(). They are inlined as
// text rather than fetched so a level load stays synchronous, exactly as it
// is on the PS2.
const levelSources = import.meta.glob('../../ps2/assets/tiles/*.json', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const fontUrls = import.meta.glob('../../ps2/assets/fonts/*.ttf', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

/** "../../ps2/assets/sprites/mario.png" -> "assets/sprites/mario.png" */
const athenaPath = (globKey: string) => globKey.replace(/^.*\/ps2\//, '')

const TEXTURES = new Map(Object.entries(assetUrls).map(([k, url]) => [athenaPath(k), url]))
const LEVELS = new Map(Object.entries(levelSources).map(([k, src]) => [athenaPath(k), src]))
const FONTS = new Map(Object.entries(fontUrls).map(([k, url]) => [athenaPath(k), url]))

/** stand-in for an Athena path with no art in the tree (e.g. the unused transition sheet) */
const MISSING_TEXTURE = 'ps2:missing'
/** the one bitmap font every `new Font(...)` resolves to */
const BITMAP_FONT = 'ps2:font'
/** matches the PS2 HUD, whose two rows sit 24px apart */
const FONT_SIZE = 24

export default class Ps2Scene extends Phaser.Scene {
  private runtime?: PS2Runtime
  private pads = new WebPadSource()
  private destroyHost?: () => void
  private ready = false

  constructor() {
    super({ key: 'Ps2Scene' })
  }

  preload() {
    for (const [path, url] of TEXTURES) this.load.image(path, url)
  }

  create() {
    // AthenaEnv hands back a zero-sized Image for a path that isn't on the
    // disc and the game checks for it; Phaser's loader would throw instead,
    // so unknown paths resolve to a transparent 1x1 and simply draw nothing.
    const blank = this.textures.createCanvas(MISSING_TEXTURE, 1, 1)
    blank?.refresh()

    const { host, destroy } = createPhaserHost({
      scene: this,
      pads: this.pads,
      resolveTexture: (path) => (this.textures.exists(path) ? path : MISSING_TEXTURE),
      resolveFont: () => ({ key: BITMAP_FONT }),
      storage: {
        // Tiled maps ship with the build; level-editor saves land in
        // localStorage and shadow them, which is as close to writing back to
        // the disc as the browser gets.
        loadFile: (path) => localStorage.getItem(`ps2-mario:${path}`) ?? LEVELS.get(path) ?? null,
        writeFile: (path, data) => localStorage.setItem(`ps2-mario:${path}`, data),
      },
    })
    this.destroyHost = destroy
    this.runtime = createRuntime(host)

    // AthenaEnv's globals, exactly as a real PS2 provides them. Installed
    // after preload so shadowing window.Image can't break Phaser's loader.
    const g = globalThis as Record<string, unknown>
    const r = this.runtime
    g.Screen = r.Screen
    g.Draw = r.Draw
    g.Color = r.Color
    g.Pads = r.Pads
    g.Image = r.Image
    g.Font = r.Font
    g.Timer = r.Timer
    g.std = r.std
    g.NEAREST = r.NEAREST
    g.LINEAR = r.LINEAR

    this.boot()

    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      this.destroyHost?.()
      this.pads.destroy()
    })
  }

  /** rasterise the TTF, then hand control to the PS2 entry point */
  private async boot() {
    await this.loadBitmapFont()
    await import('../../ps2/main.js')
    this.ready = true
  }

  /**
   * The Phaser host draws text through a bitmap font, so the game's TTF is
   * loaded as a web font and baked into one by 5velte-ps2's canvas helper.
   * A failure here is not fatal — the fallback grid keeps the HUD legible.
   */
  private async loadBitmapFont() {
    const family = 'ps2-mario-font'
    const url = FONTS.values().next().value
    if (url) {
      try {
        const face = new FontFace(family, `url(${url})`)
        await face.load()
        document.fonts.add(face)
      } catch (err) {
        console.warn('[ps2-mario] could not load the game font, falling back to monospace', err)
      }
    }
    registerCanvasBitmapFont(this, BITMAP_FONT, {
      fontFamily: `"${family}", monospace`,
      fontSize: FONT_SIZE,
    })
  }

  update() {
    if (!this.ready || !this.runtime) return
    this.pads.refresh()
    this.runtime.tick()
  }
}
