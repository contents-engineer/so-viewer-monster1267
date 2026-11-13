// HAUS NOWHERE — 카테고리 표지 · 아카이브 목록(순수, three · DOM 없음 — 테스트: tests/nowhere-hub-index.test.mjs).
// 보행 이동 스팟 → 카테고리(spotCategory — spot-markers.js 의 표지 색 · 글자), 지금 있는 출처(건물 기록 · inner-layout exhibits · products.json 진열) →
// 목록 묶음(hubIndex — 새 데이터 파일 없음, 문구는 출처 값 그대로), 목록 항목 → 지금 상태에서 할 일(goPlan — 실행은 main.js).
import { BUILDING_IDS } from './archive.js';
import { floorDisplays, floorCrumb } from './products.js';

// 스펙 §2 표 — 목록 묶음 순서도 이 순서(이동은 목록에 없다)
export const CATEGORIES = [
  { id: 'architecture', label: '건축', glyph: 'A' },
  { id: 'exhibit', label: '전시물', glyph: 'E' },
  { id: 'product', label: '제품', glyph: 'P' },
  { id: 'move', label: '이동', glyph: '→' },
];

const MOVE_KINDS = ['entrance', 'elevator', 'exit'];

/** 스팟(walk-spots.js 형식) → 카테고리 id: 정문 · 엘리베이터 · 출구 → move, 제품 → product, 건물 view → architecture, 실내 view → exhibit */
export function spotCategory(spot) {
  if (MOVE_KINDS.includes(spot.kind)) return 'move';
  if (spot.kind === 'product') return 'product';
  return spot.building ? 'architecture' : 'exhibit';
}

// 항목 key = 카테고리 · 층(있으면) · id — 목록 안에서 하나뿐
const item = (category, id, title, place, floor) => ({
  key: [category, floor, id].filter((v) => v != null).join(':'),
  category,
  id,
  title,
  place,
  ...(floor != null ? { floor } : {}),
});

/**
 * 아카이브 목록 묶음 [{ id, label, items: [{ key, category, id, title, place, floor? }] }] — 건축 · 전시물 · 제품 순서, 항목이 없는 묶음은 뺀다.
 * records = { haus, facearch }(건물 기록, BUILDING_IDS 순서) · worldLabel = 지금 월드 이름(건축 자리 '<월드> · 외관'),
 * innerLayout = inner-layout.json(층 순서 · 층 안 전시물 순서), catalog = products.js validateCatalog 결과(진열 층 · 진열 순서 — 진열에 없는 제품은 없다)
 */
export function hubIndex({ records, worldLabel, innerLayout, catalog }) {
  const architecture = BUILDING_IDS.filter((id) => records?.[id]).map((id) => item('architecture', id, records[id].title, `${worldLabel} · 외관`));
  const exhibit = (innerLayout?.floors || []).flatMap((f) => (f.exhibits || []).map((e) => item('exhibit', e.id, e.title, floorCrumb(f.id), f.id)));
  const floors = [...new Set((catalog?.displays || []).map((d) => d.floor))];
  const product = floors.flatMap((floor) => floorDisplays(catalog, floor).map((d) => item('product', d.product.id, d.product.name, floorCrumb(floor), floor)));
  const items = { architecture, exhibit, product };
  return CATEGORIES.filter((c) => items[c.id]?.length).map((c) => ({ id: c.id, label: c.label, items: items[c.id] }));
}

/**
 * 목록 항목으로 가기 — 지금 상태({ interiorActive, floorId })에서 할 일 순서: 'enter'(실내 들어가기) · 'floor'(그 층으로) · 'open'(감상).
 * 건축은 외관 · 실내 어디서든 바로 감상. 전시물 · 제품은 밖이면 들어간 뒤 층을 맞춘다(들어간 기본 층이 그 층이면 floor 를 건너뛰는 것은 실행 쪽)
 */
export function goPlan(it, { interiorActive, floorId }) {
  if (it.category === 'architecture') return ['open'];
  return [...(interiorActive ? [] : ['enter']), ...(floorId === it.floor && interiorActive ? [] : ['floor']), 'open'];
}
