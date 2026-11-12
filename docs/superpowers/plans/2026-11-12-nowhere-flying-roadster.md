# 성수 2041 날으는 로드스터 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 뚝섬로를 달리던 흰 쐐기형 로드스터 두 대가 20초에 한 번씩 분사로 떠올라 배럴 롤(A) · 정차 포드를 넘는 킥플립 점프(B)를 하게 해, 성수 2041 거리에 놀라움을 더한다.

**Architecture:** 지금 이동체 파이프라인을 그대로 쓴다. Blender `future.py` 가 차체(`NWF_mover` 한 장) · 분사(모양 키 2 개) · 정차 포드를 짓고, 시간표를 키 목록으로 만들어 `layout.movers`(kind `roadster`)로 내보낸다. 웹은 순수 함수 `roadsterPose`(movers.js)로 키 사이를 보간만 하고, `world.js` 가 피벗에 자세(머리 방향 → 들림 → 진행 방향 축 롤)와 분사 길이를 놓는다. 기기 구분(`quality.js`)이 휴대폰에서 로드스터 · 분사 · 정차 포드를 뺀다.

**Tech Stack:** Blender 5.3(헤드리스 빌드 + MCP 라이브 Blender `look`), three.js r170(정적 vendor, import map), glTF + meshopt + WebP(`@gltf-transform/cli@4.1.1`), Node `node:test`, playwriter MCP(브라우저 확인), `npm start`(정적 서버 :4173).

**Spec:** `docs/superpowers/specs/2026-11-12-nowhere-flying-roadster-design.md`

## Global Constraints

- **기준 문서:** 스펙이 기준이다. 시간표 값은 스펙 §3 대로 "구현 중 화면을 보며 조정"하고, 조정 뒤에는 `future.py` 의 표(`RD_A` · `RD_B`)가 기준이다. 바꾼 값은 보고서에 전 · 후로 적는다.
- **차:** "테슬라 로드스터(2026 공개형)를 닮은 흰 쐐기형 2인승 쿠페. 로고 · 'RDSTR' 등 상표 글자는 넣지 않는다". 글자 객체 · 글자 텍스처를 만들지 않는다.
- **대수 · 동작:** 2대. **A 날아가기**(이륙 → 배럴 롤 → 지붕 너머로 사라짐), **B 점프 착지**(정차 포드 2대를 뛰어넘으며 킥플립 → 착지 → 계속 주행).
- **장소:** 거리 시점(`street`, 인트로가 끝나는 자리, three (−105, 1.7, 50.2)) 앞 뚝섬로. 서행 바깥 차로 Blender y −37.125(three z 37.125), 동 → 서.
- **주기:** 20초에 한 번(차마다 40초 주기, 서로 20초 어긋남) → `period: 40`, `phase` 0 · 20 s.
- **기기:** 데스크톱 · 태블릿 표시, 휴대폰 제외. 등급은 지금처럼 태블릿 · 휴대폰 모두 `mobile`(같은 모바일 자산). `&tier=tablet` = 모바일 등급 + 태블릿(시험용), `&tier=mobile` 은 휴대폰으로 본다.
- **월드:** 성수 2041 전용. DS2(`ver=ds2`, `public/assets/nowhere-ds2/**`)는 바꾸지 않는다.
- **모델:** `FU_roadster_a` · `FU_roadster_b` 는 차체 한 메시(차체 · 캐노피 · 휠 · 라이트 줄 · 리어 윙 · 노즐), 길이 4.4 m · 폭 1.95 m · 높이 1.15 m, 앞 = 로컬 +X, 삼각형 ≤ 3,000, 재질 `NWF_mover` 한 장 → 그리기 1. `FU_roadster_a_plume` · `FU_roadster_b_plume` 은 뒤 노즐 4 + 바닥 4곳 흰 반투명 원뿔 한 메시(삼각형 ≤ 400), 재질 `NWF_plume`(흰색, 투명, 그림자 없음, 깊이 쓰기 없음), 차체의 자식, 분사할 때만 보임 → 그리기 1(보일 때만). `FU_parked_pod.0` · `.1` 은 기존 포드 모양 복제(인스턴스, 그리기 1), 보행 장애물로 막힌다.
- **바퀴:** 따로 돌리지 않는다. 휠에 회전 흐림 무늬를 그려 둔다. 이동체는 단일 사용자 메시 규칙을 지킨다(gltf-transform `--instance` 가 같은 메시 노드 이름을 지운다). 정차 포드만 인스턴스로 합친다.
- **분사:** `thrust > 0.02` 일 때만 보이고 길이를 `thrust` 에 비례시킨다.
- **예산(화면 = 그림자 패스를 뺀 main pass):**

  | 등급 | 그리기 | 삼각형 | 기준 시점 |
  |---|---|---|---|
  | 데스크톱 | ≤ 300 (지금 최악 + 최대 5) | ≤ 2.0 M | street · future · aerial |
  | 태블릿 | ≤ 186 | ≤ 0.92 M | 같음(로드스터 두 대 · 분사 · 정차 포드가 모두 보이는 최악 시각 포함) |
  | 휴대폰 | ≤ 180 (지금 178 그대로) | ≤ 0.9 M (지금 898,927 그대로) | 같음 |

- **성능:** FPS ≥ 60(데스크톱 · `&tier=tablet`, 전원 연결 — `pmset -g batt` 로 확인). 전송량 증가 ≤ 0.3 MB.
- **경로 여유:** 로드스터 경로를 0.1 s 간격으로 표본화해 `layout.solids` 와 비행 중 3 m, 주행 중 0.7 m 이상(정차 포드를 뛰어넘는 구간 포함), 지상 카메라와 수평 1.5 m 이상.
- **좌표:** Blender (x, y, z) → three (x, z, −y). 이 문서의 배치 값은 따로 적지 않으면 Blender 좌표(m)다. `layout.json` 과 테스트는 three 좌표다. 각도: Blender `rotation_euler.z` = three `rotation.y`(같은 값).
- **범위 밖(스펙 §7):** 소리, 문이 열리는 동작, 바퀴 회전 메시, 보행자 반응, DS2 월드, 사용자가 로드스터를 조종하거나 타는 기능. 히어로 렌더 WebP 다시 만들기도 이번에는 하지 않는다.
- **문구:** UI 문구 · 주석은 한국어(기존 파일 문체 — '·' 구분, 존댓말 없는 설명체). 식별자는 영어.
- **브랜치:** `feat/flying-roadster`(컨트롤러가 main 에서 만든다).
- **서브에이전트 모델은 Claude 5.5 이상만:** Blender 태스크(3 · 4 · 7)는 `opus`, 웹 · 브라우저 태스크(1 · 2 · 5 · 6)와 태스크 리뷰는 `sonnet`, 최종 리뷰는 `opus`.
- **git:** 구현자는 `git add` · `git commit` · 브랜치 전환을 하지 않는다. 컨트롤러가 리뷰를 통과한 태스크의 파일만 경로로 스테이징하고 커밋 메시지 안을 사용자에게 보인다. 커밋은 사용자가 요청할 때만. `git add -A` · `git add .` 금지. 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **브라우저:** playwriter MCP(`mcp__playwriter__execute`)만 쓴다. 실패하면 보고하고 playwright MCP 로 바꾸지 않는다. 페이지를 열거나 새로 고칠 때마다 `window.confirm` · `alert` · `prompt` 를 기록 함수로 바꾼다(`page.on('dialog')` 에 기대지 않는다). 각 호출 시작에 `evaluate` 가 3 s 안에 돌아오는지 확인하고, 기다림은 한 호출 3 s 이하로 나눈다.
- **Blender MCP(라이브 Blender):** `get_addon_status` 를 먼저 부른다. 셰이더 노드는 이름이 아니라 종류로 찾는다(`n.type == 'BSDF_PRINCIPLED'`). 재질 색은 셰이더 노드 입력에 넣는다(`material.diffuse_color` 는 뷰포트만). 열거값은 하드코딩하지 않고 읽어서 쓴다. 라이브 파일은 저장하지 않고 다른 파일을 열지 않는다.
- **테스트:** `npm test` 전부 통과(시작 188 개).

---

## 1. 설계 정리(코드에서 확인한 값 · 정한 것)

### 1.1 차로와 주변(코드에서 확인)

| 항목 | 값(Blender) | 출처 |
|---|---|---|
| 뚝섬로 연석 안쪽 | y −35.75 / −48.25 | `future.py` `RLED_TT_Y` |
| 태양광 띠 가장자리 | y −43.05 / −40.95 | `RLED_TT_Y` |
| 동행 포드 | `pod_e1` · `pod_e2` y −46.875, `pod_l*` 고리 안쪽 동행 y −43.625 | `POD_ROUTES` · `POD_LOOP` |
| 서행 포드 | `pod_w1` y −40.375 | `POD_ROUTES` |
| **로드스터 차로** | **y −37.125(서행 바깥)** — 연석에서 1.375 m, `pod_w1` 과 3.25 m(차체 반폭 0.975 + 0.925 → 틈 1.35 m) | 스펙 §3 |
| 스마트 횡단보도 | x −16.5 … −11.5(`XW` −14, `CW` 2.5) | `future.py:64` |
| HAUS 상자 | x ±25.15, y ±25.9, 높이 81 → 차로에서 11.2 m | `layout.solids` `HAUS` |
| 북측 저층 벽돌(A 가 넘는 지붕) | F3 x −59 … −49 높이 5.66, F2 x −80 … −62.5 높이 8.4, F1 x −99.5 … −84 높이 13.8, M2 · M1 높이 10.1 · 11.4 | `layout.solids` |
| 차로 가까운 solid | 키오스크 `FU_kiosk_glass.0`(x −95.9, 차로에서 2.37 m), 스카이브리지 SB2 기둥(x 129.6, 3.2 m), SB2 상판 아래 9.46 m | `layout.solids` |
| 거리 카메라 | three (−105, 1.7, 50.2) → (−30, 5, 31), 세로 FOV 39.76° | `layout.cameras` |
| 노면 근접 카메라 `ground` | three (−26.4, 3, 39.6) — 로드스터 차로에서 수평 2.475 m(차체 옆면까지 1.5 m). B 는 이 x 에서 공중(약 4.8 m)이라 높이 조건으로 검사에서 빠진다 | `layout.cameras` |
| HAUS 정문 스팟 | three (0, z 40) — 차로에서 2.875 m(걷기 확인 자리) | `walk-spots.js` `haus_entrance` |
| 노면 높이 | 장면 안 `GR_road`(`_road_base`), 밖 −0.12(`TT_FAR_Z`) | `future.py` |

### 1.2 시간표 초기값(스펙 §3 → 계산)

차 원점은 **롤 축**(바퀴 아래에서 `RD_AXIS` 0.55 m 위, 차 가운데)이다. 키의 `pos` 는 이 축의 자리라서 롤 · 킥플립이 차 몸통 가운데를 축으로 돈다. 주행 중 키 높이 = 노면 + 0.55.

| 구간 | A 날아가기(위상 0) | B 점프 착지(위상 20 s) |
|---|---|---|
| 등장 | τ 0, x +160, 22 m/s 서진 | 같음 |
| 분사 시작 | τ 6.818, x +10(HAUS 앞) | τ 8.091, x −18(횡단보도 바로 서쪽) |
| 공중 | 0.4 s 상승(가속 서진 3 m/s² · 상승 6 m/s²) → τ 7.218 … 8.418 롤 0 → 2π. 롤은 같은 차로 위(HAUS 에서 11 m)에서 하고, HAUS 서쪽 끝을 지난 x −29 부터 3차 Hermite 로 북서쪽 지붕 너머(6 s, 롤 끝 속도 → (−55, 30, 12) m/s) | 포물선, 바퀴 높이 최고 6 m(τ 8.773, x −33), 공중 1.364 s. 킥플립 τ 8.273 … 9.273(꼭대기 ±0.5 s) |
| 끝 | τ 14.418, 고도 90 m · (−300, 70) 에서 숨김 | τ 9.455 x −48 착지(마지막 0.3 s 를 바닥 분사로 받쳐 내려오는 속도 0) → 서진 → τ 19.091 x −260 숨김 |
| 분사 | 1(뒤 + 바닥) τ 6.918 … 8.418 → 0.5(바닥 끔, 뒤만) τ 8.918 → 0 τ 14.418 | 이륙 τ 8.091 … 8.391(1) → 8.541(0), 착지 τ 9.205 … 9.455(1 → 0.6) → 9.555(0) |
| 보이는 시각(절대) | 0 … 14.418(+40 n) | 20 … 39.091(+40 n) — **두 대가 함께 보이는 시각은 없다** |

- 정차 포드: `FU_parked_pod.0` (−30, −36.9), `.1` (−36, −36.9), 서쪽을 본다(rz π). 같은 차로의 연석 쪽(연석 −35.75 에서 0.225 m). B 는 두 포드 위를 바퀴 높이 5.3 m 이상으로 넘는다(원점 → 포드 지붕 4.2 m ≥ 3 m).
- 거리 시점에서 A 의 이륙 · 롤은 화면 가운데 약간 위(방위 6 … 10°, 거리 80 … 115 m)에서 보이고, 롤 끝 1 s 뒤 화면 위 왼쪽 지붕 너머로 나간다. B 는 57 … 87 m 앞에서 점프 · 착지한 뒤 카메라 옆 13 m 를 지나간다.

### 1.3 키 형식과 보간(`layout.movers`, three 좌표)

```js
{ id: 'roadster_a', kind: 'roadster', object: 'FU_roadster_a', plume: 'FU_roadster_a_plume',
  origin: [x, y, z], yaw0: 3.141593,          // Blender 원점 · 방위(피벗) — 첫 키 자리
  period: 40, phase: 0,                       // 초. B 는 phase 20
  visible: [t0, t1],                          // 주기 안 시각(초) = 첫 · 끝 키 시각
  keys: [{ t, pos: [x, y, z], yaw?, roll?, pitch?, thrust? }, …] }
```

- **위치(`pos`)는 모든 키에 있다.** Blender 가 해석식을 표본화한다(주행 1 s, 이륙 ~ 롤 · 점프 0.05 s, A 상승 비행 0.1 s 간격).
- **채널(`yaw` · `roll` · `pitch` · `thrust`)은 그 값을 정하는 키(시간표 사건)에만 있다.** 첫 · 끝 키는 네 채널을 모두 가진다. 촘촘한 위치 키마다 채널을 두면 키마다 smoothstep 기울기가 0 이 되어 롤이 끊겨 보이기 때문이다.
- 웹 `roadsterPose(def, time)`: 주기 안 시각 τ = (time − phase) mod period. 위치는 키 시각을 반영한 Catmull-Rom(이웃 키 차분 접선의 3차 Hermite — 간격이 같으면 균일 Catmull-Rom 장력 0.5 와 같고, 등속 직선은 그대로 직선), 채널은 그 채널이 있는 키들 사이를 선형 + smoothstep. 롤은 누적 각도(0 → 2π).
- 각도 약속(three): `yaw` = `rotation.y`(앞 = 로컬 +X 의 방위, 서쪽 = π), `pitch` = 차의 옆축(로컬 z) 회전(+ 코가 위), `roll` = 차의 앞 = 진행 방향 축(로컬 x) 회전. 피벗 회전 순서 `'YZX'`.

### 1.4 분사 길이(모양 키)

- 분사 메시의 기본 모양은 노즐 자리에 접힌 원뿔(길이 0.02 m — 안 보인다). 모양 키 `rear`(뒤 노즐 4, 최대 2.4 m) · `bottom`(바닥 4, 최대 2.0 m)이 최대 길이다. glTF morph target 으로 나가고 웹이 영향을 정한다.
- `plumeMorph(thrust)` → `{ rear: thrust, bottom: max(0, 2·thrust − 1) }`. thrust 1 = 뒤 · 바닥 모두 최대, 0.5 = 뒤만 절반. A 가 롤 뒤 0.5 → 0 으로 줄이면 스펙의 "뒤 노즐만 서서히 줄임"이 된다.
- 웹은 `NWF_plume` 을 흰 `MeshLambertMaterial`(UV v 를 따라 노즐 0.75 → 끝 0 으로 옅어지는 알파, 투명, 깊이 쓰기 없음, 양면, 그림자 없음)로 바꾼다. Lambert 라 밤에는 거리 조명만큼만 보인다.

### 1.5 기기 구분과 휴대폰 제외

- `detectDeviceClass(env)` → `'desktop' | 'tablet' | 'phone'`(스펙 §4 규칙). `resolveTier(?tier, env)` → `{ tier, device }`. `getQualityConfig(tier, worldVer, device)` 에 `device` · `roadsters: device !== 'phone'`. `device` 를 안 주면 등급에서 정한다(mobile → phone, desktop → desktop).
- 휴대폰: `world.js` 가 `FU_roadster*` · `FU_parked_pod*` 메시를 병합 전에 숨긴다(→ 그리기 0, 보행 장애물 격자는 숨긴 메시를 건너뛴다). 로드스터 액터를 만들지 않는다.
- 데스크톱 · 태블릿: 차체 · 분사는 이동체(정적 병합 · 보행 장애물에서 빠짐), 정차 포드는 정적 메시(같은 `NWF_mover` 버킷으로 병합 → `NW_Merged_future_NWF_mover`, 보행 장애물).

### 1.6 예산 계산(초기 모양)

| 항목 | 그리기 | 삼각형 |
|---|---|---|
| 차체 1 대 | 1 | 약 740(≤ 3,000) |
| 분사 1 대(보일 때만) | 1 | 256(≤ 400) |
| 정차 포드 2 대(인스턴스 → 병합) | 1 | 2 × 592 |
| **최악(두 대 + 분사 둘 + 정차 포드)** | **+5** | **약 +3.2 K** |

태블릿: 모바일 최악 178 / 898,927 + 5 / 3.2 K ≈ 183 / 0.902 M ≤ 186 / 0.92 M. 데스크톱: 지금 최악 + 5 ≤ 300(지금 최악은 준비 단계에서 잰다). 두 대가 함께 보이는 시각은 없지만, 측정은 두 대를 붙잡아(위상 고정) 함께 보이게 하고 화면 밖 컬링까지 꺼서 상한을 잰다(Task 6).

## 2. 파일 구조

| 파일 | 책임 | 태스크 |
|---|---|---|
| `public/src/nowhere/quality.js` | `detectDeviceClass` · `resolveTier` · `getQualityConfig(…, device)` 의 `device` · `roadsters` | 1 |
| `public/src/nowhere/main.js` | `?tier=` → `resolveTier`, `createWorld({ device })`, `getStats().device` | 1 |
| `public/src/nowhere/world.js` | `createWorld` 의 `device`(1). 로드스터 액터 · 분사 재질 · 롤 · 휴대폰 숨김 · `MOVER_NODE` · `ROADSTER_ONLY`(5) | 1, 5 |
| `public/src/nowhere/movers.js` | `roadsterLocalTime` · `roadsterPose` · `plumeMorph` · `PLUME_MIN`, `MOVER_KINDS` 에 `roadster` | 2 |
| `tools/nowhere/blender/future.py` | 차체 · 분사 · 정차 포드 · 휠 아틀라스 칸(3), 시간표 · 이동체 행(4), CP 조정(7) | 3, 4, 7 |
| `tools/nowhere/blender/export.py` | `keys[].pos` 를 three 좌표로 | 4 |
| `public/assets/nowhere/**`(빌드 산출물) | future GLB(데스크톱 · 모바일) · `layout.json` | 3, 4, 7 |
| `tests/nowhere-quality.test.mjs` | (u)(v)(w) | 1 |
| `tests/nowhere-movers.test.mjs` | (f)–(j) 순수, (e) 수정 · (k) 레이아웃 | 2, 4 |
| `tests/nowhere-future-layout.test.mjs` | (l) 로드스터 GLB, (m) 정차 포드, (n) world.js 정규식 | 3, 5 |
| `tests/nowhere-clearance.test.mjs` | (f) 로드스터 경로 여유 · 카메라 | 4 |
| `tests/nowhere-assets.test.mjs` | (i) 전송량 증가 ≤ 0.3 MB | 4 |
| `README.md` | 성수 소개 · `?tier=tablet` · 히어로 캡처 시각 메모 | 7 |
| `build/nowhere/scratch/roadster_shape.py`(git 무시) | 라이브 Blender 시안 모양 | 3, 7 |
| `build/nowhere/compare/roadster-*.png` · `roadster-*.json`(git 무시) | 캡처 · 측정 | 준비, 6, 7 |

## 3. 실행 방식

### 3.1 시작 전 준비(컨트롤러가 직접)

```bash
git switch feat/flying-roadster 2>/dev/null || (git switch main && git switch -c feat/flying-roadster)   # main 에서 만든 브랜치(이미 있으면 그대로)
mkdir -p build/nowhere/scratch build/nowhere/compare
lsof -i :4173 || (npm start > /tmp/nw-serve.log 2>&1 &)
npm test 2>&1 | tail -4      # Expected: "# pass 188", "# fail 0"
```

지금 모습의 예산을 잰다(로드스터 전 기준). playwriter 로 아래를 차례로 실행하고, 결과를 `build/nowhere/compare/roadster-before.json` 으로 남긴다(데스크톱 · `&tier=mobile` 두 번, DS2 거리 한 번).

```js
// (1) 열기 + 대화상자 바꾸기 — 한 호출
state.page = context.pages().find((p) => p.url().startsWith('http://localhost:4173')) ?? (await context.newPage()); await state.page.setViewportSize({ width: 1600, height: 900 }); await state.page.goto('http://localhost:4173/nowhere?noIntro=1&cam=street&time=14', { waitUntil: 'domcontentloaded' }); await state.page.evaluate(() => { window.__dialogs = []; window.confirm = (m) => (window.__dialogs.push(m), true); window.alert = (m) => { window.__dialogs.push(m); }; window.prompt = (m) => (window.__dialogs.push(m), null); }); console.log(state.page.url());
```

```js
// (2) 준비될 때까지 이 호출을 되풀이한다('ready' 가 나올 때까지, 한 번 2.5 s)
await state.page.waitForFunction(() => Boolean(window.__NW_APP), null, { timeout: 2500 }).then(() => 'ready', () => 'wait')
```

```js
// (3) 3 s 기다린 뒤(기상 전환) 시점별 그리기 · 삼각형 — 시점마다 evaluate 한 번(1.2 s)
const r = []; for (const id of ['street', 'future', 'aerial']) r.push(await state.page.evaluate(async (id) => { const app = window.__NW_APP; app.setCameraPreset(id, true); await new Promise((res) => setTimeout(res, 1200)); const s = app.getStats(); return { id, tier: s.tier, calls: s.calls, tris: s.triangles }; }, id)); const fs = require('node:fs'); fs.mkdirSync('/tmp/nw-roadster', { recursive: true }); fs.writeFileSync('/tmp/nw-roadster/before-desktop.json', JSON.stringify(r, null, 2)); console.log(JSON.stringify(r));
```

`&tier=mobile`(→ `before-mobile.json`)과 `http://localhost:4173/nowhere-mountain?noIntro=1&cam=street&time=14`(→ `before-ds2.json`, 시점은 `street` 하나)도 같은 방법으로 잰다. 마지막에 `cp /tmp/nw-roadster/before-*.json build/nowhere/compare/` 한다. 모바일 최악이 178 / 898,927 이 아니면 그 값을 기준으로 적고 보고한다. 데스크톱 최악 + 5 가 300 을 넘으면 Task 1 전에 사용자에게 알린다.

### 3.2 빌드 명령과 걸리는 시간(지난 기록)

| 목적 | 명령 | 시간 |
|---|---|---|
| 빠른 재구축(굽기 생략) | `npm run nowhere:build -- -- --rebuild --no-bake` | 약 27 s(2026-11-11 `fin-build-quick1.log`) |
| 전체 재구축(굽기 포함) | `npm run nowhere:build -- -- --rebuild` | 약 40 s("Done in 36.9 … 37.1 s" + Blender 기동). Cycles 정점 AO 는 정해진 접두어(`PR_static_` · `FU_bridge_` …)만 굽고 로드스터 · 정차 포드는 굽지 않는다 |
| 최적화 | `npm run nowhere:optimize` | 약 10 … 20 s(npx 가 처음 내려받으면 더 길다) |
| 테스트 | `npm test` | 1 s 안 |
| 라이브 Blender 시안 1 회 | MCP `execute_blender_code` + `look` 4 장 | 수 초 + `look` 한 장마다 수 초 |

- Blender 태스크는 Blender 가 하나라서 **순서대로만** 실행한다. 헤드리스 빌드는 `build/nowhere/nowhere.blend` 를 다시 쓴다. 라이브 Blender 에서 그 파일을 저장하지 않는다.
- 웹 모양 확인은 빠른 재구축 → 최적화 → playwriter. 전체 굽기는 Task 7 에서 한 번.

### 3.3 확인 지점(사용자) — CP

- **CP (Task 6 뒤, 마지막 조정 전):** 컨트롤러가 Task 6 보고서의 캡처(거리 6 장 · HAUS 정문 걷기 4 장 · 태블릿 2 장 · 밤 1 장)와 예산 · FPS 표를 한 페이지(Artifact, 지난 CP 비교 페이지와 같은 형식)로 묶어 사용자에게 보인다. 아래를 묻는다.
  1. 차 모양: 쐐기 비율, 캐노피, 리어 윙, 흰색 톤
  2. 동작 크기 · 빠르기: A 롤 1.2 s · 지붕 너머 상승, B 높이 6 m · 공중 1.36 s · 킥플립 1 s
  3. 분사 모양 · 밝기(낮 · 밤)
  4. 첫 등장 시각(지금은 페이지를 연 뒤 A 이륙 약 7 s, B 점프 약 28 s)
- 사용자 답을 이 절 아래에 "결과(날짜)"로 적고 Task 7 로 넘어간다. 바꿀 것이 없다는 답이면 Task 7 은 문서 · 전체 굽기 · 최종 리뷰만 한다.

- **결과(2026-11-12, 사용자 "추천대로"):** 페이지 https://claude.ai/artifact/BnTxU64nxggr3rd74fSnBF
  1. 차 모양 — 그대로.
  2. 동작 크기 · 빠르기 — 그대로(A 상승 중 코 들림 최대 11° 허용).
  3. 분사 — 바닥 분사를 더 옅고 부드럽게(끝까지 그라데이션, 최대 불투명도 낮춤). 밤 밝기는 그대로.
  4. 거리 시점 크기 — A 이륙 · 롤 자리와 정차 포드를 거리 시점(three (−105, 1.7, 50.2)) 쪽으로 당겨 40–60 m 안에서 일어나게 한다(여유 · 동시 등장 금지 규칙 유지).
  5. 예산 — 분사를 한 번에 그리게(`forceSinglePass` 또는 `FrontSide`) 바꿔 데스크톱 최악을 줄인다.
  6. FPS — 전원 연결 상태에서 다시 잰다(배터리면 사용자에게 알리고 기다린다).
  - 예산 정의(최종 리뷰 M2): 판정은 **그림자 패스를 뺀 화면(main pass)** 기준이다. 데스크톱 상한 300 은 그림자 포함 `getStats` 기준선 286 에서 나온 수치라, 그림자 포함으로 재면 자연 재생 최대 299 · 두 대를 붙잡은 상한이 순간 301 까지 오른다. main pass 로는 최악 185–199 이고 로드스터 증가분은 +5(계획과 같음).
  - 답과 상관없이: A 이륙 전 코 들림(τ 0–6.9 동안 피치 4.6° 까지 → 뒷바퀴 노면 아래 9.6 cm)을 고친다(피치는 이륙 직전에만).

- **결과 확정(2026-11-12, 사용자 "확정"):** 4번 반영 결과를 그대로 확정 — A 롤 가운데 47 m · B 이륙 52 m(띠 안), A 이륙 70 m · B 꼭대기 38 m(x −65 가로등 머리와 3 m · 같은 차로 정차 포드 넘기 제약으로 띠 밖), A 는 거리 카메라 위로 지나감, HAUS 정문 걷기 시점에서는 40–85 m. 최종 리뷰 수정으로 B 꼭대기 6.0 → 5.9 m(가로등 스마트 헤드와 3 m).

### 3.4 태스크 진행 규칙

- 서브에이전트 디스패치는 superpowers:subagent-driven-development 를 따른다. 태스크 브리프와 보고서는 파일로 주고받는다. 모델은 Global Constraints 대로.
- 구현자는 git 을 건드리지 않는다. 각 태스크 끝의 "스테이징(커밋하지 않음)"은 컨트롤러가 리뷰 뒤 실행할 명령과 커밋 메시지 안이다.
- Blender 형상은 정확한 상수 · 함수 계약 · 완료 기준을 준다. 모양은 라이브 Blender `look` 으로 맞추는 값이라, 처음 값은 이 문서의 코드이고 조정한 값은 보고서에 전 · 후로 적는다.
- 브라우저 확인은 playwriter 만 쓴다. 호출 시작마다 아래 한 줄로 3 s 안에 `evaluate` 가 돌아오는지 본다(막히면 대화상자가 떠 있는 것이다 — 보고하고 멈춘다).

```js
await Promise.race([state.page.evaluate(() => 1), new Promise((_, rej) => setTimeout(() => rej(new Error('evaluate 가 3 s 안에 돌아오지 않는다 — 대화상자?')), 3000))]);
```

---

## 4. 태스크

### Task 1: 기기 구분(데스크톱 · 태블릿 · 휴대폰) · `?tier=tablet`

**Files:**
- Modify: `public/src/nowhere/quality.js`(파일 전체)
- Modify: `public/src/nowhere/main.js:3`(import), `:39-44`(등급), `:111-121`(`createWorld` 호출), `:558-576`(`getStats`)
- Modify: `public/src/nowhere/world.js:23-30`(`createWorld` 인자)
- Test: `tests/nowhere-quality.test.mjs`(import 줄, (u)(v)(w) 추가)

**Interfaces:**
- Consumes: 지금 `detectQualityTier(env)`(그대로), `getQualityConfig(tier, worldVer)`
- Produces:
  - `detectDeviceClass(env = {}) → 'desktop' | 'tablet' | 'phone'`. env 키: `userAgent`, `maxTouchPoints`, `screenWidth`, `screenHeight`(없으면 `navigator` · `screen`)
  - `resolveTier(forced, env = {}) → { tier: 'desktop' | 'mobile', device }`(`forced` = 주소 `tier` 값)
  - `getQualityConfig(tier, worldVer, device = tier === 'mobile' ? 'phone' : 'desktop')` 반환에 `device`, `roadsters: device !== 'phone'`
  - `createWorld({ renderer, scene, tier, device, worldVer, onProgress })`, `app.getStats().device`

- [ ] **Step 1: 실패하는 테스트를 쓴다** — `tests/nowhere-quality.test.mjs`

import 줄을 바꾼다.

```js
import { detectQualityTier, detectDeviceClass, resolveTier, getQualityConfig } from '../public/src/nowhere/quality.js';
```

파일 끝에 더한다.

```js
// 기기 구분(날으는 로드스터: 데스크톱 · 태블릿 표시, 휴대폰 제외 — 스펙 §4)
const UA = {
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  ipadDesktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  androidTab: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  androidPhone: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 Chrome/125.0 Safari/537.36',
  win: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36',
  linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36',
};
const pickDevice = (q) => ({ tier: q.tier, device: q.device, roadsters: q.roadsters });

test('(u) detectDeviceClass: 태블릿(iPad 두 UA · 안드로이드 Mobile 없음 · 그 밖의 터치 600+) · 휴대폰 · 데스크톱', () => {
  const T = [
    [{ userAgent: UA.ipad, maxTouchPoints: 5, screenWidth: 820, screenHeight: 1180 }, 'tablet', 'iPad UA(Mobile/15E148 이 있어도 iPad 가 먼저)'],
    [{ userAgent: UA.ipadDesktop, maxTouchPoints: 5, screenWidth: 1024, screenHeight: 768 }, 'tablet', 'iPadOS 데스크톱 모드(Macintosh + 터치 2+)'],
    [{ userAgent: UA.androidTab, maxTouchPoints: 10, screenWidth: 800, screenHeight: 1280 }, 'tablet', '안드로이드 태블릿(UA 에 Mobile 없음)'],
    [{ userAgent: UA.androidPhone, maxTouchPoints: 5, screenWidth: 412, screenHeight: 915 }, 'phone', '안드로이드 휴대폰'],
    [{ userAgent: UA.iphone, maxTouchPoints: 5, screenWidth: 390, screenHeight: 844 }, 'phone', 'iPhone'],
    [{ userAgent: UA.mac, maxTouchPoints: 0, screenWidth: 1440, screenHeight: 900 }, 'desktop', '터치 없는 Mac'],
    [{ userAgent: UA.ipadDesktop, maxTouchPoints: 0, screenWidth: 1440, screenHeight: 900 }, 'desktop', '터치 없는 Safari Mac'],
    [{ userAgent: UA.win, maxTouchPoints: 0, screenWidth: 1920, screenHeight: 1080 }, 'desktop', 'Windows 데스크톱'],
    [{ userAgent: UA.linux, maxTouchPoints: 10, screenWidth: 1280, screenHeight: 800 }, 'tablet', '그 밖의 터치 기기 600+'],
    [{ userAgent: UA.linux, maxTouchPoints: 10, screenWidth: 360, screenHeight: 740 }, 'phone', '그 밖의 작은 터치 기기'],
    // 스펙 규칙대로 Windows 터치 노트북도 '그 밖의 터치 기기'라 tablet 이다 — 등급(detectQualityTier)은 desktop 그대로이고 로드스터도 보여 영향이 없다
    [{ userAgent: UA.win, maxTouchPoints: 10, screenWidth: 1920, screenHeight: 1080 }, 'tablet', 'Windows 터치 노트북'],
  ];
  for (const [env, want, label] of T) assert.equal(detectDeviceClass(env), want, label);
});

test('(v) resolveTier: ?tier=tablet = 모바일 등급 + 태블릿, mobile = 휴대폰, desktop = 데스크톱, 그 밖은 판정', () => {
  assert.deepEqual(resolveTier('tablet'), { tier: 'mobile', device: 'tablet' });
  assert.deepEqual(resolveTier('mobile'), { tier: 'mobile', device: 'phone' });
  assert.deepEqual(resolveTier('desktop'), { tier: 'desktop', device: 'desktop' });
  assert.deepEqual(
    resolveTier(null, { userAgent: UA.ipadDesktop, maxTouchPoints: 5, width: 1024, height: 768, screenWidth: 1024, screenHeight: 768 }),
    { tier: 'mobile', device: 'tablet' },
  );
  assert.deepEqual(
    resolveTier('', { userAgent: UA.iphone, maxTouchPoints: 5, width: 390, height: 844, screenWidth: 390, screenHeight: 844 }),
    { tier: 'mobile', device: 'phone' },
  );
  assert.deepEqual(
    resolveTier('weird', { userAgent: UA.mac, maxTouchPoints: 0, width: 1440, height: 900, deviceMemory: 8, screenWidth: 1440, screenHeight: 900 }),
    { tier: 'desktop', device: 'desktop' },
  );
});

test('(w) getQualityConfig: device · roadsters(휴대폰만 끔), device 를 안 주면 등급에서(모바일 → 휴대폰), 태블릿 · 휴대폰은 같은 모바일 자산', () => {
  assert.deepEqual(pickDevice(getQualityConfig('desktop', 'seongsu', 'desktop')), { tier: 'desktop', device: 'desktop', roadsters: true });
  assert.deepEqual(pickDevice(getQualityConfig('mobile', 'seongsu', 'tablet')), { tier: 'mobile', device: 'tablet', roadsters: true });
  assert.deepEqual(pickDevice(getQualityConfig('mobile', 'seongsu', 'phone')), { tier: 'mobile', device: 'phone', roadsters: false });
  assert.deepEqual(pickDevice(getQualityConfig('mobile')), { tier: 'mobile', device: 'phone', roadsters: false });
  assert.deepEqual(pickDevice(getQualityConfig('desktop')), { tier: 'desktop', device: 'desktop', roadsters: true });
  assert.equal(getQualityConfig('mobile', 'seongsu', 'tablet').assetDir, getQualityConfig('mobile', 'seongsu', 'phone').assetDir);
  assert.deepEqual(getQualityConfig('mobile', 'seongsu', 'tablet').heroUrls, getQualityConfig('mobile', 'seongsu', 'phone').heroUrls);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node --test tests/nowhere-quality.test.mjs`
Expected: FAIL — `SyntaxError: The requested module '../public/src/nowhere/quality.js' does not provide an export named 'detectDeviceClass'`

- [ ] **Step 3: `quality.js` 를 고친다** — 파일 전체를 아래로 바꾼다(`detectQualityTier` 본문은 그대로).

```js
// HAUS NOWHERE — 성수 2041: 기기 등급 판정(desktop / mobile) · 기기 구분(desktop / tablet / phone) 및 예산 설정.

const MOBILE_UA_RE = /Android|iPhone|iPad|iPod|Mobile|Windows Phone|BlackBerry|Opera Mini/i;
// 휴대폰 UA. 안드로이드는 따로 본다('Mobile' 이 있으면 휴대폰, 없으면 태블릿). iPad UA 에도 'Mobile/15E148' 이 있어 iPad 를 먼저 본다
const PHONE_UA_RE = /Mobi|iPhone|iPod|Windows Phone|BlackBerry|Opera Mini/i;

export function detectQualityTier(env = {}) {
  const ua =
    env.userAgent ??
    (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  const width =
    env.width ??
    (typeof window !== 'undefined' ? window.innerWidth : 1440);
  const height =
    env.height ??
    (typeof window !== 'undefined' ? window.innerHeight : 900);
  const deviceMemory =
    env.deviceMemory ??
    (typeof navigator !== 'undefined' ? navigator.deviceMemory : undefined);

  const maxTouchPoints =
    env.maxTouchPoints ??
    (typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0);

  if (MOBILE_UA_RE.test(ua)) return 'mobile';
  // iPadOS Safari 는 기본이 데스크톱 모드라 UA 에 iPad 대신 Macintosh 가 들어간다. 터치 Mac 은 없으니 터치 지점이 2 개 이상이면 아이패드다.
  if (/Macintosh/.test(ua) && maxTouchPoints > 1) return 'mobile';
  if (Math.min(width, height) <= 540 || width <= 768) return 'mobile';
  if (typeof deviceMemory === 'number' && deviceMemory <= 4) return 'mobile';
  return 'desktop';
}

/**
 * 기기 구분 — 날으는 로드스터를 휴대폰에서 빼는 데 쓴다(자산 등급은 detectQualityTier 그대로, 태블릿 · 휴대폰 모두 모바일 자산).
 *   태블릿: iPad(UA iPad, 또는 Macintosh + 터치 지점 2 개 이상 = iPadOS 데스크톱 모드), 안드로이드 중 UA 에 Mobile 이 없는 것,
 *           그 밖의 터치 기기 중 min(screen.width, screen.height) ≥ 600
 *   휴대폰: 그 밖의 모바일(Mobi · iPhone · Android … Mobile)과 화면이 600 보다 작은 터치 기기
 */
export function detectDeviceClass(env = {}) {
  const ua = env.userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  const maxTouchPoints = env.maxTouchPoints ?? (typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0) ?? 0;
  const screenW = env.screenWidth ?? (typeof screen !== 'undefined' ? screen.width : 1440);
  const screenH = env.screenHeight ?? (typeof screen !== 'undefined' ? screen.height : 900);
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)) return 'tablet';
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? 'phone' : 'tablet';
  if (PHONE_UA_RE.test(ua)) return 'phone';
  if (maxTouchPoints > 0) return Math.min(screenW, screenH) >= 600 ? 'tablet' : 'phone';
  return 'desktop';
}

/** 주소 ?tier= 와 기기 판정 → { tier, device }. tablet = 모바일 등급 + 태블릿(시험용), mobile = 휴대폰, desktop = 데스크톱, 그 밖(없음)은 판정 */
export function resolveTier(forced, env = {}) {
  if (forced === 'tablet') return { tier: 'mobile', device: 'tablet' };
  if (forced === 'mobile') return { tier: 'mobile', device: 'phone' };
  if (forced === 'desktop') return { tier: 'desktop', device: 'desktop' };
  return { tier: detectQualityTier(env), device: detectDeviceClass(env) };
}

export function getQualityConfig(tier = 'desktop', worldVer = 'seongsu', device = tier === 'mobile' ? 'phone' : 'desktop') {
  const ver = worldVer === 'ds2' ? 'ds2' : 'seongsu';
  const baseDir = ver === 'ds2' ? 'assets/nowhere-ds2' : 'assets/nowhere';
  // 주인공 건물: 데스크톱은 원본, 모바일은 텍스처를 1024 로 줄인 사본(npm run nowhere:heroes:mobile)
  const heroUrls =
    tier === 'mobile'
      ? { haus: 'assets/mobile/gm_building.glb', facearch: 'assets/mobile/facearch.glb' }
      : { haus: 'assets/gm_building.glb', facearch: 'assets/facearch.glb' };
  // 날으는 로드스터(성수): 데스크톱 · 태블릿만 — 휴대폰은 로드스터 · 분사 · 정차 포드를 그리지 않는다(world.js)
  const roadsters = device !== 'phone';
  if (tier === 'mobile') {
    return {
      tier: 'mobile',
      device,
      roadsters,
      worldVer: ver,
      baseDir,
      assetDir: `${baseDir}/mobile`,
      heroUrls,
      maskUrl: `${baseDir}/nowhere-ground-mask.webp`,
      layoutUrl: `${baseDir}/layout.json`,
      anchorsUrl: `${baseDir}/anchors.ko.json`,
      hdrUrl: null,
      rainCount: 1800,
      bloom: false,
      maxPixelRatio: 1.5,
      shadowMapSize: 1024,
      sunShadows: false,
      maxLabels: 6,
    };
  }
  return {
    tier: 'desktop',
    device,
    roadsters,
    worldVer: ver,
    baseDir,
    assetDir: baseDir,
    heroUrls,
    maskUrl: `${baseDir}/nowhere-ground-mask.webp`,
    layoutUrl: `${baseDir}/layout.json`,
    anchorsUrl: `${baseDir}/anchors.ko.json`,
    hdrUrl: `${baseDir}/sky-1k.hdr`,
    rainCount: 6000,
    bloom: true,
    maxPixelRatio: 1.75,
    shadowMapSize: 2048,
    sunShadows: true,
    maxLabels: 24,
  };
}
```

- [ ] **Step 4: `main.js` 를 고친다.**

`main.js:3`:

```js
import { resolveTier, getQualityConfig } from './quality.js';
```

`main.js:39-44`(`const forcedTier = …` 부터 `const quality = getQualityConfig(tier, worldVer);` 까지)를 바꾼다.

```js
  // 등급(자산 · 효과) + 기기 구분(날으는 로드스터는 휴대폰에서 뺀다). ?tier=desktop|tablet|mobile 로 강제 — tablet = 모바일 등급 + 태블릿(시험용)
  const { tier, device } = resolveTier(params.get('tier'));
  const quality = getQualityConfig(tier, worldVer, device);
```

`createWorld({` 호출에서 `tier,` 다음 줄에 `device,` 를 넣는다.

```js
  const world = await createWorld({
    renderer,
    scene,
    tier,
    device,
    worldVer,
```

`getStats()` 반환의 `tier: quality.tier,` 다음 줄에 넣는다.

```js
        device: quality.device,
```

- [ ] **Step 5: `world.js:23-30` 을 고친다.**

```js
export async function createWorld({
  renderer,
  scene,
  tier = 'desktop',
  device,
  worldVer = 'seongsu',
  onProgress = null,
}) {
  const quality = getQualityConfig(tier, worldVer, device);   // device 가 없으면 등급에서(모바일 → 휴대폰)
```

- [ ] **Step 6: 테스트를 실행한다.**

Run: `node --test tests/nowhere-quality.test.mjs && npm test 2>&1 | tail -4`
Expected: quality (a)(b)(s)(t)(u)(v)(w) PASS, 전체 `# pass 191`, `# fail 0`

Run: `rg -n "detectQualityTier" public/src`
Expected: `public/src/nowhere/quality.js` 의 정의 두 줄(`export function detectQualityTier` · `resolveTier` 안 호출)만

- [ ] **Step 7: 브라우저에서 확인한다(짧게).** 서버(:4173)가 없으면 `npm start` 를 백그라운드로 띄운다. playwriter 로 세 주소를 차례로 연다. 열 때마다 대화상자 함수를 바꾸고(§3.1 (1)), 준비될 때까지 2.5 s 호출을 되풀이한 뒤(§3.1 (2)) 아래를 읽는다.

```js
await state.page.evaluate(() => { const s = window.__NW_APP.getStats(); return { tier: s.tier, device: s.device, roadsters: window.__NW_APP.quality.roadsters }; })
```

| 주소 | Expected |
|---|---|
| `/nowhere?noIntro=1&cam=street&time=14` | `{ tier: 'desktop', device: 'desktop', roadsters: true }`(Mac Chrome) |
| `…&tier=tablet` | `{ tier: 'mobile', device: 'tablet', roadsters: true }` |
| `…&tier=mobile` | `{ tier: 'mobile', device: 'phone', roadsters: false }` |

`getLatestLogs({ page: state.page, sinceLastCall: true })` 에 오류가 없어야 한다.

- [ ] **Step 8: 스테이징(커밋하지 않음)** — 구현자는 실행하지 않는다. 컨트롤러가 리뷰 뒤 실행한다.

```bash
git add public/src/nowhere/quality.js public/src/nowhere/main.js public/src/nowhere/world.js tests/nowhere-quality.test.mjs
```

커밋 메시지 안: `feat(nowhere): 기기 구분(데스크톱 · 태블릿 · 휴대폰) · ?tier=tablet — 날으는 로드스터 준비`

---

### Task 2: 로드스터 자세 계산 `roadsterPose` · `plumeMorph`(순수)

**Files:**
- Modify: `public/src/nowhere/movers.js`(머리말 1줄, `MOVER_KINDS`, 끝에 추가)
- Test: `tests/nowhere-movers.test.mjs`(import 줄, 공용 시험 정의, (f)–(j) 추가)

**Interfaces:**
- Consumes: 없음(순수)
- Produces(Task 4 · 5 가 쓴다):
  - `MOVER_KINDS = ['drone', 'pod', 'train', 'bot', 'spin', 'roadster']`
  - `PLUME_MIN = 0.02`
  - `roadsterLocalTime(def, time) → τ`(0 ≤ τ < period)
  - `roadsterPose(def, time) → { visible: boolean, pos: [x, y, z] | null, yaw, pitch, roll, thrust }` — §1.3 의 def · 키 형식
  - `plumeMorph(thrust) → { rear, bottom }`(0 … 1)
  - 시험 파일 공용: `RD`(시험 정의), `CH = ['yaw', 'roll', 'pitch', 'thrust']`, `poseNear(p, q, e)`

- [ ] **Step 1: 실패하는 테스트를 쓴다** — `tests/nowhere-movers.test.mjs`

import 줄을 바꾼다.

```js
import {
  buildTrack, sampleTrack, moverDistance, headingYaw, moverPose, spinAngle, MOVER_KINDS,
  roadsterPose, roadsterLocalTime, plumeMorph, PLUME_MIN,
} from '../public/src/nowhere/movers.js';
```

파일 끝에 더한다.

```js
// ───────────── 날으는 로드스터(roadsterPose) — 시험 정의(three 좌표)
// 0 → 4 s 등속 서진(22 m/s), 4 → 4.5 s 분사 켜짐, 4.5 → 5.7 s 롤 0 → 2π, 10 s 끝. 위치는 모든 키, 채널은 그 값을 정하는 키에만(첫 · 끝 키는 모두)
const RD = {
  id: 'rd_test', kind: 'roadster', object: 'FU_roadster_t', plume: 'FU_roadster_t_plume', period: 40, phase: 20, visible: [0, 10],
  keys: [
    { t: 0, pos: [100, 0.5, 37], yaw: Math.PI, roll: 0, pitch: 0, thrust: 0 },
    { t: 2, pos: [56, 0.5, 37] },
    { t: 4, pos: [12, 0.5, 37], thrust: 0 },
    { t: 4.5, pos: [1, 1.5, 37], thrust: 1, roll: 0 },
    { t: 5.7, pos: [-26, 6, 37], roll: 2 * Math.PI, thrust: 1, pitch: 0.2 },
    { t: 10, pos: [-120, 40, 0], yaw: 2.6, roll: 2 * Math.PI, pitch: 0.2, thrust: 0 },
  ],
};
const CH = ['yaw', 'roll', 'pitch', 'thrust'];
function poseNear(p, q, e = 1e-9) {
  assert.equal(p.visible, q.visible);
  if (!p.visible) return;
  p.pos.forEach((v, c) => assert.ok(near(v, q.pos[c], e), `pos ${c}: ${v} ≠ ${q.pos[c]}`));
  for (const ch of CH) assert.ok(near(p[ch], q[ch], e), `${ch}: ${p[ch]} ≠ ${q[ch]}`);
}

test('(f) roadsterPose: 보이는 구간 밖은 숨김, 안은 보임(위상 20 s · 주기 40 s 반영)', () => {
  for (const time of [19.9, 30.01, 45, 59.99]) {
    const p = roadsterPose(RD, time);
    assert.equal(p.visible, false, `time ${time}`);
    assert.deepEqual(p, { visible: false, pos: null, yaw: 0, pitch: 0, roll: 0, thrust: 0 });
  }
  for (const time of [20, 23, 30, 60, 63]) assert.equal(roadsterPose(RD, time).visible, true, `time ${time}`);
  assert.equal(roadsterLocalTime(RD, 63), 3);
  assert.ok(near(roadsterLocalTime(RD, 19), 39, 1e-12));
});

test('(g) roadsterPose: 키 시각에서 위치 · 채널이 키 값과 같고, 등속 직선 구간은 그대로 직선이다', () => {
  for (const k of RD.keys) {
    const p = roadsterPose(RD, 20 + k.t);
    p.pos.forEach((v, c) => assert.ok(near(v, k.pos[c], 1e-9), `t ${k.t} pos ${c}: ${v}`));
    for (const ch of CH) if (k[ch] !== undefined) assert.ok(near(p[ch], k[ch], 1e-12), `t ${k.t} ${ch}: ${p[ch]}`);
  }
  for (const t of [0.5, 1, 1.5]) {
    const p = roadsterPose(RD, 20 + t);
    assert.ok(near(p.pos[0], 100 - 22 * t, 1e-9) && near(p.pos[1], 0.5, 1e-12) && near(p.pos[2], 37, 1e-12), `t ${t}: ${p.pos}`);
  }
  for (const t of [2.7, 3.3]) {
    const p = roadsterPose(RD, 20 + t);   // 이웃 키 차분 접선이 모두 −22 m/s → x 는 정확히 직선
    assert.ok(near(p.pos[0], 100 - 22 * t, 1e-9) && near(p.pos[2], 37, 1e-12), `t ${t}: ${p.pos}`);
  }
});

test('(h) roadsterPose: 롤은 누적 각도 — 롤 키 사이에서 0 → 2π 로 부드럽게(가운데 π) 늘고, 끝나면 정확히 2π 에 머문다', () => {
  const roll = (t) => roadsterPose(RD, 20 + t).roll;
  assert.equal(roll(4.5), 0);
  assert.ok(near(roll(5.1), Math.PI, 1e-12), `가운데 ${roll(5.1)}`);
  let prev = -1;
  for (let i = 0; i <= 24; i++) {
    const r = roll(4.5 + i * 0.05);
    assert.ok(r >= prev - 1e-12, `롤이 줄어든다 @ ${4.5 + i * 0.05}`);
    prev = r;
  }
  for (const t of [5.7, 8, 10]) assert.ok(near(roll(t), 2 * Math.PI, 1e-12), `t ${t}: ${roll(t)}`);
  assert.ok(roll(4.55) - roll(4.5) < roll(5.15) - roll(5.1), 'smoothstep: 시작은 느리고 가운데가 빠르다');
});

test('(i) roadsterPose: 분사는 분사 키 사이에서만 — 켜기 전 0, 켜지는 가운데 0.5, 켠 동안 1, 끝에서 0', () => {
  const th = (t) => roadsterPose(RD, 20 + t).thrust;
  assert.equal(th(3), 0);
  assert.ok(near(th(4.25), 0.5, 1e-12));
  assert.equal(th(5), 1);
  assert.ok(near(th(7.85), 0.5, 1e-9));
  assert.equal(th(10), 0);
  assert.ok(th(3) <= PLUME_MIN && th(5) > PLUME_MIN);
});

test('(j) 주기 · 위상: 40 s 마다 같은 자세, 위상 0 · 20 s 두 차는 20 s 어긋난다 · plumeMorph(뒤 = thrust, 바닥 = 0.5 넘는 부분)', () => {
  const A = { ...RD, phase: 0 };
  for (const t of [1, 4.7, 5.1, 9.5]) {
    poseNear(roadsterPose(A, t), roadsterPose(A, t + 40));
    poseNear(roadsterPose(RD, t + 20), roadsterPose(A, t));
  }
  assert.equal(roadsterPose(RD, 4.7).visible, false, '위상 20 s 차는 τ 24.7 → 숨김');
  assert.deepEqual(plumeMorph(0), { rear: 0, bottom: 0 });
  assert.deepEqual(plumeMorph(0.5), { rear: 0.5, bottom: 0 });
  assert.deepEqual(plumeMorph(0.75), { rear: 0.75, bottom: 0.5 });
  assert.deepEqual(plumeMorph(1), { rear: 1, bottom: 1 });
  assert.deepEqual(plumeMorph(1.3), { rear: 1, bottom: 1 });
  assert.deepEqual(plumeMorph(-0.2), { rear: 0, bottom: 0 });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node --test tests/nowhere-movers.test.mjs`
Expected: FAIL — `does not provide an export named 'roadsterPose'`

- [ ] **Step 3: `movers.js` 를 고친다.**

1행 머리말:

```js
// HAUS NOWHERE — 성수 2041: 경로 이동체(드론 · 자율주행 포드 · 튜브 열차 · 배송로봇 · 풍력 회전자 · 날으는 로드스터)의 순수 계산.
```

`MOVER_KINDS`:

```js
export const MOVER_KINDS = ['drone', 'pod', 'train', 'bot', 'spin', 'roadster'];
```

파일 끝에 더한다.

```js
// ───────────── 날으는 로드스터(2026-11-12): layout.movers kind 'roadster'. Blender future.py 시간표를 키로 받아 보간만 한다
// def = { id, kind: 'roadster', object, plume, origin, yaw0, period: 40, phase: 초, visible: [t0, t1], keys: [{ t, pos: [x, y, z], yaw?, roll?, pitch?, thrust? }] }
// pos 는 모든 키에, 채널(yaw · roll · pitch · thrust)은 그 값을 정하는 키에만 있다(첫 · 끝 키는 모두). 각도는 three 와 같다:
// yaw = rotation.y(앞 = 로컬 +X 의 방위), pitch = 차의 옆축(로컬 z) 회전(+ 코가 위), roll = 차의 앞 = 진행 방향 축(로컬 x) 누적 회전(0 → 2π)

export const PLUME_MIN = 0.02;   // 분사 세기가 이 값 이하면 분사 메시를 숨긴다

function smooth01(u) {
  const x = Math.min(1, Math.max(0, u));
  return x * x * (3 - 2 * x);
}

/** 주기 안 시각(초): (time − phase) 를 period 로 감는다. 위상 20 s 인 차는 위상 0 인 차보다 20 s 늦게 같은 동작을 한다. */
export function roadsterLocalTime(def, time) {
  const P = def.period;
  return (((time - (def.phase || 0)) % P) + P) % P;
}

/** 채널 값: 그 채널이 있는 키들 사이를 선형 + smoothstep(양 끝 기울기 0). 범위 밖은 끝 키 값. */
function channelAt(keys, name, t) {
  let a = null;
  let b = null;
  for (const k of keys) {
    if (k[name] === undefined) continue;
    if (k.t <= t) a = k;
    else {
      b = k;
      break;
    }
  }
  if (!a) return b ? b[name] : 0;
  if (!b) return a[name];
  return a[name] + (b[name] - a[name]) * smooth01((t - a.t) / (b.t - a.t));
}

/** 키 i 의 접선(m/s): 이웃 두 키의 차분(양 끝은 한쪽 차분). */
function keyTangent(keys, i) {
  const a = keys[Math.max(0, i - 1)];
  const b = keys[Math.min(keys.length - 1, i + 1)];
  const dt = b.t - a.t;
  return [0, 1, 2].map((c) => (b.pos[c] - a.pos[c]) / dt);
}

/** 위치: 키 시각을 반영한 Catmull-Rom(이웃 키 차분 접선의 3차 Hermite). 간격이 같으면 균일 Catmull-Rom(장력 0.5), 등속 직선은 그대로 직선. */
function positionAt(keys, t) {
  const n = keys.length;
  if (n === 1) return keys[0].pos.slice();
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (keys[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const k0 = keys[lo];
  const k1 = keys[hi];
  const h = k1.t - k0.t;
  const u = Math.min(1, Math.max(0, (t - k0.t) / h));
  const m0 = keyTangent(keys, lo);
  const m1 = keyTangent(keys, hi);
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  return [0, 1, 2].map((c) => h00 * k0.pos[c] + h10 * h * m0[c] + h01 * k1.pos[c] + h11 * h * m1[c]);
}

/** 로드스터 자세 → { visible, pos, yaw, pitch, roll, thrust }. 보이는 구간 밖이면 visible false(pos null, 나머지 0). */
export function roadsterPose(def, time) {
  const t = roadsterLocalTime(def, time);
  const [t0, t1] = def.visible;
  if (t < t0 || t > t1) return { visible: false, pos: null, yaw: 0, pitch: 0, roll: 0, thrust: 0 };
  const K = def.keys;
  return {
    visible: true,
    pos: positionAt(K, t),
    yaw: channelAt(K, 'yaw', t),
    pitch: channelAt(K, 'pitch', t),
    roll: channelAt(K, 'roll', t),
    thrust: channelAt(K, 'thrust', t),
  };
}

/** 분사 세기 → 분사 메시 모양 키 영향(0 … 1): 뒤 노즐 = thrust(길이 비례), 바닥 = 0.5 넘는 부분만(2·thrust − 1).
 *  A 가 롤 뒤 0.5 → 0 으로 줄이면 뒤 노즐만 남아 서서히 짧아진다(스펙 §3). */
export function plumeMorph(thrust) {
  const t = Math.min(1, Math.max(0, thrust));
  return { rear: t, bottom: Math.max(0, 2 * t - 1) };
}
```

- [ ] **Step 4: 테스트를 실행한다.**

Run: `node --test tests/nowhere-movers.test.mjs && npm test 2>&1 | tail -4`
Expected: movers (a)–(j) PASS((e)는 아직 레이아웃에 로드스터가 없어 그대로 통과), 전체 `# pass 196`, `# fail 0`

- [ ] **Step 5: 스테이징(커밋하지 않음)** — 컨트롤러가 리뷰 뒤 실행한다.

```bash
git add public/src/nowhere/movers.js tests/nowhere-movers.test.mjs
```

커밋 메시지 안: `feat(nowhere): 날으는 로드스터 자세 계산 roadsterPose · plumeMorph(시각 반영 Catmull-Rom · 채널 smoothstep)`

---

### Task 3: 로드스터 모델 · 분사 · 정차 포드(라이브 Blender 로 모양 잡기 → `future.py`)

**Files:**
- Create(git 무시): `build/nowhere/scratch/roadster_shape.py`
- Modify: `tools/nowhere/blender/future.py`
  - 머리말 "만드는 것" 목록에 (9) 한 줄
  - `paint_mover`(휠 원판 칸), `MOVER_WHEEL` · `_paint_wheel`(새), `mover_atlas`(휠 분기)
  - `materials()`(`M['wheel']` · `M['plume']`)
  - 새 절 `(9) 날으는 로드스터` — `# ═══ 이동체 표(Task 11, §4.4) ═══` 줄 바로 위
  - `build()`(`taxis = build_taxis(…)`, `build_roadsters` · `build_parked_pods` 호출)
- Test: `tests/nowhere-future-layout.test.mjs`((l)(m) 추가)
- 산출물: `public/assets/nowhere/nowhere-future.glb`, `public/assets/nowhere/mobile/nowhere-future.glb`, `public/assets/nowhere/layout.json`(solids 에 정차 포드)

**Interfaces:**
- Consumes: `future.py` 의 `MB`(`T` 변환, `face` · `box` · `cyl` · `to_mesh`), `UI['red']`, `mover_atlas`, `taxi_mesh(M)`, `obj(…)`, `_road_base(gz, x, y)`, `_assert_unique`, `lib.set_uv` · `lib.write_mask_values` · `lib._make_render_color`, `TAG`, `smoothstep`, `srgb`
- Produces(Task 4 · 5 가 쓴다):
  - 상수 `RD_AXIS = 0.55`, `RD_LANE_Y = -37.125`, `RD_SHOW_X = 160.0`, `RD_CARS = [('FU_roadster_a', 1.0), ('FU_roadster_b', 0.97)]`, `PARKED_PODS`, `PARKED_POD_Y = -36.9`
  - Blender 객체: `FU_roadster_a` · `FU_roadster_b`(부모 없음, 자리 (160, −37.125, 노면 + 0.55), rz π, 재질 `NWF_mover` 하나), 자식 `FU_roadster_a_plume` · `FU_roadster_b_plume`(로컬 단위 변환, 재질 `NWF_plume`, 모양 키 `Basis` · `rear` · `bottom`), `FU_parked_pod.0` · `.1`(공유 메시 `FU_parked_pod`, `nw_solid=1`)
  - GLB: 노드 `FU_roadster_a/b`(자식 분사 노드), 메시 `FU_parked_pod` 인스턴스 2
  - `layout.solids`: `FU_parked_pod.0` · `FU_parked_pod.1`

- [ ] **Step 1: 라이브 Blender 상태를 본다(MCP).**
  - `mcp__blender__get_addon_status` → Blender 버전 · 애드온 일치를 적는다. 연결이 안 되면 보고하고 멈춘다.
  - `mcp__blender__get_scene_info(fields=["settings"])` → 열린 파일 · 엔진을 적는다.
  - `mcp__blender__execute_blender_code`:

```python
import bpy
print(bpy.app.version_string, '|', bpy.data.filepath or '(저장 안 된 새 파일)', '| dirty', bpy.data.is_dirty,
      '| NW 장면', bpy.data.collections.get('NW_future') is not None)
```

  - 규칙: 라이브 파일을 저장하지 않고(`wm.save_mainfile` 금지) 다른 파일을 열지 않는다. 시안은 `SCR_roadster` 컬렉션에만 만들고 Step 6 에서 지운다.

- [ ] **Step 2: 실패하는 테스트를 쓴다** — `tests/nowhere-future-layout.test.mjs` 끝에 더한다(같은 파일의 `glbJson` · `solid` 를 쓴다).

```js
// 날으는 로드스터(2026-11-12): GLB 노드 아래 삼각형 수(인덱스 / 3). skip(자식 노드)이 참이면 그 자식은 세지 않는다
function subtreeTris(j, idx, skip) {
  const n = j.nodes[idx];
  let tris = 0;
  if (n.mesh !== undefined) {
    for (const p of j.meshes[n.mesh].primitives) {
      tris += (p.indices !== undefined ? j.accessors[p.indices].count : j.accessors[p.attributes.POSITION].count) / 3;
    }
  }
  for (const c of n.children || []) if (!skip(j.nodes[c])) tris += subtreeTris(j, c, skip);
  return tris;
}
// 차체 노드는 자식(분사)이 있어 optimize 의 위치 양자화가 메시를 이름 없는 자식 노드로 옮긴다 → 메시가 달린 노드를 찾는다
const meshNodeOf = (j, idx) =>
  j.nodes[idx].mesh !== undefined ? j.nodes[idx] : (j.nodes[idx].children || []).map((c) => j.nodes[c]).find((c) => !c.name && c.mesh !== undefined);
const FUTURE_GLBS = ['../public/assets/nowhere/nowhere-future.glb', '../public/assets/nowhere/mobile/nowhere-future.glb'];

test('(l) 날으는 로드스터: future GLB(데스크톱 · 모바일)에 차체 FU_roadster_a · b(NWF_mover 한 장, ≤ 3,000 삼각형)와 자식 분사(NWF_plume, ≤ 400, 모양 키 rear · bottom)', () => {
  for (const rel of FUTURE_GLBS) {
    const j = glbJson(rel);
    const idx = (name) => j.nodes.findIndex((n) => n.name === name);
    for (const car of ['FU_roadster_a', 'FU_roadster_b']) {
      const ci = idx(car);
      const pi = idx(`${car}_plume`);
      assert.ok(ci >= 0 && pi >= 0, `${rel}: ${car} · ${car}_plume 없음`);
      assert.ok((j.nodes[ci].children || []).includes(pi), `${rel}: ${car}_plume 이 ${car} 의 자식이 아니다`);
      const body = subtreeTris(j, ci, (c) => Boolean(c.name));   // 이름 있는 자식(분사)은 빼고, 양자화가 만든 이름 없는 메시 자식은 센다
      const plume = subtreeTris(j, pi, () => true);
      assert.ok(body > 0 && body <= 3000, `${rel}: ${car} 삼각형 ${body}`);
      assert.ok(plume > 0 && plume <= 400, `${rel}: ${car}_plume 삼각형 ${plume}`);
      const bm = j.meshes[meshNodeOf(j, ci).mesh];
      assert.equal(bm.primitives.length, 1, `${rel}: ${car} 프리미티브 ${bm.primitives.length}(재질 한 장 = 그리기 1)`);
      assert.equal(j.materials[bm.primitives[0].material].name, 'NWF_mover');
      const pm = j.meshes[j.nodes[pi].mesh];
      assert.equal(j.materials[pm.primitives[0].material].name, 'NWF_plume');
      assert.equal(pm.primitives[0].targets?.length, 2, `${rel}: ${car}_plume 모양 키 ${pm.primitives[0].targets?.length}`);
      assert.deepEqual(pm.extras?.targetNames ?? ['rear', 'bottom'], ['rear', 'bottom']);   // 이름이 없으면 웹은 Blender 순서(0 rear · 1 bottom)를 쓴다
    }
  }
});

test('(m) 정차 포드: layout.solids 에 FU_parked_pod.0 · .1(서행 바깥 차로 연석 쪽, x −30 · −36), future GLB 에 메시 FU_parked_pod 인스턴스 2', () => {
  for (const [id, x] of [['FU_parked_pod.0', -30], ['FU_parked_pod.1', -36]]) {
    const b = solid(id);
    assert.ok(b, `${id} 없음`);
    const cx = (b.min[0] + b.max[0]) / 2;
    const cz = (b.min[2] + b.max[2]) / 2;
    assert.ok(Math.abs(cx - x) <= 0.5 && Math.abs(cz - 36.9) <= 0.3, `${id} 가운데 (${cx}, ${cz})`);
    assert.ok(b.max[1] <= 1.9 && b.min[2] >= 35.75, `${id} 지붕 ${b.max[1]} · 연석 쪽 ${b.min[2]}`);
  }
  for (const rel of FUTURE_GLBS) {
    const j = glbJson(rel);
    const mi = j.meshes.findIndex((m) => m.name === 'FU_parked_pod');
    assert.ok(mi >= 0, `${rel}: 메시 FU_parked_pod 없음`);
    let count = 0;
    for (const n of j.nodes) {
      if (n.mesh !== mi) continue;
      const inst = n.extensions?.EXT_mesh_gpu_instancing;
      count += inst ? j.accessors[Object.values(inst.attributes)[0]].count : 1;
    }
    assert.equal(count, 2, `${rel}: 정차 포드 ${count} 대`);
  }
});
```

Run: `node --test tests/nowhere-future-layout.test.mjs`
Expected: (l) FAIL `FU_roadster_a · FU_roadster_a_plume 없음`, (m) FAIL `FU_parked_pod.0 없음`, 나머지 PASS

- [ ] **Step 3: 시안 모양 파일을 쓴다** — `build/nowhere/scratch/roadster_shape.py`. 이 파일은 `future.py` 를 실행한 이름공간(`MB` · `UI` · `lib` · `TAG` · `Vector` · `Matrix` · `bmesh` · `math`)에서 `exec` 된다. Step 4 에서 값을 조정하고, Step 7 에서 조정된 파일 전체를 `future.py` 로 옮긴다.

```python
# ═════════════════════════════ (9) 날으는 로드스터(2026-11-12 스펙 §2) ═════════════════════════════
# 1980 년대풍 흰 쐐기형 2인승 쿠페(독자 디자인 — 로고 · 상표 글자 없음). 앞 = 로컬 +x. 원점 = 롤 축(바퀴 아래에서 RD_AXIS 위, 차 가운데)이라
# 배럴 롤 · 킥플립이 몸통 가운데를 축으로 돈다. 모양은 라이브 Blender(MCP look)에서 맞춘 값이다(Task 3).
RD_AXIS = 0.55                              # 바퀴 아래 → 원점(롤 축). layout.movers 키 pos 는 이 축의 자리
RD_FLOOR_Z = 0.16                           # 몸통 아래면(바퀴 아래 기준)
RD_SIDE = [   # 몸통 단면(앞 → 뒤): (x, 아래 z, 덮개(후드 · 데크) z, 반폭). 코 끝이 가장 낮고 뒤로 갈수록 높아지는 쐐기
    (2.20, 0.30, 0.52, 0.70), (2.12, 0.22, 0.60, 0.86), (1.90, 0.18, 0.70, 0.94), (1.50, 0.16, 0.76, 0.97),
    (1.00, 0.16, 0.81, 0.975), (0.50, 0.16, 0.85, 0.975), (0.00, 0.16, 0.87, 0.975), (-0.60, 0.16, 0.89, 0.975),
    (-1.20, 0.16, 0.90, 0.975), (-1.70, 0.18, 0.91, 0.97), (-2.05, 0.22, 0.92, 0.95), (-2.20, 0.28, 0.90, 0.92),
]
RD_CANOPY = [   # 어두운 유리 캐노피(앞유리 밑 → 지붕 → 뒤창 끝): (x, 덮개 위 높이, 위 반폭). 아래 가장자리 반폭은 RD_CANOPY_BASE
    (0.95, 0.00, 0.80), (0.55, 0.13, 0.72), (0.15, 0.23, 0.64), (-0.25, 0.25, 0.62), (-0.65, 0.22, 0.62), (-1.05, 0.13, 0.66), (-1.45, 0.00, 0.80),
]
RD_CANOPY_BASE = 0.86
RD_WHEEL = dict(r=0.34, w=0.24, y=0.985, x=(1.42, -1.38), n=16)   # 바퀴 반지름 · 폭 · 바깥면 |y| · 앞뒤 축 x · 둘레 분할(돌리지 않는다)
RD_ARCH = (0.01, 0.05)                      # 바퀴집 검은 테(바퀴 반지름 + 안 · 바깥)
RD_WING = dict(x=(-2.18, -1.80), y=0.92, z=(1.10, 1.14), strut_x=-1.98, strut_y=0.55)   # 펼친 리어 윙 판 · 지주 2
RD_TAIL_LIGHT = dict(z=(0.74, 0.78), y=0.86)                     # 꼬리 가는 빨간 줄(UI 빨강 칸 — 밤에 켜진다)
RD_NOZZLES = [(-0.54, 0.30), (-0.18, 0.30), (0.18, 0.30), (0.54, 0.30)]   # 번호판 아래 냉가스 노즐 4: (y, z), x −2.17 → −2.26
RD_FLOOR_JETS = [(1.10, -0.55), (1.10, 0.55), (-1.20, -0.55), (-1.20, 0.55)]   # 바닥 분사구 4: (x, y)
PLUME_SEG = 8                               # 분사 원뿔 둘레 분할
PLUME_R = (0.05, 0.16, 0.34)                # 노즐 · 길이 40 % · 끝 반지름(최대 길이일 때)
PLUME_LEN = (2.4, 2.0)                      # 최대 길이: 뒤 노즐 · 바닥 분사구(분사 1)
PLUME_STUB = 0.02                           # 기본 모양 길이(노즐 자리에 접힌 원뿔 — 안 보인다)


def _rd_deck(x):
    """덮개(후드 · 데크) 높이 z 를 RD_SIDE 에서 선형 보간."""
    S = RD_SIDE
    if x >= S[0][0]:
        return S[0][2]
    for a, b in zip(S, S[1:]):
        if b[0] <= x <= a[0]:
            return a[2] + (b[2] - a[2]) * (a[0] - x) / (a[0] - b[0])
    return S[-1][2]


def _rd_ring(x, zb, zt, w):
    """몸통 단면 고리 12 점(앞에서 보아 반시계: 아래 가운데 → +y 옆 → 위 가운데 → −y 옆)."""
    h = [(0.0, zb), (0.80 * w, zb), (w, zb + 0.10), (w, zt - 0.07), (0.94 * w, zt - 0.015), (0.50 * w, zt)]
    pts = h + [(0.0, zt + 0.01)] + [(-y, z) for y, z in reversed(h[1:])]
    return [(x, y, z) for y, z in pts]


def _rd_canopy_ring(x, hc, wt):
    """캐노피 단면 5 점(아래가 열린 고리, 덮개 위 0.005): +y 아래 → +y 위 → 가운데 → −y 위 → −y 아래."""
    z0 = _rd_deck(x) + 0.005
    zt = z0 + hc
    b = RD_CANOPY_BASE
    return [(x, y, z) for y, z in ((b, z0), (wt, zt), (0.0, zt + (0.01 if hc > 0 else 0.0)), (-wt, zt), (-b, z0))]


def roadster_mb():
    """로드스터 차체(MB). 재질 번호: 0 흰 차체, 1 UI(빨간 줄), 2 검정(타이어 · 바닥 · 문턱 · 노즐 · 지주 · 바퀴집), 3 어두운 유리(캐노피), 4 휠 원판.
    바퀴 아래 = z 0 으로 짓고 MB.T 로 RD_AXIS 만큼 내려 원점이 롤 축에 오게 한다. 바깥을 보는 면 = [앞 단면 k, 뒤 단면 k, 뒤 k+1, 앞 k+1]."""
    mb = MB()
    mb.T = Matrix.Translation((0.0, 0.0, -RD_AXIS))
    seg_mat = [2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2]                 # 단면 고리 마디별 재질(아래 · 문턱 검정)
    rings = [_rd_ring(x, zb, zt, w) for x, zb, zt, w in RD_SIDE]
    n = len(rings[0])
    for A, B in zip(rings, rings[1:]):
        for k in range(n):
            k1 = (k + 1) % n
            mb.face([A[k], B[k], B[k1], A[k1]], seg_mat[k])
    mb.face(rings[0], 0)                                            # 코 끝 면(+x)
    mb.face(list(reversed(rings[-1])), 0)                           # 꼬리 면(−x)
    for (xa, ha, wa), (xb, hb, wb) in zip(RD_CANOPY, RD_CANOPY[1:]):   # 캐노피(어두운 유리)
        A = _rd_canopy_ring(xa, ha, wa)
        B = _rd_canopy_ring(xb, hb, wb)
        for k in range(len(A) - 1):
            mb.face([A[k], B[k], B[k + 1], A[k + 1]], 3)
    W = RD_WHEEL
    for wx in W['x']:
        for side in (1, -1):
            yo = side * W['y']
            yi = side * (W['y'] - W['w'])
            mb.cyl((wx, yi, W['r']), (wx, yo, W['r']), W['r'], W['r'], W['n'], 2, caps=(False, False))   # 타이어(검정)
            ang = [2 * math.pi * i / W['n'] for i in range(W['n'])]
            ring = [(wx + W['r'] * math.cos(a), yo, W['r'] + W['r'] * math.sin(a)) for a in ang]
            uv = [(0.5 + 0.48 * math.cos(a), 0.5 + 0.48 * math.sin(a)) for a in ang]
            if side > 0:                                            # 각이 커지는 순서(x → z)는 −y 를 본다 → +y 쪽은 거꾸로
                ring.reverse()
                uv.reverse()
            mb.face(ring, 4, uv)                                    # 바깥 원판(회전 흐림 무늬 — mover_atlas 가 휠 칸으로)
            ra, rb = W['r'] + RD_ARCH[0], W['r'] + RD_ARCH[1]
            ya = side * 0.978
            for i in range(8):                                      # 바퀴집 검은 테(위 반원)
                a0, a1 = math.pi * i / 8, math.pi * (i + 1) / 8
                q = [(wx + ra * math.cos(a0), ya, W['r'] + ra * math.sin(a0)), (wx + ra * math.cos(a1), ya, W['r'] + ra * math.sin(a1)),
                     (wx + rb * math.cos(a1), ya, W['r'] + rb * math.sin(a1)), (wx + rb * math.cos(a0), ya, W['r'] + rb * math.sin(a0))]
                mb.face(q if side > 0 else list(reversed(q)), 2)
    wg = RD_WING
    for sy in (1, -1):                                              # 윙 지주(검정)
        y = sy * wg['strut_y']
        zb = _rd_deck(wg['strut_x'])
        mb.box((wg['strut_x'] - 0.03, y - 0.02, zb - 0.02), (wg['strut_x'] + 0.03, y + 0.02, wg['z'][0]), 2)
    mb.box((wg['x'][0], -wg['y'], wg['z'][0]), (wg['x'][1], wg['y'], wg['z'][1]), 0)   # 윙 판(흰색)
    tl = RD_TAIL_LIGHT
    mb.box((-2.215, -tl['y'], tl['z'][0]), (-2.199, tl['y'], tl['z'][1]), 1, rect=UI['red'])   # 꼬리 가는 빨간 줄
    for y, z in RD_NOZZLES:                                         # 번호판 아래 냉가스 노즐 4(검정, 양 끝 막음)
        mb.cyl((-2.17, y, z), (-2.26, y, z), 0.05, 0.06, 8, 2)
    return mb


def _weld(me, dist=1e-4, sharp=40.0):
    """MB 메시는 면마다 정점을 따로 만든다 → 같은 자리 정점을 합쳐 매끈 음영이 이어지게(루프 UV · 재질 번호 · nw_mask 는 그대로)."""
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=dist)
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    me.set_sharp_from_angle(angle=math.radians(sharp))
    lib._make_render_color(me, 'nw_mask')
    return me


def plume_mesh(name, shade=1.0):
    """분사 기둥 한 메시: 뒤 노즐 4(−x) + 바닥 분사구 4(−z)의 흰 반투명 원뿔(고리 3 단 × 8 분할 → 삼각형 256).
    기본 모양 = 노즐 자리에 접힌 원뿔(PLUME_STUB), 모양 키 'rear' · 'bottom' = 최대 길이(웹이 thrust 로 늘인다 — movers.plumeMorph).
    UV v = 노즐 0 → 끝 1(glTF 는 v 를 뒤집어 웹에서는 노즐 1 → 끝 0 — world.js 분사 알파가 이 방향). → (메시, rear 좌표, bottom 좌표)"""
    base, rear, bottom, faces, uvs = [], [], [], [], []
    cones = [((-2.26, y, z), (-1.0, 0.0, 0.0), PLUME_LEN[0], 'rear') for y, z in RD_NOZZLES]
    cones += [((x, y, RD_FLOOR_Z - 0.01), (0.0, 0.0, -1.0), PLUME_LEN[1], 'bottom') for x, y in RD_FLOOR_JETS]
    for p0, axis, length, kind in cones:
        p0 = Vector(p0) - Vector((0.0, 0.0, RD_AXIS))
        ax = Vector(axis)
        t = ax.orthogonal().normalized()
        s = ax.cross(t)
        rings = []
        for f, r in ((0.0, PLUME_R[0]), (0.4, PLUME_R[1]), (1.0, PLUME_R[2])):
            ring = []
            for i in range(PLUME_SEG):
                a = 2 * math.pi * i / PLUME_SEG
                off = t * math.cos(a) + s * math.sin(a)
                stub = p0 + ax * (PLUME_STUB * f) + off * min(r, 0.06)
                full = p0 + ax * (length * f) + off * r
                base.append(tuple(stub))
                rear.append(tuple(full if kind == 'rear' else stub))
                bottom.append(tuple(full if kind == 'bottom' else stub))
                ring.append(len(base) - 1)
            rings.append((ring, f))
        for (ra, fa), (rb, fb) in zip(rings, rings[1:]):
            for i in range(PLUME_SEG):
                j = (i + 1) % PLUME_SEG
                faces.append((ra[i], ra[j], rb[j], rb[i]))
                uvs += [(i / PLUME_SEG, fa), ((i + 1) / PLUME_SEG, fa), ((i + 1) / PLUME_SEG, fb), (i / PLUME_SEG, fb)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(base, [], faces)
    me.validate(clean_customdata=False)
    lib.set_uv(me, 'UVMap', None, per_loop=uvs)
    lib.write_mask_values(me, [(0.0, 0.0, shade)] * len(me.vertices))
    me[TAG] = 1
    return me, rear, bottom


def _plume_keys(o, rear, bottom):
    """분사 객체에 모양 키(Basis · rear · bottom)를 단다. glTF morph target 0 = rear, 1 = bottom."""
    o.shape_key_add(name='Basis', from_mix=False)
    for nm, co in (('rear', rear), ('bottom', bottom)):
        k = o.shape_key_add(name=nm, from_mix=False)
        k.data.foreach_set('co', [c for p in co for c in p])
        k.value = 0.0
```

- [ ] **Step 4: 라이브 Blender 에서 시안을 만들고 `look` 으로 맞춘다(최소 2 회).** `mcp__blender__execute_blender_code` 로 아래를 실행한다(다시 실행하면 시안을 지우고 새로 만든다).

```python
import bpy, math
ROOT = '/Users/gm_yeonho/new-work/so/so-viewer-monster1267'
ns = {'__name__': 'nw_roadster_scratch'}
exec(open(f'{ROOT}/tools/nowhere/blender/future.py').read(), ns)            # 함수 · 상수만 읽는다(__main__ 이 아니라 build() 는 돌지 않는다)
exec(open(f'{ROOT}/build/nowhere/scratch/roadster_shape.py').read(), ns)    # 시안 모양
sc = bpy.context.scene
C = bpy.data.collections.get('SCR_roadster') or bpy.data.collections.new('SCR_roadster')
if C.name not in [c.name for c in sc.collection.children]:
    sc.collection.children.link(C)
for o in list(C.objects):
    bpy.data.objects.remove(o, do_unlink=True)
blend_ids = [i.identifier for i in bpy.types.Material.bl_rna.properties['surface_render_method'].enum_items]   # 열거값은 읽어서 쓴다

def smat(name, hexcol, emit=0.0, alpha=1.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bs = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')   # 노드는 이름이 아니라 종류로 찾는다(이름은 언어마다 다르다)
    col = ns['srgb'](hexcol)
    bs.inputs['Base Color'].default_value = col                             # 색은 셰이더 노드 입력에(material.diffuse_color 는 뷰포트에만 듣는다)
    bs.inputs['Emission Color'].default_value = col
    bs.inputs['Emission Strength'].default_value = emit
    bs.inputs['Alpha'].default_value = alpha
    if alpha < 1.0 and 'BLENDED' in blend_ids:
        m.surface_render_method = 'BLENDED'
    return m

mats = [smat('SCR_white', '#EEF1F2'), smat('SCR_red', '#E33739', 6.0), smat('SCR_black', '#121416'),
        smat('SCR_glass', '#0C1013'), smat('SCR_wheel', '#3A3E42')]
me = ns['_weld'](ns['roadster_mb']().to_mesh('SCR_roadster', mats))
car = bpy.data.objects.new('SCR_roadster', me)
C.objects.link(car)
car.location = (0.0, -37.125, ns['RD_AXIS'])          # 성수 장면이면 HAUS 앞 로드스터 차로 위(바퀴 아래 ≈ 노면)
car.rotation_euler = (0.0, 0.0, math.pi)              # 서쪽을 본다
pme, rear, bottom = ns['plume_mesh']('SCR_roadster_plume')
pme.materials.append(smat('SCR_plume', '#F2F5F6', 0.0, 0.45))
pl = bpy.data.objects.new('SCR_roadster_plume', pme)
C.objects.link(pl)
pl.parent = car
ns['_plume_keys'](pl, rear, bottom)
print('dims', tuple(round(d, 3) for d in car.dimensions), '| 차체 삼각형', sum(len(p.vertices) - 2 for p in me.polygons),
      '| 분사 삼각형', sum(len(p.vertices) - 2 for p in pme.polygons))
```

  Expected 출력(처음 값): `dims (4.46, 1.97, 1.14) | 차체 삼각형 740 | 분사 삼각형 256` 근처. 차체 ≤ 3,000, 분사 ≤ 400, 치수는 4.4 × 1.95 × 1.15 에서 ±0.07 m 안.

  `look` 으로 본다(Blender 보기 이름: `front` = −Y 에서 → 차의 옆모습, `right` = +X 에서 → 서쪽을 보는 차의 꼬리, `left` = −X 에서 → 코).

  1. 옆 · 위 · 3/4: `mcp__blender__look(mode="angles", target=["SCR_roadster"], views=["front", "top", "three_quarter"], shading="material", max_size=640)`
  2. 코 · 꼬리(빨간 줄 · 노즐 · 윙): `mcp__blender__look(mode="angles", target=["SCR_roadster"], views=["left", "right", [0.7, -0.6, 0.35]], shading="material", max_size=640)`
  3. 거리 시점 거리(약 70 m, 거리 카메라 쪽에서): `mcp__blender__look(mode="angles", target=["SCR_roadster"], views=[[-0.99, -0.12, 0.02]], distance=70, shading="material", max_size=480)`
  4. 분사(모양 키를 1 로 — `execute_blender_code`: `for k in bpy.data.objects['SCR_roadster_plume'].data.shape_keys.key_blocks[1:]: k.value = 1.0`): `mcp__blender__look(mode="angles", target=["SCR_roadster"], views=["front", "right"], shading="material", max_size=512)`. 본 뒤 값을 0 으로 되돌린다.

  레퍼런스 대조 목록(회마다 표로 적는다):
  - 길고 낮은 1980 년대 쐐기: 코 끝이 가장 낮고(바퀴 아래에서 약 0.5 m) 뒤로 갈수록 높아진다. 2인승 하드톱 비율(캐노피가 가운데 · 뒤, 앞유리 경사가 누워 있다).
  - 흰 차체 · 어두운 유리 캐노피 · 검은 휠(바퀴집 검은 테 안), 앞바퀴 위 테가 후드 선 위로 튀어나오지 않는다.
  - 꼬리: 거의 폭 전체의 가는 빨간 줄 한 줄, 번호판 자리 아래 노즐 4, 지주 2 개로 띄운 펼친 리어 윙.
  - 로고 · 글자 · 'RDSTR' 없음(글자 객체를 만들지 않는다).
  - 70 m 에서 "흰 쐐기 + 검은 캐노피 + 검은 바퀴"로 읽힌다.
  - 분사: 뒤 노즐에서 뒤로, 바닥에서 아래로 퍼지는 흰 원뿔, 차체를 뚫지 않는다.

  어긋나면 `roadster_shape.py` 의 상수(`RD_SIDE` · `RD_CANOPY` · `RD_WHEEL` · `RD_ARCH` · `RD_WING` · `PLUME_*`)를 고쳐 위 코드를 다시 실행한다. 무엇을 왜 바꿨는지 회마다 적는다.

- [ ] **Step 5: (성수 장면이 열려 있을 때만) 장면 안에서 본다.** Step 1 에서 `NW 장면 True` 였으면 `mcp__blender__look(mode="angles", target=["SCR_roadster"], views=[[-0.99, -0.12, 0.02], [0.2, -1.0, 0.3]], distance=40, shading="material", max_size=640)` 로 HAUS 앞 차로 위의 크기 · 색을 본다. 아니면 건너뛰고 보고서에 적는다.

- [ ] **Step 6: 라이브 Blender 의 시안을 지운다.**

```python
import bpy
C = bpy.data.collections.get('SCR_roadster')
if C is not None:
    for o in list(C.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.collections.remove(C)
for me in [m for m in bpy.data.meshes if m.name.startswith('SCR_') and m.users == 0]:
    bpy.data.meshes.remove(me)
for m in [m for m in bpy.data.materials if m.name.startswith('SCR_') and m.users == 0]:
    bpy.data.materials.remove(m)
print('남은 SCR_', [d.name for d in (*bpy.data.objects, *bpy.data.meshes, *bpy.data.materials) if d.name.startswith('SCR_')])
```

Expected: `남은 SCR_ []`

- [ ] **Step 7: `future.py` 로 옮긴다.**

  (a) 머리말 "만드는 것"의 `(7) FU_tower_T1 …` 항목 앞에 넣는다.

```python
#     (9) FU_roadster_a · b     날으는 로드스터 2 대(흰 쐐기형 2인승, NWF_mover 한 장, 원점 = 롤 축) + 자식 FU_roadster_*_plume(분사, NWF_plume,
#                               모양 키 rear · bottom), FU_parked_pod.0 · .1(B 가 뛰어넘는 정차 포드, 링크 복제 → 인스턴스, nw_solid=1)
```

  (b) `MOVER_PBR = …` 줄 아래에 넣는다.

```python
MOVER_WHEEL = (0.5, 0.75, 0.625, 0.875)   # 로드스터 휠 원판 칸(u0, v0, u1, v1): paint_mover 행 3 아래 절반의 빈 칸(128 px)


def _paint_wheel(alb, x0, y0, n):
    """휠 원판(n × n px, 아래 행부터): 검은 타이어 고리 · 짙은 회색 림 · 동심 흐림 띠(바퀴살이 돌며 번진 자국) · 밝은 허브. 바퀴는 돌리지 않는다(스펙 §2)."""
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    r = np.hypot(xx + 0.5 - n / 2, yy + 0.5 - n / 2) / (n / 2)              # 0 가운데 … 1 테두리
    tire, rim, blur, hub = (_hexs(h) for h in ('#141618', '#3A3E42', '#6A7075', '#9AA0A4'))
    band = (0.5 + 0.5 * np.cos(r * 40.0))[..., None]
    col = rim * (1.0 - 0.4 * band) + blur * 0.4 * band
    col = np.where((r > 0.78)[..., None], tire, col)
    col = np.where((r < 0.2)[..., None], hub, col)
    alb[y0:y0 + n, x0:x0 + n, :3] = col
```

  (c) `paint_mover` 의 `ta, te = _train_window_arrays()` 줄 바로 위에 넣고, docstring 의 행 3 설명 끝에 " · 행 3 아래 절반 u 0.5 … 0.625 = 로드스터 휠 원판(MOVER_WHEEL)"을 더한다.

```python
    _paint_wheel(alb, 2 * C, 3 * C, C // 2)                                   # 로드스터 휠 원판 칸(2026-11-12, 발광 없음)
```

  (d) `mover_atlas` 의 루프를 아래로 바꾼다(휠 분기를 더한다).

```python
        for li in p.loop_indices:
            if nm == 'NWF_train_window':
                u, v = uv[li].uv
                uv[li].uv = (u / 4.0, b0 + v * (b1 - b0))
            elif nm == 'NWF_wheel':                            # 로드스터 휠 원판: 원판 UV(0 … 1) → 휠 칸
                u, v = uv[li].uv
                w0, w1, w2, w3 = MOVER_WHEEL
                uv[li].uv = (w0 + u * (w2 - w0), w1 + v * (w3 - w1))
            else:
                uv[li].uv = MOVER_CELL[nm]
```

  (e) `materials()` 의 `M['mover']['nw_pbr'] = MOVER_PBR` 줄 아래에 넣는다.

```python
    # 날으는 로드스터(2026-11-12): 휠 원판 자리 표시(mover_atlas 가 NWF_mover 휠 칸으로 옮긴다 — 메시에 남지 않아 build() 끝에서 지워진다), 분사 기둥
    M['wheel'] = mat_basic('NWF_wheel', '#3A3E42', 0.5)
    M['plume'] = mat_glass('NWF_plume', '#F2F5F6', 0.45)
```

  (f) `# ═══ 이동체 표(Task 11, §4.4) ═══` 줄 바로 위에 새 절을 만든다. 먼저 **Step 4 에서 조정한 `roadster_shape.py` 전체**를 그대로 붙이고, 그 아래에 이어서 넣는다.

```python
RD_LANE_Y = -37.125                       # 뚝섬로 서행 바깥 차로(동 → 서). 이동 포드 pod_w1 은 −40.375(틈 1.35 m)
RD_SHOW_X = 160.0                         # 등장 x(두 차 같다) — Blender 자리 = 첫 키
RD_CARS = [('FU_roadster_a', 1.0), ('FU_roadster_b', 0.97)]   # (객체, 정점 AO 배율 — 사본 바이트를 달리해 dedup · instance 가 이름을 지우지 않게)
PARKED_PODS = [('FU_parked_pod.0', -30.0), ('FU_parked_pod.1', -36.0)]   # B 가 뛰어넘는 정차 포드(x)
PARKED_POD_Y = -36.9                      # 같은 차로의 연석 쪽(연석 −35.75, 포드 반폭 0.925)
PARKED_POD_SHADE = 0.86                   # 정점 AO 배율: 이동 포드 FU_taxi.0 … 4(1.0 … 0.9)와 겹치지 않게 — dedup 이 합치면 포드 이름이 지워진다


def roadster_mesh(M, name, shade=1.0):
    """차체 메시(NWF_mover 한 장 → 그리기 1). shade = 정점 AO 배율."""
    mats = [M['train_white'], M['ui'], M['black'], M['glass_dark'], M['wheel']]
    me = roadster_mb().to_mesh(name, mats, mask=lambda co: (0.0, 0.3, shade * (0.6 + 0.4 * smoothstep(-0.45, 0.5, co[2]))))
    return mover_atlas(_weld(me), M)


def build_roadsters(C, M, gz):
    """날으는 로드스터 2 대(스펙 §2): 차체 = 단일 사용자 메시, 분사 = 자식 객체(NWF_plume, 모양 키 rear · bottom).
    Blender 자리 = 첫 키(x RD_SHOW_X, 서행 바깥 차로, 노면 + RD_AXIS), 서쪽(rz π)을 본다 → layout.movers 의 origin · yaw0(Task 4)."""
    z = _road_base(gz, RD_SHOW_X, RD_LANE_Y) + RD_AXIS
    bodies, plumes = [], []
    for nm, shade in RD_CARS:
        body = obj(nm, roadster_mesh(M, nm, shade), C, (RD_SHOW_X, RD_LANE_Y, z), math.pi, surface='metal', night=True,
                   nw_motif='flying_roadster')
        me, rear, bottom = plume_mesh(f'{nm}_plume', shade)
        me.materials.append(M['plume'])
        pl = obj(f'{nm}_plume', me, C, (0.0, 0.0, 0.0), 0.0, surface='glass')
        pl.parent = body                                           # 부모 역행렬은 단위 → 차체 로컬 그대로(웹에서 차와 함께 움직인다)
        _plume_keys(pl, rear, bottom)
        bodies.append(body)
        plumes.append(pl)
    _assert_unique(bodies, '로드스터')
    _assert_unique(plumes, '로드스터 분사')
    print('roadsters', [(o.name, tuple(round(c, 2) for c in o.dimensions), sum(len(p.vertices) - 2 for p in o.data.polygons))
                        for o in bodies + plumes])
    return bodies


def build_parked_pods(C, M, gz):
    """B 가 뛰어넘는 정차 포드 2 대: 포드 모양(taxi_mesh)을 한 메시로 링크 복제 → GPU 인스턴스(그리기 1). 움직이지 않으니 노드 이름이 지워져도 된다
    (웹은 InstancedMesh 이름 = 메시 이름 FU_parked_pod 로 찾는다). nw_solid=1 → layout.solids(보행 장애물 · 경로 여유 검사)."""
    me = taxi_mesh(M)
    me.name = 'FU_parked_pod'
    lib.write_mask_values(me, [(0.0, 0.35, PARKED_POD_SHADE * (0.55 + 0.45 * smoothstep(0.1, 0.9, v.co.z))) for v in me.vertices])
    out = [obj(nm, me, C, (x, PARKED_POD_Y, _road_base(gz, x, PARKED_POD_Y)), math.pi, surface='metal', night=True, nw_solid=1,
               nw_motif='parked_pod') for nm, x in PARKED_PODS]
    print('parked pods', [(o.name, tuple(round(c, 2) for c in o.location)) for o in out])
    return out
```

  (g) `build()` 를 고친다. `build_taxis(C, M, gz)` 줄을 `taxis = build_taxis(C, M, gz)` 로 바꾸고, `build_smart_street(C, M, gz)` 줄 다음(`sc['nw_movers'] = …` 앞)에 넣는다.

```python
    build_roadsters(C, M, gz)             # 날으는 로드스터 2 대 + 분사(2026-11-12 스펙 §2)
    parked = build_parked_pods(C, M, gz)  # B 가 뛰어넘는 정차 포드 2 대(링크 복제 → 인스턴스)
    _assert_unique(taxis + parked[:1], '포드 · 정차 포드')
```

- [ ] **Step 8: 빌드하고 테스트한다.**

```bash
npm run nowhere:build -- -- --rebuild --no-bake 2>&1 | tee build/nowhere/rd-t3-build.log | grep -E "roadsters|parked pods|Traceback|Error|Done in"
npm run nowhere:optimize 2>&1 | tee build/nowhere/rd-t3-opt.log | grep -iE "error|warn" ; echo "optimize rc=${PIPESTATUS[0]}"
npm test 2>&1 | tail -4
git status --short public/assets
```

Expected:
- 빌드: `roadsters [('FU_roadster_a', (4.46, 1.97, 1.14), 740), ('FU_roadster_b', …), ('FU_roadster_a_plume', (…), 256), ('FU_roadster_b_plume', …)]`(조정한 값이면 그 치수 · 수), `parked pods [('FU_parked_pod.0', (-30.0, -36.9, …)), ('FU_parked_pod.1', (-36.0, -36.9, …))]`, `[nowhere:build] Done in` 약 25 s, Traceback 없음
- optimize: `optimize rc=0`
- 테스트: `# pass 198`, `# fail 0`(future-layout (l)(m), clearance (a)–(e) 포함)
- `git status`: `public/assets/nowhere/nowhere-future.glb`, `public/assets/nowhere/mobile/nowhere-future.glb`, `public/assets/nowhere/layout.json` 가 바뀐다. 다른 GLB(ground · present · backdrop)가 바뀌었으면 크기 전 · 후를 보고서에 적는다(바뀔 이유가 없다). `public/assets/nowhere-ds2` 는 바뀌지 않아야 한다.
- 실패 처리: (l) 의 모양 키 수가 0 이면 optimize 가 morph target 을 잃은 것이다 — 멈추고 보고한다. clearance (b)(c)(인트로 · 투어 비행)가 정차 포드 때문에 실패하면 멈추고 보고한다(포드 자리는 스펙 값이다).

- [ ] **Step 9: 보고서** — `look` 회차별 대조표와 바꾼 상수(전 · 후), 최종 치수 · 삼각형, `look` 이미지 설명, 빌드 · 최적화 시간, 테스트 결과, 바뀐 산출물 목록.

- [ ] **Step 10: 스테이징(커밋하지 않음)** — 컨트롤러가 리뷰 뒤 실행한다.

```bash
git add tools/nowhere/blender/future.py tests/nowhere-future-layout.test.mjs \
  public/assets/nowhere/nowhere-future.glb public/assets/nowhere/mobile/nowhere-future.glb public/assets/nowhere/layout.json
```

커밋 메시지 안: `feat(nowhere): 성수 2041 날으는 로드스터 모델 · 분사 기둥(모양 키) · 정차 포드`

---

### Task 4: 시간표 → `layout.movers` 키(A 날아가기 · B 점프 착지)

**Files:**
- Modify: `tools/nowhere/blender/future.py`(새 절 `날으는 로드스터 시간표` — `mover_table` 바로 위, `mover_table` 끝에 행 추가 · 출력 줄)
- Modify: `tools/nowhere/blender/export.py`(`export_layout` 의 movers 변환, 머리말 1줄)
- Test: `tests/nowhere-movers.test.mjs`((e) 교체, (k) 추가), `tests/nowhere-clearance.test.mjs`(import, (f) 추가), `tests/nowhere-assets.test.mjs`((i) 추가)
- 산출물: future GLB 2 · `layout.json`

**Interfaces:**
- Consumes: Task 3 의 `RD_AXIS` · `RD_LANE_Y` · `RD_SHOW_X` · `RD_CARS` · `FU_roadster_*` 객체, `future.py` 의 `_road_base`, `mover_table` 의 `row(name, **kw)`(object · origin · yaw0 를 채운다), Task 2 의 `roadsterPose` 와 movers 시험 파일의 `CH` · `near`
- Produces(Task 5 · 6 이 쓴다): `layout.movers` 의 로드스터 2 행

```js
{ id: 'roadster_a', kind: 'roadster', object: 'FU_roadster_a', plume: 'FU_roadster_a_plume', origin: [160, y, -37.125], yaw0: 3.141593,
  period: 40, phase: 0, keys: [{ t, pos: [x, y, z], yaw?, roll?, pitch?, thrust? }], visible: [0, 14.418] }
{ id: 'roadster_b', …, phase: 20, visible: [0, 19.091] }
```

- [ ] **Step 1: 실패하는 테스트를 쓴다.**

`tests/nowhere-movers.test.mjs` 의 (e) 를 통째로 아래로 바꾼다.

```js
test('(e) layout.movers: 종류 · 모드 · 경로 · 속도, 오브젝트가 future GLB(데스크톱 · 모바일)에 있다, drones 키는 없다', () => {
  const layout = JSON.parse(readFileSync(new URL('../public/assets/nowhere/layout.json', import.meta.url), 'utf8'));
  assert.equal(layout.drones, undefined);
  const names = [glbNodeNames('../public/assets/nowhere/nowhere-future.glb'), glbNodeNames('../public/assets/nowhere/mobile/nowhere-future.glb')];
  const kinds = {};
  for (const m of layout.movers) {
    assert.ok(MOVER_KINDS.includes(m.kind), m.id);
    for (const set of names) assert.ok(set.has(m.object), `${m.id}: ${m.object} 없음`);
    // 피벗(Blender 원점 · 방위): optimize 가 노드 원점을 메시 상자 가운데로 옮겨서 웹이 이 자리에 피벗을 둔다(빠지면 포드가 노면에 묻히고
    // 회전자가 허브 밖을 축으로 돈다). 회전자도 허브 자리가 필요하다
    assert.ok(Array.isArray(m.origin) && m.origin.length === 3 && m.origin.every(Number.isFinite), `${m.id}: origin ${m.origin}`);
    assert.ok(Number.isFinite(m.yaw0), `${m.id}: yaw0 ${m.yaw0}`);
    kinds[m.kind] = (kinds[m.kind] || 0) + 1;
    if (m.kind === 'roadster') {
      // 날으는 로드스터: 경로 대신 시간표 키. 피벗 = 첫 키 자리(Blender 에서 첫 키에 세웠다), 분사 노드도 GLB 에 있다
      for (const set of names) assert.ok(set.has(m.plume), `${m.id}: ${m.plume} 없음`);
      const d = Math.hypot(...m.origin.map((v, c) => v - m.keys[0].pos[c]));
      assert.ok(d <= 0.5, `${m.id}: origin 이 첫 키에서 ${d.toFixed(2)} m`);
      continue;
    }
    if (m.kind !== 'spin') {
      const segs = m.mode === 'loop' ? m.path.length : m.path.length - 1;   // loop 은 마지막 → 처음 구간까지
      const d = Math.min(...m.path.slice(0, segs).map((p, i) => segDist(m.origin, p, m.path[(i + 1) % m.path.length])));
      assert.ok(d <= 0.5, `${m.id}: origin 이 경로에서 ${d.toFixed(2)} m`);   // Blender 에서 경로 위에 세웠다(갱신 전 matrix_world = 원점 0 같은 실수 방지)
    }
    if (m.kind === 'spin') {
      assert.ok(m.rpm > 0, m.id);
      continue;
    }
    assert.ok(['loop', 'wrap', 'pingpong'].includes(m.mode), m.id);
    assert.ok(m.speed > 0 && Array.isArray(m.path) && m.path.length >= 2, m.id);
  }
  assert.deepEqual(kinds, { drone: 6, pod: 5, train: 2, bot: 3, spin: 5, roadster: 2 });
});
```

같은 파일 끝에 더한다(Task 2 의 `CH` · `near` · `roadsterPose` 를 쓴다).

```js
test('(k) layout.movers 로드스터: A(위상 0) · B(위상 20 s), 주기 40, 키가 시각 순 · 첫 끝 키에 모든 채널, 롤 0 → 2π, 분사, 두 대가 함께 보이지 않는다', () => {
  const layout = JSON.parse(readFileSync(new URL('../public/assets/nowhere/layout.json', import.meta.url), 'utf8'));
  const rds = layout.movers.filter((m) => m.kind === 'roadster');
  assert.deepEqual(rds.map((m) => [m.id, m.object, m.plume, m.period, m.phase]), [
    ['roadster_a', 'FU_roadster_a', 'FU_roadster_a_plume', 40, 0],
    ['roadster_b', 'FU_roadster_b', 'FU_roadster_b_plume', 40, 20],
  ]);
  for (const m of rds) {
    const K = m.keys;
    assert.ok(K.length >= 20, `${m.id}: 키 ${K.length}`);
    for (let i = 1; i < K.length; i++) assert.ok(K[i].t > K[i - 1].t, `${m.id}: 키 ${i} 시각 순서`);
    for (const k of K) assert.ok(Array.isArray(k.pos) && k.pos.length === 3 && k.pos.every(Number.isFinite), `${m.id}: 키 ${k.t} pos`);
    for (const ch of CH) assert.ok(Number.isFinite(K[0][ch]) && Number.isFinite(K.at(-1)[ch]), `${m.id}: 첫 · 끝 키에 ${ch} 없음`);
    assert.deepEqual(m.visible, [K[0].t, K.at(-1).t]);
    assert.ok(m.visible[1] - m.visible[0] < 20, `${m.id}: 보이는 구간 ${m.visible}`);
    const rolls = K.filter((k) => k.roll !== undefined).map((k) => k.roll);
    assert.ok(near(rolls[0], 0, 1e-9) && near(rolls.at(-1), 2 * Math.PI, 1e-5), `${m.id}: 롤 ${rolls[0]} → ${rolls.at(-1)}`);
    for (let i = 1; i < rolls.length; i++) assert.ok(rolls[i] >= rolls[i - 1] - 1e-9, `${m.id}: 롤이 줄어든다`);
    const th = K.filter((k) => k.thrust !== undefined).map((k) => k.thrust);
    assert.ok(th.every((v) => v >= 0 && v <= 1) && Math.max(...th) > 0.9, `${m.id}: 분사 ${th}`);
    assert.ok(near(m.yaw0, Math.PI, 1e-5), `${m.id}: yaw0 ${m.yaw0}(서쪽)`);
  }
  for (let i = 0; i < 320; i++) {
    const t = i * 0.25;   // 80 s(두 주기)
    assert.ok(rds.filter((m) => roadsterPose(m, t).visible).length <= 1, `t ${t}: 두 대가 함께 보인다`);
  }
});
```

`tests/nowhere-clearance.test.mjs` 의 import 에 한 줄을 더한다.

```js
import { roadsterPose } from '../public/src/nowhere/movers.js';
```

파일 끝에 더한다(같은 파일의 `nearest` · `segDist2D` · `CAM_CLEAR` 를 쓴다).

```js
// 날으는 로드스터 차체(future.py roadster_mb): 반폭 0.975(바퀴 0.985), 원점(롤 축) → 바퀴 아래 0.55 · 지붕 0.6
const RD_BODY = { half: 0.975, below: 0.55, above: 0.6 };
const RD_CLEAR = { fly: 3.0, drive: 0.7 };

test('(f) 날으는 로드스터: 0.1 s 표본이 비행 중 solid 에서 3 m · 주행 중 0.7 m 이상(정차 포드 포함), 노면 아래로 가지 않고, 지상 카메라와 수평 1.5 m 이상', () => {
  const rds = (layout.movers || []).filter((m) => m.kind === 'roadster');
  assert.equal(rds.length, 2, '로드스터 2 대');
  for (const id of ['FU_parked_pod.0', 'FU_parked_pod.1']) assert.ok(layout.solids.some((b) => b.id === id), `${id} solid 없음`);
  for (const m of rds) {
    const S = [];
    for (let i = 0; ; i++) {
      const t = m.visible[0] + i * 0.1;
      if (t > m.visible[1]) break;
      S.push(roadsterPose(m, m.phase + Math.min(t, m.visible[1] - 1e-6)));
    }
    const ground = Math.min(...m.keys.map((k) => k.pos[1]));   // 가장 낮은 키 = 노면 위 주행 높이(원점 = 롤 축)
    for (const p of S) {
      assert.ok(p.visible, `${m.id}: 보이는 구간 안 표본이 숨겨졌다`);
      const fly = p.pos[1] > ground + 0.3;
      const need = fly ? RD_CLEAR.fly : RD_CLEAR.drive;
      const r = nearest([p.pos]);
      assert.ok(r.d >= need, `${m.id} ${fly ? '비행' : '주행'}: ${r.id} ${r.d.toFixed(2)} m < ${need} @ ${r.at}`);
      assert.ok(p.pos[1] >= ground - 0.05, `${m.id}: 노면 아래 ${(ground - p.pos[1]).toFixed(3)} m @ ${p.pos.map((v) => v.toFixed(1))}`);
    }
    for (const cam of layout.cameras) {
      const [cx, cy, cz] = cam.pos;
      for (let i = 0; i + 1 < S.length; i++) {
        const a = S[i].pos;
        const b = S[i + 1].pos;
        // 차체와 높이가 1 m 안으로 겹치는 구간만(포드 검사 (e) 와 같은 생각)
        if (cy < Math.min(a[1], b[1]) - RD_BODY.below - 1.0 || cy > Math.max(a[1], b[1]) + RD_BODY.above + 1.0) continue;
        const d = segDist2D(cx, cz, a, b) - RD_BODY.half;
        assert.ok(d >= CAM_CLEAR, `카메라 ${cam.id} ↔ ${m.id}: 차체 옆면까지 ${d.toFixed(2)} m @ ${a.map((v) => v.toFixed(1))}`);
      }
    }
  }
});
```

`tests/nowhere-assets.test.mjs` 끝에 더한다.

```js
test('(i) 날으는 로드스터 전송량: future GLB + layout.json 이 로드스터 전(2026-11-12 main 1f2815d)보다 0.3 MB 넘게 늘지 않는다(데스크톱 · 모바일)', () => {
  const BASE = { desktop: 1349060 + 296395, mobile: 1072192 + 296395 };   // nowhere-future.glb + layout.json 바이트(로드스터 전)
  const layoutBytes = statSync(resolve(NW_ASSETS, 'layout.json')).size;
  const now = {
    desktop: statSync(resolve(NW_ASSETS, 'nowhere-future.glb')).size + layoutBytes,
    mobile: statSync(resolve(NW_ASSETS, 'mobile', 'nowhere-future.glb')).size + layoutBytes,
  };
  for (const k of ['desktop', 'mobile']) {
    const grow = now[k] - BASE[k];
    assert.ok(grow <= 0.3 * 1024 * 1024, `${k}: +${(grow / 1024).toFixed(1)} KB > 300 KB`);
  }
});
```

Run: `node --test tests/nowhere-movers.test.mjs tests/nowhere-clearance.test.mjs tests/nowhere-assets.test.mjs`
Expected: movers (e) FAIL(`kinds` 에 roadster 없음), (k) FAIL(`rds` 가 비었다), clearance (f) FAIL(`로드스터 2 대`), assets (i) PASS(Task 3 산출물은 아직 0.3 MB 안)

- [ ] **Step 2: 시간표를 쓴다(`future.py`).** `# ═══ 이동체 표(Task 11, §4.4) ═══` 절의 `def mover_table(gz):` 바로 위에 넣는다.

```python
# ─────────────── 날으는 로드스터 시간표(2026-11-12 스펙 §3) — 값은 화면을 보며 조정하고, 조정 뒤에는 이 표가 기준이다
RD_SPEED = 22.0                            # m/s(등장 → 분사, 착지 뒤 서진)
RD_PERIOD = 40.0                           # 차마다 주기(s). 두 차는 위상 0 · 20 s(20 초에 한 번씩 번갈아)
RD_A = dict(thrust_x=10.0, rise=0.4, roll=1.2, ax=3.0, az=6.0, climb=6.0, end=(-300.0, 70.0, 90.0), end_vel=(-55.0, 30.0, 12.0))
# A 날아가기: x 10(HAUS 앞)에서 분사 → rise 0.4 s 상승(가속 서진 ax · 상승 az m/s²) → roll 1.2 s 진행 방향 축 360°(같은 차로 위 — HAUS 남쪽 면에서
#            11 m) → climb 6 s 동안 3 차 Hermite(롤 끝 속도 → end_vel)로 북서쪽 벽돌 지붕 너머 → 고도 90 m · (−300, 70) 에서 숨김
RD_B = dict(takeoff_x=-18.0, land_x=-48.0, apex=6.0, flip=0.5, cushion=0.3, hide_x=-260.0)
# B 점프 착지: x −18 에서 분사 이륙 → 포물선(바퀴 높이 최고 6 m, x −33) · 꼭대기 ±0.5 s 진행 방향 축 360° 킥플립 → 마지막 0.3 s 바닥 분사로
#            받쳐(3 차 Hermite, 내려오는 속도 0) x −48 착지 → 서진 → x −260 에서 숨김. 정차 포드 FU_parked_pod.0 · .1(x −30 · −36)을 넘는다
RD_STEP = (1.0, 0.05, 0.1)                 # 위치 키 간격(s): 주행 · 이륙 ~ 롤/점프 · A 상승 비행


def _frange(a, b, step):
    """a … b 를 step 이하 같은 간격으로(양 끝 포함)."""
    n = max(1, int(math.ceil((b - a) / step - 1e-9)))
    return [a + (b - a) * k / n for k in range(n + 1)]


def _rd_keys(traj, times, events):
    """traj(t) → (x, y, z), times = 위치 표본 시각, events = [(t, {채널: 값})] → 키 목록(Blender 좌표, 시각 순, 1 ms 안 같은 시각은 하나로).
    pos 는 모든 키에, 채널(yaw · roll · pitch · thrust)은 그 값을 정하는 키에만 둔다 — 웹 movers.roadsterPose 가 채널마다 그 키들 사이를
    선형 + smoothstep 으로 잇는다(촘촘한 위치 키마다 채널을 두면 키마다 기울기가 0 이 되어 롤이 끊겨 보인다)."""
    keys = {}
    for t in list(times) + [t for t, _ in events]:
        tk = round(t, 3)
        keys.setdefault(tk, {'t': tk, 'pos': [round(c, 4) for c in traj(tk)]})
    for t, ch in events:
        keys[round(t, 3)].update({k: round(v, 6) for k, v in ch.items()})
    out = [keys[t] for t in sorted(keys)]
    for name in ('yaw', 'roll', 'pitch', 'thrust'):
        if name not in out[0] or name not in out[-1]:
            raise RuntimeError(f'로드스터 키: 첫 · 끝 키에 {name} 가 없다')
    return out


def roadster_a(gz):
    """A 날아가기(위상 0) → (키, 보이는 구간 (0, 끝))."""
    a = RD_A
    v = RD_SPEED
    y = RD_LANE_Y
    tT = (RD_SHOW_X - a['thrust_x']) / v                     # 분사 시작(HAUS 앞)
    s1 = a['rise'] + a['roll']                                # 롤 끝(분사 뒤 s)
    D = a['climb']
    z0 = _road_base(gz, a['thrust_x'], y) + RD_AXIS

    def p1(s):                                                # 상승 · 롤: 같은 차로를 따라 가속 서진 · 가속 상승
        return Vector((a['thrust_x'] - (v * s + 0.5 * a['ax'] * s * s), y, z0 + 0.5 * a['az'] * s * s))

    P0 = p1(s1)
    V0 = Vector((-(v + a['ax'] * s1), 0.0, a['az'] * s1))
    P1 = Vector(a['end'])
    V1 = Vector(a['end_vel'])

    def p2(s):                                                # 북서쪽 지붕 너머로: 3 차 Hermite(롤 끝 속도 → end_vel)
        u = (s - s1) / D
        u2 = u * u
        u3 = u2 * u
        return (2 * u3 - 3 * u2 + 1) * P0 + (u3 - 2 * u2 + u) * D * V0 + (-2 * u3 + 3 * u2) * P1 + (u3 - u2) * D * V1

    def traj(t):
        if t <= tT:
            x = RD_SHOW_X - v * t
            return (x, y, _road_base(gz, x, y) + RD_AXIS)
        s = t - tT
        return tuple(p1(s) if s <= s1 else p2(s))

    def heading(t):
        p, q = traj(t - 0.05), traj(t + 0.05)
        return math.atan2(q[1] - p[1], q[0] - p[0])

    t_end = tT + s1 + D
    turn = tT + s1 + 0.6 * D
    times = _frange(0.0, tT, RD_STEP[0]) + _frange(tT, tT + s1, RD_STEP[1]) + _frange(tT + s1, t_end, RD_STEP[2])
    events = [
        (0.0, dict(yaw=math.pi, roll=0.0, pitch=0.0, thrust=0.0)),
        (tT - 0.1, dict(thrust=0.0)),
        (tT + 0.1, dict(thrust=1.0)),                                              # 뒤 · 바닥 분사 모두
        (tT + a['rise'], dict(roll=0.0, pitch=0.08)),                              # 롤 시작
        (tT + s1, dict(roll=2 * math.pi, pitch=0.18, yaw=math.pi, thrust=1.0)),    # 롤 끝(진행 방향 축 360°)
        (tT + s1 + 0.5, dict(thrust=0.5)),                                         # 바닥 분사 끄기(0.5 이하 = 뒤 노즐만 — movers.plumeMorph)
        (turn, dict(yaw=heading(turn), pitch=0.25)),                               # 북서쪽으로 돌며 들림
        (t_end, dict(yaw=heading(t_end - 0.05), roll=2 * math.pi, pitch=0.2, thrust=0.0)),   # 뒤 노즐을 서서히 줄여 끝에서 0
    ]
    return _rd_keys(traj, times, events), (0.0, round(t_end, 3))


def roadster_b(gz):
    """B 점프 착지(위상 20 s) → (키, 보이는 구간 (0, 끝))."""
    b = RD_B
    v = RD_SPEED
    y = RD_LANE_Y
    tT = (RD_SHOW_X - b['takeoff_x']) / v                     # 이륙(분사 시작)
    T = (b['takeoff_x'] - b['land_x']) / v                    # 공중 시간(30 m / 22 m/s ≈ 1.36 s)
    tL = tT + T
    t_end = tL + (b['land_x'] - b['hide_x']) / v
    H = b['apex']
    c = b['cushion']
    sc = T - c
    zT = _road_base(gz, b['takeoff_x'], y)
    zL = _road_base(gz, b['land_x'], y)

    def hp(s):                                                # 바퀴 높이 포물선(꼭대기 T/2 = x −33 에서 H)
        return 4.0 * H * (s / T) * (1.0 - s / T)

    def dhp(s):
        return 4.0 * H / T * (1.0 - 2.0 * s / T)

    def h(s):
        if s <= sc:
            return hp(s)
        u = (s - sc) / c                                       # 착지 0.3 s: 바닥 분사로 받쳐 높이 0 · 내려오는 속도 0 으로(3 차 Hermite)
        return (2 * u ** 3 - 3 * u ** 2 + 1) * hp(sc) + (u ** 3 - 2 * u ** 2 + u) * c * dhp(sc)

    def traj(t):
        if tT < t < tL:
            s = t - tT
            return (b['takeoff_x'] - v * s, y, zT + (zL - zT) * s / T + RD_AXIS + h(s))
        x = RD_SHOW_X - v * t if t <= tT else b['land_x'] - v * (t - tL)
        return (x, y, _road_base(gz, x, y) + RD_AXIS)

    f0 = tT + T / 2 - b['flip']                              # 킥플립(꼭대기 ±0.5 s)
    f1 = tT + T / 2 + b['flip']
    times = _frange(0.0, tT, RD_STEP[0]) + _frange(tT, tL, RD_STEP[1]) + _frange(tL, t_end, RD_STEP[0])
    events = [
        (0.0, dict(yaw=math.pi, roll=0.0, pitch=0.0, thrust=0.0)),
        (tT - 0.1, dict(thrust=0.0, pitch=0.0)),
        (tT, dict(thrust=1.0)),                                    # 이륙 분사 0.4 s
        (tT + 0.3, dict(thrust=1.0)),
        (tT + 0.45, dict(thrust=0.0)),
        (f0, dict(roll=0.0, pitch=0.1)),
        (f1, dict(roll=2 * math.pi, pitch=-0.06)),
        (tL - c - 0.05, dict(thrust=0.0)),
        (tL - c + 0.05, dict(thrust=1.0)),                         # 착지 분사 0.3 s(바닥으로 받친다)
        (tL, dict(thrust=0.6, pitch=0.0)),
        (tL + 0.1, dict(thrust=0.0)),
        (t_end, dict(yaw=math.pi, roll=2 * math.pi, pitch=0.0, thrust=0.0)),
    ]
    return _rd_keys(traj, times, events), (0.0, round(t_end, 3))
```

  `mover_table(gz)` 의 `print('movers', …)` 줄 바로 위에 넣는다.

```python
    for (nm, _), (rid, make, phase) in zip(RD_CARS, (('roadster_a', roadster_a, 0.0), ('roadster_b', roadster_b, RD_PERIOD / 2))):
        keys, visible = make(gz)
        rows.append(row(nm, id=rid, kind='roadster', plume=f'{nm}_plume', period=RD_PERIOD, phase=phase, keys=keys, visible=list(visible)))
```

  `print('movers', …)` 줄을 바꾼다.

```python
    print('movers', [(r['id'], r['object'], len(r.get('path', r.get('keys', ())))) for r in rows])
```

- [ ] **Step 3: 키를 three 좌표로 내보낸다(`export.py`).** `export_layout` 의 movers 루프를 아래로 바꾸고, 머리말 9행 끝에 "· 날으는 로드스터 시간표 키(keys[].pos 도 three 좌표)"를 더한다.

```python
    movers = json.loads(sc.get('nw_movers', '[]'))
    for m in movers:
        if 'path' in m:
            m['path'] = [to_three(p) for p in m['path']]
        if 'origin' in m:
            m['origin'] = to_three(m['origin'])
        for k in m.get('keys', ()):        # 날으는 로드스터 시간표 키: 위치만 바꾼다(yaw = Blender rotation z = three rotation.y, pitch · roll 은 차 로컬 축)
            k['pos'] = to_three(k['pos'])
        if m.get('beam') is None:
            m.pop('beam', None)
```

- [ ] **Step 4: 빌드하고 테스트한다.**

```bash
npm run nowhere:build -- -- --rebuild --no-bake 2>&1 | tee build/nowhere/rd-t4-build.log | grep -E "movers|Traceback|Error|Done in"
npm run nowhere:optimize 2>&1 | tee build/nowhere/rd-t4-opt.log | grep -iE "error|warn" ; echo "optimize rc=${PIPESTATUS[0]}"
npm test 2>&1 | tail -4
node -e "const L=JSON.parse(require('fs').readFileSync('public/assets/nowhere/layout.json','utf8'));for(const m of L.movers.filter(m=>m.kind==='roadster'))console.log(m.id,m.phase,m.visible,m.keys.length,JSON.stringify(m.keys[0]),JSON.stringify(m.keys.at(-1)))"
```

Expected:
- 빌드 출력 `movers [… ('roadster_a', 'FU_roadster_a', 약 105), ('roadster_b', 'FU_roadster_b', 약 55)]`(키 수), Traceback 없음
- `optimize rc=0`, 테스트 `# pass 201`, `# fail 0`
- `roadster_a 0 [ 0, 14.418 ] … {"t":0,"pos":[160,0.43,37.125],"yaw":3.141593,"roll":0,"pitch":0,"thrust":0} {"t":14.418,"pos":[-300,90,-70],…}`, `roadster_b 20 [ 0, 19.091 ] …`(노면 높이에 따라 pos[1] 은 0.43 … 0.6)

- [ ] **Step 5: 실패하면 고친다(값은 `future.py` 표가 기준).**
  - clearance (f) 비행 3 m 실패: 메시지의 solid · 자리를 보고 A 는 `RD_A['end_vel']` · `end` · `climb`, B 는 `RD_B['apex']` 를 고친다. 롤 구간에서 HAUS 와 가까우면 `thrust_x` 를 동쪽으로.
  - 주행 0.7 m 실패: 차로가 막힌 것이다 — 가장 가까운 빈 차로로 `RD_LANE_Y` · `PARKED_POD_Y` 를 함께 옮기고 보고한다(스펙 §3).
  - 노면 아래 실패: 그 구간의 `RD_STEP` 을 줄이거나(B 착지 0.05 → 0.025) `cushion` 을 늘린다.
  - 카메라 실패: 그 카메라와 시각을 적고 멈춘다(차로 · 카메라 둘 다 기존 값이라 사용자 결정).
  - 바꾼 값은 전 · 후로 보고서에 적고 §1.2 표와 다르면 보고서에 새 표를 쓴다.

- [ ] **Step 6: (성수 장면이 열려 있을 때만) 라이브 Blender 에서 경로를 본다.** `mcp__blender__get_addon_status` 뒤 `execute_blender_code` 로 `import bpy; print(bpy.data.filepath, bpy.data.collections.get('NW_future') is not None)` 를 본다. `True` 이면 키 자리를 작은 상자로 그린다(라이브 파일은 저장하지 않는다).

```python
import bpy
ROOT = '/Users/gm_yeonho/new-work/so/so-viewer-monster1267'
ns = {'__name__': 'nw_roadster_scratch'}
exec(open(f'{ROOT}/tools/nowhere/blender/future.py').read(), ns)
gz = ns['_Roof'](bpy.context.scene)
for nm, make in (('SCR_rd_path_a', ns['roadster_a']), ('SCR_rd_path_b', ns['roadster_b'])):
    keys, vis = make(gz)
    mb = ns['MB']()
    for k in keys:
        x, y, z = k['pos']
        mb.box((x - 0.3, y - 0.3, z - 0.3), (x + 0.3, y + 0.3, z + 0.3), 0)
    old = bpy.data.objects.get(nm)
    if old is not None:
        bpy.data.objects.remove(old, do_unlink=True)
    o = bpy.data.objects.new(nm, mb.to_mesh(nm, []))
    bpy.context.scene.collection.objects.link(o)
    print(nm, len(keys), 'keys', vis)
```

  `mcp__blender__look(mode="angles", target=["SCR_rd_path_a", "SCR_rd_path_b"], views=["top", [-0.99, -0.12, 0.05], [0.0, -1.0, 0.25]], shading="solid", max_size=768)` 로 A 가 롤 동안 차로 위에 있고 HAUS 서쪽 끝을 지난 뒤 북서쪽 지붕 위로 오르는지, B 의 포물선이 두 정차 포드 위를 넘는지 본다. 본 뒤 지운다.

```python
import bpy
for nm in ('SCR_rd_path_a', 'SCR_rd_path_b'):
    o = bpy.data.objects.get(nm)
    if o is not None:
        bpy.data.objects.remove(o, do_unlink=True)
for me in [m for m in bpy.data.meshes if m.name.startswith('SCR_rd_path') and m.users == 0]:
    bpy.data.meshes.remove(me)
print('남은 SCR_rd_path', [d.name for d in (*bpy.data.objects, *bpy.data.meshes) if d.name.startswith('SCR_rd_path')])
```

  Expected: `남은 SCR_rd_path []`. 장면이 없으면 이 단계를 건너뛰고 보고서에 적는다.

- [ ] **Step 7: 보고서** — 키 수 · 보이는 구간, 조정한 값(전 · 후), 테스트 결과, 바뀐 산출물, Step 6 관찰.

- [ ] **Step 8: 스테이징(커밋하지 않음)** — 컨트롤러가 리뷰 뒤 실행한다.

```bash
git add tools/nowhere/blender/future.py tools/nowhere/blender/export.py \
  tests/nowhere-movers.test.mjs tests/nowhere-clearance.test.mjs tests/nowhere-assets.test.mjs \
  public/assets/nowhere/nowhere-future.glb public/assets/nowhere/mobile/nowhere-future.glb public/assets/nowhere/layout.json
```

커밋 메시지 안: `feat(nowhere): 날으는 로드스터 시간표 — layout.movers 키(A 이륙 · 배럴 롤 · 지붕 너머, B 정차 포드 넘는 킥플립 점프)`

---

### Task 5: 웹 연결 — 자세 · 롤 · 분사 · 휴대폰 제외(`world.js`)

**Files:**
- Modify: `public/src/nowhere/world.js`(import, `MOVER_NODE` · `ROADSTER_ONLY`, `isRoadsterOnly`, `processRoot` 휴대폰 숨김, 이동체 루프, `updateMoverActors`, `createPlumeMaterial`)
- Test: `tests/nowhere-future-layout.test.mjs`((n) 추가)

**Interfaces:**
- Consumes: Task 1 `quality.roadsters`, Task 2 `roadsterPose(def, time)` · `plumeMorph(thrust)` · `PLUME_MIN`, Task 4 `layout.movers` 로드스터 행, Task 3 GLB(차체 노드 `FU_roadster_a/b`, 자식 분사 메시 morph target `rear` · `bottom`, 인스턴스 메시 `FU_parked_pod`)
- Produces:
  - 로드스터 액터 `{ def, object: 피벗(THREE.Group, 이름 'FU_roadster_a_pivot'), plume: THREE.Mesh | null, morph: { rear, bottom } }`(`world.moverActors` 안)
  - `updateMoverActors(actors, elapsed)` 의 로드스터 분기(피벗 `rotation.set(roll, yaw, pitch, 'YZX')`, 분사 보임 · 모양 키 영향)
  - 휴대폰: 로드스터 액터 0, `FU_roadster*` · `FU_parked_pod*` 메시 숨김(보행 장애물에서 빠짐)
  - 데스크톱 · 태블릿: 정차 포드는 정적 병합 메시 `NW_Merged_future_NWF_mover`(보행 장애물)

- [ ] **Step 1: 실패하는 테스트를 쓴다** — `tests/nowhere-future-layout.test.mjs` 끝에 더한다(같은 파일의 `srcRegex` 를 쓴다).

```js
test('(n) 로드스터 웹 연결(world.js): 차체 · 분사는 이동체(병합 · 보행 장애물에서 빠짐), 정차 포드는 정적(보행 장애물), 휴대폰 숨김은 셋 모두', () => {
  const MOVER_NODE = srcRegex('MOVER_NODE');
  const ROADSTER_ONLY = srcRegex('ROADSTER_ONLY');
  for (const nm of ['FU_roadster_a', 'FU_roadster_b', 'FU_roadster_a_plume', 'FU_taxi0']) assert.ok(MOVER_NODE.test(nm), `MOVER_NODE: ${nm}`);
  for (const nm of ['FU_parked_pod', 'FU_parked_pod0', 'FU_terrace']) assert.ok(!MOVER_NODE.test(nm), `MOVER_NODE 가 ${nm} 를 이동체로 본다`);
  for (const nm of ['FU_roadster_a', 'FU_roadster_b_plume', 'FU_parked_pod', 'FU_parked_pod1']) assert.ok(ROADSTER_ONLY.test(nm), `ROADSTER_ONLY: ${nm}`);
  for (const nm of ['FU_taxi0', 'FU_terrace', 'PR_zelkova_a', 'NW_Merged_future_NWF_mover']) assert.ok(!ROADSTER_ONLY.test(nm), `ROADSTER_ONLY 가 ${nm} 를 숨긴다`);
});
```

Run: `node --test tests/nowhere-future-layout.test.mjs`
Expected: (n) FAIL `world.js 에 ROADSTER_ONLY 없음`

- [ ] **Step 2: `world.js` 를 고친다.**

  (a) 18행 import:

```js
import { buildTrack, moverPose, spinAngle, roadsterPose, plumeMorph, PLUME_MIN } from './movers.js';
```

  (b) 20–21행을 바꾼다.

```js
// 경로 이동체 노드(layout.movers 의 object): 정적 병합 · 보행 장애물에서 뺀다(날으는 로드스터 차체 · 분사 포함)
const MOVER_NODE = /^FU_(drone|taxi|train|bot|turbine_rotor|roadster)/;
// 날으는 로드스터 전용 노드(차체 · 분사 · 정차 포드): 휴대폰(quality.roadsters 거짓)에서는 그리지 않고 보행 장애물에서도 뺀다
const ROADSTER_ONLY = /^FU_(roadster|parked_pod)/;
```

  (c) `function isAnimatedNode(node) { … }` 블록 바로 뒤(`// 장면 밖 원경(성수 2041 신축 타워` 주석 앞)에 넣는다.

```js
  // 날으는 로드스터 전용 노드인지(조상까지). GLTFLoader 이름: FU_parked_pod.0 → FU_parked_pod0, 인스턴스 정차 포드는 메시 이름 FU_parked_pod
  function isRoadsterOnly(node) {
    for (let cur = node; cur; cur = cur.parent) {
      if (typeof cur.name === 'string' && ROADSTER_ONLY.test(cur.name)) return true;
    }
    return false;
  }
```

  (d) `processRoot` 의 `// 고폴리 반복 소품(덮개 차량 등) …` 주석 줄 바로 앞에 넣는다.

```js
      // 휴대폰(quality.roadsters 거짓): 날으는 로드스터 · 분사 · 정차 포드를 그리지 않는다. 숨긴 메시는 병합되지 않고, 보행 장애물 격자(getWalkBlocker 의
      // pick)도 숨긴 메시를 건너뛴다 → 정차 포드가 길을 막지 않는다
      if (worldVer !== 'ds2' && !quality.roadsters && isRoadsterOnly(node)) {
        node.visible = false;
        return;
      }
```

  (e) 이동체 루프. `for (const def of layout.movers) {` 줄을 아래 세 줄로 바꾼다.

```js
    const plumeMat = createPlumeMaterial();   // 날으는 로드스터 분사(두 대가 함께 쓴다)
    for (const def of layout.movers) {
      if (def.kind === 'roadster' && !quality.roadsters) continue;   // 휴대폰: 로드스터를 만들지 않는다(메시는 processRoot 가 숨겼다)
```

  같은 루프의 `      if (def.kind === 'spin') {` 줄 바로 앞(피벗 만들기 뒤)에 넣는다.

```js
      if (def.kind === 'roadster') {
        // 분사(Blender 에서 차체의 자식): 웹 재질로 바꾸고 그림자를 끈다. 모양 키 번호는 이름(rear · bottom)으로, 없으면 Blender 순서 0 · 1
        let plume = null;
        (byGltfName.get(def.plume) || futureRoot.getObjectByName(def.plume))?.traverse((n) => {
          if (!plume && n.isMesh) plume = n;
        });
        if (plume) {
          plume.material = plumeMat;
          plume.castShadow = false;
          plume.receiveShadow = false;
          plume.visible = false;
        } else {
          console.warn(`[nowhere] 이동체 ${def.id}: 분사 ${def.plume} 없음`);
        }
        const dict = plume?.morphTargetDictionary || {};
        target.visible = false;   // 첫 프레임 전까지(보이는 구간 밖이면 updateMoverActors 가 계속 숨긴다)
        moverActors.push({ def, object: target, plume, morph: { rear: dict.rear ?? 0, bottom: dict.bottom ?? 1 } });
        continue;
      }
```

  (f) `updateMoverActors` 의 루프 첫머리를 바꾼다(`  for (const a of actors) {` 다음, `    if (a.def.kind === 'spin') {` 앞에 넣는다).

```js
    if (a.def.kind === 'roadster') {
      const p = roadsterPose(a.def, elapsed);
      a.object.visible = p.visible;
      if (!p.visible) continue;
      a.object.position.set(p.pos[0], p.pos[1], p.pos[2]);
      // 머리 방향 → 들림 → 롤: 'YZX' = 세계 y(yaw)로 돌린 뒤 차의 옆축 z(pitch, + 코가 위), 마지막에 차의 앞 = 진행 방향 축 x(roll)
      a.object.rotation.set(p.roll, p.yaw, p.pitch, 'YZX');
      if (a.plume) {
        const on = p.thrust > PLUME_MIN;
        a.plume.visible = on;
        const inf = a.plume.morphTargetInfluences;
        if (on && inf) {
          const m = plumeMorph(p.thrust);   // 길이 ∝ thrust(뒤), 바닥은 0.5 넘는 부분
          inf[a.morph.rear] = m.rear;
          inf[a.morph.bottom] = m.bottom;
        }
      }
      continue;
    }
```

  (g) `/** 서치라이트 원뿔을 꼭짓점(apex …` 주석 바로 앞(모듈 수준)에 넣는다.

```js
/** 날으는 로드스터 분사 재질(웹에서 NWF_plume 을 바꾼다): 흰 압축공기 — 반투명, 노즐에서 끝으로 옅어지는 알파(UV v), 깊이 쓰기 · 그림자 없음, 양면.
 *  Lambert 라 낮에는 밝고 밤에는 거리 조명만큼만 보인다(혼자 빛나지 않는다). */
function createPlumeMaterial() {
  const n = 32;
  const data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    // 행 i = glTF v = i / (n − 1). glTF 는 Blender UV 의 v 를 뒤집으므로 노즐(Blender v 0) = 마지막 행 → 알파 0.75, 끝(Blender v 1) = 0 행 → 0
    const a = Math.round(255 * 0.75 * Math.pow(i / (n - 1), 1.6));
    data.set([a, a, a, 255], i * 4);
  }
  const alphaMap = new THREE.DataTexture(data, 1, n);
  alphaMap.magFilter = THREE.LinearFilter;
  alphaMap.minFilter = THREE.LinearFilter;
  alphaMap.needsUpdate = true;
  const mat = new THREE.MeshLambertMaterial({
    color: '#F4F7F8',
    emissive: '#2E3236',
    alphaMap,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  mat.name = 'NWF_plume_web';
  return mat;
}
```

- [ ] **Step 3: 테스트를 실행한다.**

Run: `npm test 2>&1 | tail -4`
Expected: `# pass 202`, `# fail 0`

- [ ] **Step 4: 브라우저에서 확인한다(짧게).** 서버 :4173 를 확인하고 playwriter 로 연다. 열 때마다 대화상자 함수를 바꾸고(아래 (1)), `__NW_APP` 이 생길 때까지 2.5 s 호출을 되풀이한다(아래 (2)). 각 호출 시작에 3 s `evaluate` 확인 한 줄을 넣는다(§3.4).

```js
// (1) 열기
state.page = context.pages().find((p) => p.url().startsWith('http://localhost:4173')) ?? (await context.newPage()); await state.page.setViewportSize({ width: 1600, height: 900 }); await state.page.goto('http://localhost:4173/nowhere?noIntro=1&cam=street&time=14', { waitUntil: 'domcontentloaded' }); await state.page.evaluate(() => { window.__dialogs = []; window.confirm = (m) => (window.__dialogs.push(m), true); window.alert = (m) => { window.__dialogs.push(m); }; window.prompt = (m) => (window.__dialogs.push(m), null); }); console.log(state.page.url());
```

```js
// (2) 준비
await state.page.waitForFunction(() => Boolean(window.__NW_APP), null, { timeout: 2500 }).then(() => 'ready', () => 'wait')
```

```js
// (3) 데스크톱: 로드스터 액터 · 분사 · 모양 키 · 경고
console.log(await state.page.evaluate(() => { const app = window.__NW_APP; return app.world.moverActors.filter((a) => a.def.kind === 'roadster').map((a) => ({ id: a.def.id, pivot: a.object.name, plume: a.plume?.name, morph: a.morph, influences: a.plume?.morphTargetInfluences?.length, mat: a.plume?.material?.name, castShadow: a.plume?.castShadow })); })); console.log(await getLatestLogs({ page: state.page, search: /이동체|분사|error/i, count: 20 }));
```

Expected: 2 개 — `{ id: 'roadster_a', pivot: 'FU_roadster_a_pivot', plume: 'FU_roadster_a_plume', morph: { rear: 0, bottom: 1 }, influences: 2, mat: 'NWF_plume_web', castShadow: false }` · `roadster_b` 같은 꼴. 로그에 `이동체 … 없음` · `분사 … 없음` · 오류가 없다.

```js
// (4) A 롤 가운데 한 장(이동체 시각 고정 렌더 — README §2 히어로 캡처와 같은 방법)
const url = await state.page.evaluate(async () => { const app = window.__NW_APP; const wm = await import('/src/nowhere/world.js'); const d = app.world.moverActors.find((a) => a.def.id === 'roadster_a').def; const ro = d.keys.filter((k) => k.roll !== undefined); const t = d.phase + (ro.filter((k) => k.roll === 0).at(-1).t + ro.find((k) => k.roll > 6).t) / 2; app.post.gradePass.uniforms.uGrain.value = 0; app.world.uniforms.uTime.value = t; wm.updateMoverActors(app.world.moverActors, t); app.world.followSun(app.camera); app.post.composer.render(); return app.renderer.domElement.toDataURL('image/png'); }); const fs = require('node:fs'); fs.mkdirSync('/tmp/nw-roadster', { recursive: true }); fs.writeFileSync('/tmp/nw-roadster/roadster-t5-a-roll.png', Buffer.from(url.split(',')[1], 'base64')); console.log('saved');
```

그다음 Bash 로 `mkdir -p build/nowhere/compare && cp /tmp/nw-roadster/roadster-t5-a-roll.png build/nowhere/compare/` 하고 Read 로 본다. 흰 차가 HAUS 앞 차로 위에서 옆으로 누워(롤 약 180°) 있고, 뒤 · 바닥 분사가 보여야 한다.

```js
// (5) 휴대폰(&tier=mobile 로 (1)(2) 를 다시 한 뒤): 로드스터 없음 · 숨김 · 보행 장애물. 격자가 오래 걸리면 먼저 만들기만 걸고 다음 호출에서 읽는다
await state.page.evaluate(() => { setTimeout(() => { window.__wb = window.__NW_APP.world.getWalkBlocker(); }, 0); return 'started'; })
```

```js
// (5′) 되풀이: __wb 가 생기면 읽는다
console.log(await state.page.evaluate(() => { const app = window.__NW_APP; if (!window.__wb) return 'wait'; const hidden = []; app.world.layerGroups.future.traverse((n) => { if (n.isMesh && /^FU_(roadster|parked_pod)/.test(n.name)) hidden.push([n.name, n.visible]); }); return { device: app.getStats().device, roadsters: app.world.moverActors.filter((a) => a.def.kind === 'roadster').length, hidden, podBlocked: window.__wb.isBlocked(-30, 36.9, 0.4) }; }))
```

| 주소 | Expected |
|---|---|
| `…&tier=mobile` | `device 'phone'`, `roadsters 0`, `hidden` 의 visible 이 모두 false, `podBlocked false` |
| `…&tier=tablet` | `device 'tablet'`, `roadsters 2`, `podBlocked true` |
| 데스크톱(쿼리 없음) | `roadsters 2`, `podBlocked true` |

- [ ] **Step 5: 보고서** — (3)(5) 출력, 캡처 경로 · 관찰, 콘솔 경고.

- [ ] **Step 6: 스테이징(커밋하지 않음)** — 컨트롤러가 리뷰 뒤 실행한다.

```bash
git add public/src/nowhere/world.js tests/nowhere-future-layout.test.mjs
```

커밋 메시지 안: `feat(nowhere): 날으는 로드스터 웹 연결 — 진행 방향 축 롤 · 분사 길이(모양 키) · 휴대폰 제외`

---

### Task 6: 브라우저 확인 · 캡처 · 예산 · FPS → CP

**Files:**
- 바꾸는 코드 없음(문제를 찾으면 보고만 한다 — 고치기는 Task 7)
- 캡처 · 측정: `build/nowhere/compare/roadster-*.png`, `build/nowhere/compare/roadster-measure.json`(git 무시)

**Interfaces:**
- Consumes: Task 1–5 전부(`__NW_APP.world.moverActors` 의 로드스터 def · 피벗, `updateMoverActors`, `getStats()` 의 `calls` · `triangles` · `fps` · `device`, `camCtrl.placeWalk(x, z, look)`, `setCameraPreset(id, true)`)
- Produces: CP 자료(캡처 13 장, 예산 · FPS 표), 보고서

- [ ] **Step 1: 준비.** 서버 :4173 를 확인한다. `pmset -g batt` 로 전원(`AC Power`)을 확인해 적는다(배터리면 사용자에게 알리고 FPS 단계는 전원 연결 뒤에 한다). playwriter 로 거리 시점을 연다. 열 때마다 대화상자 함수를 바꾸고, 준비를 기다린 뒤 3 s 쉰다(기상 전환).

```js
state.page = context.pages().find((p) => p.url().startsWith('http://localhost:4173')) ?? (await context.newPage()); await state.page.setViewportSize({ width: 1600, height: 900 }); await state.page.goto('http://localhost:4173/nowhere?noIntro=1&cam=street&time=14', { waitUntil: 'domcontentloaded' }); await state.page.evaluate(() => { window.__dialogs = []; window.confirm = (m) => (window.__dialogs.push(m), true); window.alert = (m) => { window.__dialogs.push(m); }; window.prompt = (m) => (window.__dialogs.push(m), null); }); console.log(state.page.url());
```

```js
await state.page.waitForFunction(() => Boolean(window.__NW_APP), null, { timeout: 2500 }).then(() => 'ready', () => 'wait')
```

  도우미를 심는다(페이지를 열 때마다 다시 심는다).

```js
await state.page.evaluate(() => {
  const app = window.__NW_APP;
  const rds = () => app.world.moverActors.filter((a) => a.def.kind === 'roadster');
  // 이동체 시각 t 로 한 프레임을 그려 캔버스 PNG(dataURL)로 — README §2 히어로 캡처와 같은 방법(그레인 0)
  window.__rdShot = async (t) => {
    const wm = await import('/src/nowhere/world.js');
    app.post.gradePass.uniforms.uGrain.value = 0;
    app.world.uniforms.uTime.value = t;
    wm.updateMoverActors(app.world.moverActors, t);
    app.world.followSun(app.camera);
    app.post.composer.render();
    return app.renderer.domElement.toDataURL('image/png');
  };
  // 차마다 주기 안 시각 τ 에 붙잡는다(위상을 매 프레임 바꿈 — 측정용, 새로 고치면 풀린다)
  window.__rdHold = (taus) => {
    window.__rdTaus = taus;
    if (window.__rdHoldOn) return;
    window.__rdHoldOn = true;
    const tick = () => {
      const now = app.world.uniforms.uTime.value;
      for (const a of rds()) if (window.__rdTaus[a.def.id] !== undefined) a.def.phase = now - window.__rdTaus[a.def.id];
      requestAnimationFrame(tick);
    };
    tick();
  };
  // 로드스터 · 분사 · 정차 포드를 화면 밖이어도 그린다(최악 상한)
  window.__rdUncull = (on) => {
    app.world.layerGroups.future.traverse((n) => {
      if (!n.isMesh) return;
      let hit = n.name === 'NW_Merged_future_NWF_mover';
      for (let c = n; c && !hit; c = c.parent) hit = /^FU_(roadster|parked_pod)/.test(c.userData?.name || c.name || '');
      if (hit) n.frustumCulled = !on;
    });
  };
  // 정차 포드(병합 메시) 보이기 — 로드스터 전 상태를 재려면 false
  window.__rdParked = (v) => {
    const m = app.world.layerGroups.future.getObjectByName('NW_Merged_future_NWF_mover');
    if (m) m.visible = v;
    return Boolean(m);
  };
  // 사건 시각(주기 안 τ): 분사 켜짐 · 롤 시작/끝/가운데 · 마지막 강한 분사(B 착지)
  window.__rdEvents = () => Object.fromEntries(rds().map((a) => {
    const K = a.def.keys;
    const th = K.filter((k) => k.thrust !== undefined);
    const ro = K.filter((k) => k.roll !== undefined);
    const rollStart = ro.filter((k) => k.roll === 0).at(-1).t;
    const rollEnd = ro.find((k) => k.roll > 6).t;
    return [a.def.id, { phase: a.def.phase, visible: a.def.visible, thrustOn: th.find((k) => k.thrust > 0.5).t, rollStart, rollEnd,
      rollMid: (rollStart + rollEnd) / 2, land: th.filter((k) => k.thrust >= 0.5).at(-1).t }];
  }));
  return Object.keys(window).filter((k) => k.startsWith('__rd'));
});
```

- [ ] **Step 2: 사건 시각을 읽는다(붙잡기 전에).**

```js
state.ev = await state.page.evaluate(() => window.__rdEvents()); console.log(JSON.stringify(state.ev));
```

Expected(초기 값): `roadster_a: { phase: 0, thrustOn: 6.918, rollStart: 7.218, rollEnd: 8.418, rollMid: 7.818, … }`, `roadster_b: { phase: 20, thrustOn: 8.091, rollStart: 8.273, rollEnd: 9.273, rollMid: 8.773, land: 9.455, … }`. 캡처 시각(절대 t = phase + τ):

| 이름 | t |
|---|---|
| `a-takeoff` | A.phase + A.thrustOn + 0.15 |
| `a-roll` | A.phase + A.rollMid |
| `a-climb` | A.phase + A.rollEnd + 1.0 |
| `b-takeoff` | B.phase + B.thrustOn + 0.1 |
| `b-flip` | B.phase + B.rollMid |
| `b-land` | B.phase + B.land − 0.05 |

- [ ] **Step 3: 거리 시점 캡처 6 장.** 장마다 한 호출로 찍고 `/tmp` 에 저장한다(예: `a-roll`).

```js
const e = state.ev.roadster_a; const t = e.phase + e.rollMid; const url = await state.page.evaluate((t) => window.__rdShot(t), t); const fs = require('node:fs'); fs.mkdirSync('/tmp/nw-roadster', { recursive: true }); fs.writeFileSync('/tmp/nw-roadster/roadster-a-roll-street.png', Buffer.from(url.split(',')[1], 'base64')); console.log('saved', t);
```

  같은 방법으로 `roadster-a-takeoff-street` · `roadster-a-climb-street` · `roadster-b-takeoff-street` · `roadster-b-flip-street` · `roadster-b-land-street` 를 찍는다.

- [ ] **Step 4: 직접 걷기(HAUS 정문) 캡처 4 장.** `http://localhost:4173/nowhere?noIntro=1&mode=walk&time=14` 를 열고(대화상자 함수 · 준비 · 3 s · 도우미 다시 심기) 정문 스팟 자리(three (0, z 40))에 선다. 장마다 보는 곳을 바꾼 뒤 0.3 s 쉬고 찍는다.

```js
await state.page.evaluate(() => window.__NW_APP.camCtrl.placeWalk(0, 40, [15, 2.5, 37]));
```

| 이름 | `placeWalk(0, 40, look)` 의 look | 시각 |
|---|---|---|
| `roadster-a-takeoff-walk` | `[15, 2.5, 37]` | a-takeoff |
| `roadster-a-roll-walk` | `[-20, 4, 37]` | a-roll |
| `roadster-b-flip-walk` | `[-35, 4, 37]` | b-flip |
| `roadster-b-land-walk` | `[-40, 2, 37]` | b-land |

  `placeWalk` 가 `false` 를 돌려주면(보행 모드가 아님) `__NW_APP.camCtrl.setWalkMode(true)` 뒤 다시 부른다.

- [ ] **Step 5: 태블릿 · 밤 캡처 3 장.** `…/nowhere?noIntro=1&cam=street&time=14&tier=tablet` 에서 `roadster-a-roll-tablet` · `roadster-b-flip-tablet`, `…/nowhere?noIntro=1&cam=street&time=21.5` 에서 `roadster-a-takeoff-night`. 그다음 Bash:

```bash
mkdir -p build/nowhere/compare && cp /tmp/nw-roadster/roadster-*.png build/nowhere/compare/ && ls build/nowhere/compare/roadster-* | wc -l
```

Expected: 14(Task 5 의 `roadster-t5-a-roll.png` 포함). 13 장을 Read 로 보고 장마다 한 줄로 적는다: 차 모양이 흰 쐐기로 읽히는지, 분사 방향 · 길이(뒤 · 바닥), A 롤 중간에 차가 누워 있는지, B 가 두 정차 포드 위에서 뒤집혀 있는지, B 착지 때 노면을 뚫지 않는지, 휠이 검게 보이는지, 밤에 분사가 혼자 빛나지 않고 빨간 꼬리 줄이 보이는지, 글자 · 로고가 없는지.

- [ ] **Step 6: 예산을 잰다.** 등급마다(`데스크톱` · `&tier=tablet` · `&tier=mobile`) 거리 시점을 열고(대화상자 · 준비 · 3 s · 도우미) 아래 순서로 잰다. 시점마다 evaluate 한 번(1.2 s).

```js
// 기준(로드스터 전과 같은 상태): 두 대를 숨는 시각(A 17 s · B 19.5 s)에 붙잡고 정차 포드를 숨긴다
await state.page.evaluate(() => { window.__rdHold({ roadster_a: 17, roadster_b: 19.5 }); window.__rdUncull(false); return window.__rdParked(false); });
const base = []; for (const id of ['street', 'future', 'aerial']) base.push(await state.page.evaluate(async (id) => { const app = window.__NW_APP; app.setCameraPreset(id, true); await new Promise((r) => setTimeout(r, 1200)); const s = app.getStats(); return { id, calls: s.calls, tris: s.triangles }; }, id)); console.log(JSON.stringify(base));
```

```js
// 최악: 두 대를 분사 순간에 붙잡고(차 2 + 분사 2) 정차 포드를 보이고, 화면 밖 컬링까지 끈다(상한)
const ev = state.ev; await state.page.evaluate((ev) => { window.__rdHold({ roadster_a: ev.roadster_a.thrustOn + 0.15, roadster_b: ev.roadster_b.thrustOn + 0.1 }); window.__rdUncull(true); return window.__rdParked(true); }, ev);
const worst = []; for (const id of ['street', 'future', 'aerial']) worst.push(await state.page.evaluate(async (id) => { const app = window.__NW_APP; app.setCameraPreset(id, true); await new Promise((r) => setTimeout(r, 1200)); const s = app.getStats(); return { id, calls: s.calls, tris: s.triangles }; }, id)); console.log(JSON.stringify(worst));
```

  휴대폰(`&tier=mobile`)은 도우미를 심지 않고 그대로 잰다(로드스터 없음). 결과를 표로 적고 `/tmp/nw-roadster/roadster-measure.json` 으로 저장한 뒤 `build/nowhere/compare/` 로 복사한다.

| 등급 | 시점 | 준비 단계 기준(§3.1) | 기준(붙잡아 숨김) | 최악(상한) | 예산 | 판정 |
|---|---|---|---|---|---|---|
| 데스크톱 | street · future · aerial | calls / tris | calls / tris | calls / tris | ≤ 300 / 2.0 M | |
| 태블릿 | 같음 | (모바일 값) | | | ≤ 186 / 0.92 M | |
| 휴대폰 | 같음 | 178 / 898,927(최악) | — | 그대로 | ≤ 180 / 0.9 M, 준비 단계와 같아야 한다 | |

  Expected: 최악 − 기준 = 그리기 +5, 삼각형 + (차체 2 + 분사 2 + 592 × 2). 기준 = 준비 단계 값(같지 않으면 원인을 적는다). 예산을 넘으면 넘은 칸과 양을 적고 CP 에서 사용자에게 묻는다(이 태스크에서 줄이지 않는다).

- [ ] **Step 7: FPS 를 잰다.** 페이지를 새로 열어(붙잡기 해제) 거리 시점에서 `document.visibilityState` 가 `'visible'` 인지 먼저 본다. `'hidden'` 이면 사용자에게 탭을 앞으로 가져와 달라고 요청하고 기다린다(`bringToFront` 는 쓰지 않는다). 아래 호출을 20 번(40 s — 두 대가 한 번씩 지나간다) 되풀이해 최소 · 평균을 낸다.

```js
console.log(JSON.stringify(await state.page.evaluate(async () => { await new Promise((r) => setTimeout(r, 2000)); const s = window.__NW_APP.getStats(); return { fps: s.fps, calls: s.calls, vis: document.visibilityState }; })))
```

  데스크톱과 `&tier=tablet` 두 번. 함께 적는다: `pmset -g batt` 첫 줄, `ps -A -o %cpu,comm | sort -rn | head -5`, `__NW_APP.renderer.getPixelRatio()` 와 캔버스 크기. 기준: 평균 ≥ 60.

- [ ] **Step 8: 휴대폰 · DS2 · 걷기 장애물을 확인한다.** 보행 격자는 만드는 데 수 초 걸릴 수 있어 먼저 만들기만 걸고, 다음 호출들에서 읽는다.

```js
await state.page.evaluate(() => { setTimeout(() => { window.__wb = window.__NW_APP.world.getWalkBlocker(); }, 0); return 'started'; })
```

```js
// 'wait' 가 아니게 될 때까지 되풀이
console.log(await state.page.evaluate(() => { const app = window.__NW_APP; if (!window.__wb) return 'wait'; const hidden = []; app.world.layerGroups.future.traverse((n) => { if (n.isMesh && /^FU_(roadster|parked_pod)/.test(n.name)) hidden.push([n.name, n.visible]); }); return { device: app.getStats().device, roadsters: app.world.moverActors.filter((a) => a.def.kind === 'roadster').length, hidden, podBlocked: window.__wb.isBlocked(-30, 36.9, 0.4) }; }))
```

  - `&tier=mobile`: `device 'phone'`, `roadsters 0`, `hidden` 의 visible 이 모두 false, `podBlocked false`. 40 s 동안 화면에 로드스터 · 정차 포드가 보이지 않는다(2 s 마다 `getStats().calls` 가 Step 6 휴대폰 값과 같다), 콘솔 오류 0.
  - 데스크톱 · `&tier=tablet`: `roadsters 2`, `podBlocked true`(정차 포드가 보행을 막는다).
  - DS2: `http://localhost:4173/nowhere-mountain?noIntro=1&cam=street&time=14` 의 그리기 · 삼각형이 준비 단계 `before-ds2.json` 과 같다, 콘솔 오류 0.

- [ ] **Step 9: 보고서 + CP 자료.** 캡처 13 장 경로와 장별 관찰, 예산 표, FPS 표(전원 · 부하 포함), 휴대폰 · DS2 · 걷기 결과, 찾은 문제(고칠 곳 · 이유). 컨트롤러는 이 보고서로 §3.3 CP 를 진행한다.

- [ ] **Step 10: 스테이징** — 바뀐 추적 파일이 없다(`git status --short` 가 깨끗해야 한다). 커밋 메시지 안 없음.

---

### Task 7: CP 반영 · 문서 · 전체 굽기 빌드 · 최종 리뷰

**Files:**
- Modify(CP 결정이 있을 때): `tools/nowhere/blender/future.py`(`RD_A` · `RD_B` · `RD_STEP`, 모양 상수 `RD_SIDE` · `RD_CANOPY` · `RD_WHEEL` · `RD_ARCH` · `RD_WING` · `PLUME_*`), `public/src/nowhere/world.js`(`createPlumeMaterial` 의 색 · 알파만)
- Modify: `README.md`(5행 성수 소개, 23행 품질 강제, §2 히어로 캡처 절차 3 의 메모)
- 산출물: GLB · `layout.json`(전체 굽기), `build/nowhere/compare/roadster-*-final.png`

**Interfaces:**
- Consumes: §3.3 CP 결과, Task 3–6 산출물 · 도우미
- Produces: 최종 값 · 문서 · 굽기 빌드, 최종 리뷰 결과

- [ ] **Step 1: CP 결정을 적용한다.**
  - 시간표: `future.py` 의 `RD_A` · `RD_B` 를 고친다. 바꾼 값은 §1.2 표 형식으로 보고서에 새로 쓴다.
  - 모양: `build/nowhere/scratch/roadster_shape.py` 의 상수를 고치고 라이브 Blender 에서 다시 본다(`mcp__blender__get_addon_status` 먼저, 라이브 파일 저장 · 다른 파일 열기 금지). `execute_blender_code` 로 아래 첫 코드를 실행하고 `look` 네 가지를 본 뒤, 둘째 코드로 시안을 지운다. 확정한 상수를 `future.py` (9) 절에 같은 값으로 옮긴다.
    - 옆 · 위 · 3/4: `mcp__blender__look(mode="angles", target=["SCR_roadster"], views=["front", "top", "three_quarter"], shading="material", max_size=640)`
    - 코 · 꼬리: `mcp__blender__look(mode="angles", target=["SCR_roadster"], views=["left", "right", [0.7, -0.6, 0.35]], shading="material", max_size=640)`(`left` = 코, `right` = 꼬리)
    - 70 m: `mcp__blender__look(mode="angles", target=["SCR_roadster"], views=[[-0.99, -0.12, 0.02]], distance=70, shading="material", max_size=480)`
    - 분사: `for k in bpy.data.objects['SCR_roadster_plume'].data.shape_keys.key_blocks[1:]: k.value = 1.0` 뒤 `mcp__blender__look(mode="angles", target=["SCR_roadster"], views=["front", "right"], shading="material", max_size=512)`
    - 대조 목록: 길고 낮은 쐐기(코가 가장 낮음) · 흰 차체 · 어두운 유리 캐노피 · 검은 휠(테가 후드 선 위로 튀지 않음) · 꼬리의 가는 빨간 줄 · 노즐 4 · 지주로 띄운 윙 · 글자 없음 · 70 m 에서 흰 쐐기로 읽힘 · 치수 4.4 × 1.95 × 1.15 ±0.07 · 차체 ≤ 3,000 · 분사 ≤ 400 삼각형

```python
import bpy, math
ROOT = '/Users/gm_yeonho/new-work/so/so-viewer-monster1267'
ns = {'__name__': 'nw_roadster_scratch'}
exec(open(f'{ROOT}/tools/nowhere/blender/future.py').read(), ns)
exec(open(f'{ROOT}/build/nowhere/scratch/roadster_shape.py').read(), ns)
sc = bpy.context.scene
C = bpy.data.collections.get('SCR_roadster') or bpy.data.collections.new('SCR_roadster')
if C.name not in [c.name for c in sc.collection.children]:
    sc.collection.children.link(C)
for o in list(C.objects):
    bpy.data.objects.remove(o, do_unlink=True)
blend_ids = [i.identifier for i in bpy.types.Material.bl_rna.properties['surface_render_method'].enum_items]

def smat(name, hexcol, emit=0.0, alpha=1.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bs = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')   # 종류로 찾는다
    col = ns['srgb'](hexcol)
    bs.inputs['Base Color'].default_value = col                             # 색은 셰이더 노드 입력에
    bs.inputs['Emission Color'].default_value = col
    bs.inputs['Emission Strength'].default_value = emit
    bs.inputs['Alpha'].default_value = alpha
    if alpha < 1.0 and 'BLENDED' in blend_ids:
        m.surface_render_method = 'BLENDED'
    return m

mats = [smat('SCR_white', '#EEF1F2'), smat('SCR_red', '#E33739', 6.0), smat('SCR_black', '#121416'),
        smat('SCR_glass', '#0C1013'), smat('SCR_wheel', '#3A3E42')]
me = ns['_weld'](ns['roadster_mb']().to_mesh('SCR_roadster', mats))
car = bpy.data.objects.new('SCR_roadster', me)
C.objects.link(car)
car.location = (0.0, -37.125, ns['RD_AXIS'])
car.rotation_euler = (0.0, 0.0, math.pi)
pme, rear, bottom = ns['plume_mesh']('SCR_roadster_plume')
pme.materials.append(smat('SCR_plume', '#F2F5F6', 0.0, 0.45))
pl = bpy.data.objects.new('SCR_roadster_plume', pme)
C.objects.link(pl)
pl.parent = car
ns['_plume_keys'](pl, rear, bottom)
print('dims', tuple(round(d, 3) for d in car.dimensions), '| 차체 삼각형', sum(len(p.vertices) - 2 for p in me.polygons),
      '| 분사 삼각형', sum(len(p.vertices) - 2 for p in pme.polygons))
```

```python
import bpy
C = bpy.data.collections.get('SCR_roadster')
if C is not None:
    for o in list(C.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.collections.remove(C)
for me in [m for m in bpy.data.meshes if m.name.startswith('SCR_') and m.users == 0]:
    bpy.data.meshes.remove(me)
for m in [m for m in bpy.data.materials if m.name.startswith('SCR_') and m.users == 0]:
    bpy.data.materials.remove(m)
```

  - 분사 밝기 · 알파: `world.js` `createPlumeMaterial` 의 `color` · `emissive` · 알파 곱 0.75 만 바꾼다.
  - 첫 등장 시각: 사용자가 바꾸라고 하면 `RD_A` · `RD_B` 의 시각이 아니라 위상(`mover_table` 의 `(0.0, RD_PERIOD / 2)`)을 같은 양만큼 옮긴다(두 차 20 s 차이는 그대로).
  - 바꿀 것이 없으면 이 단계를 건너뛰고 적는다.

- [ ] **Step 2: README 를 고친다.**

  5행 끝 `풍력 회전자가 \`layout.movers\` 경로를 따라 움직입니다` 를 아래로 바꾼다.

```markdown
풍력 회전자가 `layout.movers` 경로를 따라 움직입니다. 20 초에 한 번 뚝섬로에서 흰 날으는 로드스터가 분사로 떠올라 배럴 롤 뒤 지붕 너머로 날아가거나(A) 정차 포드 두 대를 킥플립으로 뛰어넘어 착지합니다(B). 로드스터는 데스크톱 · 태블릿에서만 보입니다
```

  23행을 바꾼다.

```markdown
- **품질 · 기기 강제 테스트**: `http://localhost:4173/?tier=mobile`(휴대폰 — 날으는 로드스터 없음) · `?tier=tablet`(모바일 등급 + 태블릿 — 로드스터 보임) · `?tier=desktop`
```

  §2 히어로 캡처 절차 3 의 코드 블록 바로 아래에 넣는다(들여쓰기 5 칸, 절차 목록 안).

```markdown
     `t = 30` 에는 날으는 로드스터 B 가 거리 시점 근경을 지난다. 로드스터를 빼려면 두 대가 모두 숨는 시각을 고른다(`layout.movers` 의 로드스터 `phase` + `visible` 밖 — 처음 값으로 A 0 … 14.4 s, B 20 … 39.1 s, 40 s 주기).
```

- [ ] **Step 3: 전체 굽기 빌드 · 최적화 · 테스트.**

```bash
npm run nowhere:build -- -- --rebuild 2>&1 | tee build/nowhere/rd-final-build.log | grep -E "roadsters|parked pods|movers|bake_vertex_ao|Traceback|Error|Done in"
npm run nowhere:optimize 2>&1 | tee build/nowhere/rd-final-opt.log | grep -iE "error|warn" ; echo "optimize rc=${PIPESTATUS[0]}"
npm test 2>&1 | tail -4
git status --short public/assets
```

Expected: `bake_vertex_ao: … Cycles AO targets`, `Done in` 약 40 s, `optimize rc=0`, `# pass 202`, `# fail 0`. `public/assets/nowhere-ds2` 는 바뀌지 않는다. 굽기로 바뀐 산출물(`nowhere-ground-mask.webp` 등)이 있으면 목록과 크기를 적는다.

- [ ] **Step 4: 다시 잰다 · 다시 찍는다.** 컨트롤러는 이 태스크 브리프에 Task 6 의 Step 1(열기 · 대화상자 · 준비 · 도우미 심기), Step 2(사건 시각 · 캡처 시각 표), Step 3(한 장 찍기), Step 6(기준 · 최악 측정), Step 7(FPS) 코드 블록을 그대로 붙여 준다. 그 코드로 데스크톱 · `&tier=tablet` · `&tier=mobile` 를 다시 열어 기준 · 최악 그리기 · 삼각형과 FPS(데스크톱 · 태블릿, 2 s × 20 번, `pmset -g batt` · 부하 포함)를 다시 잰다. CP 에서 바꾼 장면은 같은 시각 규칙으로 다시 찍어 `/tmp/nw-roadster/roadster-<이름>-final.png` 로 저장하고 `cp /tmp/nw-roadster/roadster-*-final.png build/nowhere/compare/` 한다. 표는 Task 6 형식으로, 전 · 후를 나란히 적는다.

- [ ] **Step 5: 최종 리뷰(컨트롤러가 `opus` 로 디스패치).** 브랜치 전체 diff(`git diff main...HEAD` 와 스테이징 안 된 변경)를 아래 항목으로 대조한다. 지적 사항은 한 번의 수정 묶음으로 처리하고 Step 3 의 테스트를 다시 돌린다.
  - Global Constraints(상표 0, 예산 · FPS, DS2 불변, 휴대폰 제외, 단일 사용자 메시 규칙, 한국어 주석)
  - 스펙 §2–§6 의 각 항목이 코드 · 테스트 · 캡처로 뒷받침되는지(§0 결정 표 행마다)
  - 테스트가 실제를 검사하는지(GLB · layout 을 읽는 테스트가 빌드 산출물과 맞는지)

- [ ] **Step 6: 스테이징(커밋하지 않음)** — 컨트롤러가 리뷰 뒤 실행한다. 굽기로 바뀐 다른 산출물은 Step 3 목록을 보고 같은 명령에 경로로 더한다.

```bash
git add README.md tools/nowhere/blender/future.py public/src/nowhere/world.js \
  public/assets/nowhere/nowhere-future.glb public/assets/nowhere/mobile/nowhere-future.glb public/assets/nowhere/layout.json
```

커밋 메시지 안: `feat(nowhere): 날으는 로드스터 마무리 — CP 조정 · 굽기 빌드 · 문서`(CP 조정이 없으면 `docs(nowhere): 날으는 로드스터 문서 · 굽기 빌드`)

---

## 5. 위험과 대응

| 위험 | 대응 |
|---|---|
| optimize 가 분사 morph target 을 잃거나 이름(`targetNames`)을 지움 | future-layout (l) 이 데스크톱 · 모바일 GLB 의 target 2 개를 검사한다. 이름이 없으면 웹은 Blender 순서(0 rear · 1 bottom)를 쓴다. target 이 사라지면 멈추고 보고한다(대안 — 분사 원뿔을 웹에서 만들기 — 은 스펙 변경이라 사용자 결정) |
| gltf-transform dedup · instance 가 차체 · 분사 이름을 지움 | 사본마다 정점 AO 배율(1.0 · 0.97)을 달리하고 `_assert_unique` 로 Blender 에서 막는다. 정차 포드는 AO 0.86 으로 이동 포드와 다르게. movers (e) · future-layout (l) 이 GLB 노드 이름을 검사한다 |
| 촘촘한 위치 키 + 키마다 smoothstep 이면 롤이 끊김 | 채널은 사건 키에만 둔다(§1.3). movers (h) 가 롤이 줄지 않고 가운데가 빠른지 본다 |
| 시각이 고르지 않은 키의 Catmull-Rom 이 노면 아래로 내려감 | 시각 반영 접선 + B 착지 0.3 s 받침(내려오는 속도 0) + 0.05 s 키. clearance (f) 가 노면 아래 5 cm 를 넘지 않는지 본다 |
| A 롤이 HAUS(81 m)에 가까움 | 롤은 차로 위(HAUS 에서 11 m)에서만 하고 x −29 뒤에 북서쪽으로 돈다. clearance (f) 비행 3 m |
| 두 대가 함께 보이는 최악은 실제로 오지 않아 예산을 놓침 | 두 대를 붙잡고 컬링까지 꺼 상한을 잰다(Task 6 Step 6) |
| 백그라운드 탭 rAF 제한으로 FPS 가 낮게 나옴 | `visibilityState` 를 먼저 보고, 숨어 있으면 사용자에게 탭을 앞으로 가져와 달라고 한다 |
| 라이브 Blender 의 사용자 작업을 건드림 | 시안은 `SCR_*` 에만 만들고 지운다. 파일 저장 · 열기 금지 |
| 정차 포드가 인트로 · 투어 비행 경로 여유(2 m)를 깨뜨림 | clearance (b)(c) 가 잡는다. 실패하면 멈추고 보고(포드 자리는 스펙 값) |
| 휴대폰에서 정차 포드가 보이지 않는데 보행 장애물로 남음 | 숨김을 병합 전에 하고, 보행 격자는 숨긴 메시를 건너뛴다. Task 5 Step 4 가 `podBlocked false` 를 본다 |
| 밤에 흰 분사가 혼자 빛남 | Lambert(조명 반응) + 약한 emissive. 밤 캡처로 확인하고 CP 에서 조정 |

## 6. 범위 밖

- 스펙 §7: 소리, 문이 열리는 동작, 바퀴 회전 메시, 보행자 반응, DS2 월드, 사용자가 로드스터를 조종하거나 타는 기능.
- 아래로 접히는 전조등(레퍼런스 설명일 뿐, 모델은 빨간 꼬리 줄만 단다).
- 히어로 렌더 WebP 다시 만들기(README 에 시각 메모만 남긴다).
- 로드스터 앵커(정보 카드) · 도움말 문구.
