/**
 * Unit Test Suite for Leever Enemy Subclass
 * Tests periodic emergence from underground, straight-line traversal across the screen,
 * obstacle/boundary burrowing, disappearing back underground, and contact damage.
 */

import { LeeverEnemy } from '../src/game/leeverEnemy';
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

console.log('--- RUNNING LEEVER ENEMY SUBCLASS TEST SUITE ---');

// Test 1: Subclass Inheritance & Initial Submerged State
console.log('\n[Test 1: Subclass Inheritance & Initial Submerged State]');
const leever = new LeeverEnemy({
  id: 'leever_test_1',
  x: 100,
  y: 80,
});

assert(leever instanceof LeeverEnemy, 'leever is an instance of LeeverEnemy');
assert(leever instanceof BaseEnemy, 'leever inherits from BaseEnemy');
assert(leever.type === EnemyType.LEEVER_RED, 'EnemyType is LEEVER_RED');
assert(leever.health === 2, 'Leever has 2 HP');
assert(leever.leeverState === 'submerged', 'Initial state is submerged');
assert(leever.isSubmerged === true, 'Leever starts submerged underground');
assert(leever.isBurrowing === false, 'Leever is not showing dirt mound while fully submerged');

// Test 2: Underground Phase Does Not Move or Deal Contact Damage
console.log('\n[Test 2: Submerged Phase Safety & Immobility]');
const noCollision = () => false;
const overlapPlayer = createMockPlayer({ x: leever.x, y: leever.y });
let submergedDamageDealt = false;
leever.stateTimer = 10;

for (let i = 0; i < 5; i++) {
  leever.update(
    overlapPlayer,
    noCollision,
    () => {
      submergedDamageDealt = true;
    }
  );
}

assert(!submergedDamageDealt, 'Submerged Leever does not deal contact damage while underground');
assert(leever.x === 100 && leever.y === 80, 'Submerged Leever stays stationary until emerging');

// Test 3: Periodic Emergence from Ground
console.log('\n[Test 3: Periodic Emergence from Ground]');
const farPlayer = createMockPlayer({ x: 128, y: 88 });
leever.stateTimer = 1;
let emergedAudioPlayed = false;

leever.update(
  farPlayer,
  noCollision,
  () => {},
  {
    playLeeverEmerge: () => {
      emergedAudioPlayed = true;
    },
  }
);

assert(leever.leeverState === 'emerging', 'Leever transitioned to emerging state');
assert(leever.isBurrowing === true, 'Leever shows emerging dirt mound sprite');
assert(leever.isSubmerged === false, 'Leever is no longer submerged');
assert(leever.emergeCount === 1, 'Emerge counter incremented to 1');
assert(leever.alertTimer! > 0, 'Visual alert telegraph triggered on emergence');
assert(emergedAudioPlayed, '2A03 Leever emerge audio cue played');
assert(
  Math.hypot(leever.x - farPlayer.x, leever.y - farPlayer.y) >= 32,
  'Leever emerged at a fair distance away from Link (>= 32px)'
);

// Test 4: Straight-Line Traversal Across Screen
console.log('\n[Test 4: Straight-Line Traversal Across Screen]');
// Finish emerging
leever.stateTimer = 1;
leever.update(farPlayer, noCollision, () => {});

assert(leever.leeverState === 'moving', 'Leever transitioned to surfaced moving state');
assert(leever.isBurrowing === false, 'Leever shows full surfaced rotating flower sprite');

// Lock onto a deterministic horizontal straight line inside open room
leever.x = 60;
leever.y = 60;
leever.dir = Direction.RIGHT;
leever.stateTimer = 40;
const initialDir = leever.dir;
const startX = leever.x;
const startY = leever.y;

for (let i = 0; i < 15; i++) {
  leever.update(createMockPlayer({ x: 220, y: 140 }), noCollision, () => {});
}

assert(leever.dir === initialDir, 'Leever maintains straight-line direction during traversal');
assert(leever.y === startY, 'Leever does not veer vertically during horizontal straight-line run');
assert(
  Math.abs(leever.x - (startX + leever.speed * 15)) < 0.001,
  'Leever traveled straight across the screen at exact speed'
);

// Test 5: Disappearing Back into Ground on Timer Expiration
console.log('\n[Test 5: Burrowing Back into Ground on Traversal Completion]');
leever.stateTimer = 1;
let burrowAudioPlayed = false;

leever.update(
  createMockPlayer({ x: 220, y: 140 }),
  noCollision,
  () => {},
  {
    playLeeverBurrow: () => {
      burrowAudioPlayed = true;
    },
  }
);

assert(leever.leeverState === 'burrowing', 'Leever entered burrowing state at end of straight pass');
assert(leever.isBurrowing === true, 'Leever shows sinking dirt mound while burrowing');
assert(burrowAudioPlayed, '2A03 Leever burrow audio cue played');

// Finish burrowing sink animation
leever.stateTimer = 1;
leever.update(createMockPlayer({ x: 220, y: 140 }), noCollision, () => {});

assert(leever.leeverState === 'submerged', 'Leever disappeared completely back underground');
assert(leever.isSubmerged === true, 'isSubmerged flag set back to true');
assert(leever.isBurrowing === false, 'Dirt mound cleared once fully submerged');
assert(leever.stateTimer > 0, 'Submerged cooldown initialized for next emergence cycle');

// Test 6: Burrowing Upon Hitting Screen Edge or Solid Obstacle
console.log('\n[Test 6: Burrowing on Solid Obstacle / Boundary]');
const wallLeever = new LeeverEnemy({
  id: 'leever_wall_test',
  x: 100,
  y: 60,
  dir: Direction.RIGHT,
  initialState: 'moving',
});
wallLeever.stateTimer = 100;

const wallAtX105 = (x: number) => x >= 101;
wallLeever.update(createMockPlayer({ x: 20, y: 20 }), wallAtX105, () => {});

assert(
  wallLeever.leeverState === 'burrowing',
  'Leever disappears back into the ground upon encountering a solid obstacle'
);

const edgeLeever = new LeeverEnemy({
  id: 'leever_edge_test',
  x: 224,
  y: 60,
  dir: Direction.RIGHT,
  initialState: 'moving',
});
edgeLeever.stateTimer = 100;
edgeLeever.update(createMockPlayer({ x: 20, y: 20 }), noCollision, () => {});

assert(
  edgeLeever.leeverState === 'burrowing',
  'Leever disappears back into the ground upon reaching screen boundary'
);

// Test 7: Surfaced Contact Damage & Re-Emergence Cycle
console.log('\n[Test 7: Surfaced Contact Damage & Periodic Re-Emergence]');
const activeLeever = new LeeverEnemy({
  id: 'leever_dmg_test',
  x: 80,
  y: 80,
  dir: Direction.RIGHT,
  initialState: 'moving',
});
let damageReceived = 0;
activeLeever.update(
  createMockPlayer({ x: 85, y: 80 }),
  noCollision,
  (dmg) => {
    damageReceived += dmg;
  }
);

assert(damageReceived === 1, 'Surfaced moving Leever deals 1 contact damage to Link');

// Verify second emergence cycle triggers after submerged cooldown expires
leever.stateTimer = 1;
leever.update(farPlayer, noCollision, () => {});
assert(leever.leeverState === 'emerging', 'Leever periodically re-emerges for subsequent traversal');
assert(leever.emergeCount === 2, 'Emerge count incremented to 2 on second cycle');

console.log('\n>>> ALL LEEVER ENEMY SUBCLASS TESTS PASSED SUCCESSFULLY! <<<\n');
