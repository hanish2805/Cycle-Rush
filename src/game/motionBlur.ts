import type { AdventureCameraMode } from './types';

export interface MotionBlurInput {
  active: boolean;
  isCrashed: boolean;
  speedMps: number;
  lateralVx: number;
  verticalVy: number;
  isBoosting: boolean;
  isSlowMotion?: boolean;
  cameraMode?: AdventureCameraMode;
}

export interface MotionBlurState {
  intensity: number;
  radialStrength: number;
  velocityX: number;
  velocityY: number;
  focalX: number;
  focalY: number;
  chromaAmount: number;
}

export const ZERO_MOTION_BLUR: MotionBlurState = {
  intensity: 0,
  radialStrength: 0,
  velocityX: 0,
  velocityY: 0,
  focalX: 0.5,
  focalY: 0.56,
  chromaAmount: 0,
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function dampValue(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * Math.max(0, dt)));
}

/**
 * Computes target screen-space radial & directional motion blur parameters
 * from live cycling kinematics. Keeps blur zeroed during menus/pause/crashes
 * and scales cleanly with speed, boost, downhill dive, and cornering.
 */
export function computeMotionBlurState(input: MotionBlurInput): MotionBlurState {
  if (!input.active || input.isCrashed) {
    return { ...ZERO_MOTION_BLUR };
  }

  const speed = Math.max(0, input.speedMps);
  // Subtle peripheral onset above ~27 km/h (7.5 m/s), reaching full cruise sensation by ~100 km/h (28 m/s)
  const speedNorm = clamp((speed - 7.5) / 20.5, 0, 1);
  const curvedSpeed = speedNorm * speedNorm * (3 - 2 * speedNorm);

  // Fast descent / jump dive contributes extra perceived optical flow
  const diveBoost = clamp((-input.verticalVy - 2.0) / 14.0, 0, 0.18);
  const lateralNorm = clamp(Math.abs(input.lateralVx) / 10.0, 0, 1);

  let intensity = curvedSpeed * 0.62 + lateralNorm * speedNorm * 0.1 + diveBoost;
  if (input.isBoosting) {
    intensity = Math.max(intensity + 0.28, 0.55);
  }
  if (input.isSlowMotion) {
    intensity *= 0.45;
  }

  intensity = clamp(intensity, 0, 1);

  // Radial streak strength drives outer-screen optical zoom streaks
  const radialStrength = intensity * (input.isBoosting ? 0.036 : 0.025);

  // Subtle screen-space directional smear opposite to lateral carve & vertical drop
  const velocityX = clamp(-input.lateralVx * 0.0011 * (0.35 + speedNorm), -0.012, 0.012);
  const velocityY = clamp(input.verticalVy * 0.0009 * (0.4 + speedNorm), -0.011, 0.011);

  let focalX = 0.5 - clamp(input.lateralVx * 0.0045, -0.06, 0.06);
  let focalY = 0.56;
  if (input.cameraMode === 'stunt') {
    focalX = 0.44;
    focalY = 0.52;
  } else if (input.cameraMode === 'downhill') {
    focalY = 0.6;
  } else if (input.cameraMode === 'jump') {
    focalX = 0.47;
    focalY = 0.53;
  }

  const chromaAmount = input.isBoosting
    ? clamp((intensity - 0.35) * 0.85, 0, 0.65)
    : clamp((intensity - 0.65) * 0.5, 0, 0.25);

  return {
    intensity,
    radialStrength,
    velocityX,
    velocityY,
    focalX,
    focalY,
    chromaAmount,
  };
}

export function dampMotionBlurState(
  current: MotionBlurState,
  target: MotionBlurState,
  dt: number,
): MotionBlurState {
  const lambda = target.intensity > current.intensity ? 9.0 : 12.0;
  return {
    intensity: dampValue(current.intensity, target.intensity, lambda, dt),
    radialStrength: dampValue(current.radialStrength, target.radialStrength, lambda, dt),
    velocityX: dampValue(current.velocityX, target.velocityX, lambda, dt),
    velocityY: dampValue(current.velocityY, target.velocityY, lambda, dt),
    focalX: dampValue(current.focalX, target.focalX, 8.0, dt),
    focalY: dampValue(current.focalY, target.focalY, 8.0, dt),
    chromaAmount: dampValue(current.chromaAmount, target.chromaAmount, lambda, dt),
  };
}
