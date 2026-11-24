import * as THREE from 'three';
import {
  getAdventureAreaSpec,
} from '../adventureCatalog';
import {
  getBaseElevation,
  getTrailCenterX,
  getTrailHalfWidth,
  sampleAdventureTerrain,
  type AdventureCourse,
} from '../adventurePhysics';
import type { AdventureAreaSpec } from '../types';

export interface AdventureWorldVisuals {
  group: THREE.Group;
  areaSpec: AdventureAreaSpec;
  coinMeshes: Map<number, THREE.Group>;
  checkpointBadges: Map<number, THREE.MeshStandardMaterial>;
  obstacleMeshes: Map<number, THREE.Object3D>;
  dispose: () => void;
}

function createTrailSurfaceTexture(area: AdventureAreaSpec, maxAniso: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 3600; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const v = Math.random() > 0.5 ? 255 : 185;
    ctx.fillStyle = `rgba(${v},${v},${v},${0.1 + Math.random() * 0.16})`;
    ctx.fillRect(x, y, 2 + Math.random() * 2, 2 + Math.random() * 4);
  }

  // Subtle dual wheel-rut wear lines down center trail
  for (const rx of [112, 144]) {
    const grad = ctx.createLinearGradient(rx - 10, 0, rx + 10, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0.14)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(rx - 10, 0, 20, 256);
  }

  if (area.id === 'stunt_park') {
    ctx.strokeStyle = 'rgba(34,211,238,0.34)';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, 248, 248);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 80);
  tex.anisotropy = maxAniso;
  return tex;
}

function createCheckeredTexture(maxAniso: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  for (let r = 0; r < 4; r++) {
    for (let col = 0; col < 16; col++) {
      ctx.fillStyle = (r + col) % 2 === 0 ? '#0f172a' : '#f8fafc';
      ctx.fillRect(col * 16, r * 16, 16, 16);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function computeVisualOffTrailY(
  areaId: AdventureAreaSpec['id'],
  d: number,
  cIdx: number,
  lat: number,
  halfW: number,
  baseElev: number,
): number {
  const excess = Math.abs(lat) - halfW;
  if (excess <= 0) return baseElev;
  if (areaId === 'stunt_park') {
    const wallT = Math.min(1.5, (excess + 1.1) / 3.6);
    return baseElev + wallT * wallT * 3.1;
  }
  if (areaId === 'forest_trails') {
    return baseElev + Math.min(3.8, excess * 0.38) + Math.sin(d * 0.2 + cIdx) * 0.28;
  }
  if (excess < 2.2) {
    return baseElev - excess * 0.85;
  }
  if (lat > 0 && (areaId === 'mountain_cliff' || areaId === 'canyon')) {
    return baseElev - 13.5 - excess * 0.35;
  }
  return baseElev + (excess - 2.2) * (areaId === 'canyon' ? 1.15 : 0.72);
}

export function buildAdventureWorldVisuals(
  course: AdventureCourse,
  maxAnisotropy: number,
  isSoftwareGl: boolean,
): AdventureWorldVisuals {
  const group = new THREE.Group();
  const area = getAdventureAreaSpec(course.level.areaId);
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(res: T): T => {
    disposables.push(res);
    return res;
  };

  const coinMeshes = new Map<number, THREE.Group>();
  const checkpointBadges = new Map<number, THREE.MeshStandardMaterial>();
  const obstacleMeshes = new Map<number, THREE.Object3D>();

  // 1. Continuous Procedural Vertex-Colored Terrain Ribbon Mesh
  const length = course.level.lengthMeters;
  const zStep = isSoftwareGl ? 3.0 : 2.0;
  const zRows = Math.ceil((length + 34) / zStep) + 1;
  const latOffsets = [
    -26, -16, -9.5, -5.6, -3.5, -2.1, -0.8, 0, 0.8, 2.1, 3.5, 5.6, 9.5, 16, 26,
  ];
  const cols = latOffsets.length;

  const positions = new Float32Array(zRows * cols * 3);
  const colors = new Float32Array(zRows * cols * 3);
  const uvs = new Float32Array(zRows * cols * 2);

  const colTrail = new THREE.Color(area.trailHex);
  const colShoulder = new THREE.Color(area.shoulderHex);
  const colTerrain = new THREE.Color(area.terrainHex);
  const colTerrainAlt = new THREE.Color(area.terrainAltHex);
  const colMud = new THREE.Color('#4a321f');
  const colIce = new THREE.Color('#bae6fd');
  const colAccent = new THREE.Color(area.accentHex);
  const tmpCol = new THREE.Color();

  for (let r = 0; r < zRows; r++) {
    const d = -10 + r * zStep;
    const z = -d;
    const cx = getTrailCenterX(course.level, Math.max(0, Math.min(length, d)));
    const halfW = getTrailHalfWidth(course.level, Math.max(0, Math.min(length, d)));
    const baseElev = getBaseElevation(course.level, Math.max(0, Math.min(length, d)));

    const inGap = course.gaps.some((g) => d >= g.dStart && d <= g.dEnd);
    const onBridge = course.bridges.some((b) => d >= b.dStart && d <= b.dEnd);

    for (let c = 0; c < cols; c++) {
      const lat = latOffsets[c];
      const wx = cx + lat;
      let wy = baseElev;

      if (inGap || onBridge) {
        wy = baseElev - 11.5;
        tmpCol.copy(colTerrain).multiplyScalar(0.55);
      } else {
        const s = sampleAdventureTerrain(course, wx, z);
        if (Math.abs(lat) <= halfW) {
          wy = baseElev;
          if (s.surface === 'mud') tmpCol.copy(colMud);
          else if (s.surface === 'ice') tmpCol.copy(colIce);
          else tmpCol.copy(colTrail);
          if (Math.abs(lat) < 0.85) tmpCol.lerp(colShoulder, 0.14);
          if (Math.abs(Math.abs(lat) - halfW) < 0.75) {
            tmpCol.lerp(area.id === 'stunt_park' ? colAccent : colShoulder, 0.42);
          }
        } else if (area.id === 'stunt_park') {
          wy = computeVisualOffTrailY(area.id, d, c, lat, halfW, baseElev);
          tmpCol.copy(colTerrainAlt);
          if (Math.abs(lat) > halfW + 1.8) tmpCol.lerp(colAccent, 0.25);
        } else {
          wy = computeVisualOffTrailY(area.id, d, c, lat, halfW, baseElev);
          const excess = Math.abs(lat) - halfW;
          if (excess < 2.2 && area.id !== 'forest_trails') {
            tmpCol.copy(colShoulder);
          } else if (lat > 0 && (area.id === 'mountain_cliff' || area.id === 'canyon')) {
            tmpCol.copy(colTerrain).multiplyScalar(0.65);
          } else {
            tmpCol.copy(c % 2 === 0 ? colTerrain : colTerrainAlt);
          }
        }
      }

      const idx = r * cols + c;
      positions[idx * 3] = wx;
      positions[idx * 3 + 1] = wy;
      positions[idx * 3 + 2] = z;

      colors[idx * 3] = tmpCol.r;
      colors[idx * 3 + 1] = tmpCol.g;
      colors[idx * 3 + 2] = tmpCol.b;

      uvs[idx * 2] = (lat + 26) / 52;
      uvs[idx * 2 + 1] = d / length;
    }
  }

  const indices: number[] = [];
  for (let r = 0; r < zRows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const dIdx = (r + 1) * cols + c;
      const e = dIdx + 1;
      // CCW winding when viewed from +Y so normals point upward
      indices.push(a, b, dIdx);
      indices.push(b, e, dIdx);
    }
  }

  const terrainGeo = track(new THREE.BufferGeometry());
  terrainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  terrainGeo.setIndex(indices);
  terrainGeo.computeVertexNormals();

  const terrainTex = track(createTrailSurfaceTexture(area, maxAnisotropy));
  const terrainMat = track(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: terrainTex,
      roughness: area.id === 'snow_mountains' ? 0.35 : 0.85,
      metalness: area.id === 'stunt_park' ? 0.14 : 0.04,
    }),
  );
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = !isSoftwareGl;
  group.add(terrainMesh);

  // 2. River / Water Floor strip for Forest Trails & Valley Floor for Mountain/Canyon
  if (area.id === 'forest_trails' || area.id === 'canyon' || area.id === 'mountain_cliff') {
    const waterColor =
      area.id === 'forest_trails'
        ? '#0284c7'
        : area.id === 'canyon'
          ? '#7c2d12'
          : '#334155';
    const floorMat = track(
      new THREE.MeshStandardMaterial({
        color: waterColor,
        roughness: area.id === 'forest_trails' ? 0.18 : 0.85,
        metalness: area.id === 'forest_trails' ? 0.35 : 0.05,
      }),
    );
    for (const b of course.bridges) {
      const bMid = (b.dStart + b.dEnd) * 0.5;
      const riverGeo = track(new THREE.PlaneGeometry(46, b.dEnd - b.dStart + 14));
      riverGeo.rotateX(-Math.PI / 2);
      const river = new THREE.Mesh(riverGeo, floorMat);
      river.position.set(b.xCenter, getBaseElevation(course.level, bMid) - 6.2, -bMid);
      group.add(river);
    }
  }

  // 3. Bridges (Wood Plank, Suspended Canyon Bridge, Frozen Alpine Bridge)
  const woodMat = track(
    new THREE.MeshStandardMaterial({ color: '#8b5a2b', roughness: 0.82 }),
  );
  const postMat = track(
    new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.9 }),
  );
  const ropeMat = track(
    new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.7 }),
  );
  const iceBridgeMat = track(
    new THREE.MeshPhysicalMaterial({
      color: '#bae6fd',
      roughness: 0.12,
      metalness: 0.1,
      clearcoat: 0.9,
    }),
  );

  for (const b of course.bridges) {
    const bGroup = new THREE.Group();
    const len = b.dEnd - b.dStart;
    const steps = Math.max(8, Math.round(len / 1.2));
    const mat = b.style === 'frozen' ? iceBridgeMat : woodMat;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const d = b.dStart + t * len;
      const y = getBaseElevation(course.level, d) + Math.sin(t * Math.PI) * 0.45;
      const plankGeo = track(
        new THREE.BoxGeometry(b.halfWidth * 2, 0.22, (len / steps) * 0.88),
      );
      const plank = new THREE.Mesh(plankGeo, mat);
      plank.position.set(b.xCenter, y - 0.11, -d);
      plank.castShadow = !isSoftwareGl;
      plank.receiveShadow = !isSoftwareGl;
      bGroup.add(plank);

      if (i % 3 === 0) {
        for (const side of [-1, 1]) {
          const post = new THREE.Mesh(
            track(new THREE.CylinderGeometry(0.08, 0.09, 1.15, 8)),
            b.style === 'frozen' ? iceBridgeMat : postMat,
          );
          post.position.set(b.xCenter + side * (b.halfWidth - 0.08), y + 0.55, -d);
          bGroup.add(post);
        }
      }
    }

    // Side rails / suspension cables
    for (const side of [-1, 1]) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const d = b.dStart + t * len;
        const y = getBaseElevation(course.level, d) + Math.sin(t * Math.PI) * 0.45 + 0.98;
        pts.push(new THREE.Vector3(b.xCenter + side * (b.halfWidth - 0.08), y, -d));
      }
      const railCurve = new THREE.CatmullRomCurve3(pts);
      const rail = new THREE.Mesh(
        track(new THREE.TubeGeometry(railCurve, 16, 0.045, 6, false)),
        b.style === 'suspended' ? ropeMat : b.style === 'frozen' ? iceBridgeMat : postMat,
      );
      bGroup.add(rail);
    }

    group.add(bGroup);
  }

  // 4. Ramps, Kickers, Platforms & Stunt Rails
  const rampMat = track(
    new THREE.MeshStandardMaterial({
      color: area.id === 'stunt_park' ? '#1e293b' : '#78350f',
      roughness: 0.65,
    }),
  );
  const lipMat = track(
    new THREE.MeshStandardMaterial({
      color: area.accentHex,
      emissive: area.accentHex,
      emissiveIntensity: 0.35,
      roughness: 0.4,
    }),
  );
  const railMetalMat = track(
    new THREE.MeshStandardMaterial({
      color: '#e2e8f0',
      metalness: 0.88,
      roughness: 0.2,
    }),
  );

  for (const r of course.ramps) {
    const rLen = r.dEnd - r.dStart;
    if (r.kind === 'rail') {
      const startY = getBaseElevation(course.level, r.dStart);
      const endY = getBaseElevation(course.level, r.dEnd);
      const midY = (startY + endY) * 0.5 + r.height;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(r.xCenter, startY + 0.05, -r.dStart),
        new THREE.Vector3(r.xCenter, midY, -r.dStart - rLen * 0.2),
        new THREE.Vector3(r.xCenter, midY, -r.dEnd + rLen * 0.2),
        new THREE.Vector3(r.xCenter, endY + 0.05, -r.dEnd),
      ]);
      for (const s of [-0.18, 0.18]) {
        const railMesh = new THREE.Mesh(
          track(new THREE.TubeGeometry(curve, 18, 0.07, 8, false)),
          railMetalMat,
        );
        railMesh.position.x = s;
        group.add(railMesh);
      }
      continue;
    }

    // Build custom extruded/segmented ramp wedge matching trail elevation
    const segs = 10;
    const rampGeo = track(new THREE.BufferGeometry());
    const rPos: number[] = [];
    const rIdx: number[] = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const d = r.dStart + t * rLen;
      const base = getBaseElevation(course.level, d);
      const h =
        r.kind === 'kicker'
          ? r.height * (t * t * 0.7 + t * 0.3)
          : r.height *
            Math.min(1, t < 0.14 ? t / 0.14 : t > 0.86 ? (1 - t) / 0.14 : 1);
      rPos.push(r.xCenter - r.halfWidth, base + h, -d);
      rPos.push(r.xCenter + r.halfWidth, base + h, -d);
      rPos.push(r.xCenter - r.halfWidth, base - 0.3, -d);
      rPos.push(r.xCenter + r.halfWidth, base - 0.3, -d);
      if (i < segs) {
        const b = i * 4;
        const n = (i + 1) * 4;
        // Top deck (+Y normal)
        rIdx.push(b, b + 1, n, b + 1, n + 1, n);
        // Left & right sides (outward normals)
        rIdx.push(b + 2, b, n + 2, b, n, n + 2);
        rIdx.push(b + 1, b + 3, n + 1, b + 3, n + 3, n + 1);
      }
    }
    rampGeo.setAttribute('position', new THREE.Float32BufferAttribute(rPos, 3));
    rampGeo.setIndex(rIdx);
    rampGeo.computeVertexNormals();
    const mesh = new THREE.Mesh(rampGeo, rampMat);
    mesh.castShadow = !isSoftwareGl;
    mesh.receiveShadow = !isSoftwareGl;
    group.add(mesh);

    // Glowing launch stripe + roadside warning posts at kicker lip
    if (r.kind === 'kicker') {
      const lipY = getBaseElevation(course.level, r.dEnd) + r.height;
      const lipStrip = new THREE.Mesh(
        track(new THREE.BoxGeometry(r.halfWidth * 1.92, 0.12, 0.38)),
        lipMat,
      );
      lipStrip.position.set(r.xCenter, lipY - 0.02, -r.dEnd + 0.2);
      group.add(lipStrip);

      const postY = getBaseElevation(course.level, r.dStart);
      for (const side of [-1, 1]) {
        const wPost = new THREE.Mesh(
          track(new THREE.CylinderGeometry(0.06, 0.07, 1.35, 6)),
          woodMat,
        );
        wPost.position.set(r.xCenter + side * (r.halfWidth + 0.35), postY + 0.67, -r.dStart - 0.5);
        const wFlag = new THREE.Mesh(
          track(new THREE.BoxGeometry(0.45, 0.32, 0.08)),
          lipMat,
        );
        wFlag.position.set(r.xCenter + side * (r.halfWidth + 0.35), postY + 1.25, -r.dStart - 0.5);
        group.add(wPost, wFlag);
      }
    }
  }

  // 5. Obstacles (Rocks, Fallen Logs, Snow Boulders, Arena Barriers)
  const rockMat = track(
    new THREE.MeshStandardMaterial({
      color: area.id === 'canyon' ? '#9a3412' : '#64748b',
      roughness: 0.92,
      flatShading: true,
    }),
  );
  const logMat = track(
    new THREE.MeshStandardMaterial({ color: '#5c3a21', roughness: 0.9 }),
  );
  const snowRockMat = track(
    new THREE.MeshStandardMaterial({
      color: '#cbd5e1',
      roughness: 0.45,
      flatShading: true,
    }),
  );
  const barrierMat = track(
    new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.5 }),
  );

  for (const obs of course.obstacles) {
    const oGroup = new THREE.Group();
    if (obs.kind === 'fallen_log') {
      const trunk = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.28, 0.34, 1.85, 10)),
        logMat,
      );
      trunk.rotation.z = Math.PI / 2;
      trunk.position.y = 0.28;
      oGroup.add(trunk);
      const stub = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.08, 0.12, 0.5, 7)),
        logMat,
      );
      stub.position.set(0.35, 0.52, 0.06);
      stub.rotation.z = -0.45;
      oGroup.add(stub);
    } else if (obs.kind === 'barrier') {
      const base = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.45, 0.52, 0.78, 12)),
        barrierMat,
      );
      base.position.y = 0.39;
      oGroup.add(base);
    } else {
      const boulder = new THREE.Mesh(
        track(new THREE.DodecahedronGeometry(obs.radius, 1)),
        obs.kind === 'snow_boulder' ? snowRockMat : rockMat,
      );
      boulder.scale.set(1.15, 0.92, 1.0);
      boulder.position.y = obs.radius * 0.72;
      oGroup.add(boulder);
    }
    oGroup.position.set(obs.worldX, obs.worldY, obs.worldZ);
    group.add(oGroup);
    obstacleMeshes.set(obs.id, oGroup);
  }

  // 6. Scenery Props via InstancedMesh (Parity across GPU & SwiftShader)
  const propCount = 120;
  if (area.id === 'forest_trails' || area.id === 'mountain_cliff' || area.id === 'snow_mountains') {
    const trunkGeo = track(new THREE.CylinderGeometry(0.16, 0.30, 2.5, 7));
    const trunkMat = track(new THREE.MeshStandardMaterial({ color: '#4a2e1b', roughness: 0.95 }));
    const tier1Geo = track(new THREE.ConeGeometry(1.85, 2.8, 8));
    const tier2Geo = track(new THREE.ConeGeometry(1.4, 2.5, 8));
    const tier3Geo = track(new THREE.ConeGeometry(0.9, 2.0, 8));
    const foliageMat = track(
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: area.id === 'snow_mountains' ? 0.65 : 0.85,
        flatShading: true,
      }),
    );
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, propCount);
    const crown1 = new THREE.InstancedMesh(tier1Geo, foliageMat, propCount);
    const crown2 = new THREE.InstancedMesh(tier2Geo, foliageMat, propCount);
    const crown3 = new THREE.InstancedMesh(tier3Geo, foliageMat, propCount);
    const dummy = new THREE.Object3D();
    const treeTint = new THREE.Color();

    for (let i = 0; i < propCount; i++) {
      const d = (i / propCount) * length;
      const side = i % 2 === 0 ? -1 : 1;
      const cx = getTrailCenterX(course.level, d);
      const halfW = getTrailHalfWidth(course.level, d);
      const baseElev = getBaseElevation(course.level, d);
      const lat = side * (6.0 + ((i * 37) % 14));
      const wx = cx + lat;
      const wy = computeVisualOffTrailY(area.id, d, i, lat, halfW, baseElev);
      const scale = 0.82 + ((i * 19) % 10) * 0.08;

      dummy.position.set(wx, wy + 1.0 * scale, -d);
      dummy.rotation.y = (i * 1.1) % (Math.PI * 2);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);

      dummy.position.set(wx, wy + 2.75 * scale, -d);
      dummy.updateMatrix();
      crown1.setMatrixAt(i, dummy.matrix);

      dummy.position.set(wx, wy + 4.15 * scale, -d);
      dummy.updateMatrix();
      crown2.setMatrixAt(i, dummy.matrix);

      dummy.position.set(wx, wy + 5.35 * scale, -d);
      dummy.updateMatrix();
      crown3.setMatrixAt(i, dummy.matrix);

      if (area.id === 'snow_mountains') {
        treeTint.set(i % 3 === 0 ? '#cbd5e1' : i % 3 === 1 ? '#1e3a8a' : '#334155');
        crown1.setColorAt(i, treeTint);
        crown2.setColorAt(i, i % 2 === 0 ? treeTint.set('#e2e8f0') : treeTint.set('#64748b'));
        crown3.setColorAt(i, treeTint.set('#f8fafc'));
      } else {
        const greenPalette = ['#14532d', '#166534', '#15803d', '#365314'];
        treeTint.set(greenPalette[i % greenPalette.length]);
        crown1.setColorAt(i, treeTint);
        crown2.setColorAt(i, treeTint.clone().offsetHSL(0, 0, 0.04));
        crown3.setColorAt(i, treeTint.clone().offsetHSL(0, 0, 0.08));
      }
    }
    trunks.instanceMatrix.needsUpdate = true;
    crown1.instanceMatrix.needsUpdate = true;
    crown2.instanceMatrix.needsUpdate = true;
    crown3.instanceMatrix.needsUpdate = true;
    if (crown1.instanceColor) crown1.instanceColor.needsUpdate = true;
    if (crown2.instanceColor) crown2.instanceColor.needsUpdate = true;
    if (crown3.instanceColor) crown3.instanceColor.needsUpdate = true;
    group.add(trunks, crown1, crown2, crown3);

    // Sparkling Glacial Ice Crystals alongside Snow Mountains trails
    if (area.id === 'snow_mountains') {
      const crystalGeo = track(new THREE.OctahedronGeometry(1.15, 0));
      const crystalMat = track(
        new THREE.MeshPhysicalMaterial({
          color: '#7dd3fc',
          emissive: '#0284c7',
          emissiveIntensity: 0.28,
          roughness: 0.15,
          clearcoat: 0.9,
          flatShading: true,
        }),
      );
      const crystals = new THREE.InstancedMesh(crystalGeo, crystalMat, 36);
      for (let i = 0; i < 36; i++) {
        const d = (i / 36) * length;
        const side = i % 2 === 0 ? 1 : -1;
        const lat = side * (4.8 + (i % 5) * 1.3);
        const wx = getTrailCenterX(course.level, d) + lat;
        const wy = computeVisualOffTrailY(area.id, d, i, lat, getTrailHalfWidth(course.level, d), getBaseElevation(course.level, d));
        dummy.position.set(wx, wy + 1.1, -d);
        dummy.rotation.set(0.15, i * 0.7, 0.12);
        dummy.scale.set(0.85, 1.85 + (i % 3) * 0.45, 0.85);
        dummy.updateMatrix();
        crystals.setMatrixAt(i, dummy.matrix);
      }
      crystals.instanceMatrix.needsUpdate = true;
      group.add(crystals);
    }
  } else if (area.id === 'canyon') {
    const spireGeo = track(new THREE.CylinderGeometry(1.2, 3.6, 18, 7));
    const spireMat = track(
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.92,
        flatShading: true,
      }),
    );
    const spires = new THREE.InstancedMesh(spireGeo, spireMat, 56);
    const dummy = new THREE.Object3D();
    const canyonCol = new THREE.Color();
    const palette = ['#b45309', '#c2410c', '#9a3412', '#d97706'];
    for (let i = 0; i < 56; i++) {
      const d = (i / 56) * length;
      const side = i % 2 === 0 ? -1 : 1;
      const wx = getTrailCenterX(course.level, d) + side * (10.5 + (i % 10));
      const wy = getBaseElevation(course.level, d) + (side < 0 ? 5.5 : -2.5);
      dummy.position.set(wx, wy, -d);
      dummy.rotation.y = i * 0.6;
      dummy.scale.set(1 + (i % 3) * 0.35, 0.8 + (i % 4) * 0.4, 1.2);
      dummy.updateMatrix();
      spires.setMatrixAt(i, dummy.matrix);
      spires.setColorAt(i, canyonCol.set(palette[i % palette.length]));
    }
    spires.instanceMatrix.needsUpdate = true;
    if (spires.instanceColor) spires.instanceColor.needsUpdate = true;
    group.add(spires);
  } else if (area.id === 'stunt_park') {
    const towerGeo = track(new THREE.CylinderGeometry(0.14, 0.22, 9.5, 8));
    const towerMat = track(
      new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.7, roughness: 0.35 }),
    );
    const lampGeo = track(new THREE.BoxGeometry(1.6, 0.45, 0.55));
    const lampMat = track(
      new THREE.MeshStandardMaterial({
        color: '#e0f2fe',
        emissive: '#38bdf8',
        emissiveIntensity: 1.4,
      }),
    );
    const archGeo = track(new THREE.TorusGeometry(8.2, 0.18, 6, 20, Math.PI));
    const archMat = track(
      new THREE.MeshStandardMaterial({
        color: '#22d3ee',
        emissive: '#06b6d4',
        emissiveIntensity: 0.7,
      }),
    );
    const towers = new THREE.InstancedMesh(towerGeo, towerMat, 28);
    const lamps = new THREE.InstancedMesh(lampGeo, lampMat, 28);
    const arches = new THREE.InstancedMesh(archGeo, archMat, 14);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 28; i++) {
      const d = (i / 28) * length;
      const side = i % 2 === 0 ? -1 : 1;
      const cx = getTrailCenterX(course.level, d);
      const wx = cx + side * 8.2;
      const wy = getBaseElevation(course.level, d);
      dummy.position.set(wx, wy + 4.5, -d);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      towers.setMatrixAt(i, dummy.matrix);

      dummy.position.set(wx - side * 0.4, wy + 9.1, -d);
      dummy.rotation.set(0.35, 0, side * 0.3);
      dummy.updateMatrix();
      lamps.setMatrixAt(i, dummy.matrix);

      if (i % 2 === 0) {
        dummy.position.set(cx, wy + 0.5, -d);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        arches.setMatrixAt(i / 2, dummy.matrix);
      }
    }
    towers.instanceMatrix.needsUpdate = true;
    lamps.instanceMatrix.needsUpdate = true;
    arches.instanceMatrix.needsUpdate = true;
    group.add(towers, lamps, arches);
  }

  // 7. Coins
  const coinGeo = track(new THREE.CylinderGeometry(0.36, 0.36, 0.08, 16));
  coinGeo.rotateX(Math.PI / 2);
  const coinMat = track(
    new THREE.MeshStandardMaterial({
      color: '#fbbf24',
      emissive: '#d97706',
      emissiveIntensity: 0.45,
      metalness: 0.85,
      roughness: 0.2,
    }),
  );
  for (const c of course.coins) {
    const cg = new THREE.Group();
    cg.add(new THREE.Mesh(coinGeo, coinMat));
    cg.position.set(c.x, c.y, c.z);
    group.add(cg);
    coinMeshes.set(c.id, cg);
  }

  // 8. Start Arch, Checkpoints (with side pennants) & Finish Arch
  const archPostMat = track(
    new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.5, roughness: 0.4 }),
  );
  const checkerTex = track(createCheckeredTexture(maxAnisotropy));
  const finishBannerMat = track(
    new THREE.MeshStandardMaterial({ map: checkerTex, roughness: 0.4 }),
  );
  const startGroup = new THREE.Group();
  const startX = getTrailCenterX(course.level, 6.5);
  const startY = getBaseElevation(course.level, 6.5);
  for (const side of [-1, 1]) {
    const sp = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.13, 0.17, 4.1, 10)),
      archPostMat,
    );
    sp.position.set(side * 2.85, 2.05, 0);
    startGroup.add(sp);
  }
  const startBar = new THREE.Mesh(
    track(new THREE.BoxGeometry(5.9, 0.48, 0.24)),
    finishBannerMat,
  );
  startBar.position.y = 3.95;
  const startTrim = new THREE.Mesh(
    track(new THREE.BoxGeometry(5.95, 0.1, 0.28)),
    lipMat,
  );
  startTrim.position.y = 3.68;
  startGroup.add(startBar, startTrim);
  startGroup.position.set(startX, startY, -6.5);
  group.add(startGroup);

  for (const cp of course.checkpoints) {
    const cpGroup = new THREE.Group();
    const badgeMat = track(
      new THREE.MeshStandardMaterial({
        color: '#22d3ee',
        emissive: '#0891b2',
        emissiveIntensity: 0.75,
      }),
    );
    checkpointBadges.set(cp.index, badgeMat);

    for (const side of [-1, 1]) {
      const pole = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.11, 0.14, 3.6, 10)),
        archPostMat,
      );
      pole.position.set(side * 2.45, 1.8, 0);
      cpGroup.add(pole);

      const pennant = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.65, 0.42, 0.06)),
        badgeMat,
      );
      pennant.position.set(side * 2.85, 3.05, 0);
      cpGroup.add(pennant);
    }
    const bar = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.16, 0.16, 5.2, 12)),
      badgeMat,
    );
    bar.rotation.z = Math.PI / 2;
    bar.position.y = 3.5;
    cpGroup.add(bar);

    cpGroup.position.set(cp.x, cp.y, cp.z);
    group.add(cpGroup);
  }

  // Finish Banner Arch
  const finX = getTrailCenterX(course.level, length);
  const finY = getBaseElevation(course.level, length);
  const finishGroup = new THREE.Group();
  for (const side of [-1, 1]) {
    const p = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.16, 0.2, 4.4, 12)),
      archPostMat,
    );
    p.position.set(side * 3.0, 2.2, 0);
    finishGroup.add(p);

    const fBeacon = new THREE.Mesh(
      track(new THREE.OctahedronGeometry(0.32, 0)),
      lipMat,
    );
    fBeacon.position.set(side * 3.0, 4.6, 0);
    finishGroup.add(fBeacon);
  }
  const banner = new THREE.Mesh(
    track(new THREE.BoxGeometry(6.4, 1.1, 0.25)),
    finishBannerMat,
  );
  banner.position.y = 4.1;
  finishGroup.add(banner);
  finishGroup.position.set(finX, finY, -length);
  group.add(finishGroup);

  return {
    group,
    areaSpec: area,
    coinMeshes,
    checkpointBadges,
    obstacleMeshes,
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
