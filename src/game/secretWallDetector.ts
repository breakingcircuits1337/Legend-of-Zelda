/**
 * Dungeon & Overworld Hidden Wall Detection, Secret Passage Reveal & Map Tracking
 */

import { Direction, ScreenData, SecretTrigger } from '../types';

export const HIDDEN_WALL_TILES = new Set<number>([13, 14, 17]);

export interface PushSecretMatch {
  secret: SecretTrigger;
  matchedRow: number;
  matchedCol: number;
  isBombWall: boolean;
  blockedByEnemies: boolean;
}

export interface HollowWallProbeResult {
  isHollow: boolean;
  secret: SecretTrigger | null;
  triggersOnSword: boolean;
}

export interface DungeonRoomMapNode {
  id: string;
  gx: number;
  gy: number;
  label: string;
  role: 'entrance' | 'normal' | 'secret' | 'shortcut' | 'boss' | 'triforce';
  /** Secret trigger IDs that unlock/reveal this room */
  revealedBySecretIds?: string[];
  /** Edge connections to adjacent dungeon rooms (normal or secret shortcut) */
  connections?: Array<{
    toId: string;
    dir: 'up' | 'down' | 'left' | 'right';
    secretId?: string;
    isShortcut?: boolean;
  }>;
}

export interface DungeonLevelMapLayout {
  level: 1 | 2 | 3;
  title: string;
  cols: number;
  rows: number;
  rooms: DungeonRoomMapNode[];
}

export const DUNGEON_MAP_LAYOUTS: Record<1 | 2 | 3, DungeonLevelMapLayout> = {
  1: {
    level: 1,
    title: 'LEVEL-1: THE EAGLE',
    cols: 3,
    rows: 3,
    rooms: [
      {
        id: 'D1_5',
        gx: 1,
        gy: 0,
        label: 'BOSS',
        role: 'boss',
        connections: [
          { toId: 'D1_6', dir: 'right' },
          { toId: 'D1_4', dir: 'down' },
        ],
      },
      {
        id: 'D1_6',
        gx: 2,
        gy: 0,
        label: 'TRI',
        role: 'triforce',
        connections: [{ toId: 'D1_5', dir: 'left' }],
      },
      {
        id: 'D1_SECRET_ARMORY',
        gx: 0,
        gy: 1,
        label: 'SEC',
        role: 'secret',
        revealedBySecretIds: ['secret_d1_4_bomb_west', 'secret_d1_2_north_shortcut'],
        connections: [
          { toId: 'D1_4', dir: 'right', secretId: 'secret_d1_4_bomb_west' },
          {
            toId: 'D1_2',
            dir: 'down',
            secretId: 'secret_d1_armory_south_shortcut',
            isShortcut: true,
          },
        ],
      },
      {
        id: 'D1_4',
        gx: 1,
        gy: 1,
        label: '1-4',
        role: 'normal',
        connections: [
          { toId: 'D1_5', dir: 'up' },
          { toId: 'D1_1', dir: 'down' },
          { toId: 'D1_SECRET_ARMORY', dir: 'left', secretId: 'secret_d1_4_bomb_west' },
        ],
      },
      {
        id: 'D1_SECRET_CHAMBER',
        gx: 2,
        gy: 1,
        label: 'ARM',
        role: 'secret',
        revealedBySecretIds: ['secret_d1_3_sword'],
        connections: [{ toId: 'D1_3', dir: 'down', secretId: 'secret_d1_3_sword' }],
      },
      {
        id: 'D1_2',
        gx: 0,
        gy: 2,
        label: '1-2',
        role: 'normal',
        connections: [
          { toId: 'D1_1', dir: 'right' },
          {
            toId: 'D1_SECRET_ARMORY',
            dir: 'up',
            secretId: 'secret_d1_2_north_shortcut',
            isShortcut: true,
          },
        ],
      },
      {
        id: 'D1_1',
        gx: 1,
        gy: 2,
        label: 'ENT',
        role: 'entrance',
        connections: [
          { toId: 'D1_4', dir: 'up' },
          { toId: 'D1_2', dir: 'left' },
          { toId: 'D1_3', dir: 'right' },
        ],
      },
      {
        id: 'D1_3',
        gx: 2,
        gy: 2,
        label: '1-3',
        role: 'normal',
        connections: [
          { toId: 'D1_1', dir: 'left' },
          { toId: 'D1_SECRET_CHAMBER', dir: 'up', secretId: 'secret_d1_3_sword' },
        ],
      },
      {
        id: 'D1_SECRET_VAULT',
        gx: 0,
        gy: 0,
        label: 'VLT',
        role: 'secret',
        revealedBySecretIds: ['secret_d1_2_push'],
      },
    ],
  },
  2: {
    level: 2,
    title: 'LEVEL-2: THE MOON',
    cols: 3,
    rows: 2,
    rooms: [
      {
        id: 'D2_SECRET_SHRINE',
        gx: 0,
        gy: 0,
        label: 'SHR',
        role: 'secret',
        revealedBySecretIds: ['secret_d2_2_west_shrine'],
        connections: [{ toId: 'D2_2', dir: 'right', secretId: 'secret_d2_2_west_shrine' }],
      },
      {
        id: 'D2_2',
        gx: 1,
        gy: 0,
        label: '2-2',
        role: 'normal',
        connections: [
          { toId: 'D2_1', dir: 'down' },
          { toId: 'D2_SECRET_SHRINE', dir: 'left', secretId: 'secret_d2_2_west_shrine' },
        ],
      },
      {
        id: 'D2_TRIFORCE',
        gx: 2,
        gy: 0,
        label: 'TRI',
        role: 'triforce',
        connections: [{ toId: 'D2_BOSS', dir: 'down' }],
      },
      {
        id: 'D2_1',
        gx: 1,
        gy: 1,
        label: 'ENT',
        role: 'entrance',
        connections: [
          { toId: 'D2_2', dir: 'up' },
          { toId: 'D2_BOSS', dir: 'right' },
        ],
      },
      {
        id: 'D2_BOSS',
        gx: 2,
        gy: 1,
        label: 'BOSS',
        role: 'boss',
        connections: [
          { toId: 'D2_1', dir: 'left' },
          { toId: 'D2_TRIFORCE', dir: 'up' },
        ],
      },
    ],
  },
  3: {
    level: 3,
    title: 'LEVEL-3: THE MANJI',
    cols: 3,
    rows: 4,
    rooms: [
      {
        id: 'D3_TRIFORCE',
        gx: 0,
        gy: 0,
        label: 'TRI',
        role: 'triforce',
        connections: [{ toId: 'D3_BOSS', dir: 'down' }],
      },
      {
        id: 'D3_BOSS',
        gx: 0,
        gy: 1,
        label: 'BOSS',
        role: 'boss',
        connections: [
          { toId: 'D3_TRIFORCE', dir: 'up' },
          { toId: 'D3_2', dir: 'down' },
        ],
      },
      {
        id: 'D3_2',
        gx: 0,
        gy: 2,
        label: '3-2',
        role: 'normal',
        connections: [
          { toId: 'D3_BOSS', dir: 'up' },
          { toId: 'D3_1', dir: 'down' },
          { toId: 'D3_VAULT', dir: 'right' },
        ],
      },
      {
        id: 'D3_VAULT',
        gx: 1,
        gy: 2,
        label: 'VLT',
        role: 'normal',
        connections: [
          { toId: 'D3_2', dir: 'left' },
          {
            toId: 'D3_SECRET_PASSAGE',
            dir: 'down',
            secretId: 'secret_d3_vault_south_shortcut',
            isShortcut: true,
          },
        ],
      },
      {
        id: 'D3_1',
        gx: 0,
        gy: 3,
        label: 'ENT',
        role: 'entrance',
        connections: [
          { toId: 'D3_2', dir: 'up' },
          {
            toId: 'D3_SECRET_PASSAGE',
            dir: 'right',
            secretId: 'secret_d3_1_east_shortcut',
            isShortcut: true,
          },
        ],
      },
      {
        id: 'D3_SECRET_PASSAGE',
        gx: 1,
        gy: 3,
        label: 'SHRT',
        role: 'shortcut',
        revealedBySecretIds: ['secret_d3_1_east_shortcut', 'secret_d3_vault_south_shortcut'],
        connections: [
          {
            toId: 'D3_1',
            dir: 'left',
            secretId: 'secret_d3_1_east_shortcut',
            isShortcut: true,
          },
          {
            toId: 'D3_VAULT',
            dir: 'up',
            secretId: 'secret_d3_passage_north_shortcut',
            isShortcut: true,
          },
        ],
      },
    ],
  },
};

export function isHiddenWallTile(tile: number): boolean {
  return HIDDEN_WALL_TILES.has(tile);
}

export function isDungeonBorderCoord(row: number, col: number): boolean {
  return row === 0 || row === 10 || col === 0 || col === 15;
}

export function getSecretTilePositions(secret: SecretTrigger): Array<{ row: number; col: number }> {
  const positions: Array<{ row: number; col: number }> = [{ row: secret.row, col: secret.col }];
  if (secret.pairedTiles && secret.pairedTiles.length > 0) {
    for (const pt of secret.pairedTiles) {
      if (!positions.some((p) => p.row === pt.row && p.col === pt.col)) {
        positions.push({ row: pt.row, col: pt.col });
      }
    }
  }
  return positions;
}

export function inferSecretExitDir(
  screen: ScreenData,
  secret: SecretTrigger
): 'up' | 'down' | 'left' | 'right' | 'cave' | null {
  if (secret.exitDir) return secret.exitDir;
  if (secret.revealTile === 4 || secret.id === 'secret_o8_7_bomb') return 'cave';

  if (
    secret.targetScreenId &&
    (secret.revealTile === 16 || (screen.type === 'dungeon' && isDungeonBorderCoord(secret.row, secret.col)))
  ) {
    if (secret.col === 0) return 'left';
    if (secret.col === 15) return 'right';
    if (secret.row === 0) return 'up';
    if (secret.row === 10) return 'down';
  }
  return null;
}

export function canRevealSecretByPush(
  screen: ScreenData,
  secret: SecretTrigger,
  tile: number
): boolean {
  if (secret.allowPush === false) return false;
  if (secret.allowPush === true || secret.type === 'push' || secret.type === 'burn') return true;
  if (secret.type === 'bomb') {
    return screen.type === 'dungeon' || isHiddenWallTile(tile);
  }
  return false;
}

export function canRevealSecretByBomb(
  screen: ScreenData,
  secret: SecretTrigger,
  tile: number
): boolean {
  if (secret.allowBomb === false) return false;
  if (secret.allowBomb === true || secret.type === 'bomb' || secret.type === 'burn') return true;
  if (screen.type === 'dungeon' && secret.type === 'push') {
    // Allow bombing dungeon secret wall tiles or border passages, while keeping pure interior push-block puzzles push-only unless allowBomb is true
    return (
      tile === 13 ||
      tile === 17 ||
      isDungeonBorderCoord(secret.row, secret.col) ||
      secret.exitDir !== undefined
    );
  }
  return false;
}

/**
 * Detects whether pushing tile (row, col) in direction `dir` interacts with an unrevealed secret wall or block.
 */
export function detectPushableSecretAt(
  screen: ScreenData,
  row: number,
  col: number,
  dir: Direction,
  enemiesRemaining: boolean,
  revealedSecrets: Set<string>
): PushSecretMatch | null {
  if (row < 0 || row >= 11 || col < 0 || col >= 16) return null;
  if (!screen.secrets || screen.secrets.length === 0) return null;

  const tileAtCheck = screen.tiles[row]?.[col] ?? 0;

  for (const secret of screen.secrets) {
    if (revealedSecrets.has(secret.id)) continue;
    if (!canRevealSecretByPush(screen, secret, tileAtCheck)) continue;

    const positions = getSecretTilePositions(secret);
    const directMatch = positions.some((pos) => pos.row === row && pos.col === col);
    const adjacentHiddenWallMatch =
      !directMatch &&
      isHiddenWallTile(tileAtCheck) &&
      positions.some((pos) => Math.abs(pos.row - row) <= 1 && Math.abs(pos.col - col) <= 1);

    if (!directMatch && !adjacentHiddenWallMatch) continue;

    if (secret.pushDir && secret.pushDir !== dir) continue;

    const blockedByEnemies = Boolean(secret.requireClearedEnemies && enemiesRemaining);
    return {
      secret,
      matchedRow: row,
      matchedCol: col,
      isBombWall: secret.type === 'bomb' || tileAtCheck === 13,
      blockedByEnemies,
    };
  }

  return null;
}

/**
 * Detects all unrevealed secrets within a bomb blast radius.
 */
export function detectBombableSecretsInBlast(
  screen: ScreenData,
  blastX: number,
  blastY: number,
  tileSize: number,
  enemiesRemaining: boolean,
  revealedSecrets: Set<string>,
  blastRadius: number = 28
): SecretTrigger[] {
  if (!screen.secrets || screen.secrets.length === 0) return [];

  const matched: SecretTrigger[] = [];

  for (const secret of screen.secrets) {
    if (revealedSecrets.has(secret.id)) continue;

    const primaryTile = screen.tiles[secret.row]?.[secret.col] ?? 0;
    if (!canRevealSecretByBomb(screen, secret, primaryTile)) continue;
    if (secret.requireClearedEnemies && enemiesRemaining) continue;

    const positions = getSecretTilePositions(secret);

    // Also include orthogonally adjacent bombable wall tiles (tile 13) on dungeon walls so hitting either tile of a 2-tile wall triggers it
    if (screen.type === 'dungeon' && positions.length === 1) {
      const { row, col } = positions[0];
      const neighbors = [
        { row: row - 1, col },
        { row: row + 1, col },
        { row, col: col - 1 },
        { row, col: col + 1 },
      ];
      for (const n of neighbors) {
        if (n.row >= 0 && n.row < 11 && n.col >= 0 && n.col < 16 && screen.tiles[n.row][n.col] === 13) {
          positions.push(n);
        }
      }
    }

    const hit = positions.some((pos) => {
      const sx = pos.col * tileSize + tileSize / 2;
      const sy = pos.row * tileSize + tileSize / 2;
      return Math.hypot(blastX - sx, blastY - sy) <= blastRadius;
    });

    if (hit) {
      matched.push(secret);
    }
  }

  return matched;
}

/**
 * Probes a wall tile (e.g., via sword tap) to detect hollow secret walls or strikeable secret walls.
 */
export function detectHollowWallAt(
  screen: ScreenData,
  row: number,
  col: number,
  revealedSecrets: Set<string>
): HollowWallProbeResult {
  if (row < 0 || row >= 11 || col < 0 || col >= 16) {
    return { isHollow: false, secret: null, triggersOnSword: false };
  }

  const tile = screen.tiles[row]?.[col] ?? 0;
  const secrets = screen.secrets ?? [];

  for (const secret of secrets) {
    if (revealedSecrets.has(secret.id)) continue;
    const positions = getSecretTilePositions(secret);
    const matchesTile = positions.some((pos) => pos.row === row && pos.col === col);
    if (!matchesTile) continue;

    const triggersOnSword = secret.type === 'sword' || secret.type === 'burn';
    return {
      isHollow: true,
      secret,
      triggersOnSword,
    };
  }

  // Fallback: unlinked hidden wall tiles still sound hollow when probed
  if (tile === 13 || tile === 17) {
    return { isHollow: true, secret: null, triggersOnSword: false };
  }

  return { isHollow: false, secret: null, triggersOnSword: false };
}

/**
 * Applies a secret's tile modifications and directional exit openings cleanly (and bidirectionally if linked).
 */
export function applySecretDiscoveryToScreen(
  screen: ScreenData,
  secret: SecretTrigger,
  allScreens?: Record<string, ScreenData>,
  revealedSecrets?: Set<string>
) {
  const exitDir = inferSecretExitDir(screen, secret);
  const isBorderWall = isDungeonBorderCoord(secret.row, secret.col);
  const isInteriorPushBlock =
    secret.type === 'push' && !isBorderWall && exitDir === null && secret.revealTile !== 16;

  if (isInteriorPushBlock) {
    const moveDir = secret.blockMoveDir ?? secret.pushDir ?? Direction.UP;
    let targetRow = secret.row;
    let targetCol = secret.col;
    if (moveDir === Direction.UP) targetRow--;
    else if (moveDir === Direction.DOWN) targetRow++;
    else if (moveDir === Direction.LEFT) targetCol--;
    else if (moveDir === Direction.RIGHT) targetCol++;

    const isDungeon = screen.type === 'dungeon';
    if (targetRow >= 0 && targetRow < 11 && targetCol >= 0 && targetCol < 16) {
      screen.tiles[targetRow][targetCol] = isDungeon ? 5 : 2;
    }
    screen.tiles[secret.row][secret.col] = secret.revealTile;
  } else {
    const positions = getSecretTilePositions(secret);

    // If single border wall tile with bomb hole reveal in dungeon, auto-include adjacent bombable wall tile (13) on same edge
    if (screen.type === 'dungeon' && positions.length === 1 && secret.revealTile === 16) {
      const { row, col } = positions[0];
      if (col === 0 || col === 15) {
        if (row + 1 < 11 && screen.tiles[row + 1][col] === 13) positions.push({ row: row + 1, col });
        if (row - 1 >= 0 && screen.tiles[row - 1][col] === 13) positions.push({ row: row - 1, col });
      } else if (row === 0 || row === 10) {
        if (col + 1 < 16 && screen.tiles[row][col + 1] === 13) positions.push({ row, col: col + 1 });
        if (col - 1 >= 0 && screen.tiles[row][col - 1] === 13) positions.push({ row, col: col - 1 });
      }
    }

    const tileValue = secret.id === 'secret_o8_7_bomb' ? 4 : secret.revealTile;
    for (const pos of positions) {
      if (pos.row >= 0 && pos.row < 11 && pos.col >= 0 && pos.col < 16) {
        screen.tiles[pos.row][pos.col] = tileValue;
      }
    }

    if (exitDir && secret.targetScreenId) {
      screen.exits[exitDir] = secret.targetScreenId;
    }
  }

  // Propagate linked shortcut secrets to the connected screen so passage is open from both sides
  if (secret.linkedSecretId && allScreens) {
    for (const candidateScreen of Object.values(allScreens)) {
      const linkedSecret = candidateScreen.secrets?.find((s) => s.id === secret.linkedSecretId);
      if (linkedSecret) {
        revealedSecrets?.add(linkedSecret.id);
        applySecretDiscoveryToScreen(candidateScreen, linkedSecret);
        break;
      }
    }
  }
}

/**
 * Updates the visitedScreens set when a hidden wall, secret room, or shortcut passage is discovered.
 */
export function recordSecretDiscoveryInVisitedMap(
  visitedScreens: Set<string>,
  currentScreen: ScreenData,
  secret: SecretTrigger,
  allScreens?: Record<string, ScreenData>
): string[] {
  visitedScreens.add(currentScreen.id);
  visitedScreens.add(`secret:${secret.id}`);

  if (secret.targetScreenId) {
    visitedScreens.add(secret.targetScreenId);
  }

  if (secret.linkedSecretId) {
    visitedScreens.add(`secret:${secret.linkedSecretId}`);
    if (allScreens) {
      for (const candidateScreen of Object.values(allScreens)) {
        if (candidateScreen.secrets?.some((s) => s.id === secret.linkedSecretId)) {
          visitedScreens.add(candidateScreen.id);
          break;
        }
      }
    }
  }

  return Array.from(visitedScreens);
}

/**
 * Helper for dungeon UI: returns whether a dungeon room has been visited or revealed via a secret wall.
 */
export function isDungeonRoomDiscovered(
  room: DungeonRoomMapNode,
  visitedScreens?: string[],
  currentScreenId?: string
): boolean {
  if (currentScreenId && room.id === currentScreenId) return true;
  if (!visitedScreens || visitedScreens.length === 0) return false;
  if (visitedScreens.includes(room.id)) return true;
  if (room.revealedBySecretIds?.some((secId) => visitedScreens.includes(`secret:${secId}`))) {
    return true;
  }
  return false;
}
