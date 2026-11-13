# HAUS NOWHERE — 건물 아카이브 카드 · 건물 감상 모드 설계

날짜: 2026-11-13 · 범위: 성수 2041 · DS2 산악(두 월드 모두 같은 자리의 두 건물) 외관

## 1. 목표

외관에서 두 건물(HAUS NOWHERE SEOUL · FaceArch)을 고르면 오른쪽에 **아카이브 카드**(규모 · 구성 등 기록)가 뜬다.
카드의 `자세히 보기` 를 누르면 리테일에서 만든 **감상 무대**에 그 건물만 남겨 돌려 보고 확대한다.
무대에는 **부위 표지**(HAUS 포디움 · 타워 · 크라운, FaceArch 몸체 · 눈 · 필로티 다리)가 있고, 누르면 그 부위 설명이 패널에 나온다.
두 허브 구조(제안)의 `Architecture` 항목 첫 단계다. 제품 감상과 같은 무대 · 같은 경로 표시 형식을 쓴다.

## 2. 데이터(새로 만들지 않는다 — 있는 것만)

| 쓰는 곳 | 출처 | 내용 |
|---|---|---|
| 카드 · 감상 패널 | `assets/record.json`(haus) · `assets/facearch.json`(facearch) | `index`(0001 · 0002), `title`, `category`, `note`, `facts`(항목 · 값 쌍) |
| 부위 표지 · 부위 패널 | 월드 `layout.json` `anchors`(layer `building`) | `id`, `pos`(월드), `title`, `facts`, `lore` — `haus_podium` · `haus_tower` · `haus_crown` · `facearch_body` · `facearch_eyes` · `facearch_legs`. `haus_garden`(전정 — 건물 모델 밖)은 뺀다 |
| 건물 모델 | `quality.heroUrls`(데스크톱 원본 · 모바일 사본) | 월드가 이미 받은 같은 주소 — 브라우저 캐시로 다시 받지 않는다 |
| 건물 자리 | `layout.buildings`(`pos`, `rotY`) | 부위 월드 좌표 → 건물 로컬(`buildingToWorld` 의 역) |

문구를 지어내지 않는다. 카드 · 패널 문구는 위 파일 값 그대로다.

## 3. 고르기(카드 열기)

1. **건물 이름표**: 각 건물 위(모델 경계 상자 윗면 + 4 m)에 `<title> · 기록 보기` 버튼. 카메라에서 `BUILDING_TAG_RANGE = 220 m` 안이고 화면 안이면 보인다.
   인트로 · 방식 고르기 · 가이드 투어 진행 중 · 실내 · 감상 · 조작 안내 · 모달 동안은 숨긴다. 누르면 카드.
2. **자유 시점 클릭**: 자유 시점(보행 아님)에서 끌지 않은 클릭(`CLICK_SLOP = 5 px`)이 건물 모델에 맞으면 카드. 보행 시점은 캔버스 클릭이 마우스 고정이라 고르지 않는다(이름표 · 스팟 도착으로).
3. **보행 스팟 도착**: 외관 건물 스팟 중 `kind: 'view'`(정문 `entrance` 제외 — 입장 질문) 에 도착하면 그 건물 카드.

## 4. 아카이브 카드

- 오른쪽 패널(감상 정보 패널과 같은 모양 · 위치, 휴대폰 · 세로 태블릿은 아래). 모달이 아니다 — 카드가 떠 있어도 걷고 둘러볼 수 있다.
- 내용: kicker `ARCHITECTURE · 0001`, 제목, facts(항목 · 값), note(작은 글씨), 버튼 `자세히 보기` · `닫기`.
- 닫힘: `닫기`, `Esc`(카드가 떠 있으면 먼저 카드만 닫는다 — 보행 마우스 고정 중 Esc 는 브라우저가 먼저 고정을 푼다), 실내 들어가기, 월드 전환, 가이드 투어 시작, 감상 열기, 카드 건물에서 `CARD_KEEP_RANGE = 260 m` 밖으로 멀어짐.
- 다른 건물을 고르면 그 건물 카드로 바뀐다.

## 5. 건물 감상 모드

- 제품 감상과 같은 무대(배경 · 원판 · RoomEnvironment · 조명 3개 · 회전 · 확대 · 4 초 뒤 자동 회전 · 옆 패널 왼쪽 빈 곳 가운데).
- 경로 `SUPREME ORIGIN > Architecture > <title>`, 패널 kicker `ARCHITECTURE · 0001`, facts, note. 이전 · 다음(`←`/`→`) = 두 건물 순환(HAUS → FaceArch → HAUS).
- 모델: 건물 하나(한 단계 — 고해상도 교체 없음). 상태 문구 `고해상도 불러오는 중…` 은 보이지 않는다.
- 부위 표지: 무대 위 부위 자리(건물 로컬 좌표)에 작은 버튼. 누르면 패널이 부위로 바뀐다(kicker `<건물 title> · PART`, 부위 title, facts, lore, `‹ 건물 정보` 버튼). 다른 건물로 넘기면 건물 정보로.
  표지는 카메라 쪽을 향한 면 너머(모델 뒤)에 있으면 흐리게(가림 판정 — 표지 점에서 카메라 쪽 광선이 모델에 먼저 맞으면).
- 나가기(`Esc` · `< BACK`): 연 자리 · 시선 · 보행 여부 그대로(외관). 카드는 닫힌 채.
- 감상 중 키 · 클릭 문지기(`showcaseKeyGate`, 캔버스 click 가드)는 제품과 같다.

## 6. 공통화(감상 무대)

`showcase.open` 은 제품 전용 인자(catalog · floorId · productId) 대신 **목록(collection)** 을 받는다:
`{ kind, kickerOf(item), items: [{ id, name, kicker, crumbs, rows, note }], startId, loadLite(id) → Promise<Object3D|null>, loadHi(id) | null, hint, parts?(id) → [{ id, title, local:[x,y,z], kicker, rows, lore }] }`.
제품 목록은 `products.js` 의 함수가 catalog · floorId 로 만든다(지금 동작 그대로 — 테스트로 지킨다). 건물 목록은 새 순수 모듈 `archive.js` 가 만든다.

## 7. 예산 · 기기

- 이름표 · 카드 · 부위 표지는 DOM(그리기 0). 외관 그리기 · 삼각형 변화 없음.
- 감상 그리기: HAUS 메시 58 · FaceArch 79 이하 + 원판 1. 휴대폰은 모바일 사본.
- 휴대폰 · 태블릿 · 데스크톱 모두 같은 기능.

## 8. 조작 안내 · 문서

- 조작 안내 `제품 감상` 묶음을 `감상 모드`(제품 · 건물)로: 건물 이름표 · 자유 시점 건물 클릭 · 건물 스팟 도착 → 카드, `자세히 보기` → 감상, 부위 표지.
- README 조작 표 · 기능 설명에 건물 카드 · 건물 감상.

## 9. 시험

- 순수: `archive.js`(건물 항목 · 부위 로컬 좌표 왕복 · garden 제외 · 카드 트리거 판정 · 이름표 보이기 판정), 제품 목록 함수(이전 동작과 같음).
- 연결: 정규식(카드 · 이름표 · 클릭 · 스팟 도착 · open 인자).
- 브라우저(playwriter): 두 월드 × 데스크톱 · 태블릿 · 휴대폰에서 이름표 → 카드 → 감상 → 부위 → 나가기 복원, 보행 스팟 도착 카드, 제품 감상 회귀.
