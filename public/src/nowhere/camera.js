// HAUS NOWHERE — 성수 2041: 카메라 컨트롤러 (프리셋 전환 · 12초 인트로 경로 · 자유 궤도 · 1.7m 보행 시점 · 드론 비행).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clampAboveGround, resolveWalkStep } from './terrain.js';
import { stepLook, ORBIT_MAX_POLAR } from './look.js';
import { walkSpeed, stepBody, STEP_UP } from './walk.js';

const EYE_HEIGHT = 1.7;        // 보행 시점 눈높이(지면 기준)
const ORBIT_CLEARANCE = 1.2;   // 궤도·전환·인트로 카메라가 지면 위로 유지할 최소 여유고
const MAX_CLIMB = 1.2;         // 보행으로 오를 수 있는 최대 경사(높이/수평 ≈ 50°) — 암벽은 걸어 오를 수 없다

export function createCameraController({
  camera,
  canvas,
  layout,
  onPresetChange = null,
  onWalkChange = null,
  groundHeightAt = () => 0,
  getWalkBlocker = null,   // 보행 충돌 (x, z) => 막힘 여부 (world.getWalkBlocker, 첫 보행 진입 때 생성)
  onPointerLockChange = null,   // 보행 마우스 시선 고정(포인터 잠금) 상태 변경 알림 (locked) => void
  introPath = null,   // 월드별 인트로 경로 { points, targets }(같은 개수, points[i] 에서 targets[i] 를 봄 — intro-path.js). 없으면 기본 경로
}) {
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.maxPolarAngle = ORBIT_MAX_POLAR;
  controls.minDistance = 0.25;
  controls.maxDistance = 1800;

  const cameras = Array.isArray(layout?.cameras) ? layout.cameras : [];
  let currentPresetId = 'street';
  let walkMode = false;
  let walkBlocker = null;
  // 실내 뷰가 지형 · 장애물 · 보행 대체 위치 · 카메라 영역을 바꿔 끼운다(setTerrain/setBounds)
  let walkFallback = [-72.0, 36.5];
  let bounds = null;
  // 시나리오 비행(flyTo) 상태와 인트로 종료 콜백
  let flight = null;
  let introOnEnd = null;
  // 보행 위치의 기준값. OrbitControls 는 포인터 이벤트 안에서도 update() 로 카메라를 공전시키므로
  // 매 프레임 camera.position 이 아니라 이 값으로 몸 위치를 되돌린다(드래그해도 제자리에서 고개만 돌아감).
  const walkEye = new THREE.Vector3();
  // 보행 몸 상태(발 높이·수직 속도·접지)와 이번 프레임 점프 입력(Space)
  const body = { feetY: 0, vy: 0, grounded: true };
  let jumpQueued = false;

  // 보행 마우스 시선 고정(포인터 잠금, 게임 방식): 보행 중 화면을 클릭하면 마우스만 움직여 둘러본다.
  // 첫 Esc 는 브라우저가 잠금만 풀고(보행 유지), 보행 해제는 그다음 Esc 나 V 로 한다.
  const mouseLook = { dx: 0, dy: 0 };
  let lastUnlockAt = -1e9;
  const downAt = { x: 0, y: 0 };
  const isPointerLocked = () => typeof document !== 'undefined' && document.pointerLockElement === canvas;
  function releasePointer() {
    if (isPointerLocked()) document.exitPointerLock?.();
  }
  canvas.addEventListener('pointerdown', (e) => {
    downAt.x = e.clientX;
    downAt.y = e.clientY;
  });
  canvas.addEventListener('click', (e) => {
    // 드래그로 둘러본 뒤의 click 은 잠그지 않는다(제자리 클릭만)
    if (!walkMode || isPointerLocked() || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return;
    const req = canvas.requestPointerLock?.();
    if (req && typeof req.catch === 'function') req.catch(() => {});
  });
  document.addEventListener('pointerlockchange', () => {
    const locked = isPointerLocked();
    controls.enableRotate = !locked;   // 잠금 중에는 OrbitControls 드래그 회전 대신 마우스 이동량으로 시선 회전
    mouseLook.dx = 0;
    mouseLook.dy = 0;
    if (!locked) lastUnlockAt = performance.now();
    if (typeof onPointerLockChange === 'function') onPointerLockChange(locked);
  });
  document.addEventListener('mousemove', (e) => {
    if (!walkMode || !isPointerLocked()) return;
    mouseLook.dx += e.movementX || 0;
    mouseLook.dy += e.movementY || 0;
  });

  // 프리셋 부드러운 전환 상태
  let transition = null;

  // 12초 인트로 비행 경로 (원경 능선 부감 → 2호선 고가 하부 → 뚝섬로 거리 시점)
  const streetCam = cameras.find((c) => c.id === 'street') || {
    pos: [-105, 1.7, 50.2],
    target: [-30, 5.0, 31.0],
    fov: 39.76,
  };
  // introPath(성수 2041)가 있으면 그 경로, 없으면 기본 경로(DS2)
  const toCurve = (pts) => new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const introPosCurve = toCurve(introPath?.points || [[148.0, 92.0, 138.0], [62.0, 26.0, -95.0], [13.0, 4.2, -148.0], [-58.0, 6.5, 42.0], streetCam.pos]);
  const introTgtCurve = toCurve(introPath?.targets || [[-18.0, 26.0, -68.0], [0.0, 18.0, -25.0], [8.0, 22.0, 0.0], [-10.0, 12.0, 15.0], streetCam.target]);
  // introPath 는 시선을 위치와 같은 매개변수로 맞춘다(points[i] 를 지날 때 targets[i]) — 두 곡선을 따로 호 길이로 나누면
  // 모양이 다를 때 시선이 앞서거나 늦어 길을 따라 날면서 옆을 보게 된다. 기본 경로는 예전처럼 각자 호 길이.
  const introSyncTarget = Boolean(introPath);

  let introActive = false;
  let introElapsed = 0;
  const INTRO_DURATION = 12.0;

  // 보행 모드(1.7m 눈높이) 키 입력 상태
  const walkKeys = new Set();

  // reason: 'complete'(끝까지 재생) | 'skipped'(사용자 입력으로 건너뜀) | 'cancelled'(프리셋 · 보행 등 다른 동작이 끊음)
  function cancelIntro(reason = 'cancelled') {
    if (!introActive) return;
    introActive = false;
    controls.enabled = true;
    const cb = introOnEnd;
    introOnEnd = null;
    if (typeof cb === 'function') cb(reason);
  }

  function startIntro(onEnd = null) {
    if (walkMode) setWalkMode(false);
    stopFlight();
    transition = null;
    introOnEnd = onEnd;
    introActive = true;
    introElapsed = 0;
    camera.fov = 44;
    camera.updateProjectionMatrix();
  }

  // 아무 입력(마우스/터치/휠/키보드)으로 인트로 즉시 건너뛰기
  // 콜백은 거리 시점 배치가 끝난 뒤 부른다('complete' 와 같은 순서) — 콜백이 곧바로 flyTo 를 불러도 setPreset 이 끊지 않게.
  const onUserInterrupt = () => {
    if (!introActive) return;
    const cb = introOnEnd;
    introOnEnd = null;            // setPreset 안의 cancelIntro 가 'cancelled' 로 부르지 않게 미리 떼어 둔다
    setPreset('street', true);    // cancelIntro() → introActive false · controls 복구
    if (typeof cb === 'function') cb('skipped');
  };
  canvas.addEventListener('pointerdown', onUserInterrupt, { passive: true });
  canvas.addEventListener('wheel', onUserInterrupt, { passive: true });
  // 끊을 수 있는 비행(실내 층 둘러보기)은 마우스 · 휠 입력으로도 멈춘다
  const onFlightInterrupt = () => {
    if (flight?.interruptible) stopFlight();
  };
  canvas.addEventListener('pointerdown', onFlightInterrupt, { passive: true });
  canvas.addEventListener('wheel', onFlightInterrupt, { passive: true });
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (flight) {
      // 시나리오 비행 중 키 입력은 무시(Esc 는 main.js 가 캡처 단계에서 먼저 받아 투어를 끝낸다).
      // 끊을 수 있는 비행(실내 층 둘러보기)은 아무 키로 멈추고 그 자리에서 자유 이동
      if (flight.interruptible && !e.metaKey && !e.ctrlKey) {
        // 멈추는 데 쓴 Enter · Space · Tab 의 기본 동작을 막는다 — 포커스된 버튼(「이 층 둘러보기」 등)이
        // 같은 키로 눌려 둘러보기가 다시 시작되거나 포커스가 밀리지 않게
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Tab') e.preventDefault();
        stopFlight();
      }
      return;
    }
    if (introActive && !e.metaKey && !e.ctrlKey) {
      // 건너뛰기에 쓴 Enter · Space · Tab 의 기본 동작을 막는다 — 곧바로 뜨는 건물 선택 모달의 포커스된 버튼이
      // 같은 키의 keypress 로 눌리거나(Enter · Space) 포커스가 밀리지(Tab) 않게
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Tab') e.preventDefault();
      onUserInterrupt();
      return;
    }
    // 보행 시점 토글은 V — 이동키(WASD·방향키)와 겹치지 않게 한다
    if ((e.key === 'v' || e.key === 'V') && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      setWalkMode(!walkMode);
      return;
    }
    if (walkMode && e.key === 'Escape') {
      e.preventDefault();
      // 마우스 고정 중(또는 방금 Esc 로 풀린 직후)의 Esc 는 잠금 해제만 — 보행은 유지
      if (isPointerLocked() || performance.now() - lastUnlockAt < 300) return;
      setWalkMode(false);
      return;
    }
    if (walkMode) {
      if (e.code.startsWith('Arrow')) e.preventDefault();   // 방향키 시선 회전 중 페이지 스크롤 방지
      if (e.code === 'Space') {
        e.preventDefault();                                   // 페이지 스크롤·포커스된 버튼 클릭 방지
        if (!e.repeat) jumpQueued = true;                     // 누를 때 한 번만 점프(누르고 있어도 연속 점프 없음)
      }
      walkKeys.add(e.code);
    }
  });
  window.addEventListener('keyup', (e) => {
    if (walkMode && e.code === 'Space') e.preventDefault();
    walkKeys.delete(e.code);
  });

  function setWalkMode(enabled) {
    cancelIntro();
    stopFlight();
    transition = null;
    walkMode = Boolean(enabled);
    if (walkMode && !walkBlocker && typeof getWalkBlocker === 'function') {
      walkBlocker = getWalkBlocker();
    }
    if (walkMode) {
      // 지면 위 1.7 m 눈높이, 눈 앞 2.5 m 지점을 시선 타깃으로 둔다(드래그·방향키로 제자리에서 둘러보기)
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0;
      if (forward.lengthSq() < 1e-4) forward.set(1, 0, -0.3);
      forward.normalize();

      // 지면 기준 높이로 판단(DS2 는 지형 기복이 커서 절대 높이 1.7 m 가 언덕 속으로 들어간다)
      const above = camera.position.y - groundHeightAt(camera.position.x, camera.position.z);
      if (above > 6 || above < 0.8) {
        camera.position.set(walkFallback[0], 0, walkFallback[1]);
      }
      camera.position.y = groundHeightAt(camera.position.x, camera.position.z) + EYE_HEIGHT;
      controls.target.copy(camera.position).addScaledVector(forward, 2.5);
      controls.target.y = camera.position.y;
      walkEye.copy(camera.position);
      body.feetY = camera.position.y - EYE_HEIGHT;
      body.vy = 0;
      body.grounded = true;
      jumpQueued = false;
      // 보행 버튼 클릭으로 들어왔으면 버튼에 남은 포커스가 Space(점프)를 버튼 클릭으로 바꾸므로 풀어 둔다
      if (typeof document !== 'undefined' && document.activeElement && document.activeElement !== document.body) {
        document.activeElement.blur?.();
      }
      controls.minDistance = 0.1;
      controls.maxDistance = 4.0;
      // 올려다보기·내려다보기 ±80° 를 허용(궤도 모드 상한은 위쪽 시선을 약 22° 로 막는다)
      controls.minPolarAngle = Math.PI * 0.04;
      controls.maxPolarAngle = Math.PI * 0.96;
      controls.enablePan = false;
      camera.fov = 50;
      camera.updateProjectionMatrix();
      controls.update();
    } else {
      releasePointer();
      controls.minDistance = 1.5;
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = ORBIT_MAX_POLAR;
      controls.maxDistance = 1800;
      controls.enablePan = true;
    }
    if (typeof onWalkChange === 'function') {
      onWalkChange(walkMode);
    }
    return walkMode;
  }

  function finishFlight(result) {
    if (!flight) return;
    const done = flight.resolve;
    flight = null;
    controls.enabled = true;
    done(result);
  }

  function stopFlight() {
    finishFlight('cancelled');
  }

  /** 누르고 있던 이동 · 시선 키와 점프 예약을 비운다(모달이 뜰 때 — 질문 중에 계속 걷지 않게). */
  function clearInput() {
    walkKeys.clear();
    jumpQueued = false;
  }

  /**
   * 시나리오 비행: buildFlightPath 결과({ points, targets, duration })를 따라 이동. 끝나면 'done', 끊기면 'cancelled'.
   * interruptible(실내 층 둘러보기)이면 키 · 캔버스 포인터 · 휠 입력으로 멈추고 그 자리에서 자유 이동한다.
   */
  function flyTo(path, { interruptible = false } = {}) {
    cancelIntro();
    if (walkMode) setWalkMode(false);
    stopFlight();
    transition = null;
    const toVecs = (arr) => arr.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    return new Promise((resolve) => {
      flight = {
        posCurve: new THREE.CatmullRomCurve3(toVecs(path.points), false, 'centripetal'),
        tgtCurve: new THREE.CatmullRomCurve3(toVecs(path.targets), false, 'centripetal'),
        duration: Math.max(0.1, path.duration),
        elapsed: 0,
        resolve,
        interruptible,
      };
      controls.enabled = false;   // 비행 중에는 드래그 · 휠 입력을 받지 않는다
    });
  }

  /** 카메라를 즉시 그 자리 · 그 시선으로 옮긴다(실내 진입 · 나가기). */
  function placeAt(pos, target) {
    cancelIntro();
    if (walkMode) setWalkMode(false);   // 보행 중이면 다음 프레임에 walkEye 로 되돌아가므로 궤도 카메라로 바꾼 뒤 옮긴다
    stopFlight();
    transition = null;
    camera.position.fromArray(pos);
    controls.target.fromArray(target);
    controls.update();
  }

  /**
   * 지면 높이 · 보행 장애물 · 보행 대체 시작점(x, z)을 바꿔 끼운다(실내 ↔ 외관).
   * getWalkBlocker 를 빼면 장애물 없음으로 바뀐다(지면만 바꿀 때도 다시 넘긴다). 보행 중이면 새 장애물을 바로 받아 충돌을 유지한다.
   */
  function setTerrain({ groundHeightAt: g, getWalkBlocker: gb = null, walkFallback: wf = null }) {
    if (typeof g === 'function') groundHeightAt = g;
    getWalkBlocker = gb;
    walkBlocker = walkMode && typeof getWalkBlocker === 'function' ? getWalkBlocker() : null;
    if (Array.isArray(wf)) walkFallback = wf;
  }

  /** 실내 궤도 카메라 영역(층 벽 · 천장 안쪽). null 이면 해제. */
  function setBounds(b) {
    bounds = b || null;
  }

  // 실내 궤도 카메라: 층 영역(벽 0.3 m 안쪽) · 천장 아래로 카메라와 시선 타깃을 묶는다
  function clampInsideBounds() {
    const m = 0.3;
    let moved = false;
    for (const v of [camera.position, controls.target]) {
      const x = Math.min(bounds.x1 - m, Math.max(bounds.x0 + m, v.x));
      const y = Math.min(bounds.yMax, Math.max(bounds.yMin, v.y));
      const z = Math.min(bounds.z1 - m, Math.max(bounds.z0 + m, v.z));
      if (x !== v.x || y !== v.y || z !== v.z) {
        v.set(x, y, z);
        moved = true;
      }
    }
    return moved;
  }

  function setPreset(id, instant = false) {
    cancelIntro();
    stopFlight();
    if (walkMode) setWalkMode(false);
    const camDef = cameras.find((c) => c.id === id) || cameras[0];
    if (!camDef) return null;
    currentPresetId = camDef.id;

    if (instant) {
      transition = null;
      camera.position.fromArray(camDef.pos);
      camera.fov = camDef.fov || 40;
      camera.updateProjectionMatrix();
      controls.target.fromArray(camDef.target);
      controls.update();
    } else {
      transition = {
        elapsed: 0,
        duration: 1.35,
        fromPos: camera.position.clone(),
        toPos: new THREE.Vector3().fromArray(camDef.pos),
        fromTgt: controls.target.clone(),
        toTgt: new THREE.Vector3().fromArray(camDef.target),
        fromFov: camera.fov,
        toFov: camDef.fov || 40,
      };
    }

    if (typeof onPresetChange === 'function') {
      onPresetChange(camDef);
    }
    return camDef;
  }

  function focusWorldPoint(worldPos, distance = 36) {
    cancelIntro();
    if (walkMode) setWalkMode(false);
    const toTarget = new THREE.Vector3().fromArray(
      Array.isArray(worldPos) ? worldPos : [worldPos.x, worldPos.y, worldPos.z],
    );
    const dir = camera.position.clone().sub(controls.target);
    if (dir.lengthSq() < 1) dir.set(-25, 14, 28);
    dir.normalize().multiplyScalar(distance);
    const toPos = toTarget.clone().add(dir);
    toPos.y = Math.max(2.0, toPos.y);

    transition = {
      elapsed: 0,
      duration: 1.0,
      fromPos: camera.position.clone(),
      toPos,
      fromTgt: controls.target.clone(),
      toTgt: toTarget,
      fromFov: camera.fov,
      toFov: camera.fov,
    };
  }

  function update(dt) {
    stepCamera(dt);
    // 모든 모드(궤도·프리셋 전환·인트로)에서 카메라가 지면 아래로 내려가지 않게 한다.
    // 보행 모드는 stepCamera 에서 지면 + 눈높이로 이미 맞춘다.
    if (!walkMode && clampAboveGround(camera.position, groundHeightAt, ORBIT_CLEARANCE)) {
      controls.update();
    }
    if (bounds && !walkMode && clampInsideBounds()) {
      controls.update();
    }
  }

  function stepCamera(dt) {
    if (flight) {
      flight.elapsed += dt;
      const t = Math.min(1, flight.elapsed / flight.duration);
      const u = t * t * (3 - 2 * t);
      flight.posCurve.getPoint(u, camera.position);
      flight.tgtCurve.getPoint(u, controls.target);
      controls.update();
      if (t >= 1) finishFlight('done');
      return;
    }
    if (introActive) {
      introElapsed += dt;
      const t = Math.min(1, introElapsed / INTRO_DURATION);
      const u = t * t * (3 - 2 * t);
      if (introSyncTarget) {
        const s = introPosCurve.getUtoTmapping(u);   // 위치는 getPointAt(u) 와 같음
        introPosCurve.getPoint(s, camera.position);
        introTgtCurve.getPoint(s, controls.target);
      } else {
        introPosCurve.getPointAt(u, camera.position);
        introTgtCurve.getPointAt(u, controls.target);
      }
      camera.fov = THREE.MathUtils.lerp(44, streetCam.fov || 39.76, u);
      camera.updateProjectionMatrix();
      controls.update();
      if (t >= 1) {
        introActive = false;
        controls.enabled = true;
        setPreset('street', true);
        const cb = introOnEnd;
        introOnEnd = null;
        if (typeof cb === 'function') cb('complete');
      }
      return;
    }

    if (transition) {
      transition.elapsed += dt;
      const t = Math.min(1, transition.elapsed / transition.duration);
      const u = t * t * (3 - 2 * t);
      camera.position.lerpVectors(transition.fromPos, transition.toPos, u);
      controls.target.lerpVectors(transition.fromTgt, transition.toTgt, u);
      camera.fov = THREE.MathUtils.lerp(transition.fromFov, transition.toFov, u);
      camera.updateProjectionMatrix();
      controls.update();
      if (t >= 1) {
        transition = null;
      }
      return;
    }

    if (walkMode) {
      // 1) 마우스 드래그(OrbitControls)는 타깃을 중심으로 몸을 공전시키므로, 갱신 뒤 시선 방향만 취하고
      //    몸은 제자리에 둔다 → 게임처럼 제자리에서 고개를 돌린다.
      controls.update();
      const look = new THREE.Vector3().subVectors(controls.target, camera.position);
      if (look.lengthSq() < 1e-8) look.set(0, 0, -1);
      camera.position.copy(walkEye);
      // 2) 키 시선(게임 방식): ↑/↓ 올려다보기·내려다보기, ←/→ 좌우로 돌아보기 + 마우스 고정 중 마우스 이동량 (상하 ±80°)
      const dir = stepLook(look, walkKeys, dt, {}, mouseLook);
      mouseLook.dx = 0;
      mouseLook.dy = 0;
      // 3) 이동(WASD, Shift 달리기): 시선의 수평 성분 기준
      const fwd = new THREE.Vector3(dir.x, 0, dir.z);
      if (fwd.lengthSq() > 1e-8) {
        fwd.normalize();
        const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
        const move = new THREE.Vector3();
        if (walkKeys.has('KeyW')) move.add(fwd);
        if (walkKeys.has('KeyS')) move.sub(fwd);
        if (walkKeys.has('KeyD')) move.add(right);
        if (walkKeys.has('KeyA')) move.sub(right);
        if (move.lengthSq() > 0) {
          move.normalize().multiplyScalar(walkSpeed(walkKeys) * dt);
          // 장애물은 발 높이 + 턱(0.35 m)보다 높으면 막힌다 → 점프 중에는 낮은 바위·화단 벽을 넘을 수 있다.
          // 접지 중 50° 넘는 오르막은 못 오르고, 공중에서는 발보다 높은 비탈로 파고들지 않는다. 막히면 벽을 따라 미끄러진다.
          const here = camera.position;
          const gHere = groundHeightAt(here.x, here.z);
          const canStand = (x, z) => {
            const g = groundHeightAt(x, z);
            if (walkBlocker && walkBlocker.isBlocked(x, z, body.feetY - g + STEP_UP)) return false;
            if (!body.grounded) return g <= body.feetY + STEP_UP;
            const run = Math.hypot(x - here.x, z - here.z);
            return run < 1e-6 || (g - gHere) / run <= MAX_CLIMB;
          };
          const next = resolveWalkStep(here, move.x, move.z, canStand);
          camera.position.x = next.x;
          camera.position.z = next.z;
          // 실내(setBounds)에서는 보행도 층 영역(벽 안쪽, 몸 반경 0.35 m) 안으로 묶는다 —
          // 막힌 자리(궤도 카메라가 벽 쪽에 붙은 채 보행 시작 등)에서 빠져나오는 이동이 벽 밖으로 새지 않게
          if (bounds) {
            const r = 0.35;
            camera.position.x = Math.min(bounds.x1 - r, Math.max(bounds.x0 + r, camera.position.x));
            camera.position.z = Math.min(bounds.z1 - r, Math.max(bounds.z0 + r, camera.position.z));
          }
        }
      }
      // 4) 수직: 발밑 표면(지면 또는 발이 닿는 장애물 윗면)에 붙거나, 점프·낙하 중이면 중력으로 진행
      const gx = groundHeightAt(camera.position.x, camera.position.z);
      const top = walkBlocker ? walkBlocker.topAt(camera.position.x, camera.position.z) : 0;
      const support = top > 0 && gx + top <= body.feetY + STEP_UP ? gx + top : gx;
      stepBody(body, support, dt, jumpQueued);
      jumpQueued = false;
      camera.position.y = body.feetY + EYE_HEIGHT;
      walkEye.copy(camera.position);
      controls.target.set(
        camera.position.x + dir.x * 2.5,
        camera.position.y + dir.y * 2.5,
        camera.position.z + dir.z * 2.5,
      );
      return;   // OrbitControls 는 1) 에서 이미 갱신했다
    }

    controls.update();
  }

  return {
    controls,
    getPresetId: () => currentPresetId,
    isWalkMode: () => walkMode,
    isPointerLocked,
    releasePointer,
    isIntroActive: () => introActive,
    setPreset,
    setWalkMode,
    startIntro,
    cancelIntro,
    focusWorldPoint,
    flyTo,
    stopFlight,
    isFlying: () => Boolean(flight),
    clearInput,
    placeAt,
    setTerrain,
    setBounds,
    update,
  };
}

const _dronePos = new THREE.Vector3();
const _droneNext = new THREE.Vector3();
const _droneLook = new THREE.Vector3();

export function updateDroneActors(droneActors, elapsed) {
  if (!Array.isArray(droneActors)) return;
  for (const d of droneActors) {
    const u = ((elapsed * d.speed) / d.length + d.phase) % 1.0;
    const uNext = (u + 0.015) % 1.0;
    d.curve.getPointAt(u, _dronePos);
    d.curve.getPointAt(uNext, _droneNext);
    _dronePos.y += Math.sin(elapsed * 2.4 + d.phase * 10) * 0.28;
    d.object.position.copy(_dronePos);

    _droneLook.copy(_droneNext);
    _droneLook.y = _dronePos.y;
    d.object.lookAt(_droneLook);

    if (d.beam) {
      d.beam.position.copy(_dronePos);
      d.beam.rotation.y = d.object.rotation.y + Math.sin(elapsed * 1.1) * 0.22;
    }
  }
}
