import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';

// 전시물 이름표 · 클릭 고르기(exhibit-tags.js) 동작 — 실제 리테일 진열(retail-display.js)과 같은 캔버스에 붙여 본다.
// 브라우저 importmap('three' · 'three/addons/')을 vendored three 로 잇는 resolve 훅(이 시험 파일 프로세스 안에서만), DOM 은 이 시험에 필요한 만큼만 흉내 낸다.
// 캔버스는 Node EventTarget — 같은 대상의 처리기는 등록 순서대로 돌고 stopImmediatePropagation 이 뒤를 막는다(브라우저 캔버스 캡처 처리기와 같다).
const VENDOR = new URL('../public/vendor/three/', import.meta.url).href;
register(`data:text/javascript,${encodeURIComponent(`
const V = ${JSON.stringify(VENDOR)};
export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: V + 'three.module.js', shortCircuit: true };
  if (specifier.startsWith('three/addons/')) return { url: V + 'jsm/' + specifier.slice(13), shortCircuit: true };
  return next(specifier, context);
}`)}`);

const PUB = new URL('../public/', import.meta.url);
const inner = JSON.parse(readFileSync(new URL('assets/nowhere-inner/inner-layout.json', PUB), 'utf8'));
const floor1 = inner.floors.find((f) => f.id === '1');

function fakeEl(tag) {
  return {
    tagName: tag.toUpperCase(),
    className: '',
    hidden: false,
    type: '',
    textContent: '',
    children: [],
    dataset: {},
    attrs: {},
    listeners: {},
    blurred: 0,
    style: { transform: '', props: {}, setProperty(k, v) { this.props[k] = v; } },
    append(...c) { this.children.push(...c); },
    replaceChildren(...c) { this.children = c; },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); },
    blur() { this.blurred += 1; },
  };
}
globalThis.document = { createElement: fakeEl, body: fakeEl('body'), pointerLockElement: null };

const THREE = await import('../public/vendor/three/three.module.js');
const { GLTFLoader } = await import('../public/vendor/three/jsm/loaders/GLTFLoader.js');
const { createRetailDisplay } = await import('../public/src/nowhere/retail-display.js');
const { createExhibitTags } = await import('../public/src/nowhere/exhibit-tags.js');

// 진열 제품(-lite GLB) 대신 작은 상자 — 받침대 · 덮개 고르기만 본다
GLTFLoader.prototype.loadAsync = async () => {
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.05), new THREE.MeshStandardMaterial()));
  return { scene };
};
globalThis.fetch = async (url) => ({ ok: true, json: async () => JSON.parse(readFileSync(new URL(url, PUB), 'utf8')) });

const W = 1600;
const H = 900;
class FakeCanvas extends EventTarget {
  clientWidth = W;
  clientHeight = H;
  getBoundingClientRect() { return { left: 0, top: 0, width: W, height: H }; }
}
const box = (name, [x, y, z], [w, h, d]) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial());
  m.name = name;
  m.position.set(x, y, z);
  return m;
};

/**
 * 1F 를 흉내 낸 층 루트(NW_InnerFloor_1): 리테일 진열(products.json 1F 그대로 — Kant 받침대 (−4, 0, 8)) + 전시물 노드 상자 —
 * EX_dj 는 Kant 받침대 바로 뒤(같은 광선에 둘 다 맞게), 도시 모형은 EX_plinth(가운데) 아래 자식 메시(이름이 메시 이름) + EX_city_haus.
 * order: 캔버스 처리기 등록 순서(main.js 는 리테일 → 전시물). front: Kant 덮개 바로 앞(같은 광선)에 작은 전시물 노드 상자(EX_display)
 */
async function setup({ order = ['retail', 'exhibit'], front = false } = {}) {
  const canvas = new FakeCanvas();
  const camera = new THREE.PerspectiveCamera(50, W / H, 0.2, 500);
  const opened = [];
  const state = { suspended: false, walking: false, spotAimed: false };
  const root = new THREE.Group();
  root.name = 'NW_InnerFloor_1';
  const plinth = new THREE.Group();
  plinth.name = 'EX_plinth';
  plinth.position.set(0, 0.5, 0);
  plinth.add(box('Cylinder.004', [0, 0, 0], [3, 1, 3]));
  root.add(plinth, box('EX_city_haus', [0, 1.5, 0], [0.6, 1, 0.6]), box('EX_dj', [-4, 1, 5], [1.5, 2, 1]), box('EX_elevator_l', [10, 1.5, 0], [1, 3, 0.2]));
  if (front) root.add(box('EX_display', [-4, 1.2, 9.6], [0.3, 0.3, 0.1]));
  const parts = {
    retail: () => createRetailDisplay({ camera, canvas, onOpen: (id) => opened.push(['product', id]), isSuspended: () => state.suspended }),
    exhibit: () => createExhibitTags({
      camera,
      canvas,
      getFloor: () => ({ def: floor1, root }),
      isSuspended: () => state.suspended,
      isWalking: () => state.walking,
      isSpotAimed: () => state.spotAimed,
      onOpen: (id) => opened.push(['exhibit', id]),
    }),
  };
  const made = {};
  for (const k of order) made[k] = parts[k]();
  // camera.js · spot-markers.js 처럼 캡처가 아닌 click 처리기(전시물이 막지 않은 클릭은 여기까지 온다)
  const later = [];
  canvas.addEventListener('click', () => later.push('bubble'));
  const shelf = await made.retail.build(floor1);
  root.add(shelf.group);
  root.updateMatrixWorld(true);
  made.retail.setFloor('1');
  made.exhibit.setFloor(floor1);
  const look = (pos, target) => {
    camera.position.set(...pos);
    camera.lookAt(...target);
    camera.updateMatrixWorld(true);
  };
  const click = (x = W / 2, y = H / 2, { dx = 0, dy = 0, during = null } = {}) => {
    const down = new Event('pointerdown');
    Object.assign(down, { clientX: x, clientY: y });
    canvas.dispatchEvent(down);
    during?.();   // 누른 뒤 · 떼기 전(interior.js 가 pointerdown 에 둘러보기를 멈추는 자리)
    const c = new Event('click');
    Object.assign(c, { clientX: x + dx, clientY: y + dy });
    canvas.dispatchEvent(c);
  };
  return { canvas, camera, opened, later, state, root, tags: made.exhibit, retail: made.retail, look, click };
}

test('(a) 제품이 먼저: Kant 덮개와 그 뒤 DJ 부스가 한 광선이면 제품, 받침대 위로 DJ 만 맞으면 전시물. 전시물 노드가 덮개 앞을 가려도 제품(리테일 처리기가 먼저 등록돼 막는다) — 등록 순서를 바꾸면 전시물이 받는다(순서가 정한다)', async () => {
  const s = await setup();
  s.look([-4, 1.2, 11], [-4, 1.2, 0]);
  s.click();
  assert.deepEqual(s.opened, [['product', 'kant']]);
  assert.deepEqual(s.later, []);
  s.opened.length = 0;
  s.look([-3.5, 1.6, 11], [-3.5, 1.6, 0]);
  s.click();
  assert.deepEqual(s.opened, [['exhibit', 'dj']]);
  for (const [order, want] of [[['retail', 'exhibit'], ['product', 'kant']], [['exhibit', 'retail'], ['exhibit', 'display']]]) {
    const t = await setup({ order, front: true });
    t.look([-4, 1.2, 11], [-4, 1.2, 0]);
    t.click();
    assert.deepEqual(t.opened, [want], order.join(' → '));
  }
});

test('(b) 자유 시점: 끌지 않은 클릭 자리의 광선이 층에서 처음 맞은 물체가 전시물(자식 메시 포함)이면 열고 막는다 — 끈 클릭 · 벽에 먼저 맞음 · 15 m 밖 · 엘리베이터 · 빈 곳은 그대로 둔다', async () => {
  const s = await setup();
  s.look([0, 0.8, 6], [0, 0.8, 0]);
  s.click();
  assert.deepEqual(s.opened, [['exhibit', 'city_model']], 'EX_plinth 아래 자식 메시 → 도시 모형');
  assert.deepEqual(s.later, [], '고른 클릭은 막는다');
  // 클릭 자리(가운데가 아니어도): 가운데보다 위 — 받침대 위로 지나 EX_city_haus → 도시 모형, 맨 위 빈 곳 → 없음
  s.opened.length = 0;
  s.click(W / 2, H * 0.3);
  assert.deepEqual(s.opened, [['exhibit', 'city_model']]);
  s.opened.length = 0;
  s.later.length = 0;
  s.click(W / 2, 20);
  assert.deepEqual(s.opened, []);
  assert.deepEqual(s.later, ['bubble'], '못 고른 클릭은 다른 처리기로');
  // 끈 클릭(> 5 px)은 둘러보기
  s.later.length = 0;
  s.click(W / 2, H / 2, { dx: 6 });
  assert.deepEqual(s.opened, []);
  s.click(W / 2, H / 2, { dx: 3, dy: 4 });
  assert.deepEqual(s.opened, [['exhibit', 'city_model']], '5 px 까지는 클릭');
  // 벽이 앞에 있으면 벽(전시물 아님)
  s.opened.length = 0;
  const wall = box('IN_wall_n', [0, 1.5, 3], [6, 3, 0.2]);
  s.root.add(wall);
  s.root.updateMatrixWorld(true);
  s.click();
  assert.deepEqual(s.opened, []);
  s.root.remove(wall);
  // 15 m: 받침대 앞면(z 1.5)까지 14.5 m 는 고르고, 15.5 m 는 그대로
  s.look([0, 0.8, 16], [0, 0.8, 0]);
  s.click();
  assert.deepEqual(s.opened, [['exhibit', 'city_model']]);
  s.opened.length = 0;
  s.look([0, 0.8, 17], [0, 0.8, 0]);
  s.click();
  assert.deepEqual(s.opened, []);
  // 엘리베이터 문은 전시물이 아니다
  s.look([10, 1.5, 5], [10, 1.5, 0]);
  s.click();
  assert.deepEqual(s.opened, []);
});

test('(c) 보행: 마우스 고정 전 클릭은 고르지 않고 그대로 둔다(camera.js 마우스 고정), 고정 중에는 클릭 자리와 관계없이 조준점(화면 가운데) — 조준점이 ◇ 스팟에 있으면 스팟 몫', async () => {
  const s = await setup();
  s.state.walking = true;
  s.look([0, 1.7, 6], [0, 1.2, 0]);
  s.click();
  assert.deepEqual(s.opened, []);
  assert.deepEqual(s.later, ['bubble'], '고정 전 클릭은 마우스 고정 처리기로 간다');
  document.pointerLockElement = s.canvas;
  try {
    s.later.length = 0;
    s.click(5, 5);   // 고정 중 clientX/Y 는 의미 없다 — 가운데 조준점
    assert.deepEqual(s.opened, [['exhibit', 'city_model']]);
    assert.deepEqual(s.later, []);
    s.opened.length = 0;
    s.state.spotAimed = true;
    s.click();
    assert.deepEqual(s.opened, [], '조준점 아래 스팟이 있으면 스팟으로 걸어간다');
    assert.deepEqual(s.later, ['bubble']);
  } finally {
    document.pointerLockElement = null;
  }
});

test('(d) 멈춤: 멈춤 중 클릭은 그대로 두고, 누를 때 멈춤이었던 클릭(둘러보기를 멈춘 클릭)도 고르지 않는다 — 다음 클릭부터 고른다', async () => {
  const s = await setup();
  s.look([0, 1.2, 6], [0, 1.2, 0]);
  s.state.suspended = true;
  s.click();
  assert.deepEqual(s.opened, []);
  s.click(W / 2, H / 2, { during: () => (s.state.suspended = false) });
  assert.deepEqual(s.opened, [], '누를 때 멈춤 → 그 클릭은 고르지 않음');
  s.click();
  assert.deepEqual(s.opened, [['exhibit', 'city_model']]);
});

test('(e) 이름표: 층 전시물마다 <title> · 자세히 보기 버튼 — 자리는 그 전시물 노드 경계 상자 윗면 가운데 + 0.6 m(노드가 없으면 pos + 0.6 m, 층 루트 변환을 따른다), 그 자리까지 수평 8 m 안 · 화면 안이면 보임, 누르면 포커스를 비우고 onOpen — 멈춤 · 층 없음이면 모두 숨김', async () => {
  const s = await setup();
  const root = s.tags.element;
  assert.equal(root.className, 'nw-exhibit-tags');
  const btns = root.children;
  assert.deepEqual(btns.map((b) => b.dataset.exhibit), floor1.exhibits.map((e) => e.id));
  for (const [i, b] of btns.entries()) {
    assert.equal(b.className, 'nw-exhibit-tag');
    assert.equal(b.type, 'button');
    assert.equal(b.children.map((c) => c.textContent).join(''), `${floor1.exhibits[i].title} · 자세히 보기`);
    assert.equal(b.attrs['aria-label'], `${floor1.exhibits[i].title} 자세히 보기`);
  }
  const [city, dj, wall] = btns;
  const at = (p) => {
    const v = new THREE.Vector3(...p).project(s.camera);
    return `translate(${Math.round((v.x * 0.5 + 0.5) * W)}px, ${Math.round((-v.y * 0.5 + 0.5) * H)}px)`;
  };
  // 도시 모형 노드(EX_plinth 아래 받침 y 0…1, EX_city_haus y 1…2) 윗면 가운데 (0, 2 + 0.6, 0) — 6 m 앞에서 보임. DJ 는 4.1 m 지만 화면 밖, 디스플레이 월은 8 m 밖
  s.look([0, 1.7, 6], [0, 1.7, 0]);
  s.tags.update();
  assert.equal(root.hidden, false);
  assert.equal(city.hidden, false);
  assert.equal(city.style.transform, at([0, 2.6, 0]));
  assert.equal(dj.hidden, true);
  assert.equal(wall.hidden, true);
  // 거리는 이름표 자리(노드 상자) 기준: DJ 노드 상자 (−4, 0…2, 5) 앞 5 m — inner-layout pos (8.8, −7.2) 까지는 21 m 지만 보인다. 도시 모형은 10.8 m 라 숨김
  s.look([-4, 1.7, 10], [-4, 1.7, 5]);
  s.tags.update();
  assert.equal(dj.hidden, false);
  assert.equal(dj.style.transform, at([-4, 2.6, 5]));
  assert.equal(city.hidden, true);
  // 노드가 없는 전시물(이 합성 층의 디스플레이 월)은 pos + 0.6
  s.look([-16.4, 1.7, -1], [-16.4, 3, -6]);
  s.tags.update();
  assert.equal(wall.hidden, false);
  assert.equal(wall.style.transform, at([-16.4, 2.4 + 0.6, -6]));
  // 뒤돌아서면(화면 밖) 숨김, 높이 차는 보지 않는다(위에서 내려다봐도 수평 6 m)
  s.look([0, 1.7, 6], [0, 1.7, 12]);
  s.tags.update();
  assert.equal(city.hidden, true);
  s.look([0, 9, 6], [0, 1.5, 0]);
  s.tags.update();
  assert.equal(city.hidden, false);
  // 층 루트가 옮겨져 있으면 이름표 자리도 따라간다(층을 다시 고르면 다시 잰다)
  s.root.position.x += 10;
  s.root.updateMatrixWorld(true);
  s.tags.setFloor(floor1);
  const [city2] = root.children;
  s.look([10, 1.7, 6], [10, 1.7, 0]);
  s.tags.update();
  assert.equal(city2.hidden, false);
  assert.equal(city2.style.transform, at([10, 2.6, 0]));
  // 누르면 blur 후 onOpen
  city2.listeners.click[0]({ preventDefault() {} });
  assert.equal(city2.blurred, 1);
  assert.deepEqual(s.opened, [['exhibit', 'city_model']]);
  // 멈춤 · 실내 밖(층 없음)
  s.state.suspended = true;
  s.tags.update();
  assert.equal(root.hidden, true);
  s.state.suspended = false;
  s.tags.setFloor(null);
  assert.deepEqual(root.children, []);
  s.tags.update();
  assert.equal(root.hidden, true);
  // 다른 층으로 바꾸면 그 층 전시물 이름표로(지금 층 루트가 그 층이 아니면 보이지 않는다)
  const f13 = inner.floors.find((f) => f.id === '13');
  s.tags.setFloor(f13);
  assert.deepEqual(root.children.map((b) => b.dataset.exhibit), f13.exhibits.map((e) => e.id));
  assert.ok(root.children.every((b) => b.hidden), '바꾼 직후에는 숨김');
  s.tags.update();
  assert.equal(root.hidden, true, 'getFloor 가 아직 1F 면 13F 이름표를 그 층 루트로 재지 않는다');
});

test('(t) 터치 보행: 끌지 않은 탭은 전시물을 고른다(터치에는 마우스 고정이 없다) — 마우스 클릭은 그대로 마우스 고정 몫', () => {
  const src = readFileSync(new URL('../public/src/nowhere/exhibit-tags.js', import.meta.url), 'utf8');
  assert.match(src, /down\.touch = e\.pointerType === 'touch'/);
  assert.match(src, /if \(isWalking\(\) && !down\.touch\) return;/);
});
