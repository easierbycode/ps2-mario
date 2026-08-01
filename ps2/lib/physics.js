export function step(ent, grid, tile) {
  // Horizontal
  ent.x += ent.vx;
  if (hits(ent, grid, tile)) {
    ent.x -= ent.vx;
    // push out stepwise
    while (!hits(ent, grid, tile)) ent.x += Math.sign(ent.vx) * 0.25;
    ent.x -= Math.sign(ent.vx) * 0.25;
    ent.vx = 0;
  }

  // Vertical
  ent.y += ent.vy;
  let wasFalling = ent.vy > 0;
  if (hits(ent, grid, tile)) {
    ent.y -= ent.vy;
    while (!hits(ent, grid, tile)) ent.y += Math.sign(ent.vy) * 0.25;
    ent.y -= Math.sign(ent.vy) * 0.25;
    ent.vy = 0;
  }

  ent.grounded = wasFalling && touchingGround(ent, grid, tile);
}

function hits(ent, grid, tile) {
  const x0 = Math.floor(ent.x / tile), y0 = Math.floor(ent.y / tile);
  const x1 = Math.floor((ent.x + ent.w - 1) / tile), y1 = Math.floor((ent.y + ent.h - 1) / tile);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
    if (solid(grid, x, y)) return true;
  return false;
}

function touchingGround(ent, grid, tile) {
  const feetY = Math.floor((ent.y + ent.h) / tile);
  const x0 = Math.floor(ent.x / tile), x1 = Math.floor((ent.x + ent.w - 1) / tile);
  for (let x = x0; x <= x1; x++) if (solid(grid, x, feetY)) return true;
  return false;
}

function solid(grid, x, y) {
  if (y < 0 || y >= grid.h || x < 0 || x >= grid.w) return true; // out-of-bounds solid
  return grid.data[y * grid.w + x] === 1;
}