// HAUS NOWHERE — 실내 전시물 이름표 · 클릭 고르기(DOM 오버레이 — 그리기 0). 테스트: tests/nowhere-exhibit-tags.test.mjs(동작) · nowhere-exhibits.test.mjs(연결).
// 이름표: 지금 층 전시물마다 `<title> · 자세히 보기` 버튼(리테일 이름표와 같은 모양)을 그 전시물 노드 경계 상자 윗면 가운데 위 EXHIBIT_TAG_LIFT 에
//   (노드가 없으면 pos 위 — exhibitTagAnchors, 층 루트가 생기면 층마다 한 번 잰다) — 카메라에서 그 자리까지 수평 EXHIBIT_TAG_RANGE 안 · 화면 안이면 보인다. 누르면 onOpen(id).
// 클릭: 캔버스 캡처 pointerdown · click — 자유 시점은 끌지 않은(CLICK_SLOP) 클릭 자리, 보행은 마우스 고정 중 화면 가운데(조준점)만(고정 전 클릭은
//   camera.js 의 마우스 고정 그대로). 광선(far = EXHIBIT_PICK_RANGE)이 층에서 처음 맞은 물체가 그 층 전시물 노드(exhibitAt)면 stopImmediatePropagation 후
//   onOpen(id) — 벽 · 바닥 · 엘리베이터 · 진열에 먼저 맞거나 아무것도 안 맞으면 다른 처리기 그대로.
//   제품이 먼저: main.js 가 리테일 진열(retail-display.js)을 먼저 만들어 그 캡처 click 이 먼저 돈다 — 제품 · 받침대를 맞히면 그쪽이 막는다.
//   마우스 고정 중 조준점이 ◇ 이동 스팟에 있으면(isSpotAimed) 스팟으로 걸어가기 몫으로 둔다(spot-markers.js).
// 멈춤(isSuspended — 층 둘러보기 · 층 이동 · 감상 · 조작 안내 · 모달 · 컷 이동 · 실내 밖)에는 이름표를 숨기고 클릭을 받지 않는다. 누를 때 멈춤이었던 클릭
//   (둘러보기를 멈춘 클릭 — interior.js 가 pointerdown 에 멈춘다)도 고르지 않는다.
import * as THREE from 'three';
import { CLICK_SLOP, EXHIBIT_PICK_RANGE, exhibitAt, exhibitTagAnchors, exhibitTagVisible } from './exhibits.js';

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/**
 * getFloor() → { def(inner-layout 층), root(층 루트 — 광선 대상) } | null. isWalking() → 보행 중(마우스 고정 전 클릭은 고르지 않는다).
 * isSpotAimed() → 마우스 고정 중 조준점이 이동 스팟 위. setFloor(def | null) 는 층이 바뀔 때(이름표 교체), update() 는 매 프레임(감상 중 아닐 때).
 */
export function createExhibitTags({ camera, canvas, getFloor, isSuspended = () => false, isWalking = () => false, isSpotAimed = () => false, onOpen }) {
  const root = el('div', 'nw-exhibit-tags');
  root.hidden = true;
  document.body.append(root);
  let tags = [];   // { id, anchor(월드 — 층 루트를 재고 나서), btn, shown, sx, sy }
  let tagsDef = null;      // 이름표를 만든 층 정의
  let anchorsFor = null;   // 이름표 자리를 잰 층 루트(층 이동 · 진입 중에는 루트가 늦게 생긴다 — 그 층 루트가 보이면 update 가 잰다)

  /** 지금 보이는 층의 전시물 이름표로 바꾼다(실내 밖이면 null — 이름표 없음) */
  function setFloor(def) {
    tagsDef = def || null;
    anchorsFor = null;
    tags = (def?.exhibits || []).map((e) => {
      const btn = el('button', 'nw-exhibit-tag');
      btn.type = 'button';
      btn.hidden = true;
      btn.dataset.exhibit = e.id;
      btn.setAttribute('aria-label', `${e.title} 자세히 보기`);
      btn.append(el('span', 'nw-exhibit-tag-name', e.title), el('span', 'nw-exhibit-tag-sep', ' · '), el('span', 'nw-exhibit-tag-more', '자세히 보기'));
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        btn.blur();   // 포커스가 남으면 Space(보행 점프)가 이 버튼을 다시 누른다
        onOpen(e.id);
      });
      return { id: e.id, anchor: null, btn, shown: false, sx: NaN, sy: NaN };
    });
    root.replaceChildren(...tags.map((t) => t.btn));
  }

  // 이름표 자리: 전시물 노드 경계 상자 윗면 가운데 위(층 루트 좌표) → 월드(층 루트 행렬)
  const w = new THREE.Vector3();
  function placeAnchors(floor) {
    const at = exhibitTagAnchors(THREE, floor.root, floor.def);
    for (const t of tags) t.anchor = w.fromArray(at[t.id]).applyMatrix4(floor.root.matrixWorld).toArray();
    anchorsFor = floor.root;
  }

  // 이름표: 이름표 자리까지 수평 EXHIBIT_TAG_RANGE 안이고 화면 안이면 그 투영 자리에
  const v = new THREE.Vector3();
  const eye = [0, 0, 0];
  function update() {
    const floor = tags.length && !isSuspended() ? getFloor() : null;
    if (!floor || floor.def !== tagsDef) {
      root.hidden = true;
      return;
    }
    if (anchorsFor !== floor.root) placeAnchors(floor);
    root.hidden = false;
    camera.updateMatrixWorld();
    camera.position.toArray(eye);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    for (const t of tags) {
      v.set(t.anchor[0], t.anchor[1], t.anchor[2]).project(camera);
      const show = exhibitTagVisible({ eye, anchor: t.anchor, ndc: [v.x, v.y, v.z] });
      if (show !== t.shown) {
        t.btn.hidden = !show;
        t.shown = show;
      }
      if (!show) continue;
      const sx = Math.round((v.x * 0.5 + 0.5) * w);
      const sy = Math.round((-v.y * 0.5 + 0.5) * h);
      if (sx !== t.sx || sy !== t.sy) {
        t.btn.style.transform = `translate(${sx}px, ${sy}px)`;
        t.btn.style.setProperty('--sx', `${sx}px`);   // 이름표를 화면 가장자리 안으로 밀어 넣는 데 쓴다(nowhere.css)
        t.sx = sx;
        t.sy = sy;
      }
    }
  }

  // 클릭 고르기 — 캡처 단계에서 끌기 시작점 · 그때 멈춤이었는지 적고, 전시물을 맞힌 클릭은 막는다(보행 스팟 조준 클릭 · 마우스 고정 처리기로 가지 않게)
  const raycaster = new THREE.Raycaster();
  raycaster.far = EXHIBIT_PICK_RANGE;
  const ndc = new THREE.Vector2();
  const down = { x: 0, y: 0, suspended: false };
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      down.x = e.clientX;
      down.y = e.clientY;
      down.suspended = isSuspended();
    },
    true,
  );
  canvas.addEventListener(
    'click',
    (e) => {
      if (down.suspended || isSuspended()) return;
      const floor = getFloor();
      if (!floor) return;
      const locked = document.pointerLockElement === canvas;
      if (locked) {
        if (isSpotAimed()) return;   // 조준점이 ◇ 이동 스팟 위 — 스팟으로 걸어가기(spot-markers.js)
        ndc.set(0, 0);
      } else {
        if (isWalking()) return;   // 보행 중 고정 전 클릭은 마우스 고정(camera.js)
        if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > CLICK_SLOP) return;
        const r = canvas.getBoundingClientRect();
        ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      }
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObject(floor.root, true)[0];
      const id = hit ? exhibitAt(hit.object, floor.def) : null;
      if (!id) return;
      e.stopImmediatePropagation();
      onOpen(id);
    },
    true,
  );

  return { setFloor, update, element: root };
}
