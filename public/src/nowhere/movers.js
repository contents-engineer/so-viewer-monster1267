// HAUS NOWHERE — 성수 2041: 경로 이동체(드론 · 자율주행 포드 · 튜브 열차 · 배송로봇 · 풍력 회전자)의 순수 계산.
// 경로는 export.py 가 2 m 간격 꺾은선으로 내보낸다(드론 고리는 Catmull-Rom 을 미리 펴서). 여기서는 길이 비례로만 움직인다.
// 좌표는 Three (x, y 위, z). 메시의 앞 = 로컬 +X(Blender 와 같은 약속). 앞이 +Z 인 메시(DS2 의 옛 드론)는 yawOffset = π/2.
// 테스트: tests/nowhere-movers.test.mjs

export const MOVER_KINDS = ['drone', 'pod', 'train', 'bot', 'spin'];

/** 꺾은선 → 누적 길이 표. closed 면 마지막 → 처음 구간을 더한다. */
export function buildTrack(points, closed = false) {
  const pts = points.map((p) => [p[0], p[1], p[2]]);
  if (closed && pts.length > 1) pts.push(pts[0].slice());
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  return { pts, cum, length: cum[cum.length - 1], closed };
}

/** 길이 s 의 위치와 진행 방향(단위 벡터). 범위 밖 s 는 끝에 붙인다. */
export function sampleTrack(track, s) {
  const { pts, cum, length } = track;
  const d = Math.min(Math.max(s, 0), length);
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid;
    else hi = mid;
  }
  const a = pts[lo];
  const b = pts[hi];
  const seg = cum[hi] - cum[lo] || 1;
  const t = (d - cum[lo]) / seg;
  return {
    pos: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
    dir: [(b[0] - a[0]) / seg, (b[1] - a[1]) / seg, (b[2] - a[2]) / seg],
  };
}

/** 시각 elapsed(초)의 경로 위 거리 s 와 진행 부호. loop · wrap = 한 방향(wrap 은 끝 → 처음으로 건너뜀), pingpong = 왕복. */
export function moverDistance(def, length, elapsed) {
  const L = Math.max(length, 1e-6);
  const travel = elapsed * def.speed + (def.phase || 0) * L;
  if (def.mode === 'pingpong') {
    const m = ((travel % (2 * L)) + 2 * L) % (2 * L);
    return m <= L ? { s: m, sign: 1 } : { s: 2 * L - m, sign: -1 };
  }
  return { s: ((travel % L) + L) % L, sign: 1 };
}

/** 진행 방향 → three rotation.y(앞 = 로컬 +X) + yawOffset. 위아래 성분은 무시한다. */
export function headingYaw(dir, yawOffset = 0) {
  return Math.atan2(-dir[2], dir[0]) + yawOffset;
}

/** 이동체 자세 { pos, yaw }. 왕복에서 되돌아갈 때 flipYaw 면 돌아선다(배송로봇). 열차는 양 끝이 같아 돌지 않는다. */
export function moverPose(def, track, elapsed) {
  const { s, sign } = moverDistance(def, track.length, elapsed);
  const { pos, dir } = sampleTrack(track, s);
  const d = sign < 0 && def.flipYaw ? [-dir[0], -dir[1], -dir[2]] : dir;
  if (def.bob) pos[1] += Math.sin(elapsed * 2.4 + (def.phase || 0) * 10) * def.bob;
  return { pos, yaw: headingYaw(d, def.yawOffset || 0) };
}

/** 풍력 회전자 각도(라디안). */
export function spinAngle(def, elapsed) {
  return ((def.rpm || 0) * Math.PI * 2 * elapsed) / 60;
}
