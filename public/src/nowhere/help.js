// HAUS NOWHERE — 조작 안내 오버레이(? 키) + 보행 시점 조준점·안내 문구.
// CONTROL_SECTIONS 는 순수 데이터(테스트: tests/nowhere-help.test.mjs — 코드에 바인딩된 단축키가 모두 실려 있는지 검사).
// DOM 은 create* 함수를 부를 때만 만든다(모듈을 import 할 때 document 를 건드리지 않는다).

export const CONTROL_SECTIONS = [
  {
    id: 'common',
    title: '공통',
    kicker: 'ALL VIEWS',
    rows: [
      { keys: ['V'], desc: '보행 시점 켜기 / 끄기' },
      { keys: ['Esc'], desc: '조작 안내 · 모달 닫기 → 투어 종료. 보행 중에는 마우스 고정 해제 → 보행 해제' },
      { keys: ['Enter'], desc: '모달에서 강조된(또는 포커스된) 버튼 선택' },
      { keys: ['?'], desc: '조작 안내 열기 / 닫기' },
      { keys: ['클릭'], desc: '월드 전환(성수 2041 · DS2 산악), 기상(흐림 · 비 · 눈)과 시간(시각 슬라이더 · 낮 · 황혼 · 밤)을 따로 골라 조합 — 어느 시점에서나 사용' },
      { keys: ['클릭'], desc: '투어 시작: 인트로 비행 → 건물 선택 → 정면 비행 → 입장(하우스노웨어 성수) · 준비중(하우스노웨어 몽골). 건물 이동: 건물 선택부터' },
      { keys: ['클릭'], desc: '실내: 왼쪽 위 층 버튼(B1 · 1 · 12 · 13) 또는 엘리베이터 문 앞 층 선택으로 층 이동, 이 층 둘러보기(아무 입력으로 멈춤), 밖으로 나가기 또는 1F 정문 쪽 출구' },
    ],
  },
  {
    id: 'camera',
    title: '카메라 시점',
    kicker: 'CAMERA VIEW',
    rows: [
      { keys: ['드래그'], desc: '카메라 회전' },
      { keys: ['우클릭 드래그'], desc: '카메라 이동(팬)' },
      { keys: ['휠'], desc: '확대 · 축소' },
      { keys: ['클릭'], desc: '카메라 프리셋 버튼' },
    ],
    note: '건물 · 바위 등 물체는 투과하고, 지면 아래로는 내려가지 않습니다.',
  },
  {
    id: 'walk',
    title: '보행 시점',
    kicker: 'WALK VIEW',
    rows: [
      { keys: ['W', 'A', 'S', 'D'], desc: '걷기' },
      { keys: ['Shift'], desc: '누른 채 달리기' },
      { keys: ['Space'], desc: '점프 — 낮은 바위 · 턱을 넘거나 올라서기' },
      { keys: ['↑', '↓'], desc: '올려다보기 · 내려다보기' },
      { keys: ['←', '→'], desc: '좌우로 돌아보기' },
      { keys: ['클릭'], desc: '마우스 시선 고정 — 마우스만 움직여 둘러보기 (Esc 로 해제)' },
      { keys: ['드래그'], desc: '마우스 고정 없이 둘러보기' },
    ],
    note: '건물 · 바위 · 전주 등 장애물과 50° 넘는 비탈은 지나갈 수 없습니다.',
  },
];

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/**
 * 조작 안내 오버레이. ? 키 · 상단 '조작 안내' 버튼으로 열고, ? · Esc · 바깥 클릭 · 닫기 버튼으로 닫는다.
 * Esc 는 창 캡처 단계에서 먼저 받아 막으므로, 안내가 열려 있을 때 Esc 가 보행 · 분석까지 함께 끄지 않는다.
 */
export function createHelpOverlay({ onOpen = null } = {}) {
  const root = el('div', 'nw-help');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'nw-help-title');
  root.hidden = true;

  const panel = el('div', 'nw-help-panel');
  const head = el('div', 'nw-help-head');
  const titles = el('div');
  titles.append(el('div', 'nw-help-kicker', 'CONTROLS'), Object.assign(el('h2', 'nw-help-title', '조작 안내'), { id: 'nw-help-title' }));
  const close = el('button', 'nw-btn nw-help-close', '닫기');
  close.type = 'button';
  close.append(el('span', 'nw-btn-kbd', 'Esc'));
  head.append(titles, close);

  const grid = el('div', 'nw-help-grid');
  for (const s of CONTROL_SECTIONS) {
    const sec = el('section', 'nw-help-section');
    sec.append(el('div', 'nw-help-section-kicker', s.kicker), el('h3', 'nw-help-section-title', s.title));
    const list = el('dl', 'nw-help-list');
    for (const r of s.rows) {
      const dt = el('dt', 'nw-help-keys');
      r.keys.forEach((k) => dt.append(el('kbd', 'nw-kbd', k)));
      list.append(dt, el('dd', 'nw-help-desc', r.desc));
    }
    sec.append(list);
    if (s.note) sec.append(el('p', 'nw-help-note', s.note));
    grid.append(sec);
  }
  panel.append(head, grid);
  root.append(panel);
  document.body.append(root);

  let lastFocus = null;
  function open() {
    if (!root.hidden) return;
    lastFocus = document.activeElement;
    root.hidden = false;
    if (typeof onOpen === 'function') onOpen();
    close.focus();
  }
  function hide() {
    if (root.hidden) return;
    root.hidden = true;
    if (lastFocus && typeof lastFocus.focus === 'function' && lastFocus !== document.body) lastFocus.blur?.();
  }
  const toggle = () => (root.hidden ? open() : hide());

  close.addEventListener('click', hide);
  root.addEventListener('click', (e) => {
    if (e.target === root) hide();
  });
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const isHelpKey = e.key === '?' || (e.code === 'Slash' && e.shiftKey);
      if (isHelpKey) {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      } else if (!root.hidden && e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        hide();
      }
    },
    true,
  );

  // 상단 바에 '조작 안내 ?' 버튼
  const actions = document.querySelector('.nw-top-actions');
  if (actions && !document.getElementById('nw-btn-help')) {
    const btn = el('button', 'nw-btn', '조작 안내');
    btn.id = 'nw-btn-help';
    btn.type = 'button';
    btn.append(el('span', 'nw-btn-kbd', '?'));
    btn.addEventListener('click', toggle);
    actions.append(btn);
  }

  return { open, close: hide, toggle, isOpen: () => !root.hidden, element: root };
}

/** 보행 시점 조준점 + 안내 문구. setState({ walk, locked }) 로 갱신. */
export function createWalkHud() {
  const root = el('div', 'nw-walk-hud');
  root.hidden = true;
  const cross = el('div', 'nw-walk-cross');
  const hint = el('div', 'nw-walk-hint');
  root.append(cross, hint);
  document.body.append(root);
  function setState({ walk, locked }) {
    root.hidden = !walk;
    root.classList.toggle('is-locked', Boolean(locked));
    hint.textContent = locked
      ? 'Esc  마우스 고정 해제'
      : '화면 클릭  마우스로 둘러보기 · WASD 이동 · Shift 달리기 · Space 점프 · ? 조작 안내';
  }
  return { setState, element: root };
}
