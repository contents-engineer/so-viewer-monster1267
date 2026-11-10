import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const layout = JSON.parse(readFileSync(new URL('../public/assets/nowhere/layout.json', import.meta.url), 'utf8'));
const TOWERS = { T1: 128, T2: 104, T3: 84, T4: 116 };
const solid = (id) => layout.solids.find((b) => b.id === id);
const nearestXZ = (p, b) =>
  Math.hypot(Math.max(b.min[0] - p[0], 0, p[0] - b.max[0]), Math.max(b.min[2] - p[2], 0, p[2] - b.max[2]));

test('(a) 신축 타워 4동: 높이가 표와 같고(옥상 설비 +3 m 이내) 장면 사각형 밖에 선다', () => {
  const [x0, y0, x1, y1] = layout.maskRect;            // Blender (x, y) → three x, z = −y
  for (const [id, h] of Object.entries(TOWERS)) {
    const b = solid(`FU_tower_${id}`);
    assert.ok(b, `FU_tower_${id} 없음`);
    assert.ok(b.max[1] >= h - 0.5 && b.max[1] <= h + 3, `${id} 높이 ${b.max[1]}`);
    const outside = b.max[0] < x0 || b.min[0] > x1 || b.max[2] < -y1 || b.min[2] > -y0;
    assert.ok(outside, `${id} 가 장면 사각형과 겹친다`);
  }
});

test('(b) 주인공 유지: 거리 시점에서 각 타워의 투영 높이는 HAUS 의 0.6 배 이하', () => {
  const cam = layout.cameras.find((c) => c.id === 'street').pos;
  const haus = solid('HAUS');
  const tanH = (haus.max[1] - cam[1]) / nearestXZ(cam, haus);
  for (const id of Object.keys(TOWERS)) {
    const b = solid(`FU_tower_${id}`);
    const ratio = (b.max[1] - cam[1]) / nearestXZ(cam, b) / tanH;
    assert.ok(ratio <= 0.6, `${id}: HAUS 의 ${ratio.toFixed(2)} 배`);
  }
});

// GLB JSON 청크의 노드 이름(gltf-transform dedup · instance 가 같은 모양 메시 사본을 합치면 노드 이름이 사라진다)
function glbNodeNames(rel) {
  const buf = readFileSync(new URL(rel, import.meta.url));
  const len = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + len).toString('utf8'));
  return new Set((json.nodes || []).map((n) => n.name));
}

test('(c) 풍력 이름 유지: 데스크톱 · 모바일 future GLB 에 FU_turbine_rotor.0…4 · FU_turbine_mast.0…4 노드가 모두 있다', () => {
  for (const rel of ['../public/assets/nowhere/nowhere-future.glb', '../public/assets/nowhere/mobile/nowhere-future.glb']) {
    const names = glbNodeNames(rel);
    for (let i = 0; i < 5; i++) {
      for (const kind of ['rotor', 'mast']) {
        assert.ok(names.has(`FU_turbine_${kind}.${i}`), `${rel}: FU_turbine_${kind}.${i} 없음`);
      }
    }
  }
});
