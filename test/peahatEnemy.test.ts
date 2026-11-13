/**
 * Unit Test Suite for Peahat Enemy Subclass
 * Tests stationary rooted invulnerable phase, takeoff & vulnerable flight phase,
 * circular/erratic flight pattern around the player, returning to open ground,
 * and contact damage.
 */

import { PeahatEnemy } from '../src/game/peahatEnemy';
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

console.log('--- RUNNING PEAHAT ENEMY SUBCLASS TEST SUITE ---');

// Test 1: Subclass Inheritance & Initial Rooted State
console.log('\n[Test 1: Subclass Inheritance & Initial Rooted State]');
const peahat = new PeahatEnemy({
  id: 'peahat_test_1',
  x: 70,
  y: 60,
});

assert(peahat instanceof PeahatEnemy, 'peahat is an instance of PeahatEnemy');
assert(peahat instanceof BaseEnemy, 'peahat inherits from BaseEnemy');
assert(peahat.type === EnemyType.PEAHAT, 'EnemyType is PEAHAT');
assert(peahat.health === 2, 'Peahat has 2 HP');
assert(peahat.peahatState === 'rooted', 'Initial state is rooted');
assert(peahat.isFlying === false, 'Peahat is grounded initially');
assert(peahat.isVulnerable === false, 'Peahat is invulnerable while stationary/rooted');
assert(peahat.jumpYOffset === 0, 'Peahat has 0 elevation while rooted');

// Test 2: Stationary Rooted Duration
console.log('\n[Test 2: Stationary Rooted Behavior]');
const noCollision = () => false;
const player = createMockPlayer({ x: 120, y: 88 });
peahat.stateTimer = 15;
const rootedX = peahat.x;
const rootedY = peahat.y;

for (let i = 0; i < 10; i++) {
  peahat.update(player, noCollision, () => {});
}

assert(peahat.peahatState === 'rooted', 'Peahat remains rooted before timer expires');
assert(peahat.x === rootedX && peahat.y === rootedY, 'Rooted Peahat stays stationary on the ground');
assert(peahat.isVulnerable === false, 'Peahat stays protected while rooted');

// Test 3: Takeoff & Vulnerable Flight Phase
console.log('\n[Test 3: Takeoff & Vulnerable Flight Phase]');
peahat.stateTimer = 1;
let spinAudioPlayed = false;

peahat.update(
  player,
  noCollision,
  () => {},
  {
    playPeahatSpin: () => {
      spinAudioPlayed = true;
    },
  }
);

assert(peahat.peahatState === 'flying', 'Peahat transitioned into flying state');
assert(peahat.isFlying === true, 'isFlying set to true during flight');
assert(peahat.isVulnerable === true, 'Peahat becomes vulnerable to attacks during flight phase');
assert(peahat.jumpYOffset > 0, 'Peahat elevates into the air on takeoff');
assert(peahat.flightCount === 1, 'Flight count incremented to 1');
assert(spinAudioPlayed, '2A03 Peahat propeller spin audio cue played');

// Test 4: Circular / Erratic Flight Pattern Around Player
console.log('\n[Test 4: Circular / Erratic Orbit Around Player]');
const initialOrbitAngle = peahat.orbitAngle;
const positions: Array<{ x: number; y: number }> = [];

for (let i = 0; i < 45; i++) {
  peahat.update(player, noCollision, () => {});
  positions.push({ x: peahat.x, y: peahat.y });
}

const angleDelta = Math.abs(peahat.orbitAngle - initialOrbitAngle);
assert(angleDelta > 1.0, `Peahat orbits around player (angle delta: ${angleDelta.toFixed(2)} rad)`);
assert(
  positions.some((p) => p.x !== rootedX || p.y !== rootedY) &&
    positions.every((p) => p.x >= 16 && p.x <= 224 && p.y >= 16 && p.y <= 144),
  'Peahat moves actively around player while staying within screen bounds'
);
assert(peahat.jumpYOffset > 2, 'Peahat maintains airborne height while flying');

// Test 5: Returning to Ground & Re-Rooting
console.log('\n[Test 5: Returning to Ground & Invulnerable Recovery]');
peahat.stateTimer = 1;
peahat.update(player, noCollision, () => {});

assert(peahat.peahatState === 'rooted', 'Peahat returned to the ground after flight');
assert(peahat.isFlying === false, 'isFlying cleared upon landing');
assert(peahat.isVulnerable === false, 'Peahat becomes invulnerable again once rooted');
assert(peahat.jumpYOffset === 0, 'Altitude reset to 0 on landing');

// Test 6: Safe Landing Avoidance Over Obstacles
console.log('\n[Test 6: Avoid Landing on Solid Obstacles]');
const obstaclePeahat = new PeahatEnemy({
  id: 'peahat_obs_test',
  x: 100,
  y: 80,
  initialState: 'flying',
});
obstaclePeahat.stateTimer = 1;
const solidEverywhere = () => true;
obstaclePeahat.update(player, solidEverywhere, () => {});
assert(
  obstaclePeahat.peahatState === 'flying',
  'Peahat delays rooting when hovering directly over a solid obstacle'
);

// Test 7: Contact Damage & Second Flight Cycle
console.log('\n[Test 7: Contact Damage & Subsequent Flight Cycle]');
let contactDamage = 0;
peahat.update(
  createMockPlayer({ x: peahat.x + 3, y: peahat.y }),
  noCollision,
  (dmg) => {
    contactDamage += dmg;
  }
);
assert(contactDamage === 1, 'Peahat deals 1 contact damage on collision');

peahat.stateTimer = 1;
peahat.update(player, noCollision, () => {});
assert(peahat.peahatState === 'flying' && peahat.flightCount === 2, 'Peahat launches second flight cycle');

console.log('\n>>> ALL PEAHAT ENEMY SUBCLASS TESTS PASSED SUCCESSFULLY! <<<\n');
