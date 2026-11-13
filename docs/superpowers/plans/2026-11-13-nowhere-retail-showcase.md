# 리테일 진열 · 제품 감상 모드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 두 허브(성수 2041 · 산악)에서 들어가는 HAUS 실내 1F 로비에 선글라스 3종(Kant · Folding Tarx · Veggie Oat)을 받침대 · 유리 덮개에 실제 크기로 진열하고, 고르면(클릭 · 탭 · 조준점 · 이름표 · 제품 스팟 도착) 제품 하나만 스튜디오 무대에 띄워 돌려 보고 확대하는 감상 모드를 연 뒤, 나가면 연 자리 · 시선 · 보행 그대로 돌아오게 한다.

**Architecture:** 저장소 밖 사내 원본 GLB 를 `npm run nowhere:products`(gltf-transform CLI 4.1.1 + JSON 청크만 고치는 작은 노드 스크립트)로 `public/assets/products/<id>.glb`(감상) · `<id>-lite.glb`(진열 · 휴대폰)로 만들고, 목록 · 진열 자리는 `products.json` 하나에 둔다. 순수 모듈 `products.js` 가 목록 검증 · 층 진열 · 제품 스팟 · 정보 문구 · 이전 · 다음 · 감상 키 · 무대 거리를 맡고, `retail-display.js` 가 층 진열(받침대 + 발광 판 1 그리기 · 덮개 1 그리기 · 제품 lite)을 런타임으로 만들어 `interior.js` 층 장면 · 점유 격자에 붙인다. `showcase.js` 는 따로 띄운 스튜디오 장면(RoomEnvironment PMREM · 조명 3개 · 그라데이션 원판 · 자체 OrbitControls)이고, 감상 중에는 `main.js` 렌더 루프가 외관 · 실내 · 후처리 대신 이 장면만 그린다. 진입 · 복원(위치 · 시선 · 보행)은 `main.js` 가 맡는다.

**Tech Stack:** three.js r170(ES 모듈 + importmap, 빌드 없음 — `three/addons/controls/OrbitControls.js` · `environments/RoomEnvironment.js` · `utils/BufferGeometryUtils.js` · `loaders/GLTFLoader.js` · `libs/meshopt_decoder.module.js`), `@gltf-transform/cli@4.1.1`(npx — prune · optimize: palette · join · weld · meshopt 단순화 · WebP · meshopt 압축), Node 22 `node --test`, playwriter MCP(브라우저 확인), `npm start`(정적 서버 :4173, `public/`).

**Spec:** `docs/superpowers/specs/2026-11-13-nowhere-retail-showcase-design.md`

## Global Constraints

- **기준 문서:** 스펙이 기준이다. 이 계획 §1 의 "정한 것"은 스펙의 빈칸을 채운 값이고, CP(Task 6) 뒤에는 조정한 값(products.json · 상수)이 기준이다. 바꾼 값은 보고서에 전 · 후로 적는다.
- **진열 위치 · 감상 방식:** 진열은 1F 로비(실내 첫 층). 감상은 따로 띄운 스튜디오 무대(실내 장면 대신 그린다).
- **제품 설명:** "이름 · 실측 크기 · 재질만. 공식 설명 · 컬렉션 · 컬러명은 받을 때까지 비운다(추측해서 쓰지 않는다)". `products.json` 의 `description` · `collection` · `color` 는 `""`, 빈 문자열 필드는 화면에 나오지 않는다. 제품 문구를 지어 쓰지 않는다.
- **제품 · 원본:** Kant · Folding Tarx · Veggie Oat(선글라스, 실제 크기). 원본 `/Users/gm_yeonho/new-work/xr-editor/public/assets/{Kant,Folding_Tarx,Veggie_Oat}.glb`(PNG 텍스처, 미압축, 환경 변수 `PRODUCT_SRC` 로 폴더를 바꿀 수 있음). `compressed/` 판(KTX2)은 쓰지 않는다(뷰어에 KTX2 로더 없음). 원본은 커밋하지 않고 결과만 `public/assets/products/` 에 둔다.
- **에셋 상한(그대로 쓴다, 1 MB = 1024 × 1024 B — 저장소 자산 테스트 관례):**

  | 파일 | 쓰임 | 삼각형 | 텍스처 | 목표 크기 |
  |---|---|---|---|---|
  | `products/<id>.glb` | 데스크톱 · 태블릿 감상 모드 | ≤ 80 K | ≤ 1024, WebP | ≤ 3 MB |
  | `products/<id>-lite.glb` | 진열(모든 등급) · 휴대폰 감상 모드 | ≤ 20 K | ≤ 512, WebP | ≤ 0.8 MB |

  `KHR_texture_basisu` 등 뷰어가 못 읽는 확장은 결과에 남기지 않는다. 투명 재질(렌즈 · 코받침)의 알파 모드는 유지한다. 결과에 `WorldGridMaterial` 없음. 경계 상자는 원본 실측과 ±2 mm.
- **렌더 예산:** 1F 진열 그리기 ≤ +12, 삼각형 ≤ +70 K(받침대 · 덮개 합쳐 그리기 2 + 제품 lite 3 점). 감상 모드는 실내 · 외관 · 후처리를 그리지 않는다. 실내 진입 추가 다운로드: lite 3 점 ≤ 2.4 MB(데스크톱 · 모바일 공통), 고해상도는 감상 모드에서만.
- **성능:** FPS ≥ 60(1F 보행 · 감상 모드, 데스크톱 · `&tier=tablet`, 전원 연결 — `pmset -g batt` 로 확인).
- **진열 값(그대로 쓴다):** 받침대 3개 일렬, 간격 약 2.5 m, 정문 진입 동선 옆, 기존 전시물 · 둘러보기 지점 · 엘리베이터 · 출구 영역과 1.5 m 이상. 받침대 폭 0.5 · 높이 1.05 · 깊이 0.5 m 무광 석재 기둥, 유리 덮개 0.42 × 0.28 × 0.42 m(한 번에 그리기 · 그림자 없음), 윗면 은은한 발광 판(자체 발광 — 조명 수를 늘리지 않는다). 제품 `-lite` 실제 크기 · 덮개 안 · 눈높이 약 1.15 m · 정면이 진입 쪽. 받침대는 보행 장애물(제품 · 덮개는 받침대에 포함). 진열은 런타임으로 만들고 1F 를 처음 보여 줄 때 불러온다.
- **고르기 값:** 제품 스팟 = 받침대 앞 1.2 m(`kind: 'product'`, 이름 = 제품 이름, look = 제품) — 도착하면 감상 모드. 클릭 · 탭(끌기 없이), 보행 마우스 고정 중에는 조준점이 제품 위일 때 클릭. 이름표(DOM, '자세히 보기')는 제품에서 4 m 안.
- **감상 모드 값 · 문구(그대로 쓴다):** 어두운 청회색 배경 + 바닥 원판(그라데이션 원) + RoomEnvironment PMREM + 키 · 필 · 림 조명 3개, 제품은 원점. 드래그 · 한 손가락 = 회전, 휠 · 두 손가락 = 확대(제품 크기 기준 최소 · 최대 거리), 4 초 입력 없으면 천천히 자동 회전, `←` / `→` · 화면 이전 · 다음 = 같은 층 진열 순서, `Esc` · `< BACK` = 나가기. 왼쪽 위 경로 `SUPREME ORIGIN > Retail > HAUS 성수 1F > <제품명>`, 정보 패널 크기 문구 형식 `폭 157 · 길이 160 · 높이 40 mm`(스펙 예의 154 는 §1.1 실측으로 바로잡음), 재질 목록, 비어 있지 않은 설명 · 컬렉션 · 컬러, 아래 작은 조작 안내. 데스크톱 · 태블릿은 `<id>.glb`(받는 동안 `-lite`), 휴대폰은 `-lite` 만. 나가면 연 자리 · 시선 · 보행 여부 그대로(보행 스팟 · 마커 · 실내 HUD 복원). 감상 중에는 실내 HUD · 이동 스팟 · 보행 안내 · 방식 전환을 숨기고 모달 · 조작 안내는 그대로.
- **바꾸지 않는 것:** Blender 빌드(`tools/nowhere/blender/**`) · 실내 GLB · `inner-layout.json`(`public/assets/nowhere-inner/**`), 외관 · DS2(`world.js` · `weather.js` · `post.js` · `sky.js` · `surface.js` · `camera.js` · `public/assets/nowhere/**` · `public/assets/nowhere-ds2/**`). 외관 허브 Product 표지 · 다른 층 진열 · 컬러 변형 · AR 은 범위 밖(스펙 §9).
- **기기:** 등급 · 기기 구분은 `quality.js` 그대로 — `&tier=tablet` = 모바일 등급 + 태블릿(고해상도 감상), `&tier=mobile` = 휴대폰(lite 만).
- **문구:** UI 문구 · 주석은 한국어(기존 파일 문체 — '·' 구분, 존댓말 없는 설명체). 식별자는 영어.
- **테스트:** `npm test`(= `node --test "tests/*.test.mjs"`, 시작 207 개) 전부 통과.
- **브라우저:** playwriter MCP(`mcp__playwriter__execute` · `mcp__playwriter__reset`)만 쓴다. Playwright MCP 는 쓰지 않고, playwriter 가 실패하면 그 사실을 보고하고 다른 도구로 넘어가지 않는다. 페이지를 열거나 새로 고칠 때마다 곧바로 `window.confirm/alert/prompt` 를 기록용 함수로 바꾸고(`page.on('dialog')` 에 기대지 않는다), 기다림은 한 호출 3 s 이하로 나누며, 각 호출 시작에 `evaluate` 가 3 s 안에 돌아오는지 확인한다(첫 로드는 10–40 s 막힐 수 있다).
- **git:** 구현 서브에이전트는 `git add` · `git commit` · 브랜치 전환을 하지 않는다. 각 태스크 끝의 "스테이징"은 리뷰 통과 뒤 컨트롤러가 그 경로만 `git add` 하고 커밋 메시지 안을 사용자에게 보인다(커밋은 사용자가 요청할 때만, 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`). `git add -A` · `git add .` 금지. 이 계획 · 스펙 문서는 태스크 스테이징에 넣지 않는다.
- **브랜치:** `feat/retail-showcase`(main @ 1c642b4 에서 분기, 이미 체크아웃됨).
- **서브에이전트 모델은 Claude 5.5 이상만:** 판단이 큰 Task 1(에셋 파이프라인) · Task 6(브라우저 확인 · 조정 · CP)은 `opus`, 웹 태스크 2 · 3 · 4 · 5 와 태스크 리뷰는 `sonnet`, 최종 리뷰는 `opus`. 더 낮은 모델을 고르게 되면 `sonnet` 을 쓴다.

---

## 1. 설계 정리(원본 · 코드에서 잰 값과 정한 것)

### 1.1 원본 제품(`gltf-transform inspect` · GLB JSON 으로 잼, 2026-11-13)

| id | 원본 | 삼각형 | 프리미티브 | 재질(알파) | 텍스처 | 경계 상자 x · z · y (mm) → `sizeMm` |
|---|---|---|---|---|---|---|
| `kant` | `Kant.glb` | 119,282 | 3 | `M_Kant_Glasses_SM_Kant`(MASK) · `M_Kant_Plastic_SM_Kant`(MASK) · `M_Kant_Metal`(OPAQUE) | MR 1024 · 노멀 4096 PNG | 156.8 · 160.4 · 39.9 → `{ width: 157, length: 160, height: 40 }` |
| `folding-tarx` | `Folding_Tarx.glb` | 1,334,923 | 12 | `Seat_Clear_C1_003`(BLEND, 코받침 · 다리 끝) · `Metal_Silver_02_0_003` · `Std_Lens_Tarx_02_PA-U7701_003`(BLEND) | 없음 | 153.6 · 138.9 · 35.4 → `{ width: 154, length: 139, height: 35 }` |
| `veggie-oat` | `Veggie_Oat.glb` | 1,212,822 | 15 | `Metal_Silver_02_007` · `Oatt_Eyerim_in1_006` · `Std_Lens_Edge_0_006_Veggie_Oat` ×3(BLEND, 텍스처 각각) · `Seat_pvc_Nosepad_0_007_Veggie_Oat`(BLEND) · `Black_006`(양면, 다리) · `WorldGridMaterial` | 1024 PNG 7 장 | 146.9 · 145.4 · 32.7 → `{ width: 147, length: 145, height: 33 }` |

- 모든 원본은 glTF Y 위 · 미터 단위이고 **정면(렌즈)이 +z**, 다리는 −z 쪽으로 뻗는다(Kant z −153.8 … 6.6 mm). 그래서 `yaw` 0 이면 정면이 +z 를 본다.
- **Kant 길이:** 스펙 예의 `length: 154` 는 원점에서 다리 끝까지(−153.8)를 읽은 값이다. 스펙 규칙("원본 경계 상자에서 잰 값")대로 160 을 쓴다.
- **`WorldGridMaterial`(Veggie Oat 프리미티브 13, 53,581 삼각형):** x −68.5 … −66.4 · y −1.7 … 0.1 · z −58.4 … −38.2 mm — 왼쪽 다리 **안쪽 면**(같은 z 구간 다리 x −71.9 … −66.4)에 붙은 얇은 인쇄(글자) 형상이다. 오른쪽 다리 안쪽의 같은 성격 형상(프리미티브 10 · 12)은 `Metal_Silver_02_007` 이다. 제품 일부이므로 지우지 않고 그 재질로 바꾼다(결과에 `WorldGridMaterial` 없음). CP 에서 확인한다.
- **재질 문구(원본 재질 이름 → 한국어):** Kant `["렌즈", "플라스틱 프레임", "메탈"]`(스펙 예), Folding Tarx `["렌즈", "실버 메탈", "투명 코받침 · 팁"]`(`Seat_Clear` 는 코받침과 다리 끝 팁), Veggie Oat `["렌즈", "실버 메탈", "아이림", "PVC 코받침", "블랙 다리"]`. CP 에서 확인한다.

### 1.2 파이프라인(`tools/nowhere/products.mjs`) — 임시 사본에서 끝까지 돌려 확인(약 45 s)

- 순서: ① 원본 GLB 의 JSON 청크만 고쳐 재질 바꾸기(의존성 없는 노드 코드, BIN 그대로) → ② `gltf-transform prune --keep-attributes false`(재질에 안 쓰는 UV · 탄젠트를 지워 용접이 더 붙게 — Veggie Oat 경계 고정 단순화 바닥이 58 K → 31.6 K 로 내려감) → ③ `gltf-transform optimize --compress meshopt --texture-compress webp --texture-size <1024|512> --simplify true --simplify-error <e> --simplify-lock-border <true|false> --instance false --palette true --palette-min 2`(dedup · palette · flatten · join · weld · simplify · prune · WebP · meshopt).
- **오차 사다리:** `[0.0001, 0.0002, 0.0003, 0.0005, 0.001, 0.002]` 를 경계 고정으로 먼저, 다 안 되면 경계 풀기로 — 삼각형 · 용량 상한을 처음 맞추는 값을 쓴다. 끝까지 못 맞추면 실패(스펙: 보고하고 상한을 함께 정한다).
- **`--palette-min 2`:** 텍스처 없는 재질을 팔레트로 합쳐 프리미티브(=그리기)를 줄인다. 진열 lite 프리미티브 합 3 + 3 + 7 = 13 → 2 + 2 + 6 = 10(받침대 · 덮개 2 를 더해 +12, 상한 그대로).
- 결과(임시 사본, meshoptimizer 0.22.0 — 판이 다르면 숫자가 조금 다를 수 있다. 판정은 테스트의 상한):

  | 파일 | 삼각형 | MB | 프리미티브 | 오차 · 경계 | 크기 차 |
  |---|---|---|---|---|---|
  | `kant.glb` | 63,490 | 0.688 | 2 | 0.0001 고정 | 0.00 mm |
  | `kant-lite.glb` | 19,729 | 0.246 | 2 | 0.0005 고정 | 0.02 mm |
  | `folding-tarx.glb` | 35,403 | 0.144 | 2 | 0.0003 고정 | 0.01 mm |
  | `folding-tarx-lite.glb` | 13,499 | 0.060 | 2 | 0.001 고정 | 0.09 mm |
  | `veggie-oat.glb` | 59,056 | 0.698 | 6 | 0.0003 고정 | 0.02 mm |
  | `veggie-oat-lite.glb` | 16,964 | 0.275 | 6 | 0.0005 **풀기**(고정은 바닥 ≈ 31.6 K) | 0.05 mm |
  | **lite 합** | **50,192** | **0.581** | **10** | | |

- Veggie Oat 금속 프레임은 열린 경계 변이 많아(프리미티브 0 · 12 · 13 에만 경계 변 약 2 만 개) 경계 고정으로는 20 K 아래로 못 내려간다. 경계 풀기 0.0005(오차 ≈ 0.07 mm)는 임시 사본 브라우저 캡처(390 × 844 감상 모드)에서 렌즈 테 · 다리 모양이 무너지지 않았다. 경첩 · 코받침 · 렌즈 테 확대 확인은 Task 6 CP 항목이다.

### 1.3 1F 진열 자리(three 좌표, m)

- 1F: 영역 x −17 … 17 · z −21 … 17, 정문 열림 x −3 … 3(z 17), 진입 (0, 13) → (0, 2.5, 0) 을 봄, 출구 영역 (0, 16) r 2, 엘리베이터 (0, −19) r 2.5, 둘러보기 지점 (6, 8) · (4, −3) · (−8, −2), 전시물 상자 `EX_plinth` x −4.5 … 4.5 · z −3 … 3(도시 모형), `EX_dj` x 7.45 … 10.15 · z −8.55 … −5.85, `EX_display` x −16.55 … −16.25 · z −9 … −3, 기둥 `IN_column_*` (±11, 6) · (±11, −9) 0.8 m(inner-1.glb 노드 상자).
- **정한 자리:** 정문으로 들어와 도시 모형으로 가는 동선(x −3 … 3)의 왼쪽(서쪽)에 x 를 따라 한 줄, 정면이 정문 쪽(+z, `yaw` 0):

  | 제품 | pos | 제품 스팟(앞 1.2 m) | 가장 가까운 전시물 | 둘러보기 지점 | 출구 영역 | 엘리베이터 영역 | 벽 · 기둥 |
  |---|---|---|---|---|---|---|---|
  | Kant | (−4.0, 0, 8.0) | (−4.0, 9.2) | `EX_plinth` 4.65 | 9.65 | 6.59 | 24.44 | `IN_column_0` 6.44 |
  | Folding Tarx | (−6.5, 0, 8.0) | (−6.5, 9.2) | `EX_plinth` 5.03 | 9.76 | 7.95 | 24.92 | 4.05 |
  | Veggie Oat | (−9.0, 0, 8.0) | (−9.0, 9.2) | `EX_plinth` 6.37 | 9.70 | 9.69 | 25.61 | 1.91 |

  (거리 = 받침대 바닥을 감싸는 원 0.354 m 에서 잰 틈, m. Task 2 테스트 (h) 가 inner-1.glb 노드 상자 · inner-layout 으로 같은 값을 검사한다.) 진입 시점에서 방위 −38.7° · −52.4° · −60.9°(Kant 는 1600 × 900 첫 화면 가장자리 안).
- 임시 사본 브라우저 확인: 실내 점유 격자 `blocker.isBlocked(x, z, 0.35)` 가 받침대 가운데 3 곳에서 true(윗면 1.4 — 덮개 위 1.33 m 를 0.1 단위 올림), 스팟 3 곳에서 false, 받침대 가장자리 + 몸 반경(x −4.6) 막힘 · x −4.65 빔.
- **제품 높이:** 스펙 "눈높이 약 1.15 m"를 제품 경계 상자 **가운데 1.15 m** 로 정했다(받침대 윗면 1.05 + 발광 판 0.01 위 약 7 cm — 덮개(1.05 … 1.33) 안에 떠 있는 진열). 받침대에 바로 얹기(가운데 ≈ 1.08)는 CP 에서 고를 수 있다(`PRODUCT_CENTER_Y` 한 값).

### 1.4 그리기 · 삼각형 예산(임시 사본 실측)

| 항목 | 그리기 | 삼각형 |
|---|---|---|
| 받침대 3 + 발광 판 3(한 메시 — `emissiveMap` 2 × 1 칸을 UV 로 골라 발광 판만 자체 발광) | 1 | 72 |
| 유리 덮개 3(한 메시, `FrontSide` 한 번에, `depthWrite` 끔, `renderOrder` 1) | 1 | 36 |
| 제품 lite 3 점(프리미티브 2 · 2 · 6) | 10 | 50,192 |
| **합(상한 +12 · +70 K)** | **+12** | **+50.3 K** |

- 임시 사본, 데스크톱, 1F (−6.5, 1.7, 12) 에서 진열을 보는 시점: 진열 숨김 54 그리기 · 299,057 삼각형 → 보임 66 · 349,357(+12 · +50,300). 감상 모드: 그리기 3(제품 2 + 원판 1) · 35,405(Folding Tarx 고해상도) · 63,492(Kant 고해상도).
- 실내는 그림자 내는 조명이 없어 그림자 패스가 없다. 진열 제품 재질에는 감상 무대와 같은 RoomEnvironment PMREM 을 `envMap` 으로 준다(모바일 실내는 HDRI 를 받지 않아 금속이 검게 보이므로 — 다운로드 0, PMREM 한 번).

### 1.5 감상 모드 흐름 · 복원(`main.js`)

- 열기 `openShowcase(id)`: 실내 · 진열 목록 · 층이 있고 감상 · 화면 전환 · 스팟 컷 중이 아니면 → 연 자리 `{ pos, target, walking }` 를 적고 → 스팟 걷기 · 입력 비우기 → 보행 중이면 `setWalkMode(false)`(마우스 고정 해제 · 보행 키 무시 · 보행 안내 · 이동 스팟이 숨음, 방식 컨트롤러는 실내라 그대로) → 실내 OrbitControls 끄기 → `showcase.open`(0.2 s 어둡게 → 무대로 → 밝게).
- 렌더: `showcase.isActive()` 동안 `camCtrl.update` · `interior.update` 를 건너뛰고 `showcase.update` · `showcase.render`(그 장면만, 노출 1.0 으로 잠깐 바꿔 그림) — 후처리 · 외관 · 실내 없음. 마커 · 이름표는 `isSuspended` 로 숨는다.
- 키: 감상 모듈이 창 캡처 단계에서 `Esc` · `←` · `→` 를 받고(`stopImmediatePropagation`), 조작 안내(`?`) · 성능 표시(`P`) · ⌘ · Ctrl 조합은 지나가게, 나머지(`V` · `WASD` · `Space` …)는 뒤 보행 · 카메라로 가지 않게 막는다. 조작 안내 · 모달이 열려 있으면 그쪽이 먼저(`e.defaultPrevented` · `isBlocked`).
- 나가기 `close` → 어두운 동안 `restoreFromShowcase()`: 실내 OrbitControls 켜기 → `placeAt(pos, target)` → 보행이었으면 `setWalkMode(true)` 뒤 `placeWalk(x, z, 시선 방향 10 배 먼 점)`(보행을 켜면 시선이 수평이 되므로 위 · 아래 시선까지 되돌림). 임시 사본에서 위치 (−6.5, 1.7, 11.5) · 시선 (−6.5, 1.278, 9.036) 이 열기 전과 같게 돌아옴을 확인했다.
- 감상 중 숨김: `body.is-showcase` CSS(방식 고르기 `is-choosing` 과 같은 방식)가 상단 바(방식 전환 포함) · 하단 독 · 실내 HUD · 자막 · 보행 안내 · 이동 스팟 · 이름표를 숨긴다 — `interior.js` 에 따로 상태를 두지 않는다. 조작 안내는 감상 화면 오른쪽 위 `조작 안내 ?` 버튼과 `?` 키, 모달 · 성능 표시는 그대로.
- 클릭 · 탭: 진열 모듈이 캔버스 `click` 을 캡처 단계에서 먼저 받아 받침대 · 덮개를 맞히면 `stopImmediatePropagation`(보행 화면 클릭의 마우스 고정 요청 · 스팟 조준 클릭이 함께 일어나지 않게). 끌기 5 px 넘으면 클릭이 아니고, 마우스 고정 중에는 화면 가운데(조준점), 고르기 거리 12 m.

### 1.6 미리 확인한 것(임시 사본 `/tmp/rs-plan/repo` — 저장소 밖, 이 계획의 코드 그대로)

- `npm run nowhere:products` 끝까지(§1.2 표), `npm test` 224 개 통과(이 계획의 새 · 바뀐 테스트 전부 포함).
- playwriter(사본을 :4174 로 띄움): 1F 진열 보임 · 이름표(4 m 안만) · 그리기 +12 · 삼각형 +50.3 K · 장애물 · 받침대 클릭 → 감상(마우스 고정 안 걸림) · `←`/`→` 순환 · 4 s 뒤 자동 회전 · 휠 확대 최소 0.142 / 최대 1.100 m 에서 멈춤 · `Esc` 정확한 복원 · 제품 스팟 도착 → 감상 · `< BACK` · 이름표 클릭 · `?` 조작 안내가 감상 위로 열리고 `Esc` 는 안내만 닫음 · `V` · `W` 무시 · `&tier=mobile` lite 만(고해상도 요청 없음) · 390 × 844 화면 맞춤(가로 폭 기준 거리 — `stageFraming` 에 화면비를 넣게 고친 뒤).
- 그 밖: `three` 중복 경고("Multiple instances of Three.js")는 main 에서도 나는 기존 경고다.

## 2. 파일 구조

| 파일 | 책임 | 태스크 |
|---|---|---|
| `tools/nowhere/products.mjs` (새) | 원본 → `<id>.glb` · `<id>-lite.glb`(재질 바꾸기 · prune · 오차 사다리 optimize · 확장 · 크기 검사), `rewriteGlbJson` · `remapMaterials` · `PRODUCT_SOURCES` | 1 |
| `package.json` (수정) | `nowhere:products` 스크립트 | 1 |
| `public/assets/products/products.json` (새) | 제품 3 개(실측 크기 · 재질 · 빈 문구 필드) + 1F 진열 3 자리 | 1 |
| `public/assets/products/{kant,folding-tarx,veggie-oat}{,-lite}.glb` (새, 빌드 산출물) | 감상 · 진열 GLB | 1 |
| `public/src/nowhere/products.js` (새, 순수) | 목록 검증 · 층 진열 · 제품 스팟 · 크기 · 재질 문구 · 경로 · 이전 · 다음 · 감상 키 · 무대 거리 · 진열 상수 | 2 |
| `public/src/nowhere/walk-spots.js` (수정) | `interiorSpots(floor, catalog)` 가 제품 스팟을 더한다 | 2 |
| `public/src/nowhere/showcase.js` (새) | 스튜디오 장면 · 카메라 · 조작 · 자동 회전 · UI · 고해상도 교체 · 키 · `studioEnvironment` | 3 |
| `public/src/nowhere/retail-display.js` (새) | 층 진열(받침대 · 발광 판 · 덮개 · 제품 lite) · 장애물 · 클릭 판정 · 이름표 | 4 |
| `public/src/nowhere/interior.js` (수정) | 층 GLB 와 함께 진열 받기 · 층 장면에 붙이기 · 점유 격자에 더하기 · 층 알림 | 4 |
| `public/src/nowhere/main.js` (수정) | 진열 · 감상 생성, 렌더 전환, 제품 스팟 도착 → 감상, 열기 · 복원, 일시 정지 조건, `app` · `getStats` | 4 |
| `public/src/nowhere/nowhere.css` (수정) | 감상 화면 · `body.is-showcase` 숨김(3), 이름표(4) | 3, 4 |
| `public/src/nowhere/help.js` · `README.md` (수정) | 조작 안내 '제품 감상' 묶음 · 조작 표 두 행(5), 빌드 절차 한 줄(1) | 1, 5 |
| `tests/nowhere-product-assets.test.mjs` (새) | 에셋 상한 · WebP · 확장 · 재질 · 크기 · 진열 예산 · 도우미 | 1 |
| `tests/nowhere-products.test.mjs` (새) | (a)–(h) 순수 · 진열 자리(2), (i) 감상 모듈(3), (j) 연결(4) | 2, 3, 4 |
| `tests/nowhere-help.test.mjs` (수정) | (a) 네 묶음, (i) 제품 감상 안내 | 5 |
| `build/products/`(git 무시) | 파이프라인 중간 파일 | 1 |
| `build/nowhere/compare/retail-*.png`(git 무시) | 캡처 | 6 |

`main.js` · `interior.js` 는 바꿀 코드를 원문 그대로 보여 주므로 줄 번호가 아니라 그 내용으로 찾는다(줄 번호는 1c642b4 기준 참고용).

## 3. 실행 방식

### 3.1 시작 전 준비(컨트롤러가 직접)

```bash
git branch --show-current                      # Expected: feat/retail-showcase
lsof -i :4173 || (npm start > /tmp/nw-serve.log 2>&1 &)
npm test 2>&1 | tail -8                        # Expected: "# pass 207", "# fail 0"
ls /Users/gm_yeonho/new-work/xr-editor/public/assets/{Kant,Folding_Tarx,Veggie_Oat}.glb   # 원본 세 개
mkdir -p build/nowhere/compare
```

### 3.2 태스크 진행 규칙

- 서브에이전트 디스패치는 superpowers:subagent-driven-development 를 따른다. 모델은 Global Constraints 대로(Task 1 · 6 `opus`, 2 · 3 · 4 · 5 `sonnet`).
- 구현자는 git 을 건드리지 않는다. 각 태스크 끝의 "스테이징(커밋하지 않음)"은 컨트롤러가 리뷰 뒤 실행할 명령과 커밋 메시지 안이다.
- 브라우저 단계는 playwriter 만 쓴다. 페이지를 열 때마다 아래 (1) 을 한 호출로, 준비는 (2) 를 되풀이해서, 이후 호출마다 시작에 (3) 을 한 줄 넣는다.

```js
// (1) 열기 + 대화상자 바꾸기 — 한 호출(주소 · 크기는 단계마다 바꾼다)
state.page = context.pages().find((p) => p.url().startsWith('http://localhost:4173')) ?? (await context.newPage()); await state.page.setViewportSize({ width: 1600, height: 900 }); await state.page.goto('http://localhost:4173/nowhere?noIntro=1&cam=street&time=14', { waitUntil: 'domcontentloaded' }); await state.page.evaluate(() => { window.__dialogs = []; window.confirm = (m) => (window.__dialogs.push(m), true); window.alert = (m) => { window.__dialogs.push(m); }; window.prompt = (m) => (window.__dialogs.push(m), null); }); console.log(state.page.url());
```

```js
// (2) 준비될 때까지 되풀이('ready' 가 나올 때까지, 한 번 2.5 s)
console.log(await state.page.waitForFunction(() => Boolean(window.__NW_APP), null, { timeout: 2500 }).then(() => 'ready', () => 'wait'));
```

```js
// (3) 호출 시작마다 — 3 s 안에 evaluate 가 돌아오지 않으면 대화상자가 떠 있는 것이다(보고하고 멈춘다)
await Promise.race([state.page.evaluate(() => 1), new Promise((_, rej) => setTimeout(() => rej(new Error('evaluate 가 3 s 안에 돌아오지 않는다 — 대화상자?')), 3000))]);
```

### 3.3 확인 지점(사용자) — CP

- **CP (Task 6 Step 10, 마지막 조정 전):** 컨트롤러가 Task 6 캡처(1F 진열 5 장 · 감상 고해상도 3 장 · 확대 6 장 · lite 3 장 · 태블릿 2 장 · 휴대폰 2 장)와 예산 · 다운로드 · FPS 표를 한 페이지(Artifact, 지난 CP 페이지와 같은 형식)로 묶어 보이고 아래를 묻는다.
  1. 진열 자리 · 모습: 정문 왼쪽 한 줄(§1.3), 받침대 석재 색 · 발광 판 밝기 · 유리 덮개, 제품 높이(가운데 1.15 m 떠 있기 vs 받침대에 바로 얹기)
  2. 단순화 품질: 경첩 · 코받침 · 렌즈 테(고해상도 · lite 확대), 특히 Veggie Oat lite(경계 풀기)
  3. 재질 문구(§1.1) · Kant 길이 160 mm(스펙 예 154) · `WorldGridMaterial` 을 다리 안쪽 인쇄로 보고 실버 메탈로 바꾼 것
  4. 감상 무대: 배경 · 바닥 원판 · 조명 · 처음 시선 · 자동 회전 빠르기(30 초에 한 바퀴)
  5. 예산 · FPS 표(넘는 칸이 있으면 줄일 곳)
- 사용자 답은 이 절 아래 "결과(날짜)"로 적고 Task 6 Step 11 로 넘어간다. 바꿀 것이 없다는 답이면 Step 11 은 건너뛴다.
- **결과(2026-11-13, 사용자 "추천대로"):** 페이지 https://claude.ai/artifact/2fnLp5mbm9Hi4r9bP7Dg55
  1. 제품 높이 — 받침대에 얹는다(`PRODUCT_CENTER_Y` 1.15 → 1.08).
  2. 단순화 품질 — 최적화 파이프라인을 고쳐 Kant 감상용 렌즈의 깨진 반사(노멀)와 Folding Tarx 감상용 금속 얼룩을 없앤다(렌즈는 줄이지 않거나 노멀을 다시 계산 — 범위 확장 승인).
  3. Veggie Oat 다리 안쪽 인쇄(`WorldGridMaterial`) — 은색 대신 `Black_006`(다리와 같은 검정)으로 바꾼다.
  4. 감상 무대 — 그대로.
  5. FPS — 전원 연결 상태에서 다시 잰다(배터리면 사용자에게 알린다).
  - 답과 상관없이: 휴대폰 감상 화면 `< BACK` · `조작 안내` 버튼 44 px, 조작 안내 네 번째 묶음이 1600 × 900 에서 화면 밖으로 밀리는 배치, README:34 '세 묶음' 문구, `showcase.open()` 실패 시 암전 복구.
- **최종 리뷰(opus, 2026-11-13): 수정 후 머지 → 반영(231/231).**
  - 감상 중 조작 안내 · 모달이 열렸거나 여닫는 페이드 동안 누른 `V` 가 뒤 카메라의 보행 모드를 켜던 것을 막았다(`showcaseKeyGate`, 감상 중 캔버스 click 가드) — 브라우저로 자유 시점 · 보행 복원, 페이드 중 연타, 안내 · 모달 Esc 확인.
  - 파이프라인이 불러온 라이브러리 판을 찍고 CP 에서 확인한 판(`EXPECTED_VERSIONS`: meshoptimizer 0.22.x · functions 4.5.x)이 아니면 멈춘다.
  - 미룸: 법선 가중 단순화의 빈 프리미티브 정리, 휴대폰 실내 PMREM 메모리, lite 실패 제품의 이름표 · 스팟, 1180 × 820 태블릿에서 정보 패널이 Kant 다리 끝을 가림, 휴대폰 가로 화면 미확인.
- **미룸 처리(2026-11-13, 병합 뒤):**
  - 1180 × 820 정보 패널 가림 → 고침(`180a233`): 옆 패널 배치는 패널 왼쪽 빈 곳 가운데에 제품(`stageView` · `setViewOffset`), 세로 태블릿(폭 1024 이하)은 패널을 아래로.
  - 휴대폰 가로 844 × 390 → 확인: 제품 · 정보 패널 · 이전/다음 · 안내가 겹치지 않는다(바꿀 것 없음).
  - lite 실패 제품의 이름표 · 스팟 → 고침(`3567cd9`): 진열에서 뺀다(`withoutProducts`) — 이름표 · 이동 스팟 · 감상 이전/다음 · 빈 받침대 클릭.
  - 법선 가중 단순화의 빈 프리미티브 → 고침(`59c60f3`): 지우는 처리 추가, 재실행 출력 md5 동일.
  - 휴대폰 실내 PMREM → 그대로 둔다: 휴대폰 실내 1F 텍스처 전체 추정 274 MB 중 약 6.3 MB(2 %), 진열 제품 렌즈 반사에 쓰여 미루면 진열이 밋밋해진다.

---

## 4. 태스크

### Task 1: 제품 GLB 파이프라인 · 목록 파일

**Files:**
- Create: `tools/nowhere/products.mjs`
- Create: `public/assets/products/products.json`
- Create(빌드 산출물): `public/assets/products/kant.glb` · `kant-lite.glb` · `folding-tarx.glb` · `folding-tarx-lite.glb` · `veggie-oat.glb` · `veggie-oat-lite.glb`
- Modify: `package.json`(scripts 에 한 줄)
- Modify: `README.md`(2 절 빌드 절차에 2-D)
- Test: `tests/nowhere-product-assets.test.mjs` (새)

**Interfaces:**
- Consumes: `tests/lib/glb.mjs` 의 `readGlbJson(url) → json`, `meshNodeBoxes(json) → [{ name, min, max }]`(양자화 · 노드 행렬 반영), `triangleCount(json) → number`; 원본 폴더(`PRODUCT_SRC`, 기본 저장소 루트 기준 `../../xr-editor/public/assets`)
- Produces (Task 2 · 3 · 4 가 쓴다):
  - `public/assets/products/products.json` = `{ products: [{ id, name, category, glb, liteGlb, sizeMm: { width, length, height }, materials: string[], description, collection, color }], displays: [{ floor, product, pos: [x, y, z], yaw(도) }] }` — id `kant` · `folding-tarx` · `veggie-oat`, 1F 진열 3 자리(§1.3)
  - `assets/products/<id>.glb` · `<id>-lite.glb`(three 좌표 · 미터 · 정면 +z, `EXT_meshopt_compression` · `KHR_mesh_quantization` · `EXT_texture_webp` · `KHR_materials_ior` · `KHR_texture_transform` 만)
  - `tools/nowhere/products.mjs` 의 `rewriteGlbJson(buf, edit) → Buffer`, `remapMaterials(json, { from: to }) → number`, `sizeOfGlb(json) → { width, length, height }`(mm), `PRODUCT_SOURCES` · `VARIANTS` · `SIMPLIFY_ERRORS` · `ALLOWED_EXTENSIONS`
  - `npm run nowhere:products`

- [ ] **Step 1: 브랜치 · 시작 상태 확인**

```bash
git branch --show-current && npm test 2>&1 | grep -E "^# (pass|fail)"
```

Expected: `feat/retail-showcase`, `# pass 207`, `# fail 0`

- [ ] **Step 2: 실패하는 테스트 작성** — `tests/nowhere-product-assets.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { readGlbJson, meshNodeBoxes, triangleCount } from './lib/glb.mjs';
import { rewriteGlbJson, remapMaterials, PRODUCT_SOURCES } from '../tools/nowhere/products.mjs';

const PUB = new URL('../public/', import.meta.url);
const catalog = JSON.parse(readFileSync(new URL('assets/products/products.json', PUB), 'utf8'));
const MB = 1024 * 1024;
const VARIANTS = [
  ['glb', '감상', 80000, 1024, 3 * MB],
  ['liteGlb', '진열', 20000, 512, 0.8 * MB],
];
const ALLOWED = new Set(['EXT_meshopt_compression', 'KHR_mesh_quantization', 'EXT_texture_webp', 'KHR_materials_ior', 'KHR_texture_transform']);

// GLB 안 이미지 바이트(bufferView → BIN 청크)
function imageBytes(url, json, img) {
  const buf = readFileSync(url);
  const jsonLen = buf.readUInt32LE(12);
  const binStart = 20 + jsonLen + 8;
  const bv = json.bufferViews[img.bufferView];
  return buf.subarray(binStart + (bv.byteOffset || 0), binStart + (bv.byteOffset || 0) + bv.byteLength);
}

// WebP 머리(RIFF … WEBP + VP8 / VP8L / VP8X)에서 가로 · 세로
function webpSize(b) {
  assert.equal(b.toString('ascii', 0, 4), 'RIFF');
  assert.equal(b.toString('ascii', 8, 12), 'WEBP');
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (kind === 'VP8L') {
    const b0 = b[21], b1 = b[22], b2 = b[23], b3 = b[24];
    return [1 + (((b1 & 0x3f) << 8) | b0), 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6))];
  }
  if (kind === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  throw new Error(`알 수 없는 WebP 청크 ${kind}`);
}

const files = catalog.products.flatMap((p) => VARIANTS.map(([key, label, maxTris, maxTex, maxBytes]) => ({ p, key, label, maxTris, maxTex, maxBytes, url: new URL(p[key], PUB) })));

test('(a) 제품마다 감상 · 진열 GLB: 삼각형 ≤ 80 K · 20 K, 용량 ≤ 3 MB · 0.8 MB, 진열 세 점 합 ≤ 2.4 MB', () => {
  let lite = 0;
  for (const f of files) {
    assert.ok(existsSync(f.url), `${f.p[f.key]} 없음 — npm run nowhere:products`);
    const tris = triangleCount(readGlbJson(f.url));
    const bytes = statSync(f.url).size;
    assert.ok(tris > 1000 && tris <= f.maxTris, `${f.p[f.key]} 삼각형 ${tris} > ${f.maxTris}`);
    assert.ok(bytes <= f.maxBytes, `${f.p[f.key]} ${(bytes / MB).toFixed(2)} MB > ${f.maxBytes / MB} MB`);
    if (f.key === 'liteGlb') lite += bytes;
  }
  assert.ok(lite <= 2.4 * MB, `진열 합 ${(lite / MB).toFixed(2)} MB > 2.4 MB`);
});

test('(b) 텍스처는 모두 WebP 이고 감상 ≤ 1024 · 진열 ≤ 512 px, KTX2 · basisu 확장 없음, 쓰는 확장은 뷰어가 읽는 것만', () => {
  for (const f of files) {
    const json = readGlbJson(f.url);
    for (const e of json.extensionsUsed || []) assert.ok(ALLOWED.has(e), `${f.p[f.key]}: 확장 ${e}`);
    for (const e of json.extensionsRequired || []) assert.ok(ALLOWED.has(e), `${f.p[f.key]}: 필수 확장 ${e}`);
    assert.doesNotMatch(JSON.stringify(json), /KHR_texture_basisu|image\/ktx2/);
    for (const img of json.images || []) {
      assert.equal(img.mimeType, 'image/webp', `${f.p[f.key]}: ${img.name} ${img.mimeType}`);
      const [w, h] = webpSize(imageBytes(f.url, json, img));
      assert.ok(w <= f.maxTex && h <= f.maxTex, `${f.p[f.key]}: ${img.name} ${w}×${h} > ${f.maxTex}`);
    }
  }
});

test('(c) WorldGridMaterial 없음, 투명 재질의 알파 모드 유지(Kant 렌즈 MASK · Folding Tarx · Veggie Oat 렌즈 BLEND)', () => {
  const modes = { kant: 'MASK', 'folding-tarx': 'BLEND', 'veggie-oat': 'BLEND' };
  for (const f of files) {
    const mats = readGlbJson(f.url).materials;
    assert.ok(!mats.some((m) => m.name === 'WorldGridMaterial'), `${f.p[f.key]}: WorldGridMaterial 남음`);
    assert.ok(mats.some((m) => m.alphaMode === modes[f.p.id]), `${f.p[f.key]}: ${modes[f.p.id]} 재질 없음`);
  }
});

test('(d) 경계 상자가 원본 실측(sizeMm)과 ±2 mm — 실제 크기 그대로', () => {
  for (const f of files) {
    const boxes = meshNodeBoxes(readGlbJson(f.url));
    const min = [0, 1, 2].map((a) => Math.min(...boxes.map((b) => b.min[a])));
    const max = [0, 1, 2].map((a) => Math.max(...boxes.map((b) => b.max[a])));
    const got = { width: (max[0] - min[0]) * 1000, length: (max[2] - min[2]) * 1000, height: (max[1] - min[1]) * 1000 };
    for (const k of ['width', 'length', 'height']) {
      assert.ok(Math.abs(got[k] - f.p.sizeMm[k]) <= 2, `${f.p[f.key]} ${k} ${got[k].toFixed(1)} mm ≠ ${f.p.sizeMm[k]} ± 2`);
    }
  }
});

test('(e) 1F 진열 예산: 진열 GLB 프리미티브 합 ≤ 10(받침대 · 덮개 2 를 더해 그리기 ≤ +12) · 삼각형 합 ≤ 69 K(받침대 · 덮개 몫 1 K 남김)', () => {
  const lite = catalog.displays.filter((d) => d.floor === '1').map((d) => readGlbJson(new URL(catalog.products.find((p) => p.id === d.product).liteGlb, PUB)));
  const prims = lite.reduce((s, j) => s + j.meshes.reduce((n, m) => n + m.primitives.length, 0), 0);
  const tris = lite.reduce((s, j) => s + triangleCount(j), 0);
  assert.ok(prims <= 10, `프리미티브 ${prims}`);
  assert.ok(tris <= 69000, `삼각형 ${tris}`);
});

test('(f) 파이프라인 도우미: JSON 청크만 고쳐 쓰고(BIN 그대로 · 4 바이트 맞춤), 재질 바꾸기는 없는 이름이면 던진다, 원본 표와 목록의 제품이 같다', () => {
  const src = readFileSync(new URL('assets/products/kant-lite.glb', PUB));
  const out = rewriteGlbJson(src, (j) => {
    j.asset.extras = { note: '한글 확인' };
  });
  assert.equal(out.readUInt32LE(8), out.length);
  const jl = out.readUInt32LE(12);
  assert.equal(jl % 4, 0);
  assert.equal(JSON.parse(out.subarray(20, 20 + jl).toString('utf8')).asset.extras.note, '한글 확인');
  assert.ok(out.subarray(20 + jl).equals(src.subarray(20 + src.readUInt32LE(12))), 'BIN 청크 그대로');
  const json = { materials: [{ name: 'A' }, { name: 'B' }], meshes: [{ primitives: [{ material: 0 }, { material: 1 }] }] };
  assert.equal(remapMaterials(json, { A: 'B' }), 1);
  assert.deepEqual(json.meshes[0].primitives.map((p) => p.material), [1, 1]);
  assert.throws(() => remapMaterials(json, { C: 'B' }), /재질 없음: C/);
  assert.deepEqual(PRODUCT_SOURCES.map((p) => p.id), catalog.products.map((p) => p.id));
});
```

- [ ] **Step 3: 실패 확인**

Run: `node --test tests/nowhere-product-assets.test.mjs`
Expected: FAIL — `ERR_MODULE_NOT_FOUND`(`tools/nowhere/products.mjs` 없음) 또는 `products.json` ENOENT.

- [ ] **Step 4: `tools/nowhere/products.mjs` 작성**

```js
// HAUS NOWHERE — 리테일 제품 GLB 파이프라인(npm run nowhere:products).
// 사내 제품 원본(언리얼 내보내기, PNG 텍스처) → public/assets/products/<id>.glb(감상 · 데스크톱 · 태블릿) + <id>-lite.glb(진열 · 휴대폰 감상).
// 처리: ① 원본 JSON 청크만 고쳐 재질 바꾸기(Veggie Oat 의 WorldGridMaterial — 다리 안쪽 인쇄, 실제 재질이 빠진 채 내보내짐)
//       ② prune(안 쓰는 UV · 탄젠트 지우기 — 용접이 더 붙어 단순화가 잘 된다)
//       ③ optimize(dedup · palette(재질 합치기 — 그리기 줄이기) · join · weld · meshopt 단순화 · 텍스처 WebP · meshopt 압축)
// 단순화 오차는 작은 값부터 올려 삼각형 · 용량 상한을 처음 맞추는 값을 쓴다. 경계 고정이 먼저, 못 맞추면 경계 풀기(보고 줄에 표시).
// 원본 폴더는 PRODUCT_SRC(기본 ../../xr-editor/public/assets — 저장소 밖, 커밋하지 않음). KTX2(compressed/) 원본은 받지 않는다(뷰어에 KTX2 로더 없음).
// 결과 확인: tests/nowhere-product-assets.test.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readGlbJson, meshNodeBoxes, triangleCount } from '../../tests/lib/glb.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = resolve(process.env.PRODUCT_SRC || resolve(ROOT, '../../xr-editor/public/assets'));
const OUT = resolve(ROOT, 'public/assets/products');
const TMP = resolve(ROOT, 'build/products');
const CLI = ['-y', '@gltf-transform/cli@4.1.1'];
const MB = 1024 * 1024;

// 원본 파일 · 재질 바꾸기(원본 재질 이름 → 같은 원본의 다른 재질 이름)
export const PRODUCT_SOURCES = [
  { id: 'kant', src: 'Kant.glb' },
  { id: 'folding-tarx', src: 'Folding_Tarx.glb' },
  // 왼쪽 다리 안쪽 인쇄(x −68.5 … −66.4 mm, z −58 … −38 mm)가 언리얼 기본 격자 재질로 나왔다 — 오른쪽 다리 안쪽 인쇄와 같은 실버 메탈로
  { id: 'veggie-oat', src: 'Veggie_Oat.glb', remap: { WorldGridMaterial: 'Metal_Silver_02_007' } },
];
export const VARIANTS = [
  { suffix: '', size: 1024, maxTris: 80000, maxBytes: 3 * MB },
  { suffix: '-lite', size: 512, maxTris: 20000, maxBytes: 0.8 * MB },
];
export const SIMPLIFY_ERRORS = [0.0001, 0.0002, 0.0003, 0.0005, 0.001, 0.002];
export const ALLOWED_EXTENSIONS = ['EXT_meshopt_compression', 'KHR_mesh_quantization', 'EXT_texture_webp', 'KHR_materials_ior', 'KHR_texture_transform'];

/** GLB 의 JSON 청크만 edit(json) 으로 고쳐 다시 쓴 Buffer(BIN 청크는 그대로 — 안 쓰게 된 데이터는 prune 이 지운다) */
export function rewriteGlbJson(buf, edit) {
  if (buf.readUInt32LE(0) !== 0x46546c67 || buf.readUInt32LE(16) !== 0x4e4f534a) throw new Error('GLB 아님');
  const len = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + len).toString('utf8'));
  edit(json);
  let js = Buffer.from(JSON.stringify(json), 'utf8');
  js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const rest = buf.subarray(20 + len);
  const head = Buffer.alloc(20);
  head.writeUInt32LE(0x46546c67, 0);
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(20 + js.length + rest.length, 8);
  head.writeUInt32LE(js.length, 12);
  head.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([head, js, rest]);
}

/** 프리미티브 재질을 이름으로 바꾼다. 없는 이름이면 던진다. 바꾼 프리미티브 수 */
export function remapMaterials(json, remap = {}) {
  let n = 0;
  for (const [from, to] of Object.entries(remap)) {
    const fi = json.materials.findIndex((m) => m.name === from);
    const ti = json.materials.findIndex((m) => m.name === to);
    if (fi < 0 || ti < 0) throw new Error(`재질 없음: ${fi < 0 ? from : to}`);
    for (const mesh of json.meshes) {
      for (const p of mesh.primitives) {
        if (p.material === fi) {
          p.material = ti;
          n++;
        }
      }
    }
  }
  return n;
}

/** 장면 전체 경계 상자 크기(mm) { width: x, length: z, height: y } — 반올림 전 값 */
export function sizeOfGlb(json) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const b of meshNodeBoxes(json)) {
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], b.min[a]);
      max[a] = Math.max(max[a], b.max[a]);
    }
  }
  return { width: (max[0] - min[0]) * 1000, length: (max[2] - min[2]) * 1000, height: (max[1] - min[1]) * 1000 };
}

// gltf-transform CLI 한 번. 출력은 삼키고(sharp 중복 경고 등), 실패하면 그 출력을 보여 주고 던진다
function cli(args) {
  try {
    execFileSync('npx', [...CLI, ...args], { stdio: 'pipe' });
  } catch (err) {
    process.stderr.write(err.stdout?.toString() || '');
    process.stderr.write(err.stderr?.toString() || '');
    throw err;
  }
}

function measure(file) {
  const json = readGlbJson(file);
  return { json, tris: triangleCount(json), bytes: statSync(file).size, ext: json.extensionsUsed || [] };
}

function main() {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(TMP, { recursive: true });
  const catalogPath = resolve(OUT, 'products.json');
  const catalog = existsSync(catalogPath) ? JSON.parse(readFileSync(catalogPath, 'utf8')) : null;
  let failed = false;
  for (const p of PRODUCT_SOURCES) {
    const srcPath = resolve(SRC, p.src);
    if (!existsSync(srcPath)) throw new Error(`원본 없음: ${srcPath} (PRODUCT_SRC 로 폴더를 지정)`);
    const srcJson = readGlbJson(srcPath);
    if ((srcJson.extensionsUsed || []).includes('KHR_texture_basisu')) throw new Error(`${p.src}: KTX2 원본은 쓰지 않는다(compressed/ 가 아닌 PNG 원본을 지정)`);
    const size = sizeOfGlb(srcJson);
    const sizeMm = { width: Math.round(size.width), length: Math.round(size.length), height: Math.round(size.height) };
    console.log(`\n${p.id}: 원본 ${triangleCount(srcJson)} 삼각형 · 실측 ${JSON.stringify(sizeMm)}`);
    const listed = catalog?.products?.find((x) => x.id === p.id)?.sizeMm;
    if (listed && JSON.stringify(listed) !== JSON.stringify(sizeMm)) {
      console.error(`  ✗ products.json sizeMm ${JSON.stringify(listed)} ≠ 실측 ${JSON.stringify(sizeMm)}`);
      failed = true;
    }

    // ① 재질 바꾸기 → ② 안 쓰는 속성 지우기
    const fixed = resolve(TMP, `${p.id}-fixed.glb`);
    const pruned = resolve(TMP, `${p.id}-pruned.glb`);
    writeFileSync(fixed, rewriteGlbJson(readFileSync(srcPath), (json) => remapMaterials(json, p.remap)));
    cli(['prune', fixed, pruned, '--keep-attributes', 'false']);

    // ③ 변형마다 오차 사다리
    for (const v of VARIANTS) {
      const target = resolve(OUT, `${p.id}${v.suffix}.glb`);
      let picked = null;
      for (const lock of [true, false]) {
        for (const err of SIMPLIFY_ERRORS) {
          const tmp = resolve(TMP, `${p.id}${v.suffix}-${lock ? 'lock' : 'free'}-${err}.glb`);
          cli([
            'optimize', pruned, tmp,
            '--compress', 'meshopt',
            '--texture-compress', 'webp',
            '--texture-size', String(v.size),
            '--simplify', 'true',
            '--simplify-error', String(err),
            '--simplify-lock-border', String(lock),
            '--instance', 'false',
            '--palette', 'true',
            '--palette-min', '2',
          ]);
          const m = measure(tmp);
          if (m.tris <= v.maxTris && m.bytes <= v.maxBytes) {
            picked = { ...m, tmp, lock, err };
            break;
          }
        }
        if (picked) break;
      }
      if (!picked) {
        console.error(`  ✗ ${p.id}${v.suffix}: 오차 ${SIMPLIFY_ERRORS.at(-1)} 경계 풀기로도 삼각형 ≤ ${v.maxTris} · 용량 ≤ ${v.maxBytes} 을 못 맞춤 — 보고하고 상한을 함께 정한다`);
        failed = true;
        continue;
      }
      const bad = picked.ext.filter((e) => !ALLOWED_EXTENSIONS.includes(e));
      const names = picked.json.materials.map((m) => m.name);
      const out = sizeOfGlb(picked.json);
      const drift = Math.max(Math.abs(out.width - size.width), Math.abs(out.length - size.length), Math.abs(out.height - size.height));
      if (bad.length || names.includes('WorldGridMaterial') || drift > 2) {
        console.error(`  ✗ ${p.id}${v.suffix}: 확장 ${bad.join(',') || '-'} · 재질 ${names.join(',')} · 크기 차 ${drift.toFixed(2)} mm`);
        failed = true;
        continue;
      }
      copyFileSync(picked.tmp, target);
      const prims = picked.json.meshes.reduce((s, mesh) => s + mesh.primitives.length, 0);
      console.log(
        `  ${`${p.id}${v.suffix}.glb`.padEnd(22)} ${String(picked.tris).padStart(6)} 삼각형 · ${(picked.bytes / MB).toFixed(3)} MB · 프리미티브 ${prims} · ` +
          `오차 ${picked.err} ${picked.lock ? '경계 고정' : '경계 풀기(경계 고정으로는 상한 초과)'} · 크기 차 ${drift.toFixed(2)} mm`,
      );
    }
  }
  if (failed) process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
```

- [ ] **Step 5: `package.json` 스크립트** — `"nowhere:heroes:mobile": …,` 줄 다음(`"test"` 앞)에 한 줄

```json
    "nowhere:products": "node tools/nowhere/products.mjs",
```

- [ ] **Step 6: `public/assets/products/products.json` 작성** — 크기는 §1.1 실측, 재질은 원본 재질 이름을 보고 한국어로, 문구 필드는 빈 문자열, 진열은 §1.3

```json
{
  "products": [
    {
      "id": "kant",
      "name": "Kant",
      "category": "eyewear",
      "glb": "assets/products/kant.glb",
      "liteGlb": "assets/products/kant-lite.glb",
      "sizeMm": { "width": 157, "length": 160, "height": 40 },
      "materials": ["렌즈", "플라스틱 프레임", "메탈"],
      "description": "",
      "collection": "",
      "color": ""
    },
    {
      "id": "folding-tarx",
      "name": "Folding Tarx",
      "category": "eyewear",
      "glb": "assets/products/folding-tarx.glb",
      "liteGlb": "assets/products/folding-tarx-lite.glb",
      "sizeMm": { "width": 154, "length": 139, "height": 35 },
      "materials": ["렌즈", "실버 메탈", "투명 코받침 · 팁"],
      "description": "",
      "collection": "",
      "color": ""
    },
    {
      "id": "veggie-oat",
      "name": "Veggie Oat",
      "category": "eyewear",
      "glb": "assets/products/veggie-oat.glb",
      "liteGlb": "assets/products/veggie-oat-lite.glb",
      "sizeMm": { "width": 147, "length": 145, "height": 33 },
      "materials": ["렌즈", "실버 메탈", "아이림", "PVC 코받침", "블랙 다리"],
      "description": "",
      "collection": "",
      "color": ""
    }
  ],
  "displays": [
    { "floor": "1", "product": "kant", "pos": [-4.0, 0, 8.0], "yaw": 0 },
    { "floor": "1", "product": "folding-tarx", "pos": [-6.5, 0, 8.0], "yaw": 0 },
    { "floor": "1", "product": "veggie-oat", "pos": [-9.0, 0, 8.0], "yaw": 0 }
  ]
}
```

- [ ] **Step 7: 파이프라인 실행**

Run: `npm run nowhere:products`
Expected(약 45 s, 종료 코드 0 — 숫자는 §1.2 표와 같거나 조금 다를 수 있다):

```text
kant: 원본 119282 삼각형 · 실측 {"width":157,"length":160,"height":40}
  kant.glb                63490 삼각형 · 0.688 MB · 프리미티브 2 · 오차 0.0001 경계 고정 · 크기 차 0.00 mm
  kant-lite.glb           19729 삼각형 · 0.246 MB · 프리미티브 2 · 오차 0.0005 경계 고정 · 크기 차 0.02 mm

folding-tarx: 원본 1334923 삼각형 · 실측 {"width":154,"length":139,"height":35}
  folding-tarx.glb        35403 삼각형 · 0.144 MB · 프리미티브 2 · 오차 0.0003 경계 고정 · 크기 차 0.01 mm
  folding-tarx-lite.glb   13499 삼각형 · 0.060 MB · 프리미티브 2 · 오차 0.001 경계 고정 · 크기 차 0.09 mm

veggie-oat: 원본 1212822 삼각형 · 실측 {"width":147,"length":145,"height":33}
  veggie-oat.glb          59056 삼각형 · 0.698 MB · 프리미티브 6 · 오차 0.0003 경계 고정 · 크기 차 0.02 mm
  veggie-oat-lite.glb     16964 삼각형 · 0.275 MB · 프리미티브 6 · 오차 0.0005 경계 풀기(경계 고정으로는 상한 초과) · 크기 차 0.05 mm
```

  `✗` 줄이 나오거나 종료 코드가 0 이 아니면 멈추고 그 줄을 보고한다(상한을 임의로 바꾸지 않는다 — 스펙 §1 "보고하고 상한을 함께 정한다"). `products.json sizeMm ≠ 실측` 이면 Step 6 의 크기를 실측으로 고치고 다시 돌린다.

- [ ] **Step 8: 통과 확인**

Run: `node --test tests/nowhere-product-assets.test.mjs`
Expected: PASS 6 개((a)–(f))

- [ ] **Step 9: README 빌드 절차** — `README.md` 의 아래 블록(2 절)

```bash
# 2-C) 성수 실내(B1F · 1F · 12F · 13F): 층 껍데기 + 실내 에셋 축척 · 배치 · 감축 · 바닥 AO → 데스크톱 · 모바일 GLB · inner-layout.json · HDRI (일부 층만: NW_FLOORS=b1,12)
npm run nowhere:inner:build
npm run nowhere:inner:optimize
```

  바로 다음 줄에 빈 줄 하나와 아래 두 줄을 더한다

```bash
# 2-D) 리테일 제품(선글라스 3종): 사내 원본 GLB(PNG 텍스처, 저장소 밖 — 폴더는 PRODUCT_SRC, 기본 ../../xr-editor/public/assets) → public/assets/products/<id>.glb(감상 ≤ 80 K · 1024 WebP) · <id>-lite.glb(진열 · 휴대폰 ≤ 20 K · 512 WebP). 목록 · 진열 자리는 products.json
npm run nowhere:products
```

- [ ] **Step 10: 전체 테스트**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: `# tests 213`, `# pass 213`, `# fail 0`

- [ ] **Step 11: 스테이징(커밋하지 않음) — 리뷰 통과 뒤 컨트롤러가 실행**

```bash
git add tools/nowhere/products.mjs package.json README.md tests/nowhere-product-assets.test.mjs public/assets/products/products.json public/assets/products/kant.glb public/assets/products/kant-lite.glb public/assets/products/folding-tarx.glb public/assets/products/folding-tarx-lite.glb public/assets/products/veggie-oat.glb public/assets/products/veggie-oat-lite.glb
```

커밋 메시지 안: `feat(nowhere): 리테일 제품 GLB 파이프라인(nowhere:products) — 선글라스 3종 감상 · 진열 GLB와 제품 목록`

---

### Task 2: 제품 목록 모듈(`products.js`) · 제품 스팟

**Files:**
- Create: `public/src/nowhere/products.js`
- Modify: `public/src/nowhere/walk-spots.js:1-4`(머리 주석 · import), `:48-66`(`interiorSpots`)
- Test: `tests/nowhere-products.test.mjs` (새, (a)–(h)) — 기존 `tests/nowhere-walk-spots.test.mjs` 는 그대로 통과해야 한다

**Interfaces:**
- Consumes: Task 1 의 `products.json` · GLB 파일, `inner-layout.json` 1F(`bounds` · `tour` · `elevator` · `exit`), `tests/lib/glb.mjs`
- Produces (Task 3 · 4 가 쓴다):
  - 상수 `PRODUCTS_URL = 'assets/products/products.json'`, `PLINTH = { width: 0.5, height: 1.05, depth: 0.5 }`, `COVER = { width: 0.42, height: 0.28, depth: 0.42 }`, `GLOW = { width: 0.4, height: 0.01, depth: 0.4 }`, `PRODUCT_CENTER_Y = 1.15`, `SPOT_FRONT = 1.2`, `LABEL_RANGE = 4`, `LABEL_LIFT = 0.12`, `PICK_RANGE = 12`, `AUTO_ROTATE_DELAY = 4`, `BREADCRUMB_ROOT`
  - `validateCatalog(json) → { products, displays }`(문제를 모아 `Error('products.json: …')`)
  - `findProduct(catalog, id) → product | null`, `floorDisplays(catalog, floorId) → [{ product, pos, yaw }]`(파일 순서), `displayFront(yaw) → [x, z]`
  - `productSpots(catalog, floorId) → 스팟[]` — `{ id: '<floor>_product_<id>', label: name, x, z, look: [x, y + 1.15, z], kind: 'product', beacon: false, caption: null, building: null, product: id }`
  - `sizeText(sizeMm) → '폭 W · 길이 L · 높이 H mm'`, `infoRows(product) → [{ key, label, value }]`(빈 필드 없음), `floorCrumb(floorId)`, `breadcrumb(floorId, name) → string[]`
  - `stepProduct(catalog, floorId, currentId, dir) → id | null`(순환), `resolveShowcaseKey(key) → 'close' | 'prev' | 'next' | null`
  - `stageFraming(radius, fovDeg, aspect = 1) → { distance, minDistance, maxDistance, near, far }`
  - `interiorSpots(floor, catalog = null)`(walk-spots.js) — catalog 가 있으면 그 층 제품 스팟을 끝에 더한다

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/nowhere-products.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  validateCatalog, findProduct, floorDisplays, displayFront, productSpots, sizeText, infoRows, floorCrumb, breadcrumb,
  stepProduct, resolveShowcaseKey, stageFraming,
  PRODUCTS_URL, PLINTH, COVER, GLOW, PRODUCT_CENTER_Y, SPOT_FRONT, LABEL_RANGE, PICK_RANGE, AUTO_ROTATE_DELAY,
} from '../public/src/nowhere/products.js';
import { interiorSpots } from '../public/src/nowhere/walk-spots.js';
import { readGlbJson, meshNodeBoxes } from './lib/glb.mjs';

const PUB = new URL('../public/', import.meta.url);
const raw = JSON.parse(readFileSync(new URL(PRODUCTS_URL, PUB), 'utf8'));
const catalog = validateCatalog(raw);
const inner = JSON.parse(readFileSync(new URL('assets/nowhere-inner/inner-layout.json', PUB), 'utf8'));
const f1 = inner.floors.find((f) => f.id === '1');
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const clone = () => JSON.parse(JSON.stringify(raw));

test('(a) 목록: 세 제품(실측 크기 · 원본 재질 이름), 문구 필드는 빈 문자열, 파일이 있고 1F 진열 순서가 Kant · Folding Tarx · Veggie Oat', () => {
  assert.equal(PRODUCTS_URL, 'assets/products/products.json');
  assert.deepEqual(catalog.products.map((p) => [p.id, p.name, p.category]), [
    ['kant', 'Kant', 'eyewear'],
    ['folding-tarx', 'Folding Tarx', 'eyewear'],
    ['veggie-oat', 'Veggie Oat', 'eyewear'],
  ]);
  assert.deepEqual(findProduct(catalog, 'kant').sizeMm, { width: 157, length: 160, height: 40 });
  assert.deepEqual(findProduct(catalog, 'folding-tarx').sizeMm, { width: 154, length: 139, height: 35 });
  assert.deepEqual(findProduct(catalog, 'veggie-oat').sizeMm, { width: 147, length: 145, height: 33 });
  assert.deepEqual(findProduct(catalog, 'kant').materials, ['렌즈', '플라스틱 프레임', '메탈']);
  for (const p of catalog.products) {
    assert.deepEqual([p.description, p.collection, p.color], ['', '', ''], `${p.id}: 받기 전 문구는 비운다`);
    assert.ok(p.materials.length > 0);
    assert.ok(existsSync(new URL(p.glb, PUB)), `${p.glb} 없음`);
    assert.ok(existsSync(new URL(p.liteGlb, PUB)), `${p.liteGlb} 없음`);
  }
  assert.deepEqual(floorDisplays(catalog, '1').map((d) => d.product.id), ['kant', 'folding-tarx', 'veggie-oat']);
  assert.deepEqual(floorDisplays(catalog, '12'), []);
  assert.deepEqual(floorDisplays(null, '1'), []);
  assert.equal(findProduct(catalog, 'nope'), null);
});

test('(b) 검증: id 중복 · 형식, 없는 제품 진열, 크기 · 재질 · 문구 필드 · 파일 경로 · pos · yaw 오류를 모두 모아 던진다', () => {
  const dup = clone();
  dup.products[1].id = 'kant';
  assert.throws(() => validateCatalog(dup), /id 중복: kant/);
  const bad = clone();
  bad.products[0].id = 'Kant!';
  bad.products[1].sizeMm.width = 0;
  bad.products[1].materials = ['렌즈', ''];
  delete bad.products[2].color;
  bad.products[2].glb = 'assets/products/other.glb';
  bad.displays[0].product = 'ghost';
  bad.displays[1].pos = [1, 2];
  bad.displays[2].yaw = '0';
  assert.throws(() => validateCatalog(bad), (e) => {
    for (const re of [/id 형식/, /sizeMm/, /materials/, /color/, /glb 는/, /없는 제품 "ghost"/, /pos 는/, /yaw/]) assert.match(e.message, re);
    return true;
  });
  assert.throws(() => validateCatalog({ products: [], displays: [] }), /products 가 비었다/);
  assert.throws(() => validateCatalog(null), /products 가 비었다/);
});

test('(c) 제품 스팟: 받침대 앞 1.2 m(정면 = yaw) · 볼거리는 제품 가운데 · kind product · 층 스팟에 더해진다', () => {
  assert.deepEqual(displayFront(0).map((v) => Math.round(v * 1e9) / 1e9), [0, 1]);
  assert.deepEqual(displayFront(90).map((v) => Math.round(v * 1e9) / 1e9), [1, 0]);
  const spots = productSpots(catalog, '1');
  assert.equal(spots.length, 3);
  floorDisplays(catalog, '1').forEach((d, i) => {
    const s = spots[i];
    const [fx, fz] = displayFront(d.yaw);
    assert.ok(near(Math.hypot(s.x - d.pos[0], s.z - d.pos[2]), SPOT_FRONT, 1e-9));
    assert.ok((s.x - d.pos[0]) * fx + (s.z - d.pos[2]) * fz > 0, '정면 쪽');
    assert.deepEqual(s.look, [d.pos[0], d.pos[1] + PRODUCT_CENTER_Y, d.pos[2]]);
    assert.equal(s.kind, 'product');
    assert.equal(s.label, d.product.name);
    assert.equal(s.product, d.product.id);
    assert.equal(s.id, `1_product_${d.product.id}`);
    assert.equal(s.beacon, false);
    assert.equal(s.caption, null);
  });
  const withProducts = interiorSpots(f1, catalog);
  const plain = interiorSpots(f1);
  assert.equal(withProducts.length, plain.length + 3);
  assert.equal(new Set(withProducts.map((s) => s.id)).size, withProducts.length);
  assert.equal(plain.filter((s) => s.kind === 'product').length, 0);
  assert.deepEqual(interiorSpots(inner.floors.find((f) => f.id === '12'), catalog).filter((s) => s.kind === 'product'), []);
});

test('(d) 정보 문구: 크기 · 재질, 비어 있는 설명 · 컬렉션 · 컬러는 행이 없다 · 경로 문구', () => {
  assert.equal(sizeText({ width: 157, length: 160, height: 40 }), '폭 157 · 길이 160 · 높이 40 mm');
  assert.deepEqual(infoRows(findProduct(catalog, 'kant')), [
    { key: 'size', label: '크기', value: '폭 157 · 길이 160 · 높이 40 mm' },
    { key: 'materials', label: '재질', value: '렌즈 · 플라스틱 프레임 · 메탈' },
  ]);
  const filled = { ...findProduct(catalog, 'kant'), description: '설명 문장', collection: '  ', color: '01' };
  assert.deepEqual(infoRows(filled).map((r) => r.key), ['size', 'materials', 'description', 'color']);
  assert.deepEqual(infoRows({ ...filled, materials: [] }).map((r) => r.key), ['size', 'description', 'color']);
  assert.equal(floorCrumb('1'), 'HAUS 성수 1F');
  assert.equal(floorCrumb('b1'), 'HAUS 성수 B1F');
  assert.deepEqual(breadcrumb('1', 'Kant'), ['SUPREME ORIGIN', 'Retail', 'HAUS 성수 1F', 'Kant']);
});

test('(e) 이전 · 다음은 같은 층 진열 순서로 돌고, 감상 키는 Esc · ← · → 만', () => {
  assert.equal(stepProduct(catalog, '1', 'kant', 1), 'folding-tarx');
  assert.equal(stepProduct(catalog, '1', 'veggie-oat', 1), 'kant');
  assert.equal(stepProduct(catalog, '1', 'kant', -1), 'veggie-oat');
  assert.equal(stepProduct(catalog, '1', 'folding-tarx', -1), 'kant');
  assert.equal(stepProduct(catalog, '1', 'ghost', 1), null);
  assert.equal(stepProduct(catalog, '12', 'kant', 1), null);
  assert.equal(resolveShowcaseKey('Escape'), 'close');
  assert.equal(resolveShowcaseKey('ArrowLeft'), 'prev');
  assert.equal(resolveShowcaseKey('ArrowRight'), 'next');
  for (const k of ['Enter', ' ', 'v', 'w', '?', 'ArrowUp']) assert.equal(resolveShowcaseKey(k), null, k);
});

test('(f) 감상 무대 거리: 처음 거리에서 구 전체가 화면 높이 · 폭에 들고(세로 화면 포함), 최소 < 처음 < 최대, 최소는 표면 밖', () => {
  const half = (15 * Math.PI) / 180;
  for (const r of [0.08, 0.11, 0.5]) {
    for (const aspect of [16 / 9, 1, 390 / 844]) {
      const f = stageFraming(r, 30, aspect);
      const hHalf = Math.atan(Math.tan(half) * aspect);
      assert.ok(f.distance >= r / Math.sin(half) && f.distance >= r / Math.sin(hHalf), `잘림 r ${r} aspect ${aspect}`);
      assert.ok(f.minDistance > r && f.minDistance < f.distance && f.distance < f.maxDistance);
      assert.ok(f.near > 0 && f.near < f.minDistance - r && f.far > f.maxDistance + r);
    }
  }
  assert.deepEqual(stageFraming(0.1, 30), stageFraming(0.1, 30, 1));
  assert.ok(stageFraming(0.1, 30, 390 / 844).distance > stageFraming(0.1, 30, 16 / 9).distance, '세로 화면은 더 멀리');
});

test('(g) 값: 받침대 · 덮개 · 발광 판 크기, 눈높이, 스팟 · 이름표 · 고르기 거리, 자동 회전 대기', () => {
  assert.deepEqual(PLINTH, { width: 0.5, height: 1.05, depth: 0.5 });
  assert.deepEqual(COVER, { width: 0.42, height: 0.28, depth: 0.42 });
  assert.ok(GLOW.width <= COVER.width && GLOW.depth <= COVER.depth);
  assert.equal(PRODUCT_CENTER_Y, 1.15);
  assert.equal(SPOT_FRONT, 1.2);
  assert.equal(LABEL_RANGE, 4);
  assert.equal(PICK_RANGE, 12);
  assert.equal(AUTO_ROTATE_DELAY, 4);
  // 제품 경계 상자(가장 큰 높이 40 mm)가 덮개 안에 든다
  const top = PLINTH.height + COVER.height;
  for (const p of catalog.products) {
    const h = p.sizeMm.height / 1000;
    assert.ok(PRODUCT_CENTER_Y - h / 2 > PLINTH.height + GLOW.height && PRODUCT_CENTER_Y + h / 2 < top, `${p.id} 높이`);
    assert.ok(p.sizeMm.width / 1000 < COVER.width && p.sizeMm.length / 1000 < COVER.depth, `${p.id} 폭 · 길이`);
  }
});

test('(h) 1F 진열 자리: 간격 2.5 m · 층 안 · 전시물(EX_) · 둘러보기 지점 · 엘리베이터 · 출구와 1.5 m 이상, 벽 · 기둥과 0.9 m 이상, 스팟은 빈 자리', () => {
  const solids = meshNodeBoxes(readGlbJson(new URL(f1.glb, PUB))).filter((b) => !/^IN_(floor|ceiling)/.test(b.name) && b.min[1] < 1.9 && b.max[1] > 0.3);
  const R = Math.hypot(PLINTH.width, PLINTH.depth) / 2;   // 받침대 바닥을 감싸는 원(어느 yaw 든)
  const rectDist = (x, z, b) => Math.hypot(Math.max(b.min[0] - x, 0, x - b.max[0]), Math.max(b.min[2] - z, 0, z - b.max[2]));
  const ds = floorDisplays(catalog, '1');
  const [x0, z0, x1, z1] = f1.bounds;
  for (let i = 1; i < ds.length; i++) {
    const g = Math.hypot(ds[i].pos[0] - ds[i - 1].pos[0], ds[i].pos[2] - ds[i - 1].pos[2]);
    assert.ok(near(g, 2.5, 0.05), `간격 ${g}`);
  }
  for (const d of ds) {
    const [x, , z] = d.pos;
    const id = d.product.id;
    assert.equal(d.pos[1], 0, `${id}: 1F 바닥 높이`);
    assert.ok(x - R > x0 + 1 && x + R < x1 - 1 && z - R > z0 + 1 && z + R < z1 - 1, `${id}: 층 영역 안(벽에서 1 m)`);
    for (const b of solids) {
      const gap = rectDist(x, z, b) - R;
      if (b.name.startsWith('EX_')) assert.ok(gap >= 1.5, `${id}: 전시물 ${b.name} 와 ${gap.toFixed(2)} m`);
      else assert.ok(gap >= 0.9, `${id}: ${b.name} 와 ${gap.toFixed(2)} m`);
    }
    for (const [k, t] of f1.tour.entries()) {
      const gap = Math.hypot(t.pos[0] - x, t.pos[2] - z) - R;
      assert.ok(gap >= 1.5, `${id}: 둘러보기 지점 ${k} 와 ${gap.toFixed(2)} m`);
    }
    for (const [name, a] of [['엘리베이터', f1.elevator], ['출구', f1.exit]]) {
      const gap = Math.hypot(a.pos[0] - x, a.pos[2] - z) - a.radius - R;
      assert.ok(gap >= 1.5, `${id}: ${name} 영역과 ${gap.toFixed(2)} m`);
    }
  }
  for (const s of productSpots(catalog, '1')) {
    assert.ok(s.x > x0 + 0.5 && s.x < x1 - 0.5 && s.z > z0 + 0.5 && s.z < z1 - 0.5, `${s.id}: 층 영역 안`);
    for (const b of solids) assert.ok(rectDist(s.x, s.z, b) >= 0.6, `${s.id}: ${b.name} 와 ${rectDist(s.x, s.z, b).toFixed(2)} m`);
    for (const d of ds) assert.ok(Math.hypot(s.x - d.pos[0], s.z - d.pos[2]) - R >= 0.6, `${s.id}: 받침대와 너무 가까움`);
  }
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/nowhere-products.test.mjs`
Expected: FAIL — `products.js` 없음(`ERR_MODULE_NOT_FOUND`)

- [ ] **Step 3: `public/src/nowhere/products.js` 작성**

```js
// HAUS NOWHERE — 리테일 제품 목록(순수, three · DOM 없음 — 테스트: tests/nowhere-products.test.mjs).
// assets/products/products.json 검증 · 층별 진열 · 제품 스팟(받침대 앞 1.2 m) · 정보 문구(크기 · 재질 · 빈 필드 숨김) ·
// 경로 문구 · 이전 · 다음 순서 · 감상 키 · 감상 무대 카메라 거리. 제품 · 진열을 늘릴 때는 GLB 를 넣고 products.json 만 고친다.
// 좌표는 실내 층 Three.js(x, y 위, z). yaw 는 도(°) — 0 이면 제품 정면(모델 +z)이 +z 를 본다.

export const PRODUCTS_URL = 'assets/products/products.json';
export const PLINTH = { width: 0.5, height: 1.05, depth: 0.5 };   // m — 무광 석재 기둥(바닥 중심 = 진열 pos)
export const COVER = { width: 0.42, height: 0.28, depth: 0.42 };  // m — 유리 덮개(받침대 윗면 위)
export const GLOW = { width: 0.4, height: 0.01, depth: 0.4 };     // m — 윗면 발광 판(자체 발광, 조명 없음)
export const PRODUCT_CENTER_Y = 1.15;   // m — 진열 제품 경계 상자 가운데 높이(눈높이 약 1.15 m, 덮개 안)
export const SPOT_FRONT = 1.2;          // m — 제품 스팟은 받침대 앞 이만큼
export const LABEL_RANGE = 4;           // m — 이 안이면 이름표('자세히 보기')
export const LABEL_LIFT = 0.12;         // m — 이름표는 덮개 윗면 위 이만큼
export const PICK_RANGE = 12;           // m — 클릭 · 탭으로 고를 수 있는 거리
export const AUTO_ROTATE_DELAY = 4;     // s — 감상 모드에서 입력이 없으면 이 뒤 천천히 자동 회전
export const BREADCRUMB_ROOT = ['SUPREME ORIGIN', 'Retail'];
const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const OPTIONAL_FIELDS = [
  ['description', '설명'],
  ['collection', '컬렉션'],
  ['color', '컬러'],
];

const isStr = (v) => typeof v === 'string';
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** products.json 을 검증해 { products, displays } 를 돌려준다. 문제가 있으면 모두 모아 던진다 */
export function validateCatalog(json) {
  const errs = [];
  const products = Array.isArray(json?.products) ? json.products : [];
  const displays = Array.isArray(json?.displays) ? json.displays : [];
  if (!products.length) errs.push('products 가 비었다');
  const ids = new Set();
  for (const p of products) {
    const id = p?.id;
    if (!isStr(id) || !ID_RE.test(id)) errs.push(`id 형식: ${JSON.stringify(id)}`);
    else if (ids.has(id)) errs.push(`id 중복: ${id}`);
    ids.add(id);
    if (!isStr(p.name) || !p.name.trim()) errs.push(`${id}: name 없음`);
    if (!isStr(p.category) || !p.category) errs.push(`${id}: category 없음`);
    if (p.glb !== `assets/products/${id}.glb`) errs.push(`${id}: glb 는 assets/products/${id}.glb`);
    if (p.liteGlb !== `assets/products/${id}-lite.glb`) errs.push(`${id}: liteGlb 는 assets/products/${id}-lite.glb`);
    const s = p.sizeMm;
    if (!s || !['width', 'length', 'height'].every((k) => Number.isInteger(s[k]) && s[k] > 0)) errs.push(`${id}: sizeMm 은 양의 정수 width · length · height`);
    if (!Array.isArray(p.materials) || !p.materials.every((m) => isStr(m) && m.trim())) errs.push(`${id}: materials 는 문자열 목록`);
    for (const [k] of OPTIONAL_FIELDS) if (!isStr(p[k])) errs.push(`${id}: ${k} 는 문자열(모르면 빈 문자열)`);
  }
  displays.forEach((d, i) => {
    if (!isStr(d?.floor) || !d.floor) errs.push(`displays[${i}]: floor 없음`);
    if (!ids.has(d?.product)) errs.push(`displays[${i}]: 없는 제품 ${JSON.stringify(d?.product)}`);
    if (!Array.isArray(d?.pos) || d.pos.length !== 3 || !d.pos.every(isNum)) errs.push(`displays[${i}]: pos 는 [x, y, z]`);
    if (!isNum(d?.yaw)) errs.push(`displays[${i}]: yaw(도) 없음`);
  });
  if (errs.length) throw new Error(`products.json: ${errs.join(' · ')}`);
  return { products, displays };
}

/** id → 제품(없으면 null) */
export function findProduct(catalog, id) {
  return catalog?.products.find((p) => p.id === id) || null;
}

/** 그 층 진열(파일 순서) — [{ product, pos, yaw }] */
export function floorDisplays(catalog, floorId) {
  if (!catalog) return [];
  return catalog.displays
    .filter((d) => d.floor === floorId)
    .map((d) => ({ product: findProduct(catalog, d.product), pos: [...d.pos], yaw: d.yaw }));
}

/** 진열 정면 방향(수평 단위 벡터 [x, z]) — yaw 0 이면 [0, 1](+z) */
export function displayFront(yaw) {
  const r = (yaw * Math.PI) / 180;
  return [Math.sin(r), Math.cos(r)];
}

/** 그 층 제품 스팟(보행 이동 스팟 형식, kind 'product'): 받침대 앞 SPOT_FRONT, 이름 = 제품 이름, 볼거리 = 제품 */
export function productSpots(catalog, floorId) {
  return floorDisplays(catalog, floorId).map(({ product, pos, yaw }) => {
    const [fx, fz] = displayFront(yaw);
    return {
      id: `${floorId}_product_${product.id}`,
      label: product.name,
      x: pos[0] + fx * SPOT_FRONT,
      z: pos[2] + fz * SPOT_FRONT,
      look: [pos[0], pos[1] + PRODUCT_CENTER_Y, pos[2]],
      kind: 'product',
      beacon: false,
      caption: null,
      building: null,
      product: product.id,
    };
  });
}

/** 실측 크기 문구: '폭 157 · 길이 160 · 높이 40 mm' */
export function sizeText(sizeMm) {
  return `폭 ${sizeMm.width} · 길이 ${sizeMm.length} · 높이 ${sizeMm.height} mm`;
}

/** 정보 패널 행 [{ key, label, value }] — 크기 · 재질 · 설명 · 컬렉션 · 컬러 중 비어 있지 않은 것만 */
export function infoRows(product) {
  const rows = [{ key: 'size', label: '크기', value: sizeText(product.sizeMm) }];
  if (product.materials.length) rows.push({ key: 'materials', label: '재질', value: product.materials.join(' · ') });
  for (const [key, label] of OPTIONAL_FIELDS) {
    const v = String(product[key] || '').trim();
    if (v) rows.push({ key, label, value: v });
  }
  return rows;
}

/** 층 경로 이름: '1' → 'HAUS 성수 1F', 'b1' → 'HAUS 성수 B1F' */
export function floorCrumb(floorId) {
  return `HAUS 성수 ${floorId === 'b1' ? 'B1F' : `${floorId}F`}`;
}

/** 감상 화면 왼쪽 위 경로: SUPREME ORIGIN > Retail > HAUS 성수 1F > <제품명> */
export function breadcrumb(floorId, name) {
  return [...BREADCRUMB_ROOT, floorCrumb(floorId), name];
}

/** 같은 층 진열 순서로 dir(+1 다음 · −1 이전) 만큼 — 끝에서 처음으로 돈다. 진열에 없으면 null */
export function stepProduct(catalog, floorId, currentId, dir) {
  const ids = floorDisplays(catalog, floorId).map((d) => d.product.id);
  const i = ids.indexOf(currentId);
  if (i < 0) return null;
  return ids[(i + dir + ids.length * 2) % ids.length];
}

/** 감상 모드 키: Esc → 'close', ← → 'prev', → → 'next', 그 밖은 null */
export function resolveShowcaseKey(key) {
  if (key === 'Escape') return 'close';
  if (key === 'ArrowLeft') return 'prev';
  if (key === 'ArrowRight') return 'next';
  return null;
}

/**
 * 감상 무대 카메라 거리(제품 경계 구 반지름 radius m, 세로 시야각 fovDeg, 화면 가로 / 세로 aspect).
 * distance = 구가 화면 높이 · 폭(세로 화면은 폭이 좁다) 모두에 여유 있게 들어오는 거리, min = 표면 가까이(확대), max = 맞춘 거리의 2.5 배
 */
export function stageFraming(radius, fovDeg, aspect = 1) {
  const half = ((fovDeg / 2) * Math.PI) / 180;
  const fit = radius / Math.sin(Math.min(half, Math.atan(Math.tan(half) * aspect)));
  return {
    distance: fit * 1.15,
    minDistance: radius * 1.25,
    maxDistance: fit * 2.5,
    near: radius * 0.02,
    far: fit * 20,
  };
}
```

- [ ] **Step 4: `walk-spots.js` — 머리 주석 · import** — 파일 맨 위의

```js
// 스팟 = { id, label, x, z, look: [x, y, z] | null, kind: 'view'|'entrance'|'elevator'|'exit', beacon, caption, building }
import { buildingToWorld } from './tour-config.js';
```

  를 다음으로 바꾼다

```js
// 스팟 = { id, label, x, z, look: [x, y, z] | null, kind: 'view'|'entrance'|'elevator'|'exit'|'product', beacon, caption, building, product? }
import { buildingToWorld } from './tour-config.js';
import { productSpots } from './products.js';
```

- [ ] **Step 5: `walk-spots.js` — `interiorSpots`** — 아래 주석 · 머리 줄

```js
/** 실내 한 층의 스팟: 둘러보기 지점(볼거리) + 엘리베이터 + 1F 출구. 엘리베이터 · 출구는 영역 트리거가 질문하므로 look 없음. */
export function interiorSpots(floor) {
```

  를

```js
/**
 * 실내 한 층의 스팟: 둘러보기 지점(볼거리) + 엘리베이터 + 1F 출구 + 진열 제품(catalog — products.js validateCatalog 결과, 없으면 뺀다).
 * 엘리베이터 · 출구는 영역 트리거가 질문하므로 look 없음. 제품 스팟은 받침대 앞 1.2 m, 도착하면 감상 모드(main.js arriveAt).
 */
export function interiorSpots(floor, catalog = null) {
```

  로 바꾸고, 함수 끝의

```js
  if (floor.exit) out.push(area(floor.exit, 'exit', '밖으로 나가기'));
  return out;
```

  를

```js
  if (floor.exit) out.push(area(floor.exit, 'exit', '밖으로 나가기'));
  out.push(...productSpots(catalog, floor.id));
  return out;
```

  로 바꾼다.

- [ ] **Step 6: 통과 확인**

Run: `node --test tests/nowhere-products.test.mjs tests/nowhere-walk-spots.test.mjs`
Expected: PASS(products 8 개 (a)–(h), walk-spots 기존 전부)

- [ ] **Step 7: 전체 테스트**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: `# tests 221`, `# pass 221`, `# fail 0`

- [ ] **Step 8: 스테이징(커밋하지 않음) — 리뷰 통과 뒤 컨트롤러가 실행**

```bash
git add public/src/nowhere/products.js public/src/nowhere/walk-spots.js tests/nowhere-products.test.mjs
```

커밋 메시지 안: `feat(nowhere): 제품 목록 모듈(products.js) — 검증 · 층 진열 · 제품 스팟 · 정보 문구 · 이전 · 다음 · 감상 무대 거리`

---

### Task 3: 감상 모드 무대(`showcase.js`) · 감상 화면 CSS

**Files:**
- Create: `public/src/nowhere/showcase.js`
- Modify: `public/src/nowhere/nowhere.css`(파일 끝에 감상 화면 · `body.is-showcase` 숨김)
- Test: `tests/nowhere-products.test.mjs`((i) 추가)

**Interfaces:**
- Consumes: Task 2 의 `findProduct` · `floorDisplays` · `infoRows` · `breadcrumb` · `stepProduct` · `resolveShowcaseKey` · `stageFraming` · `AUTO_ROTATE_DELAY`; `fade.js` 형식의 `fade = { fadeTo(on, text, ms) → Promise, setText }`; `quality.device`('desktop' | 'tablet' | 'phone')
- Produces (Task 4 가 쓴다):
  - `SHOWCASE_FADE_MS = 200`, `studioEnvironment(renderer) → THREE.Texture`(RoomEnvironment PMREM, 한 번만)
  - `createShowcase({ renderer, canvas, quality, fade, getLite(product) → Promise<Object3D|null>, isBlocked() → boolean, onHelp(), onClose() }) → { open({ catalog, floorId, productId }) → Promise<boolean>, close() → Promise<void>, update(dt), render(), isActive(), isBusy(), getState() → { active, productId, level: 'lite'|'hi'|null, autoRotate, distance, minDistance, maxDistance }, scene, camera, controls, element }`
  - 열려 있는 동안 `body.is-showcase`, DOM `.nw-showcase`(`.nw-showcase-back` · `.nw-showcase-crumbs` · `.nw-showcase-help` · `.nw-showcase-panel`(`-kicker` · `-name` · `-info` · `-status`) · `.nw-showcase-pager`(`-prev` · `-count` · `-next`) · `.nw-showcase-hint`)

- [ ] **Step 1: 실패하는 테스트 추가** — `tests/nowhere-products.test.mjs` 맨 끝에

```js
test('(i) 감상 모드 모듈 · 화면: 스튜디오 무대(RoomEnvironment · 조명 3개) · 조작 · 고해상도 규칙 · 단독 렌더 · CSS', () => {
  const src = readFileSync(new URL('../public/src/nowhere/showcase.js', import.meta.url), 'utf8');
  assert.match(src, /new RoomEnvironment\(\)/);
  assert.match(src, /pmrem\.fromScene\(room/);
  assert.equal((src.match(/new THREE\.DirectionalLight\(/g) || []).length, 3, '키 · 필 · 림 조명 3개');
  assert.match(src, /new OrbitControls\(camera, canvas\)/);
  assert.match(src, /controls\.enablePan = false/);
  assert.match(src, /idle >= AUTO_ROTATE_DELAY/);
  assert.match(src, /stageFraming\(radius, FOV, camera\.aspect\)/);
  assert.match(src, /resolveShowcaseKey\(e\.key\)/);
  assert.match(src, /stopImmediatePropagation\(\)/);
  assert.match(src, /quality\.device !== 'phone'/);
  assert.match(src, /'< BACK'/);
  assert.match(src, /renderer\.render\(scene, camera\)/);
  const css = readFileSync(new URL('../public/src/nowhere/nowhere.css', import.meta.url), 'utf8');
  assert.match(css, /\.nw-showcase \{[^}]*z-index: 32/);
  assert.match(css, /\.nw-showcase-pager \.nw-btn \{[^}]*min-height: 44px/);
  for (const sel of ['.nw-topbar', '.nw-dock', '.nw-interior-hud', '.nw-interior-caption', '.nw-walk-hud', '.nw-spots', '.nw-retail-tags']) {
    assert.ok(css.includes(`body.is-showcase ${sel}`), `감상 중 ${sel} 를 숨기지 않음`);
  }
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/nowhere-products.test.mjs`
Expected: FAIL — (i) `ENOENT … showcase.js`

- [ ] **Step 3: `public/src/nowhere/showcase.js` 작성**

```js
// HAUS NOWHERE — 제품 감상 모드: 실내 대신 따로 띄운 스튜디오 무대(어두운 청회색 배경 · 그라데이션 바닥 원판 · RoomEnvironment 반사 ·
// 키 · 필 · 림 조명 3개)에 제품 하나를 원점에 세우고 돌려 보고 확대한다. 감상 중에는 main.js 가 외관 · 실내 · 후처리 대신 render() 만 부른다.
// 조작: 드래그 · 한 손가락 회전, 휠 · 두 손가락 확대(제품 크기 기준 최소 · 최대 거리), 4 초 동안 입력이 없으면 천천히 자동 회전,
// ← / → · 이전 · 다음 버튼 = 같은 층 진열 순서, Esc · < BACK = 나가기(onClose — main.js 가 연 자리 · 시선 · 보행 여부를 되돌린다).
// 데스크톱 · 태블릿은 -lite 로 먼저 보여 주고 <id>.glb 를 받아 바꾼다. 휴대폰은 -lite 만. 키는 창 캡처 단계에서 먼저 받는다(조작 안내 · 모달이 열려 있으면 그쪽 몫).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { findProduct, floorDisplays, infoRows, breadcrumb, stepProduct, resolveShowcaseKey, stageFraming, AUTO_ROTATE_DELAY } from './products.js';

export const SHOWCASE_FADE_MS = 200;   // 실내 ↔ 감상 무대 화면 전환(어둡게 · 밝게 각각)
const FOV = 30;
const BG = '#1A212B';                 // 어두운 청회색
const EXPOSURE = 1.0;                 // 감상 무대 노출(외관 기상 노출과 따로)
const AUTO_ROTATE_SPEED = 2;          // OrbitControls 단위(60 / 2 = 30 초에 한 바퀴)
const START_AZIMUTH = 28;             // ° — 처음 시선: 정면에서 오른쪽으로
const START_ELEVATION = 14;           // ° — 처음 시선: 조금 위에서
const DISC_SCALE = 4.5;               // 바닥 원판 지름 = 제품 경계 구 반지름 × 이 값

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

let studioEnv = null;
/** 반사용 환경(RoomEnvironment PMREM, 한 번만 만든다) — 진열 제품 재질도 같은 것을 쓴다(retail-display getEnvMap) */
export function studioEnvironment(renderer) {
  if (!studioEnv) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    studioEnv = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
  }
  return studioEnv;
}

// 바닥 원판: 제품 아래는 조금 어둡고(접지감) 바깥으로 옅게 밝아졌다 사라지는 원 — 그림자 패스 없이
function makeFloorDisc() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(6, 9, 13, 0.75)');
  grad.addColorStop(0.2, 'rgba(6, 9, 13, 0.4)');
  grad.addColorStop(0.45, 'rgba(150, 170, 195, 0.12)');
  grad.addColorStop(1, 'rgba(150, 170, 195, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2;
  disc.name = 'NW_ShowcaseDisc';
  return disc;
}

/**
 * getLite(product) → Promise<Object3D | null>(진열이 받아 둔 -lite 원본 — clone 해서 쓴다).
 * isBlocked() → 조작 안내 · 모달이 열려 있으면 감상 키를 처리하지 않는다. onHelp → '조작 안내' 버튼. onClose → 나간 뒤(화면이 어두운 동안) 부른다.
 */
export function createShowcase({ renderer, canvas, quality, fade, getLite, isBlocked = () => false, onHelp = null, onClose = null }) {
  const scene = new THREE.Scene();
  scene.name = 'NW_Showcase';
  scene.background = new THREE.Color(BG);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 50);
  const key = new THREE.DirectionalLight('#FFF3E4', 2.2);
  key.position.set(2.5, 3.0, 2.2);
  const fill = new THREE.DirectionalLight('#DCE7FF', 0.7);
  fill.position.set(-3.0, 1.2, 1.5);
  const rim = new THREE.DirectionalLight('#FFFFFF', 1.6);
  rim.position.set(-0.5, 2.2, -3.2);
  const disc = makeFloorDisc();
  const stage = new THREE.Group();
  scene.add(key, fill, rim, disc, stage);

  // 무대 조작: 실내 카메라와 같은 캔버스 — 감상 중에만 켠다(main.js 가 실내 OrbitControls 를 끈다)
  const controls = new OrbitControls(camera, canvas);
  controls.enabled = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.rotateSpeed = 0.8;
  controls.minPolarAngle = Math.PI * 0.08;
  controls.maxPolarAngle = Math.PI * 0.62;   // 바닥 아래로는 조금만
  controls.autoRotateSpeed = AUTO_ROTATE_SPEED;
  let interacting = false;
  let idle = 0;
  controls.addEventListener('start', () => {
    interacting = true;
    idle = 0;
    controls.autoRotate = false;
  });
  controls.addEventListener('end', () => {
    interacting = false;
    idle = 0;
  });

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const wantHi = quality.device !== 'phone';
  const hiCache = new Map();   // productId → Promise<Object3D | null>

  // 화면: 왼쪽 위 < BACK · 경로, 오른쪽 위 조작 안내, 오른쪽 정보 패널, 아래 이전 · 다음 · 조작 안내 한 줄
  const root = el('div', 'nw-showcase');
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', '제품 감상');
  const top = el('div', 'nw-showcase-top');
  const back = el('button', 'nw-btn nw-showcase-back', '< BACK');
  back.type = 'button';
  const crumbs = el('nav', 'nw-showcase-crumbs');
  crumbs.setAttribute('aria-label', '경로');
  const helpBtn = el('button', 'nw-btn nw-showcase-help', '조작 안내');
  helpBtn.type = 'button';
  helpBtn.append(el('span', 'nw-btn-kbd', '?'));
  top.append(back, crumbs, helpBtn);
  const panel = el('aside', 'nw-showcase-panel');
  const kicker = el('div', 'nw-showcase-kicker');
  const title = el('h2', 'nw-showcase-name');
  const info = el('dl', 'nw-showcase-info');
  const status = el('div', 'nw-showcase-status', '고해상도 불러오는 중…');
  status.hidden = true;
  status.setAttribute('aria-live', 'polite');
  panel.append(kicker, title, info, status);
  const pager = el('div', 'nw-showcase-pager');
  const prevBtn = el('button', 'nw-btn nw-showcase-prev', '‹ 이전');
  prevBtn.type = 'button';
  const count = el('span', 'nw-showcase-count');
  const nextBtn = el('button', 'nw-btn nw-showcase-next', '다음 ›');
  nextBtn.type = 'button';
  pager.append(prevBtn, count, nextBtn);
  const hint = el('div', 'nw-showcase-hint', '드래그 · 한 손가락 회전 · 휠 · 두 손가락 확대 · ← → 다른 제품 · Esc 나가기');
  root.append(top, panel, pager, hint);
  document.body.append(root);

  let active = false;
  let busy = false;
  let catalog = null;
  let floorId = null;
  let productId = null;
  let level = null;   // 'lite' | 'hi'
  let model = null;
  let token = 0;      // 제품을 바꾸거나 나가면 늘린다 — 늦게 도착한 고해상도는 버린다

  function fillInfo(p) {
    const parts = breadcrumb(floorId, p.name);
    crumbs.replaceChildren(
      ...parts.flatMap((t, i) => {
        const s = el('span', i === parts.length - 1 ? 'nw-showcase-crumb is-current' : 'nw-showcase-crumb', t);
        return i ? [el('span', 'nw-showcase-sep', '>'), s] : [s];
      }),
    );
    kicker.textContent = p.category.toUpperCase();
    title.textContent = p.name;
    info.replaceChildren(...infoRows(p).flatMap((r) => [el('dt', null, r.label), el('dd', null, r.value)]));
    const ids = floorDisplays(catalog, floorId).map((d) => d.product.id);
    count.textContent = `${ids.indexOf(p.id) + 1} / ${ids.length}`;
    pager.hidden = ids.length < 2;
  }

  // 제품 경계 상자에 맞춰 카메라 거리 · 확대 한계 · 바닥 원판을 정하고 처음 시선으로
  function frame(box) {
    const size = box.getSize(new THREE.Vector3());
    const radius = size.length() / 2;
    camera.aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    const f = stageFraming(radius, FOV, camera.aspect);
    camera.near = f.near;
    camera.far = f.far;
    camera.updateProjectionMatrix();
    controls.minDistance = f.minDistance;
    controls.maxDistance = f.maxDistance;
    const az = THREE.MathUtils.degToRad(START_AZIMUTH);
    const elv = THREE.MathUtils.degToRad(START_ELEVATION);
    camera.position.set(Math.sin(az) * Math.cos(elv), Math.sin(elv), Math.cos(az) * Math.cos(elv)).multiplyScalar(f.distance);
    controls.target.set(0, 0, 0);
    controls.update();
    disc.scale.setScalar(radius * DISC_SCALE);
    disc.position.y = -size.y / 2 - 0.0005;
    idle = 0;
    controls.autoRotate = false;
  }

  function setModel(obj, lvl, reframe) {
    if (model) stage.remove(model);
    obj.position.set(0, 0, 0);
    const box = new THREE.Box3().setFromObject(obj);
    obj.position.sub(box.getCenter(new THREE.Vector3()));   // 경계 상자 가운데를 원점에
    stage.add(obj);
    model = obj;
    level = lvl;
    status.hidden = lvl === 'hi' || !wantHi;
    if (reframe) frame(box);
  }

  function loadHi(product) {
    if (!hiCache.has(product.id)) {
      hiCache.set(
        product.id,
        loader
          .loadAsync(product.glb)
          .then((g) => g.scene)
          .catch((err) => {
            console.error(`[nowhere] 제품 고해상도 ${product.id} 불러오기 실패`, err);
            return null;
          }),
      );
    }
    return hiCache.get(product.id);
  }

  /** 제품 하나를 무대에: -lite 먼저(진열이 받아 둔 것), 데스크톱 · 태블릿은 고해상도로 바꾼다. 못 보이면 false */
  async function show(id) {
    const product = findProduct(catalog, id);
    if (!product) return false;
    const my = ++token;
    const lite = await getLite(product);
    if (my !== token) return true;   // 그사이 다른 제품으로 넘어갔다
    if (!lite) return false;
    productId = id;
    fillInfo(product);
    setModel(lite.clone(true), 'lite', true);
    if (wantHi) {
      loadHi(product).then((hi) => {
        if (hi && my === token) setModel(hi, 'hi', false);   // 거리 · 시선은 그대로(같은 실제 크기)
        else if (!hi && my === token) status.hidden = true;
      });
    }
    return true;
  }

  function step(dir) {
    if (!active) return;
    const next = stepProduct(catalog, floorId, productId, dir);
    if (next && next !== productId) show(next);
  }

  /** 감상 모드 열기 — 화면을 어둡게 한 뒤 무대로 바꾸고 밝힌다. 열었으면 true */
  async function open({ catalog: cat, floorId: floor, productId: id }) {
    if (active || busy) return false;
    busy = true;
    try {
      await fade.fadeTo(true, '', SHOWCASE_FADE_MS);
      catalog = cat;
      floorId = floor;
      scene.environment = studioEnvironment(renderer);
      if (!(await show(id))) {
        await fade.fadeTo(false, '', SHOWCASE_FADE_MS);
        return false;
      }
      active = true;
      controls.enabled = true;
      root.hidden = false;
      document.body.classList.add('is-showcase');
      await fade.fadeTo(false, '', SHOWCASE_FADE_MS);
      return true;
    } finally {
      busy = false;
    }
  }

  /** 나가기 — 어두운 동안 onClose(실내 카메라 · 보행 되돌리기) */
  async function close() {
    if (!active || busy) return;
    busy = true;
    try {
      await fade.fadeTo(true, '', SHOWCASE_FADE_MS);
      active = false;
      token++;
      controls.enabled = false;
      controls.autoRotate = false;
      root.hidden = true;
      document.body.classList.remove('is-showcase');
      if (typeof onClose === 'function') onClose();
    } finally {
      await fade.fadeTo(false, '', SHOWCASE_FADE_MS);
      busy = false;
    }
  }

  back.addEventListener('click', () => {
    back.blur();
    close();
  });
  prevBtn.addEventListener('click', () => {
    prevBtn.blur();
    step(-1);
  });
  nextBtn.addEventListener('click', () => {
    nextBtn.blur();
    step(1);
  });
  helpBtn.addEventListener('click', () => {
    helpBtn.blur();
    if (typeof onHelp === 'function') onHelp();
  });

  window.addEventListener(
    'keydown',
    (e) => {
      if (!active || e.defaultPrevented || isBlocked()) return;
      const act = resolveShowcaseKey(e.key);
      if (act) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (act === 'close') {
          if (!e.repeat) close();
        } else {
          idle = 0;
          step(act === 'next' ? 1 : -1);
        }
        return;
      }
      // 조작 안내(?) · 성능 표시(P) · ⌘ · Ctrl 조합은 지나가게 하고, 나머지(V · WASD · Space …)는 뒤 보행 · 카메라로 가지 않게 막는다
      if (e.key === '?' || e.key === 'p' || e.key === 'P' || e.metaKey || e.ctrlKey) return;
      e.stopImmediatePropagation();
    },
    true,
  );

  function update(dt) {
    if (!active) return;
    if (!interacting) idle += dt;
    controls.autoRotate = idle >= AUTO_ROTATE_DELAY;
    controls.update(dt);
  }

  function render() {
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    if (Math.abs(camera.aspect - aspect) > 1e-6) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    }
    const exposure = renderer.toneMappingExposure;
    renderer.toneMappingExposure = EXPOSURE;
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
    renderer.toneMappingExposure = exposure;
  }

  return {
    open,
    close,
    update,
    render,
    isActive: () => active,
    isBusy: () => busy,
    getState: () => ({
      active,
      productId,
      level,
      autoRotate: controls.autoRotate,
      distance: camera.position.distanceTo(controls.target),
      minDistance: controls.minDistance,
      maxDistance: controls.maxDistance,
    }),
    scene,
    camera,
    controls,
    element: root,
  };
}
```

- [ ] **Step 4: 감상 화면 CSS** — `nowhere.css` 파일 끝에(방식 고르기 섹션 다음)

```css
/* ── 제품 감상 모드(showcase.js): 스튜디오 무대 위 — 왼쪽 위 < BACK · 경로, 오른쪽 위 조작 안내, 오른쪽 정보 패널, 아래 이전 · 다음 · 조작 안내 한 줄 ── */
.nw-showcase {
  position: fixed;
  inset: 0;
  z-index: 32;
  pointer-events: none;
}
.nw-showcase[hidden],
.nw-showcase-status[hidden],
.nw-showcase-pager[hidden] {
  display: none;
}
.nw-showcase-top {
  position: absolute;
  top: 18px;
  left: 22px;
  right: 22px;
  display: flex;
  align-items: center;
  gap: 14px;
}
.nw-showcase-top > *,
.nw-showcase-panel,
.nw-showcase-pager {
  pointer-events: auto;
}
.nw-showcase-back {
  min-height: 36px;
  font-family: var(--nw-font-mono);
  letter-spacing: 0.06em;
  color: var(--nw-text);
}
.nw-showcase-crumbs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-family: var(--nw-font-mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--nw-text-dim);
}
.nw-showcase-crumb.is-current {
  color: var(--nw-text);
}
.nw-showcase-sep {
  color: var(--nw-line-strong);
}
.nw-showcase-help {
  margin-left: auto;
}
.nw-showcase-panel {
  position: absolute;
  top: 50%;
  right: 22px;
  transform: translateY(-50%);
  width: min(300px, calc(100vw - 44px));
  padding: 16px 18px;
  background: var(--nw-bg-panel);
  border: 1px solid var(--nw-line-struct);
  border-top: 2px solid var(--nw-accent);
  border-radius: 3px;
  backdrop-filter: blur(8px);
}
.nw-showcase-kicker {
  font-family: var(--nw-font-mono);
  font-size: 10.5px;
  letter-spacing: 0.14em;
  color: var(--nw-accent);
}
.nw-showcase-name {
  margin: 4px 0 12px;
  font-size: 22px;
  font-weight: 500;
  color: var(--nw-text);
}
.nw-showcase-info {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 14px;
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
}
.nw-showcase-info dt {
  color: var(--nw-text-dim);
}
.nw-showcase-info dd {
  margin: 0;
  color: var(--nw-text);
  word-break: keep-all;
}
.nw-showcase-status {
  margin-top: 10px;
  font-family: var(--nw-font-mono);
  font-size: 10.5px;
  color: var(--nw-text-dim);
}
.nw-showcase-pager {
  position: absolute;
  left: 50%;
  bottom: 52px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
}
.nw-showcase-pager .nw-btn {
  min-width: 44px;
  min-height: 44px;
}
.nw-showcase-count {
  min-width: 44px;
  text-align: center;
  font-family: var(--nw-font-mono);
  font-size: 12px;
  color: var(--nw-text-dim);
}
.nw-showcase-hint {
  position: absolute;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  font-size: 11.5px;
  color: var(--nw-text-dim);
  white-space: nowrap;
}
@media (max-width: 720px) {
  .nw-showcase-top {
    top: 8px;
    left: 8px;
    right: 8px;
    flex-wrap: wrap;
    gap: 6px 8px;
  }
  .nw-showcase-crumbs {
    order: 2;
    flex: 1 0 100%;
    font-size: 9.5px;
  }
  .nw-showcase-panel {
    top: auto;
    right: 8px;
    bottom: 104px;
    left: 8px;
    width: auto;
    transform: none;
    padding: 10px 12px;
  }
  .nw-showcase-name {
    margin: 2px 0 6px;
    font-size: 17px;
  }
  .nw-showcase-pager {
    bottom: 40px;
  }
  .nw-showcase-hint {
    bottom: 10px;
    width: calc(100vw - 16px);
    white-space: normal;
    text-align: center;
    font-size: 10.5px;
  }
}
/* 감상 중에는 외관 · 실내 UI(상단 바 · 하단 독 · 실내 HUD · 자막 · 보행 안내 · 이동 스팟 · 이름표)를 숨긴다 — 조작 안내 · 모달 · 성능 표시는 그대로 */
body.is-showcase .nw-topbar,
body.is-showcase .nw-dock,
body.is-showcase .nw-interior-hud,
body.is-showcase .nw-interior-caption,
body.is-showcase .nw-walk-hud,
body.is-showcase .nw-spots,
body.is-showcase .nw-retail-tags {
  display: none;
}
```

- [ ] **Step 5: 통과 확인**

Run: `node --check public/src/nowhere/showcase.js && node --test tests/nowhere-products.test.mjs && npm test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: 문법 오류 없음, products 9 개 PASS, `# tests 222`, `# pass 222`, `# fail 0`

- [ ] **Step 6: 브라우저 연기 시험(playwriter, 모듈 단독)** — §3.2 (1) · (2) 로 `http://localhost:4173/nowhere?noIntro=1&cam=street&time=14`(1600 × 900)를 열고, 아직 `main.js` 에 연결하지 않았으므로 모듈을 직접 띄운다(진열 대신 lite 를 바로 받는다).

```js
console.log(await state.page.evaluate(async () => { const { createShowcase } = await import('/src/nowhere/showcase.js'); const { validateCatalog } = await import('/src/nowhere/products.js'); const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'); const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js'); const app = window.__NW_APP; const catalog = validateCatalog(await (await fetch('assets/products/products.json')).json()); const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder); window.__closed = 0; const sc = createShowcase({ renderer: app.renderer, canvas: app.renderer.domElement, quality: app.quality, fade: { fadeTo: async () => {}, setText() {} }, getLite: (p) => loader.loadAsync(p.liteGlb).then((g) => g.scene), isBlocked: () => app.help.isOpen() || app.modal.isOpen(), onHelp: () => app.help.toggle(), onClose: () => { window.__closed++; } }); window.__sc = sc; app.controls.enabled = false; const ok = await sc.open({ catalog, floorId: '1', productId: 'folding-tarx' }); const loop = () => { if (!sc.isActive()) return; requestAnimationFrame(loop); sc.update(1 / 60); sc.render(); }; requestAnimationFrame(loop); return ok; }));
```

  (외관 렌더 뒤 같은 프레임에 무대를 덮어 그린다.) 이어서 짧은 호출로:
  1. 1 s 뒤 `__sc.getState()` → `active true`, `productId 'folding-tarx'`, `level 'hi'`(데스크톱), `.nw-showcase-crumbs` 글이 `SUPREME ORIGIN>Retail>HAUS 성수 1F>Folding Tarx`, `.nw-showcase-info` 에 `폭 154 · 길이 139 · 높이 35 mm`, `.nw-showcase-count` `2 / 3`, `body.is-showcase`. 캡처 `/tmp/retail-t3-tarx.png` 를 보고 제품이 가운데 · 바닥 원판 · 정보 패널이 겹치지 않는지 적는다.
  2. `state.page.keyboard.press('ArrowRight')` 두 번 → `productId` `'veggie-oat'` → `'kant'`, `ArrowLeft` → `'veggie-oat'`.
  3. 입력 없이 2.5 s 씩 두 번 기다린 뒤 `autoRotate === true`, 0.5 s 사이 `__sc.camera.position` 이 바뀜.
  4. `state.page.mouse.move(800, 450)` 뒤 `mouse.wheel(0, -400)` 15 번 → `distance ≈ minDistance`, `autoRotate false`; `wheel(0, 400)` 25 번 → `distance ≈ maxDistance`.
  5. `Shift+Slash` → `.nw-help` 보임 · `active true`, `Escape` → 안내만 닫힘 · `active true`. `v` · `w`(누르고 놓기) → `__NW_APP.camCtrl.isWalkMode()` 그대로.
  6. `Escape` → `active false`, `window.__closed === 1`, `body.is-showcase` 없음. 끝으로 `__NW_APP.controls.enabled = true`.
  결과를 보고서에 적는다.

- [ ] **Step 7: 스테이징(커밋하지 않음) — 리뷰 통과 뒤 컨트롤러가 실행**

```bash
git add public/src/nowhere/showcase.js public/src/nowhere/nowhere.css tests/nowhere-products.test.mjs
```

커밋 메시지 안: `feat(nowhere): 제품 감상 모드 무대(showcase.js) — 스튜디오 장면 · 회전 · 확대 · 자동 회전 · 고해상도 교체 · 경로 · 정보 패널`

---

### Task 4: 1F 진열(`retail-display.js`) · 실내 · 렌더 루프 연결

**Files:**
- Create: `public/src/nowhere/retail-display.js`
- Modify: `public/src/nowhere/interior.js:40`(인자), `:172-200`(`loadFloor`), `:299-300`(`showFloor` 끝), `:419-420`(`exit`)
- Modify: `public/src/nowhere/main.js:25`(import), `:219`(마커 일시 정지), `:231-250`(진열 · 실내 인자 · 감상 · 성능 표시), `:311-314`(`arriveAt` 끝 · 열기 · 복원), `:522-529`(`animate`), `:545` · `:572`(`app` · `getStats`)
- Modify: `public/src/nowhere/nowhere.css`(파일 끝에 이름표)
- Test: `tests/nowhere-products.test.mjs`((j) 추가)

**Interfaces:**
- Consumes: Task 2(`PRODUCTS_URL` · `validateCatalog` · `floorDisplays` · `PLINTH` · `COVER` · `GLOW` · `PRODUCT_CENTER_Y` · `LABEL_RANGE` · `LABEL_LIFT` · `PICK_RANGE` · `interiorSpots(floor, catalog)`), Task 3(`createShowcase` · `studioEnvironment`), 기존 `interior.currentFloor()` · `isBusy()` · `isTouring()` · `showCaption()`, `camCtrl.setWalkMode` · `placeAt` · `placeWalk` · `cancelWalkTo` · `clearInput` · `isWalkMode` · `controls`, `markObstacleMeshes(occ, meshes, groundAt)`
- Produces:
  - `createRetailDisplay({ camera, canvas, getEnvMap, onOpen(productId), isSuspended }) → { loadCatalog() → Promise<catalog>, catalog() → catalog | null, liteSource(product) → Promise<Object3D|null>, build(floorDef) → Promise<{ group, obstacles: [plinths, covers] } | null>, setFloor(floorId | null), update(), element }`
  - 층 장면 이름: `NW_Retail_<floor>`(그룹) · `NW_RetailPlinths_<floor>` · `NW_RetailCovers_<floor>` · `NW_RetailProduct_<id>`, DOM `.nw-retail-tags` · `.nw-retail-tag`(`-name` · `-more`)
  - `createInterior({ …, retail = null })`
  - `app.retail` · `app.showcase` · `app.openShowcase(productId)`, `getStats().showcase`(감상 중인 제품 id | null)

- [ ] **Step 1: 실패하는 테스트 추가** — `tests/nowhere-products.test.mjs` 맨 끝에

```js
test('(j) 진열 · 연결: 진열 그리기 2 + 제품 · 장애물 · 고르기, interior 층 진열 · 점유 격자, main 렌더 전환 · 제품 스팟 도착 · 복원', () => {
  const read = (f) => readFileSync(new URL(`../public/src/nowhere/${f}`, import.meta.url), 'utf8');
  const rd = read('retail-display.js');
  assert.match(rd, /mergeGeometries\(plinthGeos\)/);
  assert.match(rd, /mergeGeometries\(coverGeos\)/);
  assert.match(rd, /covers\.renderOrder = 1/);
  assert.match(rd, /return \{ group, obstacles: \[plinths, covers\] \}/);
  assert.match(rd, /raycaster\.far = PICK_RANGE/);
  assert.match(rd, /<= LABEL_RANGE/);
  assert.match(rd, /e\.stopImmediatePropagation\(\);\s*onOpen\(best\.product\.id\)/);
  const interior = read('interior.js');
  assert.match(interior, /retail\.build\(def\)/);
  assert.match(interior, /markObstacleMeshes\(occ, shelf \? \[\.\.\.solids, \.\.\.shelf\.obstacles\] : solids, groundAt\)/);
  assert.match(interior, /retail\?\.setFloor\(def\.id\)/);
  assert.match(interior, /retail\?\.setFloor\(null\)/);
  const main = read('main.js');
  assert.match(main, /createRetailDisplay\(/);
  assert.match(main, /createShowcase\(/);
  assert.match(main, /interiorSpots\(def, retail\.catalog\(\)\)/);
  assert.match(main, /spot\.kind === 'product' && interior\.isActive\(\)\) \{\s*openShowcase\(spot\.product\)/);
  assert.match(main, /if \(studio\) \{\s*showcase\.update\(dt\);\s*showcase\.render\(\);\s*\} else \{\s*world\.followSun\(camera\);\s*post\.composer\.render\(\);/);
  assert.match(main, /camCtrl\.controls\.enabled = false/);
  assert.match(main, /camCtrl\.placeWalk\(r\.pos\[0\], r\.pos\[2\], look\)/);
  const css = readFileSync(new URL('../public/src/nowhere/nowhere.css', import.meta.url), 'utf8');
  assert.match(css, /\.nw-retail-tag \{[^}]*min-height: 44px/);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/nowhere-products.test.mjs`
Expected: FAIL — (j) `ENOENT … retail-display.js`

- [ ] **Step 3: `public/src/nowhere/retail-display.js` 작성**

```js
// HAUS NOWHERE — 리테일 진열(실내 층): products.json 의 그 층 진열마다 무광 석재 받침대 + 윗면 발광 판 + 유리 덮개를 런타임으로 만들고
// 제품 -lite GLB 를 실제 크기로 덮개 안(눈높이 약 1.15 m)에 정면이 yaw 쪽을 보게 앉힌다(실내 Blender 빌드 · 층 GLB 는 그대로).
// 그리기: 받침대 + 발광 판 1(emissiveMap 두 칸 — 조명을 늘리지 않는 자체 발광) · 덮개 1(한 번에 그리기 · 그림자 없음) · 제품 lite 재질 수.
// build(floorDef) 가 { group, obstacles } 를 돌려주면 interior.js loadFloor 가 층 장면에 붙이고 점유 격자(보행 장애물)에 더한다.
// 고르기: 캔버스 클릭 · 탭(끌기 없이) · 보행 마우스 고정 중 조준점 클릭 · 4 m 안 이름표(DOM '자세히 보기') → onOpen(productId).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PRODUCTS_URL, validateCatalog, floorDisplays, PLINTH, COVER, GLOW, PRODUCT_CENTER_Y, LABEL_RANGE, LABEL_LIFT, PICK_RANGE } from './products.js';

const CLICK_SLOP = 5;   // px — 이보다 많이 끌었으면 둘러보기 드래그(클릭 아님)
const STONE = '#8E8981';
const GLOW_COLOR = '#FFF1DA';

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// 받침대 재질의 emissiveMap: 왼쪽 칸 검정(석재 — 발광 없음) · 오른쪽 칸 흰색(발광 판). 면마다 UV 를 한 칸에 몰아 고른다
function makeGlowMap() {
  const tex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255]), 2, 1);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// 상자(가로 w · 높이 h ·깊이 d)를 (x, y, z) 가운데 · yaw 회전으로. u 를 주면 모든 UV 를 (u, 0.5) 로(발광 칸 고르기)
function boxAt(w, h, d, x, y, z, yawRad, u = null) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (u !== null) {
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u, 0.5);
  }
  g.rotateY(yawRad);
  g.translate(x, y, z);
  return g;
}

/**
 * getEnvMap(): 제품 재질 반사(감상 무대와 같은 RoomEnvironment — 모바일 실내는 HDRI 가 없어 금속이 검게 보이지 않게).
 * isSuspended(): 감상 모드 · 모달 · 조작 안내 · 화면 전환 · 둘러보기 중이면 이름표를 숨기고 클릭을 받지 않는다.
 */
export function createRetailDisplay({ camera, canvas, getEnvMap = () => null, onOpen, isSuspended = () => false }) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  let catalog = null;
  let catalogPromise = null;
  const liteSources = new Map();   // productId → Promise<THREE.Object3D | null>(진열 · 감상이 clone 해서 쓴다)
  const shelves = new Map();       // floorId → { group, pickables, displays, tags }
  let current = null;

  const plinthMat = new THREE.MeshStandardMaterial({
    color: STONE,
    roughness: 0.92,
    metalness: 0,
    emissive: GLOW_COLOR,
    emissiveIntensity: 1.1,
    emissiveMap: makeGlowMap(),
  });
  const coverMat = new THREE.MeshStandardMaterial({
    color: '#EEF4F7',
    roughness: 0.04,
    metalness: 0,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });

  const root = el('div', 'nw-retail-tags');
  root.hidden = true;
  document.body.append(root);

  function loadCatalog() {
    if (!catalogPromise) {
      catalogPromise = fetch(PRODUCTS_URL)
        .then((r) => {
          if (!r.ok) throw new Error(`products.json ${r.status}`);
          return r.json();
        })
        .then((json) => (catalog = validateCatalog(json)));
    }
    return catalogPromise;
  }

  /** 제품 -lite GLB(한 번만 받는다). 실패하면 null — 그 제품만 빠진다 */
  function liteSource(product) {
    if (!liteSources.has(product.id)) {
      const p = loader
        .loadAsync(product.liteGlb)
        .then((gltf) => {
          const env = getEnvMap();
          gltf.scene.traverse((n) => {
            if (!n.isMesh) return;
            for (const m of Array.isArray(n.material) ? n.material : [n.material]) {
              if (env && 'envMap' in m) m.envMap = env;
            }
          });
          return gltf.scene;
        })
        .catch((err) => {
          console.error(`[nowhere] 제품 ${product.id} 불러오기 실패`, err);
          return null;
        });
      liteSources.set(product.id, p);
    }
    return liteSources.get(product.id);
  }

  /** 그 층 진열을 만든다. 진열이 없으면 null. 받침대 · 덮개 메시는 obstacles(보행 장애물)로 */
  async function build(floorDef) {
    const ds = floorDisplays(await loadCatalog(), floorDef.id);
    if (!ds.length) return null;
    const plinthGeos = [];
    const coverGeos = [];
    for (const d of ds) {
      const [x, y, z] = d.pos;
      const r = (d.yaw * Math.PI) / 180;
      plinthGeos.push(boxAt(PLINTH.width, PLINTH.height, PLINTH.depth, x, y + PLINTH.height / 2, z, r, 0.25));
      plinthGeos.push(boxAt(GLOW.width, GLOW.height, GLOW.depth, x, y + PLINTH.height + GLOW.height / 2, z, r, 0.75));
      coverGeos.push(boxAt(COVER.width, COVER.height, COVER.depth, x, y + PLINTH.height + COVER.height / 2, z, r));
    }
    const plinths = new THREE.Mesh(mergeGeometries(plinthGeos), plinthMat);
    const covers = new THREE.Mesh(mergeGeometries(coverGeos), coverMat);
    for (const g of [...plinthGeos, ...coverGeos]) g.dispose();
    plinths.name = `NW_RetailPlinths_${floorDef.id}`;
    covers.name = `NW_RetailCovers_${floorDef.id}`;
    covers.renderOrder = 1;   // 덮개 안 제품의 투명 재질(렌즈)을 먼저 그리고 유리를 위에
    const group = new THREE.Group();
    group.name = `NW_Retail_${floorDef.id}`;
    group.add(plinths, covers);

    const sources = await Promise.all(ds.map((d) => liteSource(d.product)));
    ds.forEach((d, i) => {
      if (!sources[i]) return;
      const model = sources[i].clone(true);
      const center = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
      model.position.sub(center);   // 경계 상자 가운데를 받침 점으로
      const holder = new THREE.Group();
      holder.name = `NW_RetailProduct_${d.product.id}`;
      holder.position.set(d.pos[0], d.pos[1] + PRODUCT_CENTER_Y, d.pos[2]);
      holder.rotation.y = (d.yaw * Math.PI) / 180;
      holder.add(model);
      group.add(holder);
    });

    const tags = ds.map((d) => {
      const btn = el('button', 'nw-retail-tag');
      btn.type = 'button';
      btn.hidden = true;
      btn.setAttribute('aria-label', `${d.product.name} 자세히 보기`);
      btn.append(el('span', 'nw-retail-tag-name', d.product.name), el('span', 'nw-retail-tag-more', '자세히 보기'));
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        btn.blur();   // 포커스가 남으면 Space(보행 점프)가 이 버튼을 다시 누른다
        onOpen(d.product.id);
      });
      return { d, btn, shown: false, sx: NaN, sy: NaN };
    });
    shelves.set(floorDef.id, { group, pickables: [plinths, covers], displays: ds, tags });
    return { group, obstacles: [plinths, covers] };
  }

  /** 지금 보이는 층(interior.js showFloor · exit). 그 층 진열만 이름표 · 클릭을 받는다 */
  function setFloor(floorId) {
    current = (floorId && shelves.get(floorId)) || null;
    root.replaceChildren(...(current ? current.tags.map((t) => t.btn) : []));
    for (const t of current?.tags || []) {
      t.shown = false;
      t.btn.hidden = true;
    }
  }

  // 이름표: 진열에서 LABEL_RANGE 안이고 화면 안이면 덮개 위에
  const v = new THREE.Vector3();
  function update() {
    if (!current || isSuspended()) {
      root.hidden = true;
      return;
    }
    root.hidden = false;
    camera.updateMatrixWorld();
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const eye = camera.position;
    for (const t of current.tags) {
      const [x, y, z] = t.d.pos;
      let show = Math.hypot(x - eye.x, z - eye.z) <= LABEL_RANGE;
      if (show) {
        v.set(x, y + PLINTH.height + COVER.height + LABEL_LIFT, z).project(camera);
        show = v.z > -1 && v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1;
      }
      if (show !== t.shown) {
        t.btn.hidden = !show;
        t.shown = show;
      }
      if (!show) continue;
      const sx = Math.round((v.x * 0.5 + 0.5) * w);
      const sy = Math.round((-v.y * 0.5 + 0.5) * h);
      if (sx !== t.sx || sy !== t.sy) {
        t.btn.style.transform = `translate(${sx}px, ${sy}px)`;
        t.sx = sx;
        t.sy = sy;
      }
    }
  }

  // 클릭 · 탭 고르기 — 캡처 단계에서 먼저 받아, 제품을 맞혔으면 보행 화면 클릭의 마우스 고정 요청 · 스팟 조준 클릭을 막는다
  const raycaster = new THREE.Raycaster();
  raycaster.far = PICK_RANGE;
  const ndc = new THREE.Vector2();
  const down = { x: 0, y: 0 };
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      down.x = e.clientX;
      down.y = e.clientY;
    },
    true,
  );
  canvas.addEventListener(
    'click',
    (e) => {
      if (!current || isSuspended()) return;
      const locked = document.pointerLockElement === canvas;
      if (locked) ndc.set(0, 0);   // 마우스 고정 중에는 화면 가운데 조준점
      else {
        if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > CLICK_SLOP) return;
        const r = canvas.getBoundingClientRect();
        ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      }
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(current.pickables, false)[0];
      if (!hit) return;
      let best = null;
      let bestD = Infinity;
      for (const d of current.displays) {
        const dd = Math.hypot(hit.point.x - d.pos[0], hit.point.z - d.pos[2]);
        if (dd < bestD) {
          bestD = dd;
          best = d;
        }
      }
      e.stopImmediatePropagation();
      onOpen(best.product.id);
    },
    true,
  );

  return { loadCatalog, catalog: () => catalog, liteSource, build, setFloor, update, element: root };
}
```

- [ ] **Step 4: `interior.js` — 인자** — `export function createInterior({ … onFloorChange = null }) {` 머리 줄을

```js
export function createInterior({ renderer, camera, camCtrl, post, world, quality, modal, weather = null, exteriorScene, isHelpOpen = () => false, onChange = null, fade = null, onFloorChange = null, retail = null }) {
```

  로 바꾼다.

- [ ] **Step 5: `interior.js` — `loadFloor` 에서 진열 받기 · 붙이기 · 장애물** — 세 군데를 바꾼다.
  - `const url = quality.tier === 'mobile' && def.mobileGlb ? def.mobileGlb : def.glb;` 다음 줄(`const gltf = await loader.loadAsync(url, (e) => {` 앞)에

```js
    // 리테일 진열(products.json 의 이 층 — 받침대 · 덮개 · 제품 lite)은 층 GLB 와 함께 받는다. 실패해도 층은 연다(진열만 빠짐)
    const shelfPromise = retail
      ? retail.build(def).catch((err) => {
        console.error('[nowhere] 진열 불러오기 실패', err);
        return null;
      })
      : Promise.resolve(null);
```

  - `root.traverse((n) => { … });` 블록이 끝난 다음, `const [x0, z0, x1, z1] = def.bounds;` 바로 앞에

```js
    // 진열은 층 장면에 붙여 층과 함께 보이고 사라진다(showFloor). 받침대 · 덮개는 아래 점유 격자에 보행 장애물로 더한다
    const shelf = await shelfPromise;
    if (shelf) {
      root.add(shelf.group);
      shelf.group.updateMatrixWorld(true);
    }
```

  - `markObstacleMeshes(occ, solids, groundAt);` 를

```js
    markObstacleMeshes(occ, shelf ? [...solids, ...shelf.obstacles] : solids, groundAt);
```

- [ ] **Step 6: `interior.js` — 층 알림** — `showFloor` 끝의

```js
    setCaption('');
    if (typeof onFloorChange === 'function') onFloorChange(def);   // 보행 이동 스팟을 이 층 것으로
```

  를

```js
    setCaption('');
    retail?.setFloor(def.id);   // 이 층 진열만 이름표 · 클릭을 받는다
    if (typeof onFloorChange === 'function') onFloorChange(def);   // 보행 이동 스팟을 이 층 것으로
```

  로, `exit()` 의

```js
      setCaption('');
      if (typeof onFloorChange === 'function') onFloorChange(null);   // 보행 이동 스팟을 외관 것으로
```

  를

```js
      setCaption('');
      retail?.setFloor(null);
      if (typeof onFloorChange === 'function') onFloorChange(null);   // 보행 이동 스팟을 외관 것으로
```

  로 바꾼다.

- [ ] **Step 7: `main.js` — import** — `import { createModeController } from './modes.js';` 다음에

```js
import { createRetailDisplay } from './retail-display.js';
import { createShowcase, studioEnvironment } from './showcase.js';
```

- [ ] **Step 8: `main.js` — 마커 일시 정지** — `createSpotMarkers({ … })` 의 `isSuspended` 줄을

```js
    isSuspended: () => spotCutting || modal.isOpen() || help.isOpen() || interior.isBusy() || interior.isTouring() || showcase.isActive() || showcase.isBusy(),
```

  로 바꾼다.

- [ ] **Step 9: `main.js` — 진열 · 실내 인자 · 감상 · 성능 표시** — `const interior = createInterior({` 줄 바로 앞에

```js
  // 리테일 진열(실내 1F — products.json): 받침대 · 덮개 · 제품 lite, 클릭 · 탭 · 조준점 · 4 m 안 이름표 → 감상 모드
  const retail = createRetailDisplay({
    camera,
    canvas,
    getEnvMap: () => studioEnvironment(renderer),
    onOpen: (id) => openShowcase(id),
    isSuspended: () => spotCutting || modal.isOpen() || help.isOpen() || interior.isBusy() || interior.isTouring() || showcase.isActive() || showcase.isBusy(),
  });
```

  `createInterior({ … })` 인자의 `onFloorChange: (def) => markers.setSpots(def ? interiorSpots(def) : exteriorSpotList),` 줄을

```js
    retail,
    onFloorChange: (def) => markers.setSpots(def ? interiorSpots(def, retail.catalog()) : exteriorSpotList),
```

  로 바꾸고, `createInterior({ … });` 가 끝난 다음 줄(`// 성능 표시: P 키로 켜고 끈다.` 주석 앞)에

```js
  // 제품 감상 모드: 따로 띄운 스튜디오 무대 — 감상 중에는 이 장면만 그린다(animate). 나가면 연 자리 · 시선 · 보행 여부로 되돌린다
  let showcaseReturn = null;   // { pos, target, walking }
  const showcase = createShowcase({
    renderer,
    canvas,
    quality,
    fade,
    getLite: (product) => retail.liteSource(product),
    isBlocked: () => help.isOpen() || modal.isOpen(),
    onHelp: () => help.toggle(),
    onClose: () => restoreFromShowcase(),
  });
```

  를 넣고, `const perf = createPerfHud({ renderer, getScenes: () => [scene, interior.scene], tier: quality.tier });` 를

```js
  const perf = createPerfHud({ renderer, getScenes: () => [scene, interior.scene, showcase.scene], tier: quality.tier });
```

  로 바꾼다.

- [ ] **Step 10: `main.js` — 제품 스팟 도착 · 열기 · 복원** — `arriveAt` 끝의

```js
    } else if (spot.caption && interior.isActive() && !interior.isTouring()) {
      interior.showCaption(spot.caption, 4000);
    }
  }
```

  를 다음으로 바꾼다(함수 두 개를 바로 뒤에 더한다)

```js
    } else if (spot.kind === 'product' && interior.isActive()) {
      openShowcase(spot.product);   // 제품 스팟에 도착하면 감상 모드
    } else if (spot.caption && interior.isActive() && !interior.isTouring()) {
      interior.showCaption(spot.caption, 4000);
    }
  }

  // ── 제품 감상 모드: 연 자리(위치 · 시선 · 보행 여부)를 적어 두고 보행 · 실내 카메라를 멈춘 뒤 무대를 연다 ──
  async function openShowcase(productId) {
    const catalog = retail.catalog();
    const floorId = interior.currentFloor();
    if (!catalog || !floorId || showcase.isActive() || showcase.isBusy() || interior.isBusy() || spotCutting) return;
    showcaseReturn = { pos: camera.position.toArray(), target: camCtrl.controls.target.toArray(), walking: camCtrl.isWalkMode() };
    camCtrl.cancelWalkTo();
    camCtrl.clearInput();
    if (showcaseReturn.walking) camCtrl.setWalkMode(false);   // 보행 키 · 마우스 고정 · 스팟 · 보행 안내를 멈춘다(나올 때 다시 켠다)
    camCtrl.controls.enabled = false;                          // 무대 드래그 · 휠이 실내 카메라를 돌리지 않게
    interior.showCaption('');
    const opened = await showcase.open({ catalog, floorId, productId });
    if (!opened) restoreFromShowcase();
  }

  // 감상 모드를 나온 뒤(화면이 어두운 동안): 연 자리 · 시선 그대로, 보행 중이었으면 보행으로
  function restoreFromShowcase() {
    const r = showcaseReturn;
    showcaseReturn = null;
    camCtrl.controls.enabled = true;
    if (!r || !interior.isActive()) return;
    camCtrl.placeAt(r.pos, r.target);
    if (r.walking) {
      camCtrl.setWalkMode(true);
      // 보행을 켜면 시선이 수평으로 바뀌므로 연 순간의 시선(위 · 아래 포함)을 다시 맞춘다 — 시선 방향으로 멀리 둔 점을 본다
      const look = r.target.map((v, i) => r.pos[i] + (v - r.pos[i]) * 10);
      camCtrl.placeWalk(r.pos[0], r.pos[2], look);
    }
  }
```

- [ ] **Step 11: `main.js` — 렌더 루프** — `animate()` 의

```js
    camCtrl.update(dt);
    if (cinema.isActive() && camCtrl.isIntroActive()) cinema.progress(camCtrl.getIntroProgress());   // 인트로 진행 선(경과 / 12 초) — 끝난 뒤 띠가 빠지는 동안 0 으로 되돌지 않게
    interior.update(dt);
    markers.update(dt);

    renderer.info.reset();
    world.followSun(camera);
    post.composer.render();
```

  를 다음으로 바꾼다

```js
    // 감상 중에는 실내 카메라 · 실내 갱신을 멈추고 감상 무대만 그린다(외관 · 실내 · 후처리 없음)
    const studio = showcase.isActive();
    if (!studio) {
      camCtrl.update(dt);
      if (cinema.isActive() && camCtrl.isIntroActive()) cinema.progress(camCtrl.getIntroProgress());   // 인트로 진행 선(경과 / 12 초) — 끝난 뒤 띠가 빠지는 동안 0 으로 되돌지 않게
      interior.update(dt);
    }
    markers.update(dt);
    retail.update();

    renderer.info.reset();
    if (studio) {
      showcase.update(dt);
      showcase.render();
    } else {
      world.followSun(camera);
      post.composer.render();
    }
```

- [ ] **Step 12: `main.js` — `app` · `getStats`** — `app` 객체의 `markers,` 다음 줄에

```js
    retail,
    showcase,
    openShowcase,
```

  를, `getStats()` 반환의 `floor: interior.currentFloor(),` 다음 줄에

```js
        showcase: showcase.isActive() ? showcase.getState().productId : null,
```

  를 더한다.

- [ ] **Step 13: 이름표 CSS** — `nowhere.css` 파일 끝(Task 3 의 감상 화면 섹션 앞이나 뒤 어디든)에

```css
/* ── 리테일 진열 이름표(retail-display.js): 진열 4 m 안 덮개 위 — 제품 이름 + 자세히 보기(누르면 감상 모드) ── */
.nw-retail-tags {
  position: fixed;
  inset: 0;
  z-index: 17;
  overflow: hidden;
  pointer-events: none;
}
.nw-retail-tags[hidden],
.nw-retail-tag[hidden] {
  display: none;
}
.nw-retail-tag {
  position: absolute;
  left: 0;
  top: 0;
  translate: -50% -100%;   /* transform translate(x, y) 가 가리키는 점 = 이름표 아래 가운데 */
  min-width: 44px;
  min-height: 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 6px 12px;
  background: var(--nw-bg-panel-strong);
  border: 1px solid var(--nw-line-struct);
  border-top: 2px solid var(--nw-accent);
  border-radius: 2px;
  color: var(--nw-text);
  font-family: var(--nw-font-sans);
  white-space: nowrap;
  cursor: pointer;
  pointer-events: auto;
  -webkit-tap-highlight-color: transparent;
  animation: nw-spot-in 0.2s ease;
}
.nw-retail-tag:hover {
  border-color: var(--nw-accent);
}
.nw-retail-tag-name {
  font-size: 13px;
  font-weight: 600;
}
.nw-retail-tag-more {
  font-family: var(--nw-font-mono);
  font-size: 10.5px;
  letter-spacing: 0.06em;
  color: var(--nw-accent);
}
```

- [ ] **Step 14: 통과 확인**

Run: `node --check public/src/nowhere/retail-display.js && node --check public/src/nowhere/interior.js && node --check public/src/nowhere/main.js && npm test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: 문법 오류 없음, `# tests 223`, `# pass 223`, `# fail 0`

- [ ] **Step 15: 브라우저 연기 시험(playwriter)** — §3.2 (1) · (2) 로 `http://localhost:4173/nowhere?noIntro=1&cam=street&time=14`(1600 × 900):
  1. `await __NW_APP.interior.enter('haus')`(evaluate 한 호출, 30 s 제한) → `getStats().floor === '1'`, `__NW_APP.interior.scene.getObjectByName('NW_Retail_1').children.map((c) => c.name)` 가 받침대 · 덮개 · 제품 3 개, 콘솔에 '진열 불러오기 실패' · '불러오기 실패' 없음.
  2. 진열 시점 `__NW_APP.camCtrl.placeWalk(-6.5, 12, [-6.5, 1.15, 8])` → 0.6 s 뒤 `getStats()` 의 `calls` · `triangles` 를 적고, `NW_Retail_1.visible = false` → 0.4 s 뒤 다시 적고 되돌린다. 차이가 그리기 +12 · 삼각형 ≤ +70 K 인지. `.nw-retail-tag` 중 Folding Tarx 만 보이는지(4 m 안), `.nw-spot` 이름에 `Kant` · `Folding Tarx` · `Veggie Oat` 가 있는지.
  3. 장애물: `const ctx = __NW_APP.camCtrl.getWalkContext()` 로 `ctx.blocker.isBlocked(x, z, 0.35)` 가 받침대 가운데 (−4, 8) · (−6.5, 8) · (−9, 8) 에서 true, 스팟 (−4, 9.2) · (−6.5, 9.2) · (−9, 9.2) 에서 false.
  4. `placeWalk(-6.5, 11.5, [-6.5, 1.1, 8])` 뒤 캡처(`/tmp/retail-t4-row.png` — 가운데 받침대 몸통이 화면 (800, 650) 근처) → `state.page.mouse.click(800, 650)`(실제 마우스 클릭 — 보행 중 빈 화면 클릭이면 마우스 고정이 걸리는 자리) → 1 s 뒤 `showcase.getState().active === true`, `productId 'folding-tarx'`, `document.pointerLockElement === null`, `getStats().calls` 가 한 자리 수.
  5. `Escape` → 0.7 s 뒤 `active false`, `camCtrl.isWalkMode() === true`, `camera.position` (−6.5, 1.7, 11.5), `controls.target` (−6.5, 1.278, 9.036)(±0.001), `.nw-interior-hud` 보임, `.nw-walk-hud` 보임, `controls.enabled === true`.
  6. `placeWalk(0, 13, [-4, 1.2, 8])` → `.nw-spot[aria-label="Kant"]` 를 DOM `click()` → 콘솔 '스팟 길 찾기 1_product_kant', 2.5 s 안에 `showcase.getState().productId === 'kant'` → `.nw-showcase-back` 클릭 → 위치가 스팟 (−4, 9.2) 에서 0.3 m 안, 보행.
  7. 보이는 `.nw-retail-tag` 를 DOM `click()` → 감상 열림 → `Escape`.
  8. `&tier=mobile`(390 × 844)로 다시 열어 실내 진입 → `__NW_APP.openShowcase('veggie-oat')` → `level 'lite'`, `performance.getEntriesByType('resource')` 에 `/assets/products/*.glb`(‑lite 아닌 것) 없음, 캡처 `/tmp/retail-t4-390.png` 에서 제품이 화면 폭 안에 다 들어옴.
  결과를 보고서에 적는다.

- [ ] **Step 16: 스테이징(커밋하지 않음) — 리뷰 통과 뒤 컨트롤러가 실행**

```bash
git add public/src/nowhere/retail-display.js public/src/nowhere/interior.js public/src/nowhere/main.js public/src/nowhere/nowhere.css tests/nowhere-products.test.mjs
```

커밋 메시지 안: `feat(nowhere): HAUS 성수 1F 제품 진열 — 받침대 · 유리 덮개 · 이름표 · 클릭 · 제품 스팟으로 감상 모드, 나가면 그 자리 · 시선 · 보행 그대로`

---

### Task 5: 조작 안내 · README

**Files:**
- Modify: `public/src/nowhere/help.js:55-57`(`CONTROL_SECTIONS` 끝 — `walk` 묶음 다음에 '제품 감상' 묶음)
- Modify: `README.md`(1 절 조작 표 두 행)
- Test: `tests/nowhere-help.test.mjs`((a) 묶음 목록, (i) 추가)

**Interfaces:**
- Consumes: Task 3 · 4 의 동작 · 문구(`< BACK` · '자세히 보기' · `←`/`→` · `Esc` · 자동 회전 4 초)
- Produces: `CONTROL_SECTIONS[3] = { id: 'showcase', title: '제품 감상', kicker: 'PRODUCT VIEW', rows, note }`(조작 안내 네 번째 묶음 — 3 열 격자의 둘째 줄)

- [ ] **Step 1: 실패하는 테스트** — `tests/nowhere-help.test.mjs` 의 (a) 머리 두 줄

```js
test('(a) 조작 안내는 공통·카메라 시점·보행 시점 세 묶음이고 행마다 키와 설명이 있다', () => {
  assert.deepEqual(CONTROL_SECTIONS.map((s) => s.id), ['common', 'camera', 'walk']);
```

  을

```js
test('(a) 조작 안내는 공통·카메라 시점·보행 시점·제품 감상 네 묶음이고 행마다 키와 설명이 있다', () => {
  assert.deepEqual(CONTROL_SECTIONS.map((s) => s.id), ['common', 'camera', 'walk', 'showcase']);
```

  로 바꾸고, 파일 끝에

```js
test('(i) 제품 감상 안내: 고르기(클릭 · 탭 · 조준점 · 이름표 · 제품 스팟) · 회전 · 자동 회전 · 확대 · 이전 · 다음 · 나가기', () => {
  const sc = CONTROL_SECTIONS.find((s) => s.id === 'showcase');
  assert.ok(sc, '제품 감상 묶음 없음');
  assert.equal(sc.title, '제품 감상');
  const descs = sc.rows.map((r) => r.desc).join('\n');
  for (const re of [/자세히 보기/, /제품 스팟/, /조준점/, /자동 회전/, /확대 · 축소/, /이전 · 다음/, /< BACK/, /보행 그대로/]) assert.match(descs, re);
  const keys = new Set(sc.rows.flatMap((r) => r.keys));
  for (const k of ['클릭', '탭', '드래그', '한 손가락', '휠', '두 손가락', '←', '→', 'Esc']) assert.ok(keys.has(k), `감상 안내에 '${k}' 없음`);
  assert.match(sc.note, /고해상도/);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/nowhere-help.test.mjs`
Expected: FAIL — (a) 묶음 목록 불일치, (i) '제품 감상 묶음 없음'

- [ ] **Step 3: `help.js` — '제품 감상' 묶음** — `CONTROL_SECTIONS` 의 마지막 묶음(`walk`) 끝

```js
    note: '건물 · 바위 등 장애물과 50° 넘는 비탈은 지나갈 수 없습니다.',
  },
];
```

  을 다음으로 바꾼다

```js
    note: '건물 · 바위 등 장애물과 50° 넘는 비탈은 지나갈 수 없습니다.',
  },
  {
    id: 'showcase',
    title: '제품 감상',
    kicker: 'PRODUCT VIEW',
    rows: [
      { keys: ['클릭', '탭'], desc: '실내 1F 제품 진열(받침대 · 유리 덮개) — 제품 · 받침대를 클릭 · 탭(마우스 고정 중에는 조준점을 맞추고 클릭), 4 m 안 이름표 「자세히 보기」, ◇ 제품 스팟에 도착하면 감상 모드' },
      { keys: ['드래그', '한 손가락'], desc: '감상 모드: 제품 돌려 보기 — 4 초 동안 입력이 없으면 천천히 자동 회전' },
      { keys: ['휠', '두 손가락'], desc: '감상 모드: 확대 · 축소(제품 크기에 맞춘 가장 가까이 · 가장 멀리)' },
      { keys: ['←', '→'], desc: '감상 모드: 같은 층 진열 순서로 이전 · 다음 제품(화면의 ‹ 이전 · 다음 › 버튼과 같음)' },
      { keys: ['Esc'], desc: '감상 모드 나가기(< BACK 과 같음) — 연 자리 · 시선 · 보행 그대로 실내로' },
    ],
    note: '이름 · 실측 크기 · 재질만 보여 줍니다. 데스크톱 · 태블릿은 고해상도 모델로 바꿔 보여 주고, 휴대폰은 가벼운 모델만 씁니다.',
  },
];
```

- [ ] **Step 4: README 조작 표** — `README.md` 의 `| 실내(성수 B1F · 1F · 12F · 13F) | …` 행 바로 아래에 두 행

```markdown
| 제품 진열(실내 1F) | 로비 정문 왼쪽에 받침대 3개 — Kant · Folding Tarx · Veggie Oat(실제 크기, 유리 덮개 안, 정면이 정문 쪽). 제품 · 받침대를 클릭 · 탭(끌기 없이, 마우스 고정 중에는 조준점을 맞추고 클릭), 4 m 안에 뜨는 이름표 「자세히 보기」, 또는 ◇ 제품 스팟(받침대 앞)에 도착하면 감상 모드. 받침대는 보행 장애물 |
| 제품 감상 모드 | 실내 대신 스튜디오 무대에 제품 하나 — 드래그 · 한 손가락으로 회전, 휠 · 두 손가락으로 확대 · 축소(제품 크기에 맞춘 한계), 4 초 동안 입력이 없으면 천천히 자동 회전, `←`/`→` · `‹ 이전` · `다음 ›` 으로 같은 층 진열 순서, `Esc` · `< BACK` 으로 나가면 연 자리 · 시선 · 보행 그대로. 왼쪽 위 경로 `SUPREME ORIGIN > Retail > HAUS 성수 1F > <제품명>`, 오른쪽 정보(이름 · 실측 크기 · 재질 — 설명 · 컬렉션 · 컬러는 받은 것만). 데스크톱 · 태블릿은 고해상도로 바꿔 보여 주고 휴대폰은 가벼운 모델만. `?` 조작 안내 · `P` 성능 표시는 그대로 |
```

- [ ] **Step 5: 통과 확인**

Run: `node --test tests/nowhere-help.test.mjs && npm test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: help 9 개 PASS, `# tests 224`, `# pass 224`, `# fail 0`

- [ ] **Step 6: 브라우저 연기 시험(playwriter)** — §3.2 (1) · (2) 로 `http://localhost:4173/nowhere?noIntro=1` 에서 `state.page.keyboard.press('Shift+Slash')` → `.nw-help` 보임, `document.querySelector('.nw-help').textContent` 에 `제품 감상` · `PRODUCT VIEW` · `자세히 보기` 가 있고 네 번째 `.nw-help-section` 이 화면 안(스크롤해서라도)에 있다. `Escape` 로 닫는다. 결과를 보고서에 적는다.

- [ ] **Step 7: 스테이징(커밋하지 않음) — 리뷰 통과 뒤 컨트롤러가 실행**

```bash
git add public/src/nowhere/help.js README.md tests/nowhere-help.test.mjs
```

커밋 메시지 안: `docs(nowhere): 조작 안내 · README — 제품 진열 · 감상 모드`

---

### Task 6: 브라우저 확인 · 진열 · 단순화 조정 · 예산 · FPS → CP

**Files:**
- Modify(CP 결정이 있을 때만): `public/assets/products/products.json`(`displays[].pos` · `yaw`, `materials` 문구), `public/src/nowhere/products.js`(`PRODUCT_CENTER_Y` 만), `public/src/nowhere/retail-display.js`(`STONE` · `GLOW_COLOR` · `plinthMat.emissiveIntensity` · `coverMat.opacity`), `public/src/nowhere/showcase.js`(`BG` · `EXPOSURE` · 조명 세기 · 위치 · `START_AZIMUTH` · `START_ELEVATION` · `AUTO_ROTATE_SPEED` · `DISC_SCALE` · 원판 색 멈춤점), `tools/nowhere/products.mjs`(`SIMPLIFY_ERRORS` · `remap` — 바꾸면 `npm run nowhere:products` 로 GLB 도 다시)
- 캡처: `build/nowhere/compare/retail-*.png`(git 이 무시하는 `build/`)
- 테스트는 고치지 않는다(조정 뒤에도 전부 통과해야 한다 — 자리를 옮기면 (h) 가 거리를 다시 검사한다)

**Interfaces:**
- Consumes: Task 1–5 전부
- Produces: CP 자료(캡처 21 장, 예산 · 다운로드 · FPS 표), 조정된 값, 보고서

- [ ] **Step 1: 준비** — 서버 :4173 확인(`lsof -i :4173`, 없으면 `npm start` 백그라운드). §3.2 의 (1) · (2) · (3) 을 쓴다. 캡처는 `state.page.screenshot({ path: '/Users/gm_yeonho/new-work/so/so-viewer-monster1267/build/nowhere/compare/retail-<이름>.png' })`(절대 경로, 쓰기가 막히면 `/tmp` 에 저장 후 Bash `mv`). Bash 로 `pmset -g batt` · `ps -A -o %cpu,comm | sort -rn | head` 를 적어 둔다 — 배터리 전원이면 FPS 를 재기 전에 사용자에게 알리고 전원 연결을 기다린다.

- [ ] **Step 2: 1F 진열 캡처(데스크톱 1600 × 900)** — `/nowhere?noIntro=1&cam=street&time=14` → `await __NW_APP.interior.enter('haus')`:
  1. 진입 시점 그대로(정문 안 (0, 1.7, 13)) → `retail-1f-entry.png`(Kant 받침대가 첫 화면 왼쪽 끝에 보이는지).
  2. `placeWalk(-6.5, 12.5, [-6.5, 1.1, 8])` → `retail-1f-row.png`.
  3. `placeWalk(-4, 9.2, [-4, 1.15, 8])` → 이름표 `Kant` 가 덮개 위 → `retail-1f-kant-close.png`.
  4. `placeWalk(2.5, 10, [-6.5, 1.1, 8])`(옆에서 한 줄) → `retail-1f-side.png`.
  5. `__NW_APP.setTimeOfDay(21.5, true)` → 3 s 뒤 2 번 시점 → `retail-1f-row-night.png`(발광 판이 밤에 은은한지), `setTimeOfDay(14, true)` 로 되돌린다.
  장마다 보이는 것 · 문제(받침대가 전시물 · 동선을 막음, 제품이 덮개 밖, 유리가 너무 진함 등)를 적는다.

- [ ] **Step 3: 예산(그리기 · 삼각형)** — 데스크톱 · `&tier=tablet` · `&tier=mobile` 각각 실내 1F 에서 세 시점(Step 2 의 1 · 2 · 4 번)마다 아래를 실행해 표로 적는다.

```js
console.log(JSON.stringify(await state.page.evaluate(async () => { const app = window.__NW_APP; const g = app.interior.scene.getObjectByName('NW_Retail_1'); const s = []; for (const v of [true, false]) { g.visible = v; await new Promise((r) => setTimeout(r, 400)); const x = app.getStats(); s.push({ shelf: v, calls: x.calls, tris: x.triangles }); } g.visible = true; return s; })));
```

  기준: 차이 그리기 ≤ +12 · 삼각형 ≤ +70 K(세 등급 모두). 넘으면 넘은 시점 · 양을 적고 CP 에서 묻는다(이 단계에서 줄이지 않는다).

- [ ] **Step 4: 고르기 · 감상 흐름(데스크톱)** — Task 4 Step 15 의 2–7 을 다시 하고 결과를 표로 적는다. 더해서:
  1. 보행 마우스 고정 조준점: 빈 바닥을 클릭해 `document.pointerLockElement` 가 생기면 `placeWalk(-6.5, 10.5, [-6.5, 0.6, 8])`(받침대 몸통을 화면 가운데에) 뒤 `state.page.mouse.click(800, 450)` → 감상 열림 · 잠금 풀림. 자동화에서 잠금이 걸리지 않으면 그 사실을 적고 사용자 확인 항목으로 남긴다.
  2. 감상 중 `P` → 성능 표시가 보이고 `getStats().calls` 가 3 안팎(무대만 그림), `.nw-topbar` · `.nw-interior-hud` · `.nw-spots` · `.nw-walk-hud` 가 `display: none`.
  3. 실내에서 `V` 로 보행을 끈 궤도 시점에서 받침대 클릭 → 감상 → `Escape` → 보행 꺼진 채 같은 위치 · 시선.
  4. `__NW_APP.interior.goToFloor('12')` → 12F 에 진열 · 이름표 없음, `goToFloor('1')` → 다시 보임.
  5. DS2: `/nowhere-mountain?noIntro=1` 에서 `interior.enter('haus')` → `NW_Retail_1` 있음, 받침대 클릭 → 감상 → `Escape`.

- [ ] **Step 5: 감상 캡처 · 단순화 확인(데스크톱 1600 × 900)** — 제품마다 `__NW_APP.openShowcase('<id>')` → 1.5 s 뒤 `level === 'hi'` 확인 → `retail-<id>-hi.png`. 이어서 확대 두 장(경첩 · 코받침):

```js
await state.page.evaluate((side) => { const s = window.__NW_APP.showcase; s.controls.target.set(side * 0.065, 0.004, 0.06); s.camera.position.set(side * 0.2, 0.05, 0.16); s.controls.update(); }, 1);
```

  → 0.6 s 뒤 `retail-<id>-hinge.png`, 같은 방식으로 `target (0, -0.01, 0.06)` · `position (0, -0.04, 0.22)` → `retail-<id>-nosepad.png`. 다음 제품은 `→` 로 넘긴다(넘기면 시선이 처음으로 돌아간다). 장마다 경첩 · 코받침 · 렌즈 테 모양이 무너졌는지, 렌즈 투명도 · 금속 반사가 자연스러운지 적는다.

- [ ] **Step 6: lite · 태블릿 · 휴대폰**
  1. `&tier=mobile`(390 × 844): 1F 진열 시점(Step 2 의 2 번) → `retail-mobile-1f-390.png`; 제품마다 감상(`level 'lite'`) → `retail-<id>-lite.png`(데스크톱 lite 비교용으로 1600 × 900 에서도 한 번씩 찍어도 된다); 받은 자원에 고해상도 `<id>.glb` 없음; `.nw-retail-tag` · `.nw-showcase-pager .nw-btn` 의 `getBoundingClientRect()` 높이 ≥ 44; 감상 화면에서 정보 패널 · 이전 · 다음 · 안내가 겹치지 않고 제품이 화면 폭 안 → `retail-mobile-showcase-390.png`.
  2. `&tier=tablet`(1180 × 820): 1F 진열 → `retail-tablet-1f.png`, 감상(`level 'hi'`) → `retail-tablet-showcase.png`.
  3. 실내 진입 추가 다운로드: 크기는 Bash `stat -f %z public/assets/products/*-lite.glb` 합(기준 ≤ 2.4 MB — Task 1 테스트 (a) 도 검사)으로 적고, 브라우저에서는 데스크톱 · `&tier=mobile` 모두 실내 진입 전 `performance.getEntriesByType('resource')` 에 `/assets/products/` 요청이 없고, 진입 뒤 `products.json` + `-lite.glb` 3 개뿐(감상을 열기 전 고해상도 `<id>.glb` 없음)인지 본다(브라우저 캐시 때문에 전송량은 재지 않는다).

- [ ] **Step 7: FPS(전원 연결)** — 데스크톱 · `&tier=tablet` 각각: ① 1F 보행 진열 시점(Step 2 의 2 번)에서 ② 감상 모드 자동 회전 중에 2 s 씩 다섯 번

```js
console.log(JSON.stringify(await state.page.evaluate(async () => { const xs = []; for (let i = 0; i < 4; i++) { await new Promise((r) => setTimeout(r, 500)); xs.push(window.__NW_APP.getStats().fps); } return xs; })));
```

  (한 호출 2 s — 다섯 번 되풀이)평균을 낸다. 기준 ≥ 60. `pmset -g batt` 와 `ps -A -o %cpu,comm | sort -rn | head` 를 함께 적는다.

- [ ] **Step 8: 바꾸지 않을 것 확인**

Run: `git diff --stat main -- tools/nowhere/blender public/assets/nowhere public/assets/nowhere-ds2 public/assets/nowhere-inner public/src/nowhere/world.js public/src/nowhere/weather.js public/src/nowhere/post.js public/src/nowhere/sky.js public/src/nowhere/surface.js public/src/nowhere/camera.js`
Expected: 출력 없음

- [ ] **Step 9: 보고서 + CP 자료** — 캡처 21 장 경로와 장별 관찰, 예산 표(등급 × 시점 × 진열 있음/없음), 다운로드 합, FPS 표(전원 · 부하 포함), 고르기 · 복원 결과표, 사용자 확인 항목(실제 포인터 잠금 클릭, 아이패드 실기기 탭 · 두 손가락 확대), 찾은 문제(고칠 곳 · 이유).

- [ ] **Step 10: CP — 여기서 멈춘다.** 컨트롤러가 §3.3 대로 사용자에게 묻고 답을 §3.3 "결과"에 적는다. 바꿀 것이 없으면 Step 11 을 건너뛴다.

- [ ] **Step 11: CP 반영** — 답에 따라 Files 의 값만 바꾼다. 자리를 옮기면 `node --test tests/nowhere-products.test.mjs` 로 (h) 거리를 먼저 확인하고, 단순화 · 재질 바꾸기를 바꾸면 `npm run nowhere:products` 를 다시 돌려 표를 새로 적는다. 바뀐 화면만 다시 캡처해 전 · 후를 보고서에 붙인다.

- [ ] **Step 12: 테스트 · 스테이징**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: `# tests 224`, `# pass 224`, `# fail 0`

  바꾼 파일이 있을 때만(리뷰 통과 뒤 컨트롤러가 실행 — 실제로 바뀐 경로만):

```bash
git add public/assets/products/products.json public/src/nowhere/products.js public/src/nowhere/retail-display.js public/src/nowhere/showcase.js
```

  (`npm run nowhere:products` 를 다시 돌렸으면 `tools/nowhere/products.mjs` 와 바뀐 `public/assets/products/*.glb` 도 경로로 더한다. 바꾸지 않았으면 스테이징할 것이 없다.) 커밋 메시지 안: `tune(nowhere): 리테일 진열 · 감상 무대 조정(CP 반영)`

- [ ] **Step 13: 최종 보고** — 조정 전 · 후 값, 최종 예산 · FPS 표, 캡처 경로 목록, 남은 사용자 확인 항목. 컨트롤러는 이어서 `opus` 최종 리뷰(브랜치 전체 `git diff main...feat/retail-showcase`)를 돌린다.
