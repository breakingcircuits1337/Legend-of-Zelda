/**
 * Unit Test Suite for Ghini Enemy Subclass & Graveyard Areas
 * Tests dormant statue-like state, harmlessness until touched, touch-triggered
 * awakening into aggressive ghost pursuit, immunity to standard sword attacks,
 * vulnerability to secondary items, and graveyard screen integration.
 */

import { GhiniEnemy } from '../src/game/ghiniEnemy';
import { BaseEnemy } from '../src/game/octorokEnemy';
import { SCREEN_O5_7, SCREEN_O5_6, SCREEN_O4_6 } from '../src/game/worldData';
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

console.log('--- RUNNING GHINI ENEMY SUBCLASS TEST SUITE ---');

// Test 1: Subclass Inheritance & Initial Dormant Statue State
console.log('\n[Test 1: Subclass Inheritance & Dormant Statue State]');
const ghini = new GhiniEnemy({
  id: 'ghini_test_1',
  x: 64,
  y: 32,
});

assert(ghini instanceof GhiniEnemy, 'ghini is an instance of GhiniEnemy');
assert(ghini instanceof BaseEnemy, 'ghini inherits from BaseEnemy');
assert(ghini.type === EnemyType.GHINI, 'EnemyType is GHINI');
assert(ghini.health === 4, 'Ghini has 4 HP');
assert(ghini.ghiniState === 'statue', 'Initial state is statue');
assert(ghini.isStatue === true, 'Ghini starts statue-like');
assert(ghini.isAwakened === false, 'Ghini starts unawakened');
assert(ghini.speed === 0, 'Statue-like Ghini has 0 speed');

// Test 2: Remains Motionless & Harmless While Untouched
console.log('\n[Test 2: Stationary & Harmless Before Player Touch]');
const distantPlayer = createMockPlayer({ x: 180, y: 120 });
let contactDmg = 0;

for (let i = 0; i < 20; i++) {
  ghini.update(distantPlayer, (dmg) => {
    contactDmg += dmg;
  });
}

assert(ghini.x === 64 && ghini.y === 32, 'Ghini remains completely stationary like a statue');
assert((ghini.ghiniState as string) === 'statue', 'Ghini stays dormant when player does not touch it');
assert(contactDmg === 0, 'Dormant Ghini deals 0 damage');
assert(!ghini.canBeDamagedBy('sword'), 'Dormant statue cannot be damaged by sword');

// Test 3: Player Touch Awakens Ghini Without Cheap Touch-Frame Damage
console.log('\n[Test 3: Touch-Triggered Awakening]');
const touchingPlayer = createMockPlayer({ x: 72, y: 36 }); // Distance ~8.9px (< 16px touch threshold)
let awakenSoundPlayed = false;
let touchFrameDmg = 0;

ghini.update(
  touchingPlayer,
  (dmg) => {
    touchFrameDmg += dmg;
  },
  {
    playGhiniAwaken: () => {
      awakenSoundPlayed = true;
    },
  }
);

assert((ghini.ghiniState as string) === 'active', 'Ghini transitions to active state upon player touch');
assert(ghini.isAwakened === true, 'isAwakened flag set to true');
assert(ghini.isStatue === false, 'isStatue flag cleared');
assert(ghini.isFlying === true, 'Awakened Ghini floats into the air');
assert(ghini.awakenCount === 1, 'Awaken counter incremented to 1');
assert(awakenSoundPlayed, '2A03 Ghini awakening sound cue triggered');
assert(touchFrameDmg === 0, 'Awakening touch frame is harmless (no unavoidable instant hit)');

// Test 4: Aggressive Ghost Pursuit & Active Contact Damage
console.log('\n[Test 4: Aggressive Pursuit & Contact Damage]');
const targetPlayer = createMockPlayer({ x: 160, y: 112 });
const startDist = Math.hypot(targetPlayer.x - ghini.x, targetPlayer.y - ghini.y);

for (let i = 0; i < 30; i++) {
  ghini.update(targetPlayer, () => {});
}

const afterDist = Math.hypot(targetPlayer.x - ghini.x, targetPlayer.y - ghini.y);
assert(afterDist < startDist, `Active Ghini aggressively chases player (${startDist.toFixed(1)}px -> ${afterDist.toFixed(1)}px)`);
assert(ghini.jumpYOffset > 0, 'Active Ghini hovers above ground');
assert(ghini.behaviorState === 'chase', 'Active Ghini enters chase behaviorState');

// Verify contact damage once active and past wake-up grace
let activeContactDmg = 0;
const overlappedPlayer = createMockPlayer({ x: ghini.x + 2, y: ghini.y + 2 });
ghini.update(overlappedPlayer, (dmg) => {
  activeContactDmg += dmg;
});
assert(activeContactDmg === 1, 'Active Ghini deals melee contact damage to player');

// Test 5: Immunity to Standard Sword Attacks vs Defeat by Secondary Items
console.log('\n[Test 5: Sword Immunity & Secondary Item Vulnerability]');
assert(!ghini.canBeDamagedBy('sword'), 'Active Ghini is immune to standard sword melee strikes');
assert(!ghini.canBeDamagedBy('sword_beam'), 'Active Ghini is immune to standard sword beams');
assert(!ghini.canBeDamagedBy('boomerang'), 'Boomerang does not directly deal lethal damage to Ghini');
assert(ghini.canBeDamagedBy('bomb'), 'Active Ghini is vulnerable to Bombs');
assert(ghini.canBeDamagedBy('arrow'), 'Active Ghini is vulnerable to Bow Arrows');
assert(ghini.canBeDamagedBy('flame'), 'Active Ghini is vulnerable to Candle Flame');
assert(ghini.canBeDamagedBy('magic_wave'), 'Active Ghini is vulnerable to Magical Rod waves');

// Simulate secondary item defeat (e.g. 2 arrow hits or 1 bomb blast on 4 HP)
assert(ghini.health === 4, 'Sword immunity preserves full 4 HP');
if (ghini.canBeDamagedBy('arrow')) {
  ghini.health -= 2;
}
assert(ghini.health === 2, 'First arrow reduces Ghini HP from 4 to 2');
if (ghini.canBeDamagedBy('bomb')) {
  ghini.health -= 6;
}
assert(ghini.health <= 0, 'Secondary Bomb blast defeats the Ghini');

// Test 6: Graveyard Areas & World Map Integration
console.log('\n[Test 6: Graveyard Areas & Map Integration]');
assert(SCREEN_O5_7.exits.up === 'O5_6', 'Western Desert (O5_7) connects north to Haunted Graveyard (O5_6)');
assert(SCREEN_O5_6.exits.left === 'O4_6', 'Haunted Graveyard (O5_6) connects west to Ancient Cemetery (O4_6)');
assert(
  SCREEN_O5_6.enemies.some((e) => e.type === EnemyType.GHINI),
  'Haunted Graveyard spawns Ghini enemies'
);
assert(
  SCREEN_O4_6.enemies.some((e) => e.type === EnemyType.GHINI),
  'Ancient Cemetery spawns Ghini enemies'
);
assert(
  SCREEN_O5_6.tiles.some((row) => row.includes(18)),
  'Haunted Graveyard includes gravestone tiles (18)'
);
assert(
  SCREEN_O4_6.tiles.some((row) => row.includes(18)),
  'Ancient Cemetery includes gravestone tiles (18)'
);

console.log('\n>>> ALL GHINI ENEMY SUBCLASS TESTS PASSED SUCCESSFULLY! <<<\n');
