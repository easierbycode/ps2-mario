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

  /**
   * How a player's pad reads in the ASSIGN PADS menu. A port number is all a
   * PS2 can say about a controller; the browser knows the model, so there the
   * rows name the pad itself — DUAL SHOCK 4, SNES CONTROLLER, STADIA — and
   * a port with nothing in it falls back to its number.
   */
  padLabel(playerIndex) {
    const port = getPadPort(playerIndex);
    const name = Inp.padName(port);
    if (!name) return `PAD ${port + 1}`;

    // Two of the same pad read alike, and the pair of them is exactly what a
    // 2-player session is plugged into. Number the copies the way a desktop
    // does: SNES CONTROLLER, SNES CONTROLLER 2.
    let copies = 0;
    let copy = 0;
    for (let p = 0; p < MAX_PORTS; p++) {
      if (Inp.padName(p) !== name) continue;
      copies++;
      if (p === port) copy = copies;
    }
    return copies > 1 ? `${name} ${copy}` : name;
  }

  render() {
    // Draw the title image scaled to the full screen
    this.titleImage.draw(0, 0, this.screenWidth, this.screenHeight);

    const menuTop = this.screenHeight - 148;
    const rowH = 32;

    const items = this.mode === 'main'
      ? MAIN_ITEMS
      : [`P1 ${this.padLabel(0)}`, `P2 ${this.padLabel(1)}`, 'DONE'];
    const cursor = this.mode === 'main' ? this.cursor : this.padCursor;
    const rows = items.map((text, i) => (i === cursor ? '> ' : '  ') + text);
    const banner = getCharacter() === 'space' ? 'SPACE MODE' : '';

    // dark panel so the menu reads over the light title art (alpha is
    // AthenaEnv's 0-128 range). A pad's name runs longer than "PAD 1" ever
    // did, so the panel grows to cover whatever the rows turned out to be.
    const measured = banner ? rows.concat(banner) : rows;
    const widest = measured.reduce((w, text) => Math.max(w, this.font.getTextSize(text).width), 0);
    const panelW = Math.min(this.screenWidth, Math.max(320, widest + 32));
    const panelTop = menuTop - rowH - 8;
    Draw.rect((this.screenWidth - panelW) / 2, panelTop, panelW, rowH * 4 + 24, Color.new(0, 0, 0, 96));

    for (let i = 0; i < rows.length; i++) {
      this.printCentered(menuTop + i * rowH, rows[i]);
    }

    if (banner) {
      this.printCentered(menuTop - rowH, banner);
    }
  }

  onExit() {
    // Optional: Add cleanup logic when the screen is no longer active
  }
}
