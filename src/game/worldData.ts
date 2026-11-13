/**
 * The Legend of Zelda NES - Overworld & Dungeon Map Database
 * 16 columns x 11 rows of 16x16 tiles per screen (256x176 px)
 */

import { ScreenData, EnemyType, ItemType, SecretTrigger, Direction } from '../types';

/**
 * Helper to generate an overworld screen border
 */
function createScreen(
  id: string,
  name: string,
  type: 'overworld' | 'dungeon' | 'cave',
  music: 'overworld' | 'dungeon' | 'cave',
  exits: ScreenData['exits'],
  enemies: Array<{ type: EnemyType; x: number; y: number }>,
  customTiles?: (base: number[][]) => void,
  secrets?: SecretTrigger[]
): ScreenData {
  const tiles: number[][] = [];
  const defaultWall = type === 'dungeon' ? 5 : 1;
  const defaultFloor = type === 'dungeon' ? 6 : 0;

  for (let r = 0; r < 11; r++) {
    const row: number[] = [];
    for (let c = 0; c < 16; c++) {
      // Default borders
      const isTop = r === 0;
      const isBottom = r === 10;
      const isLeft = c === 0;
      const isRight = c === 15;

      // Allow exit doorways
      if (isTop && exits.up && (c === 7 || c === 8)) {
        row.push(defaultFloor);
      } else if (isBottom && exits.down && (c === 7 || c === 8)) {
        row.push(defaultFloor);
      } else if (isLeft && exits.left && (r === 5 || r === 6)) {
        row.push(defaultFloor);
      } else if (isRight && exits.right && (r === 5 || r === 6)) {
        row.push(defaultFloor);
      } else if (isTop || isBottom || isLeft || isRight) {
        row.push(defaultWall);
      } else {
        row.push(defaultFloor);
      }
    }
    tiles.push(row);
  }

  if (customTiles) {
    customTiles(tiles);
  }

  return {
    id,
    name,
    type,
    tiles,
    exits,
    enemies,
    music,
    secrets,
  };
}

// -------------------------------------------------------------
// OVERWORLD SCREENS
// -------------------------------------------------------------

// Screen O7_7: Starting Screen
export const SCREEN_O7_7 = createScreen(
  'O7_7',
  'Starting Screen',
  'overworld',
  'overworld',
  { up: 'O7_6', left: 'O6_7', right: 'O8_7', cave: 'C_START' },
  [], // Safe spawn screen (no enemies)
  (t) => {
    // Rocky cave structure in top left
    t[1][4] = 2; t[1][5] = 2; t[1][6] = 2;
    t[2][4] = 2; t[2][5] = 4; t[2][6] = 2; // Cave door at (5, 2)
    t[3][4] = 2; t[3][5] = 0; t[3][6] = 2; // Entrance path at (5, 3) must be open floor

    // Green trees (kept clear of east exit path rows 5 and 6)
    t[1][1] = 1; t[1][2] = 1;
    t[2][1] = 1; t[2][2] = 1;
    t[7][10] = 1; t[7][11] = 1;
    t[8][10] = 1; t[8][11] = 1;

    // Water pool in bottom right
    t[8][11] = 3; t[8][12] = 3; t[8][13] = 3;
    t[9][11] = 3; t[9][12] = 3; t[9][13] = 3;
  },
  [
    {
      id: 'secret_o7_7_bush_stairs',
      type: 'burn',
      row: 7,
      col: 10,
      revealTile: 15, // Secret Stairs!
      targetScreenId: 'C_SECRET_HEART',
      targetX: 120,
      targetY: 140,
      targetDir: Direction.UP,
      hintText: 'BUSH DESTROYED TO REVEAL SECRET HEART STAIRCASE',
    },
  ]
);

// Starting Cave: Old Man with Wooden Sword
export const SCREEN_CAVE_START: ScreenData = {
  id: 'C_START',
  name: 'Old Man Cave',
  type: 'cave',
  music: 'cave',
  exits: { down: 'O7_7' },
  tiles: [
    [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 5, 5, 5, 5, 5, 5, 0, 0, 5, 5, 5, 5, 5, 5, 5],
  ],
  enemies: [],
  caveText: "IT'S DANGEROUS TO GO\nALONE! TAKE THIS.",
  caveItem: ItemType.SWORD_WOOD,
};

// Screen O7_6: North of Start (River and Octoroks / Moblins)
export const SCREEN_O7_6 = createScreen(
  'O7_6',
  'River Crossing',
  'overworld',
  'overworld',
  { down: 'O7_7', up: 'O7_5', right: 'O8_6' },
  [
    { type: EnemyType.MOBLIN_RED, x: 64, y: 80 },
    { type: EnemyType.OCTOROK_RED, x: 176, y: 80 },
    { type: EnemyType.MOBLIN_RED, x: 120, y: 110 },
  ],
  (t) => {
    // River across top
    for (let c = 0; c < 16; c++) {
      if (c !== 7 && c !== 8) {
        t[3][c] = 3;
        t[4][c] = 3;
      } else {
        t[3][c] = 11; // Wooden bridge
        t[4][c] = 11;
      }
    }
    // Trees & Ancient Carved Cliff at (1, 2)
    t[1][2] = 17; t[2][2] = 1; // Fissured cliff rock that reacts to sword!
    t[1][13] = 1; t[2][13] = 1;
    t[7][4] = 1; t[8][4] = 1;
    t[7][11] = 1; t[8][11] = 1;
  },
  [
    {
      id: 'secret_o7_6_sword',
      type: 'sword',
      row: 1,
      col: 2,
      swordHitsRequired: 1,
      revealTile: 15, // Hidden Staircase!
      targetScreenId: 'C_SECRET_WHITE_SWORD',
      targetX: 120,
      targetY: 130,
      targetDir: Direction.UP,
      hintText: 'SWORD REVEALED ANCIENT BLADE SANCTUM',
    },
  ]
);

// Screen O7_5: Forest Road (Moblins)
export const SCREEN_O7_5 = createScreen(
  'O7_5',
  'Goblin Forest',
  'overworld',
  'overworld',
  { down: 'O7_6', up: 'O7_4' },
  [
    { type: EnemyType.MOBLIN_RED, x: 60, y: 50 },
    { type: EnemyType.MOBLIN_RED, x: 180, y: 90 },
    { type: EnemyType.MOBLIN_BLUE, x: 110, y: 70 },
  ],
  (t) => {
    // Forest clumps
    t[3][3] = 1; t[3][4] = 1; t[4][3] = 1; t[4][4] = 1;
    t[3][11] = 1; t[3][12] = 1; t[4][11] = 1; t[4][12] = 1;
    t[7][6] = 1; t[7][9] = 1;
    // Ancient hollow rock formation in northeast
    t[1][13] = 17;
  },
  [
    {
      id: 'secret_o7_5_sword',
      type: 'sword',
      row: 1,
      col: 13,
      swordHitsRequired: 1,
      revealTile: 15, // Secret Stairs!
      targetScreenId: 'C_SECRET_FAIRY_SPRING',
      targetX: 120,
      targetY: 130,
      targetDir: Direction.UP,
      hintText: 'SWORD REVEALED FAIRY SPRING STAIRS',
    },
    {
      id: 'secret_o7_5_bush_shop',
      type: 'burn',
      row: 7,
      col: 6,
      revealTile: 15, // Secret Stairs!
      targetScreenId: 'C_SECRET_SHOP',
      targetX: 120,
      targetY: 140,
      targetDir: Direction.UP,
      hintText: 'BUSH DESTROYED TO REVEAL SECRET SUBTERRANEAN SHOP STAIRS',
    },
  ]
);

// Screen O7_4: Entrance to Level 1: The Eagle!
export const SCREEN_O7_4 = createScreen(
  'O7_4',
  'Level 1: The Eagle Entrance',
  'overworld',
  'overworld',
  { down: 'O7_5', dungeon: 'D1_1' },
  [
    { type: EnemyType.MOBLIN_RED, x: 80, y: 120 },
    { type: EnemyType.MOBLIN_RED, x: 160, y: 120 },
    { type: EnemyType.OCTOROK_RED, x: 120, y: 130 },
  ],
  (t) => {
    // Water moat around island
    for (let c = 1; c < 15; c++) {
      t[2][c] = 3;
      t[7][c] = 3;
    }
    for (let r = 2; r < 8; r++) {
      t[r][1] = 3;
      t[r][14] = 3;
    }

    // Bridge over water in bottom
    t[7][7] = 11;
    t[7][8] = 11;

    // Island in center with Eagle Dungeon mouth at (7, 4) & (8, 4)
    for (let r = 3; r < 7; r++) {
      for (let c = 3; c < 13; c++) {
        t[r][c] = 2; // Stone mountain
      }
    }
    // Eagle entrance
    t[4][7] = 4;
    t[4][8] = 4;
    t[5][7] = 0;
    t[5][8] = 0;
    t[6][7] = 0;
    t[6][8] = 0;
  }
);

// Screen O6_7: Rocky Foothills (Tektites & Pushable Secret Rock)
export const SCREEN_O6_7 = createScreen(
  'O6_7',
  'Rocky Foothills',
  'overworld',
  'overworld',
  { right: 'O7_7', left: 'O5_7', up: 'O6_6' },
  [
    { type: EnemyType.TEKTITE_RED, x: 80, y: 50 },
    { type: EnemyType.MOBLIN_RED, x: 160, y: 90 },
    { type: EnemyType.MOBLIN_BLUE, x: 110, y: 120 },
  ],
  (t) => {
    // Rocky plateaus
    t[3][5] = 2; t[3][6] = 2; t[4][5] = 2; t[4][6] = 2;
    t[6][10] = 2; t[6][11] = 2; t[7][10] = 2; t[7][11] = 2;
    t[2][2] = 14; // Pushable rock at (2, 2)
    t[8][2] = 2;
  },
  [
    {
      id: 'secret_o6_7_push',
      type: 'push',
      row: 2,
      col: 2,
      pushDir: Direction.UP,
      blockMoveDir: Direction.UP,
      revealTile: 15, // Secret Stairs!
      targetScreenId: 'C_SECRET_HEART',
      targetX: 120,
      targetY: 140,
      targetDir: Direction.UP,
      hintText: 'PUSH REVEALED SECRET STAIRS',
    },
    {
      id: 'secret_o6_7_bomb_shop',
      type: 'bomb',
      row: 3,
      col: 5,
      revealTile: 15, // Secret Stairs!
      targetScreenId: 'C_SECRET_SHOP',
      targetX: 120,
      targetY: 140,
      targetDir: Direction.UP,
      hintText: 'BOMB REVEALED SECRET SUBTERRANEAN SHOP STAIRS',
    },
  ]
);

// Screen O8_7: East Coastal Glade (Blue Octoroks & hidden bombable rock)
export const SCREEN_O8_7 = createScreen(
  'O8_7',
  'Eastern Coast',
  'overworld',
  'overworld',
  { left: 'O7_7', up: 'O8_6' },
  [
    { type: EnemyType.MOBLIN_RED, x: 80, y: 60 },
    { type: EnemyType.OCTOROK_BLUE, x: 140, y: 90 },
    { type: EnemyType.MOBLIN_RED, x: 180, y: 60 },
  ],
  (t) => {
    // Ocean on right side
    for (let r = 1; r < 10; r++) {
      t[r][13] = 3;
      t[r][14] = 3;
    }
    t[3][6] = 2;
    t[3][7] = 13; // Bombable Rock at (3, 7)!
    t[7][5] = 1; t[7][6] = 1;
  },
  [
    {
      id: 'secret_o8_7_bomb',
      type: 'bomb',
      row: 3,
      col: 7,
      revealTile: 4, // Dark cave entrance
      targetScreenId: 'C_SECRET_RUPEE',
      targetX: 120,
      targetY: 140,
      targetDir: Direction.UP,
      hintText: 'BOMB BLASTED CAVE ENTRANCE',
    },
    {
      id: 'secret_o8_7_bush_heart',
      type: 'burn',
      row: 7,
      col: 5,
      revealTile: 15, // Secret Stairs!
      targetScreenId: 'C_SECRET_HEART',
      targetX: 120,
      targetY: 140,
      targetDir: Direction.UP,
      hintText: 'BUSH DESTROYED TO REVEAL SECRET HEART STAIRS',
    },
  ]
);

// -------------------------------------------------------------
// DUNGEON 1: THE EAGLE
// -------------------------------------------------------------

// Room D1_1: Dungeon Entrance Room
export const SCREEN_D1_1 = createScreen(
  'D1_1',
  'Level-1: Eagle Entrance',
  'dungeon',
  'dungeon',
  { down: 'O7_4', up: 'D1_4', left: 'D1_2', right: 'D1_3' },
  [
    { type: EnemyType.KEESE, x: 70, y: 60 },
    { type: EnemyType.KEESE, x: 170, y: 60 },
  ],
  (t) => {
    // Decorative dungeon blocks
    t[3][4] = 5; t[3][11] = 5;
    t[7][4] = 5; t[7][11] = 5;
  }
);

// Room D1_2: West Room (Stalfos with Pushable Block revealing Secret Underground Passage)
export const SCREEN_D1_2 = createScreen(
  'D1_2',
  'Level-1: West Crypt',
  'dungeon',
  'dungeon',
  { right: 'D1_1' },
  [
    { type: EnemyType.STALFOS, x: 64, y: 64 },
    { type: EnemyType.STALFOS, x: 160, y: 64 },
  ],
  (t) => {
    t[5][7] = 14; // Pushable Block!
    t[5][8] = 5;
    // Hidden shortcut wall on north border leading directly to Secret Armory
    t[0][7] = 13;
    t[0][8] = 13;
  },
  [
    {
      id: 'secret_d1_2_push',
      type: 'push',
      row: 5,
      col: 7,
      pushDir: Direction.LEFT,
      blockMoveDir: Direction.LEFT,
      allowBomb: false, // Must clear Stalfos and push the crypt block
      requireClearedEnemies: true, // Classic Zelda rule: defeat all Stalfos first!
      revealTile: 15, // Secret Stairs!
      targetScreenId: 'D1_SECRET_VAULT',
      targetX: 120,
      targetY: 120,
      targetDir: Direction.UP,
      hintText: 'PUSH REVEALED UNDERGROUND STAIRS',
    },
    {
      id: 'secret_d1_2_north_shortcut',
      type: 'bomb',
      row: 0,
      col: 7,
      pairedTiles: [{ row: 0, col: 8 }],
      exitDir: 'up',
      allowPush: true,
      allowBomb: true,
      isShortcut: true,
      linkedSecretId: 'secret_d1_armory_south_shortcut',
      revealTile: 16,
      targetScreenId: 'D1_SECRET_ARMORY',
      targetX: 120,
      targetY: 144,
      targetDir: Direction.UP,
      hintText: 'SHORTCUT OPENED TO SECRET ARMORY',
    },
  ]
);

// Room D1_3: East Room (Compass Chamber)
export const SCREEN_D1_3 = createScreen(
  'D1_3',
  'Level-1: Compass Chamber',
  'dungeon',
  'dungeon',
  { left: 'D1_1' },
  [
    { type: EnemyType.GEL, x: 112, y: 48 },
    { type: EnemyType.GEL, x: 144, y: 56 },
    { type: EnemyType.GEL, x: 176, y: 48 },
    { type: EnemyType.GEL, x: 132, y: 112 },
    { type: EnemyType.GEL, x: 168, y: 120 },
    { type: EnemyType.GEL, x: 196, y: 88 },
  ],
  (t) => {
    t[4][7] = 5; t[4][8] = 5;
    t[6][7] = 5; t[6][8] = 5;
    // Ancient hollow wall stone on north wall at (0, 7)
    t[0][7] = 17;
  },
  [
    {
      id: 'secret_d1_3_sword',
      type: 'sword',
      row: 0,
      col: 7,
      swordHitsRequired: 1,
      revealTile: 15, // Secret Stairs!
      targetScreenId: 'D1_SECRET_CHAMBER',
      targetX: 120,
      targetY: 120,
      targetDir: Direction.UP,
      hintText: 'SWORD REVEALED SUBTERRANEAN ARMORY',
    },
  ]
);

// Room D1_4: North Hallway (Goriyas with Bombable West Wall)
export const SCREEN_D1_4 = createScreen(
  'D1_4',
  'Level-1: Goriya Lair',
  'dungeon',
  'dungeon',
  { down: 'D1_1', up: 'D1_5' },
  [
    { type: EnemyType.GORIYA_RED, x: 60, y: 60 },
    { type: EnemyType.GORIYA_RED, x: 170, y: 60 },
    { type: EnemyType.KEESE, x: 115, y: 100 },
  ],
  (t) => {
    t[3][5] = 5; t[3][10] = 5;
    t[7][5] = 5; t[7][10] = 5;
    // Bombable west wall breach
    t[5][0] = 13;
    t[6][0] = 13;
  },
  [
    {
      id: 'secret_d1_4_bomb_west',
      type: 'bomb',
      row: 5,
      col: 0,
      pairedTiles: [{ row: 6, col: 0 }],
      exitDir: 'left',
      allowPush: true,
      allowBomb: true,
      revealTile: 16, // Blown-open doorway passage!
      targetScreenId: 'D1_SECRET_ARMORY',
      targetX: 216,
      targetY: 88,
      targetDir: Direction.LEFT,
      hintText: 'BOMB BLASTED PASSAGE THROUGH WALL',
    },
  ]
);

// Room D1_5: Boss Chamber (Aquamentus Dragon guarding the door to the Triforce!)
export const SCREEN_D1_5 = createScreen(
  'D1_5',
  'Level-1: Boss Aquamentus',
  'dungeon',
  'dungeon',
  { down: 'D1_4', right: 'D1_6' },
  [
    { type: EnemyType.AQUAMENTUS, x: 175, y: 65 }, // Boss Dragon!
  ],
  (t) => {
    t[2][3] = 5; t[2][12] = 5;
    t[8][3] = 5; t[8][12] = 5;
  }
);

// Room D1_6: Triforce Chamber (Golden Triforce piece!)
export const SCREEN_D1_6 = createScreen(
  'D1_6',
  'Level-1: Triforce Room',
  'dungeon',
  'dungeon',
  { left: 'D1_5' },
  [], // No enemies!
  (t) => {
    // Pedestal in center
    t[5][7] = 6;
    t[5][8] = 6;
  }
);

// -------------------------------------------------------------
// SECRET DISCOVERY ROOMS & CAVES
// -------------------------------------------------------------

// Secret Room 1: Secret Coastal Cave (Revealed by bombing O8_7 rock)
export const SCREEN_CAVE_SECRET_RUPEE: ScreenData = {
  id: 'C_SECRET_RUPEE',
  name: 'Secret Coastal Cavern',
  type: 'cave',
  music: 'cave',
  exits: { down: 'O8_7' },
  tiles: [
    [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 5, 5, 5, 5, 5, 5, 0, 0, 5, 5, 5, 5, 5, 5, 5],
  ],
  enemies: [],
  caveText: "IT'S A SECRET\nTO EVERYBODY.",
  caveItem: ItemType.RUPEE_FIVE,
};

// Secret Room 2: Secret Heart Cavern (Revealed by pushing O6_7 rock)
export const SCREEN_CAVE_SECRET_HEART: ScreenData = {
  id: 'C_SECRET_HEART',
  name: 'Secret Heart Cavern',
  type: 'cave',
  music: 'cave',
  exits: { down: 'O6_7' },
  tiles: [
    [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 5, 5, 5, 5, 5, 5, 0, 0, 5, 5, 5, 5, 5, 5, 5],
  ],
  enemies: [],
  caveText: 'TAKE ANY ONE YOU\nWANT.',
  caveItem: ItemType.HEART_CONTAINER,
};

// Secret Subterranean Shop (Revealed by destroying secret bush on O7_5 or bombing wall on O6_7)
export const SCREEN_CAVE_SECRET_SHOP: ScreenData = {
  id: 'C_SECRET_SHOP',
  name: 'Secret Subterranean Shop',
  type: 'cave',
  music: 'cave',
  exits: { down: 'O7_5' },
  tiles: [
    [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 5, 5, 5, 5, 5, 5, 0, 0, 5, 5, 5, 5, 5, 5, 5],
  ],
  enemies: [],
  caveText: "SECRET SHOP!\nBUY SOMETHIN' WILL YA!",
  shopItems: [
    { id: 'shop_sec_shield', type: ItemType.MAGICAL_SHIELD, price: 90, x: 44, y: 76 },
    { id: 'shop_sec_candle', type: ItemType.CANDLE_BLUE, price: 60, x: 92, y: 76 },
    { id: 'shop_sec_potion', type: ItemType.POTION_BLUE, price: 40, x: 140, y: 76 },
    { id: 'shop_sec_heart', type: ItemType.HEART_CONTAINER, price: 120, x: 188, y: 76 },
  ],
};

// Secret Room 3: Secret Vault (Revealed by pushing D1_2 crypt block)
export const SCREEN_D1_SECRET_VAULT: ScreenData = {
  id: 'D1_SECRET_VAULT',
  name: 'Level-1: Secret Vault',
  type: 'dungeon',
  music: 'dungeon',
  exits: {},
  tiles: [
    [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 6, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5, 6, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 6, 5, 6, 6, 6, 6, 15, 6, 6, 6, 6, 6, 5, 6, 5], // Stairs up at (8, 7)
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  ],
  enemies: [],
  caveItem: ItemType.BOMB,
};

// Secret Room 4: Secret Armory (Revealed by bombing D1_4 west wall)
export const SCREEN_D1_SECRET_ARMORY = createScreen(
  'D1_SECRET_ARMORY',
  'Level-1: Secret Armory',
  'dungeon',
  'dungeon',
  { right: 'D1_4' },
  [
    { type: EnemyType.DARKNUT_RED, x: 70, y: 70 },
    { type: EnemyType.DARKNUT_BLUE, x: 150, y: 70 },
  ],
  (t) => {
    t[3][7] = 5; t[3][8] = 5;
    t[7][7] = 5; t[7][8] = 5;
    t[5][15] = 6; t[6][15] = 6; // Open exit back to D1_4
    // South secret shortcut wall to West Crypt (D1_2)
    t[10][7] = 13;
    t[10][8] = 13;
  },
  [
    {
      id: 'secret_d1_armory_south_shortcut',
      type: 'bomb',
      row: 10,
      col: 7,
      pairedTiles: [{ row: 10, col: 8 }],
      exitDir: 'down',
      allowPush: true,
      allowBomb: true,
      isShortcut: true,
      linkedSecretId: 'secret_d1_2_north_shortcut',
      revealTile: 16,
      targetScreenId: 'D1_2',
      targetX: 120,
      targetY: 16,
      targetDir: Direction.DOWN,
      hintText: 'SHORTCUT OPENED TO WEST CRYPT',
    },
  ]
);

// Secret Room 5: Ancient Blade Sanctum (White Sword upgrade cave revealed by sword on O7_6 cliff wall!)
export const SCREEN_CAVE_SECRET_WHITE_SWORD: ScreenData = {
  id: 'C_SECRET_WHITE_SWORD',
  name: 'Ancient Blade Sanctum',
  type: 'cave',
  music: 'cave',
  exits: { down: 'O7_6' },
  tiles: [
    [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 5, 5, 5, 5, 5, 5, 0, 0, 5, 5, 5, 5, 5, 5, 5],
  ],
  enemies: [],
  caveText: "MASTER USING IT AND\nYOU CAN HAVE THIS.",
  caveItem: ItemType.SWORD_WHITE,
};

// Secret Room 6: Great Fairy Spring (Revealed by sword on O7_5 forest cliff!)
export const SCREEN_CAVE_SECRET_FAIRY_SPRING: ScreenData = {
  id: 'C_SECRET_FAIRY_SPRING',
  name: 'Great Fairy Spring',
  type: 'cave',
  music: 'cave',
  exits: { down: 'O7_5' },
  tiles: [
    [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 3, 3, 0, 0, 0, 0, 0, 0, 3, 3, 0, 0, 5],
    [5, 0, 3, 3, 3, 3, 0, 0, 0, 0, 3, 3, 3, 3, 0, 5],
    [5, 0, 0, 3, 3, 0, 0, 0, 0, 0, 0, 3, 3, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 5, 5, 5, 5, 5, 5, 0, 0, 5, 5, 5, 5, 5, 5, 5],
  ],
  enemies: [],
  caveText: "RESTORE YOUR SPIRIT\nAND RECEIVE POWER.",
  caveItem: ItemType.HEART_CONTAINER,
};

// Secret Room 7: Subterranean Dungeon Armory (Revealed by sword on D1_3 compass room north wall!)
export const SCREEN_D1_SECRET_CHAMBER: ScreenData = {
  id: 'D1_SECRET_CHAMBER',
  name: 'Eagle: Subterranean Armory',
  type: 'dungeon',
  music: 'dungeon',
  exits: { down: 'D1_3' },
  tiles: [
    [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 6, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5, 6, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 6, 5, 6, 6, 6, 6, 15, 6, 6, 6, 6, 6, 5, 6, 5], // Exit stairs returning to D1_3
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  ],
  enemies: [],
  caveText: "DODONGO DISLIKES\nSMOKE.",
  caveItem: ItemType.RUPEE_FIVE,
};

// -------------------------------------------------------------
// OVERWORLD EXPANSIONS & SHOPS
// -------------------------------------------------------------

// Screen O5_7: Western Desert (Leevers & Merchant Shop Entrance)
export const SCREEN_O5_7 = createScreen(
  'O5_7',
  'Western Desert',
  'overworld',
  'overworld',
  { right: 'O6_7', up: 'O5_6', cave: 'C_SHOP' },
  [
    { type: EnemyType.LEEVER_RED, x: 70, y: 50 },
    { type: EnemyType.LEEVER_RED, x: 150, y: 80 },
    { type: EnemyType.LEEVER_RED, x: 110, y: 120 },
  ],
  (t) => {
    // Sand path across screen
    for (let c = 0; c < 16; c++) {
      t[4][c] = 11; t[5][c] = 11; t[6][c] = 11;
    }
    // Rocky cave structure
    t[2][7] = 2; t[2][8] = 2;
    t[3][7] = 4; t[3][8] = 2; // Cave entrance at (3, 7)
    t[4][7] = 0;
  }
);

// Screen O5_6: Haunted Graveyard (North of Western Desert - Ghini ghosts & gravestones)
export const SCREEN_O5_6 = createScreen(
  'O5_6',
  'Haunted Graveyard',
  'overworld',
  'overworld',
  { down: 'O5_7', left: 'O4_6' },
  [
    { type: EnemyType.GHINI, x: 64, y: 32 },
    { type: EnemyType.GHINI, x: 176, y: 64 },
    { type: EnemyType.GHINI, x: 64, y: 112 },
  ],
  (t) => {
    // Cemetery sand footpaths
    for (let c = 0; c < 16; c++) {
      if (t[5][c] === 0) t[5][c] = 11;
      if (t[6][c] === 0) t[6][c] = 11;
    }
    for (let r = 1; r < 11; r++) {
      if (t[r][7] === 0) t[r][7] = 11;
      if (t[r][8] === 0) t[r][8] = 11;
    }

    // Gravestone rows (tile 18)
    const graveCols = [3, 5, 10, 12];
    const graveRows = [2, 4, 7];
    for (const r of graveRows) {
      for (const c of graveCols) {
        t[r][c] = 18;
      }
    }
  }
);

// Screen O4_6: Ancient Cemetery (West of Haunted Graveyard - deeper Ghini crypts)
export const SCREEN_O4_6 = createScreen(
  'O4_6',
  'Ancient Cemetery',
  'overworld',
  'overworld',
  { right: 'O5_6' },
  [
    { type: EnemyType.GHINI, x: 80, y: 32 },
    { type: EnemyType.GHINI, x: 160, y: 32 },
    { type: EnemyType.GHINI, x: 80, y: 112 },
    { type: EnemyType.GHINI, x: 160, y: 112 },
  ],
  (t) => {
    // Cemetery sand paths
    for (let c = 1; c < 16; c++) {
      t[5][c] = 11;
      t[6][c] = 11;
    }
    for (let r = 1; r < 10; r++) {
      t[r][7] = 11;
      t[r][8] = 11;
    }

    // Gravestone rows (tile 18)
    const graveCols = [3, 6, 9, 12];
    const graveRows = [2, 4, 7];
    for (const r of graveRows) {
      for (const c of graveCols) {
        t[r][c] = 18;
      }
    }
  }
);

// Cave C_SHOP: Item Merchant Shop
export const SCREEN_CAVE_SHOP: ScreenData = {
  id: 'C_SHOP',
  name: 'Item Merchant Shop',
  type: 'cave',
  music: 'cave',
  exits: { down: 'O5_7' },
  tiles: [
    [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 5, 5, 5, 5, 5, 5, 0, 0, 5, 5, 5, 5, 5, 5, 5],
  ],
  enemies: [],
  caveText: "BUY SOMETHIN' WILL YA!",
  shopItems: [
    { id: 'shop_shield', type: ItemType.MAGICAL_SHIELD, price: 90, x: 48, y: 76 },
    { id: 'shop_blue_ring', type: ItemType.BLUE_RING, price: 150, x: 96, y: 76 },
    { id: 'shop_bomb', type: ItemType.BOMB, price: 20, x: 144, y: 76 },
    { id: 'shop_potion', type: ItemType.POTION_BLUE, price: 40, x: 192, y: 76 },
  ],
};

// Screen O8_6: Coastal Headland (Peahats & Gambling Secret)
export const SCREEN_O8_6 = createScreen(
  'O8_6',
  'Coastal Headland',
  'overworld',
  'overworld',
  { down: 'O8_7', left: 'O7_6', up: 'O8_5' },
  [
    { type: EnemyType.PEAHAT, x: 70, y: 60 },
    { type: EnemyType.MOBLIN_RED, x: 150, y: 80 },
    { type: EnemyType.MOBLIN_BLUE, x: 100, y: 110 },
  ],
  (t) => {
    // Ocean on right
    for (let r = 0; r < 11; r++) {
      t[r][13] = 3; t[r][14] = 3; t[r][15] = 3;
    }
    // Forest glade on left with burnable bush
    t[3][4] = 1; t[3][5] = 1;
    t[4][4] = 1; t[4][5] = 12; // Burnable bush at (4, 5)!
  },
  [
    {
      id: 'secret_o8_6_burn',
      type: 'bomb', // Also push/bombable or burnable
      row: 4,
      col: 5,
      revealTile: 15, // Secret stairs
      targetScreenId: 'C_GAMBLE',
      targetX: 120,
      targetY: 140,
      targetDir: Direction.UP,
      hintText: 'SECRET GAMBLING DEN UNCOVERED',
    },
  ]
);

// Cave C_GAMBLE: Money Making Game Cave
export const SCREEN_CAVE_GAMBLE: ScreenData = {
  id: 'C_GAMBLE',
  name: 'Money Making Game',
  type: 'cave',
  music: 'cave',
  exits: { down: 'O8_6' },
  tiles: [
    [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [5, 5, 5, 5, 5, 5, 5, 0, 0, 5, 5, 5, 5, 5, 5, 5],
  ],
  enemies: [],
  caveText: "LET'S PLAY MONEY\nMAKING GAME.",
  gamblePots: [
    { id: 'pot_1', amount: 20, revealed: false, x: 72, y: 76 },
    { id: 'pot_2', amount: -10, revealed: false, x: 120, y: 76 },
    { id: 'pot_3', amount: 50, revealed: false, x: 168, y: 76 },
  ],
};

// Screen O6_6: Whispering Lake (Water channel & Level-2 entrance)
export const SCREEN_O6_6 = createScreen(
  'O6_6',
  'Whispering Lake',
  'overworld',
  'overworld',
  { down: 'O6_7', dungeon: 'D2_1', up: 'D2_1' },
  [
    { type: EnemyType.OCTOROK_BLUE, x: 60, y: 80 },
    { type: EnemyType.OCTOROK_BLUE, x: 180, y: 80 },
  ],
  (t) => {
    // Water moat across rows 3 and 4 with 1-tile stepping gap at (3, 7) / (4, 7)
    for (let c = 0; c < 16; c++) {
      t[3][c] = 3;
      t[4][c] = 3;
    }
    // Stepping bridge path at col 7
    t[3][7] = 3; // Crossable with Stepping Ladder!
    t[4][7] = 0;
    // Level-2 Dungeon entrance at top (row 1, col 7)
    t[0][7] = 4; t[0][8] = 4;
    t[1][7] = 0; t[1][8] = 0;
  }
);

// -------------------------------------------------------------
// DUNGEON 2: THE MOON
// -------------------------------------------------------------

// D2_1: Entrance Hallway of Level-2
export const SCREEN_D2_1 = createScreen(
  'D2_1',
  'Level-2: Entrance Hall',
  'dungeon',
  'dungeon',
  { down: 'O6_6', up: 'D2_2', right: 'D2_BOSS' },
  [
    { type: EnemyType.DARKNUT_RED, x: 70, y: 50 },
    { type: EnemyType.KEESE, x: 160, y: 70 },
  ],
  (t) => {
    // Dungeon floor with statues
    t[3][3] = 5; t[3][12] = 5;
    t[7][3] = 5; t[7][12] = 5;
  }
);

// D2_2: Level-2 Armory Room (Magical Boomerang & Recorder)
export const SCREEN_D2_2 = createScreen(
  'D2_2',
  'Level-2: Armory Vault',
  'dungeon',
  'dungeon',
  { down: 'D2_1' },
  [
    { type: EnemyType.GORIYA_RED, x: 80, y: 60 },
    { type: EnemyType.GORIYA_RED, x: 150, y: 60 },
    { type: EnemyType.LIKE_LIKE, x: 112, y: 88 },
  ],
  (t) => {
    t[3][5] = 5; t[3][10] = 5;
    t[7][5] = 5; t[7][10] = 5;
    // Secret west wall leading to Hidden Moon Shrine
    t[5][0] = 13;
    t[6][0] = 13;
  },
  [
    {
      id: 'secret_d2_2_west_shrine',
      type: 'bomb',
      row: 5,
      col: 0,
      pairedTiles: [{ row: 6, col: 0 }],
      exitDir: 'left',
      allowPush: true,
      allowBomb: true,
      revealTile: 16,
      targetScreenId: 'D2_SECRET_SHRINE',
      targetX: 216,
      targetY: 88,
      targetDir: Direction.LEFT,
      hintText: 'REVEALED HIDDEN MOON SHRINE',
    },
  ]
);

// D2_SECRET_SHRINE: Hidden room west of D2_2
export const SCREEN_D2_SECRET_SHRINE = createScreen(
  'D2_SECRET_SHRINE',
  'Level-2: Hidden Moon Shrine',
  'dungeon',
  'dungeon',
  { right: 'D2_2' },
  [
    { type: EnemyType.WIZZROBE_RED, x: 96, y: 56 },
  ],
  (t) => {
    t[3][5] = 5; t[3][10] = 5;
    t[7][5] = 5; t[7][10] = 5;
    t[5][15] = 6; t[6][15] = 6;
  }
);

// D2_BOSS: Boss Chamber with DODONGO
export const SCREEN_D2_BOSS = createScreen(
  'D2_BOSS',
  'Level-2: Dodongo Lair',
  'dungeon',
  'dungeon',
  { left: 'D2_1', up: 'D2_TRIFORCE' },
  [
    { type: EnemyType.DODONGO, x: 110, y: 70 },
  ],
  (t) => {
    // Open boss arena
    t[3][4] = 5; t[3][11] = 5;
    t[7][4] = 5; t[7][11] = 5;
  }
);

// D2_TRIFORCE: Level-2 Triforce Altar
export const SCREEN_D2_TRIFORCE: ScreenData = {
  id: 'D2_TRIFORCE',
  name: 'Level-2: Triforce Altar',
  type: 'dungeon',
  music: 'dungeon',
  exits: { down: 'D2_BOSS' },
  tiles: [
    [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 5, 5, 5, 5, 5, 5, 6, 6, 5, 5, 5, 5, 5, 5, 5],
  ],
  enemies: [],
};

// -------------------------------------------------------------
// OVERWORLD: SCREEN O8_5 - THE MANJI ENTRANCE
// -------------------------------------------------------------
export const SCREEN_O8_5 = createScreen(
  'O8_5',
  'Level 3: The Manji Glade',
  'overworld',
  'overworld',
  { down: 'O8_6', dungeon: 'D3_1', up: 'D3_1' },
  [
    { type: EnemyType.ROPE, x: 70, y: 80 },
    { type: EnemyType.MOBLIN_RED, x: 170, y: 90 },
    { type: EnemyType.MOBLIN_BLUE, x: 120, y: 110 },
  ],
  (t) => {
    // Ancient stone pillars & forest borders
    for (let c = 0; c < 16; c++) {
      if (c !== 7 && c !== 8) {
        t[0][c] = 1;
        t[1][c] = 1;
      }
    }
    t[0][7] = 4; t[0][8] = 4; // Level-3 Dungeon Mouth
    t[1][7] = 0; t[1][8] = 0;
    t[3][3] = 2; t[3][12] = 2;
    t[6][3] = 2; t[6][12] = 2;
    t[7][4] = 1; t[7][11] = 1;
  }
);

// -------------------------------------------------------------
// DUNGEON 3: THE MANJI
// -------------------------------------------------------------

// D3_1: Level 3 Entrance Hallway
export const SCREEN_D3_1 = createScreen(
  'D3_1',
  'Level-3: The Manji Entrance',
  'dungeon',
  'dungeon',
  { down: 'O8_5', up: 'D3_2' },
  [
    { type: EnemyType.ROPE, x: 70, y: 60 },
    { type: EnemyType.ROPE, x: 170, y: 70 },
    { type: EnemyType.STALFOS, x: 112, y: 96 },
  ],
  (t) => {
    t[10][7] = 6; t[10][8] = 6;
    t[0][7] = 6; t[0][8] = 6;
    // Hidden east wall leading to secret shortcut passage
    t[5][15] = 13;
    t[6][15] = 13;
  },
  [
    {
      id: 'secret_d3_1_east_shortcut',
      type: 'push',
      row: 5,
      col: 15,
      pairedTiles: [{ row: 6, col: 15 }],
      exitDir: 'right',
      allowPush: true,
      allowBomb: true,
      isShortcut: true,
      revealTile: 16,
      targetScreenId: 'D3_SECRET_PASSAGE',
      targetX: 16,
      targetY: 88,
      targetDir: Direction.RIGHT,
      hintText: 'SECRET PASSAGE OPENED EAST',
    },
  ]
);

// D3_SECRET_PASSAGE: Shortcut room connecting D3_1 directly to D3_VAULT south wall
export const SCREEN_D3_SECRET_PASSAGE = createScreen(
  'D3_SECRET_PASSAGE',
  'Level-3: Secret Vault Passage',
  'dungeon',
  'dungeon',
  { left: 'D3_1' },
  [
    { type: EnemyType.GEL, x: 112, y: 72 },
    { type: EnemyType.GEL, x: 140, y: 88 },
  ],
  (t) => {
    t[5][0] = 6; t[6][0] = 6; // Return exit to D3_1
    // Secret north wall opening shortcut straight into D3_VAULT
    t[0][7] = 13;
    t[0][8] = 13;
  },
  [
    {
      id: 'secret_d3_passage_north_shortcut',
      type: 'bomb',
      row: 0,
      col: 7,
      pairedTiles: [{ row: 0, col: 8 }],
      exitDir: 'up',
      allowPush: true,
      allowBomb: true,
      isShortcut: true,
      linkedSecretId: 'secret_d3_vault_south_shortcut',
      revealTile: 16,
      targetScreenId: 'D3_VAULT',
      targetX: 120,
      targetY: 144,
      targetDir: Direction.UP,
      hintText: 'SHORTCUT OPENED TO RED RING VAULT',
    },
  ]
);

// D3_2: Level 3 Cross Spire (Zols & Corner Blade Traps)
export const SCREEN_D3_2 = createScreen(
  'D3_2',
  'Level-3: Cross Spire',
  'dungeon',
  'dungeon',
  { down: 'D3_1', right: 'D3_VAULT', up: 'D3_BOSS' },
  [
    { type: EnemyType.ZOL, x: 80, y: 70 },
    { type: EnemyType.ZOL, x: 160, y: 90 },
    { type: EnemyType.BLADE_TRAP, x: 32, y: 32 },
    { type: EnemyType.BLADE_TRAP, x: 208, y: 32 },
  ],
  (t) => {
    t[10][7] = 6; t[10][8] = 6; // South door
    t[0][7] = 6; t[0][8] = 6;  // North door
    t[5][15] = 6;              // East door to Vault
    t[3][5] = 5; t[3][10] = 5;
    t[7][5] = 5; t[7][10] = 5;
  }
);

// D3_VAULT: Like-Like Sanctum (Red Ring Relic!)
export const SCREEN_D3_VAULT: ScreenData = {
  id: 'D3_VAULT',
  name: 'Level-3: The Red Ring Vault',
  type: 'dungeon',
  music: 'dungeon',
  exits: { left: 'D3_2' },
  tiles: [
    [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 5, 5, 5, 5, 5, 5, 13, 13, 5, 5, 5, 5, 5, 5, 5],
  ],
  enemies: [
    { type: EnemyType.LIKE_LIKE, x: 60, y: 70 },
    { type: EnemyType.LIKE_LIKE, x: 180, y: 70 },
    { type: EnemyType.WIZZROBE_RED, x: 120, y: 40 },
  ],
  secrets: [
    {
      id: 'secret_d3_vault_south_shortcut',
      type: 'bomb',
      row: 10,
      col: 7,
      pairedTiles: [{ row: 10, col: 8 }],
      exitDir: 'down',
      allowPush: true,
      allowBomb: true,
      isShortcut: true,
      linkedSecretId: 'secret_d3_passage_north_shortcut',
      revealTile: 16,
      targetScreenId: 'D3_SECRET_PASSAGE',
      targetX: 120,
      targetY: 16,
      targetDir: Direction.DOWN,
      hintText: 'SHORTCUT OPENED TO LEVEL-3 PASSAGE',
    },
  ],
  caveItem: ItemType.RED_RING,
};

// D3_BOSS: Manhandla Boss Arena
export const SCREEN_D3_BOSS = createScreen(
  'D3_BOSS',
  'Level-3: Manhandla Lair',
  'dungeon',
  'dungeon',
  { down: 'D3_2', up: 'D3_TRIFORCE' },
  [
    { type: EnemyType.MANHANDLA, x: 120, y: 64 },
  ],
  (t) => {
    t[10][7] = 6; t[10][8] = 6; // South entrance
    // North door is locked until Manhandla is slain
    t[0][7] = 5; t[0][8] = 5;
    t[3][4] = 5; t[3][11] = 5;
    t[7][4] = 5; t[7][11] = 5;
  }
);

// D3_TRIFORCE: Level-3 Triforce Altar
export const SCREEN_D3_TRIFORCE: ScreenData = {
  id: 'D3_TRIFORCE',
  name: 'Level-3: Triforce Altar',
  type: 'dungeon',
  music: 'dungeon',
  exits: { down: 'D3_BOSS' },
  tiles: [
    [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5],
    [5, 5, 5, 5, 5, 5, 5, 6, 6, 5, 5, 5, 5, 5, 5, 5],
  ],
  enemies: [],
};

// Master dictionary of all screens
export const ALL_SCREENS: Record<string, ScreenData> = {
  O7_7: SCREEN_O7_7,
  C_START: SCREEN_CAVE_START,
  O7_6: SCREEN_O7_6,
  O7_5: SCREEN_O7_5,
  O7_4: SCREEN_O7_4,
  O6_7: SCREEN_O6_7,
  O8_7: SCREEN_O8_7,
  O5_7: SCREEN_O5_7,
  O5_6: SCREEN_O5_6,
  O4_6: SCREEN_O4_6,
  C_SHOP: SCREEN_CAVE_SHOP,
  O8_6: SCREEN_O8_6,
  O8_5: SCREEN_O8_5,
  C_GAMBLE: SCREEN_CAVE_GAMBLE,
  O6_6: SCREEN_O6_6,
  D1_1: SCREEN_D1_1,
  D1_2: SCREEN_D1_2,
  D1_3: SCREEN_D1_3,
  D1_4: SCREEN_D1_4,
  D1_5: SCREEN_D1_5,
  D1_6: SCREEN_D1_6,
  D2_1: SCREEN_D2_1,
  D2_2: SCREEN_D2_2,
  D2_SECRET_SHRINE: SCREEN_D2_SECRET_SHRINE,
  D2_BOSS: SCREEN_D2_BOSS,
  D2_TRIFORCE: SCREEN_D2_TRIFORCE,
  D3_1: SCREEN_D3_1,
  D3_SECRET_PASSAGE: SCREEN_D3_SECRET_PASSAGE,
  D3_2: SCREEN_D3_2,
  D3_VAULT: SCREEN_D3_VAULT,
  D3_BOSS: SCREEN_D3_BOSS,
  D3_TRIFORCE: SCREEN_D3_TRIFORCE,
  C_SECRET_RUPEE: SCREEN_CAVE_SECRET_RUPEE,
  C_SECRET_HEART: SCREEN_CAVE_SECRET_HEART,
  C_SECRET_SHOP: SCREEN_CAVE_SECRET_SHOP,
  D1_SECRET_VAULT: SCREEN_D1_SECRET_VAULT,
  D1_SECRET_ARMORY: SCREEN_D1_SECRET_ARMORY,
  C_SECRET_WHITE_SWORD: SCREEN_CAVE_SECRET_WHITE_SWORD,
  C_SECRET_FAIRY_SPRING: SCREEN_CAVE_SECRET_FAIRY_SPRING,
  D1_SECRET_CHAMBER: SCREEN_D1_SECRET_CHAMBER,
};
