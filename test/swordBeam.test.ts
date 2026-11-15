/**
 * Unit & GameEngine Integration Test Suite for Link's Full-Health Sword Beam Mechanic
 */

import {
  SWORD_BEAM_LIFETIME_FRAMES,
  SWORD_BEAM_SPEED,
  canFireSwordBeam,
  createSwordBeamProjectile,
  getSwordBeamDamage,
  isPlayerAtFullHealth,
  isProjectileSolidTile,
} from '../src/game/swordBeam';
import { OctorokEnemy } from '../src/game/octorokEnemy';
import { DarknutEnemy } from '../src/game/darknutEnemy';
import { Direction, EnemyType, GameState, ItemType, PlayerState, Projectile } from '../src/types';

// Provide lightweight browser globals for headless Node execution
const storageMap = new Map<string, string>();
if (typeof (globalThis as any).localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (k: string) => storageMap.get(k) ?? null,
    setItem: (k: string, v: string) => storageMap.set(k, v),
    removeItem: (k: string) => storageMap.delete(k),
    clear: () => storageMap.clear(),
  };
}
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = {
    setInterval: () => 0,
    clearInterval: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

function createMockPlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    x: 48,
    y: 80,
    dir: Direction.RIGHT,
    moving: false,
    isAttacking: false,
    attackTimer: 0,
    animFrame: 0,
    animTimer: 0,
    hearts: 6,
    maxHearts: 6,
    swordTier: 1,
    bItem: ItemType.NONE,
    inventory: {
      hasSword: true,
      hasBoomerang: false,
      hasBow: false,
      hasCandle: false,
      hasCompass: false,
      hasDungeonMap: false,
      rupees: 0,
      bombs: 4,
      keys: 0,
      triforcePieces: 0,
    },
    invincibleTimer: 0,
    knockback: null,
    isHoldingItem: false,
    heldItemType: null,
    heldItemTimer: 0,
    collectedHeartContainers: [],
    ...overrides,
  };
}

function createMockCanvas(): HTMLCanvasElement {
  const ctx = {
    imageSmoothingEnabled: false,
    save: () => {},
    restore: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    fillText: () => {},
    measureText: (t: string) => ({ width: t.length * 6 }),
    beginPath: () => {},
    arc: () => {},
    fill: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    setLineDash: () => {},
    clearRect: () => {},
    translate: () => {},
  };
  return {
    width: 256,
    height: 176,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

/**
 * Helper: build a clean 11x16 open floor grid with optional tile overrides.
 */
function createOpenTiles(overrides: Array<{ row: number; col: number; tile: number }> = []): number[][] {
  const tiles = Array.from({ length: 11 }, () => Array(16).fill(0));
  for (const ov of overrides) {
    if (tiles[ov.row] && tiles[ov.row][ov.col] !== undefined) {
      tiles[ov.row][ov.col] = ov.tile;
    }
  }
  return tiles;
}

async function runTests() {
  console.log('--- RUNNING SWORD BEAM MECHANIC TEST SUITE ---');

  // Test 1: Full-Health Check, Sword Ownership & 1-Active-Beam Rule
  console.log('\n[Test 1: Eligibility Rules & Tier Damage Scaling]');
  const fullPlayer = createMockPlayer({ hearts: 6, maxHearts: 6, swordTier: 1 });
  assert(isPlayerAtFullHealth(fullPlayer), 'Full health detected at 6/6 half-hearts');
  assert(
    !isPlayerAtFullHealth(createMockPlayer({ hearts: 5, maxHearts: 6 })),
    'Injured player (5/6) fails full health check'
  );
  assert(
    !isPlayerAtFullHealth(createMockPlayer({ hearts: 0, maxHearts: 0 })),
    'Zero maxHearts returns false'
  );
  assert(
    !canFireSwordBeam(
      createMockPlayer({
        swordTier: 0,
        inventory: { ...fullPlayer.inventory, hasSword: false },
      }),
      []
    ),
    'Cannot fire Sword Beam without a sword'
  );
  assert(canFireSwordBeam(fullPlayer, []), 'Can fire Sword Beam with sword and full health');

  const activeEnemyProj: Projectile = {
    id: 'rock_1',
    type: 'rock',
    x: 100,
    y: 80,
    vx: -2,
    vy: 0,
    dir: Direction.LEFT,
    timer: 50,
    owner: 'enemy',
    active: true,
    damage: 1,
  };
  assert(
    canFireSwordBeam(fullPlayer, [activeEnemyProj]),
    'Active enemy projectile does not block Link from firing a Sword Beam'
  );

  const activeBeam = createSwordBeamProjectile(fullPlayer);
  assert(
    !canFireSwordBeam(fullPlayer, [activeBeam]),
    '1-active-beam constraint prevents firing a second beam while one is in flight'
  );
  activeBeam.active = false;
  assert(
    canFireSwordBeam(fullPlayer, [activeBeam]),
    'Deactivated beam clears the screen slot so Link can fire again'
  );

  assert(getSwordBeamDamage(1) === 2, 'Wood Sword (tier 1) beam deals 2 damage');
  assert(getSwordBeamDamage(2) === 4, 'White Sword (tier 2) beam deals 4 damage');
  assert(getSwordBeamDamage(3) === 8, 'Magical Sword (tier 3) beam deals 8 damage');

  // Test 2: Projectile Directional Velocity, Spawn Geometry & Solid Tile Filtering
  console.log('\n[Test 2: Directional Vectors & Water Tile Passthrough]');
  const rightBeam = createSwordBeamProjectile(createMockPlayer({ x: 40, y: 80, dir: Direction.RIGHT }));
  assert(
    rightBeam.vx === SWORD_BEAM_SPEED && rightBeam.vy === 0 && rightBeam.x === 54,
    `RIGHT beam launches horizontally at +${SWORD_BEAM_SPEED} px/frame`
  );
  const leftBeam = createSwordBeamProjectile(createMockPlayer({ x: 180, y: 80, dir: Direction.LEFT }));
  assert(
    leftBeam.vx === -SWORD_BEAM_SPEED && leftBeam.vy === 0 && leftBeam.x === 174,
    `LEFT beam launches horizontally at -${SWORD_BEAM_SPEED} px/frame`
  );
  const upBeam = createSwordBeamProjectile(createMockPlayer({ x: 100, y: 100, dir: Direction.UP }));
  assert(
    upBeam.vx === 0 && upBeam.vy === -SWORD_BEAM_SPEED && upBeam.y === 94,
    `UP beam launches vertically at -${SWORD_BEAM_SPEED} px/frame`
  );
  const downBeam = createSwordBeamProjectile(createMockPlayer({ x: 100, y: 100, dir: Direction.DOWN }));
  assert(
    downBeam.vx === 0 && downBeam.vy === SWORD_BEAM_SPEED && downBeam.y === 114,
    `DOWN beam launches vertically at +${SWORD_BEAM_SPEED} px/frame`
  );
  assert(
    SWORD_BEAM_LIFETIME_FRAMES * SWORD_BEAM_SPEED >= 256,
    'Beam lifetime covers entire 256px screen width'
  );
  assert(!isProjectileSolidTile(0) && !isProjectileSolidTile(3), 'Floor (0) and Water (3) allow projectiles through');
  assert(isProjectileSolidTile(1) && isProjectileSolidTile(2) && isProjectileSolidTile(5), 'Trees (1), Rocks (2), and Walls (5) block projectiles');

  // Test 3: GameEngine Full-Health Firing via Attack Button & Horizontal Enemy Hit
  console.log('\n[Test 3: GameEngine Attack Input, Horizontal Travel & Damage]');
  const { GameEngine } = await import('../src/game/engine');
  const { getDefaultSaveSlots } = await import('../src/game/saveSystem');

  const engine = new GameEngine(createMockCanvas());
  engine.loadSaveSlot(getDefaultSaveSlots()[0]);
  engine.fade.active = false;
  engine.fade.opacity = 0;
  engine.fade.phase = 'none';
  engine.gameState = GameState.PLAYING;
  engine.currentScreen = {
    ...engine.currentScreen,
    id: 'TEST_OPEN',
    tiles: createOpenTiles(),
    enemies: [],
    secrets: [],
  };
  engine.enemies = [];
  engine.projectiles = [];
  engine.pickups = [];

  engine.player.swordTier = 1;
  engine.player.inventory.hasSword = true;
  engine.player.maxHearts = 6;
  engine.player.hearts = 6;
  engine.player.x = 24;
  engine.player.y = 80;
  engine.player.dir = Direction.RIGHT;
  engine.player.isAttacking = false;
  engine.player.attackTimer = 0;

  // Place a Red Octorok (2 health) far across the screen at x = 192, y = 80
  const farOctorok = new OctorokEnemy({
    id: 'octo_far',
    x: 192,
    y: 80,
    type: EnemyType.OCTOROK_RED,
    dir: Direction.LEFT,
  });
  farOctorok.health = 2;
  engine.enemies.push(farOctorok);
  engine.clockFreezeTimer = 100; // Keep target stationary in the horizontal lane while testing travel

  // Press A / Attack button, then release button on next frame
  engine.input.attack = true;
  (engine as any).updatePhysics();
  engine.input.attack = false;

  const activeBeamsAfterPress = engine.projectiles.filter((p) => p.type === 'sword_beam' && p.active);
  assert(activeBeamsAfterPress.length === 1, 'Attacking at full health spawned 1 active sword_beam');
  const firedBeam = activeBeamsAfterPress[0];
  assert(firedBeam.vx === SWORD_BEAM_SPEED && firedBeam.vy === 0, 'Spawned beam moves horizontally to the right');

  // Release attack button cleanly, ready Link again, and try attacking while first beam is mid-flight
  (engine as any).updatePhysics();
  engine.player.isAttacking = false;
  engine.player.attackTimer = 0;
  engine.input.attack = true;
  (engine as any).updatePhysics();
  engine.input.attack = false;
  (engine as any).updatePhysics();
  assert(
    engine.projectiles.filter((p) => p.type === 'sword_beam' && p.active).length === 1,
    'Second attack while beam is airborne maintains 1-active-beam cap'
  );

  // Advance frames until the beam crosses x=24 -> x=192 and hits farOctorok
  let hitFrame = -1;
  for (let f = 0; f < 60; f++) {
    (engine as any).updatePhysics();
    if (farOctorok.isHurt || farOctorok.isDead || farOctorok.health < 2) {
      hitFrame = f;
      break;
    }
  }
  assert(hitFrame >= 0, `Horizontal Sword Beam reached and struck far Octorok across screen (frame ${hitFrame})`);
  assert(farOctorok.health <= 0 || farOctorok.isDead, 'Wood Sword beam (2 dmg) defeated 2-HP Red Octorok');
  assert(!firedBeam.active, 'Sword Beam deactivated upon hitting target');

  // Test 4: Injured Suppression & Re-enable Upon Full Heal / Max Heart Upgrade
  console.log('\n[Test 4: Injured Suppression & Healing Re-Enable]');
  engine.projectiles = [];
  engine.enemies = [];
  engine.player.isAttacking = false;
  engine.player.attackTimer = 0;
  engine.player.hearts = 5; // 1 half-heart below max (6)

  engine.input.attack = true;
  (engine as any).updatePhysics();
  engine.input.attack = false;
  (engine as any).updatePhysics();
  assert(
    engine.projectiles.filter((p) => p.type === 'sword_beam').length === 0,
    'Injured Link (5/6) swings sword without firing a Sword Beam'
  );

  // Upgrade maxHearts to 8 and refill hearts to 8 -> fires again
  engine.player.maxHearts = 8;
  engine.player.hearts = 8;
  engine.player.swordTier = 2; // White Sword
  engine.player.isAttacking = false;
  engine.player.attackTimer = 0;
  engine.player.dir = Direction.LEFT;
  engine.player.x = 200;

  engine.input.attack = true;
  (engine as any).updatePhysics();
  engine.input.attack = false;
  const leftFired = engine.projectiles.find((p) => p.type === 'sword_beam' && p.active);
  assert(
    Boolean(leftFired && leftFired.vx === -SWORD_BEAM_SPEED && leftFired.damage === 4),
    'Restoring full health (8/8) with White Sword fires 4-damage beam horizontally LEFT'
  );
  (engine as any).updatePhysics();

  // Test 5: Crossing Water Tiles Unobstructed & Solid Wall Dissipation
  console.log('\n[Test 5: Water Passthrough & Solid Wall Dissipation]');
  engine.projectiles = [];
  engine.enemies = [];
  engine.currentScreen = {
    ...engine.currentScreen,
    tiles: createOpenTiles([
      // Vertical river across cols 5..7 on row 5 (y=80..95)
      { row: 5, col: 5, tile: 3 },
      { row: 5, col: 6, tile: 3 },
      { row: 5, col: 7, tile: 3 },
    ]),
  };
  engine.player.x = 32; // col 2
  engine.player.y = 80; // row 5
  engine.player.dir = Direction.RIGHT;
  engine.player.swordTier = 3; // Magical Sword (8 damage)
  engine.player.isAttacking = false;
  engine.player.attackTimer = 0;

  const acrossRiverEnemy = new OctorokEnemy({
    id: 'octo_river',
    x: 160,
    y: 80,
    type: EnemyType.OCTOROK_BLUE,
    dir: Direction.LEFT,
  });
  acrossRiverEnemy.health = 8;
  engine.enemies.push(acrossRiverEnemy);
  engine.clockFreezeTimer = 100;

  engine.input.attack = true;
  (engine as any).updatePhysics();
  engine.input.attack = false;

  let hitAcrossWater = false;
  for (let f = 0; f < 50; f++) {
    (engine as any).updatePhysics();
    if (acrossRiverEnemy.health <= 0 || acrossRiverEnemy.isDead) {
      hitAcrossWater = true;
      break;
    }
  }
  assert(hitAcrossWater, 'Sword Beam flew across Water tiles (tile 3) and dealt 8 damage (Magical Sword) on far bank');

  // Now verify solid rock (tile 2) stops the beam
  engine.projectiles = [];
  engine.enemies = [];
  engine.currentScreen = {
    ...engine.currentScreen,
    tiles: createOpenTiles([{ row: 5, col: 6, tile: 2 }]),
  };
  engine.player.x = 32;
  engine.player.y = 80;
  engine.player.dir = Direction.RIGHT;
  engine.player.isAttacking = false;
  engine.player.attackTimer = 0;

  const behindWallEnemy = new OctorokEnemy({
    id: 'octo_behind_wall',
    x: 160,
    y: 80,
    type: EnemyType.OCTOROK_RED,
    dir: Direction.LEFT,
  });
  behindWallEnemy.health = 4;
  engine.enemies.push(behindWallEnemy);
  engine.clockFreezeTimer = 100;

  engine.input.attack = true;
  (engine as any).updatePhysics();
  engine.input.attack = false;
  for (let f = 0; f < 50; f++) {
    (engine as any).updatePhysics();
  }
  assert(
    behindWallEnemy.health === 4 && engine.projectiles.filter((p) => p.type === 'sword_beam' && p.active).length === 0,
    'Solid Rock wall (tile 2) intercepts and dissipates Sword Beam before hitting enemy behind it'
  );

  // Test 6: Adjacent Melee Hit Does Not Swallow Newly Spawned Beam + Darknut Shield Behavior
  console.log('\n[Test 6: Same-Frame Melee Non-Swallowing & Darknut Shield Deflection]');
  engine.projectiles = [];
  engine.enemies = [];
  engine.currentScreen = {
    ...engine.currentScreen,
    tiles: createOpenTiles(),
  };
  engine.player.x = 32;
  engine.player.y = 80;
  engine.player.dir = Direction.RIGHT;
  engine.player.swordTier = 1; // 2 dmg
  engine.player.isAttacking = false;
  engine.player.attackTimer = 0;

  // Adjacent enemy overlaps Link's melee sword hitbox (x=48..64), enters isHurt=true on slash frame 0
  const adjacentEnemy = new OctorokEnemy({
    id: 'octo_adj',
    x: 52,
    y: 80,
    type: EnemyType.OCTOROK_BLUE,
    dir: Direction.LEFT,
  });
  adjacentEnemy.health = 6;
  // Distant enemy further along the same horizontal path
  const distantEnemy = new OctorokEnemy({
    id: 'octo_dist',
    x: 144,
    y: 80,
    type: EnemyType.OCTOROK_RED,
    dir: Direction.LEFT,
  });
  distantEnemy.health = 2;
  engine.enemies.push(adjacentEnemy, distantEnemy);
  engine.clockFreezeTimer = 100;

  engine.input.attack = true;
  (engine as any).updatePhysics();
  engine.input.attack = false;

  assert(adjacentEnemy.isHurt, 'Adjacent enemy was struck by Link melee slash on frame 0');
  assert(
    engine.projectiles.some((p) => p.type === 'sword_beam' && p.active),
    'Newly spawned Sword Beam was NOT swallowed by melee-hurt adjacent enemy on frame 0'
  );

  for (let f = 0; f < 40; f++) {
    (engine as any).updatePhysics();
  }
  assert(distantEnemy.health <= 0 || distantEnemy.isDead, 'Sword Beam continued across screen and defeated distant enemy');

  // Darknut frontal shield vs flank beam
  engine.projectiles = [];
  engine.enemies = [];
  engine.player.x = 32;
  engine.player.y = 80;
  engine.player.dir = Direction.RIGHT;
  engine.player.swordTier = 1;
  engine.player.isAttacking = false;
  engine.player.attackTimer = 0;

  // Darknut facing LEFT directly toward incoming RIGHT beam -> front shield deflects!
  const darknut = new DarknutEnemy({
    id: 'darknut_front',
    x: 128,
    y: 80,
    type: EnemyType.DARKNUT_RED,
    dir: Direction.LEFT,
  });
  const initialDarknutHp = darknut.health;
  engine.enemies.push(darknut);
  engine.clockFreezeTimer = 100;

  engine.input.attack = true;
  (engine as any).updatePhysics();
  engine.input.attack = false;
  for (let f = 0; f < 30; f++) {
    (engine as any).updatePhysics();
  }
  assert(
    darknut.health === initialDarknutHp && engine.projectiles.filter((p) => p.type === 'sword_beam' && p.active).length === 0,
    'Darknut frontal shield deflects incoming horizontal Sword Beam with zero damage'
  );

  // Rotate Darknut DOWN -> beam hits unshielded side and deals 2 damage
  darknut.dir = Direction.DOWN;
  engine.player.isAttacking = false;
  engine.player.attackTimer = 0;
  engine.input.attack = true;
  (engine as any).updatePhysics();
  engine.input.attack = false;
  for (let f = 0; f < 30; f++) {
    (engine as any).updatePhysics();
  }
  assert(
    darknut.health === initialDarknutHp - 2,
    'Sword Beam striking Darknut from the flank penetrates and deals full damage'
  );

  console.log('\n>>> ALL SWORD BEAM MECHANIC TESTS PASSED SUCCESSFULLY! <<<\n');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
