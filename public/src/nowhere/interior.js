// HAUS NOWHERE — 성수(HAUS NOWHERE) 실내 뷰: 별도 실내 씬 · 층 GLB/HDRI 불러오기 · 진입/나가기 화면 전환 ·
// 실내 보행 지형(바닥 = 높이 격자, 바닥 · 천장 밖 = 장애물) · 1F 정문 출구 모달 · 실내 HUD.
// 외관과 같은 후처리(composer)를 쓰고 renderPass.scene 만 바꿔 끼운다. 레이아웃: assets/nowhere-inner/inner-layout.json
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { createHeightGrid, createGroundQuery, createOccupancyGrid, isBlockedAt, obstacleTopAt } from './terrain.js';
import { rasterizeMeshes, markObstacleMeshes } from './terrain-mesh.js';
import { approachFor } from './tour-config.js';

export const INNER_LAYOUT_URL = 'assets/nowhere-inner/inner-layout.json';
const FADE_MS = 600;
const EXTERIOR_WALK_FALLBACK = [-72.0, 36.5];

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// 노드 이름(자기 + 조상)에 규칙 이름이 있는지 — glTF 메시는 이름 붙은 노드 아래 자식으로 올 수 있다
function nameChain(n) {
  let s = '';
  for (let p = n; p; p = p.parent) s += `${p.name || ''}|`;
  return s;
}

export function createInterior({ renderer, camera, camCtrl, post, world, quality, modal, exteriorScene, onChange = null }) {
  const scene = new THREE.Scene();
  scene.name = 'NW_Interior';
  scene.background = new THREE.Color('#C9CECD');
  scene.add(new THREE.HemisphereLight('#F4F1EA', '#3A2A26', 1.1));
  const key = new THREE.DirectionalLight('#FFF4E6', 1.2);
  key.position.set(-8, 14, 10);
  scene.add(key);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);

  let layout = null;
  let envReady = false;
  const floorCache = new Map();
  let active = false;
  let busy = false;
  let floorDef = null;
  let floorRoot = null;
  let exitArmed = true;

  // 화면 전환(검게) + 실내 HUD
  const fade = el('div', 'nw-fade');
  const fadeText = el('div', 'nw-fade-text');
  fade.append(fadeText);
  document.body.append(fade);
  const hud = el('div', 'nw-interior-hud');
  hud.hidden = true;
  const floorLabel = el('div', 'nw-interior-floor');
  const exitBtn = el('button', 'nw-btn nw-interior-exit');
  exitBtn.type = 'button';
  const icon = document.createElement('img');
  icon.src = 'assets/inner/icons/home.svg';
  icon.alt = '';
  exitBtn.append(icon, document.createTextNode('밖으로 나가기'));
  hud.append(floorLabel, exitBtn);
  document.body.append(hud);
  exitBtn.addEventListener('click', () => exit());

  const fadeTo = (on, text = '') =>
    new Promise((res) => {
      fadeText.textContent = text;
      fade.classList.toggle('is-on', on);
      setTimeout(res, FADE_MS);
    });

  async function loadLayout() {
    if (!layout) {
      const r = await fetch(INNER_LAYOUT_URL);
      if (!r.ok) throw new Error(`inner-layout.json ${r.status}`);
      layout = await r.json();
    }
    return layout;
  }

  async function loadEnv() {
    if (envReady) return;
    const hdr = await new RGBELoader().loadAsync(layout.env);
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = pmrem.fromEquirectangular(hdr).texture;
    scene.environmentIntensity = 0.9;
    hdr.dispose();
    envReady = true;
  }

  async function loadFloor(def, onProgress) {
    if (floorCache.has(def.id)) return floorCache.get(def.id);
    const url = quality.tier === 'mobile' && def.mobileGlb ? def.mobileGlb : def.glb;
    const gltf = await loader.loadAsync(url, (e) => {
      if (e.total) onProgress(e.loaded / e.total);
    });
    const root = gltf.scene;
    root.name = `NW_InnerFloor_${def.id}`;
    root.updateMatrixWorld(true);
    const floors = [];
    const solids = [];
    root.traverse((n) => {
      if (!n.isMesh) return;
      const chain = nameChain(n);
      if (/IN_floor/.test(chain)) floors.push(n);
      else if (!/IN_ceiling/.test(chain)) solids.push(n);
    });
    const [x0, z0, x1, z1] = def.bounds;
    const grid = createHeightGrid({ x0: x0 - 1, z0: z0 - 1, x1: x1 + 1, z1: z1 + 1, cell: 0.5 });
    rasterizeMeshes(floors, () => [grid]);
    const groundAt = createGroundQuery([grid], 0);
    const occ = createOccupancyGrid({ x0: x0 - 1, z0: z0 - 1, x1: x1 + 1, z1: z1 + 1, cell: 0.25 });
    markObstacleMeshes(occ, solids, groundAt);
    const blocker = {
      isBlocked: (x, z, clearance = 0, radius = 0.35) => isBlockedAt(occ, x, z, radius, clearance),
      topAt: (x, z, radius = 0.2) => obstacleTopAt(occ, x, z, radius),
    };
    const entry = { root, groundAt, blocker };
    floorCache.set(def.id, entry);
    return entry;
  }

  function showFloor(def, entry) {
    if (floorRoot) scene.remove(floorRoot);
    floorRoot = entry.root;
    scene.add(floorRoot);
    floorDef = def;
    floorLabel.textContent = def.label;
    camCtrl.setTerrain({
      groundHeightAt: entry.groundAt,
      getWalkBlocker: () => entry.blocker,
      walkFallback: [def.spawn.pos[0], def.spawn.pos[2]],
    });
    const [x0, z0, x1, z1] = def.bounds;
    camCtrl.setBounds({ x0, z0, x1, z1, yMin: 0.4, yMax: def.ceiling - 0.3 });
  }

  /** 성수 실내 1F 로 들어간다. 성공하면 true, 실패 후 닫으면 false. */
  async function enter(buildingId = 'haus') {
    if (active || busy) return false;
    busy = true;
    try {
      await fadeTo(true, '실내로 들어가는 중…');
      await loadLayout();
      if (layout.building !== buildingId) throw new Error(`실내 없음: ${buildingId}`);
      const def = layout.floors.find((f) => f.id === layout.defaultFloor);
      await loadEnv();
      const entry = await loadFloor(def, (r) => {
        fadeText.textContent = `실내 불러오는 중… ${Math.round(r * 100)}%`;
      });
      camCtrl.stopFlight();
      camCtrl.setWalkMode(false);
      showFloor(def, entry);
      post.renderPass.scene = scene;
      active = true;
      exitArmed = true;
      document.body.classList.add('is-interior');
      hud.hidden = false;
      const start = def.entry || def.spawn;
      camCtrl.placeAt(start.pos, start.target);
      camCtrl.setWalkMode(true);
      if (typeof onChange === 'function') onChange(true);
      await fadeTo(false);
      busy = false;
      return true;
    } catch (err) {
      console.error('[nowhere] 실내 불러오기 실패', err);
      await fadeTo(false);
      busy = false;
      const choice = await modal.show({
        title: '실내를 불러오지 못했습니다',
        buttons: [
          { id: 'retry', label: '다시 시도', primary: true },
          { id: 'close', label: '닫기', cancel: true },
        ],
      });
      return choice === 'retry' ? enter(buildingId) : false;
    }
  }

  /** 실내에서 나와 외관 HAUS 정면(카메라 시점)으로 돌아간다. */
  async function exit() {
    if (!active || busy) return;
    busy = true;
    await fadeTo(true);
    camCtrl.setWalkMode(false);
    post.renderPass.scene = exteriorScene;
    camCtrl.setTerrain({
      groundHeightAt: world.groundHeightAt,
      getWalkBlocker: world.getWalkBlocker,
      walkFallback: EXTERIOR_WALK_FALLBACK,
    });
    camCtrl.setBounds(null);
    const a = approachFor(world.layout, 'haus');
    if (a) camCtrl.placeAt(a.pos, a.target);
    active = false;
    document.body.classList.remove('is-interior');
    hud.hidden = true;
    if (typeof onChange === 'function') onChange(false);
    await fadeTo(false);
    busy = false;
  }

  // 1F 정문 출구 영역: 보행 중 들어가면 한 번 묻고, 영역을 벗어났다 다시 들어오면 또 묻는다
  function update() {
    if (!active || busy || !floorDef?.exit || modal.isOpen()) return;
    const p = camera.position;
    const e = floorDef.exit;
    const inside = Math.hypot(p.x - e.pos[0], p.z - e.pos[2]) <= e.radius;
    if (inside && exitArmed && camCtrl.isWalkMode()) {
      exitArmed = false;
      modal
        .show({
          title: '밖으로 나가시겠습니까?',
          buttons: [
            { id: 'yes', label: '예', primary: true },
            { id: 'no', label: '아니오', cancel: true },
          ],
        })
        .then((c) => {
          if (c === 'yes') exit();
        });
    } else if (!inside) {
      exitArmed = true;
    }
  }

  return { enter, exit, update, isActive: () => active, currentFloor: () => (active ? floorDef?.id ?? null : null), scene };
}
