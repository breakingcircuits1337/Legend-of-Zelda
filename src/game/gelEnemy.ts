/**
 * The Legend of Zelda NES - Gel Enemy Subclass
 *
 * Implements the small, weak swarm-based dungeon blob:
 * 1. Low Health & Slow Swarm Creep:
 *    - Fragile 1-HP slime that spawns in groups and creeps slowly across dungeon floors.
 *    - Staggered timers ensure swarms scatter, shudder, and lunge asynchronously.
 * 2. Vibrate-in-Place Telegraph:
 *    - Periodically halts movement and vibrates rapidly in place (`isVibrating = true`)
 *      before springing forward.
 * 3. Quick Lunge Toward Player:
 *    - Launches a fast burst lunge directly toward Link's position, creating
 *      relentless multi-angle swarm pressure.
 */

import { Direction, EnemyType, PlayerState } from '../types';
import { BaseEnemy } from './octorokEnemy';
import { ParticleSystem } from './particles';

export type TileCollisionFn = (x: number, y: number, w: number, h: number) => boolean;

export type GelState = 'creep' | 'vibrate' | 'lunge' | 'recover';

export interface GelAudio {
  playEnemyAlert?: () => void;
  playMeleeLunge?: () => void;
}

export interface GelEnemyOptions {
  id: string;
  x: number;
  y: number;
  dir?: Direction;
  health?: number;
  speed?: number;
}

export class GelEnemy extends BaseEnemy {
  public gelState: GelState = 'creep';
  public stateTimer: number = 0;
  public creepTurnTimer: number = 0;
  public isVibrating: boolean = false;
  public swarmAngle: number = 0;
  public lungeVx: number = 0;
  public lungeVy: number = 0;
  public lungeSpeed: number = 2.05;
  public meleeDamage: number = 1;

  constructor(options: GelEnemyOptions) {
    super({
      id: options.id,
      type: EnemyType.GEL,
      x: options.x,
      y: options.y,
      dir: options.dir ?? Direction.DOWN,
      health: options.health ?? 1,
      speed: options.speed ?? 0.45,
    });

    this.behaviorState = 'patrol';
    this.swarmAngle = Math.random() * Math.PI * 2;
    this.creepTurnTimer = 20 + Math.floor(Math.random() * 35);
    this.stateTimer = 45 + Math.floor(Math.random() * 75);
  }

  /**
   * Main update routine invoked each frame by the engine.
   */
  public update(
    player: PlayerState,
    checkTileCollision: TileCollisionFn,
    damagePlayer: (dmg: number, dir: Direction) => void,
    audio?: GelAudio,
    particles?: ParticleSystem
  ): void {
    if (this.alertTimer && this.alertTimer > 0) {
      this.alertTimer--;
    }

    switch (this.gelState) {
      case 'creep':
        this.updateCreep(player, checkTileCollision, audio);
        break;

      case 'vibrate':
        this.updateVibrate(player, audio, particles);
        break;

      case 'lunge':
        this.updateLunge(checkTileCollision);
        break;

      case 'recover':
        this.updateRecover();
        break;
    }

    // Swarm melee contact damage against Link
    const distToPlayer = Math.hypot(this.x - player.x, this.y - player.y);
    if (distToPlayer < 12) {
      damagePlayer(this.meleeDamage, this.dir);
    }
  }

  /**
   * Slow creeping swarm movement around the floor before vibrating to lunge.
   */
  private updateCreep(
    player: PlayerState,
    checkTileCollision: TileCollisionFn,
    audio?: GelAudio
  ): void {
    this.isVibrating = false;
    this.behaviorState = 'patrol';
    this.stateTimer--;
    this.creepTurnTimer--;

    // Slow gelatinous squish animation
    this.animTimer++;
    if (this.animTimer > 10) {
      this.animFrame = (this.animFrame + 1) % 2;
      this.animTimer = 0;
    }

    // Periodically drift toward player's general vicinity or wander organically
    if (this.creepTurnTimer <= 0) {
      const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
      if (distToPlayer < 115 && Math.random() < 0.6) {
        const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);
        this.swarmAngle = angleToPlayer + (Math.random() - 0.5) * 0.9;
      } else {
        this.swarmAngle += (Math.random() - 0.5) * 1.8;
      }
      this.creepTurnTimer = 25 + Math.floor(Math.random() * 35);
    }

    const vx = Math.cos(this.swarmAngle) * this.speed;
    const vy = Math.sin(this.swarmAngle) * this.speed;

    let nextX = this.x + vx;
    let nextY = this.y + vy;
    let hitWall = false;

    if (nextX < 16 || nextX > 224 || checkTileCollision(nextX, this.y, 12, 12)) {
      this.swarmAngle = Math.PI - this.swarmAngle;
      nextX = this.x;
      hitWall = true;
    }
    if (nextY < 16 || nextY > 144 || checkTileCollision(nextX, nextY, 12, 12)) {
      this.swarmAngle = -this.swarmAngle;
      nextY = this.y;
      hitWall = true;
    }

    this.x = Math.max(16, Math.min(224, nextX));
    this.y = Math.max(16, Math.min(144, nextY));

    if (hitWall) {
      this.swarmAngle += (Math.random() - 0.5) * 0.5;
    }

    if (Math.abs(vx) >= Math.abs(vy)) {
      this.dir = vx >= 0 ? Direction.RIGHT : Direction.LEFT;
    } else {
      this.dir = vy >= 0 ? Direction.DOWN : Direction.UP;
    }

    if (this.stateTimer <= 0) {
      this.beginVibrate(audio);
    }
  }

  /**
   * Stops moving and begins vibrating rapidly in place before lunging.
   */
  public beginVibrate(audio?: GelAudio): void {
    this.gelState = 'vibrate';
    this.isVibrating = true;
    this.behaviorState = 'windup';
    this.stateTimer = 22 + Math.floor(Math.random() * 10);
    this.alertTimer = 14;
    this.animTimer = 0;

    audio?.playEnemyAlert?.();
  }

  /**
   * Vibrates stationary in place, building tension before launching toward Link.
   */
  private updateVibrate(
    player: PlayerState,
    audio?: GelAudio,
    particles?: ParticleSystem
  ): void {
    this.isVibrating = true;
    this.stateTimer--;

    // Rapid quiver frame toggle
    this.animTimer++;
    if (this.animTimer > 2) {
      this.animFrame = (this.animFrame + 1) % 2;
      this.animTimer = 0;
    }

    if (this.stateTimer <= 0) {
      this.launchLunge(player, audio, particles);
    }
  }

  /**
   * Launches a rapid lunge burst directly toward the player's current position.
   */
  public launchLunge(
    player: PlayerState,
    audio?: GelAudio,
    particles?: ParticleSystem
  ): void {
    this.gelState = 'lunge';
    this.isVibrating = false;
    this.behaviorState = 'attack';
    this.stateTimer = 18;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;

    this.lungeVx = (dx / dist) * this.lungeSpeed;
    this.lungeVy = (dy / dist) * this.lungeSpeed;

    if (Math.abs(dx) >= Math.abs(dy)) {
      this.dir = dx >= 0 ? Direction.RIGHT : Direction.LEFT;
    } else {
      this.dir = dy >= 0 ? Direction.DOWN : Direction.UP;
    }

    audio?.playMeleeLunge?.();
    particles?.emitEmberPuff(this.x + 8, this.y + 8);
  }

  /**
   * Executes fast lunge movement toward Link while respecting walls and boundaries.
   */
  private updateLunge(checkTileCollision: TileCollisionFn): void {
    this.isVibrating = false;
    this.stateTimer--;

    // Fast stretch frame while lunging
    this.animFrame = 1;

    const nextX = this.x + this.lungeVx;
    const nextY = this.y + this.lungeVy;

    if (nextX >= 16 && nextX <= 224 && !checkTileCollision(nextX, this.y, 12, 12)) {
      this.x = nextX;
    } else {
      this.lungeVx = 0;
    }

    if (nextY >= 16 && nextY <= 144 && !checkTileCollision(this.x, nextY, 12, 12)) {
      this.y = nextY;
    } else {
      this.lungeVy = 0;
    }

    if (this.stateTimer <= 0) {
      this.gelState = 'recover';
      this.behaviorState = 'patrol';
      this.stateTimer = 14;
      this.lungeVx = 0;
      this.lungeVy = 0;
    }
  }

  /**
   * Brief pause after a lunge before resuming slow swarm creep.
   */
  private updateRecover(): void {
    this.isVibrating = false;
    this.stateTimer--;

    if (this.stateTimer <= 0) {
      this.gelState = 'creep';
      this.behaviorState = 'patrol';
      this.stateTimer = 50 + Math.floor(Math.random() * 75);
      this.swarmAngle = Math.random() * Math.PI * 2;
    }
  }
}
