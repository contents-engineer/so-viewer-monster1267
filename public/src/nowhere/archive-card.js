// HAUS NOWHERE — 건물 아카이브 카드(외관 — DOM 오버레이, 그리기 0).
// 이름표: 건물마다 `<title> · 기록 보기` 버튼을 경계 상자 윗면 가운데 + BUILDING_TAG_LIFT 에(BUILDING_TAG_RANGE 안 · 화면 안), 누르면 카드.
// 카드: 오른쪽 패널(감상 정보 패널과 같은 모양 · 자리, 휴대폰 · 세로 태블릿은 아래) — kicker · 제목 · facts · note · 「자세히 보기」(onDetail) · 「닫기」.
//   모달이 아니다(카드가 떠 있어도 걷고 둘러본다). 다른 건물을 고르면 그 건물 카드로 바뀐다. 카드 건물에서 CARD_KEEP_RANGE 밖으로 멀어지면 닫는다.
// 자유 시점 클릭: 끌지 않은(CLICK_SLOP) 캔버스 클릭의 광선이 건물 경계 상자에 맞으면 가까운 건물 카드(카메라가 들어 있는 상자는 건너뛴다 — archive.js pickBuilding)
//   — 맞지 않으면 아무것도 하지 않는다(다른 클릭 처리기 그대로).
// Esc: 카드가 떠 있으면 카드만 닫고 막는다(조작 안내 · 모달 · 감상의 Esc 가 먼저 — 그쪽 캡처 처리기가 먼저 등록돼 있다).
// 기록: archive.js BUILDING_RECORDS 두 파일을 한 번 받는다(못 받은 건물은 이름표 · 카드 없음). 문구는 기록 값 그대로(buildingItem).
import * as THREE from 'three';
import { BUILDING_IDS, BUILDING_RECORDS, CARD_KEEP_RANGE, CLICK_SLOP, buildingItem, pickBuilding, tagAnchor, tagVisible } from './archive.js';

const UNLOCK_GRACE_MS = 300;   // 마우스 고정을 푼 Esc 직후의 Esc 는 카드를 닫지 않는다(camera.js 와 같은 값 — 브라우저가 고정 해제에 먼저 쓴다)

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/**
 * getBoxes() → { haus, facearch }: THREE.Box3(월드). isSuspended() → 이름표를 숨기고 클릭 · Esc 를 받지 않는다(인트로 · 방식 고르기 · 투어 · 실내 · 감상 ·
 * 조작 안내 · 모달 · 컷 이동 · 비행). isWalking() → 보행 중이면 캔버스 클릭으로 고르지 않는다(보행 클릭은 마우스 고정). onDetail(id) → 「자세히 보기」.
 */
export function createArchiveCard({ camera, canvas, quality, getBoxes, isSuspended = () => false, isWalking = () => false, onDetail }) {
  const loaded = {};   // id → 기록(받은 것만)
  const items = {};    // id → buildingItem(카드 문구)
  let anchors = null;  // id → THREE.Vector3(이름표 자리 · 카드 거리 기준) — 경계 상자가 생기면 한 번 만든다
  let openId = null;

  // 이름표
  const tagsRoot = el('div', 'nw-archive-tags');
  tagsRoot.hidden = true;
  const tags = [];   // { id, btn, shown, sx, sy }
  document.body.append(tagsRoot);

  // 카드
  const card = el('aside', 'nw-archive-card');
  card.hidden = true;
  card.setAttribute('aria-label', '건물 기록');
  const kicker = el('div', 'nw-archive-kicker');
  const title = el('h2', 'nw-archive-name');
  const info = el('dl', 'nw-archive-info');
  const note = el('p', 'nw-archive-note');
  note.hidden = true;
  const body = el('div', 'nw-archive-body');   // 스크롤은 내용만 — 버튼은 화면 높이가 모자라도(가로 휴대폰) 카드 아래에 보인다
  const actions = el('div', 'nw-archive-actions');
  const detailBtn = el('button', 'nw-btn nw-archive-detail', '자세히 보기');
  detailBtn.type = 'button';
  const closeBtn = el('button', 'nw-btn nw-archive-close', '닫기');
  closeBtn.type = 'button';
  actions.append(detailBtn, closeBtn);
  body.append(kicker, title, info, note);
  card.append(body, actions);
  document.body.append(card);

  /** 그 건물 카드를 띄운다(다른 건물 카드가 떠 있으면 바꾼다). 기록을 못 받은 건물은 아무것도 하지 않는다 */
  function show(id) {
    const item = items[id];
    if (!item) return false;
    openId = id;
    kicker.textContent = item.kicker;
    title.textContent = item.name;
    info.replaceChildren(...item.rows.flatMap((r) => [el('dt', null, r.label), el('dd', null, r.value)]));
    note.textContent = item.note || '';
    note.hidden = !item.note;
    card.setAttribute('aria-label', `${item.name} 기록`);
    card.hidden = false;
    return true;
  }

  function hide() {
    openId = null;
    card.hidden = true;
  }

  detailBtn.addEventListener('click', () => {
    detailBtn.blur();   // 포커스가 남으면 Space(보행 점프)가 이 버튼을 다시 누른다
    if (openId && typeof onDetail === 'function') onDetail(openId);
  });
  closeBtn.addEventListener('click', () => {
    closeBtn.blur();
    hide();
  });

  // 기록 두 파일을 한 번 받는다 — 못 받은 건물은 이름표 · 카드 없음
  Promise.all(
    BUILDING_IDS.map((id) =>
      fetch(BUILDING_RECORDS[id])
        .then((r) => {
          if (!r.ok) throw new Error(`${BUILDING_RECORDS[id]} ${r.status}`);
          return r.json();
        })
        .then((record) => {
          loaded[id] = record;
          items[id] = buildingItem(id, record, quality?.heroUrls?.[id] ?? null);
          const btn = el('button', 'nw-archive-tag');
          btn.type = 'button';
          btn.hidden = true;
          btn.setAttribute('aria-label', `${record.title} 기록 보기`);
          btn.append(el('span', 'nw-archive-tag-name', record.title), el('span', 'nw-archive-tag-sep', ' · '), el('span', 'nw-archive-tag-more', '기록 보기'));
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            btn.blur();
            show(id);
          });
          tags.push({ id, btn, shown: false, sx: NaN, sy: NaN });
          tagsRoot.append(btn);
        })
        .catch((err) => console.error(`[nowhere] 건물 기록 ${id} 불러오기 실패`, err)),
    ),
  );

  function anchorsOf() {
    if (!anchors) {
      const boxes = getBoxes?.();
      if (!boxes) return null;
      anchors = {};
      for (const id of BUILDING_IDS) if (boxes[id] && !boxes[id].isEmpty()) anchors[id] = new THREE.Vector3(...tagAnchor(boxes[id]));
    }
    return anchors;
  }

  // 매 프레임(감상 중이 아닐 때): 이름표 자리 · 보이기, 카드 건물에서 멀어지면 닫기
  const v = new THREE.Vector3();
  function update() {
    const at = anchorsOf();
    if (!at) return;
    const eye = camera.position;
    if (openId && at[openId] && eye.distanceTo(at[openId]) > CARD_KEEP_RANGE) hide();
    const suspended = isSuspended();
    if (suspended) {
      tagsRoot.hidden = true;
      return;
    }
    tagsRoot.hidden = false;
    camera.updateMatrixWorld();
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    for (const t of tags) {
      const p = at[t.id];
      let show = false;
      if (p) {
        v.copy(p).project(camera);
        show = tagVisible({ distance: eye.distanceTo(p), ndc: [v.x, v.y, v.z] });
      }
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

  // 자유 시점 건물 클릭 — 캡처 단계에서 끌기 시작점을 적고, 끌지 않은 클릭의 광선이 건물 경계 상자에 맞으면 가까운 건물 카드(pickBuilding)
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hit = new THREE.Vector3();
  const down = { x: 0, y: 0 };
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      down.x = e.clientX;
      down.y = e.clientY;
    },
    true,
  );
  canvas.addEventListener(
    'click',
    (e) => {
      if (isWalking() || isSuspended()) return;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > CLICK_SLOP) return;
      const boxes = getBoxes?.();
      const at = anchorsOf();
      if (!boxes || !at) return;
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const best = pickBuilding(
        BUILDING_IDS.filter((id) => boxes[id] && at[id]).map((id) => ({
          id,
          hasRecord: Boolean(items[id]),
          range: camera.position.distanceTo(at[id]),
          inside: boxes[id].containsPoint(raycaster.ray.origin),
          hit: raycaster.ray.intersectBox(boxes[id], hit) ? hit.distanceTo(raycaster.ray.origin) : null,
        })),
      );
      if (best) show(best);
    },
    true,
  );

  // Esc: 카드가 떠 있으면 카드만 닫는다 — 조작 안내 · 모달이 받은 Esc(defaultPrevented)와 감상(stopImmediatePropagation)은 그쪽 몫,
  // 마우스 고정 중(또는 막 푼 직후)의 Esc 는 브라우저 고정 해제 몫. 막지 않으면 camera.js 가 같은 Esc 로 보행을 끈다.
  // 카드를 닫은 Esc 를 누르고 있는 동안의 자동 반복(e.repeat)도 막는다(손을 떼면 풀린다)
  let lastUnlockAt = -1e9;
  let escHeld = false;
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== canvas) lastUnlockAt = performance.now();
  });
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape') return;
      if (e.repeat && escHeld) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      escHeld = false;
      if (!openId || e.defaultPrevented || isSuspended()) return;
      if (document.pointerLockElement === canvas || performance.now() - lastUnlockAt < UNLOCK_GRACE_MS) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!e.repeat) {
        hide();
        escHeld = true;
      }
    },
    true,
  );
  window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') escHeld = false;
  });

  return {
    show,
    hide,
    isOpen: () => openId !== null,
    currentId: () => openId,
    records: () => ({ ...loaded }),
    update,
    element: card,
  };
}
