# Mario — PlayStation 2

A Super Mario Bros platformer built on
[5velte-ps2](https://github.com/easierbycode/svelte-ps2) — the AthenaEnv v4
compatibility layer. **One JS codebase, three targets:**

- **Real PS2 / PCSX2 / Play!** — [`ps2/`](ps2/) is a complete
  [AthenaEnv](https://github.com/DanielSant0s/AthenaEnv) app (athena.elf +
  `main.js` + assets) packaged into a bootable ISO9660 image.
- **Browser** — the same `ps2/` modules run unmodified on Phaser 4 via
  5velte-ps2's host: [`src/web/ps2-scene.ts`](src/web/ps2-scene.ts) installs
  AthenaEnv's globals (`Screen`, `Draw`, `Image`, `Font`, `Pads`, `std`, …),
  imports `ps2/main.js`, and ticks the runtime every frame.
- **Nintendo Switch (homebrew)** — the same modules a third time, on
  [quickjs-ng](https://github.com/quickjs-ng/quickjs) + SDL2 via the native
  host in [`switch/`](switch/): ~1.5k lines of C (devkitPro/libnx) implement
  the same globals and evaluate `ps2/main.js` out of romfs, producing a
  `.nro` for hbmenu on CFW (Atmosphère). See
  [Nintendo Switch build](#nintendo-switch-build).

Download page + browser build + ISO deploy to
**<https://easierbycode.com/ps2-mario/>** on every push to `main`
([.github/workflows/deploy.yml](.github/workflows/deploy.yml)), which also
pokes the [CMG launcher](https://github.com/easierbycode/cmg) so its
PlayStation 2 screen picks up the new web build and disc image.

The NRO is the only artifact built against a third-party package server
(pkg.devkitpro.org, which 403s often enough to matter), so it can't hold the
release hostage: if that job fails the site still publishes, the download
page swaps its Switch button for a note
([`scripts/disable-switch-download.mjs`](scripts/disable-switch-download.mjs)),
and the run goes red so the outage stays visible.

## Run

```sh
npm install
npm run dev        # browser build at http://localhost:5173/play/
npm run build      # production build (base /ps2-mario/)
npm run iso        # deno-powered ISO9660 writer -> ps2-mario.iso
npm run nro        # Switch homebrew build -> switch/ps2-mario.nro
```

The ISO boots in PCSX2, in the CMG launcher's PlayStation 2 screen (the
Play! WASM emulator), and on softmodded hardware (OPL / DVD-R).

## Controls

The scheme is Super Mario Bros': **A jumps, B runs**.

| | PS2 pad | Keyboard |
| --- | --- | --- |
| move | d-pad / left stick | arrows or WASD |
| A — jump | CROSS (bottom face button) | SPACE or X |
| B — run, fireball | SQUARE (left face button) | SHIFT or Z |
| boost (debug builds only) | TRIANGLE (top face button) | V |
| start | START | ENTER |
| select | SELECT | BACKSPACE |

Buttons map **by position on every pad**, whatever the labels print: A is
always the bottom face button and B always the left one. Every host does
its own positional mapping — the PS2's own layout, the browser's standard
Gamepad mapping, and `BTN_SOUTH`/`BTN_WEST` in
[`switch/source/host_pads.c`](switch/source/host_pads.c), which has to undo
devkitPro SDL2's Nintendo labelling.

A solo player is driven by **whichever pad is talking**, so a controller in
port 2 — or a gamepad the browser enumerated behind another one — plays the
game. Two players, or a trip through the title's **ASSIGN PADS** menu, and
the ports mean what they say again.

A port number is all a PS2 can say about a controller, so ASSIGN PADS reads
`P1 PAD 1` there. In the browser the rows name the pad instead — DUAL SHOCK
4, SNES CONTROLLER, STADIA — resolved from the Gamepad id in
[`src/web/pad-source.ts`](src/web/pad-source.ts) and served to the game as
`Pads.getName(port)`. Two of the same pad are numbered apart, and a port
with nothing plugged into it keeps its number.

In the browser, positional mapping only comes free for a pad the browser
recognises. Everything else — the USB SNES clones especially — reports raw
HID order instead, which is how such a pad could press START and then do
nothing in the game. [`src/web/pad-source.ts`](src/web/pad-source.ts)
profiles those by id (the DragonRise / GreenAsia / PCS clone family,
8BitDo's D mode) and takes the d-pad from the stick axes or an HID hat. A
pad nobody has profiled is treated as a SNES clone; `?pad=retro`,
`?pad=8bitdo` or `?pad=standard` overrides that, and the console prints
what each pad resolved to.

The title screen's Konami code is unchanged: ↑↑↓↓←→←→ **CIRCLE CROSS**.

The level editor (**DOWN + SELECT** in game) walks its tile list with
SQUARE / TRIANGLE; unlike the boost those are not gated on a debug build.

### Debug builds

`boost` — 9.8px/frame, roughly a tile per frame — is a cheat, so it only
answers when [`ps2/lib/debug.js`](ps2/lib/debug.js) says the build is a
debug one. Three ways to say so:

- **browser** — add `?debug` to the URL (`/play/?debug`)
- **Switch** — `nxlink -s switch/ps2-mario.nro -- --debug`
- **PS2** — no runtime lever, so flip `DEFAULT` in `ps2/lib/debug.js` and
  rebuild the ISO

## Browser build

`play/` mounts one Svelte component ([`src/App.svelte`](src/App.svelte))
that hosts a single Phaser scene. The canvas takes the largest slice of the
viewport it can: at launch — and on every resize or orientation change — it
picks **ENVELOP** when the viewport's aspect is within 2% of the PS2's 10:7
frame, so a near-matching screen fills edge to edge with no letterbox, and
otherwise **FIT**, the largest picture that still shows the whole frame. The
band is tight on purpose: the HUD sits flush against the frame edges (WORLD
at x=0, COINS against the right edge), so overscan clips it before it clips
anything you could spare.

The `ps2/` tree keeps AthenaEnv's cwd-relative bare specifiers
(`lib/input.js`, `screens/GameScreen.js`, `objects/mario.js`) and QuickJS's
`std` module; [`vite.config.js`](vite.config.js) teaches Vite the same
resolution, and [`src/web/std-module.ts`](src/web/std-module.ts) re-points
`import * as std from "std"` at the `std` global the host installs. The
Tiled maps are inlined as text so `std.loadFile` stays synchronous like it
is on the disc, and level-editor saves land in `localStorage`, shadowing
them.

The Phaser host draws text through a bitmap font, so
`assets/fonts/mania.ttf` is loaded as a web font and rasterized into one at
boot (5velte-ps2's `registerCanvasBitmapFont`).

## Nintendo Switch build

`npm run nro` stages `ps2/` into `switch/romfs/`
([`scripts/stage-switch-romfs.mjs`](scripts/stage-switch-romfs.mjs) — the JS
tree plus every PNG, Tiled map and TTF, layout preserved) and compiles the
host, trying in order: a `DEVKITPRO` env with `make` on PATH, an MSYS2
install with the devkitPro pacman packages at `C:\msys64` (`pacman -S
pkgconf switch-dev switch-sdl2 switch-sdl2_image switch-sdl2_ttf` after
adding the [devkitPro repos](https://devkitpro.org/wiki/devkitPro_pacman)),
then Docker (`devkitpro/devkita64` + portlibs,
[`switch/builder.Dockerfile`](switch/builder.Dockerfile), cached after the
first run). Clone with `--recurse-submodules` — quickjs-ng is vendored at
`switch/vendor/quickjs`.

Dev loop against real hardware: hbmenu → **Y** (netloader), then

```sh
nxlink -s switch/ps2-mario.nro
```

streams stdout — including JS stack traces — back over WiFi. For a PC-free
install copy the NRO to `sd:/switch/ps2-mario.nro`.

Switch specifics: buttons map by **position**, so the bottom face button is
always CROSS (jump) and the left face button always SQUARE (B). The host
adds three globals the PS2 provides natively —
[`host_font.c`](switch/source/host_font.c) renders the HUD's TTF through
SDL2_ttf (with a cache of rendered runs, since the HUD re-prints the same
strings every frame), [`host_std.c`](switch/source/host_std.c) supplies the
`std` module the Tiled loader imports, and `prelude.js` rounds out `Timer`
and `console`. romfs is read-only, so the level editor's saves are accepted
and dropped there.

CI builds the NRO as a private run artifact on every push
([.github/workflows/switch.yml](.github/workflows/switch.yml)); since the
art is ripped, the NRO is for personal use on your own console — don't
publish it.

## Porting notes

Level files are named `level4_2.json`, not `level4-2.json`: ISO9660
identifiers have no hyphen, so the name that survives onto the disc is the
one with an underscore. The HUD prints it back with the dash.

`assets/Transition.png` — the sheet
[`TransitionManager`](ps2/lib/managers/TransitionManager.js) reaches for —
isn't in the tree. AthenaEnv answers with a zero-sized `Image` and the
manager skips drawing; the browser host resolves unknown paths to a
transparent 1x1 for the same effect, rather than throwing out of Phaser's
loader.
