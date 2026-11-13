# 건물 아카이브 카드 · 건물 감상 모드 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. 스펙: `docs/superpowers/specs/2026-11-13-nowhere-building-archive-design.md`.

**Goal:** 외관 두 건물을 고르면 아카이브 카드가 뜨고, `자세히 보기` 로 리테일 감상 무대에서 건물 하나를 돌려 보며 부위 설명을 본다.

**Architecture:** 감상 무대(`showcase.js`)를 제품 전용 인자에서 **목록(collection)** 인자로 공통화하고, 제품 목록은 `products.js`, 건물 목록 · 부위 · 카드 판정은 새 순수 모듈 `archive.js` 가 만든다. 카드 · 이름표 DOM 은 새 `archive-card.js`, 연결은 `main.js`.

**Tech Stack:** three r170(importmap, 빌드 없음), node:test, playwriter(브라우저 확인).

## Global Constraints

- 문구를 지어내지 않는다 — 카드 · 패널은 `assets/record.json` · `assets/facearch.json` · `layout.json` anchors 값 그대로.
- 제품 감상 동작(진열 · 이전/다음 · 고해상도 교체 · 키 문지기 · 클릭 가드 · 복원 · 옆 패널 빈 곳)은 바뀌지 않는다 — 기존 테스트가 그대로 통과해야 한다(정규식 테스트는 바뀐 이름에 맞춰 고친다).
- 상수(한곳): `BUILDING_TAG_RANGE = 220`(m), `BUILDING_TAG_LIFT = 4`(m), `CARD_KEEP_RANGE = 260`(m), `CLICK_SLOP = 5`(px, retail 과 같은 값), `PART_EXCLUDE = ['haus_garden']`.
- 경로: 제품 `SUPREME ORIGIN > Retail > HAUS 성수 1F > <제품>`(그대로), 건물 `SUPREME ORIGIN > Architecture > <title>`.
- kicker: 건물 `ARCHITECTURE · <index>`(0001 · 0002), 부위 `<건물 title> · PART`.
- 건물 순서: `haus` → `facearch`(이전 · 다음 순환).
- 외관 그리기 · 삼각형 변화 없음(이름표 · 카드 · 표지는 DOM).
- 커밋은 컨트롤러가 태스크 리뷰 통과 뒤에 한다(구현자는 git add · commit 하지 않는다). 커밋 꼬리: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- 사용자에게 보이는 문구는 조사까지 맞춘 자연스러운 한국어.
- 브라우저 확인은 playwriter MCP 만. 대화상자는 먼저 가로챈다(`window.confirm/alert/prompt` 를 기록만 하는 함수로).

## 감상 목록(collection) 인터페이스 — Task 1 이 만들고 Task 2 · 3 이 쓴다

```js
// showcase.open(collection) — 열었으면 true
{
  kind: 'product' | 'building',
  items: [{ id, name, kicker, crumbs: string[], rows: [{ label, value }], note: string, liteUrl?: string, hiUrl?: string | null }],
  startId: string,
  loadLite?: (item) => Promise<Object3D | null>,   // 없으면 무대 로더가 item.liteUrl 을 받는다(주소별 캐시, 실패는 캐시하지 않는다)
  hint: string,                                    // 아래 한 줄 안내
  parts?: (item) => [{ id, title, local: [x, y, z], kicker, rows: [{ label, value }], lore: string }],   // Task 3
}
```
- 고해상도 교체는 `item.hiUrl` 이 있고 휴대폰이 아닐 때만. 상태 문구는 교체를 기다릴 때만 보인다.
- `getState()` → `{ active, kind, itemId, productId(kind === 'product' 일 때 itemId, 아니면 null), level, autoRotate, distance, minDistance, maxDistance, part }`.
- 이전 · 다음은 `items` 순서로 순환(`stepItem(items, id, dir)` — 순수, products.js 의 `stepProduct` 는 이것을 쓴다).

---

### Task 1: 감상 무대 공통화 + 제품 목록 + `archive.js`(순수)

**Files:**
- Modify: `public/src/nowhere/showcase.js` — `open(collection)`, `show(id)` 는 목록에서 찾기, `loadLite` 없으면 `item.liteUrl` 을 무대 GLTFLoader 로(주소별 캐시 — 실패는 지운다), 고해상도 캐시도 주소별 · 실패는 지운다(태블릿 일시 실패 뒤 다시 시도). 정보 채우기는 `item.crumbs · kicker · name · rows · note`(note 는 패널 안 작은 글씨 줄 `.nw-showcase-note`, 비면 숨김), 개수 `i / n`, 안내 줄 `collection.hint`, `aria-label` 은 kind 별(`제품 감상` · `건물 감상`). 오류 문구도 kind 별.
- Modify: `public/src/nowhere/products.js` — `stepItem(items, id, dir)`, `productCollection(catalog, floorId, startId)`(items: `{ id, name, kicker: category.toUpperCase(), crumbs: breadcrumb(floorId, name), rows: infoRows(p), note: '', hiUrl: p.glb, product: p }`, hint 지금 문구 그대로), `stepProduct` 는 `stepItem` 사용.
- Create: `public/src/nowhere/archive.js`(순수 — three · DOM 없음):
  - `BUILDING_IDS = ['haus', 'facearch']`, `BUILDING_RECORDS = { haus: 'assets/record.json', facearch: 'assets/facearch.json' }`, 위 상수들, `ARCHITECTURE_CRUMBS = ['SUPREME ORIGIN', 'Architecture']`.
  - `worldToBuilding(layout, id, [x, y, z])` — `tour-config.js` `buildingToWorld` 의 역(왕복 오차 < 1e-9). 건물 없으면 null.
  - `buildingItem(id, record, heroUrl)` → `{ id, name: record.title, kicker: 'ARCHITECTURE · ' + record.index, crumbs: [...ARCHITECTURE_CRUMBS, record.title], rows: record.facts → { label, value }, note: record.note || '', liteUrl: heroUrl, hiUrl: null }`.
  - `buildingCollection(records, heroUrls, startId)` → `{ kind: 'building', items(BUILDING_IDS 순서, record · heroUrl 있는 것만), startId, hint: '드래그 · 한 손가락 회전 · 휠 · 두 손가락 확대 · ← → 다른 건물 · Esc 나가기' }`.
  - `buildingParts(layout, id)` → layout.anchors 중 layer `building` · id 가 `${id}_` 로 시작 · PART_EXCLUDE 아님 → `{ id, title, local: worldToBuilding(...), kicker: '', rows, lore }`(kicker 는 Task 3 이 건물 title 로 채운다 — 여기서는 빈 문자열 대신 인자로 받아도 된다: `buildingParts(layout, id, buildingTitle)` → kicker `${buildingTitle} · PART`).
  - `cardBuildingForSpot(spot)` → `spot.building && spot.kind === 'view' ? spot.building : null`.
  - `tagVisible({ distance, ndc: [x, y, z] })` → `distance <= BUILDING_TAG_RANGE && |x| ≤ 1 && |y| ≤ 1 && -1 < z < 1`.
- Modify: `public/src/nowhere/main.js` — `openShowcase(productId)` 가 `productCollection(...)` + `loadLite: (item) => retail.liteSource(item.product)` 로 연다(동작 그대로). `getStats().showcase` 는 `getState().itemId`.
- Test: `tests/nowhere-products.test.mjs`(stepItem · productCollection · 기존 정규식 갱신), 새 `tests/nowhere-archive.test.mjs`(record 두 파일 · 두 월드 layout 으로 buildingItem · buildingCollection · worldToBuilding 왕복 · buildingParts 6 개(garden 제외) · 부위 로컬 좌표가 그 건물 solids/경계 안(성수 layout `HAUS` · `FACEARCH` solids 를 월드 기준으로) · cardBuildingForSpot(정문 제외) · tagVisible).

**확인:** `npm test` 전부 통과. 브라우저: 실내 1F 제품 감상 열기 → 이전/다음 → 고해상도 교체 → 나가기 복원이 전과 같다(데스크톱 1600 × 900 한 번).

### Task 2: 건물 이름표 · 아카이브 카드 · 고르기 · 건물 감상 열기 · 조작 안내 · README

**Files:**
- Modify: `public/src/nowhere/world.js` — 두 건물 루트를 배치한 직후(processRoot 병합 전) 월드 경계 상자를 재서 `buildingBoxes: { haus: Box3, facearch: Box3 }` 로 돌려준다.
- Create: `public/src/nowhere/archive-card.js` — `createArchiveCard({ camera, canvas, layout, quality, getBoxes, isSuspended, onDetail, onClose? })`:
  - 이름표: 건물마다 버튼 `.nw-archive-tag`(`<title> · 기록 보기`), 경계 상자 윗면 가운데 + `BUILDING_TAG_LIFT`, `tagVisible` 로 보이기, 누르면 `show(id)`. `isSuspended()` 이면 모두 숨김.
  - 카드: `.nw-archive-card`(감상 정보 패널과 같은 모양 · 같은 자리, 휴대폰 · 세로 태블릿은 아래 — CSS 미디어 조건은 감상 패널과 같게), kicker · 제목 · facts · note · 버튼 `자세히 보기`(→ `onDetail(id)`) · `닫기`. `show(id)`, `hide()`, `isOpen()`, `currentId()`.
  - 자유 시점 클릭: 캔버스 `pointerdown`/`click` 캡처, 보행 아님 · 끌지 않음(CLICK_SLOP) · `isSuspended()` 아님일 때 카메라 광선이 건물 경계 상자(`Ray.intersectBox`)에 맞으면 가까운 건물 `show(id)`. 맞지 않으면 아무것도 하지 않는다(다른 클릭 처리기 그대로).
  - `Esc`: 카드가 떠 있고 조작 안내 · 모달이 닫혀 있으면 캡처 단계에서 카드만 닫고 막는다(감상 · 모달 · 조작 안내가 먼저).
  - `update()`: 매 프레임 이름표 위치, 카드 건물에서 `CARD_KEEP_RANGE` 밖이면 닫기.
  - 데이터: `BUILDING_RECORDS` 두 파일을 한 번 받아 둔다(실패한 건물은 이름표 · 카드 없음).
- Modify: `public/src/nowhere/main.js` — 만들기 · `update` 호출(감상 중 아님일 때), `isSuspended`(인트로 · 방식 고르기 · 시나리오 진행 · 실내 · 감상 · 조작 안내 · 모달 · spotCutting · 비행 등 — 이름표가 화면을 어지럽히지 않게), 숨겨야 할 때 카드 닫기(실내 들어가기 · 월드 전환 · 투어 시작 · 감상 열기). `arriveAt` 외관 분기에 `cardBuildingForSpot(spot)` 이면 카드. `openArchive(id)` = 카드의 `자세히 보기`: `buildingCollection(...)` 으로 `showcase.open`, 연 자리 기록 · 보행 끄기 · 복원은 제품과 같은 함수(`restoreFromShowcase` 를 실내 전용 조건 없이 — 외관도 되돌린다).
- Modify: `public/src/nowhere/nowhere.css` — 이름표 · 카드(기존 `--nw-*` 토큰, 휴대폰 44 px 버튼). `body.is-cinema` · `is-choosing` · `is-showcase` 동안 이름표 · 카드 숨김.
- Modify: `public/src/nowhere/help.js` — 넷째 묶음을 `감상 모드`(`VIEW MODE`)로: 건물 이름표 「기록 보기」 · 자유 시점에서 건물 클릭 · 건물 스팟 도착 → 카드, 「자세히 보기」 → 건물 감상, 제품은 지금 줄 그대로, `←`/`→` 줄은 "같은 층 진열 순서 · 두 건물 순서".
- Modify: `README.md` — 기능 표에 건물 카드 · 건물 감상 줄, 조작 안내 설명.
- Test: `tests/nowhere-archive.test.mjs` 에 연결 정규식(이름표 · 카드 · 클릭 캡처 · Esc · 스팟 도착 · openArchive · restore 외관), `tests/nowhere-help.test.mjs` 갱신.

**확인:** 브라우저 성수 데스크톱: 이름표 두 개 → 카드 → 자세히 보기 → 건물 감상(이전/다음) → 나가기 복원(자유 · 보행 각각), 자유 시점 건물 클릭 → 카드, 보행 스팟(`face_front`) 도착 → 카드, 정문 도착은 입장 질문 그대로, Esc 로 카드만 닫힘.

### Task 3: 부위 표지 · 부위 패널 + 전체 브라우저 확인 · 예산

**Files:**
- Modify: `public/src/nowhere/showcase.js` — `collection.parts(item)` 가 있으면 모델 자식으로 표지 점(`local`), DOM 버튼 `.nw-showcase-part`(부위 title 의 ' — ' 뒤 또는 전체, 짧게)를 매 프레임 투영. 가림: 표지 점에서 카메라 쪽 광선이 모델에 먼저 맞으면 `.is-behind`(흐리게, 누를 수 있음). 누르면 패널이 부위로(kicker · title · rows · lore 문단 `.nw-showcase-lore` · `‹ 건물 정보` 버튼), 다시 누르거나 버튼 · 다른 건물이면 건물 정보로. `getState().part`.
- Modify: `public/src/nowhere/main.js` — 건물 목록에 `parts: (item) => buildingParts(layout, item.id, item.name)`.
- Modify: `nowhere.css` · `help.js`(부위 표지 줄) · `README.md`.
- Test: 정규식 · 순수 부분.

**확인(전체):** 두 월드 × 데스크톱 1600 × 900 · 태블릿 1180 × 820 · 휴대폰 390 × 844 — 이름표 → 카드 → 감상 → 부위 → 건물 정보 → 이전/다음 → 나가기 복원, 제품 감상 회귀. 감상 그리기 · FPS(전원), 콘솔 오류 없음. 캡처는 `build/nowhere/compare/archive-*.png`.
