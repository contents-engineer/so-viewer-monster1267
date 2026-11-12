import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nearestFreePoint, findPath, smoothPath, makeSegmentFree, walkPredicates, planWalkPath,
  pathLength, createPathFollower, turnToward, wrapAngle,
  GOAL_SNAP, ARRIVE_RADIUS, RUN_PATH_LENGTH, STUCK_TIME, PATH_MAX_CELLS,
} from '../public/src/nowhere/walk-path.js';
import { WALK_SPEED, RUN_SPEED, STEP_UP, MAX_CLIMB } from '../public/src/nowhere/walk.js';

const open = () => true;
const allFree = (pts, isFree) => pts.every((p) => isFree(p.x, p.z));
const segsFree = (pts, isFree) => {
  const sf = makeSegmentFree(isFree);
  for (let i = 1; i < pts.length; i++) if (!sf(pts[i - 1], pts[i])) return false;
  return true;
};

test('(a) 빈 땅: 시작 → 목표 경로, 첫 점 = 시작 · 끝 점 = 목표 · 길이는 직선에 가깝고 다듬으면 두 점', () => {
  const p = findPath({ x: 0.2, z: 0.1 }, { x: 10.3, z: 3.1 }, { isFree: open });
  assert.ok(p);
  assert.deepEqual(p[0], { x: 0.2, z: 0.1 });
  assert.deepEqual(p.at(-1), { x: 10.3, z: 3.1 });
  assert.ok(pathLength(p) < Math.hypot(10.1, 3.0) * 1.1, `len ${pathLength(p)}`);
  assert.equal(smoothPath(p, makeSegmentFree(open)).length, 2);
});

test('(b) 벽이 가로막으면 돌아간다 — 모든 점 · 구간이 비어 있고, 다듬으면 점이 줄되 여전히 비어 있다', () => {
  const isFree = (x, z) => !(x > 4 && x < 6 && z > -8 && z < 8);
  const p = findPath({ x: 0, z: 0 }, { x: 10, z: 0 }, { isFree });
  assert.ok(p);
  assert.ok(allFree(p, isFree));
  assert.ok(segsFree(p, isFree));
  assert.ok(pathLength(p) > 16, `len ${pathLength(p)}`);
  const s = smoothPath(p, makeSegmentFree(isFree));
  assert.ok(s.length < p.length && s.length >= 3, `smoothed ${s.length}`);
  assert.ok(segsFree(s, isFree));
  assert.ok(pathLength(s) <= pathLength(p) + 1e-9);
});

test('(c) 닫힌 울타리 안 목표 · 노드 상한 초과는 null', () => {
  const ring = (x, z) => {
    const r = Math.max(Math.abs(x - 10), Math.abs(z));
    return !(r >= 1.5 && r <= 2.5);
  };
  assert.equal(findPath({ x: 0, z: 0 }, { x: 10, z: 0 }, { isFree: ring }), null);
  assert.equal(findPath({ x: 0, z: 0 }, { x: 60, z: 0 }, { isFree: open, maxNodes: 50 }), null);
});

test('(d) 막힌 목표는 2 m 안 가장 가까운 빈 자리로, 2 m 안에 없으면 null', () => {
  const pillar = (r) => (x, z) => Math.hypot(x - 10, z) > r;
  const p = findPath({ x: 0, z: 0 }, { x: 10, z: 0 }, { isFree: pillar(0.8) });
  assert.ok(p);
  const end = p.at(-1);
  const d = Math.hypot(end.x - 10, end.z);
  assert.ok(d > 0.8 && d <= GOAL_SNAP, `end ${d}`);
  assert.equal(findPath({ x: 0, z: 0 }, { x: 10, z: 0 }, { isFree: pillar(2.6) }), null);
  const q = nearestFreePoint(10, 0, pillar(0.8), GOAL_SNAP);
  assert.ok(Math.abs(Math.hypot(q.x - 10, q.z) - 1.0) < 1e-9, `snap ${JSON.stringify(q)}`);
  assert.deepEqual(nearestFreePoint(3, 4, open, GOAL_SNAP), { x: 3, z: 4 });
  assert.equal(nearestFreePoint(10, 0, pillar(2.6), GOAL_SNAP), null);
});

test('(e) 대각선은 이웃한 두 직교 칸이 모두 비어 있을 때만(모서리 끼임 없음)', () => {
  const blocked = [[0.5, 0], [0, 0.5]];
  const isFree = (x, z) => !blocked.some(([bx, bz]) => Math.abs(x - bx) < 0.01 && Math.abs(z - bz) < 0.01);
  const p = findPath({ x: 0, z: 0 }, { x: 0.5, z: 0.5 }, { isFree });
  assert.ok(p);
  assert.ok(p.length > 2, '바로 대각선으로 건너뛰지 않는다');
});

test('(f) 50° 넘는 오르막은 오르지 않는다(보행과 같은 MAX_CLIMB) · 완만한 비탈은 오른다', () => {
  assert.equal(MAX_CLIMB, 1.2);
  const cliff = walkPredicates({ groundHeightAt: (x) => (x > 5 ? 10 : 0), blocker: null });
  assert.equal(cliff.canStep(4.5, 0, 5.5, 0), false);
  assert.equal(cliff.canStep(5.5, 0, 4.5, 0), true, '내려가기는 된다');
  assert.equal(findPath({ x: 0, z: 0 }, { x: 8, z: 0 }, { ...cliff, margin: 4 }), null);
  const ramp = walkPredicates({ groundHeightAt: (x) => Math.max(0, x * 0.5), blocker: null });
  assert.ok(findPath({ x: 0, z: 0 }, { x: 8, z: 0 }, ramp));
});

test('(g) walkPredicates: 장애물 판정은 보행과 같은 턱(STEP_UP) 기준', () => {
  const calls = [];
  const blocker = { isBlocked: (x, z, clr) => (calls.push(clr), x > 1), topAt: () => 0 };
  const { isFree } = walkPredicates({ groundHeightAt: () => 0, blocker });
  assert.equal(isFree(0, 0), true);
  assert.equal(isFree(2, 0), false);
  assert.deepEqual([...new Set(calls)], [STEP_UP]);
});

test('(h) planWalkPath: 보행 판정으로 찾고 다듬은 경로(벽 우회), 길이 없으면 null', () => {
  const blocker = { isBlocked: (x, z) => x > 4 && x < 6 && z > -8 && z < 8, topAt: () => 0 };
  const p = planWalkPath({ groundHeightAt: () => 0, blocker }, { x: 0, y: 1.7, z: 0 }, { x: 10, z: 0 });
  assert.ok(p && p.length >= 3);
  assert.deepEqual(p[0], { x: 0, z: 0 });
  assert.deepEqual(p.at(-1), { x: 10, z: 0 });
  const wallAll = { isBlocked: (x) => x > 4 && x < 6, topAt: () => 0 };
  assert.equal(planWalkPath({ groundHeightAt: () => 0, blocker: wallAll }, { x: 0, z: 0 }, { x: 10, z: 0 }), null);
});

test('(i) 따라 걷기: 걷기 속도로 경유점을 지나 도착 · 긴 경로는 달리기 · 남은 거리', () => {
  const pts = [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 3 }];
  const f = createPathFollower(pts);
  assert.equal(f.speed, WALK_SPEED);
  const pos = { x: 0, z: 0 };
  let r = f.step(pos, 0);
  assert.ok(Math.abs(r.remaining - 7) < 1e-9, `remaining ${r.remaining}`);
  let t = 0;
  for (; t < 5; t += 0.02) {
    r = f.step(pos, 0.02);
    if (r.done) break;
    assert.equal(r.stuck, false);
    assert.ok(Math.hypot(r.dx, r.dz) <= WALK_SPEED * 0.02 + 1e-9);
    pos.x += r.dx;
    pos.z += r.dz;
  }
  assert.equal(r.done, true);
  assert.ok(Math.hypot(pos.x - 4, pos.z - 3) <= ARRIVE_RADIUS);
  assert.ok(t > 6 / WALK_SPEED && t < 7 / WALK_SPEED + 0.1, `t=${t}`);
  assert.equal(createPathFollower([{ x: 0, z: 0 }, { x: RUN_PATH_LENGTH + 1, z: 0 }]).speed, RUN_SPEED);
});

test('(j) 막힘: STUCK_TIME 동안 0.2 m 도 못 나아가면 stuck', () => {
  const f = createPathFollower([{ x: 0, z: 0 }, { x: 10, z: 0 }]);
  const pos = { x: 0, z: 0 };
  let r;
  let t = 0;
  for (; t < STUCK_TIME + 0.5; t += 0.05) {
    r = f.step(pos, 0.05);
    if (r.stuck) break;
    pos.x += r.dx * 0.01;   // 거의 못 나아감(벽에 막힘)
  }
  assert.equal(r.stuck, true);
  assert.ok(t >= STUCK_TIME - 0.06 && t <= STUCK_TIME + 0.06, `t=${t}`);
});

test('(k) turnToward: 짧은 쪽으로 최대 maxDelta 만큼 · wrapAngle 은 (−π, π]', () => {
  assert.ok(Math.abs(turnToward(0, 1, 0.3) - 0.3) < 1e-12);
  assert.ok(Math.abs(turnToward(0, 0.1, 0.3) - 0.1) < 1e-12);
  const r = turnToward(3.0, -3.0, 0.1);   // π 를 넘어가는 짧은 쪽
  assert.ok(Math.abs(wrapAngle(r - 3.1)) < 1e-12, `r=${r}`);
  assert.ok(Math.abs(wrapAngle(3 * Math.PI) - Math.PI) < 1e-12);
  assert.ok(Math.abs(wrapAngle(-Math.PI) - Math.PI) < 1e-12);
});

test('(l) 탐색 상자가 PATH_MAX_CELLS 를 넘으면 null · 안이면 경로', () => {
  assert.equal(PATH_MAX_CELLS, 1_000_000);
  // (648 / 0.5 + 1)² ≈ 168만 칸 > 상한 → 열린 땅이어도 실패(호출부가 컷 이동)
  assert.equal(findPath({ x: 0, z: 0 }, { x: 600, z: 600 }, { isFree: open }), null);
  const p = findPath({ x: 0, z: 0 }, { x: 100, z: 0 }, { isFree: open });
  assert.ok(p && p.length >= 2, '상한 안의 목표는 경로가 나온다');
});
