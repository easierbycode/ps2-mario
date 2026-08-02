// QuickJS's built-in `std` module, as the browser build sees it.
//
// ps2/lib/tiled.js does `import * as std from "std"` — the module form
// AthenaEnv resolves natively on a real PS2. Vite aliases that specifier
// here (vite.config.js). Lookups are deferred to call time because the
// AthenaEnv globals are installed by Ps2Scene.create(), which runs after
// the module graph is evaluated.

interface Std {
  loadFile(path: string): string | null
  open(path: string, mode: string): { puts(data: string): void; close(): void }
}

const std = () => {
  const s = (globalThis as unknown as { std?: Std }).std
  if (!s) throw new Error('5velte-ps2: the `std` global is not installed yet')
  return s
}

export function loadFile(path: string): string | null {
  return std().loadFile(path)
}

export function open(path: string, mode: string) {
  return std().open(path, mode)
}
