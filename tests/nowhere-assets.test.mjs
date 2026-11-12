import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
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
  let bldMobileBytes = 0;
  for (const bld of BUILDINGS) {
    const p = resolve(ASSETS, bld);
    assert.ok(existsSync(p), `건물 원본 GLB가 없다: ${bld}`);
    bldBytes += statSync(p).size;
    const m = resolve(ASSETS, 'mobile', bld);
    assert.ok(existsSync(m), `건물 모바일 사본 GLB가 없다: mobile/${bld}`);
    bldMobileBytes += statSync(m).size;
  }

  for (const [ver, dirPath] of WORLD_DIRS) {
    let desktopBytes = bldBytes;
    let mobileBytes = bldMobileBytes;   // 모바일은 텍스처를 줄인 사본(assets/mobile)을 싣는다

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

// ── Task 13: 모바일 주인공 건물 사본(텍스처 ≤ 1024)과 원본 불변 ──
// 원본의 sha256 은 2026-11-11 git 인덱스(HEAD)의 바이트에서 계산해 고정했다. 원본을 바꾸면 이 테스트가 깨진다.
const HERO_ORIGINALS = {
  'gm_building.glb': { size: 2453112, sha256: '7baa5dfc5d8099474cf4404fe5635159dc27c10dc6c31b86604f21ebd2ea9b7b' },
  'facearch.glb': { size: 3493780, sha256: 'bb1a890456cae94c4ba3872839987453c47782712ec17622a09cedee5b47e455' },
};

/** GLB 이미지(webp / png / jpeg)의 크기를 디코더 없이 헤더에서 읽는다. */
function imageSize(buf) {
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') {
    const kind = buf.subarray(12, 16).toString('latin1');
    if (kind === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
    if (kind === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)];
    }
    if (kind === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  }
  if (buf.readUInt32BE(0) === 0x89504e47) return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    for (let i = 2; i < buf.length - 9; ) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  throw new Error('알 수 없는 이미지 형식');
}

function glbImageSizes(filePath) {
  const buf = readFileSync(filePath);
  const gltf = parseGlbJson(filePath);
  const binStart = 20 + buf.readUInt32LE(12) + 8;
  return (gltf.images || []).map((img) => {
    const bv = gltf.bufferViews[img.bufferView];
    const off = binStart + (bv.byteOffset || 0);
    return imageSize(buf.subarray(off, off + bv.byteLength));
  });
}

test('(h) 주인공 건물 원본은 바이트 그대로이고, 모바일 사본은 텍스처만 1024 이하로 줄었다', () => {
  for (const [name, want] of Object.entries(HERO_ORIGINALS)) {
    const orig = resolve(ASSETS, name);
    const buf = readFileSync(orig);
    assert.equal(buf.byteLength, want.size, `${name} 원본 크기가 바뀌었다`);
    assert.equal(createHash('sha256').update(buf).digest('hex'), want.sha256, `${name} 원본 바이트가 바뀌었다`);

    const mob = resolve(ASSETS, 'mobile', name);
    assert.ok(existsSync(mob), `모바일 사본이 없다: mobile/${name}`);
    const origSizes = glbImageSizes(orig);
    const mobSizes = glbImageSizes(mob);
    assert.ok(origSizes.some(([w, h]) => Math.max(w, h) > 1024), `${name} 원본에 1024 초과 텍스처가 있어야 비교가 의미 있다`);
    assert.equal(mobSizes.length, origSizes.length, `${name} 사본의 이미지 수가 원본과 다르다`);
    for (const [w, h] of mobSizes) assert.ok(Math.max(w, h) <= 1024, `${name} 사본 텍스처가 ${w}×${h} 로 1024 를 넘는다`);
    mobSizes.forEach(([w, h], i) => {
      const [ow, oh] = origSizes[i];
      assert.equal(Math.round((w / h) * 100), Math.round((ow / oh) * 100), `${name} 이미지 ${i} 가로세로비가 바뀌었다`);
    });

    // 형상 · 재질 · 노드 이름 · 확장은 원본과 같다
    const og = parseGlbJson(orig);
    const mg = parseGlbJson(mob);
    assert.deepEqual(mg.nodes.map((n) => n.name), og.nodes.map((n) => n.name), `${name} 노드 이름이 다르다`);
    assert.deepEqual((mg.materials || []).map((m) => m.name), (og.materials || []).map((m) => m.name), `${name} 재질 이름이 다르다`);
    assert.deepEqual([...mg.extensionsUsed].sort(), [...og.extensionsUsed].sort(), `${name} extensionsUsed 가 다르다`);
    assert.deepEqual([...(mg.extensionsRequired || [])].sort(), [...(og.extensionsRequired || [])].sort(), `${name} extensionsRequired 가 다르다`);
    assert.deepEqual(mg.meshes.map((m) => m.primitives.length), og.meshes.map((m) => m.primitives.length), `${name} 프리미티브 수가 다르다`);
    const count = (g) => g.meshes.flatMap((m) => m.primitives).map((p) => g.accessors[p.indices].count);
    assert.deepEqual(count(mg), count(og), `${name} 삼각형(인덱스) 수가 다르다`);
    assert.ok(statSync(mob).size < statSync(orig).size, `${name} 사본이 원본보다 작아야 한다`);
  }
});

test('(i) 날으는 로드스터 전송량: future GLB + layout.json 이 로드스터 전(2026-11-12 main 1f2815d)보다 0.3 MB 넘게 늘지 않는다(데스크톱 · 모바일)', () => {
  const BASE = { desktop: 1349060 + 296395, mobile: 1072192 + 296395 };   // nowhere-future.glb + layout.json 바이트(로드스터 전)
  const layoutBytes = statSync(resolve(NW_ASSETS, 'layout.json')).size;
  const now = {
    desktop: statSync(resolve(NW_ASSETS, 'nowhere-future.glb')).size + layoutBytes,
    mobile: statSync(resolve(NW_ASSETS, 'mobile', 'nowhere-future.glb')).size + layoutBytes,
  };
  for (const k of ['desktop', 'mobile']) {
    const grow = now[k] - BASE[k];
    assert.ok(grow <= 0.3 * 1024 * 1024, `${k}: +${(grow / 1024).toFixed(1)} KB > 300 KB`);
  }
});
