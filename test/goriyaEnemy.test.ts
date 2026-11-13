/**
 * Unit Test Suite for Goriya Enemy Subclass
 * Tests wandering in 4 cardinal directions, wall avoidance,
 * periodic boomerang throw windup, throwing in currently facing direction,
 * and catching returning boomerangs.
 */

import { GoriyaEnemy, BoomerangProjectileData } from '../src/game/goriyaEnemy';
import { BaseEnemy } from '../src/game/octorokEnemy';
import { Direction, EnemyType, ItemType, PlayerState } from '../src/types';

function createMockPlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    x: 100,
    y: 100,
    dir: Direction.UP,
    moving: false,
    isAttacking: false,
    attackTimer: 0,
    animFrame: 0,
    animTimer: 0,
    hearts: 6,
    maxHearts: 6,
    swordTier: 1,
    bItem: ItemType.NONE,
    inventory: {
      hasSword: true,
      hasBoomerang: false,
      hasBow: false,
      hasCandle: false,
      hasCompass: false,
      hasDungeonMap: false,
      rupees: 10,
      bombs: 4,
      keys: 1,
      triforcePieces: 0,
    },
    invincibleTimer: 0,
    knockback: null,
    isHoldingItem: false,
    heldItemType: null,
    heldItemTimer: 0,
    ...overrides,
  };
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

console.log('--- RUNNING GORIYA ENEMY SUBCLASS TEST SUITE ---');

// Test 1: Subclass Inheritance & Properties
console.log('\n[Test 1: Subclass Inheritance & Properties]');
const goriya = new GoriyaEnemy({
  id: 'goriya_test_1',
  x: 120,
  y: 80,
  dir: Direction.DOWN,
});

assert(goriya instanceof GoriyaEnemy, 'goriya is an instance of GoriyaEnemy');
assert(goriya instanceof BaseEnemy, 'goriya inherits from BaseEnemy');
assert(goriya.type === EnemyType.GORIYA_RED, 'EnemyType is GORIYA_RED');
assert(goriya.health === 3, 'Goriya has 3 HP');
assert(goriya.speed === 0.75, 'Goriya speed is 0.75');
assert(goriya.state === 'wander', 'Initial state is wander');
assert(!goriya.hasBoomerangOut, 'Boomerang is initially held in hand');

// Test 2: Wandering Movement in Facing Direction
console.log('\n[Test 2: Wandering Movement]');
const startX = goriya.x;
const startY = goriya.y;
const mockPlayerFar = createMockPlayer({ x: 240, y: 240 });
const noCollision = () => false;

goriya.update(mockPlayerFar, noCollision, () => {}, () => {});
assert(goriya.y > startY, 'Goriya moves down when facing DOWN');

// Test 3: Obstacle Collision Avoidance
console.log('\n[Test 3: Obstacle Collision Avoidance]');
goriya.dir = Direction.LEFT;
const solidTileCollision = () => true;

goriya.update(mockPlayerFar, solidTileCollision, () => {}, () => {});
assert(goriya.dir !== Direction.LEFT, 'Goriya turns away from solid wall collision');

// Test 4: Periodic Boomerang Throw Windup
console.log('\n[Test 4: Boomerang Throw Windup]');
goriya.throwCooldown = 1;
let alertAudioTriggered = false;

goriya.update(
  mockPlayerFar,
  noCollision,
  () => {},
  () => {},
  {
    playEnemyAlert: () => {
      alertAudioTriggered = true;
    },
  }
);

assert(goriya.state === 'windup', 'Goriya transitions to windup state when cooldown expires');
assert(goriya.alertTimer! > 0, '8-bit warning alert spark active');
assert(alertAudioTriggered, 'Alert audio cue triggered for boomerang throw preparation');

// Test 5: Throwing Boomerang along Currently Facing Direction
console.log('\n[Test 5: Throwing Boomerang in Facing Direction]');
goriya.dir = Direction.RIGHT; // Facing right
goriya.stateTimer = 1; // 1 frame left in windup

let spawnedBoomerang: BoomerangProjectileData | null = null;
let boomerangAudioTriggered = false;

goriya.update(
  mockPlayerFar,
  noCollision,
  (b) => {
    spawnedBoomerang = b;
  },
  () => {},
  {
    playBoomerang: () => {
      boomerangAudioTriggered = true;
    },
  }
);

assert(spawnedBoomerang !== null, 'Boomerang projectile spawned upon windup completion');
assert(spawnedBoomerang!.dir === Direction.RIGHT, 'Boomerang thrown along facing direction (RIGHT)');
assert(spawnedBoomerang!.vx > 0, 'Boomerang travels horizontally to the right (vx > 0)');
assert(spawnedBoomerang!.vy === 0, 'Boomerang vertical velocity vy is 0');
assert(spawnedBoomerang!.throwerId === goriya.id, 'Boomerang records Goriya as thrower');
assert(goriya.hasBoomerangOut, 'Goriya marks boomerang as currently in flight');
assert(boomerangAudioTriggered, '2A03 boomerang sound effect triggered');

// Test 6: Holding Off Throws while Boomerang is Airborne
console.log('\n[Test 6: Prevent Multiple Boomerangs while in Flight]');
goriya.state = 'wander';
goriya.throwCooldown = 0; // Cooldown zeroed
goriya.update(mockPlayerFar, noCollision, () => {}, () => {});

assert(goriya.state === 'wander', 'Goriya does not throw another boomerang while one is already airborne');

// Test 7: Catching Returning Boomerang
console.log('\n[Test 7: Catching Returning Boomerang]');
goriya.catchBoomerang();
assert(!goriya.hasBoomerangOut, 'Boomerang caught and back in Goriya hand');
assert(goriya.customData.hasBoomerangOut === false, 'customData.hasBoomerangOut cleared for rendering');

// Test 8: Physical Contact Damage
console.log('\n[Test 8: Physical Contact Damage]');
const nearPlayer = createMockPlayer({ x: goriya.x + 6, y: goriya.y + 6 });
let playerTookDamage = false;

goriya.update(
  nearPlayer,
  noCollision,
  () => {},
  () => {
    playerTookDamage = true;
  }
);

assert(playerTookDamage, 'Player takes contact damage upon touching Goriya');

console.log('\n>>> ALL GORIYA ENEMY SUBCLASS TESTS PASSED SUCCESSFULLY! <<<\n');
