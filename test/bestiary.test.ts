/**
 * Unit & GameEngine Integration Test Suite for the Enemy Bestiary System
 */

import {
  BESTIARY_ENTRIES,
  DEFEATABLE_ENEMY_TYPES,
  INDESTRUCTIBLE_ENEMY_TYPES,
  getBestiaryEntry,
  getBestiaryProgress,
  isDefeatableEnemyType,
  unlockBestiaryEntry,
} from '../src/game/bestiary';
import { OctorokEnemy } from '../src/game/octorokEnemy';
import { getDefaultSaveSlots, loadAllSaveSlots, saveGameProgress, saveSlotData } from '../src/game/saveSystem';
import { Direction, Enemy, EnemyType, GameState, PlayerState } from '../src/types';

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
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function runTests() {
  let passed = 0;
  const test = async (name: string, fn: () => void | Promise<void>) => {
    await fn();
    passed++;
    console.log(`  PASS: ${name}`);
  };

  console.log('Running Enemy Bestiary test suite...');

  await test('Catalog covers every defeatable EnemyType with valid stats and lore', () => {
    const allEnumTypes = Object.values(EnemyType);
    const expectedDefeatable = allEnumTypes.filter((t) => !INDESTRUCTIBLE_ENEMY_TYPES.has(t));

    assert(
      BESTIARY_ENTRIES.length === expectedDefeatable.length,
      `Expected ${expectedDefeatable.length} bestiary entries, got ${BESTIARY_ENTRIES.length}`
    );

    const seenPages = new Set<number>();
    for (const enemyType of expectedDefeatable) {
      assert(isDefeatableEnemyType(enemyType), `${enemyType} should be defeatable`);
      const entry = getBestiaryEntry(enemyType);
      assert(!!entry, `Missing bestiary entry for ${enemyType}`);
      assert(entry!.name.trim().length > 0, `Empty name for ${enemyType}`);
      assert(entry!.hp > 0, `Invalid HP for ${enemyType}`);
      assert(entry!.speedLabel.trim().length > 0, `Empty speedLabel for ${enemyType}`);
      assert(entry!.attackThreat.trim().length > 0, `Empty attackThreat for ${enemyType}`);
      assert(entry!.weakness.trim().length > 0, `Empty weakness for ${enemyType}`);
      assert(entry!.drops.trim().length > 0, `Empty drops for ${enemyType}`);
      assert(entry!.lore.trim().length >= 30, `Lore too short for ${enemyType}`);
      assert(!seenPages.has(entry!.pageNumber), `Duplicate pageNumber ${entry!.pageNumber}`);
      seenPages.add(entry!.pageNumber);
    }

    assert(!isDefeatableEnemyType(EnemyType.BLADE_TRAP), 'BLADE_TRAP should be indestructible');
  });

  await test('unlockBestiaryEntry unlocks on first defeat, deduplicates repeats, and tracks counts', () => {
    const first = unlockBestiaryEntry([], {}, EnemyType.OCTOROK_RED);
    assert(first.unlockedNow === true, 'First defeat should return unlockedNow=true');
    assert(first.unlockedBestiary.length === 1, 'Should have 1 unlocked entry');
    assert(first.unlockedBestiary[0] === EnemyType.OCTOROK_RED, 'Should contain OCTOROK_RED');
    assert(first.bestiaryDefeatCounts[EnemyType.OCTOROK_RED] === 1, 'Defeat count should be 1');

    const second = unlockBestiaryEntry(
      first.unlockedBestiary,
      first.bestiaryDefeatCounts,
      EnemyType.OCTOROK_RED
    );
    assert(second.unlockedNow === false, 'Second defeat should return unlockedNow=false');
    assert(second.unlockedBestiary.length === 1, 'Should still have only 1 entry');
    assert(second.bestiaryDefeatCounts[EnemyType.OCTOROK_RED] === 2, 'Defeat count should increment to 2');

    const trap = unlockBestiaryEntry(
      second.unlockedBestiary,
      second.bestiaryDefeatCounts,
      EnemyType.BLADE_TRAP
    );
    assert(trap.unlockedNow === false, 'Indestructible Blade Trap should not unlock');
    assert(trap.unlockedBestiary.length === 1, 'Unlocked list should remain unchanged');
  });

  await test('getBestiaryProgress computes discovered total and percentage accurately', () => {
    const empty = getBestiaryProgress([]);
    assert(empty.discovered === 0 && empty.total === DEFEATABLE_ENEMY_TYPES.length && empty.percentage === 0, 'Empty progress mismatch');

    const partial = getBestiaryProgress([EnemyType.OCTOROK_RED, EnemyType.OCTOROK_RED, EnemyType.DARKNUT_RED]);
    assert(partial.discovered === 2, `Expected 2 unique entries, got ${partial.discovered}`);
    assert(partial.total === BESTIARY_ENTRIES.length, 'Total mismatch');

    const full = getBestiaryProgress([...DEFEATABLE_ENEMY_TYPES]);
    assert(full.discovered === full.total && full.percentage === 100, 'Full progress should be 100%');
  });

  // Dynamic import after browser global mocks are set up
  const { GameEngine } = await import('../src/game/engine');

  await test('GameEngine sword defeat unlocks enemy bestiary entry and notifies UI', () => {
    storageMap.clear();
    const engine = new GameEngine(createMockCanvas());
    const slot = getDefaultSaveSlots()[0];
    slot.swordTier = 1;
    engine.loadSaveSlot(slot);

    let lastPlayerUpdate: PlayerState | null = null;
    engine.onPlayerUpdate = (p) => {
      lastPlayerUpdate = { ...p };
    };

    assert((engine.player.unlockedBestiary || []).length === 0, 'New save should start with 0 unlocked bestiary entries');

    // Place a 2-HP Octorok directly in front of Link and strike with sword
    const octorok = new OctorokEnemy({
      id: 'test_octo_1',
      type: EnemyType.OCTOROK_RED,
      x: 120,
      y: 96,
      dir: Direction.DOWN,
    });
    (engine as any).enemies = [octorok];
    engine.player.x = 120;
    engine.player.y = 112;
    engine.player.dir = Direction.UP;
    engine.player.swordTier = 1;
    engine.gameState = GameState.PLAYING;

    (engine as any).checkSwordHit();

    assert(octorok.isDead === true, 'Octorok should be defeated by sword strike');
    assert(
      (engine.player.unlockedBestiary || []).includes(EnemyType.OCTOROK_RED),
      'OCTOROK_RED should be unlocked in player.unlockedBestiary'
    );
    assert(
      !(engine.player.unlockedBestiary || []).includes(EnemyType.MOBLIN_RED),
      'Undefeated MOBLIN_RED should remain locked'
    );
    assert(
      !!lastPlayerUpdate && (lastPlayerUpdate.unlockedBestiary || []).includes(EnemyType.OCTOROK_RED),
      'onPlayerUpdate should propagate newly unlocked bestiary entry'
    );
  });

  await test('GameEngine Dodongo internal bomb kill unlocks DODONGO bestiary entry', () => {
    storageMap.clear();
    const engine = new GameEngine(createMockCanvas());
    const slot = getDefaultSaveSlots()[0];
    engine.loadSaveSlot(slot);

    const dodongo: Enemy = {
      id: 'test_dodongo',
      type: EnemyType.DODONGO,
      x: 112,
      y: 72,
      dir: Direction.LEFT,
      health: 4,
      maxHealth: 8,
      speed: 0.5,
      animFrame: 0,
      animTimer: 0,
      actionTimer: 0,
      isHurt: false,
      hurtTimer: 0,
      isStunned: false,
      stunTimer: 0,
      isDead: false,
      deathTimer: 0,
      customData: {
        isSwollen: true,
        swollenTimer: 1,
      },
    };
    (engine as any).enemies = [dodongo];
    engine.gameState = GameState.PLAYING;

    (engine as any).updateEnemies();

    assert(dodongo.isDead === true, 'Dodongo should die when swallowed bomb detonates at 4 HP');
    assert(
      (engine.player.unlockedBestiary || []).includes(EnemyType.DODONGO),
      'DODONGO bestiary page should unlock on swallowed bomb defeat'
    );
  });

  await test('Bestiary unlocks persist through saveGameProgress and reload via loadSaveSlot', () => {
    storageMap.clear();
    const initialSlots = getDefaultSaveSlots();
    saveSlotData(initialSlots[0]);

    const engine1 = new GameEngine(createMockCanvas());
    engine1.loadSaveSlot(initialSlots[0]);

    const targetEnemy = new OctorokEnemy({
      id: 'test_persist_blue',
      type: EnemyType.OCTOROK_BLUE,
      x: 120,
      y: 96,
      dir: Direction.DOWN,
    });
    (engine1 as any).enemies = [targetEnemy];
    engine1.player.x = 120;
    engine1.player.y = 112;
    engine1.player.dir = Direction.UP;
    engine1.player.swordTier = 2; // White Sword deals 4 dmg, defeating 3-HP Blue Octorok
    (engine1 as any).checkSwordHit();
    assert(targetEnemy.isDead === true, 'Blue Octorok should be defeated by White Sword');

    saveGameProgress(
      initialSlots[0].id,
      engine1.player,
      engine1.currentScreen.id,
      undefined,
      Array.from(engine1.visitedScreens),
      Array.from(engine1.collectedHeartContainers)
    );

    const reloadedSlots = loadAllSaveSlots();
    const savedSlot = reloadedSlots.find((s) => s.id === initialSlots[0].id)!;
    assert(
      (savedSlot.unlockedBestiary || []).includes(EnemyType.OCTOROK_BLUE),
      'Save slot JSON should retain OCTOROK_BLUE unlock'
    );

    const engine2 = new GameEngine(createMockCanvas());
    engine2.loadSaveSlot(savedSlot);
    assert(
      (engine2.player.unlockedBestiary || []).includes(EnemyType.OCTOROK_BLUE),
      'Reloaded GameEngine player should restore OCTOROK_BLUE bestiary entry'
    );
    assert(
      (engine2.player.bestiaryDefeatCounts?.[EnemyType.OCTOROK_BLUE] || 0) === 1,
      'Reloaded defeat count should be preserved'
    );
  });

  console.log(`\nAll ${passed} Enemy Bestiary tests passed!`);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
