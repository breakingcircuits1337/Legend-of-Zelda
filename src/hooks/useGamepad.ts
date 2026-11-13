/**
 * HTML5 Gamepad API Hook
 * Supports standard Xbox, PlayStation, Switch Pro, and retro USB controllers
 */

import { useEffect, useState, useRef } from 'react';
import { GamepadBindings, DEFAULT_CONTROLS_CONFIG } from '../game/controlsConfig';

export interface GamepadControls {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  a: boolean; // Attack / Select
  b: boolean; // Item / Back
  start: boolean; // Pause / Inventory
  select: boolean; // Switch item
}

export function useGamepad() {
  const [controllerName, setControllerName] = useState<string | null>(null);

  useEffect(() => {
    const handleConnected = (e: GamepadEvent) => {
      setControllerName(e.gamepad.id || 'Standard Gamepad');
    };

    const handleDisconnected = () => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const anyPad = Array.from(pads).find((p) => p !== null);
      setControllerName(anyPad ? anyPad.id : null);
    };

    window.addEventListener('gamepadconnected', handleConnected);
    window.addEventListener('gamepaddisconnected', handleDisconnected);

    // Initial check
    if (navigator.getGamepads) {
      const pads = navigator.getGamepads();
      const anyPad = Array.from(pads).find((p) => p !== null);
      if (anyPad) {
        setControllerName(anyPad.id);
      }
    }

    return () => {
      window.removeEventListener('gamepadconnected', handleConnected);
      window.removeEventListener('gamepaddisconnected', handleDisconnected);
    };
  }, []);

  /**
   * Poll active gamepad state with customizable bindings
   */
  const pollGamepad = (bindings?: GamepadBindings): GamepadControls => {
    const activeBindings = bindings || DEFAULT_CONTROLS_CONFIG.gamepad;

    const controls: GamepadControls = {
      up: false,
      down: false,
      left: false,
      right: false,
      a: false,
      b: false,
      start: false,
      select: false,
    };

    if (!navigator.getGamepads) return controls;

    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
      const pad = gamepads[i];
      if (!pad) continue;

      // D-Pad buttons (customizable)
      const dpadUp = pad.buttons[activeBindings.dpadUp]?.pressed;
      const dpadDown = pad.buttons[activeBindings.dpadDown]?.pressed;
      const dpadLeft = pad.buttons[activeBindings.dpadLeft]?.pressed;
      const dpadRight = pad.buttons[activeBindings.dpadRight]?.pressed;

      // Analog Stick (Axis 0: X, Axis 1: Y)
      const stickX = pad.axes[0] || 0;
      const stickY = pad.axes[1] || 0;
      const deadzone = 0.45;

      if (dpadUp || stickY < -deadzone) controls.up = true;
      if (dpadDown || stickY > deadzone) controls.down = true;
      if (dpadLeft || stickX < -deadzone) controls.left = true;
      if (dpadRight || stickX > deadzone) controls.right = true;

      // Customizable Action Buttons
      if (activeBindings.attack.some((b) => pad.buttons[b]?.pressed)) {
        controls.a = true;
      }

      if (activeBindings.item.some((b) => pad.buttons[b]?.pressed)) {
        controls.b = true;
      }

      if (activeBindings.pause.some((b) => pad.buttons[b]?.pressed)) {
        controls.start = true;
      }

      if (activeBindings.select.some((b) => pad.buttons[b]?.pressed)) {
        controls.select = true;
      }
    }

    return controls;
  };

  return {
    controllerName,
    pollGamepad,
  };
}
