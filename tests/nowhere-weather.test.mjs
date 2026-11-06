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


// ── 기상 × 시간 분리 ──
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const hexNear = (a, b, tol = 1) => [1, 3, 5].every((i) => Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)) <= tol);
function assertStateNear(actual, expected, keys, label) {
  for (const k of keys) {
    const a = actual[k];
    const e = expected[k];
    if (typeof e === 'number') assert.ok(near(a, e, 1e-6), `${label}: ${k} ${a} ≠ ${e}`);
    else assert.ok(hexNear(a, e), `${label}: ${k} ${a} ≠ ${e}`);
  }
}

test('(e) composeState: 14:00 에서는 흐림·비·눈이 기존 프리셋과 같다(성수·DS2)', async () => {
  const { composeState } = await import('../public/src/nowhere/weather.js');
  for (const ver of ['seongsu', 'ds2']) {
    const P = getPresets(ver);
    for (const w of ['overcast', 'rain', 'snow']) {
      const s = composeState(P, w, 14);
      assertStateNear(s, P[w], Object.keys(P[w]), `${ver}/${w}@14`);
    }
  }
});

test('(f) composeState: 시간이 빛을, 기상이 젖음·비·눈을 정한다 — 흐림 황혼 = 기존 황혼 빛, 비 오는 밤 = 밤 빛 + 비', async () => {
  const { composeState } = await import('../public/src/nowhere/weather.js');
  const P = getPresets('seongsu');
  const timeKeys = ['uNight', 'fogColor', 'fogFarColor', 'skyHorizon', 'skyZenith', 'skyGround', 'exposure', 'sunIntensity', 'sunColor'];
  assertStateNear(composeState(P, 'overcast', 18.5), P.dusk, timeKeys, 'overcast@18.5');
  const rainyNight = composeState(P, 'rain', 22);
  assert.equal(rainyNight.uNight, 1);
  assert.equal(rainyNight.uRain, P.rain.uRain);
  assert.equal(rainyNight.uWet, 1);
  const clearNight = composeState(P, 'overcast', 22);
  assert.equal(clearNight.uRain, 0, '흐린 밤에는 비가 오지 않는다(기존 밤 프리셋의 이슬비는 기상으로 분리)');
  const lum = (h) => parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16);
  assert.ok(lum(rainyNight.skyHorizon) <= lum(clearNight.skyHorizon), '비 오는 밤 하늘은 흐린 밤보다 어둡거나 같다');
  const snowyDusk = composeState(P, 'snow', 18.5);
  assert.equal(snowyDusk.uSnow, 1);
  assert.ok(near(snowyDusk.uNight, P.dusk.uNight));
});

test('(g) sunDirAt: 14:00 은 월드 기준 해 방향, 낮에는 떠 있고 밤에는 지평선 아래, 시간이 가면 방위가 돈다', async () => {
  const { sunDirAt } = await import('../public/src/nowhere/weather.js');
  const base = [0.4763, 0.4384, -0.7622];   // DS2 layout.sun.dir (방위 32°, 고도 26°)
  const at14 = sunDirAt(14, base);
  assert.ok(near(at14.sun.x, base[0], 1e-3) && near(at14.sun.y, base[1], 1e-3) && near(at14.sun.z, base[2], 1e-3));
  assert.ok(sunDirAt(12, base).elevation > 0 && sunDirAt(17, base).elevation > 0);
  assert.ok(sunDirAt(4, base).elevation < 0 && sunDirAt(21, base).elevation < 0);
  const az = (d) => Math.atan2(d.x, -d.z);
  assert.ok(az(sunDirAt(15, base).sun) > az(at14.sun), '시간이 지나면 방위각이 늘어난다(시계 방향)');
  // 해가 지면 조명은 달빛 방향(지평선 위)으로 바뀐다
  assert.ok(sunDirAt(23, base).light.y > 0.3);
  assert.ok(near(Math.hypot(at14.light.x, at14.light.y, at14.light.z), 1, 1e-9));
});

test('(h) parseTimeParam·timeLabel: URL time=21.5 / 21:30, 시간대 이름', async () => {
  const { parseTimeParam, timeLabel } = await import('../public/src/nowhere/weather.js');
  assert.equal(parseTimeParam('21.5'), 21.5);
  assert.equal(parseTimeParam('21:30'), 21.5);
  assert.equal(parseTimeParam('7:15'), 7.25);
  assert.equal(parseTimeParam('abc'), null);
  assert.equal(parseTimeParam('25'), null);
  assert.equal(timeLabel(14), '14:00 · 낮');
  assert.equal(timeLabel(18.5), '18:30 · 황혼');
  assert.equal(timeLabel(21.75), '21:45 · 밤');
  assert.equal(timeLabel(5.5), '05:30 · 새벽');
});
