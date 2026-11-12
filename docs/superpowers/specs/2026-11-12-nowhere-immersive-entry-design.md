# HAUS NOWHERE — 몰입형 시작 흐름 설계 스펙

- **작성일**: 2026-11-12
- **기반**: 성수 2041 · DS2 산악 월드 뷰어(`public/index.html` · `nowhere.html` · `nowhere-mountain.html`, `public/src/nowhere/`), 보행 이동 스팟(`2026-11-12-nowhere-walk-spots-design.md`)
- **목표**: 처음 들어오는 사람이 버튼 바부터 보지 않고, 월드를 고르고 → 영화 같은 인트로를 보고 → 둘러볼 방식을 골라 그대로 이어 가게 한다.

## 0. 확정된 결정

| 항목 | 결정 |
|---|---|
| 흐름 | 월드 선택 → 로딩 → 인트로 → 방식 고르기 → 가이드 투어 · 직접 걷기 · 자유 시점 |
| 월드 선택 화면 | 일반 주소(`/`)로 열 때마다. 왼쪽 성수 2041 · 오른쪽 DS2 산악, 큰 배경 이미지 |
| 월드별 바로가기 | `/nowhere` = 성수 2041, `/nowhere-mountain` = DS2 산악, `/?ver=seongsu|ds2` — 선택 화면 없이 인트로부터 |
| 인트로 | 지금의 12초 인트로 비행을 실시간으로, 영화식 연출(위아래 검은 띠 · 제목 자막 · 건너뛰기 · 진행 선). 영상 파일은 만들지 않는다 |
| 방식 이름 | 가이드 투어(GUIDED TOUR) · 직접 걷기(WALK) · 자유 시점(FREE VIEW) |
| 상단 버튼 | '투어 시작' · '건물 이동' · '보행 시점' 을 없애고 방식 전환 버튼 하나(`가이드 투어 | 직접 걷기 | 자유 시점`)로. 인트로 다시 보기는 새로 고침 |
| 방식별 화면 | 카메라 시점 버튼은 자유 시점에서만. 기상 · 시간 · 월드 전환 · 조작 안내는 항상 |
| 렌더 비용 | 0 (선택 화면 · 인트로 연출 · 방식 카드는 DOM) |

## 1. 시작 결정 (`entry.js` 의 `resolveEntry`, 순수)

입력: URL 검색 매개변수, 페이지 기본 월드(`window.__NW_DEFAULT_WORLD`: `index.html` 없음, `nowhere.html` `'seongsu'`, `nowhere-mountain.html` `'ds2'`).
출력: `{ select: boolean, world: 'seongsu'|'ds2'|null, intro: boolean, mode: 'guide'|'walk'|'free'|null }` — `mode` 가 `null` 이면 인트로 뒤 방식 고르기를 띄운다.

| 규칙 | 값 |
|---|---|
| 바로가기 링크 `deep` | `cam` · `weather` · `time` 중 하나라도 있으면 true |
| `world` | `ver` 가 `seongsu` · `ds2` 면 그것, 아니면 기본 월드, 둘 다 없으면 `null` |
| `select` | `world === null` 이고 `deep` · `noIntro=1` · `mode` 가 모두 없을 때만 true |
| `world` 보정 | `select` 가 false 인데 `world` 가 `null` 이면 `'seongsu'` |
| `intro` | `deep` 이 아니고 `noIntro` 가 `'1'` 이 아닐 때 true |
| `mode` | `mode` 매개변수가 `guide` · `walk` · `free` 면 그것, 아니면 `deep` 이거나 `noIntro=1` 이면 `'free'`, 그 밖은 `null` |

- 기존 캡처 · 테스트 주소(`?cam=…`, `?noIntro=1&cam=future` 등)는 지금처럼 그 시점 · 자유 시점으로 바로 들어간다.
- 선택 화면에서 고른 뒤에는 `{ world: 고른 것, intro: true, mode: null }` 로 이어 간다. 주소는 바꾸지 않는다(새로 고침하면 다시 선택 화면).

## 2. 월드 선택 화면 (`world-select.js`)

- 화면을 세로로 반씩: 왼쪽 성수 2041, 오른쪽 DS2 산악. 각 면은 대표 렌더(`assets/nowhere/renders/hero-*.webp`, `assets/nowhere-ds2/renders/hero-*.webp`) 한 장을 가득 채운다. 어느 렌더를 쓸지는 구현 중 화면을 보고 고른다(후보: 성수 `hero-future` · `hero-street`, 산악 `hero-valley` · `hero-street`).
- 각 면 문구(아래쪽 정렬): 작은 영문(`SEONGSU · 2041` / `CHIRAL HIGHLAND · DS2`), 큰 제목(`성수 2041` / `DS2 산악 고원`), 한 줄 설명, `들어가기 →`. 화면 위 가운데에 `HAUS NOWHERE`.
- 마우스 올림 · 포커스: 그쪽 면이 60 % 로 넓어지고 밝아지며 배경이 천천히 확대(8 초에 1.0 → 1.06), 다른 쪽은 40 % · 어둡게. 전환 0.6 초.
- 조작: 클릭 · 탭, ←/→ 로 포커스 이동, Enter 로 들어가기. 첫 포커스는 왼쪽(성수).
- 세로 화면(가로 < 세로, 폭 ≤ 720 px)은 위 · 아래로 나눈다.
- 이 화면 동안에는 3D 월드를 받지 않는다(이미지 두 장만). `prefers-reduced-motion` 이면 확대 · 넓어짐 애니메이션을 끈다.
- 고르면 고른 면이 화면 전체로 0.6 초 동안 펼쳐지고 로딩으로 넘어간다.

## 3. 로딩

- 기존 로더(`.nw-loader`)의 배경을 고른 월드의 같은 렌더 이미지로(어둡게 덮고), 제목 · 진행 막대는 아래쪽에. 바로가기 주소로 들어와도 그 월드 이미지로 보인다.
- 문구 · 진행률 계산은 지금과 같다.

## 4. 인트로 연출 (`cinema.js`)

- 인트로 비행(`camCtrl.startIntro`)과 함께 시작. `body.is-cinema` 동안 상단 바 · 하단 독 · 보행 안내 · 성능 표시 외 HUD 를 숨긴다.
- 위아래 검은 띠: 높이 `max(48px, 11vh)`, 0.6 초에 들어온다.
- 제목 자막: 1.0 초에 나타나 5.0 초에 사라진다. 작은 글씨 = 좌표(성수 `37.544°N 127.056°E`, 산악 기존 브랜드 문구), 큰 글씨 = `HAUS NOWHERE — 성수 2041` / `HAUS NOWHERE — DS2 산악 고원`.
- 아래 띠 오른쪽에 `건너뛰기 ›` 버튼, 아래 띠 위 가장자리에 얇은 진행 선(인트로 경과 / 12 초).
- 건너뛰기: 버튼 · 화면 클릭 · 휠 · 아무 키(지금의 인트로 끼어들기 그대로) · Esc. 건너뛰면 거리 시점으로 바로 내려온다(지금과 같음).
- 끝나거나 건너뛰면 띠가 0.5 초에 빠지고 방식 고르기가 뜬다(`mode` 가 정해져 있으면 그 방식으로 바로).

## 5. 방식 고르기 (`mode-menu.js`)

- 인트로가 끝난 거리 시점의 실제 화면 위, 아래쪽 가운데에 제목 「어떻게 둘러볼까요?」와 카드 세 장. 화면 아래쪽만 옅게 어둡게.

| 카드 | 영문 | 설명 |
|---|---|---|
| 가이드 투어 | GUIDED TOUR | 두 건물과 실내를 차례로 안내합니다 |
| 직접 걷기 | WALK | 눈높이로 걸으며 ◇ 스팟을 따라 이동합니다 |
| 자유 시점 | FREE VIEW | 카메라를 돌리고 확대하며 원하는 시점에서 봅니다 |

- 조작: 클릭 · 탭, 1 · 2 · 3, ←/→ 포커스, Enter = 포커스된 카드(첫 포커스 가이드 투어), Esc = 자유 시점. 세로 화면은 카드를 세로로 쌓는다.
- 고르면 0.3 초에 사라지고 그 방식을 적용한다.

## 6. 방식 (`modes.js`)

- 상태 하나 `mode ∈ { guide, walk, free }` 를 `body[data-mode]` 와 상단 방식 전환 버튼(`#nw-mode-seg`)에 반영한다.

| 방식 | 적용 | 화면 |
|---|---|---|
| 가이드 투어 | 보행을 끄고 투어를 건물 선택부터 시작(`startScenario('chooseBuilding')`) → 정면 비행 → 입장 질문(지금 흐름). 이미 가이드 투어일 때 버튼을 다시 누르면 건물 선택을 다시 연다. 투어가 끝나도 방식은 가이드 투어로 남는다(그 자리에서 궤도 카메라) | 카메라 시점 버튼 숨김 |
| 직접 걷기 | 그 자리에서 보행 켜기(이동 스팟 · 보행 안내) | 카메라 시점 버튼 숨김 |
| 자유 시점 | 보행 끄기, 진행 중인 투어 끝내기, 궤도 카메라 | 카메라 시점 버튼 보임 |

- V 키 · 실내 출입 등으로 보행이 켜지면 방식은 직접 걷기, 꺼지면(가이드 투어 진행 중이 아닐 때) 자유 시점으로 맞춘다. 버튼 표시도 함께 바뀐다.
- 실내(`body.is-interior`)에서는 방식 전환 버튼을 숨긴다(층 버튼 · 둘러보기 · 나가기를 쓴다). 나오면 보행 여부에 맞춰 직접 걷기 · 이전 방식으로.
- 월드 전환 버튼: `?ver=<다른 월드>&noIntro=1&mode=<지금 방식>` 으로 다시 열어 선택 화면 · 인트로 없이 같은 방식으로 이어 간다(거리 시점에서 시작).

## 7. 투어 흐름 정리

- `scenario.js` 의 `intro` 단계를 없애고 시작을 `chooseBuilding` 으로. 인트로는 시나리오 밖(`main.js` 시작 흐름)에서 돈다.
- Esc 처리: 인트로 중 Esc 는 건너뛰기, 건물 비행 중 Esc 는 지금처럼 투어 끝내기.
- '투어 시작' · '건물 이동' · '보행 시점' 버튼과 연결 코드를 지운다(가이드 투어 · 직접 걷기 버튼이 대신한다). V 키는 그대로.

## 8. 모듈 구성

| 모듈 | 하는 일 |
|---|---|
| `entry.js` (새, 순수) | `resolveEntry(params, defaultWorld)` |
| `world-select.js` (새) | `showWorldSelect() → Promise<'seongsu'|'ds2'>` (DOM) |
| `cinema.js` (새) | `createCinema()` → `start({ kicker, title, onSkip })`, `progress(u)`, `end()` |
| `mode-menu.js` (새) | `MODES`(순수 데이터) · `showModeMenu() → Promise<mode>` |
| `modes.js` (새) | `createModeController({ camCtrl, startGuide, endGuide })` → `set(mode)`, `get()`, `syncWalk(active)` |
| `camera.js` | `skipIntro()` 공개(지금의 인트로 끼어들기와 같은 동작), `getIntroProgress()` |
| `scenario.js` | `intro` 단계 제거, 시작 `chooseBuilding` |
| `main.js` | 시작 흐름: `resolveEntry` → (선택 화면) → 월드 생성 · 로딩 → (인트로 + 연출) → (방식 고르기) → 방식 적용. 상단 버튼 교체 |
| `index.html` · `nowhere.html` · `nowhere-mountain.html` | 상단 버튼 교체, `nowhere.html` 에 `__NW_DEFAULT_WORLD = 'seongsu'` |
| `nowhere.css` | 선택 화면 · 로더 배경 · 영화 띠 · 방식 카드 · 방식 전환 버튼 · `body[data-mode]` 표시 규칙 |
| `help.js` · `README.md` | 조작 안내 갱신(투어 시작 · 건물 이동 · 보행 시점 버튼 행 → 방식 전환 · 선택 화면 · 인트로 건너뛰기) |

## 9. 예산 · 성능

- 그리기 · 삼각형 추가 0. FPS ≥ 60 유지.
- 선택 화면에서 받는 것은 이미지 두 장뿐. 월드 자산은 고른 뒤 받는다(지금 첫 로딩과 같은 양).

## 10. 테스트 · 확인

- `tests/nowhere-entry.test.mjs`: `resolveEntry` 표 — `/`(선택), `/nowhere`(성수 · 인트로 · 방식 고르기), `/nowhere-mountain`(산악), `?ver=ds2`, `?cam=future`(자유 시점 · 인트로 없음), `?noIntro=1`, `?ver=ds2&noIntro=1&mode=walk`, 잘못된 `ver` · `mode` 값.
- `tests/nowhere-mode-menu.test.mjs`: `MODES` 이름 · 영문 · 설명 · 순서, 키 매핑(1 · 2 · 3 · Esc).
- `tests/nowhere-scenario.test.mjs`: 시작이 `chooseBuilding`, `intro` 단계 없음, 검증 통과.
- `tests/nowhere-help.test.mjs`: 안내에서 '투어 시작' · '건물 이동' 제거, 방식 전환 · 인트로 건너뛰기 행.
- 브라우저(playwriter): 1600 × 900 · 390 × 844 에서 선택 화면 · 로딩 · 인트로(연출 · 건너뛰기) · 방식 고르기 · 세 방식 · 월드 전환 · 바로가기 주소 · 기존 캡처 주소. 그리기 횟수 · FPS. 캡처 `build/nowhere/compare/entry-*.png`.

## 11. 범위 밖

- 미리 찍은 인트로 영상 파일, 선택 화면의 실시간 3D 미리보기, 인트로 다시 보기 버튼, 첫 방문 기억(localStorage).
- 가이드 투어에서 실내 층 둘러보기를 자동으로 이어 붙이기(지금처럼 실내에서는 '이 층 둘러보기' 버튼).
