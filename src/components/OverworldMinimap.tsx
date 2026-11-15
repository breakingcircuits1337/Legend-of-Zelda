/**
 * The Legend of Zelda NES - Overworld 16x8 Mini-Map HUD & Persistent Overlay Component
 * Renders an authentic 16x8 topological grid of Hyrule (16 cols x 8 rows = 128 screens),
 * highlighting Link's current location and previously visited screens.
 */

import React, { useState } from 'react';
import { ScreenData } from '../types';
import { MapPin, Compass, X, Grid, Eye, CloudFog } from 'lucide-react';
import {
  DUNGEON_MAP_LAYOUTS,
  DungeonLevelMapLayout,
  isDungeonRoomDiscovered,
} from '../game/secretWallDetector';
import {
  OVERWORLD_GRID,
  OVERWORLD_COLS,
  OVERWORLD_ROWS,
  GridCellInfo,
  isCellVisited,
  getPlayerOverworldLocation,
} from '../game/overworldMapData';

export {
  OVERWORLD_GRID,
  OVERWORLD_COLS,
  OVERWORLD_ROWS,
  isCellVisited,
  getPlayerOverworldLocation,
};
export type { GridCellInfo };

export interface OverworldMinimapProps {
  currentScreen: ScreenData;
  className?: string;
  showOverlay?: boolean;
  onToggleOverlay?: () => void;
  visitedScreens?: string[];
}

/**
 * Transparent 16x8 Grid Minimap HUD Sub-Component with Fog-of-War
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

          {/* Quick HUD Toggle for Persistent 16x8 Overworld Mini-Map Overlay */}
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
              title={showOverlay ? 'Hide Persistent 16x8 Mini-Map Overlay (G)' : 'Show Persistent 16x8 Mini-Map Overlay (G)'}
            >
              {showOverlay ? <Eye size={8} /> : <Grid size={8} />}
              <span className="hidden sm:inline">16x8</span>
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
            className="relative bg-black/60 border border-white/20 p-[1px] grid gap-[1px] rounded-sm shadow-inner cursor-pointer group-hover:border-white transition-colors"
            style={{
              width: '74px',
              height: '38px',
              gridTemplateColumns: `repeat(${OVERWORLD_COLS}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${OVERWORLD_ROWS}, minmax(0, 1fr))`,
            }}
            title={`Click to expand full 16x8 Hyrule Map (Visited: ${visitedCount}/${OVERWORLD_GRID.length})`}
          >
            {OVERWORLD_GRID.map((cell) => {
              const isPlayerHere = cell.col === location.col && cell.row === location.row;
              const visited = isCellVisited(cell, visitedScreens, location);
              const isRevealed = !fogOfWarActive || visited || isPlayerHere;

              return (
                <div
                  key={`grid_${cell.col}_${cell.row}`}
                  className={`w-full h-full relative rounded-[0.5px] transition-all flex items-center justify-center ${
                    isRevealed
                      ? getRevealedCellColor(cell, isPlayerHere)
                      : 'bg-[#08080f]/90'
                  }`}
                  title={
                    isRevealed
                      ? `[${cell.col},${cell.row}] ${cell.name}${isPlayerHere ? ' (YOU ARE HERE)' : ''}`
                      : `[${cell.col},${cell.row}] Unexplored (Fog of War)`
                  }
                >
                  {isPlayerHere && (
                    <div className="w-1 h-1 bg-white rounded-full z-10 animate-nes-blink" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Short location name hint & exploration stats */}
        <div
          onClick={() => setShowFullMapModal(true)}
          className="text-[6px] text-gray-300 mt-1 tracking-tighter truncate max-w-[74px] cursor-pointer hover:text-white flex items-center justify-between w-full"
          title={
            location.isDungeon && dungeonLayout
              ? `${location.areaName} (${dungeonDiscoveredCount}/${dungeonLayout.rooms.length} rooms)`
              : `${location.areaName} [${location.coordString}] (Visited: ${visitedCount}/${OVERWORLD_GRID.length})`
          }
        >
          <span className="truncate">{location.areaName.slice(0, 7)}</span>
          <span className="text-[#58f898] text-[5px] font-mono">
            {location.isDungeon && dungeonLayout
              ? `${dungeonDiscoveredCount}/${dungeonLayout.rooms.length}`
              : `${visitedCount}/${OVERWORLD_GRID.length}`}
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
                      : '16x8 TOPOLOGICAL GRID SYSTEM'}
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
                  : `${visitedCount}/${OVERWORLD_GRID.length} (${Math.round((visitedCount / OVERWORLD_GRID.length) * 100)}%)`}
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
                {/* Column Indices (Cols 0 to 15) */}
                <div
                  className="grid gap-0.5 w-full mb-1 text-center"
                  style={{ gridTemplateColumns: `repeat(${OVERWORLD_COLS}, minmax(0, 1fr))` }}
                >
                  {Array.from({ length: OVERWORLD_COLS }, (_, c) => (
                    <span key={`col_idx_${c}`} className="text-[5px] text-gray-400 font-mono">
                      {c}
                    </span>
                  ))}
                </div>

                {/* 16x8 Grid Cells */}
                <div
                  className="grid gap-0.5 w-full"
                  style={{
                    gridTemplateColumns: `repeat(${OVERWORLD_COLS}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${OVERWORLD_ROWS}, minmax(0, 1fr))`,
                  }}
                >
                  {OVERWORLD_GRID.map((cell) => {
                    const isPlayerHere = cell.col === location.col && cell.row === location.row;
                    const visited = isCellVisited(cell, visitedScreens, location);
                    const isRevealed = !fogOfWarActive || visited || isPlayerHere;

                    return (
                      <div
                        key={`modal_grid_${cell.col}_${cell.row}`}
                        className={`h-7 relative rounded-[2px] border flex flex-col items-center justify-between p-0.5 transition-transform ${
                          isPlayerHere
                            ? 'border-white bg-[#58f898]/40 ring-2 ring-[#58f898] scale-110 z-10'
                            : isRevealed
                            ? visited
                              ? 'border-[#38bdf8] ' + getRevealedCellColor(cell, false)
                              : 'border-gray-800 bg-[#121218]/60 opacity-60'
                            : 'border-gray-900 bg-[#090912] opacity-75'
                        }`}
                        title={
                          isRevealed
                            ? `[Col: ${cell.col}, Row: ${cell.row}] ${cell.name}${
                                isPlayerHere ? ' (YOU ARE HERE)' : visited ? ' (VISITED)' : ''
                              }`
                            : `[Col: ${cell.col}, Row: ${cell.row}] Unvisited (Fog of War)`
                        }
                      >
                        <span className="text-[4px] text-gray-400 font-mono leading-none">
                          {cell.col},{cell.row}
                        </span>

                        {isRevealed ? (
                          <>
                            {cell.hasDungeon && (
                              <span className="text-[6px] leading-none" title="Dungeon Entrance">
                                🏰
                              </span>
                            )}
                            {cell.hasCave && !cell.hasDungeon && (
                              <span className="text-[5px] leading-none" title="Secret Cave / Shop">
                                ⚔️
                              </span>
                            )}
                            {isPlayerHere && (
                              <div className="w-1.5 h-1.5 bg-[#58f898] rounded-full ring-1 ring-white animate-ping" />
                            )}
                            <span className="text-[4px] text-gray-200 tracking-tighter truncate w-full text-center font-bold leading-none">
                              {cell.shortLabel}
                            </span>
                          </>
                        ) : (
                          <div className="flex-1 flex items-center justify-center opacity-40">
                            <span className="text-[5px] text-gray-500 font-mono">?</span>
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
 * Persistent 16x8 Overworld Mini-Map Overlay rendered cleanly over the game viewport.
 * Highlights the player's current location and all previously visited screens.
 */
export const OverworldViewportGridOverlay: React.FC<{
  currentScreen: ScreenData;
  visitedScreens?: string[];
  fogOfWarActive?: boolean;
}> = ({ currentScreen, visitedScreens = ['O7_7', '7,7'], fogOfWarActive = true }) => {
  const location = getPlayerOverworldLocation(currentScreen);

  const visitedCount = OVERWORLD_GRID.filter((c) =>
    isCellVisited(c, visitedScreens, location)
  ).length;

  return (
    <div
      id="persistent-minimap-overlay"
      className="pointer-events-none absolute top-2 right-2 z-25 select-none font-['Press_Start_2P',monospace] bg-black/80 backdrop-blur-[2px] border-2 border-[#58f898]/80 rounded p-1.5 shadow-[0_0_16px_rgba(0,0,0,0.85)] flex flex-col gap-1"
    >
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2 text-[6px] leading-none">
        <div className="flex items-center gap-1 text-[#58f898]">
          <span className="w-1.5 h-1.5 bg-[#58f898] rounded-full animate-ping" />
          <span>16x8 MAP [{location.coordString}]</span>
        </div>
        <span className="text-cyan-300 font-mono">
          {visitedCount}/{OVERWORLD_GRID.length}
        </span>
      </div>

      {/* 16x8 Overworld Grid (16 Columns x 8 Rows) */}
      <div
        className="grid gap-[1px] bg-black/90 p-[2px] border border-white/25 rounded-[2px]"
        style={{
          width: '176px',
          height: '88px',
          gridTemplateColumns: `repeat(${OVERWORLD_COLS}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${OVERWORLD_ROWS}, minmax(0, 1fr))`,
        }}
      >
        {OVERWORLD_GRID.map((cell) => {
          const isCurrent = cell.col === location.col && cell.row === location.row;
          const visited = isCellVisited(cell, visitedScreens, location);
          const isRevealed = !fogOfWarActive || visited || isCurrent;

          let cellStyle = 'bg-[#0b0e17] border border-gray-800/70'; // Unvisited fog
          if (isCurrent) {
            cellStyle =
              'bg-[#58f898] border border-white ring-1 ring-white shadow-[0_0_6px_rgba(88,248,152,0.95)] z-10';
          } else if (visited) {
            cellStyle = cell.hasDungeon
              ? 'bg-[#d82800]/85 border border-amber-300/80'
              : cell.hasCave
              ? 'bg-[#0284c7]/80 border border-cyan-300/80'
              : 'bg-[#0ea5e9]/65 border border-cyan-300/60';
          } else if (!fogOfWarActive && cell.isPlayable) {
            cellStyle = 'bg-slate-700/60 border border-slate-500/40';
          }

          return (
            <div
              key={`vp_16x8_${cell.col}_${cell.row}`}
              data-visited={visited ? 'true' : 'false'}
              data-current={isCurrent ? 'true' : 'false'}
              className={`relative w-full h-full rounded-[1px] flex items-center justify-center transition-colors ${cellStyle}`}
            >
              {isCurrent && (
                <div className="w-1.5 h-1.5 bg-black rounded-full ring-1 ring-white animate-nes-blink" />
              )}
              {!isCurrent && isRevealed && visited && cell.hasDungeon && (
                <div className="w-1 h-1 bg-[#f8b800] rounded-full" />
              )}
            </div>
          );
        })}
      </div>

      {/* Compact Legend */}
      <div className="flex items-center justify-between text-[5px] text-gray-300 leading-none pt-0.5">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-[#58f898] inline-block rounded-[1px] border border-white" />
          YOU
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-[#0ea5e9] inline-block rounded-[1px] border border-cyan-300" />
          VISITED
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-[#0b0e17] inline-block rounded-[1px] border border-gray-700" />
          FOG
        </span>
      </div>
    </div>
  );
};
