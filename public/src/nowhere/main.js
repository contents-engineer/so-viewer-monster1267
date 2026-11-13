// HAUS NOWHERE — 성수 2041: 엔트리포인트 (웹 코어 + 기상·시간·카메라·이동체 연결)
import * as THREE from 'three';
import { resolveTier, getQualityConfig } from './quality.js';
import { createWorld, updateMoverActors, updateLegacyDrones } from './world.js';
import { createPostPipeline } from './post.js';
import { createWeatherController, getPresets, parseTimeParam, TIME_QUICK, weatherNamesFor, resolveWeather } from './weather.js';
import { createRainSystem } from './rain.js';
import { createCameraController, ORBIT_CLEARANCE } from './camera.js';
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
import { planWalkPath, walkPredicates, nearestFreePoint } from './walk-path.js';
import { resolveEntry, parsePose, sameSpotUrl, worldSwitchUrl, shiftLook, sameSpotLook, snapPose, liftPose, SAME_SPOT_FADE_MS, SAME_SPOT_SNAP_M, WORLD_IDS } from './entry.js';
import { showWorldSelect, SELECT_FADE_MS } from './world-select.js';
import { createCinema, INTRO_TITLES } from './cinema.js';
import { showModeMenu } from './mode-menu.js';
import { createModeController } from './modes.js';
import { createRetailDisplay } from './retail-display.js';
import { createShowcase, studioEnvironment } from './showcase.js';
import { productCollection } from './products.js';
import { buildingCollection, buildingParts, cardBuildingForSpot } from './archive.js';
import { createArchiveCard } from './archive-card.js';
import { exhibitCollection, cloneExhibit } from './exhibits.js';
import { createExhibitTags } from './exhibit-tags.js';
import { createHubPanel } from './hub-panel.js';
import { hubIndex, runGoPlan } from './hub-index.js';
import { createHud, hudKeyAction, hudSupported, HUD_BUILDINGS } from './hud.js';
import { createPhotoMode, parseFovParam } from './photo.js';
import { createKiosk, parseKioskParams, kioskFloorOrder, kioskSwitchUrl } from './kiosk.js';

async function boot() {
  const canvas = document.getElementById('nw-canvas');
  const loaderEl = document.getElementById('nw-loader');
  const statusEl = document.getElementById('nw-loader-status');
  const fillEl = document.getElementById('nw-loader-fill');

  const params = new URLSearchParams(window.location.search);
  // 시작 결정: 일반 주소(/)는 월드 선택 화면부터 — 고르기 전에는 렌더러 · 월드를 만들지 않는다(이미지 두 장만 받음)
  const entry = resolveEntry(params, window.__NW_DEFAULT_WORLD);
  const pose = parsePose(params);   // 같은 자리 주소(at · look — 반대 월드 건물 카드에서 넘어옴): 방식을 적용한 뒤 그 자리로(runEntry)
  const poseFov = parseFovParam(params);   // 사진 링크 화각(fov — 20–90 정수, 아니면 null): 시작 방식이 자유 시점일 때만 처음 한 번(runEntry)
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

  // 발표 모드(kiosk.js — ?kiosk=1 · K): 외관 프리셋(layout 순서 · 한 컷씩) → 실내 층 둘러보기(기본 층부터) → 밖으로 → 반대 월드(?kiosk=1, 인트로부터) 자동 순환.
  // 키 · 누름 처리기(창 캡처)가 사진 모드 · 조작 안내 · 모달 · 목록 · 건물 카드보다 먼저 받도록 가장 먼저 만든다 — 도는 중 아무 입력이면 멈추고 그 입력은 삼킨다
  // (V · ? · L · Esc · 카드 · 스팟 클릭이 함께 일어나지 않게 — 감상도 열리지 않는다). 멈추면 그 자리에서 자유 시점(프리셋 전환 · 둘러보기 비행을 그 자리에서 끊는다).
  // 프리셋은 버튼과 같은 setCameraPreset — 밤 프리셋이 시각을 밤으로 바꾸면 다음 프리셋에서 시작할 때 시각으로 되돌린다(프리셋마다 제 분위기)
  const kioskParams = parseKioskParams(params);
  let kioskHour = null;   // 발표를 시작할 때 시각
  const kiosk = createKiosk({
    shotS: kioskParams.shotS,
    getPresets: () => (world.layout.cameras || []).map((c) => c.id),
    loadFloors: async (firstId) => kioskFloorOrder(await interior.loadLayout(), firstId),
    isInside: () => interior.isActive(),
    currentFloor: () => interior.currentFloor(),
    showPreset: (id) => {
      if (kioskHour !== null && Math.abs(weather.getHour() - kioskHour) > 0.01) setTimeOfDay(kioskHour);
      setCameraPreset(id);
    },
    enter: () => interior.enter('haus'),
    goToFloor: (id) => interior.goToFloor(id),
    playTour: () => interior.playTour(),
    exit: () => interior.exit(),
    switchWorld: () => {
      window.location.href = kioskSwitchUrl({ pathname: window.location.pathname, search: window.location.search, targetVer: otherWorldVer });
    },
    isBlocked: () => kioskBlocked(),
    onStart: () => {
      kioskHour = weather.getHour();
      archive.hide();
      modes.set('free');   // 보행 · 가이드 투어였으면 그 자리에서 자유 시점으로(실내에서도 — 둘러보기가 보행을 끈다)
    },
    onStop: () => {
      interior.stopTour();
      camCtrl.stopFlight();
      // 프리셋 전환 중이면 그 자리에서 멈춘다. 실내 들어가기 · 층 이동 중이면 실내가 옮긴 뒤 onSettle
      if (!interior.isBusy() && !camCtrl.isWalkMode()) camCtrl.placeAt(camera.position.toArray(), camCtrl.controls.target.toArray());
    },
    onSettle: () => {
      if (interior.isActive() && camCtrl.isWalkMode()) camCtrl.setWalkMode(false);   // 실내는 도착하면 보행을 켠다 — 멈춘 자리는 자유 시점
    },
  });

  // 사진 모드(photo.js — C 키 · 위 막대 「사진」): 화면 요소를 모두 숨기고(body.is-photo) 아래 가운데 도구 줄(화각 · 저장 · 링크 복사 · 닫기)만 — 지금 방식 조작으로 구도를 잡는다.
  // 키 처리기(창 캡처)가 조작 안내 · 모달 · 감상 · 목록 · 건물 카드 · main Esc 보다 먼저 받도록 그것들보다 먼저 만든다 — 떠 있는 동안 Esc 는 사진 모드부터 닫고, V · ? · L · H · P · K 는 막는다.
  // 인트로 · 방식 고르기 · 감상 · 모달 · 조작 안내 · 목록 · 비행 · 컷 이동 · 실내 전환 · 층 둘러보기 동안은 열지 않고, 떠 있다가 그렇게 되면(실내 엘리베이터 질문 등) 닫는다.
  // 저장은 렌더 루프가 그린 직후 afterRender 로, 링크는 지금 자리 · 시선 목표 · 보행 여부 · 시각 · 기상(실내는 링크 없음)
  const photo = createPhotoMode({
    camera,
    canvas,
    worldVer,
    getPose: () => ({ at: camera.position.toArray(), target: camCtrl.controls.target.toArray(), walking: camCtrl.isWalkMode() }),
    getHour: () => weather.getHour(),
    getWeather: () => weather.getWeather(),
    isInterior: () => interior.isActive(),
    isPointerLocked: () => camCtrl.isPointerLocked(),
    isBlocked: () => cinema.isActive() || camCtrl.isIntroActive() || document.body.classList.contains('is-choosing') || showcase.isActive() || showcase.isBusy() || modal.isOpen() || help.isOpen() || hub.isOpen() || camCtrl.isFlying() || spotCutting || interior.isBusy() || interior.isTouring(),
    onOpen: () => {
      camCtrl.releasePointer();  // 마우스 고정을 풀어 도구 줄을 바로 누를 수 있게(시선 둘러보기는 드래그로)
      camCtrl.cancelWalkTo();   // 스팟으로 걷던 중이면 그 자리에서 멈춘다(도착 카드 · 입장 질문이 숨은 채 뜨지 않게)
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
    isSuspended: () => spotCutting || modal.isOpen() || help.isOpen() || interior.isBusy() || interior.isTouring() || showcase.isActive() || showcase.isBusy() || photo.isActive(),
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
    isSuspended: () => spotCutting || modal.isOpen() || help.isOpen() || interior.isBusy() || interior.isTouring() || showcase.isActive() || showcase.isBusy() || photo.isActive(),
  });
  // 실내 전시물(inner-layout exhibits — 네 층): 8 m 안 이름표 「<이름> · 자세히 보기」 · 자유 시점 클릭 · 보행 마우스 고정 중 조준점 클릭 → 전시물 감상.
  // 리테일 진열 다음에 만든다 — 두 캔버스 캡처 click 처리기는 등록 순서대로 돌므로 제품 · 받침대를 맞힌 클릭은 리테일이 먼저 받아 막는다(제품이 먼저).
  // 실내 밖 · 층 둘러보기 · 층 이동 · 감상 · 조작 안내 · 모달 · 컷 이동 동안은 이름표를 숨기고 클릭을 받지 않는다
  const exhibitTags = createExhibitTags({
    camera,
    canvas,
    getFloor: () => {
      const def = interior.currentFloorDef();
      const root = interior.currentRoot();
      return def && root ? { def, root } : null;
    },
    isSuspended: () => !interior.isActive() || spotCutting || modal.isOpen() || help.isOpen() || interior.isBusy() || interior.isTouring() || showcase.isActive() || showcase.isBusy() || photo.isActive(),
    isWalking: () => camCtrl.isWalkMode(),
    isSpotAimed: () => markers.isAimed(),
    onOpen: (id) => openExhibit(id),
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
    onFloorChange: (def) => {
      markers.setSpots(def ? interiorSpots(def, retail.catalog()) : exteriorSpotList);
      exhibitTags.setFloor(def);   // 이 층 전시물 이름표(외관이면 없음)
    },
    onChange: (inside) => {
      if (inside) archive.hide();      // 실내에 들어가면 외관 건물 카드를 닫는다(들어가는 동안은 화면이 어둡다)
      else modes?.refresh();           // 나오면 보행 여부에 맞춰 직접 걷기 · 이전 방식으로
    },
  });
  // 감상 모드(제품 · 건물 · 전시물): 따로 띄운 스튜디오 무대 — 감상 중에는 이 장면만 그린다(animate). 나가면 연 자리 · 시선 · 보행 여부로 되돌린다(실내 · 외관)
  let showcaseReturn = null;   // { pos, target, walking } — 감상을 여닫는 동안만 있다
  const showcase = createShowcase({
    renderer,
    canvas,
    quality,
    fade,
    isBlocked: () => help.isOpen() || modal.isOpen(),
    onHelp: () => help.toggle(),
    onClose: () => restoreFromShowcase(),
  });
  // 아카이브 목록(위 막대 「목록」 · L): 건물 기록 · inner-layout 전시물 · 진열 제품(hubIndex) → 고르면 그 감상으로(runGoPlan — 실내 들어가기 · 층 이동 포함).
  // 출처는 처음 열 때 받는다(건물 기록은 부팅 때 받음, inner-layout · products.json 은 받았으면 그대로). 건축 자리의 월드 이름은 위 막대 월드 버튼 글자.
  // 인트로 · 방식 고르기 · 비행 · 컷 이동 · 실내 전환 · 둘러보기 · 감상 · 모달 · 조작 안내 동안은 열 수 없다(버튼 흐리게 · L 무시).
  // 조작 안내 · 모달 · 감상보다 뒤, 건물 카드보다 앞에 만든다 — Esc 캡처 처리기가 그쪽 Esc 다음 · 카드 Esc 앞(둘 다 떠 있으면 목록부터 닫는다)
  const hubWorldLabel = document.querySelector(`.nw-world-switch [data-world-ver="${worldVer}"]`)?.textContent.trim() || worldLabel;
  // 같은 자리, 다른 세계: 반대 월드(이름도 위 막대 월드 버튼 글자 — 성수 2041 · DS2 산악)
  const otherWorldVer = WORLD_IDS.find((id) => id !== worldVer);
  const otherWorldLabel = document.querySelector(`.nw-world-switch [data-world-ver="${otherWorldVer}"]`)?.textContent.trim() || '';
  const hub = createHubPanel({
    load: async () => {
      const [innerLayout, catalog] = await Promise.all([
        interior.loadLayout().catch((err) => {
          console.error('[nowhere] 목록: inner-layout 불러오기 실패', err);
          return null;
        }),
        retail.loadCatalog().then(() => retail.catalog()).catch((err) => {
          console.error('[nowhere] 목록: products.json 불러오기 실패', err);
          return null;
        }),
      ]);
      return hubIndex({ records: archive.records(), worldLabel: hubWorldLabel, innerLayout, catalog });
    },
    isBlocked: () => cinema.isActive() || camCtrl.isIntroActive() || document.body.classList.contains('is-choosing') || camCtrl.isFlying() || spotCutting || interior.isBusy() || interior.isTouring() || showcase.isActive() || showcase.isBusy() || modal.isOpen() || help.isOpen(),
    // 열 때: 마우스 고정 풀기 · 스팟 걷기 멈춤 · 누르던 이동 키 비우기(떠 있는 동안 목록이 키를 받으므로 계속 걷지 않게)
    onOpen: () => {
      camCtrl.releasePointer();
      camCtrl.cancelWalkTo();
      camCtrl.clearInput();
    },
    onGo: (item) => runGoPlan(item, { interior, open: openIndexItem }).catch((err) => console.error('[nowhere] 목록 항목 열기 실패', err)),
  });
  // 건물 아카이브(외관): 건물 이름표 「기록 보기」 · 자유 시점 건물 클릭 · 건물 스팟 도착 → 오른쪽 카드, 「자세히 보기」 → 건물 감상,
  // 「이 자리 그대로 <반대 월드>로」 → 반대 월드의 같은 자리 · 시선 · 방식(goSameSpot).
  // 인트로 · 방식 고르기 · 투어 · 실내 · 감상 · 조작 안내 · 모달 · 컷 이동 · 비행 동안은 이름표를 숨기고 클릭 · Esc 를 받지 않는다.
  // 조작 안내 · 모달 · 감상보다 뒤에 만든다 — 카드의 Esc 캡처 처리기가 그쪽 Esc 다음에 온다
  const archive = createArchiveCard({
    camera,
    canvas,
    quality,
    getBoxes: () => world.buildingBoxes,
    isSuspended: () => cinema.isActive() || camCtrl.isIntroActive() || document.body.classList.contains('is-choosing') || scenario.isRunning() || interior.isActive() || interior.isBusy() || showcase.isActive() || showcase.isBusy() || help.isOpen() || modal.isOpen() || spotCutting || camCtrl.isFlying() || photo.isActive(),
    isWalking: () => camCtrl.isWalkMode(),
    onDetail: (id) => openArchive(id),
    sameSpotWorld: otherWorldLabel,
    onSameSpot: () => goSameSpot(),
  });
  // 성능 표시: P 키로 켜고 끈다. 키보드 없는 기기(아이패드 등)는 주소에 ?stats=1
  // 텍스처 추정은 외관 · 실내 장면을 함께 센다(실내에 있어도 외관 텍스처는 GPU 에 남아 있음 — 메모리 한도 판단용)
  const perf = createPerfHud({ renderer, getScenes: () => [scene, interior.scene, showcase.scene], tier: quality.tier });
  window.addEventListener('keydown', (e) => {
    if ((e.key === 'p' || e.key === 'P') && !e.metaKey && !e.ctrlKey && !e.altKey && !e.repeat) perf.toggle();
  });
  if (params.get('stats') === '1') perf.toggle(true);
  // 현장 정보 HUD(hud.js — H 키, 기본 켜짐): 왼쪽 위 브랜드 작은 글씨를 살아 있는 좌표 줄로(성수 위경도 · 산악 장면 좌표 · 실내 층 이름 · 방위),
  // 외관 위 가운데 방위 띠(시선 ±60° · 두 건물 ◆ 이름 · 거리). 기상 글자는 독 버튼 글자 그대로, 시각은 독과 같은 HH:MM.
  // 원래 kicker 문구는 위에서 월드에 맞게 바꾼 뒤에 읽는다(끄면 그 월드 문구로). 인트로 · 방식 고르기 · 감상 · 모달 · 조작 안내 · 목록 동안은 H 를 듣지 않는다
  const weatherLabels = Object.fromEntries([...document.querySelectorAll('[data-weather]')].map((b) => [b.dataset.weather, b.textContent.trim()]));
  const viewDir = new THREE.Vector3();
  const hud = createHud({
    kickerEl: brandKickerEl,
    mount: document.querySelector('.nw-topbar') || document.body,
    worldVer,
    supported: hudSupported({ device, screenWidth: Math.min(screen.width, innerWidth), screenHeight: Math.min(screen.height, innerHeight) }),   // 휴대폰은 안내 문구만(PC · 태블릿 지원 — ?tier=mobile 시험은 창 크기로도 봄)
    buildings: HUD_BUILDINGS.filter((b) => world.layout.buildings?.[b.id]).map((b) => {
      const [x, , z] = world.layout.buildings[b.id].pos;
      return { name: b.name, x, z };
    }),
    getView: () => {
      camera.getWorldDirection(viewDir);
      return { x: camera.position.x, y: camera.position.y, z: camera.position.z, dx: viewDir.x, dz: viewDir.z };
    },
    getFloorLabel: () => interior.currentFloorDef()?.label ?? null,
    getHour: () => weather.getHour(),
    getWeatherLabel: () => weatherLabels[weather.getWeather()] || '',
  });
  const hudBlocked = () => cinema.isActive() || camCtrl.isIntroActive() || document.body.classList.contains('is-choosing') || showcase.isActive() || showcase.isBusy() || hub.isOpen() || modal.isOpen() || help.isOpen();
  // 발표 모드 K: 인트로 · 방식 고르기 · 비행 · 컷 이동 · 실내 전환 · 층 둘러보기 · 감상 · 모달 · 조작 안내 · 목록 · 사진 모드 동안은 시작하지 않는다
  const kioskBlocked = () => cinema.isActive() || camCtrl.isIntroActive() || document.body.classList.contains('is-choosing') || camCtrl.isFlying() || spotCutting || interior.isBusy() || interior.isTouring() || showcase.isActive() || showcase.isBusy() || modal.isOpen() || help.isOpen() || hub.isOpen() || photo.isActive();
  window.addEventListener('keydown', (e) => {
    const t = e.target;
    const act = hudKeyAction({
      key: e.key, code: e.code, repeat: e.repeat, metaKey: e.metaKey, ctrlKey: e.ctrlKey, altKey: e.altKey, defaultPrevented: e.defaultPrevented,
      typing: Boolean(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)),
      blocked: hudBlocked(),
    });
    if (act !== 'toggle') return;
    e.preventDefault();
    hud.toggle();
  });
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
    } else if (!interior.isActive() && cardBuildingForSpot(spot)) {
      archive.show(cardBuildingForSpot(spot));   // 외관 건물 스팟(정문 제외)에 도착하면 그 건물 카드
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

  // ── 감상 모드 열기(제품 · 건물 · 전시물 공통): 연 자리(위치 · 시선 · 보행 여부)를 적어 두고 보행 · 카메라를 멈춘 뒤 무대를 연다 ──
  async function openStage(collection) {
    showcaseReturn = { pos: camera.position.toArray(), target: camCtrl.controls.target.toArray(), walking: camCtrl.isWalkMode() };
    let opened = false;
    try {
      camCtrl.cancelWalkTo();
      camCtrl.clearInput();
      if (showcaseReturn.walking) camCtrl.setWalkMode(false);   // 보행 키 · 마우스 고정 · 스팟 · 보행 안내를 멈춘다(나올 때 다시 켠다)
      camCtrl.controls.enabled = false;                          // 무대 드래그 · 휠이 뒤 카메라를 돌리지 않게
      interior.showCaption('');
      archive.hide();
      opened = await showcase.open(collection);
    } catch (err) {
      console.error('[nowhere] 감상 열기 실패', err);
    }
    if (!opened) restoreFromShowcase();   // 못 열었으면(던진 경우 포함) 보행 · 카메라를 연 자리 그대로 되돌린다
  }

  // 제품 감상: 실내 진열(클릭 · 이름표 · 제품 스팟) → 그 층 진열 목록
  async function openShowcase(productId) {
    const catalog = retail.catalog();
    const floorId = interior.currentFloor();
    if (!catalog || !floorId || showcase.isActive() || showcase.isBusy() || interior.isBusy()) return;   // spotCutting 은 막지 않는다 — 컷 이동 도착(cutToSpot → arriveAt)도 여기로 온다
    // 그 층 진열 목록 — 가벼운 모델은 진열이 받아 둔 -lite 원본(무대가 clone 해서 쓴다)
    await openStage({
      ...productCollection(catalog, floorId, productId),
      loadLite: (item) => retail.liteSource(item.product),
    });
  }

  // 건물 감상: 외관 아카이브 카드 「자세히 보기」 · 아카이브 목록(실내에서도 — 나가면 실내 그 자리) → 두 건물 목록(HAUS → FaceArch),
  // 모델은 월드가 받은 같은 주소(quality.heroUrls — 브라우저 캐시). 부위 표지는 이 월드 layout anchors(건물 로컬 좌표 — 모델 루트와 같은 좌표계)
  async function openArchive(id) {
    if (interior.isBusy() || showcase.isActive() || showcase.isBusy()) return;
    const collection = buildingCollection(archive.records(), quality.heroUrls, id);
    if (!collection.items.some((it) => it.id === id)) return;
    await openStage({
      ...collection,
      parts: (item) => buildingParts(world.layout, item.id, item.name),
    });
  }

  // 전시물 감상: 지금 층 전시물 목록(inner-layout exhibits 순서). 모델은 층 루트의 EX_* 노드를 층 좌표째 복제한 묶음 — 다시 받지 않고
  // geometry · 재질을 층과 같이 쓴다(1F 화면 캔버스 그대로). 그래서 목록에 release 를 두지 않는다(닫아도 무대가 풀지 않는다)
  async function openExhibit(id) {
    const def = interior.currentFloorDef();
    const root = interior.currentRoot();
    if (!def || !root || showcase.isActive() || showcase.isBusy() || interior.isBusy()) return;
    const collection = exhibitCollection(def, id);
    if (!collection.items.some((it) => it.id === id)) return;
    await openStage({
      ...collection,
      loadLite: async (item) => cloneExhibit(THREE, root, item.id),
    });
  }

  // 아카이브 목록 항목 열기(runGoPlan 의 마지막 단계 — 그 층에 선 뒤): 건축 → 건물 감상, 전시물 → 전시물 감상, 제품 → 제품 감상
  function openIndexItem(item) {
    if (item.category === 'architecture') return openArchive(item.id);
    if (item.category === 'exhibit') return openExhibit(item.id);
    return openShowcase(item.id);
  }

  // 감상 모드를 나온 뒤(화면이 어두운 동안): 연 자리 · 시선 그대로, 보행 중이었으면 보행으로(실내 · 외관)
  function restoreFromShowcase() {
    const r = showcaseReturn;
    showcaseReturn = null;
    camCtrl.controls.enabled = true;
    if (!r) return;
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
    const introEnd = entry.intro ? await playIntro({ holdHud: true }) : null;   // ?mode= 가 있어도 방식 적용 전까지 HUD 를 숨긴다(카메라 프리셋 묶음이 깜박이지 않게)
    const mode = entry.mode || (await showModeMenu({ isBlocked: () => help.isOpen() || modal.isOpen() }));
    try {
      modes.set(mode);
    } finally {
      document.body.classList.remove('is-choosing');   // 방식 고르기가 이미 풀었으면 그대로, ?mode= 로 건너뛴 경우는 여기서 푼다(적용이 던져도 HUD 가 숨은 채 남지 않게)
    }
    // 같은 자리 주소: 방식을 적용한 뒤 그 자리 · 시선으로. 시선 방향(위아래 각 포함)은 지면 높이가 달라도 그대로.
    // 보행: 이 월드 장애물 안이면 SAME_SPOT_SNAP_M 안 가장 가까운 빈 자리로(시선 목표도 같이 옮김 — 없으면 그 자리), 지면 + 눈높이로 선 뒤 눈높이 차만큼 옮긴 목표로 다시 겨눈다.
    // 그 밖(자유 시점 — 가이드 투어는 주소에서 자유 시점으로 바뀐다): 이 월드 지면 + ORBIT_CLEARANCE 아래면 올리고 시선 목표도 같은 만큼(camCtrl.update 의 clampAboveGround 와 같은 높이)
    if (pose) {
      if (camCtrl.isWalkMode()) {
        const { isFree } = walkPredicates(camCtrl.getWalkContext());
        const p = snapPose(pose, nearestFreePoint(pose.at[0], pose.at[2], isFree, SAME_SPOT_SNAP_M));
        camCtrl.placeWalk(p.at[0], p.at[2], p.look);   // 이 월드 지면 + 눈높이로 선다
        camCtrl.placeWalk(p.at[0], p.at[2], shiftLook(p.look, p.at[1], camera.position.y));   // 눈높이 차만큼 옮긴 목표로 다시 겨눈다
      } else {
        const p = liftPose(pose, camCtrl.getWalkContext().groundHeightAt(pose.at[0], pose.at[2]) + ORBIT_CLEARANCE);
        camCtrl.placeAt(p.at, p.look);
      }
    }
    // 사진 링크 화각: 시작 자유 시점에만 — 그 뒤 프리셋 · 보행 · 인트로는 camera.js 가 자기 화각으로 바꾼다(보행 50° · 프리셋 화각)
    if (poseFov !== null && modes.get() === 'free') {
      camera.fov = poseFov;
      camera.updateProjectionMatrix();
    }
    // 발표 모드(?kiosk=1): 인트로를 끝까지 봤으면(인트로 없는 주소 포함) 방식을 적용한 뒤 시작. 인트로를 입력으로 건너뛰었으면 발표 중 입력과 같이 멈춤(알림 · 주소 정리)
    if (kioskParams.on) {
      const started = (introEnd === null || introEnd === 'complete') && kiosk.start();
      if (!started) kiosk.stop();
    }
  }

  function startScenario(stepId) {
    // 실내 · 인트로 중에는 시작하지 않는다(인트로는 시나리오 밖 시작 흐름이 돌리고, 끝나면 방식 고르기로 이어진다)
    if (interior.isActive() || camCtrl.isIntroActive()) return;
    modal.close();
    archive.hide();   // 투어를 시작하면 외관 건물 카드를 닫는다
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
    // 실내 출입 · 층 이동 · 둘러보기가 보행을 켰다 껐다 하는 동안은 방식을 바꾸지 않는다(나오면 interior onChange → refresh).
    // 감상을 여닫는 동안(연 자리가 적혀 있는 동안)도 — 외관에서 보행 중 감상을 열면 보행을 껐다 나올 때 다시 켠다(방식은 직접 걷기 그대로)
    isSuspended: () => interior.isActive() || interior.isBusy() || showcaseReturn !== null,
  });
  document.querySelectorAll('#nw-mode-seg [data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.blur();   // Space(보행 점프) · Enter 가 이 버튼을 다시 누르지 않게
      modes.set(btn.dataset.mode);
    });
  });

  // 월드 전환: 다른 월드를 새 월드의 인트로부터 다시 열고, 인트로가 끝나면 지금 방식 그대로 이어 간다(?ver=…&mode=… — 선택 화면 · 방식 고르기 없음).
  // 주소는 entry.js worldSwitchUrl — 인트로를 막는 값(noIntro · cam · weather · time · at · look)과 사진 링크 화각(fov)은 지운다. 새 월드는 기본 기상 · 시각 · 화각으로 인트로부터
  document.querySelectorAll('.nw-world-switch [data-world-ver]').forEach((btn) => {
    const isCurrent = btn.dataset.worldVer === worldVer;
    btn.classList.toggle('is-active', isCurrent);
    btn.setAttribute('aria-pressed', String(isCurrent));
    btn.addEventListener('click', () => {
      const targetVer = btn.dataset.worldVer;
      if (targetVer === worldVer) return;
      window.location.href = worldSwitchUrl({ pathname: window.location.pathname, search: window.location.search, targetVer, mode: modes.get() });
    });
  });

  // ── 같은 자리, 다른 세계(건물 카드 「이 자리 그대로 <반대 월드>로」): 어둡게(SAME_SPOT_FADE_MS, 가운데 '<지금> → <반대>') → 반대 월드 페이지에
  // 지금 방식(가이드 투어면 자유 시점) · 카메라 위치(at) · 시선 목표(look — 보행이면 시선 방향으로 SAME_SPOT_LOOK_M 앞 점, entry.js sameSpotLook) — 인트로 없이(sameSpotUrl).
  // 떠나기 전에 지금 주소를 이 월드의 같은 자리 주소로 바꿔 둔다 — 뒤로 가기로 돌아오면(bfcache 가 없어도) 인트로가 아니라 이 자리 ──
  let sameSpotGoing = false;
  async function goSameSpot() {
    if (sameSpotGoing) return;
    sameSpotGoing = true;
    camCtrl.cancelWalkTo();
    camCtrl.clearInput();      // 어두워지는 동안 누르던 이동 키로 걷지 않게
    camCtrl.releasePointer();
    await fade.fadeTo(true, `${hubWorldLabel} → ${otherWorldLabel}`, SAME_SPOT_FADE_MS);
    // 다 어두워진 뒤 마지막 화면 그대로 적는다
    const at = camera.position.toArray();
    const look = sameSpotLook(at, camCtrl.controls.target.toArray(), camCtrl.isWalkMode());
    const here = { pathname: window.location.pathname, search: window.location.search, mode: modes.get(), at, look };
    history.replaceState(history.state, '', sameSpotUrl({ ...here, targetVer: worldVer }));
    window.location.href = sameSpotUrl({ ...here, targetVer: otherWorldVer });
  }
  // 뒤로 가기로 이 페이지가 그대로 돌아오면(bfcache) 어두운 화면을 걷는다
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted || !sameSpotGoing) return;
    sameSpotGoing = false;
    fade.fadeTo(false, '', SAME_SPOT_FADE_MS);
  });

  // Esc: 사진 모드 · 모달 · 조작 안내 · 방식 고르기가 먼저 받고(캡처 단계), 남은 Esc 는 인트로를 건너뛰거나 비행 중인 투어를 끝낸다
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
    hub.update();   // 목록 버튼: 열 수 없으면 흐리게(감상 중에는 위 막대째 숨어 있다)
    photo.update();   // 사진 모드: 막히면 닫기 · 사진 화각 다시 맞추기(카메라 갱신 뒤) · 위 막대 버튼 흐리게
    retail.update();
    if (!studio) archive.update();   // 건물 이름표 자리 · 카드 거리(감상 중에는 외관 카메라가 멈춰 있다 — 이름표 · 카드는 CSS 로 숨김)
    if (!studio) exhibitTags.update();   // 실내 전시물 이름표(감상 중에는 CSS 로 숨김)
    if (!studio) hud.update(performance.now());   // 좌표 줄 · 방위 띠(HUD_UPDATE_MS 마다, 바뀐 것만 DOM — 감상 중에는 위 막대 · 띠가 숨어 있다)

    renderer.info.reset();
    if (studio) {
      showcase.update(dt);
      showcase.render();
    } else {
      world.followSun(camera);
      post.composer.render();
      photo.afterRender();   // 사진 저장: 그린 직후 같은 프레임에 캔버스를 읽는다(preserveDrawingBuffer 없이 — 감상 중에는 사진 모드가 닫혀 있다)
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
    archive,
    openArchive,
    openExhibit,
    exhibitTags,
    hub,
    hud,
    photo,
    kiosk,
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
        archiveCard: archive.currentId(),
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
