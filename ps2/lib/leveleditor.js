// The in-game level editor.
//
// It splits into update/render like every other screen so the game's own
// render pass cannot paint over it, and it draws the world at the same
// integer scale the game does: what you see under the cursor is what you get
// when you hit START and play the level back.
import * as Inp from "lib/input.js";

// the help panel is pinned to the right edge; the world view gets the rest
const PANEL_W = 190;
// d-pad repeat, in frames: one step on the press, then hold to repeat
const REPEAT_DELAY = 18;
const REPEAT_RATE = 4;
// the object "objects" mode drops in, in world pixels
const PLATFORM_W = 24;
const PLATFORM_H = 5;

let square_x = 0;
let square_y = 0;
let cur_sprite = 0;
let editMode = "tiles";
let repeatDir = null;
let repeatTimer = 0;

let TILES = [];

function initializeTileList(ts) {
    TILES = [];
    for (let i = 0; i < ts.tilecount; i++) {
        // mirrors Tiled.drawLayerData's source rect, so the preview and the
        // placed tile can never disagree
        const x = (i % ts.columns) * ts.tileWidth;
        const y = Math.floor(i / ts.columns) * ts.tileHeight;
        TILES.push({ id: i, x: x, y: y });
    }
}

/** Reset for a fresh session: cursor on the player, tiles mode, list rebuilt. */
export function levelEditor_enter(ts, level, player) {
    const TILE_SIZE = ts.tileWidth;

    square_x = Math.floor(player.x / TILE_SIZE);
    square_y = Math.floor(player.y / TILE_SIZE);
    editMode = "tiles";
    repeatDir = null;
    repeatTimer = 0;

    if (TILES.length !== ts.tilecount) {
        initializeTileList(ts);
        cur_sprite = 0;
    }

    if (!level.layers.find(l => l.name === "objects")) {
        level.layers.push({
            draworder: "topdown",
            name: "objects",
            objects: [],
            opacity: 1,
            type: "objectgroup",
            visible: true,
            x: 0,
            y: 0
        });
    }
}

// One step per press, then a hold-to-repeat after a pause. The d-pad used to
// be read as "held", which walked the cursor a tile per frame — 60 tiles a
// second, and the DOWN of the DOWN+SELECT chord that opens the editor was
// still down, so it bolted to the bottom of the map before you let go.
function moveCursor(pad, level) {
    const DIRS = [
        ["left", pad.leftPressed, pad.left, -1, 0],
        ["right", pad.rightPressed, pad.right, 1, 0],
        ["up", pad.upPressed, pad.up, 0, -1],
        ["down", pad.downPressed, pad.down, 0, 1]
    ];

    const step = (dx, dy) => {
        square_x = Math.max(0, Math.min(level.width - 1, square_x + dx));
        square_y = Math.max(0, Math.min(level.height - 1, square_y + dy));
    };

    for (const [name, edge, , dx, dy] of DIRS) {
        if (edge) {
            step(dx, dy);
            repeatDir = name;
            repeatTimer = REPEAT_DELAY;
            return;
        }
    }

    const held = DIRS.find(d => d[0] === repeatDir);
    if (!held || !held[2]) {
        repeatDir = null;
        return;
    }
    if (--repeatTimer <= 0) {
        step(held[3], held[4]);
        repeatTimer = REPEAT_RATE;
    }
}

/** Returns "leveleditor" to stay, or a state object once START saves. */
export function levelEditor_update(ts, level, fgData, saveLevel, pollPad = () => Inp.poll(0)) {
    const TILE_SIZE = ts.tileWidth;
    // the caller says which pad drives the editor — the same one that opened
    // it, which for a solo player is whichever pad is talking
    const pad = pollPad();

    moveCursor(pad, level);

    if (pad.tilePrevPressed) {
        cur_sprite = (cur_sprite - 1 + TILES.length) % TILES.length;
    }
    if (pad.tileNextPressed) {
        cur_sprite = (cur_sprite + 1) % TILES.length;
    }

    if (pad.jumpPressed) {
        if (editMode === "tiles") {
            const selectedTile = TILES[cur_sprite];
            if (selectedTile) {
                const tileIndex = (square_y * level.width) + square_x;
                fgData[tileIndex] = selectedTile.id + ts.firstgid;
            }
        } else if (editMode === "objects") {
            const objectLayer = level.layers.find(l => l.name === "objects");
            objectLayer.objects.push({
                height: PLATFORM_H,
                id: (level.nextobjectid = (level.nextobjectid | 0) + 1),
                name: "platformMovingUpAndDown",
                properties: {
                    distance: 80
                },
                propertytypes: {
                    distance: "int"
                },
                rotation: 0,
                type: "platformMovingUpAndDown",
                visible: true,
                width: PLATFORM_W,
                x: square_x * TILE_SIZE,
                y: square_y * TILE_SIZE
            });
        }
    }

    if (pad.select) {
        editMode = editMode === "tiles" ? "objects" : "tiles";
    }

    if (pad.start) {
        level.layers.find(l => l.name === "foregroundLayer").data = Array.from(fgData);
        saveLevel("new_level.json", JSON.stringify(level, null, 2));
        return {
            nextState: "load_new_level",
            spawnPos: {
                x: square_x * TILE_SIZE,
                y: square_y * TILE_SIZE
            }
        };
    }

    return "leveleditor";
}

/** A hollow box, drawn as four edges — Draw only fills. */
function outline(x, y, w, h, t, color) {
    Draw.rect(x, y, w, t, color);
    Draw.rect(x, y + h - t, w, t, color);
    Draw.rect(x, y + t, t, h - t * 2, color);
    Draw.rect(x + w - t, y + t, t, h - t * 2, color);
}

function blitTile(tilesetImage, tile, ts, x, y, size) {
    tilesetImage.startx = tile.x;
    tilesetImage.starty = tile.y;
    tilesetImage.endx = tile.x + ts.tileWidth;
    tilesetImage.endy = tile.y + ts.tileHeight;
    tilesetImage.draw(x, y, size, size);
}

export function levelEditor_render(tilesetImage, ts, level, fgData, font, scale) {
    const TILE_SIZE = ts.tileWidth;
    const view = Screen.getMode();
    const panelX = view.width - PANEL_W;

    // the world view is everything left of the panel, in world pixels
    const viewW = panelX / scale;
    const viewH = view.height / scale;

    // centre on the cursor, then pull back inside the level so the edges of
    // the map do not scroll away into empty space
    const clamp = (v, hi) => (hi <= 0 ? 0 : Math.max(0, Math.min(hi, v)));
    const camX = clamp(
        square_x * TILE_SIZE + TILE_SIZE / 2 - viewW / 2,
        level.width * TILE_SIZE - viewW
    );
    const camY = clamp(
        square_y * TILE_SIZE + TILE_SIZE / 2 - viewH / 2,
        level.height * TILE_SIZE - viewH
    );

    const toScreenX = (worldX) => (worldX - camX) * scale;
    const toScreenY = (worldY) => (worldY - camY) * scale;

    // ---- the level itself, camera culled ----
    const x0 = Math.max(0, Math.floor(camX / TILE_SIZE));
    const y0 = Math.max(0, Math.floor(camY / TILE_SIZE));
    const x1 = Math.min(level.width, Math.ceil((camX + viewW) / TILE_SIZE));
    const y1 = Math.min(level.height, Math.ceil((camY + viewH) / TILE_SIZE));

    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            const gid = fgData[(y * level.width) + x] | 0;
            if (!gid) continue;
            const tile = TILES[gid - ts.firstgid];
            if (!tile) continue;
            blitTile(tilesetImage, tile, ts, toScreenX(x * TILE_SIZE), toScreenY(y * TILE_SIZE), TILE_SIZE * scale);
        }
    }

    const objectLayer = level.layers.find(l => l.name === "objects");
    for (const obj of objectLayer.objects) {
        if (obj.x + obj.width < camX || obj.x > camX + viewW) continue;
        if (obj.y + obj.height < camY || obj.y > camY + viewH) continue;
        Draw.rect(toScreenX(obj.x), toScreenY(obj.y), obj.width * scale, obj.height * scale,
            Color.new(0, 0, 255, 64));
    }

    // ---- the cursor ----
    const cellX = toScreenX(square_x * TILE_SIZE);
    const cellY = toScreenY(square_y * TILE_SIZE);
    const cell = TILE_SIZE * scale;
    const thickness = Math.max(1, scale - 1);

    // ghost of what X drops here, so the cursor shows the item and the spot
    const selectedTile = TILES[cur_sprite];
    if (editMode === "tiles") {
        // a wash under the ghost: the sheet's darkest tiles are near black,
        // and tile 0 is blank, so without it the cell reads as empty either way
        Draw.rect(cellX, cellY, cell, cell, Color.new(72, 72, 104, 40));
        if (selectedTile) {
            const restore = tilesetImage.color;
            tilesetImage.color = Color.new(255, 255, 255, 96);
            blitTile(tilesetImage, selectedTile, ts, cellX, cellY, cell);
            tilesetImage.color = restore;
        }
    } else if (editMode === "objects") {
        Draw.rect(cellX, cellY, PLATFORM_W * scale, PLATFORM_H * scale, Color.new(0, 0, 255, 64));
    }

    // black behind bright so the box reads against sky and brick alike
    outline(cellX - thickness, cellY - thickness, cell + thickness * 2, cell + thickness * 2,
        thickness, Color.new(0, 0, 0));
    outline(cellX, cellY, cell, cell, thickness, Color.new(255, 255, 0));

    // ---- the help panel, last so the world cannot spill into it ----
    // the labels are terse because the panel is only PANEL_W wide and the
    // HUD font is sized for the HUD — the old sentences ran off the edge
    Draw.rect(panelX, 0.0, PANEL_W, view.height, Color.new(0, 0, 0));
    font.print(panelX + 10, 15.0, "X    Place", Color.new(128, 128, 128));
    font.print(panelX + 10, 45.0, "START Save", Color.new(128, 128, 128));
    font.print(panelX + 10, 75.0, "DPAD Move", Color.new(128, 128, 128));
    font.print(panelX + 10, 105.0, "SQR/TRI +-", Color.new(128, 128, 128));
    font.print(panelX + 10, 135.0, "SEL  Mode", Color.new(128, 128, 128));
    font.print(panelX + 10, 165.0, square_x + "," + square_y, Color.new(96, 96, 96));
    font.print(panelX + 10, 195.0, "Tile " + cur_sprite, Color.new(96, 96, 96));
    font.print(panelX + 10, 225.0, editMode, Color.new(96, 96, 96));

    if (selectedTile) {
        Draw.rect(panelX + 20, 250.0, 150.0, 150.0, Color.new(64, 64, 64));
        blitTile(tilesetImage, selectedTile, ts, panelX + 20, 250, 150);
    }
}
