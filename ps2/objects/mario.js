import * as Phys from "../lib/physics.js";
import * as Inp from "../lib/input.js";
import { handleAnimations } from "../lib/mario_anim_logic.js";
import {
  createMarioAnimationsFromSheet,
  createDKAnimationsFromSheet,
  createLuigiAnimationsFromSheet,
  createSpaceMarioAnimationsFromSheet,
  createNabbitAnimationsFromSheet,
} from "../lib/mario_animations.js";
import { getCharacter } from "../lib/character.js";

// Every playable character, by the name the session config / GameScreen use.
const ANIM_FACTORIES = {
  mario: createMarioAnimationsFromSheet,
  dk: createDKAnimationsFromSheet,
  luigi: createLuigiAnimationsFromSheet,
  space_mario: createSpaceMarioAnimationsFromSheet,
  nabbit: createNabbitAnimationsFromSheet,
};

// HUD names. Space Mario is still Mario under the helmet.
const LABELS = {
  mario: "MARIO",
  dk: "DK",
  luigi: "LUIGI",
  space_mario: "MARIO",
  nabbit: "NABBIT",
};

// ---- World constants (tune as needed) ----
const GRAV = 0.35;
const JUMP_V = -6.0;
const WALK_SPEED = 1.2;
const RUN_SPEED = 2.4;
// debug-only, and it shows: a tile per frame outruns the camera
const BOOST_SPEED = 9.8;

export class Mario {
  constructor(spawn, opts = {}) {
    this.x = spawn.x;
    this.y = spawn.y - (spawn.h || 14);
    this.w = spawn.w || 8;
    this.h = spawn.h || 14;
    this.vx = 0;
    this.vy = 0;
    this.grounded = false;
    this.facing = 1;
    this.size = "small"; // "small" | "big"
    this.ducking = false;
    this.dead = false;
    this.animName = "";
    this.skidTimer = 0;
    this.invulnerable = false;
    this.invulnerableTimer = 0;
    this.smallWidth = spawn.w || 8;
    this.smallHeight = spawn.h || 14;
    this.bigWidth = (spawn.w || 8);
    this.bigHeight = (spawn.h || 14) + 4;

    this.character = opts.character || getCharacter();
    this.label = opts.label || LABELS[this.character] || "MARIO";
    this.padPort = opts.padPort ?? 0;
    this.lives = opts.lives ?? 3;
    this.coins = 0;
    this.out = false; // no lives left — removed from play

    const factory = ANIM_FACTORIES[this.character] || createMarioAnimationsFromSheet;
    this.anims = factory();
  }

  growMario() {
    if (this.size === "big") return;
    const deltaHeight = this.bigHeight - this.h;
    this.size = "big";
    this.w = this.bigWidth;
    this.h = this.bigHeight;
    this.y -= deltaHeight;
    this.ducking = false;
  }

  shrinkMario() {
    if (this.size === "small") return;
    const deltaHeight = this.h - this.smallHeight;
    this.size = "small";
    this.w = this.smallWidth;
    this.h = this.smallHeight;
    this.y += deltaHeight;
  }

  getVulnerable() {
    return !this.invulnerable;
  }

  gotHit() {
    if (this.dead || !this.getVulnerable()) return;
    if (this.size === "big") {
      this.shrinkMario();
      this.makeInvulnerable(120);
    } else {
      this.dead = true;
      this.vx = 0;
      this.vy = -4;
      this.animName = "dead";
    }
  }

  bounceUpAfterHitEnemyOnHead() {
    this.vy = JUMP_V * 0.5;
  }

  makeInvulnerable(frames = 120) {
    this.invulnerable = true;
    this.invulnerableTimer = frames;
  }

  // Bring a dead player back at (x, y). Death only happens small, so size
  // needs no reset; the brief invulnerability covers the drop back in.
  respawnAt(x, y) {
    this.dead = false;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.grounded = false;
    this.ducking = false;
    this.animName = "";
    this.skidTimer = 0;
    this.makeInvulnerable(120);
  }

  update(pad, collGrid, TILE) {
    // Handle invulnerability timer
    if (this.invulnerable) {
      if (this.invulnerableTimer > 0) {
        this.invulnerableTimer--;
      } else {
        this.invulnerable = false;
        this.invulnerableTimer = 0;
      }
    }

    // Handle input and physics
    if (!this.dead) {
      // B (SQUARE) runs; the boost is the top face button and only answers
      // in a debug build (lib/input.js)
      let SPEED = WALK_SPEED;
      if (pad.run) {
        SPEED = RUN_SPEED;
      } else if (pad.boost) {
        SPEED = BOOST_SPEED;
      }
      this.vx = (pad.right ? SPEED : 0) - (pad.left ? SPEED : 0);
      if (pad.jumpPressed && this.grounded) {
        this.vy = JUMP_V;
      }
      this.ducking = pad.down && this.grounded && this.size === "big";

      // Apply gravity and physics
      this.vy += GRAV;
      Phys.step(this, collGrid, TILE);
    } else {
      // When dead, only apply death jump physics
      this.vy += GRAV * 0.5;
      this.y += this.vy;
    }
  }

  draw(camX, camY, SCALE, snapToPixel, HALF_TEXEL_BIAS) {
    // classic invulnerability flicker
    if (this.invulnerable && Math.floor(this.invulnerableTimer / 4) % 2 === 0) return;

    let currentAnim, rect, flipH;

    if (this.dead) {
      currentAnim = this.anims.dead || this.anims.smallJump || this.anims.smallWalk;
      currentAnim.frame = 0; // Force to first frame
      rect = currentAnim.currentRect;
      flipH = this.facing < 0;
    } else {
      const animResult = handleAnimations(this, this.anims);
      currentAnim = this.anims[animResult.name];
      rect = currentAnim.currentRect;
      flipH = animResult.flipH;
    }

    // Feet-align sprite to collision box
    const drawX_logical = this.x - camX + (this.w - rect.w) * 0.5;
    const drawY_logical = this.y - camY - (rect.h - this.h);

    const drawX = snapToPixel(drawX_logical, SCALE) - HALF_TEXEL_BIAS;
    const drawY = snapToPixel(drawY_logical, SCALE) - HALF_TEXEL_BIAS;

    currentAnim.draw(drawX, drawY, flipH, SCALE);
  }
}
