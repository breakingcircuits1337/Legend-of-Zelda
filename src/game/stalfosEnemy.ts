/**
 * The Legend of Zelda NES - Stalfos Enemy Subclass
 *
 * Implements the classic dungeon skeleton soldier:
 * 1. Predictable Rhythmic Grid-Based Movement:
 *    - Steps in crisp 16px dungeon tile beats strictly along cardinal
 *      horizontal and vertical axes with brief rhythmic pauses between beats.
 * 2. Periodic Jumping & Horizontal/Vertical Shifting:
 *    - Predictably shifts between horizontal and vertical grid lanes every
 *      few tiles (and at walls/intersections), persistently navigating toward
 *      Link's dungeon row/column.
 *    - Every 3rd beat, executes a rhythmic parabolic grid jump (`jumpYOffset > 0`)
 *      covering 2 tiles horizontally or vertically with bone-rattle audio.
 * 3. Persistent Dungeon Threat:
 *    - Deals contact melee damage on collision while patrolling dungeon rooms.
 */

import { Direction, EnemyType, PlayerState } from '../types';
import { BaseEnemy } from './octorokEnemy';
import { ParticleSystem } from './particles';

export type TileCollisionFn = (x: number, y: number, w: number, h: number) => boolean;

export type StalfosState = 'pause' | 'march' | 'jump';

export interface StalfosAudio {
  playStalfosJump?: () => void;
  playEnemyAlert?: () => void;
}

export interface StalfosEnemyOptions {
  id: string;
  x: number;
  y: number;
  dir?: Direction;
  health?: number;
  speed?: number;
}

export class StalfosEnemy extends BaseEnemy {
  public stalfosState: StalfosState = 'pause';
  public gridSize: number = 16;
  public stepRemaining: number = 16;
  public pauseTimer: number = 8;
  public beatCount: number = 0;
  public stepsInDirection: number = 0;
  public maxStepsBeforeShift: number = 2;
  public jumpTimer: number = 0;
  public totalJumpDuration: number = 16;
  public override jumpYOffset: number = 0;
  public maxJumpHeight: number = 7;
  public jumpVx: number = 0;
  public jumpVy: number = 0;
  public jumpSpeed: number = 2.0;
  public meleeDamage: number = 1;

  constructor(options: StalfosEnemyOptions) {
    super({
      id: options.id,
      type: EnemyType.STALFOS,
      x: options.x,
      y: options.y,
      dir: options.dir ?? Direction.RIGHT,
      health: options.health ?? 2,
      speed: options.speed ?? 1.0,
    });

    this.behaviorState = 'patrol';
    this.pauseTimer = 8;
    this.stalfosState = 'pause';
  }

  /**
   * Main update routine invoked each frame by the engine.
   */
  public update(
    player: PlayerState,
    checkTileCollision: TileCollisionFn,
    damagePlayer: (dmg: number, dir: Direction) => void,
    audio?: StalfosAudio,
    particles?: ParticleSystem
  ): void {
    if (this.alertTimer && this.alertTimer > 0) {
      this.alertTimer--;
    }

    switch (this.stalfosState) {
      case 'pause':
        this.updatePause(player, checkTileCollision, audio, particles);
        break;

      case 'march':
        this.updateMarch(checkTileCollision);
        break;

      case 'jump':
        this.updateJump(checkTileCollision, particles);
        break;
    }

    // Contact melee damage against Link
    const distToPlayer = Math.hypot(this.x - player.x, this.y - player.y);
    if (distToPlayer < 14) {
      damagePlayer(this.meleeDamage, this.dir);
    }
  }

  /**
   * Brief rhythmic cadence pause between grid steps and jumps.
   */
  private updatePause(
    player: PlayerState,
    checkTileCollision: TileCollisionFn,
    audio?: StalfosAudio,
    particles?: ParticleSystem
  ): void {
    this.jumpYOffset = 0;
    this.pauseTimer--;

    if (this.pauseTimer <= 0) {
      this.advanceGridBeat(player, checkTileCollision, audio, particles);
    }
  }

  /**
   * Selects the next rhythmic action:
   * - Shifts horizontally <-> vertically every `maxStepsBeforeShift` grid steps or when blocked.
   * - Every 3rd beat, jumps across 2 grid tiles; otherwise marches 1 grid tile.
   */
  public advanceGridBeat(
    player: PlayerState,
    checkTileCollision: TileCollisionFn,
    audio?: StalfosAudio,
    particles?: ParticleSystem
  ): void {
    this.beatCount++;

    const forwardBlocked = !this.canStepDirection(this.dir, this.gridSize, checkTileCollision);
    if (forwardBlocked || this.stepsInDirection >= this.maxStepsBeforeShift) {
      this.shiftAxisDirection(player, checkTileCollision);
      this.stepsInDirection = 0;
    }

    if (this.beatCount % 3 === 0) {
      this.startGridJump(audio, particles);
    } else {
      this.startGridMarch();
    }
  }

  /**
   * Begins marching 1 grid tile (16px) strictly along current cardinal direction.
   */
  public startGridMarch(): void {
    this.stalfosState = 'march';
    this.behaviorState = 'patrol';
    this.stepRemaining = this.gridSize;
    this.jumpYOffset = 0;
  }

  /**
   * Begins a rhythmic parabolic grid jump strictly along current cardinal direction.
   */
  public startGridJump(audio?: StalfosAudio, particles?: ParticleSystem): void {
    this.stalfosState = 'jump';
    this.behaviorState = 'attack';
    this.totalJumpDuration = 16;
    this.jumpTimer = this.totalJumpDuration;

    const [vx, vy] = this.getCardinalVelocity(this.dir, this.jumpSpeed);
    this.jumpVx = vx;
    this.jumpVy = vy;
    this.stepsInDirection++;

    audio?.playStalfosJump?.();
    particles?.emitEmberPuff(this.x + 8, this.y + 12);
  }

  /**
   * Marches cleanly along the horizontal or vertical grid track until the 16px step finishes.
   */
  private updateMarch(checkTileCollision: TileCollisionFn): void {
    this.animTimer++;
    if (this.animTimer > 4) {
      this.animFrame = (this.animFrame + 1) % 2;
      this.animTimer = 0;
    }

    const stepSize = Math.min(this.speed, this.stepRemaining);
    const [vx, vy] = this.getCardinalVelocity(this.dir, stepSize);
    const nextX = this.x + vx;
    const nextY = this.y + vy;

    if (this.isOutOfBounds(nextX, nextY) || checkTileCollision(nextX, nextY, 14, 14)) {
      this.stalfosState = 'pause';
      this.pauseTimer = 8;
      this.stepsInDirection = this.maxStepsBeforeShift; // Force axis shift next beat
      return;
    }

    this.x = nextX;
    this.y = nextY;
    this.stepRemaining -= stepSize;

    if (this.stepRemaining <= 0.001) {
      this.x = Math.round(this.x);
      this.y = Math.round(this.y);
      this.stepsInDirection++;
      this.stalfosState = 'pause';
      this.pauseTimer = 6;
    }
  }

  /**
   * Executes rhythmic parabolic hop along strict horizontal or vertical grid axis.
   */
  private updateJump(
    checkTileCollision: TileCollisionFn,
    particles?: ParticleSystem
  ): void {
    this.jumpTimer--;

    const progress = 1 - Math.max(0, this.jumpTimer) / this.totalJumpDuration;
    this.jumpYOffset = Math.sin(progress * Math.PI) * this.maxJumpHeight;

    this.animTimer++;
    if (this.animTimer > 3) {
      this.animFrame = (this.animFrame + 1) % 2;
      this.animTimer = 0;
    }

    const nextX = this.x + this.jumpVx;
    const nextY = this.y + this.jumpVy;

    if (!this.isOutOfBounds(nextX, nextY) && !checkTileCollision(nextX, nextY, 14, 14)) {
      this.x = nextX;
      this.y = nextY;
    } else {
      this.jumpVx = 0;
      this.jumpVy = 0;
    }

    if (this.jumpTimer <= 0) {
      this.x = Math.round(this.x);
      this.y = Math.round(this.y);
      this.jumpYOffset = 0;
      this.jumpVx = 0;
      this.jumpVy = 0;
      this.stalfosState = 'pause';
      this.behaviorState = 'patrol';
      this.pauseTimer = 10;

      particles?.emitEmberPuff(this.x + 8, this.y + 12);
    }
  }

  /**
   * Shifts predictably between horizontal and vertical axes, preferring open
   * orthogonal lanes oriented toward the player's row/column.
   */
  public shiftAxisDirection(
    player: PlayerState,
    checkTileCollision: TileCollisionFn
  ): void {
    const isHorizontal = this.dir === Direction.LEFT || this.dir === Direction.RIGHT;
    const orthogonalPair: [Direction, Direction] = isHorizontal
      ? player.y >= this.y
        ? [Direction.DOWN, Direction.UP]
        : [Direction.UP, Direction.DOWN]
      : player.x >= this.x
        ? [Direction.RIGHT, Direction.LEFT]
        : [Direction.LEFT, Direction.RIGHT];

    for (const candidate of orthogonalPair) {
      if (this.canStepDirection(candidate, this.gridSize, checkTileCollision)) {
        this.dir = candidate;
        return;
      }
    }

    // If both orthogonal axes are blocked, reverse along current axis or keep open direction
    const opposite = this.getOppositeDirection(this.dir);
    if (this.canStepDirection(opposite, this.gridSize, checkTileCollision)) {
      this.dir = opposite;
    }
  }

  private canStepDirection(
    dir: Direction,
    distance: number,
    checkTileCollision: TileCollisionFn
  ): boolean {
    const [vx, vy] = this.getCardinalVelocity(dir, distance);
    const nx = this.x + vx;
    const ny = this.y + vy;
    return !this.isOutOfBounds(nx, ny) && !checkTileCollision(nx, ny, 14, 14);
  }

  private isOutOfBounds(x: number, y: number): boolean {
    return x < 16 || x > 224 || y < 16 || y > 144;
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
}
