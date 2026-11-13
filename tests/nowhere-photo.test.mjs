import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PHOTO_FOV_MIN, PHOTO_FOV_MAX, PHOTO_FOV_STEP, PHOTO_TOAST_MS, PHOTO_TIME_DECIMALS, PHOTO_FILE_PREFIX, PHOTO_UNLOCK_GRACE_MS, PHOTO_TEXT,
  clampFov, photoFileName, photoTimeParam, photoFovParam, parseFovParam, photoLinkUrl, photoKeyAction, createPhotoMode,
} from '../public/src/nowhere/photo.js';
import { resolveEntry, parsePose, POSE_DECIMALS } from '../public/src/nowhere/entry.js';
import { parseTimeParam, resolveWeather } from '../public/src/nowhere/weather.js';
import { CONTROL_SECTIONS } from '../public/src/nowhere/help.js';

// 사진 모드(photo.js): 상수 · 파일 이름 · 화각 · 시각 값 · 링크 주소 · C 키 · DOM(도구 줄 · 화각 · 저장 · 링크 복사 · 닫기) · main 연결 · CSS · 안내 · README
const PUB = new URL('../public/', import.meta.url);
const readSrc = (f) => readFileSync(new URL(`src/nowhere/${f}`, PUB), 'utf8');

test('(a) 상수 한곳: 화각 20–90°(1° 단위) · 알림 1.5 초 · 시각 소수 둘째 자리 · 파일 앞 이름 · 마우스 고정 유예 · 문구(스펙 그대로)', () => {
  assert.equal(PHOTO_FOV_MIN, 20);
  assert.equal(PHOTO_FOV_MAX, 90);
  assert.equal(PHOTO_FOV_STEP, 1);
  assert.equal(PHOTO_TOAST_MS, 1500);
  assert.equal(PHOTO_TIME_DECIMALS, 2);
  assert.equal(PHOTO_FILE_PREFIX, 'haus-nowhere');
  assert.equal(PHOTO_UNLOCK_GRACE_MS, 300);
  assert.equal(PHOTO_TEXT.saved, '저장했습니다');
  assert.equal(PHOTO_TEXT.copied, '링크를 복사했습니다');
  assert.equal(PHOTO_TEXT.interior, '실내 자리는 링크로 열 수 없습니다');
  assert.ok(PHOTO_TEXT.copyManual && PHOTO_TEXT.saveFailed && PHOTO_TEXT.blocked);
});

test('(b) 파일 이름: haus-nowhere-<seongsu|ds2>-<YYYYMMDD-HHMMSS>.png — 기기 현지 시각, 두 자리 채움', () => {
  assert.equal(photoFileName('seongsu', new Date(2026, 10, 3, 4, 5, 6)), 'haus-nowhere-seongsu-20261103-040506.png');
  assert.equal(photoFileName('ds2', new Date(2026, 0, 1, 0, 0, 0)), 'haus-nowhere-ds2-20260101-000000.png');
  assert.equal(photoFileName('seongsu', new Date(2026, 11, 31, 23, 59, 59)), 'haus-nowhere-seongsu-20261231-235959.png');
});

test('(c) 화각: 20–90° 안으로, 숫자가 아니면 null', () => {
  assert.equal(clampFov(10), 20);
  assert.equal(clampFov(20), 20);
  assert.equal(clampFov(39.76), 39.76);
  assert.equal(clampFov(90), 90);
  assert.equal(clampFov(120), 90);
  assert.equal(clampFov('55'), 55);
  assert.equal(clampFov(NaN), null);
  assert.equal(clampFov(undefined), null);
  assert.equal(clampFov(''), null);
});

test('(d) 시각 값(time=): 시(0–24) 소수 둘째 자리까지, 뒤 0 없이 — parseTimeParam 이 같은 시각으로 읽는다', () => {
  assert.equal(photoTimeParam(14), '14');
  assert.equal(photoTimeParam(21.5), '21.5');
  assert.equal(photoTimeParam(18.25), '18.25');
  assert.equal(photoTimeParam(17 + 1 / 3), '17.33');
  assert.equal(photoTimeParam(0), '0');
  assert.equal(photoTimeParam(24), '24');
  for (const h of [0, 6.75, 14, 18.5, 21.5, 24]) assert.equal(parseTimeParam(photoTimeParam(h)), h);
});

test('(e) 링크 주소: 지금 월드 페이지 + 같은 자리 주소(ver · mode=free · at · look — 소수 둘째 자리) + time · weather. 받는 쪽은 인트로 없이 그 자리 · 기상 · 시각', () => {
  const url = photoLinkUrl({
    origin: 'http://localhost:4173', pathname: '/nowhere', worldVer: 'seongsu',
    at: [-105.123, 1.704, 50.2], target: [-30, 5.0049, 31], walking: false, hour: 21.5, weather: 'rain', fov: 30,
  });
  assert.equal(url, 'http://localhost:4173/nowhere?ver=seongsu&mode=free&at=-105.12,1.7,50.2&look=-30,5,31&time=21.5&weather=rain&fov=30');
  const p = new URL(url).searchParams;
  assert.deepEqual(resolveEntry(p, 'seongsu'), { select: false, world: 'seongsu', intro: false, mode: 'free' }, '인트로 없이 자유 시점');
  assert.deepEqual(parsePose(p), { at: [-105.12, 1.7, 50.2], look: [-30, 5, 31] });
  assert.equal(parseTimeParam(p.get('time')), 21.5);
  assert.equal(resolveWeather(p.get('weather'), 'seongsu'), 'rain');
  assert.equal(parseFovParam(p), 30, '받는 쪽은 같은 화각');
  assert.equal(POSE_DECIMALS, 2);

  // 보행: 시선 목표 = 시선 방향으로 10 m 앞(entry.js sameSpotLook — 같은 자리 바로가기와 같음). 방식은 늘 자유 시점
  const walk = new URL(photoLinkUrl({
    origin: 'http://localhost:4173', pathname: '/nowhere-mountain.html', worldVer: 'ds2',
    at: [0, 4, 0], target: [0, 4, -2.5], walking: true, hour: 14, weather: 'overcast', fov: 50,
  }));
  assert.equal(walk.pathname, '/nowhere-mountain', '.html 은 뗀다(같은 자리 주소와 같은 경로 규칙)');
  assert.equal(walk.searchParams.get('ver'), 'ds2');
  assert.equal(walk.searchParams.get('mode'), 'free');
  assert.equal(walk.searchParams.get('look'), '0,4,-10');
  assert.equal(walk.searchParams.get('time'), '14');
  assert.equal(walk.searchParams.get('weather'), 'overcast');
  assert.equal(walk.searchParams.get('fov'), '50', '보행 화각 그대로(받는 쪽은 자유 시점에 그 화각)');
  assert.equal(resolveEntry(walk.searchParams, 'ds2').intro, false);

  // 지금 주소의 다른 값(tier · stats · kiosk · cam · noIntro)은 싣지 않는다 — 받는 사람은 그 구도 · 기상 · 시각만
  const clean = new URL(photoLinkUrl({ origin: 'https://x.test', pathname: '/', worldVer: 'ds2', at: [1, 2, 3], target: [4, 5, 6], hour: 6.75, weather: 'snow', fov: 39.76 }));
  assert.deepEqual([...clean.searchParams.keys()], ['ver', 'mode', 'at', 'look', 'time', 'weather', 'fov']);
  assert.equal(clean.searchParams.get('fov'), '40', '정수 화각');
  assert.equal(clean.pathname, '/');
});

test('(e2) 링크 화각 fov=: 복사하는 순간의 화각을 정수(20–90)로, 받는 쪽은 20–90 정수만 읽고 그 밖은 무시(parsePose 처럼)', () => {
  assert.equal(photoFovParam(30), '30');
  assert.equal(photoFovParam(39.76), '40');
  assert.equal(photoFovParam(64.5), '65');
  assert.equal(photoFovParam(10), '20');
  assert.equal(photoFovParam(120), '90');
  const read = (v) => parseFovParam(new URLSearchParams(v == null ? '' : `fov=${encodeURIComponent(v)}`));
  assert.equal(read('30'), 30);
  assert.equal(read('20'), 20);
  assert.equal(read('90'), 90);
  for (const bad of [null, '', ' ', '19', '91', '0', '30.5', '30.0', '-30', '+30', '1e1', '3O', ' 30', '30 ', 'abc', '030', '300']) {
    assert.equal(read(bad), null, `fov=${bad} 는 무시`);
  }
  assert.equal(parseFovParam(null), null);
  for (const h of [20, 33, 40, 50, 90]) assert.equal(parseFovParam(new URLSearchParams(`fov=${photoFovParam(h)}`)), h, '왕복');
});

test('(f) C 키(photoKeyAction): 닫혀 있으면 C · c · 한글 입력 상태(KeyC)로 열기 — ⌘ · Ctrl · Alt · 입력 칸 · 반복 · 막힘 · 앞 처리기가 받은 키 · 다른 키는 그대로', () => {
  const k = (key, code, extra = {}) => photoKeyAction({ key, code, active: false, ...extra });
  assert.equal(k('c', 'KeyC'), 'open');
  assert.equal(k('C', 'KeyC', { shiftKey: true }), 'open');
  assert.equal(k('ㅊ', 'KeyC'), 'open', '한글 입력 상태 — 라틴 글자가 아니면 자리(KeyC)로');
  assert.equal(k('Process', 'KeyC'), 'open', 'IME 조합 중');
  assert.equal(k('c', 'KeyI'), 'open', '드보락 c(KeyI 자리)');
  assert.equal(k('j', 'KeyC'), null, '드보락 KeyC 자리(j)는 아니다');
  for (const extra of [{ metaKey: true }, { ctrlKey: true }, { altKey: true }, { typing: true }, { repeat: true }, { blocked: true }, { defaultPrevented: true }]) {
    assert.equal(k('c', 'KeyC', extra), null, JSON.stringify(extra));
  }
  for (const [key, code] of [['Escape', 'Escape'], ['v', 'KeyV'], ['l', 'KeyL'], ['h', 'KeyH'], ['w', 'KeyW']]) assert.equal(k(key, code), null, key);
});

test('(g) 떠 있는 동안: Esc · C 로 닫기(Esc 는 입력 칸에서도), V · ? · L · H · P · K 는 막기(보행 전환 · 조작 안내 · 목록 · HUD · 성능 · 발표), 이동 · 시선 · 버튼 키는 그대로', () => {
  const k = (key, code, extra = {}) => photoKeyAction({ key, code, active: true, ...extra });
  assert.equal(k('Escape', 'Escape'), 'close');
  assert.equal(k('Escape', 'Escape', { typing: true }), 'close', '링크 글 칸에서도 Esc 는 닫기');
  assert.equal(k('Escape', 'Escape', { repeat: true }), 'swallow');
  assert.equal(k('Escape', 'Escape', { locked: true }), 'swallow', '마우스 고정 중(또는 막 풀린 직후)의 Esc 는 고정 해제만 — 사진 모드도 보행도 그대로');
  assert.equal(k('c', 'KeyC'), 'close');
  assert.equal(k('ㅊ', 'KeyC'), 'close');
  assert.equal(k('c', 'KeyC', { repeat: true }), 'swallow', '누르고 있어도 깜박이지 않게');
  assert.equal(k('c', 'KeyC', { typing: true }), null);
  assert.equal(k('c', 'KeyC', { metaKey: true }), null, '⌘C(글 칸 복사)');
  assert.equal(k('c', 'KeyC', { altKey: true }), null, 'Alt 조합(맥 ç 등)은 그대로');
  for (const [key, code, extra] of [
    ['v', 'KeyV'], ['V', 'KeyV'], ['ㅍ', 'KeyV'], ['l', 'KeyL'], ['ㅣ', 'KeyL'], ['h', 'KeyH'], ['ㅗ', 'KeyH'], ['p', 'KeyP'], ['P', 'KeyP'],
    ['k', 'KeyK'], ['K', 'KeyK'], ['?', 'Slash', { shiftKey: true }], ['/', 'Slash', { shiftKey: true }],
  ]) assert.equal(k(key, code, extra), 'swallow', `${key} ${code}`);
  for (const [key, code] of [['w', 'KeyW'], ['a', 'KeyA'], ['s', 'KeyS'], ['d', 'KeyD'], ['q', 'KeyQ'], ['e', 'KeyE'], ['ArrowUp', 'ArrowUp'], ['ArrowLeft', 'ArrowLeft'],
    [' ', 'Space'], ['Shift', 'ShiftLeft'], ['Tab', 'Tab'], ['Enter', 'Enter'], ['1', 'Digit1'], ['/', 'Slash']]) {
    assert.equal(k(key, code), null, `${key} 는 그대로(보행 · 자유 시점 조작)`);
  }
  assert.equal(k('v', 'KeyV', { typing: true }), null, '글 칸에서는 그대로(뒤 처리기가 입력 칸을 무시)');
  assert.equal(k('p', 'KeyP', { ctrlKey: true }), null);
  // 사진 모드를 닫은 Esc 를 누르고 있는 동안의 반복은 닫힌 뒤에도 삼킨다(보행 해제로 가지 않게)
  assert.equal(photoKeyAction({ key: 'Escape', code: 'Escape', active: false, repeat: true, held: true }), 'swallow');
  assert.equal(photoKeyAction({ key: 'Escape', code: 'Escape', active: false, repeat: true, held: false }), null);
  assert.equal(photoKeyAction({ key: 'Escape', code: 'Escape', active: false }), null);
});

// ── 가짜 DOM(EventTarget) ──
class FakeEl extends EventTarget {
  constructor(doc, tag) {
    super();
    this.doc = doc;
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.parent = null;
    this.hidden = false;
    this.textContent = '';
    this.className = '';
    this.id = '';
    this.title = '';
    this.value = '';
    this.dataset = {};
    this.style = {};
    this.attrs = new Map();
    this.selected = false;
    const cls = new Set();
    this.classList = { toggle: (c, on) => ((on ?? !cls.has(c)) ? cls.add(c) : cls.delete(c)), contains: (c) => cls.has(c), add: (c) => cls.add(c), remove: (c) => cls.delete(c) };
  }
  append(...cs) {
    for (const c of cs) {
      c.parent = this;
      this.children.push(c);
    }
  }
  insertBefore(c, ref) {
    const i = ref ? this.children.indexOf(ref) : -1;
    c.parent = this;
    if (i < 0) this.children.push(c);
    else this.children.splice(i, 0, c);
  }
  remove() {
    if (!this.parent) return;
    this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = null;
  }
  contains(x) {
    for (let n = x; n; n = n.parent) if (n === this) return true;
    return false;
  }
  setAttribute(k, v) {
    this.attrs.set(k, String(v));
  }
  getAttribute(k) {
    return this.attrs.has(k) ? this.attrs.get(k) : null;
  }
  removeAttribute(k) {
    this.attrs.delete(k);
  }
  focus() {
    this.doc.activeElement = this;
  }
  blur() {
    if (this.doc.activeElement === this) this.doc.activeElement = this.doc.body;
  }
  select() {
    this.selected = true;
  }
  click() {
    this.dispatchEvent(new Event('click'));
  }
}

function fakeDom() {
  const doc = { activeElement: null, created: [] };
  doc.body = new FakeEl(doc, 'body');
  doc.activeElement = doc.body;
  const actions = new FakeEl(doc, 'div');
  const help = new FakeEl(doc, 'button');
  help.id = 'nw-btn-help';
  actions.append(help);
  doc.actions = actions;
  doc.createElement = (tag) => {
    const n = new FakeEl(doc, tag);
    doc.created.push(n);
    return n;
  };
  doc.querySelector = (sel) => (sel === '.nw-top-actions' ? actions : null);
  doc.getElementById = (id) => [...actions.children].find((n) => n.id === id) || null;
  return doc;
}

const all = (n) => [n, ...n.children.flatMap(all)];
const byClass = (root, c) => all(root).find((n) => n.className.split(' ').includes(c));

function key(type, k, code, extra = {}) {
  const e = new Event(type, { cancelable: true });
  Object.assign(e, { key: k, code, repeat: false, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false, ...extra });
  return e;
}

function setup({ interior = false, blocked = false, clipboard = null, fov = 39.76, walking = false } = {}) {
  const win = new EventTarget();
  const doc = fakeDom();
  globalThis.window = win;
  globalThis.document = doc;
  const state = { interior, blocked, walking };
  const camera = { fov, updates: 0, updateProjectionMatrix() { this.updates += 1; } };
  const blobs = [];
  const canvas = {
    width: 3200,
    height: 1800,
    toBlob(cb, type) {
      blobs.push(type);
      queueMicrotask(() => cb(new Blob([new Uint8Array([137, 80, 78, 71])], { type })));
    },
  };
  const opened = [];
  const photo = createPhotoMode({
    camera,
    canvas,
    worldVer: 'seongsu',
    getPose: () => ({ at: [-105.123, 1.7, 50.2], target: [-30, 5, 31], walking: state.walking }),
    getHour: () => 21.5,
    getWeather: () => 'rain',
    isInterior: () => state.interior,
    isBlocked: () => state.blocked,
    onOpen: () => opened.push(true),
    clipboard,
    location: { origin: 'http://localhost:4173', pathname: '/nowhere' },
    now: () => new Date(2026, 10, 13, 9, 8, 7),
  });
  return { win, doc, state, camera, canvas, blobs, photo, opened };
}

function teardown(saved) {
  globalThis.window = saved.window;
  globalThis.document = saved.document;
  if (saved.window === undefined) delete globalThis.window;
  if (saved.document === undefined) delete globalThis.document;
}

test('(h) DOM: 위 막대 「사진」 버튼(C — 조작 안내 앞) · 숨은 도구 줄(화각 슬라이더 20–90 · 저장 · 링크 복사 · 실내 이유 · 닫기 Esc)', () => {
  const saved = { window: globalThis.window, document: globalThis.document };
  try {
    const { doc, photo } = setup();
    const btn = photo.button;
    assert.equal(btn.id, 'nw-btn-photo');
    assert.match(btn.className, /\bnw-btn\b/);
    assert.match(btn.className, /\bnw-photo-btn\b/);
    assert.ok(btn.children.some((c) => c.className === 'nw-btn-kbd' && c.textContent === 'C'));
    assert.ok(btn.textContent.startsWith('사진'));
    assert.equal(doc.actions.children.indexOf(btn), 0, '조작 안내 버튼 앞');
    assert.equal(doc.actions.children[1].id, 'nw-btn-help');

    const root = photo.element;
    assert.ok(doc.body.children.includes(root));
    assert.equal(root.className, 'nw-photo');
    assert.equal(root.hidden, true, '처음에는 숨김');
    const slider = byClass(root, 'nw-photo-fov-slider');
    assert.equal(slider.type, 'range');
    assert.equal(slider.min, '20');
    assert.equal(slider.max, '90');
    assert.equal(slider.step, '1');
    assert.ok(all(root).some((n) => n.textContent === '화각'));
    assert.equal(byClass(root, 'nw-photo-save').textContent, '저장');
    assert.equal(byClass(root, 'nw-photo-link').textContent, '링크 복사');
    assert.equal(byClass(root, 'nw-photo-note').textContent, '실내 자리는 링크로 열 수 없습니다');
    const close = byClass(root, 'nw-photo-close');
    assert.ok(close.textContent.startsWith('닫기'));
    assert.ok(close.children.some((c) => c.textContent === 'Esc'));
    for (const b of [btn, byClass(root, 'nw-photo-save'), byClass(root, 'nw-photo-link'), close]) assert.equal(b.type, 'button');
  } finally {
    teardown(saved);
  }
});

test('(i) 열고 닫기: body.is-photo · 도구 줄, 화각은 지금 값에서 시작 → 슬라이더로 바꾸고 매 프레임 다시 맞춤 → 닫으면 들어오기 전 값', () => {
  const saved = { window: globalThis.window, document: globalThis.document };
  try {
    const { doc, camera, photo, opened, state } = setup({ fov: 39.76 });
    assert.equal(photo.open(), true);
    assert.equal(photo.isActive(), true);
    assert.equal(doc.body.classList.contains('is-photo'), true);
    assert.equal(photo.element.hidden, false);
    assert.equal(opened.length, 1, 'onOpen(스팟 걷기 멈춤)');
    const slider = byClass(photo.element, 'nw-photo-fov-slider');
    const out = byClass(photo.element, 'nw-photo-fov-value');
    assert.equal(slider.value, '40', '지금 값(39.76°)에서 — 슬라이더는 1° 단위');
    assert.equal(out.textContent, '40°');
    assert.equal(camera.fov, 39.76, '움직이기 전에는 그대로');
    // 외관: 링크 버튼, 이유는 숨김
    assert.equal(byClass(photo.element, 'nw-photo-link').hidden, false);
    assert.equal(byClass(photo.element, 'nw-photo-note').hidden, true);

    slider.value = '65';
    slider.dispatchEvent(new Event('input'));
    assert.equal(camera.fov, 65);
    assert.equal(out.textContent, '65°');
    const u = camera.updates;
    // 다른 동작이 화각을 바꿔도(보행 전환 · 프리셋 전환) 다음 프레임에 사진 화각으로
    camera.fov = 50;
    photo.update();
    assert.equal(camera.fov, 65);
    assert.equal(camera.updates, u + 1);
    photo.update();
    assert.equal(camera.updates, u + 1, '같으면 다시 맞추지 않는다');

    photo.close();
    assert.equal(photo.isActive(), false);
    assert.equal(camera.fov, 39.76, '들어오기 전 값');
    assert.equal(doc.body.classList.contains('is-photo'), false);
    assert.equal(photo.element.hidden, true);
    photo.update();
    assert.equal(camera.fov, 39.76, '닫힌 뒤에는 건드리지 않는다');

    // 막혀 있으면 열지 않는다(감상 · 인트로 · 방식 고르기 · 모달 · 조작 안내 · 목록 …) — 위 막대 버튼은 흐리게 + 이유
    state.blocked = true;
    assert.equal(photo.open(), false);
    photo.update();
    assert.equal(photo.button.classList.contains('is-blocked'), true);
    assert.equal(photo.button.getAttribute('aria-disabled'), 'true');
    assert.equal(photo.button.title, PHOTO_TEXT.blocked);
    photo.button.click();
    assert.equal(photo.isActive(), false);
    state.blocked = false;
    photo.update();
    assert.equal(photo.button.classList.contains('is-blocked'), false);
    photo.button.click();
    assert.equal(photo.isActive(), true, '위 막대 버튼으로 열기');
    // 떠 있다가 막히면(실내 엘리베이터 질문 같은 모달) 닫고 화각을 되돌린다
    slider.value = '25';
    slider.dispatchEvent(new Event('input'));
    state.blocked = true;
    photo.update();
    assert.equal(photo.isActive(), false);
    assert.equal(camera.fov, 39.76);
    // 범위 밖 화각(드묾)은 범위 안으로 맞춰 시작하고, 닫으면 원래 값
    state.blocked = false;
    camera.fov = 100;
    photo.open();
    assert.equal(camera.fov, 90);
    assert.equal(slider.value, '90');
    photo.close();
    assert.equal(camera.fov, 100);
  } finally {
    teardown(saved);
  }
});

test('(j) 저장: 다음 프레임을 그린 직후(afterRender) 캔버스 PNG → 파일 이름 · 내려받기 · 「저장했습니다」 1.5 초. 그리기 전에 닫으면 저장하지 않는다', async (t) => {
  const saved = { window: globalThis.window, document: globalThis.document };
  const origCreate = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;
  const urls = { made: [], revoked: [] };
  URL.createObjectURL = (b) => {
    urls.made.push(b);
    return `blob:fake/${urls.made.length}`;
  };
  URL.revokeObjectURL = (u) => urls.revoked.push(u);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { doc, photo, blobs } = setup();
    photo.afterRender();
    assert.deepEqual(blobs, [], '저장을 누르지 않았으면 읽지 않는다');
    photo.open();
    byClass(photo.element, 'nw-photo-save').click();
    assert.deepEqual(blobs, [], '누른 순간이 아니라 다음 프레임을 그린 직후');
    photo.afterRender();
    assert.deepEqual(blobs, ['image/png']);
    photo.afterRender();
    assert.equal(blobs.length, 1, '한 번만');
    await new Promise((r) => queueMicrotask(r));
    const a = doc.created.filter((n) => n.tagName === 'A').at(-1);
    assert.ok(a, '내려받기 링크');
    assert.equal(a.download, 'haus-nowhere-seongsu-20261113-090807.png');
    assert.equal(a.href, 'blob:fake/1');
    assert.equal(a.parent, null, '누른 뒤 뗀다');
    assert.equal(urls.made[0].type, 'image/png');
    const msg = byClass(photo.element, 'nw-photo-msg');
    assert.equal(msg.hidden, false);
    assert.equal(msg.textContent, '저장했습니다');
    t.mock.timers.tick(PHOTO_TOAST_MS - 1);
    assert.equal(msg.hidden, false);
    t.mock.timers.tick(1);
    assert.equal(msg.hidden, true, '1.5 초 뒤 사라짐');
    t.mock.timers.tick(10000);
    assert.deepEqual(urls.revoked, ['blob:fake/1'], '주소는 내려받은 뒤 푼다');

    // 저장을 누르고 그리기 전에 닫으면(화각이 되돌아간 프레임을 찍지 않게) 버린다
    byClass(photo.element, 'nw-photo-save').click();
    photo.close();
    photo.afterRender();
    assert.equal(blobs.length, 1);
  } finally {
    URL.createObjectURL = origCreate;
    URL.revokeObjectURL = origRevoke;
    teardown(saved);
  }
});

test('(k) 링크 복사: 클립보드에 같은 자리 주소 + time · weather → 「링크를 복사했습니다」, 못 쓰면 주소를 고를 수 있는 글 칸. 실내는 버튼 자리에 이유', async () => {
  const saved = { window: globalThis.window, document: globalThis.document };
  try {
    const copied = [];
    let s = setup({ clipboard: { writeText: async (v) => copied.push(v) } });
    s.photo.open();
    const url = await s.photo.copyLink();
    assert.equal(url, 'http://localhost:4173/nowhere?ver=seongsu&mode=free&at=-105.12,1.7,50.2&look=-30,5,31&time=21.5&weather=rain&fov=40', '복사하는 순간의 화각(39.76° → 정수 40)');
    assert.deepEqual(copied, [url]);
    const msg = byClass(s.photo.element, 'nw-photo-msg');
    assert.equal(msg.textContent, '링크를 복사했습니다');
    assert.equal(byClass(s.photo.element, 'nw-photo-url').hidden, true);
    teardown(saved);

    // 클립보드가 없거나 거절하면: 읽기 전용 글 칸에 주소(골라 둠 · 포커스)
    for (const clipboard of [null, { writeText: async () => { throw new Error('denied'); } }]) {
      s = setup({ clipboard });
      s.photo.open();
      byClass(s.photo.element, 'nw-photo-link').click();
      await new Promise((r) => setTimeout(r, 0));
      const field = byClass(s.photo.element, 'nw-photo-url');
      assert.equal(field.hidden, false);
      assert.equal(field.readOnly, true);
      assert.equal(field.value, url);
      assert.equal(field.selected, true);
      assert.equal(s.doc.activeElement, field);
      assert.equal(byClass(s.photo.element, 'nw-photo-msg').textContent, PHOTO_TEXT.copyManual);
      // 글 칸에서 Esc → 닫기(글 칸도 숨김)
      const e = key('keydown', 'Escape', 'Escape');
      Object.defineProperty(e, 'target', { value: field });
      s.win.dispatchEvent(e);
      assert.equal(s.photo.isActive(), false);
      assert.equal(field.hidden, true);
      teardown(saved);
    }

    // 실내: 링크 버튼 대신 이유 문구, copyLink 는 아무것도 하지 않는다
    const copied2 = [];
    s = setup({ interior: true, clipboard: { writeText: async (v) => copied2.push(v) } });
    s.photo.open();
    assert.equal(byClass(s.photo.element, 'nw-photo-link').hidden, true);
    const note = byClass(s.photo.element, 'nw-photo-note');
    assert.equal(note.hidden, false);
    assert.equal(note.textContent, '실내 자리는 링크로 열 수 없습니다');
    assert.equal(await s.photo.copyLink(), null);
    assert.deepEqual(copied2, []);
    // 나와서 다시 열면 링크 버튼
    s.photo.close();
    s.state.interior = false;
    s.photo.open();
    assert.equal(byClass(s.photo.element, 'nw-photo-link').hidden, false);
    assert.equal(note.hidden, true);
  } finally {
    teardown(saved);
  }
});

test('(l) 키(창 캡처): C 로 열고 닫기 · Esc 로 닫기 — 처리한 키 · 막는 키는 뒤(조작 안내 · 목록 · camera.js)로 가지 않고, 이동 키는 간다', () => {
  const saved = { window: globalThis.window, document: globalThis.document };
  try {
    const { win, photo, camera } = setup({ fov: 50 });
    const back = [];
    win.addEventListener('keydown', (e) => back.push(e.code), true);   // 뒤에 등록된 캡처 처리기(조작 안내 · 목록 · 카드)
    win.addEventListener('keydown', (e) => back.push(`bubble:${e.code}`));
    const press = (k, code, extra) => {
      const e = key('keydown', k, code, extra);
      win.dispatchEvent(e);
      win.dispatchEvent(key('keyup', k, code, extra));
      return e;
    };
    const e1 = press('c', 'KeyC');
    assert.equal(photo.isActive(), true);
    assert.equal(e1.defaultPrevented, true);
    assert.deepEqual(back, [], '여는 C 는 뒤로 가지 않는다');
    for (const [k, code, extra] of [['v', 'KeyV'], ['?', 'Slash', { shiftKey: true }], ['l', 'KeyL'], ['h', 'KeyH'], ['p', 'KeyP'], ['k', 'KeyK']]) press(k, code, extra);
    assert.deepEqual(back, [], '보행 전환 · 조작 안내 · 목록 · HUD · 성능 · 발표 키는 막는다');
    assert.equal(photo.isActive(), true);
    press('w', 'KeyW');
    press('ArrowLeft', 'ArrowLeft');
    assert.deepEqual(back, ['KeyW', 'bubble:KeyW', 'ArrowLeft', 'bubble:ArrowLeft'], '이동 · 시선 키는 그대로');
    back.length = 0;
    press('Escape', 'Escape');
    assert.equal(photo.isActive(), false);
    assert.equal(camera.fov, 50);
    assert.deepEqual(back, [], '닫은 Esc 는 보행 해제 · 카드 닫기로 가지 않는다');
    // 닫은 Esc 를 누르고 있는 동안의 반복도 삼킨다 — 떼면 끝
    win.dispatchEvent(key('keydown', 'Escape', 'Escape'));
    assert.equal(photo.isActive(), false);
    assert.deepEqual(back, ['Escape', 'bubble:Escape'], '닫혀 있을 때의 Esc 는 그대로');
    back.length = 0;
    press('c', 'KeyC');
    win.dispatchEvent(key('keydown', 'Escape', 'Escape'));
    win.dispatchEvent(key('keydown', 'Escape', 'Escape', { repeat: true }));
    assert.deepEqual(back, []);
    win.dispatchEvent(key('keyup', 'Escape', 'Escape'));
    win.dispatchEvent(key('keydown', 'Escape', 'Escape', { repeat: true }));
    assert.deepEqual(back, ['Escape', 'bubble:Escape'], '뗀 뒤에는 그대로');
    back.length = 0;
    // C 로 닫기
    press('c', 'KeyC');
    assert.equal(photo.isActive(), true);
    press('c', 'KeyC');
    assert.equal(photo.isActive(), false);
    assert.deepEqual(back, []);
  } finally {
    teardown(saved);
  }
});

test('(m) 연결: main.js 가 사진 모드를 조작 안내 · 모달 · 목록 · 건물 카드보다 먼저 만들고(키 캡처 순서), 막힘 조건 · 자리 · 시각 · 기상, 렌더 직후 afterRender, 매 프레임 update, 다른 클릭 기능은 사진 모드 동안 멈춤', () => {
  const main = readSrc('main.js');
  assert.match(main, /import \{[^}]*createPhotoMode[^}]*\} from '\.\/photo\.js'/);
  const make = main.match(/const photo = createPhotoMode\(\{[\s\S]*?\n  \}\);/);
  assert.ok(make, 'createPhotoMode 호출 없음');
  for (const re of [/camera,/, /canvas,/, /worldVer,/, /camera\.position\.toArray\(\)/, /camCtrl\.controls\.target\.toArray\(\)/, /walking: camCtrl\.isWalkMode\(\)/,
    /getHour: \(\) => weather\.getHour\(\)/, /getWeather: \(\) => weather\.getWeather\(\)/, /isInterior: \(\) => interior\.isActive\(\)/, /isPointerLocked: \(\) => camCtrl\.isPointerLocked\(\)/,
    /camCtrl\.cancelWalkTo\(\)/]) {
    assert.match(make[0], re);
  }
  const blocked = make[0].match(/isBlocked: \(\) =>([^\n]*)/);
  assert.ok(blocked, 'isBlocked 없음');
  for (const s of ['cinema.isActive()', 'camCtrl.isIntroActive()', "classList.contains('is-choosing')", 'showcase.isActive()', 'showcase.isBusy()', 'modal.isOpen()', 'help.isOpen()', 'hub.isOpen()',
    'camCtrl.isFlying()', 'spotCutting', 'interior.isBusy()', 'interior.isTouring()']) {
    assert.ok(blocked[1].includes(s), `사진 모드 막힘 조건에 ${s} 없음`);
  }
  // 키 캡처 순서: 사진 모드 → 조작 안내 · 모달 · 감상 · 목록 · 건물 카드 · main Esc
  const at = (re) => main.search(re);
  for (const re of [/const help = createHelpOverlay\(/, /const modal = createModal\(/, /const showcase = createShowcase\(/, /const hub = createHubPanel\(/, /const archive = createArchiveCard\(/]) {
    assert.ok(at(/const photo = createPhotoMode\(/) < at(re), `사진 모드가 ${re} 보다 먼저`);
  }
  // 렌더 직후(같은 프레임) 캡처 · 매 프레임 update
  assert.match(main, /post\.composer\.render\(\);\s*\n\s*photo\.afterRender\(\);/);
  assert.match(main, /\n    photo\.update\(\);/);
  assert.ok(at(/\n    photo\.update\(\);/) > at(/camCtrl\.update\(dt\);/), '카메라 갱신 뒤(화각 다시 맞추기)');
  // 사진 모드 동안 클릭으로 여는 것(◇ 스팟 · 진열 제품 · 전시물 · 건물 카드)은 멈춘다 — 숨은 채 감상 · 카드가 열리지 않게
  for (const name of ['markers = createSpotMarkers', 'retail = createRetailDisplay', 'exhibitTags = createExhibitTags', 'archive = createArchiveCard']) {
    const block = main.match(new RegExp(`const ${name.replace(/ /g, '\\s')}\\(\\{[\\s\\S]*?\\n  \\}\\);`));
    assert.ok(block, name);
    assert.match(block[0], /isSuspended: \(\) =>[^\n]*photo\.isActive\(\)/, `${name} 멈춤 조건에 사진 모드`);
  }
  assert.match(main, /\n    photo,\n/, '__NW_APP.photo');
});

test('(m2) 받는 쪽: 주소 fov(parseFovParam)는 시작 흐름에서 방식이 자유 시점일 때만 처음 한 번 카메라 화각에 — 같은 자리 자리 잡기 뒤(프리셋 · 보행 전환은 그대로 자기 화각)', () => {
  const main = readSrc('main.js');
  assert.match(main, /import \{[^}]*parseFovParam[^}]*\} from '\.\/photo\.js'/);
  assert.match(main, /const poseFov = parseFovParam\(params\);/);
  const entry = main.match(/async function runEntry\(\) \{[\s\S]*?\n  \}\n/);
  assert.ok(entry, 'runEntry 없음');
  const apply = entry[0].match(/if \(poseFov !== null && modes\.get\(\) === 'free'\) \{\s*camera\.fov = poseFov;\s*camera\.updateProjectionMatrix\(\);\s*\}/);
  assert.ok(apply, '자유 시점일 때만 화각 적용');
  assert.ok(entry[0].indexOf(apply[0]) > entry[0].indexOf('camCtrl.placeAt(p.at, p.look);'), '자리 잡기 뒤');
  // camera.js: 보행 켜기(50°) · 프리셋(그 프리셋 화각) · 인트로(44°)는 자기 화각 — 주소 화각은 시작 화면에만
  const cam = readSrc('camera.js');
  assert.match(cam, /camera\.fov = 50;/);
  assert.match(cam, /camera\.fov = camDef\.fov \|\| 40;/);
});

test('(n) CSS: 사진 모드는 화면 요소를 모두 숨기고 도구 줄만(아래 가운데 · 누르는 자리 44 px · 휴대폰은 화각 줄 따로), 위 막대 버튼은 막히면 흐리게 · 휴대폰 폭 44 px', () => {
  const css = readSrc('nowhere.css');
  for (const sel of ['.nw-topbar', '.nw-compass', '.nw-dock', '.nw-walk-hud', '.nw-spots', '.nw-perf', '.nw-interior-hud', '.nw-interior-caption', '.nw-retail-tags', '.nw-exhibit-tags', '.nw-archive-tags', '.nw-archive-card', '.nw-hub']) {
    assert.match(css, new RegExp(`body\\.is-photo ${sel.replace('.', '\\.')}[,\\s]`), `사진 모드에서 ${sel} 숨김`);
  }
  const hide = css.match(/body\.is-photo \.nw-topbar,[\s\S]*?\{([^}]*)\}/);
  assert.ok(hide);
  assert.match(hide[1], /display: none;/);
  const root = css.match(/\n\.nw-photo \{([^}]*)\}/);
  assert.ok(root, '.nw-photo 없음');
  assert.match(root[1], /position: fixed;/);
  assert.match(root[1], /left: 50%;/);
  assert.match(root[1], /bottom: /);
  const z = Number(root[1].match(/z-index: (\d+);/)[1]);
  const zOf = (sel) => Number(css.match(new RegExp(`\\n${sel.replace('.', '\\.')} \\{[^}]*?z-index: (\\d+);`))[1]);
  assert.ok(z < zOf('.nw-modal') && z < zOf('.nw-fade') && z < zOf('.nw-help'), '모달 · 화면 전환 · 조작 안내가 위');
  assert.match(css, /\.nw-photo\[hidden\] \{\s*display: none;/);
  assert.match(css, /\.nw-photo-bar \.nw-btn \{[^}]*min-height: 44px;[^}]*min-width: 44px;/);
  assert.match(css, /\.nw-photo-fov-slider \{[^}]*height: 44px;/);
  assert.match(css, /\.nw-photo-url \{[^}]*min-height: 44px;/);
  assert.match(css, /\.nw-photo-btn\.is-blocked \{[^}]*opacity: 0\.45;/);
  const touch = css.match(/@media \(max-width: 720px\), \(pointer: coarse\) \{\s*\.nw-photo-btn \{[^}]*min-width: 44px;/);
  assert.ok(touch, '사진 버튼 터치 폭 44 px');
  const phone = [...css.matchAll(/@media \(max-width: 720px\) \{([\s\S]*?)\n\}/g)].map((m) => m[1]).find((b) => b.includes('.nw-photo-fov'));
  assert.ok(phone, '휴대폰 도구 줄 배치 없음');
  assert.match(phone, /\.nw-photo-fov \{[^}]*flex: 1 1 100%;/);
});

test('(o) 조작 안내 · README: 공통에 C 줄(짧게 — 1600 × 900 첫 화면), README 표에 C · 사진 줄(파일 이름 · 링크 · 실내 이유)', () => {
  const common = CONTROL_SECTIONS.find((s) => s.id === 'common');
  const row = common.rows.find((r) => r.keys.includes('C'));
  assert.ok(row, '공통에 C 줄 없음');
  assert.deepEqual(row.keys, ['C']);
  assert.match(row.desc, /사진 모드/);
  assert.match(row.desc, /화각/);
  assert.match(row.desc, /저장/);
  assert.match(row.desc, /링크/);
  assert.ok(row.desc.length <= 45, `C 줄이 길다(${row.desc.length}자) — 1600 × 900 에서 공통 칸 한 줄(337 px)에 들어가야 첫 화면이 유지된다`);
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  const line = readme.split('\n').find((r) => r.startsWith('| `C`'));
  assert.ok(line, 'README C 줄 없음');
  for (const re of [/사진/, /20–90°/, /haus-nowhere-<seongsu\|ds2>-<YYYYMMDD-HHMMSS>\.png/, /저장했습니다/, /링크를 복사했습니다/, /실내 자리는 링크로 열 수 없습니다/, /time/, /weather/, /`fov`/, /Esc/]) {
    assert.match(line, re);
  }
});
