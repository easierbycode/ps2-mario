// lib/tiled.js - AthenaEnv / QuickJS compatible
import * as std from "std";

/** Load and parse a JSON file (Tiled map). */
export function loadJSON(path) {
  const raw = std.loadFile(path);
  if (raw == null) throw new Error(`loadJSON: could not read ${path}`);
  return JSON.parse(raw);
}

/** Get a layer by name. */
export function findLayer(level, name) {
  return level.layers?.find(l => l.name === name) || null;
}

/** Extract tileset info by name (or first). */
export function tilesetInfo(level, tilesetName) {
  const tilesets = level.tilesets || [];
  if (tilesets.length === 0) throw new Error("No tilesets found");

  // Try find by name or fallback to first
  const tsIndex = tilesets.findIndex(t => t.name === tilesetName);
  const ts = tsIndex >= 0 ? tilesets[tsIndex] : tilesets[0];

  // ✅ Compute firstgid if missing
  let firstgid = ts.firstgid | 0;
  if (!firstgid) {
    firstgid = 1;
    for (let i = 0; i < tsIndex; i++) {
      const prev = tilesets[i];
      const prevCount = prev.tilecount || ((prev.imagewidth / prev.tilewidth) * (prev.imageheight / prev.tileheight));
      firstgid += prevCount | 0;
    }
  }

  // ✅ Build tileproperties (old style or new tiles[].properties)
  let tileproperties = ts.tileproperties || {};
  if ((!tileproperties || Object.keys(tileproperties).length === 0) && ts.tiles) {
    tileproperties = {};
    for (const tile of ts.tiles) {
      const localId = tile.id | 0;
      if (tile.properties && Array.isArray(tile.properties)) {
        const propObj = {};
        for (const p of tile.properties) {
          propObj[p.name] = p.value;
        }
        tileproperties[localId] = propObj;
      }
    }
  }

  return {
    name: ts.name || tilesetName,
    image: ts.image,
    tileWidth: ts.tilewidth,
    tileHeight: ts.tileheight,
    columns: ts.columns,
    margin: ts.margin || 0,
    spacing: ts.spacing || 0,
    firstgid,
    tilecount: ts.tilecount | 0,
    tileproperties
  };
}

/** Resolve the actual PNG path for the tileset image, re-rooting to our assets dir if needed. */
export function resolveTilesetImagePath(level, ts, assetsRoot = "assets/tiles") {
  const img = (ts.image || "").replace(/\\/g, "/");
  const filename = img.split("/").pop();
  return `${assetsRoot}/${filename}`;
}

/** Decode a base64 tile layer (no compression) into a Uint32 array of GIDs. */
export function decodeBase64Layer(level, layer) {
  if (!layer || layer.type !== "tilelayer") return null;
  const b64 = layer.data;
  if (typeof b64 !== "string") {
    return Array.isArray(layer.data) ? Uint32Array.from(layer.data) : null;
  }
  const bytes = base64ToBytes(b64);
  const count = bytes.length >> 2;
  const out = new Uint32Array(count);
  for (let i = 0, j = 0; i < count; i++, j += 4) {
    out[i] = bytes[j] | (bytes[j + 1] << 8) | (bytes[j + 2] << 16) | (bytes[j + 3] << 24);
  }
  return out;
}

/** Build a collision grid using tileset tileproperties (collide:true). */
export function collisionGridFromProperties(level, layer, ts) {
  const data = decodeBase64Layer(level, layer);
  if (!data) return { w: layer?.width | 0, h: layer?.height | 0, data: [] };
  const w = layer.width | 0, h = layer.height | 0;

  const solidGIDs = new Set();
  const props = ts.tileproperties || {};
  for (const localId in props) {
    if (props[localId]?.collide) solidGIDs.add((ts.firstgid | 0) + (localId | 0));
  }

  const grid = new Uint8Array(w * h);
  for (let i = 0; i < data.length; i++) grid[i] = solidGIDs.has(data[i]) ? 1 : 0;
  return { w, h, data: grid };
}

/** Draw using decoded data array (Uint32 GIDs). Camera culled. */
export function drawLayerData(layer, data, tilesetImg, tsinfo, camX, camY, SCALE = 1) {
  if (!layer || !data) return;

  const view = Screen.getMode();
  const tw = tsinfo.tileWidth, th = tsinfo.tileHeight;

  const viewW_logical = view.width / SCALE;
  const viewH_logical = view.height / SCALE;

  const x0 = Math.max(0, Math.floor(camX / tw));
  const y0 = Math.max(0, Math.floor(camY / th));
  const x1 = Math.min(layer.width, Math.ceil((camX + viewW_logical) / tw));
  const y1 = Math.min(layer.height, Math.ceil((camY + viewH_logical) / th));

  for (let ty = y0; ty < y1; ty++) {
    for (let tx = x0; tx < x1; tx++) {
      const gid = data[ty * layer.width + tx] | 0;
      if (!gid) continue;

      const tid = gid - tsinfo.firstgid;
      if (tid < 0) continue;

      const sx = (tid % tsinfo.columns) * tw;
      const sy = Math.floor(tid / tsinfo.columns) * th;

      tilesetImg.startx = sx; tilesetImg.starty = sy;
      tilesetImg.endx = sx + tw; tilesetImg.endy = sy + th;

      tilesetImg.width = tw * SCALE;
      tilesetImg.height = th * SCALE;

      const dx = Math.fround((tx * tw - camX) * SCALE);
      const dy = Math.fround((ty * th - camY) * SCALE);
      tilesetImg.draw(dx, dy, tilesetImg.width, tilesetImg.height);
    }
  }
}

/** Find player spawn in object layer (type or name "player"). */
export function findPlayerSpawn(objectLayer) {
  if (!objectLayer || objectLayer.type !== "objectgroup") return null;
  const o = objectLayer.objects?.find(o =>
    (o.type === "player") || (o.name === "player")
  );
  if (!o) return null;
  return { x: o.x | 0, y: o.y | 0, w: (o.width | 0) || 8, h: (o.height | 0) || 14 };
}

/* ----------------- helpers ----------------- */

function base64ToBytes(b64) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let str = b64.replace(/[\r\n\s]/g, "");
  let len = str.length;
  if (len % 4 !== 0) throw new Error("Invalid base64 length");
  let outLen = (len / 4) * 3;
  if (str.endsWith("==")) outLen -= 2;
  else if (str.endsWith("=")) outLen -= 1;

  const out = new Uint8Array(outLen);
  let p = 0;
  const val = c => {
    const v = chars.indexOf(c);
    if (v < 0) throw new Error("Invalid base64 char");
    return v;
  };

  for (let i = 0; i < len; i += 4) {
    const a = val(str[i + 0]), b = val(str[i + 1]),
          c = str[i + 2] === "=" ? 64 : val(str[i + 2]),
          d = str[i + 3] === "=" ? 64 : val(str[i + 3]);

    out[p++] = (a << 2) | (b >> 4);
    if (c !== 64) out[p++] = ((b & 15) << 4) | (c >> 2);
    if (d !== 64) out[p++] = ((c & 3) << 6) | d;
  }
  return out;
}