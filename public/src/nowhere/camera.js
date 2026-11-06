// HAUS NOWHERE — 성수 2041: 카메라 컨트롤러 (프리셋 전환 · 12초 인트로 경로 · 자유 궤도 · 1.7m 보행 시점 · 드론 비행).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clampAboveGround, resolveWalkStep } from './terrain.js';
import { stepLook } from './look.js';

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
}) {
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.maxPolarAngle = Math.PI * 0.56;
  controls.minDistance = 0.25;
  controls.maxDistance = 1800;

  const cameras = Array.isArray(layout?.cameras) ? layout.cameras : [];
  let currentPresetId = 'street';
  let walkMode = false;
  let walkBlocker = null;
  // 보행 위치의 기준값. OrbitControls 는 포인터 이벤트 안에서도 update() 로 카메라를 공전시키므로
  // 매 프레임 camera.position 이 아니라 이 값으로 몸 위치를 되돌린다(드래그해도 제자리에서 고개만 돌아감).
  const walkEye = new THREE.Vector3();

  // 프리셋 부드러운 전환 상태
  let transition = null;

  // 12초 인트로 비행 경로 (원경 능선 부감 → 2호선 고가 하부 → 뚝섬로 거리 시점)
  const streetCam = cameras.find((c) => c.id === 'street') || {
    pos: [-105, 1.7, 50.2],
    target: [-30, 5.0, 31.0],
    fov: 39.76,
  };
  const introPosCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(148.0, 92.0, 138.0),
    new THREE.Vector3(62.0, 26.0, -95.0),
    new THREE.Vector3(13.0, 4.2, -148.0),
    new THREE.Vector3(-58.0, 6.5, 42.0),
    new THREE.Vector3(...streetCam.pos),
  ]);
  const introTgtCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-18.0, 26.0, -68.0),
    new THREE.Vector3(0.0, 18.0, -25.0),
    new THREE.Vector3(8.0, 22.0, 0.0),
    new THREE.Vector3(-10.0, 12.0, 15.0),
    new THREE.Vector3(...streetCam.target),
  ]);

  let introActive = false;
  let introElapsed = 0;
  const INTRO_DURATION = 12.0;

  // 보행 모드(1.7m 눈높이) 키 입력 상태
  const walkKeys = new Set();

  function cancelIntro() {
    if (!introActive) return;
    introActive = false;
    controls.enabled = true;
  }

  function startIntro() {
    if (walkMode) setWalkMode(false);
    transition = null;
    introActive = true;
    introElapsed = 0;
    camera.fov = 44;
    camera.updateProjectionMatrix();
  }

  // 아무 입력(마우스/터치/휠/키보드)으로 인트로 즉시 건너뛰기
  const onUserInterrupt = () => {
    if (introActive) {
      cancelIntro();
      setPreset('street', true);
    }
  };
  canvas.addEventListener('pointerdown', onUserInterrupt, { passive: true });
  canvas.addEventListener('wheel', onUserInterrupt, { passive: true });
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (introActive && !e.metaKey && !e.ctrlKey) {
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
      setWalkMode(false);
      return;
    }
    if (walkMode) {
      if (e.code.startsWith('Arrow')) e.preventDefault();   // 방향키 시선 회전 중 페이지 스크롤 방지
      walkKeys.add(e.code);
    }
  });
  window.addEventListener('keyup', (e) => {
    walkKeys.delete(e.code);
  });

  function setWalkMode(enabled) {
    cancelIntro();
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
        camera.position.set(-72.0, 0, 36.5);
      }
      camera.position.y = groundHeightAt(camera.position.x, camera.position.z) + EYE_HEIGHT;
      controls.target.copy(camera.position).addScaledVector(forward, 2.5);
      controls.target.y = camera.position.y;
      walkEye.copy(camera.position);
      controls.minDistance = 0.1;
      controls.maxDistance = 4.0;
      // 올려다보기·내려다보기 ±80° 를 허용(궤도 모드의 0.56π 제한은 위쪽 시선을 약 11° 로 막는다)
      controls.minPolarAngle = Math.PI * 0.04;
      controls.maxPolarAngle = Math.PI * 0.96;
      controls.enablePan = false;
      camera.fov = 50;
      camera.updateProjectionMatrix();
      controls.update();
    } else {
      controls.minDistance = 1.5;
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = Math.PI * 0.56;
      controls.maxDistance = 1800;
      controls.enablePan = true;
    }
    if (typeof onWalkChange === 'function') {
      onWalkChange(walkMode);
    }
    return walkMode;
  }

  function setPreset(id, instant = false) {
    cancelIntro();
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
  }

  function stepCamera(dt) {
    if (introActive) {
      introElapsed += dt;
      const t = Math.min(1, introElapsed / INTRO_DURATION);
      const u = t * t * (3 - 2 * t);
      introPosCurve.getPointAt(u, camera.position);
      introTgtCurve.getPointAt(u, controls.target);
      camera.fov = THREE.MathUtils.lerp(44, streetCam.fov || 39.76, u);
      camera.updateProjectionMatrix();
      controls.update();
      if (t >= 1) {
        introActive = false;
        setPreset('street', true);
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
      // 2) 키 시선(게임 방식): ↑/↓ 올려다보기·내려다보기, ←/→ 좌우로 돌아보기 (상하 ±80°)
      const dir = stepLook(look, walkKeys, dt);
      // 3) 이동(WASD): 시선의 수평 성분 기준
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
          move.normalize().multiplyScalar(9.0 * dt);
          // 장애물(건물·바위·전주 등)과 급경사는 통과하지 못하고, 막힌 방향은 벽을 따라 미끄러진다
          const here = camera.position;
          const gHere = groundHeightAt(here.x, here.z);
          const canStand = (x, z) => {
            if (walkBlocker && walkBlocker(x, z)) return false;
            const run = Math.hypot(x - here.x, z - here.z);
            return run < 1e-6 || (groundHeightAt(x, z) - gHere) / run <= MAX_CLIMB;
          };
          const next = resolveWalkStep(here, move.x, move.z, canStand);
          camera.position.x = next.x;
          camera.position.z = next.z;
        }
      }
      // 4) 지면을 따라 눈높이 유지(오르막·내리막) + 시선 타깃은 눈 앞 2.5 m
      camera.position.y = groundHeightAt(camera.position.x, camera.position.z) + EYE_HEIGHT;
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
    isIntroActive: () => introActive,
    setPreset,
    setWalkMode,
    startIntro,
    cancelIntro,
    focusWorldPoint,
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
