import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../public/vendor/three/three.module.js';
import {
  EXHIBIT_TAG_RANGE, EXHIBIT_TAG_LIFT, EXHIBIT_PICK_RANGE, CLICK_SLOP, EXHIBIT_NODES, EXHIBIT_HINT, EXHIBIT_PACK,
  exhibitNodeMatch, exhibitItems, exhibitCollection, cloneExhibit, exhibitTagAnchor, exhibitTagAnchors, exhibitTagVisible, exhibitAt,
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

// ── Task 2: 전시물 이름표 · 클릭 고르기(순수 판정 · 연결 정규식 · 안내 · 문서) — 동작 시험은 tests/nowhere-exhibit-tags.test.mjs ──

test('(k) 이름표 자리 · 보이기: 노드가 없을 때 자리는 pos 위 0.6 m, 보이기는 눈과 이름표 자리의 수평 거리 8 m 안(경계 포함 — 높이 차는 보지 않는다)이고 화면 안(NDC x · y −1…1, −1 < z < 1)', () => {
  for (const f of inner.floors) {
    for (const e of f.exhibits || []) assert.deepEqual(exhibitTagAnchor(e), [e.pos[0], e.pos[1] + EXHIBIT_TAG_LIFT, e.pos[2]], `${f.id} ${e.id}`);
  }
  const anchor = [2, 3.1, -3];
  const ok = { eye: [2, 1.7, 3], anchor, ndc: [0, 0, 0.5] };
  assert.equal(exhibitTagVisible(ok), true);
  assert.equal(exhibitTagVisible({ ...ok, eye: [2, 1.7, -3 + EXHIBIT_TAG_RANGE] }), true, '8 m 경계 포함');
  assert.equal(exhibitTagVisible({ ...ok, eye: [2, 1.7, -3 + EXHIBIT_TAG_RANGE + 0.01] }), false);
  assert.equal(exhibitTagVisible({ ...ok, eye: [2 + 6, 1.7, -3 + 6] }), false, '대각선 8.49 m');
  assert.equal(exhibitTagVisible({ ...ok, eye: [2, 40, 3] }), true, '수평 거리만 — 위에서 내려다봐도 6 m');
  for (const ndc of [[1, 1, 0.9], [-1, -1, -0.9], [0.99, -0.99, 0]]) assert.equal(exhibitTagVisible({ ...ok, ndc }), true, String(ndc));
  for (const ndc of [[1.01, 0, 0.5], [0, -1.01, 0.5], [0, 0, 1], [0, 0, -1], [0, 0, 1.2]]) assert.equal(exhibitTagVisible({ ...ok, ndc }), false, String(ndc));
});

test('(k2) 이름표 자리(exhibitTagAnchors): 그 전시물 노드(exhibitNodeMatch — 맞는 노드 아래 자식 포함)의 층 루트 좌표 경계 상자 윗면 가운데 + 0.6 m — 층 루트가 옮겨지고 돌고 커져도 층 좌표 그대로, 노드가 없으면 pos + 0.6 m', () => {
  const f13 = { ...floorOf('13'), ceiling: undefined };   // 천장 누르기는 (k3) — 여기서는 상자 셈만
  const mesh = (name, [x, y, z], [w, h, d], parent) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial());
    m.name = name;
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const build = (transform) => {
    const root = new THREE.Group();
    root.name = 'NW_InnerFloor_13';
    transform?.(root);
    // 거대한 손: 노드 하나(y 0.5…3.5) + 그 아래 자식 메시(위로 1 m 더 — 자식도 상자에 든다)
    const nail = mesh('EX_nail', [-6, 2, 4], [2, 3, 1], root);
    mesh('Cube.031', [0, 2, 0], [0.5, 1, 0.5], nail);
    // 버섯 몬스터: 흩어진 묶음(층 배치 그대로 — 무대 모으기는 쓰지 않는다). 몬스터 하나는 옮기고 돈 감싼 그룹 아래
    const wrap = new THREE.Group();
    wrap.name = 'wrap';
    wrap.position.set(1, 0, -1);
    wrap.rotation.y = Math.PI / 2;
    root.add(wrap);
    mesh('EX_monster_0', [0, 1.2, 10], [1, 1.4, 1], wrap);   // 층 좌표 x = 1 + 10 = 11(±0.5), z = −1(±0.5), y 0.5…1.9
    mesh('EX_plinth_m0', [-11, 0.4, -4], [1, 0.8, 1], root);
    mesh('EX_nameplate_m0', [-11, 0.9, -3.4], [0.6, 0.2, 0.05], root);
    // 전시물이 아닌 것: 엘리베이터 · 벽 — 상자에 들지 않는다
    mesh('EX_elevator_l', [0, 5, 0], [1, 10, 1], root);
    mesh('IN_wall_n', [0, 2, -10], [30, 4, 0.2], root);
    // 스핑크스 노드 없음 → pos + 0.6
    return root;
  };
  const want = {
    nail: [-6, 4.5 + EXHIBIT_TAG_LIFT, 4],
    monsters: [0, 1.9 + EXHIBIT_TAG_LIFT, -2.5],   // x −11.5…11.5 · y 0…1.9 · z −4.5…−0.5(받침대 −4 ± 0.5 · 몬스터 −1 ± 0.5)
    sphinx: [6, 1.2 + EXHIBIT_TAG_LIFT, 4],
  };
  const close = (got, exp, msg) => exp.forEach((v, i) => assert.ok(Math.abs(got[i] - v) < 1e-6, `${msg}: ${got} ≠ ${exp}`));   // geometry 는 float32
  for (const [label, t] of [['변환 없음', null], ['옮기고 돌리고 키운 루트', (r) => { r.position.set(5, 2, -3); r.rotation.set(0.2, 0.7, -0.1); r.scale.set(2, 2, 2); }]]) {
    const root = build(t);
    const at = exhibitTagAnchors(THREE, root, f13);
    assert.deepEqual(Object.keys(at), f13.exhibits.map((e) => e.id), label);
    for (const id of Object.keys(want)) close(at[id], want[id], `${label} ${id}`);
  }
  // 변환 없는 루트: three 의 Box3.expandByObject(월드) 와 같다
  const root = build(null);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  for (const n of root.children.filter((c) => exhibitNodeMatch('nail', c.name))) box.expandByObject(n);
  close(exhibitTagAnchors(THREE, root, f13).nail, [(box.min.x + box.max.x) / 2, box.max.y + EXHIBIT_TAG_LIFT, (box.min.z + box.max.z) / 2], 'expandByObject');
  // 층 루트가 없으면 모두 pos + 0.6, 층 정의가 없으면 빈 표
  assert.deepEqual(exhibitTagAnchors(THREE, null, f13), Object.fromEntries(f13.exhibits.map((e) => [e.id, exhibitTagAnchor(e)])));
  assert.deepEqual(exhibitTagAnchors(THREE, root, null), {});
});

test('(l) 광선이 맞은 물체 → 전시물(exhibitAt): 그 층 전시물 노드이거나 그 아래면 그 전시물(가장 바깥 노드 — cloneExhibit 단위), 다른 층 전시물 · 엘리베이터 · 벽 · 진열 · null 은 null', () => {
  const node = (name, parent = null) => ({ name, parent });
  const scene = node('');
  const floorRoot = (id) => node(`NW_InnerFloor_${id}`, scene);
  const r1 = floorRoot('1');
  const plinth = node('EX_plinth', r1);
  assert.equal(exhibitAt(plinth, floorOf('1')), 'city_model');
  assert.equal(exhibitAt(node('Cube.012', plinth), floorOf('1')), 'city_model', '여러 재질 노드의 자식 메시(이름이 메시 이름)도 위로 올라가 찾는다');
  assert.equal(exhibitAt(node('EX_display_screen', node('EX_display', r1)), floorOf('1')), 'display');
  assert.equal(exhibitAt(node('EX_dj', r1), floorOf('1')), 'dj');
  // 다른 층 전시물 이름은 이 층에서 아무것도 아니다(1F 에서 EX_plinth_cowboy, 12F 에서 EX_plinth)
  assert.equal(exhibitAt(node('EX_plinth_cowboy', r1), floorOf('1')), null);
  const r12 = floorRoot('12');
  assert.equal(exhibitAt(node('EX_plinth_cowboy', r12), floorOf('12')), 'cowboy');
  assert.equal(exhibitAt(node('EX_plinth', r12), floorOf('12')), null);
  for (const name of ['EX_elevator_l', 'IN_wall_n', 'IN_floor', 'IN_glass_e_1']) assert.equal(exhibitAt(node(name, r1), floorOf('1')), null, name);
  // 리테일 진열(층 루트 아래 NW_Retail_<층>)은 전시물이 아니다 — 제품은 retail-display 가 먼저 고른다
  assert.equal(exhibitAt(node('lens', node('NW_RetailProduct_kant', node('NW_Retail_1', r1))), floorOf('1')), null);
  assert.equal(exhibitAt(null, floorOf('1')), null);
  assert.equal(exhibitAt(plinth, null), null, '층 정의가 없으면(실내 밖) null');

  // 네 층 × 데스크톱 · 모바일 GLB: 노드 계층 그대로(자식 · 메시 이름 자식까지) — 맨 위 EX_* 노드 아래 모든 물체가 그 전시물, 그 밖은 null, 층 전시물마다 맞는 물체가 있다
  for (const f of inner.floors) {
    for (const [tier, url] of [['desktop', f.glb], ['mobile', f.mobileGlb]]) {
      const j = readGlbJson(new URL(url, PUB));
      const root = floorRoot(f.id);
      const objs = j.nodes.map((n) => node(n.name || ''));
      j.nodes.forEach((n, i) => (n.children || []).forEach((c) => (objs[c].parent = objs[i])));
      for (const i of j.scenes[0].nodes) objs[i].parent = root;
      const meshKids = j.nodes.flatMap((n, i) => (n.mesh != null ? [node(j.meshes[n.mesh].name || `mesh_${n.mesh}`, objs[i])] : []));
      const top = (o) => (o.parent === root ? o : top(o.parent));
      const seen = new Set();
      for (const o of [...objs, ...meshKids]) {
        const t = top(o);
        const want = (f.exhibits || []).map((e) => e.id).find((id) => exhibitNodeMatch(id, t.name)) ?? null;
        const got = exhibitAt(o, f);
        assert.equal(got, want, `${f.id} ${tier}: ${o.name} (맨 위 ${t.name})`);
        if (got) seen.add(got);
        if (t.name.startsWith('EX_elevator_') || t.name.startsWith('IN_')) assert.equal(got, null);
      }
      assert.deepEqual([...seen].sort(), (f.exhibits || []).map((e) => e.id).sort(), `${f.id} ${tier}: 모든 전시물을 고를 수 있다`);
    }
  }
});

test('(m) 이름표 · 고르기 모듈(exhibit-tags.js): <title> · 자세히 보기 이름표, 캔버스 캡처 click — 자유 시점은 끌지 않은 클릭 자리, 보행은 마우스 고정 중 조준점만, 층 광선 첫 물체가 전시물이면 막고 연다', () => {
  const src = read('exhibit-tags.js');
  assert.match(src, /export function createExhibitTags\(\{ camera, canvas, getFloor, isSuspended[^}]*isWalking[^}]*isSpotAimed[^}]*onOpen \}\)/);
  assert.match(src, /import \{[^}]*CLICK_SLOP[^}]*EXHIBIT_PICK_RANGE[^}]*exhibitAt[^}]*exhibitTagAnchors[^}]*exhibitTagVisible[^}]*\} from '\.\/exhibits\.js';/);
  // 이름표: 리테일 이름표와 같은 모양(.nw-exhibit-tag), 문구 = title · 자세히 보기, 누르면 포커스를 비우고 onOpen
  assert.match(src, /'nw-exhibit-tags'/);
  assert.match(src, /'nw-exhibit-tag'/);
  assert.match(src, /'nw-exhibit-tag-name', e\.title\)/);
  assert.match(src, /' · '/);
  assert.match(src, /'nw-exhibit-tag-more', '자세히 보기'\)/);
  assert.match(src, /btn\.blur\(\);[^\n]*\n\s*onOpen\(e\.id\);/);
  // 이름표 자리: 층 루트가 보이면(지금 층 정의와 같을 때) 층마다 한 번 노드 경계 상자로 재고(exhibitTagAnchors) 층 루트 행렬로 월드에, 멈춤 · 층 없음이면 묶음째 숨김
  assert.match(src, /const floor = tags\.length && !isSuspended\(\) \? getFloor\(\) : null;\s*if \(!floor \|\| floor\.def !== tagsDef\) \{\s*root\.hidden = true;/);
  assert.match(src, /if \(anchorsFor !== floor\.root\) placeAnchors\(floor\);/);
  assert.match(src, /const at = exhibitTagAnchors\(THREE, floor\.root, floor\.def\);/);
  assert.match(src, /\.applyMatrix4\(floor\.root\.matrixWorld\)/);
  assert.match(src, /exhibitTagVisible\(\{ eye, anchor: t\.anchor, ndc: \[v\.x, v\.y, v\.z\] \}\)/);
  assert.match(src, /tagsDef = def \|\| null;\s*anchorsFor = null;/, '층을 바꾸면 다시 잰다');
  // 클릭: 캡처 단계 pointerdown(끌기 시작점 · 그때 멈춤이었는지) · click
  const down = src.match(/canvas\.addEventListener\(\s*'pointerdown',[\s\S]*?\n    true,?\s*\n  \);/);
  assert.ok(down, '캔버스 pointerdown 캡처 처리기 없음');
  assert.match(down[0], /down\.suspended = isSuspended\(\);/);
  const click = src.match(/canvas\.addEventListener\(\s*'click',[\s\S]*?\n    true,?\s*\n  \);/);
  assert.ok(click, '캔버스 click 캡처 처리기 없음');
  const c = click[0];
  assert.match(c, /if \(down\.suspended \|\| isSuspended\(\)\) return;/);
  assert.match(c, /const locked = document\.pointerLockElement === canvas;/);
  assert.match(c, /if \(locked\) \{\s*if \(isSpotAimed\(\)\) return;[^\n]*\n\s*ndc\.set\(0, 0\);/);
  assert.match(c, /if \(isWalking\(\)\) return;/);
  assert.ok(c.indexOf('if (isWalking() && !down.touch) return;') < c.indexOf('> CLICK_SLOP) return'), '보행(고정 전) 클릭은 끌기 검사 전에 돌려보낸다');
  assert.match(c, /> CLICK_SLOP\) return;/);
  assert.match(c, /raycaster\.setFromCamera\(ndc, camera\);/);
  assert.match(c, /const hit = raycaster\.intersectObject\(floor\.root, true\)\[0\];/);
  assert.match(c, /const id = hit \? exhibitAt\(hit\.object, floor\.def\) : null;/);
  assert.match(c, /if \(!id\) return;\s*e\.stopImmediatePropagation\(\);\s*onOpen\(id\);/);
  assert.doesNotMatch(c, /requestPointerLock|preventDefault/, '마우스 고정은 camera.js 몫');
  assert.match(src, /raycaster\.far = EXHIBIT_PICK_RANGE;/);
  assert.match(src, /return \{ setFloor, update, element: root \};/);
});

test('(n) main 연결: 리테일 진열 다음에 만든다(캔버스 캡처 click 은 등록 순서 — 제품 · 받침대를 맞히면 리테일이 먼저 막는다), 멈춤 조건 · 층 · 보행 · 조준 스팟 · 감상 아닐 때 update · 층이 바뀌면 이름표 교체', () => {
  const main = read('main.js');
  assert.match(main, /import \{ createExhibitTags \} from '\.\/exhibit-tags\.js';/);
  const make = main.match(/const exhibitTags = createExhibitTags\(\{[\s\S]*?\n  \}\);/);
  assert.ok(make, 'createExhibitTags 호출 없음');
  const at = (re) => main.search(re);
  assert.ok(at(/const retail = createRetailDisplay\(/) >= 0 && at(/const retail = createRetailDisplay\(/) < at(/const exhibitTags = createExhibitTags\(/), '리테일 진열이 전시물 이름표보다 먼저(제품 픽이 먼저)');
  // 둘 다 만들 때(동기) 캔버스 캡처 click 을 등록한다 — 리테일은 제품을 맞히면 막는다
  const rd = read('retail-display.js');
  assert.match(rd, /canvas\.addEventListener\(\s*'click',[\s\S]*?e\.stopImmediatePropagation\(\);\s*onOpen\(best\.product\.id\);\s*\},\s*true,\s*\);/);
  const susp = make[0].match(/isSuspended: \(\) =>([^\n]*)/);
  assert.ok(susp, 'isSuspended 없음');
  for (const s of ['!interior.isActive()', 'interior.isBusy()', 'interior.isTouring()', 'showcase.isActive()', 'showcase.isBusy()', 'help.isOpen()', 'modal.isOpen()', 'spotCutting']) {
    assert.ok(susp[1].includes(s), `전시물 멈춤 조건에 ${s} 없음`);
  }
  assert.match(make[0], /const def = interior\.currentFloorDef\(\);\s*const root = interior\.currentRoot\(\);\s*return def && root \? \{ def, root \} : null;/);
  assert.match(make[0], /isWalking: \(\) => camCtrl\.isWalkMode\(\),/);
  assert.match(make[0], /isSpotAimed: \(\) => markers\.isAimed\(\),/);
  assert.match(make[0], /onOpen: \(id\) => openExhibit\(id\),/);
  assert.match(main, /onFloorChange: \(def\) => \{\s*markers\.setSpots\(def \? interiorSpots\(def, retail\.catalog\(\)\) : exteriorSpotList\);\s*exhibitTags\.setFloor\(def\);/);
  assert.match(main, /if \(!studio\) exhibitTags\.update\(\);/);
  assert.match(main, /openExhibit,\s*\n\s*exhibitTags,/);
  // 조준점 아래 스팟: spot-markers 가 내준다(마우스 고정 중 조준점이 스팟에 있을 때만)
  const sm = read('spot-markers.js');
  assert.match(sm, /isAimed: \(\) => aimedId !== null/);
});

test('(o) 이름표 화면: 리테일 이름표와 같은 모양(패널 · 강조 윗선), 손가락 44 px, 감상 · 인트로 · 방식 고르기 동안 숨김', () => {
  const css = read('nowhere.css');
  const tag = css.match(/\n\.nw-exhibit-tag \{([^}]*)\}/);
  assert.ok(tag, '.nw-exhibit-tag 없음');
  const retail = css.match(/\n\.nw-retail-tag \{([^}]*)\}/)[1];
  for (const prop of ['position: absolute;', 'background: var(--nw-bg-panel-strong);', 'border: 1px solid var(--nw-line-struct);', 'border-top: 2px solid var(--nw-accent);', 'border-radius: 2px;', 'color: var(--nw-text);', 'pointer-events: auto;']) {
    assert.ok(retail.includes(prop) && tag[1].includes(prop), `이름표에 리테일 이름표와 같은 ${prop} 없음`);
  }
  assert.match(css, /\n\.nw-exhibit-tags \{[^}]*position: fixed;[^}]*pointer-events: none;/);
  assert.match(css, /@media \(max-width: 720px\), \(pointer: coarse\) \{\s*\.nw-exhibit-tag \{[^}]*min-height: 44px/);
  for (const b of ['is-showcase', 'is-cinema', 'is-choosing']) assert.ok(css.includes(`body.${b} .nw-exhibit-tags`), `${b} 동안 이름표를 숨기지 않음`);
});

test('(p) 문서: README 기능 표에 실내 전시물 감상 줄(이름표 8 m · 클릭 · 경로 · 이전/다음), 조작 안내 줄은 제품 · 건물 · 전시물', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  const row = readme.split('\n').find((l) => l.startsWith('| 전시물 감상 모드(실내) |'));
  assert.ok(row, 'README 전시물 감상 줄 없음');
  for (const re of [/8 m/, /「<이름> · 자세히 보기」/, /자유 시점/, /조준점/, /SUPREME ORIGIN > Retail > HAUS 성수 <층> > <전시물 이름>/, /같은 층 전시물 순서/, /제품이 먼저/]) assert.match(row, re);
  assert.match(readme, /감상 모드는 제품 · 건물 · 전시물 고르기와 감상/);
});

test('(k3) 이름표는 천장 아래로: 노드 윗면 + 0.6 m 가 천장 − 0.3 m 를 넘으면 천장 − 0.3 m(13F 거대한 손 4 m — 천장 4.2 m)', async () => {
  const { exhibitTagAnchors, EXHIBIT_TAG_LIFT, EXHIBIT_TAG_CEIL_GAP } = await import('../public/src/nowhere/exhibits.js');
  assert.equal(EXHIBIT_TAG_CEIL_GAP, 0.3);
  const root = new THREE.Group();
  const tall = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 1));
  tall.name = 'EX_nail';
  tall.position.set(-6, 2, 4);   // 윗면 4.0
  const low = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  low.name = 'EX_sphinx';
  low.position.set(6, 0.5, 4);   // 윗면 1.0
  root.add(tall, low);
  const def = { ceiling: 4.2, exhibits: [{ id: 'nail', pos: [-6, 2, 4] }, { id: 'sphinx', pos: [6, 1.2, 4] }, { id: 'monsters', pos: [0, 4.0, -4] }] };
  const a = exhibitTagAnchors(THREE, root, def);
  assert.ok(Math.abs(a.nail[1] - (4.2 - 0.3)) < 1e-9, '천장 아래로 눌림');
  assert.ok(Math.abs(a.sphinx[1] - (1.0 + EXHIBIT_TAG_LIFT)) < 1e-9, '낮은 전시물은 그대로');
  assert.ok(Math.abs(a.monsters[1] - (4.2 - 0.3)) < 1e-9, '노드가 없을 때(pos + 0.6)도 천장 아래로');
  const noCeil = exhibitTagAnchors(THREE, root, { exhibits: def.exhibits });
  assert.ok(Math.abs(noCeil.nail[1] - (4.0 + EXHIBIT_TAG_LIFT)) < 1e-9, '천장 값이 없으면 누르지 않는다');
});
