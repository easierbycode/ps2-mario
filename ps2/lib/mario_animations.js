
import * as std from "std";
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

// SpriteX atlas JSONs name their frames "atlas_sN". Some exports carry the
// name raw, others as "k_" + the UTF-16 code units in 4-hex-digit groups;
// resolve either form to the frame index N.
function atlasFrameIndex(key) {
  let name = key;
  if (key.startsWith("k_") && (key.length - 2) % 4 === 0 && /^[0-9a-fA-F]+$/.test(key.slice(2))) {
    name = "";
    for (let i = 2; i < key.length; i += 4) {
      name += String.fromCharCode(parseInt(key.slice(i, i + 4), 16));
    }
  }
  const m = /^atlas_s(\d+)$/.exec(name);
  return m ? Number(m[1]) : -1;
}

// Read an atlas JSON into an array of frame rects indexed by frame number.
// The sheets are plain horizontal strips, so a missing or unreadable JSON
// still yields usable rects.
function atlasRects(jsonPath, frameW, frameH, frameCount) {
  const rects = [];
  for (let i = 0; i < frameCount; i++) rects.push({ x: i * frameW, y: 0, w: frameW, h: frameH });
  try {
    const raw = std.loadFile(jsonPath);
    if (raw == null) return rects;
    const frames = JSON.parse(raw).frames || {};
    for (const key in frames) {
      const i = atlasFrameIndex(key);
      const f = frames[key].frame;
      if (i >= 0 && i < frameCount && f) rects[i] = { x: f.x, y: f.y, w: f.w, h: f.h };
    }
  } catch (e) {
    // fall back to the computed strip
  }
  return rects;
}

// Player 2's sheet: Game Boy Luigi. Small frames, tall "super" frames, a
// duck, a face-the-camera death, then the Mario Land vehicles (unused).
export function createLuigiAnimationsFromSheet() {
  const sheet = "assets/sprites/luigi.png";
  const rc = atlasRects("assets/sprites/luigi.json", 16, 16, 23);
  const F = (...idx) => idx.map((i) => rc[i]);

  return {
    smallIdle:      new SpriteSheetAnimation(sheet, F(0), 1),
    smallMarioWalk: new SpriteSheetAnimation(sheet, F(2, 4, 6), 10),
    smallJump:      new SpriteSheetAnimation(sheet, F(5), 1),
    smallSkid:      new SpriteSheetAnimation(sheet, F(10), 1),

    bigIdle:        new SpriteSheetAnimation(sheet, F(1), 1),
    bigMarioWalk:   new SpriteSheetAnimation(sheet, F(3, 7, 8), 10),
    bigJump:        new SpriteSheetAnimation(sheet, F(9), 1),
    bigSkid:        new SpriteSheetAnimation(sheet, F(11), 1),
    bigDuck:        new SpriteSheetAnimation(sheet, F(13), 1),

    dead:           new SpriteSheetAnimation(sheet, F(12), 1),
  };
}

// The Konami duo. Space Mario rolls into a ball for his jump; like DK,
// neither has small/big variants, so both sizes share the same frames.
export function createSpaceMarioAnimationsFromSheet() {
  const sheet = "assets/sprites/space_mario.png";
  const rc = atlasRects("assets/sprites/space_mario.json", 32, 32, 10);
  const F = (...idx) => idx.map((i) => rc[i]);

  const idle = F(0);
  const walk = F(2, 3, 4);
  const jump = F(1);
  const skid = F(5);

  return {
    smallIdle:      new SpriteSheetAnimation(sheet, idle, 1),
    smallMarioWalk: new SpriteSheetAnimation(sheet, walk, 10),
    smallJump:      new SpriteSheetAnimation(sheet, jump, 1),
    smallSkid:      new SpriteSheetAnimation(sheet, skid, 1),

    bigIdle:        new SpriteSheetAnimation(sheet, idle, 1),
    bigMarioWalk:   new SpriteSheetAnimation(sheet, walk, 10),
    bigJump:        new SpriteSheetAnimation(sheet, jump, 1),
    bigSkid:        new SpriteSheetAnimation(sheet, skid, 1),

    dead:           new SpriteSheetAnimation(sheet, F(8), 1),
  };
}

export function createNabbitAnimationsFromSheet() {
  const sheet = "assets/sprites/nabbit.png";
  const rc = atlasRects("assets/sprites/nabbit.json", 21, 22, 12);
  const F = (...idx) => idx.map((i) => rc[i]);

  const idle = F(0);
  const walk = F(2, 3, 4);
  const jump = F(5);
  const skid = F(9);

  return {
    smallIdle:      new SpriteSheetAnimation(sheet, idle, 1),
    smallMarioWalk: new SpriteSheetAnimation(sheet, walk, 10),
    smallJump:      new SpriteSheetAnimation(sheet, jump, 1),
    smallSkid:      new SpriteSheetAnimation(sheet, skid, 1),

    bigIdle:        new SpriteSheetAnimation(sheet, idle, 1),
    bigMarioWalk:   new SpriteSheetAnimation(sheet, walk, 10),
    bigJump:        new SpriteSheetAnimation(sheet, jump, 1),
    bigSkid:        new SpriteSheetAnimation(sheet, skid, 1),

    dead:           new SpriteSheetAnimation(sheet, F(11), 1),
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