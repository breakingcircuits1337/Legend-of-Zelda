/**
 * The Legend of Zelda NES - Sword Beam Mechanic
 *
 * Implements Link's iconic full-health Sword Beam attack:
 * - Fires when Link attacks with a sword while at full health (`hearts >= maxHearts`).
 * - Launches an 8x8 flashing beam projectile in Link's facing direction
 *   (traveling horizontally across the screen when facing LEFT/RIGHT, or vertically
 *   when facing UP/DOWN) at 4.5 px/frame.
 * - Enforces the authentic 1-active-sword-beam-on-screen limit.
 * - Traverses water tiles unobstructed while dissipating into 4-way sparks on solid
 *   walls, screen edges, or enemy impacts.
 */

import { Direction, PlayerState, Projectile } from '../types';

export const SWORD_BEAM_SPEED = 4.5;
export const SWORD_BEAM_LIFETIME_FRAMES = 80; // Covers full 256px width (80 * 4.5 = 360px)

// Solid obstacle tiles that stop projectiles (excludes Water tile 3 so beams cross rivers & moats)
const PROJECTILE_SOLID_TILES = new Set([1, 2, 5, 12, 13, 14, 17, 18, 19]);

/**
 * Returns true when Link is at full health capacity (`hearts >= maxHearts`).
 */
export function isPlayerAtFullHealth(player: PlayerState): boolean {
  return player.maxHearts > 0 && player.hearts >= player.maxHearts - 0.0001;
}

/**
 * Returns true if Link possesses a sword and is permitted to fire a Sword Beam
 * (full health + no active player Sword Beam currently in flight).
 */
export function canFireSwordBeam(
  player: PlayerState,
  activeProjectiles: Projectile[]
): boolean {
  const hasSword = player.swordTier > 0 || player.inventory.hasSword;
  if (!hasSword) return false;
  if (!isPlayerAtFullHealth(player)) return false;

  const hasActiveBeam = activeProjectiles.some(
    (proj) => proj.active && proj.type === 'sword_beam' && proj.owner === 'player'
  );
  return !hasActiveBeam;
}

/**
 * Computes Sword Beam damage scaled by Link's current sword tier.
 * Wood Sword = 2, White Sword = 4, Magical Sword = 8.
 */
export function getSwordBeamDamage(swordTier: number): number {
  if (swordTier >= 3) return 8;
  if (swordTier === 2) return 4;
  return 2;
}

/**
 * Creates a Sword Beam projectile originating from the tip of Link's thrusting sword.
 */
export function createSwordBeamProjectile(player: PlayerState): Projectile {
  let vx = 0;
  let vy = 0;
  let spawnX = player.x + 4;
  let spawnY = player.y + 4;

  switch (player.dir) {
    case Direction.UP:
      vy = -SWORD_BEAM_SPEED;
      spawnY = player.y - 6;
      break;
    case Direction.DOWN:
      vy = SWORD_BEAM_SPEED;
      spawnY = player.y + 14;
      break;
    case Direction.LEFT:
      vx = -SWORD_BEAM_SPEED;
      spawnX = player.x - 6;
      break;
    case Direction.RIGHT:
      vx = SWORD_BEAM_SPEED;
      spawnX = player.x + 14;
      break;
  }

  const effectiveTier = Math.max(1, player.swordTier || (player.inventory.hasSword ? 1 : 0));

  return {
    id: `beam_${Date.now()}_${Math.random()}`,
    type: 'sword_beam',
    x: spawnX,
    y: spawnY,
    vx,
    vy,
    dir: player.dir,
    timer: SWORD_BEAM_LIFETIME_FRAMES,
    owner: 'player',
    active: true,
    damage: getSwordBeamDamage(effectiveTier),
    originX: spawnX,
    originY: spawnY,
  };
}

/**
 * Returns true if tile ID blocks aerial projectiles (solid walls/trees/rocks, NOT water).
 */
export function isProjectileSolidTile(tile: number): boolean {
  return PROJECTILE_SOLID_TILES.has(tile);
}
