import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveModalKey } from '../public/src/nowhere/modal.js';

const YN = [{ id: 'yes', label: '예', primary: true }, { id: 'no', label: '아니오', cancel: true }];
const PICK = [{ id: 'haus', label: '하우스노웨어 성수' }, { id: 'facearch', label: '하우스노웨어 몽골' }, { id: 'close', label: '닫기', cancel: true }];

test('(a) Enter 는 기본 버튼, 기본 버튼이 없으면 첫 버튼', () => {
  assert.equal(resolveModalKey('Enter', YN), 'yes');
  assert.equal(resolveModalKey('Enter', PICK), 'haus');
});

test('(b) Esc 는 취소 버튼, 취소 버튼이 없으면 null', () => {
  assert.equal(resolveModalKey('Escape', YN), 'no');
  assert.equal(resolveModalKey('Escape', [{ id: 'ok', label: '확인', primary: true }]), null);
});

test('(c) 다른 키는 처리하지 않는다(undefined)', () => {
  assert.equal(resolveModalKey('KeyW', YN), undefined);
  assert.equal(resolveModalKey(' ', YN), undefined);
});
