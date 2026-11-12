// HAUS NOWHERE — 인트로 영화식 연출(DOM 오버레이 — 그리기 0): 위아래 검은 띠 · 제목 자막 · 건너뛰기 › · 진행 선.
// 인트로 비행(camera.js startIntro)과 함께 start, 매 프레임 progress(경과 / 12 초), 끝나거나 건너뛰면 end(띠가 0.5 초에 빠짐).
// body.is-cinema 동안 HUD(상단 바 · 하단 독 · 보행 안내 · 이동 스팟 · 성능 표시)를 숨긴다(nowhere.css).
// INTRO_TITLES · 시간 상수는 순수 데이터. DOM 은 createCinema 를 부를 때만 만든다(테스트: tests/nowhere-cinema.test.mjs).

export const CINEMA_TITLE_IN_MS = 1000;    // 제목 자막이 나타나는 때(인트로 시작 기준)
export const CINEMA_TITLE_OUT_MS = 5000;   // 제목 자막이 사라지는 때
export const CINEMA_OUT_MS = 500;          // 끝나거나 건너뛸 때 띠가 빠지는 시간
export const SKIP_LABEL = '건너뛰기 ›';

// 작은 글씨 = 좌표(성수) · 기존 브랜드 문구(산악), 큰 글씨 = 월드 제목
export const INTRO_TITLES = {
  seongsu: { kicker: '37.544°N 127.056°E', title: 'HAUS NOWHERE — 성수 2041' },
  ds2: { kicker: 'HIGHLAND BASIN · DS2 MOUNTAIN WORLD', title: 'HAUS NOWHERE — DS2 산악 고원' },
};

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

export function createCinema() {
  const root = el('div', 'nw-cinema');
  root.hidden = true;
  const top = el('div', 'nw-cinema-bar nw-cinema-bar-top');
  const bottom = el('div', 'nw-cinema-bar nw-cinema-bar-bottom');
  const line = el('div', 'nw-cinema-progress');   // 아래 띠 위 가장자리의 얇은 진행 선
  const fill = el('div', 'nw-cinema-progress-fill');
  line.append(fill);
  const skip = el('button', 'nw-cinema-skip', SKIP_LABEL);
  skip.type = 'button';
  bottom.append(line, skip);
  const card = el('div', 'nw-cinema-title');
  const kickerEl = el('div', 'nw-cinema-kicker');
  const headingEl = el('div', 'nw-cinema-heading');
  card.append(kickerEl, headingEl);
  root.append(top, card, bottom);
  document.body.append(root);

  let active = false;
  let onSkip = null;
  let timers = [];
  let ending = null;   // end() 가 기다리는 resolve — 그사이 start 가 다시 불리면 바로 끝낸다
  let lastU = -1;

  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  function clearTimers() {
    timers.forEach((id) => clearTimeout(id));
    timers = [];
  }
  function settleEnding() {
    if (!ending) return;
    const done = ending;
    ending = null;
    done();
  }

  skip.addEventListener('click', () => {
    if (active && typeof onSkip === 'function') onSkip();
  });

  /** 진행 선(0–1). 같은 값이면 쓰지 않는다 */
  function progress(u) {
    const v = Math.min(1, Math.max(0, Number(u) || 0));
    if (Math.abs(v - lastU) < 0.001) return;
    lastU = v;
    fill.style.transform = `scaleX(${v.toFixed(3)})`;
  }

  function start({ kicker = '', title = '', onSkip: cb = null } = {}) {
    clearTimers();
    settleEnding();
    active = true;
    onSkip = cb;
    kickerEl.textContent = kicker;
    headingEl.textContent = title;
    lastU = -1;
    progress(0);
    root.classList.remove('is-on', 'is-out', 'is-title');
    root.hidden = false;
    void root.offsetWidth;   // display:none 에서 바로 is-on 을 붙이면 띠가 들어오는 전환(0.6 초)이 생략된다
    root.classList.add('is-on');
    document.body.classList.add('is-cinema');
    later(() => root.classList.add('is-title'), CINEMA_TITLE_IN_MS);
    later(() => root.classList.remove('is-title'), CINEMA_TITLE_OUT_MS);
  }

  /** 띠를 빼고(0.5 초) 숨긴다. HUD 는 빠지기 시작할 때 돌아온다 */
  function end() {
    if (!active) return Promise.resolve();
    active = false;
    onSkip = null;
    clearTimers();
    root.classList.remove('is-on', 'is-title');
    root.classList.add('is-out');
    document.body.classList.remove('is-cinema');
    return new Promise((resolve) => {
      ending = resolve;
      later(() => {
        root.hidden = true;
        root.classList.remove('is-out');
        settleEnding();
      }, CINEMA_OUT_MS);
    });
  }

  return { start, progress, end, isActive: () => active, element: root };
}
