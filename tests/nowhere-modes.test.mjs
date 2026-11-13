import test from 'node:test';
import assert from 'node:assert/strict';
import { createModeController, renderMode } from '../public/src/nowhere/modes.js';
import { MODE_IDS } from '../public/src/nowhere/entry.js';
import { readFileSync } from 'node:fs';
import { MODES } from '../public/src/nowhere/mode-menu.js';

// 가짜 카메라 · 투어: setWalkMode 가 main.js onWalkChange 처럼 syncWalk 를 부르고, startGuide 는 main.js startScenario 처럼 보행을 끈다
function setup() {
  const s = { walk: false, suspended: false, guide: false };
  const log = [];
  const changes = [];
  let ctl = null;
  const camCtrl = {
    isWalkMode: () => s.walk,
    setWalkMode(on) {
      s.walk = Boolean(on);
      log.push(`walk:${s.walk}`);
      ctl.syncWalk(s.walk);
    },
  };
  ctl = createModeController({
    camCtrl,
    startGuide: () => {
      log.push('startGuide');
      if (s.walk) camCtrl.setWalkMode(false);
      s.guide = true;
    },
    endGuide: () => {
      if (s.guide) log.push('endGuide');
      s.guide = false;
    },
    isSuspended: () => s.suspended,
    onChange: (m) => changes.push(m),
  });
  return { ctl, camCtrl, s, log, changes };
}

test('(a) 처음은 null · MODE_IDS 밖의 값은 무시', () => {
  const { ctl, changes } = setup();
  assert.deepEqual(MODE_IDS, ['guide', 'walk', 'free']);
  assert.equal(ctl.get(), null);
  assert.equal(ctl.set('tour'), null);
  assert.deepEqual(changes, []);
});

test('(b) 직접 걷기 → 그 자리에서 보행, 자유 시점 → 보행 끄기', () => {
  const { ctl, s, log, changes } = setup();
  assert.equal(ctl.set('walk'), 'walk');
  assert.equal(s.walk, true);
  assert.equal(ctl.set('walk'), 'walk');
  assert.deepEqual(log, ['walk:true'], '이미 걷는 중이면 다시 켜지 않는다');
  assert.equal(ctl.set('free'), 'free');
  assert.equal(s.walk, false);
  assert.deepEqual(changes, ['walk', 'free']);
});

test('(c) 가이드 투어: 방식을 먼저 바꾸고 투어 시작(보행을 꺼도 자유 시점을 거치지 않음) · 다시 누르면 건물 선택을 다시 연다 · 다른 방식은 투어를 끝낸다', () => {
  const { ctl, s, log, changes } = setup();
  ctl.set('walk');
  ctl.set('guide');
  assert.equal(ctl.get(), 'guide');
  assert.equal(s.walk, false);
  assert.deepEqual(changes, ['walk', 'guide']);
  ctl.set('guide');
  assert.equal(log.filter((x) => x === 'startGuide').length, 2);
  ctl.set('free');
  assert.ok(log.includes('endGuide'));
  assert.equal(s.guide, false);
  assert.equal(ctl.get(), 'free');
  ctl.set('guide');
  ctl.set('walk');
  assert.equal(s.guide, false, '투어 중 직접 걷기 → 투어를 끝내고');
  assert.equal(s.walk, true);
  assert.equal(ctl.get(), 'walk');
});

test('(d) syncWalk: V 로 켜면 직접 걷기, 끄면 자유 시점, 가이드 투어가 보행을 끄는 것은 그대로', () => {
  const { ctl, camCtrl, changes } = setup();
  ctl.set('free');
  camCtrl.setWalkMode(true);
  assert.equal(ctl.get(), 'walk');
  camCtrl.setWalkMode(false);
  assert.equal(ctl.get(), 'free');
  ctl.set('guide');
  ctl.syncWalk(false);
  assert.equal(ctl.get(), 'guide');
  camCtrl.setWalkMode(true);
  assert.equal(ctl.get(), 'walk', '가이드 투어 중 V → 직접 걷기');
  assert.deepEqual(changes, ['free', 'walk', 'free', 'guide', 'walk']);
});

test('(e) 실내(isSuspended) 동안 syncWalk 는 무시, 나온 뒤 refresh 로 보행 여부 · 이전 방식에 맞춘다', () => {
  const { ctl, camCtrl, s } = setup();
  ctl.set('walk');
  s.suspended = true;
  camCtrl.setWalkMode(false);
  camCtrl.setWalkMode(true);
  camCtrl.setWalkMode(false);
  assert.equal(ctl.get(), 'walk', '실내 동안은 바꾸지 않는다');
  s.suspended = false;
  ctl.refresh();
  assert.equal(ctl.get(), 'free', '직접 걷기로 들어가 보행 꺼진 채 나오면 자유 시점');

  ctl.set('guide');
  s.suspended = true;
  camCtrl.setWalkMode(true);
  s.suspended = false;
  ctl.refresh();
  assert.equal(ctl.get(), 'walk', '걸으며 나오면 직접 걷기');

  ctl.set('guide');
  s.suspended = true;
  camCtrl.setWalkMode(true);
  camCtrl.setWalkMode(false);
  s.suspended = false;
  ctl.refresh();
  assert.equal(ctl.get(), 'guide', '보행 꺼진 채 나오면 이전 방식(가이드 투어)');
});

test('(f) renderMode: body[data-mode] · #nw-mode-seg 버튼 is-active · aria-pressed, document 없으면 아무것도 안 함', () => {
  const btn = (mode) => {
    const cls = new Set();
    const attrs = {};
    return {
      dataset: { mode },
      attrs,
      classList: { toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)), contains: (c) => cls.has(c) },
      setAttribute: (k, v) => {
        attrs[k] = v;
      },
    };
  };
  const btns = MODE_IDS.map(btn);
  let selector = null;
  const doc = {
    body: { dataset: {} },
    querySelectorAll: (sel) => {
      selector = sel;
      return btns;
    },
  };
  renderMode('walk', doc);
  assert.equal(doc.body.dataset.mode, 'walk');
  assert.equal(selector, '#nw-mode-seg [data-mode]');
  assert.deepEqual(btns.map((b) => b.classList.contains('is-active')), [false, true, false]);
  assert.deepEqual(btns.map((b) => b.attrs['aria-pressed']), ['false', 'true', 'false']);
  renderMode(null, doc);
  assert.equal('mode' in doc.body.dataset, false);
  assert.doesNotThrow(() => renderMode('free'));
});

const readPub = (p) => readFileSync(new URL(`../public/${p}`, import.meta.url), 'utf8');

test('(g) 세 페이지: 상단 방식 전환(#nw-mode-seg)이 MODES 순서 · 이름이고, 옛 버튼(투어 시작 · 건물 이동 · 보행 시점)은 없다', () => {
  for (const name of ['index.html', 'nowhere.html', 'nowhere-mountain.html']) {
    const html = readPub(name);
    const seg = html.match(/<div id="nw-mode-seg"[\s\S]*?<\/div>/)?.[0];
    assert.ok(seg, `${name}: #nw-mode-seg 없음`);
    const btns = [...seg.matchAll(/data-mode="(\w+)"[^>]*>([^<]+)/g)].map((m) => [m[1], m[2].trim()]);
    assert.deepEqual(btns, MODES.map((m) => [m.id, m.label]), name);
    for (const id of ['nw-btn-intro', 'nw-btn-buildings', 'nw-btn-walk']) assert.equal(html.includes(id), false, `${name}: ${id} 가 남아 있음`);
    assert.doesNotMatch(html, /투어 시작|건물 이동/, name);
  }
});

test('(h) main.js · CSS: 방식 연결(보행 동기화 · 실내 · 가이드 투어 · 월드 전환 주소), 카메라 프리셋은 자유 시점에서만, 실내에서는 방식 전환 숨김', () => {
  const main = readPub('src/nowhere/main.js');
  assert.match(main, /createModeController\(/);
  assert.match(main, /showModeMenu\(/);
  assert.match(main, /modes\?\.syncWalk\(active\)/);
  assert.match(main, /modes\?\.refresh\(\)/);
  assert.match(main, /startGuide: \(\) => startScenario\('chooseBuilding'\)/);
  assert.match(main, /nextParams\.set\('mode', /);
  assert.match(main, /nextParams\.delete\('cam'\)/);
  // 월드 전환은 새 월드의 인트로를 보여 준 뒤 지금 방식으로 이어 간다 — 인트로를 막는 값(noIntro · weather · time)을 넘기지 않는다
  assert.doesNotMatch(main, /nextParams\.set\('noIntro'/);
  for (const k of ['noIntro', 'weather', 'time']) assert.match(main, new RegExp(`nextParams\\.delete\\('${k}'\\)`), `월드 전환이 ${k} 를 지우지 않음`);
  assert.doesNotMatch(main, /nw-btn-(intro|buildings|walk)/);
  const css = readPub('src/nowhere/nowhere.css');
  assert.match(css, /body\[data-mode="guide"\] \.nw-dock-camera/);
  assert.match(css, /body\[data-mode="walk"\] \.nw-dock-camera/);
  assert.match(css, /body\.is-interior \.nw-mode-seg/);
  assert.doesNotMatch(css, /#nw-btn-(intro|buildings)/);
});
