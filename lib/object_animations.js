// lib/object_animations.js
// Animations for enemies, boxes, bricks, and collectibles

import SpriteSheetAnimation from "./spritesheet_animation.js";

/**
 * Create animations for goombas from the spritesheet
 */
export function createGoombaAnimations() {
  // Goomba spritesheet is 24x8 (3 frames of 8x8)
  return {
    walk: new SpriteSheetAnimation(
      "assets/sprites/goomba.png",
      [
        { x: 0, y: 0, w: 8, h: 8 },  // frame 0
        { x: 8, y: 0, w: 8, h: 8 }   // frame 1
      ],
      9  // 9 fps as per animations.json
    ),
    dead: new SpriteSheetAnimation(
      "assets/sprites/goomba.png",
      [
        { x: 16, y: 0, w: 8, h: 8 }  // frame 2 - squished
      ],
      1
    )
  };
}

/**
 * Create animations for coins
 */
export function createCoinAnimations() {
  // Regular coin (single frame)
  const coin = new SpriteSheetAnimation(
    "assets/sprites/coin.png",
    [
      { x: 0, y: 0, w: 8, h: 8 }
    ],
    18
  );
  
  // Rotating coin animation
  const rotatingCoin = new SpriteSheetAnimation(
    "assets/sprites/rotatingCoin.png",
    [
      { x: 0, y: 0, w: 8, h: 8 },
      { x: 8, y: 0, w: 8, h: 8 }
    ],
    18  // 18 fps as per animations.json
  );
  
  return { coin, rotatingCoin };
}

/**
 * Create box sprite (2 frames: active and hit)
 */
export function createBoxSprite() {
  // Box spritesheet is 16x8 (2 frames of 8x8)
  return {
    active: new SpriteSheetAnimation(
      "assets/sprites/box.png",
      [
        { x: 0, y: 0, w: 8, h: 8 }  // frame 0 - active box
      ],
      1
    ),
    hit: new SpriteSheetAnimation(
      "assets/sprites/box.png",
      [
        { x: 8, y: 0, w: 8, h: 8 }  // frame 1 - hit/empty box
      ],
      1
    )
  };
}

/**
 * Create brick sprite
 */
export function createBrickSprite() {
  return new SpriteSheetAnimation(
    "assets/sprites/brick.png",
    [
      { x: 0, y: 0, w: 8, h: 8 }
    ],
    1
  );
}

export function createMushroomSprite() {
  return new SpriteSheetAnimation(
    "assets/collectibles/mushroom.png",
    [
      { x: 0, y: 0, w: 16, h: 16 }
    ],
    1
  );
}

/**
 * Create platform sprite (if we have one - using placeholder for now)
 */
export function createPlatformSprite() {
  // For now, we'll return null and draw platforms as rectangles
  // since we don't have a platform sprite in assets
  return null;
}