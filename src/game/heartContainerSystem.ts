/**
 * The Legend of Zelda NES - Heart Container Upgrade System
 *
 * Manages permanent maximum health capacity upgrades across the world:
 * - Tracks unique Heart Container locations across overworld, secret caves, shops,
 *   dungeon shrines/passages, and dungeon boss drops so containers cannot be duplicated.
 * - Increases `player.maxHearts` by +2 half-hearts (1 full heart) up to the authentic
 *   16-heart (32 half-heart) NES cap and restores Link to full health on pickup.
 */

import { EnemyType, ItemType, PickupItem, PlayerState } from '../types';

export const BASE_MAX_HEARTS = 6; // Starting capacity: 3 full hearts (6 half-hearts)
export const HEART_CONTAINER_INCREMENT = 2; // +1 full heart container (+2 half-hearts)
export const MAX_HEART_CONTAINER_COUNT = 16; // Classic NES Zelda maximum: 16 hearts
export const ABSOLUTE_MAX_HEARTS = MAX_HEART_CONTAINER_COUNT * 2; // 32 half-hearts

export type HeartContainerSourceType = 'overworld' | 'cave' | 'shop' | 'dungeon' | 'boss';

export interface HeartContainerLocation {
  containerId: string;
  screenId: string;
  x: number;
  y: number;
  locationName: string;
  sourceType: HeartContainerSourceType;
  /** True if spawned directly on floor tiles as a pickup upon entering the screen. */
  spawnsOnScreenLoad: boolean;
}

/**
 * Curated Heart Container locations spanning the 16x8 Overworld, Secret Caves,
 * Subterranean Shop, Secret Dungeon Rooms, and Dungeon Bosses.
 * 3 base hearts + 13 collectable Heart Containers = 16 total hearts (32 HP).
 */
export const WORLD_HEART_CONTAINERS: HeartContainerLocation[] = [
  // Overworld Exploration Finds (5)
  {
    containerId: 'hc_o3_7_coast',
    screenId: 'O3_7',
    x: 112,
    y: 48,
    locationName: 'Heart Piece Coast',
    sourceType: 'overworld',
    spawnsOnScreenLoad: true,
  },
  {
    containerId: 'hc_o5_2_lost_woods',
    screenId: 'O5_2',
    x: 120,
    y: 48,
    locationName: 'Lost Woods Heart',
    sourceType: 'overworld',
    spawnsOnScreenLoad: true,
  },
  {
    containerId: 'hc_o14_7_pier',
    screenId: 'O14_7',
    x: 120,
    y: 48,
    locationName: 'Secret Coast Pier',
    sourceType: 'overworld',
    spawnsOnScreenLoad: true,
  },
  {
    containerId: 'hc_o10_1_headland',
    screenId: 'O10_1',
    x: 120,
    y: 48,
    locationName: 'North Ocean Headland',
    sourceType: 'overworld',
    spawnsOnScreenLoad: true,
  },
  {
    containerId: 'hc_o1_3_statues',
    screenId: 'O1_3',
    x: 120,
    y: 48,
    locationName: 'Power Bracelet Statues',
    sourceType: 'overworld',
    spawnsOnScreenLoad: true,
  },

  // Dungeon Secret Rooms (2)
  {
    containerId: 'hc_d2_shrine',
    screenId: 'D2_SECRET_SHRINE',
    x: 120,
    y: 72,
    locationName: 'Level-2 Secret Shrine',
    sourceType: 'dungeon',
    spawnsOnScreenLoad: true,
  },
  {
    containerId: 'hc_d3_passage',
    screenId: 'D3_SECRET_PASSAGE',
    x: 120,
    y: 56,
    locationName: 'Level-3 Secret Passage',
    sourceType: 'dungeon',
    spawnsOnScreenLoad: true,
  },

  // Secret Caves & Merchant Shop (3)
  {
    containerId: 'hc_cave_secret_heart',
    screenId: 'C_SECRET_HEART',
    x: 120,
    y: 76,
    locationName: 'Secret Heart Cavern',
    sourceType: 'cave',
    spawnsOnScreenLoad: false, // Offered on Old Man altar pedestal
  },
  {
    containerId: 'hc_cave_fairy_spring',
    screenId: 'C_SECRET_FAIRY_SPRING',
    x: 120,
    y: 76,
    locationName: 'Great Fairy Spring',
    sourceType: 'cave',
    spawnsOnScreenLoad: false, // Offered on Old Man altar pedestal
  },
  {
    containerId: 'hc_shop_secret_heart',
    screenId: 'C_SECRET_SHOP',
    x: 188,
    y: 76,
    locationName: 'Secret Subterranean Shop',
    sourceType: 'shop',
    spawnsOnScreenLoad: false, // Purchased from shop slot
  },

  // Dungeon Boss Drops (3)
  {
    containerId: 'hc_d1_boss',
    screenId: 'D1_5',
    x: 120,
    y: 80,
    locationName: 'Level-1 Boss (Aquamentus)',
    sourceType: 'boss',
    spawnsOnScreenLoad: false,
  },
  {
    containerId: 'hc_d2_boss',
    screenId: 'D2_BOSS',
    x: 120,
    y: 80,
    locationName: 'Level-2 Boss (Dodongo)',
    sourceType: 'boss',
    spawnsOnScreenLoad: false,
  },
  {
    containerId: 'hc_d3_boss',
    screenId: 'D3_BOSS',
    x: 120,
    y: 80,
    locationName: 'Level-3 Boss (Manhandla)',
    sourceType: 'boss',
    spawnsOnScreenLoad: false,
  },
];

export interface HeartContainerUpgradeResult {
  upgraded: boolean;
  alreadyClaimed: boolean;
  capped: boolean;
  previousMaxHearts: number;
  newMaxHearts: number;
  previousHearts: number;
  newHearts: number;
  totalContainers: number;
  bonusContainers: number;
  containerId?: string;
}

/**
 * Permanently increases Link's maximum health capacity by +2 half-hearts (1 full Heart Container),
 * clamps at ABSOLUTE_MAX_HEARTS (32 half-hearts = 16 containers), refills hearts to full,
 * and records `containerId` to prevent duplicate collection across revisits or saves.
 */
export function applyHeartContainerUpgrade(
  player: PlayerState,
  collectedIds: Set<string>,
  containerId?: string
): HeartContainerUpgradeResult {
  const previousMaxHearts = Math.max(BASE_MAX_HEARTS, player.maxHearts);
  const previousHearts = player.hearts;

  if (containerId && collectedIds.has(containerId)) {
    return {
      upgraded: false,
      alreadyClaimed: true,
      capped: previousMaxHearts >= ABSOLUTE_MAX_HEARTS,
      previousMaxHearts,
      newMaxHearts: previousMaxHearts,
      previousHearts,
      newHearts: previousHearts,
      totalContainers: Math.floor(previousMaxHearts / 2),
      bonusContainers: Math.max(0, Math.floor((previousMaxHearts - BASE_MAX_HEARTS) / 2)),
      containerId,
    };
  }

  if (containerId) {
    collectedIds.add(containerId);
  }
  player.collectedHeartContainers = Array.from(collectedIds);

  const capped = previousMaxHearts >= ABSOLUTE_MAX_HEARTS;
  const newMaxHearts = Math.min(
    ABSOLUTE_MAX_HEARTS,
    previousMaxHearts + HEART_CONTAINER_INCREMENT
  );
  player.maxHearts = newMaxHearts;
  player.hearts = newMaxHearts;

  return {
    upgraded: !capped || previousHearts < newMaxHearts,
    alreadyClaimed: false,
    capped,
    previousMaxHearts,
    newMaxHearts,
    previousHearts,
    newHearts: newMaxHearts,
    totalContainers: Math.floor(newMaxHearts / 2),
    bonusContainers: Math.max(0, Math.floor((newMaxHearts - BASE_MAX_HEARTS) / 2)),
    containerId,
  };
}

/**
 * Returns pickup entities for any floor-placed Heart Containers on `screenId`
 * that have not yet been collected by the player.
 */
export function getSpawnableHeartContainersForScreen(
  screenId: string,
  collectedIds: Set<string>
): PickupItem[] {
  return WORLD_HEART_CONTAINERS.filter(
    (hc) => hc.spawnsOnScreenLoad && hc.screenId === screenId && !collectedIds.has(hc.containerId)
  ).map((hc) => ({
    id: `pickup_${hc.containerId}`,
    type: ItemType.HEART_CONTAINER,
    x: hc.x,
    y: hc.y,
    amount: HEART_CONTAINER_INCREMENT,
    timer: 999999,
    customData: {
      heartContainerId: hc.containerId,
      locationName: hc.locationName,
      sourceType: hc.sourceType,
    },
  }));
}

/**
 * Maps a dungeon boss EnemyType to its canonical Heart Container ID.
 */
export function getBossHeartContainerId(enemyType: EnemyType): string | null {
  switch (enemyType) {
    case EnemyType.AQUAMENTUS:
      return 'hc_d1_boss';
    case EnemyType.DODONGO:
      return 'hc_d2_boss';
    case EnemyType.MANHANDLA:
      return 'hc_d3_boss';
    default:
      return null;
  }
}

/**
 * Maps a secret cave screen ID to its canonical Heart Container ID.
 */
export function getCaveHeartContainerId(screenId: string): string | null {
  switch (screenId) {
    case 'C_SECRET_HEART':
      return 'hc_cave_secret_heart';
    case 'C_SECRET_FAIRY_SPRING':
      return 'hc_cave_fairy_spring';
    default:
      return null;
  }
}

/**
 * Summarizes the player's current Heart Container capacity and upgrades earned.
 */
export function getHeartCapacitySummary(player: PlayerState) {
  const maxHearts = Math.min(ABSOLUTE_MAX_HEARTS, Math.max(BASE_MAX_HEARTS, player.maxHearts));
  const containerCount = Math.floor(maxHearts / 2);
  const bonusContainers = Math.max(0, containerCount - Math.floor(BASE_MAX_HEARTS / 2));

  return {
    currentHearts: player.hearts,
    maxHearts,
    containerCount,
    maxPossibleContainers: MAX_HEART_CONTAINER_COUNT,
    bonusContainers,
    collectedCount: player.collectedHeartContainers?.length ?? bonusContainers,
  };
}
