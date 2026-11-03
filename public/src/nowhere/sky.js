// HAUS NOWHERE — 성수 2041: 하늘 돔 셰이더 (지평선→천정 그라데이션 + 저주파 흐린 구름 결 + 지평선 안개 융합).
import * as THREE from 'three';

export function createSkyDome(sharedUniforms) {
  const skyUniforms = {
    uSkyHorizon: { value: new THREE.Color('#E7E9E4') },
    uSkyZenith: { value: new THREE.Color('#C5CFCF') },
    uSkyGround: { value: new THREE.Color('#3E423F') },
    uSkyCloudStrength: { value: 0.14 },
    uFogColor: sharedUniforms.uFogColor,
    uFogFarColor: sharedUniforms.uFogFarColor,
    uTime: sharedUniforms.uTime,
    uNight: sharedUniforms.uNight,
  };

  const geom = new THREE.SphereGeometry(7600, 48, 24);
  const mat = new THREE.ShaderMaterial({
    name: 'NW_SkyDome',
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: skyUniforms,
    vertexShader: /* glsl */ `
      varying vec3 vWorldDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(wp.xyz - cameraPosition);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSkyHorizon;
      uniform vec3 uSkyZenith;
      uniform vec3 uSkyGround;
      uniform float uSkyCloudStrength;
      uniform vec3 uFogColor;
      uniform vec3 uFogFarColor;
      uniform float uTime;
      uniform float uNight;
      varying vec3 vWorldDir;

      float hash2(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash2(i), hash2(i + vec2(1.0, 0.0)), u.x),
          mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * vnoise(p);
          p = p * 2.03 + vec2(17.1, 31.7);
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 dir = normalize(vWorldDir);
        float y = dir.y;
        float up = pow(max(y, 0.0), 0.68);
        vec3 sky = mix(uSkyHorizon, uSkyZenith, clamp(up / 0.62, 0.0, 1.0));

        // 저주파 층운(stratus) 구름 결
        if (y > 0.01) {
          vec2 uv = dir.xz / (y + 0.18) * 0.65 + vec2(uTime * 0.004, -uTime * 0.002);
          float c = fbm(uv) - 0.48;
          float fade = smoothstep(0.02, 0.28, y) * smoothstep(0.95, 0.35, y);
          sky *= 1.0 + c * uSkyCloudStrength * fade;
        }

        // 지평선 아래는 어두운 지면 반구색으로, 지평선 부근은 원경 안개색과 부드럽게 융합
        float below = smoothstep(0.0, -0.10, y);
        sky = mix(sky, mix(uSkyGround, vec3(0.04, 0.05, 0.07), uNight), below);

        float horizonHaze = exp(-abs(y) * 14.0);
        sky = mix(sky, mix(uSkyHorizon, uFogFarColor, 0.55), horizonHaze * 0.65);

        gl_FragColor = vec4(sky, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.name = 'NW_SkyDome';
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return { mesh, uniforms: skyUniforms };
}
