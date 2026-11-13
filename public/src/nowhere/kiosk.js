// HAUS NOWHERE — 발표 모드(?kiosk=1 · K 키 — 테스트: tests/nowhere-kiosk.test.mjs). 로비 화면 · 전시용 자동 순환.
// 순서(한 월드): ① 외관 카메라 프리셋을 layout 순서대로 KIOSK_SHOT_S 초씩(프리셋 이동은 기존 전환) → ② 실내로 들어가 네 층을 기본 층부터
// 차례로 「이 층 둘러보기」(끝나면 다음 층) → ③ 밖으로(한 컷 머묾) → ④ 반대 월드 페이지로 ?kiosk=1(인트로부터 — 새 페이지가 이어 간다).
// 실내에서 K 로 시작하면 지금 층부터 ② → ③ → ④. 화면 아래 가운데 작은 칩 「발표 모드 · 아무 키나 누르면 멈춥니다」.
// 아무 키 · 클릭 · 터치 · 휠이면 멈추고 그 자리에서 자유 시점, 칩은 「발표 모드를 멈췄습니다」 KIOSK_STOPPED_MS 뒤 사라짐, 주소의 kiosk · kioskShot 은 지운다(replaceState).
// 멈추게 한 입력은 뒤 처리기로 보내지 않는다(창 캡처 첫 처리기 — main.js 가 사진 모드 · 조작 안내 · 목록 · 카드보다 먼저 만든다):
//   키는 그 키의 동작(V 보행 · ? 안내 · L 목록 · Esc …)이 함께 일어나지 않게, 누름은 그 뒤 click 까지 삼켜 건물 카드 · 스팟 · 버튼이 열리지 않게.
//   ⌘ · Ctrl 조합(스크린샷 · 탭 전환)과 보조 키만 누른 것(Shift · Alt …)은 멈추지 않는다(층 둘러보기와 같이 — Shift + ? 는 ? 가 멈추고 삼켜진다).
// 순수 계산은 위쪽, DOM 은 createKiosk 를 부를 때만 만든다(모듈을 import 할 때 document 를 건드리지 않는다). three 는 쓰지 않는다.
import { worldSwitchUrl } from './entry.js';

// ── 조정값(한곳) ──
export const KIOSK_SHOT_S = 10;            // 외관 프리셋 한 컷(초) — 밖으로 나온 뒤 한 컷도 같은 값
export const KIOSK_SHOT_MIN_S = 1;         // 시험용 주소 kioskShot=<초> 범위(정수) — 순환을 짧게 확인할 때
export const KIOSK_SHOT_MAX_S = 60;
export const KIOSK_STOPPED_MS = 2000;      // 「발표 모드를 멈췄습니다」 보이는 시간
export const KIOSK_CHIP_GAP_PX = 8;        // 칩과 독 묶음 · 실내 자막 사이 여유(겹치면 그 위로 이만큼 띄움)
export const KIOSK_CHIP_EDGE_PX = 18;      // 독이 없을 때 칩 아래 끝(데스크톱 독 bottom 과 같은 값)
export const KIOSK_TEXT = {
  running: '발표 모드 · 아무 키나 누르면 멈춥니다',
  stopped: '발표 모드를 멈췄습니다',
};
export const KIOSK_PARAMS = ['kiosk', 'kioskShot'];   // 멈추면 주소에서 지우는 값

const getParam = (params, key) => (params && typeof params.get === 'function' ? params.get(key) : null) || '';

/** 주소 → { on: kiosk=1 인지, shotS: 컷 길이(초 — kioskShot 이 1–60 정수일 때만, 아니면 KIOSK_SHOT_S) } */
export function parseKioskParams(params) {
  const raw = getParam(params, 'kioskShot');
  const n = /^[1-9]\d*$/.test(raw) ? Number(raw) : NaN;
  return {
    on: getParam(params, 'kiosk') === '1',
    shotS: n >= KIOSK_SHOT_MIN_S && n <= KIOSK_SHOT_MAX_S ? n : KIOSK_SHOT_S,
  };
}

/** 둘러볼 층 순서(inner-layout): firstId(실내에서 시작하면 지금 층) → 없으면 defaultFloor → 없으면 첫 층부터, 나머지는 floors 순서 그대로 */
export function kioskFloorOrder(layout, firstId = null) {
  const ids = (layout?.floors || []).map((f) => f.id);
  const first = ids.includes(firstId) ? firstId : ids.includes(layout?.defaultFloor) ? layout.defaultFloor : ids[0];
  return first === undefined ? [] : [first, ...ids.filter((id) => id !== first)];
}

/**
 * 순서 상태 기계(순수). step: null(시작) | { kind: 'preset', i, id } | { kind: 'enter' } | { kind: 'floor', i, id } | { kind: 'exit' } | { kind: 'switch' },
 * result: 그 단계 결과 'done' | 'failed' | 'stopped', plan: { presets: 프리셋 id(layout 순서), floors: 층 id(kioskFloorOrder), inside: 실내에서 시작했는지 }.
 * 다음 단계(끝이면 null)를 돌려준다. 멈춤 → 끝. 실내를 못 열면 → 반대 월드, 층을 못 열면 → 밖으로. 층 목록이 없으면(inner-layout 을 못 받음) 실내를 건너뛴다.
 */
export function nextKioskStep(step, result, { presets = [], floors = [], inside = false } = {}) {
  const preset = (i) => (i < presets.length ? { kind: 'preset', i, id: presets[i] } : afterPresets());
  const floor = (i) => (i < floors.length ? { kind: 'floor', i, id: floors[i] } : { kind: 'exit' });
  const afterPresets = () => (floors.length ? { kind: 'enter' } : { kind: 'switch' });
  if (!step) return inside ? floor(0) : preset(0);
  if (result === 'stopped') return null;
  switch (step.kind) {
    case 'preset':
      return preset(step.i + 1);
    case 'enter':
      return result === 'failed' ? { kind: 'switch' } : floor(0);
    case 'floor':
      return result === 'failed' ? { kind: 'exit' } : floor(step.i + 1);
    case 'exit':
      return { kind: 'switch' };
    default:
      return null;
  }
}

/** ④ 반대 월드 주소: 위 막대 월드 버튼과 같은 주소(entry.js worldSwitchUrl — 경로 규칙 · 인트로를 막는 값 지움) + mode=free + kiosk=1(시험용 kioskShot 은 그대로) */
export function kioskSwitchUrl({ pathname, search, targetVer }) {
  const url = worldSwitchUrl({ pathname, search, targetVer, mode: 'free' });
  const q = url.indexOf('?');
  const next = new URLSearchParams(q < 0 ? '' : url.slice(q + 1));
  next.set('kiosk', '1');
  return `${q < 0 ? url : url.slice(0, q)}?${next.toString()}`;
}

/** 멈춘 뒤 주소: kiosk · kioskShot 만 지운다(다른 값 · # 그대로) — 새로 고쳐도 다시 돌지 않게 */
export function kioskStopUrl({ pathname, search = '', hash = '' }) {
  const next = new URLSearchParams(search);
  for (const k of KIOSK_PARAMS) next.delete(k);
  const q = next.toString();
  return `${pathname}${q ? `?${q}` : ''}${hash || ''}`;
}

// 보조 키만 누른 것은 입력으로 보지 않는다 — Shift + ? 처럼 조합으로 누를 때 Shift 가 먼저 멈추고 ? 가 제 동작(조작 안내)까지 하지 않게(다음 키가 멈추고 삼켜진다)
const MODIFIER_KEYS = new Set(['Shift', 'Alt', 'AltGraph', 'Control', 'Meta', 'CapsLock', 'Fn']);

/** K 인가: 라틴 글자면 글자(k · K — 드보락 등 배열 그대로), 아니면 자리(KeyK — 한글 입력 상태) */
const isK = (key, code) => (/^[a-z]$/i.test(key) ? key === 'k' || key === 'K' : code === 'KeyK');

/**
 * 키 하나를 어떻게 다룰지(순수): null(그대로 둔다) · 'start' · 'stop' · 'swallow'(막기만).
 * 멈춰 있으면 K 만 본다(⌘ · Ctrl · Alt · 입력 칸 · 반복 · 막힘 · 앞 처리기가 받은 키면 그대로).
 * 도는 중에는 아무 키나 'stop' — ⌘ · Ctrl 조합은 그대로(스크린샷 · 탭 전환), 보조 키(Shift · Alt …)만 누른 것은 'swallow'(멈추지 않고 뒤로도 안 감 — 조합의 다음 키가 멈춘다),
 * 누르고 있던 키의 반복은 'swallow'(K 를 누른 채 시작해도 곧바로 멈추지 않게)
 */
export function kioskKeyAction({ key, code = '', running, blocked = false, typing = false, repeat = false, defaultPrevented = false, metaKey = false, ctrlKey = false, altKey = false }) {
  if (running) {
    if (metaKey || ctrlKey) return null;
    // 보조 키(Shift · Alt · CapsLock …)만 누른 것은 멈추지 않되 뒤로도 보내지 않는다 — 실내 둘러보기 · 비행 처리기가 받으면 층 둘러보기가 끊긴다
    if (MODIFIER_KEYS.has(key)) return 'swallow';
    return repeat ? 'swallow' : 'stop';
  }
  if (defaultPrevented || blocked || typing || repeat || metaKey || ctrlKey || altKey) return null;
  return isK(key, code) ? 'start' : null;
}

/**
 * 칩 아래 끝(px, 화면 아래에서): 가운데 놓인 칩(chipW × chipH)이 가리면 안 되는 상자(boxes — 하단 독 묶음 · 실내 둘러보기 자막, 화면 좌표 사각형,
 * 숨은 것은 크기 0)와 겹치지 않는 가장 낮은 자리. 먼저 독 줄 아래 끝(base — 데스크톱 넓은 화면은 기상 · 카메라 묶음 사이 빈 자리),
 * 겹치면 상자 위 + gap 자리들을 낮은 것부터(휴대폰 · 좁은 화면은 독 위, 휴대폰 실내는 자막 위). 겹침은 사방 gap 여유로 본다.
 */
export function kioskChipBottom({ viewW, viewH, chipW, chipH, boxes = [], base = KIOSK_CHIP_EDGE_PX, gap = KIOSK_CHIP_GAP_PX }) {
  const shown = boxes.filter((b) => b.right > b.left && b.bottom > b.top);
  const left = (viewW - chipW) / 2 - gap;
  const right = (viewW + chipW) / 2 + gap;
  const hits = (bottom) => {
    const top = viewH - bottom - chipH - gap;
    const low = viewH - bottom + gap;
    return shown.some((b) => b.left < right && b.right > left && b.top < low && b.bottom > top);
  };
  const spots = [base, ...shown.map((b) => Math.round(viewH - b.top + gap)).sort((a, b) => a - b)];
  return spots.find((b) => !hits(b)) ?? spots.at(-1);
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

const isTyping = (t) => Boolean(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable));

/**
 * 발표 모드 실행기. main.js 가 넘기는 것:
 * shotS(컷 길이 초), getPresets() → 프리셋 id(layout 순서), loadFloors(firstId) → 층 id(kioskFloorOrder — 실내에서 시작하면 firstId = 지금 층),
 * isInside() · currentFloor(), showPreset(id)(프리셋 버튼과 같은 이동), enter() → 성공 여부, goToFloor(id) → 성공 여부,
 * playTour() → 이 층 둘러보기 끝 약속('done' | 'stopped' — 둘러볼 것이 없으면 null: 한 컷 머묾), exit(), switchWorld()(반대 월드로 — kioskSwitchUrl),
 * isBlocked() → K 로 시작하지 않음, onStart()(시작: 카드 닫기 · 자유 시점), onStop()(멈춤: 둘러보기 · 비행 · 프리셋 전환을 그 자리에서),
 * onSettle()(멈춘 뒤 진행 중이던 실내 들어가기 · 층 이동이 끝났을 때 — 그 자리 자유 시점), replaceUrl(url) · location(멈춘 뒤 주소),
 * win(키 · 누름 처리기를 다는 창), getObstacles()(칩이 가리면 안 되는 하단 독 묶음 · 실내 자막), getDock()(독 — 칩의 기본 아래 끝).
 * 키 · 누름 처리기는 만들 때 창 캡처 단계에 등록한다 — 다른 캡처 처리기보다 먼저 만들 것(main.js).
 */
export function createKiosk({
  shotS = KIOSK_SHOT_S,
  getPresets,
  loadFloors,
  isInside = () => false,
  currentFloor = () => null,
  showPreset,
  enter,
  goToFloor,
  playTour,
  exit,
  switchWorld,
  isBlocked = () => false,
  onStart = null,
  onStop = null,
  onSettle = null,
  replaceUrl = (url) => globalThis.history?.replaceState(globalThis.history.state, '', url),
  location = globalThis.location,
  win = globalThis.window,
  getObstacles = () => [...document.querySelectorAll('.nw-dock-group, .nw-interior-caption')],
  getDock = () => document.querySelector('.nw-dock'),
}) {
  const shotMs = shotS * 1000;
  const chip = el('div', 'nw-kiosk', KIOSK_TEXT.running);
  chip.id = 'nw-kiosk';
  chip.hidden = true;
  chip.setAttribute('role', 'status');
  chip.setAttribute('aria-live', 'polite');
  document.body.append(chip);

  let running = false;
  let token = 0;
  let pending = null;       // 컷 기다림 { timer, resolve } — 멈추면 바로 푼다
  let chipTimer = null;
  let swallowClick = false; // 누름으로 멈췄으면 그 누름이 만든 click 까지 삼킨다

  // 칩 자리(kioskChipBottom): 보일 때 · 창 크기 · 독 묶음 · 자막 크기(실내에서 카메라 묶음 숨김, 둘러보기 자막 보이기 · 숨기기 등)가 바뀔 때만 잰다.
  // 실내 자막은 실내가 만든다(발표 모드보다 뒤) — 보일 때마다 아직 안 보던 상자를 더한다
  let lastBottom = null;
  function placeChip() {
    if (chip.hidden) return;
    const viewH = win.innerHeight;
    const dock = getDock()?.getBoundingClientRect();
    const r = chip.getBoundingClientRect();
    const b = kioskChipBottom({
      viewW: win.innerWidth,
      viewH,
      chipW: r.width,
      chipH: r.height,
      boxes: getObstacles().map((g) => g.getBoundingClientRect()),
      base: dock && dock.height > 0 ? Math.round(viewH - dock.bottom) : KIOSK_CHIP_EDGE_PX,
    });
    if (b === lastBottom) return;
    lastBottom = b;
    chip.style.setProperty('--nw-kiosk-bottom', `${b}px`);
  }
  win.addEventListener('resize', placeChip);
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(placeChip) : null;
  const watched = new Set();
  function watch() {
    if (!ro) return;
    for (const g of [chip, ...getObstacles()]) {
      if (watched.has(g)) continue;
      watched.add(g);
      ro.observe(g);
    }
  }

  function showChip(text, ms = 0) {
    clearTimeout(chipTimer);
    chipTimer = null;
    chip.textContent = text;
    chip.hidden = false;
    watch();
    placeChip();
    if (ms > 0) {
      chipTimer = setTimeout(() => {
        chipTimer = null;
        chip.hidden = true;
      }, ms);
    }
  }

  function wait(ms) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        pending = null;
        resolve('done');
      }, ms);
      pending = { timer, resolve };
    });
  }

  function cancelWait() {
    if (!pending) return;
    clearTimeout(pending.timer);
    pending.resolve('stopped');
    pending = null;
  }

  // 들어가기 · 층 이동이 끝났는데 그사이 멈췄으면 그 자리 자유 시점(onSettle — 실내는 도착하면 보행을 켠다)
  function halted(my) {
    if (my === token) return false;
    if (typeof onSettle === 'function') onSettle();
    return true;
  }

  async function runStep(step, my) {
    switch (step.kind) {
      case 'preset':
        showPreset(step.id);
        return wait(shotMs);
      case 'enter': {
        const ok = await enter();
        if (halted(my)) return 'stopped';
        return ok ? 'done' : 'failed';
      }
      case 'floor': {
        if (currentFloor() !== step.id) {
          const ok = await goToFloor(step.id);
          if (halted(my)) return 'stopped';
          if (!ok) return 'failed';
        }
        const played = playTour();
        if (!played) {
          if (typeof onSettle === 'function') onSettle();   // 둘러보기가 없으면 층 도착 때 켜진 보행이 남는다 — 자유 시점으로 돌려 놓고
          return wait(shotMs);   // 둘러볼 곳이 없는 층은 한 컷만큼 머문다
        }
        await played;
        return 'done';
      }
      case 'exit':
        await exit();
        if (my !== token) return 'stopped';
        return wait(shotMs);
      case 'switch':
        switchWorld();
        return 'done';
      default:
        return 'stopped';
    }
  }

  async function run(my) {
    const inside = Boolean(isInside());
    let floors = [];
    try {
      floors = (await loadFloors(inside ? currentFloor() : null)) || [];
    } catch (err) {
      console.error('[nowhere] 발표 모드: inner-layout 불러오기 실패', err);
    }
    if (my !== token) return;
    const plan = { presets: getPresets() || [], floors, inside };
    let step = nextKioskStep(null, null, plan);
    while (step) {
      const result = await runStep(step, my);
      if (my !== token) return;
      step = nextKioskStep(step, result, plan);
    }
  }

  /** 시작(K · ?kiosk=1 인트로 뒤). 도는 중이거나 막혀 있으면 false */
  function start() {
    if (running || isBlocked()) return false;
    running = true;
    const my = ++token;
    swallowClick = false;
    showChip(KIOSK_TEXT.running);
    if (typeof onStart === 'function') onStart();
    run(my).catch((err) => {
      console.error('[nowhere] 발표 모드 오류', err);
      if (my === token) stop();
    });
    return true;
  }

  /** 멈춤: 순서 · 컷 기다림을 끊고(onStop — 둘러보기 · 비행 · 프리셋 전환을 그 자리에서), 「발표 모드를 멈췄습니다」, 주소에서 kiosk · kioskShot 지우기.
   *  ?kiosk=1 인트로를 입력으로 건너뛴 경우처럼 돌기 전에 불러도 알림 · 주소 정리는 한다 */
  function stop() {
    const was = running;
    running = false;
    token++;
    cancelWait();
    if (was && typeof onStop === 'function') onStop();
    showChip(KIOSK_TEXT.stopped, KIOSK_STOPPED_MS);
    if (location) {
      const here = `${location.pathname}${location.search || ''}${location.hash || ''}`;
      const url = kioskStopUrl(location);
      if (url !== here) replaceUrl(url);
    }
  }

  // ── 입력(창 캡처 · 첫 처리기) ──
  win.addEventListener(
    'keydown',
    (e) => {
      if (!running) swallowClick = false;
      const act = kioskKeyAction({
        key: e.key, code: e.code, running, blocked: !running && Boolean(isBlocked()), typing: isTyping(e.target),
        repeat: e.repeat, defaultPrevented: e.defaultPrevented, metaKey: e.metaKey, ctrlKey: e.ctrlKey, altKey: e.altKey,
      });
      if (!act) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (act === 'start') start();
      else if (act === 'stop') stop();
    },
    true,
  );
  // 클릭 · 터치 · 휠: 도는 중이면 멈추고 그 입력은 뒤(캔버스 OrbitControls · 카드 · 스팟 · 버튼)로 보내지 않는다. 누름이면 이어지는 click 도 삼킨다
  const onPress = (e) => {
    if (!running) {
      if (e.type === 'pointerdown') swallowClick = false;   // 새 누름 — 그 click 은 그대로
      return;
    }
    if (e.type === 'pointerdown' && e.cancelable) e.preventDefault();
    e.stopImmediatePropagation();
    if (e.type !== 'wheel') swallowClick = true;
    stop();
  };
  win.addEventListener('pointerdown', onPress, true);
  // 터치 · 휠은 막지 않아도 된다(페이지는 스크롤하지 않는다) — 수동 처리기로 스크롤 성능을 해치지 않는다
  win.addEventListener('touchstart', onPress, { capture: true, passive: true });
  win.addEventListener('wheel', onPress, { capture: true, passive: true });
  win.addEventListener(
    'click',
    (e) => {
      if (!swallowClick) return;
      swallowClick = false;
      e.preventDefault();
      e.stopImmediatePropagation();
    },
    true,
  );

  return { start, stop, isRunning: () => running, element: chip };
}
