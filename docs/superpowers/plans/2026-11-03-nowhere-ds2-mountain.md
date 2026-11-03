# HAUS NOWHERE — DS2 산악 월드 (`ver=ds2`) 구현 계획

> **기반 스펙**: [`docs/superpowers/specs/2026-11-03-nowhere-ds2-mountain-design.md`](file:///Users/gm_yeonho/new-work/so/so-viewer-monster1267/docs/superpowers/specs/2026-11-03-nowhere-ds2-mountain-design.md)

## Task 1: Blender DS2 산악 월드 생성 스크립트 (`tools/nowhere/blender/ds2_*.py`)
- **생성 파일**:
  - `tools/nowhere/blender/ds2_ground.py`:
    - `NW_ground` 컬렉션에 산악 분지 지형(`DS_terrain`), 갈래 개울(`DS_stream`), 영웅 건물 2개용 노출 콘크리트 접지 패드(`DS_pad`), 바위 사이 개척 진입로(`DS_path`, `DS_marks`), 전정 자갈 화단(`DS_gravel`) 생성.
    - `UVMap_mask` 및 `nw_drive`(경사·오목부·개울 거리 기반 이끼 R / 젖음 G / 비 노출 B / 웅덩이·개울 A) 기록.
    - `NW_layout` 컬렉션에 `BLD_haus`, `BLD_facearch` 및 카메라(`CAM_street`, `CAM_aerial`, `CAM_ground`, `CAM_lot`) 배치.
  - `tools/nowhere/blender/ds2_present.py`:
    - `NW_present` 컬렉션에 DS2 시그니처 3단 스케일 바위·절벽·식생 구축:
      1. 대형 주상절리·층리 암반 절벽 슬랩(`DS_cliff_*`)
      2. Poly Haven 바위(`rock_moss_set_01/02`, `boulder_01`, `rock_face_01`) 대·중·소 군집 인스턴스
      3. 이끼 마운드(`moss_01`), 고산 관목(`shrub_02`), 풀 다발(`grass_medium_01`)
    - `NW_anchors`에 건물 7개 + 자연/산악 지형 8개 앵커 배치, `CAM_viaduct`(협곡 교량 시점) 추가.
  - `tools/nowhere/blender/ds2_future.py`:
    - `NW_future` 컬렉션에 DS 스타일 개척 인프라 구축:
      1. 개울·협곡 횡단 강재 트러스 교량(`FU_bridge_*`) + 청색 유도 LED
      2. 능선·개척로 카이랄/통신 비콘 기둥(`FU_beacon.*`, `#53C8D9` / `#3E8AD0` 발광)
      3. 주황색 화물/경계 마커(`FU_marker.*`, `#D4820F`) 및 전정 기상/지형 홀로그램 단말(`FU_holo_scanner`)
      4. 산악 협곡 순찰 보안 드론 1기 + 배송 드론 3기(`FU_drone_*`, `DRONE_PATHS`)
    - `NW_anchors`에 개척 인프라 6개 앵커 추가, `CAM_night` 추가.
  - `tools/nowhere/blender/ds2_backdrop.py`:
    - `NW_backdrop` 컬렉션에 도시 요소를 완전히 제거한 반경 6.2 km 대산맥 배경 구축:
      1. `NWB_gen_ds2_mountain` 절차적 산악 지표 아틀라스(초록/올리브 이끼 구릉, 현무암 암릉, 고산 자갈, 계곡 개울, 실폭포, 야간 원경 비콘 점광)
      2. `BD_mountain_terrain`: `MASK_RECT` 가장자리에서 반경 2,800m까지 이어지는 연속 3D 산악 고원·계곡 메시
      3. `BD_crags`: 중경(250~1,400m) 주상절리 암봉·테이블 마운틴(mesa) 매스 및 암벽 실폭포 카드
      4. `BD_ridge_1` … `BD_ridge_4`: 반경 3.2 ~ 6.0 km 4겹 고산·설산 능선 실루엣

## Task 2: DS2 베이킹 · 내보내기 · Meshopt 최적화 (`ds2_build.py`)
- **생성/수정 파일**:
  - `tools/nowhere/blender/ds2_build.py`:
    - `build/nowhere/nowhere-ds2.blend` 생성, 2048×2048 `public/assets/nowhere-ds2/nowhere-ground-mask.webp` 및 Cycles 정점 AO 베이킹, `public/assets/nowhere-ds2/layout.json` · `anchors.ko.json` · `sky-1k.hdr` · `renders/hero-*.webp` 6종 렌더 및 `build/nowhere/raw-ds2/nowhere-{ground,present,future,backdrop}.glb` 내보내기.
  - `package.json`:
    - `nowhere:ds2:build`, `nowhere:ds2:optimize` 스크립트 추가.
  - 데스크톱(`public/assets/nowhere-ds2/*.glb`) 및 모바일(`public/assets/nowhere-ds2/mobile/*.glb`) Meshopt + WebP 최적화 실행.

## Task 3: 웹 뷰어 멀티 월드 전환 (`seongsu` ↔ `ds2`) 및 별도 페이지
- **생성/수정 파일**:
  - `public/src/nowhere/quality.js`: `getQualityConfig(tier, worldVer)`가 `worldVer === 'ds2'`일 때 `assets/nowhere-ds2` 경로를 반환하도록 확장.
  - `public/src/nowhere/world.js`, `public/src/nowhere/analysis.js`, `public/src/nowhere/main.js`:
    - URL 쿼리 `?ver=ds2` 또는 `window.__NW_DEFAULT_WORLD`를 읽어 해당 월드 자산(`layout.json`, `anchors.ko.json`, GLB 4종, 지면 마스크)을 로드하고 상단 타이틀·로더 문구·월드 전환 버튼 활성화 상태를 동기화.
  - `public/nowhere.html`, `public/src/nowhere/nowhere.css`:
    - 상단 바에 **`성수 2041` / `DS2 산악`** 월드 스위치 UI 추가.
  - `public/nowhere-mountain.html`:
    - `window.__NW_DEFAULT_WORLD = 'ds2'`가 기본 설정된 독립 진입 페이지 생성.

## Task 4: 단위 테스트 및 Playwriter 브라우저 전수 검증
- `tests/nowhere-assets.test.mjs`, `tests/nowhere-quality.test.mjs`, `tests/nowhere-anchors.test.mjs`에 `ds2` 월드 자산 계약 및 예산 테스트 추가 (`npm test`).
- `playwriter`로 `http://localhost:4173/nowhere?ver=ds2` 및 `http://localhost:4173/nowhere-mountain.html` (데스크톱 + 모바일, 5종 기상 프리셋, 6종 카메라, 밤 창문 점등, 분석 모드) 검증 및 스크린샷 캡처.
