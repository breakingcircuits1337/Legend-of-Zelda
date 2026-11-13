/**
 * Unit Test Suite for Gel Enemy Subclass
 * Tests weak 1-HP stats, slow swarm creep, vibrate-in-place telegraph,
 * quick burst lunge toward player, obstacle containment, swarm presence,
 * and contact melee damage.
 */

import { GelEnemy } from '../src/game/gelEnemy';
import { BaseEnemy } from '../src/game/octorokEnemy';
import { SCREEN_D1_3 } from '../src/game/worldData';
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

console.log('--- RUNNING GEL ENEMY SUBCLASS TEST SUITE ---');

// Test 1: Subclass Inheritance & Weak Swarm Blob Properties
console.log('\n[Test 1: Subclass Inheritance & Properties]');
const gel = new GelEnemy({
  id: 'gel_test_1',
  x: 80,
  y: 80,
});

assert(gel instanceof GelEnemy, 'gel is an instance of GelEnemy');
assert(gel instanceof BaseEnemy, 'gel inherits from BaseEnemy');
assert(gel.type === EnemyType.GEL, 'EnemyType is GEL');
assert(gel.health === 1 && gel.maxHealth === 1, 'Gel is weak with 1 HP');
assert(gel.speed === 0.45, 'Gel moves slowly (0.45 px/frame) while creeping');
assert(gel.gelState === 'creep', 'Initial state is slow creep');
assert(gel.isVibrating === false, 'Gel does not start vibrating');

// Test 2: Slow Swarm Creep Movement
console.log('\n[Test 2: Slow Creep Movement]');
const noCollision = () => false;
const farPlayer = createMockPlayer({ x: 210, y: 140 });
gel.swarmAngle = 0; // Creep east
gel.creepTurnTimer = 50;
gel.stateTimer = 50;
const creepStartX = gel.x;
const creepStartY = gel.y;

for (let i = 0; i < 10; i++) {
  gel.update(farPlayer, noCollision, () => {});
}

const creepDisplacement = Math.hypot(gel.x - creepStartX, gel.y - creepStartY);
assert(creepDisplacement > 0 && creepDisplacement <= 5.0, `Gel creeps slowly (${creepDisplacement.toFixed(2)}px over 10 frames)`);

// Test 3: Vibrating in Place Before Lunging
console.log('\n[Test 3: Vibrate-in-Place Telegraph]');
gel.stateTimer = 1;
let alertPlayed = false;

gel.update(
  farPlayer,
  noCollision,
  () => {},
  {
    playEnemyAlert: () => {
      alertPlayed = true;
    },
  }
);

assert(gel.gelState === 'vibrate', 'Gel transitioned into vibrate state');
assert(gel.isVibrating === true, 'isVibrating flag active for pixel shake rendering');
assert(gel.behaviorState === 'windup', 'Behavior state set to windup while vibrating');
assert(alertPlayed, 'Alert audio cue played when starting to vibrate');

const vibX = gel.x;
const vibY = gel.y;
gel.stateTimer = 10;
for (let i = 0; i < 5; i++) {
  gel.update(farPlayer, noCollision, () => {});
}
assert(gel.x === vibX && gel.y === vibY, 'Gel remains stationary in place while vibrating');

// Test 4: Quick Lunge Toward Player
console.log('\n[Test 4: Quick Lunge Toward Player]');
const targetPlayer = createMockPlayer({ x: gel.x + 60, y: gel.y });
gel.stateTimer = 1;
let lungeAudioPlayed = false;

gel.update(
  targetPlayer,
  noCollision,
  () => {},
  {
    playMeleeLunge: () => {
      lungeAudioPlayed = true;
    },
  }
);

assert(gel.gelState === 'lunge', 'Gel launched into quick lunge after vibrating');
assert(gel.isVibrating === false, 'Vibration flag cleared upon lunging');
assert(gel.behaviorState === 'attack', 'Behavior state set to attack during lunge');
assert(gel.lungeVx > gel.speed, `Lunge velocity (${gel.lungeVx.toFixed(2)}) is much faster than creep speed`);
assert(lungeAudioPlayed, 'Melee lunge audio cue played on lunge');

const preLungeX = gel.x;
gel.update(targetPlayer, noCollision, () => {});
assert(gel.x > preLungeX, 'Gel advances rapidly toward target player during lunge');

// Test 5: Wall Containment & Post-Lunge Recovery
console.log('\n[Test 5: Wall Containment & Recovery]');
const wallGel = new GelEnemy({
  id: 'gel_wall',
  x: 100,
  y: 80,
});
wallGel.launchLunge(createMockPlayer({ x: 160, y: 80 }));
const blockRightWall = (x: number) => x > 100;
wallGel.update(createMockPlayer({ x: 160, y: 80 }), blockRightWall, () => {});
assert(wallGel.x === 100, 'Lunging Gel does not phase through solid wall');

gel.stateTimer = 1;
gel.update(targetPlayer, noCollision, () => {});
assert(gel.gelState === 'recover', 'Gel enters brief recover phase after lunge');
gel.stateTimer = 1;
gel.update(targetPlayer, noCollision, () => {});
assert(gel.gelState === 'creep', 'Gel resumes slow swarm creep after recovery');

// Test 6: Large Swarm Group Presence
console.log('\n[Test 6: Swarm Group Presence in Dungeon]');
const d1SwarmGels = SCREEN_D1_3.enemies.filter((e) => e.type === EnemyType.GEL);
assert(d1SwarmGels.length >= 5, `Dungeon room D1_3 spawns a large Gel swarm (${d1SwarmGels.length} Gels)`);

const swarm = d1SwarmGels.map(
  (e, idx) => new GelEnemy({ id: `swarm_${idx}`, x: e.x, y: e.y })
);
for (let f = 0; f < 30; f++) {
  swarm.forEach((member) => member.update(farPlayer, noCollision, () => {}));
}
assert(
  swarm.every((member) => member instanceof GelEnemy && member.health === 1),
  'Entire swarm operates independently as GelEnemy instances'
);

// Test 7: Swarm Contact Damage
console.log('\n[Test 7: Swarm Contact Damage]');
let damageTaken = 0;
gel.update(
  createMockPlayer({ x: gel.x + 4, y: gel.y + 4 }),
  noCollision,
  (dmg) => {
    damageTaken += dmg;
  }
);
assert(damageTaken === 1, 'Gel inflicts 1 contact damage upon touching Link');

console.log('\n>>> ALL GEL ENEMY SUBCLASS TESTS PASSED SUCCESSFULLY! <<<\n');
