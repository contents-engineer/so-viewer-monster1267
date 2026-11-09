// GLB(glTF 바이너리)의 JSON 청크 읽기 · 노드 월드 상자 · 삼각형 수 — 의존성 없는 테스트 도우미.
// npm test 의 tests/*.test.mjs 에 걸리지 않도록 tests/lib/ 아래에 둔다.
import { readFileSync } from 'node:fs';

export function readGlbJson(url) {
  const b = readFileSync(url);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error(`GLB 아님: ${url}`);
  if (b.readUInt32LE(16) !== 0x4e4f534a) throw new Error(`첫 청크가 JSON 이 아님: ${url}`);
  const len = b.readUInt32LE(12);
  return JSON.parse(b.subarray(20, 20 + len).toString('utf8'));
}

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// 노드 로컬 행렬(열 우선): matrix 가 있으면 그대로, 없으면 T · R · S
function localMatrix(n) {
  if (n.matrix) return n.matrix.slice();
  const [x, y, z, w] = n.rotation || [0, 0, 0, 1];
  const [sx, sy, sz] = n.scale || [1, 1, 1];
  const [tx, ty, tz] = n.translation || [0, 0, 0];
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  return [
    (1 - 2 * (yy + zz)) * sx, 2 * (xy + wz) * sx, 2 * (xz - wy) * sx, 0,
    2 * (xy - wz) * sy, (1 - 2 * (xx + zz)) * sy, 2 * (yz + wx) * sy, 0,
    2 * (xz + wy) * sz, 2 * (yz - wx) * sz, (1 - 2 * (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  }
  return o;
}

function apply(m, [x, y, z]) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

/** 장면에 걸린 노드마다 월드 행렬 — Map(노드 번호 → 열 우선 16). */
export function worldMatrices(json) {
  const out = new Map();
  const roots = json.scenes?.[json.scene ?? 0]?.nodes ?? [];
  const walk = (i, parent) => {
    const m = mul(parent, localMatrix(json.nodes[i]));
    out.set(i, m);
    for (const c of json.nodes[i].children || []) walk(c, m);
  };
  for (const r of roots) walk(r, IDENTITY);
  return out;
}

// meshopt 양자화(KHR_mesh_quantization)로 normalized 정수가 된 POSITION 의 min/max 를 −1…1 로
const NORM_MAX = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };
function accessorBounds(acc) {
  let { min, max } = acc;
  const k = acc.normalized ? NORM_MAX[acc.componentType] : 0;
  if (k && [...min, ...max].some((v) => Math.abs(v) > 1)) {
    min = min.map((v) => Math.max(v / k, -1));
    max = max.map((v) => Math.max(v / k, -1));
  }
  return { min, max };
}

/** 메시가 달린 노드마다 월드 축 정렬 상자 { name, min, max }(glTF = Three 좌표). */
export function meshNodeBoxes(json) {
  const boxes = [];
  for (const [i, m] of worldMatrices(json)) {
    const n = json.nodes[i];
    if (n.mesh == null) continue;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const p of json.meshes[n.mesh].primitives) {
      const b = accessorBounds(json.accessors[p.attributes.POSITION]);
      for (const cx of [b.min[0], b.max[0]]) {
        for (const cy of [b.min[1], b.max[1]]) {
          for (const cz of [b.min[2], b.max[2]]) {
            const w = apply(m, [cx, cy, cz]);
            for (let a = 0; a < 3; a++) {
              min[a] = Math.min(min[a], w[a]);
              max[a] = Math.max(max[a], w[a]);
            }
          }
        }
      }
    }
    boxes.push({ name: n.name || '', min, max });
  }
  return boxes;
}

/** 장면에 그려지는 삼각형 수(메시 노드 × 삼각형 모드 프리미티브). */
export function triangleCount(json) {
  let t = 0;
  for (const [i] of worldMatrices(json)) {
    const n = json.nodes[i];
    if (n.mesh == null) continue;
    for (const p of json.meshes[n.mesh].primitives) {
      if ((p.mode ?? 4) !== 4) continue;
      const count = p.indices != null ? json.accessors[p.indices].count : json.accessors[p.attributes.POSITION].count;
      t += count / 3;
    }
  }
  return Math.round(t);
}
