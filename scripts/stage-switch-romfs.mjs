#!/usr/bin/env node
// Stage the ps2/ game tree into switch/romfs for the NRO build.
//
// Mirrors scripts/build-athena-iso.ts's selection — everything the PS2 ISO
// carries except athena.elf/athena.ini — with the directory layout kept
// byte-for-byte, because both the module loader (switch/source/js_module.c)
// and every asset path in the game resolve against it: "lib/input.js",
// "assets/sprites/mario.png", "assets/tiles/level1.json".
import { cpSync, copyFileSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ps2 = join(root, 'ps2')
const out = join(root, 'switch', 'romfs')

rmSync(out, { recursive: true, force: true })
mkdirSync(join(out, 'game'), { recursive: true })
mkdirSync(join(out, 'host'), { recursive: true })

// game code, same relative layout the module loader resolves against
copyFileSync(join(ps2, 'main.js'), join(out, 'game', 'main.js'))
for (const dir of ['lib', 'objects', 'screens']) {
  cpSync(join(ps2, dir), join(out, 'game', dir), { recursive: true })
}

// assets, recursively — PNG sheets, Tiled maps and the HUD font
const KEEP = /\.(png|json|ttf)$/i
let staged = 0
const stageAssets = (rel) => {
  mkdirSync(join(out, 'game', rel), { recursive: true })
  for (const name of readdirSync(join(ps2, rel))) {
    const from = join(ps2, rel, name)
    if (statSync(from).isDirectory()) {
      stageAssets(join(rel, name))
    } else if (KEEP.test(name)) {
      copyFileSync(from, join(out, 'game', rel, name))
      staged++
    }
  }
}
stageAssets('assets')

// the host's own JS half (Color/Timer), evaluated before main.js
copyFileSync(join(root, 'switch', 'source', 'prelude.js'), join(out, 'host', 'prelude.js'))

console.log(`staged switch/romfs: game tree + ${staged} asset${staged === 1 ? '' : 's'}`)
