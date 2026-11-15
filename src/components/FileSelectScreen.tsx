/**
 * The Legend of Zelda NES - Classic File Select & Registration Screen
 */

import React, { useState } from 'react';
import { SaveSlotData } from '../types';
import { loadAllSaveSlots, saveSlotData, clearSaveSlot } from '../game/saveSystem';
import { chiptune } from '../audio/chiptune';
import { Trash2, Plus, Skull } from 'lucide-react';

interface FileSelectScreenProps {
  onSelectSlot: (slot: SaveSlotData) => void;
  onBackToTitle?: () => void;
}

export const FileSelectScreen: React.FC<FileSelectScreenProps> = ({ onSelectSlot, onBackToTitle }) => {
  const [slots, setSlots] = useState<SaveSlotData[]>(() => loadAllSaveSlots());
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(0);
  const [isEliminationMode, setIsEliminationMode] = useState(false);
  const [registeringSlotId, setRegisteringSlotId] = useState<number | null>(null);
  const [registerName, setRegisterName] = useState('LINK');

  const handleStartSlot = (slot: SaveSlotData) => {
    if (slot.timestamp === 0) {
      // Empty slot -> prompt name registration
      setRegisteringSlotId(slot.id);
      setRegisterName('LINK');
      chiptune.playKey();
      return;
    }

    if (isEliminationMode) {
      // Delete confirmation
      chiptune.playEnemyDie();
      clearSaveSlot(slot.id);
      setSlots(loadAllSaveSlots());
      return;
    }

    chiptune.playSecret();
    onSelectSlot(slot);
  };

  const handleConfirmRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!registeringSlotId) return;

    const slot = slots.find((s) => s.id === registeringSlotId);
    if (!slot) return;

    const newSlot: SaveSlotData = {
      ...slot,
      name: registerName.trim().toUpperCase() || 'LINK',
      timestamp: Date.now(),
    };

    saveSlotData(newSlot);
    setSlots(loadAllSaveSlots());
    setRegisteringSlotId(null);
    chiptune.playItemFanfare();
    onSelectSlot(newSlot);
  };

  return (
    <div
      id="nes-file-select"
      className="w-full max-w-xl mx-auto bg-black text-white p-6 border-4 border-[#c84c0c] rounded-md shadow-2xl font-['Press_Start_2P',monospace] select-none"
    >
      {/* Title Header */}
      <div className="text-center mb-6">
        <div className="flex justify-center items-center gap-3 mb-2">
          <span className="text-[#f8b800] text-lg">▲</span>
          <h1 className="text-sm sm:text-base text-[#f8b800] tracking-wider uppercase font-bold">
            THE LEGEND OF ZELDA
          </h1>
          <span className="text-[#f8b800] text-lg">▲</span>
        </div>
        <div className="text-[10px] text-gray-400 uppercase tracking-widest">
          {isEliminationMode ? '※ ELIMINATION MODE ※' : '- SELECT A QUEST -'}
        </div>
      </div>

      {/* Registration Modal overlay if registering name */}
      {registeringSlotId !== null ? (
        <form onSubmit={handleConfirmRegistration} className="bg-[#1a1a1a] p-5 border-2 border-white mb-6">
          <div className="text-xs text-[#58f898] mb-3 uppercase">REGISTER YOUR NAME:</div>
          <input
            type="text"
            maxLength={8}
            value={registerName}
            onChange={(e) => setRegisterName(e.target.value.toUpperCase())}
            autoFocus
            className="w-full bg-black border-2 border-[#58f898] text-[#58f898] text-center text-sm py-2 px-3 tracking-widest font-['Press_Start_2P',monospace] uppercase mb-4 focus:outline-none"
          />
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setRegisteringSlotId(null)}
              className="px-3 py-1.5 border border-gray-500 text-[9px] hover:bg-gray-800"
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 border-2 border-white bg-[#d82800] text-white text-[9px] hover:bg-[#f83800]"
            >
              START QUEST
            </button>
          </div>
        </form>
      ) : (
        /* Save Slots List */
        <div className="flex flex-col gap-4 mb-6">
          {slots.map((slot, index) => {
            const isEmpty = slot.timestamp === 0;
            const isSelected = selectedSlotIndex === index;

            return (
              <div
                key={slot.id}
                onClick={() => {
                  setSelectedSlotIndex(index);
                  handleStartSlot(slot);
                }}
                onMouseEnter={() => setSelectedSlotIndex(index)}
                className={`p-3 border-2 transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? isEliminationMode
                      ? 'border-[#d82800] bg-[#2a0000]'
                      : 'border-[#f8b800] bg-[#1a1800] shadow-[0_0_8px_#f8b800]'
                    : 'border-gray-700 bg-[#0d0d0d] hover:border-gray-500'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Heart / Sword selector cursor */}
                  <span className={`text-xs ${isSelected ? 'text-[#d82800] animate-bounce' : 'opacity-0'}`}>
                    ♥
                  </span>

                  <div>
                    <div className="text-xs text-white tracking-widest font-bold">
                      {slot.id}. {slot.name}
                    </div>
                    {!isEmpty && (
                      <div className="text-[8px] text-gray-400 mt-1 flex gap-3">
                        <span className="text-[#f8b800]">▲ {slot.triforcePieces}/3</span>
                        <span className="text-[#58f898]">◆ {slot.rupees}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {isEmpty ? (
                    <div className="flex items-center gap-1 text-[8px] text-gray-500 border border-gray-800 px-2 py-1">
                      <Plus size={10} />
                      <span>NEW QUEST</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5">
                      {/* Per-Save-Slot Death Counter */}
                      <div
                        id={`death-counter-slot-${slot.id}`}
                        data-testid={`death-counter-slot-${slot.id}`}
                        title={`Deaths recorded in ${slot.name}'s save file`}
                        className={`flex items-center gap-1.5 px-2 py-1 border text-[8px] ${
                          (slot.deaths ?? 0) > 0
                            ? 'border-[#d82800]/80 bg-[#260808] text-[#ff6b57]'
                            : 'border-gray-700 bg-[#121218] text-gray-300'
                        }`}
                      >
                        <Skull
                          size={11}
                          className={(slot.deaths ?? 0) > 0 ? 'text-[#d82800]' : 'text-gray-400'}
                        />
                        <span className="tracking-wider">
                          DEATHS:{String(slot.deaths ?? 0).padStart(2, '0')}
                        </span>
                      </div>

                      <div className="flex flex-col items-end">
                        <div className="flex gap-1">
                          {Array.from({ length: Math.floor(slot.maxHearts / 2) }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-2.5 h-2.5 ${
                                i < Math.floor(slot.hearts / 2) ? 'bg-[#d82800]' : 'bg-gray-800'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-[7px] text-gray-500 mt-1">
                          {slot.currentScreen.startsWith('D') ? 'IN DUNGEON' : 'OVERWORLD'}
                        </span>
                      </div>
                    </div>
                  )}

                  {isEliminationMode && !isEmpty && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        chiptune.playEnemyDie();
                        clearSaveSlot(slot.id);
                        setSlots(loadAllSaveSlots());
                      }}
                      className="p-1 text-red-500 hover:text-white hover:bg-red-700 border border-red-700"
                      title="Erase Save"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-700">
        <div className="flex items-center gap-2">
          {onBackToTitle && (
            <button
              onClick={() => {
                chiptune.playKey();
                onBackToTitle();
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-[9px] border border-[#f8b800] text-[#f8b800] hover:bg-[#f8b800] hover:text-black transition-colors cursor-pointer"
            >
              <span>◄ TITLE SCREEN</span>
            </button>
          )}

          <button
            onClick={() => {
              chiptune.playKey();
              setIsEliminationMode(!isEliminationMode);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[9px] border transition-colors cursor-pointer ${
              isEliminationMode
                ? 'bg-[#d82800] border-white text-white'
                : 'border-gray-600 text-gray-400 hover:text-white'
            }`}
          >
            <Trash2 size={12} />
            <span>{isEliminationMode ? 'CANCEL DELETE' : 'ELIMINATION MODE'}</span>
          </button>
        </div>

        <div className="text-[8px] text-gray-500 tracking-wider">
          BATTERY RAM BACKUP
        </div>
      </div>
    </div>
  );
};
