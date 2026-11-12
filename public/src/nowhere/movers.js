// HAUS NOWHERE — 성수 2041: 경로 이동체(드론 · 자율주행 포드 · 튜브 열차 · 배송로봇 · 풍력 회전자 · 날으는 로드스터)의 순수 계산.
// 경로는 export.py 가 2 m 간격 꺾은선으로 내보낸다(드론 고리는 Catmull-Rom 을 미리 펴서). 여기서는 길이 비례로만 움직인다.
// 좌표는 Three (x, y 위, z). 메시의 앞 = 로컬 +X(Blender 와 같은 약속). 앞이 +Z 인 메시(DS2 의 옛 드론)는 yawOffset = π/2.
// 테스트: tests/nowhere-movers.test.mjs

export const MOVER_KINDS = ['drone', 'pod', 'train', 'bot', 'spin', 'roadster'];

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

// ───────────── 날으는 로드스터(2026-11-12): layout.movers kind 'roadster'. Blender future.py 시간표를 키로 받아 보간만 한다
// def = { id, kind: 'roadster', object, plume, origin, yaw0, period: 40, phase: 초, visible: [t0, t1], keys: [{ t, pos: [x, y, z], yaw?, roll?, pitch?, thrust? }] }
// pos 는 모든 키에, 채널(yaw · roll · pitch · thrust)은 그 값을 정하는 키에만 있다(첫 · 끝 키는 모두). 각도는 three 와 같다:
// yaw = rotation.y(앞 = 로컬 +X 의 방위), pitch = 차의 옆축(로컬 z) 회전(+ 코가 위), roll = 차의 앞 = 진행 방향 축(로컬 x) 누적 회전(0 → 2π)

export const PLUME_MIN = 0.02;   // 분사 세기가 이 값 이하면 분사 메시를 숨긴다

function smooth01(u) {
  const x = Math.min(1, Math.max(0, u));
  return x * x * (3 - 2 * x);
}

/** 주기 안 시각(초): (time − phase) 를 period 로 감는다. 위상 20 s 인 차는 위상 0 인 차보다 20 s 늦게 같은 동작을 한다. */
export function roadsterLocalTime(def, time) {
  const P = def.period;
  return (((time - (def.phase || 0)) % P) + P) % P;
}

/** 채널 값: 그 채널이 있는 키들 사이를 선형 + smoothstep(양 끝 기울기 0). 범위 밖은 끝 키 값. */
function channelAt(keys, name, t) {
  let a = null;
  let b = null;
  for (const k of keys) {
    if (k[name] === undefined) continue;
    if (k.t <= t) a = k;
    else {
      b = k;
      break;
    }
  }
  if (!a) return b ? b[name] : 0;
  if (!b) return a[name];
  return a[name] + (b[name] - a[name]) * smooth01((t - a.t) / (b.t - a.t));
}

/** 키 i 의 접선(m/s): 이웃 두 키의 차분(양 끝은 한쪽 차분). */
function keyTangent(keys, i) {
  const a = keys[Math.max(0, i - 1)];
  const b = keys[Math.min(keys.length - 1, i + 1)];
  const dt = b.t - a.t;
  return [0, 1, 2].map((c) => (b.pos[c] - a.pos[c]) / dt);
}

/** 위치: 키 시각을 반영한 Catmull-Rom(이웃 키 차분 접선의 3차 Hermite). 간격이 같으면 균일 Catmull-Rom(장력 0.5), 등속 직선은 그대로 직선. */
function positionAt(keys, t) {
  const n = keys.length;
  if (n === 1) return keys[0].pos.slice();
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (keys[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const k0 = keys[lo];
  const k1 = keys[hi];
  const h = k1.t - k0.t;
  const u = Math.min(1, Math.max(0, (t - k0.t) / h));
  const m0 = keyTangent(keys, lo);
  const m1 = keyTangent(keys, hi);
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  return [0, 1, 2].map((c) => h00 * k0.pos[c] + h10 * h * m0[c] + h01 * k1.pos[c] + h11 * h * m1[c]);
}

/** 로드스터 자세 → { visible, pos, yaw, pitch, roll, thrust }. 보이는 구간 밖이면 visible false(pos null, 나머지 0). */
export function roadsterPose(def, time) {
  const t = roadsterLocalTime(def, time);
  const [t0, t1] = def.visible;
  if (t < t0 || t > t1) return { visible: false, pos: null, yaw: 0, pitch: 0, roll: 0, thrust: 0 };
  const K = def.keys;
  return {
    visible: true,
    pos: positionAt(K, t),
    yaw: channelAt(K, 'yaw', t),
    pitch: channelAt(K, 'pitch', t),
    roll: channelAt(K, 'roll', t),
    thrust: channelAt(K, 'thrust', t),
  };
}

/** 분사 세기 → 분사 메시 모양 키 영향(0 … 1): 뒤 노즐 = thrust(길이 비례), 바닥 = 0.5 넘는 부분만(2·thrust − 1).
 *  A 가 롤 뒤 0.5 → 0 으로 줄이면 뒤 노즐만 남아 서서히 짧아진다(스펙 §3). */
export function plumeMorph(thrust) {
  const t = Math.min(1, Math.max(0, thrust));
  return { rear: t, bottom: Math.max(0, 2 * t - 1) };
}
