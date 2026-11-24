export type GameState = 'title' | 'playing' | 'paused' | 'gameover';

export type GameMode = 'endless' | 'time_challenge' | 'mission';

export type EnvironmentId =
  | 'city'
  | 'forest'
  | 'mountain'
  | 'desert'
  | 'neon_night';

export type PowerUpType =
  | 'shield'
  | 'speed_boost'
  | 'magnet'
  | 'double_score'
  | 'super_jump'
  | 'slow_motion';

export type ObstacleType =
  | 'cone'
  | 'barrier'
  | 'rock'
  | 'crate'
  | 'pothole'
  | 'parked_car'
  | 'moving_barrier'
  | 'construction_zone';

export type ShopCategory =
  | 'bicycles'
  | 'outfits'
  | 'skins'
  | 'effects'
  | 'environments';

export interface BicycleSpec {
  id: string;
  name: string;
  subtitle: string;
  cost: number;
  frameStyle: 'road' | 'track' | 'mtb' | 'hyper';
  speedBonus: number; // multiplier e.g. 1.0 - 1.15
  handlingBonus: number; // multiplier e.g. 1.0 - 1.25
  jumpBonus: number; // multiplier e.g. 1.0 - 1.2
  wheelRadius: number;
  tireWidth: number;
  accentHex: string;
}

export interface OutfitSpec {
  id: string;
  name: string;
  subtitle: string;
  cost: number;
  jerseyHex: string;
  jerseyStripeHex: string;
  shortsHex: string;
  helmetHex: string;
  gloveHex: string;
  shoeHex: string;
}

export interface SkinSpec {
  id: string;
  name: string;
  subtitle: string;
  cost: number;
  frameHex: string;
  forkHex: string;
  rimHex: string;
  metalness: number;
  roughness: number;
  clearcoat: number;
}

export interface EffectSpec {
  id: string;
  name: string;
  subtitle: string;
  cost: number;
  trailHex: string;
  secondaryHex: string;
}

export interface EnvironmentSpec {
  id: EnvironmentId;
  name: string;
  subtitle: string;
  cost: number;
  skyTopHex: string;
  skyHorizonHex: string;
  fogHex: string;
  fogDensity: number;
  sunColorHex: string;
  sunIntensity: number;
  hemiSkyHex: string;
  hemiGroundHex: string;
  hemiIntensity: number;
  roadBaseHex: string;
  roadLineHex: string;
  shoulderHex: string;
  groundHex: string;
  accentHex: string;
  isNight?: boolean;
}

export interface MissionDef {
  id: string;
  title: string;
  description: string;
  metric: 'distance' | 'coins' | 'dodges' | 'near_misses' | 'jumps' | 'score';
  target: number;
  rewardCoins: number;
}

export interface ActivePowerUpState {
  type: PowerUpType;
  remaining: number;
  duration: number;
}

export interface HudBanner {
  id: number;
  text: string;
  tone: 'gold' | 'cyan' | 'emerald' | 'amber' | 'rose';
}

export interface HudState {
  score: number;
  bestScore: number;
  distanceMeters: number;
  speedKmh: number;
  coinsRun: number;
  survivalSeconds: number;
  multiplier: number;
  dodgeStreak: number;
  difficultyStage: number;
  activePowerUps: ActivePowerUpState[];
  shieldCharges: number;
  mode: GameMode;
  timeRemainingSeconds: number;
  activeMissionId: string;
  activeMissionProgress: number;
  activeMissionTarget: number;
  activeMissionCompleted: boolean;
  isNewRecord: boolean;
  banner: HudBanner | null;
}

export interface RunSnapshot {
  score: number;
  bestScore: number;
  isNewRecord: boolean;
  distanceMeters: number;
  coinsEarned: number;
  survivalSeconds: number;
  dodgedObstacles: number;
  nearMisses: number;
  jumps: number;
  topSpeedKmh: number;
  difficultyStage: number;
  mode: GameMode;
  missionCompleted: boolean;
  missionTitle?: string;
  outcome: 'finished' | 'crashed';
}

export interface AdventureControlsConfig {
  accel: string;
  brake: string;
  left: string;
  right: string;
  jump: string;
  boost: string;
  wheelie: string;
  stoppie: string;
  manual: string;
  reset: string;
  camera: string;
}

export interface GameSettings {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  sensitivity: number; // 0.6 to 1.6
  adventureControls: AdventureControlsConfig;
}

export type AdventureAreaId =
  | 'mountain_cliff'
  | 'forest_trails'
  | 'canyon'
  | 'snow_mountains'
  | 'stunt_park';

export type AdventureSurfaceType =
  | 'dirt'
  | 'rock'
  | 'mud'
  | 'wood'
  | 'ice'
  | 'concrete';

export type AdventureTrickId =
  | 'wheelie'
  | 'stoppie'
  | 'manual'
  | 'frontflip'
  | 'backflip'
  | 'spin_360'
  | 'superman'
  | 'no_hands'
  | 'tabletop';

export type AdventureCameraMode =
  | 'chase'
  | 'downhill'
  | 'stunt'
  | 'jump'
  | 'landing';

export type AdventureCrashReason =
  | 'crash_landing'
  | 'crash_wheelie'
  | 'crash_stoppie'
  | 'crash_cliff'
  | 'crash_obstacle';

export interface AdventureAreaSpec {
  id: AdventureAreaId;
  name: string;
  subtitle: string;
  difficultyLabel: string;
  skyTopHex: string;
  skyHorizonHex: string;
  fogHex: string;
  fogDensity: number;
  sunColorHex: string;
  sunIntensity: number;
  hemiSkyHex: string;
  hemiGroundHex: string;
  hemiIntensity: number;
  trailHex: string;
  shoulderHex: string;
  terrainHex: string;
  terrainAltHex: string;
  accentHex: string;
  primarySurface: AdventureSurfaceType;
}

export interface AdventureObjectiveDef {
  metric:
    | 'finish'
    | 'wheelie_meters'
    | 'airtime_total'
    | 'combo_count'
    | 'stunt_score'
    | 'tricks_count';
  target: number;
  label: string;
}

export interface AdventureLevelDef {
  id: string;
  index: number; // 0..N-1 for campaign order, or >=100 for Stunt Challenges
  isChallenge: boolean;
  title: string;
  subtitle: string;
  areaId: AdventureAreaId;
  lengthMeters: number;
  checkpointsCount: number;
  parTimeSeconds: number;
  starThresholds: [number, number, number]; // [1-star finish, 2-star score, 3-star score]
  coinReward: number;
  objective: AdventureObjectiveDef;
  seed: number;
  steepness: number; // 0.35 .. 1.15
  hazardDensity: number; // 0.25 .. 1.0
  rampDensity: number; // 0.4 .. 1.2
}

export interface AdventureHudState {
  levelId: string;
  levelTitle: string;
  areaId: AdventureAreaId;
  areaName: string;
  isChallenge: boolean;
  speedKmh: number;
  distanceMeters: number;
  totalLengthMeters: number;
  elapsedSeconds: number;
  parTimeSeconds: number;
  stuntScore: number;
  totalScore: number;
  comboCount: number;
  comboMultiplier: number;
  comboPointsPending: number;
  comboTimerRatio: number; // 0..1
  airtimeSeconds: number;
  isAirborne: boolean;
  balanceMode: 'none' | 'wheelie' | 'stoppie' | 'manual';
  balanceValue: number; // -1 (endo limit) .. 0 (level) .. +1 (loop-out limit)
  balanceDuration: number;
  activeTrickLabel: string | null;
  lastLandingQuality: 'PERFECT' | 'CLEAN' | 'SLOPPY' | null;
  checkpointIndex: number; // 0..checkpointsCount
  checkpointsTotal: number;
  objectiveLabel: string;
  objectiveProgress: number;
  objectiveTarget: number;
  objectiveCompleted: boolean;
  tutorialHint: string | null;
  surface: AdventureSurfaceType;
  boostCharge: number; // 0..1
  isBoosting: boolean;
  cameraMode: AdventureCameraMode;
  alertText: string | null;
  alertTone: 'gold' | 'cyan' | 'emerald' | 'amber' | 'rose';
  coinsCollected: number;
}

export interface AdventureRunSnapshot {
  levelId: string;
  levelTitle: string;
  areaId: AdventureAreaId;
  isChallenge: boolean;
  outcome: 'completed' | 'crashed';
  crashReason?: AdventureCrashReason;
  totalScore: number;
  stuntScore: number;
  distanceMeters: number;
  totalLengthMeters: number;
  elapsedSeconds: number;
  parTimeSeconds: number;
  parTimeBeaten: boolean;
  starsEarned: number; // 0 if crashed, 1..3 if completed
  coinsAwarded: number;
  longestWheelieSeconds: number;
  longestJumpMeters: number;
  highestJumpMeters: number;
  bestComboCount: number;
  tricksLanded: number;
  objectiveCompleted: boolean;
  objectiveLabel: string;
  canResumeCheckpoint: boolean;
  checkpointIndex: number;
  isNewBestScore: boolean;
}

export interface AdventureSaveData {
  unlockedLevelIndex: number; // highest campaign level unlocked (0-based)
  currentLevelId: string;
  starsByLevel: Record<string, number>;
  bestScoreByLevel: Record<string, number>;
  completedLevels: string[];
  completedChallenges: string[];
  bestAdventureScore: number;
  bestStuntScore: number;
  longestWheelieSeconds: number;
  longestJumpMeters: number;
  highestJumpMeters: number;
  bestComboCount: number;
}

export interface PlayerSaveData {
  coins: number;
  bestScore: number;
  bestScoreByMode: Record<GameMode, number>;
  bestDistanceMeters: number;
  totalRuns: number;
  totalDistanceMeters: number;
  unlockedBicycles: string[];
  unlockedOutfits: string[];
  unlockedSkins: string[];
  unlockedEffects: string[];
  unlockedEnvironments: EnvironmentId[];
  equippedBicycle: string;
  equippedOutfit: string;
  equippedSkin: string;
  equippedEffect: string;
  equippedEnvironment: EnvironmentId;
  missionProgress: Record<string, number>;
  completedMissions: string[];
  claimedMissions: string[];
  activeMissionId: string;
  settings: GameSettings;
  adventure: AdventureSaveData;
}

export interface LoadoutConfig {
  bicycle: BicycleSpec;
  outfit: OutfitSpec;
  skin: SkinSpec;
  effect: EffectSpec;
}
