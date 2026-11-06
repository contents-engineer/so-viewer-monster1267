// HAUS NOWHERE — 지형 높이 격자: 카메라가 지면 아래로 내려가 지형이 뒷면 컬링으로 사라지고
// "바닥 아래가 비쳐 보이는" 상태를 막기 위한 높이 조회. three 의존 없는 순수 모듈(테스트: tests/nowhere-terrain.test.mjs).
// 좌표는 Three.js (x, y 위, z). 격자점마다 그 점을 덮는 삼각형들의 높이 중 최댓값을 담는다(차도 위 연석·개울 수면 등 겹침).

export function createHeightGrid({ x0, z0, x1, z1, cell }) {
  const nx = Math.max(2, Math.floor((x1 - x0) / cell) + 1);
  const nz = Math.max(2, Math.floor((z1 - z0) / cell) + 1);
  const data = new Float32Array(nx * nz).fill(-Infinity);
  return { x0, z0, cell, nx, nz, data };
}

/** 삼각형 (a, b, c) 를 xz 평면에 투영해 덮는 격자점에 높이(y)를 최댓값으로 기록한다. */
export function rasterizeTriangle(g, ax, ay, az, bx, by, bz, cx, cy, cz) {
  const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
  if (Math.abs(det) < 1e-9) return;   // xz 로 보면 선분(수직 벽면) — 높이 격자에 기여하지 않음
  const inv = 1 / det;
  const { x0, z0, cell, nx, nz, data } = g;
  const i0 = Math.max(0, Math.ceil((Math.min(ax, bx, cx) - x0) / cell));
  const i1 = Math.min(nx - 1, Math.floor((Math.max(ax, bx, cx) - x0) / cell));
  const j0 = Math.max(0, Math.ceil((Math.min(az, bz, cz) - z0) / cell));
  const j1 = Math.min(nz - 1, Math.floor((Math.max(az, bz, cz) - z0) / cell));
  const eps = -1e-6;
  for (let j = j0; j <= j1; j++) {
    const pz = z0 + j * cell;
    for (let i = i0; i <= i1; i++) {
      const px = x0 + i * cell;
      const w1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) * inv;
      if (w1 < eps) continue;
      const w2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) * inv;
      if (w2 < eps) continue;
      const w3 = 1 - w1 - w2;
      if (w3 < eps) continue;
      const h = w1 * ay + w2 * by + w3 * cy;
      const k = j * nx + i;
      if (h > data[k]) data[k] = h;
    }
  }
}

/** 격자 위 (x, z) 의 높이(쌍선형 보간). 격자 밖이거나 네 꼭짓점 중 하나라도 비어 있으면 null. */
export function sampleHeightGrid(g, x, z) {
  const fx = (x - g.x0) / g.cell;
  const fz = (z - g.z0) / g.cell;
  if (fx < 0 || fz < 0 || fx > g.nx - 1 || fz > g.nz - 1) return null;
  const i = Math.min(g.nx - 2, Math.floor(fx));
  const j = Math.min(g.nz - 2, Math.floor(fz));
  const u = fx - i;
  const v = fz - j;
  const d = g.data;
  const h00 = d[j * g.nx + i];
  const h10 = d[j * g.nx + i + 1];
  const h01 = d[(j + 1) * g.nx + i];
  const h11 = d[(j + 1) * g.nx + i + 1];
  if (h00 === -Infinity || h10 === -Infinity || h01 === -Infinity || h11 === -Infinity) return null;
  return (h00 * (1 - u) + h10 * u) * (1 - v) + (h01 * (1 - u) + h11 * u) * v;
}

/** 격자 목록(고해상도 → 저해상도)을 차례로 조회하고, 모두 비면 fallback 을 돌려주는 지면 높이 함수. */
export function createGroundQuery(grids, fallback = 0) {
  return (x, z) => {
    for (const g of grids) {
      const h = sampleHeightGrid(g, x, z);
      if (h !== null) return h;
    }
    return fallback;
  };
}

/** position.y 가 지면 + clearance 보다 낮으면 그 높이로 올리고 true 를 돌려준다. */
export function clampAboveGround(position, groundAt, clearance) {
  const minY = groundAt(position.x, position.z) + clearance;
  if (position.y < minY) {
    position.y = minY;
    return true;
  }
  return false;
}

// ── 보행 충돌: 장애물 점유 격자 ──
// 장애물 삼각형 중 "지면 + bandLow ~ 지면 + bandHigh"(몸통 높이)에 걸친 부분만 xz 격자 칸에 기록한다.
// 머리 위 처마·필로티 상부·지면에 깔린 판은 기록하지 않는다. 칸 값 = 그 칸 장애물 윗면의 지면 위 높이(0.1 m 단위, 0 = 빈 칸)
// → 점프로 낮은 바위를 넘거나 그 위에 올라설 수 있다.

export function createOccupancyGrid({ x0, z0, x1, z1, cell }) {
  const nx = Math.max(1, Math.ceil((x1 - x0) / cell));
  const nz = Math.max(1, Math.ceil((z1 - z0) / cell));
  return { x0, z0, cell, nx, nz, data: new Uint8Array(nx * nz) };
}

function markCell(g, x, z, relTop) {
  const i = Math.floor((x - g.x0) / g.cell);
  const j = Math.floor((z - g.z0) / g.cell);
  if (i < 0 || j < 0 || i >= g.nx || j >= g.nz) return;
  const k = j * g.nx + i;
  const v = Math.min(255, Math.max(1, Math.ceil(relTop * 10 - 1e-6)));
  if (v > g.data[k]) g.data[k] = v;
}

/** 삼각형 표면을 칸 크기 절반 간격으로 표본화해, 표본 높이가 그 자리 지면 기준 몸통 높이 띠 안이면 칸을 막는다. */
export function markObstacleTriangle(g, ax, ay, az, bx, by, bz, cx, cy, cz, groundAt, bandLow = 0.3, bandHigh = 1.9) {
  // 빠른 기각: 삼각형 전체가 띠보다 위(처마) 또는 아래(지면)
  const gMin = Math.min(groundAt(ax, az), groundAt(bx, bz), groundAt(cx, cz));
  const gMax = Math.max(groundAt(ax, az), groundAt(bx, bz), groundAt(cx, cz));
  if (Math.min(ay, by, cy) > gMax + bandHigh) return;
  if (Math.max(ay, by, cy) < gMin + bandLow) return;
  const maxEdge = Math.max(
    Math.hypot(bx - ax, by - ay, bz - az),
    Math.hypot(cx - bx, cy - by, cz - bz),
    Math.hypot(ax - cx, ay - cy, az - cz),
  );
  const n = Math.min(400, Math.max(1, Math.ceil(maxEdge / (g.cell * 0.5))));
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n - i; j++) {
      const u = i / n;
      const v = j / n;
      const w = 1 - u - v;
      const y = u * ay + v * by + w * cy;
      const x = u * ax + v * bx + w * cx;
      const z = u * az + v * bz + w * cz;
      const gy = groundAt(x, z);
      if (y > gy + bandLow && y < gy + bandHigh) markCell(g, x, z, y - gy);
    }
  }
}

/** 반경 radius 의 몸(중심 + 둘레 8점)이 걸치는 칸들 중 가장 높은 장애물 윗면(지면 위 m). 빈 칸·격자 밖은 0. */
export function obstacleTopAt(g, x, z, radius = 0) {
  const pts = radius > 0 ? 9 : 1;
  let top = 0;
  for (let k = 0; k < pts; k++) {
    const a = (k - 1) * Math.PI / 4;
    const px = k === 0 ? x : x + Math.cos(a) * radius;
    const pz = k === 0 ? z : z + Math.sin(a) * radius;
    const i = Math.floor((px - g.x0) / g.cell);
    const j = Math.floor((pz - g.z0) / g.cell);
    if (i < 0 || j < 0 || i >= g.nx || j >= g.nz) continue;
    top = Math.max(top, g.data[j * g.nx + i] / 10);
  }
  return top;
}

/** 몸이 막히는지: 걸치는 장애물 윗면이 clearance(발 높이 + 오를 수 있는 턱, 지면 위 m)보다 높으면 막힘.
 *  clearance 0(기본) = 장애물이 조금이라도 있으면 막힘. */
export function isBlockedAt(g, x, z, radius = 0, clearance = 0) {
  return obstacleTopAt(g, x, z, radius) > clearance;
}

/** 보행 한 걸음: 전체 이동 → 막히면 x 만 → z 만(벽 따라 미끄러짐) → 모두 막히면 제자리.
 *  이미 막힌 자리에 서 있으면(진입 직후 등) 빠져나갈 수 있게 그대로 이동한다. */
export function resolveWalkStep(pos, dx, dz, canStand) {
  if (!canStand(pos.x, pos.z)) return { x: pos.x + dx, z: pos.z + dz };
  if (canStand(pos.x + dx, pos.z + dz)) return { x: pos.x + dx, z: pos.z + dz };
  if (dx !== 0 && canStand(pos.x + dx, pos.z)) return { x: pos.x + dx, z: pos.z };
  if (dz !== 0 && canStand(pos.x, pos.z + dz)) return { x: pos.x, z: pos.z + dz };
  return { x: pos.x, z: pos.z };
}
