import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../public/vendor/three/three.module.js';
import { SEONGSU_INTRO } from '../public/src/nowhere/intro-path.js';
import { buildFlightPath } from '../public/src/nowhere/flight.js';
import { approachFor } from '../public/src/nowhere/tour-config.js';
import { roadsterPose } from '../public/src/nowhere/movers.js';

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

test('(d) 이동체 경로: 드론은 solid 에서 3 m, 포드는 1.5 m, 배송로봇은 0.7 m 이상', () => {
  const R = { drone: 3.0, pod: 1.5, bot: 0.7 };
  for (const m of layout.movers || []) {
    if (!(m.kind in R)) continue;
    const r = nearest(m.path);
    assert.ok(r.d >= R[m.kind], `${m.id}: ${r.id} ${r.d.toFixed(2)} m @ ${r.at}`);
  }
  assert.ok((layout.movers || []).length > 0, 'movers 없음');
});

// 이동체 차체(three y 위): 포드 = future.py taxi_mesh 4.3 × 1.85 × 1.55 + 지붕 센서 돔 0.1, 배송로봇 = BOT 0.7 × 0.55 × 0.6 + 바닥 틈 0.1
const BODY = { pod: { half: 0.925, roof: 1.65 }, bot: { half: 0.275, roof: 0.7 } };
const CAM_CLEAR = 1.5;   // m — 지상 카메라와 차체 옆면 사이 수평 거리
function segDist2D(px, pz, a, b) {
  const dx = b[0] - a[0], dz = b[2] - a[2];
  const L2 = dx * dx + dz * dz;
  const t = L2 > 0 ? Math.min(1, Math.max(0, ((px - a[0]) * dx + (pz - a[2]) * dz) / L2)) : 0;
  return Math.hypot(px - (a[0] + t * dx), pz - (a[2] + t * dz));
}

test('(e) 지상 카메라: 포드 · 배송로봇 경로(차체 반폭 포함)에서 수평 1.5 m 이상(차체 지붕보다 1 m 넘게 높은 카메라는 제외)', () => {
  let checked = 0;
  for (const cam of layout.cameras) {
    const [cx, cy, cz] = cam.pos;
    for (const m of layout.movers || []) {
      const body = BODY[m.kind];
      if (!body) continue;
      const P = m.path;
      const nSeg = P.length - 1 + (m.mode === 'loop' ? 1 : 0);   // wrap 은 끝 → 처음이 순간 이동, pingpong 은 열린 선
      let best = { d: Infinity, at: null };
      for (let i = 0; i < nSeg; i++) {
        const a = P[i], b = P[(i + 1) % P.length];
        if (cy > Math.max(a[1], b[1]) + body.roof + 1.0) continue;   // 지붕 위로 1 m 넘게 높으면 차체가 렌즈를 스치지 않는다
        checked += 1;
        const d = segDist2D(cx, cz, a, b) - body.half;
        if (d < best.d) best = { d, at: a.map((v) => Number(v.toFixed(1))) };
      }
      assert.ok(best.d >= CAM_CLEAR, `카메라 ${cam.id} ↔ ${m.id}: 차체 옆면까지 ${best.d.toFixed(2)} m @ ${best.at}`);
    }
  }
  assert.ok(checked > 0, '검사한 구간이 없다');
});

// 날으는 로드스터 차체(future.py roadster_mb): 반폭 0.975(RD_SIDE 반폭 최대, future.py:2607–2611 · 바퀴 0.985), 원점(롤 축) → 바퀴 아래 0.55 · 지붕 0.6
const RD_BODY = { half: 0.975, below: 0.55, above: 0.6 };
const RD_CLEAR = { fly: 3.0, drive: 0.7 };
// 주행 규칙은 차체를 잰다: 차체 옆면 → 상자 0.7 m = 축 → 상자 반폭 + 0.7(1.675 m). 비행 규칙 3 m 는 그대로 축 거리
const RD_DRIVE_AXIS = RD_BODY.half + RD_CLEAR.drive;

test('(f) 날으는 로드스터: 0.1 s 표본이 비행 중 solid 에서 축 3 m · 주행 중 차체 옆면 0.7 m(축 1.675 m) 이상(정차 포드 포함), 노면 아래로 가지 않고, 지상 카메라와 수평 1.5 m 이상', () => {
  const rds = (layout.movers || []).filter((m) => m.kind === 'roadster');
  assert.equal(rds.length, 2, '로드스터 2 대');
  for (const id of ['FU_parked_pod.0', 'FU_parked_pod.1']) assert.ok(layout.solids.some((b) => b.id === id), `${id} solid 없음`);
  for (const m of rds) {
    const S = [];
    for (let i = 0; ; i++) {
      const t = m.visible[0] + i * 0.1;
      if (t > m.visible[1]) break;
      S.push(roadsterPose(m, m.phase + Math.min(t, m.visible[1] - 1e-6)));
    }
    const ground = Math.min(...m.keys.map((k) => k.pos[1]));   // 가장 낮은 키 = 노면 위 주행 높이(원점 = 롤 축)
    for (const p of S) {
      assert.ok(p.visible, `${m.id}: 보이는 구간 안 표본이 숨겨졌다`);
      const fly = p.pos[1] > ground + 0.3;
      const need = fly ? RD_CLEAR.fly : RD_DRIVE_AXIS;
      const r = nearest([p.pos]);
      assert.ok(r.d >= need, `${m.id} ${fly ? '비행' : '주행'}: ${r.id} 축 ${r.d.toFixed(2)} m < ${need.toFixed(3)} @ ${r.at}`);
      assert.ok(p.pos[1] >= ground - 0.05, `${m.id}: 노면 아래 ${(ground - p.pos[1]).toFixed(3)} m @ ${p.pos.map((v) => v.toFixed(1))}`);
    }
    for (const cam of layout.cameras) {
      const [cx, cy, cz] = cam.pos;
      for (let i = 0; i + 1 < S.length; i++) {
        const a = S[i].pos;
        const b = S[i + 1].pos;
        // 차체와 높이가 1 m 안으로 겹치는 구간만(포드 검사 (e) 와 같은 생각)
        if (cy < Math.min(a[1], b[1]) - RD_BODY.below - 1.0 || cy > Math.max(a[1], b[1]) + RD_BODY.above + 1.0) continue;
        const d = segDist2D(cx, cz, a, b) - RD_BODY.half;
        assert.ok(d >= CAM_CLEAR, `카메라 ${cam.id} ↔ ${m.id}: 차체 옆면까지 ${d.toFixed(2)} m @ ${a.map((v) => v.toFixed(1))}`);
      }
    }
  }
});

// ─── 날으는 로드스터 보강(최종 리뷰 I-1 · I-2): 2 ms 표본 ───
const RD_DT = 0.002;   // s — 이륙 순간의 꺾임(키 5 ms 간격 RD_KINK)과 피치로 바퀴가 박히는 구간을 놓치지 않는 표본 간격
function rdSamples(m) {
  const out = [];
  for (let i = 0; ; i++) {
    const t = m.visible[0] + i * RD_DT;
    if (t > m.visible[1]) break;
    out.push({ t, p: roadsterPose(m, m.phase + Math.min(t, m.visible[1] - 1e-6)) });
  }
  return out;
}
const fmt = (v, n = 2) => v.map((c) => c.toFixed(n)).join(', ');

// I-2. 차체 최저점. 차 로컬 = 로드스터 피벗(three: x 앞, y 위, z = −Blender y). 원점 = 롤 축 = 바퀴 아래 + RD_AXIS 0.55(future.py:2605,
// roadster_mb 가 MB.T 로 그만큼 내린다 2663 — 위 RD_BODY.below 와 같은 값). Blender 메시 (x, y, z) → 로컬 (x, z − 0.55, −y)
const RD_WHEEL = { r: 0.34, x: [1.42, -1.38], faces: [0.985 - 0.24, 0.985] };   // future.py:2617 — 반지름 · 앞뒤 축 x, 타이어 안 · 바깥 면 |y| = y − w · y
// 몸통 단면(x, 아래 z, 덮개 z, 반폭) = RD_SIDE(future.py:2607–2611). (g) 는 아래 점, (h) 의 차체 높이 범위는 덮개 쪽 점도 쓴다
const RD_SIDE = [[2.20, 0.30, 0.52, 0.70], [2.12, 0.22, 0.60, 0.86], [1.90, 0.18, 0.70, 0.94], [1.50, 0.16, 0.76, 0.97], [1.00, 0.16, 0.81, 0.975],
  [0.50, 0.16, 0.82, 0.975], [0.00, 0.16, 0.83, 0.975], [-0.60, 0.16, 0.85, 0.975], [-1.20, 0.16, 0.87, 0.975], [-1.70, 0.18, 0.91, 0.97],
  [-2.05, 0.22, 0.92, 0.95], [-2.20, 0.28, 0.90, 0.92]];
const RD_NOZZLES = [[-0.54, 0.30], [-0.18, 0.30], [0.18, 0.30], [0.54, 0.30]];   // future.py:2623 (y, z) — 끝 x −2.26 · 반지름 0.06(2714)
const RD_LOW = [];   // 몸통 아래 점(로컬)
for (const [x, zb, , w] of RD_SIDE) {
  // 단면 고리의 아래 점(_rd_ring, future.py:2645): 아래 가운데 (0, zb) · 아래 모서리 (±0.8w, zb) · 옆 아래 (±w, zb + 0.1)
  for (const [y, z] of [[0, zb], [0.8 * w, zb], [-0.8 * w, zb], [w, zb + 0.1], [-w, zb + 0.1]]) RD_LOW.push(new THREE.Vector3(x, z - RD_BODY.below, -y));
}
for (const [y, z] of RD_NOZZLES) RD_LOW.push(new THREE.Vector3(-2.26, z - 0.06 - RD_BODY.below, -y));
const RD_HUBS = [];   // 타이어 양쪽 면 원의 가운데(로컬)
for (const x of RD_WHEEL.x) for (const s of [1, -1]) for (const z of RD_WHEEL.faces) RD_HUBS.push(new THREE.Vector3(x, RD_WHEEL.r - RD_BODY.below, s * z));

const _car = new THREE.Object3D();
const _v = new THREE.Vector3();
const _axle = new THREE.Vector3();
/** 자세 p 로 _car 를 놓고, 타이어 면 원의 가운데 → 최저 · 최고점 높이 차(r·√(1 − 축 y²))를 돌려준다 */
function placeCar(p) {
  _car.position.set(p.pos[0], p.pos[1], p.pos[2]);
  _car.rotation.set(p.roll, p.yaw, p.pitch, 'YZX');   // world.js:778 로드스터 피벗과 같은 순서(yaw → pitch → roll)
  _car.updateMatrix();
  _axle.set(0, 0, 1).applyQuaternion(_car.quaternion);
  return RD_WHEEL.r * Math.sqrt(Math.max(0, 1 - _axle.y * _axle.y));
}
/** 자세 p 의 차체 최저점 높이(세계 y). 타이어는 원기둥이라 최저점이 양쪽 면 원 위에 있다 — 원의 최저점 = 가운데 y − r·√(1 − 축 y²)
 *  (실제 16 각형보다 최대 0.65 cm 낮게 잡는 보수 값, 수평일 때는 같다) */
function bodyLowest(p) {
  const drop = placeCar(p);
  let lo = Infinity;
  for (const L of RD_LOW) lo = Math.min(lo, _v.copy(L).applyMatrix4(_car.matrix).y);
  for (const C of RD_HUBS) lo = Math.min(lo, _v.copy(C).applyMatrix4(_car.matrix).y - drop);
  return lo;
}
/** 국소 노면 높이 road(x): 주행 키(원점이 가장 낮은 키 + 6 cm 안)의 바퀴 아래 높이(pos y − 0.55)를 x 로 선형 보간, 범위 밖은 끝 값.
 *  6 cm = 노면 높낮이(주행 키 0.387 … 0.430)는 들이고 B 이륙 덧 키(+9.6 cm)는 빼는 폭. A 의 뜨기 시작 직후 두 키(+0.7 · +3.2 cm)는
 *  들어가는데, 그 자리 노면을 높게 잡아 검사를 엄격하게 할 뿐이다. 공중 구간은 양 끝 주행 키 사이(차가 높이 있어 자연히 통과) */
function roadOf(m) {
  const ground = Math.min(...m.keys.map((k) => k.pos[1]));
  const D = m.keys.filter((k) => k.pos[1] <= ground + 0.06).map((k) => [k.pos[0], k.pos[1] - RD_BODY.below]).sort((a, b) => a[0] - b[0]);
  return (x) => {
    if (x <= D[0][0]) return D[0][1];
    for (let i = 1; i < D.length; i++) {
      if (x <= D[i][0]) return D[i - 1][1] + ((D[i][1] - D[i - 1][1]) * (x - D[i - 1][0])) / (D[i][0] - D[i - 1][0]);
    }
    return D[D.length - 1][1];
  };
}
/** 보이는 구간 2 ms 표본에서 (차체 최저점 − 국소 노면)이 가장 작은 곳 */
function worstSink(m) {
  const road = roadOf(m);
  let w = { d: Infinity };
  for (const { t, p } of rdSamples(m)) {
    const d = bodyLowest(p) - road(p.pos[0]);
    if (d < w.d) w = { d, t, pos: p.pos, pitch: p.pitch };
  }
  return w;
}
const RD_SINK = -0.02;   // m — 차체가 노면 아래로 이보다 깊이 내려가지 않는다
const sinkMsg = (id, w) => `${id}: 차체 최저점 − 노면 ${(w.d * 100).toFixed(2)} cm @ t ${w.t.toFixed(3)} (${fmt(w.pos)}), pitch ${w.pitch.toFixed(4)}`;

test('(g) 날으는 로드스터: 2 ms 표본에서 차체(바퀴 둘레 · 몸통 아래)가 국소 노면 아래로 2 cm 넘게 내려가지 않는다', () => {
  const rds = (layout.movers || []).filter((m) => m.kind === 'roadster');
  assert.equal(rds.length, 2, '로드스터 2 대');
  for (const m of rds) {
    const w = worstSink(m);
    assert.ok(w.d >= RD_SINK, sinkMsg(m.id, w));
  }
});

test('(g′) 결함 재현 데이터는 (g) 에서 실패한다: A 이륙 전 코 들림(Task 6) · B 이륙 덧 키 없음(RD_KINK 전)', () => {
  const A = layout.movers.find((m) => m.id === 'roadster_a');
  const B = layout.movers.find((m) => m.id === 'roadster_b');
  // Task 6 결함: 분사 1 키의 pitch 0(future.py:2949)이 없어 피치가 첫 키 0 → 롤 시작 0.08(2951)로 9 s 동안 완만히 든다 → 뒷바퀴가 박힌다
  const thr = A.keys.find((k) => k.thrust === 1);
  assert.equal(thr.pitch, 0, 'A 분사 1 키에 pitch 0 이 있다(Task 7 수정)');
  const a6 = { ...A, keys: A.keys.map((k) => (k === thr ? Object.fromEntries(Object.entries(k).filter(([n]) => n !== 'pitch')) : k)) };
  // RD_KINK(future.py:2881, 2996) 전: B 이륙 · 착지 5 ms 뒤 덧 위치 키가 없으면 Catmull-Rom 접선이 이륙 꺾임을 주행 구간으로 끌어와 처진다
  const kinks = B.keys.filter((k, i) => i > 0 && Math.abs(k.t - B.keys[i - 1].t - 0.005) < 1e-6 && Object.keys(k).length === 2);
  assert.equal(kinks.length, 2, `B 덧 키 2 개(이륙 · 착지 뒤) — ${kinks.map((k) => k.t)}`);
  const b4 = { ...B, keys: B.keys.filter((k) => !kinks.includes(k)) };
  for (const [id, m] of [['A 코 들림 재현', a6], ['B 덧 키 없음 재현', b4]]) {
    const w = worstSink(m);
    assert.ok(w.d < RD_SINK, `${sinkMsg(id, w)} — 결함 재현 데이터가 (g) 를 통과했다`);
  }
});

// I-1. layout.solids 밖 거리 시설 상자(three 좌표: x, y 위, z = −Blender y). 옛 A 경로가 x −35 가로등 머리에서 축 0.88 m 로 지났는데 (f) 는 통과했다.
// 북측 보도 가로등 기둥 z = −(TT[1] + 0.55) = 34.95(present.py:3329, 북 경계석 TT[1] −35.5 = future.py:67). 기둥은 rz −π/2 로 놓여
// (present.py:3330) 등 로컬 +x(팔 · 머리 방향)가 three +z(차도 쪽), 로컬 y 가 three x 다.
// 높이 = 등 로컬 z + 보도 높이 gz.z(x, −34.95)(present.py:3330). 보도 높이는 present GLB PR_streetlight 인스턴스 이동값에서 −0.039 … −0.034
// (x −65: −0.036)라, 상자 아래에 −0.04 · 위에 −0.03 을 더해 아홉 자리를 모두 감싼다(리뷰어 값 8.94 · 8.9 는 보도 높이를 빼고 잰 로컬 값).
const LAMP_Z = 34.95;
const GZ_N = [-0.04, -0.03];
const STREET_LIGHTS_N = [-95, -65, -35, -5, 32, 62, 92, 122, 152];   // present.py:112
const SHELTER_Z0 = -0.027;   // 정류장 바닥 gz.z — future GLB FU_busstop 상자 아래 끝
const KIOSK_Z0 = -0.032;     // 키오스크 바닥 gz.z — future GLB FU_kiosk 상자 아래 끝 + 0.05
const FURNITURE = [
  // 코브라헤드: 로컬 x 2.1 … 2.85 · y ±0.17 · z 8.94(렌즈 아래) … 9.22(present.py:2806–2807)
  ...STREET_LIGHTS_N.map((x) => ({ id: `가로등 머리 x ${x}`, min: [x - 0.17, 8.94 + GZ_N[0], LAMP_Z + 2.1], max: [x + 0.17, 9.22 + GZ_N[1], LAMP_Z + 2.85] })),
  // x −65 스마트 헤드(SMART_POLES 의 PR_light.001, future.py:71): 껍데기 · LED 면 로컬 x 1.92 … 3.02 · y ±0.25 · z 8.9 … 9.3(future.py:1566–1568)
  { id: '스마트 헤드 x -65', min: [-65.25, 8.9 + GZ_N[0], LAMP_Z + 1.92], max: [-64.75, 9.3 + GZ_N[1], LAMP_Z + 3.02] },
  // 정류장 쉘터: SHELTER x −46 · y0 −33.35 · y1 −34.85(future.py:69), 폭 3.2 · 높이 2.65(897), 지붕 판 x ±0.2 · 앞 yf − 0.1 · 뒤 yb + 0.15(903),
  // 처마 글자 앞 끝 yf − 0.105 − 0.016(돌출 0.008 양쪽) · 위 끝 H + 0.06 + 0.075(글자 높이 0.15, 920–923)
  { id: '정류장 쉘터', min: [-46 - 1.6 - 0.2, SHELTER_Z0, 33.35 - 0.15], max: [-46 + 1.6 + 0.2, SHELTER_Z0 + 2.65 + 0.06 + 0.075, 34.85 + 0.105 + 0.016] },
  // 키오스크: KIOSK (−41.6, −34.55)(future.py:70), 발판 x ±0.12 · y ±0.55 · 아래 kz − 0.05(934), 위 kz + 2.26(933)
  { id: '키오스크', min: [-41.6 - 0.12, KIOSK_Z0 - 0.05, 34.55 - 0.55], max: [-41.6 + 0.12, KIOSK_Z0 + 2.26, 34.55 + 0.55] },
];

// 차체 위 점(로컬) — (h) 의 차체 높이 범위용. (g) 의 아래 점 · 바퀴와 함께 쓴다
//   단면 고리 윗점(_rd_ring, future.py:2645–2646): (±w, zt − 0.07) · (±0.94w, zt − 0.015) · (±0.5w, zt) · (0, zt + 0.01)
//   캐노피 위(RD_CANOPY future.py:2612–2614, _rd_canopy_ring 2650–2656): 덮개 _rd_deck(x)(2632, zt 를 x 로 선형 보간) + 0.005 + 높이 hc,
//   위 반폭 ±wt, 가운데는 hc > 0 이면 + 0.01
//   리어 윙 판 위(RD_WING future.py:2619 · 판 2703): x −2.18 · −1.80, y ±0.92, z 1.14
const RD_CANOPY = [[0.95, 0.00, 0.74], [0.55, 0.16, 0.66], [0.15, 0.27, 0.58], [-0.25, 0.29, 0.56], [-0.65, 0.26, 0.56], [-1.05, 0.16, 0.60], [-1.45, 0.00, 0.74]];
function rdDeck(x) {
  if (x >= RD_SIDE[0][0]) return RD_SIDE[0][2];
  for (let i = 0; i + 1 < RD_SIDE.length; i++) {
    const [xa, , za] = RD_SIDE[i];
    const [xb, , zb] = RD_SIDE[i + 1];
    if (xb <= x && x <= xa) return za + ((zb - za) * (xa - x)) / (xa - xb);
  }
  return RD_SIDE[RD_SIDE.length - 1][2];
}
const RD_TOP = [];
for (const [x, , zt, w] of RD_SIDE) {
  for (const [y, z] of [[w, zt - 0.07], [-w, zt - 0.07], [0.94 * w, zt - 0.015], [-0.94 * w, zt - 0.015], [0.5 * w, zt], [-0.5 * w, zt], [0, zt + 0.01]]) {
    RD_TOP.push(new THREE.Vector3(x, z - RD_BODY.below, -y));
  }
}
for (const [x, hc, wt] of RD_CANOPY) {
  const zt = rdDeck(x) + 0.005 + hc;
  for (const [y, z] of [[wt, zt], [-wt, zt], [0, zt + (hc > 0 ? 0.01 : 0)]]) RD_TOP.push(new THREE.Vector3(x, z - RD_BODY.below, -y));
}
for (const x of [-2.18, -1.80]) for (const y of [0.92, -0.92]) RD_TOP.push(new THREE.Vector3(x, 1.14 - RD_BODY.below, -y));
/** 자세 p 의 차체 높이 범위 [아래, 위](세계 y): 아래 점 · 위 점 · 바퀴 면 원(가운데 ∓ r·√(1 − 축 y²)) — 롤 · 피치로 뒤집혀도 맞다 */
function bodyExtent(p) {
  const k = placeCar(p);
  let lo = Infinity;
  let hi = -Infinity;
  for (const L of RD_LOW.concat(RD_TOP)) {
    const y = _v.copy(L).applyMatrix4(_car.matrix).y;
    lo = Math.min(lo, y);
    hi = Math.max(hi, y);
  }
  for (const C of RD_HUBS) {
    const y = _v.copy(C).applyMatrix4(_car.matrix).y;
    lo = Math.min(lo, y - k);
    hi = Math.max(hi, y + k);
  }
  return [lo, hi];
}

// 거리 시설 규칙. 비행 여유 3 m 는 공중에서 시설 위 · 아래 · 옆으로 스치는 일을 막는 값이다. 땅에 선 시설(쉘터 · 키오스크)과 같은
// 높이에서 나란히 지나가는 것(정류장 옆을 지나는 여느 차처럼)만 보통 차량 간격으로 본다. 공중에 매달린 시설(가로등 머리 · 스마트 헤드)은
// 차가 공중이면 늘 3 m 다 — 그 높이에서 옆으로 스치는 것도 공중 근접이다.
//   땅에 선 시설 = 상자 아래 ≤ 국소 노면 + 0.3(상자 가운데 x 에서)
//   옆: 땅에 선 시설이고 차체 높이 범위(bodyExtent)가 상자 높이 범위와 겹친다 → 주행 규칙(차체 옆면 0.7 m = 축 RD_DRIVE_AXIS)
//   비행: 그 밖에서 공중(원점이 국소 주행 높이 road(x) + 0.55 보다 0.3 m 넘게 높다 — (f) 의 "가장 낮은 키 + 0.3" 을 국소 노면으로) → 축 3 m
//   주행: 그 밖(노면 위) → 차체 옆면 0.7 m
const RD_AIR = 0.3;   // m — 원점이 국소 주행 높이보다 이만큼 넘게 높으면 공중 · 상자 아래가 노면 + 이 안이면 땅에 선 시설((f) 와 같은 값)
/** 자세 p · 국소 노면 road · 시설 상자 b → { branch, d(축 → 상자), need } */
function furnitureRule(p, road, b) {
  const d = boxDist(p.pos, b);
  const air = p.pos[1] > road(p.pos[0]) + RD_BODY.below + RD_AIR;
  let branch = air ? '비행' : '주행';
  if (b.min[1] <= road((b.min[0] + b.max[0]) / 2) + RD_AIR) {
    const [lo, hi] = bodyExtent(p);
    if (lo <= b.max[1] && hi >= b.min[1]) branch = '옆';
  }
  return { branch, d, need: branch === '비행' ? RD_CLEAR.fly : RD_DRIVE_AXIS };
}

test('(h) 날으는 로드스터: 2 ms 표본이 solids 밖 거리 시설(북측 가로등 머리 · x −65 스마트 헤드 · 정류장 쉘터 · 키오스크)에서 공중이면 축 3 m(땅에 선 시설과 같은 높이로 나란할 때만 차체 0.7 m) · 노면 위면 차체 0.7 m', () => {
  const rds = (layout.movers || []).filter((m) => m.kind === 'roadster');
  assert.equal(rds.length, 2, '로드스터 2 대');
  const bad = [];
  for (const m of rds) {
    const road = roadOf(m);
    const best = new Map();   // 시설 · 갈래마다 가장 가까운 표본
    for (const { t, p } of rdSamples(m)) {
      for (const b of FURNITURE) {
        const r = furnitureRule(p, road, b);
        const key = `${b.id} ${r.branch}`;
        if (!best.has(key) || r.d < best.get(key).d) best.set(key, { ...r, t, pos: p.pos });
      }
    }
    for (const [key, r] of best) {
      if (r.d < r.need) bad.push(`${m.id} ↔ ${key}: 축 ${r.d.toFixed(3)} m < ${r.need.toFixed(3)} @ t ${r.t.toFixed(3)} (${fmt(r.pos)})`);
    }
  }
  assert.deepEqual(bad, [], `거리 시설 여유 부족:\n${bad.join('\n')}`);
});

test('(h′) 근접 재현 표본은 (h) 규칙에서 실패한다: 쉘터 쪽으로 붙인 차로(z 35.85) · 가로등 머리 높이에서 1.23 m 비행', () => {
  const A = layout.movers.find((m) => m.id === 'roadster_a');
  const road = roadOf(A);
  // A 가 쉘터 가운데(x −46)를 지나는 표본의 차로만 z 37.125 → 35.85 로 옮긴다(축 → 쉘터 앞 끝 0.88 m: 축 0.7 m 로 재면 통과하던 거리)
  const shelter = FURNITURE.find((b) => b.id === '정류장 쉘터');
  const near = rdSamples(A).find(({ p }) => p.pos[0] <= (shelter.min[0] + shelter.max[0]) / 2).p;
  const r1 = furnitureRule({ ...near, pos: [near.pos[0], near.pos[1], 35.85] }, road, shelter);
  assert.equal(r1.branch, '옆', `쉘터 옆 표본이 '${r1.branch}' 로 분류됐다`);
  assert.ok(r1.d < r1.need, `쉘터 쪽 차로 재현: 축 ${r1.d.toFixed(3)} m 가 ${r1.need.toFixed(3)} 을 통과했다`);
  // 가로등 머리 x −35 와 같은 높이 · 같은 z 에서 서쪽으로 1.23 m 떨어진 공중 자세(차체가 머리 높이와 겹쳐도 매달린 시설이라 비행 규칙)
  const head = FURNITURE.find((b) => b.id === '가로등 머리 x -35');
  const pose = { visible: true, pos: [head.min[0] - 1.23, (head.min[1] + head.max[1]) / 2, (head.min[2] + head.max[2]) / 2], yaw: Math.PI, pitch: 0, roll: 0, thrust: 0 };
  const r2 = furnitureRule(pose, road, head);
  assert.equal(r2.branch, '비행', `가로등 머리 옆 공중 자세가 '${r2.branch}' 로 분류됐다`);
  assert.ok(Math.abs(r2.d - 1.23) < 1e-9 && r2.d < r2.need, `가로등 머리 근접 재현: 축 ${r2.d.toFixed(3)} m 가 ${r2.need} 을 통과했다`);
});
