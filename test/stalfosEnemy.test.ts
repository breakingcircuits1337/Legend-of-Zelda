/**
 * Unit Test Suite for Stalfos Enemy Subclass
 * Tests predictable rhythmic grid-based marching, periodic horizontal/vertical
 * axis shifting, periodic parabolic grid jumps, obstacle containment, and
 * dungeon melee contact damage.
 */

import { StalfosEnemy } from '../src/game/stalfosEnemy';
import { BaseEnemy } from '../src/game/octorokEnemy';
import { Direction, EnemyType, ItemType, PlayerState } from '../src/types';

function createMockPlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    x: 160,
    y: 128,
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

console.log('--- RUNNING STALFOS ENEMY SUBCLASS TEST SUITE ---');

// Test 1: Subclass Inheritance & Grid Properties
console.log('\n[Test 1: Subclass Inheritance & Grid Properties]');
const stalfos = new StalfosEnemy({
  id: 'stalfos_test_1',
  x: 64,
  y: 64,
  dir: Direction.RIGHT,
});

assert(stalfos instanceof StalfosEnemy, 'stalfos is an instance of StalfosEnemy');
assert(stalfos instanceof BaseEnemy, 'stalfos inherits from BaseEnemy');
assert(stalfos.type === EnemyType.STALFOS, 'EnemyType is STALFOS');
assert(stalfos.health === 2, 'Stalfos has 2 HP');
assert(stalfos.gridSize === 16, 'Stalfos moves on 16px dungeon tile grid');
assert(stalfos.stalfosState === 'pause', 'Stalfos initializes on rhythmic beat pause');

// Test 2: Rhythmic 16px Grid March (Strict Horizontal/Vertical Step)
console.log('\n[Test 2: Rhythmic Grid March Step]');
const noCollision = () => false;
const playerSE = createMockPlayer({ x: 160, y: 128 });
stalfos.pauseTimer = 1;
stalfos.beatCount = 0; // Beat 1 -> march

stalfos.update(playerSE, noCollision, () => {});
assert(stalfos.stalfosState === 'march', 'Beat 1 transitions Stalfos into grid march');
assert(stalfos.beatCount === 1, 'Beat count incremented to 1');

const marchStartX = stalfos.x;
const marchStartY = stalfos.y;
for (let i = 0; i < 16; i++) {
  stalfos.update(playerSE, noCollision, () => {});
}

assert(stalfos.x === marchStartX + 16, 'Stalfos marched exactly 16px horizontally along grid');
assert(stalfos.y === marchStartY, 'Stalfos did not drift vertically during horizontal march');
assert(stalfos.stalfosState === 'pause', 'Stalfos enters rhythmic beat pause after completing grid tile');

// Test 3: Predictable Horizontal <-> Vertical Axis Shift
console.log('\n[Test 3: Predictable Horizontal <-> Vertical Axis Shift]');
// Beat 2 marches second tile east
stalfos.pauseTimer = 1;
stalfos.update(playerSE, noCollision, () => {});
for (let i = 0; i < 16; i++) {
  stalfos.update(playerSE, noCollision, () => {});
}
assert(stalfos.stepsInDirection === 2, 'Completed 2 grid steps horizontally');

// Beat 3 hits maxStepsBeforeShift (2) AND beatCount === 3 -> shifts vertically toward playerSE and jumps!
stalfos.pauseTimer = 1;
let jumpAudioPlayed = false;
stalfos.update(
  playerSE,
  noCollision,
  () => {},
  {
    playStalfosJump: () => {
      jumpAudioPlayed = true;
    },
  }
);

assert((stalfos.dir as Direction) === Direction.DOWN, 'Stalfos predictably shifted from horizontal to vertical DOWN toward player row');
assert(stalfos.stalfosState === 'jump', 'Beat 3 triggers rhythmic grid jump');
assert(jumpAudioPlayed, '2A03 Stalfos jump sound triggered');
assert(stalfos.jumpVx === 0 && stalfos.jumpVy > 0, 'Grid jump travels strictly along vertical axis');

// Test 4: Parabolic Jump Arc & 2-Tile Grid Displacement
console.log('\n[Test 4: Parabolic Grid Jump & Landing]');
const preJumpX = stalfos.x;
const preJumpY = stalfos.y;

// Step halfway through jump
for (let i = 0; i < 8; i++) {
  stalfos.update(playerSE, noCollision, () => {});
}
assert(stalfos.jumpYOffset > 4, `Parabolic airborne arc active (jumpYOffset: ${stalfos.jumpYOffset.toFixed(2)}px)`);

// Finish remaining 8 frames of jump
for (let i = 0; i < 8; i++) {
  stalfos.update(playerSE, noCollision, () => {});
}

assert(stalfos.x === preJumpX, 'Vertical jump kept X grid coordinate aligned');
assert(stalfos.y === preJumpY + 32, 'Vertical jump shifted exactly 32px (2 grid tiles) south');
assert(stalfos.jumpYOffset === 0, 'Elevation returned to 0 upon landing');
assert((stalfos.stalfosState as string) === 'pause', 'Entered rhythmic recovery pause after jump');

// Test 5: Wall Obstacle Turning on Grid
console.log('\n[Test 5: Obstacle Axis Shifting]');
const wallStalfos = new StalfosEnemy({
  id: 'stalfos_wall',
  x: 96,
  y: 80,
  dir: Direction.RIGHT,
});
wallStalfos.pauseTimer = 1;
const blockEastWall = (x: number) => x > 96;
wallStalfos.update(createMockPlayer({ x: 96, y: 144 }), blockEastWall, () => {});

assert((wallStalfos.dir as Direction) === Direction.DOWN, 'Blocked east grid step shifts Stalfos cleanly onto vertical axis');

// Test 6: Obstacle Containment During Jump
console.log('\n[Test 6: Obstacle Containment During Jump]');
wallStalfos.startGridJump();
wallStalfos.dir = Direction.RIGHT;
wallStalfos.jumpVx = 2.0;
wallStalfos.jumpVy = 0;
const frozenX = wallStalfos.x;
wallStalfos.update(playerSE, () => true, () => {});
assert(wallStalfos.x === frozenX && wallStalfos.jumpVx === 0, 'Jump halts cleanly before solid wall');

// Test 7: Dungeon Melee Contact Damage
console.log('\n[Test 7: Contact Damage Threat]');
let damageTaken = 0;
stalfos.update(
  createMockPlayer({ x: stalfos.x + 5, y: stalfos.y }),
  noCollision,
  (dmg) => {
    damageTaken += dmg;
  }
);
assert(damageTaken >= 1, 'Stalfos deals melee contact damage upon touching Link');

console.log('\n>>> ALL STALFOS ENEMY SUBCLASS TESTS PASSED SUCCESSFULLY! <<<\n');
