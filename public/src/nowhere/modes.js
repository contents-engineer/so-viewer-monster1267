// HAUS NOWHERE — 둘러보기 방식(가이드 투어 · 직접 걷기 · 자유 시점) 상태 하나를 body[data-mode] 와 상단 방식 전환(#nw-mode-seg)에 반영한다.
// 투어 시작 · 끝내기는 main.js 가 넘긴다(startGuide · endGuide). 카메라 시점 버튼은 자유 시점에서만 보인다(nowhere.css body[data-mode]).
// 테스트: tests/nowhere-modes.test.mjs
import { MODE_IDS } from './entry.js';

/** body[data-mode] 와 #nw-mode-seg 버튼(is-active · aria-pressed)을 mode 에 맞춘다. document 가 없으면(노드 테스트) 아무것도 하지 않는다 */
export function renderMode(mode, doc = globalThis.document) {
  if (!doc) return;
  if (mode) doc.body.dataset.mode = mode;
  else delete doc.body.dataset.mode;
  doc.querySelectorAll('#nw-mode-seg [data-mode]').forEach((btn) => {
    const on = btn.dataset.mode === mode;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-pressed', String(on));
  });
}

/**
 * set(mode): guide = 건물 선택부터 투어(이미 가이드 투어여도 다시 연다), walk = 그 자리에서 보행, free = 보행 끄기 · 진행 중인 투어 끝내기.
 * syncWalk(active): V 키 · 실내 출입 등으로 보행이 켜지면 walk, walk 인데 꺼지면 free(가이드 투어는 투어가 보행을 끄므로 그대로).
 *   isSuspended()(실내 · 실내 화면 전환 중) 동안은 무시한다 — 실내 출입 · 층 이동 · 둘러보기가 보행을 켰다 껐다 한다.
 * refresh(): 실내에서 나온 뒤 — 보행 중이면 walk, 아니면 들어가기 전 방식(walk 였으면 free).
 */
export function createModeController({ camCtrl, startGuide, endGuide, isSuspended = () => false, onChange = renderMode }) {
  let mode = null;

  function commit(next) {
    if (next === mode) return;
    mode = next;
    if (typeof onChange === 'function') onChange(mode);
  }

  function apply(walking) {
    if (walking) commit('walk');
    else if (mode === 'walk') commit('free');
  }

  function set(next) {
    if (!MODE_IDS.includes(next)) return mode;
    if (next === 'guide') {
      commit('guide');   // 먼저 바꾼다 — startGuide 가 보행을 끌 때(syncWalk(false)) 자유 시점으로 바뀌지 않게
      startGuide();
    } else if (next === 'walk') {
      endGuide();
      commit('walk');
      if (!camCtrl.isWalkMode()) camCtrl.setWalkMode(true);
    } else {
      endGuide();
      commit('free');
      if (camCtrl.isWalkMode()) camCtrl.setWalkMode(false);
    }
    return mode;
  }

  return {
    set,
    get: () => mode,
    syncWalk(active) {
      if (!isSuspended()) apply(Boolean(active));
    },
    refresh() {
      apply(camCtrl.isWalkMode());
    },
  };
}
