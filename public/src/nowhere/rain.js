// HAUS NOWHERE — 성수 2041: 카메라 추종 인스턴스 강수 시스템 (빗줄기 6000 / 모바일 1800, 눈송이 공용).
// 단일 InstancedMesh (1 draw call), GLSL 정점 셰이더에서 cameraPosition 주변 박스 래핑 + FOG_GLSL 안개 적용.
import * as THREE from 'three';
import { FOG_GLSL } from './fog.js';

export function createRainSystem({ scene, sharedUniforms, count = 6000 }) {
  const baseGeom = new THREE.PlaneGeometry(1, 1);
  const instGeom = new THREE.InstancedBufferGeometry();
  instGeom.index = baseGeom.index;
  instGeom.attributes.position = baseGeom.attributes.position;
  instGeom.attributes.uv = baseGeom.attributes.uv;

  const offsets = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    // x, y, z 초기 오프셋 (-0.5..0.5) + w 위상 시드(0..1)
    offsets[i * 4 + 0] = Math.random() - 0.5;
    offsets[i * 4 + 1] = Math.random();
    offsets[i * 4 + 2] = Math.random() - 0.5;
    offsets[i * 4 + 3] = Math.random();
  }
  instGeom.setAttribute('aRainSeed', new THREE.InstancedBufferAttribute(offsets, 4));
  instGeom.instanceCount = count;

  const mat = new THREE.ShaderMaterial({
    name: 'NW_Precipitation',
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: sharedUniforms.uTime,
      uRain: sharedUniforms.uRain,
      uSnow: sharedUniforms.uSnow,
      uFogB: sharedUniforms.uFogB,
      uFogK: sharedUniforms.uFogK,
      uFogColor: sharedUniforms.uFogColor,
    },
    vertexShader: /* glsl */ `
      attribute vec4 aRainSeed;
      uniform float uTime;
      uniform float uRain;
      uniform float uSnow;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying float vAlpha;

      void main() {
        vUv = uv;
        float isSnow = step(uRain, uSnow);
        vec3 boxSize = vec3(76.0, 36.0, 76.0);

        float speed = mix(24.0, 2.6, isSnow) * (0.85 + 0.35 * aRainSeed.w);
        vec3 rel = aRainSeed.xyz * boxSize;
        rel.y = mod(aRainSeed.y * boxSize.y - uTime * speed, boxSize.y) - boxSize.y * 0.35;

        // 바람/흔들림
        if (isSnow > 0.5) {
          float phase = aRainSeed.w * 6.28318 + uTime * 1.6;
          rel.x += sin(phase) * 1.4;
          rel.z += cos(phase * 0.85) * 1.4;
        } else {
          rel.x += rel.y * 0.06;
        }

        // 카메라 주변 래핑
        vec3 worldCenter = cameraPosition + rel;
        worldCenter.x = cameraPosition.x + mod(worldCenter.x - cameraPosition.x + boxSize.x * 0.5, boxSize.x) - boxSize.x * 0.5;
        worldCenter.z = cameraPosition.z + mod(worldCenter.z - cameraPosition.z + boxSize.z * 0.5, boxSize.z) - boxSize.z * 0.5;

        // 빌보드 축
        vec3 toCam = cameraPosition - worldCenter;
        float dist = length(toCam);
        vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam + vec3(1e-4, 0.0, 0.0)));
        vec3 up = normalize(vec3(isSnow > 0.5 ? 0.0 : 0.06, 1.0, 0.0));

        float w = mix(0.018, 0.085, isSnow) * (0.8 + 0.4 * aRainSeed.w);
        float h = mix(0.95, 0.095, isSnow) * (0.8 + 0.4 * aRainSeed.w);

        vec3 wp = worldCenter + right * (position.x * w) + up * (position.y * h);
        vWorldPos = wp;

        float distFade = smoothstep(0.8, 3.2, dist) * (1.0 - smoothstep(26.0, 38.0, dist));
        vAlpha = distFade * max(uRain * 0.42, uSnow * 0.78);
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uRain;
      uniform float uSnow;
      uniform float uFogB;
      uniform float uFogK;
      uniform vec3 uFogColor;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying float vAlpha;

      ${FOG_GLSL}

      void main() {
        float isSnow = step(uRain, uSnow);
        float mask = 0.0;
        if (isSnow > 0.5) {
          float r = length(vUv - 0.5) * 2.0;
          mask = smoothstep(1.0, 0.15, r);
        } else {
          float xFade = 1.0 - abs(vUv.x - 0.5) * 2.0;
          float yFade = sin(vUv.y * 3.14159265);
          mask = xFade * yFade;
        }
        float alpha = vAlpha * mask;
        if (alpha < 0.01) discard;

        float fogF = heightFog(cameraPosition, vWorldPos, uFogB, uFogK);
        vec3 baseCol = mix(uFogColor * 1.18 + vec3(0.10, 0.13, 0.15), vec3(0.92, 0.93, 0.91), isSnow);
        vec3 col = mix(baseCol, uFogColor, fogF);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const mesh = new THREE.Mesh(instGeom, mat);
  mesh.name = 'NW_RainSnow';
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);

  function update() {
    const active = sharedUniforms.uRain.value > 0.01 || sharedUniforms.uSnow.value > 0.01;
    mesh.visible = active;
  }

  return { mesh, update };
}
