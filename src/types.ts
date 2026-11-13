/**
 * The Legend of Zelda NES - Core Type Definitions
 */

export enum Direction {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
}

export enum GameState {
  TITLE = 'TITLE',
  FILE_SELECT = 'FILE_SELECT',
  REGISTER_NAME = 'REGISTER_NAME',
  PLAYING = 'PLAYING',
  INVENTORY_PAUSE = 'INVENTORY_PAUSE',
  TRANSITIONING = 'TRANSITIONING',
  CAVE = 'CAVE',
  DYING = 'DYING',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY',
}

export enum WeatherType {
  CLEAR = 'CLEAR',
  RAIN = 'RAIN',
  STORM = 'STORM',
}

export type TransitionMode = 'fade' | 'slide' | 'iris' | 'tile_flip' | 'wipe';

export interface WeatherState {
  type: WeatherType;
  intensity: number; // 0 (clear) to 1.0 (heavy downpour / thunderstorm)
  targetIntensity: number;
  windSpeed: number; // horizontal slant
  lightningFlash: number; // 0 to 1.0 full-canvas flash
  isOutdoor: boolean;
}

export enum ItemType {
  NONE = 'NONE',
  SWORD_WOOD = 'SWORD_WOOD',
  SWORD_WHITE = 'SWORD_WHITE',
  SWORD_MAGICAL = 'SWORD_MAGICAL',
  BOOMERANG = 'BOOMERANG',
  BOOMERANG_MAGICAL = 'BOOMERANG_MAGICAL',
  BOMB = 'BOMB',
  BOW = 'BOW',
  CANDLE_BLUE = 'CANDLE_BLUE',
  CANDLE_RED = 'CANDLE_RED',
  POTION_BLUE = 'POTION_BLUE',
  POTION_RED = 'POTION_RED',
  RECORDER = 'RECORDER',
  MAGICAL_ROD = 'MAGICAL_ROD',
  MAGICAL_SHIELD = 'MAGICAL_SHIELD',
  POWER_BRACELET = 'POWER_BRACELET',
  FOOD = 'FOOD',
  STEPPING_LADDER = 'STEPPING_LADDER',
  BLUE_RING = 'BLUE_RING',
  RED_RING = 'RED_RING',
  FAIRY = 'FAIRY',
  KEY = 'KEY',
  RUPEE = 'RUPEE',
  RUPEE_FIVE = 'RUPEE_FIVE',
  HEART = 'HEART',
  HEART_CONTAINER = 'HEART_CONTAINER',
  TRIFORCE = 'TRIFORCE',
  CLOCK = 'CLOCK',
  COMPASS = 'COMPASS',
  DUNGEON_MAP = 'DUNGEON_MAP',
}

export enum EnemyType {
  OCTOROK_RED = 'OCTOROK_RED',
  OCTOROK_BLUE = 'OCTOROK_BLUE',
  TEKTITE_RED = 'TEKTITE_RED',
  MOBLIN_RED = 'MOBLIN_RED',
  MOBLIN_BLUE = 'MOBLIN_BLUE',
  GORIYA_RED = 'GORIYA_RED',
  KEESE = 'KEESE',
  STALFOS = 'STALFOS',
  DARKNUT_RED = 'DARKNUT_RED',
  DARKNUT_BLUE = 'DARKNUT_BLUE',
  ROPE = 'ROPE',                 // Charging snake
  ZOL = 'ZOL',                   // Splitting dungeon slime
  GEL = 'GEL',                   // Fast mini hopping slime
  BLADE_TRAP = 'BLADE_TRAP',     // Rapid sliding cross-room trap
  LIKE_LIKE = 'LIKE_LIKE',       // Shield-eating pulsating monster
  WIZZROBE_RED = 'WIZZROBE_RED', // Teleporting magic sorcerer
  AQUAMENTUS = 'AQUAMENTUS',     // Boss of Level 1
  DODONGO = 'DODONGO',           // Boss of Level 2
  MANHANDLA = 'MANHANDLA',       // Boss of Level 3
  LEEVER_RED = 'LEEVER_RED',     // Overworld burrower
  PEAHAT = 'PEAHAT',             // Overworld spinner
  ARMOS = 'ARMOS',               // Animated statue
  GHINI = 'GHINI',               // Graveyard ghost (statue until touched, sword-immune)
}

export type EnemyBehaviorState = 'patrol' | 'chase' | 'flee' | 'attack' | 'windup';

export type PatrolPatternType = 'horizontal' | 'vertical' | 'cardinal';

export interface EnemyPatrolConfig {
  pattern: PatrolPatternType;
  originX: number;
  originY: number;
  range: number;
  pauseTimer: number;
  passCount: number;
}

export interface Vector2D {
  x: number;
  y: number;
}

export interface PlayerState {
  x: number;
  y: number;
  dir: Direction;
  moving: boolean;
  isAttacking: boolean;
  attackTimer: number;
  animFrame: number;
  animTimer: number;
  hearts: number; // 1 heart = 2 half-hearts
  maxHearts: number;
  swordTier: number; // 0: None, 1: Wood, 2: White, 3: Magical
  bItem: ItemType;
  hasShield?: boolean;
  shieldTier?: number; // 0: None, 1: Wood Shield, 2: Magical Shield
  hasMagicalShield?: boolean;
  hasSteppingLadder?: boolean;
  hasBlueRing?: boolean;
  hasRedRing?: boolean;
  ringTier?: number; // 0: None (Green), 1: Blue (-50% damage), 2: Red (-75% damage)
  inventory: {
    hasSword: boolean;
    hasBoomerang: boolean;
    hasMagicalBoomerang?: boolean;
    hasBow: boolean;
    hasCandle: boolean;
    hasBlueCandle?: boolean;
    hasRedCandle?: boolean;
    hasRecorder?: boolean;
    hasMagicalRod?: boolean;
    hasShield?: boolean;
    hasMagicalShield?: boolean;
    hasPowerBracelet?: boolean;
    hasSteppingLadder?: boolean;
    hasFood?: boolean;
    ringTier?: number;
    hasBlueRing?: boolean;
    hasRedRing?: boolean;
    potionTier?: number; // 0: None, 1: Blue, 2: Red
    hasCompass: boolean;
    hasDungeonMap: boolean;
    rupees: number;
    bombs: number;
    keys: number;
    triforcePieces: number;
  };
  invincibleTimer: number;
  knockback: { x: number; y: number; duration: number } | null;
  isHoldingItem: boolean;
  heldItemType: ItemType | null;
  heldItemTimer: number;
}

export interface Projectile {
  id: string;
  type: 'sword_beam' | 'rock' | 'arrow' | 'bomb' | 'fireball' | 'boomerang' | 'flame' | 'magic_wave';
  x: number;
  y: number;
  vx: number;
  vy: number;
  dir: Direction;
  timer: number;
  owner: 'player' | 'enemy';
  active: boolean;
  damage: number;
  originX?: number;
  originY?: number;
  customData?: Record<string, any>;
}

export interface BombObject {
  id: string;
  x: number;
  y: number;
  fuseTimer: number;
  exploded: boolean;
  explodeTimer: number;
}

export interface Enemy {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  dir: Direction;
  health: number;
  maxHealth: number;
  speed: number;
  animFrame: number;
  animTimer: number;
  actionTimer: number;
  isHurt: boolean;
  hurtTimer: number;
  isStunned: boolean;
  stunTimer: number;
  isDead: boolean;
  deathTimer: number;
  dropItem?: ItemType;
  shootTimer?: number;
  customData?: Record<string, any>;
  // Complex & Basic Enemy State Machine
  behaviorState?: EnemyBehaviorState;
  behaviorTimer?: number;
  patrolDir?: Direction;
  alertTimer?: number;
  fleeTimer?: number;
  lungeTimer?: number;
  stuckCounter?: number;
  patrolConfig?: EnemyPatrolConfig;
  attackCooldown?: number;
  attackWindupTimer?: number;
  jumpYOffset?: number;
}

export interface PickupItem {
  id: string;
  type: ItemType;
  x: number;
  y: number;
  amount: number;
  timer: number; // Disappears after duration
  spawnTimer?: number; // Poof pop entrance animation timer
  customData?: Record<string, any>;
}

export interface SecretTrigger {
  id: string;
  type: 'bomb' | 'push' | 'sword' | 'burn';
  row: number;
  col: number;
  pairedTiles?: Array<{ row: number; col: number }>; // Multi-tile wall openings (e.g. 2-tile passages)
  pushDir?: Direction;
  swordHitsRequired?: number; // Number of sword strikes required to reveal (default 1)
  hits?: number;
  requireClearedEnemies?: boolean;
  revealTile: number; // 4: Cave Entrance, 15: Secret Stairs, 16: Bomb Hole, 0: Floor
  blockMoveDir?: Direction;
  exitDir?: 'up' | 'down' | 'left' | 'right' | 'cave'; // Edge exit to unlock when opened
  allowPush?: boolean; // Allow revealing by pushing against the wall/block
  allowBomb?: boolean; // Allow revealing by bombing the wall/block
  linkedSecretId?: string; // Paired secret on the opposite side of a shared shortcut wall
  isShortcut?: boolean; // True when opening a shortcut passage between dungeon rooms
  targetScreenId?: string;
  targetX?: number;
  targetY?: number;
  targetDir?: Direction;
  hintText?: string;
}

export interface ScreenData {
  id: string; // e.g. "O7_7" for overworld or "D1_1" for dungeon
  name: string;
  type: 'overworld' | 'dungeon' | 'cave';
  levelNumber?: number;
  tiles: number[][]; // 11 rows x 16 columns of 16x16 tiles
  doors?: {
    up?: 'open' | 'locked' | 'wall' | 'shutter';
    down?: 'open' | 'locked' | 'wall' | 'shutter';
    left?: 'open' | 'locked' | 'wall' | 'shutter';
    right?: 'open' | 'locked' | 'wall' | 'shutter';
  };
  exits: {
    up?: string;
    down?: string;
    left?: string;
    right?: string;
    cave?: string;
    dungeon?: string;
  };
  enemies: Array<{ type: EnemyType; x: number; y: number }>;
  caveText?: string;
  caveItem?: ItemType;
  shopItems?: Array<{
    id: string;
    type: ItemType;
    price: number;
    x: number;
    y: number;
  }>;
  gamblePots?: Array<{
    id: string;
    amount: number;
    revealed: boolean;
    x: number;
    y: number;
  }>;
  music: 'overworld' | 'dungeon' | 'cave';
  clearedEnemies?: boolean;
  secretRevealed?: boolean;
  secrets?: SecretTrigger[];
}

export interface SaveSlotData {
  id: number;
  name: string;
  hearts: number;
  maxHearts: number;
  rupees: number;
  bombs: number;
  keys: number;
  swordTier: number;
  hasBoomerang: boolean;
  hasMagicalBoomerang?: boolean;
  hasBow: boolean;
  hasCandle: boolean;
  hasRedCandle?: boolean;
  hasRecorder?: boolean;
  hasMagicalRod?: boolean;
  hasShield?: boolean;
  hasMagicalShield?: boolean;
  hasPowerBracelet?: boolean;
  hasSteppingLadder?: boolean;
  hasFood?: boolean;
  ringTier?: number;
  hasBlueRing?: boolean;
  hasRedRing?: boolean;
  potionTier?: number;
  hasCompass: boolean;
  hasDungeonMap: boolean;
  triforcePieces: number;
  deaths: number;
  currentScreen: string;
  visitedScreens?: string[];
  timestamp: number;
}
