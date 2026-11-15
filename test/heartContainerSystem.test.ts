/**
 * Unit & Engine Integration Test Suite for the Heart Container Upgrade System
 * Tests world placement walkability, permanent maxHearts scaling & 16-heart cap,
 * duplicate/boss/cave deduplication, and battery-RAM save/load persistence.
 */

import { ALL_SCREENS } from '../src/game/worldData';
import {
  ABSOLUTE_MAX_HEARTS,
  BASE_MAX_HEARTS,
  MAX_HEART_CONTAINER_COUNT,
  WORLD_HEART_CONTAINERS,
  applyHeartContainerUpgrade,
  getBossHeartContainerId,
  getHeartCapacitySummary,
  getSpawnableHeartContainersForScreen,
} from '../src/game/heartContainerSystem';
import { Direction, EnemyType, GameState, ItemType, PlayerState } from '../src/types';

// Provide lightweight browser globals for headless Node execution
const storageMap = new Map<string, string>();
if (typeof (globalThis as any).localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (k: string) => storageMap.get(k) ?? null,
    setItem: (k: string, v: string) => storageMap.set(k, v),
    removeItem: (k: string) => storageMap.delete(k),
    clear: () => storageMap.clear(),
  };
}
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = {
    setInterval: () => 0,
    clearInterval: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

function createMockPlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    x: 120,
    y: 88,
    dir: Direction.UP,
    moving: false,
    isAttacking: false,
    attackTimer: 0,
    animFrame: 0,
    animTimer: 0,
    hearts: 2,
    maxHearts: BASE_MAX_HEARTS,
    swordTier: 1,
    bItem: ItemType.NONE,
    inventory: {
      hasSword: true,
      hasBoomerang: false,
      hasBow: false,
      hasCandle: false,
      hasCompass: false,
      hasDungeonMap: false,
      rupees: 150,
      bombs: 4,
      keys: 1,
      triforcePieces: 0,
    },
    invincibleTimer: 0,
    knockback: null,
    isHoldingItem: false,
    heldItemType: null,
    heldItemTimer: 0,
    collectedHeartContainers: [],
    ...overrides,
  };
}

function createMockCanvas(): HTMLCanvasElement {
  const ctx = {
    imageSmoothingEnabled: false,
    save: () => {},
    restore: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    fillText: () => {},
    measureText: (t: string) => ({ width: t.length * 6 }),
    beginPath: () => {},
    arc: () => {},
    fill: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    setLineDash: () => {},
    clearRect: () => {},
    translate: () => {},
  };
  return {
    width: 256,
    height: 176,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

const SOLID_TILES = new Set([1, 2, 3, 5, 12, 13, 14, 17, 18]);

async function runTests() {
  console.log('--- RUNNING HEART CONTAINER UPGRADE SYSTEM TEST SUITE ---');

  // Test 1: Curated World Placement Integrity & Walkability
  console.log('\n[Test 1: World Placement Integrity & Walkable Tiles]');
  assert(
    WORLD_HEART_CONTAINERS.length === 13,
    `Registry contains 13 upgrade containers (3 base + 13 = ${MAX_HEART_CONTAINER_COUNT} max hearts)`
  );

  for (const hc of WORLD_HEART_CONTAINERS) {
    const screen = ALL_SCREENS[hc.screenId];
    assert(Boolean(screen), `Target screen "${hc.screenId}" exists for ${hc.containerId}`);
    if (hc.spawnsOnScreenLoad && screen) {
      const col = Math.floor(hc.x / 16);
      const row = Math.floor(hc.y / 16);
      const tile = screen.tiles[row]?.[col];
      assert(
        tile !== undefined && !SOLID_TILES.has(tile),
        `Floor pickup ${hc.containerId} at (${hc.x},${hc.y}) -> tile[${row}][${col}]=${tile} is walkable`
      );
    }
  }

  // Test 2: Upgrade Mechanics, Full Heal, Deduplication, and 16-Heart Cap
  console.log('\n[Test 2: Upgrade Scaling, Deduplication & 16-Heart Cap]');
  const collected = new Set<string>();
  const player = createMockPlayer({ hearts: 1, maxHearts: 6 });

  const first = applyHeartContainerUpgrade(player, collected, 'hc_o3_7_coast');
  assert(first.upgraded === true && !first.alreadyClaimed, 'First container upgrades maxHearts');
  assert(player.maxHearts === 8, 'maxHearts permanently increased from 6 to 8 (4 hearts)');
  assert(player.hearts === 8, 'Health refilled to full (8/8) upon collection');
  assert(player.collectedHeartContainers?.includes('hc_o3_7_coast') === true, 'Container ID synced on player');

  // Duplicate attempt should not re-upgrade
  player.hearts = 3;
  const dup = applyHeartContainerUpgrade(player, collected, 'hc_o3_7_coast');
  assert(dup.upgraded === false && dup.alreadyClaimed === true, 'Duplicate container ID rejected');
  assert(player.maxHearts === 8 && player.hearts === 3, 'Duplicate attempt leaves maxHearts/hearts untouched');

  // Upgrade all the way to cap (16 containers = 32 half-hearts)
  for (let i = 0; i < 20; i++) {
    applyHeartContainerUpgrade(player, collected, `hc_cap_test_${i}`);
  }
  assert(player.maxHearts === ABSOLUTE_MAX_HEARTS, 'maxHearts capped cleanly at 32 (16 Heart Containers)');
  const summary = getHeartCapacitySummary(player);
  assert(summary.containerCount === 16 && summary.maxPossibleContainers === 16, 'Capacity summary reports 16/16');

  // Test 3: Spawnable Pickups Filtering & Boss Mapping
  console.log('\n[Test 3: Screen Pickup Spawning & Boss ID Mapping]');
  const freshSet = new Set<string>();
  const o37Pickups = getSpawnableHeartContainersForScreen('O3_7', freshSet);
  assert(o37Pickups.length === 1 && o37Pickups[0].type === ItemType.HEART_CONTAINER, 'O3_7 spawns Heart Container when unclaimed');
  freshSet.add('hc_o3_7_coast');
  assert(getSpawnableHeartContainersForScreen('O3_7', freshSet).length === 0, 'O3_7 stops spawning Heart Container once collected');
  assert(getBossHeartContainerId(EnemyType.AQUAMENTUS) === 'hc_d1_boss', 'Aquamentus maps to hc_d1_boss');
  assert(getBossHeartContainerId(EnemyType.DODONGO) === 'hc_d2_boss', 'Dodongo maps to hc_d2_boss');
  assert(getBossHeartContainerId(EnemyType.MANHANDLA) === 'hc_d3_boss', 'Manhandla maps to hc_d3_boss');

  // Test 4: GameEngine End-to-End Collection, Cave No-Duplicate Fix, and Save/Load Persistence
  console.log('\n[Test 4: GameEngine Integration & Battery-RAM Persistence]');
  const { GameEngine } = await import('../src/game/engine');
  const { getDefaultSaveSlots, loadAllSaveSlots } = await import('../src/game/saveSystem');

  const engine = new GameEngine(createMockCanvas());
  const baseSlot = getDefaultSaveSlots()[0];
  engine.loadSaveSlot(baseSlot);
  engine.gameState = GameState.PLAYING;

  // Enter Overworld Heart Piece Coast (O3_7)
  engine.loadScreen('O3_7', 112, 80);
  const coastHeart = engine.pickups.find((p) => p.type === ItemType.HEART_CONTAINER);
  assert(Boolean(coastHeart), 'GameEngine spawned overworld Heart Container in O3_7');

  // Walk Link directly onto the Heart Container and run physics tick
  engine.player.hearts = 2; // Injured before picking up
  engine.player.x = coastHeart!.x;
  engine.player.y = coastHeart!.y;
  (engine as any).updatePickups();

  assert(engine.player.maxHearts === 8, 'Collecting overworld Heart Container upgraded engine.player.maxHearts to 8');
  assert(engine.player.hearts === 8, 'Collecting overworld Heart Container refilled engine.player.hearts to 8');
  assert(engine.collectedHeartContainers.has('hc_o3_7_coast'), 'Engine recorded hc_o3_7_coast as collected');

  // Revisit O3_7 -> should not respawn
  engine.loadScreen('O3_7', 112, 80);
  assert(
    !engine.pickups.some((p) => p.type === ItemType.HEART_CONTAINER),
    'Re-entering O3_7 does not respawn already-collected Heart Container'
  );

  // Verify C_SECRET_HEART no longer double-spawns pickup + OldMan altar
  engine.loadScreen('C_SECRET_HEART', 120, 120);
  assert(
    engine.pickups.filter((p) => p.type === ItemType.HEART_CONTAINER).length === 0 &&
      engine.oldMan?.offeredItem === ItemType.HEART_CONTAINER,
    'C_SECRET_HEART offers single OldMan altar Heart Container without duplicate floor pickup'
  );

  // Claim cave altar Heart Container once -> maxHearts increases cleanly from 8 to 10 (not 12!)
  engine.player.x = engine.oldMan!.itemX;
  engine.player.y = engine.oldMan!.itemY;
  (engine as any).updateOldManNPC();
  assert(engine.player.maxHearts === 10, 'Claiming Secret Heart Cavern altar upgrades maxHearts cleanly from 8 to 10');

  // Reload from saved slot in a brand new GameEngine instance -> permanent capacity & claim state restored
  const savedSlot = loadAllSaveSlots().find((s) => s.id === baseSlot.id)!;
  assert(savedSlot.maxHearts === 10, 'Save slot persisted upgraded maxHearts (10)');
  assert(
    savedSlot.collectedHeartContainers?.includes('hc_o3_7_coast') === true &&
      savedSlot.collectedHeartContainers?.includes('hc_cave_secret_heart') === true,
    'Save slot persisted both collected Heart Container IDs'
  );

  const reloadedEngine = new GameEngine(createMockCanvas());
  reloadedEngine.loadSaveSlot(savedSlot);
  assert(reloadedEngine.player.maxHearts === 10, 'Reloaded engine preserved upgraded maxHearts (10)');
  reloadedEngine.loadScreen('O3_7', 112, 80);
  assert(
    !reloadedEngine.pickups.some((p) => p.type === ItemType.HEART_CONTAINER),
    'Reloaded engine keeps O3_7 Heart Container claimed across sessions'
  );

  console.log('\n>>> ALL HEART CONTAINER UPGRADE SYSTEM TESTS PASSED SUCCESSFULLY! <<<\n');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
