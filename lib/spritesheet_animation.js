// lib/spritesheet_animation.js
// Sprite-sheet based animation that matches the API/timing of your Animation class.
// Usage:
//   const anim = new SpriteSheetAnimation("assets/sprites/mario.png", [
//     { x:16*1, y:16*0, w:16, h:16 },
//     { x:16*2, y:16*0, w:16, h:16 },
//     { x:16*3, y:16*0, w:16, h:16 },
//   ], 10);
//
//   anim.draw(x, y, /*flipH=*/false);

export default class SpriteSheetAnimation {
  /**
   * @param {Image} sheet - A pre-loaded, pre-configured spritesheet Image object.
   * @param {Array<{x:number,y:number,w:number,h:number}>} rects - Source rects per frame.
   * @param {number} fps - Frames per second (same semantics as Animation).
   */
  constructor(sheet, rects, fps) {
    this.sheet = sheet;

    this.rects = rects && rects.length ? rects : [{ x: 0, y: 0, w: 1, h: 1 }];
    this.setFps(fps || 1);

    this.timer = Timer.new();
    this.frame = 0;
  }

  /** Draw current frame at (x,y). If flipH=true, mirror horizontally. */
  draw(x, y, flipH = false, SCALE = 1) {
    // advance frame by timer (microseconds like your Animation class)
    if (Timer.getTime(this.timer) >= this._frameIntervalUS) {
      this.frame = (this.frame + 1) % this.rects.length;
      Timer.setTime(this.timer, 1);
    }

    const r = this.rects[this.frame];

    // set source rect (start/end in sheet space)
    this.sheet.startx = r.x;
    this.sheet.endx   = r.x + r.w;
    this.sheet.starty = r.y;
    this.sheet.endy   = r.y + r.h;

    // flip by swapping startx/endx
    if (flipH) {
      const sx = this.sheet.startx;
      this.sheet.startx = this.sheet.endx;
      this.sheet.endx = sx;
    }

    // destination size
    this.sheet.width  = r.w * SCALE;
    this.sheet.height = r.h * SCALE;

    // scale the destination position
    this.sheet.draw(Math.fround(x * SCALE), Math.fround(y * SCALE));
  }

  /** Reset animation to first frame and restart timer. */
  reset() {
    this.frame = 0;
    Timer.setTime(this.timer, 1);
  }

  /** Change frames-per-second at runtime. */
  setFps(fps) {
    const safe = Math.max(0.0001, fps || 1);
    this._frameIntervalUS = 1000000 / safe;
  }

  /** Optional: replace frames on the fly (keeps current frame index in range). */
  setFrames(rects) {
    if (rects && rects.length) {
      this.rects = rects;
      this.frame %= this.rects.length;
    }
  }

  /** Convenience accessors for current frame rect (useful for alignment). */
  get currentRect() {
    return this.rects[this.frame];
  }
}