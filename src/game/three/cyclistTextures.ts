import * as THREE from 'three';

/**
 * Draws a crisp pro-team cycling jersey texture onto a reusable canvas.
 * UV convention on Lathe/cylindrical torso:
 *   u in [0..1]: wraps around torso (0.0 & 1.0 = +X right, 0.25 = -Z front, 0.5 = -X left, 0.75 = +Z back)
 *   v in [0..1]: 0 = bottom hem, 1 = collar
 */
export function drawJerseyCanvas(
  canvas: HTMLCanvasElement,
  jerseyHex: string,
  stripeHex: string,
): void {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d')!;

  // Base jersey fill
  ctx.fillStyle = jerseyHex;
  ctx.fillRect(0, 0, w, h);

  // Subtle breathable mesh micro-texture
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  for (let y = 0; y < h; y += 6) {
    const off = (y / 6) % 2 === 0 ? 0 : 3;
    for (let x = off; x < w; x += 6) {
      ctx.fillRect(x, y, 2, 2);
    }
  }

  // Dark ergonomic side panels (u around 0.0/1.0 right and 0.5 left)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.34)';
  ctx.fillRect(0, 0, w * 0.08, h);
  ctx.fillRect(w * 0.92, 0, w * 0.08, h);
  ctx.fillRect(w * 0.42, 0, w * 0.16, h);

  // Diagonal chest & back racing band
  ctx.fillStyle = stripeHex;
  ctx.fillRect(0, h * 0.36, w, h * 0.1);

  // Crisp secondary pin-stripe
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(0, h * 0.345, w, h * 0.014);
  ctx.fillRect(0, h * 0.465, w, h * 0.014);

  // Front full-length zipper line (center of -Z front -> u ~ 0.25)
  const frontX = w * 0.25;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
  ctx.fillRect(frontX - 3, h * 0.05, 6, h * 0.9);
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(frontX - 1, h * 0.06, 2, h * 0.88);

  // Subtle central back spine accent & 3 curved cycling pockets (u ~ 0.75)
  const backX = w * 0.75;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
  ctx.fillRect(backX - w * 0.025, h * 0.12, w * 0.05, h * 0.56);
  ctx.fillStyle = stripeHex;
  ctx.fillRect(backX - w * 0.01, h * 0.16, w * 0.02, h * 0.48);

  const pocketW = w * 0.22;
  const pocketX = backX - pocketW * 0.5;
  const pocketTop = h * 0.7;
  const pocketH = h * 0.2;

  const pGrad = ctx.createLinearGradient(0, pocketTop, 0, pocketTop + pocketH);
  pGrad.addColorStop(0, 'rgba(15, 23, 42, 0.35)');
  pGrad.addColorStop(0.25, 'rgba(15, 23, 42, 0.18)');
  pGrad.addColorStop(1, 'rgba(15, 23, 42, 0.42)');
  ctx.fillStyle = pGrad;
  ctx.fillRect(pocketX, pocketTop, pocketW, pocketH);

  // Reflective pocket trim & subtle seam lines
  ctx.fillStyle = stripeHex;
  ctx.fillRect(pocketX, pocketTop, pocketW, 4);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.48)';
  ctx.fillRect(pocketX + pocketW * 0.33, pocketTop, 3, pocketH);
  ctx.fillRect(pocketX + pocketW * 0.66, pocketTop, 3, pocketH);

  // Waist silicone gripper hem & collar trim
  ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
  ctx.fillRect(0, h - 18, w, 18);
  ctx.fillRect(0, 0, w, 14);
}

export function createJerseyTexture(
  jerseyHex: string,
  stripeHex: string,
): { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture } {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  drawJerseyCanvas(canvas, jerseyHex, stripeHex);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.flipY = false;
  return { canvas, texture };
}

export function drawShortsCanvas(
  canvas: HTMLCanvasElement,
  shortsHex: string,
  accentHex: string,
): void {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = shortsHex;
  ctx.fillRect(0, 0, w, h);

  // Matte lycra panel seams
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let y = 0; y < h; y += 4) {
    ctx.fillRect(0, y, w, 1);
  }
  // Contrast leg gripper cuff near bottom of shorts
  ctx.fillStyle = accentHex;
  ctx.fillRect(0, h * 0.86, w, h * 0.08);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(0, h * 0.94, w, h * 0.06);
}

export function createShortsTexture(
  shortsHex: string,
  accentHex: string,
): { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture } {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  drawShortsCanvas(canvas, shortsHex, accentHex);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.flipY = false;
  return { canvas, texture };
}

export function createTireTreadTextures(): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const w = 256;
  const h = 128;

  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = w;
  mapCanvas.height = h;
  const mCtx = mapCanvas.getContext('2d')!;
  mCtx.fillStyle = '#181a20';
  mCtx.fillRect(0, 0, w, h);

  // Subtle dark-slate sidewall band
  mCtx.fillStyle = '#252833';
  mCtx.fillRect(0, 0, w, 18);
  mCtx.fillRect(0, h - 18, w, 18);

  // Chevron tread grooves
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = w;
  bumpCanvas.height = h;
  const bCtx = bumpCanvas.getContext('2d')!;
  bCtx.fillStyle = '#b4b4b4';
  bCtx.fillRect(0, 0, w, h);
  bCtx.strokeStyle = '#303030';
  bCtx.lineWidth = 4;

  for (let x = 0; x < w; x += 16) {
    mCtx.strokeStyle = 'rgba(0,0,0,0.45)';
    mCtx.lineWidth = 3;
    mCtx.beginPath();
    mCtx.moveTo(x, h * 0.22);
    mCtx.lineTo(x + 8, h * 0.5);
    mCtx.lineTo(x, h * 0.78);
    mCtx.stroke();

    bCtx.beginPath();
    bCtx.moveTo(x, h * 0.22);
    bCtx.lineTo(x + 8, h * 0.5);
    bCtx.lineTo(x, h * 0.78);
    bCtx.stroke();
  }

  const map = new THREE.CanvasTexture(mapCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(8, 1);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(8, 1);

  return { map, bumpMap };
}
