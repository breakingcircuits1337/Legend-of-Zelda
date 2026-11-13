/**
 * Unit Test Suite for Darknut Enemy Subclass
 * Tests armored patrol movement, high health variants (Red/Blue),
 * proximity turn-and-charge behavior, frontal shield blocking, and contact damage.
 */

import { DarknutEnemy } from '../src/game/darknutEnemy';
import { isDarknutShieldBlocking } from '../src/game/enemyAI';
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

console.log('--- RUNNING DARKNUT ENEMY SUBCLASS TEST SUITE ---');

// Test 1: Subclass Inheritance & High Health Variants
console.log('\n[Test 1: Subclass Inheritance & High Health Variants]');
const redDarknut = new DarknutEnemy({
  id: 'darknut_red_1',
  type: EnemyType.DARKNUT_RED,
  x: 60,
  y: 60,
  dir: Direction.RIGHT,
});
const blueDarknut = new DarknutEnemy({
  id: 'darknut_blue_1',
  type: EnemyType.DARKNUT_BLUE,
  x: 160,
  y: 60,
  dir: Direction.LEFT,
});

assert(redDarknut instanceof DarknutEnemy, 'redDarknut is an instance of DarknutEnemy');
assert(redDarknut instanceof BaseEnemy, 'redDarknut inherits from BaseEnemy');
assert(redDarknut.type === EnemyType.DARKNUT_RED, 'Red Darknut type is DARKNUT_RED');
assert(redDarknut.health === 4 && redDarknut.maxHealth === 4, 'Red Darknut has high health (4 HP)');
assert(blueDarknut.health === 8 && blueDarknut.maxHealth === 8, 'Blue Darknut has elite high health (8 HP)');
assert(blueDarknut.meleeDamage === 2, 'Blue Darknut deals 2 contact damage (1 full heart)');
assert(redDarknut.darknutState === 'patrol', 'Darknut starts in armored patrol state');

// Test 2: Armored Patrol Movement & Obstacle Turning
console.log('\n[Test 2: Armored Patrol & Obstacle Avoidance]');
const noCollision = () => false;
const farPlayer = createMockPlayer({ x: 220, y: 140 });
const patrolStartX = redDarknut.x;
redDarknut.actionTimer = 30;

for (let i = 0; i < 10; i++) {
  redDarknut.update(farPlayer, noCollision, () => {});
}

assert(redDarknut.darknutState === 'patrol', 'Darknut remains in patrol when player is outside range');
assert(redDarknut.x > patrolStartX, 'Darknut marches steadily across the room during patrol');

// Obstacle in front forces clean turn
const wallFront = (x: number) => x > redDarknut.x;
const dirBeforeWall = redDarknut.dir;
redDarknut.update(farPlayer, wallFront, () => {});
assert(redDarknut.dir !== dirBeforeWall, 'Darknut turns away when blocked by a solid obstacle');

// Test 3: Proximity Detection Turns Darknut Toward Player & Triggers Windup
console.log('\n[Test 3: Proximity Turn Toward Player & Charge Windup]');
const guardDarknut = new DarknutEnemy({
  id: 'darknut_guard',
  x: 100,
  y: 80,
  dir: Direction.LEFT, // Initially facing away from player to the east
});
const eastClosePlayer = createMockPlayer({ x: 150, y: 80 }); // 50px east, within chargeRange (76px)
let alertPlayed = false;

guardDarknut.update(
  eastClosePlayer,
  noCollision,
  () => {},
  {
    playEnemyAlert: () => {
      alertPlayed = true;
    },
  }
);

assert(guardDarknut.dir === Direction.RIGHT, 'Darknut turns toward the player upon entering range');
assert(guardDarknut.darknutState === 'windup', 'Darknut enters windup telegraph before charging');
assert(guardDarknut.alertTimer! > 0, 'Visual alert telegraph active');
assert(alertPlayed, 'Alert audio cue played when spotting Link');

// Test 4: Armored Charge Execution & Speed Boost
console.log('\n[Test 4: Armored Charge Execution]');
guardDarknut.stateTimer = 1; // 1 frame left in windup
let lungePlayed = false;

guardDarknut.update(
  eastClosePlayer,
  noCollision,
  () => {},
  {
    playMeleeLunge: () => {
      lungePlayed = true;
    },
  }
);

assert(guardDarknut.darknutState === 'charge', 'Darknut transitioned into active charge');
assert(guardDarknut.behaviorState === 'attack', 'Behavior state set to attack during charge');
assert(lungePlayed, 'Melee lunge audio cue triggered on charge launch');

const preChargeX = guardDarknut.x;
guardDarknut.update(eastClosePlayer, noCollision, () => {});
assert(
  Math.abs(guardDarknut.x - (preChargeX + guardDarknut.chargeSpeed)) < 0.001,
  'Darknut charges forward toward Link at elevated chargeSpeed'
);

// Test 5: Charge Wall-Sliding & Recovery
console.log('\n[Test 5: Tactical Wall-Slide & Post-Charge Recovery]');
guardDarknut.x = 100;
guardDarknut.y = 80;
const southEastPlayer = createMockPlayer({ x: 140, y: 120 });
guardDarknut.dir = Direction.RIGHT;
guardDarknut.chargeReaimTimer = 10;

// Block east movement, leave south movement open
const blockEastOnly = (x: number, y: number) => x > 100 && y <= 82;
const preSlideY = guardDarknut.y;
guardDarknut.update(southEastPlayer, blockEastOnly, () => {});

assert(guardDarknut.y > preSlideY, 'Darknut wall-slides along secondary axis toward Link during charge');
assert((guardDarknut.dir as Direction) === Direction.DOWN, 'Darknut updates facing shield toward slide direction');

// Complete charge into recover -> patrol
guardDarknut.stateTimer = 1;
guardDarknut.update(eastClosePlayer, noCollision, () => {});
assert(guardDarknut.darknutState === 'recover', 'Darknut enters brief recovery after finishing charge');

guardDarknut.stateTimer = 1;
guardDarknut.update(eastClosePlayer, noCollision, () => {});
assert(guardDarknut.darknutState === 'patrol', 'Darknut returns to patrol after recovery');
assert(guardDarknut.chargeCooldown > 0, 'Charge cooldown active after recovery');

// Test 6: Frontal Shield Defense & Flank Vulnerability
console.log('\n[Test 6: Frontal Shield Blocking]');
const shielded = new DarknutEnemy({
  id: 'darknut_shield',
  x: 100,
  y: 80,
  dir: Direction.DOWN, // Facing south toward Link below
});

// Link below swings UP into Darknut's front shield -> blocked!
assert(
  shielded.isShieldBlocking(Direction.UP) === true &&
    isDarknutShieldBlocking(Direction.DOWN, Direction.UP) === true,
  'Frontal sword strike UP against DOWN-facing Darknut is blocked by shield'
);
// Link flanks from the side (swinging RIGHT) or behind (swinging DOWN) -> vulnerable!
assert(
  shielded.isShieldBlocking(Direction.RIGHT) === false &&
    isDarknutShieldBlocking(Direction.DOWN, Direction.RIGHT) === false,
  'Flanking strike from the side bypasses Darknut frontal shield'
);
assert(
  shielded.isShieldBlocking(Direction.DOWN) === false &&
    isDarknutShieldBlocking(Direction.DOWN, Direction.DOWN) === false,
  'Rear strike from behind bypasses Darknut frontal shield'
);

// Shield block reaction turns Darknut toward attacker
const northAttacker = createMockPlayer({ x: 100, y: 40 });
shielded.onShieldBlock(northAttacker);
assert(shielded.dir === Direction.UP, 'Shield block makes Darknut turn toward attacker');
assert(shielded.darknutState === 'windup', 'Shield block triggers immediate charge counterattack');

// Test 7: Contact Melee Damage
console.log('\n[Test 7: Contact Melee Damage]');
let redDmg = 0;
redDarknut.update(
  createMockPlayer({ x: redDarknut.x + 4, y: redDarknut.y }),
  noCollision,
  (dmg) => {
    redDmg += dmg;
  }
);
assert(redDmg === 1, 'Red Darknut deals 1 contact damage');

let blueDmg = 0;
blueDarknut.update(
  createMockPlayer({ x: blueDarknut.x + 4, y: blueDarknut.y }),
  noCollision,
  (dmg) => {
    blueDmg += dmg;
  }
);
assert(blueDmg === 2, 'Blue Darknut deals 2 contact damage');

console.log('\n>>> ALL DARKNUT ENEMY SUBCLASS TESTS PASSED SUCCESSFULLY! <<<\n');
