// HAUS NOWHERE — three 메시 → 지형 높이 격자 · 보행 장애물 격자 래스터화(외관 world.js 와 실내 interior.js 가 공유).
import * as THREE from 'three';
import { rasterizeTriangle, markObstacleTriangle } from './terrain.js';

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _inst = new THREE.Matrix4();

/** 메시의 월드 좌표 삼각형마다 fn(ax, ay, az, bx, by, bz, cx, cy, cz) — 인덱스 · 인스턴싱 모두 처리. */
export function forEachWorldTriangle(mesh, fn) {
  const pos = mesh.geometry?.attributes?.position;
  if (!pos) return;
  mesh.updateWorldMatrix(true, false);
  const idx = mesh.geometry.index;
  const triCount = idx ? idx.count / 3 : pos.count / 3;
  const count = mesh.isInstancedMesh ? mesh.count : 1;
  for (let k = 0; k < count; k++) {
    if (mesh.isInstancedMesh) {
      mesh.getMatrixAt(k, _inst);
      _m.multiplyMatrices(mesh.matrixWorld, _inst);
    } else {
      _m.copy(mesh.matrixWorld);
    }
    for (let t = 0; t < triCount; t++) {
      _a.fromBufferAttribute(pos, idx ? idx.getX(t * 3) : t * 3).applyMatrix4(_m);
      _b.fromBufferAttribute(pos, idx ? idx.getX(t * 3 + 1) : t * 3 + 1).applyMatrix4(_m);
      _c.fromBufferAttribute(pos, idx ? idx.getX(t * 3 + 2) : t * 3 + 2).applyMatrix4(_m);
      fn(_a.x, _a.y, _a.z, _b.x, _b.y, _b.z, _c.x, _c.y, _c.z);
    }
  }
}

/** 메시들을 높이 격자에 래스터화. pickGrids(ax, az) 가 그 삼각형을 넣을 격자 목록을 고른다. */
export function rasterizeMeshes(meshes, pickGrids) {
  for (const mesh of meshes) {
    forEachWorldTriangle(mesh, (ax, ay, az, bx, by, bz, cx, cy, cz) => {
      for (const g of pickGrids(ax, az)) rasterizeTriangle(g, ax, ay, az, bx, by, bz, cx, cy, cz);
    });
  }
}

/** 메시들의 몸통 높이 부분을 장애물 격자에 기록하고 처리한 삼각형 수를 돌려준다. */
export function markObstacleMeshes(occ, meshes, groundAt) {
  let tris = 0;
  for (const mesh of meshes) {
    forEachWorldTriangle(mesh, (ax, ay, az, bx, by, bz, cx, cy, cz) => {
      markObstacleTriangle(occ, ax, ay, az, bx, by, bz, cx, cy, cz, groundAt);
      tris++;
    });
  }
  return tris;
}
