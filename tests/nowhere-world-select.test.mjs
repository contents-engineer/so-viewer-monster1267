import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  WORLD_CARDS, SELECT_CTA, SELECT_BRAND, SELECT_EXPAND_MS, SELECT_FADE_MS, resolveSelectKey,
} from '../public/src/nowhere/world-select.js';
import { WORLD_IDS } from '../public/src/nowhere/entry.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('(a) 두 면: 왼쪽 성수 2041 · 오른쪽 DS2 산악, 문구 그대로 · 설명은 한 줄', () => {
  assert.deepEqual(WORLD_CARDS.map((c) => c.id), WORLD_IDS);
  assert.deepEqual(WORLD_CARDS.map((c) => [c.kicker, c.title]), [
    ['SEONGSU · 2041', '성수 2041'],
    ['CHIRAL HIGHLAND · DS2', 'DS2 산악 고원'],
  ]);
  for (const c of WORLD_CARDS) assert.ok(c.desc.length > 0 && c.desc.length <= 32, `${c.id} 설명 ${c.desc.length}자`);
  assert.equal(SELECT_CTA, '들어가기 →');
  assert.equal(SELECT_BRAND, 'HAUS NOWHERE');
  assert.equal(SELECT_EXPAND_MS, 600);
  assert.equal(SELECT_FADE_MS, 300);
});

test('(b) 이미지: 스펙 후보 렌더 중 하나이고 파일이 있다', () => {
  const CANDIDATES = {
    seongsu: ['assets/nowhere/renders/hero-future.webp', 'assets/nowhere/renders/hero-street.webp'],
    ds2: ['assets/nowhere-ds2/renders/hero-valley.webp', 'assets/nowhere-ds2/renders/hero-street.webp'],
  };
  for (const c of WORLD_CARDS) {
    assert.ok(CANDIDATES[c.id].includes(c.image), `${c.id}: ${c.image}`);
    assert.ok(existsSync(new URL(`../public/${c.image}`, import.meta.url)), c.image);
  }
});

test('(c) 로딩 화면 배경: 월드가 정해지기 전에는 이미지 없음, 정해지면 선택 화면과 같은 이미지', () => {
  const css = read('../public/src/nowhere/nowhere.css');
  const base = css.match(/\n\.nw-loader \{[^}]*\}/)?.[0];
  assert.ok(base, '.nw-loader 규칙 없음');
  assert.doesNotMatch(base, /url\(/, '월드를 고르기 전 로더에 이미지가 있음');
  for (const c of WORLD_CARDS) {
    const rule = css.match(new RegExp(`body\\[data-world-ver="${c.id}"\\] \\.nw-loader \\{[^}]*\\}`))?.[0];
    assert.ok(rule, `${c.id} 로더 규칙 없음`);
    assert.ok(rule.includes(`url('../../${c.image}')`), `${c.id} 로더 이미지가 선택 화면과 다름`);
  }
  assert.match(css, /body:not\(\[data-world-ver\]\) \.nw-loader-meta \{[^}]*visibility:\s*hidden/, '월드가 정해지기 전 로더에 성수 문구가 보임');
});

test('(d) 키: ←/→ 는 포커스(끝에서 멈춤), Enter 는 포커스된 면, 그 밖은 null', () => {
  assert.deepEqual(resolveSelectKey('ArrowRight', 0), { focus: 1 });
  assert.deepEqual(resolveSelectKey('ArrowRight', 1), { focus: 1 });
  assert.deepEqual(resolveSelectKey('ArrowLeft', 1), { focus: 0 });
  assert.deepEqual(resolveSelectKey('ArrowLeft', 0), { focus: 0 });
  assert.deepEqual(resolveSelectKey('Enter', 0), { pick: 'seongsu' });
  assert.deepEqual(resolveSelectKey('Enter', 1), { pick: 'ds2' });
  assert.equal(resolveSelectKey('KeyA', 0), null);
  assert.equal(resolveSelectKey('Escape', 1), null);
});

test('(e) main.js: 시작 결정 → 선택 화면을 렌더러 · 월드 생성보다 먼저', () => {
  const main = read('../public/src/nowhere/main.js');
  const iEntry = main.indexOf('resolveEntry(params, window.__NW_DEFAULT_WORLD)');
  const iSelect = main.indexOf('await showWorldSelect()');
  const iRenderer = main.indexOf('new THREE.WebGLRenderer(');
  const iWorld = main.indexOf('await createWorld(');
  assert.ok(iEntry > 0 && iSelect > iEntry, '시작 결정 → 선택 화면 순서');
  assert.ok(iSelect < iRenderer && iSelect < iWorld, '선택 화면이 렌더러 · 월드보다 먼저');
  assert.doesNotMatch(main, /const rawVer/);
});
