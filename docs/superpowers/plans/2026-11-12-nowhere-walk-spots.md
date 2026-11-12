# 보행 이동 스팟 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 보행 시점에서 실내 4개 층과 외관 두 건물 주변에 디트로이트식 이동 스팟을 표시하고, 클릭 · 탭하면 보행 충돌 격자로 길을 찾아 그 자리까지 걸어가게 한다.

**Architecture:** 순수 모듈 두 개(`walk-spots.js` 스팟 정의 · 단계 · 가림, `walk-path.js` A* · 경로 다듬기 · 따라 걷기)를 테스트로 먼저 만들고, `camera.js` 보행 갱신에 자동 걷기 분기를 넣는다. 마커는 DOM 오버레이(`spot-markers.js`, 그리기 0)이고 `main.js` 가 고르기 → 길 찾기 → 걷기/컷 → 도착 동작을 잇는다. 실내는 `interior.js` 가 층이 바뀔 때 알리고, 암전 레이어는 공용 `fade.js` 로 옮긴다.

**Tech Stack:** three.js r170(ES 모듈, 빌드 없음), `node --test`, playwriter MCP(브라우저 확인), `npx serve`(정적 서버 :4173).

**Spec:** `docs/superpowers/specs/2026-11-12-nowhere-walk-spots-design.md`

## Global Constraints

- 렌더 비용 0: 그리기 호출 · 삼각형을 늘리지 않는다(마커는 DOM). 모바일 조감 최악 178/180 그리기 · 898,927/900,000 삼각형 그대로.
- FPS ≥ 60 기준 유지(데스크톱 · `&tier=mobile`, 보행 + 마커 표시 상태).
- Blender 빌드 · GLB · `layout.json` · `inner-layout.json` 은 바꾸지 않는다.
- 두 월드(성수 2041 `ver=seongsu`, DS2 `ver=ds2`) 모두 외관 스팟을 쓴다.
- 값(그대로 쓴다): `SPOT_HERE` 1.5 m · `SPOT_NEAR` 12 m · `SPOT_FAR` 40 m · `SPOT_LIFT` 1.0 m · 길 찾기 칸 0.5 m · 탐색 여유 24 m · 노드 상한 150,000 · 시작 보정 1 m · 목표 보정 2 m · 직선 검사 0.25 m · 도달 반경 0.3 m · 달리기 경로 > 30 m · 막힘 1 s / 0.2 m · 볼거리로 돌기 시작 2 m · 시선 회전 180°/s · 도착 후 정면 0.6 s · 컷 0.3 s + 0.3 s · 도착 자막 4 s · 가림 검사 0.2 s · 터치 대상 ≥ 44 px · near 아이콘 28 px · far 마름모 10 px 불투명도 0.6.
- UI 문구 · 주석은 한국어(기존 파일 문체 — '·' 구분, 존댓말 없는 설명체).
- 테스트: `npm test` 전부 통과.
- 브라우저 확인은 playwriter MCP 만 쓴다. 대화상자를 띄울 수 있는 동작 전에 `window.confirm/alert/prompt` 를 기록용 함수로 바꿔 둔다. `evaluate` 는 3초 안에 돌아오는지 확인하며 짧게 나눠 기다린다.
- 커밋하지 않는다(사용자가 요청할 때만). 각 태스크 끝에서 관련 파일만 경로로 `git add` 하고 커밋 메시지 안을 보고서에 적는다. `git add -A` · `git add .` 금지.
- 작업 브랜치: `feat/walk-spots`(main 에서 분기).

## File Structure

| 파일 | 책임 |
|---|---|
| `public/src/nowhere/tour-config.js` (수정) | `buildingToWorld()` 공용 변환을 내보내고 `approachFor` 가 쓴다 |
| `public/src/nowhere/walk-spots.js` (새) | 외관 스팟 정의 · 월드 변환, 실내 층 스팟 생성, 표시 단계, 가림 판정 |
| `public/src/nowhere/walk.js` (수정) | `MAX_CLIMB` 를 내보낸다(camera · 길 찾기 공용) |
| `public/src/nowhere/walk-path.js` (새) | 보행 판정, 빈 자리 보정, A*, 경로 다듬기, 계획, 따라 걷기, 각도 도우미 |
| `public/src/nowhere/camera.js` (수정) | 자동 걷기(`walkTo` · `cancelWalkTo` · `isAutoWalking` · `placeWalk` · `getWalkContext`) |
| `public/src/nowhere/fade.js` (새) | 공용 암전 레이어 |
| `public/src/nowhere/interior.js` (수정) | 공용 암전 사용, 층 변경 알림, 도착 자막, `isBusy` |
| `public/src/nowhere/spot-markers.js` (새) | DOM 마커: 보정 · 투영 · 단계 · 가림 · 클릭/탭 · 조준 클릭 |
| `public/src/nowhere/main.js` (수정) | 마커 · 암전 생성, 고르기 → 길 찾기 → 걷기/컷 → 도착 동작 |
| `public/src/nowhere/help.js` (수정) | 조작 안내 행 · 보행 안내 문구 |
| `public/src/nowhere/nowhere.css` (수정) | 마커 스타일 |
| `README.md` (수정) | 조작 표에 스팟 행 |
| `tests/nowhere-walk-spots.test.mjs` · `tests/nowhere-walk-path.test.mjs` · `tests/nowhere-fade.test.mjs` (새), `tests/nowhere-help.test.mjs` (수정) | 테스트 |

---

### Task 1: 스팟 데이터 · 표시 단계 · 가림 판정

**Files:**
- Modify: `public/src/nowhere/tour-config.js:19-30` (`approachFor`)
- Create: `public/src/nowhere/walk-spots.js`
- Test: `tests/nowhere-walk-spots.test.mjs` (새), 기존 `tests/nowhere-tour-config.test.mjs` 는 그대로 통과해야 한다

**Interfaces:**
- Consumes: `layout.buildings[id] = { pos: [x, y, z], rotY: 도 }`, `inner-layout.json` 층 `{ id, bounds, tour: [{ pos, target, caption }], elevator?: { pos, radius }, exit?: { pos, radius } }`
- Produces:
  - `buildingToWorld(layout, id, [x, y, z]) → [x, y, z] | null` (tour-config.js)
  - 스팟 객체 `{ id, label, x, z, look: [x, y, z] | null, kind: 'view'|'entrance'|'elevator'|'exit', beacon: boolean, caption: string|null, building: 'haus'|'facearch'|null }`
  - `exteriorSpots(layout) → 스팟[]`, `interiorSpots(floorDef) → 스팟[]`, `spotLabel(caption) → string`
  - `spotStage(dist, { beacon, aimed }) → 'hidden'|'far'|'near'|'beacon'`
  - `isSpotOccluded(eye {x,y,z}, target {x,y,z}, groundHeightAt(x,z), topAt(x,z)) → boolean`
  - 상수 `SPOT_HERE` · `SPOT_NEAR` · `SPOT_FAR` · `SPOT_LIFT`, 데이터 `EXTERIOR_SPOTS`

- [ ] **Step 1: 브랜치 만들기**

```bash
git checkout -b feat/walk-spots
```

- [ ] **Step 2: 실패하는 테스트 작성** — `tests/nowhere-walk-spots.test.mjs`

```js
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
```

- [ ] **Step 3: 실패 확인**

Run: `node --test tests/nowhere-walk-spots.test.mjs`
Expected: FAIL — `buildingToWorld` 가 export 되지 않았고 `walk-spots.js` 가 없다(`ERR_MODULE_NOT_FOUND` 또는 `does not provide an export named 'buildingToWorld'`).

- [ ] **Step 4: `tour-config.js` 의 `approachFor` 를 공용 변환으로 바꾸기** — 파일 끝의 `approachFor` 함수 전체를 아래로 교체한다(`TOUR_BUILDINGS` 는 그대로)

```js
/** 건물 기준 로컬 좌표(Three 축, rotY 회전 전) → 월드 좌표. layout.buildings[id] 의 위치 · rotY(도)를 반영. 건물이 없으면 null. */
export function buildingToWorld(layout, id, [x, y, z]) {
  const cfg = layout?.buildings?.[id];
  if (!cfg || !Array.isArray(cfg.pos)) return null;
  const th = ((cfg.rotY || 0) * Math.PI) / 180;
  const c = Math.cos(th);
  const s = Math.sin(th);
  // three 의 rotation.y 와 같은 회전: x' = x cosθ + z sinθ, z' = −x sinθ + z cosθ
  return [cfg.pos[0] + x * c + z * s, cfg.pos[1] + y, cfg.pos[2] - x * s + z * c];
}

/** layout.buildings[id] 의 위치 · rotY(도)를 반영한 월드 접근 시점. 건물 · 레이아웃이 없으면 null. */
export function approachFor(layout, id) {
  const b = TOUR_BUILDINGS[id];
  if (!b) return null;
  const pos = buildingToWorld(layout, id, b.approach.pos);
  const target = buildingToWorld(layout, id, b.approach.target);
  return pos && target ? { pos, target } : null;
}
```

- [ ] **Step 5: `public/src/nowhere/walk-spots.js` 작성**

```js
// HAUS NOWHERE — 보행 이동 스팟: 외관 두 건물 주변 스팟 정의 · 실내 층 스팟 생성 · 표시 단계 · 가림 판정(순수, three 없음).
// 테스트: tests/nowhere-walk-spots.test.mjs. 좌표는 Three.js(x, y 위, z).
// 스팟 = { id, label, x, z, look: [x, y, z] | null, kind: 'view'|'entrance'|'elevator'|'exit', beacon, caption, building }
import { buildingToWorld } from './tour-config.js';

export const SPOT_HERE = 1.5;   // m — 지금 서 있는 스팟은 숨긴다
export const SPOT_NEAR = 12;    // m — 이 안이면 아이콘 + 이름
export const SPOT_FAR = 40;     // m — 이 안이면 작은 마름모
export const SPOT_LIFT = 1.0;   // m — 마커를 스팟 지면 위 이 높이에 띄운다

// 건물 기준 로컬 좌표(Three 축, 건물 rotY 회전 전 — tour-config approach 와 같은 규칙). at = 설 자리 (x, z), look = 볼거리 (x, y, z).
// HAUS 는 남측(+z) 전정 쪽이 정면, FaceArch 얼굴은 로컬 −x 쪽을 향한다. 위치는 브라우저에서 막힘 · 구도를 보고 조정한다(Task 6).
export const EXTERIOR_SPOTS = {
  haus: [
    { id: 'haus_entrance', label: '하우스노웨어 성수 정문', at: [0, 36], look: [0, 10, 0], kind: 'entrance', beacon: true },
    { id: 'haus_garden', label: '전정 화단', at: [-12, 33], look: [-12, 0.8, 26] },
    { id: 'haus_sw', label: '남서 모서리 — 타워 올려다보기', at: [-32, 34], look: [0, 40, 0] },
    { id: 'haus_se', label: '남동 모서리', at: [32, 34], look: [0, 30, 0] },
    { id: 'haus_east', label: '동측 면', at: [34, 0], look: [0, 25, 0] },
  ],
  facearch: [
    { id: 'face_front', label: '하우스노웨어 몽골 정면', at: [-26, 3], look: [0, 16, 0], beacon: true },
    { id: 'face_piloti', label: '필로티 아래', at: [2, 2], look: [2, 6, 2] },
    { id: 'face_left', label: '왼쪽 측면', at: [-8, 22], look: [0, 16, 0] },
    { id: 'face_right', label: '오른쪽 측면', at: [-8, -20], look: [0, 16, 0] },
  ],
};

/** 두 건물 주변 스팟(월드 좌표). layout 에 없는 건물의 스팟은 뺀다. */
export function exteriorSpots(layout) {
  const out = [];
  for (const [building, defs] of Object.entries(EXTERIOR_SPOTS)) {
    for (const d of defs) {
      const p = buildingToWorld(layout, building, [d.at[0], 0, d.at[1]]);
      const look = buildingToWorld(layout, building, d.look);
      if (!p || !look) continue;
      out.push({ id: d.id, label: d.label, x: p[0], z: p[2], look, kind: d.kind || 'view', beacon: Boolean(d.beacon), caption: null, building });
    }
  }
  return out;
}

/** 둘러보기 자막의 ' — ' 앞부분(없으면 전체)을 스팟 이름으로 */
export function spotLabel(caption) {
  return String(caption || '').split(' — ')[0].trim();
}

/** 실내 한 층의 스팟: 둘러보기 지점(볼거리) + 엘리베이터 + 1F 출구. 엘리베이터 · 출구는 영역 트리거가 질문하므로 look 없음. */
export function interiorSpots(floor) {
  if (!floor) return [];
  const out = (floor.tour || []).map((t, i) => ({
    id: `${floor.id}_tour${i}`,
    label: spotLabel(t.caption),
    x: t.pos[0],
    z: t.pos[2],
    look: [...t.target],
    kind: 'view',
    beacon: false,
    caption: t.caption || null,
    building: null,
  }));
  const area = (a, kind, label) => ({ id: `${floor.id}_${kind}`, label, x: a.pos[0], z: a.pos[2], look: null, kind, beacon: false, caption: null, building: null });
  if (floor.elevator) out.push(area(floor.elevator, 'elevator', '엘리베이터'));
  if (floor.exit) out.push(area(floor.exit, 'exit', '밖으로 나가기'));
  return out;
}

/**
 * 표시 단계. dist = 눈과 스팟의 수평 거리(m). beacon = 건물 대표 스팟(거리 무관 표시), aimed = 마우스 올림 · 조준점.
 * hidden(숨김) · far(작은 마름모) · near(아이콘 + 이름) · beacon(작은 마름모 + 이름 · 거리)
 */
export function spotStage(dist, { beacon = false, aimed = false } = {}) {
  if (dist < SPOT_HERE) return 'hidden';
  if (dist <= SPOT_NEAR) return 'near';
  if (aimed && (beacon || dist <= SPOT_FAR)) return 'near';
  if (beacon) return 'beacon';
  if (dist <= SPOT_FAR) return 'far';
  return 'hidden';
}

/**
 * 눈(eye) → 마커 점(target) 선분을 step 간격으로 표본화해, 그 자리 지면 + 장애물 윗면(topAt, 지면 위 m)이
 * 선분 높이보다 높으면 가려진 것. 마커 쪽 끝 endClear 안(스팟 바로 옆 전시물 · 벽)은 검사하지 않는다.
 */
export function isSpotOccluded(eye, target, groundHeightAt, topAt, { step = 0.5, endClear = 0.6 } = {}) {
  const dx = target.x - eye.x;
  const dz = target.z - eye.z;
  const len = Math.hypot(dx, dz);
  for (let d = step; d < len - endClear; d += step) {
    const t = d / len;
    const x = eye.x + dx * t;
    const z = eye.z + dz * t;
    const lineY = eye.y + (target.y - eye.y) * t;
    if (groundHeightAt(x, z) + topAt(x, z) > lineY) return true;
  }
  return false;
}
```

- [ ] **Step 6: 통과 확인**

Run: `node --test tests/nowhere-walk-spots.test.mjs tests/nowhere-tour-config.test.mjs`
Expected: PASS (walk-spots 6개, tour-config 기존 테스트 모두)

- [ ] **Step 7: 전체 테스트**

Run: `npm test`
Expected: 모든 테스트 PASS (실패 0)

- [ ] **Step 8: 스테이징(커밋하지 않음)**

```bash
git add public/src/nowhere/tour-config.js public/src/nowhere/walk-spots.js tests/nowhere-walk-spots.test.mjs
```

커밋 메시지 안(보고서에 적는다): `feat(nowhere): 보행 이동 스팟 데이터 · 표시 단계 · 가림 판정`

---

### Task 2: 길 찾기 · 경로 다듬기 · 따라 걷기

**Files:**
- Modify: `public/src/nowhere/walk.js` (상수 하나 추가)
- Modify: `public/src/nowhere/camera.js:10` (로컬 `MAX_CLIMB` 를 walk.js 것으로)
- Create: `public/src/nowhere/walk-path.js`
- Test: `tests/nowhere-walk-path.test.mjs` (새)

**Interfaces:**
- Consumes: `walk.js` 의 `STEP_UP`(0.35) · `WALK_SPEED`(5) · `RUN_SPEED`(10); 보행 장애물 `blocker = { isBlocked(x, z, clearance, radius=0.35) → boolean, topAt(x, z, radius) → m }`
- Produces (Task 3 · 5 가 쓴다):
  - `MAX_CLIMB = 1.2` (walk.js)
  - 점 = `{ x, z }`
  - `walkPredicates({ groundHeightAt, blocker }) → { isFree(x, z), canStep(ax, az, bx, bz) }`
  - `nearestFreePoint(x, z, isFree, radius, cell = 0.5) → { x, z } | null`
  - `findPath(start, goal, { isFree, canStep?, cell?, margin?, maxNodes? }) → 점[] | null` (첫 점 = start, 끝 점 = goal 또는 보정된 목표)
  - `makeSegmentFree(isFree, canStep?, step = 0.25) → (a, b) => boolean`
  - `smoothPath(points, segmentFree) → 점[]`
  - `planWalkPath(ctx, from {x, z}, to {x, z}) → 점[] | null`
  - `pathLength(points) → m`
  - `createPathFollower(points) → { speed, step(pos {x, z}, dt) → { done, stuck, dx, dz, remaining } }`
  - `wrapAngle(a) → (−π, π]`, `turnToward(yaw, target, maxDelta) → yaw`
  - 상수 `PATH_CELL` · `PATH_MARGIN` · `PATH_MAX_NODES` · `START_SNAP` · `GOAL_SNAP` · `SEGMENT_STEP` · `ARRIVE_RADIUS` · `RUN_PATH_LENGTH` · `STUCK_TIME` · `STUCK_DIST` · `FACE_DIST` · `TURN_RATE`

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/nowhere-walk-path.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nearestFreePoint, findPath, smoothPath, makeSegmentFree, walkPredicates, planWalkPath,
  pathLength, createPathFollower, turnToward, wrapAngle,
  GOAL_SNAP, ARRIVE_RADIUS, RUN_PATH_LENGTH, STUCK_TIME,
} from '../public/src/nowhere/walk-path.js';
import { WALK_SPEED, RUN_SPEED, STEP_UP, MAX_CLIMB } from '../public/src/nowhere/walk.js';

const open = () => true;
const allFree = (pts, isFree) => pts.every((p) => isFree(p.x, p.z));
const segsFree = (pts, isFree) => {
  const sf = makeSegmentFree(isFree);
  for (let i = 1; i < pts.length; i++) if (!sf(pts[i - 1], pts[i])) return false;
  return true;
};

test('(a) 빈 땅: 시작 → 목표 경로, 첫 점 = 시작 · 끝 점 = 목표 · 길이는 직선에 가깝고 다듬으면 두 점', () => {
  const p = findPath({ x: 0.2, z: 0.1 }, { x: 10.3, z: 3.1 }, { isFree: open });
  assert.ok(p);
  assert.deepEqual(p[0], { x: 0.2, z: 0.1 });
  assert.deepEqual(p.at(-1), { x: 10.3, z: 3.1 });
  assert.ok(pathLength(p) < Math.hypot(10.1, 3.0) * 1.1, `len ${pathLength(p)}`);
  assert.equal(smoothPath(p, makeSegmentFree(open)).length, 2);
});

test('(b) 벽이 가로막으면 돌아간다 — 모든 점 · 구간이 비어 있고, 다듬으면 점이 줄되 여전히 비어 있다', () => {
  const isFree = (x, z) => !(x > 4 && x < 6 && z > -8 && z < 8);
  const p = findPath({ x: 0, z: 0 }, { x: 10, z: 0 }, { isFree });
  assert.ok(p);
  assert.ok(allFree(p, isFree));
  assert.ok(segsFree(p, isFree));
  assert.ok(pathLength(p) > 16, `len ${pathLength(p)}`);
  const s = smoothPath(p, makeSegmentFree(isFree));
  assert.ok(s.length < p.length && s.length >= 3, `smoothed ${s.length}`);
  assert.ok(segsFree(s, isFree));
  assert.ok(pathLength(s) <= pathLength(p) + 1e-9);
});

test('(c) 닫힌 울타리 안 목표 · 노드 상한 초과는 null', () => {
  const ring = (x, z) => {
    const r = Math.max(Math.abs(x - 10), Math.abs(z));
    return !(r >= 1.5 && r <= 2.5);
  };
  assert.equal(findPath({ x: 0, z: 0 }, { x: 10, z: 0 }, { isFree: ring }), null);
  assert.equal(findPath({ x: 0, z: 0 }, { x: 60, z: 0 }, { isFree: open, maxNodes: 50 }), null);
});

test('(d) 막힌 목표는 2 m 안 가장 가까운 빈 자리로, 2 m 안에 없으면 null', () => {
  const pillar = (r) => (x, z) => Math.hypot(x - 10, z) > r;
  const p = findPath({ x: 0, z: 0 }, { x: 10, z: 0 }, { isFree: pillar(0.8) });
  assert.ok(p);
  const end = p.at(-1);
  const d = Math.hypot(end.x - 10, end.z);
  assert.ok(d > 0.8 && d <= GOAL_SNAP, `end ${d}`);
  assert.equal(findPath({ x: 0, z: 0 }, { x: 10, z: 0 }, { isFree: pillar(2.6) }), null);
  const q = nearestFreePoint(10, 0, pillar(0.8), GOAL_SNAP);
  assert.ok(Math.abs(Math.hypot(q.x - 10, q.z) - 1.0) < 1e-9, `snap ${JSON.stringify(q)}`);
  assert.deepEqual(nearestFreePoint(3, 4, open, GOAL_SNAP), { x: 3, z: 4 });
  assert.equal(nearestFreePoint(10, 0, pillar(2.6), GOAL_SNAP), null);
});

test('(e) 대각선은 이웃한 두 직교 칸이 모두 비어 있을 때만(모서리 끼임 없음)', () => {
  const blocked = [[0.5, 0], [0, 0.5]];
  const isFree = (x, z) => !blocked.some(([bx, bz]) => Math.abs(x - bx) < 0.01 && Math.abs(z - bz) < 0.01);
  const p = findPath({ x: 0, z: 0 }, { x: 0.5, z: 0.5 }, { isFree });
  assert.ok(p);
  assert.ok(p.length > 2, '바로 대각선으로 건너뛰지 않는다');
});

test('(f) 50° 넘는 오르막은 오르지 않는다(보행과 같은 MAX_CLIMB) · 완만한 비탈은 오른다', () => {
  assert.equal(MAX_CLIMB, 1.2);
  const cliff = walkPredicates({ groundHeightAt: (x) => (x > 5 ? 10 : 0), blocker: null });
  assert.equal(cliff.canStep(4.5, 0, 5.5, 0), false);
  assert.equal(cliff.canStep(5.5, 0, 4.5, 0), true, '내려가기는 된다');
  assert.equal(findPath({ x: 0, z: 0 }, { x: 8, z: 0 }, { ...cliff, margin: 4 }), null);
  const ramp = walkPredicates({ groundHeightAt: (x) => Math.max(0, x * 0.5), blocker: null });
  assert.ok(findPath({ x: 0, z: 0 }, { x: 8, z: 0 }, ramp));
});

test('(g) walkPredicates: 장애물 판정은 보행과 같은 턱(STEP_UP) 기준', () => {
  const calls = [];
  const blocker = { isBlocked: (x, z, clr) => (calls.push(clr), x > 1), topAt: () => 0 };
  const { isFree } = walkPredicates({ groundHeightAt: () => 0, blocker });
  assert.equal(isFree(0, 0), true);
  assert.equal(isFree(2, 0), false);
  assert.deepEqual([...new Set(calls)], [STEP_UP]);
});

test('(h) planWalkPath: 보행 판정으로 찾고 다듬은 경로(벽 우회), 길이 없으면 null', () => {
  const blocker = { isBlocked: (x, z) => x > 4 && x < 6 && z > -8 && z < 8, topAt: () => 0 };
  const p = planWalkPath({ groundHeightAt: () => 0, blocker }, { x: 0, y: 1.7, z: 0 }, { x: 10, z: 0 });
  assert.ok(p && p.length >= 3);
  assert.deepEqual(p[0], { x: 0, z: 0 });
  assert.deepEqual(p.at(-1), { x: 10, z: 0 });
  const wallAll = { isBlocked: (x) => x > 4 && x < 6, topAt: () => 0 };
  assert.equal(planWalkPath({ groundHeightAt: () => 0, blocker: wallAll }, { x: 0, z: 0 }, { x: 10, z: 0 }), null);
});

test('(i) 따라 걷기: 걷기 속도로 경유점을 지나 도착 · 긴 경로는 달리기 · 남은 거리', () => {
  const pts = [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 3 }];
  const f = createPathFollower(pts);
  assert.equal(f.speed, WALK_SPEED);
  const pos = { x: 0, z: 0 };
  let r = f.step(pos, 0);
  assert.ok(Math.abs(r.remaining - 7) < 1e-9, `remaining ${r.remaining}`);
  let t = 0;
  for (; t < 5; t += 0.02) {
    r = f.step(pos, 0.02);
    if (r.done) break;
    assert.equal(r.stuck, false);
    assert.ok(Math.hypot(r.dx, r.dz) <= WALK_SPEED * 0.02 + 1e-9);
    pos.x += r.dx;
    pos.z += r.dz;
  }
  assert.equal(r.done, true);
  assert.ok(Math.hypot(pos.x - 4, pos.z - 3) <= ARRIVE_RADIUS);
  assert.ok(t > 6 / WALK_SPEED && t < 7 / WALK_SPEED + 0.1, `t=${t}`);
  assert.equal(createPathFollower([{ x: 0, z: 0 }, { x: RUN_PATH_LENGTH + 1, z: 0 }]).speed, RUN_SPEED);
});

test('(j) 막힘: STUCK_TIME 동안 0.2 m 도 못 나아가면 stuck', () => {
  const f = createPathFollower([{ x: 0, z: 0 }, { x: 10, z: 0 }]);
  const pos = { x: 0, z: 0 };
  let r;
  let t = 0;
  for (; t < STUCK_TIME + 0.5; t += 0.05) {
    r = f.step(pos, 0.05);
    if (r.stuck) break;
    pos.x += r.dx * 0.01;   // 거의 못 나아감(벽에 막힘)
  }
  assert.equal(r.stuck, true);
  assert.ok(t >= STUCK_TIME - 0.06 && t <= STUCK_TIME + 0.06, `t=${t}`);
});

test('(k) turnToward: 짧은 쪽으로 최대 maxDelta 만큼 · wrapAngle 은 (−π, π]', () => {
  assert.ok(Math.abs(turnToward(0, 1, 0.3) - 0.3) < 1e-12);
  assert.ok(Math.abs(turnToward(0, 0.1, 0.3) - 0.1) < 1e-12);
  const r = turnToward(3.0, -3.0, 0.1);   // π 를 넘어가는 짧은 쪽
  assert.ok(Math.abs(wrapAngle(r - 3.1)) < 1e-12, `r=${r}`);
  assert.ok(Math.abs(wrapAngle(3 * Math.PI) - Math.PI) < 1e-12);
  assert.ok(Math.abs(wrapAngle(-Math.PI) - Math.PI) < 1e-12);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/nowhere-walk-path.test.mjs`
Expected: FAIL — `walk-path.js` 없음(`ERR_MODULE_NOT_FOUND`)

- [ ] **Step 3: `walk.js` 에 `MAX_CLIMB` 추가** — `export const STEP_UP = 0.35;` 줄 바로 아래에

```js
export const MAX_CLIMB = 1.2;     // 보행으로 오를 수 있는 최대 경사(높이/수평 ≈ 50°) — 암벽은 걸어 오를 수 없다(길 찾기도 같은 값)
```

- [ ] **Step 4: `camera.js` 가 같은 값을 쓰게** — 10번째 줄 `const MAX_CLIMB = 1.2;  ...` 줄을 지우고, 6번째 줄 import 를 바꾼다

```js
import { walkSpeed, stepBody, STEP_UP, MAX_CLIMB } from './walk.js';
```

- [ ] **Step 5: `public/src/nowhere/walk-path.js` 작성**

```js
// HAUS NOWHERE — 보행 이동 스팟의 길 찾기 · 경로 다듬기 · 따라 걷기(순수, three 없음).
// 테스트: tests/nowhere-walk-path.test.mjs. 좌표는 Three.js 수평면, 점은 { x, z }.
import { STEP_UP, MAX_CLIMB, WALK_SPEED, RUN_SPEED } from './walk.js';

export const PATH_CELL = 0.5;          // m — 길 찾기 격자 칸
export const PATH_MARGIN = 24;         // m — 시작 · 목표 사각형 바깥 탐색 여유
export const PATH_MAX_NODES = 150000;  // 확장 노드 상한(넘으면 실패 → 컷 이동)
export const START_SNAP = 1;           // m — 시작 자리가 막혔을 때 찾는 빈 자리 반경
export const GOAL_SNAP = 2;            // m — 목표 자리가 막혔을 때 찾는 빈 자리 반경
export const SEGMENT_STEP = 0.25;      // m — 직선 검사 표본 간격
export const ARRIVE_RADIUS = 0.3;      // m — 경유점 · 목적지 도달 반경
export const RUN_PATH_LENGTH = 30;     // m — 경로가 이보다 길면 달린다
export const STUCK_TIME = 1.0;         // s — 이 시간 동안
export const STUCK_DIST = 0.2;         // m — 이만큼도 못 나아가면 막힘
export const FACE_DIST = 2.0;          // m — 남은 거리가 이 안이면 볼거리 쪽으로 돈다
export const TURN_RATE = Math.PI;      // rad/s — 시선 방위 최대 회전 속도(초당 180°)

const SQRT2 = Math.SQRT2;
const NEIGHBORS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2],
];

/** 보행과 같은 판정: 서 있을 수 있는 자리(장애물이 턱 STEP_UP 보다 높으면 막힘) · 오를 수 있는 한 걸음(경사 MAX_CLIMB). */
export function walkPredicates({ groundHeightAt, blocker }) {
  const isFree = (x, z) => !blocker || !blocker.isBlocked(x, z, STEP_UP);
  const canStep = (ax, az, bx, bz) => {
    const run = Math.hypot(bx - ax, bz - az);
    return run < 1e-6 || (groundHeightAt(bx, bz) - groundHeightAt(ax, az)) / run <= MAX_CLIMB;
  };
  return { isFree, canStep };
}

/** (x, z) 가 비어 있으면 그대로, 아니면 반경 radius 안 cell 간격 점 중 가장 가까운 빈 자리. 없으면 null. */
export function nearestFreePoint(x, z, isFree, radius, cell = PATH_CELL) {
  if (isFree(x, z)) return { x, z };
  const n = Math.ceil(radius / cell);
  let best = null;
  let bestD = Infinity;
  for (let j = -n; j <= n; j++) {
    for (let i = -n; i <= n; i++) {
      const d = Math.hypot(i * cell, j * cell);
      if (d > radius || d >= bestD) continue;
      const px = x + i * cell;
      const pz = z + j * cell;
      if (isFree(px, pz)) {
        best = { x: px, z: pz };
        bestD = d;
      }
    }
  }
  return best;
}

// 우선순위 최소 이진 힙(노드 번호 · 우선순위 평행 배열)
function createHeap() {
  const keys = [];
  const pri = [];
  return {
    get size() {
      return keys.length;
    },
    push(k, p) {
      let i = keys.length;
      keys.push(k);
      pri.push(p);
      while (i > 0) {
        const up = (i - 1) >> 1;
        if (pri[up] <= p) break;
        keys[i] = keys[up];
        pri[i] = pri[up];
        i = up;
      }
      keys[i] = k;
      pri[i] = p;
    },
    pop() {
      const top = keys[0];
      const k = keys.pop();
      const p = pri.pop();
      const n = keys.length;
      if (n) {
        let i = 0;
        for (;;) {
          let c = 2 * i + 1;
          if (c >= n) break;
          if (c + 1 < n && pri[c + 1] < pri[c]) c++;
          if (pri[c] >= p) break;
          keys[i] = keys[c];
          pri[i] = pri[c];
          i = c;
        }
        keys[i] = k;
        pri[i] = p;
      }
      return top;
    },
  };
}

/**
 * cell 칸 8방향 A*(옥타일 휴리스틱). 탐색 영역 = 시작 · 목표 사각형 + margin. 확장 노드가 maxNodes 를 넘으면 null.
 * 막힌 시작 · 목표는 START_SNAP · GOAL_SNAP 안 가장 가까운 빈 격자점으로 옮긴다. 대각선은 이웃한 두 직교 칸이 모두 비어 있을 때만.
 * 결과: 첫 점 = start, 그다음 격자점들, 목표 자리가 비어 있으면 끝 점 = goal(아니면 보정된 격자점). 실패하면 null.
 */
export function findPath(start, goal, { isFree, canStep = () => true, cell = PATH_CELL, margin = PATH_MARGIN, maxNodes = PATH_MAX_NODES } = {}) {
  const ox = Math.min(start.x, goal.x) - margin;
  const oz = Math.min(start.z, goal.z) - margin;
  const nx = Math.floor((Math.max(start.x, goal.x) + margin - ox) / cell) + 1;
  const nz = Math.floor((Math.max(start.z, goal.z) + margin - oz) / cell) + 1;
  const N = nx * nz;
  const px = (i) => ox + i * cell;
  const pz = (j) => oz + j * cell;
  const freeCache = new Int8Array(N);   // 0 모름 · 1 빈 · −1 막힘
  const free = (i, j) => {
    if (i < 0 || j < 0 || i >= nx || j >= nz) return false;
    const k = j * nx + i;
    if (!freeCache[k]) freeCache[k] = isFree(px(i), pz(j)) ? 1 : -1;
    return freeCache[k] === 1;
  };
  // (x, z) 에서 반경 radius 안 가장 가까운 빈 격자점 번호(없으면 −1)
  const snap = (x, z, radius) => {
    const ci = Math.round((x - ox) / cell);
    const cj = Math.round((z - oz) / cell);
    const n = Math.ceil(radius / cell) + 1;
    let best = -1;
    let bestD = Infinity;
    for (let j = cj - n; j <= cj + n; j++) {
      for (let i = ci - n; i <= ci + n; i++) {
        const d = Math.hypot(px(i) - x, pz(j) - z);
        if (d > radius || d >= bestD || !free(i, j)) continue;
        best = j * nx + i;
        bestD = d;
      }
    }
    return best;
  };
  const sk = snap(start.x, start.z, START_SNAP);
  const gk = snap(goal.x, goal.z, GOAL_SNAP);
  if (sk < 0 || gk < 0) return null;

  const gi = gk % nx;
  const gj = (gk - gi) / nx;
  const h = (k) => {
    const i = k % nx;
    const dx = Math.abs(i - gi);
    const dz = Math.abs((k - i) / nx - gj);
    return (dx + dz + (SQRT2 - 2) * Math.min(dx, dz)) * cell;
  };
  const g = new Float64Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const heap = createHeap();
  g[sk] = 0;
  heap.push(sk, h(sk));
  let expanded = 0;
  let found = false;
  while (heap.size) {
    const k = heap.pop();
    if (closed[k]) continue;
    if (k === gk) {
      found = true;
      break;
    }
    closed[k] = 1;
    if (++expanded > maxNodes) return null;
    const i = k % nx;
    const j = (k - i) / nx;
    for (const [di, dj, w] of NEIGHBORS) {
      const ni = i + di;
      const nj = j + dj;
      if (!free(ni, nj)) continue;
      const nk = nj * nx + ni;
      if (closed[nk]) continue;
      if (di && dj && (!free(i + di, j) || !free(i, j + dj))) continue;
      if (!canStep(px(i), pz(j), px(ni), pz(nj))) continue;
      const cand = g[k] + w * cell;
      if (cand < g[nk]) {
        g[nk] = cand;
        came[nk] = k;
        heap.push(nk, cand + h(nk));
      }
    }
  }
  if (!found) return null;

  const cells = [];
  for (let k = gk; k !== -1; k = came[k]) cells.push(k);
  cells.reverse();
  const out = [{ x: start.x, z: start.z }];
  const add = (x, z) => {
    const l = out[out.length - 1];
    if (Math.hypot(x - l.x, z - l.z) > 1e-6) out.push({ x, z });
  };
  for (const k of cells) {
    const i = k % nx;
    add(px(i), pz((k - i) / nx));
  }
  if (isFree(goal.x, goal.z)) add(goal.x, goal.z);
  return out;
}

/** 두 점 사이 직선을 step 간격으로 걸어 볼 수 있는지(모든 표본이 비어 있고 한 걸음씩 오를 수 있음) */
export function makeSegmentFree(isFree, canStep = () => true, step = SEGMENT_STEP) {
  return (a, b) => {
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(1, Math.ceil(len / step));
    let qx = a.x;
    let qz = a.z;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      if (!isFree(x, z) || !canStep(qx, qz, x, z)) return false;
      qx = x;
      qz = z;
    }
    return true;
  };
}

/** 끈 당기기: 기준점에서 직선으로 갈 수 있는 동안 다음 점으로 건너뛰고, 막히면 직전 점을 꺾는 점으로 남긴다. */
export function smoothPath(points, segmentFree) {
  if (points.length <= 2) return points.slice();
  const out = [points[0]];
  let anchor = 0;
  for (let k = 2; k < points.length; k++) {
    if (!segmentFree(points[anchor], points[k])) {
      anchor = k - 1;
      out.push(points[anchor]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/** 보행 지형 ctx = { groundHeightAt, blocker } 에서 from → to 경로(다듬은 점 목록) 또는 null */
export function planWalkPath(ctx, from, to) {
  const { isFree, canStep } = walkPredicates(ctx);
  const raw = findPath({ x: from.x, z: from.z }, { x: to.x, z: to.z }, { isFree, canStep });
  return raw ? smoothPath(raw, makeSegmentFree(isFree, canStep)) : null;
}

export function pathLength(points) {
  let s = 0;
  for (let i = 1; i < points.length; i++) s += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
  return s;
}

/**
 * 경로 따라 걷기. step(pos, dt) → { done, stuck, dx, dz, remaining }: 이번 프레임 이동량(dx, dz — 지금 경유점 쪽, 속도 × dt 이하),
 * 남은 경로 길이, 도착(done) · 막힘(stuck: STUCK_TIME 동안 STUCK_DIST 미만 진척). 속도는 경로가 RUN_PATH_LENGTH 보다 길면 달리기.
 */
export function createPathFollower(points, { walkSpeed = WALK_SPEED, runSpeed = RUN_SPEED } = {}) {
  const speed = pathLength(points) > RUN_PATH_LENGTH ? runSpeed : walkSpeed;
  const last = points.length - 1;
  const suffix = new Array(points.length).fill(0);   // suffix[i] = points[i] 에서 끝까지 길이
  for (let i = last - 1; i >= 0; i--) suffix[i] = suffix[i + 1] + Math.hypot(points[i + 1].x - points[i].x, points[i + 1].z - points[i].z);
  let idx = 1;
  let watch = null;
  return {
    speed,
    step(pos, dt) {
      while (idx < last && Math.hypot(points[idx].x - pos.x, points[idx].z - pos.z) <= ARRIVE_RADIUS) idx++;
      const tgt = points[idx];
      const dx = tgt.x - pos.x;
      const dz = tgt.z - pos.z;
      const d = Math.hypot(dx, dz);
      const remaining = d + suffix[idx];
      if (idx === last && d <= ARRIVE_RADIUS) return { done: true, stuck: false, dx: 0, dz: 0, remaining };
      if (!watch) watch = { t: 0, x: pos.x, z: pos.z };
      watch.t += dt;
      if (watch.t >= STUCK_TIME - 1e-9) {
        if (Math.hypot(pos.x - watch.x, pos.z - watch.z) < STUCK_DIST) return { done: false, stuck: true, dx: 0, dz: 0, remaining };
        watch = { t: 0, x: pos.x, z: pos.z };
      }
      const s = Math.min(d, speed * dt) / d;
      return { done: false, stuck: false, dx: dx * s, dz: dz * s, remaining };
    },
  };
}

/** 각도를 (−π, π] 로 */
export function wrapAngle(a) {
  const TAU = 2 * Math.PI;
  const r = ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  return r <= -Math.PI ? Math.PI : r;
}

/** yaw 에서 target 쪽으로 짧은 방향으로 최대 maxDelta 만큼 돈 각도 */
export function turnToward(yaw, target, maxDelta) {
  const d = wrapAngle(target - yaw);
  return wrapAngle(yaw + Math.max(-maxDelta, Math.min(maxDelta, d)));
}
```

- [ ] **Step 6: 통과 확인**

Run: `node --test tests/nowhere-walk-path.test.mjs tests/nowhere-walk.test.mjs`
Expected: PASS (walk-path 11개, walk 기존 테스트)

- [ ] **Step 7: 전체 테스트**

Run: `npm test`
Expected: 모든 테스트 PASS

- [ ] **Step 8: 스테이징(커밋하지 않음)**

```bash
git add public/src/nowhere/walk.js public/src/nowhere/camera.js public/src/nowhere/walk-path.js tests/nowhere-walk-path.test.mjs
```

커밋 메시지 안: `feat(nowhere): 보행 이동 스팟 길 찾기(A*) · 경로 다듬기 · 따라 걷기`

---

### Task 3: 카메라 자동 걷기

**Files:**
- Modify: `public/src/nowhere/camera.js` (import, 상태, 키 · 포인터 처리, `setWalkMode` · `clearInput` · `setTerrain`, 보행 갱신 분기, 새 API, 반환 객체)

**Interfaces:**
- Consumes (Task 2): `createPathFollower`, `turnToward`, `wrapAngle`, `FACE_DIST`, `TURN_RATE` (walk-path.js), `LOOK_LIMIT` (look.js)
- Produces (Task 5 가 쓴다) — `createCameraController()` 반환 객체에 추가:
  - `walkTo(points, { look = null, onArrive = null, onStuck = null }) → boolean` — 보행 중이 아니거나 점이 2개 미만이면 false. 도착하면 0.6 s 동안 look 을 정면으로 돌린 뒤 `onArrive()`, 막히면 `onStuck()`(둘 다 마이크로태스크로 미뤄 부른다). 입력으로 끊기면 아무것도 부르지 않는다.
  - `cancelWalkTo()`, `isAutoWalking() → boolean`
  - `placeWalk(x, z, look = null) → boolean` — 보행 중이면 (x, z) 지면 + 1.7 m 로 옮기고 look(없으면 지금 방향)을 본다
  - `getWalkContext() → { groundHeightAt, blocker }` (blocker 는 보행 중일 때만 있음)

- [ ] **Step 1: import 바꾸기** — `camera.js` 상단

```js
import { stepLook, ORBIT_MAX_POLAR, LOOK_LIMIT } from './look.js';
import { walkSpeed, stepBody, STEP_UP, MAX_CLIMB } from './walk.js';
import { createPathFollower, turnToward, wrapAngle, FACE_DIST, TURN_RATE } from './walk-path.js';
```

그리고 `const ORBIT_CLEARANCE = 1.2;` 줄 아래에 상수를 더한다:

```js
const FACE_TIME = 0.6;         // 스팟 도착 뒤 볼거리를 정면으로 돌리는 시간(s)
// 스팟 자동 걷기를 끊는 키(이동 · 시선 · 점프)
const AUTO_WALK_STOP_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
```

- [ ] **Step 2: 자동 걷기 상태** — `let jumpQueued = false;` 줄 아래에

```js
  // 스팟 자동 걷기: { follower, look, onArrive, onStuck, phase: 'walk' | 'face', t, from, to } — 입력 · 보행 해제 · 지형 교체로 끊긴다
  let autoWalk = null;
```

- [ ] **Step 3: 포인터 · 휠 입력이 자동 걷기를 끊게** — `canvas.addEventListener('wheel', onFlightInterrupt, { passive: true });` 줄 아래에

```js
  // 스팟 자동 걷기는 화면 클릭 · 드래그 · 휠로 멈춘다(그 자리에서 자유 보행). 마커는 캔버스 위 DOM 이라 여기 오지 않는다
  const onAutoWalkInterrupt = () => {
    autoWalk = null;
  };
  canvas.addEventListener('pointerdown', onAutoWalkInterrupt, { passive: true });
  canvas.addEventListener('wheel', onAutoWalkInterrupt, { passive: true });
```

- [ ] **Step 4: 이동 · 시선 · 점프 키가 자동 걷기를 끊게** — keydown 처리기의 `if (walkMode) {` 블록(방향키 기본 동작을 막는 곳) 맨 앞에 한 줄

```js
    if (walkMode) {
      if (autoWalk && AUTO_WALK_STOP_KEYS.has(e.code)) autoWalk = null;   // 스팟으로 걷는 중 이동 · 시선 · 점프 키 → 그 자리에서 멈춤
      if (e.code.startsWith('Arrow')) e.preventDefault();   // 방향키 시선 회전 중 페이지 스크롤 방지
```

- [ ] **Step 5: 보행 전환 · 입력 비우기 · 지형 교체가 끊게**
  - `function setWalkMode(enabled) {` 의 `transition = null;` 다음 줄에 `autoWalk = null;`
  - `function clearInput() {` 본문에 `autoWalk = null;` 추가하고 주석을 `/** 누르고 있던 이동 · 시선 키와 점프 예약, 스팟 자동 걷기를 비운다(모달이 뜰 때 — 질문 중에 계속 걷지 않게). */` 로 바꾼다
  - `function setTerrain(...) {` 맨 앞에 `autoWalk = null;   // 층 이동 · 실내 ↔ 외관: 앞 지형의 경로는 버린다`

- [ ] **Step 6: 새 API 함수** — `function clearInput()` 함수 바로 아래에

```js
  /**
   * 스팟 자동 걷기: points(walk-path 점 목록)를 따라 걸어간다(보행 몸 물리 · 충돌 그대로). 보행 중이 아니면 false.
   * 도착하면 FACE_TIME 동안 look 쪽을 정면으로 본 뒤 onArrive, 막히면 onStuck. 입력으로 끊기면 아무것도 부르지 않는다.
   */
  function walkTo(points, { look = null, onArrive = null, onStuck = null } = {}) {
    if (!walkMode || !Array.isArray(points) || points.length < 2) return false;
    autoWalk = { follower: createPathFollower(points), look, onArrive, onStuck, phase: 'walk', t: 0, from: null, to: null };
    walkKeys.clear();
    jumpQueued = false;
    return true;
  }

  function cancelWalkTo() {
    autoWalk = null;
  }

  /** 보행 중 (x, z) 지면 + 눈높이로 바로 옮기고 look(없으면 지금 방향)을 본다 — 스팟 컷 이동 */
  function placeWalk(x, z, look = null) {
    if (!walkMode) return false;
    autoWalk = null;
    const feet = groundHeightAt(x, z);
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    camera.position.set(x, feet + EYE_HEIGHT, z);
    if (look) {
      const to = new THREE.Vector3(look[0] - x, look[1] - camera.position.y, look[2] - z);
      if (Math.hypot(to.x, to.z) > 0.5) dir.copy(to);
    }
    dir.normalize();
    walkEye.copy(camera.position);
    body.feetY = feet;
    body.vy = 0;
    body.grounded = true;
    controls.target.copy(camera.position).addScaledVector(dir, 2.5);
    controls.update();
    return true;
  }

  /** 지금 보행 지형(길 찾기 · 마커가 보행과 같은 판정을 쓰게). blocker 는 보행 중에만 있다 */
  function getWalkContext() {
    return { groundHeightAt, blocker: walkBlocker };
  }

  // 스팟 자동 걷기 한 프레임: 경로 추종 이동량과 시선(진행 방향 → 남은 FACE_DIST 부터 볼거리 → 도착 뒤 FACE_TIME 동안 볼거리 정면)
  function stepAutoWalk(dir, dt) {
    const pos = camera.position;
    let yaw = Math.atan2(dir.x, dir.z);
    let pitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
    const lookAngles = () => {
      const L = autoWalk.look;
      if (!L) return null;
      const lx = L[0] - pos.x;
      const lz = L[2] - pos.z;
      const lh = Math.hypot(lx, lz);
      if (lh < 0.5) return null;
      return { yaw: Math.atan2(lx, lz), pitch: Math.max(-LOOK_LIMIT, Math.min(LOOK_LIMIT, Math.atan2(L[1] - pos.y, lh))) };
    };
    let mx = 0;
    let mz = 0;
    if (autoWalk.phase === 'walk') {
      const r = autoWalk.follower.step(pos, dt);
      if (r.stuck) {
        const cb = autoWalk.onStuck;
        autoWalk = null;
        if (typeof cb === 'function') queueMicrotask(cb);
        return { dir, mx: 0, mz: 0 };
      }
      if (r.done) {
        autoWalk.phase = 'face';
        autoWalk.t = 0;
        autoWalk.from = { yaw, pitch };
        autoWalk.to = lookAngles();
      } else {
        mx = r.dx;
        mz = r.dz;
        const la = r.remaining <= FACE_DIST ? lookAngles() : null;
        yaw = turnToward(yaw, la ? la.yaw : Math.atan2(r.dx, r.dz), TURN_RATE * dt);
        pitch += (0 - pitch) * Math.min(1, dt * 3);   // 걷는 동안 상하 시선은 수평으로 서서히
      }
    }
    if (autoWalk && autoWalk.phase === 'face') {
      autoWalk.t += dt;
      const u = Math.min(1, autoWalk.t / FACE_TIME);
      const { from, to } = autoWalk;
      if (to) {
        const s = u * u * (3 - 2 * u);
        yaw = from.yaw + wrapAngle(to.yaw - from.yaw) * s;
        pitch = from.pitch + (to.pitch - from.pitch) * s;
      }
      if (u >= 1 || !to) {
        const cb = autoWalk.onArrive;
        autoWalk = null;
        if (typeof cb === 'function') queueMicrotask(cb);
      }
    }
    const c = Math.cos(pitch);
    return { dir: { x: c * Math.sin(yaw), y: Math.sin(pitch), z: c * Math.cos(yaw) }, mx, mz };
  }
```

- [ ] **Step 7: 보행 갱신에 자동 걷기 분기** — `stepCamera` 의 `if (walkMode) {` 블록에서 `// 2) 키 시선` 부터 `// 4) 수직` 직전까지(현재 `const dir = stepLook(...)` 부터 WASD 이동 블록의 닫는 `}` 까지)를 아래로 교체한다. 4) 이후(수직 · `walkEye` · `controls.target`)는 그대로 두며 `dir` 을 그대로 쓴다.

```js
      // 2) 키 시선(게임 방식): ↑/↓ 올려다보기·내려다보기, ←/→ 좌우로 돌아보기 + 마우스 고정 중 마우스 이동량 (상하 ±80°)
      let dir = stepLook(look, walkKeys, dt, {}, mouseLook);
      mouseLook.dx = 0;
      mouseLook.dy = 0;
      // 3) 이동: 스팟 자동 걷기 중이면 경로를 따라(시선도 자동), 아니면 WASD(Shift 달리기) — 시선의 수평 성분 기준
      let mx = 0;
      let mz = 0;
      if (autoWalk) {
        const r = stepAutoWalk(dir, dt);
        dir = r.dir;
        mx = r.mx;
        mz = r.mz;
      } else {
        const fwd = new THREE.Vector3(dir.x, 0, dir.z);
        if (fwd.lengthSq() > 1e-8) {
          fwd.normalize();
          const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
          const move = new THREE.Vector3();
          if (walkKeys.has('KeyW')) move.add(fwd);
          if (walkKeys.has('KeyS')) move.sub(fwd);
          if (walkKeys.has('KeyD')) move.add(right);
          if (walkKeys.has('KeyA')) move.sub(right);
          if (move.lengthSq() > 0) {
            move.normalize().multiplyScalar(walkSpeed(walkKeys) * dt);
            mx = move.x;
            mz = move.z;
          }
        }
      }
      if (mx !== 0 || mz !== 0) {
        // 장애물은 발 높이 + 턱(0.35 m)보다 높으면 막힌다 → 점프 중에는 낮은 바위·화단 벽을 넘을 수 있다.
        // 접지 중 50° 넘는 오르막은 못 오르고, 공중에서는 발보다 높은 비탈로 파고들지 않는다. 막히면 벽을 따라 미끄러진다.
        const here = camera.position;
        const gHere = groundHeightAt(here.x, here.z);
        const canStand = (x, z) => {
          const g = groundHeightAt(x, z);
          if (walkBlocker && walkBlocker.isBlocked(x, z, body.feetY - g + STEP_UP)) return false;
          if (!body.grounded) return g <= body.feetY + STEP_UP;
          const run = Math.hypot(x - here.x, z - here.z);
          return run < 1e-6 || (g - gHere) / run <= MAX_CLIMB;
        };
        const next = resolveWalkStep(here, mx, mz, canStand);
        camera.position.x = next.x;
        camera.position.z = next.z;
        // 실내(setBounds)에서는 보행도 층 영역(벽 안쪽, 몸 반경 0.35 m) 안으로 묶는다 —
        // 막힌 자리(궤도 카메라가 벽 쪽에 붙은 채 보행 시작 등)에서 빠져나오는 이동이 벽 밖으로 새지 않게
        if (bounds) {
          const r = 0.35;
          camera.position.x = Math.min(bounds.x1 - r, Math.max(bounds.x0 + r, camera.position.x));
          camera.position.z = Math.min(bounds.z1 - r, Math.max(bounds.z0 + r, camera.position.z));
        }
      }
```

- [ ] **Step 8: 반환 객체에 API 추가** — `return {` 의 `clearInput,` 다음 줄에

```js
    walkTo,
    cancelWalkTo,
    isAutoWalking: () => Boolean(autoWalk),
    placeWalk,
    getWalkContext,
```

- [ ] **Step 9: 문법 · 기존 테스트 확인**

Run: `node --check public/src/nowhere/camera.js && npm test`
Expected: 문법 오류 없음, 모든 테스트 PASS

- [ ] **Step 10: 브라우저 연기 시험(playwriter)** — 서버가 없으면 `npm start` 를 백그라운드로 띄운다(:4173). `state.page` 에서:
  1. `http://localhost:4173/nowhere?noIntro=1` 열기 → 로드 대기(첫 로드는 `evaluate` 가 10–40 s 막힐 수 있으니 짧은 호출로 나눠 확인) → 대화상자 함수 바꿔 두기(`window.__dialogs = []; window.confirm = (m) => (window.__dialogs.push(m), true); window.alert = (m) => { window.__dialogs.push(m); }; window.prompt = (m) => (window.__dialogs.push(m), null);`)
  2. `__NW_APP.camCtrl.setWalkMode(true)` 후 `const p = __NW_APP.camera.position; __NW_APP.camCtrl.walkTo([{ x: p.x, z: p.z }, { x: p.x + 8, z: p.z }], { look: [p.x + 20, 2, p.z], onArrive: () => (window.__arrived = true) })` → 약 2 s 뒤 `window.__arrived === true`, 위치 x 가 약 8 m 늘었는지
  3. 다시 걷기를 건 뒤 `window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w' }))` → `isAutoWalking()` 이 false 로 바뀌는지(이어서 keyup 도 보낸다)
  4. `__NW_APP.camCtrl.placeWalk(0, 40, [0, 10, 0])` → 위치 (0, 지면 + 1.7, 40), 시선이 건물 쪽인지
  결과(값)를 보고서에 적는다.

- [ ] **Step 11: 스테이징(커밋하지 않음)**

```bash
git add public/src/nowhere/camera.js
```

커밋 메시지 안: `feat(nowhere): 보행 자동 걷기(스팟 경로 따라 걷기 · 볼거리로 돌기 · 컷 이동 자리 옮기기)`

---

### Task 4: 공용 암전 레이어 · 실내 연결 고리

**Files:**
- Create: `public/src/nowhere/fade.js`
- Modify: `public/src/nowhere/interior.js` (암전 · 자막 · 층 변경 알림 · `isBusy`)
- Test: `tests/nowhere-fade.test.mjs` (새)

**Interfaces:**
- Produces:
  - `createFade() → { fadeTo(on, text = '', ms = FADE_MS) → Promise<void>, setText(text), element }`, `FADE_MS = 600` (fade.js)
  - `createInterior({ ..., fade = null, onFloorChange = null })` — `fade` 를 주면 그 레이어를 쓰고(없으면 직접 만든다), 층을 보여 줄 때 `onFloorChange(floorDef)`, 밖으로 나갈 때 `onFloorChange(null)`
  - 반환 객체에 `showCaption(text, ms = 4000)` (실내에서만, 하단 자막을 ms 동안), `isBusy() → boolean` (진입 · 층 이동 · 나가기 화면 전환 중)

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/nowhere-fade.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFade, FADE_MS } from '../public/src/nowhere/fade.js';

test('(a) fadeTo: 문구 · 전환 시간 · is-on 을 바꾸고 ms 뒤에 끝난다 · setText 는 문구만', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const node = () => {
    const cls = new Set();
    const children = [];
    return {
      textContent: '',
      className: '',
      style: {},
      children,
      append(...c) {
        children.push(...c);
      },
      classList: { toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)), contains: (c) => cls.has(c) },
    };
  };
  const appended = [];
  globalThis.document = { createElement: node, body: { append: (n) => appended.push(n) } };
  try {
    assert.equal(FADE_MS, 600);
    const f = createFade();
    assert.deepEqual(appended, [f.element]);
    assert.equal(f.element.className, 'nw-fade');
    const text = f.element.children[0];
    assert.equal(text.className, 'nw-fade-text');
    let done = false;
    const p = f.fadeTo(true, '실내로 들어가는 중…', 300).then(() => {
      done = true;
    });
    assert.equal(f.element.classList.contains('is-on'), true);
    assert.equal(f.element.style.transitionDuration, '300ms');
    assert.equal(text.textContent, '실내로 들어가는 중…');
    t.mock.timers.tick(299);
    await Promise.resolve();
    assert.equal(done, false);
    t.mock.timers.tick(1);
    await p;
    assert.equal(done, true);
    f.setText('50%');
    assert.equal(text.textContent, '50%');
    assert.equal(f.element.classList.contains('is-on'), true, 'setText 는 상태를 바꾸지 않는다');
    const q = f.fadeTo(false);
    assert.equal(f.element.classList.contains('is-on'), false);
    assert.equal(f.element.style.transitionDuration, `${FADE_MS}ms`);
    assert.equal(text.textContent, '');
    t.mock.timers.tick(FADE_MS);
    await q;
  } finally {
    delete globalThis.document;
  }
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/nowhere-fade.test.mjs`
Expected: FAIL — `fade.js` 없음

- [ ] **Step 3: `public/src/nowhere/fade.js` 작성**

```js
// HAUS NOWHERE — 공용 화면 전환(검게): 실내 진입 · 층 이동 · 나가기와 보행 스팟 컷 이동이 같은 레이어를 쓴다.
// DOM 은 createFade 를 부를 때만 만든다(테스트: tests/nowhere-fade.test.mjs). 스타일: nowhere.css .nw-fade

export const FADE_MS = 600;

export function createFade() {
  const root = document.createElement('div');
  root.className = 'nw-fade';
  const text = document.createElement('div');
  text.className = 'nw-fade-text';
  root.append(text);
  document.body.append(root);

  /** on = 어둡게(true) · 밝게(false). 가운데 문구 t, ms 뒤에 끝난다 */
  function fadeTo(on, t = '', ms = FADE_MS) {
    return new Promise((res) => {
      text.textContent = t;
      root.style.transitionDuration = `${ms}ms`;
      root.classList.toggle('is-on', on);
      setTimeout(res, ms);
    });
  }

  return {
    fadeTo,
    setText: (t) => {
      text.textContent = t;
    },
    element: root,
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/nowhere-fade.test.mjs`
Expected: PASS

- [ ] **Step 5: `interior.js` 가 공용 암전을 쓰게**
  - import 에 `import { createFade, FADE_MS } from './fade.js';` 를 더하고, `const FADE_MS = 600;` 줄을 지운다.
  - 함수 머리: `export function createInterior({ renderer, camera, camCtrl, post, world, quality, modal, weather = null, exteriorScene, isHelpOpen = () => false, onChange = null, fade = null, onFloorChange = null }) {`
  - 아래 블록을

```js
  // 화면 전환(검게)
  const fade = el('div', 'nw-fade');
  const fadeText = el('div', 'nw-fade-text');
  fade.append(fadeText);
  document.body.append(fade);
```

    다음으로 바꾼다

```js
  // 화면 전환(검게) — main.js 가 넘긴 공용 레이어(보행 스팟 컷 이동과 같이 씀). 없으면 직접 만든다
  const fader = fade || createFade();
```

  - `const fadeTo = (on, text = '', ms = FADE_MS) => new Promise(...)` 정의 전체를 다음 한 줄로 바꾼다

```js
  const fadeTo = (on, text = '', ms = FADE_MS) => fader.fadeTo(on, text, ms);
```

  - 진행률 표시 두 곳 `fadeText.textContent = \`실내 불러오는 중… ${Math.round(r * 100)}%\`;` 와 `fadeText.textContent = \`층 불러오는 중… ${Math.round(r * 100)}%\`;` 를 각각 `fader.setText(\`실내 불러오는 중… ${Math.round(r * 100)}%\`);` · `fader.setText(\`층 불러오는 중… ${Math.round(r * 100)}%\`);` 로 바꾼다.

- [ ] **Step 6: 도착 자막** — `document.body.append(hud, caption);` 줄 아래에

```js
  // 하단 자막: 둘러보기(tour) 자막과 보행 스팟 도착 자막(showCaption, 시간이 지나면 지움)이 같이 쓴다
  let captionTimer = null;
  function setCaption(text) {
    clearTimeout(captionTimer);
    captionTimer = null;
    caption.textContent = text;
    caption.hidden = !text;
  }
  /** 보행 스팟 도착 자막(실내에서만): ms 뒤 지운다. 둘러보기 · 층 이동 · 나가기가 덮어쓰거나 지운다 */
  function showCaption(text, ms = 4000) {
    if (!active) return;
    setCaption(text);
    if (text) captionTimer = setTimeout(() => setCaption(''), ms);
  }
```

  그리고 `createTourPlayer({ ... showCaption: (text) => { caption.textContent = text; caption.hidden = !text; }, ... })` 의 showCaption 을 `showCaption: (text) => setCaption(text),` 로 바꾼다.

- [ ] **Step 7: 층 변경 알림** — `showFloor(def, entry)` 함수 끝(`elevatorTrigger.reset();` 다음)에

```js
    setCaption('');
    if (typeof onFloorChange === 'function') onFloorChange(def);   // 보행 이동 스팟을 이 층 것으로
```

  `exit()` 의 `hud.hidden = true;` 다음 줄에

```js
      setCaption('');
      if (typeof onFloorChange === 'function') onFloorChange(null);   // 보행 이동 스팟을 외관 것으로
```

- [ ] **Step 8: 반환 객체** — `return {` 에 `isTouring: () => tour.isPlaying(),` 다음 줄로

```js
    isBusy: () => busy,
    showCaption,
```

- [ ] **Step 9: 확인**

Run: `node --check public/src/nowhere/interior.js && npm test`
Expected: 문법 오류 없음, 모든 테스트 PASS(특히 `tests/nowhere-inner*.test.mjs`)

- [ ] **Step 10: 브라우저 회귀 확인(playwriter)** — Task 3 Step 10 의 준비(대화상자 함수 바꾸기)를 하고 `http://localhost:4173/nowhere?noIntro=1` 에서 `await __NW_APP.interior.enter('haus')` → 실내 1F, 화면 전환이 어두워졌다 밝아지는지(`document.querySelectorAll('.nw-fade').length === 1`), `__NW_APP.interior.goToFloor('12')` → 12F, `__NW_APP.interior.showCaption('테스트', 1000)` → `.nw-interior-caption` 이 보였다가 1 s 뒤 숨는지, `__NW_APP.interior.exit()` → 외관. 결과를 보고서에 적는다.

- [ ] **Step 11: 스테이징(커밋하지 않음)**

```bash
git add public/src/nowhere/fade.js public/src/nowhere/interior.js tests/nowhere-fade.test.mjs
```

커밋 메시지 안: `refactor(nowhere): 화면 전환 레이어를 공용 fade.js 로 · 실내 층 변경 알림 · 도착 자막`

---

### Task 5: 스팟 마커 · 연결 · 안내

**Files:**
- Create: `public/src/nowhere/spot-markers.js`
- Modify: `public/src/nowhere/main.js` (import, 생성, 연결, 렌더 루프, getStats)
- Modify: `public/src/nowhere/help.js` (보행 행 · 보행 안내 문구)
- Modify: `public/src/nowhere/nowhere.css` (마커 스타일)
- Modify: `README.md` (조작 표)
- Test: `tests/nowhere-help.test.mjs` (테스트 하나 추가)

**Interfaces:**
- Consumes: Task 1 (`exteriorSpots`, `interiorSpots`, `spotStage`, `isSpotOccluded`, `SPOT_LIFT`, `SPOT_FAR`), Task 2 (`walkPredicates`, `nearestFreePoint`, `planWalkPath`, `GOAL_SNAP`), Task 3 (`camCtrl.walkTo` · `cancelWalkTo` · `isAutoWalking` · `placeWalk` · `getWalkContext` · `isWalkMode` · `isFlying`), Task 4 (`createFade`, `interior.isBusy` · `showCaption` · `onFloorChange`)
- Produces: `createSpotMarkers({ camera, canvas, camCtrl, onPick, isSuspended }) → { setSpots(list), update(dt), element }`

- [ ] **Step 1: 실패하는 테스트 추가** — `tests/nowhere-help.test.mjs` 맨 끝에

```js
test('(f) 보행 이동 스팟 안내: 보행 시점 행(클릭 · 탭) · 보행 안내 문구 · main.js 연결', () => {
  const walk = CONTROL_SECTIONS.find((s) => s.id === 'walk');
  const row = walk.rows.find((r) => /이동 스팟/.test(r.desc));
  assert.ok(row, '보행 시점에 이동 스팟 행 없음');
  assert.deepEqual(row.keys, ['클릭', '탭']);
  assert.match(row.desc, /걸어가기/);
  assert.match(row.desc, /입장/);
  const help = readFileSync(new URL('../public/src/nowhere/help.js', import.meta.url), 'utf8');
  assert.match(help, /◇ 스팟/);
  const main = readFileSync(new URL('../public/src/nowhere/main.js', import.meta.url), 'utf8');
  assert.match(main, /createSpotMarkers\(/);
  assert.match(main, /planWalkPath\(/);
  assert.match(main, /markers\.update\(dt\)/);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/nowhere-help.test.mjs`
Expected: FAIL — `(f)` 에서 '보행 시점에 이동 스팟 행 없음'

- [ ] **Step 3: `help.js` 안내** — `walk` 묶음 `rows` 의 마지막(`드래그` 행) 다음에 한 행을 더한다

```js
      { keys: ['클릭', '탭'], desc: '◇ 이동 스팟(실내 볼거리 · 엘리베이터 · 출구, 두 건물 주변) — 그 자리까지 길을 찾아 걸어가기(30 m 넘으면 달리기). WASD · 방향키 · Space · 화면 클릭으로 멈춤. 마우스 고정 중에는 조준점을 스팟에 맞추고 클릭. 성수 정문에 도착하면 입장 질문' },
```

  `createWalkHud` 의 안내 문구를 바꾼다

```js
    hint.textContent = locked
      ? 'Esc  마우스 고정 해제 · 조준점을 ◇ 스팟에 맞추고 클릭  걸어가기'
      : '화면 클릭  마우스로 둘러보기 · ◇ 스팟 클릭  걸어가기 · WASD 이동 · Shift 달리기 · Space 점프 · ? 조작 안내';
```

- [ ] **Step 4: `public/src/nowhere/spot-markers.js` 작성**

```js
// HAUS NOWHERE — 보행 이동 스팟 마커(DOM 오버레이 — 그리기 0): 스팟 자리 보정(보행 지형이 준비되면 빈 자리로) · 화면 투영 ·
// 단계(멀리 작은 마름모 / 가까이 아이콘 + 이름 / 건물 대표 이름 · 거리) · 가림(보행 충돌 격자) · 클릭 · 탭 · 포인터 잠금 조준 클릭 → onPick(spot).
// 보행 시점일 때만 보이고 비행 · isSuspended(모달 · 조작 안내 · 화면 전환 · 둘러보기) 중에는 숨긴다.
import * as THREE from 'three';
import { spotStage, isSpotOccluded, SPOT_LIFT, SPOT_FAR } from './walk-spots.js';
import { walkPredicates, nearestFreePoint, GOAL_SNAP } from './walk-path.js';

const OCCLUSION_INTERVAL = 0.2;   // s — 가림 검사 간격
const AIM_RADIUS = 22;            // px — 포인터 잠금 조준점이 마커 위로 판정되는 반경(터치 대상 44 px 의 절반)

export function createSpotMarkers({ camera, canvas, camCtrl, onPick, isSuspended = () => false }) {
  const root = document.createElement('div');
  root.className = 'nw-spots';
  root.hidden = true;
  document.body.append(root);

  let raw = [];
  let entries = [];        // { spot(보정된 자리), btn, label, stage, occluded, sx, sy, text }
  let resolvedFor = null;  // 보정에 쓴 보행 장애물(층 · 월드가 바뀌면 다시 보정)
  let occTimer = 0;
  let hoverId = null;
  let aimedId = null;
  const v = new THREE.Vector3();

  function clear() {
    root.replaceChildren();
    entries = [];
    resolvedFor = null;
    hoverId = null;
    aimedId = null;
  }

  /** 스팟 목록을 바꾼다(외관 ↔ 실내 층). 자리 보정 · 마커 생성은 보행 지형이 준비된 다음 update 에서 */
  function setSpots(list) {
    raw = Array.isArray(list) ? list : [];
    clear();
  }

  // 막힌 스팟은 GOAL_SNAP 안 가장 가까운 빈 자리로, 없으면 뺀다
  function resolve(ctx) {
    clear();
    const { isFree } = walkPredicates(ctx);
    for (const s of raw) {
      const p = nearestFreePoint(s.x, s.z, isFree, GOAL_SNAP);
      if (!p) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'nw-spot';
      btn.hidden = true;
      btn.setAttribute('aria-label', s.label);
      const icon = document.createElement('span');
      icon.className = 'nw-spot-icon';
      const label = document.createElement('span');
      label.className = 'nw-spot-label';
      btn.append(icon, label);
      const entry = { spot: { ...s, x: p.x, z: p.z }, btn, label, stage: 'hidden', occluded: false, sx: NaN, sy: NaN, text: '' };
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        btn.blur();   // 포커스가 남으면 Space(점프)가 이 버튼을 다시 누른다
        onPick(entry.spot);
      });
      btn.addEventListener('pointerenter', () => {
        hoverId = s.id;
      });
      btn.addEventListener('pointerleave', () => {
        if (hoverId === s.id) hoverId = null;
      });
      root.append(btn);
      entries.push(entry);
    }
    resolvedFor = ctx.blocker;
  }

  // 포인터 잠금 중에는 커서가 없으므로 캔버스 클릭이 조준점 아래 마커를 고른다(잠금 유지)
  canvas.addEventListener('click', () => {
    if (document.pointerLockElement !== canvas || !aimedId) return;
    const e = entries.find((x) => x.spot.id === aimedId);
    if (e) onPick(e.spot);
  });

  function hide() {
    root.hidden = true;
    aimedId = null;
  }

  function update(dt) {
    if (!camCtrl.isWalkMode() || camCtrl.isFlying() || isSuspended()) return hide();
    const ctx = camCtrl.getWalkContext();
    if (!ctx.blocker) return hide();
    if (resolvedFor !== ctx.blocker) resolve(ctx);
    root.hidden = false;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const eye = camera.position;
    occTimer -= dt;
    const checkOcc = occTimer <= 0;
    if (checkOcc) occTimer = OCCLUSION_INTERVAL;
    const locked = document.pointerLockElement === canvas;
    const topAt = (x, z) => ctx.blocker.topAt(x, z, 0);
    let bestAim = null;
    let bestAimD = AIM_RADIUS;

    for (const e of entries) {
      const s = e.spot;
      const dist = Math.hypot(s.x - eye.x, s.z - eye.z);
      const y = ctx.groundHeightAt(s.x, s.z) + SPOT_LIFT;
      if (checkOcc) e.occluded = !s.beacon && dist <= SPOT_FAR && isSpotOccluded(eye, { x: s.x, y, z: s.z }, ctx.groundHeightAt, topAt);
      v.set(s.x, y, s.z).project(camera);
      const onScreen = v.z > -1 && v.z < 1 && Math.abs(v.x) <= 1.05 && Math.abs(v.y) <= 1.05;
      const aimed = s.id === hoverId || s.id === aimedId;
      const stage = onScreen && !e.occluded ? spotStage(dist, { beacon: s.beacon, aimed }) : 'hidden';
      if (stage !== e.stage) {
        e.btn.classList.remove(`is-${e.stage}`);
        e.btn.classList.add(`is-${stage}`);
        e.btn.hidden = stage === 'hidden';
        e.stage = stage;
      }
      if (stage === 'hidden') continue;
      const sx = Math.round((v.x * 0.5 + 0.5) * w);
      const sy = Math.round((-v.y * 0.5 + 0.5) * h);
      if (sx !== e.sx || sy !== e.sy) {
        e.btn.style.transform = `translate(${sx}px, ${sy}px)`;
        e.sx = sx;
        e.sy = sy;
      }
      const text = stage === 'beacon' ? `${s.label} · ${Math.round(dist)} m` : stage === 'near' ? s.label : '';
      if (text !== e.text) {
        e.label.textContent = text;
        e.text = text;
      }
      if (locked) {
        const d = Math.hypot(sx - w / 2, sy - h / 2);
        if (d < bestAimD) {
          bestAimD = d;
          bestAim = s.id;
        }
      }
    }
    aimedId = locked ? bestAim : null;
    for (const e of entries) e.btn.classList.toggle('is-aimed', e.spot.id === aimedId);
  }

  return { setSpots, update, element: root };
}
```

- [ ] **Step 5: 마커 스타일** — `nowhere.css` 의 `/* ── 보행 시점 조준점 · 안내 문구(클릭 통과) ── */` 섹션 바로 앞에

```css
/* ── 보행 이동 스팟 마커(spot-markers.js): 멀리 작은 마름모 · 가까이 둥근 아이콘 + 이름 · 건물 대표 이름 · 거리 ── */
.nw-spots {
  position: fixed;
  inset: 0;
  z-index: 17;
  overflow: hidden;
  pointer-events: none;
}
.nw-spots[hidden],
.nw-spot[hidden] {
  display: none;
}
.nw-spot {
  position: absolute;
  left: 0;
  top: 0;
  width: 44px;               /* 터치 대상 44 × 44 px(보이는 아이콘보다 넓게) */
  height: 44px;
  margin: -22px 0 0 -22px;   /* transform translate 가 가리키는 점이 가운데 */
  padding: 0;
  border: 0;
  background: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  pointer-events: auto;
  -webkit-tap-highlight-color: transparent;
  animation: nw-spot-in 0.2s ease;
}
@keyframes nw-spot-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.nw-spot-icon {
  position: relative;
  width: 10px;
  height: 10px;
  transform: rotate(45deg);
  border: 1.5px solid rgba(236, 244, 255, 0.95);
  background: rgba(200, 225, 255, 0.18);
  box-shadow: 0 0 8px rgba(150, 205, 255, 0.6);
  transition: width 0.2s ease, height 0.2s ease, border-radius 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}
.nw-spot.is-far {
  opacity: 0.6;
}
.nw-spot.is-near .nw-spot-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  transform: none;
  background: rgba(200, 225, 255, 0.12);
}
.nw-spot.is-near .nw-spot-icon::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 6px;
  height: 6px;
  margin: -3px 0 0 -3px;
  border-radius: 50%;
  background: rgba(236, 244, 255, 0.95);
}
.nw-spot.is-aimed .nw-spot-icon,
.nw-spot:hover .nw-spot-icon {
  box-shadow: 0 0 14px rgba(150, 205, 255, 0.95);
}
.nw-spot-label {
  position: absolute;
  left: 50%;
  top: calc(50% + 20px);
  transform: translateX(-50%);
  display: none;
  padding: 3px 8px;
  border-radius: 2px;
  background: rgba(9, 15, 26, 0.62);
  font-family: var(--nw-font-sans);
  font-size: 12px;
  line-height: 1.4;
  color: var(--nw-text);
  white-space: nowrap;
}
.nw-spot.is-near .nw-spot-label,
.nw-spot.is-beacon .nw-spot-label {
  display: block;
}
.nw-spot.is-beacon .nw-spot-label {
  top: calc(50% + 12px);
  font-size: 11px;
  color: var(--nw-text-dim);
}
```

- [ ] **Step 6: `main.js` 연결 — import** (기존 import 아래)

```js
import { createFade } from './fade.js';
import { createSpotMarkers } from './spot-markers.js';
import { exteriorSpots, interiorSpots } from './walk-spots.js';
import { planWalkPath } from './walk-path.js';
```

- [ ] **Step 7: `main.js` — 조작 안내 · 암전 · 마커 생성** — `const help = createHelpOverlay({ onOpen: () => camCtrl.releasePointer() });` 줄을 아래로 바꾼다

```js
  // 조작 안내(? 키 · 상단 버튼). 열 때 보행 마우스 고정을 풀고(안내를 클릭으로 닫게) 스팟 자동 걷기를 멈춘다.
  const help = createHelpOverlay({
    onOpen: () => {
      camCtrl.releasePointer();
      camCtrl.cancelWalkTo();
    },
  });

  // 화면 전환(검게): 실내 진입 · 층 이동 · 나가기와 스팟 컷 이동이 같이 쓴다
  const fade = createFade();

  // 보행 이동 스팟: 외관은 두 건물 주변, 실내는 층마다(interior.onFloorChange 가 바꿔 끼운다)
  const exteriorSpotList = exteriorSpots(world.layout);
  let spotCutting = false;
  const markers = createSpotMarkers({
    camera,
    canvas,
    camCtrl,
    onPick: (spot) => goToSpot(spot),
    isSuspended: () => spotCutting || modal.isOpen() || help.isOpen() || interior.isBusy() || interior.isTouring(),
  });
  markers.setSpots(exteriorSpotList);
```

- [ ] **Step 8: `main.js` — 실내에 암전 · 층 변경 알림 넘기기** — `createInterior({ ... isHelpOpen: () => help.isOpen(), })` 의 인자에 두 줄을 더한다

```js
    fade,
    onFloorChange: (def) => markers.setSpots(def ? interiorSpots(def) : exteriorSpotList),
```

- [ ] **Step 9: `main.js` — 고르기 · 걷기 · 컷 · 도착** — `function startScenario(stepId) {` 함수 바로 위에

```js
  // ── 보행 이동 스팟: 고르기 → 길 찾기 → 걸어가기(길이 없거나 막히면 짧은 암전 컷) → 도착 동작 ──
  function goToSpot(spot) {
    if (spotCutting || !camCtrl.isWalkMode()) return;
    const t0 = performance.now();
    const path = planWalkPath(camCtrl.getWalkContext(), camera.position, spot);
    console.info(`[nowhere] 스팟 길 찾기 ${spot.id}: ${path ? `${path.length}점` : '실패'} ${Math.round(performance.now() - t0)} ms`);
    const walking = path && camCtrl.walkTo(path, { look: spot.look, onArrive: () => arriveAt(spot), onStuck: () => cutToSpot(spot) });
    if (!walking) cutToSpot(spot);
  }

  async function cutToSpot(spot) {
    if (spotCutting || !camCtrl.isWalkMode()) return;
    spotCutting = true;
    camCtrl.cancelWalkTo();
    try {
      await fade.fadeTo(true, '', 300);
      const placed = camCtrl.isWalkMode() && camCtrl.placeWalk(spot.x, spot.z, spot.look);
      await fade.fadeTo(false, '', 300);
      if (placed) arriveAt(spot);
    } finally {
      spotCutting = false;
    }
  }

  function arriveAt(spot) {
    if (spot.kind === 'entrance' && spot.building === 'haus' && !interior.isActive()) {
      modal
        .show({
          title: '입장하시겠습니까?',
          buttons: [
            { id: 'yes', label: '예', primary: true },
            { id: 'no', label: '아니오', cancel: true },
          ],
        })
        .then((c) => {
          if (c === 'yes' && !interior.isActive()) interior.enter('haus');
        });
    } else if (spot.caption && interior.isActive()) {
      interior.showCaption(spot.caption, 4000);
    }
  }
```

- [ ] **Step 10: `main.js` — 렌더 루프 · 상태** — `animate()` 의 `interior.update(dt);` 다음 줄에 `markers.update(dt);` 를 더하고, `getStats()` 반환 객체의 `walkMode: camCtrl.isWalkMode(),` 다음 줄에 `autoWalk: camCtrl.isAutoWalking(),` 를 더한다. `app` 객체에 `markers,` 를 더한다(`modal,` 다음).

- [ ] **Step 11: README 조작 표** — `README.md` 의 `| \`V\` / \`보행 시점\` 버튼 | ...` 행 바로 아래에 한 행

```markdown
| ◇ 이동 스팟(보행 시점) | 실내 각 층(둘러보기 볼거리 · 엘리베이터 · 1F 출구)과 두 건물 주변(성수 5곳 · 몽골 4곳)에 스팟 표시 — 40 m 안은 작은 마름모, 12 m 안이나 마우스를 올리면 아이콘 + 이름, 벽 · 전시물에 가리면 숨김. 건물 대표 스팟(성수 정문 · 몽골 정면)은 거리와 관계없이 '이름 · 거리'. 클릭 · 탭하면 장애물을 피해 그 자리까지 걸어감(30 m 넘으면 달림, 길이 없으면 짧게 어두워졌다 옮김), `WASD` · 방향키 · `Space` · 화면 클릭으로 멈춤. 마우스 고정 중에는 조준점을 맞추고 클릭. 실내 볼거리에 도착하면 자막, 성수 정문에 도착하면 「입장하시겠습니까?」 |
```

- [ ] **Step 12: 테스트**

Run: `node --check public/src/nowhere/main.js && node --check public/src/nowhere/spot-markers.js && npm test`
Expected: 모든 테스트 PASS(새 `(f)` 포함)

- [ ] **Step 13: 브라우저 연기 시험(playwriter)** — Task 3 Step 10 의 준비 뒤 `http://localhost:4173/nowhere?noIntro=1`:
  1. 보행 켜기(`__NW_APP.camCtrl.setWalkMode(true)`) → 1 s 뒤 `document.querySelectorAll('.nw-spot:not([hidden])')` 에 건물 대표 스팟 2개(`is-beacon`, 라벨에 'm')가 보이는지
  2. `.nw-spot.is-beacon` 중 '하우스노웨어 성수 정문' 버튼을 DOM `click()` → 콘솔의 '스팟 길 찾기' 줄(점 수 · ms), `getStats().autoWalk === true`, 수십 초 안에 도착 → 「입장하시겠습니까?」 모달(`.nw-modal` 이 보임) → '아니오'
  3. 정문 근처에서 다른 스팟이 near 단계(아이콘 + 이름)로 보이는지 스크린샷(`build/nowhere/compare/spot-smoke-haus.png`)
  결과를 보고서에 적는다.

- [ ] **Step 14: 스테이징(커밋하지 않음)**

```bash
git add public/src/nowhere/spot-markers.js public/src/nowhere/main.js public/src/nowhere/help.js public/src/nowhere/nowhere.css README.md tests/nowhere-help.test.mjs
```

커밋 메시지 안: `feat(nowhere): 보행 이동 스팟 — 디트로이트식 마커 · 클릭/탭으로 걸어가기 · 정문 입장`

---

### Task 6: 브라우저 확인 · 외관 스팟 조정 · 성능

**Files:**
- Modify (필요할 때만): `public/src/nowhere/walk-spots.js` 의 `EXTERIOR_SPOTS` 좌표 · 이름
- Modify (조정했을 때): `tests/nowhere-walk-spots.test.mjs` 는 건드리지 않는다(조정 뒤에도 (b)(c) 가 통과해야 한다)
- 캡처: `build/nowhere/compare/spot-*.png`(git 이 무시하는 폴더)

**Interfaces:**
- Consumes: Task 1–5 전부
- Produces: 조정된 `EXTERIOR_SPOTS`, 보고서의 측정값

- [ ] **Step 1: 준비** — 서버 :4173 확인(`lsof -i :4173`, 없으면 `npm start` 백그라운드). playwriter 로 `state.page` 를 잡고, 페이지마다 로드 후 대화상자 함수를 바꿔 둔다(Task 3 Step 10). 첫 로드는 `evaluate` 가 오래 막힐 수 있으니 3 s 짧은 호출로 나눠 `window.__NW_APP` 이 생길 때까지 기다린다.

- [ ] **Step 2: 외관 스팟 막힘 · 보정 점검(두 월드)** — `?ver=seongsu&noIntro=1` 과 `?ver=ds2&noIntro=1` 각각에서 보행을 켠 뒤 아래를 `evaluate` 로 실행해 결과를 표로 적는다.

```js
(() => {
  const app = window.__NW_APP;
  const ctx = app.camCtrl.getWalkContext();
  const raw = app.markers.element.querySelectorAll('.nw-spot').length;
  // 원래 자리가 막혔는지 · 보정 거리(보정된 자리는 마커가 들고 있다)
  return { markers: raw, ok: Boolean(ctx.blocker) };
})()
```

  보정 결과 확인은 각 스팟으로 `placeWalk` 해서 본다:

```js
(async () => {
  const { exteriorSpots } = await import('/src/nowhere/walk-spots.js');
  const { walkPredicates, nearestFreePoint } = await import('/src/nowhere/walk-path.js');
  const app = window.__NW_APP;
  const ctx = app.camCtrl.getWalkContext();
  const { isFree } = walkPredicates(ctx);
  return exteriorSpots(app.world.layout).map((s) => {
    const p = nearestFreePoint(s.x, s.z, isFree, 2);
    return { id: s.id, x: +s.x.toFixed(1), z: +s.z.toFixed(1), free: isFree(s.x, s.z), snap: p ? +Math.hypot(p.x - s.x, p.z - s.z).toFixed(2) : null, ground: +ctx.groundHeightAt(s.x, s.z).toFixed(2) };
  });
})()
```

  기준: 모든 스팟이 `free: true` 이거나 보정 거리 ≤ 1 m. 막혔거나(`snap: null`) 1 m 넘게 밀리면 `EXTERIOR_SPOTS` 의 그 스팟 `at` 을 건물 바깥쪽으로 옮겨 다시 잰다. DS2 에서 지형 때문에 두 월드를 함께 만족하는 자리가 없으면, 그 스팟은 DS2 에서 숨겨지는 것을 허용하고 보고서에 적는다(대표 스팟 2개는 두 월드 모두 보여야 한다).

- [ ] **Step 3: 구도 확인 · 캡처** — 스팟마다 `app.camCtrl.placeWalk(x, z, look)` 후 1600×900 캡처를 `build/nowhere/compare/spot-<world>-<id>.png` 로 저장(UI 는 그대로). 볼거리가 화면 안에 들어오고 벽에 코를 박지 않는지 보고, 아니면 `at` · `look` 을 조정한다. 바꾼 값은 보고서에 전 · 후로 적는다.

- [ ] **Step 4: 걸어가기 · 성능 측정** — 성수에서 거리 시점(`cam=street`, 건물에서 약 100 m)에서 보행을 켜고 성수 정문 대표 스팟 클릭 → 콘솔 '스팟 길 찾기' ms(목표 ≤ 30 ms), 도착까지 걸린 시간, 도착 모달. 몽골 정면도 같은 방식. DS2 도 한 번.

- [ ] **Step 5: 실내 확인** — `await __NW_APP.interior.enter('haus')` 뒤 4개 층(`goToFloor('b1' | '1' | '12' | '13')`)마다: 보이는 스팟 수 · 이름, 둘러보기 스팟 하나로 걸어가기(길 찾기 ms ≤ 5 ms 목표, 도착 자막 4 s), 엘리베이터 스팟 → 「층 선택」 모달 → '닫기', 1F 출구 스팟 → 「밖으로 나가시겠습니까?」 → '아니오'. 캡처 `build/nowhere/compare/spot-inner-<floor>.png`.

- [ ] **Step 6: 입력 확인** — (1) 걷는 중 `keydown KeyW` 로 멈춤, (2) 캔버스 `pointerdown` 으로 멈춤, (3) 포인터 잠금 조준: `document.pointerLockElement` 를 직접 만들 수 없으면 스팟을 화면 가운데로 오게 `placeWalk` 한 뒤 `markers` 의 조준 판정이 `is-aimed` 를 붙이는지(잠금 없이 확인 가능한 범위만) 적고, 실제 잠금 클릭은 사용자 확인 항목으로 남긴다. (4) `&tier=mobile` 에서 `.nw-spot` 의 `getBoundingClientRect()` 가 44 × 44 px 이상인지.

- [ ] **Step 7: 예산 · FPS** — 같은 시점 · 시각에서 마커 표시 전후 `__NW_APP.getStats()` 의 `calls` · `triangles` 가 같은지(외관 거리 보행, 실내 1F), `&tier=mobile` 조감(`cam=aerial`) 최악값이 그대로인지. FPS 는 보행 + 마커 상태에서 데스크톱 · `&tier=mobile` 각각 10 s 평균(전원 연결 여부 · 다른 Chrome 렌더러 부하를 `ps -A -o %cpu,comm | sort -rn | head` 로 함께 적는다). 기준 ≥ 60.

- [ ] **Step 8: 테스트 · 스테이징**

Run: `npm test`
Expected: 모든 테스트 PASS

```bash
git add public/src/nowhere/walk-spots.js
```

(좌표를 바꾸지 않았으면 스테이징할 것이 없다.) 커밋 메시지 안: `tune(nowhere): 외관 이동 스팟 자리 · 볼거리 조정(두 월드 막힘 · 구도 확인)`

- [ ] **Step 9: 보고서** — 측정표(스팟별 막힘 · 보정, 길 찾기 ms, 도착 시간, calls · triangles 전후, FPS · 부하), 바꾼 좌표 전후, 캡처 경로, 사용자 확인이 필요한 항목(실제 포인터 잠금 클릭, 아이패드 실기기 탭).
