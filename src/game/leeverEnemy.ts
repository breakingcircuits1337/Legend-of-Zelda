/**
 * The Legend of Zelda NES - Leever Enemy Subclass
 *
 * Implements the classic desert-burrowing Leever enemy:
 * 1. Periodically emerges from beneath the ground with a dirt-mound telegraph
 *    at an open, safe distance along a clear traversal lane.
 * 2. Moves smoothly in a straight cardinal line across the screen while
 *    spinning its spiky petals, posing a traversal-based melee hazard.
 * 3. Disappears back into the ground (burrows and submerges underground,
 *    becoming invisible and intangible) upon completing its pass or reaching
 *    a wall/screen boundary, before emerging again elsewhere.
 */

import { Direction, EnemyType, PlayerState } from '../types';
import { BaseEnemy } from './octorokEnemy';
import { ParticleSystem } from './particles';

export type TileCollisionFn = (x: number, y: number, w: number, h: number) => boolean;

export type LeeverState = 'submerged' | 'emerging' | 'moving' | 'burrowing';

export interface LeeverAudio {
  playLeeverEmerge?: () => void;
  playLeeverBurrow?: () => void;
  playEnemyAlert?: () => void;
}

export interface LeeverEnemyOptions {
  id: string;
  x: number;
  y: number;
  dir?: Direction;
  health?: number;
  speed?: number;
  initialState?: LeeverState;
}

export class LeeverEnemy extends BaseEnemy {
  public leeverState: LeeverState = 'submerged';
  public stateTimer: number = 0;
  public isBurrowing: boolean = false;
  public isSubmerged: boolean = true;
  public meleeDamage: number = 1;
  public emergeCount: number = 0;

  constructor(options: LeeverEnemyOptions) {
    super({
      id: options.id,
      type: EnemyType.LEEVER_RED,
      x: options.x,
      y: options.y,
      dir: options.dir ?? Direction.RIGHT,
      health: options.health ?? 2,
      speed: options.speed ?? 1.15,
    });

    this.behaviorState = 'patrol';
    const initial = options.initialState ?? 'submerged';
    this.leeverState = initial;

    if (initial === 'submerged') {
      this.isSubmerged = true;
      this.isBurrowing = false;
      this.stateTimer = 25 + Math.floor(Math.random() * 55);
    } else if (initial === 'emerging') {
      this.isSubmerged = false;
      this.isBurrowing = true;
      this.stateTimer = 24;
    } else if (initial === 'moving') {
      this.isSubmerged = false;
      this.isBurrowing = false;
      this.stateTimer = 110 + Math.floor(Math.random() * 65);
    } else {
      this.isSubmerged = false;
      this.isBurrowing = true;
      this.stateTimer = 22;
    }

    this.syncCustomData();
  }

  private syncCustomData(): void {
    this.customData.isBurrowing = this.isBurrowing;
    this.customData.isSubmerged = this.isSubmerged;
    this.customData.leeverState = this.leeverState;
  }

  /**
   * Main update routine invoked each frame by the engine.
   */
  public update(
    player: PlayerState,
    checkTileCollision: TileCollisionFn,
    damagePlayer: (dmg: number, dir: Direction) => void,
    audio?: LeeverAudio,
    particles?: ParticleSystem
  ): void {
    if (this.alertTimer && this.alertTimer > 0) {
      this.alertTimer--;
    }

    switch (this.leeverState) {
      case 'submerged':
        this.updateSubmerged(player, checkTileCollision, audio, particles);
        break;

      case 'emerging':
        this.updateEmerging();
        break;

      case 'moving':
        this.updateMoving(checkTileCollision, audio, particles);
        break;

      case 'burrowing':
        this.updateBurrowing();
        break;
    }

    // Contact damage only when surfaced and actively traversing the ground
    if (this.leeverState === 'moving') {
      const distToPlayer = Math.hypot(this.x - player.x, this.y - player.y);
      if (distToPlayer < 13) {
        damagePlayer(this.meleeDamage, this.dir);
      }
    }

    this.syncCustomData();
  }

  /**
   * Underground hidden phase:
   * Waits submerged beneath the sand until its timer expires, then emerges.
   */
  private updateSubmerged(
    player: PlayerState,
    checkTileCollision: TileCollisionFn,
    audio?: LeeverAudio,
    particles?: ParticleSystem
  ): void {
    this.isSubmerged = true;
    this.isBurrowing = false;
    this.stateTimer--;

    if (this.stateTimer <= 0) {
      this.emerge(player, checkTileCollision, audio, particles);
    }
  }

  /**
   * Emerges from the ground at an open position with a clear straight-line path,
   * preferring horizontal or vertical lanes near Link without spawning on top of him.
   */
  public emerge(
    player: PlayerState,
    checkTileCollision: TileCollisionFn,
    audio?: LeeverAudio,
    particles?: ParticleSystem
  ): void {
    const chosen = this.chooseEmergeSpotAndDirection(player, checkTileCollision);
    this.x = chosen.x;
    this.y = chosen.y;
    this.dir = chosen.dir;

    this.leeverState = 'emerging';
    this.isBurrowing = true;
    this.isSubmerged = false;
    this.behaviorState = 'patrol';
    this.stateTimer = 24;
    this.alertTimer = 14;
    this.animFrame = 0;
    this.animTimer = 0;
    this.emergeCount++;

    audio?.playLeeverEmerge?.();
    particles?.emitEmberPuff(this.x + 8, this.y + 8);
    this.syncCustomData();
  }

  private chooseEmergeSpotAndDirection(
    player: PlayerState,
    checkTileCollision: TileCollisionFn
  ): { x: number; y: number; dir: Direction } {
    const dirs = [Direction.LEFT, Direction.RIGHT, Direction.UP, Direction.DOWN];

    for (let attempt = 0; attempt < 18; attempt++) {
      let cx: number;
      let cy: number;
      let dir: Direction;

      if (attempt < 10) {
        // Align with Link's row or column at a fair offset so Leever crosses his lane
        const horizontal = attempt % 2 === 0;
        const offset = 56 + Math.random() * 56;
        if (horizontal) {
          const fromLeft = player.x > 128 || (player.x >= 72 && Math.random() < 0.5);
          cx = fromLeft
            ? Math.max(16, player.x - offset)
            : Math.min(224, player.x + offset);
          cy = Math.max(16, Math.min(144, player.y + (Math.random() - 0.5) * 16));
          dir = fromLeft ? Direction.RIGHT : Direction.LEFT;
        } else {
          const fromTop = player.y > 88 || (player.y >= 56 && Math.random() < 0.5);
          cx = Math.max(16, Math.min(224, player.x + (Math.random() - 0.5) * 16));
          cy = fromTop
            ? Math.max(16, player.y - offset)
            : Math.min(144, player.y + offset);
          dir = fromTop ? Direction.DOWN : Direction.UP;
        }
      } else {
        // Open random screen coordinate & straight cardinal direction
        cx = 24 + Math.random() * 192;
        cy = 24 + Math.random() * 112;
        dir = dirs[Math.floor(Math.random() * dirs.length)];
      }

      cx = Math.round(Math.max(16, Math.min(224, cx)));
      cy = Math.round(Math.max(16, Math.min(144, cy)));

      const distToPlayer = Math.hypot(cx - player.x, cy - player.y);
      if (distToPlayer < 32) continue;
      if (checkTileCollision(cx, cy, 14, 14)) continue;

      const runway = this.measureClearRunway(cx, cy, dir, checkTileCollision);
      if (runway >= 36) {
        return { x: cx, y: cy, dir };
      }
    }

    // Fallback: keep clamped current coordinates and pick direction with longest straight runway
    const fx = Math.max(16, Math.min(224, this.x));
    const fy = Math.max(16, Math.min(144, this.y));
    let bestDir = this.dir;
    let bestRunway = -1;

    for (const d of dirs) {
      const runway = this.measureClearRunway(fx, fy, d, checkTileCollision);
      if (runway > bestRunway) {
        bestRunway = runway;
        bestDir = d;
      }
    }

    return { x: fx, y: fy, dir: bestDir };
  }

  private measureClearRunway(
    startX: number,
    startY: number,
    dir: Direction,
    checkTileCollision: TileCollisionFn
  ): number {
    const [vx, vy] = this.getCardinalVelocity(dir, 8);
    let dist = 0;
    for (let step = 1; step <= 16; step++) {
      const tx = startX + vx * step;
      const ty = startY + vy * step;
      if (tx < 16 || tx > 224 || ty < 16 || ty > 144) break;
      if (checkTileCollision(tx, ty, 14, 14)) break;
      dist += 8;
    }
    return dist;
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
   * Emerging dirt-mound phase:
   * Shakes briefly as the Leever breaks through the surface before dashing straight ahead.
   */
  private updateEmerging(): void {
    this.isBurrowing = true;
    this.isSubmerged = false;
    this.stateTimer--;

    this.animTimer++;
    if (this.animTimer > 5) {
      this.animFrame = (this.animFrame + 1) % 2;
      this.animTimer = 0;
    }

    if (this.stateTimer <= 0) {
      this.leeverState = 'moving';
      this.isBurrowing = false;
      this.isSubmerged = false;
      this.stateTimer = 110 + Math.floor(Math.random() * 65);
    }
  }

  /**
   * Straight-line surface traversal phase:
   * Spins and travels in a straight line along `this.dir` until its traversal timer ends
   * or it encounters a wall / screen boundary, then disappears back into the ground.
   */
  private updateMoving(
    checkTileCollision: TileCollisionFn,
    audio?: LeeverAudio,
    particles?: ParticleSystem
  ): void {
    this.isBurrowing = false;
    this.isSubmerged = false;
    this.stateTimer--;

    // Rapid spinning petal animation
    this.animTimer++;
    if (this.animTimer > 4) {
      this.animFrame = (this.animFrame + 1) % 2;
      this.animTimer = 0;
    }

    const [vx, vy] = this.getCardinalVelocity(this.dir, this.speed);
    const nextX = this.x + vx;
    const nextY = this.y + vy;

    const hitScreenEdge = nextX < 16 || nextX > 224 || nextY < 16 || nextY > 144;
    const hitSolid = checkTileCollision(nextX, nextY, 14, 14);

    if (hitScreenEdge || hitSolid) {
      this.beginBurrow(audio, particles);
      return;
    }

    this.x = nextX;
    this.y = nextY;

    if (this.stateTimer <= 0) {
      this.beginBurrow(audio, particles);
    }
  }

  /**
   * Begins disappearing back into the ground.
   */
  public beginBurrow(audio?: LeeverAudio, particles?: ParticleSystem): void {
    this.leeverState = 'burrowing';
    this.isBurrowing = true;
    this.isSubmerged = false;
    this.behaviorState = 'patrol';
    this.stateTimer = 22;

    audio?.playLeeverBurrow?.();
    particles?.emitEmberPuff(this.x + 8, this.y + 8);
    this.syncCustomData();
  }

  /**
   * Burrowing sink phase:
   * Renders the receding dirt mound before fully submerging underground.
   */
  private updateBurrowing(): void {
    this.isBurrowing = true;
    this.isSubmerged = false;
    this.stateTimer--;

    this.animTimer++;
    if (this.animTimer > 5) {
      this.animFrame = (this.animFrame + 1) % 2;
      this.animTimer = 0;
    }

    if (this.stateTimer <= 0) {
      this.leeverState = 'submerged';
      this.isBurrowing = false;
      this.isSubmerged = true;
      this.stateTimer = 60 + Math.floor(Math.random() * 70);
    }
  }
}
