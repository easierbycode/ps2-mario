import * as Inp from 'lib/input.js';
import { createKonamiDetector } from 'lib/konami.js';
import {
  getCharacter, setCharacter,
  setPlayerCount,
  getPadPort, setPadPort,
} from 'lib/character.js';

const MAIN_ITEMS = ['1 PLAYER GAME', '2 PLAYER GAME', 'ASSIGN PADS'];
const MAX_PORTS = Inp.MAX_PORTS;

export default class TitleScreen {
  constructor(screenManager) {
    this.screenManager = screenManager;
    this.titleImage = new Image('assets/images/title.png');
    this.font = new Font('assets/fonts/mania.ttf');
    const screenMode = Screen.getMode();
    this.screenWidth = screenMode.width;
    this.screenHeight = screenMode.height;
    this.konami = createKonamiDetector();
    this.cursor = 0;
    this.mode = 'main'; // 'main' | 'pads'
    this.padCursor = 0; // 0 = P1 row, 1 = P2 row, 2 = DONE
  }

  onEnter() {
    this.mode = 'main';
  }

  startGame(playerCount) {
    setPlayerCount(playerCount);
    this.screenManager.changeScreen('game', true);
  }

  update() {
    // the menu listens on every port so it works before pads are assigned
    const pad = Inp.pollAll();

    // Konami code swaps Mario / Luigi for Space Mario / Nabbit (entering it
    // again swaps back). The code ends on CROSS, which is also the menu's
    // confirm button — swallow this frame so completing it can't start a game.
    if (this.konami(pad)) {
      setCharacter(getCharacter() === 'space' ? 'mario' : 'space');
      return;
    }

    if (this.mode === 'pads') {
      this.updatePadsMenu(pad);
      return;
    }

    if (pad.upPressed) this.cursor = (this.cursor + MAIN_ITEMS.length - 1) % MAIN_ITEMS.length;
    if (pad.downPressed) this.cursor = (this.cursor + 1) % MAIN_ITEMS.length;
    // SELECT steps the row too, the classic SMB way
    if (pad.select) this.cursor = (this.cursor + 1) % MAIN_ITEMS.length;

    if (pad.start || pad.crossPressed) {
      if (this.cursor === 0) this.startGame(1);
      else if (this.cursor === 1) this.startGame(2);
      else this.mode = 'pads';
    }
  }

  updatePadsMenu(pad) {
    const rows = 3; // P1, P2, DONE
    if (pad.upPressed) this.padCursor = (this.padCursor + rows - 1) % rows;
    if (pad.downPressed) this.padCursor = (this.padCursor + 1) % rows;

    if (this.padCursor < 2) {
      const delta = (pad.rightPressed ? 1 : 0) - (pad.leftPressed ? 1 : 0);
      if (delta) {
        setPadPort(this.padCursor, (getPadPort(this.padCursor) + MAX_PORTS + delta) % MAX_PORTS);
      }
    }

    if (pad.start || (pad.crossPressed && this.padCursor === 2)) {
      this.mode = 'main';
    }
  }

  printCentered(y, text) {
    const w = this.font.getTextSize(text).width;
    this.font.print((this.screenWidth - w) / 2, y, text);
  }

  render() {
    // Draw the title image scaled to the full screen
    this.titleImage.draw(0, 0, this.screenWidth, this.screenHeight);

    const menuTop = this.screenHeight - 148;
    const rowH = 32;

    // dark panel so the menu reads over the light title art (alpha is
    // AthenaEnv's 0-128 range)
    const panelW = 320;
    const panelTop = menuTop - rowH - 8;
    Draw.rect((this.screenWidth - panelW) / 2, panelTop, panelW, rowH * 4 + 24, Color.new(0, 0, 0, 96));

    if (this.mode === 'main') {
      for (let i = 0; i < MAIN_ITEMS.length; i++) {
        const marker = i === this.cursor ? '> ' : '  ';
        this.printCentered(menuTop + i * rowH, marker + MAIN_ITEMS[i]);
      }
    } else {
      const rows = [
        `P1 PAD ${getPadPort(0) + 1}`,
        `P2 PAD ${getPadPort(1) + 1}`,
        'DONE',
      ];
      for (let i = 0; i < rows.length; i++) {
        const marker = i === this.padCursor ? '> ' : '  ';
        this.printCentered(menuTop + i * rowH, marker + rows[i]);
      }
    }

    if (getCharacter() === 'space') {
      this.printCentered(menuTop - rowH, 'SPACE MODE');
    }
  }

  onExit() {
    // Optional: Add cleanup logic when the screen is no longer active
  }
}
