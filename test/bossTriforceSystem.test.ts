import assert from 'node:assert/strict';

// Minimal headless browser globals for GameEngine & SaveSystem
(globalThis as unknown as { window?: unknown }).window ??= {
  setInterval: () => 0,
  clearInterval: () => {},
  setTimeout,
  clearTimeout,
};

const storageMap = new Map<string, string>();
(globalThis as unknown as { localStorage?: Storage }).localStorage ??= {
  getItem: (k: string) => storageMap.get(k) ?? null,
  setItem: (k: string, v: string) => {
    storageMap.set(k, v);
  },
  removeItem: (k: string) => {
    storageMap.delete(k);
  },
  clear: () => storageMap.clear(),
  key: (i: number) => Array.from(storageMap.keys())[i] ?? null,
  get length() {
    return storageMap.size;
  },
} as Storage;

import { ALL_SCREENS } from '../src/game/worldData';
import {
  BOSS_TRIFORCE_BATTLES,
  TILE_BOSS_GATE,
  TOTAL_TRIFORCE_PIECES,
  isBossGateLocked,
  applyBossGateState,
  normalizeTriforceIds,
} from '../src/game/bossTriforceSystem';
import { Direction, EnemyType, GameState, ItemType } from '../src/types';
import { saveGameProgress, loadAllSaveSlots, clearSaveSlot } from '../src/game/saveSystem';

async function runTests() {
  const { GameEngine, SCREEN_WIDTH, SCREEN_HEIGHT } = await import('../src/game/engine');

  const createMockCanvas = (): HTMLCanvasElement => {
    const ctx = new Proxy(
      {
        imageSmoothingEnabled: false,
        font: '',
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        textAlign: 'left',
        measureText: (txt: string) => ({ width: txt.length * 5 }),
      },
      {
        get(target, prop) {
          if (prop in target) return (target as Record<string | symbol, unknown>)[prop];
          return () => {};
        },
      }
    );
    return {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      getContext: () => ctx,
    } as unknown as HTMLCanvasElement;
  };

  // 1. Verify worldData defines locked Boss Gates (tile 19) on all 3 boss arenas
  assert.equal(BOSS_TRIFORCE_BATTLES.length, 3);
  for (const cfg of BOSS_TRIFORCE_BATTLES) {
    const bossScreen = ALL_SCREENS[cfg.bossScreenId];
    const triforceScreen = ALL_SCREENS[cfg.triforceScreenId];
    assert.ok(bossScreen, `Boss screen ${cfg.bossScreenId} must exist`);
    assert.ok(triforceScreen, `Triforce screen ${cfg.triforceScreenId} must exist`);
    assert.equal(
      isBossGateLocked(bossScreen),
      true,
      `Boss screen ${cfg.bossScreenId} must start with locked TILE_BOSS_GATE (${TILE_BOSS_GATE})`
    );
    for (const gt of cfg.gateTiles) {
      assert.equal(
        bossScreen.tiles[gt.row][gt.col],
        TILE_BOSS_GATE,
        `${cfg.bossScreenId} gate tile (${gt.row},${gt.col}) must be TILE_BOSS_GATE (19)`
      );
    }
  }

  // Verify normalizeTriforceIds backward compatibility
  assert.deepEqual(normalizeTriforceIds(undefined, 2), ['triforce_d1', 'triforce_d2']);
  assert.deepEqual(normalizeTriforceIds(['triforce_d3'], 1), ['triforce_d3']);

  // 2. Test Aquamentus (D1_5) gate blocks Link while alive, opens on defeat, and D1_6 grants Shard I
  storageMap.clear();
  const engine = new GameEngine(createMockCanvas());
  const slots = loadAllSaveSlots();
  engine.loadSaveSlot(slots[0]);
  engine.transitionMode = 'fade';
  engine.gameState = GameState.PLAYING;

  engine.loadScreen('D1_5', 120, 120);
  assert.equal(isBossGateLocked(engine.currentScreen), true, 'D1_5 east gate must be locked initially');
  assert.equal(
    (engine as unknown as { checkTileCollision: (x: number, y: number, w: number, h: number) => boolean }).checkTileCollision(
      15 * 16,
      5 * 16 + 4,
      14,
      14
    ),
    true,
    'Locked Boss Gate on D1_5 must block player collision'
  );

  // Defeat Aquamentus
  const aquamentus = engine.enemies.find((e) => e.type === EnemyType.AQUAMENTUS);
  assert.ok(aquamentus, 'Aquamentus must spawn in D1_5');
  (engine as unknown as { damageEnemy: (e: typeof aquamentus, dmg: number, dir: Direction) => void }).damageEnemy(
    aquamentus!,
    20,
    Direction.RIGHT
  );
  assert.equal(aquamentus!.isDead, true);
  assert.equal(isBossGateLocked(engine.currentScreen), false, 'D1_5 gate must unlock when Aquamentus is slain');
  assert.equal(engine.defeatedBossRooms.has('D1_5'), true);
  assert.equal(
    (engine as unknown as { checkTileCollision: (x: number, y: number, w: number, h: number) => boolean }).checkTileCollision(
      15 * 16,
      5 * 16 + 4,
      14,
      14
    ),
    false,
    'Opened D1_5 gate must allow Link passage into D1_6'
  );

  // Enter D1_6 and collect Triforce Shard I
  engine.loadScreen('D1_6', 32, 88);
  const d1Triforce = engine.pickups.find((p) => p.type === ItemType.TRIFORCE);
  assert.ok(d1Triforce, 'D1_6 must spawn Triforce Shard I');
  engine.player.x = d1Triforce!.x;
  engine.player.y = d1Triforce!.y;
  (engine as unknown as { updatePickups: () => void }).updatePickups();
  assert.equal(engine.player.inventory.triforcePieces, 1);
  assert.deepEqual(engine.player.collectedTriforceIds, ['triforce_d1']);

  // Finish Triforce hold animation -> VICTORY -> continueFromVictory()
  for (let i = 0; i < 205; i++) {
    (engine as unknown as { updatePhysics: () => void }).updatePhysics();
  }
  assert.equal(engine.gameState as GameState, GameState.VICTORY, 'Collecting Triforce shard must trigger VICTORY screen');
  engine.continueFromVictory();
  assert.equal(engine.gameState as GameState, GameState.PLAYING);
  assert.equal(engine.currentScreen.id, 'O7_4', 'Continue quest from D1_6 should return outside Level-1');

  // 3. Test Dodongo (D2_BOSS) bomb-swallow defeat unlocks north gate and out-of-order collection in D3 before D2
  engine.loadScreen('D3_BOSS', 120, 120);
  assert.equal(isBossGateLocked(engine.currentScreen), true, 'D3_BOSS north gate must start locked');
  const manhandla = engine.enemies.find((e) => e.type === EnemyType.MANHANDLA);
  assert.ok(manhandla, 'Manhandla must spawn in D3_BOSS');
  (engine as unknown as { damageEnemy: (e: typeof manhandla, dmg: number, dir: Direction) => void }).damageEnemy(
    manhandla!,
    30,
    Direction.UP
  );
  assert.equal(isBossGateLocked(engine.currentScreen), false, 'D3_BOSS gate must unlock when Manhandla dies');

  engine.loadScreen('D3_TRIFORCE', 120, 130);
  const d3Triforce = engine.pickups.find((p) => p.type === ItemType.TRIFORCE);
  assert.ok(d3Triforce, 'D3_TRIFORCE must spawn Triforce Shard III');
  engine.player.x = d3Triforce!.x;
  engine.player.y = d3Triforce!.y;
  (engine as unknown as { updatePickups: () => void }).updatePickups();
  assert.equal(engine.player.inventory.triforcePieces, 2, 'Out-of-order D3 after D1 must increment Triforce count to 2/3');

  // Now D2_BOSS Dodongo via swallowed bomb path
  engine.continueFromVictory();
  assert.equal(engine.currentScreen.id, 'O8_5');
  engine.loadScreen('D2_BOSS', 120, 100);
  assert.equal(isBossGateLocked(engine.currentScreen), true, 'D2_BOSS north gate must start locked');
  const dodongo = engine.enemies.find((e) => e.type === EnemyType.DODONGO);
  assert.ok(dodongo, 'Dodongo must spawn in D2_BOSS');
  dodongo!.health = 4;
  dodongo!.customData = { ...(dodongo!.customData || {}), isSwollen: true, swollenTimer: 1 };
  (engine as unknown as { updateEnemies: () => void }).updateEnemies();
  assert.equal(dodongo!.isDead, true, 'Dodongo must die when swollen bomb detonates');
  assert.equal(isBossGateLocked(engine.currentScreen), false, 'D2_BOSS north gate must unlock via Dodongo bomb defeat');

  engine.loadScreen('D2_TRIFORCE', 120, 130);
  const d2Triforce = engine.pickups.find((p) => p.type === ItemType.TRIFORCE);
  assert.ok(d2Triforce, 'D2_TRIFORCE must spawn Triforce Shard II even after D3 was collected');
  engine.player.x = d2Triforce!.x;
  engine.player.y = d2Triforce!.y;
  (engine as unknown as { updatePickups: () => void }).updatePickups();
  assert.equal(engine.player.inventory.triforcePieces, TOTAL_TRIFORCE_PIECES, 'All 3/3 Triforce shards collected');

  // 4. Save/Load Persistence: defeated boss rooms & open gates persist cleanly
  saveGameProgress(
    slots[0].id,
    engine.player,
    engine.currentScreen.id,
    0,
    Array.from(engine.visitedScreens),
    Array.from(engine.collectedHeartContainers)
  );
  const reloadedEngine = new GameEngine(createMockCanvas());
  const reloadedSlots = loadAllSaveSlots();
  assert.equal(reloadedSlots[0].triforcePieces, 3);
  assert.equal(reloadedSlots[0].defeatedBossRooms?.length, 3);
  reloadedEngine.loadSaveSlot(reloadedSlots[0]);
  reloadedEngine.loadScreen('D1_5', 120, 120);
  assert.equal(isBossGateLocked(reloadedEngine.currentScreen), false, 'Re-entering D1_5 after defeating Aquamentus keeps gate open');
  assert.equal(
    reloadedEngine.enemies.some((e) => e.type === EnemyType.AQUAMENTUS),
    false,
    'Defeated Aquamentus should remain cleared upon reload'
  );
  reloadedEngine.loadScreen('D1_6', 32, 88);
  assert.equal(
    reloadedEngine.pickups.some((p) => p.type === ItemType.TRIFORCE),
    false,
    'Already-collected Triforce shard should not respawn on reload'
  );

  // Clean up test save slot & verify applyBossGateState helper symmetry
  assert.equal(applyBossGateState(ALL_SCREENS['D1_5'], false), false, 'World template remains locked by default');
  clearSaveSlot(slots[0].id);

  console.log('✓ Boss Battle Gates & Triforce Shards test suite passed (all 3 bosses, gates, out-of-order collection & save persistence)');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
