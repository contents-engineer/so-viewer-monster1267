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
  for (const k of ['V', 'Esc', '?', 'P', 'W', 'A', 'S', 'D', 'Shift', 'Space', '↑', '↓', '←', '→', 'Q', 'E', '휠', '클릭', '1', '2', '3']) {
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

test('(c) 시작 흐름 · 가이드 투어가 main.js 에 연결되어 있다(인트로는 시나리오 밖, 가이드 투어 = 건물 선택부터)', () => {
  const main = readFileSync(new URL('../public/src/nowhere/main.js', import.meta.url), 'utf8');
  assert.doesNotMatch(main, /startScenario\('intro'\)/);
  assert.match(main, /startScenario\('chooseBuilding'\)/);
  assert.match(main, /runEntry\(\)/);
  assert.match(main, /createInterior\(/);
  const descs = CONTROL_SECTIONS.flatMap((s) => s.rows.map((r) => r.desc)).join('\n');
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

test('(f) 보행 이동 스팟 안내: 보행 시점 행(클릭 · 탭) · 보행 안내 문구 · main.js 연결', () => {
  const walk = CONTROL_SECTIONS.find((s) => s.id === 'walk');
  const row = walk.rows.find((r) => /이동 스팟/.test(r.desc));
  assert.ok(row, '보행 시점에 이동 스팟 행 없음');
  assert.deepEqual(row.keys, ['클릭', '탭']);
  assert.match(row.desc, /걸어가기/);
  assert.match(row.desc, /입장/);
  const help = readFileSync(new URL('../public/src/nowhere/help.js', import.meta.url), 'utf8');
  assert.match(help, /◇ 스팟/);
  const main = readFileSync(new URL('../public/src/nowhere/main.js', import.meta.url), 'utf8');
  assert.match(main, /createSpotMarkers\(/);
  assert.match(main, /planWalkPath\(/);
  assert.match(main, /markers\.update\(dt\)/);
});

test('(g) 시작 흐름 · 방식 안내: 투어 시작 · 건물 이동 버튼 행은 없고, 방식 전환 · 방식 고르기 · 월드 선택 · 인트로 건너뛰기 행이 있다', () => {
  const rows = CONTROL_SECTIONS.flatMap((s) => s.rows);
  const descs = rows.map((r) => r.desc).join('\n');
  assert.doesNotMatch(descs, /투어 시작/);
  assert.doesNotMatch(descs, /건물 이동/);
  const modeRow = rows.find((r) => /^방식 전환/.test(r.desc));
  assert.ok(modeRow, '방식 전환 행 없음');
  assert.match(modeRow.desc, /가이드 투어 · 직접 걷기 · 자유 시점/);
  assert.match(modeRow.desc, /카메라 프리셋 버튼은 자유 시점에서만/);
  const menuRow = rows.find((r) => r.keys.join(',') === '1,2,3');
  assert.ok(menuRow, '방식 고르기(1 · 2 · 3) 행 없음');
  assert.match(menuRow.desc, /방식 고르기/);
  assert.match(descs, /월드 선택/);
  assert.match(descs, /인트로 건너뛰기/);
  assert.match(descs, /새로 고침/);
});

test('(h) 자유 시점 마우스 · 터치 조작이 모두 실려 있다(OrbitControls 기본 배치 그대로 — Shift · Ctrl · ⌘ + 드래그 이동, 가운데 버튼 확대, 두 손가락)', () => {
  const cam = CONTROL_SECTIONS.find((s) => s.id === 'camera');
  const byKey = (k) => cam.rows.find((r) => r.keys.includes(k));
  const pan = byKey('Shift + 드래그');
  assert.ok(pan, "카메라 시점에 'Shift + 드래그' 행 없음");
  assert.match(pan.desc, /이동\(팬\)/);
  assert.match(pan.desc, /Ctrl/);
  assert.match(pan.desc, /⌘/);
  assert.match(byKey('우클릭 드래그').desc, /회전/, '우클릭 + 보조 키 회전 설명 없음');
  assert.match(byKey('가운데 버튼 드래그').desc, /확대 · 축소/);
  assert.match(byKey('한 손가락').desc, /회전/);
  assert.match(byKey('두 손가락').desc, /확대 · 축소/);
  assert.match(byKey('두 손가락').desc, /이동/);
  // 보행: 터치로 둘러보기, 스팟 걸어가기는 휠로도 멈춘다(camera.js 휠 → 자동 걷기 멈춤)
  const walk = CONTROL_SECTIONS.find((s) => s.id === 'walk');
  assert.ok(walk.rows.some((r) => r.keys.includes('한 손가락') && /둘러보기/.test(r.desc)), '보행 시점 터치 둘러보기 행 없음');
  assert.match(walk.rows.find((r) => /이동 스팟/.test(r.desc)).desc, /휠/);
  // 안내가 기대는 기본 배치를 코드가 바꾸지 않는다(바꾸면 이 안내도 고쳐야 한다)
  const camSrc = readFileSync(new URL('../public/src/nowhere/camera.js', import.meta.url), 'utf8');
  assert.doesNotMatch(camSrc, /mouseButtons|controls\.touches|listenToKeyEvents/);
  assert.match(camSrc, /canvas\.addEventListener\('wheel', onAutoWalkInterrupt/);
});
