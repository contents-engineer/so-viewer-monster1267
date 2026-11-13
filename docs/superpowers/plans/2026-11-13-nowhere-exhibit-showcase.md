# 실내 전시물 감상 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. 스펙: `docs/superpowers/specs/2026-11-13-nowhere-exhibit-showcase-design.md`.

**Goal:** HAUS 실내 전시물 10 점을 이름표 · 클릭으로 골라 감상 무대에서 돌려 본다.

**Architecture:** 순수 모듈 `exhibits.js`(전시물 목록 · 노드 대응 · 감상 목록) + `interior.js` 가 현재 층 루트 · 전시물 정의를 내준다 + 이름표 · 클릭은 새 `exhibit-tags.js` + `main.js` 의 공통 `openStage`.

## Global Constraints

- 문구를 지어내지 않는다 — inner-layout.json `exhibits` 의 `title` · `desc` 그대로. 층 이름은 inner-layout 층 `label`.
- 제품 · 건물 감상 동작은 바뀌지 않는다(기존 테스트 그대로 통과).
- 상수(한곳, exhibits.js): `EXHIBIT_TAG_RANGE = 8`(m, 수평), `EXHIBIT_TAG_LIFT = 0.6`(m), `EXHIBIT_PICK_RANGE = 15`(m), `CLICK_SLOP = 5`(px), `EXHIBIT_NODES`(스펙 §2 표 그대로).
- 경로 `SUPREME ORIGIN > Retail > HAUS 성수 <B1F|1F|12F|13F> > <title>`(products.js `floorCrumb` 와 같은 층 표기), kicker `EXHIBIT`, 행 `층` · `설명`.
- 복제 모델은 층과 geometry · 재질을 공유 — 감상 목록에 `release` 를 두지 않는다(닫아도 dispose 금지).
- 실내 그리기 · 삼각형 변화 없음(이름표는 DOM).
- 구현자는 git add · commit 하지 않는다. 사용자에게 보이는 문구는 조사까지 맞춘 자연스러운 한국어.
- 브라우저 확인은 playwriter MCP 만, 대화상자는 먼저 가로챈다.

---

### Task 1: `exhibits.js` · 층 루트 노출 · 전시물 감상 열기

**Files:**
- Create: `public/src/nowhere/exhibits.js`(순수): 위 상수, `exhibitNodeMatch(exhibitId, nodeName)`(접두사 · 정확히 규칙 — `EX_plinth` 는 1F 에서 정확히만, `EX_display` 는 `EX_display_screen` 도), `exhibitItems(floorDef)` → `[{ id, name: title, kicker: 'EXHIBIT', crumbs: ['SUPREME ORIGIN', 'Retail', floorCrumb(floorDef.id), title], rows: [{ label: '층', value: floorDef.label }, { label: '설명', value: desc }], note: '' }]`(desc 가 비면 그 행 없음), `exhibitCollection(floorDef, startId)` → `{ kind: 'exhibit', items, startId, hint: '드래그 · 한 손가락 회전 · 휠 · 두 손가락 확대 · ← → 다른 전시물 · Esc 나가기' }`.
- Modify: `public/src/nowhere/interior.js` — `currentFloorDef()`(활성 층 정의 또는 null) · `currentRoot()`(활성 층 루트 또는 null) 를 돌려준다.
- Modify: `public/src/nowhere/main.js` — `openExhibit(id)`: 현재 층에서 `exhibitCollection` + `loadLite: (item) => 노드 복제 묶음`(층 루트에서 `exhibitNodeMatch` 노드를 `updateMatrixWorld` 뒤 월드 행렬째 복제한 Group — 층 루트 변환이 있으면 그 역을 곱해 층 좌표로) 으로 `openStage`. `__NW_APP.openExhibit` 노출. `getStats().showcase` 는 그대로 itemId.
- Modify: `public/src/nowhere/showcase.js` — kind `exhibit` 의 aria-label `전시물 감상` · 오류 문구(필요한 곳만).
- Test: 새 `tests/nowhere-exhibits.test.mjs` — inner-layout 의 모든 전시물이 데스크톱 · 모바일 층 GLB(`tests/lib/glb.mjs readGlbJson`)에서 노드 1 개 이상과 대응, 엘리베이터는 어느 전시물에도 대응 안 함, `EX_plinth_cowboy` 는 city_model 이 아님, 항목 · 경로 · 행 값이 inner-layout 그대로, 이전/다음 순환(products.js `stepItem`), 연결 정규식.

**확인:** `npm test`. 브라우저 1600 × 900: 1F 들어가 `openExhibit('city_model')` → 경로 · 1 / 3 → `→` dj → display(화면 캔버스 보임) → Esc 복원, 13F `monsters`, 제품 감상 회귀 한 번.

### Task 2: 전시물 이름표 · 클릭 고르기 · 안내 · README · 전체 확인

**Files:**
- Create: `public/src/nowhere/exhibit-tags.js` — `createExhibitTags({ camera, canvas, getFloor: () => ({ def, root }) | null, isSuspended, isWalking, onOpen })`: 층마다 이름표 버튼 `.nw-exhibit-tag`(`<title> · 자세히 보기`, 리테일 이름표와 같은 모양), `pos + LIFT` 투영, 수평 8 m · 화면 안이면 보임, 누르면 `onOpen(id)`(blur 로 포커스 비우기). 클릭 픽: 캔버스 캡처 `pointerdown`/`click` — 자유 시점은 끌지 않은 클릭, 보행은 마우스 고정 중 화면 가운데만, 광선(far = 15 m)이 전시물 노드에 맞으면 `stopImmediatePropagation` 후 `onOpen`. 리테일 픽과 순서: 제품이 먼저(제품을 맞히면 리테일이 막는다) — 등록 순서로 보장하고 테스트로 고정. `update()`, `setFloor()` 는 층이 바뀔 때.
- Modify: `main.js` — 만들기 · 매 프레임 `update`(감상 중 아님) · `isSuspended`(층 둘러보기 · 실내 busy · 감상 · 조작 안내 · 모달 · spotCutting · 실내가 아님), 층 바뀔 때 이름표 교체.
- Modify: `nowhere.css`(이름표 — `body.is-showcase` · `is-cinema` 에서 숨김, 터치 44 px), `help.js`(감상 모드 첫 줄에 실내 전시물), `README.md`(기능 표 · 조작).
- Test: 연결 정규식(등록 순서 · 픽 조건 · 이름표), help 테스트.

**확인(전체):** 네 층 이름표(데스크톱), 이름표 → 감상 → 이전/다음 → 나가기 복원, 자유 시점 전시물 클릭, 보행 마우스 고정 중 조준점 클릭(자동화로 고정이 안 되면 코드 경로 확인으로 대신하고 그렇다고 적는다), 1F 에서 제품 받침대 클릭은 제품 감상(전시물이 아님), 태블릿 1180 × 820 · 휴대폰 390 × 844 대표 한 층, 건물 감상 회귀 한 번, 콘솔 오류 없음. 캡처 `build/nowhere/compare/exhibit-*.png`.
