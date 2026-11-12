// HAUS NOWHERE — 공용 화면 전환(검게): 실내 진입 · 층 이동 · 나가기와 보행 스팟 컷 이동이 같은 레이어를 쓴다.
// DOM 은 createFade 를 부를 때만 만든다(테스트: tests/nowhere-fade.test.mjs). 스타일: nowhere.css .nw-fade

export const FADE_MS = 600;

export function createFade() {
  const root = document.createElement('div');
  root.className = 'nw-fade';
  const text = document.createElement('div');
  text.className = 'nw-fade-text';
  root.append(text);
  document.body.append(root);

  /** on = 어둡게(true) · 밝게(false). 가운데 문구 t, ms 뒤에 끝난다 */
  function fadeTo(on, t = '', ms = FADE_MS) {
    return new Promise((res) => {
      text.textContent = t;
      root.style.transitionDuration = `${ms}ms`;
      root.classList.toggle('is-on', on);
      setTimeout(res, ms);
    });
  }

  return {
    fadeTo,
    setText: (t) => {
      text.textContent = t;
    },
    element: root,
  };
}
