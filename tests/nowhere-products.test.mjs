import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  validateCatalog, findProduct, floorDisplays, displayFront, productSpots, sizeText, infoRows, floorCrumb, breadcrumb,
  stepProduct, stepItem, productCollection, withoutProducts, resolveShowcaseKey, showcaseKeyGate, stageFraming,
  PRODUCTS_URL, PLINTH, COVER, GLOW, PRODUCT_CENTER_Y, SPOT_FRONT, LABEL_RANGE, PICK_RANGE, AUTO_ROTATE_DELAY,
} from '../public/src/nowhere/products.js';
import { interiorSpots } from '../public/src/nowhere/walk-spots.js';
import { readGlbJson, meshNodeBoxes } from './lib/glb.mjs';

const PUB = new URL('../public/', import.meta.url);
const raw = JSON.parse(readFileSync(new URL(PRODUCTS_URL, PUB), 'utf8'));
const catalog = validateCatalog(raw);
const inner = JSON.parse(readFileSync(new URL('assets/nowhere-inner/inner-layout.json', PUB), 'utf8'));
const f1 = inner.floors.find((f) => f.id === '1');
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const clone = () => JSON.parse(JSON.stringify(raw));

test('(a) 목록: 세 제품(실측 크기 · 원본 재질 이름), 문구 필드는 빈 문자열, 파일이 있고 1F 진열 순서가 Kant · Folding Tarx · Veggie Oat', () => {
  assert.equal(PRODUCTS_URL, 'assets/products/products.json');
  assert.deepEqual(catalog.products.map((p) => [p.id, p.name, p.category]), [
    ['kant', 'Kant', 'eyewear'],
    ['folding-tarx', 'Folding Tarx', 'eyewear'],
    ['veggie-oat', 'Veggie Oat', 'eyewear'],
  ]);
  assert.deepEqual(findProduct(catalog, 'kant').sizeMm, { width: 157, length: 160, height: 40 });
  assert.deepEqual(findProduct(catalog, 'folding-tarx').sizeMm, { width: 154, length: 139, height: 35 });
  assert.deepEqual(findProduct(catalog, 'veggie-oat').sizeMm, { width: 147, length: 145, height: 33 });
  assert.deepEqual(findProduct(catalog, 'kant').materials, ['렌즈', '플라스틱 프레임', '메탈']);
  for (const p of catalog.products) {
    assert.deepEqual([p.description, p.collection, p.color], ['', '', ''], `${p.id}: 받기 전 문구는 비운다`);
    assert.ok(p.materials.length > 0);
    assert.ok(existsSync(new URL(p.glb, PUB)), `${p.glb} 없음`);
    assert.ok(existsSync(new URL(p.liteGlb, PUB)), `${p.liteGlb} 없음`);
  }
  assert.deepEqual(floorDisplays(catalog, '1').map((d) => d.product.id), ['kant', 'folding-tarx', 'veggie-oat']);
  assert.deepEqual(floorDisplays(catalog, '12'), []);
  assert.deepEqual(floorDisplays(null, '1'), []);
  assert.equal(findProduct(catalog, 'nope'), null);
});

test('(b) 검증: id 중복 · 형식, 없는 제품 진열, 크기 · 재질 · 문구 필드 · 파일 경로 · pos · yaw 오류를 모두 모아 던진다', () => {
  const dup = clone();
  dup.products[1].id = 'kant';
  assert.throws(() => validateCatalog(dup), /id 중복: kant/);
  const bad = clone();
  bad.products[0].id = 'Kant!';
  bad.products[1].sizeMm.width = 0;
  bad.products[1].materials = ['렌즈', ''];
  delete bad.products[2].color;
  bad.products[2].glb = 'assets/products/other.glb';
  bad.displays[0].product = 'ghost';
  bad.displays[1].pos = [1, 2];
  bad.displays[2].yaw = '0';
  assert.throws(() => validateCatalog(bad), (e) => {
    for (const re of [/id 형식/, /sizeMm/, /materials/, /color/, /glb 는/, /없는 제품 "ghost"/, /pos 는/, /yaw/]) assert.match(e.message, re);
    return true;
  });
  assert.throws(() => validateCatalog({ products: [], displays: [] }), /products 가 비었다/);
  assert.throws(() => validateCatalog(null), /products 가 비었다/);
});

test('(c) 제품 스팟: 받침대 앞 1.2 m(정면 = yaw) · 볼거리는 제품 가운데 · kind product · 층 스팟에 더해진다', () => {
  assert.deepEqual(displayFront(0).map((v) => Math.round(v * 1e9) / 1e9), [0, 1]);
  assert.deepEqual(displayFront(90).map((v) => Math.round(v * 1e9) / 1e9), [1, 0]);
  const spots = productSpots(catalog, '1');
  assert.equal(spots.length, 3);
  floorDisplays(catalog, '1').forEach((d, i) => {
    const s = spots[i];
    const [fx, fz] = displayFront(d.yaw);
    assert.ok(near(Math.hypot(s.x - d.pos[0], s.z - d.pos[2]), SPOT_FRONT, 1e-9));
    assert.ok((s.x - d.pos[0]) * fx + (s.z - d.pos[2]) * fz > 0, '정면 쪽');
    assert.deepEqual(s.look, [d.pos[0], d.pos[1] + PRODUCT_CENTER_Y, d.pos[2]]);
    assert.equal(s.kind, 'product');
    assert.equal(s.label, d.product.name);
    assert.equal(s.product, d.product.id);
    assert.equal(s.id, `1_product_${d.product.id}`);
    assert.equal(s.beacon, false);
    assert.equal(s.caption, null);
  });
  const withProducts = interiorSpots(f1, catalog);
  const plain = interiorSpots(f1);
  assert.equal(withProducts.length, plain.length + 3);
  assert.equal(new Set(withProducts.map((s) => s.id)).size, withProducts.length);
  assert.equal(plain.filter((s) => s.kind === 'product').length, 0);
  assert.deepEqual(interiorSpots(inner.floors.find((f) => f.id === '12'), catalog).filter((s) => s.kind === 'product'), []);
});

test('(d) 정보 문구: 크기 · 재질, 비어 있는 설명 · 컬렉션 · 컬러는 행이 없다 · 경로 문구', () => {
  assert.equal(sizeText({ width: 157, length: 160, height: 40 }), '폭 157 · 길이 160 · 높이 40 mm');
  assert.deepEqual(infoRows(findProduct(catalog, 'kant')), [
    { key: 'size', label: '크기', value: '폭 157 · 길이 160 · 높이 40 mm' },
    { key: 'materials', label: '재질', value: '렌즈 · 플라스틱 프레임 · 메탈' },
  ]);
  const filled = { ...findProduct(catalog, 'kant'), description: '설명 문장', collection: '  ', color: '01' };
  assert.deepEqual(infoRows(filled).map((r) => r.key), ['size', 'materials', 'description', 'color']);
  assert.deepEqual(infoRows({ ...filled, materials: [] }).map((r) => r.key), ['size', 'description', 'color']);
  assert.equal(floorCrumb('1'), 'HAUS 성수 1F');
  assert.equal(floorCrumb('b1'), 'HAUS 성수 B1F');
  assert.deepEqual(breadcrumb('1', 'Kant'), ['SUPREME ORIGIN', 'Retail', 'HAUS 성수 1F', 'Kant']);
});

test('(e) 이전 · 다음은 같은 층 진열 순서로 돌고, 감상 키는 Esc · ← · → 만', () => {
  assert.equal(stepProduct(catalog, '1', 'kant', 1), 'folding-tarx');
  assert.equal(stepProduct(catalog, '1', 'veggie-oat', 1), 'kant');
  assert.equal(stepProduct(catalog, '1', 'kant', -1), 'veggie-oat');
  assert.equal(stepProduct(catalog, '1', 'folding-tarx', -1), 'kant');
  assert.equal(stepProduct(catalog, '1', 'ghost', 1), null);
  assert.equal(stepProduct(catalog, '12', 'kant', 1), null);
  assert.equal(resolveShowcaseKey('Escape'), 'close');
  assert.equal(resolveShowcaseKey('ArrowLeft'), 'prev');
  assert.equal(resolveShowcaseKey('ArrowRight'), 'next');
  for (const k of ['Enter', ' ', 'v', 'w', '?', 'ArrowUp']) assert.equal(resolveShowcaseKey(k), null, k);
});

test('(e2) 감상 키 문지기: 감상 중이 아니면 손대지 않고, 조작 안내 · 모달 · 페이드 중에는 ? · P · ⌘ · Ctrl 만 지나가고 나머지(V · Esc · ←/→ …)는 동작 없이 막는다', () => {
  const gate = (o) => showcaseKeyGate({ active: true, busy: false, blocked: false, defaultPrevented: false, key: 'x', ...o });
  // 평상시 감상 중: 감상 키는 동작, ? · P · 조합은 통과, 그 밖(V 포함)은 막음
  assert.equal(gate({ key: 'Escape' }), 'close');
  assert.equal(gate({ key: 'ArrowLeft' }), 'prev');
  assert.equal(gate({ key: 'ArrowRight' }), 'next');
  for (const key of ['?', 'p', 'P']) assert.equal(gate({ key }), 'pass', key);
  assert.equal(gate({ key: 'z', metaKey: true }), 'pass');
  assert.equal(gate({ key: 'z', ctrlKey: true }), 'pass');
  for (const key of ['v', 'V', 'w', ' ', 'Enter']) assert.equal(gate({ key }), 'swallow', key);
  // 감상 중이 아니면(닫힘) 무관 · 앞 처리기가 받은 키도 무관
  assert.equal(gate({ active: false, key: 'v' }), 'ignore');
  assert.equal(gate({ key: 'Escape', defaultPrevented: true }), 'ignore');
  // 조작 안내 · 모달이 열려 있을 때와 여닫는 페이드 중(열기 페이드는 active 가 아직 false): 감상 동작 없이 막기만, ? · P 는 통과
  for (const o of [{ blocked: true }, { busy: true }, { busy: true, active: false }, { busy: true, blocked: true }]) {
    for (const key of ['v', 'V', 'Escape', 'ArrowLeft', 'ArrowRight', 'w']) assert.equal(gate({ ...o, key }), 'swallow', `${JSON.stringify(o)} ${key}`);
    assert.equal(gate({ ...o, key: '?' }), 'pass');
    assert.equal(gate({ ...o, key: 'P' }), 'pass');
  }
  assert.equal(gate({ busy: true, active: false, key: 'v', defaultPrevented: true }), 'ignore');
});

test('(e3) 감상 중 캔버스 click 가드: 캡처 단계에서 active · busy 일 때 stopImmediatePropagation, 처리기는 camera · 스팟 처리기보다 먼저 닿는 캔버스 캡처', () => {
  const src = readFileSync(new URL('../public/src/nowhere/showcase.js', import.meta.url), 'utf8');
  assert.match(src, /canvas\.addEventListener\(\s*'click',\s*\(e\) => \{\s*if \(active \|\| busy\) e\.stopImmediatePropagation\(\);\s*\},\s*true,\s*\);/);
});

test('(f) 감상 무대 거리: 처음 거리에서 구 전체가 화면 높이 · 폭에 들고(세로 화면 포함), 최소 < 처음 < 최대, 최소는 표면 밖', () => {
  const half = (15 * Math.PI) / 180;
  for (const r of [0.08, 0.11, 0.5]) {
    for (const aspect of [16 / 9, 1, 390 / 844]) {
      const f = stageFraming(r, 30, aspect);
      const hHalf = Math.atan(Math.tan(half) * aspect);
      assert.ok(f.distance >= r / Math.sin(half) && f.distance >= r / Math.sin(hHalf), `잘림 r ${r} aspect ${aspect}`);
      assert.ok(f.minDistance > r && f.minDistance < f.distance && f.distance < f.maxDistance);
      assert.ok(f.near > 0 && f.near < f.minDistance - r && f.far > f.maxDistance + r);
    }
  }
  assert.deepEqual(stageFraming(0.1, 30), stageFraming(0.1, 30, 1));
  assert.ok(stageFraming(0.1, 30, 390 / 844).distance > stageFraming(0.1, 30, 16 / 9).distance, '세로 화면은 더 멀리');
});

test('(g) 값: 받침대 · 덮개 · 발광 판 크기, 눈높이, 스팟 · 이름표 · 고르기 거리, 자동 회전 대기', () => {
  assert.deepEqual(PLINTH, { width: 0.5, height: 1.05, depth: 0.5 });
  assert.deepEqual(COVER, { width: 0.42, height: 0.28, depth: 0.42 });
  assert.ok(GLOW.width <= COVER.width && GLOW.depth <= COVER.depth);
  assert.equal(PRODUCT_CENTER_Y, 1.08);
  assert.equal(SPOT_FRONT, 1.2);
  assert.equal(LABEL_RANGE, 4);
  assert.equal(PICK_RANGE, 12);
  assert.equal(AUTO_ROTATE_DELAY, 4);
  // 제품은 발광 판 위에 얹힌다(가장 높은 40 mm 가 판에 닿고 — 실측 반올림 0.5 mm 까지 — 나머지는 조금 위), 덮개 안에 든다
  const top = PLINTH.height + COVER.height;
  const plate = PLINTH.height + GLOW.height;
  const tallest = Math.max(...catalog.products.map((p) => p.sizeMm.height)) / 1000;
  assert.ok(Math.abs(PRODUCT_CENTER_Y - tallest / 2 - plate) < 1e-9, '가장 높은 제품 바닥 = 발광 판 윗면');
  for (const p of catalog.products) {
    const h = p.sizeMm.height / 1000;
    assert.ok(PRODUCT_CENTER_Y - h / 2 >= plate - 0.0005 && PRODUCT_CENTER_Y + h / 2 < top, `${p.id} 높이`);
    assert.ok(p.sizeMm.width / 1000 < COVER.width && p.sizeMm.length / 1000 < COVER.depth, `${p.id} 폭 · 길이`);
  }
});

test('(h) 1F 진열 자리: 간격 2.5 m · 층 안 · 전시물(EX_) · 둘러보기 지점 · 엘리베이터 · 출구와 1.5 m 이상, 벽 · 기둥과 0.9 m 이상, 스팟은 빈 자리', () => {
  const solids = meshNodeBoxes(readGlbJson(new URL(f1.glb, PUB))).filter((b) => !/^IN_(floor|ceiling)/.test(b.name) && b.min[1] < 1.9 && b.max[1] > 0.3);
  const R = Math.hypot(PLINTH.width, PLINTH.depth) / 2;   // 받침대 바닥을 감싸는 원(어느 yaw 든)
  const rectDist = (x, z, b) => Math.hypot(Math.max(b.min[0] - x, 0, x - b.max[0]), Math.max(b.min[2] - z, 0, z - b.max[2]));
  const ds = floorDisplays(catalog, '1');
  const [x0, z0, x1, z1] = f1.bounds;
  for (let i = 1; i < ds.length; i++) {
    const g = Math.hypot(ds[i].pos[0] - ds[i - 1].pos[0], ds[i].pos[2] - ds[i - 1].pos[2]);
    assert.ok(near(g, 2.5, 0.05), `간격 ${g}`);
  }
  for (const d of ds) {
    const [x, , z] = d.pos;
    const id = d.product.id;
    assert.equal(d.pos[1], 0, `${id}: 1F 바닥 높이`);
    assert.ok(x - R > x0 + 1 && x + R < x1 - 1 && z - R > z0 + 1 && z + R < z1 - 1, `${id}: 층 영역 안(벽에서 1 m)`);
    for (const b of solids) {
      const gap = rectDist(x, z, b) - R;
      if (b.name.startsWith('EX_')) assert.ok(gap >= 1.5, `${id}: 전시물 ${b.name} 와 ${gap.toFixed(2)} m`);
      else assert.ok(gap >= 0.9, `${id}: ${b.name} 와 ${gap.toFixed(2)} m`);
    }
    for (const [k, t] of f1.tour.entries()) {
      const gap = Math.hypot(t.pos[0] - x, t.pos[2] - z) - R;
      assert.ok(gap >= 1.5, `${id}: 둘러보기 지점 ${k} 와 ${gap.toFixed(2)} m`);
    }
    for (const [name, a] of [['엘리베이터', f1.elevator], ['출구', f1.exit]]) {
      const gap = Math.hypot(a.pos[0] - x, a.pos[2] - z) - a.radius - R;
      assert.ok(gap >= 1.5, `${id}: ${name} 영역과 ${gap.toFixed(2)} m`);
    }
  }
  for (const s of productSpots(catalog, '1')) {
    assert.ok(s.x > x0 + 0.5 && s.x < x1 - 0.5 && s.z > z0 + 0.5 && s.z < z1 - 0.5, `${s.id}: 층 영역 안`);
    for (const b of solids) assert.ok(rectDist(s.x, s.z, b) >= 0.6, `${s.id}: ${b.name} 와 ${rectDist(s.x, s.z, b).toFixed(2)} m`);
    for (const d of ds) assert.ok(Math.hypot(s.x - d.pos[0], s.z - d.pos[2]) - R >= 0.6, `${s.id}: 받침대와 너무 가까움`);
  }
});

test('(i) 감상 모드 모듈 · 화면: 스튜디오 무대(RoomEnvironment · 조명 3개) · 조작 · 고해상도 규칙 · 단독 렌더 · CSS', () => {
  const src = readFileSync(new URL('../public/src/nowhere/showcase.js', import.meta.url), 'utf8');
  assert.match(src, /new RoomEnvironment\(\)/);
  assert.match(src, /pmrem\.fromScene\(room/);
  assert.equal((src.match(/new THREE\.DirectionalLight\(/g) || []).length, 3, '키 · 필 · 림 조명 3개');
  assert.match(src, /new OrbitControls\(camera, canvas\)/);
  assert.match(src, /controls\.enablePan = false/);
  assert.match(src, /idle >= AUTO_ROTATE_DELAY/);
  assert.match(src, /stageFraming\(radius, FOV, applyView\(\)\)/);   // 빈 곳(옆 패널 왼쪽) 비율로 맞춘다 — (k)
  assert.match(src, /showcaseKeyGate\(\{/);
  assert.match(src, /stopImmediatePropagation\(\)/);
  assert.match(src, /quality\.device !== 'phone'/);
  assert.match(src, /'< BACK'/);
  assert.match(src, /renderer\.render\(scene, camera\)/);
  const css = readFileSync(new URL('../public/src/nowhere/nowhere.css', import.meta.url), 'utf8');
  assert.match(css, /\.nw-showcase \{[^}]*z-index: 32/);
  assert.match(css, /\.nw-showcase-pager \.nw-btn \{[^}]*min-height: 44px/);
  for (const sel of ['.nw-topbar', '.nw-dock', '.nw-interior-hud', '.nw-interior-caption', '.nw-walk-hud', '.nw-spots', '.nw-retail-tags']) {
    assert.ok(css.includes(`body.is-showcase ${sel}`), `감상 중 ${sel} 를 숨기지 않음`);
  }
});

test('(j) 진열 · 연결: 진열 그리기 2 + 제품 · 장애물 · 고르기, interior 층 진열 · 점유 격자, main 렌더 전환 · 제품 스팟 도착 · 복원', () => {
  const read = (f) => readFileSync(new URL(`../public/src/nowhere/${f}`, import.meta.url), 'utf8');
  const rd = read('retail-display.js');
  assert.match(rd, /mergeGeometries\(plinthGeos\)/);
  assert.match(rd, /mergeGeometries\(coverGeos\)/);
  assert.match(rd, /covers\.renderOrder = 1/);
  assert.match(rd, /return \{ group, obstacles: \[plinths, covers\] \}/);
  assert.match(rd, /raycaster\.far = PICK_RANGE/);
  assert.match(rd, /<= LABEL_RANGE/);
  assert.match(rd, /e\.stopImmediatePropagation\(\);\s*onOpen\(best\.product\.id\)/);
  const interior = read('interior.js');
  assert.match(interior, /retail\.build\(def\)/);
  assert.match(interior, /markObstacleMeshes\(occ, shelf \? \[\.\.\.solids, \.\.\.shelf\.obstacles\] : solids, groundAt\)/);
  assert.match(interior, /retail\?\.setFloor\(def\.id\)/);
  assert.match(interior, /retail\?\.setFloor\(null\)/);
  const main = read('main.js');
  assert.match(main, /createRetailDisplay\(/);
  assert.match(main, /createShowcase\(/);
  assert.match(main, /interiorSpots\(def, retail\.catalog\(\)\)/);
  assert.match(main, /spot\.kind === 'product' && interior\.isActive\(\)\) \{\s*openShowcase\(spot\.product\)/);
  assert.match(main, /if \(studio\) \{\s*showcase\.update\(dt\);\s*showcase\.render\(\);\s*\} else \{\s*world\.followSun\(camera\);\s*post\.composer\.render\(\);/);
  assert.match(main, /camCtrl\.controls\.enabled = false/);
  assert.match(main, /camCtrl\.placeWalk\(r\.pos\[0\], r\.pos\[2\], look\)/);
  const css = readFileSync(new URL('../public/src/nowhere/nowhere.css', import.meta.url), 'utf8');
  assert.match(css, /\.nw-retail-tag \{[^}]*min-height: 44px/);
});

test('(j2) openShowcase 가드는 spotCutting 을 보지 않는다(컷 이동 도착도 감상을 연다), arriveAt 제품 분기는 openShowcase 를 부른다', () => {
  const main = readFileSync(new URL('../public/src/nowhere/main.js', import.meta.url), 'utf8');
  const guard = main.match(/async function openShowcase\(productId\) \{[\s\S]*?\n    if \(([^\n]*)\) return;/);
  assert.ok(guard, 'openShowcase 가드를 찾지 못함');
  assert.doesNotMatch(guard[1], /spotCutting/);
  assert.match(guard[1], /showcase\.isActive\(\)/);
  assert.match(guard[1], /interior\.isBusy\(\)/);
  const arrive = main.match(/function arriveAt\(spot\) \{[\s\S]*?\n  \}\n/);
  assert.ok(arrive, 'arriveAt 를 찾지 못함');
  assert.match(arrive[0], /spot\.kind === 'product' && interior\.isActive\(\)\) \{\s*openShowcase\(spot\.product\)/);
});

test('(k) 감상 열기 실패 복구: showcase.open 은 던지거나 못 보이면 무대 상태를 되돌리고 화면을 다시 밝혀 false, main openShowcase 는 던져도 보행 · 실내 카메라를 되돌린다', () => {
  const read = (f) => readFileSync(new URL(`../public/src/nowhere/${f}`, import.meta.url), 'utf8');
  const open = read('showcase.js').match(/async function open\([^)]*\) \{[\s\S]*?\n  \}\n/);
  assert.ok(open, 'showcase open() 을 찾지 못함');
  const [body] = open;
  assert.match(body, /await fade\.fadeTo\(true, /, '어둡게 시작');
  assert.match(body, /if \(!\(await show\(id\)\)\) throw /, '못 보이면 실패 경로로');
  const fail = body.match(/\} catch \(err\) \{([\s\S]*?)\} finally \{\s*busy = false;/);
  assert.ok(fail, 'open() 에 catch · finally(busy 풀기)가 없음');
  for (const re of [/active = false/, /token\+\+/, /controls\.enabled = false/, /root\.hidden = true/, /document\.body\.classList\.remove\('is-showcase'\)/, /await fade\.fadeTo\(false, /, /return false/]) {
    assert.match(fail[1], re, `실패 경로에 ${re} 없음`);
  }
  const main = read('main.js').match(/async function openShowcase\(productId\) \{[\s\S]*?\n  \}\n/);
  assert.ok(main, 'openShowcase 를 찾지 못함');
  assert.match(main[0], /let opened = false;\s*try \{[\s\S]*camCtrl\.setWalkMode\(false\)[\s\S]*opened = await showcase\.open\(\{\s*\.\.\.productCollection\(catalog, floorId, productId\),\s*loadLite: \(item\) => retail\.liteSource\(item\.product\),?\s*\}\);\s*\} catch \(err\) \{[\s\S]*?\}\s*if \(!opened\) restoreFromShowcase\(\);/);
});

test('(l) 휴대폰 · 터치 감상 화면 < BACK · 조작 안내 44 px, 조작 안내 넷째 묶음(제품 감상)은 카메라 · 보행 아래 두 칸', () => {
  const css = readFileSync(new URL('../public/src/nowhere/nowhere.css', import.meta.url), 'utf8');
  assert.match(css, /@media \(max-width: 720px\), \(pointer: coarse\) \{\s*\.nw-showcase-back,\s*\.nw-showcase-help \{[^}]*min-height: 44px/);
  assert.match(css, /\.nw-help-section\[data-section='common'\] \{[^}]*grid-row: span 2/);
  assert.match(css, /\.nw-help-section\[data-section='showcase'\] \{[^}]*grid-column: span 2/);
  assert.match(readFileSync(new URL('../public/src/nowhere/help.js', import.meta.url), 'utf8'), /sec\.dataset\.section = s\.id/);
});

test('(k) 감상 무대 화면: 정보 패널이 옆에 있는 배치(721 px 이상)는 패널 왼쪽 빈 곳 가운데에 제품을 둔다 — 1180 × 820 태블릿에서 패널이 Kant 다리를 가리던 것', async () => {
  const { stageView, STAGE_PANEL } = await import('../public/src/nowhere/products.js');
  // 휴대폰 배치(패널이 아래): 그대로
  assert.deepEqual(stageView(390, 844), { freeWidth: 390, shift: 0 });
  assert.deepEqual(stageView(720, 900), { freeWidth: 720, shift: 0 });
  // 옆 패널: 빈 폭 = 화면 − (패널 폭 + 오른쪽 여백 + 간격), 투영 가운데를 그 절반만큼 왼쪽으로
  const side = STAGE_PANEL.width + STAGE_PANEL.right + STAGE_PANEL.gap;
  const t = stageView(1180, 820);
  assert.equal(t.freeWidth, 1180 - side);
  assert.equal(t.shift, side / 2);
  const d = stageView(1600, 900);
  assert.equal(d.freeWidth + 2 * d.shift, 1600);
  // 세로 태블릿(폭 1024 이하)은 패널이 아래 — 그대로. 더 넓은 세로 화면은 옆 배치
  assert.deepEqual(stageView(820, 1180), { freeWidth: 820, shift: 0 });
  assert.deepEqual(stageView(1024, 1366), { freeWidth: 1024, shift: 0 });
  assert.ok(stageView(1080, 1920).shift > 0);
  // 좁은 옆 배치에서도 빈 폭은 화면의 절반 아래로 줄지 않는다
  const p = stageView(760, 700);
  assert.ok(p.freeWidth >= 380 && p.shift === (760 - p.freeWidth) / 2);
  // 상수는 nowhere.css 의 패널과 같아야 한다(폭 · 오른쪽 여백 · 720 px 에서 아래로)
  const css = readFileSync(new URL('src/nowhere/nowhere.css', PUB), 'utf8');
  const panel = css.match(/\n\.nw-showcase-panel \{([^}]*)\}/)[1];
  assert.match(panel, new RegExp(`right: ${STAGE_PANEL.right}px`));
  assert.match(panel, new RegExp(`width: min\\(${STAGE_PANEL.width}px`));
  assert.match(css, new RegExp(`@media \\(max-width: ${STAGE_PANEL.minViewport - 1}px\\), \\(orientation: portrait\\) and \\(max-width: ${STAGE_PANEL.portraitMax}px\\) \\{\\s*\\.nw-showcase-top`));
  // showcase.js 는 빈 곳 비율로 거리를 맞추고 투영만 옮긴다
  const sc = readFileSync(new URL('src/nowhere/showcase.js', PUB), 'utf8');
  assert.match(sc, /stageView\(/);
  assert.match(sc, /setViewOffset\(/);
  assert.match(sc, /stageFraming\(radius, FOV, applyView\(\)\)/);
});

test('(l) 진열용(lite) 모델을 못 불러온 제품은 진열에서 뺀다 — 이동 스팟 · 감상 이전/다음 · 이름표에 남지 않고, 그 받침대를 눌러도 열지 않는다', async () => {
  const { withoutProducts } = await import('../public/src/nowhere/products.js');
  const cat = validateCatalog(JSON.parse(readFileSync(new URL('assets/products/products.json', PUB), 'utf8')));
  assert.equal(withoutProducts(cat, new Set()), cat, '뺄 것이 없으면 그대로(같은 객체)');
  const cut = withoutProducts(cat, new Set(['folding-tarx']));
  assert.deepEqual(floorDisplays(cut, '1').map((d) => d.product.id), ['kant', 'veggie-oat']);
  assert.deepEqual(productSpots(cut, '1').map((s) => s.label), ['Kant', 'Veggie Oat']);
  assert.equal(stepProduct(cut, '1', 'kant', 1), 'veggie-oat', '이전 · 다음이 빠진 제품을 건너뛴다');
  assert.equal(findProduct(cut, 'folding-tarx')?.id, 'folding-tarx', '제품 정보는 남긴다(진열만 뺀다)');
  assert.equal(cat.displays.length, 3, '원본 목록은 바꾸지 않는다');
  assert.equal(withoutProducts(null, new Set(['kant'])), null);
  const src = readFileSync(new URL('src/nowhere/retail-display.js', PUB), 'utf8');
  assert.match(src, /failed\.add\(product\.id\)/, 'lite 실패를 기억한다');
  assert.match(src, /catalog: \(\) => withoutProducts\(catalog, failed\)/, 'catalog() 는 실패한 제품을 뺀 목록');
  assert.match(src, /ds\.filter\(\(_, i\) => sources\[i\]\)\.map\(\(d\) => \{\s*const btn/, '이름표는 불러온 제품만');
  assert.match(src, /if \(failed\.has\(best\.product\.id\)\) return;/, '못 불러온 받침대 클릭은 열지 않는다');
});

test('(m) 감상 목록 이전 · 다음(stepItem): items 순서로 돌고(끝 → 처음), 없는 id 는 null — stepProduct 는 그 층 진열 목록으로 이것을 쓴다', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.equal(stepItem(items, 'a', 1), 'b');
  assert.equal(stepItem(items, 'c', 1), 'a');
  assert.equal(stepItem(items, 'a', -1), 'c');
  assert.equal(stepItem(items, 'b', -1), 'a');
  assert.equal(stepItem(items, 'ghost', 1), null);
  assert.equal(stepItem([], 'a', 1), null);
  assert.equal(stepItem([{ id: 'solo' }], 'solo', 1), 'solo');
  const src = readFileSync(new URL('src/nowhere/products.js', PUB), 'utf8');
  assert.match(src, /export function stepProduct\([^)]*\) \{\s*return stepItem\(/);
});

test('(n) 제품 감상 목록(productCollection): 그 층 진열 순서 · 항목 문구는 지금과 같다(kicker = 분류 대문자, 경로, 정보 행, 고해상도 = glb), 안내 한 줄 그대로', () => {
  const c = productCollection(catalog, '1', 'folding-tarx');
  assert.equal(c.kind, 'product');
  assert.equal(c.startId, 'folding-tarx');
  assert.equal(c.hint, '드래그 · 한 손가락 회전 · 휠 · 두 손가락 확대 · ← → 다른 제품 · Esc 나가기');
  assert.deepEqual(c.items.map((i) => i.id), floorDisplays(catalog, '1').map((d) => d.product.id));
  const kant = findProduct(catalog, 'kant');
  assert.deepEqual(c.items[0], {
    id: 'kant',
    name: 'Kant',
    kicker: 'EYEWEAR',
    crumbs: ['SUPREME ORIGIN', 'Retail', 'HAUS 성수 1F', 'Kant'],
    rows: infoRows(kant),
    note: '',
    hiUrl: 'assets/products/kant.glb',
    product: kant,
  });
  assert.equal('loadLite' in c, false, 'lite 는 main.js 가 진열의 것(retail.liteSource)으로 붙인다');
  // 이전 · 다음은 지금과 같은 순서
  for (const id of ['kant', 'folding-tarx', 'veggie-oat']) {
    for (const dir of [1, -1]) assert.equal(stepItem(c.items, id, dir), stepProduct(catalog, '1', id, dir), `${id} ${dir}`);
  }
  // 진열용 모델을 못 불러온 제품은 목록에도 없다 · 진열이 없는 층은 빈 목록
  assert.deepEqual(productCollection(withoutProducts(catalog, new Set(['folding-tarx'])), '1', 'kant').items.map((i) => i.id), ['kant', 'veggie-oat']);
  assert.deepEqual(productCollection(catalog, '12', 'kant').items, []);
});

test('(o) 감상 무대 공통화: open(collection) · 목록에서 찾기 · lite 는 loadLite 또는 무대 로더(주소별 캐시, 실패는 지운다) · 고해상도는 hiUrl 있고 휴대폰 아닐 때 · 정보는 항목 값 · kind 별 이름 · main 연결', () => {
  const sc = readFileSync(new URL('src/nowhere/showcase.js', PUB), 'utf8');
  assert.match(sc, /async function open\(collection\) \{/);
  assert.doesNotMatch(sc, /findProduct|floorDisplays|infoRows|breadcrumb|stepProduct|getLite/, '무대는 제품 목록 함수를 직접 쓰지 않는다');
  assert.match(sc, /stepItem\(list\.items, itemId, dir\)/);
  assert.match(sc, /list\.loadLite \? list\.loadLite\(item\)/);
  assert.match(sc, /\.catch\(\(err\) => \{\s*cache\.delete\(url\);/, '실패한 주소는 캐시에서 지운다(다시 시도)');
  assert.match(sc, /wantHi && item\.hiUrl/);
  assert.match(sc, /'nw-showcase-note'/);
  assert.match(sc, /note\.hidden = !item\.note/);
  assert.match(sc, /kicker\.textContent = item\.kicker/);
  assert.match(sc, /count\.textContent = `\$\{list\.items\.indexOf\(item\) \+ 1\} \/ \$\{list\.items\.length\}`/);
  assert.match(sc, /hint\.textContent = list\.hint/);
  assert.match(sc, /product: \{ label: '제품 감상'/);
  assert.match(sc, /building: \{ label: '건물 감상'/);
  assert.match(sc, /productId: list\?\.kind === 'product' \? itemId : null/);
  const css = readFileSync(new URL('src/nowhere/nowhere.css', PUB), 'utf8');
  assert.match(css, /\.nw-showcase-note\[hidden\]/);
  assert.match(css, /\n\.nw-showcase-note \{/);
  const main = readFileSync(new URL('src/nowhere/main.js', PUB), 'utf8');
  assert.doesNotMatch(main, /getLite:/);
  assert.match(main, /showcase: showcase\.isActive\(\) \? showcase\.getState\(\)\.itemId : null/);
});
