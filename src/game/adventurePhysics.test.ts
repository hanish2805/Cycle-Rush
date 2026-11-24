import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADVENTURE_AREAS,
  ADVENTURE_CAMPAIGN_LEVELS,
  ADVENTURE_CHALLENGES,
  DEFAULT_ADVENTURE_CONTROLS,
  computeLevelStars,
  getAdventureLevelDef,
  getAdventureTutorialHint,
} from './adventureCatalog';
import {
  buildAdventureCourse,
  createInitialAdventureState,
  getBaseElevation,
  getTrailCenterX,
  restoreAdventureCheckpoint,
  sampleAdventureTerrain,
  stepAdventurePhysics,
  type AdventureInputState,
} from './adventurePhysics';
import { BICYCLES } from './catalog';
import {
  createDefaultSaveData,
  getTotalAdventureStars,
  recordAdventureResult,
  resetAdventureCampaign,
} from './storage';

function emptyInput(patch: Partial<AdventureInputState> = {}): AdventureInputState {
  return {
    accel: false,
    brake: false,
    steerLeft: false,
    steerRight: false,
    jumpPressed: false,
    trickPressed: false,
    trickHeld: false,
    boost: false,
    wheelie: false,
    stoppie: false,
    airPitchUp: false,
    airPitchDown: false,
    airYawLeft: false,
    airYawRight: false,
    ...patch,
  };
}

test('all 5 adventure areas and 8+ campaign levels + challenges are valid and connected', () => {
  assert.equal(ADVENTURE_AREAS.length, 5);
  assert.ok(ADVENTURE_CAMPAIGN_LEVELS.length >= 8);
  assert.ok(ADVENTURE_CHALLENGES.length >= 4);

  const areaSet = new Set(ADVENTURE_CAMPAIGN_LEVELS.map((l) => l.areaId));
  for (const area of ADVENTURE_AREAS) {
    assert.ok(areaSet.has(area.id), `Missing campaign level for area ${area.id}`);
  }
});

test('terrain builder produces valid ramps, bridges, checkpoints, and cliff drops', () => {
  const cliffLevel = getAdventureLevelDef('lvl_3_cliff_descent');
  const course = buildAdventureCourse(cliffLevel);
  assert.equal(course.checkpoints.length, cliffLevel.checkpointsCount);
  assert.ok(course.ramps.length > 0);
  assert.ok(course.obstacles.length > 0);

  const d = 120;
  const cx = getTrailCenterX(cliffLevel, d);
  const centerSample = sampleAdventureTerrain(course, cx, -d);
  assert.equal(centerSample.isOffTrailCliff, false);

  const offCliffSample = sampleAdventureTerrain(course, cx + 14, -d);
  assert.equal(offCliffSample.isOffTrailCliff, true);
  assert.ok(offCliffSample.groundY < centerSample.groundY - 2);
});

test('downhill slope gravity accelerates bicycle naturally even when coasting', () => {
  const downhill = getAdventureLevelDef('lvl_7_extreme_downhill');
  const course = buildAdventureCourse(downhill);
  const state = createInitialAdventureState(course);
  state.speedMps = 4.0;
  const bike = BICYCLES[0];

  // Confirm elevation drops overall
  assert.ok(getBaseElevation(downhill, 150) < getBaseElevation(downhill, 10));

  for (let i = 0; i < 60; i++) {
    stepAdventurePhysics(state, course, emptyInput(), bike, 1.0, 0.03);
  }
  assert.ok(state.speedMps > 5.0, `Expected downhill speed gain, got ${state.speedMps}`);
});

test('wheelie builds balance score without duplicates and loops out past safe limit', () => {
  const level = getAdventureLevelDef('lvl_2_wheelie_master');
  const course = buildAdventureCourse(level);
  const bike = BICYCLES[2];
  const state = createInitialAdventureState(course);
  state.speedMps = 12;

  let trickEvents = 0;
  for (let i = 0; i < 36; i++) {
    const cx = getTrailCenterX(level, -state.z);
    state.x = cx; // keep centered on trail
    const evs = stepAdventurePhysics(
      state,
      course,
      emptyInput({ accel: true, wheelie: i < 20 }),
      bike,
      1.0,
      0.03,
    );
    trickEvents += evs.filter((e) => e.type === 'trick').length;
    if (state.crashed) break;
  }

  assert.equal(trickEvents, 1, 'Holding a single wheelie stint must award 1 WHEELIE trick event, not duplicate spam');
  assert.ok(state.wheelieMetersTotal > 5);

  // Now hold wheelie indefinitely until loop-out crash triggers
  const loopState = createInitialAdventureState(course);
  loopState.speedMps = 11;
  for (let i = 0; i < 80; i++) {
    loopState.x = getTrailCenterX(level, -loopState.z);
    stepAdventurePhysics(
      loopState,
      course,
      emptyInput({ accel: true, wheelie: true }),
      bike,
      1.0,
      0.03,
    );
    if (loopState.crashed) break;
  }
  assert.equal(loopState.crashed, true);
  assert.equal(loopState.crashReason, 'crash_wheelie');
});

test('stoppie lifts rear wheel and triggers endo crash when over-rotated', () => {
  const level = getAdventureLevelDef('lvl_1_first_ride');
  const course = buildAdventureCourse(level);
  const bike = BICYCLES[0];
  const state = createInitialAdventureState(course);
  state.speedMps = 15;

  for (let i = 0; i < 70; i++) {
    state.x = getTrailCenterX(level, -state.z);
    stepAdventurePhysics(
      state,
      course,
      emptyInput({ stoppie: true, brake: true }),
      bike,
      1.0,
      0.03,
    );
    if (state.crashed) break;
  }
  assert.equal(state.crashed, true);
  assert.equal(state.crashReason, 'crash_stoppie');
});

test('airborne backflip & held pose trick award once per jump and require clean landing', () => {
  const level = getAdventureLevelDef('lvl_4_air_time');
  const course = buildAdventureCourse(level);
  const bike = BICYCLES[1];
  const state = createInitialAdventureState(course);

  // Launch high off a clean ground spot
  state.grounded = false;
  state.y = state.y + 8.0;
  state.vy = 7.5;
  state.speedMps = 14;
  state.takeoffY = 0;
  state.takeoffZ = state.z;
  state.peakJumpY = state.y;

  const landedTricks: string[] = [];
  for (let i = 0; i < 80; i++) {
    state.x = getTrailCenterX(level, -state.z);
    // Spin backflip only until ~1 full rotation (2 * Math.PI) so we land level!
    const needMorePitch = state.airPitchAccum < Math.PI * 1.9;
    const evs = stepAdventurePhysics(
      state,
      course,
      emptyInput({
        airPitchUp: needMorePitch,
        trickPressed: i === 2,
        trickHeld: i >= 2 && i <= 18,
      }),
      bike,
      1.0,
      0.03,
    );
    for (const e of evs) {
      if (e.type === 'trick' && e.label) landedTricks.push(e.label);
    }
    if (state.grounded || state.crashed) break;
  }

  assert.equal(state.crashed, false, `Expected clean landing, got crash=${state.crashReason}`);
  assert.ok(landedTricks.some((l) => l.includes('BACKFLIP')));
  assert.ok(landedTricks.some((l) => l.includes('SUPERMAN')));
});

test('bad airborne landing angle triggers crash_landing and discards unbanked combo', () => {
  const level = getAdventureLevelDef('lvl_4_air_time');
  const course = buildAdventureCourse(level);
  const bike = BICYCLES[0];
  const state = createInitialAdventureState(course);

  state.grounded = false;
  state.y += 4.5;
  state.vy = 2.0;
  state.airtime = 0.6;
  state.airPitchAngle = Math.PI * 0.95; // upside down!
  state.comboPendingPoints = 500;
  state.comboCount = 2;

  for (let i = 0; i < 60; i++) {
    state.x = getTrailCenterX(level, -state.z);
    stepAdventurePhysics(state, course, emptyInput(), bike, 1.0, 0.03);
    if (state.crashed) break;
  }

  assert.equal(state.crashed, true);
  assert.equal(state.crashReason, 'crash_landing');
  assert.equal(state.comboPendingPoints, 0);
});

test('ice surface reduces lateral grip compared to dirt', () => {
  const forest = buildAdventureCourse(getAdventureLevelDef('lvl_2_wheelie_master'));
  const snow = buildAdventureCourse(getAdventureLevelDef('lvl_7_extreme_downhill'));
  const bike = BICYCLES[0];

  const dirtState = createInitialAdventureState(forest);
  const iceState = createInitialAdventureState(snow);
  dirtState.vx = 7.0;
  iceState.vx = 7.0;

  // Release steering and compare how quickly lateral velocity damps
  for (let i = 0; i < 6; i++) {
    stepAdventurePhysics(dirtState, forest, emptyInput({ accel: true }), bike, 1.0, 0.03);
    stepAdventurePhysics(iceState, snow, emptyInput({ accel: true }), bike, 1.0, 0.03);
  }

  assert.ok(
    Math.abs(iceState.vx) > Math.abs(dirtState.vx) * 1.4,
    `Expected more drift on ice (${iceState.vx}) vs dirt (${dirtState.vx})`,
  );
});

test('checkpoint capture and crash restore return rider safely to active checkpoint', () => {
  const level = getAdventureLevelDef('lvl_1_first_ride');
  const course = buildAdventureCourse(level);
  const bike = BICYCLES[0];
  const state = createInitialAdventureState(course);

  const cp1 = course.checkpoints[0];
  state.z = cp1.z + 0.5;
  state.x = cp1.x;
  state.y = cp1.y;
  state.speedMps = 12;

  const evs = stepAdventurePhysics(state, course, emptyInput({ accel: true }), bike, 1.0, 0.05);
  assert.ok(evs.some((e) => e.type === 'checkpoint'));
  assert.equal(state.checkpointIndex, 1);

  state.crashed = true;
  state.crashReason = 'crash_obstacle';
  const restored = restoreAdventureCheckpoint(course, state);
  assert.equal(restored.crashed, false);
  assert.equal(restored.z, cp1.z);
  assert.equal(restored.x, cp1.x);
});

test('star computation, progression unlock, and campaign reset persist cleanly', () => {
  const lvl1 = getAdventureLevelDef('lvl_1_first_ride');
  assert.equal(computeLevelStars(lvl1, 100, false), 0);
  assert.equal(computeLevelStars(lvl1, 500, true), 1);
  assert.equal(computeLevelStars(lvl1, 1500, true), 2);
  assert.equal(computeLevelStars(lvl1, 3000, true), 3);

  let save = createDefaultSaveData();
  save = recordAdventureResult(save, {
    levelId: lvl1.id,
    levelTitle: lvl1.title,
    areaId: lvl1.areaId,
    isChallenge: false,
    outcome: 'completed',
    totalScore: 2650,
    stuntScore: 1200,
    distanceMeters: lvl1.lengthMeters,
    totalLengthMeters: lvl1.lengthMeters,
    elapsedSeconds: 38,
    parTimeSeconds: lvl1.parTimeSeconds,
    parTimeBeaten: true,
    starsEarned: 3,
    coinsAwarded: 75,
    longestWheelieSeconds: 2.5,
    longestJumpMeters: 11,
    highestJumpMeters: 3.1,
    bestComboCount: 3,
    tricksLanded: 4,
    objectiveCompleted: true,
    objectiveLabel: lvl1.objective.label,
    canResumeCheckpoint: true,
    checkpointIndex: 3,
    isNewBestScore: true,
  });

  assert.equal(save.adventure.unlockedLevelIndex, 1);
  assert.equal(save.adventure.currentLevelId, 'lvl_2_wheelie_master');
  assert.equal(getTotalAdventureStars(save.adventure), 3);
  assert.equal(save.coins, 275);

  const reset = resetAdventureCampaign(save);
  assert.equal(reset.adventure.unlockedLevelIndex, 0);
  assert.equal(reset.adventure.currentLevelId, 'lvl_1_first_ride');
  // Best stars & coins remain intact!
  assert.equal(getTotalAdventureStars(reset.adventure), 3);
});

test('dedicated manual mechanic lifts rear balance, scores MANUAL without pedaling, and avoids duplicates', () => {
  const level = getAdventureLevelDef('lvl_2_wheelie_master');
  const course = buildAdventureCourse(level);
  const bike = BICYCLES[2];
  const state = createInitialAdventureState(course);
  state.speedMps = 13;

  const trickLabels: string[] = [];
  for (let i = 0; i < 36; i++) {
    state.x = getTrailCenterX(level, -state.z);
    const evs = stepAdventurePhysics(
      state,
      course,
      emptyInput({ manual: i < 20 }),
      bike,
      1.0,
      0.03,
    );
    for (const e of evs) {
      if (e.type === 'trick' && e.label) trickLabels.push(e.label);
    }
    if (state.crashed) break;
  }

  assert.equal(state.crashed, false);
  assert.equal(trickLabels.length, 1);
  assert.ok(trickLabels[0].includes('MANUAL'), `Expected MANUAL trick, got ${trickLabels[0]}`);
});

test('2nd-order suspension compresses on landing impact and rebounds smoothly', () => {
  const level = getAdventureLevelDef('lvl_4_air_time');
  const course = buildAdventureCourse(level);
  const bike = BICYCLES[2];
  const state = createInitialAdventureState(course);

  state.grounded = false;
  state.y += 0.3;
  state.vy = -12.0;
  state.airtime = 0.45;
  state.airPitchAngle = state.terrainSlopePitch;

  let hitGround = false;
  let peakCompression = 0;
  for (let i = 0; i < 40; i++) {
    state.x = getTrailCenterX(level, -state.z);
    stepAdventurePhysics(state, course, emptyInput({ accel: true }), bike, 1.0, 0.025);
    if (state.grounded) hitGround = true;
    peakCompression = Math.max(peakCompression, state.suspensionOffset);
  }

  assert.equal(hitGround, true);
  assert.ok(peakCompression > 0.06, `Expected compression > 0.06, got ${peakCompression}`);
  assert.ok(Math.abs(state.suspensionOffset) < 0.04, `Expected damped rebound near rest, got ${state.suspensionOffset}`);
});

test('frontflip and 360 spin recognize accurate direction and combine cleanly', () => {
  const level = getAdventureLevelDef('lvl_4_air_time');
  const course = buildAdventureCourse(level);
  const bike = BICYCLES[1];
  const state = createInitialAdventureState(course);

  state.grounded = false;
  state.y += 10.0;
  state.vy = 8.0;
  state.speedMps = 14;
  state.takeoffZ = state.z;
  state.peakJumpY = state.y;

  const trickLabels: string[] = [];
  for (let i = 0; i < 90; i++) {
    state.x = getTrailCenterX(level, -state.z);
    const spinPitch = state.airPitchAccum < Math.PI * 1.92;
    const spinYaw = state.airYawAccum < Math.PI * 1.92;
    const evs = stepAdventurePhysics(
      state,
      course,
      emptyInput({ airPitchDown: spinPitch, airYawLeft: spinYaw }),
      bike,
      1.0,
      0.03,
    );
    for (const e of evs) {
      if (e.type === 'trick' && e.label) trickLabels.push(e.label);
    }
    if (state.grounded || state.crashed) break;
  }

  assert.equal(state.crashed, false, `Expected clean landing, got ${state.crashReason}`);
  assert.ok(trickLabels.some((l) => l.includes('FRONTFLIP')));
  assert.ok(trickLabels.some((l) => l.includes('360 SPIN')));
});

test('forest_trails and stunt_park contain lateral bounds safely without escaping visual terrain', () => {
  for (const lvlId of ['lvl_2_wheelie_master', 'lvl_8_stunt_park_finale']) {
    const level = getAdventureLevelDef(lvlId);
    const course = buildAdventureCourse(level);
    const state = createInitialAdventureState(course);
    for (let i = 0; i < 80; i++) {
      stepAdventurePhysics(
        state,
        course,
        emptyInput({ accel: true, steerRight: true }),
        BICYCLES[0],
        1.4,
        0.03,
      );
      if (state.crashed) break;
    }
    assert.equal(state.crashed, false, `${lvlId} must keep rider safely contained inside ribbon edges`);
    const offset = Math.abs(state.x - getTrailCenterX(level, -state.z));
    assert.ok(offset <= 9.0, `Expected contained offset <= 9.0, got ${offset}`);
  }
});

test('checkpoint restore clears nearby obstacles and provides spawn grace + tutorial hints render for Level 1', () => {
  const level = getAdventureLevelDef('lvl_1_first_ride');
  const course = buildAdventureCourse(level);
  const state = createInitialAdventureState(course);
  const cp = course.checkpoints[0];
  state.checkpointIndex = cp.index;

  // Inject an obstacle right in front of the checkpoint to test anti-stuck safeguard
  course.obstacles.push({
    id: 9999,
    d: cp.d + 2,
    xOffset: 0,
    worldX: cp.x,
    worldY: cp.y,
    worldZ: -(cp.d + 2),
    radius: 0.7,
    height: 1.0,
    kind: 'rock',
    hit: false,
  });

  const restored = restoreAdventureCheckpoint(course, state);
  assert.ok(restored.spawnGraceTimer > 0.5);
  for (let i = 0; i < 15; i++) {
    stepAdventurePhysics(restored, course, emptyInput({ accel: true }), BICYCLES[0], 1.0, 0.03);
  }
  assert.equal(restored.crashed, false);

  const hintStart = getAdventureTutorialHint('lvl_1_first_ride', 10, false, 'none', DEFAULT_ADVENTURE_CONTROLS);
  assert.ok(hintStart && hintStart.includes('Tutorial:'));
  const hintAir = getAdventureTutorialHint('lvl_1_first_ride', 50, true, 'none', DEFAULT_ADVENTURE_CONTROLS);
  assert.ok(hintAir && hintAir.includes('Flip'));
});
