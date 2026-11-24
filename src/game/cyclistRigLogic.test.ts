import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import * as THREE from 'three';
import { buildHumanSkinnedRig, type CyclistMaterialSet } from './three/cyclistGltfBuilder';
import {
  RIG_DIMENSIONS,
  computePedalTargets,
  computeRiderPosture,
  solveTwoBoneIK2D,
} from './three/cyclistKinematics';

function makeDummyMats(): CyclistMaterialSet {
  return {
    jersey: new THREE.MeshStandardMaterial({ name: 'mat_jersey', color: '#e11d48' }),
    jerseyStripe: new THREE.MeshStandardMaterial({ name: 'mat_jersey_stripe', color: '#ffffff' }),
    shorts: new THREE.MeshStandardMaterial({ name: 'mat_shorts', color: '#0f172a' }),
    helmet: new THREE.MeshPhysicalMaterial({ name: 'mat_helmet', color: '#ffffff' }),
    skin: new THREE.MeshStandardMaterial({ name: 'mat_skin', color: '#dca27d' }),
    glove: new THREE.MeshStandardMaterial({ name: 'mat_glove', color: '#0f172a' }),
    shoe: new THREE.MeshStandardMaterial({ name: 'mat_shoe', color: '#f8fafc' }),
    visor: new THREE.MeshPhysicalMaterial({ name: 'mat_visor', color: '#0f172a' }),
    chrome: new THREE.MeshStandardMaterial({ name: 'mat_chrome', color: '#cbd5e1' }),
  };
}

test('two-bone IK keeps exact limb lengths and correct knee/elbow bend directions across full crank cycle', () => {
  for (let deg = 0; deg < 360; deg += 30) {
    const rad = (deg * Math.PI) / 180;
    const pedals = computePedalTargets(rad);

    // Pedals stay 180 degrees opposed on crank circle
    assert.ok(
      Math.abs((pedals.leftY + pedals.rightY) * 0.5 - RIG_DIMENSIONS.bbY) < 1e-6,
    );
    assert.ok(
      Math.abs(
        Math.hypot(pedals.leftY - RIG_DIMENSIONS.bbY, pedals.leftZ - RIG_DIMENSIONS.bbZ) -
          RIG_DIMENSIONS.crankLen,
      ) < 1e-6,
    );

    const hipY = 0.915;
    const hipZ = 0.285;
    const knee = solveTwoBoneIK2D(
      hipY,
      hipZ,
      pedals.leftY + 0.038,
      pedals.leftZ,
      RIG_DIMENSIONS.thighLen,
      RIG_DIMENSIONS.shinLen,
      true,
    );

    const thighDist = Math.hypot(knee.midY - hipY, knee.midZ - hipZ);
    const shinDist = Math.hypot(
      pedals.leftY + 0.038 - knee.midY,
      pedals.leftZ - knee.midZ,
    );
    assert.ok(Math.abs(thighDist - RIG_DIMENSIONS.thighLen) < 1e-5);
    assert.ok(Math.abs(shinDist - RIG_DIMENSIONS.shinLen) < 1e-4);
    // Cycling knee always bends forward (-Z) relative to hip-ankle chord
    assert.ok(knee.midZ < hipZ);
  }

  // Arm IK bends elbow rearward (+Z)
  const shoulderY = 1.07;
  const shoulderZ = -0.02;
  const gripY = 0.91;
  const gripZ = -0.47;
  const elbow = solveTwoBoneIK2D(
    shoulderY,
    shoulderZ,
    gripY,
    gripZ,
    RIG_DIMENSIONS.upperArmLen,
    RIG_DIMENSIONS.forearmLen,
    false,
  );
  const chordMidZ = (shoulderZ + gripZ) * 0.5;
  assert.ok(elbow.midZ > chordMidZ);
});

test('rider posture adjusts cleanly for sprinting, jumping, and landing squash', () => {
  const cruise = computeRiderPosture({
    crankAngle: 0,
    grounded: true,
    verticalVelocity: 0,
    landSquash: 0,
    isSprinting: false,
    isBoosting: false,
  });
  const sprint = computeRiderPosture({
    crankAngle: 0,
    grounded: true,
    verticalVelocity: 0,
    landSquash: 0,
    isSprinting: true,
    isBoosting: false,
  });
  const land = computeRiderPosture({
    crankAngle: 0,
    grounded: true,
    verticalVelocity: 0,
    landSquash: 0.9,
    isSprinting: false,
    isBoosting: false,
  });
  const jumpUp = computeRiderPosture({
    crankAngle: 0,
    grounded: false,
    verticalVelocity: 6.5,
    landSquash: 0,
    isSprinting: false,
    isBoosting: false,
  });

  assert.ok(sprint.pelvisY > cruise.pelvisY);
  assert.ok(land.pelvisY < cruise.pelvisY);
  assert.ok(jumpUp.airPitchX > 0.15);
});

test('skeletal human cyclist has valid Bones, normalized SkinnedMesh weights, AnimationClips, and zero BoxGeometry', () => {
  const rig = buildHumanSkinnedRig(makeDummyMats());

  assert.equal(rig.skeleton.bones.length, 17);
  assert.ok(rig.bones.Pelvis && rig.bones.Chest && rig.bones.Head);
  assert.ok(rig.bones.LeftShoulder && rig.bones.LeftElbow && rig.bones.LeftWrist);
  assert.ok(rig.bones.RightHip && rig.bones.RightKnee && rig.bones.RightAnkle);
  assert.ok(rig.skinnedMeshes.length >= 10);
  assert.ok(rig.clips.some((c) => c.name === 'PedalCycle'));
  assert.ok(rig.clips.some((c) => c.name === 'JumpTuck'));

  for (const sm of rig.skinnedMeshes) {
    const weights = sm.geometry.getAttribute('skinWeight');
    const normals = sm.geometry.getAttribute('normal');
    assert.ok(weights.count > 0);
    assert.ok(normals.count === weights.count);
    for (let i = 0; i < weights.count; i++) {
      const sum =
        weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i);
      assert.ok(Math.abs(sum - 1) < 1e-4, `Unnormalized skinWeight on ${sm.name}`);
    }
  }

  // Audit: verify ZERO BoxGeometry instantiations in cyclistModel.ts and cyclistGltfBuilder.ts
  for (const rel of ['src/game/three/cyclistModel.ts', 'src/game/three/cyclistGltfBuilder.ts']) {
    const src = fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');
    assert.equal(
      /new\s+(?:THREE\.)?BoxGeometry\s*\(/.test(src),
      false,
      `Found prohibited BoxGeometry placeholder in ${rel}`,
    );
  }
});
