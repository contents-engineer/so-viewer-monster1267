# 몰입형 시작 흐름 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 처음 들어오는 사람이 버튼 바부터 보지 않고, 월드를 고르고(일반 주소 `/`) → 고른 월드 이미지 위 로딩 → 영화식 인트로(위아래 띠 · 제목 자막 · 건너뛰기 · 진행 선) → 「어떻게 둘러볼까요?」 방식 고르기 → 가이드 투어 · 직접 걷기 · 자유 시점으로 이어 가게 한다.

**Architecture:** 순수 시작 결정(`entry.js` `resolveEntry`)이 선택 화면 · 월드 · 인트로 · 방식을 정하고, `main.js` 는 선택 화면(`world-select.js`, DOM)을 렌더러 · 월드 생성보다 먼저 띄운다. 인트로는 시나리오 밖에서 `camCtrl.startIntro` 와 DOM 연출(`cinema.js`)을 함께 돌리고, 끝나면 방식 고르기(`mode-menu.js`)가 방식 컨트롤러(`modes.js` — `body[data-mode]` · 상단 `#nw-mode-seg`)에 넘긴다. 시나리오는 `intro` 단계를 버리고 건물 선택부터 시작하며, 옛 버튼 세 개(투어 시작 · 건물 이동 · 보행 시점)는 방식 전환 버튼 하나로 바뀐다. 새 화면은 모두 DOM 이라 그리기 비용 0.

**Tech Stack:** three.js r170(ES 모듈 + importmap, 빌드 없음), `node --test`, playwriter MCP(브라우저 확인), `npm start`(`serve` 정적 서버 :4173, `public/`).

**Spec:** `docs/superpowers/specs/2026-11-12-nowhere-immersive-entry-design.md`

## Global Constraints

- 렌더 비용 0: 선택 화면 · 인트로 연출 · 방식 카드 · 방식 전환은 DOM 만. 그리기 호출 · 삼각형을 늘리지 않는다(같은 시점 · 시각에서 오버레이 유무로 `getStats().calls` · `triangles` 가 같아야 한다, 모바일 조감 예산 180 그리기 · 900,000 삼각형 안).
- FPS ≥ 60 유지(데스크톱 · `&tier=mobile`, 인트로 연출 · 방식 고르기 표시 중 포함).
- DS2 월드 모습은 그대로: `world.js` · `weather.js` · `post.js` · `sky.js` · `surface.js` · `public/assets/**`(GLB · layout · 렌더 webp)를 바꾸지 않는다. 선택 화면 · 로딩은 기존 렌더 webp 를 그대로 쓴다.
- 선택 화면 동안에는 3D 월드 자산(GLB · HDRI · `layout.json`)을 받지 않는다 — 받는 것은 이미지 두 장(+ 이미 실려 있는 JS 모듈 · 글꼴).
- 방식 이름(그대로 쓴다): `가이드 투어`(GUIDED TOUR) · `직접 걷기`(WALK) · `자유 시점`(FREE VIEW), 상태 id `guide` · `walk` · `free`.
- UI 문구(그대로 쓴다): 선택 화면 `HAUS NOWHERE` · `SEONGSU · 2041` / `CHIRAL HIGHLAND · DS2` · `성수 2041` / `DS2 산악 고원` · `들어가기 →`; 인트로 `37.544°N 127.056°E` · `HAUS NOWHERE — 성수 2041` / `HAUS NOWHERE — DS2 산악 고원` · `건너뛰기 ›`; 방식 고르기 `어떻게 둘러볼까요?` · 카드 설명 `두 건물과 실내를 차례로 안내합니다` / `눈높이로 걸으며 ◇ 스팟을 따라 이동합니다` / `카메라를 돌리고 확대하며 원하는 시점에서 봅니다`.
- 값(그대로 쓴다): 선택 화면 넓어짐 60 % : 40 % · 전환 0.6 s · 배경 확대 8 s 동안 1.0 → 1.06 · 고르면 0.6 s 펼침; 세로 화면 = 가로 < 세로 · 폭 ≤ 720 px; 띠 높이 `max(48px, 11vh)` · 0.6 s 에 들어옴 · 0.5 s 에 빠짐; 제목 자막 1.0 s 에 나타나 5.0 s 에 사라짐; 진행 선 = 인트로 경과 / 12 s; 방식 카드 사라짐 0.3 s; 터치 대상 ≥ 44 px.
- 기존 바로가기 주소(`?cam=…` · `?weather=…` · `?time=…` · `?noIntro=1`)는 지금처럼 그 시점 · 자유 시점으로 인트로 없이 들어간다. `nowhere.html` 은 `window.__NW_DEFAULT_WORLD = 'seongsu'`, `index.html` 은 기본 월드 없음(선택 화면).
- 범위 밖(스펙 §11): 미리 찍은 인트로 영상, 선택 화면 실시간 3D 미리보기, 인트로 다시 보기 버튼, 첫 방문 기억(localStorage), 가이드 투어의 실내 층 둘러보기 자동 연결.
- UI 문구 · 주석은 한국어(기존 파일 문체 — '·' 구분, 존댓말 없는 설명체). 코드 식별자는 영어.
- 테스트: `npm test`(= `node --test "tests/*.test.mjs"`, 시작 시점 159개 통과) 전부 통과.
- 브라우저 확인은 playwriter MCP(`mcp__playwriter__execute` · `mcp__playwriter__reset`)만 쓴다. Playwright MCP 는 쓰지 않고, playwriter 가 실패하면 그 사실을 보고하고 다른 도구로 넘어가지 않는다. 페이지를 열 때마다 바로 `window.confirm/alert/prompt` 를 기록용 함수로 바꾸고(`page.on('dialog')` 에 기대지 않는다), 기다림은 짧은 호출 여러 번으로 나누며, 각 호출 시작에 `evaluate` 가 3 s 안에 돌아오는지 확인한다(첫 로드는 10–40 s 막힐 수 있다).
- 커밋하지 않는다. 구현 서브에이전트는 커밋 · 스테이징하지 않는다 — 각 태스크 끝의 "스테이징" 단계는 리뷰 통과 뒤 컨트롤러가 그 경로만 `git add` 하고 커밋 메시지 안을 보고한다(사용자가 요청할 때만 커밋). `git add -A` · `git add .` 금지. 이 계획 · 스펙 문서와 `docs/superpowers/specs/2026-11-12-nowhere-flying-roadster-design.md` 는 태스크 스테이징에 넣지 않는다.
- 작업 브랜치: `feat/immersive-entry`(main @ 80f67da 에서 분기, 이미 체크아웃됨).
- 서브에이전트(구현 · 리뷰) 모델은 Claude 5.5 이상만 — `sonnet` 또는 `opus`. 더 낮은 모델을 고르게 되면 `sonnet` 을 쓴다.

## File Structure

| 파일 | 책임 |
|---|---|
| `public/src/nowhere/entry.js` (새, 순수) | `resolveEntry(params, defaultWorld)` · `WORLD_IDS` · `MODE_IDS` |
| `public/src/nowhere/world-select.js` (새) | `WORLD_CARDS` · `resolveSelectKey`(순수) · `showWorldSelect()` DOM |
| `public/src/nowhere/cinema.js` (새) | `INTRO_TITLES` · 타이밍 상수(순수) · `createCinema()` DOM(띠 · 자막 · 건너뛰기 · 진행 선) |
| `public/src/nowhere/mode-menu.js` (새) | `MODES` · `resolveMenuKey`(순수) · `showModeMenu()` DOM |
| `public/src/nowhere/modes.js` (새) | `createModeController()` 상태 · 적용 규칙, `renderMode()`(`body[data-mode]` · `#nw-mode-seg`) |
| `public/src/nowhere/camera.js` (수정) | `skipIntro()` 공개(지금의 인트로 끼어들기와 같은 동작) · `getIntroProgress()` |
| `public/src/nowhere/scenario.js` (수정) | `intro` 단계 제거, 시작 `chooseBuilding` |
| `public/src/nowhere/main.js` (수정) | 시작 결정 → 선택 화면(렌더러 전) → 월드 · 로딩 → 인트로 + 연출 → 방식 고르기 → 방식 적용, Esc, 방식 전환 · 월드 전환 연결, 옛 버튼 연결 제거 |
| `public/index.html` · `public/nowhere.html` · `public/nowhere-mountain.html` (수정) | 상단 버튼 세 개 → `#nw-mode-seg`, `nowhere.html` 기본 월드 · `body[data-world-ver]` |
| `public/src/nowhere/nowhere.css` (수정) | 선택 화면, 로더 배경(월드별), 영화 띠 · HUD 숨김, 방식 카드, 방식 전환 버튼, `body[data-mode]` · 실내 규칙 |
| `public/src/nowhere/help.js` · `README.md` (수정) | 조작 안내 · 조작 표 |
| `tests/nowhere-entry.test.mjs` · `tests/nowhere-world-select.test.mjs` · `tests/nowhere-cinema.test.mjs` · `tests/nowhere-mode-menu.test.mjs` · `tests/nowhere-modes.test.mjs` (새), `tests/nowhere-scenario.test.mjs` · `tests/nowhere-help.test.mjs` (수정) | 테스트 |

`main.js` 는 여러 태스크가 차례로 고친다. 단계마다 바꿀 코드를 원문 그대로 보여 주므로 줄 번호가 아니라 그 내용으로 찾는다(`80f67da 기준` 줄 번호는 참고용).

---

### Task 1: 시작 결정(`entry.js`) · 페이지 기본 월드

**Files:**
- Create: `public/src/nowhere/entry.js`
- Modify: `public/nowhere.html:19-21` (importmap 아래 기본 월드 스크립트, `<body>` 속성)
- Test: `tests/nowhere-entry.test.mjs` (새)

**Interfaces:**
- Consumes: 없음(URL 검색 매개변수 · 페이지 HTML)
- Produces (Task 2 · 4 · 5 가 쓴다):
  - `resolveEntry(params: URLSearchParams | null, defaultWorld?: string) → { select: boolean, world: 'seongsu'|'ds2'|null, intro: boolean, mode: 'guide'|'walk'|'free'|null }`
  - `WORLD_IDS = ['seongsu', 'ds2']`, `MODE_IDS = ['guide', 'walk', 'free']`
  - `nowhere.html`: `window.__NW_DEFAULT_WORLD = 'seongsu'`, `<body data-world-ver="seongsu">` (로더 배경이 JS 전에도 맞게)

- [ ] **Step 1: 브랜치 확인**

```bash
git branch --show-current
```

Expected: `feat/immersive-entry`

- [ ] **Step 2: 실패하는 테스트 작성** — `tests/nowhere-entry.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveEntry, WORLD_IDS, MODE_IDS } from '../public/src/nowhere/entry.js';

const page = (name) => readFileSync(new URL(`../public/${name}`, import.meta.url), 'utf8');
const pageDefault = (html) => html.match(/window\.__NW_DEFAULT_WORLD\s*=\s*'([a-z0-9]+)'/)?.[1];
const DEF = {
  index: pageDefault(page('index.html')),
  nowhere: pageDefault(page('nowhere.html')),
  mountain: pageDefault(page('nowhere-mountain.html')),
};
const at = (search, def) => resolveEntry(new URLSearchParams(search), def);

test('(a) 페이지 기본 월드: / 는 없음 · /nowhere 는 성수 · /nowhere-mountain 은 산악, 로더 배경용 body[data-world-ver] 도 같게', () => {
  assert.equal(DEF.index, undefined);
  assert.equal(DEF.nowhere, 'seongsu');
  assert.equal(DEF.mountain, 'ds2');
  assert.match(page('index.html'), /<body>/);
  assert.match(page('nowhere.html'), /<body data-world-ver="seongsu">/);
  assert.match(page('nowhere-mountain.html'), /<body data-world-ver="ds2">/);
  assert.deepEqual(WORLD_IDS, ['seongsu', 'ds2']);
  assert.deepEqual(MODE_IDS, ['guide', 'walk', 'free']);
});

test('(b) 일반 주소 / 는 월드 선택 화면 → 고른 뒤 인트로 · 방식 고르기', () => {
  assert.deepEqual(at('', DEF.index), { select: true, world: null, intro: true, mode: null });
});

test('(c) 월드별 바로가기는 선택 화면 없이 인트로 → 방식 고르기', () => {
  assert.deepEqual(at('', DEF.nowhere), { select: false, world: 'seongsu', intro: true, mode: null });
  assert.deepEqual(at('', DEF.mountain), { select: false, world: 'ds2', intro: true, mode: null });
  assert.deepEqual(at('?ver=ds2', DEF.index), { select: false, world: 'ds2', intro: true, mode: null });
  assert.deepEqual(at('?ver=seongsu', DEF.index), { select: false, world: 'seongsu', intro: true, mode: null });
  assert.deepEqual(at('?ver=seongsu', DEF.mountain), { select: false, world: 'seongsu', intro: true, mode: null }, 'ver 가 페이지 기본보다 먼저');
});

test('(d) 바로가기 링크(cam · weather · time)와 noIntro=1 은 지금처럼 인트로 없이 자유 시점', () => {
  const FREE = (world) => ({ select: false, world, intro: false, mode: 'free' });
  assert.deepEqual(at('?cam=future', DEF.index), FREE('seongsu'));
  assert.deepEqual(at('?noIntro=1&cam=future', DEF.nowhere), FREE('seongsu'));
  assert.deepEqual(at('?weather=rain', DEF.index), FREE('seongsu'));
  assert.deepEqual(at('?time=21:30', DEF.mountain), FREE('ds2'));
  assert.deepEqual(at('?ver=ds2&noIntro=1&cam=lot&weather=rain&time=21:30', DEF.index), FREE('ds2'));
  assert.deepEqual(at('?noIntro=1', DEF.index), FREE('seongsu'));
  assert.deepEqual(at('?noIntro=1', DEF.mountain), FREE('ds2'));
});

test('(e) mode 매개변수: 월드 전환 주소(?ver=…&noIntro=1&mode=…)는 그 방식으로 바로, 인트로가 있으면 인트로 뒤 그 방식', () => {
  assert.deepEqual(at('?ver=ds2&noIntro=1&mode=walk', DEF.index), { select: false, world: 'ds2', intro: false, mode: 'walk' });
  assert.deepEqual(at('?ver=seongsu&noIntro=1&mode=guide', DEF.mountain), { select: false, world: 'seongsu', intro: false, mode: 'guide' });
  assert.deepEqual(at('?mode=free', DEF.index), { select: false, world: 'seongsu', intro: true, mode: 'free' });
  assert.deepEqual(at('?cam=aerial&mode=walk', DEF.index), { select: false, world: 'seongsu', intro: false, mode: 'walk' });
});

test('(f) 잘못된 ver · mode · noIntro 값과 빈 값은 없는 것으로 본다', () => {
  const SELECT = { select: true, world: null, intro: true, mode: null };
  assert.deepEqual(at('?ver=moon', DEF.index), SELECT);
  assert.deepEqual(at('?ver=moon', DEF.nowhere), { select: false, world: 'seongsu', intro: true, mode: null });
  assert.deepEqual(at('?mode=fly', DEF.index), SELECT);
  assert.deepEqual(at('?ver=ds2&mode=fly', DEF.index), { select: false, world: 'ds2', intro: true, mode: null });
  assert.deepEqual(at('?noIntro=0', DEF.index), SELECT);
  assert.deepEqual(at('?cam=', DEF.index), SELECT);
  assert.deepEqual(resolveEntry(new URLSearchParams(''), 'mars'), SELECT);
  assert.deepEqual(resolveEntry(null, 'ds2'), { select: false, world: 'ds2', intro: true, mode: null });
});
```

- [ ] **Step 3: 실패 확인**

Run: `node --test tests/nowhere-entry.test.mjs`
Expected: FAIL — `entry.js` 가 없다(`ERR_MODULE_NOT_FOUND`).

- [ ] **Step 4: `public/src/nowhere/entry.js` 작성**

```js
// HAUS NOWHERE — 시작 결정(순수, three · DOM 없음 — 테스트: tests/nowhere-entry.test.mjs).
// 주소 매개변수 + 페이지 기본 월드(window.__NW_DEFAULT_WORLD: index.html 없음 · nowhere.html 'seongsu' · nowhere-mountain.html 'ds2') →
// { select: 월드 선택 화면을 띄울지, world, intro: 인트로를 돌릴지, mode: 둘러보기 방식(null 이면 인트로 뒤 방식 고르기) }.
// 선택 화면에서 고른 뒤에는 { world: 고른 것, intro: true, mode: null } 로 이어 간다(주소는 바꾸지 않는다).

export const WORLD_IDS = ['seongsu', 'ds2'];
export const MODE_IDS = ['guide', 'walk', 'free'];

export function resolveEntry(params, defaultWorld = null) {
  const get = (key) => (params && typeof params.get === 'function' ? params.get(key) : null) || '';
  // 바로가기 링크(캡처 · 테스트 주소): 시점 · 기상 · 시각 중 하나라도 있으면 지금처럼 그 시점 · 자유 시점으로 바로
  const deep = Boolean(get('cam') || get('weather') || get('time'));
  const noIntro = get('noIntro') === '1';
  const modeParam = MODE_IDS.includes(get('mode')) ? get('mode') : null;
  let world = WORLD_IDS.includes(get('ver')) ? get('ver') : WORLD_IDS.includes(defaultWorld) ? defaultWorld : null;
  // 선택 화면은 월드가 정해지지 않았고 바로가기 · noIntro=1 · mode 가 모두 없을 때만
  const select = world === null && !deep && !noIntro && !modeParam;
  if (!select && world === null) world = 'seongsu';
  return {
    select,
    world,
    intro: !deep && !noIntro,
    mode: modeParam || (deep || noIntro ? 'free' : null),
  };
}
```

- [ ] **Step 5: `nowhere.html` 기본 월드** — importmap `</script>` 다음 줄(현재 19행 `  </script>` 와 20행 `</head>` 사이)에 넣고(`nowhere-mountain.html` 과 같은 모양)

```html
  <script>
    window.__NW_DEFAULT_WORLD = 'seongsu';
  </script>
```

  `<body>` 를 `<body data-world-ver="seongsu">` 로 바꾼다(로더 배경이 JS 실행 전에도 성수 이미지 — Task 2 CSS).

- [ ] **Step 6: 통과 확인**

Run: `node --test tests/nowhere-entry.test.mjs`
Expected: PASS (6개)

- [ ] **Step 7: 전체 테스트**

Run: `npm test`
Expected: 모든 테스트 PASS (실패 0). `main.js` 는 아직 `params.get('ver') || window.__NW_DEFAULT_WORLD || 'seongsu'` 를 쓰므로 동작 변화 없음.

- [ ] **Step 8: 스테이징(커밋하지 않음) — 리뷰 통과 뒤 컨트롤러가 실행**

```bash
git add public/src/nowhere/entry.js public/nowhere.html tests/nowhere-entry.test.mjs
```

커밋 메시지 안(보고서에 적는다): `feat(nowhere): 시작 결정 resolveEntry — 선택 화면 · 월드 · 인트로 · 방식, nowhere.html 기본 월드`

---

### Task 2: 월드 선택 화면 · 로딩 배경 · 렌더러 전 선택

**Files:**
- Create: `public/src/nowhere/world-select.js`
- Modify: `public/src/nowhere/nowhere.css:41-60` (로더 배경), 로더 섹션 뒤에 선택 화면 스타일
- Modify: `public/src/nowhere/main.js` (import, 80f67da 기준 28–31행 월드 결정 · 362–364행 인트로 조건)
- Modify: `README.md:80` (웹이 직접 쓰는 렌더)
- Test: `tests/nowhere-world-select.test.mjs` (새)

**Interfaces:**
- Consumes: Task 1 `resolveEntry`, `WORLD_IDS`
- Produces:
  - `WORLD_CARDS: Array<{ id: 'seongsu'|'ds2', kicker, title, desc, image }>` (image = 페이지 기준 경로 `assets/…/renders/hero-*.webp`)
  - `SELECT_EXPAND_MS = 600`, `SELECT_FADE_MS = 300`, `SELECT_BRAND = 'HAUS NOWHERE'`, `SELECT_CTA = '들어가기 →'`
  - `resolveSelectKey(key: string, index: number) → { focus: number } | { pick: 'seongsu'|'ds2' } | null`
  - `showWorldSelect() → Promise<'seongsu'|'ds2'>` — 고르면 `document.body.dataset.worldVer` 를 먼저 바꾸고 0.6 s 펼친 뒤 resolve, 0.3 s 뒤 DOM 제거
  - `main.js`: `const entry = resolveEntry(params, window.__NW_DEFAULT_WORLD)` (Task 5 가 `entry.intro` · `entry.mode` 를 쓴다), `worldVer` 는 선택 뒤 결정
  - CSS: `.nw-loader` 기본 배경은 무늬 없음, `body[data-world-ver="seongsu"|"ds2"] .nw-loader` 가 `WORLD_CARDS` 와 같은 이미지

이미지 선택(스펙 §2 후보 중): 성수 `hero-future.webp`(벽돌 골목 · 유리 타워 · 스카이브리지, 가운데 소실점이라 40–60 % 폭과 세로 화면 잘림에도 구도가 남는다), 산악 `hero-valley.webp`(V자 빙하 계곡, 같은 이유). 두 면이 밝은 도시 / 회색 계곡으로 대비된다. Task 7 에서 캡처를 보고 구도가 나쁘면 후보(`hero-street`)로 바꾼다.

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/nowhere-world-select.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  WORLD_CARDS, SELECT_CTA, SELECT_BRAND, SELECT_EXPAND_MS, SELECT_FADE_MS, resolveSelectKey,
} from '../public/src/nowhere/world-select.js';
import { WORLD_IDS } from '../public/src/nowhere/entry.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('(a) 두 면: 왼쪽 성수 2041 · 오른쪽 DS2 산악, 문구 그대로 · 설명은 한 줄', () => {
  assert.deepEqual(WORLD_CARDS.map((c) => c.id), WORLD_IDS);
  assert.deepEqual(WORLD_CARDS.map((c) => [c.kicker, c.title]), [
    ['SEONGSU · 2041', '성수 2041'],
    ['CHIRAL HIGHLAND · DS2', 'DS2 산악 고원'],
  ]);
  for (const c of WORLD_CARDS) assert.ok(c.desc.length > 0 && c.desc.length <= 32, `${c.id} 설명 ${c.desc.length}자`);
  assert.equal(SELECT_CTA, '들어가기 →');
  assert.equal(SELECT_BRAND, 'HAUS NOWHERE');
  assert.equal(SELECT_EXPAND_MS, 600);
  assert.equal(SELECT_FADE_MS, 300);
});

test('(b) 이미지: 스펙 후보 렌더 중 하나이고 파일이 있다', () => {
  const CANDIDATES = {
    seongsu: ['assets/nowhere/renders/hero-future.webp', 'assets/nowhere/renders/hero-street.webp'],
    ds2: ['assets/nowhere-ds2/renders/hero-valley.webp', 'assets/nowhere-ds2/renders/hero-street.webp'],
  };
  for (const c of WORLD_CARDS) {
    assert.ok(CANDIDATES[c.id].includes(c.image), `${c.id}: ${c.image}`);
    assert.ok(existsSync(new URL(`../public/${c.image}`, import.meta.url)), c.image);
  }
});

test('(c) 로딩 화면 배경: 월드가 정해지기 전에는 이미지 없음, 정해지면 선택 화면과 같은 이미지', () => {
  const css = read('../public/src/nowhere/nowhere.css');
  const base = css.match(/\n\.nw-loader \{[^}]*\}/)?.[0];
  assert.ok(base, '.nw-loader 규칙 없음');
  assert.doesNotMatch(base, /url\(/, '월드를 고르기 전 로더에 이미지가 있음');
  for (const c of WORLD_CARDS) {
    const rule = css.match(new RegExp(`body\\[data-world-ver="${c.id}"\\] \\.nw-loader \\{[^}]*\\}`))?.[0];
    assert.ok(rule, `${c.id} 로더 규칙 없음`);
    assert.ok(rule.includes(`url('../../${c.image}')`), `${c.id} 로더 이미지가 선택 화면과 다름`);
  }
});

test('(d) 키: ←/→ 는 포커스(끝에서 멈춤), Enter 는 포커스된 면, 그 밖은 null', () => {
  assert.deepEqual(resolveSelectKey('ArrowRight', 0), { focus: 1 });
  assert.deepEqual(resolveSelectKey('ArrowRight', 1), { focus: 1 });
  assert.deepEqual(resolveSelectKey('ArrowLeft', 1), { focus: 0 });
  assert.deepEqual(resolveSelectKey('ArrowLeft', 0), { focus: 0 });
  assert.deepEqual(resolveSelectKey('Enter', 0), { pick: 'seongsu' });
  assert.deepEqual(resolveSelectKey('Enter', 1), { pick: 'ds2' });
  assert.equal(resolveSelectKey('KeyA', 0), null);
  assert.equal(resolveSelectKey('Escape', 1), null);
});

test('(e) main.js: 시작 결정 → 선택 화면을 렌더러 · 월드 생성보다 먼저', () => {
  const main = read('../public/src/nowhere/main.js');
  const iEntry = main.indexOf('resolveEntry(params, window.__NW_DEFAULT_WORLD)');
  const iSelect = main.indexOf('await showWorldSelect()');
  const iRenderer = main.indexOf('new THREE.WebGLRenderer(');
  const iWorld = main.indexOf('await createWorld(');
  assert.ok(iEntry > 0 && iSelect > iEntry, '시작 결정 → 선택 화면 순서');
  assert.ok(iSelect < iRenderer && iSelect < iWorld, '선택 화면이 렌더러 · 월드보다 먼저');
  assert.doesNotMatch(main, /const rawVer/);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/nowhere-world-select.test.mjs`
Expected: FAIL — `world-select.js` 가 없다(`ERR_MODULE_NOT_FOUND`).

- [ ] **Step 3: `public/src/nowhere/world-select.js` 작성**

```js
// HAUS NOWHERE — 월드 선택 화면(일반 주소 / 첫 화면): 화면을 반씩 — 왼쪽 성수 2041 · 오른쪽 DS2 산악, 대표 렌더 한 장씩.
// 마우스 올림 · 포커스한 면이 60 % 로 넓어지고 밝아지며 배경이 천천히 확대(8 초에 1.0 → 1.06), 고르면 그 면이 화면 전체로 펼쳐진 뒤 로딩으로.
// WORLD_CARDS · resolveSelectKey 는 순수(테스트: tests/nowhere-world-select.test.mjs). DOM 은 showWorldSelect 를 부를 때만 만든다.
// 이 화면 동안에는 3D 월드(GLB · HDRI · layout)를 받지 않는다 — main.js 가 고른 뒤 렌더러 · 월드를 만든다. 스타일: nowhere.css .nw-select

export const SELECT_EXPAND_MS = 600;   // 고른 면이 화면 전체로 펼쳐지는 시간
export const SELECT_FADE_MS = 300;     // 펼쳐진 뒤 로딩 화면(같은 이미지)으로 겹쳐 넘어가는 시간
export const SELECT_BRAND = 'HAUS NOWHERE';
export const SELECT_CTA = '들어가기 →';

// image 는 페이지 기준 경로. nowhere.css 의 로더 배경(body[data-world-ver] .nw-loader)이 같은 파일을 '../../' 로 쓴다 — 바꾸면 둘을 함께(테스트 (c))
export const WORLD_CARDS = [
  {
    id: 'seongsu',
    kicker: 'SEONGSU · 2041',
    title: '성수 2041',
    desc: '벽돌 공장 골목 위로 유리 타워가 선 2041년의 뚝섬로',
    image: 'assets/nowhere/renders/hero-future.webp',
  },
  {
    id: 'ds2',
    kicker: 'CHIRAL HIGHLAND · DS2',
    title: 'DS2 산악 고원',
    desc: '이끼 덮인 빙하 계곡과 층리 암벽 사이의 산악 고원',
    image: 'assets/nowhere-ds2/renders/hero-valley.webp',
  },
];

/** ←/→ 포커스 이동(끝에서 멈춤), Enter 포커스된 면 고르기. 그 밖의 키는 null */
export function resolveSelectKey(key, index) {
  if (key === 'ArrowLeft') return { focus: Math.max(0, index - 1) };
  if (key === 'ArrowRight') return { focus: Math.min(WORLD_CARDS.length - 1, index + 1) };
  if (key === 'Enter') return { pick: WORLD_CARDS[index].id };
  return null;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/** 월드 선택 화면을 띄우고 고른 월드 id 를 돌려준다(첫 포커스는 왼쪽 성수). 고르면 body[data-world-ver] 를 먼저 바꿔 로딩 화면 배경을 맞춘다 */
export function showWorldSelect() {
  return new Promise((resolve) => {
    const reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const root = el('div', 'nw-select');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', '월드 선택');
    root.append(el('div', 'nw-select-brand', SELECT_BRAND));

    let focus = 0;
    let picked = false;
    const panes = WORLD_CARDS.map((card, i) => {
      const pane = el('button', 'nw-select-pane');
      pane.type = 'button';
      pane.dataset.world = card.id;
      const bg = el('span', 'nw-select-bg');
      bg.style.backgroundImage = `url("${card.image}")`;
      const text = el('span', 'nw-select-text');
      text.append(
        el('span', 'nw-select-kicker', card.kicker),
        el('span', 'nw-select-title', card.title),
        el('span', 'nw-select-desc', card.desc),
        el('span', 'nw-select-cta', SELECT_CTA),
      );
      pane.append(bg, el('span', 'nw-select-shade'), text);
      pane.addEventListener('mouseenter', () => setFocus(i));
      pane.addEventListener('focus', () => setFocus(i, false));
      pane.addEventListener('click', () => pick(i));
      root.append(pane);
      return pane;
    });

    // 포커스한 면(is-active)이 60 % 로 넓어지고 밝아진다 — 마우스 올림도 포커스로 옮겨 키보드와 같은 상태를 쓴다
    function setFocus(i, moveFocus = true) {
      if (picked) return;
      focus = i;
      panes.forEach((p, k) => p.classList.toggle('is-active', k === i));
      if (moveFocus && document.activeElement !== panes[i]) panes[i].focus({ preventScroll: true });
    }

    function onKey(e) {
      if (picked) return;
      const action = resolveSelectKey(e.key, focus);
      if (!action) return;
      e.preventDefault();   // Enter 가 포커스된 면 버튼의 click 으로 한 번 더 고르지 않게
      if (action.pick) {
        if (!e.repeat) pick(focus);
      } else {
        setFocus(action.focus);
      }
    }

    function pick(i) {
      if (picked) return;
      setFocus(i, false);
      picked = true;
      window.removeEventListener('keydown', onKey, true);
      const id = WORLD_CARDS[i].id;
      document.body.dataset.worldVer = id;   // 아래 로딩 화면 배경을 고른 월드 이미지로(nowhere.css body[data-world-ver] .nw-loader)
      panes[i].classList.add('is-chosen');
      root.classList.add('is-picked');        // 고른 면이 화면 전체로(flex-grow 전환 0.6 초)
      setTimeout(() => {
        root.classList.add('is-done');        // 같은 이미지의 로딩 화면으로 0.3 초 겹쳐 넘어간다
        setTimeout(() => root.remove(), SELECT_FADE_MS);
        resolve(id);
      }, reduceMotion ? 0 : SELECT_EXPAND_MS);
    }

    window.addEventListener('keydown', onKey, true);
    document.body.append(root);
    setFocus(0);   // 첫 포커스는 왼쪽(성수)
  });
}
```

- [ ] **Step 4: 로더 배경(CSS)** — `nowhere.css` 의 `.nw-loader { … }` 규칙과 바로 아래 `body[data-world-ver="ds2"] .nw-loader { … }` 규칙(현재 42–60행) 전체를 아래로 바꾼다

```css
.nw-loader {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 40px 48px;
  /* 월드가 정해지기 전(일반 주소 / — 월드 선택 화면 아래)은 무늬 없는 어두운 배경 */
  background: #05080d;
  transition: opacity 0.65s ease, visibility 0.65s ease;
}

/* 고른 월드(body[data-world-ver])의 선택 화면 이미지를 어둡게 덮어 그대로 이어 간다 — world-select.js WORLD_CARDS 와 같은 파일 */
body[data-world-ver="seongsu"] .nw-loader {
  background:
    linear-gradient(180deg, rgba(9, 14, 24, 0.35) 0%, rgba(9, 14, 24, 0.88) 100%),
    url('../../assets/nowhere/renders/hero-future.webp') center / cover no-repeat;
}

body[data-world-ver="ds2"] .nw-loader {
  background:
    linear-gradient(180deg, rgba(9, 14, 24, 0.35) 0%, rgba(9, 14, 24, 0.88) 100%),
    url('../../assets/nowhere-ds2/renders/hero-valley.webp') center / cover no-repeat;
}
```

- [ ] **Step 5: 선택 화면 스타일** — `nowhere.css` 의 `.nw-loader-fill { … }` 규칙 다음, `/* ── 상단 HUD 바 ── */` 앞에

```css
/* ── 월드 선택 화면(world-select.js): 일반 주소(/) 첫 화면 — 왼쪽 성수 2041 · 오른쪽 DS2 산악, 로더(60) 위 ── */
.nw-select {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: flex;
  background: #05080d;
  transition: opacity 0.3s ease;
}
.nw-select.is-done {
  opacity: 0;
  pointer-events: none;
}
.nw-select-brand {
  position: absolute;
  top: 22px;
  left: 50%;
  z-index: 2;
  transform: translateX(-50%);
  font-family: var(--nw-font-mono);
  font-size: 12px;
  letter-spacing: 0.32em;
  color: var(--nw-text);
  text-shadow: 0 1px 10px rgba(0, 0, 0, 0.6);
  pointer-events: none;
  transition: opacity 0.3s ease;
}
.nw-select.is-picked .nw-select-brand {
  opacity: 0;
}
.nw-select-pane {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  appearance: none;
  margin: 0;
  padding: 0;
  border: 0;
  background: #05080d;
  color: var(--nw-text);
  font-family: var(--nw-font-sans);
  text-align: left;
  cursor: pointer;
  outline: none;
  -webkit-tap-highlight-color: transparent;
  transition: flex-grow 0.6s ease;
}
.nw-select-pane + .nw-select-pane {
  border-left: 1px solid rgba(127, 150, 196, 0.25);
}
.nw-select-pane.is-active {
  flex-grow: 1.5;   /* 60 : 40 */
}
.nw-select-bg {
  position: absolute;
  inset: 0;
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
  filter: brightness(0.5) saturate(0.85);
  transform: scale(1);
  transition: transform 0.6s ease, filter 0.6s ease;
}
.nw-select-pane.is-active .nw-select-bg {
  filter: none;
  transform: scale(1.06);
  transition: transform 8s linear, filter 0.6s ease;   /* 8 초에 1.0 → 1.06 */
}
.nw-select-shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(5, 8, 13, 0) 40%, rgba(5, 8, 13, 0.85) 100%);
}
.nw-select-text {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 36px 40px;
}
.nw-select-kicker,
.nw-select-title,
.nw-select-desc,
.nw-select-cta {
  display: block;
}
.nw-select-kicker {
  font-family: var(--nw-font-mono);
  font-size: 11px;
  letter-spacing: 0.14em;
  color: var(--nw-accent);
}
.nw-select-title {
  font-size: clamp(26px, 3.4vw, 44px);
  font-weight: 500;
  letter-spacing: -0.01em;
}
.nw-select-desc {
  font-size: 14px;
  line-height: 1.5;
  color: var(--nw-text-dim);
  word-break: keep-all;
}
.nw-select-cta {
  margin-top: 10px;
  font-size: 13px;
  letter-spacing: 0.04em;
  color: var(--nw-text-dim);
  transition: color 0.3s ease;
}
.nw-select-pane.is-active .nw-select-cta {
  color: var(--nw-accent);
}
/* 고르면 고른 면이 화면 전체로(0.6 초) */
.nw-select.is-picked .nw-select-pane {
  flex-grow: 0;
}
.nw-select.is-picked .nw-select-pane.is-chosen {
  flex-grow: 1;
}
/* 세로 화면(가로 < 세로, 폭 ≤ 720 px)은 위 · 아래로 */
@media (max-width: 720px) and (orientation: portrait) {
  .nw-select {
    flex-direction: column;
  }
  .nw-select-pane + .nw-select-pane {
    border-left: 0;
    border-top: 1px solid rgba(127, 150, 196, 0.25);
  }
  .nw-select-text {
    padding: 0 20px 22px;
  }
  .nw-select-brand {
    top: 14px;
  }
}
/* 움직임 줄이기: 넓어짐 · 확대 없이 밝기만 */
@media (prefers-reduced-motion: reduce) {
  .nw-select-pane,
  .nw-select-bg,
  .nw-select-pane.is-active .nw-select-bg {
    transition: filter 0.3s ease;
  }
  .nw-select-pane.is-active {
    flex-grow: 1;
  }
  .nw-select-pane.is-active .nw-select-bg {
    transform: none;
  }
}
```

- [ ] **Step 6: `main.js` — import** — `import { planWalkPath } from './walk-path.js';` 줄 아래에

```js
import { resolveEntry } from './entry.js';
import { showWorldSelect } from './world-select.js';
```

- [ ] **Step 7: `main.js` — 렌더러 전에 시작 결정 · 선택 화면** — 아래 네 줄(80f67da 기준 28–31행 — 앞 단계 import 로 줄 번호가 밀려 있으니 내용으로 찾는다)을

```js
  const params = new URLSearchParams(window.location.search);
  const rawVer = params.get('ver') || window.__NW_DEFAULT_WORLD || 'seongsu';
  const worldVer = rawVer === 'ds2' ? 'ds2' : 'seongsu';
  document.body.dataset.worldVer = worldVer;
```

  다음으로 바꾼다(그 아래 tier · quality · 라벨 · 렌더러 · 월드 생성은 그대로)

```js
  const params = new URLSearchParams(window.location.search);
  // 시작 결정: 일반 주소(/)는 월드 선택 화면부터 — 고르기 전에는 렌더러 · 월드를 만들지 않는다(이미지 두 장만 받음)
  const entry = resolveEntry(params, window.__NW_DEFAULT_WORLD);
  const worldVer = entry.select ? await showWorldSelect() : entry.world;
  document.body.dataset.worldVer = worldVer;
```

- [ ] **Step 8: `main.js` — 인트로 조건을 시작 결정으로** — 아래 블록(80f67da 기준 362–364행)을

```js
  if (!params.get('noIntro') && !params.get('cam') && !params.get('weather') && !params.get('time')) {
    startScenario('intro');
  }
```

  다음으로 바꾼다(Task 5 에서 시작 흐름으로 다시 바뀐다)

```js
  // 인트로: 바로가기 링크(cam · weather · time) · noIntro=1 이 아니면(resolveEntry)
  if (entry.intro) {
    startScenario('intro');
  }
```

- [ ] **Step 9: README** — `README.md` 80행의 `웹은 로딩 화면 배경(\`hero-street\`)만 직접 씁니다.` 를 `웹은 월드 선택 화면 · 로딩 화면 배경(\`hero-future\`, DS2 는 \`nowhere-ds2/renders/hero-valley\`)만 직접 씁니다.` 로 바꾼다(그 줄의 나머지 문장은 그대로).

- [ ] **Step 10: 통과 확인**

Run: `node --check public/src/nowhere/world-select.js && node --check public/src/nowhere/main.js && node --test tests/nowhere-world-select.test.mjs tests/nowhere-entry.test.mjs`
Expected: 문법 오류 없음, PASS (world-select 5개, entry 6개)

- [ ] **Step 11: 전체 테스트**

Run: `npm test`
Expected: 모든 테스트 PASS (실패 0)

- [ ] **Step 12: 브라우저 연기 시험(playwriter)** — playwriter MCP 만 쓴다(Playwright MCP 금지, 실패하면 보고하고 다른 도구로 넘어가지 않는다). 서버 :4173 이 없으면(`lsof -i :4173`) `npm start` 를 백그라운드로 띄운다. `state.page = await context.newPage()` 로 잡고, 페이지를 열 때마다 곧바로 대화상자 함수를 바꾼다:
  `await state.page.evaluate(() => { window.__dialogs = []; window.confirm = (m) => (window.__dialogs.push(m), true); window.alert = (m) => { window.__dialogs.push(m); }; window.prompt = (m) => (window.__dialogs.push(m), null); })`
  기다림은 짧은 호출 여러 번으로 나누고, 각 호출 시작에 `await Promise.race([state.page.evaluate(() => 1), new Promise((r) => setTimeout(() => r('blocked'), 3000))])` 로 3 s 안에 돌아오는지 확인한다(첫 로드는 10–40 s 막힐 수 있다).
  1. 뷰포트 1600 × 900(`state.page.setViewportSize({ width: 1600, height: 900 })`) · `http://localhost:4173/` 열기 → `.nw-select` 가 보이고, `document.activeElement.dataset.world === 'seongsu'`, 0.7 s 뒤 `[...document.querySelectorAll('.nw-select-pane')].map((p) => Math.round(p.getBoundingClientRect().width))` 가 약 `[960, 640]`.
  2. `performance.getEntriesByType('resource').map((e) => e.name.replace(location.origin, '')).filter((n) => /\.(glb|hdr|webp|json|ktx2)(\?|$)/.test(n))` → 선택 화면 이미지 두 장(`/assets/nowhere/renders/hero-future.webp`, `/assets/nowhere-ds2/renders/hero-valley.webp`)만 있고 `.glb` · `.hdr` · `layout.json` 이 없다. `window.__NW_APP` 은 아직 없다.
  3. `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))` → 0.7 s 뒤 폭이 약 `[640, 960]` · DS2 면이 `is-active`. 이어 `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))` → `document.body.dataset.worldVer === 'ds2'`, 0.6 s 뒤 `.nw-select.is-done`, 1 s 뒤 `.nw-select` 가 DOM 에 없음, `#nw-loader` 배경이 `hero-valley` (`getComputedStyle(document.getElementById('nw-loader')).backgroundImage` 에 `hero-valley`).
  4. 로드가 끝나면(`window.__NW_APP` 생김) `__NW_APP.getStats().worldVer === 'ds2'`, 지금 흐름대로 인트로가 돈다(`introActive === true`).
  5. `http://localhost:4173/nowhere` · `http://localhost:4173/?cam=future` 는 `.nw-select` 없이 바로 로딩(각각 성수 · 인트로 / 성수 · 인트로 없음).
  값 · 결과를 보고서에 적는다.

- [ ] **Step 13: 스테이징(커밋하지 않음) — 리뷰 통과 뒤 컨트롤러가 실행**

```bash
git add public/src/nowhere/world-select.js public/src/nowhere/nowhere.css public/src/nowhere/main.js README.md tests/nowhere-world-select.test.mjs
```

커밋 메시지 안: `feat(nowhere): 월드 선택 화면 — 렌더러 전에 성수 2041 · DS2 산악 고르기, 로딩 배경을 고른 월드 이미지로`

---

### Task 3: 인트로 영화식 연출 · 건너뛰기 API · Esc

**Files:**
- Create: `public/src/nowhere/cinema.js`
- Modify: `public/src/nowhere/camera.js:130-140` (인트로 끼어들기 → `skipIntro` · `getIntroProgress`), 반환 객체
- Modify: `public/src/nowhere/main.js` (import, 연출 생성, 시나리오 `intro` 어댑터, `playIntro`, Esc 처리, 렌더 루프 진행 선, `app`)
- Modify: `public/src/nowhere/nowhere.css` (파일 끝에 연출 · HUD 숨김)
- Test: `tests/nowhere-cinema.test.mjs` (새)

**Interfaces:**
- Consumes: `camCtrl.startIntro(onEnd(reason: 'complete'|'skipped'|'cancelled'))`, `camCtrl.isIntroActive()`, `camCtrl.isFlying()`, `scenario.isRunning()` · `cancel()`
- Produces (Task 5 가 쓴다):
  - camera.js 반환 객체에 `skipIntro() → boolean`(인트로 중이면 거리 시점으로 내려오고 `onEnd('skipped')`, 아니면 false), `getIntroProgress() → number`(0–1, 경과 / 12 s, 인트로 중이 아니면 0)
  - cinema.js: `INTRO_TITLES = { seongsu: { kicker, title }, ds2: { kicker, title } }`, `CINEMA_TITLE_IN_MS = 1000`, `CINEMA_TITLE_OUT_MS = 5000`, `CINEMA_OUT_MS = 500`, `SKIP_LABEL = '건너뛰기 ›'`
  - `createCinema() → { start({ kicker, title, onSkip }), progress(u), end() → Promise<void>, isActive() → boolean, element }` — `start` 는 `body.is-cinema` 를 붙이고 `end` 는 띠가 빠지기 시작할 때 뗀다
  - main.js: `playIntro() → Promise<'complete'|'skipped'|'cancelled'>`(Task 5 에서 `{ holdHud }` 를 받게 바뀐다), `app.cinema`

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/nowhere-cinema.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createCinema, INTRO_TITLES, SKIP_LABEL, CINEMA_TITLE_IN_MS, CINEMA_TITLE_OUT_MS, CINEMA_OUT_MS,
} from '../public/src/nowhere/cinema.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

// 아주 작은 가짜 DOM: className · classList · style · append · 이벤트
function fakeDom() {
  const make = (tag) => {
    const cls = new Set();
    const listeners = {};
    const node = {
      tagName: tag.toUpperCase(),
      hidden: false,
      textContent: '',
      type: '',
      style: {},
      children: [],
      attrs: {},
      offsetWidth: 0,
      set className(v) {
        cls.clear();
        String(v).split(/\s+/).filter(Boolean).forEach((c) => cls.add(c));
      },
      get className() {
        return [...cls].join(' ');
      },
      append(...c) {
        node.children.push(...c);
      },
      setAttribute(k, v) {
        node.attrs[k] = String(v);
      },
      addEventListener(type, fn) {
        (listeners[type] ||= []).push(fn);
      },
      dispatch(type) {
        (listeners[type] || []).forEach((fn) => fn({ type }));
      },
      classList: {
        add: (...c) => c.forEach((x) => cls.add(x)),
        remove: (...c) => c.forEach((x) => cls.delete(x)),
        toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)),
        contains: (c) => cls.has(c),
      },
    };
    return node;
  };
  return { createElement: make, body: make('body') };
}
const find = (node, cls) => {
  if (node.classList?.contains(cls)) return node;
  for (const c of node.children || []) {
    const f = find(c, cls);
    if (f) return f;
  }
  return null;
};

test('(a) 문구 · 시간: 성수 좌표 · 산악 브랜드 문구, 제목 1.0 s → 5.0 s, 띠 빠짐 0.5 s', () => {
  assert.deepEqual(INTRO_TITLES.seongsu, { kicker: '37.544°N 127.056°E', title: 'HAUS NOWHERE — 성수 2041' });
  assert.deepEqual(INTRO_TITLES.ds2, { kicker: 'HIGHLAND BASIN · DS2 MOUNTAIN WORLD', title: 'HAUS NOWHERE — DS2 산악 고원' });
  assert.equal(SKIP_LABEL, '건너뛰기 ›');
  assert.equal(CINEMA_TITLE_IN_MS, 1000);
  assert.equal(CINEMA_TITLE_OUT_MS, 5000);
  assert.equal(CINEMA_OUT_MS, 500);
});

test('(b) start → 자막 시각 → 진행 선 → 건너뛰기 → end(띠가 빠진 뒤 숨김)', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const dom = fakeDom();
  globalThis.document = dom;
  try {
    const c = createCinema();
    const root = c.element;
    assert.equal(dom.body.children.length, 1);
    assert.equal(dom.body.children[0], root);
    assert.equal(root.className, 'nw-cinema');
    assert.equal(root.hidden, true);
    const skip = find(root, 'nw-cinema-skip');
    assert.equal(skip.textContent, '건너뛰기 ›');
    assert.equal(skip.type, 'button');
    assert.ok(find(find(root, 'nw-cinema-bar-bottom'), 'nw-cinema-progress'), '진행 선은 아래 띠 안');

    let skipped = 0;
    c.start({ ...INTRO_TITLES.seongsu, onSkip: () => skipped++ });
    assert.equal(c.isActive(), true);
    assert.equal(root.hidden, false);
    assert.ok(root.classList.contains('is-on'));
    assert.ok(dom.body.classList.contains('is-cinema'));
    assert.equal(find(root, 'nw-cinema-kicker').textContent, '37.544°N 127.056°E');
    assert.equal(find(root, 'nw-cinema-heading').textContent, 'HAUS NOWHERE — 성수 2041');

    const title = () => root.classList.contains('is-title');
    t.mock.timers.tick(999);
    assert.equal(title(), false);
    t.mock.timers.tick(1);
    assert.equal(title(), true, '1.0 s 에 나타남');
    t.mock.timers.tick(3999);
    assert.equal(title(), true);
    t.mock.timers.tick(1);
    assert.equal(title(), false, '5.0 s 에 사라짐');

    const fill = find(root, 'nw-cinema-progress-fill');
    assert.equal(fill.style.transform, 'scaleX(0.000)');
    c.progress(0.5);
    assert.equal(fill.style.transform, 'scaleX(0.500)');
    c.progress(1.7);
    assert.equal(fill.style.transform, 'scaleX(1.000)', '1 을 넘지 않는다');

    skip.dispatch('click');
    assert.equal(skipped, 1);

    let done = false;
    const p = c.end().then(() => {
      done = true;
    });
    assert.equal(c.isActive(), false);
    assert.equal(root.classList.contains('is-on'), false);
    assert.ok(root.classList.contains('is-out'));
    assert.equal(dom.body.classList.contains('is-cinema'), false, 'HUD 는 띠가 빠지기 시작할 때 돌아온다');
    skip.dispatch('click');
    assert.equal(skipped, 1, '끝난 뒤 건너뛰기는 무시');
    t.mock.timers.tick(CINEMA_OUT_MS - 1);
    await Promise.resolve();
    assert.equal(done, false);
    t.mock.timers.tick(1);
    await p;
    assert.equal(done, true);
    assert.equal(root.hidden, true);
    assert.equal(root.classList.contains('is-out'), false);
  } finally {
    delete globalThis.document;
  }
});

test('(c) end 를 기다리는 중 다시 start 하면 앞선 end 는 바로 끝나고 새 연출은 숨기지 않는다 · 시작 전 end 는 바로 끝', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const dom = fakeDom();
  globalThis.document = dom;
  try {
    const c = createCinema();
    await c.end();
    c.start({ kicker: 'a', title: 'b' });
    let ended = false;
    c.end().then(() => {
      ended = true;
    });
    c.start({ ...INTRO_TITLES.ds2 });
    await Promise.resolve();
    assert.equal(ended, true);
    t.mock.timers.tick(CINEMA_OUT_MS);
    assert.equal(c.element.hidden, false);
    assert.equal(c.isActive(), true);
    assert.ok(dom.body.classList.contains('is-cinema'));
    assert.equal(find(c.element, 'nw-cinema-heading').textContent, 'HAUS NOWHERE — DS2 산악 고원');
  } finally {
    delete globalThis.document;
  }
});

test('(d) camera.js 는 skipIntro · getIntroProgress 를 내보내고, main.js 는 연출 · 건너뛰기 · 진행 선 · Esc 를 잇는다', () => {
  const cam = read('../public/src/nowhere/camera.js');
  assert.match(cam, /function skipIntro\(\)/);
  assert.match(cam, /function getIntroProgress\(\)/);
  const ret = cam.slice(cam.lastIndexOf('return {'));
  assert.match(ret, /\bskipIntro,/);
  assert.match(ret, /\bgetIntroProgress,/);
  const main = read('../public/src/nowhere/main.js');
  assert.match(main, /createCinema\(\)/);
  assert.match(main, /onSkip: \(\) => camCtrl\.skipIntro\(\)/);
  assert.match(main, /cinema\.progress\(camCtrl\.getIntroProgress\(\)\)/);
  assert.match(main, /if \(camCtrl\.isIntroActive\(\)\) \{[\s\S]{0,200}camCtrl\.skipIntro\(\);/, 'Esc 는 인트로를 건너뛴다');
});

test('(e) CSS: 띠 높이 max(48px, 11vh) · 연출 중 HUD(상단 바 · 하단 독 · 보행 안내 · 스팟 · 성능 표시) 숨김', () => {
  const css = read('../public/src/nowhere/nowhere.css');
  assert.match(css, /\.nw-cinema \{[^}]*--nw-cine-bar: max\(48px, 11vh\)/);
  for (const sel of ['.nw-topbar', '.nw-dock', '.nw-walk-hud', '.nw-spots', '.nw-perf']) {
    assert.ok(css.includes(`body.is-cinema ${sel}`), `연출 중 ${sel} 를 숨기지 않음`);
  }
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/nowhere-cinema.test.mjs`
Expected: FAIL — `cinema.js` 가 없다(`ERR_MODULE_NOT_FOUND`).

- [ ] **Step 3: `public/src/nowhere/cinema.js` 작성**

```js
// HAUS NOWHERE — 인트로 영화식 연출(DOM 오버레이 — 그리기 0): 위아래 검은 띠 · 제목 자막 · 건너뛰기 › · 진행 선.
// 인트로 비행(camera.js startIntro)과 함께 start, 매 프레임 progress(경과 / 12 초), 끝나거나 건너뛰면 end(띠가 0.5 초에 빠짐).
// body.is-cinema 동안 HUD(상단 바 · 하단 독 · 보행 안내 · 이동 스팟 · 성능 표시)를 숨긴다(nowhere.css).
// INTRO_TITLES · 시간 상수는 순수 데이터. DOM 은 createCinema 를 부를 때만 만든다(테스트: tests/nowhere-cinema.test.mjs).

export const CINEMA_TITLE_IN_MS = 1000;    // 제목 자막이 나타나는 때(인트로 시작 기준)
export const CINEMA_TITLE_OUT_MS = 5000;   // 제목 자막이 사라지는 때
export const CINEMA_OUT_MS = 500;          // 끝나거나 건너뛸 때 띠가 빠지는 시간
export const SKIP_LABEL = '건너뛰기 ›';

// 작은 글씨 = 좌표(성수) · 기존 브랜드 문구(산악), 큰 글씨 = 월드 제목
export const INTRO_TITLES = {
  seongsu: { kicker: '37.544°N 127.056°E', title: 'HAUS NOWHERE — 성수 2041' },
  ds2: { kicker: 'HIGHLAND BASIN · DS2 MOUNTAIN WORLD', title: 'HAUS NOWHERE — DS2 산악 고원' },
};

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

export function createCinema() {
  const root = el('div', 'nw-cinema');
  root.hidden = true;
  const top = el('div', 'nw-cinema-bar nw-cinema-bar-top');
  const bottom = el('div', 'nw-cinema-bar nw-cinema-bar-bottom');
  const line = el('div', 'nw-cinema-progress');   // 아래 띠 위 가장자리의 얇은 진행 선
  const fill = el('div', 'nw-cinema-progress-fill');
  line.append(fill);
  const skip = el('button', 'nw-cinema-skip', SKIP_LABEL);
  skip.type = 'button';
  bottom.append(line, skip);
  const card = el('div', 'nw-cinema-title');
  const kickerEl = el('div', 'nw-cinema-kicker');
  const headingEl = el('div', 'nw-cinema-heading');
  card.append(kickerEl, headingEl);
  root.append(top, card, bottom);
  document.body.append(root);

  let active = false;
  let onSkip = null;
  let timers = [];
  let ending = null;   // end() 가 기다리는 resolve — 그사이 start 가 다시 불리면 바로 끝낸다
  let lastU = -1;

  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  function clearTimers() {
    timers.forEach((id) => clearTimeout(id));
    timers = [];
  }
  function settleEnding() {
    if (!ending) return;
    const done = ending;
    ending = null;
    done();
  }

  skip.addEventListener('click', () => {
    if (active && typeof onSkip === 'function') onSkip();
  });

  /** 진행 선(0–1). 같은 값이면 쓰지 않는다 */
  function progress(u) {
    const v = Math.min(1, Math.max(0, Number(u) || 0));
    if (Math.abs(v - lastU) < 0.001) return;
    lastU = v;
    fill.style.transform = `scaleX(${v.toFixed(3)})`;
  }

  function start({ kicker = '', title = '', onSkip: cb = null } = {}) {
    clearTimers();
    settleEnding();
    active = true;
    onSkip = cb;
    kickerEl.textContent = kicker;
    headingEl.textContent = title;
    lastU = -1;
    progress(0);
    root.classList.remove('is-on', 'is-out', 'is-title');
    root.hidden = false;
    void root.offsetWidth;   // display:none 에서 바로 is-on 을 붙이면 띠가 들어오는 전환(0.6 초)이 생략된다
    root.classList.add('is-on');
    document.body.classList.add('is-cinema');
    later(() => root.classList.add('is-title'), CINEMA_TITLE_IN_MS);
    later(() => root.classList.remove('is-title'), CINEMA_TITLE_OUT_MS);
  }

  /** 띠를 빼고(0.5 초) 숨긴다. HUD 는 빠지기 시작할 때 돌아온다 */
  function end() {
    if (!active) return Promise.resolve();
    active = false;
    onSkip = null;
    clearTimers();
    root.classList.remove('is-on', 'is-title');
    root.classList.add('is-out');
    document.body.classList.remove('is-cinema');
    return new Promise((resolve) => {
      ending = resolve;
      later(() => {
        root.hidden = true;
        root.classList.remove('is-out');
        settleEnding();
      }, CINEMA_OUT_MS);
    });
  }

  return { start, progress, end, isActive: () => active, element: root };
}
```

- [ ] **Step 4: `camera.js` — `skipIntro` · `getIntroProgress`** — 아래 블록(현재 130–140행)을

```js
  // 아무 입력(마우스/터치/휠/키보드)으로 인트로 즉시 건너뛰기
  // 콜백은 거리 시점 배치가 끝난 뒤 부른다('complete' 와 같은 순서) — 콜백이 곧바로 flyTo 를 불러도 setPreset 이 끊지 않게.
  const onUserInterrupt = () => {
    if (!introActive) return;
    const cb = introOnEnd;
    introOnEnd = null;            // setPreset 안의 cancelIntro 가 'cancelled' 로 부르지 않게 미리 떼어 둔다
    setPreset('street', true);    // cancelIntro() → introActive false · controls 복구
    if (typeof cb === 'function') cb('skipped');
  };
  canvas.addEventListener('pointerdown', onUserInterrupt, { passive: true });
  canvas.addEventListener('wheel', onUserInterrupt, { passive: true });
```

  다음으로 바꾼다(keydown 처리기의 `onUserInterrupt();` 호출은 그대로 둔다)

```js
  /**
   * 인트로 건너뛰기: 거리 시점으로 바로 내려오고 onEnd('skipped'). 인트로 중이 아니면 false.
   * 화면 클릭 · 휠 · 아무 키(아래)와 영화 연출의 '건너뛰기 ›' · Esc(main.js)가 같이 쓴다.
   * 콜백은 거리 시점 배치가 끝난 뒤 부른다('complete' 와 같은 순서) — 콜백이 곧바로 flyTo 를 불러도 setPreset 이 끊지 않게.
   */
  function skipIntro() {
    if (!introActive) return false;
    const cb = introOnEnd;
    introOnEnd = null;            // setPreset 안의 cancelIntro 가 'cancelled' 로 부르지 않게 미리 떼어 둔다
    setPreset('street', true);    // cancelIntro() → introActive false · controls 복구
    if (typeof cb === 'function') cb('skipped');
    return true;
  }

  /** 인트로 경과 비율(0–1 = 경과 / INTRO_DURATION) — 영화 연출 진행 선. 인트로 중이 아니면 0 */
  function getIntroProgress() {
    return introActive ? Math.min(1, introElapsed / INTRO_DURATION) : 0;
  }

  // 아무 입력(마우스/터치/휠/키보드)으로 인트로 즉시 건너뛰기
  const onUserInterrupt = () => {
    skipIntro();
  };
  canvas.addEventListener('pointerdown', onUserInterrupt, { passive: true });
  canvas.addEventListener('wheel', onUserInterrupt, { passive: true });
```

  반환 객체의 `cancelIntro,` 다음 줄에 두 줄을 더한다

```js
    skipIntro,
    getIntroProgress,
```

- [ ] **Step 5: 연출 스타일** — `nowhere.css` 파일 끝에

```css

/* ── 인트로 영화식 연출(cinema.js): 위아래 검은 띠 · 제목 자막 · 건너뛰기 › · 진행 선 — DOM 만(그리기 0) ── */
.nw-cinema {
  --nw-cine-bar: max(48px, 11vh);
  position: fixed;
  inset: 0;
  z-index: 30;
  pointer-events: none;   /* 띠 · 자막 위 클릭 · 휠은 캔버스로 — 화면 클릭 · 휠로 건너뛰기(camera.js) */
}
.nw-cinema[hidden] {
  display: none;
}
.nw-cinema-bar {
  position: absolute;
  left: 0;
  right: 0;
  height: var(--nw-cine-bar);
  background: #000;
  transition: transform 0.6s cubic-bezier(0.2, 0.7, 0.2, 1);   /* 0.6 초에 들어온다 */
}
.nw-cinema-bar-top {
  top: 0;
  transform: translateY(-100%);
}
.nw-cinema-bar-bottom {
  bottom: 0;
  transform: translateY(100%);
}
.nw-cinema.is-on .nw-cinema-bar {
  transform: none;
}
.nw-cinema.is-out .nw-cinema-bar {
  transition-duration: 0.5s;   /* 끝나거나 건너뛰면 0.5 초에 빠진다 */
}
.nw-cinema-progress {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 2px;
  background: rgba(127, 150, 196, 0.18);
}
.nw-cinema-progress-fill {
  height: 100%;
  background: var(--nw-accent);
  transform: scaleX(0);
  transform-origin: left center;
}
.nw-cinema-skip {
  position: absolute;
  right: 22px;
  top: 50%;
  transform: translateY(-50%);
  min-height: 44px;
  padding: 0 14px;
  appearance: none;
  border: 0;
  background: none;
  font-family: var(--nw-font-mono);
  font-size: 12px;
  letter-spacing: 0.12em;
  color: var(--nw-text-dim);
  cursor: pointer;
  pointer-events: auto;
}
.nw-cinema-skip:hover,
.nw-cinema-skip:focus-visible {
  color: var(--nw-text);
  outline: none;
}
.nw-cinema-title {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(var(--nw-cine-bar) + 28px);
  padding: 0 24px;
  text-align: center;
  opacity: 0;
  transition: opacity 0.8s ease;
  text-shadow: 0 1px 12px rgba(0, 0, 0, 0.55);
}
.nw-cinema.is-title .nw-cinema-title {
  opacity: 1;
}
.nw-cinema.is-out .nw-cinema-title {
  transition-duration: 0.5s;
}
.nw-cinema-kicker {
  font-family: var(--nw-font-mono);
  font-size: 11px;
  letter-spacing: 0.18em;
  color: var(--nw-accent);
}
.nw-cinema-heading {
  margin-top: 8px;
  font-size: clamp(20px, 3.2vw, 34px);
  font-weight: 300;
  letter-spacing: 0.02em;
  color: var(--nw-text);
  word-break: keep-all;
}
@media (max-width: 720px) {
  .nw-cinema-skip {
    right: 8px;
  }
  .nw-cinema-title {
    padding: 0 16px;
  }
}

/* ── 인트로 연출 동안 HUD 숨김(body.is-cinema) ── */
.nw-topbar,
.nw-dock {
  transition: opacity 0.4s ease, visibility 0.4s ease;
}
body.is-cinema .nw-topbar,
body.is-cinema .nw-dock,
body.is-cinema .nw-walk-hud,
body.is-cinema .nw-spots,
body.is-cinema .nw-perf {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}
```

- [ ] **Step 6: `main.js` — import · 연출 생성** — Task 2 의 `import { showWorldSelect } from './world-select.js';` 줄 아래에

```js
import { createCinema, INTRO_TITLES } from './cinema.js';
```

  `  const fade = createFade();` 줄 아래에

```js

  // 인트로 영화식 연출(위아래 띠 · 제목 자막 · 건너뛰기 › · 진행 선) — DOM 만
  const cinema = createCinema();
```

- [ ] **Step 7: `main.js` — 시나리오 인트로 어댑터가 연출과 함께 돌게** — `createScenarioRunner({ adapters: { … } })` 안의 아래 두 줄을

```js
      // 끝까지 재생 · 사용자 입력으로 건너뜀 → 건물 선택으로, 다른 동작이 끊음 → 투어 종료
      intro: () => new Promise((resolve) => camCtrl.startIntro((reason) => resolve(reason === 'cancelled' ? CANCEL : reason))),
```

  다음으로 바꾼다(Task 5 에서 인트로가 시나리오 밖으로 나가며 지워진다)

```js
      // 인트로(+ 영화 연출): 끝까지 재생 · 건너뜀 → 건물 선택으로, 다른 동작이 끊음 → 투어 종료
      intro: async () => {
        const reason = await playIntro();
        return reason === 'cancelled' ? CANCEL : reason;
      },
```

  그리고 `  function startScenario(stepId) {` 줄 바로 위에

```js
  // ── 인트로: 12 초 비행(camCtrl.startIntro) + 영화식 연출(위아래 띠 · 제목 자막 · 건너뛰기 · 진행 선).
  // 끝나거나 건너뛰면 띠가 빠진 뒤(0.5 초) 이유('complete' | 'skipped' | 'cancelled')를 돌려준다 ──
  async function playIntro() {
    const t = INTRO_TITLES[worldVer];
    const reason = await new Promise((resolve) => {
      cinema.start({ kicker: t.kicker, title: t.title, onSkip: () => camCtrl.skipIntro() });
      camCtrl.startIntro((r) => resolve(r));
    });
    await cinema.end();
    return reason;
  }

```

- [ ] **Step 8: `main.js` — Esc: 인트로 중이면 건너뛰기** — `// Esc: 모달 · 조작 안내가 먼저 받고(캡처 단계), …` 주석부터 그 `window.addEventListener('keydown', …, true);` 끝까지(80f67da 기준 338–356행)를 아래로 바꾼다

```js
  // Esc: 모달 · 조작 안내 · 방식 고르기가 먼저 받고(캡처 단계), 남은 Esc 는 인트로를 건너뛰거나 비행 중인 투어를 끝낸다
  window.addEventListener(
    'keydown',
    (e) => {
      // 조작 안내가 이미 받은 Esc(같은 창 캡처 단계라 stopPropagation 으로는 안 막힘)는 건너뛰지 않는다
      if (e.defaultPrevented || help.isOpen()) return;
      if (e.key !== 'Escape' || interior.isActive()) return;
      if (camCtrl.isIntroActive()) {
        // 인트로 중 Esc = 건너뛰기(거리 시점으로 바로 내려오고 인트로 뒤 흐름을 이어 간다)
        e.preventDefault();
        e.stopPropagation();
        camCtrl.skipIntro();
        return;
      }
      if (!scenario.isRunning() || !camCtrl.isFlying()) return;
      // 건물 비행 중 Esc = 투어 끝내기(비행은 그 자리에서 멈춤)
      e.preventDefault();
      e.stopPropagation();
      scenario.cancel();
      camCtrl.stopFlight();
    },
    true,
  );
```

- [ ] **Step 9: `main.js` — 렌더 루프 진행 선 · app** — `animate()` 의 `    camCtrl.update(dt);` 다음 줄에

```js
    if (cinema.isActive()) cinema.progress(camCtrl.getIntroProgress());   // 인트로 진행 선(경과 / 12 초)
```

  `app` 객체의 `    markers,` 다음 줄에 `    cinema,` 를 더한다.

- [ ] **Step 10: 통과 확인**

Run: `node --check public/src/nowhere/camera.js && node --check public/src/nowhere/cinema.js && node --check public/src/nowhere/main.js && node --test tests/nowhere-cinema.test.mjs`
Expected: 문법 오류 없음, PASS (5개)

- [ ] **Step 11: 전체 테스트**

Run: `npm test`
Expected: 모든 테스트 PASS (실패 0 — `nowhere-help` (c) 의 `startScenario('intro')` 는 아직 있다)

- [ ] **Step 12: 브라우저 연기 시험(playwriter)** — playwriter MCP 만 쓴다(Playwright MCP 금지 — playwriter 가 실패하면 보고하고 다른 도구로 넘어가지 않는다). `state.page` 로 잡고, 페이지를 열 때마다 곧바로 `await state.page.evaluate(() => { window.__dialogs = []; window.confirm = (m) => (window.__dialogs.push(m), true); window.alert = (m) => { window.__dialogs.push(m); }; window.prompt = (m) => (window.__dialogs.push(m), null); })` 로 대화상자 함수를 바꾼다(`page.on('dialog')` 에 기대지 않는다). 기다림은 짧은 호출 여러 번으로 나누고, 각 호출 시작에 `await Promise.race([state.page.evaluate(() => 1), new Promise((r) => setTimeout(() => r('blocked'), 3000))])` 로 3 s 안에 돌아오는지 확인한다(첫 로드는 10–40 s 막힐 수 있다). 1600 × 900 에서 `http://localhost:4173/nowhere`:
  1. `window.__NW_APP` 이 생기면 곧바로 `(() => { const c = document.querySelector('.nw-cinema'); return { on: !c.hidden && c.classList.contains('is-on'), barH: Math.round(c.querySelector('.nw-cinema-bar-bottom').getBoundingClientRect().height), hud: getComputedStyle(document.querySelector('.nw-topbar')).visibility, intro: __NW_APP.getStats().introActive }; })()` → `on: true`, `barH: 99`(11vh), `hud: 'hidden'`, `intro: true`.
  2. 약 2 s 뒤 `.nw-cinema.is-title` 이 있고 `.nw-cinema-heading` 이 `HAUS NOWHERE — 성수 2041`, `.nw-cinema-progress-fill` 의 `style.transform` 이 `scaleX(0.1…)` 처럼 늘고 있다. 캡처 `build/nowhere/compare/entry-cinema-smoke.png`(절대 경로).
  3. `document.querySelector('.nw-cinema-skip').click()` → `getStats().introActive === false`, `camera === 'street'`, 0.6 s 뒤 `.nw-cinema` 가 `hidden`, `body.is-cinema` 없음, 건물 선택 모달(`.nw-modal` 보임, 제목 `어떤 건물로 이동하시겠습니까?`) → '닫기' 버튼 클릭.
  4. 다시 열고 인트로 중 `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))` → 건너뛰기(거리 시점 · 건물 선택 모달) — 예전처럼 투어가 끝나지 않는다. 모달 '닫기'.
  결과를 보고서에 적는다.

- [ ] **Step 13: 스테이징(커밋하지 않음) — 리뷰 통과 뒤 컨트롤러가 실행**

```bash
git add public/src/nowhere/cinema.js public/src/nowhere/camera.js public/src/nowhere/main.js public/src/nowhere/nowhere.css tests/nowhere-cinema.test.mjs
```

커밋 메시지 안: `feat(nowhere): 인트로 영화식 연출 — 위아래 띠 · 제목 자막 · 건너뛰기 · 진행 선, Esc 는 건너뛰기`

---

### Task 4: 방식 고르기 · 방식 컨트롤러(모듈)

**Files:**
- Create: `public/src/nowhere/mode-menu.js`
- Create: `public/src/nowhere/modes.js`
- Modify: `public/src/nowhere/nowhere.css` (Task 3 의 HUD 숨김 규칙에 `is-choosing` 추가, 파일 끝에 방식 카드)
- Test: `tests/nowhere-mode-menu.test.mjs` (새), `tests/nowhere-modes.test.mjs` (새)

**Interfaces:**
- Consumes: Task 1 `MODE_IDS`; camCtrl 의 `isWalkMode()` · `setWalkMode(on)`
- Produces (Task 5 가 쓴다):
  - mode-menu.js: `MODES: Array<{ id, key: '1'|'2'|'3', label, en, desc }>`, `MODE_MENU_TITLE = '어떻게 둘러볼까요?'`, `MODE_MENU_OUT_MS = 300`, `resolveMenuKey(key, focus) → { pick: modeId } | { focus: number } | null`, `showModeMenu({ isBlocked = () => false } = {}) → Promise<'guide'|'walk'|'free'>`(열려 있는 동안 `body.is-choosing`, 고르면 0.3 s 사라진 뒤 resolve)
  - modes.js: `renderMode(mode, doc = globalThis.document)`, `createModeController({ camCtrl, startGuide, endGuide, isSuspended = () => false, onChange = renderMode }) → { set(mode) → mode|null, get() → mode|null, syncWalk(active), refresh() }`
    - `set('guide')`: 방식을 먼저 guide 로 → `startGuide()`(이미 guide 여도 다시 부른다 — 건물 선택을 다시 연다)
    - `set('walk')`: `endGuide()` → walk → 보행이 꺼져 있으면 `camCtrl.setWalkMode(true)`
    - `set('free')`: `endGuide()` → free → 보행 중이면 `camCtrl.setWalkMode(false)`
    - `syncWalk(active)`: `isSuspended()` 면 무시. 켜지면 walk, 꺼졌고 지금 walk 면 free(guide · free 는 그대로)
    - `refresh()`: 무시 없이 지금 보행 여부로 같은 규칙(실내에서 나온 뒤)

- [ ] **Step 1: 실패하는 테스트 작성 (1/2)** — `tests/nowhere-mode-menu.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MODES, MODE_MENU_TITLE, MODE_MENU_OUT_MS, resolveMenuKey } from '../public/src/nowhere/mode-menu.js';
import { MODE_IDS } from '../public/src/nowhere/entry.js';

test('(a) 카드: 순서 · 이름 · 영문 · 설명 · 숫자 키, 제목 · 사라짐 0.3 s', () => {
  assert.equal(MODE_MENU_TITLE, '어떻게 둘러볼까요?');
  assert.deepEqual(MODES.map((m) => m.id), MODE_IDS);
  assert.deepEqual(MODES.map((m) => [m.label, m.en, m.desc, m.key]), [
    ['가이드 투어', 'GUIDED TOUR', '두 건물과 실내를 차례로 안내합니다', '1'],
    ['직접 걷기', 'WALK', '눈높이로 걸으며 ◇ 스팟을 따라 이동합니다', '2'],
    ['자유 시점', 'FREE VIEW', '카메라를 돌리고 확대하며 원하는 시점에서 봅니다', '3'],
  ]);
  assert.equal(MODE_MENU_OUT_MS, 300);
});

test('(b) 키: 1 · 2 · 3 은 그 방식, Esc 는 자유 시점, Enter 는 포커스된 카드', () => {
  assert.deepEqual(resolveMenuKey('1', 2), { pick: 'guide' });
  assert.deepEqual(resolveMenuKey('2', 0), { pick: 'walk' });
  assert.deepEqual(resolveMenuKey('3', 0), { pick: 'free' });
  assert.deepEqual(resolveMenuKey('Escape', 0), { pick: 'free' });
  assert.deepEqual(resolveMenuKey('Enter', 0), { pick: 'guide' }, '첫 포커스 가이드 투어');
  assert.deepEqual(resolveMenuKey('Enter', 1), { pick: 'walk' });
  assert.deepEqual(resolveMenuKey('Enter', 2), { pick: 'free' });
});

test('(c) ←/→ 는 포커스만 옮기고 끝에서 멈춘다, 그 밖의 키는 null', () => {
  assert.deepEqual(resolveMenuKey('ArrowRight', 0), { focus: 1 });
  assert.deepEqual(resolveMenuKey('ArrowRight', 2), { focus: 2 });
  assert.deepEqual(resolveMenuKey('ArrowLeft', 2), { focus: 1 });
  assert.deepEqual(resolveMenuKey('ArrowLeft', 0), { focus: 0 });
  for (const k of ['4', 'v', 'KeyW', ' ', 'Tab']) assert.equal(resolveMenuKey(k, 0), null, k);
});

test('(d) CSS: 방식 고르기 동안 HUD 숨김 · 세로 화면은 카드를 세로로 쌓는다', () => {
  const css = readFileSync(new URL('../public/src/nowhere/nowhere.css', import.meta.url), 'utf8');
  for (const sel of ['.nw-topbar', '.nw-dock', '.nw-walk-hud', '.nw-spots', '.nw-perf']) {
    assert.ok(css.includes(`body.is-choosing ${sel}`), `방식 고르기 중 ${sel} 를 숨기지 않음`);
  }
  assert.match(css, /\.nw-mode-card \{[^}]*min-height: 44px/);
  assert.match(css, /@media \(max-width: 720px\) and \(orientation: portrait\) \{\s*\.nw-mode-cards \{\s*flex-direction: column;/);
});
```

- [ ] **Step 2: 실패하는 테스트 작성 (2/2)** — `tests/nowhere-modes.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createModeController, renderMode } from '../public/src/nowhere/modes.js';
import { MODE_IDS } from '../public/src/nowhere/entry.js';

// 가짜 카메라 · 투어: setWalkMode 가 main.js onWalkChange 처럼 syncWalk 를 부르고, startGuide 는 main.js startScenario 처럼 보행을 끈다
function setup() {
  const s = { walk: false, suspended: false, guide: false };
  const log = [];
  const changes = [];
  let ctl = null;
  const camCtrl = {
    isWalkMode: () => s.walk,
    setWalkMode(on) {
      s.walk = Boolean(on);
      log.push(`walk:${s.walk}`);
      ctl.syncWalk(s.walk);
    },
  };
  ctl = createModeController({
    camCtrl,
    startGuide: () => {
      log.push('startGuide');
      if (s.walk) camCtrl.setWalkMode(false);
      s.guide = true;
    },
    endGuide: () => {
      if (s.guide) log.push('endGuide');
      s.guide = false;
    },
    isSuspended: () => s.suspended,
    onChange: (m) => changes.push(m),
  });
  return { ctl, camCtrl, s, log, changes };
}

test('(a) 처음은 null · MODE_IDS 밖의 값은 무시', () => {
  const { ctl, changes } = setup();
  assert.deepEqual(MODE_IDS, ['guide', 'walk', 'free']);
  assert.equal(ctl.get(), null);
  assert.equal(ctl.set('tour'), null);
  assert.deepEqual(changes, []);
});

test('(b) 직접 걷기 → 그 자리에서 보행, 자유 시점 → 보행 끄기', () => {
  const { ctl, s, log, changes } = setup();
  assert.equal(ctl.set('walk'), 'walk');
  assert.equal(s.walk, true);
  assert.equal(ctl.set('walk'), 'walk');
  assert.deepEqual(log, ['walk:true'], '이미 걷는 중이면 다시 켜지 않는다');
  assert.equal(ctl.set('free'), 'free');
  assert.equal(s.walk, false);
  assert.deepEqual(changes, ['walk', 'free']);
});

test('(c) 가이드 투어: 방식을 먼저 바꾸고 투어 시작(보행을 꺼도 자유 시점을 거치지 않음) · 다시 누르면 건물 선택을 다시 연다 · 다른 방식은 투어를 끝낸다', () => {
  const { ctl, s, log, changes } = setup();
  ctl.set('walk');
  ctl.set('guide');
  assert.equal(ctl.get(), 'guide');
  assert.equal(s.walk, false);
  assert.deepEqual(changes, ['walk', 'guide']);
  ctl.set('guide');
  assert.equal(log.filter((x) => x === 'startGuide').length, 2);
  ctl.set('free');
  assert.ok(log.includes('endGuide'));
  assert.equal(s.guide, false);
  assert.equal(ctl.get(), 'free');
  ctl.set('guide');
  ctl.set('walk');
  assert.equal(s.guide, false, '투어 중 직접 걷기 → 투어를 끝내고');
  assert.equal(s.walk, true);
  assert.equal(ctl.get(), 'walk');
});

test('(d) syncWalk: V 로 켜면 직접 걷기, 끄면 자유 시점, 가이드 투어가 보행을 끄는 것은 그대로', () => {
  const { ctl, camCtrl, changes } = setup();
  ctl.set('free');
  camCtrl.setWalkMode(true);
  assert.equal(ctl.get(), 'walk');
  camCtrl.setWalkMode(false);
  assert.equal(ctl.get(), 'free');
  ctl.set('guide');
  ctl.syncWalk(false);
  assert.equal(ctl.get(), 'guide');
  camCtrl.setWalkMode(true);
  assert.equal(ctl.get(), 'walk', '가이드 투어 중 V → 직접 걷기');
  assert.deepEqual(changes, ['free', 'walk', 'free', 'guide', 'walk']);
});

test('(e) 실내(isSuspended) 동안 syncWalk 는 무시, 나온 뒤 refresh 로 보행 여부 · 이전 방식에 맞춘다', () => {
  const { ctl, camCtrl, s } = setup();
  ctl.set('walk');
  s.suspended = true;
  camCtrl.setWalkMode(false);
  camCtrl.setWalkMode(true);
  camCtrl.setWalkMode(false);
  assert.equal(ctl.get(), 'walk', '실내 동안은 바꾸지 않는다');
  s.suspended = false;
  ctl.refresh();
  assert.equal(ctl.get(), 'free', '직접 걷기로 들어가 보행 꺼진 채 나오면 자유 시점');

  ctl.set('guide');
  s.suspended = true;
  camCtrl.setWalkMode(true);
  s.suspended = false;
  ctl.refresh();
  assert.equal(ctl.get(), 'walk', '걸으며 나오면 직접 걷기');

  ctl.set('guide');
  s.suspended = true;
  camCtrl.setWalkMode(true);
  camCtrl.setWalkMode(false);
  s.suspended = false;
  ctl.refresh();
  assert.equal(ctl.get(), 'guide', '보행 꺼진 채 나오면 이전 방식(가이드 투어)');
});

test('(f) renderMode: body[data-mode] · #nw-mode-seg 버튼 is-active · aria-pressed, document 없으면 아무것도 안 함', () => {
  const btn = (mode) => {
    const cls = new Set();
    const attrs = {};
    return {
      dataset: { mode },
      attrs,
      classList: { toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)), contains: (c) => cls.has(c) },
      setAttribute: (k, v) => {
        attrs[k] = v;
      },
    };
  };
  const btns = MODE_IDS.map(btn);
  let selector = null;
  const doc = {
    body: { dataset: {} },
    querySelectorAll: (sel) => {
      selector = sel;
      return btns;
    },
  };
  renderMode('walk', doc);
  assert.equal(doc.body.dataset.mode, 'walk');
  assert.equal(selector, '#nw-mode-seg [data-mode]');
  assert.deepEqual(btns.map((b) => b.classList.contains('is-active')), [false, true, false]);
  assert.deepEqual(btns.map((b) => b.attrs['aria-pressed']), ['false', 'true', 'false']);
  renderMode(null, doc);
  assert.equal('mode' in doc.body.dataset, false);
  assert.doesNotThrow(() => renderMode('free'));
});
```

- [ ] **Step 3: 실패 확인**

Run: `node --test tests/nowhere-mode-menu.test.mjs tests/nowhere-modes.test.mjs`
Expected: FAIL — `mode-menu.js` · `modes.js` 가 없다(`ERR_MODULE_NOT_FOUND`).

- [ ] **Step 4: `public/src/nowhere/mode-menu.js` 작성**

```js
// HAUS NOWHERE — 방식 고르기(인트로 뒤): 거리 시점 위 아래쪽 가운데 「어떻게 둘러볼까요?」 + 카드 세 장(가이드 투어 · 직접 걷기 · 자유 시점).
// MODES · resolveMenuKey 는 순수(테스트: tests/nowhere-mode-menu.test.mjs). DOM 은 showModeMenu 를 부를 때만 만든다.
// 열려 있는 동안 body.is-choosing 으로 HUD 를 숨기고(nowhere.css), 키는 모달처럼 창 캡처 단계에서 먼저 받는다.

export const MODE_MENU_TITLE = '어떻게 둘러볼까요?';
export const MODE_MENU_OUT_MS = 300;   // 고른 뒤 사라지는 시간 — 다 사라진 다음 방식을 적용한다

export const MODES = [
  { id: 'guide', key: '1', label: '가이드 투어', en: 'GUIDED TOUR', desc: '두 건물과 실내를 차례로 안내합니다' },
  { id: 'walk', key: '2', label: '직접 걷기', en: 'WALK', desc: '눈높이로 걸으며 ◇ 스팟을 따라 이동합니다' },
  { id: 'free', key: '3', label: '자유 시점', en: 'FREE VIEW', desc: '카메라를 돌리고 확대하며 원하는 시점에서 봅니다' },
];

/** 1 · 2 · 3 → 그 방식, Esc → 자유 시점, Enter → 포커스된 카드, ←/→ 포커스 이동(끝에서 멈춤). 그 밖은 null */
export function resolveMenuKey(key, focus) {
  const byKey = MODES.find((m) => m.key === key);
  if (byKey) return { pick: byKey.id };
  if (key === 'Escape') return { pick: 'free' };
  if (key === 'Enter') return { pick: (MODES[focus] || MODES[0]).id };
  if (key === 'ArrowLeft') return { focus: Math.max(0, focus - 1) };
  if (key === 'ArrowRight') return { focus: Math.min(MODES.length - 1, focus + 1) };
  return null;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/**
 * 방식 고르기를 띄우고 고른 방식 id 를 돌려준다(첫 포커스 가이드 투어). 클릭 · 탭 · 1/2/3 · ←/→ · Enter · Esc(자유 시점).
 * isBlocked() 가 참이면(조작 안내 · 모달이 떠 있음) 키를 받지 않는다.
 */
export function showModeMenu({ isBlocked = () => false } = {}) {
  return new Promise((resolve) => {
    const root = el('div', 'nw-mode-menu');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'nw-mode-menu-title');
    const title = el('h2', 'nw-mode-menu-title', MODE_MENU_TITLE);
    title.id = 'nw-mode-menu-title';
    const list = el('div', 'nw-mode-cards');
    let focus = 0;
    let done = false;
    const cards = MODES.map((m, i) => {
      const card = el('button', 'nw-mode-card');
      card.type = 'button';
      card.dataset.mode = m.id;
      const head = el('span', 'nw-mode-card-head');
      head.append(el('span', 'nw-mode-card-en', m.en), el('kbd', 'nw-kbd nw-mode-card-key', m.key));
      card.append(head, el('span', 'nw-mode-card-label', m.label), el('span', 'nw-mode-card-desc', m.desc));
      card.addEventListener('mouseenter', () => setFocus(i));
      card.addEventListener('focus', () => setFocus(i, false));
      card.addEventListener('click', () => pick(m.id));
      list.append(card);
      return card;
    });
    root.append(title, list);

    function setFocus(i, moveFocus = true) {
      if (done) return;
      focus = i;
      cards.forEach((c, k) => c.classList.toggle('is-focus', k === i));
      if (moveFocus && document.activeElement !== cards[i]) cards[i].focus({ preventScroll: true });
    }

    function onKey(e) {
      if (done || e.defaultPrevented || isBlocked()) return;
      const action = resolveMenuKey(e.key, focus);
      if (!action) {
        e.stopPropagation();   // 그 밖의 키(V · WASD 등)가 뒤 카메라로 가지 않게(모달과 같은 규칙 — Tab 이동은 그대로)
        return;
      }
      e.preventDefault();      // Enter 가 포커스된 카드의 click 으로 한 번 더 고르지 않게
      e.stopPropagation();
      if (e.repeat) return;
      if (action.pick) pick(action.pick);
      else setFocus(action.focus);
    }

    function pick(id) {
      if (done) return;
      done = true;
      window.removeEventListener('keydown', onKey, true);
      root.classList.remove('is-on');   // 0.3 초에 사라진 뒤 방식을 적용한다
      setTimeout(() => {
        root.remove();
        document.body.classList.remove('is-choosing');
        resolve(id);
      }, MODE_MENU_OUT_MS);
    }

    window.addEventListener('keydown', onKey, true);
    document.body.classList.add('is-choosing');
    document.body.append(root);
    void root.offsetWidth;   // 붙이자마자 is-on 을 붙이면 나타나는 전환이 생략된다
    root.classList.add('is-on');
    setFocus(0);   // 첫 포커스 가이드 투어
  });
}
```

- [ ] **Step 5: `public/src/nowhere/modes.js` 작성**

```js
// HAUS NOWHERE — 둘러보기 방식(가이드 투어 · 직접 걷기 · 자유 시점) 상태 하나를 body[data-mode] 와 상단 방식 전환(#nw-mode-seg)에 반영한다.
// 투어 시작 · 끝내기는 main.js 가 넘긴다(startGuide · endGuide). 카메라 시점 버튼은 자유 시점에서만 보인다(nowhere.css body[data-mode]).
// 테스트: tests/nowhere-modes.test.mjs
import { MODE_IDS } from './entry.js';

/** body[data-mode] 와 #nw-mode-seg 버튼(is-active · aria-pressed)을 mode 에 맞춘다. document 가 없으면(노드 테스트) 아무것도 하지 않는다 */
export function renderMode(mode, doc = globalThis.document) {
  if (!doc) return;
  if (mode) doc.body.dataset.mode = mode;
  else delete doc.body.dataset.mode;
  doc.querySelectorAll('#nw-mode-seg [data-mode]').forEach((btn) => {
    const on = btn.dataset.mode === mode;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-pressed', String(on));
  });
}

/**
 * set(mode): guide = 건물 선택부터 투어(이미 가이드 투어여도 다시 연다), walk = 그 자리에서 보행, free = 보행 끄기 · 진행 중인 투어 끝내기.
 * syncWalk(active): V 키 · 실내 출입 등으로 보행이 켜지면 walk, walk 인데 꺼지면 free(가이드 투어는 투어가 보행을 끄므로 그대로).
 *   isSuspended()(실내 · 실내 화면 전환 중) 동안은 무시한다 — 실내 출입 · 층 이동 · 둘러보기가 보행을 켰다 껐다 한다.
 * refresh(): 실내에서 나온 뒤 — 보행 중이면 walk, 아니면 들어가기 전 방식(walk 였으면 free).
 */
export function createModeController({ camCtrl, startGuide, endGuide, isSuspended = () => false, onChange = renderMode }) {
  let mode = null;

  function commit(next) {
    if (next === mode) return;
    mode = next;
    if (typeof onChange === 'function') onChange(mode);
  }

  function apply(walking) {
    if (walking) commit('walk');
    else if (mode === 'walk') commit('free');
  }

  function set(next) {
    if (!MODE_IDS.includes(next)) return mode;
    if (next === 'guide') {
      commit('guide');   // 먼저 바꾼다 — startGuide 가 보행을 끌 때(syncWalk(false)) 자유 시점으로 바뀌지 않게
      startGuide();
    } else if (next === 'walk') {
      endGuide();
      commit('walk');
      if (!camCtrl.isWalkMode()) camCtrl.setWalkMode(true);
    } else {
      endGuide();
      commit('free');
      if (camCtrl.isWalkMode()) camCtrl.setWalkMode(false);
    }
    return mode;
  }

  return {
    set,
    get: () => mode,
    syncWalk(active) {
      if (!isSuspended()) apply(Boolean(active));
    },
    refresh() {
      apply(camCtrl.isWalkMode());
    },
  };
}
```

- [ ] **Step 6: HUD 숨김에 방식 고르기 추가** — Task 3 에서 `nowhere.css` 끝에 넣은 아래 규칙을

```css
body.is-cinema .nw-topbar,
body.is-cinema .nw-dock,
body.is-cinema .nw-walk-hud,
body.is-cinema .nw-spots,
body.is-cinema .nw-perf {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}
```

  다음으로 바꾸고, 그 위 주석 `/* ── 인트로 연출 동안 HUD 숨김(body.is-cinema) ── */` 를 `/* ── 인트로 연출(body.is-cinema) · 방식 고르기(body.is-choosing) 동안 HUD 숨김 ── */` 로 바꾼다

```css
body.is-cinema .nw-topbar,
body.is-cinema .nw-dock,
body.is-cinema .nw-walk-hud,
body.is-cinema .nw-spots,
body.is-cinema .nw-perf,
body.is-choosing .nw-topbar,
body.is-choosing .nw-dock,
body.is-choosing .nw-walk-hud,
body.is-choosing .nw-spots,
body.is-choosing .nw-perf {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}
```

- [ ] **Step 7: 방식 카드 스타일** — `nowhere.css` 파일 끝에

```css

/* ── 방식 고르기(mode-menu.js): 인트로 뒤 거리 시점 위 — 아래쪽 가운데 제목 + 카드 세 장, 화면 아래쪽만 옅게 어둡게 ── */
.nw-mode-menu {
  position: fixed;
  inset: 0;
  z-index: 31;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 14px;
  padding: 24px 22px max(32px, env(safe-area-inset-bottom));
  background: linear-gradient(180deg, rgba(4, 8, 14, 0) 45%, rgba(4, 8, 14, 0.62) 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
}
.nw-mode-menu.is-on {
  opacity: 1;
}
.nw-mode-menu-title {
  margin: 0;
  font-size: 20px;
  font-weight: 500;
  letter-spacing: -0.01em;
  color: var(--nw-text);
  text-shadow: 0 1px 12px rgba(0, 0, 0, 0.55);
}
.nw-mode-cards {
  display: flex;
  gap: 12px;
  width: min(860px, 100%);
}
.nw-mode-card {
  flex: 1 1 0;
  min-width: 0;
  min-height: 44px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 14px 16px 16px;
  appearance: none;
  text-align: left;
  background: var(--nw-bg-panel-strong);
  border: 1px solid var(--nw-line-struct);
  border-top: 2px solid var(--nw-line-struct);
  border-radius: 3px;
  color: var(--nw-text);
  font-family: var(--nw-font-sans);
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
}
.nw-mode-card:focus {
  outline: none;   /* 포커스는 is-focus(테두리 강조)로 보인다 */
}
.nw-mode-card.is-focus {
  border-color: var(--nw-accent);
  background: rgba(18, 36, 58, 0.92);
  transform: translateY(-2px);
}
.nw-mode-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.nw-mode-card-en {
  font-family: var(--nw-font-mono);
  font-size: 10.5px;
  letter-spacing: 0.14em;
  color: var(--nw-accent);
}
.nw-mode-card-label {
  font-size: 16px;
  font-weight: 600;
}
.nw-mode-card-desc {
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--nw-text-dim);
  word-break: keep-all;
}
/* 세로 화면(가로 < 세로, 폭 ≤ 720 px)은 카드를 세로로 쌓는다 */
@media (max-width: 720px) and (orientation: portrait) {
  .nw-mode-cards {
    flex-direction: column;
    gap: 8px;
  }
  .nw-mode-card {
    padding: 11px 14px 12px;
  }
  .nw-mode-menu-title {
    font-size: 17px;
  }
}
```

- [ ] **Step 8: 통과 확인**

Run: `node --check public/src/nowhere/mode-menu.js && node --check public/src/nowhere/modes.js && node --test tests/nowhere-mode-menu.test.mjs tests/nowhere-modes.test.mjs`
Expected: 문법 오류 없음, PASS (mode-menu 4개, modes 6개)

- [ ] **Step 9: 전체 테스트**

Run: `npm test`
Expected: 모든 테스트 PASS (실패 0)

- [ ] **Step 10: 브라우저 연기 시험(playwriter)** — playwriter MCP 만 쓴다(Playwright MCP 금지 — playwriter 가 실패하면 보고하고 다른 도구로 넘어가지 않는다). `state.page` 로 잡고, 페이지를 열 때마다 곧바로 `await state.page.evaluate(() => { window.__dialogs = []; window.confirm = (m) => (window.__dialogs.push(m), true); window.alert = (m) => { window.__dialogs.push(m); }; window.prompt = (m) => (window.__dialogs.push(m), null); })` 로 대화상자 함수를 바꾼다(`page.on('dialog')` 에 기대지 않는다). 기다림은 짧은 호출 여러 번으로 나누고, 각 호출 시작에 `await Promise.race([state.page.evaluate(() => 1), new Promise((r) => setTimeout(() => r('blocked'), 3000))])` 로 3 s 안에 돌아오는지 확인한다(첫 로드는 10–40 s 막힐 수 있다). 아직 `main.js` 에 연결하지 않았으므로 모듈을 직접 띄운다. `http://localhost:4173/nowhere?noIntro=1` 에서 `window.__NW_APP` 이 생긴 뒤:
  1. 1600 × 900: `await (async () => { const m = await import('/src/nowhere/mode-menu.js'); window.__pick = null; m.showModeMenu().then((v) => { window.__pick = v; }); return document.querySelectorAll('.nw-mode-card').length; })()` → 3, `document.body.classList.contains('is-choosing')`, 상단 바 `visibility: hidden`, `document.activeElement.dataset.mode === 'guide'`. 캡처 `build/nowhere/compare/entry-menu-smoke-1600.png`(절대 경로).
  2. `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))` → `.nw-mode-card.is-focus` 가 직접 걷기. `window.dispatchEvent(new KeyboardEvent('keydown', { key: '3' }))` → 0.4 s 뒤 `window.__pick === 'free'`, `.nw-mode-menu` 없음, `is-choosing` 없음.
  3. 390 × 844 로 바꿔 1 을 다시 띄우고 카드가 세로로 쌓이는지(세 카드의 `getBoundingClientRect().top` 이 서로 다름, 각 높이 ≥ 44) 캡처 `entry-menu-smoke-390.png`, `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))` → `__pick === 'free'`.
  결과를 보고서에 적는다.

- [ ] **Step 11: 스테이징(커밋하지 않음) — 리뷰 통과 뒤 컨트롤러가 실행**

```bash
git add public/src/nowhere/mode-menu.js public/src/nowhere/modes.js public/src/nowhere/nowhere.css tests/nowhere-mode-menu.test.mjs tests/nowhere-modes.test.mjs
```

커밋 메시지 안: `feat(nowhere): 방식 고르기 카드 · 방식 컨트롤러(가이드 투어 · 직접 걷기 · 자유 시점)`

---

### Task 5: 시작 흐름 연결 · 투어 정리 · 상단 방식 전환 버튼

**Files:**
- Modify: `public/src/nowhere/scenario.js` (`intro` 단계 제거, 시작 `chooseBuilding`, 머리 주석)
- Modify: `public/index.html` · `public/nowhere.html` · `public/nowhere-mountain.html` (상단 버튼 세 개 → `#nw-mode-seg`)
- Modify: `public/src/nowhere/main.js` (import, 월드 전환 · 옛 버튼 제거, `modes` · 시작 흐름 · 실내 연결, `startScenario` · `endScenario`, `app` · `getStats`)
- Modify: `public/src/nowhere/nowhere.css` (방식 전환 버튼, `body[data-mode]`, 실내 규칙)
- Test: `tests/nowhere-scenario.test.mjs` (수정), `tests/nowhere-modes.test.mjs` (테스트 두 개 추가), `tests/nowhere-help.test.mjs` ((c) 를 main.js 연결만 보게)

**Interfaces:**
- Consumes: Task 1 `entry`(`resolveEntry` 결과), Task 2 `worldVer`, Task 3 `cinema` · `INTRO_TITLES` · `camCtrl.skipIntro` · `playIntro`, Task 4 `showModeMenu` · `createModeController` · `MODES`
- Produces:
  - `SCENARIO.start === 'chooseBuilding'`, `SCENARIO.steps.intro === undefined`, 어댑터 `{ modal, fly, enterInterior }`
  - HTML: `<div id="nw-mode-seg" class="nw-mode-seg" role="group" aria-label="둘러보기 방식">` 안 `button[data-mode="guide"|"walk"|"free"]`
  - main.js: `playIntro({ holdHud = false } = {})`, `runEntry()`, `startScenario(stepId)`(인트로 · 실내 중이면 시작하지 않음), `endScenario()`, `modes`(컨트롤러), 월드 전환 주소 `?ver=<다른 월드>&noIntro=1&mode=<지금 방식>`(`cam` 은 지움), `app.modes` · `app.entry`, `getStats().mode`

- [ ] **Step 1: 실패하는 테스트로 바꾸기 (시나리오)** — `tests/nowhere-scenario.test.mjs` 전체를 아래로 바꾼다

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIO, CANCEL, nextStepId, validateScenario, createScenarioRunner } from '../public/src/nowhere/scenario.js';

function fakeAdapters(choices, log) {
  const queue = [...choices];
  return {
    modal: async (s) => { log.push(`modal:${s.title}`); return queue.shift(); },
    fly: async (s) => { log.push(`fly:${s.building}`); return 'done'; },
    enterInterior: async (s) => { log.push(`enter:${s.building}`); return 'done'; },
  };
}

test('(a) 그래프가 유효하고 문구가 정확하다 · 시작은 건물 선택, 인트로 단계 없음', () => {
  assert.deepEqual(validateScenario(SCENARIO), []);
  assert.equal(SCENARIO.start, 'chooseBuilding');
  assert.equal(SCENARIO.steps.intro, undefined);
  assert.ok(Object.values(SCENARIO.steps).every((s) => s.type !== 'intro'));
  assert.equal(SCENARIO.steps.chooseBuilding.title, '어떤 건물로 이동하시겠습니까?');
  assert.deepEqual(SCENARIO.steps.chooseBuilding.buttons.map((b) => b.label), ['하우스노웨어 성수', '하우스노웨어 몽골', '닫기']);
  assert.equal(SCENARIO.steps.askEnter.title, '입장하시겠습니까?');
  assert.deepEqual(SCENARIO.steps.askEnter.buttons.map((b) => b.label), ['예', '하우스노웨어 몽골로 이동', '아니오']);
  assert.equal(SCENARIO.steps.notReady.title, '준비중입니다');
  assert.deepEqual(SCENARIO.steps.notReady.buttons.map((b) => b.label), ['하우스노웨어 성수로 이동', '확인']);
});

test('(b) 성수 → 예: 선택 → 비행 → 입장 질문 → 실내 진입', async () => {
  const log = [];
  let ended = 0;
  const r = createScenarioRunner({ adapters: fakeAdapters(['haus', 'yes'], log), onEnd: () => ended++ });
  assert.equal(await r.start(), 'done');
  assert.deepEqual(log, ['modal:어떤 건물로 이동하시겠습니까?', 'fly:haus', 'modal:입장하시겠습니까?', 'enter:haus']);
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
  assert.deepEqual(log, ['modal:어떤 건물로 이동하시겠습니까?', 'fly:facearch', 'modal:준비중입니다']);
});

test('(e) 모달에서 Esc(null) 는 시나리오 종료', async () => {
  const log = [];
  await createScenarioRunner({ adapters: fakeAdapters([null], log) }).start();
  assert.deepEqual(log, ['modal:어떤 건물로 이동하시겠습니까?']);
});

test("(f) start() 와 start('chooseBuilding') 은 같은 모달부터", async () => {
  const a = [];
  const b = [];
  await createScenarioRunner({ adapters: fakeAdapters(['facearch', 'ok'], a) }).start();
  await createScenarioRunner({ adapters: fakeAdapters(['facearch', 'ok'], b) }).start('chooseBuilding');
  assert.equal(a[0], 'modal:어떤 건물로 이동하시겠습니까?');
  assert.deepEqual(a, b);
});

test('(g) 어댑터가 CANCEL 을 돌려주면 끝, 비행 중 cancel() 하면 다음 단계로 가지 않는다', async () => {
  const log = [];
  const a = fakeAdapters(['haus', 'yes'], log);
  a.fly = async () => CANCEL;
  await createScenarioRunner({ adapters: a }).start();
  assert.deepEqual(log, ['modal:어떤 건물로 이동하시겠습니까?']);

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
  assert.equal(nextStepId(SCENARIO.steps.flyHaus, 'done'), 'askEnter');
});

test('(i) 어댑터가 예외를 던져도 실행기는 정리된다(onEnd 한 번 · isRunning false), 예외는 호출자에게 전달', async () => {
  const log = [];
  const a = fakeAdapters(['haus', 'yes'], log);
  a.fly = async () => { throw new Error('flight failed'); };
  let ended = 0;
  const r = createScenarioRunner({ adapters: a, onEnd: () => ended++ });
  await assert.rejects(r.start(), /flight failed/);
  assert.equal(ended, 1);
  assert.equal(r.isRunning(), false);
  assert.equal(r.current(), null);
});

test('(j) 시나리오가 쓰는 건물 id 는 모두 TOUR_BUILDINGS 에 있다', async () => {
  const { TOUR_BUILDINGS } = await import('../public/src/nowhere/tour-config.js');
  const ids = Object.values(SCENARIO.steps)
    .flatMap((s) => [s.building, ...(s.buttons || []).map((b) => b.building)])
    .filter(Boolean);
  assert.ok(ids.length >= 4, `건물 id ${ids.length}개`);
  for (const id of ids) assert.ok(TOUR_BUILDINGS[id], `TOUR_BUILDINGS 에 '${id}' 없음`);
});

test('(k) 도착 모달에서 다른 건물로: 성수 → 몽골로 이동 → 준비중 → 성수로 이동 → 입장 질문 → 예', async () => {
  const log = [];
  await createScenarioRunner({ adapters: fakeAdapters(['haus', 'toFacearch', 'toHaus', 'yes'], log) }).start('chooseBuilding');
  assert.deepEqual(log, [
    'modal:어떤 건물로 이동하시겠습니까?',
    'fly:haus',
    'modal:입장하시겠습니까?',
    'fly:facearch',
    'modal:준비중입니다',
    'fly:haus',
    'modal:입장하시겠습니까?',
    'enter:haus',
  ]);
  // Enter(기본) · Esc(취소)는 그대로: 성수 입장 질문은 예 · 아니오, 몽골 준비중은 확인
  const { resolveModalKey } = await import('../public/src/nowhere/modal.js');
  assert.equal(resolveModalKey('Enter', SCENARIO.steps.askEnter.buttons), 'yes');
  assert.equal(resolveModalKey('Escape', SCENARIO.steps.askEnter.buttons), 'no');
  assert.equal(resolveModalKey('Enter', SCENARIO.steps.notReady.buttons), 'ok');
  assert.equal(resolveModalKey('Escape', SCENARIO.steps.notReady.buttons), 'ok');
});
```

- [ ] **Step 2: 실패하는 테스트 추가 (HTML · 연결)** — `tests/nowhere-modes.test.mjs` 의 import 에 `import { readFileSync } from 'node:fs';` 와 `import { MODES } from '../public/src/nowhere/mode-menu.js';` 를 더하고, 파일 끝에

```js
const readPub = (p) => readFileSync(new URL(`../public/${p}`, import.meta.url), 'utf8');

test('(g) 세 페이지: 상단 방식 전환(#nw-mode-seg)이 MODES 순서 · 이름이고, 옛 버튼(투어 시작 · 건물 이동 · 보행 시점)은 없다', () => {
  for (const name of ['index.html', 'nowhere.html', 'nowhere-mountain.html']) {
    const html = readPub(name);
    const seg = html.match(/<div id="nw-mode-seg"[\s\S]*?<\/div>/)?.[0];
    assert.ok(seg, `${name}: #nw-mode-seg 없음`);
    const btns = [...seg.matchAll(/data-mode="(\w+)"[^>]*>([^<]+)/g)].map((m) => [m[1], m[2].trim()]);
    assert.deepEqual(btns, MODES.map((m) => [m.id, m.label]), name);
    for (const id of ['nw-btn-intro', 'nw-btn-buildings', 'nw-btn-walk']) assert.equal(html.includes(id), false, `${name}: ${id} 가 남아 있음`);
    assert.doesNotMatch(html, /투어 시작|건물 이동/, name);
  }
});

test('(h) main.js · CSS: 방식 연결(보행 동기화 · 실내 · 가이드 투어 · 월드 전환 주소), 카메라 프리셋은 자유 시점에서만, 실내에서는 방식 전환 숨김', () => {
  const main = readPub('src/nowhere/main.js');
  assert.match(main, /createModeController\(/);
  assert.match(main, /showModeMenu\(/);
  assert.match(main, /modes\?\.syncWalk\(active\)/);
  assert.match(main, /modes\?\.refresh\(\)/);
  assert.match(main, /startGuide: \(\) => startScenario\('chooseBuilding'\)/);
  assert.match(main, /nextParams\.set\('mode', /);
  assert.match(main, /nextParams\.delete\('cam'\)/);
  assert.doesNotMatch(main, /nw-btn-(intro|buildings|walk)/);
  const css = readPub('src/nowhere/nowhere.css');
  assert.match(css, /body\[data-mode="guide"\] \.nw-dock-camera/);
  assert.match(css, /body\[data-mode="walk"\] \.nw-dock-camera/);
  assert.match(css, /body\.is-interior \.nw-mode-seg/);
  assert.doesNotMatch(css, /#nw-btn-(intro|buildings)/);
});
```

- [ ] **Step 3: 실패하는 테스트로 바꾸기 (안내 (c))** — `tests/nowhere-help.test.mjs` 의 `(c)` 테스트 전체를 아래로 바꾼다(안내 문구 검사는 Task 6 의 `(g)` 가 맡는다)

```js
test('(c) 시작 흐름 · 가이드 투어가 main.js 에 연결되어 있다(인트로는 시나리오 밖, 가이드 투어 = 건물 선택부터)', () => {
  const main = readFileSync(new URL('../public/src/nowhere/main.js', import.meta.url), 'utf8');
  assert.doesNotMatch(main, /startScenario\('intro'\)/);
  assert.match(main, /startScenario\('chooseBuilding'\)/);
  assert.match(main, /runEntry\(\)/);
  assert.match(main, /createInterior\(/);
  const descs = CONTROL_SECTIONS.flatMap((s) => s.rows.map((r) => r.desc)).join('\n');
  assert.match(descs, /밖으로 나가기/);
});
```

- [ ] **Step 4: 실패 확인**

Run: `node --test tests/nowhere-scenario.test.mjs tests/nowhere-modes.test.mjs tests/nowhere-help.test.mjs`
Expected: FAIL — scenario `(a)`(`SCENARIO.start` 가 `'intro'`), modes `(g)`(`index.html: #nw-mode-seg 없음`) · `(h)`(`createModeController` 없음), help `(c)`(`startScenario('intro')` 가 남아 있음). 나머지 scenario 테스트는 가짜 어댑터에 `intro` 가 없어 그 단계를 건너뛰므로 지금도 통과할 수 있다.

- [ ] **Step 5: `scenario.js` — 인트로 단계 제거** — 머리 주석 4줄(1–4행)을

```js
// HAUS NOWHERE — 시나리오 투어(가이드 투어): 단계 그래프(문구 포함) · 검증 · 실행기(순수, 테스트: tests/nowhere-scenario.test.mjs).
// 실제 동작(모달 · 비행 · 실내 진입)은 main.js 가 어댑터로 넣는다. 인트로는 시나리오 밖(main.js 시작 흐름)에서 돈다.
// 건물 선택 모달에서 시작하고, CANCEL · 모달 Esc(null) 는 시나리오를 끝낸다.
// 건물에 도착한 뒤의 모달(성수 입장 질문 · 몽골 준비중)에서 다른 건물로 바로 날아갈 수 있다(성수 ↔ 몽골).
```

  로 바꾸고, `SCENARIO` 의

```js
  start: 'intro',
  steps: {
    intro: { type: 'intro', next: 'chooseBuilding' },
    chooseBuilding: {
```

  를

```js
  start: 'chooseBuilding',
  steps: {
    chooseBuilding: {
```

  로, 실행기 주석의 `* adapters: { intro, modal, fly, enterInterior } — …` 를 `* adapters: { modal, fly, enterInterior } — 각각 (step) => Promise<결과>. CANCEL 을 돌려주면 끝.` 으로 바꾼다.

- [ ] **Step 6: HTML 세 개 — 상단 방식 전환** — `public/index.html` · `public/nowhere.html` · `public/nowhere-mountain.html` 각각에서 아래 블록(세 파일 모두 같다)을

```html
      <button id="nw-btn-buildings" type="button" class="nw-btn">
        건물 이동
      </button>
      <button id="nw-btn-walk" type="button" class="nw-btn" aria-pressed="false">
        보행 시점<span class="nw-btn-kbd">V</span>
      </button>
      <button id="nw-btn-intro" type="button" class="nw-btn">
        투어 시작
      </button>
```

  다음으로 바꾼다

```html
      <div id="nw-mode-seg" class="nw-mode-seg" role="group" aria-label="둘러보기 방식">
        <button type="button" class="nw-btn" data-mode="guide" aria-pressed="false">가이드 투어</button>
        <button type="button" class="nw-btn" data-mode="walk" aria-pressed="false">직접 걷기<span class="nw-btn-kbd">V</span></button>
        <button type="button" class="nw-btn" data-mode="free" aria-pressed="false">자유 시점</button>
      </div>
```

- [ ] **Step 7: CSS — 방식 전환 버튼 · 방식별 화면 · 실내** — `nowhere.css` 의 `.nw-world-switch .nw-btn.is-active { … }` 규칙 다음에

```css

/* 방식 전환(가이드 투어 | 직접 걷기 | 자유 시점) — 월드 전환과 같은 묶음 모양. 상태는 modes.js 가 is-active · aria-pressed 로 */
.nw-mode-seg {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  background: var(--nw-bg-panel-strong);
  border: 1px solid var(--nw-line-struct);
  border-radius: 2px;
}

.nw-mode-seg .nw-btn {
  border: 1px solid transparent;
  padding: 5px 9px;
}

.nw-mode-seg .nw-btn.is-active {
  border-color: var(--nw-accent);
}

/* 카메라 프리셋 버튼은 자유 시점에서만(가이드 투어 · 직접 걷기에서는 숨김). 기상 · 시간 · 월드 전환 · 조작 안내는 항상 */
body[data-mode="guide"] .nw-dock-camera,
body[data-mode="walk"] .nw-dock-camera {
  display: none;
}
```

  그리고 실내 규칙

```css
/* 실내에서는 외관 전용 UI(월드 전환 · 투어 · 건물 이동 · 카메라 프리셋)를 숨긴다. 기상 · 시간은 유지 */
body.is-interior .nw-world-switch,
body.is-interior #nw-btn-intro,
body.is-interior #nw-btn-buildings,
body.is-interior .nw-dock-camera {
  display: none;
}
```

  을 다음으로 바꾼다

```css
/* 실내에서는 외관 전용 UI(월드 전환 · 방식 전환 · 카메라 프리셋)를 숨긴다 — 층 버튼 · 둘러보기 · 나가기를 쓴다. 기상 · 시간은 유지 */
body.is-interior .nw-world-switch,
body.is-interior .nw-mode-seg,
body.is-interior .nw-dock-camera {
  display: none;
}
```

- [ ] **Step 8: `main.js` — import** — Task 3 의 `import { createCinema, INTRO_TITLES } from './cinema.js';` 줄 아래에

```js
import { showModeMenu } from './mode-menu.js';
import { createModeController } from './modes.js';
```

- [ ] **Step 9: `main.js` — 위쪽 월드 전환 · 옛 버튼 참조 지우기** — `  document.querySelectorAll('[data-world-ver]').forEach((btn) => {` 부터 그 블록의 닫는 `  });` 까지(80f67da 기준 82–98행, `window.location.href = …` 를 포함하는 블록) 전체를 지운다(Step 13 에서 방식과 함께 다시 단다). 그리고 아래 두 줄을 지운다

```js
  const walkBtn = document.getElementById('nw-btn-walk');
  const introBtn = document.getElementById('nw-btn-intro');
```

- [ ] **Step 10: `main.js` — 보행 변화 → 방식** — `  const walkHud = createWalkHud();` 줄 아래에

```js
  let modes = null;   // 방식 컨트롤러 — 아래(시나리오 다음)에서 만든다. 그 전에 보행이 바뀌어도 안전하게
```

  `createCameraController({ … })` 의 `onWalkChange` 를

```js
    onWalkChange(active) {
      if (walkBtn) {
        walkBtn.classList.toggle('is-active', active);
        walkBtn.setAttribute('aria-pressed', String(active));
      }
      walkHud.setState({ walk: active, locked: false });
    },
```

  에서 다음으로 바꾼다

```js
    onWalkChange(active) {
      walkHud.setState({ walk: active, locked: false });
      modes?.syncWalk(active);   // V 키 · 실내 출입 등으로 보행이 바뀌면 방식(직접 걷기 ↔ 자유 시점)도 맞춘다
    },
```

- [ ] **Step 11: `main.js` — 실내에서 나오면 방식 맞추기** — `createInterior({ … })` 인자의 `    onFloorChange: (def) => markers.setSpots(def ? interiorSpots(def) : exteriorSpotList),` 다음 줄에

```js
    onChange: (inside) => {
      if (!inside) modes?.refresh();   // 나오면 보행 여부에 맞춰 직접 걷기 · 이전 방식으로
    },
```

- [ ] **Step 12: `main.js` — 시나리오에서 인트로 빼기 · 시작 흐름** — 주석 `  // ── 시나리오 투어: 인트로 → 건물 선택 → 정면 비행 → 입장(성수 → 실내) / 준비중(몽골) ──` 을 `  // ── 가이드 투어(시나리오): 건물 선택 → 정면 비행 → 입장(성수 → 실내) / 준비중(몽골) ──` 로 바꾸고, Task 3 에서 넣은 어댑터 블록

```js
      // 인트로(+ 영화 연출): 끝까지 재생 · 건너뜀 → 건물 선택으로, 다른 동작이 끊음 → 투어 종료
      intro: async () => {
        const reason = await playIntro();
        return reason === 'cancelled' ? CANCEL : reason;
      },
```

  를 지운다. Task 3 의 `playIntro` 함수(주석 두 줄 포함, `async function playIntro() { … }` 전체)를 아래로 바꾼다

```js
  // ── 인트로: 12 초 비행(camCtrl.startIntro) + 영화식 연출(위아래 띠 · 제목 자막 · 건너뛰기 · 진행 선).
  // 끝나거나 건너뛰면 띠가 빠진 뒤(0.5 초) 이유('complete' | 'skipped' | 'cancelled')를 돌려준다.
  // holdHud: 방식 고르기가 이어지면 띠가 빠지는 동안에도 HUD 를 숨긴 채로(독이 잠깐 보였다 사라지지 않게) — 방식 고르기가 끝나며 푼다 ──
  async function playIntro({ holdHud = false } = {}) {
    const t = INTRO_TITLES[worldVer];
    const reason = await new Promise((resolve) => {
      cinema.start({ kicker: t.kicker, title: t.title, onSkip: () => camCtrl.skipIntro() });
      camCtrl.startIntro((r) => resolve(r));
    });
    if (holdHud) document.body.classList.add('is-choosing');
    await cinema.end();
    return reason;
  }

  // ── 시작 흐름: (인트로 + 연출) → (방식 고르기) → 방식 적용. 바로가기 주소는 resolveEntry 가 정한 방식으로 바로 ──
  async function runEntry() {
    if (entry.intro) await playIntro({ holdHud: !entry.mode });
    const mode = entry.mode || (await showModeMenu({ isBlocked: () => help.isOpen() || modal.isOpen() }));
    modes.set(mode);
  }
```

- [ ] **Step 13: `main.js` — 투어 시작 · 끝내기 · 방식 · 방식 전환 · 월드 전환** — `startScenario` 함수 전체

```js
  function startScenario(stepId) {
    if (interior.isActive()) return;
    modal.close();
    camCtrl.stopFlight();
    // 인트로 중 '건물 이동' · '투어 시작' → 인트로를 끝내고 건너뛰기와 같이 거리 시점(시야각 포함)으로 내려온 뒤 시작
    if (camCtrl.isIntroActive()) camCtrl.setPreset('street', true);
    // 시나리오가 시작되면 보행 시점은 해제한다(스펙 §1.1 — 보행 중 '건물 이동')
    if (camCtrl.isWalkMode()) camCtrl.setWalkMode(false);
    scenario.start(stepId).catch((err) => console.error('[nowhere] 투어 오류', err));
  }
```

  를 아래로 바꾼다

```js
  function startScenario(stepId) {
    // 실내 · 인트로 중에는 시작하지 않는다(인트로는 시나리오 밖 시작 흐름이 돌리고, 끝나면 방식 고르기로 이어진다)
    if (interior.isActive() || camCtrl.isIntroActive()) return;
    modal.close();
    camCtrl.stopFlight();
    // 시나리오가 시작되면 보행 시점은 해제한다(가이드 투어는 궤도 카메라로 비행)
    if (camCtrl.isWalkMode()) camCtrl.setWalkMode(false);
    scenario.start(stepId).catch((err) => console.error('[nowhere] 투어 오류', err));
  }

  // 가이드 투어를 끝낸다(직접 걷기 · 자유 시점으로 바꿀 때): 떠 있는 투어 질문을 닫고 비행을 멈춘다
  function endScenario() {
    if (!scenario.isRunning()) return;
    scenario.cancel();
    modal.close();
    camCtrl.stopFlight();
  }

  // ── 방식: 가이드 투어 · 직접 걷기 · 자유 시점(body[data-mode] · 상단 #nw-mode-seg) ──
  modes = createModeController({
    camCtrl,
    startGuide: () => startScenario('chooseBuilding'),
    endGuide: endScenario,
    // 실내 출입 · 층 이동 · 둘러보기가 보행을 켰다 껐다 하는 동안은 방식을 바꾸지 않는다(나오면 interior onChange → refresh)
    isSuspended: () => interior.isActive() || interior.isBusy(),
  });
  document.querySelectorAll('#nw-mode-seg [data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.blur();   // Space(보행 점프) · Enter 가 이 버튼을 다시 누르지 않게
      modes.set(btn.dataset.mode);
    });
  });

  // 월드 전환: 다른 월드를 같은 방식으로 다시 연다 — 선택 화면 · 인트로 없이 거리 시점에서(?ver=…&noIntro=1&mode=…)
  document.querySelectorAll('.nw-world-switch [data-world-ver]').forEach((btn) => {
    const isCurrent = btn.dataset.worldVer === worldVer;
    btn.classList.toggle('is-active', isCurrent);
    btn.setAttribute('aria-pressed', String(isCurrent));
    btn.addEventListener('click', () => {
      const targetVer = btn.dataset.worldVer;
      if (targetVer === worldVer) return;
      const nextParams = new URLSearchParams(window.location.search);
      nextParams.set('ver', targetVer);
      nextParams.set('noIntro', '1');
      nextParams.set('mode', modes.get() || 'free');
      nextParams.delete('cam');   // 거리 시점에서 시작(기상 · 시각은 이어 간다)
      const basePath = window.location.pathname.includes('nowhere-mountain') && targetVer === 'seongsu'
        ? '/nowhere'
        : window.location.pathname.replace(/\.html$/, '');
      window.location.href = `${basePath}?${nextParams.toString()}`;
    });
  });
```

- [ ] **Step 14: `main.js` — 옛 자동 시작 · 옛 버튼 연결 지우기** — Task 2 에서 바꾼 블록

```js
  // 인트로: 바로가기 링크(cam · weather · time) · noIntro=1 이 아니면(resolveEntry)
  if (entry.intro) {
    startScenario('intro');
  }
```

  을 지우고, 아래 세 블록(80f67da 기준 425–441행)도 지운다

```js
  if (walkBtn) {
    walkBtn.addEventListener('click', () => {
      camCtrl.setWalkMode(!camCtrl.isWalkMode());
    });
  }

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

- [ ] **Step 15: `main.js` — app · 상태 · 시작 흐름 실행** — `app` 객체의 `    startScenario,` 다음 줄에

```js
    modes,
    entry,
```

  `getStats()` 의 `        camera: camCtrl.getPresetId(),` 다음 줄에 `        mode: modes.get(),` 를 더하고, 파일 끝쪽의

```js
  window.__NW_APP = app;
  return app;
```

  를 다음으로 바꾼다

```js
  window.__NW_APP = app;
  // 시작 흐름은 렌더 루프를 돌린 채 이어 간다(인트로 · 방식 고르기를 기다리는 동안에도 화면이 그려지게)
  runEntry().catch((err) => console.error('[nowhere] 시작 흐름 오류', err));
  return app;
```

- [ ] **Step 16: 통과 확인**

Run: `node --check public/src/nowhere/main.js && node --check public/src/nowhere/scenario.js && node --test tests/nowhere-scenario.test.mjs tests/nowhere-modes.test.mjs tests/nowhere-help.test.mjs`
Expected: 문법 오류 없음, PASS (scenario 11개, modes 8개, help 6개)

- [ ] **Step 17: 전체 테스트 · 남은 참조 확인**

Run: `npm test && grep -n "walkBtn\|introBtn\|buildingsBtn\|startScenario('intro')" public/src/nowhere/main.js`
Expected: 모든 테스트 PASS(실패 0), grep 출력 없음(종료 코드 1).

- [ ] **Step 18: 브라우저 연기 시험(playwriter)** — playwriter MCP 만 쓴다(Playwright MCP 금지 — playwriter 가 실패하면 보고하고 다른 도구로 넘어가지 않는다). `state.page` 로 잡고, 페이지를 열 때마다 곧바로 `await state.page.evaluate(() => { window.__dialogs = []; window.confirm = (m) => (window.__dialogs.push(m), true); window.alert = (m) => { window.__dialogs.push(m); }; window.prompt = (m) => (window.__dialogs.push(m), null); })` 로 대화상자 함수를 바꾼다(`page.on('dialog')` 에 기대지 않는다). 기다림은 짧은 호출 여러 번으로 나누고, 각 호출 시작에 `await Promise.race([state.page.evaluate(() => 1), new Promise((r) => setTimeout(() => r('blocked'), 3000))])` 로 3 s 안에 돌아오는지 확인한다(첫 로드는 10–40 s 막힐 수 있다). 1600 × 900:
  1. `http://localhost:4173/nowhere` → 인트로 연출 → `.nw-cinema-skip` 클릭 → 약 0.6 s 뒤 `.nw-mode-menu` 가 보이고 `body.is-choosing`, 상단 바 · 하단 독 `visibility: hidden`(띠가 빠지는 사이에도 보이지 않음 — 0.1 s 간격으로 두세 번 확인). `window.dispatchEvent(new KeyboardEvent('keydown', { key: '2' }))` → 0.4 s 뒤 `getStats().mode === 'walk'`, `walkMode === true`, `document.body.dataset.mode === 'walk'`, `#nw-mode-seg [data-mode="walk"]` 가 `is-active` · `aria-pressed="true"`, `.nw-dock-camera` 가 `display: none`.
  2. `#nw-mode-seg [data-mode="free"]` 클릭 → `walkMode false`, `mode 'free'`, `.nw-dock-camera` 보임. `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', code: 'KeyV' }))` → `mode 'walk'`, 한 번 더 → `mode 'free'`.
  3. `[data-mode="guide"]` 클릭 → 「어떤 건물로 이동하시겠습니까?」 모달, `mode 'guide'`. '하우스노웨어 성수' 클릭 → 비행 중(`camCtrl.isFlying()`) `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))` → `scenarioStep === null`, `mode` 는 `'guide'` 그대로. `[data-mode="guide"]` 다시 클릭 → 모달이 다시 뜸 → '닫기'.
  4. `[data-mode="walk"]` 클릭 → 상단 `DS2 산악` 클릭 → 주소가 `/nowhere?ver=ds2&noIntro=1&mode=walk`, 새 페이지에서 `.nw-select` · 인트로 · 방식 고르기 없이 `getStats()` 가 `worldVer 'ds2'`, `mode 'walk'`, `walkMode true`.
  5. `http://localhost:4173/nowhere?noIntro=1&cam=future` → 연출 · 방식 고르기 없음, `mode 'free'`, `camera 'future'`.
  결과를 보고서에 적는다.

- [ ] **Step 19: 스테이징(커밋하지 않음) — 리뷰 통과 뒤 컨트롤러가 실행**

```bash
git add public/src/nowhere/scenario.js public/src/nowhere/main.js public/src/nowhere/nowhere.css public/index.html public/nowhere.html public/nowhere-mountain.html tests/nowhere-scenario.test.mjs tests/nowhere-modes.test.mjs tests/nowhere-help.test.mjs
```

커밋 메시지 안: `feat(nowhere): 시작 흐름 연결 — 인트로 뒤 방식 고르기, 상단 방식 전환(가이드 투어 · 직접 걷기 · 자유 시점), 투어는 건물 선택부터`

---

### Task 6: 조작 안내 · README

**Files:**
- Modify: `public/src/nowhere/help.js:10-19` (`common` 묶음 rows)
- Modify: `README.md` (1 절 주소 · 조작 표)
- Test: `tests/nowhere-help.test.mjs` ((b) 키 목록, (g) 추가)

**Interfaces:**
- Consumes: Task 4 · 5 의 키(1 · 2 · 3 · ←/→ · Enter · Esc) · 방식 이름 · 동작
- Produces: `CONTROL_SECTIONS` 공통 묶음의 새 행들(방식 전환 · 방식 고르기 · 월드 선택 · 인트로 건너뛰기)

- [ ] **Step 1: 실패하는 테스트** — `tests/nowhere-help.test.mjs` 의 `(b)` 에서 키 목록 줄을

```js
  for (const k of ['V', 'Esc', '?', 'P', 'W', 'A', 'S', 'D', 'Shift', 'Space', '↑', '↓', '←', '→', '휠', '클릭']) {
```

  에서

```js
  for (const k of ['V', 'Esc', '?', 'P', 'W', 'A', 'S', 'D', 'Shift', 'Space', '↑', '↓', '←', '→', '휠', '클릭', '1', '2', '3']) {
```

  로 바꾸고, 파일 끝에

```js
test('(g) 시작 흐름 · 방식 안내: 투어 시작 · 건물 이동 버튼 행은 없고, 방식 전환 · 방식 고르기 · 월드 선택 · 인트로 건너뛰기 행이 있다', () => {
  const rows = CONTROL_SECTIONS.flatMap((s) => s.rows);
  const descs = rows.map((r) => r.desc).join('\n');
  assert.doesNotMatch(descs, /투어 시작/);
  assert.doesNotMatch(descs, /건물 이동/);
  const modeRow = rows.find((r) => /^방식 전환/.test(r.desc));
  assert.ok(modeRow, '방식 전환 행 없음');
  assert.match(modeRow.desc, /가이드 투어 · 직접 걷기 · 자유 시점/);
  assert.match(modeRow.desc, /카메라 프리셋 버튼은 자유 시점에서만/);
  const menuRow = rows.find((r) => r.keys.join(',') === '1,2,3');
  assert.ok(menuRow, '방식 고르기(1 · 2 · 3) 행 없음');
  assert.match(menuRow.desc, /방식 고르기/);
  assert.match(descs, /월드 선택/);
  assert.match(descs, /인트로 건너뛰기/);
  assert.match(descs, /새로 고침/);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/nowhere-help.test.mjs`
Expected: FAIL — `(b)` `안내에 '1' 없음`, `(g)` `투어 시작` 이 남아 있음.

- [ ] **Step 3: `help.js` — 공통 묶음** — `common` 의 `rows: [ … ],`(현재 10–19행) 전체를 아래로 바꾼다

```js
    rows: [
      { keys: ['V'], desc: '보행 시점 켜기 / 끄기 — 방식도 직접 걷기 ↔ 자유 시점으로 함께 바뀜' },
      { keys: ['Esc'], desc: '조작 안내 · 모달 닫기 → 인트로 건너뛰기 · 건물 비행 중 가이드 투어 종료. 방식 고르기에서는 자유 시점. 보행 중에는 마우스 고정 해제 → 보행 해제' },
      { keys: ['Enter'], desc: '모달 · 월드 선택 · 방식 고르기에서 강조된(또는 포커스된) 항목 선택' },
      { keys: ['?'], desc: '조작 안내 열기 / 닫기' },
      { keys: ['P'], desc: '성능 표시(FPS · 프레임 시간 · 그리기 호출 · 삼각형 · 메모리) 켜기 / 끄기 — 키보드 없는 기기는 주소에 ?stats=1' },
      { keys: ['1', '2', '3'], desc: '방식 고르기(인트로 뒤 「어떻게 둘러볼까요?」): 1 가이드 투어 · 2 직접 걷기 · 3 자유 시점' },
      { keys: ['←', '→'], desc: '월드 선택 화면(주소 / 로 열 때 — 성수 2041 · DS2 산악)과 방식 고르기에서 포커스 이동' },
      { keys: ['클릭', '휠'], desc: '인트로 건너뛰기 — 아무 키 · 화면 클릭 · 휠 · Esc · 건너뛰기 › 버튼으로 거리 시점에 바로 내려옴. 인트로 다시 보기는 새로 고침' },
      { keys: ['클릭'], desc: '월드 전환(성수 2041 · DS2 산악 — 지금 방식 그대로 거리 시점에서), 기상(맑음 · 흐림 · 비 · 눈 — 맑음은 성수)과 시간(시각 슬라이더 · 낮 · 황혼 · 밤)을 따로 골라 조합 — 어느 시점에서나 사용' },
      { keys: ['클릭'], desc: '방식 전환(가이드 투어 · 직접 걷기 · 자유 시점): 가이드 투어는 건물 선택 → 정면 비행 → 입장(하우스노웨어 성수) · 준비중(하우스노웨어 몽골), 도착 모달에서 다른 건물로 바로 이동(성수 ↔ 몽골), 다시 누르면 건물 선택부터. 직접 걷기는 그 자리에서 보행, 자유 시점은 궤도 카메라 — 카메라 프리셋 버튼은 자유 시점에서만. 실내에서는 숨김' },
      { keys: ['클릭'], desc: '실내: 왼쪽 위 층 버튼(B1 · 1 · 12 · 13) 또는 엘리베이터 문 앞 층 선택으로 층 이동, 이 층 둘러보기(첫 볼거리로 화면 전환 후 차례로 비행, 끝나면 보행으로 복귀 · 아무 입력으로 멈춤), 밖으로 나가기 또는 1F 정문 쪽 출구' },
    ],
```

- [ ] **Step 4: README — 1 절 주소** — `README.md` 의 아래 두 줄(17–18행)을

```markdown
- **성수 2041 (기본)**: `http://localhost:4173/` 또는 `http://localhost:4173/nowhere`
- **DS2 산악 월드**: `http://localhost:4173/?ver=ds2` 또는 `http://localhost:4173/nowhere-mountain`
```

  다음으로 바꾼다

```markdown
- **월드 선택 화면**: `http://localhost:4173/` — 왼쪽 성수 2041 · 오른쪽 DS2 산악 중 하나를 고르면 로딩 → 인트로 → 방식 고르기(가이드 투어 · 직접 걷기 · 자유 시점). 새로 고침하면 다시 선택 화면
- **성수 2041 바로가기**: `http://localhost:4173/nowhere` 또는 `http://localhost:4173/?ver=seongsu` (선택 화면 없이 인트로부터)
- **DS2 산악 월드 바로가기**: `http://localhost:4173/nowhere-mountain` 또는 `http://localhost:4173/?ver=ds2`
- **방식 지정**: `mode=guide|walk|free` (예: `http://localhost:4173/?ver=ds2&noIntro=1&mode=walk` — 인트로 · 방식 고르기 없이 직접 걷기). `noIntro=1` 이나 `cam` · `weather` · `time` 이 있으면 지금처럼 인트로 없이 자유 시점
```

- [ ] **Step 5: README — 조작 표** — 아래처럼 행을 바꾼다(각 행의 앞부분이 같으면 그 행 전체를 바꾼다)
  - `| \`성수 2041\` / \`DS2 산악\` (상단 우측) | 두 월드 배경 버전 즉시 전환 |` →

```markdown
| `성수 2041` / `DS2 산악` (상단 우측) | 다른 월드로 전환 — 지금 방식 그대로 거리 시점에서 이어 감(`?ver=<월드>&noIntro=1&mode=<방식>`, 선택 화면 · 인트로 없음) |
```

  - `| \`카메라 프리셋\` (하단 우측) |` 로 시작하는 행의 왼쪽 칸만 `| \`카메라 프리셋\` (하단 우측, 자유 시점에서만) |` 로 바꾼다(오른쪽 설명은 그대로).
  - `| \`Esc\` | …` 행 →

```markdown
| `Esc` | 조작 안내 · 모달 닫기 → 인트로 건너뛰기 · 건물 비행 중 가이드 투어 종료. 방식 고르기에서는 자유 시점. 보행 시점 중에는 마우스 고정 해제 → 보행 시점 해제(자유 시점) |
```

  - `| \`Enter\` | 모달에서 강조된(또는 포커스된) 버튼 선택 |` →

```markdown
| `Enter` | 모달 · 월드 선택 · 방식 고르기에서 강조된(또는 포커스된) 항목 선택 |
```

  - `| \`V\` / \`보행 시점\` 버튼 | 지면 위 1.7 m 눈높이 보행 시점 토글.` 를 `| \`V\` / \`직접 걷기\` 버튼 | 지면 위 1.7 m 눈높이 보행 시점 토글(방식도 직접 걷기 ↔ 자유 시점으로 함께 바뀜).` 로 바꾼다(그 행의 나머지는 그대로).
  - `| \`투어 시작\` 버튼(첫 방문 시 자동) | …` 행과 `| \`건물 이동\` 버튼 | 건물 선택 모달부터 다시 시작 |` 행을 지우고 그 자리에 네 행을 넣는다

```markdown
| 월드 선택 화면(`/`) | 화면을 반씩 — 왼쪽 성수 2041 · 오른쪽 DS2 산악(세로 화면은 위 · 아래). 마우스를 올리거나 `←`/`→` 로 포커스하면 그쪽이 넓어지고 밝아짐, 클릭 · 탭 · `Enter` 로 들어가기(고른 면이 펼쳐진 뒤 같은 이미지 위 로딩). 고르기 전에는 3D 월드를 받지 않음 |
| 인트로 | 12 초 비행을 영화식으로(위아래 검은 띠 · 제목 자막 · 진행 선). `건너뛰기 ›` · 화면 클릭 · 휠 · 아무 키 · `Esc` 로 거리 시점에 바로 내려옴. 다시 보려면 새로 고침 |
| 방식 고르기(인트로 뒤) | 「어떻게 둘러볼까요?」 — `1` 가이드 투어 · `2` 직접 걷기 · `3` 자유 시점(클릭 · 탭, `←`/`→` 포커스 · `Enter` 선택, `Esc` 자유 시점) |
| `가이드 투어` · `직접 걷기` · `자유 시점` (상단 방식 전환) | 가이드 투어: 「어떤 건물로 이동하시겠습니까?」(하우스노웨어 성수 · 하우스노웨어 몽골) → 건물 정면 비행 → 성수: 「입장하시겠습니까?」 예 → 실내 1F 로비 / 몽골: 「준비중입니다」, 도착 모달에서 `하우스노웨어 몽골로 이동` · `하우스노웨어 성수로 이동` 으로 다른 건물 정면으로 바로 비행, 다시 누르면 건물 선택부터. 직접 걷기: 그 자리에서 보행 시점(이동 스팟 · 보행 안내). 자유 시점: 궤도 카메라 — 카메라 프리셋 버튼은 자유 시점에서만 보임. 실내에서는 숨김(나오면 보행 여부에 맞춰 직접 걷기 · 이전 방식) |
```

- [ ] **Step 6: 통과 확인**

Run: `node --test tests/nowhere-help.test.mjs && npm test`
Expected: help 7개 PASS, 전체 실패 0

- [ ] **Step 7: 브라우저 연기 시험(playwriter)** — playwriter MCP 만 쓴다(Playwright MCP 금지 — playwriter 가 실패하면 보고하고 다른 도구로 넘어가지 않는다). `state.page` 로 잡고, 페이지를 열 때마다 곧바로 `await state.page.evaluate(() => { window.__dialogs = []; window.confirm = (m) => (window.__dialogs.push(m), true); window.alert = (m) => { window.__dialogs.push(m); }; window.prompt = (m) => (window.__dialogs.push(m), null); })` 로 대화상자 함수를 바꾼다(`page.on('dialog')` 에 기대지 않는다). 기다림은 짧은 호출 여러 번으로 나누고, 각 호출 시작에 `await Promise.race([state.page.evaluate(() => 1), new Promise((r) => setTimeout(() => r('blocked'), 3000))])` 로 3 s 안에 돌아오는지 확인한다(첫 로드는 10–40 s 막힐 수 있다). `http://localhost:4173/nowhere?noIntro=1` 에서 `window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }))` → `.nw-help` 가 보이고 `document.querySelector('.nw-help').textContent` 에 `방식 전환(가이드 투어 · 직접 걷기 · 자유 시점)` · `인트로 건너뛰기` 가 있으며 `투어 시작` 이 없다. `Escape` 로 닫는다. 결과를 보고서에 적는다.

- [ ] **Step 8: 스테이징(커밋하지 않음) — 리뷰 통과 뒤 컨트롤러가 실행**

```bash
git add public/src/nowhere/help.js README.md tests/nowhere-help.test.mjs
```

커밋 메시지 안: `docs(nowhere): 조작 안내 · README — 월드 선택 · 인트로 건너뛰기 · 방식 고르기 · 방식 전환`

---

### Task 7: 브라우저 확인 · 이미지 구도 · 예산 · 성능

**Files:**
- Modify (구도가 나쁠 때만): `public/src/nowhere/world-select.js` 의 `WORLD_CARDS[].image` 와 `public/src/nowhere/nowhere.css` 의 `body[data-world-ver=…] .nw-loader` url 을 함께(후보 `hero-street` 로) — `tests/nowhere-world-select.test.mjs` (b)(c) 가 일관성을 확인한다
- 캡처: `build/nowhere/compare/entry-*.png`(git 이 무시하는 `build/`)

**Interfaces:**
- Consumes: Task 1–6 전부
- Produces: 보고서의 측정값 · 캡처 경로, (바꿨다면) 이미지 선택

- [ ] **Step 1: 준비** — 서버 :4173 확인(`lsof -i :4173`, 없으면 `npm start` 백그라운드). playwriter MCP 만 쓴다(`mcp__playwriter__execute` · `mcp__playwriter__reset`; Playwright MCP 금지, playwriter 가 실패하면 보고하고 다른 도구로 넘어가지 않는다). `state.page = await context.newPage()` 로 잡고 이후 모든 단계는 `state.page` 를 쓴다. 페이지를 열 때마다(새로 고침 · 월드 전환 포함) 곧바로

```js
await state.page.evaluate(() => { window.__dialogs = []; window.confirm = (m) => (window.__dialogs.push(m), true); window.alert = (m) => { window.__dialogs.push(m); }; window.prompt = (m) => (window.__dialogs.push(m), null); });
```

  를 실행한다(`page.on('dialog')` 에 기대지 않는다). 기다림은 짧은 호출 여러 번으로 나누고, 각 호출 시작에

```js
console.log(await Promise.race([state.page.evaluate(() => Boolean(window.__NW_APP)), new Promise((r) => setTimeout(() => r('blocked'), 3000))]));
```

  로 3 s 안에 돌아오는지 확인한다(`'blocked'` 면 첫 로드 중이거나 대화상자 — 첫 로드는 10–40 s 막힐 수 있으니 몇 번 더 짧게 확인하고, 계속 막히면 보고). 캡처는 `state.page.screenshot({ path: '/Users/gm_yeonho/new-work/so/so-viewer-monster1267/build/nowhere/compare/entry-<이름>.png' })`(절대 경로, 막히면 `/tmp` 에 저장 후 Bash `mv`). 전원 상태를 Bash 로 적어 둔다: `pmset -g batt` · `ps -A -o %cpu,comm | sort -rn | head`.

- [ ] **Step 2: 선택 화면(1600 × 900)** — `setViewportSize({ width: 1600, height: 900 })` · `http://localhost:4173/`:
  1. 받은 자원: `performance.getEntriesByType('resource').map((e) => e.name.replace(location.origin, '')).filter((n) => /\.(glb|hdr|webp|json|ktx2)(\?|$)/.test(n))` → 선택 화면 이미지 두 장뿐(`.glb` · `.hdr` · `layout.json` 없음), `window.__NW_APP === undefined`.
  2. 0.7 s 뒤 면 폭 `[...document.querySelectorAll('.nw-select-pane')].map((p) => Math.round(p.getBoundingClientRect().width))` ≈ `[960, 640]`, 첫 포커스 성수. 캡처 `entry-select-1600.png`.
  3. `document.querySelector('[data-world="ds2"]').dispatchEvent(new MouseEvent('mouseenter'))` → 0.7 s 뒤 ≈ `[640, 960]`, DS2 배경 `transform` 이 1 보다 커지는 중(`getComputedStyle(document.querySelector('[data-world="ds2"] .nw-select-bg')).transform`). 캡처 `entry-select-hover-ds2-1600.png`.
  4. 두 캡처를 보고 이미지 구도를 판단한다 — 40 % 폭에서도 볼거리(성수: 골목 · 타워 · 스카이브리지 / 산악: V자 계곡)가 남는지, 문구가 읽히는지. 나쁘면 그 월드를 후보 `hero-street` 로 바꾸고(Files 참조) `npm test` 후 다시 잰다. 판단 · 바꾼 값을 보고서에 적는다.
  5. DS2 면 클릭 → 0.3 s 안에 `.nw-select.is-picked`, 고른 면 폭이 1600 으로 늘어남, 로더 배경에 `hero-valley`(또는 바꾼 이미지). 로딩 중 캡처 `entry-loader-ds2-1600.png`.

- [ ] **Step 3: 인트로 · 방식 고르기(1600 × 900, DS2 계속)** — 로드가 끝나면:
  1. 연출: `.nw-cinema` `is-on`, 아래 띠 높이 99 px, 상단 바 · 하단 독 `visibility: hidden`, 약 2 s 에 `.nw-cinema-heading` 이 `HAUS NOWHERE — DS2 산악 고원` · `.nw-cinema-kicker` 가 `HIGHLAND BASIN · DS2 MOUNTAIN WORLD`, 진행 선 `scaleX` 가 늘어남, 5.5 s 뒤 `is-title` 없음. 캡처 `entry-cinema-ds2-1600.png`(2.5 s 쯤).
  2. 인트로 중 FPS: 2 s 씩 다섯 번 `await state.page.evaluate(async () => { const xs = []; for (let i = 0; i < 4; i++) { await new Promise((r) => setTimeout(r, 500)); xs.push(__NW_APP.getStats().fps); } return xs; })` — 12 s 안에 끝나지 않으면 남은 표본은 Step 6 에서 성수로 잰다. 기준 ≥ 60.
  3. 끝까지 보거나(12 s) 화면 클릭(`state.page.mouse.click(800, 450)`)으로 건너뛰기 → `introActive false` · `camera 'street'`, 띠가 빠지는 0.5 s 동안 상단 바 `visibility: hidden` 유지, 그 뒤 `.nw-mode-menu` 와 제목 「어떻게 둘러볼까요?」, 첫 포커스 가이드 투어(`.nw-mode-card.is-focus` 의 `dataset.mode === 'guide'`). 캡처 `entry-menu-ds2-1600.png`.
  4. 방식 고르기 동안 예산: 같은 거리 시점에서 `getStats().calls` · `triangles` 를 세 번 → `Escape` 로 자유 시점 → 0.5 s 뒤 다시 세 번. 메뉴 유무로 값이 같아야 한다(이동체 때문에 흔들리면 범위가 겹치는지). `mode === 'free'`, `.nw-dock-camera` 보임.

- [ ] **Step 4: 세 방식 · 투어 · 실내 · 월드 전환(성수, 1600 × 900)** — `http://localhost:4173/nowhere`:
  1. 인트로 중 `Escape` 이벤트(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`) → 건너뛰기 → 방식 고르기 → `1` → 0.4 s 뒤 「어떤 건물로 이동하시겠습니까?」 · `mode 'guide'` · `.nw-dock-camera` 숨김. 캡처 `entry-guide-1600.png`.
  2. '하우스노웨어 성수' → 도착 「입장하시겠습니까?」 → '예' → 실내 1F: `body.is-interior`, `#nw-mode-seg` `display: none`, `walkMode true`, `mode` 는 여전히 `'guide'`. `await __NW_APP.interior.exit()` → 외관, `mode 'walk'`(걸으며 나옴), `#nw-mode-seg` 보임.
  3. `[data-mode="free"]` 클릭 → `walkMode false` · `mode 'free'`. `[data-mode="walk"]` → `walkMode true`, 보행 안내 · 스팟 마커(`.nw-spots`) 보임. 캡처 `entry-walk-1600.png`. `V` 키 이벤트 → `mode 'free'`. 캡처 `entry-free-1600.png`.
  4. `[data-mode="walk"]` → 상단 `DS2 산악` 클릭 → 주소 `…?ver=ds2&noIntro=1&mode=walk`(cam 없음), 새 페이지에서 선택 화면 · 연출 · 방식 고르기 없음, `worldVer 'ds2'` · `mode 'walk'` · `walkMode true`. 그 페이지에서 `성수 2041` 클릭 → `/nowhere?ver=seongsu&noIntro=1&mode=walk` 로 같은 확인.

- [ ] **Step 5: 바로가기 · 기존 캡처 주소** — 각 주소에서 `.nw-select` 없음 · `.nw-cinema` `hidden` · `.nw-mode-menu` 없음 · 상단 바 보임 · 아래 값:
  - `/nowhere?noIntro=1&cam=future&time=14` → `mode 'free'`, `camera 'future'`(README 히어로 캡처 절차 주소)
  - `/?cam=aerial&time=21.5` → `worldVer 'seongsu'`, `mode 'free'`, `camera 'aerial'`
  - `/?ver=ds2&noIntro=1&cam=lot&weather=rain&time=21:30` → `worldVer 'ds2'`, `weather 'rain'`, `camera 'lot'`
  - `/nowhere-mountain` → 선택 화면 없이 연출(제목 `HAUS NOWHERE — DS2 산악 고원`) → 방식 고르기
  - `/?ver=seongsu` → 선택 화면 없이 성수 연출
  - `/?mode=walk` → 선택 화면 없이 성수 연출 → 끝나면 방식 고르기 없이 `mode 'walk'`
  결과를 표로 적는다.

- [ ] **Step 6: 390 × 844(모바일 등급 자동)** — `setViewportSize({ width: 390, height: 844 })` · `http://localhost:4173/`:
  1. 선택 화면이 위 · 아래로 나뉨(두 면 폭 390, 0.7 s 뒤 높이 ≈ `[506, 337]` — 성수 포커스), 문구가 잘리지 않음. 캡처 `entry-select-390.png`. 아래(DS2) 면 탭(`state.page.mouse.click(195, 700)`) → 로딩 캡처 `entry-loader-390.png`, `getStats().tier === 'mobile'`.
  2. 연출: 띠 높이 93 px(11vh), `.nw-cinema-skip` 의 `getBoundingClientRect().height` ≥ 44. 캡처 `entry-cinema-390.png`. 건너뛰기 버튼 클릭.
  3. 방식 고르기: 세 카드가 세로로 쌓이고 각 높이 ≥ 44, 화면 안에 다 들어옴(마지막 카드 `bottom` ≤ 844). 캡처 `entry-menu-390.png`. 직접 걷기 카드 탭 → `mode 'walk'`.
  4. 상단 바: `document.querySelector('.nw-top-actions').scrollWidth <= clientWidth`(가로 넘침 없음), 방식 전환 버튼 세 개 보임. 캡처 `entry-walk-390.png`.
  5. 인트로 중 FPS(2 s 씩 표본, Step 3-2 와 같은 방식) — `/nowhere?tier=mobile` 로 다시 열어 잰다. 기준 ≥ 60.

- [ ] **Step 7: 예산 · 성능 · DS2 모습** —
  1. 모바일 조감 최악값: `/nowhere?noIntro=1&cam=aerial&tier=mobile` 에서 `getStats().calls` · `triangles` 세 번 → `__NW_APP.cinema.start({ kicker: 'x', title: 'y' })` 로 연출을 띄운 채 세 번 → `await __NW_APP.cinema.end()`. 두 값이 같고 예산(180 그리기 · 900,000 삼각형) 안이어야 한다(보행 이동 스팟 계획 기록값 178 · 898,927 과 비교해 적는다).
  2. 데스크톱 FPS: `/nowhere` 성수 인트로 + 방식 고르기 표시 중 각각 10 s(2 s × 5) 평균, `&tier=mobile` 도 같게. 기준 ≥ 60. 전원(`pmset -g batt` — 배터리면 그 사실을 함께) · 다른 프로세스 부하(`ps -A -o %cpu,comm | sort -rn | head`)를 같이 적는다.
  3. DS2 모습 그대로: `git diff --stat main -- public/src/nowhere/world.js public/src/nowhere/weather.js public/src/nowhere/post.js public/src/nowhere/sky.js public/src/nowhere/surface.js public/assets` → 출력 없음. `/nowhere-mountain?noIntro=1&cam=street` 캡처 `entry-ds2-street-1600.png`(1600 × 900).

- [ ] **Step 8: 테스트 · 스테이징**

Run: `npm test`
Expected: 모든 테스트 PASS (실패 0)

이미지를 바꿨을 때만(리뷰 통과 뒤 컨트롤러가 실행):

```bash
git add public/src/nowhere/world-select.js public/src/nowhere/nowhere.css
```

(바꾸지 않았으면 스테이징할 것이 없다.) 커밋 메시지 안: `tune(nowhere): 월드 선택 · 로딩 화면 이미지 구도 조정`

- [ ] **Step 9: 보고서** — 측정표(경로별 select · world · intro · mode 결과, 선택 화면 받은 자원, 면 폭 · 높이, 띠 높이, 건너뛰기 버튼 크기, calls · triangles 전후, FPS · 전원 · 부하), 이미지 판단(바꿨으면 전 · 후), 캡처 경로 목록, 사용자 확인이 필요한 항목(아이패드 실기기 탭 · 세로 회전, 실제 휠 · 터치로 인트로 건너뛰기, `prefers-reduced-motion` 켠 기기에서 선택 화면).
