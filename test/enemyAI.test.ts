/**
 * Test Suite for Legend of Zelda NES Basic Enemy AI System
 * Verifies patrol patterns, pause-step rhythms, proximity detection,
 * attack windup telegraphs, and ranged/melee basic attacks.
 */

import {
  isBasicEnemy,
  initBasicEnemyAI,
  updateBasicEnemyAI,
  getDirectionToPlayer,
  getOppositeDirection,
} from '../src/game/basicEnemyAI';
import { Direction, Enemy, EnemyType, ItemType, PlayerState } from '../src/types';

function createMockPlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    x: 120,
    y: 120,
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

function createMockEnemy(type: EnemyType, x: number, y: number, dir: Direction = Direction.RIGHT): Enemy {
  return {
    id: `enemy_test_${Date.now()}_${Math.random()}`,
    type,
    x,
    y,
    dir,
    health: 2,
    maxHealth: 2,
    speed: 1.0,
    animFrame: 0,
    animTimer: 0,
    actionTimer: 0,
    isHurt: false,
    hurtTimer: 0,
    isStunned: false,
    stunTimer: 0,
    isDead: false,
    deathTimer: 0,
  };
}

// Simple test runner
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

console.log('--- RUNNING BASIC ENEMY AI TEST SUITE ---');

// Test 1: Enemy type classification
console.log('\n[Test 1: Basic Enemy Classification]');
assert(isBasicEnemy(EnemyType.OCTOROK_RED), 'Octorok Red is identified as basic enemy');
assert(isBasicEnemy(EnemyType.OCTOROK_BLUE), 'Octorok Blue is identified as basic enemy');
assert(isBasicEnemy(EnemyType.MOBLIN_RED), 'Moblin Red is identified as basic enemy');
assert(isBasicEnemy(EnemyType.MOBLIN_BLUE), 'Moblin Blue is identified as basic enemy');
assert(isBasicEnemy(EnemyType.ROPE), 'Rope is identified as basic enemy');
assert(isBasicEnemy(EnemyType.KEESE), 'Keese is identified as basic enemy');
assert(!isBasicEnemy(EnemyType.AQUAMENTUS), 'Aquamentus boss is not a basic enemy');
assert(!isBasicEnemy(EnemyType.DODONGO), 'Dodongo boss is not a basic enemy');

// Test 2: AI Initialization
console.log('\n[Test 2: Patrol Configuration Initialization]');
const octorok = createMockEnemy(EnemyType.OCTOROK_RED, 100, 100, Direction.RIGHT);
initBasicEnemyAI(octorok);
assert(octorok.patrolConfig !== undefined, 'Patrol config created');
assert(octorok.patrolConfig?.pattern === 'horizontal', 'Horizontal pattern chosen for horizontal direction');
assert(octorok.behaviorState === 'patrol', 'Initial state is patrol');
assert(octorok.patrolConfig?.originX === 100, 'Origin X recorded correctly');

const vertMoblin = createMockEnemy(EnemyType.MOBLIN_RED, 100, 100, Direction.UP);
initBasicEnemyAI(vertMoblin);
assert(vertMoblin.patrolConfig?.pattern === 'vertical', 'Vertical pattern chosen for vertical direction');

// Test 3: Horizontal Patrol Back-and-Forth Movement
console.log('\n[Test 3: Horizontal Patrol Movement]');
const patroller = createMockEnemy(EnemyType.OCTOROK_RED, 100, 100, Direction.RIGHT);
initBasicEnemyAI(patroller);
patroller.patrolConfig!.range = 10; // Small range for testing turnaround
patroller.patrolConfig!.pauseTimer = 0;
patroller.attackCooldown = 999; // Disable proximity attack during pure patrol test

const farPlayer = createMockPlayer({ x: 240, y: 240 }); // Far away
const mockCollision = () => false;

// Step forward
const startX = patroller.x;
updateBasicEnemyAI({
  enemy: patroller,
  player: farPlayer,
  checkTileCollision: mockCollision,
  shootProjectile: () => {},
  damagePlayer: () => {},
  audio: {},
});
assert(patroller.x > startX, 'Enemy advances along patrol direction');
assert(patroller.dir === Direction.RIGHT, 'Enemy retains right direction while within range');

// Simulate moving past range boundary -> should turn around and pause
patroller.x = 112; // Exceeds origin (100) + range (10)
updateBasicEnemyAI({
  enemy: patroller,
  player: farPlayer,
  checkTileCollision: mockCollision,
  shootProjectile: () => {},
  damagePlayer: () => {},
  audio: {},
});
assert(patroller.dir === Direction.LEFT, 'Enemy reverses direction to LEFT upon reaching patrol limit');
assert(patroller.patrolConfig!.pauseTimer > 0, 'Enemy enters authentic 8-bit pause after reversal');

// Test 4: Wall Obstacle Reversal
console.log('\n[Test 4: Wall Collision Reversal]');
const wallEnemy = createMockEnemy(EnemyType.MOBLIN_RED, 80, 80, Direction.LEFT);
initBasicEnemyAI(wallEnemy);
wallEnemy.patrolConfig!.pauseTimer = 0;
wallEnemy.attackCooldown = 999;

// Next step hits a solid wall
updateBasicEnemyAI({
  enemy: wallEnemy,
  player: farPlayer,
  checkTileCollision: () => true, // Wall collision!
  shootProjectile: () => {},
  damagePlayer: () => {},
  audio: {},
});
assert(wallEnemy.dir === Direction.RIGHT, 'Enemy reverses direction on solid tile obstacle collision');

// Test 5: Proximity Detection & Attack Windup Telegraph
console.log('\n[Test 5: Proximity Detection & Windup Telegraph]');
const ambusher = createMockEnemy(EnemyType.OCTOROK_RED, 100, 100, Direction.RIGHT);
initBasicEnemyAI(ambusher);
ambusher.attackCooldown = 0; // Ready to attack

// Player approaches within close range (30px away to the right)
const nearPlayer = createMockPlayer({ x: 130, y: 100 });
let alertPlayed = false;

updateBasicEnemyAI({
  enemy: ambusher,
  player: nearPlayer,
  checkTileCollision: mockCollision,
  shootProjectile: () => {},
  damagePlayer: () => {},
  audio: {
    playEnemyAlert: () => {
      alertPlayed = true;
    },
  },
});

assert(ambusher.behaviorState === 'windup', 'Enemy enters windup state when player gets close');
assert(ambusher.alertTimer! > 0, 'Alert timer active for visual 8-bit telegraph');
assert(alertPlayed, 'Audio alert cue sounded');
assert(ambusher.dir === Direction.RIGHT, 'Enemy faces player during attack preparation');

// Test 6: Basic Projectile Attack (Octorok rock spit)
console.log('\n[Test 6: Basic Projectile Attack (Octorok Rock Spit)]');
let projectileFired: { type: string; dir: Direction } | null = null;
ambusher.attackWindupTimer = 1; // 1 frame remaining on windup

updateBasicEnemyAI({
  enemy: ambusher,
  player: nearPlayer,
  checkTileCollision: mockCollision,
  shootProjectile: (enemy, type) => {
    projectileFired = { type, dir: enemy.dir };
  },
  damagePlayer: () => {},
  audio: {},
});

assert(projectileFired !== null, 'Projectile fired upon windup completion');
assert(projectileFired!.type === 'rock', 'Octorok fired stone rock');
assert(projectileFired!.dir === Direction.RIGHT, 'Rock fired directly toward player');
assert(ambusher.behaviorState === 'patrol', 'Octorok returned to patrol state after firing');
assert(ambusher.attackCooldown! > 40, 'Attack cooldown active to prevent projectile spam');

// Test 7: Basic Arrow Attack (Moblin)
console.log('\n[Test 7: Basic Arrow Attack (Moblin)]');
const moblin = createMockEnemy(EnemyType.MOBLIN_RED, 100, 100, Direction.LEFT);
initBasicEnemyAI(moblin);
moblin.attackCooldown = 0;
const southPlayer = createMockPlayer({ x: 100, y: 130 }); // South of Moblin

// Proximity triggers windup
updateBasicEnemyAI({
  enemy: moblin,
  player: southPlayer,
  checkTileCollision: mockCollision,
  shootProjectile: () => {},
  damagePlayer: () => {},
  audio: {},
});
assert(moblin.behaviorState === 'windup', 'Moblin enters windup');
assert(moblin.dir === Direction.DOWN, 'Moblin rotates to face player southward');

// Complete windup
moblin.attackWindupTimer = 1;
let moblinProjectile: { type: string; dir: Direction } | null = null;
updateBasicEnemyAI({
  enemy: moblin,
  player: southPlayer,
  checkTileCollision: mockCollision,
  shootProjectile: (enemy, type) => {
    moblinProjectile = { type, dir: enemy.dir };
  },
  damagePlayer: () => {},
  audio: {},
});
assert(moblinProjectile !== null && moblinProjectile.type === 'arrow', 'Moblin shoots arrow');
assert(moblinProjectile!.dir === Direction.DOWN, 'Arrow travels down toward player');

// Test 8: Basic Melee Lunge Attack (Rope Snake)
console.log('\n[Test 8: Basic Melee Lunge Attack (Rope)]');
const rope = createMockEnemy(EnemyType.ROPE, 100, 100, Direction.UP);
initBasicEnemyAI(rope);
rope.attackCooldown = 0;
const eastPlayer = createMockPlayer({ x: 135, y: 100 }); // East

// Trigger windup
updateBasicEnemyAI({
  enemy: rope,
  player: eastPlayer,
  checkTileCollision: mockCollision,
  shootProjectile: () => {},
  damagePlayer: () => {},
  audio: {},
});
assert(rope.behaviorState === 'windup', 'Rope begins attack windup');
assert(rope.dir === Direction.RIGHT, 'Rope targets right direction');

// Unleash lunge
rope.attackWindupTimer = 1;
let lungeAudioPlayed = false;
updateBasicEnemyAI({
  enemy: rope,
  player: eastPlayer,
  checkTileCollision: mockCollision,
  shootProjectile: () => {},
  damagePlayer: () => {},
  audio: {
    playMeleeLunge: () => {
      lungeAudioPlayed = true;
    },
  },
});
assert(rope.behaviorState === 'attack', 'Rope transitions into active attack lunge');
assert(rope.lungeTimer! > 0, 'Lunge timer active');
assert(lungeAudioPlayed, 'Melee lunge audio cue triggered');

// Lunge movement and player contact
let playerDamaged = false;
let damageReceived = 0;
// Position rope directly on player
rope.x = 134;
rope.y = 100;
updateBasicEnemyAI({
  enemy: rope,
  player: eastPlayer,
  checkTileCollision: mockCollision,
  shootProjectile: () => {},
  damagePlayer: (dmg) => {
    playerDamaged = true;
    damageReceived = dmg;
  },
  audio: {},
});
assert(playerDamaged, 'Player takes contact damage during melee lunge attack');
assert(damageReceived >= 1, 'Damage applied correctly');

console.log('\n>>> ALL BASIC ENEMY AI TESTS PASSED SUCCESSFULLY! <<<\n');
