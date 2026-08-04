import * as Tiled from "lib/tiled.js";
import * as Phys from "lib/physics.js";
import * as Inp from "lib/input.js";
import { Platform } from "lib/platform.js";
import { levelEditor_enter, levelEditor_update, levelEditor_render } from "lib/leveleditor.js";
import { Mario } from "objects/mario.js";
import * as ObjAnims from "lib/object_animations.js";
import { getCharacter, getPlayerCount, getPadPort } from "lib/character.js";

export default class GameScreen {
  constructor(screenManager) {
    this.screenManager = screenManager;
    // the transition renders this screen before onEnter()/init() has run
    this.players = [];
    this.level = null;
  }

  // Player 1 — what the level editor and the legacy hooks expect.
  get player() {
    return this.players[0] || null;
  }

  onEnter() {
    this.init();
    this.loadLevel("level1");
  }

  init() {
    // ---- Load assets ----
    this.tileset = null;
    this.font = new Font("assets/fonts/mania.ttf");

    // ---- HUD ----
    this.score = 0;
    this.time = 400;
    this.lastTime = 0;

    // ---- HUD Spacing ----
    this.coinsNumTxtX = Screen.getMode().width - (this.font.getTextSize("COINS000").width + 8);
    this.coinsNumX = this.coinsNumTxtX + this.font.getTextSize("COINS").width + 8;
    this.scoreNumTxtX = this.font.getTextSize("WORLD").width + 8;

    // --- Map & tileset ---
    this.currentLevelName = null;
    this.level = null;
    this.ts = null;
    this.fg = null;
    this.bg = null;
    this.obj = null;
    this.fgData = null;
    this.bgData = null;
    this.collGrid = null;
    this.spawn = null;

    // ---- World constants ----
    this.TILE = 8;
    this.GRAV = 0.35;
    this.SPEED = 1.2;
    this.JUMP_V = -6.0;

    // ---- Camera ----
    this.camX = 0;
    this.camY = 0;

    // ---- Players ----
    this.players = [];
    // bumped by loadLevel so collision loops notice a mid-frame level swap
    this._levelGeneration = 0;
    this.gameOverTimer = 0;

    // ---- Object animations ----
    this.GOOMBA_ANIMS = ObjAnims.createGoombaAnimations();
    this.COIN_ANIMS = ObjAnims.createCoinAnimations();
    this.BOX_SPRITES = ObjAnims.createBoxSprite();
    this.BRICK_SPRITE = ObjAnims.createBrickSprite();
    this.MUSHROOM_SPRITE = ObjAnims.createMushroomSprite();

    // ---- Game Objects ----
    this.enemies = [];
    this.boxes = [];
    this.bricks = [];
    this.collectibles = [];
    this.platforms = [];
    this.portals = [];

    this.gameState = "game";
  }

  loadLevel(levelName) {
    this.currentLevelName = levelName;
    const levelPath = `assets/tiles/${levelName}.json`;
    this.level = Tiled.loadJSON(levelPath);

    const tilesetPath = `assets/tiles/${this.level.tilesets[0].image.replace(
      "../tiles/",
      ""
    )}`;
    this.tileset = new Image(tilesetPath);
    this.tileset.filter = NEAREST;

    this.ts = Tiled.tilesetInfo(this.level, "tiles");
    this.fg = Tiled.findLayer(this.level, "foregroundLayer");
    this.bg = Tiled.findLayer(this.level, "backgroundLayer");
    this.obj = Tiled.findLayer(this.level, "objects");

    this.fgData = Tiled.decodeBase64Layer(this.level, this.fg);
    this.bgData = Tiled.decodeBase64Layer(this.level, this.bg);

    this.collGrid = Tiled.collisionGridFromProperties(this.level, this.fg, this.ts);
    this.spawn = Tiled.findPlayerSpawn(this.obj) || { x: 12, y: 44, w: 8, h: 14 };
    this.TILE = this.ts.tileWidth;
    this._levelGeneration++;

    if (!this.players.length) {
      // Konami code on the title swaps Mario / Luigi for Space Mario / Nabbit
      const space = getCharacter() === "space";
      const characters = [space ? "space_mario" : "mario", space ? "nabbit" : "luigi"];
      for (let i = 0; i < getPlayerCount(); i++) {
        this.players.push(new Mario(
          { x: this.spawn.x + i * 12, y: this.spawn.y, w: this.spawn.w, h: this.spawn.h },
          { character: characters[i], padPort: getPadPort(i) }
        ));
      }
    } else {
      this.players.forEach((p, i) => {
        if (p.out) return;
        p.x = this.spawn.x + i * 12;
        // spawn.y is the feet line, matching the constructor
        p.y = this.spawn.y - p.h;
        p.vx = 0;
        p.vy = 0;
      });
    }


    this.enemies.length = 0;
    this.boxes.length = 0;
    this.bricks.length = 0;
    this.collectibles.length = 0;
    this.platforms.length = 0;
    this.portals.length = 0;

    this.loadObjectsFromTilemap();
  }

  saveLevel(filename, data) {
    const path = `assets/tiles/${filename}`;
    const file = std.open(path, "w");
    file.puts(data);
    file.close();
  }

  handlePlayerPortalOverlap(player, portal) {
    if (portal.name === 'exit' && this.currentLevelName === 'level1') {
      this.loadLevel('level4_2');
      this.placePlayersAt(12, 44, player);
      return;
    }

    const pad = Inp.poll(player.padPort);
    if (
      (pad.down && portal.destination.dir === "down") ||
      (pad.right && portal.destination.dir === "right")
    ) {
      this.loadLevel(portal.destination.level);
      this.placePlayersAt(portal.destination.x, portal.destination.y, player);
    }
  }

  // A portal moves the whole party: the player who took it lands exactly on
  // the destination, everyone else steps in beside them.
  placePlayersAt(x, y, lead) {
    this.players.forEach((p) => {
      if (p.out) return;
      p.x = x + (p === lead ? 0 : 12);
      p.y = y;
      p.vx = 0;
      p.vy = 0;
    });
  }

  playerGotHit() {
    this.player.gotHit();
  }

  bounceUpAfterHitEnemyOnHead() {
    this.player.bounceUpAfterHitEnemyOnHead();
  }

  createCollectible(props = {}) {
    const item = {
      x: props.x ?? 0,
      y: props.y ?? 0,
      w: props.w ?? this.TILE,
      h: props.h ?? this.TILE,
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

  createMushroomCollectible(x, y, options = {}) {
    return this.createCollectible({
      x,
      y,
      w: options.w ?? this.TILE,
      h: options.h ?? this.TILE,
      type: "mushroom",
      textureKey: "mushroom",
      sprite: this.MUSHROOM_SPRITE,
      moveDir: options.moveDir ?? 1,
      moveSpeed: options.moveSpeed ?? 0.8,
      vx: options.vx ?? 0,
      vy: options.vy ?? -2.5,
      points: options.points ?? 1000
    });
  }

  handlePlayerEnemyOverlap(_player, _enemy) {
    _player.gotHit();
  }

  handlePlayerCollectiblesOverlap(_player, _collectible) {
    switch (_collectible.texture.key) {
      case "flower":
        break;
      case "mushroom":
        _player.growMario();
        break;
      case "star":
        break;
      case "coin2":
        this.addCoin(_player);
        break;
      default:
        break;
    }
    _collectible.collected();
  }

  // Coins go to whoever grabbed them; every 100th is worth an extra life.
  addCoin(player) {
    player.coins++;
    this.score += 100;
    if (player.coins % 100 === 0) player.lives++;
  }


  updateCollectibles() {
    this.collectibles.forEach((item) => {
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
        item.vy = Math.min(item.vy + this.GRAV, 6);
        const desiredVX = item.vx;
        Phys.step(item, this.collGrid, this.TILE);
        if (Math.abs(item.vx) < Math.abs(desiredVX) * 0.5) {
          item.moveDir *= -1;
          item.vx = item.moveSpeed * item.moveDir;
        }
      }
    });
  }

  loadObjectsFromTilemap() {
    if (!this.obj || !this.obj.objects) return;

    this.obj.objects.forEach(object => {
      const x = object.x;
      const y = object.y - (object.height || 0);

      switch (object.type) {
        case 'goomba':
          this.enemies.push({
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
          this.boxes.push({
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
          this.bricks.push({
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
          const width = object.width || this.TILE;
          const height = object.height || this.TILE;
          if (collectibleType === 'mushroom') {
            this.collectibles.push(
              this.createMushroomCollectible(x, y, {
                w: width,
                h: height,
                moveDir: direction,
                moveSpeed: 0.8,
                vy: 0
              })
            );
          } else {
            this.collectibles.push(
              this.createCollectible({
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
          const width = object.width || this.TILE;
          const height = object.height || this.TILE;
          this.collectibles.push(
            this.createCollectible({
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
          this.portals.push({
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
          this.platforms.push(new Platform(x, y, object.width, object.height, object.type, object.properties?.distance));
          break;
        case 'platformMovingLeftAndRight':
          this.platforms.push(new Platform(x, y, object.width, object.height, object.type, object.properties?.distance));
          break;
      }
    });

    if (this.fg && this.fgData) {
      const coinTileIds = [96, 97, 98];
      for (let y = 0; y < this.fg.height; y++) {
        for (let x = 0; x < this.fg.width; x++) {
          const tileId = this.fgData[y * this.fg.width + x];
          if (coinTileIds.includes(tileId)) {
            this.collectibles.push(
              this.createCollectible({
                x: x * this.TILE,
                y: y * this.TILE,
                w: this.TILE,
                h: this.TILE,
                type: 'coin',
                textureKey: 'coin',
                fromTilemap: true,
                tileX: x,
                tileY: y
              })
            );
            this.fgData[y * this.fg.width + x] = 0;
          }
        }
      }
    }
  }

  getIntScaleToFillVertically() {
    const view = Screen.getMode();
    const logicalH = (this.fg?.height || this.level.height || 18) * this.TILE;
    return Math.max(1, Math.floor(view.height / logicalH));
  }

  snapToPixel(coord, scale) {
    return Math.round(coord * scale) / scale;
  }

  updateEnemies() {
    this.enemies.forEach(enemy => {
      if (!enemy.alive) return;

      if (!enemy.activated) {
        const near = this.players.some(
          (p) => !p.out && !p.dead && Math.abs(enemy.x - p.x) < 100
        );
        if (near) enemy.activated = true;
        return;
      }

      enemy.vy += this.GRAV * 0.5;
      enemy.x += enemy.vx;
      enemy.y += enemy.vy;

      const bottomY = Math.floor((enemy.y + enemy.h) / this.TILE);
      const midX = Math.floor((enemy.x + enemy.w / 2) / this.TILE);

      if (this.collGrid.data && bottomY < this.collGrid.h) {
        const groundTile = this.collGrid.data[bottomY * this.collGrid.w + midX];
        if (groundTile === 1) {
          enemy.y = bottomY * this.TILE - enemy.h;
          enemy.vy = 0;
        }
      }

      const leftX = Math.floor((enemy.x + enemy.vx) / this.TILE);
      const rightX = Math.floor((enemy.x + enemy.w + enemy.vx) / this.TILE);
      const centerY = Math.floor((enemy.y + enemy.h / 2) / this.TILE);
      const feetY = Math.floor((enemy.y + enemy.h + 1) / this.TILE);

      let hitWall = false;
      if (enemy.vx < 0 && this.collGrid.data[centerY * this.collGrid.w + leftX] === 1) {
        hitWall = true;
      } else if (enemy.vx > 0 && this.collGrid.data[centerY * this.collGrid.w + rightX] === 1) {
        hitWall = true;
      }

      let atEdge = false;
      if (enemy.vx < 0 && this.collGrid.data[feetY * this.collGrid.w + leftX] !== 1) {
        atEdge = true;
      } else if (enemy.vx > 0 && this.collGrid.data[feetY * this.collGrid.w + rightX] !== 1) {
        atEdge = true;
      }

      if (hitWall || atEdge) {
        enemy.vx = -enemy.vx;
      }

      if (enemy.type === 'goomba' && enemy.animState === 'walk') {
        this.GOOMBA_ANIMS.walk.draw(-1000, -1000, false, 1);
      }
    });
  }

  updatePlatforms() {
    this.platforms.forEach(platform => {
      platform.update();
    });
  }

  checkCollisions() {
    const gen = this._levelGeneration;

    for (const player of this.players) {
      if (player.out || player.dead) continue;

      this.enemies.forEach(enemy => {
        if (!enemy.alive || !enemy.activated) return;

        if (player.x < enemy.x + enemy.w &&
          player.x + player.w > enemy.x &&
          player.y < enemy.y + enemy.h &&
          player.y + player.h > enemy.y) {

          if (player.vy > 0 && player.y + player.h - enemy.y < 4) {
            enemy.alive = false;
            if (enemy.type === 'goomba') {
              enemy.animState = 'dead';
              if (!enemy.deathTimer) enemy.deathTimer = 60;
            }
            player.bounceUpAfterHitEnemyOnHead();
          } else if (!player.dead) {
            this.handlePlayerEnemyOverlap(player, enemy);
          }
        }
      });

      this.boxes.forEach(box => {
        if (player.x < box.x + box.w &&
          player.x + player.w > box.x &&
          player.y < box.y + box.h &&
          player.y + player.h > box.y) {

          const overlapX = Math.min(player.x + player.w, box.x + box.w) - Math.max(player.x, box.x);
          const overlapY = Math.min(player.y + player.h, box.y + box.h) - Math.max(player.y, box.y);

          if (overlapX < overlapY) {
            if (player.x < box.x) {
              player.x = box.x - player.w;
            } else {
              player.x = box.x + box.w;
            }
            player.vx = 0;
          } else {
            if (player.y < box.y) {
              player.y = box.y - player.h;
              player.vy = 0;
              player.grounded = true;
            } else {
              if (box.active && player.vy < 0) {
                box.hit = true;
                box.active = false;

                if (box.content === 'coin' || box.content === 'rotatingCoin') {

                  this.addCoin(player);

                  const type =
                    box.content === 'rotatingCoin' ? 'rotatingCoin' : 'coin';
                  this.collectibles.push(
                    this.createCollectible({
                      x: box.x,
                      y: box.y - this.TILE,
                      w: this.TILE,
                      h: this.TILE,
                      type,
                      textureKey: type,
                      vy: -2
                    })
                  );
                } else if (box.content === 'mushroom') {
                  const direction = player.facing >= 0 ? 1 : -1;
                  this.collectibles.push(
                    this.createMushroomCollectible(box.x, box.y - this.TILE, {
                      moveDir: direction,
                      moveSpeed: 0.8,
                      vy: -3
                    })
                  );
                }
              }
              player.y = box.y + box.h;
              player.vy = Math.abs(player.vy) * 0.2;
            }
          }
        }
      });

      this.bricks.forEach(brick => {
        if (brick.destroyed) return;

        if (player.x < brick.x + brick.w &&
            player.x + player.w > brick.x &&
            player.y < brick.y + brick.h &&
            player.y + player.h > brick.y) {

          const overlapX = Math.min(player.x + player.w, brick.x + brick.w) - Math.max(player.x, brick.x);
          const overlapY = Math.min(player.y + player.h, brick.y + brick.h) - Math.max(player.y, brick.y);

          if (overlapX < overlapY) {
            if (player.x < brick.x) {
              player.x = brick.x - player.w;
            } else {
              player.x = brick.x + brick.w;
            }
            player.vx = 0;
          } else {
            if (player.y < brick.y) {
              player.y = brick.y - player.h;
              player.vy = 0;
              player.grounded = true;
            } else {
              if (player.vy < 0) {
                player.vy = Math.abs(player.vy) * 0.2;
                brick.hits--;
                if (brick.hits <= 0) {
                  brick.destroyed = true;
                }
              } else {
                player.y = brick.y + brick.h;
                player.vy = Math.abs(player.vy) * 0.2;
              }
            }
          }
        }
      });

      this.collectibles.forEach(item => {
        if (item._collected) return;

        if (player.x < item.x + item.w &&
          player.x + player.w > item.x &&
          player.y < item.y + item.h &&
          player.y + player.h > item.y) {
          this.handlePlayerCollectiblesOverlap(player, item);
        }
      });

      this.platforms.forEach(platform => {
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

      for (const portal of this.portals) {
        if (player.x < portal.x + portal.w &&
          player.x + player.w > portal.x &&
          player.y < portal.y + portal.h &&
          player.y + player.h > portal.y) {
          this.handlePlayerPortalOverlap(player, portal);
          // a taken portal rebuilt every object list — stop touching them
          if (this._levelGeneration !== gen) return;
        }
      }
    }
  }

  // A dead player falls out of the world before losing the life; this waits
  // for that so the death animation plays out.
  checkPlayerDeaths() {
    const levelH = (this.fg?.height || this.level.height || 18) * this.TILE;
    for (const p of this.players) {
      if (!p.out && p.dead && p.y > levelH + 48) {
        this.handlePlayerDeath(p);
      }
    }
  }

  handlePlayerDeath(p) {
    p.lives--;
    if (p.lives <= 0) {
      p.out = true;
      if (this.players.every((q) => q.out)) {
        this.gameState = "gameover";
        this.gameOverTimer = 180;
      }
      return;
    }

    const partner = this.players.find((q) => q !== p && !q.out && !q.dead);
    if (partner) {
      // rejoin inside the partner's own box — the one spot guaranteed clear
      // of solid tiles; the respawn invulnerability covers the overlap
      p.respawnAt(partner.x, partner.y + partner.h - p.h);
    } else {
      // nobody left standing — every other pending death pays its life now,
      // so a co-dead partner isn't revived for free by the restart
      for (const q of this.players) {
        if (q !== p && !q.out && q.dead) {
          q.lives--;
          if (q.lives <= 0) q.out = true;
        }
      }
      if (this.players.every((q) => q.out)) {
        this.gameState = "gameover";
        this.gameOverTimer = 180;
        return;
      }
      // restart the level from its spawn
      this.loadLevel(this.currentLevelName);
      this.players.forEach((q) => {
        if (!q.out && q.dead) q.respawnAt(q.x, q.y);
      });
    }
  }

  update() {
    if (!this.players.length) return;

    if (this.gameState === "gameover") {
      if (--this.gameOverTimer <= 0) {
        this.screenManager.changeScreen("title", true);
      }
      return;
    }

    const pads = this.players.map((p) => Inp.poll(p.padPort));
    const pad = pads[0];

    if (this.gameState === "game" && pad.down && pad.select) {
      this.gameState = "leveleditor";
      levelEditor_enter(this.ts, this.level, this.player);
      // the chord's own DOWN and SELECT edges are still live this frame —
      // hand them to the editor and it moves the cursor and flips the mode
      // before the first frame is even drawn
      return;
    }

    if (this.gameState === "leveleditor") {
        const editorResult = levelEditor_update(this.ts, this.level, this.fgData, (filename, data) => this.saveLevel(filename, data), this.player.padPort);
        if (typeof editorResult === 'object' && editorResult.nextState === "load_new_level") {
            this.loadLevel('new_level');
            this.placePlayersAt(editorResult.spawnPos.x, editorResult.spawnPos.y - this.player.h, this.player);
            this.gameState = "game";
        } else {
            this.gameState = editorResult;
        }
        return;
    }

    this.players.forEach((p, i) => {
      if (!p.out) p.update(pads[i], this.collGrid, this.TILE);
    });

    this.updateEnemies();
    this.updatePlatforms();
    this.updateCollectibles();
    this.checkCollisions();
    this.checkPlayerDeaths();

    const view = Screen.getMode();
    const SCALE = this.getIntScaleToFillVertically();
    const viewW_logical = view.width / SCALE;

    // the camera tracks whoever is still in the fight
    const focus = this.players.filter((p) => !p.out && !p.dead);
    if (focus.length) {
      const mid = focus.reduce((sum, p) => sum + p.x + p.w * 0.5, 0) / focus.length;
      this.camX = Math.max(0, Math.floor(mid - viewW_logical * 0.5));
    }
    this.camY = 0;

    // co-op: nobody walks off the shared screen. The clamp runs after
    // physics, so revert it rather than shove a player inside a wall that
    // sits at the screen edge — the camera catches up once geometry allows.
    if (this.players.length > 1) {
      for (const p of focus) {
        const maxX = this.camX + viewW_logical - p.w;
        const oldX = p.x;
        if (p.x < this.camX) {
          p.x = this.camX;
          if (p.vx < 0) p.vx = 0;
        } else if (p.x > maxX) {
          p.x = maxX;
          if (p.vx > 0) p.vx = 0;
        }
        if (p.x !== oldX && Phys.hits(p, this.collGrid, this.TILE)) p.x = oldX;
      }
    }
  }

  render() {
    if (!this.players.length || !this.level) return;

    const SCALE = this.getIntScaleToFillVertically();
    const HALF_TEXEL_BIAS = 0.5 / SCALE;

    if (this.gameState === "leveleditor") {
      levelEditor_render(this.tileset, this.ts, this.level, this.fgData, this.font, SCALE);
      return;
    }

    if (this.bg) Tiled.drawLayerData(this.bg, this.bgData, this.tileset, this.ts,
      this.camX - HALF_TEXEL_BIAS, this.camY - HALF_TEXEL_BIAS, SCALE);

    Tiled.drawLayerData(this.fg, this.fgData, this.tileset, this.ts,
      this.camX - HALF_TEXEL_BIAS, this.camY - HALF_TEXEL_BIAS, SCALE);

    // player 1 draws last, so they land on top when the two overlap
    for (let i = this.players.length - 1; i >= 0; i--) {
      const p = this.players[i];
      if (!p.out) p.draw(this.camX, this.camY, SCALE, (c, s) => this.snapToPixel(c, s), HALF_TEXEL_BIAS);
    }

    this.enemies.forEach(enemy => {
      if (!enemy.activated) return;

      const drawX_e = enemy.x - this.camX;
      const drawY_e = enemy.y - this.camY;

      if (enemy.type === 'goomba') {
        const goombaAnim = enemy.animState === 'dead' ? this.GOOMBA_ANIMS.dead : this.GOOMBA_ANIMS.walk;
        const flip = enemy.vx > 0;
        const dx = this.snapToPixel(drawX_e, SCALE) - HALF_TEXEL_BIAS;
        const dy = this.snapToPixel(drawY_e, SCALE) - HALF_TEXEL_BIAS;
        goombaAnim.draw(dx, dy, flip, SCALE);

        if (enemy.animState === 'dead') {
          if (!enemy.deathTimer) enemy.deathTimer = 60;
          enemy.deathTimer--;
          if (enemy.deathTimer <= 0) enemy.activated = false;
        }
      }
    });

    this.boxes.forEach(box => {
      const drawX_b = box.x - this.camX;
      const drawY_b = box.y - this.camY;
      const boxSprite = box.active ? this.BOX_SPRITES.active : this.BOX_SPRITES.hit;
      const dx = this.snapToPixel(drawX_b, SCALE) - HALF_TEXEL_BIAS;
      const dy = this.snapToPixel(drawY_b, SCALE) - HALF_TEXEL_BIAS;
      boxSprite.draw(dx, dy, false, SCALE);
    });

    this.bricks.forEach(brick => {
      if (brick.destroyed) return;
      const drawX_br = brick.x - this.camX;
      const drawY_br = brick.y - this.camY;
      const dx = this.snapToPixel(drawX_br, SCALE) - HALF_TEXEL_BIAS;
      const dy = this.snapToPixel(drawY_br, SCALE) - HALF_TEXEL_BIAS;
      this.BRICK_SPRITE.draw(dx, dy, false, SCALE);
    });

    this.collectibles.forEach(item => {
      if (item._collected) return;
      const drawX_c = item.x - this.camX;
      let drawY_c = item.y - this.camY;

      if (item.type === 'coin2') {
        drawY_c += this.TILE;
      }

      const dx = this.snapToPixel(drawX_c, SCALE) - HALF_TEXEL_BIAS;
      const dy = this.snapToPixel(drawY_c, SCALE) - HALF_TEXEL_BIAS;

      if (item.type === 'coin' || item.type === 'coin2' || item.type === 'rotatingCoin') {
        const coinAnim = item.type === 'rotatingCoin' ? this.COIN_ANIMS.rotatingCoin : this.COIN_ANIMS.coin;
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

    this.platforms.forEach(platform => {
      const drawX_p = platform.x - this.camX;
      const drawY_p = platform.y - this.camY;
      const dx = this.snapToPixel(drawX_p, SCALE) - HALF_TEXEL_BIAS;
      const dy = this.snapToPixel(drawY_p, SCALE) - HALF_TEXEL_BIAS;
      platform.sprite.draw(dx, dy, false, SCALE);
    });

    const now = Date.now();
    if (this.lastTime === 0) {
      this.lastTime = now;
    }
    const dt = now - this.lastTime;
    this.lastTime = now;

    if (this.time > 0) {
      this.time -= dt / 1000;
    }

    const screenW = Screen.getMode().width;

    this.font.print(0, 0, "WORLD");
    // level files use "_" where the world number reads "-" (ISO9660 has no
    // hyphen, so "level4_2.json" is the name that survives onto the disc)
    const levelNum = this.currentLevelName.replace("level", "").replace("_", "-");
    this.font.print(this.scoreNumTxtX, 0, levelNum);

    this.font.print(this.coinsNumTxtX, 0, "TIME");
    this.font.print(this.coinsNumX, 0, String(Math.floor(this.time)).padStart(3, "0"));

    const scoreStr = String(this.score).padStart(6, "0");
    const p1 = this.players[0];

    if (this.players.length === 1) {
      const label = `${p1.label}x${p1.lives}`;
      this.font.print(0, 24, label);
      const scoreX = Math.max(this.scoreNumTxtX, this.font.getTextSize(label).width + 8);
      this.font.print(scoreX, 24, scoreStr);

      this.font.print(this.coinsNumTxtX, 24, "COINS");
      this.font.print(this.coinsNumX, 24, String(p1.coins).padStart(2, "0"));
    } else {
      // 2P: score rides the top centre; each side of the bottom row is one
      // player's lives and coins
      this.font.print((screenW - this.font.getTextSize(scoreStr).width) / 2, 0, scoreStr);

      const p2 = this.players[1];
      const left = `${p1.label}x${p1.lives} C${String(p1.coins).padStart(2, "0")}`;
      const right = `${p2.label}x${p2.lives} C${String(p2.coins).padStart(2, "0")}`;
      this.font.print(0, 24, left);
      this.font.print(screenW - this.font.getTextSize(right).width - 8, 24, right);
    }

    if (this.gameState === "gameover") {
      const msg = "GAME OVER";
      this.font.print((screenW - this.font.getTextSize(msg).width) / 2, 200, msg);
    }
  }

  onExit() {
    // Optional: Add cleanup logic when the screen is no longer active
  }
}
