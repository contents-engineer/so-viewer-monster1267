// HAUS NOWHERE — 현장 정보 HUD(H 키로 켜고 끄기, 기본 켜짐 — 테스트: tests/nowhere-hud.test.mjs).
// ① 좌표 줄: 왼쪽 위 브랜드 상자의 작은 글씨(kicker)를 살아 있는 값으로 — 성수는 위경도, 산악(가상 지형)은 장면 좌표, 실내는 층 이름 · 방위만.
// ② 방위 띠: 외관 위 가운데 — 시선 ±60°, 15° 눈금, N · E · S · W, 두 건물 ◆ 이름 · 거리(실내 · 인트로 · 방식 고르기 · 감상 · 사진 모드에서는 CSS 로 숨김).
// 끄면 kicker 는 원래 고정 문구로, 띠는 숨김. DOM 만(그리기 0) — 1 초에 HUD_UPDATE_MS 마다 한 번 계산하고 바뀐 글자 · 자리만 쓴다.
// 좌표 규칙: 북 = −z, 동 = +x(world.js 해 방위 주석과 같음). 위경도는 원점(HAUS 자리, 기존 표기 37.544°N 127.056°E) 기준 등장방형 환산.
// 순수 계산은 위쪽, DOM 은 createHud 를 부를 때만 만든다(모듈을 import 할 때 document 를 건드리지 않는다). three 는 쓰지 않는다(시선은 main.js 가 넘김).
import { clockText } from './weather.js';

// ── 조정값(한곳) ──
export const HUD_ORIGIN = { lat: 37.544, lon: 127.056 };   // 원점(HAUS 자리) 위경도
export const M_PER_DEG_LAT = 111320;                        // 위도 1° = 111 320 m(경도 1° = 이 값 × cos 원점 위도)
export const HUD_UPDATE_MS = 100;                           // 갱신 간격(1 초 10 번)
export const COMPASS_SPAN_DEG = 120;                        // 방위 띠가 보여 주는 범위(시선 ±60°)
export const COMPASS_TICK_DEG = 15;                         // 눈금 간격
export const COMPASS_WIDTH_PX = 320;                        // 띠 폭(CSS --nw-compass-w)
export const COMPASS_WIDTH_PHONE_PX = 220;                  // 휴대폰(≤ 720 px) 띠 폭(CSS --nw-compass-w-phone, 건물 이름 생략)
export const HUD_BUILDINGS = [
  { id: 'haus', name: 'HAUS' },
  { id: 'facearch', name: 'FaceArch' },
];
export const DIR_NAMES_8 = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
export const INTERIOR_PLACE = 'HAUS 성수';                  // 실내 줄 앞 이름(감상 경로 · 목록 자리와 같은 말)

const MINUS = '−';
const CARDINALS = { 0: 'N', 90: 'E', 180: 'S', 270: 'W', 360: 'N' };
const DEG = Math.PI / 180;

/** 장면 (x, z) m → 위경도(원점 기준 등장방형, 북 = −z · 동 = +x) */
export function latLonAt(x, z, origin = HUD_ORIGIN) {
  return {
    lat: origin.lat + -z / M_PER_DEG_LAT,
    lon: origin.lon + x / (M_PER_DEG_LAT * Math.cos(origin.lat * DEG)),
  };
}

/** '37.5441°N 127.0563°E'(소수 넷째 자리) */
export function formatLatLon({ lat, lon }) {
  return `${lat.toFixed(4)}°N ${lon.toFixed(4)}°E`;
}

/** 정수 m 글자 — 음수는 − (U+2212), −0 은 0 */
export function signedInt(v) {
  const n = Math.round(v);
  return n < 0 ? `${MINUS}${-n}` : String(Math.abs(n));
}

/** 시선 수평 방향 (dx, dz) → 방위(북 0° 시계 방향, [0, 360)). 수평 성분이 거의 없으면(바로 위 · 아래) null */
export function bearingDeg(dx, dz) {
  if (Math.hypot(dx, dz) < 1e-6) return null;
  return ((Math.atan2(dx, -dz) / DEG) % 360 + 360) % 360;
}

/** 방위 정수(359.6 → 0) */
export function headingInt(deg) {
  return Math.round(deg) % 360;
}

/** 8방위 한국어(45° 칸, 북 = 337.5 … 22.5) */
export function dirName8(deg) {
  return DIR_NAMES_8[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

/**
 * 좌표 줄 글자.
 * 성수: '37.5441°N 127.0563°E · 고도 12 m · 방위 245° 남서 · 14:00 맑음'
 * 산악(ds2): 'X −60 · Z 20 · 고도 12 m · 방위 245° 남서 · 14:00 흐림'(장면 좌표 m 정수)
 * 실내(floorLabel 있음): 'HAUS 성수 13F 몬스터 룸 · 방위 245° 남서'(층 이름 · 방위만)
 * heading 은 정수 방위, hour 는 기상 컨트롤러 시각(독과 같은 HH:MM), weatherLabel 은 독 기상 버튼 글자.
 */
export function hudLine({ worldVer, floorLabel = null, pos, heading, hour, weatherLabel = '' }) {
  const dir = `방위 ${heading}° ${dirName8(heading)}`;
  if (floorLabel) return `${INTERIOR_PLACE} ${floorLabel} · ${dir}`;
  const place = worldVer === 'ds2' ? `X ${signedInt(pos.x)} · Z ${signedInt(pos.z)}` : formatLatLon(latLonAt(pos.x, pos.z));
  const sky = [clockText(hour), weatherLabel].filter(Boolean).join(' ');
  return `${place} · 고도 ${signedInt(pos.y)} m · ${dir} · ${sky}`;
}

const wrap180 = (a) => ((((a + 180) % 360) + 360) % 360) - 180;

/** 방위 deg 가 띠 위 어디인지(0 = 왼쪽 끝 · 0.5 = 시선 · 1 = 오른쪽 끝). 범위 밖이면 0 … 1 밖 값 그대로 */
export function compassX(deg, heading, span = COMPASS_SPAN_DEG) {
  return 0.5 + wrap180(deg - heading) / span;
}

/**
 * 건물 표시: 카메라 (x, z) · 정수 방위 heading → 건물 (x, z) 의 띠 위 자리 x(시선 ±span/2 밖 · 바로 위면 null) · 수평 거리 dist(m 정수) ·
 * align(글이 뻗는 쪽 — 왼쪽 반 'start' 는 ◆ 오른쪽으로, 오른쪽 반 'end' 는 ◆ 왼쪽으로: 띠 가장자리에서 잘리지 않게 늘 가운데 쪽)
 */
export function compassMarker(cam, target, heading, span = COMPASS_SPAN_DEG) {
  const dx = target.x - cam.x;
  const dz = target.z - cam.z;
  const dist = Math.round(Math.hypot(dx, dz));
  const b = bearingDeg(dx, dz);
  if (b == null) return { x: null, dist, align: 'start' };
  const x = compassX(b, heading, span);
  const inView = x >= -1e-9 && x <= 1 + 1e-9;
  return { x: inView ? x : null, dist, align: inView && x > 0.5 ? 'end' : 'start' };
}

/**
 * 띠 눈금(한 번 만든다): −span/2 … 360 + span/2 를 step 마다 { deg, pct(띠 안 막대에서의 왼쪽 %), label(N · E · S · W, 그 밖 '') }.
 * 막대 폭 = compassStripWidthPct()(창 폭의 %), 시선 방위 h 에서 translateX(compassShiftPct(h) %) 하면 h 가 창 가운데 — 북을 넘어 돌아도 이어진다
 */
export function compassTicks(span = COMPASS_SPAN_DEG, step = COMPASS_TICK_DEG) {
  const ticks = [];
  for (let deg = -span / 2; deg <= 360 + span / 2; deg += step) {
    ticks.push({ deg, pct: ((deg + span / 2) / (360 + span)) * 100, label: CARDINALS[deg] ?? '' });
  }
  return ticks;
}
export function compassStripWidthPct(span = COMPASS_SPAN_DEG) {
  return ((360 + span) / span) * 100;
}
export function compassShiftPct(heading, span = COMPASS_SPAN_DEG) {
  return (-heading / (360 + span)) * 100;
}

/** H 키(순수): 'toggle' 또는 null — 글자가 라틴 문자면 그 글자(h · H)로, 아니면(한글 입력 상태 ㅗ 등) 자리(KeyH)로 본다 — 드보락의 KeyH(d)는 켜고 끄지 않는다.
 *  ⌘ · Ctrl · Alt · 입력 칸 · 키 반복 · 막힘(main.js hudBlocked) · 앞 처리기가 받은 키는 그대로 */
export function hudKeyAction({ key, code = '', typing = false, repeat = false, blocked = false, defaultPrevented = false, metaKey = false, ctrlKey = false, altKey = false }) {
  const isH = /^[a-z]$/i.test(key) ? key === 'h' || key === 'H' : code === 'KeyH';
  if (!isH || typing || repeat || blocked || defaultPrevented || metaKey || ctrlKey || altKey) return null;
  return 'toggle';
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

const pct = (x) => `${Math.round(x * 1000) / 10}%`;

/**
 * HUD 를 만든다. kickerEl = 브랜드 작은 글씨(원래 문구는 만들 때 읽어 두고 끄면 되돌린다 — 월드에 맞게 바꾼 뒤에 만들 것),
 * mount = 띠를 붙일 곳(main.js 는 위 막대 — 휴대폰은 위 막대 세로 줄의 마지막 칸으로 흘러 브랜드 · 버튼 줄 높이가 바뀌어도 겹치지 않는다),
 * buildings = [{ name, x, z }](띠 ◆ — 줄마다 한 건물), getView() → { x, y, z, dx, dz }(카메라 자리 · 시선 방향),
 * getFloorLabel() → 실내 층 이름 | null(외관), getHour() → 시각, getWeatherLabel() → 독 기상 글자.
 * update(now) 를 매 프레임 불러도 HUD_UPDATE_MS 마다 한 번만 계산하고, 글자 · 자리가 바뀐 것만 DOM 에 쓴다.
 */
export function createHud({ kickerEl, mount = document.body, worldVer, buildings = [], getView, getFloorLabel = () => null, getHour = () => 14, getWeatherLabel = () => '' }) {
  const original = kickerEl ? kickerEl.textContent : '';

  const band = el('div', 'nw-compass');
  band.setAttribute('aria-hidden', 'true');   // 같은 정보(방위)는 kicker 글자에 있다
  band.style.setProperty('--nw-compass-w', `${COMPASS_WIDTH_PX}px`);
  band.style.setProperty('--nw-compass-w-phone', `${COMPASS_WIDTH_PHONE_PX}px`);
  const strip = el('div', 'nw-compass-strip');
  strip.style.width = `${compassStripWidthPct()}%`;
  for (const t of compassTicks()) {
    const tick = el('span', t.label ? 'nw-compass-tick is-cardinal' : 'nw-compass-tick', t.label || null);
    tick.style.left = `${t.pct}%`;
    strip.append(tick);
  }
  const center = el('span', 'nw-compass-center');
  const marks = buildings.map((b, i) => {
    const node = el('div', 'nw-compass-mark');
    node.dataset.row = String(i);
    node.hidden = true;
    const dist = el('span', 'nw-compass-dist', '');
    node.append(el('span', 'nw-compass-gem', '◆'), el('span', 'nw-compass-name', b.name), dist);
    return { b, node, dist, x: null, distText: '', end: false, hidden: true };
  });
  band.append(strip, center, ...marks.map((m) => m.node));
  mount.append(band);

  // 위 막대 아래 끝(--nw-topbar-bottom — 721–1639 px 에서 띠를 그 아래에)과 위 막대 · 띠를 합친 아래 끝(:root --nw-top-hud-bottom — 건물 이름표가
  // 올라가는 한계, nowhere.css)을 잰다. 위 막대(좌표 줄이 꺾임 · 창 폭) · 띠(켜고 끄기 · 숨김) 크기가 바뀔 때만 — 매 프레임 읽지 않는다
  if (typeof ResizeObserver === 'function' && mount !== document.body) {
    const measure = () => {
      const barBottom = Math.round(mount.getBoundingClientRect().bottom);
      band.style.setProperty('--nw-topbar-bottom', `${barBottom}px`);
      const r = band.getBoundingClientRect();   // 띠가 위 막대 아래로 옮겨진 뒤의 자리
      document.documentElement.style.setProperty('--nw-top-hud-bottom', `${Math.max(barBottom, r.height ? Math.round(r.bottom) : 0)}px`);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(mount);
    ro.observe(band);
  }

  let on = true;
  let lastAt = -Infinity;
  let heading = 0;
  let lastText = null;
  let lastShift = null;
  if (kickerEl) kickerEl.classList.add('is-live');

  function updateCompass(view) {
    const shift = `translateX(${compassShiftPct(heading)}%)`;
    if (shift !== lastShift) {
      strip.style.transform = shift;
      lastShift = shift;
    }
    for (const m of marks) {
      const r = compassMarker(view, m.b, heading);
      const hidden = r.x == null;
      if (hidden !== m.hidden) {
        m.node.hidden = hidden;
        m.hidden = hidden;
      }
      if (hidden) continue;
      const left = pct(r.x);
      if (left !== m.x) {
        m.node.style.left = left;
        m.x = left;
      }
      const end = r.align === 'end';
      if (end !== m.end) {
        m.node.classList.toggle('is-end', end);
        m.end = end;
      }
      const text = `${r.dist} m`;
      if (text !== m.distText) {
        m.dist.textContent = text;
        m.distText = text;
      }
    }
  }

  function update(now = performance.now()) {
    if (!on || now - lastAt < HUD_UPDATE_MS) return;
    lastAt = now;
    const view = getView();
    const b = bearingDeg(view.dx, view.dz);
    if (b != null) heading = headingInt(b);   // 바로 위 · 아래를 보면 이전 방위 그대로
    const floorLabel = getFloorLabel();
    const text = hudLine({ worldVer, floorLabel, pos: view, heading, hour: getHour(), weatherLabel: getWeatherLabel() });
    if (text !== lastText && kickerEl) {
      kickerEl.textContent = text;
      lastText = text;
    }
    if (!floorLabel) updateCompass(view);   // 실내에서는 띠가 숨어 있다(CSS body.is-interior)
  }

  function setOn(v) {
    on = Boolean(v);
    band.hidden = !on;
    if (kickerEl) kickerEl.classList.toggle('is-live', on);
    if (!on) {
      if (kickerEl) kickerEl.textContent = original;
      lastText = null;
      return;
    }
    lastAt = -Infinity;
    update();
  }

  return { update, toggle: () => setOn(!on), setOn, isOn: () => on, element: band };
}
