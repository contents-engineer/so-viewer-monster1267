import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = resolve(ROOT, 'public/assets');
const NW_ASSETS = resolve(ASSETS, 'nowhere');
const NW_DS2_ASSETS = resolve(ASSETS, 'nowhere-ds2');
const WORLD_DIRS = [
  ['seongsu', NW_ASSETS],
  ['ds2', NW_DS2_ASSETS],
];

const LAYERS = ['ground', 'present', 'future', 'backdrop'];
const BUILDINGS = ['gm_building.glb', 'facearch.glb'];
const ALLOWED_SURFACES = new Set([
  'ground',
  'wall',
  'rock',
  'metal',
  'glass',
  'water',
  'emissive',
  'holo',
  'foliage',
]);
const ALLOWED_ANCHOR_LAYERS = new Set(['building', 'present', 'future', 'nature']);

const DESKTOP_BUDGET_BYTES = 40 * 1024 * 1024; // 40 MB (건물 2개 포함)
const MOBILE_BUDGET_BYTES = 22 * 1024 * 1024;  // 22 MB (건물 2개 포함)

function parseGlbJson(filePath) {
  const buf = readFileSync(filePath);
  assert.ok(buf.byteLength >= 20, `${filePath}: GLB 헤더가 너무 짧다`);
  const magic = buf.readUInt32LE(0);
  const version = buf.readUInt32LE(4);
  assert.equal(magic, 0x46546c67, `${filePath}: glTF 매직 불일치`);
  assert.equal(version, 2, `${filePath}: glTF 버전은 2여야 한다`);
  const chunkLen = buf.readUInt32LE(12);
  const chunkType = buf.readUInt32LE(16);
  assert.equal(chunkType, 0x4e4f534a, `${filePath}: 첫 청크는 JSON이어야 한다`);
  const jsonText = buf.subarray(20, 20 + chunkLen).toString('utf8');
  return JSON.parse(jsonText);
}

test('(a) GLB 4개(데스크톱) + mobile 4개 및 마스크·HDRI 파일이 존재하고 용량 예산 이내다 (seongsu & ds2)', () => {
  let bldBytes = 0;
  for (const bld of BUILDINGS) {
    const p = resolve(ASSETS, bld);
    assert.ok(existsSync(p), `건물 원본 GLB가 없다: ${bld}`);
    bldBytes += statSync(p).size;
  }

  for (const [ver, dirPath] of WORLD_DIRS) {
    let desktopBytes = bldBytes;
    let mobileBytes = bldBytes;

    for (const layer of LAYERS) {
      const deskPath = resolve(dirPath, `nowhere-${layer}.glb`);
      const mobPath = resolve(dirPath, 'mobile', `nowhere-${layer}.glb`);
      assert.ok(existsSync(deskPath), `[${ver}] 데스크톱 GLB가 없다: nowhere-${layer}.glb`);
      assert.ok(existsSync(mobPath), `[${ver}] 모바일 GLB가 없다: mobile/nowhere-${layer}.glb`);
      const dSize = statSync(deskPath).size;
      const mSize = statSync(mobPath).size;
      assert.ok(dSize > 1024, `[${ver}] nowhere-${layer}.glb 크기가 비정상적으로 작다 (${dSize} B)`);
      assert.ok(mSize > 1024, `[${ver}] mobile/nowhere-${layer}.glb 크기가 비정상적으로 작다 (${mSize} B)`);
      desktopBytes += dSize;
      mobileBytes += mSize;
    }

    const maskPath = resolve(dirPath, 'nowhere-ground-mask.webp');
    const hdrPath = resolve(dirPath, 'sky-1k.hdr');
    assert.ok(existsSync(maskPath), `[${ver}] 지면 마스크 텍스처가 없다: nowhere-ground-mask.webp`);
    assert.ok(existsSync(hdrPath), `[${ver}] 조명용 HDRI가 없다: sky-1k.hdr`);

    const maskBytes = statSync(maskPath).size;
    const hdrBytes = statSync(hdrPath).size;
    desktopBytes += maskBytes + hdrBytes;
    mobileBytes += maskBytes + hdrBytes;

    assert.ok(
      desktopBytes <= DESKTOP_BUDGET_BYTES,
      `[${ver}] 데스크톱 총 전송량 ${(desktopBytes / (1024 * 1024)).toFixed(2)} MB > 40 MB 예산 초과`,
    );
    assert.ok(
      mobileBytes <= MOBILE_BUDGET_BYTES,
      `[${ver}] 모바일 총 전송량 ${(mobileBytes / (1024 * 1024)).toFixed(2)} MB > 22 MB 예산 초과`,
    );
  }
});

test('(b) layout.json 스키마: 건물 2개, 카메라 ≥ 4, 앵커 id 유일 및 render 파일 존재 (seongsu & ds2)', () => {
  for (const [ver, dirPath] of WORLD_DIRS) {
    const layoutPath = resolve(dirPath, 'layout.json');
    assert.ok(existsSync(layoutPath), `[${ver}] layout.json 파일이 없다`);
    const layout = JSON.parse(readFileSync(layoutPath, 'utf8'));

    assert.ok(layout.buildings && typeof layout.buildings === 'object', `[${ver}] buildings 객체가 필요하다`);
    for (const key of ['haus', 'facearch']) {
      const b = layout.buildings[key];
      assert.ok(b, `[${ver}] buildings.${key} 가 없다`);
      assert.ok(Array.isArray(b.pos) && b.pos.length === 3 && b.pos.every(Number.isFinite), `[${ver}] buildings.${key}.pos 는 [x,y,z] 숫자 배열`);
      assert.equal(typeof b.rotY, 'number', `[${ver}] buildings.${key}.rotY 는 숫자(deg)`);
    }

    assert.ok(Array.isArray(layout.cameras) && layout.cameras.length >= 4, `[${ver}] cameras 배열은 최소 4개 이상이어야 한다`);
    const camIds = new Set();
    for (const cam of layout.cameras) {
      assert.equal(typeof cam.id, 'string', `[${ver}] camera.id 필요`);
      assert.ok(!camIds.has(cam.id), `[${ver}] 중복 camera.id: ${cam.id}`);
      camIds.add(cam.id);
      assert.equal(typeof cam.label, 'string', `[${ver}] camera(${cam.id}).label 필요`);
      assert.ok(Array.isArray(cam.pos) && cam.pos.length === 3 && cam.pos.every(Number.isFinite), `[${ver}] camera(${cam.id}).pos 형식`);
      assert.ok(Array.isArray(cam.target) && cam.target.length === 3 && cam.target.every(Number.isFinite), `[${ver}] camera(${cam.id}).target 형식`);
      assert.ok(typeof cam.fov === 'number' && cam.fov > 5 && cam.fov < 120, `[${ver}] camera(${cam.id}).fov 범위`);
    }
    for (const reqCam of ['street', 'aerial', 'viaduct', 'night']) {
      assert.ok(camIds.has(reqCam), `[${ver}] 필수 카메라 프리셋 누락: ${reqCam}`);
    }

    assert.ok(Array.isArray(layout.anchors) && layout.anchors.length >= 15, `[${ver}] anchors 배열이 필요하다`);
    const anchorIds = new Set();
    for (const a of layout.anchors) {
      assert.equal(typeof a.id, 'string', `[${ver}] anchor.id 필요`);
      assert.ok(!anchorIds.has(a.id), `[${ver}] 중복 anchor.id: ${a.id}`);
      anchorIds.add(a.id);
      assert.ok(ALLOWED_ANCHOR_LAYERS.has(a.layer), `[${ver}] anchor(${a.id}).layer=${a.layer} 불허`);
      assert.ok(Array.isArray(a.pos) && a.pos.length === 3 && a.pos.every(Number.isFinite), `[${ver}] anchor(${a.id}).pos 형식`);
      assert.equal(typeof a.title, 'string', `[${ver}] anchor(${a.id}).title 필요`);
      assert.equal(typeof a.render, 'string', `[${ver}] anchor(${a.id}).render 경로 필요`);
      const renderDiskPath = resolve(ROOT, 'public', a.render.replace(/^\//, ''));
      assert.ok(existsSync(renderDiskPath), `[${ver}] anchor(${a.id}).render 파일이 없다: ${a.render}`);
    }
  }
});

test('(c) GLB JSON 청크 검증: extras.nw_surface 값이 §5 허용 목록 안에 있고 nw_drive가 COLOR_0으로 유출되지 않는다 (seongsu & ds2)', () => {
  for (const [ver, dirPath] of WORLD_DIRS) {
    for (const layer of LAYERS) {
      for (const sub of ['', 'mobile/']) {
        const p = resolve(dirPath, `${sub}nowhere-${layer}.glb`);
        const gltf = parseGlbJson(p);
        assert.ok(Array.isArray(gltf.nodes) && gltf.nodes.length > 0, `[${ver}] ${sub}nowhere-${layer}.glb: nodes 비어 있음`);
        assert.ok(Array.isArray(gltf.meshes) && gltf.meshes.length > 0, `[${ver}] ${sub}nowhere-${layer}.glb: meshes 비어 있음`);

        let surfaceCount = 0;
        for (const node of gltf.nodes) {
          const surf = node.extras?.nw_surface ?? (node.mesh !== undefined ? gltf.meshes[node.mesh]?.extras?.nw_surface : undefined);
          if (surf !== undefined) {
            assert.ok(
              ALLOWED_SURFACES.has(surf),
              `[${ver}] ${sub}nowhere-${layer}.glb node '${node.name}': 알 수 없는 nw_surface='${surf}'`,
            );
            surfaceCount += 1;
          }
        }
        assert.ok(surfaceCount > 0, `[${ver}] ${sub}nowhere-${layer}.glb: extras.nw_surface 가 하나도 없다`);

        if (layer === 'ground') {
          for (const node of gltf.nodes) {
            if (node.mesh === undefined) continue;
            const name = node.name || gltf.meshes[node.mesh]?.name || '';
            if (/^GR_(road|sidewalk|blocklot|vacant|forecourt|terrain|stream_main|stream_sub|stream_west|pad_haus|pad_facearch)$/.test(name)) {
              const prims = gltf.meshes[node.mesh].primitives || [];
              for (const prim of prims) {
                assert.equal(
                  prim.attributes.COLOR_0,
                  undefined,
                  `[${ver}] ${sub}nowhere-ground.glb '${name}': nw_drive가 COLOR_0으로 유출됨`,
                );
                assert.notEqual(
                  prim.attributes.TEXCOORD_1,
                  undefined,
                  `[${ver}] ${sub}nowhere-ground.glb '${name}': UVMap_mask(TEXCOORD_1) 누락`,
                );
              }
            }
          }
        }
      }
    }
  }
});
