import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { readGlbJson, meshNodeBoxes, triangleCount } from './lib/glb.mjs';
import { rewriteGlbJson, remapMaterials, fillZeroNormals, PRODUCT_SOURCES } from '../tools/nowhere/products.mjs';

const PUB = new URL('../public/', import.meta.url);
const catalog = JSON.parse(readFileSync(new URL('assets/products/products.json', PUB), 'utf8'));
const MB = 1024 * 1024;
const VARIANTS = [
  ['glb', '감상', 80000, 1024, 3 * MB],
  ['liteGlb', '진열', 20000, 512, 0.8 * MB],
];
const ALLOWED = new Set(['EXT_meshopt_compression', 'KHR_mesh_quantization', 'EXT_texture_webp', 'KHR_materials_ior', 'KHR_texture_transform']);

// GLB 안 이미지 바이트(bufferView → BIN 청크)
function imageBytes(url, json, img) {
  const buf = readFileSync(url);
  const jsonLen = buf.readUInt32LE(12);
  const binStart = 20 + jsonLen + 8;
  const bv = json.bufferViews[img.bufferView];
  return buf.subarray(binStart + (bv.byteOffset || 0), binStart + (bv.byteOffset || 0) + bv.byteLength);
}

// WebP 머리(RIFF … WEBP + VP8 / VP8L / VP8X)에서 가로 · 세로
function webpSize(b) {
  assert.equal(b.toString('ascii', 0, 4), 'RIFF');
  assert.equal(b.toString('ascii', 8, 12), 'WEBP');
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (kind === 'VP8L') {
    const b0 = b[21], b1 = b[22], b2 = b[23], b3 = b[24];
    return [1 + (((b1 & 0x3f) << 8) | b0), 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6))];
  }
  if (kind === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  throw new Error(`알 수 없는 WebP 청크 ${kind}`);
}

const files = catalog.products.flatMap((p) => VARIANTS.map(([key, label, maxTris, maxTex, maxBytes]) => ({ p, key, label, maxTris, maxTex, maxBytes, url: new URL(p[key], PUB) })));

test('(a) 제품마다 감상 · 진열 GLB: 삼각형 ≤ 80 K · 20 K, 용량 ≤ 3 MB · 0.8 MB, 진열 세 점 합 ≤ 2.4 MB', () => {
  let lite = 0;
  for (const f of files) {
    assert.ok(existsSync(f.url), `${f.p[f.key]} 없음 — npm run nowhere:products`);
    const tris = triangleCount(readGlbJson(f.url));
    const bytes = statSync(f.url).size;
    assert.ok(tris > 1000 && tris <= f.maxTris, `${f.p[f.key]} 삼각형 ${tris} > ${f.maxTris}`);
    assert.ok(bytes <= f.maxBytes, `${f.p[f.key]} ${(bytes / MB).toFixed(2)} MB > ${f.maxBytes / MB} MB`);
    if (f.key === 'liteGlb') lite += bytes;
  }
  assert.ok(lite <= 2.4 * MB, `진열 합 ${(lite / MB).toFixed(2)} MB > 2.4 MB`);
});

test('(b) 텍스처는 모두 WebP 이고 감상 ≤ 1024 · 진열 ≤ 512 px, KTX2 · basisu 확장 없음, 쓰는 확장은 뷰어가 읽는 것만', () => {
  for (const f of files) {
    const json = readGlbJson(f.url);
    for (const e of json.extensionsUsed || []) assert.ok(ALLOWED.has(e), `${f.p[f.key]}: 확장 ${e}`);
    for (const e of json.extensionsRequired || []) assert.ok(ALLOWED.has(e), `${f.p[f.key]}: 필수 확장 ${e}`);
    assert.doesNotMatch(JSON.stringify(json), /KHR_texture_basisu|image\/ktx2/);
    for (const img of json.images || []) {
      assert.equal(img.mimeType, 'image/webp', `${f.p[f.key]}: ${img.name} ${img.mimeType}`);
      const [w, h] = webpSize(imageBytes(f.url, json, img));
      assert.ok(w <= f.maxTex && h <= f.maxTex, `${f.p[f.key]}: ${img.name} ${w}×${h} > ${f.maxTex}`);
    }
  }
});

test('(c) WorldGridMaterial 없음, 투명 재질의 알파 모드 유지(Kant 렌즈 MASK · Folding Tarx · Veggie Oat 렌즈 BLEND)', () => {
  const modes = { kant: 'MASK', 'folding-tarx': 'BLEND', 'veggie-oat': 'BLEND' };
  for (const f of files) {
    const mats = readGlbJson(f.url).materials;
    assert.ok(!mats.some((m) => m.name === 'WorldGridMaterial'), `${f.p[f.key]}: WorldGridMaterial 남음`);
    assert.ok(mats.some((m) => m.alphaMode === modes[f.p.id]), `${f.p[f.key]}: ${modes[f.p.id]} 재질 없음`);
  }
});

test('(d) 경계 상자가 원본 실측(sizeMm)과 ±2 mm — 실제 크기 그대로', () => {
  for (const f of files) {
    const boxes = meshNodeBoxes(readGlbJson(f.url));
    const min = [0, 1, 2].map((a) => Math.min(...boxes.map((b) => b.min[a])));
    const max = [0, 1, 2].map((a) => Math.max(...boxes.map((b) => b.max[a])));
    const got = { width: (max[0] - min[0]) * 1000, length: (max[2] - min[2]) * 1000, height: (max[1] - min[1]) * 1000 };
    for (const k of ['width', 'length', 'height']) {
      assert.ok(Math.abs(got[k] - f.p.sizeMm[k]) <= 2, `${f.p[f.key]} ${k} ${got[k].toFixed(1)} mm ≠ ${f.p.sizeMm[k]} ± 2`);
    }
  }
});

test('(e) 1F 진열 예산: 진열 GLB 프리미티브 합 ≤ 10(받침대 · 덮개 2 를 더해 그리기 ≤ +12) · 삼각형 합 ≤ 69 K(받침대 · 덮개 몫 1 K 남김)', () => {
  const lite = catalog.displays.filter((d) => d.floor === '1').map((d) => readGlbJson(new URL(catalog.products.find((p) => p.id === d.product).liteGlb, PUB)));
  const prims = lite.reduce((s, j) => s + j.meshes.reduce((n, m) => n + m.primitives.length, 0), 0);
  const tris = lite.reduce((s, j) => s + triangleCount(j), 0);
  assert.ok(prims <= 10, `프리미티브 ${prims}`);
  assert.ok(tris <= 69000, `삼각형 ${tris}`);
});

test('(f) 파이프라인 도우미: JSON 청크만 고쳐 쓰고(BIN 그대로 · 4 바이트 맞춤), 재질 바꾸기는 없는 이름이면 던진다, 원본 표와 목록의 제품이 같다', () => {
  const src = readFileSync(new URL('assets/products/kant-lite.glb', PUB));
  const out = rewriteGlbJson(src, (j) => {
    j.asset.extras = { note: '한글 확인' };
  });
  assert.equal(out.readUInt32LE(8), out.length);
  const jl = out.readUInt32LE(12);
  assert.equal(jl % 4, 0);
  assert.equal(JSON.parse(out.subarray(20, 20 + jl).toString('utf8')).asset.extras.note, '한글 확인');
  assert.ok(out.subarray(20 + jl).equals(src.subarray(20 + src.readUInt32LE(12))), 'BIN 청크 그대로');
  const json = { materials: [{ name: 'A' }, { name: 'B' }], meshes: [{ primitives: [{ material: 0 }, { material: 1 }] }] };
  assert.equal(remapMaterials(json, { A: 'B' }), 1);
  assert.deepEqual(json.meshes[0].primitives.map((p) => p.material), [1, 1]);
  assert.throws(() => remapMaterials(json, { C: 'B' }), /재질 없음: C/);
  assert.deepEqual(PRODUCT_SOURCES.map((p) => p.id), catalog.products.map((p) => p.id));
});

test('(g) 법선 0 채우기: 같은 자리 면 중 45° 안만 넓이 가중 평균 — 날카로운 모서리는 섞지 않고, 같은 자리 쪼개진 꼭짓점은 같은 값, 있던 법선은 그대로', () => {
  const s30 = Math.sin(Math.PI / 6), c30 = Math.cos(Math.PI / 6);
  // 0–2: z=0 면(+z), 3–5: 같은 모서리를 쪼갠 꼭짓점으로 90° 접힌 면(+x)
  // 6–8: z=0 면(+z), 9–11: 같은 모서리를 쪼갠 꼭짓점으로 30° 기운 면 — 두 면 넓이 같음
  const pos = new Float32Array([
    0, 0, 0, 1, 0, 0, 0, 1, 0,
    0, 0, 0, 0, 1, 0, 0, 0, 1,
    2, 0, 0, 3, 0, 0, 2, 1, 0,
    2, 0, 0, 2, 1, 0, 2 - c30, 0, s30,
  ]);
  const nrm = new Float32Array(36);
  nrm.set([0, 0.6, 0.8], 3);   // 1 번은 원래 법선이 있다
  const idx = new Uint16Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.equal(fillZeroNormals(pos, nrm, idx), 11);
  const n = (v) => [...nrm.subarray(v * 3, v * 3 + 3)].map((x) => Math.round(x * 1e4) / 1e4);
  assert.deepEqual(n(1), [0, 0.6, 0.8]);
  for (const v of [0, 2]) assert.deepEqual(n(v), [0, 0, 1], `${v}: 90° 접힘의 +z 쪽`);
  for (const v of [3, 4, 5]) assert.deepEqual(n(v), [1, 0, 0], `${v}: 90° 접힘의 +x 쪽`);
  const h = Math.PI / 12;   // 30° 기울기의 반
  assert.deepEqual(n(6), [Math.round(Math.sin(h) * 1e4) / 1e4, 0, Math.round(Math.cos(h) * 1e4) / 1e4], '30° 는 두 면 평균(15°)');
  assert.deepEqual([...nrm.subarray(18, 21)], [...nrm.subarray(27, 30)], '같은 자리 쪼개진 꼭짓점 6 · 9 는 비트까지 같은 값(다시 용접된다)');
});
