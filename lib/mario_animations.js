
import SpriteSheetAnimation from "lib/spritesheet_animation.js";
import { ensurePowerOfTwo } from "lib/image_utils.js";

const TILE = 16;


// helper to map (col,row) -> rect
function R(c, r, w = TILE, h = TILE) {
  return { x: c * TILE, y: r * TILE, w, h };
}

export function createMarioAnimationsFromSheet() {
  // Load the original image, set its filter, then ensure it's power-of-two.
  // This order is important for some hardware.
  const originalSheet = new Image("assets/sprites/mario.png");
  originalSheet.filter = NEAREST;
  const sheet = ensurePowerOfTwo(originalSheet);

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