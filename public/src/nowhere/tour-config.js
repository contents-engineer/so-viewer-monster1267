// HAUS NOWHERE — 시나리오 투어 대상 건물(순수 데이터 + 좌표 변환, 테스트: tests/nowhere-tour-config.test.mjs).
// approach 는 건물 기준 로컬 오프셋(Three 축, 건물 rotY 회전 전). 화면을 보며 조정한다(Task 10).

export const TOUR_BUILDINGS = {
  haus: {
    label: '하우스노웨어 성수',
    enterable: true,
    // 남측 전정(z +17…+31) 앞에서 포디움 입구를 바라본다
    approach: { pos: [0, 3.2, 46], target: [0, 10, 0] },
  },
  facearch: {
    label: '하우스노웨어 몽골',
    enterable: false,
    // 얼굴 정면에서 두 눈과 필로티를 함께 본다. 얼굴은 로컬 축이 아니라 (−0.84, 0, 0.55) 쪽을 향한다(두 눈 메시 위치로 확인)
    approach: { pos: [-46, 7, 30], target: [0, 16, 0] },
  },
};

/** 건물 기준 로컬 좌표(Three 축, rotY 회전 전) → 월드 좌표. layout.buildings[id] 의 위치 · rotY(도)를 반영. 건물이 없으면 null. */
export function buildingToWorld(layout, id, [x, y, z]) {
  const cfg = layout?.buildings?.[id];
  if (!cfg || !Array.isArray(cfg.pos)) return null;
  const th = ((cfg.rotY || 0) * Math.PI) / 180;
  const c = Math.cos(th);
  const s = Math.sin(th);
  // three 의 rotation.y 와 같은 회전: x' = x cosθ + z sinθ, z' = −x sinθ + z cosθ
  return [cfg.pos[0] + x * c + z * s, cfg.pos[1] + y, cfg.pos[2] - x * s + z * c];
}

/** layout.buildings[id] 의 위치 · rotY(도)를 반영한 월드 접근 시점. 건물 · 레이아웃이 없으면 null. */
export function approachFor(layout, id) {
  const b = TOUR_BUILDINGS[id];
  if (!b) return null;
  const pos = buildingToWorld(layout, id, b.approach.pos);
  const target = buildingToWorld(layout, id, b.approach.target);
  return pos && target ? { pos, target } : null;
}
