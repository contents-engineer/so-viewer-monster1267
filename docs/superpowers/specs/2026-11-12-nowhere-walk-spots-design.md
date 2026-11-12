# HAUS NOWHERE — 보행 이동 스팟 설계 스펙

- **작성일**: 2026-11-12
- **기반**: 성수 2041 · DS2 산악 월드 뷰어(`public/src/nowhere/`), 실내 뷰(`interior.js`, `assets/nowhere-inner/inner-layout.json`)
- **목표**: 보행 시점에서 디트로이트 비컴 휴먼처럼 이동할 수 있는 지점(스팟)을 화면에 표시하고, 클릭 · 탭하면 그 지점까지 걸어가게 한다. 키보드가 없는 모바일 · 아이패드도 보행 중 이동할 수 있게 된다(지금은 드래그로 둘러보기만 가능).

## 0. 확정된 결정

| 항목 | 결정 |
|---|---|
| 적용 범위 | 실내 4개 층(B1F · 1F · 12F · 13F) + 외관 두 건물(하우스노웨어 성수 = HAUS, 하우스노웨어 몽골 = FaceArch) 주변. 거리 전체에는 두지 않는다 |
| 월드 | 외관 스팟은 건물 기준 상대 좌표라 성수 2041 · DS2 둘 다 적용. 지형 때문에 설 수 없는 스팟은 실행 중 자동으로 숨긴다 |
| 이동 | 보행 충돌 격자로 길을 찾아 걸어서 이동. 길이 없으면 0.3 초 암전 컷 순간 이동 |
| 표시 | 가까운 것만 단계 표시(40 m 안 작은 마름모, 12 m 안 · 겨눔 시 아이콘 + 이름). 가려진 스팟 · 지금 서 있는 스팟은 숨김 |
| 예외 | 건물 대표 스팟(성수 정문 · 몽골 얼굴 정면)은 거리 · 가림과 관계없이 '이름 · 거리'로 표시(보행 시작 지점이 건물에서 약 100 m 떨어져 있으므로) |
| 도착 동작 | 성수 정문 → 「입장하시겠습니까?」 → 예 = 실내 진입. 실내 둘러보기 스팟 → 자막 4 초. 엘리베이터 · 1F 출구 → 기존 질문 |
| 렌더 비용 | 0 (마커는 DOM 오버레이 — 모바일 조감 최악 178/180 그리기라 3D 마커를 넣을 여유가 없음) |

## 1. 스팟 데이터

### 1.1 형식 (월드 좌표, Three.js 축)

```js
// resolve 된 스팟 — 마커 · 길 찾기 · 도착 동작이 쓰는 형태
{
  id: 'haus_entrance',
  label: '하우스노웨어 성수 정문',
  x: 0, z: 36,                 // 설 자리(지면 높이는 실행 중 groundHeightAt 로 구함)
  look: [0, 10, 0],            // 도착하면 바라볼 점
  kind: 'view' | 'entrance' | 'elevator' | 'exit',
  beacon: false,               // true 면 거리 · 가림과 관계없이 표시(건물 대표 스팟)
  caption: null,               // 도착 자막(실내 둘러보기 스팟)
  building: 'haus',            // entrance 의 대상 건물
}
```

### 1.2 외관 스팟 (`walk-spots.js` 의 `EXTERIOR_SPOTS`)

- 건물별 로컬 오프셋(`at: [x, z]`, `look: [x, y, z]`)으로 정의하고, `layout.buildings[id].pos · rotY` 로 월드 좌표로 바꾼다. 변환식은 `tour-config.js` 의 `approachFor` 와 같다(공용 함수로 뽑아 둘 다 쓴다).
- 초기 후보(로컬 좌표, 구현 중 브라우저에서 막힘 · 구도를 보고 조정):

| 건물 | id | 이름 | at | look | 비고 |
|---|---|---|---|---|---|
| HAUS | `haus_entrance` | 하우스노웨어 성수 정문 | [0, 36] | [0, 10, 0] | kind `entrance`, beacon |
| HAUS | `haus_garden` | 전정 화단 | [-12, 33] | [-12, 0.8, 26] | |
| HAUS | `haus_sw` | 남서 모서리 — 타워 올려다보기 | [-32, 34] | [0, 40, 0] | |
| HAUS | `haus_se` | 남동 모서리 | [32, 34] | [0, 30, 0] | |
| HAUS | `haus_east` | 동측 면 | [34, 0] | [0, 25, 0] | |
| FaceArch | `face_front` | 하우스노웨어 몽골 정면 | [-26, 3] | [0, 16, 0] | beacon (얼굴은 로컬 −x 쪽을 향함) |
| FaceArch | `face_piloti` | 필로티 아래 | [2, 2] | [2, 6, 2] | 다리 사이가 막혀 있으면 뺀다 |
| FaceArch | `face_left` | 왼쪽 측면 | [-8, 22] | [0, 16, 0] | |
| FaceArch | `face_right` | 오른쪽 측면 | [-8, -20] | [0, 16, 0] | |

### 1.3 실내 스팟 (`interiorSpots(floorDef)`, `inner-layout.json` 에서 자동 생성 — 실내 빌드 변경 없음)

- 둘러보기 지점 `tour[i]` → kind `view`, 자리 = `pos` 의 (x, z), look = `target`, 이름 = `caption` 의 ' — ' 앞부분, caption = 전체 자막.
- `elevator` → kind `elevator`, 이름 '엘리베이터', 자리 = 영역 중심, look = 영역 중심(높이 1.5 m).
- `exit`(1F) → kind `exit`, 이름 '밖으로 나가기', 자리 = 영역 중심, look = 영역 중심(높이 1.5 m).

### 1.4 스팟 자리 보정

- 스팟 집합을 바꿀 때(외관 보행 시작 · 층 이동 · 실내 ↔ 외관) 한 번, 각 스팟 자리가 막혀 있으면(`blocker.isBlocked(x, z, STEP_UP)` 또는 실내 영역 밖) 반경 2 m 안의 가장 가까운 빈 칸으로 옮긴다. 2 m 안에 빈 칸이 없으면 그 스팟은 숨긴다(목록에서 뺀다).
- 엘리베이터 · 출구는 영역 트리거가 반경 안에서 질문을 띄우므로 자리 보정으로 반경 밖으로 밀려도 걸어가는 도중에 질문이 뜬다.

## 2. 표시 (`spot-markers.js`, DOM 오버레이)

- **위치**: 스팟 자리 지면 + 1.0 m 를 매 프레임 화면에 투영한다. 카메라 뒤 · 화면 밖이면 숨긴다(가장자리 화살표 없음).
- **단계** (`spotStage(dist, { beacon, aimed })`, 순수):

| 조건 | 단계 | 모습 |
|---|---|---|
| 거리 < 1.5 m (지금 서 있는 자리) | `hidden` | 숨김 |
| beacon 이고 거리 ≥ 12 m | `beacon` | 작은 마름모 + '이름 · 84 m' |
| 거리 ≤ 12 m, 또는 표시 중인 마커(40 m 안 · beacon)를 겨눔(마우스 올림 · 조준점) | `near` | 지름 28 px 둥근 아이콘 + 이름 |
| 12 m < 거리 ≤ 40 m | `far` | 지름 10 px 흰 마름모(불투명도 0.6) |
| 거리 > 40 m | `hidden` | 숨김 |

- **겉모습**: 흰 반투명 선 + 옅은 청백 발광(디트로이트 비컴 휴먼 상호작용 표지 느낌), 나타날 때 0.2 초 페이드 · 크기 전환. 터치 대상은 최소 44 × 44 px(보이는 크기와 별개로 투명 여백).
- **가림**: 0.2 초마다, 눈 → 마커 점 선분을 0.5 m 간격으로 보행 충돌 격자에서 표본화해 그 자리의 장애물 윗면(`blocker.topAt`, 지면 위 m)이 선분 높이보다 높으면 가려진 것으로 숨긴다. beacon 단계는 가림 검사를 하지 않는다.
- **보이는 때**: 보행 시점일 때만(외관 · 실내). 궤도 카메라 · 인트로 · 비행 · 둘러보기 · 모달 · 조작 안내 · 화면 전환 중에는 모두 숨긴다. 자동 걷기 중에는 보인다(다른 스팟으로 바꿀 수 있게).

## 3. 이동

### 3.1 고르기

- 마우스 · 터치: 마커를 클릭 · 탭(마커가 캔버스 위 DOM 이라 OrbitControls · 포인터 잠금 클릭과 겹치지 않는다).
- 포인터 잠금 중: 화면 가운데 조준점이 마커 터치 영역 안이면 그 마커가 겨눔(`near` 모습)으로 바뀌고, 캔버스 클릭이 그 스팟을 고른다. 잠금은 유지한다.

### 3.2 길 찾기 (`walk-path.js`, 순수 · three 없음)

- `findPath(start, goal, isFree, opts)`: 0.5 m 칸 8방향 A*(대각선은 이웃한 두 직교 칸이 모두 비어 있을 때만), 옥타일 거리 휴리스틱.
  - `isFree(x, z)`: 보행과 같은 판정 — `!blocker.isBlocked(x, z, STEP_UP)`(몸 반경 0.35 m, 턱 0.35 m) + 실내는 층 영역 안.
  - 경사: 이웃 칸으로 갈 때 `(지면 차) / 수평 거리 > MAX_CLIMB(1.2)` 인 오르막은 막힘(보행과 같은 값). 이를 위해 `isStep(ax, az, bx, bz)` 콜백을 받는다.
  - 탐색 영역: 시작 · 목표 사각형 + 24 m 여유. 확장 노드 상한 150,000(넘으면 실패).
  - 시작 칸이 막혀 있으면 1 m 안, 목표 칸이 막혀 있으면 2 m 안의 가장 가까운 빈 칸에서 찾는다.
  - 결과: 월드 좌표 점 목록(시작 → 목표) 또는 `null`.
- `smoothPath(points, segmentFree)`: 끈 당기기(앞 점에서 직선으로 갈 수 있는 가장 먼 점으로 건너뜀). 직선 검사는 0.25 m 간격으로 `isFree` · 경사를 본다.

### 3.3 따라 걷기 (`walk-path.js` 의 `createPathFollower` + `camera.js`)

- `camera.walkTo(points, { look, onArrive })`: 보행 중일 때만. 기존 보행 갱신(`stepCamera` 의 보행 분기)에서 WASD 대신 경로 추종 이동을 쓴다. 지면 붙음 · 턱 오르기 · 충돌 미끄러짐 · 몸 물리는 그대로.
- 속도: 경로 길이 ≤ 30 m 면 걷기 5 m/s, 넘으면 달리기 10 m/s.
- 경유점 도달 반경 0.3 m. 시선 수평 방위는 진행 방향으로 초당 최대 180° 돌고, 상하 시선은 수평(0°)으로 서서히 돌아온다. 마지막 2 m 부터 `look` 쪽으로 돈다. 도착 후 0.6 초 안에 `look` 을 정면으로 본다.
- 끊기: WASD · 방향키 · Space · 캔버스 포인터 다운 · 휠 · 모달 열림(`clearInput`) · 보행 해제 · 다른 스팟 고르기 → 그 자리에서 멈춘다(`onArrive` 부르지 않음).
- 막힘: 1 초 동안 0.2 m 미만 나아가면 컷 순간 이동으로 목적지에 둔다.
- 컷 순간 이동: 0.3 초 어둡게 → 스팟 자리 지면 + 눈높이, `look` 을 바라봄 → 0.3 초 밝게 → `onArrive`. 암전 레이어는 실내의 `.nw-fade` 를 공용 모듈(`fade.js`)로 옮겨 외관 · 실내가 같이 쓴다.

### 3.4 도착 동작

| kind | 동작 |
|---|---|
| `view` (실내) | 하단 자막(실내 `nw-interior-caption`)에 caption 4 초. 다음 이동 · 둘러보기 시작 시 지움 |
| `view` (외관) | 없음 |
| `entrance` (성수 정문) | 모달 「입장하시겠습니까?」 [예] [아니오] → 예 = `interior.enter('haus')`(보행 유지 진입은 기존 흐름 그대로) |
| `elevator` · `exit` | 없음 — 걸어가는 중 기존 영역 트리거가 「층 선택」 · 「밖으로 나가시겠습니까?」를 띄운다 |

## 4. 연결

| 모듈 | 바뀌는 점 |
|---|---|
| `walk-spots.js` (새) | `EXTERIOR_SPOTS`, `exteriorSpots(layout)`, `interiorSpots(floorDef)`, `spotStage()`, `buildingToWorld()`(공용 변환) |
| `walk-path.js` (새) | `findPath`, `smoothPath`, `createPathFollower` |
| `spot-markers.js` (새) | `createSpotMarkers({ camera, canvas, camCtrl, onPick })` → `setSpots(list)`, `update(dt)`, `setSuspended(bool)` |
| `fade.js` (새) | 공용 암전 레이어 `createFade()` → `fadeTo(on, text, ms)` (`interior.js` 에서 옮김) |
| `camera.js` | `walkTo()`, `cancelWalkTo()`, `isAutoWalking()`, `getWalkContext()`(지금 쓰는 `groundHeightAt` · 장애물 · 실내 영역) |
| `tour-config.js` | `approachFor` 가 `buildingToWorld` 를 쓴다(동작 같음) |
| `interior.js` | 층 표시 · 나가기 때 마커 스팟 집합을 바꾼다. 둘러보기 · 화면 전환 중 마커 숨김. 공용 `fade.js` 사용 |
| `main.js` | 마커 생성, 외관 스팟 공급, 고르기 → 길 찾기 → `walkTo` / 컷, 도착 동작(정문 입장 모달), 렌더 루프에서 `markers.update` |
| `help.js` | 조작 안내에 '스팟 클릭 · 탭: 그 자리로 걸어가기' 행, 보행 안내 문구에 '스팟 클릭 이동' |
| `nowhere.css` | 마커 스타일(단계별), 모바일 크기 |

## 5. 예산 · 성능

- 그리기 · 삼각형 추가 0(DOM). 모바일 조감 최악 178/180 · 898,927/900,000 그대로.
- 매 프레임: 스팟 ≤ 10 개 투영 + DOM transform 갱신(바뀐 값만). 가림 검사 0.2 초마다.
- 길 찾기: 고를 때 한 번. 데스크톱 100 m 경로 ≤ 30 ms, 실내 ≤ 5 ms 목표(구현 중 측정 · 보고).
- FPS ≥ 60 기준 유지(보행 · 마커 표시 상태에서 데스크톱 · `&tier=mobile` 측정).

## 6. 테스트 · 확인

- `tests/nowhere-walk-path.test.mjs`: 빈 격자 직선, 벽 우회, 막힌 목표 근처 빈 칸으로 보정, 둘러싸인 목표 → `null`, 노드 상한 → `null`, 대각선 모서리 끼임 금지, 경사 막힘, 끈 당기기가 장애물을 가로지르지 않음, 따라 걷기(도착 · 걷기/달리기 속도 · 막힘 감지).
- `tests/nowhere-walk-spots.test.mjs`: 외관 스팟 월드 변환(건물 pos · rotY, `approachFor` 와 같은 결과), 실내 4개 층 스팟(둘러보기 수 + 엘리베이터, 1F 출구) · 이름 추출, `spotStage` 경계값(1.5 · 12 · 40 m, beacon, 겨눔).
- `tests/nowhere-help.test.mjs`: 안내 문구에 스팟 이동 행.
- 기존 `tests/nowhere-tour-config.test.mjs` 가 공용 변환으로 바꾼 뒤에도 통과.
- 브라우저(playwriter): 성수 · DS2 외관 보행에서 두 건물 스팟 표시 · 걸어가기 · 정문 입장 모달, 실내 4개 층 스팟, 포인터 잠금 조준 · 클릭, `&tier=mobile` 탭, 그리기 횟수 불변, FPS. 캡처는 `build/nowhere/compare/spot-*.png`.

## 7. 범위 밖

- 거리 전체 스팟, 보행자, 스팟 사이 연결선 · 경로 미리보기, 화면 가장자리 방향 화살표, 미니맵.
- 모바일 가상 조이스틱(스팟 이동으로 대신한다).
