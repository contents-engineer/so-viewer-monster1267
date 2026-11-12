// HAUS NOWHERE — 보행 이동 스팟의 길 찾기 · 경로 다듬기 · 따라 걷기(순수, three 없음).
// 테스트: tests/nowhere-walk-path.test.mjs. 좌표는 Three.js 수평면, 점은 { x, z }.
import { STEP_UP, MAX_CLIMB, WALK_SPEED, RUN_SPEED } from './walk.js';

export const PATH_CELL = 0.5;          // m — 길 찾기 격자 칸
export const PATH_MARGIN = 24;         // m — 시작 · 목표 사각형 바깥 탐색 여유
export const PATH_MAX_NODES = 150000;  // 확장 노드 상한(넘으면 실패 → 컷 이동)
export const PATH_MAX_CELLS = 1_000_000;  // 탐색 상자 칸 수 상한 — 배열 4개 ≈ 14 B/칸 → 약 14 MB 상한(넘으면 실패 → 컷 이동)
export const START_SNAP = 1;           // m — 시작 자리가 막혔을 때 찾는 빈 자리 반경
export const GOAL_SNAP = 2;            // m — 목표 자리가 막혔을 때 찾는 빈 자리 반경
export const SEGMENT_STEP = 0.25;      // m — 직선 검사 표본 간격
export const ARRIVE_RADIUS = 0.3;      // m — 경유점 · 목적지 도달 반경
export const RUN_PATH_LENGTH = 30;     // m — 경로가 이보다 길면 달린다
export const STUCK_TIME = 1.0;         // s — 이 시간 동안
export const STUCK_DIST = 0.2;         // m — 이만큼도 못 나아가면 막힘
export const FACE_DIST = 2.0;          // m — 남은 거리가 이 안이면 볼거리 쪽으로 돈다
export const TURN_RATE = Math.PI;      // rad/s — 시선 방위 최대 회전 속도(초당 180°)

const SQRT2 = Math.SQRT2;
const NEIGHBORS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2],
];

/** 보행과 같은 판정: 서 있을 수 있는 자리(장애물이 턱 STEP_UP 보다 높으면 막힘) · 오를 수 있는 한 걸음(경사 MAX_CLIMB). */
export function walkPredicates({ groundHeightAt, blocker }) {
  const isFree = (x, z) => !blocker || !blocker.isBlocked(x, z, STEP_UP);
  const canStep = (ax, az, bx, bz) => {
    const run = Math.hypot(bx - ax, bz - az);
    return run < 1e-6 || (groundHeightAt(bx, bz) - groundHeightAt(ax, az)) / run <= MAX_CLIMB;
  };
  return { isFree, canStep };
}

/** (x, z) 가 비어 있으면 그대로, 아니면 반경 radius 안 cell 간격 점 중 가장 가까운 빈 자리. 없으면 null. */
export function nearestFreePoint(x, z, isFree, radius, cell = PATH_CELL) {
  if (isFree(x, z)) return { x, z };
  const n = Math.ceil(radius / cell);
  let best = null;
  let bestD = Infinity;
  for (let j = -n; j <= n; j++) {
    for (let i = -n; i <= n; i++) {
      const d = Math.hypot(i * cell, j * cell);
      if (d > radius || d >= bestD) continue;
      const px = x + i * cell;
      const pz = z + j * cell;
      if (isFree(px, pz)) {
        best = { x: px, z: pz };
        bestD = d;
      }
    }
  }
  return best;
}

// 우선순위 최소 이진 힙(노드 번호 · 우선순위 평행 배열)
function createHeap() {
  const keys = [];
  const pri = [];
  return {
    get size() {
      return keys.length;
    },
    push(k, p) {
      let i = keys.length;
      keys.push(k);
      pri.push(p);
      while (i > 0) {
        const up = (i - 1) >> 1;
        if (pri[up] <= p) break;
        keys[i] = keys[up];
        pri[i] = pri[up];
        i = up;
      }
      keys[i] = k;
      pri[i] = p;
    },
    pop() {
      const top = keys[0];
      const k = keys.pop();
      const p = pri.pop();
      const n = keys.length;
      if (n) {
        let i = 0;
        for (;;) {
          let c = 2 * i + 1;
          if (c >= n) break;
          if (c + 1 < n && pri[c + 1] < pri[c]) c++;
          if (pri[c] >= p) break;
          keys[i] = keys[c];
          pri[i] = pri[c];
          i = c;
        }
        keys[i] = k;
        pri[i] = p;
      }
      return top;
    },
  };
}

/**
 * cell 칸 8방향 A*(옥타일 휴리스틱). 탐색 영역 = 시작 · 목표 사각형 + margin. 확장 노드가 maxNodes 를 넘으면 null.
 * 막힌 시작 · 목표는 START_SNAP · GOAL_SNAP 안 가장 가까운 빈 격자점으로 옮긴다. 대각선은 이웃한 두 직교 칸이 모두 비어 있을 때만.
 * 결과: 첫 점 = start, 그다음 격자점들, 목표 자리가 비어 있으면 끝 점 = goal(아니면 보정된 격자점). 실패하면 null.
 */
export function findPath(start, goal, { isFree, canStep = () => true, cell = PATH_CELL, margin = PATH_MARGIN, maxNodes = PATH_MAX_NODES } = {}) {
  const ox = Math.min(start.x, goal.x) - margin;
  const oz = Math.min(start.z, goal.z) - margin;
  const nx = Math.floor((Math.max(start.x, goal.x) + margin - ox) / cell) + 1;
  const nz = Math.floor((Math.max(start.z, goal.z) + margin - oz) / cell) + 1;
  const N = nx * nz;
  if (N > PATH_MAX_CELLS) return null;   // 먼 목표 — 면적에 비례하는 메모리 · 시간을 막는다
  const px = (i) => ox + i * cell;
  const pz = (j) => oz + j * cell;
  const freeCache = new Int8Array(N);   // 0 모름 · 1 빈 · −1 막힘
  const free = (i, j) => {
    if (i < 0 || j < 0 || i >= nx || j >= nz) return false;
    const k = j * nx + i;
    if (!freeCache[k]) freeCache[k] = isFree(px(i), pz(j)) ? 1 : -1;
    return freeCache[k] === 1;
  };
  // (x, z) 에서 반경 radius 안 가장 가까운 빈 격자점 번호(없으면 −1)
  const snap = (x, z, radius) => {
    const ci = Math.round((x - ox) / cell);
    const cj = Math.round((z - oz) / cell);
    const n = Math.ceil(radius / cell) + 1;
    let best = -1;
    let bestD = Infinity;
    for (let j = cj - n; j <= cj + n; j++) {
      for (let i = ci - n; i <= ci + n; i++) {
        const d = Math.hypot(px(i) - x, pz(j) - z);
        if (d > radius || d >= bestD || !free(i, j)) continue;
        best = j * nx + i;
        bestD = d;
      }
    }
    return best;
  };
  const sk = snap(start.x, start.z, START_SNAP);
  const gk = snap(goal.x, goal.z, GOAL_SNAP);
  if (sk < 0 || gk < 0) return null;

  const gi = gk % nx;
  const gj = (gk - gi) / nx;
  const h = (k) => {
    const i = k % nx;
    const dx = Math.abs(i - gi);
    const dz = Math.abs((k - i) / nx - gj);
    return (dx + dz + (SQRT2 - 2) * Math.min(dx, dz)) * cell;
  };
  const g = new Float64Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const heap = createHeap();
  g[sk] = 0;
  heap.push(sk, h(sk));
  let expanded = 0;
  let found = false;
  while (heap.size) {
    const k = heap.pop();
    if (closed[k]) continue;
    if (k === gk) {
      found = true;
      break;
    }
    closed[k] = 1;
    if (++expanded > maxNodes) return null;
    const i = k % nx;
    const j = (k - i) / nx;
    for (const [di, dj, w] of NEIGHBORS) {
      const ni = i + di;
      const nj = j + dj;
      if (!free(ni, nj)) continue;
      const nk = nj * nx + ni;
      if (closed[nk]) continue;
      if (di && dj && (!free(i + di, j) || !free(i, j + dj))) continue;
      if (!canStep(px(i), pz(j), px(ni), pz(nj))) continue;
      const cand = g[k] + w * cell;
      if (cand < g[nk]) {
        g[nk] = cand;
        came[nk] = k;
        heap.push(nk, cand + h(nk));
      }
    }
  }
  if (!found) return null;

  const cells = [];
  for (let k = gk; k !== -1; k = came[k]) cells.push(k);
  cells.reverse();
  const out = [{ x: start.x, z: start.z }];
  const add = (x, z) => {
    const l = out[out.length - 1];
    if (Math.hypot(x - l.x, z - l.z) > 1e-6) out.push({ x, z });
  };
  for (const k of cells) {
    const i = k % nx;
    add(px(i), pz((k - i) / nx));
  }
  if (isFree(goal.x, goal.z)) add(goal.x, goal.z);
  return out;
}

/** 두 점 사이 직선을 step 간격으로 걸어 볼 수 있는지(모든 표본이 비어 있고 한 걸음씩 오를 수 있음) */
export function makeSegmentFree(isFree, canStep = () => true, step = SEGMENT_STEP) {
  return (a, b) => {
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(1, Math.ceil(len / step));
    let qx = a.x;
    let qz = a.z;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      if (!isFree(x, z) || !canStep(qx, qz, x, z)) return false;
      qx = x;
      qz = z;
    }
    return true;
  };
}

/** 끈 당기기: 기준점에서 직선으로 갈 수 있는 동안 다음 점으로 건너뛰고, 막히면 직전 점을 꺾는 점으로 남긴다. */
export function smoothPath(points, segmentFree) {
  if (points.length <= 2) return points.slice();
  const out = [points[0]];
  let anchor = 0;
  for (let k = 2; k < points.length; k++) {
    if (!segmentFree(points[anchor], points[k])) {
      anchor = k - 1;
      out.push(points[anchor]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/** 보행 지형 ctx = { groundHeightAt, blocker } 에서 from → to 경로(다듬은 점 목록) 또는 null */
export function planWalkPath(ctx, from, to) {
  const { isFree, canStep } = walkPredicates(ctx);
  const raw = findPath({ x: from.x, z: from.z }, { x: to.x, z: to.z }, { isFree, canStep });
  return raw ? smoothPath(raw, makeSegmentFree(isFree, canStep)) : null;
}

export function pathLength(points) {
  let s = 0;
  for (let i = 1; i < points.length; i++) s += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
  return s;
}

/**
 * 경로 따라 걷기. step(pos, dt) → { done, stuck, dx, dz, remaining }: 이번 프레임 이동량(dx, dz — 지금 경유점 쪽, 속도 × dt 이하),
 * 남은 경로 길이, 도착(done) · 막힘(stuck: STUCK_TIME 동안 STUCK_DIST 미만 진척). 속도는 경로가 RUN_PATH_LENGTH 보다 길면 달리기.
 */
export function createPathFollower(points, { walkSpeed = WALK_SPEED, runSpeed = RUN_SPEED } = {}) {
  const speed = pathLength(points) > RUN_PATH_LENGTH ? runSpeed : walkSpeed;
  const last = points.length - 1;
  const suffix = new Array(points.length).fill(0);   // suffix[i] = points[i] 에서 끝까지 길이
  for (let i = last - 1; i >= 0; i--) suffix[i] = suffix[i + 1] + Math.hypot(points[i + 1].x - points[i].x, points[i + 1].z - points[i].z);
  let idx = 1;
  let watch = null;
  return {
    speed,
    step(pos, dt) {
      while (idx < last && Math.hypot(points[idx].x - pos.x, points[idx].z - pos.z) <= ARRIVE_RADIUS) idx++;
      const tgt = points[idx];
      const dx = tgt.x - pos.x;
      const dz = tgt.z - pos.z;
      const d = Math.hypot(dx, dz);
      const remaining = d + suffix[idx];
      if (idx === last && d <= ARRIVE_RADIUS) return { done: true, stuck: false, dx: 0, dz: 0, remaining };
      if (!watch) watch = { t: 0, x: pos.x, z: pos.z };
      watch.t += dt;
      if (watch.t >= STUCK_TIME - 1e-9) {
        if (Math.hypot(pos.x - watch.x, pos.z - watch.z) < STUCK_DIST) return { done: false, stuck: true, dx: 0, dz: 0, remaining };
        watch = { t: 0, x: pos.x, z: pos.z };
      }
      const s = Math.min(d, speed * dt) / d;
      return { done: false, stuck: false, dx: dx * s, dz: dz * s, remaining };
    },
  };
}

/** 각도를 (−π, π] 로 */
export function wrapAngle(a) {
  const TAU = 2 * Math.PI;
  const r = ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  return r <= -Math.PI ? Math.PI : r;
}

/** yaw 에서 target 쪽으로 짧은 방향으로 최대 maxDelta 만큼 돈 각도 */
export function turnToward(yaw, target, maxDelta) {
  const d = wrapAngle(target - yaw);
  return wrapAngle(yaw + Math.max(-maxDelta, Math.min(maxDelta, d)));
}
