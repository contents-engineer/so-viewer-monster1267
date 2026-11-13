import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resolveEntry,
  WORLD_IDS,
  MODE_IDS,
  parsePose,
  sameSpotUrl,
  worldSwitchUrl,
  withRo,
  shiftLook,
  sameSpotLook,
  snapPose,
  liftPose,
  SAME_SPOT_FADE_MS,
  SAME_SPOT_LOOK_M,
  SAME_SPOT_SNAP_M,
  POSE_DECIMALS,
  POSE_LIMIT,
} from '../public/src/nowhere/entry.js';
import { walkPredicates, nearestFreePoint } from '../public/src/nowhere/walk-path.js';

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

// ── 같은 자리, 다른 세계(docs/superpowers/specs/2026-11-13-nowhere-same-spot-world-design.md) ──

const pub = (f) => readFileSync(new URL(`../public/${f}`, import.meta.url), 'utf8');
const BASE = 'http://localhost:4173';
const paramsOf = (href) => new URL(href, BASE).searchParams;
const pathOf = (href) => new URL(href, BASE).pathname;
const pose = (search) => parsePose(new URLSearchParams(search));

test('(g) 조정값: 어둡게 600 ms · 보행 시선 10 m 앞 · 막힌 자리 빈 자리 찾기 6 m · 소수 둘째 자리 · 장면 한계 ±2000 m', () => {
  assert.equal(SAME_SPOT_FADE_MS, 600);
  assert.equal(SAME_SPOT_LOOK_M, 10);
  assert.equal(SAME_SPOT_SNAP_M, 6);
  assert.equal(POSE_DECIMALS, 2);
  assert.equal(POSE_LIMIT, 2000);
});

test('(h) at 이 있으면 바로가기(인트로 없음, mode 가 없으면 자유 시점) — 빈 at 은 없는 것', () => {
  assert.deepEqual(at('?at=1,2,3&look=4,5,6', DEF.mountain), { select: false, world: 'ds2', intro: false, mode: 'free' });
  assert.deepEqual(at('?ver=ds2&mode=walk&at=-105.1,1.7,50.2&look=-95.1,1.7,50.2', DEF.nowhere), { select: false, world: 'ds2', intro: false, mode: 'walk' });
  assert.deepEqual(at('?ver=seongsu&mode=guide&at=1,2,3&look=4,5,6', DEF.mountain), { select: false, world: 'seongsu', intro: false, mode: 'guide' });
  assert.deepEqual(at('?at=1,2,3', DEF.index), { select: false, world: 'seongsu', intro: false, mode: 'free' }, 'at 만 있어도 바로가기(자리는 parsePose 가 따로 본다)');
  assert.deepEqual(at('?at=', DEF.index), { select: true, world: null, intro: true, mode: null });
  assert.deepEqual(at('?look=4,5,6', DEF.nowhere), { select: false, world: 'seongsu', intro: true, mode: null }, 'look 만으로는 바로가기가 아니다');
});

test('(i) parsePose: at · look 숫자 셋(장면 ±2000 m 안)만 — 하나라도 이상하거나 없으면 null(기본 시점)', () => {
  assert.deepEqual(pose('at=-105.12,1.7,50.2&look=-95.12,1.7,50.2'), { at: [-105.12, 1.7, 50.2], look: [-95.12, 1.7, 50.2] });
  assert.deepEqual(pose('at=2000,-2000,0&look=0,0,-2000'), { at: [2000, -2000, 0], look: [0, 0, -2000] }, '경계 포함');
  assert.equal(pose('at=1,2,3'), null, 'look 없음');
  assert.equal(pose('look=1,2,3'), null, 'at 없음');
  assert.equal(pose(''), null);
  assert.equal(parsePose(null), null);
  for (const bad of ['1,2', '1,2,3,4', '1,,3', 'a,2,3', '1,2,NaN', 'Infinity,0,0', '2000.01,0,0', '0,-2000.5,0', '1e9,0,0', '']) {
    assert.equal(pose(`at=${bad}&look=1,2,3`), null, `at=${bad}`);
    assert.equal(pose(`at=1,2,3&look=${bad}`), null, `look=${bad}`);
  }
});

test('(j) sameSpotUrl: 반대 월드 페이지(월드 전환과 같은 경로 규칙) + ver · mode · at · look(소수 둘째 자리), 인트로를 막는 옛 값 · 옛 자리는 지운다', () => {
  const search = '?tier=desktop&noIntro=1&cam=lot&weather=rain&time=21:30&stats=1&at=9,9,9&look=8,8,8';
  const href = sameSpotUrl({ pathname: '/nowhere', search, targetVer: 'ds2', mode: 'walk', at: [-105.123, 1.7049, 50.2051], look: [-95.126, 1.7, 50.2] });
  assert.equal(pathOf(href), '/nowhere');
  const p = paramsOf(href);
  assert.equal(p.get('ver'), 'ds2');
  assert.equal(p.get('mode'), 'walk');
  assert.equal(p.get('at'), '-105.12,1.7,50.21');
  assert.equal(p.get('look'), '-95.13,1.7,50.2');
  assert.equal(p.get('tier'), 'desktop', '그 밖의 값(tier · stats)은 그대로');
  assert.equal(p.get('stats'), '1');
  for (const k of ['noIntro', 'cam', 'weather', 'time']) assert.equal(p.has(k), false, `${k} 가 남음`);
  assert.equal(p.getAll('at').length, 1);
  assert.equal(p.getAll('look').length, 1);
  assert.match(href, /&at=-105\.12,1\.7,50\.21&look=-95\.13,1\.7,50\.2$/, '주소에서 읽기 쉽게 쉼표 그대로');
  // 경로 규칙: 산악 페이지에서 성수로는 /nowhere, 나머지는 지금 경로(.html 은 뗀다)
  const go = (pathname, targetVer) => pathOf(sameSpotUrl({ pathname, search: '', targetVer, mode: 'free', at: [0, 0, 0], look: [1, 0, 0] }));
  assert.equal(go('/nowhere-mountain', 'seongsu'), '/nowhere');
  assert.equal(go('/nowhere-mountain.html', 'seongsu'), '/nowhere');
  assert.equal(go('/nowhere.html', 'ds2'), '/nowhere');
  assert.equal(go('/', 'ds2'), '/');
  assert.equal(go('/nowhere-mountain', 'ds2'), '/nowhere-mountain');
  // 방식이 없으면 자유 시점, -0 은 0
  const free = paramsOf(sameSpotUrl({ pathname: '/', search: '', targetVer: 'seongsu', mode: null, at: [-0.001, 0, 0], look: [1, 2, 3] }));
  assert.equal(free.get('mode'), 'free');
  assert.equal(free.get('at'), '0,0,0');
  // 가이드 투어 중이었으면 자유 시점으로(카드로 투어 흐름을 벗어났다) — 위 막대 월드 버튼(worldSwitchUrl)은 가이드 그대로
  const guide = { pathname: '/nowhere', search: '', targetVer: 'ds2', mode: 'guide', at: [1, 2, 3], look: [4, 5, 6] };
  assert.equal(paramsOf(sameSpotUrl(guide)).get('mode'), 'free');
  assert.equal(paramsOf(worldSwitchUrl(guide)).get('mode'), 'guide');
  assert.equal(paramsOf(sameSpotUrl({ ...guide, mode: 'walk' })).get('mode'), 'walk');
});

test('(k) 같은 자리 주소 → 새 페이지: 인트로 없이 반대 월드 · 지금 방식, parsePose 가 반올림한 자리 그대로', () => {
  const href = sameSpotUrl({ pathname: '/nowhere', search: '?noIntro=1&cam=lot', targetVer: 'ds2', mode: 'walk', at: [-105.123, 1.7, 50.2], look: [-95.1, 1.7, 50.2] });
  const p = paramsOf(href);
  const page = pathOf(href) === '/nowhere' ? DEF.nowhere : DEF.mountain;
  assert.deepEqual(resolveEntry(p, page), { select: false, world: 'ds2', intro: false, mode: 'walk' });
  assert.deepEqual(parsePose(p), { at: [-105.12, 1.7, 50.2], look: [-95.1, 1.7, 50.2] });
  const back = sameSpotUrl({ pathname: '/nowhere-mountain', search: '?mode=free&at=1,2,3&look=4,5,6', targetVer: 'seongsu', mode: 'free', at: [10, 20, 30], look: [11, 20, 30] });
  assert.equal(pathOf(back), '/nowhere');
  assert.deepEqual(resolveEntry(paramsOf(back), DEF.nowhere), { select: false, world: 'seongsu', intro: false, mode: 'free' });
  assert.deepEqual(parsePose(paramsOf(back)), { at: [10, 20, 30], look: [11, 20, 30] });
});

test('(l) worldSwitchUrl(위 막대 월드 버튼): 경로 규칙 · 지울 값은 같고 at · look 도 지운다 — 새 월드 인트로부터(지금 그대로)', () => {
  const href = worldSwitchUrl({ pathname: '/nowhere-mountain', search: '?ver=ds2&mode=walk&noIntro=1&cam=lot&weather=rain&time=21:30&at=1,2,3&look=4,5,6&fov=30&tier=mobile', targetVer: 'seongsu', mode: 'walk' });
  assert.equal(pathOf(href), '/nowhere');
  const p = paramsOf(href);
  assert.equal(p.get('ver'), 'seongsu');
  assert.equal(p.get('mode'), 'walk');
  assert.equal(p.get('tier'), 'mobile');
  for (const k of ['noIntro', 'cam', 'weather', 'time', 'at', 'look', 'fov']) assert.equal(p.has(k), false, `${k} 가 남음`);   // fov = 사진 링크 화각(새 월드는 기본 화각)
  assert.deepEqual(resolveEntry(p, DEF.nowhere), { select: false, world: 'seongsu', intro: true, mode: 'walk' });
  assert.equal(parsePose(p), null);
  assert.equal(paramsOf(worldSwitchUrl({ pathname: '/', search: '', targetVer: 'ds2', mode: null })).get('mode'), 'free');
  assert.equal(pathOf(worldSwitchUrl({ pathname: '/nowhere.html', search: '', targetVer: 'ds2', mode: 'free' })), '/nowhere');
  // sameSpotUrl 은 같은 주소에 at · look 만 더한다
  const same = sameSpotUrl({ pathname: '/nowhere', search: '?tier=mobile', targetVer: 'ds2', mode: 'free', at: [1, 2, 3], look: [4, 5, 6] });
  assert.equal(same, `${worldSwitchUrl({ pathname: '/nowhere', search: '?tier=mobile', targetVer: 'ds2', mode: 'free' })}&at=1,2,3&look=4,5,6`);
});

test('(m) withRo: 받침이 없거나 ㄹ 받침이면 「로」, 다른 받침이면 「으로」 — 숫자 · 로마자는 우리말 읽기로(2041 → 일, 3 → 삼)', () => {
  assert.equal(withRo('성수 2041'), '성수 2041로');
  assert.equal(withRo('DS2 산악'), 'DS2 산악으로');
  assert.equal(withRo('서울'), '서울로');
  assert.equal(withRo('바다'), '바다로');
  assert.equal(withRo('부산'), '부산으로');
  for (const [n, ro] of [['0', '으로'], ['1', '로'], ['2', '로'], ['3', '으로'], ['4', '로'], ['5', '로'], ['6', '으로'], ['7', '로'], ['8', '로'], ['9', '로']]) assert.equal(withRo(`B${n}`), `B${n}${ro}`, n);
  assert.equal(withRo('ROOM'), 'ROOM으로');
  assert.equal(withRo('PLAN'), 'PLAN으로');
  assert.equal(withRo('HAUS'), 'HAUS로');
  assert.equal(withRo('HALL'), 'HALL로');
  // 위 막대 월드 버튼 글자 그대로(세 페이지 모두)
  for (const name of ['index.html', 'nowhere.html', 'nowhere-mountain.html']) {
    const html = pub(name);
    assert.match(html, /data-world-ver="seongsu">성수 2041</, name);
    assert.match(html, /data-world-ver="ds2">DS2 산악</, name);
  }
});

test('(n) 카드 버튼: 「이 자리 그대로 <반대 월드>로」(닫기 다음 — 한 줄 전체), 누르면 onSameSpot()', () => {
  const src = pub('src/nowhere/archive-card.js');
  assert.match(src, /import \{ withRo \} from '\.\/entry\.js';/);
  assert.match(src, /export function createArchiveCard\(\{[^}]*onDetail, sameSpotWorld[^}]*onSameSpot[^}]*\}\)/);
  // 월드 이름 안에서는 줄을 나누지 않는다(낮은 화면에서 두 줄 글자가 「이 자리 그대로 / DS2 산악으로」로 나뉘게 — 빈칸 → U+00A0)
  assert.match(src, /el\('button', 'nw-btn nw-archive-same', `이 자리 그대로 \$\{withRo\(sameSpotWorld\)\.replace\(\/ \/g, '\\u00a0'\)\}`\)/);
  assert.match(src, /actions\.append\(detailBtn, closeBtn, sameBtn\)|actions\.append\(detailBtn, closeBtn\);\s*if \(sameBtn\) actions\.append\(sameBtn\);/);
  assert.match(src, /sameBtn\.addEventListener\('click', \(\) => \{\s*sameBtn\.blur\(\);\s*if \(openId\) onSameSpot\(\);/);
  const css = pub('src/nowhere/nowhere.css');
  assert.match(css, /\n\.nw-archive-actions \{[^}]*flex-wrap: wrap;/);
  assert.match(css, /\n\.nw-archive-same \{[^}]*flex: 1 0 100%;/);
  // 낮은 화면(가로 휴대폰 844 × 390 — 카드 높이 170 px): 세 버튼 한 줄(같은 자리 버튼은 두 줄 글자) — 버튼 두 줄이 카드 내용(제목)을 밀어내지 않게
  assert.match(css, /@media \(max-height: 500px\) \{\s*\.nw-archive-same \{\s*flex: 1 1 0;/);
  assert.ok(css.indexOf('@media (max-height: 500px) {\n  .nw-archive-same') > css.indexOf('\n.nw-archive-same {'), '기본 규칙보다 뒤');
});

test('(o) main 연결: 카드 → 어둡게(<지금> → <반대>, SAME_SPOT_FADE_MS) → sameSpotUrl(보행은 시선 10 m 앞), 시작 흐름은 방식 적용 뒤 보행 placeWalk · 그 밖 placeAt, 위 막대 월드 버튼은 worldSwitchUrl', () => {
  const main = pub('src/nowhere/main.js');
  assert.match(main, /import \{[^}]*resolveEntry[^}]*parsePose[^}]*sameSpotUrl[^}]*worldSwitchUrl[^}]*shiftLook[^}]*sameSpotLook[^}]*snapPose[^}]*liftPose[^}]*SAME_SPOT_FADE_MS[^}]*SAME_SPOT_SNAP_M[^}]*\} from '\.\/entry\.js';/);
  assert.match(main, /import \{[^}]*walkPredicates[^}]*nearestFreePoint[^}]*\} from '\.\/walk-path\.js';/);
  assert.match(main, /import \{ createCameraController, ORBIT_CLEARANCE \} from '\.\/camera\.js';/);
  const make = main.match(/const archive = createArchiveCard\(\{[\s\S]*?\n  \}\);/)[0];
  assert.match(make, /sameSpotWorld: otherWorldLabel,/);
  assert.match(make, /onSameSpot: \(\) => goSameSpot\(\),/);
  assert.match(main, /const otherWorldVer = WORLD_IDS\.find\(\(id\) => id !== worldVer\);/);
  assert.match(main, /const otherWorldLabel = document\.querySelector\(`\.nw-world-switch \[data-world-ver="\$\{otherWorldVer\}"\]`\)\?\.textContent\.trim\(\)/);
  const go = main.slice(main.indexOf('async function goSameSpot()'), main.indexOf('\n  }\n', main.indexOf('async function goSameSpot()')));
  assert.match(go, /await fade\.fadeTo\(true, `\$\{hubWorldLabel\} → \$\{otherWorldLabel\}`, SAME_SPOT_FADE_MS\);/);
  assert.match(go, /const look = sameSpotLook\(at, camCtrl\.controls\.target\.toArray\(\), camCtrl\.isWalkMode\(\)\);/);
  assert.match(go, /const here = \{ pathname: window\.location\.pathname, search: window\.location\.search, mode: modes\.get\(\), at, look \};/);
  // 뒤로 가기: 지금 주소를 이 월드 같은 자리 주소로 바꿔 둔다(bfcache 가 없어도 인트로가 아니라 이 자리로) — 그다음 반대 월드로
  assert.match(go, /history\.replaceState\(history\.state, '', sameSpotUrl\(\{ \.\.\.here, targetVer: worldVer \}\)\);/);
  assert.match(go, /window\.location\.href = sameSpotUrl\(\{ \.\.\.here, targetVer: otherWorldVer \}\);/);
  assert.ok(go.indexOf('const here') < go.indexOf('history.replaceState') && go.indexOf('history.replaceState') < go.indexOf('window.location.href'), '지금 주소는 바꾸기 전에 읽는다');
  assert.ok(go.indexOf('fadeTo') < go.indexOf('camera.position.toArray()'), '자리는 다 어두워진 뒤 마지막 화면 그대로 적는다');
  // 시작 흐름: 방식 적용 뒤 자리
  const run = main.slice(main.indexOf('async function runEntry()'), main.indexOf('function startScenario('));
  assert.match(main, /const pose = parsePose\(params\);/);
  assert.ok(run.indexOf('modes.set(mode)') < run.indexOf('if (pose)'), '방식을 적용한 뒤 자리로 놓는다');
  // 보행: 이 월드에서 막힌 자리면 SAME_SPOT_SNAP_M 안 가장 가까운 빈 자리로(시선 목표도 같이 옮김), 지면 + 눈높이로 선 뒤
  // 시선 목표를 눈높이 차만큼 옮겨 다시 겨눈다(위아래 각 그대로). 자유 시점: 지면 위 여유고 아래면 올리고 시선 목표도 같은 만큼(위아래 각 그대로)
  const place = run.slice(run.indexOf('if (pose)'));
  assert.match(place, /if \(camCtrl\.isWalkMode\(\)\) \{\s*const \{ isFree \} = walkPredicates\(camCtrl\.getWalkContext\(\)\);\s*const p = snapPose\(pose, nearestFreePoint\(pose\.at\[0\], pose\.at\[2\], isFree, SAME_SPOT_SNAP_M\)\);/);
  assert.match(place, /camCtrl\.placeWalk\(p\.at\[0\], p\.at\[2\], p\.look\);[^\n]*\s*camCtrl\.placeWalk\(p\.at\[0\], p\.at\[2\], shiftLook\(p\.look, p\.at\[1\], camera\.position\.y\)\);/);
  assert.match(place, /\} else \{\s*const p = liftPose\(pose, camCtrl\.getWalkContext\(\)\.groundHeightAt\(pose\.at\[0\], pose\.at\[2\]\) \+ ORBIT_CLEARANCE\);\s*camCtrl\.placeAt\(p\.at, p\.look\);/);
  // camera.js 여유고를 한곳에서(같은 상수로 clampAboveGround)
  const cam = pub('src/nowhere/camera.js');
  assert.match(cam, /export const ORBIT_CLEARANCE = 1\.2;/);
  assert.match(cam, /clampAboveGround\(camera\.position, groundHeightAt, ORBIT_CLEARANCE\)/);
  // 위 막대 월드 버튼: 경로 규칙만 공유(at · look 없음 — 인트로 그대로)
  const swAt = main.indexOf("document.querySelectorAll('.nw-world-switch [data-world-ver]')");
  const sw = main.slice(swAt, main.indexOf('\n  });\n', swAt));
  assert.match(sw, /window\.location\.href = worldSwitchUrl\(\{ pathname: window\.location\.pathname, search: window\.location\.search, targetVer, mode: modes\.get\(\) \}\);/);
  assert.doesNotMatch(sw, /sameSpotUrl|nextParams/);
  // 뒤로 가기로 돌아온 페이지(bfcache)는 어두운 채 남지 않는다
  assert.match(main, /window\.addEventListener\('pageshow', \(e\) => \{\s*if \(!e\.persisted \|\| !sameSpotGoing\) return;/);
});

test('(q) shiftLook: 보행 시선 목표를 눈높이 차만큼 위아래로 옮긴다 — 지면 높이가 달라도 시선 방향(위아래 각 포함) 그대로', () => {
  const s1 = shiftLook([10, 5, -3], 4.05, 1.7);
  assert.equal(s1[0], 10);
  assert.ok(Math.abs(s1[1] - 2.65) < 1e-9, `y ${s1[1]}`);
  assert.equal(s1[2], -3);
  assert.deepEqual(shiftLook([1, 2, 3], 1.7, 1.7), [1, 2, 3]);
  assert.deepEqual(shiftLook([1, 2, 3], 0, 2.5), [1, 4.5, 3]);
  // 각도 보존: 옛 눈 → 옛 목표와 새 눈 → 새 목표의 위아래 각이 같다
  const at = [-60.37, 4.05, 20.41];
  const look = [-51.09, 4.8, 16.76];
  const eye = [at[0], 1.7, at[2]];
  const pitch = (from, to) => Math.atan2(to[1] - from[1], Math.hypot(to[0] - from[0], to[2] - from[2]));
  assert.ok(Math.abs(pitch(eye, shiftLook(look, at[1], eye[1])) - pitch(at, look)) < 1e-12);
  const before = [1, 2, 3];
  shiftLook(before, 0, 1);
  assert.deepEqual(before, [1, 2, 3], '입력 배열은 그대로');
});

test('(p) 문서: README 에 같은 자리 버튼 · at/look 주소 · look 이 없을 때도 기본 시점 · 가이드 투어는 자유 시점으로', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /「이 자리 그대로 DS2 산악으로」 · 「이 자리 그대로 성수 2041로」/);
  assert.match(readme, /`at=x,y,z&look=x,y,z`/);
  assert.match(readme, /look 이 없을 때도 기본 시점/);
  assert.match(readme, /가이드 투어 중이었으면 자유 시점으로/);
  const spec = readFileSync(new URL('../docs/superpowers/specs/2026-11-13-nowhere-same-spot-world-design.md', import.meta.url), 'utf8');
  assert.match(spec, /가이드 투어 중이었으면 자유 시점으로/);
});

test('(r) sameSpotLook: 자유 시점은 시선 목표 그대로, 보행은 시선 방향으로 SAME_SPOT_LOOK_M 앞 점(위아래 포함)', () => {
  assert.deepEqual(sameSpotLook([1, 2, 3], [4, 5, 6], false), [4, 5, 6]);
  const w = sameSpotLook([0, 1.7, 0], [0, 1.7, 2.5], true);
  assert.deepEqual(w.map((v) => +v.toFixed(9)), [0, 1.7, 10]);
  // 브라우저 측정 자리(성수 FaceArch 앞 보행 — 보행 목표는 시선 2.5 m 앞) → 주소 look=89.95,5.11,5.3
  const eye = [84.4371, 1.6998049263376742, 12.9183];
  const up = sameSpotLook(eye, [85.81441966783261, 2.5512292326671333, 11.01355141207747], true);
  assert.ok(Math.abs(Math.hypot(up[0] - eye[0], up[1] - eye[1], up[2] - eye[2]) - SAME_SPOT_LOOK_M) < 1e-9);
  assert.deepEqual(up.map((v) => +v.toFixed(2)), [89.95, 5.11, 5.3]);
  const pos = [1, 2, 3];
  const tgt = [4, 5, 6];
  sameSpotLook(pos, tgt, true);
  sameSpotLook(pos, tgt, false).push(0);
  assert.deepEqual([pos, tgt], [[1, 2, 3], [4, 5, 6]], '입력 배열은 그대로');
});

test('(s) snapPose: 이 월드에서 막힌 자리면 빈 자리(nearestFreePoint — SAME_SPOT_SNAP_M 안)로 옮기고 시선 목표도 같은 dx · dz, 빈 자리가 없거나 비어 있으면 그대로', () => {
  const pose = { at: [10, 1.7, 20], look: [15, 3, 25] };
  assert.deepEqual(snapPose(pose, { x: 12.5, z: 19 }), { at: [12.5, 1.7, 19], look: [17.5, 3, 24] });
  assert.deepEqual(snapPose(pose, null), pose);
  assert.deepEqual(snapPose(pose, { x: 10, z: 20 }), pose);
  // 보행 판정 그대로: x < 12 가 막힌 벽이면 6 m 안 가장 가까운 빈 칸(x = 12)으로, 6 m 밖이면 null → 그대로
  const blocker = { isBlocked: (x) => x < 12 };
  const { isFree } = walkPredicates({ groundHeightAt: () => 0, blocker });
  const p = snapPose(pose, nearestFreePoint(pose.at[0], pose.at[2], isFree, SAME_SPOT_SNAP_M));
  assert.deepEqual(p, { at: [12, 1.7, 20], look: [17, 3, 25] });
  const far = { at: [0, 1.7, 0], look: [1, 1.7, 0] };
  assert.equal(nearestFreePoint(0, 0, isFree, SAME_SPOT_SNAP_M), null);
  assert.deepEqual(snapPose(far, nearestFreePoint(0, 0, isFree, SAME_SPOT_SNAP_M)), far);
});

test('(t) liftPose: 자유 시점 카메라가 이 월드 지면 + 여유고(minY) 아래면 그 높이로 올리고 시선 목표도 같은 만큼 — 위아래 각 그대로', () => {
  // 리뷰 사례: DS2 (-60.37, 20.41) 지면 ≈ 2.35, 성수에서 1.7 m 높이 수평 시선
  const pose = { at: [-60.37, 1.7, 20.41], look: [-50.37, 1.7, 20.41] };
  const minY = 2.35 + 1.2;
  const p = liftPose(pose, minY);
  assert.deepEqual(p.at, [-60.37, minY, 20.41]);
  assert.ok(Math.abs(p.look[1] - minY) < 1e-9);
  const pitch = (q) => Math.atan2(q.look[1] - q.at[1], Math.hypot(q.look[0] - q.at[0], q.look[2] - q.at[2]));
  assert.ok(Math.abs(pitch(p) - pitch(pose)) < 1e-12);
  assert.deepEqual(liftPose(pose, 1.0), pose, '이미 위면 그대로');
  assert.deepEqual(liftPose(pose, 1.7), pose);
});
