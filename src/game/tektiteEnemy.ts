/**
 * The Legend of Zelda NES - Tektite Enemy Subclass
 *
 * Implements the jumping cyclops spider enemy of Hyrule:
 * 1. Jumping arc pattern:
 *    - Pauses grounded in a crouched stance (animFrame 0).
 *    - Launches into high-arching parabolic leaps across the screen (animFrame 1).
 *    - Projects a ground drop shadow beneath its elevated sprite (jumpYOffset > 0).
 * 2. Targeted Player Landing:
 *    - Periodically calculates a direct leap trajectory aimed to land right on Link's position,
 *      creating an agile aerial dodging challenge.
 *    - Displays an 8-bit visual danger alert telegraph before landing.
 * 3. Melee contact damage:
 *    - Inflicts contact damage upon touching Link, especially upon landing.
 */

import { Direction, EnemyType, PlayerState } from '../types';
import { BaseEnemy } from './octorokEnemy';
import { ParticleSystem } from './particles';

export type TileCollisionFn = (x: number, y: number, w: number, h: number) => boolean;

export type TektiteJumpState = 'idle' | 'jumping';

export interface TektiteAudio {
  playTektiteHop?: () => void;
  playEnemyAlert?: () => void;
}

export interface TektiteEnemyOptions {
  id: string;
  x: number;
  y: number;
  type?: EnemyType.TEKTITE_RED;
  dir?: Direction;
  health?: number;
  speed?: number;
}

export class TektiteEnemy extends BaseEnemy {
  public jumpState: TektiteJumpState = 'idle';
  public idleTimer: number = 35;
  public jumpTimer: number = 0;
  public totalJumpDuration: number = 34;
  public jumpVx: number = 0;
  public jumpVy: number = 0;
  public peakJumpHeight: number = 18;
  public hopCount: number = 0;
  public isTargetingPlayer: boolean = false;
  public meleeDamage: number = 1;
  public override jumpYOffset: number = 0;

  constructor(options: TektiteEnemyOptions) {
    super({
      id: options.id,
      type: options.type ?? EnemyType.TEKTITE_RED,
      x: options.x,
      y: options.y,
      dir: options.dir ?? Direction.DOWN,
      health: options.health ?? 2,
      speed: options.speed ?? 1.0,
    });

    this.idleTimer = 25 + Math.floor(Math.random() * 30);
    this.animFrame = 0; // Crouched stance
    this.jumpYOffset = 0;
    this.behaviorState = 'patrol';
  }

  /**
   * Main update routine invoked each frame by the engine.
   */
  public update(
    player: PlayerState,
    checkTileCollision: TileCollisionFn,
    damagePlayer: (dmg: number, dir: Direction) => void,
    audio?: TektiteAudio,
    particles?: ParticleSystem
  ): void {
    // 1. Decrement visual 8-bit alert telegraph
    if (this.alertTimer && this.alertTimer > 0) {
      this.alertTimer--;
    }

    // 2. Finite state update: idle (crouched) vs jumping (airborne parabolic arc)
    if (this.jumpState === 'idle') {
      this.updateIdle(player, audio);
    } else {
      this.updateJumping(checkTileCollision, audio, particles);
    }

    // 3. Melee contact damage against Link
    const distToPlayer = Math.hypot(this.x - player.x, this.y - player.y);
    // Tektite deals damage when grounded or low to the ground near touchdown
    if (distToPlayer < 14 && this.jumpYOffset < 8) {
      damagePlayer(this.meleeDamage, this.dir);
    }
  }

  /**
   * Grounded idle phase:
   * Waits crouched on the ground before launching the next hopping leap.
   */
  private updateIdle(player: PlayerState, audio?: TektiteAudio): void {
    this.jumpYOffset = 0;
    this.animFrame = 0; // Crouched legs
    this.idleTimer--;

    if (this.idleTimer <= 0) {
      this.launchHop(player, audio);
    }
  }

  /**
   * Calculates and launches a hopping arc across the screen or toward the player.
   */
  public launchHop(player: PlayerState, audio?: TektiteAudio): void {
    this.hopCount++;

    const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
    // Periodically (every 3rd hop or when player is in hunting range) target player's position
    const shouldTargetPlayer = this.hopCount % 3 === 0 || (distToPlayer < 100 && Math.random() < 0.4);

    if (shouldTargetPlayer) {
      this.isTargetingPlayer = true;
      this.behaviorState = 'attack';
      this.totalJumpDuration = 36;

      // Calculate vector aimed directly to land on player position
      let dx = player.x - this.x;
      let dy = player.y - this.y;
      const targetDist = Math.hypot(dx, dy) || 1;

      // Cap maximum leap distance to realistic athletic reach (max 85px)
      const maxLeapDist = 85;
      if (targetDist > maxLeapDist) {
        dx = (dx / targetDist) * maxLeapDist;
        dy = (dy / targetDist) * maxLeapDist;
      }

      this.jumpVx = dx / this.totalJumpDuration;
      this.jumpVy = dy / this.totalJumpDuration;

      // 8-bit visual alert warning
      this.alertTimer = 16;
      audio?.playEnemyAlert?.();
    } else {
      this.isTargetingPlayer = false;
      this.behaviorState = 'patrol';
      this.totalJumpDuration = 30 + Math.floor(Math.random() * 8);

      // Random exploratory leap around the screen
      const angle = Math.random() * Math.PI * 2;
      const leapDist = 24 + Math.random() * 40; // 24 to 64px leap

      this.jumpVx = (Math.cos(angle) * leapDist) / this.totalJumpDuration;
      this.jumpVy = (Math.sin(angle) * leapDist) / this.totalJumpDuration;
    }

    // Orient facing direction
    if (Math.abs(this.jumpVx) >= Math.abs(this.jumpVy)) {
      this.dir = this.jumpVx >= 0 ? Direction.RIGHT : Direction.LEFT;
    } else {
      this.dir = this.jumpVy >= 0 ? Direction.DOWN : Direction.UP;
    }

    this.jumpState = 'jumping';
    this.jumpTimer = this.totalJumpDuration;
    this.animFrame = 1; // Leaping legs extended

    // 2A03 springy pulse hop sound
    audio?.playTektiteHop?.();
  }

  /**
   * Airborne jumping phase:
   * Moves along parabolic vertical arc while traveling horizontally across the room.
   */
  private updateJumping(
    checkTileCollision: TileCollisionFn,
    audio?: TektiteAudio,
    particles?: ParticleSystem
  ): void {
    this.jumpTimer--;

    // Parabolic height calculation: progress ranges from 0.0 (launch) -> 1.0 (landing)
    const progress = 1 - Math.max(0, this.jumpTimer) / this.totalJumpDuration;
    this.jumpYOffset = Math.sin(progress * Math.PI) * this.peakJumpHeight;

    // Advance ground position
    let nextX = this.x + this.jumpVx;
    let nextY = this.y + this.jumpVy;

    // Room boundaries (16 <= X <= 224, 16 <= Y <= 144)
    if (nextX < 16) {
      nextX = 16;
      this.jumpVx = -this.jumpVx * 0.5;
    } else if (nextX > 224) {
      nextX = 224;
      this.jumpVx = -this.jumpVx * 0.5;
    }

    if (nextY < 16) {
      nextY = 16;
      this.jumpVy = -this.jumpVy * 0.5;
    } else if (nextY > 144) {
      nextY = 144;
      this.jumpVy = -this.jumpVy * 0.5;
    }

    this.x = nextX;
    this.y = nextY;

    // Landing touchdown
    if (this.jumpTimer <= 0) {
      this.land(particles);
    }
  }

  /**
   * Landing touchdown: resets height, enters crouched stance, and recovers before next hop.
   */
  private land(particles?: ParticleSystem): void {
    this.jumpState = 'idle';
    this.jumpYOffset = 0;
    this.animFrame = 0; // Crouched stance
    this.behaviorState = 'patrol';
    this.isTargetingPlayer = false;
    this.jumpVx = 0;
    this.jumpVy = 0;
    this.idleTimer = 30 + Math.floor(Math.random() * 35); // ~0.5 - 1.1s recovery

    if (particles) {
      particles.emitEmberPuff(this.x + 8, this.y + 14);
    }
  }
}
