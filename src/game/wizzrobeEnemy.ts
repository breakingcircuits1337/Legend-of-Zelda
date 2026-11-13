/**
 * The Legend of Zelda NES - Wizzrobe Enemy Subclass
 *
 * Implements the teleporting magic sorcerer:
 * 1. Random Screen Warping (`hidden` -> `appearing`):
 *    - Dematerializes into the ether and reappears at random open coordinates
 *      across the room with a shimmering 8-bit warp-in telegraph.
 * 2. Targeted Magic Casting (`casting`):
 *    - Faces Link and fires a fast `magic_wave` projectile aimed toward the
 *      player's position, briefly remaining vulnerable to counterattacks.
 * 3. Vanishing (`vanishing` -> `hidden`):
 *    - Flickers and disappears back out of sight before warping to a new spot,
 *      demanding fast reactions and pattern recognition.
 */

import { Direction, EnemyType, PlayerState } from '../types';
import { BaseEnemy } from './octorokEnemy';
import { ParticleSystem } from './particles';

export type TileCollisionFn = (x: number, y: number, w: number, h: number) => boolean;

export type WizzrobeState = 'hidden' | 'appearing' | 'casting' | 'vanishing';

export interface MagicProjectileData {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dir: Direction;
  damage: number;
}

export interface WizzrobeAudio {
  playWizzrobeWarp?: () => void;
  playWizzrobeCast?: () => void;
  playEnemyAlert?: () => void;
}

export interface WizzrobeEnemyOptions {
  id: string;
  x: number;
  y: number;
  dir?: Direction;
  health?: number;
  initialState?: WizzrobeState;
}

export class WizzrobeEnemy extends BaseEnemy {
  public wizzrobeState: WizzrobeState = 'hidden';
  public stateTimer: number = 0;
  public isHidden: boolean = true;
  public isPhasing: boolean = false;
  public hasFiredThisWarp: boolean = false;
  public castWindupTimer: number = 0;
  public magicSpeed: number = 3.0;
  public magicDamage: number = 2;
  public meleeDamage: number = 1;
  public warpCount: number = 0;

  constructor(options: WizzrobeEnemyOptions) {
    super({
      id: options.id,
      type: EnemyType.WIZZROBE_RED,
      x: options.x,
      y: options.y,
      dir: options.dir ?? Direction.DOWN,
      health: options.health ?? 4,
      speed: 0,
    });

    const initial = options.initialState ?? 'hidden';
    this.wizzrobeState = initial;

    if (initial === 'hidden') {
      this.isHidden = true;
      this.isPhasing = false;
      this.stateTimer = 25 + Math.floor(Math.random() * 35);
      this.behaviorState = 'patrol';
    } else if (initial === 'appearing') {
      this.isHidden = false;
      this.isPhasing = true;
      this.stateTimer = 18;
      this.behaviorState = 'windup';
    } else if (initial === 'casting') {
      this.isHidden = false;
      this.isPhasing = false;
      this.hasFiredThisWarp = false;
      this.castWindupTimer = 10;
      this.stateTimer = 34;
      this.behaviorState = 'attack';
    } else {
      this.isHidden = false;
      this.isPhasing = true;
      this.stateTimer = 14;
      this.behaviorState = 'patrol';
    }

    this.syncCustomData();
  }

  private syncCustomData(): void {
    this.customData.isHidden = this.isHidden;
    this.customData.isPhasing = this.isPhasing;
    this.customData.wizzrobeState = this.wizzrobeState;
  }

  /**
   * Main update routine invoked each frame by the engine.
   */
  public update(
    player: PlayerState,
    checkTileCollision: TileCollisionFn,
    spawnMagicProjectile: (proj: MagicProjectileData) => void,
    damagePlayer: (dmg: number, dir: Direction) => void,
    audio?: WizzrobeAudio,
    particles?: ParticleSystem
  ): void {
    if (this.alertTimer && this.alertTimer > 0) {
      this.alertTimer--;
    }

    switch (this.wizzrobeState) {
      case 'hidden':
        this.updateHidden(player, checkTileCollision, audio, particles);
        break;

      case 'appearing':
        this.updateAppearing(player);
        break;

      case 'casting':
        this.updateCasting(player, spawnMagicProjectile, audio, particles);
        break;

      case 'vanishing':
        this.updateVanishing(particles);
        break;
    }

    // Contact damage only when materialized on screen
    if (this.wizzrobeState === 'casting') {
      const distToPlayer = Math.hypot(this.x - player.x, this.y - player.y);
      if (distToPlayer < 13) {
        damagePlayer(this.meleeDamage, this.dir);
      }
    }

    this.syncCustomData();
  }

  private updateHidden(
    player: PlayerState,
    checkTileCollision: TileCollisionFn,
    audio?: WizzrobeAudio,
    particles?: ParticleSystem
  ): void {
    this.isHidden = true;
    this.isPhasing = false;
    this.stateTimer--;

    if (this.stateTimer <= 0) {
      this.warpToRandomSpot(player, checkTileCollision, audio, particles);
    }
  }

  /**
   * Warps the Wizzrobe to a random open tile on screen at a safe distance from Link.
   */
  public warpToRandomSpot(
    player: PlayerState,
    checkTileCollision: TileCollisionFn,
    audio?: WizzrobeAudio,
    particles?: ParticleSystem
  ): void {
    let chosenX = Math.max(32, Math.min(208, this.x));
    let chosenY = Math.max(32, Math.min(128, this.y));

    for (let attempt = 0; attempt < 24; attempt++) {
      // Grid-aligned random coordinates within playable dungeon/room interior
      const col = 2 + Math.floor(Math.random() * 12); // cols 2..13 -> x = 32..208
      const row = 2 + Math.floor(Math.random() * 7);  // rows 2..8  -> y = 32..128
      const cx = col * 16;
      const cy = row * 16;

      if (Math.hypot(cx - player.x, cy - player.y) < 40) continue;
      if (checkTileCollision(cx, cy, 14, 14)) continue;

      chosenX = cx;
      chosenY = cy;
      break;
    }

    this.x = chosenX;
    this.y = chosenY;
    this.dir = this.getDirectionTowardPlayer(player);

    this.wizzrobeState = 'appearing';
    this.isHidden = false;
    this.isPhasing = true;
    this.hasFiredThisWarp = false;
    this.behaviorState = 'windup';
    this.stateTimer = 18;
    this.alertTimer = 14;
    this.warpCount++;

    audio?.playWizzrobeWarp?.();
    particles?.emitEmberPuff(this.x + 8, this.y + 8);
    this.syncCustomData();
  }

  private updateAppearing(player: PlayerState): void {
    this.isHidden = false;
    this.isPhasing = true;
    this.stateTimer--;

    this.animTimer++;
    if (this.animTimer > 4) {
      this.animFrame = (this.animFrame + 1) % 2;
      this.animTimer = 0;
    }

    if (this.stateTimer <= 0) {
      this.dir = this.getDirectionTowardPlayer(player);
      this.wizzrobeState = 'casting';
      this.isHidden = false;
      this.isPhasing = false;
      this.hasFiredThisWarp = false;
      this.castWindupTimer = 10;
      this.stateTimer = 34;
      this.behaviorState = 'attack';
    }
  }

  private updateCasting(
    player: PlayerState,
    spawnMagicProjectile: (proj: MagicProjectileData) => void,
    audio?: WizzrobeAudio,
    particles?: ParticleSystem
  ): void {
    this.isHidden = false;
    this.isPhasing = false;
    this.stateTimer--;

    this.animTimer++;
    if (this.animTimer > 5) {
      this.animFrame = (this.animFrame + 1) % 2;
      this.animTimer = 0;
    }

    if (!this.hasFiredThisWarp) {
      this.dir = this.getDirectionTowardPlayer(player);
      this.castWindupTimer--;
      if (this.castWindupTimer <= 0) {
        this.fireMagicProjectile(player, spawnMagicProjectile, audio, particles);
      }
    }

    if (this.stateTimer <= 0) {
      this.beginVanish(audio, particles);
    }
  }

  /**
   * Fires a magical wave projectile aimed at the player's current position.
   */
  public fireMagicProjectile(
    player: PlayerState,
    spawnMagicProjectile: (proj: MagicProjectileData) => void,
    audio?: WizzrobeAudio,
    particles?: ParticleSystem
  ): void {
    this.dir = this.getDirectionTowardPlayer(player);

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;

    const vx = (dx / dist) * this.magicSpeed;
    const vy = (dy / dist) * this.magicSpeed;

    spawnMagicProjectile({
      x: this.x,
      y: this.y,
      vx,
      vy,
      dir: this.dir,
      damage: this.magicDamage,
    });

    this.hasFiredThisWarp = true;
    audio?.playWizzrobeCast?.();
    particles?.emitEmberPuff(this.x + 8, this.y + 8);
  }

  /**
   * Begins shimmering out of existence before hiding in the ether.
   */
  public beginVanish(audio?: WizzrobeAudio, particles?: ParticleSystem): void {
    this.wizzrobeState = 'vanishing';
    this.isHidden = false;
    this.isPhasing = true;
    this.behaviorState = 'patrol';
    this.stateTimer = 14;

    audio?.playWizzrobeWarp?.();
    particles?.emitEmberPuff(this.x + 8, this.y + 8);
    this.syncCustomData();
  }

  private updateVanishing(particles?: ParticleSystem): void {
    this.isHidden = false;
    this.isPhasing = true;
    this.stateTimer--;

    if (this.stateTimer <= 0) {
      this.wizzrobeState = 'hidden';
      this.isHidden = true;
      this.isPhasing = false;
      this.stateTimer = 35 + Math.floor(Math.random() * 40);
      particles?.emitEmberPuff(this.x + 8, this.y + 8);
    }
  }

  public getDirectionTowardPlayer(player: PlayerState): Direction {
    const dx = player.x - this.x;
    const dy = player.y - this.y;

    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx >= 0 ? Direction.RIGHT : Direction.LEFT;
    }
    return dy >= 0 ? Direction.DOWN : Direction.UP;
  }
}
