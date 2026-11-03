// HAUS NOWHERE — 성수 2041: 높이 지수 안개(해석해) JS + GLSL 조각.
// 식 출처: docs/nowhere/research/ds.md §6 (지수 밀도 b*exp(-k*y) 의 선분 적분 폐형 해).

export function heightFog(cam, pos, b, k) {
  const dx = pos.x - cam.x;
  const dy = pos.y - cam.y;
  const dz = pos.z - cam.z;
  const len = Math.hypot(dx, dy, dz);
  if (len === 0 || b <= 0) return 0;
  const kdy = k * dy;
  const t =
    Math.abs(kdy) > 1e-4
      ? (Math.exp(-k * cam.y) - Math.exp(-k * pos.y)) / kdy
      : Math.exp(-k * cam.y);
  const opticalDepth = Math.max(0, b * len * t);
  return 1 - Math.exp(-opticalDepth);
}

export const FOG_GLSL = /* glsl */ `
float heightFog(vec3 cam, vec3 pos, float b, float k) {
  vec3 d = pos - cam;
  float len = length(d);
  if (len <= 1e-5 || b <= 0.0) return 0.0;
  float kdy = k * d.y;
  float t = abs(kdy) > 1e-4
    ? (exp(-k * cam.y) - exp(-k * pos.y)) / kdy
    : exp(-k * cam.y);
  // 원경 능선(0.45~4.5 km) 대기 원근: 낮은 고도 지수 안개에 거리 연무(haze)를 더해 4겹 능선 명도 계단을 만든다.
  float r = length(pos.xz);
  float farHaze = smoothstep(450.0, 4800.0, r) * 0.00018 * len * smoothstep(520.0, 220.0, pos.y);
  return clamp(1.0 - exp(-(max(0.0, b * len * t) + farHaze)), 0.0, 0.96);
}
`;
