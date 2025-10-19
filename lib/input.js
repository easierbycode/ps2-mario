export function poll() {
  const pad = Pads.get(0);

  const pressed  = (btn) => pad.pressed(btn);
  const just     = (btn) => pad.justPressed(btn);

  return {
    left:  pressed(Pads.LEFT),
    right: pressed(Pads.RIGHT),
    down:  pressed(Pads.DOWN),
    jump:  pressed(Pads.CROSS),
    run:  pressed(Pads.SQUARE),
    boost: pressed(Pads.TRIANGLE),
    // one-shot jump edge
    jumpPressed: just(Pads.CROSS),
    start: just(Pads.START),
  };
}