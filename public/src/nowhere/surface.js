// HAUS NOWHERE — 성수 2041: MeshStandardMaterial.onBeforeCompile 표면 셰이더 패치.
// 역할:
//   - 정점색 COLOR_0('color')을 알베도 곱으로 쓰지 않고 'nwMask'(R=이끼, G=젖음, B=AO) 속성으로 이관
//   - 지면(ground): 2048px 마스크 텍스처(uGroundMask: R=이끼, G=젖음, B=AO, A=웅덩이) 샘플링
//   - 젖음 어두워짐, 이끼 군락, 웅덩이 거울 반사(roughness 0.04) + 빗물 동심원 파문(uRain)
//   - 눈 덮임(uSnow, 월드 법선 상향면), 구운 AO 반영, 높이 지수 안개(FOG_GLSL), 분석 모드 스캔 펄스(uScan*)
import * as THREE from 'three';
import { FOG_GLSL } from './fog.js';

export const ALLOWED_SURFACES = new Set([
  'ground',
  'wall',
  'rock',
  'metal',
  'glass',
  'water',
  'emissive',
  'holo',
  'foliage',
  'building',
]);

export function createSharedUniforms(groundMaskTex = null, maskRect = [-170, -210, 220, 210]) {
  return {
    uWet: { value: 0.55 },
    uRain: { value: 0.0 },
    uSnow: { value: 0.0 },
    uMoss: { value: 1.0 },
    uMossColor: { value: new THREE.Color('#475325') },
    uSnowColor: { value: new THREE.Color('#E8E8E4') },
    uTime: { value: 0.0 },
    uFogB: { value: 0.0026 },
    uFogK: { value: 0.045 },
    uFogColor: { value: new THREE.Color('#D2D9D7') },
    uFogFarColor: { value: new THREE.Color('#C4CDCF') },
    uSunDir: { value: new THREE.Vector3(-0.47, 0.56, 0.68).normalize() },
    uEmitGain: { value: 0.3 },
    uNight: { value: 0.0 },
    uAnalysis: { value: 0.0 },
    uScanCenter: { value: new THREE.Vector3(0, 0, 0) },
    uScanRadius: { value: -10.0 },
    uScanWidth: { value: 18.0 },
    uGroundMask: { value: groundMaskTex },
    // 월드별 룩(성수 기본값 = 이전과 동일). DS2 는 world.js 가 덮어쓴다.
    uSunHaze: { value: 0.0 },                                  // 해 쪽 하늘·안개 산란광 세기
    uMossSoft: { value: 0.0 },                                 // 0 = 경계가 또렷한 이끼 얼룩, 1 = 부드러운 풀·이끼 피복
    uMossColor2: { value: new THREE.Color('#6E7A30') },       // 황록 풀 끝(밝은 반점)
    uHeatherColor: { value: new THREE.Color('#5A3426') },     // 적갈색 히스·고산 식물 반점
    uPudColor: { value: new THREE.Color(0.54, 0.62, 0.66) },  // 웅덩이·수면 반사 기본색
    uPudMetal: { value: 0.88 },
    uMaskRect: {
      value: new THREE.Vector4(maskRect[0], maskRect[1], maskRect[2], maskRect[3]),
    },
  };
}

/**
 * 메시의 COLOR_0('color') 정점 속성을 'nwMask' 로 옮기고 기본 vertexColors 알베도 곱을 끈다.
 */
export function prepareMeshAttributes(mesh) {
  const geom = mesh.geometry;
  if (!geom) return false;
  if (geom.attributes.color && !geom.attributes.nwMask) {
    geom.setAttribute('nwMask', geom.attributes.color);
    geom.deleteAttribute('color');
  }
  return Boolean(geom.attributes.nwMask);
}

/**
 * 객체/메시/재질의 userData 에서 nw_surface 태그를 결정한다.
 */
export function resolveSurfaceType(obj, mat, fallback = 'wall') {
  const candidates = [
    obj?.userData?.nw_surface,
    obj?.parent?.userData?.nw_surface,
    obj?.geometry?.userData?.nw_surface,
    mat?.userData?.nw_surface,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && ALLOWED_SURFACES.has(c)) return c;
  }
  return fallback;
}

const SURFACE_KIND_ID = {
  ground: 1,
  wall: 2,
  rock: 3,
  metal: 4,
  glass: 5,
  water: 6,
  emissive: 7,
  holo: 8,
  foliage: 9,
  building: 10,
};

export function patchSurfaceMaterial(material, surfaceType, sharedUniforms, hasVertexMask = false) {
  if (!material || !material.isMeshStandardMaterial) return material;

  const surface = ALLOWED_SURFACES.has(surfaceType) ? surfaceType : 'wall';
  const kindId = SURFACE_KIND_ID[surface] || 2;
  material.vertexColors = false;
  material.userData.nw_surface = surface;

  // 재질별 발광 구분:
  //   - windowEmit (1: HAUS 창문 Glass/GM_Glass_middle, 2: 성수 주변 건물 창문 NW_glass_window)
  //   - nightOnlyEmit: 낮(흐림)에는 꺼져 있고 황혼·밤(uNight > 0)에만 켜지는 간판·원경 창문·안구
  //   - alwaysEmit: 낮에도 은은히 켜져 있고 밤에 강해지는 근미래 LED·스크린·키오스크·홀로그램
  const matName = material.name || '';
  const isHausWindow = matName === 'Glass' || matName === 'GM_Glass_middle';
  const isPresentWindow = matName === 'NW_glass_window';
  const windowEmitKind = isHausWindow ? 1 : isPresentWindow ? 2 : 0;

  if (matName.includes('eyeball') && (!material.emissive || material.emissive.getHex() === 0)) {
    material.emissive = new THREE.Color('#CFE6FF');
    material.emissiveIntensity = 1.1;
  }

  const isAlwaysEmit =
    surface === 'emissive' ||
    surface === 'holo' ||
    matName.startsWith('NWF_led') ||
    matName.startsWith('NWF_holo') ||
    matName.startsWith('NWF_screen') ||
    matName.startsWith('NWF_kiosk') ||
    matName.startsWith('NWF_taxi_display') ||
    matName.startsWith('NWF_ui') ||
    matName.startsWith('NWF_display') ||
    matName.startsWith('NWF_beam');

  const isNightOnlyEmit =
    !isAlwaysEmit &&
    (windowEmitKind > 0 ||
      Boolean(material.emissiveMap) ||
      Boolean(material.userData?.nw_night) ||
      matName === 'NWB_city' ||
      matName === 'NW_sign_letters' ||
      matName.includes('eyeball'));

  if (surface === 'holo') {
    material.transparent = true;
    material.depthWrite = false;
  }

  // 드론 서치라이트 원뿔(NWF_beam*): 홀로그램 주사선 대신 가산 광주(光柱). 광원 쪽이 밝고 멀어질수록·윤곽으로 갈수록
  // 사라지며, 흐린 낮에는 보이지 않고 밤·비(타임폴)에만 드러난다. Blender NWF_beam_cone(가산 투명 + 축 방향 감쇠)과 같은 읽기.
  const isBeam = matName.startsWith('NWF_beam');
  if (isBeam) {
    material.transparent = true;
    material.depthWrite = false;
    material.blending = THREE.AdditiveBlending;
    material.side = THREE.DoubleSide;
  }

  const cacheKey = `nw_v4_${surface}_${hasVertexMask ? 1 : 0}_${isAlwaysEmit ? 1 : 0}_${isNightOnlyEmit ? 1 : 0}_${windowEmitKind}_${isBeam ? 1 : 0}`;
  material.customProgramCacheKey = () => cacheKey;

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, sharedUniforms);
    shader.uniforms.uNwSurfaceKind = { value: kindId };
    shader.uniforms.uNwHasVertMask = { value: hasVertexMask ? 1.0 : 0.0 };
    shader.uniforms.uNwAlwaysEmit = { value: isAlwaysEmit ? 1.0 : 0.0 };
    shader.uniforms.uNwNightOnlyEmit = { value: isNightOnlyEmit ? 1.0 : 0.0 };
    shader.uniforms.uNwWindowKind = { value: windowEmitKind };
    shader.uniforms.uNwBeam = { value: isBeam ? 1.0 : 0.0 };
    shader.uniforms.uNwBeamLen = { value: material.userData.nwBeamLen || 1.0 };   // world.js 가 꼭짓점→열린 끝 길이로 채운다
    shader.uniforms.uNwBeamApex = { value: new THREE.Vector3().fromArray(material.userData.nwBeamApex || [0, 0, 0]) };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `
#include <common>
${hasVertexMask ? 'attribute vec4 nwMask;' : ''}
varying vec3 vNwWorld;
varying vec3 vNwWorldNormal;
varying vec4 vNwMask;
varying float vNwBeamDist;
uniform vec3 uNwBeamApex;
`,
      )
      .replace(
        '#include <project_vertex>',
        /* glsl */ `
#include <project_vertex>
{
  vec4 nwWp = vec4(transformed, 1.0);
  #ifdef USE_BATCHING
    nwWp = batchingMatrix * nwWp;
  #endif
  #ifdef USE_INSTANCING
    nwWp = instanceMatrix * nwWp;
  #endif
  nwWp = modelMatrix * nwWp;
  vNwWorld = nwWp.xyz;

  vec3 nwWn = objectNormal;
  #ifdef USE_INSTANCING
    nwWn = mat3(instanceMatrix) * nwWn;
  #endif
  vNwWorldNormal = normalize(mat3(modelMatrix) * nwWn);
  vNwMask = ${hasVertexMask ? 'nwMask' : 'vec4(0.0, 0.25, 1.0, 0.0)'};
  vNwBeamDist = length(position - uNwBeamApex);   // 원뿔 꼭짓점(드론)에서의 거리, 메시 로컬 단위
}
`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `
#include <common>
uniform float uWet;
uniform float uRain;
uniform float uSnow;
uniform float uMoss;
uniform vec3 uMossColor;
uniform vec3 uSnowColor;
uniform float uTime;
uniform float uFogB;
uniform float uFogK;
uniform vec3 uFogColor;
uniform vec3 uFogFarColor;
uniform vec3 uSunDir;
uniform float uEmitGain;
uniform float uNight;
uniform float uAnalysis;
uniform vec3 uScanCenter;
uniform float uScanRadius;
uniform float uScanWidth;
uniform sampler2D uGroundMask;
uniform vec4 uMaskRect;
uniform float uSunHaze;
uniform float uMossSoft;
uniform vec3 uMossColor2;
uniform vec3 uHeatherColor;
uniform vec3 uPudColor;
uniform float uPudMetal;
uniform int uNwSurfaceKind;
uniform float uNwHasVertMask;
uniform float uNwAlwaysEmit;
uniform float uNwNightOnlyEmit;
uniform int uNwWindowKind;
uniform float uNwBeam;
uniform float uNwBeamLen;

varying vec3 vNwWorld;
varying vec3 vNwWorldNormal;
varying vec4 vNwMask;
varying float vNwBeamDist;

float nwHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float nwNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = nwHash(i);
  float b = nwHash(i + vec2(1.0, 0.0));
  float c = nwHash(i + vec2(0.0, 1.0));
  float d = nwHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

vec4 nwSampleMask() {
  // ground(1) 이고 정점 마스크가 없는 광역 노면은 구운 2048 마스크 텍스처를 읽는다.
  if (uNwSurfaceKind == 1 && uNwHasVertMask < 0.5) {
    vec2 uv = vec2(
      (vNwWorld.x - uMaskRect.x) / max(1.0, uMaskRect.z - uMaskRect.x),
      (-vNwWorld.z - uMaskRect.y) / max(1.0, uMaskRect.w - uMaskRect.y)
    );
    if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) {
      return texture2D(uGroundMask, uv);
    }
  }
  return vNwMask;
}

vec2 nwPuddleRipple(vec2 xz, float time) {
  vec2 p = xz * 2.2;
  vec2 cell = floor(p);
  vec2 f = fract(p) - 0.5;
  float h = nwHash(cell);
  float t = fract(time * 1.45 + h);
  float r = length(f);
  float ring = sin((r - t * 0.45) * 38.0) * exp(-r * 6.5) * (1.0 - t);
  vec2 dir = r > 1e-4 ? f / r : vec2(0.0);
  return dir * ring * 0.06;
}

${FOG_GLSL}
`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `
#include <roughnessmap_fragment>
vec4 nwM = nwSampleMask();
float nwSplash = smoothstep(1.35, 0.0, vNwWorld.y) * 0.45;
float nwBaseWet = (uNwSurfaceKind == 10) ? nwSplash : nwM.g;
float nwWet = clamp(uWet * (nwBaseWet + 0.35 * (1.0 - nwM.b) + nwSplash * 0.5), 0.0, 1.0);
float nwPud = (uNwSurfaceKind == 1)
  ? smoothstep(0.18, 0.48, nwM.a) * uWet
  : 0.0;
if (uNwSurfaceKind == 6) {
  nwWet = 1.0;
  nwPud = 1.0;
}
float nwPudRough = mix(0.035, 0.09, uMossSoft);   // DS2 개울은 잔물결로 반사가 조금 흐려진다

// 젖으면 다공질 표면 알베도가 어두워진다 (유리·발광·홀로그램 제외)
if (uNwSurfaceKind != 5 && uNwSurfaceKind != 7 && uNwSurfaceKind != 8) {
  float darkMul = (uNwSurfaceKind == 1 || uNwSurfaceKind == 3) ? 0.42 : 0.60;
  diffuseColor.rgb *= mix(1.0, darkMul, nwWet);
}

// 이끼 군락 (ground, wall, rock, foliage — 물웅덩이·수로(nwPud) 구간은 이끼가 덮지 않도록 마스킹)
float nwMossCover = 0.0;
if (uNwSurfaceKind == 1 || uNwSurfaceKind == 2 || uNwSurfaceKind == 3) {
  float mossN = nwNoise(vNwWorld.xz * 0.8);
  float mossHard = step(0.55, nwM.r + 0.25 * nwNoise(vNwWorld.xz * 3.1));
  // DS2: 원거리에서 점묘처럼 깨지지 않는 부드러운 피복 경계(저주파 + 고주파 흔들림)
  float mossSoftV = smoothstep(0.36, 0.62, nwM.r + 0.16 * (nwNoise(vNwWorld.xz * 0.9) - 0.5) + 0.10 * (nwNoise(vNwWorld.xz * 3.1) - 0.5));
  float mossEdge = mix(mossHard, mossSoftV, uMossSoft) * uMoss * (1.0 - uSnow * 0.8) * (1.0 - smoothstep(0.12, 0.42, nwPud));
  vec3 mossCol = uMossColor * (0.7 + 0.6 * mossN);
  if (uMossSoft > 0.001) {
    // 참조 화면의 계곡 바닥: 짙은 초록 이끼 ↔ 황록 풀 끝 얼룩 + 드문드문 적갈색 히스
    float g1 = nwNoise(vNwWorld.xz * 0.21 + 3.7);
    float g2 = nwNoise(vNwWorld.xz * 1.9 + 11.0);
    vec3 grass = mix(uMossColor, uMossColor2, smoothstep(0.38, 0.85, g1 * 0.65 + g2 * 0.35));
    float heather = smoothstep(0.80, 0.93, nwNoise(vNwWorld.xz * 1.3 + 5.0)) * smoothstep(0.35, 0.7, nwM.r);
    grass = mix(grass, uHeatherColor, heather * 0.55);
    mossCol = mix(mossCol, grass * (0.78 + 0.44 * nwNoise(vNwWorld.xz * 5.3)), uMossSoft);
  }
  diffuseColor.rgb = mix(diffuseColor.rgb, mossCol, mossEdge * 0.88);
  roughnessFactor = mix(roughnessFactor, 0.88, mossEdge);
  nwMossCover = mossEdge;
}

// 눈 덮임 (윗면 법선)
float nwSnowMask = uSnow * smoothstep(0.52, 0.82, vNwWorldNormal.y) * (1.0 - nwPud * 0.85);
if (uNwSurfaceKind != 5 && uNwSurfaceKind != 7 && uNwSurfaceKind != 8) {
  diffuseColor.rgb = mix(diffuseColor.rgb, uSnowColor, nwSnowMask * 0.88);
  // DS2: 풀·이끼 피복은 젖어도 유리처럼 번쩍이지 않는다(역광에서 하얀 반사광 방지) — 성수(uMossSoft=0)는 그대로
  roughnessFactor = mix(roughnessFactor, 0.15, nwWet * (1.0 - nwSnowMask) * (1.0 - 0.8 * nwMossCover * uMossSoft));
  roughnessFactor = mix(roughnessFactor, nwPudRough, nwPud);
  roughnessFactor = mix(roughnessFactor, 0.62, nwSnowMask);
}
`,
      )
      .replace(
        '#include <metalnessmap_fragment>',
        /* glsl */ `
#include <metalnessmap_fragment>
if (nwPud > 0.02) {
  float pudMirror = clamp(nwPud * (1.0 - nwSnowMask), 0.0, 1.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, uPudColor, pudMirror * 0.82);
  metalnessFactor = mix(metalnessFactor, uPudMetal, pudMirror);
}
`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `
#include <normal_fragment_maps>
if (nwPud > 0.05) {
  vec3 flatUp = normalize(mat3(viewMatrix) * vec3(0.0, 1.0, 0.0));
  if (uRain > 0.02) {
    vec2 rip = nwPuddleRipple(vNwWorld.xz, uTime) * uRain;
    flatUp = normalize(mat3(viewMatrix) * normalize(vec3(rip.x, 1.0, rip.y)));
  } else if (uNwSurfaceKind == 6 && uMossSoft > 0.001) {
    // DS2 개울: 흐르는 잔물결 법선 → 하늘·암벽 반사가 띠 모양으로 일렁인다(참조 화면의 반짝이는 여울)
    vec2 q = vNwWorld.xz * vec2(0.55, 0.28) + vec2(0.0, uTime * 0.5);
    float e = 0.2;
    float n0 = nwNoise(q) + 0.5 * nwNoise(q * 2.7 + 3.1);
    float nx = nwNoise(q + vec2(e, 0.0)) + 0.5 * nwNoise((q + vec2(e, 0.0)) * 2.7 + 3.1);
    float nz = nwNoise(q + vec2(0.0, e)) + 0.5 * nwNoise((q + vec2(0.0, e)) * 2.7 + 3.1);
    vec2 grad = vec2(nx - n0, nz - n0) / e;
    flatUp = normalize(mat3(viewMatrix) * normalize(vec3(-grad.x * 0.16, 1.0, -grad.y * 0.16)));
  }
  normal = normalize(mix(normal, flatUp, clamp(nwPud * 1.15, 0.0, 0.96)));
}
`,
      )
      .replace(
        '#include <aomap_fragment>',
        /* glsl */ `
#include <aomap_fragment>
{
  float bakedAo = clamp(nwM.b, 0.18, 1.0);
  reflectedLight.indirectDiffuse *= mix(1.0, bakedAo, 0.78);
  reflectedLight.indirectSpecular *= mix(1.0, bakedAo, 0.55);
  // DS2 풀·이끼: 잎 사이 미세 차폐로 하늘 정반사가 거의 없다(스침각 우윳빛 방지)
  reflectedLight.indirectSpecular *= 1.0 - 0.7 * nwMossCover * uMossSoft;
  reflectedLight.directSpecular *= 1.0 - 0.8 * nwMossCover * uMossSoft;   // 역광 스침각 태양 정반사(우윳빛 번들거림) 억제
  if (uNwSurfaceKind == 6) reflectedLight.directSpecular *= 1.0 - 0.8 * uMossSoft;   // DS2 개울: 해 반사 점광을 여울 반짝임 정도로
  if (uNwBeam > 0.5) {
    reflectedLight.directDiffuse = vec3(0.0);
    reflectedLight.directSpecular = vec3(0.0);
    reflectedLight.indirectDiffuse = vec3(0.0);
    reflectedLight.indirectSpecular = vec3(0.0);
  }
}
`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `
#include <emissivemap_fragment>
if (uNwWindowKind == 1) {
  // HAUS NOWHERE 창문: 층별(약 5.0m)·베이별(약 3.6m)로 서로 다른 밝기와 따뜻한 실내광 발광
  float floorIdx = floor(vNwWorld.y / 5.0);
  float bayIdx = floor(vNwWorld.x / 3.6) + floor(vNwWorld.z / 3.6) * 19.0;
  float h1 = nwHash(vec2(bayIdx, floorIdx));
  float h2 = nwHash(vec2(floorIdx * 3.7 + 1.3, bayIdx * 2.1 + 0.7));
  // 약 82% 의 창은 켜지고 18% 는 은은한 잔광만 남김
  float roomOn = (h1 > 0.18) ? (0.48 + 0.92 * h2) : 0.08;
  // 중층 커튼월(29m~60m) 구간은 층간 슬래브·수직 멀리언 음영을 넣어 층 구분이 선명하게 읽히도록 처리
  float slabBand = 1.0;
  if (vNwWorld.y > 29.0 && vNwWorld.y < 60.0) {
    float fy = fract((vNwWorld.y - 29.4) / 5.0);
    float fx = fract((vNwWorld.x + vNwWorld.z) / 3.6);
    float hSlab = smoothstep(0.0, 0.12, fy) * smoothstep(1.0, 0.86, fy);
    float vMull = smoothstep(0.0, 0.07, fx) * smoothstep(1.0, 0.93, fx);
    slabBand = mix(0.15, 1.0, hSlab * vMull);
  }
  vec3 warmAmber = vec3(1.0, 0.64, 0.28);
  vec3 warmWhite = vec3(1.0, 0.88, 0.68);
  vec3 winCol = mix(warmAmber, warmWhite, h2);
  float winStrength = uNight * roomOn * slabBand;
  totalEmissiveRadiance += winCol * winStrength * 2.15;
  diffuseColor.a = mix(diffuseColor.a, 0.90, clamp(uNight * (0.45 + 0.55 * roomOn * slabBand), 0.0, 1.0));
} else if (uNwWindowKind == 2) {
  // 성수 주변 저층 공장·카페·상가 창문(NW_glass_window): 밤에 따뜻한 실내 불빛
  float floorIdx = floor(vNwWorld.y / 3.6);
  float bayIdx = floor(vNwWorld.x / 4.2) + floor(vNwWorld.z / 4.2) * 23.0;
  float h1 = nwHash(vec2(bayIdx, floorIdx));
  float h2 = nwHash(vec2(floorIdx * 2.9, bayIdx * 1.7));
  float shopOn = (h1 > 0.32) ? (0.35 + 0.75 * h2) : 0.04;
  vec3 shopCol = mix(vec3(1.0, 0.62, 0.26), vec3(0.96, 0.86, 0.68), h2);
  totalEmissiveRadiance += shopCol * uNight * shopOn * 1.35;
} else if (uNwNightOnlyEmit > 0.5) {
  totalEmissiveRadiance *= uNight * 1.65;
} else if (uNwAlwaysEmit > 0.5) {
  float emitScale = mix(0.45, 2.35, clamp(uEmitGain, 0.0, 1.2));
  totalEmissiveRadiance *= emitScale;
}
if (uNwSurfaceKind == 10 && uNwWindowKind == 0 && uNight > 0.01) {
  // HAUS NOWHERE 및 영웅 건물 외피: 야간 전정 업라이트·크라운 간접 세척광(FX_night_haus_up/wash 대응)
  float upWash = exp(-max(0.0, vNwWorld.y) * 0.045) * 0.22;
  float crownWash = smoothstep(56.0, 76.0, vNwWorld.y) * 0.16;
  totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.88, 0.72) * (upWash + crownWash) * uNight;
}
if (uNwSurfaceKind == 8 && uNwBeam < 0.5) {
  float scan = 0.78 + 0.22 * sin(vNwWorld.y * 28.0 - uTime * 5.0);
  float flick = 0.92 + 0.08 * sin(uTime * 19.0 + vNwWorld.x * 0.7);
  totalEmissiveRadiance *= scan * flick * mix(0.9, 1.8, uEmitGain);
  diffuseColor.a *= clamp(scan * 0.85, 0.18, 0.85);
}
if (uNwBeam > 0.5) {
  // 서치라이트 광주: 정면으로 보이는 중심부만 은은하고(윤곽 감쇠), 드론에서 멀어질수록 사라진다(축 감쇠).
  float facing = abs(dot(normalize(vNwWorldNormal), normalize(cameraPosition - vNwWorld)));
  float edge = pow(facing, 2.2);
  // Blender NWF_beam_cone 과 같은 (1 − v)^1.65 축 감쇠: 원뿔 끝(열린 바닥)에서 정확히 0 → 잘린 테두리가 보이지 않는다
  float v = clamp(vNwBeamDist / max(uNwBeamLen, 1.0), 0.0, 1.0);
  float axial = pow(1.0 - v, 1.65) * smoothstep(0.0, 0.04, v);
  float vis = clamp(uNight + 0.35 * uRain, 0.0, 1.0);   // 흐린 낮엔 보이지 않는다
  diffuseColor.rgb = vec3(0.0);
  diffuseColor.a = 1.0;
  totalEmissiveRadiance = vec3(0.80, 0.88, 1.0) * edge * axial * vis * 0.5;
}
`,
      )
      .replace(
        '#include <fog_fragment>',
        /* glsl */ `
{
  float fogF = heightFog(cameraPosition, vNwWorld, uFogB, uFogK);
  float distR = length(vNwWorld.xz);
  vec3 fCol = mix(uFogColor, uFogFarColor, smoothstep(350.0, 3200.0, distR));
  // DS2: 해 쪽을 바라보는 시선의 안개는 산란광으로 밝게 번진다(역광 헤이즈)
  if (uSunHaze > 0.001) {
    float sv = max(dot(normalize(vNwWorld - cameraPosition), normalize(uSunDir)), 0.0);
    fCol += vec3(1.0, 0.95, 0.87) * (0.42 * pow(sv, 6.0) + 0.85 * pow(sv, 48.0)) * uSunHaze * (1.0 - uNight);   // sky.js 헤이즈와 같은 식
  }
  if (uNwBeam > 0.5) {
    gl_FragColor.rgb *= 1.0 - fogF;   // 가산 광주는 안개색으로 칠하지 않고 안개 속으로 사라진다
  } else {
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fCol, fogF);
  }

  // 분석 모드 스캔 펄스 링 & 감광
  if (uScanRadius > 0.0) {
    float sd = abs(distance(vNwWorld.xz, uScanCenter.xz) - uScanRadius);
    float ring = exp(-pow(sd / max(1.0, uScanWidth), 2.0));
    float grid = step(0.94, fract(vNwWorld.x * 0.25)) + step(0.94, fract(vNwWorld.z * 0.25));
    vec3 scanCol = mix(vec3(0.498, 0.588, 0.769), vec3(0.416, 0.863, 0.988), clamp(grid, 0.0, 1.0));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, scanCol, ring * 0.55);
  }
}
`,
      );
  };

  material.needsUpdate = true;
  return material;
}
