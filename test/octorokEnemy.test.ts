/**
 * Unit Test Suite for OctorokEnemy Subclass
 * Tests random roaming across the screen, obstacle/boundary direction changes,
 * periodic stopping without altering facing direction, firing rock projectiles
 * in the currently facing direction, and damaging the player upon collision.
 */

import { OctorokEnemy, BaseEnemy, RockProjectileData } from '../src/game/octorokEnemy';
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

console.log('--- RUNNING OCTOROK ENEMY SUBCLASS TEST SUITE ---');

// Test 1: Subclass inheritance & variant stats
console.log('\n[Test 1: Subclass Inheritance & Variant Stats]');
const octorok = new OctorokEnemy({
  id: 'octo_test_1',
  type: EnemyType.OCTOROK_RED,
  x: 120,
  y: 80,
});

assert(octorok instanceof OctorokEnemy, 'octorok is an instance of OctorokEnemy');
assert(octorok instanceof BaseEnemy, 'octorok inherits from BaseEnemy');
assert(octorok.health === 2, 'Red Octorok has 2 HP');
assert(octorok.speed === 0.8, 'Red Octorok speed is 0.8');
assert(octorok.rockSpeed === 2.4, 'Red Octorok rock speed is 2.4');

const blueOctorok = new OctorokEnemy({
  id: 'octo_blue_test',
  type: EnemyType.OCTOROK_BLUE,
  x: 120,
  y: 80,
});
assert(blueOctorok.health === 3, 'Blue Octorok has 3 HP');
assert(blueOctorok.speed === 1.0, 'Blue Octorok speed is 1.0');
assert(blueOctorok.rockSpeed === 2.8, 'Blue Octorok rock speed is 2.8');

// Test 2: Random Roaming Initialization & Movement
console.log('\n[Test 2: Random Roaming Movement & Direction Turns]');
assert(octorok.state === 'patrol', 'Initial state is patrol (roaming)');
assert(octorok.stateTimer >= 90, 'Roam timer initialized');
assert(
  [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT].includes(octorok.dir),
  'Initial roaming direction is a valid cardinal direction'
);

const startX = octorok.x;
const startY = octorok.y;
const roamDir = octorok.dir;

const mockPlayer = createMockPlayer({ x: 200, y: 140 });
const noCollision = () => false;

octorok.update(mockPlayer, noCollision, () => {}, () => {});
if (roamDir === Direction.RIGHT) assert(octorok.x > startX, 'Roamed right');
else if (roamDir === Direction.LEFT) assert(octorok.x < startX, 'Roamed left');
else if (roamDir === Direction.DOWN) assert(octorok.y > startY, 'Roamed down');
else if (roamDir === Direction.UP) assert(octorok.y < startY, 'Roamed up');

// Roam turn timer triggers random direction shift while roaming
octorok.roamTurnTimer = 1;
octorok.stateTimer = 50;
const prevDir = octorok.dir;
octorok.update(mockPlayer, noCollision, () => {}, () => {});
assert(octorok.dir !== prevDir, 'Octorok changes to another open random direction when roamTurnTimer expires');

// Obstacle collision during roaming picks an open direction
octorok.x = 120;
octorok.y = 80;
octorok.dir = Direction.LEFT;
octorok.stateTimer = 50;
octorok.roamTurnTimer = 50;
// Block only LEFT movement
const blockLeftCollision = (x: number) => x < 120;
octorok.update(mockPlayer, blockLeftCollision, () => {}, () => {});
assert(octorok.dir !== Direction.LEFT, 'Octorok avoids blocked LEFT direction and picks an open direction');

// Test 3: Stopping Phase Preserves Current Facing Direction
console.log('\n[Test 3: Transition to Stopping State Preserving Facing Direction]');
octorok.dir = Direction.LEFT; // Facing LEFT even though player is to the bottom-right (200, 140)
octorok.stateTimer = 1;
let alertSoundPlayed = false;

octorok.update(
  mockPlayer,
  noCollision,
  () => {},
  () => {},
  {
    playEnemyAlert: () => {
      alertSoundPlayed = true;
    },
  }
);

assert(octorok.state === 'stopping', 'Octorok transitions to stopping state');
assert(octorok.stateTimer > 0, 'Stopping pause timer active');
assert(octorok.dir === Direction.LEFT, 'Octorok preserves its current facing direction (LEFT) when stopping');
assert(octorok.alertTimer! > 0, '8-bit alert telegraph indicator active');
assert(alertSoundPlayed, 'Enemy alert audio played on stopping');

// Verify Octorok stays stationary during stopping state
const stopX = octorok.x;
const stopY = octorok.y;
octorok.update(mockPlayer, noCollision, () => {}, () => {});
assert(octorok.x === stopX && octorok.y === stopY, 'Octorok remains stopped while preparing to fire');

// Test 4: Firing Rock Projectile in Current Facing Direction (All 4 Directions)
console.log('\n[Test 4: Firing Rock Projectile in Current Facing Direction]');
const directions: Array<{
  dir: Direction;
  expectedVx: number;
  expectedVy: number;
}> = [
  { dir: Direction.LEFT, expectedVx: -octorok.rockSpeed, expectedVy: 0 },
  { dir: Direction.RIGHT, expectedVx: octorok.rockSpeed, expectedVy: 0 },
  { dir: Direction.UP, expectedVx: 0, expectedVy: -octorok.rockSpeed },
  { dir: Direction.DOWN, expectedVx: 0, expectedVy: octorok.rockSpeed },
];

for (const tc of directions) {
  octorok.state = 'stopping';
  octorok.dir = tc.dir;
  octorok.stateTimer = 1;

  let rockFired: RockProjectileData | null = null;
  let rockSpitPlayed = false;

  octorok.update(
    mockPlayer,
    noCollision,
    (rock) => {
      rockFired = rock;
    },
    () => {},
    {
      playRockSpit: () => {
        rockSpitPlayed = true;
      },
    }
  );

  assert(rockFired !== null, `Rock fired when facing ${tc.dir}`);
  assert(rockFired!.dir === tc.dir, `Rock projectile dir matches facing ${tc.dir}`);
  assert(
    Math.abs(rockFired!.vx - tc.expectedVx) < 0.001 &&
      Math.abs(rockFired!.vy - tc.expectedVy) < 0.001,
    `Rock velocity (${rockFired!.vx.toFixed(2)}, ${rockFired!.vy.toFixed(2)}) moves strictly along ${tc.dir}`
  );
  assert(rockSpitPlayed, `2A03 rock spit SFX played for ${tc.dir}`);
}

// Test 5: Recoil and Resuming Random Roaming
console.log('\n[Test 5: Recoil Recovery and Next Roam Cycle]');
assert(octorok.state === 'recoil', 'Octorok entered recoil phase after firing');
octorok.stateTimer = 1;
octorok.update(mockPlayer, noCollision, () => {}, () => {});
assert(octorok.state === 'patrol', 'Octorok resumed roaming state after recoil');
assert(octorok.stateTimer >= 90, 'New roam duration timer initialized');

// Test 6: Rock Projectile Collision Damaging Player (Simulated Engine Projectile Step)
console.log('\n[Test 6: Rock Collision Damages Player]');
octorok.state = 'stopping';
octorok.dir = Direction.RIGHT;
octorok.x = 100;
octorok.y = 100;
octorok.stateTimer = 1;

let spawnedRock: RockProjectileData | null = null;
octorok.update(mockPlayer, noCollision, (r) => {
  spawnedRock = r;
}, () => {});

const hitPlayer = createMockPlayer({ x: 124, y: 100, dir: Direction.DOWN, hearts: 6 });
let playerDamaged = false;
let rockActive = true;

// Simulate rock travel until collision check matches engine.ts (dist < 12)
for (let frame = 0; frame < 30 && rockActive; frame++) {
  spawnedRock!.x += spawnedRock!.vx;
  spawnedRock!.y += spawnedRock!.vy;
  if (Math.hypot(hitPlayer.x - spawnedRock!.x, hitPlayer.y - spawnedRock!.y) < 12) {
    hitPlayer.hearts -= 1;
    playerDamaged = true;
    rockActive = false;
  }
}

assert(playerDamaged, 'Fired rock projectile collided with player');
assert(hitPlayer.hearts === 5, 'Player took 1 damage on rock collision (hearts reduced from 6 to 5)');
assert(!rockActive, 'Rock projectile deactivated after hitting player');

// Test 7: Direct Octorok Contact Damage
console.log('\n[Test 7: Octorok Contact Damage]');
const touchingPlayer = createMockPlayer({ x: octorok.x + 4, y: octorok.y + 4 });
let contactDmg = 0;
octorok.update(touchingPlayer, noCollision, () => {}, (dmg) => {
  contactDmg = dmg;
});
assert(contactDmg === 1, 'Octorok contact deals 1 damage to player');

console.log('\n>>> ALL OCTOROK ENEMY SUBCLASS TESTS PASSED SUCCESSFULLY! <<<\n');
