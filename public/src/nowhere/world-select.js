// HAUS NOWHERE — 월드 선택 화면(일반 주소 / 첫 화면): 화면을 반씩 — 왼쪽 성수 2041 · 오른쪽 DS2 산악, 대표 렌더 한 장씩.
// 마우스 올림 · 포커스한 면이 60 % 로 넓어지고 밝아지며 배경이 천천히 확대(8 초에 1.0 → 1.06), 고르면 그 면이 화면 전체로 펼쳐진 뒤 로딩으로.
// WORLD_CARDS · resolveSelectKey 는 순수(테스트: tests/nowhere-world-select.test.mjs). DOM 은 showWorldSelect 를 부를 때만 만든다.
// 이 화면 동안에는 3D 월드(GLB · HDRI · layout)를 받지 않는다 — main.js 가 고른 뒤 렌더러 · 월드를 만든다. 스타일: nowhere.css .nw-select

export const SELECT_EXPAND_MS = 600;   // 고른 면이 화면 전체로 펼쳐지는 시간
export const SELECT_FADE_MS = 300;     // 펼쳐진 뒤 로딩 화면(같은 이미지)으로 겹쳐 넘어가는 시간
export const SELECT_BRAND = 'HAUS NOWHERE';
export const SELECT_CTA = '들어가기 →';

// image 는 페이지 기준 경로. nowhere.css 의 로더 배경(body[data-world-ver] .nw-loader)이 같은 파일을 '../../' 로 쓴다 — 바꾸면 둘을 함께(테스트 (c))
export const WORLD_CARDS = [
  {
    id: 'seongsu',
    kicker: 'SEONGSU · 2041',
    title: '성수 2041',
    desc: '벽돌 공장 골목 위로 유리 타워가 선 2041년의 뚝섬로',
    image: 'assets/nowhere/renders/hero-future.webp',
  },
  {
    id: 'ds2',
    kicker: 'CHIRAL HIGHLAND · DS2',
    title: 'DS2 산악 고원',
    desc: '이끼 덮인 빙하 계곡과 층리 암벽 사이의 산악 고원',
    image: 'assets/nowhere-ds2/renders/hero-valley.webp',
  },
];

/** ←/→ 포커스 이동(끝에서 멈춤), Enter 포커스된 면 고르기. 그 밖의 키는 null */
export function resolveSelectKey(key, index) {
  if (key === 'ArrowLeft') return { focus: Math.max(0, index - 1) };
  if (key === 'ArrowRight') return { focus: Math.min(WORLD_CARDS.length - 1, index + 1) };
  if (key === 'Enter') return { pick: WORLD_CARDS[index].id };
  return null;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/** 월드 선택 화면을 띄우고 고른 월드 id 를 돌려준다(첫 포커스는 왼쪽 성수). 고르면 body[data-world-ver] 를 먼저 바꿔 로딩 화면 배경을 맞춘다 */
export function showWorldSelect() {
  return new Promise((resolve) => {
    const reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const root = el('div', 'nw-select');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', '월드 선택');
    root.append(el('div', 'nw-select-brand', SELECT_BRAND));

    let focus = 0;
    let picked = false;
    const panes = WORLD_CARDS.map((card, i) => {
      const pane = el('button', 'nw-select-pane');
      pane.type = 'button';
      pane.dataset.world = card.id;
      const bg = el('span', 'nw-select-bg');
      bg.style.backgroundImage = `url("${card.image}")`;
      const text = el('span', 'nw-select-text');
      text.append(
        el('span', 'nw-select-kicker', card.kicker),
        el('span', 'nw-select-title', card.title),
        el('span', 'nw-select-desc', card.desc),
        el('span', 'nw-select-cta', SELECT_CTA),
      );
      pane.append(bg, el('span', 'nw-select-shade'), text);
      pane.addEventListener('mouseenter', () => setFocus(i));
      pane.addEventListener('focus', () => setFocus(i, false));
      pane.addEventListener('click', () => pick(i));
      root.append(pane);
      return pane;
    });

    // 포커스한 면(is-active)이 60 % 로 넓어지고 밝아진다 — 마우스 올림도 포커스로 옮겨 키보드와 같은 상태를 쓴다
    function setFocus(i, moveFocus = true) {
      if (picked) return;
      focus = i;
      panes.forEach((p, k) => p.classList.toggle('is-active', k === i));
      if (moveFocus && document.activeElement !== panes[i]) panes[i].focus({ preventScroll: true });
    }

    function onKey(e) {
      if (picked) return;
      const action = resolveSelectKey(e.key, focus);
      if (!action) return;
      e.preventDefault();   // Enter 가 포커스된 면 버튼의 click 으로 한 번 더 고르지 않게
      if (action.pick) {
        if (!e.repeat) pick(focus);
      } else {
        setFocus(action.focus);
      }
    }

    function pick(i) {
      if (picked) return;
      setFocus(i, false);
      picked = true;
      window.removeEventListener('keydown', onKey, true);
      const id = WORLD_CARDS[i].id;
      document.body.dataset.worldVer = id;   // 아래 로딩 화면 배경을 고른 월드 이미지로(nowhere.css body[data-world-ver] .nw-loader)
      panes[i].classList.add('is-chosen');
      root.classList.add('is-picked');        // 고른 면이 화면 전체로(flex-grow 전환 0.6 초)
      setTimeout(() => {
        root.classList.add('is-done');        // 같은 이미지의 로딩 화면으로 0.3 초 겹쳐 넘어간다
        setTimeout(() => root.remove(), SELECT_FADE_MS);
        resolve(id);
      }, reduceMotion ? 0 : SELECT_EXPAND_MS);
    }

    window.addEventListener('keydown', onKey, true);
    document.body.append(root);
    setFocus(0);   // 첫 포커스는 왼쪽(성수)
  });
}
