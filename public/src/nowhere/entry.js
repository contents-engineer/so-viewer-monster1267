// HAUS NOWHERE — 시작 결정(순수, three · DOM 없음 — 테스트: tests/nowhere-entry.test.mjs).
// 주소 매개변수 + 페이지 기본 월드(window.__NW_DEFAULT_WORLD: index.html 없음 · nowhere.html 'seongsu' · nowhere-mountain.html 'ds2') →
// { select: 월드 선택 화면을 띄울지, world, intro: 인트로를 돌릴지, mode: 둘러보기 방식(null 이면 인트로 뒤 방식 고르기) }.
// 선택 화면에서 고른 뒤에는 { world: 고른 것, intro: true, mode: null } 로 이어 간다(주소는 바꾸지 않는다).

export const WORLD_IDS = ['seongsu', 'ds2'];
export const MODE_IDS = ['guide', 'walk', 'free'];

export function resolveEntry(params, defaultWorld = null) {
  const get = (key) => (params && typeof params.get === 'function' ? params.get(key) : null) || '';
  // 바로가기 링크(캡처 · 테스트 주소): 시점 · 기상 · 시각 중 하나라도 있으면 지금처럼 그 시점 · 자유 시점으로 바로
  const deep = Boolean(get('cam') || get('weather') || get('time'));
  const noIntro = get('noIntro') === '1';
  const modeParam = MODE_IDS.includes(get('mode')) ? get('mode') : null;
  let world = WORLD_IDS.includes(get('ver')) ? get('ver') : WORLD_IDS.includes(defaultWorld) ? defaultWorld : null;
  // 선택 화면은 월드가 정해지지 않았고 바로가기 · noIntro=1 · mode 가 모두 없을 때만
  const select = world === null && !deep && !noIntro && !modeParam;
  if (!select && world === null) world = 'seongsu';
  return {
    select,
    world,
    intro: !deep && !noIntro,
    mode: modeParam || (deep || noIntro ? 'free' : null),
  };
}
