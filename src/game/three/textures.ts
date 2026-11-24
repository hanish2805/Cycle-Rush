import * as THREE from 'three';
import type { EnvironmentSpec } from '../types';

export function createRoadTextures(
  env: EnvironmentSpec,
  maxAnisotropy: number,
): { map: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } {
  const width = 512;
  const height = 512;

  // Color / Albedo canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Base road fill
  ctx.fillStyle = env.roadBaseHex;
  ctx.fillRect(0, 0, width, height);

  // Subtle asphalt aggregate noise
  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const v = Math.random() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v},${v},${0.035 + Math.random() * 0.045})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Shoulders (left & right 8% edge)
  ctx.fillStyle = env.shoulderHex;
  ctx.fillRect(0, 0, 34, height);
  ctx.fillRect(width - 34, 0, 34, height);

  // Painted curb rumble blocks along shoulder borders
  const rumbleCount = 8;
  const rumbleStep = height / rumbleCount;
  for (let i = 0; i < rumbleCount; i++) {
    const even = i % 2 === 0;
    ctx.fillStyle = env.isNight
      ? even
        ? env.accentHex
        : '#1e293b'
      : even
        ? '#dc2626'
        : '#f8fafc';
    ctx.fillRect(28, i * rumbleStep, 8, rumbleStep);
    ctx.fillRect(width - 36, i * rumbleStep, 8, rumbleStep);
  }

  // Outer solid edge lines
  ctx.fillStyle = env.isNight ? env.accentHex : '#e2e8f0';
  ctx.fillRect(38, 0, 8, height);
  ctx.fillRect(width - 46, 0, 8, height);

  // 2 inner dashed lane dividers + glowing/reflective cat-eye studs
  const lane1X = Math.round(width * 0.355);
  const lane2X = Math.round(width * 0.645);
  const dashCount = 4;
  const step = height / dashCount;
  for (let i = 0; i < dashCount; i++) {
    const y = i * step + 18;
    ctx.fillStyle = env.roadLineHex;
    ctx.fillRect(lane1X - 4, y, 8, step * 0.54);
    ctx.fillRect(lane2X - 4, y, 8, step * 0.54);

    // Reflective cat-eye stud between dashes
    const studY = i * step + 4;
    ctx.fillStyle = env.isNight ? env.accentHex : '#fde047';
    ctx.fillRect(lane1X - 3, studY, 6, 8);
    ctx.fillRect(lane2X - 3, studY, 6, 8);
  }

  // Subtle tire-wear track darkening in the 3 lane centers
  const trackCenters = [width * 0.21, width * 0.5, width * 0.79];
  for (const cx of trackCenters) {
    const grad = ctx.createLinearGradient(cx - 28, 0, cx + 28, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0.18)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - 28, 0, 56, height);
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = maxAnisotropy;

  // Roughness canvas (wet reflections in neon_night, drier coarse tarmac in daylight)
  const rCanvas = document.createElement('canvas');
  rCanvas.width = 256;
  rCanvas.height = 256;
  const rCtx = rCanvas.getContext('2d')!;
  rCtx.fillStyle = env.isNight ? '#444444' : '#cccccc';
  rCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2500; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const lum = env.isNight ? 45 + Math.random() * 90 : 170 + Math.random() * 65;
    rCtx.fillStyle = `rgb(${lum},${lum},${lum})`;
    rCtx.fillRect(x, y, 3, 3);
  }
  const roughnessMap = new THREE.CanvasTexture(rCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;

  return { map, roughnessMap };
}

export function createHazardStripeTexture(
  colorA: string,
  colorB: string,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = colorA;
  ctx.fillRect(0, 0, 256, 64);

  ctx.fillStyle = colorB;
  for (let x = -64; x < 320; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 64);
    ctx.lineTo(x + 24, 64);
    ctx.lineTo(x + 56, 0);
    ctx.lineTo(x + 32, 0);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createWoodCrateTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#9a6b3b';
  ctx.fillRect(0, 0, 256, 256);

  // Horizontal planks
  for (let y = 0; y < 256; y += 64) {
    ctx.fillStyle = y % 128 === 0 ? '#a87642' : '#8e6134';
    ctx.fillRect(0, y, 256, 62);
    ctx.fillStyle = '#4e3319';
    ctx.fillRect(0, y + 61, 256, 3);
  }
  // Grain streaks
  for (let i = 0; i < 240; i++) {
    ctx.fillStyle = 'rgba(55, 34, 15, 0.14)';
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 36 + Math.random() * 40, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createBuildingFacadeTexture(
  isNight: boolean,
  accentHex: string,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = isNight ? '#0f172a' : '#475569';
  ctx.fillRect(0, 0, 256, 512);

  // Architectural floor spandrel bands
  for (let y = 0; y < 512; y += 36) {
    ctx.fillStyle = isNight ? '#172554' : '#334155';
    ctx.fillRect(0, y, 256, 5);
  }

  const cols = 6;
  const rows = 14;
  const padX = 12;
  const padY = 14;
  const w = (256 - padX * (cols + 1)) / cols;
  const h = (512 - padY * (rows + 1)) / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = padX + c * (w + padX);
      const wy = padY + r * (h + padY);
      const isStorefront = r >= rows - 1;
      const lit = isStorefront || Math.random() > (isNight ? 0.32 : 0.62);
      if (isNight) {
        ctx.fillStyle = lit
          ? isStorefront
            ? accentHex
            : Math.random() > 0.7
              ? accentHex
              : '#fef08a'
          : '#1e293b';
      } else {
        ctx.fillStyle = lit
          ? isStorefront
            ? '#fde68a'
            : '#bae6fd'
          : '#334155';
      }
      ctx.fillRect(wx, wy, w, h);

      // Subtle window mullion frame
      ctx.fillStyle = isNight ? 'rgba(15,23,42,0.55)' : 'rgba(30,41,59,0.45)';
      ctx.fillRect(wx + w * 0.46, wy, 2, h);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0,0,0,0.65)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.28)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
