// HAUS NOWHERE — 리테일 제품 GLB 파이프라인(npm run nowhere:products).
// 사내 제품 원본(언리얼 내보내기, PNG 텍스처) → public/assets/products/<id>.glb(감상 · 데스크톱 · 태블릿) + <id>-lite.glb(진열 · 휴대폰 감상).
// 처리: ① 원본 JSON 청크만 고쳐 재질 바꾸기(Veggie Oat 의 WorldGridMaterial — 다리 안쪽 인쇄, 실제 재질이 빠진 채 내보내짐)
//       ② prune(안 쓰는 UV · 탄젠트 지우기 — 용접이 더 붙어 단순화가 잘 된다)
//       ③ 법선 0 채우기(원본 금속의 상당 부분이 법선 (0, 0, 0) 으로 내보내졌다 — 그대로 두면 압축에서 +z 한 방향으로 굳어 얼룩이 된다)
//       ④ optimize — gltf-transform CLI optimize 와 같은 순서(dedup · palette(재질 합치기 — 그리기 줄이기) · flatten · join · weld · 단순화 ·
//          prune · sparse · 텍스처 WebP · meshopt 압축)를 함수 API 로. 다른 점은 단순화 하나: 감상용은 법선도 오차에 넣는다(VARIANTS normalWeight)
// 단순화 오차는 작은 값부터 올려 삼각형 · 용량 상한을 처음 맞추는 값을 쓴다. 경계 고정이 먼저, 못 맞추면 경계 풀기(보고 줄에 표시).
// 함수 API(core · functions · extensions · meshoptimizer · sharp)는 CLI 와 같은 npx 설치에서 불러온다 — 저장소에 의존성을 두지 않는다.
// 원본 폴더는 PRODUCT_SRC(기본 ../../xr-editor/public/assets — 저장소 밖, 커밋하지 않음). KTX2(compressed/) 원본은 받지 않는다(뷰어에 KTX2 로더 없음).
// 결과 확인: tests/nowhere-product-assets.test.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readGlbJson, meshNodeBoxes, triangleCount } from '../../tests/lib/glb.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = resolve(process.env.PRODUCT_SRC || resolve(ROOT, '../../xr-editor/public/assets'));
const OUT = resolve(ROOT, 'public/assets/products');
const TMP = resolve(ROOT, 'build/products');
const CLI_PKG = '@gltf-transform/cli@4.1.1';
const CLI = ['-y', CLI_PKG];
// CP 에서 결과를 확인한 라이브러리 판(접두사). CLI 4.1.1 은 meshoptimizer · sharp 만 고정하고 core · functions · extensions 는 ^4.1.1 이라
// npx 캐시를 새로 받으면 더 새 4.x 가 올 수 있다 — 단순화 · 압축 결과가 달라질 수 있으니 다르면 멈추고 다시 확인한다
export const EXPECTED_VERSIONS = { meshoptimizer: '0.22.', '@gltf-transform/functions': '4.5.' };
const MB = 1024 * 1024;

// 원본 파일 · 재질 바꾸기(원본 재질 이름 → 같은 원본의 다른 재질 이름)
export const PRODUCT_SOURCES = [
  { id: 'kant', src: 'Kant.glb' },
  { id: 'folding-tarx', src: 'Folding_Tarx.glb' },
  // 왼쪽 다리 안쪽 인쇄(x −68.5 … −66.4 mm, z −58 … −38 mm)가 언리얼 기본 격자 재질로 나왔다 — 원본에서는 다리 속에 묻혀 안 보이므로
  // 다리와 같은 검정으로(실버로 두면 단순화 뒤 다리 겉면 · 안쪽에 은색 점선으로 비집고 나온다 — Task 6 CP)
  { id: 'veggie-oat', src: 'Veggie_Oat.glb', remap: { WorldGridMaterial: 'Black_006' } },
];
// normalWeight: 단순화 오차에 법선 차이를 넣는 무게(0 = 위치만 — gltf-transform simplify 그대로). 감상용은 확대해 보므로 법선을 지킨다 —
// 위치만 보면 평평한 렌즈 · 가는 금속 테에서 법선이 크게 다른 꼭짓점(테두리 쪽)이 큰 삼각형 끝에 남아 반사가 조각나거나 얼룩진다.
// 진열용은 상한(20 K)이 빠듯하고 멀리서 보므로 위치만(법선을 넣으면 위치 오차가 커진다).
export const VARIANTS = [
  { suffix: '', size: 1024, maxTris: 80000, maxBytes: 3 * MB, normalWeight: 0.3 },
  { suffix: '-lite', size: 512, maxTris: 20000, maxBytes: 0.8 * MB, normalWeight: 0 },
];
export const ZERO_NORMAL_CREASE = 45;   // ° — 법선 0 꼭짓점을 채울 때 같은 자리 면 중 이 각 안의 것만 평균(모서리는 날카롭게)
export const SIMPLIFY_ERRORS = [0.0001, 0.0002, 0.0003, 0.0005, 0.001, 0.002];
export const ALLOWED_EXTENSIONS = ['EXT_meshopt_compression', 'KHR_mesh_quantization', 'EXT_texture_webp', 'KHR_materials_ior', 'KHR_texture_transform'];

/** GLB 의 JSON 청크만 edit(json) 으로 고쳐 다시 쓴 Buffer(BIN 청크는 그대로 — 안 쓰게 된 데이터는 prune 이 지운다) */
export function rewriteGlbJson(buf, edit) {
  if (buf.readUInt32LE(0) !== 0x46546c67 || buf.readUInt32LE(16) !== 0x4e4f534a) throw new Error('GLB 아님');
  const len = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + len).toString('utf8'));
  edit(json);
  let js = Buffer.from(JSON.stringify(json), 'utf8');
  js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const rest = buf.subarray(20 + len);
  const head = Buffer.alloc(20);
  head.writeUInt32LE(0x46546c67, 0);
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(20 + js.length + rest.length, 8);
  head.writeUInt32LE(js.length, 12);
  head.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([head, js, rest]);
}

/** 프리미티브 재질을 이름으로 바꾼다. 없는 이름이면 던진다. 바꾼 프리미티브 수 */
export function remapMaterials(json, remap = {}) {
  let n = 0;
  for (const [from, to] of Object.entries(remap)) {
    const fi = json.materials.findIndex((m) => m.name === from);
    const ti = json.materials.findIndex((m) => m.name === to);
    if (fi < 0 || ti < 0) throw new Error(`재질 없음: ${fi < 0 ? from : to}`);
    for (const mesh of json.meshes) {
      for (const p of mesh.primitives) {
        if (p.material === fi) {
          p.material = ti;
          n++;
        }
      }
    }
  }
  return n;
}

/** 장면 전체 경계 상자 크기(mm) { width: x, length: z, height: y } — 반올림 전 값 */
export function sizeOfGlb(json) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const b of meshNodeBoxes(json)) {
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], b.min[a]);
      max[a] = Math.max(max[a], b.max[a]);
    }
  }
  return { width: (max[0] - min[0]) * 1000, length: (max[2] - min[2]) * 1000, height: (max[1] - min[1]) * 1000 };
}

/**
 * 법선이 (0, 0, 0) 인 꼭짓점을 면 법선으로 채운다(그 자리에서 normals 를 고친다). 채운 꼭짓점 수.
 * 꼭짓점마다 자기가 닿는 면들의 평균을 기준으로, 같은 위치에 닿는 면 중 기준과 creaseDeg 안인 것만 넓이 가중 평균한다 —
 * 같은 자리에 쪼개진 꼭짓점(원본 UV 이음매)은 같은 값을 받아 다시 용접되고, 날카로운 모서리는 양쪽이 섞이지 않는다.
 */
export function fillZeroNormals(positions, normals, indices, creaseDeg = ZERO_NORMAL_CREASE) {
  const vc = positions.length / 3;
  const zero = new Uint8Array(vc);
  let any = 0;
  for (let v = 0; v < vc; v++) {
    if (normals[v * 3] === 0 && normals[v * 3 + 1] === 0 && normals[v * 3 + 2] === 0) {
      zero[v] = 1;
      any++;
    }
  }
  if (!any) return 0;
  // 위치 번호(같은 좌표 = 같은 번호)
  const ids = new Map();
  const pid = new Uint32Array(vc);
  for (let v = 0; v < vc; v++) {
    const k = `${positions[v * 3]},${positions[v * 3 + 1]},${positions[v * 3 + 2]}`;
    let id = ids.get(k);
    if (id === undefined) ids.set(k, (id = ids.size));
    pid[v] = id;
  }
  // 넓이 가중 면 법선(정규화하지 않은 외적)
  const tc = indices.length / 3;
  const face = new Float64Array(tc * 3);
  for (let t = 0; t < tc; t++) {
    const a = indices[t * 3] * 3, b = indices[t * 3 + 1] * 3, c = indices[t * 3 + 2] * 3;
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const wx = positions[c] - positions[a], wy = positions[c + 1] - positions[a + 1], wz = positions[c + 2] - positions[a + 2];
    face[t * 3] = uy * wz - uz * wy;
    face[t * 3 + 1] = uz * wx - ux * wz;
    face[t * 3 + 2] = ux * wy - uy * wx;
  }
  // 위치마다 닿는 면 목록(CSR)
  const start = new Uint32Array(ids.size + 1);
  for (let i = 0; i < indices.length; i++) start[pid[indices[i]] + 1]++;
  for (let i = 0; i < ids.size; i++) start[i + 1] += start[i];
  const fillAt = start.slice(0, ids.size);
  const faces = new Uint32Array(indices.length);
  for (let i = 0; i < indices.length; i++) faces[fillAt[pid[indices[i]]]++] = (i / 3) | 0;
  // 기준: 꼭짓점 자신이 닿는 면의 합
  const ref = new Float64Array(vc * 3);
  for (let i = 0; i < indices.length; i++) {
    const v = indices[i];
    if (!zero[v]) continue;
    const t = (i / 3) | 0;
    for (let k = 0; k < 3; k++) ref[v * 3 + k] += face[t * 3 + k];
  }
  const cos = Math.cos((creaseDeg * Math.PI) / 180);
  let filled = 0;
  for (let v = 0; v < vc; v++) {
    if (!zero[v]) continue;
    const rl = Math.hypot(ref[v * 3], ref[v * 3 + 1], ref[v * 3 + 2]);
    if (rl === 0) continue;   // 닿는 면이 없거나 모두 넓이 0 — 그대로 둔다
    const rx = ref[v * 3] / rl, ry = ref[v * 3 + 1] / rl, rz = ref[v * 3 + 2] / rl;
    let sx = 0, sy = 0, sz = 0;
    for (let j = start[pid[v]]; j < start[pid[v] + 1]; j++) {
      const t = faces[j];
      const fx = face[t * 3], fy = face[t * 3 + 1], fz = face[t * 3 + 2];
      const fl = Math.hypot(fx, fy, fz);
      if (fl === 0 || (fx * rx + fy * ry + fz * rz) / fl < cos) continue;
      sx += fx;
      sy += fy;
      sz += fz;
    }
    const l = Math.hypot(sx, sy, sz);
    // 자기 면끼리도 crease 보다 벌어진 꼭짓점(접힌 모서리에 함께 쓰인 꼭짓점)은 기준(자기 면 평균)을 쓴다
    if (l > 0) [normals[v * 3], normals[v * 3 + 1], normals[v * 3 + 2]] = [sx / l, sy / l, sz / l];
    else [normals[v * 3], normals[v * 3 + 1], normals[v * 3 + 2]] = [rx, ry, rz];
    filled++;
  }
  return filled;
}

// gltf-transform CLI 한 번. 출력은 삼키고(sharp 중복 경고 등), 실패하면 그 출력을 보여 주고 던진다
function cli(args) {
  try {
    execFileSync('npx', [...CLI, ...args], { stdio: 'pipe' });
  } catch (err) {
    process.stderr.write(err.stdout?.toString() || '');
    process.stderr.write(err.stderr?.toString() || '');
    throw err;
  }
}

function measure(file) {
  const json = readGlbJson(file);
  return { json, tris: triangleCount(json), bytes: statSync(file).size, ext: json.extensionsUsed || [] };
}

// gltf-transform 함수 API · meshoptimizer · sharp — CLI 와 같은 npx 설치(CLI_PKG)에서 불러온다(그 판의 optimize 와 같은 코드)
// 패키지 버전 읽기 — exports 가 package.json 을 막을 수 있어 불러온 진입 파일에서 위로 올라가며 같은 이름의 package.json 을 찾는다
function packageVersion(req, name) {
  let dir = dirname(req.resolve(name));
  for (;;) {
    const file = resolve(dir, 'package.json');
    if (existsSync(file)) {
      const pkg = JSON.parse(readFileSync(file, 'utf8'));
      if (pkg.name === name) return pkg.version;
    }
    const up = dirname(dir);
    if (up === dir) throw new Error(`${name} 의 package.json 을 찾지 못함`);
    dir = up;
  }
}

/** 실제 불러온 판을 로그로 찍고, 기대 판(EXPECTED_VERSIONS)과 다르면 던진다. 읽은 판 목록을 돌려준다 */
export function checkToolkitVersions(req, expected = EXPECTED_VERSIONS, log = console.log) {
  const names = ['@gltf-transform/core', '@gltf-transform/functions', '@gltf-transform/extensions', 'meshoptimizer', 'sharp'];
  const found = Object.fromEntries(names.map((n) => [n, packageVersion(req, n)]));
  log(`  라이브러리 판: ${names.map((n) => `${n} ${found[n]}`).join(' · ')}`);
  const bad = Object.entries(expected).filter(([n, prefix]) => !found[n].startsWith(prefix));
  if (bad.length) {
    throw new Error(
      `CP 에서 확인한 판과 다름 — 결과를 다시 확인해야 함: ${bad.map(([n, prefix]) => `${n} ${found[n]} (기대 ${prefix}x)`).join(', ')}. ` +
        '다시 확인한 뒤 EXPECTED_VERSIONS 를 고친다',
    );
  }
  return found;
}

export function loadToolkit() {
  const bin = execFileSync('npx', ['-y', '-p', CLI_PKG, '-c', 'command -v gltf-transform'], { encoding: 'utf8' }).trim().split('\n').at(-1);
  const req = createRequire(bin);
  checkToolkitVersions(req);
  const { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } = req('meshoptimizer');
  return {
    core: req('@gltf-transform/core'),
    fn: req('@gltf-transform/functions'),
    ext: req('@gltf-transform/extensions'),
    sharp: req('sharp'),
    MeshoptEncoder,
    MeshoptDecoder,
    MeshoptSimplifier,
  };
}

// 단순화: normalWeight 0 이면 gltf-transform simplify 그대로(위치 오차만). 아니면 같은 일을 meshopt simplifyWithAttributes 로 — 법선(× 무게)도 오차에 넣는다
function simplifyStep(tk, { error, lockBorder, normalWeight }) {
  const { fn, MeshoptSimplifier } = tk;
  if (!normalWeight) return fn.simplify({ simplifier: MeshoptSimplifier, error, lockBorder });
  return fn.createTransform('simplifyWithNormals', async (doc) => {
    await MeshoptSimplifier.ready;
    MeshoptSimplifier.useExperimentalFeatures = true;   // simplifyWithAttributes(meshoptimizer 0.22 실험 기능)
    await doc.transform(fn.weld({ overwrite: false }));
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION')?.getArray();
        const nrm = prim.getAttribute('NORMAL')?.getArray();
        const src = prim.getIndices();
        if (prim.getMode() !== 4 || !src || !(pos instanceof Float32Array) || !(nrm instanceof Float32Array)) {
          throw new Error(`단순화: 삼각형 · 인덱스 · float 위치 · 법선이 아닌 프리미티브(${mesh.getName()})`);
        }
        const w = normalWeight;
        const [dst] = MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(src.getArray()), pos, 3, nrm, 3, [w, w, w], null, 0, error, lockBorder ? ['LockBorder'] : []);
        prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(dst).setBuffer(src.getBuffer()));
        if (src.listParents().length === 1) src.dispose();
        fn.compactPrimitive(prim);
        if (prim.getAttribute('POSITION').getCount() <= 65534) prim.getIndices().setArray(new Uint16Array(prim.getIndices().getArray()));
      }
    }
  });
}

// CLI optimize(--compress meshopt --texture-compress webp --texture-size <size> --simplify true --instance false --palette true --palette-min 2)와
// 같은 순서 · 값 — 단순화만 simplifyStep
function optimizeTransforms(tk, { size, error, lockBorder, normalWeight }) {
  const { fn } = tk;
  return [
    fn.dedup(),
    fn.palette({ min: 2, keepAttributes: false }),
    fn.flatten(),
    fn.join({ keepNamed: false, keepMeshes: false }),
    fn.weld(),
    simplifyStep(tk, { error, lockBorder, normalWeight }),
    fn.prune({ keepAttributes: false, keepIndices: false, keepLeaves: false, keepSolidTextures: false }),
    fn.sparse(),
    fn.textureCompress({ encoder: tk.sharp, resize: [size, size], targetFormat: 'webp', limitInputPixels: true }),
    fn.meshopt({ encoder: tk.MeshoptEncoder, level: 'high' }),
  ];
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(TMP, { recursive: true });
  const catalogPath = resolve(OUT, 'products.json');
  const catalog = existsSync(catalogPath) ? JSON.parse(readFileSync(catalogPath, 'utf8')) : null;
  let tk;
  try {
    tk = loadToolkit();
  } catch (err) {
    console.error(`  ✗ ${err.message}`);
    process.exit(1);
  }
  await Promise.all([tk.MeshoptEncoder.ready, tk.MeshoptDecoder.ready, tk.MeshoptSimplifier.ready]);
  const io = new tk.core.NodeIO()
    .setLogger(new tk.core.Logger(tk.core.Logger.Verbosity.WARN))
    .registerExtensions(tk.ext.ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': tk.MeshoptDecoder, 'meshopt.encoder': tk.MeshoptEncoder });
  let failed = false;
  for (const p of PRODUCT_SOURCES) {
    const srcPath = resolve(SRC, p.src);
    if (!existsSync(srcPath)) throw new Error(`원본 없음: ${srcPath} (PRODUCT_SRC 로 폴더를 지정)`);
    const srcJson = readGlbJson(srcPath);
    if ((srcJson.extensionsUsed || []).includes('KHR_texture_basisu')) throw new Error(`${p.src}: KTX2 원본은 쓰지 않는다(compressed/ 가 아닌 PNG 원본을 지정)`);
    const size = sizeOfGlb(srcJson);
    const sizeMm = { width: Math.round(size.width), length: Math.round(size.length), height: Math.round(size.height) };
    const listed = catalog?.products?.find((x) => x.id === p.id)?.sizeMm;
    if (listed && JSON.stringify(listed) !== JSON.stringify(sizeMm)) {
      console.error(`  ✗ products.json sizeMm ${JSON.stringify(listed)} ≠ 실측 ${JSON.stringify(sizeMm)}`);
      failed = true;
    }

    // ① 재질 바꾸기 → ② 안 쓰는 속성 지우기 → ③ 법선 0 채우기
    const fixed = resolve(TMP, `${p.id}-fixed.glb`);
    const pruned = resolve(TMP, `${p.id}-pruned.glb`);
    const normals = resolve(TMP, `${p.id}-normals.glb`);
    writeFileSync(fixed, rewriteGlbJson(readFileSync(srcPath), (json) => remapMaterials(json, p.remap)));
    cli(['prune', fixed, pruned, '--keep-attributes', 'false']);
    const doc = await io.read(pruned);
    let filled = 0;
    for (const prim of doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())) {
      const na = prim.getAttribute('NORMAL');
      if (prim.getMode() !== 4 || !na || !prim.getIndices()) continue;
      const nrm = na.getArray().slice();
      const n = fillZeroNormals(prim.getAttribute('POSITION').getArray(), nrm, prim.getIndices().getArray());
      if (n) na.setArray(nrm);
      filled += n;
    }
    await io.write(normals, doc);
    console.log(`\n${p.id}: 원본 ${triangleCount(srcJson)} 삼각형 · 실측 ${JSON.stringify(sizeMm)} · 법선 0 채움 ${filled} 꼭짓점`);

    // ④ 변형마다 오차 사다리
    for (const v of VARIANTS) {
      const target = resolve(OUT, `${p.id}${v.suffix}.glb`);
      let picked = null;
      for (const lock of [true, false]) {
        for (const err of SIMPLIFY_ERRORS) {
          const tmp = resolve(TMP, `${p.id}${v.suffix}-${lock ? 'lock' : 'free'}-${err}.glb`);
          const work = await io.read(normals);
          await work.transform(...optimizeTransforms(tk, { size: v.size, error: err, lockBorder: lock, normalWeight: v.normalWeight }));
          await io.write(tmp, work);
          const m = measure(tmp);
          if (m.tris <= v.maxTris && m.bytes <= v.maxBytes) {
            picked = { ...m, tmp, lock, err };
            break;
          }
        }
        if (picked) break;
      }
      if (!picked) {
        console.error(`  ✗ ${p.id}${v.suffix}: 오차 ${SIMPLIFY_ERRORS.at(-1)} 경계 풀기로도 삼각형 ≤ ${v.maxTris} · 용량 ≤ ${v.maxBytes} 을 못 맞춤 — 보고하고 상한을 함께 정한다`);
        failed = true;
        continue;
      }
      const bad = picked.ext.filter((e) => !ALLOWED_EXTENSIONS.includes(e));
      const names = picked.json.materials.map((m) => m.name);
      const out = sizeOfGlb(picked.json);
      const drift = Math.max(Math.abs(out.width - size.width), Math.abs(out.length - size.length), Math.abs(out.height - size.height));
      if (bad.length || names.includes('WorldGridMaterial') || drift > 2) {
        console.error(`  ✗ ${p.id}${v.suffix}: 확장 ${bad.join(',') || '-'} · 재질 ${names.join(',')} · 크기 차 ${drift.toFixed(2)} mm`);
        failed = true;
        continue;
      }
      copyFileSync(picked.tmp, target);
      const prims = picked.json.meshes.reduce((s, mesh) => s + mesh.primitives.length, 0);
      console.log(
        `  ${`${p.id}${v.suffix}.glb`.padEnd(22)} ${String(picked.tris).padStart(6)} 삼각형 · ${(picked.bytes / MB).toFixed(3)} MB · 프리미티브 ${prims} · ` +
          `오차 ${picked.err} ${picked.lock ? '경계 고정' : '경계 풀기(경계 고정으로는 상한 초과)'}${v.normalWeight ? ` · 법선 무게 ${v.normalWeight}` : ''} · 크기 차 ${drift.toFixed(2)} mm`,
      );
    }
  }
  if (failed) process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
