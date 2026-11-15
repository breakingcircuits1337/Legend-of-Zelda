/**
 * Procedural-Deterministic Full 16x8 Hyrule Overworld Screen Expansion
 * Generates playable, thematically varied ScreenData definitions for every
 * coordinate [col: 0..15, row: 0..7] not already handcrafted in worldData.ts,
 * ensuring 100% of the 128-screen overworld is walkable, interconnected,
 * and aligned with the 16x8 overworld mini-map.
 */

import { ScreenData, EnemyType } from '../types';
import { OVERWORLD_GRID, GridCellInfo } from './overworldMapData';

const SOLID_TILES = new Set([1, 2, 3, 5, 12, 13, 14, 17, 18, 19]);

function coordId(col: number, row: number): string {
  return `O${col}_${row}`;
}

/**
 * Computes symmetric bidirectional exits between adjacent 16x8 overworld coordinates,
 * preserving the Level-1 Eagle Island moat (O7_4), Level-2 north mouth (O6_6),
 * and Level-3 north mouth (O8_5).
 */
export function computeOverworldExits(col: number, row: number): ScreenData['exits'] {
  const exits: ScreenData['exits'] = {};

  // Eagle Island (O7_4) is surrounded by a moat and connects south to O7_5 only
  if (col === 7 && row === 4) {
    return { down: 'O7_5', dungeon: 'D1_1' };
  }

  // Up exit: blocked at row 0, at D2/D3 dungeon mouths, and directly south of Eagle Island? (7,5 -> 7,4 is open!)
  if (row > 0) {
    if (col === 6 && row === 6) {
      exits.up = 'D2_1';
      exits.dungeon = 'D2_1';
    } else if (col === 8 && row === 5) {
      exits.up = 'D3_1';
      exits.dungeon = 'D3_1';
    } else {
      exits.up = coordId(col, row - 1);
    }
  }

  // Down exit: blocked at row 7, above O7_4 Eagle Island (7,3), above O6_6 D2 mouth (6,5), above O8_5 D3 mouth (8,4)
  if (row < 7) {
    const blockedSouth =
      (col === 7 && row === 3) ||
      (col === 6 && row === 5) ||
      (col === 8 && row === 4);
    if (!blockedSouth) {
      exits.down = coordId(col, row + 1);
    }
  }

  // Left exit: blocked at col 0 and directly east of Eagle Island (8,4)
  if (col > 0 && !(col === 8 && row === 4)) {
    exits.left = coordId(col - 1, row);
  }

  // Right exit: blocked at col 15 and directly west of Eagle Island (6,4)
  if (col < 15 && !(col === 6 && row === 4)) {
    exits.right = coordId(col + 1, row);
  }

  return exits;
}

function selectEnemiesForCell(
  cell: GridCellInfo,
  tiles: number[][],
  exits: ScreenData['exits']
): Array<{ type: EnemyType; x: number; y: number }> {
  const isGraveyard = cell.col <= 5 && cell.row <= 2 && cell.name.toLowerCase().includes('grave') ||
    cell.name.toLowerCase().includes('cemetery') ||
    cell.name.toLowerCase().includes('tomb') ||
    cell.name.toLowerCase().includes('haunted');

  let pool: EnemyType[];
  if (isGraveyard) {
    pool = [EnemyType.GHINI, EnemyType.GHINI, EnemyType.PEAHAT];
  } else if (cell.terrain === 'dungeon') {
    pool = [EnemyType.DARKNUT_RED, EnemyType.WIZZROBE_RED, EnemyType.PEAHAT];
  } else if (cell.terrain === 'mountain') {
    pool = [EnemyType.TEKTITE_RED, EnemyType.LEEVER_RED, EnemyType.MOBLIN_BLUE];
  } else if (cell.terrain === 'forest') {
    pool = [EnemyType.MOBLIN_RED, EnemyType.MOBLIN_BLUE, EnemyType.GEL];
  } else if (cell.terrain === 'river' || cell.terrain === 'coast') {
    pool = [EnemyType.OCTOROK_BLUE, EnemyType.PEAHAT, EnemyType.OCTOROK_RED];
  } else {
    pool = [EnemyType.OCTOROK_RED, EnemyType.LEEVER_RED, EnemyType.MOBLIN_RED];
  }

  const candidatePositions = [
    { col: 4, row: 3 },
    { col: 11, row: 3 },
    { col: 4, row: 8 },
    { col: 11, row: 8 },
    { col: 5, row: 5 },
    { col: 10, row: 6 },
    { col: 7, row: 4 },
    { col: 8, row: 6 },
  ];

  // Filter out positions on solid tiles or right inside doorway spawns
  const validCoords = candidatePositions.filter(({ col, row }) => {
    if (SOLID_TILES.has(tiles[row][col])) return false;
    if (exits.left && col <= 2 && (row === 5 || row === 6)) return false;
    if (exits.right && col >= 13 && (row === 5 || row === 6)) return false;
    if (exits.up && row <= 2 && (col === 7 || col === 8)) return false;
    if (exits.down && row >= 8 && (col === 7 || col === 8)) return false;
    return true;
  });

  const seed = cell.col * 31 + cell.row * 17;
  const count = cell.terrain === 'dungeon' ? 3 : 2 + (seed % 2);
  const enemies: Array<{ type: EnemyType; x: number; y: number }> = [];

  for (let i = 0; i < Math.min(count, validCoords.length); i++) {
    const pos = validCoords[(seed + i * 3) % validCoords.length];
    if (enemies.some((e) => e.x === pos.col * 16 && e.y === pos.row * 16)) continue;
    enemies.push({
      type: pool[(seed + i) % pool.length],
      x: pos.col * 16,
      y: pos.row * 16,
    });
  }

  return enemies;
}

function buildTilesForCell(cell: GridCellInfo, exits: ScreenData['exits']): number[][] {
  const borderWall =
    cell.terrain === 'mountain' || cell.terrain === 'dungeon'
      ? 2
      : cell.terrain === 'river'
      ? 3
      : 1;
  const baseFloor =
    cell.terrain === 'coast' || cell.terrain === 'mountain' ? 11 : 0;
  const pathTile =
    cell.terrain === 'river' || cell.terrain === 'coast' || cell.terrain === 'mountain' || cell.terrain === 'dungeon'
      ? 11
      : 0;

  const tiles: number[][] = [];
  for (let r = 0; r < 11; r++) {
    const row: number[] = [];
    for (let c = 0; c < 16; c++) {
      const isEdge = r === 0 || r === 10 || c === 0 || c === 15;
      row.push(isEdge ? borderWall : baseFloor);
    }
    tiles.push(row);
  }

  // Regional obstacles outside crossroads (rows 5..6, cols 7..8) & spawn clearances
  const seed = (cell.col * 73 + cell.row * 139) % 7;

  if (cell.terrain === 'river') {
    // River moat along top & bottom quadrants with walkable sand/bridge crossroads
    for (let c = 2; c < 14; c++) {
      if (c < 6 || c > 9) {
        tiles[2][c] = 3;
        tiles[8][c] = 3;
      }
    }
  } else if (cell.terrain === 'coast') {
    // Ocean shoreline pools on outer corners
    const waterCols = cell.col >= 11 ? [11, 12, 13] : [2, 3];
    for (const c of waterCols) {
      tiles[2][c] = 3;
      tiles[3][c] = 3;
      tiles[8][c] = 3;
      tiles[9][c] = 3;
    }
  } else if (cell.terrain === 'mountain') {
    // Mountain rock formations
    tiles[2][3] = 2; tiles[2][4] = 2; tiles[3][3] = 2;
    tiles[2][11] = 2; tiles[2][12] = 2; tiles[3][12] = 2;
    tiles[7][3] = 2; tiles[8][3] = 2; tiles[8][4] = 2;
    tiles[7][12] = 2; tiles[8][11] = 2; tiles[8][12] = 2;
    if (cell.col <= 5 && cell.row <= 2) {
      // Gravestones in northern graveyard sectors
      tiles[2][4] = 18; tiles[2][11] = 18;
      tiles[8][4] = 18; tiles[8][11] = 18;
    }
  } else if (cell.terrain === 'forest') {
    // Tree groves
    tiles[2][2] = 1; tiles[2][3] = 1; tiles[3][2] = 1;
    tiles[2][12] = 1; tiles[2][13] = 1; tiles[3][13] = 1;
    tiles[7][2] = 1; tiles[8][2] = 1; tiles[8][3] = 1;
    tiles[7][13] = 1; tiles[8][12] = 1; tiles[8][13] = 1;
    if (seed % 2 === 0) {
      tiles[3][5] = 1; tiles[7][10] = 1;
    } else {
      tiles[3][10] = 1; tiles[7][5] = 1;
    }
  } else if (cell.terrain === 'dungeon') {
    // Landmark stone pillars around a central plaza
    tiles[3][4] = 2; tiles[3][11] = 2;
    tiles[7][4] = 2; tiles[7][11] = 2;
    tiles[2][4] = 2; tiles[2][11] = 2;
    tiles[8][4] = 2; tiles[8][11] = 2;
  } else {
    // Plains variation: boulders & small ponds safely clear of doorways
    if (seed % 3 === 0) {
      tiles[2][3] = 1; tiles[3][3] = 1;
      tiles[8][12] = 3; tiles[8][13] = 3;
    } else if (seed % 3 === 1) {
      tiles[2][12] = 2; tiles[3][12] = 2;
      tiles[8][3] = 1; tiles[8][4] = 1;
    } else {
      tiles[2][4] = 1; tiles[2][11] = 1;
      tiles[8][4] = 2; tiles[8][11] = 2;
    }
  }

  // Carve guaranteed walkable central plaza & crossroads connecting every active exit
  for (let c = 2; c <= 13; c++) {
    tiles[5][c] = pathTile;
    tiles[6][c] = pathTile;
  }
  for (let r = 2; r <= 8; r++) {
    tiles[r][7] = pathTile;
    tiles[r][8] = pathTile;
  }

  // Open exact edge doorways matching exits
  if (exits.up) {
    tiles[0][7] = pathTile;
    tiles[0][8] = pathTile;
    tiles[1][7] = pathTile;
    tiles[1][8] = pathTile;
  }
  if (exits.down) {
    tiles[9][7] = pathTile;
    tiles[9][8] = pathTile;
    tiles[10][7] = pathTile;
    tiles[10][8] = pathTile;
  }
  if (exits.left) {
    tiles[5][0] = pathTile;
    tiles[6][0] = pathTile;
    tiles[5][1] = pathTile;
    tiles[6][1] = pathTile;
  }
  if (exits.right) {
    tiles[5][14] = pathTile;
    tiles[6][14] = pathTile;
    tiles[5][15] = pathTile;
    tiles[6][15] = pathTile;
  }

  return tiles;
}

export function buildExpandedOverworldScreens(
  handcraftedScreens: Record<string, ScreenData>
): Record<string, ScreenData> {
  const result: Record<string, ScreenData> = { ...handcraftedScreens };

  for (const cell of OVERWORLD_GRID) {
    const id = cell.id ?? coordId(cell.col, cell.row);
    if (result[id]) continue;

    const exits = computeOverworldExits(cell.col, cell.row);
    const tiles = buildTilesForCell(cell, exits);
    const enemies = selectEnemiesForCell(cell, tiles, exits);

    result[id] = {
      id,
      name: cell.name,
      type: 'overworld',
      music: 'overworld',
      tiles,
      exits,
      enemies,
    };
  }

  return result;
}
