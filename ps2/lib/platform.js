// lib/platform.js
import SpriteSheetAnimation from "lib/spritesheet_animation.js";
export class Platform {
  constructor(x, y, w, h, type, distance) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.type = type;
    this.vx = 0;
    this.vy = 0;
    this.initialX = x;
    this.initialY = y;
    this.distance = distance || 50;

    // Set movement properties based on type
    if (this.type === 'platformMovingUpAndDown') {
      this.vy = 0.5;
    } else if (this.type === 'platformMovingLeftAndRight') {
      this.vx = 0.5;
    }
    this.sprite = new SpriteSheetAnimation('assets/sprites/platform.png', [{x: 0, y: 0, w: w, h: h}], 1);
  }

  update() {
    if (this.type === 'platformMovingUpAndDown') {
      this.y += this.vy;
      if (this.y > this.initialY + this.distance && this.vy > 0) {
        this.vy *= -1;
      } else if (this.y < this.initialY && this.vy < 0) {
        this.vy *= -1;
      }
    } else if (this.type === 'platformMovingLeftAndRight') {
      this.x += this.vx;
      if (this.x > this.initialX + this.distance && this.vx > 0) {
        this.vx *= -1;
      } else if (this.x < this.initialX && this.vx < 0) {
        this.vx *= -1;
      }
    }
  }
}
