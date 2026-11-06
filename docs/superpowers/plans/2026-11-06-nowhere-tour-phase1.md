# HAUS NOWHERE 시나리오 투어 · 성수 1F 로비 (1단계) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 분석 모드를 걷어내고, 인트로 비행 → 건물 선택 모달 → 건물 정면 비행 → 입장(성수)/준비중(몽골) 모달로 이어지는 시나리오 투어를 만들고, 성수 「예」로 HAUS NOWHERE 1F 로비 실내 뷰에 들어갔다 나올 수 있게 한다.

**Architecture:** 순수 로직(비행 경로 `flight.js`, 건물 접근 시점 `tour-config.js`, 단계 그래프·실행기 `scenario.js`, 모달 키 해석)은 three 의존 없이 node:test 로 검증한다. `camera.js` 에 `flyTo`/`placeAt`/`setTerrain`/`setBounds` 와 인트로 종료 콜백을 더하고, `interior.js` 가 별도 실내 씬(1F GLB · HDRI · 실내 보행 지형)을 맡아 후처리 `renderPass.scene` 을 바꿔 끼운다. 실내 1F 는 외관과 같은 Blender → glTF(meshopt) 파이프라인(`inner_build.py`)으로 만든다.

**Tech Stack:** Three.js r170(벤더링, import map `three` · `three/addons/…`), 순수 ES 모듈, node:test, Blender 5.3(헤드리스 `/Applications/Blender.app/Contents/MacOS/Blender`), `@gltf-transform/cli@4.1.1`(npx), 브라우저 검증은 playwriter MCP.

**기반 스펙:** `docs/superpowers/specs/2026-11-06-nowhere-tour-interior-design.md` (이 계획은 스펙 §6 의 1단계. 2단계 — B1F·12F·13F, 엘리베이터, 층 둘러보기, 창밖 캡처, 디스플레이 화면, 모바일 실측 — 는 1단계 완료 후 별도 계획 문서로 쓴다.)

## Global Constraints

- **커밋 금지 규칙(사용자 전역 지침)**: 어떤 단계에서도 스스로 `git commit` 하지 않는다. 각 Task 의 마지막 단계는 관련 파일만 `git add`(경로 지정, `-A`/`.` 금지) 하고 커밋 메시지(제목 + 본문 + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`)를 채팅으로 제안하는 것이다. 사용자가 "커밋해"라고 하면 그때만 커밋한다.
- 응답 · 주석 · UI 문구는 한국어. 기존 코드처럼 파일 머리 주석에 역할을 적는다.
- UI 문구는 정확히 이것을 쓴다: `어떤 건물로 이동하시겠습니까?` · `하우스노웨어 성수` · `하우스노웨어 몽골` · `입장하시겠습니까?` · `준비중입니다` · `밖으로 나가시겠습니까?` · `실내를 불러오지 못했습니다` · 버튼 `예` · `아니오` · `확인` · `닫기` · `다시 시도` · `투어 시작` · `건물 이동` · `밖으로 나가기`.
- 좌표 변환: Blender (x, y, z) → Three.js (x, z, −y). 실내 층 원점 = 층 바닥 중앙.
- 새 npm 의존성 금지. three 는 `public/vendor/three` 벤더판(Draco 디코더 없음 → 실내 에셋은 Blender 로 다시 내보내 meshopt 로 압축).
- 예산: 실내 층 GLB 데스크톱 ≤ 6 MB · 모바일 ≤ 3 MB, `env-1k.hdr` ≤ 2 MB. 외관 첫 로딩 크기는 변하지 않는다(실내는 입장할 때만 받음).
- 매 Task 끝에 `npm test` 가 모두 통과해야 한다.
- 브라우저 검증은 playwriter MCP(`mcp__playwriter__execute`)만 쓴다. 동작 전에 `window.confirm/alert/prompt` 를 기록용 함수로 바꿔 진짜 대화상자가 뜨지 않게 한다. 서버: `npm start` → `http://localhost:4173`.
- 성수 2041(`?ver=seongsu`)과 DS2 산악(`?ver=ds2`) 두 월드 모두 같은 투어를 쓴다(두 레이아웃의 건물 위치가 같다: HAUS `[0,0,0]` rotY 0, FaceArch `[105,0,-15]` rotY 27).

---

## File Structure

| 파일 | 상태 | 책임 |
|---|---|---|
| `public/src/nowhere/flight.js` | 생성 | 두 시점 사이 '상승 → 활공 → 정면 하강' 제어점 · 시간 계산(순수) |
| `public/src/nowhere/tour-config.js` | 생성 | 투어 대상 건물(이름 · 요약 · 입장 가능 여부 · 건물 기준 접근 시점)과 월드 좌표 변환(순수) |
| `public/src/nowhere/modal.js` | 생성 | 공용 모달 DOM + Enter/Esc 해석(순수 함수 분리) |
| `public/src/nowhere/scenario.js` | 생성 | 투어 단계 그래프(문구 포함) · 검증 · 실행기(어댑터 주입, 순수) |
| `public/src/nowhere/terrain-mesh.js` | 생성 | three 메시 → 높이 격자 · 장애물 격자 래스터화(외관 `world.js` 와 실내가 공유) |
| `public/src/nowhere/interior.js` | 생성 | 실내 씬 · 층 GLB/HDRI 불러오기 · 진입/나가기 화면 전환 · 실내 보행 지형 · 출구 모달 · 실내 HUD |
| `tools/nowhere/blender/inner_build.py` | 생성 | 1F 로비 껍데기 + 에셋 축척 · 배치 · 감축 → `inner-1.glb`, `inner-layout.json`, `env-1k.hdr`, 미리보기 렌더 |
| `public/src/nowhere/camera.js` | 수정 | `flyTo` · `stopFlight` · `isFlying` · `placeAt` · `setTerrain` · `setBounds`, 인트로 종료 콜백 |
| `public/src/nowhere/world.js` | 수정 | 래스터화 코드를 `terrain-mesh.js` 로 옮김(결과 동일) |
| `public/src/nowhere/main.js` | 수정 | 분석 모드 제거, 모달 · 실내 · 시나리오 연결, 버튼 · 자동 시작 · Esc |
| `public/src/nowhere/help.js` | 수정 | 분석 모드 키 행 제거, 투어 · 실내 행 추가 |
| `public/src/nowhere/nowhere.css` | 수정 | 분석 모드 · 카드 스타일 제거, 모달 · 화면 전환 · 실내 HUD · `is-interior` 숨김 |
| `public/index.html`, `public/nowhere.html`, `public/nowhere-mountain.html` | 수정 | 분석 모드 마크업 제거, `건물 이동` 버튼, `투어 시작` 이름, 카메라 독 클래스 |
| `public/src/nowhere/analysis.js` | 삭제 | — |
| `package.json` | 수정 | `nowhere:inner:build`, `nowhere:inner:optimize` |
| `tests/nowhere-flight.test.mjs` · `nowhere-tour-config.test.mjs` · `nowhere-modal.test.mjs` · `nowhere-scenario.test.mjs` · `nowhere-inner.test.mjs` | 생성 | 위 순수 모듈 · 실내 레이아웃 계약 |
| `tests/nowhere-help.test.mjs` | 수정 | 분석 모드 바인딩 검사 → 투어 바인딩 검사 |
| `README.md` | 수정 | 분석 모드 행 → 투어 · 실내 설명 |

---

### Task 1: 비행 경로 계산 `flight.js`

**Files:**
- Create: `public/src/nowhere/flight.js`
- Test: `tests/nowhere-flight.test.mjs`

**Interfaces:**
- Produces: `buildFlightPath(from, to) → { points: number[3][], targets: number[3][], duration: number }` — `from`/`to` 는 `{ pos: [x,y,z], target: [x,y,z] }`(Three 좌표). 상수 `FLIGHT_SPEED = 40`, `FLIGHT_MIN_S = 4`, `FLIGHT_MAX_S = 8`, `FLIGHT_MIN_RISE = 25`.

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/nowhere-flight.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFlightPath, FLIGHT_MIN_S, FLIGHT_MAX_S, FLIGHT_MIN_RISE } from '../public/src/nowhere/flight.js';

const A = { pos: [-105, 1.7, 50.2], target: [-30, 5, 31] };
const B = { pos: [0, 3.2, 46], target: [0, 10, 0] };

test('(a) 시작 · 끝 제어점과 시선 타깃이 두 시점과 정확히 같다', () => {
  const p = buildFlightPath(A, B);
  assert.deepEqual(p.points[0], A.pos);
  assert.deepEqual(p.points[p.points.length - 1], B.pos);
  assert.deepEqual(p.targets[0], A.target);
  assert.deepEqual(p.targets[p.targets.length - 1], B.target);
  assert.equal(p.points.length, p.targets.length);
});

test('(b) 경로 최고점은 두 시점보다 최소 상승 높이(25 m) 이상 높다', () => {
  const p = buildFlightPath(A, B);
  const top = Math.max(...p.points.map((q) => q[1]));
  assert.ok(top >= Math.max(A.pos[1], B.pos[1]) + FLIGHT_MIN_RISE - 1e-9, `top=${top}`);
});

test('(c) 시간 = 거리 / 40 m/s 를 4~8 초로 자른다', () => {
  assert.equal(buildFlightPath({ pos: [0, 2, 0], target: [0, 2, -5] }, { pos: [10, 2, 0], target: [10, 2, -5] }).duration, FLIGHT_MIN_S);
  assert.equal(buildFlightPath({ pos: [0, 2, 0], target: [0, 2, -5] }, { pos: [1000, 2, 0], target: [1000, 2, -5] }).duration, FLIGHT_MAX_S);
  assert.ok(Math.abs(buildFlightPath({ pos: [0, 2, 0], target: [0, 2, -5] }, { pos: [200, 2, 0], target: [200, 2, -5] }).duration - 5) < 1e-9);
});

test('(d) 먼 거리는 상승 높이도 거리의 15 % 로 커진다', () => {
  const p = buildFlightPath({ pos: [0, 2, 0], target: [0, 2, -5] }, { pos: [1000, 2, 0], target: [1000, 2, -5] });
  const top = Math.max(...p.points.map((q) => q[1]));
  assert.ok(top >= 2 + 150 - 1e-9, `top=${top}`);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/nowhere-flight.test.mjs`
Expected: FAIL — `Cannot find module …/public/src/nowhere/flight.js`

- [ ] **Step 3: 구현** — `public/src/nowhere/flight.js`

```js
// HAUS NOWHERE — 시나리오 투어: 두 시점 사이 '상승 → 활공 → 정면 하강' 비행 경로(순수 함수, 테스트: tests/nowhere-flight.test.mjs).
// 좌표는 Three.js (x, y 위, z). 카메라 쪽(camera.flyTo)이 이 제어점으로 Catmull-Rom 곡선을 만든다.

export const FLIGHT_SPEED = 40;      // m/s
export const FLIGHT_MIN_S = 4;
export const FLIGHT_MAX_S = 8;
export const FLIGHT_MIN_RISE = 25;   // m

const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * from/to = { pos: [x,y,z], target: [x,y,z] }.
 * 제어점: 출발점 → 출발점 위(상승의 절반) → 두 점 사이 상공(최고점) → 도착점 위(상승의 40 %) → 도착점.
 * 상승 높이 = max(25 m, 직선거리 × 0.15), 시간 = clamp(직선거리 / 40 m/s, 4 s, 8 s).
 */
export function buildFlightPath(from, to) {
  const p0 = from.pos;
  const p1 = to.pos;
  const dist = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
  const rise = Math.max(FLIGHT_MIN_RISE, dist * 0.15);
  const top = Math.max(p0[1], p1[1]) + rise;
  const mid = lerp3(p0, p1, 0.5);
  const points = [
    [p0[0], p0[1], p0[2]],
    [p0[0], p0[1] + rise * 0.5, p0[2]],
    [mid[0], top, mid[2]],
    [p1[0], p1[1] + rise * 0.4, p1[2]],
    [p1[0], p1[1], p1[2]],
  ];
  const t0 = from.target;
  const t1 = to.target;
  const targets = [
    [t0[0], t0[1], t0[2]],
    [t0[0], t0[1], t0[2]],
    lerp3(t0, t1, 0.5),
    [t1[0], t1[1], t1[2]],
    [t1[0], t1[1], t1[2]],
  ];
  const duration = Math.min(FLIGHT_MAX_S, Math.max(FLIGHT_MIN_S, dist / FLIGHT_SPEED));
  return { points, targets, duration };
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/nowhere-flight.test.mjs`
Expected: `# pass 4`, `# fail 0`

- [ ] **Step 5: 스테이징 · 커밋 메시지 제안**

```bash
git add public/src/nowhere/flight.js tests/nowhere-flight.test.mjs
```
제안 메시지: `feat(tour): 건물 정면 비행 경로 계산(상승 → 활공 → 하강, 4~8초)`

---

### Task 2: 투어 대상 건물 · 접근 시점 `tour-config.js`

**Files:**
- Create: `public/src/nowhere/tour-config.js`
- Test: `tests/nowhere-tour-config.test.mjs`

**Interfaces:**
- Produces: `TOUR_BUILDINGS: { haus: TourBuilding, facearch: TourBuilding }`, `TourBuilding = { label: string, summary: string, enterable: boolean, approach: { pos: number[3], target: number[3] } }`(approach 는 건물 기준 로컬, Three 축). `approachFor(layout, id) → { pos: number[3], target: number[3] } | null`(건물 위치 + rotY 회전 반영 월드 좌표).

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/nowhere-tour-config.test.mjs`

```js
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
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/nowhere-tour-config.test.mjs`
Expected: FAIL — `Cannot find module …/tour-config.js`

- [ ] **Step 3: 구현** — `public/src/nowhere/tour-config.js`

```js
// HAUS NOWHERE — 시나리오 투어 대상 건물(순수 데이터 + 좌표 변환, 테스트: tests/nowhere-tour-config.test.mjs).
// approach 는 건물 기준 로컬 오프셋(Three 축, 건물 rotY 회전 전). 화면을 보며 조정한다(Task 10).

export const TOUR_BUILDINGS = {
  haus: {
    label: '하우스노웨어 성수',
    summary: '50 × 52 m · 높이 81 m',
    enterable: true,
    // 남측 전정(z +17…+31) 앞에서 포디움 입구를 바라본다
    approach: { pos: [0, 3.2, 46], target: [0, 10, 0] },
  },
  facearch: {
    label: '하우스노웨어 몽골',
    summary: '22 × 18 m · 높이 31 m',
    enterable: false,
    // 얼굴 정면에서 두 눈과 필로티를 함께 본다
    approach: { pos: [0, 6, 48], target: [0, 14, 0] },
  },
};

/** layout.buildings[id] 의 위치 · rotY(도)를 반영한 월드 접근 시점. 건물 · 레이아웃이 없으면 null. */
export function approachFor(layout, id) {
  const b = TOUR_BUILDINGS[id];
  const cfg = layout?.buildings?.[id];
  if (!b || !cfg || !Array.isArray(cfg.pos)) return null;
  const th = ((cfg.rotY || 0) * Math.PI) / 180;
  const c = Math.cos(th);
  const s = Math.sin(th);
  // three 의 rotation.y 와 같은 회전: x' = x cosθ + z sinθ, z' = −x sinθ + z cosθ
  const tf = ([x, y, z]) => [cfg.pos[0] + x * c + z * s, cfg.pos[1] + y, cfg.pos[2] - x * s + z * c];
  return { pos: tf(b.approach.pos), target: tf(b.approach.target) };
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/nowhere-tour-config.test.mjs`
Expected: `# pass 4`, `# fail 0`

- [ ] **Step 5: 스테이징 · 커밋 메시지 제안**

```bash
git add public/src/nowhere/tour-config.js tests/nowhere-tour-config.test.mjs
```
제안 메시지: `feat(tour): 투어 대상 건물(성수 입장 가능 · 몽골 준비중)과 건물 기준 접근 시점`

---

### Task 3: 공용 모달 `modal.js`

**Files:**
- Create: `public/src/nowhere/modal.js`
- Modify: `public/src/nowhere/nowhere.css` (파일 끝에 모달 스타일 추가)
- Test: `tests/nowhere-modal.test.mjs`

**Interfaces:**
- Produces: `resolveModalKey(key: string, buttons: ModalButton[]) → string | null | undefined` — `Enter` → 기본(primary, 없으면 첫) 버튼 id, `Escape` → cancel 버튼 id(없으면 `null`), 그 밖 → `undefined`(처리 안 함). `ModalButton = { id: string, label: string, sub?: string, primary?: boolean, cancel?: boolean }`.
- Produces: `createModal({ onShow? }) → { show({ title, body?, buttons }) → Promise<string|null>, close(), isOpen() }` — `close()` 는 열린 모달을 `null` 로 끝낸다. 새 `show` 는 이전 모달을 `null` 로 끝내고 연다.

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/nowhere-modal.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveModalKey } from '../public/src/nowhere/modal.js';

const YN = [{ id: 'yes', label: '예', primary: true }, { id: 'no', label: '아니오', cancel: true }];
const PICK = [{ id: 'haus', label: '하우스노웨어 성수' }, { id: 'facearch', label: '하우스노웨어 몽골' }, { id: 'close', label: '닫기', cancel: true }];

test('(a) Enter 는 기본 버튼, 기본 버튼이 없으면 첫 버튼', () => {
  assert.equal(resolveModalKey('Enter', YN), 'yes');
  assert.equal(resolveModalKey('Enter', PICK), 'haus');
});

test('(b) Esc 는 취소 버튼, 취소 버튼이 없으면 null', () => {
  assert.equal(resolveModalKey('Escape', YN), 'no');
  assert.equal(resolveModalKey('Escape', [{ id: 'ok', label: '확인', primary: true }]), null);
});

test('(c) 다른 키는 처리하지 않는다(undefined)', () => {
  assert.equal(resolveModalKey('KeyW', YN), undefined);
  assert.equal(resolveModalKey(' ', YN), undefined);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/nowhere-modal.test.mjs`
Expected: FAIL — `Cannot find module …/modal.js`

- [ ] **Step 3: 구현** — `public/src/nowhere/modal.js`

```js
// HAUS NOWHERE — 공용 모달(시나리오 투어 · 실내 출구 · 오류). 조작 안내 오버레이와 같은 패널 스타일.
// resolveModalKey 는 순수 함수(테스트: tests/nowhere-modal.test.mjs). DOM 은 createModal 을 부를 때만 만든다.

/** Enter → 기본 버튼 id(없으면 첫 버튼), Escape → 취소 버튼 id(없으면 null), 그 밖 → undefined. */
export function resolveModalKey(key, buttons) {
  if (key === 'Enter') {
    const p = buttons.find((b) => b.primary) || buttons[0];
    return p ? p.id : null;
  }
  if (key === 'Escape') {
    const c = buttons.find((b) => b.cancel);
    return c ? c.id : null;
  }
  return undefined;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/**
 * show({ title, body?, buttons }) → Promise<버튼 id | null>. 열려 있는 동안 Enter/Esc 를 창 캡처 단계에서 먼저 받는다.
 * 배경 클릭으로는 닫지 않는다(선택을 요구하는 모달). onShow: 보행 마우스 고정 해제 등.
 */
export function createModal({ onShow = null } = {}) {
  const root = el('div', 'nw-modal');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.hidden = true;
  const panel = el('div', 'nw-modal-panel');
  const title = el('h2', 'nw-modal-title');
  title.id = 'nw-modal-title';
  root.setAttribute('aria-labelledby', title.id);
  const body = el('p', 'nw-modal-body');
  const actions = el('div', 'nw-modal-actions');
  panel.append(title, body, actions);
  root.append(panel);
  document.body.append(root);

  let current = null;   // { buttons, resolve }

  function finish(id) {
    if (!current) return;
    const { resolve } = current;
    current = null;
    root.hidden = true;
    actions.replaceChildren();
    resolve(id);
  }

  function show({ title: t, body: b = '', buttons }) {
    finish(null);
    title.textContent = t;
    body.textContent = b;
    body.hidden = !b;
    actions.replaceChildren();
    let primaryBtn = null;
    for (const spec of buttons) {
      const btn = el('button', `nw-btn nw-modal-btn${spec.primary ? ' is-primary' : ''}`);
      btn.type = 'button';
      btn.append(el('span', 'nw-modal-btn-label', spec.label));
      if (spec.sub) btn.append(el('span', 'nw-modal-btn-sub', spec.sub));
      btn.addEventListener('click', () => finish(spec.id));
      actions.append(btn);
      if (!primaryBtn && (spec.primary || buttons[0] === spec)) primaryBtn = btn;
    }
    root.hidden = false;
    if (typeof onShow === 'function') onShow();
    primaryBtn?.focus();
    return new Promise((resolve) => {
      current = { buttons, resolve };
    });
  }

  window.addEventListener(
    'keydown',
    (e) => {
      if (!current) return;
      const id = resolveModalKey(e.key, current.buttons);
      if (id === undefined) return;
      e.preventDefault();
      e.stopPropagation();
      finish(id);
    },
    true,
  );

  return { show, close: () => finish(null), isOpen: () => Boolean(current) };
}
```

- [ ] **Step 4: 모달 스타일 추가** — `public/src/nowhere/nowhere.css` 파일 끝에 덧붙인다

```css

/* ── 공용 모달(시나리오 투어 · 실내 출구 · 오류) ── */
.nw-modal {
  position: fixed;
  inset: 0;
  z-index: 48;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(4, 8, 14, 0.42);
}
.nw-modal[hidden] {
  display: none;
}
.nw-modal-panel {
  width: min(460px, 100%);
  padding: 20px 22px 18px;
  background: var(--nw-bg-panel-strong);
  border: 1px solid var(--nw-line-struct);
  border-top: 2px solid var(--nw-accent);
  border-radius: 4px;
  color: var(--nw-text);
}
.nw-modal-title {
  margin: 0 0 6px;
  font-size: 17px;
  font-weight: 600;
  word-break: keep-all;
}
.nw-modal-body {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--nw-text-dim);
  word-break: keep-all;
}
.nw-modal-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
}
.nw-modal-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-width: 88px;
}
.nw-modal-btn.is-primary {
  color: var(--nw-accent);
  border-color: var(--nw-accent);
}
.nw-modal-btn-sub {
  font-family: var(--nw-font-mono);
  font-size: 10.5px;
  color: var(--nw-text-dim);
}
```

- [ ] **Step 5: 통과 확인**

Run: `node --test tests/nowhere-modal.test.mjs && npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: 모달 테스트 `# pass 3`, 전체 `# fail 0`

- [ ] **Step 6: 스테이징 · 커밋 메시지 제안**

```bash
git add public/src/nowhere/modal.js public/src/nowhere/nowhere.css tests/nowhere-modal.test.mjs
```
제안 메시지: `feat(ui): 공용 모달(Enter 기본 · Esc 취소, 캡처 단계 키 처리)`

---

### Task 4: 시나리오 단계 그래프 · 실행기 `scenario.js`

**Files:**
- Create: `public/src/nowhere/scenario.js`
- Test: `tests/nowhere-scenario.test.mjs`

**Interfaces:**
- Consumes: 없음(어댑터 주입).
- Produces:
  - `SCENARIO = { start: 'intro', steps: { [id]: Step } }` — Step 종류: `{ type: 'intro', next }`, `{ type: 'modal', title, buttons: [{ id, label, building?, primary?, cancel?, next }] }`, `{ type: 'fly', building, next }`, `{ type: 'enterInterior', building, next }`, `{ type: 'end' }`.
  - `CANCEL`(Symbol) — 어댑터가 돌려주면 시나리오를 끝낸다.
  - `nextStepId(step, result) → string`, `validateScenario(scenario) → string[]`(오류 목록).
  - `createScenarioRunner({ scenario?, adapters: { intro(step), modal(step), fly(step), enterInterior(step) }, onEnd? }) → { start(stepId?) → Promise<'done'|'cancelled'>, cancel(), isRunning(), current() }`.

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/nowhere-scenario.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIO, CANCEL, nextStepId, validateScenario, createScenarioRunner } from '../public/src/nowhere/scenario.js';

function fakeAdapters(choices, log) {
  const queue = [...choices];
  return {
    intro: async (s) => { log.push(s.type); return 'complete'; },
    modal: async (s) => { log.push(`modal:${s.title}`); return queue.shift(); },
    fly: async (s) => { log.push(`fly:${s.building}`); return 'done'; },
    enterInterior: async (s) => { log.push(`enter:${s.building}`); return 'done'; },
  };
}

test('(a) 그래프가 유효하고 문구가 정확하다', () => {
  assert.deepEqual(validateScenario(SCENARIO), []);
  assert.equal(SCENARIO.steps.chooseBuilding.title, '어떤 건물로 이동하시겠습니까?');
  assert.deepEqual(SCENARIO.steps.chooseBuilding.buttons.map((b) => b.label), ['하우스노웨어 성수', '하우스노웨어 몽골', '닫기']);
  assert.equal(SCENARIO.steps.askEnter.title, '입장하시겠습니까?');
  assert.deepEqual(SCENARIO.steps.askEnter.buttons.map((b) => b.label), ['예', '아니오']);
  assert.equal(SCENARIO.steps.notReady.title, '준비중입니다');
  assert.deepEqual(SCENARIO.steps.notReady.buttons.map((b) => b.label), ['확인']);
});

test('(b) 성수 → 예: 인트로 → 선택 → 비행 → 입장 질문 → 실내 진입', async () => {
  const log = [];
  let ended = 0;
  const r = createScenarioRunner({ adapters: fakeAdapters(['haus', 'yes'], log), onEnd: () => ended++ });
  assert.equal(await r.start(), 'done');
  assert.deepEqual(log, ['intro', 'modal:어떤 건물로 이동하시겠습니까?', 'fly:haus', 'modal:입장하시겠습니까?', 'enter:haus']);
  assert.equal(ended, 1);
  assert.equal(r.isRunning(), false);
});

test('(c) 성수 → 아니오: 실내 진입 없이 끝', async () => {
  const log = [];
  await createScenarioRunner({ adapters: fakeAdapters(['haus', 'no'], log) }).start();
  assert.equal(log.includes('enter:haus'), false);
  assert.equal(log.at(-1), 'modal:입장하시겠습니까?');
});

test('(d) 몽골 → 준비중입니다 → 확인 → 끝', async () => {
  const log = [];
  await createScenarioRunner({ adapters: fakeAdapters(['facearch', 'ok'], log) }).start();
  assert.deepEqual(log, ['intro', 'modal:어떤 건물로 이동하시겠습니까?', 'fly:facearch', 'modal:준비중입니다']);
});

test('(e) 모달에서 Esc(null) 는 시나리오 종료', async () => {
  const log = [];
  await createScenarioRunner({ adapters: fakeAdapters([null], log) }).start();
  assert.deepEqual(log, ['intro', 'modal:어떤 건물로 이동하시겠습니까?']);
});

test("(f) start('chooseBuilding') 는 인트로 없이 모달부터", async () => {
  const log = [];
  await createScenarioRunner({ adapters: fakeAdapters(['facearch', 'ok'], log) }).start('chooseBuilding');
  assert.equal(log[0], 'modal:어떤 건물로 이동하시겠습니까?');
});

test('(g) 어댑터가 CANCEL 을 돌려주면 끝, 비행 중 cancel() 하면 다음 단계로 가지 않는다', async () => {
  const log = [];
  const a = fakeAdapters(['haus', 'yes'], log);
  a.intro = async () => CANCEL;
  await createScenarioRunner({ adapters: a }).start();
  assert.deepEqual(log, []);

  const log2 = [];
  let release;
  const b = fakeAdapters(['haus', 'yes'], log2);
  b.fly = () => new Promise((res) => { release = res; });
  let ended = 0;
  const r = createScenarioRunner({ adapters: b, onEnd: () => ended++ });
  const p = r.start();
  await new Promise((res) => setTimeout(res, 0));
  assert.equal(r.current(), 'flyHaus');
  r.cancel();
  release('cancelled');
  assert.equal(await p, 'cancelled');
  assert.equal(log2.includes('modal:입장하시겠습니까?'), false);
  assert.equal(ended, 1);
});

test('(h) nextStepId: 모달은 버튼의 next, 모르는 결과는 end, 나머지는 step.next', () => {
  assert.equal(nextStepId(SCENARIO.steps.chooseBuilding, 'haus'), 'flyHaus');
  assert.equal(nextStepId(SCENARIO.steps.chooseBuilding, null), 'end');
  assert.equal(nextStepId(SCENARIO.steps.intro, 'skipped'), 'chooseBuilding');
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/nowhere-scenario.test.mjs`
Expected: FAIL — `Cannot find module …/scenario.js`

- [ ] **Step 3: 구현** — `public/src/nowhere/scenario.js`

```js
// HAUS NOWHERE — 시나리오 투어: 단계 그래프(문구 포함) · 검증 · 실행기(순수, 테스트: tests/nowhere-scenario.test.mjs).
// 실제 동작(인트로 · 모달 · 비행 · 실내 진입)은 main.js 가 어댑터로 넣는다.
// 인트로를 사용자 입력으로 건너뛰어도('skipped') 건물 선택 모달로 이어지고, CANCEL · 모달 Esc(null) 는 시나리오를 끝낸다.

export const CANCEL = Symbol('scenario-cancel');

export const SCENARIO = {
  start: 'intro',
  steps: {
    intro: { type: 'intro', next: 'chooseBuilding' },
    chooseBuilding: {
      type: 'modal',
      title: '어떤 건물로 이동하시겠습니까?',
      buttons: [
        { id: 'haus', label: '하우스노웨어 성수', building: 'haus', primary: true, next: 'flyHaus' },
        { id: 'facearch', label: '하우스노웨어 몽골', building: 'facearch', next: 'flyFacearch' },
        { id: 'close', label: '닫기', cancel: true, next: 'end' },
      ],
    },
    flyHaus: { type: 'fly', building: 'haus', next: 'askEnter' },
    askEnter: {
      type: 'modal',
      title: '입장하시겠습니까?',
      buttons: [
        { id: 'yes', label: '예', primary: true, next: 'enterHaus' },
        { id: 'no', label: '아니오', cancel: true, next: 'end' },
      ],
    },
    enterHaus: { type: 'enterInterior', building: 'haus', next: 'end' },
    flyFacearch: { type: 'fly', building: 'facearch', next: 'notReady' },
    notReady: {
      type: 'modal',
      title: '준비중입니다',
      buttons: [{ id: 'ok', label: '확인', primary: true, cancel: true, next: 'end' }],
    },
    end: { type: 'end' },
  },
};

/** 모달은 고른 버튼의 next(모르는 결과 · null 은 'end'), 그 밖은 step.next(없으면 'end'). */
export function nextStepId(step, result) {
  if (step.type === 'modal') {
    const b = step.buttons.find((x) => x.id === result);
    return b ? b.next : 'end';
  }
  return step.next || 'end';
}

/** 시작 단계 · 모든 next 가 존재하는지 검사해 오류 문자열 목록을 돌려준다. */
export function validateScenario(scenario) {
  const errors = [];
  const ids = new Set(Object.keys(scenario.steps));
  if (!ids.has(scenario.start)) errors.push(`start '${scenario.start}' 없음`);
  if (!ids.has('end')) errors.push("'end' 단계 없음");
  for (const [id, s] of Object.entries(scenario.steps)) {
    const nexts = s.type === 'modal' ? s.buttons.map((b) => b.next) : s.type === 'end' ? [] : [s.next];
    for (const n of nexts) if (!ids.has(n)) errors.push(`${id} → '${n}' 없음`);
  }
  return errors;
}

/**
 * adapters: { intro, modal, fly, enterInterior } — 각각 (step) => Promise<결과>. CANCEL 을 돌려주면 끝.
 * start 를 다시 부르거나 cancel() 하면 앞선 실행은 기다리던 어댑터가 끝나는 대로 조용히 멈춘다(onEnd 는 한 번만).
 */
export function createScenarioRunner({ scenario = SCENARIO, adapters, onEnd = null }) {
  let token = 0;
  let running = false;
  let currentId = null;

  function stop() {
    running = false;
    currentId = null;
    if (typeof onEnd === 'function') onEnd();
  }

  async function start(stepId = scenario.start) {
    if (running) stop();
    const my = ++token;
    running = true;
    let id = stepId;
    while (id && id !== 'end') {
      const step = scenario.steps[id];
      if (!step) break;
      currentId = id;
      const fn = adapters[step.type];
      const result = typeof fn === 'function' ? await fn(step) : undefined;
      if (my !== token) return 'cancelled';
      if (result === CANCEL) break;
      id = nextStepId(step, result);
    }
    if (my === token) stop();
    return 'done';
  }

  function cancel() {
    if (!running) return;
    token++;
    stop();
  }

  return { start, cancel, isRunning: () => running, current: () => currentId };
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/nowhere-scenario.test.mjs`
Expected: `# pass 8`, `# fail 0`

- [ ] **Step 5: 스테이징 · 커밋 메시지 제안**

```bash
git add public/src/nowhere/scenario.js tests/nowhere-scenario.test.mjs
```
제안 메시지: `feat(tour): 시나리오 단계 그래프(건물 선택 · 입장 · 준비중)와 취소 가능한 실행기`

---

### Task 5: 카메라 컨트롤러 확장 `camera.js`

**Files:**
- Modify: `public/src/nowhere/camera.js`

**Interfaces:**
- Consumes: `buildFlightPath` 결과 형식(Task 1).
- Produces(컨트롤러 반환 객체에 추가): `flyTo(path) → Promise<'done'|'cancelled'>`, `stopFlight()`, `isFlying() → boolean`, `placeAt(pos: number[3], target: number[3])`, `setTerrain({ groundHeightAt, getWalkBlocker, walkFallback?: [x, z] })`, `setBounds({ x0, z0, x1, z1, yMin, yMax } | null)`. `startIntro(onEnd?)` — `onEnd(reason)`, reason ∈ `'complete' | 'skipped' | 'cancelled'`.

- [ ] **Step 1: 상태 변수 추가** — `let walkBlocker = null;` 바로 아래에 삽입

찾기:
```js
  let walkMode = false;
  let walkBlocker = null;
```
바꾸기:
```js
  let walkMode = false;
  let walkBlocker = null;
  // 실내 뷰가 지형 · 장애물 · 보행 대체 위치 · 카메라 영역을 바꿔 끼운다(setTerrain/setBounds)
  let walkFallback = [-72.0, 36.5];
  let bounds = null;
  // 시나리오 비행(flyTo) 상태와 인트로 종료 콜백
  let flight = null;
  let introOnEnd = null;
```

- [ ] **Step 2: 인트로 종료 콜백** — `cancelIntro`/`startIntro`/`onUserInterrupt` 교체

찾기:
```js
  function cancelIntro() {
    if (!introActive) return;
    introActive = false;
    controls.enabled = true;
  }

  function startIntro() {
    if (walkMode) setWalkMode(false);
    transition = null;
    introActive = true;
    introElapsed = 0;
    camera.fov = 44;
    camera.updateProjectionMatrix();
  }

  // 아무 입력(마우스/터치/휠/키보드)으로 인트로 즉시 건너뛰기
  const onUserInterrupt = () => {
    if (introActive) {
      cancelIntro();
      setPreset('street', true);
    }
  };
```
바꾸기:
```js
  // reason: 'complete'(끝까지 재생) | 'skipped'(사용자 입력으로 건너뜀) | 'cancelled'(프리셋 · 보행 등 다른 동작이 끊음)
  function cancelIntro(reason = 'cancelled') {
    if (!introActive) return;
    introActive = false;
    controls.enabled = true;
    const cb = introOnEnd;
    introOnEnd = null;
    if (typeof cb === 'function') cb(reason);
  }

  function startIntro(onEnd = null) {
    if (walkMode) setWalkMode(false);
    stopFlight();
    transition = null;
    introOnEnd = onEnd;
    introActive = true;
    introElapsed = 0;
    camera.fov = 44;
    camera.updateProjectionMatrix();
  }

  // 아무 입력(마우스/터치/휠/키보드)으로 인트로 즉시 건너뛰기
  const onUserInterrupt = () => {
    if (introActive) {
      cancelIntro('skipped');
      setPreset('street', true);
    }
  };
```

- [ ] **Step 3: 인트로 끝 처리** — `stepCamera` 의 인트로 완료 블록 교체

찾기:
```js
      if (t >= 1) {
        introActive = false;
        setPreset('street', true);
      }
      return;
    }
```
바꾸기:
```js
      if (t >= 1) {
        introActive = false;
        controls.enabled = true;
        setPreset('street', true);
        const cb = introOnEnd;
        introOnEnd = null;
        if (typeof cb === 'function') cb('complete');
      }
      return;
    }
```

- [ ] **Step 4: 비행 진행** — `stepCamera` 맨 앞에 비행 처리 삽입

찾기:
```js
  function stepCamera(dt) {
    if (introActive) {
```
바꾸기:
```js
  function stepCamera(dt) {
    if (flight) {
      flight.elapsed += dt;
      const t = Math.min(1, flight.elapsed / flight.duration);
      const u = t * t * (3 - 2 * t);
      flight.posCurve.getPoint(u, camera.position);
      flight.tgtCurve.getPoint(u, controls.target);
      controls.update();
      if (t >= 1) finishFlight('done');
      return;
    }
    if (introActive) {
```

- [ ] **Step 5: 비행 · 배치 · 지형 · 영역 함수 추가** — `function setPreset(id, instant = false) {` 바로 앞에 삽입

```js
  function finishFlight(result) {
    if (!flight) return;
    const done = flight.resolve;
    flight = null;
    controls.enabled = true;
    done(result);
  }

  function stopFlight() {
    finishFlight('cancelled');
  }

  /** 시나리오 비행: buildFlightPath 결과({ points, targets, duration })를 따라 이동. 끝나면 'done', 끊기면 'cancelled'. */
  function flyTo(path) {
    cancelIntro();
    if (walkMode) setWalkMode(false);
    stopFlight();
    transition = null;
    const toVecs = (arr) => arr.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    return new Promise((resolve) => {
      flight = {
        posCurve: new THREE.CatmullRomCurve3(toVecs(path.points), false, 'centripetal'),
        tgtCurve: new THREE.CatmullRomCurve3(toVecs(path.targets), false, 'centripetal'),
        duration: Math.max(0.1, path.duration),
        elapsed: 0,
        resolve,
      };
      controls.enabled = false;   // 비행 중에는 드래그 · 휠 입력을 받지 않는다
    });
  }

  /** 카메라를 즉시 그 자리 · 그 시선으로 옮긴다(실내 진입 · 나가기). */
  function placeAt(pos, target) {
    cancelIntro();
    stopFlight();
    transition = null;
    camera.position.fromArray(pos);
    controls.target.fromArray(target);
    controls.update();
  }

  /** 지면 높이 · 보행 장애물 · 보행 대체 시작점(x, z)을 바꿔 끼운다(실내 ↔ 외관). */
  function setTerrain({ groundHeightAt: g, getWalkBlocker: gb = null, walkFallback: wf = null }) {
    if (typeof g === 'function') groundHeightAt = g;
    getWalkBlocker = gb;
    walkBlocker = null;
    if (Array.isArray(wf)) walkFallback = wf;
  }

  /** 실내 궤도 카메라 영역(층 벽 · 천장 안쪽). null 이면 해제. */
  function setBounds(b) {
    bounds = b || null;
  }

  // 실내 궤도 카메라: 층 영역(벽 0.3 m 안쪽) · 천장 아래로 카메라와 시선 타깃을 묶는다
  function clampInsideBounds() {
    const m = 0.3;
    let moved = false;
    for (const v of [camera.position, controls.target]) {
      const x = Math.min(bounds.x1 - m, Math.max(bounds.x0 + m, v.x));
      const y = Math.min(bounds.yMax, Math.max(bounds.yMin, v.y));
      const z = Math.min(bounds.z1 - m, Math.max(bounds.z0 + m, v.z));
      if (x !== v.x || y !== v.y || z !== v.z) {
        v.set(x, y, z);
        moved = true;
      }
    }
    return moved;
  }

```

- [ ] **Step 6: 프리셋 · 보행이 비행을 끊고, 보행 대체 위치를 쓰게 한다**

찾기(`setPreset` 첫 줄):
```js
  function setPreset(id, instant = false) {
    cancelIntro();
```
바꾸기:
```js
  function setPreset(id, instant = false) {
    cancelIntro();
    stopFlight();
```

찾기(`setWalkMode` 첫 줄들):
```js
  function setWalkMode(enabled) {
    cancelIntro();
```
바꾸기:
```js
  function setWalkMode(enabled) {
    cancelIntro();
    stopFlight();
```

찾기:
```js
        camera.position.set(-72.0, 0, 36.5);
```
바꾸기:
```js
        camera.position.set(walkFallback[0], 0, walkFallback[1]);
```

- [ ] **Step 6-1: 비행 중 키 입력 무시(스펙 §1.1)** — 카메라 keydown 처리기 앞부분에 한 줄 추가

찾기:
```js
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (introActive && !e.metaKey && !e.ctrlKey) {
```
바꾸기:
```js
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (flight) return;   // 시나리오 비행 중 키 입력 무시(Esc 는 main.js 가 캡처 단계에서 먼저 받아 투어를 끝낸다)
    if (introActive && !e.metaKey && !e.ctrlKey) {
```

- [ ] **Step 7: 실내 영역 묶기** — `update` 끝에 추가

찾기:
```js
    if (!walkMode && clampAboveGround(camera.position, groundHeightAt, ORBIT_CLEARANCE)) {
      controls.update();
    }
  }
```
바꾸기:
```js
    if (!walkMode && clampAboveGround(camera.position, groundHeightAt, ORBIT_CLEARANCE)) {
      controls.update();
    }
    if (bounds && !walkMode && clampInsideBounds()) {
      controls.update();
    }
  }
```

- [ ] **Step 8: 반환 객체에 추가**

찾기:
```js
    startIntro,
    cancelIntro,
    focusWorldPoint,
    update,
  };
```
바꾸기:
```js
    startIntro,
    cancelIntro,
    focusWorldPoint,
    flyTo,
    stopFlight,
    isFlying: () => Boolean(flight),
    placeAt,
    setTerrain,
    setBounds,
    update,
  };
```

- [ ] **Step 9: 브라우저 확인** — 서버 실행 중 `http://localhost:4173/?ver=ds2&noIntro=1&cam=street` 를 열고 playwriter 로 실행

```js
// 1) 비행: 거리 시점 → HAUS 정면, 'done' 과 도착 위치
const r = await state.page.evaluate(async () => {
  const a = window.__NW_APP;
  const { buildFlightPath } = await import('/src/nowhere/flight.js');
  const { approachFor } = await import('/src/nowhere/tour-config.js');
  const to = approachFor(a.world.layout, 'haus');
  const res = await a.camCtrl.flyTo(buildFlightPath({ pos: a.camera.position.toArray(), target: a.controls.target.toArray() }, to));
  const p = a.camera.position;
  return { res, off: Math.hypot(p.x - to.pos[0], p.y - to.pos[1], p.z - to.pos[2]) };
});
// 2) 인트로 콜백: 끝까지 재생 'complete', 키 입력 'skipped'
const s = await state.page.evaluate(() => new Promise((res) => {
  const a = window.__NW_APP;
  a.camCtrl.startIntro((reason) => res(reason));
  setTimeout(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', code: 'KeyX' })), 500);
}));
console.log(JSON.stringify({ r, s }));
```
Expected: `{"r":{"res":"done","off":<0.5 이하},"s":"skipped"}`, 콘솔 오류 없음. 이어서 `npm test` → `# fail 0`.

- [ ] **Step 10: 스테이징 · 커밋 메시지 제안**

```bash
git add public/src/nowhere/camera.js
```
제안 메시지: `feat(camera): 시나리오 비행(flyTo) · 즉시 배치 · 지형/영역 교체, 인트로 종료 이유 콜백`

---

### Task 6: 분석 모드 제거

**Files:**
- Delete: `public/src/nowhere/analysis.js`
- Modify: `public/index.html`, `public/nowhere.html`, `public/nowhere-mountain.html`, `public/src/nowhere/nowhere.css`, `public/src/nowhere/main.js`, `public/src/nowhere/help.js`, `tests/nowhere-help.test.mjs`

**Interfaces:**
- Produces: 상단 바에서 `nw-btn-analysis` 가 사라지고 같은 자리에 `<button id="nw-btn-buildings" …>건물 이동</button>`(Task 9 에서 연결), `main.js` 의 `app` 에서 `analysis` 제거.

- [ ] **Step 1: 테스트를 먼저 바꾼다(분석 모드 키가 없어야 통과)** — `tests/nowhere-help.test.mjs` 의 (b) 를 통째로 교체

찾기(시작 줄부터 테스트 끝까지):
```js
test('(b) 코드에 바인딩된 단축키가 모두 안내에 실려 있다(키를 바꾸면 안내도 바꿔야 통과)', () => {
```
에서 그 테스트의 마지막 `});` 까지를 아래로 바꾼다:
```js
test('(b) 코드에 바인딩된 단축키가 모두 안내에 실려 있고, 분석 모드 키(F · [ · ])는 없다', () => {
  const keys = new Set(allKeys());
  for (const k of ['V', 'Esc', '?', 'W', 'A', 'S', 'D', 'Shift', 'Space', '↑', '↓', '←', '→', '휠', '클릭']) {
    assert.ok(keys.has(k), `안내에 '${k}' 없음`);
  }
  for (const k of ['F', '[', ']']) assert.equal(keys.has(k), false, `안내에 분석 모드 키 '${k}' 가 남아 있음`);
  const cam = readFileSync(new URL('../public/src/nowhere/camera.js', import.meta.url), 'utf8');
  const walk = readFileSync(new URL('../public/src/nowhere/walk.js', import.meta.url), 'utf8');
  const look = readFileSync(new URL('../public/src/nowhere/look.js', import.meta.url), 'utf8');
  assert.match(cam, /e\.key === 'v'/);
  assert.match(cam, /'Space'/);
  assert.match(cam, /requestPointerLock/);
  assert.match(walk, /ShiftLeft/);
  assert.match(look, /ArrowUp/);
  assert.equal(existsSync(new URL('../public/src/nowhere/analysis.js', import.meta.url)), false, 'analysis.js 가 남아 있음');
});
```
그리고 파일 맨 위 import 를 바꾼다:
```js
import { readFileSync, existsSync } from 'node:fs';
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/nowhere-help.test.mjs`
Expected: FAIL — `안내에 분석 모드 키 'F' 가 남아 있음`

- [ ] **Step 3: 조작 안내 행 정리** — `public/src/nowhere/help.js`

찾기:
```js
      { keys: ['V'], desc: '보행 시점 켜기 / 끄기' },
      { keys: ['F'], desc: '분석 모드 켜기 / 끄기 (보행 중에는 쓰지 않음)' },
      { keys: ['[', ']'], desc: '분석 모드에서 이전 / 다음 기록으로 이동' },
      { keys: ['Esc'], desc: '조작 안내 닫기 → 기록 카드 닫기 → 분석 종료. 보행 중에는 마우스 고정 해제 → 보행 해제' },
```
바꾸기:
```js
      { keys: ['V'], desc: '보행 시점 켜기 / 끄기' },
      { keys: ['Esc'], desc: '조작 안내 · 모달 닫기 → 투어 종료. 보행 중에는 마우스 고정 해제 → 보행 해제' },
```

- [ ] **Step 4: HTML 3개에서 분석 모드 마크업 제거 · 버튼 교체** — 아래 스크립트 실행(세 파일 각각 한 번씩 정확히 바뀌는지 검사)

```bash
python3 - <<'EOF'
import re
for f in ['public/index.html', 'public/nowhere.html', 'public/nowhere-mountain.html']:
    s = open(f, encoding='utf-8').read()
    btn = re.compile(r'      <button id="nw-btn-analysis" type="button" class="nw-btn" aria-pressed="false">\n        분석 모드<span class="nw-btn-kbd">F</span>\n      </button>\n')
    s, n1 = btn.subn('      <button id="nw-btn-buildings" type="button" class="nw-btn">\n        건물 이동\n      </button>\n', s)
    blk = re.compile(r'  <!-- 분석 모드 레이어 필터 -->\n.*?  </aside>\n\n', re.S)
    s, n2 = blk.subn('', s)
    assert (n1, n2) == (1, 1), (f, n1, n2)
    open(f, 'w', encoding='utf-8').write(s)
print('ok')
EOF
grep -c "nw-btn-analysis\|nw-filter-bar\|nw-card" public/index.html public/nowhere.html public/nowhere-mountain.html
```
Expected: `ok`, 세 파일 모두 `:0`

- [ ] **Step 5: CSS 에서 분석 모드 · 카드 스타일 제거**

```bash
python3 - <<'EOF'
p = 'public/src/nowhere/nowhere.css'
s = open(p, encoding='utf-8').read()
a = s.index('/* ── 분석 모드 오버레이 ── */')
b = s.index('/* ── 모바일 반응형')
s = s[:a] + s[b:]
a = s.index('  .nw-filter-bar {\n    top: 86px;')
b = s.index('  .nw-dock {\n    left: 8px;')
s = s[:a] + s[b:]
a = s.index('  .nw-card {\n    top: auto;')
b = s.index('    z-index: 40;\n  }\n', a) + len('    z-index: 40;\n  }\n')
s = s[:a] + s[b:]
open(p, 'w', encoding='utf-8').write(s)
print('ok')
EOF
grep -c "nw-card\|nw-filter\|nw-anchor\|nw-analysis\|is-analysis" public/src/nowhere/nowhere.css
```
Expected: `ok`, `0`

- [ ] **Step 6: `main.js` 에서 분석 모드 연결 제거** — 아래 찾아 바꾸기 4곳

찾기: `import { createAnalysisController } from './analysis.js';\n` → 바꾸기: (삭제)

찾기:
```js
    const cardThumbEl = document.getElementById('nw-card-thumb');
    if (cardThumbEl) cardThumbEl.src = 'assets/nowhere-ds2/renders/hero-street.webp';
    const loreTagEl = document.querySelector('.nw-card-section-tag.is-lore');
    if (loreTagEl) loreTagEl.textContent = '서사 · 허구 (DS2 고원)';
```
→ 바꾸기: (삭제)

찾기:
```js
  const analysis = await createAnalysisController({
    scene,
    camera,
    renderer,
    world,
    camCtrl,
    quality,
  });

```
→ 바꾸기: (삭제)

찾기: `    analysis.update(dt);\n` → 바꾸기: (삭제)

찾기: `    analysis,\n    help,` → 바꾸기: `    help,`

찾기:
```js
        analysisActive: analysis.isActive(),
        selectedAnchor: analysis.getSelectedId(),
```
→ 바꾸기: (삭제)

- [ ] **Step 7: 파일 삭제 · 남은 참조 확인**

```bash
git rm public/src/nowhere/analysis.js
grep -rn "analysis\.\|createAnalysisController\|nw-btn-analysis" public/src/nowhere public/*.html
```
Expected: 출력 없음(셰이더 · 후처리의 `uAnalysis` 유니폼은 남겨 둔다 — 스펙 §1.4)

- [ ] **Step 8: 통과 확인 · 브라우저 확인**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# fail 0`
브라우저: `?ver=ds2&noIntro=1` · `?ver=seongsu&noIntro=1` 를 열어 콘솔 오류 없음, 상단 바에 `건물 이동` 버튼이 보이고 `F` 키가 아무 것도 하지 않음을 확인.

- [ ] **Step 9: 스테이징 · 커밋 메시지 제안**

```bash
git add public/index.html public/nowhere.html public/nowhere-mountain.html public/src/nowhere/nowhere.css public/src/nowhere/main.js public/src/nowhere/help.js tests/nowhere-help.test.mjs
```
(`git rm` 으로 `analysis.js` 삭제는 이미 스테이징됨)
제안 메시지: `refactor(ui): 분석 모드 제거(UI · 단축키 F · [ ] · 기록 카드) — 시나리오 투어로 대체 예정`

---

### Task 7: 실내 1F 로비 빌드 `inner_build.py`

**Files:**
- Create: `tools/nowhere/blender/inner_build.py`
- Modify: `package.json`(scripts)
- Test: `tests/nowhere-inner.test.mjs`
- 산출(스테이징 대상): `public/assets/nowhere-inner/inner-layout.json`, `inner-1.glb`, `mobile/inner-1.glb`, `env-1k.hdr`, `renders/inner-1.webp`

**Interfaces:**
- Produces: `inner-layout.json` = `{ building: 'haus', defaultFloor: '1', env: 'assets/nowhere-inner/env-1k.hdr', floors: [Floor] }`, `Floor = { id, label, glb, mobileGlb, elevation, bounds: [x0, z0, x1, z1], ceiling, entry?: { pos, target }, spawn: { pos, target }, exit?: { pos, radius }, elevator: { pos, radius }, exhibits: [{ id, title, desc, pos }], tour: [{ pos, target, caption, duration }] }`(Three 좌표). GLB 노드 이름 규칙: 바닥 `IN_floor*`, 천장 `IN_ceiling*`, 그 밖 벽 · 유리 · 기둥 · 코어 `IN_*`, 전시물 `EX_*`.

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/nowhere-inner.test.mjs`

```js
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
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/nowhere-inner.test.mjs`
Expected: FAIL — `inner-layout.json 없음 — npm run nowhere:inner:build 실행 필요`

- [ ] **Step 3: 빌드 스크립트 작성** — `tools/nowhere/blender/inner_build.py`

```python
# HAUS NOWHERE — 성수(HAUS NOWHERE) 실내 뷰 / 층별 전시 공간 빌드 (1단계: 1F 로비).
# 실행: /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python tools/nowhere/blender/inner_build.py
# 산출: build/nowhere/raw-inner/inner-<층>.glb · public/assets/nowhere-inner/{inner-layout.json, env-1k.hdr, renders/inner-<층>.webp}
# 좌표: Blender Z-up m, 층 원점 = 바닥 중앙. 웹(Three.js)은 (x, z, −y).
# 노드 이름 규칙(웹 interior.js 가 씀): 바닥 IN_floor*, 천장 IN_ceiling*, 벽 · 유리 · 기둥 · 코어 IN_*, 전시물 EX_*.
import bpy, bmesh, os, math, json, time
from mathutils import Vector, Matrix

ROOT = os.environ.get('NW_ROOT', '/Users/gm_yeonho/new-work/so/so-viewer-monster1267')
SRC = os.path.join(ROOT, 'public', 'assets', 'inner')
RAW = os.path.join(ROOT, 'build', 'nowhere', 'raw-inner')
PUB = os.path.join(ROOT, 'public', 'assets', 'nowhere-inner')
MAX_TRIS = 50000      # 전시물 하나당 삼각형 상한(넘으면 Decimate)


def to_three(v):
    return [round(float(v[0]), 3), round(float(v[2]), 3), round(float(-v[1]), 3)]


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = 'METRIC'
    return sc


def coll(name):
    sc = bpy.context.scene
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if c.name not in sc.collection.children:
        sc.collection.children.link(c)
    return c


def _lin(hexcol):
    h = hexcol.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return out


def mat_flat(name, hexcol, rough=0.85, metal=0.0, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*_lin(hexcol), 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if alpha < 1.0:
        bsdf.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'BLENDED'
    return m


def mat_tiled(name, diffuse, normal, tile=2.0, rough=0.6):
    """바닥 재질: 원본 텍스처를 tile m 간격으로 반복(glTF KHR_texture_transform 으로 내보내짐)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Roughness'].default_value = rough
    uv = nt.nodes.new('ShaderNodeUVMap')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1.0 / tile, 1.0 / tile, 1.0)
    nt.links.new(uv.outputs['UV'], mp.inputs['Vector'])
    td = nt.nodes.new('ShaderNodeTexImage')
    td.image = bpy.data.images.load(diffuse, check_existing=True)
    nt.links.new(mp.outputs['Vector'], td.inputs['Vector'])
    nt.links.new(td.outputs['Color'], bsdf.inputs['Base Color'])
    tn = nt.nodes.new('ShaderNodeTexImage')
    tn.image = bpy.data.images.load(normal, check_existing=True)
    tn.image.colorspace_settings.name = 'Non-Color'
    nt.links.new(mp.outputs['Vector'], tn.inputs['Vector'])
    nm = nt.nodes.new('ShaderNodeNormalMap')
    nt.links.new(tn.outputs['Color'], nm.inputs['Color'])
    nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    return m


def box(name, c, x0, y0, z0, x1, y1, z1, mat):
    """축 정렬 상자(면 주축 박스 투영 UV, m 단위)."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((x0 if v.co.x < 0 else x1, y0 if v.co.y < 0 else y1, z0 if v.co.z < 0 else z1))
    bm.normal_update()
    uv = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        ax = max(range(3), key=lambda i: abs(f.normal[i]))
        for lp in f.loops:
            co = lp.vert.co
            lp[uv].uv = (co.y, co.z) if ax == 0 else (co.x, co.z) if ax == 1 else (co.x, co.y)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me)
    c.objects.link(o)
    return o


def import_prop(rel, name, c, loc, height=None, width=None, rz=0.0):
    """inner 에셋(Draco GLB)을 불러와 하나로 합치고, 바닥 중앙 원점 · 목표 높이(또는 폭) 축척 · 회전 · 위치 · 감축."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, rel))
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in new:
        if o.name in bpy.data.objects and o != obj and o.type != 'MESH':
            bpy.data.objects.remove(o, do_unlink=True)
    for uc in list(obj.users_collection):
        uc.objects.unlink(obj)
    c.objects.link(obj)
    xs = [v.co.x for v in obj.data.vertices]
    ys = [v.co.y for v in obj.data.vertices]
    zs = [v.co.z for v in obj.data.vertices]
    size = (max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs))
    s = height / size[2] if height else width / max(size[0], size[1])
    off = Vector(((max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2, min(zs)))
    obj.data.transform(Matrix.Translation(-off))
    obj.data.transform(Matrix.Scale(s, 4))
    obj.location = loc
    obj.rotation_euler = (0.0, 0.0, math.radians(rz))
    tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    if tris > MAX_TRIS:
        mod = obj.modifiers.new('decimate', 'DECIMATE')
        mod.ratio = MAX_TRIS / tris
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.name = name
    obj.data.name = name
    return obj


# ═════════════ 1F 로비 ═════════════
# Blender 평면: x −17…17, y −17…21(남측 y −17 정문, 북측 y +21 엘리베이터 코어), 층고 6 m.
FLOOR_1 = {
    'id': '1', 'label': '1F 로비',
    'glb': 'assets/nowhere-inner/inner-1.glb', 'mobileGlb': 'assets/nowhere-inner/mobile/inner-1.glb',
    'elevation': 0.0, 'bounds_bl': (-17.0, -17.0, 17.0, 21.0), 'ceiling': 6.0,
    'entry': ((0.0, -13.0, 1.7), (0.0, 0.0, 2.5)),
    'spawn': ((0.0, 15.0, 1.7), (0.0, 0.0, 2.5)),
    'exit': ((0.0, -16.0, 0.0), 2.0),
    'elevator': ((0.0, 19.0, 0.0), 2.5),
    'exhibits': [
        ('city_model', '성수 도시 모형', 'HAUS NOWHERE 미니어처와 성수의 그래피티 건물들', (0.0, 0.0, 1.5)),
        ('dj', 'DJ 부스', '로비의 사운드 설치물', (10.5, 9.0, 1.2)),
        ('display', '디스플레이 월', 'HAUS NOWHERE SEOUL · 현재 시각 · 기상', (-16.4, 6.0, 2.4)),
    ],
    'tour': [
        ((6.0, -8.0, 2.2), (0.0, 0.0, 1.8), '성수 도시 모형 — HAUS NOWHERE 와 성수 골목', 5),
        ((4.0, 3.0, 1.8), (10.5, 9.0, 1.2), 'DJ 부스 — 로비의 사운드 설치물', 4),
        ((-8.0, 2.0, 2.4), (-16.4, 6.0, 2.4), '디스플레이 월', 4),
    ],
}


def build_floor_1(c, M):
    X0, Y0, X1, Y1 = FLOOR_1['bounds_bl']
    H = FLOOR_1['ceiling']
    T = 0.3
    box('IN_floor', c, X0 - T, Y0 - T, -0.2, X1 + T, Y1 + T, 0.0, M['floor_1'])
    box('IN_ceiling', c, X0 - T, Y0 - T, H, X1 + T, Y1 + T, H + 0.2, M['ceiling'])
    # 외관 포디움과 같은 가로 띠창(솔리드 · 유리 띠 교차)
    bands = [(0.0, 1.0, 'wall'), (1.0, 2.6, 'glass'), (2.6, 3.6, 'wall'), (3.6, 5.0, 'glass'), (5.0, H, 'wall')]

    def ribbon(tag, x0, y0, x1, y1):
        for i, (z0, z1, kind) in enumerate(bands):
            mat = M['concrete'] if kind == 'wall' else M['glass']
            pre = 'IN_wall' if kind == 'wall' else 'IN_glass'
            box(f'{pre}_{tag}_{i}', c, x0, y0, z0, x1, y1, z1, mat)

    # 남측: 정문 열림(x −3…3, z 0…3.4) 양옆 띠창 + 문 위 인방 · 유리 · 벽
    ribbon('sw', X0 - T, Y0 - T, -3.0, Y0)
    ribbon('se', 3.0, Y0 - T, X1 + T, Y0)
    box('IN_wall_s_lintel', c, -3.0, Y0 - T, 3.4, 3.0, Y0, 3.6, M['concrete'])
    box('IN_glass_s_top', c, -3.0, Y0 - T, 3.6, 3.0, Y0, 5.0, M['glass'])
    box('IN_wall_s_top', c, -3.0, Y0 - T, 5.0, 3.0, Y0, H, M['concrete'])
    # 서 · 동: 띠창, 북: 막힌 벽 + 엘리베이터 코어
    ribbon('w', X0 - T, Y0, X0, Y1)
    ribbon('e', X1, Y0, X1 + T, Y1)
    box('IN_wall_n', c, X0 - T, Y1, 0.0, X1 + T, Y1 + T, H, M['concrete'])
    box('IN_core', c, -5.0, 19.5, 0.0, 5.0, Y1, H, M['core'])
    for i, (x, y) in enumerate(((-11.0, -6.0), (11.0, -6.0), (-11.0, 9.0), (11.0, 9.0))):
        box(f'IN_column_{i}', c, x - 0.4, y - 0.4, 0.0, x + 0.4, y + 0.4, H, M['concrete'])
    # 성수 도시 모형: 받침대(높이 0.8 m) 위 HAUS NOWHERE 미니어처 + 그래피티 건물 3종
    box('EX_plinth', c, -4.5, -3.0, 0.0, 4.5, 3.0, 0.8, M['plinth'])
    P = 0.8
    import_prop('main/office_building.glb', 'EX_city_haus', c, (0.0, 0.0, P), height=3.0)
    import_prop('etc/building_1.glb', 'EX_city_b1', c, (-2.9, -1.2, P), height=1.6, rz=90)
    import_prop('etc/building_2.glb', 'EX_city_b2', c, (2.9, -1.5, P), height=1.4, rz=-90)
    import_prop('etc/building_3.glb', 'EX_city_b3', c, (2.8, 1.7, P), height=1.9, rz=180)
    import_prop('main/DJ.glb', 'EX_dj', c, (10.5, 9.0, 0.0), height=2.4, rz=135)
    import_prop('main/display.glb', 'EX_display', c, (-16.4, 6.0, 0.0), width=6.0, rz=90)
    import_prop('main/door_1.glb', 'EX_elevator_l', c, (-2.5, 19.45, 0.0), height=2.6)
    import_prop('main/door_1.glb', 'EX_elevator_r', c, (2.5, 19.45, 0.0), height=2.6)


def floor_json(F):
    x0, y0, x1, y1 = F['bounds_bl']
    j = {
        'id': F['id'], 'label': F['label'], 'glb': F['glb'], 'mobileGlb': F['mobileGlb'],
        'elevation': F['elevation'], 'bounds': [x0, -y1, x1, -y0], 'ceiling': F['ceiling'],
        'spawn': {'pos': to_three(F['spawn'][0]), 'target': to_three(F['spawn'][1])},
        'elevator': {'pos': to_three(F['elevator'][0]), 'radius': F['elevator'][1]},
        'exhibits': [{'id': i, 'title': t, 'desc': d, 'pos': to_three(p)} for i, t, d, p in F['exhibits']],
        'tour': [{'pos': to_three(p), 'target': to_three(q), 'caption': cap, 'duration': dur} for p, q, cap, dur in F['tour']],
    }
    if 'entry' in F:
        j['entry'] = {'pos': to_three(F['entry'][0]), 'target': to_three(F['entry'][1])}
    if 'exit' in F:
        j['exit'] = {'pos': to_three(F['exit'][0]), 'radius': F['exit'][1]}
    return j


def export_floor(c, path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in c.all_objects:
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
        export_cameras=False, export_lights=False, export_extras=False, export_image_format='AUTO',
    )
    print(f'[inner_build] exported {path} ({os.path.getsize(path) / 1048576:.2f} MB)')


def render_preview(F, png):
    sc = bpy.context.scene
    try:
        sc.render.engine = 'BLENDER_EEVEE'
    except TypeError:
        sc.render.engine = 'BLENDER_EEVEE_NEXT'
    w = bpy.data.worlds.new('IN_world')
    w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs['Color'].default_value = (*_lin('#C9CECD'), 1.0)
    bg.inputs['Strength'].default_value = 1.0
    sc.world = w
    ld = bpy.data.lights.new('IN_key', 'AREA')
    ld.energy = 2500.0
    ld.size = 20.0
    lo = bpy.data.objects.new('IN_key', ld)
    sc.collection.objects.link(lo)
    lo.location = (0.0, 2.0, F['ceiling'] - 0.3)
    cd = bpy.data.cameras.new('IN_cam')
    cd.lens = 22.0
    cam = bpy.data.objects.new('IN_cam', cd)
    sc.collection.objects.link(cam)
    pos, tgt = F['entry'] if 'entry' in F else F['spawn']
    cam.location = pos
    cam.rotation_euler = (Vector(tgt) - Vector(pos)).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = 1280, 720
    sc.render.filepath = png
    bpy.ops.render.render(write_still=True)
    im = bpy.data.images.load(png)
    im.filepath_raw = os.path.join(PUB, 'renders', f"inner-{F['id']}.webp")
    im.file_format = 'WEBP'
    im.save()


def export_env():
    im = bpy.data.images.load(os.path.join(SRC, 'env', 'modern_bathroom_1k.exr'))
    im.filepath_raw = os.path.join(PUB, 'env-1k.hdr')
    im.file_format = 'HDR'
    im.save()


def main():
    t0 = time.time()
    reset_scene()
    for d in (RAW, PUB, os.path.join(PUB, 'renders'), os.path.join(PUB, 'mobile')):
        os.makedirs(d, exist_ok=True)
    M = {
        'floor_1': mat_tiled('IN_floor_1', os.path.join(SRC, 'main', 'floor_diffuse.png'), os.path.join(SRC, 'main', 'floor_normal.png'), tile=1.2, rough=0.35),
        'concrete': mat_flat('IN_concrete', '#CFCBC3', 0.9),
        'ceiling': mat_flat('IN_ceiling_mat', '#E4E1DA', 0.95),
        'core': mat_flat('IN_core_mat', '#3A3B3D', 0.7),
        'plinth': mat_flat('IN_plinth_mat', '#2B2C2E', 0.6),
        'glass': mat_flat('IN_glass_mat', '#B9C7CC', 0.05, 0.0, alpha=0.22),
    }
    floors = []
    for F, builder in ((FLOOR_1, build_floor_1),):
        c = coll(f"INNER_{F['id']}")
        builder(c, M)
        export_floor(c, os.path.join(RAW, f"inner-{F['id']}.glb"))
        render_preview(F, os.path.join(ROOT, 'build', 'nowhere', 'renders', f"inner-{F['id']}.png"))
        floors.append(floor_json(F))
    export_env()
    layout = {'building': 'haus', 'defaultFloor': '1', 'env': 'assets/nowhere-inner/env-1k.hdr', 'floors': floors}
    with open(os.path.join(PUB, 'inner-layout.json'), 'w', encoding='utf-8') as f:
        json.dump(layout, f, ensure_ascii=False, indent=2)
    print(f'[inner_build] done in {round(time.time() - t0, 1)} s')


if __name__ == '__main__':
    main()
```

- [ ] **Step 4: npm 스크립트 추가** — `package.json` 의 `"test": …` 줄 바로 위에 두 줄 삽입(쉼표 유지)

```json
    "nowhere:inner:build": "/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python tools/nowhere/blender/inner_build.py",
    "nowhere:inner:optimize": "mkdir -p public/assets/nowhere-inner/mobile && for F in 1; do npx -y @gltf-transform/cli@4.1.1 optimize build/nowhere/raw-inner/inner-$F.glb public/assets/nowhere-inner/inner-$F.glb --compress meshopt --texture-compress webp --texture-size 1024 --instance false --join false --flatten false --palette false --simplify false && npx -y @gltf-transform/cli@4.1.1 optimize build/nowhere/raw-inner/inner-$F.glb public/assets/nowhere-inner/mobile/inner-$F.glb --compress meshopt --texture-compress webp --texture-size 512 --instance false --join false --flatten false --palette false --simplify false || exit 1; done",
```
확인: `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('ok')"` → `ok`

- [ ] **Step 5: 빌드 · 최적화 실행**

Run: `npm run nowhere:inner:build 2>&1 | grep "inner_build" && npm run nowhere:inner:optimize 2>&1 | tail -3`
Expected: `[inner_build] exported …/inner-1.glb (… MB)`, `[inner_build] done in … s`, 최적화 로그에 `inner-1.glb (… MB) → inner-1.glb (… MB)` 두 줄(데스크톱 · 모바일)

- [ ] **Step 6: 미리보기로 배치 · 방향 확인(필요하면 rz 조정 후 Step 5 재실행)**

`build/nowhere/renders/inner-1.png` 를 열어 확인한다(Read 도구로 이미지 보기):
- 받침대 위 HAUS NOWHERE 미니어처가 중앙, 그래피티 건물 3채가 정면 · 측면을 바깥으로 향함
- 디스플레이 화면 면이 로비 안쪽(+x)을 향함, DJ 부스 조작면이 로비 중앙을 향함
- 엘리베이터 문 두 짝이 북측 코어 앞에서 로비 쪽(−y)을 향함
방향이 반대면 해당 `import_prop` 의 `rz` 에 180 을 더하고(옆을 보면 ±90), Step 5 부터 다시 실행한다. 라이브 Blender(MCP)로 열어 `look` 으로 확인해도 된다: `bpy.ops.wm.open_mainfile` 대신 `exec(open('tools/nowhere/blender/inner_build.py').read(), {'__name__': '__main__'})` 를 MCP 로 실행한 뒤 `CAM` 시점 확인.

- [ ] **Step 7: 통과 확인**

Run: `node --test tests/nowhere-inner.test.mjs && npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: 실내 테스트 `# pass 3`, 전체 `# fail 0`

- [ ] **Step 8: 스테이징 · 커밋 메시지 제안**

```bash
git add tools/nowhere/blender/inner_build.py package.json tests/nowhere-inner.test.mjs public/assets/nowhere-inner/inner-layout.json public/assets/nowhere-inner/inner-1.glb public/assets/nowhere-inner/mobile/inner-1.glb public/assets/nowhere-inner/env-1k.hdr public/assets/nowhere-inner/renders/inner-1.webp
```
제안 메시지: `feat(inner): HAUS NOWHERE 1F 로비 실내 빌드(성수 도시 모형 · DJ · 디스플레이 · 엘리베이터 코어)와 inner-layout.json`

---

### Task 8: 실내 뷰 `interior.js` (+ 래스터화 공유 `terrain-mesh.js`)

**Files:**
- Create: `public/src/nowhere/terrain-mesh.js`, `public/src/nowhere/interior.js`
- Modify: `public/src/nowhere/world.js`(래스터화 코드 이동), `public/src/nowhere/nowhere.css`(화면 전환 · 실내 HUD)

**Interfaces:**
- Consumes: Task 5 의 `camCtrl.placeAt/setTerrain/setBounds/setWalkMode/stopFlight/isWalkMode`, Task 3 의 `modal.show/isOpen`, Task 2 의 `approachFor`, Task 7 의 `inner-layout.json` · 노드 이름 규칙, `post.renderPass`.
- Produces:
  - `terrain-mesh.js`: `forEachWorldTriangle(mesh, fn)`, `rasterizeMeshes(meshes, pickGrids: (ax, az) => HeightGrid[])`, `markObstacleMeshes(occ, meshes, groundAt) → number`(삼각형 수).
  - `interior.js`: `createInterior({ renderer, camera, camCtrl, post, world, quality, modal, exteriorScene, onChange? }) → { enter(buildingId) → Promise<boolean>, exit() → Promise<void>, update(dt), isActive(), currentFloor(), scene }`.

- [ ] **Step 1: 리팩터 전 기준값 기록(브라우저)** — `?ver=ds2&noIntro=1&cam=street` 에서

```js
const before = await state.page.evaluate(() => {
  const a = window.__NW_APP;
  const pts = [[0, 0], [40, -20], [-60, -80], [30, -400], [-200, 100]];
  const wb = a.world.getWalkBlocker();
  let blocked = 0;
  for (let x = -60; x < 60; x += 0.5) for (let z = -60; z < 60; z += 0.5) if (wb.isBlocked(x, z, 0, 0)) blocked++;
  return { h: pts.map(([x, z]) => +a.world.groundHeightAt(x, z).toFixed(4)), blocked };
});
console.log(JSON.stringify(before));
```
출력 값을 적어 둔다(Step 4 에서 같은지 비교).

- [ ] **Step 2: `terrain-mesh.js` 작성**

```js
// HAUS NOWHERE — three 메시 → 지형 높이 격자 · 보행 장애물 격자 래스터화(외관 world.js 와 실내 interior.js 가 공유).
import * as THREE from 'three';
import { rasterizeTriangle, markObstacleTriangle } from './terrain.js';

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _inst = new THREE.Matrix4();

/** 메시의 월드 좌표 삼각형마다 fn(ax, ay, az, bx, by, bz, cx, cy, cz) — 인덱스 · 인스턴싱 모두 처리. */
export function forEachWorldTriangle(mesh, fn) {
  const pos = mesh.geometry?.attributes?.position;
  if (!pos) return;
  mesh.updateWorldMatrix(true, false);
  const idx = mesh.geometry.index;
  const triCount = idx ? idx.count / 3 : pos.count / 3;
  const count = mesh.isInstancedMesh ? mesh.count : 1;
  for (let k = 0; k < count; k++) {
    if (mesh.isInstancedMesh) {
      mesh.getMatrixAt(k, _inst);
      _m.multiplyMatrices(mesh.matrixWorld, _inst);
    } else {
      _m.copy(mesh.matrixWorld);
    }
    for (let t = 0; t < triCount; t++) {
      _a.fromBufferAttribute(pos, idx ? idx.getX(t * 3) : t * 3).applyMatrix4(_m);
      _b.fromBufferAttribute(pos, idx ? idx.getX(t * 3 + 1) : t * 3 + 1).applyMatrix4(_m);
      _c.fromBufferAttribute(pos, idx ? idx.getX(t * 3 + 2) : t * 3 + 2).applyMatrix4(_m);
      fn(_a.x, _a.y, _a.z, _b.x, _b.y, _b.z, _c.x, _c.y, _c.z);
    }
  }
}

/** 메시들을 높이 격자에 래스터화. pickGrids(ax, az) 가 그 삼각형을 넣을 격자 목록을 고른다. */
export function rasterizeMeshes(meshes, pickGrids) {
  for (const mesh of meshes) {
    forEachWorldTriangle(mesh, (ax, ay, az, bx, by, bz, cx, cy, cz) => {
      for (const g of pickGrids(ax, az)) rasterizeTriangle(g, ax, ay, az, bx, by, bz, cx, cy, cz);
    });
  }
}

/** 메시들의 몸통 높이 부분을 장애물 격자에 기록하고 처리한 삼각형 수를 돌려준다. */
export function markObstacleMeshes(occ, meshes, groundAt) {
  let tris = 0;
  for (const mesh of meshes) {
    forEachWorldTriangle(mesh, (ax, ay, az, bx, by, bz, cx, cy, cz) => {
      markObstacleTriangle(occ, ax, ay, az, bx, by, bz, cx, cy, cz, groundAt);
      tris++;
    });
  }
  return tris;
}
```

- [ ] **Step 3: `world.js` 가 공유 함수를 쓰게 바꾼다**

import 찾기:
```js
import {
  createHeightGrid,
  rasterizeTriangle,
  createGroundQuery,
  createOccupancyGrid,
  markObstacleTriangle,
  isBlockedAt,
  obstacleTopAt,
} from './terrain.js';
```
바꾸기:
```js
import { createHeightGrid, createGroundQuery, createOccupancyGrid, isBlockedAt, obstacleTopAt } from './terrain.js';
import { rasterizeMeshes, markObstacleMeshes } from './terrain-mesh.js';
```

찾기(`const _va = new THREE.Vector3();` 부터 `const groundHeightAt = createGroundQuery([fineGrid, coarseGrid], 0);` 까지):
```js
  const _va = new THREE.Vector3();
  const _vb = new THREE.Vector3();
  const _vc = new THREE.Vector3();
  function rasterizeMesh(mesh) {
```
… 에서 …
```js
  layerGroups.backdrop?.traverse((n) => {
    if (n.isMesh && !n.isInstancedMesh && BACKDROP_GROUND.test(n.name)) rasterizeMesh(n);
  });
  const groundHeightAt = createGroundQuery([fineGrid, coarseGrid], 0);
```
까지를 아래로 바꾼다:
```js
  const pickGrids = (ax, az) => (Math.max(Math.abs(ax), Math.abs(az)) < 1400 ? [fineGrid, coarseGrid] : [coarseGrid]);
  const groundMeshes = [];
  layerGroups.ground?.traverse((n) => {
    if (n.isMesh && !n.isInstancedMesh) groundMeshes.push(n);
  });
  layerGroups.backdrop?.traverse((n) => {
    if (n.isMesh && !n.isInstancedMesh && BACKDROP_GROUND.test(n.name)) groundMeshes.push(n);
  });
  rasterizeMeshes(groundMeshes, pickGrids);
  const groundHeightAt = createGroundQuery([fineGrid, coarseGrid], 0);
```

`getWalkBlocker` 안에서 찾기(`const tmpM = new THREE.Matrix4();` 부터 백드롭 traverse 끝까지):
```js
    const tmpM = new THREE.Matrix4();
    const instM = new THREE.Matrix4();
    let tris = 0;
    const markMesh = (mesh) => {
```
… 에서 …
```js
    layerGroups.backdrop?.traverse((n) => {
      if (n.isMesh && /^BD_(tors|mid_)/.test(n.name)) markMesh(n);
    });
```
까지를 아래로 바꾼다:
```js
    const obstacleMeshes = [];
    const pick = (n) => {
      if (!n.isMesh || !n.visible) return;
      if (PASS_SURFACES.has(n.userData?.nw_surface) || /^FU_drone/.test(n.name)) return;
      obstacleMeshes.push(n);
    };
    for (const key of ['ground', 'present', 'future', 'building_haus', 'building_facearch']) {
      layerGroups[key]?.traverse(pick);
    }
    layerGroups.backdrop?.traverse((n) => {
      if (/^BD_(tors|mid_)/.test(n.name)) pick(n);
    });
    const tris = markObstacleMeshes(occ, obstacleMeshes, groundHeightAt);
```

- [ ] **Step 4: 리팩터 결과 비교(브라우저)** — 페이지를 새로 고친 뒤 Step 1 스크립트를 다시 실행

Expected: Step 1 과 `h` 배열 · `blocked` 값이 모두 같다. 다르면 Step 3 를 되돌리고 차이를 찾는다.

- [ ] **Step 5: `interior.js` 작성**

```js
// HAUS NOWHERE — 성수(HAUS NOWHERE) 실내 뷰: 별도 실내 씬 · 층 GLB/HDRI 불러오기 · 진입/나가기 화면 전환 ·
// 실내 보행 지형(바닥 = 높이 격자, 바닥 · 천장 밖 = 장애물) · 1F 정문 출구 모달 · 실내 HUD.
// 외관과 같은 후처리(composer)를 쓰고 renderPass.scene 만 바꿔 끼운다. 레이아웃: assets/nowhere-inner/inner-layout.json
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { createHeightGrid, createGroundQuery, createOccupancyGrid, isBlockedAt, obstacleTopAt } from './terrain.js';
import { rasterizeMeshes, markObstacleMeshes } from './terrain-mesh.js';
import { approachFor } from './tour-config.js';

export const INNER_LAYOUT_URL = 'assets/nowhere-inner/inner-layout.json';
const FADE_MS = 600;
const EXTERIOR_WALK_FALLBACK = [-72.0, 36.5];

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// 노드 이름(자기 + 조상)에 규칙 이름이 있는지 — glTF 메시는 이름 붙은 노드 아래 자식으로 올 수 있다
function nameChain(n) {
  let s = '';
  for (let p = n; p; p = p.parent) s += `${p.name || ''}|`;
  return s;
}

export function createInterior({ renderer, camera, camCtrl, post, world, quality, modal, exteriorScene, onChange = null }) {
  const scene = new THREE.Scene();
  scene.name = 'NW_Interior';
  scene.background = new THREE.Color('#C9CECD');
  scene.add(new THREE.HemisphereLight('#F4F1EA', '#3A2A26', 1.1));
  const key = new THREE.DirectionalLight('#FFF4E6', 1.2);
  key.position.set(-8, 14, 10);
  scene.add(key);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);

  let layout = null;
  let envReady = false;
  const floorCache = new Map();
  let active = false;
  let busy = false;
  let floorDef = null;
  let floorRoot = null;
  let exitArmed = true;

  // 화면 전환(검게) + 실내 HUD
  const fade = el('div', 'nw-fade');
  const fadeText = el('div', 'nw-fade-text');
  fade.append(fadeText);
  document.body.append(fade);
  const hud = el('div', 'nw-interior-hud');
  hud.hidden = true;
  const floorLabel = el('div', 'nw-interior-floor');
  const exitBtn = el('button', 'nw-btn nw-interior-exit');
  exitBtn.type = 'button';
  const icon = document.createElement('img');
  icon.src = 'assets/inner/icons/home.svg';
  icon.alt = '';
  exitBtn.append(icon, document.createTextNode('밖으로 나가기'));
  hud.append(floorLabel, exitBtn);
  document.body.append(hud);
  exitBtn.addEventListener('click', () => exit());

  const fadeTo = (on, text = '') =>
    new Promise((res) => {
      fadeText.textContent = text;
      fade.classList.toggle('is-on', on);
      setTimeout(res, FADE_MS);
    });

  async function loadLayout() {
    if (!layout) {
      const r = await fetch(INNER_LAYOUT_URL);
      if (!r.ok) throw new Error(`inner-layout.json ${r.status}`);
      layout = await r.json();
    }
    return layout;
  }

  async function loadEnv() {
    if (envReady) return;
    const hdr = await new RGBELoader().loadAsync(layout.env);
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = pmrem.fromEquirectangular(hdr).texture;
    scene.environmentIntensity = 0.9;
    hdr.dispose();
    envReady = true;
  }

  async function loadFloor(def, onProgress) {
    if (floorCache.has(def.id)) return floorCache.get(def.id);
    const url = quality.tier === 'mobile' && def.mobileGlb ? def.mobileGlb : def.glb;
    const gltf = await loader.loadAsync(url, (e) => {
      if (e.total) onProgress(e.loaded / e.total);
    });
    const root = gltf.scene;
    root.name = `NW_InnerFloor_${def.id}`;
    root.updateMatrixWorld(true);
    const floors = [];
    const solids = [];
    root.traverse((n) => {
      if (!n.isMesh) return;
      const chain = nameChain(n);
      if (/IN_floor/.test(chain)) floors.push(n);
      else if (!/IN_ceiling/.test(chain)) solids.push(n);
    });
    const [x0, z0, x1, z1] = def.bounds;
    const grid = createHeightGrid({ x0: x0 - 1, z0: z0 - 1, x1: x1 + 1, z1: z1 + 1, cell: 0.5 });
    rasterizeMeshes(floors, () => [grid]);
    const groundAt = createGroundQuery([grid], 0);
    const occ = createOccupancyGrid({ x0: x0 - 1, z0: z0 - 1, x1: x1 + 1, z1: z1 + 1, cell: 0.25 });
    markObstacleMeshes(occ, solids, groundAt);
    const blocker = {
      isBlocked: (x, z, clearance = 0, radius = 0.35) => isBlockedAt(occ, x, z, radius, clearance),
      topAt: (x, z, radius = 0.2) => obstacleTopAt(occ, x, z, radius),
    };
    const entry = { root, groundAt, blocker };
    floorCache.set(def.id, entry);
    return entry;
  }

  function showFloor(def, entry) {
    if (floorRoot) scene.remove(floorRoot);
    floorRoot = entry.root;
    scene.add(floorRoot);
    floorDef = def;
    floorLabel.textContent = def.label;
    camCtrl.setTerrain({
      groundHeightAt: entry.groundAt,
      getWalkBlocker: () => entry.blocker,
      walkFallback: [def.spawn.pos[0], def.spawn.pos[2]],
    });
    const [x0, z0, x1, z1] = def.bounds;
    camCtrl.setBounds({ x0, z0, x1, z1, yMin: 0.4, yMax: def.ceiling - 0.3 });
  }

  /** 성수 실내 1F 로 들어간다. 성공하면 true, 실패 후 닫으면 false. */
  async function enter(buildingId = 'haus') {
    if (active || busy) return false;
    busy = true;
    try {
      await fadeTo(true, '실내로 들어가는 중…');
      await loadLayout();
      if (layout.building !== buildingId) throw new Error(`실내 없음: ${buildingId}`);
      const def = layout.floors.find((f) => f.id === layout.defaultFloor);
      await loadEnv();
      const entry = await loadFloor(def, (r) => {
        fadeText.textContent = `실내 불러오는 중… ${Math.round(r * 100)}%`;
      });
      camCtrl.stopFlight();
      camCtrl.setWalkMode(false);
      showFloor(def, entry);
      post.renderPass.scene = scene;
      active = true;
      exitArmed = true;
      document.body.classList.add('is-interior');
      hud.hidden = false;
      const start = def.entry || def.spawn;
      camCtrl.placeAt(start.pos, start.target);
      camCtrl.setWalkMode(true);
      if (typeof onChange === 'function') onChange(true);
      await fadeTo(false);
      busy = false;
      return true;
    } catch (err) {
      console.error('[nowhere] 실내 불러오기 실패', err);
      await fadeTo(false);
      busy = false;
      const choice = await modal.show({
        title: '실내를 불러오지 못했습니다',
        buttons: [
          { id: 'retry', label: '다시 시도', primary: true },
          { id: 'close', label: '닫기', cancel: true },
        ],
      });
      return choice === 'retry' ? enter(buildingId) : false;
    }
  }

  /** 실내에서 나와 외관 HAUS 정면(카메라 시점)으로 돌아간다. */
  async function exit() {
    if (!active || busy) return;
    busy = true;
    await fadeTo(true);
    camCtrl.setWalkMode(false);
    post.renderPass.scene = exteriorScene;
    camCtrl.setTerrain({
      groundHeightAt: world.groundHeightAt,
      getWalkBlocker: world.getWalkBlocker,
      walkFallback: EXTERIOR_WALK_FALLBACK,
    });
    camCtrl.setBounds(null);
    const a = approachFor(world.layout, 'haus');
    if (a) camCtrl.placeAt(a.pos, a.target);
    active = false;
    document.body.classList.remove('is-interior');
    hud.hidden = true;
    if (typeof onChange === 'function') onChange(false);
    await fadeTo(false);
    busy = false;
  }

  // 1F 정문 출구 영역: 보행 중 들어가면 한 번 묻고, 영역을 벗어났다 다시 들어오면 또 묻는다
  function update() {
    if (!active || busy || !floorDef?.exit || modal.isOpen()) return;
    const p = camera.position;
    const e = floorDef.exit;
    const inside = Math.hypot(p.x - e.pos[0], p.z - e.pos[2]) <= e.radius;
    if (inside && exitArmed && camCtrl.isWalkMode()) {
      exitArmed = false;
      modal
        .show({
          title: '밖으로 나가시겠습니까?',
          buttons: [
            { id: 'yes', label: '예', primary: true },
            { id: 'no', label: '아니오', cancel: true },
          ],
        })
        .then((c) => {
          if (c === 'yes') exit();
        });
    } else if (!inside) {
      exitArmed = true;
    }
  }

  return { enter, exit, update, isActive: () => active, currentFloor: () => (active ? floorDef?.id ?? null : null), scene };
}
```

- [ ] **Step 6: 화면 전환 · 실내 HUD 스타일** — `public/src/nowhere/nowhere.css` 파일 끝에 덧붙인다

```css

/* ── 실내 뷰: 화면 전환(검게) · HUD ── */
.nw-fade {
  position: fixed;
  inset: 0;
  z-index: 55;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #05080d;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.6s ease;
}
.nw-fade.is-on {
  opacity: 1;
  pointer-events: auto;
}
.nw-fade-text {
  font-family: var(--nw-font-mono);
  font-size: 12px;
  letter-spacing: 0.06em;
  color: var(--nw-text-dim);
}
.nw-interior-hud {
  position: fixed;
  top: 84px;
  left: 22px;
  z-index: 21;
  display: flex;
  align-items: center;
  gap: 8px;
}
.nw-interior-hud[hidden] {
  display: none;
}
.nw-interior-floor {
  padding: 6px 10px;
  border: 1px solid var(--nw-line-struct);
  border-left: 2px solid var(--nw-accent);
  border-radius: 2px;
  background: var(--nw-bg-panel);
  font-size: 13px;
  font-weight: 600;
  color: var(--nw-text);
}
.nw-interior-exit {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.nw-interior-exit img {
  width: 18px;
  height: auto;
}
```

- [ ] **Step 7: 통과 확인**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# fail 0` (실내 진입은 Task 9 에서 연결 후 브라우저로 확인)

- [ ] **Step 8: 스테이징 · 커밋 메시지 제안**

```bash
git add public/src/nowhere/terrain-mesh.js public/src/nowhere/interior.js public/src/nowhere/world.js public/src/nowhere/nowhere.css
```
제안 메시지: `feat(inner): 실내 뷰 모듈(별도 씬 · 층 불러오기 · 진입/나가기 전환 · 실내 보행 지형 · 출구 모달) + 래스터화 공유 모듈`

---

### Task 9: 시나리오 투어 연결 `main.js` · HTML · 조작 안내

**Files:**
- Modify: `public/src/nowhere/main.js`, `public/index.html`, `public/nowhere.html`, `public/nowhere-mountain.html`, `public/src/nowhere/nowhere.css`, `public/src/nowhere/help.js`, `tests/nowhere-help.test.mjs`

**Interfaces:**
- Consumes: Task 1 `buildFlightPath`, Task 2 `approachFor` · `TOUR_BUILDINGS`, Task 3 `createModal`, Task 4 `createScenarioRunner` · `CANCEL`, Task 5 카메라 API, Task 8 `createInterior`.
- Produces: `window.__NW_APP` 에 `modal`, `interior`, `scenario`, `startScenario(stepId)`. `getStats()` 에 `interior`, `floor`, `scenarioStep`.

- [ ] **Step 1: 테스트에 투어 연결 검사 추가(실패 확인용)** — `tests/nowhere-help.test.mjs` 끝에 덧붙인다

```js

test('(c) 투어가 main.js 에 연결되어 있다(자동 시작 · 투어 시작 · 건물 이동)', () => {
  const main = readFileSync(new URL('../public/src/nowhere/main.js', import.meta.url), 'utf8');
  assert.match(main, /startScenario\('intro'\)/);
  assert.match(main, /startScenario\('chooseBuilding'\)/);
  assert.match(main, /createInterior\(/);
  const descs = CONTROL_SECTIONS.flatMap((s) => s.rows.map((r) => r.desc)).join('\n');
  assert.match(descs, /투어 시작/);
  assert.match(descs, /밖으로 나가기/);
});
```
Run: `node --test tests/nowhere-help.test.mjs`
Expected: FAIL — (c) `startScenario` 불일치

- [ ] **Step 2: HTML — `투어 시작` 이름, 카메라 독 클래스**

```bash
python3 - <<'EOF'
for f in ['public/index.html', 'public/nowhere.html', 'public/nowhere-mountain.html']:
    s = open(f, encoding='utf-8').read()
    a = '      <button id="nw-btn-intro" type="button" class="nw-btn">\n        인트로 비행\n      </button>\n'
    b = '      <button id="nw-btn-intro" type="button" class="nw-btn">\n        투어 시작\n      </button>\n'
    assert s.count(a) == 1, f
    s = s.replace(a, b)
    a2 = '    <div class="nw-dock-group">\n      <div class="nw-dock-label">카메라 프리셋 (VIEWPOINT)</div>'
    b2 = '    <div class="nw-dock-group nw-dock-camera">\n      <div class="nw-dock-label">카메라 프리셋 (VIEWPOINT)</div>'
    assert s.count(a2) == 1, f
    s = s.replace(a2, b2)
    open(f, 'w', encoding='utf-8').write(s)
print('ok')
EOF
```
Expected: `ok`

- [ ] **Step 3: 실내에서 외관 전용 UI 숨기기** — `public/src/nowhere/nowhere.css` 파일 끝에 덧붙인다

```css

/* 실내에서는 외관 전용 UI(월드 전환 · 투어 · 건물 이동 · 카메라 프리셋)를 숨긴다. 기상 · 시간은 유지 */
body.is-interior .nw-world-switch,
body.is-interior #nw-btn-intro,
body.is-interior #nw-btn-buildings,
body.is-interior .nw-dock-camera {
  display: none;
}
```

- [ ] **Step 4: `main.js` 연결**

import 찾기:
```js
import { createHelpOverlay, createWalkHud } from './help.js';
```
바꾸기:
```js
import { createHelpOverlay, createWalkHud } from './help.js';
import { createModal } from './modal.js';
import { createScenarioRunner, CANCEL } from './scenario.js';
import { approachFor, TOUR_BUILDINGS } from './tour-config.js';
import { buildFlightPath } from './flight.js';
import { createInterior } from './interior.js';
```

찾기:
```js
  const help = createHelpOverlay({ onOpen: () => camCtrl.releasePointer() });
```
바꾸기:
```js
  const help = createHelpOverlay({ onOpen: () => camCtrl.releasePointer() });

  // ── 시나리오 투어: 인트로 → 건물 선택 → 정면 비행 → 입장(성수 → 실내) / 준비중(몽골) ──
  const modal = createModal({ onShow: () => camCtrl.releasePointer() });
  const interior = createInterior({
    renderer,
    camera,
    camCtrl,
    post,
    world,
    quality,
    modal,
    exteriorScene: scene,
  });
  const scenario = createScenarioRunner({
    adapters: {
      // 끝까지 재생 · 사용자 입력으로 건너뜀 → 건물 선택으로, 다른 동작이 끊음 → 투어 종료
      intro: () => new Promise((resolve) => camCtrl.startIntro((reason) => resolve(reason === 'cancelled' ? CANCEL : reason))),
      modal: (step) =>
        modal.show({
          title: step.title,
          buttons: step.buttons.map((b) => ({ ...b, sub: b.building ? TOUR_BUILDINGS[b.building].summary : undefined })),
        }),
      fly: async (step) => {
        const to = approachFor(world.layout, step.building);
        if (!to) return CANCEL;
        const from = { pos: camera.position.toArray(), target: camCtrl.controls.target.toArray() };
        const r = await camCtrl.flyTo(buildFlightPath(from, to));
        return r === 'done' ? 'done' : CANCEL;
      },
      enterInterior: async (step) => ((await interior.enter(step.building)) ? 'done' : CANCEL),
    },
  });

  function startScenario(stepId) {
    if (interior.isActive()) return;
    modal.close();
    camCtrl.stopFlight();
    scenario.start(stepId);
  }

  // Esc: 모달 · 조작 안내가 먼저 받고(캡처 단계), 남은 Esc 는 인트로 · 비행 중인 투어를 끝낸다
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape' || !scenario.isRunning() || interior.isActive()) return;
      if (!camCtrl.isIntroActive() && !camCtrl.isFlying()) return;
      e.preventDefault();
      e.stopPropagation();
      scenario.cancel();
      camCtrl.stopFlight();
      camCtrl.cancelIntro();
    },
    true,
  );
```

찾기(자동 인트로):
```js
  if (!params.get('noIntro') && !params.get('cam') && !params.get('weather') && !params.get('time')) {
    camCtrl.startIntro();
  }
```
바꾸기:
```js
  if (!params.get('noIntro') && !params.get('cam') && !params.get('weather') && !params.get('time')) {
    startScenario('intro');
  }
```

찾기(인트로 버튼):
```js
  if (introBtn) {
    introBtn.addEventListener('click', () => {
      camCtrl.startIntro();
    });
  }
```
바꾸기:
```js
  if (introBtn) {
    introBtn.addEventListener('click', () => {
      startScenario('intro');
    });
  }
  const buildingsBtn = document.getElementById('nw-btn-buildings');
  if (buildingsBtn) {
    buildingsBtn.addEventListener('click', () => {
      startScenario('chooseBuilding');
    });
  }
```

찾기(렌더 루프):
```js
    camCtrl.update(dt);

    renderer.info.reset();
```
바꾸기:
```js
    camCtrl.update(dt);
    interior.update(dt);

    renderer.info.reset();
```

찾기(app 객체):
```js
    help,
    world,
```
바꾸기:
```js
    help,
    modal,
    interior,
    scenario,
    startScenario,
    world,
```

찾기(getStats):
```js
        introActive: camCtrl.isIntroActive(),
```
바꾸기:
```js
        introActive: camCtrl.isIntroActive(),
        interior: interior.isActive(),
        floor: interior.currentFloor(),
        scenarioStep: scenario.current(),
```

- [ ] **Step 5: 조작 안내 행 추가** — `public/src/nowhere/help.js` 의 공통 섹션 마지막 행(`{ keys: ['클릭'], desc: '월드 전환(…` 줄) 바로 아래에 추가

```js
      { keys: ['클릭'], desc: '투어 시작: 인트로 비행 → 건물 선택 → 정면 비행 → 입장(하우스노웨어 성수) · 준비중(하우스노웨어 몽골). 건물 이동: 건물 선택부터' },
      { keys: ['클릭'], desc: '실내: 왼쪽 위 밖으로 나가기, 또는 1F 정문 쪽으로 걸어가면 나가기 질문' },
```

- [ ] **Step 6: 통과 확인**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# fail 0`

- [ ] **Step 7: 브라우저 확인(데스크톱 1440×810, 두 월드)** — 각 월드에서

1. `?ver=ds2` 를 연다(파라미터 없음 → 자동 투어). 12 초 뒤 모달 제목 `어떤 건물로 이동하시겠습니까?`, 버튼 `하우스노웨어 성수 50 × 52 m · 높이 81 m` · `하우스노웨어 몽골 22 × 18 m · 높이 31 m` · `닫기`.
2. `하우스노웨어 몽골` 클릭 → 비행 4~8 초 → `준비중입니다` [확인] → 확인 후 `getStats().scenarioStep === null`.
3. 상단 `건물 이동` → `하우스노웨어 성수` → 비행 → `입장하시겠습니까?` → `예` → 검은 화면 전환 → `getStats().interior === true`, `floor === '1'`, 보행 시점 on, 상단에 `1F 로비` · `밖으로 나가기`, 월드 전환 · 투어 · 카메라 프리셋 숨김.
4. 실내에서 `W` 로 걸어 성수 도시 모형 받침대 · 기둥 · 벽에 막히는지 확인(카메라 위치가 벽 밖 `bounds` 를 넘지 않음).
5. 정문(남측, Three z +16 부근)으로 걸어가면 `밖으로 나가시겠습니까?` → `예` → 외관 HAUS 정면, `interior === false`, 숨김 UI 복귀.
6. 인트로 재생 중 아무 키 → 곧바로 건물 선택 모달. 인트로 재생 중 `Esc` → 모달 없이 투어 종료.
7. `?ver=seongsu` 에서 2·3·5 반복.
8. 각 화면 스크린샷을 찍어 FaceArch 정면 구도를 확인한다. 얼굴(두 눈)이 화면에 없으면 `tour-config.js` 의 `facearch.approach` 를 `{ pos: [48, 6, 0], target: [0, 14, 0] }` → `{ pos: [0, 6, -48], … }` → `{ pos: [-48, 6, 0], … }` 순으로 바꿔 보며 두 눈이 보이는 값을 고르고 Task 2 테스트(`npm test`)를 다시 돌린다.

- [ ] **Step 8: 스테이징 · 커밋 메시지 제안**

```bash
git add public/src/nowhere/main.js public/index.html public/nowhere.html public/nowhere-mountain.html public/src/nowhere/nowhere.css public/src/nowhere/help.js tests/nowhere-help.test.mjs public/src/nowhere/tour-config.js
```
제안 메시지: `feat(tour): 시나리오 투어 연결(자동 시작 · 투어 시작 · 건물 이동 · Esc 종료)과 성수 실내 1F 진입/나가기`

---

### Task 10: 마무리 검증 · README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README 갱신** — 조작 표에서 분석 모드 두 행과 `인트로 비행` 행을 아래로 바꾸고, `## 2. 빌드 및 검증 파이프라인` 의 코드 블록에 실내 빌드 두 줄을 추가

```bash
python3 - <<'EOF'
import re
p = 'README.md'
s = open(p, encoding='utf-8').read()
s, n1 = re.subn(r'\| `F` / `분석 모드` 버튼 \|[^\n]*\n', '', s)
s, n2 = re.subn(r'\| `\[` / `\]` \(분석 모드 중\) \|[^\n]*\n', '', s)
s, n3 = re.subn(r'\| `인트로 비행` 버튼 \|[^\n]*\n',
    '| `투어 시작` 버튼(첫 방문 시 자동) | 인트로 비행 → 「어떤 건물로 이동하시겠습니까?」(하우스노웨어 성수 · 하우스노웨어 몽골) → 건물 정면 비행 → 성수: 「입장하시겠습니까?」 예 → 실내 1F 로비 / 몽골: 「준비중입니다」. 인트로 중 아무 입력은 건물 선택으로 건너뛰고, `Esc` 는 투어 종료 |\n'
    '| `건물 이동` 버튼 | 건물 선택 모달부터 다시 시작 |\n'
    '| 실내(성수 1F 로비) | 보행 시점으로 시작(이동 · 달리기 · 점프 · 충돌 그대로), 왼쪽 위 `밖으로 나가기` 또는 1F 정문 쪽 출구에서 외관 HAUS 정면으로 복귀 |\n', s)
s, n4 = re.subn(r'(npm run nowhere:ds2:optimize\n)', r'\1\n# 2-C) 성수 실내(1F 로비): 층 껍데기 + 실내 에셋 축척 · 배치 · 감축 → GLB · inner-layout.json · HDRI\nnpm run nowhere:inner:build\nnpm run nowhere:inner:optimize\n', s)
assert (n1, n2, n3, n4) == (1, 1, 1, 1), (n1, n2, n3, n4)
open(p, 'w', encoding='utf-8').write(s)
print('ok')
EOF
```
Expected: `ok` (어긋나면 README 의 해당 행 문구를 확인해 정규식만 맞춘다)

- [ ] **Step 2: 전체 테스트**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: `# fail 0`

- [ ] **Step 3: 모바일 · 예산 실측(브라우저)** — `?ver=ds2&tier=mobile` 로 투어 → 성수 입장 후

```js
const s = await state.page.evaluate(() => window.__NW_APP.getStats());
console.log(JSON.stringify({ interior: s.interior, floor: s.floor, tris: s.triangles, calls: s.calls }));
```
Expected: `interior: true`, `floor: '1'`, 실내 `tris` ≤ 300000. 데스크톱(`tier` 없음)은 ≤ 600000.

- [ ] **Step 4: 스테이징 · 커밋 메시지 제안**

```bash
git add README.md
```
제안 메시지: `docs: README 투어 · 실내 조작과 실내 빌드 명령`

---

## 2단계 예고(별도 계획)

B1F 카페 · 12F · 13F 몬스터 룸 빌드, 엘리베이터 층 선택(HUD 버튼 · 문 앞 모달), 층 둘러보기(`tour` 지점 자동 비행 + 자막), 창밖 캡처(CubeCamera, 층 `elevation`), 1F 디스플레이 화면(CanvasTexture), 실내 밤 조명, 모바일 실측. 1단계에서 확정된 `interior.js` · `inner-layout.json` 형식을 그대로 확장한다.
