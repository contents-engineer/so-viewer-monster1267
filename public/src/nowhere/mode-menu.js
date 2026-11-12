// HAUS NOWHERE — 방식 고르기(인트로 뒤): 거리 시점 위 아래쪽 가운데 「어떻게 둘러볼까요?」 + 카드 세 장(가이드 투어 · 직접 걷기 · 자유 시점).
// MODES · resolveMenuKey 는 순수(테스트: tests/nowhere-mode-menu.test.mjs). DOM 은 showModeMenu 를 부를 때만 만든다.
// 열려 있는 동안 body.is-choosing 으로 HUD 를 숨기고(nowhere.css), 키는 모달처럼 창 캡처 단계에서 먼저 받는다.

export const MODE_MENU_TITLE = '어떻게 둘러볼까요?';
export const MODE_MENU_OUT_MS = 300;   // 고른 뒤 사라지는 시간 — 다 사라진 다음 방식을 적용한다

export const MODES = [
  { id: 'guide', key: '1', label: '가이드 투어', en: 'GUIDED TOUR', desc: '두 건물과 실내를 차례로 안내합니다' },
  { id: 'walk', key: '2', label: '직접 걷기', en: 'WALK', desc: '눈높이로 걸으며 ◇ 스팟을 따라 이동합니다' },
  { id: 'free', key: '3', label: '자유 시점', en: 'FREE VIEW', desc: '카메라를 돌리고 확대하며 원하는 시점에서 봅니다' },
];

/** 1 · 2 · 3 → 그 방식, Esc → 자유 시점, Enter → 포커스된 카드, ←/→ 포커스 이동(끝에서 멈춤). 그 밖은 null */
export function resolveMenuKey(key, focus) {
  const byKey = MODES.find((m) => m.key === key);
  if (byKey) return { pick: byKey.id };
  if (key === 'Escape') return { pick: 'free' };
  if (key === 'Enter') return { pick: (MODES[focus] || MODES[0]).id };
  if (key === 'ArrowLeft') return { focus: Math.max(0, focus - 1) };
  if (key === 'ArrowRight') return { focus: Math.min(MODES.length - 1, focus + 1) };
  return null;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/**
 * 방식 고르기를 띄우고 고른 방식 id 를 돌려준다(첫 포커스 가이드 투어). 클릭 · 탭 · 1/2/3 · ←/→ · Enter · Esc(자유 시점).
 * isBlocked() 가 참이면(조작 안내 · 모달이 떠 있음) 메뉴 키를 처리하지 않고 전파만 막는다.
 */
export function showModeMenu({ isBlocked = () => false } = {}) {
  return new Promise((resolve) => {
    const root = el('div', 'nw-mode-menu');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'nw-mode-menu-title');
    const title = el('h2', 'nw-mode-menu-title', MODE_MENU_TITLE);
    title.id = 'nw-mode-menu-title';
    const list = el('div', 'nw-mode-cards');
    let focus = 0;
    let done = false;
    const cards = MODES.map((m, i) => {
      const card = el('button', 'nw-mode-card');
      card.type = 'button';
      card.dataset.mode = m.id;
      const head = el('span', 'nw-mode-card-head');
      head.append(el('span', 'nw-mode-card-en', m.en), el('kbd', 'nw-kbd nw-mode-card-key', m.key));
      card.append(head, el('span', 'nw-mode-card-label', m.label), el('span', 'nw-mode-card-desc', m.desc));
      card.addEventListener('mouseenter', () => setFocus(i));
      card.addEventListener('focus', () => setFocus(i, false));
      card.addEventListener('click', () => pick(m.id));
      list.append(card);
      return card;
    });
    root.append(title, list);

    function setFocus(i, moveFocus = true) {
      if (done) return;
      focus = i;
      cards.forEach((c, k) => c.classList.toggle('is-focus', k === i));
      if (moveFocus && document.activeElement !== cards[i]) cards[i].focus({ preventScroll: true });
    }

    function onKey(e) {
      if (done || e.defaultPrevented) return;
      // 조작 안내 · 모달이 위에 떠 있으면 메뉴 키는 처리하지 않되, 그 밖의 키(V · WASD 등)는 뒤 카메라로 가지 않게 막는다(기본 동작은 그대로)
      if (isBlocked()) {
        e.stopPropagation();
        return;
      }
      const action = resolveMenuKey(e.key, focus);
      if (!action) {
        e.stopPropagation();   // 그 밖의 키(V · WASD 등)가 뒤 카메라로 가지 않게(모달과 같은 규칙 — Tab 이동은 그대로)
        return;
      }
      e.preventDefault();      // Enter 가 포커스된 카드의 click 으로 한 번 더 고르지 않게
      e.stopPropagation();
      if (e.repeat) return;
      if (action.pick) pick(action.pick);
      else setFocus(action.focus);
    }

    function pick(id) {
      if (done) return;
      done = true;
      window.removeEventListener('keydown', onKey, true);
      root.classList.remove('is-on');   // 0.3 초에 사라진 뒤 방식을 적용한다
      setTimeout(() => {
        root.remove();
        document.body.classList.remove('is-choosing');
        resolve(id);
      }, MODE_MENU_OUT_MS);
    }

    window.addEventListener('keydown', onKey, true);
    document.body.classList.add('is-choosing');
    document.body.append(root);
    void root.offsetWidth;   // 붙이자마자 is-on 을 붙이면 나타나는 전환이 생략된다
    root.classList.add('is-on');
    setFocus(0);   // 첫 포커스 가이드 투어
  });
}
