// HAUS NOWHERE — 리테일 제품 목록(순수, three · DOM 없음 — 테스트: tests/nowhere-products.test.mjs).
// assets/products/products.json 검증 · 층별 진열 · 제품 스팟(받침대 앞 1.2 m) · 정보 문구(크기 · 재질 · 빈 필드 숨김) ·
// 경로 문구 · 이전 · 다음 순서 · 감상 키 · 감상 무대 카메라 거리. 제품 · 진열을 늘릴 때는 GLB 를 넣고 products.json 만 고친다.
// 좌표는 실내 층 Three.js(x, y 위, z). yaw 는 도(°) — 0 이면 제품 정면(모델 +z)이 +z 를 본다.

export const PRODUCTS_URL = 'assets/products/products.json';
export const PLINTH = { width: 0.5, height: 1.05, depth: 0.5 };   // m — 무광 석재 기둥(바닥 중심 = 진열 pos)
export const COVER = { width: 0.42, height: 0.28, depth: 0.42 };  // m — 유리 덮개(받침대 윗면 위)
export const GLOW = { width: 0.4, height: 0.01, depth: 0.4 };     // m — 윗면 발광 판(자체 발광, 조명 없음)
export const PRODUCT_CENTER_Y = 1.08;   // m — 진열 제품 경계 상자 가운데 높이: 발광 판(윗면 1.06) 위에 얹는다(가장 높은 Kant 40 mm 가 판에 닿음, 덮개 안 — Task 6 CP)
export const SPOT_FRONT = 1.2;          // m — 제품 스팟은 받침대 앞 이만큼
export const LABEL_RANGE = 4;           // m — 이 안이면 이름표('자세히 보기')
export const LABEL_LIFT = 0.12;         // m — 이름표는 덮개 윗면 위 이만큼
export const PICK_RANGE = 12;           // m — 클릭 · 탭으로 고를 수 있는 거리
export const AUTO_ROTATE_DELAY = 4;     // s — 감상 모드에서 입력이 없으면 이 뒤 천천히 자동 회전
export const BREADCRUMB_ROOT = ['SUPREME ORIGIN', 'Retail'];
const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const OPTIONAL_FIELDS = [
  ['description', '설명'],
  ['collection', '컬렉션'],
  ['color', '컬러'],
];

const isStr = (v) => typeof v === 'string';
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** products.json 을 검증해 { products, displays } 를 돌려준다. 문제가 있으면 모두 모아 던진다 */
export function validateCatalog(json) {
  const errs = [];
  const products = Array.isArray(json?.products) ? json.products : [];
  const displays = Array.isArray(json?.displays) ? json.displays : [];
  if (!products.length) errs.push('products 가 비었다');
  const ids = new Set();
  for (const p of products) {
    const id = p?.id;
    if (!isStr(id) || !ID_RE.test(id)) errs.push(`id 형식: ${JSON.stringify(id)}`);
    else if (ids.has(id)) errs.push(`id 중복: ${id}`);
    ids.add(id);
    if (!isStr(p.name) || !p.name.trim()) errs.push(`${id}: name 없음`);
    if (!isStr(p.category) || !p.category) errs.push(`${id}: category 없음`);
    if (p.glb !== `assets/products/${id}.glb`) errs.push(`${id}: glb 는 assets/products/${id}.glb`);
    if (p.liteGlb !== `assets/products/${id}-lite.glb`) errs.push(`${id}: liteGlb 는 assets/products/${id}-lite.glb`);
    const s = p.sizeMm;
    if (!s || !['width', 'length', 'height'].every((k) => Number.isInteger(s[k]) && s[k] > 0)) errs.push(`${id}: sizeMm 은 양의 정수 width · length · height`);
    if (!Array.isArray(p.materials) || !p.materials.every((m) => isStr(m) && m.trim())) errs.push(`${id}: materials 는 문자열 목록`);
    for (const [k] of OPTIONAL_FIELDS) if (!isStr(p[k])) errs.push(`${id}: ${k} 는 문자열(모르면 빈 문자열)`);
  }
  displays.forEach((d, i) => {
    if (!isStr(d?.floor) || !d.floor) errs.push(`displays[${i}]: floor 없음`);
    if (!ids.has(d?.product)) errs.push(`displays[${i}]: 없는 제품 ${JSON.stringify(d?.product)}`);
    if (!Array.isArray(d?.pos) || d.pos.length !== 3 || !d.pos.every(isNum)) errs.push(`displays[${i}]: pos 는 [x, y, z]`);
    if (!isNum(d?.yaw)) errs.push(`displays[${i}]: yaw(도) 없음`);
  });
  if (errs.length) throw new Error(`products.json: ${errs.join(' · ')}`);
  return { products, displays };
}

/** id → 제품(없으면 null) */
export function findProduct(catalog, id) {
  return catalog?.products.find((p) => p.id === id) || null;
}

/** 그 층 진열(파일 순서) — [{ product, pos, yaw }] */
export function floorDisplays(catalog, floorId) {
  if (!catalog) return [];
  return catalog.displays
    .filter((d) => d.floor === floorId)
    .map((d) => ({ product: findProduct(catalog, d.product), pos: [...d.pos], yaw: d.yaw }));
}

/** 진열 정면 방향(수평 단위 벡터 [x, z]) — yaw 0 이면 [0, 1](+z) */
export function displayFront(yaw) {
  const r = (yaw * Math.PI) / 180;
  return [Math.sin(r), Math.cos(r)];
}

/** 그 층 제품 스팟(보행 이동 스팟 형식, kind 'product'): 받침대 앞 SPOT_FRONT, 이름 = 제품 이름, 볼거리 = 제품 */
export function productSpots(catalog, floorId) {
  return floorDisplays(catalog, floorId).map(({ product, pos, yaw }) => {
    const [fx, fz] = displayFront(yaw);
    return {
      id: `${floorId}_product_${product.id}`,
      label: product.name,
      x: pos[0] + fx * SPOT_FRONT,
      z: pos[2] + fz * SPOT_FRONT,
      look: [pos[0], pos[1] + PRODUCT_CENTER_Y, pos[2]],
      kind: 'product',
      beacon: false,
      caption: null,
      building: null,
      product: product.id,
    };
  });
}

/** 실측 크기 문구: '폭 157 · 길이 160 · 높이 40 mm' */
export function sizeText(sizeMm) {
  return `폭 ${sizeMm.width} · 길이 ${sizeMm.length} · 높이 ${sizeMm.height} mm`;
}

/** 정보 패널 행 [{ key, label, value }] — 크기 · 재질 · 설명 · 컬렉션 · 컬러 중 비어 있지 않은 것만 */
export function infoRows(product) {
  const rows = [{ key: 'size', label: '크기', value: sizeText(product.sizeMm) }];
  if (product.materials.length) rows.push({ key: 'materials', label: '재질', value: product.materials.join(' · ') });
  for (const [key, label] of OPTIONAL_FIELDS) {
    const v = String(product[key] || '').trim();
    if (v) rows.push({ key, label, value: v });
  }
  return rows;
}

/** 층 경로 이름: '1' → 'HAUS 성수 1F', 'b1' → 'HAUS 성수 B1F' */
export function floorCrumb(floorId) {
  return `HAUS 성수 ${floorId === 'b1' ? 'B1F' : `${floorId}F`}`;
}

/** 감상 화면 왼쪽 위 경로: SUPREME ORIGIN > Retail > HAUS 성수 1F > <제품명> */
export function breadcrumb(floorId, name) {
  return [...BREADCRUMB_ROOT, floorCrumb(floorId), name];
}

/** 같은 층 진열 순서로 dir(+1 다음 · −1 이전) 만큼 — 끝에서 처음으로 돈다. 진열에 없으면 null */
export function stepProduct(catalog, floorId, currentId, dir) {
  const ids = floorDisplays(catalog, floorId).map((d) => d.product.id);
  const i = ids.indexOf(currentId);
  if (i < 0) return null;
  return ids[(i + dir + ids.length * 2) % ids.length];
}

/** 감상 모드 키: Esc → 'close', ← → 'prev', → → 'next', 그 밖은 null */
export function resolveShowcaseKey(key) {
  if (key === 'Escape') return 'close';
  if (key === 'ArrowLeft') return 'prev';
  if (key === 'ArrowRight') return 'next';
  return null;
}

/**
 * 감상 중(열고 닫는 페이드 포함) 키 하나를 어떻게 다룰지 정한다.
 *  - 'ignore': 감상과 무관(감상 중이 아니거나 앞 처리기가 이미 받음) → 그대로 둔다
 *  - 'close' | 'prev' | 'next': 감상 동작(조작 안내 · 모달이 열려 있거나 페이드 중에는 나오지 않는다)
 *  - 'pass': 조작 안내(?) · 성능 표시(P) · ⌘ · Ctrl 조합 → 지나가게 한다
 *  - 'swallow': 그 밖의 키(V · WASD · Space …) → 뒤 보행 · 카메라로 가지 않게 막는다(감상 동작 없음)
 * blocked = 조작 안내 · 모달 열림, busy = 여닫는 페이드 중
 */
export function showcaseKeyGate({ active, busy, blocked, defaultPrevented, key, metaKey = false, ctrlKey = false }) {
  if (!(active || busy) || defaultPrevented) return 'ignore';
  const passes = key === '?' || key === 'p' || key === 'P' || metaKey || ctrlKey;
  if (blocked || busy) return passes ? 'pass' : 'swallow';
  return resolveShowcaseKey(key) || (passes ? 'pass' : 'swallow');
}

// 감상 무대 오른쪽 정보 패널(nowhere.css .nw-showcase-panel — 폭 · 오른쪽 여백) + 제품과의 간격.
// 폭 720 px 이하, 그리고 세로 화면 폭 1024 px 이하(세로 태블릿)는 패널이 아래로 내려간다(휴대폰 배치)
export const STAGE_PANEL = { width: 300, right: 22, gap: 24, minViewport: 721, portraitMax: 1024 };

/**
 * 감상 무대 화면(width × height px)에서 제품을 둘 빈 곳. 옆 패널 배치면 패널 왼쪽 빈 폭 freeWidth 와, 투영 가운데를 왼쪽으로 옮길 shift px
 * (빈 곳 가운데 = 화면 가운데 − shift). 빈 폭은 화면의 절반 아래로 줄이지 않는다. 패널이 아래인 배치(휴대폰 · 세로 태블릿)는 { width, 0 }.
 */
export function stageView(width, height) {
  if (width < STAGE_PANEL.minViewport || (height > width && width <= STAGE_PANEL.portraitMax)) return { freeWidth: width, shift: 0 };
  const freeWidth = Math.max(width / 2, width - (STAGE_PANEL.width + STAGE_PANEL.right + STAGE_PANEL.gap));
  return { freeWidth, shift: (width - freeWidth) / 2 };
}

/**
 * 감상 무대 카메라 거리(제품 경계 구 반지름 radius m, 세로 시야각 fovDeg, 화면 가로 / 세로 aspect).
 * distance = 구가 화면 높이 · 폭(세로 화면은 폭이 좁다) 모두에 여유 있게 들어오는 거리, min = 표면 가까이(확대), max = 맞춘 거리의 2.5 배
 */
export function stageFraming(radius, fovDeg, aspect = 1) {
  const half = ((fovDeg / 2) * Math.PI) / 180;
  const fit = radius / Math.sin(Math.min(half, Math.atan(Math.tan(half) * aspect)));
  return {
    distance: fit * 1.15,
    minDistance: radius * 1.25,
    maxDistance: fit * 2.5,
    near: radius * 0.02,
    far: fit * 20,
  };
}
