import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SEONGSU_INTRO } from '../public/src/nowhere/intro-path.js';

const layout = JSON.parse(readFileSync(new URL('../public/assets/nowhere/layout.json', import.meta.url), 'utf8'));

// 건물 · 고가와의 여유 검사는 tests/nowhere-clearance.test.mjs(layout.solids)가 한다. 전주 · 전선은 지중화로 철거했다.
test('(a) 위치 · 시선 점 개수가 같고, 끝은 성수 거리 시점(layout street)과 같다', () => {
  assert.equal(SEONGSU_INTRO.points.length, SEONGSU_INTRO.targets.length);
  const street = layout.cameras.find((c) => c.id === 'street');
  assert.deepEqual(SEONGSU_INTRO.points.at(-1), street.pos);
  assert.deepEqual(SEONGSU_INTRO.targets.at(-1), street.target);
});
