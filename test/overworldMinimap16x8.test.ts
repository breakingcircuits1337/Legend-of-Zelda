import assert from 'node:assert/strict';
import {
  OVERWORLD_COLS,
  OVERWORLD_ROWS,
  OVERWORLD_GRID,
  isCellVisited,
  getPlayerOverworldLocation,
} from '../src/game/overworldMapData';
import { ALL_SCREENS } from '../src/game/worldData';

// 1. Verify exact 16x8 grid dimensions (128 screens total)
assert.equal(OVERWORLD_COLS, 16, 'Overworld grid should have 16 columns');
assert.equal(OVERWORLD_ROWS, 8, 'Overworld grid should have 8 rows');
assert.equal(OVERWORLD_GRID.length, 128, 'Overworld grid should contain exactly 128 cells (16x8)');

const seenCoords = new Set<string>();
for (const cell of OVERWORLD_GRID) {
  assert.ok(cell.col >= 0 && cell.col < 16, `col out of range: ${cell.col}`);
  assert.ok(cell.row >= 0 && cell.row < 8, `row out of range: ${cell.row}`);
  const key = `${cell.col},${cell.row}`;
  assert.ok(!seenCoords.has(key), `Duplicate grid coordinate found: ${key}`);
  seenCoords.add(key);
}
assert.equal(seenCoords.size, 128, 'All 128 unique (col,row) pairs must be present');

// 2. Verify every overworld screen in ALL_SCREENS maps into the 16x8 grid
for (const [id, screen] of Object.entries(ALL_SCREENS)) {
  if (id.startsWith('O')) {
    const loc = getPlayerOverworldLocation(screen);
    assert.ok(loc.col >= 0 && loc.col < 16, `${id} col ${loc.col} out of 16x8 bounds`);
    assert.ok(loc.row >= 0 && loc.row < 8, `${id} row ${loc.row} out of 16x8 bounds`);
    const matchingCell = OVERWORLD_GRID.find((c) => c.col === loc.col && c.row === loc.row);
    assert.ok(matchingCell, `Missing 16x8 cell for overworld screen ${id}`);
    assert.equal(matchingCell?.id, id, `Expected 16x8 cell [${loc.col},${loc.row}] to reference ${id}`);
    assert.equal(matchingCell?.isPlayable, true, `Expected ${id} to be marked playable`);
  }
}

// 3. Verify visited-screen & current-location highlighting
const cell7_7 = OVERWORLD_GRID.find((c) => c.col === 7 && c.row === 7)!;
const cell7_6 = OVERWORLD_GRID.find((c) => c.col === 7 && c.row === 6)!;
const cell5_7 = OVERWORLD_GRID.find((c) => c.col === 5 && c.row === 7)!;
const cell8_6 = OVERWORLD_GRID.find((c) => c.col === 8 && c.row === 6)!;
const cell0_0 = OVERWORLD_GRID.find((c) => c.col === 0 && c.row === 0)!;

const visited = ['O7_7', 'O7_6', '5,7', 'C8_R6'];
const current = { col: 7, row: 4 };
const cell7_4 = OVERWORLD_GRID.find((c) => c.col === 7 && c.row === 4)!;

assert.equal(isCellVisited(cell7_4, visited, current), true, 'Current location cell must be highlighted');
assert.equal(isCellVisited(cell7_7, visited, current), true, 'Visited screen O7_7 must be highlighted');
assert.equal(isCellVisited(cell7_6, visited, current), true, 'Visited screen O7_6 must be highlighted');
assert.equal(isCellVisited(cell5_7, visited, current), true, 'Visited screen 5,7 coordinate must be highlighted');
assert.equal(isCellVisited(cell8_6, visited, current), true, 'Visited screen C8_R6 format must be highlighted');
assert.equal(isCellVisited(cell0_0, visited, current), false, 'Unvisited screen [0,0] must remain hidden');

// 4. Verify dungeon & cave overworld parent location mapping
const d1Loc = getPlayerOverworldLocation(ALL_SCREENS['D1_1']);
assert.deepEqual({ col: d1Loc.col, row: d1Loc.row, isDungeon: d1Loc.isDungeon }, { col: 7, row: 4, isDungeon: true });

const d2Loc = getPlayerOverworldLocation(ALL_SCREENS['D2_1']);
assert.deepEqual({ col: d2Loc.col, row: d2Loc.row, isDungeon: d2Loc.isDungeon }, { col: 6, row: 6, isDungeon: true });

const d3Loc = getPlayerOverworldLocation(ALL_SCREENS['D3_1']);
assert.deepEqual({ col: d3Loc.col, row: d3Loc.row, isDungeon: d3Loc.isDungeon }, { col: 8, row: 5, isDungeon: true });

const shopLoc = getPlayerOverworldLocation(ALL_SCREENS['C_SHOP']);
assert.deepEqual({ col: shopLoc.col, row: shopLoc.row, isCave: shopLoc.isCave }, { col: 5, row: 7, isCave: true });

// 5. Verify O4_7 (coord 4,7) is playable and connected bidirectionally to O5_7 and O4_6
const o47 = ALL_SCREENS['O4_7'];
const o57 = ALL_SCREENS['O5_7'];
const o46 = ALL_SCREENS['O4_6'];
assert.ok(o47, 'Screen O4_7 must exist in ALL_SCREENS');
assert.equal(o57.exits.left, 'O4_7', 'O5_7 west exit must lead to O4_7');
assert.equal(o47.exits.right, 'O5_7', 'O4_7 east exit must lead back to O5_7');
assert.equal(o47.exits.up, 'O4_6', 'O4_7 north exit must lead to O4_6');
assert.equal(o46.exits.down, 'O4_7', 'O4_6 south exit must lead to O4_7');
const o47Cell = OVERWORLD_GRID.find((c) => c.col === 4 && c.row === 7);
assert.equal(o47Cell?.id, 'O4_7', '16x8 grid [4,7] must map to O4_7');
assert.equal(o47Cell?.isPlayable, true, '16x8 grid [4,7] must be marked playable');

// 6. BFS Reachability: Verify ALL 128 overworld coordinates (O0_0..O15_7) are reachable from O7_7
const SOLID_TILES = new Set([1, 2, 3, 5, 12, 13, 14, 17, 18]);
const reachable = new Set<string>(['O7_7']);
const queue: string[] = ['O7_7'];
while (queue.length > 0) {
  const currId = queue.shift()!;
  const screen = ALL_SCREENS[currId];
  assert.ok(screen, `Missing screen ${currId}`);
  const dirs: Array<'up' | 'down' | 'left' | 'right'> = ['up', 'down', 'left', 'right'];
  for (const dir of dirs) {
    const nextId = screen.exits[dir];
    if (!nextId || !nextId.startsWith('O')) continue;
    assert.ok(ALL_SCREENS[nextId], `${currId}.${dir} points to missing screen ${nextId}`);
    // Verify doorway tiles on currId edge are walkable
    const openEdge =
      dir === 'left'
        ? [5, 6].some((r) => !SOLID_TILES.has(screen.tiles[r][0]))
        : dir === 'right'
        ? [5, 6].some((r) => !SOLID_TILES.has(screen.tiles[r][15]))
        : dir === 'up'
        ? [7, 8].some((c) => !SOLID_TILES.has(screen.tiles[0][c]))
        : [7, 8].some((c) => !SOLID_TILES.has(screen.tiles[10][c]));
    assert.ok(openEdge, `${currId}.${dir} doorway must have at least one walkable tile`);

    if (!reachable.has(nextId)) {
      reachable.add(nextId);
      queue.push(nextId);
    }
  }
}
assert.equal(reachable.size, 128, `Expected all 128 overworld screens reachable from O7_7, got ${reachable.size}`);

console.log('✓ 16x8 Overworld Minimap tests passed (128/128 screens reachable from O7_7)');
