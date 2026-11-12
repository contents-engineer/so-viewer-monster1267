// HAUS NOWHERE — 보행 이동 스팟 마커(DOM 오버레이 — 그리기 0): 스팟 자리 보정(보행 지형이 준비되면 빈 자리로) · 화면 투영 ·
// 단계(멀리 작은 마름모 / 가까이 아이콘 + 이름 / 건물 대표 이름 · 거리) · 가림(보행 충돌 격자) · 클릭 · 탭 · 포인터 잠금 조준 클릭 → onPick(spot).
// 보행 시점일 때만 보이고 비행 · isSuspended(모달 · 조작 안내 · 화면 전환 · 둘러보기) 중에는 숨긴다.
import * as THREE from 'three';
import { spotStage, isSpotOccluded, SPOT_LIFT, SPOT_FAR } from './walk-spots.js';
import { walkPredicates, nearestFreePoint, GOAL_SNAP } from './walk-path.js';

const OCCLUSION_INTERVAL = 0.2;   // s — 가림 검사 간격
const AIM_RADIUS = 22;            // px — 포인터 잠금 조준점이 마커 위로 판정되는 반경(터치 대상 44 px 의 절반)

export function createSpotMarkers({ camera, canvas, camCtrl, onPick, isSuspended = () => false }) {
  const root = document.createElement('div');
  root.className = 'nw-spots';
  root.hidden = true;
  document.body.append(root);

  let raw = [];
  let entries = [];        // { spot(보정된 자리), btn, label, stage, occluded, sx, sy, text }
  let resolvedFor = null;  // 보정에 쓴 보행 장애물(층 · 월드가 바뀌면 다시 보정)
  let occTimer = 0;
  let hoverId = null;
  let aimedId = null;
  const v = new THREE.Vector3();

  function clear() {
    root.replaceChildren();
    entries = [];
    resolvedFor = null;
    hoverId = null;
    aimedId = null;
  }

  /** 스팟 목록을 바꾼다(외관 ↔ 실내 층). 자리 보정 · 마커 생성은 보행 지형이 준비된 다음 update 에서 */
  function setSpots(list) {
    raw = Array.isArray(list) ? list : [];
    clear();
  }

  // 막힌 스팟은 GOAL_SNAP 안 가장 가까운 빈 자리로, 없으면 뺀다
  function resolve(ctx) {
    clear();
    const { isFree } = walkPredicates(ctx);
    for (const s of raw) {
      const p = nearestFreePoint(s.x, s.z, isFree, GOAL_SNAP);
      if (!p) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'nw-spot';
      btn.hidden = true;
      btn.setAttribute('aria-label', s.label);
      const icon = document.createElement('span');
      icon.className = 'nw-spot-icon';
      const label = document.createElement('span');
      label.className = 'nw-spot-label';
      btn.append(icon, label);
      const entry = { spot: { ...s, x: p.x, z: p.z }, btn, label, stage: 'hidden', occluded: false, sx: NaN, sy: NaN, text: '' };
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        btn.blur();   // 포커스가 남으면 Space(점프)가 이 버튼을 다시 누른다
        onPick(entry.spot);
      });
      btn.addEventListener('pointerenter', () => {
        hoverId = s.id;
      });
      btn.addEventListener('pointerleave', () => {
        if (hoverId === s.id) hoverId = null;
      });
      root.append(btn);
      entries.push(entry);
    }
    resolvedFor = ctx.blocker;
    occTimer = 0;   // 새로 보정한 마커는 다음 update 에서 바로 가림을 검사한다
  }

  // 포인터 잠금 중에는 커서가 없으므로 캔버스 클릭이 조준점 아래 마커를 고른다(잠금 유지)
  canvas.addEventListener('click', () => {
    if (document.pointerLockElement !== canvas || !aimedId) return;
    const e = entries.find((x) => x.spot.id === aimedId);
    if (e) onPick(e.spot);
  });

  function hide() {
    root.hidden = true;
    aimedId = null;
    occTimer = 0;   // 다시 보일 때 바로 가림을 검사한다
  }

  function update(dt) {
    if (!camCtrl.isWalkMode() || camCtrl.isFlying() || isSuspended()) return hide();
    const ctx = camCtrl.getWalkContext();
    if (!ctx.blocker) return hide();
    if (resolvedFor !== ctx.blocker) resolve(ctx);
    root.hidden = false;
    camera.updateMatrixWorld();   // 투영이 이번 프레임 회전을 쓰도록(보행 갱신의 lookAt 이 행렬을 갱신하기 전일 수 있다)

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const eye = camera.position;
    occTimer -= dt;
    const checkOcc = occTimer <= 0;
    if (checkOcc) occTimer = OCCLUSION_INTERVAL;
    const locked = document.pointerLockElement === canvas;
    const topAt = (x, z) => ctx.blocker.topAt(x, z, 0);
    let bestAim = null;
    let bestAimD = AIM_RADIUS;

    for (const e of entries) {
      const s = e.spot;
      const dist = Math.hypot(s.x - eye.x, s.z - eye.z);
      const y = ctx.groundHeightAt(s.x, s.z) + SPOT_LIFT;
      if (checkOcc) e.occluded = !s.beacon && dist <= SPOT_FAR && isSpotOccluded(eye, { x: s.x, y, z: s.z }, ctx.groundHeightAt, topAt);
      v.set(s.x, y, s.z).project(camera);
      const onScreen = v.z > -1 && v.z < 1 && Math.abs(v.x) <= 1.05 && Math.abs(v.y) <= 1.05;
      const aimed = s.id === hoverId || s.id === aimedId;
      const stage = onScreen && !e.occluded ? spotStage(dist, { beacon: s.beacon, aimed }) : 'hidden';
      if (stage !== e.stage) {
        e.btn.classList.remove(`is-${e.stage}`);
        e.btn.classList.add(`is-${stage}`);
        e.btn.hidden = stage === 'hidden';
        e.stage = stage;
      }
      if (stage === 'hidden') continue;
      const sx = Math.round((v.x * 0.5 + 0.5) * w);
      const sy = Math.round((-v.y * 0.5 + 0.5) * h);
      if (sx !== e.sx || sy !== e.sy) {
        e.btn.style.transform = `translate(${sx}px, ${sy}px)`;
        e.btn.style.setProperty('--sx', `${sx}px`);   // 이름 상자를 화면 가장자리 안으로 밀어 넣는 데 쓴다(nowhere.css)
        e.sx = sx;
        e.sy = sy;
      }
      const text = stage === 'beacon' ? `${s.label} · ${Math.round(dist)} m` : stage === 'near' ? s.label : '';
      if (text !== e.text) {
        e.label.textContent = text;
        e.text = text;
      }
      if (locked) {
        const d = Math.hypot(sx - w / 2, sy - h / 2);
        if (d < bestAimD) {
          bestAimD = d;
          bestAim = s.id;
        }
      }
    }
    aimedId = locked ? bestAim : null;
    for (const e of entries) e.btn.classList.toggle('is-aimed', e.spot.id === aimedId);
  }

  return { setSpots, update, element: root };
}
