// HAUS NOWHERE — 시작 결정(순수, three · DOM 없음 — 테스트: tests/nowhere-entry.test.mjs).
// 주소 매개변수 + 페이지 기본 월드(window.__NW_DEFAULT_WORLD: index.html 없음 · nowhere.html 'seongsu' · nowhere-mountain.html 'ds2') →
// { select: 월드 선택 화면을 띄울지, world, intro: 인트로를 돌릴지, mode: 둘러보기 방식(null 이면 인트로 뒤 방식 고르기) }.
// 선택 화면에서 고른 뒤에는 { world: 고른 것, intro: true, mode: null } 로 이어 간다(주소는 바꾸지 않는다).
// 월드 전환 주소: 위 막대 월드 버튼(worldSwitchUrl — 새 월드 인트로부터)과 건물 카드 「이 자리 그대로 …」(sameSpotUrl — at · look 으로 인트로 없이 같은 자리)가
// 같은 경로 규칙 · 지울 값을 쓴다. 새 페이지는 parsePose 로 그 자리를 읽는다(main.js 시작 흐름 — 방식 적용 뒤).

export const WORLD_IDS = ['seongsu', 'ds2'];
export const MODE_IDS = ['guide', 'walk', 'free'];

// 같은 자리, 다른 세계 — 조정값
export const SAME_SPOT_FADE_MS = 600;   // 넘어가기 전 어둡게 하는 시간(가운데 '<지금 월드> → <반대 월드>')
export const SAME_SPOT_LOOK_M = 10;     // 보행이면 시선 목표 = 시선 방향으로 이만큼 앞 점
export const SAME_SPOT_SNAP_M = 6;      // 보행: 그 자리가 반대 월드 장애물 안이면 이 반경 안 가장 가까운 빈 자리로
export const POSE_DECIMALS = 2;         // 주소의 at · look 좌표 반올림(소수 자리)
export const POSE_LIMIT = 2000;         // 장면 한계(m) — at · look 이 이 밖이면 무시하고 기본 시점

// 월드를 바꿀 때 지우는 값: 인트로를 막는 바로가기 값(resolveEntry)과 같은 자리 값 — 새 월드는 기본 기상 · 시각
const SWITCH_DROP = ['noIntro', 'cam', 'weather', 'time', 'at', 'look'];

export function resolveEntry(params, defaultWorld = null) {
  const get = (key) => (params && typeof params.get === 'function' ? params.get(key) : null) || '';
  // 바로가기 링크(캡처 · 테스트 주소 · 같은 자리 주소): 시점 · 기상 · 시각 · 자리(at) 중 하나라도 있으면 인트로 없이 그 시점 · 자유 시점(mode 가 없으면)으로 바로
  const deep = Boolean(get('cam') || get('weather') || get('time') || get('at'));
  const noIntro = get('noIntro') === '1';
  const modeParam = MODE_IDS.includes(get('mode')) ? get('mode') : null;
  let world = WORLD_IDS.includes(get('ver')) ? get('ver') : WORLD_IDS.includes(defaultWorld) ? defaultWorld : null;
  // 선택 화면은 월드가 정해지지 않았고 바로가기 · noIntro=1 · mode 가 모두 없을 때만
  const select = world === null && !deep && !noIntro && !modeParam;
  if (!select && world === null) world = 'seongsu';
  return {
    select,
    world,
    intro: !deep && !noIntro,
    mode: modeParam || (deep || noIntro ? 'free' : null),
  };
}

/** 'x,y,z' → [x, y, z](숫자 셋 · 모두 ±POSE_LIMIT 안), 아니면 null */
function parseVec(raw) {
  if (!raw) return null;
  const parts = raw.split(',');
  if (parts.length !== 3 || parts.some((t) => t.trim() === '')) return null;
  const v = parts.map(Number);
  return v.every((n) => Number.isFinite(n) && Math.abs(n) <= POSE_LIMIT) ? v : null;
}

/** 같은 자리 주소의 카메라 자리: { at: [x,y,z], look: [x,y,z] } — 둘 중 하나라도 없거나 이상하면 null(기본 시점) */
export function parsePose(params) {
  const get = (key) => (params && typeof params.get === 'function' ? params.get(key) : null) || '';
  const at = parseVec(get('at'));
  const look = parseVec(get('look'));
  return at && look ? { at, look } : null;
}

/** 넘어갈 때의 시선 목표: 자유 시점은 궤도 목표(target) 그대로, 보행은 시선 방향(위아래 포함)으로 SAME_SPOT_LOOK_M 앞 점. 새 배열 */
export function sameSpotLook(pos, target, walking) {
  if (!walking) return [...target];
  const d = [target[0] - pos[0], target[1] - pos[1], target[2] - pos[2]];
  const k = SAME_SPOT_LOOK_M / (Math.hypot(...d) || 1);
  return [pos[0] + d[0] * k, pos[1] + d[1] * k, pos[2] + d[2] * k];
}

/** 보행 같은 자리: free(nearestFreePoint 결과 { x, z } — 막힌 자리의 가장 가까운 빈 자리, 없으면 null)로 at 을 옮기고 시선 목표도 같은 dx · dz 만큼 */
export function snapPose(pose, free) {
  if (!free) return pose;
  const dx = free.x - pose.at[0];
  const dz = free.z - pose.at[2];
  if (dx === 0 && dz === 0) return pose;
  return { at: [free.x, pose.at[1], free.z], look: [pose.look[0] + dx, pose.look[1], pose.look[2] + dz] };
}

/** 자유 시점 같은 자리: 카메라가 minY(이 월드 지면 + 여유고) 아래면 그 높이로 올리고 시선 목표도 같은 만큼(shiftLook — 위아래 각 그대로) */
export function liftPose(pose, minY) {
  if (pose.at[1] >= minY) return pose;
  return { at: [pose.at[0], minY, pose.at[2]], look: shiftLook(pose.look, pose.at[1], minY) };
}

/**
 * 보행 같은 자리: 새 월드의 눈높이(newEyeY)가 옛 눈높이(oldEyeY = at[1])와 다르면(두 월드 지면 높이 차) 시선 목표를 그 차만큼 위아래로 옮긴다
 * — 절대 점이 아니라 시선 방향(위아래 각 포함)을 그대로 지킨다. 새 배열을 돌려준다
 */
export function shiftLook(look, oldEyeY, newEyeY) {
  return [look[0], look[1] + (newEyeY - oldEyeY), look[2]];
}

/** 위 막대 월드 버튼: 반대 월드 페이지(산악 페이지에서 성수로는 /nowhere, 나머지는 지금 경로 — .html 은 뗀다) + ver · mode, 인트로를 막는 값은 지운다 */
export function worldSwitchUrl({ pathname, search, targetVer, mode }) {
  const next = new URLSearchParams(search);
  next.set('ver', targetVer);
  next.set('mode', mode || 'free');
  for (const k of SWITCH_DROP) next.delete(k);
  const path = pathname.includes('nowhere-mountain') && targetVer === 'seongsu' ? '/nowhere' : pathname.replace(/\.html$/, '');
  return `${path}?${next.toString()}`;
}

const roundCoord = (n) => {
  const r = Number(n.toFixed(POSE_DECIMALS));
  return String(r === 0 ? 0 : r);   // -0 → 0
};

/**
 * 건물 카드 「이 자리 그대로 …」: 월드 전환 주소 + at · look(소수 POSE_DECIMALS 자리, 쉼표 그대로) — 새 페이지는 인트로 없이 그 자리 · 그 방식.
 * 가이드 투어 중이었으면 자유 시점으로(카드로 투어 흐름을 벗어났다)
 */
export function sameSpotUrl({ pathname, search, targetVer, mode, at, look }) {
  const vec = (v) => v.map(roundCoord).join(',');
  return `${worldSwitchUrl({ pathname, search, targetVer, mode: mode === 'guide' ? 'free' : mode })}&at=${vec(at)}&look=${vec(look)}`;
}

// 숫자 · 로마자 끝 글자의 우리말 읽기 받침: 영 · 삼 · 육 · 엠 · 엔은 받침, 일 · 칠 · 팔 · 엘 · 알은 ㄹ 받침(「로」), 나머지는 받침 없음
const READ_FINAL = { 0: 'ㅇ', 3: 'ㅁ', 6: 'ㄱ', M: 'ㅁ', N: 'ㄴ', 1: 'ㄹ', 7: 'ㄹ', 8: 'ㄹ', L: 'ㄹ', R: 'ㄹ' };

/** 이름 + 조사 「로」/「으로」: 받침이 없거나 ㄹ 받침이면 「로」, 다른 받침이면 「으로」(성수 2041로 · DS2 산악으로) */
export function withRo(name) {
  const last = String(name).trim().slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  let final = null;   // null = 받침 없음, 'ㄹ' = ㄹ 받침, 그 밖 = 다른 받침
  if (code >= 0 && code < 11172) {
    const jong = code % 28;
    final = jong === 0 ? null : jong === 8 ? 'ㄹ' : 'other';
  } else {
    final = READ_FINAL[last.toUpperCase()] ?? null;
  }
  return `${name}${final === null || final === 'ㄹ' ? '로' : '으로'}`;
}
