import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createHeightGrid,
  rasterizeTriangle,
  sampleHeightGrid,
  createGroundQuery,
  clampAboveGround,
  createOccupancyGrid,
  markObstacleTriangle,
  isBlockedAt,
  obstacleTopAt,
  resolveWalkStep,
} from '../public/src/nowhere/terrain.js';

// 좌표는 Three.js (x, y 위, z) — 높이 격자는 xz 평면 위 y(높이)를 담는다.

test('(a) 기운 삼각형을 래스터화하면 격자점 높이가 평면식과 일치한다', () => {
  const g = createHeightGrid({ x0: 0, z0: 0, x1: 20, z1: 20, cell: 1 });
  // y = 0.5 * x + 2 인 평면 위의 큰 삼각형 두 개(사각형)
  rasterizeTriangle(g, 0, 2, 0, 20, 12, 0, 20, 12, 20);
  rasterizeTriangle(g, 0, 2, 0, 20, 12, 20, 0, 2, 20);
  for (const [x, z] of [[3, 4], [10.5, 7.25], [17, 15]]) {
    assert.ok(Math.abs(sampleHeightGrid(g, x, z) - (0.5 * x + 2)) < 1e-4, `(${x}, ${z})`);
  }
});

test('(b) 겹치는 면은 더 높은 쪽(차도 위 연석 등)을 취하고, 덮이지 않은 곳은 null', () => {
  const g = createHeightGrid({ x0: 0, z0: 0, x1: 10, z1: 10, cell: 1 });
  rasterizeTriangle(g, 0, 1, 0, 10, 1, 0, 0, 1, 10);
  rasterizeTriangle(g, 0, 3, 0, 10, 3, 0, 0, 3, 10);
  assert.equal(sampleHeightGrid(g, 2, 2), 3);
  assert.equal(sampleHeightGrid(g, 9.5, 9.5), null);   // 대각선 바깥(덮이지 않음)
  assert.equal(sampleHeightGrid(g, -5, 2), null);       // 격자 바깥
});

test('(c) 조회는 고해상도 격자 → 저해상도 격자 → 기본값 순서로 내려간다', () => {
  const fine = createHeightGrid({ x0: 0, z0: 0, x1: 10, z1: 10, cell: 1 });
  rasterizeTriangle(fine, 0, 5, 0, 10, 5, 0, 10, 5, 10);
  rasterizeTriangle(fine, 0, 5, 0, 10, 5, 10, 0, 5, 10);
  const coarse = createHeightGrid({ x0: -100, z0: -100, x1: 100, z1: 100, cell: 10 });
  rasterizeTriangle(coarse, -100, 40, -100, 100, 40, -100, 100, 40, 100);
  rasterizeTriangle(coarse, -100, 40, -100, 100, 40, 100, -100, 40, 100);
  const groundAt = createGroundQuery([fine, coarse], 0);
  assert.equal(groundAt(5, 5), 5);
  assert.equal(groundAt(50, 50), 40);
  assert.equal(groundAt(500, 500), 0);
});

test('(d) clampAboveGround: 지면 + 여유고 아래로 내려간 카메라만 위로 올린다', () => {
  const groundAt = () => 12.4;
  const below = { x: 0, y: 1.7, z: 0 };
  assert.equal(clampAboveGround(below, groundAt, 1.0), true);
  assert.ok(Math.abs(below.y - 13.4) < 1e-9);
  const above = { x: 0, y: 30, z: 0 };
  assert.equal(clampAboveGround(above, groundAt, 1.0), false);
  assert.equal(above.y, 30);
});

// ── 보행 충돌(장애물 점유 격자) ──
const flat = () => 0;

test('(e) 몸통 높이(지면+0.3~1.9 m)에 걸친 수직 벽만 점유로 기록한다', () => {
  const g = createOccupancyGrid({ x0: -10, z0: -10, x1: 10, z1: 10, cell: 0.5 });
  // x = 2 평면의 수직 벽(z −5..5, 높이 0..3 m)
  markObstacleTriangle(g, 2, 0, -5, 2, 0, 5, 2, 3, 5, flat);
  markObstacleTriangle(g, 2, 0, -5, 2, 3, 5, 2, 3, -5, flat);
  assert.equal(isBlockedAt(g, 2, 0, 0), true);
  assert.equal(isBlockedAt(g, 2, 4, 0), true);
  assert.equal(isBlockedAt(g, 0, 0, 0), false);
  assert.equal(isBlockedAt(g, 1.8, 0, 0.35), true, '몸 반경 안에 벽이 있으면 막힘');
});

test('(f) 머리 위 캔틸레버(높이 5 m)와 지면 높이의 판은 막지 않는다', () => {
  const g = createOccupancyGrid({ x0: -10, z0: -10, x1: 10, z1: 10, cell: 0.5 });
  markObstacleTriangle(g, -5, 5, -5, 5, 5, -5, 5, 5, 5, flat);    // 처마 밑면
  markObstacleTriangle(g, -5, 0.1, -5, 5, 0.1, 5, -5, 0.1, 5, flat); // 지면에 깔린 판
  assert.equal(isBlockedAt(g, 0, 0, 0.35), false);
  assert.equal(isBlockedAt(g, 2, -2, 0.35), false);
});

test('(g) resolveWalkStep: 막힌 방향은 벽을 따라 미끄러지고, 완전히 막히면 제자리', () => {
  const free = (x, z) => x < 2;                    // x ≥ 2 는 벽
  assert.deepEqual(resolveWalkStep({ x: 0, z: 0 }, 1, 1, free), { x: 1, z: 1 });
  assert.deepEqual(resolveWalkStep({ x: 1.5, z: 0 }, 1, 1, free), { x: 1.5, z: 1 });   // x 막힘 → z 로만 미끄러짐
  assert.deepEqual(resolveWalkStep({ x: 1.5, z: 0 }, 1, 0, free), { x: 1.5, z: 0 });   // 정면 충돌 → 제자리
  // 이미 장애물 안에 서 있으면(진입 직후 등) 빠져나갈 수 있게 이동을 허용
  assert.deepEqual(resolveWalkStep({ x: 3, z: 0 }, 1, 0, free), { x: 4, z: 0 });
});

test('(h) 장애물 높이를 기억한다: 0.8 m 바위는 발이 충분히 높으면(점프 중) 막지 않고, 그 위에 올라설 높이를 준다', () => {
  const g = createOccupancyGrid({ x0: -10, z0: -10, x1: 10, z1: 10, cell: 0.5 });
  // x = 2 평면의 낮은 벽(높이 0.8 m)
  markObstacleTriangle(g, 2, 0, -2, 2, 0, 2, 2, 0.8, 2, flat);
  markObstacleTriangle(g, 2, 0, -2, 2, 0.8, 2, 2, 0.8, -2, flat);
  assert.equal(isBlockedAt(g, 2, 0, 0), true, '지면에 선 채로는 막힘');
  assert.equal(isBlockedAt(g, 2, 0, 0, 0.6 + 0.35), false, '발이 0.6 m 높이(+턱 0.35 m)면 넘어감');
  assert.equal(isBlockedAt(g, 2, 0, 0, 0.3 + 0.35), true, '발이 0.3 m 면 여전히 막힘');
  assert.ok(Math.abs(obstacleTopAt(g, 2, 0, 0) - 0.8) <= 0.1, `top=${obstacleTopAt(g, 2, 0, 0)}`);
  assert.equal(obstacleTopAt(g, -5, 0, 0), 0, '빈 칸은 0');
});

