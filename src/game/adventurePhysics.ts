import type {
  AdventureAreaId,
  AdventureCrashReason,
  AdventureLevelDef,
  AdventureSurfaceType,
  AdventureTrickId,
  BicycleSpec,
} from './types';

export const ADV_GRAVITY = 21.5;
export const WHEELBASE_METERS = 1.08;
export const HALF_WHEELBASE = 0.54;

export interface AdventureRamp {
  id: number;
  dStart: number;
  dEnd: number;
  height: number;
  xCenter: number;
  halfWidth: number;
  kind: 'kicker' | 'platform' | 'rail';
}

export interface AdventureBridge {
  id: number;
  dStart: number;
  dEnd: number;
  xCenter: number;
  halfWidth: number;
  style: 'wood' | 'suspended' | 'frozen';
  hasGapUnderneath: boolean;
}

export interface AdventureGap {
  id: number;
  dStart: number;
  dEnd: number;
}

export interface AdventureSurfacePatch {
  dStart: number;
  dEnd: number;
  surface: AdventureSurfaceType;
}

export interface AdventureObstacle {
  id: number;
  d: number;
  xOffset: number; // offset from trail centerline
  worldX: number;
  worldY: number;
  worldZ: number;
  radius: number;
  height: number;
  kind: 'rock' | 'fallen_log' | 'snow_boulder' | 'barrier';
  hit: boolean;
}

export interface AdventureCoin {
  id: number;
  d: number;
  x: number;
  y: number;
  z: number;
  collected: boolean;
}

export interface AdventureCheckpoint {
  index: number;
  d: number;
  x: number;
  y: number;
  z: number;
  reached: boolean;
}

export interface AdventureCourse {
  level: AdventureLevelDef;
  ramps: AdventureRamp[];
  bridges: AdventureBridge[];
  gaps: AdventureGap[];
  surfacePatches: AdventureSurfacePatch[];
  obstacles: AdventureObstacle[];
  coins: AdventureCoin[];
  checkpoints: AdventureCheckpoint[];
}

export interface TerrainSample {
  groundY: number;
  trailY: number;
  slopePitch: number; // radians: positive = uphill ahead, negative = downhill ahead
  trailCenterX: number;
  trailHalfWidth: number;
  isOffTrailCliff: boolean;
  isBridge: boolean;
  isGap: boolean;
  isRail: boolean;
  isHalfPipeWall: boolean;
  surface: AdventureSurfaceType;
  rampHeight: number;
  rampLipSlope: number; // upward launch slope if on ramp
}

export interface AdventureInputState {
  accel: boolean;
  brake: boolean;
  steerLeft: boolean;
  steerRight: boolean;
  jumpPressed: boolean; // edge or buffered
  trickPressed: boolean; // airborne spacebar / trick button
  trickHeld: boolean;
  boost: boolean;
  wheelie: boolean;
  stoppie: boolean;
  manual?: boolean;
  airPitchUp: boolean; // ArrowDown / backflip
  airPitchDown: boolean; // ArrowUp / frontflip
  airYawLeft: boolean; // ArrowLeft
  airYawRight: boolean; // ArrowRight
}

export interface AdventureSimEvent {
  type:
    | 'jump'
    | 'land'
    | 'trick'
    | 'combo_bank'
    | 'checkpoint'
    | 'coin'
    | 'crash'
    | 'finish';
  label?: string;
  tone?: 'gold' | 'cyan' | 'emerald' | 'amber' | 'rose';
  points?: number;
  crashReason?: AdventureCrashReason;
  landingQuality?: 'PERFECT' | 'CLEAN' | 'SLOPPY';
}

export interface AdventureSimState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  speedMps: number;
  elapsedSeconds: number;
  grounded: boolean;
  landSquash: number;
  suspensionOffset: number; // positive = compressed downward into fork/shock
  suspensionVel: number;
  boostCharge: number; // 0..1
  isBoosting: boolean;

  // Slope & Balance
  terrainSlopePitch: number;
  balancePitch: number; // + wheelie/manual, - stoppie
  balanceVel: number;
  balanceMode: 'none' | 'wheelie' | 'stoppie' | 'manual';
  balanceTimer: number;
  balanceMeters: number;
  balanceBankedThisStint: boolean;
  wheelieMetersTotal: number;
  longestWheelieSeconds: number;

  // Air & Stunts
  airtime: number;
  airtimeTotal: number;
  takeoffY: number;
  takeoffZ: number;
  peakJumpY: number;
  longestJumpMeters: number;
  highestJumpMeters: number;
  airPitchAngle: number;
  airPitchAccum: number;
  lastPitchSign: number;
  airYawAngle: number;
  airYawAccum: number;
  lastYawSign: number;
  activeTrickPose: 'none' | 'superman' | 'no_hands' | 'tabletop';
  trickHoldSeconds: number;
  trickCooldown: number;
  nextTrickCycleIndex: number;
  heldTricksThisJump: AdventureTrickId[];
  flipsAwardedThisJump: number;
  spinsAwardedThisJump: number;
  lastLandingQuality: 'PERFECT' | 'CLEAN' | 'SLOPPY' | null;

  // Scoring & Combos
  stuntScore: number;
  totalScore: number;
  comboCount: number;
  comboPendingPoints: number;
  comboTimer: number; // counts down to bank combo
  bestComboCount: number;
  tricksLanded: number;
  coinsCollected: number;
  activeTrickLabel: string | null;

  // Progression & Outcome
  checkpointIndex: number;
  checkpointX: number;
  checkpointY: number;
  checkpointZ: number;
  spawnGraceTimer: number;
  crashed: boolean;
  crashReason?: AdventureCrashReason;
  completed: boolean;
  surface: AdventureSurfaceType;
}

// Deterministic seeded PRNG (Mulberry32)
function createRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function normalizeAngle(rad: number): number {
  let a = rad % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function getAreaBaseSurface(areaId: AdventureAreaId): AdventureSurfaceType {
  switch (areaId) {
    case 'mountain_cliff':
      return 'rock';
    case 'forest_trails':
      return 'dirt';
    case 'canyon':
      return 'rock';
    case 'snow_mountains':
      return 'ice';
    case 'stunt_park':
      return 'concrete';
  }
}

export function getTrailCenterX(level: AdventureLevelDef, d: number): number {
  if (d < 16 || d > level.lengthMeters - 16) {
    // Keep start & finish gates cleanly centered
    const edgeFade = d < 16 ? d / 16 : (level.lengthMeters - d) / 16;
    const raw = computeRawCenterX(level, d);
    return raw * clamp(edgeFade, 0, 1);
  }
  return computeRawCenterX(level, d);
}

function computeRawCenterX(level: AdventureLevelDef, d: number): number {
  const phase = (level.seed % 97) * 0.1;
  switch (level.areaId) {
    case 'mountain_cliff':
      return (
        Math.sin(d * 0.022 + phase) * 5.2 +
        Math.sin(d * 0.051 + phase * 1.4) * 2.1
      );
    case 'forest_trails':
      return (
        Math.sin(d * 0.028 + phase) * 4.6 +
        Math.cos(d * 0.062) * 1.8
      );
    case 'canyon':
      return Math.sin(d * 0.019 + phase) * 4.4;
    case 'snow_mountains':
      return (
        Math.sin(d * 0.024 + phase) * 6.2 +
        Math.sin(d * 0.044) * 2.0
      );
    case 'stunt_park':
      return Math.sin(d * 0.012 + phase) * 1.6;
  }
}

export function getTrailHalfWidth(level: AdventureLevelDef, d: number): number {
  switch (level.areaId) {
    case 'mountain_cliff':
      return 2.65 + 0.35 * Math.sin(d * 0.04);
    case 'forest_trails':
      return 3.35;
    case 'canyon':
      return 2.85 + 0.3 * Math.cos(d * 0.035);
    case 'snow_mountains':
      return 3.25;
    case 'stunt_park':
      return 5.4;
  }
}

export function getBaseElevation(level: AdventureLevelDef, d: number): number {
  const s = level.steepness;
  const clampedD = clamp(d, 0, level.lengthMeters);
  switch (level.areaId) {
    case 'mountain_cliff':
      return (
        -clampedD * 0.115 * s +
        Math.sin(clampedD * 0.038) * 1.85 * s +
        Math.cos(clampedD * 0.017) * 1.4
      );
    case 'forest_trails':
      return (
        -clampedD * 0.055 * s +
        Math.sin(clampedD * 0.052) * 1.6 * s +
        Math.sin(clampedD * 0.021) * 1.1
      );
    case 'canyon':
      return (
        -clampedD * 0.08 * s +
        Math.sin(clampedD * 0.031) * 2.1 * s
      );
    case 'snow_mountains':
      return (
        -clampedD * 0.135 * s +
        Math.sin(clampedD * 0.042) * 2.0 * s
      );
    case 'stunt_park':
      return (
        -clampedD * 0.028 * s +
        Math.sin(clampedD * 0.045) * 1.15
      );
  }
}

export function buildAdventureCourse(level: AdventureLevelDef): AdventureCourse {
  const rng = createRng(level.seed);
  const ramps: AdventureRamp[] = [];
  const bridges: AdventureBridge[] = [];
  const gaps: AdventureGap[] = [];
  const surfacePatches: AdventureSurfacePatch[] = [];
  const obstacles: AdventureObstacle[] = [];
  const coins: AdventureCoin[] = [];
  const checkpoints: AdventureCheckpoint[] = [];

  const cpSpacing = level.lengthMeters / (level.checkpointsCount + 1);
  const cpDistances: number[] = [];
  for (let i = 1; i <= level.checkpointsCount; i++) {
    const d = Math.round(cpSpacing * i);
    cpDistances.push(d);
    const x = getTrailCenterX(level, d);
    const y = getBaseElevation(level, d);
    checkpoints.push({
      index: i,
      d,
      x,
      y,
      z: -d,
      reached: false,
    });
  }

  const nearCheckpoint = (d: number) =>
    cpDistances.some((cp) => Math.abs(cp - d) < 16);

  // Place bridges + canyon/river gaps + mega ramps cleanly spaced
  let cursor = 34;
  let rampId = 1;
  let bridgeId = 1;
  let gapId = 1;

  while (cursor < level.lengthMeters - 36) {
    if (nearCheckpoint(cursor)) {
      cursor += 18;
      continue;
    }

    const roll = rng();
    const trailX = getTrailCenterX(level, cursor);

    if (
      level.areaId !== 'stunt_park' &&
      roll < 0.24 &&
      cursor > 55 &&
      cursor < level.lengthMeters - 55
    ) {
      // Build a bridge crossing a valley/river/gorge
      const len = 18 + Math.round(rng() * 8);
      const style: AdventureBridge['style'] =
        level.areaId === 'canyon'
          ? 'suspended'
          : level.areaId === 'snow_mountains'
            ? 'frozen'
            : 'wood';
      bridges.push({
        id: bridgeId++,
        dStart: cursor,
        dEnd: cursor + len,
        xCenter: getTrailCenterX(level, cursor + len * 0.5),
        halfWidth: style === 'suspended' ? 1.55 : 1.85,
        style,
        hasGapUnderneath: true,
      });
      // Coins down the center of the bridge
      for (let cd = cursor + 3; cd <= cursor + len - 3; cd += 4) {
        const bx = getTrailCenterX(level, cursor + len * 0.5);
        coins.push({
          id: coins.length + 1,
          d: cd,
          x: bx,
          y: getBaseElevation(level, cd) + 0.85,
          z: -cd,
          collected: false,
        });
      }
      cursor += len + 24;
      continue;
    }

    // Ramp / Stunt kicker (+ optional gap)
    if (roll < 0.24 + 0.56 * level.rampDensity) {
      const isPark = level.areaId === 'stunt_park';
      const len = isPark ? 9 + rng() * 3 : 6.5 + rng() * 3;
      const height = isPark
        ? 1.7 + rng() * 0.9
        : 1.05 + rng() * 0.85 * Math.min(1.25, level.rampDensity);

      const addGap =
        (level.areaId === 'canyon' ||
          level.areaId === 'stunt_park' ||
          level.index >= 3) &&
        rng() < 0.45 &&
        !nearCheckpoint(cursor + len + 6);

      ramps.push({
        id: rampId++,
        dStart: cursor,
        dEnd: cursor + len,
        height,
        xCenter: trailX,
        halfWidth: isPark ? 3.2 : 1.9,
        kind: 'kicker',
      });

      const gapLen = addGap ? (isPark ? 7.5 : 5.5) : 0;
      if (addGap) {
        gaps.push({
          id: gapId++,
          dStart: cursor + len + 0.4,
          dEnd: cursor + len + gapLen,
        });
      }

      // Coin arc above launch!
      for (let k = 0; k < 3; k++) {
        const cd = cursor + len + 1.4 + k * 2.2;
        const arcY =
          getBaseElevation(level, cd) + height + 1.2 + Math.sin((k / 2) * Math.PI) * 1.1;
        coins.push({
          id: coins.length + 1,
          d: cd,
          x: trailX,
          y: arcY,
          z: -cd,
          collected: false,
        });
      }

      // Optional Stunt Park elevated tabletop / rail right after non-gap kickers
      if (isPark && !addGap && rng() < 0.55) {
        const platStart = cursor + len + 14;
        if (platStart < level.lengthMeters - 40 && !nearCheckpoint(platStart)) {
          const isRail = rng() < 0.5;
          ramps.push({
            id: rampId++,
            dStart: platStart,
            dEnd: platStart + (isRail ? 14 : 16),
            height: isRail ? 0.65 : 1.15,
            xCenter: getTrailCenterX(level, platStart + 7),
            halfWidth: isRail ? 0.55 : 2.1,
            kind: isRail ? 'rail' : 'platform',
          });
          cursor = platStart + 28;
          continue;
        }
      }

      cursor += len + gapLen + 20;
      continue;
    }

    // Surface patches (Mud in Forest, Ice on Snow, Dirt/Rock on Canyon/Mountain)
    if (level.areaId === 'forest_trails' || level.areaId === 'snow_mountains') {
      const patchLen = 14 + rng() * 10;
      surfacePatches.push({
        dStart: cursor,
        dEnd: cursor + patchLen,
        surface: level.areaId === 'forest_trails' ? 'mud' : 'ice',
      });
    }

    cursor += 20;
  }

  // Place dodgeable obstacles cleanly outside ramp lips & bridges
  let obsId = 1;
  const obsInterval = Math.max(15, Math.round(28 - level.hazardDensity * 12));
  for (let d = 32; d < level.lengthMeters - 26; d += obsInterval) {
    if (nearCheckpoint(d)) continue;
    const onRampOrGap =
      ramps.some((r) => d >= r.dStart - 5 && d <= r.dEnd + 10) ||
      gaps.some((g) => d >= g.dStart - 4 && d <= g.dEnd + 6) ||
      bridges.some((b) => d >= b.dStart - 4 && d <= b.dEnd + 4);
    if (onRampOrGap) continue;

    const halfW = getTrailHalfWidth(level, d);
    const side = rng() > 0.5 ? 1 : -1;
    const offset = side * (0.55 + rng() * Math.max(0.4, halfW - 1.35));
    const worldX = getTrailCenterX(level, d) + offset;
    const worldY = getBaseElevation(level, d);

    let kind: AdventureObstacle['kind'] = 'rock';
    if (level.areaId === 'forest_trails') kind = rng() < 0.6 ? 'fallen_log' : 'rock';
    else if (level.areaId === 'snow_mountains') kind = 'snow_boulder';
    else if (level.areaId === 'stunt_park') kind = 'barrier';

    obstacles.push({
      id: obsId++,
      d,
      xOffset: offset,
      worldX,
      worldY,
      worldZ: -d,
      radius: kind === 'fallen_log' ? 0.72 : 0.62,
      height: kind === 'fallen_log' ? 0.58 : 0.92,
      kind,
      hit: false,
    });

    // Place a guiding coin on the opposite safe side!
    coins.push({
      id: coins.length + 1,
      d,
      x: getTrailCenterX(level, d) - side * Math.min(1.3, halfW * 0.45),
      y: worldY + 0.75,
      z: -d,
      collected: false,
    });
  }

  return {
    level,
    ramps,
    bridges,
    gaps,
    surfacePatches,
    obstacles,
    coins,
    checkpoints,
  };
}

export function sampleAdventureTerrain(
  course: AdventureCourse,
  x: number,
  z: number,
): TerrainSample {
  const d = clamp(-z, -10, course.level.lengthMeters + 30);
  const trailCenterX = getTrailCenterX(course.level, d);
  const trailHalfWidth = getTrailHalfWidth(course.level, d);
  const trailY = getBaseElevation(course.level, d);

  let groundY = trailY;
  let surface: AdventureSurfaceType = getAreaBaseSurface(course.level.areaId);
  let isOffTrailCliff = false;
  let isBridge = false;
  let isGap = false;
  let isRail = false;
  let isHalfPipeWall = false;
  let rampHeight = 0;
  let rampLipSlope = 0;

  // Check bridge first
  const bridge = course.bridges.find((b) => d >= b.dStart && d <= b.dEnd);
  if (bridge) {
    surface = bridge.style === 'frozen' ? 'ice' : 'wood';
    if (Math.abs(x - bridge.xCenter) <= bridge.halfWidth) {
      isBridge = true;
      // Subtle arch on bridge deck
      const bt = (d - bridge.dStart) / (bridge.dEnd - bridge.dStart);
      groundY = trailY + Math.sin(bt * Math.PI) * 0.45;
    } else {
      isGap = true;
      isOffTrailCliff = true;
      groundY = trailY - 12;
    }
  } else {
    // Check jump gap
    const gap = course.gaps.find((g) => d >= g.dStart && d <= g.dEnd);
    if (gap) {
      isGap = true;
      isOffTrailCliff = true;
      groundY = trailY - 12;
    } else {
      // Check surface patch
      const patch = course.surfacePatches.find(
        (p) => d >= p.dStart && d <= p.dEnd,
      );
      if (patch) surface = patch.surface;

      // Check lateral bounds (cliff / forest bank / half-pipe bowl wall)
      const latDist = Math.abs(x - trailCenterX);
      if (course.level.areaId === 'stunt_park') {
        if (latDist > trailHalfWidth - 1.1) {
          isHalfPipeWall = true;
          const wallT = clamp((latDist - (trailHalfWidth - 1.1)) / 3.6, 0, 1.35);
          groundY = trailY + wallT * wallT * 3.1;
          if (latDist > trailHalfWidth + 3.2) {
            isOffTrailCliff = true;
          }
        }
      } else if (latDist > trailHalfWidth) {
        const excess = latDist - trailHalfWidth;
        if (course.level.areaId === 'forest_trails') {
          // Bumpy rough shoulder, forgiving
          surface = 'mud';
          groundY = trailY + Math.min(1.8, excess * 0.35);
        } else {
          // Mountain Cliff, Canyon, Snow Mountains: steep drop-off past shoulder margin
          if (excess > 0.7) {
            isOffTrailCliff = true;
            groundY = trailY - Math.min(14, (excess - 0.7) * 3.6);
          } else {
            groundY = trailY - excess * 0.4;
          }
        }
      }

      // Check ramps / platforms / rails
      for (const r of course.ramps) {
        if (d >= r.dStart && d <= r.dEnd && Math.abs(x - r.xCenter) <= r.halfWidth) {
          const t = (d - r.dStart) / (r.dEnd - r.dStart);
          if (r.kind === 'kicker') {
            // Smooth quadratic launch curve peaking at dEnd
            const h = r.height * (t * t * 0.7 + t * 0.3);
            if (trailY + h > groundY) {
              groundY = trailY + h;
              rampHeight = h;
              rampLipSlope = (r.height / (r.dEnd - r.dStart)) * (1.4 * t + 0.3);
              surface = course.level.areaId === 'stunt_park' ? 'concrete' : 'wood';
            }
          } else {
            // Platform or Rail with smooth entry/exit transitions
            const edge = 0.14;
            const rampFactor =
              t < edge ? t / edge : t > 1 - edge ? (1 - t) / edge : 1;
            const h = r.height * clamp(rampFactor, 0, 1);
            if (trailY + h > groundY) {
              groundY = trailY + h;
              rampHeight = h;
              isRail = r.kind === 'rail';
              surface = isRail ? 'concrete' : surface;
            }
          }
        }
      }
    }
  }

  // Slope estimation using small dz sample when on continuous trail
  const trailAhead = getBaseElevation(course.level, d + 1.2);
  const trailBehind = getBaseElevation(course.level, Math.max(0, d - 1.2));
  let slopePitch = Math.atan2(trailAhead - trailBehind, 2.4);
  if (rampLipSlope > 0) {
    slopePitch += Math.atan(rampLipSlope);
  }

  return {
    groundY,
    trailY,
    slopePitch,
    trailCenterX,
    trailHalfWidth,
    isOffTrailCliff,
    isBridge,
    isGap,
    isRail,
    isHalfPipeWall,
    surface,
    rampHeight,
    rampLipSlope,
  };
}

export function createInitialAdventureState(
  course: AdventureCourse,
): AdventureSimState {
  const startX = getTrailCenterX(course.level, 0);
  const startY = getBaseElevation(course.level, 0);
  const sample = sampleAdventureTerrain(course, startX, 0);
  return {
    x: startX,
    y: startY,
    z: 0,
    vx: 0,
    vy: 0,
    speedMps: 6.5,
    elapsedSeconds: 0,
    grounded: true,
    landSquash: 0,
    suspensionOffset: 0,
    suspensionVel: 0,
    boostCharge: 1.0,
    isBoosting: false,
    terrainSlopePitch: sample.slopePitch,
    balancePitch: 0,
    balanceVel: 0,
    balanceMode: 'none',
    balanceTimer: 0,
    balanceMeters: 0,
    balanceBankedThisStint: false,
    wheelieMetersTotal: 0,
    longestWheelieSeconds: 0,
    airtime: 0,
    airtimeTotal: 0,
    takeoffY: startY,
    takeoffZ: 0,
    peakJumpY: startY,
    longestJumpMeters: 0,
    highestJumpMeters: 0,
    airPitchAngle: sample.slopePitch,
    airPitchAccum: 0,
    lastPitchSign: 1,
    airYawAngle: 0,
    airYawAccum: 0,
    lastYawSign: 1,
    activeTrickPose: 'none',
    trickHoldSeconds: 0,
    trickCooldown: 0,
    nextTrickCycleIndex: 0,
    heldTricksThisJump: [],
    flipsAwardedThisJump: 0,
    spinsAwardedThisJump: 0,
    lastLandingQuality: null,
    stuntScore: 0,
    totalScore: 0,
    comboCount: 0,
    comboPendingPoints: 0,
    comboTimer: 0,
    bestComboCount: 0,
    tricksLanded: 0,
    coinsCollected: 0,
    activeTrickLabel: null,
    checkpointIndex: 0,
    checkpointX: startX,
    checkpointY: startY,
    checkpointZ: 0,
    spawnGraceTimer: 0.75,
    crashed: false,
    completed: false,
    surface: sample.surface,
  };
}

export function restoreAdventureCheckpoint(
  course: AdventureCourse,
  prev: AdventureSimState,
): AdventureSimState {
  const cp =
    prev.checkpointIndex > 0
      ? course.checkpoints[prev.checkpointIndex - 1]
      : null;
  const x = cp ? cp.x : getTrailCenterX(course.level, 0);
  const y = cp ? cp.y : getBaseElevation(course.level, 0);
  const z = cp ? cp.z : 0;
  const cpD = cp ? cp.d : 0;
  // Ensure immediate checkpoint recovery zone has no obstructing hit hazards
  for (const obs of course.obstacles) {
    if (obs.d >= cpD - 3 && obs.d <= cpD + 14) {
      obs.hit = true;
    }
  }
  const sample = sampleAdventureTerrain(course, x, z);
  return {
    ...prev,
    x,
    y,
    z,
    vx: 0,
    vy: 0,
    speedMps: 7.5,
    grounded: true,
    landSquash: 0,
    suspensionOffset: 0,
    suspensionVel: 0,
    isBoosting: false,
    boostCharge: Math.max(0.5, prev.boostCharge),
    terrainSlopePitch: sample.slopePitch,
    balancePitch: 0,
    balanceVel: 0,
    balanceMode: 'none',
    balanceTimer: 0,
    balanceMeters: 0,
    balanceBankedThisStint: false,
    airtime: 0,
    airPitchAngle: sample.slopePitch,
    airPitchAccum: 0,
    lastPitchSign: 1,
    airYawAngle: 0,
    airYawAccum: 0,
    lastYawSign: 1,
    activeTrickPose: 'none',
    trickHoldSeconds: 0,
    trickCooldown: 0,
    heldTricksThisJump: [],
    flipsAwardedThisJump: 0,
    spinsAwardedThisJump: 0,
    comboCount: 0,
    comboPendingPoints: 0,
    comboTimer: 0,
    activeTrickLabel: null,
    spawnGraceTimer: 0.9,
    crashed: false,
    crashReason: undefined,
    surface: sample.surface,
  };
}

function addComboTrick(
  state: AdventureSimState,
  events: AdventureSimEvent[],
  label: string,
  basePoints: number,
): void {
  state.comboCount += 1;
  state.bestComboCount = Math.max(state.bestComboCount, state.comboCount);
  state.comboPendingPoints += basePoints;
  state.comboTimer = 2.6;
  state.tricksLanded += 1;
  state.activeTrickLabel = `${label} +${basePoints}`;
  events.push({
    type: 'trick',
    label: `${label} (+${basePoints})`,
    tone: 'amber',
    points: basePoints,
  });
}

function bankComboIfActive(
  state: AdventureSimState,
  events: AdventureSimEvent[],
): void {
  if (state.comboPendingPoints <= 0) {
    state.comboCount = 0;
    state.comboTimer = 0;
    return;
  }
  const mult = Math.min(5, 1 + Math.max(0, state.comboCount - 1) * 0.5);
  const banked = Math.round(state.comboPendingPoints * mult);
  state.stuntScore += banked;
  state.totalScore += banked;
  events.push({
    type: 'combo_bank',
    label:
      state.comboCount > 1
        ? `${state.comboCount}× COMBO +${banked}`
        : `STUNT +${banked}`,
    tone: state.comboCount > 1 ? 'gold' : 'emerald',
    points: banked,
  });
  state.comboCount = 0;
  state.comboPendingPoints = 0;
  state.comboTimer = 0;
}

export function stepAdventurePhysics(
  state: AdventureSimState,
  course: AdventureCourse,
  input: AdventureInputState,
  bike: BicycleSpec,
  sensitivity: number,
  rawDt: number,
): AdventureSimEvent[] {
  const events: AdventureSimEvent[] = [];
  if (state.crashed || state.completed) return events;

  const dt = clamp(rawDt, 0.001, 0.05);
  state.elapsedSeconds += dt;
  state.landSquash = Math.max(0, state.landSquash - dt * 5.2);
  if (state.trickCooldown > 0) state.trickCooldown = Math.max(0, state.trickCooldown - dt);
  if (state.spawnGraceTimer > 0) state.spawnGraceTimer = Math.max(0, state.spawnGraceTimer - dt);

  // Sample terrain under rear/front wheels for slope & ground height
  const currentSample = sampleAdventureTerrain(course, state.x, state.z);
  const rearSample = sampleAdventureTerrain(course, state.x, state.z + HALF_WHEELBASE);
  const frontSample = sampleAdventureTerrain(course, state.x, state.z - HALF_WHEELBASE);

  const groundY = currentSample.groundY;
  state.surface = currentSample.surface;
  state.terrainSlopePitch =
    !currentSample.isGap && !frontSample.isGap && !rearSample.isGap
      ? Math.atan2(frontSample.groundY - rearSample.groundY, WHEELBASE_METERS)
      : currentSample.slopePitch;

  // Boost charge & consumption
  const wantsBoost = input.boost && state.boostCharge > 0.08;
  state.isBoosting = wantsBoost;
  if (wantsBoost) {
    state.boostCharge = Math.max(0, state.boostCharge - dt * 0.42);
  } else {
    state.boostCharge = Math.min(1, state.boostCharge + dt * 0.14);
  }

  // Forward acceleration, slope gravity, braking & surface drag
  const maxSpeedBase = 24.5 * bike.speedBonus;
  const maxSpeed = state.isBoosting ? maxSpeedBase * 1.28 : maxSpeedBase;

  if (state.grounded) {
    // Slope gravity effect: downhill (-slopePitch) pushes speed up, uphill pulls down
    const slopeGravity = -Math.sin(state.terrainSlopePitch) * ADV_GRAVITY * 0.88;
    let drive = 0;
    if (input.accel && !input.manual) drive += 14.0 * bike.speedBonus;
    if (state.isBoosting) drive += 15.5;
    if (input.brake) drive -= 20.5;

    // Rolling drag + mud slowdown
    const mudDrag = state.surface === 'mud' ? 2.6 : 0.22;
    const aeroDrag = 0.011 * state.speedMps * state.speedMps;

    state.speedMps += (drive + slopeGravity - aeroDrag - mudDrag * Math.sign(state.speedMps)) * dt;
    state.speedMps = clamp(state.speedMps, input.brake ? 1.8 : 3.2, maxSpeed);

    // 2nd-order spring-damper suspension response (micro-bumps on rough rock/mud + braking dive)
    const bumpAccel =
      state.surface === 'rock' || state.surface === 'mud'
        ? Math.sin(state.z * 3.1) * 0.14 * (state.speedMps / 15)
        : 0;
    const brakeDive = input.brake || input.stoppie ? -0.018 : 0;
    const suspForce =
      -148 * (state.suspensionOffset - brakeDive) - 14 * state.suspensionVel + bumpAccel;
    state.suspensionVel += suspForce * dt;
    state.suspensionOffset = clamp(state.suspensionOffset + state.suspensionVel * dt, -0.04, 0.14);
  } else {
    // Slight air drag preserves launch momentum & suspension extends to full travel
    state.speedMps = clamp(state.speedMps - 0.35 * dt, 3.5, maxSpeed * 1.15);
    const suspForce = -92 * (state.suspensionOffset + 0.025) - 12 * state.suspensionVel;
    state.suspensionVel += suspForce * dt;
    state.suspensionOffset = clamp(state.suspensionOffset + state.suspensionVel * dt, -0.04, 0.14);
  }

  // Steering & Surface Grip (Ice has realistic reduced lateral grip)
  let steerInput = 0;
  if (input.steerLeft) steerInput -= 1;
  if (input.steerRight) steerInput += 1;

  const lateralMax = 8.4 * bike.handlingBonus * sensitivity;
  if (state.grounded) {
    const gripDamp =
      state.surface === 'ice'
        ? 4.2
        : state.surface === 'mud'
          ? 7.5
          : 14.5;
    const targetVx = steerInput * lateralMax * (state.surface === 'ice' ? 1.15 : 1.0);
    const alpha = 1 - Math.exp(-gripDamp * dt);
    state.vx = state.vx + (targetVx - state.vx) * alpha;
  } else {
    // Subtle air carve
    const targetVx = steerInput * lateralMax * 0.42;
    state.vx += (targetVx - state.vx) * (1 - Math.exp(-3.5 * dt));
  }

  // Advance forward & sideways
  const prevGroundY = groundY;
  const prevRampLipSlope = currentSample.rampLipSlope;
  const dz = state.speedMps * dt;
  state.z -= dz;
  state.x += state.vx * dt;

  // Score small distance points cleanly
  state.totalScore += dz * 1.25;

  // Re-sample terrain at new position & apply safe lateral containment for forest / stunt park banks
  const dAfter = clamp(-state.z, 0, course.level.lengthMeters);
  const centerAfter = getTrailCenterX(course.level, dAfter);
  const halfWAfter = getTrailHalfWidth(course.level, dAfter);
  if (course.level.areaId === 'forest_trails') {
    const forestMaxOffset = halfWAfter + 4.8;
    if (Math.abs(state.x - centerAfter) > forestMaxOffset) {
      const sign = Math.sign(state.x - centerAfter);
      state.x = centerAfter + sign * forestMaxOffset;
      state.vx = -sign * Math.max(1.5, Math.abs(state.vx) * 0.35);
    }
  } else if (course.level.areaId === 'stunt_park') {
    const bowlMaxOffset = halfWAfter + 2.4;
    if (Math.abs(state.x - centerAfter) > bowlMaxOffset) {
      const sign = Math.sign(state.x - centerAfter);
      state.x = centerAfter + sign * bowlMaxOffset;
      state.vx = -sign * Math.max(2.0, Math.abs(state.vx) * 0.55);
    }
  }

  const nextSample = sampleAdventureTerrain(course, state.x, state.z);

  // Check if bike rode off a ramp lip or sudden cliff drop -> natural airborne launch!
  if (state.grounded) {
    const dropGap = nextSample.groundY - state.y;
    const rodeOffKickerLip =
      prevRampLipSlope > 0.08 && nextSample.rampLipSlope <= 0.01 && state.speedMps > 7.5;
    const rodeOffDrop = dropGap < -0.42 && state.speedMps > 8.5;

    if (input.jumpPressed || rodeOffKickerLip || rodeOffDrop) {
      const rampBoostVy = rodeOffKickerLip
        ? Math.min(11.5, state.speedMps * prevRampLipSlope * 1.18 + 3.2)
        : 0;
      const bunnyHopVy = input.jumpPressed
        ? (8.2 + (state.balanceMode === 'wheelie' || state.balanceMode === 'manual' ? 0.9 : 0)) * bike.jumpBonus
        : 0;
      state.grounded = false;
      state.vy = Math.max(rampBoostVy, bunnyHopVy, rodeOffDrop ? 1.5 : 0);
      state.takeoffY = state.y;
      state.takeoffZ = state.z;
      state.peakJumpY = state.y;
      state.airtime = 0;
      state.airPitchAngle = state.terrainSlopePitch + state.balancePitch * 0.5;
      state.airPitchAccum = 0;
      state.lastPitchSign = 1;
      state.airYawAngle = 0;
      state.airYawAccum = 0;
      state.lastYawSign = 1;
      state.activeTrickPose = 'none';
      state.trickHoldSeconds = 0;
      state.heldTricksThisJump = [];
      state.flipsAwardedThisJump = 0;
      state.spinsAwardedThisJump = 0;
      state.balancePitch = 0;
      state.balanceVel = 0;
      state.balanceMode = 'none';
      state.balanceTimer = 0;
      state.balanceMeters = 0;
      state.balanceBankedThisStint = false;
      events.push({ type: 'jump' });
    }
  }

  // Grounded vs Airborne update
  if (state.grounded) {
    // Follow terrain smoothly, plus half-pipe lateral boost
    state.y = nextSample.groundY;
    state.vy = 0;

    // Cliff / Chasm check when grounded
    if (nextSample.isOffTrailCliff && (nextSample.isGap || state.y < nextSample.trailY - 2.4)) {
      state.crashed = true;
      state.crashReason = 'crash_cliff';
      bankComboIfActive(state, events);
      events.push({
        type: 'crash',
        crashReason: 'crash_cliff',
        label: 'FELL OFF TRAIL!',
        tone: 'rose',
      });
      return events;
    }

    // Wheelie / Stoppie / Manual Balance Physics
    const wantManual = Boolean(input.manual);
    const wantWheelie = input.wheelie && !wantManual;
    const wantStoppie = input.stoppie && (input.brake || state.speedMps > 4.2);

    if (wantManual && !wantStoppie) {
      state.balanceVel += 3.65 * dt;
    } else if (wantWheelie && !wantStoppie) {
      state.balanceVel += 3.85 * dt;
    } else if (wantStoppie && !wantWheelie && !wantManual) {
      state.balanceVel -= 3.75 * dt;
    } else {
      // Natural self-centering gravity return when inside safe zone, or tip-over past balance peak
      if (state.balancePitch > 0.72) {
        state.balanceVel += (state.balancePitch - 0.72) * 3.1 * dt;
      } else if (state.balancePitch < -0.66) {
        state.balanceVel -= (-0.66 - state.balancePitch) * 3.1 * dt;
      } else {
        state.balanceVel += -state.balancePitch * 4.4 * dt;
      }
    }

    state.balanceVel *= Math.exp(-3.4 * dt);
    state.balancePitch += state.balanceVel * dt;

    // Check Wheelie Loop-Out or Stoppie Endo Crash!
    if (state.balancePitch > 1.06) {
      state.crashed = true;
      state.crashReason = 'crash_wheelie';
      events.push({
        type: 'crash',
        crashReason: 'crash_wheelie',
        label: wantManual ? 'MANUAL LOOPED OUT!' : 'WHEELIE LOOPED OUT!',
        tone: 'rose',
      });
      return events;
    }
    if (state.balancePitch < -0.94) {
      state.crashed = true;
      state.crashReason = 'crash_stoppie';
      events.push({
        type: 'crash',
        crashReason: 'crash_stoppie',
        label: 'STOPPIE ENDO CRASH!',
        tone: 'rose',
      });
      return events;
    }

    const inWheelieZone = state.balancePitch >= 0.22;
    const inStoppieZone = state.balancePitch <= -0.20;

    if (inWheelieZone) {
      const mode: 'wheelie' | 'manual' =
        wantManual ||
        state.balanceMode === 'manual' ||
        nextSample.isRail ||
        nextSample.isBridge
          ? 'manual'
          : 'wheelie';
      state.balanceMode = mode;
      state.balanceTimer += dt;
      state.balanceMeters += dz;
      state.wheelieMetersTotal += dz;
      state.longestWheelieSeconds = Math.max(
        state.longestWheelieSeconds,
        state.balanceTimer,
      );
      state.comboTimer = Math.max(state.comboTimer, 1.4);

      if (!state.balanceBankedThisStint && state.balanceTimer >= 0.55) {
        state.balanceBankedThisStint = true;
        addComboTrick(
          state,
          events,
          mode === 'manual' ? 'MANUAL' : 'WHEELIE',
          mode === 'manual' ? 180 : 140,
        );
      } else if (state.balanceBankedThisStint) {
        // Continuous drip score while holding balance without creating duplicate combo ticks
        const drip = dz * (mode === 'manual' ? 9.5 : 8);
        state.stuntScore += drip;
        state.totalScore += drip;
      }
    } else if (inStoppieZone) {
      state.balanceMode = 'stoppie';
      state.balanceTimer += dt;
      state.balanceMeters += dz;
      state.wheelieMetersTotal += dz;
      state.longestWheelieSeconds = Math.max(
        state.longestWheelieSeconds,
        state.balanceTimer,
      );
      state.comboTimer = Math.max(state.comboTimer, 1.4);

      if (!state.balanceBankedThisStint && state.balanceTimer >= 0.5) {
        state.balanceBankedThisStint = true;
        addComboTrick(state, events, 'STOPPIE', 160);
      } else if (state.balanceBankedThisStint) {
        const drip = dz * 9;
        state.stuntScore += drip;
        state.totalScore += drip;
      }
    } else {
      state.balanceMode = 'none';
      state.balanceTimer = 0;
      state.balanceMeters = 0;
      state.balanceBankedThisStint = false;
    }
  } else {
    // Airborne kinematics & Stunts
    state.airtime += dt;
    state.airtimeTotal += dt;
    state.vy -= ADV_GRAVITY * dt;
    state.y += state.vy * dt;
    if (state.y > state.peakJumpY) state.peakJumpY = state.y;

    // Air Pitch (Backflip / Frontflip)
    let pitchRate = 0;
    if (input.airPitchDown) pitchRate -= 4.75; // Frontflip (nose down, -X in Three.js -Z forward)
    if (input.airPitchUp) pitchRate += 4.75; // Backflip (nose up, +X)
    if (pitchRate !== 0) state.lastPitchSign = Math.sign(pitchRate);
    state.airPitchAngle += pitchRate * dt;
    state.airPitchAccum += Math.abs(pitchRate) * dt;

    // Air Yaw (360° Spin)
    let yawRate = 0;
    if (input.airYawLeft) yawRate += 4.9;
    if (input.airYawRight) yawRate -= 4.9;
    if (yawRate !== 0) state.lastYawSign = Math.sign(yawRate);
    state.airYawAngle += yawRate * dt;
    state.airYawAccum += Math.abs(yawRate) * dt;

    // Detect completed flips & spins in midair (strictly gated per full ~300 deg rotation)
    const completedFlips = Math.floor(state.airPitchAccum / (Math.PI * 1.65));
    if (completedFlips > state.flipsAwardedThisJump) {
      state.flipsAwardedThisJump = completedFlips;
      const effectivePitchSign = pitchRate !== 0 ? pitchRate : state.lastPitchSign;
      const isBackflip = effectivePitchSign >= 0;
      addComboTrick(
        state,
        events,
        isBackflip ? 'BACKFLIP' : 'FRONTFLIP',
        350,
      );
    }

    const completedSpins = Math.floor(state.airYawAccum / (Math.PI * 1.65));
    if (completedSpins > state.spinsAwardedThisJump) {
      state.spinsAwardedThisJump = completedSpins;
      addComboTrick(state, events, '360 SPIN', 300);
    }

    // Aerial Pose Tricks (Superman / No-Hands / Tabletop) via Trick/Space input
    if (input.trickPressed && state.trickCooldown <= 0) {
      const cycle: ('superman' | 'no_hands' | 'tabletop')[] = [
        'superman',
        'no_hands',
        'tabletop',
      ];
      state.activeTrickPose = cycle[state.nextTrickCycleIndex % cycle.length];
      state.nextTrickCycleIndex += 1;
      state.trickHoldSeconds = 0;
      state.trickCooldown = 0.25;
    }

    if (state.activeTrickPose !== 'none') {
      state.trickHoldSeconds += dt;
      const poseId: AdventureTrickId = state.activeTrickPose;
      if (
        state.trickHoldSeconds >= 0.36 &&
        !state.heldTricksThisJump.includes(poseId)
      ) {
        state.heldTricksThisJump.push(poseId);
        const label =
          poseId === 'superman'
            ? 'SUPERMAN'
            : poseId === 'no_hands'
              ? 'NO-HANDS'
              : 'TABLETOP';
        addComboTrick(state, events, label, 240);
      }
      if (!input.trickHeld && state.trickHoldSeconds >= 0.55) {
        state.activeTrickPose = 'none';
      }
    }

    // Check chasm fall below trail while airborne
    if (
      (nextSample.isGap || nextSample.isOffTrailCliff) &&
      state.y < nextSample.trailY - 3.6
    ) {
      state.crashed = true;
      state.crashReason = 'crash_cliff';
      state.comboPendingPoints = 0;
      state.comboCount = 0;
      events.push({
        type: 'crash',
        crashReason: 'crash_cliff',
        label: 'CANYON FALL!',
        tone: 'rose',
      });
      return events;
    }

    // Check ground touchdown!
    if (state.y <= nextSample.groundY && state.vy <= 0) {
      const impactVy = Math.abs(state.vy);
      const jumpDist = Math.abs(state.z - state.takeoffZ);
      const jumpHeight = Math.max(0, state.peakJumpY - state.takeoffY);
      state.longestJumpMeters = Math.max(state.longestJumpMeters, jumpDist);
      state.highestJumpMeters = Math.max(state.highestJumpMeters, jumpHeight);

      state.y = nextSample.groundY;
      state.vy = 0;
      state.grounded = true;
      state.landSquash = 1.0;
      // Trigger 2nd-order suspension compression from vertical landing velocity
      state.suspensionOffset = clamp(state.suspensionOffset + impactVy * 0.0085, 0, 0.14);
      state.suspensionVel += impactVy * 0.25;

      // Landing Angle Check against terrain slope (only strict after real airtime)
      const pitchErr = Math.abs(
        normalizeAngle(state.airPitchAngle - nextSample.slopePitch),
      );
      const yawErr = Math.abs(normalizeAngle(state.airYawAngle));

      if (
        state.airtime > 0.35 &&
        (pitchErr > 0.94 || yawErr > 1.08)
      ) {
        state.crashed = true;
        state.crashReason = 'crash_landing';
        state.comboPendingPoints = 0;
        state.comboCount = 0;
        events.push({
          type: 'crash',
          crashReason: 'crash_landing',
          label: 'BAD LANDING!',
          tone: 'rose',
        });
        return events;
      }

      let quality: 'PERFECT' | 'CLEAN' | 'SLOPPY' = 'CLEAN';
      if (state.airtime > 0.32) {
        if (pitchErr < 0.30 && yawErr < 0.35) {
          quality = 'PERFECT';
          if (state.comboPendingPoints > 0 || jumpDist > 6) {
            addComboTrick(state, events, 'PERFECT LANDING', 150);
          }
        } else if (pitchErr > 0.62 || yawErr > 0.72) {
          quality = 'SLOPPY';
          state.speedMps = Math.max(4.0, state.speedMps * 0.76);
        }
      }
      state.lastLandingQuality = quality;
      state.airtime = 0;
      state.airPitchAngle = nextSample.slopePitch;
      state.airYawAngle = 0;
      state.activeTrickPose = 'none';
      events.push({ type: 'land', landingQuality: quality });
    }
  }

  // Combo bank countdown when riding normally
  if (state.comboTimer > 0 && state.grounded && state.balanceMode === 'none') {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) {
      bankComboIfActive(state, events);
      state.activeTrickLabel = null;
    }
  }

  // Obstacle Collision Check (with checkpoint respawn grace window)
  if (state.spawnGraceTimer <= 0) {
    for (const obs of course.obstacles) {
      if (obs.hit) continue;
      const dzObs = Math.abs(state.z - obs.worldZ);
      const dxObs = Math.abs(state.x - obs.worldX);
      if (
        dzObs < obs.radius + 0.52 &&
        dxObs < obs.radius + 0.28 &&
        state.y < obs.worldY + obs.height - 0.12
      ) {
        obs.hit = true;
        state.crashed = true;
        state.crashReason = 'crash_obstacle';
        state.comboPendingPoints = 0;
        state.comboCount = 0;
        events.push({
          type: 'crash',
          crashReason: 'crash_obstacle',
          label: 'OBSTACLE COLLISION!',
          tone: 'rose',
        });
        return events;
      }
    }
  }

  // Coin Collection
  for (const coin of course.coins) {
    if (coin.collected) continue;
    const dx = state.x - coin.x;
    const dy = state.y + 0.75 - coin.y;
    const dzc = state.z - coin.z;
    if (dx * dx + dy * dy + dzc * dzc < 2.25) {
      coin.collected = true;
      state.coinsCollected += 1;
      state.totalScore += 35;
      events.push({ type: 'coin', points: 35 });
    }
  }

  // Checkpoints
  const distanceMeters = -state.z;
  for (const cp of course.checkpoints) {
    if (!cp.reached && distanceMeters >= cp.d) {
      cp.reached = true;
      state.checkpointIndex = cp.index;
      state.checkpointX = cp.x;
      state.checkpointY = cp.y;
      state.checkpointZ = cp.z;
      events.push({
        type: 'checkpoint',
        label: `CHECKPOINT ${cp.index}/${course.checkpoints.length}`,
        tone: 'cyan',
      });
    }
  }

  // Finish Line
  if (distanceMeters >= course.level.lengthMeters) {
    bankComboIfActive(state, events);
    const timeBonus = Math.max(
      0,
      Math.round((course.level.parTimeSeconds - state.elapsedSeconds) * 25),
    );
    const finishBonus = 300 + timeBonus;
    state.totalScore += finishBonus;
    state.completed = true;
    events.push({
      type: 'finish',
      label: 'COURSE COMPLETE!',
      tone: 'gold',
      points: finishBonus,
    });
  }

  // Keep reference to prevGroundY to avoid unused variable warnings if stripped
  void prevGroundY;

  return events;
}

export function computeObjectiveProgress(
  level: AdventureLevelDef,
  state: AdventureSimState,
): { progress: number; target: number; completed: boolean } {
  const { metric, target } = level.objective;
  let progress = 0;
  switch (metric) {
    case 'finish':
      progress = state.completed ? 1 : 0;
      break;
    case 'wheelie_meters':
      progress = Math.round(state.wheelieMetersTotal);
      break;
    case 'airtime_total':
      progress = Number(state.airtimeTotal.toFixed(1));
      break;
    case 'combo_count':
      progress = state.bestComboCount;
      break;
    case 'stunt_score':
      progress = Math.round(state.stuntScore);
      break;
    case 'tricks_count':
      progress = state.tricksLanded;
      break;
  }
  return {
    progress: Math.min(target, progress),
    target,
    completed: progress >= target,
  };
}
