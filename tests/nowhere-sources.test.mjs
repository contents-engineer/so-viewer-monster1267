import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = resolve(ROOT, 'tools/nowhere/sources.json');
const JSM = resolve(ROOT, 'public/vendor/three/jsm');

const SECTIONS = { textures: 'tex', hdris: 'hdri', models: 'model' };
const ALLOWED_RES = new Set(['1k', '2k']);
const EXCLUDED = ['tree_small_02', 'modular_urban_apartments_facade'];

const ADDONS = [
  'postprocessing/EffectComposer.js',
  'postprocessing/RenderPass.js',
  'postprocessing/ShaderPass.js',
  'postprocessing/UnrealBloomPass.js',
  'postprocessing/OutputPass.js',
  'postprocessing/Pass.js',
  'postprocessing/MaskPass.js',
  'shaders/CopyShader.js',
  'shaders/LuminosityHighPassShader.js',
  'shaders/OutputShader.js',
  'loaders/RGBELoader.js',
  'lines/LineSegments2.js',
  'lines/LineSegmentsGeometry.js',
  'lines/LineMaterial.js',
];

function loadSources() {
  return JSON.parse(readFileSync(SOURCES, 'utf8'));
}

function entries() {
  const src = loadSources();
  return Object.keys(SECTIONS).flatMap((section) => {
    assert.ok(Array.isArray(src[section]) && src[section].length > 0, `sources.json.${section} 는 비어 있지 않은 배열이어야 한다`);
    return src[section].map((e) => ({ section, ...e }));
  });
}

test('(a) sources.json: 같은 소재를 같은 해상도로 두 번 적지 않고, res 는 1k/2k 뿐이다', () => {
  const seen = new Set();
  for (const e of entries()) {
    assert.match(e.id, /^[a-z0-9_]+$/, `id 형식: ${e.id}`);
    assert.ok(ALLOWED_RES.has(e.res), `${e.section}/${e.id}: res=${e.res} 는 1k/2k 가 아니다`);
    assert.equal(typeof e.use, 'string', `${e.id}: use(용도) 가 필요하다`);
    const key = `${e.section}/${e.id}/${e.res}`;
    assert.ok(!seen.has(key), `중복 항목: ${key}`);
    seen.add(key);
  }
  // 텍스처·모델은 한 id 를 한 번만 받는다. 여러 해상도는 HDRI 만 허용한다.
  for (const section of ['textures', 'models']) {
    const ids = loadSources()[section].map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length, `${section} 에 id 가 겹친다`);
  }
});

test('(b) sources.json: §4 제외 목록(tree_small_02, modular_urban_apartments_facade)이 없다', () => {
  const ids = new Set(entries().map((e) => e.id));
  for (const id of EXCLUDED) assert.ok(!ids.has(id), `제외 대상이 들어 있다: ${id}`);
});

test('(c) three 애드온 14개가 있고, 상대 import 대상이 모두 존재한다', () => {
  assert.equal(ADDONS.length, 14);
  const importRe = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g;
  for (const rel of ADDONS) {
    const file = resolve(JSM, rel);
    assert.ok(existsSync(file), `애드온 파일이 없다: ${rel}`);
    const code = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    for (const [, spec] of code.matchAll(importRe)) {
      if (spec === 'three') continue; // 페이지의 import map 이 풀어 준다
      assert.ok(spec.startsWith('./') || spec.startsWith('../'), `${rel}: import map 에 없는 bare specifier '${spec}'`);
      assert.ok(existsSync(resolve(dirname(file), spec)), `${rel}: import 대상이 없다 '${spec}'`);
    }
  }
});

// (d) 한글 간판 글꼴: Blender 빌드(present.py)가 읽는 글꼴이 sources.json 에 커밋 고정 URL·sha256·라이선스와 함께 있어야
//     깨끗한 환경에서 fetch → build 가 재현된다(Poly Haven 밖 소재는 이것 하나).
const PINNED_RAW = /^https:\/\/raw\.githubusercontent\.com\/[\w.-]+\/[\w.-]+\/[0-9a-f]{40}\/\S+$/;

test('(d) sources.json fonts: 커밋 고정 raw URL, sha256 64자, licence OFL-1.1, 라이선스 파일도 고정·해시', () => {
  const src = loadSources();
  assert.ok(Array.isArray(src.fonts) && src.fonts.length > 0, 'sources.json.fonts 는 비어 있지 않은 배열이어야 한다');
  const ids = new Set();
  for (const f of src.fonts) {
    assert.match(f.id, /^[a-z0-9_]+$/, `fonts id 형식: ${f.id}`);
    assert.ok(!ids.has(f.id), `fonts id 중복: ${f.id}`);
    ids.add(f.id);
    assert.match(f.url, PINNED_RAW, `${f.id}: url 은 40자 커밋 SHA 로 고정한 raw URL 이어야 한다 (${f.url})`);
    assert.match(f.sha256, /^[0-9a-f]{64}$/, `${f.id}: sha256 은 소문자 16진 64자`);
    assert.equal(f.licence, 'OFL-1.1', `${f.id}: licence`);
    assert.match(f.licence_url, PINNED_RAW, `${f.id}: licence_url 도 커밋 고정이어야 한다`);
    assert.match(f.licence_sha256, /^[0-9a-f]{64}$/, `${f.id}: licence_sha256`);
    for (const k of ['file', 'licence_file']) {
      assert.match(f[k], /^[\w.\-\[\]]+$/, `${f.id}: ${k} 는 경로 구분자 없는 파일 이름`);
    }
    assert.equal(typeof f.use, 'string', `${f.id}: use(용도) 가 필요하다`);
  }
});

test('(e) present.py 가 읽는 글꼴 파일이 sources.json fonts 에 있다', () => {
  const code = readFileSync(resolve(ROOT, 'tools/nowhere/blender/present.py'), 'utf8');
  const m = code.match(/FONT_FILE\s*=\s*os\.path\.join\(lib\.SRC,\s*'fonts',\s*'([^']+)'\)/);
  assert.ok(m, 'present.py 에 FONT_FILE = os.path.join(lib.SRC, \'fonts\', ...) 가 있어야 한다');
  const files = (loadSources().fonts || []).map((f) => f.file);
  assert.ok(files.includes(m[1]), `present.py 의 글꼴 ${m[1]} 가 sources.json fonts 에 없다`);
});
