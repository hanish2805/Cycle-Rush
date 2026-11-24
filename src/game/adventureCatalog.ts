import type {
  AdventureAreaId,
  AdventureAreaSpec,
  AdventureControlsConfig,
  AdventureLevelDef,
} from './types';

export const DEFAULT_ADVENTURE_CONTROLS: AdventureControlsConfig = {
  accel: 'KeyW',
  brake: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  boost: 'ShiftLeft',
  wheelie: 'KeyQ',
  stoppie: 'KeyE',
  manual: 'KeyM',
  reset: 'KeyR',
  camera: 'KeyC',
};

export const ADVENTURE_AREAS: AdventureAreaSpec[] = [
  {
    id: 'mountain_cliff',
    name: 'Mountain Cliff',
    subtitle: 'Narrow ridge trails, steep descents & deep valley drops',
    difficultyLabel: 'Alpine Ridge',
    skyTopHex: '#1d4ed8',
    skyHorizonHex: '#93c5fd',
    fogHex: '#a8c6e8',
    fogDensity: 0.0046,
    sunColorHex: '#fff5df',
    sunIntensity: 2.3,
    hemiSkyHex: '#bfdbfe',
    hemiGroundHex: '#57534e',
    hemiIntensity: 1.0,
    trailHex: '#785a40',
    shoulderHex: '#574c41',
    terrainHex: '#4b5563',
    terrainAltHex: '#3f6212',
    accentHex: '#f59e0b',
    primarySurface: 'rock',
  },
  {
    id: 'forest_trails',
    name: 'Forest Trails',
    subtitle: 'Dense pines, muddy tracks, fallen logs & river crossings',
    difficultyLabel: 'Timberland',
    skyTopHex: '#0f766e',
    skyHorizonHex: '#a7f3d0',
    fogHex: '#6b8e78',
    fogDensity: 0.0068,
    sunColorHex: '#fef3c7',
    sunIntensity: 1.9,
    hemiSkyHex: '#a7f3d0',
    hemiGroundHex: '#3f2e21',
    hemiIntensity: 1.05,
    trailHex: '#6d4c33',
    shoulderHex: '#425e34',
    terrainHex: '#244726',
    terrainAltHex: '#365314',
    accentHex: '#22c55e',
    primarySurface: 'dirt',
  },
  {
    id: 'canyon',
    name: 'Canyon Adventure',
    subtitle: 'Red rock spires, suspended bridges & massive stunt gaps',
    difficultyLabel: 'Red Gorge',
    skyTopHex: '#0284c7',
    skyHorizonHex: '#fed7aa',
    fogHex: '#d99a6c',
    fogDensity: 0.0044,
    sunColorHex: '#ffedd5',
    sunIntensity: 2.5,
    hemiSkyHex: '#fde68a',
    hemiGroundHex: '#7c2d12',
    hemiIntensity: 0.98,
    trailHex: '#a15c38',
    shoulderHex: '#7c3f23',
    terrainHex: '#9a3412',
    terrainAltHex: '#c2410c',
    accentHex: '#fb923c',
    primarySurface: 'rock',
  },
  {
    id: 'snow_mountains',
    name: 'Snow Mountains',
    subtitle: 'Icy downhill tracks, slippery corners & frozen bridges',
    difficultyLabel: 'Glacier Peak',
    skyTopHex: '#1e3a8a',
    skyHorizonHex: '#e0f2fe',
    fogHex: '#cfe4f5',
    fogDensity: 0.0052,
    sunColorHex: '#f8fafc',
    sunIntensity: 2.4,
    hemiSkyHex: '#e0f2fe',
    hemiGroundHex: '#64748b',
    hemiIntensity: 1.15,
    trailHex: '#93c5fd',
    shoulderHex: '#cbd5e1',
    terrainHex: '#e2e8f0',
    terrainAltHex: '#94a3b8',
    accentHex: '#38bdf8',
    primarySurface: 'ice',
  },
  {
    id: 'stunt_park',
    name: 'Extreme Stunt Park',
    subtitle: 'Half-pipes, mega ramps, grind rails & aerial stunt zones',
    difficultyLabel: 'Pro Arena',
    skyTopHex: '#0f172a',
    skyHorizonHex: '#38bdf8',
    fogHex: '#1e293b',
    fogDensity: 0.0036,
    sunColorHex: '#fef9c3',
    sunIntensity: 2.2,
    hemiSkyHex: '#7dd3fc',
    hemiGroundHex: '#334155',
    hemiIntensity: 1.0,
    trailHex: '#334155',
    shoulderHex: '#1e293b',
    terrainHex: '#0f172a',
    terrainAltHex: '#1e293b',
    accentHex: '#22d3ee',
    primarySurface: 'concrete',
  },
];

export const ADVENTURE_CAMPAIGN_LEVELS: AdventureLevelDef[] = [
  {
    id: 'lvl_1_first_ride',
    index: 0,
    isChallenge: false,
    title: 'Level 1 · First Ride',
    subtitle: 'Master ridge steering, jumps and checkpoint lines',
    areaId: 'mountain_cliff',
    lengthMeters: 420,
    checkpointsCount: 3,
    parTimeSeconds: 42,
    starThresholds: [400, 1400, 2400],
    coinReward: 75,
    objective: {
      metric: 'finish',
      target: 1,
      label: 'Reach the mountain summit finish gate',
    },
    seed: 101,
    steepness: 0.45,
    hazardDensity: 0.3,
    rampDensity: 0.6,
  },
  {
    id: 'lvl_2_wheelie_master',
    index: 1,
    isChallenge: false,
    title: 'Level 2 · Wheelie Master',
    subtitle: 'Hold balanced wheelies along winding timberland trails',
    areaId: 'forest_trails',
    lengthMeters: 480,
    checkpointsCount: 3,
    parTimeSeconds: 46,
    starThresholds: [600, 1800, 3000],
    coinReward: 100,
    objective: {
      metric: 'wheelie_meters',
      target: 45,
      label: 'Ride 45m on a balanced Wheelie [Q]',
    },
    seed: 204,
    steepness: 0.55,
    hazardDensity: 0.42,
    rampDensity: 0.65,
  },
  {
    id: 'lvl_3_cliff_descent',
    index: 2,
    isChallenge: false,
    title: 'Level 3 · Cliff Descent',
    subtitle: 'Carve narrow cliff ledges & timber bridges above the valley',
    areaId: 'mountain_cliff',
    lengthMeters: 540,
    checkpointsCount: 3,
    parTimeSeconds: 48,
    starThresholds: [900, 2200, 3500],
    coinReward: 125,
    objective: {
      metric: 'finish',
      target: 1,
      label: 'Survive the steep cliffside descent & bridges',
    },
    seed: 309,
    steepness: 0.78,
    hazardDensity: 0.6,
    rampDensity: 0.75,
  },
  {
    id: 'lvl_4_air_time',
    index: 3,
    isChallenge: false,
    title: 'Level 4 · Air Time',
    subtitle: 'Launch red-rock canyon kickers and nail clean landings',
    areaId: 'canyon',
    lengthMeters: 580,
    checkpointsCount: 3,
    parTimeSeconds: 50,
    starThresholds: [1100, 2600, 4200],
    coinReward: 150,
    objective: {
      metric: 'airtime_total',
      target: 6,
      label: 'Accumulate 6.0s of clean airborne time',
    },
    seed: 418,
    steepness: 0.72,
    hazardDensity: 0.52,
    rampDensity: 1.05,
  },
  {
    id: 'lvl_5_stunt_combo',
    index: 4,
    isChallenge: false,
    title: 'Level 5 · Stunt Combo',
    subtitle: 'Chain wheelies, river bridges and flips through muddy woods',
    areaId: 'forest_trails',
    lengthMeters: 620,
    checkpointsCount: 3,
    parTimeSeconds: 54,
    starThresholds: [1400, 3200, 5000],
    coinReward: 175,
    objective: {
      metric: 'combo_count',
      target: 3,
      label: 'Land a 3× Stunt Combo chain',
    },
    seed: 523,
    steepness: 0.68,
    hazardDensity: 0.68,
    rampDensity: 0.95,
  },
  {
    id: 'lvl_6_canyon_escape',
    index: 5,
    isChallenge: false,
    title: 'Level 6 · Canyon Escape',
    subtitle: 'Clear suspended bridges & massive gorge gaps at full speed',
    areaId: 'canyon',
    lengthMeters: 680,
    checkpointsCount: 4,
    parTimeSeconds: 56,
    starThresholds: [1800, 3800, 5800],
    coinReward: 210,
    objective: {
      metric: 'stunt_score',
      target: 1800,
      label: 'Score 1,800 Stunt Points on the gorge run',
    },
    seed: 641,
    steepness: 0.88,
    hazardDensity: 0.72,
    rampDensity: 1.0,
  },
  {
    id: 'lvl_7_extreme_downhill',
    index: 6,
    isChallenge: false,
    title: 'Level 7 · Extreme Downhill',
    subtitle: 'High-speed glacier ice tracks, slippery turns & snow kickers',
    areaId: 'snow_mountains',
    lengthMeters: 740,
    checkpointsCount: 4,
    parTimeSeconds: 58,
    starThresholds: [2200, 4400, 6800],
    coinReward: 250,
    objective: {
      metric: 'tricks_count',
      target: 5,
      label: 'Land 5 distinct Stunts down the frozen peak',
    },
    seed: 757,
    steepness: 1.05,
    hazardDensity: 0.82,
    rampDensity: 0.95,
  },
  {
    id: 'lvl_8_stunt_park_finale',
    index: 7,
    isChallenge: false,
    title: 'Level 8 · Extreme Stunt Park',
    subtitle: 'Half-pipes, pro rails, mega gaps & aerial trick mastery',
    areaId: 'stunt_park',
    lengthMeters: 760,
    checkpointsCount: 4,
    parTimeSeconds: 60,
    starThresholds: [2600, 5200, 8200],
    coinReward: 320,
    objective: {
      metric: 'stunt_score',
      target: 3200,
      label: 'Score 3,200 Stunt Points in the Pro Arena',
    },
    seed: 888,
    steepness: 0.85,
    hazardDensity: 0.55,
    rampDensity: 1.2,
  },
];

export const ADVENTURE_CHALLENGES: AdventureLevelDef[] = [
  {
    id: 'sc_cliff_wheelie',
    index: 100,
    isChallenge: true,
    title: 'Cliffside Balance Run',
    subtitle: 'Hold long wheelies & stoppies along the Mountain Cliff ledge',
    areaId: 'mountain_cliff',
    lengthMeters: 460,
    checkpointsCount: 2,
    parTimeSeconds: 45,
    starThresholds: [1000, 2200, 3600],
    coinReward: 140,
    objective: {
      metric: 'wheelie_meters',
      target: 85,
      label: 'Ride 85m in Wheelie or Stoppie balance',
    },
    seed: 1011,
    steepness: 0.62,
    hazardDensity: 0.45,
    rampDensity: 0.7,
  },
  {
    id: 'sc_canyon_big_air',
    index: 101,
    isChallenge: true,
    title: 'Canyon Big Air',
    subtitle: 'Launch colossal red-rock kickers with flips & 360° spins',
    areaId: 'canyon',
    lengthMeters: 520,
    checkpointsCount: 2,
    parTimeSeconds: 46,
    starThresholds: [1500, 3200, 5200],
    coinReward: 180,
    objective: {
      metric: 'airtime_total',
      target: 9,
      label: 'Log 9.0s total airborne stunt time',
    },
    seed: 1029,
    steepness: 0.75,
    hazardDensity: 0.4,
    rampDensity: 1.2,
  },
  {
    id: 'sc_snow_drift_stunt',
    index: 102,
    isChallenge: true,
    title: 'Glacier Flow Challenge',
    subtitle: 'Link tricks & frozen bridge jumps on low-grip alpine ice',
    areaId: 'snow_mountains',
    lengthMeters: 560,
    checkpointsCount: 3,
    parTimeSeconds: 48,
    starThresholds: [1800, 3600, 5600],
    coinReward: 210,
    objective: {
      metric: 'combo_count',
      target: 4,
      label: 'Chain & land a 4× Stunt Combo on snow & ice',
    },
    seed: 1047,
    steepness: 0.92,
    hazardDensity: 0.62,
    rampDensity: 1.0,
  },
  {
    id: 'sc_park_freestyle',
    index: 103,
    isChallenge: true,
    title: 'Stunt Park Freestyle',
    subtitle: 'Half-pipe bowls, rail drops & maximum aerial trick combos',
    areaId: 'stunt_park',
    lengthMeters: 620,
    checkpointsCount: 3,
    parTimeSeconds: 52,
    starThresholds: [2500, 5000, 8000],
    coinReward: 280,
    objective: {
      metric: 'stunt_score',
      target: 4000,
      label: 'Rack up 4,000 Freestyle Stunt Points',
    },
    seed: 1099,
    steepness: 0.78,
    hazardDensity: 0.38,
    rampDensity: 1.25,
  },
];

export const ALL_ADVENTURE_LEVELS: AdventureLevelDef[] = [
  ...ADVENTURE_CAMPAIGN_LEVELS,
  ...ADVENTURE_CHALLENGES,
];

export function getAdventureAreaSpec(areaId: AdventureAreaId): AdventureAreaSpec {
  return (
    ADVENTURE_AREAS.find((a) => a.id === areaId) ?? ADVENTURE_AREAS[0]
  );
}

export function getAdventureLevelDef(levelId: string): AdventureLevelDef {
  return (
    ALL_ADVENTURE_LEVELS.find((l) => l.id === levelId) ??
    ADVENTURE_CAMPAIGN_LEVELS[0]
  );
}

export function getNextAdventureLevel(levelId: string): AdventureLevelDef | null {
  const idx = ADVENTURE_CAMPAIGN_LEVELS.findIndex((l) => l.id === levelId);
  if (idx < 0 || idx + 1 >= ADVENTURE_CAMPAIGN_LEVELS.length) return null;
  return ADVENTURE_CAMPAIGN_LEVELS[idx + 1];
}

export function computeLevelStars(
  level: AdventureLevelDef,
  totalScore: number,
  completed: boolean,
): number {
  if (!completed) return 0;
  if (totalScore >= level.starThresholds[2]) return 3;
  if (totalScore >= level.starThresholds[1]) return 2;
  return 1;
}

export function formatKeyCodeLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'Space') return 'SPACE';
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'SHIFT';
  if (code === 'ArrowUp') return '↑';
  if (code === 'ArrowDown') return '↓';
  if (code === 'ArrowLeft') return '←';
  if (code === 'ArrowRight') return '→';
  return code.toUpperCase();
}

export function getAdventureTutorialHint(
  levelId: string,
  distanceMeters: number,
  isAirborne: boolean,
  balanceMode: 'none' | 'wheelie' | 'stoppie' | 'manual',
  controls: AdventureControlsConfig,
): string | null {
  const kAccel = formatKeyCodeLabel(controls.accel);
  const kLeft = formatKeyCodeLabel(controls.left);
  const kRight = formatKeyCodeLabel(controls.right);
  const kJump = formatKeyCodeLabel(controls.jump);
  const kWheelie = formatKeyCodeLabel(controls.wheelie);
  const kStoppie = formatKeyCodeLabel(controls.stoppie);
  const kManual = formatKeyCodeLabel(controls.manual);

  if (isAirborne && (levelId === 'lvl_1_first_ride' || levelId === 'lvl_4_air_time')) {
    return `Midair: [↑/↓] Flip · [←/→] 360° Spin · [${kJump}] Superman / Tabletop`;
  }

  if (levelId === 'lvl_1_first_ride') {
    if (distanceMeters < 26) {
      return `Tutorial: Hold [${kAccel}] Pedal · [${kLeft}/${kRight}] Steer · [${kJump}] Jump`;
    }
    if (distanceMeters < 82) {
      return `Hit kickers at speed & press [${kJump}] for Big Air — level pitch before landing!`;
    }
    if (distanceMeters < 155) {
      if (balanceMode !== 'none') {
        return 'Keep the needle inside the green zone for Stunt points!';
      }
      return `Try [${kWheelie}] Wheelie, [${kManual}] Manual, or [${kStoppie}] Stoppie on smooth straightaways`;
    }
    return null;
  }

  if (levelId === 'lvl_2_wheelie_master' && distanceMeters < 95) {
    return `Tutorial: Hold [${kWheelie}] Wheelie or [${kManual}] Manual — feather inside the green bar!`;
  }

  if (levelId === 'lvl_3_cliff_descent' && distanceMeters < 65) {
    return 'Tip: Stay centered on cliff ridges & slow before narrow timber bridges.';
  }

  return null;
}
