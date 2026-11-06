import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFlightPath, FLIGHT_MIN_S, FLIGHT_MAX_S, FLIGHT_MIN_RISE } from '../public/src/nowhere/flight.js';

const A = { pos: [-105, 1.7, 50.2], target: [-30, 5, 31] };
const B = { pos: [0, 3.2, 46], target: [0, 10, 0] };

test('(a) 시작 · 끝 제어점과 시선 타깃이 두 시점과 정확히 같다', () => {
  const p = buildFlightPath(A, B);
  assert.deepEqual(p.points[0], A.pos);
  assert.deepEqual(p.points[p.points.length - 1], B.pos);
  assert.deepEqual(p.targets[0], A.target);
  assert.deepEqual(p.targets[p.targets.length - 1], B.target);
  assert.equal(p.points.length, p.targets.length);
});

test('(b) 경로 최고점은 두 시점보다 최소 상승 높이(25 m) 이상 높다', () => {
  const p = buildFlightPath(A, B);
  const top = Math.max(...p.points.map((q) => q[1]));
  assert.ok(top >= Math.max(A.pos[1], B.pos[1]) + FLIGHT_MIN_RISE - 1e-9, `top=${top}`);
});

test('(c) 시간 = 거리 / 40 m/s 를 4~8 초로 자른다', () => {
  assert.equal(buildFlightPath({ pos: [0, 2, 0], target: [0, 2, -5] }, { pos: [10, 2, 0], target: [10, 2, -5] }).duration, FLIGHT_MIN_S);
  assert.equal(buildFlightPath({ pos: [0, 2, 0], target: [0, 2, -5] }, { pos: [1000, 2, 0], target: [1000, 2, -5] }).duration, FLIGHT_MAX_S);
  assert.ok(Math.abs(buildFlightPath({ pos: [0, 2, 0], target: [0, 2, -5] }, { pos: [200, 2, 0], target: [200, 2, -5] }).duration - 5) < 1e-9);
});

test('(d) 먼 거리는 상승 높이도 거리의 15 % 로 커진다', () => {
  const p = buildFlightPath({ pos: [0, 2, 0], target: [0, 2, -5] }, { pos: [1000, 2, 0], target: [1000, 2, -5] });
  const top = Math.max(...p.points.map((q) => q[1]));
  assert.ok(top >= 2 + 150 - 1e-9, `top=${top}`);
});
