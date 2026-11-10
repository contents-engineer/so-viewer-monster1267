// HAUS NOWHERE — 시나리오 투어: 단계 그래프(문구 포함) · 검증 · 실행기(순수, 테스트: tests/nowhere-scenario.test.mjs).
// 실제 동작(인트로 · 모달 · 비행 · 실내 진입)은 main.js 가 어댑터로 넣는다.
// 인트로를 사용자 입력으로 건너뛰어도('skipped') 건물 선택 모달로 이어지고, CANCEL · 모달 Esc(null) 는 시나리오를 끝낸다.
// 건물에 도착한 뒤의 모달(성수 입장 질문 · 몽골 준비중)에서 다른 건물로 바로 날아갈 수 있다(성수 ↔ 몽골).

export const CANCEL = Symbol('scenario-cancel');

export const SCENARIO = {
  start: 'intro',
  steps: {
    intro: { type: 'intro', next: 'chooseBuilding' },
    chooseBuilding: {
      type: 'modal',
      title: '어떤 건물로 이동하시겠습니까?',
      buttons: [
        { id: 'haus', label: '하우스노웨어 성수', building: 'haus', primary: true, next: 'flyHaus' },
        { id: 'facearch', label: '하우스노웨어 몽골', building: 'facearch', next: 'flyFacearch' },
        { id: 'close', label: '닫기', cancel: true, next: 'end' },
      ],
    },
    flyHaus: { type: 'fly', building: 'haus', next: 'askEnter' },
    askEnter: {
      type: 'modal',
      title: '입장하시겠습니까?',
      buttons: [
        { id: 'yes', label: '예', primary: true, next: 'enterHaus' },
        { id: 'toFacearch', label: '하우스노웨어 몽골로 이동', next: 'flyFacearch' },
        { id: 'no', label: '아니오', cancel: true, next: 'end' },
      ],
    },
    enterHaus: { type: 'enterInterior', building: 'haus', next: 'end' },
    flyFacearch: { type: 'fly', building: 'facearch', next: 'notReady' },
    notReady: {
      type: 'modal',
      title: '준비중입니다',
      buttons: [
        { id: 'toHaus', label: '하우스노웨어 성수로 이동', next: 'flyHaus' },
        { id: 'ok', label: '확인', primary: true, cancel: true, next: 'end' },
      ],
    },
    end: { type: 'end' },
  },
};

/** 모달은 고른 버튼의 next(모르는 결과 · null 은 'end'), 그 밖은 step.next(없으면 'end'). */
export function nextStepId(step, result) {
  if (step.type === 'modal') {
    const b = step.buttons.find((x) => x.id === result);
    return b ? b.next : 'end';
  }
  return step.next || 'end';
}

/** 시작 단계 · 모든 next 가 존재하는지 검사해 오류 문자열 목록을 돌려준다. */
export function validateScenario(scenario) {
  const errors = [];
  const ids = new Set(Object.keys(scenario.steps));
  if (!ids.has(scenario.start)) errors.push(`start '${scenario.start}' 없음`);
  if (!ids.has('end')) errors.push("'end' 단계 없음");
  for (const [id, s] of Object.entries(scenario.steps)) {
    const nexts = s.type === 'modal' ? s.buttons.map((b) => b.next) : s.type === 'end' ? [] : [s.next];
    for (const n of nexts) if (!ids.has(n)) errors.push(`${id} → '${n}' 없음`);
  }
  return errors;
}

/**
 * adapters: { intro, modal, fly, enterInterior } — 각각 (step) => Promise<결과>. CANCEL 을 돌려주면 끝.
 * start 를 다시 부르거나 cancel() 하면 앞선 실행은 기다리던 어댑터가 끝나는 대로 조용히 멈춘다(onEnd 는 한 번만).
 */
export function createScenarioRunner({ scenario = SCENARIO, adapters, onEnd = null }) {
  let token = 0;
  let running = false;
  let currentId = null;

  function stop() {
    running = false;
    currentId = null;
    if (typeof onEnd === 'function') onEnd();
  }

  async function start(stepId = scenario.start) {
    if (running) stop();
    const my = ++token;
    running = true;
    let id = stepId;
    try {
      while (id && id !== 'end') {
        const step = scenario.steps[id];
        if (!step) break;
        currentId = id;
        const fn = adapters[step.type];
        const result = typeof fn === 'function' ? await fn(step) : undefined;
        if (my !== token) return 'cancelled';
        if (result === CANCEL) break;
        id = nextStepId(step, result);
      }
    } finally {
      // 정상 종료 · CANCEL · 어댑터 예외 모두 이 실행이 아직 유효하면 정리(onEnd 한 번). 예외는 그대로 호출자에게 던진다.
      if (my === token) stop();
    }
    return 'done';
  }

  function cancel() {
    if (!running) return;
    token++;
    stop();
  }

  return { start, cancel, isRunning: () => running, current: () => currentId };
}
