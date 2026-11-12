import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MODES, MODE_MENU_TITLE, MODE_MENU_OUT_MS, resolveMenuKey } from '../public/src/nowhere/mode-menu.js';
import { MODE_IDS } from '../public/src/nowhere/entry.js';

test('(a) 카드: 순서 · 이름 · 영문 · 설명 · 숫자 키, 제목 · 사라짐 0.3 s', () => {
  assert.equal(MODE_MENU_TITLE, '어떻게 둘러볼까요?');
  assert.deepEqual(MODES.map((m) => m.id), MODE_IDS);
  assert.deepEqual(MODES.map((m) => [m.label, m.en, m.desc, m.key]), [
    ['가이드 투어', 'GUIDED TOUR', '두 건물과 실내를 차례로 안내합니다', '1'],
    ['직접 걷기', 'WALK', '눈높이로 걸으며 ◇ 스팟을 따라 이동합니다', '2'],
    ['자유 시점', 'FREE VIEW', '카메라를 돌리고 확대하며 원하는 시점에서 봅니다', '3'],
  ]);
  assert.equal(MODE_MENU_OUT_MS, 300);
});

test('(b) 키: 1 · 2 · 3 은 그 방식, Esc 는 자유 시점, Enter 는 포커스된 카드', () => {
  assert.deepEqual(resolveMenuKey('1', 2), { pick: 'guide' });
  assert.deepEqual(resolveMenuKey('2', 0), { pick: 'walk' });
  assert.deepEqual(resolveMenuKey('3', 0), { pick: 'free' });
  assert.deepEqual(resolveMenuKey('Escape', 0), { pick: 'free' });
  assert.deepEqual(resolveMenuKey('Enter', 0), { pick: 'guide' }, '첫 포커스 가이드 투어');
  assert.deepEqual(resolveMenuKey('Enter', 1), { pick: 'walk' });
  assert.deepEqual(resolveMenuKey('Enter', 2), { pick: 'free' });
});

test('(c) ←/→ 는 포커스만 옮기고 끝에서 멈춘다, 그 밖의 키는 null', () => {
  assert.deepEqual(resolveMenuKey('ArrowRight', 0), { focus: 1 });
  assert.deepEqual(resolveMenuKey('ArrowRight', 2), { focus: 2 });
  assert.deepEqual(resolveMenuKey('ArrowLeft', 2), { focus: 1 });
  assert.deepEqual(resolveMenuKey('ArrowLeft', 0), { focus: 0 });
  for (const k of ['4', 'v', 'KeyW', ' ', 'Tab']) assert.equal(resolveMenuKey(k, 0), null, k);
});

test('(d) CSS: 방식 고르기 동안 HUD 숨김 · 세로 화면은 카드를 세로로 쌓는다', () => {
  const css = readFileSync(new URL('../public/src/nowhere/nowhere.css', import.meta.url), 'utf8');
  for (const sel of ['.nw-topbar', '.nw-dock', '.nw-walk-hud', '.nw-spots', '.nw-perf']) {
    assert.ok(css.includes(`body.is-choosing ${sel}`), `방식 고르기 중 ${sel} 를 숨기지 않음`);
  }
  assert.match(css, /\.nw-mode-card \{[^}]*min-height: 44px/);
  assert.match(css, /@media \(max-width: 720px\) and \(orientation: portrait\) \{\s*\.nw-mode-cards \{\s*flex-direction: column;/);
});
