import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';

const PUB = new URL('../public/', import.meta.url);
const layoutUrl = new URL('assets/nowhere-inner/inner-layout.json', PUB);

test('(a) inner-layout.json 형식: 성수 건물, 기본 층 1F, 필수 필드', () => {
  assert.ok(existsSync(layoutUrl), 'inner-layout.json 없음 — npm run nowhere:inner:build 실행 필요');
  const L = JSON.parse(readFileSync(layoutUrl, 'utf8'));
  assert.equal(L.building, 'haus');
  assert.equal(L.defaultFloor, '1');
  const f1 = L.floors.find((f) => f.id === '1');
  assert.ok(f1, '1F 없음');
  for (const k of ['label', 'glb', 'mobileGlb', 'elevation', 'bounds', 'ceiling', 'entry', 'spawn', 'exit', 'elevator', 'exhibits', 'tour']) {
    assert.ok(k in f1, `1F 에 ${k} 없음`);
  }
  assert.equal(f1.label, '1F 로비');
  assert.equal(f1.bounds.length, 4);
});

test('(b) 시작 · 출구 · 엘리베이터 · 투어 지점이 층 영역 안에 있다', () => {
  const L = JSON.parse(readFileSync(layoutUrl, 'utf8'));
  for (const f of L.floors) {
    const [x0, z0, x1, z1] = f.bounds;
    const inside = (p) => p[0] >= x0 && p[0] <= x1 && p[2] >= z0 && p[2] <= z1 && p[1] >= 0 && p[1] <= f.ceiling;
    const pts = [f.spawn.pos, f.spawn.target, f.elevator.pos, ...f.tour.flatMap((t) => [t.pos, t.target]), ...f.exhibits.map((e) => e.pos)];
    if (f.entry) pts.push(f.entry.pos, f.entry.target);
    if (f.exit) pts.push(f.exit.pos);
    for (const p of pts) assert.ok(inside(p), `${f.id}: ${JSON.stringify(p)} 가 영역 밖`);
  }
});

test('(c) 파일 존재 · 예산(층 GLB 데스크톱 ≤ 6 MB · 모바일 ≤ 3 MB, HDRI ≤ 2 MB)', () => {
  const L = JSON.parse(readFileSync(layoutUrl, 'utf8'));
  const size = (rel) => statSync(new URL(rel, PUB)).size;
  assert.ok(size(L.env) <= 2 * 1024 * 1024, `env ${size(L.env)} B`);
  for (const f of L.floors) {
    assert.ok(size(f.glb) <= 6 * 1024 * 1024, `${f.glb} ${size(f.glb)} B`);
    assert.ok(size(f.mobileGlb) <= 3 * 1024 * 1024, `${f.mobileGlb} ${size(f.mobileGlb)} B`);
  }
});

test('(d) 실내 진입 추가 다운로드(스펙 §2.7): 데스크톱 1F GLB + HDRI ≤ 8 MB, 모바일 1F 모바일 GLB(HDRI 생략) ≤ 4 MB', () => {
  const L = JSON.parse(readFileSync(layoutUrl, 'utf8'));
  const size = (rel) => statSync(new URL(rel, PUB)).size;
  const f1 = L.floors.find((f) => f.id === L.defaultFloor);
  const desktop = size(f1.glb) + size(L.env);
  const mobile = size(f1.mobileGlb);
  assert.ok(desktop <= 8 * 1024 * 1024, `데스크톱 진입 ${desktop} B`);
  assert.ok(mobile <= 4 * 1024 * 1024, `모바일 진입 ${mobile} B`);
  // 모바일이 HDRI 를 받지 않는 정책이 코드에 남아 있는지
  const src = readFileSync(new URL('src/nowhere/interior.js', PUB), 'utf8');
  assert.match(src, /quality\.tier !== 'mobile'\) await loadEnv\(\)/);
});

test('(e) 층마다 엘리베이터 · 시작점 · 둘러보기(2곳 이상)가 있고, 시작점은 엘리베이터 반경 밖, 진입점은 출구 반경 밖', () => {
  const L = JSON.parse(readFileSync(layoutUrl, 'utf8'));
  for (const f of L.floors) {
    assert.ok(f.elevator && f.spawn, `${f.id}: elevator · spawn`);
    assert.ok(f.tour.length >= 2, `${f.id}: tour ${f.tour.length}곳`);
    const d = Math.hypot(f.spawn.pos[0] - f.elevator.pos[0], f.spawn.pos[2] - f.elevator.pos[2]);
    assert.ok(d > f.elevator.radius, `${f.id}: 시작점이 엘리베이터 반경 안(${d.toFixed(2)} ≤ ${f.elevator.radius})`);
    if (f.exit) {
      const s = (f.entry ?? f.spawn).pos;
      const e = Math.hypot(s[0] - f.exit.pos[0], s[2] - f.exit.pos[2]);
      assert.ok(e > f.exit.radius, `${f.id}: 진입점이 출구 반경 안`);
    }
  }
});

test('(f) B1F 카페: 지하(elevation −4.5) · 층고 4 m · 출구 없음', () => {
  const L = JSON.parse(readFileSync(layoutUrl, 'utf8'));
  const f = L.floors.find((x) => x.id === 'b1');
  assert.ok(f, 'B1F 없음');
  assert.equal(f.label, 'B1F 카페');
  assert.equal(f.elevation, -4.5);
  assert.equal(f.ceiling, 4);
  assert.equal(f.exit, undefined);
  assert.equal(f.glb, 'assets/nowhere-inner/inner-b1.glb');
});
