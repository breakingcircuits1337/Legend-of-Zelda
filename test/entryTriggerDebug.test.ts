import assert from 'node:assert/strict';
import {
  getScreenEntryTriggerVolumes,
  auditAllScreenEntryTriggers,
  extractO47TransitionBoundingBoxes,
  validateTriggerAgainstScreenBoundary,
  computeTriggerWarpPoint,
} from '../src/game/entryTriggerDebug';
import { ALL_SCREENS } from '../src/game/worldData';
import { GameState } from '../src/types';

// 1. Audit every screen in ALL_SCREENS for valid entry/exit trigger volumes
const audits = auditAllScreenEntryTriggers(ALL_SCREENS, {
  logO47Dump: true,
  playerBox: { screenId: 'O5_7', x: 3, y: 88, width: 14, height: 14 },
});
assert.ok(audits.length >= 40, `Expected full world audit, got ${audits.length} screens`);

const broken = audits.filter((a) => !a.isValid);
assert.equal(
  broken.length,
  0,
  `Expected all screens to have valid trigger volumes, found broken: ${broken
    .map((b) => `${b.screenId}(broken=${b.hasBrokenTarget},unmapped=${b.hasUnmappedOpenEdge})`)
    .join(', ')}`
);

// 1b. Verify O4_7 bounding box dump confirms physical alignment with Link's 14x14 hitbox
const o47Dumps = extractO47TransitionBoundingBoxes(audits, {
  screenId: 'O5_7',
  x: 3,
  y: 88,
  width: 14,
  height: 14,
});
const o57WestDump = o47Dumps.find((d) => d.sourceScreenId === 'O5_7' && d.targetScreenId === 'O4_7');
assert.ok(o57WestDump, 'O4_7 dump must include O5_7 -> O4_7 transition');
assert.deepEqual(o57WestDump?.thresholdBoundingBox, {
  xMin: 0,
  yMin: 0,
  xMax: 5,
  yMax: 176,
  width: 5,
  height: 176,
});
assert.deepEqual(o57WestDump?.walkableDoorwayBoundingBox, {
  xMin: 0,
  yMin: 80,
  xMax: 16,
  yMax: 112,
  width: 16,
  height: 32,
});
assert.deepEqual(o57WestDump?.linkCrossingRange, {
  xRange: [0, 4],
  yRange: [80, 98],
  linkHitboxSize: '14x14',
});
assert.equal(o57WestDump?.liveLinkAlignment?.aligned, true, 'Link at (3,88) on O5_7 must align cleanly with O4_7 trigger volume');

// 2. Verify O5_7 -> O4_7 (4,7) left-edge trigger volume & walkable doorway
const o57Triggers = getScreenEntryTriggerVolumes(ALL_SCREENS['O5_7'], ALL_SCREENS);
const leftTo47 = o57Triggers.find((t) => t.direction === 'left' && t.targetScreenId === 'O4_7');
assert.ok(leftTo47, 'O5_7 must expose a left-edge trigger volume mapped to O4_7');
assert.equal(leftTo47?.targetExists, true, 'O4_7 target must exist');
assert.equal(leftTo47?.isReachable, true, 'O5_7 -> O4_7 doorway must have walkable tiles');
assert.deepEqual(leftTo47?.thresholdRect, { x: 0, y: 0, width: 5, height: 176 });
assert.ok(
  leftTo47!.walkableRects.length >= 2,
  'O5_7 west doorway should have at least rows 5 & 6 walkable'
);

// 3. Verify O4_7 (4,7) has valid return right-edge (O5_7) and north-edge (O4_6) trigger volumes
const o47Triggers = getScreenEntryTriggerVolumes(ALL_SCREENS['O4_7'], ALL_SCREENS);
const rightTo57 = o47Triggers.find((t) => t.direction === 'right' && t.targetScreenId === 'O5_7');
const upTo46 = o47Triggers.find((t) => t.direction === 'up' && t.targetScreenId === 'O4_6');
assert.ok(rightTo57 && rightTo57.targetExists && rightTo57.isReachable, 'O4_7 right trigger -> O5_7 must be valid');
assert.ok(upTo46 && upTo46.targetExists && upTo46.isReachable, 'O4_7 up trigger -> O4_6 must be valid');

// 4. Verify cave & secret entry triggers on O7_7
const o77Triggers = getScreenEntryTriggerVolumes(ALL_SCREENS['O7_7'], ALL_SCREENS);
const caveStart = o77Triggers.find((t) => t.kind === 'cave_entry' && t.targetScreenId === 'C_START');
const bushSecret = o77Triggers.find((t) => t.kind === 'secret_entry');
assert.ok(caveStart, 'O7_7 must expose cave entry trigger volume for C_START');
assert.ok(bushSecret && bushSecret.isRevealed === false, 'O7_7 bush secret should initially report hidden');

const o77RevealedTriggers = getScreenEntryTriggerVolumes(
  ALL_SCREENS['O7_7'],
  ALL_SCREENS,
  new Set(['secret_o7_7_bush_stairs'])
);
const revealedSecret = o77RevealedTriggers.find((t) => t.kind === 'secret_entry');
assert.equal(revealedSecret?.isRevealed, true, 'Revealed secret trigger should switch to active state');

// 5. Verify expectedDirections orientation metadata for directional triggers
assert.deepEqual(leftTo47?.expectedDirections, ['left'], 'O5_7 -> O4_7 trigger should expect LEFT movement');
assert.deepEqual(rightTo57?.expectedDirections, ['right'], 'O4_7 -> O5_7 trigger should expect RIGHT movement');
assert.deepEqual(upTo46?.expectedDirections, ['up'], 'O4_7 -> O4_6 trigger should expect UP movement');
assert.deepEqual(caveStart?.expectedDirections, ['up'], 'Cave entry trigger should expect UP movement');

const o46Triggers = getScreenEntryTriggerVolumes(ALL_SCREENS['O4_6'], ALL_SCREENS);
const downTo47 = o46Triggers.find((t) => t.direction === 'down' && t.targetScreenId === 'O4_7');
assert.deepEqual(downTo47?.expectedDirections, ['down'], 'O4_6 -> O4_7 trigger should expect DOWN movement');

for (const audit of audits) {
  for (const trig of audit.triggers) {
    assert.ok(
      trig.expectedDirections.length >= 1 &&
        trig.expectedDirections.every((d) => d === 'up' || d === 'down' || d === 'left' || d === 'right'),
      `Trigger ${audit.screenId}:${trig.id} must define valid expectedDirections`
    );
  }
}

// 6. Dry-run boundary & dead-zone validation tests
const o57LeftValidation = validateTriggerAgainstScreenBoundary(leftTo47!, ALL_SCREENS['O5_7']);
assert.equal(o57LeftValidation.withinScreenBounds, true, 'O5_7 -> O4_7 should fit within 256x176 screen bounds');
assert.equal(o57LeftValidation.touchesExpectedBoundary, true, 'O5_7 -> O4_7 should touch x=0 boundary');
assert.equal(o57LeftValidation.hasWalkableOverlap, true, 'O5_7 -> O4_7 should overlap walkable doorway');
assert.equal(o57LeftValidation.hasHitboxClearance, true, 'O5_7 -> O4_7 doorway should clear 14x14 hitbox');
assert.equal(o57LeftValidation.deadZoneRects.length, 0, 'O5_7 -> O4_7 should have zero critical dead-zones');
assert.ok(o57LeftValidation.solidOverlapRects.length > 0, 'O5_7 -> O4_7 should flag solid border wall overlaps along edge threshold');
assert.deepEqual(o57LeftValidation.validEntryRects, [{ x: 0, y: 80, width: 5, height: 32 }]);

const caveValidation = validateTriggerAgainstScreenBoundary(caveStart!, ALL_SCREENS['O7_7']);
assert.equal(caveValidation.status, 'PASS', 'O7_7 cave trigger should pass cleanly with zero solid overlaps');
assert.equal(caveValidation.deadZoneRects.length, 0);
assert.equal(caveValidation.solidOverlapRects.length, 0);

// Synthetic out-of-bounds / unreachable right-edge gap should FAIL with dead-zones flagged
const brokenRightTrigger = {
  ...rightTo57!,
  thresholdRect: { x: 248, y: 0, width: 12, height: 176 },
};
const brokenValidation = validateTriggerAgainstScreenBoundary(brokenRightTrigger, ALL_SCREENS['O4_7']);
assert.equal(brokenValidation.status, 'FAIL', 'Out-of-bounds & >242 right-edge trigger must fail validation');
assert.equal(brokenValidation.withinScreenBounds, false);
assert.equal(brokenValidation.touchesExpectedBoundary, false);
assert.ok(brokenValidation.deadZoneRects.length >= 2, 'Should flag both out-of-bounds and 14px clamp gap dead-zones');

// 7. Warp-to-Screen coordinate computation across all screens' active triggers
for (const audit of audits) {
  const screen = ALL_SCREENS[audit.screenId];
  for (const trig of audit.triggers) {
    if (!trig.isRevealed || !trig.isReachable || trig.walkableRects.length === 0) continue;
    const warp = computeTriggerWarpPoint(trig, screen);
    assert.equal(
      warp.canTeleport,
      true,
      `Expected computeTriggerWarpPoint to succeed for ${audit.screenId}:${trig.id} (${warp.reason})`
    );
    assert.ok(
      warp.x >= 0 && warp.x <= 242 && warp.y >= 0 && warp.y <= 162,
      `Warp coords (${warp.x}, ${warp.y}) for ${audit.screenId}:${trig.id} must fit 256x176 for 14x14 hitbox`
    );
  }
}

// Hidden secret trigger should refuse teleportation while hidden
const hiddenWarp = computeTriggerWarpPoint(bushSecret!, ALL_SCREENS['O7_7']);
assert.equal(hiddenWarp.canTeleport, false, 'Unrevealed secret should not be warpable');

// 8. Headless GameEngine.warpToTriggerVolume() integration tests
async function runWarpIntegrationTests() {
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

  const stepPhysicsFrames = (engine: InstanceType<typeof GameEngine>, frames: number) => {
    for (let i = 0; i < frames; i++) {
      (engine as unknown as { updatePhysics: () => void }).updatePhysics();
    }
  };

  // 8a. Warp from O5_7 -> O4_7 via left-edge trigger without walking
  const engine = new GameEngine(createMockCanvas());
  engine.transitionMode = 'fade';
  engine.gameState = GameState.PLAYING;
  engine.loadScreen('O5_7', 120, 88);

  const warpRes1 = engine.warpToTriggerVolume('edge_left');
  assert.equal(warpRes1.ok, true);
  assert.equal(warpRes1.targetScreenId, 'O4_7');
  assert.equal(warpRes1.transitionStarted, true, 'Warping onto O5_7 left trigger must initiate transition immediately');
  stepPhysicsFrames(engine, 120);
  assert.equal(engine.currentScreen.id, 'O4_7', 'Engine must arrive on O4_7 after warp transition completes');
  assert.equal(
    (engine as unknown as { checkTileCollision: (x: number, y: number, w: number, h: number) => boolean }).checkTileCollision(
      engine.player.x,
      engine.player.y,
      14,
      14
    ),
    false,
    'Link must not be stuck in solid tiles after warping to O4_7'
  );

  // 8b. Warp from O4_7 -> O4_6 via top-edge trigger while game was in INVENTORY_PAUSE state
  engine.gameState = GameState.INVENTORY_PAUSE;
  const warpRes2 = engine.warpToTriggerVolume('edge_up');
  assert.equal(warpRes2.ok, true);
  assert.equal(warpRes2.targetScreenId, 'O4_6');
  assert.equal(warpRes2.transitionStarted, true);
  stepPhysicsFrames(engine, 120);
  assert.equal(engine.currentScreen.id, 'O4_6', 'Engine must arrive on O4_6 after warp');

  // 8c. Warp from O7_7 -> C_START via cave entry trigger
  engine.loadScreen('O7_7', 120, 120);
  engine.gameState = GameState.PLAYING;
  const caveWarp = engine.warpToTriggerVolume(caveStart!.id);
  assert.equal(caveWarp.ok, true);
  assert.equal(caveWarp.targetScreenId, 'C_START');
  assert.equal(caveWarp.transitionStarted, true);
  stepPhysicsFrames(engine, 120);
  assert.equal(engine.currentScreen.id, 'C_START', 'Engine must arrive inside C_START after cave trigger warp');

  // 8d. Unknown trigger returns clean ok=false error
  const badWarp = engine.warpToTriggerVolume('nonexistent_trigger');
  assert.equal(badWarp.ok, false);
  assert.equal(badWarp.transitionStarted, false);
}

runWarpIntegrationTests()
  .then(() => {
    console.log(
      `✓ Entry Trigger Debug tests passed across all ${audits.length} screens (including O4_7 [4,7], dry-run dead-zones & Warp-to-Screen)`
    );
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

