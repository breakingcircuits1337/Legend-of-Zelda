/**
 * Unit & GameEngine Integration Test Suite for Per-Save-Slot Death Counter
 */

import {
  clearSaveSlot,
  getDefaultSaveSlots,
  loadAllSaveSlots,
  saveGameProgress,
  saveSlotData,
} from '../src/game/saveSystem';
import { Direction, GameState } from '../src/types';

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

  console.log('Running Death Counter test suite...');

  const { GameEngine } = await import('../src/game/engine');

  await test('Default save slots initialize deaths to 0 and sanitize corrupted counts', () => {
    storageMap.clear();
    const defaults = getDefaultSaveSlots();
    assert(defaults.every((s) => s.deaths === 0), 'All default slots should start with 0 deaths');

    const corrupted = defaults.map((s) => ({ ...s, deaths: undefined as any }));
    storageMap.set('zelda_nes_battery_ram_v1', JSON.stringify(corrupted));
    const loaded = loadAllSaveSlots();
    assert(loaded.every((s) => s.deaths === 0), 'Corrupted/missing deaths should normalize to 0');
  });

  await test('Fatal damage increments slot deaths immediately without double-counting through Game Over', () => {
    storageMap.clear();
    const slots = getDefaultSaveSlots();
    saveSlotData(slots[0]);

    const engine = new GameEngine(createMockCanvas());
    engine.loadSaveSlot(slots[0]);
    engine.gameState = GameState.PLAYING;
    engine.player.hearts = 1;
    engine.player.invincibleTimer = 0;

    (engine as any).damagePlayer(2, Direction.LEFT);

    assert((engine.gameState as GameState) === GameState.DYING, 'Fatal blow should enter DYING state');
    assert(engine.player.deaths === 1, `Expected player.deaths=1, got ${engine.player.deaths}`);
    assert(engine.activeSlot?.deaths === 1, `Expected activeSlot.deaths=1, got ${engine.activeSlot?.deaths}`);

    let storedSlot1 = loadAllSaveSlots().find((s) => s.id === 1)!;
    assert(storedSlot1.deaths === 1, `Expected persisted slot 1 deaths=1, got ${storedSlot1.deaths}`);

    // Run full death sequence (~162+ frames) to GAME_OVER and verify no double-increment
    for (let i = 0; i < 180 && (engine.gameState as GameState) === GameState.DYING; i++) {
      (engine as any).updatePlayerDeath();
    }

    assert((engine.gameState as GameState) === GameState.GAME_OVER, 'Death sequence should finish at GAME_OVER');
    assert(engine.player.deaths === 1, `Deaths should remain 1 after animation, got ${engine.player.deaths}`);
    storedSlot1 = loadAllSaveSlots().find((s) => s.id === 1)!;
    assert(storedSlot1.deaths === 1, `Persisted deaths should still be 1, got ${storedSlot1.deaths}`);
  });

  await test('Continuing and dying again increments deaths sequentially and keeps save slots isolated', () => {
    storageMap.clear();
    const defaults = getDefaultSaveSlots();
    const slot1 = { ...defaults[0], name: 'HERO1', timestamp: 1000, deaths: 0 };
    const slot2 = { ...defaults[1], name: 'HERO2', timestamp: 2000, deaths: 0 };
    saveSlotData(slot1);
    saveSlotData(slot2);

    const engine = new GameEngine(createMockCanvas());
    engine.loadSaveSlot(slot1);

    // Die twice on Slot 1
    engine.player.hearts = 1;
    engine.player.invincibleTimer = 0;
    (engine as any).damagePlayer(2, Direction.UP);
    for (let i = 0; i < 180 && engine.gameState === GameState.DYING; i++) {
      (engine as any).updatePlayerDeath();
    }

    // Simulate Continue
    engine.player.hearts = 6;
    engine.player.invincibleTimer = 0;
    engine.gameState = GameState.PLAYING;
    (engine as any).damagePlayer(8, Direction.RIGHT);

    const slotsAfterSlot1Deaths = loadAllSaveSlots();
    const persisted1 = slotsAfterSlot1Deaths.find((s) => s.id === 1)!;
    const persisted2 = slotsAfterSlot1Deaths.find((s) => s.id === 2)!;
    assert(persisted1.deaths === 2, `Slot 1 should have 2 deaths, got ${persisted1.deaths}`);
    assert(persisted2.deaths === 0, `Slot 2 should remain at 0 deaths, got ${persisted2.deaths}`);

    // Now load Slot 2 and die once
    engine.loadSaveSlot(persisted2);
    assert(engine.player.deaths === 0, 'Slot 2 should start session with 0 deaths');
    engine.player.hearts = 1;
    engine.player.invincibleTimer = 0;
    (engine as any).damagePlayer(2, Direction.DOWN);

    const slotsAfterSlot2Death = loadAllSaveSlots();
    assert(slotsAfterSlot2Death.find((s) => s.id === 1)!.deaths === 2, 'Slot 1 should still have 2 deaths');
    assert(slotsAfterSlot2Death.find((s) => s.id === 2)!.deaths === 1, 'Slot 2 should now have 1 death');

    // Manual saveGameProgress retains deaths
    saveGameProgress(1, { ...persisted1, ...engine.player, deaths: 2 }, 'O7_7');
    assert(loadAllSaveSlots().find((s) => s.id === 1)!.deaths === 2, 'Manual save preserves slot 1 deaths');

    // Clearing Slot 1 resets its deaths to 0
    clearSaveSlot(1);
    assert(loadAllSaveSlots().find((s) => s.id === 1)!.deaths === 0, 'Cleared slot should reset deaths to 0');
  });

  await test('Auto-potion revival prevents death and does not increment Death Counter', () => {
    storageMap.clear();
    const slot = { ...getDefaultSaveSlots()[0], deaths: 0 };
    saveSlotData(slot);

    const engine = new GameEngine(createMockCanvas());
    engine.loadSaveSlot(slot);
    engine.gameState = GameState.PLAYING;
    engine.player.hearts = 1;
    engine.player.invincibleTimer = 0;
    engine.player.inventory.potionTier = 1;

    (engine as any).damagePlayer(4, Direction.LEFT);

    assert(engine.gameState === GameState.PLAYING, 'Potion should keep player alive in PLAYING state');
    assert(engine.player.deaths === 0, 'Potion revival should not increment deaths');
    assert(loadAllSaveSlots().find((s) => s.id === 1)!.deaths === 0, 'Saved slot deaths should remain 0');
  });

  console.log(`\nAll ${passed} Death Counter tests passed!`);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
