# 성수 2041 미래 모습(레퍼런스 기반 재구성) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자가 준 레퍼런스 이미지처럼, 붉은 벽돌 성수를 살린 채 녹색·태양광·새 교통이 겹친 "맑은 미래 성수"로 성수 2041 월드를 다시 짓는다.

**Architecture:** 지금 파이프라인을 그대로 쓴다. Blender 헤드리스 스크립트가 GLB 4종과 `layout.json`을 만들고, three.js가 셰이더 패치로 그린다. 바뀌는 것은 레이어의 의미다.
- `NW_present`는 "복원된 성수"다. 쇠퇴 기호를 걷어내고 녹화한다.
- `NW_future`는 "새로 더한 층"이다. 타워, 튜브 열차, 스카이브리지, 스마트 거리, 움직이는 것들이 여기에 들어간다.
- `NW_backdrop`은 유리 스카이라인이 된다.
- 웹에는 맑음 기상(적운, 해 그림자)과 경로 이동체(`movers`)를 더한다.

지난 시안 A–D는 같은 흐린 거리에서 재질만 바꿨다. 이번에는 빛, 형상, 움직임을 바꾼다.

**Tech Stack:** Blender 5.3 (헤드리스 Python + MCP `look`), three.js r170(정적 vendor, import map), glTF + meshopt + WebP(`@gltf-transform/cli@4.1.1`), Node `node:test`, playwriter(브라우저 확인).

## Global Constraints

- **정적 사이트를 유지한다.** 빌드 단계는 없다(`npm start` = `serve public`). 새 JS는 `public/src/nowhere/`에만 둔다.
- **좌표:** Blender (x, y, z) → three (x, z, −y). 이 문서의 배치 값은 따로 적지 않으면 Blender 좌표(미터)다. 테스트와 `layout.json`은 three 좌표를 쓴다.
- **출하 소재:** Poly Haven CC0이거나 스크립트가 그린 텍스처만 쓴다.
  - 실존 브랜드·로고·상표 문구는 쓰지 않는다. 게임 고유 형태(삼각 드론, 하트형 신호, 안드로이드 표식)도 쓰지 않는다. 간판 글자는 우리가 지은 문구만 쓴다.
  - 레퍼런스 이미지는 `build/nowhere/ref/`(git 무시)에만 둔다. 저장소 문서나 출하물에 넣지 않는다.
- **두 건물:** HAUS NOWHERE(`public/assets/gm_building.glb`)와 FaceArch(`public/assets/facearch.glb`) 원본은 수정하지 않는다. 두 건물이 화면의 주인공이다. 새 타워는 거리 시점(`street`)에서 투영 높이가 HAUS의 0.6배 이하로 보여야 한다.
- **예산(기존 유지):**
  - 전송량: 데스크톱 ≤ 40 MB, 모바일 ≤ 22 MB. 두 건물을 포함하며 `tests/nowhere-assets.test.mjs`가 검사한다.
  - 화면 기준 draw call: 데스크톱 ≤ 300, 모바일 ≤ 180.
  - 삼각형: 데스크톱 ≤ 2.0 M, 모바일 ≤ 0.9 M.
  - FPS: 데스크톱 ≥ 55(Apple M 계열, 1440p, 탭이 앞에 있을 때 `?stats=1`로 잰다).
- **텍스처:** 그린 텍스처는 한 장 ≤ 1024 px다. 타워 커튼월 아틀라스만 1024 × 2048을 쓴다. WebP 변환은 `nowhere:optimize`가 한다.
- **DS2 월드(`?ver=ds2`)는 바꾸지 않는다.** 기본 기상, 프리셋, 자산 모두 그대로다. 맑음 버튼은 DS2에서 숨긴다.
- **UI 문구는 한국어다.**
- **서브에이전트 모델은 Claude 5.5 이상만 쓴다.** Blender 태스크는 `opus`, 웹 태스크와 태스크 리뷰는 `sonnet`, 최종 리뷰는 `opus`다.
- **git:** 작업 브랜치는 `feat/seongsu-2041-future`다. 성능 표시(P 키)가 필요하므로 `feat/walk-hint-dock`(5b942c2)에서 분기한다.
  - 커밋은 사용자가 실행을 시작하며 태스크 단위 커밋을 승인한 경우에만 한다.
  - 승인이 없으면 각 태스크 끝의 커밋 단계는 "관련 파일만 경로로 `git add` + 커밋 메시지 제시"로 대신한다. `git add -A`는 쓰지 않는다.
  - 커밋 메시지 끝에는 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`을 붙인다.

---

## 1. 왜 다시 짓나

지금 성수가 "낡은 성수"로 읽히는 이유는 벽 재질보다 아래 세 가지다.

1. **빛:** 흐린 회백 하늘, 짙은 안개, 젖은 노면, 틈마다 낀 이끼(데스 스트랜딩 문법).
2. **쇠퇴 기호:** 전신주 37본과 처진 전선, 옥상 물탱크, 벽 실외기, 내려진 셔터, '임대문의'·'성수철물' 광고판, 쓰러진 공사 가림막, 덮개 씌운 차.
3. **비어 있는 도시:** 하늘에 새 구조물이 없고, 거리에는 움직이는 것이 없다.

레퍼런스는 벽돌을 그대로 두고 이 세 가지를 바꾼다. 맑은 해, 깨끗한 벽돌에 담쟁이, 뒤편의 유리·녹화 타워, 고가 튜브 열차, 스카이브리지, 태양광 노면, 포드와 드론이 그 수단이다. 이 계획도 같은 순서로 바꾼다.

이 계획은 2026-10-30 계획의 §2.1 비율 규칙("현재 85~90 %, 근미래 10~15 %")과 §6.3의 "흐림 기본"을 성수 월드에 한해 대체한다.

## 2. 레퍼런스 → 성수 2041 대응

| 레퍼런스 요소 | 지금 성수 | 2041에서 | 태스크 |
|---|---|---|---|
| 맑은 파란 하늘, 흰 적운, 해 그림자 | 흐림(회백 하늘·안개), 그림자 없음 | 성수 기본 기상 '맑음', 적운, 데스크톱 해 그림자 | 1, 2 |
| 전선 없는 하늘 | 전신주·전선·변압기 | 지중화. 모두 철거 | 3 |
| 깨끗한 붉은 벽돌, 유리 상점 | 그을음·빗물 얼룩·하단 이끼, 셔터 | 같은 매스와 벽돌, 오염 35 %, 셔터는 유리 상점, 2041 간판 | 4 |
| 정돈된 녹지 | 철거 후 방치된 빈터 | 포켓 공원(잔디, 산책로, 물길 정원, 느티나무) | 4 |
| 담쟁이, 수직정원 | 없음 | 벽돌 10면에 담쟁이, 옆벽 3면에 수직정원 | 5 |
| 초록 가로수와 화분 | 노란 은행나무 몇 그루 | 여름 은행나무, 느티나무, 화분형 가로수 | 5 |
| 지붕 태양광, 옥상정원 | 회색 지붕·물탱크·실외기 | 박공 남향면 태양광, 평지붕은 태양광 + 정원, 아파트 발코니 식재 | 6 |
| 유리 고층과 테라스 녹화 | 회색 상자 타워(원경) | 원경 커튼월 재도장, 고가 북쪽·동쪽에 신축 타워 4동 | 7, 8 |
| 옥상 소형 풍력 | 없음 | T1·T4 옥상 5기(회전) | 8, 11 |
| 고가 튜브 열차 | 2호선 벽돌 아치 고가 | 같은 고가 위 유리 튜브 + 흰 열차 2편성(주행) | 9, 11 |
| 보행 스카이브리지 | 없음 | 동쪽 골목 1, 뚝섬로 1 | 9 |
| 태양광 노면, 청록 발광선 | 마모된 차선 | 뚝섬로 가운데 태양광 띠, 차선·연석·골목 청록 발광선 | 10 |
| 투명 키오스크, 파라솔, 벤치 | 정류장 키오스크 1 | 키오스크 6, 카페 테라스, 화분·벤치 | 10 |
| 자율주행 포드, 배송로봇 | 정지한 둥근 택시 3대 | 포드 5대 주행, 배송로봇 3대 | 10, 11 |
| 소포 단 배송 드론 | 드론 4대(28~46 m) | 드론 6대(소포, 둘은 16~24 m로 거리에서 보이게) | 11 |
| 보행자 | 없음 | 이번 범위 밖(D4) | — |

**화면 비율 목표**(`CAM_future` 기준):
- 복원된 기존 건물 40~50 %
- 녹색 20~30 %
- 새 구조와 장치 25~35 %
- 하늘 25 % 안팎

## 3. 결정(권장값으로 썼다 — 실행 전에 바꿀 수 있다)

- **D1. 성수 기본 기상은 맑음이다.** 흐림·비·눈은 선택지로 남긴다. DS2는 흐림 기본 그대로이고 맑음 버튼을 숨긴다.
- **D2. 전신주와 전선은 지중화로 모두 철거한다.** 가로등과 신호기둥은 남긴다.
- **D3. 빈터는 포켓 공원이 된다.** 현무암 조경석 일부와 물길은 공원 조경으로 남긴다.
- **D4. 보행자는 이번 범위 밖이다.** CP2 화면을 보고 "건축 모형식 무채색 인물"을 넣을지 따로 정한다.
- **D5. 지난 시안 A–D의 재질 교체는 쓰지 않는다.** 유약 벽돌, 흰 세라믹, 목재 외벽이 여기에 해당한다.

## 4. 배치

### 4.1 지도(Blender 좌표, +Y 북)

```
 y 190…245   ┌T1 −40,205 128m┐   ┌T2 30,228 104m┐      ┌T3 110,196 84m┐          (장면 사각형 밖, 원경 BD_mid 를 비운 대지)
 y 150…160 ══ 2호선 고가 + 유리 튜브(x −300…22.8, 91.2…420; 승강장 22.8…91.2 은 기존 지붕) + 열차 2편성 ══════════════
 y 138…147    고가 하부 가로 ── 포드 고리 ── 카페 테라스(B6 북쪽)
 y 106…131    B5  [B6 카페]║SB1║[B10]                                                         T4 205,40 116m ┐
 y 70         북쪽 이면도로(포드 없음, 가로수 화분)            동쪽 골목 x 70(포드 고리 · 배송로봇 · 드론 d5)   │(x 190…220)
 y 32…62      연립 V1…V8                                      ║                                        ┘
 y −22…40     [HAUS 0,0]   포켓 공원(x 28…66) ═ CAM_future(70, 8) 북쪽을 본다 ═  FaceArch(105,15)
 y −35.5…−48.5  뚝섬로: 가운데 태양광 띠 y −43…−41, 청록 발광선, 포드(바깥 차로 wrap · 안쪽 차로 고리)   SB2(x 128…131.2)
 y −57…−78     남측 상가, MX 9F                                                    ═ SB2 남쪽 끝 = MX 북면
 y −80…−127    아파트 3동(발코니 식재 띠, 옥상 태양광)
```

### 4.2 새 구조물 수치

**타워(`NW_future`, 객체 `FU_tower_<id>`, `nw_solid=1`).** 층고는 1층 6.0 m, 나머지 4.0 m다.

| id | 중심 | 평면 x × y (m) | 높이 | 형태 | 옥상 |
|---|---|---|---|---|---|
| T1 | (−40, 205) | 32 × 26 | 128 | 직육면체. 40 m·80 m에서 사방 2 m 셋백 테라스(유리 난간 1.1 m, 가장자리 화단) | 태양광 + 풍력 3기 |
| T2 | (30, 228) | 28 × 28 | 104 | 모서리 반지름 6 m 둥근 사각. 3층마다 발코니 식재 띠(깊이 0.6, 높이 0.5) | 옥상정원 |
| T3 | (110, 196) | 36 × 22 | 84 | 3단 계단식: 0–40 m 전체, 40–64 m 북쪽 2/3, 64–84 m 북쪽 1/3. 계단 윗면은 정원 | 태양광 캐노피 |
| T4 | (205, 40) | 30 × 30 | 116 | 직육면체. 꼭대기 8 m는 크라운 정원(유리 난간 + 화단, 108 m 바닥) | 풍력 2기 |

- **풍력 터빈:**
  - 마스트 `FU_turbine_mast.<n>`: 원통 r 0.18, 높이 8 m, 나셀 1.2 × 0.6 × 0.6.
  - 회전자 `FU_turbine_rotor.<n>`: 날개 3장(길이 2.8 m) + 허브. 회전축은 Blender 로컬 +X다.
  - 모든 터빈은 방위 200°를 본다.
- **대지:** `backdrop.py`의 `BD_mid`가 타워 사각형 + 12 m 여유 안에 건물을 놓지 않는다(Task 7).

**2호선 유리 튜브(`NW_future`).** 고가 상판은 y 150…160, 상면 z 9.0이다.
- **단면 `TUBE_PROFILE`**(y는 고가 중심 155 기준, z는 절대 높이):
  `[(-4.7, 9.0), (-4.7, 11.6), (-3.3, 13.9), (-1.2, 15.0), (1.2, 15.0), (3.3, 13.9), (4.7, 11.6), (4.7, 9.0)]`
- **구간:** `TUBE_SPANS = [(-300.0, 22.8), (91.2, 420.0)]`. 승강장 구간 22.8…91.2는 기존 녹색 지붕을 그대로 둔다.
  - 원경 `BD_infra`가 같은 단면의 단순 외피로 `VIA_EXT`(−760…780)까지 잇는다.
- **객체:**
  - 리브 `FU_tube_ribs_w`/`_e`: 강재, 5.5 m 간격, 단면 0.2 × 0.3. `nw_solid=1`.
  - 유리 `FU_tube_glass_w`/`_e`: 재질 `NWF_tube_glass`(색 `#BFD8E6`, 알파 0.22, 거칠기 0.05). 그림자를 드리우지 않는다.
  - 등줄기 LED `FU_tube_led`: 꼭대기 안쪽 폭 0.08 m, 밤 발광.
  - 상판 바깥 화단 `FU_tube_planter_*`: y 149.2…150.3, 159.7…160.8, 상면 z 9.6. 위에 늘어진 덩굴 카드(0.8 m)를 단다.
- **열차 `FU_train_a`(궤도 y 152.6), `FU_train_b`(y 157.4):**
  - 바닥 z 9.3. 4량이며 1량은 17.0 × 2.9 × 3.4다. 차량 사이 0.6 m, 양 끝은 둥근 코(2.2 m), 전장 69.8 m.
  - 차체는 흰색 `#EEF1F2`. 창 띠는 차량 바닥 위 1.2–2.4 m에 두고 밤에 켠다. 청록 띠 `#39C6E0`는 0.12 m.
  - 앞은 로컬 +X다. 양 끝이 같은 모양이라 뒤로 달려도 돌지 않는다.

**스카이브리지(`NW_future`).** 상판과 기둥을 다른 객체로 둔다. 둘 다 `nw_solid=1`이다. 기둥까지 한 상자로 묶으면 그 아래 차도가 "막힘"이 되기 때문이다.

| id | 상판 x | 상판 y | 상판 윗면 / 두께 | 기둥(지름) | 비고 |
|---|---|---|---|---|---|
| SB1 | 64.0 … 76.0 | 112.0 … 115.2 | 9.0 / 0.45 | (65.0, 113.6), (75.4, 113.6) (0.45) | B6 박공 끝벽 ↔ B10 서면. 동쪽 골목을 건넌다 |
| SB2 | 128.0 … 131.2 | −60.0 … −29.0 | 10.0 / 0.5 | (129.6, −33.6), (129.6, −54.2) (0.6) | E1a 남면 ↔ MX 북면. 뚝섬로를 건넌다. 6 m마다 화단 |

- 공통 부재:
  - 유리 난간: 1.1 m, 알파 0.3, 상부 강재 레일.
  - 하부: 흰 소핏, 양 가장자리에 청록 LED 선.
- 객체 이름:
  - 상판: `FU_bridge_SB1_deck`, `FU_bridge_SB2_deck`
  - 기둥: `FU_bridge_SB1_col.0`, `FU_bridge_SB1_col.1`, `FU_bridge_SB2_col.0`, `FU_bridge_SB2_col.1`

**스마트 노면(`NW_future`).**
- **태양광 띠 `FU_road_pv`:**
  - 뚝섬로 가운데 y −43.0…−41.0. 노면 높이 + 0.008 m의 리본이며, 장면 안 높이는 `GroundZ`로 5 m마다 읽는다.
  - x −260…420. 횡단보도 x −16.5…−11.5와 교차로 x −108…−102, 67…73에서 끊는다.
  - 장면 밖(x < −112, x > 162)은 `backdrop.py`의 'tt' 노면 높이를 쓴다.
- **청록 발광선 `FU_road_led`:**
  - 폭 0.10 m, 색 `#39C6E0`, 낮 0.5 / 밤 2.2.
  - 뚝섬로: y −35.75, −48.25(연석 안쪽), −43.05, −40.95(태양광 띠 가장자리).
  - 동쪽 골목: x 67.25, 72.75, y −31.5…135.
  - 북쪽 이면도로: y 67.25, 72.75, x −102…67.
  - 횡단보도와 교차로에서 끊는다. 기존 `FU_crossing_*`의 `#43ABA7`도 `#39C6E0`으로 맞춘다.

### 4.3 거리 소품 배치 규칙

모든 새 소품 자리는 `present.free_spot(x, y, r, tall)`(Task 4)를 통과해야 한다. 이 함수는 건물 사각형 + 0.3 m, 차도 띠, 횡단보도, HAUS 전정, FaceArch 대지(중심 (105, 15), 반경 15 m)를 피한다. 키 큰 것(`tall=True`, > 1.2 m)은 아래 시선 원뿔 안에 두지 않는다.

| 원뿔 | 꼭짓점 | 방위(북 = 0°, 시계 방향) | 최대 거리 |
|---|---|---|---|
| 거리 시점 → HAUS | (−105, −50.2) | 46° … 80° | 110 m |
| HAUS 접근 시점 | (0, −46) | −35° … 35° | 21 m |
| FaceArch 접근 시점 | (77.6, −32.6) | 10° … 50° | 50 m |

- **배송로봇 길:** 뚝섬로 북측 보도 y −32.9…−31.5는 비운다. 이 보도의 소품은 y ≤ −33.6에 둔다.
- 후보 좌표는 아래와 같다. 통과하지 못하면 ±3 m 안에서 옮긴다. 그래도 안 되면 뺀다. 최종 좌표는 보고서에 남긴다.

| 소품 | 후보 |
|---|---|
| 화분형 가로수(느티나무, 화분 1.4 × 1.4 × 0.5) | 뚝섬로 북측 y −34.5: x −96, 36, 52, 98, 114, 146. 북쪽 이면도로 남측 보도 y 64.5: x −90, −70, −40, −5, 30 |
| 공원 느티나무 | (36, −13), (48, −14), (60, −6), (35, 10), (62, 16), (31, 34), (47, 37), (61, 34). 산책로·물웅덩이에서 2.5 m 이상 |
| 투명 키오스크 | 뚝섬로 북측 (−96, −34.2), (40, −34.2), 남측 (−30, −50.9), (90, −50.9), 골목 동측 (74.6, 20), (74.6, 60) |
| 카페 테라스(파라솔 + 탁자 + 의자 3) | B6 북쪽 보도 y 131.0: x 28, 36, 44, 52. 공원 북쪽 (38, 33), (44, 31) |
| 벤치 | 공원 산책로 6곳, 뚝섬로 북측 x 70, 130 |

### 4.4 이동체 경로

이동체는 모두 단일 사용자 메시를 쓴다. 링크 복제는 쓰지 않는다. gltf-transform의 `--instance`가 같은 메시 노드를 합쳐 이름을 지우기 때문이다.

| id | 종류 | 객체 | 모드 | 속도 | 경로 |
|---|---|---|---|---|---|
| pod_e1, pod_e2 | pod | `FU_taxi.0`, `FU_taxi.1` | wrap | 10.0, 8.5 | 뚝섬로 바깥 동행 차로 y −46.875: x −260 → 420 (위상 0, 0.5) |
| pod_w1 | pod | `FU_taxi.2` | wrap | 9.5 | 서행 차로 y −40.375: x 420 → −260 |
| pod_l1, pod_l2 | pod | `FU_taxi.3`, `FU_taxi.4` | loop | 8.0 | 반시계 고리. 아래 설명 참고(위상 0, 0.5) |
| train_a, train_b | train | `FU_train_a`, `FU_train_b` | pingpong | 16.0, 14.0 | x −700 ↔ 700, y 152.6 / 157.4, z 9.3 (위상 0, 0.5) |
| bot0 | bot | `FU_bot.0` | pingpong, flipYaw | 1.4 | 뚝섬로 북측 보도 y −32.2: x −95 ↔ 60 |
| bot1 | bot | `FU_bot.1` | pingpong, flipYaw | 1.5 | 동쪽 골목 동측 보도 x 74.2: y −28 ↔ 132 |
| bot2 | bot | `FU_bot.2` | loop | 1.2 | 공원 산책로 `PARK_PATH` |
| sec, d1, d2, d3 | drone | `FU_drone_sec`, `FU_drone_d1…d3` | loop | 기존 `DRONE_SPEED` | 기존 `DRONE_PATHS` |
| d4 | drone | `FU_drone_d4` | loop | 9.0 | (−80,−42,18) (0,−40,20) (80,−44,18) (150,−42,22) (80,−38,24) (0,−46,22) (−80,−40,20) |
| d5 | drone | `FU_drone_d5` | loop | 7.0 | (70,−20,16) (70,60,18) (70,130,17) (66,170,24) (40,120,22) (64,40,20) |
| turbine_0…4 | spin | `FU_turbine_rotor.0…4` | — | rpm 18 | — |

- **pod_l 고리:** 서쪽 이면도로 남행(x −106.5) → 뚝섬로 안쪽 동행 차로(y −43.625) → 동쪽 골목 북행(x 70.0) → 고가 하부 가로 서행(y 144.5)으로 돈다.
  - 모서리는 반지름 6 m 원호로 펴고, 1.5 m마다 점을 둔다.
  - 모서리 점: (−106.5, −37.6)→(−100.5, −43.625), (64.0, −43.625)→(70.0, −37.6), (70.0, 138.5)→(64.0, 144.5), (−100.5, 144.5)→(−106.5, 138.5).
- **`PARK_PATH`**(닫힌 산책로, 폭 2.0 m): `[(32, −18), (60, −18), (63, 10), (58, 37), (34, 37), (31, 10)]`
- **높이:**
  - 포드와 로봇 경로의 z는 `GroundZ`로 읽는다. 장면 밖은 'tt' 노면 높이다.
  - 드론 경로는 Catmull-Rom(장력 0.5, 닫힘)으로 펴서 2 m 간격 꺾은선으로 내보낸다. 나머지는 2 m 간격으로 촘촘하게 만든다.
- **앞쪽 약속:** 메시의 앞은 로컬 +X다. 드론만 지금처럼 +Z가 앞이므로 `yawOffset = π/2`다.

## 5. 팔레트와 그린 텍스처

| 용도 | 값 |
|---|---|
| 맑은 하늘 | 지평선 `#D9E8F2` → 천정 `#5E9BD6`, 적운 `#FFFFFF`, 밑면 `#C9D1DB` |
| 벽돌 | 기존 `#A86B55`. 오염(`age`)은 0.35배 |
| 잎 | `#2F5A2C`, `#4E7A3A`, `#6E9A45`, 하이라이트 `#8DB35A` |
| 담쟁이 | `#3F6B2E`, `#4E7A3A`, `#5D8A3A` |
| 유리 커튼월 | `#8FB4CF` → `#CFE0EC`(세로 하늘 반사), 멀리언 `#DDE3E7`, 어두운 칸 `#5F7E96`, 층 띠 `#3C4A55` |
| 태양광 | 셀 `#1E2C44`, 격자 `#9AA7B5`, 테두리 `#C9CED3` |
| 스마트 청록 | `#39C6E0` |
| 흰 차체 | `#EEF1F2` |

| 텍스처(함수) | 크기 | 파일 | 내용 |
|---|---|---|---|
| `paint_ivy` | 1024² RGBA | present.py | 2 × 2 칸, 밀도 0.35 · 0.6 · 0.85 · 0.95. 세 갈래 잎 10–18 px, 잎 사이 알파 0 |
| `paint_greenwall` | 1024 × 512 | present.py | 0.6 m 모듈 화분 격자, 풀 3색, 노랑 `#E8C547`·분홍 `#D9748A` 꽃 점 2 % |
| `paint_meadow` | 512² | present.py | 옥상·테라스 화단 윗면(풀 + 작은 꽃) |
| `paint_pv` | 512² | present.py | 패널 1장 = 셀 6 × 10, 테두리 2 px |
| `paint_leaves`(기존) | 기존 | present.py | 노랑 팔레트 → 여름 녹색 4색 |
| `paint_zelkova` | 1024² RGBA | present.py | 느티나무 잎 덩이 카드 4종 |
| `paint_curtain` / `paint_curtain_night` | 1024 × 2048 / 512 × 1024 | future.py | 1 칸 = 1.5 × 4.0 m. 가로 8칸 × 세로 4층(u = 둘레 m / 12, v = z / 16), 밤 창 35 % |
| `paint_pv_road` | 512 × 256 | future.py | 0.5 m 강화유리 타일 + 셀, 가장자리 LED 점 |

## 6. 웹 변경 요약

| 파일 | 바뀌는 것 |
|---|---|
| `weather.js` | `clear` 프리셋, 모든 프리셋에 `cloudCover`, `weatherNamesFor`·`defaultWeather`, 해 위치를 그림자 대상 기준으로 |
| `sky.js` | 적운(`uSkyCumulus`) |
| `quality.js` | `sunShadows`(데스크톱만) |
| `world.js` | 성수 이끼 0.3, 해 그림자와 `followSun`, 이동체 액터, 튜브 유리 투명 처리, 보행 장애물에서 이동체 제외 |
| `movers.js`(새 파일) | 경로 이동체 순수 계산 |
| `camera.js` | `updateDroneActors` 삭제(movers로 옮김) |
| `main.js` | 기본 기상, 맑음 버튼 표시, `followSun`·`updateMoverActors` 호출 |
| `public/nowhere.html` | 맑음 버튼 |
| `help.js`, `README.md` | 기상 목록, 2041 카메라 |

## 7. 파일 구조

```
tools/nowhere/blender/
  ground.py      Task 4  빈터 지면 → 공원(잔디, 낮은 둔덕, 포장 산책로), 차도 보수 패치 끄기, 차선 새 도색
  present.py     Task 3  전주·전선 철거 / Task 4 쇠퇴 걷어내기·복원·간판·공원·free_spot
                 Task 5  담쟁이·수직정원·가로수 / Task 6 지붕·아파트
  future.py      Task 3  CAM_future / Task 7 TOWERS·TUBE_PROFILE 상수 / Task 8 타워·풍력 / Task 9 튜브·열차·스카이브리지
                 Task 10 노면·키오스크·테라스·배송로봇 / Task 11 이동체 표(nw_movers)·드론 소포
  backdrop.py    Task 7  커튼월 재도장, 옥상 녹화, 타워 대지 비우기, 튜브 외피 연장
  export.py      Task 3  layout.solids·CAM_future / Task 11 layout.movers(drones 대체)
  build.py       Task 3  --no-bake
public/src/nowhere/
  weather.js sky.js main.js world.js help.js   Task 1
  quality.js world.js weather.js main.js        Task 2
  movers.js(새) world.js camera.js main.js      Task 11
public/nowhere.html                             Task 1
tests/
  nowhere-weather.test.mjs                      Task 1 (k)(l)
  nowhere-quality.test.mjs                      Task 2
  nowhere-clearance.test.mjs(새)                Task 3 (a)(b)(c), Task 11 (d)
  nowhere-intro-path.test.mjs                   Task 3: 전주 검사 (b)(c) 삭제, (a) 유지
  nowhere-anchors.test.mjs                      Task 4: 앵커 교체 반영
  nowhere-future-layout.test.mjs(새)            Task 8 (a)(b), Task 9 (c)
  nowhere-movers.test.mjs(새)                   Task 11 (a)–(e)
public/assets/nowhere/  (빌드 산출물: GLB 4종 + mobile, layout.json, ground mask, renders)
```

## 8. 실행 방식

### 8.1 시작 전 준비(컨트롤러가 직접)

```bash
git switch feat/walk-hint-dock && git switch -c feat/seongsu-2041-future
mkdir -p build/nowhere/ref build/nowhere/compare
cp /var/folders/n3/vy61y2sx62v6vd5w_f8w_htw0000gn/T/orca-paste-1794285451826-82fe9ded-67f1-4b81-a6fa-e638ca81b390.png build/nowhere/ref/seongsu-2041-ref.png
```

임시 경로가 사라졌으면 사용자에게 이미지를 다시 받는다. 지금 화면을 `before` 사진으로 남긴다.
- 방법: playwriter로 `npm start` 페이지 `http://localhost:4173/nowhere.html?cam=<id>&weather=overcast`를 1600 × 900으로 연다.
- 시점: `street`, `aerial`, `viaduct`, `night`(`&time=21.5`).
- 저장: `build/nowhere/compare/before-<id>.png`.

### 8.2 빌드 명령

| 목적 | 명령 | 비고 |
|---|---|---|
| 전체 재구축(굽기 포함) | `npm run nowhere:build -- -- --rebuild` | 확인 지점과 마지막에 쓴다 |
| 빠른 재구축(굽기 생략) | `npm run nowhere:build -- -- --rebuild --no-bake` | Task 3에서 만든다. 새 메시 AO는 1(그늘 없음) |
| 최적화 | `npm run nowhere:optimize` | 데스크톱 1024 / 모바일 512 |
| 테스트 | `npm test` | 시작 시 114개 통과 |

- 전체 재구축에 걸리는 시간은 Task 3 첫 실행에서 재서 보고서에 적는다.
- Blender 태스크는 Blender가 하나라서 **순서대로만** 실행한다. 각 Blender 태스크는 MCP `look`(EEVEE, 흐린 조명 — 형상 확인용)으로 `CAM_street`·`CAM_future`·`CAM_aerial`을 보고 고친다. 최소 2회 반복하고, 무엇을 고쳤는지 보고서에 적는다.
- 웹에서의 모양(빛·그림자)은 빠른 재구축 → 최적화 → playwriter로 확인한다.

### 8.3 확인 지점(사용자)

- **CP1 (Task 8 뒤):**
  - 전체 재구축 → 최적화 → `npm test`를 실행한다.
  - playwriter로 `street`, `future`, `aerial`을 맑음 14:00에 캡처한다.
  - `before` · 2041 · 레퍼런스를 나란히 놓은 비교 페이지(Artifact, 지난 시안 페이지와 같은 형식)와 성능 표(`?stats=1`, 데스크톱 · `?tier=mobile`)를 사용자에게 보여 준다.
  - 방향 승인을 받은 뒤 Task 9로 넘어간다.
- **CP2 (Task 11 뒤):**
  - 같은 방식에 `night`(21:30)와 움직임을 더한다. 움직임은 10초 간격 2장으로 보여 준다.
  - D4(보행자) 여부를 묻는다.

### 8.4 태스크 진행 규칙

- 서브에이전트 디스패치는 superpowers:subagent-driven-development를 따른다. 태스크 브리프와 보고서는 파일로 주고받는다.
- 브라우저 확인은 playwriter만 쓴다. 대화상자를 띄울 수 있는 동작 전에는 `window.confirm`/`alert`/`prompt`를 기록 함수로 바꿔 둔다(CLAUDE.md).
- Blender 형상 단계는 정확한 상수·함수 계약·완료 기준을 준다. 코드는 같은 파일의 기존 생성기(`Acc`, `building`, `_face`, `place`, `mat_image`, `mat_ui` …)를 따라 쓴다. 형상은 `look`으로 맞추는 값이라, 기존 함수 서명에 직접 닿는 곳만 코드로 적었다.

---

## 9. 태스크

### Task 1: 맑음 기상 — 파란 하늘, 적운, 성수 이끼 낮춤 (웹)

**Files:**
- Modify: `public/src/nowhere/weather.js`(PRESETS, `WEATHER_NAMES`, `composeState`, `applyStateToScene`)
- Modify: `public/src/nowhere/sky.js`
- Modify: `public/src/nowhere/main.js:132-145`(기본 기상), 맑음 버튼 표시
- Modify: `public/src/nowhere/world.js`(DS2 룩 블록 바로 뒤)
- Modify: `public/nowhere.html:61-67`, `public/src/nowhere/nowhere.css`(`.nw-btn[hidden]`), `public/src/nowhere/help.js:16`, `README.md`(기상 줄)
- Test: `tests/nowhere-weather.test.mjs`

**Interfaces:**
- Produces:
  - `PRESETS.clear`
  - 모든 프리셋의 `cloudCover: number`
  - `weatherNamesFor(worldVer) → string[]`
  - `defaultWeather(worldVer) → 'clear' | 'overcast'`
  - `composeState(...).cloudCover`
  - 하늘 uniform `uSkyCumulus`

- [ ] **Step 1: 실패하는 테스트를 쓴다** — `tests/nowhere-weather.test.mjs` 끝에 더한다(import 줄에 `composeState, WEATHER_NAMES, weatherNamesFor, defaultWeather, parseHexLinear`를 추가).

```js
const srgb8 = (hex) => parseHexLinear(hex).map((c) => Math.round(linearToSrgb(c) * 255));
const sameColor = (a, b) => srgb8(a).every((v, i) => Math.abs(v - srgb8(b)[i]) <= 1);

test('(k) 맑음: 키 집합이 같고, 14:00 합성 = 맑음 프리셋, 구름 덮임은 기상이 정한다', () => {
  assert.deepEqual(Object.keys(PRESETS.clear).sort(), Object.keys(PRESETS.overcast).sort());
  const s = composeState(PRESETS, 'clear', 14);
  for (const k of ['uWet', 'uFogB', 'uFogK', 'exposure', 'saturation', 'sunIntensity', 'hemiIntensity', 'envIntensity', 'cloudCover', 'sunHaze']) {
    assert.ok(Math.abs(s[k] - PRESETS.clear[k]) < 1e-9, `${k}: ${s[k]} ≠ ${PRESETS.clear[k]}`);
  }
  for (const k of ['skyHorizon', 'skyZenith', 'fogColor', 'fogFarColor', 'sunColor']) {
    assert.ok(sameColor(s[k], PRESETS.clear[k]), `${k}: ${s[k]} ≠ ${PRESETS.clear[k]}`);
  }
  assert.equal(composeState(PRESETS, 'overcast', 14).cloudCover, 0);
  const night = composeState(PRESETS, 'clear', 21.5);
  assert.equal(night.cloudCover, PRESETS.clear.cloudCover);
  assert.ok(night.sunIntensity < PRESETS.clear.sunIntensity * 0.5, '밤에는 해가 약하다');
  assert.ok(night.uNight > 0.5);
});

test('(l) 월드별 기상 목록 · 기본 기상: 성수 = 맑음 포함 · 기본 맑음, DS2 = 그대로', () => {
  assert.deepEqual(weatherNamesFor('seongsu'), ['clear', 'overcast', 'rain', 'snow']);
  assert.deepEqual(weatherNamesFor('ds2'), ['overcast', 'rain', 'snow']);
  assert.equal(defaultWeather('seongsu'), 'clear');
  assert.equal(defaultWeather('ds2'), 'overcast');
  assert.deepEqual(WEATHER_NAMES, weatherNamesFor('seongsu'));
  assert.equal(getPresets('ds2').overcast.sunHaze, 1.0, 'DS2 덮어쓰기 유지');
  for (const n of ['overcast', 'rain', 'dusk', 'night', 'snow']) assert.equal(PRESETS[n].cloudCover, 0, n);
});
```

- [ ] **Step 2: 실패를 확인한다** — `node --test tests/nowhere-weather.test.mjs`를 실행한다. Expected: (k)(l) FAIL(`PRESETS.clear` 없음, `weatherNamesFor is not a function`). 기존 테스트 중 `WEATHER_NAMES`가 3개라고 가정한 것이 있으면 `rg -n "WEATHER_NAMES" tests public/src`로 찾아 이 단계에서 같이 고친다.

- [ ] **Step 3: `weather.js`를 고친다.**

`overcast`, `rain`, `dusk`, `night`, `snow` 각 프리셋 끝에 `cloudCover: 0.0,`을 넣는다. `snow` 다음에 아래 프리셋을 더한다.

```js
  // 맑음(성수 2041 기본): 파란 하늘 · 흰 적운 · 강한 해 · 마른 노면. 시간(황혼 · 밤)은 다른 기상처럼 곱해진다.
  clear: {
    uWet: 0.05,
    uRain: 0.0,
    uSnow: 0.0,
    uNight: 0.0,
    uFogB: 0.0011,
    uFogK: 0.03,
    fogColor: '#C9DCEB',
    fogFarColor: '#B7CFE3',
    skyHorizon: '#D9E8F2',
    skyZenith: '#5E9BD6',
    skyGround: '#4A4F4A',
    exposure: 0.92,
    saturation: 1.0,
    uEmitGain: 0.25,
    sunIntensity: 2.6,
    sunColor: '#FFF1DC',
    hemiIntensity: 0.75,
    envIntensity: 0.9,
    sunHaze: 0.15,
    cloudCover: 0.42,
  },
```

`WEATHER_NAMES` 줄을 바꾼다.

```js
export const WEATHER_NAMES = ['clear', 'overcast', 'rain', 'snow'];
/** 월드에서 고를 수 있는 기상. DS2 는 역광 헤이즈 룩에 맞춘 세 가지만. */
export function weatherNamesFor(worldVer = 'seongsu') {
  return worldVer === 'ds2' ? ['overcast', 'rain', 'snow'] : WEATHER_NAMES;
}
/** URL 에 weather 가 없을 때의 기상. 성수 2041 = 맑음, DS2 = 흐림. */
export function defaultWeather(worldVer = 'seongsu') {
  return worldVer === 'ds2' ? 'overcast' : 'clear';
}
```

`composeState`의 `out.sunHaze = …` 줄을 바꾸고, 바로 아래에 구름 줄을 더한다.

```js
  out.sunHaze = day.sunHaze > 0 ? t.sunHaze * (w.sunHaze / day.sunHaze) : Math.max(t.sunHaze, w.sunHaze);
  out.cloudCover = w.cloudCover ?? 0;   // 구름 덮임은 기상이 정한다(밤 색은 하늘 셰이더가 uNight 로 어둡게)
```

`applyStateToScene`의 `uSkyGround` 줄 다음에 아래를 넣는다.

```js
    if (world.sky.uniforms.uSkyCumulus) world.sky.uniforms.uSkyCumulus.value = st.cloudCover ?? 0;
```

- [ ] **Step 4: `sky.js`에 적운을 더한다.**
  - `skyUniforms`에 `uSkyCumulus: { value: 0.0 },`를 넣는다.
  - 프래그먼트 uniform 선언에 `uniform float uSkyCumulus;`를 넣는다.
  - 층운 블록(`// 저주파 층운`) 바로 뒤, `float below` 앞에 아래를 넣는다.

```glsl
        // 맑음의 흰 적운(성수 2041). 덮임 uSkyCumulus(0 = 없음). 가장자리는 밝고 밑면은 푸른 회색, 밤에는 어둡다.
        if (uSkyCumulus > 0.001 && y > 0.0) {
          vec2 cuv = dir.xz / (y + 0.12) * 0.55 + vec2(uTime * 0.005, uTime * 0.0025);
          float n = fbm(cuv) * 0.62 + fbm(cuv * 2.9 + vec2(5.2, 1.3)) * 0.38;
          float edge = 1.0 - uSkyCumulus;
          float cov = smoothstep(edge, edge + 0.16, n);
          float body = smoothstep(edge + 0.04, edge + 0.32, n);
          float fade = smoothstep(0.012, 0.10, y) * (1.0 - smoothstep(0.60, 0.92, y));
          vec3 cloud = mix(vec3(1.0, 0.995, 0.98), vec3(0.79, 0.82, 0.86), body * 0.75);
          cloud *= mix(1.0, 0.16, uNight);
          sky = mix(sky, cloud, cov * fade);
        }
```

- [ ] **Step 5: 기본 기상, 버튼, 이끼를 고친다.**

`main.js`의 weather import에 `weatherNamesFor, defaultWeather`를 더한다. `const initialWeather = params.get('weather') || 'overcast';`를 아래로 바꾼다.

```js
  const initialWeather = params.get('weather') || defaultWeather(worldVer);
```

기상 버튼에 click 처리를 다는 `document.querySelectorAll('[data-weather]').forEach(...)`(main.js:314 부근) 앞에 아래를 넣는다.

```js
  const weatherNames = weatherNamesFor(worldVer);
  document.querySelectorAll('[data-weather]').forEach((btn) => {
    btn.hidden = !weatherNames.includes(btn.dataset.weather);   // DS2 에서는 '맑음' 을 숨긴다
  });
```

`.nw-btn`은 `display`를 지정하므로 `hidden` 속성만으로는 숨지 않는다. `nowhere.css`의 `.nw-btn { … }` 뒤에 `.nw-btn[hidden] { display: none; }`을 더한다(`.nw-help[hidden]`과 같은 방식).

`public/nowhere.html`의 `#nw-weather-seg` 첫 버튼으로 `<button type="button" class="nw-btn" data-weather="clear">맑음</button>`을 넣는다. `흐림` 버튼의 `is-active`는 지우고, 초기 활성 표시는 main.js의 기존 동기화 코드(main.js:164 부근)가 맡게 한다. 그 코드가 초기 기상으로 `is-active`를 켜지 않으면 같은 곳에 아래 한 줄을 더한다.

```js
  document.querySelectorAll('[data-weather]').forEach((b) => b.classList.toggle('is-active', b.dataset.weather === initialWeather));
```

`world.js`의 DS2 블록(`if (worldVer === 'ds2') { … uPudMetal … }`) 바로 뒤에 아래를 넣는다.

```js
  // 성수 2041: 복원·정돈된 도시 — 틈의 이끼를 30 % 로(구운 마스크는 그대로, 비 · 눈 무드에서도 같다)
  const SEONGSU_MOSS = 0.3;
  if (worldVer !== 'ds2') uniforms.uMoss.value = SEONGSU_MOSS;
```

`help.js` CONTROL_SECTIONS의 `월드 전환 … 기상(흐림 · 비 · 눈)` 문구를 `기상(맑음 · 흐림 · 비 · 눈 — 맑음은 성수)`로 바꾼다. README의 같은 표현도 맞춘다.

- [ ] **Step 6: 통과를 확인한다** — `npm test`를 실행한다. Expected: 전부 PASS(기존 114 + 2).

- [ ] **Step 7: 화면을 확인한다(playwriter).**
  - 확인 목록:
    - `http://localhost:4173/nowhere.html?cam=street`가 맑음으로 시작한다.
    - 하늘에 적운이 보인다.
    - 노면 웅덩이가 없다.
    - 맑음 버튼이 활성이다.
    - `?ver=ds2&cam=street`에서는 맑음 버튼이 숨고 흐림으로 시작한다.
    - `&time=21.5`에서 구름이 어둡다.
    - 콘솔 오류가 0이다.
  - `street`·`aerial` 사진을 `build/nowhere/compare/t1-<id>.png`로 남긴다.
  - 적운이 너무 짙거나 지평선에서 줄무늬가 지면 `cloudCover`(0.3–0.5)와 `fade` 범위만 조정한다. 바꾼 값은 Step 1의 테스트 기대값과 같이 맞춘다.

- [ ] **Step 8: 커밋(또는 스테이징 + 메시지 제시)**

```bash
git add public/src/nowhere/weather.js public/src/nowhere/sky.js public/src/nowhere/main.js public/src/nowhere/world.js public/nowhere.html public/src/nowhere/nowhere.css public/src/nowhere/help.js README.md tests/nowhere-weather.test.mjs
git commit -m "feat(nowhere): 성수 맑음 기상(적운 · 강한 해 · 마른 노면)을 기본으로, 이끼 30 %"
```

### Task 2: 해 그림자 (데스크톱, 성수)

**Files:**
- Modify: `public/src/nowhere/quality.js`, `public/src/nowhere/world.js`(sunLight 생성 직후, 레이어 처리 뒤, 반환 객체)
- Modify: `public/src/nowhere/weather.js`(`applySun`), `public/src/nowhere/main.js`(`animate`)
- Test: `tests/nowhere-quality.test.mjs`

**Interfaces:**
- Consumes: Task 1의 맑음 상태(sunIntensity 2.6)
- Produces:
  - `quality.sunShadows: boolean`
  - `world.followSun(camera)` — 그림자 끄면 아무 일도 하지 않는다.
  - 해 위치는 `sunLight.target` 기준 오프셋이다.

- [ ] **Step 1: 실패하는 테스트를 쓴다** — `tests/nowhere-quality.test.mjs`에 더한다.

```js
test('(s) 해 그림자: 데스크톱만 켠다(모바일은 그림자 패스 비용 없이)', () => {
  assert.equal(getQualityConfig('desktop').sunShadows, true);
  assert.equal(getQualityConfig('mobile').sunShadows, false);
  assert.equal(getQualityConfig('desktop', 'ds2').sunShadows, true, 'DS2 는 world.js 에서 끈다(등급 값은 공통)');
});
```

- [ ] **Step 2:** `node --test tests/nowhere-quality.test.mjs`를 실행해 FAIL을 확인한다.

- [ ] **Step 3: 구현한다.**

`quality.js` 모바일 객체에 `sunShadows: false,`를, 데스크톱 객체에 `sunShadows: true,`를 넣는다.

`world.js`에서 `sunLight.castShadow = false;` 줄을 아래로 바꾼다.

```js
  // 맑음의 해 그림자(성수 · 데스크톱): 카메라 앞 ±SHADOW_HALF m 를 덮는 직교 그림자. followSun 이 매 프레임 옮긴다.
  const SHADOW_HALF = 110;
  const SHADOW_AHEAD = 70;
  const SHADOW_DIST = 300;
  const shadowsOn = Boolean(quality.sunShadows) && worldVer !== 'ds2';
  sunLight.castShadow = shadowsOn;
  if (shadowsOn) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    sunLight.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
    Object.assign(sunLight.shadow.camera, { left: -SHADOW_HALF, right: SHADOW_HALF, top: SHADOW_HALF, bottom: -SHADOW_HALF, near: 1, far: 700 });
    sunLight.shadow.camera.updateProjectionMatrix();
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.5;
    scene.add(sunLight.target);
  }
```

레이어 병합 루프(`for (const key of ['ground', 'present', 'future', 'backdrop'])`)가 끝난 뒤에 아래를 넣는다.

```js
  if (shadowsOn) {
    const NO_CAST = new Set(['holo', 'emissive', 'water']);
    for (const key of ['ground', 'present', 'future', 'building_haus', 'building_facearch']) {
      layerGroups[key]?.traverse((n) => {
        if (!n.isMesh) return;
        n.receiveShadow = true;
        n.castShadow = key !== 'ground' && !NO_CAST.has(n.userData?.nw_surface) && !/^FU_tube_glass/.test(n.name);
      });
    }
  }

  const _fwd = new THREE.Vector3();
  const _focus = new THREE.Vector3();
  const _toSun = new THREE.Vector3();
  /** 그림자 상자를 카메라 앞 SHADOW_AHEAD m 로 옮긴다(1 m 단위로 붙여 걸을 때 가장자리가 떨지 않게). */
  function followSun(camera) {
    if (!shadowsOn) return;
    camera.getWorldDirection(_fwd);
    _fwd.y = 0;
    if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1);
    _fwd.normalize();
    _focus.copy(camera.position).addScaledVector(_fwd, SHADOW_AHEAD);
    _toSun.copy(sunLight.position).sub(sunLight.target.position).normalize();
    sunLight.target.position.set(Math.round(_focus.x), 0, Math.round(_focus.z));
    sunLight.target.updateMatrixWorld();
    sunLight.position.copy(sunLight.target.position).addScaledVector(_toSun, SHADOW_DIST);
  }
```

`layerGroups`의 건물 키 이름은 `getWalkBlocker`가 쓰는 이름과 같다. 다르면 그 이름을 따른다. 반환 객체에 `followSun,`을 더한다.

`weather.js`의 `applySun`에서 위치 줄을 대상 기준으로 바꾼다. weather.js는 three를 import하지 않으므로 그대로 둔다.

```js
    const L = world.lights.sunLight;
    const o = L.target ? L.target.position : { x: 0, y: 0, z: 0 };
    L.position.set(o.x + sd.light.x * 240, o.y + sd.light.y * 240, o.z + sd.light.z * 240);
```

`main.js` `animate()`에서 `post.composer.render()` 바로 앞에 `world.followSun(camera);`를 넣는다.

- [ ] **Step 4:** `npm test`를 실행한다. Expected: 전부 PASS.

- [ ] **Step 5: 화면을 확인하고 성능 게이트를 통과시킨다(playwriter, 탭을 앞에 둔다).**
  - 확인할 화면:
    - `?cam=street&stats=1`, `?cam=aerial&stats=1`에서 건물·가로등·나무 그림자가 지면과 벽에 진다.
    - 셰이더 패치 재질(벽, 지면, 두 건물)도 그림자를 받는다.
    - 보행 모드(V)로 100 m 걸어도 그림자가 따라온다.
  - 성능 표의 FPS·그리기·삼각형을 적는다.
  - **게이트:** `street`에서 FPS ≥ 55.
    - 못 넘으면 ① `shadowMapSize` 1024, ② `foliage`도 `NO_CAST`에 넣기, ③ `present`의 소품(`PR_ph_*`, `PR_light.*`)을 cast에서 빼기 순으로 시도한다.
    - 그래도 못 넘으면 `sunShadows`를 끄고 수치와 함께 보고한다(DONE_WITH_CONCERNS).
  - 패치 재질이 그림자를 받지 않으면 `surface.js`의 `onBeforeCompile`이 `lights_fragment_begin`이나 그림자 청크를 덮어쓰는지 확인하고 고친다.
  - `?tier=mobile`은 그림자가 없고 FPS가 이전과 같다.
  - 사진을 `build/nowhere/compare/t2-<id>.png`로 남긴다.

- [ ] **Step 6: 커밋(또는 스테이징 + 메시지 제시)**

```bash
git add public/src/nowhere/quality.js public/src/nowhere/world.js public/src/nowhere/weather.js public/src/nowhere/main.js tests/nowhere-quality.test.mjs
git commit -m "feat(nowhere): 데스크톱 성수에 해 그림자(카메라를 따라가는 직교 그림자)"
```

### Task 3: 전신주·전선 지중화, 경로 여유 검사(`layout.solids`), `CAM_future`, 빠른 빌드

**Files:**
- Modify: `tools/nowhere/blender/present.py`(전주·전선 블록 삭제, 상수 `APT_H`), `tools/nowhere/blender/future.py`(`CAM_FUTURE`, `build_camera`)
- Modify: `tools/nowhere/blender/export.py`(`CAM_ORDER`, `export_layout`의 `solids`), `tools/nowhere/blender/build.py`(`--no-bake`)
- Create: `tests/nowhere-clearance.test.mjs`
- Modify: `tests/nowhere-intro-path.test.mjs`(전주 검사 삭제)

**Interfaces:**
- Produces:
  - `layout.solids: [{ id, min: [x,y,z], max: [x,y,z] }]`(three 좌표). id는 건물 표의 `name`, `APT0…2`, `VIA_deck`, `HAUS`, `FACEARCH`, 그리고 `nw_solid=1` 객체 이름이다.
  - 카메라 `future`
  - `present.APT_H`
  - `build.py --no-bake`

- [ ] **Step 1: 실패하는 테스트를 쓴다** — `tests/nowhere-clearance.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../public/vendor/three/three.module.js';
import { SEONGSU_INTRO } from '../public/src/nowhere/intro-path.js';
import { buildFlightPath } from '../public/src/nowhere/flight.js';
import { approachFor } from '../public/src/nowhere/tour-config.js';

const layout = JSON.parse(readFileSync(new URL('../public/assets/nowhere/layout.json', import.meta.url), 'utf8'));
const MIN_CLEAR = 2.0;   // m — 카메라는 건물 · 고가 · 타워 · 스카이브리지 상자에 이보다 가까이 가지 않는다

function boxDist([x, y, z], b) {
  const dx = Math.max(b.min[0] - x, 0, x - b.max[0]);
  const dy = Math.max(b.min[1] - y, 0, y - b.max[1]);
  const dz = Math.max(b.min[2] - z, 0, z - b.max[2]);
  return Math.hypot(dx, dy, dz);
}
function nearest(points) {
  let best = { d: Infinity, id: null, at: null };
  for (const p of points) {
    for (const b of layout.solids) {
      const d = boxDist(p, b);
      if (d < best.d) best = { d, id: b.id, at: p.map((v) => Number(v.toFixed(1))) };
    }
  }
  return best;
}
// camera.js 의 인트로·비행과 같은 곡선(기본 CatmullRomCurve3)과 같은 표본
function sampleCurve(points, n, ease) {
  const c = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const v = c.getPointAt(ease ? t * t * (3 - 2 * t) : t);
    out.push([v.x, v.y, v.z]);
  }
  return out;
}

test('(a) layout.solids: 건물 표 · 아파트 · 고가 상판 · 두 건물이 있고 상자가 올바르다', () => {
  // 건물 표 38(BELT 14 · C1 13 · E1 6 · SOUTH 5) + 아파트 3 + 고가 상판 1 + 두 건물 2 = 44(Task 8 · 9 에서 타워 · 튜브 · 스카이브리지가 더해진다)
  assert.ok(Array.isArray(layout.solids) && layout.solids.length >= 44, `solids ${layout.solids?.length}`);
  const ids = new Set(layout.solids.map((b) => b.id));
  for (const id of ['B1', 'B6', 'B10', 'F2', 'E1a', 'MX', 'APT0', 'APT2', 'VIA_deck', 'HAUS', 'FACEARCH']) assert.ok(ids.has(id), `${id} 없음`);
  for (const b of layout.solids) for (let i = 0; i < 3; i++) assert.ok(b.min[i] < b.max[i], `${b.id} 축 ${i}`);
  const haus = layout.solids.find((b) => b.id === 'HAUS');
  assert.ok(Math.abs(haus.max[1] - 81) < 0.5, `HAUS 높이 ${haus.max[1]}`);
  assert.ok(layout.cameras.some((c) => c.id === 'future'), 'CAM_future 없음');
});

test('(b) 성수 인트로: 모든 solid 에서 2 m 이상 떨어져 난다', () => {
  const r = nearest(sampleCurve(SEONGSU_INTRO.points, 4000, true));
  assert.ok(r.d >= MIN_CLEAR, `가장 가까운 ${r.id} ${r.d.toFixed(2)} m @ ${r.at}`);
});

test('(c) 투어 비행 4 경로(거리 → 성수 · 몽골, 성수 ↔ 몽골)도 2 m 이상', () => {
  const street = layout.cameras.find((c) => c.id === 'street');
  const from = { pos: street.pos, target: street.target };
  const haus = approachFor(layout, 'haus');
  const fa = approachFor(layout, 'facearch');
  for (const [a, b, name] of [[from, haus, 'street→haus'], [from, fa, 'street→facearch'], [haus, fa, 'haus→facearch'], [fa, haus, 'facearch→haus']]) {
    const r = nearest(sampleCurve(buildFlightPath(a, b).points, 2000, false));
    assert.ok(r.d >= MIN_CLEAR, `${name}: ${r.id} ${r.d.toFixed(2)} m @ ${r.at}`);
  }
});
```

`camera.js`의 인트로와 `flyTo`가 쓰는 곡선 종류(`toCurve`의 `curveType`)를 먼저 읽는다. 기본값(centripetal)이 아니면 `sampleCurve`의 생성자를 같게 맞춘다.

`tests/nowhere-intro-path.test.mjs`에서는 다음을 정리한다.
- 지운다: `RUNS` 파싱(`src`·`runsText`·`runs`·`poles`·`spans`), 테스트 (b)(c), (a)의 `poles.length >= 30` 줄.
- 남긴다: (a)의 끝점 검사. (b)(c)는 새 파일이 대신한다.

- [ ] **Step 2:** `node --test tests/nowhere-clearance.test.mjs`를 실행한다. Expected: (a)(b)(c) FAIL(`layout.solids` undefined).

- [ ] **Step 3: 전주와 전선을 철거한다(`present.py`).**
  - `_build_rest`의 `# 전주·전선` 블록(`pole_mesh` … `build_wires`)을 지운다.
  - `rg -n "RUNS|WIRE_PTS|POLE_H|pole_mesh|transformer_mesh|catenary|pole_frames|attach\(|build_wires|service_drops|def tube" tools/nowhere/blender`로 쓰임새를 확인한다. 다른 곳에서 쓰지 않는 정의만 지운다. `tube()`는 다른 생성기가 쓰면 남긴다.
  - `apartment_mesh`의 지붕 높이를 모듈 상수 `APT_H = 3.0 + 12 * 2.8 + 1.2`(= 37.8, 파라펫 포함)로 꺼내고, 함수 안에서 이 상수를 쓴다.
  - **완료 기준:** `NW_present`에 `PR_pole*`, `PR_transformer*`, `PR_wires*` 객체가 0개다.

- [ ] **Step 4: `CAM_future`를 만든다(`future.py`).**
  - `CAM_NIGHT` 아래에 상수를 더한다.

```python
CAM_FUTURE = ((70.0, 8.0, 1.7), (70.0, 150.0, 14.0), 22.0)   # 동쪽 골목에서 북쪽: 양쪽 벽돌, 스카이브리지, 고가 튜브, 뒤편 타워(레퍼런스 구도)
```

  - `build_camera(sc)`를 `(이름, 상수, 무드)` 표를 도는 형태로 바꾼다. `[('CAM_night', CAM_NIGHT, 'night'), ('CAM_future', CAM_FUTURE, 'clear')]`를 돌며 지금 본문과 같은 일을 한다.
  - `export.py`의 `CAM_ORDER` 끝에 `('future', '2041 골목 — 고가 튜브와 새 타워', 'hero-future.png', 'hero-future.webp')`를 더한다.
  - `build/nowhere/renders/hero-future.png`는 `lib.render(sc, bpy.data.objects['CAM_future'], <경로>, (1280, 720), 32)`로 만든다. `export_renders_and_hdri`가 원본이 없으면 실패하므로 이 단계에서 렌더한다.

- [ ] **Step 5: `layout.solids`를 내보낸다(`export.py`).** `export_layout` 위에 아래를 더한다.

```python
def _box_three(id_, mn, mx):
    a = to_three(mn); b = to_three(mx)
    return {'id': id_, 'min': [round(min(a[i], b[i]), 2) for i in range(3)], 'max': [round(max(a[i], b[i]), 2) for i in range(3)]}


def solid_boxes():
    """인트로·투어 비행·이동체 경로의 여유 검사용 상자(three 좌표, m).
    건물 표(present.BELT·C1·E1·SOUTH, 박공은 용마루까지), 아파트, 고가 상판, HAUS·FaceArch, nw_solid=1 객체(월드 AABB)."""
    import present
    out = []
    for specs in (present.BELT, present.C1, present.E1, present.SOUTH):
        for sp in specs:
            x0, y0, x1, y1 = sp['rect']
            h = sp['gf'] + (sp['fl'] - 1) * sp['fh'] + sp.get('par', 0.0)
            if sp.get('roof') == 'gable':
                half = ((y1 - y0) if sp.get('ridge', 'x') == 'x' else (x1 - x0)) / 2.0
                h += half * math.tan(math.radians(sp.get('pitch', 12)))
            out.append(_box_three(sp['name'], (x0, y0, 0.0), (x1, y1, h)))
    for i, ((cx, cy), s) in enumerate(present.APTS):
        out.append(_box_three(f'APT{i}', (cx - 16.5, cy - 6.5, 0.0), (cx + 16.5, cy + 6.5, present.APT_H * s)))
    out.append(_box_three('VIA_deck', (present.VIA_PIERS[0], present.VIA_Y0, present.DECK_B),
                          (present.VIA_PIERS[-1], present.VIA_Y1, present.DECK_T)))
    out.append(_box_three('HAUS', (-25.15, -25.9, 0.0), (25.15, 25.9, 81.0)))
    fa = bpy.data.objects.get('BLD_facearch')
    fx, fy = (fa.location.x, fa.location.y) if fa else (105.0, 15.0)
    rz = fa.rotation_euler.z if fa else math.radians(27.0)
    c, s = math.cos(rz), math.sin(rz)
    corners = [(fx + u * c - v * s, fy + u * s + v * c) for u in (-11.0, 11.0) for v in (-9.0, 9.0)]   # 22 × 18 필로티 대지
    out.append(_box_three('FACEARCH', (min(p[0] for p in corners), min(p[1] for p in corners), 0.0),
                          (max(p[0] for p in corners), max(p[1] for p in corners), 31.0)))
    for o in bpy.data.objects:
        if o.type == 'MESH' and o.get('nw_solid'):
            ws = [o.matrix_world @ Vector(cn) for cn in o.bound_box]
            out.append(_box_three(o.name, tuple(min(v[i] for v in ws) for i in range(3)),
                                  tuple(max(v[i] for v in ws) for i in range(3))))
    return out
```

`layout` 딕셔너리에 `'solids': solid_boxes(),`를 넣는다. `Vector`·`math` import가 없으면 추가한다.

- [ ] **Step 6: `--no-bake`를 더한다(`build.py`).** `main()`을 아래처럼 고친다.

```python
    no_bake = '--no-bake' in argv
    force_bake = ('--bake' in argv or rebuild) and not no_bake
    ...
    if no_bake:
        print('[nowhere:build] --no-bake: 굽기를 건너뛴다(새 메시 AO = 1). 확인 지점에서는 전체 굽기로 다시 만든다.')
    elif force_bake or not sc.get('nw_baked') or not os.path.exists(bake.MASK_OUT):
```

`--no-bake`로 만든 장면은 `sc['nw_baked'] = False`로 저장한다. 그래야 다음 일반 빌드가 굽기를 한다.

- [ ] **Step 7: 빌드하고 확인한다.**
  - `npm run nowhere:build -- -- --rebuild`를 실행한다. 전체 굽기이며, 걸린 시간을 기록한다.
  - 이어서 `npm run nowhere:optimize`, `npm test`를 실행한다. Expected: clearance (a)(b)(c) PASS, 전체 PASS.
  - (b)나 (c)가 실패하면 원인 상자와 위치가 메시지에 나온다. 기존 인트로나 비행이 실제로 건물을 스치는 것이다.
    - 인트로는 `intro-path.js`의 점을 길 쪽으로 옮긴다.
    - 비행은 `tour-config.js`의 `approach`를 옮긴다.
    - 고친 값과 이유를 보고서에 적는다.
  - playwriter로 `?cam=street`, `?cam=future`, `?cam=viaduct`에서 전선 없는 하늘을 확인하고 `build/nowhere/compare/t3-<id>.png`로 남긴다.

- [ ] **Step 8: 커밋(또는 스테이징 + 메시지 제시)** — `tools/nowhere/blender/{present,future,export,build}.py`, `tests/nowhere-{clearance,intro-path}.test.mjs`, `public/assets/nowhere/`(GLB·layout·renders)를 경로로 지정한다.
  - 메시지: `feat(nowhere): 성수 전신주 · 전선 지중화, 경로 여유 검사(layout.solids), 2041 골목 시점`

### Task 4: 쇠퇴 걷어내기, 벽돌 복원, 2041 간판, 포켓 공원

**Files:**
- Modify: `tools/nowhere/blender/present.py`(extras 필터, `AGE_SCALE`, `GFK_REMAP`, `BIZ`, 소품 필터, `free_spot`, `build_lot_pocket` → `build_lot_park`, `ANCHORS`)
- Modify: `tools/nowhere/blender/ground.py`(빈터 지면·재질, 차도 보수 패치, 차선 마모), `tools/nowhere/blender/export.py`(`CAM_ORDER`의 `lot` 라벨)
- Modify: `public/assets/nowhere/anchors.ko.json`, `tests/nowhere-anchors.test.mjs`(필요할 때)

**Interfaces:**
- Produces:
  - `present.free_spot(x, y, r, tall=False) -> bool`
  - `present.VIEW_CONES`
  - `present.PARK_PATH`
  - 재질 `NW_turf`(잔디)

- [ ] **Step 1: 걷어낼 것을 상수로 정하고 거른다.**

```python
RETIRED_EXTRAS = {'tank', 'aircon_roof', 'aircon_wall', 'billboard'}   # 물탱크 · 실외기 · 옥상 광고판(임대문의 · 성수철물 …)
RETIRED_PROPS = {'car', 'payphone', 'payphone_post', 'barrier', 'container', 'truck_w', 'truck_b', 'aircon'}
AGE_SCALE = 0.35                     # 복원된 벽돌: 그을음 · 빗물 얼룩 · 하단 이끼를 35 % 로
GFK_REMAP = {'shutter': 'shop'}      # 내려진 셔터 → 유리 상점(공방 · 창고를 고친 가게)
```

  - `extras(acc, sp, M, H, par, rise, ridge)`는 kind가 `RETIRED_EXTRAS`에 있으면 건너뛴다. `vsign`·`canopy`·`pipes`·`stairs`·`stairhouse`·`fire_escape`는 남긴다.
  - `building()` 시작에서 `age = sp.get('age', 1.0) * AGE_SCALE`를 쓰게 한다. 벽 마스크와 빗물 얼룩 세기가 모두 이 값을 쓰는지 `rg -n "age" tools/nowhere/blender/present.py`로 확인한다.
  - 1층 종류는 `GFK_REMAP.get(sp['gfk'], sp['gfk'])`로 읽는다.
  - `build_street`·`build_fill`·`flush_inst`에서 proto 키가 `RETIRED_PROPS`에 있는 배치는 건너뛴다.
  - `import_protos`가 쓰지 않게 된 `PH` 항목을 가져오지 않게 한다. 이 경우 Poly Haven 소재 목록과 `docs/nowhere/credits.md`에서도 그 항목을 지운다.

- [ ] **Step 2: 간판을 바꾼다.** `BIZ`를 아래로 바꾼다(우리 문구, 옛 가게 일부는 그대로 산다).

```python
BIZ = {   # 2041 성수: 공방 · 창고가 고쳐진 가게. 옛 이름 몇은 그대로(진주식당 · 한마음식당)
    'B1': '성수 리페어 랩', 'B2': '프린트 스튜디오', 'B3': '로봇 공방', 'B4': '모빌리티 정비소', 'B5': '수제화 아카이브',
    'B6': '다온커피 2041', 'B7': '메이커 스페이스', 'B8': '금속 디자인 랩', 'B9': '북바인딩 스튜디오', 'B10': '드론 배송 허브',
    'B11': '그린 팩토리', 'W1': '목공 공방', 'W2': '컬러 랩', 'F1': '24시 무인 마켓', 'F2': '공구 도서관', 'F3': '포드 충전소',
    'M1': '코워킹 성수', 'M2': '가죽 아틀리에', 'V3': '소담 비건 키친', 'V6': '세탁 로봇', 'V8': '수선 스튜디오',
    'E1a': '가죽 아카이브', 'E1b': '진주식당', 'E1c': '도시재생 안내소', 'E1e': '문구와 프린트', 'E1f': '히트펌프 스테이션',
    'SH1': '대성상회 2041', 'SH2': '한마음식당', 'SH3': '코딩 학원', 'SH4': '전기차 정비', 'MX': '성수 스마트 빌딩',
}
```

간판 칸 너비(`maxw`)를 넘는 이름은 `board_sign`이 줄이는지 `look`으로 확인한다. 넘치면 그 이름만 짧게 바꾼다.

- [ ] **Step 3: `free_spot`과 시선 원뿔을 더한다(`present.py`).**

```python
VIEW_CONES = [   # (꼭짓점, 방위 시작°, 방위 끝°, 최대 거리 m) — 북 = 0°, 시계 방향. 이 안에는 키 큰 소품을 두지 않는다
    ((-105.0, -50.2), 46.0, 80.0, 110.0),    # 거리 시점 → HAUS
    ((0.0, -46.0), -35.0, 35.0, 21.0),       # HAUS 접근 시점
    ((77.6, -32.6), 10.0, 50.0, 50.0),       # FaceArch 접근 시점
]
ROAD_BANDS = [('y', G.TT), ('x', G.WR), ('x', G.AL), ('y', G.NR), ('y', G.VR)]


def _in_cone(x, y):
    for (ax, ay), b0, b1, dmax in VIEW_CONES:
        dx, dy = x - ax, y - ay
        if math.hypot(dx, dy) > dmax:
            continue
        b = math.degrees(math.atan2(dx, dy))
        if b0 <= b <= b1:
            return True
    return False


def free_spot(x, y, r, tall=False):
    """새 소품 자리 검사: 건물(+0.3 m) · 차도 · 횡단보도 · HAUS 전정 · FaceArch 대지 밖, 키 큰 것은 시선 원뿔 밖."""
    for specs in (BELT, C1, E1, SOUTH):
        for sp in specs:
            x0, y0, x1, y1 = sp['rect']
            if x0 - 0.3 - r < x < x1 + 0.3 + r and y0 - 0.3 - r < y < y1 + 0.3 + r:
                return False
    for ax, (a0, a1) in ROAD_BANDS:
        v = y if ax == 'y' else x
        if a0 - r < v < a1 + r:
            return False
    if abs(x - G.XW) < G.CW + r and G.TT[0] < y < G.TT[1]:
        return False
    hb = G.HAUS_BB
    if hb.x0 - r < x < hb.x1 + r and min(hb.y0, G.FORE[1]) - r < y < hb.y1 + r:
        return False
    if math.hypot(x - 105.0, y - 15.0) < 15.0 + r:
        return False
    return not (tall and _in_cone(x, y))
```

`G.HAUS_BB`의 필드 이름(`x0`/`y0`/`x1`/`y1`)과 `G.XW`·`G.CW`가 ground.py에 있는지 먼저 확인한다. 없으면 future.py의 `XW, CW = -14.0, 2.5`처럼 상수로 둔다.

- [ ] **Step 4: 빈터를 포켓 공원으로 바꾼다.**
  - **`ground.py` 빈터 지면:**
    - `GR_vacant`의 기복을 ±0.6 → ±0.25 m로 낮춘다. `MOUNDS`는 남긴다.
    - 재질은 잔디 `NW_turf`다. Poly Haven `aerial_grass_rock`(2k, CC0)을 `sources.json`에 더해 받고, 실패하면 export의 평면색 `#3C5A3A` + 노멀 노이즈로 둔다.
    - `TRACK` 흙길은 지운다.
    - `PARK_PATH`(§4.4) 닫힌 산책로는 폭 2.0 m 보도블록(`concrete_pavers_02`), 지면 + 0.02 m로 만든다.
    - `POOLS`·`CHANNEL`은 물길 정원이 된다. 수면(`water`)은 그대로 두고 가장자리에 현무암 경계석을 놓는다(`basalt_mesh` 작은 기둥, 0.4 m 간격).
  - **`present.py`:** `build_lot_pocket`를 `build_lot_park`로 바꾼다.
    - 지운다: 공사 가림막, 잡석·콘크리트 덩이, 마른 잡초.
    - 남긴다: 현무암 조경석 큰 것 3개.
    - 더한다:
      - 잔디 위 관목·꽃 화단(`shrub` 0.6배, 4곳)
      - 벤치 6(`bench_mesh`, 산책로 가장자리 1.2 m 밖, `free_spot`)
      - 느티나무 8(§4.3 후보 — 나무 자체는 Task 5의 `zelkova_mesh`)
    - 이 태스크에서는 나무 자리를 빈 객체 `SLOT_park_tree.<n>`로만 남긴다. Task 5가 그 자리에 심는다.
  - **차도(`ground.py`):** 차도 보수 패치(`road_damaged`)를 끄고, 차선·정지선 마모를 0.2 이하로 낮춘다. 마모 매개변수 이름은 ground.py에서 찾는다.
  - **`export.py`:** `CAM_ORDER`의 `lot` 라벨을 `'포켓 공원'`으로 바꾼다.

- [ ] **Step 5: 앵커를 바꾼다.**
  - `present.ANCHORS`:
    - `wires` → `('restored_brick', 'present', '복원한 벽돌 — 오염을 걷어낸 공장 띠', (65.6, 74.4, 9.5))`
    - `lot_moss` → `('park_lawn', 'nature', '포켓 공원 — 잔디와 산책로', (53.0, 16.2, 0.3))`
    - `lot_water` → `('park_water', 'nature', '물길 정원', (39.5, 3.0, 0.0))`
    - `lot_rocks` → `('park_stones', 'nature', '현무암 조경석', (49.5, 4.0, 1.6))`
  - `public/assets/nowhere/anchors.ko.json`의 같은 키를 바꾸고 `title`·`facts`·`lore`를 새로 쓴다.
    - `facts`는 사실만 쓴다(소재 id, 구현 방식).
    - `lore`에는 "2041 지중화·도시재생"을 허구로 쓴다.
  - `npm test`의 `nowhere-anchors`가 통과해야 한다. 테스트의 고정 기대값이 바뀐 id를 가리키면 테스트도 같이 고친다.

- [ ] **Step 6: 빌드하고 확인한다.**
  - `npm run nowhere:build -- -- --rebuild --no-bake`를 실행한다.
  - `look` 확인(CAM_street, CAM_future, CAM_lot, CAM_aerial):
    - 셔터 대신 유리 상점이 보인다.
    - 물탱크, 실외기, 광고판, 덮개 차가 없다.
    - 공원에 쓰러진 가림막이 없다.
    - 간판에 새 이름이 보인다.
  - 이어서 `npm run nowhere:optimize && npm test`를 실행한다(전부 PASS).
  - playwriter로 `street`, `future`, `lot`을 맑음으로 캡처해 `build/nowhere/compare/t4-<id>.png`로 남긴다.
  - 보고서에 `present.report()`의 삼각형과 조합 수 변화(Task 3 대비)를 적는다.

- [ ] **Step 7: 커밋(또는 스테이징 + 메시지 제시)** — `feat(nowhere): 성수 쇠퇴 걷어내기(물탱크 · 실외기 · 광고판 · 셔터) · 벽돌 복원 · 2041 간판 · 포켓 공원`

### Task 5: 담쟁이, 수직정원, 가로수

**Files:**
- Modify: `tools/nowhere/blender/present.py`(텍스처 `paint_ivy`·`paint_greenwall`·`paint_zelkova`, `paint_leaves` 색, 재질, `ivy_shell`, `green_wall`, `zelkova_mesh`, 배치)

**Interfaces:**
- Consumes: Task 4의 `free_spot`, `SLOT_park_tree.*`
- Produces:
  - 객체 `PR_ivy`(재질 1, `foliage`, MASK 알파)
  - `PR_greenwall_*`(`foliage`)
  - `PR_zelkova_*`(링크 복제 → 인스턴싱)
  - 재질 `NW_ivy`, `NW_greenwall`, `NW_meadow`(Task 6·8도 쓴다)

- [ ] **Step 1: 텍스처와 재질을 만든다.**
  - 텍스처: §5 표대로 `paint_ivy`, `paint_greenwall`, `paint_meadow`, `paint_zelkova`를 기존 `gen_image(name, w, h, painter)`로 만든다. `paint_leaves`의 노랑 팔레트를 §5의 잎 4색으로 바꾼다.
  - 재질: `mat_image(..., alpha=True, two_sided=True, surface='foliage')`로 만든다. 알파는 glTF MASK(cutoff 0.5)로 나가야 한다. export의 `prepare_materials_for_export`가 MASK를 유지하는지 `rg -n "alpha_mode|blend_method|MASK" tools/nowhere/blender/export.py`로 확인한다.

- [ ] **Step 2: 담쟁이 판을 만든다.** 아래를 `present.py`에 더한다. `_face`는 `(P, L, t, n)`을 돌려주고, `P(u, v, d)`는 면 위 점이다(d > 0 = 바깥). `lib.n2(x, y, freq, seed)`의 범위는 [−1, 1]이다.

```python
IVY_FACES = [  # (건물, 면, 덮는 높이 비율 최소, 최대) — 모두 street 면
    ('B1', 'S', 0.45, 0.85), ('B5', 'N', 0.50, 0.90), ('B5', 'E', 0.40, 0.80), ('B6', 'W', 0.50, 0.95),
    ('B9', 'S', 0.35, 0.70), ('B10', 'W', 0.45, 0.85), ('F2', 'S', 0.50, 0.90), ('V3', 'S', 0.30, 0.60),
    ('E1b', 'W', 0.40, 0.80), ('M2', 'S', 0.40, 0.75),
]
IVY_OFF = 0.07      # 벽에서 띄우는 거리(m)
IVY_CELL = 1.0      # 칸(m)


def ivy_shell(acc, sp, side, lo, hi, mat, holes):
    """sp 의 side 면 앞 IVY_OFF 에 1 m 칸 담쟁이 판. 위 경계 = 벽 높이 × (lo … hi, 노이즈), 창(holes: (u0, v0, u1, v1)) 칸은 비운다.
    UV = 아틀라스 2 × 2 칸 중 위 경계까지 거리로 밀도를 고른다(위로 갈수록 성기게)."""
    P, L, t, n = _face(sp, side)
    H = sp['gf'] + (sp['fl'] - 1) * sp['fh']
    seed = zlib.crc32(f"{sp['name']}{side}".encode()) % 997
    for i in range(int(L // IVY_CELL)):
        u0, u1 = i * IVY_CELL, (i + 1) * IVY_CELL
        top = H * (lo + (hi - lo) * 0.5 * (1.0 + lib.n2(u0 + 0.5, 0.0, 0.15, seed)))
        z = 0.0
        while z < top - 0.25:
            z1 = min(z + IVY_CELL, top)
            if not any(h0 - 0.15 < (u0 + u1) / 2 < h1 + 0.15 and v0 - 0.15 < (z + z1) / 2 < v1 + 0.15 for h0, v0, h1, v1 in holes):
                gap = top - z1
                dens = 3 if gap > 2.0 else 2 if gap > 1.0 else 1 if gap > 0.4 else 0
                cu, cv = (dens % 2) * 0.5, (dens // 2) * 0.5
                pts = [P(u0, z, IVY_OFF), P(u1, z, IVY_OFF), P(u1, z1, IVY_OFF), P(u0, z1, IVY_OFF)]
                k = 0.5 * (z1 - z) / IVY_CELL
                uvs = [(cu, cv), (cu + 0.5, cv), (cu + 0.5, cv + k), (cu, cv + k)]
                acc.poly([tuple(p) for p in pts], uvs, mat, (0.0, 0.25, 0.9, 0.0), want=(n[0], n[1], 0.0))
            z = z1
```

`holes`는 `facade_ops(sp, role, L, H, seed, face)`가 돌려주는 `ops`의 `(o['u0'], o['v0'], o['u1'], o['v1'])`다. `building()`이 면마다 만든 ops를 담쟁이 대상 면에 한해 저장해 두고 쓴다. 마스크 튜플 `(R 이끼, G 젖음, B AO, A)`의 의미와 길이가 `Acc.poly`의 다른 호출과 같은지 확인한다. 담쟁이는 별도 `Acc`(`IVY`)에 모아 `PR_ivy` 한 객체로 낸다.

- [ ] **Step 3: 수직정원을 만든다.** `green_wall(acc, sp, side, u0, u1, z0, z1, M)`:
  - 깊이 0.25 m 상자(테두리 `steel_black`)이고, 앞면에 `NW_greenwall`을 붙인다(UV 1 칸 = 2.4 × 1.2 m).
  - 배치(모두 role `side` 면, 그 구간의 개구부는 ops에서 뺀다):

| 건물 | 면 | u (m) | z (m) |
|---|---|---|---|
| B6 | E | 2.0 … 20.0 | 0.6 … 8.0 |
| B1 | E | 2.0 … 13.5 | 0.6 … 9.5 |
| B3 | W | 3.0 … 18.0 | 0.8 … 14.0 |

- [ ] **Step 4: 가로수를 심는다.**
  - `zelkova_mesh(name, seed, M, height=10.5)`:
    - 줄기 1 + 주가지 3(원뿔대, 6면) + 잎 카드 14–18장(꽃병 모양 수관, 폭 9 m)으로 만든다. 600–900 tris.
    - 변형 두 가지(`zelkova_a` 10.5 m, `zelkova_b` 8.5 m)를 링크 복제로 놓는다.
  - 화분형 가로수: 화분 상자 1.4 × 1.4 × 0.5(`concrete`) + `zelkova_b` 0.8배를 §4.3 후보에 놓는다. `free_spot(x, y, 0.9, tall=True)`를 통과하는 자리만 쓴다.
  - 공원의 `SLOT_park_tree.*` 자리에는 `zelkova_a`를 심고 빈 객체는 지운다.
  - 기존 은행나무(남측 보도)는 색만 여름으로 바뀐다(Step 1).

- [ ] **Step 5: 빌드하고 확인한다.**
  - `--rebuild --no-bake` → `look`(CAM_future, CAM_street, CAM_aerial)을 실행한다. 확인 목록:
    - 담쟁이가 창을 덮지 않는다.
    - 위 경계가 들쭉날쭉하다.
    - 판이 벽에 떠 보이지 않는다(0.07 m).
    - 수직정원 테두리가 벽에 붙는다.
    - 거리 시점에서 HAUS가 나무에 가려지지 않는다.
  - 이어서 optimize와 test를 실행하고, playwriter로 `future`·`street`를 캡처한다(`t5-*`).
  - 웹에서 담쟁이 알파가 MASK로 보이는지 확인한다. 검은 사각형이나 반투명 정렬 깨짐이 없어야 한다.
  - 보고서에 늘어난 삼각형(목표 +40k 이하)을 적는다.

- [ ] **Step 6: 커밋(또는 스테이징 + 메시지 제시)** — `feat(nowhere): 성수 담쟁이 10면 · 수직정원 3면 · 여름 가로수와 느티나무`

### Task 6: 지붕(태양광 · 옥상정원)과 아파트 녹화

**Files:**
- Modify: `tools/nowhere/blender/present.py`(`paint_pv`, `NW_pv`, `pv_on_gable`, `roof_deck`, `apartment_mesh`)

**Interfaces:**
- Consumes: `NW_meadow`(Task 5)
- Produces: 재질 `NW_pv`(Task 8·9도 쓴다), 정적 묶음에 들어가는 지붕 부재

- [ ] **Step 1: `paint_pv`(§5)와 `NW_pv`(거칠기 0.18, 금속 0.3, surface `metal`)를 만든다.** UV 1 = 패널 1장(1.0 × 1.7 m)이다.

- [ ] **Step 2: 박공 지붕에 태양광을 올린다.** `pv_on_gable(acc, sp, M)`:
  - 해가 남서쪽이므로 경사면을 고른다. 용마루가 x면 남향(−y) 면, y면 서향(−x) 면이다.
  - 처마·박공·용마루에서 0.6 m 들인 사각형을 지붕면 법선으로 0.06 m 띄운 한 장(quad)으로 만든다. UV는 패널 단위 반복이다.
  - 대상: `roof == 'gable'`인 모든 동(B1, B4, B5, B6, B7, B9, B11, M2, W1, W2, F3, E1f, SH4).
  - `roof_gable`이 계산하는 처마 높이·용마루 높이와 같은 식을 쓴다. 공통 계산을 함수로 빼서 두 곳이 같은 값을 쓰게 한다.

- [ ] **Step 3: 평지붕을 태양광과 정원으로 나눈다.** `roof_deck(acc, sp, M)`은 파라펫 안쪽 0.8 m 사각형에 아래 규칙을 적용한다.
  - **면적 ≥ 120 m²:**
    - 서쪽 60 %에는 태양광 줄을 놓는다. 남쪽으로 10° 기울이고, 경사 길이 1.7 m, 줄 간격 2.9 m, 지붕 위 0.35 m 레일에 올린다. 한 줄 = 윗면 quad 1 + 뒷판 quad 1이다.
    - 동쪽 40 %는 정원이다. 화단 0.45 m 높이 상자(옆 `#5E5A52`, 윗면 `NW_meadow`)를 1.2 m 폭으로 놓고 사이를 0.8 m 자갈길로 둔다. 관목(`shrub` 0.6배)은 2–3개다.
  - **면적 < 120 m²:** 전체를 정원으로 한다.
  - **MX:** 90 %를 태양광으로 한다.
  - `stairhouse`는 남긴다. 계단실 자리(Acc에 기록된 사각형)를 피한다.

- [ ] **Step 4: 아파트를 고친다(`apartment_mesh`).**
  - 북쪽 긴 면(뚝섬로 쪽)의 각 층 슬래브 선에 발코니 식재 띠를 단다. 깊이 0.35, 높이 0.45, 길이 33 m, 윗면·앞면은 `NW_meadow`다.
  - 옥상은 `roof_deck`의 태양광 규칙(70 %)을 쓴다.
  - 링크 복제 3동이므로 메시 하나만 바뀐다.

- [ ] **Step 5: 빌드하고 확인한다.**
  - `--rebuild --no-bake` → `look`(CAM_aerial, CAM_future)을 실행한다. 확인 목록:
    - 위에서 지붕의 절반 넘게가 태양광이나 녹색이다.
    - 패널이 지붕을 뚫거나 뜨지 않는다.
  - 이어서 optimize와 test를 실행하고, playwriter로 `aerial`을 캡처한다(`t6-aerial`).
  - 보고서에 삼각형과 조합 수를 적는다.

- [ ] **Step 6: 커밋(또는 스테이징 + 메시지 제시)** — `feat(nowhere): 성수 지붕 태양광 · 옥상정원, 아파트 발코니 식재`

### Task 7: 원경 유리 스카이라인, 타워 대지 비우기, 튜브 외피 연장

**Files:**
- Modify: `tools/nowhere/blender/future.py`(데이터 상수만: `TOWERS`, `TUBE_PROFILE`, `TUBE_SPANS`)
- Modify: `tools/nowhere/blender/backdrop.py`(`paint_city` 타워 띠, `tower()` 옥상, `build_mid` 제외, `BD_infra` 튜브 외피)

**Interfaces:**
- Produces:
  - `future.TOWERS: list[dict(id, c, size, h, form, …)]`(§4.2 표 그대로)
  - `future.TUBE_PROFILE`, `future.TUBE_SPANS`
  - 원경 객체 `BD_tube_w`, `BD_tube_e`

- [ ] **Step 1: 상수를 넣는다(`future.py` 배치 상수 절).**

```python
# 신축 타워(§4.2): 장면 사각형 밖, 원경 BD_mid 를 비운 대지(backdrop.py 가 이 표로 비운다)
TOWERS = [
    dict(id='T1', c=(-40.0, 205.0), size=(32.0, 26.0), h=128.0, form='setback', setbacks=(40.0, 80.0), inset=2.0, turbines=3),
    dict(id='T2', c=(30.0, 228.0), size=(28.0, 28.0), h=104.0, form='rounded', r=6.0, green_every=3, turbines=0),
    dict(id='T3', c=(110.0, 196.0), size=(36.0, 22.0), h=84.0, form='stepped',
         steps=((0.0, 40.0, 1.0), (40.0, 64.0, 2.0 / 3.0), (64.0, 84.0, 1.0 / 3.0)), turbines=0),
    dict(id='T4', c=(205.0, 40.0), size=(30.0, 30.0), h=116.0, form='crown', crown=8.0, turbines=2),
]
TOWER_SITE_MARGIN = 12.0
# 2호선 유리 튜브: 단면(y = 고가 중심 155 기준, z 절대), 장면 층 구간(승강장 22.8 … 91.2 은 기존 지붕)
TUBE_Y = 155.0
TUBE_PROFILE = [(-4.7, 9.0), (-4.7, 11.6), (-3.3, 13.9), (-1.2, 15.0), (1.2, 15.0), (3.3, 13.9), (4.7, 11.6), (4.7, 9.0)]
TUBE_SPANS = [(-300.0, 22.8), (91.2, 420.0)]
```

- [ ] **Step 2: 원경 유리를 다시 칠한다(`backdrop.py`).**
  - `paint_city`의 타워 띠 표(backdrop.py:204-205)를 아래로 바꾼다.

```python
    for nm, floors, glass, mull, p in (('office_up', 1, '#7FA6C4', '#DDE3E7', 0.35), ('tower4', 4, '#8FB4CF', '#DDE3E7', 0.3),
                                       ('tower4_b', 4, '#A9C6DA', '#E4E8EA', 0.3)):
```

  - 같은 루프에서 유리 칸 색을 칠하는 줄을 찾아 띠 안 세로 위치 v(0 = 아래, 1 = 위)로 하늘 반사 기울기를 준다. 식은 `glass` → `#D6E6F1`, 비율 `0.35·v`다. 칸 4개 중 하나는 10 % 어둡게(블라인드) 한다.
  - `tower()`의 옥상 덮개 띠는 `(round(cx) + round(cy)) % 2 == 0`인 타워에서 `'roof_green'`을 쓴다.
  - 밤 발광 아틀라스(`NWB_gen_city_night`)는 그대로 둔다.

- [ ] **Step 3: 타워 대지를 비운다.** `build_mid`에서 필지(사각형)가 아래 사각형과 겹치면 건물을 놓지 않는다(필지는 지면만 남긴다).

```python
    import future
    sites = [(t['c'][0] - t['size'][0] / 2 - future.TOWER_SITE_MARGIN, t['c'][1] - t['size'][1] / 2 - future.TOWER_SITE_MARGIN,
              t['c'][0] + t['size'][0] / 2 + future.TOWER_SITE_MARGIN, t['c'][1] + t['size'][1] / 2 + future.TOWER_SITE_MARGIN)
             for t in future.TOWERS]
    overlaps = lambda r: any(r[0] < s[2] and s[0] < r[2] and r[1] < s[3] and s[1] < r[3] for s in sites)
```

- [ ] **Step 4: 튜브 외피를 원경으로 잇는다(`BD_infra`).**
  - `TUBE_PROFILE`을 x `VIA_EXT[0]` … −300, 420 … `VIA_EXT[1]`로 밀어 만든 외피다. 리브는 없고 끝 마개도 없다.
  - 재질 `NWB_tube`는 색 `#9FC3D6`, 거칠기 0.15, 금속 0.6, 불투명이다. 멀리서는 반사 띠로 읽히게 한다.

- [ ] **Step 5: 빌드하고 확인한다.**
  - `--rebuild --no-bake` → `look`(CAM_aerial, CAM_street)을 실행한다. 확인 목록:
    - 원경 타워가 파란 유리로 읽힌다.
    - 타워 대지 4곳이 비었다.
    - 원경 고가 위로 튜브 띠가 이어진다.
  - 이어서 optimize와 test를 실행한다(전송 예산 PASS).
  - playwriter로 `aerial`을 캡처한다(`t7-aerial`).

- [ ] **Step 6: 커밋(또는 스테이징 + 메시지 제시)** — `feat(nowhere): 성수 원경 유리 커튼월 · 옥상 녹화, 신축 타워 대지, 튜브 원경 외피`

### Task 8: 신축 타워 4동과 풍력 → CP1

**Files:**
- Modify: `tools/nowhere/blender/future.py`(`paint_curtain`, `paint_curtain_night`, `build_towers`, `turbine_mesh`, `build()`에 연결)
- Create: `tests/nowhere-future-layout.test.mjs`

**Interfaces:**
- Consumes: `TOWERS`(Task 7), `NW_meadow`·`NW_pv`(Task 5·6)
- Produces:
  - `FU_tower_T1…T4`(`nw_solid=1`, 재질 `NWF_curtain`)
  - `FU_turbine_mast.0…4`, `FU_turbine_rotor.0…4`(각자 단일 사용자 메시, 회전축 로컬 +X)

- [ ] **Step 1: 실패하는 테스트를 쓴다** — `tests/nowhere-future-layout.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const layout = JSON.parse(readFileSync(new URL('../public/assets/nowhere/layout.json', import.meta.url), 'utf8'));
const TOWERS = { T1: 128, T2: 104, T3: 84, T4: 116 };
const solid = (id) => layout.solids.find((b) => b.id === id);
const nearestXZ = (p, b) =>
  Math.hypot(Math.max(b.min[0] - p[0], 0, p[0] - b.max[0]), Math.max(b.min[2] - p[2], 0, p[2] - b.max[2]));

test('(a) 신축 타워 4동: 높이가 표와 같고(옥상 설비 +3 m 이내) 장면 사각형 밖에 선다', () => {
  const [x0, y0, x1, y1] = layout.maskRect;            // Blender (x, y) → three x, z = −y
  for (const [id, h] of Object.entries(TOWERS)) {
    const b = solid(`FU_tower_${id}`);
    assert.ok(b, `FU_tower_${id} 없음`);
    assert.ok(b.max[1] >= h - 0.5 && b.max[1] <= h + 3, `${id} 높이 ${b.max[1]}`);
    const outside = b.max[0] < x0 || b.min[0] > x1 || b.max[2] < -y1 || b.min[2] > -y0;
    assert.ok(outside, `${id} 가 장면 사각형과 겹친다`);
  }
});

test('(b) 주인공 유지: 거리 시점에서 각 타워의 투영 높이는 HAUS 의 0.6 배 이하', () => {
  const cam = layout.cameras.find((c) => c.id === 'street').pos;
  const haus = solid('HAUS');
  const tanH = (haus.max[1] - cam[1]) / nearestXZ(cam, haus);
  for (const id of Object.keys(TOWERS)) {
    const b = solid(`FU_tower_${id}`);
    const ratio = (b.max[1] - cam[1]) / nearestXZ(cam, b) / tanH;
    assert.ok(ratio <= 0.6, `${id}: HAUS 의 ${ratio.toFixed(2)} 배`);
  }
});
```

- [ ] **Step 2:** `node --test tests/nowhere-future-layout.test.mjs`를 실행한다. Expected: FAIL(`FU_tower_T1 없음`).

- [ ] **Step 3: 커튼월 텍스처와 재질을 만든다.**
  - 텍스처: `paint_curtain`(1024 × 2048)과 `paint_curtain_night`(512 × 1024)를 §5대로 기존 `_canvas`·`_rect`로 그린다. 하늘 반사 줄은 저주파 노이즈로 넣는다.
  - 재질: `mat_ui('NWF_curtain', alb, emi, day=0.0, night=1.1, rough=0.12, surface='glass')`.
  - 웹에서 `glass` 표면의 `nw_emit` 밤 발광이 켜지는지 Step 6에서 확인한다. 켜지지 않으면 `surface.js`의 `NW_glass_window` 밤 창 처리와 같은 분기에 `NWF_curtain`을 더한다.

- [ ] **Step 4: 타워를 만든다.** `build_towers(C, M)`가 형태별 매스를 만든다.
  - 외벽 UV: u = 둘레 누적 m / 12, v = z / 16.
  - 층 슬래브 띠: 4 m마다 0.3 m 돌출 없는 색 띠(아틀라스 안).
  - 테라스·크라운·계단 윗면:
    - `NW_meadow` 화단: 가장자리에서 1 m 안, 폭 1.2, 높이 0.5.
    - 유리 난간: 1.1 m, 알파 0.3. 재질 `NWF_glass_rail`.
    - 관목 카드 몇 개.
  - T3 맨 위에는 태양광 캐노피를 단다. 기둥 4 + 남쪽 10° 기울인 판(`NW_pv`)이다.
  - T1 꼭대기는 태양광 줄(Task 6 규칙)과 풍력 3기를 놓는다. 동쪽 절반 위에 8 m 간격으로 둔다.
  - T4 크라운 바닥(108 m)에는 풍력 2기를 놓는다.
  - 타워마다 ≤ 6k tris. 객체 이름은 `FU_tower_<id>`이고 `nw_solid=1`, `nw_surface='glass'`다.
  - **풍력:** `turbine_mesh(M)`이 마스트와 회전자를 따로 돌려준다. 회전자는 원점이 허브이고 축은 로컬 +X다. 방위 200°를 보게 `rotation_euler.z`를 준다.
    - 이동체이므로 회전자는 `me.copy()`로 단일 사용자 메시를 준다.
    - 마스트는 링크 복제여도 된다(움직이지 않음).

- [ ] **Step 5: 빌드하고 확인한다.**
  - `--rebuild --no-bake` → `look`(CAM_future, CAM_aerial, CAM_street)을 실행한다. 확인 목록:
    - 골목 끝 고가 너머로 T1·T2·T3이 선다.
    - 거리 시점에서 HAUS 오른쪽 뒤로 T4가 HAUS보다 작게 보인다.
  - 이어서 optimize와 `npm test`를 실행한다(future-layout (a)(b), clearance 전부 PASS).

- [ ] **Step 6: CP1을 준비하고 사용자에게 보인다(컨트롤러).**
  - `npm run nowhere:build -- -- --rebuild`(전체 굽기) → `npm run nowhere:optimize` → `npm test`를 실행한다.
  - playwriter 1600 × 900으로 `?cam=street|future|aerial`(맑음 14:00)을 찍어 `build/nowhere/compare/cp1-<id>.png`로 남긴다.
  - 같은 시점에서 `?stats=1` 데스크톱과 `&tier=mobile`의 FPS·그리기·삼각형·텍스처 MB를 적는다.
  - `before`·CP1·레퍼런스를 나란히 놓은 비교 페이지를 Artifact로 올리고 링크를 준다.
    - 지난 시안 페이지(https://claude.ai/artifact/4D3ijdKvnnf5k4QnCbGHtb)와 같은 형식의 새 페이지다.
    - 레퍼런스 이미지는 사용자가 준 것이고 비공개 페이지 안에서만 쓴다.
  - 사용자 승인을 받는다. 수정 요청이 있으면 해당 태스크로 돌아간다.

- [ ] **Step 7: 커밋(또는 스테이징 + 메시지 제시)** — `feat(nowhere): 성수 신축 유리 타워 4동(테라스 녹화 · 옥상 태양광 · 풍력)`

### Task 9: 2호선 유리 튜브와 열차, 스카이브리지 2개

**Files:**
- Modify: `tools/nowhere/blender/future.py`(`build_tube`, `train_mesh`, `build_trains`, `build_bridges`)
- Modify: `public/src/nowhere/world.js`(튜브 유리 투명 처리)
- Test: `tests/nowhere-future-layout.test.mjs`에 (c)

**Interfaces:**
- Consumes: `TUBE_PROFILE`, `TUBE_SPANS`(Task 7)
- Produces:
  - `FU_tube_ribs_w/e`(`nw_solid=1`), `FU_tube_glass_w/e`, `FU_tube_led`, `FU_tube_planter_*`
  - `FU_train_a/b`(단일 사용자 메시, 앞 +X, 원점 = 열차 중심 바닥)
  - `FU_bridge_SB1_deck`, `FU_bridge_SB2_deck`, `FU_bridge_SB<n>_col.<k>`(모두 `nw_solid=1`)

- [ ] **Step 1: 실패하는 테스트를 쓴다** — `tests/nowhere-future-layout.test.mjs`에 더한다.

```js
test('(c) 튜브 · 스카이브리지: 상자가 있고, 상판 아래 차도 여유 · 튜브 높이가 설계값이다', () => {
  for (const id of ['FU_tube_ribs_w', 'FU_tube_ribs_e', 'FU_bridge_SB1_deck', 'FU_bridge_SB2_deck',
    'FU_bridge_SB1_col.0', 'FU_bridge_SB1_col.1', 'FU_bridge_SB2_col.0', 'FU_bridge_SB2_col.1']) {
    assert.ok(solid(id), `${id} 없음`);
  }
  assert.ok(solid('FU_bridge_SB1_deck').min[1] >= 8.4, 'SB1 상판 밑 ≥ 8.4 m');
  assert.ok(solid('FU_bridge_SB2_deck').min[1] >= 9.4, 'SB2 상판 밑 ≥ 9.4 m');
  for (const id of ['FU_tube_ribs_w', 'FU_tube_ribs_e']) {
    const b = solid(id);
    assert.ok(b.max[1] >= 14.5 && b.max[1] <= 15.5, `${id} 꼭대기 ${b.max[1]}`);
    assert.ok(b.min[1] >= 8.9, `${id} 바닥 ${b.min[1]}`);
  }
});
```

- [ ] **Step 2:** 테스트를 실행해 FAIL을 확인한다.

- [ ] **Step 3: 튜브를 만든다.** `build_tube(C, M)`가 `TUBE_SPANS`의 두 구간마다 아래를 만든다.
  - 리브: 5.5 m 간격. `TUBE_PROFILE` 꺾은선을 따라 0.2 × 0.3 상자 이음이며 재질은 흰 강재 `#E6E9EA`다. → `FU_tube_ribs_<w|e>`
  - 유리: 리브 사이 판. 단면 7변을 x 방향으로 민다. 재질 `NWF_tube_glass`(`mat_glass` 계열, 알파 0.22, 색 `#BFD8E6`) → `FU_tube_glass_<w|e>`
  - 등줄기 LED: 꼭대기 z 14.95 아래 폭 0.08 m 띠. `mat_emit('NWF_tube_led', '#DDF4FA', day=0.0, night=2.0)` → `FU_tube_led`
  - 상판 바깥 화단: §4.2 수치, 윗면 `NW_meadow` + 늘어진 덩굴 카드(Task 5의 담쟁이 아틀라스 밀도 0.6 칸, 0.8 m) → `FU_tube_planter_<w|e>`
  - 승강장 구간(22.8…91.2)에는 만들지 않는다.

- [ ] **Step 4: 열차를 만든다.** `train_mesh(M)`(§4.2 치수):
  - 차체 단면은 8각(모서리 0.35 m 깎음)이다.
  - 창 띠는 `mat_ui`로 만든다. 낮에는 어두운 유리, 밤에는 따뜻한 흰 발광 1.2다.
  - 청록 띠는 `mat_emit('NWF_train_stripe', '#39C6E0', day=0.4, night=1.5)`다.
  - 전조등·미등을 단다.
  - `build_trains`는 `FU_train_a`를 (−200, 152.6, 9.3)에, `FU_train_b`를 (240, 157.4, 9.3)에 놓는다. 앞 +X, 각자 `me.copy()`다.

- [ ] **Step 5: 스카이브리지를 만든다.** `build_bridges(C, M)`(§4.2 표):
  - 상판: 흰 콘크리트 상자, 윗면은 보도 타일이다.
  - 유리 난간과 상부 레일을 단다.
  - 하부 소핏 양 가장자리에 LED 선을 둔다(`mat_emit` `#39C6E0`, day 0.3, night 1.6).
  - 기둥: 원통 12면이며 지면 높이(future.py의 `GroundZ().z`)에서 상판 밑까지 세운다.
  - SB2 상판 가장자리에는 6 m마다 화단(1.2 × 0.5 × 0.45, `NW_meadow`)을 둔다.
  - 상판과 기둥은 각자 객체이고 모두 `nw_solid=1`이다.

- [ ] **Step 6: 웹에서 튜브 유리를 투명 처리한다(`world.js`).** 레이어 처리 루프에서 재질 이름이 `NWF_tube_glass`이면 아래를 적용한다. `NWF_glass_rail`도 같게 하되 `opacity`는 0.3이다.

```js
          m.transparent = true;
          m.opacity = 0.22;
          m.depthWrite = false;
```

병합 단계(`mergeGeometries`)가 투명 재질을 불투명과 합치지 않는지 확인한다. 정적 병합 대상에서 `transparent` 재질을 빼는 조건이 없으면 더한다.

- [ ] **Step 7: 빌드하고 확인한다.**
  - `--rebuild --no-bake` → optimize → `npm test`를 실행한다(future-layout (c), clearance (b)(c) PASS).
    - 인트로가 튜브나 스카이브리지에 2 m 안으로 붙으면 `intro-path.js`를 고친다.
  - playwriter로 아래를 캡처한다(`t9-*`).
    - `?cam=future`: 골목 끝 고가 위 유리 튜브와 그 안 열차, SB1
    - `?cam=street`: 오른쪽 멀리 SB2가 길을 가로지른다
    - `?cam=viaduct`
  - 튜브 유리 뒤 열차가 보이는지, 유리가 하늘을 가리는 정렬 오류가 없는지 본다.

- [ ] **Step 8: 커밋(또는 스테이징 + 메시지 제시)** — `feat(nowhere): 2호선 고가 위 유리 튜브와 열차, 보행 스카이브리지 2개`

### Task 10: 스마트 거리 — 태양광 노면, 청록 발광선, 키오스크, 테라스, 배송로봇

**Files:**
- Modify: `tools/nowhere/blender/future.py`(`paint_pv_road`, `build_road_pv`, `build_road_led`, 키오스크 변형, `umbrella_set_mesh`, `bot_mesh`, 배치, `FU_crossing` 색, 택시 5대)
- Modify: `tools/nowhere/blender/present.py`(벤치·화분 배치가 present 쪽 함수면 그곳)

**Interfaces:**
- Consumes: `present.free_spot`(future.py는 함수 안에서 `import present`), future.py의 `GroundZ`
- Produces:
  - `FU_road_pv`, `FU_road_led`
  - `FU_kiosk_glass.<n>`, `FU_terrace.<n>`
  - `FU_bot.0…2`, `FU_taxi.0…4`(모두 단일 사용자 메시, 앞 +X)

- [ ] **Step 1: 태양광 띠를 만든다.** `paint_pv_road`(§5)를 그린다. `build_road_pv(C, M, gz)`는 §4.2 범위의 리본을 5 m마다 `gz.z(x, y)` + 0.008로 만든다.
  - 재질: 거칠기 0.2, 금속 0.25, surface `metal`.
  - 장면 밖(x < −112, x > 162)의 노면 높이는 backdrop.py 'tt' 도로 메시를 만드는 코드에서 z 값을 읽어 상수로 쓴다.

- [ ] **Step 2: 발광선을 만든다.** `build_road_led(C, M, gz)`: §4.2의 선들을 폭 0.10 m 리본으로 만든다(노면 + 0.010).
  - 재질 `mat_emit('NWF_road_led', '#39C6E0', day=0.5, night=2.2)`, 객체 `nw_surface='emissive'`, `nw_night=1`.
  - `build_crossing`의 `#43ABA7`을 `#39C6E0`으로 바꾼다.

- [ ] **Step 3: 거리 소품을 만든다.**
  - **투명 키오스크** `FU_kiosk_glass.<n>`:
    - 기존 키오스크 형태(0.9 × 1.8, 바닥 0.25 m)에서 화면을 유리 판으로 바꾼다. `paint_ui`의 키오스크 칸을 발광 + 알파로 쓰고 알파 0.55다.
    - §4.3 후보 6곳에 `free_spot(x, y, 0.6, tall=True)`.
  - **카페 테라스** `umbrella_set_mesh(M)`:
    - 파라솔: 8각, 반지름 1.4, 높이 2.4, 천 `#F2EFE6`.
    - 둥근 탁자: r 0.4. 의자: 3개.
    - §4.3 후보에 `free_spot(x, y, 1.6, tall=True)`. 링크 복제 가능(움직이지 않음).
  - **벤치와 화분:** 뚝섬로 북측 x 70, 130(y −34.2)과 공원 산책로를 따라 놓는다.
  - **배송로봇** `bot_mesh(M)`: 0.7 × 0.55 × 0.6 흰 몸통(윗모서리 0.1 둥글게), 청록 띠(발광), 바퀴 6이다. `FU_bot.0…2`는 `me.copy()`이고 각 경로 시작점에 놓는다(§4.4).
  - **포드:** `TAXIS`를 5대로 늘린다. 위치는 §4.4 각 경로의 시작점이고 진행 방향은 +X 기준 회전이다. 링크 복제를 `me.copy()`로 바꾼다(이동체).

- [ ] **Step 4: 빌드하고 확인한다.**
  - `--rebuild --no-bake` → optimize → test를 실행한다.
  - playwriter로 `?cam=street`, `?cam=future`, `?cam=street&time=21.5`를 캡처한다(`t10-*`). 확인 목록:
    - 태양광 띠와 발광선이 낮에는 은은하고 밤에는 길을 그린다.
    - 키오스크와 테라스가 보도를 막지 않는다.
  - 보행 모드로 뚝섬로 북측 보도를 걸어 소품 충돌이 자연스러운지 확인한다(키오스크는 막고 발광선은 통과).

- [ ] **Step 5: 커밋(또는 스테이징 + 메시지 제시)** — `feat(nowhere): 성수 스마트 거리(태양광 노면 · 청록 발광선 · 투명 키오스크 · 카페 테라스 · 배송로봇)`

### Task 11: 움직임 — `movers.js`, `layout.movers`, 드론 소포 → CP2

**Files:**
- Create: `public/src/nowhere/movers.js`, `tests/nowhere-movers.test.mjs`
- Modify: `tools/nowhere/blender/future.py`(`MOVERS` 표와 `nw_movers` 기록, 드론 이름·소포·d4·d5), `tools/nowhere/blender/export.py`(`drones` → `movers`)
- Modify: `public/src/nowhere/world.js`(드론 블록 → 이동체 액터, 보행 장애물 제외 정규식), `public/src/nowhere/camera.js`(`updateDroneActors` 삭제), `public/src/nowhere/main.js`
- Test: `tests/nowhere-clearance.test.mjs`에 (d)

**Interfaces:**
- Produces:
  - `movers.js`: `MOVER_KINDS`, `buildTrack(points, closed)`, `sampleTrack(track, s)`, `moverDistance(def, length, elapsed)`, `headingYaw(dir, yawOffset)`, `moverPose(def, track, elapsed)`, `spinAngle(def, elapsed)`
  - `layout.movers: [{ id, kind, object, mode?, speed?, phase?, path?, bob?, yawOffset?, flipYaw?, beam?, rpm? }]`
  - `world.moverActors`, `updateMoverActors(actors, elapsed)`(world.js export)

- [ ] **Step 1: 실패하는 테스트를 쓴다** — `tests/nowhere-movers.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTrack, sampleTrack, moverDistance, headingYaw, moverPose, spinAngle, MOVER_KINDS } from '../public/src/nowhere/movers.js';

const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

function glbNodeNames(rel) {
  const buf = readFileSync(new URL(rel, import.meta.url));
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  return new Set((json.nodes || []).map((n) => n.name));
}

test('(a) 꺾은선 길이 · 보간 · 닫힌 고리 · 범위 밖은 끝에 붙는다', () => {
  const sq = [[0, 0, 0], [10, 0, 0], [10, 0, 10], [0, 0, 10]];
  const open = buildTrack(sq, false);
  const loop = buildTrack(sq, true);
  assert.equal(open.length, 30);
  assert.equal(loop.length, 40);
  assert.deepEqual(sampleTrack(loop, 15).pos, [10, 0, 5]);
  assert.deepEqual(sampleTrack(loop, 35).pos, [0, 0, 5]);
  assert.deepEqual(sampleTrack(loop, 35).dir, [0, 0, -1]);
  assert.deepEqual(sampleTrack(open, -5).pos, [0, 0, 0]);
  assert.deepEqual(sampleTrack(open, 99).pos, [0, 0, 10]);
});

test('(b) loop · wrap 은 한 방향, pingpong 은 끝에서 되돌아온다(위상 반영)', () => {
  assert.deepEqual(moverDistance({ mode: 'loop', speed: 10 }, 40, 5), { s: 10, sign: 1 });
  assert.deepEqual(moverDistance({ mode: 'wrap', speed: 10 }, 40, 5), { s: 10, sign: 1 });
  assert.deepEqual(moverDistance({ mode: 'wrap', speed: 10, phase: 0.5 }, 40, 3), { s: 10, sign: 1 });
  assert.deepEqual(moverDistance({ mode: 'pingpong', speed: 10 }, 40, 3), { s: 30, sign: 1 });
  assert.deepEqual(moverDistance({ mode: 'pingpong', speed: 10 }, 40, 5), { s: 30, sign: -1 });
  assert.deepEqual(moverDistance({ mode: 'pingpong', speed: 10 }, 40, 8), { s: 0, sign: 1 });
});

test('(c) 방향 → rotation.y: 앞 = 로컬 +X, 드론(앞 = +Z)은 yawOffset π/2', () => {
  for (const dir of [[1, 0, 0], [0, 0, 1], [-1, 0, 0], [0.6, 0, -0.8]]) {
    const th = headingYaw(dir);                   // rotation.y = θ 는 로컬 +X 를 (cos θ, 0, −sin θ) 로
    assert.ok(near(Math.cos(th), dir[0], 1e-12) && near(-Math.sin(th), dir[2], 1e-12), `+X ${dir}`);
    const tz = headingYaw(dir, Math.PI / 2);      // 로컬 +Z 는 (sin θ, 0, cos θ) 로
    assert.ok(near(Math.sin(tz), dir[0], 1e-12) && near(Math.cos(tz), dir[2], 1e-12), `+Z ${dir}`);
  }
});

test('(d) 왕복: flipYaw 면 돌아서고 아니면 같은 쪽을 본 채 뒤로 간다 · 드론은 흔들린다 · 회전자 각도', () => {
  const tr = buildTrack([[0, 0, 0], [40, 0, 0]], false);
  assert.ok(near(Math.cos(moverPose({ mode: 'pingpong', speed: 10, flipYaw: true }, tr, 5).yaw), -1, 1e-12));
  assert.ok(near(Math.cos(moverPose({ mode: 'pingpong', speed: 10 }, tr, 5).yaw), 1, 1e-12));
  const loop = buildTrack([[0, 10, 0], [10, 10, 0], [10, 10, 10]], true);
  const ys = [0, 0.3, 0.6, 0.9].map((t) => moverPose({ mode: 'loop', speed: 0, bob: 0.28 }, loop, t).pos[1]);
  assert.ok(Math.max(...ys) - Math.min(...ys) > 0.2 && Math.max(...ys) <= 10.28 + 1e-9);
  assert.ok(near(spinAngle({ rpm: 30 }, 2), 2 * Math.PI));
});

test('(e) layout.movers: 종류 · 모드 · 경로 · 속도, 오브젝트가 future GLB(데스크톱 · 모바일)에 있다, drones 키는 없다', () => {
  const layout = JSON.parse(readFileSync(new URL('../public/assets/nowhere/layout.json', import.meta.url), 'utf8'));
  assert.equal(layout.drones, undefined);
  const names = [glbNodeNames('../public/assets/nowhere/nowhere-future.glb'), glbNodeNames('../public/assets/nowhere/mobile/nowhere-future.glb')];
  const kinds = {};
  for (const m of layout.movers) {
    assert.ok(MOVER_KINDS.includes(m.kind), m.id);
    for (const set of names) assert.ok(set.has(m.object), `${m.id}: ${m.object} 없음`);
    kinds[m.kind] = (kinds[m.kind] || 0) + 1;
    if (m.kind === 'spin') {
      assert.ok(m.rpm > 0, m.id);
      continue;
    }
    assert.ok(['loop', 'wrap', 'pingpong'].includes(m.mode), m.id);
    assert.ok(m.speed > 0 && Array.isArray(m.path) && m.path.length >= 2, m.id);
  }
  assert.deepEqual(kinds, { drone: 6, pod: 5, train: 2, bot: 3, spin: 5 });
});
```

`tests/nowhere-clearance.test.mjs`에 더한다.

```js
test('(d) 이동체 경로: 드론은 solid 에서 3 m, 포드는 1.5 m, 배송로봇은 0.7 m 이상', () => {
  const R = { drone: 3.0, pod: 1.5, bot: 0.7 };
  for (const m of layout.movers || []) {
    if (!(m.kind in R)) continue;
    const r = nearest(m.path);
    assert.ok(r.d >= R[m.kind], `${m.id}: ${r.id} ${r.d.toFixed(2)} m @ ${r.at}`);
  }
  assert.ok((layout.movers || []).length > 0, 'movers 없음');
});
```

- [ ] **Step 2:** `node --test tests/nowhere-movers.test.mjs tests/nowhere-clearance.test.mjs`를 실행한다. Expected: movers 모듈이 없어 FAIL, clearance (d) FAIL.

- [ ] **Step 3: `public/src/nowhere/movers.js`를 쓴다.**

```js
// HAUS NOWHERE — 성수 2041: 경로 이동체(드론 · 자율주행 포드 · 튜브 열차 · 배송로봇 · 풍력 회전자)의 순수 계산.
// 경로는 export.py 가 2 m 간격 꺾은선으로 내보낸다(드론 고리는 Catmull-Rom 을 미리 펴서). 여기서는 길이 비례로만 움직인다.
// 좌표는 Three (x, y 위, z). 메시의 앞 = 로컬 +X(Blender 와 같은 약속). 드론처럼 +Z 가 앞이면 yawOffset = π/2.
// 테스트: tests/nowhere-movers.test.mjs

export const MOVER_KINDS = ['drone', 'pod', 'train', 'bot', 'spin'];

/** 꺾은선 → 누적 길이 표. closed 면 마지막 → 처음 구간을 더한다. */
export function buildTrack(points, closed = false) {
  const pts = points.map((p) => [p[0], p[1], p[2]]);
  if (closed && pts.length > 1) pts.push(pts[0].slice());
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  return { pts, cum, length: cum[cum.length - 1], closed };
}

/** 길이 s 의 위치와 진행 방향(단위 벡터). 범위 밖 s 는 끝에 붙인다. */
export function sampleTrack(track, s) {
  const { pts, cum, length } = track;
  const d = Math.min(Math.max(s, 0), length);
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid;
    else hi = mid;
  }
  const a = pts[lo];
  const b = pts[hi];
  const seg = cum[hi] - cum[lo] || 1;
  const t = (d - cum[lo]) / seg;
  return {
    pos: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
    dir: [(b[0] - a[0]) / seg, (b[1] - a[1]) / seg, (b[2] - a[2]) / seg],
  };
}

/** 시각 elapsed(초)의 경로 위 거리 s 와 진행 부호. loop · wrap = 한 방향(wrap 은 끝 → 처음으로 건너뜀), pingpong = 왕복. */
export function moverDistance(def, length, elapsed) {
  const L = Math.max(length, 1e-6);
  const travel = elapsed * def.speed + (def.phase || 0) * L;
  if (def.mode === 'pingpong') {
    const m = ((travel % (2 * L)) + 2 * L) % (2 * L);
    return m <= L ? { s: m, sign: 1 } : { s: 2 * L - m, sign: -1 };
  }
  return { s: ((travel % L) + L) % L, sign: 1 };
}

/** 진행 방향 → three rotation.y(앞 = 로컬 +X) + yawOffset. 위아래 성분은 무시한다. */
export function headingYaw(dir, yawOffset = 0) {
  return Math.atan2(-dir[2], dir[0]) + yawOffset;
}

/** 이동체 자세 { pos, yaw }. 왕복에서 되돌아갈 때 flipYaw 면 돌아선다(배송로봇). 열차는 양 끝이 같아 돌지 않는다. */
export function moverPose(def, track, elapsed) {
  const { s, sign } = moverDistance(def, track.length, elapsed);
  const { pos, dir } = sampleTrack(track, s);
  const d = sign < 0 && def.flipYaw ? [-dir[0], -dir[1], -dir[2]] : dir;
  if (def.bob) pos[1] += Math.sin(elapsed * 2.4 + (def.phase || 0) * 10) * def.bob;
  return { pos, yaw: headingYaw(d, def.yawOffset || 0) };
}

/** 풍력 회전자 각도(라디안). */
export function spinAngle(def, elapsed) {
  return ((def.rpm || 0) * Math.PI * 2 * elapsed) / 60;
}
```

- [ ] **Step 4: 이동체 표를 만든다(`future.py`).**
  - **드론 이름:** 배송 드론을 `FU_drone_d1…d5`(각자 `me.copy()`)로 바꾸고 `PATH_drone_*` 빈 객체 대신 아래 표를 쓴다.
  - **소포:** 배송 드론(d1…d5)마다 소포를 단다. 상자 0.5 × 0.4 × 0.35(골판지 `#B98C5A`, `paint_ui` 골판지 칸), 0.6 m 아래, 가는 줄 4개다. 드론과 한 메시다.
  - **드론 추가:** `DRONE_PATHS`·`DRONE_SPEED`에 §4.4의 d4·d5를 더한다.
  - **표 기록:** `build()` 끝에서 아래를 장면 속성으로 기록한다(Blender 좌표).

```python
def _densify(pts, step=2.0):
    out = []
    for a, b in zip(pts, pts[1:]):
        a, b = Vector(a), Vector(b)
        n = max(1, int((b - a).length / step))
        out.extend(tuple(a.lerp(b, k / n)) for k in range(n))
    out.append(tuple(pts[-1]))
    return out


def _catmull_closed(pts, step=2.0):
    """닫힌 균일 Catmull-Rom(장력 0.5 — three 'catmullrom' 0.5 와 같은 식)을 step m 꺾은선으로 편다."""
    P = [Vector(p) for p in pts]; n = len(P); out = []
    for i in range(n):
        p0, p1, p2, p3 = P[(i - 1) % n], P[i], P[(i + 1) % n], P[(i + 2) % n]
        seg = max(1, int((p2 - p1).length / step))
        for k in range(seg):
            t = k / seg; t2 = t * t; t3 = t2 * t
            v = 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
            out.append(tuple(v))
    return out


def _rounded(corners, r=6.0, step=1.5):
    """닫힌 직각 고리의 모서리를 반지름 r 원호로 편 꺾은선(§4.4 pod_l)."""
    out = []
    n = len(corners)
    for i in range(n):
        a, c, b = Vector(corners[i - 1]), Vector(corners[i]), Vector(corners[(i + 1) % n])
        u = (a - c).normalized(); v = (b - c).normalized()
        p0, p1 = c + u * r, c + v * r
        k = max(2, int(math.pi / 2 * r / step))
        for j in range(k + 1):                      # 2차 베지어로 1/4 원 근사(모서리 점 c 가 제어점)
            t = j / k
            out.append(tuple((1 - t) ** 2 * p0 + 2 * (1 - t) * t * c + t * t * p1))
    return out


def _closed_dense(pts, step=2.0):
    """닫힌 꺾은선을 촘촘하게(마지막 → 처음 구간 포함). 끝에 처음 점을 다시 넣지 않는다(web buildTrack 이 닫는다)."""
    return _densify(list(pts) + [pts[0]], step)[:-1]


def mover_table(gz):
    """이동체 표(§4.4, Blender 좌표). export.py 가 three 좌표로 바꿔 layout.movers 로 낸다. gz = 이 파일의 GroundZ()."""
    import present
    gzp = lambda pts: [(x, y, gz.z(x, y, default=-0.05)) for x, y, *_ in pts]
    rows = []
    for i, did in enumerate(DRONE_PATHS):
        rows.append(dict(id=did, kind='drone', object='FU_drone_sec' if did == 'sec' else f'FU_drone_{did}', mode='loop',
                         speed=DRONE_SPEED[did], phase=round(0.27 * i, 3), bob=0.28, yawOffset=round(math.pi / 2, 6),
                         beam='FU_drone_sec_beam' if did == 'sec' else None, path=_catmull_closed(DRONE_PATHS[did])))
    east = gzp(_densify([(-260.0, -46.875), (420.0, -46.875)]))
    west = gzp(_densify([(420.0, -40.375), (-260.0, -40.375)]))
    loop = gzp(_closed_dense(_rounded([(-106.5, 144.5), (-106.5, -43.625), (70.0, -43.625), (70.0, 144.5)])))
    rows += [dict(id='pod_e1', kind='pod', object='FU_taxi.0', mode='wrap', speed=10.0, phase=0.0, path=east),
             dict(id='pod_e2', kind='pod', object='FU_taxi.1', mode='wrap', speed=8.5, phase=0.5, path=east),
             dict(id='pod_w1', kind='pod', object='FU_taxi.2', mode='wrap', speed=9.5, phase=0.0, path=west),
             dict(id='pod_l1', kind='pod', object='FU_taxi.3', mode='loop', speed=8.0, phase=0.0, path=loop),
             dict(id='pod_l2', kind='pod', object='FU_taxi.4', mode='loop', speed=8.0, phase=0.5, path=loop)]
    rows += [dict(id='train_a', kind='train', object='FU_train_a', mode='pingpong', speed=16.0, phase=0.0,
                  path=_densify([(-700.0, 152.6, 9.3), (700.0, 152.6, 9.3)], 10.0)),
             dict(id='train_b', kind='train', object='FU_train_b', mode='pingpong', speed=14.0, phase=0.5,
                  path=_densify([(700.0, 157.4, 9.3), (-700.0, 157.4, 9.3)], 10.0))]
    rows += [dict(id='bot0', kind='bot', object='FU_bot.0', mode='pingpong', speed=1.4, flipYaw=True,
                  path=gzp(_densify([(-95.0, -32.2), (60.0, -32.2)]))),
             dict(id='bot1', kind='bot', object='FU_bot.1', mode='pingpong', speed=1.5, flipYaw=True,
                  path=gzp(_densify([(74.2, -28.0), (74.2, 132.0)]))),
             dict(id='bot2', kind='bot', object='FU_bot.2', mode='loop', speed=1.2,
                  path=gzp(_closed_dense(present.PARK_PATH)))]
    rows += [dict(id=f'turbine_{k}', kind='spin', object=f'FU_turbine_rotor.{k}', rpm=18.0) for k in range(5)]
    return rows
```

  - `build()` 끝에서 `sc['nw_movers'] = json.dumps(mover_table(GroundZ()))`를 실행한다. `GroundZ`는 future.py:108의 클래스다.
  - `_rounded`의 꼭짓점 순서는 반시계(서쪽 이면도로 남행 → 뚝섬로 동행 → 골목 북행 → 고가 하부 서행)다. 첫 꼭짓점 앞뒤 순서가 실제 진행 방향과 맞는지 `look`에서 포드 방향으로 확인한다. 반대면 리스트를 뒤집는다.
  - **이동체 초기 자리:** 이동체 객체의 Blender 위치를 각 경로 시작점에 둔다. 웹이 첫 프레임 전에 덮어쓰지만 Blender 렌더에서도 길 위에 있게 한다.

- [ ] **Step 5: `layout.movers`를 내보낸다(`export.py`).** `export_layout`의 `drones` 블록을 지우고 아래로 바꾼다. `'drones': drones`는 `'movers': movers`가 된다.

```python
    movers = json.loads(sc.get('nw_movers', '[]'))
    for m in movers:
        if 'path' in m:
            m['path'] = [to_three(p) for p in m['path']]
        if m.get('beam') is None:
            m.pop('beam', None)
```

출력 줄의 `drones` 개수 표시도 `movers`로 바꾼다.

- [ ] **Step 6: 웹을 연결한다.**

`world.js` 맨 위에 `import { buildTrack, moverPose, spinAngle } from './movers.js';`를 넣는다. `// 6) 드론 객체 연결` 블록 전체를 아래로 바꾼다. 빔 피벗 처리는 기존 코드를 그대로 옮긴다.

```js
  // 6) 경로 이동체(드론 · 포드 · 열차 · 배송로봇 · 풍력 회전자) — layout.movers(Blender future.py MOVERS 표)
  const futureRoot = layerGroups.future;
  const moverActors = [];
  for (const def of layout.movers || []) {
    const obj = futureRoot?.getObjectByName(def.object);
    if (!obj) {
      console.warn(`[nowhere] 이동체 ${def.id}: ${def.object} 없음`);
      continue;
    }
    if (def.kind === 'spin') {
      moverActors.push({ def, object: obj, base: obj.quaternion.clone() });
      continue;
    }
    let beam = def.beam ? futureRoot.getObjectByName(def.beam) : null;
    if (beam) beam = pivotBeam(beam, def.path[0], futureRoot);
    moverActors.push({ def, object: obj, beam, track: buildTrack(def.path, def.mode === 'loop') });
  }
```

`pivotBeam(beam, apex, root) → THREE.Group`은 지금 드론 블록의 빔 처리(world.js:416-440)를 그대로 옮긴 모듈 함수다.
- 하는 일: `apexWorld = new THREE.Vector3().fromArray(apex)`부터 `pivot.attach(beam)`까지 수행하고 `pivot`을 돌려준다.
- `apex`는 드론 경로의 첫 점이다. Catmull-Rom은 제어점을 지나므로 `_catmull_closed`의 첫 점도 Blender의 드론 위치와 같다.

`world.js`에 갱신 함수를 export한다.

```js
const _qSpin = new THREE.Quaternion();
const _xAxis = new THREE.Vector3(1, 0, 0);
/** 매 프레임: 경로 위 위치 · 방향, 회전자 각도, 드론 서치라이트. */
export function updateMoverActors(actors, elapsed) {
  for (const a of actors) {
    if (a.def.kind === 'spin') {
      a.object.quaternion.copy(a.base).multiply(_qSpin.setFromAxisAngle(_xAxis, spinAngle(a.def, elapsed)));
      continue;
    }
    const p = moverPose(a.def, a.track, elapsed);
    a.object.position.set(p.pos[0], p.pos[1], p.pos[2]);
    a.object.rotation.set(0, p.yaw, 0);
    if (a.beam) {
      // 지난 코드의 object.rotation.y(lookAt, +Z 앞) = 드론 yawOffset π/2 로 계산한 p.yaw — 같은 흔들림을 더한다
      a.beam.position.copy(a.object.position);
      a.beam.rotation.y = p.yaw + Math.sin(elapsed * 1.1) * 0.22;
    }
  }
}
```

  - 화면에서 서치라이트가 진행 방향 앞아래를 비추는지 확인한다.
  - 반환 객체의 `droneActors`를 `moverActors`로 바꾼다.
  - 보행 장애물 `pick`의 `/^FU_drone/`를 `/^FU_(drone|taxi|train|bot|turbine_rotor)/`로 바꾼다.

`camera.js`의 `updateDroneActors`와 그 전용 변수(`_dronePos`·`_droneNext`·`_droneLook`)를 지운다. `main.js`는 import를 바꾸고 `updateDroneActors(world.droneActors, elapsed)`를 `updateMoverActors(world.moverActors, elapsed)`로 바꾼다. `rg -n "droneActors|updateDroneActors" public tests`가 0줄이어야 한다.

- [ ] **Step 7: 빌드하고 확인한다.**
  - `--rebuild --no-bake` → optimize → `npm test`를 실행한다(movers (a)–(e), clearance (d) 전부 PASS).
    - (d)가 실패하면 메시지에 나온 경로를 §4.4에서 옮기고 문서 표도 고친다.
  - playwriter로 아래를 확인한다(`t11-*`).
    - `?cam=street`에서 10초 간격 2장: 포드가 차로를 따라 달리고, 열차가 오가고, 드론이 소포를 달고 난다.
    - `?cam=future`: d5가 골목 위를 지나고, 회전자가 돈다.
    - 콘솔에 `이동체 … 없음` 경고가 0이다.
  - 보행 모드에서 포드나 로봇에 막히지 않는지 확인한다(통과).

- [ ] **Step 8: CP2를 준비하고 사용자에게 보인다(컨트롤러).**
  - 전체 굽기 빌드 → optimize → test를 실행한다.
  - `street`·`future`·`aerial`(맑음 14:00)과 `night`·`future`(21:30)를 캡처한다. 움직임은 2장씩 남긴다.
  - 성능 표를 만들고 CP1 비교 페이지를 갱신한다.
  - D4(보행자)를 묻는다.

- [ ] **Step 9: 커밋(또는 스테이징 + 메시지 제시)** — `feat(nowhere): 성수 이동체(포드 · 튜브 열차 · 배송로봇 · 소포 드론 · 풍력) — layout.movers`

### Task 12: 밤 조율, 문서, 성능 검증, 최종 리뷰

**Files:**
- Modify: `tools/nowhere/blender/future.py`(발광 세기만), `README.md`, `public/src/nowhere/help.js`, `docs/nowhere/credits.md`(새 Poly Haven 소재가 있으면)
- Modify: `docs/superpowers/plans/2026-10-30-nowhere-seongsu-2041.md`(§2.1 머리에 "성수 월드는 2026-11-10 계획으로 대체" 한 줄)

- [ ] **Step 1: 밤을 조율한다.**
  - `?cam=night&time=21.5`, `?cam=future&time=21.5`, `?cam=aerial&time=21.5`를 본다.
  - 조율 대상: 타워 창, 튜브 등줄기, 열차 창, 노면 발광선, 스카이브리지 소핏.
  - 목표:
    - 길과 튜브가 청록·흰 선으로 읽힌다.
    - 하늘보다 타워 창이 밝지 않다.
    - 블룸이 번지지 않는다.
  - 바꾼 `night` 값을 표로 남긴다.
  - 비와 눈에서도 한 번씩 보고 깨지는 곳이 없는지 확인한다. 튜브 유리에 눈이 쌓여 보이면 `NWF_tube_glass`에 눈 덮임을 끈다(`uSnow` 영향 제외).

- [ ] **Step 2: 성능을 검증한다.**
  - `npm test`의 전송 예산을 확인한다.
  - `?stats=1`로 아래 표를 채운다(데스크톱 1440p, `&tier=mobile` 390 × 844).
    - 시점: `street`·`future`·`aerial`·`night`
    - 수치: FPS·그리기·삼각형·텍스처 MB
  - 예산을 넘는 항목이 있으면 아래 순서로 줄인다.
    1. 담쟁이 칸 1.0 → 1.5 m
    2. 태양광 줄 → 평면 한 장
    3. 화분형 가로수 수 줄이기
    4. 타워 세부(난간·화단)
  - 줄인 뒤 다시 잰다.

- [ ] **Step 3: 문서를 고친다.**
  - README 성수 절: 2041 방향(복원 + 녹화 + 새 층), 기상 네 가지, 2041 골목 시점, 이동체.
  - help.js 문구.
  - credits(새 소재가 있으면).
  - 원 계획 §2.1의 대체 표시.

- [ ] **Step 4: 최종 리뷰를 받는다(`opus`).** 브랜치 전체 diff를 아래 항목으로 대조한다.
  - 전역 제약(DS2 불변, 상표 0, 예산)
  - 레퍼런스 대응표(§2)의 각 행이 화면에 있는지(CP2 사진 근거)
  - 테스트가 실제를 검사하는지

  지적 사항은 한 번의 수정 묶음으로 처리한다.

- [ ] **Step 5: 커밋(또는 스테이징 + 메시지 제시)** — `docs(nowhere): 성수 2041 미래 모습 — 밤 조율 · 성능 표 · 문서`

---

## 10. 위험과 대응

| 위험 | 대응 |
|---|---|
| 또 "마음에 안 드는" 방향 | CP1을 구조물 추가 전에 둔다. 빛·청소·녹화·스카이라인·타워만으로 레퍼런스 쪽인지 먼저 확인한다 |
| 해 그림자 비용 | 데스크톱만. Task 2 게이트(55 FPS)에 단계별 후퇴안이 있다. 모바일은 영향이 없다 |
| 셰이더 패치 재질이 그림자를 받지 않음 | Task 2 Step 5에서 확인하고 `surface.js` 청크 교체를 고친다 |
| 큰 투명 튜브의 정렬 오류 | 유리를 별도 객체로, `depthWrite=false`, 정적 병합에서 제외, 그림자 제외 |
| gltf-transform 인스턴싱이 이동체 이름을 지움 | 이동체는 단일 사용자 메시(`me.copy()`). movers 테스트 (e)가 데스크톱·모바일 GLB 노드 이름을 검사한다 |
| 모바일 삼각형 0.9 M 한도 | 철거(전주·전선·물탱크·실외기·잡석)로 먼저 줄이고, Task 12 Step 2의 축소 순서를 쓴다 |
| 새 구조물이 카메라 경로를 막음 | `layout.solids` + clearance 테스트가 인트로·비행 4경로·이동체를 매번 검사한다 |
| 담쟁이 알파 카드가 창을 덮거나 검게 보임 | `holes`로 창 칸을 비운다. MASK 알파 유지를 Task 5 Step 1에서 확인한다 |
| 전체 재구축이 느림 | `--no-bake` 빠른 빌드로 반복하고, 굽기는 CP1·CP2·마지막에만 한다 |
| iPad 등급 오판(iPadOS가 데스크톱 UA) | 이 계획 범위 밖이다. 지난 진단의 등급 판정 수정은 따로 승인받아 진행한다. 데스크톱 등급으로 잡히면 해 그림자가 켜지므로, 그 수정 전에는 iPad에서 `?tier=mobile`로 확인한다 |

## 11. 범위 밖

- 보행자(D4, CP2 뒤 결정).
- iPad 등급 판정과 모바일 텍스처 1024 → 512 축소(별도 승인 대기).
- DS2 월드 변경.
- 실내(HAUS 내부) 변경.
- 날씨·시간 UI 재디자인(버튼 하나 추가만).
