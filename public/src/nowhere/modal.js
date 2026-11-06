// HAUS NOWHERE — 공용 모달(시나리오 투어 · 실내 출구 · 오류). 조작 안내 오버레이와 같은 패널 스타일.
// resolveModalKey 는 순수 함수(테스트: tests/nowhere-modal.test.mjs). DOM 은 createModal 을 부를 때만 만든다.

/** Enter → 기본 버튼 id(없으면 첫 버튼), Escape → 취소 버튼 id(없으면 null), 그 밖 → undefined. */
export function resolveModalKey(key, buttons) {
  if (key === 'Enter') {
    const p = buttons.find((b) => b.primary) || buttons[0];
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

  let current = null;   // { buttons, resolve }

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
    let primaryBtn = null;
    for (const spec of buttons) {
      const btn = el('button', `nw-btn nw-modal-btn${spec.primary ? ' is-primary' : ''}`);
      btn.type = 'button';
      btn.append(el('span', 'nw-modal-btn-label', spec.label));
      if (spec.sub) btn.append(el('span', 'nw-modal-btn-sub', spec.sub));
      btn.addEventListener('click', () => finish(spec.id));
      actions.append(btn);
      if (!primaryBtn && (spec.primary || buttons[0] === spec)) primaryBtn = btn;
    }
    root.hidden = false;
    if (typeof onShow === 'function') onShow();
    primaryBtn?.focus();
    return new Promise((resolve) => {
      current = { buttons, resolve };
    });
  }

  window.addEventListener(
    'keydown',
    (e) => {
      if (!current) return;
      const id = resolveModalKey(e.key, current.buttons);
      if (id === undefined) return;
      e.preventDefault();
      e.stopPropagation();
      finish(id);
    },
    true,
  );

  return { show, close: () => finish(null), isOpen: () => Boolean(current) };
}
