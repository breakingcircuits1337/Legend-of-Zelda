/**
 * The Legend of Zelda NES - Octorok Enemy Subclass
 *
 * Implements the classic 8-bit Octorok enemy subclass:
 * 1. Roams randomly across the screen in cardinal directions (changing direction
 *    periodically and turning away from walls/boundaries) with authentic 2-frame
 *    stepping animation.
 * 2. Periodically stops moving in its current stance with an 8-bit telegraph.
 * 3. Fires a stone rock projectile straight in the direction it is currently facing,
 *    accompanied by the authentic 2A03 chiptune rock spit audio.
 * 4. Pauses for a brief recoil period before resuming random roaming.
 */

import {
  Direction,
  Enemy,
  EnemyBehaviorState,
  EnemyType,
  ItemType,
  PlayerState,
} from '../types';
import { ParticleSystem } from './particles';

export type TileCollisionFn = (x: number, y: number, w: number, h: number) => boolean;

export interface RockProjectileData {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dir: Direction;
}

export type OctorokState = 'patrol' | 'stopping' | 'firing' | 'recoil';

export interface BaseEnemyOptions {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  dir?: Direction;
  health?: number;
  speed?: number;
  customData?: Record<string, any>;
}

/**
 * BaseEnemy: Object-oriented base class representing standard monster entities in the engine.
 */
export class BaseEnemy implements Enemy {
  public id: string;
  public type: EnemyType;
  public x: number;
  public y: number;
  public dir: Direction;
  public health: number;
  public maxHealth: number;
  public speed: number;
  public animFrame: number = 0;
  public animTimer: number = 0;
  public actionTimer: number = 0;
  public isHurt: boolean = false;
  public hurtTimer: number = 0;
  public isStunned: boolean = false;
  public stunTimer: number = 0;
  public isDead: boolean = false;
  public deathTimer: number = 0;
  public dropItem?: ItemType;
  public shootTimer?: number;
  public customData: Record<string, any>;
  public alertTimer?: number = 0;
  public behaviorState?: EnemyBehaviorState;
  public jumpYOffset?: number = 0;

  constructor(options: BaseEnemyOptions) {
    this.id = options.id;
    this.type = options.type;
    this.x = options.x;
    this.y = options.y;
    this.dir = options.dir ?? Direction.DOWN;
    this.health = options.health ?? 2;
    this.maxHealth = this.health;
    this.speed = options.speed ?? 0.8;
    this.customData = options.customData ?? {};
  }
}

export interface OctorokEnemyOptions {
  id: string;
  type?: EnemyType.OCTOROK_RED | EnemyType.OCTOROK_BLUE;
  x: number;
  y: number;
  dir?: Direction;
}

/**
 * OctorokEnemy: Subclass representing the iconic octopus monster of Hyrule.
 */
export class OctorokEnemy extends BaseEnemy {
  public state: OctorokState = 'patrol';
  public stateTimer: number = 0;
  public roamTurnTimer: number = 0;
  public isBlueVariant: boolean;
  public lastFiredTime: number = 0;
  public rockSpeed: number = 2.4;

  constructor(options: OctorokEnemyOptions) {
    const enemyType = options.type ?? EnemyType.OCTOROK_RED;
    const isBlue = enemyType === EnemyType.OCTOROK_BLUE;

    super({
      id: options.id,
      type: enemyType,
      x: options.x,
      y: options.y,
      dir: options.dir ?? Direction.DOWN,
      health: isBlue ? 3 : 2,
      speed: isBlue ? 1.0 : 0.8,
    });

    this.isBlueVariant = isBlue;
    this.rockSpeed = isBlue ? 2.8 : 2.4;
    this.initPatrol();
  }

  /**
   * Initializes a random roam cycle:
   * Chooses a random cardinal direction, sets the roam turn timer, and sets the
   * duration before stopping to fire (90 to 165 frames = ~1.5 to 2.75 seconds).
   */
  public initPatrol(preserveDirection: boolean = false): void {
    this.state = 'patrol';
    this.behaviorState = 'patrol';
    // Roam for ~1.5 to 2.75 seconds before stopping to shoot
    this.stateTimer = 90 + Math.floor(Math.random() * 75);
    this.roamTurnTimer = 40 + Math.floor(Math.random() * 45);

    if (!preserveDirection) {
      const dirs = [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT];
      this.dir = dirs[Math.floor(Math.random() * dirs.length)];
    }
  }

  /**
   * Main update routine invoked each frame by the engine.
   */
  public update(
    player: PlayerState,
    checkTileCollision: TileCollisionFn,
    spawnRockProjectile: (rock: RockProjectileData) => void,
    damagePlayer: (dmg: number, dir: Direction) => void,
    audio?: { playRockSpit?: () => void; playEnemyAlert?: () => void },
    particles?: ParticleSystem
  ): void {
    // 1. Decrement visual 8-bit alert telegraph timer
    if (this.alertTimer && this.alertTimer > 0) {
      this.alertTimer--;
    }

    // 2. Finite state update: patrol (roam) -> stopping -> fire rock -> recoil -> patrol
    switch (this.state) {
      case 'patrol':
        this.updatePatrol(checkTileCollision, audio);
        break;

      case 'stopping':
        this.updateStopping(spawnRockProjectile, audio, particles);
        break;

      case 'recoil':
        this.updateRecoil();
        break;
    }

    // 3. Contact damage check against Link
    const distToPlayer = Math.hypot(this.x - player.x, this.y - player.y);
    if (distToPlayer < 14) {
      damagePlayer(1, this.dir);
    }
  }

  /**
   * Roams randomly across the screen in cardinal directions.
   * Handles 8-bit stepping animation, random direction turns, screen boundaries,
   * and solid obstacle avoidance.
   */
  private updatePatrol(
    checkTileCollision: TileCollisionFn,
    audio?: { playEnemyAlert?: () => void }
  ): void {
    this.stateTimer--;
    this.roamTurnTimer--;

    // 8-bit stepping animation: alternate feet every 8 frames
    this.animTimer++;
    if (this.animTimer > 8) {
      this.animFrame = (this.animFrame + 1) % 2;
      this.animTimer = 0;
    }

    // Periodically pick a new random direction while roaming
    if (this.roamTurnTimer <= 0 && this.stateTimer > 20) {
      this.pickRandomOpenDirection(checkTileCollision);
      this.roamTurnTimer = 40 + Math.floor(Math.random() * 50);
    }

    // Calculate movement vector along current facing direction
    const [vx, vy] = this.getCardinalVelocity(this.dir, this.speed);
    const nextX = this.x + vx;
    const nextY = this.y + vy;

    // Check screen boundaries (16 <= X <= 224, 16 <= Y <= 144)
    const hitScreenEdge = this.isOutOfBounds(this.dir, nextX, nextY);
    const hitSolid = checkTileCollision(nextX, nextY, 14, 14);

    if (!hitScreenEdge && !hitSolid) {
      this.x = nextX;
      this.y = nextY;
    } else {
      // Hit an obstacle or boundary during roaming: pick a new open random direction
      this.pickRandomOpenDirection(checkTileCollision);
      this.roamTurnTimer = 35 + Math.floor(Math.random() * 40);
    }

    // When the roaming duration completes:
    // Stop moving and prepare to fire a rock in the direction currently facing
    if (this.stateTimer <= 0) {
      this.beginStopping(audio);
    }
  }

  private isOutOfBounds(dir: Direction, x: number, y: number): boolean {
    return (
      (dir === Direction.LEFT && x < 16) ||
      (dir === Direction.RIGHT && x > 224) ||
      (dir === Direction.UP && y < 16) ||
      (dir === Direction.DOWN && y > 144)
    );
  }

  private getCardinalVelocity(dir: Direction, speed: number): [number, number] {
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
   * Picks a random open cardinal direction (avoiding immediate walls or screen edges).
   */
  public pickRandomOpenDirection(checkTileCollision: TileCollisionFn): void {
    const dirs = [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT];
    const openDirs = dirs.filter((d) => {
      const [vx, vy] = this.getCardinalVelocity(d, this.speed);
      const nx = this.x + vx;
      const ny = this.y + vy;
      return !this.isOutOfBounds(d, nx, ny) && !checkTileCollision(nx, ny, 14, 14);
    });

    if (openDirs.length > 0) {
      // Prefer changing to a different direction if multiple are open
      const otherOpen = openDirs.filter((d) => d !== this.dir);
      const pool = otherOpen.length > 0 ? otherOpen : openDirs;
      this.dir = pool[Math.floor(Math.random() * pool.length)];
    } else {
      this.turnAround();
    }
  }

  /**
   * Turns the Octorok 180 degrees.
   */
  private turnAround(): void {
    switch (this.dir) {
      case Direction.UP:
        this.dir = Direction.DOWN;
        break;
      case Direction.DOWN:
        this.dir = Direction.UP;
        break;
      case Direction.LEFT:
        this.dir = Direction.RIGHT;
        break;
      case Direction.RIGHT:
        this.dir = Direction.LEFT;
        break;
    }
  }

  /**
   * Transitions from roaming to stopping phase:
   * Halts movement while preserving the Octorok's current facing direction,
   * and displays an 8-bit telegraph before spitting a rock.
   */
  private beginStopping(audio?: { playEnemyAlert?: () => void }): void {
    this.state = 'stopping';
    this.behaviorState = 'windup';
    // Stopping pause: ~0.35 - 0.5 seconds (20-28 frames)
    this.stateTimer = 20 + Math.floor(Math.random() * 8);

    // 8-bit visual alert spark telegraph above Octorok
    this.alertTimer = 16;

    // Play subtle chiptune alert cue
    audio?.playEnemyAlert?.();
  }

  /**
   * Stopping state update:
   * Holds stationary position in current facing direction, then fires a rock straight ahead.
   */
  private updateStopping(
    spawnRockProjectile: (rock: RockProjectileData) => void,
    audio?: { playRockSpit?: () => void },
    particles?: ParticleSystem
  ): void {
    this.stateTimer--;

    if (this.stateTimer <= 0) {
      this.fireRock(spawnRockProjectile, audio, particles);
    }
  }

  /**
   * Fires a rock projectile strictly in the direction the Octorok is currently facing.
   */
  public fireRock(
    spawnRockProjectile: (rock: RockProjectileData) => void,
    audio?: { playRockSpit?: () => void },
    particles?: ParticleSystem
  ): void {
    const [vx, vy] = this.getCardinalVelocity(this.dir, this.rockSpeed);

    // Spawn aligned with the Octorok's 16x16 frame so drawProjectile centers it cleanly
    const spawnX = this.x;
    const spawnY = this.y;

    spawnRockProjectile({
      x: spawnX,
      y: spawnY,
      vx,
      vy,
      dir: this.dir,
    });

    // Authentic NES 2A03 stone spit audio
    audio?.playRockSpit?.();

    // Visual dust puff at snout
    if (particles) {
      const puffOffsetX =
        this.dir === Direction.RIGHT ? 14 : this.dir === Direction.LEFT ? 2 : 8;
      const puffOffsetY =
        this.dir === Direction.DOWN ? 14 : this.dir === Direction.UP ? 2 : 8;
      particles.emitEmberPuff(this.x + puffOffsetX, this.y + puffOffsetY);
    }

    this.lastFiredTime = Date.now();

    // Enter brief post-fire recoil pause (~0.25 seconds / 16 frames)
    this.state = 'recoil';
    this.behaviorState = 'patrol';
    this.stateTimer = 16;
  }

  /**
   * Post-shot recoil pause before beginning the next random roam cycle.
   */
  private updateRecoil(): void {
    this.stateTimer--;
    if (this.stateTimer <= 0) {
      // Resume roaming in a new random direction
      this.initPatrol();
    }
  }
}
