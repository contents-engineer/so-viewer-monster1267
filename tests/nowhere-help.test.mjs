import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONTROL_SECTIONS } from '../public/src/nowhere/help.js';

const allKeys = () => CONTROL_SECTIONS.flatMap((s) => s.rows.flatMap((r) => r.keys));

test('(a) 조작 안내는 공통·카메라 시점·보행 시점 세 묶음이고 행마다 키와 설명이 있다', () => {
  assert.deepEqual(CONTROL_SECTIONS.map((s) => s.id), ['common', 'camera', 'walk']);
  for (const s of CONTROL_SECTIONS) {
    assert.ok(s.title && s.rows.length > 0);
    for (const r of s.rows) assert.ok(r.keys.length > 0 && r.desc, `${s.id} 행에 키·설명 누락`);
  }
});

test('(b) 코드에 바인딩된 단축키가 모두 안내에 실려 있다(키를 바꾸면 안내도 바꿔야 통과)', () => {
  const keys = new Set(allKeys());
  for (const k of ['V', 'F', '[', ']', 'Esc', '?', 'W', 'A', 'S', 'D', 'Shift', 'Space', '↑', '↓', '←', '→', '휠', '클릭']) {
    assert.ok(keys.has(k), `안내에 '${k}' 없음`);
  }
  // 실제 바인딩과 대조: camera.js(V, Space, Shift, 방향키), analysis.js(F, [ ]) 소스에 해당 키 처리가 있어야 한다
  const cam = readFileSync(new URL('../public/src/nowhere/camera.js', import.meta.url), 'utf8');
  const ana = readFileSync(new URL('../public/src/nowhere/analysis.js', import.meta.url), 'utf8');
  const walk = readFileSync(new URL('../public/src/nowhere/walk.js', import.meta.url), 'utf8');
  const look = readFileSync(new URL('../public/src/nowhere/look.js', import.meta.url), 'utf8');
  assert.match(cam, /e\.key === 'v'/);
  assert.match(cam, /'Space'/);
  assert.match(cam, /requestPointerLock/);
  assert.match(walk, /ShiftLeft/);
  assert.match(look, /ArrowUp/);
  assert.match(ana, /e\.key === 'f'/);
  assert.match(ana, /e\.key === '\]'/);
});
