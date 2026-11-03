import test from 'node:test';
import assert from 'node:assert/strict';
import { heightFog, FOG_GLSL } from '../public/src/nowhere/fog.js';

test('(a) heightFog: 같은 높이(cam.y === pos.y) 수평선에서 1 - exp(-b * len * exp(-k * y)) 와 일치한다', () => {
  const b = 0.0035;
  const k = 0.045;
  for (const y of [0, 1.7, 15, 60]) {
    const cam = { x: -105, y, z: 50 };
    const pos = { x: 45, y, z: -30 };
    const len = Math.hypot(pos.x - cam.x, pos.y - cam.y, pos.z - cam.z);
    const expected = 1 - Math.exp(-b * len * Math.exp(-k * y));
    const actual = heightFog(cam, pos, b, k);
    assert.ok(Math.abs(actual - expected) < 1e-6, `y=${y}: actual=${actual}, expected=${expected}`);
  }
});

test('(b) heightFog: k -> 0 극한에서 균일 지수 안개 1 - exp(-b * len) 와 일치한다', () => {
  const b = 0.006;
  const cam = { x: 0, y: 2.0, z: 0 };
  const pos = { x: 120, y: 48.0, z: -90 };
  const len = Math.hypot(pos.x - cam.x, pos.y - cam.y, pos.z - cam.z);
  const expected = 1 - Math.exp(-b * len);
  const actualZero = heightFog(cam, pos, b, 0);
  const actualTiny = heightFog(cam, pos, b, 1e-8);
  assert.ok(Math.abs(actualZero - expected) < 1e-5, `k=0: ${actualZero} vs ${expected}`);
  assert.ok(Math.abs(actualTiny - expected) < 1e-5, `k=1e-8: ${actualTiny} vs ${expected}`);
});

test('(c) heightFog: 같은 거리에서 고도(y)가 높아질수록 안개량이 단조 감소한다', () => {
  const b = 0.004;
  const k = 0.045;
  const fLow = heightFog({ x: 0, y: 1.5, z: 0 }, { x: 200, y: 5.0, z: 0 }, b, k);
  const fMid = heightFog({ x: 0, y: 25.0, z: 0 }, { x: 200, y: 28.5, z: 0 }, b, k);
  const fHigh = heightFog({ x: 0, y: 80.0, z: 0 }, { x: 200, y: 83.5, z: 0 }, b, k);
  assert.ok(fLow > fMid && fMid > fHigh, `Expected ${fLow} > ${fMid} > ${fHigh}`);
  assert.equal(heightFog({ x: 10, y: 5, z: -3 }, { x: 10, y: 5, z: -3 }, b, k), 0);
  assert.ok(FOG_GLSL.includes('float heightFog(vec3 cam, vec3 pos, float b, float k)'));
});
