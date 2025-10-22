import * as Inp from "lib/input.js";
import { saveLevel } from "main.js";

let square_x = 0;
let square_y = 0;
let cur_sprite = 0;

let TILES = [];

function initializeTileList(ts) {
    TILES = [];
    for (let i = 0; i < ts.tilecount; i++) {
        const x = (i % ts.columns) * ts.tileWidth;
        const y = Math.floor(i / ts.columns) * ts.tileHeight;
        TILES.push({ id: i, x: x, y: y });
    }
}

function updateLevelEditorPads(pad, level, fgData) {
    if (pad.left && (square_x > 0)) {
        square_x--;
    }
    if (pad.right && (square_x < level.width - 1)) {
        square_x++;
    }
    if (pad.up && (square_y > 0)) {
        square_y--;
    }
    if (pad.down && (square_y < level.height - 1)) {
        square_y++;
    }

    if (pad.runPressed) {
        cur_sprite = (cur_sprite - 1 + TILES.length) % TILES.length;
    }
    if (pad.boostPressed) {
        cur_sprite = (cur_sprite + 1) % TILES.length;
    }

    if (pad.jumpPressed) {
        const selectedTile = TILES[cur_sprite];
        if (selectedTile) {
            const tileIndex = (square_y * level.width) + square_x;
            fgData[tileIndex] = selectedTile.id + 1;
        }
    }
}

export function levelEditor_create(tilesetImage, ts, level, fgData, font) {
    if (TILES.length !== ts.tilecount) {
        initializeTileList(ts);
        cur_sprite = 0;
    }

    const pad = Inp.poll();

    updateLevelEditorPads(pad, level, fgData);

    const TILE_SIZE = ts.tileWidth;

    Draw.rect(450.0, 0.0, 190.0, 448.0, Color.new(0, 0, 0));
    font.print(460.0, 15.0, "X - Add tile", Color.new(128, 128, 128));
    font.print(460.0, 45.0, "Start - Save & Play", Color.new(128, 128, 128));
    font.print(460.0, 75.0, "D-Pad - Move", Color.new(128, 128, 128));
    font.print(460.0, 105.0, "SQR/TRI - Change sprite", Color.new(128, 128, 128));
    font.print(460.0, 135.0, "Cursor: " + square_x + "," + square_y, Color.new(96, 96, 96));
    font.print(460.0, 165.0, "Tile ID: " + cur_sprite, Color.new(96, 96, 96));

    const selectedTile = TILES[cur_sprite];
    if (selectedTile) {
        Draw.rect(470.0, 250.0, 150.0, 150.0, Color.new(64, 64, 64));
        tilesetImage.startx = selectedTile.x;
        tilesetImage.starty = selectedTile.y;
        tilesetImage.endx = selectedTile.x + TILE_SIZE;
        tilesetImage.endy = selectedTile.y + TILE_SIZE;
        tilesetImage.draw(470, 250, 150, 150);
    }

    for (let y = 0; y < level.height; y++) {
        for (let x = 0; x < level.width; x++) {
            const tileIndex = (y * level.width) + x;
            const tileId = fgData[tileIndex];
            if (tileId > 0) {
                const tile = TILES[tileId - 1];
                if (tile) {
                    const drawX = x * TILE_SIZE;
                    const drawY = y * TILE_SIZE;
                    tilesetImage.startx = tile.x;
                    tilesetImage.starty = tile.y;
                    tilesetImage.endx = tile.x + TILE_SIZE;
                    tilesetImage.endy = tile.y + TILE_SIZE;
                    tilesetImage.draw(drawX, drawY, TILE_SIZE, TILE_SIZE);
                }
            }
        }
    }

    const cursor_x = square_x * TILE_SIZE;
    const cursor_y = square_y * TILE_SIZE;
    Draw.rect(cursor_x, cursor_y, TILE_SIZE, TILE_SIZE, Color.new(255, 0, 0, 128));

    if (pad.start) {
        level.layers.find(l => l.name === "foregroundLayer").data = Array.from(fgData);
        saveLevel("new_level.json", JSON.stringify(level, null, 2));
        return "load_new_level";
    }

    return "leveleditor";
}
