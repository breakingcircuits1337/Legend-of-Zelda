/**
 * The Legend of Zelda NES - Complete Web Recreation
 * Authentic 8-bit Pixel Art, 2A03 Chiptune Audio, 60 FPS Engine,
 * Gamepad Support, Touch Controls, PWA Offline Play & Local Storage Save System
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine, SCREEN_WIDTH, SCREEN_HEIGHT } from './game/engine';
import { GameState, SaveSlotData, PlayerState, ItemType, Direction, WeatherType, TransitionMode } from './types';
import { TitleScreen } from './components/TitleScreen';
import { HUD } from './components/HUD';
import { FileSelectScreen } from './components/FileSelectScreen';
import { InventoryModal } from './components/InventoryModal';
import { TouchControls } from './components/TouchControls';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { useGamepad } from './hooks/useGamepad';
import { chiptune } from './audio/chiptune';
import { saveGameProgress } from './game/saveSystem';
import { ControlsConfig, loadControlsConfig, saveControlsConfig, formatKeyCode } from './game/controlsConfig';
import { OverworldViewportGridOverlay } from './components/OverworldMinimap';
import {
  auditAllScreenEntryTriggers,
  validateTriggerAgainstScreenBoundary,
  computeTriggerWarpPoint,
  TriggerDryRunResult,
} from './game/entryTriggerDebug';
import { ALL_SCREENS } from './game/worldData';
import {
  BOSS_TRIFORCE_BATTLES,
  getTriforceByScreenId,
  TOTAL_TRIFORCE_PIECES,
} from './game/bossTriforceSystem';
import {
  Volume2,
  VolumeX,
  Gamepad2,
  Tv,
  Smartphone,
  RotateCcw,
  Sparkles,
  Trophy,
  Bug,
  Home,
  CloudSun,
  CloudRain,
  CloudLightning,
  Grid,
  ScanSearch,
  Zap,
} from 'lucide-react';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [gameState, setGameState] = useState<GameState>(GameState.TITLE);
  const [activeSlot, setActiveSlot] = useState<SaveSlotData | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [showTouchControls, setShowTouchControls] = useState<boolean>(true);
  const [crtFilter, setCrtFilter] = useState<boolean>(true);
  const [transitionMode, setTransitionMode] = useState<TransitionMode>('fade');
  const [weather, setWeather] = useState<WeatherType>(WeatherType.CLEAR);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(60);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showGridOverlay, setShowGridOverlay] = useState<boolean>(() => {
    try {
      return localStorage.getItem('zelda_persistent_minimap_overlay_v1') === 'true';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('zelda_persistent_minimap_overlay_v1', String(showGridOverlay));
    } catch {
      // Ignore storage failures
    }
  }, [showGridOverlay]);
  const [visitedScreens, setVisitedScreens] = useState<string[]>(['O7_7', '7,7']);
  const [showEntryTriggerDebug, setShowEntryTriggerDebug] = useState<boolean>(false);
  const [selectedTriggerId, setSelectedTriggerId] = useState<string | null>(null);
  const [triggerValidationResult, setTriggerValidationResult] = useState<TriggerDryRunResult | null>(null);
  const [warpFeedback, setWarpFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  // Controls Configuration (Keyboard & Gamepad Remapping)
  const [controlsConfig, setControlsConfig] = useState<ControlsConfig>(() => loadControlsConfig());
  const controlsConfigRef = useRef(controlsConfig);
  useEffect(() => {
    controlsConfigRef.current = controlsConfig;
    if (engineRef.current) {
      engineRef.current.showHitboxDebug = controlsConfig.showHitboxDebug ?? false;
    }
  }, [controlsConfig]);

  const currentScreenId = engineRef.current?.currentScreen.id;
  useEffect(() => {
    setTriggerValidationResult(null);
    setSelectedTriggerId(null);
    if (!showEntryTriggerDebug) {
      setWarpFeedback(null);
    }
    if (engineRef.current) {
      engineRef.current.debugTriggerValidation = null;
      engineRef.current.showEntryTriggerDebug = showEntryTriggerDebug;
      if (showEntryTriggerDebug) {
        auditAllScreenEntryTriggers(ALL_SCREENS, {
          logO47Dump: true,
          playerBox: {
            screenId: engineRef.current.currentScreen.id,
            x: engineRef.current.player.x,
            y: engineRef.current.player.y,
            width: 14,
            height: 14,
          },
        });
      }
    }
  }, [showEntryTriggerDebug, currentScreenId]);

  // Toggle Hitbox Collision Debug Overlay
  const handleToggleHitboxDebug = useCallback(() => {
    chiptune.playKey();
    setControlsConfig((prev) => {
      const next = {
        ...prev,
        showHitboxDebug: !prev.showHitboxDebug,
      };
      saveControlsConfig(next);
      if (engineRef.current) {
        engineRef.current.showHitboxDebug = next.showHitboxDebug ?? false;
      }
      return next;
    });
  }, []);

  const handleToggleEntryTriggerDebug = useCallback(() => {
    chiptune.playKey();
    setShowEntryTriggerDebug((prev) => {
      const next = !prev;
      if (engineRef.current) {
        engineRef.current.showEntryTriggerDebug = next;
      }
      return next;
    });
  }, []);

  // Global F3/Backquote (Hitboxes), F4/T (Entry Triggers), and G/M (16x8 Mini-Map Overlay) hotkeys
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'F3' || e.code === 'Backquote') {
        e.preventDefault();
        handleToggleHitboxDebug();
      } else if (e.code === 'F4' || e.code === 'KeyT') {
        if (gameState !== GameState.REGISTER_NAME) {
          e.preventDefault();
          handleToggleEntryTriggerDebug();
        }
      } else if (e.code === 'KeyG' || e.code === 'KeyM') {
        if (gameState !== GameState.REGISTER_NAME) {
          setShowGridOverlay((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleToggleHitboxDebug, handleToggleEntryTriggerDebug, gameState]);

  // Gamepad hook
  const { controllerName, pollGamepad } = useGamepad();

  // Keyboard input maps
  const keysPressedRef = useRef<Record<string, boolean>>({});

  // Initialize or return engine
  const initEngine = useCallback((canvas: HTMLCanvasElement) => {
    if (engineRef.current) return engineRef.current;
    const engine = new GameEngine(canvas);
    engine.showHitboxDebug = controlsConfigRef.current.showHitboxDebug ?? false;
    engine.showEntryTriggerDebug = showEntryTriggerDebug;
    engine.transitionMode = transitionMode;
    engineRef.current = engine;

    engine.onStateChange = (newState) => {
      setGameState(newState);
    };

    engine.onPlayerUpdate = (p) => {
      setPlayerState({ ...p });
    };

    engine.onWeatherChange = (newWeather) => {
      setWeather(newWeather);
    };

    engine.onVisitedScreensChange = (visited) => {
      setVisitedScreens([...visited]);
    };

    engine.start();
    return engine;
  }, []);

  // Initialize engine on mount
  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = initEngine(canvasRef.current);

    if (activeSlot && engine && !engine.activeSlot) {
      engine.loadSaveSlot(activeSlot);
      setPlayerState({ ...engine.player });
    }

    // Periodic FPS and status update
    const fpsInterval = setInterval(() => {
      if (engineRef.current) {
        setFps(engineRef.current.currentFps);
      }
    }, 500);

    return () => {
      clearInterval(fpsInterval);
      if (engineRef.current) {
        engineRef.current.stop();
        engineRef.current = null;
      }
    };
  }, [initEngine, activeSlot]);

  // Sync Input (Keyboard + Gamepad + Touch) into engine at 60 FPS
  useEffect(() => {
    let frameId: number;

    const updateControls = () => {
      const engine = engineRef.current;
      if (engine) {
        const cfg = controlsConfigRef.current;
        // Poll Gamepad with custom button bindings
        const gp = pollGamepad(cfg.gamepad);
        const k = keysPressedRef.current;

        // Direction merge with custom keyboard & gamepad bindings
        const up = cfg.keyboard.up.some((code) => k[code]) || gp.up;
        const down = cfg.keyboard.down.some((code) => k[code]) || gp.down;
        const left = cfg.keyboard.left.some((code) => k[code]) || gp.left;
        const right = cfg.keyboard.right.some((code) => k[code]) || gp.right;

        // Button merge: A (Sword)
        const attack = cfg.keyboard.attack.some((code) => k[code]) || gp.a;

        // Button merge: B (Item)
        const item = cfg.keyboard.item.some((code) => k[code]) || gp.b;

        // If touch controls are active, merge them without overriding keyboard
        if (!engine.input.up) engine.input.up = up;
        else if (!cfg.keyboard.up.some((code) => k[code]) && !gp.up && !touchDirRef.current.up) engine.input.up = false;

        if (!engine.input.down) engine.input.down = down;
        else if (!cfg.keyboard.down.some((code) => k[code]) && !gp.down && !touchDirRef.current.down) engine.input.down = false;

        if (!engine.input.left) engine.input.left = left;
        else if (!cfg.keyboard.left.some((code) => k[code]) && !gp.left && !touchDirRef.current.left) engine.input.left = false;

        if (!engine.input.right) engine.input.right = right;
        else if (!cfg.keyboard.right.some((code) => k[code]) && !gp.right && !touchDirRef.current.right) engine.input.right = false;

        engine.input.attack = attack || touchBtnRef.current.a;
        engine.input.item = item || touchBtnRef.current.b;

        // Gamepad Start button toggle pause
        if (gp.start && !prevStartRef.current) {
          handleTogglePause();
        }
        prevStartRef.current = gp.start;

        // Gamepad Select button cycle items
        if (gp.select && !prevSelectRef.current) {
          handleCycleItem();
        }
        prevSelectRef.current = gp.select;
      }

      frameId = requestAnimationFrame(updateControls);
    };

    frameId = requestAnimationFrame(updateControls);
    return () => cancelAnimationFrame(frameId);
  }, [pollGamepad]);

  const prevStartRef = useRef(false);
  const prevSelectRef = useRef(false);
  const touchDirRef = useRef({ up: false, down: false, left: false, right: false });
  const touchBtnRef = useRef({ a: false, b: false });

  // Keyboard Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Audio unlock on interaction
      chiptune.resume();

      const cfg = controlsConfigRef.current;

      // Pause toggle: check configured pause keys or universal Escape
      if (cfg.keyboard.pause.includes(e.code) || e.code === 'Escape') {
        e.preventDefault();
        handleTogglePause();
        return;
      }

      // Cycle item: check configured select keys
      if (cfg.keyboard.select.includes(e.code)) {
        e.preventDefault();
        handleCycleItem();
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
  }, [gameState]);

  // Touch event callbacks
  const handleTouchDir = useCallback((dir: { up: boolean; down: boolean; left: boolean; right: boolean }) => {
    touchDirRef.current = dir;
    if (engineRef.current) {
      engineRef.current.input.up = dir.up;
      engineRef.current.input.down = dir.down;
      engineRef.current.input.left = dir.left;
      engineRef.current.input.right = dir.right;
    }
  }, []);

  const handleTouchA = useCallback((pressed: boolean) => {
    touchBtnRef.current.a = pressed;
    if (engineRef.current) {
      engineRef.current.input.attack = pressed;
    }
  }, []);

  const handleTouchB = useCallback((pressed: boolean) => {
    touchBtnRef.current.b = pressed;
    if (engineRef.current) {
      engineRef.current.input.item = pressed;
    }
  }, []);

  const handleTogglePause = () => {
    if (gameState === GameState.PLAYING) {
      chiptune.playKey();
      setGameState(GameState.INVENTORY_PAUSE);
      if (engineRef.current) {
        engineRef.current.gameState = GameState.INVENTORY_PAUSE;
      }
    } else if (gameState === GameState.INVENTORY_PAUSE) {
      chiptune.playKey();
      setGameState(GameState.PLAYING);
      if (engineRef.current) {
        engineRef.current.gameState = GameState.PLAYING;
      }
    }
  };

  const handleCycleItem = () => {
    if (!engineRef.current) return;
    const p = engineRef.current.player;
    const unlockedItems: ItemType[] = [];
    if (p.inventory.hasBoomerang) unlockedItems.push(ItemType.BOOMERANG);
    if (p.inventory.bombs > 0) unlockedItems.push(ItemType.BOMB);
    if (p.inventory.hasBow) unlockedItems.push(ItemType.BOW);
    if (p.inventory.hasCandle) unlockedItems.push(ItemType.CANDLE_BLUE);

    if (unlockedItems.length > 0) {
      const idx = unlockedItems.indexOf(p.bItem);
      const nextItem = unlockedItems[(idx + 1) % unlockedItems.length];
      p.bItem = nextItem;
      chiptune.playKey();
      setPlayerState({ ...p });
    }
  };

  // Slot Selection
  const handleSelectSlot = (slot: SaveSlotData) => {
    setActiveSlot(slot);
    setGameState(GameState.PLAYING);

    if (slot.visitedScreens && slot.visitedScreens.length > 0) {
      setVisitedScreens([...slot.visitedScreens]);
    } else {
      setVisitedScreens(['O7_7', '7,7', slot.currentScreen]);
    }

    let engine = engineRef.current;
    if (!engine && canvasRef.current) {
      engine = initEngine(canvasRef.current);
    }

    if (engine) {
      engine.loadSaveSlot(slot);
      setPlayerState({ ...engine.player });
    }
  };

  // Save Progress
  const handleSaveProgress = () => {
    if (!engineRef.current || !activeSlot) return;
    saveGameProgress(
      activeSlot.id,
      engineRef.current.player,
      engineRef.current.currentScreen.id,
      undefined,
      Array.from(engineRef.current.visitedScreens),
      Array.from(engineRef.current.collectedHeartContainers)
    );
    setSaveMessage('PROGRESS SAVED TO BATTERY RAM!');
    setTimeout(() => setSaveMessage(null), 2500);
  };

  // Continue after Game Over
  const handleContinue = () => {
    if (!engineRef.current || !activeSlot) return;
    chiptune.stopGameOverTheme();
    chiptune.stopDeathChime();
    chiptune.playKey();
    const p = engineRef.current.player;
    p.hearts = Math.min(p.maxHearts, 6); // Classic NES continue refills 3 hearts while retaining upgraded maxHearts!
    p.knockback = { x: 0, y: 0, duration: 0 };
    p.invincibleTimer = 0;
    p.isAttacking = false;
    engineRef.current.resetFade();
    engineRef.current.loadScreen('O7_7', 120, 112);
    setGameState(GameState.PLAYING);
    engineRef.current.gameState = GameState.PLAYING;
    setPlayerState({ ...p });
    engineRef.current.fadeIn(0.04);
  };

  return (
    <div className="w-screen h-screen bg-[#0a0a0f] text-[#fcfcfc] flex flex-col items-center justify-between overflow-hidden select-none font-['Press_Start_2P',monospace]">
      {/* Offline Status */}
      <OfflineIndicator />

      {/* Top Navigation / Controls Bar */}
      <header className="w-full max-w-4xl px-3 py-2 flex items-center justify-between border-b border-gray-800 bg-[#101016] text-[9px] z-30">
        <div className="flex items-center gap-2">
          <span className="text-[#f8b800] font-bold text-xs">▲</span>
          <span className="hidden sm:inline text-[#f8b800] tracking-wider font-bold">
            ZELDA NES
          </span>
          <span className="bg-[#1f1f28] text-green-400 px-1.5 py-0.5 rounded text-[8px] border border-gray-700">
            {fps} FPS
          </span>
          {controllerName && (
            <span
              className="flex items-center gap-1 bg-[#152e15] text-[#58f898] px-1.5 py-0.5 rounded text-[8px] border border-green-800"
              title={controllerName}
            >
              <Gamepad2 size={10} />
              <span className="hidden md:inline">GAMEPAD</span>
            </span>
          )}
        </div>

        {/* Global Toolbar Options */}
        <div className="flex items-center gap-2">
          {/* Return to Title Screen Button */}
          {gameState !== GameState.TITLE && (
            <button
              onClick={() => {
                chiptune.playKey();
                setGameState(GameState.TITLE);
                chiptune.playBgm('title');
              }}
              className="p-1.5 rounded border border-gray-700 bg-[#15151a] hover:bg-[#252530] text-gray-300 hover:text-[#f8b800] cursor-pointer flex items-center gap-1 text-[8px]"
              title="Return to Title Screen"
            >
              <Home size={12} />
              <span className="hidden sm:inline">TITLE</span>
            </button>
          )}

          {/* CRT Scanline Filter Toggle */}
          <button
            onClick={() => setCrtFilter(!crtFilter)}
            className={`p-1.5 rounded border transition-colors cursor-pointer ${
              crtFilter
                ? 'bg-[#2b2b3b] border-white text-[#58f898]'
                : 'bg-[#15151a] border-gray-700 text-gray-400 hover:text-white'
            }`}
            title="Toggle CRT Scanline TV Effect"
          >
            <Tv size={12} />
          </button>

          {/* Sound Mute Toggle */}
          <button
            onClick={() => {
              const muted = chiptune.toggleMute();
              setIsMuted(muted);
            }}
            className="p-1.5 rounded border border-gray-700 bg-[#15151a] hover:bg-[#252530] text-gray-200 cursor-pointer"
            title="Toggle 2A03 Chiptune Audio"
          >
            {isMuted ? <VolumeX size={12} className="text-red-400" /> : <Volume2 size={12} className="text-green-400" />}
          </button>

          {/* Screen Transition Effect Toggle */}
          <button
            onClick={() => {
              chiptune.playKey();
              const MODES: TransitionMode[] = ['fade', 'iris', 'tile_flip', 'wipe', 'slide'];
              const currIdx = MODES.indexOf(transitionMode);
              const next = MODES[(currIdx + 1) % MODES.length];
              setTransitionMode(next);
              if (engineRef.current) {
                engineRef.current.transitionMode = next;
              }
            }}
            className={`p-1.5 rounded border transition-colors cursor-pointer flex items-center gap-1 text-[8px] ${
              transitionMode !== 'slide'
                ? 'bg-[#2b2b3b] border-[#f8b800] text-[#f8b800]'
                : 'bg-[#15151a] border-gray-700 text-gray-400 hover:text-white'
            }`}
            title={`Screen Transition Effect: ${
              transitionMode === 'fade'
                ? 'Smooth Black Fade (NES Authentic)'
                : transitionMode === 'iris'
                ? 'Circular Aperture Iris-In/Out'
                : transitionMode === 'tile_flip'
                ? '8-Bit 16x11 Tile-Flip Mosaic Cascade'
                : transitionMode === 'wipe'
                ? 'Horizontal Shutter Curtain Wipe'
                : 'Classic Screen Scroll Slide'
            } (Click to Cycle)`}
          >
            <Sparkles size={12} />
            <span className="hidden sm:inline">
              {transitionMode === 'fade'
                ? 'FADE'
                : transitionMode === 'iris'
                ? 'IRIS'
                : transitionMode === 'tile_flip'
                ? 'FLIP'
                : transitionMode === 'wipe'
                ? 'WIPE'
                : 'SLIDE'}
            </span>
          </button>

          {/* Hitbox Debug Overlay Toggle */}
          <button
            onClick={handleToggleHitboxDebug}
            className={`p-1.5 rounded border transition-colors cursor-pointer flex items-center gap-1 text-[8px] ${
              controlsConfig.showHitboxDebug
                ? 'bg-[#3a0014] border-[#ff3864] text-[#ff3864] shadow-[0_0_8px_rgba(255,56,100,0.5)]'
                : 'bg-[#15151a] border-gray-700 text-gray-400 hover:text-white'
            }`}
            title="Toggle Real-Time Hitbox Collision Debug Overlay (Press F3 or ~)"
          >
            <Bug size={12} className={controlsConfig.showHitboxDebug ? 'animate-pulse' : ''} />
            <span className="hidden sm:inline">HITBOXES</span>
          </button>

          {/* Temporary Entry Trigger Volume Debug Overlay Toggle */}
          <button
            id="entry-trigger-debug-btn"
            onClick={handleToggleEntryTriggerDebug}
            className={`p-1.5 rounded border transition-colors cursor-pointer flex items-center gap-1 text-[8px] ${
              showEntryTriggerDebug
                ? 'bg-[#002933] border-[#00e5ff] text-[#00e5ff] shadow-[0_0_8px_rgba(0,229,255,0.5)]'
                : 'bg-[#15151a] border-gray-700 text-gray-400 hover:text-white'
            }`}
            title="Toggle Invisible Entry/Exit Trigger Volume Debugger (Press F4 or T)"
          >
            <ScanSearch size={12} className={showEntryTriggerDebug ? 'animate-pulse' : ''} />
            <span className="hidden sm:inline">TRIGGERS</span>
          </button>

          {/* 16x8 Overworld Persistent Mini-Map Overlay Toggle */}
          <button
            onClick={() => {
              chiptune.playKey();
              setShowGridOverlay((prev) => !prev);
            }}
            className={`p-1.5 rounded border transition-colors cursor-pointer flex items-center gap-1 text-[8px] ${
              showGridOverlay
                ? 'bg-[#153528] border-[#58f898] text-[#58f898] shadow-[0_0_8px_rgba(88,248,152,0.4)]'
                : 'bg-[#15151a] border-gray-700 text-gray-400 hover:text-white'
            }`}
            title="Toggle Persistent 16x8 Overworld Mini-Map Overlay (Press G or M)"
          >
            <Grid size={12} className={showGridOverlay ? 'animate-pulse' : ''} />
            <span className="hidden sm:inline">16x8 MAP</span>
          </button>

          {/* Overworld Dynamic Weather Controller Toggle */}
          <button
            onClick={() => {
              if (engineRef.current) {
                const next = engineRef.current.toggleWeather();
                setWeather(next);
              }
            }}
            className={`p-1.5 rounded border transition-colors cursor-pointer flex items-center gap-1 text-[8px] ${
              weather === WeatherType.STORM
                ? 'bg-[#1e1035] border-[#a855f7] text-[#c084fc] shadow-[0_0_8px_rgba(168,85,247,0.4)]'
                : weather === WeatherType.RAIN
                ? 'bg-[#0f2438] border-[#38bdf8] text-[#38bdf8] shadow-[0_0_8px_rgba(56,189,248,0.4)]'
                : 'bg-[#15151a] border-gray-700 text-gray-400 hover:text-white'
            }`}
            title={`Overworld Dynamic Weather: ${weather} (Click to Cycle: Clear / Rain / Storm)`}
          >
            {weather === WeatherType.STORM ? (
              <CloudLightning size={12} className="text-[#c084fc] animate-pulse" />
            ) : weather === WeatherType.RAIN ? (
              <CloudRain size={12} className="text-[#38bdf8]" />
            ) : (
              <CloudSun size={12} className="text-amber-400" />
            )}
            <span className="hidden sm:inline">{weather}</span>
          </button>

          {/* Touch Controls Toggle */}
          <button
            onClick={() => setShowTouchControls(!showTouchControls)}
            className={`p-1.5 rounded border transition-colors cursor-pointer ${
              showTouchControls
                ? 'bg-[#2b2b3b] border-white text-white'
                : 'bg-[#15151a] border-gray-700 text-gray-400 hover:text-white'
            }`}
            title="Toggle Touch Controls"
          >
            <Smartphone size={12} />
          </button>

          {/* PWA Install Button */}
          <PWAInstallButton />
        </div>
      </header>

      {/* Main Game Stage Container */}
      <main className="flex-1 w-full max-w-2xl flex flex-col items-center justify-center p-2 relative">
        {/* Save Confirmation Toast */}
        {saveMessage && (
          <div className="absolute top-4 z-50 bg-[#008088] text-white border-2 border-white px-4 py-2 text-[9px] shadow-2xl animate-bounce">
            {saveMessage}
          </div>
        )}

        {/* Retro 8-Bit Title Screen */}
        {gameState === GameState.TITLE && (
          <div className="w-full flex items-center justify-center">
            <TitleScreen
              onStart={() => {
                setGameState(GameState.FILE_SELECT);
              }}
            />
          </div>
        )}

        {/* File Select Screen Mode */}
        {gameState === GameState.FILE_SELECT && (
          <div className="w-full flex items-center justify-center">
            <FileSelectScreen
              onSelectSlot={handleSelectSlot}
              onBackToTitle={() => {
                setGameState(GameState.TITLE);
                chiptune.playBgm('title');
              }}
            />
          </div>
        )}

        {/* Active Playing / Pause / GameOver / Victory Screen Container (Always mounted to keep canvas active) */}
        <div
          className={`relative w-full max-w-[560px] aspect-[256/240] flex flex-col bg-black border-4 border-[#333] shadow-[0_0_20px_rgba(0,0,0,0.8)] overflow-hidden rounded ${
            gameState === GameState.FILE_SELECT || gameState === GameState.TITLE ? 'hidden' : 'flex'
          }`}
        >
            {/* Authentic Top HUD */}
            {playerState && engineRef.current && (
              <HUD
                player={playerState}
                currentScreen={engineRef.current.currentScreen}
                visitedScreens={visitedScreens}
                showGridOverlay={showGridOverlay}
                onToggleGridOverlay={() => setShowGridOverlay((prev) => !prev)}
              />
            )}

            {/* Viewport Canvas (256x176) */}
            <div className="relative flex-1 w-full h-full bg-black">
              <canvas
                ref={canvasRef}
                width={SCREEN_WIDTH}
                height={SCREEN_HEIGHT}
                className="w-full h-full object-contain block image-rendering-pixelated"
              />

              {/* Persistent 16x8 Overworld Mini-Map Overlay on Viewport */}
              {showGridOverlay && engineRef.current && (
                <OverworldViewportGridOverlay
                  currentScreen={engineRef.current.currentScreen}
                  visitedScreens={visitedScreens}
                />
              )}

              {/* Authentic CRT Scanline Overlay */}
              {crtFilter && (
                <div
                  className="pointer-events-none absolute inset-0 z-20"
                  style={{
                    backgroundImage:
                      'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.04), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.04))',
                    backgroundSize: '100% 2px, 3px 100%',
                  }}
                />
              )}

              {/* Pause / Inventory Subscreen */}
              {gameState === GameState.INVENTORY_PAUSE && playerState && (
                <InventoryModal
                  player={playerState}
                  controlsConfig={controlsConfig}
                  onUpdateControlsConfig={setControlsConfig}
                  gamepadName={controllerName}
                  onSelectBItem={(item) => {
                    if (engineRef.current) {
                      engineRef.current.player.bItem = item;
                      setPlayerState({ ...engineRef.current.player });
                    }
                  }}
                  onResume={handleTogglePause}
                  onSave={handleSaveProgress}
                  onQuit={() => {
                    setGameState(GameState.FILE_SELECT);
                    chiptune.stopBgm();
                  }}
                />
              )}

              {/* Game Over Screen */}
              {gameState === GameState.GAME_OVER && (
                <div className="absolute inset-0 bg-black/95 z-40 flex flex-col items-center justify-center p-6 text-center">
                  <h2 className="text-[#d82800] text-base mb-4 tracking-widest uppercase font-bold animate-pulse">
                    GAME OVER
                  </h2>
                  <p className="text-[9px] text-gray-400 mb-6">
                    RETURN OF GANON IS IMMINENT
                  </p>
                  <div className="flex flex-col gap-3 w-48">
                    <button
                      onClick={handleContinue}
                      className="px-3 py-2 bg-[#d82800] hover:bg-[#f83800] text-white text-[9px] border-2 border-white cursor-pointer"
                    >
                      CONTINUE
                    </button>
                    <button
                      onClick={() => {
                        if (engineRef.current && activeSlot) {
                          saveGameProgress(
                            activeSlot.id,
                            engineRef.current.player,
                            engineRef.current.currentScreen.id,
                            engineRef.current.activeSlot?.deaths ?? activeSlot.deaths,
                            Array.from(engineRef.current.visitedScreens),
                            Array.from(engineRef.current.collectedHeartContainers)
                          );
                        }
                        setGameState(GameState.FILE_SELECT);
                        chiptune.stopGameOverTheme();
                        chiptune.stopBgm();
                        chiptune.stopDeathChime();
                        chiptune.playBgm('title');
                      }}
                      className="px-3 py-2 bg-[#1a1a1a] hover:bg-[#333] text-gray-300 text-[9px] border border-gray-600 cursor-pointer"
                    >
                      SAVE & QUIT
                    </button>
                  </div>
                </div>
              )}

              {/* Victory Screen */}
              {gameState === GameState.VICTORY && (() => {
                const screenId = engineRef.current?.currentScreen.id ?? '';
                const currentTriforce = getTriforceByScreenId(screenId);
                const collectedIds = new Set(playerState?.collectedTriforceIds ?? []);
                const totalPieces = Math.max(
                  playerState?.inventory.triforcePieces ?? 0,
                  collectedIds.size
                );
                const allCollected = totalPieces >= TOTAL_TRIFORCE_PIECES;

                return (
                  <div className="absolute inset-0 bg-black/95 z-40 flex flex-col items-center justify-center p-5 text-center">
                    <div className="flex items-center gap-3 mb-2">
                      {BOSS_TRIFORCE_BATTLES.map((b) => {
                        const owned = collectedIds.has(b.triforceId);
                        return (
                          <div
                            key={b.triforceId}
                            className={`flex flex-col items-center px-2 py-1 border ${
                              owned
                                ? 'border-[#f8b800] bg-[#2a2000] text-[#f8b800]'
                                : 'border-gray-700 bg-[#101010] text-gray-600'
                            }`}
                          >
                            <span className={`text-2xl leading-none ${owned ? 'animate-pulse' : ''}`}>
                              ▲
                            </span>
                            <span className="text-[6px] mt-1">LVL {b.level}</span>
                          </div>
                        );
                      })}
                    </div>

                    <h2 className="text-[#f8b800] text-xs sm:text-sm mb-2 tracking-widest uppercase font-bold">
                      {allCollected
                        ? 'TRIFORCE OF WISDOM COMPLETE!'
                        : `${currentTriforce?.triforceName.toUpperCase() ?? 'TRIFORCE PIECE'} OBTAINED!`}
                    </h2>
                    <p className="text-[8px] text-gray-300 leading-relaxed max-w-sm mb-4">
                      {allCollected
                        ? `ALL ${TOTAL_TRIFORCE_PIECES} TRIFORCE PIECES RECOVERED! YOU VANQUISHED EVERY LABYRINTH GUARDIAN!`
                        : `YOU RECOVERED LEVEL ${currentTriforce?.level ?? engineRef.current?.currentScreen.levelNumber ?? 1}'S TRIFORCE PIECE (${totalPieces}/${TOTAL_TRIFORCE_PIECES}).`}
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-2.5">
                      <button
                        id="continue-after-triforce-btn"
                        onClick={() => {
                          chiptune.playKey();
                          engineRef.current?.continueFromVictory();
                        }}
                        className="px-4 py-2 bg-[#007828] hover:bg-[#58f898] text-white hover:text-black text-[9px] border-2 border-white cursor-pointer"
                      >
                        CONTINUE QUEST
                      </button>
                      <button
                        onClick={() => {
                          setGameState(GameState.FILE_SELECT);
                          chiptune.stopBgm();
                        }}
                        className="px-4 py-2 bg-[#008088] hover:bg-[#00e8d8] text-white hover:text-black text-[9px] border-2 border-white cursor-pointer"
                      >
                        FILE SELECT
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

        {/* Temporary Entry Trigger Diagnostics Panel */}
        {showEntryTriggerDebug && engineRef.current && gameState !== GameState.TITLE && gameState !== GameState.FILE_SELECT && (() => {
          const engine = engineRef.current;
          const allTriggers = engine.getEntryTriggerVolumes();
          const activeTriggers = allTriggers.filter((t) => t.isRevealed);
          const hiddenCount = allTriggers.length - activeTriggers.length;
          const allAudits = auditAllScreenEntryTriggers(ALL_SCREENS, { logO47Dump: false });
          const brokenScreens = allAudits.filter((a) => !a.isValid);
          const o47Audit = allAudits.find((a) => a.screenId === 'O4_7');
          const o57ToO47 = allAudits
            .find((a) => a.screenId === 'O5_7')
            ?.triggers.find((t) => t.targetScreenId === 'O4_7');
          const livePlayer = engine.player;

          const effectiveSelectedTrigger =
            activeTriggers.find((t) => t.id === selectedTriggerId) ?? activeTriggers[0] ?? null;

          const warpPreview = effectiveSelectedTrigger
            ? computeTriggerWarpPoint(effectiveSelectedTrigger, engine.currentScreen)
            : null;

          const activeValidation =
            triggerValidationResult &&
            effectiveSelectedTrigger &&
            triggerValidationResult.screenId === engine.currentScreen.id &&
            triggerValidationResult.triggerId === effectiveSelectedTrigger.id
              ? triggerValidationResult
              : null;

          const handleValidateSelectedTrigger = () => {
            if (!effectiveSelectedTrigger) return;
            chiptune.playKey();
            const result = validateTriggerAgainstScreenBoundary(
              effectiveSelectedTrigger,
              engine.currentScreen
            );
            setSelectedTriggerId(effectiveSelectedTrigger.id);
            setTriggerValidationResult(result);
            engine.debugTriggerValidation = result;
          };

          const handleWarpToSelectedTrigger = () => {
            if (!effectiveSelectedTrigger) return;
            const res = engine.warpToTriggerVolume(effectiveSelectedTrigger.id);
            setWarpFeedback({ ok: res.ok, message: res.message });
            if (res.ok && !res.transitionStarted) {
              chiptune.playKey();
            }
          };

          return (
            <div
              id="entry-trigger-inspector"
              className="w-full max-w-[560px] mt-2 bg-[#07131a] border border-[#00e5ff]/60 rounded px-3 py-2 text-[8px] text-[#d6f9ff] shadow-lg"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#00e5ff]/25 pb-1.5 mb-1.5">
                <span className="text-[#00e5ff] font-bold">
                  ENTRY TRIGGER DEBUGGER • {engine.currentScreen.id} ({engine.currentScreen.name})
                </span>
                <span className={brokenScreens.length === 0 ? 'text-[#58f898]' : 'text-[#ff1744]'}>
                  {brokenScreens.length === 0
                    ? `ALL ${allAudits.length} SCREENS VALID`
                    : `${brokenScreens.length} BROKEN TRIGGER(S)`}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5 text-[7px]">
                <span className={o47Audit?.isValid && o57ToO47?.isReachable ? 'text-[#58f898]' : 'text-[#ff1744]'}>
                  COORD 4,7 (O4_7):{' '}
                  {o47Audit?.isValid && o57ToO47?.isReachable
                    ? `MAPPED & REACHABLE (O5_7 L→O4_7 @ x<=4, y=${o57ToO47.walkableRects[0]?.y}..${
                        (o57ToO47.walkableRects[0]?.y ?? 0) +
                        o57ToO47.walkableRects.reduce((acc, r) => acc + r.height, 0)
                      })`
                    : 'INVALID / UNREACHABLE'}
                </span>
                <span
                  id="entry-trigger-player-hitbox"
                  className="text-[#ffeb3b] font-mono tabular-nums"
                >
                  LINK: X={Math.round(livePlayer.x)} Y={Math.round(livePlayer.y)} W=14 H=14
                </span>
              </div>

              <div className="max-h-32 overflow-y-auto border border-[#00e5ff]/25 rounded bg-[#040c11]">
                <table
                  id="entry-trigger-table"
                  data-testid="entry-trigger-table"
                  className="w-full border-collapse text-left font-mono text-[9px] sm:text-[10px]"
                >
                  <thead className="sticky top-0 bg-[#0a1d26] text-[#00e5ff] border-b border-[#00e5ff]/30 text-[7px] font-['Press_Start_2P',monospace]">
                    <tr>
                      <th className="py-1 px-1.5 w-8 text-center">DIR</th>
                      <th className="py-1 px-1.5">TRIGGER</th>
                      <th className="py-1 px-1.5 text-right">X</th>
                      <th className="py-1 px-1.5 text-right">Y</th>
                      <th className="py-1 px-1.5 text-right">W</th>
                      <th className="py-1 px-1.5 text-right">H</th>
                      <th className="py-1 px-1.5">RULE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#00e5ff]/15">
                    {activeTriggers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-2 px-2 text-center text-gray-400 text-[8px]">
                          No active trigger volumes on this screen.
                        </td>
                      </tr>
                    ) : (
                      activeTriggers.map((t) => {
                        const ok =
                          t.kind !== 'unmapped_open_edge' &&
                          t.targetExists &&
                          (t.kind !== 'edge_exit' || t.isReachable);
                        const isRowSelected = effectiveSelectedTrigger?.id === t.id;
                        const expectedSet = new Set(t.expectedDirections);
                        const activeArrowClass = !ok
                          ? 'text-[#ff6b8b] font-bold drop-shadow-[0_0_2px_rgba(255,107,139,0.9)]'
                          : 'text-[#58f898] font-bold drop-shadow-[0_0_2px_rgba(88,248,152,0.9)]';
                        const inactiveArrowClass = 'text-gray-700/60';
                        const dirSummary = t.expectedDirections.map((d) => d.toUpperCase()).join('/');

                        return (
                          <tr
                            key={t.id}
                            data-trigger-id={t.id}
                            data-selected={isRowSelected ? 'true' : 'false'}
                            onClick={() => {
                              chiptune.playKey();
                              setSelectedTriggerId(t.id);
                              setTriggerValidationResult(null);
                              engine.debugTriggerValidation = null;
                            }}
                            className={`cursor-pointer transition-colors ${
                              !ok
                                ? isRowSelected
                                  ? 'bg-[#3d0016] text-[#ff6b8b] ring-1 ring-inset ring-[#ff6b8b]'
                                  : 'bg-[#2a000d]/80 text-[#ff6b8b]'
                                : isRowSelected
                                ? 'bg-[#0f2d3d] text-white ring-1 ring-inset ring-[#00e5ff]'
                                : 'hover:bg-[#0b202b] text-[#d6f9ff]'
                            }`}
                          >
                            <td className="py-1 px-1.5">
                              {/* Small 4-way Visual Orientation Indicator (Up, Down, Left, Right) */}
                              <div
                                className="grid grid-cols-3 grid-rows-3 place-items-center w-6 h-6 mx-auto rounded-sm border border-[#00e5ff]/25 bg-[#040b10] leading-none text-[6px]"
                                data-testid={`trigger-orientation-${t.id}`}
                                data-expected-directions={t.expectedDirections.join(',')}
                                title={`Expected player movement: ${dirSummary}`}
                                aria-label={`Expected movement orientation: ${dirSummary}`}
                              >
                                <span className="col-start-1 row-start-1" />
                                <span
                                  data-dir="up"
                                  data-active={expectedSet.has('up') ? 'true' : 'false'}
                                  className={`col-start-2 row-start-1 ${
                                    expectedSet.has('up') ? activeArrowClass : inactiveArrowClass
                                  }`}
                                >
                                  ▲
                                </span>
                                <span className="col-start-3 row-start-1" />
                                <span
                                  data-dir="left"
                                  data-active={expectedSet.has('left') ? 'true' : 'false'}
                                  className={`col-start-1 row-start-2 ${
                                    expectedSet.has('left') ? activeArrowClass : inactiveArrowClass
                                  }`}
                                >
                                  ◄
                                </span>
                                <span className="col-start-2 row-start-2 text-[4px] text-[#00e5ff]/50">
                                  ■
                                </span>
                                <span
                                  data-dir="right"
                                  data-active={expectedSet.has('right') ? 'true' : 'false'}
                                  className={`col-start-3 row-start-2 ${
                                    expectedSet.has('right') ? activeArrowClass : inactiveArrowClass
                                  }`}
                                >
                                  ►
                                </span>
                                <span className="col-start-1 row-start-3" />
                                <span
                                  data-dir="down"
                                  data-active={expectedSet.has('down') ? 'true' : 'false'}
                                  className={`col-start-2 row-start-3 ${
                                    expectedSet.has('down') ? activeArrowClass : inactiveArrowClass
                                  }`}
                                >
                                  ▼
                                </span>
                                <span className="col-start-3 row-start-3" />
                              </div>
                            </td>
                            <td className="py-1 px-1.5 font-bold whitespace-nowrap">
                              {isRowSelected && <span className="text-[#00e5ff] mr-1">▸</span>}
                              {t.label}
                            </td>
                            <td
                              data-col="x"
                              className="py-1 px-1.5 text-right tabular-nums text-[#9cf4ff]"
                            >
                              {t.thresholdRect.x}
                            </td>
                            <td
                              data-col="y"
                              className="py-1 px-1.5 text-right tabular-nums text-[#9cf4ff]"
                            >
                              {t.thresholdRect.y}
                            </td>
                            <td
                              data-col="w"
                              className="py-1 px-1.5 text-right tabular-nums text-[#58f898]"
                            >
                              {t.thresholdRect.width}
                            </td>
                            <td
                              data-col="h"
                              className="py-1 px-1.5 text-right tabular-nums text-[#58f898]"
                            >
                              {t.thresholdRect.height}
                            </td>
                            <td className="py-1 px-1.5 text-gray-300 whitespace-nowrap">
                              {t.ruleNote}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Validation & Warp Action Bar */}
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[6.5px] text-gray-400">
                  {effectiveSelectedTrigger
                    ? `SELECTED: ${effectiveSelectedTrigger.label}`
                    : 'NO ACTIVE TRIGGER SELECTED'}
                  {hiddenCount > 0 && (
                    <span className="ml-2 text-[#f8b800]/80">
                      (+{hiddenCount} hidden until active)
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    id="warp-to-trigger-btn"
                    data-testid="warp-to-trigger-btn"
                    disabled={!effectiveSelectedTrigger || !warpPreview?.canTeleport}
                    title={
                      warpPreview?.canTeleport
                        ? `Teleport Link to (${warpPreview.x}, ${warpPreview.y}) inside ${effectiveSelectedTrigger?.label}`
                        : warpPreview?.reason ?? 'Select an active trigger volume'
                    }
                    onClick={handleWarpToSelectedTrigger}
                    className={`px-2 py-1 rounded border text-[7px] font-bold transition-colors flex items-center gap-1 ${
                      effectiveSelectedTrigger && warpPreview?.canTeleport
                        ? 'bg-[#082e1e] border-[#58f898] text-[#58f898] hover:bg-[#58f898] hover:text-black cursor-pointer'
                        : 'bg-[#101820] border-gray-700 text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    <Zap size={10} />
                    WARP TO SCREEN
                  </button>

                  <button
                    id="validate-trigger-btn"
                    data-testid="validate-trigger-btn"
                    disabled={!effectiveSelectedTrigger}
                    onClick={handleValidateSelectedTrigger}
                    className={`px-2 py-1 rounded border text-[7px] font-bold transition-colors ${
                      effectiveSelectedTrigger
                        ? 'bg-[#082c38] border-[#00e5ff] text-[#00e5ff] hover:bg-[#00e5ff] hover:text-black cursor-pointer'
                        : 'bg-[#101820] border-gray-700 text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    DRY-RUN VALIDATE BOUNDS
                  </button>
                </div>
              </div>

              {warpFeedback && (
                <div
                  id="entry-trigger-warp-status"
                  data-testid="entry-trigger-warp-status"
                  className={`mt-1 px-2 py-1 rounded border text-[6.5px] font-mono ${
                    warpFeedback.ok
                      ? 'bg-[#052414] border-[#58f898]/60 text-[#9effc7]'
                      : 'bg-[#2a000d] border-[#ff1744]/60 text-[#ff8aa1]'
                  }`}
                >
                  {warpFeedback.message}
                </div>
              )}

              {activeValidation && (
                <div
                  id="entry-trigger-validation-result"
                  data-testid="entry-trigger-validation-result"
                  data-validation-status={activeValidation.status}
                  className={`mt-1.5 p-2 rounded border text-[7px] ${
                    activeValidation.status === 'FAIL'
                      ? 'bg-[#2a000d] border-[#ff1744] text-[#ff8aa1]'
                      : activeValidation.status === 'WARN'
                      ? 'bg-[#241a00] border-[#f8b800] text-[#ffe082]'
                      : 'bg-[#052414] border-[#58f898] text-[#9effc7]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 font-bold mb-1">
                    <span>
                      [{activeValidation.status}] {activeValidation.triggerLabel}
                    </span>
                    <span>{activeValidation.summary}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 font-mono text-[9px]">
                    {activeValidation.checks.map((chk) => (
                      <div key={chk.name} className="flex items-start gap-1">
                        <span className={chk.passed ? 'text-[#58f898]' : 'text-[#f8b800]'}>
                          {chk.passed ? '✓' : '⚠'}
                        </span>
                        <span>
                          <strong>{chk.name}:</strong> {chk.detail}
                        </span>
                      </div>
                    ))}
                  </div>

                  {(activeValidation.deadZoneRects.length > 0 ||
                    activeValidation.solidOverlapRects.length > 0) && (
                    <div className="mt-1 pt-1 border-t border-white/15 font-mono text-[8.5px] flex flex-wrap gap-2">
                      {activeValidation.deadZoneRects.length > 0 && (
                        <span className="text-[#ff6b8b]">
                          DEAD-ZONES:{' '}
                          {activeValidation.deadZoneRects
                            .map((r) => `[${r.x},${r.y} ${r.width}x${r.height}]`)
                            .join(' ')}
                        </span>
                      )}
                      {activeValidation.solidOverlapRects.length > 0 && (
                        <span className="text-[#f8b800]">
                          WALL OVERLAPS:{' '}
                          {activeValidation.solidOverlapRects
                            .map((r) => `[${r.x},${r.y} ${r.width}x${r.height}]`)
                            .join(' ')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </main>

      {/* Bottom Virtual Touch Controls (Shown if on touch device or toggled) */}
      {showTouchControls && gameState === GameState.PLAYING && (
        <footer className="w-full bg-[#111116] border-t border-[#252530] z-30">
          <TouchControls
            onDirectionChange={handleTouchDir}
            onButtonA={handleTouchA}
            onButtonB={handleTouchB}
            onButtonStart={handleTogglePause}
            onButtonSelect={handleCycleItem}
          />
        </footer>
      )}

      {/* Desktop Keyboard & Gamepad Hints */}
      {!showTouchControls && gameState === GameState.PLAYING && (
        <footer className="w-full py-1.5 bg-[#0e0e14] border-t border-gray-800 text-[8px] text-gray-400 text-center flex flex-wrap justify-center gap-3 px-2">
          <span>[{controlsConfig.keyboard.attack.map(formatKeyCode).join('/')}] Sword</span>
          <span>[{controlsConfig.keyboard.item.map(formatKeyCode).join('/')}] Item</span>
          <span>[{controlsConfig.keyboard.pause.map(formatKeyCode).join('/')}] Pause/Menu</span>
          <span>[{controlsConfig.keyboard.select.map(formatKeyCode).join('/')}] Switch Item</span>
          {controllerName && (
            <span className="text-[#58f898] flex items-center gap-1">
              <Gamepad2 size={10} /> Active
            </span>
          )}
        </footer>
      )}
    </div>
  );
}
