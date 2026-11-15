/**
 * The Legend of Zelda NES - Darknut Enemy Subclass (State-Based AI Controller)
 *
 * Implements the heavily armored Darknut knight using a formal Finite State Machine
 * (`StateMachineAIController`) with four tactical states:
 * 1. `patrol`  (`tactical_lane_patrol`): Marches along cardinal corridors, biasing turns
 *    toward Link's lane/corridor rather than wandering aimlessly like an Octorok.
 * 2. `windup`  (`shield_brace_windup`): Halts, turns its shield directly toward Link,
 *    and telegraphs a heavy charge when Link enters range or an open cardinal corridor.
 * 3. `charge`  (`wall_slide_armored_charge`): High-speed armored lunge with periodic
 *    heading re-alignment and secondary-axis wall-sliding around dungeon blocks.
 * 4. `recover` (`guard_recovery`): Brief post-charge stance before resuming patrol,
 *    with immediate counter-charge reactions if struck on the shield or flank.
 */

import { Direction, EnemyType, PlayerState } from '../types';
import { BaseEnemy } from './octorokEnemy';
import { ParticleSystem } from './particles';
import { StateMachineAIController } from './stateAIController';

export type TileCollisionFn = (x: number, y: number, w: number, h: number) => boolean;

export type DarknutState = 'patrol' | 'windup' | 'charge' | 'recover';

export interface DarknutAudio {
  playEnemyAlert?: () => void;
  playMeleeLunge?: () => void;
  playShieldDeflect?: () => void;
}

export interface DarknutEnemyOptions {
  id: string;
  type?: EnemyType.DARKNUT_RED | EnemyType.DARKNUT_BLUE;
  x: number;
  y: number;
  dir?: Direction;
  health?: number;
  speed?: number;
  chargeRange?: number;
}

export interface DarknutAIContext {
  player: PlayerState;
  distToPlayer: number;
  checkTileCollision: TileCollisionFn;
  audio?: DarknutAudio;
  particles?: ParticleSystem;
}

const NO_OP_COLLISION: TileCollisionFn = () => false;

const FALLBACK_PLAYER: PlayerState = {
  x: 120,
  y: 88,
  dir: Direction.UP,
  moving: false,
  isAttacking: false,
  attackTimer: 0,
  animFrame: 0,
  animTimer: 0,
  hearts: 6,
  maxHearts: 6,
  swordTier: 1,
  bItem: 0 as any,
  inventory: {
    hasSword: true,
    hasBoomerang: false,
    hasBow: false,
    hasCandle: false,
    hasCompass: false,
    hasDungeonMap: false,
    rupees: 0,
    bombs: 0,
    keys: 0,
    triforcePieces: 0,
  },
  invincibleTimer: 0,
  knockback: null,
  isHoldingItem: false,
  heldItemType: null,
  heldItemTimer: 0,
};

export class DarknutEnemy extends BaseEnemy {
  public readonly aiController: StateMachineAIController<DarknutState, DarknutAIContext>;
  public chargeCooldown: number = 0;
  public chargeReaimTimer: number = 0;
  public isBlueVariant: boolean;
  public chargeSpeed: number;
  public chargeRange: number;
  public meleeDamage: number;

  constructor(options: DarknutEnemyOptions) {
    const enemyType = options.type ?? EnemyType.DARKNUT_RED;
    const isBlue = enemyType === EnemyType.DARKNUT_BLUE;

    super({
      id: options.id,
      type: enemyType,
      x: options.x,
      y: options.y,
      dir: options.dir ?? Direction.DOWN,
      health: options.health ?? (isBlue ? 8 : 4),
      speed: options.speed ?? (isBlue ? 0.85 : 0.75),
    });

    this.isBlueVariant = isBlue;
    this.chargeSpeed = isBlue ? 1.65 : 1.45;
    this.chargeRange = options.chargeRange ?? 76;
    this.meleeDamage = isBlue ? 2 : 1;
    this.behaviorState = 'patrol';
    this.actionTimer = 45 + Math.floor(Math.random() * 50);

    this.aiController = this.createAIController();
    this.syncCustomData();
  }

  public get darknutState(): DarknutState {
    return this.aiController.currentState;
  }

  public set darknutState(state: DarknutState) {
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
    this.customData.darknutState = this.aiController.currentState;
    this.customData.aiPattern = this.aiController.getCurrentPatternTag();
    this.customData.aiTransitions = this.aiController.transitionCount;
  }

  private createAIController(): StateMachineAIController<DarknutState, DarknutAIContext> {
    return new StateMachineAIController<DarknutState, DarknutAIContext>({
      controllerName: 'DarknutTacticalFSM',
      initialState: 'patrol',
      initialTimer: 0,
      states: {
        patrol: {
          name: 'patrol',
          patternTag: 'tactical_lane_patrol',
          onEnter: () => {
            this.behaviorState = 'patrol';
            this.actionTimer = 35 + Math.floor(Math.random() * 45);
          },
          onUpdate: (ctx, controller) => {
            this.behaviorState = 'patrol';

            // Heavy armored stride animation
            this.animTimer++;
            if (this.animTimer > 9) {
              this.animFrame = (this.animFrame + 1) % 2;
              this.animTimer = 0;
            }

            // Detect player in close proximity, unobstructed LOS, or aligned down an open corridor lane
            const laneAligned =
              Math.abs(ctx.player.x - this.x) <= 12 ||
              Math.abs(ctx.player.y - this.y) <= 12;
            const spottedInRange =
              ctx.distToPlayer <= this.chargeRange ||
              (ctx.distToPlayer <= this.chargeRange * 1.4 &&
                this.hasClearLineOfSight(ctx.player, ctx.checkTileCollision)) ||
              (laneAligned &&
                ctx.distToPlayer <= this.chargeRange * 1.6 &&
                this.hasClearLineOfSight(ctx.player, ctx.checkTileCollision));

            if (this.chargeCooldown <= 0 && spottedInRange) {
              controller.transitionTo('windup', ctx, 'player_spotted');
              return;
            }

            // Periodic tactical lane turn
            this.actionTimer--;
            if (this.actionTimer <= 0) {
              this.pickTacticalPatrolDirection(ctx.player, ctx.checkTileCollision);
              this.actionTimer = 45 + Math.floor(Math.random() * 55);
            }

            // Advance along current cardinal lane
            const [vx, vy] = this.getCardinalVelocity(this.dir, this.speed);
            const nextX = this.x + vx;
            const nextY = this.y + vy;

            if (
              !this.isOutOfBounds(nextX, nextY) &&
              !ctx.checkTileCollision(nextX, nextY, 14, 14)
            ) {
              this.x = nextX;
              this.y = nextY;
            } else {
              this.pickTacticalPatrolDirection(ctx.player, ctx.checkTileCollision);
              this.actionTimer = 35 + Math.floor(Math.random() * 35);
            }
          },
        },

        windup: {
          name: 'windup',
          patternTag: 'shield_brace_windup',
          onEnter: (ctx, _prev, controller) => {
            this.dir = this.getDirectionTowardPlayer(ctx.player);
            this.behaviorState = 'windup';
            controller.stateTimer = 14;
            this.alertTimer = 18;
            ctx.audio?.playEnemyAlert?.();
          },
          onUpdate: (ctx, controller) => {
            // Track Link's movement with frontal shield raised while bracing
            this.dir = this.getDirectionTowardPlayer(ctx.player);
            controller.stateTimer--;

            if (controller.stateTimer <= 0) {
              controller.transitionTo('charge', ctx, 'windup_complete');
            }
          },
        },

        charge: {
          name: 'charge',
          patternTag: 'wall_slide_armored_charge',
          onEnter: (ctx, _prev, controller) => {
            this.dir = this.getDirectionTowardPlayer(ctx.player);
            this.behaviorState = 'attack';
            controller.stateTimer = 42;
            this.chargeReaimTimer = 10;
            ctx.audio?.playMeleeLunge?.();
            ctx.particles?.emitEmberPuff(this.x + 8, this.y + 8);
          },
          onUpdate: (ctx, controller) => {
            controller.stateTimer--;
            this.chargeReaimTimer--;

            // Rapid armored footsteps
            this.animTimer++;
            if (this.animTimer > 4) {
              this.animFrame = (this.animFrame + 1) % 2;
              this.animTimer = 0;
            }

            // Periodically re-align cardinal heading toward Link during the charge
            if (this.chargeReaimTimer <= 0) {
              this.dir = this.getDirectionTowardPlayer(ctx.player);
              this.chargeReaimTimer = 10;
            }

            const dx = ctx.player.x - this.x;
            const dy = ctx.player.y - this.y;
            const primaryDir = this.dir;
            const secondaryDir =
              primaryDir === Direction.LEFT || primaryDir === Direction.RIGHT
                ? dy >= 0
                  ? Direction.DOWN
                  : Direction.UP
                : dx >= 0
                  ? Direction.RIGHT
                  : Direction.LEFT;

            const [pvx, pvy] = this.getCardinalVelocity(primaryDir, this.chargeSpeed);
            const pnx = this.x + pvx;
            const pny = this.y + pvy;

            if (
              !this.isOutOfBounds(pnx, pny) &&
              !ctx.checkTileCollision(pnx, pny, 14, 14)
            ) {
              this.x = pnx;
              this.y = pny;
            } else {
              // Tactical wall-slide along secondary axis toward Link
              const [svx, svy] = this.getCardinalVelocity(secondaryDir, this.chargeSpeed);
              const snx = this.x + svx;
              const sny = this.y + svy;

              if (
                !this.isOutOfBounds(snx, sny) &&
                !ctx.checkTileCollision(snx, sny, 14, 14)
              ) {
                this.x = snx;
                this.y = sny;
                this.dir = secondaryDir;
              } else {
                controller.transitionTo('recover', ctx, 'wall_impact');
                return;
              }
            }

            if (controller.stateTimer <= 0) {
              controller.transitionTo('recover', ctx, 'charge_expired');
            } else if (ctx.distToPlayer > this.chargeRange * 2.1) {
              controller.transitionTo('recover', ctx, 'target_out_of_range');
            }
          },
        },

        recover: {
          name: 'recover',
          patternTag: 'guard_recovery',
          onEnter: (_ctx, _prev, controller) => {
            this.behaviorState = 'patrol';
            controller.stateTimer = 20;
            this.chargeCooldown = 42;
          },
          onUpdate: (ctx, controller) => {
            controller.stateTimer--;
            if (controller.stateTimer <= 0) {
              controller.transitionTo('patrol', ctx, 'recovery_complete');
            }
          },
        },
      },
    });
  }

  /**
   * Returns true if an incoming attack moving in `attackDir` strikes the front
   * of this Darknut's shield (i.e. opposite to Darknut's facing direction).
   */
  public isShieldBlocking(attackDir: Direction): boolean {
    return (
      (this.dir === Direction.UP && attackDir === Direction.DOWN) ||
      (this.dir === Direction.DOWN && attackDir === Direction.UP) ||
      (this.dir === Direction.LEFT && attackDir === Direction.RIGHT) ||
      (this.dir === Direction.RIGHT && attackDir === Direction.LEFT)
    );
  }

  /**
   * Main update routine called every frame by the game engine.
   */
  public update(
    player: PlayerState,
    checkTileCollision: TileCollisionFn,
    damagePlayer: (dmg: number, dir: Direction) => void,
    audio?: DarknutAudio,
    particles?: ParticleSystem
  ): void {
    if (this.alertTimer && this.alertTimer > 0) {
      this.alertTimer--;
    }
    if (this.chargeCooldown > 0) {
      this.chargeCooldown--;
    }

    const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);

    this.aiController.update({
      player,
      distToPlayer,
      checkTileCollision,
      audio,
      particles,
    });

    this.syncCustomData();

    // Contact melee damage against Link
    const contactDist = Math.hypot(this.x - player.x, this.y - player.y);
    if (contactDist < 14) {
      damagePlayer(this.meleeDamage, this.dir);
    }
  }

  /**
   * Turns directly toward Link and initiates charge windup telegraph via the FSM controller.
   */
  public startChargeWindup(player: PlayerState, audio?: DarknutAudio): void {
    const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
    this.aiController.transitionTo(
      'windup',
      {
        player,
        distToPlayer,
        checkTileCollision: NO_OP_COLLISION,
        audio,
      },
      'manual_windup'
    );
    this.syncCustomData();
  }

  /**
   * Reacts when an attack deflects off the Darknut's frontal shield.
   */
  public onShieldBlock(player: PlayerState, audio?: DarknutAudio): void {
    this.dir = this.getDirectionTowardPlayer(player);
    if (this.darknutState === 'patrol' || this.darknutState === 'recover') {
      const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
      this.aiController.transitionTo(
        'windup',
        {
          player,
          distToPlayer,
          checkTileCollision: NO_OP_COLLISION,
          audio,
        },
        'shield_deflect_counter'
      );
      this.syncCustomData();
    } else {
      this.alertTimer = 16;
    }
  }

  /**
   * Reacts when hit by an unblocked flank/rear strike by turning to counter-charge.
   */
  public onDamaged(player: PlayerState, audio?: DarknutAudio): void {
    this.dir = this.getDirectionTowardPlayer(player);
    this.chargeCooldown = 0;
    const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
    this.aiController.transitionTo(
      'windup',
      {
        player,
        distToPlayer,
        checkTileCollision: NO_OP_COLLISION,
        audio,
      },
      'damaged_counter'
    );
    this.syncCustomData();
  }

  /**
   * Transitions from windup into an active armored charge toward the player via the FSM controller.
   */
  public launchCharge(
    player: PlayerState,
    audio?: DarknutAudio,
    particles?: ParticleSystem
  ): void {
    const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
    this.aiController.transitionTo(
      'charge',
      {
        player,
        distToPlayer,
        checkTileCollision: NO_OP_COLLISION,
        audio,
        particles,
      },
      'manual_charge'
    );
    this.syncCustomData();
  }

  /**
   * Returns the cardinal direction pointing most directly toward the player.
   */
  public getDirectionTowardPlayer(player: PlayerState): Direction {
    const dx = player.x - this.x;
    const dy = player.y - this.y;

    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx >= 0 ? Direction.RIGHT : Direction.LEFT;
    }
    return dy >= 0 ? Direction.DOWN : Direction.UP;
  }

  private hasClearLineOfSight(
    player: PlayerState,
    checkTileCollision: TileCollisionFn
  ): boolean {
    const x1 = this.x + 8;
    const y1 = this.y + 8;
    const x2 = player.x + 8;
    const y2 = player.y + 8;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (dist < 10) return true;

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
   * Picks an open cardinal corridor direction, favoring turning away from blocked tiles
   * and closing onto Link's X/Y lane rather than purely random wandering.
   */
  private pickTacticalPatrolDirection(
    player: PlayerState,
    checkTileCollision: TileCollisionFn
  ): void {
    const dirs = [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT];
    const openDirs = dirs.filter((d) => {
      const [vx, vy] = this.getCardinalVelocity(d, 4);
      const nx = this.x + vx;
      const ny = this.y + vy;
      return !this.isOutOfBounds(nx, ny) && !checkTileCollision(nx, ny, 14, 14);
    });

    if (openDirs.length > 0) {
      const others = openDirs.filter((d) => d !== this.dir);
      const pool = others.length > 0 ? others : openDirs;

      // Score open directions by how much they align with or narrow distance to Link's lane
      const preferred = this.getDirectionTowardPlayer(player);
      if (pool.includes(preferred) && Math.random() < 0.7) {
        this.dir = preferred;
        return;
      }

      this.dir = pool[Math.floor(Math.random() * pool.length)];
    } else {
      this.dir = this.getOppositeDirection(this.dir);
    }
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

  /**
   * Unused fallback player getter kept private for default contexts if needed.
   */
  protected static getDefaultPlayer(): PlayerState {
    return FALLBACK_PLAYER;
  }
}
