import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../public/vendor/three/three.module.js';
import { SEONGSU_INTRO } from '../public/src/nowhere/intro-path.js';
import { buildFlightPath } from '../public/src/nowhere/flight.js';
import { approachFor } from '../public/src/nowhere/tour-config.js';

const layout = JSON.parse(readFileSync(new URL('../public/assets/nowhere/layout.json', import.meta.url), 'utf8'));
const MIN_CLEAR = 2.0;   // m — 카메라는 건물 · 고가 · 타워 · 스카이브리지 상자에 이보다 가까이 가지 않는다

function boxDist([x, y, z], b) {
  const dx = Math.max(b.min[0] - x, 0, x - b.max[0]);
  const dy = Math.max(b.min[1] - y, 0, y - b.max[1]);
  const dz = Math.max(b.min[2] - z, 0, z - b.max[2]);
  return Math.hypot(dx, dy, dz);
}
function nearest(points) {
  let best = { d: Infinity, id: null, at: null };
  for (const p of points) {
    for (const b of layout.solids) {
      const d = boxDist(p, b);
      if (d < best.d) best = { d, id: b.id, at: p.map((v) => Number(v.toFixed(1))) };
    }
  }
  return best;
}
// camera.js 의 인트로·비행과 같은 곡선(기본 CatmullRomCurve3)과 같은 표본
function sampleCurve(points, n, ease) {
  const c = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const v = c.getPointAt(ease ? t * t * (3 - 2 * t) : t);
    out.push([v.x, v.y, v.z]);
  }
  return out;
}

test('(a) layout.solids: 건물 표 · 아파트 · 고가 상판 · 두 건물이 있고 상자가 올바르다', () => {
  // 건물 표 38(BELT 14 · C1 13 · E1 6 · SOUTH 5) + 아파트 3 + 고가 상판 1 + 두 건물 2 = 44(Task 8 · 9 에서 타워 · 튜브 · 스카이브리지가 더해진다)
  assert.ok(Array.isArray(layout.solids) && layout.solids.length >= 44, `solids ${layout.solids?.length}`);
  const ids = new Set(layout.solids.map((b) => b.id));
  for (const id of ['B1', 'B6', 'B10', 'F2', 'E1a', 'MX', 'APT0', 'APT2', 'VIA_deck', 'HAUS', 'FACEARCH']) assert.ok(ids.has(id), `${id} 없음`);
  for (const b of layout.solids) for (let i = 0; i < 3; i++) assert.ok(b.min[i] < b.max[i], `${b.id} 축 ${i}`);
  const haus = layout.solids.find((b) => b.id === 'HAUS');
  assert.ok(Math.abs(haus.max[1] - 81) < 0.5, `HAUS 높이 ${haus.max[1]}`);
  assert.ok(layout.cameras.some((c) => c.id === 'future'), 'CAM_future 없음');
});

test('(b) 성수 인트로: 모든 solid 에서 2 m 이상 떨어져 난다', () => {
  const r = nearest(sampleCurve(SEONGSU_INTRO.points, 4000, true));
  assert.ok(r.d >= MIN_CLEAR, `가장 가까운 ${r.id} ${r.d.toFixed(2)} m @ ${r.at}`);
});

test('(c) 투어 비행 4 경로(거리 → 성수 · 몽골, 성수 ↔ 몽골)도 2 m 이상', () => {
  const street = layout.cameras.find((c) => c.id === 'street');
  const from = { pos: street.pos, target: street.target };
  const haus = approachFor(layout, 'haus');
  const fa = approachFor(layout, 'facearch');
  for (const [a, b, name] of [[from, haus, 'street→haus'], [from, fa, 'street→facearch'], [haus, fa, 'haus→facearch'], [fa, haus, 'facearch→haus']]) {
    const r = nearest(sampleCurve(buildFlightPath(a, b).points, 2000, false));
    assert.ok(r.d >= MIN_CLEAR, `${name}: ${r.id} ${r.d.toFixed(2)} m @ ${r.at}`);
  }
});
