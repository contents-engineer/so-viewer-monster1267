import test from 'node:test';
import assert from 'node:assert/strict';
import { walkSpeed, stepBody, WALK_SPEED, RUN_SPEED, JUMP_SPEED, GRAVITY } from '../public/src/nowhere/walk.js';

const DT = 1 / 120;

test('(a) Shift 를 누르고 있으면 달리기 속도, 아니면 걷기 속도', () => {
  assert.equal(walkSpeed(new Set(['KeyW'])), WALK_SPEED);
  assert.equal(walkSpeed(new Set(['KeyW', 'ShiftLeft'])), RUN_SPEED);
  assert.equal(walkSpeed(new Set(['ShiftRight'])), RUN_SPEED);
  assert.ok(RUN_SPEED > WALK_SPEED * 1.5);
});

test('(b) 점프: 최고 높이 ≈ v²/2g 에 이르고, 같은 지면에 착지하면 다시 접지 상태', () => {
  const body = { feetY: 0, vy: 0, grounded: true };
  stepBody(body, 0, DT, true);
  assert.equal(body.grounded, false);
  let peak = 0;
  let t = DT;
  while (!body.grounded && t < 3) {
    stepBody(body, 0, DT, false);
    peak = Math.max(peak, body.feetY);
    t += DT;
  }
  const expected = (JUMP_SPEED * JUMP_SPEED) / (2 * GRAVITY);
  assert.ok(Math.abs(peak - expected) < 0.05, `peak=${peak}, expected≈${expected}`);
  assert.ok(Math.abs(t - (2 * JUMP_SPEED) / GRAVITY) < 0.03, `airtime=${t}`);
  assert.equal(body.feetY, 0);
  assert.equal(body.vy, 0);
});

test('(c) 접지 중에는 비탈·턱(≤ 0.5 m)을 따라 발 높이가 붙는다', () => {
  const body = { feetY: 0, vy: 0, grounded: true };
  stepBody(body, 0.3, DT, false);
  assert.equal(body.feetY, 0.3);
  stepBody(body, -0.1, DT, false);
  assert.equal(body.feetY, -0.1);
  assert.equal(body.grounded, true);
});

test('(d) 0.5 m 넘는 낭떠러지(바위 위에서 내려섬 등)에서는 중력으로 떨어져 착지한다', () => {
  const body = { feetY: 2.0, vy: 0, grounded: true };
  stepBody(body, 0, DT, false);
  assert.equal(body.grounded, false);
  let t = DT;
  while (!body.grounded && t < 3) {
    stepBody(body, 0, DT, false);
    t += DT;
  }
  assert.equal(body.feetY, 0);
  assert.ok(Math.abs(t - Math.sqrt((2 * 2.0) / GRAVITY)) < 0.03, `fall time=${t}`);
});

test('(e) 공중에서는 점프 입력을 무시한다(이단 점프 없음)', () => {
  const body = { feetY: 0, vy: 0, grounded: true };
  stepBody(body, 0, DT, true);
  const vyAfterFirst = body.vy;
  stepBody(body, 0, DT, true);
  assert.ok(body.vy < vyAfterFirst, '두 번째 점프로 속도가 다시 올라가면 안 됨');
});
