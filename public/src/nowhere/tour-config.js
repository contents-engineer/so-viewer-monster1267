// HAUS NOWHERE — 시나리오 투어 대상 건물(순수 데이터 + 좌표 변환, 테스트: tests/nowhere-tour-config.test.mjs).
// approach 는 건물 기준 로컬 오프셋(Three 축, 건물 rotY 회전 전). 화면을 보며 조정한다(Task 10).

export const TOUR_BUILDINGS = {
  haus: {
    label: '하우스노웨어 성수',
    summary: '50 × 52 m · 높이 81 m',
    enterable: true,
    // 남측 전정(z +17…+31) 앞에서 포디움 입구를 바라본다
    approach: { pos: [0, 3.2, 46], target: [0, 10, 0] },
  },
  facearch: {
    label: '하우스노웨어 몽골',
    summary: '22 × 18 m · 높이 31 m',
    enterable: false,
    // 얼굴 정면에서 두 눈과 필로티를 함께 본다
    approach: { pos: [0, 6, 48], target: [0, 14, 0] },
  },
};

/** layout.buildings[id] 의 위치 · rotY(도)를 반영한 월드 접근 시점. 건물 · 레이아웃이 없으면 null. */
export function approachFor(layout, id) {
  const b = TOUR_BUILDINGS[id];
  const cfg = layout?.buildings?.[id];
  if (!b || !cfg || !Array.isArray(cfg.pos)) return null;
  const th = ((cfg.rotY || 0) * Math.PI) / 180;
  const c = Math.cos(th);
  const s = Math.sin(th);
  // three 의 rotation.y 와 같은 회전: x' = x cosθ + z sinθ, z' = −x sinθ + z cosθ
  const tf = ([x, y, z]) => [cfg.pos[0] + x * c + z * s, cfg.pos[1] + y, cfg.pos[2] - x * s + z * c];
  return { pos: tf(b.approach.pos), target: tf(b.approach.target) };
}
