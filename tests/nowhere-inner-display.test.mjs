import test from 'node:test';
import assert from 'node:assert/strict';
import { DISPLAY_TITLE, displayLines, displayKey, createDisplayScreen, worldHourDate } from '../public/src/nowhere/inner-display.js';
import { timeLabel } from '../public/src/nowhere/weather.js';

test('(a) 문구: 제목 · 24시 HH:MM(두 자리) · 기상 이름', () => {
  assert.deepEqual(displayLines(new Date(2026, 10, 9, 7, 5), 'rain'), [DISPLAY_TITLE, '07:05', '비']);
  assert.deepEqual(displayLines(new Date(2026, 10, 9, 21, 30), 'overcast'), ['HAUS NOWHERE SEOUL', '21:30', '흐림']);
  assert.equal(displayLines(new Date(2026, 10, 9, 0, 0), 'snow')[2], '눈');
  assert.equal(displayLines(new Date(2026, 10, 9, 0, 0), 'fog')[2], 'fog', '모르는 기상은 이름 그대로');
});

test('(b) 키: 같은 분 · 같은 기상이면 같고, 분이나 기상이 바뀌면 다르다', () => {
  const a = new Date(2026, 10, 9, 7, 5, 1);
  const b = new Date(2026, 10, 9, 7, 5, 59);
  const c = new Date(2026, 10, 9, 7, 6, 0);
  assert.equal(displayKey(a, 'rain'), displayKey(b, 'rain'));
  assert.notEqual(displayKey(b, 'rain'), displayKey(c, 'rain'));
  assert.notEqual(displayKey(a, 'rain'), displayKey(a, 'snow'));
});

test('(c) 화면: 메시에 캔버스 텍스처 재질을 입히고, 분 · 기상이 바뀔 때만 다시 그린다', () => {
  const texts = [];
  const ctx = { fillRect() {}, fillText: (t) => texts.push(t), set fillStyle(v) {}, set font(v) {}, set textBaseline(v) {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
  class CanvasTexture { constructor(canvas) { this.image = canvas; } }
  class MeshBasicMaterial { constructor(o) { Object.assign(this, o); } }
  const THREE = { CanvasTexture, MeshBasicMaterial, SRGBColorSpace: 'srgb' };
  const mesh = { material: null };
  let weather = 'rain';
  const scr = createDisplayScreen({ THREE, mesh, getWeather: () => weather });
  assert.ok(mesh.material.map instanceof CanvasTexture);
  assert.equal(mesh.material.map.flipY, false, 'glTF UV(위가 v=0)에 맞춰 flipY=false');
  assert.equal(mesh.material.toneMapped, false);
  assert.ok(texts.includes(DISPLAY_TITLE) && texts.includes('비'));
  const t0 = new Date(2026, 10, 9, 7, 5, 0);
  scr.update(t0);
  assert.equal(scr.update(new Date(2026, 10, 9, 7, 5, 30)), false, '같은 분이면 다시 그리지 않음');
  assert.equal(scr.update(new Date(2026, 10, 9, 7, 6, 0)), true, '분이 바뀌면 다시 그림');
  weather = 'snow';
  assert.equal(scr.update(new Date(2026, 10, 9, 7, 6, 10)), true, '기상이 바뀌면 다시 그림');
  assert.ok(texts.includes('07:06') && texts.includes('눈'));
  delete globalThis.document;
});

test('(d) 월드 시각: 시간 슬라이더 hour(소수) → HUD 와 같은 HH:MM(분 반올림, 60 분은 다음 시)', () => {
  assert.equal(displayLines(worldHourDate(9.25), 'rain')[1], '09:15');
  assert.equal(displayLines(worldHourDate(14), 'rain')[1], '14:00');
  assert.equal(displayLines(worldHourDate(21.75), 'rain')[1], '21:45');
  assert.equal(displayLines(worldHourDate(9.999), 'rain')[1], '10:00', '59.94 분 → 다음 시 00 분');
  // 슬라이더 칸(0.25 시간) · 임의 소수 모두 HUD(timeLabel) 의 HH:MM 과 같다
  for (let h = 0; h < 24; h += 0.25) assert.equal(displayLines(worldHourDate(h))[1], timeLabel(h).slice(0, 5), `hour ${h}`);
  for (const h of [0.01, 7.4, 13.333, 18.9917, 23.99]) assert.equal(displayLines(worldHourDate(h))[1], timeLabel(h).slice(0, 5), `hour ${h}`);
  // Date 는 24:00 을 못 나타내므로 슬라이더 끝(24)은 같은 순간인 00:00 으로 보인다(HUD 는 24:00)
  assert.equal(displayLines(worldHourDate(24))[1], '00:00');
  // 분이 바뀌면 다시 그리는 키도 달라진다
  assert.notEqual(displayKey(worldHourDate(9.25), 'rain'), displayKey(worldHourDate(9.5), 'rain'));
});
