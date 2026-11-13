# 현장 정보 HUD · 사진 모드 · 발표 모드 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. 스펙: `docs/superpowers/specs/2026-11-13-nowhere-hud-photo-kiosk-design.md`.

## Global Constraints

- 없는 값을 지어내지 않는다(온도 · 바람 없음). 시각 · 기상 문구는 지금 독 표기와 같게.
- 좌표 규칙: 북 = −z, 동 = +x(world.js 해 방위 주석과 같음), 원점 위경도 37.544°N 127.056°E, 위도 1° = 111 320 m.
- 새 키 `H` · `C` · `K` — 기존 키와 겹치지 않는다. 입력 칸 · 감상 · 모달 · 조작 안내 중엔 무시.
- 그리기 · 삼각형 변화 없음(DOM). 터치 44 px. 자연스러운 한국어. 조작 안내 1600 × 900 첫 화면 유지.
- 기존 동작(인트로 · 방식 · 감상 · 목록 · 같은 자리 · 실내 둘러보기)은 바뀌지 않는다 — 기존 테스트 그대로 통과.
- 구현자는 git add · commit 하지 않는다. 브라우저 확인은 playwriter MCP 만, 대화상자는 먼저 가로챈다.

---

### Task 1: 현장 정보 HUD (`hud.js`)

**Files:** Create `public/src/nowhere/hud.js`(순수 계산 + DOM — 위경도 · 고도 · 방위 · 8방위 · 방위 띠 눈금 · 건물 표시 자리, 1 초 10 번 갱신), Modify `main.js`(만들기 · update · H 키 · 숨김 조건), `nowhere.css`(방위 띠, 휴대폰), `help.js`, `README.md`. Test 새 `tests/nowhere-hud.test.mjs`.
**확인:** 성수 · 산악 외관(자유 · 보행) 좌표 줄 · 방위 띠(HAUS · FaceArch 방향이 화면 속 실제 건물 쪽인지 캡처로), 실내 층 줄, H 끄기, 휴대폰.

### Task 2: 사진 모드 (`photo.js`)

**Files:** Create `public/src/nowhere/photo.js`(도구 줄 · 화각 · PNG 저장 · 링크 복사 · 파일 이름 · 링크 주소 순수 함수 — 링크는 entry.js 의 같은 자리 주소 함수와 같은 형식에 time · weather), Modify `main.js`(C 키 · 위 막대 `사진` 버튼 — `.nw-top-actions` 에 목록 버튼처럼 넣기 · 막힘 조건 · 렌더 직후 캡처 훅), `nowhere.css`(body.is-photo 로 화면 요소 숨김), `help.js`, `README.md`. Test 새 `tests/nowhere-photo.test.mjs`.
**확인:** 저장된 PNG 크기 · 내용(화면과 같음, UI 없음), 링크 열면 같은 구도 · 기상 · 시각, 실내 링크 이유 문구, 닫으면 화각 복원, 휴대폰.

### Task 3: 발표 모드 (`kiosk.js`)

**Files:** Create `public/src/nowhere/kiosk.js`(순서 상태 기계 순수 + 실행기 — 프리셋 → 실내 층 둘러보기 → 밖 → 반대 월드), Modify `entry.js`(`kiosk=1` → 인트로 뒤 자유 시점, 방식 고르기 없음), `main.js`(K 키 · 시작 · 아무 입력 멈춤 · replaceState), `interior.js`(층 둘러보기 시작 · 끝 알림을 밖에서 쓸 수 있게 — 필요한 만큼만), `nowhere.css`(칩), `help.js`, `README.md`. Test 새 `tests/nowhere-kiosk.test.mjs`.
**확인:** `?kiosk=1` 로 한 바퀴 일부(프리셋 2 개 → 실내 들어가 둘러보기 시작 — 시간을 줄이는 시험용 매개변수 `kioskShot=` 허용), 입력 멈춤, K 시작 · 멈춤, 반대 월드 주소.
