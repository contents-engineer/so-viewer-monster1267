// HAUS NOWHERE — 성수 2041: 후처리 파이프라인
// RenderPass → UnrealBloomPass(발광만, 높은 threshold, 데스크톱 전용) → GradePass(DS/DBH 색보정·분석 감광·그레인·비네팅) → OutputPass(AgX)
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const GradeShader = {
  name: 'NW_GradeShader',
  uniforms: {
    tDiffuse: { value: null },
    uSaturation: { value: 0.78 },
    uBlackLift: { value: 0.014 },
    uShadowTint: { value: new THREE.Color('#1F3A3F') },
    uShadowMix: { value: 0.22 },   // 섀도 청록 감광 세기(기상 프리셋 gradeShadow, 맑은 낮은 0)
    uHighlightTint: { value: new THREE.Color('#F4F1E6') },
    uGrain: { value: 0.016 },
    uVignette: { value: 0.22 },
    uAnalysis: { value: 0.0 },
    uTime: { value: 0.0 },
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
    uniform float uSaturation;
    uniform float uBlackLift;
    uniform vec3 uShadowTint;
    uniform float uShadowMix;
    uniform vec3 uHighlightTint;
    uniform float uGrain;
    uniform float uVignette;
    uniform float uAnalysis;
    uniform float uTime;
    varying vec2 vUv;

    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 col = max(texel.rgb, vec3(0.0));

      // 1) 섀도 청록(#1F3A3F) · 하이라이트 온백(#F4F1E6) 스플릿 틴트 + 블랙 리프트
      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      float shMask = 1.0 - smoothstep(0.0, 0.35, lum);
      float hiMask = smoothstep(0.35, 1.15, lum);
      col = mix(col, col * (uShadowTint * 2.1), shMask * uShadowMix);
      col *= mix(vec3(1.0), uHighlightTint, hiMask * 0.18);
      col = col + vec3(uBlackLift) * (1.0 - smoothstep(0.0, 0.25, lum));

      // 2) 채도 조절 (분석 모드 진입 시 채도 -30% 추가 감쇠)
      float sat = uSaturation * mix(1.0, 0.70, uAnalysis);
      float l2 = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = max(vec3(0.0), vec3(l2) + (col - vec3(l2)) * sat);

      // 3) 분석 모드 감광 (#0F1D33 알파 0.45)
      vec3 analysisTint = vec3(0.010, 0.032, 0.078); // #0F1D33 linear
      col = mix(col, mix(col * 0.55, analysisTint, 0.45), uAnalysis);

      // 4) 비네팅 & 필름 그레인
      vec2 d = vUv - 0.5;
      float vig = 1.0 - dot(d, d) * uVignette * 1.6;
      col *= clamp(vig, 0.65, 1.0);

      float n = (hash12(vUv * 1024.0 + fract(uTime * 7.13)) - 0.5) * uGrain;
      col = max(vec3(0.0), col + vec3(n));

      gl_FragColor = vec4(col, texel.a);
    }
  `,
};

export function createPostPipeline({ renderer, scene, camera, quality, sharedUniforms }) {
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 0.80;

  const size = new THREE.Vector2();
  renderer.getDrawingBufferSize(size);

  const renderTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType,
  });

  const composer = new EffectComposer(renderer, renderTarget);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  let bloomPass = null;
  if (quality.bloom) {
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(Math.max(1, size.x >> 1), Math.max(1, size.y >> 1)),
      0.28, // strength: 발광점 주변 은은한 번짐만
      0.55, // radius
      1.12, // threshold: 높은 문턱값으로 네온·발광만 반응
    );
    composer.addPass(bloomPass);
  }

  const gradePass = new ShaderPass(GradeShader);
  if (sharedUniforms) {
    gradePass.uniforms.uAnalysis = sharedUniforms.uAnalysis;
    gradePass.uniforms.uTime = sharedUniforms.uTime;
  }
  composer.addPass(gradePass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  function setSize(width, height, pixelRatio = renderer.getPixelRatio()) {
    composer.setPixelRatio(pixelRatio);
    composer.setSize(width, height);
  }

  return {
    composer,
    renderPass,
    bloomPass,
    gradePass,
    outputPass,
    setSize,
  };
}
