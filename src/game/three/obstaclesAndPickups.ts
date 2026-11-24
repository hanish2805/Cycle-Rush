import * as THREE from 'three';
import { POWERUP_META } from '../catalog';
import type { ObstacleType, PowerUpType } from '../types';
import {
  createHazardStripeTexture,
  createWoodCrateTexture,
} from './textures';

export class AssetFactory {
  private matOrangePlastic: THREE.MeshStandardMaterial;
  private matWhiteReflective: THREE.MeshStandardMaterial;
  private matDarkRubber: THREE.MeshStandardMaterial;
  private matBarrierStripe: THREE.MeshStandardMaterial;
  private matMetalFrame: THREE.MeshStandardMaterial;
  private matWoodCrate: THREE.MeshStandardMaterial;
  private matWoodDark: THREE.MeshStandardMaterial;
  private matRockA: THREE.MeshStandardMaterial;
  private matRockB: THREE.MeshStandardMaterial;
  private matAsphaltCrater: THREE.MeshStandardMaterial;
  private matCarBodyRed: THREE.MeshStandardMaterial;
  private matCarBodyBlue: THREE.MeshStandardMaterial;
  private matCarBodySilver: THREE.MeshStandardMaterial;
  private matCarGlass: THREE.MeshPhysicalMaterial;
  private matAmberBeacon: THREE.MeshStandardMaterial;
  private matTaillight: THREE.MeshStandardMaterial;
  private matHeadlight: THREE.MeshStandardMaterial;
  private matCoinGold: THREE.MeshPhysicalMaterial;
  private matCoinRim: THREE.MeshStandardMaterial;
  private matContactShadow: THREE.MeshBasicMaterial;
  private shadowCircleGeo = new THREE.CircleGeometry(0.45, 16);
  private hazardTex: THREE.CanvasTexture;
  private woodTex: THREE.CanvasTexture;
  private extraMaterials: THREE.Material[] = [];
  private trackedGeos = new Set<THREE.BufferGeometry>();

  constructor(shadowTex: THREE.CanvasTexture, maxAnisotropy: number) {
    this.hazardTex = createHazardStripeTexture('#f97316', '#f8fafc', maxAnisotropy);
    this.woodTex = createWoodCrateTexture(maxAnisotropy);

    this.matOrangePlastic = new THREE.MeshStandardMaterial({
      color: '#ea580c',
      roughness: 0.35,
      metalness: 0.05,
    });
    this.matWhiteReflective = new THREE.MeshStandardMaterial({
      color: '#f8fafc',
      emissive: '#334155',
      emissiveIntensity: 0.35,
      roughness: 0.2,
      metalness: 0.1,
    });
    this.matDarkRubber = new THREE.MeshStandardMaterial({
      color: '#18181b',
      roughness: 0.88,
      metalness: 0.05,
    });
    this.matBarrierStripe = new THREE.MeshStandardMaterial({
      map: this.hazardTex,
      roughness: 0.45,
      metalness: 0.1,
    });
    this.matMetalFrame = new THREE.MeshStandardMaterial({
      color: '#94a3b8',
      roughness: 0.35,
      metalness: 0.78,
    });
    this.matWoodCrate = new THREE.MeshStandardMaterial({
      map: this.woodTex,
      roughness: 0.78,
      metalness: 0.05,
    });
    this.matWoodDark = new THREE.MeshStandardMaterial({
      color: '#5c3c1e',
      roughness: 0.85,
      metalness: 0.05,
    });
    this.matRockA = new THREE.MeshStandardMaterial({
      color: '#64748b',
      roughness: 0.9,
      metalness: 0.05,
      flatShading: true,
    });
    this.matRockB = new THREE.MeshStandardMaterial({
      color: '#475569',
      roughness: 0.85,
      metalness: 0.08,
      flatShading: true,
    });
    this.matAsphaltCrater = new THREE.MeshStandardMaterial({
      color: '#090b10',
      roughness: 0.95,
      metalness: 0.0,
    });
    this.matCarBodyRed = new THREE.MeshPhysicalMaterial({
      color: '#b91c1c',
      roughness: 0.22,
      metalness: 0.65,
      clearcoat: 0.85,
    });
    this.matCarBodyBlue = new THREE.MeshPhysicalMaterial({
      color: '#1d4ed8',
      roughness: 0.22,
      metalness: 0.65,
      clearcoat: 0.85,
    });
    this.matCarBodySilver = new THREE.MeshPhysicalMaterial({
      color: '#cbd5e1',
      roughness: 0.24,
      metalness: 0.75,
      clearcoat: 0.8,
    });
    this.matCarGlass = new THREE.MeshPhysicalMaterial({
      color: '#0f172a',
      roughness: 0.12,
      metalness: 0.25,
      clearcoat: 1.0,
    });
    this.matAmberBeacon = new THREE.MeshStandardMaterial({
      color: '#f59e0b',
      emissive: '#f59e0b',
      emissiveIntensity: 1.15,
      roughness: 0.2,
    });
    this.matTaillight = new THREE.MeshStandardMaterial({
      color: '#ef4444',
      emissive: '#dc2626',
      emissiveIntensity: 0.95,
      roughness: 0.2,
    });
    this.matHeadlight = new THREE.MeshStandardMaterial({
      color: '#fef08a',
      emissive: '#fde047',
      emissiveIntensity: 0.8,
      roughness: 0.15,
    });
    this.matCoinGold = new THREE.MeshPhysicalMaterial({
      color: '#fbbf24',
      emissive: '#92400e',
      emissiveIntensity: 0.25,
      metalness: 0.92,
      roughness: 0.18,
      clearcoat: 0.7,
    });
    this.matCoinRim = new THREE.MeshStandardMaterial({
      color: '#fef08a',
      metalness: 0.88,
      roughness: 0.22,
    });
    this.matContactShadow = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    this.shadowCircleGeo.rotateX(-Math.PI / 2);
  }

  public createObstacleMesh(type: ObstacleType, variantSeed = 0): THREE.Group {
    const group = new THREE.Group();

    switch (type) {
      case 'cone': {
        const base = new THREE.Mesh(
          new THREE.BoxGeometry(0.62, 0.08, 0.62),
          this.matDarkRubber,
        );
        base.position.y = 0.04;
        base.castShadow = true;
        const body = new THREE.Mesh(
          new THREE.ConeGeometry(0.24, 0.68, 16),
          this.matOrangePlastic,
        );
        body.position.y = 0.40;
        body.castShadow = true;
        const band1 = new THREE.Mesh(
          new THREE.CylinderGeometry(0.115, 0.155, 0.13, 16),
          this.matWhiteReflective,
        );
        band1.position.y = 0.45;
        const band2 = new THREE.Mesh(
          new THREE.CylinderGeometry(0.068, 0.095, 0.09, 16),
          this.matWhiteReflective,
        );
        band2.position.y = 0.60;
        group.add(base, body, band1, band2);
        break;
      }

      case 'barrier': {
        for (const sx of [-0.72, 0.72]) {
          const legA = new THREE.Mesh(
            new THREE.CylinderGeometry(0.032, 0.036, 0.98, 8),
            this.matMetalFrame,
          );
          legA.position.set(sx, 0.46, 0.14);
          legA.rotation.x = 0.25;
          legA.castShadow = true;
          const legB = new THREE.Mesh(
            new THREE.CylinderGeometry(0.032, 0.036, 0.98, 8),
            this.matMetalFrame,
          );
          legB.position.set(sx, 0.46, -0.14);
          legB.rotation.x = -0.25;
          legB.castShadow = true;
          const beacon = new THREE.Mesh(
            new THREE.CylinderGeometry(0.055, 0.065, 0.11, 10),
            this.matAmberBeacon,
          );
          beacon.position.set(sx, 1.04, 0);
          group.add(legA, legB, beacon);
        }
        const plankTop = new THREE.Mesh(
          new THREE.BoxGeometry(1.78, 0.26, 0.10),
          this.matBarrierStripe,
        );
        plankTop.position.y = 0.82;
        plankTop.castShadow = true;
        const plankMid = new THREE.Mesh(
          new THREE.BoxGeometry(1.72, 0.16, 0.09),
          this.matBarrierStripe,
        );
        plankMid.position.y = 0.48;
        plankMid.castShadow = true;
        group.add(plankTop, plankMid);
        break;
      }

      case 'rock': {
        const main = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.54, 1),
          this.matRockA,
        );
        main.position.y = 0.42;
        main.scale.set(1.2, 0.88, 1.08);
        main.rotation.set(0.3, variantSeed * 2.1, 0.2);
        main.castShadow = true;
        const sub1 = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.32, 0),
          this.matRockB,
        );
        sub1.position.set(-0.42, 0.24, 0.22);
        sub1.castShadow = true;
        const sub2 = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.26, 0),
          this.matRockB,
        );
        sub2.position.set(0.40, 0.19, -0.18);
        sub2.castShadow = true;
        group.add(main, sub1, sub2);
        break;
      }

      case 'crate': {
        const core = new THREE.Mesh(
          new THREE.BoxGeometry(0.96, 0.90, 0.96),
          this.matWoodCrate,
        );
        core.position.y = 0.45;
        core.castShadow = true;
        core.receiveShadow = true;
        group.add(core);

        // Raised perimeter frame battens + diagonal cross brace
        const framePositions: [number, number, number, number, number, number][] = [
          [0, 0.87, 0.48, 1.02, 0.09, 0.06],
          [0, 0.04, 0.48, 1.02, 0.09, 0.06],
          [0, 0.87, -0.48, 1.02, 0.09, 0.06],
          [0, 0.04, -0.48, 1.02, 0.09, 0.06],
        ];
        for (const [x, y, z, w, h, d] of framePositions) {
          const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.matWoodDark);
          b.position.set(x, y, z);
          group.add(b);
        }
        const diag = new THREE.Mesh(
          new THREE.BoxGeometry(1.06, 0.08, 0.05),
          this.matWoodDark,
        );
        diag.position.set(0, 0.45, 0.49);
        diag.rotation.z = 0.72;
        const metalCorner = new THREE.Mesh(
          new THREE.BoxGeometry(1.02, 0.12, 1.02),
          this.matMetalFrame,
        );
        metalCorner.position.y = 0.45;
        metalCorner.scale.set(1.0, 0.8, 0.14);
        group.add(diag, metalCorner);
        break;
      }

      case 'pothole': {
        const outerRim = new THREE.Mesh(
          new THREE.RingGeometry(0.54, 0.84, 14),
          this.matRockB,
        );
        outerRim.rotation.x = -Math.PI / 2;
        outerRim.position.y = 0.022;
        const innerHole = new THREE.Mesh(
          new THREE.CircleGeometry(0.56, 14),
          this.matAsphaltCrater,
        );
        innerHole.rotation.x = -Math.PI / 2;
        innerHole.position.y = 0.026;
        group.add(outerRim, innerHole);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + 0.4;
          const chunk = new THREE.Mesh(
            new THREE.DodecahedronGeometry(0.11, 0),
            this.matRockA,
          );
          chunk.position.set(Math.cos(a) * 0.58, 0.06, Math.sin(a) * 0.58);
          chunk.scale.y = 0.55;
          group.add(chunk);
        }
        break;
      }

      case 'parked_car': {
        const bodyMats = [this.matCarBodyRed, this.matCarBodyBlue, this.matCarBodySilver];
        const bodyMat = bodyMats[Math.floor(variantSeed * 3) % bodyMats.length];

        const chassis = new THREE.Mesh(
          new THREE.BoxGeometry(1.78, 0.58, 4.15),
          bodyMat,
        );
        chassis.position.y = 0.55;
        chassis.castShadow = true;
        chassis.receiveShadow = true;

        const cabin = new THREE.Mesh(
          new THREE.BoxGeometry(1.52, 0.54, 2.18),
          bodyMat,
        );
        cabin.position.set(0, 1.10, -0.05);
        cabin.castShadow = true;

        const windshield = new THREE.Mesh(
          new THREE.BoxGeometry(1.44, 0.44, 2.24),
          this.matCarGlass,
        );
        windshield.position.set(0, 1.09, -0.05);

        const rearBumper = new THREE.Mesh(
          new THREE.BoxGeometry(1.80, 0.16, 0.14),
          this.matDarkRubber,
        );
        rearBumper.position.set(0, 0.30, 2.08);

        group.add(chassis, cabin, windshield, rearBumper);

        // 4 Wheels with metallic hubs
        const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16);
        wheelGeo.rotateZ(Math.PI / 2);
        const hubGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.24, 12);
        hubGeo.rotateZ(Math.PI / 2);
        for (const wx of [-0.84, 0.84]) {
          for (const wz of [-1.28, 1.28]) {
            const w = new THREE.Mesh(wheelGeo, this.matDarkRubber);
            w.position.set(wx, 0.32, wz);
            w.castShadow = true;
            const h = new THREE.Mesh(hubGeo, this.matMetalFrame);
            h.position.set(wx, 0.32, wz);
            group.add(w, h);
          }
        }

        // Glowing taillights (facing approaching cyclist at +Z) & front headlights
        for (const lx of [-0.64, 0.64]) {
          const tail = new THREE.Mesh(
            new THREE.BoxGeometry(0.32, 0.13, 0.06),
            this.matTaillight,
          );
          tail.position.set(lx, 0.65, 2.08);
          const head = new THREE.Mesh(
            new THREE.BoxGeometry(0.30, 0.13, 0.06),
            this.matHeadlight,
          );
          head.position.set(lx, 0.58, -2.08);
          group.add(tail, head);
        }
        break;
      }

      case 'moving_barrier': {
        // Automated mobile sweeper/gate barrier on dual tracks
        const base = new THREE.Mesh(
          new THREE.BoxGeometry(1.40, 0.18, 0.54),
          this.matDarkRubber,
        );
        base.position.y = 0.14;
        base.castShadow = true;

        const body = new THREE.Mesh(
          new THREE.BoxGeometry(1.36, 0.56, 0.42),
          this.matBarrierStripe,
        );
        body.position.y = 0.56;
        body.castShadow = true;

        const beaconBar = new THREE.Mesh(
          new THREE.BoxGeometry(0.95, 0.14, 0.24),
          this.matAmberBeacon,
        );
        beaconBar.position.y = 0.94;

        group.add(base, body, beaconBar);
        for (const wx of [-0.52, 0.52]) {
          const w = new THREE.Mesh(
            new THREE.CylinderGeometry(0.14, 0.14, 0.58, 12),
            this.matMetalFrame,
          );
          w.rotation.x = Math.PI / 2;
          w.position.set(wx, 0.14, 0);
          group.add(w);
        }
        break;
      }

      case 'construction_zone': {
        // Wide multi-part hazard work zone: back striped wall + twin front cones + warning sign + pallet
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(1.92, 1.05, 0.35),
          this.matBarrierStripe,
        );
        wall.position.set(0, 0.56, -0.75);
        wall.castShadow = true;

        const signPost = new THREE.Mesh(
          new THREE.CylinderGeometry(0.035, 0.035, 1.45, 8),
          this.matMetalFrame,
        );
        signPost.position.set(0, 0.72, -0.55);

        const signDiamond = new THREE.Mesh(
          new THREE.BoxGeometry(0.56, 0.56, 0.05),
          this.matAmberBeacon,
        );
        signDiamond.rotation.z = Math.PI / 4;
        signDiamond.position.set(0, 1.24, -0.51);

        const pallet = new THREE.Mesh(
          new THREE.BoxGeometry(1.35, 0.42, 1.05),
          this.matWoodCrate,
        );
        pallet.position.set(0, 0.21, 0.15);
        pallet.castShadow = true;

        group.add(wall, signPost, signDiamond, pallet);

        for (const cx of [-0.72, 0.72]) {
          const cone = this.createObstacleMesh('cone');
          cone.position.set(cx, 0, 1.15);
          group.add(cone);
        }
        break;
      }
    }

    this.trackGroupGeos(group);
    return group;
  }

  private trackGroupGeos(group: THREE.Object3D): void {
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry && mesh.geometry !== this.shadowCircleGeo) {
        this.trackedGeos.add(mesh.geometry);
      }
    });
  }

  public createCoinMesh(): THREE.Group {
    const group = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.065, 20),
      this.matCoinGold,
    );
    disc.rotation.x = Math.PI / 2;
    disc.castShadow = true;

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.30, 0.04, 8, 20),
      this.matCoinRim,
    );

    const innerStar = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.14, 0),
      this.matCoinRim,
    );
    innerStar.scale.set(1, 1, 0.45);

    const shadow = new THREE.Mesh(this.shadowCircleGeo, this.matContactShadow);
    shadow.position.y = -0.62;

    group.add(disc, rim, innerStar, shadow);
    this.trackGroupGeos(group);
    return group;
  }

  public createPowerUpMesh(type: PowerUpType): THREE.Group {
    const meta = POWERUP_META[type];
    const group = new THREE.Group();

    const coreMat = new THREE.MeshPhysicalMaterial({
      color: meta.colorHex,
      emissive: meta.colorHex,
      emissiveIntensity: 0.75,
      roughness: 0.18,
      metalness: 0.35,
      clearcoat: 0.9,
    });
    const ringMat = new THREE.MeshStandardMaterial({
      color: '#f8fafc',
      emissive: meta.colorHex,
      emissiveIntensity: 0.45,
      roughness: 0.25,
      metalness: 0.7,
    });
    this.extraMaterials.push(coreMat, ringMat);

    // Outer orbiting halo ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.04, 10, 24), ringMat);
    group.add(ring);

    // Distinct silhouette per power-up type
    let coreMesh: THREE.Object3D;
    switch (type) {
      case 'shield': {
        const shieldGeo = new THREE.CylinderGeometry(0.34, 0.26, 0.14, 6);
        shieldGeo.rotateX(Math.PI / 2);
        coreMesh = new THREE.Mesh(shieldGeo, coreMat);
        break;
      }
      case 'speed_boost': {
        const boltGroup = new THREE.Group();
        const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.48, 4), coreMat);
        c1.position.y = 0.08;
        const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.38, 4), ringMat);
        c2.position.y = -0.15;
        boltGroup.add(c1, c2);
        coreMesh = boltGroup;
        break;
      }
      case 'magnet': {
        const uGeo = new THREE.TorusGeometry(0.24, 0.075, 10, 18, Math.PI);
        coreMesh = new THREE.Mesh(uGeo, coreMat);
        break;
      }
      case 'double_score': {
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), coreMat);
        gem.scale.set(1.0, 1.35, 0.75);
        coreMesh = gem;
        break;
      }
      case 'super_jump': {
        const arrow = new THREE.Group();
        const head = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.36, 10), coreMat);
        head.position.y = 0.16;
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.32, 10), ringMat);
        shaft.position.y = -0.14;
        arrow.add(head, shaft);
        coreMesh = arrow;
        break;
      }
      case 'slow_motion': {
        const chrono = new THREE.Group();
        const topCone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.28, 12), coreMat);
        topCone.rotation.x = Math.PI;
        topCone.position.y = 0.14;
        const botCone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.28, 12), coreMat);
        botCone.position.y = -0.14;
        chrono.add(topCone, botCone);
        coreMesh = chrono;
        break;
      }
    }
    group.add(coreMesh);

    const shadow = new THREE.Mesh(this.shadowCircleGeo, this.matContactShadow);
    shadow.scale.setScalar(1.3);
    shadow.position.y = -0.82;
    group.add(shadow);

    this.trackGroupGeos(group);
    return group;
  }

  public dispose(): void {
    this.hazardTex.dispose();
    this.woodTex.dispose();
    this.shadowCircleGeo.dispose();
    for (const g of this.trackedGeos) {
      g.dispose();
    }
    this.trackedGeos.clear();

    const mats: THREE.Material[] = [
      this.matOrangePlastic,
      this.matWhiteReflective,
      this.matDarkRubber,
      this.matBarrierStripe,
      this.matMetalFrame,
      this.matWoodCrate,
      this.matWoodDark,
      this.matRockA,
      this.matRockB,
      this.matAsphaltCrater,
      this.matCarBodyRed,
      this.matCarBodyBlue,
      this.matCarBodySilver,
      this.matCarGlass,
      this.matAmberBeacon,
      this.matTaillight,
      this.matHeadlight,
      this.matCoinGold,
      this.matCoinRim,
      this.matContactShadow,
      ...this.extraMaterials,
    ];
    for (const m of mats) m.dispose();
    this.extraMaterials = [];
  }
}
