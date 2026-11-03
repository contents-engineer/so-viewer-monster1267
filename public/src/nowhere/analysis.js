// HAUS NOWHERE — 성수 2041: 분석 모드 UI 및 3D 오버레이 (Task 8)
// 설계 원칙:
//   - 진입 시 청회색 감광(uAnalysis → 1, #0F1D33 알파 0.45, 채도 -30%) + 1.2초 스캔 펄스(uScan*)
//   - 화면 고정 두께 윤곽선(LineSegments2: 기본 구조선 #7F96C4 1px, 선택 활성 #6ADCFC 2px, EdgesGeometry 28° 캐시)
//   - 4px 기준점 + 45°/직선 리더선(1.25px SVG) + 2열 라벨(이름 IBM Plex Sans KR / 값 JetBrains Mono tabular-nums)
//   - 우선순위 정렬 및 화면 겹침 회피 (모바일 ≤ 720px 은 상위 6개만 표시)
//   - 기록 카드: 사실(record.json·facearch.json·리서치·CC0 출처)과 서사(2041 허구) 분리 표시, 모바일 하단 시트 스크롤 맨 위 초기화
//   - 키보드: A(분석 토글), Esc(카드 닫기 → 분석 종료), ←/→(앵커 순환), hover 레이캐스트 100ms 스로틀
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

export async function createAnalysisController({
  scene,
  camera,
  renderer,
  world,
  camCtrl,
  quality,
}) {
  const anchorsUrl = quality?.anchorsUrl || 'assets/nowhere/anchors.ko.json';
  const defaultRender = `${quality?.baseDir || 'assets/nowhere'}/renders/hero-street.webp`;
  const res = await fetch(anchorsUrl);
  const anchorsKo = res.ok ? await res.json() : {};

  // layout.json 의 anchors 와 anchors.ko.json 병합
  const anchors = (world.layout?.anchors || [])
    .map((a) => {
      const ko = anchorsKo[a.id] || {};
      return {
        id: a.id,
        layer: ko.layer || a.layer || 'present',
        pos: new THREE.Vector3().fromArray(a.pos),
        posArray: a.pos,
        title: ko.title || a.title || a.id,
        kicker: ko.kicker || String(a.layer || 'present').toUpperCase(),
        summary: ko.summary || (ko.facts?.[0]?.[1] ?? a.facts?.[0]?.[1] ?? ''),
        priority: typeof ko.priority === 'number' ? ko.priority : 50,
        render: ko.render || a.render || defaultRender,
        facts: ko.facts || a.facts || [],
        lore: ko.lore || a.lore || '',
        sources: ko.sources || [{ label: a.source || 'docs/nowhere/research/seongsu.md', url: a.source || 'docs/nowhere/research/seongsu.md' }],
      };
    })
    .sort((a, b) => b.priority - a.priority);

  // DOM 요소 참조
  const btnAnalysis = document.getElementById('nw-btn-analysis');
  const filterBar = document.getElementById('nw-filter-bar');
  const analysisLayer = document.getElementById('nw-analysis-layer');
  const svgEl = document.getElementById('nw-analysis-svg');
  const labelsRoot = document.getElementById('nw-anchor-labels');
  const cardEl = document.getElementById('nw-card');
  const cardKicker = document.getElementById('nw-card-kicker');
  const cardTitle = document.getElementById('nw-card-title');
  const cardThumb = document.getElementById('nw-card-thumb');
  const cardFacts = document.getElementById('nw-card-facts');
  const cardLore = document.getElementById('nw-card-lore');
  const cardSources = document.getElementById('nw-card-sources');
  const cardClose = document.getElementById('nw-card-close');

  let active = false;
  let analysisAlpha = 0;
  let currentFilter = 'all';
  let selectedId = null;
  let hoveredId = null;
  let enterTimestamp = 0;

  // 스캔 펄스(1.2s) 상태
  let scanElapsed = -1;
  const SCAN_DURATION = 1.2;

  // 윤곽선(LineSegments2) 캐시 및 오버레이 그룹
  const outlineGroup = new THREE.Group();
  outlineGroup.name = 'NW_AnalysisOutlines';
  outlineGroup.visible = false;
  scene.add(outlineGroup);

  const lineRes = new THREE.Vector2(window.innerWidth, window.innerHeight);
  const structLineMat = new LineMaterial({
    color: 0x7f96c4,
    linewidth: 1.0,
    transparent: true,
    opacity: 0.0,
    resolution: lineRes,
    depthTest: true,
  });
  const activeLineMat = new LineMaterial({
    color: 0x6adcfc,
    linewidth: 2.0,
    transparent: true,
    opacity: 0.0,
    resolution: lineRes,
    depthTest: true,
  });

  // 선택된 앵커 주변 저폴리 와이어/삼각분할 마커(알파 0.12 면 + 2px 활성 윤곽)
  const markerGroup = new THREE.Group();
  markerGroup.visible = false;
  outlineGroup.add(markerGroup);

  const markerOctGeom = new THREE.OctahedronGeometry(2.6, 0);
  const markerSurfMat = new THREE.MeshBasicMaterial({
    color: 0x6adcfc,
    transparent: true,
    opacity: 0.11,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const markerMesh = new THREE.Mesh(markerOctGeom, markerSurfMat);
  markerGroup.add(markerMesh);

  const markerEdges = new THREE.EdgesGeometry(markerOctGeom, 1);
  const markerLineGeom = new LineSegmentsGeometry().fromEdgesGeometry(markerEdges);
  const markerLine = new LineSegments2(markerLineGeom, activeLineMat);
  markerGroup.add(markerLine);

  let buildingOutlinesBuilt = false;
  const buildingOutlineMeshes = { haus: [], facearch: [] };
  let drawOnElapsed = 0;
  const DRAW_ON_DURATION = 0.55;

  function ensureBuildingOutlines() {
    if (buildingOutlinesBuilt) return;
    buildingOutlinesBuilt = true;

    for (const [key, root] of Object.entries(world.buildings || {})) {
      if (!root) continue;
      root.updateMatrixWorld(true);
      const positions = [];
      root.traverse((node) => {
        if (!node.isMesh || !node.geometry) return;
        const mName = node.material?.name || '';
        if (mName.includes('eyeball') || node.name.includes('Eyeball')) return;
        // 유기적 고밀도 곡면은 윤곽 과밀 방지를 위해 건너뛰고 필로티·외피 구조 부재만 추출
        const triCount = (node.geometry.index ? node.geometry.index.count : node.geometry.attributes.position.count) / 3;
        const maxTriForOutline = quality.tier === 'mobile' ? 35000 : 80000;
        if (triCount > maxTriForOutline) return;
        const angleThreshold = quality.tier === 'mobile' ? 42 : 32;
        const edges = new THREE.EdgesGeometry(node.geometry, angleThreshold);
        edges.applyMatrix4(node.matrixWorld);
        const posAttr = edges.attributes.position;
        const stride = quality.tier === 'mobile' ? 12 : 2;
        if (posAttr && posAttr.count >= 2) {
          for (let i = 0; i + 1 < posAttr.count; i += stride) {
            positions.push(
              posAttr.getX(i),
              posAttr.getY(i),
              posAttr.getZ(i),
              posAttr.getX(i + 1),
              posAttr.getY(i + 1),
              posAttr.getZ(i + 1),
            );
          }
        }
        edges.dispose();
      });
      if (positions.length >= 6) {
        const lGeom = new LineSegmentsGeometry();
        lGeom.setPositions(positions);
        const seg = new LineSegments2(lGeom, structLineMat);
        seg.computeLineDistances();
        seg.frustumCulled = false;
        outlineGroup.add(seg);
        buildingOutlineMeshes[key].push(seg);
      }
    }
  }

  // 라벨 DOM 핀 생성
  const pinElements = new Map();
  for (const a of anchors) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nw-anchor-pin';
    btn.dataset.anchorId = a.id;
    btn.dataset.layer = a.layer;
    btn.innerHTML = `<span class="nw-anchor-name">${a.title}</span><span class="nw-anchor-val">${a.summary}</span>`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectAnchor(a.id, true);
    });
    labelsRoot.appendChild(btn);
    pinElements.set(a.id, btn);
  }

  function triggerScanPulse(centerVec = null) {
    const c = centerVec || camCtrl?.controls?.target || new THREE.Vector3(0, 0, 0);
    world.uniforms.uScanCenter.value.copy(c);
    world.uniforms.uScanRadius.value = 0.1;
    scanElapsed = 0;
  }

  function getFilteredAnchors() {
    if (currentFilter === 'all') return anchors;
    return anchors.filter((a) => a.layer === currentFilter);
  }

  function renderCard(anchor) {
    if (!anchor) {
      cardEl.classList.remove('is-open');
      markerGroup.visible = false;
      for (const seg of [...buildingOutlineMeshes.haus, ...buildingOutlineMeshes.facearch]) {
        seg.material = structLineMat;
      }
      return;
    }

    cardKicker.textContent = anchor.kicker;
    cardTitle.textContent = anchor.title;
    cardThumb.src = anchor.render;
    cardThumb.alt = anchor.title;

    cardFacts.innerHTML = anchor.facts
      .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`)
      .join('');
    cardLore.textContent = anchor.lore;
    cardSources.innerHTML = anchor.sources
      .map((s) => `<a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.label}</a>`)
      .join(' · ');

    cardEl.classList.add('is-open');
    // 모바일 하단 시트 포함 항상 스크롤 맨 위로 초기화
    cardEl.scrollTop = 0;

    // 건물 윤곽 강조 또는 앵커 3D 마커 강조
    const isHaus = anchor.id.startsWith('haus_');
    const isFace = anchor.id.startsWith('facearch_');
    for (const seg of buildingOutlineMeshes.haus) {
      seg.material = isHaus ? activeLineMat : structLineMat;
    }
    for (const seg of buildingOutlineMeshes.facearch) {
      seg.material = isFace ? activeLineMat : structLineMat;
    }

    markerGroup.position.copy(anchor.pos);
    markerGroup.visible = true;
  }

  function selectAnchor(id, focusCamera = false) {
    if (!id) {
      selectedId = null;
      for (const [, el] of pinElements) {
        el.classList.remove('is-selected');
      }
      renderCard(null);
      return null;
    }
    const anchor = anchors.find((a) => a.id === id);
    if (!anchor) return null;
    selectedId = anchor.id;

    for (const [aid, el] of pinElements) {
      el.classList.toggle('is-selected', aid === selectedId);
    }

    drawOnElapsed = 0;
    triggerScanPulse(anchor.pos);
    renderCard(anchor);

    if (focusCamera && camCtrl) {
      const isMob = window.innerWidth <= 720 || quality.tier === 'mobile';
      const dist = anchor.layer === 'building' ? (isMob ? 98 : 68) : isMob ? 54 : 42;
      const focusPt = anchor.pos.clone();
      if (isMob) {
        focusPt.y = Math.max(4, focusPt.y - 22);
      }
      camCtrl.focusWorldPoint(focusPt, dist);
    }
    return anchor;
  }

  function setLayerFilter(layer) {
    currentFilter = layer || 'all';
    enterTimestamp = performance.now();
    document.querySelectorAll('[data-layer-filter]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.layerFilter === currentFilter);
    });
    if (selectedId) {
      const sel = anchors.find((a) => a.id === selectedId);
      if (sel && currentFilter !== 'all' && sel.layer !== currentFilter) {
        selectAnchor(null);
      }
    }
    triggerScanPulse();
  }

  function setAnalysisMode(enabled) {
    active = Boolean(enabled);
    document.body.classList.toggle('is-analysis', active);
    if (btnAnalysis) {
      btnAnalysis.classList.toggle('is-active', active);
      btnAnalysis.setAttribute('aria-pressed', String(active));
    }
    if (analysisLayer) {
      analysisLayer.setAttribute('aria-hidden', String(!active));
    }

    if (active) {
      ensureBuildingOutlines();
      outlineGroup.visible = true;
      drawOnElapsed = 0;
      enterTimestamp = performance.now();
      triggerScanPulse();
    } else {
      selectAnchor(null);
      outlineGroup.visible = false;
      world.uniforms.uScanRadius.value = -10.0;
      svgEl.innerHTML = '';
      for (const [, el] of pinElements) {
        el.classList.remove('is-visible', 'is-selected');
      }
    }
    return active;
  }

  function cycleAnchor(step = 1) {
    if (!active) return null;
    const list = getFilteredAnchors();
    if (!list.length) return null;
    const idx = list.findIndex((a) => a.id === selectedId);
    const nextIdx = idx < 0 ? 0 : (idx + step + list.length) % list.length;
    return selectAnchor(list[nextIdx].id, true);
  }

  // UI 이벤트 연결
  if (btnAnalysis) {
    btnAnalysis.addEventListener('click', () => {
      setAnalysisMode(!active);
    });
  }

  if (filterBar) {
    filterBar.querySelectorAll('[data-layer-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        setLayerFilter(btn.dataset.layerFilter);
      });
    });
  }

  if (cardClose) {
    cardClose.addEventListener('click', () => {
      selectAnchor(null);
    });
  }

  // 키보드 단축키: A(분석 모드), Esc(카드 닫기 → 분석 종료), ←/→(앵커 이동)
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.key === 'a' || e.key === 'A') {
      if (!camCtrl?.isWalkMode()) {
        e.preventDefault();
        setAnalysisMode(!active);
      }
    } else if (e.key === 'Escape') {
      if (selectedId) {
        e.preventDefault();
        selectAnchor(null);
      } else if (active) {
        e.preventDefault();
        setAnalysisMode(false);
      }
    } else if (active && e.key === 'ArrowRight') {
      e.preventDefault();
      cycleAnchor(1);
    } else if (active && e.key === 'ArrowLeft') {
      e.preventDefault();
      cycleAnchor(-1);
    }
  });

  // 100ms 스로틀 hover 피킹
  let lastHoverCheck = 0;
  window.addEventListener(
    'pointermove',
    (e) => {
      if (!active) return;
      const now = performance.now();
      if (now - lastHoverCheck < 100) return;
      lastHoverCheck = now;

      const el = document.elementFromPoint(e.clientX, e.clientY);
      const pin = el?.closest?.('.nw-anchor-pin');
      hoveredId = pin ? pin.dataset.anchorId : null;
    },
    { passive: true },
  );

  window.addEventListener('resize', () => {
    lineRes.set(window.innerWidth, window.innerHeight);
  });

  // 매 프레임 화면 투영 + 우선순위 기반 겹침 회피 + SVG 리더선 갱신
  const _proj = new THREE.Vector3();

  function updateOverlay(dt) {
    // 감광 보간
    const targetAlpha = active ? 1.0 : 0.0;
    analysisAlpha += (targetAlpha - analysisAlpha) * Math.min(1, dt * 8.0);
    world.uniforms.uAnalysis.value = analysisAlpha;

    // 스캔 펄스 진행
    if (scanElapsed >= 0) {
      scanElapsed += dt;
      if (scanElapsed <= SCAN_DURATION) {
        const u = scanElapsed / SCAN_DURATION;
        world.uniforms.uScanRadius.value = u * 260.0;
      } else {
        world.uniforms.uScanRadius.value = -10.0;
        scanElapsed = -1;
      }
    }

    if (!active) return;

    // 윤곽선 draw-on(400~700ms) 및 잔잔한 idle 펄스(±6% 이내)
    drawOnElapsed = Math.min(DRAW_ON_DURATION, drawOnElapsed + dt);
    const drawFactor = drawOnElapsed / DRAW_ON_DURATION;
    const idlePulse = 1.0 + 0.05 * Math.sin(performance.now() * 0.004);
    structLineMat.opacity = 0.62 * drawFactor * idlePulse;
    activeLineMat.opacity = 0.95 * drawFactor;
    markerGroup.rotation.y += dt * 0.45;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const isMobileViewport = w <= 720 || quality.tier === 'mobile';
    const maxCount = isMobileViewport ? 6 : 24;
    const cardOpen = Boolean(selectedId);
    const safeMaxX = cardOpen && !isMobileViewport ? w - 405 : w - 14;
    const safeMaxY = cardOpen && isMobileViewport ? h * 0.39 : h - 96;
    const safeMinY = isMobileViewport ? 132 : 76;

    const candidates = getFilteredAnchors();
    const placedBoxes = [];
    const svgParts = [];
    const now = performance.now();

    // 일단 모든 핀 숨김 표시 초기화
    const visibleSet = new Set();

    let rank = 0;
    for (const a of candidates) {
      if (visibleSet.size >= maxCount && a.id !== selectedId) continue;

      _proj.copy(a.pos).project(camera);
      if (_proj.z < -1 || _proj.z > 1) continue;

      const sx = (_proj.x * 0.5 + 0.5) * w;
      const sy = (-_proj.y * 0.5 + 0.5) * h;
      if (sx < 20 || sx > safeMaxX || sy < safeMinY || sy > safeMaxY) continue;

      // 45° + 직선 리더선 후보 오프셋 중 겹치지 않는 위치 탐색
      const pinEl = pinElements.get(a.id);
      const measuredW = pinEl?.offsetWidth || 0;
      const estW = a.title.length * 10.5 + a.summary.length * 7.2 + 26;
      const boxW = Math.min(w - 28, Math.max(measuredW, estW, 150));
      const boxH = 26;
      const offsets = [
        [22, -20],
        [-22 - boxW, -20],
        [22, 20],
        [-22 - boxW, 20],
        [32, -42],
        [-32 - boxW, -42],
      ];

      let chosen = null;
      for (const [ox, oy] of offsets) {
        const lx = Math.max(12 + boxW * 0.5, Math.min(safeMaxX - boxW * 0.5, sx + ox + boxW * 0.5));
        const ly = Math.max(safeMinY + boxH * 0.5, Math.min(safeMaxY - boxH * 0.5, sy + oy));
        const rect = {
          x0: lx - boxW * 0.5 - 6,
          y0: ly - boxH * 0.5 - 4,
          x1: lx + boxW * 0.5 + 6,
          y1: ly + boxH * 0.5 + 4,
        };
        const overlaps = placedBoxes.some(
          (b) => !(rect.x1 < b.x0 || rect.x0 > b.x1 || rect.y1 < b.y0 || rect.y0 > b.y1),
        );
        if (!overlaps || a.id === selectedId) {
          chosen = { lx, ly, rect };
          break;
        }
      }

      if (!chosen) continue;

      // 35ms 스태거 등장
      const staggerReady = now - enterTimestamp >= rank * 35;
      rank += 1;
      if (!staggerReady) continue;

      placedBoxes.push(chosen.rect);
      visibleSet.add(a.id);

      const pin = pinElements.get(a.id);
      if (pin) {
        pin.style.left = `${Math.round(chosen.lx)}px`;
        pin.style.top = `${Math.round(chosen.ly)}px`;
        pin.classList.add('is-visible');
      }

      // 4px 점 + 45° 대각선 후 수평 리더선 (선택 시 #6ADCFC 2px, 기본 #7F96C4 1.25px)
      const isSel = a.id === selectedId || a.id === hoveredId;
      const stroke = isSel ? '#6ADCFC' : '#7F96C4';
      const sw = isSel ? 2.0 : 1.25;
      const dy = chosen.ly - sy;
      const diag = Math.min(16, Math.abs(dy));
      const dirX = chosen.lx >= sx ? 1 : -1;
      const dirY = dy >= 0 ? 1 : -1;
      const kx = sx + dirX * diag;
      const ky = sy + dirY * diag;
      const ex = chosen.lx - dirX * (boxW * 0.5 - 2);

      svgParts.push(
        `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="2.2" fill="${stroke}" />`,
        `<polyline points="${sx.toFixed(1)},${sy.toFixed(1)} ${kx.toFixed(1)},${ky.toFixed(1)} ${ex.toFixed(1)},${chosen.ly.toFixed(1)}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-opacity="0.85" />`,
      );
    }

    for (const [id, pin] of pinElements) {
      if (!visibleSet.has(id)) {
        pin.classList.remove('is-visible');
      }
    }

    svgEl.innerHTML = svgParts.join('');
  }

  return {
    anchors,
    isActive: () => active,
    getFilter: () => currentFilter,
    getSelectedId: () => selectedId,
    setAnalysisMode,
    setLayerFilter,
    selectAnchor,
    cycleAnchor,
    update: updateOverlay,
  };
}
