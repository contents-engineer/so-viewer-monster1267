// HAUS NOWHERE — 성수(HAUS NOWHERE) 실내 뷰(B1F · 1F · 12F · 13F): 별도 실내 씬 · 층 GLB/HDRI 불러오기 · 진입/나가기 ·
// 엘리베이터 층 이동(HUD 층 버튼 · 엘리베이터 문 앞 「층 선택」) · 층 둘러보기(첫 지점 컷 · tour 지점 비행 + 자막) · 창밖(외관 CubeCamera 캡처) ·
// 밤 조명 · 1F 디스플레이 화면 · 실내 보행 지형(바닥 = 높이 격자, 바닥 · 천장 밖 = 장애물, 층 영역 밖 막힘) · 1F 정문 출구 · 실내 HUD.
// 외관과 같은 후처리(composer)를 쓰고 renderPass.scene 만 바꿔 끼운다. 레이아웃: assets/nowhere-inner/inner-layout.json
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { createHeightGrid, createGroundQuery, createOccupancyGrid, isBlockedAt, obstacleTopAt } from './terrain.js';
import { rasterizeMeshes, markObstacleMeshes } from './terrain-mesh.js';
import { approachFor } from './tour-config.js';
import { floorOrder, shortLabel, elevatorButtons, inArea, createAreaTrigger, isFloorChain, isCeilingChain } from './inner-nav.js';
import { createTourPlayer } from './inner-tour.js';
import { createWindowView, hasWindowView, viewKey, interiorLighting, VIEW_SETTLE_MS } from './inner-view.js';
import { createDisplayScreen, nowClockText } from './inner-display.js';
import { clockText } from './weather.js';
import { createFade, FADE_MS } from './fade.js';

export const INNER_LAYOUT_URL = 'assets/nowhere-inner/inner-layout.json';
const FLOOR_FADE_MS = 400;
const TOUR_CUT_MS = 300;   // 둘러보기 첫 지점으로 옮길 때 어둡게 · 밝게 각각
const EXTERIOR_WALK_FALLBACK = [-72.0, 36.5];
const BG_COLOR = '#C9CECD';
const HOME_ICON = 'assets/inner/icons/home.svg';

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// 노드 이름 사슬(자기 + 조상) — glTF 메시는 이름 붙은 노드 아래 자식으로 올 수 있다
function nameChain(n) {
  let s = '';
  for (let p = n; p; p = p.parent) s += `${p.name || ''}|`;
  return s;
}

export function createInterior({ renderer, camera, camCtrl, post, world, quality, modal, weather = null, exteriorScene, isHelpOpen = () => false, onChange = null, fade = null, onFloorChange = null, retail = null }) {
  const mobile = quality.tier === 'mobile';
  const scene = new THREE.Scene();
  scene.name = 'NW_Interior';
  scene.background = new THREE.Color(BG_COLOR);
  // 처음 값은 낮 조명(applyLighting 이 uNight 에 따라 바꾼다)
  const L0 = interiorLighting(0, mobile);
  const hemi = new THREE.HemisphereLight(L0.hemiSky, L0.hemiGround, L0.hemiIntensity);
  // 모바일은 HDRI 환경광을 받지 않으므로(진입 예산) 고른 채움광으로 천장 · 바닥이 어둡게 가라앉지 않게 한다
  const ambient = new THREE.AmbientLight('#EDEAE4', L0.ambient);
  const key = new THREE.DirectionalLight(L0.keyColor, L0.keyIntensity);
  key.position.set(-8, 14, 10);
  scene.add(hemi, ambient, key);

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const view = createWindowView({ THREE, renderer, exteriorScene, world, far: camera.far });

  let layout = null;
  let envReady = false;
  const floorCache = new Map();
  let active = false;
  let busy = false;
  let floorDef = null;
  let floorRoot = null;
  let fovBefore = null;    // 진입 직전 외관 카메라 시야각
  let promptOpen = false;  // 출구 · 층 선택 질문이 떠 있는지
  let display = null;      // 1F 디스플레이 화면
  let lastNight = -1;
  let lastViewKey = null;
  let viewDirtyAt = 0;
  const exitTrigger = createAreaTrigger();
  const elevatorTrigger = createAreaTrigger();

  // 화면 전환(검게) — main.js 가 넘긴 공용 레이어(보행 스팟 컷 이동과 같이 씀). 없으면 직접 만든다
  const fader = fade || createFade();

  // 실내 HUD: 층 이름 · 층 버튼 · 이 층 둘러보기 · 밖으로 나가기 + 하단 둘러보기 자막
  const hud = el('div', 'nw-interior-hud');
  hud.hidden = true;
  const floorLabel = el('div', 'nw-interior-floor');
  const floorNav = el('div', 'nw-interior-floors');
  floorNav.setAttribute('role', 'group');
  floorNav.setAttribute('aria-label', '층 이동');
  const tourBtn = el('button', 'nw-btn nw-interior-tour', '이 층 둘러보기');
  tourBtn.type = 'button';
  const exitBtn = el('button', 'nw-btn nw-interior-exit');
  exitBtn.type = 'button';
  const icon = document.createElement('img');
  icon.alt = '';
  exitBtn.append(icon, document.createTextNode('밖으로 나가기'));
  hud.append(floorLabel, floorNav, tourBtn, exitBtn);
  const caption = el('div', 'nw-interior-caption');
  caption.hidden = true;
  caption.setAttribute('aria-live', 'polite');
  document.body.append(hud, caption);
  // 하단 자막: 둘러보기(tour) 자막과 보행 스팟 도착 자막(showCaption, 시간이 지나면 지움)이 같이 쓴다
  let captionTimer = null;
  function setCaption(text) {
    clearTimeout(captionTimer);
    captionTimer = null;
    caption.textContent = text;
    caption.hidden = !text;
  }
  /** 보행 스팟 도착 자막(실내에서만): ms 뒤 지운다. 둘러보기 · 층 이동 · 나가기가 덮어쓰거나 지운다 */
  function showCaption(text, ms = 4000) {
    if (!active) return;
    setCaption(text);
    if (text) captionTimer = setTimeout(() => setCaption(''), ms);
  }
  const floorBtns = new Map();

  const tour = createTourPlayer({
    camCtrl,
    getView: () => ({ pos: camera.position.toArray(), target: camCtrl.controls.target.toArray() }),
    showCaption: (text) => setCaption(text),
    // 첫 지점은 비행 대신 짧은 화면 전환 컷 — 사용자가 걸어간 어느 자리에서 시작해도 직선 비행이 전시물(1F 도시 모형 등)을 뚫지 않게
    cut: async ({ pos, target, isCurrent }) => {
      camCtrl.setWalkMode(false);   // 비행(flyTo)처럼 둘러보기 시작에 보행을 끈다 — 컷 도중 멈춰도 같은 상태
      await fadeTo(true, '', TOUR_CUT_MS);
      if (busy) return;   // 그사이 층 이동 · 나가기가 화면 전환을 넘겨받았다(밝히지 않는다)
      if (isCurrent()) camCtrl.placeAt(pos, target);   // 입력으로 멈췄으면(또는 다시 시작했으면) 옮기지 않고 그 자리에서 밝힌다
      await fadeTo(false, '', TOUR_CUT_MS);
    },
  });
  /** 지금 층 둘러보기를 시작한다 → 끝 약속('done' 끝까지 | 'stopped' 입력 · 층 이동 · 나가기 · stopTour 로 멈춤). 실내가 아니거나 전환 중 · 둘러볼 곳이 없으면 null.
   *  「이 층 둘러보기」 버튼과 발표 모드(kiosk.js — 끝나면 다음 층)가 같이 쓴다. 끝난 뒤 보행으로 돌아가는 것은 버튼 쪽만 */
  function playTour() {
    if (!active || busy || !floorDef?.tour?.length) return null;
    return tour.play(floorDef.tour);
  }
  tourBtn.addEventListener('click', () => {
    // 포커스를 풀어 Enter 를 누르고 있을 때 키 반복이 버튼을 다시 눌러 둘러보기를 처음부터 시작하지 않게
    tourBtn.blur();
    const floorId = floorDef?.id;
    const played = playTour();
    if (!played) return;
    played.then((r) => {
      // 끝까지 보면 마지막 지점에서 보행으로 돌아간다(지점은 전시물 밖 — 보행이 지면 눈높이로 붙임). 입력으로 멈췄으면(stopped) 그 자리에서 보행 꺼진 채.
      // 모달 · 도움말이 떠 있으면 켜지 않는다(읽는 동안 그 뒤에서 시점이 눈높이로 바뀌고 보행 안내가 뜨지 않게)
      if (r === 'done' && active && !busy && floorDef?.id === floorId && !modal.isOpen() && !isHelpOpen()) camCtrl.setWalkMode(true);
    });
  });
  exitBtn.addEventListener('click', () => exit());
  // 둘러보기 중 아무 입력(키 · 화면 클릭 · 휠)이면 멈추고 그 자리에서 자유 이동 — 비행 중 입력은 camera.js 가 먼저 끊는다
  const stopTourOnInput = () => {
    if (tour.isPlaying()) tour.stop();
  };
  // ⌘ · Ctrl 조합(스크린샷 · 탭 전환 등)은 camera.js 처럼 둘러보기를 멈추지 않는다
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey) return;
    stopTourOnInput();
  });
  renderer.domElement.addEventListener('pointerdown', stopTourOnInput);
  renderer.domElement.addEventListener('wheel', stopTourOnInput, { passive: true });

  const fadeTo = (on, text = '', ms = FADE_MS) => fader.fadeTo(on, text, ms);

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
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(hdr).texture;
    scene.environmentIntensity = L0.envIntensity;   // 첫 update 의 applyLighting 이 지금 uNight 값으로 맞춘다
    hdr.dispose();
    pmrem.dispose();
    envReady = true;
  }

  async function loadFloor(def, onProgress) {
    if (floorCache.has(def.id)) return floorCache.get(def.id);
    const url = quality.tier === 'mobile' && def.mobileGlb ? def.mobileGlb : def.glb;
    // 리테일 진열(products.json 의 이 층 — 받침대 · 덮개 · 제품 lite)은 층 GLB 와 함께 받는다. 실패해도 층은 연다(진열만 빠짐)
    const shelfPromise = retail
      ? retail.build(def).catch((err) => {
        console.error('[nowhere] 진열 불러오기 실패', err);
        return null;
      })
      : Promise.resolve(null);
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
      if (isFloorChain(chain)) floors.push(n);
      else if (!isCeilingChain(chain)) solids.push(n);
      // 전시물(EX_*) 원본 재질이 BLEND 로 들어오면(텍스처 알파는 불투명) 깊이를 쓰지 않아 뒷면 · 먼 면이 앞에 그려지므로 불투명으로 바꾼다
      const m = n.material;
      if (/(^|\|)EX_/.test(chain) && m && m.transparent && m.opacity >= 1) {
        m.transparent = false;
        m.depthWrite = true;
      }
    });
    // 진열은 층 장면에 붙여 층과 함께 보이고 사라진다(showFloor). 받침대 · 덮개는 아래 점유 격자에 보행 장애물로 더한다
    const shelf = await shelfPromise;
    if (shelf) {
      root.add(shelf.group);
      shelf.group.updateMatrixWorld(true);
    }
    const [x0, z0, x1, z1] = def.bounds;
    const grid = createHeightGrid({ x0: x0 - 1, z0: z0 - 1, x1: x1 + 1, z1: z1 + 1, cell: 0.5 });
    rasterizeMeshes(floors, () => [grid]);
    const groundAt = createGroundQuery([grid], 0);
    const occ = createOccupancyGrid({ x0: x0 - 1, z0: z0 - 1, x1: x1 + 1, z1: z1 + 1, cell: 0.25 });
    markObstacleMeshes(occ, shelf ? [...solids, ...shelf.obstacles] : solids, groundAt);
    // 층 영역(벽 안쪽) 밖은 막는다 — 1F 정문 열림으로 걸어 나가면 바닥 없는 바깥으로 빠지므로(나가기는 출구 모달 · 버튼으로)
    const insideFloor = (x, z, r) => x >= x0 + r && x <= x1 - r && z >= z0 + r && z <= z1 - r;
    const blocker = {
      isBlocked: (x, z, clearance = 0, radius = 0.35) => !insideFloor(x, z, radius) || isBlockedAt(occ, x, z, radius, clearance),
      topAt: (x, z, radius = 0.2) => obstacleTopAt(occ, x, z, radius),
    };
    // 1F 디스플레이 화면(빌드가 만든 EX_display_screen)에 월드 시각 · 기상 캔버스를 입힌다
    if (!display) {
      const s = root.getObjectByName('EX_display_screen');
      const mesh = s?.isMesh ? s : s?.children.find((m) => m.isMesh);
      if (mesh) {
        // 캔버스 비율을 화면 사각형(가로 = 수평 폭, 세로 = 높이)에 맞춘다 — 2:1 기본 캔버스면 글자가 세로로 늘어나 보이므로
        const size = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3());
        const aspect = Math.max(size.x, size.z) / Math.max(size.y, 1e-3);
        display = createDisplayScreen({
          THREE,
          mesh,
          getWeather: () => weather?.getWeather?.() ?? '',
          width: 1024,
          height: Math.round(1024 / aspect),
        });
      }
    }
    const entry = { root, groundAt, blocker };
    floorCache.set(def.id, entry);
    return entry;
  }

  function buildFloorNav() {
    if (floorBtns.size) return;
    for (const f of floorOrder(layout)) {
      const b = el('button', 'nw-btn nw-interior-floor-btn', shortLabel(f));
      b.type = 'button';
      b.title = f.label;
      b.addEventListener('click', () => {
        b.blur();   // 키 반복 · Space 가 포커스 남은 층 버튼을 다시 누르지 않게
        goToFloor(f.id);
      });
      floorNav.append(b);
      floorBtns.set(f.id, b);
    }
  }

  function markCurrent() {
    for (const [id, b] of floorBtns) {
      const cur = id === floorDef?.id;
      b.classList.toggle('is-active', cur);
      b.setAttribute('aria-pressed', String(cur));
    }
  }

  // 밤 조명: uNight 에 따라 따뜻하게 · 어둡게(환경광 세기 포함). 값이 바뀔 때만 다시 넣는다
  function applyLighting() {
    const night = world.uniforms?.uNight?.value ?? 0;
    if (Math.abs(night - lastNight) < 0.002) return;
    lastNight = night;
    const L = interiorLighting(night, mobile);
    hemi.color.set(L.hemiSky);
    hemi.groundColor.set(L.hemiGround);
    hemi.intensity = L.hemiIntensity;
    key.color.set(L.keyColor);
    key.intensity = L.keyIntensity;
    ambient.intensity = L.ambient;
    scene.environmentIntensity = L.envIntensity;   // 모바일은 environment 가 없어 영향 없음
  }

  // 창밖: 그 층 높이에서 외관을 캡처해 배경으로(지하는 단색).
  // 캡처가 던져도 단색 배경으로 두고 계속한다 — 층 전환(showFloor)이 반쯤 바뀐 채 멈추거나 매 프레임 다시 던지지 않게
  function refreshView() {
    try {
      scene.background = hasWindowView(floorDef) ? view.capture(floorDef.elevation) : new THREE.Color(BG_COLOR);
    } catch (err) {
      scene.background = new THREE.Color(BG_COLOR);
      console.error('[nowhere] 창밖 캡처 실패', err);
    }
    lastViewKey = weather ? viewKey(weather.getWeather(), weather.getHour()) : null;
    viewDirtyAt = 0;
  }

  function showFloor(def, entry) {
    if (floorRoot) scene.remove(floorRoot);
    floorRoot = entry.root;
    scene.add(floorRoot);
    floorDef = def;
    floorLabel.textContent = def.label;
    markCurrent();
    camCtrl.setTerrain({
      groundHeightAt: entry.groundAt,
      getWalkBlocker: () => entry.blocker,
      walkFallback: [def.spawn.pos[0], def.spawn.pos[2]],
    });
    const [x0, z0, x1, z1] = def.bounds;
    camCtrl.setBounds({ x0, z0, x1, z1, yMin: 0.4, yMax: def.ceiling - 0.3 });
    refreshView();
    // 진입 · 층 이동 중(busy)에는 기상 · 시각 변화를 못 보므로, 방금 캡처가 전환 도중이었을 수 있다 — 도착 뒤 VIEW_SETTLE_MS 에 한 번 더 찍는다
    if (hasWindowView(def)) viewDirtyAt = performance.now();
    exitTrigger.reset();
    elevatorTrigger.reset();
    setCaption('');
    retail?.setFloor(def.id);   // 이 층 진열만 이름표 · 클릭을 받는다
    if (typeof onFloorChange === 'function') onFloorChange(def);   // 보행 이동 스팟을 이 층 것으로
  }

  function closePrompt() {
    if (promptOpen) modal.close();
  }

  /** 성수 실내 1F 로 들어간다. 성공하면 true, 실패 후 닫으면 false. */
  async function enter(buildingId = 'haus') {
    if (active || busy) return false;
    busy = true;
    try {
      await fadeTo(true, '실내로 들어가는 중…');
      await loadLayout();
      if (layout.building !== buildingId) throw new Error(`실내 없음: ${buildingId}`);
      buildFloorNav();
      if (!icon.getAttribute('src')) icon.src = HOME_ICON;   // 실내에 처음 들어갈 때 받는다(외관 첫 로딩 변화 없음)
      const def = layout.floors.find((f) => f.id === layout.defaultFloor);
      // 모바일은 외관처럼 HDRI 를 받지 않는다(진입 추가 다운로드 ≤ 4 MB — 1F 모바일 GLB 만). 반구광 · 채움광으로 비춘다
      if (quality.tier !== 'mobile') await loadEnv();
      const entry = await loadFloor(def, (r) => {
        fader.setText(`실내 불러오는 중… ${Math.round(r * 100)}%`);
      });
      camCtrl.stopFlight();
      camCtrl.setWalkMode(false);
      fovBefore = camera.fov;   // 나갈 때 외관 구도의 시야각으로 되돌린다(보행 시야각 50° 가 남지 않게)
      showFloor(def, entry);
      post.renderPass.scene = scene;
      weather?.setInterior?.(true);   // 실내는 맑은 낮 룩(노출 · 채도 · 그레이딩)을 쓰지 않는다
      active = true;
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
      // 실패 모달이 떠 있는 동안에도 busy 를 유지한다 — 그 사이 enter 가 다시 불려 진입이 겹치지 않게
      const choice = await modal.show({
        title: '실내를 불러오지 못했습니다',
        buttons: [
          { id: 'retry', label: '다시 시도', primary: true },
          { id: 'close', label: '닫기', cancel: true },
        ],
      });
      busy = false;
      return choice === 'retry' ? enter(buildingId) : false;
    }
  }

  /** 엘리베이터: 다른 층으로(0.4 초 어둡게 → 그 층 GLB · 창밖 → 그 층 spawn 에서 보행). 성공하면 true. */
  async function goToFloor(id) {
    if (!active || busy || id === floorDef?.id) return false;
    const def = layout.floors.find((f) => f.id === id);
    if (!def) return false;
    busy = true;
    tour.stop();
    closePrompt();
    try {
      await fadeTo(true, '층 이동 중…', FLOOR_FADE_MS);
      const entry = await loadFloor(def, (r) => {
        fader.setText(`층 불러오는 중… ${Math.round(r * 100)}%`);
      });
      camCtrl.setWalkMode(false);
      showFloor(def, entry);
      camCtrl.placeAt(def.spawn.pos, def.spawn.target);
      camCtrl.setWalkMode(true);
      await fadeTo(false, '', FLOOR_FADE_MS);
      busy = false;
      return true;
    } catch (err) {
      console.error('[nowhere] 층 불러오기 실패', err);
      await fadeTo(false, '', FLOOR_FADE_MS);
      const choice = await modal.show({
        title: '층을 불러오지 못했습니다',
        buttons: [
          { id: 'retry', label: '다시 시도', primary: true },
          { id: 'close', label: '닫기', cancel: true },
        ],
      });
      busy = false;
      return choice === 'retry' ? goToFloor(id) : false;
    }
  }

  /** 실내에서 나와 외관 HAUS 정면으로 돌아간다. 보행 중이었으면 밖에서도 그 자리(정면 지면 눈높이)에서 보행을 이어 간다. */
  async function exit() {
    if (!active || busy) return;
    busy = true;
    tour.stop();
    closePrompt();   // 출구 · 층 선택 질문이 떠 있으면 닫는다(외관에 남거나 다음 방문에 응답되지 않게)
    try {
      await fadeTo(true);
      // 실내 ↔ 외관 전환이 보행 여부를 바꾸지 않게(1F 출구는 보행 중에만 묻는다). placeAt 이 보행을 끄므로 옮긴 뒤 다시 켠다
      const wasWalking = camCtrl.isWalkMode();
      camCtrl.setWalkMode(false);
      post.renderPass.scene = exteriorScene;
      weather?.setInterior?.(false);
      camCtrl.setTerrain({
        groundHeightAt: world.groundHeightAt,
        getWalkBlocker: world.getWalkBlocker,
        walkFallback: EXTERIOR_WALK_FALLBACK,
      });
      camCtrl.setBounds(null);
      const a = approachFor(world.layout, 'haus');
      if (a) camCtrl.placeAt(a.pos, a.target);
      if (fovBefore) {
        camera.fov = fovBefore;
        camera.updateProjectionMatrix();
      }
      if (wasWalking) camCtrl.setWalkMode(true);   // 외관 지면 · 장애물로 바꾼 뒤라 정면 지면 위 1.7 m 에서 시작
      active = false;
      document.body.classList.remove('is-interior');
      hud.hidden = true;
      setCaption('');
      retail?.setFloor(null);
      if (typeof onFloorChange === 'function') onFloorChange(null);   // 보행 이동 스팟을 외관 것으로
      if (typeof onChange === 'function') onChange(false);
    } finally {
      // 중간에 예외가 나도 검은 화면 · busy 에 갇히지 않게
      await fadeTo(false);
      busy = false;
    }
  }

  function askExit() {
    promptOpen = true;
    modal
      .show({
        title: '밖으로 나가시겠습니까?',
        buttons: [
          { id: 'yes', label: '예', primary: true },
          { id: 'no', label: '아니오', cancel: true },
        ],
      })
      .then((c) => {
        promptOpen = false;
        if (c === 'yes' && active) exit();
      });
  }

  function askFloor() {
    promptOpen = true;
    modal.show({ title: '층 선택', buttons: elevatorButtons(layout, floorDef.id) }).then((c) => {
      promptOpen = false;
      if (c && c !== 'close' && active) goToFloor(c);
    });
  }

  function update() {
    if (!active) return;
    applyLighting();
    // 1F 디스플레이는 월드 시각(HUD 시간 슬라이더와 같은 값) · 기상을 보여 준다
    if (display && floorDef?.id === '1') display.update(weather ? clockText(weather.getHour()) : nowClockText());
    // 기상 · 시각이 바뀌면 전환이 끝난 뒤(VIEW_SETTLE_MS) 창밖을 다시 캡처한다
    if (weather && !busy && hasWindowView(floorDef)) {
      const k = viewKey(weather.getWeather(), weather.getHour());
      const now = performance.now();
      if (k !== lastViewKey) {
        lastViewKey = k;
        viewDirtyAt = now;
      } else if (viewDirtyAt && now - viewDirtyAt >= VIEW_SETTLE_MS) {
        refreshView();
      }
    }
    // 보행 중 1F 정문 출구 · 엘리베이터 문 앞에 들어가면 한 번 묻고, 영역을 벗어났다 다시 들어오면 또 묻는다
    if (busy || !floorDef || modal.isOpen()) return;
    const p = camera.position;
    const walking = camCtrl.isWalkMode();
    if (floorDef.exit && exitTrigger.update(inArea(p, floorDef.exit), walking)) askExit();
    else if (floorDef.elevator && elevatorTrigger.update(inArea(p, floorDef.elevator), walking)) askFloor();
  }

  return {
    enter,
    exit,
    goToFloor,
    // 아카이브 목록(main.js): 들어가지 않고 inner-layout 만 받는다(받았으면 그대로 — 들어갈 때도 같은 값)
    loadLayout,
    update,
    isActive: () => active,
    currentFloor: () => (active ? floorDef?.id ?? null : null),
    // 전시물 감상(main.js openExhibit): 활성 층 정의(inner-layout 층 — exhibits · label) · 층 루트(EX_* 노드를 복제해 무대에) — 실내가 아니면 null
    currentFloorDef: () => (active ? floorDef : null),
    currentRoot: () => (active ? floorRoot : null),
    isTouring: () => tour.isPlaying(),
    playTour,
    stopTour: () => tour.stop(),
    isBusy: () => busy,
    showCaption,
    /** 엘리베이터 · 출구 영역 트리거를 다시 장전 — 영역 안에서 질문을 닫은 뒤 스팟으로 다시 도착했을 때 질문이 다시 뜨게 */
    rearmPrompt: (kind) => (kind === 'elevator' ? elevatorTrigger : kind === 'exit' ? exitTrigger : null)?.reset(),
    scene,
  };
}
