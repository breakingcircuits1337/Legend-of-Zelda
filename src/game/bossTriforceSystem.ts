/**
 * The Legend of Zelda NES - Boss Battle Gates & Triforce Shard System
 *
 * Canonical registry mapping each Dungeon Boss arena (Aquamentus, Dodongo, Manhandla)
 * to its locked Boss Gate tiles (TILE_BOSS_GATE = 19), its Triforce Chamber, and its
 * unique Triforce Shard ID so every boss battle unlocks a sealed gate and rewards a
 * distinct Triforce piece in any completion order.
 */

import { EnemyType, PlayerState, ScreenData } from '../types';

export const TILE_BOSS_GATE = 19;
export const TOTAL_TRIFORCE_PIECES = 3;

export interface GateTileCoord {
  row: number;
  col: number;
}

export interface BossBattleTriforceConfig {
  level: number;
  bossScreenId: string;
  bossType: EnemyType;
  bossName: string;
  triforceScreenId: string;
  triforceId: string;
  triforceName: string;
  gateDir: 'up' | 'down' | 'left' | 'right';
  gateTiles: GateTileCoord[];
  openTile: number;
  triforceSpawn: { x: number; y: number };
  overworldExit: { screenId: string; x: number; y: number };
}

export const BOSS_TRIFORCE_BATTLES: BossBattleTriforceConfig[] = [
  {
    level: 1,
    bossScreenId: 'D1_5',
    bossType: EnemyType.AQUAMENTUS,
    bossName: 'Aquamentus',
    triforceScreenId: 'D1_6',
    triforceId: 'triforce_d1',
    triforceName: 'Triforce Shard I',
    gateDir: 'right',
    gateTiles: [
      { row: 5, col: 15 },
      { row: 6, col: 15 },
    ],
    openTile: 6,
    triforceSpawn: { x: 120, y: 80 },
    overworldExit: { screenId: 'O7_4', x: 120, y: 116 },
  },
  {
    level: 2,
    bossScreenId: 'D2_BOSS',
    bossType: EnemyType.DODONGO,
    bossName: 'Dodongo',
    triforceScreenId: 'D2_TRIFORCE',
    triforceId: 'triforce_d2',
    triforceName: 'Triforce Shard II',
    gateDir: 'up',
    gateTiles: [
      { row: 0, col: 7 },
      { row: 0, col: 8 },
    ],
    openTile: 6,
    triforceSpawn: { x: 120, y: 80 },
    overworldExit: { screenId: 'O6_6', x: 120, y: 32 },
  },
  {
    level: 3,
    bossScreenId: 'D3_BOSS',
    bossType: EnemyType.MANHANDLA,
    bossName: 'Manhandla',
    triforceScreenId: 'D3_TRIFORCE',
    triforceId: 'triforce_d3',
    triforceName: 'Triforce Shard III',
    gateDir: 'up',
    gateTiles: [
      { row: 0, col: 7 },
      { row: 0, col: 8 },
    ],
    openTile: 6,
    triforceSpawn: { x: 120, y: 80 },
    overworldExit: { screenId: 'O8_5', x: 120, y: 32 },
  },
];

export function getBossBattleByScreenId(
  screenId: string
): BossBattleTriforceConfig | undefined {
  return BOSS_TRIFORCE_BATTLES.find((b) => b.bossScreenId === screenId);
}

export function getBossBattleByEnemyType(
  enemyType: EnemyType,
  screenId?: string
): BossBattleTriforceConfig | undefined {
  if (screenId) {
    return BOSS_TRIFORCE_BATTLES.find(
      (b) => b.bossScreenId === screenId && b.bossType === enemyType
    );
  }
  return BOSS_TRIFORCE_BATTLES.find((b) => b.bossType === enemyType);
}

export function getTriforceByScreenId(
  screenId: string
): BossBattleTriforceConfig | undefined {
  return BOSS_TRIFORCE_BATTLES.find((b) => b.triforceScreenId === screenId);
}

export function isBossGateLocked(screen: ScreenData): boolean {
  const cfg = getBossBattleByScreenId(screen.id);
  if (!cfg) return false;
  return cfg.gateTiles.some((gt) => screen.tiles[gt.row]?.[gt.col] === TILE_BOSS_GATE);
}

/**
 * Locks (tile 19) or unlocks (tile 6) all Boss Gate doorway tiles on a boss chamber screen.
 * Returns true if any tile changed state.
 */
export function applyBossGateState(screen: ScreenData, isOpen: boolean): boolean {
  const cfg = getBossBattleByScreenId(screen.id);
  if (!cfg) return false;
  const targetTile = isOpen ? cfg.openTile : TILE_BOSS_GATE;
  let changed = false;
  for (const gt of cfg.gateTiles) {
    if (screen.tiles[gt.row] && screen.tiles[gt.row][gt.col] !== targetTile) {
      screen.tiles[gt.row][gt.col] = targetTile;
      changed = true;
    }
  }
  return changed;
}

/**
 * Normalizes collected Triforce IDs from explicit list + legacy numeric count.
 */
export function normalizeTriforceIds(
  explicitIds?: string[],
  legacyCount: number = 0
): string[] {
  const validSet = new Set(BOSS_TRIFORCE_BATTLES.map((b) => b.triforceId));
  const ids = new Set<string>();
  if (Array.isArray(explicitIds)) {
    for (const id of explicitIds) {
      if (validSet.has(id)) ids.add(id);
    }
  }
  const targetCount = Math.max(ids.size, Math.min(TOTAL_TRIFORCE_PIECES, legacyCount || 0));
  for (const cfg of BOSS_TRIFORCE_BATTLES) {
    if (ids.size >= targetCount) break;
    ids.add(cfg.triforceId);
  }
  return Array.from(ids);
}

/**
 * Records collection of a dungeon's Triforce piece, keeping player.collectedTriforceIds
 * and player.inventory.triforcePieces synchronized without duplicates.
 */
export function applyTriforcePieceCollection(
  player: PlayerState,
  collectedIds: Set<string>,
  triforceId?: string
): {
  collectedNow: boolean;
  totalCollected: number;
  allCollected: boolean;
  resolvedId: string;
} {
  let resolvedId = triforceId;
  if (!resolvedId) {
    const nextUnclaimed = BOSS_TRIFORCE_BATTLES.find((b) => !collectedIds.has(b.triforceId));
    resolvedId = nextUnclaimed?.triforceId ?? BOSS_TRIFORCE_BATTLES[0].triforceId;
  }

  const alreadyHad = collectedIds.has(resolvedId);
  collectedIds.add(resolvedId);

  const synced = Array.from(collectedIds);
  player.collectedTriforceIds = synced;
  player.inventory.triforcePieces = Math.min(TOTAL_TRIFORCE_PIECES, synced.length);

  return {
    collectedNow: !alreadyHad,
    totalCollected: player.inventory.triforcePieces,
    allCollected: player.inventory.triforcePieces >= TOTAL_TRIFORCE_PIECES,
    resolvedId,
  };
}
