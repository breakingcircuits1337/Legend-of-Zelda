/**
 * The Legend of Zelda NES - Keese Enemy Subclass
 *
 * Implements the iconic flying bat enemy:
 * 1. Erratic flapping flight patterns:
 *    - Flutters across the room in undulating, zigzag aerial flight paths.
 *    - Rapid wing-flapping animation alternating between wings up and wings down.
 *    - Bounces off screen boundaries and room perimeter walls.
 * 2. Aerial hovering & height elevation:
 *    - Maintains an elevated altitude above the ground (jumpYOffset > 0).
 *    - Casts an 8-bit drop shadow beneath it on the floor.
 * 3. Occasional aerial swoop dives toward the player:
 *    - Periodically locks onto Link's position and dives downward in a high-speed swoop.
 *    - Descends in altitude during the dive, posing a dynamic aerial melee threat.
 *    - Pulls up and ascends back into erratic flutter flight.
 */

import { Direction, EnemyType, PlayerState } from '../types';
import { BaseEnemy } from './octorokEnemy';
import { ParticleSystem } from './particles';

export type TileCollisionFn = (x: number, y: number, w: number, h: number) => boolean;

export type KeeseState = 'hover' | 'flutter' | 'swoop' | 'ascend';

export interface KeeseAudio {
  playKeeseSwoop?: () => void;
  playKeeseFlap?: () => void;
  playEnemyAlert?: () => void;
}

export interface KeeseEnemyOptions {
  id: string;
  x: number;
  y: number;
  dir?: Direction;
  health?: number;
  speed?: number;
}

export class KeeseEnemy extends BaseEnemy {
  public flightState: KeeseState = 'flutter';
  public stateTimer: number = 0;
  public totalSwoopDuration: number = 24;
  public swoopCooldown: number = 120;
  public swoopVx: number = 0;
  public swoopVy: number = 0;
  public flightAngle: number = 0;
  public wavePhase: number = 0;
  public erraticTimer: number = 30;
  public hoverAltitude: number = 6;
  public currentSpeed: number = 1.1;
  public override jumpYOffset: number = 6;

  constructor(options: KeeseEnemyOptions) {
    super({
      id: options.id,
      type: EnemyType.KEESE,
      x: options.x,
      y: options.y,
      dir: options.dir ?? Direction.DOWN,
      health: options.health ?? 1,
      speed: options.speed ?? 1.1,
    });

    this.jumpYOffset = this.hoverAltitude;
    this.flightAngle = Math.random() * Math.PI * 2;
    this.swoopCooldown = 90 + Math.floor(Math.random() * 90);
    this.erraticTimer = 20 + Math.floor(Math.random() * 25);
    this.behaviorState = 'patrol';
  }

  /**
   * Main update routine called each frame by the game engine.
   */
  public update(
    player: PlayerState,
    checkTileCollision: TileCollisionFn,
    damagePlayer: (dmg: number, dir: Direction) => void,
    audio?: KeeseAudio,
    particles?: ParticleSystem
  ): void {
    // 1. Decrement visual 8-bit alert telegraph
    if (this.alertTimer && this.alertTimer > 0) {
      this.alertTimer--;
    }

    // 2. Finite state update: flutter -> swoop -> ascend -> flutter
    switch (this.flightState) {
      case 'flutter':
        this.updateFlutter(player, audio, particles);
        break;

      case 'swoop':
        this.updateSwoop(particles);
        break;

      case 'ascend':
        this.updateAscend();
        break;

      case 'hover':
        this.updateHover(player, audio);
        break;
    }

    // 3. Melee contact damage against Link
    const distToPlayer = Math.hypot(this.x - player.x, this.y - player.y);
    if (distToPlayer < 12) {
      damagePlayer(1, this.dir);
    }
  }

  /**
   * Erratic flapping flight phase:
   * Moves across the screen with sinusoidal wave undulations and random direction shifts.
   */
  private updateFlutter(
    player: PlayerState,
    audio?: KeeseAudio,
    particles?: ParticleSystem
  ): void {
    // Wing flap animation: rapidly toggle between wings up and wings down
    this.animTimer++;
    if (this.animTimer > 4) {
      this.animFrame = (this.animFrame + 1) % 2;
      this.animTimer = 0;
    }

    // Undulating aerial height
    this.wavePhase += 0.16;
    this.jumpYOffset = Math.max(
      3,
      this.hoverAltitude + Math.sin(this.wavePhase * 1.5) * 2.5
    );

    // Periodically shift erratic flight heading
    this.erraticTimer--;
    if (this.erraticTimer <= 0) {
      this.flightAngle += (Math.random() - 0.5) * 1.4; // shift flight angle by up to ~40 degrees
      this.erraticTimer = 20 + Math.floor(Math.random() * 30);
      this.currentSpeed = 0.8 + Math.random() * 0.7; // modulate flight speed
    }

    // Compute erratic wave displacement
    const waveOffset = Math.sin(this.wavePhase) * 0.6;
    const vx =
      Math.cos(this.flightAngle) * this.currentSpeed -
      Math.sin(this.flightAngle) * waveOffset;
    const vy =
      Math.sin(this.flightAngle) * this.currentSpeed +
      Math.cos(this.flightAngle) * waveOffset;

    let nextX = this.x + vx;
    let nextY = this.y + vy;

    // Screen boundary bounce handling (16 <= X <= 224, 16 <= Y <= 144)
    if (nextX < 16) {
      nextX = 16;
      this.flightAngle = Math.PI - this.flightAngle;
    } else if (nextX > 224) {
      nextX = 224;
      this.flightAngle = Math.PI - this.flightAngle;
    }

    if (nextY < 16) {
      nextY = 16;
      this.flightAngle = -this.flightAngle;
    } else if (nextY > 144) {
      nextY = 144;
      this.flightAngle = -this.flightAngle;
    }

    this.x = nextX;
    this.y = nextY;

    // Set facing direction for sprite & contact calculations
    if (Math.abs(vx) >= Math.abs(vy)) {
      this.dir = vx >= 0 ? Direction.RIGHT : Direction.LEFT;
    } else {
      this.dir = vy >= 0 ? Direction.DOWN : Direction.UP;
    }

    // Countdown until next aerial swoop dive
    this.swoopCooldown--;
    if (this.swoopCooldown <= 0) {
      this.initiateSwoop(player, audio, particles);
    }
  }

  /**
   * Initiates an aerial swoop dive targeting Link's current position.
   */
  public initiateSwoop(
    player: PlayerState,
    audio?: KeeseAudio,
    particles?: ParticleSystem
  ): void {
    this.flightState = 'swoop';
    this.behaviorState = 'attack';
    this.totalSwoopDuration = 24;
    this.stateTimer = this.totalSwoopDuration;

    // Calculate direct normalized vector toward player
    const dx = player.x + 8 - (this.x + 8);
    const dy = player.y + 8 - (this.y + 8);
    const dist = Math.hypot(dx, dy) || 1;

    const swoopSpeed = 2.8;
    this.swoopVx = (dx / dist) * swoopSpeed;
    this.swoopVy = (dy / dist) * swoopSpeed;

    // Orient facing direction
    if (Math.abs(dx) >= Math.abs(dy)) {
      this.dir = dx >= 0 ? Direction.RIGHT : Direction.LEFT;
    } else {
      this.dir = dy >= 0 ? Direction.DOWN : Direction.UP;
    }

    // 8-bit visual warning telegraph
    this.alertTimer = 16;

    // Audio cue
    audio?.playKeeseSwoop?.();

    if (particles) {
      particles.emitEmberPuff(this.x + 8, this.y + 8);
    }
  }

  /**
   * Aerial swoop dive execution:
   * Rapidly glides toward the player, descending low to the ground before pulling up.
   */
  private updateSwoop(particles?: ParticleSystem): void {
    this.stateTimer--;

    // High frequency wing flapping during dive
    this.animTimer++;
    if (this.animTimer > 2) {
      this.animFrame = (this.animFrame + 1) % 2;
      this.animTimer = 0;
    }

    // Parabolic dive altitude (hoverAltitude -> dips down to ~1.5px near player -> pulls up)
    const progress = 1 - Math.max(0, this.stateTimer) / this.totalSwoopDuration;
    // Dives lowest at 50% of the swoop
    const dip = Math.sin(progress * Math.PI) * (this.hoverAltitude - 1.5);
    this.jumpYOffset = Math.max(1, this.hoverAltitude - dip);

    // Advance position
    let nextX = this.x + this.swoopVx;
    let nextY = this.y + this.swoopVy;

    // Boundary constraints
    if (nextX < 16 || nextX > 224) {
      this.swoopVx = -this.swoopVx * 0.5;
      nextX = Math.max(16, Math.min(224, nextX));
    }
    if (nextY < 16 || nextY > 144) {
      this.swoopVy = -this.swoopVy * 0.5;
      nextY = Math.max(16, Math.min(144, nextY));
    }

    this.x = nextX;
    this.y = nextY;

    // End of swoop dive
    if (this.stateTimer <= 0) {
      this.flightState = 'ascend';
      this.stateTimer = 14;
      this.behaviorState = 'patrol';

      if (particles) {
        particles.emitEmberPuff(this.x + 8, this.y + 8);
      }
    }
  }

  /**
   * Ascending phase:
   * Climbs back to cruising altitude after the swoop dive.
   */
  private updateAscend(): void {
    this.stateTimer--;

    // Climb altitude back up to hoverAltitude
    const progress = 1 - Math.max(0, this.stateTimer) / 14;
    this.jumpYOffset = 1.5 + progress * (this.hoverAltitude - 1.5);

    // Continue drifting forward smoothly
    this.x += this.swoopVx * 0.35;
    this.y += this.swoopVy * 0.35;

    // Keep in bounds
    this.x = Math.max(16, Math.min(224, this.x));
    this.y = Math.max(16, Math.min(144, this.y));

    if (this.stateTimer <= 0) {
      this.flightState = 'flutter';
      this.jumpYOffset = this.hoverAltitude;
      this.flightAngle = Math.random() * Math.PI * 2;
      this.swoopCooldown = 150 + Math.floor(Math.random() * 90); // ~2.5 - 4.0s
    }
  }

  /**
   * Hover phase:
   * Gentle slow hovering in place.
   */
  private updateHover(player: PlayerState, audio?: KeeseAudio): void {
    this.stateTimer--;
    this.wavePhase += 0.1;
    this.jumpYOffset = this.hoverAltitude + Math.sin(this.wavePhase) * 1.5;

    this.animTimer++;
    if (this.animTimer > 6) {
      this.animFrame = (this.animFrame + 1) % 2;
      this.animTimer = 0;
    }

    if (this.stateTimer <= 0) {
      this.flightState = 'flutter';
      this.swoopCooldown = 120 + Math.floor(Math.random() * 60);
    }
  }
}
