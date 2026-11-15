/**
 * Temporary Entry & Transition Trigger Volume Debug Inspector
 * Computes the exact invisible trigger hitboxes evaluated by GameEngine.checkScreenTransitions()
 * for any overworld, cave, or dungeon screen and validates target mapping & doorway reachability.
 */

import { ScreenData } from '../types';
import { getPlayerOverworldLocation } from './overworldMapData';

export const DEBUG_SCREEN_WIDTH = 256;
export const DEBUG_SCREEN_HEIGHT = 176;
export const DEBUG_TILE_SIZE = 16;

const SOLID_TILES = new Set([1, 2, 3, 5, 12, 13, 14, 17, 18, 19]);

export type EntryTriggerKind =
  | 'edge_exit'
  | 'cave_entry'
  | 'dungeon_entry'
  | 'secret_entry'
  | 'hardcoded_stairs'
  | 'unmapped_open_edge';

export interface TriggerRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type TriggerOrientationDir = 'left' | 'right' | 'up' | 'down';

export interface EntryTriggerVolume {
  id: string;
  kind: EntryTriggerKind;
  direction?: TriggerOrientationDir;
  /** Movement direction(s) expected from the player to enter/register this trigger */
  expectedDirections: TriggerOrientationDir[];
  /** Exact threshold zone checked in GameEngine.checkScreenTransitions() */
  thresholdRect: TriggerRect;
  /** Walkable tile rectangles along the doorway or tile entry */
  walkableRects: TriggerRect[];
  targetScreenId?: string;
  targetCoord?: string;
  targetExists: boolean;
  isReachable: boolean;
  isRevealed: boolean;
  label: string;
  ruleNote: string;
}

export interface ScreenEntryAudit {
  screenId: string;
  screenName: string;
  coord: string;
  triggers: EntryTriggerVolume[];
  hasBrokenTarget: boolean;
  hasUnmappedOpenEdge: boolean;
  isValid: boolean;
}

function getEdgeDoorwayTiles(
  screen: ScreenData,
  dir: 'left' | 'right' | 'up' | 'down'
): TriggerRect[] {
  const rects: TriggerRect[] = [];
  if (dir === 'left' || dir === 'right') {
    const col = dir === 'left' ? 0 : 15;
    for (let r = 0; r < 11; r++) {
      if (!SOLID_TILES.has(screen.tiles[r][col])) {
        rects.push({
          x: col * DEBUG_TILE_SIZE,
          y: r * DEBUG_TILE_SIZE,
          width: DEBUG_TILE_SIZE,
          height: DEBUG_TILE_SIZE,
        });
      }
    }
  } else {
    const row = dir === 'up' ? 0 : 10;
    for (let c = 0; c < 16; c++) {
      if (!SOLID_TILES.has(screen.tiles[row][c])) {
        rects.push({
          x: c * DEBUG_TILE_SIZE,
          y: row * DEBUG_TILE_SIZE,
          width: DEBUG_TILE_SIZE,
          height: DEBUG_TILE_SIZE,
        });
      }
    }
  }
  return rects;
}

function formatTargetCoord(
  targetId: string | undefined,
  allScreens: Record<string, ScreenData>
): string | undefined {
  if (!targetId) return undefined;
  const target = allScreens[targetId];
  if (!target) return undefined;
  return getPlayerOverworldLocation(target).coordString;
}

export function getScreenEntryTriggerVolumes(
  screen: ScreenData,
  allScreens: Record<string, ScreenData>,
  revealedSecrets?: Set<string>
): EntryTriggerVolume[] {
  const triggers: EntryTriggerVolume[] = [];

  // 1. Edge Exit / Entry Triggers (checked against Link top-left p.x / p.y)
  const isSpecialBottomExit =
    screen.type === 'cave' || screen.id === 'D1_1' || screen.id === 'D2_1';

  const edgeConfigs: Array<{
    dir: 'left' | 'right' | 'up' | 'down';
    short: string;
    targetId?: string;
    thresholdRect: TriggerRect;
    ruleNote: string;
  }> = [
    {
      dir: 'left',
      short: 'L',
      targetId: screen.exits.left,
      thresholdRect: { x: 0, y: 0, width: 5, height: DEBUG_SCREEN_HEIGHT },
      ruleNote: 'p.x <= 4',
    },
    {
      dir: 'right',
      short: 'R',
      targetId: screen.exits.right,
      thresholdRect: {
        x: DEBUG_SCREEN_WIDTH - 16,
        y: 0,
        width: 16,
        height: DEBUG_SCREEN_HEIGHT,
      },
      ruleNote: 'p.x >= 240',
    },
    {
      dir: 'up',
      short: 'U',
      targetId: screen.exits.up,
      thresholdRect: { x: 0, y: 0, width: DEBUG_SCREEN_WIDTH, height: 5 },
      ruleNote: 'p.y <= 4',
    },
    {
      dir: 'down',
      short: 'D',
      targetId: screen.exits.down,
      thresholdRect: isSpecialBottomExit
        ? { x: 0, y: DEBUG_SCREEN_HEIGHT - 16, width: DEBUG_SCREEN_WIDTH, height: 16 }
        : { x: 0, y: DEBUG_SCREEN_HEIGHT - 20, width: DEBUG_SCREEN_WIDTH, height: 20 },
      ruleNote: isSpecialBottomExit ? 'p.y >= 160' : 'p.y >= 156',
    },
  ];

  for (const cfg of edgeConfigs) {
    // D1_SECRET_CHAMBER exits exclusively via stairs at (7,8), not a south wall opening
    if (screen.id === 'D1_SECRET_CHAMBER' && cfg.dir === 'down') {
      continue;
    }

    const doorwayRects = getEdgeDoorwayTiles(screen, cfg.dir);
    if (cfg.targetId) {
      const targetExists = Boolean(allScreens[cfg.targetId]);
      const targetCoord = formatTargetCoord(cfg.targetId, allScreens);
      const isBossLockedDoor =
        doorwayRects.length === 0 &&
        ((screen.id === 'D1_5' && cfg.dir === 'right') ||
          (screen.id === 'D2_BOSS' && cfg.dir === 'up') ||
          (screen.id === 'D3_BOSS' && cfg.dir === 'up'));
      const isReachable = doorwayRects.length > 0 || isBossLockedDoor;
      const coordTag = targetCoord ? ` [${targetCoord}]` : '';
      triggers.push({
        id: `edge_${cfg.dir}`,
        kind: 'edge_exit',
        direction: cfg.dir,
        expectedDirections: [cfg.dir],
        thresholdRect: cfg.thresholdRect,
        walkableRects: doorwayRects,
        targetScreenId: cfg.targetId,
        targetCoord,
        targetExists,
        isReachable,
        isRevealed: !isBossLockedDoor,
        label: !targetExists
          ? `${cfg.short}→${cfg.targetId} (MISSING!)`
          : isBossLockedDoor
          ? `${cfg.short}(BOSS)→${cfg.targetId}`
          : `${cfg.short}→${cfg.targetId}${coordTag}`,
        ruleNote: isBossLockedDoor ? `${cfg.ruleNote} (boss lock)` : cfg.ruleNote,
      });
    } else if (screen.type === 'overworld' && doorwayRects.length > 0) {
      // Detect open walkable edge tiles that have NO mapped exit (causes walking into void)
      triggers.push({
        id: `unmapped_${cfg.dir}`,
        kind: 'unmapped_open_edge',
        direction: cfg.dir,
        expectedDirections: [cfg.dir],
        thresholdRect: cfg.thresholdRect,
        walkableRects: doorwayRects,
        targetExists: false,
        isReachable: true,
        isRevealed: true,
        label: `UNMAPPED ${cfg.short} EDGE!`,
        ruleNote: `${cfg.ruleNote} (no exit)`,
      });
    }
  }

  // 2. Cave & Dungeon Entrance Tile Triggers (tile === 4 checked at Link center)
  for (let r = 0; r < 11; r++) {
    for (let c = 0; c < 16; c++) {
      if (screen.tiles[r][c] === 4) {
        const rect: TriggerRect = {
          x: c * DEBUG_TILE_SIZE,
          y: r * DEBUG_TILE_SIZE,
          width: DEBUG_TILE_SIZE,
          height: DEBUG_TILE_SIZE,
        };
        if (screen.exits.cave) {
          const targetExists = Boolean(allScreens[screen.exits.cave]);
          const targetCoord = formatTargetCoord(screen.exits.cave, allScreens);
          triggers.push({
            id: `cave_${r}_${c}`,
            kind: 'cave_entry',
            direction: 'up',
            expectedDirections: ['up'],
            thresholdRect: rect,
            walkableRects: [rect],
            targetScreenId: screen.exits.cave,
            targetCoord,
            targetExists,
            isReachable: true,
            isRevealed: true,
            label: `CAVE→${screen.exits.cave}`,
            ruleNote: `tile[4] (${c},${r})`,
          });
        } else if (screen.exits.dungeon) {
          const targetExists = Boolean(allScreens[screen.exits.dungeon]);
          const targetCoord = formatTargetCoord(screen.exits.dungeon, allScreens);
          triggers.push({
            id: `dungeon_${r}_${c}`,
            kind: 'dungeon_entry',
            direction: 'up',
            expectedDirections: ['up'],
            thresholdRect: rect,
            walkableRects: [rect],
            targetScreenId: screen.exits.dungeon,
            targetCoord,
            targetExists,
            isReachable: true,
            isRevealed: true,
            label: `DGN→${screen.exits.dungeon}`,
            ruleNote: `tile[4] (${c},${r})`,
          });
        }
      }
    }
  }

  // 3. Secret Passage / Stairs Triggers
  if (screen.secrets) {
    for (const secret of screen.secrets) {
      const isRevealed = revealedSecrets?.has(secret.id) ?? false;
      const rects: TriggerRect[] = [
        {
          x: secret.col * DEBUG_TILE_SIZE,
          y: secret.row * DEBUG_TILE_SIZE,
          width: DEBUG_TILE_SIZE,
          height: DEBUG_TILE_SIZE,
        },
      ];
      if (secret.pairedTiles) {
        for (const pt of secret.pairedTiles) {
          rects.push({
            x: pt.col * DEBUG_TILE_SIZE,
            y: pt.row * DEBUG_TILE_SIZE,
            width: DEBUG_TILE_SIZE,
            height: DEBUG_TILE_SIZE,
          });
        }
      }
      const targetExists = secret.targetScreenId ? Boolean(allScreens[secret.targetScreenId]) : true;
      const targetCoord = formatTargetCoord(secret.targetScreenId, allScreens);
      const secretDir: TriggerOrientationDir | undefined =
        secret.exitDir && secret.exitDir !== 'cave'
          ? secret.exitDir
          : secret.row === 0
          ? 'up'
          : secret.row === 10
          ? 'down'
          : secret.col === 0
          ? 'left'
          : secret.col === 15
          ? 'right'
          : secret.revealTile === 4
          ? 'up'
          : undefined;
      const secretExpectedDirs: TriggerOrientationDir[] = secretDir
        ? [secretDir]
        : ['up', 'down', 'left', 'right'];
      triggers.push({
        id: `secret_${secret.id}`,
        kind: 'secret_entry',
        direction: secretDir,
        expectedDirections: secretExpectedDirs,
        thresholdRect: rects[0],
        walkableRects: rects,
        targetScreenId: secret.targetScreenId,
        targetCoord,
        targetExists,
        isReachable: isRevealed,
        isRevealed,
        label: secret.targetScreenId
          ? `${isRevealed ? 'SEC' : 'HID'}:${secret.type.toUpperCase()}→${secret.targetScreenId}`
          : `${isRevealed ? 'SEC' : 'HID'}:${secret.type.toUpperCase()}`,
        ruleNote: `(${secret.col},${secret.row})`,
      });
    }
  }

  // 4. Hardcoded Dungeon Secret Return Stairs
  if (screen.id === 'D1_SECRET_VAULT') {
    const rect = { x: 7 * 16, y: 8 * 16, width: 16, height: 16 };
    triggers.push({
      id: 'hardcoded_d1_vault_up',
      kind: 'hardcoded_stairs',
      expectedDirections: ['up', 'down', 'left', 'right'],
      thresholdRect: rect,
      walkableRects: [rect],
      targetScreenId: 'D1_2',
      targetCoord: formatTargetCoord('D1_2', allScreens),
      targetExists: Boolean(allScreens['D1_2']),
      isReachable: true,
      isRevealed: true,
      label: 'STAIRS→D1_2',
      ruleNote: 'center (7,8)',
    });
  } else if (screen.id === 'D1_SECRET_CHAMBER') {
    const rect = { x: 7 * 16, y: 8 * 16, width: 16, height: 16 };
    triggers.push({
      id: 'hardcoded_d1_chamber_up',
      kind: 'hardcoded_stairs',
      expectedDirections: ['up', 'down', 'left', 'right'],
      thresholdRect: rect,
      walkableRects: [rect],
      targetScreenId: 'D1_3',
      targetCoord: formatTargetCoord('D1_3', allScreens),
      targetExists: Boolean(allScreens['D1_3']),
      isReachable: true,
      isRevealed: true,
      label: 'STAIRS→D1_3',
      ruleNote: 'center (7,8)',
    });
  }

  return triggers;
}

export interface BoundingBoxBounds {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
  width: number;
  height: number;
}

export interface PlayerTriggerBoxSnapshot {
  screenId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface O47TransitionBoundingBoxDump {
  transition: string;
  sourceScreenId: string;
  sourceCoord: string;
  targetScreenId: string;
  targetCoord: string;
  direction: string;
  ruleNote: string;
  thresholdBoundingBox: BoundingBoxBounds;
  walkableDoorwayBoundingBox: BoundingBoxBounds | null;
  walkableTileRects: TriggerRect[];
  linkCrossingRange: {
    xRange: [number, number];
    yRange: [number, number];
    linkHitboxSize: '14x14';
  } | null;
  liveLinkAlignment?: {
    linkBox: BoundingBoxBounds;
    overlapsThreshold: boolean;
    overlapsDoorway: boolean;
    aligned: boolean;
  };
  targetExists: boolean;
  isReachable: boolean;
}

function toBoundingBox(rect: TriggerRect): BoundingBoxBounds {
  return {
    xMin: rect.x,
    yMin: rect.y,
    xMax: rect.x + rect.width,
    yMax: rect.y + rect.height,
    width: rect.width,
    height: rect.height,
  };
}

function unionRects(rects: TriggerRect[]): BoundingBoxBounds | null {
  if (rects.length === 0) return null;
  const xMin = Math.min(...rects.map((r) => r.x));
  const yMin = Math.min(...rects.map((r) => r.y));
  const xMax = Math.max(...rects.map((r) => r.x + r.width));
  const yMax = Math.max(...rects.map((r) => r.y + r.height));
  return {
    xMin,
    yMin,
    xMax,
    yMax,
    width: xMax - xMin,
    height: yMax - yMin,
  };
}

function boxesOverlap(a: BoundingBoxBounds, b: BoundingBoxBounds): boolean {
  return a.xMin < b.xMax && a.xMax > b.xMin && a.yMin < b.yMax && a.yMax > b.yMin;
}

export function extractO47TransitionBoundingBoxes(
  audits: ScreenEntryAudit[],
  playerBox?: PlayerTriggerBoxSnapshot
): O47TransitionBoundingBoxDump[] {
  const dumps: O47TransitionBoundingBoxDump[] = [];

  for (const audit of audits) {
    for (const trig of audit.triggers) {
      const involvesO47 = trig.targetScreenId === 'O4_7' || audit.screenId === 'O4_7';
      if (!involvesO47) continue;

      const thresholdBox = toBoundingBox(trig.thresholdRect);
      const doorwayBox = unionRects(trig.walkableRects);

      let linkCrossingRange: O47TransitionBoundingBoxDump['linkCrossingRange'] = null;
      if (doorwayBox) {
        const linkW = 14;
        const linkH = 14;
        if (trig.direction === 'left') {
          linkCrossingRange = {
            xRange: [0, 4],
            yRange: [doorwayBox.yMin, doorwayBox.yMax - linkH],
            linkHitboxSize: '14x14',
          };
        } else if (trig.direction === 'right') {
          linkCrossingRange = {
            xRange: [DEBUG_SCREEN_WIDTH - 16, DEBUG_SCREEN_WIDTH - linkW],
            yRange: [doorwayBox.yMin, doorwayBox.yMax - linkH],
            linkHitboxSize: '14x14',
          };
        } else if (trig.direction === 'up') {
          linkCrossingRange = {
            xRange: [doorwayBox.xMin, doorwayBox.xMax - linkW],
            yRange: [0, 4],
            linkHitboxSize: '14x14',
          };
        } else if (trig.direction === 'down') {
          linkCrossingRange = {
            xRange: [doorwayBox.xMin, doorwayBox.xMax - linkW],
            yRange: [DEBUG_SCREEN_HEIGHT - 20, DEBUG_SCREEN_HEIGHT - linkH],
            linkHitboxSize: '14x14',
          };
        }
      }

      let liveLinkAlignment: O47TransitionBoundingBoxDump['liveLinkAlignment'];
      if (playerBox && playerBox.screenId === audit.screenId) {
        const linkBox: BoundingBoxBounds = {
          xMin: Math.round(playerBox.x),
          yMin: Math.round(playerBox.y),
          xMax: Math.round(playerBox.x + playerBox.width),
          yMax: Math.round(playerBox.y + playerBox.height),
          width: playerBox.width,
          height: playerBox.height,
        };
        const overlapsThreshold = boxesOverlap(linkBox, thresholdBox);
        const overlapsDoorway = doorwayBox ? boxesOverlap(linkBox, doorwayBox) : false;
        liveLinkAlignment = {
          linkBox,
          overlapsThreshold,
          overlapsDoorway,
          aligned: overlapsThreshold && overlapsDoorway,
        };
      }

      dumps.push({
        transition: `${audit.screenId} -> ${trig.targetScreenId ?? 'NONE'}`,
        sourceScreenId: audit.screenId,
        sourceCoord: audit.coord,
        targetScreenId: trig.targetScreenId ?? 'NONE',
        targetCoord: trig.targetCoord ?? 'N/A',
        direction: trig.direction ?? trig.kind,
        ruleNote: trig.ruleNote,
        thresholdBoundingBox: thresholdBox,
        walkableDoorwayBoundingBox: doorwayBox,
        walkableTileRects: trig.walkableRects,
        linkCrossingRange,
        liveLinkAlignment,
        targetExists: trig.targetExists,
        isReachable: trig.isReachable,
      });
    }
  }

  return dumps;
}

export interface AuditOptions {
  logO47Dump?: boolean;
  playerBox?: PlayerTriggerBoxSnapshot;
}

export function auditAllScreenEntryTriggers(
  allScreens: Record<string, ScreenData>,
  options: AuditOptions = {}
): ScreenEntryAudit[] {
  const { logO47Dump = true, playerBox } = options;

  const audits = Object.values(allScreens).map((screen) => {
    const loc = getPlayerOverworldLocation(screen);
    const triggers = getScreenEntryTriggerVolumes(screen, allScreens);
    const hasBrokenTarget = triggers.some((t) => t.targetScreenId && !t.targetExists);
    const hasUnmappedOpenEdge = triggers.some((t) => t.kind === 'unmapped_open_edge');
    const hasBlockedEdge = triggers.some((t) => t.kind === 'edge_exit' && !t.isReachable);
    return {
      screenId: screen.id,
      screenName: screen.name,
      coord: loc.coordString,
      triggers,
      hasBrokenTarget,
      hasUnmappedOpenEdge,
      isValid: !hasBrokenTarget && !hasUnmappedOpenEdge && !hasBlockedEdge,
    };
  });

  if (logO47Dump) {
    const o47Dumps = extractO47TransitionBoundingBoxes(audits, playerBox);
    console.log(
      '[EntryTriggerDebug] O4_7 (coord 4,7) Transition Bounding Box Audit:',
      o47Dumps.map((d) => ({
        transition: d.transition,
        dir: d.direction,
        rule: d.ruleNote,
        thresholdBBox: d.thresholdBoundingBox,
        doorwayBBox: d.walkableDoorwayBoundingBox,
        linkCrossingRange: d.linkCrossingRange,
        liveLinkAlignment: d.liveLinkAlignment,
        valid: d.targetExists && d.isReachable,
      }))
    );
  }

  return audits;
}

export interface TriggerDryRunCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface TriggerDryRunResult {
  triggerId: string;
  triggerLabel: string;
  screenId: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  withinScreenBounds: boolean;
  touchesExpectedBoundary: boolean;
  hasWalkableOverlap: boolean;
  hasHitboxClearance: boolean;
  /** Critical unreachable or out-of-bounds dead-zone rectangles */
  deadZoneRects: TriggerRect[];
  /** Segments where trigger threshold overlaps solid border wall/obstacle tiles */
  solidOverlapRects: TriggerRect[];
  /** Valid walkable entry rectangles inside both screen bounds and trigger volume */
  validEntryRects: TriggerRect[];
  summary: string;
  checks: TriggerDryRunCheck[];
}

function intersectRects(a: TriggerRect, b: TriggerRect): TriggerRect | null {
  const xMin = Math.max(a.x, b.x);
  const yMin = Math.max(a.y, b.y);
  const xMax = Math.min(a.x + a.width, b.x + b.width);
  const yMax = Math.min(a.y + a.height, b.y + b.height);
  if (xMax <= xMin || yMax <= yMin) return null;
  return { x: xMin, y: yMin, width: xMax - xMin, height: yMax - yMin };
}

function mergeVerticalSpanRects(rects: TriggerRect[]): TriggerRect[] {
  if (rects.length <= 1) return rects;
  const sorted = [...rects].sort((a, b) => a.x - b.x || a.y - b.y);
  const merged: TriggerRect[] = [];
  for (const r of sorted) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.x === r.x &&
      prev.width === r.width &&
      prev.y + prev.height === r.y
    ) {
      prev.height += r.height;
    } else if (
      prev &&
      prev.y === r.y &&
      prev.height === r.height &&
      prev.x + prev.width === r.x
    ) {
      prev.width += r.width;
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}

/**
 * Performs a non-mutating dry-run geometry check on a single trigger volume against
 * the 256x176 screen boundary, Link's 14x14 hitbox clamp, and screen tile solidity
 * to flag out-of-bounds regions, doorway dead-zones, and solid-tile overlaps.
 */
export function validateTriggerAgainstScreenBoundary(
  trigger: EntryTriggerVolume,
  screen: ScreenData
): TriggerDryRunResult {
  const tr = trigger.thresholdRect;
  const screenBounds: TriggerRect = {
    x: 0,
    y: 0,
    width: DEBUG_SCREEN_WIDTH,
    height: DEBUG_SCREEN_HEIGHT,
  };
  const LINK_SIZE = 14;

  const deadZoneRects: TriggerRect[] = [];
  const solidOverlapRects: TriggerRect[] = [];
  const validEntryRects: TriggerRect[] = [];

  // 1. Screen Boundary Containment (0..256 x 0..176)
  const withinScreenBounds =
    tr.x >= 0 &&
    tr.y >= 0 &&
    tr.width > 0 &&
    tr.height > 0 &&
    tr.x + tr.width <= DEBUG_SCREEN_WIDTH &&
    tr.y + tr.height <= DEBUG_SCREEN_HEIGHT;

  if (!withinScreenBounds) {
    if (tr.x < 0) {
      deadZoneRects.push({
        x: tr.x,
        y: tr.y,
        width: Math.min(tr.width, -tr.x),
        height: tr.height,
      });
    }
    if (tr.x + tr.width > DEBUG_SCREEN_WIDTH) {
      const startX = Math.max(tr.x, DEBUG_SCREEN_WIDTH);
      deadZoneRects.push({
        x: startX,
        y: tr.y,
        width: tr.x + tr.width - startX,
        height: tr.height,
      });
    }
    if (tr.y < 0) {
      deadZoneRects.push({
        x: tr.x,
        y: tr.y,
        width: tr.width,
        height: Math.min(tr.height, -tr.y),
      });
    }
    if (tr.y + tr.height > DEBUG_SCREEN_HEIGHT) {
      const startY = Math.max(tr.y, DEBUG_SCREEN_HEIGHT);
      deadZoneRects.push({
        x: tr.x,
        y: startY,
        width: tr.width,
        height: tr.y + tr.height - startY,
      });
    }
  }

  // 2. Boundary Flush & 14x14 Player Hitbox Reachability
  let touchesExpectedBoundary = withinScreenBounds;
  let boundaryDetail = 'Inside 256x176 screen bounds';

  if (trigger.kind === 'edge_exit' || trigger.kind === 'unmapped_open_edge') {
    if (trigger.direction === 'left') {
      touchesExpectedBoundary = tr.x <= 0 && tr.x + tr.width >= 1;
      boundaryDetail = touchesExpectedBoundary
        ? `Left edge flush (x=0..${tr.x + tr.width})`
        : `Gap at left boundary (x=${tr.x} > 0)`;
    } else if (trigger.direction === 'right') {
      const maxLinkX = DEBUG_SCREEN_WIDTH - LINK_SIZE; // 242
      touchesExpectedBoundary =
        tr.x + tr.width >= DEBUG_SCREEN_WIDTH && tr.x <= maxLinkX;
      if (tr.x > maxLinkX) {
        deadZoneRects.push({
          x: maxLinkX,
          y: tr.y,
          width: tr.x - maxLinkX,
          height: tr.height,
        });
      }
      boundaryDetail = touchesExpectedBoundary
        ? `Right edge reachable (x=${tr.x} <= ${maxLinkX})`
        : `Dead-zone gap at right edge (x=${tr.x} > ${maxLinkX} for 14px hitbox)`;
    } else if (trigger.direction === 'up') {
      touchesExpectedBoundary = tr.y <= 0 && tr.y + tr.height >= 1;
      boundaryDetail = touchesExpectedBoundary
        ? `Top edge flush (y=0..${tr.y + tr.height})`
        : `Gap at top boundary (y=${tr.y} > 0)`;
    } else if (trigger.direction === 'down') {
      const maxLinkY = DEBUG_SCREEN_HEIGHT - LINK_SIZE; // 162
      touchesExpectedBoundary =
        tr.y + tr.height >= DEBUG_SCREEN_HEIGHT && tr.y <= maxLinkY;
      if (tr.y > maxLinkY) {
        deadZoneRects.push({
          x: tr.x,
          y: maxLinkY,
          width: tr.width,
          height: tr.y - maxLinkY,
        });
      }
      boundaryDetail = touchesExpectedBoundary
        ? `Bottom edge reachable (y=${tr.y} <= ${maxLinkY})`
        : `Dead-zone gap at bottom edge (y=${tr.y} > ${maxLinkY} for 14px hitbox)`;
    }
  }

  // 3. Walkable Aperture Intersection & 14x14 Clearance
  const clippedTrigger = intersectRects(tr, screenBounds);
  for (const wr of trigger.walkableRects) {
    const clampedWr = intersectRects(wr, screenBounds);
    if (!clampedWr) {
      deadZoneRects.push({ ...wr });
      continue;
    }
    const entryHit = clippedTrigger ? intersectRects(clippedTrigger, clampedWr) : null;
    if (entryHit) {
      validEntryRects.push(entryHit);
    } else {
      // Walkable doorway does not touch threshold zone -> dead-zone!
      deadZoneRects.push(clampedWr);
    }
  }

  const mergedValidEntries = mergeVerticalSpanRects(validEntryRects);
  const hasWalkableOverlap =
    mergedValidEntries.length > 0 &&
    trigger.kind !== 'unmapped_open_edge' &&
    trigger.targetExists;

  let hasHitboxClearance = hasWalkableOverlap;
  if (trigger.kind === 'edge_exit' && mergedValidEntries.length > 0) {
    if (trigger.direction === 'left' || trigger.direction === 'right') {
      hasHitboxClearance = mergedValidEntries.some((r) => r.height >= LINK_SIZE);
    } else if (trigger.direction === 'up' || trigger.direction === 'down') {
      hasHitboxClearance = mergedValidEntries.some((r) => r.width >= LINK_SIZE);
    }
    if (!hasHitboxClearance) {
      deadZoneRects.push(...mergedValidEntries);
    }
  }

  // 4. Solid-Tile Dead-Zone Overlap Scan inside Trigger Volume
  if (clippedTrigger) {
    const minCol = Math.max(0, Math.floor(clippedTrigger.x / DEBUG_TILE_SIZE));
    const maxCol = Math.min(
      15,
      Math.floor((clippedTrigger.x + clippedTrigger.width - 1) / DEBUG_TILE_SIZE)
    );
    const minRow = Math.max(0, Math.floor(clippedTrigger.y / DEBUG_TILE_SIZE));
    const maxRow = Math.min(
      10,
      Math.floor((clippedTrigger.y + clippedTrigger.height - 1) / DEBUG_TILE_SIZE)
    );

    const rawSolidOverlaps: TriggerRect[] = [];
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const tileId = screen.tiles[r]?.[c];
        if (SOLID_TILES.has(tileId)) {
          const tileRect: TriggerRect = {
            x: c * DEBUG_TILE_SIZE,
            y: r * DEBUG_TILE_SIZE,
            width: DEBUG_TILE_SIZE,
            height: DEBUG_TILE_SIZE,
          };
          const overlap = intersectRects(clippedTrigger, tileRect);
          if (overlap) {
            rawSolidOverlaps.push(overlap);
          }
        }
      }
    }
    solidOverlapRects.push(...mergeVerticalSpanRects(rawSolidOverlaps));
  }

  // For tile-targeted entries (cave/dungeon/secret), solid tile overlap means trigger itself is blocked
  const isTileEntry =
    trigger.kind === 'cave_entry' ||
    trigger.kind === 'dungeon_entry' ||
    trigger.kind === 'secret_entry' ||
    trigger.kind === 'hardcoded_stairs';
  if (isTileEntry && solidOverlapRects.length > 0) {
    deadZoneRects.push(...solidOverlapRects);
  }

  const checks: TriggerDryRunCheck[] = [
    {
      name: 'SCREEN BOUNDS',
      passed: withinScreenBounds,
      detail: withinScreenBounds
        ? `Contained in 0..256 × 0..176`
        : `Extends outside 256×176 viewport`,
    },
    {
      name: 'BOUNDARY FLUSH',
      passed: touchesExpectedBoundary,
      detail: boundaryDetail,
    },
    {
      name: 'DOORWAY CLEARANCE',
      passed: hasWalkableOverlap && hasHitboxClearance,
      detail:
        trigger.kind === 'unmapped_open_edge'
          ? 'Open edge has NO mapped destination screen'
          : !trigger.targetExists
          ? `Target screen "${trigger.targetScreenId}" does not exist`
          : hasWalkableOverlap && hasHitboxClearance
          ? `${mergedValidEntries.length} clear entry zone(s) for 14×14 hitbox`
          : 'Insufficient walkable overlap (<14px clearance)',
    },
    {
      name: 'WALL OVERLAP',
      passed: solidOverlapRects.length === 0,
      detail:
        solidOverlapRects.length === 0
          ? 'Zero solid tile overlap inside trigger volume'
          : isTileEntry
          ? `${solidOverlapRects.length} solid tile(s) blocking tile trigger`
          : `${solidOverlapRects.length} masked border wall span(s) overlap threshold`,
    },
  ];

  const hasCriticalDeadZone =
    deadZoneRects.length > 0 ||
    !withinScreenBounds ||
    !touchesExpectedBoundary ||
    !hasWalkableOverlap ||
    !hasHitboxClearance;

  const status: TriggerDryRunResult['status'] = hasCriticalDeadZone
    ? 'FAIL'
    : solidOverlapRects.length > 0
    ? 'WARN'
    : 'PASS';

  const summary =
    status === 'FAIL'
      ? `FAIL: ${deadZoneRects.length} unreachable dead-zone(s) flagged`
      : status === 'WARN'
      ? `VALID ENTRY (${solidOverlapRects.length} border wall overlap${solidOverlapRects.length > 1 ? 's' : ''} flagged)`
      : 'PASS: Clean geometry within screen bounds';

  return {
    triggerId: trigger.id,
    triggerLabel: trigger.label,
    screenId: screen.id,
    status,
    withinScreenBounds,
    touchesExpectedBoundary,
    hasWalkableOverlap,
    hasHitboxClearance,
    deadZoneRects,
    solidOverlapRects,
    validEntryRects: mergedValidEntries,
    summary,
    checks,
  };
}

export interface TriggerWarpPoint {
  x: number;
  y: number;
  dir: TriggerOrientationDir;
  targetScreenId?: string;
  canTeleport: boolean;
  reason: string;
}

function hasSolidTileOverlap(
  screen: ScreenData,
  x: number,
  y: number,
  w: number,
  h: number
): boolean {
  const minCol = Math.max(0, Math.floor(x / DEBUG_TILE_SIZE));
  const maxCol = Math.min(15, Math.floor((x + w - 1) / DEBUG_TILE_SIZE));
  const minRow = Math.max(0, Math.floor(y / DEBUG_TILE_SIZE));
  const maxRow = Math.min(10, Math.floor((y + h - 1) / DEBUG_TILE_SIZE));
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      if (SOLID_TILES.has(screen.tiles[r]?.[c])) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Computes exact, walkable teleport coordinates for Link's 14x14 hitbox inside the
 * selected trigger volume so GameEngine.checkScreenTransitions() fires cleanly without walking.
 */
export function computeTriggerWarpPoint(
  trigger: EntryTriggerVolume,
  screen: ScreenData
): TriggerWarpPoint {
  const LINK_SIZE = 14;
  const fallbackDir: TriggerOrientationDir =
    trigger.direction ?? trigger.expectedDirections[0] ?? 'up';

  if (!trigger.isReachable || trigger.walkableRects.length === 0) {
    return {
      x: 120,
      y: 88,
      dir: fallbackDir,
      targetScreenId: trigger.targetScreenId,
      canTeleport: false,
      reason: 'Trigger has no reachable walkable doorway or entry tile',
    };
  }

  const mergedWalkable = mergeVerticalSpanRects(trigger.walkableRects);

  if (trigger.kind === 'edge_exit' || trigger.kind === 'unmapped_open_edge') {
    const dir = trigger.direction ?? fallbackDir;
    const tr = trigger.thresholdRect;

    // Prefer a contiguous doorway span large enough for Link's 14x14 hitbox
    const bestSpan =
      dir === 'left' || dir === 'right'
        ? mergedWalkable
            .slice()
            .sort((a, b) => b.height - a.height)[0]
        : mergedWalkable
            .slice()
            .sort((a, b) => b.width - a.width)[0];

    let x = 120;
    let y = 88;

    if (dir === 'left') {
      x = Math.max(0, Math.min(4, tr.x + tr.width - 1, 2));
      y = Math.max(
        0,
        Math.min(
          DEBUG_SCREEN_HEIGHT - LINK_SIZE,
          Math.round(bestSpan.y + (bestSpan.height - LINK_SIZE) / 2)
        )
      );
    } else if (dir === 'right') {
      x = Math.max(DEBUG_SCREEN_WIDTH - 16, Math.min(DEBUG_SCREEN_WIDTH - LINK_SIZE, tr.x));
      y = Math.max(
        0,
        Math.min(
          DEBUG_SCREEN_HEIGHT - LINK_SIZE,
          Math.round(bestSpan.y + (bestSpan.height - LINK_SIZE) / 2)
        )
      );
    } else if (dir === 'up') {
      x = Math.max(
        0,
        Math.min(
          DEBUG_SCREEN_WIDTH - LINK_SIZE,
          Math.round(bestSpan.x + (bestSpan.width - LINK_SIZE) / 2)
        )
      );
      y = Math.max(0, Math.min(4, tr.y + tr.height - 1, 2));
    } else {
      x = Math.max(
        0,
        Math.min(
          DEBUG_SCREEN_WIDTH - LINK_SIZE,
          Math.round(bestSpan.x + (bestSpan.width - LINK_SIZE) / 2)
        )
      );
      // 160 satisfies both standard (p.y >= 156) and cave/D1_1/D2_1 (p.y >= 160) exit rules
      y = Math.max(DEBUG_SCREEN_HEIGHT - 16, Math.min(DEBUG_SCREEN_HEIGHT - LINK_SIZE, tr.y + 4));
      if (y < DEBUG_SCREEN_HEIGHT - 16) y = DEBUG_SCREEN_HEIGHT - 16;
    }

    if (hasSolidTileOverlap(screen, x, y, LINK_SIZE, LINK_SIZE)) {
      return {
        x,
        y,
        dir,
        targetScreenId: trigger.targetScreenId,
        canTeleport: false,
        reason: `Computed edge warp (${x}, ${y}) overlaps solid tile`,
      };
    }

    return {
      x,
      y,
      dir,
      targetScreenId: trigger.targetScreenId,
      canTeleport: true,
      reason: `Edge warp (${x}, ${y}) facing ${dir.toUpperCase()}`,
    };
  }

  // Tile-based triggers (cave_entry, dungeon_entry, secret_entry, hardcoded_stairs)
  for (const rect of trigger.walkableRects) {
    const candidateX = Math.max(
      0,
      Math.min(DEBUG_SCREEN_WIDTH - LINK_SIZE, Math.round(rect.x + (rect.width - LINK_SIZE) / 2))
    );
    const candidateY = Math.max(
      0,
      Math.min(DEBUG_SCREEN_HEIGHT - LINK_SIZE, Math.round(rect.y + (rect.height - LINK_SIZE) / 2))
    );
    if (!hasSolidTileOverlap(screen, candidateX, candidateY, LINK_SIZE, LINK_SIZE)) {
      return {
        x: candidateX,
        y: candidateY,
        dir: fallbackDir,
        targetScreenId: trigger.targetScreenId,
        canTeleport: true,
        reason: `Tile warp (${candidateX}, ${candidateY}) inside ${trigger.label}`,
      };
    }
  }

  return {
    x: 120,
    y: 88,
    dir: fallbackDir,
    targetScreenId: trigger.targetScreenId,
    canTeleport: false,
    reason: 'Target entry tile is blocked by solid collision',
  };
}

