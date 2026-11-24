import * as THREE from 'three';
import type { LoadoutConfig } from '../types';
import {
  buildHumanSkinnedRig,
  roundtripCyclistViaGLB,
  type CyclistMaterialSet,
} from './cyclistGltfBuilder';
import {
  RIG_DIMENSIONS,
  computePedalTargets,
  computeRiderPosture,
  solveTwoBoneIK2D,
} from './cyclistKinematics';
import {
  createJerseyTexture,
  createShortsTexture,
  createTireTreadTextures,
  drawJerseyCanvas,
  drawShortsCanvas,
} from './cyclistTextures';

export interface CyclistAnimParams {
  speedMps: number;
  distanceDelta: number;
  leanAngle: number; // radians, positive = leaning left, negative = leaning right
  steerAngle: number;
  grounded: boolean;
  verticalVelocity: number;
  jumpProgress: number;
  landSquash: number; // 0..1 compression impulse on landing
  isSprinting: boolean;
  isBoosting: boolean;
  isCrashed: boolean;
  crashElapsed: number;
  shieldActive: boolean;
  powerAuraColor?: string | null;
  elapsed: number;
  // Optional Adventure Mode overrides
  bikePitchX?: number;
  bikeYawY?: number;
  balancePitch?: number;
  suspensionCompression?: number;
  isManual?: boolean;
  isStoppie?: boolean;
  trickPose?: 'none' | 'superman' | 'no_hands' | 'tabletop';
}

export class CyclistRig {
  public readonly root = new THREE.Group();
  public readonly leanGroup = new THREE.Group();
  public readonly bikeGroup = new THREE.Group();
  public readonly riderGroup = new THREE.Group();

  private frontWheelGroup = new THREE.Group();
  private rearWheelGroup = new THREE.Group();
  private frontForkGroup = new THREE.Group();
  private crankGroup = new THREE.Group();
  private leftPedalGroup = new THREE.Group();
  private rightPedalGroup = new THREE.Group();
  private saddleGroup = new THREE.Group();
  private shieldBubble: THREE.Mesh;
  private powerAuraRing: THREE.Mesh;

  // Skeletal rider state
  private riderScene!: THREE.Group;
  private bones: Record<string, THREE.Bone> = {};
  private mixer: THREE.AnimationMixer | null = null;
  private pedalAction: THREE.AnimationAction | null = null;
  private jumpAction: THREE.AnimationAction | null = null;
  private disposed = false;

  // GLTF / Skinned verification telemetry
  public gltfLoaded = false;
  public glbByteLength = 0;
  public skinnedMeshCount = 0;
  public boneCount = 0;

  // Materials & dynamic canvas textures updated live by loadout
  private mats: CyclistMaterialSet;
  private matFrame: THREE.MeshPhysicalMaterial;
  private matFork: THREE.MeshStandardMaterial;
  private matRim: THREE.MeshStandardMaterial;
  private matTire: THREE.MeshStandardMaterial;
  private matAccent: THREE.MeshStandardMaterial;
  private matBottle: THREE.MeshStandardMaterial;
  private jerseyCanvas: HTMLCanvasElement;
  private jerseyTexture: THREE.CanvasTexture;
  private shortsCanvas: HTMLCanvasElement;
  private shortsTexture: THREE.CanvasTexture;
  private tireMap: THREE.CanvasTexture;
  private tireBumpMap: THREE.CanvasTexture;

  // Dynamic simulation state
  private crankAngle = 0;
  private wheelAngle = 0;
  private wheelRadius: number = RIG_DIMENSIONS.wheelRadiusDefault;
  private baseFrontForkY = 0.80;
  private baseFrontWheelY = RIG_DIMENSIONS.wheelRadiusDefault - 0.80;
  private gripLeftLocal = new THREE.Vector3(-0.215, 0.87, -0.45);
  private gripRightLocal = new THREE.Vector3(0.215, 0.87, -0.45);

  // Zero-allocation scratch math objects
  private readonly _up = new THREE.Vector3(0, 1, 0);
  private readonly _fwdRef = new THREE.Vector3(0, 0, 1);
  private readonly _dir = new THREE.Vector3();
  private readonly _xAxis = new THREE.Vector3();
  private readonly _yAxis = new THREE.Vector3();
  private readonly _zAxis = new THREE.Vector3();
  private readonly _mat4 = new THREE.Matrix4();
  private readonly _qParentWorld = new THREE.Quaternion();
  private readonly _qDesiredWorld = new THREE.Quaternion();
  private readonly _qLocal = new THREE.Quaternion();
  private readonly _euler = new THREE.Euler();

  private readonly _gripL = new THREE.Vector3();
  private readonly _gripR = new THREE.Vector3();
  private readonly _hipWorld = new THREE.Vector3();
  private readonly _kneeTarget = new THREE.Vector3();
  private readonly _ankleTarget = new THREE.Vector3();
  private readonly _shoulderWorld = new THREE.Vector3();
  private readonly _elbowTarget = new THREE.Vector3();

  constructor(initialLoadout: LoadoutConfig) {
    const jerseyTex = createJerseyTexture(
      initialLoadout.outfit.jerseyHex,
      initialLoadout.outfit.jerseyStripeHex,
    );
    this.jerseyCanvas = jerseyTex.canvas;
    this.jerseyTexture = jerseyTex.texture;

    const shortsTex = createShortsTexture(
      initialLoadout.outfit.shortsHex,
      initialLoadout.outfit.jerseyStripeHex,
    );
    this.shortsCanvas = shortsTex.canvas;
    this.shortsTexture = shortsTex.texture;

    const tireTex = createTireTreadTextures();
    this.tireMap = tireTex.map;
    this.tireBumpMap = tireTex.bumpMap;

    this.matFrame = new THREE.MeshPhysicalMaterial({
      name: 'mat_frame',
      color: initialLoadout.skin.frameHex,
      metalness: initialLoadout.skin.metalness,
      roughness: initialLoadout.skin.roughness,
      clearcoat: initialLoadout.skin.clearcoat,
      clearcoatRoughness: 0.14,
    });
    this.matFork = new THREE.MeshStandardMaterial({
      name: 'mat_fork',
      color: initialLoadout.skin.forkHex,
      metalness: 0.42,
      roughness: 0.34,
    });
    this.matRim = new THREE.MeshStandardMaterial({
      name: 'mat_rim',
      color: initialLoadout.skin.rimHex,
      metalness: 0.78,
      roughness: 0.24,
    });
    this.matTire = new THREE.MeshStandardMaterial({
      name: 'mat_tire',
      map: tireTex.map,
      bumpMap: tireTex.bumpMap,
      bumpScale: 0.008,
      metalness: 0.04,
      roughness: 0.88,
    });
    this.matAccent = new THREE.MeshStandardMaterial({
      name: 'mat_accent',
      color: initialLoadout.bicycle.accentHex,
      metalness: 0.35,
      roughness: 0.28,
    });
    this.matBottle = new THREE.MeshStandardMaterial({
      name: 'mat_bottle',
      color: initialLoadout.bicycle.accentHex,
      roughness: 0.38,
      metalness: 0.1,
    });

    this.mats = {
      jersey: new THREE.MeshStandardMaterial({
        name: 'mat_jersey',
        map: this.jerseyTexture,
        roughness: 0.72,
        metalness: 0.04,
      }),
      jerseyStripe: new THREE.MeshStandardMaterial({
        name: 'mat_jersey_stripe',
        color: initialLoadout.outfit.jerseyStripeHex,
        roughness: 0.52,
        metalness: 0.08,
      }),
      shorts: new THREE.MeshStandardMaterial({
        name: 'mat_shorts',
        map: this.shortsTexture,
        roughness: 0.76,
        metalness: 0.04,
      }),
      helmet: new THREE.MeshPhysicalMaterial({
        name: 'mat_helmet',
        color: initialLoadout.outfit.helmetHex,
        roughness: 0.2,
        metalness: 0.22,
        clearcoat: 0.88,
        clearcoatRoughness: 0.1,
      }),
      skin: new THREE.MeshStandardMaterial({
        name: 'mat_skin',
        color: '#dca27d',
        roughness: 0.62,
        metalness: 0.02,
      }),
      glove: new THREE.MeshStandardMaterial({
        name: 'mat_glove',
        color: initialLoadout.outfit.gloveHex,
        roughness: 0.68,
        metalness: 0.05,
      }),
      shoe: new THREE.MeshStandardMaterial({
        name: 'mat_shoe',
        color: initialLoadout.outfit.shoeHex,
        roughness: 0.34,
        metalness: 0.16,
      }),
      visor: new THREE.MeshPhysicalMaterial({
        name: 'mat_visor',
        color: '#0f172a',
        metalness: 0.78,
        roughness: 0.1,
        clearcoat: 1.0,
      }),
      chrome: new THREE.MeshStandardMaterial({
        name: 'mat_chrome',
        color: '#cbd5e1',
        metalness: 0.92,
        roughness: 0.18,
      }),
    };

    this.root.add(this.leanGroup);
    this.leanGroup.add(this.bikeGroup);
    this.leanGroup.add(this.riderGroup);

    const shieldGeo = new THREE.SphereGeometry(1.18, 24, 18);
    const shieldMat = new THREE.MeshStandardMaterial({
      color: '#22d3ee',
      emissive: '#0891b2',
      emissiveIntensity: 0.65,
      transparent: true,
      opacity: 0.22,
      roughness: 0.1,
      metalness: 0.1,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.shieldBubble = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldBubble.position.set(0, 0.95, 0);
    this.shieldBubble.visible = false;
    this.leanGroup.add(this.shieldBubble);

    const auraGeo = new THREE.TorusGeometry(0.92, 0.045, 8, 32);
    auraGeo.rotateX(Math.PI / 2);
    const auraMat = new THREE.MeshBasicMaterial({
      color: '#f59e0b',
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    this.powerAuraRing = new THREE.Mesh(auraGeo, auraMat);
    this.powerAuraRing.position.set(0, 0.14, 0);
    this.powerAuraRing.visible = false;
    this.leanGroup.add(this.powerAuraRing);

    this.buildBicycle(initialLoadout);
    this.initSkeletalHumanCyclist();
    this.updatePose(0, false, false, true, 0, 0);
  }

  private initSkeletalHumanCyclist(): void {
    const built = buildHumanSkinnedRig(this.mats);
    this.riderScene = built.root;
    this.bones = built.bones;
    this.skinnedMeshCount = built.skinnedMeshes.length;
    this.boneCount = Object.keys(built.bones).length;
    this.riderGroup.add(this.riderScene);

    this.setupAnimationMixer(this.riderScene, built.clips);
    this.publishTelemetry();

    // Roundtrip the procedural rigged skeleton + clips through GLTFExporter -> GLTFLoader (.glb)
    // so runtime uses a genuine glTF 2.0 binary asset pipeline without external 404s.
    void roundtripCyclistViaGLB(built)
      .then((gltfResult) => {
        if (this.disposed) return;

        // Re-bind live shared PBR materials (with live CanvasTextures) by material name
        const matByName: Record<string, THREE.Material> = {
          mat_jersey: this.mats.jersey,
          mat_jersey_stripe: this.mats.jerseyStripe,
          mat_shorts: this.mats.shorts,
          mat_helmet: this.mats.helmet,
          mat_skin: this.mats.skin,
          mat_glove: this.mats.glove,
          mat_shoe: this.mats.shoe,
          mat_visor: this.mats.visor,
          mat_chrome: this.mats.chrome,
        };
        gltfResult.scene.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh && mesh.material) {
            const m = mesh.material as THREE.Material;
            if (m.name && matByName[m.name]) {
              mesh.material = matByName[m.name];
            }
          }
        });

        const oldScene = this.riderScene;
        this.riderGroup.remove(oldScene);
        const disposedOld = new Set<THREE.BufferGeometry>();
        oldScene.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh && mesh.geometry && !disposedOld.has(mesh.geometry)) {
            disposedOld.add(mesh.geometry);
            mesh.geometry.dispose();
          }
        });
        this.riderScene = gltfResult.scene;
        this.bones = gltfResult.bones;
        this.skinnedMeshCount = gltfResult.skinnedMeshes.length;
        this.boneCount = Object.keys(gltfResult.bones).length;
        this.glbByteLength = gltfResult.glbByteLength;
        this.gltfLoaded = true;
        this.riderGroup.add(this.riderScene);

        this.setupAnimationMixer(this.riderScene, gltfResult.animations);
        this.updatePose(0, false, false, true, 0, 0);
        this.publishTelemetry();
      })
      .catch(() => {
        // Synchronous SkinnedMesh rig remains active seamlessly if GLB async fails
      });
  }

  private setupAnimationMixer(
    root: THREE.Object3D,
    clips: THREE.AnimationClip[],
  ): void {
    this.mixer?.stopAllAction();
    this.mixer = new THREE.AnimationMixer(root);
    const pedalClip = THREE.AnimationClip.findByName(clips, 'PedalCycle');
    const jumpClip = THREE.AnimationClip.findByName(clips, 'JumpTuck');
    if (pedalClip) {
      this.pedalAction = this.mixer.clipAction(pedalClip);
      this.pedalAction.play();
    }
    if (jumpClip) {
      this.jumpAction = this.mixer.clipAction(jumpClip);
      this.jumpAction.loop = THREE.LoopOnce;
      this.jumpAction.clampWhenFinished = true;
    }
  }

  private publishTelemetry(): void {
    if (typeof document !== 'undefined' && document.body) {
      document.body.dataset.cyclistGltf = this.gltfLoaded ? 'true' : 'pending';
      document.body.dataset.cyclistBones = String(this.boneCount);
      document.body.dataset.cyclistSkinnedMeshes = String(this.skinnedMeshCount);
      document.body.dataset.cyclistGlbBytes = String(this.glbByteLength);
    }
  }

  public applyLoadout(loadout: LoadoutConfig): void {
    this.matFrame.color.set(loadout.skin.frameHex);
    this.matFrame.metalness = loadout.skin.metalness;
    this.matFrame.roughness = loadout.skin.roughness;
    this.matFrame.clearcoat = loadout.skin.clearcoat;

    this.matFork.color.set(loadout.skin.forkHex);
    this.matRim.color.set(loadout.skin.rimHex);
    this.matAccent.color.set(loadout.bicycle.accentHex);
    this.matBottle.color.set(loadout.bicycle.accentHex);

    drawJerseyCanvas(
      this.jerseyCanvas,
      loadout.outfit.jerseyHex,
      loadout.outfit.jerseyStripeHex,
    );
    this.jerseyTexture.needsUpdate = true;

    drawShortsCanvas(
      this.shortsCanvas,
      loadout.outfit.shortsHex,
      loadout.outfit.jerseyStripeHex,
    );
    this.shortsTexture.needsUpdate = true;

    this.mats.jerseyStripe.color.set(loadout.outfit.jerseyStripeHex);
    this.mats.helmet.color.set(loadout.outfit.helmetHex);
    this.mats.glove.color.set(loadout.outfit.gloveHex);
    this.mats.shoe.color.set(loadout.outfit.shoeHex);

    this.rebuildBicycleGeometry(loadout);
  }

  private rebuildBicycleGeometry(loadout: LoadoutConfig): void {
    const disposedGeos = new Set<THREE.BufferGeometry>();
    this.bikeGroup.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry && !disposedGeos.has(mesh.geometry)) {
        disposedGeos.add(mesh.geometry);
        mesh.geometry.dispose();
      }
    });
    this.bikeGroup.clear();
    this.frontWheelGroup = new THREE.Group();
    this.rearWheelGroup = new THREE.Group();
    this.frontForkGroup = new THREE.Group();
    this.crankGroup = new THREE.Group();
    this.leftPedalGroup = new THREE.Group();
    this.rightPedalGroup = new THREE.Group();
    this.saddleGroup = new THREE.Group();
    this.buildBicycle(loadout);
  }

  private createTubeBetween(
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    r1: number,
    r2: number,
    mat: THREE.Material,
  ): THREE.Mesh {
    const dir = new THREE.Vector3().subVectors(p2, p1);
    const len = dir.length();
    const geo = new THREE.CylinderGeometry(r2, r1, len, 14);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(p1).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.normalize(),
    );
    mesh.castShadow = true;
    return mesh;
  }

  private buildWheel(
    wheelRadius: number,
    tireWidth: number,
    deepAeroRim: boolean,
  ): THREE.Group {
    const wheel = new THREE.Group();
    const tireTubeRadius = tireWidth * 0.52;
    const rimRadius = wheelRadius - tireTubeRadius * 1.1;

    // Treaded rubber tire
    const tireGeo = new THREE.TorusGeometry(
      wheelRadius - tireTubeRadius,
      tireTubeRadius,
      16,
      40,
    );
    tireGeo.rotateY(Math.PI / 2);
    const tire = new THREE.Mesh(tireGeo, this.matTire);
    tire.castShadow = true;
    wheel.add(tire);

    // Sculpted rim (deep-section carbon aero or classic alloy)
    const rimTube = deepAeroRim ? tireTubeRadius * 1.4 : tireTubeRadius * 0.74;
    const rimGeo = new THREE.TorusGeometry(
      rimRadius - rimTube * 0.35,
      rimTube,
      12,
      40,
    );
    rimGeo.rotateY(Math.PI / 2);
    const rim = new THREE.Mesh(rimGeo, this.matRim);
    wheel.add(rim);

    // Accent sidewall decal stripe
    const stripeGeo = new THREE.TorusGeometry(
      rimRadius - rimTube * 0.65,
      0.0055,
      6,
      40,
    );
    stripeGeo.rotateY(Math.PI / 2);
    wheel.add(new THREE.Mesh(stripeGeo, this.matAccent));

    // Hub + Twin Flanges
    const hubGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.095, 14);
    hubGeo.rotateZ(Math.PI / 2);
    wheel.add(new THREE.Mesh(hubGeo, this.mats.chrome));

    for (const side of [-1, 1]) {
      const flange = new THREE.Mesh(
        new THREE.CylinderGeometry(0.036, 0.036, 0.006, 16),
        this.mats.chrome,
      );
      flange.rotation.z = Math.PI / 2;
      flange.position.x = side * 0.024;
      wheel.add(flange);
    }

    // Ventilated Disc Brake Rotor
    const rotorGeo = new THREE.CylinderGeometry(0.078, 0.078, 0.005, 22);
    rotorGeo.rotateZ(Math.PI / 2);
    const rotor = new THREE.Mesh(rotorGeo, this.mats.chrome);
    rotor.position.x = -0.034;
    wheel.add(rotor);

    // 16 Cross-laced spokes with rim nipples & Presta valve stem
    const spokeCount = 16;
    const spokeLen = rimRadius - rimTube * 0.5;
    const spokeGeo = new THREE.CylinderGeometry(0.0026, 0.0026, spokeLen, 5);
    const nippleGeo = new THREE.CylinderGeometry(0.0042, 0.0038, 0.012, 6);
    for (let i = 0; i < spokeCount; i++) {
      const a = (i / spokeCount) * Math.PI * 2;
      const flangeX = i % 2 === 0 ? 0.016 : -0.016;
      const spoke = new THREE.Mesh(spokeGeo, this.mats.chrome);
      spoke.position.set(
        flangeX * 0.55,
        Math.cos(a) * spokeLen * 0.5,
        Math.sin(a) * spokeLen * 0.5,
      );
      spoke.rotation.x = a;
      wheel.add(spoke);

      const nipple = new THREE.Mesh(nippleGeo, this.matAccent);
      nipple.position.set(
        0,
        Math.cos(a) * (spokeLen - 0.012),
        Math.sin(a) * (spokeLen - 0.012),
      );
      nipple.rotation.x = a;
      wheel.add(nipple);
    }

    const valve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0035, 0.0035, 0.032, 6),
      this.mats.chrome,
    );
    valve.position.set(0, rimRadius - rimTube - 0.014, 0);
    wheel.add(valve);

    return wheel;
  }

  private buildBicycle(loadout: LoadoutConfig): void {
    const r = loadout.bicycle.wheelRadius;
    this.wheelRadius = r;
    const style = loadout.bicycle.frameStyle;
    const deepAero = style === 'hyper' || style === 'track';

    const rearAxle = new THREE.Vector3(0, r, RIG_DIMENSIONS.rearAxleZ);
    const frontAxle = new THREE.Vector3(0, r, RIG_DIMENSIONS.frontAxleZ);
    const bb = new THREE.Vector3(0, RIG_DIMENSIONS.bbY, RIG_DIMENSIONS.bbZ);
    const seatCluster = new THREE.Vector3(0, 0.77, 0.22);
    const headTop = new THREE.Vector3(0, 0.80, -0.30);
    const headBottom = new THREE.Vector3(0, 0.65, -0.35);

    // Wheels
    this.rearWheelGroup = this.buildWheel(r, loadout.bicycle.tireWidth, deepAero);
    this.rearWheelGroup.position.copy(rearAxle);
    this.bikeGroup.add(this.rearWheelGroup);

    this.frontWheelGroup = this.buildWheel(r, loadout.bicycle.tireWidth, deepAero);
    this.frontWheelGroup.position.copy(frontAxle);

    // Main Diamond Frame (curved hydroformed top tube on aero/hyper, straight tapered on track/mtb)
    const tubeR = style === 'hyper' ? 0.029 : style === 'mtb' ? 0.025 : 0.021;
    this.bikeGroup.add(
      this.createTubeBetween(bb, seatCluster, tubeR, tubeR * 0.9, this.matFrame),
    );
    this.bikeGroup.add(
      this.createTubeBetween(
        bb,
        headBottom,
        tubeR * 1.18,
        tubeR * 1.06,
        this.matFrame,
      ),
    );
    if (style === 'hyper' || style === 'road') {
      const topCurve = new THREE.CatmullRomCurve3([
        seatCluster.clone(),
        seatCluster.clone().lerp(headTop, 0.5).add(new THREE.Vector3(0, 0.022, 0)),
        headTop.clone(),
      ]);
      const topTube = new THREE.Mesh(
        new THREE.TubeGeometry(topCurve, 14, tubeR * 0.9, 10, false),
        this.matFrame,
      );
      topTube.castShadow = true;
      this.bikeGroup.add(topTube);
    } else {
      this.bikeGroup.add(
        this.createTubeBetween(
          seatCluster,
          headTop,
          tubeR * 0.88,
          tubeR * 0.95,
          this.matFrame,
        ),
      );
    }
    this.bikeGroup.add(
      this.createTubeBetween(
        headBottom,
        headTop,
        tubeR * 1.18,
        tubeR * 1.18,
        this.matFrame,
      ),
    );

    // Bottom bracket shell cylinder
    const bbShell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.036, 0.072, 14),
      this.matFrame,
    );
    bbShell.rotation.z = Math.PI / 2;
    bbShell.position.copy(bb);
    this.bikeGroup.add(bbShell);

    // Rear triangle (chainstays + sculpted seatstays)
    for (const side of [-1, 1]) {
      const rAxleSide = new THREE.Vector3(side * 0.055, r, rearAxle.z);
      const bbSide = new THREE.Vector3(side * 0.036, bb.y, bb.z);
      const seatSide = new THREE.Vector3(side * 0.024, 0.74, 0.21);
      this.bikeGroup.add(
        this.createTubeBetween(bbSide, rAxleSide, 0.014, 0.011, this.matFrame),
      );
      this.bikeGroup.add(
        this.createTubeBetween(seatSide, rAxleSide, 0.011, 0.009, this.matFrame),
      );
    }

    // Seatpost, Clamp & Ergonomic Racing Saddle (ExtrudeGeometry + Chrome Rails — zero BoxGeometry!)
    const seatPostTop = new THREE.Vector3(0, 0.90, 0.26);
    this.bikeGroup.add(
      this.createTubeBetween(seatCluster, seatPostTop, 0.015, 0.014, this.mats.chrome),
    );
    const seatClamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.02, 12),
      this.matAccent,
    );
    seatClamp.position.copy(seatCluster);
    seatClamp.rotation.x = 0.25;
    this.bikeGroup.add(seatClamp);

    this.saddleGroup.position.copy(seatPostTop);
    const saddleShape = new THREE.Shape();
    saddleShape.moveTo(0, -0.14); // nose
    saddleShape.bezierCurveTo(0.022, -0.13, 0.024, -0.05, 0.048, 0.01);
    saddleShape.quadraticCurveTo(0.078, 0.06, 0.066, 0.115); // right wing
    saddleShape.quadraticCurveTo(0.02, 0.128, 0, 0.118); // rear notch
    saddleShape.quadraticCurveTo(-0.02, 0.128, -0.066, 0.115); // left wing
    saddleShape.quadraticCurveTo(-0.078, 0.06, -0.048, 0.01);
    saddleShape.bezierCurveTo(-0.024, -0.05, -0.022, -0.13, 0, -0.14);

    const saddleGeo = new THREE.ExtrudeGeometry(saddleShape, {
      depth: 0.016,
      bevelEnabled: true,
      bevelThickness: 0.007,
      bevelSize: 0.006,
      bevelSegments: 3,
      curveSegments: 14,
    });
    saddleGeo.rotateX(Math.PI / 2);
    const saddleShell = new THREE.Mesh(saddleGeo, this.mats.shorts);
    saddleShell.position.set(0, 0.022, 0.01);
    saddleShell.castShadow = true;
    this.saddleGroup.add(saddleShell);

    // Sculpted rear wing accent strip (ExtrudeGeometry arch — no BoxGeometry)
    const accentWingShape = new THREE.Shape();
    accentWingShape.moveTo(-0.046, 0.072);
    accentWingShape.quadraticCurveTo(0, 0.095, 0.046, 0.072);
    accentWingShape.quadraticCurveTo(0, 0.115, -0.046, 0.072);
    const accentWingGeo = new THREE.ExtrudeGeometry(accentWingShape, {
      depth: 0.008,
      bevelEnabled: true,
      bevelThickness: 0.002,
      bevelSize: 0.002,
      bevelSegments: 2,
    });
    accentWingGeo.rotateX(Math.PI / 2);
    const saddleAccent = new THREE.Mesh(accentWingGeo, this.matAccent);
    saddleAccent.position.set(0, 0.031, 0.01);
    this.saddleGroup.add(saddleAccent);

    // Tubular Chrome Saddle Rails
    for (const side of [-1, 1]) {
      const railCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.022, -0.01, -0.065),
        new THREE.Vector3(side * 0.022, -0.014, 0.005),
        new THREE.Vector3(side * 0.032, 0.006, 0.085),
      ]);
      this.saddleGroup.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(railCurve, 10, 0.0038, 6, false),
          this.mats.chrome,
        ),
      );
    }
    this.bikeGroup.add(this.saddleGroup);

    // Bottle Cage & Sculpted Bidon on Down Tube
    const bottleGroup = new THREE.Group();
    bottleGroup.position.set(0, 0.50, -0.11);
    bottleGroup.rotation.x = -0.68;
    const bottleBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.033, 0.031, 0.15, 14),
      this.matBottle,
    );
    bottleGroup.add(bottleBody);
    const bottleCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.033, 0.028, 12),
      this.mats.shorts,
    );
    bottleCap.position.y = 0.085;
    bottleGroup.add(bottleCap);
    const biteValve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.01, 0.018, 8),
      this.matAccent,
    );
    biteValve.position.y = 0.106;
    bottleGroup.add(biteValve);
    this.bikeGroup.add(bottleGroup);

    // Front Fork & Steering Assembly (pivoted around headTop)
    this.baseFrontForkY = headTop.y;
    this.baseFrontWheelY = frontAxle.y - headTop.y;
    this.frontForkGroup.position.copy(headTop);
    const forkOffset = new THREE.Vector3().sub(headTop);

    for (const side of [-1, 1]) {
      const topFork = new THREE.Vector3(side * 0.045, -0.15, -0.05);
      const botFork = new THREE.Vector3(
        side * 0.055,
        frontAxle.y - headTop.y,
        frontAxle.z - headTop.z,
      );
      const midFork = topFork
        .clone()
        .lerp(botFork, 0.55)
        .add(new THREE.Vector3(side * 0.004, 0, -0.012));
      const forkCurve = new THREE.CatmullRomCurve3([topFork, midFork, botFork]);
      const forkBlade = new THREE.Mesh(
        new THREE.TubeGeometry(forkCurve, 12, 0.014, 8, false),
        this.matFork,
      );
      forkBlade.castShadow = true;
      this.frontForkGroup.add(forkBlade);

      if (style === 'mtb') {
        const stanchion = this.createTubeBetween(
          topFork,
          topFork.clone().lerp(botFork, 0.52),
          0.019,
          0.019,
          this.mats.chrome,
        );
        this.frontForkGroup.add(stanchion);
      }
    }
    this.frontForkGroup.add(
      this.createTubeBetween(
        new THREE.Vector3(-0.048, -0.15, -0.05),
        new THREE.Vector3(0.048, -0.15, -0.05),
        0.018,
        0.018,
        this.matFork,
      ),
    );

    this.frontWheelGroup.position.copy(frontAxle).add(forkOffset);
    this.frontForkGroup.add(this.frontWheelGroup);

    // Stem + Handlebars
    const stemEnd = new THREE.Vector3(0, 0.09, -0.10);
    this.frontForkGroup.add(
      this.createTubeBetween(
        new THREE.Vector3(0, 0.02, 0),
        stemEnd,
        0.017,
        0.016,
        this.mats.chrome,
      ),
    );

    const barHalfW = style === 'mtb' ? 0.30 : 0.215;
    this.frontForkGroup.add(
      this.createTubeBetween(
        new THREE.Vector3(-barHalfW, stemEnd.y, stemEnd.z),
        new THREE.Vector3(barHalfW, stemEnd.y, stemEnd.z),
        0.0135,
        0.0135,
        this.matFork,
      ),
    );

    if (style === 'mtb') {
      for (const side of [-1, 1]) {
        const grip = new THREE.Mesh(
          new THREE.CylinderGeometry(0.017, 0.017, 0.12, 12),
          this.matAccent,
        );
        grip.rotation.z = Math.PI / 2;
        grip.position.set(side * (barHalfW - 0.04), stemEnd.y, stemEnd.z);
        this.frontForkGroup.add(grip);

        // Ergonomic curved MTB brake lever (TubeGeometry)
        const leverCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * (barHalfW - 0.11), stemEnd.y, stemEnd.z - 0.015),
          new THREE.Vector3(side * (barHalfW - 0.08), stemEnd.y - 0.012, stemEnd.z - 0.038),
          new THREE.Vector3(side * (barHalfW - 0.04), stemEnd.y - 0.018, stemEnd.z - 0.044),
        ]);
        this.frontForkGroup.add(
          new THREE.Mesh(
            new THREE.TubeGeometry(leverCurve, 8, 0.004, 6, false),
            this.mats.chrome,
          ),
        );
      }
      this.gripLeftLocal.set(
        -barHalfW + 0.05,
        headTop.y + stemEnd.y,
        headTop.z + stemEnd.z,
      );
      this.gripRightLocal.set(
        barHalfW - 0.05,
        headTop.y + stemEnd.y,
        headTop.z + stemEnd.z,
      );
    } else {
      // Sculpted drop bars + contoured ergonomic brake hoods + curved alloy brake levers (Zero BoxGeometry!)
      const hoodProfile = new THREE.Shape();
      hoodProfile.moveTo(0, -0.012);
      hoodProfile.quadraticCurveTo(0.025, -0.012, 0.036, 0.008);
      hoodProfile.quadraticCurveTo(0.042, 0.032, 0.028, 0.042);
      hoodProfile.quadraticCurveTo(0.012, 0.038, -0.014, 0.018);
      hoodProfile.quadraticCurveTo(-0.022, 0.002, 0, -0.012);

      const hoodGeo = new THREE.ExtrudeGeometry(hoodProfile, {
        depth: 0.022,
        bevelEnabled: true,
        bevelThickness: 0.005,
        bevelSize: 0.004,
        bevelSegments: 2,
        curveSegments: 10,
      });
      hoodGeo.center();
      hoodGeo.rotateY(Math.PI / 2);

      for (const side of [-1, 1]) {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * barHalfW, stemEnd.y, stemEnd.z),
          new THREE.Vector3(side * barHalfW, stemEnd.y - 0.01, stemEnd.z - 0.085),
          new THREE.Vector3(side * barHalfW, stemEnd.y - 0.09, stemEnd.z - 0.095),
          new THREE.Vector3(side * barHalfW, stemEnd.y - 0.12, stemEnd.z - 0.02),
        ]);
        const dropGeo = new THREE.TubeGeometry(curve, 16, 0.0135, 10, false);
        this.frontForkGroup.add(new THREE.Mesh(dropGeo, this.mats.shorts));

        const hood = new THREE.Mesh(hoodGeo, this.matAccent);
        hood.position.set(side * barHalfW, stemEnd.y + 0.014, stemEnd.z - 0.072);
        hood.castShadow = true;
        this.frontForkGroup.add(hood);

        // Curved alloy brake lever blade
        const leverCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * barHalfW, stemEnd.y + 0.004, stemEnd.z - 0.092),
          new THREE.Vector3(side * barHalfW, stemEnd.y - 0.038, stemEnd.z - 0.106),
          new THREE.Vector3(side * barHalfW, stemEnd.y - 0.078, stemEnd.z - 0.092),
        ]);
        this.frontForkGroup.add(
          new THREE.Mesh(
            new THREE.TubeGeometry(leverCurve, 8, 0.0042, 6, false),
            this.mats.chrome,
          ),
        );
      }
      this.gripLeftLocal.set(
        -barHalfW,
        headTop.y + stemEnd.y + 0.025,
        headTop.z + stemEnd.z - 0.075,
      );
      this.gripRightLocal.set(
        barHalfW,
        headTop.y + stemEnd.y + 0.025,
        headTop.z + stemEnd.z - 0.075,
      );
    }

    // LED Aero Headlight
    const lamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.019, 0.048, 12),
      this.mats.chrome,
    );
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(0, stemEnd.y - 0.022, stemEnd.z - 0.032);
    this.frontForkGroup.add(lamp);

    this.bikeGroup.add(this.frontForkGroup);

    // Drivetrain: Toothed Chainring, Tapered Crank Arms, CNC Clipless Pedals, Stepped Cassette & Derailleur
    this.crankGroup.position.copy(bb);

    // Real toothed chainring extruded from gear tooth shape
    const teeth = 28;
    const gearShape = new THREE.Shape();
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i / (teeth * 2)) * Math.PI * 2;
      const rad = i % 2 === 0 ? 0.098 : 0.088;
      if (i === 0) gearShape.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
      else gearShape.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    gearShape.closePath();
    const innerCutout = new THREE.Path();
    innerCutout.absarc(0, 0, 0.064, 0, Math.PI * 2, true);
    gearShape.holes.push(innerCutout);

    const chainringGeo = new THREE.ExtrudeGeometry(gearShape, {
      depth: 0.006,
      bevelEnabled: false,
    });
    chainringGeo.rotateY(Math.PI / 2);
    const chainring = new THREE.Mesh(chainringGeo, this.mats.chrome);
    chainring.position.x = 0.044;
    this.crankGroup.add(chainring);

    const spider = new THREE.Mesh(
      new THREE.CylinderGeometry(0.052, 0.052, 0.014, 5),
      this.matFork,
    );
    spider.rotation.z = Math.PI / 2;
    spider.position.x = 0.05;
    this.crankGroup.add(spider);

    // Sculpted tapered alloy crank arms (ExtrudeGeometry blade)
    const crankLen = RIG_DIMENSIONS.crankLen;
    const crankBladeShape = new THREE.Shape();
    crankBladeShape.moveTo(-0.018, 0.018);
    crankBladeShape.quadraticCurveTo(0, 0.024, 0.018, 0.018);
    crankBladeShape.lineTo(0.012, -crankLen - 0.006);
    crankBladeShape.quadraticCurveTo(0, -crankLen - 0.016, -0.012, -crankLen - 0.006);
    crankBladeShape.closePath();
    const crankArmGeo = new THREE.ExtrudeGeometry(crankBladeShape, {
      depth: 0.012,
      bevelEnabled: true,
      bevelThickness: 0.0025,
      bevelSize: 0.0025,
      bevelSegments: 2,
    });

    const leftArm = new THREE.Mesh(crankArmGeo, this.mats.chrome);
    leftArm.rotation.y = Math.PI / 2;
    leftArm.position.set(-0.072, 0, 0);
    leftArm.castShadow = true;

    const rightArm = new THREE.Mesh(crankArmGeo, this.mats.chrome);
    rightArm.rotation.y = Math.PI / 2;
    rightArm.rotation.z = Math.PI;
    rightArm.position.set(0.06, 0, 0);
    rightArm.castShadow = true;
    this.crankGroup.add(leftArm, rightArm);

    // CNC Clipless Pedals (ExtrudeGeometry chamfered wing — Zero BoxGeometry!)
    const pedalShape = new THREE.Shape();
    pedalShape.moveTo(-0.034, 0.042);
    pedalShape.lineTo(0.034, 0.042);
    pedalShape.lineTo(0.042, 0.0);
    pedalShape.lineTo(0.026, -0.045);
    pedalShape.lineTo(-0.026, -0.045);
    pedalShape.lineTo(-0.042, 0.0);
    pedalShape.closePath();
    const pedalBodyGeo = new THREE.ExtrudeGeometry(pedalShape, {
      depth: 0.012,
      bevelEnabled: true,
      bevelThickness: 0.003,
      bevelSize: 0.003,
      bevelSegments: 2,
    });
    pedalBodyGeo.rotateX(Math.PI / 2);

    const buildPedal = (side: -1 | 1) => {
      const p = new THREE.Group();
      const spindle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.006, 0.006, 0.056, 8),
        this.mats.chrome,
      );
      spindle.rotation.z = Math.PI / 2;
      spindle.position.x = -side * 0.02;
      p.add(spindle);

      const body = new THREE.Mesh(pedalBodyGeo, this.matFork);
      body.position.y = 0.006;
      body.castShadow = true;
      p.add(body);
      return p;
    };

    this.leftPedalGroup = buildPedal(-1);
    this.leftPedalGroup.position.set(-0.115, -crankLen, 0);
    this.rightPedalGroup = buildPedal(1);
    this.rightPedalGroup.position.set(0.115, crankLen, 0);
    this.crankGroup.add(this.leftPedalGroup, this.rightPedalGroup);
    this.bikeGroup.add(this.crankGroup);

    // Stepped 5-Cog Rear Cassette + Rear Derailleur + Pulleys + Chain Spans
    const cogRadii = [0.052, 0.044, 0.037, 0.031, 0.025];
    for (let i = 0; i < cogRadii.length; i++) {
      const cog = new THREE.Mesh(
        new THREE.CylinderGeometry(cogRadii[i], cogRadii[i], 0.0035, 18),
        this.mats.chrome,
      );
      cog.rotation.z = Math.PI / 2;
      cog.position.set(0.036 + i * 0.0055, rearAxle.y, rearAxle.z);
      this.bikeGroup.add(cog);
    }

    // Rear Derailleur cage + 2 jockey pulleys
    const derailleurPivot = new THREE.Vector3(0.048, rearAxle.y - 0.068, rearAxle.z + 0.015);
    const upperPulley = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.008, 12),
      this.matAccent,
    );
    upperPulley.rotation.z = Math.PI / 2;
    upperPulley.position.copy(derailleurPivot);
    const lowerPulley = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.008, 12),
      this.matAccent,
    );
    lowerPulley.rotation.z = Math.PI / 2;
    lowerPulley.position.set(0.048, rearAxle.y - 0.125, rearAxle.z + 0.032);
    const cage = this.createTubeBetween(
      upperPulley.position,
      lowerPulley.position,
      0.007,
      0.006,
      this.matFork,
    );
    this.bikeGroup.add(upperPulley, lowerPulley, cage);

    // Upper & lower chain spans
    this.bikeGroup.add(
      this.createTubeBetween(
        new THREE.Vector3(0.048, bb.y + 0.09, bb.z),
        new THREE.Vector3(0.046, rearAxle.y + 0.042, rearAxle.z),
        0.0052,
        0.0052,
        this.mats.chrome,
      ),
    );
    this.bikeGroup.add(
      this.createTubeBetween(
        new THREE.Vector3(0.048, bb.y - 0.09, bb.z),
        lowerPulley.position,
        0.0052,
        0.0052,
        this.mats.chrome,
      ),
    );
  }

  /**
   * Aims a downward-oriented bone (-Y local axis) from `bone` world pos toward `targetWorld`
   * while maintaining anatomical forward twist along `-Z` in `riderGroup` space.
   */
  private aimBoneBetweenWorld(
    bone: THREE.Bone | undefined,
    parentBone: THREE.Bone | undefined,
    fromWorld: THREE.Vector3,
    toWorld: THREE.Vector3,
    leanGroupInvWorld: THREE.Matrix4,
  ): void {
    if (!bone || !parentBone) return;
    this._dir.subVectors(toWorld, fromWorld);
    const len = this._dir.length();
    if (len < 0.0001) return;
    this._dir.divideScalar(len);

    // Bone local +Y points opposite to downward vector (-dir)
    this._yAxis.copy(this._dir).negate();
    // Transform desired world +Z backward reference into leanGroup space -> actually both fromWorld/toWorld are in leanGroup local space!
    this._xAxis.crossVectors(this._yAxis, this._fwdRef);
    if (this._xAxis.lengthSq() < 0.0001) {
      this._xAxis.set(1, 0, 0);
    } else {
      this._xAxis.normalize();
    }
    this._zAxis.crossVectors(this._xAxis, this._yAxis).normalize();

    this._mat4.makeBasis(this._xAxis, this._yAxis, this._zAxis);
    this._qDesiredWorld.setFromRotationMatrix(this._mat4);

    // Compute parentBone rotation inside leanGroup space
    this._mat4.multiplyMatrices(leanGroupInvWorld, parentBone.matrixWorld);
    this._qParentWorld.setFromRotationMatrix(this._mat4);
    this._qLocal.copy(this._qParentWorld).invert().multiply(this._qDesiredWorld);
    bone.quaternion.copy(this._qLocal);
    bone.updateMatrixWorld(true);
  }

  private updatePose(
    _torsoCrouchExtra: number,
    isStandingSprint: boolean,
    isJumping: boolean,
    grounded = true,
    verticalVelocity = 0,
    landSquash = 0,
    balancePitch = 0,
    trickPose: 'none' | 'superman' | 'no_hands' | 'tabletop' = 'none',
    suspensionCompression = 0,
    isManual = false,
  ): void {
    const pelvis = this.bones.Pelvis;
    const spine = this.bones.Spine;
    const chest = this.bones.Chest;
    const neck = this.bones.Neck;
    const head = this.bones.Head;
    if (!pelvis || !spine || !chest) return;

    const posture = computeRiderPosture({
      crankAngle: this.crankAngle,
      grounded,
      verticalVelocity,
      landSquash,
      suspensionCompression,
      isSprinting: isStandingSprint,
      isBoosting: _torsoCrouchExtra > 0.12,
      isManual,
      balancePitch,
      trickPose,
    });

    pelvis.position.set(0, posture.pelvisY, posture.pelvisZ);
    pelvis.rotation.set(0, 0, posture.pelvisRollZ);

    spine.rotation.set(posture.spinePitchX, 0, -posture.pelvisRollZ * 0.4);
    chest.rotation.set(posture.chestPitchX, 0, -posture.pelvisRollZ * 0.3);
    if (neck) neck.rotation.set(posture.headPitchX * 0.35, 0, 0);
    if (head) head.rotation.set(posture.headPitchX * 0.65, 0, 0);

    // Jump tuck knees slightly upward when airborne
    const jumpKneeLift = isJumping ? 0.06 : 0;

    this.leanGroup.updateMatrixWorld(true);
    const leanInv = this._mat4.copy(this.leanGroup.matrixWorld).invert().clone();

    // 1. Solve Leg IK on Skeletal Bones -> Cycling Shoes locked onto Pedals (or extended back in Superman!)
    const pedals = computePedalTargets(this.crankAngle);
    const leftPedalY =
      trickPose === 'superman' ? 1.12 : pedals.leftY + jumpKneeLift;
    const rightPedalY =
      trickPose === 'superman' ? 1.14 : pedals.rightY + jumpKneeLift;
    const leftPedalZ = trickPose === 'superman' ? 1.25 : pedals.leftZ;
    const rightPedalZ = trickPose === 'superman' ? 1.22 : pedals.rightZ;

    const solveLeg = (
      side: -1 | 1,
      hipBone: THREE.Bone | undefined,
      kneeBone: THREE.Bone | undefined,
      ankleBone: THREE.Bone | undefined,
      pedalY: number,
      pedalZ: number,
      footPitch: number,
    ) => {
      if (!hipBone || !kneeBone || !ankleBone) return;
      hipBone.getWorldPosition(this._hipWorld);
      this.leanGroup.worldToLocal(this._hipWorld);

      const ik = solveTwoBoneIK2D(
        this._hipWorld.y,
        this._hipWorld.z,
        pedalY + 0.038,
        pedalZ,
        RIG_DIMENSIONS.thighLen,
        RIG_DIMENSIONS.shinLen,
        true,
      );
      this._kneeTarget.set(side * RIG_DIMENSIONS.kneeHalfW, ik.midY, ik.midZ);
      this._ankleTarget.set(side * RIG_DIMENSIONS.ankleHalfW, pedalY + 0.038, pedalZ);

      this.aimBoneBetweenWorld(hipBone, pelvis, this._hipWorld, this._kneeTarget, leanInv);
      this.aimBoneBetweenWorld(kneeBone, hipBone, this._kneeTarget, this._ankleTarget, leanInv);

      // Keep shoe pitched naturally onto pedal surface
      this._euler.set(footPitch, 0, 0);
      this._qDesiredWorld.setFromEuler(this._euler);
      const kneeMatInLean = new THREE.Matrix4().multiplyMatrices(leanInv, kneeBone.matrixWorld);
      this._qParentWorld.setFromRotationMatrix(kneeMatInLean);
      ankleBone.quaternion.copy(this._qParentWorld).invert().multiply(this._qDesiredWorld);
      ankleBone.updateMatrixWorld(true);
    };

    solveLeg(
      -1,
      this.bones.LeftHip,
      this.bones.LeftKnee,
      this.bones.LeftAnkle,
      leftPedalY,
      leftPedalZ,
      trickPose === 'superman' ? -0.55 : pedals.leftFootPitch,
    );
    solveLeg(
      1,
      this.bones.RightHip,
      this.bones.RightKnee,
      this.bones.RightAnkle,
      rightPedalY,
      rightPedalZ,
      trickPose === 'superman' ? -0.55 : pedals.rightFootPitch,
    );

    // 2. Solve Arm IK on Skeletal Bones -> Gloved Hands locked onto Steered Handlebars (or spread out in No-Hands!)
    const steerAngle = this.frontForkGroup.rotation.y;
    const steerCos = Math.cos(steerAngle);
    const steerSin = Math.sin(steerAngle);
    const pivotZ = -0.30;

    if (trickPose === 'no_hands') {
      this._gripL.set(-0.56, 1.38, 0.02);
      this._gripR.set(0.56, 1.38, 0.02);
    } else {
      const relLX = this.gripLeftLocal.x;
      const relLZ = this.gripLeftLocal.z - pivotZ;
      this._gripL.set(
        relLX * steerCos + relLZ * steerSin,
        this.gripLeftLocal.y,
        pivotZ + (-relLX * steerSin + relLZ * steerCos),
      );
      const relRX = this.gripRightLocal.x;
      const relRZ = this.gripRightLocal.z - pivotZ;
      this._gripR.set(
        relRX * steerCos + relRZ * steerSin,
        this.gripRightLocal.y,
        pivotZ + (-relRX * steerSin + relRZ * steerCos),
      );
    }

    const solveArm = (
      side: -1 | 1,
      shBone: THREE.Bone | undefined,
      elBone: THREE.Bone | undefined,
      wrBone: THREE.Bone | undefined,
      gripTarget: THREE.Vector3,
    ) => {
      if (!shBone || !elBone || !wrBone) return;
      shBone.getWorldPosition(this._shoulderWorld);
      this.leanGroup.worldToLocal(this._shoulderWorld);

      const ik = solveTwoBoneIK2D(
        this._shoulderWorld.y,
        this._shoulderWorld.z,
        gripTarget.y,
        gripTarget.z,
        RIG_DIMENSIONS.upperArmLen,
        RIG_DIMENSIONS.forearmLen,
        false,
      );
      const elbowX = (this._shoulderWorld.x + gripTarget.x) * 0.52;
      this._elbowTarget.set(elbowX, ik.midY, ik.midZ);

      this.aimBoneBetweenWorld(shBone, chest, this._shoulderWorld, this._elbowTarget, leanInv);
      this.aimBoneBetweenWorld(elBone, shBone, this._elbowTarget, gripTarget, leanInv);

      this._euler.set(0.28, steerAngle, -side * 0.14);
      this._qDesiredWorld.setFromEuler(this._euler);
      const elMatInLean = new THREE.Matrix4().multiplyMatrices(leanInv, elBone.matrixWorld);
      this._qParentWorld.setFromRotationMatrix(elMatInLean);
      wrBone.quaternion.copy(this._qParentWorld).invert().multiply(this._qDesiredWorld);
      wrBone.updateMatrixWorld(true);
    };

    solveArm(
      -1,
      this.bones.LeftShoulder,
      this.bones.LeftElbow,
      this.bones.LeftWrist,
      this._gripL,
    );
    solveArm(
      1,
      this.bones.RightShoulder,
      this.bones.RightElbow,
      this.bones.RightWrist,
      this._gripR,
    );
  }

  public update(dt: number, params: CyclistAnimParams): void {
    if (params.isCrashed) {
      const t = Math.min(1, params.crashElapsed / 0.45);
      this.leanGroup.rotation.z = THREE.MathUtils.lerp(
        this.leanGroup.rotation.z,
        1.32,
        t,
      );
      this.leanGroup.rotation.x = THREE.MathUtils.lerp(
        this.leanGroup.rotation.x,
        -0.25,
        t,
      );
      this.leanGroup.position.y = THREE.MathUtils.lerp(0, 0.16, t);
      this.shieldBubble.visible = false;
      this.powerAuraRing.visible = false;
      return;
    }

    // Advance GLTF AnimationMixer gently for organic micro-motion
    if (this.mixer) {
      this.mixer.update(dt * (params.grounded ? 1.0 : 0.4));
    }

    // Wheel rotation matched 1:1 to ground distance traveled
    this.wheelAngle -= params.distanceDelta / this.wheelRadius;
    this.frontWheelGroup.rotation.x = this.wheelAngle;
    this.rearWheelGroup.rotation.x = this.wheelAngle;

    // Pedalling cadence (pauses naturally during manuals, stoppies, or airborne coasting)
    const isCoastingStunt = Boolean(params.isManual || params.isStoppie);
    const cadenceRadPerSec = !params.grounded
      ? 0.9
      : isCoastingStunt
        ? 0
        : 2.8 + (params.speedMps / 18) * 9.5;
    this.crankAngle -= cadenceRadPerSec * dt;
    this.crankGroup.rotation.x = this.crankAngle;
    this.leftPedalGroup.rotation.x = -this.crankAngle;
    this.rightPedalGroup.rotation.x = -this.crankAngle;

    const trick = params.trickPose ?? 'none';
    const bal = params.balancePitch ?? 0;
    const susp = params.suspensionCompression ?? 0;

    // Bike & rider lean while carving lanes + fork steer + aerial 360 yaw & tabletop roll
    this.leanGroup.rotation.z =
      params.leanAngle + (trick === 'tabletop' ? 0.52 : 0);
    this.leanGroup.rotation.y = params.bikeYawY ?? 0;
    this.frontForkGroup.rotation.y = params.steerAngle;
    this.frontForkGroup.position.y = this.baseFrontForkY;
    // Physical front fork suspension compression: frame drops down while lower fork legs + wheel telescope upward to stay planted
    const wheelSuspLift = THREE.MathUtils.clamp(susp * 0.34, -0.015, 0.055);
    this.frontWheelGroup.position.y = this.baseFrontWheelY + wheelSuspLift;
    this.rearWheelGroup.position.y = this.wheelRadius + wheelSuspLift * 0.35;

    // Pitch bike: Adventure supplies exact terrain+balance+flip pitch; Endless derives from vertical velocity
    const totalPitch =
      params.bikePitchX !== undefined
        ? params.bikePitchX + bal
        : (!params.grounded
            ? THREE.MathUtils.clamp(params.verticalVelocity * 0.032, -0.26, 0.3)
            : 0) -
          params.landSquash * 0.04;

    this.leanGroup.rotation.x = totalPitch;

    // Contact-patch axle lift compensation during wheelies (+bal) & stoppies (-bal)
    // scaled by terrain slope cosine so the grounded tire stays cleanly planted without sinking!
    let axleLiftY = 0;
    if (params.grounded && Math.abs(bal) > 0.02) {
      const slopeCos = Math.cos(params.bikePitchX ?? 0);
      axleLiftY = Math.sin(Math.abs(bal)) * RIG_DIMENSIONS.rearAxleZ * slopeCos;
    }

    const suspDrop = THREE.MathUtils.clamp(susp * 0.36, -0.02, 0.055);
    this.leanGroup.position.y = -params.landSquash * 0.04 - suspDrop + axleLiftY;
    this.leanGroup.scale.set(
      1 + params.landSquash * 0.045,
      1 - params.landSquash * 0.06,
      1 + params.landSquash * 0.03,
    );

    const crouchExtra = params.isBoosting
      ? 0.16
      : params.isSprinting
        ? 0.09
        : 0;
    this.updatePose(
      crouchExtra,
      params.isSprinting || params.isBoosting,
      !params.grounded,
      params.grounded,
      params.verticalVelocity,
      params.landSquash,
      bal,
      trick,
      susp,
      Boolean(params.isManual),
    );

    this.shieldBubble.visible = params.shieldActive;
    if (params.shieldActive) {
      const mat = this.shieldBubble.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.18 + Math.sin(params.elapsed * 5.5) * 0.05;
      this.shieldBubble.rotation.y = params.elapsed * 0.9;
    }

    if (params.powerAuraColor) {
      this.powerAuraRing.visible = true;
      const auraMat = this.powerAuraRing.material as THREE.MeshBasicMaterial;
      auraMat.color.set(params.powerAuraColor);
      auraMat.opacity = 0.52 + Math.sin(params.elapsed * 7.5) * 0.22;
      const pulse = 0.96 + Math.sin(params.elapsed * 7.5) * 0.08;
      this.powerAuraRing.scale.set(pulse, 1, pulse);
      this.powerAuraRing.rotation.y = params.elapsed * 2.4;
    } else {
      this.powerAuraRing.visible = false;
    }
  }

  public resetPose(): void {
    this.leanGroup.rotation.set(0, 0, 0);
    this.leanGroup.position.set(0, 0, 0);
    this.leanGroup.scale.set(1, 1, 1);
    this.frontForkGroup.rotation.set(0, 0, 0);
    this.frontForkGroup.position.y = this.baseFrontForkY;
    this.frontWheelGroup.position.y = this.baseFrontWheelY;
    this.rearWheelGroup.position.y = this.wheelRadius;
    this.powerAuraRing.visible = false;
    this.shieldBubble.visible = false;
    this.updatePose(0, false, false, true, 0, 0, 0, 'none', 0, false);
  }

  public dispose(): void {
    this.disposed = true;
    this.mixer?.stopAllAction();
    this.jerseyTexture.dispose();
    this.shortsTexture.dispose();
    this.tireMap.dispose();
    this.tireBumpMap.dispose();

    const disposedGeos = new Set<THREE.BufferGeometry>();
    this.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry && !disposedGeos.has(mesh.geometry)) {
        disposedGeos.add(mesh.geometry);
        mesh.geometry.dispose();
      }
    });

    this.matFrame.dispose();
    this.matFork.dispose();
    this.matRim.dispose();
    this.matTire.dispose();
    this.matAccent.dispose();
    this.matBottle.dispose();
    (this.shieldBubble.material as THREE.Material).dispose();
    (this.powerAuraRing.material as THREE.Material).dispose();
    Object.values(this.mats).forEach((m) => m.dispose());
  }
}
