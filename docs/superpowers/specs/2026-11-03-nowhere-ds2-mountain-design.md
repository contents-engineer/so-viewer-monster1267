# HAUS NOWHERE — DS2 산악 월드 (`ver=ds2`) 설계 스펙

- **작성일**: 2026-11-03
- **기반 프로젝트**: HAUS NOWHERE — 성수 2041 (`public/nowhere.html`, `tools/nowhere/blender/`)
- **목표**: 기존 Blender → glTF → Three.js 파이프라인을 차용하여, 주변 성수 건물을 모두 걷어내고 데스 스트랜딩 2(Death Stranding 2: On the Beach) 스타일의 **초록 이끼와 현무암 바위가 섞인 광활한 산악 고원 지형** 한가운데에 두 영웅 건물(`HAUS NOWHERE`, `FaceArch`)과 DS 특유의 절제된 개척 인프라가 놓인 두 번째 월드 버전을 제작한다.

---

## 1. 아키텍처 및 진입 경로

1. **멀티 월드 버전 구조 (`seongsu` vs `ds2`)**
   - `ver=seongsu` (기본값): 기존 `public/assets/nowhere/` 자산 로드.
   - `ver=ds2`: 신규 `public/assets/nowhere-ds2/` (모바일은 `public/assets/nowhere-ds2/mobile/`) 자산 로드.
   - 영웅 건물 GLB 2종(`public/assets/gm_building.glb`, `public/assets/facearch.glb`)은 두 버전이 공통으로 사용한다.
2. **진입 경로 (둘 다 지원)**
   - [`public/nowhere.html`](file:///Users/gm_yeonho/new-work/so/so-viewer-monster1267/public/nowhere.html): 상단 HUD 바에 **`성수 2041` / `DS2 산악`** 월드 전환 토글 버튼을 제공하며, `?ver=ds2` URL 파라미터로도 즉시 진입 가능하다.
   - [`public/nowhere-mountain.html`](file:///Users/gm_yeonho/new-work/so/so-viewer-monster1267/public/nowhere-mountain.html): 별도 진입 HTML 페이지. `window.__NW_DEFAULT_WORLD = 'ds2'` 설정을 통해 쿼리 스트링 없이 열어도 곧바로 DS2 산악 월드를 로드한다.

---

## 2. Blender 씬 및 4개 컬렉션 설계 (`build/nowhere/nowhere-ds2.blend`)

기존 `tools/nowhere/blender/lib.py`의 공유 노드 그룹(`NW_GroundMask`, `NW_Surface`), 정점 속성(`nw_mask`, `nw_surface`, `UVMap_mask`), 좌표계(`MASK_RECT = (-112, -162, 162, 172)`)를 그대로 준수한다.

### 2.1 `NW_ground` (`nowhere-ground.glb` + `nowhere-ground-mask.webp`)
- **산악 분지 지형 메시 (`DS_terrain`)**:
  - `MASK_RECT` 내부를 고밀도 삼각망으로 분할하되, 두 영웅 건물(`HAUS NOWHERE` 중심 `(0,0)`, `FaceArch` 중심 `(105, 15)`)의 접지 패드 주변은 평탄화(`z = 0.0`)하고, 외곽과 배후로 갈수록 완만한 이끼 언덕·암반 턱·계곡 사면(`z = -1.2m ~ +18.0m`)으로 융기시킨다.
- **갈래 개울 (`DS_stream`) & 물웅덩이**:
  - 북서쪽 계곡에서 흘러내려 두 건물 사이 남측 저지대를 지나 동남쪽으로 빠져나가는 얕은 갈래 개울(braided stream) 수로(`z = -0.35m ~ -0.15m`)와 수변 자갈밭을 형성한다.
- **개척 접지 인프라 (`DS_pad`, `DS_path`, `DS_curb`)**:
  - `HAUS NOWHERE`와 `FaceArch` 하부에 풍화된 노출 콘크리트 기초 패드와 전정 자갈밭을 두어 자연 지형에 단단히 접지시킨다.
  - 서쪽 진입로에서 `HAUS NOWHERE` 전면과 개울 위를 지나 `FaceArch`로 이어지는 폭 5.5m의 마모된 개척 포장로(현무암 골재 아스팔트 + 끊어진 황색 중앙선)를 배치한다.
- **지면 마스크 베이킹 (`nowhere-ground-mask.webp`, 2048×2048)**:
  - `nw_drive` (R=이끼 밀도, G=젖음·수변, B=비 노출, A=개울·웅덩이 수심)를 지형 경사도·오목부(cavity)·개울 거리에 따라 구동하여, 평탄한 윗면과 수변에는 채도 높은 올리브-그린 이끼(`#3A461C`~`#5C652D`)가 선명한 패치로 맺히고 경사면에는 젖은 검은 현무암(`#273133`)이 드러나도록 굽는다.

### 2.2 `NW_present` (`nowhere-present.glb`) — 3단 스케일 바위·절벽·식생
- **대형 절벽 & 주상절리 암벽 (`DS_cliff_*`)**:
  - 분지 북측·서측·동측 배후와 계곡 사면에 거대한 주상절리 현무암 절벽 및 층리 암반 슬랩(높이 12~42m)을 배치하여 건축물과 자연의 스케일 대비를 만든다.
- **중형 바위 군집 (`DS_rock_*`, Poly Haven `rock_moss_set_01/02`, `boulder_01`, `rock_face_01`)**:
  - 절벽 하단 애추(talus), 개울 가장자리, 언덕 능선에 각진 현무암 블록과 이끼 낀 바위를 대·중·소 군집(1 : 5 : 12 비율)으로 인스턴싱 배치한다.
- **소형 이끼 패치 & 고산 식생 (`DS_moss_*`, `DS_grass_*`, `DS_shrub_*`)**:
  - 개울 둑, 바위 틈, 건물 접지 패드 가장자리에 이끼 마운드(`moss_01`), 고산 관목(`shrub_02`), 어두운 황갈색·초록 풀 다발(`grass_medium_01`)을 밀도 있게 배치한다.

### 2.3 `NW_future` (`nowhere-future.glb`) — DS 스타일 절제된 개척 인프라
- **개척 트러스 교량 (`FU_bridge_*`)**:
  - 갈래 개울과 암반 골짜기 위를 가로지르는 직선형 강재 트러스·그레이팅 보행/운송 교량(청회색 방청 도장 + 하부 접지 오염 + 가장자리 청색/호박색 안전 유도등).
- **카이랄/통신 비콘 기둥 (`FU_beacon.*`) & 화물 경로 표지 (`FU_marker.*`)**:
  - 바위 능선과 개척로를 따라 일정 간격으로 세워진 가늘고 높은 수직 통신 비콘(상단 청록/청색 발광 링 `#53C8D9`, `#3E8AD0`) 및 소면적 고채도 주황(`#D4820F`)/노랑 케이스 포인트.
- **전정 홀로그램 단말 & 조명 (`FU_holo_*`, `FU_flood.*`)**:
  - `HAUS NOWHERE` 전정 패드 입구의 기상·지형 스캔 홀로그램 비콘 및 야간 암벽/건물 하부 투광기.
- **산악 순찰·배송 드론 (`FU_drone_*`)**:
  - 산악 협곡과 두 건물 사이를 선회하는 보안 드론 1기(서치라이트 빔) + 화물 배송 드론 3기.

### 2.4 `NW_backdrop` (`nowhere-backdrop.glb`) — 초록 이끼 & 바위 대산맥 원경 (반경 6.2 km)
- **중경 산악 고원 지형 (`BD_mountain_terrain`, 반경 150m ~ 2,800m)**:
  - 도시 건물·한강·아파트를 완전히 배제하고, `MASK_RECT` 경계에서 끊김 없이 이어지는 연속 높이맵 삼각망 산악 지형을 생성한다.
  - 고도·경사·곡률 기반 절차적 텍스처 아틀라스(`NWB_gen_ds2_mountain`)를 통해 **짙은 초록/올리브 이끼 구릉지, 노출된 검은 현무암 암릉, 골짜기 개울 줄기, 원경 암벽의 가는 실폭포(waterfall streaks)** 를 표현한다.
- **중경 거대 암봉 및 협곡 절벽 (`BD_crags`)**:
  - 반경 250m ~ 1,200m 구간에 솟아오른 각진 주상절리 암봉과 계단식 현무암 대지(mesa/butte) 매스를 배치한다.
- **원경 4겹 대산맥 능선 (`BD_ridge_1` … `BD_ridge_4`, 반경 3.2 ~ 6.0 km)**:
  - 겹마다 거리를 벌려 공기 원근(Height Exponential Fog)에 의해 점차 밝고 푸른 회청색(`#9EA9AE` → `#77828F`)으로 물드는 4겹의 험준한 산악·설산 능선 실루엣을 두른다.

---

## 3. 웹 뷰어 및 테스트 검증 기준

1. **품질/예산 계약 (`tests/nowhere-assets.test.mjs` 확장)**:
   - 데스크톱 전송 용량 ≤ 40 MB, 모바일 ≤ 22 MB
   - 데스크톱 드로우콜 ≤ 300, 모바일 ≤ 180
   - 데스크톱 삼각형 ≤ 2.0M, 모바일 ≤ 0.90M
   - 데스크톱 FPS ≥ 55, 모바일 FPS ≥ 30
2. **기상 5종 · 카메라 6종 · 야간 창문 발광 · 분석 모드 앵커**:
   - `overcast`, `rain`, `dusk`, `night`, `snow` 5개 프리셋 모두에서 지형 이끼/바위 셰이더와 건물 야간 창문 발광(`uNwWindowKind`), 비콘 발광이 정상 작동해야 한다.
   - `anchors.ko.json`에 DS2 산악 월드 전용 기록·서사 앵커(건물 7 + 산악 지형/자연 8 + 개척 인프라 6 = 21개)를 수록한다.
