import Inp from 'lib/input.js';

export default class TitleScreen {
  constructor(screenManager) {
    this.screenManager = screenManager;
    this.titleImage = new Image('assets/images/title.png');
    const screenMode = Screen.getMode();
    this.screenWidth = screenMode.width;
    this.screenHeight = screenMode.height;
  }

  onEnter() {
    // Optional: Add logic when the screen becomes active
  }

  update() {
    const pad = Inp.poll();
    if (pad.start) {
      // Use a transition to switch to the game screen
      this.screenManager.changeScreen('game', true);
    }
  }

  render() {
    // Draw the title image scaled to the full screen
    this.titleImage.draw(0, 0, this.screenWidth, this.screenHeight);
  }

  onExit() {
    // Optional: Add cleanup logic when the screen is no longer active
  }
}
