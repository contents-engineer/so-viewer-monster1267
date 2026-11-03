# HAUS NOWHERE — 성수 2041 월드 뷰어 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 프로젝트의 건물 에셋 두 개(HAUS NOWHERE SEOUL, FaceArch)만 가져와, 리서치와 CC0 소재로 Blender에서 새로 지은 "근미래 성수" 세계에 세우고, 그 세계를 Three.js·셰이더로 둘러보는 새 웹 뷰어를 만든다.

**Architecture:** 영상(「Ancient Ruins: Gemini 4 Argon」)의 흐름을 그대로 따른다. ① 리서치·레퍼런스·소재 수급 → ② Blender MCP로 3D 기하(지면·거리·주변 건물·소품·원경)와 재질을 만들고 `look`으로 비평·수정 → ③ 마스크·AO를 굽고 GLB로 내보내 최적화 → ④ 새 정적 페이지가 GLB를 불러 셰이더(젖음·이끼·높이 안개·비·그레이딩)와 분석 UI로 보여 준다. Blender 작업은 스크립트(`tools/nowhere/blender/*.py`)로 남겨 헤드리스로 다시 만들 수 있게 한다.

**Tech Stack:** Blender 5.3 (MCP + 헤드리스 Python), Poly Haven CC0(텍스처·HDRI·모델), glTF 2.0 + meshopt + WebP(`@gltf-transform/cli@4.1.1`), three.js r170(정적 vendor, import map), Node 22 `node:test`, playwriter(브라우저 검증).

## Global Constraints

- 프로젝트에서 가져오는 원본은 `public/assets/gm_building.glb`, `public/assets/facearch.glb` 두 파일과 그 기록(`public/assets/record.json`, `public/assets/facearch.json`의 사실 항목)뿐이다.
- 기존 사이트 코드를 쓰지 않는다: `public/src/` 아래 기존 파일(`atmosphere.js`, `terrain.js`, `particles.js`, `audio.js`, `perf.js`, `main.js`, `city.js`, `pavilion.js`, `style.css` 등)을 import·link 하지 않는다. 새 코드는 `public/src/nowhere/`에만 둔다.
- 기존 페이지(`index.html`, `facearch.html`, `city.html`, `pavilion.html`)와 그 자산은 수정하지 않는다.
- 외부 소재는 CC0(Poly Haven)만 출하한다. 게임 스크린샷·컨셉아트는 내부 레퍼런스로만 쓰고(프로젝트 밖 scratchpad에 보관) 출하물·문서에 이미지로 넣지 않는다. 게임 고유 명칭·로고·문구(BRIDGES, CyberLife, RK800 등)와 캐릭터·차량 디자인을 모델·텍스처·UI 문구에 쓰지 않는다.
- 빌드 단계 없는 정적 사이트를 유지한다(`npm start` = `serve public`). three.js는 r170 그대로 쓰고, 추가 애드온은 `three@0.170.0/examples/jsm`의 같은 상대 경로로 `public/vendor/three/jsm/`에 넣는다.
- 새 페이지: `public/nowhere.html`. 새 자산: `public/assets/nowhere/`. 소재 원본(배포 안 함): `build/nowhere-src/`. Blender 원본: `build/nowhere/nowhere.blend`.
- 좌표: Blender Z-up 미터, glTF/three Y-up 미터. HAUS NOWHERE 원점 = 세계 원점. 변환 (x, y, z)_blender → (x, z, −y)_three.
- 예산(첫 로드 기준): 데스크톱 전송 ≤ 40 MB(두 건물 5.9 MB 포함), 모바일 ≤ 22 MB · draw call 데스크톱 ≤ 300, 모바일 ≤ 180 · 삼각형 데스크톱 ≤ 2.0 M, 모바일 ≤ 0.9 M · 프레임 데스크톱(Apple M 계열, 1440p) ≥ 55 FPS, 모바일(iPhone 13 급) ≥ 30 FPS.
- 텍스처: WebP. 타일링 재질 1024 px(모바일 512), 마스크 2048 px 이하. HDRI는 1k `.hdr` 한 장(PMREM 조명용, 하늘로 보이지 않게).
- UI 문구는 한국어. 사실(기록)과 허구(세계관 서사)를 구분해 표시한다.
- 서브에이전트 모델: Claude 5.5 이상만(Blender 제작·최종 리뷰 `opus`, 웹 구현·리뷰 `sonnet`).
- 이 디렉터리는 git 저장소가 아니다. 커밋하지 않는다(태스크 경계는 scratchpad 스냅샷으로 diff).

---

## 1. 무엇을 만드나

비가 잦아진 2041년의 성수동 한 블록입니다. 붉은 벽돌 창고, 2호선 고가, 얽힌 전선, 회색 보도블록은 지금 그대로 남아 있습니다. 그 위에 몇 가지 새 장치가 덧대어졌고, HAUS NOWHERE SEOUL과 FaceArch는 이 블록에 새로 얹힌 층입니다. 질감과 빛은 데스 스트랜딩을 목표로 합니다. 흐린 확산광, 젖은 표면과 웅덩이, 틈마다 낀 이끼, 겹겹의 안개와 능선이 그 요소입니다.

| 영상(Chaco Canyon)의 단계 | 이 프로젝트에서 |
|---|---|
| 자료 폴더(LiDAR·고문서 사진·문헌) | 리서치 3편(데스 스트랜딩·DBH·성수동) + 레퍼런스 보드 36장(내부용) + Poly Haven CC0 소재 |
| Blender MCP로 원시 스캔을 정돈된 3D 기하로 | Blender MCP로 지면·거리·창고·고가·소품·원경을 모델링하고 재질·마스크를 입혀 `look`으로 비평·수정 |
| 렌더·GLB 내보내기 | 마스크·AO 굽기 → GLB 4개 + layout.json + 히어로 렌더 |
| Three.js + 셰이더 단일 페이지(타이틀, 점군, 툴팁, 스포트라이트, 기록 패널, 태양 다이얼) | 새 페이지 `nowhere.html`: 시네마틱 인트로, 젖음·이끼·안개·비 셰이더, 날씨·시간 프리셋, DBH식 분석 모드(스캔 → 윤곽 → 라벨 → 기록 카드) |

## 2. 세계관과 아트 디렉션

리서치 원문: `docs/nowhere/research/ds.md`, `dbh.md`, `seongsu.md`. 레퍼런스 이미지(36장, 저작권물)는 프로젝트 밖에 두고, 출처 URL만 `docs/nowhere/research/*-image-sources.md`에 남긴다.

### 2.1 세계 규칙 — DBH에서

- **예측이지 공상이 아니다.** "2041년은 내일"이다. 하늘을 나는 차, 외계 기술, 도시를 뒤덮은 홀로그램은 넣지 않는다.
- **철거가 아니라 덧댐이다.** 옛 간판·가로등 기둥·벽돌 외벽은 그대로 두고 새 장치를 겹쳐 단다. 벽돌 위에는 비계로 LED 스크린을 걸고, 옛 기둥에는 새 헤드를 달고, 케이블 트레이를 덧댄다.
- **비율:** 화면 기준으로 현재 85~90 %, 근미래 10~15 %. 한 프레임에 보이는 근미래 요소는 2~3종으로 제한한다.
- **근미래 모티프(반복해서 쓰는 6가지):**
  1. 2호선 고가 하부를 따라가는 파란 LED 선(`#3E8AD0`)
  2. 벽돌 창고 위 비계 LED 스크린
  3. 가장자리가 발광하는 횡단보도와 노면 LED 가이드(`#43ABA7`)
  4. 스마트 정류장 키오스크
  5. 창이 상태 스크린인 둥근 자율 택시
  6. 보안 드론(서치라이트 원뿔)과 배송 드론

  보조로 쓰는 요소는 헤드만 교체한 가로등·신호등, EV 충전 기둥, 투명 쇼윈도 디스플레이다. 홀로그램 광고는 한 곳에만 둔다.
- **현재의 앵커:** 네온 채널 레터 간판(한글, 우리가 지은 가게 이름), 실외기, 셔터, 공중전화, 덮개 씌운 차, 전신주와 처진 전선.
- **금지:** 게임 고유 명칭·로고·문구. 안드로이드 식별 표식(삼각형·암밴드·관자놀이 LED) 조합. 삼각형 보안 드론과 하트형 신호등 같은 게임 고유 형태. 실존 브랜드 로고(Gentle Monster·HAUS NOWHERE 표기는 기록 사실로만 쓴다).

### 2.2 품질 — 데스 스트랜딩에서(리서치 §6 시그니처 15개 중 채택)

| # | 시그니처 | 어디서 구현 |
|---|---|---|
| 1 | 흰빛에 가까운 흐린 하늘과 그림자 없는 확산광 | 하늘 셰이더 + HDRI 조명 + 구운 AO |
| 2 | 3~4겹의 공기 원근(원경일수록 밝고 푸르고 평평) | 원경 능선 3~4겹(Blender) + 높이 지수 안개(웹) |
| 3 | 근경은 어둡고 원경은 밝은 명암 구조, 눌리지 않은 블랙 | GradePass(블랙 리프트 5~8 %, 채도 0.7~0.8) |
| 4 | 젖은 표면과 물 광택 | 마스크 G + `uWet`, 웅덩이 roughness 0.04 |
| 5 | 이끼는 윗면·오목한 곳·물가에만 | 마스크 R(Blender에서 굽기) + 높이 블렌드 |
| 6 | 바위 3단 스케일과 군집 | 빈터 자연 포켓(Blender) |
| 7 | 근경 마이크로 디테일 | 노멀 이중 타일링(4 m + 0.5 m) |
| 11 | 타임폴(비) 무드 전환 | 프리셋 한 세트 + 빗줄기 + 파문 |
| 12 | 인공물의 접지 오염, 패널 이음, 작은 고채도 포인트 | 하단 1 m 오염·빗물 얼룩, 주황·청색은 작은 면적만 |
| 13 | 건축은 작게, 환경이 감싸는 구도 | 카메라 프리셋 규칙(건물은 화면 폭 20~40 %) |
| 14 | 절제된 그레이딩(섀도 청록·하이라이트 따뜻한 흰색·약한 그레인) | GradePass |
| 15 | 공기 중 입자 | 카메라 주변 포인트 200개 |

### 2.3 팔레트

- 월드: 중성 저채도. 흐림 하늘 `#E7E9E4`→`#C5CFCF`, 안개 `#D2D9D7`·`#9EA9AE`, 원경 `#8E9EAF`→`#CDD0D3`, 젖은 아스팔트 근경 `#273133` 근처, 이끼 `#3A461C`~`#5C652D`.
- 성수 재료(사진 샘플, 성수 리서치 §2): 붉은 벽돌 `#A86B55`(젖음·그을음 `#6C544F`, 줄눈 `#BFA392`), 노출 콘크리트 `#76777E`, 아스팔트 `#5B5958`, 골함석 `#7D8380`, 황흑 전주 보호대 `#F2C200`/`#1A1A1A`, 아파트 외벽 `#D9D3B8`.
- 발광 포인트(작은 면적): LED 파랑 `#3E8AD0`, 청록 `#43ABA7`, 네온 적 `#E33739`, 네온 청록 `#53C8D9`, 전구 `#FDD25B`. 옛 가로등은 따뜻한 흰색(2700~3000 K), 새 장치는 차가운 흰색~파랑(5000~6500 K).
- 분석 UI: 구조선 `#7F96C4`, 활성 `#6ADCFC`, 주의 `#F2B84B`, 감광 `#0F1D33`.

### 2.4 무드(날씨·시간) — 같은 블록을 다섯 가지로 다시 비춘다

흐림(기본, 낮) · 비(타임폴) · 황혼 · 밤(비 갠 뒤 젖은 노면에 네온) · 눈(DBH의 마지막처럼 모든 것을 덮음). 값은 §6.3.

## 3. 블록 배치(Blender 좌표, 미터, HAUS 원점)

실제 사이트 문법을 따른다(성수 리서치 §1·§3·§7, OSM 계산). 거리가 먼 2호선 고가만 장면 안으로 당긴다. 장면 축: +X = 뚝섬로 방향(실제 방위 109°), +Y = 실제 19°(북북동). 장면 방위 = 실제 방위 − 19°.

```
 +Y(북)
 y+150…+160 ═══ 2호선 고가(실제 ~600 m 북쪽 → 압축). 레일면 9 m, 아치 교각 + 벽돌 충전벽, 경간 22 m,
                 하부에 덧댄 파란 LED 선(근미래 모티프 1), 성수역형 녹색 승강장 지붕 한 구간 ═══
 y+135…+150      고가 하부 가로(보도·오토바이·횡단보도) — "고가 아래에서 올려다본 HAUS" 컷
 y+70…+125       붉은 벽돌 공장·창고 띠(2~4F, 30~65 m × 12~25 m 직사각 동, 같은 방향으로 줄지음)
                 + 골함석 공방 + 벽돌 개조 카페(흑색 강판 캐노피)      학교 운동장 개방부(x−57, y+115)
 y+70            이면도로 6 m(가공선 다발, 황흑 줄무늬 전주, 볼라드, 맨홀)
 y+30…+60        노후 상가주택·연립 4~5F(외부 철제 계단, 옥상 물탱크)
 y−25…+25   ┌ HAUS NOWHERE (0,0) 50×52×81 ┐  빈터(x+28…+66, y−22…+40):   │ 일방 골목 6 m(x=+70)
            └─────────────────────────────┘  철거 후 방치된 공사 부지 —    │ FaceArch (+105, +15)
 y−25…−31   전정: 흰 자갈 화단·꽃·벤치       자연 포켓(이끼·잡석·웅덩이·조경석) │ 필로티 22×18×31, 도로 쪽으로 꺾음
 y−31.5…−35.5  북측 보도 4 m(점자블록, LED 경계석, 정류장 키오스크, 코브라헤드 가로등)
 y−35.5…−48.5  뚝섬로 4차로(차로 3.25 m, 중심선 y−42), 횡단보도 x≈−14(가장자리 발광), 신호기둥
 y−48.5…−56   남측 보도 + 은행나무 가로수 띠
 y−70…−150    12~13F 아파트 판상 3동(x−60…+40, 높이 33~40 m, 크림·회백)   9F 복합(x+85…+155, y−70…−20)
 y−300 이하   (원경) 강변북로 고가·한강 — 실루엣만
 x: −105(서쪽 이면도로) ─────── 0 ─────── +70(동쪽 골목) ─── +155
```

- **장면 범위**: 근경·중경 약 x −110…+160, y −160…+170(약 270 × 330 m). 그 밖은 원경 링이다.
- **원경 링(Task 4)**: 3겹. 장면 방위·거리 기준(성수 리서치 §4).
  - 1겹: 타워군 1~3 km. 자양동 강변 타워 70~77°, 서울숲 타워 252~281°, 청담 업무타워 157~161°.
  - 2겹: 3~5 km. 롯데월드타워 107°(555 m, 지평선 최대 랜드마크), 청량리 고층 323~328°.
  - 3겹: 능선 7~18 km. 남산과 N서울타워 265°, 아차산·용마산 23~32°, 북한산 313°, 관악산 200°.
  - 실루엣만 만들고 상표나 간판은 넣지 않는다. 겹마다 대기 원근을 `#8E9EAF`→`#CDD0D3` 쪽으로 준다.
- **룩뎁과의 차이**: 룩뎁(`build/nowhere/lookdev/`, 렌더 `ld-06-full.png`, `ld-07-full.png`)은 고가를 정면 차도 위에 두고 길 건너에 벽돌 창고를 세웠다. 이 배치는 렌더 파이프라인을 검증하는 용도였다. 최종 배치는 위 표를 따른다.
  - 정면은 뚝섬로와 그 건너 아파트다.
  - 벽돌 띠는 뒤편이다.
  - 고가는 북쪽이다.
- **두 건물**: 위치·회전은 `BLD_haus`, `BLD_facearch` 빈 객체로 정한다.
  - HAUS는 장축을 도로와 같은 방향(+X)으로 둔다.
  - FaceArch는 동쪽 골목 건너 필로티 대지에 둔다. 리서치의 제안이라 근거는 약하므로 Task 2의 첫 `look`에서 확정한다.
- **치수 출처**: 길 폭, 고가 높이, 창고 높이는 리서치 추정치다. 실측 근거가 약하므로 `look`으로 비례를 확인하며 조정한다.

## 4. 소재 수급 — Poly Haven CC0

Blender MCP의 에셋 라이브러리 토글(Poly Haven·Sketchfab·Poly Pizza)은 이 환경에서 꺼져 있다. 그래서 Poly Haven 공개 API(`api.polyhaven.com`)로 직접 받는다. 재현성과 출처 기록 면에서도 이 방식이 낫다. 룩뎁(2026-10-30)에서 내려받기, md5 검증, Blender 재질 연결까지 확인했다.

| 용도 | id (해상도) | 비고 |
|---|---|---|
| 차도 | `clean_asphalt` (2k), `road_damaged` (2k) | 회색 아스팔트 + 보수 패치 |
| 보도 | `concrete_tiles_02` (2k), `concrete_pavers_02` (2k) | 서울 회색 보도블록 |
| 경계석·콘크리트 | `concrete_slab_wall_02` (2k), `concrete_floor_worn_001` (2k) | 경계석, 고가 교각 |
| 붉은 벽돌 | `brick_wall_001` (2k), `church_bricks_02` (2k), `brick_moss_001` (2k) | 성수 창고 외벽, 이끼 낀 하단 |
| 이끼·흙 | `concrete_moss` (2k), `mossy_cobblestone` (2k), `coast_sand_rocks_02` (2k) | 빈터, 틈 |
| 현무암·바위 | `dark_rock` (2k), `lichen_rock` (2k), `dark_rock_02` (2k) | 데스 스트랜딩 포켓 |
| 금속 | `painted_metal_shutter` (1k), `corrugated_iron_03` (1k) | 셔터, 창고 지붕 |
| HDRI(조명만) | `urban_street_03` (1k·2k), 밤용 `modern_buildings_night` (1k) | 하늘은 셰이더로 그린다 |
| 모델 — 거리 | `modular_factory_facade`, `modular_fire_escape`, `exterior_aircon_unit`, `utility_box_01`, `utility_box_02`, `korean_public_payphone_01`, `korean_fire_extinguisher_01`, `water_manhole_cover`, `security_camera_01`, `rollershutter_door`, `rollershutter_window_01`, `metal_trash_can`, `covered_car`, `concrete_road_barrier`, `modular_metal_gutter` (모두 1k) | `hidden_alley` 컬렉션 중심 |
| 모델 — 자연 | `rock_moss_set_01`, `rock_moss_set_02`, `boulder_01`, `rock_face_01`, `moss_01`, `grass_medium_01`, `shrub_02` (1k) | 바위 3단 스케일의 대·중형 |
| 제외 | `tree_small_02`(1k 96 MB), `modular_urban_apartments_facade`(15 MB, 175k tri급) | 나무는 Blender에서 저폴리 카드 나무로 만든다 |

- 큰 모듈 키트(`modular_factory_facade` 175k tri, `modular_electricity_poles` 200k tri)는 부품을 골라 쓰고 Decimate로 줄인다. 전신주·전선은 Blender에서 직접 만든다(곡선 처짐 전선).
- 웹에는 텍스처 원본이 아니라 GLB 안의 WebP(1024/512)만 나간다.
- 출처는 `tools/nowhere/sources.json`(목록) → `build/nowhere-src/manifest.jsonl`(받은 파일·md5) → `docs/nowhere/credits.md`(출하 목록) 순으로 남는다.

## 5. Blender ↔ 웹 규약

Blender에서 정한 것이 웹에서 그대로 쓰이도록 이름과 속성으로 약속한다.

| 항목 | 규약 |
|---|---|
| 레이어(컬렉션 → GLB) | `NW_ground` → `nowhere-ground.glb`, `NW_present` → `nowhere-present.glb`, `NW_future` → `nowhere-future.glb`, `NW_backdrop` → `nowhere-backdrop.glb` |
| 표면 종류 | 객체 사용자 속성 `nw_surface` ∈ `ground`, `wall`, `rock`, `metal`, `glass`, `water`, `emissive`, `holo`, `foliage` → glTF `extras`로 나가고 웹 셰이더 선택에 쓴다 |
| 마스크 | 정점색 `COLOR_0` = (R 이끼, G 젖음, B AO). 넓은 지면은 정점 해상도가 모자라므로 `NW_ground` 객체만 두 번째 UV(`UVMap_mask`)에 2048 px 마스크 텍스처(`nowhere-ground-mask.webp`, 같은 RGB 의미 + A 웅덩이)를 굽는다 |
| 반복 소품 | 링크 복제(같은 mesh)로 배치 → glTF exporter `GPU Instances` 옵션으로 `EXT_mesh_gpu_instancing` |
| 레이아웃 | 빈 객체 `CAM_<id>`(카메라 위치·시선·화각), `ANCHOR_<id>`(분석 표식 위치), `BLD_haus`·`BLD_facearch`(두 건물 배치) → `export.py`가 `public/assets/nowhere/layout.json`으로 쓴다 |
| 두 건물 | GLB 안에 넣지 않는다. 웹이 원본 GLB 두 개를 따로 불러 `layout.json`의 위치·회전으로 놓는다(원본 수정 없음) |
| 발광 | `nw_surface=emissive` 의 emissive 세기는 웹이 날씨·밤 프리셋으로 곱한다. `holo` 는 웹 전용 셰이더(스캔선·깜빡임)로 대체 |

## 6. 웹 뷰어 기술 설계

### 6.1 모듈

| 파일 | 책임 |
|---|---|
| `public/nowhere.html` | 캔버스, 인트로, 분석 패널, 컨트롤. import map(three, addons) |
| `src/nowhere/main.js` | 부팅, 로딩 진행률, 렌더 루프, 모듈 연결 |
| `src/nowhere/quality.js` | 기기 등급(`desktop`/`mobile`) → 자산 경로(1024/512), 비 입자 수, 블룸 on/off, pixel ratio 상한 |
| `src/nowhere/world.js` | GLB 4개 + 건물 2개 + `layout.json` 로드, `nw_surface`별 재질 패치 적용, 건물 배치 |
| `src/nowhere/surface.js` | `MeshStandardMaterial.onBeforeCompile` 패치: 젖음·웅덩이·이끼(마스크), 빗물 파문, 높이 안개, 분석 스캔선. 공유 uniform 한 벌 |
| `src/nowhere/fog.js` | 높이 지수 안개 GLSL 조각 + 같은 식의 JS 함수(테스트용) |
| `src/nowhere/sky.js` | 하늘 돔 셰이더(지평선→천정 그라데이션 + 저주파 구름 + 프리셋 색) |
| `src/nowhere/weather.js` | 무드 프리셋 5종(흐림·비·황혼·밤·눈)과 보간 상태 — 순수 함수 |
| `src/nowhere/rain.js` | 카메라를 따라다니는 인스턴스 빗줄기(속도 방향으로 늘린 quad), 안개 적용 |
| `src/nowhere/post.js` | `EffectComposer`: RenderPass → UnrealBloomPass(발광만, 높은 threshold) → GradePass(블랙 리프트·채도·섀도/하이라이트 틴트·그레인·비네팅) → OutputPass(AgX) |
| `src/nowhere/camera.js` | OrbitControls, `layout.json` 카메라 프리셋, 인트로 경로(CatmullRom), 보행 시점 |
| `src/nowhere/analysis.js` | 분석 모드: 감광 → 스캔 펄스 → 윤곽 draw-on(화면 고정 두께 `LineSegments2`) → 앵커 라벨 → 기록 카드, 레이어 필터 |
| `src/nowhere/nowhere.css` | 새 UI 스타일(기존 `style.css` 미사용) |

### 6.2 표면 셰이더 핵심(onBeforeCompile)

```glsl
// fragment, <roughnessmap_fragment> 뒤
vec4 m = nwMask();                       // ground: 마스크 텍스처(uv1), 나머지: 정점색 nwMask
float wet  = clamp(uWet * (m.g + 0.35 * (1.0 - m.b)) , 0.0, 1.0);
float pud  = smoothstep(0.55, 0.62, m.a) * uWet;            // 웅덩이(지면만)
diffuseColor.rgb *= mix(1.0, 0.45, wet);                      // 젖으면 어둡게
diffuseColor.rgb  = mix(diffuseColor.rgb, uMossColor * (0.7 + 0.6 * nwNoise(vNwWorld.xz * 0.8)),
                        step(0.55, m.r + 0.25 * nwNoise(vNwWorld.xz * 3.1)) * uMoss);
roughnessFactor   = mix(roughnessFactor, 0.18, wet);
roughnessFactor   = mix(roughnessFactor, 0.04, pud);
// normal: 웅덩이에서는 지오메트리 노멀 + 빗물 파문(uRain>0)으로 교체
```

- 정점색은 three 기본 `vertexColors`(알베도 곱)를 쓰지 않는다. 로드 직후 `color` 속성을 `nwMask`로 옮기고 셰이더에서 직접 읽는다.
- 안개는 `scene.fog` 대신 패치 안의 높이 안개를 쓴다(하늘 돔·빗줄기도 같은 함수). 식은 `docs/nowhere/research/ds.md` §6의 해석해 그대로.
- 두 건물 재질도 같은 패치를 받는다(`nw_surface` 없음 → `building`): 안개·스캔선 + 지면 1.2 m 이하 튐 젖음만.

### 6.3 무드 프리셋(`weather.js`)

| 프리셋 | uWet | uRain | uSnow | 안개 b / k | 안개색 | 하늘(지평선→천정) | exposure | 채도 | 발광 |
|---|---|---|---|---|---|---|---|---|---|
| 흐림(기본) | 0.55 | 0 | 0 | 0.0035 / 0.045 | `#D2D9D7` | `#E7E9E4` → `#C5CFCF` | 1.0 | 0.78 | 0.3 |
| 비(타임폴) | 1.0 | 1 | 0 | 0.009 / 0.035 | `#4F6A76` | `#6E838C` → `#3E4F57` | 0.75 | 0.70 | 0.6 |
| 황혼 | 0.4 | 0 | 0 | 0.004 / 0.05 | `#E9B886` | `#F1BE84` → `#8A90A0` | 0.95 | 0.95 | 0.8 |
| 밤 | 0.8 | 0.25 | 0 | 0.006 / 0.04 | `#1E2A3A` | `#2A3550` → `#0B1020` | 0.85 | 0.85 | 1.0 |
| 눈 | 0.2 | 0 | 1 | 0.007 / 0.03 | `#E2DDD3` | `#EDEAE3` → `#C9CCCD` | 1.05 | 0.65 | 0.5 |

- 색 값은 데스 스트랜딩·DBH 화면 측정치(리서치 ds §2, dbh §3)에서 왔다. 알베도가 아니라 화면 목표치이므로 Task 6·7에서 화면을 대조하며 미세 조정한다.
- 눈은 `uSnow × smoothstep(0.55, 0.85, 월드 노멀 y)`로 윗면만 덮고(노멀 흐림, roughness 0.6, 알베도 `#E8E8E4`), 빗줄기 시스템을 느린 낙하·흔들림으로 바꿔 눈송이로 쓴다.

## 7. 파일 구조

```
tools/nowhere/
  sources.json                 # 받을 Poly Haven 소재 목록
  fetch_sources.py             # sources.json → build/nowhere-src/ (+ manifest.jsonl, md5 검증)
  blender/
    lib.py                     # 공통: 경로, PBR 재질, 상자/곡선 도우미, glTF 가져오기, 마스크 쓰기
    ground.py                  # Task 2
    present.py                 # Task 3
    future.py                  # Task 4
    backdrop.py                # Task 4
    bake.py                    # Task 5: AO·마스크 굽기
    export.py                  # Task 5: GLB 4개 + layout.json + 히어로 렌더
    build.py                   # 헤드리스 진입점: 위 단계를 순서대로
docs/nowhere/
  research/{ds,dbh,seongsu}.md # 리서치(글만, 이미지 없음)
  credits.md                   # 출하 소재 CC0 목록
build/nowhere-src/             # 내려받은 원본(배포 안 함)
build/nowhere/nowhere.blend    # 작업 원본
public/nowhere.html
public/src/nowhere/*.js, nowhere.css
public/assets/nowhere/
  nowhere-{ground,present,future,backdrop}.glb (+ mobile/ 512 세트)
  nowhere-ground-mask.webp, layout.json, sky-1k.hdr
  renders/*.webp               # Blender 히어로 렌더(분석 카드·로딩 화면)
public/vendor/three/jsm/
  postprocessing/{EffectComposer,RenderPass,ShaderPass,UnrealBloomPass,OutputPass,Pass,MaskPass}.js
  shaders/{CopyShader,LuminosityHighPassShader,OutputShader}.js
  loaders/RGBELoader.js
  lines/{LineSegments2,LineSegmentsGeometry,LineMaterial}.js
tests/nowhere-*.test.mjs
```

`package.json` 스크립트: `nowhere:fetch`, `nowhere:build`(Blender 헤드리스), `nowhere:optimize`(gltf-transform), `test`.

## 8. 작업 순서와 실행 방식

- Blender 태스크(2·3·4·5)는 Blender가 하나라서 **순서대로만** 실행한다. 실행자는 `opus` 서브에이전트이고, Blender MCP(`execute_blender_code`, `look`)를 직접 쓴다. 각 태스크는 `build/nowhere/nowhere.blend`를 열어 이어 작업하고 끝에 저장한다. 사용자 Blender의 다른 씬·파일은 건드리지 않는다(작업 씬 `NW_World`).
- Blender 스크립트는 MCP에서 `exec(open('tools/nowhere/blender/<file>.py').read())`로 실행한다. 헤드리스 `build.py`도 같은 파일을 부른다(같은 결과가 나와야 한다).
- 매 Blender 태스크는 지정 카메라에서 EEVEE 렌더를 `build/nowhere/renders/t<N>-<cam>.png`로 남기고, 리뷰어는 그 렌더와 체크리스트로 판정한다.
- 웹 태스크(6·7·8)는 `sonnet` 서브에이전트. 순수 로직은 `node:test`로 TDD, 화면은 playwriter로 확인(네이티브 대화상자 금지 규칙 준수).
- 태스크 사이 상태는 scratchpad 스냅샷으로 diff 한다(git 아님).

### Task 1: 소재 수급 도구, three 애드온, 리서치 문서 정리

**Files:**
- Create: `tools/nowhere/sources.json`, `tools/nowhere/fetch_sources.py`, `docs/nowhere/credits.md`, `docs/nowhere/research/{ds,dbh,seongsu}.md`(계획 단계에서 복사해 둠 — 레퍼런스 이미지 경로만 출처 URL 목록 `*-image-sources.md` 참조로 정리), `tests/nowhere-sources.test.mjs`
- Create: §7의 three 애드온 14개(`three@0.170.0/examples/jsm` 원본 그대로)
- Modify: `package.json` — `"type": "module"`, `nowhere:fetch`, `test` 스크립트

**Interfaces:**
- Produces: `build/nowhere-src/{tex,hdri,model}/…`, `build/nowhere-src/manifest.jsonl`(한 줄 = `{id, kind, res, licence:"CC0", source, files[]}`)
- `sources.json` 형식: `{"textures":[{"id","res","use"}], "hdris":[…], "models":[…]}`

- [ ] **Step 1: 실패하는 테스트** — `tests/nowhere-sources.test.mjs`: (a) `sources.json`의 id가 겹치지 않고 res ∈ {1k,2k}, (b) §4 제외 목록(`tree_small_02`, `modular_urban_apartments_facade`)이 없음, (c) 애드온 14개가 존재하고 각 파일의 상대 import 대상이 모두 존재.
- [ ] **Step 2:** `node --test tests/nowhere-sources.test.mjs` → FAIL 확인.
- [ ] **Step 3:** `sources.json`을 §4 표대로 작성. `fetch_sources.py`는 룩뎁에서 검증한 `build/nowhere/lookdev/ph_fetch.py`의 로직(UA 헤더 — 기본 Python UA는 CDN이 403, md5 검증, include 경로 탈출 검사, 알베도 키 `Diffuse`→`diff_png` 대체)을 옮기되 입력을 `sources.json`으로 받는다. 애드온은 `curl -fsSL https://unpkg.com/three@0.170.0/examples/jsm/<path> -o public/vendor/three/jsm/<path>`.
- [ ] **Step 4:** `npm run nowhere:fetch` 실행 → manifest 줄 수 = 소재 수, md5 불일치 0. 테스트 PASS.
- [ ] **Step 5:** `credits.md`(id, 작가, 링크, CC0), 리서치 3편 복사.

### Task 2: Blender — 지면과 거리 (현재의 성수 바닥)

**Files:** Create `tools/nowhere/blender/lib.py`, `tools/nowhere/blender/ground.py`, `build/nowhere/nowhere.blend`

**Interfaces:**
- Consumes: `build/nowhere-src/`, §3 배치, §5 규약
- Produces: 컬렉션 `NW_ground`, 빈 객체 `BLD_haus`(0,0,0)·`BLD_facearch`, 카메라 `CAM_street`(남측 보도에서 뚝섬로 건너 HAUS)·`CAM_aerial`·`CAM_ground`

- [ ] **Step 1:** `lib.py` — 룩뎁의 `build/nowhere/lookdev/bl_lib.py`(PBR 재질, 젖음·웅덩이 노이즈, 상자, glTF 조용히 가져오기)를 옮기고 경로를 프로젝트 기준으로 바꾼다. 마스크 쓰기 도우미 `write_mask(obj, fn)`(정점마다 R 이끼·G 젖음·B AO 계산) 추가.
- [ ] **Step 2:** `ground.py` — §3 배치대로 만든다.
  - 뚝섬로 4차로: 횡단 경사 2 %, 차로 표시와 정지선은 마모 표현, 중심선 y −42.
  - 경계석: 높이 15 cm, 모서리 챔퍼 2 cm, 실제 지오메트리. 일부에 황색 연석 표시.
  - 보도: 보도블록 + 황색 점자블록(300 mm).
  - HAUS 전정: 흰 자갈 화단, 꽃 화단, 벤치 자리.
  - 이면도로 2개(서쪽 x −105, 북쪽 y +70)와 동쪽 일방 골목(x +70).
  - 고가 하부 가로(y +135…+150).
  - 횡단보도(x ≈ −14), 맨홀·빗물받이, 가로수 구덩이.
  - 철거 후 방치된 빈터: Displace로 ±0.6 m 기복, 잡석·흙·이끼, 고인 물 2~3곳, 둘레 공사 가림막 자리.
- [ ] **Step 3:** 마스크 — 이끼는 경계석 이음·보도블록 틈·빈터 오목한 곳·물가에만, 젖음은 낮은 곳·차도 가장자리, 웅덩이는 차도 바퀴 자국 사이와 빈터 물길 주변(노이즈 + 높이). Blender 재질도 같은 마스크를 읽게 해서 렌더가 웹과 같은 의미를 갖게 한다.
- [ ] **Step 4:** 조명 기준 — 월드는 HDRI(`urban_street_03`)를 조명에만 쓰고 카메라에는 하늘 그라데이션(`#E7E9E4`→`#C5CFCF`)을 보인다. 안개는 월드 볼륨을 쓰지 않는다(EEVEE에서 하늘빛을 통째로 흡수해 검게 나온다 — 룩뎁에서 확인). 대신 높이 감쇠 밀도를 넣은 안개 상자 `FX_fog`를 쓴다.
- [ ] **Step 5:** `look` 비평 루프 — `CAM_street`(보도 1.7 m), `CAM_ground`(지면 3 m 근접), `CAM_aerial`(45° 부감)에서 렌더 → 리서치 시그니처 #4·#5·#7·#8과 대조해 고친다. 최소 3회 반복, 매회 무엇을 고쳤는지 보고서에 적는다.
- [ ] **Step 6:** 수치 기록 — `NW_ground` 삼각형 수(목표 ≤ 250k), 재질 수(≤ 8), 렌더 3장. `.blend` 저장.

**완료 기준:** 근접 컷에서 보도블록 틈의 이끼, 젖은 아스팔트의 하늘 반사, 웅덩이 경계가 읽힌다. 평면에 텍스처만 붙인 느낌이 아니다(경계석·기복·물길이 실제 형상).

### Task 3: Blender — 현재 층(성수 블록)과 자연 포켓

**Files:** Create `tools/nowhere/blender/present.py`

**Interfaces:** Consumes Task 2 씬. Produces 컬렉션 `NW_present`, 카메라 `CAM_viaduct`(고가 아래에서 공장 띠 너머 HAUS 타워), 빈 객체 `ANCHOR_*`(현재 층 표식)

- [ ] **Step 1:** 북쪽 붉은 벽돌 공장·창고 띠(§3, 성수 리서치 키트 #1·#2·#3)를 만든다.
  - 매스: 직접 모델링. 2~4층, 30~65 × 12~25 m 직사각 동을 같은 방향으로 줄 세우고 박공·평지붕을 섞는다.
  - 외벽과 부품: 외벽은 벽돌 재질, 창·셔터·문은 Poly Haven 모듈 부품. 골함석 공방과 흑색 강판 캐노피 카페 1동씩.
  - 그 앞줄: 노후 상가주택·연립(4~5F, 외부 철제 계단, 옥상 물탱크).
  - 남쪽(길 건너): 12~13F 아파트 판상 3동(인스턴스, 크림·회백 도장)과 9F 복합 1동.
  - 오염: 하단 1 m는 젖음·이끼 마스크(빗물 튐), 벽에는 세로 빗물 얼룩.
- [ ] **Step 2:** 2호선 고가(§3, y +150…+160)를 만든다.
  - 형태: 콘크리트 아치 교각에 벽돌 충전벽, 경간 22 m, 레일면 9 m, 방음벽 실루엣, 성수역형 녹색 승강장 지붕 한 구간.
  - 교각: 하단 오염과 이끼.
  - 고가 밑: 어둡고 젖은 가로(보도, 오토바이, 횡단보도).
- [ ] **Step 3:** 거리 소품 — 전신주(직접 모델링, 변압기·애자)와 처진 전선(Bezier → 메시, 3–6가닥 묶음), 가로등(한국형 단주), 실외기, 분전함, 공중전화, 소화기함, CCTV, 휴지통, 덮개 씌운 차, 공사 방호벽, 홈통·비상계단. 반복 소품은 링크 복제.
- [ ] **Step 4:** 자연 포켓(데스 스트랜딩 문법)을 철거 후 방치된 빈터에 만든다.
  - 경계: 흰·회색 공사 가림막(일부 쓰러짐)으로 두른다.
  - 바위·잡석 3단 스케일: 대형 1 : 중형 5~8 : 소형 다수. 깨진 콘크리트 덩어리, 어두운 조경석·현무암 블록(직접 모델링), `rock_moss_set_*`, `boulder_01`을 섞는다.
  - 이끼는 윗면·오목한 곳·물가에만 두고, 잡초와 마른 풀 다발을 곁들인다.
  - 남측 보도에는 저폴리 카드 나무(은행나무 가로수 6~8그루)를 심는다.
- [ ] **Step 5:** `look` 비평 — `CAM_street`, `CAM_viaduct`, `CAM_aerial`. 리서치 시그니처 #6·#12·#13과 대조. 최소 3회.
- [ ] **Step 6:** 수치 — 고유 (mesh, 재질) 조합 수(draw call 추정 ≤ 160), 삼각형 ≤ 700k(Decimate 포함). 렌더 저장, `.blend` 저장.

### Task 4: Blender — 미래 층과 원경

**Files:** Create `tools/nowhere/blender/future.py`, `tools/nowhere/blender/backdrop.py`

**Interfaces:** Produces 컬렉션 `NW_future`, `NW_backdrop`, 카메라 `CAM_night`, 빈 객체 `ANCHOR_*`(미래 층 표식)

- [ ] **Step 1:** 미래 층(§2 목록) — 모두 독자 디자인, 상표·실존 기업 문구 없음. 발광은 `nw_surface=emissive`, 홀로그램은 `holo`(웹이 셰이더로 교체).
- [ ] **Step 2:** 원경 링(§3)을 만든다.
  - 1겹 타워군(1~3 km), 2겹 롯데월드타워·청량리(3~5 km), 3겹 능선(남산과 N서울타워, 아차산·용마산, 북한산, 관악산, 7~18 km). 각 요소는 리서치의 장면 방위·고도각에 맞춘다.
  - 실루엣 메시로만 만든다. 창 발광 텍스처는 1장을 공유한다.
  - 겹마다 거리만 벌리고, 명도는 안개가 올리게 둔다.
  - 저폴리로, 합쳐서 60k tri 이하.
- [ ] **Step 3:** 히어로 컷 3장 — `CAM_street`(흐림), `CAM_aerial`(흐림), `CAM_night`(밤: 발광 on, 하늘 어둡게) EEVEE 1920×1080.
- [ ] **Step 4:** `look` 비평 — §2 비율(현재:미래:자연)이 화면에서 지켜지는지, 미래 요소가 과하지 않은지. 최소 2회.

> **확인 지점(사용자):** Task 4가 끝나면 히어로 렌더 3장을 사용자에게 보여 준다. 방향이 맞다는 답을 받고 Task 5로 넘어간다.

### Task 5: 굽기·내보내기·최적화 (헤드리스 재현)

**Files:** Create `tools/nowhere/blender/bake.py`, `tools/nowhere/blender/export.py`, `tools/nowhere/blender/build.py`, `tests/nowhere-assets.test.mjs`; Modify `package.json`(`nowhere:build`, `nowhere:optimize`)

**Interfaces:**
- Produces: `public/assets/nowhere/nowhere-{ground,present,future,backdrop}.glb`(+ `mobile/`), `nowhere-ground-mask.webp`, `layout.json`, `sky-1k.hdr`, `renders/*.webp`
- `layout.json`: `{ "buildings": {"haus": {"pos":[x,y,z], "rotY": deg}, "facearch": {…}}, "cameras": [{"id","label","pos","target","fov"}], "anchors": [{"id","layer":"building|present|future|nature","pos","title","facts":[[k,v]],"lore","source","render"}] }` (three 좌표)

- [ ] **Step 1: 실패하는 테스트** — `tests/nowhere-assets.test.mjs`: GLB 4개 + mobile 4개 존재, 데스크톱 합계(건물 포함) ≤ 40 MB·모바일 ≤ 22 MB, `layout.json` 스키마(카메라 ≥ 4, 앵커 id 유일, 앵커 render 파일 존재), GLB JSON 청크를 읽어 `extras.nw_surface` 값이 §5 목록 안에 있는지.
- [ ] **Step 2:** `bake.py` — Cycles로 AO를 정점색 B에, 지면은 `UVMap_mask`에 2048 마스크 굽기. 굽기 결과를 `look`으로 확인.
- [ ] **Step 3:** `export.py` — 컬렉션별 GLB(Y-up, GPU Instances on, 정점색 on, extras on), `layout.json`(빈 객체 → three 좌표 변환), 카메라별 렌더를 WebP로.
- [ ] **Step 4:** `nowhere:optimize` — `npx -y @gltf-transform/cli@4.1.1 optimize <in> <out> --compress meshopt --texture-compress webp --texture-size 1024`(mobile은 512, 원경은 512 고정). 크기 표 기록.
- [ ] **Step 5:** `build.py` 헤드리스 재실행(`npm run nowhere:build`)이 같은 파일을 만드는지 확인. 테스트 PASS.

### Task 6: 웹 코어 — 렌더러, 표면 셰이더, 하늘, 안개, 그레이딩

**Files:** Create `public/nowhere.html`, `public/src/nowhere/{main,quality,world,surface,fog,sky,post}.js`, `public/src/nowhere/nowhere.css`, `tests/nowhere-fog.test.mjs`, `tests/nowhere-quality.test.mjs`

**Interfaces:**
- Consumes: Task 5 산출물, §5 규약, §6 설계
- Produces: `createWorld({renderer, scene, tier}) → Promise<{layout, meshesBySurface, uniforms}>`, `uniforms` 공유 객체(`uWet, uRain, uMoss, uMossColor, uTime, uFogB, uFogK, uFogColor, uScanCenter, uScanRadius, uScanWidth`), `heightFog(cam, pos, b, k)`(JS, GLSL과 같은 식)

- [ ] **Step 1: 실패하는 테스트** — `heightFog`: 같은 높이 수평선에서 `1-exp(-b·len·exp(-k·y))`와 일치, k→0 극한에서 균일 안개와 일치, 위로 갈수록 감소. `quality`: UA·화면 크기·`deviceMemory` 조합별 등급.
- [ ] **Step 2:** 구현 — §6.1·§6.2. 기존 `public/src/*` import 금지.
- [ ] **Step 3:** playwriter — `CAM_street`·`CAM_aerial` 프리셋 화면을 캡처해 Task 4 히어로 렌더와 나란히 비교(구도·명도 구조·안개 겹). 차이를 적고 uniform을 맞춘다.
- [ ] **Step 4:** 성능 — 데스크톱 FPS·draw call·삼각형(`renderer.info`) 기록, §전역 예산 이내.

### Task 7: 날씨·시간·카메라·움직임

**Files:** Create `public/src/nowhere/{weather,rain,camera}.js`, `tests/nowhere-weather.test.mjs`; Modify `main.js`, `nowhere.html`, `nowhere.css`

- [ ] **Step 1: 실패하는 테스트** — `weather.lerp(a, b, t)`가 숫자는 선형·색은 선형 RGB로 보간, `t` 클램프, 프리셋 5개의 키 집합 동일.
- [ ] **Step 2:** 프리셋 전환(2.5 s 보간), 빗줄기(데스크톱 6000·모바일 1800 인스턴스), 웅덩이 파문, 밤 발광, 드론 3대 경로 비행·홀로그램 깜빡임.
- [ ] **Step 3:** 카메라 — 인트로(원경 능선 → 고가 아래 → 거리, 약 12 s, 아무 입력으로 건너뛰기), 프리셋 이동, 자유 궤도, 보행 시점(1.7 m, 드래그로 둘러보기).
- [ ] **Step 4:** playwriter — 프리셋 5개 캡처, 콘솔 오류 0.

### Task 8: 분석 모드 UI

**Files:** Create `public/src/nowhere/analysis.js`, `public/assets/nowhere/anchors.ko.json`(앵커 원고: 사실·서사·출처), `tests/nowhere-anchors.test.mjs`; Modify `main.js`, `nowhere.html`, `nowhere.css`

**Interfaces:**
- Consumes: `layout.json`의 `anchors[].id/pos/layer/render`, `uniforms.uScan*`
- `anchors.ko.json`: `{ "<id>": { "title", "kicker", "facts": [[k, v]], "lore", "sources": [{"label","url"}] } }` — `facts`는 기록 파일(`record.json`, `facearch.json`)·리서치·소재 출처에 있는 내용만 쓴다. `lore`는 2041년 세계관 허구이고 화면에 "서사 · 허구"로 표시한다.

설계 원칙(dbh 리서치 §7을 우리 디자인으로):
1. 분석 진입 시 세계를 청회색으로 감광한다(`#0F1D33` 알파 0.45, 채도 −30 %). UI는 파랑 계열 하나만 쓴다.
2. 색 위계: 구조선 `#7F96C4`, 활성 `#6ADCFC`, 주의 `#F2B84B`.
3. 선은 화면 고정 두께다. 격자 0.75 px, 윤곽 1 px, 리더 1.25 px, 활성 2 px.
4. 대상은 윤곽과 삼각분할 저폴리 면(알파 0.08~0.15)으로만 그리고, 솔리드 채움은 쓰지 않는다.
5. 라벨은 점 4 px, 직선·45° 리더, "이름 / 값" 두 열(11~13 px)이다. 예: `HAUS NOWHERE  높이 81 m`, `젖은 아스팔트  clean_asphalt · CC0`.
6. 타이포: 본문 IBM Plex Sans KR, 값은 JetBrains Mono tabular-nums, 태그는 자간 +0.08em.
7. 움직임: 윤곽은 draw-on 400~700 ms, 라벨은 35 ms 간격 스태거, idle 펄스는 알파 8 % 이내. 값은 바뀔 때만 250 ms count-up.
8. 레이어 필터는 세그먼트 눈금으로 둔다(전체·건물·현재·근미래·자연). 활성 항목 하나만 밝게 한다.
9. 패널은 직각 또는 2 px 라운드의 플랫이다. 글리치는 오류 상태에만 쓴다.

- [ ] **Step 1: 실패하는 테스트** — `anchors.ko.json`의 키 집합 = `layout.json` 앵커 id 집합. 모든 앵커에 title·facts ≥ 1. `layer` ∈ {building, present, future, nature}. 레이어별 개수: building 6 이상(두 건물 부위), present·future·nature 각 3 이상. sources url 형식 확인. 금지어 목록(게임 고유 명칭)이 문구에 없음.
- [ ] **Step 2:** 앵커 원고 작성 — 건물 앵커는 기록 사실만(규모, 구성, 원본, 최적화 수치). 환경 앵커는 "무엇을 왜 만들었나"를 쓴다(예: 2호선 고가 — 성수 리서치 근거, 파란 LED 선 — 근미래 모티프 1, 현무암 빈터 — 데스 스트랜딩 시그니처 #6, 소재 id와 CC0).
- [ ] **Step 3:** `analysis.js` — 진입·이탈, 스캔 펄스(`uScanCenter/Radius/Width`, 1.2 s), 윤곽(건물은 `EdgesGeometry` 각도 28° → `LineSegments2`, 첫 선택 때 한 번 만들어 캐시), 라벨 배치(화면 투영, 우선순위 기반 겹침 회피), 카드(Blender 렌더 이미지, 사실, 서사, 출처), 키보드(`A` 분석, `Esc`, `←/→`).
- [ ] **Step 4:** 모바일(≤ 720 px) — 카드는 하단 시트(최대 높이 60 vh, 스크롤 맨 위 초기화), 라벨은 우선순위 상위 6개만.
- [ ] **Step 5:** playwriter — 진입·필터·카드 열기/닫기·키보드, 데스크톱과 390 px 캡처, 콘솔 오류 0. hover 레이캐스트는 100 ms 스로틀.

### Task 9: 검증과 문서

**Files:** Modify `README.md`(새 섹션), 필요 시 수정

- [ ] **Step 1:** 최종 리뷰(`opus`) — 전체 diff + 전역 제약 대조(특히 기존 코드 import 0, 출하 소재 CC0만, 상표 문구 0).
- [ ] **Step 2:** playwriter — 데스크톱 1440×900, 모바일 390×844에서 인트로 → 프리셋 → 날씨 5종 → 분석 모드 → 카드 열기·닫기. 캡처와 콘솔 로그 저장.
- [ ] **Step 3:** 성능 표(FPS·draw call·삼각형·전송량) — 예산 대비.
- [ ] **Step 4:** README에 실행법, 파이프라인(`nowhere:fetch` → `nowhere:build` → `nowhere:optimize`), 리서치·소재 출처 링크.

## 9. 위험과 대응

| 위험 | 대응 |
|---|---|
| Blender MCP 애드온이 서버보다 구버전(protocol 13 vs 15) | 코드 실행·`look`은 동작 확인. 문제가 생기면 사용자에게 `uvx mcp-for-blender install-addon` 후 애드온 재활성화를 요청 |
| EEVEE 월드 볼륨이 하늘빛을 흡수해 검은 렌더 | 안개 상자 + 높이 감쇠 밀도(룩뎁에서 해결 확인) |
| 큰 CC0 모델의 삼각형·용량 | 부품만 골라 쓰고 Decimate, 나무는 직접 저폴리 |
| 넓은 지면의 마스크 해상도 | 지면만 2048 마스크 텍스처(UV2), 나머지는 정점색 |
| KTX2 도구(toktx) 없음 | WebP + 해상도 예산으로 GPU 메모리 관리. 필요해지면 `brew install ktx` 후 `--texture-compress ktx2`로 교체(사용자 확인 후) |
| "데스 스트랜딩처럼 보이지 않음" | 리서치 시그니처 15개를 Blender 태스크마다 체크리스트로 대조하고, Task 4 뒤 사용자 확인 지점에서 방향을 고정 |
