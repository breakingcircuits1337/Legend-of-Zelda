/**
 * The Legend of Zelda NES - Pixel Art Sprite Engine
 * Authentic 8-bit NES Palette & Procedural Pixel Renderers
 */

import { Direction, ItemType, EnemyType, EnemyBehaviorState } from '../types';

// Exact NES Color Palette Constants
export const NES_COLORS = {
  BLACK: '#000000',
  WHITE: '#FCFCFC',
  GRAY: '#7C7C7C',
  DARK_GRAY: '#202020',
  LINK_GREEN: '#00A800',
  LINK_LIGHT_GREEN: '#58F898',
  LINK_SKIN: '#FFA044',
  LINK_BROWN: '#C84C0C',
  SHIELD_ORANGE: '#E45C10',
  GOLD: '#F8B800',
  RED: '#D82800',
  LIGHT_RED: '#F85838',
  DARK_RED: '#880000',
  BLUE: '#0078F8',
  LIGHT_BLUE: '#3CBCFC',
  DARK_BLUE: '#002080',
  OVERWORLD_GROUND: '#E8D0A0',
  OVERWORLD_GREEN: '#00A800',
  OVERWORLD_DARK_GREEN: '#005800',
  OVERWORLD_ROCK: '#B87800',
  OVERWORLD_ROCK_LIGHT: '#F8B800',
  WATER_BLUE: '#0058F8',
  DUNGEON_WALL: '#008088',
  DUNGEON_WALL_LIGHT: '#00E8D8',
  DUNGEON_FLOOR: '#004044',
  DUNGEON_DOOR: '#006870',
};

// Offscreen sprite cache
const spriteCache: Record<string, HTMLCanvasElement> = {};

function getCachedCanvas(key: string, width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  if (spriteCache[key]) return spriteCache[key];
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  spriteCache[key] = c;
  return c;
}

/**
 * Draw 16x16 pixel matrix onto a canvas context
 */
function drawMatrix(
  ctx: CanvasRenderingContext2D,
  matrix: (string | null)[][],
  x: number,
  y: number,
  scale: number = 1
) {
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      const color = matrix[r][c];
      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(x + c * scale, y + r * scale, scale, scale);
      }
    }
  }
}

// --- LINK SPRITES ---

export interface LinkPalette {
  tunic?: string;
  skin?: string;
  hair?: string;
  shield?: string;
}

// Authentic NES flashing palettes for Link's spinning death animation
export const DEATH_PALETTES: LinkPalette[] = [
  // 0: Classic Link
  {
    tunic: NES_COLORS.LINK_GREEN,
    skin: NES_COLORS.LINK_SKIN,
    hair: NES_COLORS.LINK_BROWN,
    shield: NES_COLORS.SHIELD_ORANGE,
  },
  // 1: Critical damage crimson flash
  {
    tunic: NES_COLORS.RED,
    skin: NES_COLORS.WHITE,
    hair: NES_COLORS.DARK_RED,
    shield: NES_COLORS.LIGHT_RED,
  },
  // 2: Ethereal spirit / invincibility white flash
  {
    tunic: NES_COLORS.WHITE,
    skin: NES_COLORS.LIGHT_BLUE,
    hair: NES_COLORS.BLUE,
    shield: NES_COLORS.WHITE,
  },
  // 3: Fading phantom / shadow gray
  {
    tunic: NES_COLORS.DARK_GRAY,
    skin: NES_COLORS.GRAY,
    hair: NES_COLORS.BLACK,
    shield: NES_COLORS.GRAY,
  },
];

export function drawLink(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: Direction,
  frame: number,
  isAttacking: boolean,
  isInvincible: boolean,
  isHoldingItem: boolean,
  swordTier: number = 1,
  customPalette?: LinkPalette,
  hasMagicalShield: boolean = false,
  ringTier: number = 0,
  hasShield: boolean = true
) {
  if (!customPalette && isInvincible && Math.floor(Date.now() / 60) % 2 === 0) {
    // Flashing invincibility frames
    return;
  }

  let defaultTunic = NES_COLORS.LINK_GREEN;
  let defaultShield = hasMagicalShield ? NES_COLORS.BLUE : NES_COLORS.SHIELD_ORANGE;
  if (ringTier === 1) {
    // Authentic NES Blue Ring: White tunic with cyan/blue trim
    defaultTunic = NES_COLORS.WHITE;
    defaultShield = hasMagicalShield ? NES_COLORS.BLUE : NES_COLORS.LIGHT_BLUE;
  } else if (ringTier >= 2) {
    // Authentic NES Red Ring: Crimson red tunic
    defaultTunic = NES_COLORS.RED;
    defaultShield = hasMagicalShield ? NES_COLORS.GOLD : NES_COLORS.RED;
  }

  const G = customPalette?.tunic || defaultTunic;
  const S = customPalette?.skin || NES_COLORS.LINK_SKIN;
  const B = customPalette?.hair || NES_COLORS.LINK_BROWN;
  const O = customPalette?.shield || defaultShield;

  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));

  if (isHoldingItem) {
    // Holding item overhead (Victory or Cave Pickup)
    drawLinkHolding(ctx, G, S, B, O, hasMagicalShield, hasShield);
    ctx.restore();
    return;
  }

  if (isAttacking) {
    drawLinkAttack(ctx, dir, swordTier, G, S, B, O, hasMagicalShield, hasShield);
    ctx.restore();
    return;
  }

  // Normal walking animation (frame: 0 or 1)
  const f = frame % 2;

  switch (dir) {
    case Direction.DOWN:
      drawLinkDown(ctx, f, G, S, B, O, hasMagicalShield, hasShield);
      break;
    case Direction.UP:
      drawLinkUp(ctx, f, G, S, B, O, hasMagicalShield, hasShield);
      break;
    case Direction.LEFT:
      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-16, 0);
      drawLinkSide(ctx, f, G, S, B, O, hasMagicalShield, hasShield);
      ctx.restore();
      break;
    case Direction.RIGHT:
      drawLinkSide(ctx, f, G, S, B, O, hasMagicalShield, hasShield);
      break;
  }

  ctx.restore();
}

function drawLinkDown(ctx: CanvasRenderingContext2D, f: number, G: string, S: string, B: string, O: string, hasMagicalShield: boolean = false, hasShield: boolean = true) {
  // Hat & Hair
  ctx.fillStyle = G;
  ctx.fillRect(4, 0, 8, 4); // Hat
  ctx.fillRect(3, 2, 2, 4); // Left tip
  ctx.fillStyle = B;
  ctx.fillRect(4, 4, 8, 2); // Hair
  // Face
  ctx.fillStyle = S;
  ctx.fillRect(5, 5, 6, 4);
  // Eyes
  ctx.fillStyle = '#000';
  ctx.fillRect(6, 6, 1, 2);
  ctx.fillRect(9, 6, 1, 2);
  // Tunic Body
  ctx.fillStyle = G;
  ctx.fillRect(4, 9, 8, 4);
  // Shield (front left)
  if (hasShield) {
    if (hasMagicalShield) {
      // Large Magical Shield (White rim, blue center, red cross)
      ctx.fillStyle = NES_COLORS.WHITE;
      ctx.fillRect(2, 6, 5, 8);
      ctx.fillStyle = NES_COLORS.BLUE;
      ctx.fillRect(3, 7, 3, 6);
      ctx.fillStyle = NES_COLORS.RED;
      ctx.fillRect(4, 8, 1, 4);
      ctx.fillRect(3, 9, 3, 1);
    } else {
      ctx.fillStyle = O;
      ctx.fillRect(3, 7, 3, 5);
      ctx.fillStyle = '#000';
      ctx.fillRect(4, 8, 1, 3);
    }
  }
  // Belt
  ctx.fillStyle = B;
  ctx.fillRect(5, 11, 6, 1);
  // Legs & Boots (alternate with frame)
  ctx.fillStyle = B;
  if (f === 0) {
    ctx.fillRect(4, 13, 3, 3);
    ctx.fillRect(9, 13, 3, 2);
  } else {
    ctx.fillRect(4, 13, 3, 2);
    ctx.fillRect(9, 13, 3, 3);
  }
}

function drawLinkUp(ctx: CanvasRenderingContext2D, f: number, G: string, S: string, B: string, O: string, hasMagicalShield: boolean = false, hasShield: boolean = true) {
  // Hat
  ctx.fillStyle = G;
  ctx.fillRect(4, 0, 8, 6);
  ctx.fillRect(3, 2, 2, 4);
  // Hair back
  ctx.fillStyle = B;
  ctx.fillRect(4, 6, 8, 3);
  // Tunic
  ctx.fillStyle = G;
  ctx.fillRect(4, 9, 8, 4);
  // Shield on back
  if (hasShield) {
    if (hasMagicalShield) {
      ctx.fillStyle = NES_COLORS.WHITE;
      ctx.fillRect(5, 6, 6, 7);
      ctx.fillStyle = NES_COLORS.BLUE;
      ctx.fillRect(6, 7, 4, 5);
      ctx.fillStyle = NES_COLORS.RED;
      ctx.fillRect(7, 8, 2, 3);
    } else {
      ctx.fillStyle = O;
      ctx.fillRect(6, 7, 4, 5);
    }
  }
  // Belt
  ctx.fillStyle = B;
  ctx.fillRect(5, 11, 6, 1);
  // Boots
  ctx.fillStyle = B;
  if (f === 0) {
    ctx.fillRect(4, 13, 3, 3);
    ctx.fillRect(9, 13, 3, 2);
  } else {
    ctx.fillRect(4, 13, 3, 2);
    ctx.fillRect(9, 13, 3, 3);
  }
}

function drawLinkSide(ctx: CanvasRenderingContext2D, f: number, G: string, S: string, B: string, O: string, hasMagicalShield: boolean = false, hasShield: boolean = true) {
  // Hat
  ctx.fillStyle = G;
  ctx.fillRect(2, 0, 8, 4);
  ctx.fillRect(1, 2, 3, 3);
  // Hair & Face
  ctx.fillStyle = B;
  ctx.fillRect(3, 4, 4, 3);
  ctx.fillStyle = S;
  ctx.fillRect(7, 4, 4, 4);
  // Eye
  ctx.fillStyle = '#000';
  ctx.fillRect(9, 5, 1, 2);
  // Tunic
  ctx.fillStyle = G;
  ctx.fillRect(4, 8, 6, 5);
  // Shield in hand forward
  if (hasShield) {
    if (hasMagicalShield) {
      ctx.fillStyle = NES_COLORS.WHITE;
      ctx.fillRect(10, 6, 5, 8);
      ctx.fillStyle = NES_COLORS.BLUE;
      ctx.fillRect(11, 7, 3, 6);
      ctx.fillStyle = NES_COLORS.RED;
      ctx.fillRect(12, 8, 1, 4);
    } else {
      ctx.fillStyle = O;
      ctx.fillRect(11, 7, 3, 6);
      ctx.fillStyle = '#000';
      ctx.fillRect(12, 8, 1, 4);
    }
  }
  // Legs
  ctx.fillStyle = B;
  if (f === 0) {
    ctx.fillRect(4, 13, 3, 3);
    ctx.fillRect(8, 12, 3, 2);
  } else {
    ctx.fillRect(3, 12, 3, 2);
    ctx.fillRect(7, 13, 3, 3);
  }
}

function drawLinkAttack(
  ctx: CanvasRenderingContext2D,
  dir: Direction,
  swordTier: number = 1,
  G: string = NES_COLORS.LINK_GREEN,
  S: string = NES_COLORS.LINK_SKIN,
  B: string = NES_COLORS.LINK_BROWN,
  O: string = NES_COLORS.SHIELD_ORANGE,
  hasMagicalShield: boolean = false,
  hasShield: boolean = true
) {
  const { WHITE, LIGHT_BLUE, GOLD } = NES_COLORS;

  const bladeColor = swordTier >= 3 ? GOLD : WHITE;
  const edgeColor = swordTier === 2 ? LIGHT_BLUE : swordTier >= 3 ? NES_COLORS.RED : WHITE;
  const guardColor = swordTier >= 2 ? WHITE : B;

  switch (dir) {
    case Direction.DOWN:
      drawLinkDown(ctx, 0, G, S, B, O, hasMagicalShield, hasShield);
      // Sword thrust down
      ctx.fillStyle = bladeColor;
      ctx.fillRect(7, 13, 2, 9);
      if (swordTier >= 2) {
        ctx.fillStyle = edgeColor;
        ctx.fillRect(8, 14, 1, 7);
      }
      ctx.fillStyle = guardColor;
      ctx.fillRect(6, 13, 4, 1);
      break;
    case Direction.UP:
      drawLinkUp(ctx, 0, G, S, B, O, hasMagicalShield, hasShield);
      // Sword thrust up
      ctx.fillStyle = bladeColor;
      ctx.fillRect(7, -8, 2, 9);
      if (swordTier >= 2) {
        ctx.fillStyle = edgeColor;
        ctx.fillRect(8, -7, 1, 7);
      }
      ctx.fillStyle = guardColor;
      ctx.fillRect(6, 1, 4, 1);
      break;
    case Direction.LEFT:
      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-16, 0);
      drawLinkSide(ctx, 0, G, S, B, O, hasMagicalShield, hasShield);
      ctx.fillStyle = bladeColor;
      ctx.fillRect(14, 8, 9, 2);
      if (swordTier >= 2) {
        ctx.fillStyle = edgeColor;
        ctx.fillRect(15, 8, 7, 1);
      }
      ctx.fillStyle = guardColor;
      ctx.fillRect(13, 7, 1, 4);
      ctx.restore();
      break;
    case Direction.RIGHT:
      drawLinkSide(ctx, 0, G, S, B, O, hasMagicalShield, hasShield);
      ctx.fillStyle = bladeColor;
      ctx.fillRect(14, 8, 9, 2);
      if (swordTier >= 2) {
        ctx.fillStyle = edgeColor;
        ctx.fillRect(15, 8, 7, 1);
      }
      ctx.fillStyle = guardColor;
      ctx.fillRect(13, 7, 1, 4);
      break;
  }
}

function drawLinkHolding(
  ctx: CanvasRenderingContext2D,
  G: string = NES_COLORS.LINK_GREEN,
  S: string = NES_COLORS.LINK_SKIN,
  B: string = NES_COLORS.LINK_BROWN,
  O: string = NES_COLORS.SHIELD_ORANGE,
  hasMagicalShield: boolean = false,
  hasShield: boolean = true
) {
  // Link front face
  drawLinkDown(ctx, 0, G, S, B, O, hasMagicalShield, hasShield);
  // Arms raised overhead
  ctx.fillStyle = S;
  ctx.fillRect(2, 2, 2, 5);
  ctx.fillRect(12, 2, 2, 5);
}

// --- ENEMIES ---

export function drawEnemy(ctx: CanvasRenderingContext2D, enemy: {
  type: EnemyType;
  x: number;
  y: number;
  dir: Direction;
  animFrame: number;
  isHurt: boolean;
  isStunned: boolean;
  behaviorState?: EnemyBehaviorState;
  alertTimer?: number;
  jumpYOffset?: number;
}) {
  if (
    (enemy.isHurt && Math.floor(Date.now() / 50) % 2 === 0) ||
    ((enemy as any).isPhasing && Math.floor(Date.now() / 45) % 2 === 0)
  ) {
    return;
  }

  ctx.save();
  const vibrateOffsetX = (enemy as any).isVibrating
    ? Math.floor(Date.now() / 35) % 2 === 0
      ? -1
      : 1
    : 0;
  ctx.translate(Math.round(enemy.x) + vibrateOffsetX, Math.round(enemy.y));

  // Render ground shadow and vertical height elevation when enemy is jumping
  const jumpOffset = enemy.jumpYOffset || 0;
  if (jumpOffset > 0) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(4, 14, 8, 2);
    ctx.translate(0, -Math.round(jumpOffset));
  }

  switch (enemy.type) {
    case EnemyType.OCTOROK_RED:
    case EnemyType.OCTOROK_BLUE:
      drawOctorok(ctx, enemy.type === EnemyType.OCTOROK_RED ? NES_COLORS.RED : NES_COLORS.BLUE, enemy.dir, enemy.animFrame);
      break;
    case EnemyType.TEKTITE_RED:
      drawTektite(ctx, NES_COLORS.RED, enemy.animFrame);
      break;
    case EnemyType.MOBLIN_RED:
      drawMoblin(ctx, NES_COLORS.RED, enemy.dir, enemy.animFrame);
      break;
    case EnemyType.MOBLIN_BLUE:
      drawMoblin(ctx, NES_COLORS.BLUE, enemy.dir, enemy.animFrame);
      break;
    case EnemyType.GORIYA_RED:
      drawGoriya(ctx, NES_COLORS.RED, enemy.dir, enemy.animFrame, (enemy as any).customData?.hasBoomerangOut);
      break;
    case EnemyType.KEESE:
      drawKeese(ctx, enemy.animFrame);
      break;
    case EnemyType.STALFOS:
      drawStalfos(ctx, enemy.animFrame);
      break;
    case EnemyType.DARKNUT_RED:
    case EnemyType.DARKNUT_BLUE:
      drawDarknut(
        ctx,
        enemy.type === EnemyType.DARKNUT_RED ? NES_COLORS.RED : NES_COLORS.BLUE,
        enemy.type === EnemyType.DARKNUT_RED ? NES_COLORS.GOLD : NES_COLORS.WHITE,
        enemy.dir,
        enemy.animFrame
      );
      break;
    case EnemyType.AQUAMENTUS:
      drawAquamentus(ctx, enemy.animFrame);
      break;
    case EnemyType.DODONGO:
      drawDodongo(ctx, enemy.dir, enemy.animFrame, (enemy as any).isSwollen, (enemy as any).smokeTimer);
      break;
    case EnemyType.LEEVER_RED:
      drawLeever(
        ctx,
        enemy.animFrame,
        Boolean((enemy as any).isBurrowing ?? (enemy as any).customData?.isBurrowing)
      );
      break;
    case EnemyType.PEAHAT:
      drawPeahat(
        ctx,
        enemy.animFrame,
        Boolean((enemy as any).isFlying ?? (enemy as any).customData?.isFlying)
      );
      break;
    case EnemyType.ARMOS:
      drawArmos(ctx, enemy.animFrame, enemy.dir);
      break;
    case EnemyType.ROPE:
      drawRope(ctx, enemy.dir, enemy.animFrame);
      break;
    case EnemyType.ZOL:
      drawZol(ctx, enemy.animFrame);
      break;
    case EnemyType.GEL:
      drawGel(ctx, enemy.animFrame);
      break;
    case EnemyType.BLADE_TRAP:
      drawBladeTrap(ctx);
      break;
    case EnemyType.LIKE_LIKE:
      drawLikeLike(ctx, enemy.animFrame);
      break;
    case EnemyType.WIZZROBE_RED:
      drawWizzrobe(ctx, enemy.animFrame, enemy.dir);
      break;
    case EnemyType.GHINI:
      drawGhini(
        ctx,
        enemy.animFrame,
        enemy.dir,
        Boolean((enemy as any).isAwakened ?? (enemy as any).customData?.isAwakened)
      );
      break;
    case EnemyType.MANHANDLA:
      drawManhandla(ctx, enemy.animFrame, (enemy as any).customData?.jaws);
      break;
  }

  // --- Visual AI State Indicators ---
  // Alert '!' bubble when enemy spots player and prepares attack or enters 'chase'
  if (enemy.alertTimer && enemy.alertTimer > 0) {
    ctx.fillStyle = NES_COLORS.WHITE;
    ctx.fillRect(6, -9, 4, 8);
    ctx.fillStyle = NES_COLORS.RED;
    ctx.fillRect(7, -8, 2, 4);
    ctx.fillRect(7, -3, 2, 2);
  } else if (enemy.behaviorState === 'windup') {
    // 8-bit attack telegraph warning flash
    ctx.fillStyle = NES_COLORS.GOLD;
    ctx.fillRect(6, -8, 4, 2);
    ctx.fillRect(7, -10, 2, 6);
    ctx.fillStyle = NES_COLORS.WHITE;
    ctx.fillRect(7, -8, 2, 2);
  } else if (enemy.behaviorState === 'attack') {
    // 8-bit high-speed lunge motion lines behind enemy
    ctx.fillStyle = NES_COLORS.WHITE;
    if (enemy.dir === Direction.RIGHT) {
      ctx.fillRect(-4, 4, 3, 1);
      ctx.fillRect(-6, 8, 4, 1);
      ctx.fillRect(-3, 12, 2, 1);
    } else if (enemy.dir === Direction.LEFT) {
      ctx.fillRect(17, 4, 3, 1);
      ctx.fillRect(18, 8, 4, 1);
      ctx.fillRect(17, 12, 2, 1);
    } else if (enemy.dir === Direction.DOWN) {
      ctx.fillRect(4, -4, 1, 3);
      ctx.fillRect(8, -6, 1, 4);
      ctx.fillRect(12, -3, 1, 2);
    } else if (enemy.dir === Direction.UP) {
      ctx.fillRect(4, 17, 1, 3);
      ctx.fillRect(8, 18, 1, 4);
      ctx.fillRect(12, 17, 1, 2);
    }
  } else if (enemy.behaviorState === 'flee') {
    // Panic sweat drop when fleeing
    ctx.fillStyle = NES_COLORS.LIGHT_BLUE;
    ctx.fillRect(13, -7, 2, 2);
    ctx.fillRect(14, -5, 2, 3);
    ctx.fillStyle = NES_COLORS.WHITE;
    ctx.fillRect(13, -6, 1, 1);
  }

  ctx.restore();
}

function drawOctorok(ctx: CanvasRenderingContext2D, color: string, dir: Direction, f: number) {
  // Main body
  ctx.fillStyle = color;
  ctx.fillRect(3, 3, 10, 8);
  ctx.fillRect(4, 2, 8, 10);
  // Snout (Shooting mouth)
  ctx.fillStyle = NES_COLORS.WHITE;
  if (dir === Direction.DOWN) ctx.fillRect(6, 9, 4, 3);
  else if (dir === Direction.UP) ctx.fillRect(6, 1, 4, 3);
  else if (dir === Direction.LEFT) ctx.fillRect(1, 6, 3, 4);
  else if (dir === Direction.RIGHT) ctx.fillRect(12, 6, 3, 4);

  // Eyes
  ctx.fillStyle = '#000';
  ctx.fillRect(5, 4, 2, 2);
  ctx.fillRect(9, 4, 2, 2);

  // Tentacles/Legs
  ctx.fillStyle = color;
  if (f % 2 === 0) {
    ctx.fillRect(2, 12, 2, 3);
    ctx.fillRect(5, 12, 2, 3);
    ctx.fillRect(9, 12, 2, 3);
    ctx.fillRect(12, 12, 2, 3);
  } else {
    ctx.fillRect(3, 12, 3, 3);
    ctx.fillRect(10, 12, 3, 3);
  }
}

function drawTektite(ctx: CanvasRenderingContext2D, color: string, f: number) {
  ctx.fillStyle = color;
  // Eye in center
  ctx.fillRect(4, 4, 8, 6);
  ctx.fillStyle = NES_COLORS.BLUE;
  ctx.fillRect(7, 5, 2, 3);
  ctx.fillStyle = '#000';
  ctx.fillRect(7, 6, 2, 1);

  // 4 spindly legs
  ctx.fillStyle = color;
  if (f % 2 === 0) {
    // Crouched
    ctx.fillRect(1, 8, 3, 2);
    ctx.fillRect(12, 8, 3, 2);
    ctx.fillRect(0, 10, 2, 5);
    ctx.fillRect(14, 10, 2, 5);
  } else {
    // Leaping
    ctx.fillRect(2, 2, 2, 6);
    ctx.fillRect(12, 2, 2, 6);
    ctx.fillRect(1, 8, 2, 7);
    ctx.fillRect(13, 8, 2, 7);
  }
}

function drawMoblin(ctx: CanvasRenderingContext2D, color: string, dir: Direction, f: number) {
  // Bulldog / pig-faced goblin with directional spear & ears
  ctx.fillStyle = color;
  // Ears
  ctx.fillRect(2, 1, 3, 3);
  ctx.fillRect(11, 1, 3, 3);
  // Head / Cowl
  ctx.fillRect(3, 2, 10, 8);
  // Body
  ctx.fillRect(4, 9, 8, 5);

  if (dir === Direction.UP) {
    // Back view (no eyes/snout, spear held vertically on right pointing up)
    ctx.fillStyle = NES_COLORS.LINK_BROWN;
    ctx.fillRect(12, 2, 2, 12); // Spear shaft
    ctx.fillStyle = NES_COLORS.WHITE;
    ctx.fillRect(11, 0, 4, 3); // Spearhead pointing up
  } else if (dir === Direction.DOWN) {
    // Front view (eyes, snout, nostrils, spear pointing down)
    ctx.fillStyle = NES_COLORS.LINK_SKIN;
    ctx.fillRect(5, 6, 6, 4); // Snout
    ctx.fillStyle = NES_COLORS.BLACK;
    ctx.fillRect(5, 4, 2, 2); // Eyes
    ctx.fillRect(9, 4, 2, 2);
    ctx.fillRect(6, 8, 1, 1); // Nostrils
    ctx.fillRect(9, 8, 1, 1);
    // Spear pointing down
    ctx.fillStyle = NES_COLORS.LINK_BROWN;
    ctx.fillRect(12, 1, 2, 12);
    ctx.fillStyle = NES_COLORS.WHITE;
    ctx.fillRect(11, 12, 4, 3);
  } else if (dir === Direction.LEFT) {
    // Left profile (snout facing left, spear extended forward to the left)
    ctx.fillStyle = NES_COLORS.LINK_SKIN;
    ctx.fillRect(1, 5, 5, 4);
    ctx.fillStyle = NES_COLORS.BLACK;
    ctx.fillRect(4, 4, 2, 2); // Single profile eye
    // Spear thrusting left
    ctx.fillStyle = NES_COLORS.LINK_BROWN;
    ctx.fillRect(2, 7, 10, 2);
    ctx.fillStyle = NES_COLORS.WHITE;
    ctx.fillRect(0, 6, 3, 4);
  } else {
    // Right profile (snout facing right, spear extended forward to the right)
    ctx.fillStyle = NES_COLORS.LINK_SKIN;
    ctx.fillRect(10, 5, 5, 4);
    ctx.fillStyle = NES_COLORS.BLACK;
    ctx.fillRect(10, 4, 2, 2); // Single profile eye
    // Spear thrusting right
    ctx.fillStyle = NES_COLORS.LINK_BROWN;
    ctx.fillRect(4, 7, 10, 2);
    ctx.fillStyle = NES_COLORS.WHITE;
    ctx.fillRect(13, 6, 3, 4);
  }

  // Walking feet animation
  ctx.fillStyle = NES_COLORS.BLACK;
  if (f % 2 === 0) {
    ctx.fillRect(4, 14, 3, 2);
    ctx.fillRect(9, 13, 3, 2);
  } else {
    ctx.fillRect(4, 13, 3, 2);
    ctx.fillRect(9, 14, 3, 2);
  }
}

function drawGoriya(
  ctx: CanvasRenderingContext2D,
  color: string,
  dir: Direction,
  f: number,
  hasBoomerangOut: boolean = false
) {
  ctx.fillStyle = color;
  // Head
  ctx.fillRect(4, 2, 8, 7);
  // Horns
  ctx.fillRect(3, 0, 2, 3);
  ctx.fillRect(11, 0, 2, 3);

  // Eyes based on facing direction
  if (dir !== Direction.UP) {
    ctx.fillStyle = NES_COLORS.WHITE;
    if (dir === Direction.LEFT) {
      ctx.fillRect(4, 4, 2, 2);
      ctx.fillRect(8, 4, 2, 2);
    } else if (dir === Direction.RIGHT) {
      ctx.fillRect(6, 4, 2, 2);
      ctx.fillRect(10, 4, 2, 2);
    } else {
      ctx.fillRect(5, 4, 2, 2);
      ctx.fillRect(9, 4, 2, 2);
    }
  }

  // Tunic
  ctx.fillStyle = color;
  ctx.fillRect(3, 9, 10, 5);

  // Walking feet animation
  ctx.fillStyle = NES_COLORS.BLACK;
  if (f % 2 === 0) {
    ctx.fillRect(4, 14, 3, 2);
    ctx.fillRect(9, 13, 3, 2);
  } else {
    ctx.fillRect(4, 13, 3, 2);
    ctx.fillRect(9, 14, 3, 2);
  }

  // Boomerang in hand (only drawn when not currently in flight!)
  if (!hasBoomerangOut) {
    ctx.fillStyle = NES_COLORS.GOLD;
    if (dir === Direction.LEFT) {
      ctx.fillRect(0, 6, 4, 2);
      ctx.fillRect(0, 8, 2, 4);
    } else {
      ctx.fillRect(12, 6, 4, 2);
      ctx.fillRect(14, 8, 2, 4);
    }
  }
}

function drawKeese(ctx: CanvasRenderingContext2D, f: number) {
  ctx.fillStyle = NES_COLORS.BLUE;
  // Bat body
  ctx.fillRect(6, 6, 4, 5);
  ctx.fillStyle = NES_COLORS.RED;
  ctx.fillRect(7, 7, 2, 2); // Red eyes

  // Wings
  ctx.fillStyle = NES_COLORS.BLUE;
  if (f % 2 === 0) {
    // Wings up
    ctx.fillRect(1, 2, 5, 3);
    ctx.fillRect(10, 2, 5, 3);
    ctx.fillRect(0, 4, 3, 4);
    ctx.fillRect(13, 4, 3, 4);
  } else {
    // Wings down
    ctx.fillRect(1, 7, 5, 4);
    ctx.fillRect(10, 7, 5, 4);
    ctx.fillRect(0, 10, 3, 3);
    ctx.fillRect(13, 10, 3, 3);
  }
}

function drawStalfos(ctx: CanvasRenderingContext2D, f: number) {
  // Skeleton
  ctx.fillStyle = NES_COLORS.WHITE;
  // Skull
  ctx.fillRect(5, 1, 6, 6);
  ctx.fillStyle = '#000';
  ctx.fillRect(6, 3, 2, 2);
  ctx.fillRect(9, 3, 2, 2);
  // Ribs & Spine
  ctx.fillStyle = NES_COLORS.WHITE;
  ctx.fillRect(7, 7, 2, 5);
  ctx.fillRect(4, 8, 8, 1);
  ctx.fillRect(5, 10, 6, 1);
  // Two swords held!
  ctx.fillStyle = NES_COLORS.LINK_LIGHT_GREEN;
  ctx.fillRect(2, 6, 2, 7);
  ctx.fillRect(12, 6, 2, 7);
  // Legs
  ctx.fillStyle = NES_COLORS.WHITE;
  if (f % 2 === 0) {
    ctx.fillRect(5, 12, 2, 4);
    ctx.fillRect(9, 12, 2, 3);
  } else {
    ctx.fillRect(5, 12, 2, 3);
    ctx.fillRect(9, 12, 2, 4);
  }
}

/**
 * Darknut: Heavily armored knight with sword and frontal shield
 * Red Darknut: Red armor + gold trim
 * Blue Darknut: Deep blue armor + white/silver trim
 */
function drawDarknut(
  ctx: CanvasRenderingContext2D,
  color: string,
  trimColor: string,
  dir: Direction,
  f: number
) {
  // Helmet crest
  ctx.fillStyle = trimColor;
  ctx.fillRect(6, 1, 4, 3);

  // Helmet visor
  ctx.fillStyle = color;
  ctx.fillRect(4, 3, 8, 4);
  ctx.fillStyle = '#000';
  ctx.fillRect(5, 5, 6, 1); // Dark visor slit

  // Armored Torso
  ctx.fillStyle = color;
  ctx.fillRect(4, 7, 8, 5);
  ctx.fillStyle = NES_COLORS.BLACK;
  ctx.fillRect(4, 11, 8, 1); // Belt

  // Shield & Sword positioned by direction
  if (dir === Direction.DOWN) {
    // Frontal shield facing south
    ctx.fillStyle = trimColor;
    ctx.fillRect(3, 7, 5, 7);
    ctx.fillStyle = color;
    ctx.fillRect(4, 8, 3, 5);
    // Sword pointing down on right side
    ctx.fillStyle = NES_COLORS.WHITE;
    ctx.fillRect(12, 8, 2, 6);
    ctx.fillStyle = trimColor;
    ctx.fillRect(11, 7, 4, 2); // Crossguard
  } else if (dir === Direction.UP) {
    // Back view (armor cape / shoulder plates)
    ctx.fillStyle = color;
    ctx.fillRect(3, 7, 10, 5);
    // Sword raised on right
    ctx.fillStyle = NES_COLORS.WHITE;
    ctx.fillRect(12, 2, 2, 7);
    // Shield side rim on left
    ctx.fillStyle = trimColor;
    ctx.fillRect(2, 6, 2, 6);
  } else if (dir === Direction.LEFT) {
    // Shield held on left side facing forward
    ctx.fillStyle = trimColor;
    ctx.fillRect(1, 6, 4, 8);
    ctx.fillStyle = color;
    ctx.fillRect(2, 7, 2, 6);
    // Sword drawn towards right
    ctx.fillStyle = NES_COLORS.WHITE;
    ctx.fillRect(12, 8, 3, 2);
  } else if (dir === Direction.RIGHT) {
    // Shield held on right side facing forward
    ctx.fillStyle = trimColor;
    ctx.fillRect(11, 6, 4, 8);
    ctx.fillStyle = color;
    ctx.fillRect(12, 7, 2, 6);
    // Sword drawn towards left
    ctx.fillStyle = NES_COLORS.WHITE;
    ctx.fillRect(1, 8, 3, 2);
  }

  // Armored boots
  ctx.fillStyle = trimColor;
  if (f % 2 === 0) {
    ctx.fillRect(4, 12, 3, 4);
    ctx.fillRect(9, 13, 3, 3);
  } else {
    ctx.fillRect(4, 13, 3, 3);
    ctx.fillRect(9, 12, 3, 4);
  }
}

function drawAquamentus(ctx: CanvasRenderingContext2D, f: number) {
  // 32x32 Boss Dragon
  const G = NES_COLORS.LINK_GREEN;
  const W = NES_COLORS.WHITE;
  const R = NES_COLORS.RED;

  // Head & Horn
  ctx.fillStyle = W;
  ctx.fillRect(2, 2, 4, 4); // Horn
  ctx.fillRect(4, 5, 3, 3);
  ctx.fillStyle = G;
  ctx.fillRect(6, 6, 14, 10);
  // Eye
  ctx.fillStyle = R;
  ctx.fillRect(8, 8, 3, 3);
  // Mouth
  ctx.fillStyle = '#000';
  ctx.fillRect(2, 12, 6, 3);

  // Heavy armored body
  ctx.fillStyle = G;
  ctx.fillRect(12, 12, 16, 14);
  ctx.fillStyle = NES_COLORS.LINK_LIGHT_GREEN;
  ctx.fillRect(14, 14, 4, 4);
  ctx.fillRect(20, 16, 4, 4);

  // Dragon feet
  ctx.fillStyle = W;
  if (f % 2 === 0) {
    ctx.fillRect(12, 26, 6, 5);
    ctx.fillRect(22, 25, 6, 4);
  } else {
    ctx.fillRect(12, 25, 6, 4);
    ctx.fillRect(22, 26, 6, 5);
  }
}

/**
 * Dodongo: 32x16 armored dinosaur boss
 * When swollen from eating a bomb, belly balloons into a giant sphere!
 */
function drawDodongo(
  ctx: CanvasRenderingContext2D,
  dir: Direction,
  f: number,
  isSwollen: boolean = false,
  smokeTimer: number = 0
) {
  const BROWN = NES_COLORS.LINK_BROWN;
  const GOLD = NES_COLORS.GOLD;
  const WHITE = NES_COLORS.WHITE;
  const DARK = NES_COLORS.DARK_GRAY;

  if (isSwollen) {
    // Bloated / Swollen belly state after eating bomb
    ctx.fillStyle = BROWN;
    ctx.fillRect(2, 0, 24, 16);
    ctx.fillRect(0, 2, 28, 12);
    // Scales and highlight
    ctx.fillStyle = GOLD;
    ctx.fillRect(4, 2, 20, 10);
    ctx.fillStyle = WHITE;
    ctx.fillRect(6, 4, 16, 4);

    // Smoke puff clouds emitting from stomach
    if (Math.floor(Date.now() / 100) % 2 === 0) {
      ctx.fillStyle = NES_COLORS.GRAY;
      ctx.fillRect(12, -4, 4, 4);
      ctx.fillRect(16, -6, 3, 3);
    }
    return;
  }

  // Directional rendering (horizontal 32px vs vertical)
  if (dir === Direction.LEFT || dir === Direction.RIGHT) {
    ctx.save();
    if (dir === Direction.RIGHT) {
      ctx.scale(-1, 1);
      ctx.translate(-30, 0);
    }
    // Head / Snout (left side)
    ctx.fillStyle = BROWN;
    ctx.fillRect(0, 4, 8, 8);
    ctx.fillStyle = GOLD;
    ctx.fillRect(2, 5, 4, 3);
    // Eye
    ctx.fillStyle = NES_COLORS.RED;
    ctx.fillRect(4, 4, 2, 2);
    // Jaws
    ctx.fillStyle = WHITE;
    ctx.fillRect(0, 9, 4, 2);

    // Body
    ctx.fillStyle = BROWN;
    ctx.fillRect(7, 2, 18, 11);
    // Dorsal armor plates / spines
    ctx.fillStyle = GOLD;
    ctx.fillRect(9, 1, 3, 2);
    ctx.fillRect(14, 1, 3, 2);
    ctx.fillRect(19, 1, 3, 2);

    // Tail
    ctx.fillStyle = BROWN;
    ctx.fillRect(24, 5, 6, 5);
    ctx.fillRect(29, 6, 2, 3);

    // Legs
    ctx.fillStyle = DARK;
    if (f % 2 === 0) {
      ctx.fillRect(8, 12, 4, 4);
      ctx.fillRect(20, 12, 4, 3);
    } else {
      ctx.fillRect(8, 12, 4, 3);
      ctx.fillRect(20, 12, 4, 4);
    }
    ctx.restore();
  } else {
    // Facing UP or DOWN
    ctx.fillStyle = BROWN;
    ctx.fillRect(3, 2, 18, 12);
    ctx.fillStyle = GOLD;
    ctx.fillRect(5, 3, 14, 8);
    // Spines
    ctx.fillStyle = WHITE;
    ctx.fillRect(10, 0, 4, 14);
    // Claws
    ctx.fillStyle = DARK;
    if (f % 2 === 0) {
      ctx.fillRect(1, 4, 3, 3);
      ctx.fillRect(20, 4, 3, 3);
    } else {
      ctx.fillRect(1, 9, 3, 3);
      ctx.fillRect(20, 9, 3, 3);
    }
  }
}

/**
 * Leever: Overworld burrowing spiky creature
 */
function drawLeever(ctx: CanvasRenderingContext2D, f: number, isBurrowing: boolean = false) {
  if (isBurrowing) {
    // Dirt mound & submerged teeth
    ctx.fillStyle = NES_COLORS.OVERWORLD_GROUND;
    ctx.fillRect(2, 10, 12, 4);
    ctx.fillStyle = NES_COLORS.RED;
    ctx.fillRect(4, 8, 8, 3);
    ctx.fillStyle = NES_COLORS.WHITE;
    ctx.fillRect(6, 6, 4, 2);
    return;
  }

  // Full surfaced spiky rotating flower
  ctx.fillStyle = NES_COLORS.RED;
  ctx.fillRect(3, 2, 10, 12);
  ctx.fillRect(1, 4, 14, 8);

  // Rotating spiky teeth
  ctx.fillStyle = NES_COLORS.GOLD;
  if (f % 2 === 0) {
    ctx.fillRect(4, 4, 3, 3);
    ctx.fillRect(9, 4, 3, 3);
    ctx.fillRect(4, 9, 3, 3);
    ctx.fillRect(9, 9, 3, 3);
    ctx.fillStyle = NES_COLORS.WHITE;
    ctx.fillRect(7, 7, 2, 2);
  } else {
    ctx.fillRect(6, 3, 4, 3);
    ctx.fillRect(3, 6, 3, 4);
    ctx.fillRect(10, 6, 3, 4);
    ctx.fillRect(6, 10, 4, 3);
    ctx.fillStyle = NES_COLORS.LIGHT_BLUE;
    ctx.fillRect(7, 7, 2, 2);
  }
}

/**
 * Peahat: Spinning propeller flower
 */
function drawPeahat(ctx: CanvasRenderingContext2D, f: number, isFlying: boolean = false) {
  const t = Math.floor(Date.now() / (isFlying ? 30 : 100)) % 4;

  ctx.save();
  ctx.translate(8, 8);
  if (isFlying) {
    ctx.rotate((t * Math.PI) / 2);
  }

  // 4 Propeller petals
  ctx.fillStyle = NES_COLORS.GOLD;
  ctx.fillRect(-7, -2, 14, 4);
  ctx.fillRect(-2, -7, 4, 14);

  // Center bulb
  ctx.fillStyle = NES_COLORS.RED;
  ctx.fillRect(-4, -4, 8, 8);
  ctx.fillStyle = NES_COLORS.WHITE;
  ctx.fillRect(-2, -2, 4, 4);

  ctx.restore();

  // Root stem if landed
  if (!isFlying) {
    ctx.fillStyle = NES_COLORS.LINK_BROWN;
    ctx.fillRect(6, 12, 4, 4);
  }
}

/**
 * Armos: Stone soldier statue
 */
function drawArmos(ctx: CanvasRenderingContext2D, f: number, dir: Direction) {
  const GRAY = NES_COLORS.GRAY;
  const WHITE = NES_COLORS.WHITE;
  const DARK = NES_COLORS.DARK_GRAY;

  // Stone head & helmet
  ctx.fillStyle = GRAY;
  ctx.fillRect(4, 1, 8, 5);
  ctx.fillStyle = WHITE;
  ctx.fillRect(6, 0, 4, 2);

  // Stone visor eyes
  ctx.fillStyle = NES_COLORS.RED;
  ctx.fillRect(5, 3, 2, 1);
  ctx.fillRect(9, 3, 2, 1);

  // Stone torso
  ctx.fillStyle = GRAY;
  ctx.fillRect(3, 6, 10, 6);

  // Shield and spear
  ctx.fillStyle = WHITE;
  ctx.fillRect(2, 6, 3, 6);
  ctx.fillStyle = DARK;
  ctx.fillRect(12, 3, 2, 11);

  // Feet
  ctx.fillStyle = DARK;
  if (f % 2 === 0) {
    ctx.fillRect(4, 12, 3, 3);
    ctx.fillRect(9, 12, 3, 2);
  } else {
    ctx.fillRect(4, 12, 3, 2);
    ctx.fillRect(9, 12, 3, 3);
  }
}

/**
 * Rope: Charging slithering serpent
 */
function drawRope(ctx: CanvasRenderingContext2D, dir: Direction, f: number) {
  const BODY = NES_COLORS.SHIELD_ORANGE;
  const DARK = NES_COLORS.RED;
  const WHITE = NES_COLORS.WHITE;

  ctx.save();
  if (dir === Direction.LEFT) {
    ctx.scale(-1, 1);
    ctx.translate(-16, 0);
  }

  // Wavy body segments
  ctx.fillStyle = BODY;
  if (f % 2 === 0) {
    ctx.fillRect(2, 6, 8, 4);
    ctx.fillRect(8, 4, 6, 5);
    ctx.fillRect(0, 8, 4, 3);
  } else {
    ctx.fillRect(2, 4, 8, 4);
    ctx.fillRect(8, 6, 6, 5);
    ctx.fillRect(0, 5, 4, 3);
  }

  // Head & fangs
  ctx.fillStyle = DARK;
  ctx.fillRect(10, 5, 5, 5);
  ctx.fillStyle = WHITE;
  ctx.fillRect(14, 6, 2, 1); // fangs
  ctx.fillRect(11, 4, 2, 2); // eyes
  ctx.fillStyle = '#000';
  ctx.fillRect(12, 4, 1, 1);

  ctx.restore();
}

/**
 * Zol: Large dark dungeon slime that splits into Gels
 */
function drawZol(ctx: CanvasRenderingContext2D, f: number) {
  const BODY = '#183818';
  const RIM = NES_COLORS.LINK_LIGHT_GREEN;
  const EYE = NES_COLORS.RED;

  // Blob body
  ctx.fillStyle = BODY;
  if (f % 2 === 0) {
    ctx.fillRect(2, 3, 12, 10);
    ctx.fillRect(4, 1, 8, 14);
  } else {
    ctx.fillRect(1, 4, 14, 9);
    ctx.fillRect(3, 2, 10, 13);
  }

  // Gelatinous rim highlights
  ctx.fillStyle = RIM;
  ctx.fillRect(3, 2, 4, 2);
  ctx.fillRect(9, 2, 4, 2);

  // Red beady eyes
  ctx.fillStyle = EYE;
  ctx.fillRect(4, 6, 2, 3);
  ctx.fillRect(10, 6, 2, 3);
  ctx.fillStyle = NES_COLORS.WHITE;
  ctx.fillRect(5, 6, 1, 1);
  ctx.fillRect(11, 6, 1, 1);
}

/**
 * Gel: Small bouncy mini slime
 */
function drawGel(ctx: CanvasRenderingContext2D, f: number) {
  const BODY = '#183818';
  const EYE = NES_COLORS.WHITE;

  ctx.save();
  ctx.translate(4, 4); // Center 8x8 inside 16x16 box

  ctx.fillStyle = BODY;
  if (f % 2 === 0) {
    // Normal resting blob
    ctx.fillRect(0, 2, 8, 6);
    ctx.fillRect(2, 0, 4, 8);
  } else {
    // Squashed/hopping blob
    ctx.fillRect(0, 1, 8, 5);
    ctx.fillRect(1, 0, 6, 7);
  }

  // Cute white eyes
  ctx.fillStyle = EYE;
  ctx.fillRect(1, 2, 2, 2);
  ctx.fillRect(5, 2, 2, 2);
  ctx.fillStyle = '#000';
  ctx.fillRect(2, 3, 1, 1);
  ctx.fillRect(6, 3, 1, 1);

  ctx.restore();
}

/**
 * Blade Trap: Invulnerable metallic sliding spike trap
 */
function drawBladeTrap(ctx: CanvasRenderingContext2D) {
  const METAL = NES_COLORS.BLUE;
  const SPIKE = NES_COLORS.WHITE;
  const CORE = NES_COLORS.RED;

  // Main square chassis
  ctx.fillStyle = METAL;
  ctx.fillRect(3, 3, 10, 10);
  ctx.fillStyle = '#000';
  ctx.fillRect(5, 5, 6, 6);

  // Red central danger core
  ctx.fillStyle = CORE;
  ctx.fillRect(6, 6, 4, 4);
  ctx.fillStyle = NES_COLORS.GOLD;
  ctx.fillRect(7, 7, 2, 2);

  // 4 Razor corner spikes
  ctx.fillStyle = SPIKE;
  // Top-left
  ctx.fillRect(1, 1, 3, 2);
  ctx.fillRect(1, 1, 2, 3);
  // Top-right
  ctx.fillRect(12, 1, 3, 2);
  ctx.fillRect(13, 1, 2, 3);
  // Bottom-left
  ctx.fillRect(1, 13, 3, 2);
  ctx.fillRect(1, 12, 2, 3);
  // Bottom-right
  ctx.fillRect(12, 13, 3, 2);
  ctx.fillRect(13, 12, 2, 3);
}

/**
 * Like Like: Shield-eating tubular monster
 */
function drawLikeLike(ctx: CanvasRenderingContext2D, f: number) {
  const RING_ORANGE = NES_COLORS.SHIELD_ORANGE;
  const RING_RED = NES_COLORS.RED;
  const INNER = '#181818';

  // 4 Pulsating accordion tube segments
  const offset = f % 2 === 0 ? 0 : 1;

  // Segment 1 (top maw)
  ctx.fillStyle = RING_RED;
  ctx.fillRect(2 + offset, 1, 12 - offset * 2, 3);
  ctx.fillStyle = INNER;
  ctx.fillRect(4 + offset, 2, 8 - offset * 2, 2);

  // Segment 2
  ctx.fillStyle = RING_ORANGE;
  ctx.fillRect(1, 4, 14, 3);
  ctx.fillStyle = RING_RED;
  ctx.fillRect(3, 5, 10, 2);

  // Segment 3
  ctx.fillStyle = RING_ORANGE;
  ctx.fillRect(2 - offset, 8, 12 + offset * 2, 3);
  ctx.fillStyle = RING_RED;
  ctx.fillRect(4, 9, 8, 2);

  // Segment 4 (base)
  ctx.fillStyle = RING_ORANGE;
  ctx.fillRect(3, 12, 10, 4);
  ctx.fillStyle = INNER;
  ctx.fillRect(5, 14, 6, 2);
}

/**
 * Wizzrobe: Teleporting magic sorcerer
 */
function drawWizzrobe(ctx: CanvasRenderingContext2D, f: number, dir: Direction) {
  const ROBE = NES_COLORS.RED;
  const TRIM = NES_COLORS.GOLD;
  const HOOD_DARK = '#1a0000';
  const EYE = NES_COLORS.GOLD;

  ctx.save();
  if (dir === Direction.LEFT) {
    ctx.scale(-1, 1);
    ctx.translate(-16, 0);
  }

  // Robe cowl
  ctx.fillStyle = ROBE;
  ctx.fillRect(4, 1, 8, 7);
  ctx.fillRect(3, 7, 10, 8);

  // Golden trim
  ctx.fillStyle = TRIM;
  ctx.fillRect(4, 0, 8, 2);
  ctx.fillRect(3, 14, 10, 2);

  // Shadow face under hood
  ctx.fillStyle = HOOD_DARK;
  ctx.fillRect(5, 3, 6, 4);

  // Glowing eyes
  ctx.fillStyle = EYE;
  ctx.fillRect(6, 4, 1, 2);
  ctx.fillRect(9, 4, 1, 2);

  // Magic wand
  ctx.fillStyle = NES_COLORS.LINK_BROWN;
  ctx.fillRect(12, 5, 2, 10);
  ctx.fillStyle = NES_COLORS.LIGHT_BLUE;
  ctx.fillRect(11, 3, 4, 3);
  if (f % 2 === 0) {
    ctx.fillStyle = NES_COLORS.WHITE;
    ctx.fillRect(12, 2, 2, 2);
  }

  ctx.restore();
}

/**
 * Ghini: Graveyard ghost (statue-like stone monument until touched, then haunting ghost)
 */
function drawGhini(ctx: CanvasRenderingContext2D, f: number, dir: Direction, isAwakened: boolean) {
  if (!isAwakened) {
    // Dormant statue-like gravestone spirit form (weathered stone silhouette)
    const STONE = NES_COLORS.GRAY;
    const STONE_LIGHT = NES_COLORS.WHITE;
    const STONE_DARK = NES_COLORS.DARK_GRAY;

    // Stone pedestal base
    ctx.fillStyle = STONE_DARK;
    ctx.fillRect(2, 13, 12, 3);
    ctx.fillStyle = STONE;
    ctx.fillRect(3, 4, 10, 9);
    ctx.fillRect(5, 2, 6, 2);

    // Chiseled stone highlights
    ctx.fillStyle = STONE_LIGHT;
    ctx.fillRect(5, 2, 6, 1);
    ctx.fillRect(3, 4, 2, 8);

    // Closed / carved stone eye slits & funerary cross motif
    ctx.fillStyle = STONE_DARK;
    ctx.fillRect(5, 6, 2, 1);
    ctx.fillRect(9, 6, 2, 1);
    ctx.fillRect(7, 8, 2, 4);
    ctx.fillRect(6, 9, 4, 1);
    return;
  }

  // Active hovering spectral ghost form
  ctx.save();
  ctx.globalAlpha = f % 2 === 0 ? 0.92 : 0.78;
  if (dir === Direction.LEFT) {
    ctx.scale(-1, 1);
    ctx.translate(-16, 0);
  }

  const GHOST_WHITE = NES_COLORS.WHITE;
  const GHOST_TINT = NES_COLORS.LIGHT_BLUE;
  const GHOST_DARK = '#002878';

  // Domed ghost head & shrouded cloak
  ctx.fillStyle = GHOST_WHITE;
  ctx.fillRect(5, 1, 6, 2);
  ctx.fillRect(3, 3, 10, 8);
  ctx.fillRect(2, 6, 12, 5);

  // Spectral cyan shading on left/bottom cloak
  ctx.fillStyle = GHOST_TINT;
  ctx.fillRect(2, 9, 3, 2);
  ctx.fillRect(11, 9, 3, 2);
  ctx.fillRect(4, 11, 8, 2);

  // Fluttering ghost tail wisps
  if (f % 2 === 0) {
    ctx.fillStyle = GHOST_WHITE;
    ctx.fillRect(2, 11, 2, 3);
    ctx.fillRect(6, 12, 3, 3);
    ctx.fillRect(11, 11, 2, 3);
  } else {
    ctx.fillStyle = GHOST_TINT;
    ctx.fillRect(3, 12, 2, 3);
    ctx.fillRect(7, 11, 3, 3);
    ctx.fillRect(12, 12, 2, 2);
  }

  // Hollow haunting eye sockets & gaping ghost mouth
  ctx.fillStyle = GHOST_DARK;
  ctx.fillRect(5, 5, 2, 2);
  ctx.fillRect(10, 5, 2, 2);
  ctx.fillRect(7, 8, 3, 2);

  ctx.restore();
}

/**
 * Manhandla: 4-jawed snapping carnivorous flower boss of Level 3
 */
function drawManhandla(
  ctx: CanvasRenderingContext2D,
  f: number,
  jaws?: { up: boolean; down: boolean; left: boolean; right: boolean }
) {
  const alive = jaws || { up: true, down: true, left: true, right: true };
  const CORE_GREEN = '#187800';
  const CORE_RED = NES_COLORS.RED;
  const JAW_OUTER = '#289810';
  const JAW_INNER = NES_COLORS.SHIELD_ORANGE;
  const TEETH = NES_COLORS.WHITE;

  // Central core (pulsating)
  ctx.fillStyle = CORE_GREEN;
  ctx.fillRect(4, 4, 8, 8);
  ctx.fillStyle = CORE_RED;
  ctx.fillRect(6, 6, 4, 4);
  if (f % 2 === 0) {
    ctx.fillStyle = NES_COLORS.GOLD;
    ctx.fillRect(7, 7, 2, 2);
  }

  // North Jaw
  if (alive.up) {
    ctx.fillStyle = JAW_OUTER;
    ctx.fillRect(4, -4, 8, 7);
    ctx.fillStyle = JAW_INNER;
    const bite = f % 2 === 0 ? 1 : 2;
    ctx.fillRect(5, -3, 6, bite + 1);
    ctx.fillStyle = TEETH;
    ctx.fillRect(5, -4, 2, 1);
    ctx.fillRect(9, -4, 2, 1);
  }

  // South Jaw
  if (alive.down) {
    ctx.fillStyle = JAW_OUTER;
    ctx.fillRect(4, 13, 8, 7);
    ctx.fillStyle = JAW_INNER;
    const bite = f % 2 === 0 ? 1 : 2;
    ctx.fillRect(5, 15, 6, bite + 1);
    ctx.fillStyle = TEETH;
    ctx.fillRect(5, 19, 2, 1);
    ctx.fillRect(9, 19, 2, 1);
  }

  // West Jaw
  if (alive.left) {
    ctx.fillStyle = JAW_OUTER;
    ctx.fillRect(-4, 4, 7, 8);
    ctx.fillStyle = JAW_INNER;
    const bite = f % 2 === 0 ? 1 : 2;
    ctx.fillRect(-3, 5, bite + 1, 6);
    ctx.fillStyle = TEETH;
    ctx.fillRect(-4, 5, 1, 2);
    ctx.fillRect(-4, 9, 1, 2);
  }

  // East Jaw
  if (alive.right) {
    ctx.fillStyle = JAW_OUTER;
    ctx.fillRect(13, 4, 7, 8);
    ctx.fillStyle = JAW_INNER;
    const bite = f % 2 === 0 ? 1 : 2;
    ctx.fillRect(15, 5, bite + 1, 6);
    ctx.fillStyle = TEETH;
    ctx.fillRect(19, 5, 1, 2);
    ctx.fillRect(19, 9, 1, 2);
  }
}

// --- NPC & ENVIRONMENT SPRITES ---

export function drawOldMan(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  // Red robe
  ctx.fillStyle = NES_COLORS.RED;
  ctx.fillRect(3, 4, 10, 10);
  // White beard
  ctx.fillStyle = NES_COLORS.WHITE;
  ctx.fillRect(4, 5, 8, 6);
  // Face
  ctx.fillStyle = NES_COLORS.LINK_SKIN;
  ctx.fillRect(5, 2, 6, 3);
  // Eyes
  ctx.fillStyle = '#000';
  ctx.fillRect(6, 3, 1, 1);
  ctx.fillRect(9, 3, 1, 1);
  ctx.restore();
}

export function drawTorch(ctx: CanvasRenderingContext2D, x: number, y: number, f: number) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  // Pedestal
  ctx.fillStyle = NES_COLORS.LINK_BROWN;
  ctx.fillRect(5, 8, 6, 8);
  // Fire animation
  ctx.fillStyle = NES_COLORS.RED;
  ctx.fillRect(4, 3, 8, 6);
  ctx.fillStyle = NES_COLORS.GOLD;
  if (f % 2 === 0) {
    ctx.fillRect(5, 1, 6, 5);
    ctx.fillRect(6, 0, 4, 2);
  } else {
    ctx.fillRect(5, 2, 6, 5);
    ctx.fillRect(7, 0, 3, 3);
  }
  ctx.restore();
}

// --- PICKUP ITEMS ---

export function drawItem(ctx: CanvasRenderingContext2D, type: ItemType, x: number, y: number) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));

  switch (type) {
    case ItemType.SWORD_WOOD:
      drawSword(ctx, NES_COLORS.LINK_BROWN);
      break;
    case ItemType.SWORD_WHITE:
      drawSword(ctx, NES_COLORS.WHITE);
      break;
    case ItemType.HEART:
      drawHeart(ctx, true);
      break;
    case ItemType.HEART_CONTAINER:
      drawHeartContainer(ctx);
      break;
    case ItemType.RUPEE:
      drawRupee(ctx, NES_COLORS.LINK_LIGHT_GREEN);
      break;
    case ItemType.RUPEE_FIVE:
      drawRupee(ctx, NES_COLORS.BLUE);
      break;
    case ItemType.KEY:
      drawKey(ctx);
      break;
    case ItemType.BOMB:
      drawBomb(ctx);
      break;
    case ItemType.BOOMERANG:
      drawBoomerang(ctx, NES_COLORS.GOLD);
      break;
    case ItemType.BOOMERANG_MAGICAL:
      drawBoomerang(ctx, NES_COLORS.LIGHT_BLUE);
      break;
    case ItemType.BOW:
      drawBow(ctx);
      break;
    case ItemType.CANDLE_BLUE:
      drawCandle(ctx, NES_COLORS.LIGHT_BLUE);
      break;
    case ItemType.CANDLE_RED:
      drawCandle(ctx, NES_COLORS.RED);
      break;
    case ItemType.POTION_BLUE:
      drawPotion(ctx, NES_COLORS.BLUE);
      break;
    case ItemType.POTION_RED:
      drawPotion(ctx, NES_COLORS.RED);
      break;
    case ItemType.RECORDER:
      drawRecorder(ctx);
      break;
    case ItemType.MAGICAL_ROD:
      drawMagicalRod(ctx);
      break;
    case ItemType.MAGICAL_SHIELD:
      drawMagicalShieldItem(ctx);
      break;
    case ItemType.POWER_BRACELET:
      drawPowerBracelet(ctx);
      break;
    case ItemType.FOOD:
      drawFood(ctx);
      break;
    case ItemType.STEPPING_LADDER:
      drawSteppingLadder(ctx);
      break;
    case ItemType.TRIFORCE:
      drawTriforce(ctx);
      break;
    case ItemType.CLOCK:
      drawClock(ctx);
      break;
    case ItemType.COMPASS:
      drawCompass(ctx);
      break;
    case ItemType.DUNGEON_MAP:
      drawDungeonMap(ctx);
      break;
    case ItemType.BLUE_RING:
      drawRing(ctx, NES_COLORS.BLUE, NES_COLORS.WHITE);
      break;
    case ItemType.RED_RING:
      drawRing(ctx, NES_COLORS.RED, NES_COLORS.GOLD);
      break;
    case ItemType.FAIRY:
      drawFairy(ctx, Math.floor(Date.now() / 100) % 2);
      break;
  }

  ctx.restore();
}

function drawSword(ctx: CanvasRenderingContext2D, bladeColor: string) {
  // Blade
  ctx.fillStyle = bladeColor;
  ctx.fillRect(7, 1, 2, 8);
  ctx.fillRect(6, 2, 4, 6);
  // Crossguard
  ctx.fillStyle = NES_COLORS.LINK_BROWN;
  ctx.fillRect(4, 9, 8, 2);
  // Grip
  ctx.fillStyle = NES_COLORS.WHITE;
  ctx.fillRect(7, 11, 2, 4);
}

export function drawHeart(ctx: CanvasRenderingContext2D, full: boolean) {
  if (!full) return;
  ctx.fillStyle = NES_COLORS.RED;
  ctx.fillRect(3, 4, 4, 3);
  ctx.fillRect(9, 4, 4, 3);
  ctx.fillRect(2, 6, 12, 3);
  ctx.fillRect(4, 9, 8, 3);
  ctx.fillRect(6, 12, 4, 2);
  // Shine
  ctx.fillStyle = NES_COLORS.WHITE;
  ctx.fillRect(4, 5, 2, 2);
}

export function drawHeartContainer(ctx: CanvasRenderingContext2D) {
  // Gold container frame
  ctx.fillStyle = NES_COLORS.GOLD;
  ctx.fillRect(1, 2, 14, 12);
  // Red inner heart
  drawHeart(ctx, true);
}

function drawRupee(ctx: CanvasRenderingContext2D, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(6, 2, 4, 2);
  ctx.fillRect(4, 4, 8, 8);
  ctx.fillRect(6, 12, 4, 2);
  // White highlight
  ctx.fillStyle = NES_COLORS.WHITE;
  ctx.fillRect(6, 4, 2, 6);
}

function drawKey(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = NES_COLORS.GOLD;
  // Key ring
  ctx.fillRect(5, 2, 6, 4);
  ctx.fillStyle = '#000';
  ctx.fillRect(7, 3, 2, 2);
  // Shaft & teeth
  ctx.fillStyle = NES_COLORS.GOLD;
  ctx.fillRect(7, 6, 2, 8);
  ctx.fillRect(9, 10, 3, 2);
  ctx.fillRect(9, 13, 2, 2);
}

function drawBomb(ctx: CanvasRenderingContext2D) {
  // Round bomb body
  ctx.fillStyle = NES_COLORS.BLUE;
  ctx.fillRect(4, 4, 8, 8);
  ctx.fillRect(3, 5, 10, 6);
  // Fuse
  ctx.fillStyle = NES_COLORS.WHITE;
  ctx.fillRect(7, 2, 2, 2);
  // Spark
  ctx.fillStyle = NES_COLORS.RED;
  ctx.fillRect(9, 1, 2, 2);
}

function drawBoomerang(ctx: CanvasRenderingContext2D, color: string = NES_COLORS.GOLD) {
  ctx.fillStyle = color;
  ctx.fillRect(4, 4, 8, 3);
  ctx.fillRect(4, 7, 3, 6);
  // Highlight
  ctx.fillStyle = NES_COLORS.WHITE;
  ctx.fillRect(5, 5, 2, 2);
}

function drawBow(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = NES_COLORS.LINK_BROWN;
  ctx.fillRect(4, 2, 3, 12);
  ctx.fillRect(6, 4, 2, 8);
  ctx.fillStyle = NES_COLORS.WHITE;
  ctx.fillRect(8, 2, 1, 12);
}

function drawCandle(ctx: CanvasRenderingContext2D, color: string = NES_COLORS.LIGHT_BLUE) {
  ctx.fillStyle = color;
  ctx.fillRect(6, 6, 4, 8);
  // Wick & Flame
  ctx.fillStyle = NES_COLORS.RED;
  ctx.fillRect(7, 3, 2, 3);
  ctx.fillStyle = NES_COLORS.GOLD;
  ctx.fillRect(7, 1, 2, 2);
}

function drawPotion(ctx: CanvasRenderingContext2D, liquidColor: string) {
  // Glass bottle cork
  ctx.fillStyle = NES_COLORS.LINK_BROWN;
  ctx.fillRect(7, 2, 2, 2);
  // Glass neck
  ctx.fillStyle = NES_COLORS.WHITE;
  ctx.fillRect(6, 4, 4, 2);
  // Bottle body
  ctx.fillStyle = NES_COLORS.WHITE;
  ctx.fillRect(4, 6, 8, 8);
  // Colored liquid contents
  ctx.fillStyle = liquidColor;
  ctx.fillRect(5, 7, 6, 6);
  // White glass reflection highlight
  ctx.fillStyle = NES_COLORS.WHITE;
  ctx.fillRect(5, 7, 1, 4);
}

function drawRecorder(ctx: CanvasRenderingContext2D) {
  // White flute body with mouthpiece
  ctx.fillStyle = NES_COLORS.WHITE;
  ctx.fillRect(7, 2, 2, 12);
  ctx.fillRect(6, 2, 4, 2);
  // Tone holes
  ctx.fillStyle = '#000';
  ctx.fillRect(7, 6, 2, 1);
  ctx.fillRect(7, 9, 2, 1);
  ctx.fillRect(7, 12, 2, 1);
}

function drawMagicalRod(ctx: CanvasRenderingContext2D) {
  // Golden rod shaft
  ctx.fillStyle = NES_COLORS.GOLD;
  ctx.fillRect(7, 5, 2, 10);
  ctx.fillRect(6, 12, 4, 2);
  // Magical orb / crystal tip
  ctx.fillStyle = NES_COLORS.LIGHT_BLUE;
  ctx.fillRect(5, 1, 6, 4);
  ctx.fillStyle = NES_COLORS.WHITE;
  ctx.fillRect(6, 2, 4, 2);
}

function drawMagicalShieldItem(ctx: CanvasRenderingContext2D) {
  // White rim
  ctx.fillStyle = NES_COLORS.WHITE;
  ctx.fillRect(3, 2, 10, 12);
  // Blue shield face
  ctx.fillStyle = NES_COLORS.BLUE;
  ctx.fillRect(4, 3, 8, 10);
  // Red cross crest
  ctx.fillStyle = NES_COLORS.RED;
  ctx.fillRect(7, 4, 2, 8);
  ctx.fillRect(5, 6, 6, 2);
}

function drawPowerBracelet(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = NES_COLORS.GOLD;
  ctx.fillRect(4, 4, 8, 8);
  ctx.fillStyle = '#000';
  ctx.fillRect(6, 6, 4, 4);
  ctx.fillStyle = NES_COLORS.RED;
  ctx.fillRect(7, 7, 2, 2);
}

function drawFood(ctx: CanvasRenderingContext2D) {
  // Bone ends
  ctx.fillStyle = NES_COLORS.WHITE;
  ctx.fillRect(2, 7, 2, 2);
  ctx.fillRect(12, 7, 2, 2);
  // Roast meat
  ctx.fillStyle = NES_COLORS.LINK_BROWN;
  ctx.fillRect(4, 5, 8, 6);
  ctx.fillStyle = NES_COLORS.RED;
  ctx.fillRect(6, 6, 4, 4);
}

function drawSteppingLadder(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = NES_COLORS.LINK_BROWN;
  // Two vertical rails
  ctx.fillRect(4, 2, 2, 12);
  ctx.fillRect(10, 2, 2, 12);
  // Three horizontal rungs
  ctx.fillRect(6, 4, 4, 2);
  ctx.fillRect(6, 8, 4, 2);
  ctx.fillRect(6, 12, 4, 2);
}

function drawTriforce(ctx: CanvasRenderingContext2D) {
  const pulse = Math.floor(Date.now() / 160) % 2 === 0;
  // Classic golden equilateral triangle with bright rim & animated NES shimmer
  for (let r = 0; r < 12; r++) {
    const w = r * 2 + 1;
    const startX = 8 - r;
    ctx.fillStyle = pulse ? NES_COLORS.GOLD : NES_COLORS.OVERWORLD_ROCK_LIGHT;
    ctx.fillRect(startX, 2 + r, w, 1);
  }
  // Inner inverted dark/bright highlight facet for iconic Triforce relief
  ctx.fillStyle = pulse ? NES_COLORS.WHITE : NES_COLORS.GOLD;
  ctx.fillRect(7, 4, 2, 2);
  ctx.fillRect(6, 7, 4, 1);
  ctx.fillStyle = NES_COLORS.OVERWORLD_ROCK;
  ctx.fillRect(6, 9, 4, 1);
  ctx.fillRect(7, 10, 2, 1);
}

function drawClock(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = NES_COLORS.GOLD;
  ctx.fillRect(4, 4, 8, 8);
  ctx.fillStyle = NES_COLORS.WHITE;
  ctx.fillRect(5, 5, 6, 6);
  ctx.fillStyle = '#000';
  ctx.fillRect(7, 6, 2, 3);
  ctx.fillRect(7, 8, 3, 1);
}

function drawCompass(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = NES_COLORS.LINK_LIGHT_GREEN;
  ctx.fillRect(4, 4, 8, 8);
  ctx.fillStyle = NES_COLORS.RED;
  ctx.fillRect(7, 5, 2, 3);
  ctx.fillStyle = NES_COLORS.WHITE;
  ctx.fillRect(7, 8, 2, 3);
}

function drawDungeonMap(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = NES_COLORS.OVERWORLD_GROUND;
  ctx.fillRect(3, 3, 10, 10);
  ctx.fillStyle = NES_COLORS.RED;
  ctx.fillRect(5, 5, 6, 6);
}

/**
 * Magical Ring: Blue Ring / Red Ring
 */
function drawRing(ctx: CanvasRenderingContext2D, bandColor: string, gemColor: string) {
  // Ring metallic band
  ctx.fillStyle = bandColor;
  ctx.fillRect(4, 3, 8, 10);
  ctx.fillStyle = '#000';
  ctx.fillRect(6, 6, 4, 5);

  // Sparkling gemstone on top
  ctx.fillStyle = gemColor;
  ctx.fillRect(6, 2, 4, 3);
  ctx.fillRect(7, 1, 2, 1);
  ctx.fillStyle = NES_COLORS.WHITE;
  ctx.fillRect(7, 2, 1, 1);
}

/**
 * Fairy: Small fluttering sprite
 */
export function drawFairy(ctx: CanvasRenderingContext2D, f: number) {
  const BODY = NES_COLORS.WHITE;
  const WING = NES_COLORS.LIGHT_BLUE;
  const GLOW = NES_COLORS.GOLD;

  // Glow aura
  ctx.fillStyle = GLOW;
  ctx.fillRect(4, 4, 8, 8);

  // Center fairy body
  ctx.fillStyle = BODY;
  ctx.fillRect(6, 5, 4, 6);
  ctx.fillStyle = NES_COLORS.RED;
  ctx.fillRect(7, 6, 2, 2);

  // Fluttering wings
  ctx.fillStyle = WING;
  if (f % 2 === 0) {
    ctx.fillRect(2, 3, 4, 4);
    ctx.fillRect(10, 3, 4, 4);
  } else {
    ctx.fillRect(3, 1, 4, 5);
    ctx.fillRect(9, 1, 4, 5);
  }
}

/**
 * Great Fairy: Ethereal radiant guardian in secret springs
 */
export function drawGreatFairy(ctx: CanvasRenderingContext2D, x: number, y: number, f: number) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));

  const GOWN = NES_COLORS.LIGHT_RED;
  const SKIN = NES_COLORS.LINK_SKIN;
  const HAIR = NES_COLORS.GOLD;
  const WING = NES_COLORS.LIGHT_BLUE;
  const HALO = NES_COLORS.GOLD;

  // Golden halo overhead
  ctx.fillStyle = HALO;
  ctx.fillRect(6, -4, 12, 2);
  ctx.fillRect(8, -5, 8, 1);

  // Large shimmering wings
  ctx.fillStyle = WING;
  if (f % 2 === 0) {
    ctx.fillRect(0, 4, 6, 12);
    ctx.fillRect(18, 4, 6, 12);
  } else {
    ctx.fillRect(1, 1, 6, 14);
    ctx.fillRect(17, 1, 6, 14);
  }

  // Blonde hair
  ctx.fillStyle = HAIR;
  ctx.fillRect(7, -2, 10, 6);

  // Face & shoulders
  ctx.fillStyle = SKIN;
  ctx.fillRect(8, 0, 8, 6);
  ctx.fillStyle = '#000';
  ctx.fillRect(9, 2, 1, 2);
  ctx.fillRect(14, 2, 1, 2);

  // Flowing gown
  ctx.fillStyle = GOWN;
  ctx.fillRect(7, 6, 10, 14);
  ctx.fillRect(6, 12, 12, 8);
  ctx.fillStyle = NES_COLORS.WHITE;
  ctx.fillRect(9, 7, 6, 10);

  ctx.restore();
}

// --- PROJECTILES ---

export function drawProjectile(ctx: CanvasRenderingContext2D, p: {
  type: string;
  x: number;
  y: number;
  dir: Direction;
}) {
  ctx.save();
  ctx.translate(Math.round(p.x), Math.round(p.y));

  switch (p.type) {
    case 'sword_beam': {
      // Authentic NES 8x8 Sword Beam with flashing color cycle
      const beamColors = [NES_COLORS.WHITE, NES_COLORS.LIGHT_BLUE, NES_COLORS.RED, NES_COLORS.GOLD];
      const colorIdx = Math.floor(Date.now() / 45) % beamColors.length;
      ctx.fillStyle = beamColors[colorIdx];

      if (p.dir === Direction.UP) {
        ctx.fillRect(3, 0, 2, 6); // Pointed blade
        ctx.fillRect(1, 5, 6, 1); // Crossguard
        ctx.fillRect(3, 6, 2, 2); // Hilt
      } else if (p.dir === Direction.DOWN) {
        ctx.fillRect(3, 2, 2, 6); // Pointed blade
        ctx.fillRect(1, 2, 6, 1); // Crossguard
        ctx.fillRect(3, 0, 2, 2); // Hilt
      } else if (p.dir === Direction.LEFT) {
        ctx.fillRect(0, 3, 6, 2); // Pointed blade
        ctx.fillRect(5, 1, 1, 6); // Crossguard
        ctx.fillRect(6, 3, 2, 2); // Hilt
      } else {
        ctx.fillRect(2, 3, 6, 2); // Pointed blade
        ctx.fillRect(2, 1, 1, 6); // Crossguard
        ctx.fillRect(0, 3, 2, 2); // Hilt
      }
      break;
    }
    case 'rock':
      ctx.fillStyle = NES_COLORS.RED;
      ctx.fillRect(4, 4, 8, 8);
      break;
    case 'arrow':
      // Authentic NES directional arrow rendering
      ctx.fillStyle = NES_COLORS.LINK_BROWN;
      if (p.dir === Direction.UP) {
        ctx.fillRect(7, 4, 2, 10); // shaft
        ctx.fillStyle = NES_COLORS.WHITE;
        ctx.fillRect(6, 1, 4, 3); // arrowhead pointing up
        ctx.fillStyle = NES_COLORS.RED;
        ctx.fillRect(6, 12, 4, 2); // fletching
      } else if (p.dir === Direction.DOWN) {
        ctx.fillRect(7, 2, 2, 10); // shaft
        ctx.fillStyle = NES_COLORS.WHITE;
        ctx.fillRect(6, 12, 4, 3); // arrowhead pointing down
        ctx.fillStyle = NES_COLORS.RED;
        ctx.fillRect(6, 2, 4, 2); // fletching
      } else if (p.dir === Direction.LEFT) {
        ctx.fillRect(4, 7, 10, 2); // shaft
        ctx.fillStyle = NES_COLORS.WHITE;
        ctx.fillRect(1, 6, 3, 4); // arrowhead pointing left
        ctx.fillStyle = NES_COLORS.RED;
        ctx.fillRect(12, 6, 2, 4); // fletching
      } else {
        ctx.fillRect(2, 7, 10, 2); // shaft
        ctx.fillStyle = NES_COLORS.WHITE;
        ctx.fillRect(12, 6, 3, 4); // arrowhead pointing right
        ctx.fillStyle = NES_COLORS.RED;
        ctx.fillRect(2, 6, 2, 4); // fletching
      }
      break;
    case 'boomerang':
      ctx.fillStyle = NES_COLORS.GOLD;
      const t = Math.floor(Date.now() / 40) % 4;
      ctx.translate(8, 8);
      ctx.rotate((t * Math.PI) / 2);
      ctx.fillRect(-6, -6, 12, 4);
      ctx.fillRect(-6, -2, 4, 8);
      break;
    case 'fireball':
      ctx.fillStyle = NES_COLORS.RED;
      ctx.fillRect(4, 4, 8, 8);
      ctx.fillStyle = NES_COLORS.GOLD;
      ctx.fillRect(6, 6, 4, 4);
      break;
    case 'flame':
      ctx.fillStyle = NES_COLORS.RED;
      ctx.fillRect(3, 4, 10, 10);
      ctx.fillStyle = NES_COLORS.GOLD;
      if (Math.floor(Date.now() / 50) % 2 === 0) {
        ctx.fillRect(5, 2, 6, 8);
        ctx.fillRect(6, 0, 4, 4);
      } else {
        ctx.fillRect(4, 3, 8, 7);
        ctx.fillRect(7, 1, 3, 3);
      }
      break;
    case 'magic_wave':
      ctx.fillStyle = NES_COLORS.LIGHT_BLUE;
      if (p.dir === Direction.UP || p.dir === Direction.DOWN) {
        ctx.fillRect(3, 4, 10, 8);
        ctx.fillStyle = NES_COLORS.WHITE;
        ctx.fillRect(5, 6, 6, 4);
      } else {
        ctx.fillRect(4, 3, 8, 10);
        ctx.fillStyle = NES_COLORS.WHITE;
        ctx.fillRect(6, 5, 4, 6);
      }
      break;
  }

  ctx.restore();
}

// --- OVERWORLD & DUNGEON TILE RENDERERS ---

/**
 * Tile Types:
 * 0: Walkable Ground
 * 1: Green Bush / Tree
 * 2: Brown Rock / Mountain
 * 3: Water (Animated)
 * 4: Cave / Dungeon Entrance
 * 5: Dungeon Wall (Cyan stone)
 * 6: Dungeon Floor
 * 7: Dungeon Door Top
 * 8: Dungeon Door Bottom
 * 9: Dungeon Door Left
 * 10: Dungeon Door Right
 * 11: Sand path
 * 12: Burnable Bush
 * 13: Bombable Wall
 */
export function drawTile(
  ctx: CanvasRenderingContext2D,
  tile: number,
  x: number,
  y: number,
  animTick: number,
  isDungeon: boolean
) {
  const {
    OVERWORLD_GROUND, OVERWORLD_GREEN, OVERWORLD_DARK_GREEN,
    OVERWORLD_ROCK, OVERWORLD_ROCK_LIGHT, WATER_BLUE,
    DUNGEON_WALL, DUNGEON_WALL_LIGHT, DUNGEON_FLOOR, BLACK, WHITE
  } = NES_COLORS;

  switch (tile) {
    case 0: // Ground
      if (isDungeon) {
        ctx.fillStyle = DUNGEON_FLOOR;
        ctx.fillRect(x, y, 16, 16);
      } else {
        ctx.fillStyle = OVERWORLD_GROUND;
        ctx.fillRect(x, y, 16, 16);
        // Subtle grass stippling
        ctx.fillStyle = OVERWORLD_DARK_GREEN;
        ctx.fillRect(x + 4, y + 4, 1, 1);
        ctx.fillRect(x + 12, y + 10, 1, 1);
      }
      break;

    case 1: // Tree / Bush
    case 12: // Burnable Bush
      ctx.fillStyle = OVERWORLD_GREEN;
      ctx.fillRect(x, y, 16, 16);
      ctx.fillStyle = OVERWORLD_DARK_GREEN;
      ctx.fillRect(x + 2, y + 2, 12, 12);
      ctx.fillStyle = OVERWORLD_GREEN;
      ctx.fillRect(x + 4, y + 4, 8, 8);
      ctx.fillStyle = BLACK;
      ctx.fillRect(x + 6, y + 6, 4, 4);
      break;

    case 2: // Rock / Mountain
      ctx.fillStyle = OVERWORLD_ROCK;
      ctx.fillRect(x, y, 16, 16);
      ctx.fillStyle = OVERWORLD_ROCK_LIGHT;
      ctx.fillRect(x + 1, y + 1, 14, 4);
      ctx.fillStyle = BLACK;
      ctx.fillRect(x + 14, y + 1, 2, 15);
      ctx.fillRect(x, y + 14, 16, 2);
      break;

    case 3: // Water
      ctx.fillStyle = WATER_BLUE;
      ctx.fillRect(x, y, 16, 16);
      ctx.fillStyle = WHITE;
      // Animated water wave pattern
      const offset = (animTick % 2) * 4;
      ctx.fillRect(x + 2 + offset, y + 4, 4, 1);
      ctx.fillRect(x + 8 - offset, y + 10, 4, 1);
      break;

    case 4: // Cave Entrance
      ctx.fillStyle = OVERWORLD_ROCK;
      ctx.fillRect(x, y, 16, 16);
      ctx.fillStyle = BLACK;
      ctx.fillRect(x + 2, y + 2, 12, 14);
      break;

    case 5: // Dungeon Wall Block
    case 14: // Pushable Block
      ctx.fillStyle = isDungeon ? DUNGEON_WALL : OVERWORLD_ROCK;
      ctx.fillRect(x, y, 16, 16);
      ctx.fillStyle = isDungeon ? DUNGEON_WALL_LIGHT : OVERWORLD_ROCK_LIGHT;
      ctx.fillRect(x + 1, y + 1, 14, 2);
      ctx.fillRect(x + 1, y + 1, 2, 14);
      ctx.fillStyle = BLACK;
      ctx.fillRect(x + 14, y + 1, 2, 15);
      ctx.fillRect(x + 1, y + 14, 15, 2);
      if (tile === 14) {
        // Subtle engraved block insignia
        ctx.fillStyle = isDungeon ? DUNGEON_WALL_LIGHT : OVERWORLD_GROUND;
        ctx.fillRect(x + 6, y + 6, 4, 4);
      }
      break;

    case 13: // Bombable Wall or Rock (disguised as normal rock or wall)
      if (isDungeon) {
        ctx.fillStyle = DUNGEON_WALL;
        ctx.fillRect(x, y, 16, 16);
        ctx.fillStyle = DUNGEON_WALL_LIGHT;
        ctx.fillRect(x + 1, y + 1, 14, 2);
        ctx.fillRect(x + 1, y + 1, 2, 14);
        ctx.fillStyle = BLACK;
        ctx.fillRect(x + 14, y + 1, 2, 15);
        ctx.fillRect(x + 1, y + 14, 15, 2);
        ctx.fillRect(x + 7, y + 6, 2, 4); // Hairline fracture
      } else {
        ctx.fillStyle = OVERWORLD_ROCK;
        ctx.fillRect(x, y, 16, 16);
        ctx.fillStyle = OVERWORLD_ROCK_LIGHT;
        ctx.fillRect(x + 1, y + 1, 14, 4);
        ctx.fillStyle = BLACK;
        ctx.fillRect(x + 14, y + 1, 2, 15);
        ctx.fillRect(x, y + 14, 16, 2);
        ctx.fillRect(x + 7, y + 6, 2, 4); // Fissure
      }
      break;

    case 15: // Secret Stairs
      ctx.fillStyle = BLACK;
      ctx.fillRect(x, y, 16, 16);
      ctx.fillStyle = isDungeon ? DUNGEON_WALL_LIGHT : OVERWORLD_GROUND;
      ctx.fillRect(x + 2, y + 2, 12, 2);
      ctx.fillRect(x + 3, y + 6, 10, 2);
      ctx.fillRect(x + 5, y + 10, 6, 2);
      ctx.fillRect(x + 7, y + 13, 2, 2);
      break;

    case 16: // Blown-open Bomb Hole Passage
      ctx.fillStyle = isDungeon ? DUNGEON_WALL : OVERWORLD_ROCK;
      ctx.fillRect(x, y, 16, 16);
      ctx.fillStyle = BLACK;
      ctx.fillRect(x + 2, y + 2, 12, 12);
      ctx.fillRect(x + 1, y + 4, 14, 8);
      break;

    case 17: // Ancient Fissured Rock / Secret Strikeable Wall
      if (isDungeon) {
        ctx.fillStyle = DUNGEON_WALL;
        ctx.fillRect(x, y, 16, 16);
        ctx.fillStyle = DUNGEON_WALL_LIGHT;
        ctx.fillRect(x + 1, y + 1, 14, 2);
        ctx.fillRect(x + 1, y + 1, 2, 14);
        ctx.fillStyle = BLACK;
        ctx.fillRect(x + 14, y + 1, 2, 15);
        ctx.fillRect(x + 1, y + 14, 15, 2);
        // Hollow acoustic chamber mark
        ctx.fillStyle = DUNGEON_WALL_LIGHT;
        ctx.fillRect(x + 6, y + 5, 4, 6);
        ctx.fillStyle = BLACK;
        ctx.fillRect(x + 7, y + 6, 2, 4);
      } else {
        ctx.fillStyle = OVERWORLD_ROCK;
        ctx.fillRect(x, y, 16, 16);
        ctx.fillStyle = OVERWORLD_ROCK_LIGHT;
        ctx.fillRect(x + 1, y + 1, 14, 4);
        ctx.fillStyle = BLACK;
        ctx.fillRect(x + 14, y + 1, 2, 15);
        ctx.fillRect(x, y + 14, 16, 2);
        // Subtle fissure in the cliff rock
        ctx.fillRect(x + 6, y + 4, 2, 6);
        ctx.fillRect(x + 8, y + 8, 3, 2);
      }
      break;

    case 6: // Dungeon Floor
      ctx.fillStyle = DUNGEON_FLOOR;
      ctx.fillRect(x, y, 16, 16);
      ctx.fillStyle = DUNGEON_WALL;
      ctx.fillRect(x, y, 16, 1);
      ctx.fillRect(x, y, 1, 16);
      break;

    case 7: // Door Top
    case 8: // Door Bottom
    case 9: // Door Left
    case 10: // Door Right
      ctx.fillStyle = DUNGEON_FLOOR;
      ctx.fillRect(x, y, 16, 16);
      break;

    case 11: // Sand Path
      ctx.fillStyle = '#D8B878';
      ctx.fillRect(x, y, 16, 16);
      break;

    case 18: // Graveyard Tombstone / Headstone
      // Pale cemetery soil underneath
      ctx.fillStyle = '#C8B070';
      ctx.fillRect(x, y, 16, 16);
      // Stone headstone silhouette
      ctx.fillStyle = NES_COLORS.DARK_GRAY;
      ctx.fillRect(x + 2, y + 13, 12, 2); // shadow/base
      ctx.fillStyle = '#888888';
      ctx.fillRect(x + 3, y + 3, 10, 10);
      ctx.fillRect(x + 5, y + 1, 6, 2);
      // Top bevel highlight
      ctx.fillStyle = NES_COLORS.WHITE;
      ctx.fillRect(x + 5, y + 1, 6, 1);
      ctx.fillRect(x + 3, y + 3, 2, 9);
      // Engraved cross & right shadow border
      ctx.fillStyle = BLACK;
      ctx.fillRect(x + 12, y + 3, 1, 10);
      ctx.fillRect(x + 3, y + 13, 10, 1);
      ctx.fillRect(x + 7, y + 5, 2, 6);
      ctx.fillRect(x + 5, y + 6, 6, 2);
      break;

    case 19: // Locked Boss Shutter Gate with Triforce Seal
      ctx.fillStyle = BLACK;
      ctx.fillRect(x, y, 16, 16);
      // Outer steel shutter frame
      ctx.fillStyle = isDungeon ? DUNGEON_WALL : OVERWORLD_ROCK;
      ctx.fillRect(x, y, 16, 2);
      ctx.fillRect(x, y + 14, 16, 2);
      ctx.fillRect(x, y, 2, 16);
      ctx.fillRect(x + 14, y, 2, 16);
      // Vertical iron shutter bars
      ctx.fillStyle = isDungeon ? DUNGEON_WALL_LIGHT : NES_COLORS.GRAY;
      ctx.fillRect(x + 3, y + 2, 2, 12);
      ctx.fillRect(x + 7, y + 2, 2, 12);
      ctx.fillRect(x + 11, y + 2, 2, 12);
      // Horizontal locking crossbar
      ctx.fillStyle = NES_COLORS.GRAY;
      ctx.fillRect(x + 2, y + 7, 12, 2);
      // Glowing golden Triforce lock crest
      ctx.fillStyle = animTick % 2 === 0 ? NES_COLORS.GOLD : WHITE;
      ctx.fillRect(x + 7, y + 5, 2, 2);
      ctx.fillRect(x + 6, y + 7, 4, 3);
      break;

    default:
      ctx.fillStyle = isDungeon ? DUNGEON_FLOOR : OVERWORLD_GROUND;
      ctx.fillRect(x, y, 16, 16);
      break;
  }
}
