/**
 * The Legend of Zelda NES - Complex Enemy AI System
 * Implements finite-state-machine behaviors ('patrol', 'chase', 'flee')
 * for advanced tactical enemies like Stalfos and Darknuts.
 */

import { Direction, Enemy, EnemyBehaviorState, EnemyType, PlayerState } from '../types';

export * from './basicEnemyAI';
export * from './octorokEnemy';
export * from './stalfosEnemy';
export * from './goriyaEnemy';
export * from './keeseEnemy';
export * from './tektiteEnemy';
export * from './leeverEnemy';
export * from './darknutEnemy';
export * from './gelEnemy';
export * from './peahatEnemy';
export * from './wizzrobeEnemy';
export * from './ghiniEnemy';
export * from './likeLikeEnemy';
export * from './stateAIController';

export type TileCollisionFn = (x: number, y: number, w: number, h: number) => boolean;

/**
 * Checks if an enemy type uses the advanced multi-state behavior system.
 */
export function isComplexEnemy(type: EnemyType): boolean {
  return (
    type === EnemyType.DARKNUT_RED ||
    type === EnemyType.DARKNUT_BLUE
  );
}

/**
 * Initializes behavior properties on an enemy.
 */
export function initEnemyBehavior(enemy: Enemy): void {
  enemy.behaviorState = 'patrol';
  enemy.behaviorTimer = 60 + Math.floor(Math.random() * 60);
  enemy.patrolDir = enemy.dir;
  enemy.alertTimer = 0;
  enemy.fleeTimer = 0;
  enemy.lungeTimer = 0;
  enemy.stuckCounter = 0;
}

/**
 * Raycast-style Line-of-Sight check between two points.
 * Returns true if an unobstructed path exists between entity centers.
 */
export function hasLineOfSight(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  checkTileCollision: TileCollisionFn
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.hypot(dx, dy);
  if (distance < 10) return true;

  const steps = Math.floor(distance / 8);
  const stepX = dx / steps;
  const stepY = dy / steps;

  for (let i = 1; i < steps; i++) {
    const testX = x1 + stepX * i;
    const testY = y1 + stepY * i;
    if (checkTileCollision(testX - 4, testY - 4, 8, 8)) {
      return false;
    }
  }

  return true;
}

/**
 * Core AI Update loop for complex enemies.
 * Manages state transitions, pathfinding, wall sliding, and tactical positioning.
 */
export function updateComplexEnemyAI(
  enemy: Enemy,
  player: PlayerState,
  checkTileCollision: TileCollisionFn,
  audio: { playEnemyAlert?: () => void; playEnemyFlee?: () => void }
): void {
  // Ensure behavior properties are initialized
  if (!enemy.behaviorState) {
    initEnemyBehavior(enemy);
  }

  // Visual telegraph timers
  if (enemy.alertTimer && enemy.alertTimer > 0) {
    enemy.alertTimer--;
  }
  if (enemy.lungeTimer && enemy.lungeTimer > 0) {
    enemy.lungeTimer--;
  }

  // Animation frame stepping: in 'flee' state, legs/ribs skitter 2x faster
  const animInterval = enemy.behaviorState === 'flee' ? 5 : 9;
  enemy.animTimer = (enemy.animTimer || 0) + 1;
  if (enemy.animTimer > animInterval) {
    enemy.animFrame = (enemy.animFrame + 1) % 2;
    enemy.animTimer = 0;
  }

  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const dist = Math.hypot(dx, dy);

  // --- STATE TRANSITIONS ---

  switch (enemy.behaviorState) {
    case 'patrol': {
      // 1. Check if low health should trigger immediate panic flee
      const lowHpThreshold = enemy.type === EnemyType.DARKNUT_BLUE ? 2 : 1;
      if (enemy.health <= lowHpThreshold && dist < 70) {
        setFleeState(enemy, 110 + Math.floor(Math.random() * 40), audio);
        break;
      }

      // 2. Perception Check: proximity or direct line of sight
      const canSeePlayer =
        dist <= 64 ||
        (dist <= 110 && hasLineOfSight(enemy.x + 8, enemy.y + 8, player.x + 8, player.y + 8, checkTileCollision));

      if (canSeePlayer) {
        setChaseState(enemy, 220, audio);
        break;
      }

      // 3. Regular Patrol Movement: pace rooms or corridors
      updatePatrolMovement(enemy, checkTileCollision);
      break;
    }

    case 'chase': {
      // 1. Low health trigger: retreat to avoid imminent defeat!
      const lowHpThreshold = enemy.type === EnemyType.DARKNUT_BLUE ? 2 : 1;
      if (enemy.health <= lowHpThreshold) {
        setFleeState(enemy, 130 + Math.floor(Math.random() * 50), audio);
        break;
      }

      // 2. Lose player / aggro expiration
      enemy.behaviorTimer = (enemy.behaviorTimer || 180) - 1;
      const canStillSee =
        dist <= 80 ||
        (dist <= 130 && hasLineOfSight(enemy.x + 8, enemy.y + 8, player.x + 8, player.y + 8, checkTileCollision));

      if (canStillSee) {
        // Sustain chase timer while player remains nearby or visible
        enemy.behaviorTimer = Math.max(enemy.behaviorTimer, 120);
      }

      if (enemy.behaviorTimer <= 0) {
        // Lost track of player: return to patrol
        enemy.behaviorState = 'patrol';
        enemy.actionTimer = 40 + Math.floor(Math.random() * 40);
        break;
      }

      // 3. Chase Movement: actively pursue and align with player
      updateChaseMovement(enemy, player, dist, checkTileCollision);
      break;
    }

    case 'flee': {
      // 1. Decrement flee countdown
      enemy.fleeTimer = (enemy.fleeTimer || 90) - 1;

      // 2. Flee Movement: move in opposite vector of player
      updateFleeMovement(enemy, player, checkTileCollision);

      // 3. Check transition out of flee
      if (enemy.fleeTimer <= 0) {
        if (dist >= 85) {
          // Escaped to safe distance: return to cautious patrol
          enemy.behaviorState = 'patrol';
          enemy.actionTimer = 50 + Math.floor(Math.random() * 40);
        } else if (dist < 38 || (enemy.stuckCounter || 0) > 25) {
          // Cornered! Snap back into desperate chase attack
          setChaseState(enemy, 160, audio);
        } else {
          // Continue fleeing a bit longer if player is still pursuing closely
          enemy.fleeTimer = 60;
        }
      }
      break;
    }

    default:
      enemy.behaviorState = 'patrol';
      break;
  }
}

/**
 * Triggers Chase state with visual telegraph and audio cue
 */
function setChaseState(
  enemy: Enemy,
  duration: number,
  audio: { playEnemyAlert?: () => void }
) {
  enemy.behaviorState = 'chase';
  enemy.behaviorTimer = duration;
  enemy.alertTimer = 24; // Displays '!' for ~0.4s
  audio.playEnemyAlert?.();
}

/**
 * Triggers Flee state with visual telegraph and retreat audio cue
 */
export function setFleeState(
  enemy: Enemy,
  duration: number,
  audio: { playEnemyFlee?: () => void }
) {
  enemy.behaviorState = 'flee';
  enemy.fleeTimer = duration;
  enemy.alertTimer = 20; // Displays sweat/panic cue
  enemy.stuckCounter = 0;
  audio.playEnemyFlee?.();
}

/**
 * Patrol movement: systematic roaming and corner turning
 */
function updatePatrolMovement(enemy: Enemy, checkTileCollision: TileCollisionFn) {
  enemy.actionTimer = (enemy.actionTimer || 0) - 1;

  // Base patrol speeds
  let moveSpeed = enemy.speed * 0.85;
  if (enemy.type === EnemyType.STALFOS) moveSpeed = 0.75;
  else if (enemy.type === EnemyType.DARKNUT_RED) moveSpeed = 0.75;
  else if (enemy.type === EnemyType.DARKNUT_BLUE) moveSpeed = 0.85;

  if (enemy.actionTimer <= 0) {
    // Pick direction: prefer orthogonal turns to keep exploring room
    const dirs = [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT];
    const available = dirs.filter((d) => {
      const [testVx, testVy] = getDirectionVector(d, 4);
      return !checkTileCollision(enemy.x + testVx, enemy.y + testVy, 14, 14);
    });

    if (available.length > 0) {
      enemy.dir = available[Math.floor(Math.random() * available.length)];
    } else {
      enemy.dir = dirs[Math.floor(Math.random() * dirs.length)];
    }
    enemy.actionTimer = 45 + Math.floor(Math.random() * 55);
  }

  // Attempt movement in current direction
  const [vx, vy] = getDirectionVector(enemy.dir, moveSpeed);
  const nextX = enemy.x + vx;
  const nextY = enemy.y + vy;

  if (!checkTileCollision(nextX, nextY, 14, 14)) {
    enemy.x = nextX;
    enemy.y = nextY;
  } else {
    // Hit wall: change direction immediately
    const turnDirs =
      enemy.dir === Direction.LEFT || enemy.dir === Direction.RIGHT
        ? [Direction.UP, Direction.DOWN, getOppositeDirection(enemy.dir)]
        : [Direction.LEFT, Direction.RIGHT, getOppositeDirection(enemy.dir)];

    for (const d of turnDirs) {
      const [tvx, tvy] = getDirectionVector(d, 4);
      if (!checkTileCollision(enemy.x + tvx, enemy.y + tvy, 14, 14)) {
        enemy.dir = d;
        break;
      }
    }
    enemy.actionTimer = 35 + Math.floor(Math.random() * 30);
  }
}

/**
 * Chase movement: intelligent axis pursuit, Stalfos lunges, and Darknut frontal tracking
 */
function updateChaseMovement(
  enemy: Enemy,
  player: PlayerState,
  dist: number,
  checkTileCollision: TileCollisionFn
) {
  let moveSpeed = enemy.speed * 1.12;

  // Stalfos special lunge behavior
  if (enemy.type === EnemyType.STALFOS) {
    if (!enemy.lungeTimer && Math.random() < 0.025 && dist < 56 && dist > 16) {
      enemy.lungeTimer = 14; // Quick burst attack!
    }
    if (enemy.lungeTimer && enemy.lungeTimer > 0) {
      moveSpeed = 1.35; // Lunge speed boost
    }
  } else if (enemy.type === EnemyType.DARKNUT_BLUE) {
    moveSpeed = 1.18;
  }

  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;

  // Determine primary and secondary approach directions
  let primaryDir: Direction;
  let secondaryDir: Direction;

  if (Math.abs(dx) >= Math.abs(dy)) {
    primaryDir = dx > 0 ? Direction.RIGHT : Direction.LEFT;
    secondaryDir = dy > 0 ? Direction.DOWN : Direction.UP;
  } else {
    primaryDir = dy > 0 ? Direction.DOWN : Direction.UP;
    secondaryDir = dx > 0 ? Direction.RIGHT : Direction.LEFT;
  }

  // Try moving along primary axis
  const [pvx, pvy] = getDirectionVector(primaryDir, moveSpeed);
  if (!checkTileCollision(enemy.x + pvx, enemy.y + pvy, 14, 14)) {
    enemy.x += pvx;
    enemy.y += pvy;
    enemy.dir = primaryDir;
    enemy.stuckCounter = 0;
    return;
  }

  // Primary blocked: try secondary axis (tactical wall sliding)
  const [svx, svy] = getDirectionVector(secondaryDir, moveSpeed);
  if (!checkTileCollision(enemy.x + svx, enemy.y + svy, 14, 14)) {
    enemy.x += svx;
    enemy.y += svy;
    enemy.dir = secondaryDir;
    enemy.stuckCounter = 0;
    return;
  }

  // Both blocked: try opposite secondary axis to circumvent obstacle
  const altDir = getOppositeDirection(secondaryDir);
  const [avx, avy] = getDirectionVector(altDir, moveSpeed);
  if (!checkTileCollision(enemy.x + avx, enemy.y + avy, 14, 14)) {
    enemy.x += avx;
    enemy.y += avy;
    enemy.dir = altDir;
    enemy.stuckCounter = 0;
  } else {
    // Completely stuck: face player while waiting for opening
    enemy.dir = primaryDir;
    enemy.stuckCounter = (enemy.stuckCounter || 0) + 1;
  }
}

/**
 * Flee movement: tactical escape away from player
 */
function updateFleeMovement(
  enemy: Enemy,
  player: PlayerState,
  checkTileCollision: TileCollisionFn
) {
  // Rapid retreat speed
  let moveSpeed = enemy.speed * 1.25;
  if (enemy.type === EnemyType.STALFOS) moveSpeed = 1.28;
  else if (enemy.type === EnemyType.DARKNUT_BLUE) moveSpeed = 1.3;

  const escapeX = enemy.x - player.x;
  const escapeY = enemy.y - player.y;

  // Primary direction moves further away from player along dominant axis
  let primaryFlee: Direction;
  let secondaryFlee: Direction;

  if (Math.abs(escapeX) >= Math.abs(escapeY)) {
    primaryFlee = escapeX >= 0 ? Direction.RIGHT : Direction.LEFT;
    secondaryFlee = escapeY >= 0 ? Direction.DOWN : Direction.UP;
  } else {
    primaryFlee = escapeY >= 0 ? Direction.DOWN : Direction.UP;
    secondaryFlee = escapeX >= 0 ? Direction.RIGHT : Direction.LEFT;
  }

  // 1. Try primary escape route
  const [fvx, fvy] = getDirectionVector(primaryFlee, moveSpeed);
  if (!checkTileCollision(enemy.x + fvx, enemy.y + fvy, 14, 14)) {
    enemy.x += fvx;
    enemy.y += fvy;
    enemy.dir = primaryFlee;
    enemy.stuckCounter = 0;
    return;
  }

  // 2. Try secondary escape route (perpendicular slide along wall away from player)
  const [sfvx, sfvy] = getDirectionVector(secondaryFlee, moveSpeed);
  if (!checkTileCollision(enemy.x + sfvx, enemy.y + sfvy, 14, 14)) {
    enemy.x += sfvx;
    enemy.y += sfvy;
    enemy.dir = secondaryFlee;
    enemy.stuckCounter = 0;
    return;
  }

  // 3. Try alternative perpendicular direction
  const altFlee = getOppositeDirection(secondaryFlee);
  const [afvx, afvy] = getDirectionVector(altFlee, moveSpeed);
  if (!checkTileCollision(enemy.x + afvx, enemy.y + afvy, 14, 14)) {
    enemy.x += afvx;
    enemy.y += afvy;
    enemy.dir = altFlee;
    enemy.stuckCounter = 0;
  } else {
    // Cornered against wall!
    enemy.stuckCounter = (enemy.stuckCounter || 0) + 1;
  }
}

/**
 * Direction helper converting Direction enum to [vx, vy]
 */
function getDirectionVector(dir: Direction, speed: number): [number, number] {
  switch (dir) {
    case Direction.UP:
      return [0, -speed];
    case Direction.DOWN:
      return [0, speed];
    case Direction.LEFT:
      return [-speed, 0];
    case Direction.RIGHT:
      return [speed, 0];
  }
}

/**
 * Returns the opposite direction
 */
function getOppositeDirection(dir: Direction): Direction {
  switch (dir) {
    case Direction.UP:
      return Direction.DOWN;
    case Direction.DOWN:
      return Direction.UP;
    case Direction.LEFT:
      return Direction.RIGHT;
    case Direction.RIGHT:
      return Direction.LEFT;
  }
}

/**
 * Checks if an attack strikes Darknut's frontal shield.
 * In classic NES Zelda, Darknuts block any attack coming directly from the front.
 */
export function isDarknutShieldBlocking(
  darknutDir: Direction,
  attackDir: Direction
): boolean {
  // Frontal attack occurs when an attack travels directly into the Darknut's front shield
  return (
    (darknutDir === Direction.UP && attackDir === Direction.DOWN) ||
    (darknutDir === Direction.DOWN && attackDir === Direction.UP) ||
    (darknutDir === Direction.LEFT && attackDir === Direction.RIGHT) ||
    (darknutDir === Direction.RIGHT && attackDir === Direction.LEFT)
  );
}
