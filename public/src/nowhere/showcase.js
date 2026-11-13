// HAUS NOWHERE — 제품 감상 모드: 실내 대신 따로 띄운 스튜디오 무대(어두운 청회색 배경 · 그라데이션 바닥 원판 · RoomEnvironment 반사 ·
// 키 · 필 · 림 조명 3개)에 제품 하나를 원점에 세우고 돌려 보고 확대한다. 감상 중에는 main.js 가 외관 · 실내 · 후처리 대신 render() 만 부른다.
// 조작: 드래그 · 한 손가락 회전, 휠 · 두 손가락 확대(제품 크기 기준 최소 · 최대 거리), 4 초 동안 입력이 없으면 천천히 자동 회전,
// ← / → · 이전 · 다음 버튼 = 같은 층 진열 순서, Esc · < BACK = 나가기(onClose — main.js 가 연 자리 · 시선 · 보행 여부를 되돌린다).
// 데스크톱 · 태블릿은 -lite 로 먼저 보여 주고 <id>.glb 를 받아 바꾼다. 휴대폰은 -lite 만. 키는 창 캡처 단계에서 먼저 받는다(조작 안내 · 모달이 열려 있으면 그쪽 몫).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { findProduct, floorDisplays, infoRows, breadcrumb, stepProduct, showcaseKeyGate, stageFraming, AUTO_ROTATE_DELAY } from './products.js';

export const SHOWCASE_FADE_MS = 200;   // 실내 ↔ 감상 무대 화면 전환(어둡게 · 밝게 각각)
const FOV = 30;
const BG = '#1A212B';                 // 어두운 청회색
const EXPOSURE = 1.0;                 // 감상 무대 노출(외관 기상 노출과 따로)
const AUTO_ROTATE_SPEED = 2;          // OrbitControls 단위(60 / 2 = 30 초에 한 바퀴)
const START_AZIMUTH = 28;             // ° — 처음 시선: 정면에서 오른쪽으로
const START_ELEVATION = 14;           // ° — 처음 시선: 조금 위에서
const DISC_SCALE = 4.5;               // 바닥 원판 지름 = 제품 경계 구 반지름 × 이 값

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

let studioEnv = null;
/** 반사용 환경(RoomEnvironment PMREM, 한 번만 만든다) — 진열 제품 재질도 같은 것을 쓴다(retail-display getEnvMap) */
export function studioEnvironment(renderer) {
  if (!studioEnv) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    studioEnv = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
  }
  return studioEnv;
}

// 바닥 원판: 제품 아래는 조금 어둡고(접지감) 바깥으로 옅게 밝아졌다 사라지는 원 — 그림자 패스 없이
function makeFloorDisc() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(6, 9, 13, 0.75)');
  grad.addColorStop(0.2, 'rgba(6, 9, 13, 0.4)');
  grad.addColorStop(0.45, 'rgba(150, 170, 195, 0.12)');
  grad.addColorStop(1, 'rgba(150, 170, 195, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2;
  disc.name = 'NW_ShowcaseDisc';
  return disc;
}

/**
 * getLite(product) → Promise<Object3D | null>(진열이 받아 둔 -lite 원본 — clone 해서 쓴다).
 * isBlocked() → 조작 안내 · 모달이 열려 있으면 감상 키를 처리하지 않는다. onHelp → '조작 안내' 버튼. onClose → 나간 뒤(화면이 어두운 동안) 부른다.
 */
export function createShowcase({ renderer, canvas, quality, fade, getLite, isBlocked = () => false, onHelp = null, onClose = null }) {
  const scene = new THREE.Scene();
  scene.name = 'NW_Showcase';
  scene.background = new THREE.Color(BG);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 50);
  const key = new THREE.DirectionalLight('#FFF3E4', 2.2);
  key.position.set(2.5, 3.0, 2.2);
  const fill = new THREE.DirectionalLight('#DCE7FF', 0.7);
  fill.position.set(-3.0, 1.2, 1.5);
  const rim = new THREE.DirectionalLight('#FFFFFF', 1.6);
  rim.position.set(-0.5, 2.2, -3.2);
  const disc = makeFloorDisc();
  const stage = new THREE.Group();
  scene.add(key, fill, rim, disc, stage);

  // 무대 조작: 실내 카메라와 같은 캔버스 — 감상 중에만 켠다(main.js 가 실내 OrbitControls 를 끈다)
  const controls = new OrbitControls(camera, canvas);
  controls.enabled = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.rotateSpeed = 0.8;
  controls.minPolarAngle = Math.PI * 0.08;
  controls.maxPolarAngle = Math.PI * 0.62;   // 바닥 아래로는 조금만
  controls.autoRotateSpeed = AUTO_ROTATE_SPEED;
  let interacting = false;
  let idle = 0;
  controls.addEventListener('start', () => {
    interacting = true;
    idle = 0;
    controls.autoRotate = false;
  });
  controls.addEventListener('end', () => {
    interacting = false;
    idle = 0;
  });

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const wantHi = quality.device !== 'phone';
  const hiCache = new Map();   // productId → Promise<Object3D | null>

  // 화면: 왼쪽 위 < BACK · 경로, 오른쪽 위 조작 안내, 오른쪽 정보 패널, 아래 이전 · 다음 · 조작 안내 한 줄
  const root = el('div', 'nw-showcase');
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', '제품 감상');
  const top = el('div', 'nw-showcase-top');
  const back = el('button', 'nw-btn nw-showcase-back', '< BACK');
  back.type = 'button';
  const crumbs = el('nav', 'nw-showcase-crumbs');
  crumbs.setAttribute('aria-label', '경로');
  const helpBtn = el('button', 'nw-btn nw-showcase-help', '조작 안내');
  helpBtn.type = 'button';
  helpBtn.append(el('span', 'nw-btn-kbd', '?'));
  top.append(back, crumbs, helpBtn);
  const panel = el('aside', 'nw-showcase-panel');
  const kicker = el('div', 'nw-showcase-kicker');
  const title = el('h2', 'nw-showcase-name');
  const info = el('dl', 'nw-showcase-info');
  const status = el('div', 'nw-showcase-status', '고해상도 불러오는 중…');
  status.hidden = true;
  status.setAttribute('aria-live', 'polite');
  panel.append(kicker, title, info, status);
  const pager = el('div', 'nw-showcase-pager');
  const prevBtn = el('button', 'nw-btn nw-showcase-prev', '‹ 이전');
  prevBtn.type = 'button';
  const count = el('span', 'nw-showcase-count');
  const nextBtn = el('button', 'nw-btn nw-showcase-next', '다음 ›');
  nextBtn.type = 'button';
  pager.append(prevBtn, count, nextBtn);
  const hint = el('div', 'nw-showcase-hint', '드래그 · 한 손가락 회전 · 휠 · 두 손가락 확대 · ← → 다른 제품 · Esc 나가기');
  root.append(top, panel, pager, hint);
  document.body.append(root);

  let active = false;
  let busy = false;
  let catalog = null;
  let floorId = null;
  let productId = null;
  let level = null;   // 'lite' | 'hi'
  let model = null;
  let token = 0;      // 제품을 바꾸거나 나가면 늘린다 — 늦게 도착한 고해상도는 버린다

  function fillInfo(p) {
    const parts = breadcrumb(floorId, p.name);
    crumbs.replaceChildren(
      ...parts.flatMap((t, i) => {
        const s = el('span', i === parts.length - 1 ? 'nw-showcase-crumb is-current' : 'nw-showcase-crumb', t);
        return i ? [el('span', 'nw-showcase-sep', '>'), s] : [s];
      }),
    );
    kicker.textContent = p.category.toUpperCase();
    title.textContent = p.name;
    info.replaceChildren(...infoRows(p).flatMap((r) => [el('dt', null, r.label), el('dd', null, r.value)]));
    const ids = floorDisplays(catalog, floorId).map((d) => d.product.id);
    count.textContent = `${ids.indexOf(p.id) + 1} / ${ids.length}`;
    pager.hidden = ids.length < 2;
  }

  // 제품 경계 상자에 맞춰 카메라 거리 · 확대 한계 · 바닥 원판을 정하고 처음 시선으로
  function frame(box) {
    const size = box.getSize(new THREE.Vector3());
    const radius = size.length() / 2;
    camera.aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    const f = stageFraming(radius, FOV, camera.aspect);
    camera.near = f.near;
    camera.far = f.far;
    camera.updateProjectionMatrix();
    controls.minDistance = f.minDistance;
    controls.maxDistance = f.maxDistance;
    const az = THREE.MathUtils.degToRad(START_AZIMUTH);
    const elv = THREE.MathUtils.degToRad(START_ELEVATION);
    camera.position.set(Math.sin(az) * Math.cos(elv), Math.sin(elv), Math.cos(az) * Math.cos(elv)).multiplyScalar(f.distance);
    controls.target.set(0, 0, 0);
    controls.update();
    disc.scale.setScalar(radius * DISC_SCALE);
    disc.position.y = -size.y / 2 - 0.0005;
    idle = 0;
    controls.autoRotate = false;
  }

  function setModel(obj, lvl, reframe) {
    if (model) stage.remove(model);
    obj.position.set(0, 0, 0);
    const box = new THREE.Box3().setFromObject(obj);
    obj.position.sub(box.getCenter(new THREE.Vector3()));   // 경계 상자 가운데를 원점에
    stage.add(obj);
    model = obj;
    level = lvl;
    status.hidden = lvl === 'hi' || !wantHi;
    if (reframe) frame(box);
  }

  function loadHi(product) {
    if (!hiCache.has(product.id)) {
      hiCache.set(
        product.id,
        loader
          .loadAsync(product.glb)
          .then((g) => g.scene)
          .catch((err) => {
            console.error(`[nowhere] 제품 고해상도 ${product.id} 불러오기 실패`, err);
            return null;
          }),
      );
    }
    return hiCache.get(product.id);
  }

  /** 제품 하나를 무대에: -lite 먼저(진열이 받아 둔 것), 데스크톱 · 태블릿은 고해상도로 바꾼다. 못 보이면 false */
  async function show(id) {
    const product = findProduct(catalog, id);
    if (!product) return false;
    const my = ++token;
    const lite = await getLite(product);
    if (my !== token) return true;   // 그사이 다른 제품으로 넘어갔다
    if (!lite) return false;
    productId = id;
    fillInfo(product);
    setModel(lite.clone(true), 'lite', true);
    if (wantHi) {
      loadHi(product).then((hi) => {
        if (hi && my === token) setModel(hi, 'hi', false);   // 거리 · 시선은 그대로(같은 실제 크기)
        else if (!hi && my === token) status.hidden = true;
      });
    }
    return true;
  }

  function step(dir) {
    if (!active) return;
    const next = stepProduct(catalog, floorId, productId, dir);
    if (next && next !== productId) show(next);
  }

  /** 감상 모드 열기 — 화면을 어둡게 한 뒤 무대로 바꾸고 밝힌다. 열었으면 true.
   *  보이지 못하거나(제품 · lite 없음) 도중에 던지면 무대 상태를 되돌리고 화면을 다시 밝힌 뒤 false(검은 화면에 멈추지 않게 — main.js 가 실내를 되돌린다) */
  async function open({ catalog: cat, floorId: floor, productId: id }) {
    if (active || busy) return false;
    busy = true;
    try {
      await fade.fadeTo(true, '', SHOWCASE_FADE_MS);
      catalog = cat;
      floorId = floor;
      scene.environment = studioEnvironment(renderer);
      if (!(await show(id))) throw new Error('제품 · 가벼운 모델 없음');
      active = true;
      controls.enabled = true;
      root.hidden = false;
      document.body.classList.add('is-showcase');
      await fade.fadeTo(false, '', SHOWCASE_FADE_MS);
      return true;
    } catch (err) {
      console.error(`[nowhere] 제품 감상 ${id} 열기 실패`, err);
      active = false;
      token++;   // 받는 중인 고해상도는 버린다
      controls.enabled = false;
      controls.autoRotate = false;
      root.hidden = true;
      document.body.classList.remove('is-showcase');
      await fade.fadeTo(false, '', SHOWCASE_FADE_MS);
      return false;
    } finally {
      busy = false;
    }
  }

  /** 나가기 — 어두운 동안 onClose(실내 카메라 · 보행 되돌리기) */
  async function close() {
    if (!active || busy) return;
    busy = true;
    try {
      await fade.fadeTo(true, '', SHOWCASE_FADE_MS);
      active = false;
      token++;
      controls.enabled = false;
      controls.autoRotate = false;
      root.hidden = true;
      document.body.classList.remove('is-showcase');
      if (typeof onClose === 'function') onClose();
    } finally {
      await fade.fadeTo(false, '', SHOWCASE_FADE_MS);
      busy = false;
    }
  }

  back.addEventListener('click', () => {
    back.blur();
    close();
  });
  prevBtn.addEventListener('click', () => {
    prevBtn.blur();
    step(-1);
  });
  nextBtn.addEventListener('click', () => {
    nextBtn.blur();
    step(1);
  });
  helpBtn.addEventListener('click', () => {
    helpBtn.blur();
    if (typeof onHelp === 'function') onHelp();
  });

  window.addEventListener(
    'keydown',
    (e) => {
      // 조작 안내 · 모달이 열려 있거나 여닫는 페이드 중에는 감상 동작 없이 막기만 한다(그 사이 V 가 뒤 카메라의 보행 모드를 켜지 않게).
      // 조작 안내 · 모달의 캡처 처리기가 먼저 등록돼 있어 그쪽 Esc · ? 는 defaultPrevented 로 여기 오기 전에 끝난다
      const act = showcaseKeyGate({
        active, busy, blocked: isBlocked(), defaultPrevented: e.defaultPrevented,
        key: e.key, metaKey: e.metaKey, ctrlKey: e.ctrlKey,
      });
      if (act === 'ignore' || act === 'pass') return;
      e.stopImmediatePropagation();
      if (act === 'swallow') return;
      e.preventDefault();
      if (act === 'close') {
        if (!e.repeat) close();
      } else {
        idle = 0;
        step(act === 'next' ? 1 : -1);
      }
    },
    true,
  );

  // 감상 중(열고 닫는 페이드 포함) 캔버스 click 은 뒤 카메라(보행 포인터 잠금)와 스팟 조준 클릭으로 가지 않게 캡처 단계에서 막는다.
  // 무대 회전 · 확대는 pointer · wheel 이벤트라 영향 없고, 감상 UI 버튼은 캔버스가 아니다
  canvas.addEventListener(
    'click',
    (e) => {
      if (active || busy) e.stopImmediatePropagation();
    },
    true,
  );

  function update(dt) {
    if (!active) return;
    if (!interacting) idle += dt;
    controls.autoRotate = idle >= AUTO_ROTATE_DELAY;
    controls.update(dt);
  }

  function render() {
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    if (Math.abs(camera.aspect - aspect) > 1e-6) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    }
    const exposure = renderer.toneMappingExposure;
    renderer.toneMappingExposure = EXPOSURE;
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
    renderer.toneMappingExposure = exposure;
  }

  return {
    open,
    close,
    update,
    render,
    isActive: () => active,
    isBusy: () => busy,
    getState: () => ({
      active,
      productId,
      level,
      autoRotate: controls.autoRotate,
      distance: camera.position.distanceTo(controls.target),
      minDistance: controls.minDistance,
      maxDistance: controls.maxDistance,
    }),
    scene,
    camera,
    controls,
    element: root,
  };
}
