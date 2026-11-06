import test from 'node:test';
import assert from 'node:assert/strict';
import { stepLook, LOOK_LIMIT } from '../public/src/nowhere/look.js';

// Three.js 좌표: 기본 시선은 −Z, 위는 +Y.
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test('(a) 키를 누르지 않으면 방향은 그대로(정규화만)', () => {
  const d = stepLook({ x: 0, y: 0, z: -2.5 }, new Set(), 0.1);
  assert.ok(near(d.x, 0) && near(d.y, 0) && near(d.z, -1));
});

test('(b) ↑ 는 올려다보고 ↓ 는 내려다본다, 상하 한계(±80°)에서 멈춘다', () => {
  const up = stepLook({ x: 0, y: 0, z: -1 }, new Set(['ArrowUp']), 0.5, { pitchSpeed: Math.PI / 2 });
  assert.ok(near(Math.asin(up.y), Math.PI / 4), '0.5 s × 90°/s = 45° 위');
  const top = stepLook({ x: 0, y: 0, z: -1 }, new Set(['ArrowUp']), 10);
  assert.ok(near(Math.asin(top.y), LOOK_LIMIT), '한계각 고정');
  const down = stepLook({ x: 0, y: 0, z: -1 }, new Set(['ArrowDown']), 10);
  assert.ok(near(Math.asin(down.y), -LOOK_LIMIT));
});

test('(c) ← 는 왼쪽으로, → 는 오른쪽으로 돌아본다(앙각 유지)', () => {
  const left = stepLook({ x: 0, y: 0, z: -1 }, new Set(['ArrowLeft']), 1, { yawSpeed: Math.PI / 2 });
  assert.ok(near(left.x, -1) && near(left.z, 0), '−Z 를 보다 왼쪽(−X)으로 90°');
  const right = stepLook({ x: 0, y: 0, z: -1 }, new Set(['ArrowRight']), 1, { yawSpeed: Math.PI / 2 });
  assert.ok(near(right.x, 1) && near(right.z, 0));
  const tilted = stepLook({ x: 0, y: 0.5, z: -0.5 }, new Set(['ArrowLeft']), 1, { yawSpeed: Math.PI / 2 });
  assert.ok(near(Math.asin(tilted.y), Math.PI / 4), '좌우로 돌아도 올려다보는 각도는 그대로');
});

test('(d) WASD 이동키는 시선을 바꾸지 않는다', () => {
  const d = stepLook({ x: 0, y: 0, z: -1 }, new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']), 1);
  assert.ok(near(d.x, 0) && near(d.y, 0) && near(d.z, -1));
});

test('(e) 모든 카메라 프리셋(성수·DS2)이 궤도 카메라 극각 상한 안에 있다 — 상한에 걸리면 OrbitControls 가 시점을 밀어 올린다', async () => {
  const { readFileSync } = await import('node:fs');
  const { ORBIT_MAX_POLAR } = await import('../public/src/nowhere/look.js');
  assert.equal(typeof ORBIT_MAX_POLAR, 'number');
  for (const ver of ['nowhere', 'nowhere-ds2']) {
    const layout = JSON.parse(readFileSync(new URL(`../public/assets/${ver}/layout.json`, import.meta.url), 'utf8'));
    for (const c of layout.cameras) {
      const d = [c.pos[0] - c.target[0], c.pos[1] - c.target[1], c.pos[2] - c.target[2]];
      const polar = Math.acos(d[1] / Math.hypot(...d));
      assert.ok(polar <= ORBIT_MAX_POLAR, `[${ver}] ${c.id} 극각 ${(polar * 180 / Math.PI).toFixed(1)}° > 상한 ${(ORBIT_MAX_POLAR * 180 / Math.PI).toFixed(1)}°`);
    }
  }
});

test('(f) 마우스 시선(포인터 잠금): 오른쪽으로 밀면 오른쪽, 위로 밀면 위를 본다, 상하 한계 유지', async () => {
  const { MOUSE_SENS } = await import('../public/src/nowhere/look.js');
  const keys = new Set();
  const right = stepLook({ x: 0, y: 0, z: -1 }, keys, 0, {}, { dx: (Math.PI / 2) / MOUSE_SENS, dy: 0 });
  assert.ok(near(right.x, 1, 1e-6) && near(right.z, 0, 1e-6), '−Z 를 보다 오른쪽(+X)으로 90°');
  const up = stepLook({ x: 0, y: 0, z: -1 }, keys, 0, {}, { dx: 0, dy: -((Math.PI / 6) / MOUSE_SENS) });
  assert.ok(near(Math.asin(up.y), Math.PI / 6, 1e-6), '마우스를 위로(−dy) 밀면 30° 올려다봄');
  const top = stepLook({ x: 0, y: 0, z: -1 }, keys, 0, {}, { dx: 0, dy: -1e6 });
  assert.ok(near(Math.asin(top.y), LOOK_LIMIT, 1e-6));
});
