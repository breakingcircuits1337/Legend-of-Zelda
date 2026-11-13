/**
 * The Legend of Zelda NES - Goriya Enemy Subclass
 *
 * Implements the classic horned boomerang demon of Hyrule:
 * 1. Wanders the room in the 4 cardinal directions with authentic 8-bit stepping cadence,
 *    screen boundary handling, and solid tile collision avoidance.
 * 2. Periodically stops to throw a spinning golden boomerang in the direction it is currently facing.
 * 3. The boomerang travels outward, reversing at its apex or upon hitting a solid obstacle,
 *    and returns to the Goriya (which catches it).
 * 4. Poses a serious ranged projectile threat that the player must dodge or block with their shield.
 */

import { Direction, EnemyType, PlayerState } from '../types';
import { BaseEnemy } from './octorokEnemy';
import { ParticleSystem } from './particles';

export type TileCollisionFn = (x: number, y: number, w: number, h: number) => boolean;

export interface BoomerangProjectileData {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dir: Direction;
  throwerId: string;
}

export type GoriyaState = 'wander' | 'windup' | 'recoil';

export interface GoriyaAudio {
  playBoomerang?: () => void;
  playEnemyAlert?: () => void;
}

export interface GoriyaEnemyOptions {
  id: string;
  x: number;
  y: number;
  dir?: Direction;
  health?: number;
  speed?: number;
}

export class GoriyaEnemy extends BaseEnemy {
  public state: GoriyaState = 'wander';
  public stateTimer: number = 0;
  public wanderDirTimer: number = 60;
  public throwCooldown: number = 140;
  public hasBoomerangOut: boolean = false;
  public boomerangSpeed: number = 3.2;

  constructor(options: GoriyaEnemyOptions) {
    super({
      id: options.id,
      type: EnemyType.GORIYA_RED,
      x: options.x,
      y: options.y,
      dir: options.dir ?? Direction.DOWN,
      health: options.health ?? 3,
      speed: options.speed ?? 0.75,
      customData: {
        hasBoomerangOut: false,
      },
    });

    this.throwCooldown = 110 + Math.floor(Math.random() * 80);
    this.wanderDirTimer = 40 + Math.floor(Math.random() * 50);
    this.behaviorState = 'patrol';
  }

  /**
   * Main update routine invoked each frame by the engine.
   */
  public update(
    player: PlayerState,
    checkTileCollision: TileCollisionFn,
    spawnBoomerang: (boomerang: BoomerangProjectileData) => void,
    damagePlayer: (dmg: number, dir: Direction) => void,
    audio?: GoriyaAudio,
    particles?: ParticleSystem
  ): void {
    // 1. Decrement visual 8-bit alert telegraph
    if (this.alertTimer && this.alertTimer > 0) {
      this.alertTimer--;
    }

    // 2. Finite state update: wander -> windup -> throw & recoil -> wander
    switch (this.state) {
      case 'wander':
        this.updateWander(checkTileCollision, audio);
        break;

      case 'windup':
        this.updateWindup(spawnBoomerang, audio, particles);
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
   * Wandering phase:
   * Moves across the room in the current facing direction with authentic 8-bit cadence.
   * Periodically triggers boomerang throwing when cooldown expires.
   */
  private updateWander(
    checkTileCollision: TileCollisionFn,
    audio?: GoriyaAudio
  ): void {
    // Decrement throw cooldown if boomerang is not currently in flight
    if (!this.hasBoomerangOut) {
      this.throwCooldown--;
      if (this.throwCooldown <= 0) {
        this.beginThrowWindup(audio);
        return;
      }
    }

    // Animate walking steps
    this.animTimer++;
    if (this.animTimer > 8) {
      this.animFrame = (this.animFrame + 1) % 2;
      this.animTimer = 0;
    }

    // Wandering direction duration countdown
    this.wanderDirTimer--;
    if (this.wanderDirTimer <= 0) {
      this.changeWanderDirection();
    }

    // Calculate movement along current facing direction
    let vx = 0;
    let vy = 0;
    if (this.dir === Direction.UP) vy = -this.speed;
    else if (this.dir === Direction.DOWN) vy = this.speed;
    else if (this.dir === Direction.LEFT) vx = -this.speed;
    else if (this.dir === Direction.RIGHT) vx = this.speed;

    const nextX = this.x + vx;
    const nextY = this.y + vy;

    // Check screen boundaries (16 <= X <= 224, 16 <= Y <= 144)
    const hitScreenEdge =
      (this.dir === Direction.LEFT && nextX < 16) ||
      (this.dir === Direction.RIGHT && nextX > 224) ||
      (this.dir === Direction.UP && nextY < 16) ||
      (this.dir === Direction.DOWN && nextY > 144);

    const hitSolidTile = checkTileCollision(nextX, nextY, 14, 14);

    if (!hitScreenEdge && !hitSolidTile) {
      this.x = nextX;
      this.y = nextY;
    } else {
      // Encountered an obstacle or boundary: turn to an open direction
      this.handleObstacleCollision();
    }
  }

  /**
   * Selects a fresh random cardinal direction to wander towards.
   */
  public changeWanderDirection(): void {
    const dirs = [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT];
    this.dir = dirs[Math.floor(Math.random() * dirs.length)];
    this.wanderDirTimer = 45 + Math.floor(Math.random() * 50);
  }

  /**
   * Handles turning away from walls or room boundaries.
   */
  private handleObstacleCollision(): void {
    const oppositeDir = this.getOppositeDirection(this.dir);
    // 60% chance to turn perpendicular, 40% chance to reverse
    if (Math.random() < 0.6) {
      if (this.dir === Direction.UP || this.dir === Direction.DOWN) {
        this.dir = Math.random() < 0.5 ? Direction.LEFT : Direction.RIGHT;
      } else {
        this.dir = Math.random() < 0.5 ? Direction.UP : Direction.DOWN;
      }
    } else {
      this.dir = oppositeDir;
    }
    this.wanderDirTimer = 40 + Math.floor(Math.random() * 40);
  }

  /**
   * Reverses a cardinal direction.
   */
  private getOppositeDirection(dir: Direction): Direction {
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
   * Initiates the boomerang throw windup telegraph:
   * Stops moving and displays an 8-bit visual alert spark.
   */
  private beginThrowWindup(audio?: GoriyaAudio): void {
    this.state = 'windup';
    this.behaviorState = 'windup';
    this.stateTimer = 16; // 16 frames (~0.26s) telegraph
    this.alertTimer = 16; // 8-bit warning spark

    audio?.playEnemyAlert?.();
  }

  /**
   * Windup update:
   * Holds position and prepares the throw, then fires boomerang along facing direction.
   */
  private updateWindup(
    spawnBoomerang: (boomerang: BoomerangProjectileData) => void,
    audio?: GoriyaAudio,
    particles?: ParticleSystem
  ): void {
    this.stateTimer--;

    if (this.stateTimer <= 0) {
      this.throwBoomerang(spawnBoomerang, audio, particles);
    }
  }

  /**
   * Releases the boomerang projectile along the exact direction Goriya is facing.
   */
  public throwBoomerang(
    spawnBoomerang: (boomerang: BoomerangProjectileData) => void,
    audio?: GoriyaAudio,
    particles?: ParticleSystem
  ): void {
    let vx = 0;
    let vy = 0;
    if (this.dir === Direction.UP) vy = -this.boomerangSpeed;
    else if (this.dir === Direction.DOWN) vy = this.boomerangSpeed;
    else if (this.dir === Direction.LEFT) vx = -this.boomerangSpeed;
    else if (this.dir === Direction.RIGHT) vx = this.boomerangSpeed;

    const spawnX = this.x + (this.dir === Direction.RIGHT ? 12 : this.dir === Direction.LEFT ? 0 : 6);
    const spawnY = this.y + (this.dir === Direction.DOWN ? 12 : this.dir === Direction.UP ? 0 : 6);

    spawnBoomerang({
      x: spawnX,
      y: spawnY,
      vx,
      vy,
      dir: this.dir,
      throwerId: this.id,
    });

    this.hasBoomerangOut = true;
    if (this.customData) {
      this.customData.hasBoomerangOut = true;
    }

    // 2A03 chiptune boomerang whirling sound
    audio?.playBoomerang?.();

    if (particles) {
      particles.emitEmberPuff(spawnX + 4, spawnY + 4);
    }

    // Enter brief post-throw recoil
    this.state = 'recoil';
    this.behaviorState = 'patrol';
    this.stateTimer = 12;
    this.throwCooldown = 150 + Math.floor(Math.random() * 80); // ~2.5 - 3.8s cooldown
  }

  /**
   * Post-throw recoil phase before resuming wandering.
   */
  private updateRecoil(): void {
    this.stateTimer--;
    if (this.stateTimer <= 0) {
      this.state = 'wander';
      this.behaviorState = 'patrol';
    }
  }

  /**
   * Called by the engine when the returning boomerang reaches Goriya.
   */
  public catchBoomerang(): void {
    this.hasBoomerangOut = false;
    if (this.customData) {
      this.customData.hasBoomerangOut = false;
    }
  }
}
