/**
 * Responsive NES Virtual Gamepad Touch Controls
 * Ergonomic D-pad with multi-touch slide detection + A/B action buttons + Start/Select
 */

import React, { useRef } from 'react';

interface TouchControlsProps {
  onDirectionChange: (dir: { up: boolean; down: boolean; left: boolean; right: boolean }) => void;
  onButtonA: (pressed: boolean) => void;
  onButtonB: (pressed: boolean) => void;
  onButtonStart: () => void;
  onButtonSelect: () => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  onDirectionChange,
  onButtonA,
  onButtonB,
  onButtonStart,
  onButtonSelect,
}) => {
  const dpadRef = useRef<HTMLDivElement>(null);
  const touchIdRef = useRef<number | null>(null);

  const vibrate = (ms: number = 12) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(ms);
      } catch {}
    }
  };

  const handleDpadTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!dpadRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;

    const rect = dpadRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 12) {
      // Deadzone
      onDirectionChange({ up: false, down: false, left: false, right: false });
      return;
    }

    const angle = Math.atan2(dy, dx) * (180 / Math.PI); // -180 to 180

    const up = angle > -135 && angle < -45;
    const down = angle > 45 && angle < 135;
    const left = Math.abs(angle) > 135;
    const right = angle > -45 && angle < 45;

    onDirectionChange({ up, down, left, right });
  };

  const handleDpadEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    onDirectionChange({ up: false, down: false, left: false, right: false });
  };

  return (
    <div
      id="nes-touch-controls"
      className="w-full select-none touch-none py-2 px-4 flex items-center justify-between gap-4 max-w-xl mx-auto"
    >
      {/* NES D-PAD */}
      <div className="relative flex items-center justify-center p-2">
        <div
          ref={dpadRef}
          onTouchStart={(e) => {
            vibrate(15);
            handleDpadTouch(e);
          }}
          onTouchMove={handleDpadTouch}
          onTouchEnd={handleDpadEnd}
          onTouchCancel={handleDpadEnd}
          className="relative w-32 h-32 bg-[#1a1a1a] rounded-full border-2 border-[#333] shadow-inner flex items-center justify-center cursor-pointer active:brightness-110"
        >
          {/* Horizontal cross bar */}
          <div className="absolute w-28 h-10 bg-[#2b2b2b] rounded-sm border border-black shadow flex justify-between items-center px-1">
            <span className="text-[10px] text-gray-500 font-bold">◀</span>
            <span className="text-[10px] text-gray-500 font-bold">▶</span>
          </div>

          {/* Vertical cross bar */}
          <div className="absolute w-10 h-28 bg-[#2b2b2b] rounded-sm border border-black shadow flex flex-col justify-between items-center py-1">
            <span className="text-[10px] text-gray-500 font-bold">▲</span>
            <span className="text-[10px] text-gray-500 font-bold">▼</span>
          </div>

          {/* Center pivot divot */}
          <div className="absolute w-6 h-6 rounded-full bg-[#181818] border border-[#111] shadow-inner z-10" />
        </div>
      </div>

      {/* Center START & SELECT pills */}
      <div className="flex flex-col gap-3 items-center justify-center">
        <div className="flex gap-4">
          <div className="flex flex-col items-center">
            <button
              id="btn-touch-select"
              onTouchStart={(e) => {
                e.preventDefault();
                vibrate(15);
                onButtonSelect();
              }}
              onClick={onButtonSelect}
              className="w-11 h-4 bg-[#383838] border border-black -rotate-12 rounded-full shadow-md active:bg-[#555]"
            />
            <span className="text-[8px] text-gray-400 mt-1 uppercase font-bold tracking-wider">
              Select
            </span>
          </div>

          <div className="flex flex-col items-center">
            <button
              id="btn-touch-start"
              onTouchStart={(e) => {
                e.preventDefault();
                vibrate(20);
                onButtonStart();
              }}
              onClick={onButtonStart}
              className="w-11 h-4 bg-[#383838] border border-black -rotate-12 rounded-full shadow-md active:bg-[#555]"
            />
            <span className="text-[8px] text-gray-400 mt-1 uppercase font-bold tracking-wider">
              Start
            </span>
          </div>
        </div>

        <div className="text-[7px] text-gray-500 uppercase tracking-widest text-center mt-1">
          NES Controller
        </div>
      </div>

      {/* Action Buttons: B & A */}
      <div className="flex gap-3 items-center pr-2 -rotate-12">
        {/* B Button (Secondary weapon) */}
        <div className="flex flex-col items-center">
          <button
            id="btn-touch-b"
            onTouchStart={(e) => {
              e.preventDefault();
              vibrate(15);
              onButtonB(true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              onButtonB(false);
            }}
            onMouseDown={() => onButtonB(true)}
            onMouseUp={() => onButtonB(false)}
            className="w-14 h-14 rounded-full bg-[#b81800] border-2 border-black active:bg-[#f83800] shadow-[0_4px_0_#600] active:translate-y-1 active:shadow-none flex items-center justify-center text-white font-bold text-sm"
          >
            B
          </button>
          <span className="text-[9px] text-gray-400 font-bold mt-1 uppercase tracking-wider">
            Item
          </span>
        </div>

        {/* A Button (Sword) */}
        <div className="flex flex-col items-center">
          <button
            id="btn-touch-a"
            onTouchStart={(e) => {
              e.preventDefault();
              vibrate(15);
              onButtonA(true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              onButtonA(false);
            }}
            onMouseDown={() => onButtonA(true)}
            onMouseUp={() => onButtonA(false)}
            className="w-14 h-14 rounded-full bg-[#b81800] border-2 border-black active:bg-[#f83800] shadow-[0_4px_0_#600] active:translate-y-1 active:shadow-none flex items-center justify-center text-white font-bold text-sm"
          >
            A
          </button>
          <span className="text-[9px] text-gray-400 font-bold mt-1 uppercase tracking-wider">
            Sword
          </span>
        </div>
      </div>
    </div>
  );
};
