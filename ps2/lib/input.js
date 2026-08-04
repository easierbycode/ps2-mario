// Pad polling. The control scheme is Super Mario Bros', mapped by button
// position on every pad: A is the bottom face button (CROSS) and jumps, B is
// the left face button (SQUARE) and runs, boosts and — once Mario has the
// flower — throws fireballs.
//
// The top face button (TRIANGLE) carries the debug-only speed boost and, in
// the level editor, the second tile-cycle key.
import { isDebug } from 'lib/debug.js';

/** the PS2's four controller ports */
export const MAX_PORTS = 4;

export function poll(port = 0) {
  const pad = Pads.get(port);

  const pressed  = (btn) => pad.pressed(btn);
  const just     = (btn) => pad.justPressed(btn);

  // the B button — one physical button behind run and fireball
  const b = pressed(Pads.SQUARE);
  const bPressed = just(Pads.SQUARE);
  // the boost is a debug cheat, so it only answers in a debug build
  const debug = isDebug();

  return {
    left:  pressed(Pads.LEFT),
    right: pressed(Pads.RIGHT),
    down:  pressed(Pads.DOWN),
    up: pressed(Pads.UP),
    jump:  pressed(Pads.CROSS),
    run:  b,
    fire: b,
    boost: debug && pressed(Pads.TRIANGLE),
    // one-shot jump edge
    jumpPressed: just(Pads.CROSS),
    runPressed: bPressed,
    firePressed: bPressed,
    boostPressed: debug && just(Pads.TRIANGLE),
    start: just(Pads.START),
    select: just(Pads.SELECT),
    // one-shot d-pad/button edges (used for cheat code detection)
    upPressed: just(Pads.UP),
    downPressed: just(Pads.DOWN),
    leftPressed: just(Pads.LEFT),
    rightPressed: just(Pads.RIGHT),
    crossPressed: just(Pads.CROSS),
    circlePressed: just(Pads.CIRCLE),
    // level editor only — it needs two distinct keys to walk the tile list,
    // and unlike `boost` they are not gated on a debug build
    tilePrevPressed: bPressed,
    tileNextPressed: just(Pads.TRIANGLE),
  };
}

/**
 * What the pad on a port is called, when the host knows. Only the browser
 * does: a Gamepad carries an id, so ASSIGN PADS can say DUAL SHOCK 4 instead
 * of PAD 2. A PS2 sees ports and nothing else, so this reads back empty
 * there and callers name the port instead.
 */
export function padName(port = 0) {
  if (typeof Pads.getName !== 'function') return '';
  return Pads.getName(port) || '';
}

/**
 * Every port merged into one pad — whichever controller is talking drives it.
 * An empty port reads as all-false, so this is just an OR down the fields.
 *
 * Used wherever a single player shouldn't have to care which port they are
 * plugged into: the title menu, and a 1-player game before ASSIGN PADS has
 * pinned anyone to a port.
 */
export function pollAll() {
  const merged = poll(0);
  for (let port = 1; port < MAX_PORTS; port++) {
    const pad = poll(port);
    for (const key in merged) merged[key] = merged[key] || pad[key];
  }
  return merged;
}
