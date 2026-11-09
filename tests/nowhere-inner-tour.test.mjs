import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTourLegs, createTourPlayer, LEG_MIN_S, LEG_MAX_S } from '../public/src/nowhere/inner-tour.js';

const start = { pos: [0, 1.7, 13], target: [0, 2.5, 0] };
const stops = [
  { pos: [6, 2.2, 8], target: [0, 1.8, 0], caption: '도시 모형', duration: 5 },
  { pos: [4, 1.8, -3], target: [8.8, 1.2, -7.2], caption: 'DJ', duration: 30 },
  { pos: [-8, 2.4, -2], target: [-16.4, 2.4, -6], caption: '', duration: 0.5 },
];

test('(a) 구간: 시작 → 첫 지점 → … , 시간은 2~8 초로 묶는다', () => {
  const legs = buildTourLegs(start, stops);
  assert.equal(legs.length, 3);
  assert.deepEqual(legs[0].points, [start.pos, stops[0].pos]);
  assert.deepEqual(legs[0].targets, [start.target, stops[0].target]);
  assert.deepEqual(legs[1].points, [stops[0].pos, stops[1].pos]);
  assert.deepEqual(legs.map((l) => l.duration), [5, LEG_MAX_S, LEG_MIN_S]);
  assert.deepEqual(legs.map((l) => l.caption), ['도시 모형', 'DJ', '']);
});

function fakeCam(results = []) {
  const flights = [];
  return {
    flights,
    stopped: 0,
    flyTo(path, opts) {
      flights.push({ path, opts });
      return Promise.resolve(results.length ? results.shift() : 'done');
    },
    stopFlight() { this.stopped++; },
  };
}

test('(b) 재생: 구간마다 자막을 띄우고 끊을 수 있는 비행, 끝나면 자막을 지우고 done', async () => {
  const cam = fakeCam();
  const captions = [];
  const p = createTourPlayer({ camCtrl: cam, getView: () => start, showCaption: (t) => captions.push(t), wait: () => Promise.resolve() });
  assert.equal(await p.play(stops), 'done');
  assert.equal(cam.flights.length, 3);
  assert.ok(cam.flights.every((f) => f.opts.interruptible === true));
  assert.deepEqual(cam.flights[0].path.points, [start.pos, stops[0].pos]);
  assert.deepEqual(captions, ['도시 모형', 'DJ', '', '']);
  assert.equal(p.isPlaying(), false);
});

test('(c) 입력으로 비행이 끊기면(cancelled) 멈추고 stopped, 다음 구간으로 가지 않는다', async () => {
  const cam = fakeCam(['done', 'cancelled']);
  const captions = [];
  const p = createTourPlayer({ camCtrl: cam, getView: () => start, showCaption: (t) => captions.push(t), wait: () => Promise.resolve() });
  assert.equal(await p.play(stops), 'stopped');
  assert.equal(cam.flights.length, 2);
  assert.equal(captions.at(-1), '');
  assert.equal(p.isPlaying(), false);
});

test('(d) stop(): 머무는 중에 멈추면 비행을 끊고 자막을 지우며 다음 구간으로 가지 않는다', async () => {
  const cam = fakeCam();
  let release;
  const p = createTourPlayer({
    camCtrl: cam,
    getView: () => start,
    showCaption: () => {},
    wait: () => new Promise((r) => { release = r; }),
  });
  const run = p.play(stops);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(p.isPlaying(), true);
  p.stop();
  release();
  assert.equal(await run, 'stopped');
  assert.equal(cam.flights.length, 1);
  assert.equal(cam.stopped, 1);
  assert.equal(p.isPlaying(), false);
});

test('(e) cut 이 있으면 첫 지점은 비행 대신 cut 으로 옮기고(지점 0 한 번), 나머지 구간은 그대로 비행한다', async () => {
  const cam = fakeCam();
  const cuts = [];
  const captions = [];
  const p = createTourPlayer({
    camCtrl: cam,
    getView: () => start,
    showCaption: (t) => captions.push(t),
    wait: () => Promise.resolve(),
    cut: (to) => { cuts.push(to); return Promise.resolve(); },
  });
  assert.equal(await p.play(stops), 'done');
  assert.deepEqual(cuts, [{ pos: stops[0].pos, target: stops[0].target }]);
  assert.equal(cam.flights.length, stops.length - 1, '첫 구간은 비행하지 않는다');
  assert.deepEqual(cam.flights[0].path.points, [stops[0].pos, stops[1].pos]);
  assert.ok(cam.flights.every((f) => f.opts.interruptible === true));
  assert.deepEqual(captions, ['도시 모형', 'DJ', '', '']);
  assert.equal(p.isPlaying(), false);
});

test('(f) cut 도중 stop() 이면 stopped, 비행 없이 자막을 지우고 멈춘다', async () => {
  const cam = fakeCam();
  let release;
  const captions = [];
  const p = createTourPlayer({
    camCtrl: cam,
    getView: () => start,
    showCaption: (t) => captions.push(t),
    wait: () => Promise.resolve(),
    cut: () => new Promise((r) => { release = r; }),
  });
  const run = p.play(stops);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(p.isPlaying(), true);
  p.stop();
  release();
  assert.equal(await run, 'stopped');
  assert.equal(cam.flights.length, 0);
  assert.equal(captions.at(-1), '');
  assert.equal(p.isPlaying(), false);
});
