import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveEntry, WORLD_IDS, MODE_IDS } from '../public/src/nowhere/entry.js';

const page = (name) => readFileSync(new URL(`../public/${name}`, import.meta.url), 'utf8');
const pageDefault = (html) => html.match(/window\.__NW_DEFAULT_WORLD\s*=\s*'([a-z0-9]+)'/)?.[1];
const DEF = {
  index: pageDefault(page('index.html')),
  nowhere: pageDefault(page('nowhere.html')),
  mountain: pageDefault(page('nowhere-mountain.html')),
};
const at = (search, def) => resolveEntry(new URLSearchParams(search), def);

test('(a) 페이지 기본 월드: / 는 없음 · /nowhere 는 성수 · /nowhere-mountain 은 산악, 로더 배경용 body[data-world-ver] 도 같게', () => {
  assert.equal(DEF.index, undefined);
  assert.equal(DEF.nowhere, 'seongsu');
  assert.equal(DEF.mountain, 'ds2');
  assert.match(page('index.html'), /<body>/);
  assert.match(page('nowhere.html'), /<body data-world-ver="seongsu">/);
  assert.match(page('nowhere-mountain.html'), /<body data-world-ver="ds2">/);
  assert.deepEqual(WORLD_IDS, ['seongsu', 'ds2']);
  assert.deepEqual(MODE_IDS, ['guide', 'walk', 'free']);
});

test('(b) 일반 주소 / 는 월드 선택 화면 → 고른 뒤 인트로 · 방식 고르기', () => {
  assert.deepEqual(at('', DEF.index), { select: true, world: null, intro: true, mode: null });
});

test('(c) 월드별 바로가기는 선택 화면 없이 인트로 → 방식 고르기', () => {
  assert.deepEqual(at('', DEF.nowhere), { select: false, world: 'seongsu', intro: true, mode: null });
  assert.deepEqual(at('', DEF.mountain), { select: false, world: 'ds2', intro: true, mode: null });
  assert.deepEqual(at('?ver=ds2', DEF.index), { select: false, world: 'ds2', intro: true, mode: null });
  assert.deepEqual(at('?ver=seongsu', DEF.index), { select: false, world: 'seongsu', intro: true, mode: null });
  assert.deepEqual(at('?ver=seongsu', DEF.mountain), { select: false, world: 'seongsu', intro: true, mode: null }, 'ver 가 페이지 기본보다 먼저');
});

test('(d) 바로가기 링크(cam · weather · time)와 noIntro=1 은 지금처럼 인트로 없이 자유 시점', () => {
  const FREE = (world) => ({ select: false, world, intro: false, mode: 'free' });
  assert.deepEqual(at('?cam=future', DEF.index), FREE('seongsu'));
  assert.deepEqual(at('?noIntro=1&cam=future', DEF.nowhere), FREE('seongsu'));
  assert.deepEqual(at('?weather=rain', DEF.index), FREE('seongsu'));
  assert.deepEqual(at('?time=21:30', DEF.mountain), FREE('ds2'));
  assert.deepEqual(at('?ver=ds2&noIntro=1&cam=lot&weather=rain&time=21:30', DEF.index), FREE('ds2'));
  assert.deepEqual(at('?noIntro=1', DEF.index), FREE('seongsu'));
  assert.deepEqual(at('?noIntro=1', DEF.mountain), FREE('ds2'));
});

test('(e) mode 매개변수: 월드 전환 주소(?ver=…&noIntro=1&mode=…)는 그 방식으로 바로, 인트로가 있으면 인트로 뒤 그 방식', () => {
  assert.deepEqual(at('?ver=ds2&noIntro=1&mode=walk', DEF.index), { select: false, world: 'ds2', intro: false, mode: 'walk' });
  assert.deepEqual(at('?ver=seongsu&noIntro=1&mode=guide', DEF.mountain), { select: false, world: 'seongsu', intro: false, mode: 'guide' });
  assert.deepEqual(at('?mode=free', DEF.index), { select: false, world: 'seongsu', intro: true, mode: 'free' });
  assert.deepEqual(at('?cam=aerial&mode=walk', DEF.index), { select: false, world: 'seongsu', intro: false, mode: 'walk' });
});

test('(f) 잘못된 ver · mode · noIntro 값과 빈 값은 없는 것으로 본다', () => {
  const SELECT = { select: true, world: null, intro: true, mode: null };
  assert.deepEqual(at('?ver=moon', DEF.index), SELECT);
  assert.deepEqual(at('?ver=moon', DEF.nowhere), { select: false, world: 'seongsu', intro: true, mode: null });
  assert.deepEqual(at('?mode=fly', DEF.index), SELECT);
  assert.deepEqual(at('?ver=ds2&mode=fly', DEF.index), { select: false, world: 'ds2', intro: true, mode: null });
  assert.deepEqual(at('?noIntro=0', DEF.index), SELECT);
  assert.deepEqual(at('?cam=', DEF.index), SELECT);
  assert.deepEqual(resolveEntry(new URLSearchParams(''), 'mars'), SELECT);
  assert.deepEqual(resolveEntry(null, 'ds2'), { select: false, world: 'ds2', intro: true, mode: null });
});
