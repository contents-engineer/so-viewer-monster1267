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

test('(i) 승강장 구간 튜브: FU_tube_ribs_s 가 22.8 … 91.2 를 덮고, 서 · 승강장 · 동 리브 상자가 x 로 끊김 없이 이어진다', () => {
  const s = solid('FU_tube_ribs_s');
  assert.ok(s, 'FU_tube_ribs_s 없음');
  assert.ok(s.min[0] <= 22.8 + 0.5 && s.max[0] >= 91.2 - 0.5, `승강장 튜브 x ${s.min[0]} … ${s.max[0]}`);
  assert.ok(s.max[1] >= 14.5, `승강장 튜브 꼭대기 ${s.max[1]}`);
  const w = solid('FU_tube_ribs_w'), e = solid('FU_tube_ribs_e');
  assert.ok(Math.abs(w.max[0] - s.min[0]) <= 1.0 && Math.abs(s.max[0] - e.min[0]) <= 1.0, '구간 사이 틈');
});

// Task 12: GLB JSON 청크(노드 · 메시 · 재질)와 world.js 원문
function glbJson(rel) {
  const buf = readFileSync(new URL(rel, import.meta.url));
  return JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8'));
}
const worldSrc = readFileSync(new URL('../public/src/nowhere/world.js', import.meta.url), 'utf8');
const srcRegex = (name) => {
  const m = worldSrc.match(new RegExp(`const ${name} = /(.+)/;`));
  assert.ok(m, `world.js 에 ${name} 없음`);
  return new RegExp(m[1]);
};

test('(j) 원경 · 모바일(Task 12): BD_far_desk 는 데스크톱 전용(모바일 숨김), 공원 느티나무 8 · 카페 테라스 6 은 모바일에서도 솎지 않는다', () => {
  const MOBILE_HIDE = srcRegex('MOBILE_HIDE');
  const MOBILE_FULL_INST = srcRegex('MOBILE_FULL_INST');
  for (const rel of ['../public/assets/nowhere/nowhere-backdrop.glb', '../public/assets/nowhere/mobile/nowhere-backdrop.glb']) {
    const names = new Set(glbJson(rel).nodes.map((n) => n.name));
    assert.ok(names.has('BD_far') && names.has('BD_far_desk'), `${rel}: BD_far · BD_far_desk 없음`);
  }
  assert.ok(MOBILE_HIDE.test('BD_far_desk') && !MOBILE_HIDE.test('BD_far'), 'MOBILE_HIDE 가 BD_far_desk 만 숨겨야 한다');
  // 모바일 GLB 의 인스턴스 노드: 메시 이름(GLTFLoader 가 InstancedMesh 이름으로 쓴다)과 인스턴스 수
  const inst = (rel) => {
    const j = glbJson(rel);
    const out = {};
    for (const n of j.nodes) {
      const ext = n.extensions?.EXT_mesh_gpu_instancing;
      if (ext) out[j.meshes[n.mesh].name] = j.accessors[Object.values(ext.attributes)[0]].count;
    }
    return out;
  };
  const present = inst('../public/assets/nowhere/mobile/nowhere-present.glb');
  const future = inst('../public/assets/nowhere/mobile/nowhere-future.glb');
  assert.equal(present.PR_zelkova_a, 8, '공원 느티나무 PR_zelkova_a 8 그루');
  assert.equal(future.FU_terrace, 6, '카페 테라스 FU_terrace 6 조');
  for (const nm of ['PR_zelkova_a', 'PR_zelkova_a_1', 'FU_terrace', 'FU_terrace_1']) assert.ok(MOBILE_FULL_INST.test(nm), `${nm} 를 솎는다`);
  for (const nm of ['PR_zelkova_b', 'PR_planter', 'PR_shrub']) assert.ok(!MOBILE_FULL_INST.test(nm), `${nm} 는 솎아야 한다(모바일 예산)`);
});

test('(k) 튜브 유리(Task 12): future GLB 알파 = world.js GLASS_OPACITY, 짙은 청회색(옅은 #BFD8E6 아님)', () => {
  const m = worldSrc.match(/NWF_tube_glass: ([0-9.]+), NWF_glass_rail/);
  assert.ok(m, 'GLASS_OPACITY 에 NWF_tube_glass 없음');
  for (const rel of ['../public/assets/nowhere/nowhere-future.glb', '../public/assets/nowhere/mobile/nowhere-future.glb']) {
    const mat = glbJson(rel).materials.find((x) => x.name === 'NWF_tube_glass');
    assert.ok(mat, `${rel}: NWF_tube_glass 없음`);
    const [r, g, b, a] = mat.pbrMetallicRoughness.baseColorFactor;
    assert.ok(Math.abs(a - Number(m[1])) < 1e-3, `알파 ${a} ≠ GLASS_OPACITY ${m[1]}`);
    assert.ok(Math.max(r, g, b) < 0.3 && b > r, `유리 색(선형) ${[r, g, b].map((v) => v.toFixed(3))}`);
  }
});

// 날으는 로드스터(2026-11-12): GLB 노드 아래 삼각형 수(인덱스 / 3). skip(자식 노드)이 참이면 그 자식은 세지 않는다
function subtreeTris(j, idx, skip) {
  const n = j.nodes[idx];
  let tris = 0;
  if (n.mesh !== undefined) {
    for (const p of j.meshes[n.mesh].primitives) {
      tris += (p.indices !== undefined ? j.accessors[p.indices].count : j.accessors[p.attributes.POSITION].count) / 3;
    }
  }
  for (const c of n.children || []) if (!skip(j.nodes[c])) tris += subtreeTris(j, c, skip);
  return tris;
}
// 차체 노드는 자식(분사)이 있어 optimize 의 위치 양자화가 메시를 이름 없는 자식 노드로 옮긴다 → 메시가 달린 노드를 찾는다
const meshNodeOf = (j, idx) =>
  j.nodes[idx].mesh !== undefined ? j.nodes[idx] : (j.nodes[idx].children || []).map((c) => j.nodes[c]).find((c) => !c.name && c.mesh !== undefined);
const FUTURE_GLBS = ['../public/assets/nowhere/nowhere-future.glb', '../public/assets/nowhere/mobile/nowhere-future.glb'];

test('(l) 날으는 로드스터: future GLB(데스크톱 · 모바일)에 차체 FU_roadster_a · b(NWF_mover 한 장, ≤ 3,000 삼각형)와 자식 분사(NWF_plume, ≤ 400, 모양 키 rear · bottom)', () => {
  for (const rel of FUTURE_GLBS) {
    const j = glbJson(rel);
    const idx = (name) => j.nodes.findIndex((n) => n.name === name);
    for (const car of ['FU_roadster_a', 'FU_roadster_b']) {
      const ci = idx(car);
      const pi = idx(`${car}_plume`);
      assert.ok(ci >= 0 && pi >= 0, `${rel}: ${car} · ${car}_plume 없음`);
      assert.ok((j.nodes[ci].children || []).includes(pi), `${rel}: ${car}_plume 이 ${car} 의 자식이 아니다`);
      const body = subtreeTris(j, ci, (c) => Boolean(c.name));   // 이름 있는 자식(분사)은 빼고, 양자화가 만든 이름 없는 메시 자식은 센다
      const plume = subtreeTris(j, pi, () => true);
      assert.ok(body > 0 && body <= 3000, `${rel}: ${car} 삼각형 ${body}`);
      assert.ok(plume > 0 && plume <= 400, `${rel}: ${car}_plume 삼각형 ${plume}`);
      const bm = j.meshes[meshNodeOf(j, ci).mesh];
      assert.equal(bm.primitives.length, 1, `${rel}: ${car} 프리미티브 ${bm.primitives.length}(재질 한 장 = 그리기 1)`);
      assert.equal(j.materials[bm.primitives[0].material].name, 'NWF_mover');
      const pm = j.meshes[j.nodes[pi].mesh];
      assert.equal(j.materials[pm.primitives[0].material].name, 'NWF_plume');
      assert.equal(pm.primitives[0].targets?.length, 2, `${rel}: ${car}_plume 모양 키 ${pm.primitives[0].targets?.length}`);
      assert.deepEqual(pm.extras?.targetNames ?? ['rear', 'bottom'], ['rear', 'bottom']);   // 이름이 없으면 웹은 Blender 순서(0 rear · 1 bottom)를 쓴다
    }
  }
});

test('(m) 정차 포드: layout.solids 에 FU_parked_pod.0 · .1(서행 바깥 차로 연석 쪽, x −67 · −73 — CP 로 거리 시점 쪽으로 당김), future GLB 에 메시 FU_parked_pod 인스턴스 2', () => {
  for (const [id, x] of [['FU_parked_pod.0', -67], ['FU_parked_pod.1', -73]]) {
    const b = solid(id);
    assert.ok(b, `${id} 없음`);
    const cx = (b.min[0] + b.max[0]) / 2;
    const cz = (b.min[2] + b.max[2]) / 2;
    assert.ok(Math.abs(cx - x) <= 0.5 && Math.abs(cz - 36.9) <= 0.3, `${id} 가운데 (${cx}, ${cz})`);
    assert.ok(b.max[1] <= 1.9 && b.min[2] >= 35.75, `${id} 지붕 ${b.max[1]} · 연석 쪽 ${b.min[2]}`);
  }
  for (const rel of FUTURE_GLBS) {
    const j = glbJson(rel);
    const mi = j.meshes.findIndex((m) => m.name === 'FU_parked_pod');
    assert.ok(mi >= 0, `${rel}: 메시 FU_parked_pod 없음`);
    let count = 0;
    for (const n of j.nodes) {
      if (n.mesh !== mi) continue;
      const inst = n.extensions?.EXT_mesh_gpu_instancing;
      count += inst ? j.accessors[Object.values(inst.attributes)[0]].count : 1;
    }
    assert.equal(count, 2, `${rel}: 정차 포드 ${count} 대`);
  }
});

test('(n) 로드스터 웹 연결(world.js): 차체 · 분사는 이동체(병합 · 보행 장애물에서 빠짐), 정차 포드는 정적(보행 장애물), 휴대폰 숨김은 셋 모두', () => {
  const MOVER_NODE = srcRegex('MOVER_NODE');
  const ROADSTER_ONLY = srcRegex('ROADSTER_ONLY');
  for (const nm of ['FU_roadster_a', 'FU_roadster_b', 'FU_roadster_a_plume', 'FU_taxi0']) assert.ok(MOVER_NODE.test(nm), `MOVER_NODE: ${nm}`);
  for (const nm of ['FU_parked_pod', 'FU_parked_pod0', 'FU_terrace']) assert.ok(!MOVER_NODE.test(nm), `MOVER_NODE 가 ${nm} 를 이동체로 본다`);
  for (const nm of ['FU_roadster_a', 'FU_roadster_b_plume', 'FU_parked_pod', 'FU_parked_pod1']) assert.ok(ROADSTER_ONLY.test(nm), `ROADSTER_ONLY: ${nm}`);
  for (const nm of ['FU_taxi0', 'FU_terrace', 'PR_zelkova_a', 'NW_Merged_future_NWF_mover']) assert.ok(!ROADSTER_ONLY.test(nm), `ROADSTER_ONLY 가 ${nm} 를 숨긴다`);
});
