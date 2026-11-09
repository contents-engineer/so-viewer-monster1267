# HAUS NOWHERE 성수 실내 2단계(4개 층 · 엘리베이터 · 둘러보기 · 창밖 · 디스플레이) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1단계에서 만든 성수 실내(1F 로비)를 B1F 카페 · 12F · 13F 몬스터 룸까지 넓히고, 엘리베이터 층 이동 · 층 둘러보기(자막) · 창밖 풍경 · 밤 조명 · 1F 디스플레이 화면 · 바닥 AO · 모바일 감축을 더한다.

**Architecture:** Blender 빌드를 공용 도구(`inner_common.py`) · 층 정의(`inner_floors.py`) · 파이프라인(`inner_build.py`)으로 나누고, 층마다 새 장면에서 바닥 AO 를 굽고 데스크톱 GLB · 모바일(전시물 감축) GLB 를 따로 내보낸다. 웹은 three 없이 테스트할 수 있는 순수 모듈(`inner-nav.js` 층 이동 · 영역, `inner-tour.js` 둘러보기, `inner-view.js` 창밖 · 밤 조명, `inner-display.js` 디스플레이 문구)을 먼저 만들고, 마지막에 `interior.js` 를 한 번에 다시 써서 연결한다. 생성 GLB 의 계약(노드 이름 · 지점이 장애물 밖 · 삼각형 예산 · AO)은 의존성 없는 GLB 파서(`tests/lib/glb.mjs`)로 node:test 에서 검사한다.

**Tech Stack:** Blender 5.3 Beta(headless, Cycles AO 굽기) · glTF/GLB · `@gltf-transform/cli@4.1.1`(meshopt · webp) · Three.js r170(vendored, importmap) · node:test · playwriter MCP(브라우저 확인)

**설계 결정(스펙 §2 보완):**
- AO 는 층 바닥 평면(`IN_floor`)에만 굽는다(두 번째 UV `AO` → glTF `occlusionTexture` texCoord 1 → three `aoMap`). 벽 · 천장은 굽지 않고, 조명은 반구광 + 방향광(+ 모바일 채움광) 실시간 그대로다.
- 모바일은 같은 장면에서 전시물(`EX_*`, 받침대 제외)을 하나당 2만 삼각형으로 더 줄여 따로 내보낸다(`build/nowhere/raw-inner/mobile/`).
- 엘리베이터 코어는 층마다 그 층 북쪽 벽(x −5…5)에 두고, 내리면 남쪽을 본다(층 평면 크기가 달라 절대 좌표 대신 "코어 앞" 위치를 맞춘다).
- 창밖은 B1F(elevation < 0)에서는 캡처하지 않는다.
- 바닥 재질은 diffuse · normal 맵 + 상수 거칠기로 만든다(층별 roughness 맵, 12F `roughness_a` 포함은 쓰지 않음 — 1단계 1F 와 같은 방식).

## Global Constraints

- 응답 · 주석 · UI 문구는 한국어. UI 문구는 그대로 쓴다:
  - 층 이름 `B1F 카페` · `1F 로비` · `12F` · `13F 몬스터 룸`, HUD 층 버튼 `B1` · `1` · `12` · `13`(현재 층 강조), `이 층 둘러보기`, `밖으로 나가기`
  - 모달 `층 선택`(다른 층 이름 버튼 + `닫기`), `밖으로 나가시겠습니까?`(`예` · `아니오`), `실내를 불러오지 못했습니다` · `층을 불러오지 못했습니다`(`다시 시도` · `닫기`)
  - 화면 전환 문구 `실내로 들어가는 중…` · `실내 불러오는 중… N%` · `층 이동 중…` · `층 불러오는 중… N%`, 디스플레이 첫 줄 `HAUS NOWHERE SEOUL`
- 층 id `b1` · `1` · `12` · `13`, `elevation` −4.5 · 0 · 55 · 60(외관 월드 기준 m). 층 GLB `assets/nowhere-inner/inner-<id>.glb`, 모바일 `assets/nowhere-inner/mobile/inner-<id>.glb`.
- 좌표: Blender (x, y, z) → Three (x, z, −y). `inner-layout.json` 은 Three 좌표.
- GLB 노드 이름 규칙: 바닥 `IN_floor*`, 천장 `IN_ceiling*`, 그 밖 벽 · 유리 · 기둥 · 코어 `IN_*`, 전시물 `EX_*`(1F 디스플레이 화면 `EX_display_screen`).
- 예산(스펙 §2.7): 층 GLB 데스크톱 ≤ 6 MB · 모바일 ≤ 3 MB, 층 삼각형 데스크톱 ≤ 60만 · 모바일 ≤ 30만, 실내 진입 추가 다운로드 데스크톱(1F + HDRI) ≤ 8 MB · 모바일(1F, HDRI 생략) ≤ 4 MB, 외관 첫 로딩 변화 없음(실내 자원은 입장할 때만 받음).
- 파이프라인: `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python …` → `@gltf-transform/cli@4.1.1 optimize … --compress meshopt --texture-compress webp`(데스크톱 텍스처 1024 · 모바일 512).
- 순수 모듈(`inner-nav.js` · `inner-tour.js` · `inner-view.js` · `inner-display.js`)은 `three` 를 import 하지 않는다(필요하면 `THREE` 를 인자로 받는다) — node:test 로 검증.
- 새 npm 의존성 금지. 매 Task 끝에 `npm test` 전부 통과.
- 브라우저 확인은 playwriter MCP(`mcp__playwriter__execute`)만. 키 입력은 `state.page.keyboard`(실제 입력 경로)로 한다 — 합성 `dispatchEvent` 는 keypress · 버튼 활성화 같은 기본 동작을 재현하지 못한다. 페이지마다 `window.confirm/alert/prompt` 를 기록용 스텁으로 바꾸고, 짧은 호출로 나눠 기다린다.
- `public/assets/inner/light/light.exr` 은 쓰지 않고 커밋하지 않는다. `build/` 는 커밋하지 않는다. 원본 `public/assets/inner/` 는 바꾸지 않는다.
- Git: 스스로 커밋하지 않는다. 각 Task 끝에 관련 파일만 경로로 `git add` 하고 커밋 메시지를 제안한다(실행 중 사용자가 작업별 커밋을 허락하면 그 실행에서만 커밋, 메시지 끝 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`).

## File Structure

| 파일 | 상태 | 책임 |
|---|---|---|
| `tests/lib/glb.mjs` | 생성 | GLB JSON 청크 읽기 · 노드 월드 상자 · 삼각형 수(의존성 없음) |
| `tests/nowhere-inner-glb.test.mjs` | 생성 | 층 GLB 계약: 이름 규칙 · 지점이 장애물 밖 · 삼각형 예산 · 바닥 AO · 디스플레이 화면 |
| `tools/nowhere/blender/inner_common.py` | 생성 | 경로 · 재질 · 상자/평면/세로 사각형 · 에셋 가져오기 · 감축 · 띠창/커튼월/코어/기둥 · AO 굽기 · 디스플레이 화면 · 층 JSON |
| `tools/nowhere/blender/inner_floors.py` | 생성 | 층 정의(B1F · 1F · 12F · 13F)와 층별 배치 함수, `FLOORS` |
| `tools/nowhere/blender/inner_build.py` | 다시 씀 | 층마다 새 장면 → 배치 → AO → 데스크톱 GLB · 미리보기 → 모바일 감축 GLB → `inner-layout.json` · HDRI |
| `package.json` | 수정 | `nowhere:inner:optimize` 를 생성된 층 전부 · 모바일 원본으로 |
| `public/src/nowhere/inner-nav.js` | 생성 | 층 순서 · 짧은 이름 · `층 선택` 버튼 · 영역 판정 · 영역 트리거 · 바닥/천장 이름 판정(순수) |
| `public/src/nowhere/inner-tour.js` | 생성 | 둘러보기 구간 경로(순수) + 재생기(카메라 비행 · 자막) |
| `public/src/nowhere/inner-view.js` | 생성 | 창밖 캡처(CubeCamera, THREE 주입) · 밤 조명 값(순수) |
| `public/src/nowhere/inner-display.js` | 생성 | 디스플레이 문구(순수) + CanvasTexture 화면(THREE 주입) |
| `public/src/nowhere/camera.js` | 수정 | `flyTo(path, { interruptible })` · 끊을 수 있는 비행의 입력 중단 · `clearInput()` |
| `public/src/nowhere/interior.js` | 다시 씀 | 다층 실내: 층 이동 · HUD 층 버튼 · `층 선택` · 둘러보기 · 창밖 · 밤 조명 · 디스플레이 |
| `public/src/nowhere/main.js` | 수정 | `createInterior` 에 `weather`, 모달 `onShow` 에 `clearInput`, 월드 전환 시 `noIntro` |
| `public/src/nowhere/nowhere.css` | 수정 | 층 버튼 · 둘러보기 버튼 · 자막, 오래된 주석 |
| `public/src/nowhere/help.js` · `tests/nowhere-help.test.mjs` | 수정 | 실내 조작 행(층 이동 · 둘러보기) |
| `tests/nowhere-inner.test.mjs` · `tests/nowhere-scenario.test.mjs` | 수정 | 4개 층 · 층 높이 · 시작점/엘리베이터 거리, 시나리오 건물 id |
| `tests/nowhere-inner-nav.test.mjs` · `tests/nowhere-inner-tour.test.mjs` · `tests/nowhere-inner-view.test.mjs` · `tests/nowhere-inner-display.test.mjs` | 생성 | 순수 모듈 테스트 |
| `README.md` | 수정 | 실내 4개 층 조작, 테스트 항목 수 문구 |
| 산출물 `public/assets/nowhere-inner/` | 갱신 | `inner-{b1,1,12,13}.glb`, `mobile/inner-{b1,1,12,13}.glb`, `inner-layout.json`, `renders/inner-{b1,1,12,13}.webp`, `env-1k.hdr` |

---

### Task 1: 실내 GLB 계약 테스트(이름 규칙 · 지점 · 삼각형 예산) + 시나리오 건물 id

**Files:**
- Create: `tests/lib/glb.mjs`, `tests/nowhere-inner-glb.test.mjs`
- Modify: `tests/nowhere-scenario.test.mjs`(끝에 테스트 추가)

**Interfaces:**
- Consumes: `public/assets/nowhere-inner/inner-layout.json`(1단계 산출, 층 1F), `SCENARIO`(scenario.js), `TOUR_BUILDINGS`(tour-config.js, id → `{ label, summary, … }`).
- Produces: `tests/lib/glb.mjs` — `readGlbJson(url) → glTF JSON`, `worldMatrices(json) → Map<nodeIndex, number[16]>`(열 우선), `meshNodeBoxes(json) → [{ name, min:[3], max:[3] }]`(월드 축 정렬 상자, Three 좌표 = glTF 좌표), `triangleCount(json) → number`. 이후 Task 3 · 7 이 이 파일에 테스트를 더한다.

이 Task 의 테스트는 현재 산출물로 바로 통과하는 계약 테스트다. 계산이 맞는지는 (b) 가 알려진 기둥 위치와 "기둥 안 점" 판정으로 확인한다.

- [ ] **Step 1: GLB 도우미 작성** — `tests/lib/glb.mjs`

```js
// GLB(glTF 바이너리)의 JSON 청크 읽기 · 노드 월드 상자 · 삼각형 수 — 의존성 없는 테스트 도우미.
// npm test 의 tests/*.test.mjs 에 걸리지 않도록 tests/lib/ 아래에 둔다.
import { readFileSync } from 'node:fs';

export function readGlbJson(url) {
  const b = readFileSync(url);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error(`GLB 아님: ${url}`);
  if (b.readUInt32LE(16) !== 0x4e4f534a) throw new Error(`첫 청크가 JSON 이 아님: ${url}`);
  const len = b.readUInt32LE(12);
  return JSON.parse(b.subarray(20, 20 + len).toString('utf8'));
}

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// 노드 로컬 행렬(열 우선): matrix 가 있으면 그대로, 없으면 T · R · S
function localMatrix(n) {
  if (n.matrix) return n.matrix.slice();
  const [x, y, z, w] = n.rotation || [0, 0, 0, 1];
  const [sx, sy, sz] = n.scale || [1, 1, 1];
  const [tx, ty, tz] = n.translation || [0, 0, 0];
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  return [
    (1 - 2 * (yy + zz)) * sx, 2 * (xy + wz) * sx, 2 * (xz - wy) * sx, 0,
    2 * (xy - wz) * sy, (1 - 2 * (xx + zz)) * sy, 2 * (yz + wx) * sy, 0,
    2 * (xz + wy) * sz, 2 * (yz - wx) * sz, (1 - 2 * (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  }
  return o;
}

function apply(m, [x, y, z]) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

/** 장면에 걸린 노드마다 월드 행렬 — Map(노드 번호 → 열 우선 16). */
export function worldMatrices(json) {
  const out = new Map();
  const roots = json.scenes?.[json.scene ?? 0]?.nodes ?? [];
  const walk = (i, parent) => {
    const m = mul(parent, localMatrix(json.nodes[i]));
    out.set(i, m);
    for (const c of json.nodes[i].children || []) walk(c, m);
  };
  for (const r of roots) walk(r, IDENTITY);
  return out;
}

// meshopt 양자화(KHR_mesh_quantization)로 normalized 정수가 된 POSITION 의 min/max 를 −1…1 로
const NORM_MAX = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };
function accessorBounds(acc) {
  let { min, max } = acc;
  const k = acc.normalized ? NORM_MAX[acc.componentType] : 0;
  if (k && [...min, ...max].some((v) => Math.abs(v) > 1)) {
    min = min.map((v) => Math.max(v / k, -1));
    max = max.map((v) => Math.max(v / k, -1));
  }
  return { min, max };
}

/** 메시가 달린 노드마다 월드 축 정렬 상자 { name, min, max }(glTF = Three 좌표). */
export function meshNodeBoxes(json) {
  const boxes = [];
  for (const [i, m] of worldMatrices(json)) {
    const n = json.nodes[i];
    if (n.mesh == null) continue;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const p of json.meshes[n.mesh].primitives) {
      const b = accessorBounds(json.accessors[p.attributes.POSITION]);
      for (const cx of [b.min[0], b.max[0]]) {
        for (const cy of [b.min[1], b.max[1]]) {
          for (const cz of [b.min[2], b.max[2]]) {
            const w = apply(m, [cx, cy, cz]);
            for (let a = 0; a < 3; a++) {
              min[a] = Math.min(min[a], w[a]);
              max[a] = Math.max(max[a], w[a]);
            }
          }
        }
      }
    }
    boxes.push({ name: n.name || '', min, max });
  }
  return boxes;
}

/** 장면에 그려지는 삼각형 수(메시 노드 × 삼각형 모드 프리미티브). */
export function triangleCount(json) {
  let t = 0;
  for (const [i] of worldMatrices(json)) {
    const n = json.nodes[i];
    if (n.mesh == null) continue;
    for (const p of json.meshes[n.mesh].primitives) {
      if ((p.mode ?? 4) !== 4) continue;
      const count = p.indices != null ? json.accessors[p.indices].count : json.accessors[p.attributes.POSITION].count;
      t += count / 3;
    }
  }
  return Math.round(t);
}
```

- [ ] **Step 2: 계약 테스트 작성** — `tests/nowhere-inner-glb.test.mjs`

```js
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
```

- [ ] **Step 3: 시나리오 건물 id 테스트 추가** — `tests/nowhere-scenario.test.mjs` 끝에 덧붙인다

```js

test('(j) 시나리오가 쓰는 건물 id 는 모두 TOUR_BUILDINGS 에 있다', async () => {
  const { TOUR_BUILDINGS } = await import('../public/src/nowhere/tour-config.js');
  const ids = Object.values(SCENARIO.steps)
    .flatMap((s) => [s.building, ...(s.buttons || []).map((b) => b.building)])
    .filter(Boolean);
  assert.ok(ids.length >= 4, `건물 id ${ids.length}개`);
  for (const id of ids) assert.ok(TOUR_BUILDINGS[id], `TOUR_BUILDINGS 에 '${id}' 없음`);
});
```

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/nowhere-inner-glb.test.mjs tests/nowhere-scenario.test.mjs 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# pass 14`(GLB 4 + 시나리오 10), `# fail 0`. (c) 가 실패하면 실패 메시지의 노드 이름 · 좌표를 보고 실제 배치 문제인지(지점 수정은 Task 2 이후 `inner_floors.py` 에서) 판정 오류인지(파서 수정) 구분해 보고한다.
이어서 `npm test 2>&1 | grep -E "^# (pass|fail)"` → `# fail 0`

- [ ] **Step 5: 스테이징 · 커밋 메시지 제안**

```bash
git add tests/lib/glb.mjs tests/nowhere-inner-glb.test.mjs tests/nowhere-scenario.test.mjs
```
제안 메시지: `test(inner): 실내 GLB 계약 테스트(이름 규칙 · 지점이 장애물 밖 · 삼각형 예산)와 시나리오 건물 id`

---

### Task 2: 빌드 파이프라인 다층 구조(공용 도구 · 층 정의 · 층마다 새 장면) + 모바일 감축

**Files:**
- Create: `tools/nowhere/blender/inner_common.py`, `tools/nowhere/blender/inner_floors.py`
- Rewrite: `tools/nowhere/blender/inner_build.py`
- Modify: `package.json`(`nowhere:inner:optimize`)
- 산출(스테이징): `public/assets/nowhere-inner/inner-layout.json`, `inner-1.glb`, `mobile/inner-1.glb`, `renders/inner-1.webp`, `env-1k.hdr`

**Interfaces:**
- Consumes: 1단계 `inner_build.py` 의 1F 배치 값(DJ (8.8, 7.2), 엘리베이터 문 y 19.3, rz: b1 −90 · b2 90 · b3 180 · DJ −45 · display 90), Blender 5.3 호환 수정(`rotation_mode = 'XYZ'`, 저장 전 `im.pixels[0]`).
- Produces: `inner_common`(이후 Task 가 함수를 더함) — `ROOT, SRC, RAW, RAW_MOBILE, PUB, MAX_TRIS(50000), MOBILE_MAX_TRIS(20000)`, `to_three, reset_scene, coll, mat_flat, mat_tiled, box, tri_count, decimate_to, import_prop, ribbon, curtain, elevator_core, columns, floor_json`; `inner_floors.FLOORS = [(F, builder), …]`(F 키: `id, label, glb, mobileGlb, elevation, bounds_bl, ceiling, floor_tex{dir, diffuse, normal, tile, rough}, spawn, elevator, exhibits, tour`, 선택 `entry, exit`); `inner_build.materials(F)` 키 `floor, concrete, ceiling, core, plinth, glass, mullion, brass, screen`. 환경 변수 `NW_FLOORS=b1,12` 로 일부 층만 다시 빌드(레이아웃 JSON 은 항상 모든 층).

리팩터 후 1F 결과는 1단계와 같아야 한다(레이아웃 JSON 은 파일 끝 줄바꿈만 다름). 모바일 GLB 는 전시물 감축으로 삼각형이 줄어든다.

- [ ] **Step 1: 공용 도구 작성** — `tools/nowhere/blender/inner_common.py`

```python
# HAUS NOWHERE — 성수 실내 빌드 공용 도구: 경로 · 재질 · 상자 · 에셋 가져오기(Draco) · 감축 · 껍데기(띠창 · 커튼월 · 코어 · 기둥) · 층 JSON.
# inner_build.py(파이프라인) · inner_floors.py(층 정의)가 쓴다. 좌표: Blender Z-up m, 층 원점 = 바닥 중앙 부근. 웹(Three.js)은 (x, z, −y).
# 노드 이름 규칙(웹 interior.js 가 씀): 바닥 IN_floor*, 천장 IN_ceiling*, 벽 · 유리 · 기둥 · 코어 IN_*, 전시물 EX_*.
import bpy, bmesh, os, math
from mathutils import Vector, Matrix

ROOT = os.environ.get('NW_ROOT') or os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
SRC = os.path.join(ROOT, 'public', 'assets', 'inner')
RAW = os.path.join(ROOT, 'build', 'nowhere', 'raw-inner')
RAW_MOBILE = os.path.join(RAW, 'mobile')
PUB = os.path.join(ROOT, 'public', 'assets', 'nowhere-inner')
MAX_TRIS = 50000          # 데스크톱: 전시물 하나당 삼각형 상한(넘으면 Decimate)
MOBILE_MAX_TRIS = 20000   # 모바일: 전시물 하나당 상한(층당 30만 이하 — 스펙 §2.7)


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


def tri_count(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def decimate_to(obj, max_tris):
    """삼각형이 max_tris 를 넘으면 Decimate(Collapse)로 줄이고 결과 삼각형 수를 돌려준다."""
    tris = tri_count(obj)
    if tris <= max_tris:
        return tris
    mod = obj.modifiers.new('decimate', 'DECIMATE')
    mod.ratio = max_tris / tris
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return tri_count(obj)


def import_prop(rel, name, c, loc, height=None, width=None, rz=0.0):
    """inner 에셋(Draco GLB)을 불러와 하나로 합치고, 바닥 중앙 원점 · 목표 높이(또는 폭) 축척 · 회전 · 위치 · 감축."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, rel))
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == 'MESH']
    if not meshes:
        raise RuntimeError(f'메시 없는 에셋: {rel}')
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
    obj.rotation_mode = 'XYZ'  # glTF 가져오기는 QUATERNION 모드라 그대로면 rotation_euler 가 무시됨
    obj.rotation_euler = (0.0, 0.0, math.radians(rz))
    decimate_to(obj, MAX_TRIS)
    obj.name = name
    obj.data.name = name
    return obj


# 포디움(1F) 가로 띠창: 솔리드 · 유리 띠 교차(외관 포디움과 같은 리듬). z1 이 None 이면 층고까지
BANDS_PODIUM = ((0.0, 1.0, 'wall'), (1.0, 2.6, 'glass'), (2.6, 3.6, 'wall'), (3.6, 5.0, 'glass'), (5.0, None, 'wall'))


def ribbon(c, M, tag, x0, y0, x1, y1, H, bands=BANDS_PODIUM):
    for i, (z0, z1, kind) in enumerate(bands):
        mat = M['concrete'] if kind == 'wall' else M['glass']
        pre = 'IN_wall' if kind == 'wall' else 'IN_glass'
        box(f'{pre}_{tag}_{i}', c, x0, y0, z0, x1, y1, H if z1 is None else z1, mat)


def curtain(c, M, tag, x0, y0, x1, y1, H, step=3.0):
    """타워 층 커튼월: 바닥 턱(0.25 m) · 전면 유리 · 천장 쪽 띠(0.35 m) · step m 간격 멀리언. 벽 하나 = (x0, y0)-(x1, y1) 띠."""
    box(f'IN_wall_{tag}_sill', c, x0, y0, 0.0, x1, y1, 0.25, M['concrete'])
    box(f'IN_glass_{tag}', c, x0, y0, 0.25, x1, y1, H - 0.35, M['glass'])
    box(f'IN_wall_{tag}_head', c, x0, y0, H - 0.35, x1, y1, H, M['concrete'])
    along_x = (x1 - x0) >= (y1 - y0)
    start, end = (x0, x1) if along_x else (y0, y1)
    i = 1
    t = start + step
    while t < end - 0.5:
        if along_x:
            box(f'IN_mullion_{tag}_{i}', c, t - 0.05, y0, 0.25, t + 0.05, y1, H - 0.35, M['mullion'])
        else:
            box(f'IN_mullion_{tag}_{i}', c, x0, t - 0.05, 0.25, x1, t + 0.05, H - 0.35, M['mullion'])
        i += 1
        t += step


def elevator_core(c, M, y_front, y_back, H):
    """엘리베이터 코어(x −5…5, 북측) + 문 door_1 두 짝(코어 앞 0.2 m, 높이 2.6 m). 모든 층이 같은 모양 — 내리면 남쪽을 본다."""
    box('IN_core', c, -5.0, y_front, 0.0, 5.0, y_back, H, M['core'])
    import_prop('main/door_1.glb', 'EX_elevator_l', c, (-2.5, y_front - 0.2, 0.0), height=2.6)
    import_prop('main/door_1.glb', 'EX_elevator_r', c, (2.5, y_front - 0.2, 0.0), height=2.6)


def columns(c, M, pts, H, half=0.4):
    for i, (x, y) in enumerate(pts):
        box(f'IN_column_{i}', c, x - half, y - half, 0.0, x + half, y + half, H, M['concrete'])


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
```

- [ ] **Step 2: 층 정의 작성(1F 만)** — `tools/nowhere/blender/inner_floors.py`

```python
# HAUS NOWHERE — 성수 실내 층 정의(배치 값 · 둘러보기 · 전시)와 층별 배치 함수. inner_build.py 가 FLOORS 를 차례로 빌드한다.
# Blender 좌표(Z-up m). 층 JSON 은 inner_common.floor_json 이 Three 좌표로 바꾼다.
from inner_common import box, import_prop, ribbon, curtain, elevator_core, columns

# ═════════════ 1F 로비 ═════════════
# Blender 평면: x −17…17, y −17…21(남측 y −17 정문, 북측 y +21 엘리베이터 코어), 층고 6 m.
FLOOR_1 = {
    'id': '1', 'label': '1F 로비',
    'glb': 'assets/nowhere-inner/inner-1.glb', 'mobileGlb': 'assets/nowhere-inner/mobile/inner-1.glb',
    'elevation': 0.0, 'bounds_bl': (-17.0, -17.0, 17.0, 21.0), 'ceiling': 6.0,
    'floor_tex': {'dir': 'main', 'diffuse': 'floor_diffuse.png', 'normal': 'floor_normal.png', 'tile': 1.2, 'rough': 0.35},
    'entry': ((0.0, -13.0, 1.7), (0.0, 0.0, 2.5)),
    'spawn': ((0.0, 15.0, 1.7), (0.0, 0.0, 2.5)),
    'exit': ((0.0, -16.0, 0.0), 2.0),
    'elevator': ((0.0, 19.0, 0.0), 2.5),
    'exhibits': [
        ('city_model', '성수 도시 모형', 'HAUS NOWHERE 미니어처와 성수의 그래피티 건물들', (0.0, 0.0, 1.5)),
        ('dj', 'DJ 부스', '로비의 사운드 설치물', (8.8, 7.2, 1.2)),
        ('display', '디스플레이 월', 'HAUS NOWHERE SEOUL · 현재 시각 · 기상', (-16.4, 6.0, 2.4)),
    ],
    'tour': [
        ((6.0, -8.0, 2.2), (0.0, 0.0, 1.8), '성수 도시 모형 — HAUS NOWHERE 와 성수 골목', 5),
        ((4.0, 3.0, 1.8), (8.8, 7.2, 1.2), 'DJ 부스 — 로비의 사운드 설치물', 4),
        ((-8.0, 2.0, 2.4), (-16.4, 6.0, 2.4), '디스플레이 월', 4),
    ],
}


def build_floor_1(c, M):
    X0, Y0, X1, Y1 = FLOOR_1['bounds_bl']
    H = FLOOR_1['ceiling']
    T = 0.3
    box('IN_floor', c, X0 - T, Y0 - T, -0.2, X1 + T, Y1 + T, 0.0, M['floor'])
    box('IN_ceiling', c, X0 - T, Y0 - T, H, X1 + T, Y1 + T, H + 0.2, M['ceiling'])
    # 남측: 정문 열림(x −3…3, z 0…3.4) 양옆 띠창 + 문 위 인방 · 유리 · 벽
    ribbon(c, M, 'sw', X0 - T, Y0 - T, -3.0, Y0, H)
    ribbon(c, M, 'se', 3.0, Y0 - T, X1 + T, Y0, H)
    box('IN_wall_s_lintel', c, -3.0, Y0 - T, 3.4, 3.0, Y0, 3.6, M['concrete'])
    box('IN_glass_s_top', c, -3.0, Y0 - T, 3.6, 3.0, Y0, 5.0, M['glass'])
    box('IN_wall_s_top', c, -3.0, Y0 - T, 5.0, 3.0, Y0, H, M['concrete'])
    # 서 · 동: 띠창, 북: 막힌 벽 + 엘리베이터 코어
    ribbon(c, M, 'w', X0 - T, Y0, X0, Y1, H)
    ribbon(c, M, 'e', X1, Y0, X1 + T, Y1, H)
    box('IN_wall_n', c, X0 - T, Y1, 0.0, X1 + T, Y1 + T, H, M['concrete'])
    elevator_core(c, M, 19.5, Y1, H)
    columns(c, M, ((-11.0, -6.0), (11.0, -6.0), (-11.0, 9.0), (11.0, 9.0)), H)
    # 성수 도시 모형: 받침대(높이 0.8 m) 위 HAUS NOWHERE 미니어처 + 그래피티 건물 3종
    box('EX_plinth', c, -4.5, -3.0, 0.0, 4.5, 3.0, 0.8, M['plinth'])
    P = 0.8
    import_prop('main/office_building.glb', 'EX_city_haus', c, (0.0, 0.0, P), height=3.0)
    import_prop('etc/building_1.glb', 'EX_city_b1', c, (-2.9, -1.2, P), height=1.6, rz=-90)
    import_prop('etc/building_2.glb', 'EX_city_b2', c, (2.9, -1.5, P), height=1.4, rz=90)
    import_prop('etc/building_3.glb', 'EX_city_b3', c, (2.8, 1.7, P), height=1.9, rz=180)
    import_prop('main/DJ.glb', 'EX_dj', c, (8.8, 7.2, 0.0), height=2.4, rz=-45)
    import_prop('main/display.glb', 'EX_display', c, (-16.4, 6.0, 0.0), width=6.0, rz=90)


# 빌드 순서 = inner-layout.json 의 floors 순서
FLOORS = [
    (FLOOR_1, build_floor_1),
]
```

- [ ] **Step 3: 파이프라인 다시 쓰기** — `tools/nowhere/blender/inner_build.py` 전체를 아래로 바꾼다

```python
# HAUS NOWHERE — 성수(HAUS NOWHERE) 실내 뷰 빌드 파이프라인.
# 층마다 새 장면 → 껍데기 · 전시물 배치 → 데스크톱 GLB · 미리보기 → 전시물 추가 감축 → 모바일 GLB → inner-layout.json · HDRI.
# 실행: /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python tools/nowhere/blender/inner_build.py
# 일부 층만: NW_FLOORS=b1,12 (레이아웃 JSON 은 항상 모든 층으로 쓴다)
# 산출: build/nowhere/raw-inner/inner-<층>.glb · raw-inner/mobile/inner-<층>.glb · build/nowhere/renders/inner-<층>.png
#       public/assets/nowhere-inner/{inner-layout.json, env-1k.hdr, renders/inner-<층>.webp}
import bpy, os, sys, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mathutils import Vector
import inner_common as K
from inner_floors import FLOORS


def materials(F):
    t = F['floor_tex']
    return {
        'floor': K.mat_tiled(f"IN_floor_{F['id']}", os.path.join(K.SRC, t['dir'], t['diffuse']), os.path.join(K.SRC, t['dir'], t['normal']), tile=t['tile'], rough=t['rough']),
        'concrete': K.mat_flat('IN_concrete', '#CFCBC3', 0.9),
        'ceiling': K.mat_flat('IN_ceiling_mat', '#E4E1DA', 0.95),
        'core': K.mat_flat('IN_core_mat', '#3A3B3D', 0.7),
        'plinth': K.mat_flat('IN_plinth_mat', '#2B2C2E', 0.6),
        'glass': K.mat_flat('IN_glass_mat', '#B9C7CC', 0.05, 0.0, alpha=0.22),
        'mullion': K.mat_flat('IN_mullion_mat', '#2F3133', 0.4, 0.6),
        'brass': K.mat_flat('EX_brass_mat', '#B08D57', 0.35, 0.8),
        'screen': K.mat_flat('EX_screen_mat', '#05070A', 0.3),
    }


def export_glb(c, path):
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
    bg.inputs['Color'].default_value = (*K._lin('#C9CECD'), 1.0)
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
    _ = im.pixels[0]  # 경로를 바꾸기 전에 픽셀을 메모리에 올림(안 하면 save() 가 "does not have any image data")
    im.filepath_raw = os.path.join(K.PUB, 'renders', f"inner-{F['id']}.webp")
    im.file_format = 'WEBP'
    im.save()


def mobile_variant(c):
    """모바일: 전시물(EX_*, 받침대 · 명판 · 화면 제외)을 하나당 MOBILE_MAX_TRIS 로 더 줄인다."""
    for o in list(c.all_objects):
        if o.type == 'MESH' and o.name.startswith('EX_') and not o.name.startswith(('EX_plinth', 'EX_nameplate', 'EX_display_screen')):
            K.decimate_to(o, K.MOBILE_MAX_TRIS)


def export_env():
    im = bpy.data.images.load(os.path.join(K.SRC, 'env', 'modern_bathroom_1k.exr'))
    _ = im.pixels[0]  # 위와 같은 이유로 경로 변경 전에 픽셀 로드
    im.filepath_raw = os.path.join(K.PUB, 'env-1k.hdr')
    im.file_format = 'HDR'
    im.save()


def main():
    t0 = time.time()
    only = {s.strip() for s in os.environ.get('NW_FLOORS', '').split(',') if s.strip()}
    for d in (K.RAW, K.RAW_MOBILE, K.PUB, os.path.join(K.PUB, 'renders'), os.path.join(K.PUB, 'mobile'), os.path.join(K.ROOT, 'build', 'nowhere', 'renders')):
        os.makedirs(d, exist_ok=True)
    for F, builder in FLOORS:
        if only and F['id'] not in only:
            continue
        K.reset_scene()   # 층마다 새 장면 — 미리보기 · AO 에 다른 층이 섞이지 않게
        M = materials(F)
        c = K.coll(f"INNER_{F['id']}")
        builder(c, M)
        export_glb(c, os.path.join(K.RAW, f"inner-{F['id']}.glb"))
        render_preview(F, os.path.join(K.ROOT, 'build', 'nowhere', 'renders', f"inner-{F['id']}.png"))
        mobile_variant(c)
        export_glb(c, os.path.join(K.RAW_MOBILE, f"inner-{F['id']}.glb"))
    K.reset_scene()
    export_env()
    layout = {'building': 'haus', 'defaultFloor': '1', 'env': 'assets/nowhere-inner/env-1k.hdr', 'floors': [K.floor_json(F) for F, _ in FLOORS]}
    with open(os.path.join(K.PUB, 'inner-layout.json'), 'w', encoding='utf-8') as f:
        json.dump(layout, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print(f'[inner_build] done in {round(time.time() - t0, 1)} s')


if __name__ == '__main__':
    main()
```

- [ ] **Step 4: 최적화 스크립트를 생성된 층 전부 · 모바일 원본으로** — `package.json` 의 `"nowhere:inner:optimize"` 줄 전체를 아래로 바꾼다(모바일 텍스처는 스펙대로 512)

```json
    "nowhere:inner:optimize": "mkdir -p public/assets/nowhere-inner/mobile && for P in build/nowhere/raw-inner/inner-*.glb; do F=$(basename $P); npx -y @gltf-transform/cli@4.1.1 optimize $P public/assets/nowhere-inner/$F --compress meshopt --texture-compress webp --texture-size 1024 --instance false --join false --flatten false --palette false --simplify false && npx -y @gltf-transform/cli@4.1.1 optimize build/nowhere/raw-inner/mobile/$F public/assets/nowhere-inner/mobile/$F --compress meshopt --texture-compress webp --texture-size 512 --instance false --join false --flatten false --palette false --simplify false || exit 1; done",
```
확인: `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('ok')"` → `ok`

- [ ] **Step 5: 빌드 · 최적화 · 1F 동일성 확인**

Run:
```bash
npm run nowhere:inner:build 2>&1 | grep -E "inner_build|Error|Traceback"
npm run nowhere:inner:optimize 2>&1 | grep -E "→|rror" | tail -4
git diff --stat public/assets/nowhere-inner/inner-layout.json
node -e "import('./tests/lib/glb.mjs').then(({readGlbJson,triangleCount})=>{for(const p of ['public/assets/nowhere-inner/inner-1.glb','public/assets/nowhere-inner/mobile/inner-1.glb'])console.log(p,triangleCount(readGlbJson(p)))})"
```
Expected: 데스크톱 · 모바일 export 두 줄과 `done`, 최적화 로그 두 줄, `inner-layout.json` 은 `1 insertion`(끝 줄바꿈) 수준만 바뀜, 1F 데스크톱 삼각형은 1단계와 비슷(약 29만 9천), 모바일은 크게 줄어듦(30만 미만에 여유). 모바일 GLB 가 3 MB 를 넘으면 모바일 `--texture-size` 를 256 으로 되돌리고 그 사실을 보고한다.
`build/nowhere/renders/inner-1.png` 를 Read 로 열어 1단계와 같은 구도인지 확인한다.

- [ ] **Step 6: 통과 확인**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# fail 0`(Task 1 의 GLB 계약 · 예산 테스트 포함)

- [ ] **Step 7: 스테이징 · 커밋 메시지 제안**

```bash
git add tools/nowhere/blender/inner_common.py tools/nowhere/blender/inner_floors.py tools/nowhere/blender/inner_build.py package.json public/assets/nowhere-inner/inner-layout.json public/assets/nowhere-inner/inner-1.glb public/assets/nowhere-inner/mobile/inner-1.glb public/assets/nowhere-inner/renders/inner-1.webp public/assets/nowhere-inner/env-1k.hdr
```
제안 메시지: `refactor(inner): 실내 빌드를 공용 도구 · 층 정의 · 파이프라인으로 나누고 층마다 새 장면, 모바일 전시물 감축`

---

### Task 3: 바닥 AO 굽기(Cycles → glTF occlusionTexture)

**Files:**
- Modify: `tools/nowhere/blender/inner_common.py`(함수 추가), `tools/nowhere/blender/inner_floors.py`(1F 바닥을 평면으로), `tools/nowhere/blender/inner_build.py`(굽기 호출), `tests/nowhere-inner-glb.test.mjs`(테스트 추가)
- 산출(스테이징): `inner-1.glb`, `mobile/inner-1.glb`, `renders/inner-1.webp`, `inner-layout.json`

**Interfaces:**
- Consumes: Task 2 의 `inner_common` · `FLOORS` · `inner_build.main`.
- Produces: `inner_common.plane(name, c, x0, y0, x1, y1, z, mat)`(위를 보는 사각형 한 장, UV `UVMap` = x, y), `inner_common.bake_floor_ao(floor, tag, size=1024, samples=48, distance=2.5)`. 모든 층의 바닥은 `plane('IN_floor', …)` 로 만든다(AO 굽기는 면이 겹치지 않는 평면이어야 한다). GLB 계약: `IN_floor` 프리미티브에 `TEXCOORD_1`, 재질 `occlusionTexture.texCoord === 1`.

- [ ] **Step 1: 실패하는 테스트 추가** — `tests/nowhere-inner-glb.test.mjs` 끝에 덧붙인다

```js

test('(e) 바닥 AO: IN_floor 재질에 occlusionTexture(texCoord 1)와 TEXCOORD_1 이 있다', () => {
  for (const f of L.floors) {
    for (const [key] of TIERS) {
      const j = load(f[key]);
      const node = j.nodes.find((n) => n.name === 'IN_floor' && n.mesh != null);
      assert.ok(node, `${f[key]}: IN_floor 노드 없음`);
      for (const p of j.meshes[node.mesh].primitives) {
        const m = j.materials[p.material];
        assert.equal(m.occlusionTexture?.texCoord, 1, `${f[key]}: occlusionTexture.texCoord`);
        assert.ok('TEXCOORD_1' in p.attributes, `${f[key]}: TEXCOORD_1 없음`);
      }
    }
  }
});
```
Run: `node --test tests/nowhere-inner-glb.test.mjs 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: `not ok 5 - (e) …`, `# fail 1`

- [ ] **Step 2: 평면 · AO 굽기 함수 추가** — `tools/nowhere/blender/inner_common.py` 의 `def tri_count(obj):` 바로 앞에 삽입

```python
def plane(name, c, x0, y0, x1, y1, z, mat):
    """위를 보는 수평 사각형 한 장(UV 'UVMap' = x, y m 단위). 바닥 — AO 굽기는 면이 겹치지 않는 평면이어야 한다."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], [], [(0, 1, 2, 3)])
    uv = me.uv_layers.new(name='UVMap')
    for lp in me.loops:
        co = me.vertices[lp.vertex_index].co
        uv.data[lp.index].uv = (co.x, co.y)
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me)
    c.objects.link(o)
    return o


def gltf_output_group():
    """glTF 내보내기가 occlusion 을 읽는 노드 그룹('glTF Material Output', 입력 Occlusion)."""
    g = bpy.data.node_groups.get('glTF Material Output')
    if g is None:
        g = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
        g.interface.new_socket(name='Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
    return g


def bake_floor_ao(floor, tag, size=1024, samples=48, distance=2.5):
    """바닥(IN_floor 평면)에 AO 를 굽는다: 두 번째 UV 'AO'(바닥 전체 0…1) + 이미지 → glTF occlusionTexture(texCoord 1).
    벽 · 기둥 · 전시물 아래 접지 그늘만 굽고, 실시간 조명(반구광 · 방향광)은 웹에서 그대로 쓴다."""
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = samples
    sc.cycles.device = 'CPU'
    sc.render.bake.target = 'IMAGE_TEXTURES'
    w = sc.world or bpy.data.worlds.new('IN_bake_world')
    sc.world = w
    w.light_settings.distance = distance   # AO 거리(m)
    me = floor.data
    xs = [v.co.x for v in me.vertices]
    ys = [v.co.y for v in me.vertices]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    uv = me.uv_layers.new(name='AO')
    for lp in me.loops:
        co = me.vertices[lp.vertex_index].co
        uv.data[lp.index].uv = ((co.x - x0) / (x1 - x0), (co.y - y0) / (y1 - y0))
    img = bpy.data.images.new(f'IN_floor_ao_{tag}', size, size, alpha=False)
    img.colorspace_settings.name = 'Non-Color'
    nt = me.materials[0].node_tree
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    uvn = nt.nodes.new('ShaderNodeUVMap')
    uvn.uv_map = 'AO'
    nt.links.new(uvn.outputs['UV'], tex.inputs['Vector'])
    for n in nt.nodes:
        n.select = False
    tex.select = True
    nt.nodes.active = tex          # 굽기 대상 이미지(바닥 무늬 텍스처가 아니라 이 노드)
    bpy.ops.object.select_all(action='DESELECT')
    floor.select_set(True)
    bpy.context.view_layer.objects.active = floor
    bpy.ops.object.bake(type='AO', margin=4, use_clear=True)
    path = os.path.join(RAW, 'ao', f'inner-{tag}-ao.png')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    sep = nt.nodes.new('ShaderNodeSeparateColor')
    nt.links.new(tex.outputs['Color'], sep.inputs['Color'])
    grp = nt.nodes.new('ShaderNodeGroup')
    grp.node_tree = gltf_output_group()
    nt.links.new(sep.outputs['Red'], grp.inputs['Occlusion'])
    print(f'[inner_build] AO baked {path}')
```

- [ ] **Step 3: 1F 바닥을 평면으로** — `tools/nowhere/blender/inner_floors.py`

import 줄 찾기:
```python
from inner_common import box, import_prop, ribbon, curtain, elevator_core, columns
```
바꾸기:
```python
from inner_common import box, plane, import_prop, ribbon, curtain, elevator_core, columns
```
`build_floor_1` 에서 찾기:
```python
    box('IN_floor', c, X0 - T, Y0 - T, -0.2, X1 + T, Y1 + T, 0.0, M['floor'])
```
바꾸기:
```python
    plane('IN_floor', c, X0 - T, Y0 - T, X1 + T, Y1 + T, 0.0, M['floor'])
```

- [ ] **Step 4: 파이프라인에서 굽기** — `tools/nowhere/blender/inner_build.py` 의 `main()` 에서 찾기:
```python
        builder(c, M)
        export_glb(c, os.path.join(K.RAW, f"inner-{F['id']}.glb"))
```
바꾸기:
```python
        builder(c, M)
        K.bake_floor_ao(bpy.data.objects['IN_floor'], F['id'])
        export_glb(c, os.path.join(K.RAW, f"inner-{F['id']}.glb"))
```

- [ ] **Step 5: 빌드 · 최적화 · AO 확인**

Run: `npm run nowhere:inner:build 2>&1 | grep -E "inner_build|Error|Traceback" && npm run nowhere:inner:optimize 2>&1 | grep -E "→|rror" | tail -4`
Expected: `AO baked …/inner-1-ao.png`, export 두 줄, `done`(1F 굽기 수십 초~2분).
`build/nowhere/raw-inner/ao/inner-1-ao.png` 를 Read 로 열어 기둥 · 받침대 · 벽 · 코어 둘레가 어둡고 넓은 바닥이 밝은지 확인한다.
Blender 5.3 에서 `w.light_settings.distance` · `bake.target` · 노드 그룹 인터페이스가 다른 이름이면 같은 뜻으로 가장 작게 고치고(열거값은 `bl_rna` 로 읽어서) 보고서에 오류 문구와 함께 적는다.

- [ ] **Step 6: 통과 확인 · 브라우저 확인**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"` → `# fail 0`
브라우저: `http://localhost:4173/?ver=ds2&noIntro=1` 에서 `await state.page.evaluate(() => window.__NW_APP.interior.enter('haus'))` 후 몇 초 기다려 스크린샷 — 받침대 · 기둥 아래 바닥에 접지 그늘이 보이고 콘솔 오류가 없는지 확인. `window.__NW_APP.interior.scene.getObjectByName('IN_floor').material.aoMap` 이 있는지 `evaluate` 로 확인.

- [ ] **Step 7: 스테이징 · 커밋 메시지 제안**

```bash
git add tools/nowhere/blender/inner_common.py tools/nowhere/blender/inner_floors.py tools/nowhere/blender/inner_build.py tests/nowhere-inner-glb.test.mjs public/assets/nowhere-inner/inner-1.glb public/assets/nowhere-inner/mobile/inner-1.glb public/assets/nowhere-inner/renders/inner-1.webp public/assets/nowhere-inner/inner-layout.json
```
제안 메시지: `feat(inner): 층 바닥 AO 굽기(Cycles → glTF occlusionTexture) — 기둥 · 받침대 · 벽 둘레 접지 그늘`

---
### Task 4: B1F 카페 빌드

**Files:**
- Modify: `tools/nowhere/blender/inner_floors.py`(층 정의 · 배치 추가), `tests/nowhere-inner.test.mjs`(테스트 추가)
- 산출(스테이징): `inner-b1.glb`, `mobile/inner-b1.glb`, `renders/inner-b1.webp`, `inner-layout.json`

**Interfaces:**
- Consumes: Task 2 · 3 의 `box, plane, import_prop, elevator_core, columns`, `materials(F)` 키, `NW_FLOORS`.
- Produces: 층 `b1`(`B1F 카페`, elevation −4.5, 층고 4.0, bounds Three `[-13, -13, 13, 13]`, 창 없음 · 출구 없음). `FLOORS` 순서 `[B1F, 1F]`.

배치(스펙 §2.2): 보라 패브릭 바닥, `table` 세트 6개(테이블 높이 0.75 m), 버섯 몬스터 손님 2개(1.2 m), 북측 엘리베이터 코어, 지하라 창 없는 콘크리트 벽.

- [ ] **Step 1: 실패하는 테스트 추가** — `tests/nowhere-inner.test.mjs` 끝에 덧붙인다

```js

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
```
Run: `node --test tests/nowhere-inner.test.mjs 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: `not ok 6 - (f) …`, `# fail 1`

- [ ] **Step 2: 층 정의 · 배치 추가** — `tools/nowhere/blender/inner_floors.py` 의 `# 빌드 순서 = inner-layout.json 의 floors 순서` 줄 바로 앞에 삽입

```python
# ═════════════ B1F 카페 ═════════════
# Blender 평면: x −13…13, y −13…13, 층고 4 m, 창 없음(지하). 북측 엘리베이터 코어(앞면 y 11.5).
FLOOR_B1 = {
    'id': 'b1', 'label': 'B1F 카페',
    'glb': 'assets/nowhere-inner/inner-b1.glb', 'mobileGlb': 'assets/nowhere-inner/mobile/inner-b1.glb',
    'elevation': -4.5, 'bounds_bl': (-13.0, -13.0, 13.0, 13.0), 'ceiling': 4.0,
    'floor_tex': {'dir': 'b1f', 'diffuse': 'floor_b1_diffuse.png', 'normal': 'floor_b1_normal.png', 'tile': 1.5, 'rough': 0.85},
    'spawn': ((0.0, 7.5, 1.7), (0.0, 0.0, 1.5)),
    'elevator': ((0.0, 11.0, 0.0), 2.5),
    'exhibits': [
        ('cafe', '지하 카페', '테이블 여섯 개와 버섯 몬스터 손님', (0.0, -2.5, 1.0)),
    ],
    'tour': [
        ((-9.0, -10.0, 2.0), (0.0, -2.5, 0.8), '지하 카페 — 버섯 몬스터 손님이 앉은 테이블', 5),
        ((9.0, -10.0, 2.2), (3.5, 4.0, 0.9), '버섯 손님 — 오늘의 주문을 기다리는 중', 4),
    ],
}
TABLES_B1 = ((-7.0, -6.0), (0.0, -6.0), (7.0, -6.0), (-7.0, 1.0), (0.0, 1.0), (7.0, 1.0))


def build_floor_b1(c, M):
    X0, Y0, X1, Y1 = FLOOR_B1['bounds_bl']
    H = FLOOR_B1['ceiling']
    T = 0.3
    plane('IN_floor', c, X0 - T, Y0 - T, X1 + T, Y1 + T, 0.0, M['floor'])
    box('IN_ceiling', c, X0 - T, Y0 - T, H, X1 + T, Y1 + T, H + 0.2, M['ceiling'])
    # 지하라 창 없는 콘크리트 벽
    box('IN_wall_s', c, X0 - T, Y0 - T, 0.0, X1 + T, Y0, H, M['concrete'])
    box('IN_wall_n', c, X0 - T, Y1, 0.0, X1 + T, Y1 + T, H, M['concrete'])
    box('IN_wall_w', c, X0 - T, Y0, 0.0, X0, Y1, H, M['concrete'])
    box('IN_wall_e', c, X1, Y0, 0.0, X1 + T, Y1, H, M['concrete'])
    elevator_core(c, M, 11.5, Y1, H)
    columns(c, M, ((-10.5, 0.0), (10.5, 0.0)), H)
    for i, (x, y) in enumerate(TABLES_B1):
        import_prop('b1f/table.glb', f'EX_table_{i}', c, (x, y, 0.0), height=0.75, rz=0.0)
    import_prop('etc/Mushroom.glb', 'EX_guest_0', c, (-3.5, -2.5, 0.0), height=1.2, rz=0.0)
    import_prop('etc/Monster1_room.glb', 'EX_guest_1', c, (3.5, 4.0, 0.0), height=1.2, rz=180.0)
```

`FLOORS` 찾기:
```python
FLOORS = [
    (FLOOR_1, build_floor_1),
]
```
바꾸기:
```python
FLOORS = [
    (FLOOR_B1, build_floor_b1),
    (FLOOR_1, build_floor_1),
]
```

- [ ] **Step 3: 빌드 · 최적화**

Run: `NW_FLOORS=b1 npm run nowhere:inner:build 2>&1 | grep -E "inner_build|Error|Traceback" && npm run nowhere:inner:optimize 2>&1 | grep -E "→|rror" | tail -6`
Expected: `AO baked …/inner-b1-ao.png`, B1F 데스크톱 · 모바일 export, `done`, 최적화 로그(층마다 두 줄)

- [ ] **Step 4: 미리보기로 배치 · 방향 확인(필요하면 rz · 위치 조정 후 Step 3 재실행)**

`build/nowhere/renders/inner-b1.png`(엘리베이터 앞에서 남쪽을 본 구도)를 Read 로 연다:
- 테이블 세트 6개가 두 줄로 놓이고 서로 · 기둥과 겹치지 않음, 의자 · 테이블이 바닥에 붙어 있음
- 버섯 손님 두 마리가 테이블 사이에 서서 얼굴이 방 안쪽(서로 · 카메라 쪽)을 봄
- 벽 · 천장 · 코어가 닫혀 있고 창 · 빈틈이 없음
앞면이 반대면 그 `import_prop` 의 `rz` 에 180 을 더하고(옆을 보면 ±90), 겹치면 위치를 1 m 안에서 옮기되 `exhibits` · `tour` 의 해당 좌표도 같이 고친다. 미리보기 한 장으로 판단이 어려우면 `build/` 아래에 임시 확인 렌더를 만들어도 된다(커밋하지 않음). 최종 rz · 위치와 본 것을 보고서에 적는다.

- [ ] **Step 5: 통과 확인**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# fail 0` — `tests/nowhere-inner-glb.test.mjs` 가 B1F 의 이름 규칙 · 지점(장애물 밖) · 삼각형 예산 · AO 도 검사한다. (c) 가 실패하면 그 지점이나 전시물 위치를 고쳐 다시 빌드한다.

- [ ] **Step 6: 스테이징 · 커밋 메시지 제안**

```bash
git add tools/nowhere/blender/inner_floors.py tests/nowhere-inner.test.mjs public/assets/nowhere-inner/inner-b1.glb public/assets/nowhere-inner/mobile/inner-b1.glb public/assets/nowhere-inner/renders/inner-b1.webp public/assets/nowhere-inner/inner-layout.json
```
(최적화가 다시 만든 `inner-1.glb` · `mobile/inner-1.glb` 가 바이트 단위로 바뀌었으면 `git diff --stat` 으로 보고 함께 스테이징한다.)
제안 메시지: `feat(inner): B1F 카페 빌드(테이블 6 · 버섯 손님 2, 창 없는 지하)`

---

### Task 5: 12F 빌드(커튼월 타워 층)

**Files:**
- Modify: `tools/nowhere/blender/inner_floors.py`, `tests/nowhere-inner.test.mjs`
- 산출(스테이징): `inner-12.glb`, `mobile/inner-12.glb`, `renders/inner-12.webp`, `inner-layout.json`

**Interfaces:**
- Consumes: `curtain, elevator_core, columns, plane, box, import_prop`, `M['mullion']`, `M['plinth']`.
- Produces: `inner_floors.tower_shell(c, M, F)`(타워 층 공용 껍데기 — Task 6 이 다시 씀), 층 `12`(`12F`, elevation 55, 층고 4.2, bounds Three `[-15, -11, 15, 11]`). `FLOORS` 순서 `[B1F, 1F, 12F]`.

배치(스펙 §2.2): 머스터드 카펫 바닥, 남 · 동 · 서 커튼월(전면 유리), `Cowboy` 디오라마(받침대 위 폭 4 m), `Smoking` 흡연 부스(2.1 m), `door_2` 붉은 커튼 석조 포털(2.9 m, 북쪽 벽 앞).

- [ ] **Step 1: 실패하는 테스트 추가** — `tests/nowhere-inner.test.mjs` 끝에 덧붙인다

```js

test('(g) 12F: 타워 층(elevation 55 · 층고 4.2 m · 30 × 22 m)', () => {
  const L = JSON.parse(readFileSync(layoutUrl, 'utf8'));
  const f = L.floors.find((x) => x.id === '12');
  assert.ok(f, '12F 없음');
  assert.equal(f.label, '12F');
  assert.equal(f.elevation, 55);
  assert.equal(f.ceiling, 4.2);
  assert.deepEqual(f.bounds, [-15, -11, 15, 11]);
});
```
Run: `node --test tests/nowhere-inner.test.mjs 2>&1 | grep -E "^not ok|^# (pass|fail)"` → `not ok 7 - (g) …`, `# fail 1`

- [ ] **Step 2: 타워 껍데기 · 12F 추가** — `tools/nowhere/blender/inner_floors.py` 의 `# 빌드 순서 = inner-layout.json 의 floors 순서` 줄 바로 앞에 삽입

```python
# ═════════════ 타워 층 공용 껍데기 ═════════════
# 타워 평면: x −15…15, y −11…11. 남 · 동 · 서 커튼월(외관 타워의 유리 커튼월), 북측 콘크리트 벽 + 엘리베이터 코어(앞면 y 9.5), 기둥 2개.
def tower_shell(c, M, F):
    X0, Y0, X1, Y1 = F['bounds_bl']
    H = F['ceiling']
    T = 0.3
    plane('IN_floor', c, X0 - T, Y0 - T, X1 + T, Y1 + T, 0.0, M['floor'])
    box('IN_ceiling', c, X0 - T, Y0 - T, H, X1 + T, Y1 + T, H + 0.2, M['ceiling'])
    curtain(c, M, 's', X0 - T, Y0 - T, X1 + T, Y0, H)
    curtain(c, M, 'w', X0 - T, Y0, X0, Y1, H)
    curtain(c, M, 'e', X1, Y0, X1 + T, Y1, H)
    box('IN_wall_n', c, X0 - T, Y1, 0.0, X1 + T, Y1 + T, H, M['concrete'])
    elevator_core(c, M, 9.5, Y1, H)
    columns(c, M, ((-7.5, 2.0), (7.5, 2.0)), H)


# ═════════════ 12F ═════════════
FLOOR_12 = {
    'id': '12', 'label': '12F',
    'glb': 'assets/nowhere-inner/inner-12.glb', 'mobileGlb': 'assets/nowhere-inner/mobile/inner-12.glb',
    'elevation': 55.0, 'bounds_bl': (-15.0, -11.0, 15.0, 11.0), 'ceiling': 4.2,
    'floor_tex': {'dir': '12f', 'diffuse': 'floor_12_diffuse.png', 'normal': 'floor_12_normal.png', 'tile': 2.0, 'rough': 0.9},
    'spawn': ((0.0, 6.0, 1.7), (0.0, -4.0, 1.7)),
    'elevator': ((0.0, 9.0, 0.0), 2.5),
    'exhibits': [
        ('cowboy', '카우보이 디오라마', '받침대 위 서부 마을 디오라마', (-6.0, -2.0, 1.5)),
        ('smoking', '흡연 부스', '커튼월 앞 흡연 부스', (8.0, -3.0, 1.2)),
        ('portal', '붉은 커튼 포털', '석조 포털과 붉은 커튼', (-10.0, 10.4, 1.6)),
    ],
    'tour': [
        ((-1.0, -7.0, 2.0), (-6.0, -2.0, 1.2), '카우보이 디오라마 — 받침대 위 서부 마을', 5),
        ((3.0, -8.0, 1.8), (8.0, -3.0, 1.2), '흡연 부스 — 커튼월 너머 성수', 4),
        ((-5.0, 4.0, 1.8), (-10.0, 10.4, 1.6), '붉은 커튼 포털', 4),
    ],
}


def build_floor_12(c, M):
    tower_shell(c, M, FLOOR_12)
    box('EX_plinth_cowboy', c, -8.5, -4.5, 0.0, -3.5, 0.5, 0.6, M['plinth'])
    import_prop('12f/Cowboy.glb', 'EX_cowboy', c, (-6.0, -2.0, 0.6), width=4.0, rz=0.0)
    import_prop('12f/Smoking.glb', 'EX_smoking', c, (8.0, -3.0, 0.0), height=2.1, rz=0.0)
    import_prop('12f/door_2.glb', 'EX_portal', c, (-10.0, 10.4, 0.0), height=2.9, rz=0.0)
```

`FLOORS` 를 `[(FLOOR_B1, build_floor_b1), (FLOOR_1, build_floor_1), (FLOOR_12, build_floor_12)]` 로 바꾼다:
```python
FLOORS = [
    (FLOOR_B1, build_floor_b1),
    (FLOOR_1, build_floor_1),
    (FLOOR_12, build_floor_12),
]
```

- [ ] **Step 3: 빌드 · 최적화**

Run: `NW_FLOORS=12 npm run nowhere:inner:build 2>&1 | grep -E "inner_build|Error|Traceback" && npm run nowhere:inner:optimize 2>&1 | grep -E "→|rror" | tail -6`
Expected: `AO baked …/inner-12-ao.png`, 12F export 두 줄, `done`

- [ ] **Step 4: 미리보기로 배치 · 방향 확인(필요하면 조정 후 Step 3 재실행)**

`build/nowhere/renders/inner-12.png` 를 Read 로 연다:
- 남 · 동 · 서가 바닥 턱 · 유리 · 멀리언으로 된 커튼월이고 북쪽은 콘크리트 벽 · 코어
- 카우보이 디오라마가 받침대 위에 올라 앞면(마을 정면)이 방 안쪽(+x 또는 −y)을 봄, 받침대 밖으로 넘치지 않음
- 흡연 부스 입구가 방 안쪽을 봄, 붉은 커튼 포털이 북쪽 벽 앞에서 남쪽을 봄(벽에 박히지 않음)
조정 규칙은 Task 4 Step 4 와 같다(rz ±90/180, 위치 1 m 안, `exhibits` · `tour` 좌표 동기화, 보고).

- [ ] **Step 5: 통과 확인**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"` → `# fail 0`

- [ ] **Step 6: 스테이징 · 커밋 메시지 제안**

```bash
git add tools/nowhere/blender/inner_floors.py tests/nowhere-inner.test.mjs public/assets/nowhere-inner/inner-12.glb public/assets/nowhere-inner/mobile/inner-12.glb public/assets/nowhere-inner/renders/inner-12.webp public/assets/nowhere-inner/inner-layout.json
```
제안 메시지: `feat(inner): 12F 빌드(커튼월 타워 층 · 카우보이 디오라마 · 흡연 부스 · 붉은 커튼 포털)`

---

### Task 6: 13F 몬스터 룸 빌드 + 4개 층 확인

**Files:**
- Modify: `tools/nowhere/blender/inner_floors.py`, `tests/nowhere-inner.test.mjs`
- 산출(스테이징): `inner-13.glb`, `mobile/inner-13.glb`, `renders/inner-13.webp`, `inner-layout.json`

**Interfaces:**
- Consumes: Task 5 의 `tower_shell`, `M['plinth']` · `M['brass']`.
- Produces: 층 `13`(`13F 몬스터 룸`, elevation 60). `FLOORS` 순서 `[B1F, 1F, 12F, 13F]` — 이후 Task 들은 이 4개 층을 전제로 한다.

배치(스펙 §2.2): 분홍 테라조 바닥, `nail` 거대 손(4 m), `sphinx`(길이 3.8 m), 버섯 몬스터 4종 `Monster1/849/1083_room` · `Mushroom`(1.6 m, 이름 명판 받침대 — 받침대 앞면에 황동 명판).

- [ ] **Step 1: 실패하는 테스트 추가** — `tests/nowhere-inner.test.mjs` 끝에 덧붙인다

```js

test('(h) 4개 층: 순서 B1 · 1 · 12 · 13, 층 높이 −4.5 · 0 · 55 · 60, 이름', () => {
  const L = JSON.parse(readFileSync(layoutUrl, 'utf8'));
  assert.deepEqual(L.floors.map((f) => f.id), ['b1', '1', '12', '13']);
  assert.deepEqual(L.floors.map((f) => f.elevation), [-4.5, 0, 55, 60]);
  assert.deepEqual(L.floors.map((f) => f.label), ['B1F 카페', '1F 로비', '12F', '13F 몬스터 룸']);
  assert.equal(L.defaultFloor, '1');
});
```
Run: `node --test tests/nowhere-inner.test.mjs 2>&1 | grep -E "^not ok|^# (pass|fail)"` → `not ok 8 - (h) …`, `# fail 1`

- [ ] **Step 2: 13F 추가** — `tools/nowhere/blender/inner_floors.py` 의 `# 빌드 순서 = inner-layout.json 의 floors 순서` 줄 바로 앞에 삽입

```python
# ═════════════ 13F 몬스터 룸 ═════════════
FLOOR_13 = {
    'id': '13', 'label': '13F 몬스터 룸',
    'glb': 'assets/nowhere-inner/inner-13.glb', 'mobileGlb': 'assets/nowhere-inner/mobile/inner-13.glb',
    'elevation': 60.0, 'bounds_bl': (-15.0, -11.0, 15.0, 11.0), 'ceiling': 4.2,
    'floor_tex': {'dir': '13f', 'diffuse': 'floor_13_diffuse.png', 'normal': 'floor_13_normal.png', 'tile': 2.0, 'rough': 0.3},
    'spawn': ((0.0, 6.0, 1.7), (0.0, -4.0, 1.7)),
    'elevator': ((0.0, 9.0, 0.0), 2.5),
    'exhibits': [
        ('nail', '거대한 손', '네일 아트를 한 높이 4 m 의 손', (-6.0, -4.0, 2.0)),
        ('sphinx', '스핑크스', '길이 3.8 m 의 스핑크스', (6.0, -4.0, 1.2)),
        ('monsters', '버섯 몬스터', '이름 명판 받침대 위의 버섯 몬스터 네 종', (0.0, 4.0, 1.0)),
    ],
    'tour': [
        ((-1.0, -9.0, 2.2), (-6.0, -4.0, 2.0), '거대한 손 — 네일 아트를 한 4 m 손', 5),
        ((1.0, -9.0, 1.8), (6.0, -4.0, 1.0), '스핑크스', 4),
        ((0.0, 0.5, 1.8), (-9.25, 4.0, 1.0), '버섯 몬스터 — 이름 명판 받침대', 5),
    ],
}
# (에셋, x) — 북쪽 줄 y 4.0, 받침대 1.4 × 1.4 × 0.4 m, 앞면(−y)에 황동 명판
MONSTERS_13 = (
    ('etc/Monster1_room.glb', -11.0),
    ('etc/Monster849_room.glb', -7.5),
    ('etc/Monster1083_room.glb', 7.5),
    ('etc/Mushroom.glb', 11.0),
)


def build_floor_13(c, M):
    tower_shell(c, M, FLOOR_13)
    import_prop('13f/nail.glb', 'EX_nail', c, (-6.0, -4.0, 0.0), height=4.0, rz=0.0)
    import_prop('13f/sphinx.glb', 'EX_sphinx', c, (6.0, -4.0, 0.0), width=3.8, rz=0.0)
    for i, (rel, x) in enumerate(MONSTERS_13):
        box(f'EX_plinth_m{i}', c, x - 0.7, 3.3, 0.0, x + 0.7, 4.7, 0.4, M['plinth'])
        box(f'EX_nameplate_m{i}', c, x - 0.35, 3.26, 0.12, x + 0.35, 3.3, 0.3, M['brass'])
        import_prop(rel, f'EX_monster_{i}', c, (x, 4.0, 0.4), height=1.6, rz=180.0)
```

`FLOORS` 를 4개 층으로:
```python
FLOORS = [
    (FLOOR_B1, build_floor_b1),
    (FLOOR_1, build_floor_1),
    (FLOOR_12, build_floor_12),
    (FLOOR_13, build_floor_13),
]
```

- [ ] **Step 3: 빌드 · 최적화**

Run: `NW_FLOORS=13 npm run nowhere:inner:build 2>&1 | grep -E "inner_build|Error|Traceback" && npm run nowhere:inner:optimize 2>&1 | grep -E "→|rror" | tail -8`
Expected: `AO baked …/inner-13-ao.png`, 13F export 두 줄, `done`

- [ ] **Step 4: 미리보기로 배치 · 방향 확인(필요하면 조정 후 Step 3 재실행)**

`build/nowhere/renders/inner-13.png` 를 Read 로 연다:
- 거대한 손이 손바닥 · 손톱이 보이게 서 있고 천장(4.2 m)에 닿지 않음, 스핑크스가 옆모습 또는 얼굴이 방 안쪽을 봄
- 버섯 몬스터 네 마리가 받침대 위에서 얼굴이 남쪽(방 안쪽)을 보고, 받침대 앞면에 황동 명판이 보임
조정 규칙은 Task 4 Step 4 와 같다.

- [ ] **Step 5: 전체 다시 빌드 · 통과 확인** — 4개 층을 한 번에 다시 빌드해 레이아웃 · GLB 가 맞물리는지 확인

Run:
```bash
npm run nowhere:inner:build 2>&1 | grep -E "AO baked|done|Error|Traceback"
npm run nowhere:inner:optimize 2>&1 | grep -E "→|rror" | tail -8
ls -l public/assets/nowhere-inner/*.glb public/assets/nowhere-inner/mobile/*.glb
npm test 2>&1 | grep -E "^# (pass|fail)"
```
Expected: AO 4줄 · `done`, 데스크톱 GLB 4개 각 ≤ 6 MB · 모바일 4개 각 ≤ 3 MB, `# fail 0`

- [ ] **Step 6: 스테이징 · 커밋 메시지 제안**

```bash
git add tools/nowhere/blender/inner_floors.py tests/nowhere-inner.test.mjs public/assets/nowhere-inner/inner-layout.json public/assets/nowhere-inner/inner-b1.glb public/assets/nowhere-inner/inner-1.glb public/assets/nowhere-inner/inner-12.glb public/assets/nowhere-inner/inner-13.glb public/assets/nowhere-inner/mobile/inner-b1.glb public/assets/nowhere-inner/mobile/inner-1.glb public/assets/nowhere-inner/mobile/inner-12.glb public/assets/nowhere-inner/mobile/inner-13.glb public/assets/nowhere-inner/renders/inner-b1.webp public/assets/nowhere-inner/renders/inner-1.webp public/assets/nowhere-inner/renders/inner-12.webp public/assets/nowhere-inner/renders/inner-13.webp
```
제안 메시지: `feat(inner): 13F 몬스터 룸 빌드(거대한 손 · 스핑크스 · 명판 받침대 위 버섯 몬스터 4종)와 4개 층 레이아웃`

---
### Task 7: 1F 디스플레이 화면(빌드 화면 사각형 + CanvasTexture 모듈)

**Files:**
- Modify: `tools/nowhere/blender/inner_common.py`(함수 추가), `tools/nowhere/blender/inner_floors.py`(1F), `tests/nowhere-inner-glb.test.mjs`(테스트 추가)
- Create: `public/src/nowhere/inner-display.js`, `tests/nowhere-inner-display.test.mjs`
- 산출(스테이징): `inner-1.glb`, `mobile/inner-1.glb`, `renders/inner-1.webp`

**Interfaces:**
- Consumes: Task 2 의 `materials(F)['screen']`, 1F 의 `EX_display`(rz 90 → 화면이 +x).
- Produces: GLB 노드 `EX_display_screen`(+x 를 보는 세로 사각형, UV 0…1: 왼→오 = Blender +y = Three −z, 아래→위 = +z). `inner-display.js` — `DISPLAY_TITLE = 'HAUS NOWHERE SEOUL'`, `WEATHER_LABEL`(`overcast` 흐림 · `rain` 비 · `snow` 눈), `displayLines(date, weatherName) → [제목, 'HH:MM', 기상]`, `displayKey(date, weatherName) → string`, `createDisplayScreen({ THREE, mesh, getWeather, width?, height? }) → { update(date?) → boolean(다시 그렸는지), texture, canvas }`. Task 10 의 `interior.js` 가 1F 를 처음 불러올 때 만든다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/nowhere-inner-glb.test.mjs` 끝에 덧붙인다:
```js

test('(f) 1F 디스플레이 화면: EX_display_screen 은 디스플레이 앞(+x)의 얇은 세로 사각형이고 UV 가 있다', () => {
  const f1 = L.floors.find((f) => f.id === '1');
  const j = load(f1.glb);
  const boxes = meshNodeBoxes(j);
  const scr = boxes.find((b) => b.name === 'EX_display_screen');
  const disp = boxes.find((b) => b.name === 'EX_display');
  assert.ok(scr && disp, 'EX_display_screen · EX_display 없음');
  assert.ok(scr.max[0] - scr.min[0] < 0.02, `두께 ${scr.max[0] - scr.min[0]}`);
  assert.ok(scr.min[0] >= disp.max[0] - 0.001, '화면이 디스플레이 앞(+x)에 있지 않음');
  assert.ok(scr.max[2] - scr.min[2] > 2 && scr.max[1] - scr.min[1] > 1, '화면이 너무 작음');
  const node = j.nodes.find((n) => n.name === 'EX_display_screen');
  assert.ok('TEXCOORD_0' in j.meshes[node.mesh].primitives[0].attributes, 'UV 없음');
});
```

`tests/nowhere-inner-display.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { DISPLAY_TITLE, displayLines, displayKey, createDisplayScreen } from '../public/src/nowhere/inner-display.js';

test('(a) 문구: 제목 · 24시 HH:MM(두 자리) · 기상 이름', () => {
  assert.deepEqual(displayLines(new Date(2026, 10, 9, 7, 5), 'rain'), [DISPLAY_TITLE, '07:05', '비']);
  assert.deepEqual(displayLines(new Date(2026, 10, 9, 21, 30), 'overcast'), ['HAUS NOWHERE SEOUL', '21:30', '흐림']);
  assert.equal(displayLines(new Date(2026, 10, 9, 0, 0), 'snow')[2], '눈');
  assert.equal(displayLines(new Date(2026, 10, 9, 0, 0), 'fog')[2], 'fog', '모르는 기상은 이름 그대로');
});

test('(b) 키: 같은 분 · 같은 기상이면 같고, 분이나 기상이 바뀌면 다르다', () => {
  const a = new Date(2026, 10, 9, 7, 5, 1);
  const b = new Date(2026, 10, 9, 7, 5, 59);
  const c = new Date(2026, 10, 9, 7, 6, 0);
  assert.equal(displayKey(a, 'rain'), displayKey(b, 'rain'));
  assert.notEqual(displayKey(b, 'rain'), displayKey(c, 'rain'));
  assert.notEqual(displayKey(a, 'rain'), displayKey(a, 'snow'));
});

test('(c) 화면: 메시에 캔버스 텍스처 재질을 입히고, 분 · 기상이 바뀔 때만 다시 그린다', () => {
  const texts = [];
  const ctx = { fillRect() {}, fillText: (t) => texts.push(t), set fillStyle(v) {}, set font(v) {}, set textBaseline(v) {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
  class CanvasTexture { constructor(canvas) { this.image = canvas; } }
  class MeshBasicMaterial { constructor(o) { Object.assign(this, o); } }
  const THREE = { CanvasTexture, MeshBasicMaterial, SRGBColorSpace: 'srgb' };
  const mesh = { material: null };
  let weather = 'rain';
  const scr = createDisplayScreen({ THREE, mesh, getWeather: () => weather });
  assert.ok(mesh.material.map instanceof CanvasTexture);
  assert.equal(mesh.material.map.flipY, false, 'glTF UV(위가 v=0)에 맞춰 flipY=false');
  assert.equal(mesh.material.toneMapped, false);
  assert.ok(texts.includes(DISPLAY_TITLE) && texts.includes('비'));
  const t0 = new Date(2026, 10, 9, 7, 5, 0);
  scr.update(t0);
  assert.equal(scr.update(new Date(2026, 10, 9, 7, 5, 30)), false, '같은 분이면 다시 그리지 않음');
  assert.equal(scr.update(new Date(2026, 10, 9, 7, 6, 0)), true, '분이 바뀌면 다시 그림');
  weather = 'snow';
  assert.equal(scr.update(new Date(2026, 10, 9, 7, 6, 10)), true, '기상이 바뀌면 다시 그림');
  assert.ok(texts.includes('07:06') && texts.includes('눈'));
  delete globalThis.document;
});
```
Run: `node --test tests/nowhere-inner-display.test.mjs tests/nowhere-inner-glb.test.mjs 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: 모듈 없음으로 디스플레이 테스트 실패, GLB `(f)` 실패

- [ ] **Step 2: 모듈 작성** — `public/src/nowhere/inner-display.js`

```js
// HAUS NOWHERE — 1F 디스플레이 화면: 문구(순수) + CanvasTexture 화면(THREE 를 인자로 받아 node:test 에서 three 없이 import).
// 테스트: tests/nowhere-inner-display.test.mjs. 화면 메시는 빌드가 만든 EX_display_screen(UV 0…1, +x 를 봄).

export const DISPLAY_TITLE = 'HAUS NOWHERE SEOUL';
export const WEATHER_LABEL = { overcast: '흐림', rain: '비', snow: '눈' };

/** [제목, 'HH:MM'(24시, 두 자리), 기상 이름(모르면 그대로)] */
export function displayLines(date, weatherName) {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return [DISPLAY_TITLE, `${hh}:${mm}`, WEATHER_LABEL[weatherName] ?? (weatherName || '')];
}

/** 같은 분 · 같은 기상이면 다시 그리지 않도록 쓰는 키 */
export function displayKey(date, weatherName) {
  return `${Math.floor(date.getTime() / 60000)}|${weatherName || ''}`;
}

/**
 * mesh(EX_display_screen)에 캔버스 화면을 입힌다. update(date) 는 분 · 기상이 바뀔 때만 다시 그린다(스펙: 1 분마다 갱신).
 * glTF UV 는 위가 v=0 이라 flipY=false. 화면은 조명과 무관하게 밝게(MeshBasicMaterial, toneMapped=false).
 */
export function createDisplayScreen({ THREE, mesh, getWeather, width = 1024, height = 512 }) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.anisotropy = 4;
  mesh.material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  let lastKey = null;

  function draw(date, weatherName) {
    const [title, time, wx] = displayLines(date, weatherName);
    ctx.fillStyle = '#05070A';
    ctx.fillRect(0, 0, width, height);
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#6FD3FF';
    ctx.font = '600 56px ui-monospace, "SFMono-Regular", Menlo, monospace';
    ctx.fillText(title, 64, 64);
    ctx.fillStyle = '#F4F1EA';
    ctx.font = '700 180px ui-monospace, "SFMono-Regular", Menlo, monospace';
    ctx.fillText(time, 64, 150);
    ctx.fillStyle = '#B9C7CC';
    ctx.font = '500 56px system-ui, sans-serif';
    ctx.fillText(wx, 64, 370);
    texture.needsUpdate = true;
  }

  function update(date = new Date()) {
    const w = getWeather();
    const k = displayKey(date, w);
    if (k === lastKey) return false;
    lastKey = k;
    draw(date, w);
    return true;
  }

  update();
  return { update, texture, canvas };
}
```

- [ ] **Step 3: 빌드에 화면 사각형 추가**

`tools/nowhere/blender/inner_common.py` 의 `def tri_count(obj):` 바로 앞에 삽입:
```python
def quad_x(name, c, x, y0, z0, y1, z1, mat):
    """+x 를 향하는 세로 사각형 한 장(UV: 왼→오 = +y, 아래→위 = +z, 0…1) — 1F 디스플레이 화면."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([(x, y0, z0), (x, y1, z0), (x, y1, z1), (x, y0, z1)], [], [(0, 1, 2, 3)])
    uv = me.uv_layers.new(name='UVMap')
    for lp, (u, v) in zip(me.loops, ((0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0))):
        uv.data[lp.index].uv = (u, v)
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me)
    c.objects.link(o)
    return o


def display_screen(disp, c, mat, inset=0.04, slab=0.05):
    """display 소품(rz=90 으로 화면이 +x 를 봄)의 가장 앞(+x) slab m 안 정점 범위에, 1 cm 앞으로 화면 사각형 EX_display_screen 을 붙인다.
    inset 비율만큼 테두리를 남긴다. 웹(inner-display.js)이 이 메시에 CanvasTexture 를 입힌다."""
    bpy.context.view_layer.update()
    mw = disp.matrix_world
    pts = [mw @ v.co for v in disp.data.vertices]
    front = max(p.x for p in pts)
    face = [p for p in pts if p.x >= front - slab]
    y0, y1 = min(p.y for p in face), max(p.y for p in face)
    z0, z1 = min(p.z for p in face), max(p.z for p in face)
    dy, dz = (y1 - y0) * inset, (z1 - z0) * inset
    return quad_x('EX_display_screen', c, front + 0.01, y0 + dy, z0 + dz, y1 - dy, z1 - dz, mat)
```

`tools/nowhere/blender/inner_floors.py` import 줄 찾기:
```python
from inner_common import box, plane, import_prop, ribbon, curtain, elevator_core, columns
```
바꾸기:
```python
from inner_common import box, plane, import_prop, ribbon, curtain, elevator_core, columns, display_screen
```
`build_floor_1` 에서 찾기:
```python
    import_prop('main/display.glb', 'EX_display', c, (-16.4, 6.0, 0.0), width=6.0, rz=90)
```
바꾸기:
```python
    disp = import_prop('main/display.glb', 'EX_display', c, (-16.4, 6.0, 0.0), width=6.0, rz=90)
    display_screen(disp, c, M['screen'])
```

- [ ] **Step 4: 빌드 · 화면 위치 확인**

Run: `NW_FLOORS=1 npm run nowhere:inner:build 2>&1 | grep -E "inner_build|Error|Traceback" && npm run nowhere:inner:optimize 2>&1 | grep -E "→|rror" | tail -8`
1F 미리보기(`build/nowhere/renders/inner-1.png`, 왼쪽 벽 디스플레이)와, 필요하면 `build/` 아래 임시 렌더(디스플레이 정면)를 Read 로 열어 검은 화면 사각형이 디스플레이 화면 면을 덮고 다리 · 받침까지 내려오지 않는지 본다. 다리까지 덮으면 `display_screen` 의 `face` 를 `p.z > 0.3 * (max z)` 처럼 화면 높이대로 거르는 조건을 더하고 그 값을 보고한다.

- [ ] **Step 5: 통과 확인**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"` → `# fail 0`

- [ ] **Step 6: 스테이징 · 커밋 메시지 제안**

```bash
git add tools/nowhere/blender/inner_common.py tools/nowhere/blender/inner_floors.py tests/nowhere-inner-glb.test.mjs public/src/nowhere/inner-display.js tests/nowhere-inner-display.test.mjs public/assets/nowhere-inner/inner-1.glb public/assets/nowhere-inner/mobile/inner-1.glb public/assets/nowhere-inner/renders/inner-1.webp
```
제안 메시지: `feat(inner): 1F 디스플레이 화면 사각형(EX_display_screen)과 시각 · 기상 CanvasTexture 모듈`

---

### Task 8: 층 이동 · 둘러보기 순수 모듈 + 카메라(끊을 수 있는 비행 · 입력 비우기)

**Files:**
- Create: `public/src/nowhere/inner-nav.js`, `public/src/nowhere/inner-tour.js`, `tests/nowhere-inner-nav.test.mjs`, `tests/nowhere-inner-tour.test.mjs`
- Modify: `public/src/nowhere/camera.js`

**Interfaces:**
- Consumes: `inner-layout.json` 층 형식, `camCtrl.flyTo(path) → Promise<'done'|'cancelled'>`(1단계).
- Produces:
  - `inner-nav.js`: `floorOrder(layout) → Floor[]`(elevation 내림차순: 13 · 12 · 1 · B1), `shortLabel(floor) → 'B1' | '1' | '12' | '13'`, `elevatorButtons(layout, currentId) → [{ id, label }…, { id: 'close', label: '닫기', cancel: true }]`, `inArea({x, z}, { pos, radius }) → boolean`, `createAreaTrigger() → { update(inside, enabled = true) → boolean, reset() }`, `isFloorChain(chain)`, `isCeilingChain(chain)`.
  - `inner-tour.js`: `TOUR_DWELL_MS = 1500`, `LEG_MIN_S = 2`, `LEG_MAX_S = 8`, `buildTourLegs(start: {pos, target}, stops: Tour[]) → [{ points: [a, b], targets: [ta, tb], duration, caption }]`, `createTourPlayer({ camCtrl, getView, showCaption, wait? }) → { play(stops) → Promise<'done'|'stopped'>, stop(), isPlaying() }`.
  - `camera.js`: `flyTo(path, { interruptible = false } = {})` — `interruptible` 이면 키(⌘ · Ctrl 조합 제외) · 캔버스 포인터 · 휠 입력으로 멈춘다(`'cancelled'`). `clearInput()`(누르던 이동 · 시선 키 · 점프 예약 비우기)를 반환 객체에 추가.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/nowhere-inner-nav.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { floorOrder, shortLabel, elevatorButtons, inArea, createAreaTrigger, isFloorChain, isCeilingChain } from '../public/src/nowhere/inner-nav.js';

const layout = {
  floors: [
    { id: 'b1', label: 'B1F 카페', elevation: -4.5 },
    { id: '1', label: '1F 로비', elevation: 0 },
    { id: '12', label: '12F', elevation: 55 },
    { id: '13', label: '13F 몬스터 룸', elevation: 60 },
  ],
};

test('(a) 층 순서는 위층부터(엘리베이터 패널), 짧은 이름 B1 · 1 · 12 · 13', () => {
  assert.deepEqual(floorOrder(layout).map((f) => f.id), ['13', '12', '1', 'b1']);
  assert.deepEqual(floorOrder(layout).map(shortLabel), ['13', '12', '1', 'B1']);
  assert.deepEqual(layout.floors.map((f) => f.id), ['b1', '1', '12', '13'], '원본 배열은 그대로');
});

test('(b) 층 선택 버튼: 현재 층을 뺀 층 이름(위층부터) + 닫기(취소)', () => {
  assert.deepEqual(elevatorButtons(layout, '1'), [
    { id: '13', label: '13F 몬스터 룸' },
    { id: '12', label: '12F' },
    { id: 'b1', label: 'B1F 카페' },
    { id: 'close', label: '닫기', cancel: true },
  ]);
});

test('(c) 영역: 수평 거리(x, z)로 판정, 높이는 무시', () => {
  const area = { pos: [0, 0, -19], radius: 2.5 };
  assert.equal(inArea({ x: 0, y: 1.7, z: -17 }, area), true);
  assert.equal(inArea({ x: 0, y: 30, z: -16.4 }, area), false);
});

test('(d) 영역 트리거: 들어갈 때 한 번, 나갔다 다시 들어오면 또 · 보행이 아니면 묻지 않고 무장 유지', () => {
  const t = createAreaTrigger();
  assert.equal(t.update(true), true);
  assert.equal(t.update(true), false, '안에 머무는 동안은 다시 묻지 않음');
  assert.equal(t.update(false), false);
  assert.equal(t.update(true, false), false, '보행 아님 → 묻지 않음');
  assert.equal(t.update(true, true), true, '무장이 유지돼 보행으로 바꾸면 묻는다');
  t.reset();
  assert.equal(t.update(true), true, 'reset 뒤에는 다시 묻는다');
});

test('(e) 바닥 · 천장 이름 판정은 이름 앞머리에서만(중간 일치 제외)', () => {
  assert.equal(isFloorChain('IN_floor|NW_InnerFloor_1|'), true);
  assert.equal(isFloorChain('mesh_0|IN_floor|root|'), true, '이름 붙은 노드 아래 자식 메시');
  assert.equal(isFloorChain('EX_lamp_IN_floor|'), false);
  assert.equal(isCeilingChain('IN_ceiling|'), true);
  assert.equal(isCeilingChain('IN_floor|'), false);
});
```

`tests/nowhere-inner-tour.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTourLegs, createTourPlayer, LEG_MIN_S, LEG_MAX_S } from '../public/src/nowhere/inner-tour.js';

const start = { pos: [0, 1.7, 13], target: [0, 2.5, 0] };
const stops = [
  { pos: [6, 2.2, 8], target: [0, 1.8, 0], caption: '도시 모형', duration: 5 },
  { pos: [4, 1.8, -3], target: [8.8, 1.2, -7.2], caption: 'DJ', duration: 30 },
  { pos: [-8, 2.4, -2], target: [-16.4, 2.4, -6], caption: '', duration: 0.5 },
];

test('(a) 구간: 시작 → 첫 지점 → … , 시간은 2~8 초로 묶는다', () => {
  const legs = buildTourLegs(start, stops);
  assert.equal(legs.length, 3);
  assert.deepEqual(legs[0].points, [start.pos, stops[0].pos]);
  assert.deepEqual(legs[0].targets, [start.target, stops[0].target]);
  assert.deepEqual(legs[1].points, [stops[0].pos, stops[1].pos]);
  assert.deepEqual(legs.map((l) => l.duration), [5, LEG_MAX_S, LEG_MIN_S]);
  assert.deepEqual(legs.map((l) => l.caption), ['도시 모형', 'DJ', '']);
});

function fakeCam(results = []) {
  const flights = [];
  return {
    flights,
    stopped: 0,
    flyTo(path, opts) {
      flights.push({ path, opts });
      return Promise.resolve(results.length ? results.shift() : 'done');
    },
    stopFlight() { this.stopped++; },
  };
}

test('(b) 재생: 구간마다 자막을 띄우고 끊을 수 있는 비행, 끝나면 자막을 지우고 done', async () => {
  const cam = fakeCam();
  const captions = [];
  const p = createTourPlayer({ camCtrl: cam, getView: () => start, showCaption: (t) => captions.push(t), wait: () => Promise.resolve() });
  assert.equal(await p.play(stops), 'done');
  assert.equal(cam.flights.length, 3);
  assert.ok(cam.flights.every((f) => f.opts.interruptible === true));
  assert.deepEqual(cam.flights[0].path.points, [start.pos, stops[0].pos]);
  assert.deepEqual(captions, ['도시 모형', 'DJ', '', '']);
  assert.equal(p.isPlaying(), false);
});

test('(c) 입력으로 비행이 끊기면(cancelled) 멈추고 stopped, 다음 구간으로 가지 않는다', async () => {
  const cam = fakeCam(['done', 'cancelled']);
  const captions = [];
  const p = createTourPlayer({ camCtrl: cam, getView: () => start, showCaption: (t) => captions.push(t), wait: () => Promise.resolve() });
  assert.equal(await p.play(stops), 'stopped');
  assert.equal(cam.flights.length, 2);
  assert.equal(captions.at(-1), '');
  assert.equal(p.isPlaying(), false);
});

test('(d) stop(): 머무는 중에 멈추면 비행을 끊고 자막을 지우며 다음 구간으로 가지 않는다', async () => {
  const cam = fakeCam();
  let release;
  const p = createTourPlayer({
    camCtrl: cam,
    getView: () => start,
    showCaption: () => {},
    wait: () => new Promise((r) => { release = r; }),
  });
  const run = p.play(stops);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(p.isPlaying(), true);
  p.stop();
  release();
  assert.equal(await run, 'stopped');
  assert.equal(cam.flights.length, 1);
  assert.equal(cam.stopped, 1);
  assert.equal(p.isPlaying(), false);
});
```
Run: `node --test tests/nowhere-inner-nav.test.mjs tests/nowhere-inner-tour.test.mjs 2>&1 | grep -E "^# (pass|fail)"`
Expected: FAIL — 모듈 없음

- [ ] **Step 2: `inner-nav.js` 작성**

```js
// HAUS NOWHERE — 실내 층 이동 · 영역 판정(순수, three 없음). 테스트: tests/nowhere-inner-nav.test.mjs

/** 엘리베이터 패널처럼 위층부터(13 · 12 · 1 · B1). 원본 배열은 바꾸지 않는다. */
export function floorOrder(layout) {
  return [...layout.floors].sort((a, b) => b.elevation - a.elevation);
}

/** HUD 층 버튼 문구: b1 → 'B1', 그 밖은 id 그대로('1' · '12' · '13') */
export function shortLabel(floor) {
  return floor.id === 'b1' ? 'B1' : String(floor.id);
}

/** 「층 선택」 모달 버튼: 현재 층을 뺀 층 이름(위층부터) + 닫기(취소) */
export function elevatorButtons(layout, currentId) {
  return [
    ...floorOrder(layout)
      .filter((f) => f.id !== currentId)
      .map((f) => ({ id: f.id, label: f.label })),
    { id: 'close', label: '닫기', cancel: true },
  ];
}

/** 수평 거리(x, z)로 원형 영역 안인지 — area: { pos: [x, y, z], radius } */
export function inArea(pos, area) {
  return Math.hypot(pos.x - area.pos[0], pos.z - area.pos[2]) <= area.radius;
}

/**
 * 영역에 들어갈 때 한 번만 true. 나갔다 다시 들어오면 또 true.
 * enabled=false(보행 아님)면 묻지 않되 무장은 유지한다 — 영역 안에서 보행으로 바꾸면 그때 묻는다.
 */
export function createAreaTrigger() {
  let armed = true;
  return {
    update(inside, enabled = true) {
      if (!inside) {
        armed = true;
        return false;
      }
      if (armed && enabled) {
        armed = false;
        return true;
      }
      return false;
    },
    reset() {
      armed = true;
    },
  };
}

// 노드 이름 사슬('자기|부모|…|')에서 규칙 이름(IN_floor* · IN_ceiling*)이 어느 노드 이름의 앞머리에 있는지 — 중간 일치는 제외
export const isFloorChain = (chain) => /(^|\|)IN_floor/.test(chain);
export const isCeilingChain = (chain) => /(^|\|)IN_ceiling/.test(chain);
```

- [ ] **Step 3: `inner-tour.js` 작성**

```js
// HAUS NOWHERE — 실내 층 둘러보기: tour 지점 구간 경로(순수) + 재생기(끊을 수 있는 카메라 비행 · 자막).
// 테스트: tests/nowhere-inner-tour.test.mjs. 입력이 있으면 멈추고 그 자리에서 자유 이동(카메라가 비행을 끊고, 머무는 중 입력은 interior.js 가 stop()).

export const TOUR_DWELL_MS = 1500;   // 지점에 도착해 자막을 읽는 시간
export const LEG_MIN_S = 2;
export const LEG_MAX_S = 8;

/** 시작 시점 → 첫 지점 → 다음 지점 … 구간들. duration 은 그 지점까지 비행 시간(2~8 초로 묶음). */
export function buildTourLegs(start, stops) {
  const legs = [];
  let prev = start;
  for (const s of stops) {
    legs.push({
      points: [prev.pos, s.pos],
      targets: [prev.target, s.target],
      duration: Math.min(LEG_MAX_S, Math.max(LEG_MIN_S, s.duration ?? 4)),
      caption: s.caption || '',
    });
    prev = s;
  }
  return legs;
}

const defaultWait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * camCtrl: { flyTo(path, { interruptible }), stopFlight() }, getView(): { pos, target }(지금 카메라),
 * showCaption(text): 자막 표시('' 이면 숨김). play 를 다시 부르거나 stop() 하면 앞선 재생은 조용히 멈춘다.
 */
export function createTourPlayer({ camCtrl, getView, showCaption, wait = defaultWait }) {
  let token = 0;
  let playing = false;

  async function play(stops) {
    const my = ++token;
    playing = true;
    try {
      for (const leg of buildTourLegs(getView(), stops)) {
        showCaption(leg.caption);
        const r = await camCtrl.flyTo({ points: leg.points, targets: leg.targets, duration: leg.duration }, { interruptible: true });
        if (my !== token || r !== 'done') return 'stopped';
        await wait(TOUR_DWELL_MS);
        if (my !== token) return 'stopped';
      }
      return 'done';
    } finally {
      if (my === token) {
        playing = false;
        showCaption('');
      }
    }
  }

  function stop() {
    if (!playing) return;
    token++;
    playing = false;
    showCaption('');
    camCtrl.stopFlight();
  }

  return { play, stop, isPlaying: () => playing };
}
```

- [ ] **Step 4: 순수 모듈 통과 확인**

Run: `node --test tests/nowhere-inner-nav.test.mjs tests/nowhere-inner-tour.test.mjs 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# pass 9`, `# fail 0`

- [ ] **Step 5: 카메라 — 끊을 수 있는 비행 · 입력 비우기** — `public/src/nowhere/camera.js`

찾기:
```js
  /** 시나리오 비행: buildFlightPath 결과({ points, targets, duration })를 따라 이동. 끝나면 'done', 끊기면 'cancelled'. */
  function flyTo(path) {
```
바꾸기:
```js
  /**
   * 시나리오 비행: buildFlightPath 결과({ points, targets, duration })를 따라 이동. 끝나면 'done', 끊기면 'cancelled'.
   * interruptible(실내 층 둘러보기)이면 키 · 캔버스 포인터 · 휠 입력으로 멈추고 그 자리에서 자유 이동한다.
   */
  function flyTo(path, { interruptible = false } = {}) {
```

찾기:
```js
        elapsed: 0,
        resolve,
      };
```
바꾸기:
```js
        elapsed: 0,
        resolve,
        interruptible,
      };
```

찾기:
```js
    if (flight) return;   // 시나리오 비행 중 키 입력 무시(Esc 는 main.js 가 캡처 단계에서 먼저 받아 투어를 끝낸다)
```
바꾸기:
```js
    if (flight) {
      // 시나리오 비행 중 키 입력은 무시(Esc 는 main.js 가 캡처 단계에서 먼저 받아 투어를 끝낸다).
      // 끊을 수 있는 비행(실내 층 둘러보기)은 아무 키로 멈추고 그 자리에서 자유 이동
      if (flight.interruptible && !e.metaKey && !e.ctrlKey) stopFlight();
      return;
    }
```

찾기:
```js
  canvas.addEventListener('wheel', onUserInterrupt, { passive: true });
```
바꾸기:
```js
  canvas.addEventListener('wheel', onUserInterrupt, { passive: true });
  // 끊을 수 있는 비행(실내 층 둘러보기)은 마우스 · 휠 입력으로도 멈춘다
  const onFlightInterrupt = () => {
    if (flight?.interruptible) stopFlight();
  };
  canvas.addEventListener('pointerdown', onFlightInterrupt, { passive: true });
  canvas.addEventListener('wheel', onFlightInterrupt, { passive: true });
```

찾기:
```js
  function stopFlight() {
    finishFlight('cancelled');
  }
```
바꾸기:
```js
  function stopFlight() {
    finishFlight('cancelled');
  }

  /** 누르고 있던 이동 · 시선 키와 점프 예약을 비운다(모달이 뜰 때 — 질문 중에 계속 걷지 않게). */
  function clearInput() {
    walkKeys.clear();
    jumpQueued = false;
  }
```

찾기:
```js
    isFlying: () => Boolean(flight),
```
바꾸기:
```js
    isFlying: () => Boolean(flight),
    clearInput,
```

- [ ] **Step 6: 통과 확인 · 브라우저 확인**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"` → `# fail 0`

브라우저(`http://localhost:4173/?ver=ds2&noIntro=1&cam=street`, 상단 바 빈 곳을 한 번 클릭해 키 입력 포커스를 잡은 뒤):
```js
// 1) 끊을 수 있는 비행은 실제 키 입력으로 멈춘다
await state.page.evaluate(() => {
  const a = window.__NW_APP;
  const p = a.camera.position.toArray();
  window.__fr = null;
  a.camCtrl.flyTo({ points: [p, [p[0] + 20, p[1] + 10, p[2]]], targets: [a.controls.target.toArray(), [0, 10, 0]], duration: 6 }, { interruptible: true }).then((r) => { window.__fr = r; });
});
await state.page.waitForTimeout(800);
await state.page.keyboard.press('KeyX');
await state.page.waitForTimeout(300);
console.log(await state.page.evaluate(() => ({ r: window.__fr, flying: window.__NW_APP.camCtrl.isFlying(), ctrl: window.__NW_APP.controls.enabled })));
// 2) 일반 비행(시나리오)은 키로 멈추지 않는다
await state.page.evaluate(() => {
  const a = window.__NW_APP;
  const p = a.camera.position.toArray();
  window.__fr2 = null;
  a.camCtrl.flyTo({ points: [p, [p[0] - 20, p[1], p[2]]], targets: [a.controls.target.toArray(), [0, 10, 0]], duration: 2 }).then((r) => { window.__fr2 = r; });
});
await state.page.waitForTimeout(400);
await state.page.keyboard.press('KeyX');
await state.page.waitForTimeout(2200);
console.log(await state.page.evaluate(() => window.__fr2));
```
Expected: 1) `{ r: 'cancelled', flying: false, ctrl: true }`, 2) `'done'`, 콘솔 오류 없음.

- [ ] **Step 7: 스테이징 · 커밋 메시지 제안**

```bash
git add public/src/nowhere/inner-nav.js public/src/nowhere/inner-tour.js tests/nowhere-inner-nav.test.mjs tests/nowhere-inner-tour.test.mjs public/src/nowhere/camera.js
```
제안 메시지: `feat(inner): 층 이동 · 둘러보기 순수 모듈과 끊을 수 있는 카메라 비행 · 입력 비우기`

---

### Task 9: 창밖(CubeCamera 캡처) · 밤 조명 모듈

**Files:**
- Create: `public/src/nowhere/inner-view.js`, `tests/nowhere-inner-view.test.mjs`

**Interfaces:**
- Consumes: `world.layerGroups.building_haus`(외관 HAUS 그룹 — 캡처하는 동안 숨김), `world.uniforms.uNight.value`(0…1), 기상 컨트롤러 `getWeather()` · `getHour()`, 기상 전환 2.5 s.
- Produces: `VIEW_SIZE = 256`, `VIEW_SETTLE_MS = 2700`, `viewKey(weatherName, hour) → string`, `hasWindowView(floor) → boolean`(elevation ≥ 0), `lerpHex(a, b, t) → '#rrggbb'`, `interiorLighting(night, mobile = false) → { hemiSky, hemiGround, hemiIntensity, keyColor, keyIntensity, ambient }`, `createWindowView({ THREE, renderer, exteriorScene, world, near?, far? }) → { capture(elevation) → CubeTexture, texture, dispose() }`.

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/nowhere-inner-view.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { viewKey, hasWindowView, lerpHex, interiorLighting, createWindowView, VIEW_SIZE } from '../public/src/nowhere/inner-view.js';

test('(a) 창밖: 지하(elevation < 0)는 캡처하지 않고, 키는 기상 · 시각(소수 둘째 자리)', () => {
  assert.equal(hasWindowView({ elevation: -4.5 }), false);
  assert.equal(hasWindowView({ elevation: 0 }), true);
  assert.equal(hasWindowView({ elevation: 55 }), true);
  assert.equal(viewKey('rain', 21.5), 'rain|21.50');
  assert.notEqual(viewKey('rain', 21.5), viewKey('rain', 21.51));
});

test('(b) 색 보간: 양 끝 · 가운데', () => {
  assert.equal(lerpHex('#000000', '#ffffff', 0), '#000000');
  assert.equal(lerpHex('#000000', '#ffffff', 1), '#ffffff');
  assert.equal(lerpHex('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(lerpHex('#F4F1EA', '#FFE2BC', 2), '#ffe2bc', '1 을 넘으면 끝 색');
});

test('(c) 밤 조명: uNight 0.5 이하는 낮과 같고, 1 이면 따뜻하게 · 밝게. 모바일은 채움광', () => {
  const day = interiorLighting(0);
  assert.deepEqual(interiorLighting(0.5), day);
  assert.equal(day.hemiSky, '#f4f1ea');
  assert.equal(day.keyColor, '#fff4e6');
  assert.equal(day.hemiIntensity, 1.1);
  assert.equal(day.keyIntensity, 1.2);
  assert.equal(day.ambient, 0);
  const night = interiorLighting(1);
  assert.equal(night.keyColor, '#ffc27a');
  assert.ok(night.keyIntensity > day.keyIntensity && night.hemiIntensity > day.hemiIntensity);
  assert.equal(interiorLighting(0, true).ambient, 1.2);
  assert.ok(interiorLighting(1, true).ambient > 1.2);
});

test('(d) 캡처: HAUS 를 숨긴 채 그 층 높이 + 1.7 m 에서 외관 씬을 찍고, 숨김을 되돌린다', () => {
  const calls = [];
  const haus = { visible: true };
  class WebGLCubeRenderTarget {
    constructor(size, opts) { this.size = size; this.opts = opts; this.texture = { isCubeTexture: true }; }
    dispose() { this.disposed = true; }
  }
  class CubeCamera {
    constructor(near, far, rt) {
      this.near = near; this.far = far; this.rt = rt;
      this.position = { set: (x, y, z) => { this.pos = [x, y, z]; } };
    }
    update(renderer, scene) { calls.push({ visible: haus.visible, pos: this.pos, renderer, scene }); }
  }
  const THREE = { WebGLCubeRenderTarget, CubeCamera, HalfFloatType: 1016 };
  const renderer = {};
  const exteriorScene = {};
  const v = createWindowView({ THREE, renderer, exteriorScene, world: { layerGroups: { building_haus: haus } } });
  const tex = v.capture(55);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].visible, false, '찍는 동안 HAUS 숨김');
  assert.deepEqual(calls[0].pos, [0, 56.7, 0]);
  assert.equal(calls[0].scene, exteriorScene);
  assert.equal(haus.visible, true, '찍은 뒤 되돌림');
  assert.equal(tex.isCubeTexture, true);
  assert.equal(v.texture, tex);
  v.dispose();
});

test('(e) HAUS 그룹이 없어도 캡처한다', () => {
  class WebGLCubeRenderTarget { constructor() { this.texture = {}; } dispose() {} }
  class CubeCamera { constructor() { this.position = { set() {} }; } update() {} }
  const v = createWindowView({ THREE: { WebGLCubeRenderTarget, CubeCamera, HalfFloatType: 1 }, renderer: {}, exteriorScene: {}, world: {} });
  assert.ok(v.capture(0));
  assert.equal(VIEW_SIZE, 256);
});
```
Run: `node --test tests/nowhere-inner-view.test.mjs 2>&1 | grep -E "^# (pass|fail)"` → FAIL(모듈 없음)

- [ ] **Step 2: 모듈 작성** — `public/src/nowhere/inner-view.js`

```js
// HAUS NOWHERE — 실내 창밖 · 밤 조명. 창밖: 외관 씬을 CubeCamera(256 px)로 HAUS 위치 · 그 층 높이 + 1.7 m 에서 캡처해 실내 배경으로
// (창 유리 너머로만 보임, 찍는 동안 HAUS 자신은 숨김). 밤 조명: uNight > 0.5 에서 실내 조명을 따뜻하게 · 밝게(스펙 §2.6).
// THREE 를 인자로 받아 node:test 에서 three 없이 import 한다. 테스트: tests/nowhere-inner-view.test.mjs
export const VIEW_SIZE = 256;
export const VIEW_SETTLE_MS = 2700;   // 기상 전환(2.5 s)이 끝난 뒤 다시 캡처

/** 기상 · 시각이 같으면 다시 찍지 않도록 쓰는 키 */
export function viewKey(weatherName, hour) {
  return `${weatherName}|${Number(hour).toFixed(2)}`;
}

/** 지하(B1F, elevation < 0)는 창이 없어 캡처하지 않는다 */
export function hasWindowView(floor) {
  return Boolean(floor) && floor.elevation >= 0;
}

const hex2 = (n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
function rgb(h) {
  const s = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
}

/** 두 색(#rrggbb) 사이 t(0…1, 밖은 끝으로 묶음) 보간 — 소문자 #rrggbb */
export function lerpHex(a, b, t) {
  const k = Math.min(1, Math.max(0, t));
  const A = rgb(a);
  const B = rgb(b);
  return `#${hex2(A[0] + (B[0] - A[0]) * k)}${hex2(A[1] + (B[1] - A[1]) * k)}${hex2(A[2] + (B[2] - A[2]) * k)}`;
}

/** uNight(0…1) → 실내 조명 값. 0.5 이하는 낮과 같고 1 에서 가장 따뜻 · 밝다. 모바일은 HDRI 대신 채움광 */
export function interiorLighting(night, mobile = false) {
  const k = Math.min(1, Math.max(0, (night - 0.5) / 0.5));
  return {
    hemiSky: lerpHex('#F4F1EA', '#FFE2BC', k),
    hemiGround: '#3a2a26',
    hemiIntensity: 1.1 + 0.3 * k,
    keyColor: lerpHex('#FFF4E6', '#FFC27A', k),
    keyIntensity: 1.2 + 0.6 * k,
    ambient: mobile ? 1.2 + 0.2 * k : 0,
  };
}

/** 외관 씬을 그 층 높이에서 캡처하는 CubeCamera. capture(elevation) 은 실내 scene.background 로 쓸 큐브 텍스처를 돌려준다. */
export function createWindowView({ THREE, renderer, exteriorScene, world, near = 0.5, far = 8000 }) {
  const rt = new THREE.WebGLCubeRenderTarget(VIEW_SIZE, { type: THREE.HalfFloatType });
  const cam = new THREE.CubeCamera(near, far, rt);

  function capture(elevation) {
    const haus = world.layerGroups?.building_haus;
    const was = haus ? haus.visible : null;
    if (haus) haus.visible = false;   // HAUS 안에서 찍으므로 자기 벽이 가리지 않게
    cam.position.set(0, elevation + 1.7, 0);
    cam.update(renderer, exteriorScene);
    if (haus) haus.visible = was;
    return rt.texture;
  }

  return { capture, texture: rt.texture, dispose: () => rt.dispose() };
}
```

- [ ] **Step 3: 통과 확인**

Run: `node --test tests/nowhere-inner-view.test.mjs 2>&1 | grep -E "^# (pass|fail)"` → `# pass 5`, `# fail 0`
이어서 `npm test 2>&1 | grep -E "^# (pass|fail)"` → `# fail 0`

- [ ] **Step 4: 스테이징 · 커밋 메시지 제안**

```bash
git add public/src/nowhere/inner-view.js tests/nowhere-inner-view.test.mjs
```
제안 메시지: `feat(inner): 창밖 CubeCamera 캡처 · 밤 조명 모듈(순수 · THREE 주입)`

---
### Task 10: 다층 실내 연결 — `interior.js` 다시 쓰기 · HUD · `main.js`

**Files:**
- Rewrite: `public/src/nowhere/interior.js`
- Modify: `public/src/nowhere/main.js`(모달 `onShow` · `createInterior` 인자), `public/src/nowhere/nowhere.css`(끝에 덧붙임)

**Interfaces:**
- Consumes: Task 6 의 4개 층 레이아웃 · GLB, Task 7 `createDisplayScreen`, Task 8 `inner-nav` · `createTourPlayer` · `camCtrl.flyTo(…, { interruptible })` · `camCtrl.clearInput()`, Task 9 `createWindowView` · `hasWindowView` · `viewKey` · `interiorLighting` · `VIEW_SETTLE_MS`, 1단계 `camCtrl.placeAt/setTerrain/setBounds/setWalkMode/stopFlight/isWalkMode/controls`, `modal.show/close/isOpen`, `approachFor`, `post.renderPass`, `world.uniforms.uNight`, 기상 컨트롤러 `getWeather()` · `getHour()`.
- Produces: `createInterior({ renderer, camera, camCtrl, post, world, quality, modal, weather, exteriorScene, onChange? }) → { enter(buildingId) → Promise<boolean>, exit() → Promise<void>, goToFloor(id) → Promise<boolean>, update(dt), isActive(), currentFloor() → 'b1'|'1'|'12'|'13'|null, isTouring(), scene }`. 기존 호출(`main.js` 의 `interior.enter/update/isActive/currentFloor`)은 그대로 동작한다.

- [ ] **Step 1: `interior.js` 전체를 아래로 바꾼다**

```js
// HAUS NOWHERE — 성수(HAUS NOWHERE) 실내 뷰(B1F · 1F · 12F · 13F): 별도 실내 씬 · 층 GLB/HDRI 불러오기 · 진입/나가기 ·
// 엘리베이터 층 이동(HUD 층 버튼 · 엘리베이터 문 앞 「층 선택」) · 층 둘러보기(tour 지점 비행 + 자막) · 창밖(외관 CubeCamera 캡처) ·
// 밤 조명 · 1F 디스플레이 화면 · 실내 보행 지형(바닥 = 높이 격자, 바닥 · 천장 밖 = 장애물, 층 영역 밖 막힘) · 1F 정문 출구 · 실내 HUD.
// 외관과 같은 후처리(composer)를 쓰고 renderPass.scene 만 바꿔 끼운다. 레이아웃: assets/nowhere-inner/inner-layout.json
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { createHeightGrid, createGroundQuery, createOccupancyGrid, isBlockedAt, obstacleTopAt } from './terrain.js';
import { rasterizeMeshes, markObstacleMeshes } from './terrain-mesh.js';
import { approachFor } from './tour-config.js';
import { floorOrder, shortLabel, elevatorButtons, inArea, createAreaTrigger, isFloorChain, isCeilingChain } from './inner-nav.js';
import { createTourPlayer } from './inner-tour.js';
import { createWindowView, hasWindowView, viewKey, interiorLighting, VIEW_SETTLE_MS } from './inner-view.js';
import { createDisplayScreen } from './inner-display.js';

export const INNER_LAYOUT_URL = 'assets/nowhere-inner/inner-layout.json';
const FADE_MS = 600;
const FLOOR_FADE_MS = 400;
const EXTERIOR_WALK_FALLBACK = [-72.0, 36.5];
const BG_COLOR = '#C9CECD';
const HOME_ICON = 'assets/inner/icons/home.svg';

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// 노드 이름 사슬(자기 + 조상) — glTF 메시는 이름 붙은 노드 아래 자식으로 올 수 있다
function nameChain(n) {
  let s = '';
  for (let p = n; p; p = p.parent) s += `${p.name || ''}|`;
  return s;
}

export function createInterior({ renderer, camera, camCtrl, post, world, quality, modal, weather = null, exteriorScene, onChange = null }) {
  const mobile = quality.tier === 'mobile';
  const scene = new THREE.Scene();
  scene.name = 'NW_Interior';
  scene.background = new THREE.Color(BG_COLOR);
  const hemi = new THREE.HemisphereLight('#F4F1EA', '#3A2A26', 1.1);
  // 모바일은 HDRI 환경광을 받지 않으므로(진입 예산) 고른 채움광으로 천장 · 바닥이 어둡게 가라앉지 않게 한다
  const ambient = new THREE.AmbientLight('#EDEAE4', mobile ? 1.2 : 0);
  const key = new THREE.DirectionalLight('#FFF4E6', 1.2);
  key.position.set(-8, 14, 10);
  scene.add(hemi, ambient, key);

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const view = createWindowView({ THREE, renderer, exteriorScene, world, far: camera.far });

  let layout = null;
  let envReady = false;
  const floorCache = new Map();
  let active = false;
  let busy = false;
  let floorDef = null;
  let floorRoot = null;
  let fovBefore = null;    // 진입 직전 외관 카메라 시야각
  let promptOpen = false;  // 출구 · 층 선택 질문이 떠 있는지
  let display = null;      // 1F 디스플레이 화면
  let lastNight = -1;
  let lastViewKey = null;
  let viewDirtyAt = 0;
  const exitTrigger = createAreaTrigger();
  const elevatorTrigger = createAreaTrigger();

  // 화면 전환(검게)
  const fade = el('div', 'nw-fade');
  const fadeText = el('div', 'nw-fade-text');
  fade.append(fadeText);
  document.body.append(fade);

  // 실내 HUD: 층 이름 · 층 버튼 · 이 층 둘러보기 · 밖으로 나가기 + 하단 둘러보기 자막
  const hud = el('div', 'nw-interior-hud');
  hud.hidden = true;
  const floorLabel = el('div', 'nw-interior-floor');
  const floorNav = el('div', 'nw-interior-floors');
  floorNav.setAttribute('role', 'group');
  floorNav.setAttribute('aria-label', '층 이동');
  const tourBtn = el('button', 'nw-btn nw-interior-tour', '이 층 둘러보기');
  tourBtn.type = 'button';
  const exitBtn = el('button', 'nw-btn nw-interior-exit');
  exitBtn.type = 'button';
  const icon = document.createElement('img');
  icon.alt = '';
  exitBtn.append(icon, document.createTextNode('밖으로 나가기'));
  hud.append(floorLabel, floorNav, tourBtn, exitBtn);
  const caption = el('div', 'nw-interior-caption');
  caption.hidden = true;
  caption.setAttribute('aria-live', 'polite');
  document.body.append(hud, caption);
  const floorBtns = new Map();

  const tour = createTourPlayer({
    camCtrl,
    getView: () => ({ pos: camera.position.toArray(), target: camCtrl.controls.target.toArray() }),
    showCaption: (text) => {
      caption.textContent = text;
      caption.hidden = !text;
    },
  });
  tourBtn.addEventListener('click', () => {
    if (active && !busy && floorDef?.tour?.length) tour.play(floorDef.tour);
  });
  exitBtn.addEventListener('click', () => exit());
  // 둘러보기 중 아무 입력(키 · 화면 클릭 · 휠)이면 멈추고 그 자리에서 자유 이동 — 비행 중 입력은 camera.js 가 먼저 끊는다
  const stopTourOnInput = () => {
    if (tour.isPlaying()) tour.stop();
  };
  window.addEventListener('keydown', stopTourOnInput);
  renderer.domElement.addEventListener('pointerdown', stopTourOnInput);
  renderer.domElement.addEventListener('wheel', stopTourOnInput, { passive: true });

  const fadeTo = (on, text = '', ms = FADE_MS) =>
    new Promise((res) => {
      fadeText.textContent = text;
      fade.style.transitionDuration = `${ms}ms`;
      fade.classList.toggle('is-on', on);
      setTimeout(res, ms);
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
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(hdr).texture;
    scene.environmentIntensity = 0.9;
    hdr.dispose();
    pmrem.dispose();
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
      if (isFloorChain(chain)) floors.push(n);
      else if (!isCeilingChain(chain)) solids.push(n);
    });
    const [x0, z0, x1, z1] = def.bounds;
    const grid = createHeightGrid({ x0: x0 - 1, z0: z0 - 1, x1: x1 + 1, z1: z1 + 1, cell: 0.5 });
    rasterizeMeshes(floors, () => [grid]);
    const groundAt = createGroundQuery([grid], 0);
    const occ = createOccupancyGrid({ x0: x0 - 1, z0: z0 - 1, x1: x1 + 1, z1: z1 + 1, cell: 0.25 });
    markObstacleMeshes(occ, solids, groundAt);
    // 층 영역(벽 안쪽) 밖은 막는다 — 1F 정문 열림으로 걸어 나가면 바닥 없는 바깥으로 빠지므로(나가기는 출구 모달 · 버튼으로)
    const insideFloor = (x, z, r) => x >= x0 + r && x <= x1 - r && z >= z0 + r && z <= z1 - r;
    const blocker = {
      isBlocked: (x, z, clearance = 0, radius = 0.35) => !insideFloor(x, z, radius) || isBlockedAt(occ, x, z, radius, clearance),
      topAt: (x, z, radius = 0.2) => obstacleTopAt(occ, x, z, radius),
    };
    // 1F 디스플레이 화면(빌드가 만든 EX_display_screen)에 시각 · 기상 캔버스를 입힌다
    if (!display) {
      const s = root.getObjectByName('EX_display_screen');
      const mesh = s?.isMesh ? s : s?.children.find((m) => m.isMesh);
      if (mesh) display = createDisplayScreen({ THREE, mesh, getWeather: () => weather?.getWeather?.() ?? '' });
    }
    const entry = { root, groundAt, blocker };
    floorCache.set(def.id, entry);
    return entry;
  }

  function buildFloorNav() {
    if (floorBtns.size) return;
    for (const f of floorOrder(layout)) {
      const b = el('button', 'nw-btn nw-interior-floor-btn', shortLabel(f));
      b.type = 'button';
      b.title = f.label;
      b.addEventListener('click', () => goToFloor(f.id));
      floorNav.append(b);
      floorBtns.set(f.id, b);
    }
  }

  function markCurrent() {
    for (const [id, b] of floorBtns) {
      const cur = id === floorDef?.id;
      b.classList.toggle('is-active', cur);
      b.setAttribute('aria-pressed', String(cur));
    }
  }

  // 밤 조명: uNight 에 따라 따뜻하게 · 밝게(스펙 §2.6). 값이 바뀔 때만 다시 넣는다
  function applyLighting() {
    const night = world.uniforms?.uNight?.value ?? 0;
    if (Math.abs(night - lastNight) < 0.002) return;
    lastNight = night;
    const L = interiorLighting(night, mobile);
    hemi.color.set(L.hemiSky);
    hemi.groundColor.set(L.hemiGround);
    hemi.intensity = L.hemiIntensity;
    key.color.set(L.keyColor);
    key.intensity = L.keyIntensity;
    ambient.intensity = L.ambient;
  }

  // 창밖: 그 층 높이에서 외관을 캡처해 배경으로(지하는 단색)
  function refreshView() {
    scene.background = hasWindowView(floorDef) ? view.capture(floorDef.elevation) : new THREE.Color(BG_COLOR);
    lastViewKey = weather ? viewKey(weather.getWeather(), weather.getHour()) : null;
    viewDirtyAt = 0;
  }

  function showFloor(def, entry) {
    if (floorRoot) scene.remove(floorRoot);
    floorRoot = entry.root;
    scene.add(floorRoot);
    floorDef = def;
    floorLabel.textContent = def.label;
    markCurrent();
    camCtrl.setTerrain({
      groundHeightAt: entry.groundAt,
      getWalkBlocker: () => entry.blocker,
      walkFallback: [def.spawn.pos[0], def.spawn.pos[2]],
    });
    const [x0, z0, x1, z1] = def.bounds;
    camCtrl.setBounds({ x0, z0, x1, z1, yMin: 0.4, yMax: def.ceiling - 0.3 });
    refreshView();
    exitTrigger.reset();
    elevatorTrigger.reset();
  }

  function closePrompt() {
    if (promptOpen) modal.close();
  }

  /** 성수 실내 1F 로 들어간다. 성공하면 true, 실패 후 닫으면 false. */
  async function enter(buildingId = 'haus') {
    if (active || busy) return false;
    busy = true;
    try {
      await fadeTo(true, '실내로 들어가는 중…');
      await loadLayout();
      if (layout.building !== buildingId) throw new Error(`실내 없음: ${buildingId}`);
      buildFloorNav();
      if (!icon.getAttribute('src')) icon.src = HOME_ICON;   // 실내에 처음 들어갈 때 받는다(외관 첫 로딩 변화 없음)
      const def = layout.floors.find((f) => f.id === layout.defaultFloor);
      // 모바일은 외관처럼 HDRI 를 받지 않는다(진입 추가 다운로드 ≤ 4 MB — 1F 모바일 GLB 만). 반구광 · 채움광으로 비춘다
      if (quality.tier !== 'mobile') await loadEnv();
      const entry = await loadFloor(def, (r) => {
        fadeText.textContent = `실내 불러오는 중… ${Math.round(r * 100)}%`;
      });
      camCtrl.stopFlight();
      camCtrl.setWalkMode(false);
      fovBefore = camera.fov;   // 나갈 때 외관 구도의 시야각으로 되돌린다(보행 시야각 50° 가 남지 않게)
      showFloor(def, entry);
      post.renderPass.scene = scene;
      active = true;
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
      // 실패 모달이 떠 있는 동안에도 busy 를 유지한다 — 그 사이 enter 가 다시 불려 진입이 겹치지 않게
      const choice = await modal.show({
        title: '실내를 불러오지 못했습니다',
        buttons: [
          { id: 'retry', label: '다시 시도', primary: true },
          { id: 'close', label: '닫기', cancel: true },
        ],
      });
      busy = false;
      return choice === 'retry' ? enter(buildingId) : false;
    }
  }

  /** 엘리베이터: 다른 층으로(0.4 초 어둡게 → 그 층 GLB · 창밖 → 그 층 spawn 에서 보행). 성공하면 true. */
  async function goToFloor(id) {
    if (!active || busy || id === floorDef?.id) return false;
    const def = layout.floors.find((f) => f.id === id);
    if (!def) return false;
    busy = true;
    tour.stop();
    closePrompt();
    try {
      await fadeTo(true, '층 이동 중…', FLOOR_FADE_MS);
      const entry = await loadFloor(def, (r) => {
        fadeText.textContent = `층 불러오는 중… ${Math.round(r * 100)}%`;
      });
      camCtrl.setWalkMode(false);
      showFloor(def, entry);
      camCtrl.placeAt(def.spawn.pos, def.spawn.target);
      camCtrl.setWalkMode(true);
      await fadeTo(false, '', FLOOR_FADE_MS);
      busy = false;
      return true;
    } catch (err) {
      console.error('[nowhere] 층 불러오기 실패', err);
      await fadeTo(false, '', FLOOR_FADE_MS);
      const choice = await modal.show({
        title: '층을 불러오지 못했습니다',
        buttons: [
          { id: 'retry', label: '다시 시도', primary: true },
          { id: 'close', label: '닫기', cancel: true },
        ],
      });
      busy = false;
      return choice === 'retry' ? goToFloor(id) : false;
    }
  }

  /** 실내에서 나와 외관 HAUS 정면(카메라 시점)으로 돌아간다. */
  async function exit() {
    if (!active || busy) return;
    busy = true;
    tour.stop();
    closePrompt();   // 출구 · 층 선택 질문이 떠 있으면 닫는다(외관에 남거나 다음 방문에 응답되지 않게)
    try {
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
      if (fovBefore) {
        camera.fov = fovBefore;
        camera.updateProjectionMatrix();
      }
      active = false;
      document.body.classList.remove('is-interior');
      hud.hidden = true;
      if (typeof onChange === 'function') onChange(false);
    } finally {
      // 중간에 예외가 나도 검은 화면 · busy 에 갇히지 않게
      await fadeTo(false);
      busy = false;
    }
  }

  function askExit() {
    promptOpen = true;
    modal
      .show({
        title: '밖으로 나가시겠습니까?',
        buttons: [
          { id: 'yes', label: '예', primary: true },
          { id: 'no', label: '아니오', cancel: true },
        ],
      })
      .then((c) => {
        promptOpen = false;
        if (c === 'yes' && active) exit();
      });
  }

  function askFloor() {
    promptOpen = true;
    modal.show({ title: '층 선택', buttons: elevatorButtons(layout, floorDef.id) }).then((c) => {
      promptOpen = false;
      if (c && c !== 'close' && active) goToFloor(c);
    });
  }

  function update() {
    if (!active) return;
    applyLighting();
    if (display && floorDef?.id === '1') display.update(new Date());
    // 기상 · 시각이 바뀌면 전환이 끝난 뒤(VIEW_SETTLE_MS) 창밖을 다시 캡처한다
    if (weather && !busy && hasWindowView(floorDef)) {
      const k = viewKey(weather.getWeather(), weather.getHour());
      const now = performance.now();
      if (k !== lastViewKey) {
        lastViewKey = k;
        viewDirtyAt = now;
      } else if (viewDirtyAt && now - viewDirtyAt >= VIEW_SETTLE_MS) {
        refreshView();
      }
    }
    // 보행 중 1F 정문 출구 · 엘리베이터 문 앞에 들어가면 한 번 묻고, 영역을 벗어났다 다시 들어오면 또 묻는다
    if (busy || !floorDef || modal.isOpen()) return;
    const p = camera.position;
    const walking = camCtrl.isWalkMode();
    if (floorDef.exit && exitTrigger.update(inArea(p, floorDef.exit), walking)) askExit();
    else if (floorDef.elevator && elevatorTrigger.update(inArea(p, floorDef.elevator), walking)) askFloor();
  }

  return {
    enter,
    exit,
    goToFloor,
    update,
    isActive: () => active,
    currentFloor: () => (active ? floorDef?.id ?? null : null),
    isTouring: () => tour.isPlaying(),
    scene,
  };
}
```

- [ ] **Step 2: `main.js` — 모달이 뜨면 입력 비우기, 실내에 기상 컨트롤러 전달**

찾기:
```js
  const modal = createModal({ onShow: () => camCtrl.releasePointer() });
```
바꾸기:
```js
  // 모달이 뜨면 마우스 고정을 풀고, 누르던 이동 키를 비운다(질문 중에 계속 걷지 않게)
  const modal = createModal({
    onShow: () => {
      camCtrl.releasePointer();
      camCtrl.clearInput();
    },
  });
```
찾기:
```js
    quality,
    modal,
    exteriorScene: scene,
  });
```
바꾸기:
```js
    quality,
    modal,
    weather,
    exteriorScene: scene,
  });
```

- [ ] **Step 3: HUD 스타일** — `public/src/nowhere/nowhere.css` 파일 끝에 덧붙인다

```css

/* ── 실내 HUD: 층 버튼 · 이 층 둘러보기 · 둘러보기 자막 ── */
.nw-interior-floors {
  display: inline-flex;
  gap: 4px;
}
.nw-interior-floor-btn {
  min-width: 38px;
  justify-content: center;
}
.nw-interior-caption {
  position: fixed;
  left: 50%;
  bottom: 120px;
  z-index: 21;
  transform: translateX(-50%);
  max-width: min(720px, calc(100vw - 32px));
  padding: 10px 16px;
  border: 1px solid var(--nw-line-struct);
  border-left: 2px solid var(--nw-accent);
  border-radius: 2px;
  background: var(--nw-bg-panel);
  color: var(--nw-text);
  font-size: 14px;
  line-height: 1.5;
  text-align: center;
}
.nw-interior-caption[hidden] {
  display: none;
}
@media (max-width: 720px) {
  .nw-interior-hud {
    top: 72px;
    left: 8px;
    right: 8px;
    flex-wrap: wrap;
  }
  .nw-interior-caption {
    bottom: 150px;
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --check public/src/nowhere/interior.js && npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# fail 0`(실내 진입 예산 테스트 (d) 의 `quality.tier !== 'mobile') await loadEnv()` 문구 포함)

- [ ] **Step 5: 브라우저 확인(데스크톱 1440×810, `?ver=ds2&noIntro=1`)** — 실제 키 입력(`state.page.keyboard`), 클릭은 로케이터로

1. `await state.page.evaluate(() => window.__NW_APP.interior.enter('haus'))` → `getStats()` 의 `interior: true`, `floor: '1'`. HUD 에 `1F 로비`, 층 버튼 `13 · 12 · 1 · B1`(`1` 만 `is-active`), `이 층 둘러보기`, `밖으로 나가기`. 콘솔 오류 없음.
2. 디스플레이: 보행을 끄고(`V`) `camCtrl.placeAt([-8, 2.4, -2], [-16.4, 2.4, -6])` 로 디스플레이를 본 뒤 스크린샷 — 화면에 `HAUS NOWHERE SEOUL` · 현재 시각 · 기상 이름이 거꾸로 · 좌우 반전 없이 보인다(반전이면 `inner-display.js` 의 `flipY` 나 빌드의 `quad_x` UV 를 고치고 보고).
3. 층 버튼 `13` 클릭 → `층 이동 중…` → `floor: '13'`, 보행 on, 위치 = 13F spawn. 스크린샷: 커튼월 유리 너머로 60 m 높이의 외관 풍경(HAUS 자신의 벽이 아님)이 보인다.
4. 13F 에서 `S` 를 누른 채 엘리베이터 문 쪽으로 걸어 `층 선택` 모달 — 버튼 `12F` · `1F 로비` · `B1F 카페` · `닫기`. `B1F 카페` 클릭 → `floor: 'b1'`, 배경이 단색(창밖 없음).
5. `이 층 둘러보기` 클릭 → 하단 자막이 보이고 비행 중(`camCtrl.isFlying()`), 1초 뒤 `keyboard.press('KeyX')` → 비행 멈춤 · 자막 숨김 · `interior.isTouring() === false`, 보행은 꺼진 채 그 자리.
6. 층 버튼 `12` → 시간 `밤`(`window.__NW_APP.setTimeOfDay(21.5)`) → 3 초 뒤 스크린샷: 창밖이 밤 풍경으로 다시 캡처되고 실내 조명이 따뜻해진다.
7. `밖으로 나가기` → `interior: false`, 외관 HAUS 정면, `camera.fov` 가 진입 전 값.
8. `?ver=ds2&tier=mobile&noIntro=1` 에서 `interior.enter('haus')` → 각 층(`goToFloor`)에서 `getStats().triangles` ≤ 300000, 리소스 목록에 `env-1k.hdr` 없음.
결과 · 스크린샷 경로를 보고서에 적는다.

- [ ] **Step 6: 스테이징 · 커밋 메시지 제안**

```bash
git add public/src/nowhere/interior.js public/src/nowhere/main.js public/src/nowhere/nowhere.css
```
제안 메시지: `feat(inner): 다층 실내 — HUD 층 버튼 · 엘리베이터 층 선택 · 이 층 둘러보기 · 창밖 캡처 · 밤 조명 · 1F 디스플레이`

---

### Task 11: 조작 안내 · README · 월드 전환 · 마무리 검증

**Files:**
- Modify: `public/src/nowhere/help.js`, `tests/nowhere-help.test.mjs`, `README.md`, `public/src/nowhere/main.js`(월드 전환), `public/src/nowhere/nowhere.css`(오래된 주석)

**Interfaces:**
- Consumes: Task 10 까지의 실내 기능.
- Produces: 조작 안내 실내 행(층 버튼 · 층 선택 · 둘러보기), README 실내 4개 층, 월드 전환 시 `noIntro=1`(투어를 처음부터 다시 돌리지 않음).

- [ ] **Step 1: 실패하는 테스트 추가** — `tests/nowhere-help.test.mjs` 끝에 덧붙인다

```js

test('(d) 실내 조작 안내: 층 버튼 · 층 선택 · 이 층 둘러보기', () => {
  const descs = CONTROL_SECTIONS.flatMap((s) => s.rows.map((r) => r.desc)).join('\n');
  assert.match(descs, /B1 · 1 · 12 · 13/);
  assert.match(descs, /층 선택/);
  assert.match(descs, /이 층 둘러보기/);
});
```
Run: `node --test tests/nowhere-help.test.mjs 2>&1 | grep -E "^not ok|^# (pass|fail)"` → `not ok 4 - (d) …`

- [ ] **Step 2: 조작 안내 실내 행** — `public/src/nowhere/help.js`

찾기:
```js
      { keys: ['클릭'], desc: '실내: 왼쪽 위 밖으로 나가기, 또는 1F 정문 쪽으로 걸어가면 나가기 질문' },
```
바꾸기:
```js
      { keys: ['클릭'], desc: '실내: 왼쪽 위 층 버튼(B1 · 1 · 12 · 13) 또는 엘리베이터 문 앞 층 선택으로 층 이동, 이 층 둘러보기(아무 입력으로 멈춤), 밖으로 나가기 또는 1F 정문 쪽 출구' },
```

- [ ] **Step 3: 월드 전환 시 투어를 다시 돌리지 않기** — `public/src/nowhere/main.js`

찾기:
```js
      nextParams.set('ver', targetVer);
```
바꾸기:
```js
      nextParams.set('ver', targetVer);
      nextParams.set('noIntro', '1');   // 월드만 바꿀 때는 투어(인트로 · 건물 선택)를 처음부터 다시 돌리지 않는다
```

- [ ] **Step 4: README · 오래된 CSS 주석**

```bash
python3 - <<'PY'
import re
p = 'README.md'
s = open(p, encoding='utf-8').read()
s, n1 = re.subn(r'\| 실내\(성수 1F 로비\) \|[^\n]*\n',
    '| 실내(성수 B1F · 1F · 12F · 13F) | 1F 로비에서 보행 시점으로 시작(이동 · 달리기 · 점프 · 충돌 그대로). 왼쪽 위 층 버튼(`13` · `12` · `1` · `B1`) 또는 엘리베이터 문 앞 「층 선택」으로 층 이동, `이 층 둘러보기` 는 그 층 볼거리를 차례로 비행하며 자막(아무 입력으로 멈춤). 창밖은 그 층 높이의 외관 풍경(기상 · 시간 반영, 지하 제외), 밤에는 실내 조명이 따뜻해짐. 1F 디스플레이는 현재 시각 · 기상. `밖으로 나가기` 또는 1F 정문 쪽 출구에서 외관 HAUS 정면으로 복귀 |\n', s)
s, n2 = re.subn(r'# 2-C\) 성수 실내\(1F 로비\)[^\n]*\n',
    '# 2-C) 성수 실내(B1F · 1F · 12F · 13F): 층 껍데기 + 실내 에셋 축척 · 배치 · 감축 · 바닥 AO → 데스크톱 · 모바일 GLB · inner-layout.json · HDRI (일부 층만: NW_FLOORS=b1,12)\n', s)
s, n3 = re.subn(r'\(node:test \d+개 항목\)', '(node:test)', s)
assert (n1, n2, n3) == (1, 1, 1), (n1, n2, n3)
open(p, 'w', encoding='utf-8').write(s)
c = 'public/src/nowhere/nowhere.css'
t = open(c, encoding='utf-8').read()
assert t.count(': 하단 시트 60vh') == 1
open(c, 'w', encoding='utf-8').write(t.replace(': 하단 시트 60vh', ''))
print('ok')
PY
```
Expected: `ok` (어긋나면 해당 줄 문구를 확인해 정규식만 맞춘다)

- [ ] **Step 5: 전체 테스트**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)"` → `# fail 0`

- [ ] **Step 6: 마무리 브라우저 검증(두 월드, 실제 키 입력)**

1. `?ver=seongsu` · `?ver=ds2` 각각: 자동 투어 → (인트로 중 `keyboard.press('Enter')` → 건물 선택 모달이 열린 채 기다림) → `하우스노웨어 성수` → `입장하시겠습니까?` `예` → 1F → 층 버튼 `12` → 창밖 확인 → 엘리베이터 문 앞 `층 선택` → `13F 몬스터 룸` → `이 층 둘러보기`(끝까지 재생되어 자막이 사라짐) → `밖으로 나가기`. 콘솔 오류 없음.
2. 월드 전환 버튼 → 새 페이지 URL 에 `noIntro=1`, 투어가 자동으로 시작하지 않음.
3. 조작 안내(`?`)에 실내 행이 보이고 Esc 로 닫힘.
4. 예산 실측: 데스크톱 · `tier=mobile` 각 4개 층에서 `getStats().triangles`(데스크톱 ≤ 600000 · 모바일 ≤ 300000)와 실내 진입 시 받은 자원 크기(`performance.getEntriesByType('resource')` 중 `nowhere-inner`).
결과를 보고서에 적는다.

- [ ] **Step 7: 스테이징 · 커밋 메시지 제안**

```bash
git add public/src/nowhere/help.js tests/nowhere-help.test.mjs README.md public/src/nowhere/main.js public/src/nowhere/nowhere.css
```
제안 메시지: `docs(inner): 실내 4개 층 조작 안내 · README, 월드 전환 시 투어 다시 돌리지 않기`
