/**
 * The Legend of Zelda NES - Classic 8-Bit Title Screen
 * Authentic Recreation featuring:
 * - Iconic 3D dimensional red & gold ZELDA logo with sword piercing the 'Z'
 * - Golden Royal Crest & glowing Triforce
 * - Cascading animated pixel waterfall & pine tree cliffside
 * - Shimmering glint sweeps & twinkling star particles
 * - Flashing "PUSH START BUTTON" with sound effects
 * - Legend of Zelda intro story crawl toggle
 * - Full Keyboard & Gamepad (Start / Enter / Space) input support
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { chiptune } from '../audio/chiptune';
import { Sparkles, Scroll, Volume2, VolumeX, Play } from 'lucide-react';

interface TitleScreenProps {
  onStart: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ onStart }) => {
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [showStory, setShowStory] = useState(false);
  const [isAudioStarted, setIsAudioStarted] = useState(false);
  const [isMuted, setIsMuted] = useState(() => chiptune.getMuted());
  const [animTick, setAnimTick] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasTriggeredRef = useRef(false);

  // Animation frame loop for waterfall, water spray, glints, and twinkling stars
  useEffect(() => {
    let animId: number;
    const update = () => {
      setAnimTick((t) => (t + 1) % 240);
      animId = requestAnimationFrame(update);
    };
    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Play Title BGM upon user interaction
  const ensureAudio = useCallback(() => {
    if (!isAudioStarted) {
      chiptune.resume();
      chiptune.playBgm('title');
      setIsAudioStarted(true);
    }
  }, [isAudioStarted]);

  // Handle Start Trigger
  const handlePressStart = useCallback(() => {
    if (hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;

    ensureAudio();
    chiptune.playSecret();

    setIsFadingOut(true);
    setTimeout(() => {
      onStart();
    }, 650);
  }, [ensureAudio, onStart]);

  // Keyboard & Gamepad input listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyZ' || e.code === 'KeyX') {
        e.preventDefault();
        handlePressStart();
      } else if (e.code === 'KeyS' || e.code === 'Tab') {
        // Toggle story scroll
        e.preventDefault();
        setShowStory((prev) => !prev);
        chiptune.playKey();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Poll Gamepad for Start or A/B button
    const gamepadInterval = setInterval(() => {
      if (hasTriggeredRef.current) return;
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const gp of gamepads) {
        if (!gp) continue;
        // Button 9 is Start, 8 is Select, 0 is A, 1 is B
        if (gp.buttons[9]?.pressed || gp.buttons[0]?.pressed || gp.buttons[1]?.pressed) {
          handlePressStart();
          break;
        }
        if (gp.buttons[8]?.pressed) {
          setShowStory((prev) => !prev);
          chiptune.playKey();
          break;
        }
      }
    }, 100);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearInterval(gamepadInterval);
    };
  }, [handlePressStart]);

  // Render 8-Bit Waterfall & Cliffside Pixel Backdrop on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    const w = canvas.width;
    const h = canvas.height;

    // Clear with deep midnight blue / black
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    // Stone cliffs (browns #c84c0c, #882c00, #441400)
    const cliffHeight = 70;
    const cliffY = h - cliffHeight;

    // Background mountains
    ctx.fillStyle = '#1c1c24';
    ctx.beginPath();
    ctx.moveTo(0, cliffY + 10);
    ctx.lineTo(40, cliffY - 15);
    ctx.lineTo(90, cliffY + 10);
    ctx.lineTo(150, cliffY - 20);
    ctx.lineTo(210, cliffY + 8);
    ctx.lineTo(256, cliffY - 10);
    ctx.lineTo(256, h);
    ctx.lineTo(0, h);
    ctx.fill();

    // Cliff plateaus
    ctx.fillStyle = '#c84c0c';
    ctx.fillRect(0, cliffY, w, cliffHeight);
    ctx.fillStyle = '#882c00';
    ctx.fillRect(0, cliffY + 8, w, cliffHeight - 8);

    // Pine Trees on cliff edges (NES green #00a800 & dark green #006400)
    const drawPineTree = (x: number, y: number, scale = 1) => {
      ctx.fillStyle = '#006400';
      ctx.fillRect(x + 3 * scale, y + 8 * scale, 2 * scale, 3 * scale); // Trunk
      ctx.fillStyle = '#00a800';
      // Triangle layers
      ctx.fillRect(x + 1 * scale, y + 4 * scale, 6 * scale, 4 * scale);
      ctx.fillRect(x + 2 * scale, y + 2 * scale, 4 * scale, 3 * scale);
      ctx.fillRect(x + 3 * scale, y, 2 * scale, 2 * scale);
    };

    drawPineTree(8, cliffY - 8, 1.2);
    drawPineTree(24, cliffY - 6, 1.0);
    drawPineTree(42, cliffY - 10, 1.3);
    drawPineTree(210, cliffY - 9, 1.2);
    drawPineTree(228, cliffY - 7, 1.0);
    drawPineTree(242, cliffY - 11, 1.3);

    // Twin Cascading Waterfalls (Center-left and center-right)
    const wfOffset = Math.floor(animTick / 3) % 4;
    const wfWidth = 14;
    const wfLeft = 100;
    const wfRight = 142;

    [wfLeft, wfRight].forEach((wx) => {
      // Waterfall channel cutout
      ctx.fillStyle = '#2038ec'; // Deep water blue
      ctx.fillRect(wx, cliffY - 12, wfWidth, cliffHeight + 12);

      // Cascading light water streaks & foam (#ffffff & #80d010/#a4e0a4)
      for (let y = cliffY - 12; y < h; y += 4) {
        const streamY = (y + wfOffset * 4) % (cliffHeight + 12) + (cliffY - 12);
        ctx.fillStyle = y % 8 === 0 ? '#ffffff' : '#3cbcfc';
        ctx.fillRect(wx + 2, streamY, wfWidth - 4, 3);
      }

      // Foaming splash at bottom
      const splashPhase = animTick % 6;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(wx - 4 + splashPhase, h - 6, wfWidth + 8 - splashPhase * 2, 3);
      ctx.fillRect(wx - 2, h - 8, wfWidth + 4, 2);
    });

    // Lower Lake Pool (Water body at base)
    ctx.fillStyle = '#2038ec';
    ctx.fillRect(0, h - 14, w, 14);

    // Shimmering horizontal waves on lake surface
    const waveTick = Math.floor(animTick / 6) % 8;
    ctx.fillStyle = '#3cbcfc';
    for (let lx = 0; lx < w; lx += 16) {
      const offsetX = (lx + waveTick * 4) % w;
      ctx.fillRect(offsetX, h - 12, 10, 2);
      ctx.fillRect((offsetX + 8) % w, h - 6, 8, 2);
    }

    // Twinkling stars in dark night sky
    const stars = [
      { x: 22, y: 18, p: 0 },
      { x: 58, y: 32, p: 20 },
      { x: 88, y: 14, p: 40 },
      { x: 130, y: 22, p: 60 },
      { x: 172, y: 16, p: 15 },
      { x: 208, y: 28, p: 45 },
      { x: 236, y: 12, p: 70 },
      { x: 38, y: 55, p: 35 },
      { x: 220, y: 60, p: 55 },
    ];

    stars.forEach((s) => {
      const starBrightness = (animTick + s.p) % 60;
      if (starBrightness > 45) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(s.x, s.y, 2, 2);
        if (starBrightness > 52) {
          ctx.fillRect(s.x - 1, s.y, 4, 2);
          ctx.fillRect(s.x, s.y - 1, 2, 4);
        }
      } else if (starBrightness > 25) {
        ctx.fillStyle = '#f8b800';
        ctx.fillRect(s.x, s.y, 1, 1);
      }
    });
  }, [animTick]);

  return (
    <div
      id="nes-title-screen"
      onClick={ensureAudio}
      className={`relative w-full max-w-[560px] aspect-[256/240] bg-black border-4 border-[#c84c0c] rounded shadow-[0_0_28px_rgba(200,76,12,0.6)] overflow-hidden flex flex-col justify-between font-['Press_Start_2P',monospace] select-none cursor-pointer transition-opacity duration-500 ${
        isFadingOut ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
      }`}
    >
      {/* 8-bit Background Canvas */}
      <canvas
        ref={canvasRef}
        width={256}
        height={160}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />

      {/* Retro CRT Scanline Scan lines */}
      <div
        className="pointer-events-none absolute inset-0 z-30 opacity-70"
        style={{
          backgroundImage:
            'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.4) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.03))',
          backgroundSize: '100% 2px, 3px 100%',
        }}
      />

      {/* Top Header Controls (Audio & Story Mode Toggle) */}
      <div className="relative z-40 flex items-center justify-between p-3 bg-black/40 backdrop-blur-xs">
        <div className="flex items-center gap-1.5 text-[7px] text-[#f8b800]">
          <span className="animate-pulse">▲</span>
          <span className="hidden sm:inline">NINTENDO ENTERTAINMENT SYSTEM</span>
          <span className="sm:hidden">NES 1986</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Story intro modal toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowStory(!showStory);
              chiptune.playKey();
            }}
            className={`px-2 py-1 text-[7px] border rounded transition-colors flex items-center gap-1 cursor-pointer ${
              showStory
                ? 'bg-[#f8b800] text-black border-white font-bold'
                : 'bg-black/80 text-gray-300 border-gray-700 hover:border-gray-400'
            }`}
            title="Read the Legend Story Scroll"
          >
            <Scroll size={10} />
            <span>STORY</span>
          </button>

          {/* Audio toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              const muted = chiptune.toggleMute();
              setIsMuted(muted);
              if (!isAudioStarted && !muted) {
                ensureAudio();
              }
            }}
            className="p-1 text-[7px] bg-black/80 text-gray-300 border border-gray-700 hover:border-gray-400 rounded cursor-pointer"
            title="Toggle Chiptune Music"
          >
            {isMuted ? <VolumeX size={12} className="text-red-400" /> : <Volume2 size={12} className="text-[#58f898]" />}
          </button>
        </div>
      </div>

      {/* MAIN CENTERPIECE: Iconic Zelda Logo & Crest */}
      <div className="relative z-30 flex flex-col items-center justify-center flex-1 px-4 text-center">
        {/* Glowing Golden Triforce Crest */}
        <div className="relative mb-2 flex justify-center items-center">
          <div className="text-2xl text-[#f8b800] drop-shadow-[0_0_12px_#f8b800] animate-pulse">
            ▲
          </div>
          <div className="absolute -top-1 -right-4 text-[10px] text-white animate-spin">✦</div>
          <div className="absolute -bottom-1 -left-4 text-[8px] text-[#58f898] animate-ping">✦</div>
        </div>

        {/* Curved Subtitle Banner */}
        <div className="mb-1 text-[8px] sm:text-[10px] tracking-[0.25em] text-[#fcb42c] font-black drop-shadow-[2px_2px_0px_#000000]">
          THE LEGEND OF
        </div>

        {/* 3D Dimensional Iconic ZELDA Wordmark with Sword Piercing the 'Z' */}
        <div className="relative my-2 select-none group">
          {/* Dimensional Layered Pixel Drop Shadows */}
          <div
            className="text-4xl sm:text-5xl md:text-6xl font-black tracking-wider text-[#3c0000] absolute inset-0 translate-x-1 translate-y-1 select-none pointer-events-none"
            style={{ textShadow: '3px 3px 0 #000, 4px 4px 0 #000' }}
          >
            ZELDA
          </div>
          <div
            className="text-4xl sm:text-5xl md:text-6xl font-black tracking-wider text-[#881400] absolute inset-0 translate-x-0.5 translate-y-0.5 select-none pointer-events-none"
          >
            ZELDA
          </div>

          {/* Front Face: Crimson Red with Golden Highlights & Bevel */}
          <div
            className="relative text-4xl sm:text-5xl md:text-6xl font-black tracking-wider text-[#d82800] select-none"
            style={{
              textShadow:
                '-1px -1px 0 #ffe088, 1px -1px 0 #ffe088, -1px 1px 0 #400000, 1px 1px 0 #400000, 2px 2px 0 #000',
            }}
          >
            ZELDA

            {/* Sword Silhouette Piercing Down Diagonally through the 'Z' */}
            <div
              className="absolute -top-4 left-0 sm:left-1 w-1.5 h-16 sm:h-20 bg-linear-to-b from-gray-100 via-gray-300 to-gray-500 rotate-18 border-r border-black shadow-[0_0_6px_rgba(255,255,255,0.8)] pointer-events-none"
            >
              {/* Sword Crossguard & Pommel */}
              <div className="absolute -top-2 -left-2 w-5 h-1.5 bg-[#f8b800] border border-black rounded-xs" />
              <div className="absolute -top-4 left-0 w-1.5 h-2.5 bg-[#d82800] border border-black" />
              <div className="absolute -top-5.5 -left-0.5 w-2.5 h-1.5 bg-[#f8b800] border border-black rounded-full" />
            </div>

            {/* Shimmer Light Glint sweeping horizontally across the logo */}
            <div
              className="absolute inset-0 bg-linear-to-r from-transparent via-white/40 to-transparent pointer-events-none -skew-x-12 translate-x-[-150%] animate-[shimmer_3.5s_infinite_ease-in-out]"
              style={{
                animation: 'zeldaShimmer 4s infinite linear',
              }}
            />
          </div>
        </div>

        {/* Royal Crest Subtitle */}
        <div className="flex items-center gap-2 text-[6.5px] sm:text-[8px] text-[#f8b800] tracking-widest uppercase mt-1 mb-4">
          <span>❖</span>
          <span>HYRULE FANTASY</span>
          <span>❖</span>
        </div>

        {/* Flashing "PUSH START BUTTON" */}
        <div className="my-2">
          <button
            onClick={handlePressStart}
            className="px-4 py-2.5 bg-black/90 hover:bg-[#1a1a24] border-2 border-[#f8b800] text-white text-[9px] sm:text-[11px] tracking-widest uppercase rounded shadow-[0_0_16px_rgba(248,184,0,0.5)] transition-all cursor-pointer flex items-center gap-2.5 mx-auto group active:scale-95"
          >
            <Play size={12} className="text-[#f8b800] fill-[#f8b800] group-hover:animate-ping" />
            <span
              className={`font-bold ${
                animTick % 40 < 20 ? 'text-[#ffffff]' : 'text-[#f8b800]'
              }`}
            >
              PUSH START BUTTON
            </span>
          </button>
        </div>

        {/* Input Control Hints */}
        <div className="text-[6.5px] sm:text-[7.5px] text-gray-400 mt-2 space-y-1">
          <div className="text-gray-400">
            [PRESS <strong className="text-white">ENTER</strong> / <strong className="text-white">SPACE</strong> OR CLICK TO PLAY]
          </div>
          <div className="text-gray-500">
            CONTROLLER 1: [START] / [A] BUTTON SUPPORTED
          </div>
        </div>
      </div>

      {/* Bottom Footer: Copyright Notice */}
      <div className="relative z-40 flex flex-col sm:flex-row items-center justify-between px-4 py-2 bg-black/85 border-t border-gray-900 text-[6.5px] text-gray-400">
        <div>© 1986 NINTENDO</div>
        <div className="text-gray-500">PROGRAMMED IN 6502 2A03 / WEB ENGINE</div>
        <div>ALL RIGHTS RESERVED</div>
      </div>

      {/* STORY INTRO OVERLAY MODAL */}
      {showStory && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 z-50 bg-black/95 p-4 sm:p-6 flex flex-col justify-between text-[#fcb42c] overflow-y-auto"
        >
          <div className="flex items-center justify-between border-b border-[#fcb42c] pb-2 mb-3">
            <h3 className="text-[9px] sm:text-[11px] text-white font-bold flex items-center gap-2">
              <Scroll size={13} className="text-[#f8b800]" />
              <span>THE PROLOGUE OF HYRULE</span>
            </h3>
            <button
              onClick={() => setShowStory(false)}
              className="px-2 py-0.5 bg-[#c84c0c] hover:bg-[#e05814] text-white text-[8px] rounded border border-white cursor-pointer"
            >
              ✕ CLOSE
            </button>
          </div>

          <div className="flex-1 space-y-3 text-[7px] sm:text-[8px] leading-relaxed text-gray-200">
            <p className="text-[#58f898]">
              MANY YEARS AGO, PRINCE OF DARKNESS GANON STOLE ONE OF THE TRIFORCE PIECES WITH POWER.
            </p>
            <p>
              PRINCESS ZELDA OF HYRULE CARRIED THE TRIFORCE OF WISDOM. TO PREVENT GANON FROM HARNESSING ITS DIVINE MIGHT, SHE SHATTERED IT INTO EIGHT GOLDEN TRIANGLES AND HID THEM DEEP WITHIN SECRET LABYRINTHS.
            </p>
            <p className="text-[#f8b800]">
              SHE DISPATCHED HER FAITHFUL NURSEMAID IMPA TO SEEK A HERO WITH THE COURAGE TO STAND AGAINST GANON&apos;S HORDE.
            </p>
            <p>
              WHEN AMBUSHED BY MONSTERS, IMPA WAS SAVED BY A BRAVE TRAVELER IN GREEN — A YOUNG MAN NAMED LINK.
            </p>
            <p className="text-[#ffffff] border-l-2 border-[#f8b800] pl-2 font-bold">
              &quot;TAKE THIS SWORD, LINK! COLLECT THE EIGHT PIECES OF THE TRIFORCE, SLAY GANON IN DEATH MOUNTAIN, AND RESCUE PRINCESS ZELDA!&quot;
            </p>
          </div>

          <div className="mt-4 pt-2 border-t border-gray-800 flex justify-between items-center text-[7px]">
            <span className="text-gray-400">PRESS [START] OR CLICK BELOW TO PROCEED</span>
            <button
              onClick={handlePressStart}
              className="px-3 py-1.5 bg-[#f8b800] hover:bg-[#ffe066] text-black font-bold rounded cursor-pointer shadow"
            >
              BEGIN QUEST ►
            </button>
          </div>
        </div>
      )}

      {/* Shimmer keyframe CSS */}
      <style>{`
        @keyframes zeldaShimmer {
          0% { transform: translateX(-140%) skewX(-15deg); }
          30% { transform: translateX(140%) skewX(-15deg); }
          100% { transform: translateX(140%) skewX(-15deg); }
        }
      `}</style>
    </div>
  );
};
