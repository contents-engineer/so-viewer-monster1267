import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createCinema, INTRO_TITLES, SKIP_LABEL, CINEMA_TITLE_IN_MS, CINEMA_TITLE_OUT_MS, CINEMA_OUT_MS,
} from '../public/src/nowhere/cinema.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

// 아주 작은 가짜 DOM: className · classList · style · append · 이벤트
function fakeDom() {
  const make = (tag) => {
    const cls = new Set();
    const listeners = {};
    const node = {
      tagName: tag.toUpperCase(),
      hidden: false,
      textContent: '',
      type: '',
      style: {},
      children: [],
      attrs: {},
      offsetWidth: 0,
      set className(v) {
        cls.clear();
        String(v).split(/\s+/).filter(Boolean).forEach((c) => cls.add(c));
      },
      get className() {
        return [...cls].join(' ');
      },
      append(...c) {
        node.children.push(...c);
      },
      setAttribute(k, v) {
        node.attrs[k] = String(v);
      },
      addEventListener(type, fn) {
        (listeners[type] ||= []).push(fn);
      },
      dispatch(type) {
        (listeners[type] || []).forEach((fn) => fn({ type }));
      },
      classList: {
        add: (...c) => c.forEach((x) => cls.add(x)),
        remove: (...c) => c.forEach((x) => cls.delete(x)),
        toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)),
        contains: (c) => cls.has(c),
      },
    };
    return node;
  };
  return { createElement: make, body: make('body') };
}
const find = (node, cls) => {
  if (node.classList?.contains(cls)) return node;
  for (const c of node.children || []) {
    const f = find(c, cls);
    if (f) return f;
  }
  return null;
};

test('(a) 문구 · 시간: 성수 좌표 · 산악 브랜드 문구, 제목 1.0 s → 5.0 s, 띠 빠짐 0.5 s', () => {
  assert.deepEqual(INTRO_TITLES.seongsu, { kicker: '37.544°N 127.056°E', title: 'HAUS NOWHERE — 성수 2041' });
  assert.deepEqual(INTRO_TITLES.ds2, { kicker: 'HIGHLAND BASIN · DS2 MOUNTAIN WORLD', title: 'HAUS NOWHERE — DS2 산악 고원' });
  assert.equal(SKIP_LABEL, '건너뛰기 ›');
  assert.equal(CINEMA_TITLE_IN_MS, 1000);
  assert.equal(CINEMA_TITLE_OUT_MS, 5000);
  assert.equal(CINEMA_OUT_MS, 500);
});

test('(b) start → 자막 시각 → 진행 선 → 건너뛰기 → end(띠가 빠진 뒤 숨김)', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const dom = fakeDom();
  globalThis.document = dom;
  try {
    const c = createCinema();
    const root = c.element;
    assert.equal(dom.body.children.length, 1);
    assert.equal(dom.body.children[0], root);
    assert.equal(root.className, 'nw-cinema');
    assert.equal(root.hidden, true);
    const skip = find(root, 'nw-cinema-skip');
    assert.equal(skip.textContent, '건너뛰기 ›');
    assert.equal(skip.type, 'button');
    assert.ok(find(find(root, 'nw-cinema-bar-bottom'), 'nw-cinema-progress'), '진행 선은 아래 띠 안');

    let skipped = 0;
    c.start({ ...INTRO_TITLES.seongsu, onSkip: () => skipped++ });
    assert.equal(c.isActive(), true);
    assert.equal(root.hidden, false);
    assert.ok(root.classList.contains('is-on'));
    assert.ok(dom.body.classList.contains('is-cinema'));
    assert.equal(find(root, 'nw-cinema-kicker').textContent, '37.544°N 127.056°E');
    assert.equal(find(root, 'nw-cinema-heading').textContent, 'HAUS NOWHERE — 성수 2041');

    const title = () => root.classList.contains('is-title');
    t.mock.timers.tick(999);
    assert.equal(title(), false);
    t.mock.timers.tick(1);
    assert.equal(title(), true, '1.0 s 에 나타남');
    t.mock.timers.tick(3999);
    assert.equal(title(), true);
    t.mock.timers.tick(1);
    assert.equal(title(), false, '5.0 s 에 사라짐');

    const fill = find(root, 'nw-cinema-progress-fill');
    assert.equal(fill.style.transform, 'scaleX(0.000)');
    c.progress(0.5);
    assert.equal(fill.style.transform, 'scaleX(0.500)');
    c.progress(1.7);
    assert.equal(fill.style.transform, 'scaleX(1.000)', '1 을 넘지 않는다');

    skip.dispatch('click');
    assert.equal(skipped, 1);

    let done = false;
    const p = c.end().then(() => {
      done = true;
    });
    assert.equal(c.isActive(), false);
    assert.equal(root.classList.contains('is-on'), false);
    assert.ok(root.classList.contains('is-out'));
    assert.equal(dom.body.classList.contains('is-cinema'), false, 'HUD 는 띠가 빠지기 시작할 때 돌아온다');
    skip.dispatch('click');
    assert.equal(skipped, 1, '끝난 뒤 건너뛰기는 무시');
    t.mock.timers.tick(CINEMA_OUT_MS - 1);
    await Promise.resolve();
    assert.equal(done, false);
    t.mock.timers.tick(1);
    await p;
    assert.equal(done, true);
    assert.equal(root.hidden, true);
    assert.equal(root.classList.contains('is-out'), false);
  } finally {
    delete globalThis.document;
  }
});

test('(c) end 를 기다리는 중 다시 start 하면 앞선 end 는 바로 끝나고 새 연출은 숨기지 않는다 · 시작 전 end 는 바로 끝', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const dom = fakeDom();
  globalThis.document = dom;
  try {
    const c = createCinema();
    await c.end();
    c.start({ kicker: 'a', title: 'b' });
    let ended = false;
    c.end().then(() => {
      ended = true;
    });
    c.start({ ...INTRO_TITLES.ds2 });
    await Promise.resolve();
    assert.equal(ended, true);
    t.mock.timers.tick(CINEMA_OUT_MS);
    assert.equal(c.element.hidden, false);
    assert.equal(c.isActive(), true);
    assert.ok(dom.body.classList.contains('is-cinema'));
    assert.equal(find(c.element, 'nw-cinema-heading').textContent, 'HAUS NOWHERE — DS2 산악 고원');
  } finally {
    delete globalThis.document;
  }
});

test('(d) camera.js 는 skipIntro · getIntroProgress 를 내보내고, main.js 는 연출 · 건너뛰기 · 진행 선 · Esc 를 잇는다', () => {
  const cam = read('../public/src/nowhere/camera.js');
  assert.match(cam, /function skipIntro\(\)/);
  assert.match(cam, /function getIntroProgress\(\)/);
  const ret = cam.slice(cam.lastIndexOf('return {'));
  assert.match(ret, /\bskipIntro,/);
  assert.match(ret, /\bgetIntroProgress,/);
  const main = read('../public/src/nowhere/main.js');
  assert.match(main, /createCinema\(\)/);
  assert.match(main, /onSkip: \(\) => camCtrl\.skipIntro\(\)/);
  assert.match(main, /cinema\.progress\(camCtrl\.getIntroProgress\(\)\)/);
  assert.match(main, /if \(camCtrl\.isIntroActive\(\)\) \{[\s\S]{0,200}camCtrl\.skipIntro\(\);/, 'Esc 는 인트로를 건너뛴다');
});

test('(e) CSS: 띠 높이 max(48px, 11vh) · 연출 중 HUD(상단 바 · 하단 독 · 보행 안내 · 스팟 · 성능 표시) 숨김', () => {
  const css = read('../public/src/nowhere/nowhere.css');
  assert.match(css, /\.nw-cinema \{[^}]*--nw-cine-bar: max\(48px, 11vh\)/);
  for (const sel of ['.nw-topbar', '.nw-dock', '.nw-walk-hud', '.nw-spots', '.nw-perf']) {
    assert.ok(css.includes(`body.is-cinema ${sel}`), `연출 중 ${sel} 를 숨기지 않음`);
  }
});
