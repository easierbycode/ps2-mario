// Debug build switch, shared by all three targets.
//
// Flip DEFAULT to true to bake a debug disc/NRO. Hosts that can be told at
// runtime set `globalThis.__DEBUG` before the game boots instead: the
// browser build reads `?debug` from the URL, and the Switch host takes
// `--debug` on the command line (nxlink -s ps2-mario.nro -- --debug). A real
// PS2 has neither, so there the constant is the only lever.
const DEFAULT = false;

export function isDebug() {
  const override = globalThis.__DEBUG;
  return typeof override === 'boolean' ? override : DEFAULT;
}
