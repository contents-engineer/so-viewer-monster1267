import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOUR_BUILDINGS, approachFor } from '../public/src/nowhere/tour-config.js';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const layouts = ['nowhere', 'nowhere-ds2'].map((v) => [v, JSON.parse(readFileSync(new URL(`../public/assets/${v}/layout.json`, import.meta.url), 'utf8'))]);

test('(a) 두 건물의 이름 · 입장 가능 여부(성수만 입장)', () => {
  assert.equal(TOUR_BUILDINGS.haus.label, '하우스노웨어 성수');
  assert.equal(TOUR_BUILDINGS.facearch.label, '하우스노웨어 몽골');
  assert.equal(TOUR_BUILDINGS.haus.enterable, true);
  assert.equal(TOUR_BUILDINGS.facearch.enterable, false);
  for (const b of Object.values(TOUR_BUILDINGS)) assert.ok(b.summary.length > 0);
});

test('(b) 두 월드 × 두 건물 모두 접근 시점이 나온다', () => {
  for (const [ver, L] of layouts) {
    for (const id of ['haus', 'facearch']) {
      const a = approachFor(L, id);
      assert.ok(a, `${ver}/${id}`);
      assert.equal(a.pos.length, 3);
      assert.equal(a.target.length, 3);
    }
  }
});

test('(c) rotY 0 인 HAUS 는 로컬 오프셋 그대로, FaceArch 는 건물 위치 + 회전이 반영된다', () => {
  const L = layouts[0][1];
  const h = approachFor(L, 'haus');
  assert.deepEqual(h.pos, TOUR_BUILDINGS.haus.approach.pos);
  const f = approachFor(L, 'facearch');
  const off = TOUR_BUILDINGS.facearch.approach.pos;
  const c = L.buildings.facearch.pos;
  // 수평 거리는 회전해도 보존된다
  assert.ok(near(Math.hypot(f.pos[0] - c[0], f.pos[2] - c[2]), Math.hypot(off[0], off[2])));
  assert.ok(near(f.pos[1], c[1] + off[1]));
});

test('(d) 모르는 건물 · 레이아웃 누락은 null', () => {
  assert.equal(approachFor(layouts[0][1], 'nope'), null);
  assert.equal(approachFor({}, 'haus'), null);
});
