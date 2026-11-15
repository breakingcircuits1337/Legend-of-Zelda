/**
 * The Legend of Zelda NES - Enemy Bestiary Panel
 * Displays discovered enemies with live pixel-art sprite previews, combat stats,
 * weaknesses, drops, and Hyrule lore descriptions. Undefeated enemies appear locked.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Direction, EnemyType, PlayerState } from '../types';
import {
  BESTIARY_ENTRIES,
  BestiaryCategory,
  BestiaryEntry,
  getBestiaryProgress,
} from '../game/bestiary';
import { drawEnemy } from '../game/sprites';
import { chiptune } from '../audio/chiptune';
import { ChevronLeft, ChevronRight, Lock, Skull, ShieldAlert, Sparkles } from 'lucide-react';

interface BestiarySpritePreviewProps {
  enemyType: EnemyType;
  unlocked: boolean;
  size?: number;
}

const BestiarySpritePreview: React.FC<BestiarySpritePreviewProps> = ({
  enemyType,
  unlocked,
  size = 56,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [animFrame, setAnimFrame] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setAnimFrame((prev) => (prev + 1) % 2);
    }, 360);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!unlocked) {
      return;
    }

    const spriteSize =
      enemyType === EnemyType.AQUAMENTUS
        ? { w: 32, h: 32, ox: 0, oy: 0 }
        : enemyType === EnemyType.DODONGO
        ? { w: 32, h: 20, ox: 0, oy: 2 }
        : enemyType === EnemyType.MANHANDLA
        ? { w: 28, h: 28, ox: 6, oy: 6 }
        : { w: 16, h: 16, ox: 0, oy: 0 };

    // Render onto an offscreen pixel buffer at native NES scale, then draw crisply centered
    const offscreen = document.createElement('canvas');
    offscreen.width = spriteSize.w;
    offscreen.height = spriteSize.h;
    const octx = offscreen.getContext('2d');
    if (!octx) return;
    octx.imageSmoothingEnabled = false;

    const previewDir =
      enemyType === EnemyType.DODONGO || enemyType === EnemyType.DARKNUT_RED || enemyType === EnemyType.DARKNUT_BLUE
        ? Direction.LEFT
        : Direction.DOWN;

    drawEnemy(octx, {
      type: enemyType,
      x: spriteSize.ox,
      y: spriteSize.oy,
      dir: previewDir,
      animFrame,
      isHurt: false,
      isStunned: false,
      customData: {
        isAwakened: true,
        isFlying: true,
        isBurrowing: false,
        jaws: { up: true, down: true, left: true, right: true },
      },
    } as any);

    const pad = Math.max(4, Math.floor(size * 0.12));
    const maxDraw = size - pad * 2;
    const scale = Math.max(1, Math.floor(Math.min(maxDraw / spriteSize.w, maxDraw / spriteSize.h)));
    const drawW = spriteSize.w * scale;
    const drawH = spriteSize.h * scale;
    const dx = Math.floor((size - drawW) / 2);
    const dy = Math.floor((size - drawH) / 2);

    ctx.drawImage(offscreen, 0, 0, spriteSize.w, spriteSize.h, dx, dy, drawW, drawH);
  }, [enemyType, unlocked, animFrame, size]);

  if (!unlocked) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center bg-[#09090d] border border-[#242430] text-gray-600 shrink-0"
      >
        <Lock size={size <= 28 ? 11 : 20} />
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ width: size, height: size, imageRendering: 'pixelated' }}
      className="bg-[#0c1018] border border-[#2f3b52] shrink-0"
    />
  );
};

interface BestiaryPanelProps {
  player: PlayerState;
}

type CategoryFilter = 'ALL' | BestiaryCategory;

const CATEGORY_COLORS: Record<BestiaryCategory, string> = {
  Overworld: 'text-[#58f898] border-[#267347] bg-[#082414]',
  Dungeon: 'text-[#3cbcfc] border-[#1f628a] bg-[#071f2e]',
  Boss: 'text-[#f8b800] border-[#8a6500] bg-[#2a1d00]',
};

export const BestiaryPanel: React.FC<BestiaryPanelProps> = ({ player }) => {
  const unlockedSet = useMemo(
    () => new Set<EnemyType>(player.unlockedBestiary || []),
    [player.unlockedBestiary]
  );

  const defeatCounts = player.bestiaryDefeatCounts || {};
  const progress = useMemo(
    () => getBestiaryProgress(player.unlockedBestiary),
    [player.unlockedBestiary]
  );

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');

  const filteredEntries = useMemo(() => {
    if (categoryFilter === 'ALL') return BESTIARY_ENTRIES;
    return BESTIARY_ENTRIES.filter((entry) => entry.category === categoryFilter);
  }, [categoryFilter]);

  const initialSelected = useMemo(() => {
    const firstUnlocked = BESTIARY_ENTRIES.find((entry) => unlockedSet.has(entry.type));
    return (firstUnlocked || BESTIARY_ENTRIES[0]).type;
  }, [unlockedSet]);

  const [selectedType, setSelectedType] = useState<EnemyType>(initialSelected);

  const selectedEntry: BestiaryEntry = useMemo(() => {
    return (
      filteredEntries.find((entry) => entry.type === selectedType) ||
      BESTIARY_ENTRIES.find((entry) => entry.type === selectedType) ||
      filteredEntries[0] ||
      BESTIARY_ENTRIES[0]
    );
  }, [filteredEntries, selectedType]);

  const selectedIndexInFiltered = Math.max(
    0,
    filteredEntries.findIndex((entry) => entry.type === selectedEntry.type)
  );
  const isSelectedUnlocked = unlockedSet.has(selectedEntry.type);
  const slainCount = defeatCounts[selectedEntry.type] || 0;

  const handleSelectEntry = (entryType: EnemyType) => {
    chiptune.playKey();
    setSelectedType(entryType);
  };

  const handleStepPage = (delta: number) => {
    if (filteredEntries.length === 0) return;
    chiptune.playKey();
    const nextIdx =
      (selectedIndexInFiltered + delta + filteredEntries.length) % filteredEntries.length;
    setSelectedType(filteredEntries[nextIdx].type);
  };

  const formatPageNumber = (num: number) => String(num).padStart(2, '0');

  return (
    <div id="bestiary-panel" className="flex-1 py-2.5 flex flex-col gap-2.5 min-h-0 overflow-hidden">
      {/* Top Compendium Progress & Category Filter */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-[8px] sm:text-[9px] text-[#f8b800] tracking-wider font-bold">
            MONSTER COMPENDIUM
          </span>
          <span
            id="bestiary-progress-badge"
            className="px-1.5 py-0.5 text-[7px] border border-[#f8b800]/60 bg-[#261b00] text-[#f8b800]"
          >
            {progress.discovered}/{progress.total} DISCOVERED
          </span>
        </div>

        <div className="flex items-center gap-1">
          {(['ALL', 'Overworld', 'Dungeon', 'Boss'] as CategoryFilter[]).map((cat) => {
            const active = categoryFilter === cat;
            return (
              <button
                key={cat}
                onClick={() => {
                  chiptune.playKey();
                  setCategoryFilter(cat);
                }}
                className={`px-1.5 py-1 text-[6.5px] border cursor-pointer transition-colors ${
                  active
                    ? 'border-[#3cbcfc] bg-[#082438] text-[#3cbcfc] font-bold'
                    : 'border-gray-700 bg-[#121218] text-gray-400 hover:text-white'
                }`}
              >
                {cat.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Split-Pane Content: Roster Index (Left) + Bestiary Page (Right) */}
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2.5 min-h-0 overflow-hidden">
        {/* Left Roster List */}
        <div className="sm:col-span-5 flex flex-col gap-1 overflow-y-auto pr-1 min-h-0 max-h-[130px] sm:max-h-none border border-gray-800 bg-[#08080c] p-1.5">
          {filteredEntries.map((entry) => {
            const unlocked = unlockedSet.has(entry.type);
            const isSelected = selectedEntry.type === entry.type;
            return (
              <button
                key={entry.type}
                data-bestiary-item={entry.type}
                onClick={() => handleSelectEntry(entry.type)}
                className={`w-full flex items-center gap-2 p-1.5 border text-left cursor-pointer transition-all ${
                  isSelected
                    ? unlocked
                      ? 'border-[#f8b800] bg-[#2a1d00] text-white'
                      : 'border-gray-500 bg-[#1a1a22] text-gray-300'
                    : unlocked
                    ? 'border-gray-800 bg-[#101018] text-gray-200 hover:border-gray-600'
                    : 'border-[#181820] bg-[#0b0b10] text-gray-600 hover:border-gray-700'
                }`}
              >
                <BestiarySpritePreview enemyType={entry.type} unlocked={unlocked} size={24} />
                <div className="min-w-0 flex-1">
                  <div className="text-[7px] truncate">
                    <span className="text-gray-500 mr-1">#{formatPageNumber(entry.pageNumber)}</span>
                    <span className={unlocked ? 'text-white' : 'text-gray-600'}>
                      {unlocked ? entry.name : '???'}
                    </span>
                  </div>
                  <div className="text-[6px] text-gray-500 truncate mt-0.5">
                    {unlocked ? entry.category.toUpperCase() : 'UNDISCOVERED'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Bestiary Page */}
        <div
          id="bestiary-page-detail"
          className="sm:col-span-7 flex flex-col justify-between border-2 border-[#30364a] bg-[#0a0c12] p-2.5 min-h-0 overflow-y-auto"
        >
          {isSelectedUnlocked ? (
            <div className="flex flex-col gap-2">
              {/* Page Title Header */}
              <div className="flex items-start justify-between gap-2 border-b border-gray-800 pb-2">
                <div>
                  <div className="text-[9px] text-[#f8b800] font-bold leading-tight">
                    #{formatPageNumber(selectedEntry.pageNumber)} {selectedEntry.name}
                  </div>
                  <div className="text-[6.5px] text-gray-400 mt-1">
                    {selectedEntry.title.toUpperCase()}
                  </div>
                </div>
                <span
                  className={`px-1.5 py-0.5 text-[6px] border shrink-0 ${
                    CATEGORY_COLORS[selectedEntry.category]
                  }`}
                >
                  {selectedEntry.category.toUpperCase()}
                </span>
              </div>

              {/* Sprite Portrait + Primary Stats */}
              <div className="flex items-center gap-2.5">
                <BestiarySpritePreview
                  enemyType={selectedEntry.type}
                  unlocked={true}
                  size={60}
                />

                <div className="flex-1 grid grid-cols-2 gap-1.5 text-[6.5px]">
                  <div className="border border-gray-800 bg-[#10131d] px-1.5 py-1">
                    <div className="text-gray-500">HP</div>
                    <div className="text-[#d82800] font-bold mt-0.5">
                      {selectedEntry.hp} ({selectedEntry.hp / 2} ♥)
                    </div>
                  </div>

                  <div className="border border-gray-800 bg-[#10131d] px-1.5 py-1">
                    <div className="text-gray-500">SPEED</div>
                    <div className="text-[#3cbcfc] mt-0.5 truncate">
                      {selectedEntry.speedLabel}
                    </div>
                  </div>

                  <div className="border border-gray-800 bg-[#10131d] px-1.5 py-1 col-span-2">
                    <div className="text-gray-500">THREAT</div>
                    <div className="text-[#f8b800] mt-0.5">{selectedEntry.attackThreat}</div>
                  </div>
                </div>
              </div>

              {/* Tactical Notes */}
              <div className="grid grid-cols-1 gap-1 text-[6.5px] border border-gray-800 bg-[#0e1118] p-1.5">
                <div className="flex items-start gap-1">
                  <ShieldAlert size={10} className="text-[#58f898] shrink-0 mt-0.5" />
                  <div>
                    <span className="text-gray-500">WEAKNESS: </span>
                    <span className="text-[#58f898]">{selectedEntry.weakness}</span>
                  </div>
                </div>
                <div className="flex items-start gap-1">
                  <Sparkles size={10} className="text-[#f8b800] shrink-0 mt-0.5" />
                  <div>
                    <span className="text-gray-500">DROPS: </span>
                    <span className="text-gray-200">{selectedEntry.drops}</span>
                  </div>
                </div>
                <div className="flex items-start justify-between gap-2 text-gray-400">
                  <span>HABITAT: {selectedEntry.habitat}</span>
                  {slainCount > 0 && (
                    <span className="flex items-center gap-1 text-gray-300 shrink-0">
                      <Skull size={9} />
                      SLAIN: {slainCount}
                    </span>
                  )}
                </div>
              </div>

              {/* Lore Description */}
              <div className="border border-[#262b3b] bg-[#07090e] p-2">
                <div className="text-[6px] text-[#3cbcfc] mb-1 tracking-wider">FIELD LORE:</div>
                <p className="font-mono text-[10px] leading-snug text-gray-200">
                  {selectedEntry.lore}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-4 px-2 gap-3">
              <BestiarySpritePreview enemyType={selectedEntry.type} unlocked={false} size={60} />
              <div>
                <div className="text-[9px] text-gray-400 font-bold">
                  PAGE #{formatPageNumber(selectedEntry.pageNumber)} — LOCKED
                </div>
                <div className="text-[7px] text-[#f8b800] mt-1">
                  {selectedEntry.category.toUpperCase()} ENCOUNTER
                </div>
              </div>
              <p className="font-mono text-[10px] leading-snug text-gray-400 max-w-[230px]">
                Defeat this enemy in battle for the first time to unlock its combat stats and Hyrule lore entry.
              </p>
            </div>
          )}

          {/* Page Turn Navigation */}
          <div className="border-t border-gray-800 pt-2 mt-2 flex items-center justify-between text-[7px]">
            <button
              id="bestiary-prev-page"
              onClick={() => handleStepPage(-1)}
              className="flex items-center gap-1 px-2 py-1 border border-gray-700 bg-[#14141d] hover:border-white text-gray-200 cursor-pointer"
            >
              <ChevronLeft size={10} />
              <span>PREV</span>
            </button>

            <span className="text-gray-400">
              PAGE {formatPageNumber(selectedIndexInFiltered + 1)}/{formatPageNumber(filteredEntries.length)}
            </span>

            <button
              id="bestiary-next-page"
              onClick={() => handleStepPage(1)}
              className="flex items-center gap-1 px-2 py-1 border border-gray-700 bg-[#14141d] hover:border-white text-gray-200 cursor-pointer"
            >
              <span>NEXT</span>
              <ChevronRight size={10} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
