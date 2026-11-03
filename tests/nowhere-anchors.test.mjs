import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/Users/gm_yeonho/new-work/so/so-viewer-monster1267';
const WORLD_SETS = [
  ['seongsu', path.join(ROOT, 'public/assets/nowhere/layout.json'), path.join(ROOT, 'public/assets/nowhere/anchors.ko.json')],
  ['ds2', path.join(ROOT, 'public/assets/nowhere-ds2/layout.json'), path.join(ROOT, 'public/assets/nowhere-ds2/anchors.ko.json')],
];

const ALLOWED_LAYERS = new Set(['building', 'present', 'future', 'nature']);
const FORBIDDEN_PATTERNS = [
  /BRIDGES/i,
  /CyberLife/i,
  /RK800/i,
  /Quantic/i,
  /Kojima/i,
  /Death\s*Stranding/i,
  /Detroit:\s*Become\s*Human/i,
  /데스\s*스트랜딩/,
  /디트로이트/,
  /사이버라이프/,
  /브리지스/,
];

test('(a) anchors.ko.json 키 집합이 layout.json 앵커 id 집합과 일치한다 (seongsu & ds2)', () => {
  for (const [ver, layoutPath, anchorsPath] of WORLD_SETS) {
    assert.ok(fs.existsSync(anchorsPath), `[${ver}] anchors.ko.json 파일이 없다`);
    const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
    const anchorsKo = JSON.parse(fs.readFileSync(anchorsPath, 'utf8'));

    const layoutIds = layout.anchors.map((a) => a.id).sort();
    const koIds = Object.keys(anchorsKo).sort();
    assert.deepEqual(koIds, layoutIds, `[${ver}] id 집합 불일치`);
  }
});

test('(b) 모든 앵커의 스키마(title, kicker, facts >= 1, lore, sources url) 및 레이어별 최소 개수를 충족한다 (seongsu & ds2)', () => {
  for (const [ver, layoutPath, anchorsPath] of WORLD_SETS) {
    const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
    const anchorsKo = JSON.parse(fs.readFileSync(anchorsPath, 'utf8'));

    const counts = { building: 0, present: 0, future: 0, nature: 0 };
    for (const a of layout.anchors) {
      assert.ok(ALLOWED_LAYERS.has(a.layer), `[${ver}] 허용되지 않은 layer (${a.id}): ${a.layer}`);
      counts[a.layer] += 1;

      const entry = anchorsKo[a.id];
      assert.ok(entry, `[${ver}] anchors.ko.json 누락: ${a.id}`);
      assert.equal(entry.layer, a.layer, `[${ver}] ${a.id}: layer 불일치`);
      assert.ok(typeof entry.title === 'string' && entry.title.trim().length > 0, `[${ver}] ${a.id}: title 누락`);
      assert.ok(typeof entry.kicker === 'string' && entry.kicker.trim().length > 0, `[${ver}] ${a.id}: kicker 누락`);
      assert.ok(Array.isArray(entry.facts) && entry.facts.length >= 1, `[${ver}] ${a.id}: facts 최소 1개 필요`);
      for (const pair of entry.facts) {
        assert.ok(Array.isArray(pair) && pair.length === 2 && pair[0] && pair[1], `[${ver}] ${a.id}: 잘못된 fact 쌍`);
      }
      assert.ok(typeof entry.lore === 'string' && entry.lore.trim().length >= 10, `[${ver}] ${a.id}: lore 누락`);
      assert.ok(Array.isArray(entry.sources) && entry.sources.length >= 1, `[${ver}] ${a.id}: sources 누락`);
      for (const s of entry.sources) {
        assert.ok(typeof s.label === 'string' && s.label.length > 0, `[${ver}] ${a.id}: source.label 누락`);
        assert.ok(
          typeof s.url === 'string' && (/^https?:\/\//.test(s.url) || /^(assets|docs)\//.test(s.url)),
          `[${ver}] ${a.id}: 잘못된 source.url (${s.url})`,
        );
      }
    }

    assert.ok(counts.building >= 6, `[${ver}] building 앵커 수 부족: ${counts.building} < 6`);
    assert.ok(counts.present >= 3, `[${ver}] present 앵커 수 부족: ${counts.present} < 3`);
    assert.ok(counts.future >= 3, `[${ver}] future 앵커 수 부족: ${counts.future} < 3`);
    assert.ok(counts.nature >= 3, `[${ver}] nature 앵커 수 부족: ${counts.nature} < 3`);
  }
});

test('(c) anchors.ko.json 및 layout.json 문구에 금지어(게임 고유 명칭)가 없다 (seongsu & ds2)', () => {
  for (const [ver, layoutPath, anchorsPath] of WORLD_SETS) {
    const rawKo = fs.readFileSync(anchorsPath, 'utf8');
    const rawLayout = fs.readFileSync(layoutPath, 'utf8');
    for (const re of FORBIDDEN_PATTERNS) {
      assert.ok(!re.test(rawKo), `[${ver}] anchors.ko.json 에 금지어 포함: ${re}`);
      assert.ok(!re.test(rawLayout), `[${ver}] layout.json 에 금지어 포함: ${re}`);
    }
  }
});
