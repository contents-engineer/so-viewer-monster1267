import test from 'node:test';
import assert from 'node:assert/strict';
import { floorOrder, shortLabel, elevatorButtons, inArea, createAreaTrigger, isFloorChain, isCeilingChain } from '../public/src/nowhere/inner-nav.js';

const layout = {
  floors: [
    { id: 'b1', label: 'B1F 카페', elevation: -4.5 },
    { id: '1', label: '1F 로비', elevation: 0 },
    { id: '12', label: '12F', elevation: 55 },
    { id: '13', label: '13F 몬스터 룸', elevation: 60 },
  ],
};

test('(a) 층 순서는 위층부터(엘리베이터 패널), 짧은 이름 B1 · 1 · 12 · 13', () => {
  assert.deepEqual(floorOrder(layout).map((f) => f.id), ['13', '12', '1', 'b1']);
  assert.deepEqual(floorOrder(layout).map(shortLabel), ['13', '12', '1', 'B1']);
  assert.deepEqual(layout.floors.map((f) => f.id), ['b1', '1', '12', '13'], '원본 배열은 그대로');
});

test('(b) 층 선택 버튼: 현재 층을 뺀 층 이름(위층부터) + 닫기(취소)', () => {
  assert.deepEqual(elevatorButtons(layout, '1'), [
    { id: '13', label: '13F 몬스터 룸' },
    { id: '12', label: '12F' },
    { id: 'b1', label: 'B1F 카페' },
    { id: 'close', label: '닫기', cancel: true },
  ]);
});

test('(c) 영역: 수평 거리(x, z)로 판정, 높이는 무시', () => {
  const area = { pos: [0, 0, -19], radius: 2.5 };
  assert.equal(inArea({ x: 0, y: 1.7, z: -17 }, area), true);
  assert.equal(inArea({ x: 0, y: 30, z: -16.4 }, area), false);
});

test('(d) 영역 트리거: 들어갈 때 한 번, 나갔다 다시 들어오면 또 · 보행이 아니면 묻지 않고 무장 유지', () => {
  const t = createAreaTrigger();
  assert.equal(t.update(true), true);
  assert.equal(t.update(true), false, '안에 머무는 동안은 다시 묻지 않음');
  assert.equal(t.update(false), false);
  assert.equal(t.update(true, false), false, '보행 아님 → 묻지 않음');
  assert.equal(t.update(true, true), true, '무장이 유지돼 보행으로 바꾸면 묻는다');
  t.reset();
  assert.equal(t.update(true), true, 'reset 뒤에는 다시 묻는다');
});

test('(e) 바닥 · 천장 이름 판정은 이름 앞머리에서만(중간 일치 제외)', () => {
  assert.equal(isFloorChain('IN_floor|NW_InnerFloor_1|'), true);
  assert.equal(isFloorChain('mesh_0|IN_floor|root|'), true, '이름 붙은 노드 아래 자식 메시');
  assert.equal(isFloorChain('EX_lamp_IN_floor|'), false);
  assert.equal(isCeilingChain('IN_ceiling|'), true);
  assert.equal(isCeilingChain('IN_floor|'), false);
});
