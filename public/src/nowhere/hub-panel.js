// HAUS NOWHERE — 아카이브 목록 패널(DOM 오버레이, 그리기 0 — 테스트: tests/nowhere-hub-panel.test.mjs).
// 위 막대 오른쪽 「목록」 버튼(L 키 표시, 조작 안내 버튼 앞 — 세 페이지 모두 JS 로 넣는다). 막히면(isBlocked) 흐리게 + 이유 title.
// 왼쪽 서랍(가림막 위, 휴대폰은 화면 전체): ARCHIVE INDEX · 아카이브 목록, 카테고리 묶음(이름 · 개수 · 색 점) · 항목(제목 · 자리 — hubIndex 값 그대로).
// 열 때 load()(출처는 처음 열 때 받고 다음부터는 받은 것 그대로 — main.js) → 첫 항목 포커스. 닫기 × · Esc · L · 가림막 클릭, 닫으면 버튼으로 포커스.
// 항목을 누르면 닫고 onGo(item)(실내 들어가기 · 층 이동 · 감상 — main.js runGoPlan).
// 키는 창 캡처 단계 — 조작 안내 · 모달 · 감상의 Esc 가 먼저(그쪽 처리기가 먼저 등록돼 있다), 목록이 떠 있으면 건물 카드 · 인트로 · 보행보다 먼저 닫는다.
// 떠 있는 동안은 대화상자처럼 키를 받는다: Tab 은 패널 안에서 돌고, Space · Enter 는 포커스된 버튼, ↑ ↓ Home End 는 항목 이동, 그 밖의 키(보행 · V 등)는
// 뒤 camera.js(창 버블)로 가지 않게 막는다 — keydown 을 막은 키는 keyup 도 막는다(⌘ · Ctrl 조합 · P 는 그대로).

export const HUB_BLOCKED_TITLE = '지금은 목록을 열 수 없습니다';
const LOADING_TEXT = '목록 불러오는 중…';
const FAILED_TEXT = '목록을 불러오지 못했습니다';

const FOCUS_KEYS = ['ArrowDown', 'ArrowUp', 'Home', 'End'];

/**
 * 키 하나를 어떻게 다룰지(순수): null(그대로 둔다) 아니면 뒤로 보내지 않을 동작 —
 * 'open' · 'close'(L — 한글 입력 상태의 KeyL 포함, Esc), 'tab'(패널 안 돌기), 'press'(Space · Enter — 기본 동작으로 포커스된 버튼 누르기),
 * 'focus'(↑ ↓ Home End — 항목 이동), 'swallow'(막기만 — 떠 있는 동안 그 밖의 키, 목록을 닫은 Esc 를 누르고 있는 동안(held)의 반복).
 * 닫혀 있으면 L 만 본다(⌘ · Ctrl · Alt · 입력 칸 · 키 반복이면 그대로). 떠 있어도 ⌘ · Ctrl 조합 · P(성능 표시)는 그대로(감상 중과 같이).
 * blocked = 열 수 없는 때(인트로 · 이동 · 감상 · 모달 · 조작 안내 — 목록 위에 조작 안내 · 모달이 떠 있으면 그쪽 몫이라 아무것도 막지 않는다)
 */
export function hubKeyAction({ key, code = '', open, blocked, typing = false, held = false, defaultPrevented = false, repeat = false, metaKey = false, ctrlKey = false, altKey = false }) {
  if (key === 'Escape' && repeat && held) return 'swallow';
  if (defaultPrevented || blocked) return null;
  if (key === 'Escape') return open ? (repeat ? 'swallow' : 'close') : null;
  const isL = code === 'KeyL' || key === 'l' || key === 'L';
  if (!open) return isL && !typing && !repeat && !metaKey && !ctrlKey && !altKey ? 'open' : null;
  if (metaKey || ctrlKey || key === 'p' || key === 'P') return null;
  if (isL && !typing && !altKey) return repeat ? 'swallow' : 'close';
  if (key === 'Tab') return 'tab';
  if (key === 'Enter' || key === ' ' || code === 'Space') return 'press';
  if (FOCUS_KEYS.includes(key)) return 'focus';
  return 'swallow';
}

/** 목록 안 화살표 포커스 이동(순수): 지금 항목 index(항목 밖이면 −1) · 항목 수 · 키 → 다음 index, 아니면 null. 끝에서는 멈춘다 */
export function stepFocus(index, count, key) {
  if (!count) return null;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (index < 0 && (key === 'ArrowDown' || key === 'ArrowUp')) return 0;
  if (key === 'ArrowDown') return Math.min(index + 1, count - 1);
  if (key === 'ArrowUp') return Math.max(index - 1, 0);
  return null;
}

/** Tab 돌기(순수): 지금 index(패널 밖이면 −1) · 포커스 대상 수(닫기 · 항목) · Shift → 다음 index — 끝에서 처음으로(거꾸로면 처음에서 끝으로). 대상이 없으면 null */
export function cycleFocus(index, count, back) {
  if (!count) return null;
  if (index < 0) return back ? count - 1 : 0;
  return (index + (back ? -1 : 1) + count) % count;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

const isTyping = (t) => Boolean(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable));

/**
 * load() → Promise<hubIndex 묶음>. onGo(item) → 항목 고르기. isBlocked() → 열 수 없음(버튼 흐리게 · L 무시).
 * onOpen() → 열 때(보행 마우스 고정 풀기 · 스팟 걷기 멈춤 — 조작 안내와 같이)
 */
export function createHubPanel({ load, onGo, isBlocked = () => false, onOpen = null }) {
  // 위 막대 버튼
  const btn = el('button', 'nw-btn nw-hub-btn', '목록');
  btn.type = 'button';
  btn.id = 'nw-btn-hub';
  btn.append(el('span', 'nw-btn-kbd', 'L'));
  btn.setAttribute('aria-haspopup', 'dialog');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'nw-hub-panel');
  const actions = document.querySelector('.nw-top-actions');
  if (actions) actions.insertBefore(btn, document.getElementById('nw-btn-help'));   // 조작 안내 버튼이 없으면 맨 뒤

  // 서랍: 가림막(바깥 클릭 = 닫기) 위 왼쪽 패널
  const root = el('div', 'nw-hub');
  root.hidden = true;
  const panel = el('aside', 'nw-hub-panel');
  panel.id = 'nw-hub-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'nw-hub-title');
  const head = el('div', 'nw-hub-head');
  const titles = el('div');
  titles.append(el('div', 'nw-hub-kicker', 'ARCHIVE INDEX'), Object.assign(el('h2', 'nw-hub-title', '아카이브 목록'), { id: 'nw-hub-title' }));
  const closeBtn = el('button', 'nw-hub-close', '×');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', '닫기');
  head.append(titles, closeBtn);
  const body = el('div', 'nw-hub-body');
  const status = el('p', 'nw-hub-status');
  status.setAttribute('aria-live', 'polite');
  const groupsRoot = el('div', 'nw-hub-groups');
  body.append(status, groupsRoot);
  panel.append(head, body);
  root.append(panel);
  document.body.append(root);

  let items = [];   // 항목 버튼(화면 순서 — 화살표 포커스 이동)
  let token = 0;    // 열 때마다 하나 — 받는 사이 닫았다 다시 열면 앞 결과는 버린다

  function render(groups) {
    items = [];
    groupsRoot.replaceChildren(
      ...(groups || []).map((g) => {
        const sec = el('section', 'nw-hub-group');
        sec.dataset.category = g.id;   // 카테고리 색(nowhere.css --nw-cat-*)
        const h = el('h3', 'nw-hub-group-head');
        h.append(el('span', 'nw-hub-dot'), el('span', 'nw-hub-group-name', g.label), el('span', 'nw-hub-count', String(g.items.length)));
        const list = el('ul', 'nw-hub-list');
        for (const it of g.items) {
          const b = el('button', 'nw-hub-item');
          b.type = 'button';
          b.dataset.key = it.key;
          b.append(el('span', 'nw-hub-item-title', it.title), el('span', 'nw-hub-item-place', it.place));
          b.addEventListener('click', () => {
            if (isBlocked()) return;
            close({ restoreFocus: false });
            onGo(it);
          });
          const li = el('li');
          li.append(b);
          list.append(li);
          items.push(b);
        }
        sec.append(h, list);
        return sec;
      }),
    );
    status.textContent = items.length ? '' : FAILED_TEXT;
    status.hidden = items.length > 0;
  }

  const isOpen = () => !root.hidden;

  async function open() {
    if (isOpen() || isBlocked()) return;
    const my = ++token;
    root.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    if (typeof onOpen === 'function') onOpen();
    if (!items.length) {
      status.textContent = LOADING_TEXT;
      status.hidden = false;
    }
    closeBtn.focus();   // 받는 동안(처음 한 번)
    let groups = null;
    try {
      groups = await load();
    } catch (err) {
      console.error('[nowhere] 아카이브 목록 불러오기 실패', err);
    }
    if (my !== token || !isOpen()) return;
    render(groups);
    (items[0] || closeBtn).focus();
  }

  /** restoreFocus: 버튼으로 포커스를 되돌린다(×  · Esc · L). 항목을 골랐거나 바깥을 눌렀으면 false — 그다음 장면 · 누른 곳 그대로 */
  function close({ restoreFocus = true } = {}) {
    if (!isOpen()) return;
    token += 1;
    swallowed.clear();   // 닫힌 뒤의 keyup 은 camera.js 로 — 떠 있는 동안 누른 키를 닫힌 뒤 반복으로 camera.js 가 받았으면 놓는 것도 알아야 한다(혼자 걷지 않게)
    const inside = panel.contains(document.activeElement);
    root.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    if (restoreFocus) btn.focus();
    else if (inside) document.activeElement.blur();
  }

  const toggle = () => (isOpen() ? close() : open());

  btn.addEventListener('click', () => {
    if (btn.getAttribute('aria-disabled') === 'true' || isBlocked()) return;
    toggle();
  });
  closeBtn.addEventListener('click', () => close());
  root.addEventListener('click', (e) => {
    if (e.target === root) close({ restoreFocus: false });
  });

  // 키(hubKeyAction): 처리한 키는 뒤(건물 카드 · 인트로 · camera.js)로 보내지 않는다. Space · Enter 는 기본 동작(포커스된 버튼 누르기) 그대로
  let escHeld = false;
  const swallowed = new Set();   // keydown 을 막은 키 — 그 keyup 도 막는다(열기 전부터 누르던 키의 keyup 은 지나가 camera.js 가 놓은 걸 안다)
  window.addEventListener(
    'keydown',
    (e) => {
      const act = hubKeyAction({
        key: e.key, code: e.code, open: isOpen(), blocked: isBlocked(), typing: isTyping(e.target), held: escHeld,
        defaultPrevented: e.defaultPrevented, repeat: e.repeat, metaKey: e.metaKey, ctrlKey: e.ctrlKey, altKey: e.altKey,
      });
      if (e.key === 'Escape' && !e.repeat) escHeld = false;
      if (!act) return;
      e.stopImmediatePropagation();
      if (!e.repeat) swallowed.add(e.code || e.key);
      if (act === 'press' || act === 'swallow') return;
      e.preventDefault();
      if (act === 'open') {
        open();
      } else if (act === 'close') {
        if (e.key === 'Escape') escHeld = true;
        close();
      } else if (act === 'focus') {
        const next = stepFocus(items.indexOf(document.activeElement), items.length, e.key);
        if (next != null) items[next].focus();
      } else if (act === 'tab') {
        const targets = [closeBtn, ...items];
        targets[cycleFocus(targets.indexOf(document.activeElement), targets.length, e.shiftKey)].focus();
      }
    },
    true,
  );
  window.addEventListener(
    'keyup',
    (e) => {
      if (e.key === 'Escape') escHeld = false;
      if (swallowed.delete(e.code || e.key)) e.stopImmediatePropagation();
    },
    true,
  );

  // 매 프레임: 열 수 없으면 버튼을 흐리게 + 이유(title) — 바뀔 때만 DOM 을 건드린다
  let lastBlocked = null;
  function update() {
    const b = Boolean(isBlocked());
    if (b === lastBlocked) return;
    lastBlocked = b;
    btn.classList.toggle('is-blocked', b);
    btn.setAttribute('aria-disabled', String(b));
    if (b) btn.title = HUB_BLOCKED_TITLE;
    else btn.removeAttribute('title');
  }

  return { open, close, toggle, isOpen, update, element: root, button: btn };
}
