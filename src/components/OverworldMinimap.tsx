/**
 * The Legend of Zelda NES - Overworld 8x8 Transparent Grid Minimap HUD Component
 * Renders an authentic transparent 8x8 topological grid of Hyrule on the HUD,
 * with a dynamic Fog-of-War system keeping screens shrouded until Link physically visits them.
 */

import React, { useState } from 'react';
import { ScreenData } from '../types';
import { MapPin, Compass, X, Grid, Eye, CloudFog } from 'lucide-react';
import {
  DUNGEON_MAP_LAYOUTS,
  DungeonLevelMapLayout,
  isDungeonRoomDiscovered,
} from '../game/secretWallDetector';

export interface OverworldMinimapProps {
  currentScreen: ScreenData;
  className?: string;
  showOverlay?: boolean;
  onToggleOverlay?: () => void;
  visitedScreens?: string[];
}

export interface GridCellInfo {
  col: number; // 4 to 11 (8 columns)
  row: number; // 0 to 7 (8 rows)
  id?: string;
  name: string;
  shortLabel: string;
  terrain: 'plains' | 'mountain' | 'river' | 'coast' | 'dungeon' | 'forest';
  isPlayable: boolean;
  hasCave?: boolean;
  hasDungeon?: boolean;
}

/**
 * Authentic 8x8 Hyrule Overworld Grid:
 * 8 Columns (Cols 4 to 11) x 8 Rows (Rows 0 to 7) = 64 Screens
 * Covering from Death Mountain peak (Row 0) to the Starting Screen & Coastline (Row 7).
 */
export const OVERWORLD_GRID: GridCellInfo[] = [
  // ==========================================
  // ROW 0: Death Mountain Peak & Northern Ridge
  // ==========================================
  { col: 4, row: 0, name: 'Spectacle Rock West', shortLabel: 'SPEC', terrain: 'mountain', isPlayable: false },
  { col: 5, row: 0, name: 'Death Mountain Peak (Level-9)', shortLabel: 'D-9', terrain: 'dungeon', isPlayable: false, hasDungeon: true },
  { col: 6, row: 0, name: 'Death Mountain North Pass', shortLabel: 'PASS', terrain: 'mountain', isPlayable: false },
  { col: 7, row: 0, name: 'Northern Mountain Ridge', shortLabel: 'RDGE', terrain: 'mountain', isPlayable: false },
  { col: 8, row: 0, name: 'Dead Rock Ridge', shortLabel: 'ROCK', terrain: 'mountain', isPlayable: false },
  { col: 9, row: 0, name: 'Northern Moors', shortLabel: 'MOOR', terrain: 'mountain', isPlayable: false },
  { col: 10, row: 0, name: 'North Sea Cliffs', shortLabel: 'CLIF', terrain: 'mountain', isPlayable: false },
  { col: 11, row: 0, name: 'Great Northern Ocean', shortLabel: 'SEA', terrain: 'river', isPlayable: false },

  // ==========================================
  // ROW 1: Graveyard & Lost Hills Northern Pass
  // ==========================================
  { col: 4, row: 1, name: 'Graveyard West', shortLabel: 'GRAV', terrain: 'mountain', isPlayable: false },
  { col: 5, row: 1, name: 'White Sword Graveyard', shortLabel: 'GRAV', terrain: 'mountain', isPlayable: false, hasCave: true },
  { col: 6, row: 1, name: 'Lost Hills Pass', shortLabel: 'HILL', terrain: 'forest', isPlayable: false },
  { col: 7, row: 1, name: 'Northern Woods Glade', shortLabel: 'WOOD', terrain: 'forest', isPlayable: false },
  { col: 8, row: 1, name: 'River Source Waterfall', shortLabel: 'FALL', terrain: 'river', isPlayable: false },
  { col: 9, row: 1, name: 'Waterfall Secret Cavern', shortLabel: 'CAVE', terrain: 'mountain', isPlayable: false, hasCave: true },
  { col: 10, row: 1, name: 'North Ocean Headland', shortLabel: 'BLUF', terrain: 'coast', isPlayable: false },
  { col: 11, row: 1, name: 'Storm Sea Deep', shortLabel: 'SEA', terrain: 'river', isPlayable: false },

  // ==========================================
  // ROW 2: Lost Woods & Upper River Crossing
  // ==========================================
  { col: 4, row: 2, name: 'Lost Woods Entrance', shortLabel: 'LOST', terrain: 'forest', isPlayable: false },
  { col: 5, row: 2, name: 'Lost Woods Heart', shortLabel: 'WOOD', terrain: 'forest', isPlayable: false },
  { col: 6, row: 2, name: 'Western Steppes', shortLabel: 'STEP', terrain: 'plains', isPlayable: false },
  { col: 7, row: 2, name: 'Upper River Bend', shortLabel: 'RVR', terrain: 'river', isPlayable: false },
  { col: 8, row: 2, name: 'Upper River Bridge', shortLabel: 'BRDG', terrain: 'river', isPlayable: false },
  { col: 9, row: 2, name: 'Eastern Moors', shortLabel: 'MOOR', terrain: 'plains', isPlayable: false },
  { col: 10, row: 2, name: 'Coastline Bluff', shortLabel: 'CLIF', terrain: 'coast', isPlayable: false },
  { col: 11, row: 2, name: 'Eastern Deep Sea', shortLabel: 'SEA', terrain: 'river', isPlayable: false },

  // ==========================================
  // ROW 3: Western Glade & Stream Tributaries
  // ==========================================
  { col: 4, row: 3, name: 'Western Glade', shortLabel: 'GLAD', terrain: 'forest', isPlayable: false },
  { col: 5, row: 3, name: 'Blue Ring Secret Glade', shortLabel: 'RING', terrain: 'forest', isPlayable: false, hasCave: true },
  { col: 6, row: 3, name: 'Upper Whispering Stream', shortLabel: 'STRM', terrain: 'river', isPlayable: false },
  { col: 7, row: 3, name: 'Eagle Approach Stream', shortLabel: 'STRM', terrain: 'river', isPlayable: false },
  { col: 8, row: 3, name: 'Dead Tree Grove', shortLabel: 'TREE', terrain: 'forest', isPlayable: false },
  { col: 9, row: 3, name: 'Eastern Steppes', shortLabel: 'STEP', terrain: 'plains', isPlayable: false },
  { col: 10, row: 3, name: 'Shoreline Sands', shortLabel: 'SAND', terrain: 'coast', isPlayable: false },
  { col: 11, row: 3, name: 'Outer Ocean', shortLabel: 'SEA', terrain: 'river', isPlayable: false },

  // ==========================================
  // ROW 4: Level 1 The Eagle & Central Highlands
  // ==========================================
  { col: 4, row: 4, name: 'Death Mountain Slopes', shortLabel: 'MNT', terrain: 'mountain', isPlayable: false },
  { col: 5, row: 4, name: 'North Rock Pass', shortLabel: 'PASS', terrain: 'mountain', isPlayable: false },
  { col: 6, row: 4, name: 'Eagle Bluff', shortLabel: 'BLUF', terrain: 'mountain', isPlayable: false },
  { col: 7, row: 4, id: 'O7_4', name: 'Level 1: The Eagle Entrance', shortLabel: 'D-1', terrain: 'dungeon', isPlayable: true, hasDungeon: true },
  { col: 8, row: 4, name: 'Dead Rock Ridge', shortLabel: 'RDGE', terrain: 'mountain', isPlayable: false },
  { col: 9, row: 4, name: 'Northern Moors', shortLabel: 'MOOR', terrain: 'mountain', isPlayable: false },
  { col: 10, row: 4, name: 'North Sea Cliffs', shortLabel: 'CLIF', terrain: 'mountain', isPlayable: false },
  { col: 11, row: 4, name: 'Northern Ocean', shortLabel: 'SEA', terrain: 'river', isPlayable: false },

  // ==========================================
  // ROW 5: Goblin Forest & Level 3 The Manji
  // ==========================================
  { col: 4, row: 5, name: 'Lost Woods Deep', shortLabel: 'WOOD', terrain: 'forest', isPlayable: false },
  { col: 5, row: 5, name: 'Lost Woods Border', shortLabel: 'WOOD', terrain: 'forest', isPlayable: false },
  { col: 6, row: 5, name: 'Western Stream', shortLabel: 'RVR', terrain: 'river', isPlayable: false },
  { col: 7, row: 5, id: 'O7_5', name: 'Goblin Forest & Fairy Spring', shortLabel: 'FRST', terrain: 'forest', isPlayable: true, hasCave: true },
  { col: 8, row: 5, id: 'O8_5', name: 'Level 3: The Manji Glade', shortLabel: 'D-3', terrain: 'dungeon', isPlayable: true, hasDungeon: true },
  { col: 9, row: 5, name: 'Eastern Prairie', shortLabel: 'PRAR', terrain: 'plains', isPlayable: false },
  { col: 10, row: 5, name: 'Coastal Dunes', shortLabel: 'DUNE', terrain: 'coast', isPlayable: false },
  { col: 11, row: 5, name: 'Eastern Sea', shortLabel: 'SEA', terrain: 'river', isPlayable: false },

  // ==========================================
  // ROW 6: Level 2 Lake, River Bridge & Headland
  // ==========================================
  { col: 4, row: 6, id: 'O4_6', name: 'Ancient Cemetery', shortLabel: 'GRAV', terrain: 'mountain', isPlayable: true },
  { col: 5, row: 6, id: 'O5_6', name: 'Haunted Graveyard', shortLabel: 'GRAV', terrain: 'mountain', isPlayable: true },
  { col: 6, row: 6, id: 'O6_6', name: 'Whispering Lake & Level-2 Entrance', shortLabel: 'D-2', terrain: 'dungeon', isPlayable: true, hasDungeon: true },
  { col: 7, row: 6, id: 'O7_6', name: 'River Crossing & White Sword', shortLabel: 'RIVR', terrain: 'river', isPlayable: true, hasCave: true },
  { col: 8, row: 6, id: 'O8_6', name: 'Coastal Headland & Gambling Den', shortLabel: 'HEAD', terrain: 'coast', isPlayable: true, hasCave: true },
  { col: 9, row: 6, name: 'Desert Boundary', shortLabel: 'DSRT', terrain: 'plains', isPlayable: false },
  { col: 10, row: 6, name: 'Eastern Beach', shortLabel: 'BCH', terrain: 'coast', isPlayable: false },
  { col: 11, row: 6, name: 'Great Ocean', shortLabel: 'SEA', terrain: 'river', isPlayable: false },

  // ==========================================
  // ROW 7: Starting Glade, Desert & Southern Coast
  // ==========================================
  { col: 4, row: 7, name: 'Southwest Wilds', shortLabel: 'WILD', terrain: 'plains', isPlayable: false },
  { col: 5, row: 7, id: 'O5_7', name: 'Western Desert & Merchant Shop', shortLabel: 'DSRT', terrain: 'plains', isPlayable: true, hasCave: true },
  { col: 6, row: 7, id: 'O6_7', name: 'Rocky Foothills & Heart Cavern', shortLabel: 'HILL', terrain: 'mountain', isPlayable: true, hasCave: true },
  { col: 7, row: 7, id: 'O7_7', name: 'Starting Screen & Old Man Cave', shortLabel: 'STRT', terrain: 'plains', isPlayable: true, hasCave: true },
  { col: 8, row: 7, id: 'O8_7', name: 'Eastern Coast & Rupee Cave', shortLabel: 'CST', terrain: 'coast', isPlayable: true, hasCave: true },
  { col: 9, row: 7, name: 'Tidepool Coast', shortLabel: 'TIDE', terrain: 'coast', isPlayable: false },
  { col: 10, row: 7, name: 'Coastal Shoals', shortLabel: 'SHOL', terrain: 'river', isPlayable: false },
  { col: 11, row: 7, name: 'Deep Sea Border', shortLabel: 'DEEP', terrain: 'river', isPlayable: false },
];

/**
 * Checks whether an 8x8 overworld grid cell has been physically visited by Link.
 * A cell is considered visited if:
 * 1. The player is currently on this screen.
 * 2. The screen ID or coordinate is recorded in the visitedScreens array.
 */
export function isCellVisited(
  cell: GridCellInfo,
  visitedScreens?: string[],
  currentLocation?: { col: number; row: number }
): boolean {
  // If player is currently located on this screen, it is visited
  if (currentLocation && cell.col === currentLocation.col && cell.row === currentLocation.row) {
    return true;
  }
  if (!visitedScreens || visitedScreens.length === 0) {
    // Starting screen (Col 7, Row 7) is always initially visited
    return cell.col === 7 && cell.row === 7;
  }
  if (cell.id && visitedScreens.includes(cell.id)) return true;
  if (visitedScreens.includes(`O${cell.col}_${cell.row}`)) return true;
  if (visitedScreens.includes(`${cell.col},${cell.row}`)) return true;
  if (visitedScreens.includes(`C${cell.col}_R${cell.row}`)) return true;

  return false;
}

/**
 * Maps any screen ID in the entire game to authentic overworld coordinates (col, row)
 */
export function getPlayerOverworldLocation(screen: ScreenData): {
  col: number;
  row: number;
  areaType: 'OVERWORLD' | 'CAVE' | 'LEVEL-1' | 'LEVEL-2' | 'LEVEL-3';
  areaName: string;
  coordString: string;
  isDungeon: boolean;
  isCave: boolean;
} {
  // 1. Level-1 Dungeons (The Eagle at screen O7_4 -> col: 7, row: 4)
  if (screen.id.startsWith('D1_')) {
    return {
      col: 7,
      row: 4,
      areaType: 'LEVEL-1',
      areaName: screen.name || 'Level 1: The Eagle',
      coordString: '7,4',
      isDungeon: true,
      isCave: false,
    };
  }

  // 2. Level-2 Dungeons (The Moon at screen O6_6 -> col: 6, row: 6)
  if (screen.id.startsWith('D2_')) {
    return {
      col: 6,
      row: 6,
      areaType: 'LEVEL-2',
      areaName: screen.name || 'Level 2: The Moon',
      coordString: '6,6',
      isDungeon: true,
      isCave: false,
    };
  }

  // 3. Level-3 Dungeons (The Manji at screen O8_5 -> col: 8, row: 5)
  if (screen.id.startsWith('D3_')) {
    return {
      col: 8,
      row: 5,
      areaType: 'LEVEL-3',
      areaName: screen.name || 'Level 3: The Manji',
      coordString: '8,5',
      isDungeon: true,
      isCave: false,
    };
  }

  // 4. Overworld Secret Caves & Shops
  if (screen.id === 'C_START') {
    return {
      col: 7,
      row: 7,
      areaType: 'CAVE',
      areaName: "Old Man's Cave",
      coordString: '7,7',
      isDungeon: false,
      isCave: true,
    };
  }

  if (screen.id === 'C_SHOP') {
    return {
      col: 5,
      row: 7,
      areaType: 'CAVE',
      areaName: 'Item Merchant Shop',
      coordString: '5,7',
      isDungeon: false,
      isCave: true,
    };
  }

  if (screen.id === 'C_SECRET_SHOP') {
    return {
      col: 7,
      row: 5,
      areaType: 'CAVE',
      areaName: 'Secret Subterranean Shop',
      coordString: '7,5',
      isDungeon: false,
      isCave: true,
    };
  }

  if (screen.id === 'C_SECRET_HEART') {
    return {
      col: 6,
      row: 7,
      areaType: 'CAVE',
      areaName: 'Secret Heart Cavern',
      coordString: '6,7',
      isDungeon: false,
      isCave: true,
    };
  }

  if (screen.id === 'C_SECRET_RUPEE') {
    return {
      col: 8,
      row: 7,
      areaType: 'CAVE',
      areaName: 'Secret Coastal Cavern',
      coordString: '8,7',
      isDungeon: false,
      isCave: true,
    };
  }

  if (screen.id === 'C_SECRET_WHITE_SWORD') {
    return {
      col: 7,
      row: 6,
      areaType: 'CAVE',
      areaName: 'Ancient Blade Sanctum',
      coordString: '7,6',
      isDungeon: false,
      isCave: true,
    };
  }

  if (screen.id === 'C_GAMBLE') {
    return {
      col: 8,
      row: 6,
      areaType: 'CAVE',
      areaName: 'Money Making Game',
      coordString: '8,6',
      isDungeon: false,
      isCave: true,
    };
  }

  if (screen.id === 'C_SECRET_FAIRY_SPRING') {
    return {
      col: 7,
      row: 5,
      areaType: 'CAVE',
      areaName: 'Great Fairy Spring',
      coordString: '7,5',
      isDungeon: false,
      isCave: true,
    };
  }

  // 5. Overworld Screens Pattern O<col>_<row>
  const match = screen.id.match(/^O(\d+)_(\d+)$/);
  if (match) {
    const col = parseInt(match[1], 10);
    const row = parseInt(match[2], 10);
    return {
      col,
      row,
      areaType: 'OVERWORLD',
      areaName: screen.name || `Overworld Screen [${col},${row}]`,
      coordString: `${col},${row}`,
      isDungeon: false,
      isCave: false,
    };
  }

  // Fallback default (Starting Glade)
  return {
    col: 7,
    row: 7,
    areaType: 'OVERWORLD',
    areaName: screen.name || 'Hyrule Overworld',
    coordString: '7,7',
    isDungeon: false,
    isCave: false,
  };
}

/**
 * Transparent 8x8 Grid Minimap HUD Sub-Component with Fog-of-War
 */
export const OverworldMinimap: React.FC<OverworldMinimapProps> = ({
  currentScreen,
  className = '',
  showOverlay = false,
  onToggleOverlay,
  visitedScreens = ['O7_7', '7,7'],
}) => {
  const [showFullMapModal, setShowFullMapModal] = useState(false);
  const [fogOfWarActive, setFogOfWarActive] = useState<boolean>(true);
  const [modalViewMode, setModalViewMode] = useState<'auto' | 'dungeon' | 'overworld'>('auto');
  const location = getPlayerOverworldLocation(currentScreen);

  const activeDungeonLevel: 1 | 2 | 3 | null =
    location.areaType === 'LEVEL-1'
      ? 1
      : location.areaType === 'LEVEL-2'
      ? 2
      : location.areaType === 'LEVEL-3'
      ? 3
      : null;
  const dungeonLayout: DungeonLevelMapLayout | null = activeDungeonLevel
    ? DUNGEON_MAP_LAYOUTS[activeDungeonLevel]
    : null;
  const dungeonDiscoveredCount = dungeonLayout
    ? dungeonLayout.rooms.filter((room) =>
        isDungeonRoomDiscovered(room, visitedScreens, currentScreen.id)
      ).length
    : 0;
  const showDungeonInModal =
    dungeonLayout !== null &&
    (modalViewMode === 'dungeon' || (modalViewMode === 'auto' && location.isDungeon));

  // Compute number of revealed / explored screens
  const visitedCount = OVERWORLD_GRID.filter((c) =>
    isCellVisited(c, visitedScreens, location)
  ).length;

  // Translucent colors for revealed cells
  const getRevealedCellColor = (cell: GridCellInfo, isCurrent: boolean) => {
    if (isCurrent) {
      return 'bg-[#58f898] ring-1 ring-white shadow-[0_0_8px_rgba(88,248,152,0.9)]';
    }

    if (!cell.isPlayable) {
      return 'bg-[#12121c]/45'; // Dark semi-transparent unexplored border
    }

    switch (cell.terrain) {
      case 'dungeon':
        return 'bg-[#d82800]/50 border-red-500/30'; // Dungeon entrance red
      case 'river':
        return 'bg-[#0078f8]/40 border-blue-500/30'; // Water blue
      case 'mountain':
        return 'bg-[#b87800]/45 border-amber-600/30'; // Rock brown
      case 'forest':
        return 'bg-[#005800]/45 border-emerald-800/30'; // Forest dark green
      case 'coast':
        return 'bg-[#c8b070]/40 border-yellow-600/30'; // Shore sand
      case 'plains':
      default:
        return 'bg-[#008000]/40 border-emerald-600/30'; // Hyrule green plains
    }
  };

  return (
    <>
      <div
        id="overworld-minimap-hud"
        className={`flex flex-col items-start select-none bg-black/40 backdrop-blur-[2px] p-1 rounded border border-gray-700/60 hover:border-[#58f898] transition-all group ${className}`}
      >
        {/* Header Bar with Location Type Badge, Real-Time Coordinates & Overlay Toggle */}
        <div className="flex items-center justify-between w-full mb-1 text-[7px] font-bold gap-1">
          <div className="flex items-center gap-1">
            <span
              className={`${
                location.areaType.startsWith('LEVEL')
                  ? 'text-[#58f898]'
                  : location.areaType === 'CAVE'
                  ? 'text-[#f8b800]'
                  : 'text-[#38bdf8]'
              }`}
            >
              {location.areaType}
            </span>
            <span
              className="text-[#58f898] font-mono tracking-tight bg-black/60 px-1 rounded border border-[#58f898]/40"
              title={`Overworld Coordinate [Col: ${location.col}, Row: ${location.row}]`}
            >
              [{location.coordString}]
            </span>
          </div>

          {/* Quick HUD Toggle for Transparent Viewport 8x8 Overlay */}
          {onToggleOverlay && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleOverlay();
              }}
              className={`p-0.5 rounded text-[6px] border flex items-center gap-0.5 transition-colors cursor-pointer ${
                showOverlay
                  ? 'bg-[#58f898]/20 border-[#58f898] text-[#58f898]'
                  : 'bg-black/50 border-gray-600 text-gray-400 hover:text-white hover:border-gray-400'
              }`}
              title={showOverlay ? 'Hide Viewport 8x8 Grid Overlay (G)' : 'Show Viewport 8x8 Grid Overlay (G)'}
            >
              {showOverlay ? <Eye size={8} /> : <Grid size={8} />}
              <span className="hidden sm:inline">8x8</span>
            </button>
          )}
        </div>

        {/* Compact HUD Minimap: Dungeon Blueprint when in Dungeon, 8x8 Hyrule Grid on Overworld */}
        {location.isDungeon && dungeonLayout ? (
          <div
            onClick={() => setShowFullMapModal(true)}
            className="relative bg-[#07111a] border border-cyan-500/40 p-[2px] grid gap-[2px] rounded-sm shadow-inner cursor-pointer group-hover:border-white transition-colors"
            style={{
              width: '58px',
              height: '58px',
              gridTemplateColumns: `repeat(${dungeonLayout.cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${dungeonLayout.rows}, minmax(0, 1fr))`,
            }}
            title={`Click to expand ${dungeonLayout.title} Map (${dungeonDiscoveredCount}/${dungeonLayout.rooms.length} rooms discovered)`}
          >
            {Array.from({ length: dungeonLayout.rows * dungeonLayout.cols }).map((_, idx) => {
              const gx = idx % dungeonLayout.cols;
              const gy = Math.floor(idx / dungeonLayout.cols);
              const room = dungeonLayout.rooms.find((r) => r.gx === gx && r.gy === gy);
              if (!room) {
                return <div key={`d_empty_${gx}_${gy}`} className="w-full h-full bg-transparent" />;
              }

              const isCurrentRoom = room.id === currentScreen.id;
              const discovered = isDungeonRoomDiscovered(room, visitedScreens, currentScreen.id);
              const isRevealed = !fogOfWarActive || discovered;

              if (!isRevealed) {
                return (
                  <div
                    key={`d_fog_${room.id}`}
                    className="w-full h-full rounded-[1px] border border-slate-800/70 bg-[#070b12]/80 flex items-center justify-center"
                    title="Unexplored Room"
                  >
                    <div className="w-[1.5px] h-[1.5px] bg-slate-700/60 rounded-full" />
                  </div>
                );
              }

              const isSecretOrShortcut = room.role === 'secret' || room.role === 'shortcut';
              const cellBg = isCurrentRoom
                ? 'bg-[#58f898] border-white ring-1 ring-white shadow-[0_0_6px_rgba(88,248,152,0.9)]'
                : isSecretOrShortcut
                ? 'bg-[#f8b800]/65 border-[#f8b800]'
                : room.role === 'triforce'
                ? 'bg-amber-500/60 border-amber-300'
                : room.role === 'boss'
                ? 'bg-red-600/60 border-red-400'
                : 'bg-[#0078f8]/60 border-cyan-300/60';

              return (
                <div
                  key={`d_room_${room.id}`}
                  className={`w-full h-full relative rounded-[1px] border flex items-center justify-center ${cellBg}`}
                  title={`${room.label} (${room.id})${isCurrentRoom ? ' - CURRENT' : ''}`}
                >
                  {isCurrentRoom && (
                    <div className="w-1.5 h-1.5 bg-black rounded-full ring-1 ring-white animate-nes-blink" />
                  )}
                  {!isCurrentRoom && isSecretOrShortcut && (
                    <div className="w-1 h-1 bg-white rounded-full" />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div
            onClick={() => setShowFullMapModal(true)}
            className="relative bg-black/60 border border-white/20 p-[1px] grid grid-cols-8 gap-[1px] rounded-sm shadow-inner cursor-pointer group-hover:border-white transition-colors"
            style={{ width: '58px', height: '58px' }}
            title={`Click to expand full 8x8 Hyrule Map (Fog of War: ${visitedCount}/64 explored)`}
          >
            {OVERWORLD_GRID.map((cell) => {
              const isPlayerHere = cell.col === location.col && cell.row === location.row;
              const visited = isCellVisited(cell, visitedScreens, location);
              const isRevealed = !fogOfWarActive || visited || isPlayerHere;

              return (
                <div
                  key={`grid_${cell.col}_${cell.row}`}
                  className={`w-full h-full relative rounded-[0.5px] border transition-all flex items-center justify-center ${
                    isRevealed
                      ? `border-white/10 ${getRevealedCellColor(cell, isPlayerHere)}`
                      : 'border-black/50 bg-[#08080f]/90 shadow-inner'
                  }`}
                  title={
                    isRevealed
                      ? `[${cell.col},${cell.row}] ${cell.name}${isPlayerHere ? ' (YOU ARE HERE)' : ''}`
                      : `[${cell.col},${cell.row}] Unexplored (Fog of War)`
                  }
                >
                  {/* Fog Shroud indicator for unvisited screens */}
                  {!isRevealed && (
                    <div className="w-[1.5px] h-[1.5px] bg-gray-700/30 rounded-full" />
                  )}

                  {/* Flashing Link Position Indicator (Always visible on active screen) */}
                  {isPlayerHere && (
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping absolute opacity-75" />
                  )}
                  {isPlayerHere && (
                    <div className="w-1 h-1 bg-black rounded-full z-10 animate-nes-blink ring-1 ring-white" />
                  )}

                  {/* Dungeon Marker (Only visible if screen has been visited) */}
                  {isRevealed && !isPlayerHere && cell.hasDungeon && (
                    <div className="w-0.5 h-0.5 bg-[#f8b800] rounded-[0.5px]" />
                  )}

                  {/* Cave Marker (Only visible if screen has been visited) */}
                  {isRevealed && !isPlayerHere && cell.hasCave && !cell.hasDungeon && (
                    <div className="w-0.5 h-0.5 bg-white rounded-[0.5px]" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Short location name hint & exploration stats */}
        <div
          onClick={() => setShowFullMapModal(true)}
          className="text-[6px] text-gray-300 mt-1 tracking-tighter truncate max-w-[58px] cursor-pointer hover:text-white flex items-center justify-between w-full"
          title={
            location.isDungeon && dungeonLayout
              ? `${location.areaName} (${dungeonDiscoveredCount}/${dungeonLayout.rooms.length} rooms)`
              : `${location.areaName} [${location.coordString}] (Explored: ${visitedCount}/64)`
          }
        >
          <span className="truncate">{location.areaName.slice(0, 7)}</span>
          <span className="text-[#58f898] text-[5px] font-mono">
            {location.isDungeon && dungeonLayout
              ? `${dungeonDiscoveredCount}/${dungeonLayout.rooms.length}`
              : `${visitedCount}/64`}
          </span>
        </div>
      </div>

      {/* Expanded Hyrule Exploration Map Modal (Full 8x8 Detail with Fog of War) */}
      {showFullMapModal && (
        <div
          id="overworld-map-modal"
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 font-['Press_Start_2P',monospace]"
          onClick={() => setShowFullMapModal(false)}
        >
          <div
            className="w-full max-w-lg bg-[#0d0d14]/95 border-4 border-[#f8b800] p-4 text-white shadow-2xl flex flex-col gap-3 relative rounded"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b-2 border-gray-700 pb-2">
              <div className="flex items-center gap-2">
                <Compass size={18} className="text-[#f8b800]" />
                <div>
                  <span className="text-[11px] text-[#f8b800] tracking-wider block">
                    {showDungeonInModal && dungeonLayout ? dungeonLayout.title : 'HYRULE OVERWORLD'}
                  </span>
                  <span className="text-[7px] text-gray-400">
                    {showDungeonInModal
                      ? 'DUNGEON FLOOR & SECRET PASSAGE MAP'
                      : '8x8 TOPOLOGICAL GRID SYSTEM'}
                  </span>
                </div>
              </div>

              {/* Dungeon/Overworld Mode Switch, Fog-of-War Toggle & Close */}
              <div className="flex items-center gap-2">
                {dungeonLayout && (
                  <button
                    onClick={() =>
                      setModalViewMode(showDungeonInModal ? 'overworld' : 'dungeon')
                    }
                    className="px-1.5 py-1 rounded text-[6px] border border-cyan-400 bg-cyan-950/60 text-cyan-200 hover:text-white cursor-pointer"
                    title="Switch between Dungeon Floor Map and Hyrule Overworld"
                  >
                    {showDungeonInModal ? 'OVERWORLD' : 'DUNGEON'}
                  </button>
                )}

                <button
                  onClick={() => setFogOfWarActive(!fogOfWarActive)}
                  className={`px-1.5 py-1 rounded text-[6px] border flex items-center gap-1 cursor-pointer transition-colors ${
                    fogOfWarActive
                      ? 'bg-[#1f2937] border-[#38bdf8] text-[#38bdf8]'
                      : 'bg-[#374151] border-gray-500 text-gray-300 hover:text-white'
                  }`}
                  title="Toggle Fog of War on/off"
                >
                  <CloudFog size={10} />
                  <span>FOG: {fogOfWarActive ? 'ACTIVE' : 'REVEALED'}</span>
                </button>

                <button
                  onClick={() => setShowFullMapModal(false)}
                  className="p-1 hover:text-red-400 text-gray-400 cursor-pointer"
                  title="Close Map"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Current Position & Exploration Progress Banner */}
            <div className="bg-[#151522] border border-gray-700 p-2 flex items-center justify-between text-[8px] rounded">
              <div>
                <span className="text-gray-400">
                  {showDungeonInModal ? 'ROOM: ' : 'CURRENT COORD: '}
                </span>
                <span className="text-[#58f898] font-bold font-mono">
                  {showDungeonInModal
                    ? currentScreen.id
                    : `[COL: ${location.col}, ROW: ${location.row}]`}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin size={12} className="text-[#d82800]" />
                <span className="text-white truncate max-w-[150px]">{location.areaName}</span>
              </div>
              <div className="text-[7px] bg-[#1e293b] px-1.5 py-0.5 rounded border border-gray-600 font-mono text-[#58f898]">
                {showDungeonInModal && dungeonLayout
                  ? `${dungeonDiscoveredCount}/${dungeonLayout.rooms.length} ROOMS`
                  : `${visitedCount}/64 (${Math.round((visitedCount / 64) * 100)}%)`}
              </div>
            </div>

            {/* Detailed Dungeon Blueprint OR 8x8 Overworld Grid */}
            {showDungeonInModal && dungeonLayout ? (
              <div className="bg-[#060b12] border-2 border-cyan-400/70 p-4 flex flex-col items-center rounded">
                <div
                  className="grid gap-3 w-full max-w-[320px]"
                  style={{
                    gridTemplateColumns: `repeat(${dungeonLayout.cols}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${dungeonLayout.rows}, minmax(0, 1fr))`,
                  }}
                >
                  {Array.from({ length: dungeonLayout.rows * dungeonLayout.cols }).map((_, idx) => {
                    const gx = idx % dungeonLayout.cols;
                    const gy = Math.floor(idx / dungeonLayout.cols);
                    const room = dungeonLayout.rooms.find((r) => r.gx === gx && r.gy === gy);
                    if (!room) {
                      return <div key={`modal_d_empty_${gx}_${gy}`} className="h-14" />;
                    }

                    const isPlayerHere = room.id === currentScreen.id;
                    const discovered = isDungeonRoomDiscovered(room, visitedScreens, currentScreen.id);
                    const isRevealed = !fogOfWarActive || discovered;
                    const isSecretOrShortcut = room.role === 'secret' || room.role === 'shortcut';

                    return (
                      <div
                        key={`modal_d_room_${room.id}`}
                        className={`h-14 relative rounded border-2 flex flex-col items-center justify-center p-1 transition-all ${
                          isPlayerHere
                            ? 'border-white bg-[#58f898]/35 ring-2 ring-[#58f898] scale-105 z-10'
                            : isRevealed
                            ? isSecretOrShortcut
                              ? 'border-[#f8b800] bg-[#f8b800]/20 text-[#f8b800]'
                              : room.role === 'boss'
                              ? 'border-red-400 bg-red-900/40 text-red-200'
                              : room.role === 'triforce'
                              ? 'border-amber-300 bg-amber-700/40 text-amber-200'
                              : 'border-cyan-400 bg-cyan-950/60 text-cyan-100'
                            : 'border-gray-800 bg-[#090912] text-gray-600'
                        }`}
                      >
                        {/* Edge passage connectors (opened secret shortcuts glow gold) */}
                        {isRevealed &&
                          room.connections?.map((conn) => {
                            const isSecretConn = Boolean(conn.secretId);
                            const isOpened =
                              !conn.secretId || visitedScreens.includes(`secret:${conn.secretId}`);
                            if (!isOpened && fogOfWarActive) return null;
                            const posClass =
                              conn.dir === 'up'
                                ? '-top-2 left-1/2 -translate-x-1/2 w-2 h-2'
                                : conn.dir === 'down'
                                ? '-bottom-2 left-1/2 -translate-x-1/2 w-2 h-2'
                                : conn.dir === 'left'
                                ? '-left-2 top-1/2 -translate-y-1/2 w-2 h-2'
                                : '-right-2 top-1/2 -translate-y-1/2 w-2 h-2';
                            return (
                              <span
                                key={`conn_${room.id}_${conn.dir}_${conn.toId}`}
                                className={`absolute ${posClass} rounded-[1px] ${
                                  isSecretConn ? 'bg-[#f8b800]' : 'bg-cyan-300'
                                }`}
                                title={
                                  isSecretConn
                                    ? conn.isShortcut
                                      ? 'Discovered Shortcut Passage'
                                      : 'Discovered Secret Passage'
                                    : 'Open Passage'
                                }
                              />
                            );
                          })}

                        {isRevealed ? (
                          <>
                            <span className="text-[7px] font-bold tracking-tight">{room.label}</span>
                            <span className="text-[5px] opacity-80 font-mono truncate max-w-full">
                              {isPlayerHere
                                ? 'LINK'
                                : isSecretOrShortcut
                                ? 'SECRET'
                                : room.role.toUpperCase()}
                            </span>
                          </>
                        ) : (
                          <span className="text-[8px] font-mono opacity-40">?</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-black/80 border-2 border-white p-2 flex flex-col items-center rounded">
                {/* Column Indices (Cols 4 to 11) */}
                <div className="grid grid-cols-8 gap-1 w-full mb-1 text-center">
                  {[4, 5, 6, 7, 8, 9, 10, 11].map((c) => (
                    <span key={`col_idx_${c}`} className="text-[6px] text-gray-400 font-mono">
                      C{c}
                    </span>
                  ))}
                </div>

                {/* 8x8 Grid Cells */}
                <div className="grid grid-cols-8 gap-1 w-full">
                  {OVERWORLD_GRID.map((cell) => {
                    const isPlayerHere = cell.col === location.col && cell.row === location.row;
                    const visited = isCellVisited(cell, visitedScreens, location);
                    const isRevealed = !fogOfWarActive || visited || isPlayerHere;

                    return (
                      <div
                        key={`modal_grid_${cell.col}_${cell.row}`}
                        className={`h-9 relative rounded border flex flex-col items-center justify-between p-0.5 transition-transform ${
                          isPlayerHere
                            ? 'border-white bg-[#58f898]/30 ring-2 ring-[#58f898] scale-105 z-10'
                            : isRevealed
                            ? cell.isPlayable
                              ? 'border-gray-500 ' + getRevealedCellColor(cell, false)
                              : 'border-gray-800 bg-[#121218]/60 opacity-60'
                            : 'border-gray-900 bg-[#090912] opacity-75'
                        }`}
                        title={
                          isRevealed
                            ? `[Col: ${cell.col}, Row: ${cell.row}] ${cell.name}${
                                isPlayerHere ? ' (YOU ARE HERE)' : ''
                              }`
                            : `[Col: ${cell.col}, Row: ${cell.row}] Shrouded in Fog of War (Unvisited)`
                        }
                      >
                        <span className="text-[5px] text-gray-400 font-mono">
                          {cell.col},{cell.row}
                        </span>

                        {/* Content when revealed */}
                        {isRevealed ? (
                          <>
                            {/* Landmarks */}
                            {cell.hasDungeon && (
                              <span className="text-[8px]" title="Dungeon Entrance">
                                🏰
                              </span>
                            )}
                            {cell.hasCave && !cell.hasDungeon && (
                              <span className="text-[7px]" title="Secret Cave / Shop">
                                ⚔️
                              </span>
                            )}
                            {cell.terrain === 'river' && !cell.hasDungeon && !cell.hasCave && (
                              <span className="text-[6px] text-blue-300">〰️</span>
                            )}

                            {/* Player Marker */}
                            {isPlayerHere && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="text-[12px] animate-bounce" title="LINK">
                                  🟢
                                </span>
                              </div>
                            )}

                            <span className="text-[5px] text-gray-200 tracking-tighter truncate w-full text-center font-bold">
                              {cell.shortLabel}
                            </span>
                          </>
                        ) : (
                          /* Content when shrouded under fog of war */
                          <div className="flex-1 flex flex-col items-center justify-center opacity-40">
                            <span className="text-[7px] text-gray-500 font-mono">?</span>
                            <span className="text-[4px] text-gray-600 font-mono tracking-tighter">FOG</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Map Legend */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[7px] text-gray-300 bg-[#14141e] p-2 border border-gray-800 rounded">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 bg-[#58f898] rounded-full animate-pulse" />
                <span>Link Location</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span>🏰</span>
                <span>Dungeons (1, 2, 3)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span>⚔️</span>
                <span>Caves / Shops</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 bg-[#090912] border border-gray-700 rounded-sm" />
                <span>Fog of War</span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between text-[7px] text-gray-400 border-t border-gray-800 pt-2">
              <span>PRESS ESC TO CLOSE</span>
              {onToggleOverlay && (
                <button
                  onClick={() => {
                    onToggleOverlay();
                    setShowFullMapModal(false);
                  }}
                  className="text-[#58f898] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Grid size={10} />
                  <span>{showOverlay ? 'DISABLE' : 'ENABLE'} VIEWPORT OVERLAY</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/**
 * Transparent 8x8 Grid Overlay projected directly over the viewport canvas
 * Tracks Link's coordinate and respects the Fog-of-War system
 */
export const OverworldViewportGridOverlay: React.FC<{
  currentScreen: ScreenData;
  visitedScreens?: string[];
  fogOfWarActive?: boolean;
}> = ({ currentScreen, visitedScreens = ['O7_7', '7,7'], fogOfWarActive = true }) => {
  const location = getPlayerOverworldLocation(currentScreen);

  // 8 rows (0 to 7) and 8 columns (4 to 11)
  const rows = [0, 1, 2, 3, 4, 5, 6, 7];
  const cols = [4, 5, 6, 7, 8, 9, 10, 11];

  const visitedCount = OVERWORLD_GRID.filter((c) =>
    isCellVisited(c, visitedScreens, location)
  ).length;

  return (
    <div className="pointer-events-none absolute inset-0 z-15 select-none font-['Press_Start_2P',monospace]">
      {/* 8x8 Transparent Grid with Fog of War */}
      <div className="w-full h-full grid grid-cols-8 grid-rows-8 border border-emerald-500/25">
        {rows.map((r) =>
          cols.map((c) => {
            const isCurrent = c === location.col && r === location.row;
            const cell = OVERWORLD_GRID.find((g) => g.col === c && g.row === r);
            const visited = cell ? isCellVisited(cell, visitedScreens, location) : false;
            const isRevealed = !fogOfWarActive || visited || isCurrent;

            return (
              <div
                key={`vp_cell_${c}_${r}`}
                className={`relative flex flex-col justify-between p-0.5 transition-all ${
                  isCurrent
                    ? 'border-2 border-[#58f898] bg-[#58f898]/15 shadow-[0_0_12px_rgba(88,248,152,0.4)] animate-pulse'
                    : isRevealed
                    ? 'border border-emerald-400/20 bg-emerald-950/10'
                    : 'border border-gray-900/60 bg-black/75 backdrop-blur-[1px]'
                }`}
              >
                {/* Coordinate label in cell */}
                <span
                  className={`text-[5px] font-mono leading-none ${
                    isCurrent
                      ? 'text-[#58f898] font-bold'
                      : isRevealed
                      ? 'text-emerald-400/40'
                      : 'text-gray-700/40'
                  }`}
                >
                  {isRevealed ? `${c},${r}` : '?'}
                </span>

                {/* Target Reticle Indicator for current coordinate */}
                {isCurrent && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-2.5 h-2.5 border border-[#58f898] rounded-full animate-ping opacity-60 absolute" />
                    <div className="w-1.5 h-1.5 bg-[#58f898] rounded-full shadow-[0_0_6px_#58f898]" />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Floating HUD status badge in top-right of overlay */}
      <div className="absolute top-1 right-1 bg-black/80 border border-[#58f898]/60 px-1.5 py-0.5 rounded text-[6px] text-[#58f898] flex items-center gap-1.5 shadow-lg">
        <span className="w-1.5 h-1.5 bg-[#58f898] rounded-full animate-ping" />
        <span>8x8 OVERWORLD: [{location.coordString}]</span>
        <span className="text-gray-400">|</span>
        <span className="text-gray-300">EXPLORED: {visitedCount}/64</span>
      </div>
    </div>
  );
};
