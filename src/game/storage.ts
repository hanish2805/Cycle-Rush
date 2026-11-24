import {
  ADVENTURE_CAMPAIGN_LEVELS,
  DEFAULT_ADVENTURE_CONTROLS,
  getAdventureLevelDef,
} from './adventureCatalog';
import {
  BICYCLES,
  EFFECTS,
  ENVIRONMENTS,
  MISSIONS,
  OUTFITS,
  SKINS,
  getBicycleSpec,
  getEffectSpec,
  getEnvironmentSpec,
  getOutfitSpec,
  getSkinSpec,
} from './catalog';
import type {
  AdventureRunSnapshot,
  AdventureSaveData,
  EnvironmentId,
  GameMode,
  GameSettings,
  LoadoutConfig,
  PlayerSaveData,
  RunSnapshot,
  ShopCategory,
} from './types';

const STORAGE_KEY = 'cycle_rush_save_v1';

export function createDefaultAdventureSave(): AdventureSaveData {
  return {
    unlockedLevelIndex: 0,
    currentLevelId: ADVENTURE_CAMPAIGN_LEVELS[0].id,
    starsByLevel: {},
    bestScoreByLevel: {},
    completedLevels: [],
    completedChallenges: [],
    bestAdventureScore: 0,
    bestStuntScore: 0,
    longestWheelieSeconds: 0,
    longestJumpMeters: 0,
    highestJumpMeters: 0,
    bestComboCount: 0,
  };
}

export function createDefaultSaveData(): PlayerSaveData {
  return {
    coins: 200,
    bestScore: 0,
    bestScoreByMode: {
      endless: 0,
      time_challenge: 0,
      mission: 0,
    },
    bestDistanceMeters: 0,
    totalRuns: 0,
    totalDistanceMeters: 0,
    unlockedBicycles: ['road_pro'],
    unlockedOutfits: ['pro_crimson'],
    unlockedSkins: ['carbon_matte'],
    unlockedEffects: ['wind_stream'],
    unlockedEnvironments: ['city'],
    equippedBicycle: 'road_pro',
    equippedOutfit: 'pro_crimson',
    equippedSkin: 'carbon_matte',
    equippedEffect: 'wind_stream',
    equippedEnvironment: 'city',
    missionProgress: {},
    completedMissions: [],
    claimedMissions: [],
    activeMissionId: MISSIONS[0].id,
    settings: {
      musicVolume: 0.45,
      sfxVolume: 0.7,
      muted: false,
      sensitivity: 1.0,
      adventureControls: { ...DEFAULT_ADVENTURE_CONTROLS },
    },
    adventure: createDefaultAdventureSave(),
  };
}

export function loadSaveData(): PlayerSaveData {
  const fallback = createDefaultSaveData();
  if (typeof window === 'undefined' || !window.localStorage) {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PlayerSaveData>;
    return {
      ...fallback,
      ...parsed,
      bestScoreByMode: {
        ...fallback.bestScoreByMode,
        ...(parsed.bestScoreByMode ?? {}),
      },
      settings: {
        ...fallback.settings,
        ...(parsed.settings ?? {}),
        adventureControls: {
          ...DEFAULT_ADVENTURE_CONTROLS,
          ...(parsed.settings?.adventureControls ?? {}),
        },
      },
      adventure: {
        ...fallback.adventure,
        ...(parsed.adventure ?? {}),
        starsByLevel: {
          ...fallback.adventure.starsByLevel,
          ...(parsed.adventure?.starsByLevel ?? {}),
        },
        bestScoreByLevel: {
          ...fallback.adventure.bestScoreByLevel,
          ...(parsed.adventure?.bestScoreByLevel ?? {}),
        },
        completedLevels: parsed.adventure?.completedLevels ?? fallback.adventure.completedLevels,
        completedChallenges:
          parsed.adventure?.completedChallenges ?? fallback.adventure.completedChallenges,
      },
      unlockedBicycles: parsed.unlockedBicycles?.length
        ? parsed.unlockedBicycles
        : fallback.unlockedBicycles,
      unlockedOutfits: parsed.unlockedOutfits?.length
        ? parsed.unlockedOutfits
        : fallback.unlockedOutfits,
      unlockedSkins: parsed.unlockedSkins?.length
        ? parsed.unlockedSkins
        : fallback.unlockedSkins,
      unlockedEffects: parsed.unlockedEffects?.length
        ? parsed.unlockedEffects
        : fallback.unlockedEffects,
      unlockedEnvironments: parsed.unlockedEnvironments?.length
        ? parsed.unlockedEnvironments
        : fallback.unlockedEnvironments,
    };
  } catch {
    return fallback;
  }
}

export function savePlayerData(data: PlayerSaveData): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore quota errors in restricted sandboxes
  }
}

export function getShopItemCost(category: ShopCategory, itemId: string): number | null {
  switch (category) {
    case 'bicycles':
      return BICYCLES.find((i) => i.id === itemId)?.cost ?? null;
    case 'outfits':
      return OUTFITS.find((i) => i.id === itemId)?.cost ?? null;
    case 'skins':
      return SKINS.find((i) => i.id === itemId)?.cost ?? null;
    case 'effects':
      return EFFECTS.find((i) => i.id === itemId)?.cost ?? null;
    case 'environments':
      return ENVIRONMENTS.find((i) => i.id === itemId)?.cost ?? null;
  }
}

export function isItemUnlocked(
  data: PlayerSaveData,
  category: ShopCategory,
  itemId: string,
): boolean {
  switch (category) {
    case 'bicycles':
      return data.unlockedBicycles.includes(itemId);
    case 'outfits':
      return data.unlockedOutfits.includes(itemId);
    case 'skins':
      return data.unlockedSkins.includes(itemId);
    case 'effects':
      return data.unlockedEffects.includes(itemId);
    case 'environments':
      return data.unlockedEnvironments.includes(itemId as EnvironmentId);
  }
}

export function purchaseShopItem(
  data: PlayerSaveData,
  category: ShopCategory,
  itemId: string,
): { next: PlayerSaveData; ok: boolean; reason?: string } {
  if (isItemUnlocked(data, category, itemId)) {
    return { next: equipShopItem(data, category, itemId), ok: true };
  }
  const cost = getShopItemCost(category, itemId);
  if (cost === null) {
    return { next: data, ok: false, reason: 'Item not found' };
  }
  if (data.coins < cost) {
    return { next: data, ok: false, reason: 'Insufficient coins' };
  }

  const next: PlayerSaveData = {
    ...data,
    coins: data.coins - cost,
  };

  switch (category) {
    case 'bicycles':
      next.unlockedBicycles = [...data.unlockedBicycles, itemId];
      next.equippedBicycle = itemId;
      break;
    case 'outfits':
      next.unlockedOutfits = [...data.unlockedOutfits, itemId];
      next.equippedOutfit = itemId;
      break;
    case 'skins':
      next.unlockedSkins = [...data.unlockedSkins, itemId];
      next.equippedSkin = itemId;
      break;
    case 'effects':
      next.unlockedEffects = [...data.unlockedEffects, itemId];
      next.equippedEffect = itemId;
      break;
    case 'environments':
      next.unlockedEnvironments = [
        ...data.unlockedEnvironments,
        itemId as EnvironmentId,
      ];
      next.equippedEnvironment = itemId as EnvironmentId;
      break;
  }

  return { next, ok: true };
}

export function equipShopItem(
  data: PlayerSaveData,
  category: ShopCategory,
  itemId: string,
): PlayerSaveData {
  if (!isItemUnlocked(data, category, itemId)) {
    return data;
  }
  switch (category) {
    case 'bicycles':
      return { ...data, equippedBicycle: itemId };
    case 'outfits':
      return { ...data, equippedOutfit: itemId };
    case 'skins':
      return { ...data, equippedSkin: itemId };
    case 'effects':
      return { ...data, equippedEffect: itemId };
    case 'environments':
      return { ...data, equippedEnvironment: itemId as EnvironmentId };
  }
}

export function recordRunResult(
  data: PlayerSaveData,
  run: RunSnapshot,
): PlayerSaveData {
  const prevBest = data.bestScore;
  const newBest = Math.max(prevBest, run.score);
  const prevModeBest = data.bestScoreByMode[run.mode] ?? 0;
  const nextModeBest = Math.max(prevModeBest, run.score);

  const nextMissionProgress = { ...data.missionProgress };
  const nextCompleted = new Set(data.completedMissions);

  for (const m of MISSIONS) {
    const prevVal = nextMissionProgress[m.id] ?? 0;
    let updated = prevVal;
    if (m.metric === 'coins') updated = prevVal + run.coinsEarned;
    else if (m.metric === 'distance') updated = prevVal + run.distanceMeters;
    else if (m.metric === 'dodges') updated = prevVal + run.dodgedObstacles;
    else if (m.metric === 'near_misses') updated = prevVal + run.nearMisses;
    else if (m.metric === 'jumps') updated = prevVal + run.jumps;
    else if (m.metric === 'score') updated = Math.max(prevVal, run.score);

    nextMissionProgress[m.id] = Math.min(m.target, Math.round(updated));
    if (nextMissionProgress[m.id] >= m.target) {
      nextCompleted.add(m.id);
    }
  }

  // Pick next incomplete mission automatically if current active one finished
  let nextActiveMissionId = data.activeMissionId;
  if (nextCompleted.has(nextActiveMissionId)) {
    const firstOpen = MISSIONS.find((m) => !nextCompleted.has(m.id));
    if (firstOpen) nextActiveMissionId = firstOpen.id;
  }

  return {
    ...data,
    coins: data.coins + run.coinsEarned,
    bestScore: newBest,
    bestScoreByMode: {
      ...data.bestScoreByMode,
      [run.mode]: nextModeBest,
    },
    bestDistanceMeters: Math.max(data.bestDistanceMeters, run.distanceMeters),
    totalRuns: data.totalRuns + 1,
    totalDistanceMeters: data.totalDistanceMeters + run.distanceMeters,
    missionProgress: nextMissionProgress,
    completedMissions: Array.from(nextCompleted),
    activeMissionId: nextActiveMissionId,
  };
}

export function claimMissionReward(
  data: PlayerSaveData,
  missionId: string,
): { next: PlayerSaveData; claimed: boolean; coinsAwarded: number } {
  const def = MISSIONS.find((m) => m.id === missionId);
  if (!def) return { next: data, claimed: false, coinsAwarded: 0 };
  if (!data.completedMissions.includes(missionId)) {
    return { next: data, claimed: false, coinsAwarded: 0 };
  }
  if (data.claimedMissions.includes(missionId)) {
    return { next: data, claimed: false, coinsAwarded: 0 };
  }
  return {
    next: {
      ...data,
      coins: data.coins + def.rewardCoins,
      claimedMissions: [...data.claimedMissions, missionId],
    },
    claimed: true,
    coinsAwarded: def.rewardCoins,
  };
}

export function updateSettings(
  data: PlayerSaveData,
  patch: Partial<GameSettings>,
): PlayerSaveData {
  return {
    ...data,
    settings: {
      ...data.settings,
      ...patch,
      adventureControls: {
        ...data.settings.adventureControls,
        ...(patch.adventureControls ?? {}),
      },
    },
  };
}

export function recordAdventureResult(
  data: PlayerSaveData,
  snap: AdventureRunSnapshot,
): PlayerSaveData {
  const prev = data.adventure;
  const levelDef = getAdventureLevelDef(snap.levelId);
  const completedLevels = new Set(prev.completedLevels);
  const completedChallenges = new Set(prev.completedChallenges);
  const starsByLevel = { ...prev.starsByLevel };
  const bestScoreByLevel = { ...prev.bestScoreByLevel };

  let unlockedLevelIndex = prev.unlockedLevelIndex;
  let currentLevelId = prev.currentLevelId;

  if (snap.outcome === 'completed') {
    bestScoreByLevel[snap.levelId] = Math.max(
      bestScoreByLevel[snap.levelId] ?? 0,
      snap.totalScore,
    );
    starsByLevel[snap.levelId] = Math.max(
      starsByLevel[snap.levelId] ?? 0,
      snap.starsEarned,
    );
    if (snap.isChallenge) {
      completedChallenges.add(snap.levelId);
    } else {
      completedLevels.add(snap.levelId);
      const nextUnlock = Math.min(
        ADVENTURE_CAMPAIGN_LEVELS.length - 1,
        Math.max(unlockedLevelIndex, levelDef.index + 1),
      );
      unlockedLevelIndex = nextUnlock;
      currentLevelId =
        ADVENTURE_CAMPAIGN_LEVELS[nextUnlock]?.id ?? snap.levelId;
    }
  } else if (!snap.isChallenge) {
    currentLevelId = snap.levelId;
  }

  return {
    ...data,
    coins: data.coins + snap.coinsAwarded,
    adventure: {
      unlockedLevelIndex,
      currentLevelId,
      starsByLevel,
      bestScoreByLevel,
      completedLevels: Array.from(completedLevels),
      completedChallenges: Array.from(completedChallenges),
      bestAdventureScore: Math.max(prev.bestAdventureScore, snap.totalScore),
      bestStuntScore: Math.max(prev.bestStuntScore, snap.stuntScore),
      longestWheelieSeconds: Math.max(
        prev.longestWheelieSeconds,
        snap.longestWheelieSeconds,
      ),
      longestJumpMeters: Math.max(
        prev.longestJumpMeters,
        snap.longestJumpMeters,
      ),
      highestJumpMeters: Math.max(
        prev.highestJumpMeters,
        snap.highestJumpMeters,
      ),
      bestComboCount: Math.max(prev.bestComboCount, snap.bestComboCount),
    },
  };
}

export function resetAdventureCampaign(data: PlayerSaveData): PlayerSaveData {
  return {
    ...data,
    adventure: {
      ...data.adventure,
      unlockedLevelIndex: 0,
      currentLevelId: ADVENTURE_CAMPAIGN_LEVELS[0].id,
    },
  };
}

export function getTotalAdventureStars(adventure: AdventureSaveData): number {
  return Object.values(adventure.starsByLevel).reduce((sum, s) => sum + s, 0);
}

export function resolveLoadout(data: PlayerSaveData): LoadoutConfig {
  return {
    bicycle: getBicycleSpec(data.equippedBicycle),
    outfit: getOutfitSpec(data.equippedOutfit),
    skin: getSkinSpec(data.equippedSkin),
    effect: getEffectSpec(data.equippedEffect),
  };
}

export function resolveEnvironment(data: PlayerSaveData) {
  return getEnvironmentSpec(data.equippedEnvironment);
}
