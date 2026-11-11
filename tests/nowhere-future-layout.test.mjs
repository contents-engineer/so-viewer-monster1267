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

test('(d) T1 은 2041 골목 시점 화면 안쪽에 보인다(가로 NDC |x| ≤ 0.6)', () => {
  const cam = layout.cameras.find((c) => c.id === 'future');
  const b = solid('FU_tower_T1');
  const c = [(b.min[0] + b.max[0]) / 2, b.max[1] * 0.75, (b.min[2] + b.max[2]) / 2];
  const f = cam.target.map((v, i) => v - cam.pos[i]);
  const fl = Math.hypot(f[0], f[2]);
  const fwd = [f[0] / fl, f[2] / fl];                      // 수평 앞
  const right = [-fwd[1], fwd[0]];                        // three: x 오른쪽, z 아래쪽(남)
  const d = [c[0] - cam.pos[0], c[2] - cam.pos[2]];
  const z = d[0] * fwd[0] + d[1] * fwd[1];
  const x = d[0] * right[0] + d[1] * right[1];
  assert.ok(z > 0, 'T1 이 카메라 뒤에 있다');
  const halfH = Math.atan(Math.tan((cam.fov * Math.PI) / 360) * (16 / 9));   // fov = 세로 시야각(도), 16:9 가로 반각
  const ndc = x / z / Math.tan(halfH);
  assert.ok(Math.abs(ndc) <= 0.6, `T1 가로 NDC ${ndc.toFixed(2)}`);
});

test('(e) 튜브 · 스카이브리지: 상자가 있고, 상판 아래 차도 여유 · 튜브 높이가 설계값이다', () => {
  for (const id of ['FU_tube_ribs_w', 'FU_tube_ribs_e', 'FU_bridge_SB1_deck', 'FU_bridge_SB2_deck',
    'FU_bridge_SB1_col.0', 'FU_bridge_SB1_col.1', 'FU_bridge_SB2_col.0', 'FU_bridge_SB2_col.1']) {
    assert.ok(solid(id), `${id} 없음`);
  }
  assert.ok(solid('FU_bridge_SB1_deck').min[1] >= 8.4, 'SB1 상판 밑 ≥ 8.4 m');
  assert.ok(solid('FU_bridge_SB2_deck').min[1] >= 9.4, 'SB2 상판 밑 ≥ 9.4 m');
  for (const id of ['FU_tube_ribs_w', 'FU_tube_ribs_e']) {
    const b = solid(id);
    assert.ok(b.max[1] >= 14.5 && b.max[1] <= 15.5, `${id} 꼭대기 ${b.max[1]}`);
    assert.ok(b.min[1] >= 8.9, `${id} 바닥 ${b.min[1]}`);
  }
});

test('(f) 열차 이름 유지: 데스크톱 · 모바일 future GLB 에 FU_train_a · FU_train_b 노드가 있다(Task 11 이동체가 이 이름으로 찾는다)', () => {
  for (const rel of ['../public/assets/nowhere/nowhere-future.glb', '../public/assets/nowhere/mobile/nowhere-future.glb']) {
    const names = glbNodeNames(rel);
    for (const id of ['FU_train_a', 'FU_train_b']) assert.ok(names.has(id), `${rel}: ${id} 없음`);
  }
});

test('(g) 이동체 이름 유지: 데스크톱 · 모바일 future GLB 에 포드 FU_taxi.0…4 · 배송로봇 FU_bot.0…2 노드가 있다(Task 11 이동체가 이 이름으로 찾는다)', () => {
  for (const rel of ['../public/assets/nowhere/nowhere-future.glb', '../public/assets/nowhere/mobile/nowhere-future.glb']) {
    const names = glbNodeNames(rel);
    for (let i = 0; i < 5; i++) assert.ok(names.has(`FU_taxi.${i}`), `${rel}: FU_taxi.${i} 없음`);
    for (let i = 0; i < 3; i++) assert.ok(names.has(`FU_bot.${i}`), `${rel}: FU_bot.${i} 없음`);
  }
});

// 배송로봇 길(§4.3 · §4.4, Blender 좌표 → three x, z = −y). 높이 0.8 m 아래에서 시작하는 solid 만 본다(스카이브리지 상판 · 튜브는 위로 지나간다)
const BOT_LANES = {
  bot0: { x: [-95.35, 60.35], z: [31.5, 32.9] },        // 뚝섬로 북측 보도 y −32.9 … −31.5, x −95 ↔ 60(+ 몸 반길이)
  bot1: { x: [73.525, 74.275], z: [-132.0, 28.0] },     // 동쪽 골목 동측 보도 x 73.9 ± 0.375, y −28 ↔ 132(Task 11: 74.2 → 73.9)
};
const laneHits = (lane) => layout.solids.filter((b) => b.min[1] < 0.8 &&
  b.min[0] < lane.x[1] && b.max[0] > lane.x[0] && b.min[2] < lane.z[1] && b.max[2] > lane.z[0]).map((b) => b.id);

test('(h) 스마트 거리 소품: 투명 키오스크 solid 6 개, 배송로봇 길(bot0 · bot1)과 겹치는 solid 가 없다', () => {
  const kiosks = layout.solids.filter((b) => b.id.startsWith('FU_kiosk_glass.'));
  assert.equal(kiosks.length, 6, `FU_kiosk_glass solid ${kiosks.length} 개`);
  for (const [id, lane] of Object.entries(BOT_LANES)) {
    const hits = laneHits(lane);
    assert.deepEqual(hits, [], `${id} 길과 겹침: ${hits.join(', ')}`);
  }
});
