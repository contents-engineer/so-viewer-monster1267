// HAUS NOWHERE — 공용 모달(시나리오 투어 · 실내 출구 · 오류). 조작 안내 오버레이와 같은 패널 스타일.
// resolveModalKey 는 순수 함수(테스트: tests/nowhere-modal.test.mjs). DOM 은 createModal 을 부를 때만 만든다.

/** 기본 버튼(primary, 없으면 첫 버튼). 없으면 undefined. Enter 처리와 초기 포커스가 같은 규칙을 쓴다. */
export function primaryButton(buttons) {
  return buttons.find((b) => b.primary) || buttons[0];
}

/** Enter → 기본 버튼 id(없으면 첫 버튼), Escape → 취소 버튼 id(없으면 null), 그 밖 → undefined. */
export function resolveModalKey(key, buttons) {
  if (key === 'Enter') {
    const p = primaryButton(buttons);
    return p ? p.id : null;
  }
  if (key === 'Escape') {
    const c = buttons.find((b) => b.cancel);
    return c ? c.id : null;
  }
  return undefined;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/**
 * show({ title, body?, buttons }) → Promise<버튼 id | null>. 열려 있는 동안 Enter/Esc 를 창 캡처 단계에서 먼저 받는다.
 * 배경 클릭으로는 닫지 않는다(선택을 요구하는 모달). onShow: 보행 마우스 고정 해제 등.
 */
export function createModal({ onShow = null } = {}) {
  const root = el('div', 'nw-modal');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.hidden = true;
  const panel = el('div', 'nw-modal-panel');
  const title = el('h2', 'nw-modal-title');
  title.id = 'nw-modal-title';
  root.setAttribute('aria-labelledby', title.id);
  const body = el('p', 'nw-modal-body');
  const actions = el('div', 'nw-modal-actions');
  panel.append(title, body, actions);
  root.append(panel);
  document.body.append(root);

  let current = null;   // { buttons, btns(버튼 요소, buttons 와 같은 순서), resolve }

  function finish(id) {
    if (!current) return;
    const { resolve } = current;
    current = null;
    root.hidden = true;
    actions.replaceChildren();
    resolve(id);
  }

  function show({ title: t, body: b = '', buttons }) {
    finish(null);
    title.textContent = t;
    body.textContent = b;
    body.hidden = !b;
    actions.replaceChildren();
    const btns = [];
    for (const spec of buttons) {
      const btn = el('button', `nw-btn nw-modal-btn${spec.primary ? ' is-primary' : ''}`);
      btn.type = 'button';
      btn.append(el('span', 'nw-modal-btn-label', spec.label));
      if (spec.sub) btn.append(el('span', 'nw-modal-btn-sub', spec.sub));
      btn.addEventListener('click', () => finish(spec.id));
      actions.append(btn);
      btns.push(btn);
    }
    root.hidden = false;
    // current 를 onShow 보다 먼저 세운다 — onShow 가 던져도 열린 모달이 Promise·닫기 경로 없이 남지 않게.
    const promise = new Promise((resolve) => {
      current = { buttons, btns, resolve };
    });
    if (typeof onShow === 'function') {
      try {
        onShow();
      } catch (err) {
        console.warn('[modal] onShow 실패', err);
      }
    }
    // 초기 포커스는 Enter 기본 버튼과 같은 규칙(primaryButton).
    btns[buttons.indexOf(primaryButton(buttons))]?.focus();
    return promise;
  }

  window.addEventListener(
    'keydown',
    (e) => {
      if (!current) return;
      // 도움말이 열려 있으면 Esc/Enter 는 도움말 몫 — 같은 창 캡처 단계라 등록 순서와 무관하게 막는다.
      if (e.defaultPrevented) return;
      const help = document.querySelector('.nw-help');
      if (help && !help.hidden) return;
      let id = resolveModalKey(e.key, current.buttons);
      if (id === undefined) {
        // 그 밖의 키(V · WASD 등)가 모달 뒤 카메라로 가지 않게 전파만 막는다(keydown 만 — keyup 은 지나가 누른 키가 남지 않음, Tab 이동은 그대로)
        e.stopPropagation();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      // 키 반복(꾹 누름)은 삼키기만 한다 — 연쇄 모달이 자동 확정되거나 카메라로 새지 않게.
      if (e.repeat) return;
      // 포커스된 모달 버튼에서 Enter → 그 버튼 활성화(기본 포커스는 기본 버튼이라 기본 Enter 동작은 그대로).
      if (e.key === 'Enter') {
        const i = current.btns.indexOf(document.activeElement);
        if (i >= 0) id = current.buttons[i].id;
      }
      finish(id);
    },
    true,
  );

  return { show, close: () => finish(null), isOpen: () => Boolean(current) };
}
