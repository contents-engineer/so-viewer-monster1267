import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../public/vendor/three/three.module.js';
import { SEONGSU_INTRO } from '../public/src/nowhere/intro-path.js';

const layout = JSON.parse(readFileSync(new URL('../public/assets/nowhere/layout.json', import.meta.url), 'utf8'));
// 전주 위치의 원본: Blender 빌드 스크립트의 RUNS(선로별 전주 (x, y)) — Three 좌표는 (x, −y)
const src = readFileSync(new URL('../tools/nowhere/blender/present.py', import.meta.url), 'utf8');
const runsText = src.slice(src.indexOf('RUNS = {'), src.indexOf('}', src.indexOf('RUNS = {')));
const runs = [...runsText.matchAll(/'(\w)':\s*\[([^\]]+)\]/g)].map(([, , body]) =>
  [...body.matchAll(/\(\s*(-?[\d.]+),\s*(-?[\d.]+)\s*\)/g)].map(([, x, y]) => [Number(x), -Number(y)]),
);
const poles = runs.flat();
const spans = runs.flatMap((pts) => pts.slice(1).map((q, i) => [pts[i], q]));

// camera.js 인트로와 같은 표본: 12 초를 smoothstep 으로 늦추고, 위치 곡선의 호 길이 비율 → 매개변수
const pos = new THREE.CatmullRomCurve3(SEONGSU_INTRO.points.map((p) => new THREE.Vector3(...p)));
const samples = [];
for (let i = 0; i <= 4000; i++) {
  const t = i / 4000;
  samples.push(pos.getPointAt(t * t * (3 - 2 * t)));
}

test('(a) 위치 · 시선 점 개수가 같고, 끝은 성수 거리 시점(layout street)과 같다', () => {
  assert.equal(SEONGSU_INTRO.points.length, SEONGSU_INTRO.targets.length);
  const street = layout.cameras.find((c) => c.id === 'street');
  assert.deepEqual(SEONGSU_INTRO.points.at(-1), street.pos);
  assert.deepEqual(SEONGSU_INTRO.targets.at(-1), street.target);
  assert.ok(poles.length >= 30, `전주 ${poles.length}개`);
});

test('(b) 전주 꼭대기(12 m)보다 낮게 지나는 곳에서는 어느 전주와도 수평 4 m 이상 떨어진다', () => {
  let min = Infinity;
  for (const v of samples) {
    if (v.y > 14) continue;
    for (const [x, z] of poles) min = Math.min(min, Math.hypot(v.x - x, v.z - z));
  }
  assert.ok(min >= 4, `가장 가까운 전주 ${min.toFixed(2)} m`);
});

test('(c) 전선(전주 사이, 높이 5.3~11.6 m)은 그 아래(4.6 m 미만)나 위(13 m 초과)로만 건넌다', () => {
  const cross = (a, b, c, d) => {
    const r = [b[0] - a[0], b[1] - a[1]];
    const s = [d[0] - c[0], d[1] - c[1]];
    const den = r[0] * s[1] - r[1] * s[0];
    if (Math.abs(den) < 1e-9) return null;
    const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den;
    const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
  };
  let n = 0;
  for (let i = 1; i < samples.length; i++) {
    const A = samples[i - 1];
    const B = samples[i];
    for (const [p, q] of spans) {
      const t = cross([A.x, A.z], [B.x, B.z], p, q);
      if (t == null) continue;
      n++;
      const y = A.y + (B.y - A.y) * t;
      assert.ok(y < 4.6 || y > 13, `전선 ${JSON.stringify([p, q])} 를 높이 ${y.toFixed(1)} m 에서 건넘`);
    }
  }
  assert.ok(n > 0, '전선을 한 번도 건너지 않으면 검사가 빈 것');
});
