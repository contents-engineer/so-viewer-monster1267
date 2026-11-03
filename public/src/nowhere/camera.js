// HAUS NOWHERE — 성수 2041: 카메라 컨트롤러 (프리셋 전환 · 12초 인트로 경로 · 자유 궤도 · 1.7m 보행 시점 · 드론 비행).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createCameraController({ camera, canvas, layout, onPresetChange = null, onWalkChange = null }) {
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.maxPolarAngle = Math.PI * 0.56;
  controls.minDistance = 0.25;
  controls.maxDistance = 1800;

  const cameras = Array.isArray(layout?.cameras) ? layout.cameras : [];
  let currentPresetId = 'street';
  let walkMode = false;

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
    if (!walkMode && (e.key === 'w' || e.key === 'W') && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      setWalkMode(true);
      return;
    }
    if (walkMode && e.key === 'Escape') {
      e.preventDefault();
      setWalkMode(false);
      return;
    }
    if (walkMode) {
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
    if (walkMode) {
      // 눈높이 1.7m 고정, 카메라 바로 앞 2m 지점을 타깃으로 두어 드래그로 둘러보기 동작
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0;
      if (forward.lengthSq() < 1e-4) forward.set(1, 0, -0.3);
      forward.normalize();

      if (camera.position.y > 6 || camera.position.y < 0.8) {
        camera.position.set(-72.0, 1.7, 36.5);
      } else {
        camera.position.y = 1.7;
      }
      controls.target.copy(camera.position).addScaledVector(forward, 2.5);
      controls.target.y = 1.7;
      controls.minDistance = 0.1;
      controls.maxDistance = 4.0;
      controls.enablePan = false;
      camera.fov = 50;
      camera.updateProjectionMatrix();
      controls.update();
    } else {
      controls.minDistance = 1.5;
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
      camera.position.y = 1.7;
      controls.target.y = Math.max(0.4, Math.min(3.2, controls.target.y));
      const speed = 9.0 * dt;
      const fwd = new THREE.Vector3().subVectors(controls.target, camera.position);
      fwd.y = 0;
      if (fwd.lengthSq() > 1e-5) {
        fwd.normalize();
        const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
        const move = new THREE.Vector3();
        if (walkKeys.has('KeyW') || walkKeys.has('ArrowUp')) move.add(fwd);
        if (walkKeys.has('KeyS') || walkKeys.has('ArrowDown')) move.sub(fwd);
        if (walkKeys.has('KeyD') || walkKeys.has('ArrowRight')) move.add(right);
        if (walkKeys.has('KeyA') || walkKeys.has('ArrowLeft')) move.sub(right);
        if (move.lengthSq() > 0) {
          move.normalize().multiplyScalar(speed);
          camera.position.add(move);
          controls.target.add(move);
        }
      }
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
