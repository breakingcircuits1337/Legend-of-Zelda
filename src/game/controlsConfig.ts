/**
 * The Legend of Zelda NES - Controls Configuration & Remapping Manager
 * Supports custom keyboard bindings, gamepad buttons, and localStorage persistence.
 */

export interface KeyBindings {
  up: string[];
  down: string[];
  left: string[];
  right: string[];
  attack: string[]; // Sword / Action
  item: string[];   // Secondary B-Item
  pause: string[];  // Start / Inventory Pause
  select: string[]; // Select / Cycle Item
}

export interface GamepadBindings {
  attack: number[];   // Button indices, default: [0] (A / Cross)
  item: number[];     // Button indices, default: [1, 2] (B / Square / X)
  pause: number[];    // Button indices, default: [9] (Start / Options)
  select: number[];   // Button indices, default: [8] (Select / Share)
  dpadUp: number;     // Button index 12
  dpadDown: number;   // Button index 13
  dpadLeft: number;   // Button index 14
  dpadRight: number;  // Button index 15
}

export interface ControlsConfig {
  keyboard: KeyBindings;
  gamepad: GamepadBindings;
  showHitboxDebug?: boolean;
}

export const DEFAULT_CONTROLS_CONFIG: ControlsConfig = {
  keyboard: {
    up: ['ArrowUp', 'KeyW'],
    down: ['ArrowDown', 'KeyS'],
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    attack: ['KeyZ', 'KeyJ'],
    item: ['KeyX', 'KeyK'],
    pause: ['Enter', 'Escape'],
    select: ['ShiftLeft', 'ShiftRight', 'Space'],
  },
  gamepad: {
    attack: [0],
    item: [1, 2],
    pause: [9],
    select: [8],
    dpadUp: 12,
    dpadDown: 13,
    dpadLeft: 14,
    dpadRight: 15,
  },
  showHitboxDebug: false,
};

const STORAGE_KEY = 'zelda_nes_controls_config';

/**
 * Load controls configuration from localStorage with safe fallback to defaults
 */
export function loadControlsConfig(): ControlsConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONTROLS_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      keyboard: {
        ...DEFAULT_CONTROLS_CONFIG.keyboard,
        ...(parsed.keyboard || {}),
      },
      gamepad: {
        ...DEFAULT_CONTROLS_CONFIG.gamepad,
        ...(parsed.gamepad || {}),
      },
      showHitboxDebug: typeof parsed.showHitboxDebug === 'boolean' ? parsed.showHitboxDebug : false,
    };
  } catch {
    return DEFAULT_CONTROLS_CONFIG;
  }
}

/**
 * Save controls configuration to localStorage
 */
export function saveControlsConfig(config: ControlsConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    console.warn('Failed to save controls config to localStorage');
  }
}

/**
 * Format a keyboard code into human-friendly label
 */
export function formatKeyCode(code: string): string {
  if (code.startsWith('Key')) return code.slice(3).toUpperCase();
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `NUM ${code.slice(6)}`;
  switch (code) {
    case 'ArrowUp':
      return '↑ UP';
    case 'ArrowDown':
      return '↓ DOWN';
    case 'ArrowLeft':
      return '← LEFT';
    case 'ArrowRight':
      return '→ RIGHT';
    case 'Space':
      return 'SPACE';
    case 'Enter':
      return 'ENTER';
    case 'Escape':
      return 'ESC';
    case 'ShiftLeft':
      return 'L-SHIFT';
    case 'ShiftRight':
      return 'R-SHIFT';
    case 'ControlLeft':
      return 'L-CTRL';
    case 'ControlRight':
      return 'R-CTRL';
    case 'AltLeft':
      return 'L-ALT';
    case 'AltRight':
      return 'R-ALT';
    case 'Tab':
      return 'TAB';
    case 'Backspace':
      return 'BKSP';
    default:
      return code.toUpperCase();
  }
}

/**
 * Format a gamepad button index into human-friendly label
 */
export function formatGamepadButton(btnIndex: number): string {
  switch (btnIndex) {
    case 0:
      return 'BTN 0 (A / ✕)';
    case 1:
      return 'BTN 1 (B / ○)';
    case 2:
      return 'BTN 2 (X / □)';
    case 3:
      return 'BTN 3 (Y / △)';
    case 4:
      return 'BTN 4 (LB / L1)';
    case 5:
      return 'BTN 5 (RB / R1)';
    case 6:
      return 'BTN 6 (LT / L2)';
    case 7:
      return 'BTN 7 (RT / R2)';
    case 8:
      return 'BTN 8 (SELECT)';
    case 9:
      return 'BTN 9 (START)';
    case 10:
      return 'BTN 10 (L3)';
    case 11:
      return 'BTN 11 (R3)';
    case 12:
      return 'DPAD UP';
    case 13:
      return 'DPAD DOWN';
    case 14:
      return 'DPAD LEFT';
    case 15:
      return 'DPAD RIGHT';
    default:
      return `BTN ${btnIndex}`;
  }
}
