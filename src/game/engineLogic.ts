import type { BicycleSpec, ObstacleType, PowerUpType } from './types';

export const LANE_WIDTH = 2.6;
export const LANE_CENTERS = [-LANE_WIDTH, 0, LANE_WIDTH] as const;
export const ROAD_WIDTH = 9.2;
export const ROAD_HALF_CLAMP = LANE_WIDTH + 0.38;
export const SEGMENT_LENGTH = 24;
export const TIME_CHALLENGE_DURATION = 90;

export const BASE_START_SPEED_MPS = 8.0; // 28.8 km/h
export const MAX_NORMAL_SPEED_MPS = 17.5; // 63.0 km/h
export const BOOST_SPEED_MPS = 24.5; // 88.2 km/h
export const GRAVITY_MPS2 = 28.0;
export const BASE_JUMP_VELOCITY = 10.6; // ~2.0m apex, clears 1.1m barriers cleanly

export interface ObstacleBounds {
  halfWidth: number;
  height: number;
  halfLength: number;
  jumpable: boolean;
  isMoving: boolean;
}

export const OBSTACLE_BOUNDS: Record<ObstacleType, ObstacleBounds> = {
  cone: {
    halfWidth: 0.34,
    height: 0.72,
    halfLength: 0.34,
    jumpable: true,
    isMoving: false,
  },
  pothole: {
    halfWidth: 0.72,
    height: 0.25,
    halfLength: 0.78,
    jumpable: true,
    isMoving: false,
  },
  crate: {
    halfWidth: 0.56,
    height: 0.92,
    halfLength: 0.56,
    jumpable: true,
    isMoving: false,
  },
  rock: {
    halfWidth: 0.68,
    height: 0.85,
    halfLength: 0.65,
    jumpable: true,
    isMoving: false,
  },
  barrier: {
    halfWidth: 0.92,
    height: 1.02,
    halfLength: 0.36,
    jumpable: true,
    isMoving: false,
  },
  moving_barrier: {
    halfWidth: 0.75,
    height: 1.05,
    halfLength: 0.45,
    jumpable: true,
    isMoving: true,
  },
  parked_car: {
    halfWidth: 0.96,
    height: 1.62,
    halfLength: 2.15,
    jumpable: false,
    isMoving: false,
  },
  construction_zone: {
    halfWidth: 1.05,
    height: 1.38,
    halfLength: 1.75,
    jumpable: false,
    isMoving: false,
  },
};

export function getDifficultyStage(distanceMeters: number): number {
  if (distanceMeters < 150) return 1;
  return Math.min(12, 1 + Math.floor(distanceMeters / 180));
}

export function computeTargetSpeedMps(params: {
  distanceMeters: number;
  elapsedSeconds: number;
  throttle: number; // -1 brake, 0 neutral, +1 sprint
  isSpeedBoost: boolean;
  isSlowMotion: boolean;
  bike: Pick<BicycleSpec, 'speedBonus'>;
}): number {
  const { distanceMeters, elapsedSeconds, throttle, isSpeedBoost, isSlowMotion, bike } = params;
  // Smooth asymptotic ramp from starting pace toward normal max speed
  const progress = 1 - Math.exp(-(distanceMeters * 0.0014 + elapsedSeconds * 0.015));
  let normalSpeed =
    BASE_START_SPEED_MPS + (MAX_NORMAL_SPEED_MPS - BASE_START_SPEED_MPS) * progress;
  normalSpeed *= bike.speedBonus;

  if (throttle > 0) {
    normalSpeed *= 1.16;
  } else if (throttle < 0) {
    normalSpeed *= 0.68;
  }

  let speed = isSpeedBoost ? Math.max(normalSpeed * 1.25, BOOST_SPEED_MPS * bike.speedBonus) : normalSpeed;
  if (isSlowMotion) {
    speed *= 0.62;
  }
  return speed;
}

export function mpsToKmh(mps: number): number {
  return Math.round(mps * 3.6);
}

export function getJumpVelocity(bike: Pick<BicycleSpec, 'jumpBonus'>, superJumpActive: boolean): number {
  return BASE_JUMP_VELOCITY * bike.jumpBonus * (superJumpActive ? 1.32 : 1.0);
}

export interface PlayerBox {
  x: number;
  y: number; // feet/tire bottom height above road (0 when grounded)
  z: number;
  halfWidth: number;
  height: number;
  halfLength: number;
}

export interface ObstacleBox {
  x: number;
  z: number;
  type: ObstacleType;
}

export function checkCollisionAABB(player: PlayerBox, obs: ObstacleBox): boolean {
  const b = OBSTACLE_BOUNDS[obs.type];
  // Forgiving arcade hitbox (85% of visual bounds) so grazing edges feel fair
  const padX = (player.halfWidth + b.halfWidth) * 0.86;
  const padZ = (player.halfLength + b.halfLength) * 0.84;

  const dx = Math.abs(player.x - obs.x);
  const dz = Math.abs(player.z - obs.z);
  if (dx >= padX || dz >= padZ) return false;

  // Height check: if player tire height clears obstacle height * 0.92, safe!
  if (player.y >= b.height * 0.9) return false;

  return true;
}

export function checkNearMiss(player: PlayerBox, obs: ObstacleBox): boolean {
  if (checkCollisionAABB(player, obs)) return false;
  const b = OBSTACLE_BOUNDS[obs.type];
  const dz = Math.abs(player.z - obs.z);
  const nearZ = player.halfLength + b.halfLength + 0.55;
  if (dz > nearZ) return false;

  const dx = Math.abs(player.x - obs.x);
  const hitX = (player.halfWidth + b.halfWidth) * 0.86;
  const nearX = hitX + 0.72;
  const jumpedOver = player.y >= b.height * 0.85 && dx < hitX;

  return jumpedOver || (dx >= hitX && dx <= nearX && player.y < b.height + 0.4);
}

export function getScoreMultiplier(dodgeStreak: number, doubleScoreActive: boolean): number {
  const streakBonus = Math.min(4, Math.floor(dodgeStreak / 5));
  const base = 1 + streakBonus * 0.5;
  return doubleScoreActive ? base * 2 : base;
}

export function computeDistanceScoreDelta(distanceDeltaMeters: number, multiplier: number): number {
  return distanceDeltaMeters * 2.2 * multiplier;
}

export function computeCoinScore(multiplier: number): number {
  return Math.round(25 * multiplier);
}

export function computeDodgeScore(multiplier: number): number {
  return Math.round(20 * multiplier);
}

export function computeNearMissScore(multiplier: number): number {
  return Math.round(60 * multiplier);
}

export interface SpawnedObstaclePlan {
  laneIndex: number; // 0, 1, 2
  x: number;
  zOffset: number; // 0..SEGMENT_LENGTH
  type: ObstacleType;
  movePhase?: number;
  moveAmplitude?: number;
}

export interface SpawnedCoinPlan {
  x: number;
  y: number;
  zOffset: number;
}

export interface SpawnedPowerUpPlan {
  x: number;
  zOffset: number;
  type: PowerUpType;
}

export interface SegmentPlan {
  obstacles: SpawnedObstaclePlan[];
  coins: SpawnedCoinPlan[];
  powerUps: SpawnedPowerUpPlan[];
  variant: 'standard' | 'bridge' | 'tunnel';
}

const POWERUP_LIST: PowerUpType[] = [
  'shield',
  'speed_boost',
  'magnet',
  'double_score',
  'super_jump',
  'slow_motion',
];

export function generateSegmentPlan(
  segmentIndex: number,
  difficultyStage: number,
  rng: () => number = Math.random,
): SegmentPlan {
  // Keep opening segment completely clear so player has calm start
  if (segmentIndex <= 2) {
    const coins: SpawnedCoinPlan[] = [];
    if (segmentIndex === 2) {
      for (let i = 0; i < 4; i++) {
        coins.push({ x: 0, y: 0.65, zOffset: 6 + i * 3.5 });
      }
    }
    return {
      obstacles: [],
      coins,
      powerUps: [],
      variant: 'standard',
    };
  }

  let variant: SegmentPlan['variant'] = 'standard';
  if (segmentIndex % 11 === 5) variant = 'bridge';
  else if (segmentIndex % 15 === 10) variant = 'tunnel';

  const obstacles: SpawnedObstaclePlan[] = [];
  const coins: SpawnedCoinPlan[] = [];
  const powerUps: SpawnedPowerUpPlan[] = [];

  // Pool of available obstacle types weighted by difficulty
  const pool: ObstacleType[] =
    segmentIndex <= 4
      ? ['cone', 'crate', 'pothole']
      : ['cone', 'crate', 'pothole', 'barrier'];
  if (difficultyStage >= 2 && segmentIndex > 4) pool.push('rock', 'parked_car');
  if (difficultyStage >= 3) pool.push('moving_barrier', 'construction_zone');

  const rows = difficultyStage >= 4 ? 2 : 1;
  const rowOffsets = rows === 2 ? [5.0, 17.5] : [11.5];

  let lastSafeLane = 1;
  let prevRowHadMoving = false;

  for (const zOffset of rowOffsets) {
    // Always keep at least 1 guaranteed safe lane!
    const safeLane = Math.floor(rng() * 3);
    lastSafeLane = safeLane;

    // Decide how many of the remaining 2 lanes get obstacles
    const twoBlockChance = Math.min(0.62, 0.16 + difficultyStage * 0.055);
    const blockCount = rng() < twoBlockChance ? 2 : 1;
    const candidateLanes = [0, 1, 2].filter((l) => l !== safeLane);

    // Shuffle candidate lanes
    if (rng() < 0.5 && candidateLanes.length === 2) {
      const tmp = candidateLanes[0];
      candidateLanes[0] = candidateLanes[1];
      candidateLanes[1] = tmp;
    }

    let rowHasMoving = false;
    for (let i = 0; i < blockCount; i++) {
      const laneIdx = candidateLanes[i];
      let obsType = pool[Math.floor(rng() * pool.length)];
      // Never put moving barrier alongside another obstacle on same row or back-to-back rows
      if (obsType === 'moving_barrier' && (i > 0 || prevRowHadMoving || blockCount > 1)) {
        obsType = 'barrier';
      }
      if (obsType === 'moving_barrier') {
        rowHasMoving = true;
      }

      obstacles.push({
        laneIndex: laneIdx,
        x: LANE_CENTERS[laneIdx],
        zOffset,
        type: obsType,
        movePhase: rng() * Math.PI * 2,
        moveAmplitude: obsType === 'moving_barrier' ? LANE_WIDTH * 0.85 : 0,
      });
    }
    prevRowHadMoving = rowHasMoving;

    // Place a friendly coin arc along the safe lane or jumping arc over a low obstacle
    if (rng() < 0.8) {
      const coinLaneX = LANE_CENTERS[safeLane];
      for (let c = 0; c < 3; c++) {
        coins.push({
          x: coinLaneX,
          y: 0.65,
          zOffset: zOffset - 2.4 + c * 2.4,
        });
      }
    }
  }

  // Occasional jumpable coin arc in mid-segment
  if (rng() < 0.35 && coins.length === 0) {
    const arcX = LANE_CENTERS[lastSafeLane];
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      const arcY = 0.65 + Math.sin(t * Math.PI) * 1.1;
      coins.push({
        x: arcX,
        y: arcY,
        zOffset: 6 + i * 2.4,
      });
    }
  }

  // Power-up spawn roughly every 4-6 segments, cleanly separated from single-row coins
  const powerUpChance = 0.24;
  if (rng() < powerUpChance) {
    const pType = POWERUP_LIST[Math.floor(rng() * POWERUP_LIST.length)];
    powerUps.push({
      x: LANE_CENTERS[lastSafeLane],
      zOffset: rows === 1 ? 18.0 : 12.5,
      type: pType,
    });
  }

  return { obstacles, coins, powerUps, variant };
}
