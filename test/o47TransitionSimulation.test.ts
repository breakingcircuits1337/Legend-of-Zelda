import assert from 'node:assert/strict';

// Minimal headless window timer stub for ChiptuneEngine in Node.js
(globalThis as unknown as { window?: unknown }).window ??= {
  setInterval: () => 0,
  clearInterval: () => {},
  setTimeout,
  clearTimeout,
};

import { GameEngine, SCREEN_WIDTH, SCREEN_HEIGHT } from '../src/game/engine';
import { GameState } from '../src/types';
import { getScreenEntryTriggerVolumes } from '../src/game/entryTriggerDebug';
import { ALL_SCREENS } from '../src/game/worldData';

function createMockCanvas(): HTMLCanvasElement {
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
}

function createPlayingEngine(): GameEngine {
  const engine = new GameEngine(createMockCanvas());
  engine.gameState = GameState.PLAYING;
  return engine;
}

function stepFrames(engine: GameEngine, count: number) {
  for (let i = 0; i < count; i++) {
    (engine as unknown as { updatePhysics: () => void }).updatePhysics();
  }
}

// 1. Walk WEST from O5_7 into O4_7 (4,7) in 'fade' mode
{
  const engine = createPlayingEngine();
  engine.transitionMode = 'fade';
  engine.loadScreen('O5_7', 32, 88);
  engine.enemies = []; // Keep path clear of enemy knockback during deterministic movement test

  const triggers = getScreenEntryTriggerVolumes(engine.currentScreen, ALL_SCREENS);
  const leftTrigger = triggers.find((t) => t.direction === 'left' && t.targetScreenId === 'O4_7');
  assert.ok(leftTrigger, 'O5_7 must map left entry trigger to O4_7');

  engine.input.left = true;
  let triggeredFrame = -1;
  for (let f = 0; f < 60; f++) {
    stepFrames(engine, 1);
    if (engine.gameState === GameState.TRANSITIONING) {
      triggeredFrame = f;
      break;
    }
  }
  engine.input.left = false;

  assert.ok(triggeredFrame >= 0, 'Walking west on O5_7 must trigger transition into O4_7');
  assert.ok(
    engine.player.x <= leftTrigger!.thresholdRect.x + leftTrigger!.thresholdRect.width - 1,
    `Link x=${engine.player.x} must align inside left trigger threshold [0..4]`
  );
  assert.ok(
    engine.player.y + 14 > leftTrigger!.walkableRects[0].y &&
      engine.player.y <
        leftTrigger!.walkableRects[leftTrigger!.walkableRects.length - 1].y +
          leftTrigger!.walkableRects[leftTrigger!.walkableRects.length - 1].height,
    `Link bounding box y=${engine.player.y}..${engine.player.y + 14} must align with walkable doorway`
  );
  assert.equal(engine.fade.targetScreenId, 'O4_7');

  // Step through black-fade transition to completion
  stepFrames(engine, 60);
  assert.equal(engine.gameState, GameState.PLAYING, 'Engine must return to PLAYING after entering O4_7');
  assert.equal(engine.currentScreen.id, 'O4_7', 'Current screen must become O4_7');
  assert.ok(engine.visitedScreens.has('O4_7'), 'visitedScreens must record O4_7');
  assert.ok(engine.visitedScreens.has('4,7'), 'visitedScreens must record 4,7');
  assert.ok(
    engine.player.x >= 12 && engine.player.x <= SCREEN_WIDTH - 28,
    `Spawned Link x=${engine.player.x} in O4_7 must be within safe non-retrigger bounds`
  );
}

// 2. Walk WEST from O5_7 into O4_7 (4,7) slightly off-center (y=76) in 'slide' mode (verifies doorway funnel + slide)
{
  const engine = createPlayingEngine();
  engine.transitionMode = 'slide';
  engine.loadScreen('O5_7', 30, 76);
  engine.enemies = [];

  engine.input.left = true;
  for (let f = 0; f < 80; f++) {
    stepFrames(engine, 1);
    if (engine.gameState === GameState.TRANSITIONING) break;
  }
  engine.input.left = false;

  assert.equal(engine.gameState, GameState.TRANSITIONING, 'Off-center west approach should funnel into O4_7 slide transition');
  assert.equal(engine.transition.targetScreenId, 'O4_7');

  stepFrames(engine, 40);
  assert.equal(engine.gameState, GameState.PLAYING);
  assert.equal(engine.currentScreen.id, 'O4_7');
}

// 3. Walk SOUTH from O4_6 into O4_7 (4,7)
{
  const engine = createPlayingEngine();
  engine.transitionMode = 'fade';
  engine.loadScreen('O4_6', 120, 140);
  engine.enemies = [];

  engine.input.down = true;
  for (let f = 0; f < 40; f++) {
    stepFrames(engine, 1);
    if (engine.gameState === GameState.TRANSITIONING) break;
  }
  engine.input.down = false;

  assert.equal(engine.gameState, GameState.TRANSITIONING, 'Walking south on O4_6 must trigger O4_7 transition');
  assert.equal(engine.fade.targetScreenId, 'O4_7');

  stepFrames(engine, 60);
  assert.equal(engine.gameState, GameState.PLAYING);
  assert.equal(engine.currentScreen.id, 'O4_7');
  assert.equal(engine.player.x, 120);
  assert.equal(engine.player.y, 16);
}

// 4. Verify walking EAST out of O4_7 returns to O5_7 and walking NORTH returns to O4_6
{
  const engine = createPlayingEngine();
  engine.transitionMode = 'fade';
  engine.loadScreen('O4_7', 228, 88);
  engine.enemies = [];

  engine.input.right = true;
  for (let f = 0; f < 30; f++) {
    stepFrames(engine, 1);
    if (engine.gameState === GameState.TRANSITIONING) break;
  }
  engine.input.right = false;
  assert.equal(engine.fade.targetScreenId, 'O5_7', 'Walking east on O4_7 must trigger O5_7');
  stepFrames(engine, 60);
  assert.equal(engine.currentScreen.id, 'O5_7');

  engine.loadScreen('O4_7', 120, 16);
  engine.enemies = [];
  engine.input.up = true;
  for (let f = 0; f < 30; f++) {
    stepFrames(engine, 1);
    if (engine.gameState === GameState.TRANSITIONING) break;
  }
  engine.input.up = false;
  assert.equal(engine.fade.targetScreenId, 'O4_6', 'Walking north on O4_7 must trigger O4_6');
  stepFrames(engine, 60);
  assert.equal(engine.currentScreen.id, 'O4_6');
}

// 5. Verify temporary debug renderer executes without error on O4_7
{
  const engine = createPlayingEngine();
  engine.loadScreen('O4_7', 120, 88);
  engine.showEntryTriggerDebug = true;
  (engine as unknown as { render: () => void }).render();
}

console.log('✓ End-to-end GameEngine O4_7 (4,7) collision & entry trigger simulation passed');
