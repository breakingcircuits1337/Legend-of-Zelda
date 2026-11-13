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
  const [showGridOverlay, setShowGridOverlay] = useState<boolean>(false);
  const [visitedScreens, setVisitedScreens] = useState<string[]>(['O7_7', '7,7']);

  // Controls Configuration (Keyboard & Gamepad Remapping)
  const [controlsConfig, setControlsConfig] = useState<ControlsConfig>(() => loadControlsConfig());
  const controlsConfigRef = useRef(controlsConfig);
  useEffect(() => {
    controlsConfigRef.current = controlsConfig;
    if (engineRef.current) {
      engineRef.current.showHitboxDebug = controlsConfig.showHitboxDebug ?? false;
    }
  }, [controlsConfig]);

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

  // Global F3 or Backquote (~) debug hotkey and G hotkey for 8x8 Grid Overlay
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'F3' || e.code === 'Backquote') {
        e.preventDefault();
        handleToggleHitboxDebug();
      } else if (e.code === 'KeyG') {
        if (gameState !== GameState.REGISTER_NAME) {
          setShowGridOverlay((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleToggleHitboxDebug, gameState]);

  // Gamepad hook
  const { controllerName, pollGamepad } = useGamepad();

  // Keyboard input maps
  const keysPressedRef = useRef<Record<string, boolean>>({});

  // Initialize or return engine
  const initEngine = useCallback((canvas: HTMLCanvasElement) => {
    if (engineRef.current) return engineRef.current;
    const engine = new GameEngine(canvas);
    engine.showHitboxDebug = controlsConfigRef.current.showHitboxDebug ?? false;
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
      Array.from(engineRef.current.visitedScreens)
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
    p.hearts = 6; // 3 full hearts
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

          {/* 8x8 Overworld Transparent Grid Overlay Toggle */}
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
            title="Toggle Transparent 8x8 Overworld Grid Overlay (Press G)"
          >
            <Grid size={12} className={showGridOverlay ? 'animate-pulse' : ''} />
            <span className="hidden sm:inline">8x8 GRID</span>
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

              {/* Transparent 8x8 Overworld Grid Overlay on Viewport with Fog of War */}
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
              {gameState === GameState.VICTORY && (
                <div className="absolute inset-0 bg-black/95 z-40 flex flex-col items-center justify-center p-6 text-center">
                  <div className="text-4xl text-[#f8b800] mb-2 animate-bounce">▲</div>
                  <h2 className="text-[#f8b800] text-xs sm:text-sm mb-3 tracking-widest uppercase font-bold">
                    TRIFORCE OF WISDOM OBTAINED!
                  </h2>
                  <p className="text-[8px] text-gray-300 leading-relaxed max-w-sm mb-6">
                    YOU HAVE SAVED HYRULE FROM LEVEL-1: THE EAGLE! THE HERO LINK STANDS VICTORIOUS.
                  </p>
                  <button
                    onClick={() => {
                      setGameState(GameState.FILE_SELECT);
                      chiptune.stopBgm();
                    }}
                    className="px-4 py-2 bg-[#008088] hover:bg-[#00e8d8] text-white hover:text-black text-[9px] border-2 border-white cursor-pointer"
                  >
                    RETURN TO FILE SELECT
                  </button>
                </div>
              )}
            </div>
          </div>
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
