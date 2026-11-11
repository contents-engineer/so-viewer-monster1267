import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTrack, sampleTrack, moverDistance, headingYaw, moverPose, spinAngle, MOVER_KINDS } from '../public/src/nowhere/movers.js';

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
    if (m.kind !== 'spin') {
      const segs = m.mode === 'loop' ? m.path.length : m.path.length - 1;   // loop 은 마지막 → 처음 구간까지
      const d = Math.min(...m.path.slice(0, segs).map((p, i) => segDist(m.origin, p, m.path[(i + 1) % m.path.length])));
      assert.ok(d <= 0.5, `${m.id}: origin 이 경로에서 ${d.toFixed(2)} m`);   // Blender 에서 경로 위에 세웠다(갱신 전 matrix_world = 원점 0 같은 실수 방지)
    }
    kinds[m.kind] = (kinds[m.kind] || 0) + 1;
    if (m.kind === 'spin') {
      assert.ok(m.rpm > 0, m.id);
      continue;
    }
    assert.ok(['loop', 'wrap', 'pingpong'].includes(m.mode), m.id);
    assert.ok(m.speed > 0 && Array.isArray(m.path) && m.path.length >= 2, m.id);
  }
  assert.deepEqual(kinds, { drone: 6, pod: 5, train: 2, bot: 3, spin: 5 });
});
