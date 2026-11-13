/**
 * The Legend of Zelda NES - Global Weather Effect Controller
 * Simulates authentic 8-bit NES dynamic weather (Clear, Gentle Rain, Thunderstorm)
 * in outdoor overworld areas with pixel-perfect rain streaks, ground splashes,
 * atmospheric ambient tinting, lightning flashes, and 2A03 chiptune sound synthesis.
 */

import { WeatherType, WeatherState } from '../types';
import { NES_COLORS } from './sprites';
import { chiptune } from '../audio/chiptune';

export const SCREEN_WIDTH = 256;
export const SCREEN_HEIGHT = 176;

interface RainDrop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  length: number;
  color: string;
  splashY: number; // Ground contact Y where drop splashes
}

interface RainSplash {
  x: number;
  y: number;
  life: number;
  color: string;
}

export class WeatherController {
  public weatherType: WeatherType = WeatherType.CLEAR;
  public targetWeatherType: WeatherType = WeatherType.CLEAR;
  public intensity: number = 0; // Current rendered intensity: 0.0 to 1.0
  public targetIntensity: number = 0;
  public windSpeed: number = -0.8; // Horizontal wind drift
  public targetWindSpeed: number = -0.8;

  // Weather cycle timer (in 60fps frames: ~20-40 seconds per phase)
  public weatherTimer: number = 1400;
  public minWeatherDuration: number = 1200; // 20s
  public maxWeatherDuration: number = 2400; // 40s

  // Thunderstorm lightning state
  public lightningTimer: number = 400;
  public lightningFlash: number = 0; // 0 to 1.0
  private lightningSubFlicker: number = 0;

  // Rain particles
  private drops: RainDrop[] = [];
  private splashes: RainSplash[] = [];
  private maxDrops: number = 64;

  // Current outdoor state
  public isOutdoor: boolean = true;

  // Callback to engine/UI
  public onWeatherChange?: (type: WeatherType) => void;

  // NES rain palette
  private readonly rainColors = [
    NES_COLORS.WHITE,
    NES_COLORS.LIGHT_BLUE,
    '#80b0ff',
    '#5878a8',
  ];

  constructor(initialWeather: WeatherType = WeatherType.CLEAR) {
    this.setWeather(initialWeather, true);
  }

  /**
   * Set target weather state directly
   */
  public setWeather(type: WeatherType, forceImmediate: boolean = false) {
    this.weatherType = type;
    this.targetWeatherType = type;

    switch (type) {
      case WeatherType.CLEAR:
        this.targetIntensity = 0;
        this.targetWindSpeed = -0.4;
        break;
      case WeatherType.RAIN:
        this.targetIntensity = 0.65;
        this.targetWindSpeed = -0.9;
        break;
      case WeatherType.STORM:
        this.targetIntensity = 1.0;
        this.targetWindSpeed = -1.8;
        break;
    }

    if (forceImmediate) {
      this.intensity = this.targetIntensity;
      this.windSpeed = this.targetWindSpeed;
      if (this.intensity === 0) {
        this.drops = [];
        this.splashes = [];
      }
    }

    this.resetWeatherTimer();
    this.onWeatherChange?.(this.weatherType);
  }

  /**
   * Cycle weather to next state (Clear -> Rain -> Storm -> Clear)
   */
  public toggleWeather(): WeatherType {
    let next: WeatherType;
    if (this.weatherType === WeatherType.CLEAR) {
      next = WeatherType.RAIN;
    } else if (this.weatherType === WeatherType.RAIN) {
      next = WeatherType.STORM;
    } else {
      next = WeatherType.CLEAR;
    }
    this.setWeather(next);
    return next;
  }

  /**
   * Reset random countdown timer for next weather roll
   */
  private resetWeatherTimer() {
    this.weatherTimer =
      this.minWeatherDuration +
      Math.floor(Math.random() * (this.maxWeatherDuration - this.minWeatherDuration));
  }

  /**
   * Randomly transition weather based on authentic overworld probabilities
   */
  private rollNextWeather() {
    const roll = Math.random();

    if (this.weatherType === WeatherType.CLEAR) {
      // 55% chance of rain rolling in, 45% remains clear
      if (roll < 0.55) {
        this.setWeather(WeatherType.RAIN);
      } else {
        this.resetWeatherTimer();
      }
    } else if (this.weatherType === WeatherType.RAIN) {
      // 45% clear up, 30% stay rain, 25% intensify into storm
      if (roll < 0.45) {
        this.setWeather(WeatherType.CLEAR);
      } else if (roll < 0.75) {
        this.resetWeatherTimer(); // Keep raining
      } else {
        this.setWeather(WeatherType.STORM);
      }
    } else if (this.weatherType === WeatherType.STORM) {
      // 60% calm to gentle rain, 40% disperse to clear
      if (roll < 0.6) {
        this.setWeather(WeatherType.RAIN);
      } else {
        this.setWeather(WeatherType.CLEAR);
      }
    }
  }

  /**
   * Main per-frame update loop (called at 60 FPS from GameEngine)
   */
  public update(isOutdoor: boolean) {
    this.isOutdoor = isOutdoor;

    // 1. Advance automatic weather cycle timer
    this.weatherTimer--;
    if (this.weatherTimer <= 0) {
      this.rollNextWeather();
    }

    // 2. Smoothly lerp intensity and wind speed toward targets
    if (this.intensity < this.targetIntensity) {
      this.intensity = Math.min(this.targetIntensity, this.intensity + 0.015);
    } else if (this.intensity > this.targetIntensity) {
      this.intensity = Math.max(this.targetIntensity, this.intensity - 0.012);
    }

    this.windSpeed += (this.targetWindSpeed - this.windSpeed) * 0.04;

    // 3. Update Audio Ambience
    // Rain sound only audible when Link is outdoors and rain is active
    const isRainingOutdoors = this.isOutdoor && this.intensity > 0.04;
    chiptune.updateRainAmbience(isRainingOutdoors, this.intensity);

    // If indoors (dungeons or caves), freeze/clear rain simulation
    if (!this.isOutdoor) {
      this.drops = [];
      this.splashes = [];
      this.lightningFlash = 0;
      return;
    }

    // 4. Update Thunderstorm Lightning
    if (this.weatherType === WeatherType.STORM && this.intensity > 0.6) {
      this.lightningTimer--;
      if (this.lightningTimer <= 0) {
        // Trigger sudden NES lightning strike
        this.lightningFlash = 1.0;
        this.lightningSubFlicker = 3;
        this.lightningTimer = 350 + Math.floor(Math.random() * 550); // ~6 - 15 seconds
        chiptune.playThunder();
      }
    }

    // Decay lightning flash
    if (this.lightningFlash > 0) {
      this.lightningFlash -= 0.18;
      if (this.lightningFlash < 0) this.lightningFlash = 0;

      // Realistic 8-bit double-strobe shutter
      if (this.lightningSubFlicker > 0) {
        this.lightningSubFlicker--;
        if (this.lightningSubFlicker === 1) {
          this.lightningFlash = 0.85; // Second lightning burst
        }
      }
    }

    // 5. Spawn & Update 8-bit Rain Drops
    if (this.intensity > 0.02) {
      const activeTargetCount = Math.floor(this.intensity * this.maxDrops);

      // Spawn new raindrops up to activeTargetCount
      while (this.drops.length < activeTargetCount) {
        this.drops.push(this.createDrop(true));
      }

      // If intensity decreased, trim excess drops
      if (this.drops.length > activeTargetCount && this.drops.length > 0) {
        this.drops.pop();
      }

      // Update falling drops
      for (let i = this.drops.length - 1; i >= 0; i--) {
        const drop = this.drops[i];
        drop.x += drop.vx;
        drop.y += drop.vy;

        // Check if drop hit ground contact height or went off-screen
        if (drop.y >= drop.splashY || drop.y >= SCREEN_HEIGHT - 4 || drop.x < -10 || drop.x > SCREEN_WIDTH + 10) {
          // Create 8-bit splash on ground
          if (drop.y < SCREEN_HEIGHT - 6) {
            this.splashes.push({
              x: drop.x,
              y: Math.min(SCREEN_HEIGHT - 6, drop.splashY),
              life: 3,
              color: drop.color,
            });
          }

          // Respawn drop at top
          if (this.drops.length <= activeTargetCount) {
            this.resetDrop(drop);
          } else {
            this.drops.splice(i, 1);
          }
        }
      }
    } else {
      this.drops = [];
    }

    // 6. Update Ground Splashes
    for (let i = this.splashes.length - 1; i >= 0; i--) {
      const s = this.splashes[i];
      s.life--;
      if (s.life <= 0) {
        this.splashes.splice(i, 1);
      }
    }
  }

  /**
   * Helper to initialize a new raindrop
   */
  private createDrop(randomY: boolean = false): RainDrop {
    const drop: RainDrop = {
      x: Math.random() * (SCREEN_WIDTH + 40) - 20,
      y: randomY ? Math.random() * SCREEN_HEIGHT : -10 - Math.random() * 20,
      vx: this.windSpeed + (Math.random() * 0.4 - 0.2),
      vy: 5.2 + Math.random() * 2.2,
      length: 3 + Math.floor(Math.random() * 3),
      color: this.rainColors[Math.floor(Math.random() * this.rainColors.length)],
      splashY: 48 + Math.random() * (SCREEN_HEIGHT - 54),
    };
    return drop;
  }

  /**
   * Helper to recycle an existing raindrop to the top of screen
   */
  private resetDrop(drop: RainDrop) {
    drop.x = Math.random() * (SCREEN_WIDTH + 40) - 20;
    drop.y = -8 - Math.random() * 12;
    drop.vx = this.windSpeed + (Math.random() * 0.4 - 0.2);
    drop.vy = 5.2 + Math.random() * 2.2;
    drop.length = 3 + Math.floor(Math.random() * 3);
    drop.color = this.rainColors[Math.floor(Math.random() * this.rainColors.length)],
    drop.splashY = 48 + Math.random() * (SCREEN_HEIGHT - 54);
  }

  /**
   * Render 8-bit rain streaks, splashes, ambient overworld tint, and lightning flash
   */
  public render(ctx: CanvasRenderingContext2D) {
    if (!this.isOutdoor || this.intensity <= 0.01) return;

    ctx.save();

    // 1. Atmospheric Overworld Ambient Tint
    // Soft moody darkening that intensifies during rain/storms
    const tintAlpha = Math.min(0.24, this.intensity * 0.18);
    ctx.fillStyle = `rgba(12, 20, 48, ${tintAlpha})`;
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    // 2. Render 8-bit Ground Splashes
    for (const splash of this.splashes) {
      ctx.fillStyle = splash.color;
      const sx = Math.round(splash.x);
      const sy = Math.round(splash.y);

      if (splash.life >= 3) {
        // Initial impact pixel
        ctx.fillRect(sx, sy, 1, 1);
      } else if (splash.life === 2) {
        // Horizontal 8-bit water ripple expansion
        ctx.fillRect(sx - 1, sy, 1, 1);
        ctx.fillRect(sx + 1, sy, 1, 1);
      } else {
        // Fading outer droplets
        ctx.fillRect(sx - 2, sy - 1, 1, 1);
        ctx.fillRect(sx + 2, sy - 1, 1, 1);
      }
    }

    // 3. Render 8-bit Rain Streaks
    ctx.lineWidth = 1;
    for (const drop of this.drops) {
      const sx = Math.round(drop.x);
      const sy = Math.round(drop.y);
      // Slope matched to velocity vector
      const slantX = Math.round(drop.vx * (drop.length / drop.vy));
      const ex = sx + slantX;
      const ey = sy + drop.length;

      ctx.strokeStyle = drop.color;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }

    // 4. Render Thunderstorm Lightning Flash
    if (this.lightningFlash > 0) {
      const flashAlpha = Math.min(0.55, this.lightningFlash * 0.55);
      ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
      ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    }

    ctx.restore();
  }

  /**
   * Return snapshot of current weather state
   */
  public getState(): WeatherState {
    return {
      type: this.weatherType,
      intensity: this.intensity,
      targetIntensity: this.targetIntensity,
      windSpeed: this.windSpeed,
      lightningFlash: this.lightningFlash,
      isOutdoor: this.isOutdoor,
    };
  }
}
