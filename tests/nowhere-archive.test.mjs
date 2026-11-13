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
  assert.equal(c.release, true, '나가면 무대 로더가 받은 건물 원본을 푼다(수백 MB — 감상 중 두 건물 사이 이동은 캐시 그대로)');
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
  assert.match(click[0], /containsPoint\(raycaster\.ray\.origin\)/, '광선 시작점이 들어 있는 상자는 건너뛴다(v)');
  assert.match(click[0], /const best = pickBuilding\(/);
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

// ── Task 3: 부위 표지 · 부위 패널(건물 감상) ──
test('(n) 부위 표지 이름: 부위 title 의 \' — \' 뒤, 없으면 title 전체(두 월드 anchors 그대로)', async () => {
  const { partLabel } = await import('../public/src/nowhere/products.js');
  assert.equal(partLabel('FaceArch — 둥근 삼각 매스'), '둥근 삼각 매스');
  assert.equal(partLabel('HAUS NOWHERE — 크라운(11–14F)'), '크라운(11–14F)');
  assert.equal(partLabel('포디움 1–5F'), '포디움 1–5F');
  assert.equal(partLabel('FaceArch 두 면의 눈'), 'FaceArch 두 면의 눈');
  assert.equal(partLabel('전정 — 흰 자갈 화단과 꽃'), '흰 자갈 화단과 꽃');
  assert.equal(partLabel('A — B — C'), 'C', '마지막 \' — \' 뒤');
  assert.equal(partLabel('크라운—정상'), '크라운—정상', '띄어 쓰지 않은 대시는 나누지 않는다');
  const want = {
    nowhere: { haus: ['포디움 1–5F', '타워 6–11F', '크라운 11–14F'], facearch: ['FaceArch 둥근 삼각 매스', 'FaceArch 두 면의 눈', 'FaceArch 필로티 다리'] },
    'nowhere-ds2': { haus: ['포디움(1–5F)', '타워(6–11F)', '크라운(11–14F)'], facearch: ['둥근 삼각 매스', '두 면의 눈', '필로티 다리'] },
  };
  for (const [ver, L] of layouts) {
    for (const id of BUILDING_IDS) {
      const labels = buildingParts(L, id, records[id].title).map((p) => partLabel(p.title));
      assert.deepEqual([...labels].sort(), [...want[ver][id]].sort(), `${ver} ${id}`);
    }
  }
});

test('(o) 부위 표지 가림: 표지 점 → 카메라 광선이 PART_RAY_NEAR 넘고 카메라보다 가까이에서 들어가는 면(법선 · 광선 < 0)에 맞으면 흐리게, 매스 안에서 빠져나가는 면은 세지 않는다', async () => {
  const { hitHidesPart, PART_RAY_NEAR } = await import('../public/src/nowhere/products.js');
  assert.equal(PART_RAY_NEAR, 2, 'm — 표지가 붙은 외피 · FaceArch 눈 점 앞 1.3 m 의 얇은 막은 세지 않는다');
  const hides = (hits, cam = 100) => hits.some((h) => hitHidesPart(h, cam));
  assert.equal(hides([]), false, '맞은 곳 없음');
  assert.equal(hides([{ distance: 30, dot: -0.8 }]), true, '모델 앞면을 뚫고 카메라로 — 뒤에 있다');
  assert.equal(hides([{ distance: 30, dot: 0.8 }]), false, '매스 안 표지(FaceArch 몸체 · 눈)가 빠져나가는 면');
  assert.equal(hides([{ distance: 30, dot: 0.8 }, { distance: 50, dot: -0.5 }]), true, '빠져나간 뒤 다른 매스에 들어가면 뒤');
  assert.equal(hides([{ distance: 120, dot: -1 }]), false, '카메라 너머는 세지 않는다');
  assert.equal(hides([{ distance: 1.3, dot: -0.93 }, { distance: 1.7, dot: 0.96 }]), false, 'FaceArch 눈: 점 앞 얇은 막(1.3 m 들어가 1.7 m 나옴)만 맞으면 앞');
  assert.equal(hides([{ distance: PART_RAY_NEAR, dot: -1 }]), false);
  assert.equal(hides([{ distance: PART_RAY_NEAR + 0.01, dot: -1 }]), true);
  assert.equal(hides([{ distance: 30, dot: 0 }]), false, '스치는 면은 세지 않는다');
});

test('(p) 감상 무대 부위 표지: collection.parts(item) → 모델 자식 점(local) · DOM 버튼(.nw-showcase-part, 짧은 이름) 매 프레임 투영 · 가림 .is-behind · 누르면 부위 패널(kicker · title · rows · lore · ‹ 건물 정보) · getState().part', () => {
  const sc = read('showcase.js');
  assert.match(sc, /import \{[^}]*partLabel[^}]*\} from '\.\/products\.js';/);
  assert.match(sc, /typeof list\.parts === 'function' \? list\.parts\(item\)/);
  assert.match(sc, /'nw-showcase-part'/);
  assert.match(sc, /partLabel\(part\.title\)/);
  // 표지 점은 모델 자식(setModel 이 경계 상자 가운데를 원점으로 옮기면 따라간다) — 경계 상자를 잰 뒤에 붙인다
  const setModel = fnBody(sc, 'function setModel(obj, lvl, reframe)');
  assert.match(setModel, /setFromObject\(obj\)[\s\S]*obj\.add\(m\.anchor\)/);
  assert.match(sc, /anchor\.position\.fromArray\(part\.local\)/);
  // 투영: 무대 카메라(setViewOffset 포함) → 캔버스 자리, 화면 밖 · 카메라 뒤는 숨김
  assert.match(sc, /\.project\(camera\)/);
  assert.match(sc, /getBoundingClientRect\(\)/);
  // 가림: part-occlusion.js(동작은 tests/nowhere-part-occlusion.test.mjs 가 vendored three 로 잰다)에 모델 · 표지 점 · 무대 카메라 자리를 넘긴다. 흐리게(누를 수 있음)
  assert.match(sc, /import \{ createPartOcclusion \} from '\.\/part-occlusion\.js';/);
  assert.match(sc, /const occlusion = createPartOcclusion\(THREE\);/);
  assert.match(fnBody(sc, 'function updateParts()'), /const behind = occlusion\.isBehind\(model, pv, camera\.position\);/);
  assert.match(sc, /classList\.toggle\('is-behind'/);
  // 부위 패널: kicker · title · rows · lore · ‹ 건물 정보, 다시 누르거나 버튼 · 다른 건물이면 건물 정보
  assert.match(sc, /'nw-showcase-lore'/);
  assert.match(sc, /'‹ 건물 정보'/);
  const fillPart = fnBody(sc, 'function fillPart(part)');
  for (const re of [/kicker\.textContent = part\.kicker/, /title\.textContent = part\.title/, /part\.rows\.flatMap/, /lore\.textContent = part\.lore/, /note\.hidden = true/, /partBack\.hidden = false/]) assert.match(fillPart, re);
  const fillInfo = fnBody(sc, 'function fillInfo(item)');
  assert.match(fillInfo, /lore\.hidden = true/);
  assert.match(fillInfo, /partBack\.hidden = true/);
  assert.match(sc, /selectPart\(partId === part\.id \? null : part\.id\)/);
  assert.match(sc, /partBack\.addEventListener\('click', \(\) => \{\s*partBack\.blur\(\);\s*selectPart\(null\);/);
  // 다른 건물(항목)로 넘기면 부위 선택을 비운다(show → setParts)
  const show = fnBody(sc, 'async function show(id)');
  assert.match(show, /fillInfo\(item\);\s*setParts\(item\);/);
  assert.match(fnBody(sc, 'function setParts(item)'), /partId = null;/);
  assert.match(sc, /part: partId,/);
  assert.doesNotMatch(sc, /part: null/);
});

test('(q) main 연결: 건물 목록에 parts(item) = buildingParts(world.layout, item.id, item.name)', () => {
  const main = read('main.js');
  assert.match(main, /import \{[^}]*buildingParts[^}]*\} from '\.\/archive\.js';/);
  const arch = fnBody(main, 'async function openArchive(id)');
  assert.match(arch, /parts: \(item\) => buildingParts\(world\.layout, item\.id, item\.name\)/);
});

test('(r) 화면: 부위 표지(점 · 짧은 이름, 흐리게 · 고른 표지) · 부위 설명 문단 · ‹ 건물 정보, 카드 버튼은 높이가 모자라도 보인다(스크롤은 내용만)', () => {
  const css = read('nowhere.css');
  assert.match(css, /\n\.nw-showcase-part \{[^}]*position: absolute;[^}]*pointer-events: auto;/);
  assert.match(css, /\n\.nw-showcase-part\.is-behind \{[^}]*opacity: /);
  assert.match(css, /\n\.nw-showcase-part\.is-active \{/);
  assert.match(css, /\n\.nw-showcase-part\[hidden\]|\.nw-showcase-part\[hidden\]/);
  assert.match(css, /\n\.nw-showcase-lore \{/);
  assert.match(css, /\.nw-showcase-lore\[hidden\]/);
  assert.match(css, /\.nw-showcase-part-back\[hidden\]/);
  // 감상 패널(부위 설명이 붙으면 길어진다): 낮은 화면에서는 패널 안에서 스크롤 — 위 줄과 겹치지 않게
  assert.match(css, /\n\.nw-showcase-panel \{[^}]*max-height: calc\(100vh - \d+px\);[^}]*overflow-y: auto;/);
  // 카드: 내용(.nw-archive-body)만 스크롤, 버튼(.nw-archive-actions)은 카드 아래에 늘 보인다(가로 휴대폰 844 × 390 포함)
  const card = css.match(/\n\.nw-archive-card \{([^}]*)\}/)[1];
  assert.match(card, /display: flex;/);
  assert.match(card, /flex-direction: column;/);
  assert.doesNotMatch(card, /overflow-y: auto/);
  assert.match(css, /\n\.nw-archive-body \{[^}]*overflow-y: auto;[^}]*min-height: 0;/);
  assert.match(css, /\n\.nw-archive-actions \{[^}]*flex: none;/);
  const src = read('archive-card.js');
  assert.match(src, /body\.append\(kicker, title, info, note\);\s*card\.append\(body, actions\);/);
});

test('(s) 카드를 닫은 Esc 를 누르고 있으면 자동 반복(e.repeat)은 막는다 — camera.js 로 가서 보행을 끄지 않게, 손을 떼면 풀린다', () => {
  const src = read('archive-card.js');
  const esc = src.match(/window\.addEventListener\(\s*'keydown',[\s\S]*?\n    true,?\s*\n  \);/)[0];
  assert.match(esc, /if \(e\.repeat && escHeld\) \{\s*e\.preventDefault\(\);\s*e\.stopImmediatePropagation\(\);\s*return;\s*\}/);
  assert.ok(esc.indexOf('e.repeat && escHeld') < esc.indexOf('!openId'), '카드가 닫힌 뒤의 반복도 받는다');
  assert.match(esc, /hide\(\);\s*escHeld = true;/);
  assert.match(src, /window\.addEventListener\('keyup', \(e\) => \{\s*if \(e\.key === 'Escape'\) escHeld = false;/);
});

test('(t) 문서: README 에 건물 부위 표지 줄', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /\| 건물 부위 표지 \|[^\n]*‹ 건물 정보[^\n]*\|/);
  assert.match(readme, /<건물 이름> · PART/);
});

test('(u) 아래 패널 배치(휴대폰 · 세로 태블릿)의 건물 감상: 투영 가운데를 위 막대 · 경로와 아래 정보 패널 사이 빈 곳 가운데로 올린다(부위 표지가 패널에 가리지 않게) — 제품 감상 · 옆 패널 배치는 그대로', async () => {
  const { stageLift, stageView, STAGE_BOTTOM } = await import('../public/src/nowhere/products.js');
  const lift = (STAGE_BOTTOM.bottom - STAGE_BOTTOM.top) / 2;
  assert.ok(lift > 0);
  for (const [w, h] of [[390, 844], [720, 900], [820, 1180], [1024, 1366]]) {
    assert.equal(stageView(w, h).shift, 0, `${w}×${h} 아래 패널`);
    assert.equal(stageLift(w, h), lift, `${w}×${h}`);
  }
  for (const [w, h] of [[1600, 900], [1180, 820], [844, 390], [1080, 1920]]) assert.equal(stageLift(w, h), 0, `${w}×${h} 옆 패널`);
  // 아래 몫 = 휴대폰 패널 아래 여백(nowhere.css bottom) + 건물 정보 패널 높이(390 × 844 에서 238 px)
  const css = read('nowhere.css');
  const bottom = Number(css.match(/\.nw-showcase-panel \{\s*top: auto;\s*right: 8px;\s*bottom: (\d+)px;/)[1]);
  assert.ok(STAGE_BOTTOM.bottom - bottom >= 238, '건물 정보 패널 높이만큼은 비운다');
  // 무대: 부위 표지가 있는 목록(건물)만 올리고, 올린 만큼 시야각을 넓혀 보이는 크기는 그대로(거리 맞춤 stageFraming 은 FOV 그대로)
  const sc = read('showcase.js');
  const view = fnBody(sc, 'function applyView()');
  assert.match(view, /const lift = list\?\.parts \? stageLift\(w, h\) : 0;/);
  assert.match(view, /camera\.setViewOffset\(fullW, fullH, 2 \* v\.shift, 2 \* lift, w, h\)/);
  assert.match(view, /camera\.fov = lift > 0 \?[^;]*fullH\)? \/ h[^;]*: FOV;/);
  assert.match(sc, /stageFraming\(radius, FOV, applyView\(\)\)/);
});

test('(v) 자유 시점 클릭 고르기(pickBuilding): 광선 시작점(카메라)이 들어 있는 건물 경계 상자는 건너뛴다 — FaceArch 필로티 아래(face_piloti)에서 HAUS 를 누르면 HAUS 카드', async () => {
  const { pickBuilding } = await import('../public/src/nowhere/archive.js');
  const THREE = await import('../public/vendor/three/three.module.js');
  // 상자 안에서 쏜 광선은 그 상자의 나가는 면(가까이)에 맞는다 — 건너뛰지 않으면 어디를 눌러도 그 건물이 가장 가깝다
  const box = new THREE.Box3(new THREE.Vector3(-15, 0, -15), new THREE.Vector3(15, 30, 15));
  const ray = new THREE.Ray(new THREE.Vector3(0, 1.7, 0), new THREE.Vector3(1, 0, 0));
  assert.ok(box.containsPoint(ray.origin));
  assert.equal(ray.intersectBox(box, new THREE.Vector3())?.x, 15);
  const c = (id, o) => ({ id, hasRecord: true, range: 100, inside: false, hit: null, ...o });
  assert.equal(pickBuilding([c('haus', { hit: 95, range: 130 }), c('facearch', { inside: true, hit: 15, range: 30 })]), 'haus', 'face_piloti → HAUS');
  assert.equal(pickBuilding([c('haus'), c('facearch', { inside: true, hit: 15 })]), null, '상자 안에서 다른 건물에 맞지 않으면 아무것도');
  // 밖에서는 지금처럼: 맞은 건물 중 가까운 것, 기록 없음 · CARD_KEEP_RANGE 밖(경계 포함 안) · 안 맞음은 뺀다
  assert.equal(pickBuilding([c('haus', { hit: 80 }), c('facearch', { hit: 120 })]), 'haus');
  assert.equal(pickBuilding([c('haus', { hit: 80 }), c('facearch', { hit: 40 })]), 'facearch');
  assert.equal(pickBuilding([c('haus', { hit: 80, hasRecord: false }), c('facearch', { hit: 120 })]), 'facearch', '기록 없음');
  assert.equal(pickBuilding([c('haus', { hit: 80, range: CARD_KEEP_RANGE + 1 }), c('facearch', { hit: 120 })]), 'facearch', '카드가 바로 닫힐 거리');
  assert.equal(pickBuilding([c('haus', { hit: 80, range: CARD_KEEP_RANGE })]), 'haus', '경계는 고른다');
  assert.equal(pickBuilding([c('haus', { hit: 0 })]), 'haus', '맞은 거리 0 도 맞음');
  assert.equal(pickBuilding([c('haus'), c('facearch')]), null, '안 맞음');
  assert.equal(pickBuilding([]), null);
});

test('(w) 건물 감상 메모리: 건물 목록(release)은 나가거나 못 열면 무대에서 모델 · 표지를 빼고, 이 목록이 무대 로더로 받은 원본을 풀고(geometry · 재질 · 텍스처 dispose, ImageBitmap close) 캐시에서 지운다 — 제품 목록은 그대로', () => {
  const sc = read('showcase.js');
  assert.match(fnBody(sc, 'function loadUrl(url, what)'), /listUrls\.add\(url\);/);
  const rel = fnBody(sc, 'function releaseList()');
  assert.match(rel, /if \(!list\?\.release\) return;/, '제품 목록(release 없음)은 그대로');
  assert.match(rel, /if \(model\) stage\.remove\(model\);\s*model = null;/);
  assert.match(rel, /for \(const m of marks\) m\.anchor\.removeFromParent\(\);\s*marks = \[\];/, '표지 점이 모델(clone)을 쥐고 있지 않게');
  assert.match(rel, /for \(const url of listUrls\) \{[\s\S]*cache\.delete\(url\);[\s\S]*disposeObject\(/);
  const dispose = sc.match(/\nfunction disposeObject\(root\) \{[\s\S]*?\n\}\n/);
  assert.ok(dispose, 'disposeObject 없음');
  for (const re of [/\.geometry/, /isTexture/, /\.dispose\(\)/, /instanceof ImageBitmap/, /\.close\(\)/]) assert.match(dispose[0], re);
  // 나가기: 어두운 동안 onClose 뒤 · 열기 실패 경로, 여는 목록마다 받은 주소를 새로 센다
  assert.match(fnBody(sc, 'async function close()'), /onClose\(\);\s*releaseList\(\);/);
  const open = fnBody(sc, 'async function open(collection)');
  assert.match(open, /listUrls\.clear\(\);/);
  assert.match(open.match(/\} catch \(err\) \{[\s\S]*?\} finally/)[0], /releaseList\(\);/);
});
