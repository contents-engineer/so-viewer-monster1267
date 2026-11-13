// HAUS NOWHERE — 리테일 진열(실내 층): products.json 의 그 층 진열마다 무광 석재 받침대 + 윗면 발광 판 + 유리 덮개를 런타임으로 만들고
// 제품 -lite GLB 를 실제 크기로 덮개 안 발광 판 위(제품 가운데 높이 PRODUCT_CENTER_Y)에 정면이 yaw 쪽을 보게 앉힌다(실내 Blender 빌드 · 층 GLB 는 그대로).
// 그리기: 받침대 + 발광 판 1(emissiveMap 두 칸 — 조명을 늘리지 않는 자체 발광) · 덮개 1(한 번에 그리기 · 그림자 없음) · 제품 lite 재질 수.
// build(floorDef) 가 { group, obstacles } 를 돌려주면 interior.js loadFloor 가 층 장면에 붙이고 점유 격자(보행 장애물)에 더한다.
// 고르기: 캔버스 클릭 · 탭(끌기 없이) · 보행 마우스 고정 중 조준점 클릭 · 4 m 안 이름표(DOM '자세히 보기') → onOpen(productId).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PRODUCTS_URL, validateCatalog, floorDisplays, withoutProducts, PLINTH, COVER, GLOW, PRODUCT_CENTER_Y, LABEL_RANGE, LABEL_LIFT, PICK_RANGE } from './products.js';

const CLICK_SLOP = 5;   // px — 이보다 많이 끌었으면 둘러보기 드래그(클릭 아님)
const STONE = '#8E8981';
const GLOW_COLOR = '#FFF1DA';

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// 받침대 재질의 emissiveMap: 왼쪽 칸 검정(석재 — 발광 없음) · 오른쪽 칸 흰색(발광 판). 면마다 UV 를 한 칸에 몰아 고른다
function makeGlowMap() {
  const tex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255]), 2, 1);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// 상자(가로 w · 높이 h ·깊이 d)를 (x, y, z) 가운데 · yaw 회전으로. u 를 주면 모든 UV 를 (u, 0.5) 로(발광 칸 고르기)
function boxAt(w, h, d, x, y, z, yawRad, u = null) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (u !== null) {
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u, 0.5);
  }
  g.rotateY(yawRad);
  g.translate(x, y, z);
  return g;
}

/**
 * getEnvMap(): 제품 재질 반사(감상 무대와 같은 RoomEnvironment — 모바일 실내는 HDRI 가 없어 금속이 검게 보이지 않게).
 * isSuspended(): 감상 모드 · 모달 · 조작 안내 · 화면 전환 · 둘러보기 중이면 이름표를 숨기고 클릭을 받지 않는다.
 */
export function createRetailDisplay({ camera, canvas, getEnvMap = () => null, onOpen, isSuspended = () => false }) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  let catalog = null;
  const failed = new Set();   // 진열용(lite) 모델을 못 불러온 제품 id
  let catalogPromise = null;
  const liteSources = new Map();   // productId → Promise<THREE.Object3D | null>(진열 · 감상이 clone 해서 쓴다)
  const shelves = new Map();       // floorId → { group, pickables, displays, tags }
  let current = null;

  const plinthMat = new THREE.MeshStandardMaterial({
    color: STONE,
    roughness: 0.92,
    metalness: 0,
    emissive: GLOW_COLOR,
    emissiveIntensity: 1.1,
    emissiveMap: makeGlowMap(),
  });
  const coverMat = new THREE.MeshStandardMaterial({
    color: '#EEF4F7',
    roughness: 0.04,
    metalness: 0,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });

  const root = el('div', 'nw-retail-tags');
  root.hidden = true;
  document.body.append(root);

  function loadCatalog() {
    if (!catalogPromise) {
      catalogPromise = fetch(PRODUCTS_URL)
        .then((r) => {
          if (!r.ok) throw new Error(`products.json ${r.status}`);
          return r.json();
        })
        .then((json) => (catalog = validateCatalog(json)));
    }
    return catalogPromise;
  }

  /** 제품 -lite GLB(한 번만 받는다). 실패하면 null — 그 제품만 빠진다 */
  function liteSource(product) {
    if (!liteSources.has(product.id)) {
      const p = loader
        .loadAsync(product.liteGlb)
        .then((gltf) => {
          const env = getEnvMap();
          gltf.scene.traverse((n) => {
            if (!n.isMesh) return;
            for (const m of Array.isArray(n.material) ? n.material : [n.material]) {
              if (env && 'envMap' in m) m.envMap = env;
            }
          });
          return gltf.scene;
        })
        .catch((err) => {
          console.error(`[nowhere] 제품 ${product.id} 불러오기 실패`, err);
          failed.add(product.id);   // 진열에서 뺀다 — 이름표 · 이동 스팟 · 감상 이전/다음(catalog())
          return null;
        });
      liteSources.set(product.id, p);
    }
    return liteSources.get(product.id);
  }

  /** 그 층 진열을 만든다. 진열이 없으면 null. 받침대 · 덮개 메시는 obstacles(보행 장애물)로 */
  async function build(floorDef) {
    const ds = floorDisplays(await loadCatalog(), floorDef.id);
    if (!ds.length) return null;
    const plinthGeos = [];
    const coverGeos = [];
    for (const d of ds) {
      const [x, y, z] = d.pos;
      const r = (d.yaw * Math.PI) / 180;
      plinthGeos.push(boxAt(PLINTH.width, PLINTH.height, PLINTH.depth, x, y + PLINTH.height / 2, z, r, 0.25));
      plinthGeos.push(boxAt(GLOW.width, GLOW.height, GLOW.depth, x, y + PLINTH.height + GLOW.height / 2, z, r, 0.75));
      coverGeos.push(boxAt(COVER.width, COVER.height, COVER.depth, x, y + PLINTH.height + COVER.height / 2, z, r));
    }
    const plinths = new THREE.Mesh(mergeGeometries(plinthGeos), plinthMat);
    const covers = new THREE.Mesh(mergeGeometries(coverGeos), coverMat);
    for (const g of [...plinthGeos, ...coverGeos]) g.dispose();
    plinths.name = `NW_RetailPlinths_${floorDef.id}`;
    covers.name = `NW_RetailCovers_${floorDef.id}`;
    covers.renderOrder = 1;   // 덮개 안 제품의 투명 재질(렌즈)을 먼저 그리고 유리를 위에
    const group = new THREE.Group();
    group.name = `NW_Retail_${floorDef.id}`;
    group.add(plinths, covers);

    const sources = await Promise.all(ds.map((d) => liteSource(d.product)));
    ds.forEach((d, i) => {
      if (!sources[i]) return;
      const model = sources[i].clone(true);
      const center = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
      model.position.sub(center);   // 경계 상자 가운데를 받침 점으로
      const holder = new THREE.Group();
      holder.name = `NW_RetailProduct_${d.product.id}`;
      holder.position.set(d.pos[0], d.pos[1] + PRODUCT_CENTER_Y, d.pos[2]);
      holder.rotation.y = (d.yaw * Math.PI) / 180;
      holder.add(model);
      group.add(holder);
    });

    const tags = ds.filter((_, i) => sources[i]).map((d) => {
      const btn = el('button', 'nw-retail-tag');
      btn.type = 'button';
      btn.hidden = true;
      btn.setAttribute('aria-label', `${d.product.name} 자세히 보기`);
      btn.append(el('span', 'nw-retail-tag-name', d.product.name), el('span', 'nw-retail-tag-more', '자세히 보기'));
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        btn.blur();   // 포커스가 남으면 Space(보행 점프)가 이 버튼을 다시 누른다
        onOpen(d.product.id);
      });
      return { d, btn, shown: false, sx: NaN, sy: NaN };
    });
    shelves.set(floorDef.id, { group, pickables: [plinths, covers], displays: ds, tags });
    return { group, obstacles: [plinths, covers] };
  }

  /** 지금 보이는 층(interior.js showFloor · exit). 그 층 진열만 이름표 · 클릭을 받는다 */
  function setFloor(floorId) {
    current = (floorId && shelves.get(floorId)) || null;
    root.replaceChildren(...(current ? current.tags.map((t) => t.btn) : []));
    for (const t of current?.tags || []) {
      t.shown = false;
      t.btn.hidden = true;
    }
  }

  // 이름표: 진열에서 LABEL_RANGE 안이고 화면 안이면 덮개 위에
  const v = new THREE.Vector3();
  function update() {
    if (!current || isSuspended()) {
      root.hidden = true;
      return;
    }
    root.hidden = false;
    camera.updateMatrixWorld();
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const eye = camera.position;
    for (const t of current.tags) {
      const [x, y, z] = t.d.pos;
      let show = Math.hypot(x - eye.x, z - eye.z) <= LABEL_RANGE;
      if (show) {
        v.set(x, y + PLINTH.height + COVER.height + LABEL_LIFT, z).project(camera);
        show = v.z > -1 && v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1;
      }
      if (show !== t.shown) {
        t.btn.hidden = !show;
        t.shown = show;
      }
      if (!show) continue;
      const sx = Math.round((v.x * 0.5 + 0.5) * w);
      const sy = Math.round((-v.y * 0.5 + 0.5) * h);
      if (sx !== t.sx || sy !== t.sy) {
        t.btn.style.transform = `translate(${sx}px, ${sy}px)`;
        t.sx = sx;
        t.sy = sy;
      }
    }
  }

  // 클릭 · 탭 고르기 — 캡처 단계에서 먼저 받아, 제품을 맞혔으면 보행 화면 클릭의 마우스 고정 요청 · 스팟 조준 클릭을 막는다
  const raycaster = new THREE.Raycaster();
  raycaster.far = PICK_RANGE;
  const ndc = new THREE.Vector2();
  const down = { x: 0, y: 0 };
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      down.x = e.clientX;
      down.y = e.clientY;
    },
    true,
  );
  canvas.addEventListener(
    'click',
    (e) => {
      if (!current || isSuspended()) return;
      const locked = document.pointerLockElement === canvas;
      if (locked) ndc.set(0, 0);   // 마우스 고정 중에는 화면 가운데 조준점
      else {
        if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > CLICK_SLOP) return;
        const r = canvas.getBoundingClientRect();
        ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      }
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(current.pickables, false)[0];
      if (!hit) return;
      let best = null;
      let bestD = Infinity;
      for (const d of current.displays) {
        const dd = Math.hypot(hit.point.x - d.pos[0], hit.point.z - d.pos[2]);
        if (dd < bestD) {
          bestD = dd;
          best = d;
        }
      }
      if (failed.has(best.product.id)) return;   // 빈 받침대(모델을 못 불러옴)는 열지 않는다
      e.stopImmediatePropagation();
      onOpen(best.product.id);
    },
    true,
  );

  return { loadCatalog, catalog: () => withoutProducts(catalog, failed), liteSource, build, setFloor, update, element: root };
}
