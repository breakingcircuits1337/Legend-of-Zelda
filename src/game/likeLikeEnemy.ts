/**
 * The Legend of Zelda NES - Like Like Enemy Subclass
 *
 * Implements the shield-eating tubular monster of Hyrule's deeper dungeons:
 * 1. Slow Stalking Pursuit (`stalk`):
 *    - Pulsates rhythmically while creeping slowly toward Link with wall-sliding
 *      navigation around dungeon blocks.
 * 2. Shield Consumption on Collision (`digest`):
 *    - Upon colliding with Link, engulfs him, deals contact damage, and consumes
 *      Link's equipped shield (both Magical Shield and Wooden Shield), stripping
 *      projectile blocking capability and forcing persistent inventory recovery.
 * 3. Digestion Pause & Resumed Stalk (`digest` -> `stalk`):
 *    - Briefly pulses in place after devouring a shield before continuing its hunt.
 */

import { Direction, EnemyType, PlayerState } from '../types';
import { BaseEnemy } from './octorokEnemy';
import { ParticleSystem } from './particles';

export type TileCollisionFn = (x: number, y: number, w: number, h: number) => boolean;

export type LikeLikeState = 'stalk' | 'digest' | 'engulf';

export type ConsumedShieldType = 'magical' | 'wooden' | null;

export interface LikeLikeAudio {
  playLikeLikeEat?: () => void;
  playEnemyAlert?: () => void;
}

export interface LikeLikeEnemyOptions {
  id: string;
  x: number;
  y: number;
  dir?: Direction;
  health?: number;
  speed?: number;
}

export class LikeLikeEnemy extends BaseEnemy {
  public likeLikeState: LikeLikeState = 'stalk';
  public stateTimer: number = 0;
  public meleeDamage: number = 1;
  public hasConsumedShield: boolean = false;
  public eatenShieldType: ConsumedShieldType = null;
  public shieldsConsumedCount: number = 0;

  constructor(options: LikeLikeEnemyOptions) {
    super({
      id: options.id,
      type: EnemyType.LIKE_LIKE,
      x: options.x,
      y: options.y,
      dir: options.dir ?? Direction.DOWN,
      health: options.health ?? 6,
      speed: options.speed ?? 0.55,
    });

    this.behaviorState = 'chase';
    this.syncCustomData();
  }

  private syncCustomData(): void {
    this.customData.likeLikeState = this.likeLikeState;
    this.customData.hasConsumedShield = this.hasConsumedShield;
    this.customData.eatenShieldType = this.eatenShieldType;
  }

  /**
   * Returns true if the player currently carries any shield that can be eaten.
   */
  public static playerHasShield(player: PlayerState): boolean {
    if (player.hasMagicalShield || player.inventory?.hasMagicalShield) {
      return true;
    }
    if (player.hasShield === false || player.inventory?.hasShield === false || player.shieldTier === 0) {
      return false;
    }
    return true;
  }

  /**
   * Main per-frame update routine invoked by the game engine.
   */
  public update(
    player: PlayerState,
    checkTileCollision: TileCollisionFn,
    damagePlayer: (dmg: number, dir: Direction) => void,
    audio?: LikeLikeAudio,
    particles?: ParticleSystem,
    onShieldConsumed?: (shieldType: ConsumedShieldType) => void
  ): void {
    if (this.alertTimer && this.alertTimer > 0) {
      this.alertTimer--;
    }

    // Pulsating accordion tube animation (faster while digesting)
    const animInterval = this.likeLikeState === 'digest' ? 4 : 8;
    this.animTimer++;
    if (this.animTimer > animInterval) {
      this.animFrame = (this.animFrame + 1) % 2;
      this.animTimer = 0;
    }

    if (this.likeLikeState === 'stalk') {
      this.updateStalk(player, checkTileCollision);
    } else {
      this.stateTimer--;
      if (this.stateTimer <= 0) {
        this.likeLikeState = 'stalk';
        this.behaviorState = 'chase';
      }
    }

    // Check collision with Link
    const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
    if (distToPlayer < 14) {
      damagePlayer(this.meleeDamage, this.dir);

      if (this.likeLikeState === 'stalk') {
        const consumed = this.consumePlayerShield(player, audio, particles, onShieldConsumed);
        if (!consumed) {
          this.likeLikeState = 'engulf';
          this.stateTimer = 20;
        }
      }
    }

    this.syncCustomData();
  }

  /**
   * Slowly moves toward the player with smooth wall-sliding around obstacles.
   */
  private updateStalk(player: PlayerState, checkTileCollision: TileCollisionFn): void {
    this.behaviorState = 'chase';

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.5) return;

    const stepX = (dx / dist) * this.speed;
    const stepY = (dy / dist) * this.speed;

    if (Math.abs(dx) >= Math.abs(dy)) {
      this.dir = dx >= 0 ? Direction.RIGHT : Direction.LEFT;
    } else {
      this.dir = dy >= 0 ? Direction.DOWN : Direction.UP;
    }

    // Try full diagonal vector first, then slide along X or Y axis if obstructed
    if (!checkTileCollision(this.x + stepX, this.y + stepY, 14, 14)) {
      this.x += stepX;
      this.y += stepY;
    } else if (!checkTileCollision(this.x + stepX, this.y, 14, 14)) {
      this.x += stepX;
    } else if (!checkTileCollision(this.x, this.y + stepY, 14, 14)) {
      this.y += stepY;
    }

    this.x = Math.max(16, Math.min(224, this.x));
    this.y = Math.max(16, Math.min(144, this.y));
  }

  /**
   * Consumes the player's equipped shield upon collision and enters a brief digestion pause.
   * Returns the type of shield eaten, or null if the player had no shield remaining.
   */
  public consumePlayerShield(
    player: PlayerState,
    audio?: LikeLikeAudio,
    particles?: ParticleSystem,
    onShieldConsumed?: (shieldType: ConsumedShieldType) => void
  ): ConsumedShieldType {
    if (!LikeLikeEnemy.playerHasShield(player)) {
      return null;
    }

    const hadMagical = Boolean(player.hasMagicalShield || player.inventory?.hasMagicalShield);
    const shieldType: ConsumedShieldType = hadMagical ? 'magical' : 'wooden';

    // Permanently strip the eaten shield until the player buys/acquires a replacement
    player.hasShield = false;
    player.shieldTier = 0;
    player.hasMagicalShield = false;
    if (player.inventory) {
      player.inventory.hasShield = false;
      player.inventory.hasMagicalShield = false;
    }

    this.hasConsumedShield = true;
    this.eatenShieldType = shieldType;
    this.shieldsConsumedCount++;
    this.likeLikeState = 'digest';
    this.behaviorState = 'attack';
    this.stateTimer = 45;
    this.alertTimer = 24;

    audio?.playLikeLikeEat?.();
    particles?.emitShieldDeflect(player.x + 8, player.y + 8, this.dir);
    particles?.emitEmberPuff(this.x + 8, this.y + 8);
    onShieldConsumed?.(shieldType);
    this.syncCustomData();

    return shieldType;
  }
}
