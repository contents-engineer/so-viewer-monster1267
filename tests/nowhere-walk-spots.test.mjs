import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildingToWorld, approachFor, TOUR_BUILDINGS } from '../public/src/nowhere/tour-config.js';
import {
  EXTERIOR_SPOTS, exteriorSpots, interiorSpots, spotLabel, spotStage, isSpotOccluded,
  SPOT_HERE, SPOT_NEAR, SPOT_FAR, SPOT_LIFT,
} from '../public/src/nowhere/walk-spots.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const layouts = ['nowhere', 'nowhere-ds2'].map((v) => [v, read(`../public/assets/${v}/layout.json`)]);
const inner = read('../public/assets/nowhere-inner/inner-layout.json');
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

test('(a) buildingToWorld: rotY 0 이면 오프셋 그대로, 회전해도 수평 거리 보존 · approachFor 는 같은 변환', () => {
  const L = layouts[0][1];
  assert.deepEqual(buildingToWorld(L, 'haus', [3, 1, 46]), [3, 1, 46]);
  const c = L.buildings.facearch.pos;
  const p = buildingToWorld(L, 'facearch', [-26, 0, 3]);
  assert.ok(near(Math.hypot(p[0] - c[0], p[2] - c[2]), Math.hypot(26, 3)));
  assert.equal(buildingToWorld(L, 'nope', [1, 1, 1]), null);
  assert.equal(buildingToWorld(null, 'haus', [1, 1, 1]), null);
  const a = approachFor(L, 'facearch');
  assert.deepEqual(a.pos, buildingToWorld(L, 'facearch', TOUR_BUILDINGS.facearch.approach.pos));
  assert.deepEqual(a.target, buildingToWorld(L, 'facearch', TOUR_BUILDINGS.facearch.approach.target));
});

test('(b) 외관 스팟: 두 월드 모두 9개 · id 중복 없음 · 대표 스팟 2개(성수 정문 entrance · 몽골 정면)', () => {
  for (const [ver, L] of layouts) {
    const list = exteriorSpots(L);
    assert.equal(list.length, EXTERIOR_SPOTS.haus.length + EXTERIOR_SPOTS.facearch.length, ver);
    assert.equal(list.length, 9, ver);
    assert.equal(new Set(list.map((s) => s.id)).size, list.length);
    assert.deepEqual(list.filter((s) => s.beacon).map((s) => s.id).sort(), ['face_front', 'haus_entrance']);
    const ent = list.find((s) => s.id === 'haus_entrance');
    assert.equal(ent.kind, 'entrance');
    assert.equal(ent.building, 'haus');
    for (const s of list) {
      assert.ok(Number.isFinite(s.x) && Number.isFinite(s.z), s.id);
      assert.equal(s.look.length, 3, s.id);
      assert.ok(s.label.length > 0, s.id);
      assert.equal(s.caption, null);
      assert.ok(s.building === 'haus' || s.building === 'facearch');
    }
  }
});

test('(c) 외관 스팟은 건물 외곽 상자(layout.solids) 밖에 선다 — 필로티 아래(face_piloti)만 예외', () => {
  const L = layouts[0][1];
  const box = { haus: L.solids.find((s) => s.id === 'HAUS'), facearch: L.solids.find((s) => s.id === 'FACEARCH') };
  for (const s of exteriorSpots(L)) {
    if (s.id === 'face_piloti') continue;
    const b = box[s.building];
    const inside = s.x > b.min[0] && s.x < b.max[0] && s.z > b.min[2] && s.z < b.max[2];
    assert.equal(inside, false, `${s.id} (${s.x.toFixed(1)}, ${s.z.toFixed(1)}) 가 ${s.building} 상자 안`);
  }
});

test('(d) 실내 스팟: 층마다 둘러보기 지점 + 엘리베이터, 1F 만 출구 · 이름은 자막의 " — " 앞', () => {
  for (const f of inner.floors) {
    const list = interiorSpots(f);
    const views = list.filter((s) => s.kind === 'view');
    assert.equal(views.length, f.tour.length, f.id);
    assert.equal(list.filter((s) => s.kind === 'elevator').length, 1, f.id);
    assert.equal(list.filter((s) => s.kind === 'exit').length, f.exit ? 1 : 0, f.id);
    assert.equal(new Set(list.map((s) => s.id)).size, list.length);
    views.forEach((s, i) => {
      assert.equal(s.x, f.tour[i].pos[0]);
      assert.equal(s.z, f.tour[i].pos[2]);
      assert.deepEqual(s.look, f.tour[i].target);
      assert.equal(s.caption, f.tour[i].caption);
      assert.equal(s.beacon, false);
      assert.equal(s.building, null);
    });
    for (const s of list.filter((x) => x.kind !== 'view')) assert.equal(s.look, null);
    const [x0, z0, x1, z1] = f.bounds;
    for (const s of list) assert.ok(s.x > x0 && s.x < x1 && s.z > z0 && s.z < z1, `${f.id}/${s.id} 층 영역 밖`);
  }
  const lobby = interiorSpots(inner.floors.find((f) => f.id === '1'));
  assert.equal(lobby.find((s) => s.kind === 'view').label, '성수 도시 모형');
  assert.equal(spotLabel('디스플레이 월'), '디스플레이 월');
  assert.deepEqual(interiorSpots(null), []);
});

test('(e) spotStage 경계값: 서 있는 자리 숨김 · 12 m 안 near · 40 m 안 far · 대표 스팟은 거리 무관 · 겨눔은 표시 중일 때만 near', () => {
  assert.equal(SPOT_HERE, 1.5);
  assert.equal(SPOT_NEAR, 12);
  assert.equal(SPOT_FAR, 40);
  assert.equal(SPOT_LIFT, 1.0);
  assert.equal(spotStage(1.49), 'hidden');
  assert.equal(spotStage(1.5), 'near');
  assert.equal(spotStage(12), 'near');
  assert.equal(spotStage(12.01), 'far');
  assert.equal(spotStage(40), 'far');
  assert.equal(spotStage(40.01), 'hidden');
  assert.equal(spotStage(30, { aimed: true }), 'near');
  assert.equal(spotStage(50, { aimed: true }), 'hidden');
  assert.equal(spotStage(1.0, { beacon: true }), 'hidden');
  assert.equal(spotStage(8, { beacon: true }), 'near');
  assert.equal(spotStage(20, { beacon: true }), 'beacon');
  assert.equal(spotStage(120, { beacon: true }), 'beacon');
  assert.equal(spotStage(120, { beacon: true, aimed: true }), 'near');
});

test('(f) 가림: 눈 → 마커 선분보다 높은 장애물 · 지형이 사이에 있으면 가려짐, 낮은 턱 · 마커 바로 옆 장애물은 아님', () => {
  const flat = () => 0;
  const none = () => 0;
  const eye = { x: 0, y: 1.7, z: 0 };
  const target = { x: 20, y: 1.0, z: 0 };
  assert.equal(isSpotOccluded(eye, target, flat, none), false);
  const band = (top) => (x) => (x > 9.5 && x < 10.5 ? top : 0);
  assert.equal(isSpotOccluded(eye, target, flat, band(1.9)), true, '벽');
  assert.equal(isSpotOccluded(eye, target, flat, band(0.6)), false, '낮은 턱');
  assert.equal(isSpotOccluded(eye, target, band(3), none), true, '언덕');
  const besideMarker = (x) => (x > 19.6 ? 1.9 : 0);   // 마커 0.4 m 안 — 스팟 옆 전시물은 가림으로 치지 않는다
  assert.equal(isSpotOccluded(eye, target, flat, besideMarker), false);
  assert.equal(isSpotOccluded(eye, { x: 0.5, y: 1.0, z: 0 }, flat, () => 5), false, '아주 가까운 스팟은 검사하지 않는다');
});
