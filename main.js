import ScreenManager from 'lib/managers/ScreenManager.js';
import TitleScreen from 'screens/TitleScreen.js';
import GameScreen from 'screens/GameScreen.js';

// ---- Setup screen ----
Screen.setVSync(true); // black screen if false

// ---- Initialize ScreenManager ----
const screenManager = new ScreenManager();

// ---- Register Screens ----
screenManager.registerScreen('title', new TitleScreen(screenManager));
screenManager.registerScreen('game', new GameScreen(screenManager));

// ---- Set Initial Screen ----
screenManager.changeScreen('title', false);


// ---- Main loop ----
Screen.display(() => {
  screenManager.update();
  screenManager.render();
});
