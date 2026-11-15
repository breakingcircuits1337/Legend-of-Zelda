/**
 * The Legend of Zelda NES - Player Collision, Safe Knockback & Depenetration Physics
 *
 * Ensures Link never tunnels or gets pushed into solid tiles (walls, water, trees,
 * rocks, bushes, pushable blocks, tombstones) during movement, axis snapping,
 * doorway funneling, or damage knockback — and can always escape cleanly if an
 * external spawn or secret transition ever causes an overlap.
 */

export const GRID_TILE_SIZE = 16;
export const GRID_COLS = 16;
export const GRID_ROWS = 11;
export const PLAYER_HITBOX_SIZE = 14;

/**
 * Solid tiles that block Link's movement:
 * 1 (Tree), 2 (Rock), 3 (Water), 5 (Dungeon Wall), 12 (Bush),
 * 13 (Bombable Wall/Rock), 14 (Pushable Block), 17 (Fissured Rock), 18 (Gravestone),
 * 19 (Locked Boss Gate)
 */
export const SOLID_TILE_IDS = new Set([1, 2, 3, 5, 12, 13, 14, 17, 18, 19]);

export function isSolidTile(tile: number): boolean {
  return SOLID_TILE_IDS.has(tile);
}

/**
 * Continuous AABB-to-grid collision test for box [x, x + width) x [y, y + height).
 * Uses a 0.001px inset on the far edge so exact integer flush positions (e.g. x=50, w=14 -> 63.999)
 * do not falsely collide while fractional overlaps (e.g. 50.5 + 14 = 64.5) are immediately caught.
 */
export function checkGridTileCollision(
  tiles: number[][],
  x: number,
  y: number,
  width: number,
  height: number
): boolean {
  const minCol = Math.floor(x / GRID_TILE_SIZE);
  const maxCol = Math.floor((x + width - 0.001) / GRID_TILE_SIZE);
  const minRow = Math.floor(y / GRID_TILE_SIZE);
  const maxRow = Math.floor((y + height - 0.001) / GRID_TILE_SIZE);

  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) continue;
      if (isSolidTile(tiles[r][c])) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Computes the total pixel intersection area between Link's AABB and any solid tiles.
 * Returns 0 when completely clear of solid tiles.
 */
export function getSolidTileOverlapArea(
  tiles: number[][],
  x: number,
  y: number,
  width: number = PLAYER_HITBOX_SIZE,
  height: number = PLAYER_HITBOX_SIZE
): number {
  const minCol = Math.floor(x / GRID_TILE_SIZE);
  const maxCol = Math.floor((x + width - 0.001) / GRID_TILE_SIZE);
  const minRow = Math.floor(y / GRID_TILE_SIZE);
  const maxRow = Math.floor((y + height - 0.001) / GRID_TILE_SIZE);

  let area = 0;
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) continue;
      if (!isSolidTile(tiles[r][c])) continue;

      const tileLeft = c * GRID_TILE_SIZE;
      const tileTop = r * GRID_TILE_SIZE;
      const overlapW = Math.min(x + width, tileLeft + GRID_TILE_SIZE) - Math.max(x, tileLeft);
      const overlapH = Math.min(y + height, tileTop + GRID_TILE_SIZE) - Math.max(y, tileTop);
      if (overlapW > 0 && overlapH > 0) {
        area += overlapW * overlapH;
      }
    }
  }
  return area;
}

/**
 * Returns true if the box [x, x + width) x [y, y + height) stays within canvas bounds,
 * OR if currently outside bounds and moving strictly back inside.
 */
export function canOccupyScreenBounds(
  currentX: number,
  currentY: number,
  nextX: number,
  nextY: number,
  width: number,
  height: number,
  screenWidth: number,
  screenHeight: number
): { withinX: boolean; withinY: boolean } {
  const withinX =
    (nextX >= 0 && nextX + width <= screenWidth) ||
    (currentX < 0 && nextX > currentX) ||
    (currentX + width > screenWidth && nextX < currentX);

  const withinY =
    (nextY >= 0 && nextY + height <= screenHeight) ||
    (currentY < 0 && nextY > currentY) ||
    (currentY + height > screenHeight && nextY < currentY);

  return { withinX, withinY };
}

/**
 * Checks whether moving from (currentX, currentY) to (nextX, nextY) along a single axis
 * is permitted:
 * - If not currently overlapping solid tiles: target must not collide.
 * - If already overlapping a solid tile (e.g. external spawn/transition): allows movement
 *   that strictly reduces solid overlap area so Link is never trapped inside walls/water/blocks.
 */
export function canStepToTilePosition(
  tiles: number[][],
  currentX: number,
  currentY: number,
  nextX: number,
  nextY: number,
  width: number = PLAYER_HITBOX_SIZE,
  height: number = PLAYER_HITBOX_SIZE
): boolean {
  if (!checkGridTileCollision(tiles, nextX, nextY, width, height)) {
    return true;
  }
  const currentOverlap = getSolidTileOverlapArea(tiles, currentX, currentY, width, height);
  if (currentOverlap <= 0) {
    return false;
  }
  const nextOverlap = getSolidTileOverlapArea(tiles, nextX, nextY, width, height);
  return nextOverlap < currentOverlap - 0.0001;
}

/**
 * Safely applies a small alignment/funnel nudge only if it remains in screen bounds
 * and never pushes Link into (or deeper into) a solid tile.
 */
export function applyGuardedNudge(
  tiles: number[][],
  x: number,
  y: number,
  nudgeX: number,
  nudgeY: number,
  screenWidth: number,
  screenHeight: number,
  width: number = PLAYER_HITBOX_SIZE,
  height: number = PLAYER_HITBOX_SIZE
): { x: number; y: number } {
  let outX = x;
  let outY = y;

  if (nudgeX !== 0) {
    const candX = outX + nudgeX;
    if (
      candX >= 0 &&
      candX + width <= screenWidth &&
      canStepToTilePosition(tiles, outX, outY, candX, outY, width, height)
    ) {
      outX = candX;
    }
  }

  if (nudgeY !== 0) {
    const candY = outY + nudgeY;
    if (
      candY >= 0 &&
      candY + height <= screenHeight &&
      canStepToTilePosition(tiles, outX, outY, outX, candY, width, height)
    ) {
      outY = candY;
    }
  }

  return { x: outX, y: outY };
}

/**
 * Advances knockback (kx, ky) in fine sub-steps per axis so Link stops flush
 * against walls, water, blocks, and screen edges instead of clipping inside them.
 */
export function stepKnockbackSafe(
  tiles: number[][],
  x: number,
  y: number,
  kx: number,
  ky: number,
  screenWidth: number,
  screenHeight: number,
  width: number = PLAYER_HITBOX_SIZE,
  height: number = PLAYER_HITBOX_SIZE
): { x: number; y: number; blockedX: boolean; blockedY: boolean } {
  let curX = x;
  let curY = y;
  let blockedX = false;
  let blockedY = false;

  if (kx !== 0) {
    const steps = Math.max(1, Math.ceil(Math.abs(kx) / 0.5));
    const stepX = kx / steps;
    for (let i = 0; i < steps; i++) {
      const nextX = curX + stepX;
      const { withinX } = canOccupyScreenBounds(
        curX,
        curY,
        nextX,
        curY,
        width,
        height,
        screenWidth,
        screenHeight
      );
      if (withinX && canStepToTilePosition(tiles, curX, curY, nextX, curY, width, height)) {
        curX = nextX;
      } else {
        blockedX = true;
        break;
      }
    }
  }

  if (ky !== 0) {
    const steps = Math.max(1, Math.ceil(Math.abs(ky) / 0.5));
    const stepY = ky / steps;
    for (let i = 0; i < steps; i++) {
      const nextY = curY + stepY;
      const { withinY } = canOccupyScreenBounds(
        curX,
        curY,
        curX,
        nextY,
        width,
        height,
        screenWidth,
        screenHeight
      );
      if (withinY && canStepToTilePosition(tiles, curX, curY, curX, nextY, width, height)) {
        curY = nextY;
      } else {
        blockedY = true;
        break;
      }
    }
  }

  return { x: curX, y: curY, blockedX, blockedY };
}

/**
 * Finds the minimum-displacement non-colliding position within screen bounds if Link
 * is currently overlapping any solid tiles. Returns null if already clear or no spot
 * exists within maxRadius.
 */
export function findNearestWalkablePosition(
  tiles: number[][],
  x: number,
  y: number,
  screenWidth: number,
  screenHeight: number,
  width: number = PLAYER_HITBOX_SIZE,
  height: number = PLAYER_HITBOX_SIZE,
  maxRadius: number = 24
): { x: number; y: number } | null {
  const clampedX = Math.max(0, Math.min(screenWidth - width, x));
  const clampedY = Math.max(0, Math.min(screenHeight - height, y));

  if (!checkGridTileCollision(tiles, clampedX, clampedY, width, height)) {
    return clampedX !== x || clampedY !== y ? { x: clampedX, y: clampedY } : null;
  }

  const dirs = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: -1, dy: -1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: 1 },
    { dx: 1, dy: 1 },
  ];

  for (let radius = 1; radius <= maxRadius; radius++) {
    for (const d of dirs) {
      const testX = Math.max(0, Math.min(screenWidth - width, clampedX + d.dx * radius));
      const testY = Math.max(0, Math.min(screenHeight - height, clampedY + d.dy * radius));
      if (!checkGridTileCollision(tiles, testX, testY, width, height)) {
        return { x: testX, y: testY };
      }
    }
  }

  return null;
}
