import { useCallback, useEffect, useRef, useState } from 'react';
import { AdventureHubModal } from './components/AdventureHubModal';
import { AdventureHud } from './components/AdventureHud';
import { AdventureResultModal } from './components/AdventureResultModal';
import { GameHud } from './components/GameHud';
import { GameOverModal } from './components/GameOverModal';
import { MissionsModal } from './components/MissionsModal';
import { PauseModal } from './components/PauseModal';
import { SettingsModal } from './components/SettingsModal';
import { ShopModal } from './components/ShopModal';
import { TitleOverlay } from './components/TitleOverlay';
import {
  ADVENTURE_CAMPAIGN_LEVELS,
  getAdventureLevelDef,
} from './game/adventureCatalog';
import { SoundEngine } from './game/audio';
import { MISSIONS } from './game/catalog';
import {
  claimMissionReward,
  loadSaveData,
  purchaseShopItem,
  recordAdventureResult,
  recordRunResult,
  resetAdventureCampaign,
  resolveEnvironment,
  resolveLoadout,
  savePlayerData,
  updateSettings,
} from './game/storage';
import { GameEngine } from './game/three/GameEngine';
import type {
  AdventureAreaId,
  AdventureHudState,
  AdventureRunSnapshot,
  GameMode,
  GameSettings,
  GameState,
  HudState,
  PlayerSaveData,
  RunSnapshot,
  ShopCategory,
} from './game/types';

const INITIAL_HUD: HudState = {
  score: 0,
  bestScore: 0,
  distanceMeters: 0,
  speedKmh: 30,
  coinsRun: 0,
  survivalSeconds: 0,
  multiplier: 1,
  dodgeStreak: 0,
  difficultyStage: 1,
  activePowerUps: [],
  shieldCharges: 0,
  mode: 'endless',
  timeRemainingSeconds: 0,
  activeMissionId: MISSIONS[0].id,
  activeMissionProgress: 0,
  activeMissionTarget: MISSIONS[0].target,
  activeMissionCompleted: false,
  isNewRecord: false,
  banner: null,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const soundRef = useRef<SoundEngine | null>(null);

  const [saveData, setSaveData] = useState<PlayerSaveData>(() => loadSaveData());
  const [gameState, setGameState] = useState<GameState>('title');
  const [selectedMode, setSelectedMode] = useState<GameMode>('endless');
  const [hud, setHud] = useState<HudState>(() => ({
    ...INITIAL_HUD,
    bestScore: loadSaveData().bestScore,
  }));
  const [runSnapshot, setRunSnapshot] = useState<RunSnapshot | null>(null);

  // Adventure Mode UI state
  const [adventureHubOpen, setAdventureHubOpen] = useState(false);
  const [adventureActive, setAdventureActive] = useState(false);
  const [adventurePreviewArea, setAdventurePreviewArea] =
    useState<AdventureAreaId>('mountain_cliff');
  const [adventureHud, setAdventureHud] = useState<AdventureHudState | null>(null);
  const [adventureSnapshot, setAdventureSnapshot] =
    useState<AdventureRunSnapshot | null>(null);
  const [activeAdventureLevelId, setActiveAdventureLevelId] = useState<string>(
    ADVENTURE_CAMPAIGN_LEVELS[0].id,
  );

  const [shopOpen, setShopOpen] = useState(false);
  const [shopInitialTab, setShopInitialTab] = useState<ShopCategory>('bicycles');
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const saveRef = useRef(saveData);
  saveRef.current = saveData;

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const selectedModeRef = useRef(selectedMode);
  selectedModeRef.current = selectedMode;

  const adventureActiveRef = useRef(adventureActive);
  adventureActiveRef.current = adventureActive;

  const activeAdventureLevelIdRef = useRef(activeAdventureLevelId);
  activeAdventureLevelIdRef.current = activeAdventureLevelId;

  const persistSave = useCallback((next: PlayerSaveData) => {
    setSaveData(next);
    savePlayerData(next);
    engineRef.current?.updateMeta(
      next.bestScore,
      next.activeMissionId,
      next.missionProgress[next.activeMissionId] ?? 0,
    );
  }, []);

  const handleStartGame = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setAdventureHubOpen(false);
    setAdventureActive(false);
    setAdventureSnapshot(null);
    setShopOpen(false);
    setMissionsOpen(false);
    setSettingsOpen(false);
    setRunSnapshot(null);
    setGameState('playing');
    engineRef.current?.startRun(selectedModeRef.current);
  }, []);

  const handleOpenAdventureHub = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const curLvl = getAdventureLevelDef(saveRef.current.adventure.currentLevelId);
    setAdventurePreviewArea(curLvl.areaId);
    setAdventureHubOpen(true);
    setAdventureActive(false);
    setAdventureSnapshot(null);
    setRunSnapshot(null);
    setGameState('title');
    engineRef.current?.previewAdventureArea(curLvl.areaId);
  }, []);

  const handleSelectPreviewArea = useCallback((areaId: AdventureAreaId) => {
    setAdventurePreviewArea(areaId);
    engineRef.current?.previewAdventureArea(areaId);
  }, []);

  const handleStartAdventureLevel = useCallback((levelId: string) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setAdventureHubOpen(false);
    setAdventureSnapshot(null);
    setRunSnapshot(null);
    setSettingsOpen(false);
    setActiveAdventureLevelId(levelId);
    activeAdventureLevelIdRef.current = levelId;
    setAdventureActive(true);
    setGameState('playing');
    const best = saveRef.current.adventure.bestScoreByLevel[levelId] ?? 0;
    engineRef.current?.startAdventureLevel(levelId, best);
  }, []);

  const handleNewAdventure = useCallback(() => {
    const reset = resetAdventureCampaign(saveRef.current);
    persistSave(reset);
    handleStartAdventureLevel(ADVENTURE_CAMPAIGN_LEVELS[0].id);
  }, [persistSave, handleStartAdventureLevel]);

  const handleResumeCheckpoint = useCallback(() => {
    setAdventureSnapshot(null);
    setSettingsOpen(false);
    setGameState('playing');
    engineRef.current?.restartAdventureCheckpoint();
  }, []);

  const handlePause = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;
    setGameState('paused');
    engineRef.current?.pauseRun();
  }, []);

  const handleResume = useCallback(() => {
    setSettingsOpen(false);
    setGameState('playing');
    engineRef.current?.resumeRun();
  }, []);

  const handleRestart = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setSettingsOpen(false);
    if (adventureActiveRef.current) {
      setAdventureSnapshot(null);
      setGameState('playing');
      const id = activeAdventureLevelIdRef.current;
      const best = saveRef.current.adventure.bestScoreByLevel[id] ?? 0;
      engineRef.current?.startAdventureLevel(id, best);
    } else {
      setRunSnapshot(null);
      setGameState('playing');
      engineRef.current?.startRun(selectedModeRef.current);
    }
  }, []);

  const handleMainMenu = useCallback(() => {
    setSettingsOpen(false);
    setAdventureHubOpen(false);
    setAdventureActive(false);
    setAdventureSnapshot(null);
    setRunSnapshot(null);
    setGameState('title');
    engineRef.current?.returnToTitle();
  }, []);

  const handleUpdateSettings = useCallback(
    (patch: Partial<GameSettings>) => {
      const next = updateSettings(saveRef.current, patch);
      persistSave(next);
      engineRef.current?.setSettings(next.settings);
    },
    [persistSave],
  );

  // Mount Three.js engine once
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const sound = new SoundEngine();
    soundRef.current = sound;
    const initial = saveRef.current;
    sound.applySettings(initial.settings);

    const engine = new GameEngine(
      mount,
      resolveEnvironment(initial),
      resolveLoadout(initial),
      initial.settings,
      initial.bestScore,
      initial.activeMissionId,
      initial.missionProgress[initial.activeMissionId] ?? 0,
      {
        onHudUpdate: (nextHud) => setHud(nextHud),
        onGameOver: (snapshot) => {
          const updated = recordRunResult(saveRef.current, snapshot);
          persistSave(updated);
          setRunSnapshot(snapshot);
          setGameState('gameover');
        },
        onPauseRequested: () => {
          setGameState('paused');
          engineRef.current?.pauseRun();
        },
        onAdventureHudUpdate: (nextAdvHud) => setAdventureHud(nextAdvHud),
        onAdventureFinished: (snapshot) => {
          const updated = recordAdventureResult(saveRef.current, snapshot);
          persistSave(updated);
          setAdventureSnapshot(snapshot);
          setGameState('gameover');
        },
      },
      sound,
    );
    engineRef.current = engine;

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      setGameState('playing');
      engine.startRun('endless');
    } else if (params.get('adventure') === '1') {
      const lvlId = params.get('level') || initial.adventure.currentLevelId;
      setActiveAdventureLevelId(lvlId);
      activeAdventureLevelIdRef.current = lvlId;
      setAdventureActive(true);
      setGameState('playing');
      engine.startAdventureLevel(lvlId, initial.adventure.bestScoreByLevel[lvlId] ?? 0);
    } else {
      document.body.dataset.state = 'title';
    }

    return () => {
      engine.dispose();
      sound.dispose();
      engineRef.current = null;
      soundRef.current = null;
    };
  }, [persistSave]);

  // Global keyboard shortcuts & visibility auto-pause
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const anyModalOpen = shopOpen || missionsOpen || settingsOpen || adventureHubOpen;

      if (e.code === 'Escape' && anyModalOpen) {
        e.preventDefault();
        if (settingsOpen) setSettingsOpen(false);
        else if (shopOpen) setShopOpen(false);
        else if (missionsOpen) setMissionsOpen(false);
        else if (adventureHubOpen) {
          setAdventureHubOpen(false);
          engineRef.current?.exitAdventurePreview();
        }
        return;
      }

      if (gameState === 'title' && !anyModalOpen) {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleStartGame();
        }
      } else if (gameState === 'paused' && !settingsOpen) {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          handleResume();
        }
      } else if (gameState === 'playing') {
        if (e.code === 'KeyM' && !adventureActiveRef.current) {
          handleUpdateSettings({ muted: !saveRef.current.settings.muted });
        } else if (e.code === 'KeyR' && !adventureActiveRef.current) {
          handleRestart();
        }
      } else if (gameState === 'gameover' && !anyModalOpen) {
        if (e.code === 'Enter') {
          e.preventDefault();
          if (adventureActiveRef.current && adventureSnapshot?.outcome === 'crashed') {
            handleResumeCheckpoint();
          } else {
            handleRestart();
          }
        }
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden && gameStateRef.current === 'playing') {
        handlePause();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [
    gameState,
    shopOpen,
    missionsOpen,
    settingsOpen,
    adventureHubOpen,
    adventureSnapshot,
    handleStartGame,
    handlePause,
    handleResume,
    handleRestart,
    handleResumeCheckpoint,
    handleUpdateSettings,
  ]);

  const handleBuyOrEquip = (category: ShopCategory, itemId: string) => {
    const { next, ok } = purchaseShopItem(saveData, category, itemId);
    if (!ok) return;
    persistSave(next);
    engineRef.current?.setLoadout(resolveLoadout(next));
    engineRef.current?.setEnvironment(next.equippedEnvironment);
  };

  const handleSelectMission = (missionId: string) => {
    const next = { ...saveData, activeMissionId: missionId };
    persistSave(next);
  };

  const handleClaimMission = (missionId: string) => {
    const { next, claimed } = claimMissionReward(saveData, missionId);
    if (claimed) {
      persistSave(next);
      soundRef.current?.playPowerUp(false);
    }
  };

  return (
    <main className="relative w-full h-full overflow-hidden bg-slate-950">
      {/* Isolated WebGL mount container */}
      <div
        ref={canvasMountRef}
        data-testid="game-canvas-container"
        className="fixed inset-0 w-full h-full"
      />

      {gameState === 'title' && !adventureHubOpen && (
        <TitleOverlay
          saveData={saveData}
          selectedMode={selectedMode}
          onSelectMode={(m) => {
            selectedModeRef.current = m;
            setSelectedMode(m);
          }}
          onStartGame={handleStartGame}
          onOpenAdventure={handleOpenAdventureHub}
          onOpenShop={(tab = 'bicycles') => {
            setShopInitialTab(tab);
            setShopOpen(true);
          }}
          onOpenMissions={() => setMissionsOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      {gameState === 'title' && adventureHubOpen && (
        <AdventureHubModal
          saveData={saveData}
          previewAreaId={adventurePreviewArea}
          onSelectPreviewArea={handleSelectPreviewArea}
          onStartLevel={handleStartAdventureLevel}
          onNewAdventure={handleNewAdventure}
          onBack={() => {
            setAdventureHubOpen(false);
            engineRef.current?.exitAdventurePreview();
          }}
        />
      )}

      {gameState === 'playing' && !adventureActive && (
        <GameHud
          hud={hud}
          muted={saveData.settings.muted}
          onToggleMute={() =>
            handleUpdateSettings({ muted: !saveData.settings.muted })
          }
          onPause={handlePause}
          onRestart={handleRestart}
          onSwipe={(dir) => engineRef.current?.triggerMobileSwipe(dir)}
          onJump={() => engineRef.current?.triggerJump()}
          onBrakeStart={() => engineRef.current?.setTouchBrake(true)}
          onBrakeEnd={() => engineRef.current?.setTouchBrake(false)}
        />
      )}

      {gameState === 'playing' && adventureActive && adventureHud && (
        <AdventureHud
          hud={adventureHud}
          muted={saveData.settings.muted}
          onToggleMute={() =>
            handleUpdateSettings({ muted: !saveData.settings.muted })
          }
          onPause={handlePause}
          onRestartCheckpoint={handleResumeCheckpoint}
          onCycleCamera={() => engineRef.current?.cycleAdventureCamera()}
          onTouchInput={(patch) => engineRef.current?.setAdventureTouchInput(patch)}
        />
      )}

      {gameState === 'paused' && !settingsOpen && (
        <PauseModal
          onResume={handleResume}
          onRestart={handleRestart}
          onOpenSettings={() => setSettingsOpen(true)}
          onMainMenu={handleMainMenu}
        />
      )}

      {gameState === 'gameover' && !adventureActive && runSnapshot && (
        <GameOverModal
          snapshot={runSnapshot}
          onRetry={handleRestart}
          onMainMenu={handleMainMenu}
        />
      )}

      {gameState === 'gameover' && adventureActive && adventureSnapshot && (
        <AdventureResultModal
          snapshot={adventureSnapshot}
          onResumeCheckpoint={handleResumeCheckpoint}
          onRestartLevel={handleRestart}
          onNextLevel={handleStartAdventureLevel}
          onBackToHub={handleOpenAdventureHub}
          onMainMenu={handleMainMenu}
        />
      )}

      {shopOpen && (
        <ShopModal
          saveData={saveData}
          initialTab={shopInitialTab}
          onBuyOrEquip={handleBuyOrEquip}
          onClose={() => setShopOpen(false)}
        />
      )}

      {missionsOpen && (
        <MissionsModal
          saveData={saveData}
          onSelectMission={handleSelectMission}
          onClaimReward={handleClaimMission}
          onClose={() => setMissionsOpen(false)}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          settings={saveData.settings}
          onUpdate={handleUpdateSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </main>
  );
}
