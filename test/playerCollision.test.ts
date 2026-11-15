/**
 * Unit & GameEngine Integration Test Suite for Player Collision,
 * Safe Knockback, Guarded Axis/Doorway Nudging, and Asset Depenetration.
 */

import {
  PLAYER_HITBOX_SIZE,
  applyGuardedNudge,
  canStepToTilePosition,
  checkGridTileCollision,
  findNearestWalkablePosition,
  getSolidTileOverlapArea,
  stepKnockbackSafe,
} from '../src/game/playerCollision';
import { Direction, GameState } from '../src/types';

// Minimal headless browser globals for GameEngine in Node.js
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
    width: 256,
    height: 176,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;
}

function createGrid(overrides: Array<{ row: number; col: number; tile: number }> = []): number[][] {
  const tiles = Array.from({ length: 11 }, () => Array(16).fill(0));
  for (const ov of overrides) {
    if (tiles[ov.row] && tiles[ov.row][ov.col] !== undefined) {
      tiles[ov.row][ov.col] = ov.tile;
    }
  }
  return tiles;
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runTests() {
  console.log('--- RUNNING PLAYER COLLISION & ASSET UNSTUCK TEST SUITE ---');

  // Test 1: Continuous AABB Solid Tile Collision across Walls (2/5), Water (3), Blocks (14)
  console.log('\n[Test 1: Continuous Solid Asset Detection]');
  for (const tileId of [2, 3, 5, 14]) {
    const tiles = createGrid([{ row: 5, col: 5, tile: tileId }]); // x=80..95, y=80..95
    assert(!checkGridTileCollision(tiles, 66, 80, 14, 14), `Tile ${tileId}: flush left x=66 (66..80) does not collide`);
    assert(checkGridTileCollision(tiles, 66.5, 80, 14, 14), `Tile ${tileId}: fractional overhang x=66.5 collides immediately`);
    assert(checkGridTileCollision(tiles, 80, 80, 14, 14), `Tile ${tileId}: inside center x=80,y=80 collides`);
  }

  // Test 2: Knockback Clamps Flush Against Walls, Water, and Blocks
  console.log('\n[Test 2: Safe Knockback Clamping]');
  for (const tileId of [2, 3, 5, 14]) {
    const tiles = createGrid([
      { row: 5, col: 6, tile: tileId }, // Wall/water/block at x=96..111, y=80..95
      { row: 6, col: 6, tile: tileId },
    ]);
    // Link standing at x=78, y=80 knocked RIGHT by +18px (6 frames * 3px)
    let x = 78;
    let y = 80;
    for (let i = 0; i < 6; i++) {
      const res = stepKnockbackSafe(tiles, x, y, 3, 0, 256, 176, 14, 14);
      x = res.x;
      y = res.y;
    }
    assert(
      x === 82 && !checkGridTileCollision(tiles, x, y, 14, 14),
      `Knockback against tile ${tileId} stopped flush at x=${x} without entering asset`
    );
  }

  // Test 3: Guarded Nudge & Overlap-Reducing Walk-Out Escape
  console.log('\n[Test 3: Guarded Nudge & Depenetration Escape]');
  const wallTiles = createGrid([{ row: 5, col: 5, tile: 5 }]); // x=80..95, y=80..95
  const nudged = applyGuardedNudge(wallTiles, 66, 80, 0.5, 0, 256, 176, 14, 14);
  assert(nudged.x === 66, 'Guarded nudge refuses to push Link 0.5px into solid wall');

  // If Link somehow ends up embedded inside a large 3x3 block of water/walls, moving outward is allowed while moving deeper is blocked
  const bigBlockTiles = createGrid([
    { row: 4, col: 4, tile: 3 }, { row: 4, col: 5, tile: 3 }, { row: 4, col: 6, tile: 3 },
    { row: 5, col: 4, tile: 3 }, { row: 5, col: 5, tile: 3 }, { row: 5, col: 6, tile: 3 },
    { row: 6, col: 4, tile: 3 }, { row: 6, col: 5, tile: 3 }, { row: 6, col: 6, tile: 3 },
  ]);
  // Embedded near left edge of block: x=58 (58..72 overlaps 64..72 -> 8px deep)
  const overlapStart = getSolidTileOverlapArea(bigBlockTiles, 58, 80);
  assert(overlapStart > 0, 'Embedded Link has positive solid overlap area');
  assert(
    canStepToTilePosition(bigBlockTiles, 58, 80, 56.5, 80),
    'Stepping LEFT (away from center of block) strictly reduces overlap and is allowed'
  );
  assert(
    !canStepToTilePosition(bigBlockTiles, 58, 80, 59.5, 80),
    'Stepping RIGHT (deeper into block) increases overlap and is blocked'
  );

  const nearestSafe = findNearestWalkablePosition(wallTiles, 76, 80, 256, 176, 14, 14, 16);
  assert(
    nearestSafe !== null && !checkGridTileCollision(wallTiles, nearestSafe.x, nearestSafe.y, 14, 14),
    `Nearest walkable search unstuck embedded Link to (${nearestSafe?.x}, ${nearestSafe?.y})`
  );

  // Test 4: GameEngine End-to-End Tests (Damage Knockback, Walk Into/Out of Assets, & D3_VAULT Entry)
  console.log('\n[Test 4: GameEngine Knockback, Doorway Funnel, & Unstuck Integration]');
  const { GameEngine } = await import('../src/game/engine');
  const { getDefaultSaveSlots } = await import('../src/game/saveSystem');

  const engine = new GameEngine(createMockCanvas());
  engine.loadSaveSlot(getDefaultSaveSlots()[0]);
  engine.fade.active = false;
  engine.fade.opacity = 0;
  engine.fade.phase = 'none';
  engine.gameState = GameState.PLAYING;

  // 4a. Test enemy damage knockback right beside Water pool on O7_7 (water at row 9, cols 11..13 -> x=176..223, y=144..159; col 10 is open ground)
  engine.loadScreen('O7_7', 160, 144);
  engine.enemies = [];
  engine.player.invincibleTimer = 0;
  engine.player.hearts = 6;
  // Simulate hit from LEFT pushing Link RIGHT directly toward water pool at x=176
  (engine as any).damagePlayer(1, Direction.LEFT);
  for (let f = 0; f < 10; f++) {
    (engine as any).updatePhysics();
  }
  assert(
    engine.player.x === 162 &&
      !checkGridTileCollision(engine.currentScreen.tiles, engine.player.x, engine.player.y, 14, 14),
    `Damage knockback next to O7_7 water pool clamped flush at x=${engine.player.x}, y=${engine.player.y}`
  );

  // 4b. Test walking RIGHT into O7_7 rock/water/tree assets, then walking straight back OUT
  for (const testCase of [
    { label: 'Water', x: 156, y: 144, dirIn: 'right' as const, dirOut: 'left' as const },
    { label: 'Rock Wall', x: 42, y: 48, dirIn: 'right' as const, dirOut: 'left' as const },
    { label: 'Tree/Bush Block', x: 140, y: 112, dirIn: 'right' as const, dirOut: 'left' as const },
  ]) {
    engine.player.x = testCase.x;
    engine.player.y = testCase.y;
    engine.player.knockback = { x: 0, y: 0, duration: 0 };

    // Hold toward asset for 20 frames
    engine.input[testCase.dirIn] = true;
    for (let f = 0; f < 20; f++) (engine as any).updatePhysics();
    engine.input[testCase.dirIn] = false;
    assert(
      !checkGridTileCollision(engine.currentScreen.tiles, engine.player.x, engine.player.y, 14, 14),
      `Walking continuously into ${testCase.label} never lets Link inside (${engine.player.x}, ${engine.player.y})`
    );

    const xAtAsset = engine.player.x;
    engine.input[testCase.dirOut] = true;
    for (let f = 0; f < 10; f++) (engine as any).updatePhysics();
    engine.input[testCase.dirOut] = false;
    assert(
      engine.player.x < xAtAsset - 5,
      `Link walks freely back away from ${testCase.label} (${xAtAsset} -> ${engine.player.x})`
    );
  }

  // 4c. Force-embed Link inside a thick solid block (> 16px deep on 3 sides, 10px from left edge) and verify manual walk-out works
  engine.currentScreen = {
    ...engine.currentScreen,
    tiles: createGrid([
      { row: 3, col: 4, tile: 5 }, { row: 3, col: 5, tile: 5 }, { row: 3, col: 6, tile: 5 }, { row: 3, col: 7, tile: 5 },
      { row: 4, col: 4, tile: 5 }, { row: 4, col: 5, tile: 5 }, { row: 4, col: 6, tile: 5 }, { row: 4, col: 7, tile: 5 },
      { row: 5, col: 4, tile: 5 }, { row: 5, col: 5, tile: 5 }, { row: 5, col: 6, tile: 5 }, { row: 5, col: 7, tile: 5 },
      { row: 6, col: 4, tile: 5 }, { row: 6, col: 5, tile: 5 }, { row: 6, col: 6, tile: 5 }, { row: 6, col: 7, tile: 5 },
    ]),
  };
  // Place Link shallowly embedded inside the left edge (x=54 -> overlaps col 4 [64..79] by 4px)
  engine.player.x = 54;
  engine.player.y = 72;
  (engine as any).updatePhysics();
  assert(
    !checkGridTileCollision(engine.currentScreen.tiles, engine.player.x, engine.player.y, 14, 14),
    `Auto-depenetration ejected shallow-embedded Link cleanly to x=${engine.player.x}`
  );

  // Place Link deeply embedded inside a solid wall at x=60 -> holds LEFT to walk out even if >16px from other walls
  engine.player.x = 60; // 10px inside col 4 [64..79]
  engine.player.y = 72;
  engine.input.left = true;
  for (let f = 0; f < 15; f++) (engine as any).updatePhysics();
  engine.input.left = false;
  assert(
    engine.player.x <= 50 && !checkGridTileCollision(engine.currentScreen.tiles, engine.player.x, engine.player.y, 14, 14),
    `Deeply embedded Link walked smoothly back out of wall to x=${engine.player.x}`
  );

  // 4d. Verify D3_2 -> D3_VAULT transition does not spawn Link trapped in wall tile 5
  engine.loadScreen('D3_2', 228, 88);
  engine.enemies = [];
  engine.transitionMode = 'fade';
  engine.input.right = true;
  for (let f = 0; f < 20; f++) {
    (engine as any).updatePhysics();
    if ((engine.gameState as GameState) === GameState.TRANSITIONING) break;
  }
  engine.input.right = false;
  for (let f = 0; f < 60; f++) (engine as any).updatePhysics();
  assert(
    engine.currentScreen.id === 'D3_VAULT' &&
      !checkGridTileCollision(engine.currentScreen.tiles, engine.player.x, engine.player.y, PLAYER_HITBOX_SIZE, PLAYER_HITBOX_SIZE),
    `Transitioning into D3_VAULT spawned Link safely at (${engine.player.x}, ${engine.player.y}) without wall collision`
  );

  console.log('\n>>> ALL PLAYER COLLISION & UNSTUCK TESTS PASSED SUCCESSFULLY! <<<\n');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
