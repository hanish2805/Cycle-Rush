import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import type { MotionBlurState } from '../motionBlur';

const MotionBlurShader = {
  name: 'CycleRushMotionBlurShader',
  uniforms: {
    tDiffuse: { value: null },
    uIntensity: { value: 0.0 },
    uRadialStrength: { value: 0.0 },
    uVelocity: { value: new THREE.Vector2(0, 0) },
    uFocal: { value: new THREE.Vector2(0.5, 0.56) },
    uChroma: { value: 0.0 },
    uAspect: { value: 1.777 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uIntensity;
    uniform float uRadialStrength;
    uniform vec2 uVelocity;
    uniform vec2 uFocal;
    uniform float uChroma;
    uniform float uAspect;
    varying vec2 vUv;

    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      if (uIntensity <= 0.002) {
        gl_FragColor = base;
        return;
      }

      // Aspect-corrected vector from speed focal point so the center cyclist silhouette remains sharp
      vec2 delta = vUv - uFocal;
      vec2 aspectDelta = vec2(delta.x * uAspect, delta.y);
      float dist = length(aspectDelta);

      // Clear center protection zone around the rider, ramping cleanly toward peripheral road/scenery
      float radialMask = smoothstep(0.14, 0.68, dist);
      vec2 radialDir = dist > 0.0001 ? (delta / max(dist, 0.001)) * dist : vec2(0.0);

      vec2 blurStep = (radialDir * uRadialStrength * radialMask) + (uVelocity * (0.35 + 0.65 * radialMask));

      // Guard against tiny zero vectors
      if (dot(blurStep, blurStep) < 1e-9) {
        gl_FragColor = base;
        return;
      }

      // 8-tap directional + radial gather with interleaved gradient noise to eliminate banding
      float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
      vec3 accum = base.rgb;
      float totalWeight = 1.0;

      const int SAMPLES = 8;
      for (int i = 1; i <= SAMPLES; i++) {
        float t = (float(i) + jitter * 0.45) / float(SAMPLES);
        float w = 1.0 - t * 0.55;
        vec2 sampleUv = clamp(vUv - blurStep * t, vec2(0.001), vec2(0.999));
        accum += texture2D(tDiffuse, sampleUv).rgb * w;
        totalWeight += w;
      }

      vec3 blurred = accum / totalWeight;

      // Subtle peripheral chromatic speed fringe only during boost / extreme velocity
      if (uChroma > 0.005) {
        vec2 chromaOffset = radialDir * uChroma * 0.0045 * radialMask;
        float r = texture2D(tDiffuse, clamp(vUv + chromaOffset, vec2(0.001), vec2(0.999))).r;
        float b = texture2D(tDiffuse, clamp(vUv - chromaOffset, vec2(0.001), vec2(0.999))).b;
        blurred.r = mix(blurred.r, r, 0.35 * radialMask);
        blurred.b = mix(blurred.b, b, 0.35 * radialMask);
      }

      gl_FragColor = vec4(mix(base.rgb, blurred, clamp(uIntensity, 0.0, 1.0)), base.a);
    }
  `,
};

export function createMotionBlurPass(): ShaderPass {
  const pass = new ShaderPass(MotionBlurShader);
  pass.renderToScreen = false;
  return pass;
}

export function syncMotionBlurPass(
  pass: ShaderPass,
  state: MotionBlurState,
  aspect: number,
): void {
  pass.uniforms.uIntensity.value = state.intensity;
  pass.uniforms.uRadialStrength.value = state.radialStrength;
  (pass.uniforms.uVelocity.value as THREE.Vector2).set(state.velocityX, state.velocityY);
  (pass.uniforms.uFocal.value as THREE.Vector2).set(state.focalX, state.focalY);
  pass.uniforms.uChroma.value = state.chromaAmount;
  pass.uniforms.uAspect.value = Math.max(0.5, aspect);
}
