import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ZERO_MOTION_BLUR,
  computeMotionBlurState,
  dampMotionBlurState,
} from './motionBlur';

describe('Screen-space motion blur kinematics', () => {
  it('returns zero blur when inactive or crashed', () => {
    const paused = computeMotionBlurState({
      active: false,
      isCrashed: false,
      speedMps: 24,
      lateralVx: 4,
      verticalVy: -3,
      isBoosting: true,
    });
    assert.deepEqual(paused, ZERO_MOTION_BLUR);

    const crashed = computeMotionBlurState({
      active: true,
      isCrashed: true,
      speedMps: 24,
      lateralVx: 0,
      verticalVy: 0,
      isBoosting: false,
    });
    assert.deepEqual(crashed, ZERO_MOTION_BLUR);
  });

  it('scales intensity monotonically with forward cycling speed', () => {
    const idle = computeMotionBlurState({
      active: true,
      isCrashed: false,
      speedMps: 6,
      lateralVx: 0,
      verticalVy: 0,
      isBoosting: false,
    });
    const cruise = computeMotionBlurState({
      active: true,
      isCrashed: false,
      speedMps: 16,
      lateralVx: 0,
      verticalVy: 0,
      isBoosting: false,
    });
    const fast = computeMotionBlurState({
      active: true,
      isCrashed: false,
      speedMps: 26,
      lateralVx: 0,
      verticalVy: 0,
      isBoosting: false,
    });

    assert.equal(idle.intensity, 0);
    assert.ok(cruise.intensity > 0.05 && cruise.intensity < fast.intensity);
    assert.ok(fast.radialStrength > cruise.radialStrength);
  });

  it('amplifies blur and edge chroma during speed boost and dampens in slow motion', () => {
    const normal = computeMotionBlurState({
      active: true,
      isCrashed: false,
      speedMps: 18,
      lateralVx: 0,
      verticalVy: 0,
      isBoosting: false,
    });
    const boosted = computeMotionBlurState({
      active: true,
      isCrashed: false,
      speedMps: 18,
      lateralVx: 0,
      verticalVy: 0,
      isBoosting: true,
    });
    const slowMo = computeMotionBlurState({
      active: true,
      isCrashed: false,
      speedMps: 18,
      lateralVx: 0,
      verticalVy: 0,
      isBoosting: false,
      isSlowMotion: true,
    });

    assert.ok(boosted.intensity > normal.intensity);
    assert.ok(boosted.chromaAmount > normal.chromaAmount);
    assert.ok(slowMo.intensity < normal.intensity);
  });

  it('produces clamped directional streaks for lateral turns and airborne dives', () => {
    const carvingRight = computeMotionBlurState({
      active: true,
      isCrashed: false,
      speedMps: 20,
      lateralVx: 8,
      verticalVy: -10,
      isBoosting: false,
      cameraMode: 'downhill',
    });

    assert.ok(carvingRight.velocityX < 0);
    assert.ok(carvingRight.velocityY < 0);
    assert.ok(carvingRight.focalX < 0.5);
    assert.equal(carvingRight.focalY, 0.6);
  });

  it('smoothly interpolates toward target motion blur state', () => {
    const target = computeMotionBlurState({
      active: true,
      isCrashed: false,
      speedMps: 24,
      lateralVx: 0,
      verticalVy: 0,
      isBoosting: true,
    });
    const mid = dampMotionBlurState(ZERO_MOTION_BLUR, target, 0.05);
    assert.ok(mid.intensity > 0 && mid.intensity < target.intensity);
  });
});
