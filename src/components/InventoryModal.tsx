/**
 * The Legend of Zelda NES - Subscreen / Inventory Pause Menu
 */

import React, { useState } from 'react';
import { PlayerState, ItemType } from '../types';
import { chiptune } from '../audio/chiptune';
import { ControlsConfig } from '../game/controlsConfig';
import { ControlsSettings } from './ControlsSettings';
import { Save, Volume2, VolumeX, Play, RotateCcw, Backpack, Settings } from 'lucide-react';

interface InventoryModalProps {
  player: PlayerState;
  controlsConfig: ControlsConfig;
  onUpdateControlsConfig: (newConfig: ControlsConfig) => void;
  gamepadName: string | null;
  onSelectBItem: (item: ItemType) => void;
  onResume: () => void;
  onSave: () => void;
  onQuit: () => void;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  player,
  controlsConfig,
  onUpdateControlsConfig,
  gamepadName,
  onSelectBItem,
  onResume,
  onSave,
  onQuit,
}) => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'settings'>('inventory');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const isMuted = chiptune.getMuted();

  const selectableItems = [
    {
      type: player.inventory.hasMagicalBoomerang ? ItemType.BOOMERANG_MAGICAL : ItemType.BOOMERANG,
      name: player.inventory.hasMagicalBoomerang ? 'MAGIC BOOMERANG' : 'BOOMERANG',
      icon: '🪃',
      unlocked: player.inventory.hasBoomerang || player.inventory.hasMagicalBoomerang,
    },
    {
      type: ItemType.BOMB,
      name: 'BOMBS',
      icon: '💣',
      count: player.inventory.bombs,
      unlocked: player.inventory.bombs > 0,
    },
    {
      type: ItemType.BOW,
      name: 'BOW & ARROW',
      icon: '🏹',
      unlocked: player.inventory.hasBow,
    },
    {
      type: player.inventory.hasRedCandle ? ItemType.CANDLE_RED : ItemType.CANDLE_BLUE,
      name: player.inventory.hasRedCandle ? 'RED CANDLE' : 'BLUE CANDLE',
      icon: '🕯',
      unlocked: player.inventory.hasCandle || player.inventory.hasBlueCandle || player.inventory.hasRedCandle,
    },
    {
      type: player.inventory.potionTier === 2 ? ItemType.POTION_RED : ItemType.POTION_BLUE,
      name: player.inventory.potionTier === 2 ? 'RED POTION (2x)' : 'BLUE POTION',
      icon: '🧪',
      unlocked: player.inventory.potionTier > 0,
    },
    {
      type: ItemType.RECORDER,
      name: 'RECORDER',
      icon: '🎶',
      unlocked: player.inventory.hasRecorder,
    },
    {
      type: ItemType.MAGICAL_ROD,
      name: 'MAGICAL ROD',
      icon: '🪄',
      unlocked: player.inventory.hasMagicalRod,
    },
    {
      type: ItemType.FOOD,
      name: 'BAIT / FOOD',
      icon: '🍖',
      unlocked: player.inventory.hasFood,
    },
  ];

  const handleItemClick = (type: ItemType) => {
    chiptune.playKey();
    onSelectBItem(type);
  };

  const handleSaveClick = () => {
    chiptune.playSecret();
    onSave();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div
      id="inventory-modal"
      className="absolute inset-0 bg-black/95 z-40 flex flex-col justify-between p-3 sm:p-4 text-white font-['Press_Start_2P',monospace] select-none"
    >
      {/* Header with Subscreen Tabs */}
      <div className="border-b-2 border-white pb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              chiptune.playKey();
              setActiveTab('inventory');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[8px] sm:text-[9px] border cursor-pointer transition-all ${
              activeTab === 'inventory'
                ? 'border-[#f8b800] bg-[#3a2800] text-[#f8b800] font-bold shadow-[0_0_8px_#f8b800]'
                : 'border-gray-700 bg-[#141419] text-gray-400 hover:text-white'
            }`}
          >
            <Backpack size={12} />
            <span>INVENTORY</span>
          </button>

          <button
            onClick={() => {
              chiptune.playKey();
              setActiveTab('settings');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[8px] sm:text-[9px] border cursor-pointer transition-all ${
              activeTab === 'settings'
                ? 'border-[#58f898] bg-[#003816] text-[#58f898] font-bold shadow-[0_0_8px_#58f898]'
                : 'border-gray-700 bg-[#141419] text-gray-400 hover:text-white'
            }`}
          >
            <Settings size={12} />
            <span>SETTINGS & CONTROLS</span>
            {controlsConfig.showHitboxDebug && (
              <span className="px-1 py-0.2 bg-[#ff3864] text-white text-[6px] font-bold rounded">
                DBG
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              chiptune.toggleMute();
            }}
            className="flex items-center gap-1 text-[8px] sm:text-[9px] border border-gray-600 px-2 py-1 bg-[#1a1a1a] hover:bg-[#333]"
          >
            {isMuted ? <VolumeX size={12} className="text-red-400" /> : <Volume2 size={12} className="text-green-400" />}
            <span>{isMuted ? 'UNMUTE' : 'MUTE'}</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Classic Inventory Subscreen */}
      {activeTab === 'inventory' && (
        <div className="flex-1 py-3 flex flex-col gap-4 overflow-y-auto">
          {/* Selectable B-Items */}
          <div>
            <div className="text-[9px] text-[#58f898] mb-2 uppercase tracking-wider">
              SELECT [B] WEAPON:
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {selectableItems.map((item) => (
                <button
                  key={item.type}
                  disabled={!item.unlocked}
                  onClick={() => handleItemClick(item.type)}
                  className={`p-2 border-2 flex flex-col items-center justify-center transition-all cursor-pointer ${
                    player.bItem === item.type
                      ? 'border-[#f83800] bg-[#3a0a0a] scale-105 shadow-[0_0_10px_#f83800]'
                      : item.unlocked
                      ? 'border-gray-700 bg-[#111] hover:border-white'
                      : 'border-[#222] bg-[#0a0a0a] opacity-30 cursor-not-allowed'
                  }`}
                >
                  <div className="text-2xl mb-1">{item.icon}</div>
                  <div className="text-[7px] text-center">{item.name}</div>
                  {item.count !== undefined && (
                    <div className="text-[8px] text-[#3cbcfc] mt-0.5">X{item.count}</div>
                  )}
                  {player.bItem === item.type && (
                    <div className="text-[7px] text-[#f83800] mt-1 font-bold">EQUIPPED</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Passive Quest Items */}
          <div>
            <div className="text-[9px] text-[#3cbcfc] mb-2 uppercase tracking-wider">
              TREASURES & RELICS:
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[8px]">
              <div className={`p-2 border ${player.swordTier > 0 ? 'border-white bg-[#1a1a1a]' : 'border-gray-800 opacity-30'}`}>
                <div className="text-xl mb-1">🗡</div>
                <span>{player.swordTier === 0 ? 'NO SWORD' : player.swordTier === 1 ? 'WOOD SWORD' : 'WHITE SWORD'}</span>
              </div>

              <div className={`p-2 border ${
                player.inventory.hasMagicalShield || player.hasMagicalShield
                  ? 'border-blue-400 bg-[#001830]'
                  : player.hasShield === false || player.inventory.hasShield === false || player.shieldTier === 0
                  ? 'border-red-900 bg-[#1a0505] opacity-40'
                  : 'border-amber-600 bg-[#251500]'
              }`}>
                <div className="text-xl mb-1">🛡</div>
                <span>
                  {player.inventory.hasMagicalShield || player.hasMagicalShield
                    ? 'MAGIC SHIELD'
                    : player.hasShield === false || player.inventory.hasShield === false || player.shieldTier === 0
                    ? 'NO SHIELD'
                    : 'WOOD SHIELD'}
                </span>
              </div>

              <div className={`p-2 border ${player.inventory.hasPowerBracelet ? 'border-yellow-400 bg-[#302000]' : 'border-gray-800 opacity-30'}`}>
                <div className="text-xl mb-1">💍</div>
                <span>BRACELET</span>
              </div>

              <div className={`p-2 border ${player.inventory.hasSteppingLadder ? 'border-amber-600 bg-[#251500]' : 'border-gray-800 opacity-30'}`}>
                <div className="text-xl mb-1">🪜</div>
                <span>LADDER</span>
              </div>

              <div className={`p-2 border ${player.inventory.hasCompass ? 'border-white bg-[#1a1a1a]' : 'border-gray-800 opacity-30'}`}>
                <div className="text-xl mb-1">🧭</div>
                <span>COMPASS</span>
              </div>

              <div className={`p-2 border ${player.inventory.hasDungeonMap ? 'border-white bg-[#1a1a1a]' : 'border-gray-800 opacity-30'}`}>
                <div className="text-xl mb-1">🗺</div>
                <span>MAP</span>
              </div>

              <div className={`p-2 border ${player.inventory.triforcePieces > 0 ? 'border-[#f8b800] bg-[#302500]' : 'border-gray-800 opacity-30'}`}>
                <div className="text-xl mb-1 text-[#f8b800]">▲</div>
                <span className="text-[#f8b800]">TRIFORCE ({player.inventory.triforcePieces}/8)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Settings & Remapping Subscreen */}
      {activeTab === 'settings' && (
        <ControlsSettings
          config={controlsConfig}
          onChangeConfig={onUpdateControlsConfig}
          gamepadName={gamepadName}
        />
      )}

      {/* Bottom Actions */}
      <div className="border-t-2 border-white pt-3 flex flex-wrap items-center justify-between gap-2">
        {activeTab === 'inventory' ? (
          <button
            id="btn-save-progress"
            onClick={handleSaveClick}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#008088] hover:bg-[#00e8d8] text-white hover:text-black text-[8px] sm:text-[9px] border border-white cursor-pointer transition-all"
          >
            <Save size={14} />
            <span>{saveSuccess ? 'SAVED TO CART!' : 'SAVE PROGRESS'}</span>
          </button>
        ) : (
          <div className="text-[7px] text-gray-400">
            AUTO-SAVED TO BROWSER STORAGE
          </div>
        )}

        <div className="flex gap-2">
          <button
            id="btn-quit-to-menu"
            onClick={onQuit}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#2b2b2b] hover:bg-[#444] text-white text-[8px] sm:text-[9px] border border-gray-500 cursor-pointer"
          >
            <RotateCcw size={12} />
            <span>FILE SELECT</span>
          </button>

          <button
            id="btn-resume-game"
            onClick={onResume}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#d82800] hover:bg-[#f83800] text-white text-[8px] sm:text-[9px] border border-white cursor-pointer shadow-[2px_2px_0_#000]"
          >
            <Play size={12} />
            <span>RESUME</span>
          </button>
        </div>
      </div>
    </div>
  );
};
