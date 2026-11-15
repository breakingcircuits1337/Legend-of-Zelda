/**
 * The Legend of Zelda NES - Cartridge Save System
 * 3-Slot Battery-Backed RAM Simulation via LocalStorage
 */

import { SaveSlotData, ItemType, PlayerState } from '../types';
import { normalizeTriforceIds } from './bossTriforceSystem';

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
      collectedHeartContainers: [],
      collectedTriforceIds: [],
      defeatedBossRooms: [],
      unlockedBestiary: [],
      bestiaryDefeatCounts: {},
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
      collectedHeartContainers: [],
      collectedTriforceIds: [],
      defeatedBossRooms: [],
      unlockedBestiary: [],
      bestiaryDefeatCounts: {},
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
      collectedHeartContainers: [],
      collectedTriforceIds: [],
      defeatedBossRooms: [],
      unlockedBestiary: [],
      bestiaryDefeatCounts: {},
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
      return parsed.map((slot) => {
        const normalizedTriforceIds = normalizeTriforceIds(
          slot?.collectedTriforceIds,
          Number(slot?.triforcePieces) || 0
        );
        return {
          ...slot,
          deaths: Math.max(0, Number(slot?.deaths) || 0),
          collectedTriforceIds: normalizedTriforceIds,
          triforcePieces: Math.max(
            Number(slot?.triforcePieces) || 0,
            normalizedTriforceIds.length
          ),
          defeatedBossRooms: Array.isArray(slot?.defeatedBossRooms)
            ? slot.defeatedBossRooms
            : [],
        };
      });
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
  visitedScreens?: string[],
  collectedHeartContainers?: string[]
) {
  const slots = loadAllSaveSlots();
  const current = slots.find((s) => s.id === slotId) || slots[0];

  const resolvedContainers =
    collectedHeartContainers ??
    player.collectedHeartContainers ??
    current.collectedHeartContainers ??
    [];

  const normalizedTriforceIds = normalizeTriforceIds(
    player.collectedTriforceIds ?? current.collectedTriforceIds,
    player.inventory.triforcePieces
  );

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
    triforcePieces: Math.max(player.inventory.triforcePieces, normalizedTriforceIds.length),
    deaths:
      deathsCount !== undefined
        ? Math.max(0, deathsCount)
        : Math.max(0, player.deaths ?? current.deaths ?? 0),
    currentScreen: currentScreenId,
    visitedScreens: visitedScreens && visitedScreens.length > 0 ? visitedScreens : current.visitedScreens || ['O7_7'],
    collectedHeartContainers: Array.from(new Set(resolvedContainers)),
    collectedTriforceIds: normalizedTriforceIds,
    defeatedBossRooms: Array.from(
      new Set(player.defeatedBossRooms ?? current.defeatedBossRooms ?? [])
    ),
    unlockedBestiary: Array.from(
      new Set(player.unlockedBestiary ?? current.unlockedBestiary ?? [])
    ),
    bestiaryDefeatCounts: {
      ...(current.bestiaryDefeatCounts || {}),
      ...(player.bestiaryDefeatCounts || {}),
    },
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
      collectedHeartContainers: [],
      collectedTriforceIds: [],
      defeatedBossRooms: [],
      unlockedBestiary: [],
      bestiaryDefeatCounts: {},
      timestamp: 0,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
  }
}
