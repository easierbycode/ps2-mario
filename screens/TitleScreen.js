import * as Inp from 'lib/input.js';

export default class TitleScreen {
  constructor(screenManager) {
    this.screenManager = screenManager;
    this.titleImage = null;
    const screenMode = Screen.getMode();
    this.screenWidth = screenMode.width;
    this.screenHeight = screenMode.height;
  }

  onEnter() {
    this.titleImage = new Image('assets/images/title.png');
  }

  update() {
    const pad = Inp.poll();
    if (pad.start) {
      // Use a transition to switch to the game screen
      this.screenManager.changeScreen('game', true);
    }
  }

  render() {
    if (!this.titleImage) return;
    // Draw the title image scaled to the full screen
    this.titleImage.draw(0, 0, this.screenWidth, this.screenHeight);
  }

  onExit() {
    // Optional: Add cleanup logic when the screen is no longer active
  }
}
