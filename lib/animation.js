class Animation {
    constructor(frames, fps) {
        this.frames = frames.map(f => new Image(f));
        this.fps = 1000000 / fps;
        this.timer = Timer.new();
        this.frame = 0;
    }

    draw(x, y, flipH = false) {
        if (Timer.getTime(this.timer) >= this.fps) {
            this.frame = (this.frame + 1) % this.frames.length;
            Timer.setTime(this.timer, 1);
        }

        const img = this.frames[this.frame];
        
        if (flipH) {
            img.startx = img.width;
            img.endx = 0;
        } else {
            img.startx = 0;
            img.endx = img.width;
        }
        
        img.draw(x, y);
    }

    reset() {
        this.frame = 0;
        Timer.setTime(this.timer, 1);
    }
}