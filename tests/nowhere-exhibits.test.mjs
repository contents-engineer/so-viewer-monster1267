import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../public/vendor/three/three.module.js';
import {
  EXHIBIT_TAG_RANGE, EXHIBIT_TAG_LIFT, EXHIBIT_PICK_RANGE, CLICK_SLOP, EXHIBIT_NODES, EXHIBIT_HINT, EXHIBIT_PACK,
  exhibitNodeMatch, exhibitItems, exhibitCollection, cloneExhibit,
} from '../public/src/nowhere/exhibits.js';
import { stepItem } from '../public/src/nowhere/products.js';
import { CLICK_SLOP as ARCHIVE_CLICK_SLOP } from '../public/src/nowhere/archive.js';
import { readGlbJson } from './lib/glb.mjs';

// 실내 전시물 감상(exhibits.js) — inner-layout 의 전시물 10 점 · 층 GLB 의 EX_* 노드 대응 · 감상 목록 · 노드 복제 묶음, main · interior · showcase 연결
const PUB = new URL('../public/', import.meta.url);
const SRC = new URL('src/nowhere/', PUB);
const read = (f) => readFileSync(new URL(f, SRC), 'utf8');
const inner = JSON.parse(readFileSync(new URL('assets/nowhere-inner/inner-layout.json', PUB), 'utf8'));
const floorOf = (id) => inner.floors.find((f) => f.id === id);
const HINT = '드래그 · 한 손가락 회전 · 휠 · 두 손가락 확대 · ← → 다른 전시물 · Esc 나가기';
const fnBody = (src, head) => {
  const m = src.match(new RegExp(`${head.replace(/[()]/g, '\\$&')} \\{[\\s\\S]*?\\n  \\}\\n`));
  assert.ok(m, `${head} 를 찾지 못함`);
  return m[0];
};

// 층 GLB(데스크톱 · 모바일 사본)의 노드 이름 — 층마다 [층, 판, 이름 목록]
const glbNodes = inner.floors.flatMap((f) => [['desktop', f.glb], ['mobile', f.mobileGlb]].map(([tier, url]) => [f, tier, readGlbJson(new URL(url, PUB)).nodes.map((n) => n.name || '')]));
const exhibitsOfNode = (name) => Object.keys(EXHIBIT_NODES).filter((id) => exhibitNodeMatch(id, name));

test('(a) 값: 이름표 8 m(수평) · 0.6 m 위 · 픽 15 m · 클릭 5 px(건물 · 리테일과 같은 값) · 노드 대응표(스펙 §2 그대로)', () => {
  assert.equal(EXHIBIT_TAG_RANGE, 8);
  assert.equal(EXHIBIT_TAG_LIFT, 0.6);
  assert.equal(EXHIBIT_PICK_RANGE, 15);
  assert.equal(CLICK_SLOP, 5);
  assert.equal(CLICK_SLOP, ARCHIVE_CLICK_SLOP);
  assert.match(read('retail-display.js'), new RegExp(`const CLICK_SLOP = ${CLICK_SLOP};`), 'retail 과 같은 값');
  assert.deepEqual(EXHIBIT_NODES, {
    cafe: { prefix: ['EX_table_', 'EX_guest_'] },
    city_model: { prefix: ['EX_city_'], exact: ['EX_plinth'] },
    dj: { prefix: ['EX_dj'] },
    display: { prefix: ['EX_display'] },
    cowboy: { prefix: ['EX_cowboy', 'EX_plinth_cowboy'] },
    smoking: { prefix: ['EX_smoking'] },
    portal: { prefix: ['EX_portal'] },
    nail: { prefix: ['EX_nail'] },
    sphinx: { prefix: ['EX_sphinx'] },
    monsters: { prefix: ['EX_monster_', 'EX_nameplate_m', 'EX_plinth_m'] },
  });
  // 표의 전시물 = inner-layout 의 전시물(10 점, 빠지거나 남는 것 없음)
  const ids = inner.floors.flatMap((f) => (f.exhibits || []).map((e) => e.id));
  assert.equal(ids.length, 10);
  assert.deepEqual(Object.keys(EXHIBIT_NODES).sort(), [...ids].sort());
  assert.equal(EXHIBIT_HINT, HINT);
});

test('(b) 노드 대응 규칙: 접두사 · 정확히 — EX_plinth 는 정확히만(1F 도시 모형), EX_display 는 화면 EX_display_screen 도', () => {
  assert.deepEqual(exhibitsOfNode('EX_plinth'), ['city_model']);
  assert.deepEqual(exhibitsOfNode('EX_plinth_cowboy'), ['cowboy'], 'EX_plinth_cowboy 는 도시 모형이 아니다');
  assert.equal(exhibitNodeMatch('city_model', 'EX_plinth_cowboy'), false);
  assert.equal(exhibitNodeMatch('city_model', 'EX_plinth_m0'), false);
  assert.deepEqual(exhibitsOfNode('EX_plinth_m2'), ['monsters']);
  assert.deepEqual(exhibitsOfNode('EX_display'), ['display']);
  assert.deepEqual(exhibitsOfNode('EX_display_screen'), ['display']);
  assert.deepEqual(exhibitsOfNode('EX_city_haus'), ['city_model']);
  assert.deepEqual(exhibitsOfNode('EX_nameplate_m3'), ['monsters']);
  assert.deepEqual(exhibitsOfNode('EX_guest_1'), ['cafe']);
  for (const name of ['EX_elevator_l', 'EX_elevator_r', 'IN_floor', 'IN_wall_n', 'NW_Retail_1', '', 'ex_dj', 'EX_plinthX']) assert.deepEqual(exhibitsOfNode(name), [], name);
  assert.equal(exhibitNodeMatch('nope', 'EX_dj'), false, '표에 없는 전시물');
});

test('(c) 층 GLB: 모든 전시물이 데스크톱 · 모바일 층 GLB 에서 노드 1 개 이상, 엘리베이터 · IN_* 는 어느 전시물도 아니고, 나머지 EX_* 는 그 층 전시물 하나에만', () => {
  for (const [f, tier, names] of glbNodes) {
    const here = (f.exhibits || []).map((e) => e.id);
    for (const id of here) assert.ok(names.filter((n) => exhibitNodeMatch(id, n)).length >= 1, `${f.id} ${tier}: ${id} 노드 없음`);
    const elevators = names.filter((n) => n.startsWith('EX_elevator_'));
    assert.equal(elevators.length, 2, `${f.id} ${tier}: 엘리베이터 문 두 개`);
    for (const n of names) {
      const hit = exhibitsOfNode(n);
      if (n.startsWith('EX_elevator_') || !n.startsWith('EX_')) assert.deepEqual(hit, [], `${f.id} ${tier}: ${n} 는 전시물이 아니다`);
      else {
        assert.equal(hit.length, 1, `${f.id} ${tier}: ${n} → ${hit}`);
        assert.ok(here.includes(hit[0]), `${f.id} ${tier}: ${n} 가 다른 층 전시물 ${hit[0]}`);
      }
    }
  }
  // 표의 예: 1F 도시 모형 = 건물 네 동 + 받침대, 13F 몬스터 = 몬스터 · 명판 · 받침대 각 4
  const one = glbNodes.find(([f, tier]) => f.id === '1' && tier === 'desktop')[2];
  assert.deepEqual(one.filter((n) => exhibitNodeMatch('city_model', n)).sort(), ['EX_city_b1', 'EX_city_b2', 'EX_city_b3', 'EX_city_haus', 'EX_plinth']);
  assert.deepEqual(one.filter((n) => exhibitNodeMatch('display', n)).sort(), ['EX_display', 'EX_display_screen']);
  const thirteen = glbNodes.find(([f, tier]) => f.id === '13' && tier === 'mobile')[2];
  assert.equal(thirteen.filter((n) => exhibitNodeMatch('monsters', n)).length, 12);
});

test('(d) 항목: inner-layout 값 그대로 — 이름 = title, kicker EXHIBIT, 경로 SUPREME ORIGIN > Retail > HAUS 성수 <층> > title, 행 층(label) · 설명(desc)', () => {
  const crumbFloor = { b1: 'HAUS 성수 B1F', 1: 'HAUS 성수 1F', 12: 'HAUS 성수 12F', 13: 'HAUS 성수 13F' };
  for (const f of inner.floors) {
    const items = exhibitItems(f);
    assert.deepEqual(items, f.exhibits.map((e) => ({
      id: e.id,
      name: e.title,
      kicker: 'EXHIBIT',
      crumbs: ['SUPREME ORIGIN', 'Retail', crumbFloor[f.id], e.title],
      rows: [{ label: '층', value: f.label }, { label: '설명', value: e.desc }],
      note: '',
    })), f.id);
  }
  const city = exhibitItems(floorOf('1'))[0];
  assert.deepEqual(city.crumbs, ['SUPREME ORIGIN', 'Retail', 'HAUS 성수 1F', '성수 도시 모형']);
  assert.deepEqual(city.rows, [{ label: '층', value: '1F 로비' }, { label: '설명', value: 'HAUS NOWHERE 미니어처와 성수의 그래피티 건물들' }]);
  assert.deepEqual(exhibitItems(floorOf('b1'))[0].crumbs[2], 'HAUS 성수 B1F');
  // 설명이 비면 그 행이 없다
  const bare = { id: '12', label: '12F', exhibits: [{ id: 'portal', title: '붉은 커튼 포털', desc: '', pos: [0, 0, 0] }, { id: 'smoking', title: '흡연 부스', pos: [0, 0, 0] }] };
  for (const it of exhibitItems(bare)) assert.deepEqual(it.rows, [{ label: '층', value: '12F' }]);
  assert.deepEqual(exhibitItems({ id: '1', label: '1F 로비' }), [], '전시물 없는 층');
  assert.deepEqual(exhibitItems(null), []);
});

test('(e) 감상 목록: kind exhibit · 같은 층 전시물 순서 · 안내 한 줄, release · loadLite 없음(main 이 층 노드 복제를 붙인다 — 층과 같이 쓰므로 닫아도 풀지 않는다), 이전 · 다음은 끝에서 처음으로', () => {
  const c = exhibitCollection(floorOf('1'), 'city_model');
  assert.equal(c.kind, 'exhibit');
  assert.deepEqual(c.items, exhibitItems(floorOf('1')));
  assert.deepEqual(c.items.map((i) => i.id), ['city_model', 'dj', 'display']);
  assert.equal(c.startId, 'city_model');
  assert.equal(c.hint, HINT);
  assert.equal('release' in c, false, '복제는 층 geometry · 재질을 같이 쓴다 — 무대가 풀면 층이 깨진다');
  assert.equal('loadLite' in c, false);
  assert.equal('parts' in c, false);
  for (const it of c.items) assert.equal('liteUrl' in it || 'hiUrl' in it, false, '다시 받지 않는다 · 고해상도 교체 없음');
  assert.equal(stepItem(c.items, 'city_model', 1), 'dj');
  assert.equal(stepItem(c.items, 'dj', 1), 'display');
  assert.equal(stepItem(c.items, 'display', 1), 'city_model');
  assert.equal(stepItem(c.items, 'city_model', -1), 'display');
  const m = exhibitCollection(floorOf('13'), 'monsters');
  assert.deepEqual(m.items.map((i) => i.id), ['nail', 'sphinx', 'monsters']);
  assert.equal(stepItem(m.items, 'monsters', 1), 'nail');
  assert.equal(exhibitCollection(floorOf('b1'), 'cafe').items.length, 1);
});

// ── 노드 복제 묶음(vendored three 로 동작을 잰다) ──
const geo = new THREE.BoxGeometry(1, 1, 1);
const mat = new THREE.MeshStandardMaterial();
function node(name, setup, ...children) {
  const n = children.length ? new THREE.Group() : new THREE.Mesh(geo, mat);
  n.name = name;
  setup?.(n);
  n.add(...children);
  return n;
}
function floorRoot(setup) {
  const root = new THREE.Group();
  root.name = 'NW_InnerFloor_1';
  setup?.(root);
  root.add(
    node('IN_floor'),
    node('EX_city_b1', (n) => n.position.set(1, 0.5, 2)),
    node('EX_plinth', (n) => {
      n.position.set(0, 0.4, 0);
      n.rotation.set(0, 0.3, 0);
      n.scale.set(2, 0.8, 2);
    }),
    node('wrap', (n) => {
      n.position.set(-3, 0, 1);
      n.rotation.y = 1.1;
    }, node('EX_city_haus', (n) => n.position.set(0.5, 1, -0.25))),
    node('EX_plinth_cowboy', (n) => n.position.set(9, 0, 9)),
    node('EX_display', (n) => n.position.set(-16, 2, -6), node('EX_display_screen', (s) => s.position.set(0.1, 0, 0))),
    node('EX_elevator_l'),
  );
  root.updateMatrixWorld(true);
  return root;
}
const close = (a, b, msg) => a.elements.forEach((v, i) => assert.ok(Math.abs(v - b.elements[i]) < 1e-9, `${msg}: ${a.elements} ≠ ${b.elements}`));

test('(f) 노드 복제 묶음: 층 루트에서 그 전시물 노드만 월드 행렬째(층 좌표) 복제한 Group — geometry · 재질은 같이 쓰고 층은 그대로, 맞는 노드의 자식은 따로 복제하지 않는다', () => {
  for (const [label, setup] of [['변환 없는 층 루트', null], ['옮기고 돌리고 키운 층 루트', (r) => {
    r.position.set(40, -3, 12);
    r.rotation.set(0.2, -0.9, 0.05);
    r.scale.setScalar(1.5);
  }]]) {
    const root = floorRoot(setup);
    const before = root.children.map((c) => c.name);
    const toFloor = root.matrixWorld.clone().invert();
    const g = cloneExhibit(THREE, root, 'city_model');
    assert.ok(g?.isGroup, label);
    assert.equal(g.name, 'NW_Exhibit_city_model');
    assert.deepEqual(g.children.map((c) => c.name), ['EX_city_b1', 'EX_plinth', 'EX_city_haus'], `${label}: EX_plinth_cowboy · 다른 전시물 · 엘리베이터 · IN_* 는 빠진다`);
    g.updateMatrixWorld(true);
    for (const c of g.children) {
      const src = root.getObjectByName(c.name);
      assert.notEqual(c, src, '원본이 아니라 복제');
      close(c.matrixWorld, toFloor.clone().multiply(src.matrixWorld), `${label} ${c.name} 층 좌표`);
      assert.equal(c.geometry, src.geometry, 'geometry 를 같이 쓴다');
      assert.equal(c.material, src.material, '재질을 같이 쓴다(1F 화면 캔버스 그대로)');
    }
    assert.ok(g.position.equals(new THREE.Vector3()) && g.quaternion.equals(new THREE.Quaternion()) && g.scale.equals(new THREE.Vector3(1, 1, 1)));
    // 층은 그대로(원본을 떼어 오지 않는다)
    assert.deepEqual(root.children.map((c) => c.name), before, label);
    assert.equal(root.getObjectByName('EX_city_haus').parent.name, 'wrap');
    // 디스플레이: 화면은 EX_display 복제 안에 한 번만
    const d = cloneExhibit(THREE, root, 'display');
    assert.deepEqual(d.children.map((c) => c.name), ['EX_display']);
    assert.deepEqual(d.children[0].children.map((c) => c.name), ['EX_display_screen']);
    let meshes = 0;
    d.traverse((o) => { if (o.isMesh) meshes++; });
    assert.equal(meshes, 1, 'EX_display(그룹) 아래 화면 메시 하나');
    // 그 층에 노드가 없으면 null(무대가 열지 못하고 연 자리로 되돌린다)
    assert.equal(cloneExhibit(THREE, root, 'sphinx'), null);
    assert.equal(cloneExhibit(THREE, null, 'city_model'), null);
  }
});

// ── 감상 무대에서만 모으기(EXHIBIT_PACK — 버섯 몬스터 한 줄 · 지하 카페 격자) ──
test('(f2) 모으기 규칙: 버섯 몬스터 · 지하 카페만. 몬스터는 묶음 키 = 노드 이름 끝 숫자(몬스터 · 명판 · 받침대가 한 묶음), 간격 0.6 m — 층 GLB 13F 는 두 판 모두 4 묶음 × 3 노드', () => {
  assert.deepEqual(Object.keys(EXHIBIT_PACK), ['monsters', 'cafe']);
  const { cluster, gap } = EXHIBIT_PACK.monsters;
  assert.equal(gap, 0.6);
  assert.equal(EXHIBIT_PACK.monsters.columns, undefined, '몬스터는 한 줄');
  assert.equal(cluster('EX_monster_0'), '0');
  assert.equal(cluster('EX_nameplate_m0'), '0');
  assert.equal(cluster('EX_plinth_m0'), '0');
  assert.equal(cluster('EX_monster_3'), '3');
  assert.equal(cluster('EX_plinth_m12'), '12');
  assert.equal(cluster('EX_monster_base'), null, '끝 숫자가 없으면 묶음 없음(제자리)');
  for (const [f, tier, names] of glbNodes.filter(([f]) => f.id === '13')) {
    const groups = new Map();
    for (const n of names.filter((n) => exhibitNodeMatch('monsters', n))) {
      const k = cluster(n);
      assert.ok(k != null, `${tier}: ${n} 묶음 키 없음`);
      groups.set(k, [...(groups.get(k) || []), n]);
    }
    assert.deepEqual([...groups.keys()].sort(), ['0', '1', '2', '3'], `${f.id} ${tier}`);
    for (const [k, ns] of groups) assert.deepEqual(ns.sort(), [`EX_monster_${k}`, `EX_nameplate_m${k}`, `EX_plinth_m${k}`], `${tier} 묶음 ${k}`);
  }
});

// 13F 처럼 흩어진 네 묶음(받침대 · 명판 · 몬스터) + 끝 숫자 없는 노드 하나 + 다른 전시물
function monsterRoot(setup) {
  const root = new THREE.Group();
  root.name = 'NW_InnerFloor_13';
  setup?.(root);
  const xs = [7.5, -11, 11, -7.5];   // 노드 순서와 x 순서가 다르다
  const widths = [1.1, 0.7, 1.4, 0.9];
  xs.forEach((x, i) => {
    root.add(
      node(`EX_plinth_m${i}`, (n) => {
        n.position.set(x, 0.2, -4);
        n.scale.set(widths[i], 0.4, 0.8);
      }),
      node(`EX_nameplate_m${i}`, (n) => {
        n.position.set(x + 0.1, 0.3, -3.55);
        n.scale.set(0.5, 0.1, 0.05);
      }),
      node(`EX_monster_${i}`, (n) => {
        n.position.set(x - 0.15, 0.9, -4.1);
        n.rotation.y = 0.4 * i;
        n.scale.setScalar(0.6);
      }),
    );
  });
  root.add(node('EX_monster_base', (n) => n.position.set(0, 0, -9)), node('EX_sphinx', (n) => n.position.set(6, 1.2, 4)));
  root.updateMatrixWorld(true);
  return root;
}
const boxOf = (objs) => objs.reduce((b, o) => b.union(new THREE.Box3().setFromObject(o)), new THREE.Box3());

test('(f3) 버섯 몬스터 모으기: 층 좌표 복제 뒤 묶음을 원래 x 순서대로 0.6 m 간격 한 줄로(원래 묶음 가운데 기준) — 묶음 안 배치 · y · z 그대로, 끝 숫자 없는 노드는 제자리, 층은 그대로', () => {
  for (const [label, setup] of [['변환 없는 층 루트', null], ['옮기고 돌린 층 루트', (r) => {
    r.position.set(-20, 3, 8);
    r.rotation.set(0, 0.8, 0);
    r.scale.setScalar(1.25);
  }]]) {
    const root = monsterRoot(setup);
    const toFloor = root.matrixWorld.clone().invert();
    const before = root.children.map((c) => [c.name, c.position.toArray()]);
    // 원래(층 좌표) 자리: 층 루트 역 × 원본 월드
    const floorPos = (name) => new THREE.Vector3().setFromMatrixPosition(toFloor.clone().multiply(root.getObjectByName(name).matrixWorld));
    const g = cloneExhibit(THREE, root, 'monsters');
    g.updateMatrixWorld(true);
    assert.equal(g.children.length, 13, `${label}: 4 묶음 × 3 + 끝 숫자 없는 노드`);
    assert.ok(!g.getObjectByName('EX_sphinx'));
    const byKey = new Map();
    for (const c of g.children) {
      const k = EXHIBIT_PACK.monsters.cluster(c.name);
      if (k != null) byKey.set(k, [...(byKey.get(k) || []), c]);
    }
    assert.equal(byKey.size, 4, label);
    // 원래 x 순서(묶음 가운데)대로 놓였는지 — 원래 순서: m1(−11) · m3(−7.5) · m0(7.5) · m2(11)
    // 이 전시물 노드를 원래(층 좌표) 자리에 둔 복제 — 비교용
    const atFloor = (name) => {
      const src = root.getObjectByName(name);
      const o = src.clone(false);
      toFloor.clone().multiply(src.matrixWorld).decompose(o.position, o.quaternion, o.scale);
      o.updateMatrixWorld(true);
      return o;
    };
    const origCenterX = (k) => boxOf([`EX_plinth_m${k}`, `EX_nameplate_m${k}`, `EX_monster_${k}`].map(atFloor)).getCenter(new THREE.Vector3()).x;
    const order = [...byKey.keys()].sort((a, b) => origCenterX(a) - origCenterX(b));
    assert.deepEqual(order, ['1', '3', '0', '2'], label);
    const boxes = order.map((k) => boxOf(byKey.get(k)));
    for (let i = 1; i < boxes.length; i++) {
      assert.ok(boxes[i].min.x > boxes[i - 1].max.x, `${label}: 순서 유지 ${order[i - 1]} → ${order[i]}`);
      assert.ok(Math.abs(boxes[i].min.x - boxes[i - 1].max.x - EXHIBIT_PACK.monsters.gap) < 1e-6, `${label}: 간격 ${boxes[i].min.x - boxes[i - 1].max.x}`);
    }
    // 가운데: 원래 이 전시물 복제 전체(경계 상자) 가운데 x 에 맞춘다
    const row = boxes.reduce((acc, x) => acc.union(x), new THREE.Box3());
    const origAll = boxOf(g.children.map((c) => atFloor(c.name)));
    assert.ok(Math.abs(row.getCenter(new THREE.Vector3()).x - origAll.getCenter(new THREE.Vector3()).x) < 1e-6, `${label}: 줄 가운데`);
    const spread = boxOf(['0', '1', '2', '3'].flatMap((k) => [`EX_plinth_m${k}`, `EX_nameplate_m${k}`, `EX_monster_${k}`]).map(atFloor));
    assert.ok(row.max.x - row.min.x < (spread.max.x - spread.min.x) / 3, `${label}: 모은 줄이 원래 폭보다 훨씬 좁다`);
    // 묶음 안 배치(서로 간 거리) · y · z · 회전 · 크기 그대로 — x 로만 옮긴다
    for (const [k, nodes] of byKey) {
      const dx = nodes[0].position.x - floorPos(nodes[0].name).x;
      for (const c of nodes) {
        const p = floorPos(c.name);
        assert.ok(Math.abs(c.position.x - p.x - dx) < 1e-9, `${label} 묶음 ${k}: ${c.name} 묶음 안 x 배치`);
        assert.ok(Math.abs(c.position.y - p.y) < 1e-9 && Math.abs(c.position.z - p.z) < 1e-9, `${label} ${c.name} y · z`);
        const want = toFloor.clone().multiply(root.getObjectByName(c.name).matrixWorld);
        const q = new THREE.Quaternion();
        const s = new THREE.Vector3();
        want.decompose(new THREE.Vector3(), q, s);
        assert.ok(Math.abs(Math.abs(c.quaternion.dot(q)) - 1) < 1e-9 && c.scale.distanceTo(s) < 1e-9, `${label} ${c.name} 회전 · 크기`);
      }
    }
    // 끝 숫자 없는 노드는 제자리
    const base = g.getObjectByName('EX_monster_base');
    assert.ok(base.position.distanceTo(floorPos('EX_monster_base')) < 1e-9, `${label}: 묶음 없는 노드 제자리`);
    // 층은 그대로
    assert.deepEqual(root.children.map((c) => [c.name, c.position.toArray()]), before, `${label}: 층 배치 그대로`);
  }
});

test('(f4) 지하 카페 규칙: 노드마다 한 묶음(테이블 여섯 · 손님 둘), 손님은 테이블 다음(뒷줄), 0.6 m 간격 4 열 — 층 GLB B1F 두 판 모두 8 묶음', () => {
  const { cluster, rank, gap, columns } = EXHIBIT_PACK.cafe;
  assert.equal(gap, 0.6);
  assert.equal(columns, 4);
  assert.equal(cluster('EX_table_3'), 'EX_table_3');
  assert.equal(cluster('EX_guest_1'), 'EX_guest_1');
  assert.ok(rank('EX_guest_0') > rank('EX_table_0') && rank('EX_guest_1') > rank('EX_table_5'), '손님이 뒷줄(테이블 다음)');
  assert.equal(rank('EX_table_0'), rank('EX_table_5'));
  for (const [f, tier, names] of glbNodes.filter(([f]) => f.id === 'b1')) {
    const keys = names.filter((n) => exhibitNodeMatch('cafe', n)).map(cluster);
    assert.equal(new Set(keys).size, 8, `${tier}`);
    assert.equal(keys.filter((k) => rank(k) > rank('EX_table_0')).length, 2, `${tier}: 손님 둘`);
  }
});

// B1F 처럼 흩어진 테이블 여섯(두 줄 × 세 칸) · 손님 둘(서로 다른 크기 — 열 폭 · 줄 깊이가 칸마다 다르게)
function cafeRoot(setup) {
  const root = new THREE.Group();
  root.name = 'NW_InnerFloor_b1';
  setup?.(root);
  [[-7, 6], [0, 6], [7, 6], [-7, -1], [0, -1], [7, -1]].forEach(([x, z], i) => root.add(node(`EX_table_${i}`, (n) => {
    n.position.set(x, 0.38, z);
    n.rotation.y = 0.2 * i;
    n.scale.set(1.4 + 0.1 * i, 0.75, 1.2 + 0.15 * i);
  })));
  root.add(
    node('EX_guest_0', (n) => {
      n.position.set(-3.5, 0.6, 2.5);
      n.scale.set(0.7, 1.2, 0.6);
    }),
    node('EX_guest_1', (n) => {
      n.position.set(3.5, 0.6, -4);
      n.rotation.y = -0.5;
      n.scale.set(0.9, 1.4, 0.8);
    }),
    node('EX_sphinx', (n) => n.position.set(0, 0, 9)),
  );
  root.updateMatrixWorld(true);
  return root;
}

test('(f5) 지하 카페 모으기: 4 열 2 줄 격자(앞줄 = +z — 무대 처음 시선 쪽, 키 큰 손님 둘은 뒷줄 오른쪽), 이웃 경계 상자 x · z 간격 ≥ 0.6 m, 원래 가운데(x, z) 기준, 노드마다 x · z 로만 옮김, 층은 그대로', () => {
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  for (const [label, setup] of [['변환 없는 층 루트', null], ['옮기고 돌린 층 루트', (r) => {
    r.position.set(12, -4, -30);
    r.rotation.set(0, -1.2, 0);
    r.scale.setScalar(0.8);
  }]]) {
    const root = cafeRoot(setup);
    const toFloor = root.matrixWorld.clone().invert();
    const before = root.children.map((c) => [c.name, c.position.toArray()]);
    const atFloor = (name) => {
      const src = root.getObjectByName(name);
      const o = src.clone(false);
      toFloor.clone().multiply(src.matrixWorld).decompose(o.position, o.quaternion, o.scale);
      o.updateMatrixWorld(true);
      return o;
    };
    const g = cloneExhibit(THREE, root, 'cafe');
    g.updateMatrixWorld(true);
    assert.equal(g.children.length, 8, label);
    const cells = g.children.map((c) => {
      const box = new THREE.Box3().setFromObject(c);
      return { name: c.name, box, cx: (box.min.x + box.max.x) / 2, cz: (box.min.z + box.max.z) / 2 };
    });
    // 줄 · 열: 칸 가운데에 놓이므로 가운데 z 는 두 값, 가운데 x 는 네 값
    const distinct = (vs) => vs.sort((a, b) => a - b).filter((v, i, a) => !i || !near(v, a[i - 1]));
    const zs = distinct(cells.map((c) => c.cz)).reverse();   // 앞줄(큰 z)부터
    const xs = distinct(cells.map((c) => c.cx));             // 왼쪽(작은 x)부터
    assert.equal(zs.length, 2, `${label}: 2 줄`);
    assert.equal(xs.length, 4, `${label}: 4 열`);
    const at = (r, c) => cells.filter((e) => near(e.cz, zs[r]) && near(e.cx, xs[c]));
    const grid = zs.map((_, r) => xs.map((__, c) => {
      const e = at(r, c);
      assert.equal(e.length, 1, `${label}: 칸 ${r},${c} 에 하나`);
      return e[0];
    }));
    // 순서: 테이블(원래 x 순, 같은 x 는 층 순서) → 손님(원래 x 순) — 손님 둘이 뒷줄 오른쪽(앞 테이블을 가리지 않게)
    assert.deepEqual(grid.map((row) => row.map((e) => e.name)), [
      ['EX_table_0', 'EX_table_3', 'EX_table_1', 'EX_table_4'],
      ['EX_table_2', 'EX_table_5', 'EX_guest_0', 'EX_guest_1'],
    ], label);
    // 이웃 간격 ≥ 0.6(가로 · 세로), 열 폭 · 줄 깊이 = 그 열 · 줄에서 가장 큰 상자, 격자 전체 = 그 합 + 간격(빈틈 없이)
    const gap = EXHIBIT_PACK.cafe.gap;
    for (let r = 0; r < 2; r++) for (let c = 1; c < 4; c++) assert.ok(grid[r][c].box.min.x - grid[r][c - 1].box.max.x >= gap - 1e-6, `${label}: x 간격 ${r},${c}`);
    for (let c = 0; c < 4; c++) assert.ok(grid[0][c].box.min.z - grid[1][c].box.max.z >= gap - 1e-6, `${label}: z 간격 열 ${c}`);
    const colW = [0, 1, 2, 3].map((c) => Math.max(...grid.map((row) => row[c].box.max.x - row[c].box.min.x)));
    const rowD = grid.map((row) => Math.max(...row.map((e) => e.box.max.z - e.box.min.z)));
    const all = cells.reduce((b, e) => b.union(e.box), new THREE.Box3());
    assert.ok(near(all.max.x - all.min.x, colW.reduce((a, b) => a + b) + 3 * gap), `${label}: 격자 폭`);
    assert.ok(near(all.max.z - all.min.z, rowD.reduce((a, b) => a + b) + gap), `${label}: 격자 깊이`);
    // 가운데(x, z) = 원래 이 전시물 복제 전체 가운데
    const orig = boxOf(g.children.map((c) => atFloor(c.name)));
    assert.ok(near((all.min.x + all.max.x) / 2, (orig.min.x + orig.max.x) / 2) && near((all.min.z + all.max.z) / 2, (orig.min.z + orig.max.z) / 2), `${label}: 격자 가운데`);
    assert.ok(all.max.x - all.min.x < orig.max.x - orig.min.x, `${label}: 원래보다 좁다`);
    // 노드마다 y · 회전 · 크기 그대로(x · z 로만 옮김)
    for (const c of g.children) {
      const want = atFloor(c.name);
      assert.ok(Math.abs(c.position.y - want.position.y) < 1e-9, `${label} ${c.name} y`);
      assert.ok(Math.abs(Math.abs(c.quaternion.dot(want.quaternion)) - 1) < 1e-9 && c.scale.distanceTo(want.scale) < 1e-9, `${label} ${c.name} 회전 · 크기`);
    }
    assert.deepEqual(root.children.map((c) => [c.name, c.position.toArray()]), before, `${label}: 층 배치 그대로`);
  }
});

test('(f6) 모으기 규칙이 없는 전시물은 층 좌표 그대로(흩어져 있어도 옮기지 않는다)', () => {
  const root = new THREE.Group();
  root.add(...[-6, -2, 2, 6].map((x, i) => node(`EX_city_b${i}`, (n) => n.position.set(x, 0.4, 3 + i))), node('EX_portal', (n) => n.position.set(-10, 1.6, -10.1)));
  root.updateMatrixWorld(true);
  assert.deepEqual(cloneExhibit(THREE, root, 'city_model').children.map((c) => c.position.toArray()), [[-6, 0.4, 3], [-2, 0.4, 4], [2, 0.4, 5], [6, 0.4, 6]]);
  assert.deepEqual(cloneExhibit(THREE, root, 'portal').children.map((c) => c.position.toArray()), [[-10, 1.6, -10.1]]);
});

// ── 연결(정규식) ──
test('(g) exhibits.js 는 순수(three · DOM 을 들이지 않는다 — three 는 cloneExhibit 인자), 경로는 products.js breadcrumb', () => {
  const src = read('exhibits.js');
  assert.doesNotMatch(src, /from 'three'/);
  assert.doesNotMatch(src, /document\.|window\./);
  assert.match(src, /import \{[^}]*breadcrumb[^}]*\} from '\.\/products\.js';/);
});

test('(h) interior: 활성 층 정의 · 루트를 내준다(실내가 아니면 null)', () => {
  const src = read('interior.js');
  assert.match(src, /currentFloorDef: \(\) => \(active \? floorDef : null\),/);
  assert.match(src, /currentRoot: \(\) => \(active \? floorRoot : null\),/);
});

test('(i) main: openExhibit — 지금 층 전시물 목록 + 층 루트 노드 복제(loadLite)로 openStage, release 없음, __NW_APP.openExhibit', () => {
  const main = read('main.js');
  assert.match(main, /import \{ exhibitCollection, cloneExhibit \} from '\.\/exhibits\.js';/);
  const open = fnBody(main, 'async function openExhibit(id)');
  assert.match(open, /const def = interior\.currentFloorDef\(\);/);
  assert.match(open, /const root = interior\.currentRoot\(\);/);
  assert.match(open, /if \(!def \|\| !root \|\| showcase\.isActive\(\) \|\| showcase\.isBusy\(\) \|\| interior\.isBusy\(\)\) return;/);
  assert.match(open, /const collection = exhibitCollection\(def, id\);/);
  assert.match(open, /if \(!collection\.items\.some\(\(it\) => it\.id === id\)\) return;/);
  assert.match(open, /await openStage\(\{\s*\.\.\.collection,\s*loadLite: async \(item\) => cloneExhibit\(THREE, root, item\.id\),\s*\}\);/);
  assert.doesNotMatch(open, /release/);
  assert.match(main, /openArchive,\s*\n\s*openExhibit,/);
  // getStats().showcase 는 그대로 감상 항목 id
  assert.match(main, /showcase: showcase\.isActive\(\) \? showcase\.getState\(\)\.itemId : null,/);
});

test('(j) showcase: kind exhibit 의 화면 이름 · 오류 문구(전시물 감상 · 전시물)', () => {
  const sc = read('showcase.js');
  assert.match(sc, /exhibit: \{ label: '전시물 감상', noun: '전시물' \},/);
  // 제품 · 건물 그대로
  assert.match(sc, /product: \{ label: '제품 감상', noun: '제품' \},/);
  assert.match(sc, /building: \{ label: '건물 감상', noun: '건물' \},/);
});
