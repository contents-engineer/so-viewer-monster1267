import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIO, CANCEL, nextStepId, validateScenario, createScenarioRunner } from '../public/src/nowhere/scenario.js';

function fakeAdapters(choices, log) {
  const queue = [...choices];
  return {
    modal: async (s) => { log.push(`modal:${s.title}`); return queue.shift(); },
    fly: async (s) => { log.push(`fly:${s.building}`); return 'done'; },
    enterInterior: async (s) => { log.push(`enter:${s.building}`); return 'done'; },
  };
}

test('(a) 그래프가 유효하고 문구가 정확하다 · 시작은 건물 선택, 인트로 단계 없음', () => {
  assert.deepEqual(validateScenario(SCENARIO), []);
  assert.equal(SCENARIO.start, 'chooseBuilding');
  assert.equal(SCENARIO.steps.intro, undefined);
  assert.ok(Object.values(SCENARIO.steps).every((s) => s.type !== 'intro'));
  assert.equal(SCENARIO.steps.chooseBuilding.title, '어떤 건물로 이동하시겠습니까?');
  assert.deepEqual(SCENARIO.steps.chooseBuilding.buttons.map((b) => b.label), ['하우스노웨어 성수', '하우스노웨어 몽골', '닫기']);
  assert.equal(SCENARIO.steps.askEnter.title, '입장하시겠습니까?');
  assert.deepEqual(SCENARIO.steps.askEnter.buttons.map((b) => b.label), ['예', '하우스노웨어 몽골로 이동', '아니오']);
  assert.equal(SCENARIO.steps.notReady.title, '준비중입니다');
  assert.deepEqual(SCENARIO.steps.notReady.buttons.map((b) => b.label), ['하우스노웨어 성수로 이동', '확인']);
});

test('(b) 성수 → 예: 선택 → 비행 → 입장 질문 → 실내 진입', async () => {
  const log = [];
  let ended = 0;
  const r = createScenarioRunner({ adapters: fakeAdapters(['haus', 'yes'], log), onEnd: () => ended++ });
  assert.equal(await r.start(), 'done');
  assert.deepEqual(log, ['modal:어떤 건물로 이동하시겠습니까?', 'fly:haus', 'modal:입장하시겠습니까?', 'enter:haus']);
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
  assert.deepEqual(log, ['modal:어떤 건물로 이동하시겠습니까?', 'fly:facearch', 'modal:준비중입니다']);
});

test('(e) 모달에서 Esc(null) 는 시나리오 종료', async () => {
  const log = [];
  await createScenarioRunner({ adapters: fakeAdapters([null], log) }).start();
  assert.deepEqual(log, ['modal:어떤 건물로 이동하시겠습니까?']);
});

test("(f) start() 와 start('chooseBuilding') 은 같은 모달부터", async () => {
  const a = [];
  const b = [];
  await createScenarioRunner({ adapters: fakeAdapters(['facearch', 'ok'], a) }).start();
  await createScenarioRunner({ adapters: fakeAdapters(['facearch', 'ok'], b) }).start('chooseBuilding');
  assert.equal(a[0], 'modal:어떤 건물로 이동하시겠습니까?');
  assert.deepEqual(a, b);
});

test('(g) 어댑터가 CANCEL 을 돌려주면 끝, 비행 중 cancel() 하면 다음 단계로 가지 않는다', async () => {
  const log = [];
  const a = fakeAdapters(['haus', 'yes'], log);
  a.fly = async () => CANCEL;
  await createScenarioRunner({ adapters: a }).start();
  assert.deepEqual(log, ['modal:어떤 건물로 이동하시겠습니까?']);

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
  assert.equal(nextStepId(SCENARIO.steps.flyHaus, 'done'), 'askEnter');
});

test('(i) 어댑터가 예외를 던져도 실행기는 정리된다(onEnd 한 번 · isRunning false), 예외는 호출자에게 전달', async () => {
  const log = [];
  const a = fakeAdapters(['haus', 'yes'], log);
  a.fly = async () => { throw new Error('flight failed'); };
  let ended = 0;
  const r = createScenarioRunner({ adapters: a, onEnd: () => ended++ });
  await assert.rejects(r.start(), /flight failed/);
  assert.equal(ended, 1);
  assert.equal(r.isRunning(), false);
  assert.equal(r.current(), null);
});

test('(j) 시나리오가 쓰는 건물 id 는 모두 TOUR_BUILDINGS 에 있다', async () => {
  const { TOUR_BUILDINGS } = await import('../public/src/nowhere/tour-config.js');
  const ids = Object.values(SCENARIO.steps)
    .flatMap((s) => [s.building, ...(s.buttons || []).map((b) => b.building)])
    .filter(Boolean);
  assert.ok(ids.length >= 4, `건물 id ${ids.length}개`);
  for (const id of ids) assert.ok(TOUR_BUILDINGS[id], `TOUR_BUILDINGS 에 '${id}' 없음`);
});

test('(k) 도착 모달에서 다른 건물로: 성수 → 몽골로 이동 → 준비중 → 성수로 이동 → 입장 질문 → 예', async () => {
  const log = [];
  await createScenarioRunner({ adapters: fakeAdapters(['haus', 'toFacearch', 'toHaus', 'yes'], log) }).start('chooseBuilding');
  assert.deepEqual(log, [
    'modal:어떤 건물로 이동하시겠습니까?',
    'fly:haus',
    'modal:입장하시겠습니까?',
    'fly:facearch',
    'modal:준비중입니다',
    'fly:haus',
    'modal:입장하시겠습니까?',
    'enter:haus',
  ]);
  // Enter(기본) · Esc(취소)는 그대로: 성수 입장 질문은 예 · 아니오, 몽골 준비중은 확인
  const { resolveModalKey } = await import('../public/src/nowhere/modal.js');
  assert.equal(resolveModalKey('Enter', SCENARIO.steps.askEnter.buttons), 'yes');
  assert.equal(resolveModalKey('Escape', SCENARIO.steps.askEnter.buttons), 'no');
  assert.equal(resolveModalKey('Enter', SCENARIO.steps.notReady.buttons), 'ok');
  assert.equal(resolveModalKey('Escape', SCENARIO.steps.notReady.buttons), 'ok');
});
