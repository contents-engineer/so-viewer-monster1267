// HAUS NOWHERE — 감상 무대 부위 표지 가림(THREE 를 인자로 받는다 — 테스트: tests/nowhere-part-occlusion.test.mjs 가 vendored three 로 동작을 잰다).
// 표지 점 → 카메라 광선이 모델에서 표지를 가리는 면(products.js hitHidesPart — PART_RAY_NEAR 넘고 카메라보다 가깝고 광선이 들어가는 면)에 맞는지.
// 하나 찾으면 멈춘다. 숨은(visible = false) 메시 · 숨은 부모 아래 메시는 세지 않는다(그리지 않는 것 — traverseVisible).
// 면 방향은 메시 로컬 삼각형 법선(감기 순서) · 로컬 광선 방향 — 거울 행렬(행렬식 < 0)이어도 부호를 바꾸지 않는다: three 는 그런 메시의 앞면을 뒤집어
// 그려(frontFaceCW) 로컬 감기 법선 쪽이 그대로 바깥이다(꼭짓점 법선 → normalMatrix 와 부호가 같다).
// 가속: 메시 geometry 마다 삼각형 PART_CHUNK 개씩 묶은 경계 상자(메시 로컬)를 한 번 만들어(WeakMap — clone 은 geometry 를 같이 쓰고, geometry 가
// 풀리면 같이 사라진다) 광선이 지나는 묶음의 삼각형만 잰다(FaceArch 눈 메시 하나가 12.7만 삼각형 — Raycaster 로 다 훑으면 광선 하나에 10–20 ms).
import { hitHidesPart } from './products.js';

export const PART_CHUNK = 128;   // 삼각형 — 가림 광선 가속 묶음 크기

/** THREE(three 모듈) → { isBehind(model, p, eye) } — model: 무대 모델 루트(matrixWorld 갱신된 것), p: 표지 점(월드), eye: 카메라 자리(월드) */
export function createPartOcclusion(THREE) {
  const toCam = new THREE.Vector3();
  const worldRay = new THREE.Ray();
  const localRay = new THREE.Ray();
  const inv = new THREE.Matrix4();
  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const vc = new THREE.Vector3();
  const hitP = new THREE.Vector3();
  const triN = new THREE.Vector3();
  const chunkCache = new WeakMap();

  function chunksOf(geo) {
    let cs = chunkCache.get(geo);
    if (!cs) {
      const pos = geo.attributes.position;
      const idx = geo.index;
      const n = idx ? idx.count : pos.count;
      cs = [];
      for (let s = 0; s < n; s += PART_CHUNK * 3) {
        const e = Math.min(n, s + PART_CHUNK * 3);
        const box = new THREE.Box3();
        for (let i = s; i < e; i++) box.expandByPoint(va.fromBufferAttribute(pos, idx ? idx.getX(i) : i));
        cs.push({ box, s, e });
      }
      chunkCache.set(geo, cs);
    }
    return cs;
  }

  function isBehind(model, p, eye) {
    toCam.subVectors(eye, p);
    const far = toCam.length();
    worldRay.set(p, toCam.divideScalar(far));
    let hidden = false;
    model.traverseVisible((o) => {
      if (hidden || !o.isMesh) return;
      const geo = o.geometry;
      inv.copy(o.matrixWorld).invert();
      localRay.copy(worldRay).applyMatrix4(inv);
      if (!geo.boundingBox) geo.computeBoundingBox();
      if (!localRay.intersectsBox(geo.boundingBox)) return;
      const pos = geo.attributes.position;
      const idx = geo.index;
      for (const c of chunksOf(geo)) {
        if (!localRay.intersectsBox(c.box)) continue;
        for (let i = c.s; i < c.e && !hidden; i += 3) {
          va.fromBufferAttribute(pos, idx ? idx.getX(i) : i);
          vb.fromBufferAttribute(pos, idx ? idx.getX(i + 1) : i + 1);
          vc.fromBufferAttribute(pos, idx ? idx.getX(i + 2) : i + 2);
          if (!localRay.intersectTriangle(va, vb, vc, false, hitP)) continue;
          const dot = THREE.Triangle.getNormal(va, vb, vc, triN).dot(localRay.direction);
          hidden = hitHidesPart({ distance: hitP.applyMatrix4(o.matrixWorld).distanceTo(p), dot }, far);
        }
        if (hidden) break;
      }
    });
    return hidden;
  }

  return { isBehind };
}
