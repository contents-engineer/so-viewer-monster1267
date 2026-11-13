// HAUS NOWHERE — 사진 모드(C 키 · 위 막대 「사진」 — 테스트: tests/nowhere-photo.test.mjs).
// 들어가면 모든 화면 요소를 숨기고(body.is-photo — nowhere.css) 아래 가운데 작은 도구 줄만: 화각(20–90°, 지금 값에서 시작) · 저장 · 링크 복사 · 닫기.
// 지금 방식(보행 · 자유 시점)의 조작은 그대로 — 구도를 잡고 찍는다. 사진 화각은 매 프레임 다시 맞추고(다른 동작이 바꾸지 못하게), 닫으면 들어오기 전 값으로.
// 저장: 누른 다음 프레임을 그린 직후(main.js 렌더 루프가 afterRender 를 부른다 — preserveDrawingBuffer 없이 같은 프레임에 읽는다) 캔버스를 PNG 로
//   (캔버스 픽셀 크기 = 화면 크기 × 픽셀 비, 이름 haus-nowhere-<seongsu|ds2>-<YYYYMMDD-HHMMSS>.png).
// 링크 복사(외관만): 지금 월드 페이지 + 같은 자리 주소(entry.js sameSpotUrl — ver · mode=free · at · look) + time(시) · weather · fov(화각, 정수) — 받는 사람은 인트로 없이 그 구도 · 화각 · 기상 · 시각
//   (받는 쪽 main.js 는 parseFovParam 으로 읽어 시작 자유 시점에만 한 번 적용).
//   클립보드를 못 쓰면 주소를 고를 수 있는 글 칸. 실내에서는 버튼 자리에 이유 문구.
// 키는 창 캡처 단계 — main.js 가 조작 안내 · 모달 · 목록 · 건물 카드보다 먼저 만든다: 닫혀 있으면 C 로 열기, 떠 있으면 Esc · C 로 닫기 · V ? L H P K 막기(이동 · 시선 키는 그대로).
// 순수 계산은 위쪽, DOM 은 createPhotoMode 를 부를 때만 만든다(모듈을 import 할 때 document 를 건드리지 않는다).
import { sameSpotUrl, sameSpotLook } from './entry.js';

// ── 조정값(한곳) ──
export const PHOTO_FOV_MIN = 20;              // 화각 슬라이더 범위(°)
export const PHOTO_FOV_MAX = 90;
export const PHOTO_FOV_STEP = 1;              // 슬라이더 한 칸(°)
export const PHOTO_TOAST_MS = 1500;           // 「저장했습니다」 · 「링크를 복사했습니다」 보이는 시간
export const PHOTO_TIME_DECIMALS = 2;         // 링크 time=(시) 소수 자리
export const PHOTO_FILE_PREFIX = 'haus-nowhere';
export const PHOTO_UNLOCK_GRACE_MS = 300;     // 마우스 고정이 막 풀린 직후의 Esc 는 고정 해제로 본다(camera.js · archive-card.js 와 같은 300 ms)
export const PHOTO_REVOKE_MS = 10000;         // 내려받기 주소(object URL)를 푸는 때(큰 PNG 를 느린 기기에서 받아도 넉넉히)
export const PHOTO_TEXT = {
  saved: '저장했습니다',
  copied: '링크를 복사했습니다',
  interior: '실내 자리는 링크로 열 수 없습니다',
  copyManual: '아래 주소를 직접 복사해 주세요',
  saveFailed: '저장하지 못했습니다',
  blocked: '지금은 사진 모드를 열 수 없습니다',
};
// 떠 있는 동안 막는 키: V 보행 전환(화각이 바뀐다) · ? 조작 안내 · L 목록 · H 현장 정보 · P 성능 표시 · K 발표 모드 — 글자로도, 자리로도(한글 입력 상태)
const SWALLOW_KEYS = new Set(['v', 'V', 'l', 'L', 'h', 'H', 'p', 'P', 'k', 'K', '?']);
const SWALLOW_CODES = new Set(['KeyV', 'KeyL', 'KeyH', 'KeyP', 'KeyK']);

/** 화각(°)을 20–90 안으로. 숫자가 아니면 null */
export function clampFov(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(PHOTO_FOV_MAX, Math.max(PHOTO_FOV_MIN, n));
}

const pad2 = (n) => String(n).padStart(2, '0');

/** 'haus-nowhere-<world>-YYYYMMDD-HHMMSS.png'(기기 현지 시각) */
export function photoFileName(worldVer, date) {
  const d = `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;
  const t = `${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`;
  return `${PHOTO_FILE_PREFIX}-${worldVer}-${d}-${t}.png`;
}

/** 링크 time= 값: 시(0–24) 소수 PHOTO_TIME_DECIMALS 자리, 뒤 0 없이('14' · '21.5' · '17.33') — weather.js parseTimeParam 이 읽는 형식 */
export function photoTimeParam(hour) {
  const h = Math.min(24, Math.max(0, Number(hour) || 0));
  return String(Number(h.toFixed(PHOTO_TIME_DECIMALS)));
}

/** 링크 fov= 값: 화각(°)을 20–90 안 정수로('39.76' → '40') */
export function photoFovParam(fov) {
  return String(Math.round(clampFov(fov) ?? PHOTO_FOV_MIN));
}

/** 주소 fov= → 화각(°): 20–90 정수만(앞 0 · 소수 · 부호 · 공백 · 지수 표기는 무시), 아니면 null — parsePose 처럼 이상하면 없는 것으로 */
export function parseFovParam(params) {
  const raw = params && typeof params.get === 'function' ? params.get('fov') : null;
  if (!raw || !/^[1-9]\d*$/.test(raw)) return null;
  const n = Number(raw);
  return n >= PHOTO_FOV_MIN && n <= PHOTO_FOV_MAX ? n : null;
}

/**
 * 사진 링크: origin + 지금 월드 페이지(같은 자리 주소와 같은 경로 규칙) + ver · mode=free · at · look(소수 둘째 자리) + time · weather · fov(정수).
 * 지금 주소의 다른 값(tier · stats · kiosk 등)은 싣지 않는다. 보행이면 시선 목표 = 시선 방향으로 10 m 앞(sameSpotLook)
 */
export function photoLinkUrl({ origin = '', pathname, worldVer, at, target, walking = false, hour, weather, fov }) {
  const look = sameSpotLook(at, target, walking);
  const base = sameSpotUrl({ pathname, search: '', targetVer: worldVer, mode: 'free', at, look });
  const extra = new URLSearchParams({ time: photoTimeParam(hour), weather, fov: photoFovParam(fov) });
  return `${origin}${base}&${extra.toString()}`;
}

/** C 인가: 라틴 글자면 글자(c · C — 드보락 등 배열 그대로), 아니면 자리(KeyC — 한글 입력 상태 · IME 조합) */
const isC = (key, code) => (/^[a-z]$/i.test(key) ? key === 'c' || key === 'C' : code === 'KeyC');

/**
 * 키 하나를 어떻게 다룰지(순수): null(그대로 둔다) · 'open' · 'close' · 'swallow'(막기만).
 * 닫혀 있으면 C 만 본다(⌘ · Ctrl · Alt · 입력 칸 · 반복 · 막힘 · 앞 처리기가 받은 키면 그대로). 닫은 Esc 를 누르고 있는 동안(held)의 반복은 삼킨다.
 * 떠 있으면: Esc = 닫기(입력 칸에서도, 반복은 삼킴 — 마우스 고정 중 · 막 풀린 직후(locked)면 고정 해제만이라 삼킴), C = 닫기(반복은 삼킴),
 * 입력 칸 · ⌘ · Ctrl 조합은 그대로, V · ? · L · H · P · K 는 막기, 그 밖(이동 · 시선 · 버튼 키)은 그대로
 */
export function photoKeyAction({ key, code = '', active, blocked = false, typing = false, held = false, locked = false, repeat = false, defaultPrevented = false, metaKey = false, ctrlKey = false, altKey = false, shiftKey = false }) {
  if (key === 'Escape' && repeat && held) return 'swallow';
  if (!active) {
    if (defaultPrevented || blocked || typing || repeat || metaKey || ctrlKey || altKey) return null;
    return isC(key, code) ? 'open' : null;
  }
  if (key === 'Escape') return locked || repeat ? 'swallow' : 'close';
  if (typing || metaKey || ctrlKey) return null;
  if (isC(key, code)) return altKey ? null : repeat ? 'swallow' : 'close';
  if (SWALLOW_KEYS.has(key) || SWALLOW_CODES.has(code) || (code === 'Slash' && shiftKey)) return 'swallow';
  return null;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function button(cls, text) {
  const b = el('button', cls, text);
  b.type = 'button';
  return b;
}

const isTyping = (t) => Boolean(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable));

/**
 * 사진 모드를 만든다. camera(fov · updateProjectionMatrix) · canvas(toBlob) · worldVer(파일 이름 · 링크).
 * getPose() → { at, target, walking }(카메라 자리 · 시선 목표 · 보행 여부), getHour() · getWeather() → 링크 time · weather.
 * isInterior() → 링크 대신 이유. isBlocked() → 열지 않음(떠 있다가 막히면 닫는다 — update). isPointerLocked() → 보행 마우스 고정.
 * onOpen() → 열 때(main: 스팟 걷기 멈춤). clipboard(기본은 누를 때의 navigator.clipboard) · location · now 는 시험용으로 바꿀 수 있다.
 * 키 처리기는 만들 때 창 캡처 단계에 등록한다 — 다른 캡처 처리기보다 먼저 만들 것(main.js).
 */
export function createPhotoMode({
  camera,
  canvas,
  worldVer,
  getPose,
  getHour,
  getWeather,
  isInterior = () => false,
  isBlocked = () => false,
  isPointerLocked = () => false,
  onOpen = null,
  clipboard = null,   // 없으면 누를 때 navigator.clipboard
  location = globalThis.location,
  now = () => new Date(),
}) {
  // 위 막대 버튼(목록 · 조작 안내 앞 — 세 페이지 모두 JS 로 넣는다)
  const btn = button('nw-btn nw-photo-btn', '사진');
  btn.id = 'nw-btn-photo';
  btn.append(el('span', 'nw-btn-kbd', 'C'));
  btn.setAttribute('aria-controls', 'nw-photo');
  const actions = document.querySelector('.nw-top-actions');
  if (actions) actions.insertBefore(btn, document.getElementById('nw-btn-hub') || document.getElementById('nw-btn-help'));   // 둘 다 없으면 맨 뒤

  // 도구 줄(아래 가운데): 알림 · 링크 글 칸(클립보드를 못 쓸 때) 위에 화각 · 저장 · 링크 복사(실내는 이유) · 닫기
  const root = el('div', 'nw-photo');
  root.id = 'nw-photo';
  root.hidden = true;
  root.setAttribute('role', 'toolbar');
  root.setAttribute('aria-label', '사진 모드');
  const msg = el('p', 'nw-photo-msg');
  msg.hidden = true;
  msg.setAttribute('aria-live', 'polite');
  const urlField = el('input', 'nw-photo-url');
  urlField.type = 'text';
  urlField.readOnly = true;
  urlField.hidden = true;
  urlField.setAttribute('aria-label', '사진 링크 주소');
  const bar = el('div', 'nw-photo-bar');
  const fovWrap = el('label', 'nw-photo-fov');
  const slider = el('input', 'nw-photo-fov-slider');
  slider.type = 'range';
  slider.min = String(PHOTO_FOV_MIN);
  slider.max = String(PHOTO_FOV_MAX);
  slider.step = String(PHOTO_FOV_STEP);
  slider.setAttribute('aria-label', `화각 (${PHOTO_FOV_MIN}–${PHOTO_FOV_MAX}°)`);
  const fovOut = el('output', 'nw-photo-fov-value');
  fovWrap.append(el('span', 'nw-photo-fov-name', '화각'), slider, fovOut);
  const saveBtn = button('nw-btn nw-photo-save', '저장');
  const linkBtn = button('nw-btn nw-photo-link', '링크 복사');
  const note = el('span', 'nw-photo-note', PHOTO_TEXT.interior);
  note.hidden = true;
  const closeBtn = button('nw-btn nw-photo-close', '닫기');
  closeBtn.append(el('span', 'nw-btn-kbd', 'Esc'));
  bar.append(fovWrap, saveBtn, linkBtn, note, closeBtn);
  root.append(msg, urlField, bar);
  document.body.append(root);

  let active = false;
  let savedFov = null;   // 들어오기 전 화각(닫으면 되돌린다)
  let fov = null;        // 사진 화각
  let pendingSave = false;
  let msgTimer = null;
  let escHeld = false;
  let lastUnlockAt = -Infinity;

  function applyFov(v) {
    camera.fov = v;
    camera.updateProjectionMatrix();
  }

  function showFov() {
    const r = Math.round(fov);
    slider.value = String(r);
    fovOut.textContent = `${r}°`;
  }

  function hideMessage() {
    clearTimeout(msgTimer);
    msgTimer = null;
    msg.hidden = true;
  }

  /** 알림 한 줄 — ms 뒤 사라짐(0 이면 닫거나 다음 알림까지) */
  function showMessage(text, ms = PHOTO_TOAST_MS) {
    clearTimeout(msgTimer);
    msgTimer = null;
    msg.textContent = text;
    msg.hidden = false;
    if (ms > 0) msgTimer = setTimeout(hideMessage, ms);
  }

  function open() {
    if (active || isBlocked()) return false;
    active = true;
    savedFov = camera.fov;
    fov = clampFov(camera.fov) ?? PHOTO_FOV_MIN;
    if (fov !== camera.fov) applyFov(fov);
    showFov();
    const inside = Boolean(isInterior());
    linkBtn.hidden = inside;
    note.hidden = !inside;
    hideMessage();
    urlField.hidden = true;
    document.body.classList.add('is-photo');
    root.hidden = false;
    document.activeElement?.blur?.();   // 위 막대 버튼에 남은 포커스(위 막대는 숨는다) — 키는 장면으로
    if (typeof onOpen === 'function') onOpen();
    return true;
  }

  function close() {
    if (!active) return;
    active = false;
    pendingSave = false;   // 그리기 전에 닫으면 찍지 않는다(화각이 되돌아간 프레임을 저장하지 않게)
    applyFov(savedFov);
    savedFov = null;
    document.body.classList.remove('is-photo');
    if (root.contains(document.activeElement)) document.activeElement.blur();
    root.hidden = true;
    hideMessage();
    urlField.hidden = true;
  }

  const toggle = () => (active ? close() : open());

  /** 저장 — 다음 프레임을 그린 직후(afterRender) 캔버스를 읽는다 */
  function save() {
    if (active) pendingSave = true;
  }

  function downloadBlob(blob, name) {
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), PHOTO_REVOKE_MS);
  }

  /** 렌더 루프: 그린 바로 뒤(같은 프레임 — 그리기 버퍼가 아직 지워지지 않았다) */
  function afterRender() {
    if (!pendingSave) return;
    pendingSave = false;
    const name = photoFileName(worldVer, now());
    canvas.toBlob((blob) => {
      if (!blob) {
        showMessage(PHOTO_TEXT.saveFailed);
        return;
      }
      downloadBlob(blob, name);
      showMessage(PHOTO_TEXT.saved);
    }, 'image/png');
  }

  /** 링크 복사(외관만) → 주소(실내 · 닫혀 있으면 null) */
  async function copyLink() {
    if (!active || isInterior()) return null;
    const { at, target, walking } = getPose();
    const url = photoLinkUrl({ origin: location?.origin || '', pathname: location?.pathname || '/', worldVer, at, target, walking, hour: getHour(), weather: getWeather(), fov: camera.fov });
    try {
      const cb = clipboard || globalThis.navigator?.clipboard;
      if (typeof cb?.writeText !== 'function') throw new Error('클립보드 없음');
      await cb.writeText(url);
      if (!active) return url;
      urlField.hidden = true;
      showMessage(PHOTO_TEXT.copied);
    } catch {
      if (!active) return url;
      urlField.value = url;
      urlField.hidden = false;
      showMessage(PHOTO_TEXT.copyManual, 0);
      urlField.focus();
      urlField.select();
    }
    return url;
  }

  // 매 프레임(main 렌더 루프, 카메라 갱신 뒤): 떠 있다가 막히면 닫기, 사진 화각 다시 맞추기, 위 막대 버튼 흐리게(바뀔 때만 DOM)
  let lastBlocked = null;
  function update() {
    const blocked = Boolean(isBlocked());
    if (active && blocked) close();
    else if (active && camera.fov !== fov) applyFov(fov);
    const b = !active && blocked;
    if (b === lastBlocked) return;
    lastBlocked = b;
    btn.classList.toggle('is-blocked', b);
    btn.setAttribute('aria-disabled', String(b));
    if (b) btn.title = PHOTO_TEXT.blocked;
    else btn.removeAttribute('title');
  }

  btn.addEventListener('click', () => {
    if (btn.getAttribute('aria-disabled') === 'true' || isBlocked()) return;
    open();
  });
  slider.addEventListener('input', () => {
    const v = clampFov(slider.value);
    if (!active || v == null) return;
    fov = v;
    applyFov(fov);
    fovOut.textContent = `${Math.round(fov)}°`;
  });
  // 슬라이더에서 손을 떼면 포커스를 풀어 보행 이동 · 시선 키가 장면으로 가게(시각 슬라이더와 같이)
  const releaseSlider = () => slider.blur();
  slider.addEventListener('pointerup', releaseSlider);
  slider.addEventListener('touchend', releaseSlider);
  // 도구 줄 버튼은 누른 뒤 포커스를 푼다 — Space(보행 점프) · Enter 가 버튼을 다시 누르지 않게(방식 버튼과 같이)
  saveBtn.addEventListener('click', () => {
    saveBtn.blur();
    save();
  });
  linkBtn.addEventListener('click', () => {
    linkBtn.blur();
    copyLink().catch((err) => console.error('[nowhere] 사진 링크 복사 실패', err));
  });
  closeBtn.addEventListener('click', () => close());
  urlField.addEventListener('focus', () => urlField.select());

  // 키(photoKeyAction): 처리한 키 · 막는 키는 뒤(조작 안내 · 모달 · 목록 · 건물 카드 · camera.js)로 보내지 않는다
  document.addEventListener?.('pointerlockchange', () => {
    if (!isPointerLocked()) lastUnlockAt = performance.now();
  });
  const pointerHeld = () => Boolean(isPointerLocked()) || performance.now() - lastUnlockAt < PHOTO_UNLOCK_GRACE_MS;
  window.addEventListener(
    'keydown',
    (e) => {
      const act = photoKeyAction({
        key: e.key, code: e.code, active, blocked: !active && Boolean(isBlocked()), typing: isTyping(e.target), held: escHeld, locked: active && e.key === 'Escape' && pointerHeld(),
        repeat: e.repeat, defaultPrevented: e.defaultPrevented, metaKey: e.metaKey, ctrlKey: e.ctrlKey, altKey: e.altKey, shiftKey: e.shiftKey,
      });
      if (e.key === 'Escape' && !e.repeat) escHeld = false;
      if (!act) return;
      e.stopImmediatePropagation();
      if (act === 'swallow') return;
      e.preventDefault();
      if (act === 'open') {
        open();
      } else if (act === 'close') {
        if (e.key === 'Escape') escHeld = true;
        close();
      }
    },
    true,
  );
  window.addEventListener(
    'keyup',
    (e) => {
      if (e.key === 'Escape') escHeld = false;
    },
    true,
  );

  return { open, close, toggle, isActive: () => active, update, afterRender, save, copyLink, element: root, button: btn };
}
