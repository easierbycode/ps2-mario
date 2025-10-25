import * as Tiled from "../lib/tiled.js";
import * as Phys from "../lib/physics.js";
import * as Inp from "../lib/input.js";
import { Platform } from "../lib/platform.js";
import { levelEditor_create } from "../lib/leveleditor.js";
import { Mario } from "../objects/mario.js";
import * as ObjAnims from "../lib/object_animations.js";

export default class GameScreen {
  constructor(screenManager) {
    this.screenManager = screenManager;
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
    this.coins = 0;
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

    // ---- Player ----
    this.player = null;

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

    if (!this.player) {
        this.player = new Mario(this.spawn);
    } else {
        this.player.x = this.spawn.x;
        this.player.y = this.spawn.y;
        this.player.vx = 0;
        this.player.vy = 0;
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
      this.loadLevel('level4-2');
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
      this.loadLevel(portal.destination.level);
      player.x = portal.destination.x;
      player.y = portal.destination.y;
      player.vx = 0;
      player.vy = 0;
    }
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
        this.coins++;
        this.score += 100;
        break;
      default:
        break;
    }
    _collectible.collected();
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
        if (Math.abs(enemy.x - this.player.x) < 100) {
          enemy.activated = true;
        }
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
    this.enemies.forEach(enemy => {
      if (!enemy.alive || !enemy.activated) return;

      if (this.player.x < enemy.x + enemy.w &&
        this.player.x + this.player.w > enemy.x &&
        this.player.y < enemy.y + enemy.h &&
        this.player.y + this.player.h > enemy.y) {

        if (this.player.vy > 0 && this.player.y + this.player.h - enemy.y < 4) {
          enemy.alive = false;
          if (enemy.type === 'goomba') {
            enemy.animState = 'dead';
            if (!enemy.deathTimer) enemy.deathTimer = 60;
          }
          this.player.bounceUpAfterHitEnemyOnHead();
        } else if (!this.player.dead) {
          this.handlePlayerEnemyOverlap(this.player, enemy);
        }
      }
    });

    this.boxes.forEach(box => {
      if (this.player.x < box.x + box.w &&
        this.player.x + this.player.w > box.x &&
        this.player.y < box.y + box.h &&
        this.player.y + this.player.h > box.y) {

        const overlapX = Math.min(this.player.x + this.player.w, box.x + box.w) - Math.max(this.player.x, box.x);
        const overlapY = Math.min(this.player.y + this.player.h, box.y + box.h) - Math.max(this.player.y, box.y);

        if (overlapX < overlapY) {
          if (this.player.x < box.x) {
            this.player.x = box.x - this.player.w;
          } else {
            this.player.x = box.x + box.w;
          }
          this.player.vx = 0;
        } else {
          if (this.player.y < box.y) {
            this.player.y = box.y - this.player.h;
            this.player.vy = 0;
            this.player.grounded = true;
          } else {
            if (box.active && this.player.vy < 0) {
              box.hit = true;
              box.active = false;

              if (box.content === 'coin' || box.content === 'rotatingCoin') {

                this.coins++;
                this.score += 100;

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
                const direction = this.player.facing >= 0 ? 1 : -1;
                this.collectibles.push(
                  this.createMushroomCollectible(box.x, box.y - this.TILE, {
                    moveDir: direction,
                    moveSpeed: 0.8,
                    vy: -3
                  })
                );
              }
            }
            this.player.y = box.y + box.h;
            this.player.vy = Math.abs(this.player.vy) * 0.2;
          }
        }
      }
    });

    this.bricks.forEach(brick => {
      if (brick.destroyed) return;

      if (this.player.x < brick.x + brick.w &&
          this.player.x + this.player.w > brick.x &&
          this.player.y < brick.y + brick.h &&
          this.player.y + this.player.h > brick.y) {

        const overlapX = Math.min(this.player.x + this.player.w, brick.x + brick.w) - Math.max(this.player.x, brick.x);
        const overlapY = Math.min(this.player.y + this.player.h, brick.y + brick.h) - Math.max(this.player.y, brick.y);

        if (overlapX < overlapY) {
          if (this.player.x < brick.x) {
            this.player.x = brick.x - this.player.w;
          } else {
            this.player.x = brick.x + brick.w;
          }
          this.player.vx = 0;
        } else {
          if (this.player.y < brick.y) {
            this.player.y = brick.y - this.player.h;
            this.player.vy = 0;
            this.player.grounded = true;
          } else {
            if (this.player.vy < 0) {
              this.player.vy = Math.abs(this.player.vy) * 0.2;
              brick.hits--;
              if (brick.hits <= 0) {
                brick.destroyed = true;
              }
            } else {
              this.player.y = brick.y + brick.h;
              this.player.vy = Math.abs(this.player.vy) * 0.2;
            }
          }
        }
      }
    });

    this.collectibles.forEach(item => {
      if (item._collected) return;

      if (this.player.x < item.x + item.w &&
        this.player.x + this.player.w > item.x &&
        this.player.y < item.y + item.h &&
        this.player.y + this.player.h > item.y) {
        this.handlePlayerCollectiblesOverlap(this.player, item);
      }
    });

    this.portals.forEach(portal => {
      if (this.player.x < portal.x + portal.w &&
        this.player.x + this.player.w > portal.x &&
        this.player.y < portal.y + portal.h &&
        this.player.y + this.player.h > portal.y) {
        this.handlePlayerPortalOverlap(this.player, portal);
      }
    });

    this.platforms.forEach(platform => {
      if (this.player.x < platform.x + platform.w &&
        this.player.x + this.player.w > platform.x &&
        this.player.y + this.player.h > platform.y &&
        this.player.y + this.player.h < platform.y + platform.h + 4 &&
        this.player.vy >= 0) {
        this.player.y = platform.y - this.player.h;
        this.player.vy = 0;
        this.player.grounded = true;
        this.player.x += platform.vx;
        this.player.y += platform.vy;
      }
    });
  }

  update() {
    if (!this.player) return;

    const pad = Inp.poll();

    if (pad.down && pad.select) {
      this.gameState = "leveleditor";
    }

    if (this.gameState === "leveleditor") {
        const editorResult = levelEditor_create(this.tileset, this.ts, this.level, this.fgData, this.font, this.player);
        if (typeof editorResult === 'object' && editorResult.nextState === "load_new_level") {
            this.loadLevel('new_level');
            this.player.x = editorResult.spawnPos.x;
            this.player.y = editorResult.spawnPos.y - this.player.h;
            this.player.vx = 0;
            this.player.vy = 0;
            this.gameState = "game";
        } else {
            this.gameState = editorResult;
        }
        return;
    }

    this.player.update(pad, this.collGrid, this.TILE);

    this.updateEnemies();
    this.updatePlatforms();
    this.updateCollectibles();
    this.checkCollisions();

    const view = Screen.getMode();
    const SCALE = this.getIntScaleToFillVertically();
    const viewW_logical = view.width / SCALE;

    this.camX = Math.max(0, Math.floor(this.player.x - (viewW_logical * 0.5)));
    this.camY = 0;
  }

  render() {
    if (!this.player) return;

    const SCALE = this.getIntScaleToFillVertically();
    const HALF_TEXEL_BIAS = 0.5 / SCALE;

    if (this.bg) Tiled.drawLayerData(this.bg, this.bgData, this.tileset, this.ts,
      this.camX - HALF_TEXEL_BIAS, this.camY - HALF_TEXEL_BIAS, SCALE);

    Tiled.drawLayerData(this.fg, this.fgData, this.tileset, this.ts,
      this.camX - HALF_TEXEL_BIAS, this.camY - HALF_TEXEL_BIAS, SCALE);

    this.player.draw(this.camX, this.camY, SCALE, (c, s) => this.snapToPixel(c, s), HALF_TEXEL_BIAS);

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

    this.font.print(0, 0, "WORLD");
    const levelNum = this.currentLevelName.replace("level", "");
    this.font.print(this.scoreNumTxtX, 0, levelNum);

    this.font.print(0, 24, "MARIO");
    this.font.print(this.scoreNumTxtX, 24, String(this.score).padStart(6, "0"));

    this.font.print(this.coinsNumTxtX, 0, "TIME");
    this.font.print(this.coinsNumX, 0, String(Math.floor(this.time)).padStart(3, "0"));

    this.font.print(this.coinsNumTxtX, 24, "COINS");
    this.font.print(this.coinsNumX, 24, String(this.coins).padStart(2, "0"));
  }

  onExit() {
    // Optional: Add cleanup logic when the screen is no longer active
  }
}
