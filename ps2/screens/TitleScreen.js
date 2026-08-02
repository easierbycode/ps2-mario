import * as Inp from 'lib/input.js';
import { createKonamiDetector } from 'lib/konami.js';
import { getCharacter, setCharacter } from 'lib/character.js';

export default class TitleScreen {
  constructor(screenManager) {
    this.screenManager = screenManager;
    this.titleImage = new Image('assets/images/title.png');
    const screenMode = Screen.getMode();
    this.screenWidth = screenMode.width;
    this.screenHeight = screenMode.height;
    this.konami = createKonamiDetector();
  }

  onEnter() {
    // Optional: Add logic when the screen becomes active
  }

  update() {
    const pad = Inp.poll();

    // Konami code swaps Mario for DK (entering it again swaps back)
    if (this.konami(pad)) {
      setCharacter(getCharacter() === 'dk' ? 'mario' : 'dk');
    }

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
