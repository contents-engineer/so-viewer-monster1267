// HAUS NOWHERE — 보행 이동 스팟: 외관 두 건물 주변 스팟 정의 · 실내 층 스팟 생성 · 표시 단계 · 가림 판정(순수, three 없음).
// 테스트: tests/nowhere-walk-spots.test.mjs. 좌표는 Three.js(x, y 위, z).
// 스팟 = { id, label, x, z, look: [x, y, z] | null, kind: 'view'|'entrance'|'elevator'|'exit', beacon, caption, building }
import { buildingToWorld } from './tour-config.js';

export const SPOT_HERE = 1.5;   // m — 지금 서 있는 스팟은 숨긴다
export const SPOT_NEAR = 12;    // m — 이 안이면 아이콘 + 이름
export const SPOT_FAR = 40;     // m — 이 안이면 작은 마름모
export const SPOT_LIFT = 1.0;   // m — 마커를 스팟 지면 위 이 높이에 띄운다

// 건물 기준 로컬 좌표(Three 축, 건물 rotY 회전 전 — tour-config approach 와 같은 규칙). at = 설 자리 (x, z), look = 볼거리 (x, y, z).
// HAUS 는 남측(+z) 전정 쪽이 정면, FaceArch 얼굴은 tour-config 의 facearch approach 와 같은 축(월드 (−0.84, 0, 0.55) 쪽)을 향한다. 위치는 두 월드에서 막힘 · 구도를 보고 정했다.
export const EXTERIOR_SPOTS = {
  haus: [
    { id: 'haus_entrance', label: '하우스노웨어 성수 정문', at: [0, 40], look: [0, 9, 0], kind: 'entrance', beacon: true },
    { id: 'haus_garden', label: '전정 화단', at: [-12, 33], look: [-12, 0.8, 26] },
    { id: 'haus_sw', label: '남서 모서리 — 타워 올려다보기', at: [-32, 34], look: [0, 40, 0] },
    { id: 'haus_se', label: '남동 모서리', at: [32, 34], look: [0, 30, 0] },
    { id: 'haus_east', label: '동측 면', at: [46, 0], look: [0, 22, 0] },
  ],
  facearch: [
    { id: 'face_front', label: '하우스노웨어 몽골 정면', at: [-30, 20], look: [0, 16, 0], beacon: true },
    { id: 'face_piloti', label: '필로티 아래', at: [2, 2], look: [-12, 5, -4] },
    { id: 'face_left', label: '왼쪽 측면', at: [-8, 22], look: [0, 16, 0] },
    { id: 'face_right', label: '오른쪽 측면', at: [-8, -20], look: [0, 16, 0] },
  ],
};

/** 두 건물 주변 스팟(월드 좌표). layout 에 없는 건물의 스팟은 뺀다. */
export function exteriorSpots(layout) {
  const out = [];
  for (const [building, defs] of Object.entries(EXTERIOR_SPOTS)) {
    for (const d of defs) {
      const p = buildingToWorld(layout, building, [d.at[0], 0, d.at[1]]);
      const look = buildingToWorld(layout, building, d.look);
      if (!p || !look) continue;
      out.push({ id: d.id, label: d.label, x: p[0], z: p[2], look, kind: d.kind || 'view', beacon: Boolean(d.beacon), caption: null, building });
    }
  }
  return out;
}

/** 둘러보기 자막의 ' — ' 앞부분(없으면 전체)을 스팟 이름으로 */
export function spotLabel(caption) {
  return String(caption || '').split(' — ')[0].trim();
}

/** 실내 한 층의 스팟: 둘러보기 지점(볼거리) + 엘리베이터 + 1F 출구. 엘리베이터 · 출구는 영역 트리거가 질문하므로 look 없음. */
export function interiorSpots(floor) {
  if (!floor) return [];
  const out = (floor.tour || []).map((t, i) => ({
    id: `${floor.id}_tour${i}`,
    label: spotLabel(t.caption),
    x: t.pos[0],
    z: t.pos[2],
    look: [...t.target],
    kind: 'view',
    beacon: false,
    caption: t.caption || null,
    building: null,
  }));
  const area = (a, kind, label) => ({ id: `${floor.id}_${kind}`, label, x: a.pos[0], z: a.pos[2], look: null, kind, beacon: false, caption: null, building: null });
  if (floor.elevator) out.push(area(floor.elevator, 'elevator', '엘리베이터'));
  if (floor.exit) out.push(area(floor.exit, 'exit', '밖으로 나가기'));
  return out;
}

/**
 * 표시 단계. dist = 눈과 스팟의 수평 거리(m). beacon = 건물 대표 스팟(거리 무관 표시), aimed = 마우스 올림 · 조준점.
 * hidden(숨김) · far(작은 마름모) · near(아이콘 + 이름) · beacon(작은 마름모 + 이름 · 거리)
 */
export function spotStage(dist, { beacon = false, aimed = false } = {}) {
  if (dist < SPOT_HERE) return 'hidden';
  if (dist <= SPOT_NEAR) return 'near';
  if (aimed && (beacon || dist <= SPOT_FAR)) return 'near';
  if (beacon) return 'beacon';
  if (dist <= SPOT_FAR) return 'far';
  return 'hidden';
}

/**
 * 눈(eye) → 마커 점(target) 선분을 step 간격으로 표본화해, 그 자리 지면 + 장애물 윗면(topAt, 지면 위 m)이
 * 선분 높이보다 높으면 가려진 것. 마커 쪽 끝 endClear 안(스팟 바로 옆 전시물 · 벽)은 검사하지 않는다.
 */
export function isSpotOccluded(eye, target, groundHeightAt, topAt, { step = 0.5, endClear = 0.6 } = {}) {
  const dx = target.x - eye.x;
  const dz = target.z - eye.z;
  const len = Math.hypot(dx, dz);
  for (let d = step; d < len - endClear; d += step) {
    const t = d / len;
    const x = eye.x + dx * t;
    const z = eye.z + dz * t;
    const lineY = eye.y + (target.y - eye.y) * t;
    if (groundHeightAt(x, z) + topAt(x, z) > lineY) return true;
  }
  return false;
}
