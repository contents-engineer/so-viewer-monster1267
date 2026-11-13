// HAUS NOWHERE — 건물 아카이브(순수, three · DOM 없음 — 테스트: tests/nowhere-archive.test.mjs).
// 외관 두 건물의 기록(assets/record.json · assets/facearch.json) → 아카이브 카드 · 건물 감상 목록(showcase.open 의 collection),
// 월드 layout.json anchors(layer building) → 부위 표지(건물 로컬 좌표), 카드 트리거(보행 스팟 도착) · 건물 이름표 보이기 판정.
// 문구는 기록 · anchors 값 그대로 쓴다(지어내지 않는다). 좌표는 Three.js(x, y 위, z), 건물 회전은 layout.buildings rotY(도).

export const BUILDING_IDS = ['haus', 'facearch'];   // 감상 이전 · 다음 순서(끝에서 처음으로 돈다)
export const BUILDING_RECORDS = { haus: 'assets/record.json', facearch: 'assets/facearch.json' };
export const BUILDING_TAG_RANGE = 220;   // m — 카메라에서 이 안이면 건물 이름표
export const BUILDING_TAG_LIFT = 4;      // m — 이름표는 모델 경계 상자 윗면 위 이만큼
export const CARD_KEEP_RANGE = 260;      // m — 카드 건물에서 이보다 멀어지면 카드를 닫는다
export const CLICK_SLOP = 5;             // px — 이보다 많이 끌었으면 둘러보기 드래그(클릭 아님, retail-display 와 같은 값)
export const PART_EXCLUDE = ['haus_garden'];   // 부위 표지에서 뺀다(전정 — 건물 모델 밖)
export const ARCHITECTURE_CRUMBS = ['SUPREME ORIGIN', 'Architecture'];
export const BUILDING_HINT = '드래그 · 한 손가락 회전 · 휠 · 두 손가락 확대 · ← → 다른 건물 · Esc 나가기';

const factRows = (facts) => (Array.isArray(facts) ? facts : []).map(([label, value]) => ({ label, value }));

/** 월드 좌표 → 건물 로컬(tour-config.js buildingToWorld 의 역). 건물 · 레이아웃이 없으면 null */
export function worldToBuilding(layout, id, [x, y, z]) {
  const cfg = layout?.buildings?.[id];
  if (!cfg || !Array.isArray(cfg.pos)) return null;
  const th = ((cfg.rotY || 0) * Math.PI) / 180;
  const c = Math.cos(th);
  const s = Math.sin(th);
  const dx = x - cfg.pos[0];
  const dz = z - cfg.pos[2];
  // buildingToWorld(x' = x cosθ + z sinθ, z' = −x sinθ + z cosθ)를 거꾸로 돌린다
  return [dx * c - dz * s, y - cfg.pos[1], dx * s + dz * c];
}

/** 건물 기록 → 감상 항목(카드도 같은 값). 모델은 한 단계(heroUrl — 고해상도 교체 없음) */
export function buildingItem(id, record, heroUrl) {
  return {
    id,
    name: record.title,
    kicker: `ARCHITECTURE · ${record.index}`,
    crumbs: [...ARCHITECTURE_CRUMBS, record.title],
    rows: factRows(record.facts),
    note: record.note || '',
    liteUrl: heroUrl,
    hiUrl: null,
  };
}

/** 건물 감상 목록 — records · heroUrls 는 { haus, facearch }. BUILDING_IDS 순서, 기록 · 모델 주소가 둘 다 있는 건물만 */
export function buildingCollection(records, heroUrls, startId) {
  return {
    kind: 'building',
    items: BUILDING_IDS.filter((id) => records?.[id] && heroUrls?.[id]).map((id) => buildingItem(id, records[id], heroUrls[id])),
    startId,
    hint: BUILDING_HINT,
  };
}

/** 그 건물 부위 표지: layout.anchors 중 layer building · id 가 `<건물>_` 로 시작 · PART_EXCLUDE 아님(파일 순서). local = 건물 로컬 좌표 */
export function buildingParts(layout, id, buildingTitle) {
  if (!layout?.buildings?.[id]) return [];
  return (layout.anchors || [])
    .filter((a) => a.layer === 'building' && String(a.id).startsWith(`${id}_`) && !PART_EXCLUDE.includes(a.id))
    .map((a) => ({
      id: a.id,
      title: a.title,
      local: worldToBuilding(layout, id, a.pos),
      kicker: `${buildingTitle} · PART`,
      rows: factRows(a.facts),
      lore: a.lore || '',
    }));
}

/** 보행 스팟에 도착했을 때 띄울 카드 건물 — 외관 건물 view 스팟만(정문 entrance 는 입장 질문, 실내 스팟은 building 없음). 아니면 null */
export function cardBuildingForSpot(spot) {
  return spot?.building && spot.kind === 'view' ? spot.building : null;
}

/** 건물 이름표를 보일지: 카메라 거리 BUILDING_TAG_RANGE 안 · 화면 안(NDC x · y −1…1, z 는 −1 < z < 1 — 카메라 뒤 · far 밖 제외) */
export function tagVisible({ distance, ndc: [x, y, z] }) {
  return distance <= BUILDING_TAG_RANGE && Math.abs(x) <= 1 && Math.abs(y) <= 1 && z > -1 && z < 1;
}
