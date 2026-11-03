// HAUS NOWHERE — 성수 2041: 엔트리포인트 (웹 코어 + 기상·시간·카메라·드론 비행 연결)
import * as THREE from 'three';
import { detectQualityTier, getQualityConfig } from './quality.js';
import { createWorld } from './world.js';
import { createPostPipeline } from './post.js';
import { createWeatherController } from './weather.js';
import { createRainSystem } from './rain.js';
import { createCameraController, updateDroneActors } from './camera.js';
import { createAnalysisController } from './analysis.js';

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
    const cardThumbEl = document.getElementById('nw-card-thumb');
    if (cardThumbEl) cardThumbEl.src = 'assets/nowhere-ds2/renders/hero-street.webp';
    const loreTagEl = document.querySelector('.nw-card-section-tag.is-lore');
    if (loreTagEl) loreTagEl.textContent = '서사 · 허구 (DS2 고원)';

    const camLabels = {
      street: '개척로',
      aerial: '조감',
      viaduct: '협곡 상류',
      night: '산악의 밤',
      ground: '개울 근접',
      lot: '이끼 포켓',
    };
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

  const initialWeather = params.get('weather') || 'overcast';
  const weather = createWeatherController({
    world,
    post,
    renderer,
    initialPreset: initialWeather,
    duration: 2.5,
  });

  const rain = createRainSystem({
    scene,
    sharedUniforms: world.uniforms,
    count: quality.rainCount,
  });

  const walkBtn = document.getElementById('nw-btn-walk');
  const introBtn = document.getElementById('nw-btn-intro');

  function syncWeatherUI(presetName) {
    document.querySelectorAll('[data-weather]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.weather === presetName);
    });
  }

  function syncCamUI(camId) {
    document.querySelectorAll('[data-cam]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.cam === camId);
    });
  }

  const camCtrl = createCameraController({
    camera,
    canvas,
    layout: world.layout,
    onPresetChange(camDef) {
      syncCamUI(camDef.id);
    },
    onWalkChange(active) {
      if (walkBtn) {
        walkBtn.classList.toggle('is-active', active);
        walkBtn.setAttribute('aria-pressed', String(active));
      }
    },
  });

  const analysis = await createAnalysisController({
    scene,
    camera,
    renderer,
    world,
    camCtrl,
    quality,
  });

  const initialCam = params.get('cam') || 'street';
  camCtrl.setPreset(initialCam, true);
  syncWeatherUI(weather.getPresetName());

  if (!params.get('noIntro') && !params.get('cam') && !params.get('weather')) {
    camCtrl.startIntro();
  }

  function setWeatherPreset(name, instant = false) {
    weather.setPreset(name, instant);
    syncWeatherUI(weather.getPresetName());
  }

  function setCameraPreset(camId, instant = false) {
    const camDef = camCtrl.setPreset(camId, instant);
    if (camDef?.mood && camDef.id === 'night' && weather.getPresetName() !== 'night') {
      setWeatherPreset('night', instant);
    }
    return camDef;
  }

  document.querySelectorAll('[data-weather]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setWeatherPreset(btn.dataset.weather, false);
    });
  });

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
      camCtrl.startIntro();
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
    updateDroneActors(world.droneActors, elapsed);
    camCtrl.update(dt);
    analysis.update(dt);

    renderer.info.reset();
    post.composer.render();
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
    analysis,
    world,
    post,
    quality,
    setCameraPreset,
    setWeatherPreset,
    getStats() {
      return {
        worldVer: quality.worldVer,
        tier: quality.tier,
        weather: weather.getPresetName(),
        camera: camCtrl.getPresetId(),
        walkMode: camCtrl.isWalkMode(),
        introActive: camCtrl.isIntroActive(),
        analysisActive: analysis.isActive(),
        selectedAnchor: analysis.getSelectedId(),
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
