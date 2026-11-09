import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readGlbJson, meshNodeBoxes, triangleCount } from './lib/glb.mjs';

const PUB = new URL('../public/', import.meta.url);
const L = JSON.parse(readFileSync(new URL('assets/nowhere-inner/inner-layout.json', PUB), 'utf8'));
const TIERS = [
  ['glb', 'desktop', 600000],
  ['mobileGlb', 'mobile', 300000],
];
const load = (rel) => readGlbJson(new URL(rel, PUB));
const isSolid = (name) => !/^IN_(floor|ceiling)/.test(name);
const inside = (p, b, e = 0.01) =>
  p[0] > b.min[0] + e && p[0] < b.max[0] - e && p[1] > b.min[1] + e && p[1] < b.max[1] - e && p[2] > b.min[2] + e && p[2] < b.max[2] - e;

test('(a) 노드 이름 규칙: 메시 노드는 모두 IN_ · EX_, 바닥 IN_floor · 천장 IN_ceiling 이 있다', () => {
  for (const f of L.floors) {
    for (const [key] of TIERS) {
      const names = meshNodeBoxes(load(f[key])).map((b) => b.name);
      for (const n of names) assert.match(n, /^(IN|EX)_/, `${f[key]}: 규칙 밖 이름 '${n}'`);
      assert.ok(names.some((n) => /^IN_floor/.test(n)), `${f[key]}: IN_floor 없음`);
      assert.ok(names.some((n) => /^IN_ceiling/.test(n)), `${f[key]}: IN_ceiling 없음`);
    }
  }
});

test('(b) 상자 계산 확인: 1F 기둥 IN_column_0 은 Three (−11, 0…6, 6) 의 0.8 m 기둥이고, 그 안의 점을 안으로 판정한다', () => {
  const f1 = L.floors.find((f) => f.id === '1');
  const col = meshNodeBoxes(load(f1.glb)).find((b) => b.name === 'IN_column_0');
  assert.ok(col, 'IN_column_0 없음');
  const c = [0, 1, 2].map((a) => (col.min[a] + col.max[a]) / 2);
  const near = (x, y, e = 0.05) => Math.abs(x - y) < e;
  assert.ok(near(c[0], -11) && near(c[1], 3) && near(c[2], 6), `중심 ${c}`);
  assert.ok(near(col.max[0] - col.min[0], 0.8), `폭 ${col.max[0] - col.min[0]}`);
  assert.equal(inside([-11, 1.0, 6], col), true);
  assert.equal(inside([-12, 1.0, 6], col), false);
});

test('(c) 시작 · 진입 · 엘리베이터 · 둘러보기 지점이 벽 · 기둥 · 전시물 상자 안에 있지 않다', () => {
  for (const f of L.floors) {
    const solids = meshNodeBoxes(load(f.glb)).filter((b) => isSolid(b.name));
    const body = (p) => [[p[0], 0.3, p[2]], [p[0], 1.2, p[2]]];   // 서 있는 몸(발목 · 허리 높이)
    const pts = [
      ...body(f.spawn.pos).map((p) => ['spawn', p]),
      ...body(f.elevator.pos).map((p) => ['elevator', p]),
      ...(f.entry ? body(f.entry.pos).map((p) => ['entry', p]) : []),
      ...f.tour.map((t, i) => [`tour[${i}]`, t.pos]),
    ];
    for (const [label, p] of pts) {
      const hit = solids.find((b) => inside(p, b));
      assert.ok(!hit, `${f.id} ${label} ${JSON.stringify(p)} 가 ${hit?.name} 안`);
    }
  }
});

test('(d) 층 삼각형 예산: 데스크톱 ≤ 60만 · 모바일 ≤ 30만(스펙 §2.7)', () => {
  for (const f of L.floors) {
    for (const [key, tier, max] of TIERS) {
      const t = triangleCount(load(f[key]));
      assert.ok(t <= max, `${f.id} ${tier} ${t} > ${max}`);
    }
  }
});
