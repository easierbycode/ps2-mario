
import SpriteSheetAnimation from "lib/spritesheet_animation.js";

const TILE = 16;


// helper to map (col,row) -> rect
function R(c, r, w = TILE, h = TILE) {
  return { x: c * TILE, y: r * TILE, w, h };
}

export function createMarioAnimationsFromSheet() {
  const sheet = "assets/sprites/mario.png"; // <-- your uploaded file

  // ---- SMALL (row 0) ----
  const smallIdle = [ R(0,0) ];
  const smallWalk = [ R(1,0), R(2,0), R(3,0) ];
  const smallJump = [ R(4,0) ];
  const smallSkid = [ R(5,0) ];

  // ---- BIG (row 1) ----
  const bigIdle = [ R(0,1) ];
  const bigWalk = [ R(1,1), R(2,1), R(3,1) ];
  const bigJump = [ R(4,1) ];
  const bigSkid = [ R(5,1) ];

  return {
    smallIdle:      new SpriteSheetAnimation(sheet, smallIdle, 1),
    smallMarioWalk: new SpriteSheetAnimation(sheet, smallWalk, 10),
    smallJump:      new SpriteSheetAnimation(sheet, smallJump, 1),
    smallSkid:      new SpriteSheetAnimation(sheet, smallSkid, 1),

    bigIdle:        new SpriteSheetAnimation(sheet, bigIdle, 1),
    bigMarioWalk:   new SpriteSheetAnimation(sheet, bigWalk, 10),
    bigJump:        new SpriteSheetAnimation(sheet, bigJump, 1),
    bigSkid:        new SpriteSheetAnimation(sheet, bigSkid, 1),
  };
}

// DK sheet is three 22x23 frames laid out horizontally.
export function createDKAnimationsFromSheet() {
  const sheet = "assets/sprites/dk.png";
  const DK_W = 22, DK_H = 23;
  const F = (i) => ({ x: i * DK_W, y: 0, w: DK_W, h: DK_H });

  const idle = [ F(0) ];
  const walk = [ F(0), F(1), F(2) ];
  const jump = [ F(2) ];
  const skid = [ F(1) ];

  // DK has no small/big variants, so both sizes share the same frames.
  return {
    smallIdle:      new SpriteSheetAnimation(sheet, idle, 1),
    smallMarioWalk: new SpriteSheetAnimation(sheet, walk, 10),
    smallJump:      new SpriteSheetAnimation(sheet, jump, 1),
    smallSkid:      new SpriteSheetAnimation(sheet, skid, 1),

    bigIdle:        new SpriteSheetAnimation(sheet, idle, 1),
    bigMarioWalk:   new SpriteSheetAnimation(sheet, walk, 10),
    bigJump:        new SpriteSheetAnimation(sheet, jump, 1),
    bigSkid:        new SpriteSheetAnimation(sheet, skid, 1),
  };
}