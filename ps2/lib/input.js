// Pad polling. The control scheme is Super Mario Bros': CROSS is A (jump),
// SQUARE is B — the left face button — and B is what runs, boosts and (once
// Mario has the flower) throws fireballs. Nothing gameplay-facing sits on
// TRIANGLE; the level editor keeps it purely as its second tile-cycle key.
export function poll() {
  const pad = Pads.get(0);

  const pressed  = (btn) => pad.pressed(btn);
  const just     = (btn) => pad.justPressed(btn);

  // the B button — one physical button behind run / boost / fireball
  const b = pressed(Pads.SQUARE);
  const bPressed = just(Pads.SQUARE);

  return {
    left:  pressed(Pads.LEFT),
    right: pressed(Pads.RIGHT),
    down:  pressed(Pads.DOWN),
    up: pressed(Pads.UP),
    jump:  pressed(Pads.CROSS),
    run:  b,
    boost: b,
    fire: b,
    // one-shot jump edge
    jumpPressed: just(Pads.CROSS),
    runPressed: bPressed,
    boostPressed: bPressed,
    firePressed: bPressed,
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
    // so it reads the raw buttons rather than the B-button aliases above
    tilePrevPressed: bPressed,
    tileNextPressed: just(Pads.TRIANGLE),
  };
}
