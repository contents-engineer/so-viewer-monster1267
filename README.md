# HAUS NOWHERE — 성수 2041 · DS2 산악 월드

**HAUS NOWHERE SEOUL**(81 m 사옥)과 **FaceArch**(31 m 필로티 조형 건물)를 중심으로 구축한 두 가지 3D 월드 아카이브 뷰어입니다.

1. **성수 2041 (`ver=seongsu`)**: 성수동 뚝섬로 블록(붉은 벽돌 공장·공방·2호선 고가·은행나무·전선), 자연 침식 포켓(현무암·산악 이끼·검은 물웅덩이), 근미래 레이어(청록 LED 차선·유리 버스 키오스크·자율주행 로보택시·순찰 드론) 결합 월드
2. **DS2 산악 고원 (`ver=ds2`)**: 양쪽으로 층리 대암벽(이끼 선반 + 회색 단애 + 세로 걸리)이 솟고 상류로 갈수록 V자로 겹쳐지는 빙하 U자 계곡, 이끼·황록 풀이 덮인 계곡 바닥의 회색 표석 들판과 개울, 북북동 암벽 너머 역광 태양 헤이즈, 북측 협곡 산악 고가교, 카이랄 개척 트러스 브리지·릴레이 비콘·홀로그램 이정표 결합 월드

- 출하되는 모든 외부 텍스처·모델·HDRI는 **Poly Haven CC0** 이며, 한글 간판 생성용 글꼴은 **SIL OFL 1.1** 입니다.

## 1. 실행 및 URL 옵션

```bash
npm start          # http://localhost:4173
npm run start:lan  # 같은 Wi-Fi 기기에서 http://<PC IP>:4173
```

- **성수 2041 (기본)**: `http://localhost:4173/` 또는 `http://localhost:4173/nowhere`
- **DS2 산악 월드**: `http://localhost:4173/?ver=ds2` 또는 `http://localhost:4173/nowhere-mountain`
- **인트로 생략 + 특정 카메라/날씨 진입**: `http://localhost:4173/?ver=ds2&noIntro=1&cam=lot&weather=overcast`
- **모바일 품질 강제 테스트**: `http://localhost:4173/?tier=mobile`

| 조작 / 단축키 | 동작 |
|---|---|
| `성수 2041` / `DS2 산악` (상단 우측) | 두 월드 배경 버전 즉시 전환 |
| `기상 · 시간` (하단 좌측) | `흐림(overcast)` · `비(rain)` · `황혼(dusk)` · `밤(night)` · `눈(snow)` 5종 프리셋을 2.5초 보간으로 전환 |
| `카메라 프리셋` (하단 우측) | 6종 시점 이동 (`거리/개척로` · `조감` · `고가 하부/협곡 상류` · `밤거리/산악의 밤` · `노면 근접/개울 근접` · `자연 포켓/이끼 포켓`), DS2 는 7번째 `빙하 계곡`(상류 개울 둑에서 겹쳐지는 층리 암벽) 추가 |
| `F` / `분석 모드` 버튼 | 세계를 청회색(`#0F1D33`)으로 감광하고 1.2초 스캔 펄스·화면 고정 두께 윤곽선(`LineSegments2`)·분석 앵커 핀 표시 |
| `[` / `]` (분석 모드 중) | 현재 선택된 레이어 필터(`전체` · `건물` · `현재` · `근미래` · `자연`) 내 앵커 순환 및 카메라 포커스 이동 |
| `Esc` | 열린 기록 카드 닫기 → 분석 모드 종료 (보행 시점 중에는 보행 시점만 해제) |
| `V` / `보행 시점` 버튼 | 지면 위 1.7 m 눈높이 보행 시점 토글. `WASD` 이동, `↑`/`↓` 올려다보기·내려다보기(±80°), `←`/`→` 좌우로 돌아보기, 마우스 드래그로도 제자리에서 둘러보기. 지형 기복을 따라 걷고, 건물·바위·전주 등 장애물과 50° 넘는 급경사는 통과하지 못함(벽을 따라 미끄러짐) |
| `인트로 비행` 버튼 | 12초 인트로 비행 재생 (클릭·키 입력 시 즉시 중단) |

## 2. 빌드 및 검증 파이프라인

```bash
# 1) Poly Haven CC0 에셋·OFL 글꼴 다운로드 및 SHA-256 검증 + Three.js r170 JSM 애드온 벤더링
npm run nowhere:fetch

# 2-A) 성수 2041: Blender 씬 조립 + 마스크·Cycles AO 베이킹 + GLB·layout.json·렌더 내보내기 및 최적화
npm run nowhere:build
npm run nowhere:optimize

# 2-B) DS2 산악 월드: Blender 씬 조립 + 마스크·Cycles AO 베이킹 + GLB·layout.json·렌더 내보내기 및 최적화
npm run nowhere:ds2:build
npm run nowhere:ds2:optimize

# 3) 단위·스키마·자산 예산·금지어 검증 테스트 (node:test 19개 항목)
npm test
```

## 3. 리서치 및 소재 출처 문서

- [환경·기상·지형 시각 문법 리서치 (`docs/nowhere/research/ds.md`)](docs/nowhere/research/ds.md)
- [근미래 도시 인프라 및 분석 UI 리서치 (`docs/nowhere/research/dbh.md`)](docs/nowhere/research/dbh.md)
- [성수동 뚝섬로·연무장길 건축·도시 조직 리서치 (`docs/nowhere/research/seongsu.md`)](docs/nowhere/research/seongsu.md)
- [Poly Haven CC0 및 글꼴 라이선스·출처 대장 (`docs/nowhere/credits.md`)](docs/nowhere/credits.md)
- [매니페스트 원본 (`tools/nowhere/sources.json`)](tools/nowhere/sources.json)
