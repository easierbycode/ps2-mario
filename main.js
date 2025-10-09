// {"name":"Mari0 PlayLand","author":"You","version":"20251008","icon":"", "file":"main.js"}

const font = new Font(); // BIOS font when available
Screen.setVSync(true);

import * as Tiled from "lib/tiled.js";
import * as Phys  from "lib/physics.js";
import * as Inp   from "lib/input.js";
import { ensurePowerOfTwo } from "lib/image_utils.js";
import { handleAnimations } from "lib/mario_anim_logic.js";
import { createMarioAnimationsFromSheet } from "./lib/mario_animations.js";

// ---- Load assets ----
const tileset = ensurePowerOfTwo(new Image("assets/tiles/smb_tiles.png"));
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
  x: spawn.x, y: spawn.y - spawn.h, w: spawn.w || 8, h: spawn.h || 14,
  vx: 0, vy: 0, grounded: false, facing: 1,
  size: "small",           // "small" | "big"
  ducking: false,
  dead: false,
  animName: ""
};

// ---- Mario animations from spritesheet (96x48 = 6x3 grid of 16x16) ----
const ANIMS = createMarioAnimationsFromSheet();

// ---------- helpers: scale-aware drawing so the game FILLS VERTICALLY ----------
/**
 * Compute logical → physical scale so that the full map height fills screen height.
 * Our logical height is the tile layer height (in tiles) * TILE (pixels per tile).
 */
function getScaleToFillVertically() {
  const view = Screen.getMode();
  const logicalH = (fg?.height || level.height || 18) * TILE; // e.g., 18 * 8 = 144
  return view.height / logicalH;
}

// ---- Main loop ----
Screen.display(() => {
  // Recompute scale each frame (handles mode changes)
  const SCALE = getScaleToFillVertically();

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
  camX = Math.max(0, Math.floor(player.x - (viewW_logical * 0.5)));
  camY = 0;

  // Draw background then foreground (scaled)
  if (bg) Tiled.drawLayerData(bg, bgData, tileset, ts, camX, camY, SCALE);
  Tiled.drawLayerData(fg, fgData, tileset, ts, camX, camY, SCALE);

  // ---- Animation selection ----
  const { name, flipH } = handleAnimations(player, ANIMS);
  const currentAnim = ANIMS[name];
  const rect = currentAnim.currentRect;

  // Feet-align sprite to collision box in logical units
  const drawX = Math.fround(player.x - camX + (player.w - rect.w) * 0.5);
  const drawY = Math.fround(player.y - camY - (rect.h - player.h));

  // Draw scaled to fill vertical screen
//   drawAnimScaled(currentAnim, drawX, drawY, flipH, SCALE);
  currentAnim.draw(drawX, drawY, flipH, SCALE);
});
