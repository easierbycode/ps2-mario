import * as Tiled from "lib/tiled.js";
import * as Phys  from "lib/physics.js";
import * as Inp   from "lib/input.js";
import { Platform } from "lib/platform.js";
import { handleAnimations } from "lib/mario_anim_logic.js";
import { createMarioAnimationsFromSheet } from "lib/mario_animations.js";
import * as ObjAnims from "lib/object_animations.js";

// ---- Setup screen ----
Screen.setVSync(true); // black screen if false

// ---- Load assets ----
const tileset = new Image("assets/tiles/smb_tiles.png");
tileset.filter = NEAREST; // crisp pixel art
const font = new Font("assets/superMarioLand.fnt");

// ---- HUD ----
let score = 0;
let coins = 0;
let time = 400;
let lastTime = 0;

// --- Load map & tileset based on your JSON ---
let currentLevelName = "level1";
let level = Tiled.loadJSON("assets/tiles/level1.json");
let ts    = Tiled.tilesetInfo(level, "tiles");
let fg    = Tiled.findLayer(level, "foregroundLayer");
let bg    = Tiled.findLayer(level, "backgroundLayer");
let obj   = Tiled.findLayer(level, "objects");

// Decode base64 tile data into arrays of gids
let fgData = Tiled.decodeBase64Layer(level, fg);
let bgData = Tiled.decodeBase64Layer(level, bg);

// Build collision grid from collide:true tileproperties
let collGrid = Tiled.collisionGridFromProperties(level, fg, ts);

// Player spawn from object layer (type or name == "player")
const spawn = Tiled.findPlayerSpawn(obj) || { x: 12, y: 44, w: 8, h: 14 };

// ---- World constants (tune as needed) ----
const TILE  = ts.tileWidth;   // (8 for your map)
const GRAV  = 0.35;
const SPEED = 1.2;
const JUMP_V = -6.0;

const SMALL_MARIO_WIDTH = spawn.w || 8;
const SMALL_MARIO_HEIGHT = spawn.h || 14;
const BIG_MARIO_WIDTH = SMALL_MARIO_WIDTH;
const BIG_MARIO_HEIGHT = SMALL_MARIO_HEIGHT + 4;

// ---- Camera ----
let camX = 0, camY = 0;

// ---- Player ----
const player = {
  x: spawn.x,
  y: spawn.y - SMALL_MARIO_HEIGHT,
  w: SMALL_MARIO_WIDTH,
  h: SMALL_MARIO_HEIGHT,
  vx: 0,
  vy: 0,
  grounded: false,
  facing: 1,
  size: "small", // "small" | "big"
  ducking: false,
  dead: false,
  animName: "",
  invulnerable: false,
  invulnerableTimer: 0,
  smallWidth: SMALL_MARIO_WIDTH,
  smallHeight: SMALL_MARIO_HEIGHT,
  bigWidth: BIG_MARIO_WIDTH,
  bigHeight: BIG_MARIO_HEIGHT
};

// ---- Mario animations from spritesheet (96x48 = 6x3 grid of 16x16) ----
const ANIMS = createMarioAnimationsFromSheet();

// ---- Object animations ----
const GOOMBA_ANIMS = ObjAnims.createGoombaAnimations();
const COIN_ANIMS = ObjAnims.createCoinAnimations();
const BOX_SPRITES = ObjAnims.createBoxSprite();
const BRICK_SPRITE = ObjAnims.createBrickSprite();

const MUSHROOM_SPRITE = ObjAnims.createMushroomSprite();

// ---- Game Objects ----
const enemies = [];
const boxes = [];
const bricks = [];
const collectibles = [];
const platforms = [];
const portals = [];

function makePlayerInvulnerable(frames = 120) {
  player.invulnerable = true;
  player.invulnerableTimer = frames;
}

function growMario() {
  if (player.size === "big") return;
  const deltaHeight = player.bigHeight - player.h;
  player.size = "big";
  player.w = player.bigWidth;
  player.h = player.bigHeight;
  player.y -= deltaHeight;
  player.ducking = false;
}

function shrinkMario() {
  if (player.size === "small") return;
  const deltaHeight = player.h - player.smallHeight;
  player.size = "small";
  player.w = player.smallWidth;
  player.h = player.smallHeight;
  player.y += deltaHeight;
}

function getPlayerVulnerable() {
  return !player.invulnerable;
}

function loadLevel(levelName) {
  currentLevelName = levelName;
  const levelPath = `assets/tiles/${levelName}.json`;
  level = Tiled.loadJSON(levelPath);
  ts = Tiled.tilesetInfo(level, "tiles");
  fg = Tiled.findLayer(level, "foregroundLayer");
  bg = Tiled.findLayer(level, "backgroundLayer");
  obj = Tiled.findLayer(level, "objects");

  fgData = Tiled.decodeBase64Layer(level, fg);
  bgData = Tiled.decodeBase64Layer(level, bg);

  collGrid = Tiled.collisionGridFromProperties(level, fg, ts);

  enemies.length = 0;
  boxes.length = 0;
  bricks.length = 0;
  collectibles.length = 0;
  platforms.length = 0;
  portals.length = 0;

  loadObjectsFromTilemap();
}

function handlePlayerPortalOverlap(player, portal) {
  if (portal.name === 'exit' && currentLevelName === 'level1') {
    loadLevel('level4-2');
    player.x = 12;
    player.y = 44;
    player.vx = 0;
    player.vy = 0;
    return;
  }

  const pad = Inp.poll();
  if (
    (pad.down && portal.destination.dir === "down") ||
    (pad.right && portal.destination.dir === "right")
  ) {
    loadLevel(portal.destination.level);
    player.x = portal.destination.x;
    player.y = portal.destination.y;
    player.vx = 0;
    player.vy = 0;
  }
}

function playerGotHit() {
  if (player.dead || !getPlayerVulnerable()) return;
  if (player.size === "big") {
    shrinkMario();
    makePlayerInvulnerable(120);
  } else {
    player.dead = true;
    player.vx = 0;
    player.vy = -4;
    player.animName = "dead";
  }
}

function bounceUpAfterHitEnemyOnHead() {
  player.vy = JUMP_V * 0.5;
}

player.growMario = growMario;
player.shrinkMario = shrinkMario;
player.getVulnerable = getPlayerVulnerable;
player.gotHit = playerGotHit;
player.bounceUpAfterHitEnemyOnHead = bounceUpAfterHitEnemyOnHead;

function createCollectible(props = {}) {
  const item = {
    x: props.x ?? 0,
    y: props.y ?? 0,
    w: props.w ?? TILE,
    h: props.h ?? TILE,
    vx: props.vx ?? 0,
    vy: props.vy ?? 0,
    type: props.type ?? "coin",
    texture: { key: props.textureKey ?? props.type ?? "coin" },
    sprite: props.sprite ?? null,
    fromTilemap: props.fromTilemap ?? false,
    tileX: props.tileX,
    tileY: props.tileY,
    moveDir: props.moveDir ?? 0,
    moveSpeed: props.moveSpeed ?? 0,
    points: props.points ?? 0,
    _collected: false
  };

  item.collected = function () {
    if (this._collected) return;
    this._collected = true;
  };

  return item;
}

function createMushroomCollectible(x, y, options = {}) {
  return createCollectible({
    x,
    y,
    w: options.w ?? TILE,
    h: options.h ?? TILE,
    type: "mushroom",
    textureKey: "mushroom",
    sprite: MUSHROOM_SPRITE,
    moveDir: options.moveDir ?? 1,
    moveSpeed: options.moveSpeed ?? 0.8,
    vx: options.vx ?? 0,
    vy: options.vy ?? -2.5,
    points: options.points ?? 1000
  });
}

function handlePlayerEnemyOverlap(_player, _enemy) {
  if (!_player.getVulnerable()) return;
  _player.gotHit();
}

function handlePlayerCollectiblesOverlap(_player, _collectible) {
  switch (_collectible.texture.key) {
    case "flower":
      break;
    case "mushroom":
      _player.growMario();
      break;
    case "star":
      break;
    case "coin":
    case "rotatingCoin":
      coins++;
      score += 200;
      break;
    default:
      break;
  }
  _collectible.collected();
}

function updatePlayerState() {
  if (player.invulnerable) {
    if (player.invulnerableTimer > 0) {
      player.invulnerableTimer--;
    } else {
      player.invulnerable = false;
      player.invulnerableTimer = 0;
    }
  }
}

function updateCollectibles() {
  collectibles.forEach((item) => {
    if (item._collected) return;

    if (
      (item.type === "coin" || item.type === "rotatingCoin") &&
      typeof item.vy === "number"
    ) {
      item.vy += 0.1;
      item.y += item.vy;
      if (item.vy > 2) {
        item.collected();
      }
      return;
    }

    if (item.type === "mushroom") {
      item.moveDir = item.moveDir || 1;
      item.moveSpeed = item.moveSpeed || 0.8;
      item.vx = item.moveSpeed * item.moveDir;
      item.vy = Math.min(item.vy + GRAV, 6);
      const desiredVX = item.vx;
      Phys.step(item, collGrid, TILE);
      if (Math.abs(item.vx) < Math.abs(desiredVX) * 0.5) {
        item.moveDir *= -1;
        item.vx = item.moveSpeed * item.moveDir;
      }
    }
  });
}

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
          hits: object.properties?.hits || 1,
          destroyed: false
        });
        break;

      case 'collectible': {
        const collectibleType =
          object.properties?.kindOfCollectible || 'coin';
        const direction =
          object.properties?.direction === 'left' ? -1 : 1;
        const width = object.width || TILE;
        const height = object.height || TILE;
        if (collectibleType === 'mushroom') {
          collectibles.push(
            createMushroomCollectible(x, y, {
              w: width,
              h: height,
              moveDir: direction,
              moveSpeed: 0.8,
              vy: 0
            })
          );
        } else {
          collectibles.push(
            createCollectible({
              x,
              y,
              w: width,
              h: height,
              type: collectibleType,
              textureKey: collectibleType
            })
          );
        }
        break;
      }

      case 'coin':
      case 'rotatingCoin': {
        const width = object.width || TILE;
        const height = object.height || TILE;
        collectibles.push(
          createCollectible({
            x,
            y,
            w: width,
            h: height,
            type: object.type,
            textureKey: object.type
          })
        );
        break;
      }
      case "portal":
        portals.push({
          x: x,
          y: y,
          w: object.width,
          h: object.height,
          name: object.name,
          destination: {
            level: object.name,
            x: object.properties.marioSpawnX,
            y: object.properties.marioSpawnY,
            dir: object.properties.direction,
          },
        });
        break;
      case 'platformMovingUpAndDown':
      case 'platformMovingLeftAndRight':
        platforms.push(new Platform(x, y, object.width, object.height, object.type, object.properties?.distance));
        break;
    }
  });

  // Check for coins in the tilemap itself (tile-based coins)
  // Some levels might have coins as tiles rather than objects
  if (fg && fgData) {
    const coinTileIds = [96, 97, 98]; // Common coin tile IDs in SMB tilesets
    for (let y = 0; y < fg.height; y++) {
      for (let x = 0; x < fg.width; x++) {
        const tileId = fgData[y * fg.width + x];
        if (coinTileIds.includes(tileId)) {
          collectibles.push(
            createCollectible({
              x: x * TILE,
              y: y * TILE,
              w: TILE,
              h: TILE,
              type: 'coin',
              textureKey: 'coin',
              fromTilemap: true,
              tileX: x,
              tileY: y
            })
          );
          // Clear the tile from the tilemap data so it won't be drawn twice
          fgData[y * fg.width + x] = 0;
        }
      }
    }
  }
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

    // Ground collision
    const bottomY = Math.floor((enemy.y + enemy.h) / TILE);
    const midX = Math.floor((enemy.x + enemy.w/2) / TILE);

    if (collGrid.data && bottomY < collGrid.h) {
      const groundTile = collGrid.data[bottomY * collGrid.w + midX];
      if (groundTile === 1) {
        enemy.y = bottomY * TILE - enemy.h;
        enemy.vy = 0;
      }
    }

    // Wall collision and edge detection
    const leftX = Math.floor((enemy.x + enemy.vx) / TILE);
    const rightX = Math.floor((enemy.x + enemy.w + enemy.vx) / TILE);
    const centerY = Math.floor((enemy.y + enemy.h/2) / TILE);
    const feetY = Math.floor((enemy.y + enemy.h + 1) / TILE);

    // Check for walls at enemy's center height
    let hitWall = false;
    if (enemy.vx < 0 && collGrid.data[centerY * collGrid.w + leftX] === 1) {
      hitWall = true;
    } else if (enemy.vx > 0 && collGrid.data[centerY * collGrid.w + rightX] === 1) {
      hitWall = true;
    }

    // Check for platform edges
    let atEdge = false;
    if (enemy.vx < 0 && collGrid.data[feetY * collGrid.w + leftX] !== 1) {
      atEdge = true;
    } else if (enemy.vx > 0 && collGrid.data[feetY * collGrid.w + rightX] !== 1) {
      atEdge = true;
    }

    // Turn around if hit wall or at edge
    if (hitWall || atEdge) {
      enemy.vx = -enemy.vx;
    }

    // Update animation for goombas
    if (enemy.type === 'goomba' && enemy.animState === 'walk') {
      GOOMBA_ANIMS.walk.draw(-1000, -1000, false, 1); // Update animation timer
    }
  });
}

function updatePlatforms() {
  platforms.forEach(platform => {
    platform.update();
  });
}

function checkCollisions() {
  // Player vs Enemies
  enemies.forEach(enemy => {
    if (!enemy.alive || !enemy.activated) return;

    if (player.x < enemy.x + enemy.w &&
        player.x + player.w > enemy.x &&
        player.y < enemy.y + enemy.h &&
        player.y + player.h > enemy.y) {

      // Check if player is stomping (falling down and feet above enemy head)
      if (player.vy > 0 && player.y + player.h - enemy.y < 4) {
        enemy.alive = false;
        if (enemy.type === 'goomba') {
          enemy.animState = 'dead';
          if (!enemy.deathTimer) enemy.deathTimer = 60;
        }
        player.bounceUpAfterHitEnemyOnHead();
      } else if (!player.dead) {
        handlePlayerEnemyOverlap(player, enemy);
      }
    }
  });

  // Player vs Boxes - improved collision handling
  boxes.forEach(box => {
    if (player.x < box.x + box.w &&
        player.x + player.w > box.x &&
        player.y < box.y + box.h &&
        player.y + player.h > box.y) {

      const overlapX = Math.min(player.x + player.w, box.x + box.w) - Math.max(player.x, box.x);
      const overlapY = Math.min(player.y + player.h, box.y + box.h) - Math.max(player.y, box.y);

      // Determine collision direction by smallest overlap
      if (overlapX < overlapY) {
        // Horizontal collision (left or right side)
        if (player.x < box.x) {
          player.x = box.x - player.w;
        } else {
          player.x = box.x + box.w;
        }
        player.vx = 0;
      } else {
        // Vertical collision (top or bottom)
        if (player.y < box.y) {
          // Player is above box - landing on top
          player.y = box.y - player.h;
          player.vy = 0;
          player.grounded = true;
        } else {
          // Player is below box - hitting from underneath
          if (box.active && player.vy < 0) {
            // Trigger box content
            box.hit = true;
            box.active = false;

            if (box.content === 'coin' || box.content === 'rotatingCoin') {
              const type =
                box.content === 'rotatingCoin' ? 'rotatingCoin' : 'coin';
              collectibles.push(
                createCollectible({
                  x: box.x,
                  y: box.y - TILE,
                  w: TILE,
                  h: TILE,
                  type,
                  textureKey: type,
                  vy: -2
                })
              );
            } else if (box.content === 'mushroom') {
              const direction = player.facing >= 0 ? 1 : -1;
              collectibles.push(
                createMushroomCollectible(box.x, box.y - TILE, {
                  moveDir: direction,
                  moveSpeed: 0.8,
                  vy: -3
                })
              );
            }
          }
          // Always bounce player down when hitting box from below
          player.y = box.y + box.h;
          player.vy = Math.abs(player.vy) * 0.2;
        }
      }
    }
  });

  // Player vs Bricks
  bricks.forEach(brick => {
    if (brick.destroyed) return;

    if (player.x < brick.x + brick.w &&
        player.x + player.w > brick.x &&
        player.y < brick.y + brick.h &&
        player.y + player.h > brick.y) {

      // Check if hitting from below
      if (player.vy < 0 && player.y > brick.y + brick.h - 4) {
        // Hit brick from below
        player.vy = Math.abs(player.vy) * 0.2;
        brick.hits--;
        if (brick.hits <= 0) {
          brick.destroyed = true;
        }
      }
      // Provide top collision
      else if (player.vy > 0 && player.y < brick.y) {
        player.y = brick.y - player.h;
        player.vy = 0;
        player.grounded = true;
      }
      // Side collisions
      else if (player.vx !== 0) {
        if (player.x < brick.x) {
          player.x = brick.x - player.w;
        } else {
          player.x = brick.x + brick.w;
        }
        player.vx = 0;
      }
    }
  });

  // Player vs Collectibles
  collectibles.forEach(item => {
    if (item._collected) return;

    if (player.x < item.x + item.w &&
        player.x + player.w > item.x &&
        player.y < item.y + item.h &&
        player.y + player.h > item.y) {
      handlePlayerCollectiblesOverlap(player, item);
    }
  });

  // Player vs Portals
  portals.forEach(portal => {
    if (player.x < portal.x + portal.w &&
        player.x + player.w > portal.x &&
        player.y < portal.y + portal.h &&
        player.y + player.h > portal.y) {
      handlePlayerPortalOverlap(player, portal);
    }
  });

  // Player vs Platforms
  platforms.forEach(platform => {
    if (player.x < platform.x + platform.w &&
        player.x + player.w > platform.x &&
        player.y + player.h > platform.y &&
        player.y + player.h < platform.y + platform.h + 4 &&
        player.vy >= 0) {
      player.y = platform.y - player.h;
      player.vy = 0;
      player.grounded = true;
      player.x += platform.vx;
      player.y += platform.vy;
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
  if (!player.dead) {
    player.vx = (pad.right ? SPEED : 0) - (pad.left ? SPEED : 0);
    if (pad.jumpPressed && player.grounded) player.vy = JUMP_V;
    player.ducking = (pad.down && player.grounded && player.size === "big");

    // Physics (in logical units)
    player.vy += GRAV;
    Phys.step(player, collGrid, TILE);
  } else {
    // When dead, only apply death jump physics
    player.vy += GRAV * 0.5;
    player.y += player.vy;
  }

  updatePlayerState();

  // Update entities and check collisions
  updateEnemies();
  updatePlatforms();
  updateCollectibles();
  checkCollisions();

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
  let currentAnim, rect, flipH;

  if (player.dead) {
    // Use death animation frame (small mario frame 4 is the jump/dead frame)
    currentAnim = ANIMS.smallJump || ANIMS.smallWalk;
    currentAnim.frame = 0; // Force to first frame
    rect = currentAnim.currentRect;
    flipH = player.facing < 0;
  } else {
    const animResult = handleAnimations(player, ANIMS);
    currentAnim = ANIMS[animResult.name];
    rect = currentAnim.currentRect;
    flipH = animResult.flipH;
  }

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
    if (brick.destroyed) return;
    const drawX_br = brick.x - camX;
    const drawY_br = brick.y - camY;
    const dx = snapToPixel(drawX_br, SCALE) - HALF_TEXEL_BIAS;
    const dy = snapToPixel(drawY_br, SCALE) - HALF_TEXEL_BIAS;
    BRICK_SPRITE.draw(dx, dy, false, SCALE);
  });

  // Draw collectibles
  collectibles.forEach(item => {
    if (item._collected) return;
    const drawX_c = item.x - camX;
    const drawY_c = item.y - camY;

    const dx = snapToPixel(drawX_c, SCALE) - HALF_TEXEL_BIAS;
    const dy = snapToPixel(drawY_c, SCALE) - HALF_TEXEL_BIAS;

    if (item.type === 'coin' || item.type === 'coin2' || item.type === 'rotatingCoin') {
      const coinAnim = item.type === 'rotatingCoin' ? COIN_ANIMS.rotatingCoin : COIN_ANIMS.coin;
      coinAnim.draw(dx, dy, false, SCALE);
    } else if (item.type === 'mushroom' && item.sprite) {
      const rect = item.sprite.currentRect;
      const adjustedY = dy - (rect.h - item.h);
      item.sprite.draw(dx, adjustedY, false, SCALE);
    } else {
      const color = Color.new(255, 215, 0, 128);
      Draw.rect(drawX_c * SCALE, drawY_c * SCALE,
                item.w * SCALE, item.h * SCALE,
                color);
    }
  });

  // Draw platforms
  platforms.forEach(platform => {
    const drawX_p = platform.x - camX;
    const drawY_p = platform.y - camY;
    const dx = snapToPixel(drawX_p, SCALE) - HALF_TEXEL_BIAS;
    const dy = snapToPixel(drawY_p, SCALE) - HALF_TEXEL_BIAS;
    platform.sprite.draw(dx, dy, false, SCALE);
  });

  // ---- Update HUD ----
  const now = Date.now();
  if (lastTime === 0) {
    lastTime = now;
  }
  const dt = now - lastTime;
  lastTime = now;

  if (time > 0) {
    time -= dt / 1000;
  }

  // ---- Draw HUD ----
  font.drawText("MARIO", 24, 8, 1);
  font.drawText(String(score).padStart(6, "0"), 24, 16, 1);

  font.drawText("COINS", 96, 8, 1);
  font.drawText(String(coins).padStart(2, "0"), 104, 16, 1);

  font.drawText("WORLD", 168, 8, 1);
  const levelNum = currentLevelName.replace("level", "");
  font.drawText(levelNum, 176, 16, 1);

  font.drawText("TIME", 240, 8, 1);
  font.drawText(String(Math.floor(time)).padStart(3, "0"), 248, 16, 1);
});