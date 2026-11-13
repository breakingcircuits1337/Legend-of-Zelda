/**
 * The Legend of Zelda NES - Peahat Enemy Subclass
 *
 * Implements the spinning propeller-flower enemy of Hyrule:
 * 1. Rooted Ground Phase (`rooted`):
 *    - Remains stationary and rooted in the ground for a duration.
 *    - Protected by its tough outer shell while rooted (`isVulnerable = false`).
 * 2. Vulnerable Flight Phase (`flying`):
 *    - Launches into the air (`isFlying = true`, `jumpYOffset > 0`) and becomes
 *      vulnerable to the player's attacks (`isVulnerable = true`).
 *    - Flies in a circular and erratic swirling pattern around the player
 *      before descending back to open ground and rooting again.
 */

import { Direction, EnemyType, PlayerState } from '../types';
import { BaseEnemy } from './octorokEnemy';
import { ParticleSystem } from './particles';

export type TileCollisionFn = (x: number, y: number, w: number, h: number) => boolean;

export type PeahatState = 'rooted' | 'flying';

export interface PeahatAudio {
  playPeahatSpin?: () => void;
  playEnemyAlert?: () => void;
}

export interface PeahatEnemyOptions {
  id: string;
  x: number;
  y: number;
  dir?: Direction;
  health?: number;
  speed?: number;
  initialState?: PeahatState;
}

export class PeahatEnemy extends BaseEnemy {
  public peahatState: PeahatState = 'rooted';
  public stateTimer: number = 0;
  public isFlying: boolean = false;
  public isVulnerable: boolean = false;
  public orbitAngle: number = 0;
  public orbitRadius: number = 52;
  public orbitDirection: 1 | -1 = 1;
  public erraticPhase: number = 0;
  public angularSpeed: number = 0.055;
  public cruiseAltitude: number = 8;
  public meleeDamage: number = 1;
  public flightCount: number = 0;
  public override jumpYOffset: number = 0;

  constructor(options: PeahatEnemyOptions) {
    super({
      id: options.id,
      type: EnemyType.PEAHAT,
      x: options.x,
      y: options.y,
      dir: options.dir ?? Direction.DOWN,
      health: options.health ?? 2,
      speed: options.speed ?? 1.55,
    });

    const initial = options.initialState ?? 'rooted';
    this.peahatState = initial;

    if (initial === 'flying') {
      this.isFlying = true;
      this.isVulnerable = true;
      this.jumpYOffset = this.cruiseAltitude;
      this.behaviorState = 'attack';
      this.stateTimer = 160 + Math.floor(Math.random() * 60);
    } else {
      this.isFlying = false;
      this.isVulnerable = false;
      this.jumpYOffset = 0;
      this.behaviorState = 'patrol';
      this.stateTimer = 65 + Math.floor(Math.random() * 55);
    }

    this.syncCustomData();
  }

  private syncCustomData(): void {
    this.customData.isFlying = this.isFlying;
    this.customData.isVulnerable = this.isVulnerable;
    this.customData.peahatState = this.peahatState;
  }

  /**
   * Main update routine invoked each frame by the engine.
   */
  public update(
    player: PlayerState,
    checkTileCollision: TileCollisionFn,
    damagePlayer: (dmg: number, dir: Direction) => void,
    audio?: PeahatAudio,
    particles?: ParticleSystem
  ): void {
    if (this.alertTimer && this.alertTimer > 0) {
      this.alertTimer--;
    }

    if (this.peahatState === 'rooted') {
      this.updateRooted(player, audio, particles);
    } else {
      this.updateFlying(player, checkTileCollision, particles);
    }

    // Contact melee damage against Link
    const distToPlayer = Math.hypot(this.x - player.x, this.y - player.y);
    if (distToPlayer < 13) {
      damagePlayer(this.meleeDamage, this.dir);
    }

    this.syncCustomData();
  }

  /**
   * Stationary grounded state:
   * Remains rooted in the soil until its timer expires, then takes flight.
   */
  private updateRooted(
    player: PlayerState,
    audio?: PeahatAudio,
    particles?: ParticleSystem
  ): void {
    this.isFlying = false;
    this.isVulnerable = false;
    this.jumpYOffset = 0;
    this.behaviorState = 'patrol';
    this.stateTimer--;

    if (this.stateTimer <= 0) {
      this.takeFlight(player, audio, particles);
    }
  }

  /**
   * Launches the Peahat into its vulnerable circular/erratic flight around Link.
   */
  public takeFlight(
    player: PlayerState,
    audio?: PeahatAudio,
    particles?: ParticleSystem
  ): void {
    this.peahatState = 'flying';
    this.isFlying = true;
    this.isVulnerable = true;
    this.behaviorState = 'attack';
    this.stateTimer = 160 + Math.floor(Math.random() * 70);
    this.alertTimer = 16;
    this.flightCount++;

    // Initialize circular orbit around the player from current relative position
    const dx = this.x - player.x;
    const dy = this.y - player.y;
    this.orbitAngle = Math.atan2(dy, dx);
    this.orbitDirection = Math.random() < 0.5 ? 1 : -1;
    this.orbitRadius = Math.max(34, Math.min(72, Math.hypot(dx, dy) || 48));
    this.erraticPhase = Math.random() * Math.PI * 2;
    this.jumpYOffset = 2;

    audio?.playPeahatSpin?.();
    particles?.emitEmberPuff(this.x + 8, this.y + 12);
    this.syncCustomData();
  }

  /**
   * Vulnerable airborne phase:
   * Orbits around the player in a circular + erratic pattern before landing.
   */
  private updateFlying(
    player: PlayerState,
    checkTileCollision: TileCollisionFn,
    particles?: ParticleSystem
  ): void {
    this.isFlying = true;
    this.isVulnerable = true;
    this.behaviorState = 'attack';
    this.stateTimer--;

    // Rapid propeller frame stepping
    this.animTimer++;
    if (this.animTimer > 2) {
      this.animFrame = (this.animFrame + 1) % 2;
      this.animTimer = 0;
    }

    // Advance circular orbit angle & erratic radial wave around player
    this.erraticPhase += 0.14;
    this.orbitAngle += this.orbitDirection * this.angularSpeed;

    // Occasionally flip erratic swirl jitter
    if (Math.random() < 0.02) {
      this.angularSpeed = 0.045 + Math.random() * 0.03;
    }

    const modulatedRadius =
      this.orbitRadius +
      Math.sin(this.erraticPhase) * 14 +
      Math.cos(this.erraticPhase * 0.6) * 6;

    const targetX = player.x + Math.cos(this.orbitAngle) * modulatedRadius;
    const targetY = player.y + Math.sin(this.orbitAngle) * modulatedRadius;

    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const distToTarget = Math.hypot(dx, dy) || 1;
    const step = Math.min(this.speed, distToTarget);

    const vx = (dx / distToTarget) * step;
    const vy = (dy / distToTarget) * step;

    this.x = Math.max(16, Math.min(224, this.x + vx));
    this.y = Math.max(16, Math.min(144, this.y + vy));

    if (Math.abs(vx) >= Math.abs(vy)) {
      this.dir = vx >= 0 ? Direction.RIGHT : Direction.LEFT;
    } else {
      this.dir = vy >= 0 ? Direction.DOWN : Direction.UP;
    }

    // Smooth takeoff & landing altitude curve
    if (this.stateTimer <= 18) {
      this.jumpYOffset = Math.max(1, (this.stateTimer / 18) * this.cruiseAltitude);
    } else {
      this.jumpYOffset = Math.min(
        this.cruiseAltitude,
        this.jumpYOffset + 0.6
      ) + Math.sin(this.erraticPhase * 1.5) * 1.2;
    }

    // Ready to return to the ground
    if (this.stateTimer <= 0) {
      // Only root if above open walkable terrain (avoid landing inside rocks/trees/ocean)
      if (!checkTileCollision(this.x, this.y, 14, 14) || this.stateTimer <= -45) {
        this.landOnGround(particles);
      }
    }
  }

  /**
   * Returns to the ground and becomes stationary/rooted until the next flight cycle.
   */
  public landOnGround(particles?: ParticleSystem): void {
    this.peahatState = 'rooted';
    this.isFlying = false;
    this.isVulnerable = false;
    this.jumpYOffset = 0;
    this.behaviorState = 'patrol';
    this.stateTimer = 70 + Math.floor(Math.random() * 55);

    particles?.emitEmberPuff(this.x + 8, this.y + 14);
    this.syncCustomData();
  }
}
