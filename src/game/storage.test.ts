import test from 'node:test';
import assert from 'node:assert/strict';
import {
  claimMissionReward,
  createDefaultSaveData,
  equipShopItem,
  loadSaveData,
  purchaseShopItem,
  recordRunResult,
  savePlayerData,
} from './storage';
import type { RunSnapshot } from './types';

test('shop purchases deduct coins, unlock items, and equip them', () => {
  const initial = createDefaultSaveData();
  assert.equal(initial.coins, 200);

  const tooExpensive = purchaseShopItem(initial, 'bicycles', 'cyber_aero');
  assert.equal(tooExpensive.ok, false);
  assert.equal(tooExpensive.next.coins, 200);

  const bought = purchaseShopItem(initial, 'environments', 'forest');
  assert.equal(bought.ok, true);
  assert.equal(bought.next.coins, 80);
  assert.ok(bought.next.unlockedEnvironments.includes('forest'));
  assert.equal(bought.next.equippedEnvironment, 'forest');

  const reEquipped = equipShopItem(bought.next, 'environments', 'city');
  assert.equal(reEquipped.equippedEnvironment, 'city');
});

test('personal bests never reset on subsequent lower-scoring runs', () => {
  const initial = createDefaultSaveData();
  const highRun: RunSnapshot = {
    score: 4200,
    bestScore: 4200,
    isNewRecord: true,
    distanceMeters: 950,
    coinsEarned: 45,
    survivalSeconds: 65,
    dodgedObstacles: 24,
    nearMisses: 6,
    jumps: 10,
    topSpeedKmh: 62,
    difficultyStage: 6,
    mode: 'endless',
    missionCompleted: false,
    outcome: 'crashed',
  };
  const afterHigh = recordRunResult(initial, highRun);
  assert.equal(afterHigh.bestScore, 4200);
  assert.equal(afterHigh.bestScoreByMode.endless, 4200);

  const lowRun: RunSnapshot = {
    ...highRun,
    score: 500,
    bestScore: 4200,
    isNewRecord: false,
    distanceMeters: 120,
    coinsEarned: 5,
  };
  const afterLow = recordRunResult(afterHigh, lowRun);
  assert.equal(afterLow.bestScore, 4200);
  assert.equal(afterLow.coins, 200 + 45 + 5);
  assert.equal(afterLow.totalRuns, 2);
});

test('missions track progress and award coins once on claim', () => {
  let save = createDefaultSaveData();
  const run: RunSnapshot = {
    score: 1200,
    bestScore: 1200,
    isNewRecord: true,
    distanceMeters: 400,
    coinsEarned: 35,
    survivalSeconds: 32,
    dodgedObstacles: 14,
    nearMisses: 3,
    jumps: 5,
    topSpeedKmh: 55,
    difficultyStage: 3,
    mode: 'mission',
    missionCompleted: true,
    outcome: 'crashed',
  };
  save = recordRunResult(save, run);
  assert.ok(save.completedMissions.includes('m_coins_30'));

  const coinsBefore = save.coins;
  const claim1 = claimMissionReward(save, 'm_coins_30');
  assert.equal(claim1.claimed, true);
  assert.equal(claim1.next.coins, coinsBefore + 90);

  // Double-claim prevented
  const claim2 = claimMissionReward(claim1.next, 'm_coins_30');
  assert.equal(claim2.claimed, false);
  assert.equal(claim2.next.coins, coinsBefore + 90);
});

test('all 5 shop categories unlock, equip, and roundtrip through storage', () => {
  const store = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
  };
  const prevWin = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = { localStorage: mockLocalStorage };

  try {
    let save = { ...createDefaultSaveData(), coins: 2000 };
    const purchases: [Parameters<typeof purchaseShopItem>[1], string][] = [
      ['bicycles', 'track_sprint'],
      ['outfits', 'aero_cobalt'],
      ['skins', 'racing_gold'],
      ['effects', 'ember_sparks'],
      ['environments', 'neon_night'],
    ];

    for (const [cat, id] of purchases) {
      const res = purchaseShopItem(save, cat, id);
      assert.equal(res.ok, true, `Failed purchasing ${cat}:${id}`);
      save = res.next;
    }

    savePlayerData(save);
    const reloaded = loadSaveData();
    assert.equal(reloaded.equippedBicycle, 'track_sprint');
    assert.equal(reloaded.equippedOutfit, 'aero_cobalt');
    assert.equal(reloaded.equippedSkin, 'racing_gold');
    assert.equal(reloaded.equippedEffect, 'ember_sparks');
    assert.equal(reloaded.equippedEnvironment, 'neon_night');
    assert.equal(reloaded.coins, save.coins);
  } finally {
    if (prevWin === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = prevWin;
    }
  }
});

test('per-mode personal bests track endless, time_challenge, and cumulative distance missions', () => {
  let save = createDefaultSaveData();
  const timeTrialRun: RunSnapshot = {
    score: 1850,
    bestScore: 1850,
    isNewRecord: true,
    distanceMeters: 350,
    coinsEarned: 12,
    survivalSeconds: 90,
    dodgedObstacles: 18,
    nearMisses: 4,
    jumps: 6,
    topSpeedKmh: 58,
    difficultyStage: 4,
    mode: 'time_challenge',
    missionCompleted: false,
    outcome: 'finished',
  };
  save = recordRunResult(save, timeTrialRun);
  assert.equal(save.bestScore, 1850);
  assert.equal(save.bestScoreByMode.time_challenge, 1850);
  assert.equal(save.bestScoreByMode.endless, 0);

  // Second run pushes cumulative distance mission m_dist_600 past 600m (clamped at 600 target)
  const secondRun: RunSnapshot = {
    ...timeTrialRun,
    score: 900,
    bestScore: 1850,
    isNewRecord: false,
    distanceMeters: 280,
    mode: 'endless',
    outcome: 'crashed',
  };
  save = recordRunResult(save, secondRun);
  assert.equal(save.bestScore, 1850);
  assert.equal(save.bestScoreByMode.endless, 900);
  assert.equal(save.missionProgress.m_dist_600, 600);
  assert.ok(save.completedMissions.includes('m_dist_600'));
});


