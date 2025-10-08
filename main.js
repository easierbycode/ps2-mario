// {"name":"Mari0 PlayLand","author":"You","version":"20251008","icon":"", "file":"main.js"}

const font = new Font(); // BIOS font when available
Screen.setVSync(true);

import * as Tiled from "lib/tiled.js";
import * as Phys  from "lib/physics.js";
import * as Inp   from "lib/input.js";

// const SCREEN_WIDTH = 640;
// const SCREEN_HEIGHT = 448;

// ---- Load assets ----
const tileset = new Image("assets/tiles/smb_tiles.png");
tileset.filter = NEAREST; // crisp pixel art. :contentReference[oaicite:5]{index=5}

const mario = new Image("assets/sprites/mario.png");
mario.filter = NEAREST;

// --- Load map & tileset based on your JSON ---
const level = Tiled.loadJSON("assets/tiles/level1.json");   // put your JSON here
const ts    = Tiled.tilesetInfo(level, "tiles");             // tileset name in your JSON
const fg    = Tiled.findLayer(level, "foregroundLayer");     // tilelayer
const bg    = Tiled.findLayer(level, "backgroundLayer");     // tilelayer (optional draw)
const obj   = Tiled.findLayer(level, "objects");             // objectgroup

// resolve tileset image and load it
// const tilesetPath = Tiled.resolveTilesetImagePath(level, ts, "assets/tiles"); // -> assets/tiles/tiles.png
// const tileset = new Image(tilesetPath);
// tileset.filter = NEAREST;

// Decode base64 tile data into arrays of gids
const fgData = Tiled.decodeBase64Layer(level, fg);
const bgData = Tiled.decodeBase64Layer(level, bg);

// Build collision grid from collide:true tileproperties
const collGrid = Tiled.collisionGridFromProperties(level, fg, ts);

// Player spawn from object layer (type or name == "player")
const spawn = Tiled.findPlayerSpawn(obj) || { x: 12, y: 44, w: 8, h: 14 };

// ---- World constants (tune as needed) ----
const TILE = ts.tileWidth;         // e.g., 16
const GRAV = 0.35;                 // use small forces; consider f32 for perf. :contentReference[oaicite:6]{index=6}
const SPEED = 1.2;
const JUMP_V = -6.0;

// ---- Camera ----
let camX = 0, camY = 0;

// ---- Player ----
const player = {
  x: spawn.x, y: spawn.y - spawn.h, w: spawn.w || 8, h: spawn.h || 14,
  vx: 0, vy: 0, grounded: false, facing: 1
};

// ---- Audio (optional) ----
// const sCoin  = Sound.load("assets/audio/coin.wav");
// const sStomp = Sound.load("assets/audio/stomp.wav");
// Sound.setVolume(80); // master volume. :contentReference[oaicite:7]{index=7}

// Helpful: convert many short SFX to ADPCM later (slots), music as OGG/WAV loop. :contentReference[oaicite:8]{index=8}

Screen.display(() => {
  // Input
  const pad = Inp.poll(); // reads Pads.get + helper
  player.vx = (pad.right ? SPEED : 0) - (pad.left ? SPEED : 0);
  if (pad.jumpPressed && player.grounded) player.vy = JUMP_V;

  // Physics
  player.vy += GRAV;
//   const collGrid = Tiled.collisionGrid(tileLayer, TILE);
  Phys.step(player, collGrid, TILE); // resolves tile collisions, sets grounded

  // Camera: keep Mario ~centered horizontally
  const view = Screen.getMode();
  camX = Math.max(0, Math.floor(player.x - (view.width >> 1)));
  camY = 0;

  // Draw (auto-clear on Screen.display)
  // Draw tiles in view
//   Tiled.drawLayer(tileLayer, tileset, ts, camX, camY);
  // Draw
  // (Optional) background layer first
  if (bg) Tiled.drawLayerData(bg, bgData, tileset, ts, camX, camY);
  // Foreground (solid tiles)
  Tiled.drawLayerData(fg, fgData, tileset, ts, camX, camY);

  // Player (placeholder 8x16 rect from the tileset’s first tile)
  tileset.startx = 0; tileset.starty = 0;
  tileset.endx = 8;   tileset.endy = 16;
  tileset.width = 8;  tileset.height = 16;
  tileset.draw(Math.fround(player.x - camX), Math.fround(player.y - camY));

  // Draw player (using subrects if you have a spritesheet)
  mario.width = 16; mario.height = 16;
  mario.startx = 0;  mario.starty = 0; // adjust to show correct frame
  mario.endx = 16;   mario.endy = 16;
  mario.draw(Math.fround(player.x - camX), Math.fround(player.y - camY));

  font.print(6, 6, "FPS: " + Screen.getFPS(250)); // requires setFrameCounter(true) if you use it. :contentReference[oaicite:9]{index=9}
});