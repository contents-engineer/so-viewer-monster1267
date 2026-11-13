import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  BUILDING_IDS, BUILDING_RECORDS, BUILDING_TAG_RANGE, BUILDING_TAG_LIFT, CARD_KEEP_RANGE, CLICK_SLOP, PART_EXCLUDE, ARCHITECTURE_CRUMBS,
  worldToBuilding, buildingItem, buildingCollection, buildingParts, cardBuildingForSpot, tagVisible,
} from '../public/src/nowhere/archive.js';
import { buildingToWorld } from '../public/src/nowhere/tour-config.js';
import { stepItem, validateCatalog } from '../public/src/nowhere/products.js';
import { exteriorSpots, interiorSpots } from '../public/src/nowhere/walk-spots.js';

const PUB = new URL('../public/', import.meta.url);
const readJson = (p) => JSON.parse(readFileSync(new URL(p, PUB), 'utf8'));
const records = { haus: readJson('assets/record.json'), facearch: readJson('assets/facearch.json') };
const layouts = ['nowhere', 'nowhere-ds2'].map((v) => [v, readJson(`assets/${v}/layout.json`)]);
const seongsu = layouts[0][1];
const heroUrls = { haus: 'assets/gm_building.glb', facearch: 'assets/facearch.glb' };
const HINT = '드래그 · 한 손가락 회전 · 휠 · 두 손가락 확대 · ← → 다른 건물 · Esc 나가기';

test('(a) 값: 두 건물 순서 · 기록 파일 · 이름표 · 카드 · 클릭 거리 · 뺄 부위 · 경로 앞부분', () => {
  assert.deepEqual(BUILDING_IDS, ['haus', 'facearch']);
  assert.deepEqual(BUILDING_RECORDS, { haus: 'assets/record.json', facearch: 'assets/facearch.json' });
  for (const p of Object.values(BUILDING_RECORDS)) assert.ok(existsSync(new URL(p, PUB)), `${p} 없음`);
  assert.equal(BUILDING_TAG_RANGE, 220);
  assert.equal(BUILDING_TAG_LIFT, 4);
  assert.equal(CARD_KEEP_RANGE, 260);
  assert.ok(CARD_KEEP_RANGE > BUILDING_TAG_RANGE, '이름표로 연 카드가 바로 닫히지 않게');
  assert.equal(CLICK_SLOP, 5);
  const retail = readFileSync(new URL('src/nowhere/retail-display.js', PUB), 'utf8');
  assert.match(retail, new RegExp(`const CLICK_SLOP = ${CLICK_SLOP};`), 'retail 과 같은 값');
  assert.deepEqual(PART_EXCLUDE, ['haus_garden']);
  assert.deepEqual(ARCHITECTURE_CRUMBS, ['SUPREME ORIGIN', 'Architecture']);
});

test('(b) 건물 항목: 기록 파일 값 그대로(kicker ARCHITECTURE · index, 경로 SUPREME ORIGIN > Architecture > title, facts → 행, note), 한 단계 모델', () => {
  assert.deepEqual(buildingItem('haus', records.haus, heroUrls.haus), {
    id: 'haus',
    name: 'HAUS NOWHERE SEOUL',
    kicker: 'ARCHITECTURE · 0001',
    crumbs: ['SUPREME ORIGIN', 'Architecture', 'HAUS NOWHERE SEOUL'],
    rows: records.haus.facts.map(([label, value]) => ({ label, value })),
    note: records.haus.note,
    liteUrl: 'assets/gm_building.glb',
    hiUrl: null,
  });
  const face = buildingItem('facearch', records.facearch, heroUrls.facearch);
  assert.equal(face.name, 'FaceArch');
  assert.equal(face.kicker, 'ARCHITECTURE · 0002');
  assert.deepEqual(face.crumbs, ['SUPREME ORIGIN', 'Architecture', 'FaceArch']);
  assert.deepEqual(face.rows[0], { label: '규모', value: '22 × 18 m, 높이 31 m' });
  assert.equal(face.rows.length, records.facearch.facts.length);
  assert.equal(face.note, records.facearch.note);
  assert.equal(face.hiUrl, null);
  // 기록이 note 를 빼면 빈 문자열(패널이 그 줄을 숨긴다)
  const { note, ...noNote } = records.haus;
  assert.equal(buildingItem('haus', noNote, heroUrls.haus).note, '');
});

test('(c) 건물 목록: kind building · BUILDING_IDS 순서(기록 · 모델 주소가 있는 것만) · 안내 한 줄, 이전 · 다음은 HAUS → FaceArch → HAUS', () => {
  const reversed = { facearch: records.facearch, haus: records.haus };
  const c = buildingCollection(reversed, heroUrls, 'facearch');
  assert.equal(c.kind, 'building');
  assert.deepEqual(c.items.map((i) => i.id), ['haus', 'facearch']);
  assert.deepEqual(c.items[0], buildingItem('haus', records.haus, heroUrls.haus));
  assert.equal(c.startId, 'facearch');
  assert.equal(c.hint, HINT);
  assert.equal('loadLite' in c, false, '무대 로더가 item.liteUrl 을 받는다');
  assert.equal(stepItem(c.items, 'haus', 1), 'facearch');
  assert.equal(stepItem(c.items, 'facearch', 1), 'haus');
  assert.equal(stepItem(c.items, 'haus', -1), 'facearch');
  // 기록이나 모델 주소가 없는 건물은 뺀다
  assert.deepEqual(buildingCollection({ haus: records.haus }, heroUrls, 'haus').items.map((i) => i.id), ['haus']);
  assert.deepEqual(buildingCollection(records, { facearch: heroUrls.facearch }, 'facearch').items.map((i) => i.id), ['facearch']);
});

test('(d) 월드 → 건물 로컬: buildingToWorld 의 역(두 월드 × 두 건물 왕복 오차 < 1e-9), 건물이 없으면 null', () => {
  const pts = [[0, 0, 0], [12.5, 3, -7.25], [-30, 81, 26], [103.741, 16.584, -5.914]];
  for (const [ver, L] of layouts) {
    for (const id of BUILDING_IDS) {
      for (const p of pts) {
        const w = buildingToWorld(L, id, p);
        const back = worldToBuilding(L, id, w);
        back.forEach((v, i) => assert.ok(Math.abs(v - p[i]) < 1e-9, `${ver} ${id} ${p} → ${back}`));
        const again = buildingToWorld(L, id, worldToBuilding(L, id, p));
        again.forEach((v, i) => assert.ok(Math.abs(v - p[i]) < 1e-9, `${ver} ${id} 반대 방향 ${p}`));
      }
    }
    // 건물 자리 = 로컬 원점
    assert.deepEqual(worldToBuilding(L, 'facearch', L.buildings.facearch.pos).map((v) => Math.round(v * 1e9) / 1e9), [0, 0, 0]);
  }
  assert.equal(worldToBuilding(seongsu, 'nope', [0, 0, 0]), null);
  assert.equal(worldToBuilding(null, 'haus', [0, 0, 0]), null);
});

test('(e) 부위: 두 월드 모두 6 개(HAUS 포디움 · 타워 · 크라운, FaceArch 몸체 · 눈 · 다리 — 전정 haus_garden 은 뺀다), 문구는 anchors 그대로, 로컬 좌표는 그 건물 경계 안', () => {
  const MARGIN = 0.5;   // m — 표지는 외벽 면에 붙어 있다(HAUS 포디움 · 크라운 z 26 은 경계 25.9 바로 바깥)
  const solid = (id) => seongsu.solids.find((s) => s.id === id);
  const bounds = { haus: solid('HAUS'), facearch: solid('FACEARCH') };
  for (const [ver, L] of layouts) {
    const all = [];
    for (const id of BUILDING_IDS) {
      const title = records[id].title;
      const parts = buildingParts(L, id, title);
      all.push(...parts);
      assert.deepEqual(parts.map((p) => p.id).sort(), id === 'haus' ? ['haus_crown', 'haus_podium', 'haus_tower'] : ['facearch_body', 'facearch_eyes', 'facearch_legs'], `${ver} ${id}`);
      for (const p of parts) {
        const a = L.anchors.find((x) => x.id === p.id);
        assert.equal(a.layer, 'building');
        assert.equal(p.title, a.title);
        assert.equal(p.lore, a.lore);
        assert.deepEqual(p.rows, a.facts.map(([label, value]) => ({ label, value })));
        assert.equal(p.kicker, `${title} · PART`);
        // 로컬 → 월드 = anchors pos
        buildingToWorld(L, id, p.local).forEach((v, i) => assert.ok(Math.abs(v - a.pos[i]) < 1e-9, `${ver} ${p.id} 왕복`));
        // 성수 layout 의 건물 자리에 놓으면 그 건물 solids 상자 안(두 월드 모두 같은 자리의 같은 건물)
        const w = buildingToWorld(seongsu, id, p.local);
        const b = bounds[id];
        for (let i = 0; i < 3; i++) {
          assert.ok(w[i] >= b.min[i] - MARGIN && w[i] <= b.max[i] + MARGIN, `${ver} ${p.id} 축 ${i}: ${w[i]} 가 ${b.min[i]}…${b.max[i]} 밖`);
        }
      }
    }
    assert.equal(all.length, 6, ver);
    assert.ok(!all.some((p) => PART_EXCLUDE.includes(p.id)), `${ver}: 전정은 빠진다`);
    assert.ok(L.anchors.some((a) => a.id === 'haus_garden' && a.layer === 'building'), `${ver}: 전정 anchor 는 파일에 있다(빼는 것을 확인)`);
  }
  assert.deepEqual(buildingParts(seongsu, 'nope', 'X'), []);
});

test('(f) 카드 트리거: 외관 건물 view 스팟 도착 → 그 건물, 정문(entrance) · 실내 · 제품 스팟은 카드 없음', () => {
  for (const [ver, L] of layouts) {
    const spots = exteriorSpots(L);
    assert.ok(spots.length > 0);
    for (const s of spots) {
      const want = s.kind === 'view' ? s.building : null;
      assert.equal(cardBuildingForSpot(s), want, `${ver} ${s.id}`);
    }
    assert.equal(cardBuildingForSpot(spots.find((s) => s.id === 'haus_entrance')), null, '정문은 입장 질문');
    assert.equal(cardBuildingForSpot(spots.find((s) => s.id === 'face_front')), 'facearch');
    assert.equal(cardBuildingForSpot(spots.find((s) => s.id === 'haus_garden')), 'haus');
  }
  const inner = readJson('assets/nowhere-inner/inner-layout.json');
  const catalog = validateCatalog(readJson('assets/products/products.json'));
  const insideSpots = interiorSpots(inner.floors.find((f) => f.id === '1'), catalog);
  assert.ok(insideSpots.some((s) => s.kind === 'view') && insideSpots.some((s) => s.kind === 'product'));
  for (const s of insideSpots) assert.equal(cardBuildingForSpot(s), null, s.id);
});

test('(g) 건물 이름표 보이기: 220 m 안(경계 포함)이고 화면 안(NDC x · y −1…1, z −1 < z < 1 — 카메라 뒤 · far 밖 제외)', () => {
  const ok = { distance: 100, ndc: [0, 0, 0.5] };
  assert.equal(tagVisible(ok), true);
  assert.equal(tagVisible({ ...ok, distance: BUILDING_TAG_RANGE }), true);
  assert.equal(tagVisible({ ...ok, distance: BUILDING_TAG_RANGE + 0.01 }), false);
  for (const ndc of [[1, 1, 0.9], [-1, -1, -0.9], [0.99, -0.99, 0]]) assert.equal(tagVisible({ ...ok, ndc }), true, String(ndc));
  for (const ndc of [[1.01, 0, 0.5], [0, -1.01, 0.5], [0, 0, 1], [0, 0, -1], [0, 0, 1.2]]) assert.equal(tagVisible({ ...ok, ndc }), false, String(ndc));
});
