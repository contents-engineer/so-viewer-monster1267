import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildTrack, sampleTrack, moverDistance, headingYaw, moverPose, spinAngle, MOVER_KINDS,
  roadsterPose, roadsterLocalTime, plumeMorph, PLUME_MIN,
} from '../public/src/nowhere/movers.js';

const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

/** 점 p 에서 선분 ab 까지 거리. */
function segDist(p, a, b) {
  const ab = [0, 1, 2].map((k) => b[k] - a[k]);
  const L2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
  const t = L2 > 0 ? Math.min(1, Math.max(0, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / L2)) : 0;
  return Math.hypot(...[0, 1, 2].map((k) => p[k] - (a[k] + ab[k] * t)));
}

function glbNodeNames(rel) {
  const buf = readFileSync(new URL(rel, import.meta.url));
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  return new Set((json.nodes || []).map((n) => n.name));
}

test('(a) 꺾은선 길이 · 보간 · 닫힌 고리 · 범위 밖은 끝에 붙는다', () => {
  const sq = [[0, 0, 0], [10, 0, 0], [10, 0, 10], [0, 0, 10]];
  const open = buildTrack(sq, false);
  const loop = buildTrack(sq, true);
  assert.equal(open.length, 30);
  assert.equal(loop.length, 40);
  assert.deepEqual(sampleTrack(loop, 15).pos, [10, 0, 5]);
  assert.deepEqual(sampleTrack(loop, 35).pos, [0, 0, 5]);
  assert.deepEqual(sampleTrack(loop, 35).dir, [0, 0, -1]);
  assert.deepEqual(sampleTrack(open, -5).pos, [0, 0, 0]);
  assert.deepEqual(sampleTrack(open, 99).pos, [0, 0, 10]);
});

test('(b) loop · wrap 은 한 방향, pingpong 은 끝에서 되돌아온다(위상 반영)', () => {
  assert.deepEqual(moverDistance({ mode: 'loop', speed: 10 }, 40, 5), { s: 10, sign: 1 });
  assert.deepEqual(moverDistance({ mode: 'wrap', speed: 10 }, 40, 5), { s: 10, sign: 1 });
  assert.deepEqual(moverDistance({ mode: 'wrap', speed: 10, phase: 0.5 }, 40, 3), { s: 10, sign: 1 });
  assert.deepEqual(moverDistance({ mode: 'pingpong', speed: 10 }, 40, 3), { s: 30, sign: 1 });
  assert.deepEqual(moverDistance({ mode: 'pingpong', speed: 10 }, 40, 5), { s: 30, sign: -1 });
  assert.deepEqual(moverDistance({ mode: 'pingpong', speed: 10 }, 40, 8), { s: 0, sign: 1 });
});

test('(c) 방향 → rotation.y: 앞 = 로컬 +X, 드론(앞 = +Z)은 yawOffset π/2', () => {
  for (const dir of [[1, 0, 0], [0, 0, 1], [-1, 0, 0], [0.6, 0, -0.8]]) {
    const th = headingYaw(dir);                   // rotation.y = θ 는 로컬 +X 를 (cos θ, 0, −sin θ) 로
    assert.ok(near(Math.cos(th), dir[0], 1e-12) && near(-Math.sin(th), dir[2], 1e-12), `+X ${dir}`);
    const tz = headingYaw(dir, Math.PI / 2);      // 로컬 +Z 는 (sin θ, 0, cos θ) 로
    assert.ok(near(Math.sin(tz), dir[0], 1e-12) && near(Math.cos(tz), dir[2], 1e-12), `+Z ${dir}`);
  }
});

test('(d) 왕복: flipYaw 면 돌아서고 아니면 같은 쪽을 본 채 뒤로 간다 · 드론은 흔들린다 · 회전자 각도', () => {
  const tr = buildTrack([[0, 0, 0], [40, 0, 0]], false);
  assert.ok(near(Math.cos(moverPose({ mode: 'pingpong', speed: 10, flipYaw: true }, tr, 5).yaw), -1, 1e-12));
  assert.ok(near(Math.cos(moverPose({ mode: 'pingpong', speed: 10 }, tr, 5).yaw), 1, 1e-12));
  const loop = buildTrack([[0, 10, 0], [10, 10, 0], [10, 10, 10]], true);
  const ys = [0, 0.3, 0.6, 0.9].map((t) => moverPose({ mode: 'loop', speed: 0, bob: 0.28 }, loop, t).pos[1]);
  assert.ok(Math.max(...ys) - Math.min(...ys) > 0.2 && Math.max(...ys) <= 10.28 + 1e-9);
  assert.ok(near(spinAngle({ rpm: 30 }, 2), 2 * Math.PI));
});

test('(e) layout.movers: 종류 · 모드 · 경로 · 속도, 오브젝트가 future GLB(데스크톱 · 모바일)에 있다, drones 키는 없다', () => {
  const layout = JSON.parse(readFileSync(new URL('../public/assets/nowhere/layout.json', import.meta.url), 'utf8'));
  assert.equal(layout.drones, undefined);
  const names = [glbNodeNames('../public/assets/nowhere/nowhere-future.glb'), glbNodeNames('../public/assets/nowhere/mobile/nowhere-future.glb')];
  const kinds = {};
  for (const m of layout.movers) {
    assert.ok(MOVER_KINDS.includes(m.kind), m.id);
    for (const set of names) assert.ok(set.has(m.object), `${m.id}: ${m.object} 없음`);
    // 피벗(Blender 원점 · 방위): optimize 가 노드 원점을 메시 상자 가운데로 옮겨서 웹이 이 자리에 피벗을 둔다(빠지면 포드가 노면에 묻히고
    // 회전자가 허브 밖을 축으로 돈다). 회전자도 허브 자리가 필요하다
    assert.ok(Array.isArray(m.origin) && m.origin.length === 3 && m.origin.every(Number.isFinite), `${m.id}: origin ${m.origin}`);
    assert.ok(Number.isFinite(m.yaw0), `${m.id}: yaw0 ${m.yaw0}`);
    kinds[m.kind] = (kinds[m.kind] || 0) + 1;
    if (m.kind === 'roadster') {
      // 날으는 로드스터: 경로 대신 시간표 키. 피벗 = 첫 키 자리(Blender 에서 첫 키에 세웠다), 분사 노드도 GLB 에 있다
      for (const set of names) assert.ok(set.has(m.plume), `${m.id}: ${m.plume} 없음`);
      const d = Math.hypot(...m.origin.map((v, c) => v - m.keys[0].pos[c]));
      assert.ok(d <= 0.5, `${m.id}: origin 이 첫 키에서 ${d.toFixed(2)} m`);
      continue;
    }
    if (m.kind !== 'spin') {
      const segs = m.mode === 'loop' ? m.path.length : m.path.length - 1;   // loop 은 마지막 → 처음 구간까지
      const d = Math.min(...m.path.slice(0, segs).map((p, i) => segDist(m.origin, p, m.path[(i + 1) % m.path.length])));
      assert.ok(d <= 0.5, `${m.id}: origin 이 경로에서 ${d.toFixed(2)} m`);   // Blender 에서 경로 위에 세웠다(갱신 전 matrix_world = 원점 0 같은 실수 방지)
    }
    if (m.kind === 'spin') {
      assert.ok(m.rpm > 0, m.id);
      continue;
    }
    assert.ok(['loop', 'wrap', 'pingpong'].includes(m.mode), m.id);
    assert.ok(m.speed > 0 && Array.isArray(m.path) && m.path.length >= 2, m.id);
  }
  assert.deepEqual(kinds, { drone: 6, pod: 5, train: 2, bot: 3, spin: 5, roadster: 2 });
});

// ───────────── 날으는 로드스터(roadsterPose) — 시험 정의(three 좌표)
// 0 → 4 s 등속 서진(22 m/s), 4 → 4.5 s 분사 켜짐, 4.5 → 5.7 s 롤 0 → 2π, 10 s 끝. 위치는 모든 키, 채널은 그 값을 정하는 키에만(첫 · 끝 키는 모두)
const RD = {
  id: 'rd_test', kind: 'roadster', object: 'FU_roadster_t', plume: 'FU_roadster_t_plume', period: 40, phase: 20, visible: [0, 10],
  keys: [
    { t: 0, pos: [100, 0.5, 37], yaw: Math.PI, roll: 0, pitch: 0, thrust: 0 },
    { t: 2, pos: [56, 0.5, 37] },
    { t: 4, pos: [12, 0.5, 37], thrust: 0 },
    { t: 4.5, pos: [1, 1.5, 37], thrust: 1, roll: 0 },
    { t: 5.7, pos: [-26, 6, 37], roll: 2 * Math.PI, thrust: 1, pitch: 0.2 },
    { t: 10, pos: [-120, 40, 0], yaw: 2.6, roll: 2 * Math.PI, pitch: 0.2, thrust: 0 },
  ],
};
const CH = ['yaw', 'roll', 'pitch', 'thrust'];
function poseNear(p, q, e = 1e-9) {
  assert.equal(p.visible, q.visible);
  if (!p.visible) return;
  p.pos.forEach((v, c) => assert.ok(near(v, q.pos[c], e), `pos ${c}: ${v} ≠ ${q.pos[c]}`));
  for (const ch of CH) assert.ok(near(p[ch], q[ch], e), `${ch}: ${p[ch]} ≠ ${q[ch]}`);
}

test('(f) roadsterPose: 보이는 구간 밖은 숨김, 안은 보임(위상 20 s · 주기 40 s 반영)', () => {
  for (const time of [19.9, 30.01, 45, 59.99]) {
    const p = roadsterPose(RD, time);
    assert.equal(p.visible, false, `time ${time}`);
    assert.deepEqual(p, { visible: false, pos: null, yaw: 0, pitch: 0, roll: 0, thrust: 0 });
  }
  for (const time of [20, 23, 30, 60, 63]) assert.equal(roadsterPose(RD, time).visible, true, `time ${time}`);
  assert.equal(roadsterLocalTime(RD, 63), 3);
  assert.ok(near(roadsterLocalTime(RD, 19), 39, 1e-12));
});

test('(g) roadsterPose: 키 시각에서 위치 · 채널이 키 값과 같고, 등속 직선 구간은 그대로 직선이다', () => {
  for (const k of RD.keys) {
    const p = roadsterPose(RD, 20 + k.t);
    p.pos.forEach((v, c) => assert.ok(near(v, k.pos[c], 1e-9), `t ${k.t} pos ${c}: ${v}`));
    for (const ch of CH) if (k[ch] !== undefined) assert.ok(near(p[ch], k[ch], 1e-12), `t ${k.t} ${ch}: ${p[ch]}`);
  }
  for (const t of [0.5, 1, 1.5]) {
    const p = roadsterPose(RD, 20 + t);
    assert.ok(near(p.pos[0], 100 - 22 * t, 1e-9) && near(p.pos[1], 0.5, 1e-12) && near(p.pos[2], 37, 1e-12), `t ${t}: ${p.pos}`);
  }
  for (const t of [2.7, 3.3]) {
    const p = roadsterPose(RD, 20 + t);   // 이웃 키 차분 접선이 모두 −22 m/s → x 는 정확히 직선
    assert.ok(near(p.pos[0], 100 - 22 * t, 1e-9) && near(p.pos[2], 37, 1e-12), `t ${t}: ${p.pos}`);
  }
});

test('(h) roadsterPose: 롤은 누적 각도 — 롤 키 사이에서 0 → 2π 로 부드럽게(가운데 π) 늘고, 끝나면 정확히 2π 에 머문다', () => {
  const roll = (t) => roadsterPose(RD, 20 + t).roll;
  assert.equal(roll(4.5), 0);
  assert.ok(near(roll(5.1), Math.PI, 1e-12), `가운데 ${roll(5.1)}`);
  let prev = -1;
  for (let i = 0; i <= 24; i++) {
    const r = roll(4.5 + i * 0.05);
    assert.ok(r >= prev - 1e-12, `롤이 줄어든다 @ ${4.5 + i * 0.05}`);
    prev = r;
  }
  for (const t of [5.7, 8, 10]) assert.ok(near(roll(t), 2 * Math.PI, 1e-12), `t ${t}: ${roll(t)}`);
  assert.ok(roll(4.55) - roll(4.5) < roll(5.15) - roll(5.1), 'smoothstep: 시작은 느리고 가운데가 빠르다');
});

test('(i) roadsterPose: 분사는 분사 키 사이에서만 — 켜기 전 0, 켜지는 가운데 0.5, 켠 동안 1, 끝에서 0', () => {
  const th = (t) => roadsterPose(RD, 20 + t).thrust;
  assert.equal(th(3), 0);
  assert.ok(near(th(4.25), 0.5, 1e-12));
  assert.equal(th(5), 1);
  assert.ok(near(th(7.85), 0.5, 1e-9));
  assert.equal(th(10), 0);
  assert.ok(th(3) <= PLUME_MIN && th(5) > PLUME_MIN);
});

test('(j) 주기 · 위상: 40 s 마다 같은 자세, 위상 0 · 20 s 두 차는 20 s 어긋난다 · plumeMorph(뒤 = thrust, 바닥 = 0.5 넘는 부분)', () => {
  const A = { ...RD, phase: 0 };
  for (const t of [1, 4.7, 5.1, 9.5]) {
    poseNear(roadsterPose(A, t), roadsterPose(A, t + 40));
    poseNear(roadsterPose(RD, t + 20), roadsterPose(A, t));
  }
  assert.equal(roadsterPose(RD, 4.7).visible, false, '위상 20 s 차는 τ 24.7 → 숨김');
  assert.deepEqual(plumeMorph(0), { rear: 0, bottom: 0 });
  assert.deepEqual(plumeMorph(0.5), { rear: 0.5, bottom: 0 });
  assert.deepEqual(plumeMorph(0.75), { rear: 0.75, bottom: 0.5 });
  assert.deepEqual(plumeMorph(1), { rear: 1, bottom: 1 });
  assert.deepEqual(plumeMorph(1.3), { rear: 1, bottom: 1 });
  assert.deepEqual(plumeMorph(-0.2), { rear: 0, bottom: 0 });
});

test('(k) layout.movers 로드스터: A(위상 0) · B(위상 20 s), 주기 40, 키가 시각 순 · 첫 끝 키에 모든 채널, 롤 0 → 2π, 분사, 두 대가 함께 보이지 않는다', () => {
  const layout = JSON.parse(readFileSync(new URL('../public/assets/nowhere/layout.json', import.meta.url), 'utf8'));
  const rds = layout.movers.filter((m) => m.kind === 'roadster');
  assert.deepEqual(rds.map((m) => [m.id, m.object, m.plume, m.period, m.phase]), [
    ['roadster_a', 'FU_roadster_a', 'FU_roadster_a_plume', 40, 0],
    ['roadster_b', 'FU_roadster_b', 'FU_roadster_b_plume', 40, 20],
  ]);
  for (const m of rds) {
    const K = m.keys;
    assert.ok(K.length >= 20, `${m.id}: 키 ${K.length}`);
    for (let i = 1; i < K.length; i++) assert.ok(K[i].t > K[i - 1].t, `${m.id}: 키 ${i} 시각 순서`);
    for (const k of K) assert.ok(Array.isArray(k.pos) && k.pos.length === 3 && k.pos.every(Number.isFinite), `${m.id}: 키 ${k.t} pos`);
    for (const ch of CH) assert.ok(Number.isFinite(K[0][ch]) && Number.isFinite(K.at(-1)[ch]), `${m.id}: 첫 · 끝 키에 ${ch} 없음`);
    assert.deepEqual(m.visible, [K[0].t, K.at(-1).t]);
    assert.ok(m.visible[1] - m.visible[0] < 20, `${m.id}: 보이는 구간 ${m.visible}`);
    const rolls = K.filter((k) => k.roll !== undefined).map((k) => k.roll);
    assert.ok(near(rolls[0], 0, 1e-9) && near(rolls.at(-1), 2 * Math.PI, 1e-5), `${m.id}: 롤 ${rolls[0]} → ${rolls.at(-1)}`);
    for (let i = 1; i < rolls.length; i++) assert.ok(rolls[i] >= rolls[i - 1] - 1e-9, `${m.id}: 롤이 줄어든다`);
    const th = K.filter((k) => k.thrust !== undefined).map((k) => k.thrust);
    assert.ok(th.every((v) => v >= 0 && v <= 1) && Math.max(...th) > 0.9, `${m.id}: 분사 ${th}`);
    assert.ok(near(m.yaw0, Math.PI, 1e-5), `${m.id}: yaw0 ${m.yaw0}(서쪽)`);
  }
  for (let i = 0; i < 320; i++) {
    const t = i * 0.25;   // 80 s(두 주기)
    assert.ok(rds.filter((m) => roadsterPose(m, t).visible).length <= 1, `t ${t}: 두 대가 함께 보인다`);
  }
});
