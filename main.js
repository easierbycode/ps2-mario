import * as Tiled from "lib/tiled.js";
import * as Phys  from "lib/physics.js";
import * as Inp   from "lib/input.js";
import { handleAnimations } from "lib/mario_anim_logic.js";
import { createMarioAnimationsFromSheet } from "lib/mario_animations.js";

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

  // Camera in logical units; center using *logical* viewport width
  const view = Screen.getMode();
  const viewW_logical = view.width / SCALE;

  // Integer camera to avoid subpixel scrolling; this pairs with integer SCALE.
  camX = Math.max(0, Math.floor(player.x - (viewW_logical * 0.5)));
  camY = 0;

  // ---- Draw background then foreground (scaled) ----
  // Apply the same half-texel bias to map layers so tile edges don't shimmer.
  if (bg) Tiled.drawLayerData(bg, bgData, tileset, ts,
    camX - HALF_TEXEL_BIAS, camY - HALF_TEXEL_BIAS, SCALE);

  Tiled.drawLayerData(fg, fgData, tileset, ts,
    camX - HALF_TEXEL_BIAS, camY - HALF_TEXEL_BIAS, SCALE);

  // ---- Animation selection ----
  const { name, flipH } = handleAnimations(player, ANIMS);
  const currentAnim = ANIMS[name];
  const rect = currentAnim.currentRect;

  // Feet-align sprite to collision box in logical units.
  // Snap so (drawX * SCALE) and (drawY * SCALE) land on whole pixels,
  // then apply the same half-texel bias.
  const drawX_logical = player.x - camX + (player.w - rect.w) * 0.5;
  const drawY_logical = player.y - camY - (rect.h - player.h);

  const drawX = snapToPixel(drawX_logical, SCALE) - HALF_TEXEL_BIAS;
  const drawY = snapToPixel(drawY_logical, SCALE) - HALF_TEXEL_BIAS;

  // Draw scaled to fill vertical screen
  currentAnim.draw(drawX, drawY, flipH, SCALE);
});