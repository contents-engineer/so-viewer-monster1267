import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hubKeyAction, stepFocus, cycleFocus, createHubPanel, HUB_BLOCKED_TITLE } from '../public/src/nowhere/hub-panel.js';
import { hubIndex, runGoPlan } from '../public/src/nowhere/hub-index.js';
import { CONTROL_SECTIONS } from '../public/src/nowhere/help.js';
import { validateCatalog, PRODUCTS_URL } from '../public/src/nowhere/products.js';
import { BUILDING_IDS, BUILDING_RECORDS } from '../public/src/nowhere/archive.js';

// 아카이브 목록 패널(hub-panel.js) · 가기 실행(hub-index.js runGoPlan) · main.js 연결 · 화면 · 안내 · README
const PUB = new URL('../public/', import.meta.url);
const readJson = (p) => JSON.parse(readFileSync(new URL(p, PUB), 'utf8'));
const readSrc = (f) => readFileSync(new URL(`src/nowhere/${f}`, PUB), 'utf8');
const inner = readJson('assets/nowhere-inner/inner-layout.json');
const catalog = validateCatalog(readJson(PRODUCTS_URL));
const records = Object.fromEntries(BUILDING_IDS.map((id) => [id, readJson(BUILDING_RECORDS[id])]));
const fnBody = (src, head) => {
  const m = src.match(new RegExp(`${head.replace(/[()]/g, '\\$&')} \\{[\\s\\S]*?\\n  \\}\\n`));
  assert.ok(m, `${head} 를 찾지 못함`);
  return m[0];
};

test('(a) 키(hubKeyAction): L 은 열기 · 닫기(한글 입력 상태의 KeyL 포함), ⌘ · Ctrl · Alt · 입력 칸 · 키 반복 · 막힘 · 앞 처리기가 받은 키는 그대로 둔다', () => {
  const k = (o) => hubKeyAction({ open: false, blocked: false, ...o });
  assert.equal(k({ key: 'l', code: 'KeyL' }), 'open');
  assert.equal(k({ key: 'L', code: 'KeyL' }), 'open');
  assert.equal(k({ key: 'ㅣ', code: 'KeyL' }), 'open', '한글 입력 상태(e.key = ㅣ)');
  assert.equal(k({ key: 'l', code: 'KeyL', open: true }), 'close');
  for (const mod of ['metaKey', 'ctrlKey', 'altKey']) assert.equal(k({ key: 'l', code: 'KeyL', [mod]: true }), null, mod);
  assert.equal(k({ key: 'l', code: 'KeyL', typing: true }), null, '입력 칸');
  assert.equal(k({ key: 'l', code: 'KeyL', repeat: true }), null, '누르고 있으면 한 번만');
  assert.equal(k({ key: 'l', code: 'KeyL', blocked: true }), null, '막힘(인트로 · 이동 · 감상 · 모달 · 조작 안내)');
  assert.equal(k({ key: 'l', code: 'KeyL', open: true, blocked: true }), null, '목록 위에 조작 안내 · 모달이 떠 있으면 그쪽 몫');
  assert.equal(k({ key: 'l', code: 'KeyL', defaultPrevented: true }), null);
  assert.equal(k({ key: 'k', code: 'KeyK' }), null, '닫혀 있으면 다른 키는 그대로');
  assert.equal(k({ key: 'l', code: 'KeyL', open: true, repeat: true }), 'swallow', '열고 나서 누르고 있는 L 반복은 막기만');
});

test('(a2) 키(hubKeyAction): 떠 있는 동안 — Tab 은 패널 안 돌기, Space · Enter 는 포커스된 버튼 누르기(기본 동작 그대로), ↑ ↓ Home End 는 포커스 이동, 그 밖의 키(보행 WASD · Q · E · 방향키 · V · Shift · 숫자)는 막는다. ⌘ · Ctrl 조합 · P(성능 표시)는 그대로', () => {
  const k = (o) => hubKeyAction({ open: true, blocked: false, ...o });
  assert.equal(k({ key: 'Tab', code: 'Tab' }), 'tab');
  assert.equal(k({ key: 'Tab', code: 'Tab', shiftKey: true }), 'tab');
  assert.equal(k({ key: ' ', code: 'Space' }), 'press');
  assert.equal(k({ key: 'Enter', code: 'Enter' }), 'press');
  for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End']) assert.equal(k({ key, code: key }), 'focus', key);
  for (const [key, code] of [['w', 'KeyW'], ['a', 'KeyA'], ['s', 'KeyS'], ['d', 'KeyD'], ['q', 'KeyQ'], ['e', 'KeyE'], ['v', 'KeyV'], ['ArrowLeft', 'ArrowLeft'], ['ArrowRight', 'ArrowRight'], ['Shift', 'ShiftLeft'], ['2', 'Digit2'], ['ㅈ', 'KeyW']]) {
    assert.equal(k({ key, code }), 'swallow', `${code} 는 뒤 보행 · 카메라로 가지 않는다`);
  }
  assert.equal(k({ key: 'w', code: 'KeyW', repeat: true }), 'swallow');
  assert.equal(k({ key: 'r', code: 'KeyR', metaKey: true }), null, '⌘ 조합은 브라우저 몫');
  assert.equal(k({ key: 'c', code: 'KeyC', ctrlKey: true }), null);
  assert.equal(k({ key: 'p', code: 'KeyP' }), null, 'P 성능 표시는 그대로(감상 중과 같이)');
  // 막혀 있으면(목록 위 조작 안내 · 모달) 그쪽 몫 — 아무것도 막지 않는다
  for (const key of ['Tab', ' ', 'w', 'ArrowDown']) assert.equal(k({ key, code: key, blocked: true }), null, key);
  // 닫혀 있으면 아무 키도 건드리지 않는다
  for (const key of ['Tab', ' ', 'Enter', 'w', 'ArrowDown']) assert.equal(hubKeyAction({ key, code: key, open: false, blocked: false }), null, key);
});

test('(b) 키(hubKeyAction): Esc 는 목록이 떠 있을 때만 닫기, 닫은 Esc 를 누르고 있는 동안의 반복은 삼킨다(보행 해제로 가지 않게)', () => {
  const k = (o) => hubKeyAction({ key: 'Escape', code: 'Escape', open: false, blocked: false, ...o });
  assert.equal(k({}), null, '닫혀 있으면 다른 처리기(카드 · 인트로 · 보행) 몫');
  assert.equal(k({ open: true }), 'close');
  assert.equal(k({ open: true, typing: true }), 'close', '입력 칸에서도 Esc 는 닫기');
  assert.equal(k({ open: true, defaultPrevented: true }), null, '조작 안내 · 모달이 먼저 받은 Esc');
  assert.equal(k({ open: true, blocked: true }), null);
  assert.equal(k({ open: true, repeat: true }), 'swallow', '떠 있는데 반복만 오면 닫지 않고 막기만');
  assert.equal(k({ open: false, repeat: true, held: true }), 'swallow', '목록을 닫은 Esc 를 누르고 있는 동안');
  assert.equal(k({ open: false, repeat: false, held: true }), null, '새로 누른 Esc 는 다른 처리기 몫');
});

test('(c) 화살표 포커스 이동(stepFocus): ↓ ↑ 한 칸(끝에서 멈춤) · Home · End, 항목이 없거나 다른 키면 null', () => {
  assert.equal(stepFocus(0, 5, 'ArrowDown'), 1);
  assert.equal(stepFocus(4, 5, 'ArrowDown'), 4);
  assert.equal(stepFocus(2, 5, 'ArrowUp'), 1);
  assert.equal(stepFocus(0, 5, 'ArrowUp'), 0);
  assert.equal(stepFocus(3, 5, 'Home'), 0);
  assert.equal(stepFocus(1, 5, 'End'), 4);
  assert.equal(stepFocus(-1, 5, 'ArrowDown'), 0, '항목 밖(닫기 버튼)에서 ↓ → 첫 항목');
  assert.equal(stepFocus(-1, 5, 'ArrowUp'), 0);
  assert.equal(stepFocus(0, 0, 'ArrowDown'), null);
  // Tab 돌기(cycleFocus — 닫기 · 항목들): 끝에서 처음으로, Shift+Tab 은 거꾸로, 패널 밖이면 처음(거꾸로면 끝)
  assert.equal(cycleFocus(0, 4, false), 1);
  assert.equal(cycleFocus(3, 4, false), 0);
  assert.equal(cycleFocus(0, 4, true), 3);
  assert.equal(cycleFocus(2, 4, true), 1);
  assert.equal(cycleFocus(-1, 4, false), 0);
  assert.equal(cycleFocus(-1, 4, true), 3);
  assert.equal(cycleFocus(0, 0, false), null);
  assert.equal(stepFocus(0, 5, 'ArrowLeft'), null);
});

// 가짜 실내: enter 는 기본 층(1)으로, goToFloor 는 그 층으로 — 호출 순서를 적는다
function fakeInterior({ active = false, floor = null, enterOk = true, floorOk = true } = {}) {
  const calls = [];
  const s = { active, floor };
  return {
    calls,
    interior: {
      isActive: () => s.active,
      currentFloor: () => (s.active ? s.floor : null),
      enter: async (b) => {
        calls.push(`enter:${b}`);
        if (enterOk) Object.assign(s, { active: true, floor: '1' });
        return enterOk;
      },
      goToFloor: async (id) => {
        calls.push(`floor:${id}`);
        if (floorOk) s.floor = id;
        return floorOk;
      },
    },
    open: async (it) => {
      calls.push(`open:${it.category}:${it.id}`);
    },
  };
}

test('(d) 가기 실행(runGoPlan): 밖 → 들어가기 → 기본 층(1F)이 목적 층이 아니면 층 이동 → 감상, 실패한 단계에서 멈춘다', async () => {
  const groups = hubIndex({ records, worldLabel: '성수 2041', innerLayout: inner, catalog });
  const find = (cat, id) => groups.find((g) => g.id === cat).items.find((i) => i.id === id);
  const nail = find('exhibit', 'nail');
  const kant = find('product', 'kant');
  const face = find('architecture', 'facearch');
  const cityModel = find('exhibit', 'city_model');

  let f = fakeInterior();
  assert.equal(await runGoPlan(nail, f), true);
  assert.deepEqual(f.calls, ['enter:haus', 'floor:13', 'open:exhibit:nail'], '외관 → 거대한 손: 들어가 13F 로');

  f = fakeInterior();
  assert.equal(await runGoPlan(kant, f), true);
  assert.deepEqual(f.calls, ['enter:haus', 'open:product:kant'], '들어간 기본 층이 1F 면 층 이동 없이');

  f = fakeInterior();
  await runGoPlan(cityModel, f);
  assert.deepEqual(f.calls, ['enter:haus', 'open:exhibit:city_model']);

  f = fakeInterior({ active: true, floor: '13' });
  await runGoPlan(kant, f);
  assert.deepEqual(f.calls, ['floor:1', 'open:product:kant'], '실내 13F → Kant: 1F 로');

  f = fakeInterior({ active: true, floor: '13' });
  await runGoPlan(nail, f);
  assert.deepEqual(f.calls, ['open:exhibit:nail'], '같은 층이면 바로 감상');

  for (const at of [{ active: false }, { active: true, floor: '12' }]) {
    f = fakeInterior(at);
    await runGoPlan(face, f);
    assert.deepEqual(f.calls, ['open:architecture:facearch'], '건축은 외관 · 실내 어디서든 바로 감상');
  }

  f = fakeInterior({ enterOk: false });
  assert.equal(await runGoPlan(nail, f), false);
  assert.deepEqual(f.calls, ['enter:haus'], '못 들어가면(이미 전환 중 · 실패 후 닫기) 멈춘다');

  f = fakeInterior({ active: true, floor: '1', floorOk: false });
  assert.equal(await runGoPlan(nail, f), false);
  assert.deepEqual(f.calls, ['floor:13'], '층 이동이 안 되면 멈춘다');
});

test('(e) 패널 모듈: 위 막대 「목록」 버튼(L, 조작 안내 앞) · 막히면 흐리게 + 이유 title · 왼쪽 서랍(dialog, ARCHIVE INDEX · 아카이브 목록) · 묶음(이름 · 개수 · 색 점) · 항목(제목 · 자리)', () => {
  const src = readSrc('hub-panel.js');
  assert.match(src, /export function createHubPanel\(\{ load, onGo, isBlocked[^}]*\}\)/);
  assert.equal(HUB_BLOCKED_TITLE, '지금은 목록을 열 수 없습니다');
  // 버튼: .nw-btn · 목록 · L 키 표시, .nw-top-actions 에(조작 안내 버튼 앞 — 세 페이지 모두 JS 로 넣는다)
  assert.match(src, /el\('button', 'nw-btn nw-hub-btn', '목록'\)/);
  assert.match(src, /el\('span', 'nw-btn-kbd', 'L'\)/);
  assert.match(src, /document\.querySelector\('\.nw-top-actions'\)/);
  assert.match(src, /insertBefore\(btn, document\.getElementById\('nw-btn-help'\)\)/);
  assert.match(src, /'aria-haspopup', 'dialog'/);
  assert.match(src, /'aria-expanded'/);
  // 막힘: 매 프레임 update — 바뀔 때만 class · aria-disabled · title
  const update = fnBody(src, 'function update()');
  assert.match(update, /isBlocked\(\)/);
  assert.match(update, /classList\.toggle\('is-blocked', b\)/);
  assert.match(update, /'aria-disabled'/);
  assert.match(update, /HUB_BLOCKED_TITLE/);
  // 서랍: dialog · 제목 · 닫기 ×
  assert.match(src, /setAttribute\('role', 'dialog'\)/);
  assert.match(src, /'ARCHIVE INDEX'/);
  assert.match(src, /'아카이브 목록'/);
  assert.match(src, /el\('button', 'nw-hub-close', '×'\)/);
  assert.match(src, /closeBtn\.setAttribute\('aria-label', '닫기'\)/);
  // 묶음 · 항목: data-category(색) · 이름 · 개수 · 제목 · 자리(출처 값 그대로 — textContent)
  assert.match(src, /dataset\.category = g\.id/);
  assert.match(src, /'nw-hub-dot'/);
  assert.match(src, /el\('span', 'nw-hub-group-name', g\.label\)/);
  assert.match(src, /el\('span', 'nw-hub-count', String\(g\.items\.length\)\)/);
  assert.match(src, /el\('span', 'nw-hub-item-title', it\.title\)/);
  assert.match(src, /el\('span', 'nw-hub-item-place', it\.place\)/);
  assert.doesNotMatch(src, /innerHTML/);
});

test('(f) 패널 동작: 열 때 load(처음 열 때 받음) · 첫 항목 포커스, 닫을 때 버튼으로(항목을 골랐거나 바깥을 눌렀으면 빼고), 고르면 닫고 onGo, Esc · L · 화살표는 창 캡처 단계', () => {
  const src = readSrc('hub-panel.js');
  const open = fnBody(src, 'async function open()');
  assert.match(open, /if \(isOpen\(\) \|\| isBlocked\(\)\) return;/);
  assert.match(open, /await load\(\)/);
  assert.match(open, /\.focus\(\)/);
  assert.match(open, /onOpen/);
  const close = fnBody(src, 'function close({ restoreFocus = true } = {})');
  assert.match(close, /if \(restoreFocus\) btn\.focus\(\)/);
  // 항목: 닫고(포커스 되돌리지 않음) onGo
  assert.match(src, /close\(\{ restoreFocus: false \}\);\s*onGo\(it\);/);
  // 바깥(가림막) 클릭 · 닫기 버튼
  assert.match(src, /root\.addEventListener\('click', \(e\) => \{\s*if \(e\.target === root\) close\(\{ restoreFocus: false \}\);/);
  assert.match(src, /closeBtn\.addEventListener\('click', \(\) => close\(\)\)/);
  // 키: 창 캡처 — hubKeyAction, Esc 는 막고(카드 · 인트로 · 보행 처리기로 가지 않게) 닫는다
  const keys = src.match(/window\.addEventListener\(\s*'keydown',[\s\S]*?\n    true,?\s*\n  \);/);
  assert.ok(keys, '키 캡처 처리기 없음');
  assert.match(keys[0], /hubKeyAction\(\{/);
  assert.match(keys[0], /if \(!act\) return;\s*e\.stopImmediatePropagation\(\);/, '처리한 키는 뒤(카드 · 인트로 · camera.js)로 가지 않게');
  assert.match(keys[0], /if \(act === 'press' \|\| act === 'swallow'\) return;\s*e\.preventDefault\(\);/, 'Space · Enter 는 기본 동작(버튼 누르기) 그대로');
  assert.match(keys[0], /stepFocus\(/);
  assert.match(keys[0], /cycleFocus\(/);
  // keyup: keydown 을 막은 키는 keyup 도 막는다(Space keyup 의 preventDefault 로 버튼이 안 눌리거나 보행 키가 눌린 채 남지 않게)
  const up = src.match(/window\.addEventListener\(\s*'keyup',[\s\S]*?\n    true,?\s*\n  \);/);
  assert.ok(up, 'keyup 캡처 처리기 없음');
  assert.match(up[0], /if \(swallowed\.delete\(e\.code \|\| e\.key\)\) e\.stopImmediatePropagation\(\);/);
  assert.match(src, /return \{[\s\S]*open,[\s\S]*close,[\s\S]*toggle,[\s\S]*isOpen,[\s\S]*update,[\s\S]*\}/);
});

test('(g) main 연결: 목록 만들기(출처 = 건물 기록 · inner-layout · 진열, 월드 이름 = 위 막대 월드 버튼) · 막힘 조건 · 가기 = runGoPlan · Esc 순서 · 렌더 루프 update', () => {
  const main = readSrc('main.js');
  assert.match(main, /import \{ createHubPanel \} from '\.\/hub-panel\.js';/);
  assert.match(main, /import \{ hubIndex, runGoPlan \} from '\.\/hub-index\.js';/);
  const make = main.match(/const hub = createHubPanel\(\{[\s\S]*?\n  \}\);/);
  assert.ok(make, 'createHubPanel 호출 없음');
  // 출처: 건물 기록(부팅 때 받음) · inner-layout(들어가지 않고) · 진열(못 불러온 제품 뺀 catalog())
  assert.match(make[0], /interior\.loadLayout\(\)/);
  assert.match(make[0], /retail\.loadCatalog\(\)\.then\(\(\) => retail\.catalog\(\)\)/);
  assert.match(make[0], /hubIndex\(\{ records: archive\.records\(\), worldLabel: hubWorldLabel, innerLayout, catalog \}\)/);
  assert.match(main, /const hubWorldLabel = document\.querySelector\(`\.nw-world-switch \[data-world-ver="\$\{worldVer\}"\]`\)\?\.textContent\.trim\(\) \|\| worldLabel;/);
  // 막힘
  const blocked = make[0].match(/isBlocked: \(\) =>([^\n]*)/);
  assert.ok(blocked, 'isBlocked 없음');
  for (const s of ['cinema.isActive()', 'camCtrl.isIntroActive()', "classList.contains('is-choosing')", 'camCtrl.isFlying()', 'spotCutting', 'interior.isBusy()', 'interior.isTouring()',
    'showcase.isActive()', 'showcase.isBusy()', 'modal.isOpen()', 'help.isOpen()']) {
    assert.ok(blocked[1].includes(s), `목록 막힘 조건에 ${s} 없음`);
  }
  // 열 때 마우스 고정 풀기 · 스팟 걷기 멈춤(조작 안내와 같이)
  assert.match(make[0], /onOpen: \(\) => \{\s*camCtrl\.releasePointer\(\);\s*camCtrl\.cancelWalkTo\(\);\s*camCtrl\.clearInput\(\);/, '열 때 누르던 이동 키를 비운다(목록이 키를 막는 동안 계속 걷지 않게)');
  // 가기: runGoPlan(실내 들어가기 · 층 이동 · 감상) — 감상은 카테고리별 기존 열기 함수
  assert.match(make[0], /onGo: \(item\) => runGoPlan\(item, \{ interior, open: openIndexItem \}\)/);
  const openItem = fnBody(main, 'function openIndexItem(item)');
  assert.match(openItem, /item\.category === 'architecture'\) return openArchive\(item\.id\)/);
  assert.match(openItem, /item\.category === 'exhibit'\) return openExhibit\(item\.id\)/);
  assert.match(openItem, /return openShowcase\(item\.id\)/);
  // 건물 감상은 실내에서도(아카이브 목록) — 외관 카드는 실내에서 뜨지 않는다
  const arch = fnBody(main, 'async function openArchive(id)');
  assert.doesNotMatch(arch, /interior\.isActive\(\)/);
  // Esc 순서: 조작 안내 · 모달 · 감상 → 목록 → 건물 카드(목록 처리기가 카드 처리기보다 먼저 등록)
  const at = (re) => main.search(re);
  for (const re of [/const help = createHelpOverlay\(/, /const modal = createModal\(/, /const showcase = createShowcase\(/]) assert.ok(at(re) >= 0 && at(re) < at(/const hub = createHubPanel\(/), `${re} 가 목록보다 먼저`);
  assert.ok(at(/const hub = createHubPanel\(/) < at(/const archive = createArchiveCard\(/), '목록이 건물 카드보다 먼저(Esc 는 목록부터 닫는다)');
  // 렌더 루프: 감상 중에도 버튼 상태를 맞춘다(감상 중에는 위 막대가 숨어 있다)
  assert.match(main, /\n    hub\.update\(\);/);
  assert.match(main, /archive,\s*\n\s*openArchive,[\s\S]*hub,/);
});

test('(h) 실내: 들어가지 않고 inner-layout 만 받는 loadLayout 을 내보낸다(받았으면 그대로)', () => {
  const src = readSrc('interior.js');
  const ret = src.match(/\n  return \{([\s\S]*?)\n  \};\n\}/);
  assert.ok(ret, 'createInterior 반환 객체 없음');
  assert.match(ret[1], /\n    loadLayout,/);
  assert.match(src, /async function loadLayout\(\) \{\s*if \(!layout\) \{/);
});

test('(i) 화면: 버튼 흐리게 · 서랍(가림막 위 · 모달 · 조작 안내 아래) · 묶음 색 점 · 항목 44 px · 닫기 44 px, 휴대폰은 화면 전체, 감상 · 인트로 · 방식 고르기 동안 숨김', () => {
  const css = readSrc('nowhere.css');
  assert.match(css, /\.nw-hub-btn\.is-blocked \{[^}]*opacity: 0\.45;[^}]*\}/);
  const root = css.match(/\n\.nw-hub \{([^}]*)\}/);
  assert.ok(root, '.nw-hub 없음');
  assert.match(root[1], /position: fixed;/);
  assert.match(root[1], /inset: 0;/);
  const z = Number(root[1].match(/z-index: (\d+);/)[1]);
  const zOf = (sel) => Number(css.match(new RegExp(`\\n${sel.replace('.', '\\.')} \\{[^}]*?z-index: (\\d+);`))[1]);
  assert.ok(z > zOf('.nw-showcase') && z > zOf('.nw-topbar') && z > zOf('.nw-archive-card') && z > zOf('.nw-interior-hud'), '목록은 위 막대 · 실내 HUD · 카드 위');
  assert.ok(z < zOf('.nw-modal') && z < zOf('.nw-help') && z < zOf('.nw-fade'), '모달 · 조작 안내 · 화면 전환은 목록 위');
  assert.match(css, /\.nw-hub\[hidden\] \{\s*display: none;/);
  const panel = css.match(/\n\.nw-hub-panel \{([^}]*)\}/)[1];
  assert.match(panel, /left: 0;/);
  assert.match(panel, /width: min\(360px, 100vw\);/);
  for (const id of ['architecture', 'exhibit', 'product']) {
    assert.match(css, new RegExp(`\\.nw-hub-group\\[data-category="${id}"\\] \\{\\s*--nw-cat: var\\(--nw-cat-${id}\\);\\s*\\}`), `${id} 묶음 색`);
  }
  assert.match(css, /\.nw-hub-dot \{[^}]*background: var\(--nw-cat\);/);
  assert.match(css, /\.nw-hub-item \{[^}]*min-height: 44px;/);
  assert.match(css, /\.nw-hub-close \{[^}]*width: 44px;[^}]*height: 44px;/);
  // 휴대폰 · 터치: 버튼 모습은 위 막대 그대로, 누르는 자리만 44 px
  const touch = css.match(/@media \(max-width: 720px\), \(pointer: coarse\) \{\s*\.nw-hub-btn \{[\s\S]*?\n\}/);
  assert.ok(touch, '목록 버튼 터치 자리 없음');
  const hitArea = touch[0].match(/\.nw-hub-btn::after \{([^}]*)\}/)[1];
  assert.match(hitArea, /height: 44px;/);
  assert.match(hitArea, /left: 0;/, '옆 버튼과 겹치지 않게');
  assert.match(hitArea, /right: 0;/);
  // 휴대폰(≤ 720 px): 화면 전체
  const phone = [...css.matchAll(/@media \(max-width: 720px\) \{([\s\S]*?)\n\}/g)].map((m) => m[1]).find((b) => b.includes('.nw-hub-panel'));
  assert.ok(phone, '휴대폰 목록 배치 없음');
  assert.match(phone, /\.nw-hub-panel \{[^}]*width: 100%;/);
  // 감상 · 인트로 · 방식 고르기 동안 숨김(버튼은 위 막대째 숨는다)
  for (const b of ['is-showcase', 'is-cinema', 'is-choosing']) {
    assert.match(css, new RegExp(`body\\.${b} \\.nw-hub[,\\s]`), `${b} 동안 목록 숨김`);
    assert.match(css, new RegExp(`body\\.${b} \\.nw-topbar[,\\s]`), `${b} 동안 위 막대(목록 버튼) 숨김`);
  }
});

test('(j) 조작 안내: 공통에 L(아카이브 목록), Esc 줄은 목록 닫기가 건물 카드 닫기보다 먼저, 보행 ◇ 줄에 카테고리 색 · 글자', () => {
  const common = CONTROL_SECTIONS.find((s) => s.id === 'common');
  const l = common.rows.find((r) => r.keys.includes('L'));
  assert.ok(l, '공통에 L 줄 없음');
  assert.deepEqual(l.keys, ['L']);
  assert.match(l.desc, /^아카이브 목록/);
  assert.match(l.desc, /건축 · 전시물 · 제품/);
  const esc = common.rows.find((r) => r.keys.includes('Esc')).desc;
  assert.ok(esc.indexOf('아카이브 목록 닫기') >= 0 && esc.indexOf('아카이브 목록 닫기') < esc.indexOf('건물 기록 카드 닫기'), 'Esc 순서: 목록 → 카드');
  const walk = CONTROL_SECTIONS.find((s) => s.id === 'walk').rows.find((r) => /이동 스팟/.test(r.desc));
  assert.match(walk.desc, /건축 A · 전시물 E · 제품 P · 이동 →/);
  // 다른 키와 겹치지 않는다(L 은 한 번만)
  const all = CONTROL_SECTIONS.flatMap((s) => s.rows.flatMap((r) => r.keys));
  assert.equal(all.filter((k) => k === 'L').length, 1);
});

test('(k) 문서: README 에 L · 목록 줄과 ◇ 스팟 카테고리', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  const row = readme.split('\n').find((r) => r.startsWith('| `L` / `목록` 버튼'));
  assert.ok(row, 'README L 줄 없음');
  for (const re of [/아카이브 목록/, /건축 · 전시물 · 제품/, /지금은 목록을 열 수 없습니다/, /화면 전체/]) assert.match(row, re);
  assert.match(readme, /\| ◇ 이동 스팟\(보행 시점\) \|[^\n]*건축 `A` · 전시물 `E` · 제품 `P` · 이동 `→`/);
  assert.match(readme.split('\n').find((r) => r.startsWith('| `Esc` |')), /아카이브 목록 닫기 → 건물 기록 카드 닫기/);
  const building = readme.split('\n').find((r) => r.startsWith('| 건물 감상 모드 |'));
  assert.match(building, /아카이브 목록/, '건물 감상은 목록에서도');
  assert.match(building, /연 자리 · 시선 · 보행 그대로 실내 · 외관으로/, '실내에서 열면 실내로(help.js 감상 Esc 줄과 같은 말)');
});

// ── 동작(가짜 DOM): 떠 있는 동안 키가 뒤 보행(camera.js — 창 버블 단계)으로 새지 않고, Space 는 포커스된 항목을 누르고, Tab 은 패널 안에서 돈다 ──
class FakeEl extends EventTarget {
  constructor(doc, tag) {
    super();
    this.doc = doc;
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.parent = null;
    this.hidden = false;
    this.textContent = '';
    this.className = '';
    this.id = '';
    this.title = '';
    this.dataset = {};
    this.attrs = new Map();
    const cls = new Set();
    this.classList = { toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)), contains: (c) => cls.has(c), add: (c) => cls.add(c), remove: (c) => cls.delete(c) };
  }
  append(...cs) {
    for (const c of cs) {
      c.parent = this;
      this.children.push(c);
    }
  }
  replaceChildren(...cs) {
    this.children = [];
    this.append(...cs);
  }
  insertBefore(c, ref) {
    const i = ref ? this.children.indexOf(ref) : -1;
    c.parent = this;
    if (i < 0) this.children.push(c);
    else this.children.splice(i, 0, c);
  }
  contains(x) {
    for (let n = x; n; n = n.parent) if (n === this) return true;
    return false;
  }
  setAttribute(k, v) {
    this.attrs.set(k, String(v));
  }
  getAttribute(k) {
    return this.attrs.has(k) ? this.attrs.get(k) : null;
  }
  removeAttribute(k) {
    this.attrs.delete(k);
  }
  focus() {
    this.doc.activeElement = this;
  }
  blur() {
    if (this.doc.activeElement === this) this.doc.activeElement = this.doc.body;
  }
  click() {
    this.dispatchEvent(new Event('click'));
  }
}

function fakeDom() {
  const doc = { activeElement: null };
  doc.body = new FakeEl(doc, 'body');
  doc.activeElement = doc.body;
  const actions = new FakeEl(doc, 'div');
  doc.createElement = (tag) => new FakeEl(doc, tag);
  doc.querySelector = (sel) => (sel === '.nw-top-actions' ? actions : null);
  doc.getElementById = () => null;
  return doc;
}

function key(type, k, code, extra = {}) {
  const e = new Event(type, { cancelable: true });
  Object.assign(e, { key: k, code, repeat: false, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false, ...extra });
  return e;
}

test('(n) 동작: 떠 있는 동안 보행 키 · V 는 camera.js 로 가지 않고, Tab 은 패널 안에서 돌고, Space 는 포커스된 항목을 눌러 onGo — Esc 로 닫으면 보행 키가 다시 간다', async () => {
  const saved = { window: globalThis.window, document: globalThis.document };
  const win = new EventTarget();
  const doc = fakeDom();
  globalThis.window = win;
  globalThis.document = doc;
  try {
    const groups = hubIndex({ records, worldLabel: '성수 2041', innerLayout: inner, catalog });
    const went = [];
    const panel = createHubPanel({ load: async () => groups, onGo: (it) => went.push(it.key), isBlocked: () => false });
    // camera.js 흉내: 창 버블 단계, 보행 중 Space 는 keydown · keyup 모두 preventDefault
    const camera = [];
    const cam = (e) => {
      camera.push(`${e.type}:${e.code}`);
      if (e.code === 'Space') e.preventDefault();
    };
    win.addEventListener('keydown', cam);
    win.addEventListener('keyup', cam);
    // 브라우저 흉내: 키 한 번 = keydown → (막히지 않았으면 Enter 는 바로) keyup → (막히지 않았으면 Space 는 keyup 에서) 포커스된 버튼 click
    const press = (k, code, extra) => {
      const d = key('keydown', k, code, extra);
      win.dispatchEvent(d);
      if (code === 'Enter' && !d.defaultPrevented) doc.activeElement.click?.();
      const u = key('keyup', k, code, extra);
      win.dispatchEvent(u);
      if (code === 'Space' && !d.defaultPrevented && !u.defaultPrevented) doc.activeElement.click?.();
    };

    press('l', 'KeyL');
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(panel.isOpen(), true, 'L 로 열림');
    assert.deepEqual(camera, [], '여는 L 도 camera.js 로 가지 않는다');
    const items = () => doc.body.children[0].children[0].children[1].children[1].children.flatMap((sec) => sec.children[1].children.map((li) => li.children[0]));
    assert.equal(doc.activeElement, items()[0], '열면 첫 항목');

    for (const [k, code] of [['w', 'KeyW'], ['a', 'KeyA'], ['s', 'KeyS'], ['d', 'KeyD'], ['q', 'KeyQ'], ['e', 'KeyE'], ['ArrowLeft', 'ArrowLeft'], ['ArrowRight', 'ArrowRight'], ['v', 'KeyV']]) press(k, code);
    assert.deepEqual(camera, [], '보행 키 · V 가 뒤로 새지 않는다');

    // Tab: 첫 항목 → … → 마지막 항목 → 닫기 → 첫 항목(밖으로 나가지 않는다), Shift+Tab 은 거꾸로
    const all = [panel.element.children[0].children[0].children[1], ...items()];
    press('Tab', 'Tab');
    assert.equal(doc.activeElement, items()[1]);
    for (let i = 0; i < all.length - 2; i++) press('Tab', 'Tab');
    assert.equal(doc.activeElement, all[0], '마지막 항목 다음은 닫기 버튼');
    press('Tab', 'Tab');
    assert.equal(doc.activeElement, items()[0], '닫기 다음은 첫 항목');
    press('Tab', 'Tab', { shiftKey: true });
    assert.equal(doc.activeElement, all[0], 'Shift+Tab 은 거꾸로');
    press('ArrowDown', 'ArrowDown');
    press('ArrowDown', 'ArrowDown');
    assert.equal(doc.activeElement, items()[1]);
    assert.deepEqual(camera, [], 'Tab · 화살표도 뒤로 가지 않는다');

    // Space: 포커스된 항목 누르기 → 닫고 onGo
    press(' ', 'Space');
    assert.deepEqual(went, [items()[1].dataset.key], 'Space 로 그 항목');
    assert.equal(panel.isOpen(), false);
    assert.deepEqual(camera, [], 'Space 가 점프로 가지 않는다');

    // 닫힌 뒤에는 보행 키가 그대로 간다
    press('w', 'KeyW');
    assert.deepEqual(camera, ['keydown:KeyW', 'keyup:KeyW']);

    // 다시 열고 Esc → 닫히고 그다음 키는 간다. 열기 전부터 누르던 키의 keyup 은 막지 않는다(camera.js 가 놓은 걸 안다)
    camera.length = 0;
    win.dispatchEvent(key('keydown', 'd', 'KeyD'));
    press('l', 'KeyL');
    await new Promise((r) => setTimeout(r, 0));
    win.dispatchEvent(key('keydown', 'd', 'KeyD', { repeat: true }));
    win.dispatchEvent(key('keyup', 'd', 'KeyD'));
    press('Escape', 'Escape');
    assert.equal(panel.isOpen(), false);
    press('s', 'KeyS');
    assert.deepEqual(camera, ['keydown:KeyD', 'keyup:KeyD', 'keyup:Escape', 'keydown:KeyS', 'keyup:KeyS'], '열기 전 D 의 keyup 은 지나가고, 떠 있는 동안 D 반복 · Esc keydown 은 막고(닫은 뒤의 Esc keyup 은 간다 — 해 없음), 닫힌 뒤 S 는 간다');

    // 떠 있는 동안 W 를 누른 채 Esc 로 닫고, 닫힌 뒤 반복 keydown 이 camera.js 로 간 다음 W 를 떼면 그 keyup 도 camera.js 로 간다
    // (막은 키 목록을 닫을 때 비운다 — 안 비우면 camera.js 가 W 를 눌린 채로 알아 혼자 걷는다)
    camera.length = 0;
    press('l', 'KeyL');
    await new Promise((r) => setTimeout(r, 0));
    win.dispatchEvent(key('keydown', 'w', 'KeyW'));
    press('Escape', 'Escape');
    assert.equal(panel.isOpen(), false);
    win.dispatchEvent(key('keydown', 'w', 'KeyW', { repeat: true }));
    win.dispatchEvent(key('keyup', 'w', 'KeyW'));
    assert.deepEqual(camera, ['keyup:Escape', 'keydown:KeyW', 'keyup:KeyW'], '닫힌 뒤 W 반복 · W keyup 이 camera.js 로 — 눌린 채 남지 않는다');
  } finally {
    globalThis.window = saved.window;
    globalThis.document = saved.document;
    if (saved.window === undefined) delete globalThis.window;
    if (saved.document === undefined) delete globalThis.document;
  }
});
