import test from 'node:test';
import assert from 'node:assert/strict';
import { DISPLAY_TITLE, displayLines, displayKey, createDisplayScreen, nowClockText } from '../public/src/nowhere/inner-display.js';
import { clockText, timeLabel } from '../public/src/nowhere/weather.js';

test('(a) 문구: 제목 · 시각 글자 · 기상 이름', () => {
  assert.deepEqual(displayLines('07:05', 'rain'), [DISPLAY_TITLE, '07:05', '비']);
  assert.deepEqual(displayLines('21:30', 'overcast'), ['HAUS NOWHERE SEOUL', '21:30', '흐림']);
  assert.deepEqual(displayLines('14:00', 'clear'), ['HAUS NOWHERE SEOUL', '14:00', '맑음']);
  assert.equal(displayLines('00:00', 'snow')[2], '눈');
  assert.equal(displayLines('00:00', 'fog')[2], 'fog', '모르는 기상은 이름 그대로');
});

test('(b) 키: 같은 시각(분) · 같은 기상이면 같고, 분이나 기상이 바뀌면 다르다', () => {
  assert.equal(displayKey(clockText(7 + 5 / 60), 'rain'), displayKey(clockText(7 + 5.4 / 60), 'rain'));
  assert.notEqual(displayKey('07:05', 'rain'), displayKey('07:06', 'rain'));
  assert.notEqual(displayKey('07:05', 'rain'), displayKey('07:05', 'snow'));
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
  scr.update('07:05');
  assert.equal(scr.update('07:05'), false, '같은 분이면 다시 그리지 않음');
  assert.equal(scr.update('07:06'), true, '분이 바뀌면 다시 그림');
  weather = 'snow';
  assert.equal(scr.update('07:06'), true, '기상이 바뀌면 다시 그림');
  assert.ok(texts.includes('07:06') && texts.includes('눈'));
  delete globalThis.document;
});

test('(d) 월드 시각: 시간 슬라이더 hour(소수) → HUD 와 같은 HH:MM(분 반올림, 60 분은 다음 시, 24 는 24:00)', () => {
  assert.equal(clockText(9.25), '09:15');
  assert.equal(clockText(14), '14:00');
  assert.equal(clockText(21.75), '21:45');
  assert.equal(clockText(9.999), '10:00', '59.94 분 → 다음 시 00 분');
  assert.equal(clockText(24), '24:00', '슬라이더 끝은 HUD 처럼 24:00(다음 날 00:00 이 아님)');
  // 슬라이더 칸(0.25 시간, 끝 24 포함) · 임의 소수 모두 HUD(timeLabel) 의 HH:MM 과 같다
  for (let h = 0; h <= 24; h += 0.25) assert.equal(displayLines(clockText(h))[1], timeLabel(h).slice(0, 5), `hour ${h}`);
  for (const h of [0.01, 7.4, 13.333, 18.9917, 23.99]) assert.equal(displayLines(clockText(h))[1], timeLabel(h).slice(0, 5), `hour ${h}`);
  // 월드 시각을 모를 때(기상 없음)는 실제 시계의 시 · 분
  assert.equal(nowClockText(new Date(2026, 10, 9, 7, 59, 40)), '07:59');
  assert.equal(nowClockText(new Date(2026, 10, 9, 0, 0, 0)), '00:00');
});
