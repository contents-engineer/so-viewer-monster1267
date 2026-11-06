import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, getPresets, lerp, srgbToLinear, linearToSrgb } from '../public/src/nowhere/weather.js';

test('(a) PRESETS 5종(overcast, rain, dusk, night, snow)이 존재하고 키 집합이 모두 동일하다', () => {
  const names = ['overcast', 'rain', 'dusk', 'night', 'snow'];
  for (const n of names) {
    assert.ok(PRESETS[n], `프리셋 누락: ${n}`);
  }
  const baseKeys = Object.keys(PRESETS.overcast).sort();
  assert.ok(baseKeys.length >= 10);
  for (const n of names) {
    assert.deepEqual(Object.keys(PRESETS[n]).sort(), baseKeys, `${n} 프리셋의 키 집합이 다름`);
  }
});

test('(b) lerp(a, b, t): 숫자는 선형 보간하고 t 는 [0, 1] 로 클램프한다', () => {
  const a = PRESETS.overcast;
  const b = PRESETS.rain;

  const atNeg = lerp(a, b, -0.5);
  const atZero = lerp(a, b, 0);
  const atOne = lerp(a, b, 1);
  const atOver = lerp(a, b, 1.8);
  const atHalf = lerp(a, b, 0.5);

  assert.equal(atNeg.uWet, a.uWet);
  assert.equal(atZero.uWet, a.uWet);
  assert.equal(atOne.uWet, b.uWet);
  assert.equal(atOver.uWet, b.uWet);
  assert.ok(Math.abs(atHalf.uWet - (a.uWet + b.uWet) * 0.5) < 1e-6);
});

test('(c) lerp(a, b, t): hex 색상은 선형 RGB 공간에서 보간한다', () => {
  const c0 = { col: '#000000', val: 0 };
  const c1 = { col: '#FFFFFF', val: 10 };
  const mid = lerp(c0, c1, 0.5);
  assert.equal(mid.val, 5);
  // 선형 공간에서 0.5 는 sRGB 약 0.735 (#BCBCBC 부근)로, 단순 sRGB 중간(#808080)보다 밝아야 한다.
  const rByte = parseInt(mid.col.slice(1, 3), 16);
  const expectedSrgb = Math.round(linearToSrgb(0.5) * 255);
  assert.ok(Math.abs(rByte - expectedSrgb) <= 1, `rByte=${rByte}, expected=${expectedSrgb}`);
  assert.ok(rByte > 170, `선형 RGB 보간이면 중간 회색이 sRGB 170보다 커야 함 (실제 ${rByte})`);
  assert.ok(Math.abs(srgbToLinear(linearToSrgb(0.37)) - 0.37) < 1e-6);
});

test('(d) getPresets: 성수는 PRESETS 그대로, DS2 는 같은 키 집합에 역광 헤이즈(sunHaze)·높이 연무를 덮어쓴다', () => {
  assert.equal(getPresets('seongsu'), PRESETS);
  const ds2 = getPresets('ds2');
  const baseKeys = Object.keys(PRESETS.overcast).sort();
  for (const n of Object.keys(PRESETS)) {
    assert.deepEqual(Object.keys(ds2[n]).sort(), baseKeys, `ds2 ${n} 프리셋의 키 집합이 다름`);
    assert.equal(PRESETS[n].sunHaze, 0, `성수 ${n} 는 태양 헤이즈가 없어야 함`);
  }
  assert.ok(ds2.overcast.sunHaze > 0.5, 'DS2 흐림은 역광 태양 헤이즈가 보여야 함');
  assert.ok(ds2.overcast.uFogK < PRESETS.overcast.uFogK, 'DS2 계곡 연무는 성수보다 높이까지 차야 함(uFogK 작게)');
  assert.equal(ds2.night.sunHaze, 0);
});

