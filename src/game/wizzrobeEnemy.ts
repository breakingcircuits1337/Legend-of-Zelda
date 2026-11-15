/**
 * The Legend of Zelda NES - Wizzrobe Enemy Subclass (State-Based AI Controller)
 *
 * Implements the teleporting magic sorcerer using a formal Finite State Machine
 * (`StateMachineAIController`) with four distinct warp-combat states:
 * 1. `hidden`    (`ether_concealment`): Intangible in the ether while counting down
 *    its ambush timer, immune to melee contact checks and silent on screen.
 * 2. `appearing` (`tactical_warp_materialize`): Warps to an open grid tile at safe
 *    distance from Link (preferring strategic medium-range casting lanes), shimmering
 *    during materialization.
 * 3. `casting`   (`aimed_magic_volley`): Solidifies, tracks Link, winds up briefly,
 *    and fires an aimed `magic_wave` projectile before becoming briefly punishable.
 * 4. `vanishing` (`phase_vanish`): Flickers back out into the ether to repeat the cycle.
 */

import { Direction, EnemyType, PlayerState } from '../types';
import { BaseEnemy } from './octorokEnemy';
import { ParticleSystem } from './particles';
import { StateMachineAIController } from './stateAIController';

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

export interface WizzrobeAIContext {
  player: PlayerState;
  checkTileCollision: TileCollisionFn;
  spawnMagicProjectile: (proj: MagicProjectileData) => void;
  audio?: WizzrobeAudio;
  particles?: ParticleSystem;
}

const NO_OP_SPAWN = () => {};

export class WizzrobeEnemy extends BaseEnemy {
  public readonly aiController: StateMachineAIController<WizzrobeState, WizzrobeAIContext>;
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
    let initialTimer = 25 + Math.floor(Math.random() * 35);

    if (initial === 'hidden') {
      this.isHidden = true;
      this.isPhasing = false;
      initialTimer = 25 + Math.floor(Math.random() * 35);
      this.behaviorState = 'patrol';
    } else if (initial === 'appearing') {
      this.isHidden = false;
      this.isPhasing = true;
      initialTimer = 18;
      this.behaviorState = 'windup';
    } else if (initial === 'casting') {
      this.isHidden = false;
      this.isPhasing = false;
      this.hasFiredThisWarp = false;
      this.castWindupTimer = 10;
      initialTimer = 34;
      this.behaviorState = 'attack';
    } else {
      this.isHidden = false;
      this.isPhasing = true;
      initialTimer = 14;
      this.behaviorState = 'patrol';
    }

    this.aiController = this.createAIController(initial, initialTimer);
    this.syncCustomData();
  }

  public get wizzrobeState(): WizzrobeState {
    return this.aiController.currentState;
  }

  public set wizzrobeState(state: WizzrobeState) {
    this.aiController.forceState(state);
    this.syncCustomData();
  }

  public get stateTimer(): number {
    return this.aiController.stateTimer;
  }

  public set stateTimer(value: number) {
    this.aiController.stateTimer = value;
  }

  private syncCustomData(): void {
    this.customData.isHidden = this.isHidden;
    this.customData.isPhasing = this.isPhasing;
    this.customData.wizzrobeState = this.aiController.currentState;
    this.customData.aiPattern = this.aiController.getCurrentPatternTag();
    this.customData.aiTransitions = this.aiController.transitionCount;
  }

  private createAIController(
    initialState: WizzrobeState,
    initialTimer: number
  ): StateMachineAIController<WizzrobeState, WizzrobeAIContext> {
    return new StateMachineAIController<WizzrobeState, WizzrobeAIContext>({
      controllerName: 'WizzrobeWarpFSM',
      initialState,
      initialTimer,
      states: {
        hidden: {
          name: 'hidden',
          patternTag: 'ether_concealment',
          onEnter: (ctx, _prev, controller) => {
            this.isHidden = true;
            this.isPhasing = false;
            this.behaviorState = 'patrol';
            controller.stateTimer = 35 + Math.floor(Math.random() * 40);
            ctx.particles?.emitEmberPuff(this.x + 8, this.y + 8);
          },
          onUpdate: (ctx, controller) => {
            this.isHidden = true;
            this.isPhasing = false;
            controller.stateTimer--;

            if (controller.stateTimer <= 0) {
              const spot = this.selectTacticalWarpCoordinates(
                ctx.player,
                ctx.checkTileCollision
              );
              this.x = spot.x;
              this.y = spot.y;
              controller.transitionTo('appearing', ctx, 'ether_reemerge');
            }
          },
        },

        appearing: {
          name: 'appearing',
          patternTag: 'tactical_warp_materialize',
          onEnter: (ctx, _prev, controller) => {
            this.dir = this.getDirectionTowardPlayer(ctx.player);
            this.isHidden = false;
            this.isPhasing = true;
            this.hasFiredThisWarp = false;
            this.behaviorState = 'windup';
            controller.stateTimer = 18;
            this.alertTimer = 14;
            this.warpCount++;

            ctx.audio?.playWizzrobeWarp?.();
            ctx.particles?.emitEmberPuff(this.x + 8, this.y + 8);
          },
          onUpdate: (ctx, controller) => {
            this.isHidden = false;
            this.isPhasing = true;
            controller.stateTimer--;

            this.animTimer++;
            if (this.animTimer > 4) {
              this.animFrame = (this.animFrame + 1) % 2;
              this.animTimer = 0;
            }

            if (controller.stateTimer <= 0) {
              controller.transitionTo('casting', ctx, 'materialized');
            }
          },
        },

        casting: {
          name: 'casting',
          patternTag: 'aimed_magic_volley',
          onEnter: (ctx, _prev, controller) => {
            this.dir = this.getDirectionTowardPlayer(ctx.player);
            this.isHidden = false;
            this.isPhasing = false;
            this.hasFiredThisWarp = false;
            this.castWindupTimer = 10;
            controller.stateTimer = 34;
            this.behaviorState = 'attack';
          },
          onUpdate: (ctx, controller) => {
            this.isHidden = false;
            this.isPhasing = false;
            controller.stateTimer--;

            this.animTimer++;
            if (this.animTimer > 5) {
              this.animFrame = (this.animFrame + 1) % 2;
              this.animTimer = 0;
            }

            if (!this.hasFiredThisWarp) {
              this.dir = this.getDirectionTowardPlayer(ctx.player);
              this.castWindupTimer--;
              if (this.castWindupTimer <= 0) {
                this.fireMagicProjectile(
                  ctx.player,
                  ctx.spawnMagicProjectile,
                  ctx.audio,
                  ctx.particles
                );
              }
            }

            if (controller.stateTimer <= 0) {
              controller.transitionTo('vanishing', ctx, 'cast_complete');
            }
          },
        },

        vanishing: {
          name: 'vanishing',
          patternTag: 'phase_vanish',
          onEnter: (ctx, _prev, controller) => {
            this.isHidden = false;
            this.isPhasing = true;
            this.behaviorState = 'patrol';
            controller.stateTimer = 14;

            ctx.audio?.playWizzrobeWarp?.();
            ctx.particles?.emitEmberPuff(this.x + 8, this.y + 8);
          },
          onUpdate: (ctx, controller) => {
            this.isHidden = false;
            this.isPhasing = true;
            controller.stateTimer--;

            if (controller.stateTimer <= 0) {
              controller.transitionTo('hidden', ctx, 'vanish_complete');
            }
          },
        },
      },
    });
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

    this.aiController.update({
      player,
      checkTileCollision,
      spawnMagicProjectile,
      audio,
      particles,
    });

    // Contact damage only when materialized on screen
    if (this.wizzrobeState === 'casting') {
      const distToPlayer = Math.hypot(this.x - player.x, this.y - player.y);
      if (distToPlayer < 13) {
        damagePlayer(this.meleeDamage, this.dir);
      }
    }

    this.syncCustomData();
  }

  /**
   * Selects a strategic grid-aligned teleport coordinate at safe distance (>= 40px)
   * from Link, preferring clean casting lanes (48-144px with clear line of sight).
   */
  private selectTacticalWarpCoordinates(
    player: PlayerState,
    checkTileCollision: TileCollisionFn
  ): { x: number; y: number } {
    const fallbackX = Math.max(32, Math.min(208, this.x));
    const fallbackY = Math.max(32, Math.min(128, this.y));

    const candidates: Array<{ x: number; y: number; score: number }> = [];

    for (let attempt = 0; attempt < 24; attempt++) {
      const col = 2 + Math.floor(Math.random() * 12); // cols 2..13 -> x = 32..208
      const row = 2 + Math.floor(Math.random() * 7);  // rows 2..8  -> y = 32..128
      const cx = col * 16;
      const cy = row * 16;

      const dist = Math.hypot(cx - player.x, cy - player.y);
      if (dist < 40) continue;
      if (checkTileCollision(cx, cy, 14, 14)) continue;

      let score = 0;
      if (dist >= 48 && dist <= 136) score += 2;
      if (Math.abs(cx - player.x) <= 20 || Math.abs(cy - player.y) <= 20) score += 2;
      if (this.hasClearLineOfSight(cx, cy, player, checkTileCollision)) score += 3;

      candidates.push({ x: cx, y: cy, score });
      if (score >= 5) {
        return { x: cx, y: cy };
      }
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      const topPool = candidates.slice(0, Math.min(3, candidates.length));
      const pick = topPool[Math.floor(Math.random() * topPool.length)];
      return { x: pick.x, y: pick.y };
    }

    return { x: fallbackX, y: fallbackY };
  }

  private hasClearLineOfSight(
    fromX: number,
    fromY: number,
    player: PlayerState,
    checkTileCollision: TileCollisionFn
  ): boolean {
    const x1 = fromX + 8;
    const y1 = fromY + 8;
    const x2 = player.x + 8;
    const y2 = player.y + 8;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (dist < 12) return true;

    const steps = Math.floor(dist / 8);
    const stepX = dx / steps;
    const stepY = dy / steps;

    for (let i = 1; i < steps; i++) {
      if (checkTileCollision(x1 + stepX * i - 4, y1 + stepY * i - 4, 8, 8)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Warps the Wizzrobe to a strategic open tile on screen at a safe distance from Link.
   */
  public warpToRandomSpot(
    player: PlayerState,
    checkTileCollision: TileCollisionFn,
    audio?: WizzrobeAudio,
    particles?: ParticleSystem
  ): void {
    const spot = this.selectTacticalWarpCoordinates(player, checkTileCollision);
    this.x = spot.x;
    this.y = spot.y;

    this.aiController.transitionTo(
      'appearing',
      {
        player,
        checkTileCollision,
        spawnMagicProjectile: NO_OP_SPAWN,
        audio,
        particles,
      },
      'manual_warp'
    );
    this.syncCustomData();
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
    this.aiController.transitionTo(
      'vanishing',
      {
        player: { x: this.x, y: this.y } as PlayerState,
        checkTileCollision: () => false,
        spawnMagicProjectile: NO_OP_SPAWN,
        audio,
        particles,
      },
      'manual_vanish'
    );
    this.syncCustomData();
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
