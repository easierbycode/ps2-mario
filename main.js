import * as Tiled from "lib/tiled.js";
import * as Phys  from "lib/physics.js";
import * as Inp   from "lib/input.js";
import { handleAnimations } from "lib/mario_anim_logic.js";
import { createMarioAnimationsFromSheet } from "lib/mario_animations.js";
import * as ObjAnims from "lib/object_animations.js";

// ---- Setup screen ----
Screen.setVSync(true); // black screen if false

// ---- Load assets ----
const tileset = new Image("assets/tiles/smb_tiles.png");
tileset.filter = NEAREST; // crisp pixel art

// --- Load map & tileset based on your JSON ---
const level = Tiled.loadJSON("assets/tiles/level1.json");
const ts    = Tiled.tilesetInfo(level, "tiles");
const fg    = Tiled.findLayer(level, "foregroundLayer");
const bg    = Tiled.findLayer(level, "backgroundLayer");
const obj   = Tiled.findLayer(level, "objects");

// Decode base64 tile data into arrays of gids
const fgData = Tiled.decodeBase64Layer(level, fg);
const bgData = Tiled.decodeBase64Layer(level, bg);

// Build collision grid from collide:true tileproperties
const collGrid = Tiled.collisionGridFromProperties(level, fg, ts);

// Player spawn from object layer (type or name == "player")
const spawn = Tiled.findPlayerSpawn(obj) || { x: 12, y: 44, w: 8, h: 14 };

// ---- World constants (tune as needed) ----
const TILE  = ts.tileWidth;   // (8 for your map)
const GRAV  = 0.35;
const SPEED = 1.2;
const JUMP_V = -6.0;

// ---- Camera ----
let camX = 0, camY = 0;

// ---- Player ----
const player = {
  x: spawn.x,
  y: spawn.y - spawn.h,
  w: spawn.w || 8,
  h: spawn.h || 14,
  vx: 0, vy: 0,
  grounded: false,
  facing: 1,
  size: "small", // "small" | "big"
  ducking: false,
  dead: false,
  animName: ""
};

// ---- Mario animations from spritesheet (96x48 = 6x3 grid of 16x16) ----
const ANIMS = createMarioAnimationsFromSheet();

// ---- Object animations ----
const GOOMBA_ANIMS = ObjAnims.createGoombaAnimations();
const COIN_ANIMS = ObjAnims.createCoinAnimations();
const BOX_SPRITES = ObjAnims.createBoxSprite();
const BRICK_SPRITE = ObjAnims.createBrickSprite();

// ---- Game Objects ----
const enemies = [];
const boxes = [];
const bricks = [];
const collectibles = [];
const platforms = [];
const portals = [];

// Load objects from tilemap
function loadObjectsFromTilemap() {
  if (!obj || !obj.objects) return;

  obj.objects.forEach(object => {
    // Convert Tiled coordinates (bottom-left origin) to top-left
    const x = object.x;
    const y = object.y - (object.height || 0);

    switch(object.type) {
      case 'goomba':
        enemies.push({
          type: 'goomba',
          x: x,
          y: y,
          w: 8,
          h: 8,
          vx: -0.5,
          vy: 0,
          alive: true,
          activated: false,
          animState: 'walk'
        });
        break;

      case 'box':
        boxes.push({
          x: x,
          y: y,
          w: 8,
          h: 8,
          content: object.properties?.content || 'coin',
          hit: false,
          active: true
        });
        break;

      case 'brick':
        bricks.push({
          x: x,
          y: y,
          w: 8,
          h: 8,
          hits: object.properties?.hits || 1
        });
        break;

      case 'collectible':
        collectibles.push({
          x: x,
          y: y,
          w: 8,
          h: 8,
          type: object.properties?.kindOfCollectible || 'coin',
          collected: false
        });
        break;
    }
  });
}

// Initialize objects once
loadObjectsFromTilemap();

// ---------- helpers: integer scale + half-texel and pixel snapping ----------
/**
 * Integer scale so logical 144 px fills vertical screen without fractional scaling.
 * Example: 480p -> floor(480/144) = 3; 448i -> floor(448/144) = 3.
 */
function getIntScaleToFillVertically() {
  const view = Screen.getMode();
  const logicalH = (fg?.height || level.height || 18) * TILE; // e.g., 18 * 8 = 144
  return Math.max(1, Math.floor(view.height / logicalH));
}

/** Snap a logical coordinate so that (coord * scale) lands on an integer pixel. */
function snapToPixel(coord, scale) {
  return Math.round(coord * scale) / scale;
}

// Add update functions for entities
function updateEnemies() {
  enemies.forEach(enemy => {
    if (!enemy.alive) return;

    // Activate enemy when visible
    if (!enemy.activated) {
      if (Math.abs(enemy.x - player.x) < 100) {
        enemy.activated = true;
      }
      return;
    }

    // Basic gravity and movement
    enemy.vy += GRAV * 0.5;
    enemy.x += enemy.vx;
    enemy.y += enemy.vy;

    // Simple collision with ground
    const tileY = Math.floor((enemy.y + enemy.h) / TILE);
    const tileX = Math.floor((enemy.x + enemy.w/2) / TILE);

    if (collGrid.data && collGrid.data[tileY * collGrid.w + tileX] === 1) {
      enemy.y = tileY * TILE - enemy.h;
      enemy.vy = 0;
    }

    // Turn at edges
    const leftTile = Math.floor((enemy.x - 1) / TILE);
    const rightTile = Math.floor((enemy.x + enemy.w + 1) / TILE);

    if (collGrid.data[tileY * collGrid.w + leftTile] !== 1 ||
        collGrid.data[tileY * collGrid.w + rightTile] !== 1) {
      enemy.vx = -enemy.vx;
    }

    // Update animation for goombas
    if (enemy.type === 'goomba' && enemy.animState === 'walk') {
      GOOMBA_ANIMS.walk.draw(-1000, -1000, false, 1); // Update animation timer
    }
  });
}

// ---- Main loop ----
Screen.display(() => {
  // Recompute scale each frame (handles mode changes)
  const SCALE = getIntScaleToFillVertically();

  // Half-texel bias in logical units: shifting by -0.5 screen px
  // aligns texel centers to pixel centers on PS2 GS.
  const HALF_TEXEL_BIAS = 0.5 / SCALE;

  // Input
  const pad = Inp.poll();
  player.vx = (pad.right ? SPEED : 0) - (pad.left ? SPEED : 0);
  if (pad.jumpPressed && player.grounded) player.vy = JUMP_V;
  player.ducking = (pad.down && player.grounded && player.size === "big");

  // Physics (in logical units)
  player.vy += GRAV;
  Phys.step(player, collGrid, TILE);

  // Update enemies
  updateEnemies();

  // Camera in logical units; center using *logical* viewport width
  const view = Screen.getMode();
  const viewW_logical = view.width / SCALE;

  // Integer camera to avoid subpixel scrolling; this pairs with integer SCALE.
  camX = Math.max(0, Math.floor(player.x - (viewW_logical * 0.5)));
  camY = 0;

  // ---- Draw background then foreground (scaled) ----
  if (bg) Tiled.drawLayerData(bg, bgData, tileset, ts,
    camX - HALF_TEXEL_BIAS, camY - HALF_TEXEL_BIAS, SCALE);

  Tiled.drawLayerData(fg, fgData, tileset, ts,
    camX - HALF_TEXEL_BIAS, camY - HALF_TEXEL_BIAS, SCALE);

  // ---- Animation selection ----
  const { name, flipH } = handleAnimations(player, ANIMS);
  const currentAnim = ANIMS[name];
  const rect = currentAnim.currentRect;

  // Feet-align sprite to collision box in logical units.
  const drawX_logical = player.x - camX + (player.w - rect.w) * 0.5;
  const drawY_logical = player.y - camY - (rect.h - player.h);

  const drawX = snapToPixel(drawX_logical, SCALE) - HALF_TEXEL_BIAS;
  const drawY = snapToPixel(drawY_logical, SCALE) - HALF_TEXEL_BIAS;

  // Draw scaled to fill vertical screen
  currentAnim.draw(drawX, drawY, flipH, SCALE);

  // Draw enemies
  enemies.forEach(enemy => {
    if (!enemy.activated) return;

    const drawX_e = enemy.x - camX;
    const drawY_e = enemy.y - camY;

    if (enemy.type === 'goomba') {
      const goombaAnim = enemy.animState === 'dead' ? GOOMBA_ANIMS.dead : GOOMBA_ANIMS.walk;
      const flip = enemy.vx > 0;
      const dx = snapToPixel(drawX_e, SCALE) - HALF_TEXEL_BIAS;
      const dy = snapToPixel(drawY_e, SCALE) - HALF_TEXEL_BIAS;
      goombaAnim.draw(dx, dy, flip, SCALE);

      // Clean up dead enemies after a delay
      if (enemy.animState === 'dead') {
        if (!enemy.deathTimer) enemy.deathTimer = 60;
        enemy.deathTimer--;
        if (enemy.deathTimer <= 0) enemy.activated = false;
      }
    }
  });

  // Draw boxes
  boxes.forEach(box => {
    const drawX_b = box.x - camX;
    const drawY_b = box.y - camY;
    const boxSprite = box.active ? BOX_SPRITES.active : BOX_SPRITES.hit;
    const dx = snapToPixel(drawX_b, SCALE) - HALF_TEXEL_BIAS;
    const dy = snapToPixel(drawY_b, SCALE) - HALF_TEXEL_BIAS;
    boxSprite.draw(dx, dy, false, SCALE);
  });

  // Draw bricks
  bricks.forEach(brick => {
    const drawX_br = brick.x - camX;
    const drawY_br = brick.y - camY;
    const dx = snapToPixel(drawX_br, SCALE) - HALF_TEXEL_BIAS;
    const dy = snapToPixel(drawY_br, SCALE) - HALF_TEXEL_BIAS;
    BRICK_SPRITE.draw(dx, dy, false, SCALE);
  });

  // Draw collectibles
  collectibles.forEach(item => {
    if (item.collected) return;
    const drawX_c = item.x - camX;
    const drawY_c = item.y - camY;

    // Animate floating collectibles
    if (item.vy !== undefined) {
      item.vy += 0.1;
      item.y += item.vy;
      if (item.vy > 2) item.collected = true;
    }

    const dx = snapToPixel(drawX_c, SCALE) - HALF_TEXEL_BIAS;
    const dy = snapToPixel(drawY_c, SCALE) - HALF_TEXEL_BIAS;

    if (item.type === 'coin' || item.type === 'rotatingCoin') {
      const coinAnim = item.type === 'rotatingCoin' ? COIN_ANIMS.rotatingCoin : COIN_ANIMS.coin;
      coinAnim.draw(dx, dy, false, SCALE);
    } else {
      const color = item.type === 'mushroom' ?
        Color.new(0, 255, 0, 128) :
        Color.new(255, 215, 0, 128);
      Draw.rect(drawX_c * SCALE, drawY_c * SCALE, item.w * SCALE, item.h * SCALE, color);
    }
  });

  // Draw platforms (keep as rectangles for now)
  platforms.forEach(platform => {
    const drawX_p = platform.x - camX;
    const drawY_p = platform.y - camY;
    Draw.rect(drawX_p * SCALE, drawY_p * SCALE,
              platform.w * SCALE, platform.h * SCALE,
              Color.new(139, 69, 19, 255));
  });
});