import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { CONTROL_SECTIONS } from '../public/src/nowhere/help.js';

const allKeys = () => CONTROL_SECTIONS.flatMap((s) => s.rows.flatMap((r) => r.keys));

test('(a) 조작 안내는 공통·카메라 시점·보행 시점 세 묶음이고 행마다 키와 설명이 있다', () => {
  assert.deepEqual(CONTROL_SECTIONS.map((s) => s.id), ['common', 'camera', 'walk']);
  for (const s of CONTROL_SECTIONS) {
    assert.ok(s.title && s.rows.length > 0);
    for (const r of s.rows) assert.ok(r.keys.length > 0 && r.desc, `${s.id} 행에 키·설명 누락`);
  }
});

test('(b) 코드에 바인딩된 단축키가 모두 안내에 실려 있고, 분석 모드 키(F · [ · ])는 없다', () => {
  const keys = new Set(allKeys());
  for (const k of ['V', 'Esc', '?', 'W', 'A', 'S', 'D', 'Shift', 'Space', '↑', '↓', '←', '→', '휠', '클릭']) {
    assert.ok(keys.has(k), `안내에 '${k}' 없음`);
  }
  for (const k of ['F', '[', ']']) assert.equal(keys.has(k), false, `안내에 분석 모드 키 '${k}' 가 남아 있음`);
  const cam = readFileSync(new URL('../public/src/nowhere/camera.js', import.meta.url), 'utf8');
  const walk = readFileSync(new URL('../public/src/nowhere/walk.js', import.meta.url), 'utf8');
  const look = readFileSync(new URL('../public/src/nowhere/look.js', import.meta.url), 'utf8');
  assert.match(cam, /e\.key === 'v'/);
  assert.match(cam, /'Space'/);
  assert.match(cam, /requestPointerLock/);
  assert.match(walk, /ShiftLeft/);
  assert.match(look, /ArrowUp/);
  assert.equal(existsSync(new URL('../public/src/nowhere/analysis.js', import.meta.url)), false, 'analysis.js 가 남아 있음');
});

test('(c) 투어가 main.js 에 연결되어 있다(자동 시작 · 투어 시작 · 건물 이동)', () => {
  const main = readFileSync(new URL('../public/src/nowhere/main.js', import.meta.url), 'utf8');
  assert.match(main, /startScenario\('intro'\)/);
  assert.match(main, /startScenario\('chooseBuilding'\)/);
  assert.match(main, /createInterior\(/);
  const descs = CONTROL_SECTIONS.flatMap((s) => s.rows.map((r) => r.desc)).join('\n');
  assert.match(descs, /투어 시작/);
  assert.match(descs, /밖으로 나가기/);
});

test('(d) 실내 조작 안내: 층 버튼 · 층 선택 · 이 층 둘러보기', () => {
  const descs = CONTROL_SECTIONS.flatMap((s) => s.rows.map((r) => r.desc)).join('\n');
  assert.match(descs, /B1 · 1 · 12 · 13/);
  assert.match(descs, /층 선택/);
  assert.match(descs, /이 층 둘러보기/);
});
