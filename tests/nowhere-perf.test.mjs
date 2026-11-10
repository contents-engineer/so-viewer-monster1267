import test from 'node:test';
import assert from 'node:assert/strict';
import { createFrameMeter, textureBytes, perfLines, fpsLevel, PERF_WINDOW_MS } from '../public/src/nowhere/perf-hud.js';

test('(a) 프레임 계측: 창(PERF_WINDOW_MS)마다 실제 시각으로 FPS · 평균 · 최악 프레임 시간(느린 기기도 상한 없이)', () => {
  assert.equal(PERF_WINDOW_MS, 500);
  const m = createFrameMeter(500);
  assert.equal(m.tick(1000), null, '첫 프레임은 기준점');
  let r = null;
  // 20 ms 간격 25 프레임 = 500 ms → 50 fps
  for (let i = 1; i <= 25; i++) r = m.tick(1000 + i * 20) || r;
  assert.ok(r);
  assert.equal(Math.round(r.fps), 50);
  assert.equal(Math.round(r.avgMs), 20);
  assert.equal(r.worstMs, 20);
  // 125 ms 프레임(8 fps) — main.js 의 dt 0.1 s 상한과 달리 그대로 잰다
  r = null;
  for (let i = 1; i <= 4; i++) r = m.tick(1500 + i * 125) || r;
  assert.equal(Math.round(r.fps), 8);
  assert.equal(r.worstMs, 125);
  // 끊김 하나는 최악 프레임 시간에 드러난다
  r = null;
  let t = 2000;
  for (let i = 0; i < 30; i++) {
    t += i === 10 ? 80 : 16;
    r = m.tick(t) || r;
  }
  assert.equal(r.worstMs, 80);
  // reset 뒤 첫 프레임은 다시 기준점(숨겼다 다시 켜도 긴 간격이 섞이지 않게)
  m.reset();
  assert.equal(m.tick(99999), null);
});

test('(b) 텍스처 메모리 추정: 같은 텍스처는 한 번, 밉맵 ×4/3, 재질 배열 · 크기 없는 이미지 처리', () => {
  const tex = (w, h, mip = true) => ({ isTexture: true, image: { width: w, height: h }, generateMipmaps: mip });
  const shared = tex(1024, 1024);
  const a = { material: { map: shared, normalMap: tex(512, 512, false) } };
  const b = { material: [{ map: shared }, { aoMap: tex(256, 128) }, { map: { isTexture: true, image: null } }] };
  const root = { traverse: (fn) => [a, b, { material: null }].forEach(fn) };
  const expected = 1024 * 1024 * 4 * (4 / 3) + 512 * 512 * 4 + 256 * 128 * 4 * (4 / 3);
  const r = textureBytes([root]);
  assert.equal(r.count, 3);
  assert.equal(Math.round(r.bytes), Math.round(expected));
});

test('(c) 표시 문구 · FPS 등급', () => {
  const lines = perfLines({
    fps: 58.94, avgMs: 16.97, worstMs: 33.4, calls: 182, tris: 1225242, textures: 148, geometries: 167,
    texMB: 991.4, heapMB: 621.2, dpr: 1.75, bufW: 2926, bufH: 1596, tier: 'desktop', gpu: 'Apple M1',
  });
  assert.deepEqual(lines, [
    'FPS 58.9 · 17.0 ms (최대 33.4)',
    '그리기 182 · 삼각형 1.23M',
    '텍스처 148개 ≈ 991 MB(올라간 전체 추정) · 지오메트리 167',
    'JS 힙 621 MB',
    '해상도 2926×1596 (DPR 1.75) · 등급 desktop',
    'GPU Apple M1',
  ]);
  const safari = perfLines({ fps: 24, avgMs: 41.7, worstMs: 60, calls: 33, tris: 137694, textures: 152, geometries: 199, texMB: 456, heapMB: null, dpr: 1.5, bufW: 1536, bufH: 1152, tier: 'mobile', gpu: '' });
  assert.equal(safari[1], '그리기 33 · 삼각형 138K');
  assert.equal(safari[3], 'JS 힙 — (이 브라우저는 제공 안 함)');
  assert.equal(safari[5], 'GPU —');
  assert.equal(fpsLevel(55), 'good');
  assert.equal(fpsLevel(50), 'good');
  assert.equal(fpsLevel(40), 'ok');
  assert.equal(fpsLevel(29.9), 'bad');
});
