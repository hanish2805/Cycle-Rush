import * as THREE from 'three';
import { ROAD_WIDTH, SEGMENT_LENGTH } from '../engineLogic';
import type { EnvironmentSpec } from '../types';
import {
  createBuildingFacadeTexture,
  createRoadTextures,
} from './textures';

export interface RoadSegmentObj {
  group: THREE.Group;
  sceneryGroup: THREE.Group;
  bridgeGroup: THREE.Group;
  tunnelGroup: THREE.Group;
  zStart: number; // world Z (moves in -Z direction: segment spans [zStart, zStart - SEGMENT_LENGTH])
  segmentIndex: number;
}

export class EnvironmentBuilder {
  private roadMat: THREE.MeshStandardMaterial;
  private groundMat: THREE.MeshStandardMaterial;
  private curbMat: THREE.MeshStandardMaterial;
  private buildingMat: THREE.MeshStandardMaterial;
  private accentEmissiveMat: THREE.MeshStandardMaterial;
  private trunkMat: THREE.MeshStandardMaterial;
  private foliageMatA: THREE.MeshStandardMaterial;
  private foliageMatB: THREE.MeshStandardMaterial;
  private rockCliffMat: THREE.MeshStandardMaterial;
  private snowCapMat: THREE.MeshStandardMaterial;
  private desertSandMat: THREE.MeshStandardMaterial;
  private cactusMat: THREE.MeshStandardMaterial;
  private metalRailMat: THREE.MeshStandardMaterial;
  private lampBulbMat: THREE.MeshStandardMaterial;
  private crosswalkMat: THREE.MeshStandardMaterial;
  private tunnelShellMat: THREE.MeshStandardMaterial;
  private gantrySignMat: THREE.MeshStandardMaterial;
  private safetyOrangeMat: THREE.MeshStandardMaterial;

  // Shared reusable geometries (zero allocations during segment recycling)
  private roadGeo: THREE.PlaneGeometry;
  private curbGeo: THREE.BoxGeometry;
  private groundGeo: THREE.PlaneGeometry;
  private bridgeTopRailGeo: THREE.BoxGeometry;
  private bridgeMidRailGeo: THREE.BoxGeometry;
  private bridgePostGeo: THREE.BoxGeometry;
  private tunnelArchGeo: THREE.TorusGeometry;
  private tunnelStripGeo: THREE.BoxGeometry;
  private tunnelShellGeo: THREE.CylinderGeometry;

  private unitBoxGeo: THREE.BoxGeometry;
  private poleGeo: THREE.CylinderGeometry;
  private treeTrunkGeo: THREE.CylinderGeometry;
  private treeCone1Geo: THREE.ConeGeometry;
  private treeCone2Geo: THREE.ConeGeometry;
  private treeCone3Geo: THREE.ConeGeometry;
  private shrubGeo: THREE.DodecahedronGeometry;
  private cactusStemGeo: THREE.CapsuleGeometry;
  private cactusArmHGeo: THREE.CapsuleGeometry;
  private cactusArmVGeo: THREE.CapsuleGeometry;
  private cliffGeo: THREE.ConeGeometry;
  private mesaGeo: THREE.CylinderGeometry;
  private boulderGeo: THREE.DodecahedronGeometry;

  private roadTexMap: THREE.CanvasTexture | null = null;
  private roadRoughMap: THREE.CanvasTexture | null = null;
  private buildingTex: THREE.CanvasTexture | null = null;

  private currentEnv: EnvironmentSpec;
  private maxAnisotropy: number;

  constructor(env: EnvironmentSpec, maxAnisotropy: number) {
    this.currentEnv = env;
    this.maxAnisotropy = maxAnisotropy;

    const roadTex = createRoadTextures(env, maxAnisotropy);
    this.roadTexMap = roadTex.map;
    this.roadRoughMap = roadTex.roughnessMap;
    this.buildingTex = createBuildingFacadeTexture(
      Boolean(env.isNight),
      env.accentHex,
      maxAnisotropy,
    );

    this.roadMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.roadTexMap,
      roughnessMap: this.roadRoughMap,
      roughness: env.isNight ? 0.35 : 0.85,
      metalness: env.isNight ? 0.25 : 0.05,
    });
    this.groundMat = new THREE.MeshStandardMaterial({
      color: env.groundHex,
      roughness: 0.94,
      metalness: 0.02,
    });
    this.curbMat = new THREE.MeshStandardMaterial({
      color: env.shoulderHex,
      roughness: 0.8,
      metalness: 0.1,
    });
    this.buildingMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.buildingTex,
      roughness: 0.55,
      metalness: 0.25,
    });
    this.accentEmissiveMat = new THREE.MeshStandardMaterial({
      color: env.accentHex,
      emissive: env.accentHex,
      emissiveIntensity: env.isNight ? 1.4 : 0.4,
      roughness: 0.3,
    });
    this.trunkMat = new THREE.MeshStandardMaterial({
      color: '#5c4033',
      roughness: 0.9,
    });
    this.foliageMatA = new THREE.MeshStandardMaterial({
      color: '#15803d',
      roughness: 0.82,
      flatShading: true,
    });
    this.foliageMatB = new THREE.MeshStandardMaterial({
      color: '#166534',
      roughness: 0.85,
      flatShading: true,
    });
    this.rockCliffMat = new THREE.MeshStandardMaterial({
      color: '#64748b',
      roughness: 0.88,
      flatShading: true,
    });
    this.snowCapMat = new THREE.MeshStandardMaterial({
      color: '#f1f5f9',
      roughness: 0.55,
    });
    this.desertSandMat = new THREE.MeshStandardMaterial({
      color: '#b45309',
      roughness: 0.88,
      flatShading: true,
    });
    this.cactusMat = new THREE.MeshStandardMaterial({
      color: '#2e7d32',
      roughness: 0.78,
    });
    this.metalRailMat = new THREE.MeshStandardMaterial({
      color: '#94a3b8',
      roughness: 0.38,
      metalness: 0.72,
    });
    this.lampBulbMat = new THREE.MeshStandardMaterial({
      color: '#fef9c3',
      emissive: env.isNight ? env.accentHex : '#fde047',
      emissiveIntensity: env.isNight ? 1.6 : 0.65,
      roughness: 0.2,
    });
    this.crosswalkMat = new THREE.MeshStandardMaterial({
      color: env.isNight ? env.accentHex : '#f1f5f9',
      emissive: env.isNight ? env.accentHex : '#000000',
      emissiveIntensity: env.isNight ? 0.55 : 0,
      roughness: 0.7,
    });
    this.tunnelShellMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.9,
      metalness: 0.15,
      side: THREE.BackSide,
    });
    this.gantrySignMat = new THREE.MeshStandardMaterial({
      color: '#065f46',
      emissive: '#047857',
      emissiveIntensity: 0.25,
      roughness: 0.45,
    });
    this.safetyOrangeMat = new THREE.MeshStandardMaterial({
      color: '#f97316',
      emissive: '#ea580c',
      emissiveIntensity: 0.25,
      roughness: 0.4,
    });

    // Allocate shared geometries once
    this.roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, SEGMENT_LENGTH);
    this.roadGeo.rotateX(-Math.PI / 2);
    this.curbGeo = new THREE.BoxGeometry(0.45, 0.16, SEGMENT_LENGTH);
    this.groundGeo = new THREE.PlaneGeometry(140, SEGMENT_LENGTH);
    this.groundGeo.rotateX(-Math.PI / 2);

    this.bridgeTopRailGeo = new THREE.BoxGeometry(0.22, 0.22, SEGMENT_LENGTH);
    this.bridgeMidRailGeo = new THREE.BoxGeometry(0.14, 0.12, SEGMENT_LENGTH);
    this.bridgePostGeo = new THREE.BoxGeometry(0.22, 1.45, 0.22);

    this.tunnelArchGeo = new THREE.TorusGeometry(ROAD_WIDTH * 0.56, 0.42, 8, 18, Math.PI);
    this.tunnelStripGeo = new THREE.BoxGeometry(2.2, 0.14, 0.4);
    this.tunnelShellGeo = new THREE.CylinderGeometry(
      ROAD_WIDTH * 0.60,
      ROAD_WIDTH * 0.60,
      SEGMENT_LENGTH,
      18,
      1,
      true,
      0,
      Math.PI,
    );
    this.tunnelShellGeo.rotateZ(Math.PI / 2);
    this.tunnelShellGeo.rotateY(Math.PI / 2);

    this.unitBoxGeo = new THREE.BoxGeometry(1, 1, 1);
    this.poleGeo = new THREE.CylinderGeometry(0.08, 0.11, 5.2, 8);
    this.treeTrunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 2.2, 8);
    this.treeCone1Geo = new THREE.ConeGeometry(1.45, 2.6, 8);
    this.treeCone2Geo = new THREE.ConeGeometry(1.1, 2.2, 8);
    this.treeCone3Geo = new THREE.ConeGeometry(0.7, 1.6, 8);
    this.shrubGeo = new THREE.DodecahedronGeometry(0.62, 0);
    this.cactusStemGeo = new THREE.CapsuleGeometry(0.24, 2.2, 6, 10);
    this.cactusArmHGeo = new THREE.CapsuleGeometry(0.15, 0.55, 4, 8);
    this.cactusArmVGeo = new THREE.CapsuleGeometry(0.15, 0.72, 4, 8);
    this.cliffGeo = new THREE.ConeGeometry(1, 1, 6);
    this.mesaGeo = new THREE.CylinderGeometry(0.56, 1, 1, 7);
    this.boulderGeo = new THREE.DodecahedronGeometry(1, 0);
  }

  public updateEnvironment(env: EnvironmentSpec, segments: RoadSegmentObj[]): void {
    if (this.currentEnv.id === env.id) return;
    this.currentEnv = env;

    this.roadTexMap?.dispose();
    this.roadRoughMap?.dispose();
    this.buildingTex?.dispose();

    const roadTex = createRoadTextures(env, this.maxAnisotropy);
    this.roadTexMap = roadTex.map;
    this.roadRoughMap = roadTex.roughnessMap;
    this.buildingTex = createBuildingFacadeTexture(
      Boolean(env.isNight),
      env.accentHex,
      this.maxAnisotropy,
    );

    this.roadMat.map = this.roadTexMap;
    this.roadMat.roughnessMap = this.roadRoughMap;
    this.roadMat.roughness = env.isNight ? 0.35 : 0.85;
    this.roadMat.metalness = env.isNight ? 0.25 : 0.05;
    this.roadMat.needsUpdate = true;

    this.groundMat.color.set(env.groundHex);
    this.curbMat.color.set(env.shoulderHex);
    this.buildingMat.map = this.buildingTex;
    this.buildingMat.needsUpdate = true;

    this.accentEmissiveMat.color.set(env.accentHex);
    this.accentEmissiveMat.emissive.set(env.accentHex);
    this.accentEmissiveMat.emissiveIntensity = env.isNight ? 1.4 : 0.4;

    this.lampBulbMat.emissive.set(env.isNight ? env.accentHex : '#fde047');
    this.lampBulbMat.emissiveIntensity = env.isNight ? 1.6 : 0.65;

    this.crosswalkMat.color.set(env.isNight ? env.accentHex : '#f1f5f9');
    this.crosswalkMat.emissive.set(env.isNight ? env.accentHex : '#000000');
    this.crosswalkMat.emissiveIntensity = env.isNight ? 0.55 : 0;

    for (const seg of segments) {
      this.populateScenery(seg, seg.segmentIndex);
    }
  }

  public createRoadSegment(segmentIndex: number): RoadSegmentObj {
    const group = new THREE.Group();

    const roadMesh = new THREE.Mesh(this.roadGeo, this.roadMat);
    roadMesh.position.set(0, 0, -SEGMENT_LENGTH / 2);
    roadMesh.receiveShadow = true;
    group.add(roadMesh);

    const leftCurb = new THREE.Mesh(this.curbGeo, this.curbMat);
    leftCurb.position.set(-ROAD_WIDTH / 2 - 0.22, 0.06, -SEGMENT_LENGTH / 2);
    leftCurb.receiveShadow = true;
    const rightCurb = new THREE.Mesh(this.curbGeo, this.curbMat);
    rightCurb.position.set(ROAD_WIDTH / 2 + 0.22, 0.06, -SEGMENT_LENGTH / 2);
    rightCurb.receiveShadow = true;
    group.add(leftCurb, rightCurb);

    const groundMesh = new THREE.Mesh(this.groundGeo, this.groundMat);
    groundMesh.position.set(0, -0.04, -SEGMENT_LENGTH / 2);
    groundMesh.receiveShadow = true;
    group.add(groundMesh);

    const sceneryGroup = new THREE.Group();
    const bridgeGroup = this.buildBridgeGroup();
    const tunnelGroup = this.buildTunnelGroup();
    bridgeGroup.visible = false;
    tunnelGroup.visible = false;

    group.add(sceneryGroup, bridgeGroup, tunnelGroup);

    const seg: RoadSegmentObj = {
      group,
      sceneryGroup,
      bridgeGroup,
      tunnelGroup,
      zStart: -segmentIndex * SEGMENT_LENGTH,
      segmentIndex,
    };
    group.position.z = seg.zStart;
    this.populateScenery(seg, segmentIndex);
    return seg;
  }

  private buildBridgeGroup(): THREE.Group {
    const g = new THREE.Group();
    for (const side of [-1, 1]) {
      const rx = side * (ROAD_WIDTH / 2 + 0.35);
      const topRail = new THREE.Mesh(this.bridgeTopRailGeo, this.metalRailMat);
      topRail.position.set(rx, 1.35, -SEGMENT_LENGTH / 2);
      g.add(topRail);

      const midRail = new THREE.Mesh(this.bridgeMidRailGeo, this.accentEmissiveMat);
      midRail.position.set(rx, 0.72, -SEGMENT_LENGTH / 2);
      g.add(midRail);

      for (let z = -2; z >= -SEGMENT_LENGTH + 2; z -= 5) {
        const post = new THREE.Mesh(this.bridgePostGeo, this.metalRailMat);
        post.position.set(rx, 0.70, z);
        g.add(post);
      }
    }
    return g;
  }

  private buildTunnelGroup(): THREE.Group {
    const g = new THREE.Group();

    const shell = new THREE.Mesh(this.tunnelShellGeo, this.tunnelShellMat);
    shell.position.set(0, 0.1, -SEGMENT_LENGTH / 2);
    g.add(shell);

    const archCount = 4;
    const spacing = SEGMENT_LENGTH / archCount;
    for (let i = 0; i < archCount; i++) {
      const z = -i * spacing - spacing * 0.5;
      const arch = new THREE.Mesh(this.tunnelArchGeo, this.curbMat);
      arch.position.set(0, 0.2, z);
      g.add(arch);

      const strip = new THREE.Mesh(this.tunnelStripGeo, this.lampBulbMat);
      strip.position.set(0, ROAD_WIDTH * 0.54, z);
      g.add(strip);
    }
    return g;
  }

  public setSegmentVariant(
    seg: RoadSegmentObj,
    variant: 'standard' | 'bridge' | 'tunnel',
    segmentIndex: number,
  ): void {
    seg.segmentIndex = segmentIndex;
    seg.bridgeGroup.visible = variant === 'bridge';
    seg.tunnelGroup.visible = variant === 'tunnel';
    seg.sceneryGroup.visible = variant !== 'tunnel';
    if (variant !== 'tunnel') {
      this.populateScenery(seg, segmentIndex);
    }
  }

  private makeScaledBox(
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
  ): THREE.Mesh {
    const m = new THREE.Mesh(this.unitBoxGeo, mat);
    m.scale.set(w, h, d);
    return m;
  }

  private populateScenery(seg: RoadSegmentObj, seedIdx: number): void {
    const sc = seg.sceneryGroup;
    sc.clear();

    const env = this.currentEnv;
    const pseudo = (n: number) => {
      const s = Math.sin(seedIdx * 12.9898 + n * 78.233) * 43758.5453;
      return s - Math.floor(s);
    };

    if (env.id === 'city' || env.id === 'neon_night') {
      for (const side of [-1, 1]) {
        const pole = new THREE.Mesh(this.poleGeo, this.metalRailMat);
        pole.position.set(side * (ROAD_WIDTH / 2 + 0.9), 2.6, -SEGMENT_LENGTH * 0.5);
        const arm = this.makeScaledBox(1.5, 0.1, 0.1, this.metalRailMat);
        arm.position.set(side * (ROAD_WIDTH / 2 + 0.25), 5.1, -SEGMENT_LENGTH * 0.5);
        const bulb = this.makeScaledBox(0.42, 0.12, 0.22, this.lampBulbMat);
        bulb.position.set(side * (ROAD_WIDTH / 2 - 0.35), 5.02, -SEGMENT_LENGTH * 0.5);
        sc.add(pole, arm, bulb);

        // Sidewalk street tree in concrete planter
        if (seedIdx % 2 === 1) {
          const planter = this.makeScaledBox(1.25, 0.34, 1.25, this.curbMat);
          planter.position.set(side * (ROAD_WIDTH / 2 + 2.3), 0.16, -15);
          const sTree = this.createTreeMesh(0.56);
          sTree.position.set(side * (ROAD_WIDTH / 2 + 2.3), 0.32, -15);
          sc.add(planter, sTree);
        }
      }

      // Overhead Highway Gantry Arch every 3rd segment
      if (seedIdx > 0 && seedIdx % 3 === 0) {
        for (const side of [-1, 1]) {
          const gPost = this.makeScaledBox(0.28, 6.4, 0.28, this.metalRailMat);
          gPost.position.set(side * (ROAD_WIDTH / 2 + 1.35), 3.2, -9);
          sc.add(gPost);
        }
        const truss = this.makeScaledBox(ROAD_WIDTH + 3.0, 0.32, 0.36, this.metalRailMat);
        truss.position.set(0, 6.25, -9);
        const board = this.makeScaledBox(5.2, 1.35, 0.24, env.id === 'neon_night' ? this.accentEmissiveMat : this.gantrySignMat);
        board.position.set(0, 6.25, -9);
        const boardTrim = this.makeScaledBox(4.8, 0.12, 0.28, this.crosswalkMat);
        boardTrim.position.set(0, 5.7, -9);
        sc.add(truss, board, boardTrim);
      }

      // Crosswalk striping every 4th urban segment
      if (seedIdx > 1 && seedIdx % 4 === 0) {
        for (let sx = -3.6; sx <= 3.6; sx += 1.2) {
          const stripe = this.makeScaledBox(0.55, 0.015, 2.2, this.crosswalkMat);
          stripe.position.set(sx, 0.012, -4.5);
          sc.add(stripe);
        }
      }

      if (env.id === 'neon_night' && seedIdx % 2 === 0) {
        const arch = this.makeScaledBox(ROAD_WIDTH + 2.4, 0.22, 0.3, this.accentEmissiveMat);
        arch.position.set(0, 5.4, -4);
        sc.add(arch);
      }

      for (const side of [-1, 1]) {
        for (let b = 0; b < 2; b++) {
          const w = 6 + pseudo(b * 3 + side + 1) * 5;
          const d = 8 + pseudo(b * 5 + side + 2) * 3;
          const h = 10 + pseudo(b * 7 + side + 3) * 22;
          const bx = side * (ROAD_WIDTH / 2 + 4.5 + w * 0.5 + pseudo(b + 9) * 3);
          const bz = -b * 12 - 6;
          const building = this.makeScaledBox(w, h, d, this.buildingMat);
          building.position.set(bx, h * 0.5 - 0.04, bz);
          building.castShadow = true;
          building.receiveShadow = true;
          sc.add(building);

          // Stepped penthouse crown + spire antenna on taller skyscrapers
          if (h > 19) {
            const crown = this.makeScaledBox(w * 0.58, 2.8, d * 0.58, this.metalRailMat);
            crown.position.set(bx, h + 1.35, bz);
            const spire = this.makeScaledBox(0.16, 4.2, 0.16, this.metalRailMat);
            spire.position.set(bx, h + 4.6, bz);
            const beacon = this.makeScaledBox(0.28, 0.28, 0.28, this.accentEmissiveMat);
            beacon.position.set(bx, h + 6.7, bz);
            sc.add(crown, spire, beacon);
          }

          // Anchored metallic storefront canopy with subtle recessed trim (flush against building wall)
          const canopyDepth = d * 0.56;
          const canopy = this.makeScaledBox(0.75, 0.14, canopyDepth, this.metalRailMat);
          canopy.position.set(bx - side * (w * 0.5 + 0.18), 3.15, bz);
          sc.add(canopy);

          // Twin support struts tying the canopy cleanly into the upper facade
          for (const zOff of [-canopyDepth * 0.36, canopyDepth * 0.36]) {
            const bracket = this.makeScaledBox(0.55, 0.07, 0.08, this.metalRailMat);
            bracket.position.set(bx - side * (w * 0.5 + 0.16), 3.38, bz + zOff);
            bracket.rotation.z = side * 0.45;
            sc.add(bracket);
          }

          if (env.id === 'neon_night') {
            const canopyTrim = this.makeScaledBox(0.12, 0.07, canopyDepth * 0.96, this.accentEmissiveMat);
            canopyTrim.position.set(bx - side * (w * 0.5 + 0.52), 3.13, bz);
            sc.add(canopyTrim);

            const roofStrip = this.makeScaledBox(w + 0.1, 0.28, d + 0.1, this.accentEmissiveMat);
            roofStrip.position.set(bx, h - 0.15, bz);
            sc.add(roofStrip);
          }
        }
      }
    } else if (env.id === 'forest') {
      for (const side of [-1, 1]) {
        for (let t = 0; t < 4; t++) {
          const z = -t * 6 - 3;
          const x = side * (ROAD_WIDTH / 2 + 2.4 + pseudo(t * 4 + side) * 9);
          const tree = this.createTreeMesh(0.85 + pseudo(t + 10) * 0.65);
          tree.position.set(x, -0.04, z);
          sc.add(tree);

          if (t % 2 === 0) {
            const shrub = new THREE.Mesh(this.shrubGeo, this.foliageMatB);
            shrub.scale.set(1.1, 0.72, 1.0);
            shrub.position.set(side * (ROAD_WIDTH / 2 + 1.6 + pseudo(t + 15) * 1.4), 0.28, z - 2.2);
            sc.add(shrub);
          }
        }
        const rail = this.makeScaledBox(0.14, 0.14, SEGMENT_LENGTH, this.trunkMat);
        rail.position.set(side * (ROAD_WIDTH / 2 + 0.7), 0.55, -SEGMENT_LENGTH / 2);
        sc.add(rail);
        for (let pz = -3; pz >= -SEGMENT_LENGTH + 3; pz -= 6) {
          const post = this.makeScaledBox(0.16, 0.72, 0.16, this.trunkMat);
          post.position.set(side * (ROAD_WIDTH / 2 + 0.7), 0.34, pz);
          sc.add(post);
        }

        if (pseudo(side + 21) > 0.45) {
          const boulder = new THREE.Mesh(this.boulderGeo, this.rockCliffMat);
          boulder.scale.set(0.65, 0.48, 0.58);
          boulder.position.set(side * (ROAD_WIDTH / 2 + 1.65), 0.2, -12 - pseudo(side + 30) * 6);
          sc.add(boulder);
        }
        if (seedIdx % 3 === 0 && side === 1) {
          const signPost = this.makeScaledBox(0.12, 1.4, 0.12, this.trunkMat);
          signPost.position.set(ROAD_WIDTH / 2 + 1.1, 0.7, -6);
          const signBoard = this.makeScaledBox(0.14, 0.55, 1.0, this.safetyOrangeMat);
          signBoard.position.set(ROAD_WIDTH / 2 + 1.1, 1.35, -6);
          sc.add(signPost, signBoard);
        }
      }
    } else if (env.id === 'mountain') {
      for (const side of [-1, 1]) {
        const cliffR = 7 + pseudo(side + 8) * 5;
        const cliffH = 9 + pseudo(side + 4) * 14;
        const cliff = new THREE.Mesh(this.cliffGeo, this.rockCliffMat);
        cliff.scale.set(cliffR, cliffH, cliffR);
        cliff.position.set(
          side * (ROAD_WIDTH / 2 + 8.5 + pseudo(side + 2) * 5),
          cliffH * 0.5 - 0.5,
          -SEGMENT_LENGTH * 0.5,
        );
        sc.add(cliff);

        // Far towering background peak silhouette
        const farPeak = new THREE.Mesh(this.cliffGeo, this.rockCliffMat);
        farPeak.scale.set(14, 24 + pseudo(side + 19) * 10, 14);
        farPeak.position.set(side * 34, 11, -SEGMENT_LENGTH * 0.5);
        sc.add(farPeak);

        if (cliffH > 14) {
          const snow = new THREE.Mesh(this.cliffGeo, this.snowCapMat);
          snow.scale.set(3.2, cliffH * 0.42, 3.2);
          snow.position.set(cliff.position.x, cliffH * 0.74, cliff.position.z);
          sc.add(snow);
        }

        // Alpine metal highway guardrail + orange snow reflector poles
        const guard = this.makeScaledBox(0.12, 0.24, SEGMENT_LENGTH, this.metalRailMat);
        guard.position.set(side * (ROAD_WIDTH / 2 + 0.62), 0.48, -SEGMENT_LENGTH / 2);
        sc.add(guard);

        for (let pz = -4; pz >= -SEGMENT_LENGTH + 4; pz -= 10) {
          const sPole = this.makeScaledBox(0.08, 1.35, 0.08, this.snowCapMat);
          sPole.position.set(side * (ROAD_WIDTH / 2 + 0.72), 0.65, pz);
          const sTip = this.makeScaledBox(0.11, 0.26, 0.11, this.safetyOrangeMat);
          sTip.position.set(side * (ROAD_WIDTH / 2 + 0.72), 1.32, pz);
          sc.add(sPole, sTip);
        }

        const pine = this.createTreeMesh(0.95);
        pine.position.set(side * (ROAD_WIDTH / 2 + 2.2), -0.04, -8 - pseudo(side) * 8);
        sc.add(pine);
      }
    } else if (env.id === 'desert') {
      for (const side of [-1, 1]) {
        if (seedIdx % 2 === 0 || pseudo(side) > 0.4) {
          const mesaH = 6 + pseudo(side + 5) * 10;
          const mesaR = 6.2 + pseudo(side + 15) * 2.2;
          const mx = side * (ROAD_WIDTH / 2 + 9.5 + pseudo(side + 12) * 6);
          const mesa = new THREE.Mesh(this.mesaGeo, this.desertSandMat);
          mesa.scale.set(mesaR, mesaH, mesaR);
          mesa.position.set(mx, mesaH * 0.5 - 0.2, -SEGMENT_LENGTH * 0.5);
          const cap = new THREE.Mesh(this.mesaGeo, this.rockCliffMat);
          cap.scale.set(mesaR * 0.62, 1.4, mesaR * 0.62);
          cap.position.set(mx, mesaH + 0.4, -SEGMENT_LENGTH * 0.5);
          sc.add(mesa, cap);
        }
        for (let c = 0; c < 2; c++) {
          const cactus = this.createCactusMesh(0.85 + pseudo(c + side) * 0.45);
          cactus.position.set(
            side * (ROAD_WIDTH / 2 + 2.5 + pseudo(c * 3 + side) * 4.5),
            -0.04,
            -5 - c * 11,
          );
          sc.add(cactus);
        }
        if (pseudo(side + 9) > 0.5) {
          const boulder = new THREE.Mesh(this.boulderGeo, this.desertSandMat);
          boulder.scale.set(0.8, 0.55, 0.75);
          boulder.position.set(side * (ROAD_WIDTH / 2 + 1.5), 0.22, -16);
          sc.add(boulder);
        }
        if (seedIdx % 2 === 0) {
          const post = this.makeScaledBox(0.14, 1.05, 0.14, this.trunkMat);
          post.position.set(side * (ROAD_WIDTH / 2 + 0.85), 0.5, -10);
          const reflector = this.makeScaledBox(0.16, 0.22, 0.16, this.safetyOrangeMat);
          reflector.position.set(side * (ROAD_WIDTH / 2 + 0.85), 0.92, -10);
          sc.add(post, reflector);
        }
      }
    }
  }

  private createTreeMesh(scale: number): THREE.Group {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(this.treeTrunkGeo, this.trunkMat);
    trunk.position.y = 1.1;
    trunk.castShadow = true;

    const c1 = new THREE.Mesh(this.treeCone1Geo, this.foliageMatA);
    c1.position.y = 2.8;
    c1.castShadow = true;
    const c2 = new THREE.Mesh(this.treeCone2Geo, this.foliageMatB);
    c2.position.y = 4.2;
    c2.castShadow = true;
    const c3 = new THREE.Mesh(this.treeCone3Geo, this.foliageMatA);
    c3.position.y = 5.3;

    g.add(trunk, c1, c2, c3);
    g.scale.setScalar(scale);
    return g;
  }

  private createCactusMesh(scale: number): THREE.Group {
    const g = new THREE.Group();
    const stem = new THREE.Mesh(this.cactusStemGeo, this.cactusMat);
    stem.position.y = 1.25;
    stem.castShadow = true;
    g.add(stem);

    for (const side of [-1, 1]) {
      const armH = new THREE.Mesh(this.cactusArmHGeo, this.cactusMat);
      armH.rotation.z = Math.PI / 2;
      armH.position.set(side * 0.42, 1.35 + side * 0.18, 0);
      const armV = new THREE.Mesh(this.cactusArmVGeo, this.cactusMat);
      armV.position.set(side * 0.68, 1.72 + side * 0.18, 0);
      g.add(armH, armV);
    }

    g.scale.setScalar(scale);
    return g;
  }

  public dispose(): void {
    this.roadTexMap?.dispose();
    this.roadRoughMap?.dispose();
    this.buildingTex?.dispose();

    this.roadGeo.dispose();
    this.curbGeo.dispose();
    this.groundGeo.dispose();
    this.bridgeTopRailGeo.dispose();
    this.bridgeMidRailGeo.dispose();
    this.bridgePostGeo.dispose();
    this.tunnelArchGeo.dispose();
    this.tunnelStripGeo.dispose();
    this.tunnelShellGeo.dispose();

    this.unitBoxGeo.dispose();
    this.poleGeo.dispose();
    this.treeTrunkGeo.dispose();
    this.treeCone1Geo.dispose();
    this.treeCone2Geo.dispose();
    this.treeCone3Geo.dispose();
    this.shrubGeo.dispose();
    this.cactusStemGeo.dispose();
    this.cactusArmHGeo.dispose();
    this.cactusArmVGeo.dispose();
    this.cliffGeo.dispose();
    this.mesaGeo.dispose();
    this.boulderGeo.dispose();

    this.roadMat.dispose();
    this.groundMat.dispose();
    this.curbMat.dispose();
    this.buildingMat.dispose();
    this.accentEmissiveMat.dispose();
    this.trunkMat.dispose();
    this.foliageMatA.dispose();
    this.foliageMatB.dispose();
    this.rockCliffMat.dispose();
    this.snowCapMat.dispose();
    this.desertSandMat.dispose();
    this.cactusMat.dispose();
    this.metalRailMat.dispose();
    this.lampBulbMat.dispose();
    this.crosswalkMat.dispose();
    this.tunnelShellMat.dispose();
    this.gantrySignMat.dispose();
    this.safetyOrangeMat.dispose();
  }
}
