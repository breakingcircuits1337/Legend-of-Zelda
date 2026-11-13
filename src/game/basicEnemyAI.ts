/**
 * The Legend of Zelda NES - Basic Enemy AI System
 *
 * Implements classic 8-bit patrol patterns (horizontal and vertical back-and-forth pacing,
 * pause-and-step cadence, and boundary reversals) with proximity-triggered attacks
 * (telegraphed ranged projectile fire and melee lunges) for standard enemies.
 */

import { Direction, Enemy, EnemyType, PlayerState } from '../types';
import { ParticleSystem } from './particles';

export type TileCollisionFn = (x: number, y: number, w: number, h: number) => boolean;

export interface BasicEnemyAudio {
  playEnemyAlert?: () => void;
  playMeleeLunge?: () => void;
}

/**
 * Identifies if an enemy type uses the basic AI system (patrol patterns + proximity attack).
 */
export function isBasicEnemy(type: EnemyType): boolean {
  return (
    type === EnemyType.OCTOROK_RED ||
    type === EnemyType.OCTOROK_BLUE ||
    type === EnemyType.MOBLIN_RED ||
    type === EnemyType.MOBLIN_BLUE ||
    type === EnemyType.GORIYA_RED ||
    type === EnemyType.ROPE ||
    type === EnemyType.KEESE ||
    type === EnemyType.GEL ||
    type === EnemyType.ZOL
  );
}

/**
 * Initializes basic patrol configuration and attack state for a standard enemy.
 */
export function initBasicEnemyAI(enemy: Enemy): void {
  // Determine primary patrol pattern based on starting direction
  const isVert = enemy.dir === Direction.UP || enemy.dir === Direction.DOWN;
  const pattern = isVert ? 'vertical' : 'horizontal';

  enemy.patrolConfig = {
    pattern,
    originX: enemy.x,
    originY: enemy.y,
    range: 48 + Math.floor(Math.random() * 32), // 48-80px patrol span
    pauseTimer: 0,
    passCount: 0,
  };

  enemy.behaviorState = 'patrol';
  enemy.attackCooldown = 30 + Math.floor(Math.random() * 45); // Initial attack grace period
  enemy.attackWindupTimer = 0;
  enemy.alertTimer = 0;
  enemy.lungeTimer = 0;
  enemy.animTimer = 0;
}

/**
 * Determines the dominant cardinal direction from an enemy towards the player.
 */
export function getDirectionToPlayer(enemy: Enemy, player: PlayerState): Direction {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? Direction.RIGHT : Direction.LEFT;
  } else {
    return dy >= 0 ? Direction.DOWN : Direction.UP;
  }
}

/**
 * Converts a Direction into 8-bit movement vector [vx, vy].
 */
export function getCardinalVector(dir: Direction, speed: number): [number, number] {
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
 * Reverses a cardinal direction (180 degree flip).
 */
export function getOppositeDirection(dir: Direction): Direction {
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

export interface UpdateBasicEnemyOptions {
  enemy: Enemy;
  player: PlayerState;
  checkTileCollision: TileCollisionFn;
  shootProjectile: (enemy: Enemy, type: 'rock' | 'arrow' | 'boomerang') => void;
  damagePlayer: (damage: number, dir: Direction) => void;
  audio: BasicEnemyAudio;
  particles?: ParticleSystem;
}

/**
 * Main update function for Basic Enemy AI:
 * Handles back-and-forth patrol cycles, pause-step rhythms, proximity detection,
 * attack windup telegraphs, ranged/melee attacks, and collision checks.
 */
export function updateBasicEnemyAI(options: UpdateBasicEnemyOptions): void {
  const { enemy, player, checkTileCollision, shootProjectile, damagePlayer, audio, particles } =
    options;

  // Initialize patrol config if missing
  if (!enemy.patrolConfig || !enemy.behaviorState) {
    initBasicEnemyAI(enemy);
  }

  const cfg = enemy.patrolConfig!;

  // Decrement visual alert and lunge timers
  if (enemy.alertTimer && enemy.alertTimer > 0) {
    enemy.alertTimer--;
  }

  // 1. --- HANDLE ACTIVE WINDUP STATE ---
  if (enemy.behaviorState === 'windup') {
    enemy.attackWindupTimer = (enemy.attackWindupTimer || 0) - 1;

    // Face Link directly during windup
    enemy.dir = getDirectionToPlayer(enemy, player);

    // Subtle 8-bit ready animation vibration
    if (enemy.attackWindupTimer % 4 === 0) {
      enemy.animFrame = (enemy.animFrame + 1) % 2;
    }

    if (enemy.attackWindupTimer <= 0) {
      // Windup complete: unleash basic attack!
      executeBasicAttack(enemy, player, shootProjectile, audio, particles);
    }
    return;
  }

  // 2. --- HANDLE ACTIVE MELEE LUNGE ATTACK STATE ---
  if (enemy.behaviorState === 'attack') {
    enemy.lungeTimer = (enemy.lungeTimer || 0) - 1;

    // Move forward rapidly during lunge (2.2x speed)
    const lungeSpeed = enemy.speed * 2.2;
    const [lvx, lvy] = getCardinalVector(enemy.dir, lungeSpeed);
    const targetX = enemy.x + lvx;
    const targetY = enemy.y + lvy;

    // Step feet rapidly during charge
    enemy.animTimer = (enemy.animTimer || 0) + 1;
    if (enemy.animTimer > 4) {
      enemy.animFrame = (enemy.animFrame + 1) % 2;
      enemy.animTimer = 0;
    }

    // Check collision with solid tiles
    if (!checkTileCollision(targetX, targetY, 14, 14)) {
      enemy.x = targetX;
      enemy.y = targetY;
    } else {
      // Hit a wall during lunge: end lunge early
      enemy.lungeTimer = 0;
    }

    // Check contact damage with Link during lunge
    const lungeDist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (lungeDist < 14) {
      const dmg = enemy.type === EnemyType.ROPE ? 2 : 1;
      damagePlayer(dmg, enemy.dir);
    }

    // Lunge completion
    if (enemy.lungeTimer <= 0) {
      enemy.behaviorState = 'patrol';
      enemy.attackCooldown = 70 + Math.floor(Math.random() * 40); // 1.1s - 1.8s cooldown
      cfg.pauseTimer = 16; // Brief recovery pause
    }
    return;
  }

  // 3. --- PROXIMITY DETECTION & ATTACK TRIGGER ---
  if (enemy.attackCooldown && enemy.attackCooldown > 0) {
    enemy.attackCooldown--;
  }

  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const dist = Math.hypot(dx, dy);

  // Trigger attack when Link gets too close:
  // - Close proximity (dist <= 52px)
  // - OR direct line-of-sight corridor alignment within 80px (aligned on X or Y axis within 12px)
  const isCloseProximity = dist <= 52;
  const isAlignedCorridor =
    dist <= 84 && (Math.abs(dx) <= 12 || Math.abs(dy) <= 12);

  if ((isCloseProximity || isAlignedCorridor) && (enemy.attackCooldown || 0) <= 0) {
    // Player entered attack range! Enter windup telegraph state
    enemy.behaviorState = 'windup';
    enemy.attackWindupTimer = 14; // 14 frames (~0.23s) 8-bit telegraph window
    enemy.alertTimer = 18; // Displays classic NES '!' indicator above enemy head
    enemy.dir = getDirectionToPlayer(enemy, player);

    // Play 8-bit enemy alert cue
    audio.playEnemyAlert?.();
    return;
  }

  // 4. --- PATROL PATTERN: BACK AND FORTH & STEPPING CADENCE ---
  enemy.behaviorState = 'patrol';

  // If in an authentic 8-bit pause step:
  if (cfg.pauseTimer > 0) {
    cfg.pauseTimer--;
    return; // Hold position with stationary 8-bit stance
  }

  // Animate walking steps
  enemy.animTimer = (enemy.animTimer || 0) + 1;
  if (enemy.animTimer > 8) {
    enemy.animFrame = (enemy.animFrame + 1) % 2;
    enemy.animTimer = 0;
  }

  // Execute patrol movement along configured axis
  updatePatrolMovement(enemy, cfg, checkTileCollision);

  // 5. --- STANDARD CONTACT DAMAGE ---
  const contactDist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
  if (contactDist < 14) {
    damagePlayer(1, enemy.dir);
  }
}

/**
 * Handles back-and-forth movement, boundary limits, and obstacle turnaround.
 */
function updatePatrolMovement(
  enemy: Enemy,
  cfg: NonNullable<Enemy['patrolConfig']>,
  checkTileCollision: TileCollisionFn
): void {
  const moveSpeed = enemy.speed * 0.9;
  const [vx, vy] = getCardinalVector(enemy.dir, moveSpeed);

  const nextX = enemy.x + vx;
  const nextY = enemy.y + vy;

  // Check collision with screen outer boundaries
  const hitScreenEdge =
    (enemy.dir === Direction.LEFT && nextX < 16) ||
    (enemy.dir === Direction.RIGHT && nextX > 224) ||
    (enemy.dir === Direction.UP && nextY < 16) ||
    (enemy.dir === Direction.DOWN && nextY > 144);

  // Check patrol range displacement from origin
  const hitPatrolRange =
    cfg.pattern === 'horizontal'
      ? Math.abs(nextX - cfg.originX) >= cfg.range
      : cfg.pattern === 'vertical'
      ? Math.abs(nextY - cfg.originY) >= cfg.range
      : Math.abs(nextX - cfg.originX) >= cfg.range || Math.abs(nextY - cfg.originY) >= cfg.range;

  // Check solid tile collision ahead
  const hitSolidTile = checkTileCollision(nextX, nextY, 14, 14);

  if (!hitScreenEdge && !hitPatrolRange && !hitSolidTile) {
    // Path clear: continue patrol stride
    enemy.x = nextX;
    enemy.y = nextY;
  } else {
    // Reached boundary, obstacle, or patrol limit: reverse back and forth!
    enemy.dir = getOppositeDirection(enemy.dir);

    // Apply authentic NES brief hesitation pause before pacing the opposite direction
    cfg.pauseTimer = 14 + Math.floor(Math.random() * 10);
    cfg.passCount++;

    // For cardinal or alternating patterns: periodically shift track orthogonally
    if (cfg.pattern === 'cardinal' && cfg.passCount >= 3) {
      cfg.passCount = 0;
      cfg.originX = enemy.x;
      cfg.originY = enemy.y;

      // Toggle axis
      if (enemy.dir === Direction.LEFT || enemy.dir === Direction.RIGHT) {
        enemy.dir = Math.random() < 0.5 ? Direction.UP : Direction.DOWN;
      } else {
        enemy.dir = Math.random() < 0.5 ? Direction.LEFT : Direction.RIGHT;
      }
    }
  }
}

/**
 * Executes the basic attack once windup telegraph completes.
 */
function executeBasicAttack(
  enemy: Enemy,
  player: PlayerState,
  shootProjectile: (enemy: Enemy, type: 'rock' | 'arrow' | 'boomerang') => void,
  audio: BasicEnemyAudio,
  particles?: ParticleSystem
): void {
  // Ensure facing the player for the attack
  enemy.dir = getDirectionToPlayer(enemy, player);

  switch (enemy.type) {
    // Ranged Rock Spit Attack (Octoroks)
    case EnemyType.OCTOROK_RED:
    case EnemyType.OCTOROK_BLUE: {
      shootProjectile(enemy, 'rock');
      enemy.behaviorState = 'patrol';
      enemy.attackCooldown = 75 + Math.floor(Math.random() * 45); // ~1.2s - 2.0s
      if (enemy.patrolConfig) {
        enemy.patrolConfig.pauseTimer = 18; // Brief post-spit recoil pause
      }
      break;
    }

    // Ranged Arrow / Spear Attack (Moblins)
    case EnemyType.MOBLIN_RED:
    case EnemyType.MOBLIN_BLUE: {
      shootProjectile(enemy, 'arrow');
      enemy.behaviorState = 'patrol';
      enemy.attackCooldown = 80 + Math.floor(Math.random() * 40);
      if (enemy.patrolConfig) {
        enemy.patrolConfig.pauseTimer = 16;
      }
      break;
    }

    // Boomerang Throw Attack (Goriya)
    case EnemyType.GORIYA_RED: {
      shootProjectile(enemy, 'boomerang');
      enemy.behaviorState = 'patrol';
      enemy.attackCooldown = 110 + Math.floor(Math.random() * 40);
      if (enemy.patrolConfig) {
        enemy.patrolConfig.pauseTimer = 22;
      }
      break;
    }

    // Melee Lunge Attack (Rope, Keese, Gel, Zol)
    case EnemyType.ROPE:
    case EnemyType.KEESE:
    case EnemyType.GEL:
    case EnemyType.ZOL:
    default: {
      enemy.behaviorState = 'attack';
      enemy.lungeTimer = 22; // 22 frames of high-speed lunge
      audio.playMeleeLunge?.();
      if (particles) {
        particles.emitEmberPuff(enemy.x + 8, enemy.y + 8);
      }
      break;
    }
  }
}
