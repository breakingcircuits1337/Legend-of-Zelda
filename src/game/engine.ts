/**
 * The Legend of Zelda NES - 60 FPS Fixed-Timestep Core Engine
 */

import {
  Direction,
  GameState,
  PlayerState,
  Enemy,
  EnemyType,
  Projectile,
  BombObject,
  PickupItem,
  ScreenData,
  ItemType,
  SaveSlotData,
  SecretTrigger,
  WeatherType,
  WeatherState,
  TransitionMode,
} from '../types';
import { ALL_SCREENS } from './worldData';
import {
  drawLink,
  drawEnemy,
  drawItem,
  drawProjectile,
  drawTile,
  drawOldMan,
  drawTorch,
  NES_COLORS,
  DEATH_PALETTES,
  LinkPalette,
} from './sprites';
import { chiptune } from '../audio/chiptune';
import { saveGameProgress } from './saveSystem';
import { ParticleSystem } from './particles';
import { WeatherController } from './weather';
import { OldManNPC } from './oldMan';
import { getPlayerOverworldLocation } from '../components/OverworldMinimap';
import {
  getScreenEntryTriggerVolumes,
  computeTriggerWarpPoint,
  EntryTriggerVolume,
  TriggerDryRunResult,
  TriggerOrientationDir,
} from './entryTriggerDebug';
import {
  isComplexEnemy,
  initEnemyBehavior,
  updateComplexEnemyAI,
  isDarknutShieldBlocking,
  setFleeState,
  isBasicEnemy,
  updateBasicEnemyAI,
  OctorokEnemy,
  RockProjectileData,
  StalfosEnemy,
  GoriyaEnemy,
  BoomerangProjectileData,
  KeeseEnemy,
  LeeverEnemy,
  DarknutEnemy,
  GelEnemy,
  PeahatEnemy,
  WizzrobeEnemy,
  MagicProjectileData,
  GhiniEnemy,
  GhiniAttackSource,
  LikeLikeEnemy,
} from './enemyAI';
import {
  detectPushableSecretAt,
  detectBombableSecretsInBlast,
  detectHollowWallAt,
  applySecretDiscoveryToScreen,
  recordSecretDiscoveryInVisitedMap,
  getSecretTilePositions,
} from './secretWallDetector';
import {
  ABSOLUTE_MAX_HEARTS,
  BASE_MAX_HEARTS,
  applyHeartContainerUpgrade,
  getBossHeartContainerId,
  getCaveHeartContainerId,
  getSpawnableHeartContainersForScreen,
} from './heartContainerSystem';
import {
  canFireSwordBeam,
  createSwordBeamProjectile,
  isPlayerAtFullHealth,
  isProjectileSolidTile,
} from './swordBeam';
import {
  applyGuardedNudge,
  canOccupyScreenBounds,
  canStepToTilePosition,
  checkGridTileCollision,
  findNearestWalkablePosition,
  PLAYER_HITBOX_SIZE,
  stepKnockbackSafe,
} from './playerCollision';
import { unlockBestiaryEntry } from './bestiary';
import {
  applyBossGateState,
  applyTriforcePieceCollection,
  getBossBattleByEnemyType,
  getBossBattleByScreenId,
  getTriforceByScreenId,
  normalizeTriforceIds,
  TOTAL_TRIFORCE_PIECES,
} from './bossTriforceSystem';

export const SCREEN_WIDTH = 256;
export const SCREEN_HEIGHT = 176;
export const TILE_SIZE = 16;
export const FIXED_TIMESTEP = 1000 / 60; // 16.666 ms for rock-solid 60 FPS

export interface PlayerDeathState {
  active: boolean;
  timer: number;
  phase: 'spin' | 'explode' | 'fade';
  spinDir: Direction;
  spinStep: number;
  paletteIndex: number;
  fadeAlpha: number;
}

export class GameEngine {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;

  public activeSlot: SaveSlotData | null = null;
  public gameState: GameState = GameState.FILE_SELECT;
  private screens = structuredClone(ALL_SCREENS);
  public currentScreen: ScreenData = this.screens.O7_7;
  public prevScreen: ScreenData | null = null;

  // Camera transition state
  public transition = {
    active: false,
    dir: Direction.RIGHT,
    progress: 0, // 0 to 1
    targetScreenId: '',
  };

  // Screen transition state (supports fade, iris-in/out, tile-flip mosaic, and curtain wipe)
  public fade = {
    active: false,
    opacity: 0, // 0 = transparent, 1 = solid covered screen
    phase: 'none' as 'in' | 'out' | 'none',
    speed: 0.05,
    targetScreenId: '',
    targetX: 120,
    targetY: 112,
    targetDir: undefined as Direction | undefined,
    onPeak: undefined as (() => void) | undefined,
    onComplete: undefined as (() => void) | undefined,
    mode: 'fade' as TransitionMode,
    originX: 128,
    originY: 88,
  };

  // Screen transition mode: 'fade' | 'iris' | 'tile_flip' | 'wipe' | 'slide'
  public transitionMode: TransitionMode = 'fade';

  // Debug overlay toggle: highlights collision bounding rectangles of player and enemies
  public showHitboxDebug: boolean = false;

  // Temporary visual debug overlay: highlights invisible entry/exit/secret trigger volumes on screen
  public showEntryTriggerDebug: boolean = false;
  public debugTriggerValidation: TriggerDryRunResult | null = null;

  // Particle & Combat FX System
  public particles: ParticleSystem = new ParticleSystem();
  private screenShakeTimer: number = 0;
  private screenShakeIntensity: number = 0;

  // Custom 8-bit Player Death State (Spinning animation, particle explosion, fade transition)
  public playerDeathState: PlayerDeathState = {
    active: false,
    timer: 0,
    phase: 'spin',
    spinDir: Direction.DOWN,
    spinStep: 0,
    paletteIndex: 0,
    fadeAlpha: 0,
  };

  // Global Weather Controller (Overworld 8-bit rain particle effect, ambient sounds, lightning)
  public weather: WeatherController = new WeatherController();

  // Old Man Cave Hermit NPC (Iconic 8-bit text engine, dialogue, and item gift triggers)
  public oldMan: OldManNPC | null = null;

  public triggerScreenShake(duration: number, intensity: number = 1) {
    this.screenShakeTimer = duration;
    this.screenShakeIntensity = intensity;
  }

  // Active Secret Staircase Visual Reveal Animations
  public activeStaircaseReveals: Array<{
    col: number;
    row: number;
    source: 'bush' | 'boulder';
    timer: number;
    maxTimer: number;
  }> = [];

  public triggerSecretStaircaseReveal(
    col: number,
    row: number,
    source: 'bush' | 'boulder' = 'boulder'
  ) {
    this.activeStaircaseReveals.push({
      col,
      row,
      source,
      timer: 48,
      maxTimer: 48,
    });
  }

  // 60 FPS Loop Tracker
  private lastTime: number = 0;
  private accumulator: number = 0;
  private animFrameId: number | null = null;
  public currentFps: number = 60;
  private fpsCounter: number = 0;
  private fpsLastCheck: number = 0;

  // World State
  public player: PlayerState;
  public enemies: Enemy[] = [];
  public projectiles: Projectile[] = [];
  public bombs: BombObject[] = [];
  public pickups: PickupItem[] = [];
  public pendingLootDrops: Array<{
    delay: number;
    x: number;
    y: number;
    type: ItemType;
    amount: number;
    permanent: boolean;
    customData?: Record<string, any>;
  }> = [];
  public killCount: number = 0;
  public clockFreezeTimer: number = 0; // When clock item picked up
  public animTick: number = 0;

  // Secrets & Discovery
  public revealedSecrets: Set<string> = new Set<string>();
  public collectedHeartContainers: Set<string> = new Set<string>();
  public collectedTriforceIds: Set<string> = new Set<string>();
  public defeatedBossRooms: Set<string> = new Set<string>();
  private heartUpgradeBannerTimer: number = 0;
  private heartUpgradeBannerText: string = '';
  private pushTimer: number = 0;
  public candleUsedThisScreen: boolean = false;
  public foodBait: { x: number; y: number; timer: number } | null = null;
  public gambleChosenPot: string | null = null;

  // Controller / Input state
  public input = {
    up: false,
    down: false,
    left: false,
    right: false,
    attack: false,
    item: false,
  };

  private prevAttack: boolean = false;
  private prevItem: boolean = false;

  // Callbacks to UI
  public onStateChange?: (state: GameState) => void;
  public onPlayerUpdate?: (player: PlayerState) => void;
  public onWeatherChange?: (weather: WeatherType) => void;
  public onVisitedScreensChange?: (visited: string[]) => void;

  // Fog-of-War: set of visited screen IDs and coordinates
  public visitedScreens: Set<string> = new Set<string>(['O7_7', '7,7']);

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;

    this.player = this.createDefaultPlayer();
    this.weather.onWeatherChange = (type) => this.onWeatherChange?.(type);
  }

  private createDefaultPlayer(): PlayerState {
    return {
      x: 120,
      y: 112,
      dir: Direction.UP,
      moving: false,
      isAttacking: false,
      attackTimer: 0,
      animFrame: 0,
      animTimer: 0,
      hearts: 6,
      maxHearts: 6,
      swordTier: 0,
      bItem: ItemType.BOMB,
      hasShield: true,
      shieldTier: 1,
      hasMagicalShield: false,
      hasSteppingLadder: false,
      inventory: {
        hasSword: false,
        hasBoomerang: false,
        hasMagicalBoomerang: false,
        hasBow: false,
        hasCandle: false,
        hasBlueCandle: false,
        hasRedCandle: false,
        hasRecorder: false,
        hasMagicalRod: false,
        hasShield: true,
        hasMagicalShield: false,
        hasPowerBracelet: false,
        hasSteppingLadder: false,
        hasFood: false,
        potionTier: 0,
        hasCompass: false,
        hasDungeonMap: false,
        rupees: 5,
        bombs: 4,
        keys: 0,
        triforcePieces: 0,
      },
      invincibleTimer: 0,
      knockback: { x: 0, y: 0, duration: 0 },
      isHoldingItem: false,
      heldItemType: null,
      heldItemTimer: 0,
      collectedHeartContainers: [],
      collectedTriforceIds: [],
      defeatedBossRooms: [],
      unlockedBestiary: [],
      bestiaryDefeatCounts: {},
      deaths: 0,
    };
  }

  public loadSaveSlot(slot: SaveSlotData) {
    this.screens = structuredClone(ALL_SCREENS);
    this.activeSlot = slot;
    const savedMagicalShield = Boolean(slot.hasMagicalShield);
    const savedShield = slot.hasShield !== false || savedMagicalShield;
    const clampedMaxHearts = Math.min(
      ABSOLUTE_MAX_HEARTS,
      Math.max(BASE_MAX_HEARTS, slot.maxHearts || BASE_MAX_HEARTS)
    );
    this.collectedHeartContainers = new Set(slot.collectedHeartContainers || []);
    const restoredTriforceIds = normalizeTriforceIds(
      slot.collectedTriforceIds,
      slot.triforcePieces
    );
    this.collectedTriforceIds = new Set(restoredTriforceIds);
    this.defeatedBossRooms = new Set(slot.defeatedBossRooms || []);

    this.player = {
      ...this.createDefaultPlayer(),
      hearts: slot.hearts > 0 ? Math.min(clampedMaxHearts, slot.hearts) : Math.min(BASE_MAX_HEARTS, clampedMaxHearts),
      ringTier: slot.ringTier ?? 0,
      hasBlueRing: Boolean(slot.hasBlueRing),
      hasRedRing: Boolean(slot.hasRedRing),
      hasSteppingLadder: Boolean(slot.hasSteppingLadder),
      maxHearts: clampedMaxHearts,
      swordTier: slot.swordTier,
      hasShield: savedShield,
      shieldTier: savedMagicalShield ? 2 : savedShield ? 1 : 0,
      hasMagicalShield: savedMagicalShield,
      bItem: slot.hasBoomerang ? ItemType.BOOMERANG : slot.bombs > 0 ? ItemType.BOMB : ItemType.NONE,
      collectedHeartContainers: Array.from(this.collectedHeartContainers),
      collectedTriforceIds: Array.from(this.collectedTriforceIds),
      defeatedBossRooms: Array.from(this.defeatedBossRooms),
      unlockedBestiary: Array.from(new Set(slot.unlockedBestiary || [])),
      bestiaryDefeatCounts: { ...(slot.bestiaryDefeatCounts || {}) },
      deaths: Math.max(0, Number(slot.deaths) || 0),
      inventory: {
        hasMagicalBoomerang: Boolean(slot.hasMagicalBoomerang),
        hasRedCandle: Boolean(slot.hasRedCandle),
        hasRecorder: Boolean(slot.hasRecorder),
        hasMagicalRod: Boolean(slot.hasMagicalRod),
        hasPowerBracelet: Boolean(slot.hasPowerBracelet),
        hasSteppingLadder: Boolean(slot.hasSteppingLadder),
        hasFood: Boolean(slot.hasFood),
        potionTier: slot.potionTier ?? 0,
        hasSword: slot.swordTier > 0,
        hasBoomerang: slot.hasBoomerang,
        hasBow: slot.hasBow,
        hasCandle: slot.hasCandle,
        hasShield: savedShield,
        hasMagicalShield: savedMagicalShield,
        hasCompass: slot.hasCompass,
        hasDungeonMap: slot.hasDungeonMap,
        rupees: slot.rupees,
        bombs: slot.bombs,
        keys: slot.keys,
        triforcePieces: Math.max(slot.triforcePieces || 0, this.collectedTriforceIds.size),
      },
    };

    const startScreen = this.screens[slot.currentScreen] || this.screens.O7_7;
    this.revealedSecrets.clear();
    this.resetFade();

    // Restore explored screens for the 8x8 Overworld & Dungeon fog-of-war system
    if (slot.visitedScreens && slot.visitedScreens.length > 0) {
      this.visitedScreens = new Set(slot.visitedScreens);
      for (const entry of slot.visitedScreens) {
        if (entry.startsWith('secret:')) {
          this.revealedSecrets.add(entry.slice('secret:'.length));
        }
      }
    } else {
      this.visitedScreens = new Set(['O7_7', '7,7', slot.currentScreen]);
    }

    // Backfill legacy secret flags into collectedHeartContainers
    if (this.revealedSecrets.has('claimed_cave_secret_heart')) {
      this.collectedHeartContainers.add('hc_cave_secret_heart');
    }
    if (this.revealedSecrets.has('claimed_fairy_heart')) {
      this.collectedHeartContainers.add('hc_cave_fairy_spring');
    }
    if (this.revealedSecrets.has('claimed_d2_shrine_heart')) {
      this.collectedHeartContainers.add('hc_d2_shrine');
    }
    this.player.collectedHeartContainers = Array.from(this.collectedHeartContainers);

    this.loadScreen(startScreen.id, 120, 112);
    this.gameState = GameState.PLAYING;
    this.onStateChange?.(GameState.PLAYING);
    this.onPlayerUpdate?.(this.player);

    chiptune.playBgm(startScreen.music);
    this.fadeIn(0.04);
  }

  public loadScreen(screenId: string, spawnX: number, spawnY: number) {
    console.log(
      `[GameEngine.loadScreen] >>> Initiating loadScreen: requestedId="${screenId}", requestedCoords=(${spawnX}, ${spawnY}), previousScreen="${this.currentScreen?.id ?? 'none'}"`
    );

    // Validation check: warning if target screen ID passed to loadScreen is undefined or empty
    if (screenId === undefined || screenId === null || typeof screenId === 'undefined' || !screenId) {
      console.warn(
        `[GameEngine.loadScreen] Validation Warning: Target screen ID passed to loadScreen is undefined (${screenId})! Falling back to default overworld screen "O7_7"`
      );
    } else if (!this.screens[screenId]) {
      console.warn(
        `[GameEngine.loadScreen] Validation Warning: Target screen ID "${screenId}" was not found in this.screens! Falling back to default overworld screen "O7_7"`
      );
    }
    const screen: ScreenData = (screenId && this.screens[screenId]) || this.screens.O7_7;
    const targetScreen = screen;
    this.currentScreen = targetScreen;

    // Track physically visited screens for the 8x8 Overworld fog-of-war system
    this.visitedScreens.add(targetScreen.id);
    const overworldLoc = getPlayerOverworldLocation(targetScreen);
    if (overworldLoc) {
      this.visitedScreens.add(`O${overworldLoc.col}_${overworldLoc.row}`);
      this.visitedScreens.add(`${overworldLoc.col},${overworldLoc.row}`);
    }
    this.onVisitedScreensChange?.(Array.from(this.visitedScreens));

    // --- COORDINATE VALIDATION ---
    let validatedX = spawnX;
    let validatedY = spawnY;

    if (typeof validatedX !== 'number' || !Number.isFinite(validatedX)) {
      console.warn(
        `[GameEngine.loadScreen] Invalid/non-finite spawnX received (${spawnX}); defaulting to screen center X (120)`
      );
      validatedX = 120;
    }
    if (typeof validatedY !== 'number' || !Number.isFinite(validatedY)) {
      console.warn(
        `[GameEngine.loadScreen] Invalid/non-finite spawnY received (${spawnY}); defaulting to screen center Y (88)`
      );
      validatedY = 88;
    }

    // Validation check: warning if spawn coordinates are outside the valid 256x176 canvas bounds
    if (
      validatedX < 0 ||
      validatedX > SCREEN_WIDTH ||
      validatedY < 0 ||
      validatedY > SCREEN_HEIGHT
    ) {
      console.warn(
        `[GameEngine.loadScreen] Validation Warning: Coordinates (${validatedX}, ${validatedY}) are outside valid 256x176 canvas bounds!`
      );
    }

    // Safe boundary clamping: prevent player from spawning out of screen or triggering immediate reverse exit
    // Playable bounds: [12, SCREEN_WIDTH - 28], [16, SCREEN_HEIGHT - 32]
    const clampedX = Math.max(12, Math.min(SCREEN_WIDTH - 28, validatedX));
    const clampedY = Math.max(16, Math.min(SCREEN_HEIGHT - 32, validatedY));

    if (clampedX !== validatedX || clampedY !== validatedY) {
      console.log(
        `[GameEngine.loadScreen] Coordinate boundary clamping applied: requested=(${validatedX}, ${validatedY}) -> clamped=(${clampedX}, ${clampedY}) [Screen: ${SCREEN_WIDTH}x${SCREEN_HEIGHT}]`
      );
      validatedX = clampedX;
      validatedY = clampedY;
    }

    this.player.x = validatedX;
    this.player.y = validatedY;

    // Check collision against target screen tiles immediately
    const initialCollision = this.checkTileCollision(this.player.x, this.player.y, 14, 14);
    console.log(
      `[GameEngine.loadScreen] Coordinate validation check on target "${targetScreen.id}": pos=(${this.player.x}, ${this.player.y}), size=14x14, solidTileCollision=${initialCollision}`
    );

    if (initialCollision) {
      console.warn(
        `[GameEngine.loadScreen] Spawn coordinate (${this.player.x}, ${this.player.y}) is inside solid tile(s) on screen "${targetScreen.id}". Executing radial collision unstuck search...`
      );
      let resolved = false;
      const searchOffsets: Array<{ dx: number; dy: number }> = [
        { dx: 0, dy: 8 }, { dx: 0, dy: -8 }, { dx: 8, dy: 0 }, { dx: -8, dy: 0 },
        { dx: 16, dy: 0 }, { dx: -16, dy: 0 }, { dx: 0, dy: 16 }, { dx: 0, dy: -16 },
        { dx: 16, dy: 16 }, { dx: -16, dy: -16 }, { dx: 16, dy: -16 }, { dx: -16, dy: 16 },
        { dx: 24, dy: 0 }, { dx: -24, dy: 0 }, { dx: 0, dy: 24 }, { dx: 0, dy: -24 },
        { dx: 32, dy: 0 }, { dx: -32, dy: 0 }, { dx: 0, dy: 32 }, { dx: 0, dy: -32 },
      ];

      for (const off of searchOffsets) {
        const testX = Math.max(12, Math.min(SCREEN_WIDTH - 28, validatedX + off.dx));
        const testY = Math.max(16, Math.min(SCREEN_HEIGHT - 32, validatedY + off.dy));
        if (!this.checkTileCollision(testX, testY, 14, 14)) {
          console.log(
            `[GameEngine.loadScreen] Collision unstuck successful: adjusted Link coordinates by offset (${off.dx}, ${off.dy}) to safe position (${testX}, ${testY})`
          );
          this.player.x = testX;
          this.player.y = testY;
          resolved = true;
          break;
        }
      }

      if (!resolved) {
        console.warn(
          `[GameEngine.loadScreen] Failed to find adjacent walkable tile near (${validatedX}, ${validatedY}); repositioning to center safe tile (120, 88)`
        );
        this.player.x = 120;
        this.player.y = 88;
      }
    }

    // --- STATE UPDATES ---
    this.player.knockback = { x: 0, y: 0, duration: 0 };
    this.projectiles = [];
    this.bombs = [];
    this.pickups = [];
    this.pendingLootDrops = [];
    this.particles.clear();
    this.pushTimer = 0;
    this.debugTriggerValidation = null;
    chiptune.stopDeathChime();
    this.playerDeathState = {
      active: false,
      timer: 0,
      phase: 'spin',
      spinDir: Direction.DOWN,
      spinStep: 0,
      paletteIndex: 0,
      fadeAlpha: 0,
    };

    console.log(
      `[GameEngine.loadScreen] State update: screen entities reset [projectiles=0, bombs=0, pickups=0, lootDrops=0, particles=cleared, deathState=reset]`
    );

    // Update outdoor weather status for the loaded screen
    const isOutdoor = targetScreen.type === 'overworld';
    this.weather.update(isOutdoor);
    console.log(
      `[GameEngine.loadScreen] State update: weather updated (isOutdoor=${isOutdoor}, screenType="${targetScreen.type}", activeWeather="${this.weather.weatherType}")`
    );

    this.candleUsedThisScreen = false;
    this.gambleChosenPot = null;
    this.activeStaircaseReveals = [];

    // Initialize Old Man NPC if entering a cave screen
    if (targetScreen.type === 'cave') {
      const caveHcId = getCaveHeartContainerId(targetScreen.id);
      const isClaimed =
        this.revealedSecrets.has(`claimed_cave_item_${targetScreen.id}`) ||
        (targetScreen.caveItem === ItemType.SWORD_WOOD &&
          (this.player.swordTier > 0 || this.player.inventory.hasSword)) ||
        (targetScreen.caveItem === ItemType.SWORD_WHITE && this.player.swordTier >= 2) ||
        (caveHcId !== null && this.collectedHeartContainers.has(caveHcId)) ||
        (targetScreen.id === 'C_SECRET_FAIRY_SPRING' &&
          this.revealedSecrets.has('claimed_fairy_heart')) ||
        (targetScreen.id === 'C_SECRET_HEART' &&
          this.revealedSecrets.has('claimed_cave_secret_heart'));

      // Prevent re-buying an already-collected Secret Shop Heart Container
      if (
        targetScreen.id === 'C_SECRET_SHOP' &&
        targetScreen.shopItems &&
        this.collectedHeartContainers.has('hc_shop_secret_heart')
      ) {
        targetScreen.shopItems = targetScreen.shopItems.filter(
          (item) => item.type !== ItemType.HEART_CONTAINER
        );
      }

      this.oldMan = new OldManNPC({
        screenId: targetScreen.id,
        initialMessage: targetScreen.caveText,
        offeredItem: targetScreen.caveItem,
        isItemClaimed: isClaimed,
      });
    } else {
      this.oldMan = null;
    }

    // Apply any previously revealed secrets on this screen
    let secretsAppliedCount = 0;
    if (targetScreen.secrets) {
      for (const secret of targetScreen.secrets) {
        if (this.revealedSecrets.has(secret.id)) {
          this.applySecretToTiles(secret);
          secretsAppliedCount++;
        }
      }
    }
    if (secretsAppliedCount > 0) {
      console.log(
        `[GameEngine.loadScreen] State update: applied ${secretsAppliedCount} previously revealed secret modifications to tiles`
      );
    }

    // Sync Boss Gate state for boss chambers (sealed while boss alive, open once defeated)
    const bossChamberCfg = getBossBattleByScreenId(targetScreen.id);
    const isBossAlreadyDefeated = bossChamberCfg
      ? this.defeatedBossRooms.has(targetScreen.id)
      : false;
    if (bossChamberCfg) {
      applyBossGateState(targetScreen, isBossAlreadyDefeated);
    }

    // Spawn screen enemies (skip already-defeated dungeon bosses)
    const screenEnemies =
      bossChamberCfg && isBossAlreadyDefeated
        ? targetScreen.enemies.filter((e) => e.type !== bossChamberCfg.bossType)
        : targetScreen.enemies;
    this.enemies = screenEnemies.map((e, index) => {
      // Octorok Enemy Subclass instantiation
      if (e.type === EnemyType.OCTOROK_RED || e.type === EnemyType.OCTOROK_BLUE) {
        return new OctorokEnemy({
          id: `enemy_${screenId}_${index}`,
          type: e.type,
          x: e.x,
          y: e.y,
          dir: Direction.DOWN,
        });
      }

      // Stalfos Enemy Subclass instantiation
      if (e.type === EnemyType.STALFOS) {
        return new StalfosEnemy({
          id: `enemy_${screenId}_${index}`,
          x: e.x,
          y: e.y,
        });
      }

      // Goriya Enemy Subclass instantiation
      if (e.type === EnemyType.GORIYA_RED) {
        return new GoriyaEnemy({
          id: `enemy_${screenId}_${index}`,
          x: e.x,
          y: e.y,
        });
      }

      // Keese Enemy Subclass instantiation
      if (e.type === EnemyType.KEESE) {
        return new KeeseEnemy({
          id: `enemy_${screenId}_${index}`,
          x: e.x,
          y: e.y,
        });
      }

      // Leever Enemy Subclass instantiation
      if (e.type === EnemyType.LEEVER_RED) {
        return new LeeverEnemy({
          id: `enemy_${screenId}_${index}`,
          x: e.x,
          y: e.y,
        });
      }

      // Darknut Enemy Subclass instantiation
      if (e.type === EnemyType.DARKNUT_RED || e.type === EnemyType.DARKNUT_BLUE) {
        return new DarknutEnemy({
          id: `enemy_${screenId}_${index}`,
          type: e.type,
          x: e.x,
          y: e.y,
        });
      }

      // Gel Enemy Subclass instantiation
      if (e.type === EnemyType.GEL) {
        return new GelEnemy({
          id: `enemy_${screenId}_${index}`,
          x: e.x,
          y: e.y,
        });
      }

      // Peahat Enemy Subclass instantiation
      if (e.type === EnemyType.PEAHAT) {
        return new PeahatEnemy({
          id: `enemy_${screenId}_${index}`,
          x: e.x,
          y: e.y,
        });
      }

      // Wizzrobe Enemy Subclass instantiation
      if (e.type === EnemyType.WIZZROBE_RED) {
        return new WizzrobeEnemy({
          id: `enemy_${screenId}_${index}`,
          x: e.x,
          y: e.y,
        });
      }

      // Ghini Enemy Subclass instantiation
      if (e.type === EnemyType.GHINI) {
        return new GhiniEnemy({
          id: `enemy_${screenId}_${index}`,
          x: e.x,
          y: e.y,
        });
      }

      // Like Like Enemy Subclass instantiation
      if (e.type === EnemyType.LIKE_LIKE) {
        return new LikeLikeEnemy({
          id: `enemy_${screenId}_${index}`,
          x: e.x,
          y: e.y,
        });
      }

      let hp = 2;
      let speed = 0.8;
      if (e.type === EnemyType.MOBLIN_RED) {
        hp = 3;
        speed = 0.9;
      } else if (e.type === EnemyType.MOBLIN_BLUE) {
        hp = 4;
        speed = 1.0;
      } else if (e.type === EnemyType.AQUAMENTUS) {
        hp = 8;
        speed = 0.3;
      } else if (e.type === EnemyType.DODONGO) {
        hp = 8;
        speed = 0.5;
      } else if (e.type === EnemyType.ARMOS) {
        hp = 3;
        speed = 0.9;
      } else if (e.type === EnemyType.ROPE) {
        hp = 1;
        speed = 0.8;
      } else if (e.type === EnemyType.ZOL) {
        hp = 2;
        speed = 0.5;
      } else if (e.type === EnemyType.BLADE_TRAP) {
        hp = 999;
        speed = 0;
      } else if (e.type === EnemyType.MANHANDLA) {
        hp = 12;
        speed = 0.6;
      }

      const enemyObj: Enemy = {
        id: `enemy_${screenId}_${index}`,
        type: e.type,
        x: e.x,
        y: e.y,
        dir: Direction.DOWN,
        health: hp,
        maxHealth: hp,
        speed,
        animFrame: 0,
        animTimer: 0,
        actionTimer: Math.random() * 60,
        isHurt: false,
        hurtTimer: 0,
        isStunned: false,
        stunTimer: 0,
        isDead: false,
        deathTimer: 0,
        customData: {
          isFlying: false,
          flyTimer: 0,
          isBurrowing: false,
          burrowTimer: 40 + Math.random() * 60,
          isSwollen: false,
          swollenTimer: 0,
          isAwakened: e.type !== EnemyType.ARMOS,
          isCharging: false,
          homeX: e.x,
          homeY: e.y,
          trapState: 'idle',
          trapTimer: 0,
          trapDir: Direction.DOWN,
          phase: 'visible',
          phaseTimer: 100,
          shootTimer: 40,
          jaws: { up: true, down: true, left: true, right: true },
          jawsHp: { up: 3, down: 3, left: 3, right: 3 },
        },
      };

      if (isComplexEnemy(e.type)) {
        initEnemyBehavior(enemyObj);
      }

      return enemyObj;
    });

    // Spawn Cave Wooden Sword if in starting cave and player has no sword yet
    if (screen.id === 'C_START' && this.player.swordTier === 0) {
      this.pickups.push({
        id: 'cave_sword',
        type: ItemType.SWORD_WOOD,
        x: 120,
        y: 80,
        amount: 1,
        timer: 999999,
      });
    }

    // Spawn dungeon Triforce Piece in its altar room if not yet collected
    const triforceCfg = getTriforceByScreenId(screen.id);
    if (triforceCfg && !this.collectedTriforceIds.has(triforceCfg.triforceId)) {
      this.pickups.push({
        id: triforceCfg.triforceId,
        type: ItemType.TRIFORCE,
        x: triforceCfg.triforceSpawn.x,
        y: triforceCfg.triforceSpawn.y,
        amount: 1,
        timer: 999999,
        customData: {
          triforceId: triforceCfg.triforceId,
          level: triforceCfg.level,
          triforceName: triforceCfg.triforceName,
        },
      });
    }

    // Spawn secret discovery room treasures if not already taken
    if (screen.id === 'C_SECRET_RUPEE') {
      this.pickups.push(
        { id: 'sec_rupee_1', type: ItemType.RUPEE_FIVE, x: 120, y: 80, amount: 5, timer: 999999 },
        { id: 'sec_rupee_2', type: ItemType.RUPEE_FIVE, x: 96, y: 80, amount: 5, timer: 999999 },
        { id: 'sec_rupee_3', type: ItemType.RUPEE_FIVE, x: 144, y: 80, amount: 5, timer: 999999 }
      );
    } else if (screen.id === 'D1_SECRET_VAULT') {
      this.pickups.push(
        { id: 'vault_bomb', type: ItemType.BOMB, x: 96, y: 70, amount: 4, timer: 999999 },
        { id: 'vault_rupee', type: ItemType.RUPEE_FIVE, x: 144, y: 70, amount: 5, timer: 999999 }
      );
    } else if (screen.id === 'D1_SECRET_ARMORY') {
      this.pickups.push(
        { id: 'armory_bomb', type: ItemType.BOMB, x: 110, y: 80, amount: 4, timer: 999999 },
        { id: 'armory_key', type: ItemType.KEY, x: 140, y: 80, amount: 1, timer: 999999 }
      );
    } else if (screen.id === 'C_SECRET_WHITE_SWORD' && this.player.swordTier < 2) {
      this.pickups.push({
        id: 'sec_white_sword',
        type: ItemType.SWORD_WHITE,
        x: 120,
        y: 80,
        amount: 1,
        timer: 999999,
      });
    } else if (screen.id === 'C_SECRET_FAIRY_SPRING') {
      // Fairy Spring restores full health (Heart Container altar handled cleanly by OldManNPC)
      this.player.hearts = this.player.maxHearts;
    } else if (screen.id === 'D1_SECRET_CHAMBER') {
      this.pickups.push(
        { id: 'chamber_bomb', type: ItemType.BOMB, x: 96, y: 70, amount: 4, timer: 999999 },
        { id: 'chamber_rupee_1', type: ItemType.RUPEE_FIVE, x: 120, y: 70, amount: 5, timer: 999999 },
        { id: 'chamber_rupee_2', type: ItemType.RUPEE_FIVE, x: 144, y: 70, amount: 5, timer: 999999 }
      );
    } else if (screen.id === 'D2_2') {
      if (!this.player.inventory.hasMagicalBoomerang) {
        this.pickups.push({
          id: 'd2_magical_boomerang',
          type: ItemType.BOOMERANG_MAGICAL,
          x: 100,
          y: 75,
          amount: 1,
          timer: 999999,
        });
      }
      if (!this.player.inventory.hasRecorder) {
        this.pickups.push({
          id: 'd2_recorder',
          type: ItemType.RECORDER,
          x: 140,
          y: 75,
          amount: 1,
          timer: 999999,
        });
      }
    } else if (screen.id === 'D3_VAULT' && !this.player.hasRedRing) {
      this.pickups.push({
        id: 'd3_red_ring',
        type: ItemType.RED_RING,
        x: 120,
        y: 75,
        amount: 1,
        timer: 999999,
      });
    } else if (screen.id === 'D2_SECRET_SHRINE') {
      this.pickups.push({
        id: 'd2_shrine_bombs',
        type: ItemType.BOMB,
        x: 88,
        y: 88,
        amount: 4,
        timer: 999999,
      });
    } else if (screen.id === 'D3_SECRET_PASSAGE') {
      this.pickups.push(
        { id: 'd3_passage_rupee', type: ItemType.RUPEE_FIVE, x: 104, y: 80, amount: 5, timer: 999999 },
        { id: 'd3_passage_key', type: ItemType.KEY, x: 140, y: 80, amount: 1, timer: 999999 }
      );
    }

    // Spawn any uncollected overworld or dungeon Heart Container pickups mapped to this screen
    const worldHeartContainers = getSpawnableHeartContainersForScreen(
      screen.id,
      this.collectedHeartContainers
    );
    if (worldHeartContainers.length > 0) {
      this.pickups.push(...worldHeartContainers);
    }

    chiptune.playBgm(targetScreen.music);
    console.log(
      `[GameEngine.loadScreen] State update: BGM started track="${targetScreen.music}"`
    );

    // Final safety collision check
    if (this.checkTileCollision(this.player.x, this.player.y, 14, 14)) {
      console.warn(
        `[GameEngine.loadScreen] Collision detected after spawn at (${this.player.x}, ${this.player.y}) on screen "${targetScreen.id}". Nudging Link to safe center position (120, 88).`
      );
      this.player.x = 120;
      this.player.y = 88;
    }

    // Validation check: warning if resulting coordinates are outside the valid 256x176 canvas bounds
    if (
      this.player.x < 0 ||
      this.player.x > SCREEN_WIDTH ||
      this.player.y < 0 ||
      this.player.y > SCREEN_HEIGHT
    ) {
      console.warn(
        `[GameEngine.loadScreen] Validation Warning: Resulting coordinates (${this.player.x}, ${this.player.y}) are outside the valid 256x176 canvas bounds! [SCREEN_WIDTH=${SCREEN_WIDTH}, SCREEN_HEIGHT=${SCREEN_HEIGHT}]`
      );
    }

    this.onPlayerUpdate?.(this.player);

    console.log(
      `[GameEngine.loadScreen] <<< loadScreen execution completed successfully for "${targetScreen.id}" ("${targetScreen.name}"). Link final position: (${this.player.x}, ${this.player.y}), hearts: ${this.player.hearts}/${this.player.maxHearts}, enemies: ${this.enemies.length}, pickups: ${this.pickups.length}, gameState: ${this.gameState}`
    );
  }

  // --- 60 FPS MAIN LOOP ---

  public start() {
    if (this.animFrameId) return;
    this.lastTime = performance.now();
    this.fpsLastCheck = this.lastTime;
    this.loop(this.lastTime);
  }

  public stop() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private loop = (currentTime: number) => {
    this.animFrameId = requestAnimationFrame(this.loop);

    const delta = currentTime - this.lastTime;
    this.lastTime = currentTime;

    // FPS measurement
    this.fpsCounter++;
    if (currentTime - this.fpsLastCheck >= 1000) {
      this.currentFps = this.fpsCounter;
      this.fpsCounter = 0;
      this.fpsLastCheck = currentTime;
    }

    // Accumulator for exact 60fps physics simulation
    this.accumulator += Math.min(delta, 100); // Guard against giant delta on tab switch

    while (this.accumulator >= FIXED_TIMESTEP) {
      this.updatePhysics();
      this.accumulator -= FIXED_TIMESTEP;
    }

    this.render();
  };

  // --- PHYSICS & GAME LOGIC (60 TICKS/SEC) ---

  private updatePhysics() {
    this.animTick++;
    if (this.heartUpgradeBannerTimer > 0) {
      this.heartUpgradeBannerTimer--;
    }

    // Global weather controller: updates outdoor rain particles, ambient 2A03 chiptune, and lightning
    const isOutdoor = this.currentScreen && this.currentScreen.type === 'overworld';
    this.weather.update(isOutdoor);

    if (this.fade.active) {
      this.updateFade();
      if (this.gameState === GameState.TRANSITIONING) {
        return;
      }
    } else if (this.gameState === GameState.TRANSITIONING) {
      this.updateTransition();
      return;
    }

    if (this.gameState === GameState.DYING) {
      this.updatePlayerDeath();
      return;
    }

    if (this.gameState !== GameState.PLAYING) {
      return;
    }

    // Handle Link holding item animation (sword or triforce fanfare)
    if (this.player.isHoldingItem) {
      this.player.heldItemTimer--;
      if (this.player.heldItemTimer <= 0) {
        this.player.isHoldingItem = false;
        const collectedTriforce = this.player.heldItemType === ItemType.TRIFORCE;
        this.player.heldItemType = null;
        if (collectedTriforce && getTriforceByScreenId(this.currentScreen.id)) {
          // Triforce shard recovered!
          this.gameState = GameState.VICTORY;
          this.onStateChange?.(GameState.VICTORY);
        }
      }
      return;
    }

    this.updatePlayerMovement();
    this.updatePlayerActions();
    this.updateProjectiles();
    this.updateBombs();
    this.updatePickups();
    this.updateShopAndGamble();
    this.updateOldManNPC();

    if (this.clockFreezeTimer > 0) {
      this.clockFreezeTimer--;
    } else {
      this.updateEnemies();
    }

    // Update combat particles & screen shake physics
    this.particles.update();
    if (this.screenShakeTimer > 0) {
      this.screenShakeTimer--;
    }

    // Update active secret staircase visual reveal animations
    for (let i = this.activeStaircaseReveals.length - 1; i >= 0; i--) {
      const anim = this.activeStaircaseReveals[i];
      anim.timer--;
      if (anim.timer <= 0) {
        this.activeStaircaseReveals.splice(i, 1);
      }
    }

    this.checkScreenTransitions();
  }

  private updatePlayerMovement() {
    const p = this.player;

    // Handle knockback when damaged without clipping through walls, water, or blocks
    if (p.knockback && p.knockback.duration > 0) {
      const kbResult = stepKnockbackSafe(
        this.currentScreen.tiles,
        p.x,
        p.y,
        p.knockback.x,
        p.knockback.y,
        SCREEN_WIDTH,
        SCREEN_HEIGHT,
        PLAYER_HITBOX_SIZE,
        PLAYER_HITBOX_SIZE
      );
      p.x = kbResult.x;
      p.y = kbResult.y;
      if (kbResult.blockedX) p.knockback.x = 0;
      if (kbResult.blockedY) p.knockback.y = 0;
      p.knockback.duration--;
      return;
    }

    // Immediate depenetration safeguard: if Link is overlapping any solid asset, ease to nearest walkable spot
    if (this.checkTileCollision(p.x, p.y, PLAYER_HITBOX_SIZE, PLAYER_HITBOX_SIZE)) {
      const unstuck = findNearestWalkablePosition(
        this.currentScreen.tiles,
        p.x,
        p.y,
        SCREEN_WIDTH,
        SCREEN_HEIGHT,
        PLAYER_HITBOX_SIZE,
        PLAYER_HITBOX_SIZE,
        16
      );
      if (unstuck) {
        p.x = unstuck.x;
        p.y = unstuck.y;
      }
    }

    if (p.invincibleTimer > 0) {
      p.invincibleTimer--;
    }

    if (p.isAttacking) {
      p.attackTimer--;
      if (p.attackTimer <= 0) {
        p.isAttacking = false;
      }
      return; // Cannot move while thrusting sword
    }

    let dx = 0;
    let dy = 0;
    const speed = 1.5; // Classic NES Link movement speed

    if (this.input.up) {
      dy -= speed;
      p.dir = Direction.UP;
    } else if (this.input.down) {
      dy += speed;
      p.dir = Direction.DOWN;
    } else if (this.input.left) {
      dx -= speed;
      p.dir = Direction.LEFT;
    } else if (this.input.right) {
      dx += speed;
      p.dir = Direction.RIGHT;
    }

    p.moving = dx !== 0 || dy !== 0;

    if (p.moving) {
      p.animTimer++;
      if (p.animTimer > 8) {
        p.animFrame = (p.animFrame + 1) % 2;
        p.animTimer = 0;
      }

      // Half-tile snapping / axis alignment for smooth corner gliding (collision-guarded)
      let nudgeX = 0;
      let nudgeY = 0;
      if (dx !== 0 && Math.abs(dy) === 0) {
        // Moving horizontally -> smooth y to nearest 8px
        const modY = Math.round(p.y) % 8;
        if (modY > 0 && modY <= 3) nudgeY = -0.5;
        else if (modY >= 5) nudgeY = 0.5;
      } else if (dy !== 0 && Math.abs(dx) === 0) {
        // Moving vertically -> smooth x to nearest 8px
        const modX = Math.round(p.x) % 8;
        if (modX > 0 && modX <= 3) nudgeX = -0.5;
        else if (modX >= 5) nudgeX = 0.5;
      }

      // Exit doorway funnel assist: gently align Link into doorway openings without clipping into adjacent solids
      if (dy < 0 && p.y < 32 && this.currentScreen.exits.up) {
        if (p.x < 118 && p.x > 96) nudgeX = 0.5;
        else if (p.x > 122 && p.x < 144) nudgeX = -0.5;
      } else if (dy > 0 && p.y > SCREEN_HEIGHT - 48 && this.currentScreen.exits.down) {
        if (p.x < 118 && p.x > 96) nudgeX = 0.5;
        else if (p.x > 122 && p.x < 144) nudgeX = -0.5;
      } else if (dx < 0 && p.x < 32 && this.currentScreen.exits.left) {
        if (p.y < 86 && p.y > 64) nudgeY = 0.5;
        else if (p.y > 90 && p.y < 112) nudgeY = -0.5;
      } else if (dx > 0 && p.x > SCREEN_WIDTH - 48 && this.currentScreen.exits.right) {
        if (p.y < 86 && p.y > 64) nudgeY = 0.5;
        else if (p.y > 90 && p.y < 112) nudgeY = -0.5;
      }

      if (nudgeX !== 0 || nudgeY !== 0) {
        const nudged = applyGuardedNudge(
          this.currentScreen.tiles,
          p.x,
          p.y,
          nudgeX,
          nudgeY,
          SCREEN_WIDTH,
          SCREEN_HEIGHT,
          PLAYER_HITBOX_SIZE,
          PLAYER_HITBOX_SIZE
        );
        p.x = nudged.x;
        p.y = nudged.y;
      }

      // Check collision before moving (allows overlap-reducing escape steps if ever overlapping)
      const nextX = p.x + dx;
      const nextY = p.y + dy;

      let movedX = false;
      let movedY = false;

      const { withinX } = canOccupyScreenBounds(
        p.x,
        p.y,
        nextX,
        p.y,
        PLAYER_HITBOX_SIZE,
        PLAYER_HITBOX_SIZE,
        SCREEN_WIDTH,
        SCREEN_HEIGHT
      );
      const { withinY } = canOccupyScreenBounds(
        p.x,
        p.y,
        p.x,
        nextY,
        PLAYER_HITBOX_SIZE,
        PLAYER_HITBOX_SIZE,
        SCREEN_WIDTH,
        SCREEN_HEIGHT
      );

      if (
        withinX &&
        dx !== 0 &&
        canStepToTilePosition(
          this.currentScreen.tiles,
          p.x,
          p.y,
          nextX,
          p.y,
          PLAYER_HITBOX_SIZE,
          PLAYER_HITBOX_SIZE
        )
      ) {
        p.x = nextX;
        movedX = true;
      }
      if (
        withinY &&
        dy !== 0 &&
        canStepToTilePosition(
          this.currentScreen.tiles,
          p.x,
          p.y,
          p.x,
          nextY,
          PLAYER_HITBOX_SIZE,
          PLAYER_HITBOX_SIZE
        )
      ) {
        p.y = nextY;
        movedY = true;
      }

      // If Link is attempting to move in their facing direction and blocked, check for pushable secret!
      if ((dx !== 0 && !movedX) || (dy !== 0 && !movedY)) {
        this.checkBlockPush(p.dir);
      } else {
        this.pushTimer = 0;
      }
    } else {
      this.pushTimer = 0;
    }
  }

  private updatePlayerActions() {
    const p = this.player;

    // A Button (Sword Attack)
    const hasSword = p.swordTier > 0 || p.inventory.hasSword;
    if (this.input.attack && !this.prevAttack && !p.isAttacking && hasSword) {
      p.isAttacking = true;
      p.attackTimer = 12;
      chiptune.playSwordSlash();

      // Sword Beam firing if Link is at full health
      if (isPlayerAtFullHealth(p)) {
        this.fireSwordBeam();
      }

      // Hitbox check in front of Link
      this.checkSwordHit();
    }
    this.prevAttack = this.input.attack;

    // B Button (Secondary Weapon)
    if (this.input.item && !this.prevItem && !p.isAttacking) {
      this.useBItem();
    }
    this.prevItem = this.input.item;
  }

  public fireSwordBeam(): boolean {
    if (!canFireSwordBeam(this.player, this.projectiles)) return false;

    chiptune.playSwordBeam();
    this.projectiles.push(createSwordBeamProjectile(this.player));
    return true;
  }

  private useBItem() {
    const p = this.player;
    if (
      (p.bItem === ItemType.BOOMERANG && p.inventory.hasBoomerang) ||
      (p.bItem === ItemType.BOOMERANG_MAGICAL && p.inventory.hasMagicalBoomerang)
    ) {
      const isMagical = p.bItem === ItemType.BOOMERANG_MAGICAL;
      chiptune.playBoomerang();
      let vx = 0;
      let vy = 0;
      const speed = isMagical ? 4.5 : 3.5;
      if (p.dir === Direction.UP) vy = -speed;
      else if (p.dir === Direction.DOWN) vy = speed;
      else if (p.dir === Direction.LEFT) vx = -speed;
      else if (p.dir === Direction.RIGHT) vx = speed;

      this.projectiles.push({
        id: `boom_${Date.now()}`,
        type: 'boomerang',
        x: p.x,
        y: p.y,
        vx,
        vy,
        dir: p.dir,
        timer: isMagical ? 80 : 45,
        owner: 'player',
        active: true,
        damage: isMagical ? 2 : 1,
        originX: p.x,
        originY: p.y,
      });
    } else if (p.bItem === ItemType.BOMB && p.inventory.bombs > 0) {
      p.inventory.bombs--;
      chiptune.playBombDrop();
      this.bombs.push({
        id: `bomb_${Date.now()}`,
        x: p.x,
        y: p.y,
        fuseTimer: 70,
        exploded: false,
        explodeTimer: 20,
      });
      this.onPlayerUpdate?.(p);
    } else if (p.bItem === ItemType.BOW && p.inventory.hasBow && p.inventory.rupees > 0) {
      p.inventory.rupees--;
      chiptune.playArrowShoot();
      let vx = 0;
      let vy = 0;
      const speed = 4.5;
      if (p.dir === Direction.UP) vy = -speed;
      else if (p.dir === Direction.DOWN) vy = speed;
      else if (p.dir === Direction.LEFT) vx = -speed;
      else if (p.dir === Direction.RIGHT) vx = speed;

      this.projectiles.push({
        id: `arrow_${Date.now()}`,
        type: 'arrow',
        x: p.x,
        y: p.y,
        vx,
        vy,
        dir: p.dir,
        timer: 60,
        owner: 'player',
        active: true,
        damage: 2,
      });
      this.onPlayerUpdate?.(p);
    } else if (
      (p.bItem === ItemType.CANDLE_BLUE && (p.inventory.hasCandle || p.inventory.hasBlueCandle)) ||
      (p.bItem === ItemType.CANDLE_RED && p.inventory.hasRedCandle)
    ) {
      const isRed = p.bItem === ItemType.CANDLE_RED;
      if (!isRed && this.candleUsedThisScreen) return;
      this.candleUsedThisScreen = true;

      chiptune.playFlame();
      let vx = 0;
      let vy = 0;
      const speed = 1.6;
      if (p.dir === Direction.UP) vy = -speed;
      else if (p.dir === Direction.DOWN) vy = speed;
      else if (p.dir === Direction.LEFT) vx = -speed;
      else if (p.dir === Direction.RIGHT) vx = speed;

      this.projectiles.push({
        id: `flame_${Date.now()}`,
        type: 'flame',
        x: p.x,
        y: p.y,
        vx,
        vy,
        dir: p.dir,
        timer: 45,
        owner: 'player',
        active: true,
        damage: 2,
      });
    } else if (p.bItem === ItemType.RECORDER && p.inventory.hasRecorder) {
      chiptune.playWhistle();
      this.triggerScreenShake(4, 1);
      // Whistle stuns all Peahats and reveals secrets on lake
      if (this.currentScreen.id === 'O6_6') {
        this.currentScreen.tiles[3][7] = 0;
        this.currentScreen.tiles[4][7] = 0;
        chiptune.playSecret();
      }
      this.enemies.forEach((e) => {
        if (e instanceof PeahatEnemy) {
          e.isStunned = true;
          e.stunTimer = 180;
          e.isVulnerable = true;
        } else if (e.type === EnemyType.PEAHAT) {
          if (e.customData) e.customData.isFlying = false;
          e.isStunned = true;
          e.stunTimer = 180;
        }
      });
    } else if (p.bItem === ItemType.MAGICAL_ROD && p.inventory.hasMagicalRod) {
      chiptune.playSwordBeam();
      let vx = 0;
      let vy = 0;
      const speed = 4;
      if (p.dir === Direction.UP) vy = -speed;
      else if (p.dir === Direction.DOWN) vy = speed;
      else if (p.dir === Direction.LEFT) vx = -speed;
      else if (p.dir === Direction.RIGHT) vx = speed;

      this.projectiles.push({
        id: `mrod_${Date.now()}`,
        type: 'magic_wave',
        x: p.x,
        y: p.y,
        vx,
        vy,
        dir: p.dir,
        timer: 60,
        owner: 'player',
        active: true,
        damage: 3,
      });
    } else if (
      (p.bItem === ItemType.POTION_BLUE || p.bItem === ItemType.POTION_RED) &&
      (p.inventory.potionTier ?? 0) > 0
    ) {
      p.hearts = p.maxHearts;
      chiptune.playHealPotion();
      if (p.inventory.potionTier === 2) {
        p.inventory.potionTier = 1;
        p.bItem = ItemType.POTION_BLUE;
      } else {
        p.inventory.potionTier = 0;
        p.bItem = ItemType.NONE;
      }
      this.onPlayerUpdate?.(p);
    } else if (p.bItem === ItemType.FOOD && p.inventory.hasFood) {
      chiptune.playItemPoof();
      this.foodBait = { x: p.x, y: p.y, timer: 300 };
      p.inventory.hasFood = false;
      p.bItem = ItemType.NONE;
      this.onPlayerUpdate?.(p);
    }
  }

  private checkSwordHit() {
    const p = this.player;
    let hitX = p.x;
    let hitY = p.y;
    const reach = 16;

    if (p.dir === Direction.UP) hitY -= reach;
    else if (p.dir === Direction.DOWN) hitY += reach;
    else if (p.dir === Direction.LEFT) hitX -= reach;
    else if (p.dir === Direction.RIGHT) hitX += reach;

    // Check sword strike against walls for secret discovery & clink feedback
    let swordTipX = p.x + 8;
    let swordTipY = p.y + 8;
    if (p.dir === Direction.UP) swordTipY -= reach;
    else if (p.dir === Direction.DOWN) swordTipY += reach;
    else if (p.dir === Direction.LEFT) swordTipX -= reach;
    else if (p.dir === Direction.RIGHT) swordTipX += reach;
    this.checkSwordWallStrike(swordTipX, swordTipY, p.dir);

    this.enemies.forEach((enemy) => {
      if (enemy.isDead || (enemy as any).isSubmerged || (enemy as any).isHidden) return;
      const dist = Math.hypot(enemy.x - hitX, enemy.y - hitY);
      if (dist < 16) {
        // Emit directional sword strike sparks and slash crescent glint
        const contactX = (hitX + enemy.x + 8) / 2;
        const contactY = (hitY + enemy.y + 8) / 2;
        this.particles.emitSwordStrike(
          contactX,
          contactY,
          p.dir,
          p.swordTier,
          p.hearts >= p.maxHearts
        );
        this.triggerScreenShake(3, 1);
        this.damageEnemy(enemy, p.swordTier * 2, p.dir, 'sword');
      }
    });
  }

  public checkSwordWallStrike(swordTipX: number, swordTipY: number, dir: Direction) {
    const col = Math.floor(swordTipX / TILE_SIZE);
    const row = Math.floor(swordTipY / TILE_SIZE);

    if (row < 0 || row >= 11 || col < 0 || col >= 16) return;

    const tile = this.currentScreen.tiles[row][col];
    // Solid obstacles / walls: 1 (Tree), 2 (Rock), 5 (Dungeon Wall), 12 (Bush), 13 (Bombable), 14 (Pushable), 17 (Fissured Secret Rock), 18 (Gravestone)
    const isSolid =
      tile === 1 ||
      tile === 2 ||
      tile === 5 ||
      tile === 12 ||
      tile === 13 ||
      tile === 14 ||
      tile === 17 ||
      tile === 18;
    if (!isSolid) return;

    // Probe whether this wall, rock, or bush conceals a secret passage
    const probe = detectHollowWallAt(this.currentScreen, row, col, this.revealedSecrets);

    if (probe.isHollow) {
      // Resonant hollow acoustic chime audio & celestial star spark
      chiptune.playSwordWallClink(true);
      this.particles.emitSwordWallClink(swordTipX, swordTipY, true);

      if (probe.secret && probe.triggersOnSword) {
        probe.secret.hits = (probe.secret.hits || 0) + 1;
        const required = probe.secret.swordHitsRequired ?? 1;

        if (probe.secret.hits >= required) {
          this.revealSecret(probe.secret, probe.secret.type === 'burn' ? 'burn' : 'sword');
        } else {
          // Cracking feedback on multi-hit walls
          this.triggerScreenShake(3, 1);
        }
      }
    } else {
      // Solid wall clink feedback
      chiptune.playSwordWallClink(false);
      this.particles.emitSwordWallClink(swordTipX, swordTipY, false);
    }
  }

  private damageEnemy(
    enemy: Enemy,
    damage: number,
    knockDir: Direction,
    attackSource: GhiniAttackSource = 'sword'
  ) {
    if (enemy.isHurt || enemy.isDead) return;

    // Ghini: dormant statue until touched; once active, immune to standard sword/beam attacks until defeated by secondary items
    if (enemy instanceof GhiniEnemy && !enemy.canBeDamagedBy(attackSource)) {
      chiptune.playShieldDeflect();
      this.particles.emitShieldDeflect(enemy.x + 8, enemy.y + 8, enemy.dir);
      return;
    }

    // Dodongo Thick Hide: deflects sword strikes unless swollen from swallowing a bomb
    if (enemy.type === EnemyType.DODONGO && !enemy.customData?.isSwollen) {
      chiptune.playShieldDeflect();
      this.particles.emitShieldDeflect(enemy.x + 8, enemy.y + 8, enemy.dir);
      return;
    }

    // Peahat: armored shell protects it while stationary/rooted; vulnerable during flight phase
    if (enemy instanceof PeahatEnemy && !enemy.isVulnerable) {
      chiptune.playShieldDeflect();
      this.particles.emitShieldDeflect(enemy.x + 8, enemy.y + 8, enemy.dir);
      return;
    }

    // Armos: striking dormant statue awakens it into active enemy
    if (enemy.type === EnemyType.ARMOS && !enemy.customData?.isAwakened) {
      enemy.customData.isAwakened = true;
      chiptune.playSecret();
      this.particles.emitSwordStrike(enemy.x + 8, enemy.y + 8, knockDir, 1);
      return;
    }

    // Darknut Frontal Shield Mechanics: blocks direct frontal strikes
    if (
      (enemy.type === EnemyType.DARKNUT_RED || enemy.type === EnemyType.DARKNUT_BLUE) &&
      isDarknutShieldBlocking(enemy.dir, knockDir)
    ) {
      chiptune.playShieldDeflect();
      this.particles.emitShieldDeflect(enemy.x + 8, enemy.y + 8, enemy.dir);

      // Deflection recoil without damage
      let rkx = 0;
      let rky = 0;
      if (knockDir === Direction.UP) rky = -4;
      else if (knockDir === Direction.DOWN) rky = 4;
      else if (knockDir === Direction.LEFT) rkx = -4;
      else if (knockDir === Direction.RIGHT) rkx = 4;

      if (!this.checkTileCollision(enemy.x + rkx, enemy.y + rky, 14, 14)) {
        enemy.x += rkx;
        enemy.y += rky;
      }

      // Striking the shield alerts the Darknut into immediate aggressive charge!
      if (enemy instanceof DarknutEnemy) {
        enemy.onShieldBlock(this.player, chiptune);
      } else {
        enemy.behaviorState = 'chase';
        enemy.behaviorTimer = 240;
        enemy.alertTimer = 20;
      }
      return;
    }

    enemy.health -= damage;
    enemy.isHurt = true;
    enemy.hurtTimer = 16;

    // Knockback
    let kx = 0;
    let ky = 0;
    const force = 12;
    if (knockDir === Direction.UP) ky = -force;
    else if (knockDir === Direction.DOWN) ky = force;
    else if (knockDir === Direction.LEFT) kx = -force;
    else if (knockDir === Direction.RIGHT) kx = force;

    if (enemy instanceof GhiniEnemy) {
      enemy.x = Math.max(16, Math.min(224, enemy.x + kx));
      enemy.y = Math.max(16, Math.min(144, enemy.y + ky));
    } else {
      enemy.x += kx;
      enemy.y += ky;
    }

    if (enemy.health <= 0) {
      enemy.isDead = true;
      enemy.deathTimer = 22;
      chiptune.playEnemyDie();
      this.recordEnemyDefeat(enemy.type);

      // Emit enemy defeat particle burst (smoke clouds, shockwave ring, embers, wisps)
      const isBoss =
        enemy.type === EnemyType.AQUAMENTUS ||
        enemy.type === EnemyType.DODONGO ||
        enemy.type === EnemyType.MANHANDLA;
      const centerX = enemy.x + (isBoss ? 16 : 8);
      const centerY = enemy.y + (isBoss ? 16 : 8);
      this.particles.emitEnemyDefeat(centerX, centerY, enemy.type, isBoss);
      this.triggerScreenShake(isBoss ? 12 : 5, isBoss ? 2 : 1);

      // Boss defeated: unlocks Boss Gate to the dungeon's Triforce Chamber
      this.handleBossDefeat(enemy);

      // Zol splits into 2 mini Gel blobs when defeated
      if (enemy.type === EnemyType.ZOL) {
        const offsets = [
          [-8, 0],
          [8, 0],
        ];
        offsets.forEach(([ox, oy], idx) => {
          const gx = Math.max(16, Math.min(224, enemy.x + ox));
          const gy = Math.max(16, Math.min(144, enemy.y + oy));
          const spawnX = this.checkTileCollision(gx, gy, 12, 12) ? enemy.x : gx;
          const spawnY = this.checkTileCollision(gx, gy, 12, 12) ? enemy.y : gy;
          this.enemies.push(
            new GelEnemy({
              id: `${enemy.id}_split_${idx}_${Date.now()}`,
              x: spawnX,
              y: spawnY,
            })
          );
        });
      }

      // Spawn item drop chance
      this.rollEnemyDrop(enemy.x, enemy.y, enemy.type);
    } else {
      chiptune.playEnemyHit();

      // Darknut counter-charges aggressively when struck rather than fleeing
      if (enemy instanceof DarknutEnemy) {
        enemy.onDamaged(this.player, chiptune);
      } else if (isComplexEnemy(enemy.type)) {
        const lowHpThreshold = enemy.type === EnemyType.DARKNUT_BLUE ? 2 : 1;
        if (enemy.health <= lowHpThreshold || Math.random() < 0.45) {
          // Tactical retreat / flee away from Link!
          setFleeState(enemy, 100 + Math.floor(Math.random() * 40), chiptune);
        } else {
          // Enrage into aggressive chase!
          enemy.behaviorState = 'chase';
          enemy.behaviorTimer = 240;
          enemy.alertTimer = 20;
        }
      }
    }
  }

  /**
   * Spawns a loot item with an authentic NES 'poof' smoke cloud particle effect and chime.
   * Can either materialize immediately or after a slight delay (e.g. at the conclusion of enemy death animation).
   */
  public spawnLootItemWithPoof(
    x: number,
    y: number,
    type: ItemType,
    amount: number = 1,
    delayFrames: number = 16,
    permanent: boolean = false,
    customData?: Record<string, any>
  ) {
    if (delayFrames <= 0) {
      this.particles.emitItemPoof(x + 8, y + 8);
      chiptune.playItemPoof();
      this.pickups.push({
        id: `loot_${type}_${Date.now()}_${Math.random()}`,
        type,
        x,
        y,
        amount,
        timer: permanent ? 999999 : type === ItemType.FAIRY ? 900 : 600,
        spawnTimer: 14,
        customData,
      });
    } else {
      this.pendingLootDrops.push({
        delay: delayFrames,
        x,
        y,
        type,
        amount,
        permanent,
        customData,
      });
    }
  }

  private handleBossDefeat(enemy: Enemy) {
    const bossCfg = getBossBattleByEnemyType(enemy.type, this.currentScreen.id);
    if (!bossCfg) return;

    this.defeatedBossRooms.add(bossCfg.bossScreenId);
    this.player.defeatedBossRooms = Array.from(this.defeatedBossRooms);

    const gateOpened = applyBossGateState(this.currentScreen, true);
    if (gateOpened) {
      for (const gt of bossCfg.gateTiles) {
        this.particles.emitSparkleBurst(gt.col * TILE_SIZE + 8, gt.row * TILE_SIZE + 8);
      }
      this.triggerScreenShake(10, 2);
      chiptune.playSecret();
      this.heartUpgradeBannerTimer = 140;
      this.heartUpgradeBannerText = `BOSS GATE OPENED! ENTER FOR ${bossCfg.triforceName.toUpperCase()}`;
    }

    this.onPlayerUpdate?.(this.player);
    if (this.activeSlot) {
      saveGameProgress(
        this.activeSlot.id,
        this.player,
        this.currentScreen.id,
        undefined,
        Array.from(this.visitedScreens),
        Array.from(this.collectedHeartContainers)
      );
    }
  }

  private recordEnemyDefeat(enemyType: EnemyType) {
    const result = unlockBestiaryEntry(
      this.player.unlockedBestiary,
      this.player.bestiaryDefeatCounts,
      enemyType
    );
    this.player.unlockedBestiary = result.unlockedBestiary;
    this.player.bestiaryDefeatCounts = result.bestiaryDefeatCounts;
    this.onPlayerUpdate?.(this.player);

    if (result.unlockedNow && this.activeSlot) {
      saveGameProgress(
        this.activeSlot.id,
        this.player,
        this.currentScreen.id,
        undefined,
        Array.from(this.visitedScreens),
        Array.from(this.collectedHeartContainers)
      );
    }
  }

  /**
   * Authentic NES Zelda Monster Loot Drop System:
   * Defeated enemies spawn recovery hearts, single rupees, 5-rupees, and fairies!
   * Features adaptive drop rates based on Link's health condition (mercy boost),
   * categorized monster drop groups, and the classic 10th-kill guaranteed drop cycle.
   */
  private rollEnemyDrop(x: number, y: number, enemyType: EnemyType) {
    // 1. Boss guaranteed drop: Heart Container (deduplicated per boss)!
    const bossHeartId = getBossHeartContainerId(enemyType);
    if (bossHeartId) {
      if (!this.collectedHeartContainers.has(bossHeartId)) {
        this.spawnLootItemWithPoof(x + 8, y + 8, ItemType.HEART_CONTAINER, 2, 20, true, {
          heartContainerId: bossHeartId,
          sourceType: 'boss',
        });
      }
      return;
    }

    // 2. Room-specific guaranteed key carrier (e.g. Stalfos in D1_2)
    if (enemyType === EnemyType.STALFOS && this.currentScreen.id === 'D1_2') {
      this.spawnLootItemWithPoof(x, y, ItemType.KEY, 1, 16, true);
      return;
    }

    // 3. Room-specific Boomerang reward carrier (Goriya in D1_4)
    if (
      enemyType === EnemyType.GORIYA_RED &&
      this.currentScreen.id === 'D1_4' &&
      !this.player.inventory.hasBoomerang
    ) {
      this.spawnLootItemWithPoof(x, y, ItemType.BOOMERANG, 1, 16, true);
      return;
    }

    // 4. Track NES kill counter (cycles 0-9; every 10th enemy has guaranteed loot)
    this.killCount = (this.killCount + 1) % 10;

    const p = this.player;
    const isCriticalHealth = p.hearts <= 2; // 1 full heart or lower (mercy boost!)
    const isWounded = p.hearts < p.maxHearts;
    const hasLowBombs = p.inventory.bombs <= 1;

    // NES Guaranteed 10th-kill drop
    if (this.killCount === 0) {
      if (isCriticalHealth) {
        // High mercy: grant a healing Fairy!
        this.spawnLootItemWithPoof(x, y, ItemType.FAIRY, 1, 16);
      } else if (isWounded) {
        // 50% chance Fairy, 50% chance Recovery Heart
        if (Math.random() < 0.45) {
          this.spawnLootItemWithPoof(x, y, ItemType.FAIRY, 1, 16);
        } else {
          this.spawnLootItemWithPoof(x, y, ItemType.HEART, 2, 16);
        }
      } else {
        // Full health: 5-Rupee or rare Fairy
        if (Math.random() < 0.25) {
          this.spawnLootItemWithPoof(x, y, ItemType.FAIRY, 1, 16);
        } else {
          this.spawnLootItemWithPoof(x, y, ItemType.RUPEE_FIVE, 5, 16);
        }
      }
      return;
    }

    // Categorize enemy into drop group:
    // Group B: Tough Overworld/Dungeon (Darknut, Moblin, Goriya, Wizzrobe, Like-Like) -> high rewards
    // Group C: Dungeon Foes (Stalfos, Keese, Rope, Zol, Gel, Armos) -> balanced drops
    // Group A: Basic Overworld (Octorok, Tektite, Leever, Peahat) -> standard drops
    const isGroupB =
      enemyType === EnemyType.OCTOROK_BLUE ||
      enemyType === EnemyType.MOBLIN_RED ||
      enemyType === EnemyType.MOBLIN_BLUE ||
      enemyType === EnemyType.GORIYA_RED ||
      enemyType === EnemyType.DARKNUT_RED ||
      enemyType === EnemyType.DARKNUT_BLUE ||
      enemyType === EnemyType.WIZZROBE_RED ||
      enemyType === EnemyType.GHINI ||
      enemyType === EnemyType.LIKE_LIKE;

    const isGroupC =
      enemyType === EnemyType.STALFOS ||
      enemyType === EnemyType.KEESE ||
      enemyType === EnemyType.ROPE ||
      enemyType === EnemyType.ZOL ||
      enemyType === EnemyType.GEL ||
      enemyType === EnemyType.ARMOS;

    let baseDropChance = isGroupB ? 0.62 : isGroupC ? 0.54 : 0.48;
    if (isCriticalHealth) {
      baseDropChance += 0.22; // Critical health mercy boost!
    } else if (isWounded) {
      baseDropChance += 0.08;
    }

    if (Math.random() > baseDropChance) {
      return; // No drop this roll
    }

    const roll = Math.random();

    if (isGroupB) {
      // Group B (Tough Foes): Fairy (12%), Heart (30%), 5-Rupee (25%), Single Rupee (18%), Bomb (10%), Clock (5%)
      if (isCriticalHealth && roll < 0.22) {
        this.spawnLootItemWithPoof(x, y, ItemType.FAIRY, 1, 16);
      } else if (hasLowBombs && roll < 0.35) {
        this.spawnLootItemWithPoof(x, y, ItemType.BOMB, 4, 16);
      } else if (isWounded && roll < 0.45) {
        this.spawnLootItemWithPoof(x, y, ItemType.HEART, 2, 16);
      } else if (roll < 0.12) {
        this.spawnLootItemWithPoof(x, y, ItemType.FAIRY, 1, 16);
      } else if (roll < 0.38) {
        this.spawnLootItemWithPoof(x, y, ItemType.RUPEE_FIVE, 5, 16);
      } else if (roll < 0.60) {
        if (!isWounded && Math.random() < 0.6) {
          this.spawnLootItemWithPoof(x, y, ItemType.RUPEE_FIVE, 5, 16);
        } else {
          this.spawnLootItemWithPoof(x, y, ItemType.HEART, 2, 16);
        }
      } else if (roll < 0.82) {
        this.spawnLootItemWithPoof(x, y, ItemType.RUPEE, 1, 16);
      } else if (roll < 0.94) {
        this.spawnLootItemWithPoof(x, y, ItemType.BOMB, 4, 16);
      } else {
        this.spawnLootItemWithPoof(x, y, ItemType.CLOCK, 1, 16);
      }
    } else if (isGroupC) {
      // Group C (Dungeon Foes): Fairy (10%), Hearts (35%), Single Rupees (28%), 5-Rupees (15%), Bombs (8%), Clock (4%)
      if (isCriticalHealth && roll < 0.20) {
        this.spawnLootItemWithPoof(x, y, ItemType.FAIRY, 1, 16);
      } else if (isCriticalHealth && roll < 0.60) {
        this.spawnLootItemWithPoof(x, y, ItemType.HEART, 2, 16);
      } else if (roll < 0.10) {
        this.spawnLootItemWithPoof(x, y, ItemType.FAIRY, 1, 16);
      } else if (roll < 0.42) {
        if (!isWounded && Math.random() < 0.5) {
          this.spawnLootItemWithPoof(x, y, ItemType.RUPEE, 1, 16);
        } else {
          this.spawnLootItemWithPoof(x, y, ItemType.HEART, 2, 16);
        }
      } else if (roll < 0.70) {
        this.spawnLootItemWithPoof(x, y, ItemType.RUPEE, 1, 16);
      } else if (roll < 0.86) {
        this.spawnLootItemWithPoof(x, y, ItemType.RUPEE_FIVE, 5, 16);
      } else if (roll < 0.95) {
        this.spawnLootItemWithPoof(x, y, ItemType.BOMB, 4, 16);
      } else {
        this.spawnLootItemWithPoof(x, y, ItemType.CLOCK, 1, 16);
      }
    } else {
      // Group A (Basic Overworld): Fairy (8%), Hearts (40%), Single Rupees (34%), 5-Rupees (12%), Bombs (6%)
      if (isCriticalHealth && roll < 0.18) {
        this.spawnLootItemWithPoof(x, y, ItemType.FAIRY, 1, 16);
      } else if (isCriticalHealth && roll < 0.65) {
        this.spawnLootItemWithPoof(x, y, ItemType.HEART, 2, 16);
      } else if (roll < 0.08) {
        this.spawnLootItemWithPoof(x, y, ItemType.FAIRY, 1, 16);
      } else if (roll < 0.46) {
        if (!isWounded && Math.random() < 0.6) {
          this.spawnLootItemWithPoof(x, y, ItemType.RUPEE, 1, 16);
        } else {
          this.spawnLootItemWithPoof(x, y, ItemType.HEART, 2, 16);
        }
      } else if (roll < 0.78) {
        this.spawnLootItemWithPoof(x, y, ItemType.RUPEE, 1, 16);
      } else if (roll < 0.92) {
        this.spawnLootItemWithPoof(x, y, ItemType.RUPEE_FIVE, 5, 16);
      } else {
        this.spawnLootItemWithPoof(x, y, ItemType.BOMB, 4, 16);
      }
    }
  }

  private updateEnemies() {
    // 1. Food Bait countdown
    if (this.foodBait && this.foodBait.timer > 0) {
      this.foodBait.timer--;
      if (this.foodBait.timer <= 0) {
        this.foodBait = null;
      }
    }

    this.enemies.forEach((enemy) => {
      if (enemy.isDead) {
        enemy.deathTimer--;
        if (enemy.deathTimer % 4 === 0 && enemy.deathTimer > 0) {
          this.particles.emitEmberPuff(enemy.x + 8, enemy.y + 8);
        }
        return;
      }

      if (enemy.isHurt) {
        enemy.hurtTimer--;
        if (enemy.hurtTimer <= 0) enemy.isHurt = false;
        return;
      }

      if (enemy.isStunned) {
        enemy.stunTimer--;
        if (enemy.stunTimer <= 0) enemy.isStunned = false;
        return;
      }

      // Dodongo Swollen state: stunned while bomb is digesting internally
      if (enemy.type === EnemyType.DODONGO && enemy.customData?.isSwollen) {
        enemy.customData.swollenTimer--;
        if (enemy.customData.swollenTimer <= 0) {
          enemy.customData.isSwollen = false;
          chiptune.playBombExplosion();
          this.particles.emitBombBlast(enemy.x + 8, enemy.y + 8);
          this.triggerScreenShake(8, 2);
          enemy.health -= 4;
          if (enemy.health <= 0) {
            enemy.isDead = true;
            enemy.deathTimer = 22;
            chiptune.playEnemyDie();
            this.recordEnemyDefeat(enemy.type);
            this.particles.emitEnemyDefeat(enemy.x + 16, enemy.y + 16, enemy.type, true);
            this.handleBossDefeat(enemy);
            this.rollEnemyDrop(enemy.x, enemy.y, enemy.type);
          }
        }
        return;
      }

      // Armos dormant statue: does not move until struck or touched
      if (enemy.type === EnemyType.ARMOS && !enemy.customData?.isAwakened) {
        const pDist = Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y);
        if (pDist < 16) {
          enemy.customData.isAwakened = true;
          chiptune.playSecret();
        }
        return;
      }

      // Darknut Enemy Subclass AI: armored patrol, frontal shield defense, and proximity turn-and-charge
      if (enemy instanceof DarknutEnemy) {
        enemy.update(
          this.player,
          this.checkTileCollision.bind(this),
          this.damagePlayer.bind(this),
          chiptune,
          this.particles
        );
        return;
      }

      // Complex enemy types use the advanced Finite State Machine ('patrol', 'chase', 'flee')
      if (isComplexEnemy(enemy.type)) {
        updateComplexEnemyAI(
          enemy,
          this.player,
          this.checkTileCollision.bind(this),
          chiptune
        );

        // Contact damage against Link
        const pDist = Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y);
        if (pDist < 14) {
          const contactDamage = enemy.type === EnemyType.DARKNUT_BLUE ? 2 : 1;
          this.damagePlayer(contactDamage, enemy.dir);
        }
        return;
      }

      // Octorok Enemy Subclass AI: patrols in a random direction for a few seconds before stopping and firing a rock
      if (enemy instanceof OctorokEnemy) {
        enemy.update(
          this.player,
          this.checkTileCollision.bind(this),
          (rock) => this.spawnRockProjectile(rock),
          this.damagePlayer.bind(this),
          chiptune,
          this.particles
        );
        return;
      }

      // Stalfos Enemy Subclass AI: jumps randomly around the screen in short bursts, periodically lunging at Link
      if (enemy instanceof StalfosEnemy) {
        enemy.update(
          this.player,
          this.checkTileCollision.bind(this),
          this.damagePlayer.bind(this),
          chiptune,
          this.particles
        );
        return;
      }

      // Goriya Enemy Subclass AI: wanders and periodically throws returning boomerangs along facing direction
      if (enemy instanceof GoriyaEnemy) {
        enemy.update(
          this.player,
          this.checkTileCollision.bind(this),
          (boomerang) => this.spawnGoriyaBoomerang(boomerang),
          this.damagePlayer.bind(this),
          chiptune,
          this.particles
        );
        return;
      }

      // Keese Enemy Subclass AI: erratically flutters across screen and swoops down at Link
      if (enemy instanceof KeeseEnemy) {
        enemy.update(
          this.player,
          this.checkTileCollision.bind(this),
          this.damagePlayer.bind(this),
          chiptune,
          this.particles
        );
        return;
      }

      // Leever Enemy Subclass AI: emerges from ground, moves in a straight line, and burrows back underground
      if (enemy instanceof LeeverEnemy) {
        enemy.update(
          this.player,
          this.checkTileCollision.bind(this),
          this.damagePlayer.bind(this),
          chiptune,
          this.particles
        );
        return;
      }

      // Gel Enemy Subclass AI: slow swarm creep, vibrate-in-place telegraph, and quick lunge toward Link
      if (enemy instanceof GelEnemy) {
        enemy.update(
          this.player,
          this.checkTileCollision.bind(this),
          this.damagePlayer.bind(this),
          chiptune,
          this.particles
        );
        return;
      }

      // Peahat Enemy Subclass AI: stationary rooted phase, then vulnerable circular/erratic flight around player
      if (enemy instanceof PeahatEnemy) {
        enemy.update(
          this.player,
          this.checkTileCollision.bind(this),
          this.damagePlayer.bind(this),
          chiptune,
          this.particles
        );
        return;
      }

      // Wizzrobe Enemy Subclass AI: warps randomly around screen, fires magic waves, then vanishes
      if (enemy instanceof WizzrobeEnemy) {
        enemy.update(
          this.player,
          this.checkTileCollision.bind(this),
          (proj) => this.spawnMagicProjectile(proj),
          this.damagePlayer.bind(this),
          chiptune,
          this.particles
        );
        return;
      }

      // Ghini Enemy Subclass AI: statue-like until touched, then active & sword-immune ghost
      if (enemy instanceof GhiniEnemy) {
        enemy.update(
          this.player,
          this.damagePlayer.bind(this),
          chiptune,
          this.particles
        );
        return;
      }

      // Like Like Enemy Subclass AI: slowly stalks Link and consumes his shield upon collision
      if (enemy instanceof LikeLikeEnemy) {
        enemy.update(
          this.player,
          this.checkTileCollision.bind(this),
          this.damagePlayer.bind(this),
          chiptune,
          this.particles,
          () => {
            this.triggerScreenShake(6, 2);
            this.onPlayerUpdate?.(this.player);
          }
        );
        return;
      }

      // Basic enemy types (Moblins, Goriyas, Ropes, Keese, etc.) use the basic patrol & proximity attack AI system
      if (isBasicEnemy(enemy.type)) {
        updateBasicEnemyAI({
          enemy,
          player: this.player,
          checkTileCollision: this.checkTileCollision.bind(this),
          shootProjectile: this.shootEnemyProjectile.bind(this),
          damagePlayer: this.damagePlayer.bind(this),
          audio: chiptune,
          particles: this.particles,
        });
        return;
      }

      enemy.animTimer++;
      if (enemy.animTimer > 10) {
        enemy.animFrame = (enemy.animFrame + 1) % 2;
        enemy.animTimer = 0;
      }

      // Food bait distraction target
      let targetX = this.player.x;
      let targetY = this.player.y;
      if (
        this.foodBait &&
        enemy.type !== EnemyType.AQUAMENTUS &&
        enemy.type !== EnemyType.DODONGO
      ) {
        targetX = this.foodBait.x;
        targetY = this.foodBait.y;
      }

      // AI Logic
      enemy.actionTimer--;
      if (enemy.actionTimer <= 0) {
        enemy.actionTimer = 40 + Math.random() * 60;

        // Armos tracks target direction
        if (enemy.type === EnemyType.ARMOS) {
          const dx = targetX - enemy.x;
          const dy = targetY - enemy.y;
          if (Math.abs(dx) > Math.abs(dy)) {
            enemy.dir = dx > 0 ? Direction.RIGHT : Direction.LEFT;
          } else {
            enemy.dir = dy > 0 ? Direction.DOWN : Direction.UP;
          }
        } else {
          // Random direction change
          const dirs = [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT];
          enemy.dir = dirs[Math.floor(Math.random() * dirs.length)];
        }

        // Enemy shooting chance
        if (enemy.type === EnemyType.OCTOROK_RED || enemy.type === EnemyType.OCTOROK_BLUE) {
          if (Math.random() < 0.6) {
            this.shootEnemyProjectile(enemy, 'rock');
          }
        } else if (
          enemy.type === EnemyType.MOBLIN_RED ||
          enemy.type === EnemyType.MOBLIN_BLUE
        ) {
          // Standard Moblin shoots an arrow in its movement direction
          if (Math.random() < 0.65) {
            this.shootEnemyProjectile(enemy, 'arrow');
          }
        } else if (enemy.type === EnemyType.AQUAMENTUS) {
          this.shootBossFireballs(enemy);
        }
      }

      // Move enemy
      let edx = 0;
      let edy = 0;
      if (enemy.dir === Direction.UP) edy -= enemy.speed;
      else if (enemy.dir === Direction.DOWN) edy += enemy.speed;
      else if (enemy.dir === Direction.LEFT) edx -= enemy.speed;
      else if (enemy.dir === Direction.RIGHT) edx += enemy.speed;

      const nex = enemy.x + edx;
      const ney = enemy.y + edy;

      if (!this.checkTileCollision(nex, ney, 14, 14)) {
        enemy.x = nex;
        enemy.y = ney;
      } else {
        // Turn around on wall hit
        if (enemy.dir === Direction.UP) enemy.dir = Direction.DOWN;
        else if (enemy.dir === Direction.DOWN) enemy.dir = Direction.UP;
        else if (enemy.dir === Direction.LEFT) enemy.dir = Direction.RIGHT;
        else if (enemy.dir === Direction.RIGHT) enemy.dir = Direction.LEFT;
      }

      // Damage player collision
      const pDist = Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y);
      if (pDist < 14) {
        const dmg = enemy.type === EnemyType.DODONGO ? 2 : 1;
        this.damagePlayer(dmg, enemy.dir);
      }
    });

    // Remove defeated enemies after death animation completes
    this.enemies = this.enemies.filter((e) => !e.isDead || e.deathTimer > 0);
  }

  private spawnRockProjectile(rock: RockProjectileData) {
    this.projectiles.push({
      id: `proj_rock_${Date.now()}_${Math.random()}`,
      type: 'rock',
      x: rock.x,
      y: rock.y,
      vx: rock.vx,
      vy: rock.vy,
      dir: rock.dir,
      timer: 90,
      owner: 'enemy',
      active: true,
      damage: 1,
    });
  }

  private spawnMagicProjectile(proj: MagicProjectileData) {
    this.projectiles.push({
      id: `proj_magic_${Date.now()}_${Math.random()}`,
      type: 'magic_wave',
      x: proj.x,
      y: proj.y,
      vx: proj.vx,
      vy: proj.vy,
      dir: proj.dir,
      timer: 100,
      owner: 'enemy',
      active: true,
      damage: proj.damage,
    });
  }

  private spawnGoriyaBoomerang(boomerang: BoomerangProjectileData) {
    this.projectiles.push({
      id: `proj_boom_${Date.now()}_${Math.random()}`,
      type: 'boomerang',
      x: boomerang.x,
      y: boomerang.y,
      vx: boomerang.vx,
      vy: boomerang.vy,
      dir: boomerang.dir,
      timer: 60,
      owner: 'enemy',
      active: true,
      damage: 1,
      customData: {
        throwerId: boomerang.throwerId,
        originX: boomerang.x,
        originY: boomerang.y,
        halfTimer: 30,
      },
    });
  }

  private shootEnemyProjectile(enemy: Enemy, type: 'rock' | 'arrow' | 'boomerang') {
    let vx = 0;
    let vy = 0;
    const speed = type === 'arrow' ? 2.5 : type === 'boomerang' ? 3.0 : 2.2;
    if (enemy.dir === Direction.UP) vy = -speed;
    else if (enemy.dir === Direction.DOWN) vy = speed;
    else if (enemy.dir === Direction.LEFT) vx = -speed;
    else if (enemy.dir === Direction.RIGHT) vx = speed;

    if (type === 'arrow') {
      chiptune.playArrowShoot();
    } else if (type === 'rock') {
      chiptune.playRockSpit();
    } else if (type === 'boomerang') {
      chiptune.playBoomerang();
    }

    this.projectiles.push({
      id: `proj_${Date.now()}_${Math.random()}`,
      type,
      x: enemy.x,
      y: enemy.y,
      vx,
      vy,
      dir: enemy.dir,
      timer: type === 'boomerang' ? 44 : 90,
      owner: 'enemy',
      active: true,
      damage: 1,
    });
  }

  private shootBossFireballs(enemy: Enemy) {
    // 3 spread fireballs
    [-0.5, 0, 0.5].forEach((angleOffset) => {
      this.projectiles.push({
        id: `fire_${Date.now()}_${angleOffset}`,
        type: 'fireball',
        x: enemy.x - 6,
        y: enemy.y + 8,
        vx: -2.5,
        vy: angleOffset * 2,
        dir: Direction.LEFT,
        timer: 100,
        owner: 'enemy',
        active: true,
        damage: 2,
      });
    });
  }

  private updateProjectiles() {
    this.projectiles.forEach((p) => {
      if (!p.active) return;
      p.x += p.vx;
      p.y += p.vy;
      p.timer--;

      if (p.type === 'boomerang') {
        // Return after half life
        const halfThreshold = p.customData?.halfTimer ?? 22;
        if (p.timer < halfThreshold) {
          let targetX = this.player.x;
          let targetY = this.player.y;

          if (p.owner === 'enemy' && p.customData?.throwerId) {
            const thrower = this.enemies.find((e) => e.id === p.customData?.throwerId && !e.isDead);
            if (thrower) {
              targetX = thrower.x;
              targetY = thrower.y;
            } else if (p.customData?.originX !== undefined) {
              targetX = p.customData.originX;
              targetY = p.customData.originY;
            }
          }

          const dx = targetX - p.x;
          const dy = targetY - p.y;
          const angle = Math.atan2(dy, dx);
          p.vx = Math.cos(angle) * 3.5;
          p.vy = Math.sin(angle) * 3.5;

          // Catch boomerang
          if (Math.hypot(dx, dy) < 14) {
            p.active = false;
            if (p.owner === 'enemy' && p.customData?.throwerId) {
              const thrower = this.enemies.find((e) => e.id === p.customData?.throwerId);
              if (thrower && (thrower as any).catchBoomerang) {
                (thrower as any).catchBoomerang();
              }
            }
          }
        }
      }

      if (p.timer <= 0) {
        p.active = false;
        if (p.type === 'boomerang' && p.owner === 'enemy' && p.customData?.throwerId) {
          const thrower = this.enemies.find((e) => e.id === p.customData?.throwerId);
          if (thrower && (thrower as any).catchBoomerang) {
            (thrower as any).catchBoomerang();
          }
        }
        return;
      }

      // Flame projectile burns bushes continuously
      if (p.type === 'flame') {
        this.checkBushBurn(p.x + 4, p.y + 4);
      }

      // Check collision with solid tiles (water tiles do not stop aerial projectiles)
      const tileCheckX = p.type === 'rock' ? p.x + 4 : p.x;
      const tileCheckY = p.type === 'rock' ? p.y + 4 : p.y;
      if (this.checkProjectileTileCollision(tileCheckX, tileCheckY, 8, 8)) {
        if (p.type === 'sword_beam') {
          this.particles.emitSwordBeamHit(p.x + 4, p.y + 4);
          this.checkSwordWallStrike(p.x + 4, p.y + 4, p.dir);
        } else if (p.type === 'flame') {
          this.checkBushBurn(p.x + 4, p.y + 4);
        } else if (p.type === 'boomerang') {
          // Boomerang bounces off solid walls and turns around to return
          const halfThreshold = p.customData?.halfTimer ?? 22;
          if (p.timer > halfThreshold) {
            p.timer = halfThreshold;
            return;
          }
        }
        p.active = false;
        return;
      }

      // Check collision with screen outer boundaries
      if (p.x <= 2 || p.x >= SCREEN_WIDTH - 10 || p.y <= 2 || p.y >= SCREEN_HEIGHT - 10) {
        if (p.type === 'sword_beam') {
          this.particles.emitSwordBeamHit(p.x + 4, p.y + 4);
          this.checkSwordWallStrike(p.x + 4, p.y + 4, p.dir);
        } else if (p.type === 'boomerang') {
          const halfThreshold = p.customData?.halfTimer ?? 22;
          if (p.timer > halfThreshold) {
            p.timer = halfThreshold;
            return;
          }
        }
        p.active = false;
        return;
      }

      // Player projectiles hit enemies (8x8 collision box & damage logic)
      if (p.owner === 'player') {
        for (const enemy of this.enemies) {
          if (enemy.isDead || (enemy as any).isSubmerged || (enemy as any).isHidden || !p.active) continue;
          // Do not let enemies already in melee/damage invincibility frames consume a projectile without taking damage
          if (p.type !== 'boomerang' && enemy.isHurt) continue;

          // Enemy collision box
          const isBoss =
            enemy.type === EnemyType.AQUAMENTUS ||
            enemy.type === EnemyType.DODONGO ||
            enemy.type === EnemyType.MANHANDLA;
          const ew = isBoss ? 28 : 14;
          const eh = isBoss ? 28 : 14;
          const ex = enemy.x + (isBoss ? 2 : 1);
          const ey = enemy.y + (isBoss ? 2 : 1);

          // 8x8 Projectile Collision Box
          const pw = 8;
          const ph = 8;
          const px = p.x;
          const py = p.y;

          // AABB Collision check
          const hasCollision =
            px < ex + ew &&
            px + pw > ex &&
            py < ey + eh &&
            py + ph > ey;

          if (hasCollision) {
            if (p.type === 'boomerang') {
              if (enemy instanceof GhiniEnemy && !enemy.isAwakened) {
                chiptune.playShieldDeflect();
                this.particles.emitShieldDeflect(p.x + 4, p.y + 4, p.dir);
                p.timer = 22;
              } else {
                // Stun enemy
                enemy.isStunned = true;
                enemy.stunTimer = 180; // 3 seconds
                chiptune.playEnemyHit();
                this.particles.emitSwordStrike(p.x + 4, p.y + 4, p.dir, 1);
                p.timer = 22; // Start returning immediately
              }
            } else if (p.type === 'sword_beam') {
              // Darknut Frontal Shield Mechanics: blocks direct frontal sword beam
              const isDarknutBlocked =
                (enemy.type === EnemyType.DARKNUT_RED || enemy.type === EnemyType.DARKNUT_BLUE) &&
                isDarknutShieldBlocking(enemy.dir, p.dir);

              // Dodongo thick hide deflects sword beams unless swollen
              const isDodongoBlocked =
                enemy.type === EnemyType.DODONGO && !enemy.customData?.isSwollen;

              // Rooted Peahat shell deflects sword beams until it takes flight
              const isPeahatBlocked =
                enemy instanceof PeahatEnemy && !enemy.isVulnerable;

              // Ghini is immune to standard sword and sword beam attacks
              const isGhiniBlocked =
                enemy instanceof GhiniEnemy && !enemy.canBeDamagedBy('sword_beam');

              if (isDarknutBlocked || isDodongoBlocked || isPeahatBlocked || isGhiniBlocked) {
                chiptune.playShieldDeflect();
                this.particles.emitShieldDeflect(p.x + 4, p.y + 4, p.dir);
              } else {
                // Beam hits enemy: explosive 4-way beam shards and star flash
                this.particles.emitSwordBeamHit(p.x + 4, p.y + 4);
                this.triggerScreenShake(2, 1);
                // Apply enemy damage logic
                this.damageEnemy(enemy, p.damage, p.dir, 'sword_beam');
              }
              p.active = false;
              break;
            } else {
              const source: GhiniAttackSource =
                p.type === 'flame'
                  ? 'flame'
                  : p.type === 'arrow'
                  ? 'arrow'
                  : p.type === 'magic_wave'
                  ? 'magic_wave'
                  : 'secondary';
              this.particles.emitSwordStrike(p.x + 4, p.y + 4, p.dir, 1);
              this.damageEnemy(enemy, p.damage, p.dir, source);
              if (p.type !== 'flame') {
                p.active = false;
              }
              break;
            }
          }
        }
      }

      // Enemy projectiles hit player
      if (p.owner === 'enemy') {
        if (Math.hypot(this.player.x - p.x, this.player.y - p.y) < 12) {
          // Check Shield Deflection:
          // If Link is facing the incoming projectile and NOT attacking, shield blocks rocks & arrows!
          // Magical Shield also blocks fireballs!
          const isFacing =
            (p.dir === Direction.RIGHT && this.player.dir === Direction.LEFT) ||
            (p.dir === Direction.LEFT && this.player.dir === Direction.RIGHT) ||
            (p.dir === Direction.DOWN && this.player.dir === Direction.UP) ||
            (p.dir === Direction.UP && this.player.dir === Direction.DOWN);

          const playerHasAnyShield = LikeLikeEnemy.playerHasShield(this.player);
          const hasMagicalShield = Boolean(this.player.hasMagicalShield || this.player.inventory.hasMagicalShield);
          const canBlock =
            playerHasAnyShield &&
            (p.type === 'rock' ||
              p.type === 'arrow' ||
              p.type === 'boomerang' ||
              (hasMagicalShield && (p.type === 'fireball' || p.type === 'magic_wave')));

          if (isFacing && !this.player.isAttacking && canBlock) {
            chiptune.playShieldDeflect();
            this.particles.emitShieldDeflect(p.x + 4, p.y + 4, p.dir);
            this.triggerScreenShake(2, 1);
            p.active = false;
            if (p.type === 'boomerang' && p.customData?.throwerId) {
              const thrower = this.enemies.find((e) => e.id === p.customData?.throwerId);
              if (thrower && (thrower as any).catchBoomerang) {
                (thrower as any).catchBoomerang();
              }
            }
          } else {
            this.damagePlayer(p.damage, p.dir);
            p.active = false;
            if (p.type === 'boomerang' && p.customData?.throwerId) {
              const thrower = this.enemies.find((e) => e.id === p.customData?.throwerId);
              if (thrower && (thrower as any).catchBoomerang) {
                (thrower as any).catchBoomerang();
              }
            }
          }
        }
      }
    });

    this.projectiles = this.projectiles.filter((p) => p.active);
  }

  private updateBombs() {
    this.bombs.forEach((bomb) => {
      if (!bomb.exploded) {
        // Dodongo swallows bomb!
        for (const enemy of this.enemies) {
          if (
            enemy.type === EnemyType.DODONGO &&
            !enemy.isDead &&
            !enemy.customData?.isSwollen
          ) {
            if (Math.hypot(enemy.x + 8 - (bomb.x + 8), enemy.y + 8 - (bomb.y + 8)) < 20) {
              chiptune.playDodongoSwallow();
              bomb.explodeTimer = 0; // swallowed & consumed
              bomb.exploded = true;
              if (!enemy.customData) enemy.customData = {};
              enemy.customData.isSwollen = true;
              enemy.customData.swollenTimer = 90;
              this.triggerScreenShake(4, 1);
              break;
            }
          }
        }

        bomb.fuseTimer--;
        if (bomb.fuseTimer <= 0) {
          bomb.exploded = true;
          chiptune.playBombExplosion();
          this.particles.emitBombBlast(bomb.x + 8, bomb.y + 8);
          this.triggerScreenShake(8, 2);
          // Check if bomb blast cracked open any secret walls or rocks
          this.checkBombSecrets(bomb.x + 8, bomb.y + 8);
          // Blast radius damage
          this.enemies.forEach((enemy) => {
            if (enemy.isDead || (enemy as any).isSubmerged || (enemy as any).isHidden) return;
            if (Math.hypot(enemy.x - bomb.x, enemy.y - bomb.y) < 32) {
              this.damageEnemy(enemy, 6, Direction.UP, 'bomb');
            }
          });
          // Check player blast damage
          if (Math.hypot(this.player.x - bomb.x, this.player.y - bomb.y) < 24) {
            this.damagePlayer(1, Direction.UP);
          }
        }
      } else {
        bomb.explodeTimer--;
      }
    });

    this.bombs = this.bombs.filter((b) => b.explodeTimer > 0);
  }

  // --- SECRET DISCOVERY & PUZZLE MECHANISMS ---

  public checkBushBurn(fireX: number, fireY: number) {
    const col = Math.floor(fireX / TILE_SIZE);
    const row = Math.floor(fireY / TILE_SIZE);
    if (row < 0 || row >= 11 || col < 0 || col >= 16) return;

    const tile = this.currentScreen.tiles[row][col];
    const isBush = tile === 1 || tile === 12;
    const isWall = tile === 2 || tile === 13 || tile === 14 || tile === 17;
    if (!isBush && !isWall) return;

    const secret = this.currentScreen.secrets?.find(
      (s) =>
        (s.type === 'burn' || s.type === 'sword' || s.type === 'bomb') &&
        s.row === row &&
        s.col === col &&
        !this.revealedSecrets.has(s.id)
    );

    if (secret) {
      this.revealSecret(secret, 'burn');
    } else if (isBush) {
      this.particles.emitEmberPuff(col * TILE_SIZE + 8, row * TILE_SIZE + 8);
    }
  }

  public checkBombSecrets(blastX: number, blastY: number) {
    if (!this.currentScreen.secrets) return;
    const enemiesRemaining = this.enemies.some((e) => !e.isDead);
    const matchedSecrets = detectBombableSecretsInBlast(
      this.currentScreen,
      blastX,
      blastY,
      TILE_SIZE,
      enemiesRemaining,
      this.revealedSecrets,
      28
    );
    for (const secret of matchedSecrets) {
      this.revealSecret(secret, secret.type === 'burn' ? 'burn' : 'bomb');
    }
  }

  public checkBlockPush(dir: Direction) {
    const p = this.player;
    let checkX = p.x + 7;
    let checkY = p.y + 7;
    if (dir === Direction.UP) checkY -= 12;
    else if (dir === Direction.DOWN) checkY += 12;
    else if (dir === Direction.LEFT) checkX -= 12;
    else if (dir === Direction.RIGHT) checkX += 12;

    const col = Math.floor(checkX / TILE_SIZE);
    const row = Math.floor(checkY / TILE_SIZE);

    if (row < 0 || row >= 11 || col < 0 || col >= 16 || !this.currentScreen.secrets) {
      this.pushTimer = 0;
      return;
    }

    const enemiesRemaining = this.enemies.some((e) => !e.isDead);

    let pushMatch = detectPushableSecretAt(
      this.currentScreen,
      row,
      col,
      dir,
      enemiesRemaining,
      this.revealedSecrets
    );

    // If standing slightly offset along the orthogonal axis, also check Link's flanking edges
    if (!pushMatch) {
      if (dir === Direction.UP || dir === Direction.DOWN) {
        const colLeft = Math.floor((p.x + 2) / TILE_SIZE);
        const colRight = Math.floor((p.x + 13) / TILE_SIZE);
        pushMatch =
          detectPushableSecretAt(this.currentScreen, row, colLeft, dir, enemiesRemaining, this.revealedSecrets) ||
          detectPushableSecretAt(this.currentScreen, row, colRight, dir, enemiesRemaining, this.revealedSecrets);
      } else {
        const rowTop = Math.floor((p.y + 2) / TILE_SIZE);
        const rowBottom = Math.floor((p.y + 13) / TILE_SIZE);
        pushMatch =
          detectPushableSecretAt(this.currentScreen, rowTop, col, dir, enemiesRemaining, this.revealedSecrets) ||
          detectPushableSecretAt(this.currentScreen, rowBottom, col, dir, enemiesRemaining, this.revealedSecrets);
      }
    }

    if (!pushMatch) {
      this.pushTimer = 0;
      return;
    }

    if (pushMatch.blockedByEnemies) {
      return;
    }

    const { secret, isBombWall } = pushMatch;

    // Link is actively pushing this block, rock, or hidden dungeon wall!
    this.pushTimer++;

    // Small dust particles while exerting force
    if (this.pushTimer % 5 === 0) {
      this.particles.emitEmberPuff(checkX, checkY);
    }

    // After steady pushing for ~20 frames (~0.33s):
    if (this.pushTimer >= 20) {
      this.pushTimer = 0;
      this.revealSecret(secret, isBombWall ? 'bomb_push' : 'push');
    }
  }

  public revealSecret(
    secret: SecretTrigger,
    source: 'push' | 'bomb' | 'sword' | 'bomb_push' | 'burn'
  ) {
    if (this.revealedSecrets.has(secret.id)) return;
    this.revealedSecrets.add(secret.id);

    // Apply the secret tile & exit modification (and propagate linked shortcut walls)
    this.applySecretToTiles(secret);

    // Update visited screens map with newly revealed room / shortcut passage discovery
    const updatedVisited = recordSecretDiscoveryInVisitedMap(
      this.visitedScreens,
      this.currentScreen,
      secret,
      this.screens
    );
    this.onVisitedScreensChange?.(updatedVisited);

    const tileCenterX = secret.col * TILE_SIZE + 8;
    const tileCenterY = secret.row * TILE_SIZE + 8;
    const isStaircase = secret.revealTile === 15;
    const revealSource: 'bush' | 'boulder' = source === 'burn' ? 'bush' : 'boulder';

    if (isStaircase) {
      // Dedicated 2A03 chiptune sound effect for discovering a secret staircase
      chiptune.playSecretStaircaseReveal(revealSource);

      // Dedicated visual reveal particle eruption
      this.particles.emitSecretStaircaseReveal(tileCenterX, tileCenterY, revealSource);

      // Brief visual reveal animation over the uncovered staircase entrance
      this.triggerSecretStaircaseReveal(secret.col, secret.row, revealSource);

      this.triggerScreenShake(7, 1.8);
    } else {
      // Play standard secret found fanfare
      chiptune.playSecret();

      const positions = getSecretTilePositions(secret);

      // Visual flair: screen shake + particle effects
      if (source === 'burn') {
        this.triggerScreenShake(6, 1.5);
        this.particles.emitWallCrumble(tileCenterX, tileCenterY);
        this.particles.emitEmberPuff(tileCenterX, tileCenterY);
        this.particles.emitSwordStrike(tileCenterX, tileCenterY, Direction.UP, 1, true);
      } else if (source === 'sword') {
        this.triggerScreenShake(8, 2.0);
        for (const pos of positions) {
          this.particles.emitWallCrumble(pos.col * TILE_SIZE + 8, pos.row * TILE_SIZE + 8);
        }
        this.particles.emitSwordStrike(tileCenterX, tileCenterY, Direction.UP, 2, true);
      } else if (source === 'bomb_push') {
        // Hidden trigger: player pushes a bombable/secret wall to reveal passage
        this.triggerScreenShake(8, 2.5);
        for (const pos of positions) {
          const px = pos.col * TILE_SIZE + 8;
          const py = pos.row * TILE_SIZE + 8;
          this.particles.emitWallCrumble(px, py);
        }
        this.particles.emitBombBlast(tileCenterX, tileCenterY);
      } else {
        this.triggerScreenShake(6, 1.5);
        for (const pos of positions) {
          const px = pos.col * TILE_SIZE + 8;
          const py = pos.row * TILE_SIZE + 8;
          this.particles.emitWallCrumble(px, py);
        }
        this.particles.emitBombBlast(tileCenterX, tileCenterY);
        this.particles.emitSwordStrike(tileCenterX, tileCenterY, Direction.UP, 2, true);
      }
    }
  }

  private applySecretToTiles(secret: SecretTrigger) {
    applySecretDiscoveryToScreen(this.currentScreen, secret, this.screens, this.revealedSecrets);
  }

  private updatePickups() {
    // 1. Process pending enemy drops with timed poof appearance
    for (let i = this.pendingLootDrops.length - 1; i >= 0; i--) {
      const drop = this.pendingLootDrops[i];
      drop.delay--;
      if (drop.delay <= 0) {
        // Emit authentic NES 'poof' smoke puff & sparkle starburst
        this.particles.emitItemPoof(drop.x + 8, drop.y + 8);
        chiptune.playItemPoof();

        // Spawn pickup item with pop entrance animation
        this.pickups.push({
          id: `loot_${drop.type}_${Date.now()}_${Math.random()}`,
          type: drop.type,
          x: drop.x,
          y: drop.y,
          amount: drop.amount,
          timer: drop.permanent ? 999999 : drop.type === ItemType.FAIRY ? 900 : 600,
          spawnTimer: 14,
          customData: drop.customData,
        });

        this.pendingLootDrops.splice(i, 1);
      }
    }

    // 2. Update active pickups on the ground
    this.pickups.forEach((item) => {
      if (item.spawnTimer && item.spawnTimer > 0) {
        item.spawnTimer--;
      }
      item.timer--;
      if (item.timer <= 0) return;

      // Authentic NES Fairy drifting and fluttering motion
      if (item.type === ItemType.FAIRY) {
        if (!item.customData) {
          item.customData = {
            angle: Math.random() * Math.PI * 2,
            speed: 0.7 + Math.random() * 0.4,
            timer: 20 + Math.floor(Math.random() * 25),
          };
        }
        const fd = item.customData as { angle: number; speed: number; timer: number };
        fd.timer--;
        if (fd.timer <= 0) {
          fd.angle += (Math.random() - 0.5) * 1.6;
          fd.timer = 15 + Math.floor(Math.random() * 25);
        }
        item.x += Math.cos(fd.angle) * fd.speed;
        item.y += Math.sin(fd.angle) * fd.speed;

        // Bounce off screen boundaries
        if (item.x < 16) {
          item.x = 16;
          fd.angle = Math.PI - fd.angle;
        } else if (item.x > SCREEN_WIDTH - 24) {
          item.x = SCREEN_WIDTH - 24;
          fd.angle = Math.PI - fd.angle;
        }
        if (item.y < 16) {
          item.y = 16;
          fd.angle = -fd.angle;
        } else if (item.y > SCREEN_HEIGHT - 24) {
          item.y = SCREEN_HEIGHT - 24;
          fd.angle = -fd.angle;
        }

        // Periodic fairy sparkle particles
        if (this.animTick % 12 === 0) {
          this.particles.emitSparkleBurst(item.x + 8, item.y + 8);
        }
      }

      // Check player collection
      if (Math.hypot(this.player.x - item.x, this.player.y - item.y) < 14) {
        this.collectItem(item);
        item.timer = 0;
      }
    });

    this.pickups = this.pickups.filter((item) => item.timer > 0);
  }

  private updateShopAndGamble() {
    const p = this.player;

    // 1. Shop purchases
    if (this.currentScreen.shopItems && this.currentScreen.shopItems.length > 0) {
      for (let i = this.currentScreen.shopItems.length - 1; i >= 0; i--) {
        const item = this.currentScreen.shopItems[i];
        const dist = Math.hypot(p.x - item.x, p.y - item.y);
        if (dist < 14) {
          if (p.inventory.rupees >= item.price) {
            p.inventory.rupees -= item.price;
            chiptune.playShopBuy();
            this.collectItem({
              id: `shop_${item.id}`,
              type: item.type,
              x: item.x,
              y: item.y,
              amount: item.type === ItemType.BOMB ? 4 : item.type === ItemType.HEART_CONTAINER ? 2 : 1,
              timer: 0,
              customData:
                item.type === ItemType.HEART_CONTAINER
                  ? { heartContainerId: 'hc_shop_secret_heart', sourceType: 'shop' }
                  : undefined,
            });
            this.currentScreen.shopItems.splice(i, 1);
            this.onPlayerUpdate?.(p);
          } else {
            if (this.animTick % 30 === 0) {
              chiptune.playSwordWallClink(false);
            }
          }
        }
      }
    }

    // 2. Gambling game
    if (this.currentScreen.gamblePots && !this.gambleChosenPot) {
      for (const pot of this.currentScreen.gamblePots) {
        const dist = Math.hypot(p.x - pot.x, p.y - pot.y);
        if (dist < 14) {
          if (p.inventory.rupees >= 10) {
            p.inventory.rupees -= 10;
            this.gambleChosenPot = pot.id;
            pot.revealed = true;
            p.inventory.rupees = Math.max(0, Math.min(255, p.inventory.rupees + pot.amount));
            if (pot.amount > 0) {
              chiptune.playSecret();
            } else {
              chiptune.playPlayerHurt();
            }
            this.triggerScreenShake(4, 1);
            this.onPlayerUpdate?.(p);
          }
        }
      }
    }
  }

  private updateOldManNPC() {
    if (!this.oldMan || this.currentScreen.type !== 'cave') return;

    this.oldMan.update(this.particles);

    const inputAction = this.input.attack || this.input.item;
    this.oldMan.checkInteraction(
      this.player,
      inputAction,
      (itemType) => {
        this.revealedSecrets.add(`claimed_cave_item_${this.currentScreen.id}`);
        const caveHcId =
          itemType === ItemType.HEART_CONTAINER
            ? getCaveHeartContainerId(this.currentScreen.id)
            : null;
        this.collectItem({
          id: `cave_gift_${itemType}_${Date.now()}`,
          type: itemType,
          x: this.oldMan!.itemX,
          y: this.oldMan!.itemY,
          amount: itemType === ItemType.RUPEE_FIVE ? 5 : itemType === ItemType.BOMB ? 4 : 1,
          timer: 0,
          customData: caveHcId ? { heartContainerId: caveHcId, sourceType: 'cave' } : undefined,
        });
        this.onPlayerUpdate?.(this.player);
      },
      this.particles
    );
  }

  private collectItem(item: PickupItem) {
    const p = this.player;

    switch (item.type) {
      case ItemType.SWORD_WOOD:
        p.swordTier = 1;
        p.inventory.hasSword = true;
        p.isHoldingItem = true;
        p.heldItemType = item.type;
        p.heldItemTimer = 120;
        chiptune.playItemFanfare();
        if (this.activeSlot) {
          saveGameProgress(this.activeSlot.id, p, this.currentScreen.id);
        }
        break;

      case ItemType.SWORD_WHITE:
        p.swordTier = 2;
        p.inventory.hasSword = true;
        p.isHoldingItem = true;
        p.heldItemType = item.type;
        p.heldItemTimer = 140;
        chiptune.playItemFanfare();
        if (this.activeSlot) {
          saveGameProgress(this.activeSlot.id, p, this.currentScreen.id);
        }
        break;

      case ItemType.SWORD_MAGICAL:
        p.swordTier = 3;
        p.inventory.hasSword = true;
        p.isHoldingItem = true;
        p.heldItemType = item.type;
        p.heldItemTimer = 140;
        chiptune.playItemFanfare();
        if (this.activeSlot) {
          saveGameProgress(this.activeSlot.id, p, this.currentScreen.id);
        }
        break;

      case ItemType.TRIFORCE: {
        const triforceCfg = getTriforceByScreenId(this.currentScreen.id);
        const triforceId = item.customData?.triforceId ?? triforceCfg?.triforceId;
        const result = applyTriforcePieceCollection(p, this.collectedTriforceIds, triforceId);
        this.heartUpgradeBannerTimer = 180;
        this.heartUpgradeBannerText = `${(triforceCfg?.triforceName || 'TRIFORCE PIECE').toUpperCase()} (${result.totalCollected}/${TOTAL_TRIFORCE_PIECES})`;
        p.isHoldingItem = true;
        p.heldItemType = item.type;
        p.heldItemTimer = 200;
        chiptune.playItemFanfare();
        if (this.activeSlot) {
          saveGameProgress(
            this.activeSlot.id,
            p,
            this.currentScreen.id,
            undefined,
            Array.from(this.visitedScreens),
            Array.from(this.collectedHeartContainers)
          );
        }
        break;
      }

      case ItemType.HEART:
        p.hearts = Math.min(p.maxHearts, p.hearts + item.amount);
        chiptune.playHeart();
        break;

      case ItemType.HEART_CONTAINER: {
        const containerId: string | undefined =
          item.customData?.heartContainerId ??
          getCaveHeartContainerId(this.currentScreen.id) ??
          undefined;
        const result = applyHeartContainerUpgrade(
          p,
          this.collectedHeartContainers,
          containerId
        );
        if (result.upgraded) {
          chiptune.playItemFanfare();
          this.particles.emitSparkleBurst(p.x + 8, p.y + 8);
          p.isHoldingItem = true;
          p.heldItemType = item.type;
          p.heldItemTimer = 100;
          this.heartUpgradeBannerTimer = 140;
          this.heartUpgradeBannerText = `HEART CONTAINER! MAX LIFE ${result.totalContainers}/16`;
          if (this.currentScreen.id === 'C_SECRET_FAIRY_SPRING') {
            this.revealedSecrets.add('claimed_fairy_heart');
          }
          if (this.currentScreen.id === 'C_SECRET_HEART') {
            this.revealedSecrets.add('claimed_cave_secret_heart');
          }
          if (this.currentScreen.id === 'D2_SECRET_SHRINE') {
            this.revealedSecrets.add('claimed_d2_shrine_heart');
          }
          if (this.activeSlot) {
            saveGameProgress(
              this.activeSlot.id,
              p,
              this.currentScreen.id,
              undefined,
              Array.from(this.visitedScreens),
              Array.from(this.collectedHeartContainers)
            );
          }
        }
        break;
      }

      case ItemType.RUPEE:
      case ItemType.RUPEE_FIVE:
        p.inventory.rupees = Math.min(255, p.inventory.rupees + item.amount);
        chiptune.playRupee();
        break;

      case ItemType.KEY:
        p.inventory.keys++;
        chiptune.playKey();
        break;

      case ItemType.BOMB:
        p.inventory.bombs = Math.min(16, p.inventory.bombs + item.amount);
        if (p.bItem === ItemType.NONE) {
          p.bItem = ItemType.BOMB;
        }
        chiptune.playRupee();
        break;

      case ItemType.BOOMERANG:
        p.inventory.hasBoomerang = true;
        p.bItem = ItemType.BOOMERANG;
        chiptune.playItemFanfare();
        p.isHoldingItem = true;
        p.heldItemType = item.type;
        p.heldItemTimer = 100;
        break;

      case ItemType.BOOMERANG_MAGICAL:
        p.inventory.hasMagicalBoomerang = true;
        p.inventory.hasBoomerang = true;
        p.bItem = ItemType.BOOMERANG_MAGICAL;
        chiptune.playItemFanfare();
        p.isHoldingItem = true;
        p.heldItemType = item.type;
        p.heldItemTimer = 100;
        break;

      case ItemType.BOW:
        p.inventory.hasBow = true;
        if (p.bItem === ItemType.NONE) p.bItem = ItemType.BOW;
        chiptune.playItemFanfare();
        p.isHoldingItem = true;
        p.heldItemType = item.type;
        p.heldItemTimer = 100;
        break;

      case ItemType.CANDLE_BLUE:
        p.inventory.hasCandle = true;
        p.inventory.hasBlueCandle = true;
        if (p.bItem === ItemType.NONE) p.bItem = ItemType.CANDLE_BLUE;
        chiptune.playItemFanfare();
        p.isHoldingItem = true;
        p.heldItemType = item.type;
        p.heldItemTimer = 100;
        break;

      case ItemType.CANDLE_RED:
        p.inventory.hasCandle = true;
        p.inventory.hasRedCandle = true;
        p.bItem = ItemType.CANDLE_RED;
        chiptune.playItemFanfare();
        p.isHoldingItem = true;
        p.heldItemType = item.type;
        p.heldItemTimer = 100;
        break;

      case ItemType.RECORDER:
        p.inventory.hasRecorder = true;
        if (p.bItem === ItemType.NONE) p.bItem = ItemType.RECORDER;
        chiptune.playItemFanfare();
        p.isHoldingItem = true;
        p.heldItemType = item.type;
        p.heldItemTimer = 100;
        break;

      case ItemType.MAGICAL_ROD:
        p.inventory.hasMagicalRod = true;
        if (p.bItem === ItemType.NONE) p.bItem = ItemType.MAGICAL_ROD;
        chiptune.playItemFanfare();
        p.isHoldingItem = true;
        p.heldItemType = item.type;
        p.heldItemTimer = 100;
        break;

      case ItemType.MAGICAL_SHIELD:
        p.hasShield = true;
        p.shieldTier = 2;
        p.hasMagicalShield = true;
        p.inventory.hasShield = true;
        p.inventory.hasMagicalShield = true;
        chiptune.playItemFanfare();
        p.isHoldingItem = true;
        p.heldItemType = item.type;
        p.heldItemTimer = 100;
        break;

      case ItemType.STEPPING_LADDER:
        p.hasSteppingLadder = true;
        p.inventory.hasSteppingLadder = true;
        chiptune.playItemFanfare();
        p.isHoldingItem = true;
        p.heldItemType = item.type;
        p.heldItemTimer = 100;
        break;

      case ItemType.POWER_BRACELET:
        p.inventory.hasPowerBracelet = true;
        chiptune.playItemFanfare();
        p.isHoldingItem = true;
        p.heldItemType = item.type;
        p.heldItemTimer = 100;
        break;

      case ItemType.POTION_BLUE:
        p.inventory.potionTier = Math.max(p.inventory.potionTier || 0, 1);
        p.bItem = ItemType.POTION_BLUE;
        chiptune.playItemFanfare();
        p.isHoldingItem = true;
        p.heldItemType = item.type;
        p.heldItemTimer = 100;
        break;

      case ItemType.POTION_RED:
        p.inventory.potionTier = 2;
        p.bItem = ItemType.POTION_RED;
        chiptune.playItemFanfare();
        p.isHoldingItem = true;
        p.heldItemType = item.type;
        p.heldItemTimer = 100;
        break;

      case ItemType.FOOD:
        p.inventory.hasFood = true;
        if (p.bItem === ItemType.NONE) p.bItem = ItemType.FOOD;
        chiptune.playItemFanfare();
        p.isHoldingItem = true;
        p.heldItemType = item.type;
        p.heldItemTimer = 100;
        break;

      case ItemType.CLOCK:
        this.clockFreezeTimer = 360; // 6 seconds
        chiptune.playSecret();
        break;

      case ItemType.BLUE_RING:
        p.ringTier = Math.max(p.ringTier || 0, 1);
        p.hasBlueRing = true;
        chiptune.playItemFanfare();
        p.isHoldingItem = true;
        p.heldItemType = item.type;
        p.heldItemTimer = 100;
        if (this.activeSlot) {
          saveGameProgress(this.activeSlot.id, p, this.currentScreen.id);
        }
        break;

      case ItemType.RED_RING:
        p.ringTier = 2;
        p.hasRedRing = true;
        p.hasBlueRing = true;
        chiptune.playItemFanfare();
        p.isHoldingItem = true;
        p.heldItemType = item.type;
        p.heldItemTimer = 100;
        if (this.activeSlot) {
          saveGameProgress(this.activeSlot.id, p, this.currentScreen.id);
        }
        break;

      case ItemType.FAIRY:
        p.hearts = Math.min(p.maxHearts, p.hearts + 6); // Heals 3 full hearts
        chiptune.playHealPotion();
        this.particles.emitSparkleBurst(p.x + 8, p.y + 8);
        break;
    }

    this.onPlayerUpdate?.(p);
  }

  private damagePlayer(amount: number, fromDir: Direction) {
    const p = this.player;
    if (p.invincibleTimer > 0) return;
    if (
      this.playerDeathState.active ||
      this.gameState === GameState.DYING ||
      this.gameState === GameState.GAME_OVER
    ) {
      return;
    }

    // Damage reduction from Rings (Tier 1 = Blue Ring: -50%, Tier 2 = Red Ring: -75%)
    let effectiveDamage = amount;
    const ringTier = p.ringTier || (p.hasRedRing ? 2 : p.hasBlueRing ? 1 : 0);
    if (ringTier === 1) {
      effectiveDamage = Math.max(0.25, amount * 0.5);
    } else if (ringTier >= 2) {
      effectiveDamage = Math.max(0.125, amount * 0.25);
    }

    p.hearts -= effectiveDamage;
    p.invincibleTimer = 45; // 0.75s invincibility frames
    chiptune.playPlayerHurt();

    // Knockback Link backwards
    let kx = 0;
    let ky = 0;
    const force = 3;
    if (fromDir === Direction.UP) ky = force;
    else if (fromDir === Direction.DOWN) ky = -force;
    else if (fromDir === Direction.LEFT) kx = force;
    else if (fromDir === Direction.RIGHT) kx = -force;

    p.knockback = { x: kx, y: ky, duration: 6 };

    this.onPlayerUpdate?.(p);

    if (p.hearts <= 0) {
      // Auto-consume potion on fatal blow if Link carries one!
      if (p.inventory.potionTier && p.inventory.potionTier > 0) {
        p.hearts = p.maxHearts;
        chiptune.playHealPotion();
        this.particles.emitSparkleBurst(p.x + 8, p.y + 8);
        if (p.inventory.potionTier === 2) {
          p.inventory.potionTier = 1;
          p.bItem = ItemType.POTION_BLUE;
        } else {
          p.inventory.potionTier = 0;
          if (p.bItem === ItemType.POTION_BLUE || p.bItem === ItemType.POTION_RED) {
            p.bItem = ItemType.NONE;
          }
        }
        p.invincibleTimer = 60;
        this.onPlayerUpdate?.(p);
        return;
      }
      p.hearts = 0;
      this.startPlayerDeathSequence();
    }
  }

  /**
   * Triggers the authentic 8-bit NES player death sequence:
   * 1. Ceases player inputs and halts active motions.
   * 2. Rapidly spins Link across the 4 cardinal directions (DOWN -> LEFT -> UP -> RIGHT)
   *    while cycling through authentic damage, spectral, and shadow NES color palettes.
   * 3. Plays a descending chromatic pulse chirp as Link rotates out of control.
   * 4. Detonates a custom 8-bit particle explosion (dual shockwaves, 8-directional smoke puffs,
   *    shattered heart fragments, hero green tunic shards, golden Triforce sparks, and ethereal wisps).
   * 5. Performs a smooth cinematic fade to black before transitioning to the Game Over screen.
   */
  public startPlayerDeathSequence() {
    if (this.playerDeathState.active) return;

    this.gameState = GameState.DYING;
    this.onStateChange?.(GameState.DYING);
    chiptune.stopBgm();

    // Stop player inputs and current motion
    this.player.isAttacking = false;
    this.player.knockback = { x: 0, y: 0, duration: 0 };
    this.player.invincibleTimer = 0;
    this.player.hearts = 0;
    this.input = {
      up: false,
      down: false,
      left: false,
      right: false,
      attack: false,
      item: false,
    };

    this.playerDeathState = {
      active: true,
      timer: 0,
      phase: 'spin',
      spinDir: this.player.dir,
      spinStep: 0,
      paletteIndex: 0,
      fadeAlpha: 0,
    };

    // Increment & persist per-slot Death Counter immediately upon fatal death trigger
    this.recordPlayerDeath();

    // Play 2A03 chiptune death chime sound effect the instant player's hearts reach zero
    chiptune.playDeathChime();
    chiptune.playDeathChimeStrike();
    chiptune.playPlayerDeathSpin(0);
  }

  private recordPlayerDeath() {
    const nextDeaths = Math.max(0, (this.player.deaths ?? this.activeSlot?.deaths ?? 0) + 1);
    this.player.deaths = nextDeaths;
    if (this.activeSlot) {
      this.activeSlot.deaths = nextDeaths;
      saveGameProgress(
        this.activeSlot.id,
        this.player,
        this.currentScreen.id,
        nextDeaths,
        Array.from(this.visitedScreens),
        Array.from(this.collectedHeartContainers)
      );
    }
    this.onPlayerUpdate?.(this.player);
  }

  private updatePlayerDeath() {
    if (!this.playerDeathState.active) return;

    // Advance combat particles so the explosion animates smoothly
    this.particles.update();

    // Shake screen during explosion
    if (this.screenShakeTimer > 0) {
      this.screenShakeTimer--;
    }

    const state = this.playerDeathState;
    state.timer++;

    if (state.phase === 'spin') {
      // 1. Spinning animation (Link rapidly turns DOWN -> LEFT -> UP -> RIGHT)
      const SPIN_ORDER: Direction[] = [
        Direction.DOWN,
        Direction.LEFT,
        Direction.UP,
        Direction.RIGHT,
      ];

      // Rotate every 4 frames (~15 direction changes per second)
      if (state.timer % 4 === 0) {
        state.spinStep++;
        const currentIdx = SPIN_ORDER.indexOf(state.spinDir);
        const nextIdx = (currentIdx + 1) % SPIN_ORDER.length;
        state.spinDir = SPIN_ORDER[nextIdx];

        // Play authentic descending pitch pulse chirp
        chiptune.playPlayerDeathSpin(state.spinStep);
      }

      // Flash palette every 3 frames across normal, damage red, cyan/white, and death gray
      if (state.timer % 3 === 0) {
        state.paletteIndex = (state.paletteIndex + 1) % DEATH_PALETTES.length;
      }

      // Subtle wobble/tremble as death takes hold
      if (state.timer % 2 === 0) {
        const shakeX = (Math.random() - 0.5) * 0.8;
        const shakeY = (Math.random() - 0.5) * 0.8;
        this.player.x = Math.max(0, Math.min(SCREEN_WIDTH - 16, this.player.x + shakeX));
        this.player.y = Math.max(0, Math.min(SCREEN_HEIGHT - 16, this.player.y + shakeY));
      }

      // Spin completes after 64 frames (4 complete 360-degree rotations)
      if (state.timer >= 64) {
        state.phase = 'explode';
        state.timer = 0;

        // Trigger screen shake and climactic 8-bit particle explosion
        this.triggerScreenShake(20, 2);
        chiptune.playPlayerDeathExplosion();
        this.particles.emitPlayerDeath(this.player.x + 8, this.player.y + 8);
      }
    } else if (state.phase === 'explode') {
      // 2. Custom 8-bit particle explosion plays out (Link is vaporized)
      // Duration: 70 frames (~1.16 seconds)
      if (state.timer >= 70) {
        state.phase = 'fade';
        state.timer = 0;
      }
    } else if (state.phase === 'fade') {
      // 3. Screen darkens softly to black before Game Over screen appears
      state.fadeAlpha = Math.min(1.0, state.timer / 24);

      if (state.timer >= 28) {
        // Persist latest slot state (death already counted in recordPlayerDeath)
        if (this.activeSlot) {
          saveGameProgress(
            this.activeSlot.id,
            this.player,
            this.currentScreen.id,
            this.activeSlot.deaths,
            Array.from(this.visitedScreens),
            Array.from(this.collectedHeartContainers)
          );
        }

        // Complete death sequence and transition to Game Over
        state.active = false;
        this.gameState = GameState.GAME_OVER;
        this.onStateChange?.(GameState.GAME_OVER);
        chiptune.playGameOverTheme();
      }
    }
  }

  // --- TILE COLLISION & SCREEN BOUNDARY TRANSITIONS ---

  private checkTileCollision(x: number, y: number, width: number, height: number): boolean {
    return checkGridTileCollision(this.currentScreen.tiles, x, y, width, height);
  }

  private checkProjectileTileCollision(x: number, y: number, width: number, height: number): boolean {
    const minCol = Math.floor(x / TILE_SIZE);
    const maxCol = Math.floor((x + width - 1) / TILE_SIZE);
    const minRow = Math.floor(y / TILE_SIZE);
    const maxRow = Math.floor((y + height - 1) / TILE_SIZE);

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        if (r < 0 || r >= 11 || c < 0 || c >= 16) continue;
        const tile = this.currentScreen.tiles[r][c];
        if (isProjectileSolidTile(tile)) {
          return true;
        }
      }
    }
    return false;
  }

  private checkScreenTransitions() {
    // Guard: never check or trigger new screen transitions if already transitioning, fading, or not playing
    if (this.gameState !== GameState.PLAYING || this.fade.active || this.transition.active) {
      return;
    }

    const p = this.player;

    // Check Cave / Dungeon entrance and secret passage collision
    const centerCol = Math.floor((p.x + 8) / TILE_SIZE);
    const centerRow = Math.floor((p.y + 8) / TILE_SIZE);
    if (centerRow >= 0 && centerRow < 11 && centerCol >= 0 && centerCol < 16) {
      const tile = this.currentScreen.tiles[centerRow][centerCol];
      if (tile === 4) {
        // Entering Cave or Dungeon -> Smooth black-screen fade transition
        if (this.currentScreen.exits.cave) {
          console.log(
            `[GameEngine.checkScreenTransitions] Entering cave entrance: current="${this.currentScreen.id}", target="${this.currentScreen.exits.cave}"`
          );
          chiptune.playStairsDown();
          this.startFadeTransition(this.currentScreen.exits.cave, 120, 140, Direction.UP, 0.05);
          return;
        } else if (this.currentScreen.exits.dungeon) {
          console.log(
            `[GameEngine.checkScreenTransitions] Entering dungeon entrance: current="${this.currentScreen.id}", target="${this.currentScreen.exits.dungeon}"`
          );
          chiptune.playStairsDown();
          this.startFadeTransition(this.currentScreen.exits.dungeon, 120, 140, Direction.UP, 0.05);
          return;
        }
      }

      // Check if player stepped onto secret stairs (tile 15), bomb hole (tile 16), or revealed passage
      if (tile === 15 || tile === 16 || tile === 4) {
        if (this.currentScreen.secrets) {
          const secret = this.currentScreen.secrets.find(
            (s) =>
              this.revealedSecrets.has(s.id) &&
              ((s.row === centerRow && s.col === centerCol) ||
                Boolean(s.pairedTiles?.some((pt) => pt.row === centerRow && pt.col === centerCol)))
          );
          if (secret && secret.targetScreenId) {
            console.log(
              `[GameEngine.checkScreenTransitions] Entering secret passage: secretId="${secret.id}", target="${secret.targetScreenId}"`
            );
            if (tile === 16) {
              chiptune.playDoorTransition();
            } else {
              chiptune.playStairsDown();
            }
            this.startFadeTransition(
              secret.targetScreenId,
              secret.targetX ?? 120,
              secret.targetY ?? 130,
              secret.targetDir ?? Direction.UP,
              0.05
            );
            return;
          }
        }
      }

      // If in D1_SECRET_VAULT and stepped on stairs at row 8, col 7:
      if (this.currentScreen.id === 'D1_SECRET_VAULT' && centerRow === 8 && centerCol === 7) {
        chiptune.playStairsUp();
        this.startFadeTransition('D1_2', 120, 92, Direction.DOWN, 0.05);
        return;
      }

      // If in D1_SECRET_CHAMBER and stepped on stairs at row 8, col 7:
      if (this.currentScreen.id === 'D1_SECRET_CHAMBER' && centerRow === 8 && centerCol === 7) {
        chiptune.playStairsUp();
        this.startFadeTransition('D1_3', 120, 36, Direction.DOWN, 0.05);
        return;
      }
    }

    // Exiting Cave (e.g. C_START to O7_7, C_SHOP to O5_7, C_GAMBLE to O8_6, etc.)
    if (this.currentScreen.type === 'cave' && p.y >= SCREEN_HEIGHT - 16 && this.currentScreen.exits.down) {
      console.log(
        `[GameEngine.checkScreenTransitions] Exiting cave "${this.currentScreen.id}" to overworld "${this.currentScreen.exits.down}"`
      );
      chiptune.playStairsUp();
      if (this.currentScreen.id === 'C_START') {
        this.startFadeTransition('O7_7', 88, 64, Direction.DOWN, 0.05);
      } else if (this.currentScreen.id === 'C_SHOP') {
        this.startFadeTransition('O5_7', 120, 68, Direction.DOWN, 0.05);
      } else if (this.currentScreen.id === 'C_SECRET_SHOP') {
        this.startFadeTransition(this.currentScreen.exits.down || 'O7_5', 104, 128, Direction.DOWN, 0.05);
      } else if (this.currentScreen.id === 'C_GAMBLE') {
        this.startFadeTransition('O8_6', 88, 84, Direction.DOWN, 0.05);
      } else if (this.currentScreen.id === 'C_SECRET_RUPEE') {
        this.startFadeTransition('O8_7', 120, 70, Direction.DOWN, 0.05);
      } else if (this.currentScreen.id === 'C_SECRET_HEART') {
        this.startFadeTransition('O6_7', 40, 52, Direction.DOWN, 0.05);
      } else if (this.currentScreen.id === 'C_SECRET_WHITE_SWORD') {
        this.startFadeTransition('O7_6', 36, 40, Direction.DOWN, 0.05);
      } else if (this.currentScreen.id === 'C_SECRET_FAIRY_SPRING') {
        this.startFadeTransition('O7_5', 212, 40, Direction.DOWN, 0.05);
      } else {
        this.startFadeTransition(this.currentScreen.exits.down, 120, 88, Direction.DOWN, 0.05);
      }
      return;
    }

    // Exiting Dungeon Entrance Rooms (e.g. D1_1 to O7_4, D2_1 to O6_6)
    if (this.currentScreen.id === 'D1_1' && p.y >= SCREEN_HEIGHT - 16 && this.currentScreen.exits.down) {
      console.log(`[GameEngine.checkScreenTransitions] Exiting Dungeon 1 entrance to overworld`);
      chiptune.playStairsUp();
      this.startFadeTransition(this.currentScreen.exits.down, 120, 116, Direction.DOWN, 0.05);
      return;
    }
    if (this.currentScreen.id === 'D2_1' && p.y >= SCREEN_HEIGHT - 16 && this.currentScreen.exits.down) {
      console.log(`[GameEngine.checkScreenTransitions] Exiting Dungeon 2 entrance to overworld`);
      chiptune.playStairsUp();
      this.startFadeTransition(this.currentScreen.exits.down, 120, 32, Direction.DOWN, 0.05);
      return;
    }

    // Horizontal / Vertical exits between rooms with safe axis snapping and responsive thresholds
    let targetId: string | undefined;
    let nextX = p.x;
    let nextY = p.y;
    let dir: Direction | null = null;

    if (p.x >= SCREEN_WIDTH - 16 && this.currentScreen.exits.right) {
      targetId = this.currentScreen.exits.right;
      nextX = 16;
      nextY = 88;
      dir = Direction.RIGHT;
    } else if (p.x <= 4 && this.currentScreen.exits.left) {
      targetId = this.currentScreen.exits.left;
      nextX = SCREEN_WIDTH - 30;
      nextY = 88;
      dir = Direction.LEFT;
    } else if (p.y <= 4 && this.currentScreen.exits.up) {
      targetId = this.currentScreen.exits.up;
      nextX = 120;
      nextY = SCREEN_HEIGHT - 32;
      dir = Direction.UP;
    } else if (p.y >= SCREEN_HEIGHT - 20 && this.currentScreen.exits.down) {
      targetId = this.currentScreen.exits.down;
      nextX = 120;
      nextY = 16;
      dir = Direction.DOWN;
    }

    if (targetId && dir) {
      console.log(
        `[GameEngine.checkScreenTransitions] Room edge boundary triggered: current="${this.currentScreen.id}", target="${targetId}", dir="${dir}", nextX=${nextX}, nextY=${nextY}, mode="${this.transitionMode}"`
      );
      if (this.transitionMode === 'slide') {
        this.startTransition(dir, targetId);
      } else {
        chiptune.playRoomSwitch(dir);
        this.startFadeTransition(targetId, nextX, nextY, dir, undefined, undefined, this.transitionMode);
      }
    }
  }

  private fadeTickCount: number = 0;

  /**
   * Warps Link safely out to Hyrule Overworld after recovering a dungeon's Triforce piece
   * so players can continue hunting the remaining bosses and Triforce shards.
   */
  public continueFromVictory() {
    const cfg = getTriforceByScreenId(this.currentScreen.id);
    const targetScreen = cfg?.overworldExit.screenId ?? 'O7_7';
    const spawnX = cfg?.overworldExit.x ?? 120;
    const spawnY = cfg?.overworldExit.y ?? 88;

    this.player.hearts = this.player.maxHearts;
    this.player.dir = Direction.DOWN;
    this.resetFade();
    this.loadScreen(targetScreen, spawnX, spawnY);
    this.gameState = GameState.PLAYING;
    this.onPlayerUpdate?.(this.player);
    this.onStateChange?.(GameState.PLAYING);

    if (this.activeSlot) {
      saveGameProgress(
        this.activeSlot.id,
        this.player,
        this.currentScreen.id,
        undefined,
        Array.from(this.visitedScreens),
        Array.from(this.collectedHeartContainers)
      );
    }
  }

  /**
   * Immediately resets any active transition and restores play state.
   */
  public resetFade() {
    this.fade.active = false;
    this.fade.opacity = 0;
    this.fade.phase = 'none';
    this.fadeTickCount = 0;
    if (this.gameState === GameState.TRANSITIONING) {
      this.gameState = GameState.PLAYING;
      this.onStateChange?.(GameState.PLAYING);
    }
  }

  /**
   * Start a transition to a target screen.
   * Supports smooth fade, circular iris-in/out, 16x11 tile-flip mosaic cascade, or curtain wipe.
   */
  public startFadeTransition(
    targetScreenId: string,
    spawnX: number,
    spawnY: number,
    targetDir?: Direction,
    speed?: number,
    onComplete?: () => void,
    mode?: TransitionMode
  ) {
    const chosenMode = mode || (this.transitionMode === 'slide' ? 'fade' : this.transitionMode);
    console.log(
      `[GameEngine.startFadeTransition] Starting fade transition to target="${targetScreenId}" at (${spawnX}, ${spawnY}), dir=${targetDir}, mode="${chosenMode}"`
    );

    this.gameState = GameState.TRANSITIONING;
    this.prevScreen = this.currentScreen;

    let defaultSpeed = 0.05;
    if (chosenMode === 'iris') defaultSpeed = 0.04;
    else if (chosenMode === 'tile_flip') defaultSpeed = 0.035;
    else if (chosenMode === 'wipe') defaultSpeed = 0.045;

    this.fade = {
      active: true,
      opacity: 0,
      phase: 'out',
      speed: Math.max(0.02, speed || defaultSpeed),
      targetScreenId,
      targetX: spawnX,
      targetY: spawnY,
      targetDir,
      onPeak: undefined,
      onComplete,
      mode: chosenMode,
      originX: Math.round(this.player.x + 8),
      originY: Math.round(this.player.y + 8),
    };
    this.fadeTickCount = 0;
    this.onStateChange?.(GameState.TRANSITIONING);
  }

  /**
   * Generic screen transition trigger.
   * Runs transition to solid covered state, invokes onPeak, uncovers, invokes onComplete.
   */
  public triggerFade(
    onPeak?: () => void,
    onComplete?: () => void,
    speed?: number,
    mode?: TransitionMode
  ) {
    const chosenMode = mode || (this.transitionMode === 'slide' ? 'fade' : this.transitionMode);
    let defaultSpeed = 0.05;
    if (chosenMode === 'iris') defaultSpeed = 0.04;
    else if (chosenMode === 'tile_flip') defaultSpeed = 0.035;
    else if (chosenMode === 'wipe') defaultSpeed = 0.045;

    this.fade = {
      active: true,
      opacity: 0,
      phase: 'out',
      speed: Math.max(0.02, speed || defaultSpeed),
      targetScreenId: '',
      targetX: this.player.x,
      targetY: this.player.y,
      targetDir: undefined,
      onPeak,
      onComplete,
      mode: chosenMode,
      originX: Math.round(this.player.x + 8),
      originY: Math.round(this.player.y + 8),
    };
    this.fadeTickCount = 0;
  }

  /**
   * Transition reveal (opacity 1 -> 0).
   */
  public fadeIn(speed?: number, onComplete?: () => void, mode?: TransitionMode) {
    const chosenMode = mode || (this.transitionMode === 'slide' ? 'fade' : this.transitionMode);
    let defaultSpeed = 0.05;
    if (chosenMode === 'iris') defaultSpeed = 0.04;
    else if (chosenMode === 'tile_flip') defaultSpeed = 0.035;
    else if (chosenMode === 'wipe') defaultSpeed = 0.045;

    this.fade.active = true;
    this.fade.opacity = 1;
    this.fade.phase = 'in';
    this.fade.speed = Math.max(0.02, speed || defaultSpeed);
    this.fade.targetScreenId = '';
    this.fade.onComplete = onComplete;
    this.fade.mode = chosenMode;
    this.fade.originX = Math.round(this.player.x + 8);
    this.fade.originY = Math.round(this.player.y + 8);
    this.fadeTickCount = 0;
  }

  /**
   * Transition cover (opacity 0 -> 1).
   */
  public fadeOut(speed?: number, onComplete?: () => void, mode?: TransitionMode) {
    const chosenMode = mode || (this.transitionMode === 'slide' ? 'fade' : this.transitionMode);
    let defaultSpeed = 0.05;
    if (chosenMode === 'iris') defaultSpeed = 0.04;
    else if (chosenMode === 'tile_flip') defaultSpeed = 0.035;
    else if (chosenMode === 'wipe') defaultSpeed = 0.045;

    this.fade.active = true;
    this.fade.opacity = 0;
    this.fade.phase = 'out';
    this.fade.speed = Math.max(0.02, speed || defaultSpeed);
    this.fade.targetScreenId = '';
    this.fade.onPeak = onComplete;
    this.fade.mode = chosenMode;
    this.fade.originX = Math.round(this.player.x + 8);
    this.fade.originY = Math.round(this.player.y + 8);
    this.fadeTickCount = 0;
  }

  /**
   * Update transition physics per frame (called at 60 FPS).
   */
  private updateFade() {
    if (!this.fade.active) {
      this.fadeTickCount = 0;
      return;
    }

    this.fadeTickCount++;
    // Failsafe watchdog: max 180 frames (~3.0s) before auto-recovery
    if (this.fadeTickCount > 180) {
      console.warn(
        `[GameEngine.updateFade] Transition watchdog timed out after ${this.fadeTickCount} frames. Resetting transition.`
      );
      this.resetFade();
      return;
    }

    if (this.fade.phase === 'out') {
      this.fade.opacity += this.fade.speed;
      if (this.fade.opacity >= 1) {
        this.fade.opacity = 1;

        // Peak callback safely invoked
        try {
          this.fade.onPeak?.();
        } catch (err) {
          console.error('Error during fade onPeak:', err);
        }

        // If transitioning to another screen, switch screens at peak of transition
        if (this.fade.targetScreenId) {
          const targetId = this.fade.targetScreenId;
          const targetX = this.fade.targetX;
          const targetY = this.fade.targetY;
          console.log(
            `[GameEngine.updateFade] Reached peak opacity (1.0). Calling loadScreen("${targetId}", ${targetX}, ${targetY})`
          );
          this.fade.targetScreenId = ''; // Clear target immediately to prevent duplicate execution

          this.loadScreen(
            targetId,
            targetX,
            targetY
          );
          if (this.fade.targetDir) {
            this.player.dir = this.fade.targetDir;
          }
          this.player.moving = false;
          this.player.isAttacking = false;

          // Update origin for iris/wipe to Link's new spawn location
          this.fade.originX = Math.round(this.player.x + 8);
          this.fade.originY = Math.round(this.player.y + 8);

          if (this.activeSlot) {
            saveGameProgress(this.activeSlot.id, this.player, this.currentScreen.id);
          }
          this.onPlayerUpdate?.(this.player);
        }

        // Switch to transition reveal
        this.fade.phase = 'in';
      }
    } else if (this.fade.phase === 'in') {
      this.fade.opacity -= this.fade.speed;
      if (this.fade.opacity <= 0.02) {
        console.log(`[GameEngine.updateFade] Transition reveal completed. Restoring gameState to PLAYING.`);
        this.fade.opacity = 0;
        this.fade.active = false;
        this.fade.phase = 'none';
        this.fadeTickCount = 0;

        if (this.gameState === GameState.TRANSITIONING) {
          this.gameState = GameState.PLAYING;
          this.onStateChange?.(GameState.PLAYING);
        }

        try {
          const completeCb = this.fade.onComplete;
          this.fade.onComplete = undefined;
          completeCb?.();
        } catch (err) {
          console.error('Error during fade onComplete:', err);
        }
      }
    }
  }

  private lastScrollTick: number = 0;

  private startTransition(dir: Direction, targetId: string) {
    console.log(
      `[GameEngine.startTransition] Starting slide transition: dir=${dir}, targetId="${targetId}"`
    );
    this.gameState = GameState.TRANSITIONING;
    this.prevScreen = this.currentScreen;
    this.transition = {
      active: true,
      dir,
      progress: 0,
      targetScreenId: targetId,
    };
    this.lastScrollTick = 0;
    chiptune.playScreenScrollStart(dir);
  }

  private updateTransition() {
    this.transition.progress += 0.04; // Smooth slide speed

    // Trigger authentic NES rhythmic tile-scrolling ticks during slide
    const currentTick = Math.floor(this.transition.progress * 4);
    if (currentTick > this.lastScrollTick && this.transition.progress < 0.96) {
      this.lastScrollTick = currentTick;
      chiptune.playScreenScrollTick(this.transition.progress);
    }

    if (this.transition.progress >= 1) {
      this.transition.active = false;
      chiptune.playScreenScrollEnd();
      const targetScreen = this.screens[this.transition.targetScreenId] || this.screens.O7_7;

      let nextX = this.player.x;
      let nextY = this.player.y;

      if (this.transition.dir === Direction.RIGHT) {
        nextX = 16;
        nextY = 88;
      } else if (this.transition.dir === Direction.LEFT) {
        nextX = SCREEN_WIDTH - 30;
        nextY = 88;
      } else if (this.transition.dir === Direction.UP) {
        nextX = 120;
        nextY = SCREEN_HEIGHT - 32;
      } else if (this.transition.dir === Direction.DOWN) {
        nextX = 120;
        nextY = 16;
      }

      console.log(
        `[GameEngine.updateTransition] Slide transition completed to "${targetScreen.id}" at (${nextX}, ${nextY})`
      );
      this.loadScreen(targetScreen.id, nextX, nextY);
      this.gameState = GameState.PLAYING;
      this.onStateChange?.(GameState.PLAYING);
      this.onPlayerUpdate?.(this.player);

      if (this.activeSlot) {
        saveGameProgress(this.activeSlot.id, this.player, this.currentScreen.id);
      }
    }
  }

  // --- RENDERING PIPELINE (60 FPS) ---

  private render() {
    const ctx = this.ctx;
    ctx.save();

    // Subtle screen shake for visceral combat feedback
    if (this.screenShakeTimer > 0) {
      const shakeAmt = this.screenShakeIntensity;
      const sx = Math.floor((Math.random() - 0.5) * (shakeAmt * 2 + 1));
      const sy = Math.floor((Math.random() - 0.5) * (shakeAmt * 2 + 1));
      ctx.translate(sx, sy);
    }

    ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    if (this.gameState === GameState.TRANSITIONING && this.prevScreen && !this.fade.active) {
      this.renderScreenTransition();
      return;
    }

    this.renderScreen(this.currentScreen, 0, 0);

    // Render Pickups with pop bounce entrance and blinking before despawn
    this.pickups.forEach((item) => {
      // Urgent blink when less than 2 seconds left (< 120 frames)
      if (item.timer < 120 && Math.floor(item.timer / 4) % 2 === 0) return;

      // Vertical bounce as item emerges from the poof
      const bounce =
        item.spawnTimer && item.spawnTimer > 0
          ? Math.sin((item.spawnTimer / 14) * Math.PI) * 4
          : Math.round(
              Math.sin(this.animTick * 0.12) *
                (item.type === ItemType.HEART_CONTAINER || item.type === ItemType.TRIFORCE ? 1.5 : 0)
            );

      if (item.type === ItemType.HEART_CONTAINER || item.type === ItemType.TRIFORCE) {
        const haloAlpha = Math.floor(this.animTick / 6) % 2 === 0 ? 0.35 : 0.2;
        ctx.fillStyle = `rgba(248, 184, 0, ${haloAlpha})`;
        ctx.fillRect(item.x - 1, item.y - bounce - 1, 18, 18);
      }

      drawItem(ctx, item.type, item.x, item.y - bounce);
    });

    // Render Bombs
    this.bombs.forEach((bomb) => {
      if (!bomb.exploded) {
        drawItem(ctx, ItemType.BOMB, bomb.x, bomb.y);
      } else {
        // Explosion smoke
        ctx.fillStyle = NES_COLORS.WHITE;
        ctx.beginPath();
        ctx.arc(bomb.x + 8, bomb.y + 8, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = NES_COLORS.RED;
        ctx.beginPath();
        ctx.arc(bomb.x + 8, bomb.y + 8, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Render Projectiles
    this.projectiles.forEach((p) => {
      drawProjectile(ctx, p);
    });

    // Render Food Bait
    if (this.foodBait && this.foodBait.timer > 0) {
      drawItem(ctx, ItemType.FOOD, this.foodBait.x, this.foodBait.y);
    }

    // Render Enemies
    this.enemies.forEach((enemy) => {
      if (enemy.isDead) {
        // While dying, flickering shrinking core alongside particle burst
        if (enemy.deathTimer % 2 === 0 && enemy.deathTimer > 0) {
          ctx.fillStyle = NES_COLORS.WHITE;
          const s = Math.max(2, Math.floor(enemy.deathTimer / 3));
          ctx.fillRect(enemy.x + 8 - s / 2, enemy.y + 8 - s / 2, s, s);
        }
        return;
      }
      if ((enemy as any).isSubmerged || (enemy as any).isHidden) {
        return;
      }
      drawEnemy(ctx, enemy);
    });

    // Render Player Link (or spinning death animation)
    if (this.gameState === GameState.DYING) {
      if (this.playerDeathState.phase === 'spin') {
        const palette =
          DEATH_PALETTES[this.playerDeathState.paletteIndex % DEATH_PALETTES.length];
        drawLink(
          ctx,
          this.player.x,
          this.player.y,
          this.playerDeathState.spinDir,
          0,
          false,
          false,
          false,
          this.player.swordTier,
          palette
        );
      }
      // Note: when phase is 'explode' or 'fade', Link is vaporized and particles render the explosion!
    } else {
      drawLink(
        ctx,
        this.player.x,
        this.player.y,
        this.player.dir,
        this.player.animFrame,
        this.player.isAttacking,
        this.player.invincibleTimer > 0,
        this.player.isHoldingItem,
        this.player.swordTier,
        undefined,
        Boolean(this.player.hasMagicalShield || this.player.inventory.hasMagicalShield),
        this.player.ringTier ??
          (this.player.hasRedRing || this.player.inventory.hasRedRing
            ? 2
            : this.player.hasBlueRing || this.player.inventory.hasBlueRing
            ? 1
            : 0),
        LikeLikeEnemy.playerHasShield(this.player)
      );
    }

    // If holding item, draw item floating overhead
    if (this.player.isHoldingItem && this.player.heldItemType) {
      drawItem(ctx, this.player.heldItemType, this.player.x, this.player.y - 14);
    }

    // Render Active Combat Particles (Sword Sparks, Death Clouds, Embers, Wisps)
    this.particles.render(ctx);

    // Render Global Weather (8-bit rain streaks, splashes, ambient twilight tint, lightning flash)
    this.weather.render(ctx);

    // Debug Hitbox Overlay: highlights collision rectangles of player and enemies
    if (this.showHitboxDebug) {
      this.renderDebugHitboxes();
    }

    // Heart Container Upgrade Notification Banner
    if (this.heartUpgradeBannerTimer > 0 && this.heartUpgradeBannerText) {
      ctx.save();
      ctx.font = '6px "Press Start 2P", monospace, sans-serif';
      const tw = Math.ceil(ctx.measureText(this.heartUpgradeBannerText).width) + 12;
      const bx = Math.max(4, Math.floor((SCREEN_WIDTH - tw) / 2));
      ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
      ctx.fillRect(bx, 18, tw, 14);
      ctx.strokeStyle = '#f8b800';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 0.5, 18.5, tw - 1, 13);
      ctx.fillStyle = '#f8b800';
      ctx.textAlign = 'center';
      ctx.fillText(this.heartUpgradeBannerText, SCREEN_WIDTH / 2, 28);
      ctx.restore();
    }

    // Temporary Entry Trigger Volume Debug Overlay: highlights invisible entry/exit/secret trigger zones
    if (this.showEntryTriggerDebug) {
      this.renderDebugEntryTriggers();
    }

    // Screen transition wipe/fade overlay (supports fade, iris-in/out, tile-flip, or curtain wipe)
    if (this.fade.active && (this.fade.opacity > 0 || this.fade.phase === 'in')) {
      this.renderScreenWipeOverlay();
    }

    // Death sequence black-screen fade overlay
    if (this.gameState === GameState.DYING && this.playerDeathState.fadeAlpha > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(1, Math.max(0, this.playerDeathState.fadeAlpha))})`;
      ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
      ctx.restore();
    }

    ctx.restore(); // Restore screen shake transform
  }

  /**
   * Render screen transition wipe animations:
   * - 'fade': Authentic NES smooth black fade-in / fade-out
   * - 'iris': Circular aperture iris-in (contracts to Link) and iris-out (expands outward)
   * - 'tile_flip': 8-bit 16x11 tile grid 3D flip cascade with NES bevel edges
   * - 'wipe': Smooth horizontal shutter curtain wipe
   */
  private renderScreenWipeOverlay() {
    const ctx = this.ctx;
    const progress = Math.min(1, Math.max(0, this.fade.opacity));
    const mode = this.fade.mode || 'fade';
    const phase = this.fade.phase;

    ctx.save();

    if (mode === 'iris') {
      const cx = this.fade.originX ?? 128;
      const cy = this.fade.originY ?? 88;
      // Calculate max radius needed to reach the farthest screen corner
      const maxDist = Math.ceil(
        Math.max(
          Math.hypot(cx, cy),
          Math.hypot(SCREEN_WIDTH - cx, cy),
          Math.hypot(cx, SCREEN_HEIGHT - cy),
          Math.hypot(SCREEN_WIDTH - cx, SCREEN_HEIGHT - cy)
        )
      ) + 4;

      // Iris radius: when progress=0, radius=maxDist; when progress=1, radius=0
      // In 8-bit quantized 2px steps for authentic retro raster aesthetic
      const rawRadius = Math.max(0, maxDist * (1 - progress));
      const r = Math.round(rawRadius / 2) * 2;

      ctx.fillStyle = '#000000';
      ctx.beginPath();
      // Outer screen bounds
      ctx.rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
      if (r > 0) {
        // Cut out aperture circle (counter-clockwise creates transparent hole)
        ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
      }
      ctx.fill();

      // Subtle 8-bit NES aperture ring border
      if (r > 3 && r < maxDist - 4) {
        // Outer dark rim
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = '#181824';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Subtle 1px gold/teal glint highlight
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(1, r - 1), 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(248, 184, 0, 0.45)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    } else if (mode === 'tile_flip') {
      // 16 columns by 11 rows of 16x16 tiles
      const cols = 16;
      const rows = 11;
      const maxDiag = 15 + 10; // 25
      const waveSpeed = 0.45;
      const flipDuration = 0.55;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const diag = c + r;
          const stagger = (diag / maxDiag) * waveSpeed;
          const cellX = c * 16;
          const cellY = r * 16;
          const centerX = cellX + 8;

          if (phase === 'out') {
            // progress goes from 0 to 1
            const localT = Math.min(1, Math.max(0, (progress - stagger) / flipDuration));

            if (localT <= 0) {
              // Not yet started flipping: screen tile is normal underneath
              continue;
            } else if (localT >= 1) {
              // Fully flipped to black
              ctx.fillStyle = '#000000';
              ctx.fillRect(cellX, cellY, 16, 16);
            } else if (localT < 0.5) {
              // Rotating away (0 to 90 degrees) -> tile face narrows
              const scale = Math.cos(localT * Math.PI); // 1 -> 0
              const halfW = Math.max(0, 8 * scale);
              const inset = 8 - halfW;

              // Black background revealed around the shrinking tile
              ctx.fillStyle = '#000000';
              ctx.fillRect(cellX, cellY, inset, 16);
              ctx.fillRect(centerX + halfW, cellY, inset, 16);

              // 8-bit bevel highlight on the rotating vertical edge
              ctx.fillStyle = 'rgba(0, 232, 216, 0.6)';
              ctx.fillRect(Math.floor(centerX - halfW), cellY, 1, 16);
              ctx.fillRect(Math.floor(centerX + halfW - 1), cellY, 1, 16);
            } else {
              // Past 90 degrees (90 to 180 degrees) -> solid black back flips in
              const scale = -Math.cos(localT * Math.PI); // 0 -> 1
              const halfW = Math.max(0, 8 * scale);

              // Entire cell space is black
              ctx.fillStyle = '#000000';
              ctx.fillRect(cellX, cellY, 16, 16);

              // 3D perspective shading on the flipping black tile face
              ctx.fillStyle = '#14141c';
              ctx.fillRect(centerX - halfW, cellY, halfW * 2, 16);

              // Subtle highlight on leading edge
              ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
              ctx.fillRect(Math.floor(centerX - halfW), cellY, 1, 16);
              ctx.fillRect(Math.floor(centerX + halfW - 1), cellY, 1, 16);
            }
          } else {
            // phase === 'in': progress goes from 1 to 0
            // revealT goes from 0 (all black) to 1 (all revealed)
            const revealT = 1 - progress;
            const localT = Math.min(1, Math.max(0, (revealT - stagger) / flipDuration));

            if (localT <= 0) {
              // Still solid black
              ctx.fillStyle = '#000000';
              ctx.fillRect(cellX, cellY, 16, 16);
            } else if (localT >= 1) {
              // Fully revealed new screen underneath
              continue;
            } else if (localT < 0.5) {
              // Black face rotating away (0 to 90 degrees)
              const scale = Math.cos(localT * Math.PI); // 1 -> 0
              const halfW = Math.max(0, 8 * scale);

              // Black face in the center
              ctx.fillStyle = '#000000';
              ctx.fillRect(centerX - halfW, cellY, halfW * 2, 16);

              // Subtle edge
              ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
              ctx.fillRect(Math.floor(centerX - halfW), cellY, 1, 16);
              ctx.fillRect(Math.floor(centerX + halfW - 1), cellY, 1, 16);
            } else {
              // New screen tile face expanding into view
              const scale = -Math.cos(localT * Math.PI); // 0 -> 1
              const halfW = Math.max(0, 8 * scale);
              const inset = 8 - halfW;

              // Black bars on the remaining unrevealed outer portions
              ctx.fillStyle = '#000000';
              ctx.fillRect(cellX, cellY, inset, 16);
              ctx.fillRect(centerX + halfW, cellY, inset, 16);

              // Bevel highlight on emerging edge
              ctx.fillStyle = 'rgba(0, 232, 216, 0.6)';
              ctx.fillRect(Math.floor(centerX - halfW), cellY, 1, 16);
              ctx.fillRect(Math.floor(centerX + halfW - 1), cellY, 1, 16);
            }
          }
        }
      }
    } else if (mode === 'wipe') {
      // Horizontal shutter curtain wipe
      const halfWidth = SCREEN_WIDTH / 2;
      const w = Math.ceil(halfWidth * progress);

      ctx.fillStyle = '#000000';
      // Left curtain
      ctx.fillRect(0, 0, w, SCREEN_HEIGHT);
      // Right curtain
      ctx.fillRect(SCREEN_WIDTH - w, 0, w, SCREEN_HEIGHT);

      // Subtle 8-bit vertical leading edge highlight strip
      if (w > 1 && w < halfWidth) {
        ctx.fillStyle = 'rgba(0, 232, 216, 0.7)';
        ctx.fillRect(w - 2, 0, 2, SCREEN_HEIGHT);
        ctx.fillRect(SCREEN_WIDTH - w, 0, 2, SCREEN_HEIGHT);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fillRect(w - 3, 0, 1, SCREEN_HEIGHT);
        ctx.fillRect(SCREEN_WIDTH - w + 2, 0, 1, SCREEN_HEIGHT);
      }
    } else {
      // Authentic smooth black fade
      ctx.fillStyle = `rgba(0, 0, 0, ${progress})`;
      ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    }

    ctx.restore();
  }

  /**
   * Render real-time collision bounding boxes (hitboxes) for player Link and enemies currently on screen.
   * Highlights sword reach, enemy hurt states, and active projectiles to assist in engine collision debugging.
   */
  private renderDebugHitboxes() {
    const ctx = this.ctx;
    ctx.save();

    // 1. Player Link Hitbox (16x16 sprite & 14x14 tile collision)
    const px = Math.round(this.player.x);
    const py = Math.round(this.player.y);
    const pw = 16;
    const ph = 16;

    // Outer sprite bounding box: semi-transparent green fill + crisp neon green stroke
    ctx.fillStyle = 'rgba(0, 230, 118, 0.22)';
    ctx.fillRect(px, py, pw, ph);

    ctx.strokeStyle = '#00e676';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);

    // Inner tile collision box (14x14)
    ctx.strokeStyle = 'rgba(0, 230, 118, 0.6)';
    ctx.setLineDash([2, 2]);
    ctx.strokeRect(px + 1.5, py + 1.5, 13, 13);
    ctx.setLineDash([]);

    // Player position and state label
    ctx.font = '6px "Press Start 2P", monospace, sans-serif';
    ctx.fillStyle = '#00e676';
    ctx.textAlign = 'left';
    ctx.fillText(`LINK (${px},${py})`, px - 4, py - 3);

    // 1b. Player Sword Thrust Hitbox
    if (this.player.isAttacking) {
      let swX = px;
      let swY = py;
      const reach = 16;
      if (this.player.dir === Direction.UP) swY -= reach;
      else if (this.player.dir === Direction.DOWN) swY += reach;
      else if (this.player.dir === Direction.LEFT) swX -= reach;
      else if (this.player.dir === Direction.RIGHT) swX += reach;

      ctx.fillStyle = 'rgba(255, 215, 0, 0.35)';
      ctx.fillRect(swX, swY, 16, 16);

      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 1;
      ctx.strokeRect(swX + 0.5, swY + 0.5, 15, 15);

      ctx.fillStyle = '#ffd700';
      ctx.fillText('SWORD', swX, swY - 2);
    }

    // 2. Active Enemies Hitboxes
    let activeEnemyCount = 0;
    this.enemies.forEach((enemy) => {
      if (enemy.isDead || (enemy as any).isSubmerged || (enemy as any).isHidden) return;
      activeEnemyCount++;

      const ex = Math.round(enemy.x);
      const ey = Math.round(enemy.y);
      const isBoss = enemy.type === EnemyType.AQUAMENTUS;
      const ew = isBoss ? 32 : 16;
      const eh = isBoss ? 32 : 16;

      // Color scheme based on enemy state
      let fillColor = 'rgba(255, 40, 80, 0.25)';
      let strokeColor = '#ff2850';

      if (enemy.isHurt) {
        fillColor = 'rgba(255, 235, 59, 0.4)';
        strokeColor = '#ffeb3b';
      } else if (enemy.isStunned) {
        fillColor = 'rgba(0, 229, 255, 0.35)';
        strokeColor = '#00e5ff';
      } else if (enemy.behaviorState === 'flee') {
        fillColor = 'rgba(255, 170, 0, 0.35)';
        strokeColor = '#ffaa00';
      } else if (enemy.behaviorState === 'chase') {
        fillColor = 'rgba(255, 30, 60, 0.35)';
        strokeColor = '#ff1e3c';
      }

      ctx.fillStyle = fillColor;
      ctx.fillRect(ex, ey, ew, eh);

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(ex + 0.5, ey + 0.5, ew - 1, eh - 1);

      // Center crosshair marker
      ctx.fillStyle = strokeColor;
      ctx.fillRect(ex + ew / 2 - 1, ey + eh / 2 - 1, 2, 2);

      // Enemy Type & HP / AI State Tag
      const shortType = isBoss
        ? 'BOSS'
        : enemy.type.replace('enemy_', '').replace('_red', '').replace('_blue', '').toUpperCase();
      const stateTag = enemy.behaviorState ? ` [${enemy.behaviorState.toUpperCase()}]` : '';
      ctx.font = '5px "Press Start 2P", monospace, sans-serif';
      ctx.fillStyle = strokeColor;
      ctx.fillText(`${shortType}${stateTag} HP:${enemy.health}`, ex, ey - 2);
    });

    // 3. Projectiles Hitboxes (Sword beam, arrows, rocks, boomerangs, fireballs)
    this.projectiles.forEach((proj) => {
      if (!proj.active) return;
      const prX = Math.round(proj.x);
      const prY = Math.round(proj.y);
      const isPlayer = proj.owner === 'player';
      const prColor = isPlayer ? '#00e5ff' : '#ff9100';

      ctx.fillStyle = isPlayer ? 'rgba(0, 229, 255, 0.35)' : 'rgba(255, 145, 0, 0.35)';
      ctx.fillRect(prX, prY, 8, 8);

      ctx.strokeStyle = prColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(prX + 0.5, prY + 0.5, 7, 7);
    });

    // 4. Top-Right Corner Debug Diagnostics Badge
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(SCREEN_WIDTH - 108, 2, 106, 12);
    ctx.strokeStyle = '#00e676';
    ctx.lineWidth = 1;
    ctx.strokeRect(SCREEN_WIDTH - 107.5, 2.5, 105, 11);

    ctx.fillStyle = '#00e676';
    ctx.font = '5px "Press Start 2P", monospace, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`HITBOX DBG (E:${activeEnemyCount})`, SCREEN_WIDTH - 104, 10);

    ctx.restore();
  }

  /**
   * Returns all invisible entry/exit/secret trigger volumes mapped for the current screen.
   */
  public getEntryTriggerVolumes(): EntryTriggerVolume[] {
    return getScreenEntryTriggerVolumes(this.currentScreen, this.screens, this.revealedSecrets);
  }

  /**
   * Developer debug action: instantly teleports Link onto a selected trigger volume's
   * safe walkable entry coordinates and triggers screen transition checks immediately.
   */
  public warpToTriggerVolume(triggerId: string): {
    ok: boolean;
    screenId: string;
    targetScreenId?: string;
    x?: number;
    y?: number;
    transitionStarted: boolean;
    message: string;
  } {
    const trigger = this.getEntryTriggerVolumes().find((t) => t.id === triggerId);
    if (!trigger) {
      return {
        ok: false,
        screenId: this.currentScreen.id,
        transitionStarted: false,
        message: `Trigger "${triggerId}" not found on ${this.currentScreen.id}`,
      };
    }

    const warp = computeTriggerWarpPoint(trigger, this.currentScreen);
    if (!warp.canTeleport) {
      return {
        ok: false,
        screenId: this.currentScreen.id,
        targetScreenId: warp.targetScreenId,
        transitionStarted: false,
        message: warp.reason,
      };
    }

    const dirMap: Record<TriggerOrientationDir, Direction> = {
      up: Direction.UP,
      down: Direction.DOWN,
      left: Direction.LEFT,
      right: Direction.RIGHT,
    };

    // Reset any pending lock/fade/transition so teleport and screen transition run cleanly
    this.fade.active = false;
    this.fade.opacity = 0;
    this.fade.phase = 'none';
    this.transition.active = false;
    this.player.knockback = { x: 0, y: 0, duration: 0 };
    this.player.invincibleTimer = 0;
    this.player.attackTimer = 0;
    this.pushTimer = 0;

    if (this.gameState !== GameState.PLAYING) {
      this.gameState = GameState.PLAYING;
      this.onStateChange?.(GameState.PLAYING);
    }

    this.player.x = warp.x;
    this.player.y = warp.y;
    this.player.dir = dirMap[warp.dir];
    this.particles.emitSparkleBurst(this.player.x + 7, this.player.y + 7);
    this.onPlayerUpdate?.({ ...this.player });

    const prevScreenId = this.currentScreen.id;
    this.checkScreenTransitions();
    const transitionStarted = this.fade.active || this.transition.active;

    return {
      ok: true,
      screenId: prevScreenId,
      targetScreenId: trigger.targetScreenId,
      x: warp.x,
      y: warp.y,
      transitionStarted,
      message:
        transitionStarted && trigger.targetScreenId
          ? `Warping to ${trigger.targetScreenId} via ${trigger.label}`
          : warp.reason,
    };
  }

  /**
   * Temporary visual debugger highlighting every invisible entry/transition trigger volume
   * on the active screen (edge thresholds, walkable apertures, caves, dungeons, and secrets).
   */
  private renderDebugEntryTriggers() {
    const ctx = this.ctx;
    ctx.save();

    const triggers = this.getEntryTriggerVolumes();
    const loc = getPlayerOverworldLocation(this.currentScreen);

    for (const trig of triggers) {
      let fill = 'rgba(0, 229, 255, 0.18)';
      let stroke = '#00e5ff';

      if (trig.kind === 'unmapped_open_edge' || !trig.targetExists || (trig.kind === 'edge_exit' && !trig.isReachable)) {
        fill = 'rgba(255, 23, 68, 0.30)';
        stroke = '#ff1744';
      } else if (trig.kind === 'cave_entry' || trig.kind === 'dungeon_entry') {
        fill = 'rgba(224, 64, 251, 0.32)';
        stroke = '#e040fb';
      } else if (trig.kind === 'secret_entry') {
        if (trig.isRevealed) {
          fill = 'rgba(88, 248, 152, 0.30)';
          stroke = '#58f898';
        } else {
          fill = 'rgba(248, 184, 0, 0.20)';
          stroke = '#f8b800';
        }
      } else if (trig.kind === 'hardcoded_stairs') {
        fill = 'rgba(88, 248, 152, 0.30)';
        stroke = '#58f898';
      }

      // 1. Threshold zone checked by checkScreenTransitions()
      const tr = trig.thresholdRect;
      ctx.fillStyle = fill;
      ctx.fillRect(tr.x, tr.y, tr.width, tr.height);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      ctx.strokeRect(tr.x + 0.5, tr.y + 0.5, Math.max(1, tr.width - 1), Math.max(1, tr.height - 1));
      ctx.setLineDash([]);

      // 2. Highlight exact walkable doorway / entry tiles inside the trigger
      for (const wr of trig.walkableRects) {
        ctx.fillStyle = fill;
        ctx.fillRect(wr.x, wr.y, wr.width, wr.height);
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.25;
        ctx.strokeRect(wr.x + 0.5, wr.y + 0.5, wr.width - 1, wr.height - 1);

        // Diagonal hatched inner marker so doorways pop visually
        ctx.beginPath();
        ctx.moveTo(wr.x + 2, wr.y + 2);
        ctx.lineTo(wr.x + wr.width - 2, wr.y + wr.height - 2);
        ctx.moveTo(wr.x + wr.width - 2, wr.y + 2);
        ctx.lineTo(wr.x + 2, wr.y + wr.height - 2);
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 0.75;
        ctx.stroke();
      }

      // 3. Label positioned safely inside viewport next to the doorway or tile
      const anchor = trig.walkableRects[0] || tr;
      ctx.font = '5px "Press Start 2P", monospace, sans-serif';
      const textWidth = Math.ceil(ctx.measureText(trig.label).width) + 6;
      const boxH = 10;
      let lx = anchor.x;
      let ly = anchor.y - 12;

      if (trig.direction === 'left') {
        lx = 6;
        ly = Math.max(16, Math.min(SCREEN_HEIGHT - 14, anchor.y + 4));
      } else if (trig.direction === 'right') {
        lx = SCREEN_WIDTH - textWidth - 6;
        ly = Math.max(16, Math.min(SCREEN_HEIGHT - 14, anchor.y + 4));
      } else if (trig.direction === 'up') {
        lx = Math.max(4, Math.min(SCREEN_WIDTH - textWidth - 4, anchor.x - 12));
        ly = 16;
      } else if (trig.direction === 'down') {
        lx = Math.max(4, Math.min(SCREEN_WIDTH - textWidth - 4, anchor.x - 12));
        ly = SCREEN_HEIGHT - 28;
      } else {
        lx = Math.max(4, Math.min(SCREEN_WIDTH - textWidth - 4, anchor.x - 6));
        ly = ly < 16 ? anchor.y + anchor.height + 2 : ly;
      }

      ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
      ctx.fillRect(lx, ly, textWidth, boxH);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 0.75;
      ctx.strokeRect(lx + 0.5, ly + 0.5, textWidth - 1, boxH - 1);
      ctx.fillStyle = stroke;
      ctx.textAlign = 'left';
      ctx.fillText(trig.label, lx + 3, ly + 7);
    }

    // 4. Link trigger probe indicators: top-left edge rect + center tile probe
    const px = Math.round(this.player.x);
    const py = Math.round(this.player.y);
    ctx.strokeStyle = '#58f898';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, 13, 13);

    ctx.fillStyle = '#ffeb3b';
    ctx.fillRect(px + 7, py + 7, 3, 3);

    // 4b. Dry-Run Dead-Zone Validation Overlay (when triggered from #entry-trigger-inspector)
    const val = this.debugTriggerValidation;
    if (val && val.screenId === this.currentScreen.id) {
      // Valid walkable entry regions inside both screen bounds & trigger
      for (const vr of val.validEntryRects) {
        ctx.fillStyle = 'rgba(88, 248, 152, 0.32)';
        ctx.fillRect(vr.x, vr.y, vr.width, vr.height);
        ctx.strokeStyle = '#58f898';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(vr.x + 0.5, vr.y + 0.5, Math.max(1, vr.width - 1), Math.max(1, vr.height - 1));
      }

      // Solid boundary wall overlaps inside trigger threshold (amber stripes)
      for (const sr of val.solidOverlapRects) {
        ctx.fillStyle = 'rgba(248, 184, 0, 0.28)';
        ctx.fillRect(sr.x, sr.y, sr.width, sr.height);
        ctx.strokeStyle = '#f8b800';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.strokeRect(sr.x + 0.5, sr.y + 0.5, Math.max(1, sr.width - 1), Math.max(1, sr.height - 1));
        ctx.setLineDash([]);
      }

      // Critical unreachable / out-of-bounds dead-zone overlaps (bright red X-hatch)
      for (const dz of val.deadZoneRects) {
        const cx = Math.max(0, dz.x);
        const cy = Math.max(0, dz.y);
        const cw = Math.min(SCREEN_WIDTH, dz.x + dz.width) - cx;
        const ch = Math.min(SCREEN_HEIGHT, dz.y + dz.height) - cy;
        if (cw > 0 && ch > 0) {
          ctx.fillStyle = 'rgba(255, 23, 68, 0.45)';
          ctx.fillRect(cx, cy, cw, ch);
          ctx.strokeStyle = '#ff1744';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(cx + 0.5, cy + 0.5, Math.max(1, cw - 1), Math.max(1, ch - 1));
          ctx.beginPath();
          ctx.moveTo(cx + 1, cy + 1);
          ctx.lineTo(cx + cw - 1, cy + ch - 1);
          ctx.moveTo(cx + cw - 1, cy + 1);
          ctx.lineTo(cx + 1, cy + ch - 1);
          ctx.stroke();
        }
      }
    }

    // 5. Top-Left Trigger Diagnostics Banner
    const bannerText = `TRIGGERS ${this.currentScreen.id} [${loc.coordString}] (${triggers.length})`;
    ctx.font = '5px "Press Start 2P", monospace, sans-serif';
    const bw = Math.ceil(ctx.measureText(bannerText).width) + 8;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(2, 2, bw, 12);
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 1;
    ctx.strokeRect(2.5, 2.5, bw - 1, 11);
    ctx.fillStyle = '#00e5ff';
    ctx.textAlign = 'left';
    ctx.fillText(bannerText, 6, 10);

    ctx.restore();
  }

  private renderScreen(screen: ScreenData, offsetX: number, offsetY: number) {
    const ctx = this.ctx;

    // Draw 16x11 tiles
    for (let r = 0; r < 11; r++) {
      for (let c = 0; c < 16; c++) {
        const tile = screen.tiles[r][c];
        drawTile(
          ctx,
          tile,
          offsetX + c * TILE_SIZE,
          offsetY + r * TILE_SIZE,
          this.animTick,
          screen.type === 'dungeon'
        );
      }
    }

    // Render brief visual 'reveal' animation over newly discovered secret staircases
    this.renderStaircaseRevealAnimations(ctx, offsetX, offsetY);

    // Cave NPC, Torches, 8-Bit Text Engine, and Offered Item Altar
    if (screen.type === 'cave') {
      if (this.oldMan) {
        this.oldMan.render(ctx, offsetX, offsetY, this.animTick);
      } else {
        drawOldMan(ctx, offsetX + 120, offsetY + 48);
        drawTorch(ctx, offsetX + 80, offsetY + 48, Math.floor(this.animTick / 10));
        drawTorch(ctx, offsetX + 160, offsetY + 48, Math.floor(this.animTick / 10));

        // Classic dialogue text
        if (screen.caveText) {
          ctx.fillStyle = NES_COLORS.WHITE;
          ctx.font = '8px "Press Start 2P", monospace';
          ctx.textAlign = 'center';
          const lines = screen.caveText.split('\n');
          lines.forEach((line, i) => {
            ctx.fillText(line, offsetX + 128, offsetY + 28 + i * 12);
          });
        }
      }

      // Shop Items display
      if (screen.shopItems) {
        screen.shopItems.forEach((item) => {
          drawItem(ctx, item.type, offsetX + item.x, offsetY + item.y);
          ctx.fillStyle = NES_COLORS.WHITE;
          ctx.font = '6px "Press Start 2P", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${item.price}`, offsetX + item.x + 8, offsetY + item.y + 20);
          drawItem(ctx, ItemType.RUPEE, offsetX + item.x + 8, offsetY + item.y + 26);
        });
      }

      // Gambling Pots display
      if (screen.gamblePots) {
        screen.gamblePots.forEach((pot) => {
          if (pot.revealed) {
            ctx.fillStyle = pot.amount >= 0 ? NES_COLORS.OVERWORLD_ROCK_LIGHT : NES_COLORS.RED;
            ctx.font = '7px "Press Start 2P", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(
              `${pot.amount >= 0 ? '+' : ''}${pot.amount}`,
              offsetX + pot.x + 8,
              offsetY + pot.y + 12
            );
          } else {
            drawItem(ctx, ItemType.RUPEE_FIVE, offsetX + pot.x, offsetY + pot.y);
            ctx.fillStyle = NES_COLORS.WHITE;
            ctx.font = '6px "Press Start 2P", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('10?', offsetX + pot.x + 8, offsetY + pot.y + 20);
          }
        });
      }
    }
  }

  private renderScreenTransition() {
    const ctx = this.ctx;
    const progress = this.transition.progress;
    const nextScreen = this.screens[this.transition.targetScreenId];
    if (!this.prevScreen || !nextScreen) return;

    let prevX = 0, prevY = 0, nextX = 0, nextY = 0;

    if (this.transition.dir === Direction.RIGHT) {
      prevX = -progress * SCREEN_WIDTH;
      nextX = (1 - progress) * SCREEN_WIDTH;
    } else if (this.transition.dir === Direction.LEFT) {
      prevX = progress * SCREEN_WIDTH;
      nextX = -(1 - progress) * SCREEN_WIDTH;
    } else if (this.transition.dir === Direction.DOWN) {
      prevY = -progress * SCREEN_HEIGHT;
      nextY = (1 - progress) * SCREEN_HEIGHT;
    } else if (this.transition.dir === Direction.UP) {
      prevY = progress * SCREEN_HEIGHT;
      nextY = -(1 - progress) * SCREEN_HEIGHT;
    }

    this.renderScreen(this.prevScreen, prevX, prevY);
    this.renderScreen(nextScreen, nextX, nextY);

    // Draw Link sliding smoothly between screens
    drawLink(
      ctx,
      this.player.x + (nextX - prevX) * 0.5 * (1 - progress),
      this.player.y + (nextY - prevY) * 0.5 * (1 - progress),
      this.player.dir,
      0,
      false,
      false,
      false,
      this.player.swordTier
    );

    // Render weather during outdoor transition
    if (this.prevScreen.type === 'overworld' || nextScreen.type === 'overworld') {
      this.weather.render(ctx);
    }
  }

  // --- PUBLIC WEATHER CONTROLLER APIS ---

  public setWeather(type: WeatherType, forceImmediate: boolean = false) {
    this.weather.setWeather(type, forceImmediate);
  }

  public toggleWeather(): WeatherType {
    return this.weather.toggleWeather();
  }

  public getWeather(): WeatherType {
    return this.weather.weatherType;
  }

  public getWeatherState(): WeatherState {
    return this.weather.getState();
  }

  /**
   * Renders the brief visual 'reveal' animation over a newly uncovered secret staircase:
   * - Inward stepping opening shutter revealing subterranean depth
   * - Flashing radiant aura around the staircase perimeter
   * - Ascending vertical celestial light shafts
   * - Expanding diamond glint halo
   */
  private renderStaircaseRevealAnimations(
    ctx: CanvasRenderingContext2D,
    offsetX: number,
    offsetY: number
  ) {
    if (this.activeStaircaseReveals.length === 0) return;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    for (const anim of this.activeStaircaseReveals) {
      const progress = 1 - anim.timer / anim.maxTimer; // 0 (start) to 1 (complete)
      const tx = offsetX + anim.col * TILE_SIZE;
      const ty = offsetY + anim.row * TILE_SIZE;
      const cx = tx + 8;
      const cy = ty + 8;

      // 1. Inward staircase stepping shutter effect during first 50% of animation
      if (progress < 0.5) {
        const stepProgress = progress / 0.5;
        const visibleRows = Math.floor(stepProgress * 4); // 0 to 4 steps
        // Dark subterranean gradient
        ctx.fillStyle = NES_COLORS.BLACK;
        ctx.fillRect(tx, ty, 16, Math.min(16, Math.round(stepProgress * 16)));

        // Golden/white step depth markers uncovering downwards
        const stepColors = [
          NES_COLORS.WHITE,
          NES_COLORS.GOLD,
          '#00e8d8',
          NES_COLORS.OVERWORLD_ROCK_LIGHT,
        ];
        ctx.fillStyle = stepColors[this.animTick % stepColors.length];
        if (visibleRows >= 1) ctx.fillRect(tx + 2, ty + 2, 12, 2);
        if (visibleRows >= 2) ctx.fillRect(tx + 3, ty + 6, 10, 2);
        if (visibleRows >= 3) ctx.fillRect(tx + 5, ty + 10, 6, 2);
        if (visibleRows >= 4) ctx.fillRect(tx + 7, ty + 13, 2, 2);
      }

      // 2. Radiant 8-bit flashing boundary aura around the 16x16 staircase
      const flashPalette = [
        NES_COLORS.WHITE,
        NES_COLORS.GOLD,
        '#00e8d8',
        '#58f898',
        NES_COLORS.OVERWORLD_ROCK_LIGHT,
      ];
      const auraColor =
        flashPalette[Math.floor(this.animTick / 3) % flashPalette.length];
      const pulseWidth = progress < 0.4 ? 2 : 1;

      ctx.strokeStyle = auraColor;
      ctx.lineWidth = pulseWidth;
      ctx.strokeRect(tx - 0.5, ty - 0.5, 17, 17);

      // Corner glints on the staircase entrance
      ctx.fillStyle = NES_COLORS.WHITE;
      ctx.fillRect(tx - 2, ty - 2, 2, 2);
      ctx.fillRect(tx + 16, ty - 2, 2, 2);
      ctx.fillRect(tx - 2, ty + 16, 2, 2);
      ctx.fillRect(tx + 16, ty + 16, 2, 2);

      // 3. Ascending vertical celestial light rays rising out of the subterranean passage
      const rayAlpha = Math.max(0, 1 - progress);
      ctx.fillStyle = `rgba(255, 235, 120, ${rayAlpha * 0.75})`;
      const rayOffset1 = Math.sin(this.animTick * 0.4) * 2;
      const rayOffset2 = Math.cos(this.animTick * 0.35) * 2;
      ctx.fillRect(
        cx - 3 + rayOffset1,
        ty - Math.round(progress * 18),
        2,
        Math.round(progress * 14)
      );
      ctx.fillRect(
        cx + 2 + rayOffset2,
        ty - Math.round(progress * 22),
        2,
        Math.round(progress * 16)
      );

      // 4. Expanding radiant diamond halo
      const diamondRadius = Math.round(4 + progress * 18);
      if (diamondRadius > 0 && rayAlpha > 0.08) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${rayAlpha * 0.6})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy - diamondRadius);
        ctx.lineTo(cx + diamondRadius, cy);
        ctx.lineTo(cx, cy + diamondRadius);
        ctx.lineTo(cx - diamondRadius, cy);
        ctx.closePath();
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}
