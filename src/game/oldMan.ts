/**
 * The Legend of Zelda NES - Old Man NPC Class
 *
 * Authentic 8-bit cave hermit NPC that:
 * 1. Appears inside caves and subterranean sanctums flanked by flickering torches.
 * 2. Displays iconic randomized wisdom messages using an authentic 8-bit typewriter text engine
 *    with 2A03 character typing blips.
 * 3. Presents sacred items on a floating altar pedestal and triggers item acquisition
 *    with triumphant fanfare when Link interacts.
 */

import { Direction, ItemType, PlayerState } from '../types';
import { NES_COLORS, drawOldMan, drawTorch, drawItem } from './sprites';
import { chiptune } from '../audio/chiptune';
import { ParticleSystem } from './particles';

// Iconic NES The Legend of Zelda Old Man wisdom quotes
export const ICONIC_OLD_MAN_MESSAGES: string[] = [
  "IT'S DANGEROUS TO GO\nALONE! TAKE THIS.",
  "IT'S A SECRET\nTO EVERYBODY.",
  "TAKE ANY ONE YOU\nWANT.",
  "MASTER USING IT AND\nYOU CAN HAVE THIS.",
  "RESTORE YOUR SPIRIT\nAND RECEIVE POWER.",
  "DODONGO DISLIKES\nSMOKE.",
  "EASTMOST PENINSULA\nIS THE SECRET.",
  "THERE ARE SECRETS\nWHERE FAIRIES DON'T LIVE.",
  "A SECRET IS IN\nTHE TREE AT THE DEAD END.",
  "SPECTACLE ROCK IS\nAN ENTRANCE TO DEATH.",
  "MEET THE OLD MAN\nAT THE GRAVE.",
  "AIM FOR THE EYES\nOF GOHMA.",
  "SOUTH OF ARROW MARK\nIS A SECRET.",
  "BUY MEDICINE BEFORE\nYOU GO.",
  "DIGEST THE SECRET\nIN THE BLUE WATER.",
];

export interface OldManOptions {
  screenId: string;
  x?: number;
  y?: number;
  initialMessage?: string;
  offeredItem?: ItemType | null;
  isItemClaimed?: boolean;
  itemX?: number;
  itemY?: number;
}

export class OldManNPC {
  public screenId: string;
  public x: number;
  public y: number;

  // 8-Bit Text Engine State
  public fullMessage: string = '';
  public displayedText: string = '';
  public charIndex: number = 0;
  public typingSpeed: number = 3; // Frames per character (authentic NES speed)
  private typingTimer: number = 0;
  public isTypingComplete: boolean = false;
  private messageHistory: string[] = [];

  // Item Offering & Altar Pedestal
  public offeredItem: ItemType | null = null;
  public isItemClaimed: boolean = false;
  public itemX: number;
  public itemY: number;
  private itemBobTimer: number = 0;

  // Interaction State
  private interactionCooldown: number = 0;
  public talkCount: number = 0;

  constructor(options: OldManOptions) {
    this.screenId = options.screenId;
    this.x = options.x ?? 120;
    this.y = options.y ?? 48;
    this.offeredItem = options.offeredItem ?? null;
    this.isItemClaimed = options.isItemClaimed ?? false;
    this.itemX = options.itemX ?? 120;
    this.itemY = options.itemY ?? 76;

    const message = options.initialMessage || this.getRandomIconicMessage();
    this.setMessage(message, true);
  }

  /**
   * Returns a random iconic Old Man wisdom message from the classic NES pool.
   */
  public getRandomIconicMessage(excludeCurrent: boolean = true): string {
    const pool = excludeCurrent && this.fullMessage
      ? ICONIC_OLD_MAN_MESSAGES.filter((m) => m !== this.fullMessage)
      : ICONIC_OLD_MAN_MESSAGES;
    const idx = Math.floor(Math.random() * pool.length);
    return pool[idx] || ICONIC_OLD_MAN_MESSAGES[0];
  }

  /**
   * Sets a new message and resets the typewriter text engine to begin character-by-character typing.
   */
  public setMessage(text: string, resetTypewriter: boolean = true) {
    this.fullMessage = text.toUpperCase();
    if (resetTypewriter) {
      this.displayedText = '';
      this.charIndex = 0;
      this.typingTimer = 0;
      this.isTypingComplete = false;
    } else {
      this.displayedText = this.fullMessage;
      this.charIndex = this.fullMessage.length;
      this.isTypingComplete = true;
    }
  }

  /**
   * Selects a fresh randomized iconic message and begins typing it on screen.
   */
  public randomizeMessage(): string {
    const newMsg = this.getRandomIconicMessage(true);
    this.setMessage(newMsg, true);
    this.messageHistory.push(newMsg);
    return newMsg;
  }

  /**
   * Instantly completes typewriter text display (allows player to skip ahead).
   */
  public skipTyping() {
    this.displayedText = this.fullMessage;
    this.charIndex = this.fullMessage.length;
    this.isTypingComplete = true;
  }

  /**
   * Updates typewriter text engine, torch flame ticks, and interaction timers every frame.
   */
  public update(particles?: ParticleSystem) {
    if (this.interactionCooldown > 0) {
      this.interactionCooldown--;
    }

    this.itemBobTimer++;

    // 1. Advance the 8-bit typewriter character engine
    if (!this.isTypingComplete && this.charIndex < this.fullMessage.length) {
      this.typingTimer++;
      if (this.typingTimer >= this.typingSpeed) {
        this.typingTimer = 0;
        const nextChar = this.fullMessage[this.charIndex];
        this.displayedText += nextChar;
        this.charIndex++;

        // Play authentic NES 2A03 blip on alphanumeric characters
        if (nextChar !== ' ' && nextChar !== '\n') {
          chiptune.playTextChar();
        }

        if (this.charIndex >= this.fullMessage.length) {
          this.isTypingComplete = true;
        }
      }
    }

    // 2. Sparkle particle effect over unclaimed offered item
    if (
      particles &&
      this.offeredItem &&
      !this.isItemClaimed &&
      this.itemBobTimer % 24 === 0
    ) {
      particles.emitSparkleBurst(this.itemX + 8, this.itemY + 8);
    }
  }

  /**
   * Checks collision and interaction with Link.
   * - If Link touches the offered item pedestal: grants the item with fanfare!
   * - If Link approaches the Old Man and interacts: talks and randomizes wisdom!
   */
  public checkInteraction(
    player: PlayerState,
    inputTriggered: boolean,
    onCollectItem: (itemType: ItemType) => void,
    particles?: ParticleSystem
  ): boolean {
    const px = player.x + 8;
    const py = player.y + 8;

    // 1. Check item pedestal pickup (walking directly to the offered item)
    if (this.offeredItem && !this.isItemClaimed) {
      const itemDist = Math.hypot(px - (this.itemX + 8), py - (this.itemY + 8));
      if (itemDist < 14) {
        this.claimItem(player, onCollectItem, particles);
        return true;
      }
    }

    // 2. Check Old Man dialogue interaction (proximity or button press)
    const oldManDist = Math.hypot(px - (this.x + 8), py - (this.y + 8));
    if (oldManDist < 26) {
      if (this.interactionCooldown <= 0) {
        if (!this.isTypingComplete) {
          // If message is still typing, skip to complete text
          if (inputTriggered) {
            this.skipTyping();
            this.interactionCooldown = 15;
            return true;
          }
        } else if (inputTriggered) {
          // If text is already complete, talk again to get new wisdom!
          this.talkCount++;
          this.randomizeMessage();
          this.interactionCooldown = 30;
          chiptune.playKey();
          if (particles) {
            particles.emitSparkleBurst(this.x + 8, this.y + 8);
          }
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Triggers item receipt upon interaction.
   * Plays triumphant fanfare, emits particle burst, updates player inventory,
   * and transitions Old Man's dialogue to an encouraging blessing.
   */
  public claimItem(
    player: PlayerState,
    onCollectItem: (itemType: ItemType) => void,
    particles?: ParticleSystem
  ) {
    if (!this.offeredItem || this.isItemClaimed) return;

    const item = this.offeredItem;
    this.isItemClaimed = true;
    this.interactionCooldown = 60;

    // Grant item to player via engine callback
    onCollectItem(item);

    // Visual fanfare particle burst
    if (particles) {
      particles.emitSparkleBurst(this.itemX + 8, this.itemY + 8);
    }

    // Old Man offers encouraging post-gift guidance
    const postGiftMessages = [
      "GO FORTH, HERO!\nSAVE HYRULE!",
      "THE FATE OF HYRULE\nRESTS WITH YOU.",
      "MAY THE TRIFORCE\nBE WITH YOU.",
      "SEEK OUT THE EIGHT\nDUNGEONS OF HYRULE.",
    ];
    const blessing = postGiftMessages[Math.floor(Math.random() * postGiftMessages.length)];
    this.setMessage(blessing, true);
  }

  /**
   * Renders the Old Man, flanking torches, floating item altar, and 8-bit dialogue text.
   */
  public render(
    ctx: CanvasRenderingContext2D,
    offsetX: number,
    offsetY: number,
    animTick: number
  ) {
    const flameFrame = Math.floor(animTick / 10);
    const renderX = offsetX + this.x;
    const renderY = offsetY + this.y;

    // 1. Flanking Sacred Torches
    drawTorch(ctx, renderX - 40, renderY, flameFrame);
    drawTorch(ctx, renderX + 40, renderY, flameFrame);

    // 2. Old Man Sprite (with subtle breathing idle pulse)
    drawOldMan(ctx, renderX, renderY);

    // 3. 8-Bit Text Display (Rendered above the Old Man with authentic NES typography)
    if (this.displayedText) {
      ctx.save();
      ctx.font = '8px "Press Start 2P", monospace, sans-serif';
      ctx.textAlign = 'center';

      const lines = this.displayedText.split('\n');
      const startY = offsetY + 24;

      lines.forEach((line, i) => {
        const lineY = startY + i * 12;

        // Black drop-shadow for authentic NES crisp contrast
        ctx.fillStyle = NES_COLORS.BLACK;
        ctx.fillText(line, renderX + 9, lineY + 1);

        // Crisp white text
        ctx.fillStyle = NES_COLORS.WHITE;
        ctx.fillText(line, renderX + 8, lineY);
      });

      // Typewriter blinking prompt indicator if waiting
      if (this.isTypingComplete && Math.floor(animTick / 15) % 2 === 0) {
        ctx.fillStyle = NES_COLORS.GOLD;
        ctx.fillText('▼', renderX + 8, startY + lines.length * 12);
      }

      ctx.restore();
    }

    // 4. Offered Item Altar Pedestal (if item has not been claimed)
    if (this.offeredItem && !this.isItemClaimed) {
      const itX = offsetX + this.itemX;
      const itY = offsetY + this.itemY;
      const bobOffset = Math.round(Math.sin(this.itemBobTimer * 0.12) * 2);

      ctx.save();
      // Stone Altar Base
      ctx.fillStyle = NES_COLORS.OVERWORLD_ROCK;
      ctx.fillRect(itX + 2, itY + 12, 12, 4);
      ctx.fillStyle = NES_COLORS.OVERWORLD_ROCK_LIGHT;
      ctx.fillRect(itX + 3, itY + 12, 10, 1);

      // Flashing Golden Sparkle Halo around the holy relic
      const haloColor =
        Math.floor(animTick / 4) % 2 === 0
          ? 'rgba(248, 184, 0, 0.45)'
          : 'rgba(255, 255, 255, 0.3)';
      ctx.fillStyle = haloColor;
      ctx.fillRect(itX - 1, itY + bobOffset - 1, 18, 18);

      // Render the offered item
      drawItem(ctx, this.offeredItem, itX, itY + bobOffset);

      ctx.restore();
    }
  }
}
