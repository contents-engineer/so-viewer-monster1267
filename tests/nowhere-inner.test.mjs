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
