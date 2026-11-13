/**
 * The Legend of Zelda NES - Combat Particle Engine
 * Authentic 8-bit NES visual flair for sword strikes, enemy defeats,
 * shield deflections, and projectile impacts.
 */

import { Direction, EnemyType } from '../types';
import { NES_COLORS } from './sprites';

export type ParticleShape =
  | 'pixel'
  | 'spark_streak'
  | 'slash_crescent'
  | 'impact_star'
  | 'smoke_cloud'
  | 'shockwave_ring'
  | 'spirit_wisp'
  | 'bone_shard'
  | 'ink_drop'
  | 'heart_shard'
  | 'hero_shard';

export interface Particle {
  id: number;
  shape: ParticleShape;
  x: number;
  y: number;
  vx: number;
  vy: number;
  drag: number;
  gravity: number;
  life: number;
  maxLife: number;
  size: number;
  colors: string[];
  angle?: number;
  vAngle?: number;
  customData?: Record<string, number | string>;
}

let nextParticleId = 1;

export class ParticleSystem {
  public particles: Particle[] = [];
  private queuedEmitters: Array<{ delay: number; action: () => void }> = [];

  /**
   * Update all active particles and advance queued staggered emitters
   */
  public update() {
    // Process delayed emitters (e.g. boss multi-stage explosions)
    if (this.queuedEmitters.length > 0) {
      this.queuedEmitters.forEach((q) => q.delay--);
      const ready = this.queuedEmitters.filter((q) => q.delay <= 0);
      ready.forEach((q) => q.action());
      this.queuedEmitters = this.queuedEmitters.filter((q) => q.delay > 0);
    }

    // Update active particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life--;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      // Physics integration
      p.x += p.vx;
      p.y += p.vy;

      p.vx *= p.drag;
      p.vy *= p.drag;
      p.vy += p.gravity;

      if (p.vAngle && p.angle !== undefined) {
        p.angle += p.vAngle;
      }
    }
  }

  /**
   * Clear all particles (e.g. on screen transitions)
   */
  public clear() {
    this.particles = [];
    this.queuedEmitters = [];
  }

  /**
   * Active particle count for diagnostics
   */
  public get count(): number {
    return this.particles.length;
  }

  // ==========================================
  //  EMITTER METHODS
  // ==========================================

  /**
   * Emit high-impact visual flair for sword strikes
   * @param x Center contact X
   * @param y Center contact Y
   * @param dir Player facing direction
   * @param swordTier 1: Wood, 2: White, 3: Magical
   * @param isFullHealth Whether Link is shooting sword beams (adds extra critical sparks)
   */
  public emitSwordStrike(
    x: number,
    y: number,
    dir: Direction,
    swordTier: number = 1,
    isFullHealth: boolean = false
  ) {
    // 1. Blade Slash Crescent (Dynamic Arc Glint)
    this.particles.push({
      id: nextParticleId++,
      shape: 'slash_crescent',
      x,
      y,
      vx: 0,
      vy: 0,
      drag: 1,
      gravity: 0,
      life: 6,
      maxLife: 6,
      size: 14,
      colors:
        swordTier >= 2
          ? [NES_COLORS.WHITE, NES_COLORS.LIGHT_BLUE, NES_COLORS.GOLD]
          : [NES_COLORS.WHITE, NES_COLORS.GOLD, NES_COLORS.LIGHT_RED],
      angle: this.getSlashAngle(dir),
    });

    // 2. Center 4-Point Impact Star Glint
    this.particles.push({
      id: nextParticleId++,
      shape: 'impact_star',
      x,
      y,
      vx: 0,
      vy: 0,
      drag: 1,
      gravity: 0,
      life: 5,
      maxLife: 5,
      size: swordTier >= 3 ? 9 : 7,
      colors: [NES_COLORS.WHITE, NES_COLORS.GOLD],
    });

    // 3. Directional Sparks & Flying Pixel Shards
    const baseAngle = this.getOppositeAngle(dir);
    const sparkCount = swordTier === 3 ? 14 : swordTier === 2 ? 10 : 8;

    for (let i = 0; i < sparkCount; i++) {
      // Fan out sparks in a wide cone opposing/perpendicular to the strike
      const spread = (Math.random() - 0.5) * (Math.PI * 0.9);
      const angle = baseAngle + spread;
      const speed = 1.6 + Math.random() * 3.4;

      const colors =
        swordTier === 3
          ? [NES_COLORS.WHITE, NES_COLORS.LINK_LIGHT_GREEN, NES_COLORS.LIGHT_BLUE, NES_COLORS.GOLD]
          : swordTier === 2
          ? [NES_COLORS.WHITE, NES_COLORS.LIGHT_BLUE, NES_COLORS.GOLD, NES_COLORS.WHITE]
          : [NES_COLORS.WHITE, NES_COLORS.GOLD, NES_COLORS.LIGHT_RED, NES_COLORS.RED];

      this.particles.push({
        id: nextParticleId++,
        shape: Math.random() < 0.4 ? 'spark_streak' : 'pixel',
        x: x + (Math.random() - 0.5) * 4,
        y: y + (Math.random() - 0.5) * 4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        drag: 0.91,
        gravity: 0.05,
        life: 8 + Math.floor(Math.random() * 8),
        maxLife: 15,
        size: Math.random() < 0.35 ? 2 : 1,
        colors,
      });
    }

    // 4. Extra critical sparks if Link is at full health or has Magical Sword
    if (isFullHealth || swordTier >= 3) {
      for (let i = 0; i < 4; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2.2 + Math.random() * 2.2;
        this.particles.push({
          id: nextParticleId++,
          shape: 'pixel',
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          drag: 0.88,
          gravity: -0.02, // slight float
          life: 12,
          maxLife: 12,
          size: 2,
          colors: [NES_COLORS.WHITE, NES_COLORS.LIGHT_BLUE, NES_COLORS.LINK_LIGHT_GREEN],
        });
      }
    }
  }

  /**
   * Emit legendary NES enemy defeat sequence:
   * Expanding smoke clouds, shockwave ring, exploding fiery embers,
   * ethereal spirit wisps, and monster-specific debris!
   */
  public emitEnemyDefeat(
    x: number,
    y: number,
    enemyType: EnemyType,
    isBoss: boolean = false
  ) {
    // 1. Central Shockwave Ring
    this.particles.push({
      id: nextParticleId++,
      shape: 'shockwave_ring',
      x,
      y,
      vx: 0,
      vy: 0,
      drag: 1,
      gravity: 0,
      life: isBoss ? 16 : 10,
      maxLife: isBoss ? 16 : 10,
      size: isBoss ? 26 : 16,
      colors: [NES_COLORS.WHITE, NES_COLORS.GOLD, NES_COLORS.LIGHT_RED],
    });

    // 2. Primary NES Smoke/Poof Cloud Puffs
    // In original NES Zelda, 4 diagonal clouds puff outward from defeated enemies
    const directions = [
      { dx: -1, dy: -1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: 1 },
      { dx: 1, dy: 1 },
    ];

    if (isBoss) {
      // 8 directions for Aquamentus
      directions.push(
        { dx: 0, dy: -1.3 },
        { dx: 0, dy: 1.3 },
        { dx: -1.3, dy: 0 },
        { dx: 1.3, dy: 0 }
      );
    }

    directions.forEach((d) => {
      const speed = isBoss ? 1.4 : 1.1;
      this.particles.push({
        id: nextParticleId++,
        shape: 'smoke_cloud',
        x,
        y,
        vx: d.dx * speed,
        vy: d.dy * speed,
        drag: 0.95,
        gravity: 0,
        life: 16,
        maxLife: 16,
        size: isBoss ? 10 : 8,
        colors: [NES_COLORS.WHITE, NES_COLORS.GOLD, NES_COLORS.LIGHT_RED, NES_COLORS.GRAY],
      });
    });

    // 3. Exploding Fiery Embers & Sparks
    const emberCount = isBoss ? 28 : 14;
    for (let i = 0; i < emberCount; i++) {
      const angle = (Math.PI * 2 * i) / emberCount + (Math.random() - 0.5) * 0.4;
      const speed = 1.0 + Math.random() * (isBoss ? 4.2 : 2.6);
      this.particles.push({
        id: nextParticleId++,
        shape: Math.random() < 0.4 ? 'spark_streak' : 'pixel',
        x: x + (Math.random() - 0.5) * 4,
        y: y + (Math.random() - 0.5) * 4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        drag: 0.93,
        gravity: 0.07,
        life: 12 + Math.floor(Math.random() * 10),
        maxLife: 22,
        size: Math.random() < 0.5 ? 2 : 1,
        colors: [NES_COLORS.WHITE, NES_COLORS.GOLD, NES_COLORS.LIGHT_RED, NES_COLORS.RED],
      });
    }

    // 4. Ethereal Rising Spirit / Soul Wisps (Floating gently upward with sin wave wobble)
    const wispCount = isBoss ? 4 : 2;
    for (let i = 0; i < wispCount; i++) {
      this.particles.push({
        id: nextParticleId++,
        shape: 'spirit_wisp',
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 0.6,
        vy: -0.6 - Math.random() * 0.7,
        drag: 0.98,
        gravity: -0.015,
        life: 24 + Math.floor(Math.random() * 10),
        maxLife: 34,
        size: 2,
        colors: [NES_COLORS.WHITE, NES_COLORS.LIGHT_BLUE, NES_COLORS.LINK_LIGHT_GREEN],
        customData: {
          phase: Math.random() * Math.PI * 2,
        },
      });
    }

    // 5. Monster-Specific Themed Debris
    if (enemyType === EnemyType.STALFOS) {
      // 4 Flying Bone Fragments
      for (let i = 0; i < 4; i++) {
        const angle = (Math.PI / 2) * i + Math.random() * 0.3;
        const speed = 1.4 + Math.random() * 1.5;
        this.particles.push({
          id: nextParticleId++,
          shape: 'bone_shard',
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.5,
          drag: 0.94,
          gravity: 0.08,
          angle: Math.random() * Math.PI * 2,
          vAngle: 0.25 * (Math.random() < 0.5 ? 1 : -1),
          life: 18,
          maxLife: 18,
          size: 4,
          colors: [NES_COLORS.WHITE, NES_COLORS.GRAY],
        });
      }
    } else if (
      enemyType === EnemyType.OCTOROK_RED ||
      enemyType === EnemyType.OCTOROK_BLUE
    ) {
      // Ink Splatters
      const inkColor =
        enemyType === EnemyType.OCTOROK_BLUE ? NES_COLORS.LIGHT_BLUE : NES_COLORS.LIGHT_RED;
      for (let i = 0; i < 5; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.2 + Math.random() * 1.8;
        this.particles.push({
          id: nextParticleId++,
          shape: 'ink_drop',
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          drag: 0.92,
          gravity: 0.06,
          life: 14,
          maxLife: 14,
          size: 2,
          colors: [NES_COLORS.WHITE, inkColor, NES_COLORS.DARK_GRAY],
        });
      }
    } else if (
      enemyType === EnemyType.DARKNUT_RED ||
      enemyType === EnemyType.DARKNUT_BLUE
    ) {
      // 4 Flying Armor Shards & Metal Sparks
      const armorColor = enemyType === EnemyType.DARKNUT_RED ? NES_COLORS.RED : NES_COLORS.BLUE;
      for (let i = 0; i < 4; i++) {
        const angle = (Math.PI / 2) * i + Math.random() * 0.3;
        const speed = 1.3 + Math.random() * 1.5;
        this.particles.push({
          id: nextParticleId++,
          shape: 'bone_shard',
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.4,
          drag: 0.93,
          gravity: 0.08,
          angle: Math.random() * Math.PI * 2,
          vAngle: 0.2 * (Math.random() < 0.5 ? 1 : -1),
          life: 18,
          maxLife: 18,
          size: 4,
          colors: [NES_COLORS.WHITE, armorColor, NES_COLORS.GOLD],
        });
      }
    }

    // 6. Boss Secondary Explosions (Staggered multi-blast chain)
    if (isBoss) {
      const offsets = [
        { dx: -10, dy: -6, delay: 4 },
        { dx: 10, dy: 6, delay: 8 },
        { dx: -4, dy: 10, delay: 12 },
        { dx: 8, dy: -8, delay: 16 },
      ];

      offsets.forEach((off) => {
        this.queuedEmitters.push({
          delay: off.delay,
          action: () => {
            // Secondary burst
            this.particles.push({
              id: nextParticleId++,
              shape: 'shockwave_ring',
              x: x + off.dx,
              y: y + off.dy,
              vx: 0,
              vy: 0,
              drag: 1,
              gravity: 0,
              life: 10,
              maxLife: 10,
              size: 16,
              colors: [NES_COLORS.WHITE, NES_COLORS.GOLD],
            });

            for (let j = 0; j < 6; j++) {
              const a = Math.random() * Math.PI * 2;
              const sp = 1.5 + Math.random() * 2.2;
              this.particles.push({
                id: nextParticleId++,
                shape: 'pixel',
                x: x + off.dx,
                y: y + off.dy,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                drag: 0.92,
                gravity: 0.06,
                life: 12,
                maxLife: 12,
                size: 2,
                colors: [NES_COLORS.WHITE, NES_COLORS.GOLD, NES_COLORS.LIGHT_RED],
              });
            }
          },
        });
      });
    }
  }

  /**
   * Custom 8-bit Player Death Explosion:
   * Multi-ring shockwaves, 8-directional billowing smoke puffs,
   * shattered heart fragments, hero green/orange tunic & shield shards,
   * golden Triforce sparks, and ethereal ascending spirit wisps.
   */
  public emitPlayerDeath(x: number, y: number) {
    // 1. Dual Shockwave Rings (White-hot core and expanding golden ring)
    this.particles.push({
      id: nextParticleId++,
      shape: 'shockwave_ring',
      x,
      y,
      vx: 0,
      vy: 0,
      drag: 1,
      gravity: 0,
      life: 20,
      maxLife: 20,
      size: 32,
      colors: [NES_COLORS.WHITE, NES_COLORS.GOLD, NES_COLORS.RED],
    });

    this.particles.push({
      id: nextParticleId++,
      shape: 'shockwave_ring',
      x,
      y,
      vx: 0,
      vy: 0,
      drag: 1,
      gravity: 0,
      life: 28,
      maxLife: 28,
      size: 48,
      colors: [NES_COLORS.WHITE, NES_COLORS.LIGHT_BLUE, NES_COLORS.GRAY],
    });

    // 2. Central 4-point Impact Star
    this.particles.push({
      id: nextParticleId++,
      shape: 'impact_star',
      x,
      y,
      vx: 0,
      vy: 0,
      drag: 1,
      gravity: 0,
      life: 8,
      maxLife: 8,
      size: 14,
      colors: [NES_COLORS.WHITE, NES_COLORS.GOLD],
    });

    // 3. 8-Directional Billowing Smoke Clouds
    const smokeDirs = [
      { dx: 0, dy: -1.3 },
      { dx: 0, dy: 1.3 },
      { dx: -1.3, dy: 0 },
      { dx: 1.3, dy: 0 },
      { dx: -0.9, dy: -0.9 },
      { dx: 0.9, dy: -0.9 },
      { dx: -0.9, dy: 0.9 },
      { dx: 0.9, dy: 0.9 },
    ];

    smokeDirs.forEach((d) => {
      this.particles.push({
        id: nextParticleId++,
        shape: 'smoke_cloud',
        x,
        y,
        vx: d.dx,
        vy: d.dy,
        drag: 0.94,
        gravity: 0,
        life: 22,
        maxLife: 22,
        size: 9,
        colors: [NES_COLORS.WHITE, NES_COLORS.GOLD, NES_COLORS.LIGHT_RED, NES_COLORS.GRAY],
      });
    });

    // 4. Shattered Heart Fragments (Crimson shards scattering outward)
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8 + (Math.random() - 0.5) * 0.3;
      const speed = 1.4 + Math.random() * 2.2;
      this.particles.push({
        id: nextParticleId++,
        shape: 'heart_shard',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        drag: 0.94,
        gravity: 0.05,
        angle: Math.random() * Math.PI * 2,
        vAngle: (Math.random() - 0.5) * 0.3,
        life: 24 + Math.floor(Math.random() * 10),
        maxLife: 34,
        size: 3,
        colors: [NES_COLORS.RED, NES_COLORS.LIGHT_RED, NES_COLORS.DARK_RED],
      });
    }

    // 5. Hero Tunic & Shield Debris (Green, brown, orange, and white)
    const heroShards = [
      { color1: NES_COLORS.LINK_GREEN, color2: NES_COLORS.LINK_LIGHT_GREEN },
      { color1: NES_COLORS.SHIELD_ORANGE, color2: NES_COLORS.GOLD },
      { color1: NES_COLORS.LINK_BROWN, color2: NES_COLORS.LINK_SKIN },
      { color1: NES_COLORS.WHITE, color2: NES_COLORS.LIGHT_BLUE },
      { color1: NES_COLORS.LINK_GREEN, color2: NES_COLORS.WHITE },
      { color1: NES_COLORS.SHIELD_ORANGE, color2: NES_COLORS.RED },
      { color1: NES_COLORS.LINK_BROWN, color2: NES_COLORS.BLACK },
      { color1: NES_COLORS.GOLD, color2: NES_COLORS.WHITE },
    ];

    heroShards.forEach((shard, i) => {
      const angle = (Math.PI * 2 * i) / heroShards.length + (Math.random() - 0.5) * 0.4;
      const speed = 1.6 + Math.random() * 2.4;
      this.particles.push({
        id: nextParticleId++,
        shape: 'hero_shard',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        drag: 0.93,
        gravity: 0.07,
        angle: Math.random() * Math.PI * 2,
        vAngle: (Math.random() - 0.5) * 0.35,
        life: 26 + Math.floor(Math.random() * 10),
        maxLife: 36,
        size: 3,
        colors: [shard.color1, shard.color2, NES_COLORS.DARK_GRAY],
      });
    });

    // 6. High-velocity Golden/White Triforce Spark Streaks
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.0 + Math.random() * 4.2;
      this.particles.push({
        id: nextParticleId++,
        shape: Math.random() < 0.5 ? 'spark_streak' : 'pixel',
        x: x + (Math.random() - 0.5) * 4,
        y: y + (Math.random() - 0.5) * 4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        drag: 0.91,
        gravity: 0.04,
        life: 14 + Math.floor(Math.random() * 12),
        maxLife: 26,
        size: Math.random() < 0.5 ? 2 : 1,
        colors: [
          NES_COLORS.WHITE,
          NES_COLORS.GOLD,
          NES_COLORS.LINK_LIGHT_GREEN,
          NES_COLORS.LIGHT_BLUE,
        ],
      });
    }

    // 7. Ascending Ethereal Spirit Wisps (Hero's soul returning to the heavens)
    for (let i = 0; i < 5; i++) {
      this.particles.push({
        id: nextParticleId++,
        shape: 'spirit_wisp',
        x: x + (Math.random() - 0.5) * 12,
        y: y + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -0.7 - Math.random() * 0.9,
        drag: 0.98,
        gravity: -0.02,
        life: 42 + Math.floor(Math.random() * 16),
        maxLife: 58,
        size: 2,
        colors: [
          NES_COLORS.WHITE,
          NES_COLORS.LIGHT_BLUE,
          NES_COLORS.GOLD,
          NES_COLORS.LINK_LIGHT_GREEN,
        ],
        customData: {
          phase: Math.random() * Math.PI * 2,
        },
      });
    }

    // 8. Staggered secondary micro-bursts for prolonged 8-bit cinematic explosion
    [6, 12].forEach((delay, idx) => {
      this.queuedEmitters.push({
        delay,
        action: () => {
          for (let j = 0; j < 4; j++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 1.0 + Math.random() * 1.8;
            this.particles.push({
              id: nextParticleId++,
              shape: 'pixel',
              x: x + (Math.random() - 0.5) * 8,
              y: y + (Math.random() - 0.5) * 8,
              vx: Math.cos(a) * sp,
              vy: Math.sin(a) * sp,
              drag: 0.92,
              gravity: 0.04,
              life: 14,
              maxLife: 14,
              size: 2,
              colors:
                idx === 0
                  ? [NES_COLORS.WHITE, NES_COLORS.GOLD]
                  : [NES_COLORS.LIGHT_RED, NES_COLORS.DARK_GRAY],
            });
          }
        },
      });
    });
  }

  /**
   * Lingering death ember puff while enemy is dying
   */
  public emitEmberPuff(x: number, y: number) {
    this.particles.push({
      id: nextParticleId++,
      shape: 'smoke_cloud',
      x: x + (Math.random() - 0.5) * 6,
      y: y + (Math.random() - 0.5) * 6,
      vx: (Math.random() - 0.5) * 0.4,
      vy: -0.3 - Math.random() * 0.3,
      drag: 0.95,
      gravity: -0.01,
      life: 8,
      maxLife: 8,
      size: 4,
      colors: [NES_COLORS.WHITE, NES_COLORS.GOLD, NES_COLORS.GRAY],
    });
  }

  /**
   * 4-Way Beam Shards when Sword Beam hits a solid wall or enemy
   */
  public emitSwordBeamHit(x: number, y: number) {
    const diagDirs = [
      { dx: -1.8, dy: -1.8 },
      { dx: 1.8, dy: -1.8 },
      { dx: -1.8, dy: 1.8 },
      { dx: 1.8, dy: 1.8 },
    ];

    // Star flash
    this.particles.push({
      id: nextParticleId++,
      shape: 'impact_star',
      x,
      y,
      vx: 0,
      vy: 0,
      drag: 1,
      gravity: 0,
      life: 4,
      maxLife: 4,
      size: 6,
      colors: [NES_COLORS.WHITE, NES_COLORS.LIGHT_BLUE],
    });

    diagDirs.forEach((d) => {
      this.particles.push({
        id: nextParticleId++,
        shape: 'spark_streak',
        x,
        y,
        vx: d.dx,
        vy: d.dy,
        drag: 0.92,
        gravity: 0,
        life: 8,
        maxLife: 8,
        size: 2,
        colors: [NES_COLORS.WHITE, NES_COLORS.LIGHT_BLUE, NES_COLORS.GOLD],
      });
    });
  }

  /**
   * Metallic deflection sparks when Link's shield deflects incoming rocks/arrows
   */
  public emitShieldDeflect(x: number, y: number, projectileDir: Direction) {
    // Star glint
    this.particles.push({
      id: nextParticleId++,
      shape: 'impact_star',
      x,
      y,
      vx: 0,
      vy: 0,
      drag: 1,
      gravity: 0,
      life: 4,
      maxLife: 4,
      size: 7,
      colors: [NES_COLORS.WHITE, NES_COLORS.GOLD],
    });

    // Sparks spray backward away from shield
    const baseAngle = this.getDirectionAngle(projectileDir) + Math.PI; // bounce back
    for (let i = 0; i < 7; i++) {
      const angle = baseAngle + (Math.random() - 0.5) * 1.4;
      const speed = 1.6 + Math.random() * 2.8;
      this.particles.push({
        id: nextParticleId++,
        shape: 'pixel',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        drag: 0.9,
        gravity: 0.06,
        life: 10,
        maxLife: 10,
        size: Math.random() < 0.5 ? 2 : 1,
        colors: [NES_COLORS.WHITE, NES_COLORS.GOLD, NES_COLORS.SHIELD_ORANGE],
      });
    }
  }

  /**
   * Bomb explosion debris and fiery smoke
   */
  public emitBombBlast(x: number, y: number) {
    this.particles.push({
      id: nextParticleId++,
      shape: 'shockwave_ring',
      x,
      y,
      vx: 0,
      vy: 0,
      drag: 1,
      gravity: 0,
      life: 14,
      maxLife: 14,
      size: 24,
      colors: [NES_COLORS.WHITE, NES_COLORS.RED, NES_COLORS.GOLD],
    });

    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.2 + Math.random() * 3.4;
      this.particles.push({
        id: nextParticleId++,
        shape: Math.random() < 0.4 ? 'smoke_cloud' : 'pixel',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        drag: 0.93,
        gravity: 0.05,
        life: 12 + Math.floor(Math.random() * 8),
        maxLife: 20,
        size: 3,
        colors: [NES_COLORS.WHITE, NES_COLORS.GOLD, NES_COLORS.LIGHT_RED, NES_COLORS.GRAY],
      });
    }
  }

  /**
   * Classic 8-bit 'Poof' particle burst when loot (hearts, rupees, bombs) appears:
   * Billowing NES white/cyan smoke puffs radiating outward, central star glint,
   * shockwave ring, and rising golden sparkles!
   */
  public emitItemPoof(x: number, y: number) {
    // 1. Central pop shockwave ring
    this.particles.push({
      id: nextParticleId++,
      shape: 'shockwave_ring',
      x,
      y,
      vx: 0,
      vy: 0,
      drag: 1,
      gravity: 0,
      life: 8,
      maxLife: 8,
      size: 14,
      colors: [NES_COLORS.WHITE, NES_COLORS.LIGHT_BLUE, NES_COLORS.GOLD],
    });

    // 2. Central 4-point impact star glint
    this.particles.push({
      id: nextParticleId++,
      shape: 'impact_star',
      x,
      y,
      vx: 0,
      vy: 0,
      drag: 1,
      gravity: 0,
      life: 6,
      maxLife: 6,
      size: 8,
      colors: [NES_COLORS.WHITE, NES_COLORS.GOLD],
    });

    // 3. 4-directional billowing 'poof' smoke clouds
    const poofVectors = [
      { dx: -1.3, dy: -1.3 },
      { dx: 1.3, dy: -1.3 },
      { dx: -1.3, dy: 1.3 },
      { dx: 1.3, dy: 1.3 },
      { dx: 0, dy: -1.6 },
    ];

    poofVectors.forEach((d) => {
      this.particles.push({
        id: nextParticleId++,
        shape: 'smoke_cloud',
        x: x + d.dx * 2,
        y: y + d.dy * 2,
        vx: d.dx * 0.75,
        vy: d.dy * 0.75,
        drag: 0.88,
        gravity: -0.02,
        life: 14,
        maxLife: 14,
        size: 5,
        colors: [NES_COLORS.WHITE, NES_COLORS.LIGHT_BLUE, NES_COLORS.GRAY],
      });
    });

    // 4. Upward sparkling glints
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.8 + Math.random() * 1.5;
      this.particles.push({
        id: nextParticleId++,
        shape: Math.random() < 0.5 ? 'spark_streak' : 'pixel',
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.4,
        drag: 0.92,
        gravity: -0.04, // gentle float upward
        life: 16,
        maxLife: 16,
        size: 2,
        colors: [NES_COLORS.WHITE, NES_COLORS.GOLD, NES_COLORS.LIGHT_BLUE],
      });
    }
  }

  /**
   * Radiant sparkle burst for Fairy recovery and Potion revitalization
   */
  public emitSparkleBurst(x: number, y: number) {
    this.particles.push({
      id: nextParticleId++,
      shape: 'shockwave_ring',
      x,
      y,
      vx: 0,
      vy: 0,
      drag: 1,
      gravity: 0,
      life: 12,
      maxLife: 12,
      size: 16,
      colors: [NES_COLORS.GOLD, NES_COLORS.LIGHT_BLUE, NES_COLORS.WHITE],
    });

    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.2;
      const speed = 1.0 + Math.random() * 1.5;
      this.particles.push({
        id: nextParticleId++,
        shape: 'impact_star',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.5,
        drag: 0.94,
        gravity: -0.06,
        life: 18 + Math.floor(Math.random() * 8),
        maxLife: 26,
        size: 3,
        colors: [NES_COLORS.GOLD, NES_COLORS.WHITE, NES_COLORS.LIGHT_BLUE],
      });
    }
  }

  /**
   * Sword blade strikes a wall.
   * If normal wall: crisp high-speed deflection sparks.
   * If secret hollow wall: resonant celestial star glint & harmonic shimmer!
   */
  public emitSwordWallClink(x: number, y: number, isHollowSecret: boolean = false) {
    if (isHollowSecret) {
      // Impact star flash at the hollow wall contact point
      this.particles.push({
        id: nextParticleId++,
        shape: 'impact_star',
        x,
        y,
        vx: 0,
        vy: 0,
        drag: 1,
        gravity: 0,
        life: 10,
        maxLife: 10,
        size: 10,
        colors: [NES_COLORS.WHITE, NES_COLORS.GOLD, NES_COLORS.LIGHT_BLUE],
      });

      // Shimmering harmonic burst
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const speed = 1.4 + Math.random() * 1.6;
        this.particles.push({
          id: nextParticleId++,
          shape: 'spark_streak',
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          drag: 0.89,
          gravity: 0.02,
          life: 14,
          maxLife: 14,
          size: 2,
          colors: [NES_COLORS.WHITE, NES_COLORS.GOLD, NES_COLORS.LIGHT_BLUE],
        });
      }

      // Small puff of ancient masonry dust
      this.particles.push({
        id: nextParticleId++,
        shape: 'smoke_cloud',
        x,
        y,
        vx: 0,
        vy: -0.2,
        drag: 0.9,
        gravity: 0,
        life: 12,
        maxLife: 12,
        size: 4,
        colors: [NES_COLORS.WHITE, NES_COLORS.GRAY],
      });
    } else {
      // Regular solid wall spark deflection
      for (let i = 0; i < 5; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.2 + Math.random() * 2.2;
        this.particles.push({
          id: nextParticleId++,
          shape: 'pixel',
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          drag: 0.88,
          gravity: 0.08,
          life: 8,
          maxLife: 8,
          size: 1,
          colors: [NES_COLORS.WHITE, NES_COLORS.GOLD, NES_COLORS.SHIELD_ORANGE],
        });
      }
    }
  }

  /**
   * Secret wall crumbles open to reveal hidden stairs!
   * Emits expanding shockwave ring, flying rubble stone chunks, and smoke.
   */
  public emitWallCrumble(x: number, y: number) {
    // 1. Shockwave ring
    this.particles.push({
      id: nextParticleId++,
      shape: 'shockwave_ring',
      x,
      y,
      vx: 0,
      vy: 0,
      drag: 1,
      gravity: 0,
      life: 14,
      maxLife: 14,
      size: 20,
      colors: [NES_COLORS.WHITE, NES_COLORS.GOLD, NES_COLORS.OVERWORLD_ROCK_LIGHT],
    });

    // 2. Flying rubble stone particles
    for (let i = 0; i < 14; i++) {
      const angle = (Math.random() - 0.5) * Math.PI * 2;
      const speed = 1.0 + Math.random() * 2.8;
      this.particles.push({
        id: nextParticleId++,
        shape: 'pixel',
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 8,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.5,
        drag: 0.94,
        gravity: 0.1, // drops down like shattered stones
        life: 16 + Math.floor(Math.random() * 8),
        maxLife: 24,
        size: Math.random() < 0.4 ? 3 : 2,
        colors: [
          NES_COLORS.OVERWORLD_ROCK,
          NES_COLORS.OVERWORLD_ROCK_LIGHT,
          NES_COLORS.BLACK,
          NES_COLORS.WHITE,
        ],
      });
    }

    // 3. Billowing masonry smoke clouds
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 6;
      this.particles.push({
        id: nextParticleId++,
        shape: 'smoke_cloud',
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -0.3 - Math.random() * 0.6,
        drag: 0.9,
        gravity: -0.02,
        life: 18,
        maxLife: 18,
        size: 6,
        colors: [NES_COLORS.WHITE, NES_COLORS.GRAY, NES_COLORS.OVERWORLD_ROCK_LIGHT],
      });
    }
  }

  /**
   * Dedicated Visual Reveal Animation for discovering a subterranean staircase
   * under a bush or boulder:
   * - Dual expanding celestial shockwave rings (gold & white & cyan)
   * - 4 corner sparkle impact stars illuminating the staircase entrance
   * - Rising ancient subterranean light sparkles and ethereal wisps
   * - Source-specific thematic debris:
   *   - Bush: Swirling foliage green pixels, glowing amber fire embers, and smoke puffs
   *   - Boulder: Flying shattered stone rubble, dust puffs, and earthen fragments
   */
  public emitSecretStaircaseReveal(
    x: number,
    y: number,
    source: 'bush' | 'boulder' = 'boulder'
  ) {
    // 1. Dual Expanding Celestial Shockwave Rings
    this.particles.push({
      id: nextParticleId++,
      shape: 'shockwave_ring',
      x,
      y,
      vx: 0,
      vy: 0,
      drag: 1,
      gravity: 0,
      life: 18,
      maxLife: 18,
      size: 26,
      colors: [NES_COLORS.WHITE, NES_COLORS.GOLD, '#00e8d8'],
    });

    this.particles.push({
      id: nextParticleId++,
      shape: 'shockwave_ring',
      x,
      y,
      vx: 0,
      vy: 0,
      drag: 1,
      gravity: 0,
      life: 26,
      maxLife: 26,
      size: 38,
      colors: [NES_COLORS.GOLD, '#00e8d8', NES_COLORS.WHITE],
    });

    // 2. Central & 4-Corner Impact Star Glints around the 16x16 staircase frame
    const starOffsets = [
      { dx: 0, dy: 0, size: 10, delay: 0 },
      { dx: -6, dy: -6, size: 7, delay: 2 },
      { dx: 6, dy: -6, size: 7, delay: 4 },
      { dx: -6, dy: 6, size: 7, delay: 6 },
      { dx: 6, dy: 6, size: 7, delay: 8 },
    ];

    starOffsets.forEach((st) => {
      this.particles.push({
        id: nextParticleId++,
        shape: 'impact_star',
        x: x + st.dx,
        y: y + st.dy,
        vx: 0,
        vy: -0.2,
        drag: 0.98,
        gravity: -0.02,
        life: 14 + st.delay,
        maxLife: 14 + st.delay,
        size: st.size,
        colors: [NES_COLORS.WHITE, NES_COLORS.GOLD, '#58f898'],
      });
    });

    // 3. Rising Ethereal Subterranean Light Wisps (floating upward from the dark stairwell)
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6;
      this.particles.push({
        id: nextParticleId++,
        shape: 'spirit_wisp',
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 6,
        vx: Math.cos(angle) * 0.35,
        vy: -0.8 - Math.random() * 0.9,
        drag: 0.95,
        gravity: -0.04,
        life: 24 + Math.floor(Math.random() * 12),
        maxLife: 36,
        size: 3,
        colors: [NES_COLORS.WHITE, '#58f898', '#00e8d8', NES_COLORS.GOLD],
        customData: { phase: i * 1.2 },
      });
    }

    // 4. Source-Specific Thematic Debris:
    if (source === 'bush') {
      // Bush burned/destroyed: Swirling foliage green pixels, glowing amber fire embers, and smoke puffs
      for (let i = 0; i < 16; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.8 + Math.random() * 2.2;
        this.particles.push({
          id: nextParticleId++,
          shape: Math.random() < 0.3 ? 'smoke_cloud' : 'pixel',
          x: x + (Math.random() - 0.5) * 6,
          y: y + (Math.random() - 0.5) * 6,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.6,
          drag: 0.92,
          gravity: -0.03, // rising embers
          life: 18 + Math.floor(Math.random() * 10),
          maxLife: 28,
          size: Math.random() < 0.5 ? 2 : 3,
          colors: [
            NES_COLORS.OVERWORLD_GREEN,
            NES_COLORS.OVERWORLD_DARK_GREEN,
            NES_COLORS.GOLD,
            NES_COLORS.LIGHT_RED,
          ],
        });
      }
    } else {
      // Boulder/Rock pushed or bombed: Heavy flying stone rubble and dust clouds
      for (let i = 0; i < 16; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.0 + Math.random() * 2.6;
        this.particles.push({
          id: nextParticleId++,
          shape: Math.random() < 0.3 ? 'smoke_cloud' : 'pixel',
          x: x + (Math.random() - 0.5) * 8,
          y: y + (Math.random() - 0.5) * 8,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.4,
          drag: 0.93,
          gravity: 0.1, // tumbling stone chunks
          life: 18 + Math.floor(Math.random() * 12),
          maxLife: 30,
          size: Math.random() < 0.4 ? 3 : 2,
          colors: [
            NES_COLORS.OVERWORLD_ROCK,
            NES_COLORS.OVERWORLD_ROCK_LIGHT,
            NES_COLORS.GRAY,
            NES_COLORS.WHITE,
          ],
        });
      }
    }
  }

  // ==========================================
  //  RENDERING PIPELINE (PIXEL PERFECT)
  // ==========================================

  public render(ctx: CanvasRenderingContext2D) {
    if (this.particles.length === 0) return;

    ctx.save();
    // Maintain strict pixel integrity
    ctx.imageSmoothingEnabled = false;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const progress = 1 - p.life / p.maxLife; // 0 (birth) to 1 (death)
      const colorIndex = Math.min(
        p.colors.length - 1,
        Math.floor(progress * p.colors.length)
      );
      const color = p.colors[colorIndex] || NES_COLORS.WHITE;
      const rx = Math.round(p.x);
      const ry = Math.round(p.y);

      switch (p.shape) {
        case 'pixel':
          ctx.fillStyle = color;
          ctx.fillRect(rx, ry, p.size, p.size);
          break;

        case 'spark_streak': {
          ctx.fillStyle = color;
          // Render a 2px or 3px streak along velocity vector
          const len = 2;
          const sx = Math.round(p.vx > 0 ? 1 : p.vx < 0 ? -1 : 0);
          const sy = Math.round(p.vy > 0 ? 1 : p.vy < 0 ? -1 : 0);
          ctx.fillRect(rx, ry, p.size, p.size);
          ctx.fillStyle = p.colors[Math.min(colorIndex + 1, p.colors.length - 1)];
          ctx.fillRect(rx - sx * len, ry - sy * len, 1, 1);
          break;
        }

        case 'slash_crescent': {
          // Sharp pixelated slash arc
          ctx.save();
          ctx.translate(rx, ry);
          ctx.rotate(p.angle || 0);

          // Draw crescent arc using authentic pixel blocks
          const alphaStage = p.life > 3 ? 1 : 0.6;
          ctx.fillStyle = color;
          ctx.globalAlpha = alphaStage;

          // Arc geometry: stepped pixels curving like a sword swipe
          ctx.fillRect(-6, -7, 3, 2);
          ctx.fillRect(-3, -5, 3, 2);
          ctx.fillRect(0, -3, 3, 3);
          ctx.fillRect(3, 0, 3, 3);
          ctx.fillRect(0, 3, 3, 3);
          ctx.fillRect(-3, 5, 3, 2);
          ctx.fillRect(-6, 7, 3, 2);

          // Inner white highlight core
          ctx.fillStyle = NES_COLORS.WHITE;
          ctx.fillRect(-1, -2, 2, 4);

          ctx.restore();
          break;
        }

        case 'impact_star': {
          // 4-point impact star (+ shape)
          ctx.fillStyle = color;
          const s = Math.max(1, Math.round(p.size * (p.life / p.maxLife)));
          // Horizontal bar
          ctx.fillRect(rx - s, ry, s * 2 + 1, 1);
          // Vertical bar
          ctx.fillRect(rx, ry - s, 1, s * 2 + 1);
          // Center core
          ctx.fillStyle = NES_COLORS.WHITE;
          ctx.fillRect(rx, ry, 1, 1);
          break;
        }

        case 'smoke_cloud': {
          // NES Style Expanding Dust Puff
          // Transitions from compact core to expanding textured cloud
          const stage = Math.floor(progress * 3); // 0, 1, 2
          ctx.fillStyle = color;

          if (stage === 0) {
            // Stage 0: Compact 4x4 puff
            ctx.fillRect(rx - 2, ry - 2, 4, 4);
            ctx.fillRect(rx - 1, ry - 3, 2, 6);
            ctx.fillRect(rx - 3, ry - 1, 6, 2);
          } else if (stage === 1) {
            // Stage 1: Expanded 6x6 cloud with textured notches
            ctx.fillRect(rx - 3, ry - 2, 6, 4);
            ctx.fillRect(rx - 2, ry - 3, 4, 6);
            // Corner details
            ctx.fillRect(rx - 1, ry - 1, 2, 2);
          } else {
            // Stage 2: Dissipating hollow 8x8 smoke ring
            ctx.fillRect(rx - 3, ry - 4, 6, 1);
            ctx.fillRect(rx - 3, ry + 3, 6, 1);
            ctx.fillRect(rx - 4, ry - 3, 1, 6);
            ctx.fillRect(rx + 3, ry - 3, 1, 6);
          }
          break;
        }

        case 'shockwave_ring': {
          // Expanding diamond/square shockwave outline
          const currentRadius = Math.round(p.size * progress);
          if (currentRadius > 0) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            // Draw pixel diamond
            ctx.beginPath();
            ctx.moveTo(rx, ry - currentRadius);
            ctx.lineTo(rx + currentRadius, ry);
            ctx.lineTo(rx, ry + currentRadius);
            ctx.lineTo(rx - currentRadius, ry);
            ctx.closePath();
            ctx.stroke();
          }
          break;
        }

        case 'spirit_wisp': {
          // Sinusoidal swaying floating orb
          const phase = (p.customData?.phase as number) || 0;
          const wobble = Math.sin(p.life * 0.35 + phase) * 1.5;
          const wx = Math.round(p.x + wobble);
          ctx.fillStyle = color;
          ctx.fillRect(wx, ry, 2, 2);
          // Soft 1px tail below
          ctx.fillStyle = p.colors[p.colors.length - 1];
          ctx.fillRect(wx, ry + 2, 1, 1);
          break;
        }

        case 'bone_shard': {
          // Spinning bone particle
          ctx.save();
          ctx.translate(rx, ry);
          ctx.rotate(p.angle || 0);
          ctx.fillStyle = color;
          ctx.fillRect(-2, -1, 4, 2);
          ctx.fillRect(-3, -2, 2, 4);
          ctx.fillRect(1, -2, 2, 4);
          ctx.restore();
          break;
        }

        case 'ink_drop': {
          ctx.fillStyle = color;
          ctx.fillRect(rx, ry, p.size, p.size);
          // Sub-droplet
          ctx.fillRect(rx + 1, ry + 1, 1, 1);
          break;
        }

        case 'heart_shard': {
          // Shattered heart fragment with white highlight shine
          ctx.save();
          ctx.translate(rx, ry);
          ctx.rotate(p.angle || 0);
          ctx.fillStyle = color;
          ctx.fillRect(-2, -2, 4, 3);
          ctx.fillRect(-1, 1, 2, 2);
          ctx.fillStyle = NES_COLORS.WHITE;
          ctx.fillRect(-1, -1, 1, 1);
          ctx.restore();
          break;
        }

        case 'hero_shard': {
          // Multi-pixel hero tunic / equipment shard
          ctx.save();
          ctx.translate(rx, ry);
          ctx.rotate(p.angle || 0);
          ctx.fillStyle = color;
          ctx.fillRect(-2, -2, 3, 3);
          ctx.fillStyle = p.colors[Math.min(1, p.colors.length - 1)] || NES_COLORS.WHITE;
          ctx.fillRect(1, -1, 2, 2);
          ctx.restore();
          break;
        }
      }
    }

    ctx.restore();
  }

  // ==========================================
  //  HELPER MATH & TRIGONOMETRY
  // ==========================================

  private getSlashAngle(dir: Direction): number {
    switch (dir) {
      case Direction.RIGHT:
        return 0;
      case Direction.DOWN:
        return Math.PI * 0.5;
      case Direction.LEFT:
        return Math.PI;
      case Direction.UP:
        return -Math.PI * 0.5;
    }
  }

  private getDirectionAngle(dir: Direction): number {
    switch (dir) {
      case Direction.RIGHT:
        return 0;
      case Direction.DOWN:
        return Math.PI * 0.5;
      case Direction.LEFT:
        return Math.PI;
      case Direction.UP:
        return -Math.PI * 0.5;
    }
  }

  private getOppositeAngle(dir: Direction): number {
    return this.getDirectionAngle(dir) + Math.PI;
  }
}
