export function poll() {
  const pad = Pads.get(0);

  const pressed  = (btn) => pad.pressed(btn);
  const just     = (btn) => pad.justPressed(btn);

  return {
    left:  pressed(Pads.LEFT),
    right: pressed(Pads.RIGHT),
    down:  pressed(Pads.DOWN),
    up: pressed(Pads.UP),
    jump:  pressed(Pads.CROSS),
    run:  pressed(Pads.SQUARE),
    boost: pressed(Pads.TRIANGLE),
    // one-shot jump edge
    jumpPressed: just(Pads.CROSS),
    runPressed: just(Pads.SQUARE),
    boostPressed: just(Pads.TRIANGLE),
    start: just(Pads.START),
    select: just(Pads.SELECT),
  };
}