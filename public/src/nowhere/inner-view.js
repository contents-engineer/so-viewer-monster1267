// HAUS NOWHERE — 실내 창밖 · 밤 조명. 창밖: 외관 씬을 CubeCamera(256 px)로 HAUS 위치 · 그 층 높이 + 1.7 m 에서 캡처해 실내 배경으로
// (창 유리 너머로만 보임, 찍는 동안 HAUS 자신은 숨김). 밤 조명: uNight > 0.5 에서 실내 조명을 따뜻하게 · 밝게(스펙 §2.6).
// THREE 를 인자로 받아 node:test 에서 three 없이 import 한다. 테스트: tests/nowhere-inner-view.test.mjs
export const VIEW_SIZE = 256;
export const VIEW_SETTLE_MS = 2700;   // 기상 전환(2.5 s)이 끝난 뒤 다시 캡처

/** 기상 · 시각이 같으면 다시 찍지 않도록 쓰는 키 */
export function viewKey(weatherName, hour) {
  return `${weatherName}|${Number(hour).toFixed(2)}`;
}

/** 지하(B1F, elevation < 0)는 창이 없어 캡처하지 않는다 */
export function hasWindowView(floor) {
  return Boolean(floor) && floor.elevation >= 0;
}

const hex2 = (n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
function rgb(h) {
  const s = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
}

/** 두 색(#rrggbb) 사이 t(0…1, 밖은 끝으로 묶음) 보간 — 소문자 #rrggbb */
export function lerpHex(a, b, t) {
  const k = Math.min(1, Math.max(0, t));
  const A = rgb(a);
  const B = rgb(b);
  return `#${hex2(A[0] + (B[0] - A[0]) * k)}${hex2(A[1] + (B[1] - A[1]) * k)}${hex2(A[2] + (B[2] - A[2]) * k)}`;
}

/** uNight(0…1) → 실내 조명 값. 0.5 이하는 낮과 같고 1 에서 가장 따뜻 · 밝다. 모바일은 HDRI 대신 채움광 */
export function interiorLighting(night, mobile = false) {
  const k = Math.min(1, Math.max(0, (night - 0.5) / 0.5));
  return {
    hemiSky: lerpHex('#F4F1EA', '#FFE2BC', k),
    hemiGround: '#3a2a26',
    hemiIntensity: 1.1 + 0.3 * k,
    keyColor: lerpHex('#FFF4E6', '#FFC27A', k),
    keyIntensity: 1.2 + 0.6 * k,
    ambient: mobile ? 1.2 + 0.2 * k : 0,
  };
}

/** 외관 씬을 그 층 높이에서 캡처하는 CubeCamera. capture(elevation) 은 실내 scene.background 로 쓸 큐브 텍스처를 돌려준다. */
export function createWindowView({ THREE, renderer, exteriorScene, world, near = 0.5, far = 8000 }) {
  const rt = new THREE.WebGLCubeRenderTarget(VIEW_SIZE, { type: THREE.HalfFloatType });
  const cam = new THREE.CubeCamera(near, far, rt);

  function capture(elevation) {
    const haus = world.layerGroups?.building_haus;
    const was = haus ? haus.visible : null;
    if (haus) haus.visible = false;   // HAUS 안에서 찍으므로 자기 벽이 가리지 않게
    cam.position.set(0, elevation + 1.7, 0);
    cam.update(renderer, exteriorScene);
    if (haus) haus.visible = was;
    return rt.texture;
  }

  return { capture, texture: rt.texture, dispose: () => rt.dispose() };
}
