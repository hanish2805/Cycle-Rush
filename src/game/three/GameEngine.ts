import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  computeLevelStars,
  getAdventureAreaSpec,
  getAdventureLevelDef,
  getAdventureTutorialHint,
} from '../adventureCatalog';
import {
  buildAdventureCourse,
  computeObjectiveProgress,
  createInitialAdventureState,
  getTrailCenterX,
  restoreAdventureCheckpoint,
  sampleAdventureTerrain,
  stepAdventurePhysics,
  type AdventureCourse,
  type AdventureInputState,
  type AdventureSimState,
} from '../adventurePhysics';
import { SoundEngine } from '../audio';
import {
  MISSIONS,
  POWERUP_META,
  getEnvironmentSpec,
} from '../catalog';
import {
  GRAVITY_MPS2,
  LANE_CENTERS,
  ROAD_HALF_CLAMP,
  SEGMENT_LENGTH,
  TIME_CHALLENGE_DURATION,
  checkCollisionAABB,
  checkNearMiss,
  computeCoinScore,
  computeDistanceScoreDelta,
  computeDodgeScore,
  computeNearMissScore,
  computeTargetSpeedMps,
  generateSegmentPlan,
  getDifficultyStage,
  getJumpVelocity,
  getScoreMultiplier,
  mpsToKmh,
} from '../engineLogic';
import type {
  ActivePowerUpState,
  AdventureAreaId,
  AdventureCameraMode,
  AdventureHudState,
  AdventureRunSnapshot,
  EnvironmentSpec,
  GameMode,
  GameSettings,
  GameState,
  HudBanner,
  HudState,
  LoadoutConfig,
  ObstacleType,
  PowerUpType,
  RunSnapshot,
} from '../types';
import {
  buildAdventureWorldVisuals,
  type AdventureWorldVisuals,
} from './adventureWorld';
import { CyclistRig } from './cyclistModel';
import { EnvironmentBuilder, type RoadSegmentObj } from './environmentBuilder';
import { AssetFactory } from './obstaclesAndPickups';
import { createContactShadowTexture } from './textures';

interface ActiveObstacle {
  id: number;
  type: ObstacleType;
  mesh: THREE.Group;
  x: number;
  baseX: number;
  z: number;
  movePhase: number;
  moveAmplitude: number;
  passed: boolean;
  nearMissed: boolean;
  hit: boolean;
}

interface ActiveCoin {
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  collected: boolean;
  phase: number;
}

interface ActivePowerUp {
  type: PowerUpType;
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  collected: boolean;
  phase: number;
}

interface ParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
}

export interface EngineCallbacks {
  onHudUpdate: (hud: HudState) => void;
  onGameOver: (snapshot: RunSnapshot) => void;
  onPauseRequested: () => void;
  onAdventureHudUpdate?: (hud: AdventureHudState) => void;
  onAdventureFinished?: (snapshot: AdventureRunSnapshot) => void;
}

const SEGMENT_COUNT = 14;
const PARTICLE_POOL_SIZE = 160;
const ADV_CAMERA_MODES: AdventureCameraMode[] = [
  'chase',
  'downhill',
  'stunt',
  'jump',
  'landing',
];

export class GameEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private sound: SoundEngine;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private isSoftwareGl = false;

  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private rimLight!: THREE.DirectionalLight;
  private skyMesh!: THREE.Mesh;
  private skyMat!: THREE.ShaderMaterial;

  private cyclist!: CyclistRig;
  private cyclistShadow!: THREE.Mesh;
  private shadowTex!: THREE.CanvasTexture;
  private envBuilder!: EnvironmentBuilder;
  private assetFactory!: AssetFactory;

  private segments: RoadSegmentObj[] = [];
  private endlessGroup = new THREE.Group();
  private obstacles: ActiveObstacle[] = [];
  private coins: ActiveCoin[] = [];
  private powerUps: ActivePowerUp[] = [];
  private obstaclePool = new Map<ObstacleType, THREE.Group[]>();
  private coinPool: THREE.Group[] = [];
  private powerUpPool = new Map<PowerUpType, THREE.Group[]>();

  // Adventure Mode simulation & 3D world state
  private experienceMode: 'endless' | 'adventure_preview' | 'adventure' = 'endless';
  private adventureCourse: AdventureCourse | null = null;
  private adventureWorld: AdventureWorldVisuals | null = null;
  private adventureSim: AdventureSimState | null = null;
  private adventureBestLevelScore = 0;
  private adventureCameraMode: AdventureCameraMode = 'chase';
  private adventureAlertText: string | null = null;
  private adventureAlertTone: 'gold' | 'cyan' | 'emerald' | 'amber' | 'rose' = 'amber';
  private adventureAlertTimer = 0;
  private adventureJumpQueued = false;
  private adventureTrickQueued = false;
  private adventureTouchInput: Partial<AdventureInputState> = {};
  private adventurePreviewD = 25;

  // Particle ring buffer
  private particleMesh!: THREE.InstancedMesh;
  private particles: ParticleSlot[] = [];
  private particleCursor = 0;

  // Scratch math objects (zero GC in loop)
  private readonly _mat4 = new THREE.Matrix4();
  private readonly _vec3 = new THREE.Vector3();
  private readonly _quat = new THREE.Quaternion();
  private readonly _scaleVec = new THREE.Vector3();
  private readonly _camTarget = new THREE.Vector3();
  private readonly _camPos = new THREE.Vector3();

  // Config state
  private currentEnv: EnvironmentSpec;
  private currentLoadout: LoadoutConfig;
  private settings: GameSettings;
  private savedBestScore = 0;
  private activeMissionId = MISSIONS[0].id;
  private baseMissionProgress = 0;

  // Simulation state
  private gameState: GameState = 'title';
  private mode: GameMode = 'endless';
  private elapsed = 0;
  private worldObstacleElapsed = 0;
  private runElapsed = 0;
  private wasBraking = false;
  private distanceMeters = 0;
  private speedMps = 10;
  private topSpeedKmh = 36;
  private playerX = 0;
  private playerY = 0;
  private playerZ = 0;
  private playerVx = 0;
  private playerVy = 0;
  private grounded = true;
  private landSquash = 0;
  private swipeTargetX: number | null = null;
  private jumpBufferTimer = 0;

  private score = 0;
  private coinsRun = 0;
  private dodgedCount = 0;
  private nearMissCount = 0;
  private jumpCount = 0;
  private dodgeStreak = 0;
  private coinStreak = 0;
  private difficultyStage = 1;
  private nextSegmentIndex = 0;
  private nextObstacleId = 1;
  private newRecordAnnounced = false;

  private powerTimers = new Map<PowerUpType, number>();
  private shieldCharges = 0;
  private invulnTimer = 0;
  private crashTimer = 0;
  private isCrashing = false;
  private cameraTrauma = 0;
  private currentFov = 60;
  private hitstopTimer = 0;
  private trailAccum = 0;

  private bannerId = 1;
  private activeBanner: HudBanner | null = null;
  private bannerTimer = 0;

  // Input state
  private keys = new Set<string>();
  private touchThrottle = 0;

  // Loop state
  private frameId = 0;
  private lastTimeMs = 0;
  private hudEmitAccum = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor(
    container: HTMLElement,
    initialEnv: EnvironmentSpec,
    initialLoadout: LoadoutConfig,
    initialSettings: GameSettings,
    savedBestScore: number,
    activeMissionId: string,
    baseMissionProgress: number,
    callbacks: EngineCallbacks,
    sound: SoundEngine,
  ) {
    this.container = container;
    this.currentEnv = initialEnv;
    this.currentLoadout = initialLoadout;
    this.settings = { ...initialSettings };
    this.savedBestScore = savedBestScore;
    this.activeMissionId = activeMissionId;
    this.baseMissionProgress = baseMissionProgress;
    this.callbacks = callbacks;
    this.sound = sound;

    this.initRendererAndScene();
    this.initWorldPools();
    this.bindInputs();
    this.handleResize();

    this.lastTimeMs = performance.now();
    this.scheduleNextTick();
  }

  private detectSoftwareGl(): boolean {
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param) || '');
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return false;
    }
  }

  private initRendererAndScene(): void {
    this.isSoftwareGl = this.detectSoftwareGl();
    const width = Math.max(1, this.container.clientWidth || window.innerWidth);
    const height = Math.max(1, this.container.clientHeight || window.innerHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.currentEnv.fogHex);
    this.scene.fog = new THREE.FogExp2(
      this.currentEnv.fogHex,
      this.currentEnv.fogDensity,
    );

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.2, 420);
    this.camera.position.set(2.75, 1.55, -3.6);
    this.camera.lookAt(-1.35, 0.92, -0.15);

    // Atmospheric sky dome (Sun/Moon disc, procedural cloud strata, night stars)
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(this.currentEnv.skyTopHex) },
        horizonColor: { value: new THREE.Color(this.currentEnv.skyHorizonHex) },
        sunColor: { value: new THREE.Color(this.currentEnv.sunColorHex) },
        sunDir: { value: new THREE.Vector3(0.32, 0.34, -0.88).normalize() },
        isNight: { value: this.currentEnv.isNight ? 1.0 : 0.0 },
        uTime: { value: 0.0 },
      },
      vertexShader: `
        varying vec3 vLocalDir;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vLocalDir = normalize(position);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 sunColor;
        uniform vec3 sunDir;
        uniform float isNight;
        uniform float uTime;
        varying vec3 vLocalDir;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float noise2(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash21(i);
          float b = hash21(i + vec2(1.0, 0.0));
          float c = hash21(i + vec2(0.0, 1.0));
          float d = hash21(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 3; i++) {
            v += a * noise2(p);
            p *= 2.07;
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 dir = normalize(vLocalDir);
          float h = clamp(dir.y * 1.45, 0.0, 1.0);
          vec3 sky = mix(horizonColor, topColor, pow(h, 0.75));

          // Sun / Moon disc & warm/cool halo
          float sunDot = max(dot(dir, normalize(sunDir)), 0.0);
          float disc = smoothstep(0.9965, 0.9988, sunDot);
          float halo = pow(sunDot, 10.0) * 0.45;
          sky += sunColor * (disc * (isNight > 0.5 ? 0.85 : 1.35) + halo * (isNight > 0.5 ? 0.35 : 0.75));

          if (dir.y > 0.02) {
            vec2 cloudUv = dir.xz / (dir.y + 0.18) * 1.35 + vec2(uTime * 0.012, uTime * 0.006);
            float c = fbm(cloudUv);
            if (isNight > 0.5) {
              // Twinkling stars in high sky + faint dark-lit cloud wisps
              vec2 starGrid = floor(dir.xz / (dir.y + 0.25) * 42.0);
              float starRnd = hash21(starGrid);
              float starMask = step(0.986, starRnd) * smoothstep(0.15, 0.5, dir.y);
              sky += vec3(0.85, 0.94, 1.0) * starMask * (0.65 + 0.35 * sin(uTime * 2.2 + starRnd * 20.0));
              sky = mix(sky, horizonColor * 0.65, smoothstep(0.55, 0.88, c) * smoothstep(0.02, 0.25, dir.y) * 0.22);
            } else {
              float cloudAlpha = smoothstep(0.50, 0.82, c) * smoothstep(0.02, 0.22, dir.y) * 0.58;
              vec3 cloudTint = mix(vec3(1.0, 0.98, 0.95), sunColor, 0.22);
              sky = mix(sky, cloudTint, cloudAlpha);
            }
          }

          gl_FragColor = vec4(sky, 1.0);
        }
      `,
    });
    this.skyMesh = new THREE.Mesh(new THREE.SphereGeometry(260, 20, 14), this.skyMat);
    this.scene.add(this.skyMesh);

    // Warm/cool 3-point outdoor lighting
    this.hemiLight = new THREE.HemisphereLight(
      this.currentEnv.hemiSkyHex,
      this.currentEnv.hemiGroundHex,
      this.currentEnv.hemiIntensity,
    );
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(
      this.currentEnv.sunColorHex,
      this.currentEnv.sunIntensity,
    );
    this.sunLight.position.set(16, 26, 12);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 75;
    const d = 16;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.rimLight = new THREE.DirectionalLight('#bae6fd', 0.65);
    this.rimLight.position.set(-10, 8, -18);
    this.scene.add(this.rimLight);

    this.scene.add(this.endlessGroup);

    // Cyclist & Bicycle
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.shadowTex = createContactShadowTexture();
    this.envBuilder = new EnvironmentBuilder(this.currentEnv, maxAniso);
    this.assetFactory = new AssetFactory(this.shadowTex, maxAniso);

    this.cyclist = new CyclistRig(this.currentLoadout);
    this.scene.add(this.cyclist.root);

    const cShadowGeo = new THREE.PlaneGeometry(1.15, 1.9);
    cShadowGeo.rotateX(-Math.PI / 2);
    const cShadowMat = new THREE.MeshBasicMaterial({
      map: this.shadowTex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.cyclistShadow = new THREE.Mesh(cShadowGeo, cShadowMat);
    this.cyclistShadow.position.y = 0.015;
    this.scene.add(this.cyclistShadow);

    // Pooled InstancedMesh particles
    const pGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    const pMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
    });
    this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, PARTICLE_POOL_SIZE);
    this.particleMesh.frustumCulled = false;
    this.particleMesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(PARTICLE_POOL_SIZE * 3),
      3,
    );
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -100,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        size: 0,
        color: new THREE.Color('#ffffff'),
      });
      this._mat4.makeScale(0, 0, 0);
      this.particleMesh.setMatrixAt(i, this._mat4);
      this.particleMesh.setColorAt(i, this.particles[i].color);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    this.particleMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.particleMesh);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private initWorldPools(): void {
    this.resetWorldTrack();
  }

  private clearActiveEntities(): void {
    for (const o of this.obstacles) {
      o.mesh.visible = true;
      this.endlessGroup.remove(o.mesh);
      const arr = this.obstaclePool.get(o.type) ?? [];
      arr.push(o.mesh);
      this.obstaclePool.set(o.type, arr);
    }
    this.obstacles = [];

    for (const c of this.coins) {
      c.mesh.visible = true;
      this.endlessGroup.remove(c.mesh);
      this.coinPool.push(c.mesh);
    }
    this.coins = [];

    for (const p of this.powerUps) {
      p.mesh.visible = true;
      this.endlessGroup.remove(p.mesh);
      const arr = this.powerUpPool.get(p.type) ?? [];
      arr.push(p.mesh);
      this.powerUpPool.set(p.type, arr);
    }
    this.powerUps = [];
  }

  private borrowObstacleMesh(type: ObstacleType, seed: number): THREE.Group {
    const arr = this.obstaclePool.get(type);
    if (arr && arr.length > 0) {
      const m = arr.pop()!;
      m.visible = true;
      return m;
    }
    return this.assetFactory.createObstacleMesh(type, seed);
  }

  private borrowCoinMesh(): THREE.Group {
    if (this.coinPool.length > 0) {
      const m = this.coinPool.pop()!;
      m.visible = true;
      return m;
    }
    return this.assetFactory.createCoinMesh();
  }

  private borrowPowerUpMesh(type: PowerUpType): THREE.Group {
    const arr = this.powerUpPool.get(type);
    if (arr && arr.length > 0) {
      const m = arr.pop()!;
      m.visible = true;
      return m;
    }
    return this.assetFactory.createPowerUpMesh(type);
  }

  private resetWorldTrack(): void {
    this.clearActiveEntities();
    for (const seg of this.segments) {
      this.endlessGroup.remove(seg.group);
    }
    this.segments = [];
    this.nextSegmentIndex = 0;

    for (let i = -1; i < SEGMENT_COUNT - 1; i++) {
      const seg = this.envBuilder.createRoadSegment(i);
      this.endlessGroup.add(seg.group);
      this.segments.push(seg);
      this.populateSegmentEntities(seg, i);
      this.nextSegmentIndex = i + 1;
    }
  }

  private populateSegmentEntities(seg: RoadSegmentObj, segIdx: number): void {
    const stage = getDifficultyStage(segIdx * SEGMENT_LENGTH);
    const plan = generateSegmentPlan(segIdx, stage);
    this.envBuilder.setSegmentVariant(seg, plan.variant, segIdx);

    // Spawn obstacles only in active play or distant showcase segments
    for (const ob of plan.obstacles) {
      const mesh = this.borrowObstacleMesh(ob.type, (segIdx * 13 + ob.laneIndex) / 7);
      const worldZ = seg.zStart - ob.zOffset;
      mesh.position.set(ob.x, 0, worldZ);
      this.endlessGroup.add(mesh);
      this.obstacles.push({
        id: this.nextObstacleId++,
        type: ob.type,
        mesh,
        x: ob.x,
        baseX: ob.x,
        z: worldZ,
        movePhase: ob.movePhase ?? 0,
        moveAmplitude: ob.moveAmplitude ?? 0,
        passed: false,
        nearMissed: false,
        hit: false,
      });
    }

    for (const c of plan.coins) {
      const mesh = this.borrowCoinMesh();
      const worldZ = seg.zStart - c.zOffset;
      mesh.position.set(c.x, c.y, worldZ);
      this.endlessGroup.add(mesh);
      this.coins.push({
        mesh,
        x: c.x,
        y: c.y,
        z: worldZ,
        collected: false,
        phase: worldZ * 0.4,
      });
    }

    for (const p of plan.powerUps) {
      const mesh = this.borrowPowerUpMesh(p.type);
      const worldZ = seg.zStart - p.zOffset;
      mesh.position.set(p.x, 0.95, worldZ);
      this.endlessGroup.add(mesh);
      this.powerUps.push({
        type: p.type,
        mesh,
        x: p.x,
        y: 0.95,
        z: worldZ,
        collected: false,
        phase: worldZ * 0.3,
      });
    }
  }

  // --- Public Control API ---

  public updateMeta(
    savedBestScore: number,
    activeMissionId: string,
    baseMissionProgress: number,
  ): void {
    this.savedBestScore = savedBestScore;
    this.activeMissionId = activeMissionId;
    this.baseMissionProgress = baseMissionProgress;
  }

  public setEnvironment(envId: EnvironmentSpec['id']): void {
    const spec = getEnvironmentSpec(envId);
    this.currentEnv = spec;
    this.scene.background = new THREE.Color(spec.fogHex);
    this.scene.fog = new THREE.FogExp2(spec.fogHex, spec.fogDensity);
    this.skyMat.uniforms.topColor.value.set(spec.skyTopHex);
    this.skyMat.uniforms.horizonColor.value.set(spec.skyHorizonHex);
    this.skyMat.uniforms.sunColor.value.set(spec.sunColorHex);
    this.skyMat.uniforms.isNight.value = spec.isNight ? 1.0 : 0.0;
    this.sunLight.color.set(spec.sunColorHex);
    this.sunLight.intensity = spec.sunIntensity;
    this.hemiLight.color.set(spec.hemiSkyHex);
    this.hemiLight.groundColor.set(spec.hemiGroundHex);
    this.hemiLight.intensity = spec.hemiIntensity;
    this.envBuilder.updateEnvironment(spec, this.segments);
  }

  public setLoadout(loadout: LoadoutConfig): void {
    this.currentLoadout = loadout;
    this.cyclist.applyLoadout(loadout);
  }

  public setSettings(settings: GameSettings): void {
    this.settings = { ...settings };
    this.sound.applySettings(settings);
  }

  public startRun(mode: GameMode): void {
    this.disposeAdventureWorld();
    this.experienceMode = 'endless';
    this.endlessGroup.visible = true;
    this.setEnvironment(this.currentEnv.id);

    this.mode = mode;
    this.gameState = 'playing';
    this.keys.clear();
    this.touchThrottle = 0;
    this.swipeTargetX = null;
    this.jumpBufferTimer = 0;

    this.runElapsed = 0;
    this.worldObstacleElapsed = 0;
    this.wasBraking = false;
    this.distanceMeters = 0;
    this.speedMps = 8.4 * this.currentLoadout.bicycle.speedBonus;
    this.topSpeedKmh = mpsToKmh(this.speedMps);
    this.playerX = 0;
    this.playerY = 0;
    this.playerZ = 0;
    this.playerVx = 0;
    this.playerVy = 0;
    this.grounded = true;
    this.landSquash = 0;

    this.score = 0;
    this.coinsRun = 0;
    this.dodgedCount = 0;
    this.nearMissCount = 0;
    this.jumpCount = 0;
    this.dodgeStreak = 0;
    this.coinStreak = 0;
    this.difficultyStage = 1;
    this.newRecordAnnounced = false;
    this.powerTimers.clear();
    this.shieldCharges = 0;
    this.invulnTimer = 0;
    this.isCrashing = false;
    this.crashTimer = 0;
    this.cameraTrauma = 0;
    this.hitstopTimer = 0;
    this.activeBanner = null;

    this.cyclist.resetPose();
    this.cyclist.root.position.set(0, 0, 0);
    this.resetWorldTrack();

    document.body.dataset.state = 'playing';
    document.body.dataset.mode = 'endless';
    this.sound.setPlayingState(true);
    this.updateChaseCamera(0.05);
    this.updateLightingAndSky();
    this.renderer.render(this.scene, this.camera);
    this.emitHud();
  }

  // --- Adventure Mode Public API ---

  private disposeAdventureWorld(): void {
    if (this.adventureWorld) {
      this.scene.remove(this.adventureWorld.group);
      this.adventureWorld.dispose();
      this.adventureWorld = null;
    }
    this.adventureCourse = null;
    this.adventureSim = null;
  }

  private applyAdventureAtmosphere(areaId: AdventureAreaId): void {
    const area = getAdventureAreaSpec(areaId);
    this.scene.background = new THREE.Color(area.fogHex);
    this.scene.fog = new THREE.FogExp2(area.fogHex, area.fogDensity);
    this.skyMat.uniforms.topColor.value.set(area.skyTopHex);
    this.skyMat.uniforms.horizonColor.value.set(area.skyHorizonHex);
    this.skyMat.uniforms.sunColor.value.set(area.sunColorHex);
    this.skyMat.uniforms.isNight.value = areaId === 'stunt_park' ? 1.0 : 0.0;
    this.sunLight.color.set(area.sunColorHex);
    this.sunLight.intensity = area.sunIntensity;
    this.hemiLight.color.set(area.hemiSkyHex);
    this.hemiLight.groundColor.set(area.hemiGroundHex);
    this.hemiLight.intensity = area.hemiIntensity;
  }

  public previewAdventureArea(areaId: AdventureAreaId): void {
    this.disposeAdventureWorld();
    this.experienceMode = 'adventure_preview';
    this.gameState = 'title';
    this.endlessGroup.visible = false;
    this.sound.setPlayingState(false);

    const previewLevelId =
      areaId === 'mountain_cliff'
        ? 'lvl_3_cliff_descent'
        : areaId === 'forest_trails'
          ? 'lvl_2_wheelie_master'
          : areaId === 'canyon'
            ? 'lvl_4_air_time'
            : areaId === 'snow_mountains'
              ? 'lvl_7_extreme_downhill'
              : 'lvl_8_stunt_park_finale';
    const levelDef = getAdventureLevelDef(previewLevelId);
    this.adventureCourse = buildAdventureCourse(levelDef);
    this.adventureWorld = buildAdventureWorldVisuals(
      this.adventureCourse,
      this.renderer.capabilities.getMaxAnisotropy(),
      this.isSoftwareGl,
    );
    this.scene.add(this.adventureWorld.group);
    this.applyAdventureAtmosphere(areaId);

    this.adventurePreviewD = 18;
    const px = getTrailCenterX(levelDef, this.adventurePreviewD);
    const s = sampleAdventureTerrain(this.adventureCourse, px, -this.adventurePreviewD);
    this.playerX = px;
    this.playerY = s.groundY;
    this.playerZ = -this.adventurePreviewD;
    this.cyclist.resetPose();
    this.cyclist.root.position.set(this.playerX, this.playerY, this.playerZ);
    this.cyclistShadow.position.set(this.playerX, this.playerY + 0.02, this.playerZ);
    this.currentFov = 60;
    this.camera.fov = 60;
    this.camera.updateProjectionMatrix();
    this.updateAdventurePreview(0.016);
    this.updateLightingAndSky();
    this.renderer.render(this.scene, this.camera);
  }

  public exitAdventurePreview(): void {
    if (this.experienceMode === 'endless') return;
    this.returnToTitle();
  }

  public startAdventureLevel(levelId: string, bestLevelScore = 0): void {
    this.disposeAdventureWorld();
    this.experienceMode = 'adventure';
    this.endlessGroup.visible = false;
    this.gameState = 'playing';
    this.keys.clear();
    this.adventureTouchInput = {};
    this.adventureJumpQueued = false;
    this.adventureTrickQueued = false;

    const levelDef = getAdventureLevelDef(levelId);
    this.adventureCourse = buildAdventureCourse(levelDef);
    this.adventureWorld = buildAdventureWorldVisuals(
      this.adventureCourse,
      this.renderer.capabilities.getMaxAnisotropy(),
      this.isSoftwareGl,
    );
    this.scene.add(this.adventureWorld.group);
    this.applyAdventureAtmosphere(levelDef.areaId);

    this.adventureSim = createInitialAdventureState(this.adventureCourse);
    this.adventureBestLevelScore = bestLevelScore;
    this.adventureCameraMode = 'chase';
    this.adventureAlertText = levelDef.title.toUpperCase();
    this.adventureAlertTone = 'cyan';
    this.adventureAlertTimer = 2.0;
    this.isCrashing = false;
    this.crashTimer = 0;
    this.cameraTrauma = 0;

    this.playerX = this.adventureSim.x;
    this.playerY = this.adventureSim.y;
    this.playerZ = this.adventureSim.z;
    this.cyclist.resetPose();
    this.cyclist.root.position.set(this.playerX, this.playerY, this.playerZ);
    this.cyclistShadow.position.set(this.playerX, this.playerY + 0.02, this.playerZ);

    document.body.dataset.state = 'playing';
    document.body.dataset.mode = 'adventure';
    this.sound.setPlayingState(true);
    this.updateAdventureCamera(0.05);
    this.updateLightingAndSky();
    this.renderer.render(this.scene, this.camera);
    this.emitAdventureHud();
  }

  public restartAdventureCheckpoint(): void {
    if (!this.adventureCourse || !this.adventureSim) return;
    this.experienceMode = 'adventure';
    this.gameState = 'playing';
    this.isCrashing = false;
    this.crashTimer = 0;
    this.cameraTrauma = 0;
    this.keys.clear();
    this.adventureTouchInput = {};
    this.adventureSim = restoreAdventureCheckpoint(
      this.adventureCourse,
      this.adventureSim,
    );
    this.playerX = this.adventureSim.x;
    this.playerY = this.adventureSim.y;
    this.playerZ = this.adventureSim.z;
    this.cyclist.resetPose();
    this.cyclist.root.position.set(this.playerX, this.playerY, this.playerZ);
    this.adventureAlertText =
      this.adventureSim.checkpointIndex > 0
        ? `CHECKPOINT ${this.adventureSim.checkpointIndex}`
        : 'BACK TO START';
    this.adventureAlertTone = 'cyan';
    this.adventureAlertTimer = 1.5;

    document.body.dataset.state = 'playing';
    document.body.dataset.mode = 'adventure';
    this.sound.setPlayingState(true);
    this.updateAdventureCamera(0.05);
    this.emitAdventureHud();
  }

  public cycleAdventureCamera(): AdventureCameraMode {
    const idx = ADV_CAMERA_MODES.indexOf(this.adventureCameraMode);
    this.adventureCameraMode =
      ADV_CAMERA_MODES[(idx + 1) % ADV_CAMERA_MODES.length];
    this.adventureAlertText = `CAM: ${this.adventureCameraMode.toUpperCase()}`;
    this.adventureAlertTone = 'cyan';
    this.adventureAlertTimer = 1.1;
    this.emitAdventureHud();
    return this.adventureCameraMode;
  }

  public setAdventureTouchInput(patch: Partial<AdventureInputState>): void {
    if (patch.jumpPressed) {
      this.adventureJumpQueued = true;
    }
    if (patch.trickPressed) {
      this.adventureTrickQueued = true;
    }
    Object.assign(this.adventureTouchInput, patch);
  }

  public pauseRun(): void {
    if (this.gameState !== 'playing' || this.isCrashing) return;
    this.gameState = 'paused';
    this.keys.clear();
    this.touchThrottle = 0;
    this.adventureTouchInput = {};
    document.body.dataset.state = 'paused';
    this.sound.setPlayingState(false);
  }

  public resumeRun(): void {
    if (this.gameState !== 'paused') return;
    this.gameState = 'playing';
    this.keys.clear();
    this.adventureTouchInput = {};
    document.body.dataset.state = 'playing';
    this.sound.setPlayingState(true);
    this.lastTimeMs = performance.now();
  }

  public returnToTitle(): void {
    this.disposeAdventureWorld();
    this.experienceMode = 'endless';
    this.endlessGroup.visible = true;
    this.setEnvironment(this.currentEnv.id);

    this.gameState = 'title';
    this.keys.clear();
    this.touchThrottle = 0;
    this.adventureTouchInput = {};
    this.isCrashing = false;
    this.powerTimers.clear();
    this.shieldCharges = 0;
    this.playerX = 0;
    this.playerY = 0;
    this.playerZ = 0;
    this.cyclist.resetPose();
    this.cyclist.root.position.set(0, 0, 0);
    this.cyclistShadow.position.set(0, 0.015, 0);
    this.resetWorldTrack();
    this.camera.position.set(2.75, 1.55, -3.6);
    this.camera.lookAt(-1.25, 0.92, -0.15);
    document.body.dataset.state = 'title';
    document.body.dataset.mode = 'endless';
    this.sound.setPlayingState(false);
  }

  public triggerMobileSwipe(direction: -1 | 1): void {
    if (this.gameState !== 'playing' || this.isCrashing) return;
    const baseX = this.swipeTargetX ?? this.playerX;
    let nearestLane = 1;
    let bestD = Infinity;
    for (let i = 0; i < LANE_CENTERS.length; i++) {
      const d = Math.abs(baseX - LANE_CENTERS[i]);
      if (d < bestD) {
        bestD = d;
        nearestLane = i;
      }
    }
    const nextLane = THREE.MathUtils.clamp(nearestLane + direction, 0, 2);
    this.swipeTargetX = LANE_CENTERS[nextLane];
  }

  public triggerJump(): void {
    if (this.gameState !== 'playing' || this.isCrashing) return;
    this.jumpBufferTimer = 0.14;
  }

  public setTouchBrake(active: boolean): void {
    this.touchThrottle = active ? -1 : 0;
  }

  public setTouchBoost(active: boolean): void {
    this.touchThrottle = active ? 1 : 0;
  }

  // --- Input Handling ---

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const code = e.code;

    if (this.gameState === 'playing') {
      if (code === 'Escape' || code === 'KeyP') {
        e.preventDefault();
        this.callbacks.onPauseRequested();
        return;
      }

      if (this.experienceMode === 'adventure') {
        const ctrl = this.settings.adventureControls;
        if (code === ctrl.jump || code === 'Space') {
          e.preventDefault();
          if (this.adventureSim?.grounded) {
            this.adventureJumpQueued = true;
          } else {
            this.adventureTrickQueued = true;
          }
        } else if (code === ctrl.camera) {
          e.preventDefault();
          this.cycleAdventureCamera();
        } else if (code === ctrl.reset) {
          e.preventDefault();
          this.restartAdventureCheckpoint();
          return;
        }
        this.keys.add(code);
        return;
      }

      if (code === 'Space') {
        e.preventDefault();
        this.jumpBufferTimer = 0.14;
      }
      this.keys.add(code);
      if (
        code === 'KeyA' ||
        code === 'ArrowLeft' ||
        code === 'KeyD' ||
        code === 'ArrowRight'
      ) {
        this.swipeTargetX = null;
      }
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onWindowBlur = () => {
    this.keys.clear();
    this.touchThrottle = 0;
    this.adventureTouchInput = {};
  };

  private bindInputs(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);
  }

  private handleResize(): void {
    const w = Math.max(1, this.container.clientWidth || window.innerWidth);
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  // --- Simulation Loop ---

  private scheduleNextTick(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => {
        if (!this.disposed) this.tick();
      });
    } else {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updateAdventurePreview(dt: number): void {
    if (!this.adventureCourse || !this.adventureWorld) return;
    const lvl = this.adventureCourse.level;
    this.adventurePreviewD += dt * 9.5;
    if (this.adventurePreviewD > lvl.lengthMeters - 30) {
      this.adventurePreviewD = 18;
    }
    const cx = getTrailCenterX(lvl, this.adventurePreviewD);
    const sample = sampleAdventureTerrain(
      this.adventureCourse,
      cx,
      -this.adventurePreviewD,
    );
    this.playerX = cx;
    this.playerY = sample.groundY;
    this.playerZ = -this.adventurePreviewD;

    this.cyclist.root.position.set(this.playerX, this.playerY, this.playerZ);
    this.cyclistShadow.position.set(this.playerX, this.playerY + 0.02, this.playerZ);
    this.cyclist.update(dt, {
      speedMps: 9.5,
      distanceDelta: 9.5 * dt,
      leanAngle: 0,
      steerAngle: 0,
      grounded: true,
      verticalVelocity: 0,
      jumpProgress: 0,
      landSquash: 0,
      isSprinting: false,
      isBoosting: false,
      isCrashed: false,
      crashElapsed: 0,
      shieldActive: false,
      elapsed: this.elapsed,
      bikePitchX: sample.slopePitch,
    });

    for (const c of this.adventureCourse.coins) {
      const m = this.adventureWorld.coinMeshes.get(c.id);
      if (m) m.rotation.y += dt * 2.5;
    }

    const portrait = this.camera.aspect < 0.95;
    const orbit = Math.sin(this.elapsed * 0.35) * 0.55;
    const lookAheadSample = sampleAdventureTerrain(
      this.adventureCourse,
      getTrailCenterX(lvl, this.adventurePreviewD + 7),
      -(this.adventurePreviewD + 7),
    );
    this.camera.position.set(
      this.playerX - (portrait ? 1.8 : 2.5) + orbit * 0.4,
      this.playerY + 2.35,
      this.playerZ + 4.9,
    );
    this.camera.lookAt(
      this.playerX - (portrait ? 0.15 : 1.95),
      Math.max(this.playerY - 1.5, lookAheadSample.groundY + 0.85),
      this.playerZ - 6.5,
    );
  }

  private updateAdventurePlaying(dt: number): void {
    if (!this.adventureCourse || !this.adventureSim || !this.adventureWorld) return;

    if (this.isCrashing) {
      this.crashTimer += dt;
      this.cyclist.update(dt, {
        speedMps: 0,
        distanceDelta: 0,
        leanAngle: 0,
        steerAngle: 0,
        grounded: this.adventureSim.grounded,
        verticalVelocity: 0,
        jumpProgress: 0,
        landSquash: 0,
        isSprinting: false,
        isBoosting: false,
        isCrashed: true,
        crashElapsed: this.crashTimer,
        shieldActive: false,
        elapsed: this.elapsed,
      });
      this.updateAdventureCamera(dt);
      if (this.crashTimer >= 0.6) {
        this.finishAdventureRun('crashed');
      }
      return;
    }

    if (this.adventureAlertTimer > 0) {
      this.adventureAlertTimer -= dt;
      if (this.adventureAlertTimer <= 0) this.adventureAlertText = null;
    }

    const ctrl = this.settings.adventureControls;
    const t = this.adventureTouchInput;
    const input: AdventureInputState = {
      accel: this.keys.has(ctrl.accel) || this.keys.has('ArrowUp') || Boolean(t.accel),
      brake: this.keys.has(ctrl.brake) || this.keys.has('ArrowDown') || Boolean(t.brake),
      steerLeft: this.keys.has(ctrl.left) || this.keys.has('ArrowLeft') || Boolean(t.steerLeft),
      steerRight: this.keys.has(ctrl.right) || this.keys.has('ArrowRight') || Boolean(t.steerRight),
      jumpPressed: this.adventureJumpQueued,
      trickPressed: this.adventureTrickQueued,
      trickHeld: this.keys.has(ctrl.jump) || this.keys.has('Space') || Boolean(t.trickHeld),
      boost: this.keys.has(ctrl.boost) || this.keys.has('ShiftRight') || Boolean(t.boost),
      wheelie: this.keys.has(ctrl.wheelie) || Boolean(t.wheelie),
      stoppie: this.keys.has(ctrl.stoppie) || Boolean(t.stoppie),
      manual: this.keys.has(ctrl.manual) || Boolean(t.manual),
      airPitchUp: this.keys.has('ArrowDown') || this.keys.has(ctrl.brake) || Boolean(t.airPitchUp),
      airPitchDown: this.keys.has('ArrowUp') || this.keys.has(ctrl.accel) || Boolean(t.airPitchDown),
      airYawLeft: this.keys.has('ArrowLeft') || this.keys.has(ctrl.left) || Boolean(t.airYawLeft),
      airYawRight: this.keys.has('ArrowRight') || this.keys.has(ctrl.right) || Boolean(t.airYawRight),
    };
    this.adventureJumpQueued = false;
    this.adventureTrickQueued = false;

    const prevZ = this.adventureSim.z;
    const events = stepAdventurePhysics(
      this.adventureSim,
      this.adventureCourse,
      input,
      this.currentLoadout.bicycle,
      this.settings.sensitivity,
      dt,
    );
    const dz = Math.max(0, prevZ - this.adventureSim.z);

    // Sync world visuals & handle events
    for (const ev of events) {
      if (ev.type === 'jump') {
        this.sound.playJump();
        this.spawnBurst(this.adventureSim.x, this.adventureSim.y + 0.1, this.adventureSim.z, '#e2e8f0', 7, 2.5);
      } else if (ev.type === 'land') {
        this.sound.playLand();
        if (ev.landingQuality === 'PERFECT') {
          this.adventureAlertText = 'PERFECT LANDING! +150';
          this.adventureAlertTone = 'gold';
          this.adventureAlertTimer = 1.3;
          this.spawnBurst(this.adventureSim.x, this.adventureSim.y + 0.1, this.adventureSim.z, '#fbbf24', 12, 4.0);
        } else {
          this.spawnBurst(this.adventureSim.x, this.adventureSim.y + 0.1, this.adventureSim.z, '#cbd5e1', 6, 2.2);
        }
      } else if (ev.type === 'trick') {
        this.sound.playStuntChime(this.adventureSim.comboCount);
        this.adventureAlertText = ev.label ?? null;
        this.adventureAlertTone = ev.tone ?? 'amber';
        this.adventureAlertTimer = 1.4;
      } else if (ev.type === 'combo_bank') {
        this.sound.playComboBank();
        this.adventureAlertText = ev.label ?? null;
        this.adventureAlertTone = ev.tone ?? 'gold';
        this.adventureAlertTimer = 1.6;
      } else if (ev.type === 'checkpoint') {
        this.sound.playCheckpoint();
        this.adventureAlertText = ev.label ?? 'CHECKPOINT!';
        this.adventureAlertTone = 'cyan';
        this.adventureAlertTimer = 1.6;
        const badgeMat = this.adventureWorld.checkpointBadges.get(
          this.adventureSim.checkpointIndex,
        );
        if (badgeMat) {
          badgeMat.color.set('#10b981');
          badgeMat.emissive.set('#059669');
        }
      } else if (ev.type === 'coin') {
        this.sound.playCoin(this.adventureSim.coinsCollected);
      } else if (ev.type === 'crash') {
        this.isCrashing = true;
        this.crashTimer = 0;
        this.cameraTrauma = 0.9;
        this.adventureAlertText = ev.label ?? 'CRASHED!';
        this.adventureAlertTone = 'rose';
        this.adventureAlertTimer = 2.0;
        this.sound.setPlayingState(false);
        this.sound.playCrash();
        this.spawnBurst(this.adventureSim.x, this.adventureSim.y + 0.6, this.adventureSim.z, '#ef4444', 20, 6.5);
        this.emitAdventureHud();
        return;
      } else if (ev.type === 'finish') {
        this.sound.playNewRecord();
        this.finishAdventureRun('completed');
        return;
      }
    }

    // Hide collected coins
    for (const c of this.adventureCourse.coins) {
      const m = this.adventureWorld.coinMeshes.get(c.id);
      if (m) {
        if (c.collected) {
          m.visible = false;
        } else {
          m.rotation.y += dt * 3.0;
        }
      }
    }

    this.playerX = this.adventureSim.x;
    this.playerY = this.adventureSim.y;
    this.playerZ = this.adventureSim.z;

    const leanAngle = THREE.MathUtils.clamp(-this.adventureSim.vx * 0.052, -0.38, 0.38);
    this.cyclist.root.position.set(this.playerX, this.playerY, this.playerZ);

    const terrainHere = sampleAdventureTerrain(this.adventureCourse, this.playerX, this.playerZ);
    const groundHeightBelow = Math.max(0, this.playerY - terrainHere.groundY);
    this.cyclistShadow.position.set(this.playerX, terrainHere.groundY + 0.025, this.playerZ);
    this.cyclistShadow.scale.setScalar(
      THREE.MathUtils.clamp(1 - groundHeightBelow * 0.22, 0.35, 1),
    );

    this.cyclist.update(dt, {
      speedMps: this.adventureSim.speedMps,
      distanceDelta: dz,
      leanAngle,
      steerAngle: leanAngle * 0.36,
      grounded: this.adventureSim.grounded,
      verticalVelocity: this.adventureSim.vy,
      jumpProgress: groundHeightBelow,
      landSquash: this.adventureSim.landSquash,
      isSprinting: input.accel,
      isBoosting: this.adventureSim.isBoosting,
      isCrashed: false,
      crashElapsed: 0,
      shieldActive: false,
      powerAuraColor: this.adventureSim.isBoosting ? '#f59e0b' : null,
      elapsed: this.elapsed,
      bikePitchX: this.adventureSim.grounded
        ? this.adventureSim.terrainSlopePitch
        : this.adventureSim.airPitchAngle,
      bikeYawY: this.adventureSim.grounded ? 0 : this.adventureSim.airYawAngle,
      balancePitch: this.adventureSim.grounded ? this.adventureSim.balancePitch : 0,
      suspensionCompression: this.adventureSim.suspensionOffset,
      isManual: this.adventureSim.balanceMode === 'manual',
      isStoppie: this.adventureSim.balanceMode === 'stoppie',
      trickPose: this.adventureSim.grounded ? 'none' : this.adventureSim.activeTrickPose,
    });

    this.sound.updateAdventureSurfaceSound(
      this.adventureSim.speedMps,
      this.adventureSim.surface,
      this.adventureSim.grounded,
    );

    // Surface spray particles (dirt dust, mud splashes, ice frost, stoppie sparks, boost sparks)
    if (this.adventureSim.grounded && this.adventureSim.speedMps > 5) {
      const isStoppieSparks = this.adventureSim.balanceMode === 'stoppie';
      this.trailAccum += dt * (this.adventureSim.isBoosting || isStoppieSparks ? 36 : 16);
      const sprayCol = this.adventureSim.isBoosting || isStoppieSparks
        ? '#f59e0b'
        : this.adventureSim.surface === 'ice'
          ? '#e0f2fe'
          : this.adventureSim.surface === 'mud'
            ? '#5c3a21'
            : '#c29b70';
      while (this.trailAccum >= 1) {
        this.trailAccum -= 1;
        this.spawnParticle(
          this.playerX + (Math.random() - 0.5) * 0.18,
          this.playerY + 0.1,
          this.playerZ + (isStoppieSparks ? -0.45 : 0.65),
          (Math.random() - 0.5) * 0.9,
          0.35 + Math.random() * 0.7,
          this.adventureSim.speedMps * 0.18,
          0.34,
          0.12,
          sprayCol,
        );
      }
    }

    this.updateAdventureCamera(dt);

    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.085) {
      this.hudEmitAccum = 0;
      this.emitAdventureHud();
    }
  }

  private updateAdventureCamera(dt: number): void {
    if (!this.adventureSim) return;
    const s = this.adventureSim;
    const portraitFactor =
      this.camera.aspect < 1
        ? THREE.MathUtils.clamp((1 - this.camera.aspect) / 0.55, 0, 1)
        : 0;
    const speedRatio = THREE.MathUtils.clamp((s.speedMps - 8) / 18, 0, 1);

    let mode = this.adventureCameraMode;
    if (mode === 'chase' && !s.grounded && s.airtime > 0.22) {
      mode = 'jump';
    }

    let offsetX = 0;
    let offsetY = 2.35;
    let offsetZ = 4.8 + speedRatio * 0.6;
    let lookAheadZ = -5.5;
    let lookY = 1.0;
    let targetFov = 60 + speedRatio * 10 + (s.isBoosting ? 6 : 0) + portraitFactor * 14;

    if (mode === 'downhill') {
      offsetY = 3.1;
      offsetZ = 5.4;
      lookAheadZ = -9.0;
      lookY = 0.55;
      targetFov += 4;
    } else if (mode === 'stunt') {
      offsetX = 2.9;
      offsetY = 1.85;
      offsetZ = 3.6;
      lookAheadZ = -1.8;
      lookY = 0.95;
    } else if (mode === 'jump') {
      offsetX = 2.2;
      offsetY = 2.2;
      offsetZ = 5.6;
      lookAheadZ = -3.2;
      lookY = 0.9;
      targetFov += 5;
    } else if (mode === 'landing') {
      offsetY = 4.0;
      offsetZ = 6.2;
      lookAheadZ = -7.5;
      lookY = 0.3;
    }

    this.currentFov = THREE.MathUtils.damp(this.currentFov, targetFov, 5.5, dt);
    if (Math.abs(this.camera.fov - this.currentFov) > 0.05) {
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }

    this._camPos.set(
      s.x + offsetX,
      s.y + offsetY + portraitFactor * 0.35,
      s.z + offsetZ + portraitFactor * 1.1,
    );

    if (this.cameraTrauma > 0) {
      this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 1.9);
      const shake = this.cameraTrauma * this.cameraTrauma * 0.35;
      this._camPos.x += (Math.random() - 0.5) * shake;
      this._camPos.y += (Math.random() - 0.5) * shake;
    }

    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this._camPos.x, 8.5, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this._camPos.y, 7.0, dt);
    this.camera.position.z = this._camPos.z;

    this._camTarget.set(s.x * 0.9, s.y + lookY, s.z + lookAheadZ);
    this.camera.lookAt(this._camTarget);
  }

  private emitAdventureHud(): void {
    if (!this.adventureCourse || !this.adventureSim || !this.callbacks.onAdventureHudUpdate) {
      return;
    }
    const s = this.adventureSim;
    const lvl = this.adventureCourse.level;
    const area = getAdventureAreaSpec(lvl.areaId);
    const obj = computeObjectiveProgress(lvl, s);
    const mult = Math.min(5, 1 + Math.max(0, s.comboCount - 1) * 0.5);

    const distRounded = Math.min(lvl.lengthMeters, Math.max(0, Math.round(-s.z)));
    this.callbacks.onAdventureHudUpdate({
      levelId: lvl.id,
      levelTitle: lvl.title,
      areaId: lvl.areaId,
      areaName: area.name,
      isChallenge: lvl.isChallenge,
      speedKmh: mpsToKmh(s.speedMps),
      distanceMeters: distRounded,
      totalLengthMeters: lvl.lengthMeters,
      elapsedSeconds: Number(s.elapsedSeconds.toFixed(1)),
      parTimeSeconds: lvl.parTimeSeconds,
      stuntScore: Math.round(s.stuntScore),
      totalScore: Math.round(s.totalScore),
      comboCount: s.comboCount,
      comboMultiplier: mult,
      comboPointsPending: Math.round(s.comboPendingPoints),
      comboTimerRatio: THREE.MathUtils.clamp(s.comboTimer / 2.6, 0, 1),
      airtimeSeconds: Number(s.airtime.toFixed(2)),
      isAirborne: !s.grounded,
      balanceMode: s.balanceMode,
      balanceValue: THREE.MathUtils.clamp(s.balancePitch / 1.0, -1, 1),
      balanceDuration: Number(s.balanceTimer.toFixed(1)),
      activeTrickLabel: s.activeTrickLabel,
      lastLandingQuality: s.lastLandingQuality,
      checkpointIndex: s.checkpointIndex,
      checkpointsTotal: lvl.checkpointsCount,
      objectiveLabel: lvl.objective.label,
      objectiveProgress: obj.progress,
      objectiveTarget: obj.target,
      objectiveCompleted: obj.completed,
      tutorialHint: getAdventureTutorialHint(
        lvl.id,
        distRounded,
        !s.grounded,
        s.balanceMode,
        this.settings.adventureControls,
      ),
      surface: s.surface,
      boostCharge: s.boostCharge,
      isBoosting: s.isBoosting,
      cameraMode: this.adventureCameraMode,
      alertText: this.adventureAlertText,
      alertTone: this.adventureAlertTone,
      coinsCollected: s.coinsCollected,
    });
  }

  private finishAdventureRun(outcome: 'completed' | 'crashed'): void {
    if (!this.adventureCourse || !this.adventureSim || this.gameState === 'gameover') return;
    this.gameState = 'gameover';
    this.keys.clear();
    this.adventureTouchInput = {};
    this.sound.setPlayingState(false);
    document.body.dataset.state = 'gameover';

    const s = this.adventureSim;
    const lvl = this.adventureCourse.level;
    const obj = computeObjectiveProgress(lvl, s);
    const totalScore = Math.round(s.totalScore);
    const starsEarned = computeLevelStars(lvl, totalScore, outcome === 'completed');
    const coinsAwarded =
      outcome === 'completed'
        ? lvl.coinReward + s.coinsCollected * 5 + (starsEarned - 1) * 30
        : s.coinsCollected * 5;
    const elapsedRounded = Number(s.elapsedSeconds.toFixed(1));

    const snapshot: AdventureRunSnapshot = {
      levelId: lvl.id,
      levelTitle: lvl.title,
      areaId: lvl.areaId,
      isChallenge: lvl.isChallenge,
      outcome,
      crashReason: s.crashReason,
      totalScore,
      stuntScore: Math.round(s.stuntScore),
      distanceMeters: Math.min(lvl.lengthMeters, Math.max(0, Math.round(-s.z))),
      totalLengthMeters: lvl.lengthMeters,
      elapsedSeconds: elapsedRounded,
      parTimeSeconds: lvl.parTimeSeconds,
      parTimeBeaten: outcome === 'completed' && elapsedRounded <= lvl.parTimeSeconds,
      starsEarned,
      coinsAwarded,
      longestWheelieSeconds: Number(s.longestWheelieSeconds.toFixed(1)),
      longestJumpMeters: Number(s.longestJumpMeters.toFixed(1)),
      highestJumpMeters: Number(s.highestJumpMeters.toFixed(1)),
      bestComboCount: s.bestComboCount,
      tricksLanded: s.tricksLanded,
      objectiveCompleted: obj.completed,
      objectiveLabel: lvl.objective.label,
      canResumeCheckpoint: outcome === 'crashed',
      checkpointIndex: s.checkpointIndex,
      isNewBestScore: outcome === 'completed' && totalScore > this.adventureBestLevelScore,
    };

    this.emitAdventureHud();
    this.callbacks.onAdventureFinished?.(snapshot);
  }

  private tick(): void {
    if (this.disposed) return;
    const now = performance.now();
    const rawDt = (now - this.lastTimeMs) / 1000;
    this.lastTimeMs = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

    this.elapsed += dt;

    if (this.experienceMode === 'adventure_preview') {
      this.updateAdventurePreview(dt);
    } else if (this.experienceMode === 'adventure') {
      if (this.gameState === 'playing') {
        this.updateAdventurePlaying(dt);
      }
    } else if (this.gameState === 'title') {
      this.updateTitleShowcase(dt);
    } else if (this.gameState === 'playing') {
      this.updatePlaying(dt);
    }

    this.updateParticles(dt);
    this.updateAmbientPickups(dt);
    this.updateLightingAndSky();

    this.renderer.render(this.scene, this.camera);
    this.scheduleNextTick();
  }

  private updateTitleShowcase(dt: number): void {
    const cruiseSpeed = 10.5;
    const dz = cruiseSpeed * dt;
    this.playerZ -= dz;
    // Gentle autopilot lane glide avoiding obstacles
    let targetX = Math.sin(this.elapsed * 0.45) * 1.1;
    for (const o of this.obstacles) {
      const distAhead = this.playerZ - o.z;
      if (distAhead > -1 && distAhead < 14 && Math.abs(o.x - targetX) < 1.5) {
        targetX = o.x > 0 ? -LANE_CENTERS[2] : LANE_CENTERS[2];
      }
    }
    const prevX = this.playerX;
    this.playerX = THREE.MathUtils.damp(this.playerX, targetX, 4.5, dt);
    const vx = (this.playerX - prevX) / dt;
    const lean = THREE.MathUtils.clamp(-vx * 0.06, -0.25, 0.25);

    this.cyclist.root.position.set(this.playerX, 0, this.playerZ);
    this.cyclistShadow.position.set(this.playerX, 0.015, this.playerZ);
    this.cyclist.update(dt, {
      speedMps: cruiseSpeed,
      distanceDelta: dz,
      leanAngle: lean,
      steerAngle: lean * 0.45,
      grounded: true,
      verticalVelocity: 0,
      jumpProgress: 0,
      landSquash: 0,
      isSprinting: false,
      isBoosting: false,
      isCrashed: false,
      crashElapsed: 0,
      shieldActive: false,
      elapsed: this.elapsed,
    });

    this.recycleSegments();

    // Three-quarter showcase camera placing cyclist cleanly in the right half on wide screens, centered-lower on portrait
    const portrait = this.camera.aspect < 0.85;
    const orbit = Math.sin(this.elapsed * 0.28) * 0.45;
    this._camPos.set(
      this.playerX + (portrait ? 2.1 + orbit * 0.5 : 2.75 + orbit),
      (portrait ? 1.75 : 1.55) + Math.sin(this.elapsed * 0.4) * 0.1,
      this.playerZ - (portrait ? 4.8 : 3.6),
    );
    const alpha = 1 - Math.exp(-6 * dt);
    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, this._camPos.x, alpha);
    this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, this._camPos.y, alpha);
    this.camera.position.z = this._camPos.z;
    this._camTarget.set(this.playerX - (portrait ? 0.15 : 1.25), 0.92, this.playerZ - 0.15);
    this.camera.lookAt(this._camTarget);
  }

  private updatePlaying(dt: number): void {
    // Hitstop freeze
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.updateChaseCamera(dt);
      return;
    }

    // Crash sequence before showing Game Over
    if (this.isCrashing) {
      this.crashTimer += dt;
      this.cyclist.update(dt, {
        speedMps: 0,
        distanceDelta: 0,
        leanAngle: 0,
        steerAngle: 0,
        grounded: this.grounded,
        verticalVelocity: 0,
        jumpProgress: 0,
        landSquash: 0,
        isSprinting: false,
        isBoosting: false,
        isCrashed: true,
        crashElapsed: this.crashTimer,
        shieldActive: false,
        elapsed: this.elapsed,
      });
      this.updateChaseCamera(dt);
      if (this.crashTimer >= 0.58) {
        this.finishRun('crashed');
      }
      return;
    }

    // Tick power-up timers
    for (const [k, rem] of this.powerTimers.entries()) {
      const next = rem - dt;
      if (next <= 0) {
        this.powerTimers.delete(k);
        if (k === 'shield') this.shieldCharges = 0;
      } else {
        this.powerTimers.set(k, next);
      }
    }

    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.activeBanner = null;
    }

    const isSpeedBoost = this.powerTimers.has('speed_boost');
    const isSlowMotion = this.powerTimers.has('slow_motion');
    const isDoubleScore = this.powerTimers.has('double_score');
    const isSuperJump = this.powerTimers.has('super_jump');
    const isMagnet = this.powerTimers.has('magnet');

    this.runElapsed += dt;
    this.worldObstacleElapsed += dt * (isSlowMotion ? 0.52 : 1.0);

    // Time Challenge check
    if (this.mode === 'time_challenge' && this.runElapsed >= TIME_CHALLENGE_DURATION) {
      this.finishRun('finished');
      return;
    }

    // Throttle input
    let throttle = this.touchThrottle;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) throttle = 1;
    else if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) throttle = -1;

    const isBraking = throttle < 0;
    if (isBraking && !this.wasBraking && this.grounded && this.speedMps > 9.5) {
      this.sound.playBrake();
    }
    this.wasBraking = isBraking;

    const targetSpeed = computeTargetSpeedMps({
      distanceMeters: this.distanceMeters,
      elapsedSeconds: this.runElapsed,
      throttle,
      isSpeedBoost,
      isSlowMotion,
      bike: this.currentLoadout.bicycle,
    });
    this.speedMps = THREE.MathUtils.damp(this.speedMps, targetSpeed, 4.2, dt);
    const currentKmh = mpsToKmh(this.speedMps);
    if (currentKmh > this.topSpeedKmh) this.topSpeedKmh = currentKmh;

    const dz = this.speedMps * dt;
    this.distanceMeters += dz;
    this.playerZ -= dz;

    const newStage = getDifficultyStage(this.distanceMeters);
    if (newStage > this.difficultyStage) {
      this.difficultyStage = newStage;
      this.showBanner(`STAGE ${newStage}`, 'cyan');
    }

    // Steering input
    let steerDir = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) steerDir -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) steerDir += 1;

    const maxLateralSpeed =
      7.6 *
      this.currentLoadout.bicycle.handlingBonus *
      this.settings.sensitivity;

    if (steerDir !== 0) {
      this.playerVx = THREE.MathUtils.damp(
        this.playerVx,
        steerDir * maxLateralSpeed,
        14,
        dt,
      );
      this.playerX += this.playerVx * dt;
    } else if (this.swipeTargetX !== null) {
      const diff = this.swipeTargetX - this.playerX;
      if (Math.abs(diff) < 0.05) {
        this.playerX = this.swipeTargetX;
        this.swipeTargetX = null;
        this.playerVx = THREE.MathUtils.damp(this.playerVx, 0, 14, dt);
      } else {
        const desiredVx = THREE.MathUtils.clamp(diff * 9.5, -maxLateralSpeed * 1.3, maxLateralSpeed * 1.3);
        this.playerVx = THREE.MathUtils.damp(this.playerVx, desiredVx, 16, dt);
        this.playerX += this.playerVx * dt;
      }
    } else {
      this.playerVx = THREE.MathUtils.damp(this.playerVx, 0, 13, dt);
      this.playerX += this.playerVx * dt;
    }

    if (this.playerX < -ROAD_HALF_CLAMP) {
      this.playerX = -ROAD_HALF_CLAMP;
      this.playerVx = 0;
    } else if (this.playerX > ROAD_HALF_CLAMP) {
      this.playerX = ROAD_HALF_CLAMP;
      this.playerVx = 0;
    }

    // Jump buffering & vertical physics
    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer -= dt;
      if (this.grounded) {
        this.jumpBufferTimer = 0;
        this.grounded = false;
        this.playerVy = getJumpVelocity(this.currentLoadout.bicycle, isSuperJump);
        this.jumpCount++;
        this.sound.playJump();
        this.spawnBurst(this.playerX, 0.08, this.playerZ + 0.4, '#cbd5e1', 7, 2.5);
      }
    }

    if (!this.grounded) {
      this.playerY += this.playerVy * dt;
      this.playerVy -= GRAVITY_MPS2 * dt;
      if (this.playerY <= 0) {
        this.playerY = 0;
        this.playerVy = 0;
        this.grounded = true;
        this.landSquash = 1.0;
        this.sound.playLand();
        this.spawnBurst(this.playerX, 0.05, this.playerZ, '#94a3b8', 6, 2.2);
      }
    }

    this.landSquash = THREE.MathUtils.damp(this.landSquash, 0, 12, dt);

    // Score tick from distance
    const mult = getScoreMultiplier(this.dodgeStreak, isDoubleScore);
    this.score += computeDistanceScoreDelta(dz, mult);

    // Check New Record live during run
    const roundedScore = Math.round(this.score);
    if (
      !this.newRecordAnnounced &&
      this.savedBestScore > 0 &&
      roundedScore > this.savedBestScore
    ) {
      this.newRecordAnnounced = true;
      this.showBanner('NEW RECORD!', 'gold');
      this.sound.playNewRecord();
    }

    // Update Cyclist Visuals & Sound
    const leanAngle = THREE.MathUtils.clamp(-this.playerVx * 0.048, -0.34, 0.34);
    this.cyclist.root.position.set(this.playerX, this.playerY, this.playerZ);
    this.cyclistShadow.position.set(this.playerX, 0.015, this.playerZ);
    const shadowScale = THREE.MathUtils.clamp(1 - this.playerY * 0.28, 0.45, 1);
    this.cyclistShadow.scale.setScalar(shadowScale);

    const auraPriority: PowerUpType[] = [
      'speed_boost',
      'double_score',
      'super_jump',
      'magnet',
      'slow_motion',
    ];
    const activeAuraType = auraPriority.find((t) => this.powerTimers.has(t));
    const powerAuraColor = activeAuraType ? POWERUP_META[activeAuraType].colorHex : null;

    this.cyclist.update(dt, {
      speedMps: this.speedMps,
      distanceDelta: dz,
      leanAngle,
      steerAngle: leanAngle * 0.38,
      grounded: this.grounded,
      verticalVelocity: this.playerVy,
      jumpProgress: this.playerY,
      landSquash: this.landSquash,
      isSprinting: throttle > 0,
      isBoosting: isSpeedBoost,
      isCrashed: false,
      crashElapsed: 0,
      shieldActive: this.shieldCharges > 0,
      powerAuraColor,
      elapsed: this.elapsed,
    });

    this.sound.updateSpeedHum(this.speedMps, this.grounded);

    // Trail particles behind rear wheel
    this.trailAccum += dt * (isSpeedBoost ? 48 : 20);
    while (this.trailAccum >= 1) {
      this.trailAccum -= 1;
      const eff = this.currentLoadout.effect;
      const color = isSpeedBoost
        ? '#f59e0b'
        : Math.random() > 0.45
          ? eff.trailHex
          : eff.secondaryHex;
      this.spawnParticle(
        this.playerX + (Math.random() - 0.5) * 0.14,
        this.playerY + 0.14 + Math.random() * 0.14,
        this.playerZ + 0.72,
        (Math.random() - 0.5) * 0.8,
        0.3 + Math.random() * 0.6,
        this.speedMps * 0.22,
        0.38,
        isSpeedBoost ? 0.18 : 0.11,
        color,
      );
    }

    // Update Moving Obstacles & Check Collisions / Near Misses
    const playerBox = {
      x: this.playerX,
      y: this.playerY,
      z: this.playerZ,
      halfWidth: 0.34,
      height: 1.65,
      halfLength: 0.82,
    };

    for (const o of this.obstacles) {
      if (o.moveAmplitude > 0) {
        o.x = Math.sin(this.worldObstacleElapsed * 2.1 + o.movePhase) * o.moveAmplitude;
        o.mesh.position.x = o.x;
      }

      if (!o.hit && this.invulnTimer <= 0) {
        if (checkCollisionAABB(playerBox, { x: o.x, z: o.z, type: o.type })) {
          o.hit = true;
          this.handleObstacleImpact(o);
          if (this.isCrashing) return;
          continue;
        }
      }

      if (!o.hit && !o.nearMissed && checkNearMiss(playerBox, { x: o.x, z: o.z, type: o.type })) {
        o.nearMissed = true;
        this.nearMissCount++;
        const pts = computeNearMissScore(mult);
        this.score += pts;
        this.showBanner(`NEAR MISS +${pts}`, 'amber');
        this.sound.playNearMiss();
      }

      if (!o.passed && o.z > this.playerZ + 2.2) {
        o.passed = true;
        if (!o.hit) {
          this.dodgedCount++;
          this.dodgeStreak++;
          this.score += computeDodgeScore(mult);
        }
      }
    }

    // Check Coin Magnet & Collection
    for (const c of this.coins) {
      if (c.collected) continue;
      const dx = this.playerX - c.x;
      const dy = this.playerY + 0.75 - c.y;
      const dzCoin = this.playerZ - c.z;
      const distSq = dx * dx + dy * dy + dzCoin * dzCoin;

      if (isMagnet && distSq < 64) {
        const pull = 1 - Math.exp(-15 * dt);
        c.x += dx * pull;
        c.y += dy * pull;
        c.z += dzCoin * pull;
        c.mesh.position.set(c.x, c.y, c.z);
      }

      const captureDistSq = isMagnet ? 2.25 : 1.45;
      if (distSq < captureDistSq) {
        c.collected = true;
        c.mesh.visible = false;
        this.coinsRun++;
        this.coinStreak++;
        this.score += computeCoinScore(mult);
        this.sound.playCoin(this.coinStreak);
        this.spawnBurst(c.x, c.y, c.z, '#fbbf24', 8, 3.2);
      }
    }

    // Check Power-Up Collection
    for (const p of this.powerUps) {
      if (p.collected) continue;
      const dx = this.playerX - p.x;
      const dy = this.playerY + 0.8 - p.y;
      const dzP = this.playerZ - p.z;
      if (dx * dx + dy * dy + dzP * dzP < 1.55) {
        p.collected = true;
        p.mesh.visible = false;
        this.activatePowerUp(p.type);
      }
    }

    this.recycleSegments();
    this.updateChaseCamera(dt);

    // Throttled HUD updates (<= 12Hz)
    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.085) {
      this.hudEmitAccum = 0;
      this.emitHud();
    }
  }

  private handleObstacleImpact(obs: ActiveObstacle): void {
    const isBoost = this.powerTimers.has('speed_boost');
    if (isBoost) {
      // Boost smashes through obstacles safely and awards smash points!
      const isDouble = this.powerTimers.has('double_score');
      const mult = getScoreMultiplier(this.dodgeStreak, isDouble);
      const smashPts = Math.round(40 * mult);
      this.score += smashPts;
      obs.mesh.visible = false;
      this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.25);
      this.spawnBurst(obs.x, 0.7, obs.z, '#f59e0b', 16, 6.0);
      this.showBanner(`SMASHED +${smashPts}`, 'amber');
      this.emitHud();
      return;
    }

    if (this.shieldCharges > 0) {
      this.shieldCharges = 0;
      this.powerTimers.delete('shield');
      this.invulnTimer = 1.4;
      this.hitstopTimer = 0.04;
      this.cameraTrauma = 0.55;
      obs.mesh.visible = false;
      this.sound.playShieldSave();
      this.spawnBurst(this.playerX, 0.9, this.playerZ, '#22d3ee', 20, 6.5);
      this.showBanner('SHIELD SAVED!', 'cyan');
      this.emitHud();
      return;
    }

    if (this.mode === 'time_challenge') {
      // Time Challenge uses speed penalty + brief stagger instead of instant defeat
      this.invulnTimer = 1.6;
      this.speedMps = Math.max(5.5, this.speedMps * 0.45);
      this.dodgeStreak = 0;
      this.hitstopTimer = 0.05;
      this.cameraTrauma = 0.7;
      obs.mesh.visible = false;
      this.sound.playCrash();
      this.spawnBurst(this.playerX, 0.7, this.playerZ, '#ef4444', 18, 5.5);
      this.showBanner('STUMBLED! PACE LOST', 'rose');
      this.emitHud();
      return;
    }

    // Endless / Mission crash
    this.isCrashing = true;
    this.crashTimer = 0;
    this.hitstopTimer = 0.055;
    this.cameraTrauma = 0.9;
    this.dodgeStreak = 0;
    this.sound.setPlayingState(false);
    this.sound.playCrash();
    this.spawnBurst(this.playerX, 0.8, this.playerZ, '#ef4444', 24, 7.2);
    this.emitHud();
  }

  private activatePowerUp(type: PowerUpType): void {
    const meta = POWERUP_META[type];
    this.powerTimers.set(type, meta.durationSeconds);
    if (type === 'shield') {
      this.shieldCharges = 1;
    }
    this.score += 50;
    this.sound.playPowerUp(type);
    this.spawnBurst(this.playerX, this.playerY + 0.9, this.playerZ, meta.colorHex, 14, 4.8);
    this.showBanner(`${meta.label.toUpperCase()}!`, 'emerald');
    this.emitHud();
  }

  private showBanner(text: string, tone: HudBanner['tone']): void {
    this.activeBanner = { id: this.bannerId++, text, tone };
    this.bannerTimer = 1.35;
  }

  private finishRun(outcome: 'finished' | 'crashed'): void {
    if (this.gameState === 'gameover') return;
    this.gameState = 'gameover';
    this.keys.clear();
    this.touchThrottle = 0;
    this.sound.setPlayingState(false);
    document.body.dataset.state = 'gameover';

    const finalScore = Math.round(this.score);
    const isNewRecord = finalScore > this.savedBestScore;
    if (isNewRecord && outcome === 'finished') {
      this.sound.playNewRecord();
    }

    const missionDef = MISSIONS.find((m) => m.id === this.activeMissionId);
    let missionProgressAfter = this.baseMissionProgress;
    if (missionDef) {
      if (missionDef.metric === 'coins') missionProgressAfter += this.coinsRun;
      else if (missionDef.metric === 'distance') missionProgressAfter += Math.round(this.distanceMeters);
      else if (missionDef.metric === 'dodges') missionProgressAfter += this.dodgedCount;
      else if (missionDef.metric === 'near_misses') missionProgressAfter += this.nearMissCount;
      else if (missionDef.metric === 'jumps') missionProgressAfter += this.jumpCount;
      else if (missionDef.metric === 'score') missionProgressAfter = Math.max(missionProgressAfter, finalScore);
    }

    const snapshot: RunSnapshot = {
      score: finalScore,
      bestScore: Math.max(this.savedBestScore, finalScore),
      isNewRecord,
      distanceMeters: Math.round(this.distanceMeters),
      coinsEarned: this.coinsRun,
      survivalSeconds: Math.round(this.runElapsed),
      dodgedObstacles: this.dodgedCount,
      nearMisses: this.nearMissCount,
      jumps: this.jumpCount,
      topSpeedKmh: this.topSpeedKmh,
      difficultyStage: this.difficultyStage,
      mode: this.mode,
      missionCompleted: Boolean(missionDef && missionProgressAfter >= missionDef.target),
      missionTitle: missionDef?.title,
      outcome,
    };

    this.emitHud();
    this.callbacks.onGameOver(snapshot);
  }

  private recycleSegments(): void {
    const recycleThresholdZ = this.playerZ + SEGMENT_LENGTH * 1.4;
    // Recycle segments behind camera
    for (const seg of this.segments) {
      if (seg.zStart - SEGMENT_LENGTH > recycleThresholdZ) {
        const newIdx = this.nextSegmentIndex++;
        seg.zStart = -newIdx * SEGMENT_LENGTH;
        seg.group.position.z = seg.zStart;
        if (this.gameState === 'playing') {
          this.populateSegmentEntities(seg, newIdx);
        } else {
          this.envBuilder.setSegmentVariant(seg, 'standard', newIdx);
        }
      }
    }

    // Reclaim passed entities
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      if (o.z > recycleThresholdZ) {
        o.mesh.visible = true;
        this.endlessGroup.remove(o.mesh);
        const arr = this.obstaclePool.get(o.type) ?? [];
        arr.push(o.mesh);
        this.obstaclePool.set(o.type, arr);
        this.obstacles.splice(i, 1);
      }
    }

    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      if (c.z > recycleThresholdZ) {
        c.mesh.visible = true;
        this.endlessGroup.remove(c.mesh);
        this.coinPool.push(c.mesh);
        this.coins.splice(i, 1);
      }
    }

    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const p = this.powerUps[i];
      if (p.z > recycleThresholdZ) {
        p.mesh.visible = true;
        this.endlessGroup.remove(p.mesh);
        const arr = this.powerUpPool.get(p.type) ?? [];
        arr.push(p.mesh);
        this.powerUpPool.set(p.type, arr);
        this.powerUps.splice(i, 1);
      }
    }
  }

  private updateChaseCamera(dt: number): void {
    const isBoost = this.powerTimers.has('speed_boost');
    const speedRatio = THREE.MathUtils.clamp((this.speedMps - 8) / 16, 0, 1);
    // Widen FOV and tighten lateral follow on narrow portrait screens so lane rides never clip the cyclist
    const portraitFactor =
      this.camera.aspect < 1
        ? THREE.MathUtils.clamp((1 - this.camera.aspect) / 0.55, 0, 1)
        : 0;
    const targetFov = 58 + speedRatio * 10 + (isBoost ? 6 : 0) + portraitFactor * 14;
    this.currentFov = THREE.MathUtils.damp(this.currentFov, targetFov, 6, dt);
    if (Math.abs(this.camera.fov - this.currentFov) > 0.05) {
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }

    // Smooth third-person chase offset
    const followDist = 4.45 + speedRatio * 0.55 + portraitFactor * 1.25;
    const followHeight = 2.15 + this.playerY * 0.45 + portraitFactor * 0.25;

    this._camPos.set(
      this.playerX * (0.78 + 0.15 * portraitFactor),
      followHeight,
      this.playerZ + followDist,
    );

    if (this.cameraTrauma > 0) {
      this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 1.9);
      const shake = this.cameraTrauma * this.cameraTrauma * 0.35;
      this._camPos.x += (Math.random() - 0.5) * shake;
      this._camPos.y += (Math.random() - 0.5) * shake;
    }

    this.camera.position.x = THREE.MathUtils.damp(
      this.camera.position.x,
      this._camPos.x,
      10,
      dt,
    );
    this.camera.position.y = THREE.MathUtils.damp(
      this.camera.position.y,
      this._camPos.y,
      8,
      dt,
    );
    this.camera.position.z = this._camPos.z;

    this._camTarget.set(
      this.playerX * (0.85 + 0.1 * portraitFactor),
      1.05 + this.playerY * 0.55,
      this.playerZ - 5.2,
    );
    this.camera.lookAt(this._camTarget);
  }

  private updateAmbientPickups(dt: number): void {
    for (const c of this.coins) {
      if (c.collected) continue;
      c.mesh.rotation.y += dt * 3.1;
      c.mesh.position.y = c.y + Math.sin(this.elapsed * 3.8 + c.phase) * 0.1;
    }
    for (const p of this.powerUps) {
      if (p.collected) continue;
      p.mesh.rotation.y += dt * 2.2;
      p.mesh.position.y = p.y + Math.sin(this.elapsed * 3.2 + p.phase) * 0.14;
    }
  }

  private updateLightingAndSky(): void {
    this.skyMesh.position.set(this.playerX, this.playerY, this.playerZ);
    this.skyMat.uniforms.uTime.value = this.elapsed;
    this.sunLight.position.set(this.playerX + 16, this.playerY + 26, this.playerZ + 12);
    this.sunLight.target.position.set(this.playerX, this.playerY, this.playerZ - 12);
    this.sunLight.target.updateMatrixWorld();
  }

  private spawnParticle(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    size: number,
    colorHex: string,
  ): void {
    const slot = this.particles[this.particleCursor];
    this.particleCursor = (this.particleCursor + 1) % PARTICLE_POOL_SIZE;
    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.z = z;
    slot.vx = vx;
    slot.vy = vy;
    slot.vz = vz;
    slot.life = life;
    slot.maxLife = life;
    slot.size = size;
    slot.color.set(colorHex);
    this.particleMesh.setColorAt(this.particleCursor === 0 ? PARTICLE_POOL_SIZE - 1 : this.particleCursor - 1, slot.color);
  }

  private spawnBurst(
    x: number,
    y: number,
    z: number,
    colorHex: string,
    count: number,
    speed: number,
  ): void {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const sp = speed * (0.5 + Math.random() * 0.7);
      this.spawnParticle(
        x,
        y,
        z,
        Math.cos(a) * sp,
        1.5 + Math.random() * sp * 0.6,
        Math.sin(a) * sp,
        0.45 + Math.random() * 0.25,
        0.13,
        colorHex,
      );
    }
  }

  private updateParticles(dt: number): void {
    let anyDirty = false;
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      anyDirty = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this._mat4.makeScale(0, 0, 0);
        this.particleMesh.setMatrixAt(i, this._mat4);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 9.5 * dt;
      const s = p.size * (p.life / p.maxLife);
      this._vec3.set(p.x, Math.max(0.03, p.y), p.z);
      this._scaleVec.set(s, s, s);
      this._mat4.compose(this._vec3, this._quat, this._scaleVec);
      this.particleMesh.setMatrixAt(i, this._mat4);
      this.particleMesh.setColorAt(i, p.color);
    }
    if (anyDirty) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
      if (this.particleMesh.instanceColor) {
        this.particleMesh.instanceColor.needsUpdate = true;
      }
    }
  }

  private emitHud(): void {
    const activePowerUps: ActivePowerUpState[] = [];
    for (const [type, remaining] of this.powerTimers.entries()) {
      activePowerUps.push({
        type,
        remaining,
        duration: POWERUP_META[type].durationSeconds,
      });
    }

    const missionDef = MISSIONS.find((m) => m.id === this.activeMissionId) ?? MISSIONS[0];
    let missionProgress = this.baseMissionProgress;
    if (missionDef.metric === 'coins') missionProgress += this.coinsRun;
    else if (missionDef.metric === 'distance') missionProgress += Math.round(this.distanceMeters);
    else if (missionDef.metric === 'dodges') missionProgress += this.dodgedCount;
    else if (missionDef.metric === 'near_misses') missionProgress += this.nearMissCount;
    else if (missionDef.metric === 'jumps') missionProgress += this.jumpCount;
    else if (missionDef.metric === 'score') missionProgress = Math.max(missionProgress, Math.round(this.score));

    const scoreInt = Math.round(this.score);
    const isDouble = this.powerTimers.has('double_score');

    this.callbacks.onHudUpdate({
      score: scoreInt,
      bestScore: Math.max(this.savedBestScore, scoreInt),
      distanceMeters: Math.round(this.distanceMeters),
      speedKmh: mpsToKmh(this.speedMps),
      coinsRun: this.coinsRun,
      survivalSeconds: Math.round(this.runElapsed),
      multiplier: getScoreMultiplier(this.dodgeStreak, isDouble),
      dodgeStreak: this.dodgeStreak,
      difficultyStage: this.difficultyStage,
      activePowerUps,
      shieldCharges: this.shieldCharges,
      mode: this.mode,
      timeRemainingSeconds:
        this.mode === 'time_challenge'
          ? Math.max(0, Math.ceil(TIME_CHALLENGE_DURATION - this.runElapsed))
          : 0,
      activeMissionId: missionDef.id,
      activeMissionProgress: Math.min(missionDef.target, Math.round(missionProgress)),
      activeMissionTarget: missionDef.target,
      activeMissionCompleted: missionProgress >= missionDef.target,
      isNewRecord: this.newRecordAnnounced,
      banner: this.activeBanner,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    this.resizeObserver?.disconnect();
    this.disposeAdventureWorld();
    this.cyclist.dispose();
    this.envBuilder.dispose();
    this.assetFactory.dispose();
    this.shadowTex.dispose();
    this.skyMesh.geometry.dispose();
    this.skyMat.dispose();
    this.particleMesh.geometry.dispose();
    (this.particleMesh.material as THREE.Material).dispose();
    this.cyclistShadow.geometry.dispose();
    (this.cyclistShadow.material as THREE.Material).dispose();
    this.scene.environment?.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
