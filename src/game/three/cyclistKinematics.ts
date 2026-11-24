export interface TwoBoneIKResult {
  midY: number;
  midZ: number;
  upperAngleX: number;
  lowerAngleX: number;
}

export const RIG_DIMENSIONS = {
  wheelRadiusDefault: 0.36,
  rearAxleZ: 0.54,
  frontAxleZ: -0.54,
  bbY: 0.305,
  bbZ: 0.04,
  crankLen: 0.17,
  hipHalfW: 0.098,
  kneeHalfW: 0.106,
  ankleHalfW: 0.115,
  thighLen: 0.42,
  shinLen: 0.41,
  pelvisBaseY: 0.95,
  pelvisBaseZ: 0.27,
  spineLen: 0.21,
  chestLen: 0.23,
  shoulderHalfW: 0.156,
  upperArmLen: 0.34,
  forearmLen: 0.33,
} as const;

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/**
 * Analytic 2-bone IK solver in the YZ sagittal plane (-Z is forward, +Y is up).
 * When bendForwardNegativeZ is true (knees), joint bends forward (-Z).
 * When false (elbows), joint bends rearward (+Z).
 */
export function solveTwoBoneIK2D(
  originY: number,
  originZ: number,
  targetY: number,
  targetZ: number,
  len1: number,
  len2: number,
  bendForwardNegativeZ: boolean,
): TwoBoneIKResult {
  const dy = targetY - originY;
  const dz = targetZ - originZ;
  let dist = Math.hypot(dy, dz);
  const maxReach = (len1 + len2) * 0.992;
  const minReach = Math.abs(len1 - len2) + 0.02;
  dist = clamp(dist, minReach, maxReach);

  const baseAngle = Math.atan2(dz, dy);
  const cosA = clamp(
    (len1 * len1 + dist * dist - len2 * len2) / (2 * len1 * dist),
    -1,
    1,
  );
  const angleOffset = Math.acos(cosA);
  // In YZ plane (Y = cos(a), Z = sin(a)): increasing angle rotates -Y toward -Z (forward knee bend);
  // decreasing angle rotates toward +Z/-Y (natural rearward elbow bend).
  const finalAngle = bendForwardNegativeZ
    ? baseAngle + angleOffset
    : baseAngle - angleOffset;

  const midY = originY + Math.cos(finalAngle) * len1;
  const midZ = originZ + Math.sin(finalAngle) * len1;

  // Bone local rest axis is -Y. R_x(theta) * (0, -L, 0) = (0, -L cos(theta), -L sin(theta)).
  const upperAngleX = Math.atan2(-(midZ - originZ), -(midY - originY));
  const lowerAngleX = Math.atan2(-(targetZ - midZ), -(targetY - midY));

  return {
    midY,
    midZ,
    upperAngleX,
    lowerAngleX,
  };
}

export interface PedalTargets {
  leftY: number;
  leftZ: number;
  rightY: number;
  rightZ: number;
  leftFootPitch: number;
  rightFootPitch: number;
}

export function computePedalTargets(
  crankAngle: number,
  bbY = RIG_DIMENSIONS.bbY,
  bbZ = RIG_DIMENSIONS.bbZ,
  crankLen = RIG_DIMENSIONS.crankLen,
): PedalTargets {
  const c = Math.cos(crankAngle);
  const s = Math.sin(crankAngle);
  return {
    leftY: bbY - crankLen * c,
    leftZ: bbZ - crankLen * s,
    rightY: bbY + crankLen * c,
    rightZ: bbZ + crankLen * s,
    leftFootPitch: Math.sin(crankAngle) * 0.18 + 0.06,
    rightFootPitch: -Math.sin(crankAngle) * 0.18 + 0.06,
  };
}

export interface RiderPosture {
  pelvisY: number;
  pelvisZ: number;
  pelvisRollZ: number;
  spinePitchX: number;
  chestPitchX: number;
  headPitchX: number;
  airPitchX: number;
  bikeLiftY: number;
}

export function computeRiderPosture(params: {
  crankAngle: number;
  grounded: boolean;
  verticalVelocity: number;
  landSquash: number;
  suspensionCompression?: number;
  isSprinting: boolean;
  isBoosting: boolean;
  isManual?: boolean;
  balancePitch?: number;
  trickPose?: 'none' | 'superman' | 'no_hands' | 'tabletop';
}): RiderPosture {
  const sprintLift = params.isSprinting || params.isBoosting ? 0.075 : 0;
  const jumpLift = !params.grounded ? 0.055 : 0;
  const susp = params.suspensionCompression ?? 0;
  const squashDrop = params.landSquash * 0.045 + susp * 0.48;
  const bal = params.balancePitch ?? 0;
  const trick = params.trickPose ?? 'none';

  const bobAmp = params.isManual
    ? 0
    : params.isSprinting || params.isBoosting
      ? 0.02
      : 0.007;
  const pelvisBob = params.grounded ? Math.sin(params.crankAngle * 2) * bobAmp : 0;

  let pelvisY =
    RIG_DIMENSIONS.pelvisBaseY +
    sprintLift +
    jumpLift -
    squashDrop +
    pelvisBob -
    Math.max(0, bal) * 0.06 -
    (params.isManual ? 0.055 : 0);
  let pelvisZ =
    RIG_DIMENSIONS.pelvisBaseZ -
    (params.isSprinting || params.isBoosting ? 0.055 : 0) +
    (!params.grounded ? 0.02 : 0) +
    bal * 0.09 +
    (params.isManual ? 0.12 : 0);

  const rockAmp = params.isManual
    ? 0
    : params.isSprinting || params.isBoosting
      ? 0.062
      : 0.022;
  let pelvisRollZ = params.grounded ? Math.sin(params.crankAngle) * rockAmp : 0;

  const crouchExtra = params.isBoosting
    ? 0.16
    : params.isSprinting
      ? 0.09
      : 0;
  const squashCrouch = params.landSquash * 0.12 + Math.max(0, susp) * 0.6;
  let totalTorsoLean =
    0.72 + crouchExtra + squashCrouch - bal * 0.35 + (params.isManual ? 0.18 : 0);

  if (trick === 'superman') {
    pelvisY += 0.16;
    pelvisZ += 0.38;
    totalTorsoLean = 1.28;
  } else if (trick === 'no_hands') {
    pelvisY += 0.04;
    totalTorsoLean = 0.22;
  } else if (trick === 'tabletop') {
    pelvisRollZ += 0.34;
    pelvisY += 0.04;
  }

  const spinePitchX = -totalTorsoLean * 0.54;
  const chestPitchX = -totalTorsoLean * 0.46;
  const headPitchX = totalTorsoLean * 0.84;

  const airPitchX = !params.grounded
    ? clamp(params.verticalVelocity * 0.032, -0.26, 0.3)
    : 0;

  return {
    pelvisY,
    pelvisZ,
    pelvisRollZ,
    spinePitchX,
    chestPitchX,
    headPitchX,
    airPitchX,
    bikeLiftY: -params.landSquash * 0.04 - susp * 0.45,
  };
}
