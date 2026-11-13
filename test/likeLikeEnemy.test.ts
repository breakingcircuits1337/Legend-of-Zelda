/**
 * Unit Test Suite for Like Like Enemy Subclass
 * Tests slow stalking pursuit, wall-sliding navigation, shield consumption on
 * collision (both Magical and Wooden shields), persistent shield loss flags,
 * digestion pause recovery, and dungeon placements.
 */

import { LikeLikeEnemy } from '../src/game/likeLikeEnemy';
import { BaseEnemy } from '../src/game/octorokEnemy';
import { SCREEN_D2_2, SCREEN_D3_VAULT } from '../src/game/worldData';
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
    hasShield: true,
    shieldTier: 1,
    hasMagicalShield: false,
    inventory: {
      hasSword: true,
      hasBoomerang: false,
      hasBow: false,
      hasCandle: false,
      hasShield: true,
      hasMagicalShield: false,
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

console.log('--- RUNNING LIKE LIKE ENEMY SUBCLASS TEST SUITE ---');

// Test 1: Subclass Inheritance & Stats
console.log('\n[Test 1: Subclass Inheritance & Properties]');
const likeLike = new LikeLikeEnemy({
  id: 'likelike_test_1',
  x: 60,
  y: 70,
});

assert(likeLike instanceof LikeLikeEnemy, 'likeLike is an instance of LikeLikeEnemy');
assert(likeLike instanceof BaseEnemy, 'likeLike inherits from BaseEnemy');
assert(likeLike.type === EnemyType.LIKE_LIKE, 'EnemyType is LIKE_LIKE');
assert(likeLike.health === 6, 'Like Like has 6 HP');
assert(likeLike.speed === 0.55, 'Like Like creeps slowly (0.55 px/frame)');
assert(likeLike.likeLikeState === 'stalk', 'Initial state is stalk');

// Test 2: Slow Movement Toward Player & Obstacle Sliding
console.log('\n[Test 2: Slow Stalking Pursuit & Obstacle Sliding]');
const noCollision = () => false;
const targetPlayer = createMockPlayer({ x: 160, y: 70 });
const startX = likeLike.x;

for (let i = 0; i < 20; i++) {
  likeLike.update(targetPlayer, noCollision, () => {});
}

const movedDist = likeLike.x - startX;
assert(movedDist > 9 && movedDist < 13, `Like Like moved slowly toward player (${movedDist.toFixed(1)}px in 20 frames)`);
assert((likeLike.dir as Direction) === Direction.RIGHT, 'Like Like faces RIGHT toward player');

// Wall-sliding test around horizontal obstacle
const slideLike = new LikeLikeEnemy({ id: 'likelike_slide', x: 60, y: 60 });
const diagTarget = createMockPlayer({ x: 120, y: 120 });
const blockXOnly = (x: number, y: number) => x > 60 && y <= 60.5;
const beforeSlideY = slideLike.y;
slideLike.update(diagTarget, blockXOnly, () => {});
assert(slideLike.y > beforeSlideY, 'Like Like slides along Y axis when X is blocked');

// Test 3: Consuming Player's Magical Shield on Collision
console.log('\n[Test 3: Consuming Magical Shield on Collision]');
const magicPlayer = createMockPlayer({
  x: 64,
  y: 70,
  hasShield: true,
  shieldTier: 2,
  hasMagicalShield: true,
  inventory: {
    hasSword: true,
    hasBoomerang: false,
    hasBow: false,
    hasCandle: false,
    hasShield: true,
    hasMagicalShield: true,
    hasCompass: false,
    hasDungeonMap: false,
    rupees: 10,
    bombs: 4,
    keys: 1,
    triforcePieces: 0,
  },
});

const engulfLike = new LikeLikeEnemy({ id: 'likelike_magic', x: 60, y: 70 });
let contactDmg = 0;
let eatSoundPlayed = false;
let callbackShieldType: string | null = null;

engulfLike.update(
  magicPlayer,
  noCollision,
  (dmg) => {
    contactDmg += dmg;
  },
  {
    playLikeLikeEat: () => {
      eatSoundPlayed = true;
    },
  },
  undefined,
  (shieldType) => {
    callbackShieldType = shieldType;
  }
);

assert(contactDmg === 1, 'Like Like deals contact damage upon collision');
assert(eatSoundPlayed, '2A03 Like Like eat audio cue played');
assert(callbackShieldType === 'magical', 'Callback reports magical shield consumed');
assert(magicPlayer.hasMagicalShield === false, 'Player Magical Shield removed');
assert(magicPlayer.hasShield === false, 'Player hasShield flag cleared');
assert(magicPlayer.shieldTier === 0, 'Player shieldTier set to 0');
assert(magicPlayer.inventory.hasMagicalShield === false, 'Inventory hasMagicalShield set to false');
assert(magicPlayer.inventory.hasShield === false, 'Inventory hasShield set to false');
assert(!LikeLikeEnemy.playerHasShield(magicPlayer), 'playerHasShield confirms persistent shield loss');
assert((engulfLike.likeLikeState as string) === 'digest', 'Like Like enters digest pause after eating shield');
assert(engulfLike.eatenShieldType === 'magical', 'Like Like records eaten shield type');
assert(engulfLike.shieldsConsumedCount === 1, 'Shield consumption count incremented to 1');

// Test 4: Consuming Wooden Shield & Digest Recovery
console.log('\n[Test 4: Consuming Wooden Shield & Digest Recovery]');
const woodPlayer = createMockPlayer({ x: 82, y: 80 });
const woodLike = new LikeLikeEnemy({ id: 'likelike_wood', x: 80, y: 80 });

woodLike.update(woodPlayer, noCollision, () => {});
assert(woodPlayer.hasShield === false, 'Wooden Shield consumed upon collision');
assert(woodPlayer.shieldTier === 0, 'Wooden Shield tier stripped to 0');
assert(woodLike.eatenShieldType === 'wooden', 'Like Like records wooden shield consumed');

// Advance digest timer back to stalk
const distantTarget = createMockPlayer({ x: 200, y: 80 });
for (let i = 0; i < 50; i++) {
  woodLike.update(distantTarget, noCollision, () => {});
}
assert((woodLike.likeLikeState as string) === 'stalk', 'Like Like resumes stalking after digestion pause');

// Test 5: Dungeon Encounter Placements
console.log('\n[Test 5: Dungeon Encounter Placements]');
assert(
  SCREEN_D2_2.enemies.some((e) => e.type === EnemyType.LIKE_LIKE),
  'Level-2 Armory Vault (D2_2) spawns a Like Like'
);
assert(
  SCREEN_D3_VAULT.enemies.filter((e) => e.type === EnemyType.LIKE_LIKE).length >= 2,
  'Level-3 Red Ring Vault (D3_VAULT) spawns Like Likes'
);

console.log('\n>>> ALL LIKE LIKE ENEMY SUBCLASS TESTS PASSED SUCCESSFULLY! <<<\n');
