/**
 * Unit Test Suite for Keese Enemy Subclass
 * Tests erratic fluttering patterns, aerial hovering elevation,
 * periodic swoop dives toward the player, and aerial melee contact damage.
 */

import { KeeseEnemy } from '../src/game/keeseEnemy';
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

console.log('--- RUNNING KEESE ENEMY SUBCLASS TEST SUITE ---');

// Test 1: Subclass Inheritance & Properties
console.log('\n[Test 1: Subclass Inheritance & Properties]');
const keese = new KeeseEnemy({
  id: 'keese_test_1',
  x: 120,
  y: 80,
});

assert(keese instanceof KeeseEnemy, 'keese is an instance of KeeseEnemy');
assert(keese instanceof BaseEnemy, 'keese inherits from BaseEnemy');
assert(keese.type === EnemyType.KEESE, 'EnemyType is KEESE');
assert(keese.health === 1, 'Keese has 1 HP (fragile flying bat)');
assert(keese.jumpYOffset > 0, 'Keese is airborne with vertical height elevation');
assert(keese.flightState === 'flutter', 'Initial flight state is flutter');

// Test 2: Erratic Flapping Movement & Wing Flap Animation
console.log('\n[Test 2: Erratic Flapping Flight & Wing Animation]');
const startX = keese.x;
const startY = keese.y;
const mockPlayerFar = createMockPlayer({ x: 240, y: 240 });
const noCollision = () => false;

// Step several frames to observe movement & wing flap
for (let i = 0; i < 10; i++) {
  keese.update(mockPlayerFar, noCollision, () => {});
}

assert(keese.x !== startX || keese.y !== startY, 'Keese moved across the screen in flapping flight');
assert(keese.jumpYOffset >= 3, 'Keese maintains cruising aerial altitude');

// Test 3: Screen Boundary Bounce Avoidance
console.log('\n[Test 3: Boundary Bounce Avoidance]');
keese.x = 224; // At right screen boundary
keese.flightAngle = 0; // heading right

keese.update(mockPlayerFar, noCollision, () => {});
assert(keese.x <= 224, 'Keese stays inside right boundary (does not escape screen)');
assert(keese.flightAngle !== 0, 'Keese bounced / reversed flight angle away from screen edge');

// Test 4: Periodic Aerial Swoop Dive targeting Player
console.log('\n[Test 4: Aerial Swoop Dive targeting Player]');
keese.swoopCooldown = 1; // 1 frame to swoop
keese.x = 100;
keese.y = 50;

// Position player south of Keese
const targetPlayer = createMockPlayer({ x: 100, y: 110 });
let swoopSoundPlayed = false;

keese.update(
  targetPlayer,
  noCollision,
  () => {},
  {
    playKeeseSwoop: () => {
      swoopSoundPlayed = true;
    },
  }
);

assert(keese.flightState === 'swoop', 'Keese transitioned to swoop dive state');
assert(keese.swoopVy > 0, 'Swoop velocity vy is positive (diving south toward player)');
assert(keese.alertTimer! > 0, 'Alert timer active for visual danger warning');
assert(swoopSoundPlayed, '2A03 aerial swoop dive audio cue triggered');

// Test 5: Parabolic Dive Descent & Low Altitude
console.log('\n[Test 5: Altitude Descent During Dive]');
// Midway through swoop dive
keese.stateTimer = Math.floor(keese.totalSwoopDuration / 2);
keese.update(targetPlayer, noCollision, () => {});

assert(
  keese.jumpYOffset < keese.hoverAltitude,
  `Keese swooped down low toward ground/player level (jumpYOffset: ${keese.jumpYOffset.toFixed(2)}px)`
);

// Test 6: Pull-up and Ascending Phase
console.log('\n[Test 6: Pull-up & Ascending Recovery]');
keese.stateTimer = 1; // 1 frame left in swoop
keese.update(targetPlayer, noCollision, () => {});

assert(keese.flightState === 'ascend', 'Keese pulls up and transitions to ascend state');

// Complete ascension
keese.stateTimer = 1;
keese.update(targetPlayer, noCollision, () => {});

assert(keese.flightState === 'flutter', 'Keese resumed erratic flutter flight after ascending');
assert(keese.swoopCooldown > 0, 'Swoop cooldown reset for next periodic attack');

// Test 7: Aerial Melee Contact Damage
console.log('\n[Test 7: Aerial Melee Contact Damage]');
const nearPlayer = createMockPlayer({ x: keese.x + 4, y: keese.y + 4 });
let playerTookDamage = false;

keese.update(
  nearPlayer,
  noCollision,
  () => {
    playerTookDamage = true;
  }
);

assert(playerTookDamage, 'Player takes melee damage when in contact with flying Keese');

console.log('\n>>> ALL KEESE ENEMY SUBCLASS TESTS PASSED SUCCESSFULLY! <<<\n');
