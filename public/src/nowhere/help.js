// HAUS NOWHERE — 조작 안내 오버레이(? 키) + 보행 시점 조준점·안내 문구.
// CONTROL_SECTIONS 는 순수 데이터(테스트: tests/nowhere-help.test.mjs — 코드에 바인딩된 단축키가 모두 실려 있는지 검사).
// DOM 은 create* 함수를 부를 때만 만든다(모듈을 import 할 때 document 를 건드리지 않는다).

export const CONTROL_SECTIONS = [
  {
    id: 'common',
    title: '공통',
    kicker: 'ALL VIEWS',
    rows: [
      { keys: ['V'], desc: '보행 시점 켜기 / 끄기 — 방식도 직접 걷기 ↔ 자유 시점으로 함께 바뀜' },
      { keys: ['Esc'], desc: '조작 안내 · 모달 닫기 → 인트로 건너뛰기 · 건물 비행 중 가이드 투어 종료. 방식 고르기에서는 자유 시점. 보행 중에는 마우스 고정 해제 → 보행 해제' },
      { keys: ['Enter'], desc: '모달 · 월드 선택 · 방식 고르기에서 강조된(또는 포커스된) 항목 선택' },
      { keys: ['?'], desc: '조작 안내 열기 / 닫기' },
      { keys: ['P'], desc: '성능 표시(FPS · 프레임 시간 · 그리기 호출 · 삼각형 · 메모리) 켜기 / 끄기 — 키보드 없는 기기는 주소에 ?stats=1' },
      { keys: ['1', '2', '3'], desc: '방식 고르기(인트로 뒤 「어떻게 둘러볼까요?」): 1 가이드 투어 · 2 직접 걷기 · 3 자유 시점' },
      { keys: ['←', '→'], desc: '월드 선택 화면(주소 / 로 열 때 — 성수 2041 · DS2 산악)과 방식 고르기에서 포커스 이동' },
      { keys: ['클릭', '휠'], desc: '인트로 건너뛰기 — 아무 키 · 화면 클릭 · 휠 · Esc · 건너뛰기 › 버튼으로 거리 시점에 바로 내려옴. 인트로 다시 보기는 새로 고침' },
      { keys: ['클릭'], desc: '월드 전환(성수 2041 · DS2 산악 — 지금 방식 그대로 거리 시점에서), 기상(맑음 · 흐림 · 비 · 눈 — 맑음은 성수)과 시간(시각 슬라이더 · 낮 · 황혼 · 밤)을 따로 골라 조합 — 어느 시점에서나 사용' },
      { keys: ['클릭'], desc: '방식 전환(가이드 투어 · 직접 걷기 · 자유 시점): 가이드 투어는 건물 선택 → 정면 비행 → 입장(하우스노웨어 성수) · 준비중(하우스노웨어 몽골), 도착 모달에서 다른 건물로 바로 이동(성수 ↔ 몽골), 다시 누르면 건물 선택부터. 직접 걷기는 그 자리에서 보행, 자유 시점은 궤도 카메라 — 카메라 프리셋 버튼은 자유 시점에서만. 실내에서는 숨김' },
      { keys: ['클릭'], desc: '실내: 왼쪽 위 층 버튼(B1 · 1 · 12 · 13) 또는 엘리베이터 문 앞 층 선택으로 층 이동, 이 층 둘러보기(첫 볼거리로 화면 전환 후 차례로 비행, 끝나면 보행으로 복귀 · 아무 입력으로 멈춤), 밖으로 나가기 또는 1F 정문 쪽 출구' },
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
      { keys: ['클릭'], desc: '카메라 프리셋 버튼 — 성수: 거리 · 조감 · 고가 하부 · 밤거리 · 노면 근접 · 포켓 공원 · 2041 골목, DS2: 개척로 · 조감 · 협곡 상류 · 산악의 밤 · 개울 근접 · 이끼 포켓 · 빙하 계곡' },
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
      { keys: ['클릭', '탭'], desc: '◇ 이동 스팟(실내 볼거리 · 엘리베이터 · 출구, 두 건물 주변) — 그 자리까지 길을 찾아 걸어가기(30 m 넘으면 달리기). WASD · 방향키 · Space · 화면 클릭으로 멈춤. 마우스 고정 중에는 조준점을 스팟에 맞추고 클릭. 성수 정문에 도착하면 입장 질문' },
    ],
    note: '건물 · 바위 등 장애물과 50° 넘는 비탈은 지나갈 수 없습니다.',
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

export const WALK_HINT_DOCK_MS = 4000;   // 보행을 켠 뒤 안내가 가운데에 머무는 시간 — 지나면 오른쪽 위로 비킨다

/**
 * 보행 시점 조준점 + 안내 문구. setState({ walk, locked }) 로 갱신.
 * 안내는 보행을 켤 때마다(실내 진입 · 층 이동 · V) 가운데에 보였다가 WALK_HINT_DOCK_MS 뒤 오른쪽 위로 작게 비킨다(is-docked).
 */
export function createWalkHud() {
  const root = el('div', 'nw-walk-hud');
  root.hidden = true;
  const cross = el('div', 'nw-walk-cross');
  const hint = el('div', 'nw-walk-hint');
  root.append(cross, hint);
  document.body.append(root);
  let walking = false;
  let dockTimer = null;
  function setState({ walk, locked }) {
    if (Boolean(walk) !== walking) {
      walking = Boolean(walk);
      clearTimeout(dockTimer);
      dockTimer = null;
      root.classList.remove('is-docked');
      if (walking) dockTimer = setTimeout(() => root.classList.add('is-docked'), WALK_HINT_DOCK_MS);
    }
    root.hidden = !walk;
    root.classList.toggle('is-locked', Boolean(locked));
    hint.textContent = locked
      ? 'Esc  마우스 고정 해제 · 조준점을 ◇ 스팟에 맞추고 클릭  걸어가기'
      : '화면 클릭  마우스로 둘러보기 · ◇ 스팟 클릭  걸어가기 · WASD 이동 · Shift 달리기 · Space 점프 · ? 조작 안내';
  }
  return { setState, element: root };
}
