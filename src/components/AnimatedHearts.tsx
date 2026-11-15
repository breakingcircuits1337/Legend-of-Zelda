/**
 * The Legend of Zelda NES - Animated HUD Hearts
 * Features:
 * - Smooth step-by-step increment & decrement visual transitions
 * - Dynamic hurt recoil shake & damage ghost-heart lag trail
 * - Healing spring pop & brightness pulse on heart gain
 * - Dramatic scale-in bounce & golden fanfare glow when gaining Heart Containers
 * - Critical health pulsing heart indicator
 * - 100% pixel-perfect 8-bit NES Zelda heart rendering with specular glint
 */

import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'motion/react';
import { chiptune } from '../audio/chiptune';

interface AnimatedHeartsProps {
  currentHearts: number; // in half-hearts (e.g. 6 = 3 full hearts)
  maxHearts: number;     // in half-hearts (e.g. 6 = 3 containers)
}

/**
 * Pixel-perfect 8x8 NES Zelda Heart SVG Renderer
 */
const NesHeartSprite: React.FC<{
  fillType: 'full' | 'half' | 'empty';
  isGhostLost?: boolean;
  isPulsing?: boolean;
  isHurt?: boolean;
  isHealed?: boolean;
  compact?: boolean;
}> = ({ fillType, isGhostLost, isPulsing, isHurt, isHealed, compact }) => {
  // Classic NES 2A03 Zelda Color Palette
  const outlineColor = '#000000';
  const heartRed = '#d82800';
  const emptyColor = '#18181a';
  const whiteGlint = '#fcfcfc';
  const ghostAmber = '#f8b800';

  return (
    <div className={`relative ${compact ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'} flex items-center justify-center`}>
      <svg
        viewBox="0 0 8 7"
        className="w-full h-full block"
        style={{ shapeRendering: 'crispEdges' }}
      >
        {/* Background / Empty Basin */}
        <rect x="1" y="1" width="6" height="4" fill={emptyColor} />
        <rect x="2" y="5" width="4" height="1" fill={emptyColor} />
        <rect x="3" y="6" width="2" height="1" fill={emptyColor} />

        {/* Ghost Damage Trail (shows previously lost health in amber) */}
        {isGhostLost && (
          <>
            <rect x="1" y="1" width="6" height="3" fill={ghostAmber} opacity={0.65} />
            <rect x="2" y="4" width="4" height="1" fill={ghostAmber} opacity={0.65} />
            <rect x="3" y="5" width="2" height="1" fill={ghostAmber} opacity={0.65} />
          </>
        )}

        {/* Full Heart Fill */}
        {fillType === 'full' && (
          <>
            {/* Left lobe */}
            <rect x="1" y="1" width="2" height="3" fill={heartRed} />
            <rect x="1" y="1" width="1" height="1" fill={whiteGlint} /> {/* Specular Glint */}
            {/* Right lobe */}
            <rect x="4" y="1" width="3" height="3" fill={heartRed} />
            {/* Center connector */}
            <rect x="3" y="2" width="1" height="2" fill={heartRed} />
            {/* Lower taper */}
            <rect x="2" y="4" width="4" height="1" fill={heartRed} />
            <rect x="3" y="5" width="2" height="1" fill={heartRed} />
          </>
        )}

        {/* Half Heart Fill */}
        {fillType === 'half' && (
          <>
            {/* Left lobe filled */}
            <rect x="1" y="1" width="2" height="3" fill={heartRed} />
            <rect x="1" y="1" width="1" height="1" fill={whiteGlint} />
            <rect x="2" y="4" width="2" height="1" fill={heartRed} />
            <rect x="3" y="5" width="1" height="1" fill={heartRed} />
          </>
        )}

        {/* Authentic NES Black Pixel Outline */}
        {/* Top Lobes */}
        <rect x="1" y="0" width="2" height="1" fill={outlineColor} />
        <rect x="4" y="0" width="2" height="1" fill={outlineColor} />
        <rect x="3" y="0" width="1" height="1" fill={outlineColor} />
        {/* Outer Left Edge */}
        <rect x="0" y="1" width="1" height="3" fill={outlineColor} />
        {/* Outer Right Edge */}
        <rect x="7" y="1" width="1" height="3" fill={outlineColor} />
        {/* Center cleft */}
        <rect x="3" y="1" width="1" height="1" fill={outlineColor} />
        {/* Bottom V Taper */}
        <rect x="1" y="4" width="1" height="1" fill={outlineColor} />
        <rect x="6" y="4" width="1" height="1" fill={outlineColor} />
        <rect x="2" y="5" width="1" height="1" fill={outlineColor} />
        <rect x="5" y="5" width="1" height="1" fill={outlineColor} />
        <rect x="3" y="6" width="2" height="1" fill={outlineColor} />
      </svg>
    </div>
  );
};

export const AnimatedHearts: React.FC<AnimatedHeartsProps> = ({
  currentHearts,
  maxHearts,
}) => {
  // Stepped displayed values for smooth animation
  const [displayedHearts, setDisplayedHearts] = useState(currentHearts);
  const [displayedMaxHearts, setDisplayedMaxHearts] = useState(maxHearts);
  const [ghostHearts, setGhostHearts] = useState(currentHearts);

  // Active animation feedback per container index
  const [animatingIndices, setAnimatingIndices] = useState<
    Record<number, 'hurt' | 'heal' | 'spawn'>
  >({});

  const isInitialMount = useRef(true);

  // 1. Synchronize / Animate maxHearts (Heart Container Pickup)
  useEffect(() => {
    if (isInitialMount.current) {
      return;
    }

    if (maxHearts > displayedMaxHearts) {
      // Step up container count one container (2 half-hearts) at a time
      const nextMax = Math.min(displayedMaxHearts + 2, maxHearts);
      const newContainerIdx = Math.floor(nextMax / 2) - 1;

      setAnimatingIndices((prev) => ({
        ...prev,
        [newContainerIdx]: 'spawn',
      }));

      const timer = setTimeout(() => {
        setDisplayedMaxHearts(nextMax);
      }, 150);

      return () => clearTimeout(timer);
    } else if (maxHearts < displayedMaxHearts) {
      setDisplayedMaxHearts(maxHearts);
    }
  }, [maxHearts, displayedMaxHearts]);

  // 2. Step-by-step smooth increment / decrement of hearts
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      setDisplayedHearts(currentHearts);
      setGhostHearts(currentHearts);
      setDisplayedMaxHearts(maxHearts);
      return;
    }

    if (displayedHearts === currentHearts) {
      // Once target reached, gently clear ghost damage trail after brief linger
      const ghostTimer = setTimeout(() => {
        setGhostHearts(currentHearts);
      }, 350);
      return () => clearTimeout(ghostTimer);
    }

    const diff = Math.abs(currentHearts - displayedHearts);
    // Dynamic step rate: faster if gap is large, rhythmic for standard hits/pickups
    const stepDelay = diff > 6 ? 40 : diff > 3 ? 65 : 100;

    const stepTimer = setTimeout(() => {
      if (displayedHearts < currentHearts) {
        // INCREMENTING (Heart pickup / Potion / Fairy / Heart Container fill)
        const nextVal = displayedHearts + 1;
        const targetContainer = Math.floor((nextVal - 1) / 2);

        setAnimatingIndices((prev) => ({
          ...prev,
          [targetContainer]: 'heal',
        }));

        setDisplayedHearts(nextVal);
        setGhostHearts(nextVal);
        if (diff > 1) {
          chiptune.playHeart();
        }
      } else {
        // DECREMENTING (Taking damage / losing health)
        const nextVal = displayedHearts - 1;
        const targetContainer = Math.floor(nextVal / 2);

        setAnimatingIndices((prev) => ({
          ...prev,
          [targetContainer]: 'hurt',
        }));

        setDisplayedHearts(nextVal);
        // Retain ghostHearts at previous level to render damage trail
      }
    }, stepDelay);

    return () => clearTimeout(stepTimer);
  }, [currentHearts, displayedHearts, maxHearts]);

  // 3. Clear transient animation classes after pop/shake finishes
  useEffect(() => {
    const clearTimer = setTimeout(() => {
      setAnimatingIndices({});
    }, 280);
    return () => clearTimeout(clearTimer);
  }, [displayedHearts, displayedMaxHearts]);

  const totalContainers = Math.min(16, Math.max(3, Math.floor(displayedMaxHearts / 2)));
  const useTwoRowEightCol = totalContainers > 8;
  const isCriticalHealth = displayedHearts > 0 && displayedHearts <= 2;

  return (
    <div className="flex flex-col items-end">
      {/* LIFE Label */}
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className={`text-[8px] tracking-widest font-bold transition-colors duration-200 ${
            isCriticalHealth ? 'text-[#ff4040] animate-pulse' : 'text-[#d82800]'
          }`}
        >
          -LIFE-
        </span>
      </div>

      {/* Heart Containers Grid (scales smoothly up to classic 8x2 = 16 NES containers) */}
      <div
        id="hud-heart-containers-grid"
        className={
          useTwoRowEightCol
            ? 'grid grid-cols-8 gap-0.5'
            : 'grid grid-cols-4 gap-1 sm:gap-1.5'
        }
      >
        {Array.from({ length: totalContainers }).map((_, index) => {
          // Calculate heart value for this container
          const dispValue = displayedHearts - index * 2;
          const ghostValue = ghostHearts - index * 2;

          let fillType: 'full' | 'half' | 'empty' = 'empty';
          if (dispValue >= 2) {
            fillType = 'full';
          } else if (dispValue === 1) {
            fillType = 'half';
          }

          // Ghost damage trail exists if ghost health was higher than current
          const isGhostLost = ghostValue > dispValue && dispValue < 2;

          const animType = animatingIndices[index];
          const isHurt = animType === 'hurt';
          const isHealed = animType === 'heal';
          const isSpawned = animType === 'spawn';

          // Critical health pulse on the active heart
          const isPulsing = isCriticalHealth && dispValue > 0;

          return (
            <motion.div
              key={index}
              className={`relative flex items-center justify-center p-0.5 rounded ${
                isSpawned
                  ? 'border border-[#f8b800] shadow-[0_0_8px_#f8b800]'
                  : 'border border-transparent'
              }`}
              initial={isSpawned ? { scale: 0, opacity: 0, rotate: -30 } : false}
              animate={
                isHurt
                  ? {
                      x: [-2, 2, -1, 1, 0],
                      y: [-1, 1, 0],
                      scale: [1, 0.85, 1],
                    }
                  : isHealed
                  ? {
                      scale: [1, 1.45, 1],
                      filter: ['brightness(1)', 'brightness(2)', 'brightness(1)'],
                    }
                  : isSpawned
                  ? {
                      scale: [0, 1.4, 1],
                      opacity: 1,
                      rotate: 0,
                    }
                  : isPulsing
                  ? {
                      scale: [1, 1.18, 1],
                    }
                  : {
                      scale: 1,
                      x: 0,
                      y: 0,
                    }
              }
              transition={
                isHurt
                  ? { duration: 0.2, ease: 'easeInOut' }
                  : isHealed
                  ? { duration: 0.35, ease: 'easeInOut' }
                  : isSpawned
                  ? { duration: 0.4, ease: 'easeOut' }
                  : isPulsing
                  ? { duration: 0.45, repeat: Infinity, ease: 'easeInOut' }
                  : { duration: 0.15 }
              }
            >
              <NesHeartSprite
                fillType={fillType}
                isGhostLost={isGhostLost}
                isPulsing={isPulsing}
                isHurt={isHurt}
                isHealed={isHealed}
                compact={useTwoRowEightCol}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
