/**
 * Unit Test Suite for Wizzrobe Enemy Subclass
 * Tests hidden vanish phase, random screen warping with safe distance & obstacle
 * avoidance, shimmering appear/vanish transitions, targeted magic projectile
 * firing, and materialized contact damage.
 */

import { WizzrobeEnemy, MagicProjectileData } from '../src/game/wizzrobeEnemy';
import { BaseEnemy } from '../src/game/octorokEnemy';
import { Direction, EnemyType, ItemType, PlayerState } from '../src/types';

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

console.log('--- RUNNING WIZZROBE ENEMY SUBCLASS TEST SUITE ---');

// Test 1: Subclass Inheritance & Initial Hidden State
console.log('\n[Test 1: Subclass Inheritance & Initial Hidden State]');
const wizzrobe = new WizzrobeEnemy({
  id: 'wizzrobe_test_1',
  x: 120,
  y: 40,
});

assert(wizzrobe instanceof WizzrobeEnemy, 'wizzrobe is an instance of WizzrobeEnemy');
assert(wizzrobe instanceof BaseEnemy, 'wizzrobe inherits from BaseEnemy');
assert(wizzrobe.type === EnemyType.WIZZROBE_RED, 'EnemyType is WIZZROBE_RED');
assert(wizzrobe.health === 4, 'Wizzrobe has 4 HP');
assert(wizzrobe.wizzrobeState === 'hidden', 'Initial state is hidden');
assert(wizzrobe.isHidden === true, 'Wizzrobe starts hidden in the ether');
assert(wizzrobe.isPhasing === false, 'Wizzrobe is not phasing while hidden');

// Test 2: Hidden Phase Safety (No Contact Damage or Casting While Hidden)
console.log('\n[Test 2: Hidden Phase Safety]');
const noCollision = () => false;
const overlapPlayer = createMockPlayer({ x: wizzrobe.x, y: wizzrobe.y });
let hiddenContact = false;
let firedWhileHidden = false;
wizzrobe.stateTimer = 10;

for (let i = 0; i < 5; i++) {
  wizzrobe.update(
    overlapPlayer,
    noCollision,
    () => {
      firedWhileHidden = true;
    },
    () => {
      hiddenContact = true;
    }
  );
}

assert(!hiddenContact, 'Hidden Wizzrobe does not deal contact damage');
assert(!firedWhileHidden, 'Hidden Wizzrobe does not fire projectiles');

// Test 3: Random Screen Warp & Materialization
console.log('\n[Test 3: Random Screen Warping & Appearing Telegraph]');
const player = createMockPlayer({ x: 120, y: 88 });
wizzrobe.stateTimer = 1;
let warpSoundPlayed = false;

wizzrobe.update(
  player,
  noCollision,
  () => {},
  () => {},
  {
    playWizzrobeWarp: () => {
      warpSoundPlayed = true;
    },
  }
);

assert(wizzrobe.wizzrobeState === 'appearing', 'Wizzrobe transitioned to appearing state');
assert(wizzrobe.isHidden === false, 'Wizzrobe is no longer hidden');
assert(wizzrobe.isPhasing === true, 'Wizzrobe shimmers during warp materialization');
assert(wizzrobe.warpCount === 1, 'Warp count incremented to 1');
assert(warpSoundPlayed, '2A03 Wizzrobe warp sound triggered');
assert(
  Math.hypot(wizzrobe.x - player.x, wizzrobe.y - player.y) >= 40,
  'Wizzrobe warped to a safe distance from Link (>= 40px)'
);

// Test 4: Casting Magic Projectile Toward Player
console.log('\n[Test 4: Solidifying & Firing Magic Wave at Player]');
wizzrobe.x = 64;
wizzrobe.y = 48;
const targetPlayer = createMockPlayer({ x: 160, y: 112 }); // South-east of Wizzrobe

// Complete appearing shimmer
wizzrobe.stateTimer = 1;
wizzrobe.update(targetPlayer, noCollision, () => {}, () => {});

assert((wizzrobe.wizzrobeState as string) === 'casting', 'Wizzrobe solidified into casting state');
assert(wizzrobe.isPhasing === false, 'Phasing shimmer stopped once solidified');

// Complete cast windup to fire magic wave
let spawnedMagic: MagicProjectileData | null = null;
let castSoundPlayed = false;
wizzrobe.castWindupTimer = 1;
wizzrobe.update(
  targetPlayer,
  noCollision,
  (proj) => {
    spawnedMagic = proj;
  },
  () => {},
  {
    playWizzrobeCast: () => {
      castSoundPlayed = true;
    },
  }
);

assert(spawnedMagic !== null, 'Magic projectile fired at player');
assert(spawnedMagic!.vx > 0 && spawnedMagic!.vy > 0, 'Magic wave travels toward south-east player');
assert(spawnedMagic!.damage === 2, 'Wizzrobe magic projectile deals 2 damage');
assert(wizzrobe.hasFiredThisWarp === true, 'Wizzrobe fires once per warp appearance');
assert(castSoundPlayed, '2A03 Wizzrobe magic cast sound played');

// Test 5: Vanishing Back Out of Sight & Re-Warping
console.log('\n[Test 5: Vanishing & Re-Warping Cycle]');
wizzrobe.stateTimer = 1;
wizzrobe.update(targetPlayer, noCollision, () => {}, () => {});

assert((wizzrobe.wizzrobeState as string) === 'vanishing', 'Wizzrobe entered vanishing state after casting');
assert(wizzrobe.isPhasing === true, 'Wizzrobe flickers while disappearing');

wizzrobe.stateTimer = 1;
wizzrobe.update(targetPlayer, noCollision, () => {}, () => {});

assert((wizzrobe.wizzrobeState as string) === 'hidden', 'Wizzrobe disappeared back into hidden state');
assert(wizzrobe.isHidden === true, 'isHidden set back to true after vanishing');
assert(wizzrobe.isPhasing === false, 'Phasing cleared once fully hidden');

// Trigger second warp
wizzrobe.stateTimer = 1;
wizzrobe.update(targetPlayer, noCollision, () => {}, () => {});
assert((wizzrobe.wizzrobeState as string) === 'appearing' && wizzrobe.warpCount === 2, 'Wizzrobe warps again after cooldown');

// Test 6: Materialized Contact Damage
console.log('\n[Test 6: Materialized Contact Damage]');
const solidWizz = new WizzrobeEnemy({
  id: 'wizzrobe_contact',
  x: 100,
  y: 80,
  initialState: 'casting',
});
let contactDmg = 0;
solidWizz.update(
  createMockPlayer({ x: 104, y: 82 }),
  noCollision,
  () => {},
  (dmg) => {
    contactDmg += dmg;
  }
);
assert(contactDmg === 1, 'Materialized Wizzrobe deals contact damage on collision');

console.log('\n>>> ALL WIZZROBE ENEMY SUBCLASS TESTS PASSED SUCCESSFULLY! <<<\n');
