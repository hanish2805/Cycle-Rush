import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_START_SPEED_MPS,
  LANE_CENTERS,
  MAX_NORMAL_SPEED_MPS,
  checkCollisionAABB,
  checkNearMiss,
  computeTargetSpeedMps,
  generateSegmentPlan,
  getDifficultyStage,
  getJumpVelocity,
  getScoreMultiplier,
} from './engineLogic';

test('speed progresses smoothly with distance and responds to boost/brake/slow-mo', () => {
  const bike = { speedBonus: 1.0 };
  const startSpeed = computeTargetSpeedMps({
    distanceMeters: 0,
    elapsedSeconds: 0,
    throttle: 0,
    isSpeedBoost: false,
    isSlowMotion: false,
    bike,
  });
  assert.ok(Math.abs(startSpeed - BASE_START_SPEED_MPS) < 0.05);

  const midSpeed = computeTargetSpeedMps({
    distanceMeters: 600,
    elapsedSeconds: 45,
    throttle: 0,
    isSpeedBoost: false,
    isSlowMotion: false,
    bike,
  });
  assert.ok(midSpeed > startSpeed && midSpeed < MAX_NORMAL_SPEED_MPS);

  const sprintSpeed = computeTargetSpeedMps({
    distanceMeters: 600,
    elapsedSeconds: 45,
    throttle: 1,
    isSpeedBoost: false,
    isSlowMotion: false,
    bike,
  });
  assert.ok(sprintSpeed > midSpeed);

  const brakeSpeed = computeTargetSpeedMps({
    distanceMeters: 600,
    elapsedSeconds: 45,
    throttle: -1,
    isSpeedBoost: false,
    isSlowMotion: false,
    bike,
  });
  assert.ok(brakeSpeed < midSpeed);

  const boostSpeed = computeTargetSpeedMps({
    distanceMeters: 100,
    elapsedSeconds: 10,
    throttle: 0,
    isSpeedBoost: true,
    isSlowMotion: false,
    bike,
  });
  assert.ok(boostSpeed > MAX_NORMAL_SPEED_MPS);

  const slowSpeed = computeTargetSpeedMps({
    distanceMeters: 600,
    elapsedSeconds: 45,
    throttle: 0,
    isSpeedBoost: false,
    isSlowMotion: true,
    bike,
  });
  assert.ok(slowSpeed < midSpeed);
});

test('collision detection respects jump clearance over low obstacles and hits tall ones', () => {
  const groundedPlayer = {
    x: 0,
    y: 0,
    z: 0,
    halfWidth: 0.34,
    height: 1.65,
    halfLength: 0.85,
  };
  assert.equal(
    checkCollisionAABB(groundedPlayer, { x: 0, z: 0, type: 'cone' }),
    true,
  );
  assert.equal(
    checkCollisionAABB(groundedPlayer, { x: LANE_CENTERS[0], z: 0, type: 'cone' }),
    false,
  );

  const jumpingPlayer = { ...groundedPlayer, y: 1.05 };
  assert.equal(
    checkCollisionAABB(jumpingPlayer, { x: 0, z: 0, type: 'cone' }),
    false,
  );
  assert.equal(
    checkCollisionAABB(jumpingPlayer, { x: 0, z: 0, type: 'barrier' }),
    false,
  );
  assert.equal(
    checkCollisionAABB(jumpingPlayer, { x: 0, z: 0, type: 'parked_car' }),
    true,
  );
});

test('near miss triggers adjacent to obstacle without colliding', () => {
  const player = {
    x: 1.05,
    y: 0,
    z: 0,
    halfWidth: 0.34,
    height: 1.65,
    halfLength: 0.85,
  };
  const obs = { x: 0, z: 0, type: 'cone' as const };
  assert.equal(checkCollisionAABB(player, obs), false);
  assert.equal(checkNearMiss(player, obs), true);
});

test('segment planner always leaves at least one clear lane on every obstacle row', () => {
  for (let seg = 3; seg < 60; seg++) {
    const stage = getDifficultyStage(seg * 24);
    const plan = generateSegmentPlan(seg, stage, () => ((seg * 37) % 100) / 100);
    const byOffset = new Map<number, number[]>();
    for (const o of plan.obstacles) {
      const list = byOffset.get(o.zOffset) ?? [];
      list.push(o.laneIndex);
      byOffset.set(o.zOffset, list);
    }
    for (const lanes of byOffset.values()) {
      assert.ok(new Set(lanes).size <= 2, `Segment ${seg} blocked all 3 lanes!`);
    }
  }
});

test('super jump and score multiplier calculate expected boosts', () => {
  const baseJump = getJumpVelocity({ jumpBonus: 1.0 }, false);
  const superJump = getJumpVelocity({ jumpBonus: 1.0 }, true);
  assert.ok(superJump > baseJump * 1.25);
  assert.equal(getScoreMultiplier(0, false), 1);
  assert.equal(getScoreMultiplier(10, false), 2);
  assert.equal(getScoreMultiplier(10, true), 4);
});

test('opening segments use gentle hazards and moving_barrier never traps rows across stages 1..12', () => {
  const starterAllowed = new Set(['cone', 'crate', 'pothole']);
  for (let seg = 3; seg <= 4; seg++) {
    const plan = generateSegmentPlan(seg, 1, () => 0.99);
    for (const o of plan.obstacles) {
      assert.ok(
        starterAllowed.has(o.type),
        `Starter segment ${seg} spawned advanced obstacle ${o.type}`,
      );
    }
  }

  for (let seg = 5; seg < 140; seg++) {
    const stage = Math.min(12, 1 + Math.floor(seg / 10));
    let call = 0;
    const plan = generateSegmentPlan(seg, stage, () => {
      call++;
      return ((seg * 19 + call * 31) % 97) / 97;
    });
    const byRow = new Map<number, string[]>();
    for (const o of plan.obstacles) {
      const list = byRow.get(o.zOffset) ?? [];
      list.push(o.type);
      byRow.set(o.zOffset, list);
    }
    let prevMoving = false;
    for (const types of byRow.values()) {
      const hasMoving = types.includes('moving_barrier');
      if (hasMoving) {
        assert.equal(types.length, 1, `moving_barrier shared row at seg ${seg}`);
        assert.equal(prevMoving, false, `back-to-back moving_barrier at seg ${seg}`);
      }
      prevMoving = hasMoving;
    }
  }
});

import { POWERUP_META } from './catalog';
import {
  ROAD_HALF_CLAMP,
  TIME_CHALLENGE_DURATION,
  computeCoinScore,
  computeDistanceScoreDelta,
} from './engineLogic';

test('all six power-ups define valid durations and single-row segments separate power-ups from coins', () => {
  const expectedTypes = [
    'shield',
    'speed_boost',
    'magnet',
    'double_score',
    'super_jump',
    'slow_motion',
  ] as const;

  for (const t of expectedTypes) {
    assert.ok(POWERUP_META[t], `Missing metadata for ${t}`);
    assert.ok(POWERUP_META[t].durationSeconds >= 5, `Duration too short for ${t}`);
    assert.ok(POWERUP_META[t].shortLabel.length > 0);
  }

  // Trigger a power-up spawn on a stage 1 single-row segment (seg 6)
  let foundPowerUp = false;
  for (let i = 0; i < 40; i++) {
    let idx = 0;
    const seq = [0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.05];
    const plan = generateSegmentPlan(6, 1, () => seq[idx++ % seq.length]);
    if (plan.powerUps.length > 0) {
      foundPowerUp = true;
      for (const pu of plan.powerUps) {
        for (const coin of plan.coins) {
          assert.ok(
            Math.abs(pu.zOffset - coin.zOffset) >= 2.0,
            `Power-up at z=${pu.zOffset} overlaps coin at z=${coin.zOffset}`,
          );
        }
      }
      break;
    }
  }
  assert.ok(foundPowerUp, 'Expected deterministic rng to spawn a power-up');
  assert.equal(TIME_CHALLENGE_DURATION, 90);
  assert.equal(computeCoinScore(2), 50);
  assert.ok(computeDistanceScoreDelta(10, 2) > computeDistanceScoreDelta(10, 1));

  // Curb-hugging exploit regression test: player at ±ROAD_HALF_CLAMP must collide with outer-lane cone
  assert.equal(
    checkCollisionAABB(
      {
        x: ROAD_HALF_CLAMP,
        y: 0,
        z: 0,
        halfWidth: 0.34,
        height: 1.65,
        halfLength: 0.82,
      },
      { x: LANE_CENTERS[2], z: 0, type: 'cone' },
    ),
    true,
  );
  assert.equal(
    checkCollisionAABB(
      {
        x: -ROAD_HALF_CLAMP,
        y: 0,
        z: 0,
        halfWidth: 0.34,
        height: 1.65,
        halfLength: 0.82,
      },
      { x: LANE_CENTERS[0], z: 0, type: 'cone' },
    ),
    true,
  );
});


