/**
 * The Legend of Zelda NES - Cartridge Save System
 * 3-Slot Battery-Backed RAM Simulation via LocalStorage
 */

import { SaveSlotData, ItemType, PlayerState } from '../types';

const STORAGE_KEY = 'zelda_nes_battery_ram_v1';

export function getDefaultSaveSlots(): SaveSlotData[] {
  return [
    {
      id: 1,
      name: 'LINK',
      hearts: 6, // 3 full hearts (2 half-hearts each)
      maxHearts: 6,
      rupees: 0,
      bombs: 4,
      keys: 0,
      swordTier: 0, // Starts without sword until cave!
      hasBoomerang: false,
      hasBow: false,
      hasCandle: false,
      hasShield: true,
      hasMagicalShield: false,
      hasCompass: false,
      hasDungeonMap: false,
      triforcePieces: 0,
      deaths: 0,
      currentScreen: 'O7_7',
      visitedScreens: ['O7_7'],
      timestamp: Date.now(),
    },
    {
      id: 2,
      name: '- - - -',
      hearts: 6,
      maxHearts: 6,
      rupees: 0,
      bombs: 0,
      keys: 0,
      swordTier: 0,
      hasBoomerang: false,
      hasBow: false,
      hasCandle: false,
      hasCompass: false,
      hasDungeonMap: false,
      triforcePieces: 0,
      deaths: 0,
      currentScreen: 'O7_7',
      visitedScreens: ['O7_7'],
      timestamp: 0,
    },
    {
      id: 3,
      name: '- - - -',
      hearts: 6,
      maxHearts: 6,
      rupees: 0,
      bombs: 0,
      keys: 0,
      swordTier: 0,
      hasBoomerang: false,
      hasBow: false,
      hasCandle: false,
      hasCompass: false,
      hasDungeonMap: false,
      triforcePieces: 0,
      deaths: 0,
      currentScreen: 'O7_7',
      visitedScreens: ['O7_7'],
      timestamp: 0,
    },
  ];
}

export function loadAllSaveSlots(): SaveSlotData[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultSaveSlots();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === 3) {
      return parsed;
    }
    return getDefaultSaveSlots();
  } catch {
    return getDefaultSaveSlots();
  }
}

export function saveSlotData(slot: SaveSlotData) {
  try {
    const slots = loadAllSaveSlots();
    const index = slots.findIndex((s) => s.id === slot.id);
    if (index !== -1) {
      slots[index] = { ...slot, timestamp: Date.now() };
    } else {
      slots.push(slot);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
  } catch (err) {
    console.warn('Failed to save to local storage', err);
  }
}

export function saveGameProgress(
  slotId: number,
  player: PlayerState,
  currentScreenId: string,
  deathsCount?: number,
  visitedScreens?: string[]
) {
  const slots = loadAllSaveSlots();
  const current = slots.find((s) => s.id === slotId) || slots[0];

  const updated: SaveSlotData = {
    ...current,
    hasMagicalBoomerang: player.inventory.hasMagicalBoomerang,
    hasRedCandle: player.inventory.hasRedCandle,
    hasRecorder: player.inventory.hasRecorder,
    hasMagicalRod: player.inventory.hasMagicalRod,
    hasPowerBracelet: player.inventory.hasPowerBracelet,
    hasSteppingLadder: player.inventory.hasSteppingLadder,
    hasFood: player.inventory.hasFood,
    potionTier: player.inventory.potionTier,
    ringTier: player.ringTier,
    hasBlueRing: player.hasBlueRing,
    hasRedRing: player.hasRedRing,
    hearts: player.hearts,
    maxHearts: player.maxHearts,
    rupees: player.inventory.rupees,
    bombs: player.inventory.bombs,
    keys: player.inventory.keys,
    swordTier: player.swordTier,
    hasBoomerang: player.inventory.hasBoomerang,
    hasBow: player.inventory.hasBow,
    hasCandle: player.inventory.hasCandle,
    hasShield: player.hasShield !== false && player.inventory.hasShield !== false,
    hasMagicalShield: Boolean(player.hasMagicalShield || player.inventory.hasMagicalShield),
    hasCompass: player.inventory.hasCompass,
    hasDungeonMap: player.inventory.hasDungeonMap,
    triforcePieces: player.inventory.triforcePieces,
    deaths: deathsCount !== undefined ? deathsCount : current.deaths,
    currentScreen: currentScreenId,
    visitedScreens: visitedScreens && visitedScreens.length > 0 ? visitedScreens : current.visitedScreens || ['O7_7'],
    timestamp: Date.now(),
  };

  saveSlotData(updated);
  return updated;
}

export function clearSaveSlot(slotId: number) {
  const slots = loadAllSaveSlots();
  const index = slots.findIndex((s) => s.id === slotId);
  if (index !== -1) {
    slots[index] = {
      id: slotId,
      name: '- - - -',
      hearts: 6,
      maxHearts: 6,
      rupees: 0,
      bombs: 0,
      keys: 0,
      swordTier: 0,
      hasBoomerang: false,
      hasBow: false,
      hasCandle: false,
      hasShield: true,
      hasMagicalShield: false,
      hasCompass: false,
      hasDungeonMap: false,
      triforcePieces: 0,
      deaths: 0,
      currentScreen: 'O7_7',
      visitedScreens: ['O7_7'],
      timestamp: 0,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
  }
}
