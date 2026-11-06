// HAUS NOWHERE — 시나리오 투어: 두 시점 사이 '상승 → 활공 → 정면 하강' 비행 경로(순수 함수, 테스트: tests/nowhere-flight.test.mjs).
// 좌표는 Three.js (x, y 위, z). 카메라 쪽(camera.flyTo)이 이 제어점으로 Catmull-Rom 곡선을 만든다.

export const FLIGHT_SPEED = 40;      // m/s
export const FLIGHT_MIN_S = 4;
export const FLIGHT_MAX_S = 8;
export const FLIGHT_MIN_RISE = 25;   // m

const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * from/to = { pos: [x,y,z], target: [x,y,z] }.
 * 제어점: 출발점 → 출발점 위(상승의 절반) → 두 점 사이 상공(최고점) → 도착점 위(상승의 40 %) → 도착점.
 * 상승 높이 = max(25 m, 직선거리 × 0.15), 시간 = clamp(직선거리 / 40 m/s, 4 s, 8 s).
 */
export function buildFlightPath(from, to) {
  const p0 = from.pos;
  const p1 = to.pos;
  const dist = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
  const rise = Math.max(FLIGHT_MIN_RISE, dist * 0.15);
  const top = Math.max(p0[1], p1[1]) + rise;
  const mid = lerp3(p0, p1, 0.5);
  const points = [
    [p0[0], p0[1], p0[2]],
    [p0[0], p0[1] + rise * 0.5, p0[2]],
    [mid[0], top, mid[2]],
    [p1[0], p1[1] + rise * 0.4, p1[2]],
    [p1[0], p1[1], p1[2]],
  ];
  const t0 = from.target;
  const t1 = to.target;
  const targets = [
    [t0[0], t0[1], t0[2]],
    [t0[0], t0[1], t0[2]],
    lerp3(t0, t1, 0.5),
    [t1[0], t1[1], t1[2]],
    [t1[0], t1[1], t1[2]],
  ];
  const duration = Math.min(FLIGHT_MAX_S, Math.max(FLIGHT_MIN_S, dist / FLIGHT_SPEED));
  return { points, targets, duration };
}
