/**
 * The Legend of Zelda NES - Authentic Top HUD
 */

import React from 'react';
import { PlayerState, ScreenData, ItemType } from '../types';
import { OverworldMinimap } from './OverworldMinimap';
import { AnimatedHearts } from './AnimatedHearts';
import { Map } from 'lucide-react';

interface HUDProps {
  player: PlayerState;
  currentScreen: ScreenData;
  showGridOverlay?: boolean;
  onToggleGridOverlay?: () => void;
  visitedScreens?: string[];
}

export const HUD: React.FC<HUDProps> = ({
  player,
  currentScreen,
  showGridOverlay = false,
  onToggleGridOverlay,
  visitedScreens,
}) => {
  return (
    <div
      id="nes-hud-bar"
      className="w-full bg-black text-white px-3 py-2 border-b-2 border-[#202020] select-none flex items-center justify-between text-[9px] font-['Press_Start_2P',monospace] leading-tight gap-1.5"
    >
      {/* Left: 16x8 Transparent Overworld Minimap Sub-Component with Fog-of-War */}
      <OverworldMinimap
        currentScreen={currentScreen}
        showOverlay={showGridOverlay}
        onToggleOverlay={onToggleGridOverlay}
        visitedScreens={visitedScreens}
      />

      {/* Counters: Rupees, Keys, Bombs */}
      <div className="flex flex-col gap-1 text-[9px]">
        <div className="flex items-center gap-1 text-[#58f898]">
          <span className="w-2.5 text-center font-bold">◆</span>
          <span>X{player.inventory.rupees.toString().padStart(2, '0')}</span>
        </div>
        <div className="flex items-center gap-1 text-[#f8b800]">
          <span className="w-2.5 text-center font-bold">🗝</span>
          <span>X{player.inventory.keys.toString().padStart(2, '0')}</span>
        </div>
        <div className="flex items-center gap-1 text-[#3cbcfc]">
          <span className="w-2.5 text-center font-bold">💣</span>
          <span>X{player.inventory.bombs.toString().padStart(2, '0')}</span>
        </div>
      </div>

      {/* Equipped Weapon Slots: B and A + Mini-Map Overlay Button */}
      <div className="flex items-center gap-2">
        {/* B Item Slot */}
        <div className="flex flex-col items-center">
          <span className="text-gray-400 text-[8px] mb-0.5">B</span>
          <div className="w-7 h-9 border-2 border-white bg-black flex flex-col items-center justify-center p-0.5">
            {player.bItem === ItemType.BOOMERANG && <span className="text-[#f8b800] text-[8px]">🪃</span>}
            {player.bItem === ItemType.BOMB && <span className="text-[#3cbcfc] text-[8px]">💣</span>}
            {player.bItem === ItemType.BOW && <span className="text-[#f8b800] text-[8px]">🏹</span>}
            {player.bItem === ItemType.CANDLE_BLUE && <span className="text-[#3cbcfc] text-[8px]">🕯</span>}
            {player.bItem === ItemType.NONE && <span className="text-gray-600 text-[6px]">-</span>}
          </div>
        </div>

        {/* A Item Slot (Sword) */}
        <div className="flex flex-col items-center">
          <span className="text-gray-400 text-[8px] mb-0.5">A</span>
          <div className="w-7 h-9 border-2 border-white bg-black flex flex-col items-center justify-center p-0.5">
            {player.swordTier > 0 ? (
              <span className="text-white text-[9px]">🗡</span>
            ) : (
              <span className="text-gray-600 text-[6px]">-</span>
            )}
          </div>
        </div>

        {/* Persistent 16x8 Mini-Map Overlay Toggle Button */}
        {onToggleGridOverlay && (
          <div className="flex flex-col items-center">
            <span className="text-gray-400 text-[7px] mb-0.5">MAP</span>
            <button
              id="hud-minimap-toggle-btn"
              type="button"
              onClick={onToggleGridOverlay}
              aria-pressed={showGridOverlay}
              title={
                showGridOverlay
                  ? 'Hide Persistent 16x8 Mini-Map Overlay (G / M)'
                  : 'Show Persistent 16x8 Mini-Map Overlay (G / M)'
              }
              className={`w-8 h-9 border-2 flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors ${
                showGridOverlay
                  ? 'border-[#58f898] bg-[#153528] text-[#58f898] shadow-[0_0_8px_rgba(88,248,152,0.5)]'
                  : 'border-gray-500 bg-black text-gray-300 hover:border-white hover:text-white'
              }`}
            >
              <Map size={11} />
              <span className="text-[5px] leading-none">16x8</span>
            </button>
          </div>
        )}
      </div>

      {/* Right: Animated —LIFE— Hearts */}
      <AnimatedHearts
        currentHearts={player.hearts}
        maxHearts={player.maxHearts}
      />
    </div>
  );
};
