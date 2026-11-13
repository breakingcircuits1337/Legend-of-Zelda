/**
 * The Legend of Zelda NES - Controls Remapping & Settings Menu
 * Enables custom keyboard and gamepad rebinding with live input preview and persistence.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ControlsConfig,
  KeyBindings,
  GamepadBindings,
  DEFAULT_CONTROLS_CONFIG,
  saveControlsConfig,
  formatKeyCode,
  formatGamepadButton,
} from '../game/controlsConfig';
import { chiptune } from '../audio/chiptune';
import { Keyboard, Gamepad2, RotateCcw, Check, Radio, AlertCircle, Bug, Sparkles } from 'lucide-react';

interface ControlsSettingsProps {
  config: ControlsConfig;
  onChangeConfig: (newConfig: ControlsConfig) => void;
  gamepadName: string | null;
}

type RebindTarget =
  | { type: 'keyboard'; action: keyof KeyBindings }
  | { type: 'gamepad'; action: keyof GamepadBindings }
  | null;

export const ControlsSettings: React.FC<ControlsSettingsProps> = ({
  config,
  onChangeConfig,
  gamepadName,
}) => {
  const [activeTab, setActiveTab] = useState<'keyboard' | 'gamepad' | 'debug'>('keyboard');
  const [rebindTarget, setRebindTarget] = useState<RebindTarget>(null);
  const [resetMessage, setResetMessage] = useState(false);

  const handleToggleHitboxDebug = () => {
    chiptune.playKey();
    const nextVal = !config.showHitboxDebug;
    const newConfig: ControlsConfig = {
      ...config,
      showHitboxDebug: nextVal,
    };
    onChangeConfig(newConfig);
    saveControlsConfig(newConfig);
  };

  // Live input monitor state for instant feedback
  const [activeInputs, setActiveInputs] = useState<{
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
    attack: boolean;
    item: boolean;
    pause: boolean;
    select: boolean;
  }>({
    up: false,
    down: false,
    left: false,
    right: false,
    attack: false,
    item: false,
    pause: false,
    select: false,
  });

  const keysPressedRef = useRef<Record<string, boolean>>({});

  // 1. Live Input Monitor & Keyboard Remap Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If currently listening for keyboard rebind
      if (rebindTarget && rebindTarget.type === 'keyboard') {
        e.preventDefault();
        e.stopPropagation();

        const action = rebindTarget.action;
        const newCode = e.code;

        const newConfig: ControlsConfig = {
          ...config,
          keyboard: {
            ...config.keyboard,
            [action]: [newCode],
          },
        };

        onChangeConfig(newConfig);
        saveControlsConfig(newConfig);
        setRebindTarget(null);
        chiptune.playKey();
        return;
      }

      keysPressedRef.current[e.code] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [rebindTarget, config, onChangeConfig]);

  // 2. Gamepad Polling & Remap Listener Loop
  useEffect(() => {
    let animId: number;

    const poll = () => {
      if (navigator.getGamepads) {
        const pads = navigator.getGamepads();
        const pad = Array.from(pads).find((p) => p !== null && p.connected);

        if (pad) {
          // Check if rebind target is waiting for gamepad button press
          if (rebindTarget && rebindTarget.type === 'gamepad') {
            for (let b = 0; b < pad.buttons.length; b++) {
              if (pad.buttons[b]?.pressed) {
                const action = rebindTarget.action;
                const newConfig: ControlsConfig = {
                  ...config,
                  gamepad: {
                    ...config.gamepad,
                    ...(typeof config.gamepad[action] === 'number'
                      ? { [action]: b }
                      : { [action]: [b] }),
                  },
                };

                onChangeConfig(newConfig);
                saveControlsConfig(newConfig);
                setRebindTarget(null);
                chiptune.playKey();
                break;
              }
            }
          }

          // Live tester calculation
          const gp = config.gamepad;
          const kb = config.keyboard;
          const k = keysPressedRef.current;

          const testUp =
            kb.up.some((c) => k[c]) ||
            pad.buttons[gp.dpadUp]?.pressed ||
            (pad.axes[1] || 0) < -0.45;
          const testDown =
            kb.down.some((c) => k[c]) ||
            pad.buttons[gp.dpadDown]?.pressed ||
            (pad.axes[1] || 0) > 0.45;
          const testLeft =
            kb.left.some((c) => k[c]) ||
            pad.buttons[gp.dpadLeft]?.pressed ||
            (pad.axes[0] || 0) < -0.45;
          const testRight =
            kb.right.some((c) => k[c]) ||
            pad.buttons[gp.dpadRight]?.pressed ||
            (pad.axes[0] || 0) > 0.45;
          const testAttack =
            kb.attack.some((c) => k[c]) || gp.attack.some((b) => pad.buttons[b]?.pressed);
          const testItem =
            kb.item.some((c) => k[c]) || gp.item.some((b) => pad.buttons[b]?.pressed);
          const testPause =
            kb.pause.some((c) => k[c]) || gp.pause.some((b) => pad.buttons[b]?.pressed);
          const testSelect =
            kb.select.some((c) => k[c]) || gp.select.some((b) => pad.buttons[b]?.pressed);

          setActiveInputs({
            up: !!testUp,
            down: !!testDown,
            left: !!testLeft,
            right: !!testRight,
            attack: !!testAttack,
            item: !!testItem,
            pause: !!testPause,
            select: !!testSelect,
          });
        } else {
          // Keyboard only tester
          const kb = config.keyboard;
          const k = keysPressedRef.current;
          setActiveInputs({
            up: kb.up.some((c) => k[c]),
            down: kb.down.some((c) => k[c]),
            left: kb.left.some((c) => k[c]),
            right: kb.right.some((c) => k[c]),
            attack: kb.attack.some((c) => k[c]),
            item: kb.item.some((c) => k[c]),
            pause: kb.pause.some((c) => k[c]),
            select: kb.select.some((c) => k[c]),
          });
        }
      }

      animId = requestAnimationFrame(poll);
    };

    animId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(animId);
  }, [rebindTarget, config, onChangeConfig]);

  const handleResetDefaults = () => {
    chiptune.playSecret();
    onChangeConfig(DEFAULT_CONTROLS_CONFIG);
    saveControlsConfig(DEFAULT_CONTROLS_CONFIG);
    setRebindTarget(null);
    setResetMessage(true);
    setTimeout(() => setResetMessage(false), 2000);
  };

  const keyboardRows: Array<{
    action: keyof KeyBindings;
    label: string;
    sub: string;
  }> = [
    { action: 'attack', label: 'SWORD / A BUTTON', sub: 'Primary attack' },
    { action: 'item', label: 'ITEM / B BUTTON', sub: 'Selected sub-weapon' },
    { action: 'up', label: 'MOVE UP', sub: 'North direction' },
    { action: 'down', label: 'MOVE DOWN', sub: 'South direction' },
    { action: 'left', label: 'MOVE LEFT', sub: 'West direction' },
    { action: 'right', label: 'MOVE RIGHT', sub: 'East direction' },
    { action: 'pause', label: 'PAUSE / START', sub: 'Inventory subscreen' },
    { action: 'select', label: 'SELECT / CYCLE', sub: 'Quick switch B-item' },
  ];

  const gamepadRows: Array<{
    action: keyof GamepadBindings;
    label: string;
    sub: string;
    isSingleNumber?: boolean;
  }> = [
    { action: 'attack', label: 'SWORD / A BUTTON', sub: 'Primary action' },
    { action: 'item', label: 'ITEM / B BUTTON', sub: 'Sub-weapon action' },
    { action: 'pause', label: 'START / INVENTORY', sub: 'Pause menu' },
    { action: 'select', label: 'SELECT / CYCLE', sub: 'Item switch' },
    { action: 'dpadUp', label: 'D-PAD UP', sub: 'Direction up', isSingleNumber: true },
    { action: 'dpadDown', label: 'D-PAD DOWN', sub: 'Direction down', isSingleNumber: true },
    { action: 'dpadLeft', label: 'D-PAD LEFT', sub: 'Direction left', isSingleNumber: true },
    { action: 'dpadRight', label: 'D-PAD RIGHT', sub: 'Direction right', isSingleNumber: true },
  ];

  return (
    <div className="flex-1 flex flex-col justify-between overflow-y-auto pr-1 text-white select-none">
      {/* Tab Switcher & Controller Status */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 pb-2 mb-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              chiptune.playKey();
              setActiveTab('keyboard');
              setRebindTarget(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[8px] sm:text-[9px] border cursor-pointer transition-all ${
              activeTab === 'keyboard'
                ? 'border-[#f8b800] bg-[#3a2800] text-[#f8b800] font-bold shadow-[0_0_8px_#f8b800]'
                : 'border-gray-700 bg-[#141419] text-gray-400 hover:text-white'
            }`}
          >
            <Keyboard size={12} />
            <span>KEYBOARD</span>
          </button>

          <button
            onClick={() => {
              chiptune.playKey();
              setActiveTab('gamepad');
              setRebindTarget(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[8px] sm:text-[9px] border cursor-pointer transition-all ${
              activeTab === 'gamepad'
                ? 'border-[#3cbcfc] bg-[#002a44] text-[#3cbcfc] font-bold shadow-[0_0_8px_#3cbcfc]'
                : 'border-gray-700 bg-[#141419] text-gray-400 hover:text-white'
            }`}
          >
            <Gamepad2 size={12} />
            <span>GAMEPAD</span>
          </button>

          <button
            onClick={() => {
              chiptune.playKey();
              setActiveTab('debug');
              setRebindTarget(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[8px] sm:text-[9px] border cursor-pointer transition-all ${
              activeTab === 'debug'
                ? 'border-[#ff3864] bg-[#3a0014] text-[#ff3864] font-bold shadow-[0_0_8px_#ff3864]'
                : 'border-gray-700 bg-[#141419] text-gray-400 hover:text-white'
            }`}
          >
            <Bug size={12} />
            <span>DEBUG</span>
            {config.showHitboxDebug && (
              <span className="px-1 py-0.5 bg-[#58f898] text-black text-[6px] font-bold rounded">
                ON
              </span>
            )}
          </button>
        </div>

        {/* Right side controls: quick hitbox toggle & gamepad indicator */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleHitboxDebug}
            className={`flex items-center gap-1.5 text-[7px] sm:text-[8px] px-2 py-1 border rounded cursor-pointer transition-colors ${
              config.showHitboxDebug
                ? 'border-[#ff3864] bg-[#3a0014] text-[#ff3864]'
                : 'border-gray-700 bg-[#121218] text-gray-400 hover:text-white'
            }`}
            title="Toggle Real-Time Hitbox Collision Debug Overlay"
          >
            <Bug size={10} className={config.showHitboxDebug ? 'animate-pulse' : ''} />
            <span>HITBOXES: {config.showHitboxDebug ? 'ON' : 'OFF'}</span>
          </button>

          {/* Controller connection indicator */}
          <div className="flex items-center gap-1.5 text-[7px] sm:text-[8px] px-2 py-1 bg-[#121218] border border-gray-800 rounded">
            <Radio
              size={10}
              className={gamepadName ? 'text-[#58f898] animate-pulse' : 'text-gray-500'}
            />
            <span className={gamepadName ? 'text-[#58f898]' : 'text-gray-400'}>
              {gamepadName ? gamepadName.slice(0, 20) : 'NO GAMEPAD'}
            </span>
          </div>
        </div>
      </div>

      {/* Rebind Listening Overlay Banner */}
      {rebindTarget && (
        <div className="mb-3 p-2 bg-[#331e00] border-2 border-[#f8b800] rounded text-center animate-pulse flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="text-[#f8b800]" />
            <span className="text-[8px] text-[#f8b800]">
              PRESS ANY {rebindTarget.type === 'keyboard' ? 'KEY' : 'GAMEPAD BUTTON'} TO MAP...
            </span>
          </div>
          <button
            onClick={() => setRebindTarget(null)}
            className="px-2 py-0.5 bg-black border border-gray-600 text-[7px] text-gray-300 hover:text-white"
          >
            CANCEL
          </button>
        </div>
      )}

      {/* Mappings List */}
      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
        {activeTab === 'keyboard' &&
          keyboardRows.map((row) => {
            const isRebinding =
              rebindTarget?.type === 'keyboard' && rebindTarget.action === row.action;
            const currentKeys = config.keyboard[row.action] || [];

            return (
              <div
                key={row.action}
                className={`flex items-center justify-between p-2 border transition-all ${
                  isRebinding
                    ? 'border-[#f8b800] bg-[#221800]'
                    : 'border-[#22222c] bg-[#101016] hover:border-gray-700'
                }`}
              >
                <div>
                  <div className="text-[8px] text-gray-200 font-bold">{row.label}</div>
                  <div className="text-[6px] text-gray-400">{row.sub}</div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {currentKeys.map((k) => (
                      <span
                        key={k}
                        className="px-1.5 py-0.5 bg-[#1b1b24] border border-gray-600 text-[7px] text-[#58f898] font-mono shadow-[1px_1px_0_#000]"
                      >
                        {formatKeyCode(k)}
                      </span>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      chiptune.playKey();
                      setRebindTarget({ type: 'keyboard', action: row.action });
                    }}
                    className={`px-2 py-1 text-[7px] border cursor-pointer ${
                      isRebinding
                        ? 'bg-[#f8b800] text-black font-bold border-white'
                        : 'bg-[#222] hover:bg-[#383848] text-white border-gray-600'
                    }`}
                  >
                    {isRebinding ? 'WAITING...' : 'REMAP'}
                  </button>
                </div>
              </div>
            );
          })}

        {activeTab === 'gamepad' &&
          gamepadRows.map((row) => {
            const isRebinding =
              rebindTarget?.type === 'gamepad' && rebindTarget.action === row.action;
            const val = config.gamepad[row.action];
            const btnList: number[] = Array.isArray(val) ? val : [val as number];

            return (
              <div
                key={row.action}
                className={`flex items-center justify-between p-2 border transition-all ${
                  isRebinding
                    ? 'border-[#3cbcfc] bg-[#001f33]'
                    : 'border-[#22222c] bg-[#101016] hover:border-gray-700'
                }`}
              >
                <div>
                  <div className="text-[8px] text-gray-200 font-bold">{row.label}</div>
                  <div className="text-[6px] text-gray-400">{row.sub}</div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {btnList.map((b) => (
                      <span
                        key={b}
                        className="px-1.5 py-0.5 bg-[#16222c] border border-[#3cbcfc]/60 text-[7px] text-[#3cbcfc] font-mono shadow-[1px_1px_0_#000]"
                      >
                        {formatGamepadButton(b)}
                      </span>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      chiptune.playKey();
                      setRebindTarget({ type: 'gamepad', action: row.action });
                    }}
                    className={`px-2 py-1 text-[7px] border cursor-pointer ${
                      isRebinding
                        ? 'bg-[#3cbcfc] text-black font-bold border-white'
                        : 'bg-[#222] hover:bg-[#383848] text-white border-gray-600'
                    }`}
                  >
                    {isRebinding ? 'WAITING...' : 'REMAP'}
                  </button>
                </div>
              </div>
            );
          })}

        {activeTab === 'debug' && (
          <div className="flex flex-col gap-3 py-1">
            {/* Primary Hitbox Toggle Card */}
            <div className="p-3 bg-[#13131c] border-2 border-[#2b2b3b] rounded flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`p-2 rounded border ${
                      config.showHitboxDebug
                        ? 'border-[#ff3864] bg-[#3a0014] text-[#ff3864]'
                        : 'border-gray-700 bg-[#1e1e28] text-gray-400'
                    }`}
                  >
                    <Bug size={16} />
                  </div>
                  <div>
                    <h3 className="text-[9px] sm:text-[10px] text-white font-bold tracking-wider uppercase">
                      HITBOX COLLISION OVERLAY
                    </h3>
                    <p className="text-[7px] text-gray-400 mt-0.5">
                      Highlights bounding rectangles for player & enemies on the canvas
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleToggleHitboxDebug}
                  className={`px-3 py-1.5 text-[8px] sm:text-[9px] font-bold border-2 cursor-pointer transition-all shadow-[2px_2px_0_#000] ${
                    config.showHitboxDebug
                      ? 'bg-[#004d20] border-[#58f898] text-[#58f898] shadow-[0_0_10px_rgba(88,248,152,0.4)]'
                      : 'bg-[#22222a] border-gray-600 text-gray-300 hover:text-white hover:border-gray-400'
                  }`}
                >
                  {config.showHitboxDebug ? '● ACTIVE' : '○ DISABLED'}
                </button>
              </div>

              {/* Status banner */}
              <div
                className={`p-2 rounded text-[7px] border ${
                  config.showHitboxDebug
                    ? 'bg-[#002b12] border-[#58f898]/40 text-[#58f898]'
                    : 'bg-[#181820] border-gray-800 text-gray-400'
                }`}
              >
                {config.showHitboxDebug
                  ? '✓ Hitboxes are currently rendering live on the game screen at 60 FPS.'
                  : 'Hitbox visualization is turned off. Toggle ON to see collision rectangles.'}
              </div>
            </div>

            {/* Hitbox Color Legend & Spec */}
            <div className="p-3 bg-[#13131c] border border-gray-800 rounded flex flex-col gap-2">
              <h4 className="text-[8px] text-[#f8b800] uppercase font-bold tracking-wider flex items-center gap-1.5">
                <Sparkles size={11} />
                <span>COLLISION HITBOX SPECIFICATIONS</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                {/* Player Link */}
                <div className="p-2 bg-[#0c1610] border border-[#00e676]/40 rounded flex items-start gap-2">
                  <div className="w-4 h-4 border-2 border-[#00e676] bg-[#00e676]/20 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[7.5px] text-[#00e676] font-bold">LINK (PLAYER)</div>
                    <div className="text-[6.5px] text-gray-300">
                      16x16px bounding box + 14x14px inner tile collision box with (X,Y) coordinates.
                    </div>
                  </div>
                </div>

                {/* Sword Strike */}
                <div className="p-2 bg-[#1a1708] border border-[#ffd700]/40 rounded flex items-start gap-2">
                  <div className="w-4 h-4 border-2 border-[#ffd700] bg-[#ffd700]/30 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[7.5px] text-[#ffd700] font-bold">SWORD ATTACK</div>
                    <div className="text-[6.5px] text-gray-300">
                      16x16px weapon reach box projecting in front of Link during sword slashes.
                    </div>
                  </div>
                </div>

                {/* Enemies */}
                <div className="p-2 bg-[#1a0c10] border border-[#ff2850]/40 rounded flex items-start gap-2">
                  <div className="w-4 h-4 border-2 border-[#ff2850] bg-[#ff2850]/20 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[7.5px] text-[#ff2850] font-bold">ENEMIES & BOSS</div>
                    <div className="text-[6.5px] text-gray-300">
                      16x16px standard, 32x32px Aquamentus boss. Shows current HP tag & center point.
                    </div>
                  </div>
                </div>

                {/* Projectiles */}
                <div className="p-2 bg-[#0c151a] border border-[#00e5ff]/40 rounded flex items-start gap-2">
                  <div className="w-4 h-4 border-2 border-[#00e5ff] bg-[#00e5ff]/20 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[7.5px] text-[#00e5ff] font-bold">PROJECTILES</div>
                    <div className="text-[6.5px] text-gray-300">
                      8x8px boxes: Cyan for sword beams & boomerangs; Orange for enemy rocks & fireballs.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Combat Particle System Spec */}
            <div className="p-3 bg-[#13131c] border border-gray-800 rounded flex flex-col gap-2">
              <h4 className="text-[8px] text-[#58f898] uppercase font-bold tracking-wider flex items-center gap-1.5">
                <Sparkles size={11} />
                <span>COMBAT PARTICLE SYSTEM (ACTIVE)</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[6.5px]">
                <div className="p-2 bg-[#101914] border border-[#58f898]/30 rounded">
                  <div className="text-[#58f898] font-bold text-[7px] mb-0.5">⚔ SWORD STRIKE FLAIR</div>
                  <div className="text-gray-300">
                    Directional slash arc crescent, 4-point impact star glint, and dynamic spark shower with tier-based color palette (Gold/Cyan/Emerald).
                  </div>
                </div>

                <div className="p-2 bg-[#1a1214] border border-[#ff3864]/30 rounded">
                  <div className="text-[#ff3864] font-bold text-[7px] mb-0.5">💥 ENEMY DEFEAT EXPLOSIONS</div>
                  <div className="text-gray-300">
                    Authentic expanding NES 4-direction smoke cloud poofs, diamond shockwave ring, flying fiery embers, floating spirit wisps, and bone/ink debris.
                  </div>
                </div>

                <div className="p-2 bg-[#1b1c10] border border-[#f8b800]/30 rounded">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[#f8b800] font-bold text-[7px]">🎶 SECRET DISCOVERY CHIPTUNE & PUZZLES</div>
                    <button
                      onClick={() => chiptune.playSecret()}
                      className="px-2 py-0.5 bg-[#f8b800] hover:bg-[#ffe066] text-black font-bold text-[7px] rounded cursor-pointer transition-colors shadow"
                    >
                      ▶ TEST SECRET CHIME
                    </button>
                  </div>
                  <div className="text-gray-300 space-y-1">
                    <div>
                      • <strong className="text-[#f8b800]">Pushable Blocks:</strong> In rooms with puzzle insignia (e.g. Level-1 Crypt D1_2, Rocky Foothills O6_7), push against the engraved block to uncover secret subterranean staircases!
                    </div>
                    <div>
                      • <strong className="text-[#3cbcfc]">Bombable Walls & Rocks:</strong> Drop bombs next to cracked walls (Level-1 Armory D1_4) or fractured rocks (Eastern Coast O8_7) to blast open passages and trigger the Ricoh 2A03 discovery fanfare.
                    </div>
                    <div>
                      • <strong className="text-[#a8e6cf]">Hidden Push Trigger:</strong> As a hidden secret trick, you can also steadily push against bombable walls or fractured rocks to breach them and trigger the iconic secret found chime without needing bombs!
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* In-Game Hotkey Tip */}
            <div className="p-2 bg-[#161622] border border-[#3b3b55] rounded text-[7px] text-gray-300 flex items-center justify-between">
              <span className="text-gray-400">QUICK HOTKEY:</span>
              <span className="text-[#f8b800] font-mono font-bold">
                PRESS [F3] OR [`] TO TOGGLE DURING GAMEPLAY
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Input Monitor & Reset Action */}
      <div className="mt-3 pt-3 border-t border-gray-800 flex flex-wrap items-center justify-between gap-2">
        {/* Live Input Tester Strip */}
        <div className="flex items-center gap-1 text-[7px]">
          <span className="text-gray-400 mr-1">TEST:</span>
          <span
            className={`px-1 py-0.5 border ${
              activeInputs.up ? 'border-[#58f898] bg-[#004d20] text-[#58f898]' : 'border-gray-800 text-gray-600'
            }`}
          >
            ↑
          </span>
          <span
            className={`px-1 py-0.5 border ${
              activeInputs.down ? 'border-[#58f898] bg-[#004d20] text-[#58f898]' : 'border-gray-800 text-gray-600'
            }`}
          >
            ↓
          </span>
          <span
            className={`px-1 py-0.5 border ${
              activeInputs.left ? 'border-[#58f898] bg-[#004d20] text-[#58f898]' : 'border-gray-800 text-gray-600'
            }`}
          >
            ←
          </span>
          <span
            className={`px-1 py-0.5 border ${
              activeInputs.right ? 'border-[#58f898] bg-[#004d20] text-[#58f898]' : 'border-gray-800 text-gray-600'
            }`}
          >
            →
          </span>
          <span
            className={`px-1 py-0.5 border ${
              activeInputs.attack ? 'border-[#f83800] bg-[#4d0000] text-[#ff6644]' : 'border-gray-800 text-gray-600'
            }`}
          >
            A
          </span>
          <span
            className={`px-1 py-0.5 border ${
              activeInputs.item ? 'border-[#3cbcfc] bg-[#002f4d] text-[#3cbcfc]' : 'border-gray-800 text-gray-600'
            }`}
          >
            B
          </span>
          <span
            className={`px-1 py-0.5 border ${
              activeInputs.pause ? 'border-[#f8b800] bg-[#4d3800] text-[#f8b800]' : 'border-gray-800 text-gray-600'
            }`}
          >
            START
          </span>
          <span
            className={`px-1 py-0.5 border ${
              activeInputs.select ? 'border-[#e0e0e0] bg-[#333] text-white' : 'border-gray-800 text-gray-600'
            }`}
          >
            SEL
          </span>
        </div>

        {/* Reset to Defaults button */}
        <button
          onClick={handleResetDefaults}
          className="flex items-center gap-1 px-2.5 py-1 bg-[#252530] hover:bg-[#3a3a4c] text-[8px] text-gray-300 hover:text-white border border-gray-600 cursor-pointer"
        >
          <RotateCcw size={10} />
          <span>{resetMessage ? 'DEFAULTS RESTORED!' : 'RESET DEFAULTS'}</span>
        </button>
      </div>
    </div>
  );
};
