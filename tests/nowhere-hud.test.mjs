import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HUD_ORIGIN, M_PER_DEG_LAT, HUD_UPDATE_MS, COMPASS_SPAN_DEG, COMPASS_TICK_DEG, COMPASS_WIDTH_PX, COMPASS_WIDTH_PHONE_PX,
  HUD_BUILDINGS, DIR_NAMES_8, INTERIOR_PLACE,
  latLonAt, formatLatLon, signedInt, bearingDeg, headingInt, dirName8, hudLine,
  compassX, compassMarker, compassTicks, compassStripWidthPct, compassShiftPct, hudKeyAction, createHud,
} from '../public/src/nowhere/hud.js';
import { CONTROL_SECTIONS } from '../public/src/nowhere/help.js';

// 현장 정보 HUD(hud.js): 좌표 줄(위경도 · 장면 좌표 · 고도 · 방위 · 시각 · 기상, 실내 층) · 방위 띠(눈금 · 건물 표시) · H 키 · DOM 갱신 · main 연결 · CSS · 안내 · README
const PUB = new URL('../public/', import.meta.url);
const readSrc = (f) => readFileSync(new URL(`src/nowhere/${f}`, PUB), 'utf8');
const MINUS = '−';

test('(a) 상수 한곳: 원점 37.544°N 127.056°E · 위도 1° 111 320 m · 1 초 10 번 · 시선 ±60° · 15° 눈금 · 띠 320 / 휴대폰 220 px · 두 건물 · 8방위', () => {
  assert.deepEqual(HUD_ORIGIN, { lat: 37.544, lon: 127.056 });
  assert.equal(M_PER_DEG_LAT, 111320);
  assert.equal(HUD_UPDATE_MS, 100);
  assert.equal(COMPASS_SPAN_DEG, 120);
  assert.equal(COMPASS_TICK_DEG, 15);
  assert.equal(COMPASS_WIDTH_PX, 320);
  assert.equal(COMPASS_WIDTH_PHONE_PX, 220);
  assert.deepEqual(HUD_BUILDINGS.map((b) => b.id), ['haus', 'facearch']);
  assert.deepEqual(HUD_BUILDINGS.map((b) => b.name), ['HAUS', 'FaceArch']);
  assert.deepEqual(DIR_NAMES_8, ['북', '북동', '동', '남동', '남', '남서', '서', '북서']);
  assert.equal(INTERIOR_PLACE, 'HAUS 성수');
});

test('(b) 위경도: 원점(HAUS 자리) 기준 등장방형 — 북 = −z, 동 = +x, 경도 1° = 111 320 × cos 37.544° m, 소수 넷째 자리', () => {
  const o = latLonAt(0, 0);
  assert.equal(o.lat, 37.544);
  assert.equal(o.lon, 127.056);
  assert.equal(formatLatLon(o), '37.5440°N 127.0560°E');
  // 북으로 111.32 m(−z) = 위도 +0.001°, 남(+z)은 −
  assert.ok(Math.abs(latLonAt(0, -111.32).lat - 37.545) < 1e-9);
  assert.ok(Math.abs(latLonAt(0, 111.32).lat - 37.543) < 1e-9);
  // 동으로 111 320 × cos(37.544°) × 0.001 m(+x) = 경도 +0.001°
  const mLon = 111320 * Math.cos((37.544 * Math.PI) / 180);
  assert.ok(Math.abs(latLonAt(mLon * 0.001, 0).lon - 127.057) < 1e-9);
  assert.ok(Math.abs(latLonAt(-mLon * 0.001, 0).lon - 127.055) < 1e-9);
  // 스펙 예: 37.5441°N 127.0563°E
  assert.equal(formatLatLon(latLonAt(mLon * 0.0003, -11.132)), '37.5441°N 127.0563°E');
});

test('(c) 장면 좌표 · 고도 정수: 음수는 − (U+2212), −0 은 0', () => {
  assert.equal(signedInt(-60.2), `${MINUS}60`);
  assert.equal(signedInt(19.6), '20');
  assert.equal(signedInt(-0.3), '0');
  assert.equal(signedInt(0), '0');
  assert.equal(signedInt(-0.5), '0');   // Math.round(−0.5) = −0
  assert.equal(signedInt(-0.51), `${MINUS}1`);
});

test('(d) 방위: 시선 수평 방향 → 북 0° 시계 방향 [0, 360), 바로 위 · 아래만 보면 null, 정수는 360 → 0', () => {
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  assert.ok(near(bearingDeg(0, -1), 0), '북 = −z');
  assert.ok(near(bearingDeg(1, 0), 90), '동 = +x');
  assert.ok(near(bearingDeg(0, 1), 180));
  assert.ok(near(bearingDeg(-1, 0), 270));
  assert.ok(near(bearingDeg(1, -1), 45));
  assert.ok(near(bearingDeg(-1, 1), 225));
  // world.js 해 방위 32° → three (0.476, 0.438, −0.762)
  assert.equal(Math.round(bearingDeg(0.4764, -0.7624)), 32);
  assert.equal(bearingDeg(0, 0), null);
  assert.equal(bearingDeg(1e-9, -1e-9), null);
  assert.equal(headingInt(359.6), 0);
  assert.equal(headingInt(244.6), 245);
  assert.equal(headingInt(0.4), 0);
});

test('(e) 8방위 한국어: 45° 칸, 경계는 정수 방위로(22 북 · 23 북동)', () => {
  const cases = [[0, '북'], [22, '북'], [23, '북동'], [45, '북동'], [67, '북동'], [68, '동'], [90, '동'], [135, '남동'], [180, '남'],
    [225, '남서'], [245, '남서'], [270, '서'], [292, '서'], [293, '북서'], [315, '북서'], [337, '북서'], [338, '북'], [359, '북']];
  for (const [deg, name] of cases) assert.equal(dirName8(deg), name, `${deg}°`);
});

test('(f) 좌표 줄 형식: 성수 위경도 · 산악 장면 좌표 · 실내 층 이름 · 방위만', () => {
  const mLon = 111320 * Math.cos((37.544 * Math.PI) / 180);
  const base = { pos: { x: mLon * 0.0003, y: 12.4, z: -11.132 }, heading: 245, hour: 14, weatherLabel: '맑음' };
  assert.equal(hudLine({ ...base, worldVer: 'seongsu' }), '37.5441°N 127.0563°E · 고도 12 m · 방위 245° 남서 · 14:00 맑음');
  assert.equal(
    hudLine({ worldVer: 'ds2', pos: { x: -60.4, y: 11.6, z: 19.7 }, heading: 245, hour: 21.5, weatherLabel: '비(타임폴)' }),
    `X ${MINUS}60 · Z 20 · 고도 12 m · 방위 245° 남서 · 21:30 비(타임폴)`,
  );
  assert.equal(hudLine({ worldVer: 'ds2', pos: { x: -0.2, y: 1.7, z: 0.4 }, heading: 0, hour: 6.25, weatherLabel: '흐림' }), 'X 0 · Z 0 · 고도 2 m · 방위 0° 북 · 06:15 흐림');
  // 실내: 층 이름(inner-layout label) · 방위만 — 위경도 · 고도 · 시각 · 기상 없음
  assert.equal(hudLine({ ...base, worldVer: 'seongsu', floorLabel: '13F 몬스터 룸' }), 'HAUS 성수 13F 몬스터 룸 · 방위 245° 남서');
  assert.equal(hudLine({ ...base, worldVer: 'ds2', floorLabel: 'B1F 카페', heading: 90 }), 'HAUS 성수 B1F 카페 · 방위 90° 동');
  // 없는 값(온도 · 바람)은 없다
  assert.doesNotMatch(hudLine({ ...base, worldVer: 'seongsu' }), /°C|℃|m\/s|바람|기온/);
});

test('(g) 방위 띠 자리: 시선 가운데 0.5, ±60° 가 양 끝, 북을 넘어 돌아도 이어진다', () => {
  assert.equal(compassX(90, 90), 0.5);
  assert.equal(compassX(150, 90), 1);
  assert.equal(compassX(30, 90), 0);
  assert.ok(Math.abs(compassX(10, 350) - (0.5 + 20 / 120)) < 1e-9, '350° 에서 10° 는 오른쪽 20°');
  assert.ok(Math.abs(compassX(340, 10) - (0.5 - 30 / 120)) < 1e-9, '10° 에서 340° 는 왼쪽 30°');
  assert.equal(compassX(0, 180), 0.5 - 180 / 120, '뒤쪽은 범위 밖 값(−1 … 2) 그대로');
});

test('(h) 건물 표시: 카메라 → 건물 수평 방위 · 거리(m 정수) — 시선 ±60° 밖은 숨김(x null), 글은 가운데 쪽으로 뻗는다', () => {
  const cam = { x: 0, z: 100 };
  // 북쪽(−z)을 보면 원점 건물은 정면 100 m
  assert.deepEqual(compassMarker(cam, { x: 0, z: 0 }, 0), { x: 0.5, dist: 100, align: 'start' });
  // 동쪽(+x)을 보면 원점 건물은 왼쪽 90° — 범위 밖
  assert.equal(compassMarker(cam, { x: 0, z: 0 }, 90).x, null);
  assert.equal(compassMarker(cam, { x: 0, z: 0 }, 90).dist, 100);
  // 오른쪽 45°(북동) 건물: x = 0.5 + 45/120, 오른쪽 반이면 글은 왼쪽으로(end)
  const ne = compassMarker(cam, { x: 50, z: 50 }, 0);
  assert.ok(Math.abs(ne.x - (0.5 + 45 / 120)) < 1e-9);
  assert.equal(ne.dist, 71);
  assert.equal(ne.align, 'end');
  const nw = compassMarker(cam, { x: -50, z: 50 }, 0);
  assert.equal(nw.align, 'start');
  // 정확히 ±60° 는 보이고, 그 밖은 숨김
  const t60 = Math.tan((60 * Math.PI) / 180);
  assert.ok(Math.abs(compassMarker(cam, { x: 100 * t60, z: 0 }, 0).x - 1) < 1e-9);
  assert.equal(compassMarker(cam, { x: 100 * Math.tan((61 * Math.PI) / 180), z: 0 }, 0).x, null);
  // 바로 위(수평 거리 0)는 방향이 없어 숨김
  assert.deepEqual(compassMarker({ x: 5, z: 5 }, { x: 5, z: 5 }, 0), { x: null, dist: 0, align: 'start' });
  // 성수 거리 시점(−105, 50.2)에서 HAUS(0, 0) — 방위 약 64°(북동), 116 m
  const street = compassMarker({ x: -105, z: 50.2 }, { x: 0, z: 0 }, 64);
  assert.equal(street.dist, 116);
  assert.ok(Math.abs(street.x - 0.5) < 0.01);
});

test('(i) 방위 띠 눈금: 15° 마다, N · E · S · W 글자, 띠 폭 · 밀기가 compassX 와 같은 자리에 놓는다(북을 넘어도)', () => {
  const ticks = compassTicks();
  const span = COMPASS_SPAN_DEG;
  assert.equal(ticks[0].deg, -span / 2);
  assert.equal(ticks.at(-1).deg, 360 + span / 2);
  assert.ok(ticks.every((t, i) => i === 0 || t.deg - ticks[i - 1].deg === COMPASS_TICK_DEG));
  const label = (d) => ticks.find((t) => t.deg === d).label;
  assert.equal(label(0), 'N');
  assert.equal(label(90), 'E');
  assert.equal(label(180), 'S');
  assert.equal(label(270), 'W');
  assert.equal(label(360), 'N');
  assert.equal(label(-60), '');
  assert.equal(label(-30), '');
  assert.equal(label(15), '');
  assert.equal(label(45), '');
  assert.equal(compassStripWidthPct(), ((360 + span) / span) * 100);
  // 띠 위 자리 = (눈금 pct + 밀기 pct) × 띠 폭 / 100 / 창 폭 — 시선 안 눈금은 compassX 와 같다
  const W = compassStripWidthPct() / 100;
  for (const heading of [0, 7, 90, 245, 359]) {
    let shown = 0;
    for (const t of ticks) {
      const x = ((t.pct + compassShiftPct(heading)) / 100) * W;
      const rel = t.deg - heading;
      if (rel < -span / 2 || rel > span / 2) continue;
      shown += 1;
      assert.ok(Math.abs(x - compassX(t.deg, heading)) < 1e-9, `heading ${heading} · 눈금 ${t.deg}`);
    }
    assert.ok(shown >= span / COMPASS_TICK_DEG, `heading ${heading}: 보이는 눈금 ${shown}`);
  }
});

test('(j) H 키(hudKeyAction): H · h · 한글 입력 상태(KeyH) → 켜고 끄기. ⌘ · Ctrl · Alt · 입력 칸 · 반복 · 막힘 · 앞 처리기가 받은 키 · 다른 키는 그대로', () => {
  const k = (o) => hudKeyAction({ blocked: false, ...o });
  assert.equal(k({ key: 'h', code: 'KeyH' }), 'toggle');
  assert.equal(k({ key: 'H', code: 'KeyH' }), 'toggle');
  assert.equal(k({ key: 'ㅗ', code: 'KeyH' }), 'toggle', '한글 입력 상태');
  // 라틴 글자면 글자로 본다: 드보락 KeyH 자리는 d — 켜고 끄지 않음, 드보락 h(KeyJ 자리)는 켜고 끔
  assert.equal(k({ key: 'd', code: 'KeyH' }), null, '드보락 KeyH = d');
  assert.equal(k({ key: 'D', code: 'KeyH' }), null);
  assert.equal(k({ key: 'h', code: 'KeyJ' }), 'toggle', '드보락 h');
  assert.equal(k({ key: 'ㅓ', code: 'KeyJ' }), null, '한글 입력 상태의 다른 자리');
  for (const mod of ['metaKey', 'ctrlKey', 'altKey']) assert.equal(k({ key: 'h', code: 'KeyH', [mod]: true }), null, mod);
  assert.equal(k({ key: 'h', code: 'KeyH', typing: true }), null);
  assert.equal(k({ key: 'h', code: 'KeyH', repeat: true }), null);
  assert.equal(k({ key: 'h', code: 'KeyH', blocked: true }), null);
  assert.equal(k({ key: 'h', code: 'KeyH', defaultPrevented: true }), null);
  assert.equal(k({ key: 'l', code: 'KeyL' }), null);
  assert.equal(k({ key: 'v', code: 'KeyV' }), null);
});

// ── DOM: 작은 가짜 문서(만든 노드 · 글자 쓰기 횟수만 센다) ──
function fakeDom() {
  const writes = { text: 0, style: 0 };
  const node = (tag) => {
    const cls = new Set();
    let text = '';
    const style = new Proxy({ setProperty(k, v) { this[k] = v; } }, {
      set(o, k, v) {
        if (o[k] !== v) writes.style += 1;
        o[k] = v;
        return true;
      },
    });
    const n = {
      tag,
      children: [],
      hidden: false,
      dataset: {},
      attrs: {},
      style,
      get className() { return [...cls].join(' '); },
      set className(v) { cls.clear(); String(v).split(/\s+/).filter(Boolean).forEach((c) => cls.add(c)); },
      get textContent() { return text; },
      set textContent(v) { writes.text += 1; text = String(v); },
      append(...c) { n.children.push(...c); },
      setAttribute(k, v) { n.attrs[k] = String(v); },
      rect: { bottom: 0, height: 0 },
      getBoundingClientRect() { return n.rect; },
      classList: {
        add: (c) => cls.add(c),
        remove: (c) => cls.delete(c),
        toggle: (c, on) => ((on ?? !cls.has(c)) ? cls.add(c) : cls.delete(c)),
        contains: (c) => cls.has(c),
      },
    };
    return n;
  };
  const body = node('body');
  return { writes, node, document: { createElement: node, body, documentElement: node('html') } };
}
const all = (n) => [n, ...n.children.flatMap(all)];

test('(k) DOM(createHud): 켜져 있으면 kicker 를 살아 있는 줄로(is-live), 1 초 10 번만 · 바뀐 글자만 쓴다. 끄면 원래 문구 · 띠 숨김, 켜면 바로 다시', () => {
  const dom = fakeDom();
  globalThis.document = dom.document;
  try {
    const kicker = dom.node('div');
    kicker.textContent = '37.544°N 127.056°E · SEONGSU 2041';
    let view = { x: 0, y: 1.7, z: 100, dx: 0, dz: -1 };   // 북쪽을 본다
    let floor = null;
    const hud = createHud({
      kickerEl: kicker,
      worldVer: 'seongsu',
      buildings: [{ name: 'HAUS', x: 0, z: 0 }, { name: 'FaceArch', x: 105, z: -15 }],
      getView: () => view,
      getFloorLabel: () => floor,
      getHour: () => 14,
      getWeatherLabel: () => '맑음',
    });
    const band = hud.element;
    assert.ok(dom.document.body.children.includes(band), '띠는 body 에');
    assert.equal(band.className, 'nw-compass');
    assert.equal(band.attrs['aria-hidden'], 'true');
    assert.equal(hud.isOn(), true, '기본 켜짐');
    assert.equal(kicker.classList.contains('is-live'), true);

    hud.update(1000);
    assert.match(kicker.textContent, /^37\.5431°N 127\.0560°E · 고도 2 m · 방위 0° 북 · 14:00 맑음$/);
    const marks = all(band).filter((n) => /nw-compass-mark/.test(n.className));
    assert.equal(marks.length, 2);
    assert.equal(marks[0].hidden, false, 'HAUS 정면');
    assert.equal(marks[0].style.left, '50%');
    assert.ok(all(marks[0]).some((n) => n.textContent === 'HAUS'));
    assert.ok(all(marks[0]).some((n) => n.textContent === '100 m'));
    // FaceArch(105, −15): 방위 약 42° — 범위 안 오른쪽, 글은 왼쪽으로
    assert.equal(marks[1].hidden, false);
    assert.equal(marks[1].classList.contains('is-end'), true);

    // 100 ms 안의 다시 부름은 아무것도 쓰지 않는다
    const w0 = { ...dom.writes };
    view = { ...view, dx: 1, dz: 0 };
    hud.update(1050);
    assert.deepEqual(dom.writes, w0);
    // 그대로인 값이면 100 ms 뒤에도 쓰지 않는다
    view = { ...view, dx: 0, dz: -1 };
    hud.update(1100);
    assert.deepEqual(dom.writes, w0, '바뀐 것이 없으면 DOM 쓰기 0');
    // 동쪽을 보면 줄 · 띠 밀기 · 건물 자리가 바뀐다(HAUS 는 범위 밖 숨김)
    view = { ...view, dx: 1, dz: 0 };
    hud.update(1200);
    assert.match(kicker.textContent, / · 방위 90° 동 · /);
    assert.equal(marks[0].hidden, true);
    // 바로 아래를 보면 방위는 이전 값 그대로
    view = { ...view, dx: 0, dz: 0 };
    hud.update(1300);
    assert.match(kicker.textContent, / · 방위 90° 동 · /);

    // 실내: 층 이름 · 방위만(띠는 CSS 로 숨김 — 실내에서는 띠를 갱신하지 않는다)
    floor = '13F 몬스터 룸';
    view = { ...view, dx: 0, dz: -1 };
    const ws = dom.writes.style;
    hud.update(1400);
    assert.equal(kicker.textContent, 'HAUS 성수 13F 몬스터 룸 · 방위 0° 북');
    assert.equal(dom.writes.style, ws, '실내에서는 띠 DOM 을 건드리지 않는다');

    // 끄기: 원래 문구 · is-live 해제 · 띠 숨김, 꺼진 동안은 갱신하지 않는다
    hud.toggle();
    assert.equal(hud.isOn(), false);
    assert.equal(kicker.textContent, '37.544°N 127.056°E · SEONGSU 2041');
    assert.equal(kicker.classList.contains('is-live'), false);
    assert.equal(band.hidden, true);
    const wOff = { ...dom.writes };
    hud.update(5000);
    assert.deepEqual(dom.writes, wOff);
    // 다시 켜면 기다리지 않고 바로 살아 있는 줄
    floor = null;
    hud.toggle();
    assert.equal(hud.isOn(), true);
    assert.equal(band.hidden, false);
    assert.equal(kicker.classList.contains('is-live'), true);
    assert.match(kicker.textContent, /^37\.5431°N 127\.0560°E · /);
  } finally {
    delete globalThis.document;
  }
});

test('(k2) 위 막대 · 띠 아래 끝 재기(ResizeObserver — 크기가 바뀔 때만): 띠에 --nw-topbar-bottom, :root 에 --nw-top-hud-bottom(띠가 숨으면 위 막대만). body 에 붙이면 재지 않는다', () => {
  const dom = fakeDom();
  const observers = [];
  globalThis.document = dom.document;
  globalThis.ResizeObserver = class {
    constructor(cb) { this.cb = cb; this.targets = []; observers.push(this); }
    observe(t) { this.targets.push(t); }
  };
  try {
    const opts = { kickerEl: dom.node('div'), worldVer: 'ds2', buildings: [], getView: () => ({ x: 0, y: 0, z: 0, dx: 0, dz: -1 }) };
    createHud(opts);
    assert.equal(observers.length, 0, 'body 에 붙이면(시험 · 위 막대 없음) 재지 않는다');
    const bar = dom.node('header');
    const hud = createHud({ ...opts, mount: bar });
    assert.equal(observers.length, 1);
    assert.deepEqual(observers[0].targets, [bar, hud.element], '위 막대 · 띠 크기를 본다');
    const rootStyle = dom.document.documentElement.style;
    // 721–1599 px: 위 막대(좌표 줄 · 제목 두 줄) 아래 끝 110, 띠는 그 아래 118 … 164
    bar.rect = { bottom: 110.4, height: 92 };
    hud.element.rect = { bottom: 164, height: 46 };
    observers[0].cb([]);
    assert.equal(hud.element.style['--nw-topbar-bottom'], '110px');
    assert.equal(rootStyle['--nw-top-hud-bottom'], '164px');
    // 1600 px 이상: 띠가 위 막대 줄 안(18 … 64) — 아래 끝은 위 막대(브랜드 76)
    bar.rect = { bottom: 76, height: 58 };
    hud.element.rect = { bottom: 64, height: 46 };
    observers[0].cb([]);
    assert.equal(rootStyle['--nw-top-hud-bottom'], '76px');
    // 띠가 숨으면(H 끄기 · 실내) 크기 0 — 위 막대만
    bar.rect = { bottom: 110, height: 92 };
    hud.element.rect = { bottom: 0, height: 0 };
    observers[0].cb([]);
    assert.equal(rootStyle['--nw-top-hud-bottom'], '110px');
  } finally {
    delete globalThis.document;
    delete globalThis.ResizeObserver;
  }
});

test('(l) 연결: main.js 가 HUD 를 만들고(브랜드 kicker · 월드 · 건물 자리 · 시선 · 실내 층 · 시각 · 독 기상 글자) 매 프레임 update, H 키는 hudKeyAction(입력 칸 · 막힘)', () => {
  const main = readSrc('main.js');
  assert.match(main, /import \{[^}]*createHud[^}]*\} from '\.\/hud\.js'/);
  const make = main.match(/const hud = createHud\(\{[\s\S]*?\n  \}\);/);
  assert.ok(make, 'createHud 호출 없음');
  for (const re of [/kickerEl: brandKickerEl/, /mount: document\.querySelector\('\.nw-topbar'\)/, /worldVer/, /world\.layout\.buildings/, /getWorldDirection/, /currentFloorDef\(\)/, /weather\.getHour\(\)/, /weather\.getWeather\(\)/]) {
    assert.match(make[0], re);
  }
  // 독의 기상 글자를 그대로 쓴다(새 이름을 짓지 않는다)
  assert.match(main, /querySelectorAll\('\[data-weather\]'\)\][\s\S]{0,80}textContent/);
  // 원래 kicker 문구는 월드에 맞게 바꾼 뒤에 HUD 가 읽는다(DS2 문구 복원)
  assert.ok(main.indexOf("brandKickerEl.textContent = 'HIGHLAND BASIN") < main.indexOf('createHud('));
  assert.match(main, /hud\.update\(/);
  assert.match(main, /hudKeyAction\(\{[\s\S]*?typing[\s\S]*?blocked: hudBlocked\(\)/);
  const blocked = main.match(/const hudBlocked = \(\) =>[^\n]*/);
  assert.ok(blocked, 'hudBlocked 없음');
  for (const re of [/modal\.isOpen\(\)/, /help\.isOpen\(\)/, /showcase\.isActive\(\)/, /showcase\.isBusy\(\)/, /hub\.isOpen\(\)/, /cinema\.isActive\(\)/, /isIntroActive\(\)/, /is-choosing/]) {
    assert.match(blocked[0], re);
  }
  assert.match(main, /hud\.toggle\(\)/);
  assert.match(main, /\n    hud,\n/, '__NW_APP.hud');
});

test('(m) CSS: 방위 띠는 위 가운데(폭 변수 — hud.js 상수), 외관에서만(실내 · 인트로 · 방식 고르기 · 감상 · 사진 모드에서 숨김), 휴대폰은 220 px · 건물 이름 생략, 살아 있는 줄은 대문자 바꿈 없음', () => {
  const css = readSrc('nowhere.css');
  assert.match(css, /\.nw-compass \{[^}]*position: fixed;[^}]*left: 50%;[^}]*width: var\(--nw-compass-w\)/);
  assert.match(css, /\.nw-compass\[hidden\] \{\s*display: none;/);
  for (const state of ['is-interior', 'is-cinema', 'is-choosing', 'is-showcase', 'is-photo']) {
    assert.match(css, new RegExp(`body\\.${state} \\.nw-compass[,\\s{]`), `${state} 에서 띠 숨김 없음`);
  }
  const phone = [...css.matchAll(/@media \(max-width: 720px\) \{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n');
  assert.match(phone, /\.nw-compass \{[^}]*position: relative;[^}]*width: var\(--nw-compass-w-phone\)/, '휴대폰은 위 막대 세로 줄의 마지막 칸');
  assert.match(phone, /\.nw-compass-name \{\s*display: none;/);
  assert.match(css, /\.nw-brand-kicker\.is-live \{[^}]*text-transform: none;/);
  // 721–1599 px(사진 버튼이 들어가 오른쪽 버튼 줄이 약 600 px — 1600 px 부터 한 줄): 고정 높이가 아니라 위 막대 실제 아래 끝(hud.js 가 잼) 아래 — 보행 안내(66–90 px) 아래 96 px 보다 위로는 오지 않는다
  const mid = css.match(/@media \(min-width: 721px\) and \(max-width: 1639px\) \{([\s\S]*?)\n\}/);
  assert.ok(mid, '721–1599 px 배치 없음');
  assert.match(mid[1], /\.nw-compass \{\s*top: max\(96px, calc\(var\(--nw-topbar-bottom, 76px\) \+ 8px\)\);/);
});

test('(m2) 건물 이름표: 올려다볼 때 위 끝에서 잘리지 않게 — 세로도 가로처럼 밀어 넣는다(위 막대 · 방위 띠 아래 끝 + 8 px, --sy = 이름표 화면 y)', () => {
  const css = readSrc('nowhere.css');
  const tag = css.match(/\.nw-archive-tag \{([\s\S]*?)\n\}/);
  assert.ok(tag);
  assert.match(tag[1], /translate: clamp\(calc\(8px - var\(--sx, 50vw\)\), -50%, calc\(100vw - 8px - var\(--sx, 50vw\) - 100%\)\) max\(-100%, calc\(var\(--nw-top-hud-bottom, 0px\) \+ 8px - var\(--sy, 50vh\)\)\);/);
  const card = readSrc('archive-card.js');
  assert.match(card, /setProperty\('--sx', `\$\{sx\}px`\);[^\n]*\n\s*t\.btn\.style\.setProperty\('--sy', `\$\{sy\}px`\);/);
});

test('(n) 조작 안내 · README: 공통에 H 줄(짧게 — 1600 × 900 첫 화면), README 표에 H 줄', () => {
  const common = CONTROL_SECTIONS.find((s) => s.id === 'common');
  const row = common.rows.find((r) => r.keys.includes('H'));
  assert.ok(row, '공통에 H 줄 없음');
  assert.deepEqual(row.keys, ['H']);
  assert.match(row.desc, /현장 정보/);
  assert.match(row.desc, /방위 띠/);
  assert.match(row.desc, /켜기 \/ 끄기/);
  assert.ok(row.desc.length <= 60, `H 줄이 길다(${row.desc.length}자)`);
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  const line = readme.split('\n').find((r) => r.startsWith('| `H`'));
  assert.ok(line, 'README H 줄 없음');
  for (const re of [/37\.5441°N 127\.0563°E · 고도 12 m · 방위 245° 남서 · 14:00 맑음/, /X −60 · Z 20/, /HAUS 성수/, /±60°/, /15°/, /◆/]) assert.match(line, re);
});
