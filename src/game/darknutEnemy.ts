/**
 * The Legend of Zelda NES - Darknut Enemy Subclass
 *
 * Implements the heavily armored Darknut knight:
 * 1. High Health & Frontal Shield:
 *    - Red Darknuts carry 4 HP and deal 1 half-heart contact damage.
 *    - Blue Darknuts carry 8 HP and deal 2 half-hearts (1 full heart) damage.
 *    - Blocks sword strikes and sword beams hitting its frontal shield, forcing
 *      tactical flanking or bomb play.
 * 2. Armored Patrol:
 *    - Marches steadily around the screen along cardinal lanes, turning cleanly
 *      at corners and obstacles.
 * 3. Proximity Turn & Charge:
 *    - When Link enters detection range (or unobstructed line of sight), the
 *      Darknut turns directly toward Link, telegraphs briefly, and launches an
 *      armored charge with wall-sliding pursuit before recovering.
 */

import { Direction, EnemyType, PlayerState } from '../types';
import { BaseEnemy } from './octorokEnemy';
import { ParticleSystem } from './particles';

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

export class DarknutEnemy extends BaseEnemy {
  public darknutState: DarknutState = 'patrol';
  public stateTimer: number = 0;
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

    switch (this.darknutState) {
      case 'patrol':
        this.updatePatrol(player, distToPlayer, checkTileCollision, audio);
        break;

      case 'windup':
        this.updateWindup(player, audio, particles);
        break;

      case 'charge':
        this.updateCharge(player, distToPlayer, checkTileCollision);
        break;

      case 'recover':
        this.updateRecover();
        break;
    }

    // Contact melee damage against Link
    const contactDist = Math.hypot(this.x - player.x, this.y - player.y);
    if (contactDist < 14) {
      damagePlayer(this.meleeDamage, this.dir);
    }
  }

  /**
   * Armored patrol movement across the room:
   * Scans for Link within charge range; if spotted, turns toward Link to charge.
   */
  private updatePatrol(
    player: PlayerState,
    distToPlayer: number,
    checkTileCollision: TileCollisionFn,
    audio?: DarknutAudio
  ): void {
    this.behaviorState = 'patrol';

    // Heavy armored stride animation
    this.animTimer++;
    if (this.animTimer > 9) {
      this.animFrame = (this.animFrame + 1) % 2;
      this.animTimer = 0;
    }

    // Detect player within range (or slightly further with clear line of sight)
    const spottedInRange =
      distToPlayer <= this.chargeRange ||
      (distToPlayer <= this.chargeRange * 1.4 &&
        this.hasClearLineOfSight(player, checkTileCollision));

    if (this.chargeCooldown <= 0 && spottedInRange) {
      this.startChargeWindup(player, audio);
      return;
    }

    // Periodic cardinal turn
    this.actionTimer--;
    if (this.actionTimer <= 0) {
      this.pickOpenDirection(checkTileCollision);
      this.actionTimer = 45 + Math.floor(Math.random() * 55);
    }

    // Advance along current direction
    const [vx, vy] = this.getCardinalVelocity(this.dir, this.speed);
    const nextX = this.x + vx;
    const nextY = this.y + vy;

    if (!this.isOutOfBounds(nextX, nextY) && !checkTileCollision(nextX, nextY, 14, 14)) {
      this.x = nextX;
      this.y = nextY;
    } else {
      this.pickOpenDirection(checkTileCollision);
      this.actionTimer = 35 + Math.floor(Math.random() * 35);
    }
  }

  /**
   * Turns directly toward Link and initiates charge windup telegraph.
   */
  public startChargeWindup(player: PlayerState, audio?: DarknutAudio): void {
    this.dir = this.getDirectionTowardPlayer(player);
    this.darknutState = 'windup';
    this.behaviorState = 'windup';
    this.stateTimer = 14;
    this.alertTimer = 18;
    audio?.playEnemyAlert?.();
  }

  /**
   * Reacts when an attack deflects off the Darknut's frontal shield.
   */
  public onShieldBlock(player: PlayerState, audio?: DarknutAudio): void {
    this.dir = this.getDirectionTowardPlayer(player);
    if (this.darknutState === 'patrol' || this.darknutState === 'recover') {
      this.startChargeWindup(player, audio);
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
    this.startChargeWindup(player, audio);
  }

  private updateWindup(
    player: PlayerState,
    audio?: DarknutAudio,
    particles?: ParticleSystem
  ): void {
    // Keep facing the player while bracing to charge
    this.dir = this.getDirectionTowardPlayer(player);
    this.stateTimer--;

    if (this.stateTimer <= 0) {
      this.launchCharge(player, audio, particles);
    }
  }

  /**
   * Transitions from windup into an active armored charge toward the player.
   */
  public launchCharge(
    player: PlayerState,
    audio?: DarknutAudio,
    particles?: ParticleSystem
  ): void {
    this.dir = this.getDirectionTowardPlayer(player);
    this.darknutState = 'charge';
    this.behaviorState = 'attack';
    this.stateTimer = 42;
    this.chargeReaimTimer = 10;

    audio?.playMeleeLunge?.();
    particles?.emitEmberPuff(this.x + 8, this.y + 8);
  }

  /**
   * High-speed armored charge toward Link with tactical axis wall-sliding.
   */
  private updateCharge(
    player: PlayerState,
    distToPlayer: number,
    checkTileCollision: TileCollisionFn
  ): void {
    this.stateTimer--;
    this.chargeReaimTimer--;

    // Rapid armored footsteps
    this.animTimer++;
    if (this.animTimer > 4) {
      this.animFrame = (this.animFrame + 1) % 2;
      this.animTimer = 0;
    }

    // Periodically re-align cardinal heading toward Link during the charge
    if (this.chargeReaimTimer <= 0) {
      this.dir = this.getDirectionTowardPlayer(player);
      this.chargeReaimTimer = 10;
    }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
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

    if (!this.isOutOfBounds(pnx, pny) && !checkTileCollision(pnx, pny, 14, 14)) {
      this.x = pnx;
      this.y = pny;
    } else {
      // Tactical wall-slide along secondary axis toward Link
      const [svx, svy] = this.getCardinalVelocity(secondaryDir, this.chargeSpeed);
      const snx = this.x + svx;
      const sny = this.y + svy;

      if (!this.isOutOfBounds(snx, sny) && !checkTileCollision(snx, sny, 14, 14)) {
        this.x = snx;
        this.y = sny;
        this.dir = secondaryDir;
      } else {
        // Halted by corner/wall: enter brief recovery
        this.enterRecover();
        return;
      }
    }

    if (this.stateTimer <= 0 || distToPlayer > this.chargeRange * 2.1) {
      this.enterRecover();
    }
  }

  private enterRecover(): void {
    this.darknutState = 'recover';
    this.behaviorState = 'patrol';
    this.stateTimer = 20;
    this.chargeCooldown = 42;
  }

  private updateRecover(): void {
    this.stateTimer--;
    if (this.stateTimer <= 0) {
      this.darknutState = 'patrol';
      this.behaviorState = 'patrol';
      this.actionTimer = 35 + Math.floor(Math.random() * 40);
    }
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

  private pickOpenDirection(checkTileCollision: TileCollisionFn): void {
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
}
