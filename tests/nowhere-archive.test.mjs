import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  BUILDING_IDS, BUILDING_RECORDS, BUILDING_TAG_RANGE, BUILDING_TAG_LIFT, CARD_KEEP_RANGE, CLICK_SLOP, PART_EXCLUDE, ARCHITECTURE_CRUMBS,
  worldToBuilding, buildingItem, buildingCollection, buildingParts, cardBuildingForSpot, tagVisible,
} from '../public/src/nowhere/archive.js';
import { buildingToWorld } from '../public/src/nowhere/tour-config.js';
import { stepItem, validateCatalog } from '../public/src/nowhere/products.js';
import { exteriorSpots, interiorSpots } from '../public/src/nowhere/walk-spots.js';

const PUB = new URL('../public/', import.meta.url);
const readJson = (p) => JSON.parse(readFileSync(new URL(p, PUB), 'utf8'));
const records = { haus: readJson('assets/record.json'), facearch: readJson('assets/facearch.json') };
const layouts = ['nowhere', 'nowhere-ds2'].map((v) => [v, readJson(`assets/${v}/layout.json`)]);
const seongsu = layouts[0][1];
const heroUrls = { haus: 'assets/gm_building.glb', facearch: 'assets/facearch.glb' };
const HINT = '드래그 · 한 손가락 회전 · 휠 · 두 손가락 확대 · ← → 다른 건물 · Esc 나가기';

test('(a) 값: 두 건물 순서 · 기록 파일 · 이름표 · 카드 · 클릭 거리 · 뺄 부위 · 경로 앞부분', () => {
  assert.deepEqual(BUILDING_IDS, ['haus', 'facearch']);
  assert.deepEqual(BUILDING_RECORDS, { haus: 'assets/record.json', facearch: 'assets/facearch.json' });
  for (const p of Object.values(BUILDING_RECORDS)) assert.ok(existsSync(new URL(p, PUB)), `${p} 없음`);
  assert.equal(BUILDING_TAG_RANGE, 220);
  assert.equal(BUILDING_TAG_LIFT, 4);
  assert.equal(CARD_KEEP_RANGE, 260);
  assert.ok(CARD_KEEP_RANGE > BUILDING_TAG_RANGE, '이름표로 연 카드가 바로 닫히지 않게');
  assert.equal(CLICK_SLOP, 5);
  const retail = readFileSync(new URL('src/nowhere/retail-display.js', PUB), 'utf8');
  assert.match(retail, new RegExp(`const CLICK_SLOP = ${CLICK_SLOP};`), 'retail 과 같은 값');
  assert.deepEqual(PART_EXCLUDE, ['haus_garden']);
  assert.deepEqual(ARCHITECTURE_CRUMBS, ['SUPREME ORIGIN', 'Architecture']);
});

test('(b) 건물 항목: 기록 파일 값 그대로(kicker ARCHITECTURE · index, 경로 SUPREME ORIGIN > Architecture > title, facts → 행, note), 한 단계 모델', () => {
  assert.deepEqual(buildingItem('haus', records.haus, heroUrls.haus), {
    id: 'haus',
    name: 'HAUS NOWHERE SEOUL',
    kicker: 'ARCHITECTURE · 0001',
    crumbs: ['SUPREME ORIGIN', 'Architecture', 'HAUS NOWHERE SEOUL'],
    rows: records.haus.facts.map(([label, value]) => ({ label, value })),
    note: records.haus.note,
    liteUrl: 'assets/gm_building.glb',
    hiUrl: null,
  });
  const face = buildingItem('facearch', records.facearch, heroUrls.facearch);
  assert.equal(face.name, 'FaceArch');
  assert.equal(face.kicker, 'ARCHITECTURE · 0002');
  assert.deepEqual(face.crumbs, ['SUPREME ORIGIN', 'Architecture', 'FaceArch']);
  assert.deepEqual(face.rows[0], { label: '규모', value: '22 × 18 m, 높이 31 m' });
  assert.equal(face.rows.length, records.facearch.facts.length);
  assert.equal(face.note, records.facearch.note);
  assert.equal(face.hiUrl, null);
  // 기록이 note 를 빼면 빈 문자열(패널이 그 줄을 숨긴다)
  const { note, ...noNote } = records.haus;
  assert.equal(buildingItem('haus', noNote, heroUrls.haus).note, '');
});

test('(c) 건물 목록: kind building · BUILDING_IDS 순서(기록 · 모델 주소가 있는 것만) · 안내 한 줄, 이전 · 다음은 HAUS → FaceArch → HAUS', () => {
  const reversed = { facearch: records.facearch, haus: records.haus };
  const c = buildingCollection(reversed, heroUrls, 'facearch');
  assert.equal(c.kind, 'building');
  assert.deepEqual(c.items.map((i) => i.id), ['haus', 'facearch']);
  assert.deepEqual(c.items[0], buildingItem('haus', records.haus, heroUrls.haus));
  assert.equal(c.startId, 'facearch');
  assert.equal(c.hint, HINT);
  assert.equal('loadLite' in c, false, '무대 로더가 item.liteUrl 을 받는다');
  assert.equal(stepItem(c.items, 'haus', 1), 'facearch');
  assert.equal(stepItem(c.items, 'facearch', 1), 'haus');
  assert.equal(stepItem(c.items, 'haus', -1), 'facearch');
  // 기록이나 모델 주소가 없는 건물은 뺀다
  assert.deepEqual(buildingCollection({ haus: records.haus }, heroUrls, 'haus').items.map((i) => i.id), ['haus']);
  assert.deepEqual(buildingCollection(records, { facearch: heroUrls.facearch }, 'facearch').items.map((i) => i.id), ['facearch']);
});

test('(d) 월드 → 건물 로컬: buildingToWorld 의 역(두 월드 × 두 건물 왕복 오차 < 1e-9), 건물이 없으면 null', () => {
  const pts = [[0, 0, 0], [12.5, 3, -7.25], [-30, 81, 26], [103.741, 16.584, -5.914]];
  for (const [ver, L] of layouts) {
    for (const id of BUILDING_IDS) {
      for (const p of pts) {
        const w = buildingToWorld(L, id, p);
        const back = worldToBuilding(L, id, w);
        back.forEach((v, i) => assert.ok(Math.abs(v - p[i]) < 1e-9, `${ver} ${id} ${p} → ${back}`));
        const again = buildingToWorld(L, id, worldToBuilding(L, id, p));
        again.forEach((v, i) => assert.ok(Math.abs(v - p[i]) < 1e-9, `${ver} ${id} 반대 방향 ${p}`));
      }
    }
    // 건물 자리 = 로컬 원점
    assert.deepEqual(worldToBuilding(L, 'facearch', L.buildings.facearch.pos).map((v) => Math.round(v * 1e9) / 1e9), [0, 0, 0]);
  }
  assert.equal(worldToBuilding(seongsu, 'nope', [0, 0, 0]), null);
  assert.equal(worldToBuilding(null, 'haus', [0, 0, 0]), null);
});

test('(e) 부위: 두 월드 모두 6 개(HAUS 포디움 · 타워 · 크라운, FaceArch 몸체 · 눈 · 다리 — 전정 haus_garden 은 뺀다), 문구는 anchors 그대로, 로컬 좌표는 그 건물 경계 안', () => {
  const MARGIN = 0.5;   // m — 표지는 외벽 면에 붙어 있다(HAUS 포디움 · 크라운 z 26 은 경계 25.9 바로 바깥)
  const solid = (id) => seongsu.solids.find((s) => s.id === id);
  const bounds = { haus: solid('HAUS'), facearch: solid('FACEARCH') };
  for (const [ver, L] of layouts) {
    const all = [];
    for (const id of BUILDING_IDS) {
      const title = records[id].title;
      const parts = buildingParts(L, id, title);
      all.push(...parts);
      assert.deepEqual(parts.map((p) => p.id).sort(), id === 'haus' ? ['haus_crown', 'haus_podium', 'haus_tower'] : ['facearch_body', 'facearch_eyes', 'facearch_legs'], `${ver} ${id}`);
      for (const p of parts) {
        const a = L.anchors.find((x) => x.id === p.id);
        assert.equal(a.layer, 'building');
        assert.equal(p.title, a.title);
        assert.equal(p.lore, a.lore);
        assert.deepEqual(p.rows, a.facts.map(([label, value]) => ({ label, value })));
        assert.equal(p.kicker, `${title} · PART`);
        // 로컬 → 월드 = anchors pos
        buildingToWorld(L, id, p.local).forEach((v, i) => assert.ok(Math.abs(v - a.pos[i]) < 1e-9, `${ver} ${p.id} 왕복`));
        // 성수 layout 의 건물 자리에 놓으면 그 건물 solids 상자 안(두 월드 모두 같은 자리의 같은 건물)
        const w = buildingToWorld(seongsu, id, p.local);
        const b = bounds[id];
        for (let i = 0; i < 3; i++) {
          assert.ok(w[i] >= b.min[i] - MARGIN && w[i] <= b.max[i] + MARGIN, `${ver} ${p.id} 축 ${i}: ${w[i]} 가 ${b.min[i]}…${b.max[i]} 밖`);
        }
      }
    }
    assert.equal(all.length, 6, ver);
    assert.ok(!all.some((p) => PART_EXCLUDE.includes(p.id)), `${ver}: 전정은 빠진다`);
    assert.ok(L.anchors.some((a) => a.id === 'haus_garden' && a.layer === 'building'), `${ver}: 전정 anchor 는 파일에 있다(빼는 것을 확인)`);
  }
  assert.deepEqual(buildingParts(seongsu, 'nope', 'X'), []);
});

test('(f) 카드 트리거: 외관 건물 view 스팟 도착 → 그 건물, 정문(entrance) · 실내 · 제품 스팟은 카드 없음', () => {
  for (const [ver, L] of layouts) {
    const spots = exteriorSpots(L);
    assert.ok(spots.length > 0);
    for (const s of spots) {
      const want = s.kind === 'view' ? s.building : null;
      assert.equal(cardBuildingForSpot(s), want, `${ver} ${s.id}`);
    }
    assert.equal(cardBuildingForSpot(spots.find((s) => s.id === 'haus_entrance')), null, '정문은 입장 질문');
    assert.equal(cardBuildingForSpot(spots.find((s) => s.id === 'face_front')), 'facearch');
    assert.equal(cardBuildingForSpot(spots.find((s) => s.id === 'haus_garden')), 'haus');
  }
  const inner = readJson('assets/nowhere-inner/inner-layout.json');
  const catalog = validateCatalog(readJson('assets/products/products.json'));
  const insideSpots = interiorSpots(inner.floors.find((f) => f.id === '1'), catalog);
  assert.ok(insideSpots.some((s) => s.kind === 'view') && insideSpots.some((s) => s.kind === 'product'));
  for (const s of insideSpots) assert.equal(cardBuildingForSpot(s), null, s.id);
});

test('(g) 건물 이름표 보이기: 220 m 안(경계 포함)이고 화면 안(NDC x · y −1…1, z −1 < z < 1 — 카메라 뒤 · far 밖 제외)', () => {
  const ok = { distance: 100, ndc: [0, 0, 0.5] };
  assert.equal(tagVisible(ok), true);
  assert.equal(tagVisible({ ...ok, distance: BUILDING_TAG_RANGE }), true);
  assert.equal(tagVisible({ ...ok, distance: BUILDING_TAG_RANGE + 0.01 }), false);
  for (const ndc of [[1, 1, 0.9], [-1, -1, -0.9], [0.99, -0.99, 0]]) assert.equal(tagVisible({ ...ok, ndc }), true, String(ndc));
  for (const ndc of [[1.01, 0, 0.5], [0, -1.01, 0.5], [0, 0, 1], [0, 0, -1], [0, 0, 1.2]]) assert.equal(tagVisible({ ...ok, ndc }), false, String(ndc));
});

// ── Task 2: 건물 이름표 · 아카이브 카드 · 고르기 · 건물 감상 열기(연결 정규식) ──
const SRC = new URL('src/nowhere/', PUB);
const read = (f) => readFileSync(new URL(f, SRC), 'utf8');
const fnBody = (src, head) => {
  const m = src.match(new RegExp(`${head.replace(/[()]/g, '\\$&')} \\{[\\s\\S]*?\\n  \\}\\n`));
  assert.ok(m, `${head} 를 찾지 못함`);
  return m[0];
};

test('(h) 이름표 자리: 경계 상자 윗면 가운데 + BUILDING_TAG_LIFT', async () => {
  const { tagAnchor } = await import('../public/src/nowhere/archive.js');
  assert.deepEqual(tagAnchor({ min: { x: -25, y: 0, z: -26 }, max: { x: 25, y: 81, z: 26 } }), [0, 81 + BUILDING_TAG_LIFT, 0]);
  assert.deepEqual(tagAnchor({ min: { x: 90, y: -1, z: -30 }, max: { x: 120, y: 31, z: 0 } }), [105, 31 + BUILDING_TAG_LIFT, -15]);
});

test('(i) 월드: 두 건물 루트를 배치한 직후(processRoot 병합 전) 월드 경계 상자를 재서 buildingBoxes 로 돌려준다', () => {
  const w = read('world.js');
  assert.match(w, /hausRoot\.rotation\.y = [^\n]*\n[\s\S]*?new THREE\.Box3\(\)\.setFromObject\(hausRoot\)[\s\S]*?processRoot\(hausRoot, /);
  assert.match(w, /facearchRoot\.rotation\.y = [^\n]*\n[\s\S]*?new THREE\.Box3\(\)\.setFromObject\(facearchRoot\)[\s\S]*?processRoot\(facearchRoot, /);
  assert.match(w, /buildingBoxes,?\s/);
  assert.match(w, /return \{[\s\S]*buildings: \{ haus: hausRoot, facearch: facearchRoot \},\s*buildingBoxes,/);
});

test('(j) 카드 모듈: 기록 두 파일을 한 번 받고, 이름표(<title> · 기록 보기) · 카드(kicker · 제목 · facts · note · 자세히 보기 · 닫기) · 자유 시점 클릭 · Esc · 멀어지면 닫기', () => {
  const src = read('archive-card.js');
  assert.match(src, /export function createArchiveCard\(\{ camera, canvas, quality, getBoxes, isSuspended[^}]*isWalking[^}]*onDetail[^}]*\}\)/);
  // 기록: BUILDING_RECORDS 를 한 번(fetch) — 실패한 건물은 빠진다
  assert.match(src, /BUILDING_IDS\.map\(\(id\) =>\s*fetch\(BUILDING_RECORDS\[id\]\)/);
  assert.match(src, /buildingItem\(id, /);
  // 이름표: <title> · 기록 보기, 자리 = tagAnchor, 보이기 = tagVisible, 누르면 카드, 멈춤이면 모두 숨김
  assert.match(src, /'nw-archive-tag'/);
  assert.match(src, /'기록 보기'/);
  assert.match(src, /' · '/);
  assert.match(src, /tagAnchor\(/);
  assert.match(src, /tagVisible\(\{ distance[^}]*ndc[^}]*\}\)/);
  assert.match(src, /if \(suspended\) \{?\s*tagsRoot\.hidden = true/);
  // 카드: 감상 패널과 같은 내용 순서, 버튼 두 개
  assert.match(src, /'nw-archive-card'/);
  assert.match(src, /kicker\.textContent = item\.kicker/);
  assert.match(src, /title\.textContent = item\.name/);
  assert.match(src, /item\.rows\.flatMap/);
  assert.match(src, /note\.hidden = !item\.note/);
  assert.match(src, /'자세히 보기'/);
  assert.match(src, /'닫기'/);
  assert.match(src, /onDetail\(openId\)|onDetail\(id\)/);
  // 자유 시점 클릭: 캡처 단계 pointerdown · click, 보행 · 멈춤 · 끌기면 그대로 두고, 광선이 건물 경계 상자에 맞으면 가까운 건물
  assert.match(src, /canvas\.addEventListener\(\s*'pointerdown',[\s\S]*?true,?\s*\)/);
  const click = src.match(/canvas\.addEventListener\(\s*'click',[\s\S]*?\n    true,?\s*\n  \);/);
  assert.ok(click, '캔버스 click 캡처 처리기 없음');
  assert.match(click[0], /isWalking\(\) \|\| isSuspended\(\)/);
  assert.match(click[0], /> CLICK_SLOP\) return/);
  assert.match(click[0], /raycaster\.setFromCamera\(/);
  assert.match(click[0], /intersectBox\(/);
  assert.doesNotMatch(click[0], /stopImmediatePropagation|preventDefault/, '건물 클릭은 다른 클릭 처리기를 막지 않는다');
  // Esc: 캡처 단계, 카드가 떠 있고 조작 안내 · 모달 · 감상이 먼저 받지 않았을 때만 카드만 닫고 막는다(보행 해제로 가지 않게)
  const esc = src.match(/window\.addEventListener\(\s*'keydown',[\s\S]*?\n    true,?\s*\n  \);/);
  assert.ok(esc, 'Esc 캡처 처리기 없음');
  assert.match(esc[0], /e\.key !== 'Escape'/);
  assert.match(esc[0], /e\.defaultPrevented/);
  assert.match(esc[0], /isSuspended\(\)/);
  assert.match(esc[0], /e\.preventDefault\(\);\s*e\.stopImmediatePropagation\(\);/);
  assert.match(esc[0], /hide\(\)/);
  // 카드 건물에서 CARD_KEEP_RANGE 밖이면 닫기
  assert.match(src, /> CARD_KEEP_RANGE\) hide\(\)/);
  assert.match(src, /return \{[\s\S]*show,[\s\S]*hide,[\s\S]*isOpen[\s\S]*currentId[\s\S]*records[\s\S]*update[\s\S]*\}/);
});

test('(k) main 연결: 카드 만들기 · 멈춤 조건 · 감상 아닐 때 update · 스팟 도착 카드(정문은 입장 질문 그대로) · openArchive · 감상 열기/되돌리기 공통 · 카드 닫기', () => {
  const main = read('main.js');
  assert.match(main, /import \{ createArchiveCard \} from '\.\/archive-card\.js';/);
  assert.match(main, /import \{[^}]*buildingCollection[^}]*cardBuildingForSpot[^}]*\} from '\.\/archive\.js';/);
  const make = main.match(/const archive = createArchiveCard\(\{[\s\S]*?\n  \}\);/);
  assert.ok(make, 'createArchiveCard 호출 없음');
  assert.match(make[0], /getBoxes: \(\) => world\.buildingBoxes/);
  assert.match(make[0], /isWalking: \(\) => camCtrl\.isWalkMode\(\)/);
  assert.match(make[0], /onDetail: \(id\) => openArchive\(id\)/);
  const susp = make[0].match(/isSuspended: \(\) =>([^\n]*)/);
  assert.ok(susp, 'isSuspended 없음');
  for (const s of ['cinema.isActive()', 'camCtrl.isIntroActive()', "classList.contains('is-choosing')", 'scenario.isRunning()', 'interior.isActive()', 'interior.isBusy()',
    'showcase.isActive()', 'showcase.isBusy()', 'help.isOpen()', 'modal.isOpen()', 'spotCutting', 'camCtrl.isFlying()']) {
    assert.ok(susp[1].includes(s), `카드 멈춤 조건에 ${s} 없음`);
  }
  // 카드의 Esc 캡처 처리기는 조작 안내 · 모달 · 감상 뒤에 등록된다(그쪽 Esc 가 먼저)
  const at = (re) => main.search(re);
  for (const re of [/const help = createHelpOverlay\(/, /const modal = createModal\(/, /const showcase = createShowcase\(/]) assert.ok(at(re) >= 0 && at(re) < at(/const archive = createArchiveCard\(/), `${re} 가 카드보다 먼저`);
  // 렌더 루프: 감상 중이 아닐 때만
  assert.match(main, /if \(!studio\) archive\.update\(\);/);
  // 스팟 도착: 정문 입장 질문이 먼저, 외관 건물 view 스팟은 카드
  const arrive = fnBody(main, 'function arriveAt(spot)');
  assert.match(arrive, /if \(spot\.kind === 'entrance' && spot\.building === 'haus' && !interior\.isActive\(\)\) \{\s*modal\s*\.show\(\{\s*title: '입장하시겠습니까\?'/);
  assert.match(arrive, /\} else if \(!interior\.isActive\(\) && cardBuildingForSpot\(spot\)\) \{\s*archive\.show\(cardBuildingForSpot\(spot\)\);/);
  assert.ok(arrive.indexOf('입장하시겠습니까') < arrive.indexOf('cardBuildingForSpot'));
  // 감상 열기 공통(제품 · 건물): 연 자리 기록 · 보행 끄기 · 카드 닫기 · 못 열면 되돌리기
  const stage = fnBody(main, 'async function openStage(collection)');
  assert.match(stage, /showcaseReturn = \{ pos: camera\.position\.toArray\(\), target: camCtrl\.controls\.target\.toArray\(\), walking: camCtrl\.isWalkMode\(\) \};/);
  assert.match(stage, /archive\.hide\(\);/);
  assert.match(stage, /let opened = false;\s*try \{[\s\S]*camCtrl\.setWalkMode\(false\)[\s\S]*opened = await showcase\.open\(collection\);\s*\} catch \(err\) \{[\s\S]*?\}\s*if \(!opened\) restoreFromShowcase\(\);/);
  // 건물: 카드의 「자세히 보기」 → 두 건물 목록(월드가 받은 같은 모델 주소)
  const arch = fnBody(main, 'async function openArchive(id)');
  assert.match(arch, /buildingCollection\(archive\.records\(\), quality\.heroUrls, id\)/);
  assert.match(arch, /await openStage\(/);
  assert.match(arch, /interior\.isActive\(\) \|\| interior\.isBusy\(\) \|\| showcase\.isActive\(\) \|\| showcase\.isBusy\(\)/);
  // 되돌리기: 실내 전용 조건 없이 — 외관도 연 자리 · 시선 · 보행 그대로
  const restore = fnBody(main, 'function restoreFromShowcase()');
  assert.doesNotMatch(restore, /interior\.isActive\(\)/);
  assert.match(restore, /if \(!r\) return;/);
  assert.match(restore, /camCtrl\.placeAt\(r\.pos, r\.target\)/);
  // 카드 닫기: 투어 시작 · 실내 들어가기(감상 열기는 openStage)
  assert.match(fnBody(main, 'function startScenario(stepId)'), /archive\.hide\(\);/);
  assert.match(main, /onChange: \(inside\) => \{\s*if \(inside\) archive\.hide\(\);/);
  // 방식: 감상을 여닫는 동안(연 자리가 적혀 있는 동안) 보행 끄고 켜기로 방식을 바꾸지 않는다
  assert.match(main, /isSuspended: \(\) => interior\.isActive\(\) \|\| interior\.isBusy\(\) \|\| showcaseReturn !== null/);
  assert.match(main, /archive,\s*\n\s*openArchive,/);
});

test('(l) 카드 · 이름표 화면: 감상 패널과 같은 자리 · 모양(휴대폰 · 세로 태블릿은 아래), 손가락 44 px, 인트로 · 방식 고르기 · 감상 동안 숨김', () => {
  const css = read('nowhere.css');
  const card = css.match(/\n\.nw-archive-card \{([^}]*)\}/);
  assert.ok(card, '.nw-archive-card 없음');
  const panel = css.match(/\n\.nw-showcase-panel \{([^}]*)\}/)[1];
  for (const prop of ['top: 50%;', 'right: 22px;', 'transform: translateY(-50%);', 'width: min(300px, calc(100vw - 44px));', 'background: var(--nw-bg-panel);', 'border-top: 2px solid var(--nw-accent);']) {
    assert.ok(panel.includes(prop) && card[1].includes(prop), `카드에 감상 패널과 같은 ${prop} 없음`);
  }
  assert.match(css, /@media \(max-width: 720px\), \(orientation: portrait\) and \(max-width: 1024px\) \{\s*\.nw-archive-card \{[^}]*top: auto;/);
  assert.match(css, /@media \(max-width: 720px\), \(pointer: coarse\) \{\s*\.nw-archive-tag,\s*\.nw-archive-actions \.nw-btn \{[^}]*min-height: 44px/);
  for (const b of ['is-cinema', 'is-choosing', 'is-showcase']) {
    for (const sel of ['.nw-archive-tags', '.nw-archive-card']) assert.ok(css.includes(`body.${b} ${sel}`), `${b} 동안 ${sel} 를 숨기지 않음`);
  }
});

test('(m) 문서: README 기능 표에 건물 기록 카드 · 건물 감상, 조작 안내는 감상 모드 묶음', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /\| 건물 기록 카드\(외관\) \|/);
  assert.match(readme, /\| 건물 감상 모드 \|/);
  assert.match(readme, /SUPREME ORIGIN > Architecture > <건물 이름>/);
  assert.match(readme, /감상 모드 네 묶음/);
  assert.doesNotMatch(readme, /제품 감상 네 묶음/);
});
