import ScreenManager from 'lib/managers/ScreenManager.js';
import TitleScreen from 'screens/TitleScreen.js';
import GameScreen from 'screens/GameScreen.js';

// ---- Setup screen ----
// v4 boots with GS depth testing on but never allocates a Z-buffer, so depth
// reads/writes alias the framebuffer: every other flip z-fails and blanks
// (the ~30Hz flicker). This game is painter's-order 2D — turn it off.
if (typeof Screen.setParam === 'function') Screen.setParam(Screen.DEPTH_TEST_ENABLE, 0);
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
