import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIO, CANCEL, nextStepId, validateScenario, createScenarioRunner } from '../public/src/nowhere/scenario.js';

function fakeAdapters(choices, log) {
  const queue = [...choices];
  return {
    intro: async (s) => { log.push(s.type); return 'complete'; },
    modal: async (s) => { log.push(`modal:${s.title}`); return queue.shift(); },
    fly: async (s) => { log.push(`fly:${s.building}`); return 'done'; },
    enterInterior: async (s) => { log.push(`enter:${s.building}`); return 'done'; },
  };
}

test('(a) 그래프가 유효하고 문구가 정확하다', () => {
  assert.deepEqual(validateScenario(SCENARIO), []);
  assert.equal(SCENARIO.steps.chooseBuilding.title, '어떤 건물로 이동하시겠습니까?');
  assert.deepEqual(SCENARIO.steps.chooseBuilding.buttons.map((b) => b.label), ['하우스노웨어 성수', '하우스노웨어 몽골', '닫기']);
  assert.equal(SCENARIO.steps.askEnter.title, '입장하시겠습니까?');
  assert.deepEqual(SCENARIO.steps.askEnter.buttons.map((b) => b.label), ['예', '아니오']);
  assert.equal(SCENARIO.steps.notReady.title, '준비중입니다');
  assert.deepEqual(SCENARIO.steps.notReady.buttons.map((b) => b.label), ['확인']);
});

test('(b) 성수 → 예: 인트로 → 선택 → 비행 → 입장 질문 → 실내 진입', async () => {
  const log = [];
  let ended = 0;
  const r = createScenarioRunner({ adapters: fakeAdapters(['haus', 'yes'], log), onEnd: () => ended++ });
  assert.equal(await r.start(), 'done');
  assert.deepEqual(log, ['intro', 'modal:어떤 건물로 이동하시겠습니까?', 'fly:haus', 'modal:입장하시겠습니까?', 'enter:haus']);
  assert.equal(ended, 1);
  assert.equal(r.isRunning(), false);
});

test('(c) 성수 → 아니오: 실내 진입 없이 끝', async () => {
  const log = [];
  await createScenarioRunner({ adapters: fakeAdapters(['haus', 'no'], log) }).start();
  assert.equal(log.includes('enter:haus'), false);
  assert.equal(log.at(-1), 'modal:입장하시겠습니까?');
});

test('(d) 몽골 → 준비중입니다 → 확인 → 끝', async () => {
  const log = [];
  await createScenarioRunner({ adapters: fakeAdapters(['facearch', 'ok'], log) }).start();
  assert.deepEqual(log, ['intro', 'modal:어떤 건물로 이동하시겠습니까?', 'fly:facearch', 'modal:준비중입니다']);
});

test('(e) 모달에서 Esc(null) 는 시나리오 종료', async () => {
  const log = [];
  await createScenarioRunner({ adapters: fakeAdapters([null], log) }).start();
  assert.deepEqual(log, ['intro', 'modal:어떤 건물로 이동하시겠습니까?']);
});

test("(f) start('chooseBuilding') 는 인트로 없이 모달부터", async () => {
  const log = [];
  await createScenarioRunner({ adapters: fakeAdapters(['facearch', 'ok'], log) }).start('chooseBuilding');
  assert.equal(log[0], 'modal:어떤 건물로 이동하시겠습니까?');
});

test('(g) 어댑터가 CANCEL 을 돌려주면 끝, 비행 중 cancel() 하면 다음 단계로 가지 않는다', async () => {
  const log = [];
  const a = fakeAdapters(['haus', 'yes'], log);
  a.intro = async () => CANCEL;
  await createScenarioRunner({ adapters: a }).start();
  assert.deepEqual(log, []);

  const log2 = [];
  let release;
  const b = fakeAdapters(['haus', 'yes'], log2);
  b.fly = () => new Promise((res) => { release = res; });
  let ended = 0;
  const r = createScenarioRunner({ adapters: b, onEnd: () => ended++ });
  const p = r.start();
  await new Promise((res) => setTimeout(res, 0));
  assert.equal(r.current(), 'flyHaus');
  r.cancel();
  release('cancelled');
  assert.equal(await p, 'cancelled');
  assert.equal(log2.includes('modal:입장하시겠습니까?'), false);
  assert.equal(ended, 1);
});

test('(h) nextStepId: 모달은 버튼의 next, 모르는 결과는 end, 나머지는 step.next', () => {
  assert.equal(nextStepId(SCENARIO.steps.chooseBuilding, 'haus'), 'flyHaus');
  assert.equal(nextStepId(SCENARIO.steps.chooseBuilding, null), 'end');
  assert.equal(nextStepId(SCENARIO.steps.intro, 'skipped'), 'chooseBuilding');
});
