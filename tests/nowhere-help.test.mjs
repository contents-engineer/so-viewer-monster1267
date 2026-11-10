import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { CONTROL_SECTIONS, createWalkHud, WALK_HINT_DOCK_MS } from '../public/src/nowhere/help.js';

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
  for (const k of ['V', 'Esc', '?', 'P', 'W', 'A', 'S', 'D', 'Shift', 'Space', '↑', '↓', '←', '→', '휠', '클릭']) {
    assert.ok(keys.has(k), `안내에 '${k}' 없음`);
  }
  for (const k of ['F', '[', ']']) assert.equal(keys.has(k), false, `안내에 분석 모드 키 '${k}' 가 남아 있음`);
  const cam = readFileSync(new URL('../public/src/nowhere/camera.js', import.meta.url), 'utf8');
  const walk = readFileSync(new URL('../public/src/nowhere/walk.js', import.meta.url), 'utf8');
  const look = readFileSync(new URL('../public/src/nowhere/look.js', import.meta.url), 'utf8');
  assert.match(cam, /e\.key === 'v'/);
  assert.match(readFileSync(new URL('../public/src/nowhere/main.js', import.meta.url), 'utf8'), /e\.key === 'p'[\s\S]*perf\.toggle\(\)[\s\S]*get\('stats'\) === '1'/);
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

test('(e) 보행 안내: 보행을 켜면 가운데에 보였다가 WALK_HINT_DOCK_MS 뒤 오른쪽 위로 비킨다(끄고 다시 켜면 처음부터)', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const node = () => {
    const cls = new Set();
    return {
      hidden: false,
      textContent: '',
      append() {},
      classList: {
        toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)),
        add: (c) => cls.add(c),
        remove: (c) => cls.delete(c),
        contains: (c) => cls.has(c),
      },
    };
  };
  globalThis.document = { createElement: node, body: { append() {} } };
  try {
    const hud = createWalkHud();
    const docked = () => hud.element.classList.contains('is-docked');
    assert.equal(WALK_HINT_DOCK_MS, 4000);
    hud.setState({ walk: true, locked: false });
    assert.equal(hud.element.hidden, false);
    assert.equal(docked(), false, '켜자마자는 가운데');
    t.mock.timers.tick(WALK_HINT_DOCK_MS - 1);
    assert.equal(docked(), false);
    t.mock.timers.tick(1);
    assert.equal(docked(), true, '시간이 지나면 오른쪽 위');
    hud.setState({ walk: true, locked: true });
    assert.equal(docked(), true, '마우스 고정(같은 보행 중)으로는 가운데로 돌아오지 않는다');
    hud.setState({ walk: false, locked: false });
    assert.equal(hud.element.hidden, true);
    assert.equal(docked(), false);
    hud.setState({ walk: true, locked: false });
    assert.equal(docked(), false, '다시 켜면(실내 진입 · 층 이동 · V) 가운데부터');
    hud.setState({ walk: false, locked: false });
    t.mock.timers.tick(WALK_HINT_DOCK_MS);
    assert.equal(docked(), false, '꺼진 뒤에는 예약된 이동이 남지 않는다');
  } finally {
    delete globalThis.document;
  }
});
