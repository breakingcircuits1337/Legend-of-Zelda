/**
 * Unit Test Suite for Hidden Wall Detection, Push/Bomb Secret Passages, and Visited Map Updates
 */

import {
  detectPushableSecretAt,
  detectBombableSecretsInBlast,
  detectHollowWallAt,
  applySecretDiscoveryToScreen,
  recordSecretDiscoveryInVisitedMap,
  isDungeonRoomDiscovered,
  DUNGEON_MAP_LAYOUTS,
  isHiddenWallTile,
} from '../src/game/secretWallDetector';
import {
  ALL_SCREENS,
  SCREEN_D1_2,
  SCREEN_D1_4,
  SCREEN_D1_SECRET_ARMORY,
  SCREEN_D2_2,
  SCREEN_D2_SECRET_SHRINE,
  SCREEN_D3_1,
  SCREEN_D3_SECRET_PASSAGE,
  SCREEN_D3_VAULT,
} from '../src/game/worldData';
import { Direction, ScreenData } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

function cloneScreen(screen: ScreenData): ScreenData {
  return {
    ...screen,
    tiles: screen.tiles.map((row) => [...row]),
    exits: { ...screen.exits },
    enemies: screen.enemies.map((e) => ({ ...e })),
    secrets: screen.secrets ? screen.secrets.map((s) => ({ ...s, pairedTiles: s.pairedTiles?.map((p) => ({ ...p })) })) : undefined,
  };
}

function cloneScreensMap(screens: Record<string, ScreenData>): Record<string, ScreenData> {
  const out: Record<string, ScreenData> = {};
  for (const [k, v] of Object.entries(screens)) {
    out[k] = cloneScreen(v);
  }
  return out;
}

console.log('--- RUNNING HIDDEN WALL DETECTION & SECRET PASSAGES TEST SUITE ---');

// Test 1: Hollow Wall Probe Detection (Sword Tap / Tile Inspection)
console.log('\n[Test 1: Hollow Wall Detection & Probing]');
assert(isHiddenWallTile(13), 'Tile 13 (Bombable Wall) is classified as hidden wall tile');
assert(isHiddenWallTile(14), 'Tile 14 (Pushable Block) is classified as hidden wall tile');
assert(isHiddenWallTile(17), 'Tile 17 (Strikeable Secret Wall) is classified as hidden wall tile');
assert(!isHiddenWallTile(5), 'Tile 5 (Solid Dungeon Wall) is not classified as hidden wall tile');

const d1_4 = cloneScreen(SCREEN_D1_4);
const revealedEmpty = new Set<string>();
const probeD1_4_row5 = detectHollowWallAt(d1_4, 5, 0, revealedEmpty);
const probeD1_4_row6 = detectHollowWallAt(d1_4, 6, 0, revealedEmpty);
const probeD1_4_solid = detectHollowWallAt(d1_4, 2, 0, revealedEmpty);
assert(probeD1_4_row5.isHollow && probeD1_4_row5.secret?.id === 'secret_d1_4_bomb_west', 'Detects hollow secret wall at D1_4 (5, 0)');
assert(probeD1_4_row6.isHollow && probeD1_4_row6.secret?.id === 'secret_d1_4_bomb_west', 'Detects paired tile of hollow secret wall at D1_4 (6, 0)');
assert(!probeD1_4_row5.triggersOnSword, 'Bomb/push secret wall does not open solely from sword clink probe');
assert(!probeD1_4_solid.isHollow && probeD1_4_solid.secret === null, 'Solid dungeon wall at D1_4 (2, 0) is not hollow');

// Test 2: Pushable Block & Secret Wall Detection
console.log('\n[Test 2: Push Detection & Puzzle Rules]');
const d1_2 = cloneScreen(SCREEN_D1_2);
const pushWhileEnemies = detectPushableSecretAt(d1_2, 5, 7, Direction.LEFT, true, revealedEmpty);
assert(
  pushWhileEnemies !== null && pushWhileEnemies.blockedByEnemies === true,
  'D1_2 push block is blocked while Stalfos enemies remain alive'
);

const pushCleared = detectPushableSecretAt(d1_2, 5, 7, Direction.LEFT, false, revealedEmpty);
assert(
  pushCleared !== null && !pushCleared.blockedByEnemies && pushCleared.secret.id === 'secret_d1_2_push',
  'D1_2 push block unlocks once enemies are cleared and pushed LEFT'
);

const pushNorthShortcut = detectPushableSecretAt(d1_2, 0, 8, Direction.UP, true, revealedEmpty);
assert(
  pushNorthShortcut !== null &&
    !pushNorthShortcut.blockedByEnemies &&
    pushNorthShortcut.secret.id === 'secret_d1_2_north_shortcut',
  'Pushing paired tile (0, 8) on D1_2 north wall detects shortcut passage secret'
);

const d3_1 = cloneScreen(SCREEN_D3_1);
const pushD3East = detectPushableSecretAt(d3_1, 6, 15, Direction.RIGHT, true, revealedEmpty);
assert(
  pushD3East !== null && pushD3East.secret.id === 'secret_d3_1_east_shortcut',
  'Pushing D3_1 east secret wall at paired tile (6, 15) detects shortcut to D3_SECRET_PASSAGE'
);

// Test 3: Bomb Blast Detection on Dungeon Walls
console.log('\n[Test 3: Bomb Blast Detection Across Primary & Paired Tiles]');
const d2_2 = cloneScreen(SCREEN_D2_2);
// Blast near paired tile (6, 0) => center x=8, y=104
const bombNearD2_2 = detectBombableSecretsInBlast(d2_2, 16, 104, 16, false, revealedEmpty);
assert(
  bombNearD2_2.length === 1 && bombNearD2_2[0].id === 'secret_d2_2_west_shrine',
  'Bomb blast near paired tile (6, 0) triggers D2_2 west shrine secret'
);

const bombFarD2_2 = detectBombableSecretsInBlast(d2_2, 128, 88, 16, false, revealedEmpty);
assert(bombFarD2_2.length === 0, 'Bomb blast in room center does not falsely trigger distant wall secret');

// Ensure interior push-block puzzle (D1_2 Stalfos block) cannot be bypassed by bomb
const bombInteriorPush = detectBombableSecretsInBlast(d1_2, 7 * 16 + 8, 5 * 16 + 8, 16, false, revealedEmpty);
assert(bombInteriorPush.length === 0, 'Bomb blast does not bypass D1_2 push-only crypt block');

// Test 4: Generalized Tile & Exit Opening + Bidirectional Linked Shortcut Propagation
console.log('\n[Test 4: Tile Reveal, Exit Opening & Bidirectional Shortcuts]');
const screens = cloneScreensMap(ALL_SCREENS);
const revealedSet = new Set<string>();

// Breach D1_4 west bomb wall
const d1_4Secret = screens.D1_4.secrets![0];
revealedSet.add(d1_4Secret.id);
applySecretDiscoveryToScreen(screens.D1_4, d1_4Secret, screens, revealedSet);
assert(screens.D1_4.tiles[5][0] === 16 && screens.D1_4.tiles[6][0] === 16, 'D1_4 west wall opens tiles [5][0] & [6][0] to bomb passage (16)');
assert(screens.D1_4.exits.left === 'D1_SECRET_ARMORY', 'D1_4 exits.left unlocks to D1_SECRET_ARMORY');

// Breach D1_2 north shortcut wall -> propagates to D1_SECRET_ARMORY south wall
const d1_2Shortcut = screens.D1_2.secrets!.find((s) => s.id === 'secret_d1_2_north_shortcut')!;
revealedSet.add(d1_2Shortcut.id);
applySecretDiscoveryToScreen(screens.D1_2, d1_2Shortcut, screens, revealedSet);
assert(screens.D1_2.tiles[0][7] === 16 && screens.D1_2.tiles[0][8] === 16, 'D1_2 north shortcut opens [0][7] & [0][8]');
assert(screens.D1_2.exits.up === 'D1_SECRET_ARMORY', 'D1_2 exits.up unlocks to D1_SECRET_ARMORY');
assert(revealedSet.has('secret_d1_armory_south_shortcut'), 'Linked secret on D1_SECRET_ARMORY is also marked revealed');
assert(
  screens.D1_SECRET_ARMORY.tiles[10][7] === 16 &&
    screens.D1_SECRET_ARMORY.tiles[10][8] === 16 &&
    screens.D1_SECRET_ARMORY.exits.down === 'D1_2',
  'D1_SECRET_ARMORY south wall & exits.down open bidirectionally back to D1_2'
);

// Breach D3_1 east wall -> D3_SECRET_PASSAGE, and D3_SECRET_PASSAGE north wall -> D3_VAULT
const d3_1Secret = screens.D3_1.secrets![0];
revealedSet.add(d3_1Secret.id);
applySecretDiscoveryToScreen(screens.D3_1, d3_1Secret, screens, revealedSet);
assert(screens.D3_1.tiles[5][15] === 16 && screens.D3_1.tiles[6][15] === 16, 'D3_1 east wall opens to D3_SECRET_PASSAGE');
assert(screens.D3_1.exits.right === 'D3_SECRET_PASSAGE', 'D3_1 exits.right unlocks to D3_SECRET_PASSAGE');

const d3PassageSecret = screens.D3_SECRET_PASSAGE.secrets![0];
revealedSet.add(d3PassageSecret.id);
applySecretDiscoveryToScreen(screens.D3_SECRET_PASSAGE, d3PassageSecret, screens, revealedSet);
assert(screens.D3_SECRET_PASSAGE.exits.up === 'D3_VAULT', 'D3_SECRET_PASSAGE exits.up unlocks to D3_VAULT');
assert(
  screens.D3_VAULT.tiles[10][7] === 16 &&
    screens.D3_VAULT.tiles[10][8] === 16 &&
    screens.D3_VAULT.exits.down === 'D3_SECRET_PASSAGE',
  'D3_VAULT south wall & exits.down open bidirectionally to D3_SECRET_PASSAGE'
);

// Test 5: Visited Screens Map Updates & Dungeon Minimap Room Discovery
console.log('\n[Test 5: Visited Screens Map Updates & Dungeon Map Discovery]');
const visitedSet = new Set<string>(['O7_7', '7,7', 'D2_1', 'D2_2']);
const d2Layout = DUNGEON_MAP_LAYOUTS[2];
const d2ShrineNode = d2Layout.rooms.find((r) => r.id === 'D2_SECRET_SHRINE')!;

assert(
  !isDungeonRoomDiscovered(d2ShrineNode, Array.from(visitedSet), 'D2_2'),
  'D2_SECRET_SHRINE is hidden on dungeon map before wall secret is revealed'
);

const d2Secret = screens.D2_2.secrets![0];
const updatedVisited = recordSecretDiscoveryInVisitedMap(visitedSet, screens.D2_2, d2Secret, screens);

assert(updatedVisited.includes('D2_SECRET_SHRINE'), 'visitedScreens includes target hidden room D2_SECRET_SHRINE after reveal');
assert(updatedVisited.includes('secret:secret_d2_2_west_shrine'), 'visitedScreens records secret:secret_d2_2_west_shrine marker');
assert(
  isDungeonRoomDiscovered(d2ShrineNode, updatedVisited, 'D2_2'),
  'D2_SECRET_SHRINE is immediately discovered on dungeon map after bombing/pushing west wall'
);

// Verify linked shortcut updates both secret markers and target room in visitedScreens
const shortcutVisited = new Set<string>(['D1_2']);
const updatedD1Visited = recordSecretDiscoveryInVisitedMap(shortcutVisited, screens.D1_2, d1_2Shortcut, screens);
assert(updatedD1Visited.includes('D1_SECRET_ARMORY'), 'Shortcut reveal adds target room D1_SECRET_ARMORY to visitedScreens');
assert(updatedD1Visited.includes('secret:secret_d1_2_north_shortcut'), 'Shortcut reveal records secret_d1_2_north_shortcut');
assert(updatedD1Visited.includes('secret:secret_d1_armory_south_shortcut'), 'Shortcut reveal records linked secret_d1_armory_south_shortcut');

// Verify new room exports exist
assert(SCREEN_D2_SECRET_SHRINE.id === 'D2_SECRET_SHRINE', 'SCREEN_D2_SECRET_SHRINE is registered');
assert(SCREEN_D3_SECRET_PASSAGE.id === 'D3_SECRET_PASSAGE', 'SCREEN_D3_SECRET_PASSAGE is registered');
assert(SCREEN_D1_SECRET_ARMORY.secrets?.length === 1, 'SCREEN_D1_SECRET_ARMORY has south shortcut trigger');
assert(SCREEN_D3_VAULT.secrets?.length === 1, 'SCREEN_D3_VAULT has south shortcut trigger');

console.log('\n=== ALL HIDDEN WALL DETECTION & SECRET PASSAGE TESTS PASSED! ===');
