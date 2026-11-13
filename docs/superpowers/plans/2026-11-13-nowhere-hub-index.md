# 카테고리 표지 · 아카이브 목록 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. 스펙: `docs/superpowers/specs/2026-11-13-nowhere-hub-index-design.md`.

**Goal:** ◇ 이동 스팟을 카테고리로 구분하고, 위 막대 `목록`(`L`)에서 건축 · 전시물 · 제품을 골라 바로 감상한다.

**Architecture:** 순수 `hub-index.js`(카테고리 판정 · 목록 · 가기 계획) + `spot-markers.js` `data-category` + 새 `hub-panel.js`(목록 패널 DOM) + `main.js` 연결(가기 실행).

## Global Constraints

- 새 데이터 파일을 만들지 않는다. 목록은 기존 출처(건물 기록 · inner-layout exhibits · products.json 진열)에서 — 문구는 출처 값 그대로, 지어내지 않는다.
- 카테고리 표(스펙 §2) 그대로: `architecture` `A` · `exhibit` `E` · `product` `P` · `move` `→`.
- 키 `L`(목록 열기 · 닫기). 다른 키와 겹치지 않는다(V · Q · E · WASD · Space · Shift · P · ? · 1 · 2 · 3 · 방향키 · Esc).
- 감상 · 이동 동작(제품 · 건물 · 전시물 감상, 보행 스팟 걷기, 실내 층 이동)은 바뀌지 않는다 — 기존 테스트 그대로 통과.
- 그리기 · 삼각형 변화 없음(DOM). 터치 44 px. 사용자에게 보이는 문구는 조사까지 맞춘 자연스러운 한국어.
- 구현자는 git add · commit 하지 않는다. 브라우저 확인은 playwriter MCP 만, 대화상자는 먼저 가로챈다.

---

### Task 1: 카테고리 판정 · 스팟 표지 · 목록 · 가기 계획(순수)

**Files:**
- Create: `public/src/nowhere/hub-index.js`(순수, three · DOM 없음):
  - `CATEGORIES = [{ id: 'architecture', label: '건축', glyph: 'A' }, { id: 'exhibit', label: '전시물', glyph: 'E' }, { id: 'product', label: '제품', glyph: 'P' }, { id: 'move', label: '이동', glyph: '→' }]`.
  - `spotCategory(spot)`: `entrance` · `elevator` · `exit` → `move`, `product` → `product`, `view` 이고 `building` 있음 → `architecture`, 그 밖의 `view`(실내) → `exhibit`.
  - `hubIndex({ records, worldLabel, innerLayout, catalog })` → `[{ id: 'architecture' | 'exhibit' | 'product', label, items: [{ key, id, title, place, floor? }] }]`(개수 0 인 묶음은 뺀다). 건축 자리 `${worldLabel} · 외관`, 전시물 자리 `floorCrumb(floor.id)`, 제품 자리 `floorCrumb(d.floor)`(진열 `floorDisplays` 순서, 진열에 없는 제품 제외).
  - `goPlan(item, { interiorActive, floorId })` → 할 일 배열: 건축 `['open']`, 전시물 · 제품 `[...(interiorActive ? [] : ['enter']), ...(floorId === item.floor && interiorActive ? [] : ['floor']), 'open']`(들어가면 기본 층이 그 층이면 floor 를 건너뛰는 것은 실행 쪽에서 — 계획은 enter 뒤 floor 를 넣는다).
- Modify: `public/src/nowhere/spot-markers.js` — 버튼에 `data-category`(spotCategory), 가까운 단계 동그라미 안 글자는 CSS `content: attr(data-glyph)` 또는 span 텍스트(`data-glyph`).
- Modify: `public/src/nowhere/nowhere.css` — `--nw-cat-architecture` · `--nw-cat-exhibit` · `--nw-cat-product` · `--nw-cat-move` 토큰, 표지 테두리 · 글자 색, 글자 대비 4.5:1 이상.
- Test: 새 `tests/nowhere-hub-index.test.mjs` — 실제 exteriorSpots(두 월드 layout) · interiorSpots(inner-layout 네 층 + products catalog)의 모든 스팟이 카테고리 하나, 정문 = move, 건물 view = architecture, 실내 view = exhibit, 제품 = product; hubIndex 가 실제 출처로 건축 2 · 전시물 10 · 제품 3, 문구 출처 그대로, 진열에서 뺀 제품 제외(`withoutProducts`); goPlan 경우들. spot-markers 연결 정규식.

**확인:** `npm test`. 브라우저 1600 × 900: 외관 보행에서 건물 스팟 표지 `A` · 정문 `→`, 실내 1F 에서 `E` · `P` · 엘리베이터 `→` 캡처(`build/nowhere/compare/hub-spots-*.png`).

### Task 2: 목록 패널 · 위 막대 버튼 · L 키 · 가기 실행 · 안내 · README

**Files:**
- Create: `public/src/nowhere/hub-panel.js` — `createHubPanel({ load: () => Promise<groups>, onGo(item), isBlocked() })`: 위 막대 오른쪽 `목록` 버튼(`.nw-btn` + `L` 키 표시, 막히면 흐리게 · `title="지금은 목록을 열 수 없습니다"`), 왼쪽 서랍(`role="dialog"`, `ARCHIVE INDEX` · `아카이브 목록`, 카테고리 묶음 이름 · 개수 · 색 점, 항목 행 버튼 제목 · 자리), 닫기 `×` · Esc(캡처, 패널이 열렸을 때만 막는다) · `L` · 바깥 클릭, 포커스는 열 때 첫 항목 · 닫을 때 버튼으로. 휴대폰(≤ 720 px)은 전체 화면.
- Modify: `main.js` — 패널 만들기(load = 건물 기록 · `interior` 의 inner-layout(필요하면 받는 함수 노출) · `retail.loadCatalog()` → `hubIndex`), `isBlocked`(인트로 · 방식 고르기 · 비행 · 컷 이동 · 실내 busy · 감상 · 모달 · 조작 안내), `onGo` = `goPlan` 실행(enter → 기본 층이 목적 층이 아니면 goToFloor → open: 건축 `openArchive`, 전시물 `openExhibit`, 제품 `openShowcase`; 각 단계 실패면 멈춤), `L` 키(입력 칸 · 감상 중 · 모달 · 안내 중엔 무시).
- Modify: `nowhere.css`(패널 · 버튼, `body.is-showcase` · `is-cinema` · `is-choosing` 동안 버튼 숨김), `help.js`(공통에 `L`, 보행 ◇ 줄에 카테고리 색 · 글자 — 1600 × 900 배치 유지), `README.md`, `public/nowhere.html` · `public/nowhere-mountain.html`(위 막대에 자리 — 또는 JS 로 삽입), `tests/nowhere-help.test.mjs`.
- Test: 연결 정규식 · 패널 순수 부분.

**확인(전체):** 외관(성수)에서 목록 → 전시물 `거대한 손` → 실내 들어가 13F → 감상 → Esc(13F 그 자리), 실내 13F 에서 목록 → 제품 `Kant` → 1F → 감상, 실내에서 목록 → 건축 `FaceArch` → 감상 → Esc(실내 그 자리), 산악에서 건축, 막힌 상태 버튼, 휴대폰 390 × 844 패널, 콘솔 오류 없음. 캡처 `build/nowhere/compare/hub-*.png`.
