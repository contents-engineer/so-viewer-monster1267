import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three/three.module.js';
import { createPartOcclusion, PART_CHUNK } from '../public/src/nowhere/part-occlusion.js';
import { PART_RAY_NEAR } from '../public/src/nowhere/products.js';

// 감상 무대 부위 표지 가림(part-occlusion.js) — vendored three 로 만든 메시에 표지 점 · 카메라를 놓고 동작으로 잰다.
// 건물 재질은 모두 양면(doubleSided)이라 판정은 재질 면이 아니라 맞은 삼각형의 들어가는 면(법선 · 광선 < 0)으로 한다.
const { isBehind } = createPartOcclusion(THREE);
const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
const v = (x, y, z) => new THREE.Vector3(x, y, z);
function mesh(geo, setup) {
  const m = new THREE.Mesh(geo, mat);
  setup?.(m);
  return m;
}
function model(...children) {
  const g = new THREE.Group();
  g.add(...children);
  g.updateMatrixWorld(true);
  return g;
}
const slab = (z, thick = 0.3, setup) => mesh(new THREE.BoxGeometry(10, 10, thick), (m) => {
  m.position.z = z;
  setup?.(m);
});
// 삼각형 800 개(20 × 20 칸)짜리 판 — z = 0, 법선 +z. PlaneGeometry 는 위(+y) 줄부터 삼각형을 늘어놓으므로 아래 오른쪽 구석이 마지막 묶음이다
const bigPlane = () => new THREE.PlaneGeometry(10, 10, 20, 20);
const triCount = (geo) => (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
function faceIndexAt(root, p, eye) {
  const rc = new THREE.Raycaster(p, eye.clone().sub(p).normalize());
  return rc.intersectObject(root, true)[0]?.faceIndex;
}

test('(a) 닫힌 상자 안의 표지 점은 가리지 않는다(광선은 나가는 면에만 맞는다), 상자 뒤의 점은 가린다', () => {
  const box = model(mesh(new THREE.BoxGeometry(10, 10, 10)));
  for (const eye of [v(0, 0, 40), v(30, 12, -25), v(-18, 3, 7)]) assert.equal(isBehind(box, v(0, 0, 0), eye), false, `안 → ${eye.toArray()}`);
  assert.equal(isBehind(box, v(1, 2, -1), v(0, 0, 40)), false, '가운데가 아닌 안쪽 점');
  assert.equal(isBehind(box, v(0, 0, -20), v(0, 0, 40)), true, '상자 뒤 — 뒷면(점 쪽)에서 들어간다');
  assert.equal(isBehind(box, v(0, 0, 20), v(0, 0, 40)), false, '상자 앞 — 광선이 상자를 지나지 않는다');
});

test('(b) 판(얇은 상자) 뒤의 점은 가리고, 판이 카메라 너머 · 옆이면 가리지 않는다 — 옮기고 돌린 메시도 같다', () => {
  assert.equal(isBehind(model(slab(5)), v(0, 0, 0), v(0, 0, 20)), true, '점과 카메라 사이 판');
  assert.equal(isBehind(model(slab(5)), v(0, 0, 0), v(0, 0, -20)), false, '판이 반대쪽');
  assert.equal(isBehind(model(slab(5)), v(0, 0, 0), v(0, 0, 3)), false, '판이 카메라 너머');
  assert.equal(isBehind(model(slab(5)), v(0, 0, 0), v(40, 0, 1)), false, '판 옆으로 지나간다');
  // 메시 행렬(옮김 · 돌림 · 늘림) — 광선을 메시 로컬로 옮겨 잰다
  const turned = model(slab(5, 0.3, (m) => {
    m.rotation.y = Math.PI;
    m.scale.set(0.5, 0.5, 2);
  }));
  assert.equal(isBehind(turned, v(0, 0, 0), v(0, 0, 20)), true, '돌리고 늘린 판');
  assert.equal(isBehind(turned, v(4, 0, 0), v(4, 0, 20)), false, '줄어든 판(폭 5 m) 밖');
});

test(`(c) 삼각형이 PART_CHUNK(${PART_CHUNK}) 개를 넘는 판: 뒤쪽 묶음(마지막 · 덜 찬 묶음)의 삼각형에 맞아도 가린다, 빗나가면 가리지 않는다`, () => {
  const geo = bigPlane();
  assert.ok(triCount(geo) > PART_CHUNK * 2 && triCount(geo) % PART_CHUNK !== 0, '여러 묶음 + 덜 찬 마지막 묶음');
  const plane = model(mesh(geo));
  const p = v(4.6, -4.6, 3);
  const eye = v(4.6, -4.6, -20);
  assert.ok(faceIndexAt(plane, p, eye) >= Math.floor(triCount(geo) / PART_CHUNK) * PART_CHUNK, '광선은 마지막 묶음의 삼각형에 맞는다(Raycaster 로 확인)');
  assert.equal(isBehind(plane, p, eye), true, '마지막 묶음');
  assert.ok(faceIndexAt(plane, v(-4.6, 4.6, 3), v(-4.6, 4.6, -20)) < PART_CHUNK);
  assert.equal(isBehind(plane, v(-4.6, 4.6, 3), v(-4.6, 4.6, -20)), true, '첫 묶음');
  assert.equal(isBehind(plane, v(0.3, 0.2, 3), v(0.3, 0.2, -20)), true, '가운데 묶음');
  assert.equal(isBehind(plane, v(6, -4.6, 3), v(6, -4.6, -20)), false, '판 밖으로 빗나간다');
});

test('(d) 인덱스 없는 geometry(toNonIndexed()) 도 같다', () => {
  const geo = bigPlane().toNonIndexed();
  assert.equal(geo.index, null);
  const plane = model(mesh(geo));
  assert.equal(isBehind(plane, v(4.6, -4.6, 3), v(4.6, -4.6, -20)), true, '마지막 묶음');
  assert.equal(isBehind(plane, v(-4.6, 4.6, 3), v(-4.6, 4.6, -20)), true, '첫 묶음');
  assert.equal(isBehind(plane, v(6, -4.6, 3), v(6, -4.6, -20)), false, '빗나간다');
  const box = model(mesh(new THREE.BoxGeometry(10, 10, 10).toNonIndexed()));
  assert.equal(isBehind(box, v(0, 0, 0), v(0, 0, 40)), false, '닫힌 상자 안');
  assert.equal(isBehind(box, v(0, 0, -20), v(0, 0, 40)), true, '닫힌 상자 뒤');
});

test('(e) 거울 행렬(scale(-1, 1, 1) — 메시 · 부모): 뒤집히지 않은 것과 판정이 같다(상자 안은 앞, 판 뒤는 가림)', () => {
  // three 는 행렬식이 음수인 메시의 앞면을 뒤집어 그린다(frontFaceCW) — 로컬 감기 법선 · 로컬 광선의 부호가 곧 실제 앞뒤다
  const mirror = (m) => m.scale.set(-1, 1, 1);
  const box = model(mesh(new THREE.BoxGeometry(10, 10, 10), mirror));
  assert.ok(box.children[0].matrixWorld.determinant() < 0);
  assert.equal(isBehind(box, v(0, 0, 0), v(0, 0, 40)), false, '거울 상자 안');
  assert.equal(isBehind(box, v(2, 1, 0), v(-30, 12, -25)), false, '거울 상자 안(비스듬히)');
  assert.equal(isBehind(box, v(0, 0, -20), v(0, 0, 40)), true, '거울 상자 뒤');
  assert.equal(isBehind(model(slab(5, 0.3, mirror)), v(0, 0, 0), v(0, 0, 20)), true, '거울 판 뒤');
  const parent = new THREE.Group();
  parent.scale.set(-1, 1, 1);
  parent.add(mesh(new THREE.BoxGeometry(10, 10, 10)));
  const nested = model(parent);
  assert.equal(isBehind(nested, v(0, 0, 0), v(0, 0, 40)), false, '부모가 거울 — 상자 안');
  assert.equal(isBehind(nested, v(0, 0, -20), v(0, 0, 40)), true, '부모가 거울 — 상자 뒤');
  const plane = model(mesh(bigPlane(), mirror));
  assert.equal(isBehind(plane, v(4.6, -4.6, 3), v(4.6, -4.6, -20)), true, '거울 판(여러 묶음)');
});

test(`(f) 표지 점 PART_RAY_NEAR(${PART_RAY_NEAR} m) 안의 얇은 막은 세지 않는다(FaceArch 눈 점 앞 1.3 m 에서 들어가 1.7 m 에서 나오는 막), 그 너머는 센다`, () => {
  const p = v(0, 0, 0);
  const eye = v(0, 0, 30);
  assert.equal(isBehind(model(slab(1.5, 0.4)), p, eye), false, '1.3 m 에서 들어가는 막');
  assert.equal(isBehind(model(slab(PART_RAY_NEAR + 0.2, 0.2)), p, eye), true, `${PART_RAY_NEAR + 0.1} m 에서 들어가는 판`);
  assert.equal(isBehind(model(slab(1.5, 0.4), slab(8)), p, eye), true, '막은 세지 않고 그 너머 판은 센다');
});

test('(g) 숨은(visible = false) 메시 · 숨은 부모 아래 메시는 세지 않는다', () => {
  const p = v(0, 0, 0);
  const eye = v(0, 0, 20);
  assert.equal(isBehind(model(slab(5, 0.3, (m) => { m.visible = false; })), p, eye), false, '숨은 메시');
  const hidden = new THREE.Group();
  hidden.visible = false;
  hidden.add(slab(5));
  assert.equal(isBehind(model(hidden), p, eye), false, '숨은 부모');
  assert.equal(isBehind(model(hidden, slab(8)), p, eye), true, '보이는 다른 판은 센다');
});

test('(h) 같은 geometry 를 쓰는 메시(clone)와 다시 잰 값이 같다(묶음 상자는 geometry 마다 한 번)', () => {
  const geo = bigPlane();
  const a = model(mesh(geo));
  const b = a.clone(true);
  b.children[0].position.x = 20;
  b.updateMatrixWorld(true);
  assert.equal(b.children[0].geometry, geo);
  assert.equal(isBehind(a, v(4.6, -4.6, 3), v(4.6, -4.6, -20)), true);
  assert.equal(isBehind(b, v(4.6, -4.6, 3), v(4.6, -4.6, -20)), false, '옮긴 clone 은 빗나간다');
  assert.equal(isBehind(b, v(24.6, -4.6, 3), v(24.6, -4.6, -20)), true, '옮긴 자리에서는 맞는다');
  assert.equal(isBehind(a, v(4.6, -4.6, 3), v(4.6, -4.6, -20)), true, '다시 재도 같다');
});
