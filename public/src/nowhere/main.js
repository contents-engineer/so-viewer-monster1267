// HAUS NOWHERE — 성수 2041: 엔트리포인트 (웹 코어 + 기상·시간·카메라·이동체 연결)
import * as THREE from 'three';
import { resolveTier, getQualityConfig } from './quality.js';
import { createWorld, updateMoverActors, updateLegacyDrones } from './world.js';
import { createPostPipeline } from './post.js';
import { createWeatherController, getPresets, parseTimeParam, TIME_QUICK, weatherNamesFor, resolveWeather } from './weather.js';
import { createRainSystem } from './rain.js';
import { createCameraController } from './camera.js';
import { createHelpOverlay, createWalkHud } from './help.js';
import { createModal } from './modal.js';
import { createScenarioRunner, CANCEL } from './scenario.js';
import { approachFor } from './tour-config.js';
import { buildFlightPath } from './flight.js';
import { SEONGSU_INTRO } from './intro-path.js';
import { createInterior } from './interior.js';
import { createPerfHud } from './perf-hud.js';
import { createFade } from './fade.js';
import { createSpotMarkers } from './spot-markers.js';
import { exteriorSpots, interiorSpots } from './walk-spots.js';
import { planWalkPath } from './walk-path.js';
import { resolveEntry } from './entry.js';
import { showWorldSelect, SELECT_FADE_MS } from './world-select.js';
import { createCinema, INTRO_TITLES } from './cinema.js';
import { showModeMenu } from './mode-menu.js';
import { createModeController } from './modes.js';
import { createRetailDisplay } from './retail-display.js';
import { createShowcase, studioEnvironment } from './showcase.js';
import { productCollection } from './products.js';

async function boot() {
  const canvas = document.getElementById('nw-canvas');
  const loaderEl = document.getElementById('nw-loader');
  const statusEl = document.getElementById('nw-loader-status');
  const fillEl = document.getElementById('nw-loader-fill');

  const params = new URLSearchParams(window.location.search);
  // 시작 결정: 일반 주소(/)는 월드 선택 화면부터 — 고르기 전에는 렌더러 · 월드를 만들지 않는다(이미지 두 장만 받음)
  const entry = resolveEntry(params, window.__NW_DEFAULT_WORLD);
  const worldVer = entry.select ? await showWorldSelect() : entry.world;
  document.body.dataset.worldVer = worldVer;

  // 등급(자산 · 효과) + 기기 구분(날으는 로드스터는 휴대폰에서 뺀다). ?tier=desktop|tablet|mobile 로 강제 — tablet = 모바일 등급 + 태블릿(시험용)
  const { tier, device } = resolveTier(params.get('tier'));
  const quality = getQualityConfig(tier, worldVer, device);

  const worldLabel = worldVer === 'ds2' ? 'DS2 산악 고원' : '성수 2041';
  const loaderKickerEl = document.querySelector('.nw-loader-kicker');
  const loaderTitleEl = document.querySelector('.nw-loader-title');
  const brandKickerEl = document.querySelector('.nw-brand-kicker');
  const brandTitleEl = document.querySelector('.nw-brand-title');

  if (worldVer === 'ds2') {
    document.title = 'HAUS NOWHERE — DS2 산악 월드';
    if (loaderKickerEl) loaderKickerEl.textContent = 'CHIRAL HIGHLAND · DS2 ARCHIVE';
    if (loaderTitleEl) loaderTitleEl.textContent = 'HAUS NOWHERE — DS2 산악 고원';
    if (brandKickerEl) brandKickerEl.textContent = 'HIGHLAND BASIN · DS2 MOUNTAIN WORLD';
    if (brandTitleEl) brandTitleEl.textContent = 'HAUS NOWHERE — 초록 이끼 & 현무암 산악 월드';

    const camLabels = {
      street: '개척로',
      aerial: '조감',
      viaduct: '협곡 상류',
      night: '산악의 밤',
      ground: '개울 근접',
      lot: '이끼 포켓',
      valley: '빙하 계곡',
    };
    // DS2 전용 7번째 시점: 참조 화면 구도(상류 개울 둑에서 겹쳐지는 층리 암벽을 바라봄)
    const camSeg = document.getElementById('nw-cam-seg');
    // 성수 전용 '2041 골목'(future) 시점은 DS2 layout 에 없으므로 숨긴다
    const futureBtn = camSeg?.querySelector('[data-cam="future"]');
    if (futureBtn) futureBtn.hidden = true;
    if (camSeg && !camSeg.querySelector('[data-cam="valley"]')) {
      const vBtn = document.createElement('button');
      vBtn.type = 'button';
      vBtn.className = 'nw-btn';
      vBtn.dataset.cam = 'valley';
      camSeg.appendChild(vBtn);
    }
    document.querySelectorAll('[data-cam]').forEach((btn) => {
      const cid = btn.dataset.cam;
      if (camLabels[cid]) btn.textContent = camLabels[cid];
    });
  } else {
    document.title = 'HAUS NOWHERE — 성수 2041';
  }

  // 선택 화면을 거쳤으면 0.3 초 겹침(world-select.js SELECT_FADE_MS)이 보이도록 한 번 양보한다 — 이어지는 렌더러 · 월드 생성(동기 약 850 ms)이 메인 스레드를 막기 전에.
  // 로더 문구는 위에서 이미 월드에 맞게 바꿨으므로 겹치는 동안 다른 월드 문구가 비치지 않는다
  if (entry.select) await new Promise((r) => setTimeout(r, SELECT_FADE_MS));

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'high-performance',
  });
  const dpr = Math.min(window.devicePixelRatio || 1, quality.maxPixelRatio);
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.info.autoReset = false;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    40,
    window.innerWidth / Math.max(1, window.innerHeight),
    0.2,
    8500,
  );
  camera.position.set(-105, 1.7, 50.2);

  const world = await createWorld({
    renderer,
    scene,
    tier,
    device,
    worldVer,
    onProgress({ ratio, label }) {
      const pct = Math.round(ratio * 100);
      if (fillEl) fillEl.style.width = `${pct}%`;
      if (statusEl) statusEl.textContent = `${worldLabel} 자산 로드 중 (${label})… ${pct}%`;
    },
  });

  const post = createPostPipeline({
    renderer,
    scene,
    camera,
    quality,
    sharedUniforms: world.uniforms,
  });

  // 기상(맑음·흐림·비·눈)과 시간(0~24시)을 따로 고른다. URL: weather=clear|overcast|rain|snow(옛 dusk·night 는 시간으로), time=21.5 | 21:30
  // 그 월드에서 고를 수 없는 기상(DS2 의 weather=clear — 월드를 바꿔도 URL 에 남는다)은 월드 기본 기상으로 되돌린다
  const initialWeather = resolveWeather(params.get('weather'), worldVer);
  const weather = createWeatherController({
    world,
    post,
    renderer,
    initialPreset: initialWeather,
    initialHour: parseTimeParam(params.get('time')),
    duration: 2.5,
    presets: getPresets(worldVer),
    sunBaseDir: world.sunBaseDir,
    worldVer,
  });
  if (worldVer === 'ds2' && post?.gradePass) {
    // 참조 화면: 역광으로 어두운 근경 + 화면 가장자리 감광
    post.gradePass.uniforms.uVignette.value = 0.34;
  }

  const rain = createRainSystem({
    scene,
    sharedUniforms: world.uniforms,
    count: quality.rainCount,
  });

  const timeSlider = document.getElementById('nw-time-slider');
  const timeReadout = document.getElementById('nw-time-readout');

  function syncWeatherUI() {
    const name = weather.getWeather();
    const hour = weather.getHour();
    document.querySelectorAll('[data-weather]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.weather === name);
    });
    document.querySelectorAll('[data-time]').forEach((btn) => {
      btn.classList.toggle('is-active', Math.abs(Number(btn.dataset.time) - hour) < 0.01);
    });
    if (timeSlider && document.activeElement !== timeSlider) timeSlider.value = String(hour);
    if (timeReadout) timeReadout.textContent = weather.getTimeLabel();
  }

  function syncCamUI(camId) {
    document.querySelectorAll('[data-cam]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.cam === camId);
    });
  }

  const walkHud = createWalkHud();
  let modes = null;   // 방식 컨트롤러 — 아래(시나리오 다음)에서 만든다. 그 전에 보행이 바뀌어도 안전하게
  const camCtrl = createCameraController({
    camera,
    canvas,
    layout: world.layout,
    groundHeightAt: world.groundHeightAt,
    getWalkBlocker: world.getWalkBlocker,
    introPath: worldVer === 'seongsu' ? SEONGSU_INTRO : null,   // 성수는 길을 따라 나는 인트로, DS2 는 기본 경로
    onPresetChange(camDef) {
      syncCamUI(camDef.id);
    },
    onWalkChange(active) {
      walkHud.setState({ walk: active, locked: false });
      modes?.syncWalk(active);   // V 키 · 실내 출입 등으로 보행이 바뀌면 방식(직접 걷기 ↔ 자유 시점)도 맞춘다
    },
    onPointerLockChange(locked) {
      walkHud.setState({ walk: camCtrl.isWalkMode(), locked });
    },
  });

  // 조작 안내(? 키 · 상단 버튼). 열 때 보행 마우스 고정을 풀고(안내를 클릭으로 닫게) 스팟 자동 걷기를 멈춘다.
  const help = createHelpOverlay({
    onOpen: () => {
      camCtrl.releasePointer();
      camCtrl.cancelWalkTo();
    },
  });

  // 화면 전환(검게): 실내 진입 · 층 이동 · 나가기와 스팟 컷 이동이 같이 쓴다
  const fade = createFade();

  // 인트로 영화식 연출(위아래 띠 · 제목 자막 · 건너뛰기 › · 진행 선) — DOM 만
  const cinema = createCinema();

  // 보행 이동 스팟: 외관은 두 건물 주변, 실내는 층마다(interior.onFloorChange 가 바꿔 끼운다)
  const exteriorSpotList = exteriorSpots(world.layout);
  let spotCutting = false;
  const markers = createSpotMarkers({
    camera,
    canvas,
    camCtrl,
    onPick: (spot) => goToSpot(spot),
    isSuspended: () => spotCutting || modal.isOpen() || help.isOpen() || interior.isBusy() || interior.isTouring() || showcase.isActive() || showcase.isBusy(),
  });
  markers.setSpots(exteriorSpotList);

  // ── 가이드 투어(시나리오): 건물 선택 → 정면 비행 → 입장(성수 → 실내) / 준비중(몽골) ──
  // 모달이 뜨면 마우스 고정을 풀고, 누르던 이동 키를 비운다(질문 중에 계속 걷지 않게)
  const modal = createModal({
    onShow: () => {
      camCtrl.releasePointer();
      camCtrl.clearInput();
    },
  });
  // 리테일 진열(실내 1F — products.json): 받침대 · 덮개 · 제품 lite, 클릭 · 탭 · 조준점 · 4 m 안 이름표 → 감상 모드
  const retail = createRetailDisplay({
    camera,
    canvas,
    getEnvMap: () => studioEnvironment(renderer),
    onOpen: (id) => openShowcase(id),
    isSuspended: () => spotCutting || modal.isOpen() || help.isOpen() || interior.isBusy() || interior.isTouring() || showcase.isActive() || showcase.isBusy(),
  });
  const interior = createInterior({
    renderer,
    camera,
    camCtrl,
    post,
    world,
    quality,
    modal,
    weather,
    exteriorScene: scene,
    isHelpOpen: () => help.isOpen(),
    fade,
    retail,
    onFloorChange: (def) => markers.setSpots(def ? interiorSpots(def, retail.catalog()) : exteriorSpotList),
    onChange: (inside) => {
      if (!inside) modes?.refresh();   // 나오면 보행 여부에 맞춰 직접 걷기 · 이전 방식으로
    },
  });
  // 제품 감상 모드: 따로 띄운 스튜디오 무대 — 감상 중에는 이 장면만 그린다(animate). 나가면 연 자리 · 시선 · 보행 여부로 되돌린다
  let showcaseReturn = null;   // { pos, target, walking }
  const showcase = createShowcase({
    renderer,
    canvas,
    quality,
    fade,
    isBlocked: () => help.isOpen() || modal.isOpen(),
    onHelp: () => help.toggle(),
    onClose: () => restoreFromShowcase(),
  });
  // 성능 표시: P 키로 켜고 끈다. 키보드 없는 기기(아이패드 등)는 주소에 ?stats=1
  // 텍스처 추정은 외관 · 실내 장면을 함께 센다(실내에 있어도 외관 텍스처는 GPU 에 남아 있음 — 메모리 한도 판단용)
  const perf = createPerfHud({ renderer, getScenes: () => [scene, interior.scene, showcase.scene], tier: quality.tier });
  window.addEventListener('keydown', (e) => {
    if ((e.key === 'p' || e.key === 'P') && !e.metaKey && !e.ctrlKey && !e.altKey && !e.repeat) perf.toggle();
  });
  if (params.get('stats') === '1') perf.toggle(true);
  const scenario = createScenarioRunner({
    adapters: {
      modal: (step) => modal.show({ title: step.title, buttons: step.buttons }),
      fly: async (step) => {
        const to = approachFor(world.layout, step.building);
        if (!to) return CANCEL;
        const from = { pos: camera.position.toArray(), target: camCtrl.controls.target.toArray() };
        const r = await camCtrl.flyTo(buildFlightPath(from, to));
        return r === 'done' ? 'done' : CANCEL;
      },
      enterInterior: async (step) => ((await interior.enter(step.building)) ? 'done' : CANCEL),
    },
  });

  // ── 보행 이동 스팟: 고르기 → 길 찾기 → 걸어가기(길이 없거나 막히면 짧은 암전 컷) → 도착 동작 ──
  function goToSpot(spot) {
    if (spotCutting || !camCtrl.isWalkMode()) return;
    if (interior.isActive() && !interior.isTouring()) interior.showCaption('');   // 다음 이동 시작 — 이전 도착 자막을 지운다
    const t0 = performance.now();
    const path = planWalkPath(camCtrl.getWalkContext(), camera.position, spot);
    console.info(`[nowhere] 스팟 길 찾기 ${spot.id}: ${path ? `${path.length}점` : '실패'} ${Math.round(performance.now() - t0)} ms`);
    const walking = path && camCtrl.walkTo(path, { look: spot.look, onArrive: () => arriveAt(spot), onStuck: () => cutToSpot(spot) });
    if (!walking) cutToSpot(spot);
  }

  async function cutToSpot(spot) {
    if (spotCutting || !camCtrl.isWalkMode()) return;
    spotCutting = true;
    camCtrl.cancelWalkTo();
    try {
      await fade.fadeTo(true, '', 300);
      const placed = camCtrl.isWalkMode() && camCtrl.placeWalk(spot.x, spot.z, spot.look);
      await fade.fadeTo(false, '', 300);
      if (placed) arriveAt(spot);
    } finally {
      spotCutting = false;
    }
  }

  function arriveAt(spot) {
    if (spot.kind === 'entrance' && spot.building === 'haus' && !interior.isActive()) {
      modal
        .show({
          title: '입장하시겠습니까?',
          buttons: [
            { id: 'yes', label: '예', primary: true },
            { id: 'no', label: '아니오', cancel: true },
          ],
        })
        .then((c) => {
          if (c === 'yes' && !interior.isActive()) interior.enter('haus');
        });
    } else if ((spot.kind === 'elevator' || spot.kind === 'exit') && interior.isActive() && !modal.isOpen()) {
      // 영역 안에서 질문을 닫고 다시 도착한 경우 — 다음 프레임 interior.update 가 질문을 다시 띄우도록 장전.
      // 컷 이동 도착은 밝아지는 사이 트리거가 이미 질문을 띄웠으므로(모달 열림) 다시 장전하지 않는다(두 번 묻지 않게)
      interior.rearmPrompt(spot.kind);
    } else if (spot.kind === 'product' && interior.isActive()) {
      openShowcase(spot.product);   // 제품 스팟에 도착하면 감상 모드
    } else if (spot.caption && interior.isActive() && !interior.isTouring()) {
      interior.showCaption(spot.caption, 4000);
    }
  }

  // ── 제품 감상 모드: 연 자리(위치 · 시선 · 보행 여부)를 적어 두고 보행 · 실내 카메라를 멈춘 뒤 무대를 연다 ──
  async function openShowcase(productId) {
    const catalog = retail.catalog();
    const floorId = interior.currentFloor();
    if (!catalog || !floorId || showcase.isActive() || showcase.isBusy() || interior.isBusy()) return;   // spotCutting 은 막지 않는다 — 컷 이동 도착(cutToSpot → arriveAt)도 여기로 온다
    showcaseReturn = { pos: camera.position.toArray(), target: camCtrl.controls.target.toArray(), walking: camCtrl.isWalkMode() };
    let opened = false;
    try {
      camCtrl.cancelWalkTo();
      camCtrl.clearInput();
      if (showcaseReturn.walking) camCtrl.setWalkMode(false);   // 보행 키 · 마우스 고정 · 스팟 · 보행 안내를 멈춘다(나올 때 다시 켠다)
      camCtrl.controls.enabled = false;                          // 무대 드래그 · 휠이 실내 카메라를 돌리지 않게
      interior.showCaption('');
      // 그 층 진열 목록 — 가벼운 모델은 진열이 받아 둔 -lite 원본(무대가 clone 해서 쓴다)
      opened = await showcase.open({
        ...productCollection(catalog, floorId, productId),
        loadLite: (item) => retail.liteSource(item.product),
      });
    } catch (err) {
      console.error('[nowhere] 제품 감상 열기 실패', err);
    }
    if (!opened) restoreFromShowcase();   // 못 열었으면(던진 경우 포함) 보행 · 실내 카메라를 연 자리 그대로 되돌린다
  }

  // 감상 모드를 나온 뒤(화면이 어두운 동안): 연 자리 · 시선 그대로, 보행 중이었으면 보행으로
  function restoreFromShowcase() {
    const r = showcaseReturn;
    showcaseReturn = null;
    camCtrl.controls.enabled = true;
    if (!r || !interior.isActive()) return;
    camCtrl.placeAt(r.pos, r.target);
    if (r.walking) {
      camCtrl.setWalkMode(true);
      // 보행을 켜면 시선이 수평으로 바뀌므로 연 순간의 시선(위 · 아래 포함)을 다시 맞춘다 — 시선 방향으로 멀리 둔 점을 본다
      const look = r.target.map((v, i) => r.pos[i] + (v - r.pos[i]) * 10);
      camCtrl.placeWalk(r.pos[0], r.pos[2], look);
    }
  }

  // ── 인트로: 12 초 비행(camCtrl.startIntro) + 영화식 연출(위아래 띠 · 제목 자막 · 건너뛰기 · 진행 선).
  // 끝나거나 건너뛰면 띠가 빠진 뒤(0.5 초) 이유('complete' | 'skipped' | 'cancelled')를 돌려준다.
  // holdHud: 띠가 빠지는 동안에도 HUD 를 숨긴 채로(독이 잠깐 보였다 사라지지 않게) — 방식 고르기가 끝나거나 방식이 적용되며 푼다 ──
  async function playIntro({ holdHud = false } = {}) {
    const t = INTRO_TITLES[worldVer];
    const reason = await new Promise((resolve) => {
      cinema.start({ kicker: t.kicker, title: t.title, onSkip: () => camCtrl.skipIntro() });
      camCtrl.startIntro((r) => resolve(r));
    });
    if (holdHud) document.body.classList.add('is-choosing');
    await cinema.end();
    return reason;
  }

  // ── 시작 흐름: (인트로 + 연출) → (방식 고르기) → 방식 적용. 바로가기 주소는 resolveEntry 가 정한 방식으로 바로 ──
  async function runEntry() {
    if (entry.intro) await playIntro({ holdHud: true });   // ?mode= 가 있어도 방식 적용 전까지 HUD 를 숨긴다(카메라 프리셋 묶음이 깜박이지 않게)
    const mode = entry.mode || (await showModeMenu({ isBlocked: () => help.isOpen() || modal.isOpen() }));
    try {
      modes.set(mode);
    } finally {
      document.body.classList.remove('is-choosing');   // 방식 고르기가 이미 풀었으면 그대로, ?mode= 로 건너뛴 경우는 여기서 푼다(적용이 던져도 HUD 가 숨은 채 남지 않게)
    }
  }

  function startScenario(stepId) {
    // 실내 · 인트로 중에는 시작하지 않는다(인트로는 시나리오 밖 시작 흐름이 돌리고, 끝나면 방식 고르기로 이어진다)
    if (interior.isActive() || camCtrl.isIntroActive()) return;
    modal.close();
    camCtrl.stopFlight();
    // 시나리오가 시작되면 보행 시점은 해제한다(가이드 투어는 궤도 카메라로 비행)
    if (camCtrl.isWalkMode()) camCtrl.setWalkMode(false);
    scenario.start(stepId).catch((err) => console.error('[nowhere] 투어 오류', err));
  }

  // 가이드 투어를 끝낸다(직접 걷기 · 자유 시점으로 바꿀 때): 떠 있는 투어 질문을 닫고 비행을 멈춘다
  function endScenario() {
    if (!scenario.isRunning()) return;
    scenario.cancel();
    modal.close();
    camCtrl.stopFlight();
  }

  // ── 방식: 가이드 투어 · 직접 걷기 · 자유 시점(body[data-mode] · 상단 #nw-mode-seg) ──
  modes = createModeController({
    camCtrl,
    startGuide: () => startScenario('chooseBuilding'),
    endGuide: endScenario,
    // 실내 출입 · 층 이동 · 둘러보기가 보행을 켰다 껐다 하는 동안은 방식을 바꾸지 않는다(나오면 interior onChange → refresh)
    isSuspended: () => interior.isActive() || interior.isBusy(),
  });
  document.querySelectorAll('#nw-mode-seg [data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.blur();   // Space(보행 점프) · Enter 가 이 버튼을 다시 누르지 않게
      modes.set(btn.dataset.mode);
    });
  });

  // 월드 전환: 다른 월드를 새 월드의 인트로부터 다시 열고, 인트로가 끝나면 지금 방식 그대로 이어 간다(?ver=…&mode=… — 선택 화면 · 방식 고르기 없음)
  document.querySelectorAll('.nw-world-switch [data-world-ver]').forEach((btn) => {
    const isCurrent = btn.dataset.worldVer === worldVer;
    btn.classList.toggle('is-active', isCurrent);
    btn.setAttribute('aria-pressed', String(isCurrent));
    btn.addEventListener('click', () => {
      const targetVer = btn.dataset.worldVer;
      if (targetVer === worldVer) return;
      const nextParams = new URLSearchParams(window.location.search);
      nextParams.set('ver', targetVer);
      nextParams.set('mode', modes.get() || 'free');
      // 인트로를 막는 값(noIntro · cam · weather · time — resolveEntry 의 바로가기 조건)은 지운다. 새 월드는 기본 기상 · 시각으로 인트로부터
      nextParams.delete('noIntro');
      nextParams.delete('cam');
      nextParams.delete('weather');
      nextParams.delete('time');
      const basePath = window.location.pathname.includes('nowhere-mountain') && targetVer === 'seongsu'
        ? '/nowhere'
        : window.location.pathname.replace(/\.html$/, '');
      window.location.href = `${basePath}?${nextParams.toString()}`;
    });
  });

  // Esc: 모달 · 조작 안내 · 방식 고르기가 먼저 받고(캡처 단계), 남은 Esc 는 인트로를 건너뛰거나 비행 중인 투어를 끝낸다
  window.addEventListener(
    'keydown',
    (e) => {
      // 조작 안내가 이미 받은 Esc(같은 창 캡처 단계라 stopPropagation 으로는 안 막힘)는 건너뛰지 않는다
      if (e.defaultPrevented || help.isOpen()) return;
      if (e.key !== 'Escape' || interior.isActive()) return;
      if (camCtrl.isIntroActive()) {
        // 인트로 중 Esc = 건너뛰기(거리 시점으로 바로 내려오고 인트로 뒤 흐름을 이어 간다)
        e.preventDefault();
        e.stopPropagation();
        camCtrl.skipIntro();
        return;
      }
      if (!scenario.isRunning() || !camCtrl.isFlying()) return;
      // 건물 비행 중 Esc = 투어 끝내기(비행은 그 자리에서 멈춤)
      e.preventDefault();
      e.stopPropagation();
      scenario.cancel();
      camCtrl.stopFlight();
    },
    true,
  );

  const initialCam = params.get('cam') || 'street';
  camCtrl.setPreset(initialCam, true);
  syncWeatherUI();

  // 옛 이름 호환: overcast·rain·snow → 기상, dusk·night → 시간
  function setWeatherPreset(name, instant = false) {
    weather.setPreset(name, instant);
    syncWeatherUI();
  }

  function setWeather(name, instant = false) {
    weather.setWeather(name, instant);
    syncWeatherUI();
  }

  function setTimeOfDay(hour, instant = false) {
    weather.setTime(hour, instant);
    syncWeatherUI();
  }

  function setCameraPreset(camId, instant = false) {
    const camDef = camCtrl.setPreset(camId, instant);
    // '밤' 카메라 프리셋은 기상은 그대로 두고 시각만 밤으로 맞춘다(비 오는 밤 등 유지)
    const h = weather.getHour();
    if (camDef?.mood === 'night' && h >= 5 && h < 19.5) {
      setTimeOfDay(TIME_QUICK.night, instant);
    }
    return camDef;
  }

  const weatherNames = weatherNamesFor(worldVer);
  document.querySelectorAll('[data-weather]').forEach((btn) => {
    btn.hidden = !weatherNames.includes(btn.dataset.weather);   // DS2 에서는 '맑음' 을 숨긴다
  });

  document.querySelectorAll('[data-weather]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setWeather(btn.dataset.weather, false);
    });
  });

  document.querySelectorAll('[data-time]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setTimeOfDay(Number(btn.dataset.time), false);
    });
  });

  if (timeSlider) {
    timeSlider.addEventListener('input', () => {
      setTimeOfDay(Number(timeSlider.value), false);
    });
    // 슬라이더에서 손을 떼면 포커스를 풀어, 보행 이동·시선 키가 슬라이더로 가지 않게 한다
    const release = () => timeSlider.blur();
    timeSlider.addEventListener('pointerup', release);
    timeSlider.addEventListener('touchend', release);
  }

  document.querySelectorAll('[data-cam]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setCameraPreset(btn.dataset.cam, false);
    });
  });

  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = Math.max(1, window.innerHeight);
    const nextDpr = Math.min(window.devicePixelRatio || 1, quality.maxPixelRatio);
    renderer.setPixelRatio(nextDpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    post.setSize(w, h, nextDpr);
  });

  if (loaderEl) {
    loaderEl.classList.add('is-hidden');
  }

  const clock = new THREE.Clock();
  let fpsFrames = 0;
  let fpsAccum = 0;
  let currentFps = 60;

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);
    const elapsed = clock.elapsedTime;
    world.uniforms.uTime.value = elapsed;

    fpsFrames += 1;
    fpsAccum += dt;
    if (fpsAccum >= 0.5) {
      currentFps = Math.round((fpsFrames / fpsAccum) * 10) / 10;
      fpsFrames = 0;
      fpsAccum = 0;
    }

    weather.update(dt);
    rain.update();
    updateMoverActors(world.moverActors, elapsed);
    updateLegacyDrones(world.legacyDrones, elapsed);   // DS2(옛 layout.drones)
    // 감상 중에는 실내 카메라 · 실내 갱신을 멈추고 감상 무대만 그린다(외관 · 실내 · 후처리 없음)
    const studio = showcase.isActive();
    if (!studio) {
      camCtrl.update(dt);
      if (cinema.isActive() && camCtrl.isIntroActive()) cinema.progress(camCtrl.getIntroProgress());   // 인트로 진행 선(경과 / 12 초) — 끝난 뒤 띠가 빠지는 동안 0 으로 되돌지 않게
      interior.update(dt);
    }
    markers.update(dt);
    retail.update();

    renderer.info.reset();
    if (studio) {
      showcase.update(dt);
      showcase.render();
    } else {
      world.followSun(camera);
      post.composer.render();
    }
    perf.frame(performance.now());   // 꺼져 있으면 바로 돌아간다
  }

  animate();

  const app = {
    renderer,
    scene,
    camera,
    controls: camCtrl.controls,
    camCtrl,
    weather,
    rain,
    help,
    modal,
    markers,
    retail,
    showcase,
    openShowcase,
    cinema,
    interior,
    scenario,
    startScenario,
    modes,
    entry,
    world,
    post,
    quality,
    setCameraPreset,
    setWeatherPreset,
    setWeather,
    setTimeOfDay,
    getStats() {
      return {
        worldVer: quality.worldVer,
        tier: quality.tier,
        device: quality.device,
        weather: weather.getWeather(),
        hour: weather.getHour(),
        camera: camCtrl.getPresetId(),
        mode: modes.get(),
        walkMode: camCtrl.isWalkMode(),
        autoWalk: camCtrl.isAutoWalking(),
        introActive: camCtrl.isIntroActive(),
        interior: interior.isActive(),
        floor: interior.currentFloor(),
        showcase: showcase.isActive() ? showcase.getState().itemId : null,
        scenarioStep: scenario.current(),
        fps: currentFps,
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
      };
    },
  };
  window.__NW_APP = app;
  // 시작 흐름은 렌더 루프를 돌린 채 이어 간다(인트로 · 방식 고르기를 기다리는 동안에도 화면이 그려지게)
  runEntry().catch((err) => console.error('[nowhere] 시작 흐름 오류', err));
  return app;
}

boot().catch((err) => {
  console.error('[nowhere] 부팅 오류:', err);
  const statusEl = document.getElementById('nw-loader-status');
  if (statusEl) {
    statusEl.textContent = `오류: ${err.message || err}`;
  }
});
