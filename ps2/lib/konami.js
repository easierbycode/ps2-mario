// Konami code detector: UP UP DOWN DOWN LEFT RIGHT LEFT RIGHT CIRCLE CROSS —
// how PlayStation games have always spelled the code's B A ending. It is
// deliberately not the game's own B button (SQUARE, the left face button),
// so holding run can never advance the sequence.
const SEQUENCE = [
  "up", "up", "down", "down",
  "left", "right", "left", "right",
  "circle", "cross",
];

// KMP failure table so partial re-matches survive a mismatch
// (e.g. UP UP UP still counts as two UPs of progress).
const FAIL = (() => {
  const f = new Array(SEQUENCE.length + 1).fill(0);
  for (let i = 1; i < SEQUENCE.length; i++) {
    let k = f[i];
    while (k > 0 && SEQUENCE[i] !== SEQUENCE[k]) k = f[k];
    f[i + 1] = SEQUENCE[i] === SEQUENCE[k] ? k + 1 : 0;
  }
  return f;
})();

export function createKonamiDetector() {
  let progress = 0;

  // Feed one polled pad per frame; returns true on the frame the code completes.
  return function feed(pad) {
    const edges = [];
    if (pad.upPressed) edges.push("up");
    if (pad.downPressed) edges.push("down");
    if (pad.leftPressed) edges.push("left");
    if (pad.rightPressed) edges.push("right");
    if (pad.circlePressed) edges.push("circle");
    if (pad.crossPressed) edges.push("cross");

    for (const btn of edges) {
      while (progress > 0 && btn !== SEQUENCE[progress]) {
        progress = FAIL[progress];
      }
      if (btn === SEQUENCE[progress]) progress++;
      if (progress === SEQUENCE.length) {
        progress = 0;
        return true;
      }
    }
    return false;
  };
}
