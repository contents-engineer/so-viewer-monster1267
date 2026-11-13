# 같은 자리, 다른 세계 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. 스펙: `docs/superpowers/specs/2026-11-13-nowhere-same-spot-world-design.md`.

**Goal:** 건물 기록 카드에서 "이 자리 그대로" 반대 월드로 넘어가 같은 위치 · 시선 · 방식으로 이어 본다.

## Global Constraints

- 위 막대 월드 버튼 동작(새 월드 인트로부터)은 바꾸지 않는다.
- 상수 한곳: `SAME_SPOT_FADE_MS = 600`, 좌표 반올림 소수 둘째 자리, 장면 한계 ±2000 m.
- 바로가기 값 `at` · `look` 은 인트로를 막는다(resolveEntry). 지울 값: `cam` · `weather` · `time` · `noIntro`.
- 월드 이름은 위 막대 글자(`성수 2041` · `DS2 산악`), 조사는 받침에 맞춰(`성수 2041로` · `DS2 산악으로`).
- 구현자는 git add · commit 하지 않는다. 브라우저 확인은 playwriter MCP 만, 대화상자는 먼저 가로챈다. 사용자에게 보이는 문구는 자연스러운 한국어.

---

### Task 1: 같은 자리 월드 전환

**Files:**
- Modify: `public/src/nowhere/entry.js` — `at` 이 있으면 바로가기(`deep`), `parsePose(params)` → `{ at: [x,y,z], look: [x,y,z] } | null`(숫자 셋 · ±2000 m 안, look 이 없으면 null), `sameSpotUrl({ pathname, search, targetVer, mode, at, look })` → 주소(지금 월드 전환의 경로 규칙을 함수로 옮겨 두 곳이 같이 쓴다), `withRo(name)`(받침 있으면 `으로`, 없으면 `로`; ㄹ 받침은 `로`).
- Modify: `public/src/nowhere/archive-card.js` — 카드에 버튼(`이 자리 그대로 ${withRo(반대 월드 이름)}`), 누르면 `onSameSpot()`.
- Modify: `public/src/nowhere/main.js` — `onSameSpot`: 페이드(`fade.fadeTo(true, '<지금> → <반대>', SAME_SPOT_FADE_MS)`) 뒤 `sameSpotUrl` 로 이동(보행이면 look = 시선 방향 10 m 앞). 시작 흐름: `parsePose` 가 있으면 방식 적용 뒤 보행 `placeWalk` · 자유 `placeAt`. 위 막대 월드 버튼은 `sameSpotUrl` 없이 지금 그대로(경로 규칙만 공유).
- Modify: `nowhere.css`(카드 버튼 줄 — 세 버튼, 휴대폰 44 px, 가로 휴대폰에서도 보이게), `help.js`(건물 카드 줄 한 구절 — 1600 × 900 배치 유지), `README.md`.
- Test: `tests/nowhere-entry.test.mjs`(at 바로가기 · parsePose · sameSpotUrl · withRo), 연결 정규식, help 시험.

**확인:** 브라우저 1600 × 900 — 성수 자유 시점 HAUS 앞(카드) → 같은 자리 산악 → 위치 · 시선 차, 방식 유지; 보행 같은 자리(보행 유지, 지형 높이); 산악 → 성수; 위 막대 월드 버튼은 인트로; 휴대폰 390 × 844 카드 버튼. 캡처 `build/nowhere/compare/samespot-*.png`.
