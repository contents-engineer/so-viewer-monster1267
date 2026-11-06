// HAUS NOWHERE — 성수 2041: 하늘 돔 셰이더 (지평선→천정 그라데이션 + 저주파 흐린 구름 결 + 지평선 안개 융합).
// DS2: uSunHaze > 0 이면 해 주변 헤이즈·코로나·원반과 옅은 22° 무리(참조 화면 오른쪽 위 무지개빛 호)를 더한다.
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
    uSunDir: sharedUniforms.uSunDir,
    uSunHaze: sharedUniforms.uSunHaze,
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
      uniform vec3 uSunDir;
      uniform float uSunHaze;
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

        // 역광 태양 헤이즈(넓은 번짐 + 좁은 코로나 + 원반) — 구름 너머 해가 하늘을 하얗게 태운다
        if (uSunHaze > 0.001) {
          float c = max(dot(dir, normalize(uSunDir)), 0.0);
          vec3 sunCol = vec3(1.0, 0.95, 0.87);
          float glow = 0.42 * pow(c, 6.0) + 0.85 * pow(c, 48.0) + 4.0 * pow(c, 2400.0);
          sky += sunCol * glow * uSunHaze * (1.0 - below) * (1.0 - uNight);
          // 22° 무리: 아주 옅은 분광 호(바깥 붉은 → 안쪽 푸른)
          float ang = acos(clamp(dot(dir, normalize(uSunDir)), -1.0, 1.0));
          float t = (ang - 0.384) / 0.009;        // 폭 ≈0.5° 의 가는 띠, 바깥 붉은 → 안쪽 푸른
          vec3 spec = vec3(exp(-pow(t - 1.6, 2.0)), exp(-pow(t, 2.0)) * 0.8, exp(-pow(t + 1.6, 2.0)));
          // 해 위쪽 호만 보이게(참조 화면 오른쪽 위 무지개빛 호), 지평선 쪽으로 사라진다
          float arc = smoothstep(0.05, 0.35, y);
          sky += (spec - vec3(0.25) * exp(-t * t * 0.15)) * 0.05 * arc * uSunHaze * (1.0 - below) * (1.0 - uNight);
        }

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
