// HAUS NOWHERE — 성능 표시(P 키 · 주소 ?stats=1): FPS · 프레임 시간 · 그리기 호출 · 삼각형 · 텍스처 메모리 추정 · JS 힙 · 해상도 · 기기 등급 · GPU.
// 계측(createFrameMeter · textureBytes · perfLines · fpsLevel)은 순수 — 테스트: tests/nowhere-perf.test.mjs. DOM 은 createPerfHud 만 만든다.
// 키보드 없는 기기(아이패드 등)는 주소에 ?stats=1 을 붙이면 켜진 채 시작한다.

export const PERF_WINDOW_MS = 500;   // 이 간격마다 수치를 갱신(그 사이 프레임을 모아 평균 · 최악)
const TEXTURE_SCAN_MS = 3000;        // 텍스처 메모리 추정은 장면을 훑으므로 3 초마다

/** 프레임 시각(ms, rAF · performance.now)을 받아 창(windowMs)이 찰 때마다 { fps, avgMs, worstMs } 를, 그 사이에는 null 을 돌려준다. */
export function createFrameMeter(windowMs = PERF_WINDOW_MS) {
  let last = null;
  let start = 0;
  let frames = 0;
  let worst = 0;
  return {
    tick(now) {
      if (last == null) {
        last = now;
        start = now;
        return null;
      }
      const dt = now - last;
      last = now;
      frames++;
      if (dt > worst) worst = dt;
      const span = now - start;
      if (span < windowMs) return null;
      const r = { fps: (frames * 1000) / span, avgMs: span / frames, worstMs: worst };
      start = now;
      frames = 0;
      worst = 0;
      return r;
    },
    /** 숨겼다 다시 켤 때 — 다음 프레임을 새 기준점으로 */
    reset() {
      last = null;
    },
  };
}

/** 장면들의 재질 텍스처(중복 없이)를 RGBA 8bit 로 올렸다고 보고 바이트를 추정한다(밉맵이면 ×4/3). */
export function textureBytes(roots) {
  const seen = new Set();
  let bytes = 0;
  for (const root of roots) {
    root?.traverse((o) => {
      const mats = !o.material ? [] : Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        for (const v of Object.values(m)) {
          if (!v || !v.isTexture || seen.has(v)) continue;
          seen.add(v);
          const w = v.image?.width || 0;
          const h = v.image?.height || 0;
          if (!w || !h) continue;
          bytes += w * h * 4 * (v.generateMipmaps === false ? 1 : 4 / 3);
        }
      }
    });
  }
  return { bytes, count: [...seen].filter((t) => t.image?.width).length };
}

/** FPS 등급: 50 이상 good · 30 이상 ok · 그 아래 bad */
export function fpsLevel(fps) {
  return fps >= 50 ? 'good' : fps >= 30 ? 'ok' : 'bad';
}

const count = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));

/** 표시할 줄들 */
export function perfLines(s) {
  return [
    `FPS ${s.fps.toFixed(1)} · ${s.avgMs.toFixed(1)} ms (최대 ${s.worstMs.toFixed(1)})`,
    `그리기 ${s.calls} · 삼각형 ${count(s.tris)}`,
    `텍스처 ${s.textures}개 ≈ ${Math.round(s.texMB)} MB(올라간 전체 추정) · 지오메트리 ${s.geometries}`,
    s.heapMB == null ? 'JS 힙 — (이 브라우저는 제공 안 함)' : `JS 힙 ${Math.round(s.heapMB)} MB`,
    `해상도 ${s.bufW}×${s.bufH} (DPR ${s.dpr}) · 등급 ${s.tier}`,
    `GPU ${s.gpu || '—'}`,
  ];
}

function gpuName(gl) {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).replace(/^ANGLE \((.*)\)$/, '$1').replace(/, Unspecified Version$/, '');
  } catch {
    return '';
  }
}

/**
 * 오른쪽 위 성능 패널. frame(now) 를 렌더 직후 매 프레임 부른다(꺼져 있으면 아무것도 안 함).
 * getScenes(): 지금 그리는 장면들(텍스처 추정용), tier: 기기 등급.
 */
export function createPerfHud({ renderer, getScenes, tier }) {
  const root = document.createElement('div');
  root.className = 'nw-perf';
  root.hidden = true;
  root.setAttribute('aria-live', 'off');
  document.body.append(root);
  const meter = createFrameMeter();
  const gpu = gpuName(renderer.getContext());
  let tex = { bytes: 0, count: 0 };
  let texAt = -Infinity;

  function frame(now) {
    if (root.hidden) return;
    const m = meter.tick(now);
    if (!m) return;
    if (now - texAt >= TEXTURE_SCAN_MS) {
      tex = textureBytes(getScenes());
      texAt = now;
    }
    const info = renderer.info;
    const canvas = renderer.domElement;   // 그리기 버퍼 크기(CSS 크기 × DPR)
    const mem = typeof performance !== 'undefined' ? performance.memory : null;
    const lines = perfLines({
      ...m,
      calls: info.render.calls,
      tris: info.render.triangles,
      textures: tex.count,
      geometries: info.memory.geometries,
      texMB: tex.bytes / 1048576,
      heapMB: mem ? mem.usedJSHeapSize / 1048576 : null,
      dpr: +renderer.getPixelRatio().toFixed(2),
      bufW: canvas.width,
      bufH: canvas.height,
      tier,
      gpu,
    });
    root.dataset.level = fpsLevel(m.fps);
    root.textContent = lines.join('\n');
  }

  function toggle(on = root.hidden) {
    root.hidden = !on;
    if (on) {
      meter.reset();
      texAt = -Infinity;
      root.textContent = 'FPS 재는 중…';
      delete root.dataset.level;
    }
  }

  return { frame, toggle, isOpen: () => !root.hidden, element: root };
}
