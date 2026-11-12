// HAUS NOWHERE — 성수 2041: 엔트리포인트 (웹 코어 + 기상·시간·카메라·이동체 연결)
import * as THREE from 'three';
import { detectQualityTier, getQualityConfig } from './quality.js';
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

async function boot() {
  const canvas = document.getElementById('nw-canvas');
  const loaderEl = document.getElementById('nw-loader');
  const statusEl = document.getElementById('nw-loader-status');
  const fillEl = document.getElementById('nw-loader-fill');

  const params = new URLSearchParams(window.location.search);
  const rawVer = params.get('ver') || window.__NW_DEFAULT_WORLD || 'seongsu';
  const worldVer = rawVer === 'ds2' ? 'ds2' : 'seongsu';
  document.body.dataset.worldVer = worldVer;

  const forcedTier = params.get('tier');
  const tier =
    forcedTier === 'mobile' || forcedTier === 'desktop'
      ? forcedTier
      : detectQualityTier();
  const quality = getQualityConfig(tier, worldVer);

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

  document.querySelectorAll('[data-world-ver]').forEach((btn) => {
    const isCurrent = btn.dataset.worldVer === worldVer;
    btn.classList.toggle('is-active', isCurrent);
    btn.setAttribute('aria-pressed', String(isCurrent));
    btn.addEventListener('click', () => {
      const targetVer = btn.dataset.worldVer;
      if (targetVer === worldVer) return;
      const nextParams = new URLSearchParams(window.location.search);
      nextParams.set('ver', targetVer);
      nextParams.set('noIntro', '1');   // 월드만 바꿀 때는 투어(인트로 · 건물 선택)를 처음부터 다시 돌리지 않는다
      const basePath = window.location.pathname.includes('nowhere-mountain') && targetVer === 'seongsu'
        ? '/nowhere'
        : window.location.pathname.replace(/\.html$/, '');
      const qs = nextParams.toString();
      window.location.href = qs ? `${basePath}?${qs}` : basePath;
    });
  });

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

  const walkBtn = document.getElementById('nw-btn-walk');
  const introBtn = document.getElementById('nw-btn-intro');

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
      if (walkBtn) {
        walkBtn.classList.toggle('is-active', active);
        walkBtn.setAttribute('aria-pressed', String(active));
      }
      walkHud.setState({ walk: active, locked: false });
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

  // 보행 이동 스팟: 외관은 두 건물 주변, 실내는 층마다(interior.onFloorChange 가 바꿔 끼운다)
  const exteriorSpotList = exteriorSpots(world.layout);
  let spotCutting = false;
  const markers = createSpotMarkers({
    camera,
    canvas,
    camCtrl,
    onPick: (spot) => goToSpot(spot),
    isSuspended: () => spotCutting || modal.isOpen() || help.isOpen() || interior.isBusy() || interior.isTouring(),
  });
  markers.setSpots(exteriorSpotList);

  // ── 시나리오 투어: 인트로 → 건물 선택 → 정면 비행 → 입장(성수 → 실내) / 준비중(몽골) ──
  // 모달이 뜨면 마우스 고정을 풀고, 누르던 이동 키를 비운다(질문 중에 계속 걷지 않게)
  const modal = createModal({
    onShow: () => {
      camCtrl.releasePointer();
      camCtrl.clearInput();
    },
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
    onFloorChange: (def) => markers.setSpots(def ? interiorSpots(def) : exteriorSpotList),
  });
  // 성능 표시: P 키로 켜고 끈다. 키보드 없는 기기(아이패드 등)는 주소에 ?stats=1
  // 텍스처 추정은 외관 · 실내 장면을 함께 센다(실내에 있어도 외관 텍스처는 GPU 에 남아 있음 — 메모리 한도 판단용)
  const perf = createPerfHud({ renderer, getScenes: () => [scene, interior.scene], tier: quality.tier });
  window.addEventListener('keydown', (e) => {
    if ((e.key === 'p' || e.key === 'P') && !e.metaKey && !e.ctrlKey && !e.altKey && !e.repeat) perf.toggle();
  });
  if (params.get('stats') === '1') perf.toggle(true);
  const scenario = createScenarioRunner({
    adapters: {
      // 끝까지 재생 · 사용자 입력으로 건너뜀 → 건물 선택으로, 다른 동작이 끊음 → 투어 종료
      intro: () => new Promise((resolve) => camCtrl.startIntro((reason) => resolve(reason === 'cancelled' ? CANCEL : reason))),
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
    } else if (spot.caption && interior.isActive() && !interior.isTouring()) {
      interior.showCaption(spot.caption, 4000);
    }
  }

  function startScenario(stepId) {
    if (interior.isActive()) return;
    modal.close();
    camCtrl.stopFlight();
    // 인트로 중 '건물 이동' · '투어 시작' → 인트로를 끝내고 건너뛰기와 같이 거리 시점(시야각 포함)으로 내려온 뒤 시작
    if (camCtrl.isIntroActive()) camCtrl.setPreset('street', true);
    // 시나리오가 시작되면 보행 시점은 해제한다(스펙 §1.1 — 보행 중 '건물 이동')
    if (camCtrl.isWalkMode()) camCtrl.setWalkMode(false);
    scenario.start(stepId).catch((err) => console.error('[nowhere] 투어 오류', err));
  }

  // Esc: 모달 · 조작 안내가 먼저 받고(캡처 단계), 남은 Esc 는 인트로 · 비행 중인 투어를 끝낸다
  window.addEventListener(
    'keydown',
    (e) => {
      // 조작 안내가 이미 받은 Esc(같은 창 캡처 단계라 stopPropagation 으로는 안 막힘)는 투어를 끝내지 않는다
      if (e.defaultPrevented || help.isOpen()) return;
      if (e.key !== 'Escape' || !scenario.isRunning() || interior.isActive()) return;
      if (!camCtrl.isIntroActive() && !camCtrl.isFlying()) return;
      e.preventDefault();
      e.stopPropagation();
      const wasIntro = camCtrl.isIntroActive();
      scenario.cancel();
      camCtrl.stopFlight();
      camCtrl.cancelIntro();
      // 인트로를 Esc 로 끝내면 공중에 멈추지 않고 건너뛰기와 같이 거리 시점으로 내려온다(비행은 그 자리에서 멈춤)
      if (wasIntro) camCtrl.setPreset('street', true);
    },
    true,
  );

  const initialCam = params.get('cam') || 'street';
  camCtrl.setPreset(initialCam, true);
  syncWeatherUI();

  if (!params.get('noIntro') && !params.get('cam') && !params.get('weather') && !params.get('time')) {
    startScenario('intro');
  }

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

  if (walkBtn) {
    walkBtn.addEventListener('click', () => {
      camCtrl.setWalkMode(!camCtrl.isWalkMode());
    });
  }

  if (introBtn) {
    introBtn.addEventListener('click', () => {
      startScenario('intro');
    });
  }
  const buildingsBtn = document.getElementById('nw-btn-buildings');
  if (buildingsBtn) {
    buildingsBtn.addEventListener('click', () => {
      startScenario('chooseBuilding');
    });
  }

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
    camCtrl.update(dt);
    interior.update(dt);
    markers.update(dt);

    renderer.info.reset();
    world.followSun(camera);
    post.composer.render();
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
    interior,
    scenario,
    startScenario,
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
        weather: weather.getWeather(),
        hour: weather.getHour(),
        camera: camCtrl.getPresetId(),
        walkMode: camCtrl.isWalkMode(),
        autoWalk: camCtrl.isAutoWalking(),
        introActive: camCtrl.isIntroActive(),
        interior: interior.isActive(),
        floor: interior.currentFloor(),
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
  return app;
}

boot().catch((err) => {
  console.error('[nowhere] 부팅 오류:', err);
  const statusEl = document.getElementById('nw-loader-status');
  if (statusEl) {
    statusEl.textContent = `오류: ${err.message || err}`;
  }
});
