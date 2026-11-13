import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  KIOSK_SHOT_S, KIOSK_SHOT_MIN_S, KIOSK_SHOT_MAX_S, KIOSK_STOPPED_MS, KIOSK_CHIP_GAP_PX, KIOSK_TEXT, KIOSK_PARAMS,
  parseKioskParams, kioskFloorOrder, nextKioskStep, kioskSwitchUrl, kioskStopUrl, kioskKeyAction, kioskChipBottom, createKiosk,
} from '../public/src/nowhere/kiosk.js';
import { resolveEntry } from '../public/src/nowhere/entry.js';
import { CONTROL_SECTIONS } from '../public/src/nowhere/help.js';

// 발표 모드(kiosk.js): 주소 값 · 층 순서 · 순서 상태 기계 · 반대 월드 주소 · 멈춘 뒤 주소 · K 키 · 칩 자리 · 실행기(순서 · 아무 입력 멈춤) · main 연결 · CSS · 안내 · README
const PUB = new URL('../public/', import.meta.url);
const readSrc = (f) => readFileSync(new URL(`src/nowhere/${f}`, PUB), 'utf8');
const P = (s) => new URLSearchParams(s);

const INNER = {
  defaultFloor: '1',
  floors: [{ id: 'b1' }, { id: '1' }, { id: '12' }, { id: '13' }],
};

test('(a) 상수 한곳: 한 컷 10 초 · 시험용 kioskShot 1–60 초 · 멈춤 알림 2 초 · 칩 문구 그대로 · 주소에서 지우는 값', () => {
  assert.equal(KIOSK_SHOT_S, 10);
  assert.equal(KIOSK_SHOT_MIN_S, 1);
  assert.equal(KIOSK_SHOT_MAX_S, 60);
  assert.equal(KIOSK_STOPPED_MS, 2000);
  assert.equal(KIOSK_CHIP_GAP_PX, 8);
  assert.equal(KIOSK_TEXT.running, '발표 모드 · 아무 키나 누르면 멈춥니다');
  assert.equal(KIOSK_TEXT.stopped, '발표 모드를 멈췄습니다');
  assert.deepEqual(KIOSK_PARAMS, ['kiosk', 'kioskShot']);
});

test('(b) parseKioskParams: kiosk=1 만 켜짐, kioskShot 은 1–60 정수(초)만 — 그 밖은 기본 10 초', () => {
  assert.deepEqual(parseKioskParams(P('kiosk=1')), { on: true, shotS: 10 });
  assert.deepEqual(parseKioskParams(P('kiosk=1&kioskShot=2')), { on: true, shotS: 2 });
  assert.deepEqual(parseKioskParams(P('kioskShot=60')), { on: false, shotS: 60 }, 'K 로 시작할 때도 시험용 컷 길이');
  assert.equal(parseKioskParams(P('kioskShot=1')).shotS, 1);
  for (const v of ['0', '61', '2.5', '02', '-3', ' 5', '1e1', 'abc', '']) {
    assert.equal(parseKioskParams(P(`kiosk=1&kioskShot=${encodeURIComponent(v)}`)).shotS, 10, `kioskShot=${v}`);
  }
  for (const v of ['0', 'true', 'yes', '', '2']) assert.equal(parseKioskParams(P(`kiosk=${v}`)).on, false, `kiosk=${v}`);
  assert.deepEqual(parseKioskParams(null), { on: false, shotS: 10 });
});

test('(c) kioskFloorOrder: 기본 층(inner-layout defaultFloor)부터, 나머지는 floors 순서 그대로 — 실내에서 시작하면 지금 층부터', () => {
  assert.deepEqual(kioskFloorOrder(INNER), ['1', 'b1', '12', '13']);
  assert.deepEqual(kioskFloorOrder(INNER, null), ['1', 'b1', '12', '13']);
  assert.deepEqual(kioskFloorOrder(INNER, '13'), ['13', 'b1', '1', '12']);
  assert.deepEqual(kioskFloorOrder(INNER, 'zz'), ['1', 'b1', '12', '13'], '없는 층이면 기본 층부터');
  assert.deepEqual(kioskFloorOrder({ floors: [{ id: 'a' }, { id: 'b' }] }), ['a', 'b'], '기본 층이 없으면 첫 층부터');
  assert.deepEqual(kioskFloorOrder(null), []);
  assert.deepEqual(kioskFloorOrder({ floors: [] }), []);
  // 실제 inner-layout 값
  const real = JSON.parse(readFileSync(new URL('assets/nowhere-inner/inner-layout.json', PUB), 'utf8'));
  assert.deepEqual(kioskFloorOrder(real), ['1', 'b1', '12', '13']);
});

/** 시작부터 끝까지 순서(결과는 모두 done) */
function walk(plan, results = {}) {
  const seq = [];
  let step = nextKioskStep(null, null, plan);
  while (step) {
    seq.push(step.kind === 'preset' || step.kind === 'floor' ? `${step.kind}:${step.id}` : step.kind);
    if (seq.length > 50) throw new Error('끝나지 않음');
    step = nextKioskStep(step, results[seq.at(-1)] || 'done', plan);
  }
  return seq;
}

test('(d) 순서 상태 기계(밖에서 시작): 프리셋 layout 순서 → 실내 들어가기 → 층마다 둘러보기 → 밖으로 → 반대 월드 → 끝', () => {
  const plan = { presets: ['street', 'aerial', 'night'], floors: ['1', 'b1', '12', '13'], inside: false };
  assert.deepEqual(walk(plan), ['preset:street', 'preset:aerial', 'preset:night', 'enter', 'floor:1', 'floor:b1', 'floor:12', 'floor:13', 'exit', 'switch']);
  // 단계 모양: 프리셋 · 층은 순번 i 와 id
  assert.deepEqual(nextKioskStep(null, null, plan), { kind: 'preset', i: 0, id: 'street' });
  assert.deepEqual(nextKioskStep({ kind: 'preset', i: 0, id: 'street' }, 'done', plan), { kind: 'preset', i: 1, id: 'aerial' });
  assert.deepEqual(nextKioskStep({ kind: 'enter' }, 'done', plan), { kind: 'floor', i: 0, id: '1' });
  assert.deepEqual(nextKioskStep({ kind: 'floor', i: 3, id: '13' }, 'done', plan), { kind: 'exit' });
  assert.deepEqual(nextKioskStep({ kind: 'exit' }, 'done', plan), { kind: 'switch' });
  assert.equal(nextKioskStep({ kind: 'switch' }, 'done', plan), null);
  // 실제 두 월드 layout 프리셋 7 개 그대로
  for (const dir of ['nowhere', 'nowhere-ds2']) {
    const layout = JSON.parse(readFileSync(new URL(`assets/${dir}/layout.json`, PUB), 'utf8'));
    const ids = layout.cameras.map((c) => c.id);
    const seq = walk({ presets: ids, floors: ['1', 'b1', '12', '13'], inside: false });
    assert.deepEqual(seq.slice(0, 7), ids.map((id) => `preset:${id}`), dir);
    assert.equal(seq.length, 7 + 1 + 4 + 2);
  }
});

test('(e) 순서 상태 기계: 멈추면(stopped) 어느 단계든 끝, 실내를 못 열면 반대 월드로, 층을 못 열면 밖으로, 층 목록이 없으면 실내를 건너뜀, 실내에서 시작하면 지금 층부터', () => {
  const plan = { presets: ['street', 'aerial'], floors: ['1', 'b1'], inside: false };
  for (const step of [null, { kind: 'preset', i: 0, id: 'street' }, { kind: 'enter' }, { kind: 'floor', i: 0, id: '1' }, { kind: 'exit' }, { kind: 'switch' }]) {
    if (step) assert.equal(nextKioskStep(step, 'stopped', plan), null, `${step.kind} stopped`);
  }
  assert.deepEqual(walk(plan, { enter: 'failed' }), ['preset:street', 'preset:aerial', 'enter', 'switch']);
  assert.deepEqual(walk(plan, { 'floor:1': 'failed' }), ['preset:street', 'preset:aerial', 'enter', 'floor:1', 'exit', 'switch']);
  assert.deepEqual(walk({ ...plan, floors: [] }), ['preset:street', 'preset:aerial', 'switch'], 'inner-layout 을 못 받으면 실내 없이');
  assert.deepEqual(walk({ ...plan, presets: [] }), ['enter', 'floor:1', 'floor:b1', 'exit', 'switch']);
  assert.deepEqual(walk({ ...plan, inside: true }), ['floor:1', 'floor:b1', 'exit', 'switch'], '실내에서 K — 층 둘러보기부터');
  assert.deepEqual(walk({ ...plan, inside: true, floors: [] }), ['exit', 'switch']);
});

test('(f) kioskSwitchUrl: 위 막대 월드 버튼과 같은 주소(worldSwitchUrl — 경로 규칙 · 지울 값) + mode=free + kiosk=1, 시험용 kioskShot 은 그대로 — 새 페이지는 인트로 → 자유 시점', () => {
  const a = kioskSwitchUrl({ pathname: '/nowhere', search: '?kiosk=1&kioskShot=2&tier=mobile', targetVer: 'ds2' });
  const [pa, qa] = a.split('?');
  assert.equal(pa, '/nowhere');
  const sa = P(qa);
  assert.equal(sa.get('ver'), 'ds2');
  assert.equal(sa.get('mode'), 'free');
  assert.equal(sa.get('kiosk'), '1');
  assert.equal(sa.get('kioskShot'), '2');
  assert.equal(sa.get('tier'), 'mobile');
  // 산악 페이지 → 성수는 /nowhere, 인트로를 막는 값 · 같은 자리 · 화각은 지운다
  const b = kioskSwitchUrl({ pathname: '/nowhere-mountain.html', search: '?ver=ds2&noIntro=1&cam=lot&weather=snow&time=21&at=1,2,3&look=4,5,6&fov=30&mode=walk', targetVer: 'seongsu' });
  assert.equal(b.split('?')[0], '/nowhere');
  const sb = P(b.split('?')[1]);
  for (const k of ['noIntro', 'cam', 'weather', 'time', 'at', 'look', 'fov']) assert.equal(sb.has(k), false, k);
  assert.equal(sb.get('mode'), 'free');
  assert.equal(sb.get('kiosk'), '1');
  // K 로 시작한 페이지(주소에 kiosk 없음)도 다음 월드는 kiosk=1
  const c = kioskSwitchUrl({ pathname: '/', search: '', targetVer: 'ds2' });
  assert.equal(c, '/?ver=ds2&mode=free&kiosk=1');
  assert.equal(P(c.split('?')[1]).getAll('kiosk').length, 1);
  // 새 페이지: 선택 화면 · 방식 고르기 없이 인트로 → 자유 시점, 발표 켜짐
  assert.deepEqual(resolveEntry(P(c.split('?')[1]), null), { select: false, world: 'ds2', intro: true, mode: 'free' });
  assert.deepEqual(resolveEntry(P(b.split('?')[1]), 'ds2'), { select: false, world: 'seongsu', intro: true, mode: 'free' });
  assert.equal(parseKioskParams(P(a.split('?')[1])).on, true);
  assert.equal(parseKioskParams(P(a.split('?')[1])).shotS, 2);
});

test('(g) resolveEntry: ?kiosk=1 은 인트로 뒤 방식 고르기 없이 자유 시점(월드가 없으면 선택 화면 없이 성수) — kiosk 가 아니면 지금 그대로', () => {
  assert.deepEqual(resolveEntry(P('kiosk=1'), 'seongsu'), { select: false, world: 'seongsu', intro: true, mode: 'free' });
  assert.deepEqual(resolveEntry(P('kiosk=1'), 'ds2'), { select: false, world: 'ds2', intro: true, mode: 'free' });
  assert.deepEqual(resolveEntry(P('kiosk=1'), null), { select: false, world: 'seongsu', intro: true, mode: 'free' }, '/ 도 선택 화면 없이');
  assert.deepEqual(resolveEntry(P('kiosk=1&mode=walk'), 'seongsu'), { select: false, world: 'seongsu', intro: true, mode: 'free' }, '발표는 자유 시점');
  assert.deepEqual(resolveEntry(P('kiosk=1&noIntro=1'), 'seongsu'), { select: false, world: 'seongsu', intro: false, mode: 'free' });
  assert.deepEqual(resolveEntry(P('kiosk=0'), 'seongsu'), { select: false, world: 'seongsu', intro: true, mode: null });
  assert.deepEqual(resolveEntry(P('kiosk=0'), null).select, true);
});

test('(h) kioskStopUrl: 멈추면 주소에서 kiosk · kioskShot 만 지운다(다른 값 · # 그대로, 남는 값이 없으면 경로만)', () => {
  assert.equal(kioskStopUrl({ pathname: '/nowhere', search: '?ver=ds2&mode=free&kiosk=1&kioskShot=2', hash: '' }), '/nowhere?ver=ds2&mode=free');
  assert.equal(kioskStopUrl({ pathname: '/nowhere', search: '?kiosk=1', hash: '#x' }), '/nowhere#x');
  assert.equal(kioskStopUrl({ pathname: '/', search: '', hash: '' }), '/');
  assert.equal(kioskStopUrl({ pathname: '/nowhere-mountain', search: '?tier=mobile', hash: '' }), '/nowhere-mountain?tier=mobile');
});

test('(i) K 키(kioskKeyAction): 멈춰 있으면 K · k · 한글 입력 상태(KeyK)로 시작 — ⌘ · Ctrl · Alt · 입력 칸 · 반복 · 막힘 · 앞 처리기가 받은 키는 그대로. 도는 중에는 아무 키나 멈춤(⌘ · Ctrl 조합 · 보조 키만은 그대로, 누르고 있던 키의 반복은 삼킴)', () => {
  const k = (o) => kioskKeyAction({ running: false, blocked: false, ...o });
  assert.equal(k({ key: 'k', code: 'KeyK' }), 'start');
  assert.equal(k({ key: 'K', code: 'KeyK' }), 'start');
  assert.equal(k({ key: 'ㅏ', code: 'KeyK' }), 'start', '한글 입력 상태');
  assert.equal(k({ key: 't', code: 'KeyK' }), null, '드보락 KeyK = t');
  assert.equal(k({ key: 'k', code: 'KeyV' }), 'start', '드보락 k');
  for (const mod of ['metaKey', 'ctrlKey', 'altKey', 'typing', 'repeat', 'blocked', 'defaultPrevented']) {
    assert.equal(k({ key: 'k', code: 'KeyK', [mod]: true }), null, mod);
  }
  for (const key of ['l', 'h', 'c', 'v', 'Escape', ' ']) assert.equal(k({ key, code: '' }), null, key);
  const r = (o) => kioskKeyAction({ running: true, blocked: false, ...o });
  for (const [key, code] of [['k', 'KeyK'], ['w', 'KeyW'], ['Escape', 'Escape'], [' ', 'Space'], ['ArrowUp', 'ArrowUp'], ['?', 'Slash'], ['ㅏ', 'KeyK'], ['Process', 'KeyK']]) {
    assert.equal(r({ key, code }), 'stop', key);
  }
  assert.equal(r({ key: '?', code: 'Slash', shiftKey: true }), 'stop', 'Shift + ? 는 ? 가 멈춘다(삼켜져 조작 안내는 열리지 않음)');
  for (const [key, code] of [['Shift', 'ShiftLeft'], ['Alt', 'AltLeft'], ['CapsLock', 'CapsLock']]) {
    assert.equal(r({ key, code }), 'swallow', `보조 키만(${key})은 멈추지 않고 뒤로도 보내지 않는다(실내 둘러보기가 끊기지 않게) — 조합의 다음 키가 멈춘다`);
  }
  assert.equal(r({ key: 'k', code: 'KeyK', altKey: true }), 'stop');
  assert.equal(r({ key: 'k', code: 'KeyK', typing: true }), 'stop');
  assert.equal(r({ key: 'r', code: 'KeyR', metaKey: true }), null, '⌘R · ⌘Tab 등은 멈추지 않는다');
  assert.equal(r({ key: 'Meta', code: 'MetaLeft', metaKey: true }), null);
  assert.equal(r({ key: 'c', code: 'KeyC', ctrlKey: true }), null);
  assert.equal(r({ key: 'k', code: 'KeyK', repeat: true }), 'swallow', 'K 를 누른 채면 바로 멈추지 않는다');
});

test('(j) 칩 자리(kioskChipBottom): 독 · 실내 자막과 겹치지 않는 가장 낮은 자리 — 먼저 독 줄 아래 끝(넓은 화면은 두 묶음 사이), 겹치면 그 상자 위 + 8 px', () => {
  const g = (left, top, right, bottom) => ({ left, top, right, bottom });
  const at = (o) => kioskChipBottom({ chipW: 300, chipH: 30, ...o });
  // 1600 × 900(잰 값): 기상 22–343, 카메라 1099–1578 — 가운데 650–950 은 빈 자리 → 독 줄 아래 끝(18)
  assert.equal(at({ viewW: 1600, viewH: 900, boxes: [g(22, 759, 343, 882), g(1099, 815, 1578, 882)] }), 18);
  // 1024 × 768: 카메라 523–1002 가 가운데에 걸림 → 그 위
  assert.equal(at({ viewW: 1024, viewH: 768, boxes: [g(22, 627, 343, 750), g(523, 683, 1002, 750)] }), 768 - 683 + 8);
  // 휴대폰 390 × 844: 두 묶음 모두 전체 폭 → 위쪽 묶음 위(아래 묶음 바로 위는 위쪽 묶음과 겹침), 독 아래 끝 8
  assert.equal(at({ viewW: 390, viewH: 844, chipW: 222, base: 8, boxes: [g(8, 634, 382, 743), g(8, 749, 382, 836)] }), 844 - 634 + 8);
  // 실내(카메라 묶음 숨김 = 크기 0): 데스크톱은 자막(아래 120 px)과 떨어진 독 줄 아래 끝
  assert.equal(at({ viewW: 1024, viewH: 768, boxes: [g(22, 627, 343, 750), g(0, 0, 0, 0), g(152, 605, 872, 648)] }), 18);
  // 휴대폰 실내(잰 값): 기상 묶음 위는 둘러보기 자막(630–694)과 겹침 → 자막 위
  assert.equal(at({ viewW: 390, viewH: 844, chipW: 222, base: 8, boxes: [g(8, 728, 382, 836), g(0, 0, 0, 0), g(98, 630, 293, 694)] }), 844 - 630 + 8);
  // 자막이 숨으면 다시 기상 묶음 위
  assert.equal(at({ viewW: 390, viewH: 844, chipW: 222, base: 8, boxes: [g(8, 728, 382, 836), g(0, 0, 0, 0)] }), 844 - 728 + 8);
  // 겹침은 8 px 여유로 본다(칩 400–600)
  assert.equal(at({ viewW: 1000, viewH: 800, chipW: 200, boxes: [g(10, 700, 396, 780)] }), 800 - 700 + 8, '칩 왼쪽 400 에서 4 px');
  assert.equal(at({ viewW: 1000, viewH: 800, chipW: 200, boxes: [g(10, 700, 390, 780)] }), 18);
  assert.equal(at({ viewW: 1000, viewH: 800, boxes: [] }), 18, '상자가 없으면 18 px');
});

// ── 실행기: 작은 가짜 문서 · 창(만든 노드 · 등록 순서대로 부르는 처리기) ──
function fakeDom() {
  const node = (tag) => {
    const cls = new Set();
    const props = {};
    return {
      tag,
      id: '',
      hidden: false,
      textContent: '',
      children: [],
      attrs: {},
      style: { setProperty(k, v) { props[k] = v; }, props },
      get className() { return [...cls].join(' '); },
      set className(v) { cls.clear(); String(v).split(/\s+/).filter(Boolean).forEach((c) => cls.add(c)); },
      classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c), toggle: (c, on) => ((on ?? !cls.has(c)) ? cls.add(c) : cls.delete(c)) },
      append(...c) { this.children.push(...c); },
      setAttribute(k, v) { this.attrs[k] = String(v); },
      getBoundingClientRect: () => ({ width: 300, height: 30 }),
    };
  };
  const body = node('body');
  return { node, document: { createElement: node, body, querySelectorAll: () => [] } };
}

function fakeWindow() {
  const list = [];
  return {
    innerWidth: 1600,
    innerHeight: 900,
    list,
    addEventListener(type, fn, opts) { list.push({ type, fn, capture: opts === true || Boolean(opts?.capture), passive: Boolean(opts?.passive) }); },
    /** 등록 순서대로 — stopImmediatePropagation 이면 뒤 처리기는 받지 않는다. 받은 처리기 수 · 막힘 여부를 돌려준다 */
    dispatch(type, init = {}) {
      const ev = {
        type, key: '', code: '', repeat: false, metaKey: false, ctrlKey: false, altKey: false, target: null, cancelable: true, ...init,
        defaultPrevented: false, stopped: false,
        preventDefault() { this.defaultPrevented = true; },
        stopImmediatePropagation() { this.stopped = true; },
      };
      let reached = 0;
      for (const l of list.filter((x) => x.type === type)) {
        if (ev.stopped) break;
        l.fn(ev);
        reached += 1;
      }
      return ev;
    },
  };
}

const flush = () => new Promise((r) => setImmediate(r));

/** 가짜 앱 — 부른 것을 차례로 적는다. 실내 동작은 약속(test 가 풀어 줄 수 있게 hold) */
function fakeApp({ inside = false, floor = null, blocked = false } = {}) {
  const log = [];
  const app = {
    log,
    inside,
    floor,
    blocked,
    hold: {},   // 이름 → resolve(값) — 있으면 그 동작은 test 가 풀 때까지 기다린다
    url: { pathname: '/nowhere', search: '?kiosk=1&kioskShot=2&tier=mobile', hash: '' },
    replaced: [],
    tourStopped: 0,
  };
  const later = (name, value) => new Promise((resolve) => {
    app.hold[name] = () => resolve(value);
    if (!app.holding?.includes(name)) app.hold[name]();
  });
  app.holding = [];
  app.opts = {
    shotS: 2,
    getPresets: () => ['street', 'aerial'],
    loadFloors: async (first) => {
      log.push(`floors:${first}`);
      return kioskFloorOrder({ defaultFloor: '1', floors: [{ id: 'b1' }, { id: '1' }] }, first);
    },
    isInside: () => app.inside,
    currentFloor: () => app.floor,
    showPreset: (id) => log.push(`preset:${id}`),
    enter: () => {
      log.push('enter');
      return later('enter', true).then((ok) => {
        app.inside = true;
        app.floor = '1';
        return ok;
      });
    },
    goToFloor: (id) => {
      log.push(`go:${id}`);
      return later('go', true).then((ok) => {
        app.floor = id;
        return ok;
      });
    },
    playTour: () => {
      log.push(`tour:${app.floor}`);
      return later('tour', 'done');
    },
    exit: () => {
      log.push('exit');
      return later('exit', undefined).then(() => {
        app.inside = false;
        app.floor = null;
      });
    },
    switchWorld: () => log.push('switch'),
    isBlocked: () => app.blocked,
    onStart: () => log.push('onStart'),
    onStop: () => log.push('onStop'),
    onSettle: () => log.push('onSettle'),
    replaceUrl: (u) => app.replaced.push(u),
    location: app.url,
  };
  return app;
}

function setup(t, appOpts) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const dom = fakeDom();
  globalThis.document = dom.document;
  const win = fakeWindow();
  const app = fakeApp(appOpts);
  const kiosk = createKiosk({ ...app.opts, win, getObstacles: () => [], getDock: () => null });
  t.after(() => {
    delete globalThis.document;
  });
  return { dom, win, app, kiosk, chip: kiosk.element };
}

test('(k) 실행기 한 바퀴: 칩 「발표 모드 · …」 → 프리셋마다 컷 시간 → 실내 → 기본 층 둘러보기 → 다음 층(층 이동 뒤 둘러보기) → 밖으로 → 한 컷 → 반대 월드', async (t) => {
  const { app, kiosk, chip, dom } = setup(t);
  assert.ok(dom.document.body.children.includes(chip), '칩은 body 에');
  assert.equal(chip.className, 'nw-kiosk');
  assert.equal(chip.attrs.role, 'status');
  assert.equal(chip.hidden, true);
  assert.equal(kiosk.isRunning(), false);

  assert.equal(kiosk.start(), true);
  assert.equal(kiosk.isRunning(), true);
  assert.equal(chip.hidden, false);
  assert.equal(chip.textContent, KIOSK_TEXT.running);
  assert.equal(kiosk.start(), false, '도는 중에는 다시 시작하지 않는다');
  await flush();
  assert.deepEqual(app.log, ['onStart', 'floors:null', 'preset:street']);
  t.mock.timers.tick(1999);
  await flush();
  assert.equal(app.log.at(-1), 'preset:street', 'kioskShot=2 → 2 초 머문다');
  t.mock.timers.tick(1);
  await flush();
  assert.equal(app.log.at(-1), 'preset:aerial');
  t.mock.timers.tick(2000);
  await flush();
  // 실내 → 기본 층(1) 둘러보기(층 이동 없음) → b1 로 이동 → 둘러보기 → 밖으로
  assert.deepEqual(app.log.slice(4), ['enter', 'tour:1', 'go:b1', 'tour:b1', 'exit']);
  t.mock.timers.tick(1999);
  await flush();
  assert.equal(app.log.at(-1), 'exit', '밖에서 한 컷 머문다');
  t.mock.timers.tick(1);
  await flush();
  assert.equal(app.log.at(-1), 'switch');
  assert.equal(app.log.filter((x) => x === 'switch').length, 1);
  assert.equal(kiosk.isRunning(), true, '넘어가는 동안 칩은 그대로');
  assert.equal(app.replaced.length, 0, '주소는 그대로(새 주소로 넘어간다)');
  assert.equal(app.log.includes('onStop'), false);
});

test('(l) 아무 키 · 클릭 · 터치 · 휠: 순서를 멈추고(타이머 · 둘러보기 · 비행 — onStop) 칩 「발표 모드를 멈췄습니다」 2 초, 주소에서 kiosk · kioskShot 을 지운다. 멈춘 입력은 뒤로 보내지 않는다', async (t) => {
  const { app, kiosk, chip, win } = setup(t);
  let behind = 0;
  for (const type of ['keydown', 'pointerdown', 'wheel', 'touchstart', 'click']) win.addEventListener(type, () => { behind += 1; }, true);
  // 창 캡처 · 첫 처리기 — 다른 처리기(사진 · 조작 안내 · 목록 · camera.js)보다 먼저
  assert.ok(win.list.filter((l) => l.type === 'keydown')[0].capture);
  assert.equal(win.list.find((l) => l.type === 'touchstart').passive, true);
  assert.equal(win.list.find((l) => l.type === 'wheel').passive, true);

  kiosk.start();
  await flush();
  assert.equal(app.log.at(-1), 'preset:street');
  const ev = win.dispatch('keydown', { key: 'w', code: 'KeyW' });
  assert.equal(ev.stopped, true);
  assert.equal(ev.defaultPrevented, true);
  assert.equal(behind, 0, '멈춘 키는 뒤 처리기로 가지 않는다(V 보행 · ? 안내 · L 목록 · Esc 등이 함께 일어나지 않게)');
  assert.equal(kiosk.isRunning(), false);
  assert.equal(app.log.at(-1), 'onStop');
  assert.equal(chip.textContent, KIOSK_TEXT.stopped);
  assert.equal(chip.hidden, false);
  assert.deepEqual(app.replaced, ['/nowhere?tier=mobile']);
  // 다음 컷으로 넘어가지 않는다
  t.mock.timers.tick(10000);
  await flush();
  assert.equal(app.log.includes('preset:aerial'), false);
  assert.equal(chip.hidden, true, '2 초 뒤 사라짐');
  // 멈춘 뒤의 입력은 그대로 뒤로
  win.dispatch('keydown', { key: 'w', code: 'KeyW' });
  assert.equal(behind, 1);

  // 클릭: 누른 것(pointerdown)과 그 뒤 click 을 삼킨다(건물 카드 · 스팟 · 버튼이 열리지 않게), 다음 클릭은 그대로
  kiosk.start();
  await flush();
  behind = 0;
  const down = win.dispatch('pointerdown', {});
  assert.equal(down.stopped, true);
  assert.equal(kiosk.isRunning(), false);
  const click = win.dispatch('click', {});
  assert.equal(click.stopped, true);
  assert.equal(click.defaultPrevented, true);
  assert.equal(behind, 0);
  win.dispatch('pointerdown', {});
  win.dispatch('click', {});
  assert.equal(behind, 2, '다음 누름 · 클릭은 그대로');

  // 휠 · 터치
  for (const type of ['wheel', 'touchstart']) {
    kiosk.start();
    await flush();
    behind = 0;
    const e = win.dispatch(type, { cancelable: false });
    assert.equal(e.stopped, true, type);
    assert.equal(kiosk.isRunning(), false, type);
    assert.equal(behind, 0, type);
  }
  // 터치로 멈춘 뒤의 click(탭이 만든)도 삼킨다
  assert.equal(win.dispatch('click', {}).stopped, true);
  // 멈춰 있을 때 누름 · 휠은 그대로
  behind = 0;
  win.dispatch('pointerdown', {});
  win.dispatch('wheel', {});
  assert.equal(behind, 2);
});

test('(m) K 로 시작 · 멈춤: 막혀 있으면 시작하지 않고, 도는 중 ⌘ 조합은 멈추지 않는다 · 누르고 있던 K 반복은 삼킨다', async (t) => {
  const { app, kiosk, win } = setup(t);
  app.blocked = true;
  const e0 = win.dispatch('keydown', { key: 'k', code: 'KeyK' });
  assert.equal(kiosk.isRunning(), false);
  assert.equal(e0.stopped, false, '막혀 있으면 K 는 그대로(사진 모드가 삼킨다)');
  assert.equal(kiosk.start(), false, '막혀 있으면 시작하지 않는다');
  app.blocked = false;
  const e1 = win.dispatch('keydown', { key: 'k', code: 'KeyK' });
  assert.equal(kiosk.isRunning(), true);
  assert.equal(e1.stopped, true);
  assert.equal(e1.defaultPrevented, true);
  await flush();
  win.dispatch('keydown', { key: 'k', code: 'KeyK', repeat: true });
  assert.equal(kiosk.isRunning(), true, '반복은 멈추지 않는다');
  const cmd = win.dispatch('keydown', { key: 'Tab', code: 'Tab', metaKey: true });
  assert.equal(kiosk.isRunning(), true, '⌘Tab 은 멈추지 않는다');
  assert.equal(cmd.stopped, false);
  win.dispatch('keydown', { key: 'k', code: 'KeyK' });
  assert.equal(kiosk.isRunning(), false, 'K 로 멈춤');
  assert.equal(app.log.at(-1), 'onStop');
  // 멈춘 K 가 곧바로 다시 시작하지 않는다(한 번 누름 = 한 번)
  assert.equal(kiosk.isRunning(), false);
});

test('(n) 실내 전환 · 둘러보기 도중 멈춤: 둘러보기는 onStop 이 멈추고, 들어가기 · 층 이동이 끝나면 onSettle(그 자리 자유 시점) — 다음 단계는 없다', async (t) => {
  const { app, kiosk, win } = setup(t);
  app.holding = ['enter'];
  kiosk.start();
  await flush();
  for (let i = 0; i < 2; i++) {
    t.mock.timers.tick(2000);
    await flush();
  }
  assert.equal(app.log.at(-1), 'enter');
  win.dispatch('keydown', { key: 'a', code: 'KeyA' });
  assert.equal(app.log.at(-1), 'onStop');
  app.hold.enter();
  await flush();
  assert.equal(app.log.at(-1), 'onSettle', '들어가기가 끝난 뒤 보행을 끈다');
  assert.equal(app.log.includes('tour:1'), false);

  // 둘러보기 중 멈춤 → 둘러보기 약속이 늦게 풀려도 다음 층으로 가지 않는다(onSettle 없음 — 그사이 사용자가 V 로 걸을 수 있다)
  app.log.length = 0;
  app.inside = false;
  app.holding = ['tour'];
  kiosk.start();
  await flush();
  for (let i = 0; i < 2; i++) {
    t.mock.timers.tick(2000);
    await flush();
  }
  assert.equal(app.log.at(-1), 'tour:1');
  win.dispatch('pointerdown', {});
  app.hold.tour();
  await flush();
  assert.equal(app.log.at(-1), 'onStop');
  assert.equal(app.log.includes('go:b1'), false);
});

test('(o) 실내에서 시작(K): 지금 층부터 둘러보기(층 이동 없이) → 다른 층 → 밖으로 → 반대 월드', async (t) => {
  const { app, kiosk } = setup(t, { inside: true, floor: 'b1' });
  kiosk.start();
  await flush();
  assert.deepEqual(app.log, ['onStart', 'floors:b1', 'tour:b1', 'go:1', 'tour:1', 'exit']);
  t.mock.timers.tick(2000);
  await flush();
  assert.equal(app.log.at(-1), 'switch');
});

test('(p) 연결: main.js 가 발표 모드를 사진 모드보다 먼저 만들고(창 캡처 첫 처리기), 프리셋 · 실내 · 반대 월드 주소 · 막힘 조건 · 시작 흐름 · __NW_APP', () => {
  const main = readSrc('main.js');
  assert.match(main, /import \{[^}]*createKiosk[^}]*\} from '\.\/kiosk\.js'/);
  assert.match(main, /const kioskParams = parseKioskParams\(params\);/);
  const make = main.match(/const kiosk = createKiosk\(\{[\s\S]*?\n  \}\);/);
  assert.ok(make, 'createKiosk 호출 없음');
  const at = (re) => main.search(re);
  for (const re of [/const photo = createPhotoMode\(/, /const help = createHelpOverlay\(/, /const modal = createModal\(/, /const hub = createHubPanel\(/, /const archive = createArchiveCard\(/]) {
    assert.ok(at(/const kiosk = createKiosk\(/) < at(re), `발표 모드가 ${re} 보다 먼저(키 · 누름을 먼저 받아 멈추고 삼킨다)`);
  }
  assert.ok(at(/const kiosk = createKiosk\(/) > at(/const camCtrl = createCameraController\(/));
  for (const re of [/shotS: kioskParams\.shotS/, /world\.layout\.cameras/, /setCameraPreset\(id\)/, /kioskFloorOrder\(await interior\.loadLayout\(\)/, /interior\.enter\('haus'\)/,
    /interior\.goToFloor\(id\)/, /interior\.playTour\(\)/, /interior\.exit\(\)/, /kioskSwitchUrl\(\{[^}]*targetVer: otherWorldVer/, /interior\.stopTour\(\)/, /camCtrl\.stopFlight\(\)/,
    /modes\.set\('free'\)/, /archive\.hide\(\)/, /setWalkMode\(false\)/]) {
    assert.match(make[0], re);
  }
  const blocked = main.match(/const kioskBlocked = \(\) =>([^\n]*)/);
  assert.ok(blocked, 'kioskBlocked 없음');
  for (const s of ['cinema.isActive()', 'camCtrl.isIntroActive()', "classList.contains('is-choosing')", 'camCtrl.isFlying()', 'spotCutting', 'interior.isBusy()', 'interior.isTouring()',
    'showcase.isActive()', 'showcase.isBusy()', 'modal.isOpen()', 'help.isOpen()', 'hub.isOpen()', 'photo.isActive()']) {
    assert.ok(blocked[1].includes(s), `발표 모드 막힘 조건에 ${s} 없음`);
  }
  // 시작 흐름: ?kiosk=1 은 인트로를 끝까지 보면(또는 인트로 없이) 방식 적용 뒤 시작, 입력으로 건너뛰면 멈춤(주소 정리)
  const entry = main.match(/async function runEntry\(\) \{[\s\S]*?\n  \}\n/);
  assert.ok(entry);
  assert.match(entry[0], /const introEnd = entry\.intro \? await playIntro\(\{ holdHud: true \}\) : null;/);
  assert.match(entry[0], /if \(kioskParams\.on\) \{[\s\S]*?introEnd === null \|\| introEnd === 'complete'[\s\S]*?kiosk\.start\(\)[\s\S]*?kiosk\.stop\(\)/);
  assert.ok(entry[0].indexOf('kioskParams.on') > entry[0].indexOf('modes.set(mode)'), '방식 적용 뒤');
  assert.match(main, /\n    kiosk,\n/, '__NW_APP.kiosk');
});

test('(q) 실내: 층 둘러보기를 밖에서 시작 · 멈출 수 있게(playTour → 끝 약속 · stopTour) — 「이 층 둘러보기」 버튼도 같은 playTour', () => {
  const src = readSrc('interior.js');
  assert.match(src, /function playTour\(\) \{\s*if \(!active \|\| busy \|\| !floorDef\?\.tour\?\.length\) return null;\s*return tour\.play\(floorDef\.tour\);\s*\}/);
  assert.match(src, /tourBtn\.addEventListener\('click', \(\) => \{[\s\S]*?const played = playTour\(\);/);
  assert.match(src, /\n    playTour,\n/);
  assert.match(src, /\n    stopTour: \(\) => tour\.stop\(\),\n/);
});

test('(r) CSS: 칩은 아래 가운데(자리는 kiosk.js 가 잰 --nw-kiosk-bottom — 독 위), 작게 · 누르지 않음, 사진 모드 · 감상 · 인트로 · 방식 고르기에서 숨김', () => {
  const css = readSrc('nowhere.css');
  const rule = css.match(/\n\.nw-kiosk \{([\s\S]*?)\n\}/);
  assert.ok(rule, '.nw-kiosk 규칙 없음');
  for (const re of [/position: fixed;/, /left: 50%;/, /bottom: var\(--nw-kiosk-bottom, 18px\);/, /transform: translateX\(-50%\);/, /pointer-events: none;/]) assert.match(rule[1], re);
  assert.match(css, /\.nw-kiosk\[hidden\] \{\s*display: none;/);
  for (const state of ['is-photo', 'is-showcase', 'is-cinema', 'is-choosing']) {
    assert.match(css, new RegExp(`body\\.${state} \\.nw-kiosk[,\\s{]`), `${state} 에서 칩 숨김 없음`);
  }
});

test('(s) 조작 안내 · README: 공통에 K 줄(짧게 — 1600 × 900 첫 화면), README 표에 K 줄(순서 · 멈춤 · 문구), URL 옵션에 kiosk=1 · 시험용 kioskShot', () => {
  const common = CONTROL_SECTIONS.find((s) => s.id === 'common');
  const row = common.rows.find((r) => r.keys.includes('K'));
  assert.ok(row, '공통에 K 줄 없음');
  assert.deepEqual(row.keys, ['K']);
  assert.match(row.desc, /발표 모드/);
  assert.ok(row.desc.length <= 45, `K 줄이 길다(${row.desc.length}자) — 공통 칸 한 줄`);
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  const line = readme.split('\n').find((r) => r.startsWith('| `K`'));
  assert.ok(line, 'README K 줄 없음');
  for (const re of [/발표 모드/, /10 초/, /이 층 둘러보기/, /반대 월드/, /발표 모드 · 아무 키나 누르면 멈춥니다/, /발표 모드를 멈췄습니다/, /kiosk/]) assert.match(line, re);
  assert.match(readme, /`kiosk=1`/);
  assert.match(readme, /`kioskShot=/);
});
