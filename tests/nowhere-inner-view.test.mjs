import test from 'node:test';
import assert from 'node:assert/strict';
import { viewKey, hasWindowView, lerpHex, interiorLighting, createWindowView, VIEW_SIZE } from '../public/src/nowhere/inner-view.js';

test('(a) 창밖: 지하(elevation < 0)는 캡처하지 않고, 키는 기상 · 시각(소수 둘째 자리)', () => {
  assert.equal(hasWindowView({ elevation: -4.5 }), false);
  assert.equal(hasWindowView({ elevation: 0 }), true);
  assert.equal(hasWindowView({ elevation: 55 }), true);
  assert.equal(viewKey('rain', 21.5), 'rain|21.50');
  assert.notEqual(viewKey('rain', 21.5), viewKey('rain', 21.51));
});

test('(b) 색 보간: 양 끝 · 가운데', () => {
  assert.equal(lerpHex('#000000', '#ffffff', 0), '#000000');
  assert.equal(lerpHex('#000000', '#ffffff', 1), '#ffffff');
  assert.equal(lerpHex('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(lerpHex('#F4F1EA', '#FFE2BC', 2), '#ffe2bc', '1 을 넘으면 끝 색');
});

test('(c) 밤 조명: uNight 0.5 이하는 낮과 같고, 1 이면 따뜻하게 · 밝게. 모바일은 채움광', () => {
  const day = interiorLighting(0);
  assert.deepEqual(interiorLighting(0.5), day);
  assert.equal(day.hemiSky, '#f4f1ea');
  assert.equal(day.keyColor, '#fff4e6');
  assert.equal(day.hemiIntensity, 1.1);
  assert.equal(day.keyIntensity, 1.2);
  assert.equal(day.ambient, 0);
  const night = interiorLighting(1);
  assert.equal(night.keyColor, '#ffc27a');
  assert.ok(night.keyIntensity > day.keyIntensity && night.hemiIntensity > day.hemiIntensity);
  assert.equal(interiorLighting(0, true).ambient, 1.2);
  assert.ok(interiorLighting(1, true).ambient > 1.2);
});

test('(d) 캡처: HAUS 를 숨긴 채 그 층 높이 + 1.7 m 에서 외관 씬을 찍고, 숨김을 되돌린다', () => {
  const calls = [];
  const haus = { visible: true };
  class WebGLCubeRenderTarget {
    constructor(size, opts) { this.size = size; this.opts = opts; this.texture = { isCubeTexture: true }; }
    dispose() { this.disposed = true; }
  }
  class CubeCamera {
    constructor(near, far, rt) {
      this.near = near; this.far = far; this.rt = rt;
      this.position = { set: (x, y, z) => { this.pos = [x, y, z]; } };
    }
    update(renderer, scene) { calls.push({ visible: haus.visible, pos: this.pos, renderer, scene }); }
  }
  const THREE = { WebGLCubeRenderTarget, CubeCamera, HalfFloatType: 1016 };
  const renderer = {};
  const exteriorScene = {};
  const v = createWindowView({ THREE, renderer, exteriorScene, world: { layerGroups: { building_haus: haus } } });
  const tex = v.capture(55);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].visible, false, '찍는 동안 HAUS 숨김');
  assert.deepEqual(calls[0].pos, [0, 56.7, 0]);
  assert.equal(calls[0].scene, exteriorScene);
  assert.equal(haus.visible, true, '찍은 뒤 되돌림');
  assert.equal(tex.isCubeTexture, true);
  assert.equal(v.texture, tex);
  v.dispose();
});

test('(e) HAUS 그룹이 없어도 캡처한다', () => {
  class WebGLCubeRenderTarget { constructor() { this.texture = {}; } dispose() {} }
  class CubeCamera { constructor() { this.position = { set() {} }; } update() {} }
  const v = createWindowView({ THREE: { WebGLCubeRenderTarget, CubeCamera, HalfFloatType: 1 }, renderer: {}, exteriorScene: {}, world: {} });
  assert.ok(v.capture(0));
  assert.equal(VIEW_SIZE, 256);
});
