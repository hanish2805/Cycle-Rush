import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RIG_DIMENSIONS } from './cyclistKinematics';

export interface CyclistMaterialSet {
  jersey: THREE.MeshStandardMaterial;
  jerseyStripe: THREE.MeshStandardMaterial;
  shorts: THREE.MeshStandardMaterial;
  helmet: THREE.MeshPhysicalMaterial;
  skin: THREE.MeshStandardMaterial;
  glove: THREE.MeshStandardMaterial;
  shoe: THREE.MeshStandardMaterial;
  visor: THREE.MeshPhysicalMaterial;
  chrome: THREE.MeshStandardMaterial;
}

export interface BuiltHumanRig {
  root: THREE.Group;
  skeleton: THREE.Skeleton;
  bones: Record<string, THREE.Bone>;
  skinnedMeshes: THREE.SkinnedMesh[];
  clips: THREE.AnimationClip[];
}

interface RingSample {
  y: number;
  cx: number;
  cz: number;
  rx: number;
  rz: number;
  boneIndices: [number, number, number, number];
  boneWeights: [number, number, number, number];
}

/**
 * Lofts a closed elliptical cross-section sequence into an outward-facing
 * THREE.SkinnedMesh bound to the supplied skeleton.
 */
function createLoftedSkinnedMesh(
  name: string,
  rings: RingSample[],
  radialSegments: number,
  material: THREE.Material,
  skeleton: THREE.Skeleton,
  upward: boolean,
  capBottom = false,
  capTop = false,
): THREE.SkinnedMesh {
  const ringStride = radialSegments + 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  const skinIndices: number[] = [];
  const skinWeights: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    const v = rings.length > 1 ? r / (rings.length - 1) : 0;
    for (let j = 0; j <= radialSegments; j++) {
      const u = j / radialSegments;
      const theta = u * Math.PI * 2;
      const x = ring.cx + ring.rx * Math.cos(theta);
      // -sin(theta): u=0.25 -> -Z (front), u=0.75 -> +Z (back)
      const z = ring.cz - ring.rz * Math.sin(theta);

      positions.push(x, ring.y, z);
      uvs.push(u, upward ? 1 - v : v);
      skinIndices.push(
        ring.boneIndices[0],
        ring.boneIndices[1],
        ring.boneIndices[2],
        ring.boneIndices[3],
      );
      skinWeights.push(
        ring.boneWeights[0],
        ring.boneWeights[1],
        ring.boneWeights[2],
        ring.boneWeights[3],
      );
    }
  }

  for (let r = 0; r < rings.length - 1; r++) {
    const rowA = r * ringStride;
    const rowB = (r + 1) * ringStride;
    for (let j = 0; j < radialSegments; j++) {
      const a = rowA + j;
      const b = rowA + j + 1;
      const c = rowB + j + 1;
      const d = rowB + j;
      if (upward) {
        indices.push(a, b, d);
        indices.push(b, c, d);
      } else {
        indices.push(a, d, b);
        indices.push(b, d, c);
      }
    }
  }

  if (capBottom && rings.length > 0) {
    const r0 = rings[0];
    const centerIdx = positions.length / 3;
    positions.push(r0.cx, r0.y, r0.cz);
    uvs.push(0.5, upward ? 1 : 0);
    skinIndices.push(...r0.boneIndices);
    skinWeights.push(...r0.boneWeights);
    for (let j = 0; j < radialSegments; j++) {
      if (upward) {
        indices.push(centerIdx, j + 1, j);
      } else {
        indices.push(centerIdx, j, j + 1);
      }
    }
  }

  if (capTop && rings.length > 1) {
    const lastIdx = rings.length - 1;
    const rLast = rings[lastIdx];
    const rowStart = lastIdx * ringStride;
    const centerIdx = positions.length / 3;
    positions.push(rLast.cx, rLast.y, rLast.cz);
    uvs.push(0.5, upward ? 0 : 1);
    skinIndices.push(...rLast.boneIndices);
    skinWeights.push(...rLast.boneWeights);
    for (let j = 0; j < radialSegments; j++) {
      if (upward) {
        indices.push(centerIdx, rowStart + j, rowStart + j + 1);
      } else {
        indices.push(centerIdx, rowStart + j + 1, rowStart + j);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.SkinnedMesh(geo, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.bind(skeleton);
  return mesh;
}

function buildContouredHeadAndHelmet(
  mats: CyclistMaterialSet,
): THREE.Group {
  const g = new THREE.Group();
  g.name = 'HeadAndHelmetAttachments';

  // Contoured Neck base
  const neckGeo = new THREE.CylinderGeometry(0.044, 0.054, 0.105, 16);
  const neck = new THREE.Mesh(neckGeo, mats.skin);
  neck.position.set(0, -0.02, 0.005);
  neck.castShadow = true;
  g.add(neck);

  // Cranium + sculpted facial profile
  const cranium = new THREE.Mesh(
    new THREE.SphereGeometry(0.094, 20, 16),
    mats.skin,
  );
  cranium.position.set(0, 0.075, -0.008);
  cranium.scale.set(0.91, 1.08, 1.03);
  cranium.castShadow = true;
  g.add(cranium);

  const jaw = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.048, 0.032, 6, 12),
    mats.skin,
  );
  jaw.position.set(0, 0.028, -0.036);
  jaw.rotation.x = 0.35;
  jaw.scale.set(1.05, 0.9, 1.0);
  g.add(jaw);

  // Nose bridge + cheekbones
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.014, 0.038, 8),
    mats.skin,
  );
  nose.rotation.x = -Math.PI * 0.42;
  nose.position.set(0, 0.068, -0.102);
  g.add(nose);

  // Ears
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.012, 0.018, 4, 8),
      mats.skin,
    );
    ear.position.set(side * 0.088, 0.072, -0.004);
    ear.rotation.z = side * 0.12;
    g.add(ear);
  }

  // Wrap-around aerodynamic cycling sunglasses + temple arms
  const visorLens = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.097,
      0.096,
      0.038,
      18,
      1,
      true,
      -Math.PI * 0.34,
      Math.PI * 0.68,
    ),
    mats.visor,
  );
  visorLens.rotation.y = Math.PI;
  visorLens.position.set(0, 0.082, -0.016);
  g.add(visorLens);

  for (const side of [-1, 1]) {
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.082, 0.092, -0.065),
      new THREE.Vector3(side * 0.091, 0.094, -0.015),
      new THREE.Vector3(side * 0.088, 0.086, 0.022),
    ]);
    const temple = new THREE.Mesh(
      new THREE.TubeGeometry(armCurve, 8, 0.0042, 6, false),
      mats.helmet,
    );
    g.add(temple);
  }

  // Multi-piece Sleek Low-Profile Vented Aero Helmet
  const liner = new THREE.Mesh(
    new THREE.SphereGeometry(0.104, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.52),
    mats.shorts,
  );
  liner.position.set(0, 0.088, -0.008);
  liner.scale.set(0.95, 0.78, 1.2);
  liner.rotation.x = 0.08;
  g.add(liner);

  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(0.111, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.54),
    mats.helmet,
  );
  shell.position.set(0, 0.092, -0.008);
  shell.scale.set(0.97, 0.80, 1.24);
  shell.rotation.x = 0.08;
  shell.castShadow = true;
  g.add(shell);

  // Sculpted aero tail cone & dark recessed cooling vent channels
  const aeroTail = new THREE.Mesh(
    new THREE.ConeGeometry(0.056, 0.145, 16),
    mats.helmet,
  );
  aeroTail.rotation.x = Math.PI / 2 + 0.10;
  aeroTail.scale.set(1.2, 1.0, 0.42);
  aeroTail.position.set(0, 0.096, 0.118);
  aeroTail.castShadow = true;
  g.add(aeroTail);

  const centerFin = new THREE.Mesh(
    new THREE.TorusGeometry(0.106, 0.009, 8, 22, Math.PI * 0.72),
    mats.jerseyStripe,
  );
  centerFin.rotation.y = Math.PI / 2;
  centerFin.rotation.z = -Math.PI * 0.14;
  centerFin.position.set(0, 0.094, -0.008);
  centerFin.scale.set(1.2, 0.80, 1.0);
  g.add(centerFin);

  // Recessed dark aero vent ribs & chin straps
  for (const side of [-1, 1]) {
    const ventSlot = new THREE.Mesh(
      new THREE.TorusGeometry(0.107, 0.0065, 6, 16, Math.PI * 0.56),
      mats.shorts,
    );
    ventSlot.rotation.y = Math.PI / 2 + side * 0.26;
    ventSlot.rotation.z = -Math.PI * 0.1;
    ventSlot.position.set(side * 0.022, 0.092, -0.006);
    ventSlot.scale.set(1.16, 0.81, 1.0);
    g.add(ventSlot);

    const strapCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.092, 0.078, -0.032),
      new THREE.Vector3(side * 0.06, 0.024, -0.036),
      new THREE.Vector3(0, -0.006, -0.038),
    ]);
    g.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(strapCurve, 10, 0.0042, 6, false),
        mats.shorts,
      ),
    );
  }

  const dial = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 0.012, 12),
    mats.chrome,
  );
  dial.rotation.x = Math.PI / 2;
  dial.position.set(0, 0.038, 0.098);
  g.add(dial);

  return g;
}

/**
 * Builds an articulated fingerless cycling glove & hand mesh (no BoxGeometry).
 */
function buildCyclingHand(side: -1 | 1, mats: CyclistMaterialSet): THREE.Group {
  const g = new THREE.Group();
  g.name = side < 0 ? 'LeftHandGroup' : 'RightHandGroup';

  // Palm cushion (curved capsule)
  const palm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.024, 0.038, 6, 10),
    mats.glove,
  );
  palm.position.set(0, -0.026, -0.006);
  palm.rotation.x = Math.PI * 0.42;
  palm.scale.set(0.95, 1.0, 0.72);
  palm.castShadow = true;
  g.add(palm);

  // Wrist strap cuff
  const cuff = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.028, 0.022, 12),
    mats.jerseyStripe,
  );
  cuff.position.set(0, -0.006, 0);
  g.add(cuff);

  // Thumb wrapping inward over hood/bar
  const thumbCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-side * 0.018, -0.022, -0.012),
    new THREE.Vector3(-side * 0.034, -0.032, -0.034),
    new THREE.Vector3(-side * 0.022, -0.044, -0.048),
  ]);
  const thumb = new THREE.Mesh(
    new THREE.TubeGeometry(thumbCurve, 8, 0.0085, 8, false),
    mats.skin,
  );
  g.add(thumb);

  // Curled fingers gripping forward/downward around hood
  for (let i = 0; i < 4; i++) {
    const fOffset = (i - 1.5) * 0.011;
    const fingerCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(fOffset * 0.6, -0.032, -0.034),
      new THREE.Vector3(fOffset * 0.5, -0.048, -0.056),
      new THREE.Vector3(fOffset * 0.4, -0.066, -0.044),
    ]);
    const finger = new THREE.Mesh(
      new THREE.TubeGeometry(fingerCurve, 8, 0.0072, 6, false),
      mats.skin,
    );
    g.add(finger);
  }

  return g;
}

/**
 * Builds an ergonomic cycling shoe using ExtrudeGeometry outsole + sculpted upper + BOA dials.
 * Zero BoxGeometry!
 */
function buildCyclingShoe(mats: CyclistMaterialSet): THREE.Group {
  const g = new THREE.Group();
  g.name = 'CyclingShoe';

  // Sculpted carbon outsole profile (in XZ plane, extruded along Y)
  const soleShape = new THREE.Shape();
  soleShape.moveTo(-0.032, 0.055); // heel left
  soleShape.quadraticCurveTo(0, 0.072, 0.032, 0.055); // rounded heel cup
  soleShape.bezierCurveTo(0.038, 0.01, 0.046, -0.06, 0.042, -0.115); // lateral side
  soleShape.quadraticCurveTo(0.015, -0.158, -0.012, -0.155); // anatomical toe box
  soleShape.bezierCurveTo(-0.042, -0.145, -0.042, -0.05, -0.032, 0.055); // medial arch

  const soleGeo = new THREE.ExtrudeGeometry(soleShape, {
    depth: 0.014,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 2,
    curveSegments: 12,
  });
  soleGeo.rotateX(Math.PI / 2);
  const sole = new THREE.Mesh(soleGeo, mats.shorts);
  sole.position.set(0, -0.005, 0);
  sole.castShadow = true;
  g.add(sole);

  // Sleek tapered aerodynamic shoe upper
  const upper = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.037, 0.115, 8, 14),
    mats.shoe,
  );
  upper.rotation.x = Math.PI / 2;
  upper.scale.set(0.98, 1.0, 0.68);
  upper.position.set(0, 0.016, -0.044);
  upper.castShadow = true;
  g.add(upper);

  // Heel cup wrap (rounded cylinder/sphere contour instead of box)
  const heelCup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.034, 0.036, 0.046, 14),
    mats.shorts,
  );
  heelCup.position.set(0, 0.018, 0.022);
  heelCup.scale.set(0.96, 1.0, 1.08);
  g.add(heelCup);

  // Dual metallic BOA dials on instep
  for (let i = 0; i < 2; i++) {
    const dial = new THREE.Mesh(
      new THREE.CylinderGeometry(0.009, 0.009, 0.008, 10),
      mats.chrome,
    );
    dial.rotation.z = Math.PI * 0.35;
    dial.position.set(0.032, 0.034 - i * 0.009, -0.01 - i * 0.032);
    g.add(dial);
  }

  return g;
}

/**
 * Builds the procedural human cyclist as a genuine rigged THREE.Skeleton
 * + continuous THREE.SkinnedMeshes + attached detailed Head/Gloves/Shoes + AnimationClips.
 */
export function buildHumanSkinnedRig(mats: CyclistMaterialSet): BuiltHumanRig {
  const root = new THREE.Group();
  root.name = 'CyclistHumanRoot';

  // 1. Construct Bone Hierarchy
  const pelvis = new THREE.Bone();
  pelvis.name = 'Pelvis';
  pelvis.position.set(0, RIG_DIMENSIONS.pelvisBaseY, RIG_DIMENSIONS.pelvisBaseZ);

  const spine = new THREE.Bone();
  spine.name = 'Spine';
  spine.position.set(0, 0.06, 0);
  pelvis.add(spine);

  const chest = new THREE.Bone();
  chest.name = 'Chest';
  chest.position.set(0, RIG_DIMENSIONS.spineLen, 0);
  spine.add(chest);

  const neck = new THREE.Bone();
  neck.name = 'Neck';
  neck.position.set(0, RIG_DIMENSIONS.chestLen, -0.01);
  chest.add(neck);

  const head = new THREE.Bone();
  head.name = 'Head';
  head.position.set(0, 0.075, -0.01);
  neck.add(head);

  const leftShoulder = new THREE.Bone();
  leftShoulder.name = 'LeftShoulder';
  leftShoulder.position.set(-RIG_DIMENSIONS.shoulderHalfW, 0.19, 0);
  chest.add(leftShoulder);

  const leftElbow = new THREE.Bone();
  leftElbow.name = 'LeftElbow';
  leftElbow.position.set(0, -RIG_DIMENSIONS.upperArmLen, 0);
  leftShoulder.add(leftElbow);

  const leftWrist = new THREE.Bone();
  leftWrist.name = 'LeftWrist';
  leftWrist.position.set(0, -RIG_DIMENSIONS.forearmLen, 0);
  leftElbow.add(leftWrist);

  const rightShoulder = new THREE.Bone();
  rightShoulder.name = 'RightShoulder';
  rightShoulder.position.set(RIG_DIMENSIONS.shoulderHalfW, 0.19, 0);
  chest.add(rightShoulder);

  const rightElbow = new THREE.Bone();
  rightElbow.name = 'RightElbow';
  rightElbow.position.set(0, -RIG_DIMENSIONS.upperArmLen, 0);
  rightShoulder.add(rightElbow);

  const rightWrist = new THREE.Bone();
  rightWrist.name = 'RightWrist';
  rightWrist.position.set(0, -RIG_DIMENSIONS.forearmLen, 0);
  rightElbow.add(rightWrist);

  const leftHip = new THREE.Bone();
  leftHip.name = 'LeftHip';
  leftHip.position.set(-RIG_DIMENSIONS.hipHalfW, -0.035, 0.015);
  pelvis.add(leftHip);

  const leftKnee = new THREE.Bone();
  leftKnee.name = 'LeftKnee';
  leftKnee.position.set(0, -RIG_DIMENSIONS.thighLen, 0);
  leftHip.add(leftKnee);

  const leftAnkle = new THREE.Bone();
  leftAnkle.name = 'LeftAnkle';
  leftAnkle.position.set(0, -RIG_DIMENSIONS.shinLen, 0);
  leftKnee.add(leftAnkle);

  const rightHip = new THREE.Bone();
  rightHip.name = 'RightHip';
  rightHip.position.set(RIG_DIMENSIONS.hipHalfW, -0.035, 0.015);
  pelvis.add(rightHip);

  const rightKnee = new THREE.Bone();
  rightKnee.name = 'RightKnee';
  rightKnee.position.set(0, -RIG_DIMENSIONS.thighLen, 0);
  rightHip.add(rightKnee);

  const rightAnkle = new THREE.Bone();
  rightAnkle.name = 'RightAnkle';
  rightAnkle.position.set(0, -RIG_DIMENSIONS.shinLen, 0);
  rightKnee.add(rightAnkle);

  root.add(pelvis);
  root.updateMatrixWorld(true);

  const boneList = [
    pelvis, // 0
    spine, // 1
    chest, // 2
    neck, // 3
    head, // 4
    leftShoulder, // 5
    leftElbow, // 6
    leftWrist, // 7
    rightShoulder, // 8
    rightElbow, // 9
    rightWrist, // 10
    leftHip, // 11
    leftKnee, // 12
    leftAnkle, // 13
    rightHip, // 14
    rightKnee, // 15
    rightAnkle, // 16
  ];
  const skeleton = new THREE.Skeleton(boneList);

  const bones: Record<string, THREE.Bone> = {};
  for (const b of boneList) bones[b.name] = b;

  // Compute bind-pose world positions for sculpting meshes directly in bind space
  const pPos = pelvis.position;
  const sY = pPos.y + spine.position.y;
  const cY = sY + chest.position.y;
  const nY = cY + neck.position.y;

  // 2. Sculpted Continuous Torso SkinnedMesh (Pelvis -> Spine -> Chest -> Neck)
  // Smooth organic transition from hips, tapered athletic waist, broad latissimus/ribcage, to trapezius & collarbone!
  const torsoRings: RingSample[] = [
    { y: pPos.y - 0.02, cx: 0, cz: pPos.z, rx: 0.138, rz: 0.105, boneIndices: [0, 1, 0, 0], boneWeights: [0.95, 0.05, 0, 0] },
    { y: sY + 0.01, cx: 0, cz: pPos.z - 0.005, rx: 0.142, rz: 0.108, boneIndices: [0, 1, 0, 0], boneWeights: [0.65, 0.35, 0, 0] },
    { y: sY + 0.09, cx: 0, cz: pPos.z - 0.008, rx: 0.134, rz: 0.102, boneIndices: [1, 0, 2, 0], boneWeights: [0.75, 0.15, 0.1, 0] },
    { y: sY + 0.17, cx: 0, cz: pPos.z - 0.01, rx: 0.148, rz: 0.112, boneIndices: [1, 2, 0, 0], boneWeights: [0.45, 0.55, 0, 0] },
    { y: cY + 0.04, cx: 0, cz: pPos.z - 0.012, rx: 0.168, rz: 0.122, boneIndices: [2, 1, 0, 0], boneWeights: [0.82, 0.18, 0, 0] },
    { y: cY + 0.14, cx: 0, cz: pPos.z - 0.014, rx: 0.178, rz: 0.122, boneIndices: [2, 3, 0, 0], boneWeights: [0.94, 0.06, 0, 0] },
    { y: cY + 0.205, cx: 0, cz: pPos.z - 0.014, rx: 0.138, rz: 0.098, boneIndices: [2, 3, 0, 0], boneWeights: [0.82, 0.18, 0, 0] },
    { y: nY + 0.015, cx: 0, cz: pPos.z - 0.012, rx: 0.058, rz: 0.056, boneIndices: [3, 2, 0, 0], boneWeights: [0.7, 0.3, 0, 0] },
  ];
  const torsoMesh = createLoftedSkinnedMesh(
    'RiderTorsoJersey',
    torsoRings,
    22,
    mats.jersey,
    skeleton,
    true,
    true,
    true,
  );

  // Pelvis Cycling Shorts Wrap (covers lower hip saddle seat area seamlessly)
  const pelvisShortsRings: RingSample[] = [
    { y: pPos.y - 0.085, cx: 0, cz: pPos.z + 0.005, rx: 0.145, rz: 0.112, boneIndices: [0, 11, 14, 0], boneWeights: [0.7, 0.15, 0.15, 0] },
    { y: pPos.y - 0.035, cx: 0, cz: pPos.z + 0.005, rx: 0.156, rz: 0.118, boneIndices: [0, 1, 0, 0], boneWeights: [0.9, 0.1, 0, 0] },
    { y: sY + 0.02, cx: 0, cz: pPos.z, rx: 0.146, rz: 0.112, boneIndices: [0, 1, 0, 0], boneWeights: [0.55, 0.45, 0, 0] },
  ];
  const pelvisShortsMesh = createLoftedSkinnedMesh(
    'RiderPelvisShorts',
    pelvisShortsRings,
    20,
    mats.shorts,
    skeleton,
    true,
    true,
    true,
  );

  // 3. Sculpted Continuous Skinned Arms (Shoulder -> Sleeve -> Elbow -> Forearm -> Wrist)
  const buildArmMeshes = (side: -1 | 1): THREE.SkinnedMesh[] => {
    const shIdx = side < 0 ? 5 : 8;
    const elIdx = side < 0 ? 6 : 9;
    const wrIdx = side < 0 ? 7 : 10;
    const shX = side * RIG_DIMENSIONS.shoulderHalfW;
    const shY = cY + 0.19;
    const shZ = pPos.z - 0.01;
    const lenU = RIG_DIMENSIONS.upperArmLen;
    const lenF = RIG_DIMENSIONS.forearmLen;

    // Rounded anatomical deltoid sleeve tucked into torso socket with high Chest blend at top
    const sleeveRings: RingSample[] = [
      { y: shY + 0.02, cx: shX - side * 0.032, cz: shZ, rx: 0.032, rz: 0.036, boneIndices: [2, shIdx, 0, 0], boneWeights: [0.85, 0.15, 0, 0] },
      { y: shY - 0.01, cx: shX - side * 0.01, cz: shZ, rx: 0.048, rz: 0.05, boneIndices: [2, shIdx, 0, 0], boneWeights: [0.52, 0.48, 0, 0] },
      { y: shY - lenU * 0.18, cx: shX, cz: shZ, rx: 0.05, rz: 0.05, boneIndices: [shIdx, 2, 0, 0], boneWeights: [0.82, 0.18, 0, 0] },
      { y: shY - lenU * 0.42, cx: shX, cz: shZ, rx: 0.047, rz: 0.046, boneIndices: [shIdx, elIdx, 0, 0], boneWeights: [0.94, 0.06, 0, 0] },
      { y: shY - lenU * 0.62, cx: shX, cz: shZ, rx: 0.044, rz: 0.043, boneIndices: [shIdx, elIdx, 0, 0], boneWeights: [0.85, 0.15, 0, 0] },
    ];
    const sleeveMesh = createLoftedSkinnedMesh(
      side < 0 ? 'RiderLeftSleeve' : 'RiderRightSleeve',
      sleeveRings,
      14,
      mats.jersey,
      skeleton,
      false,
      true,
      true,
    );

    // Lower arm skin (bicep transition -> smooth skinned elbow -> forearm -> wrist)
    const armSkinRings: RingSample[] = [
      { y: shY - lenU * 0.46, cx: shX, cz: shZ, rx: 0.043, rz: 0.042, boneIndices: [shIdx, elIdx, 0, 0], boneWeights: [0.92, 0.08, 0, 0] },
      { y: shY - lenU * 0.82, cx: shX, cz: shZ, rx: 0.04, rz: 0.039, boneIndices: [shIdx, elIdx, 0, 0], boneWeights: [0.68, 0.32, 0, 0] },
      { y: shY - lenU, cx: shX, cz: shZ, rx: 0.038, rz: 0.038, boneIndices: [shIdx, elIdx, 0, 0], boneWeights: [0.42, 0.58, 0, 0] },
      { y: shY - lenU - lenF * 0.25, cx: shX, cz: shZ, rx: 0.04, rz: 0.038, boneIndices: [elIdx, shIdx, wrIdx, 0], boneWeights: [0.82, 0.15, 0.03, 0] },
      { y: shY - lenU - lenF * 0.62, cx: shX, cz: shZ, rx: 0.033, rz: 0.031, boneIndices: [elIdx, wrIdx, 0, 0], boneWeights: [0.85, 0.15, 0, 0] },
      { y: shY - lenU - lenF, cx: shX, cz: shZ, rx: 0.027, rz: 0.025, boneIndices: [elIdx, wrIdx, 0, 0], boneWeights: [0.55, 0.45, 0, 0] },
    ];
    const armSkinMesh = createLoftedSkinnedMesh(
      side < 0 ? 'RiderLeftArmSkin' : 'RiderRightArmSkin',
      armSkinRings,
      14,
      mats.skin,
      skeleton,
      false,
      true,
      true,
    );

    return [sleeveMesh, armSkinMesh];
  };

  // 4. Sculpted Continuous Skinned Legs (Hip Shorts -> Thigh -> Knee -> Calf -> Ankle)
  const buildLegMeshes = (side: -1 | 1): THREE.SkinnedMesh[] => {
    const hipIdx = side < 0 ? 11 : 14;
    const kneeIdx = side < 0 ? 12 : 15;
    const ankIdx = side < 0 ? 13 : 16;
    const hipX = side * RIG_DIMENSIONS.hipHalfW;
    const hipY = pPos.y - 0.035;
    const hipZ = pPos.z + 0.015;
    const lenT = RIG_DIMENSIONS.thighLen;
    const lenS = RIG_DIMENSIONS.shinLen;

    // Bib shorts thigh section (smoothly weighted to Pelvis + Hip + Knee)
    const shortsLegRings: RingSample[] = [
      { y: hipY + 0.025, cx: hipX, cz: hipZ, rx: 0.078, rz: 0.082, boneIndices: [0, hipIdx, 0, 0], boneWeights: [0.45, 0.55, 0, 0] },
      { y: hipY - lenT * 0.25, cx: hipX, cz: hipZ, rx: 0.075, rz: 0.078, boneIndices: [hipIdx, 0, 0, 0], boneWeights: [0.9, 0.1, 0, 0] },
      { y: hipY - lenT * 0.55, cx: hipX, cz: hipZ, rx: 0.066, rz: 0.068, boneIndices: [hipIdx, kneeIdx, 0, 0], boneWeights: [0.92, 0.08, 0, 0] },
      { y: hipY - lenT * 0.72, cx: hipX, cz: hipZ, rx: 0.059, rz: 0.06, boneIndices: [hipIdx, kneeIdx, 0, 0], boneWeights: [0.85, 0.15, 0, 0] },
    ];
    const shortsLegMesh = createLoftedSkinnedMesh(
      side < 0 ? 'RiderLeftThighShorts' : 'RiderRightThighShorts',
      shortsLegRings,
      16,
      mats.shorts,
      skeleton,
      false,
      true,
      true,
    );

    // Lower leg skin (lower thigh -> sculpted patella knee -> gastrocnemius calf -> tapered ankle)
    const legSkinRings: RingSample[] = [
      { y: hipY - lenT * 0.58, cx: hipX, cz: hipZ, rx: 0.054, rz: 0.055, boneIndices: [hipIdx, kneeIdx, 0, 0], boneWeights: [0.9, 0.1, 0, 0] },
      { y: hipY - lenT * 0.86, cx: hipX, cz: hipZ, rx: 0.051, rz: 0.052, boneIndices: [hipIdx, kneeIdx, 0, 0], boneWeights: [0.68, 0.32, 0, 0] },
      { y: hipY - lenT, cx: hipX, cz: hipZ, rx: 0.049, rz: 0.051, boneIndices: [hipIdx, kneeIdx, 0, 0], boneWeights: [0.45, 0.55, 0, 0] },
      { y: hipY - lenT - lenS * 0.16, cx: hipX, cz: hipZ + 0.004, rx: 0.051, rz: 0.054, boneIndices: [kneeIdx, hipIdx, 0, 0], boneWeights: [0.85, 0.15, 0, 0] },
      { y: hipY - lenT - lenS * 0.36, cx: hipX, cz: hipZ + 0.008, rx: 0.053, rz: 0.056, boneIndices: [kneeIdx, ankIdx, 0, 0], boneWeights: [0.92, 0.08, 0, 0] },
      { y: hipY - lenT - lenS * 0.72, cx: hipX, cz: hipZ + 0.003, rx: 0.039, rz: 0.041, boneIndices: [kneeIdx, ankIdx, 0, 0], boneWeights: [0.75, 0.25, 0, 0] },
      { y: hipY - lenT - lenS, cx: hipX, cz: hipZ, rx: 0.033, rz: 0.036, boneIndices: [ankIdx, kneeIdx, 0, 0], boneWeights: [0.55, 0.45, 0, 0] },
    ];
    const legSkinMesh = createLoftedSkinnedMesh(
      side < 0 ? 'RiderLeftLegSkin' : 'RiderRightLegSkin',
      legSkinRings,
      16,
      mats.skin,
      skeleton,
      false,
      true,
      true,
    );

    // Athletic cycling sock cuff above shoe
    const sockRings: RingSample[] = [
      { y: hipY - lenT - lenS * 0.72, cx: hipX, cz: hipZ + 0.003, rx: 0.041, rz: 0.043, boneIndices: [kneeIdx, ankIdx, 0, 0], boneWeights: [0.75, 0.25, 0, 0] },
      { y: hipY - lenT - lenS * 0.99, cx: hipX, cz: hipZ, rx: 0.035, rz: 0.038, boneIndices: [ankIdx, kneeIdx, 0, 0], boneWeights: [0.65, 0.35, 0, 0] },
    ];
    const sockMesh = createLoftedSkinnedMesh(
      side < 0 ? 'RiderLeftSock' : 'RiderRightSock',
      sockRings,
      14,
      mats.jerseyStripe,
      skeleton,
      false,
      false,
      false,
    );

    return [shortsLegMesh, legSkinMesh, sockMesh];
  };

  const skinnedMeshes: THREE.SkinnedMesh[] = [
    torsoMesh,
    pelvisShortsMesh,
    ...buildArmMeshes(-1),
    ...buildArmMeshes(1),
    ...buildLegMeshes(-1),
    ...buildLegMeshes(1),
  ];
  for (const sm of skinnedMeshes) {
    root.add(sm);
  }

  // 5. Attach sculpted Head/Helmet, Gloves, and Cycling Shoes onto Bones
  head.add(buildContouredHeadAndHelmet(mats));
  leftWrist.add(buildCyclingHand(-1, mats));
  rightWrist.add(buildCyclingHand(1, mats));
  leftAnkle.add(buildCyclingShoe(mats));
  rightAnkle.add(buildCyclingShoe(mats));

  // 6. Author real AnimationClips for GLB / AnimationMixer interoperability
  const qNeutral = new THREE.Quaternion();
  const qFwd = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35, 0, 0));
  const qBack = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.25, 0, 0));
  const pedalClip = new THREE.AnimationClip('PedalCycle', 1.0, [
    new THREE.QuaternionKeyframeTrack(
      'LeftHip.quaternion',
      [0, 0.5, 1],
      [
        qFwd.x, qFwd.y, qFwd.z, qFwd.w,
        qBack.x, qBack.y, qBack.z, qBack.w,
        qFwd.x, qFwd.y, qFwd.z, qFwd.w,
      ],
    ),
    new THREE.QuaternionKeyframeTrack(
      'RightHip.quaternion',
      [0, 0.5, 1],
      [
        qBack.x, qBack.y, qBack.z, qBack.w,
        qFwd.x, qFwd.y, qFwd.z, qFwd.w,
        qBack.x, qBack.y, qBack.z, qBack.w,
      ],
    ),
  ]);

  const qSpineCrouch = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(-0.42, 0, 0),
  );
  const jumpClip = new THREE.AnimationClip('JumpTuck', 0.6, [
    new THREE.QuaternionKeyframeTrack(
      'Spine.quaternion',
      [0, 0.3, 0.6],
      [
        qNeutral.x, qNeutral.y, qNeutral.z, qNeutral.w,
        qSpineCrouch.x, qSpineCrouch.y, qSpineCrouch.z, qSpineCrouch.w,
        qNeutral.x, qNeutral.y, qNeutral.z, qNeutral.w,
      ],
    ),
  ]);

  return {
    root,
    skeleton,
    bones,
    skinnedMeshes,
    clips: [pedalClip, jumpClip],
  };
}

/**
 * Serializes the rigged cyclist to a real binary GLB ArrayBuffer using GLTFExporter
 * and loads it back via GLTFLoader.parseAsync for genuine glTF 2.0 asset fidelity
 * with zero external network requests (Zero-404 safe).
 */
export async function roundtripCyclistViaGLB(
  rig: BuiltHumanRig,
): Promise<{
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  bones: Record<string, THREE.Bone>;
  skinnedMeshes: THREE.SkinnedMesh[];
  glbByteLength: number;
}> {
  const exporter = new GLTFExporter();
  const glbBuffer = (await exporter.parseAsync(rig.root, {
    binary: true,
    animations: rig.clips,
  })) as ArrayBuffer;

  const loader = new GLTFLoader();
  const gltf = await loader.parseAsync(glbBuffer, '');

  const bones: Record<string, THREE.Bone> = {};
  const skinnedMeshes: THREE.SkinnedMesh[] = [];
  gltf.scene.traverse((obj) => {
    if ((obj as THREE.Bone).isBone) {
      bones[obj.name] = obj as THREE.Bone;
    }
    if ((obj as THREE.SkinnedMesh).isSkinnedMesh) {
      const sm = obj as THREE.SkinnedMesh;
      sm.castShadow = true;
      sm.frustumCulled = false;
      skinnedMeshes.push(sm);
    } else if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = true;
    }
  });

  return {
    scene: gltf.scene,
    animations: gltf.animations,
    bones,
    skinnedMeshes,
    glbByteLength: glbBuffer.byteLength,
  };
}
