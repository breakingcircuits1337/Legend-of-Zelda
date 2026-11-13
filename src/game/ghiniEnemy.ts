/**
 * The Legend of Zelda NES - Ghini Enemy Subclass
 *
 * Implements the haunting graveyard ghost of Hyrule:
 * 1. Dormant Statue Phase (`statue`):
 *    - Remains completely stationary, statue-like, and harmless on graveyard tiles.
 *    - Does not deal contact damage or pursue the player until touched.
 * 2. Awakening on Touch (`statue` -> `active`):
 *    - As soon as Link physically touches the statue-like Ghini, it awakens
 *      into a spectral ghost with an eerie chime and particle burst.
 * 3. Aggressive Ghostly Pursuit & Sword Immunity (`active`):
 *    - Floats above gravestones and solid terrain, relentlessly chasing Link
 *      with an eerie hovering drift.
 *    - Immune to standard sword slashes and sword beams (`sword`, `sword_beam`);
 *      must be defeated using secondary items (Bombs, Arrows, Candle Flame, Magical Rod).
 */

import { Direction, EnemyType, PlayerState } from '../types';
import { BaseEnemy } from './octorokEnemy';
import { ParticleSystem } from './particles';

export type GhiniState = 'statue' | 'active';

export type GhiniAttackSource =
  | 'sword'
  | 'sword_beam'
  | 'boomerang'
  | 'bomb'
  | 'arrow'
  | 'flame'
  | 'magic_wave'
  | 'secondary';

export interface GhiniAudio {
  playGhiniAwaken?: () => void;
  playEnemyAlert?: () => void;
  playShieldDeflect?: () => void;
}

export interface GhiniEnemyOptions {
  id: string;
  x: number;
  y: number;
  dir?: Direction;
  health?: number;
  activeSpeed?: number;
  initialState?: GhiniState;
}

export class GhiniEnemy extends BaseEnemy {
  public ghiniState: GhiniState = 'statue';
  public isAwakened: boolean = false;
  public isStatue: boolean = true;
  public isFlying: boolean = false;
  public isSwordImmune: boolean = true;
  public activeSpeed: number;
  public meleeDamage: number = 1;
  public wakeGraceTimer: number = 0;
  public bobPhase: number = 0;
  public driftPhase: number = 0;
  public awakenCount: number = 0;
  public override jumpYOffset: number = 0;

  constructor(options: GhiniEnemyOptions) {
    const activeSpeed = options.activeSpeed ?? 1.15;
    const initial = options.initialState ?? 'statue';

    super({
      id: options.id,
      type: EnemyType.GHINI,
      x: options.x,
      y: options.y,
      dir: options.dir ?? Direction.DOWN,
      health: options.health ?? 4,
      speed: initial === 'active' ? activeSpeed : 0,
    });

    this.activeSpeed = activeSpeed;
    this.ghiniState = initial;
    this.driftPhase = Math.random() * Math.PI * 2;

    if (initial === 'active') {
      this.isAwakened = true;
      this.isStatue = false;
      this.isFlying = true;
      this.jumpYOffset = 4;
      this.behaviorState = 'chase';
      this.wakeGraceTimer = 0;
    } else {
      this.isAwakened = false;
      this.isStatue = true;
      this.isFlying = false;
      this.jumpYOffset = 0;
      this.behaviorState = 'patrol';
      this.wakeGraceTimer = 0;
    }

    this.syncCustomData();
  }

  private syncCustomData(): void {
    this.customData.isAwakened = this.isAwakened;
    this.customData.isStatue = this.isStatue;
    this.customData.isFlying = this.isFlying;
    this.customData.isSwordImmune = this.isSwordImmune;
    this.customData.ghiniState = this.ghiniState;
  }

  /**
   * Determines whether an attack from `source` can damage this Ghini.
   * - While dormant (`statue`), it cannot be harmed until touched/awakened.
   * - While `active`, standard sword slashes and sword beams bounce off harmlessly;
   *   only secondary items (bombs, arrows, candle flame, magical rod) deal damage.
   */
  public canBeDamagedBy(source: GhiniAttackSource): boolean {
    if (!this.isAwakened || this.ghiniState !== 'active') {
      return false;
    }
    if (source === 'sword' || source === 'sword_beam' || source === 'boomerang') {
      return false;
    }
    return true;
  }

  /**
   * Main per-frame update routine invoked by the game engine.
   */
  public update(
    player: PlayerState,
    damagePlayer: (dmg: number, dir: Direction) => void,
    audio?: GhiniAudio,
    particles?: ParticleSystem
  ): void {
    if (this.alertTimer && this.alertTimer > 0) {
      this.alertTimer--;
    }

    const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);

    if (this.ghiniState === 'statue') {
      // Remain completely motionless and harmless until Link physically touches it
      this.isAwakened = false;
      this.isStatue = true;
      this.isFlying = false;
      this.speed = 0;
      this.jumpYOffset = 0;
      this.behaviorState = 'patrol';

      if (distToPlayer < 16) {
        this.awaken(player, audio, particles);
      }

      this.syncCustomData();
      return;
    }

    // Active aggressive ghost state
    this.updateActive(player, distToPlayer, damagePlayer);
    this.syncCustomData();
  }

  /**
   * Awakens the statue-like Ghini into an aggressive hovering ghost.
   */
  public awaken(
    player?: PlayerState,
    audio?: GhiniAudio,
    particles?: ParticleSystem
  ): void {
    if (this.ghiniState === 'active' && this.isAwakened) {
      return;
    }

    this.ghiniState = 'active';
    this.isAwakened = true;
    this.isStatue = false;
    this.isFlying = true;
    this.speed = this.activeSpeed;
    this.behaviorState = 'chase';
    this.alertTimer = 20;
    this.wakeGraceTimer = 16; // Brief fair window after touching statue before contact damage triggers
    this.bobPhase = 0;
    this.jumpYOffset = 4;
    this.awakenCount++;

    if (player) {
      this.facePlayer(player);
    }

    audio?.playGhiniAwaken?.();
    particles?.emitEmberPuff(this.x + 8, this.y + 8);
    this.syncCustomData();
  }

  private updateActive(
    player: PlayerState,
    distToPlayer: number,
    damagePlayer: (dmg: number, dir: Direction) => void
  ): void {
    this.isAwakened = true;
    this.isStatue = false;
    this.isFlying = true;
    this.speed = this.activeSpeed;
    this.behaviorState = 'chase';

    if (this.wakeGraceTimer > 0) {
      this.wakeGraceTimer--;
    }

    // Ghostly wing/shroud animation frame
    this.animTimer++;
    if (this.animTimer > 5) {
      this.animFrame = (this.animFrame + 1) % 2;
      this.animTimer = 0;
    }

    // Spectral floating bob altitude
    this.bobPhase += 0.14;
    this.driftPhase += 0.08;
    this.jumpYOffset = 4 + Math.sin(this.bobPhase) * 2;

    // Relentless ghostly pursuit ignoring solid gravestones/obstacles, with eerie lateral drift
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = distToPlayer || 1;

    const dirX = dx / dist;
    const dirY = dy / dist;

    // Perpendicular spectral sway so the ghost swoops menacingly while closing distance
    const sway = Math.sin(this.driftPhase) * 0.35;
    const vx = (dirX - dirY * sway) * this.activeSpeed;
    const vy = (dirY + dirX * sway) * this.activeSpeed;

    this.x = Math.max(16, Math.min(224, this.x + vx));
    this.y = Math.max(16, Math.min(144, this.y + vy));

    if (Math.abs(vx) >= Math.abs(vy)) {
      this.dir = vx >= 0 ? Direction.RIGHT : Direction.LEFT;
    } else {
      this.dir = vy >= 0 ? Direction.DOWN : Direction.UP;
    }

    // Contact damage once active and beyond brief wake-up grace
    if (this.wakeGraceTimer <= 0 && distToPlayer < 13) {
      damagePlayer(this.meleeDamage, this.dir);
    }
  }

  private facePlayer(player: PlayerState): void {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      this.dir = dx >= 0 ? Direction.RIGHT : Direction.LEFT;
    } else {
      this.dir = dy >= 0 ? Direction.DOWN : Direction.UP;
    }
  }
}
