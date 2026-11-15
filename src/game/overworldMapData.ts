/**
 * Authentic 16x8 Hyrule Overworld Topological Grid (16 Columns x 8 Rows = 128 Screens)
 * Pure TypeScript definitions & visited-screen lookup helpers.
 */

import { ScreenData } from '../types';

export const OVERWORLD_COLS = 16;
export const OVERWORLD_ROWS = 8;

export interface GridCellInfo {
  col: number; // 0 to 15 (16 columns)
  row: number; // 0 to 7 (8 rows)
  id?: string;
  name: string;
  shortLabel: string;
  terrain: 'plains' | 'mountain' | 'river' | 'coast' | 'dungeon' | 'forest';
  isPlayable: boolean;
  hasCave?: boolean;
  hasDungeon?: boolean;
}

/**
 * Complete 16x8 Hyrule Overworld Grid:
 * 16 Columns (Cols 0 to 15) x 8 Rows (Rows 0 to 7) = 128 Screens
 * Ordered row-major from Top-Left [0,0] to Bottom-Right [15,7].
 */
const RAW_OVERWORLD_GRID: GridCellInfo[] = [
  // ==========================================
  // ROW 0: Northern Death Mountain & Coast Cliffs
  // ==========================================
  { col: 0, row: 0, name: 'Northwest Peaks', shortLabel: 'PEAK', terrain: 'mountain', isPlayable: false },
  { col: 1, row: 0, name: 'Western Waterfall Cliffs', shortLabel: 'CLIF', terrain: 'mountain', isPlayable: false },
  { col: 2, row: 0, name: 'Armos High Pass', shortLabel: 'PASS', terrain: 'mountain', isPlayable: false },
  { col: 3, row: 0, name: 'Spectacle Foothills', shortLabel: 'HILL', terrain: 'mountain', isPlayable: false },
  { col: 4, row: 0, name: 'Spectacle Rock West', shortLabel: 'SPEC', terrain: 'mountain', isPlayable: false },
  { col: 5, row: 0, name: 'Death Mountain Peak (Level-9)', shortLabel: 'D-9', terrain: 'dungeon', isPlayable: false, hasDungeon: true },
  { col: 6, row: 0, name: 'Death Mountain North Pass', shortLabel: 'PASS', terrain: 'mountain', isPlayable: false },
  { col: 7, row: 0, name: 'Northern Mountain Ridge', shortLabel: 'RDGE', terrain: 'mountain', isPlayable: false },
  { col: 8, row: 0, name: 'Dead Rock Ridge', shortLabel: 'ROCK', terrain: 'mountain', isPlayable: false },
  { col: 9, row: 0, name: 'Northern Moors', shortLabel: 'MOOR', terrain: 'mountain', isPlayable: false },
  { col: 10, row: 0, name: 'North Sea Cliffs', shortLabel: 'CLIF', terrain: 'mountain', isPlayable: false },
  { col: 11, row: 0, name: 'Great Northern Ocean', shortLabel: 'SEA', terrain: 'river', isPlayable: false },
  { col: 12, row: 0, name: 'Northeast Coast', shortLabel: 'CST', terrain: 'coast', isPlayable: false },
  { col: 13, row: 0, name: 'Ladder Pier West', shortLabel: 'PIER', terrain: 'coast', isPlayable: false },
  { col: 14, row: 0, name: 'Magic Potion Cape', shortLabel: 'CAPE', terrain: 'coast', isPlayable: false, hasCave: true },
  { col: 15, row: 0, name: 'Far Northeast Shoals', shortLabel: 'SHOL', terrain: 'river', isPlayable: false },

  // ==========================================
  // ROW 1: Graveyard & Northern River Valley
  // ==========================================
  { col: 0, row: 1, name: 'Graveyard Northwest', shortLabel: 'GRAV', terrain: 'mountain', isPlayable: false },
  { col: 1, row: 1, name: 'Tomb of Kings (Level-6 Approach)', shortLabel: 'TOMB', terrain: 'mountain', isPlayable: false },
  { col: 2, row: 1, name: 'Level-6: The Dragon', shortLabel: 'D-6', terrain: 'dungeon', isPlayable: false, hasDungeon: true },
  { col: 3, row: 1, name: 'Western Canyon', shortLabel: 'CANY', terrain: 'mountain', isPlayable: false },
  { col: 4, row: 1, name: 'Graveyard West', shortLabel: 'GRAV', terrain: 'mountain', isPlayable: false },
  { col: 5, row: 1, name: 'White Sword Graveyard', shortLabel: 'GRAV', terrain: 'mountain', isPlayable: false, hasCave: true },
  { col: 6, row: 1, name: 'Lost Hills Pass', shortLabel: 'HILL', terrain: 'forest', isPlayable: false },
  { col: 7, row: 1, name: 'Northern Woods Glade', shortLabel: 'WOOD', terrain: 'forest', isPlayable: false },
  { col: 8, row: 1, name: 'River Source Waterfall', shortLabel: 'FALL', terrain: 'river', isPlayable: false },
  { col: 9, row: 1, name: 'Waterfall Secret Cavern', shortLabel: 'CAVE', terrain: 'mountain', isPlayable: false, hasCave: true },
  { col: 10, row: 1, name: 'North Ocean Headland', shortLabel: 'BLUF', terrain: 'coast', isPlayable: false },
  { col: 11, row: 1, name: 'Storm Sea Deep', shortLabel: 'SEA', terrain: 'river', isPlayable: false },
  { col: 12, row: 1, name: 'Eastern River Mouth', shortLabel: 'RIVR', terrain: 'river', isPlayable: false },
  { col: 13, row: 1, name: 'Eastern Cliffs', shortLabel: 'CLIF', terrain: 'mountain', isPlayable: false },
  { col: 14, row: 1, name: 'Sea Lookout', shortLabel: 'LOOK', terrain: 'coast', isPlayable: false },
  { col: 15, row: 1, name: 'Eastern Ocean North', shortLabel: 'SEA', terrain: 'river', isPlayable: false },

  // ==========================================
  // ROW 2: Lost Hills, Upper River & Level-5
  // ==========================================
  { col: 0, row: 2, name: 'Lost Hills West', shortLabel: 'HILL', terrain: 'mountain', isPlayable: false },
  { col: 1, row: 2, name: 'Upper Cemetery', shortLabel: 'GRAV', terrain: 'mountain', isPlayable: false },
  { col: 2, row: 2, name: 'Haunted Ridge', shortLabel: 'RDGE', terrain: 'mountain', isPlayable: false },
  { col: 3, row: 2, name: 'Central Mountain Pass', shortLabel: 'PASS', terrain: 'mountain', isPlayable: false },
  { col: 4, row: 2, name: 'Lost Woods Entrance', shortLabel: 'LOST', terrain: 'forest', isPlayable: false },
  { col: 5, row: 2, name: 'Lost Woods Heart', shortLabel: 'WOOD', terrain: 'forest', isPlayable: false },
  { col: 6, row: 2, name: 'Western Steppes', shortLabel: 'STEP', terrain: 'plains', isPlayable: false },
  { col: 7, row: 2, name: 'Upper River Bend', shortLabel: 'RVR', terrain: 'river', isPlayable: false },
  { col: 8, row: 2, name: 'Upper River Bridge', shortLabel: 'BRDG', terrain: 'river', isPlayable: false },
  { col: 9, row: 2, name: 'Eastern Moors', shortLabel: 'MOOR', terrain: 'plains', isPlayable: false },
  { col: 10, row: 2, name: 'Coastline Bluff', shortLabel: 'CLIF', terrain: 'coast', isPlayable: false },
  { col: 11, row: 2, name: 'Eastern Deep Sea', shortLabel: 'SEA', terrain: 'river', isPlayable: false },
  { col: 12, row: 2, name: 'Level-5: The Lizard', shortLabel: 'D-5', terrain: 'dungeon', isPlayable: false, hasDungeon: true },
  { col: 13, row: 2, name: 'Eastern Woods North', shortLabel: 'WOOD', terrain: 'forest', isPlayable: false },
  { col: 14, row: 2, name: 'Coastal Grove', shortLabel: 'GRVE', terrain: 'forest', isPlayable: false },
  { col: 15, row: 2, name: 'Eastern Ocean', shortLabel: 'SEA', terrain: 'river', isPlayable: false },

  // ==========================================
  // ROW 3: Lost Woods, Whispering Stream & Lake
  // ==========================================
  { col: 0, row: 3, name: 'Lost Woods North', shortLabel: 'LOST', terrain: 'forest', isPlayable: false },
  { col: 1, row: 3, name: 'Power Bracelet Statues', shortLabel: 'STAT', terrain: 'forest', isPlayable: false },
  { col: 2, row: 3, name: 'Maze Forest West', shortLabel: 'MAZE', terrain: 'forest', isPlayable: false },
  { col: 3, row: 3, name: 'Fairy Lake West', shortLabel: 'LAKE', terrain: 'river', isPlayable: false },
  { col: 4, row: 3, name: 'Western Glade', shortLabel: 'GLAD', terrain: 'forest', isPlayable: false },
  { col: 5, row: 3, name: 'Blue Ring Secret Glade', shortLabel: 'RING', terrain: 'forest', isPlayable: false, hasCave: true },
  { col: 6, row: 3, name: 'Upper Whispering Stream', shortLabel: 'STRM', terrain: 'river', isPlayable: false },
  { col: 7, row: 3, name: 'Eagle Approach Stream', shortLabel: 'STRM', terrain: 'river', isPlayable: false },
  { col: 8, row: 3, name: 'Dead Tree Grove', shortLabel: 'TREE', terrain: 'forest', isPlayable: false },
  { col: 9, row: 3, name: 'Eastern Steppes', shortLabel: 'STEP', terrain: 'plains', isPlayable: false },
  { col: 10, row: 3, name: 'Shoreline Sands', shortLabel: 'SAND', terrain: 'coast', isPlayable: false },
  { col: 11, row: 3, name: 'Outer Ocean', shortLabel: 'SEA', terrain: 'river', isPlayable: false },
  { col: 12, row: 3, name: 'Coastal Causeway', shortLabel: 'CAUS', terrain: 'plains', isPlayable: false },
  { col: 13, row: 3, name: 'Eastern Dunes', shortLabel: 'DUNE', terrain: 'coast', isPlayable: false },
  { col: 14, row: 3, name: 'Raft Dock North', shortLabel: 'DOCK', terrain: 'coast', isPlayable: false },
  { col: 15, row: 3, name: 'Level-4 Island Sea', shortLabel: 'SEA', terrain: 'river', isPlayable: false },

  // ==========================================
  // ROW 4: Level 1 The Eagle & Central Highlands
  // ==========================================
  { col: 0, row: 4, name: 'Western Dead Woods', shortLabel: 'WOOD', terrain: 'forest', isPlayable: false },
  { col: 1, row: 4, name: 'Graveyard Outer Path', shortLabel: 'PATH', terrain: 'plains', isPlayable: false },
  { col: 2, row: 4, name: 'Level-7: The Demon Lake', shortLabel: 'D-7', terrain: 'dungeon', isPlayable: false, hasDungeon: true },
  { col: 3, row: 4, name: 'Lake Hylia West', shortLabel: 'LAKE', terrain: 'river', isPlayable: false },
  { col: 4, row: 4, name: 'Death Mountain Slopes', shortLabel: 'MNT', terrain: 'mountain', isPlayable: false },
  { col: 5, row: 4, name: 'North Rock Pass', shortLabel: 'PASS', terrain: 'mountain', isPlayable: false },
  { col: 6, row: 4, name: 'Eagle Bluff', shortLabel: 'BLUF', terrain: 'mountain', isPlayable: false },
  { col: 7, row: 4, id: 'O7_4', name: 'Level 1: The Eagle Entrance', shortLabel: 'D-1', terrain: 'dungeon', isPlayable: true, hasDungeon: true },
  { col: 8, row: 4, name: 'Dead Rock Ridge', shortLabel: 'RDGE', terrain: 'mountain', isPlayable: false },
  { col: 9, row: 4, name: 'Northern Moors', shortLabel: 'MOOR', terrain: 'mountain', isPlayable: false },
  { col: 10, row: 4, name: 'North Sea Cliffs', shortLabel: 'CLIF', terrain: 'mountain', isPlayable: false },
  { col: 11, row: 4, name: 'Northern Ocean', shortLabel: 'SEA', terrain: 'river', isPlayable: false },
  { col: 12, row: 4, name: 'Eastern Peninsula', shortLabel: 'PEN', terrain: 'plains', isPlayable: false },
  { col: 13, row: 4, name: 'Eastern Beach Cliffs', shortLabel: 'CLIF', terrain: 'coast', isPlayable: false },
  { col: 14, row: 4, name: 'Sea Bridge West', shortLabel: 'BRDG', terrain: 'coast', isPlayable: false },
  { col: 15, row: 4, name: 'Level-4: The Snake', shortLabel: 'D-4', terrain: 'dungeon', isPlayable: false, hasDungeon: true },

  // ==========================================
  // ROW 5: Goblin Forest, Level 3 The Manji & Eastern Sea
  // ==========================================
  { col: 0, row: 5, name: 'Far West Forest', shortLabel: 'FRST', terrain: 'forest', isPlayable: false },
  { col: 1, row: 5, name: 'Magical Shield Glade', shortLabel: 'GLAD', terrain: 'forest', isPlayable: false, hasCave: true },
  { col: 2, row: 5, name: 'Lake Border West', shortLabel: 'LAKE', terrain: 'plains', isPlayable: false },
  { col: 3, row: 5, name: 'Graveyard Approach', shortLabel: 'PATH', terrain: 'mountain', isPlayable: false },
  { col: 4, row: 5, name: 'Lost Woods Deep', shortLabel: 'WOOD', terrain: 'forest', isPlayable: false },
  { col: 5, row: 5, name: 'Lost Woods Border', shortLabel: 'WOOD', terrain: 'forest', isPlayable: false },
  { col: 6, row: 5, name: 'Western Stream', shortLabel: 'RVR', terrain: 'river', isPlayable: false },
  { col: 7, row: 5, id: 'O7_5', name: 'Goblin Forest & Fairy Spring', shortLabel: 'FRST', terrain: 'forest', isPlayable: true, hasCave: true },
  { col: 8, row: 5, id: 'O8_5', name: 'Level 3: The Manji Glade', shortLabel: 'D-3', terrain: 'dungeon', isPlayable: true, hasDungeon: true },
  { col: 9, row: 5, name: 'Eastern Prairie', shortLabel: 'PRAR', terrain: 'plains', isPlayable: false },
  { col: 10, row: 5, name: 'Coastal Dunes', shortLabel: 'DUNE', terrain: 'coast', isPlayable: false },
  { col: 11, row: 5, name: 'Eastern Sea', shortLabel: 'SEA', terrain: 'river', isPlayable: false },
  { col: 12, row: 5, name: 'Lion Forest', shortLabel: 'WOOD', terrain: 'forest', isPlayable: false },
  { col: 13, row: 5, name: 'Level-8: The Lion', shortLabel: 'D-8', terrain: 'dungeon', isPlayable: false, hasDungeon: true },
  { col: 14, row: 5, name: 'Eastern Shore', shortLabel: 'SHOR', terrain: 'coast', isPlayable: false },
  { col: 15, row: 5, name: 'Eastern Deep Sea', shortLabel: 'SEA', terrain: 'river', isPlayable: false },

  // ==========================================
  // ROW 6: Graveyards, Level 2 Lake, River Bridge & Headland
  // ==========================================
  { col: 0, row: 6, name: 'Lost Woods South', shortLabel: 'LOST', terrain: 'forest', isPlayable: false },
  { col: 1, row: 6, name: 'Western Plains', shortLabel: 'PLNS', terrain: 'plains', isPlayable: false },
  { col: 2, row: 6, name: 'Old Woman Medicine Shop', shortLabel: 'SHOP', terrain: 'plains', isPlayable: false, hasCave: true },
  { col: 3, row: 6, name: 'Graveyard Gate', shortLabel: 'GATE', terrain: 'mountain', isPlayable: false },
  { col: 4, row: 6, id: 'O4_6', name: 'Ancient Cemetery', shortLabel: 'GRAV', terrain: 'mountain', isPlayable: true },
  { col: 5, row: 6, id: 'O5_6', name: 'Haunted Graveyard', shortLabel: 'GRAV', terrain: 'mountain', isPlayable: true },
  { col: 6, row: 6, id: 'O6_6', name: 'Whispering Lake & Level-2 Entrance', shortLabel: 'D-2', terrain: 'dungeon', isPlayable: true, hasDungeon: true },
  { col: 7, row: 6, id: 'O7_6', name: 'River Crossing & White Sword', shortLabel: 'RIVR', terrain: 'river', isPlayable: true, hasCave: true },
  { col: 8, row: 6, id: 'O8_6', name: 'Coastal Headland & Gambling Den', shortLabel: 'HEAD', terrain: 'coast', isPlayable: true, hasCave: true },
  { col: 9, row: 6, name: 'Desert Boundary', shortLabel: 'DSRT', terrain: 'plains', isPlayable: false },
  { col: 10, row: 6, name: 'Eastern Beach', shortLabel: 'BCH', terrain: 'coast', isPlayable: false },
  { col: 11, row: 6, name: 'Great Ocean', shortLabel: 'SEA', terrain: 'river', isPlayable: false },
  { col: 12, row: 6, name: 'Southern Woods', shortLabel: 'WOOD', terrain: 'forest', isPlayable: false },
  { col: 13, row: 6, name: 'Eastern Delta', shortLabel: 'DLTA', terrain: 'river', isPlayable: false },
  { col: 14, row: 6, name: 'Southern Beach East', shortLabel: 'BCH', terrain: 'coast', isPlayable: false },
  { col: 15, row: 6, name: 'Southeast Ocean', shortLabel: 'SEA', terrain: 'river', isPlayable: false },

  // ==========================================
  // ROW 7: Starting Glade, Desert & Southern Coast
  // ==========================================
  { col: 0, row: 7, name: 'Southwest Corner', shortLabel: 'SW', terrain: 'plains', isPlayable: false },
  { col: 1, row: 7, name: 'Western Desert Edge', shortLabel: 'DSRT', terrain: 'plains', isPlayable: false },
  { col: 2, row: 7, name: 'Southern Desert', shortLabel: 'DSRT', terrain: 'plains', isPlayable: false },
  { col: 3, row: 7, name: 'Heart Piece Coast', shortLabel: 'CST', terrain: 'coast', isPlayable: false, hasCave: true },
  { col: 4, row: 7, id: 'O4_7', name: 'Southwest Wilds', shortLabel: 'WILD', terrain: 'plains', isPlayable: true },
  { col: 5, row: 7, id: 'O5_7', name: 'Western Desert & Merchant Shop', shortLabel: 'DSRT', terrain: 'plains', isPlayable: true, hasCave: true },
  { col: 6, row: 7, id: 'O6_7', name: 'Rocky Foothills & Heart Cavern', shortLabel: 'HILL', terrain: 'mountain', isPlayable: true, hasCave: true },
  { col: 7, row: 7, id: 'O7_7', name: 'Starting Screen & Old Man Cave', shortLabel: 'STRT', terrain: 'plains', isPlayable: true, hasCave: true },
  { col: 8, row: 7, id: 'O8_7', name: 'Eastern Coast & Rupee Cave', shortLabel: 'CST', terrain: 'coast', isPlayable: true, hasCave: true },
  { col: 9, row: 7, name: 'Tidepool Coast', shortLabel: 'TIDE', terrain: 'coast', isPlayable: false },
  { col: 10, row: 7, name: 'Coastal Shoals', shortLabel: 'SHOL', terrain: 'river', isPlayable: false },
  { col: 11, row: 7, name: 'Deep Sea Border', shortLabel: 'DEEP', terrain: 'river', isPlayable: false },
  { col: 12, row: 7, name: 'South Island Causeway', shortLabel: 'ISLD', terrain: 'coast', isPlayable: false },
  { col: 13, row: 7, name: 'South Ocean Reef', shortLabel: 'REEF', terrain: 'river', isPlayable: false },
  { col: 14, row: 7, name: 'Secret Coast Pier', shortLabel: 'PIER', terrain: 'coast', isPlayable: false },
  { col: 15, row: 7, name: 'Southeast Deep Sea', shortLabel: 'SEA', terrain: 'river', isPlayable: false },
];

export const OVERWORLD_GRID: GridCellInfo[] = RAW_OVERWORLD_GRID.map((cell) => ({
  ...cell,
  id: cell.id ?? `O${cell.col}_${cell.row}`,
  isPlayable: true,
}));

/**
 * Checks whether a 16x8 overworld grid cell has been physically visited by Link.
 */
export function isCellVisited(
  cell: GridCellInfo,
  visitedScreens?: string[],
  currentLocation?: { col: number; row: number }
): boolean {
  if (currentLocation && cell.col === currentLocation.col && cell.row === currentLocation.row) {
    return true;
  }
  if (!visitedScreens || visitedScreens.length === 0) {
    return cell.col === 7 && cell.row === 7;
  }
  if (cell.id && visitedScreens.includes(cell.id)) return true;
  if (visitedScreens.includes(`O${cell.col}_${cell.row}`)) return true;
  if (visitedScreens.includes(`${cell.col},${cell.row}`)) return true;
  if (visitedScreens.includes(`C${cell.col}_R${cell.row}`)) return true;

  return false;
}

/**
 * Maps any screen ID in the entire game to authentic 16x8 overworld coordinates (col, row)
 */
export function getPlayerOverworldLocation(screen: ScreenData): {
  col: number;
  row: number;
  areaType: 'OVERWORLD' | 'CAVE' | 'LEVEL-1' | 'LEVEL-2' | 'LEVEL-3';
  areaName: string;
  coordString: string;
  isDungeon: boolean;
  isCave: boolean;
} {
  if (screen.id.startsWith('D1_')) {
    return {
      col: 7,
      row: 4,
      areaType: 'LEVEL-1',
      areaName: screen.name || 'Level 1: The Eagle',
      coordString: '7,4',
      isDungeon: true,
      isCave: false,
    };
  }

  if (screen.id.startsWith('D2_')) {
    return {
      col: 6,
      row: 6,
      areaType: 'LEVEL-2',
      areaName: screen.name || 'Level 2: The Moon',
      coordString: '6,6',
      isDungeon: true,
      isCave: false,
    };
  }

  if (screen.id.startsWith('D3_')) {
    return {
      col: 8,
      row: 5,
      areaType: 'LEVEL-3',
      areaName: screen.name || 'Level 3: The Manji',
      coordString: '8,5',
      isDungeon: true,
      isCave: false,
    };
  }

  if (screen.id === 'C_START') {
    return {
      col: 7,
      row: 7,
      areaType: 'CAVE',
      areaName: "Old Man's Cave",
      coordString: '7,7',
      isDungeon: false,
      isCave: true,
    };
  }

  if (screen.id === 'C_SHOP') {
    return {
      col: 5,
      row: 7,
      areaType: 'CAVE',
      areaName: 'Item Merchant Shop',
      coordString: '5,7',
      isDungeon: false,
      isCave: true,
    };
  }

  if (screen.id === 'C_SECRET_SHOP') {
    return {
      col: 7,
      row: 5,
      areaType: 'CAVE',
      areaName: 'Secret Subterranean Shop',
      coordString: '7,5',
      isDungeon: false,
      isCave: true,
    };
  }

  if (screen.id === 'C_SECRET_HEART') {
    return {
      col: 6,
      row: 7,
      areaType: 'CAVE',
      areaName: 'Secret Heart Cavern',
      coordString: '6,7',
      isDungeon: false,
      isCave: true,
    };
  }

  if (screen.id === 'C_SECRET_RUPEE') {
    return {
      col: 8,
      row: 7,
      areaType: 'CAVE',
      areaName: 'Secret Coastal Cavern',
      coordString: '8,7',
      isDungeon: false,
      isCave: true,
    };
  }

  if (screen.id === 'C_SECRET_WHITE_SWORD') {
    return {
      col: 7,
      row: 6,
      areaType: 'CAVE',
      areaName: 'Ancient Blade Sanctum',
      coordString: '7,6',
      isDungeon: false,
      isCave: true,
    };
  }

  if (screen.id === 'C_GAMBLE') {
    return {
      col: 8,
      row: 6,
      areaType: 'CAVE',
      areaName: 'Money Making Game',
      coordString: '8,6',
      isDungeon: false,
      isCave: true,
    };
  }

  if (screen.id === 'C_SECRET_FAIRY_SPRING') {
    return {
      col: 7,
      row: 5,
      areaType: 'CAVE',
      areaName: 'Great Fairy Spring',
      coordString: '7,5',
      isDungeon: false,
      isCave: true,
    };
  }

  const match = screen.id.match(/^O(\d+)_(\d+)$/);
  if (match) {
    const col = parseInt(match[1], 10);
    const row = parseInt(match[2], 10);
    return {
      col,
      row,
      areaType: 'OVERWORLD',
      areaName: screen.name || `Overworld Screen [${col},${row}]`,
      coordString: `${col},${row}`,
      isDungeon: false,
      isCave: false,
    };
  }

  return {
    col: 7,
    row: 7,
    areaType: 'OVERWORLD',
    areaName: screen.name || 'Hyrule Overworld',
    coordString: '7,7',
    isDungeon: false,
    isCave: false,
  };
}
