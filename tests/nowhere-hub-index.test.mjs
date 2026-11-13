import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CATEGORIES, spotCategory, hubIndex, goPlan } from '../public/src/nowhere/hub-index.js';
import { exteriorSpots, interiorSpots } from '../public/src/nowhere/walk-spots.js';
import { validateCatalog, withoutProducts, floorCrumb, PRODUCTS_URL } from '../public/src/nowhere/products.js';
import { BUILDING_IDS, BUILDING_RECORDS, cardBuildingForSpot } from '../public/src/nowhere/archive.js';

// 카테고리 표지 · 아카이브 목록(hub-index.js — 순수) — 실제 출처(두 월드 layout · inner-layout · products.json · 건물 기록)로 판정 · 목록 · 가기 계획, spot-markers · nowhere.css 연결
const PUB = new URL('../public/', import.meta.url);
const readJson = (p) => JSON.parse(readFileSync(new URL(p, PUB), 'utf8'));
const readSrc = (f) => readFileSync(new URL(`src/nowhere/${f}`, PUB), 'utf8');
const layouts = ['nowhere', 'nowhere-ds2'].map((v) => [v, readJson(`assets/${v}/layout.json`)]);
const inner = readJson('assets/nowhere-inner/inner-layout.json');
const catalog = validateCatalog(readJson(PRODUCTS_URL));
const records = Object.fromEntries(BUILDING_IDS.map((id) => [id, readJson(BUILDING_RECORDS[id])]));
const IDS = CATEGORIES.map((c) => c.id);

test('(a) 카테고리 표(스펙 §2 그대로): 건축 A · 전시물 E · 제품 P · 이동 →', () => {
  assert.deepEqual(CATEGORIES, [
    { id: 'architecture', label: '건축', glyph: 'A' },
    { id: 'exhibit', label: '전시물', glyph: 'E' },
    { id: 'product', label: '제품', glyph: 'P' },
    { id: 'move', label: '이동', glyph: '→' },
  ]);
});

test('(b) 외관 스팟(두 월드): 모두 카테고리 하나 — 정문 = 이동, 건물 view = 건축(기록 카드가 뜨는 곳과 같다)', () => {
  for (const [ver, L] of layouts) {
    const list = exteriorSpots(L);
    assert.ok(list.length > 0, ver);
    for (const s of list) {
      const cat = spotCategory(s);
      assert.ok(IDS.includes(cat), `${ver}/${s.id}: ${cat}`);
      assert.equal(cat === 'architecture', cardBuildingForSpot(s) !== null, `${ver}/${s.id}: 건축 ⇔ 기록 카드`);
    }
    assert.equal(spotCategory(list.find((s) => s.id === 'haus_entrance')), 'move', ver);
    for (const s of list.filter((x) => x.kind === 'view')) assert.equal(spotCategory(s), 'architecture', `${ver}/${s.id}`);
    assert.deepEqual(list.filter((s) => spotCategory(s) === 'move').map((s) => s.id), ['haus_entrance'], ver);
  }
});

test('(c) 실내 스팟(네 층 + 진열): 둘러보기 지점 = 전시물, 제품 = 제품, 엘리베이터 · 출구 = 이동', () => {
  for (const f of inner.floors) {
    const list = interiorSpots(f, catalog);
    for (const s of list) assert.ok(IDS.includes(spotCategory(s)), `${f.id}/${s.id}`);
    for (const s of list) {
      const want = { view: 'exhibit', product: 'product', elevator: 'move', exit: 'move' }[s.kind];
      assert.equal(spotCategory(s), want, `${f.id}/${s.id} (${s.kind})`);
    }
    assert.equal(list.filter((s) => spotCategory(s) === 'exhibit').length, f.tour.length, f.id);
    assert.equal(list.filter((s) => spotCategory(s) === 'move').length, f.exit ? 2 : 1, f.id);
    assert.equal(list.filter((s) => spotCategory(s) === 'architecture').length, 0, `${f.id}: 실내에 건축 스팟 없음`);
  }
  const lobby = interiorSpots(inner.floors.find((f) => f.id === '1'), catalog);
  assert.deepEqual(lobby.filter((s) => spotCategory(s) === 'product').map((s) => s.product), ['kant', 'folding-tarx', 'veggie-oat']);
});

test('(d) 목록(실제 출처): 건축 2 · 전시물 10 · 제품 3 — 문구는 출처 그대로, 자리는 월드 외관 · 층 경로', () => {
  const groups = hubIndex({ records, worldLabel: '성수 2041', innerLayout: inner, catalog });
  assert.deepEqual(groups.map((g) => [g.id, g.label, g.items.length]), [
    ['architecture', '건축', 2],
    ['exhibit', '전시물', 10],
    ['product', '제품', 3],
  ]);
  const [arch, exh, prod] = groups;
  assert.deepEqual(arch.items, [
    { key: 'architecture:haus', category: 'architecture', id: 'haus', title: records.haus.title, place: '성수 2041 · 외관' },
    { key: 'architecture:facearch', category: 'architecture', id: 'facearch', title: records.facearch.title, place: '성수 2041 · 외관' },
  ]);
  assert.deepEqual(arch.items.map((i) => i.title), ['HAUS NOWHERE SEOUL', 'FaceArch']);
  // 전시물: inner-layout 층 순서 · 층 안 순서, 제목 그대로, 자리 = floorCrumb
  const want = inner.floors.flatMap((f) => (f.exhibits || []).map((e) => ({ key: `exhibit:${f.id}:${e.id}`, category: 'exhibit', id: e.id, title: e.title, place: floorCrumb(f.id), floor: f.id })));
  assert.deepEqual(exh.items, want);
  assert.equal(exh.items.find((i) => i.id === 'nail').title, '거대한 손');
  assert.equal(exh.items.find((i) => i.id === 'nail').place, 'HAUS 성수 13F');
  assert.equal(exh.items.find((i) => i.id === 'cafe').place, 'HAUS 성수 B1F');
  // 제품: 진열 순서, 이름 그대로, 자리 = 진열 층
  assert.deepEqual(prod.items, [
    { key: 'product:1:kant', category: 'product', id: 'kant', title: 'Kant', place: 'HAUS 성수 1F', floor: '1' },
    { key: 'product:1:folding-tarx', category: 'product', id: 'folding-tarx', title: 'Folding Tarx', place: 'HAUS 성수 1F', floor: '1' },
    { key: 'product:1:veggie-oat', category: 'product', id: 'veggie-oat', title: 'Veggie Oat', place: 'HAUS 성수 1F', floor: '1' },
  ]);
  const keys = groups.flatMap((g) => g.items.map((i) => i.key));
  assert.equal(new Set(keys).size, keys.length, 'key 중복');
  // 묶음 이름은 카테고리 표의 이름
  for (const g of groups) assert.equal(g.label, CATEGORIES.find((c) => c.id === g.id).label);
  // 다른 월드는 건축 자리만 바뀐다
  const ds2 = hubIndex({ records, worldLabel: 'DS2 산악', innerLayout: inner, catalog });
  assert.deepEqual(ds2[0].items.map((i) => i.place), ['DS2 산악 · 외관', 'DS2 산악 · 외관']);
  assert.deepEqual(ds2.slice(1), groups.slice(1));
});

test('(e) 목록: 진열에서 뺀 제품은 빠지고(withoutProducts), 개수 0 인 묶음은 뺀다 · 없는 출처는 그 묶음만 빠진다', () => {
  const some = hubIndex({ records, worldLabel: '성수 2041', innerLayout: inner, catalog: withoutProducts(catalog, new Set(['folding-tarx'])) });
  assert.deepEqual(some.find((g) => g.id === 'product').items.map((i) => i.id), ['kant', 'veggie-oat']);
  const none = hubIndex({ records, worldLabel: '성수 2041', innerLayout: inner, catalog: withoutProducts(catalog, new Set(['kant', 'folding-tarx', 'veggie-oat'])) });
  assert.deepEqual(none.map((g) => g.id), ['architecture', 'exhibit']);
  assert.deepEqual(hubIndex({ records, worldLabel: '성수 2041', innerLayout: inner, catalog: null }).map((g) => g.id), ['architecture', 'exhibit']);
  assert.deepEqual(hubIndex({ records: { haus: records.haus }, worldLabel: '성수 2041', innerLayout: inner, catalog }).find((g) => g.id === 'architecture').items.map((i) => i.id), ['haus']);
  assert.deepEqual(hubIndex({ records: null, worldLabel: '성수 2041', innerLayout: null, catalog }).map((g) => g.id), ['product']);
  assert.deepEqual(hubIndex({ records: null, worldLabel: '성수 2041', innerLayout: null, catalog: null }), []);
});

test('(f) 가기 계획: 건축은 어디서든 open, 전시물 · 제품은 밖이면 enter → floor → open, 실내 다른 층이면 floor → open, 같은 층이면 open', () => {
  const [arch, exh, prod] = hubIndex({ records, worldLabel: '성수 2041', innerLayout: inner, catalog });
  const haus = arch.items[0];
  const nail = exh.items.find((i) => i.id === 'nail');
  const kant = prod.items.find((i) => i.id === 'kant');
  assert.deepEqual(goPlan(haus, { interiorActive: false, floorId: null }), ['open']);
  assert.deepEqual(goPlan(haus, { interiorActive: true, floorId: '13' }), ['open']);
  assert.deepEqual(goPlan(nail, { interiorActive: false, floorId: null }), ['enter', 'floor', 'open']);
  assert.deepEqual(goPlan(nail, { interiorActive: true, floorId: '1' }), ['floor', 'open']);
  assert.deepEqual(goPlan(nail, { interiorActive: true, floorId: '13' }), ['open']);
  assert.deepEqual(goPlan(kant, { interiorActive: true, floorId: '13' }), ['floor', 'open']);
  assert.deepEqual(goPlan(kant, { interiorActive: true, floorId: '1' }), ['open']);
  // 밖에서는 지난 층이 같아도 들어간 뒤 층을 맞춘다(기본 층이 그 층이면 건너뛰는 것은 실행 쪽)
  assert.deepEqual(goPlan(kant, { interiorActive: false, floorId: '1' }), ['enter', 'floor', 'open']);
});

test('(g) 순수 모듈: three · DOM 없음', () => {
  const src = readSrc('hub-index.js');
  assert.doesNotMatch(src, /from 'three'/);
  assert.doesNotMatch(src, /\bdocument\.|\bwindow\./);
});

// 상대 휘도 · 대비(WCAG 2.x)
const lin = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

test('(h) 스팟 표지 연결: 버튼 data-category(spotCategory) · 아이콘 data-glyph, CSS 토큰 · 테두리 · 가까운 단계 글자(어두운 바탕 대비 4.5:1 이상)', () => {
  const sm = readSrc('spot-markers.js');
  assert.match(sm, /import \{ CATEGORIES, spotCategory \} from '\.\/hub-index\.js';/);
  assert.match(sm, /const cat = CATEGORIES\.find\(\(c\) => c\.id === spotCategory\(s\)\);/);
  assert.match(sm, /btn\.dataset\.category = cat\.id;/);
  assert.match(sm, /icon\.dataset\.glyph = cat\.glyph;/);

  const css = readSrc('nowhere.css');
  const root = css.match(/:root \{([^}]*)\}/)[1];
  const tokens = {};
  for (const id of IDS) {
    const m = root.match(new RegExp(`--nw-cat-${id}: (#[0-9A-Fa-f]{6});`));
    assert.ok(m, `:root 에 --nw-cat-${id} 없음`);
    tokens[id] = m[1];
    assert.match(css, new RegExp(`\\.nw-spot\\[data-category="${id}"\\] \\{\\s*--nw-cat: var\\(--nw-cat-${id}\\);\\s*\\}`), `${id} 표지 색`);
  }
  assert.equal(new Set(Object.values(tokens).map((h) => h.toUpperCase())).size, 4, '네 카테고리 색은 서로 다르다');
  const icon = css.match(/\n\.nw-spot-icon \{([^}]*)\}/)[1];
  assert.match(icon, /border: 1\.5px solid var\(--nw-cat\);/, '먼 단계 ◇ 테두리는 카테고리 색');
  assert.match(icon, /box-shadow: 0 0 0 1px rgba\(9, 15, 26, 0\.5\), /, '먼 단계 ◇ 는 얇은 어두운 테두리(흰 장면 위에서도 보이게)');
  const aimed = css.match(/\n\.nw-spot\.is-aimed \.nw-spot-icon,\n\.nw-spot:hover \.nw-spot-icon \{([^}]*)\}/)[1];
  assert.match(aimed, /box-shadow: 0 0 0 1px rgba\(9, 15, 26, 0\.5\), /, '조준 · 올림에서도 어두운 테두리 그대로');
  const nearIcon = css.match(/\n\.nw-spot\.is-near \.nw-spot-icon \{([^}]*)\}/)[1];
  assert.match(nearIcon, /background: var\(--nw-bg-panel-strong\);/, '가까운 단계 동그라미 바탕은 어두운 패널');
  // 글자: 늘 있되 먼 단계에서는 투명 — 가까운 단계가 되면 마름모가 다 돌고 커진 뒤에 나타난다(돌아가는 작은 마름모 안에서 튀지 않게)
  const glyph = css.match(/\n\.nw-spot-icon::after \{([^}]*)\}/)[1];
  assert.match(glyph, /content: attr\(data-glyph\);/);
  assert.match(glyph, /color: var\(--nw-cat\);/);
  assert.match(glyph, /opacity: 0;/);
  const nearGlyph = css.match(/\n\.nw-spot\.is-near \.nw-spot-icon::after \{([^}]*)\}/)[1];
  assert.match(nearGlyph, /opacity: 1;/);
  const delay = Number(nearGlyph.match(/transition: opacity [\d.]+s ease ([\d.]+)s;/)[1]);
  const turn = Number(icon.match(/transform ([\d.]+)s ease/)[1]);
  assert.ok(delay >= turn * 0.5 && delay <= turn, `글자는 마름모가 반 넘게 돈 뒤에(지연 ${delay}s, 돌기 ${turn}s)`);

  // 동그라미 바탕(--nw-bg-panel-strong, 반투명)이 가장 밝은 장면(흰색) 위에 놓여도 글자 대비 4.5:1 이상
  const bg = root.match(/--nw-bg-panel-strong: rgba\((\d+), (\d+), (\d+), ([\d.]+)\);/).slice(1).map(Number);
  const worst = bg.slice(0, 3).map((c) => c * bg[3] + 255 * (1 - bg[3]));
  for (const id of IDS) {
    const r = contrast(hexRgb(tokens[id]), worst);
    assert.ok(r >= 4.5, `${id} ${tokens[id]} 대비 ${r.toFixed(2)} < 4.5`);
  }
});
