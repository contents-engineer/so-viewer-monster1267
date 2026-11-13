// HAUS NOWHERE — 실내 전시물(순수, three · DOM 없음 — three 는 cloneExhibit 인자. 테스트: tests/nowhere-exhibits.test.mjs).
// inner-layout.json 각 층 exhibits(id · title · desc · pos — 층 좌표) → 감상 항목 · 감상 목록(showcase.open 의 collection),
// 전시물 → 층 GLB EX_* 노드 대응(EXHIBIT_NODES — 스펙 §2 표), 층 루트에서 그 노드들을 복제한 묶음(감상 무대 모델 — 다시 받지 않는다).
// 넓게 흩어진 묶음(EXHIBIT_PACK — 버섯 몬스터 한 줄 · 지하 카페 격자)은 감상 무대에서만 모은다(층의 배치는 그대로).
// 고르기 판정(exhibit-tags.js 가 쓴다): 이름표 자리(exhibitTagAnchors — 전시물 노드 경계 상자 윗면 가운데 위, 노드가 없으면 exhibitTagAnchor — pos 위) · 보이기(exhibitTagVisible),
// 광선이 맞은 물체 → 전시물(exhibitAt).
// 문구는 inner-layout 값 그대로 쓴다(지어내지 않는다). 엘리베이터(EX_elevator_*)는 전시물이 아니다.
import { breadcrumb } from './products.js';

export const EXHIBIT_TAG_RANGE = 8;     // m — 카메라에서 수평으로 이 안이면 전시물 이름표
export const EXHIBIT_TAG_LIFT = 0.6;    // m — 이름표는 전시물 pos 위 이만큼
export const EXHIBIT_TAG_CEIL_GAP = 0.3; // m — 이름표는 층 천장(floorDef.ceiling)에서 이만큼 아래를 넘지 않는다(카메라 천장 여유와 같은 값)
export const EXHIBIT_PICK_RANGE = 15;   // m — 클릭으로 고를 수 있는 거리
export const CLICK_SLOP = 5;            // px — 이보다 많이 끌었으면 둘러보기 드래그(클릭 아님, retail-display · archive 와 같은 값)
export const EXHIBIT_HINT = '드래그 · 한 손가락 회전 · 휠 · 두 손가락 확대 · ← → 다른 전시물 · Esc 나가기';

// 전시물 id → 층 GLB 노드 이름 규칙: prefix(이 글자로 시작) · exact(이 이름만). 1F 받침대 EX_plinth 는 정확히만(12F EX_plinth_cowboy · 13F EX_plinth_m* 와 갈린다),
// EX_display 는 화면 EX_display_screen(시각 · 기상 캔버스)도 잡는다
export const EXHIBIT_NODES = {
  cafe: { prefix: ['EX_table_', 'EX_guest_'] },
  city_model: { prefix: ['EX_city_'], exact: ['EX_plinth'] },
  dj: { prefix: ['EX_dj'] },
  display: { prefix: ['EX_display'] },
  cowboy: { prefix: ['EX_cowboy', 'EX_plinth_cowboy'] },
  smoking: { prefix: ['EX_smoking'] },
  portal: { prefix: ['EX_portal'] },
  nail: { prefix: ['EX_nail'] },
  sphinx: { prefix: ['EX_sphinx'] },
  monsters: { prefix: ['EX_monster_', 'EX_nameplate_m', 'EX_plinth_m'] },
};

// 감상 무대에서만 모으기: 전시물 id → { cluster(노드 이름) → 묶음 키(없으면 null — 제자리), rank?(키) → 놓는 순서 앞뒤(작을수록 먼저, 같으면 원래 x 순),
// gap(m — 이웃 묶음 경계 상자 사이), columns?(있으면 그 열 수의 격자 — 앞줄이 +z(무대 처음 시선 쪽), 없으면 x 로 한 줄) }.
// 13F 버섯 몬스터는 받침대 넷이 x −11 · −7.5 · 7.5 · 11(가운데 15 m 비어 있음)이라 그대로면 무대 거리 52 m 로 하나하나가 작다 — 몬스터 · 명판 · 받침대를
// 끝 숫자로 한 묶음 삼아 원래 x 순서대로 한 줄로 붙인다. B1F 카페는 테이블 여섯 · 손님 둘이 14 × 10 m 에 흩어져 무대 거리 42 m — 손님이 테이블 번호와
// 맞지 않아 노드마다 한 묶음으로 4 열 2 줄 격자(키 큰 손님 둘은 뒷줄 — 앞줄이면 처음 시선에서 뒤 테이블을 가린다)
export const EXHIBIT_PACK = {
  monsters: { cluster: (nodeName) => /(\d+)$/.exec(nodeName)?.[1] ?? null, gap: 0.6 },
  cafe: { cluster: (nodeName) => nodeName, rank: (key) => (key.startsWith('EX_guest_') ? 1 : 0), gap: 0.6, columns: 4 },
};

/** 노드 이름이 그 전시물 것인지(EXHIBIT_NODES 규칙). 표에 없는 전시물이면 false */
export function exhibitNodeMatch(exhibitId, nodeName) {
  const rule = EXHIBIT_NODES[exhibitId];
  if (!rule || !nodeName) return false;
  return (rule.exact || []).includes(nodeName) || (rule.prefix || []).some((p) => nodeName.startsWith(p));
}

/** 노드가 없을 때의 전시물 이름표 자리: pos(층 좌표) 위 EXHIBIT_TAG_LIFT */
export function exhibitTagAnchor({ pos: [x, y, z] }) {
  return [x, y + EXHIBIT_TAG_LIFT, z];
}

/**
 * 그 층 전시물마다 이름표 자리(층 루트 좌표) { id: [x, y, z] } — 전시물 노드(exhibitNodeMatch, 맞는 노드는 자식째)의 층 루트 좌표 경계 상자
 * 윗면 가운데 위 EXHIBIT_TAG_LIFT(층 루트 변환이 있으면 그 역을 곱한다 — cloneExhibit 과 같은 셈). 노드가 없거나 층 루트가 없으면 pos 위(exhibitTagAnchor).
 * 메시 geometry 경계 상자를 그 메시 → 층 루트 행렬로 옮겨 합친다(three 의 Box3.expandByObject 와 같은 방식). 무대 모으기(EXHIBIT_PACK)는 쓰지 않는다 — 층 배치 그대로
 */
export function exhibitTagAnchors(THREE, root, floorDef) {
  const out = {};
  const exhibits = floorDef?.exhibits || [];
  if (!exhibits.length) return out;
  // 천장 아래로 누른다 — 13F 거대한 손(높이 4 m)은 윗면 + 0.6 m 가 천장(4.2 m)보다 높다
  const yMax = typeof floorDef.ceiling === 'number' ? floorDef.ceiling - EXHIBIT_TAG_CEIL_GAP : Infinity;
  let toFloor = null;
  if (root) {
    root.updateMatrixWorld(true);
    toFloor = root.matrixWorld.clone().invert();
  }
  const m = new THREE.Matrix4();
  const part = new THREE.Box3();
  for (const e of exhibits) {
    const box = new THREE.Box3();
    for (const n of root ? exhibitNodes(root, e.id) : []) {
      n.traverse((o) => {
        const g = o.isMesh ? o.geometry : null;
        if (!g) return;
        if (!g.boundingBox) g.computeBoundingBox();
        box.union(part.copy(g.boundingBox).applyMatrix4(m.multiplyMatrices(toFloor, o.matrixWorld)));
      });
    }
    const a = box.isEmpty() ? exhibitTagAnchor(e) : [(box.min.x + box.max.x) / 2, box.max.y + EXHIBIT_TAG_LIFT, (box.min.z + box.max.z) / 2];
    a[1] = Math.min(a[1], yMax);
    out[e.id] = a;
  }
  return out;
}

/** 전시물 이름표를 보일지: 눈(eye)과 이름표 자리(anchor)의 수평 거리 EXHIBIT_TAG_RANGE 안(높이 차는 보지 않는다) · 화면 안(NDC x · y −1…1, −1 < z < 1 — 카메라 뒤 · far 밖 제외) */
export function exhibitTagVisible({ eye, anchor, ndc: [x, y, z] }) {
  return Math.hypot(anchor[0] - eye[0], anchor[2] - eye[2]) <= EXHIBIT_TAG_RANGE && Math.abs(x) <= 1 && Math.abs(y) <= 1 && z > -1 && z < 1;
}

// 층 루트 아래 그 전시물 노드(맞는 노드는 그 아래를 더 찾지 않는다 — 자식은 노드와 함께 다룬다). 층 노드 순서 그대로
function exhibitNodes(root, exhibitId) {
  const out = [];
  const visit = (parent) => {
    for (const n of parent.children) {
      if (exhibitNodeMatch(exhibitId, n.name)) out.push(n);
      else visit(n);
    }
  };
  visit(root);
  return out;
}

/**
 * 광선이 맞은 물체(object)에서 부모로 올라가며 그 층(floorDef) 전시물 노드를 찾는다 — 맞는 가장 바깥 노드의 전시물 id(cloneExhibit 이 복제하는 단위,
 * 여러 재질 노드 아래 메시처럼 이름이 메시 이름인 자식도 그 전시물). 다른 층 전시물 이름 · 엘리베이터 · 벽 · 진열이면 null
 */
export function exhibitAt(object, floorDef) {
  const ids = (floorDef?.exhibits || []).map((e) => e.id);
  let found = null;
  for (let n = object; n; n = n.parent) {
    const id = ids.find((x) => exhibitNodeMatch(x, n.name));
    if (id) found = id;
  }
  return found;
}

/** 그 층 전시물 → 감상 항목(파일 순서): 이름 = title, 경로 SUPREME ORIGIN > Retail > HAUS 성수 <층> > title, 행 층(층 label) · 설명(desc — 비면 그 행 없음) */
export function exhibitItems(floorDef) {
  return (floorDef?.exhibits || []).map((e) => {
    const rows = [{ label: '층', value: floorDef.label }];
    const desc = String(e.desc || '').trim();
    if (desc) rows.push({ label: '설명', value: desc });
    return {
      id: e.id,
      name: e.title,
      kicker: 'EXHIBIT',
      crumbs: breadcrumb(floorDef.id, e.title),
      rows,
      note: '',
    };
  });
}

/**
 * 전시물 감상 목록 — 같은 층 전시물 순서(이전 · 다음). 모델은 main.js 가 loadLite 로 층 노드 복제(cloneExhibit)를 붙인다.
 * release 를 두지 않는다: 복제는 층과 geometry · 재질을 같이 쓰므로 무대가 닫으며 풀면 층이 깨진다(메모리 추가도 없다)
 */
export function exhibitCollection(floorDef, startId) {
  return {
    kind: 'exhibit',
    items: exhibitItems(floorDef),
    startId,
    hint: EXHIBIT_HINT,
  };
}

/**
 * 층 루트(root)에서 그 전시물 노드들을 월드 행렬째 복제한 묶음(Group, 층 좌표 — 층 루트 변환이 있으면 그 역을 곱한다). 없으면 null.
 * 맞는 노드는 자식째 복제하고 그 아래는 더 찾지 않는다(EX_display 아래 화면이 두 번 들어가지 않게). clone 은 geometry · 재질을 층과 같이 쓴다
 * (1F 화면 캔버스 그대로 — 풀지 않는다). 층은 건드리지 않는다. EXHIBIT_PACK 에 있는 전시물은 복제 묶음 안에서만 묶음을 한 줄로 모은다(packClusters)
 */
export function cloneExhibit(THREE, root, exhibitId) {
  if (!root) return null;
  root.updateMatrixWorld(true);
  const toFloor = root.matrixWorld.clone().invert();
  const group = new THREE.Group();
  group.name = `NW_Exhibit_${exhibitId}`;
  const m = new THREE.Matrix4();
  for (const n of exhibitNodes(root, exhibitId)) {
    const c = n.clone(true);
    m.multiplyMatrices(toFloor, n.matrixWorld).decompose(c.position, c.quaternion, c.scale);
    group.add(c);
  }
  if (!group.children.length) return null;
  if (EXHIBIT_PACK[exhibitId]) packClusters(THREE, group, EXHIBIT_PACK[exhibitId]);
  return group;
}

// 복제 묶음(group — 단위 변환, 자식은 층 좌표) 안에서 묶음 키가 같은 노드끼리 경계 상자를 재고 rank · 원래 가운데 x 순서로 놓는다(키 없는 노드는 제자리).
//  - 한 줄(columns 없음): x 로만 gap 간격으로 붙이고 줄 가운데 = 원래 묶음 전체(경계 상자) 가운데 x. y · z 그대로
//  - 격자(columns): 왼쪽(−x)부터 열, 앞(+z)부터 줄. 열 폭 · 줄 깊이 = 그 열 · 줄에서 가장 큰 상자, 이웃 칸 사이 gap, 묶음은 칸 가운데,
//    격자 가운데 = 원래 가운데(x, z). y 그대로
// 어느 쪽이든 묶음 안 배치 · 회전 · 크기는 그대로(노드 position 만 옮긴다)
function packClusters(THREE, group, { cluster, rank = () => 0, gap, columns = 0 }) {
  group.updateMatrixWorld(true);
  const all = new THREE.Box3().setFromObject(group);
  const byKey = new Map();
  for (const c of group.children) {
    const k = cluster(c.name);
    if (k == null) continue;
    if (!byKey.has(k)) byKey.set(k, { key: k, nodes: [], box: new THREE.Box3() });
    const e = byKey.get(k);
    e.nodes.push(c);
    e.box.union(new THREE.Box3().setFromObject(c));
  }
  if (byKey.size < 2) return;
  const midX = (b) => (b.min.x + b.max.x) / 2;
  const midZ = (b) => (b.min.z + b.max.z) / 2;
  const width = (b) => b.max.x - b.min.x;
  const depth = (b) => b.max.z - b.min.z;
  // 원래 x 는 mm 로 견준다 — 같은 x(카페 테이블 두 줄)는 층 루트 변환의 부동소수 잡음에 흔들리지 않고 층 순서대로
  const mm = (b) => Math.round(midX(b) * 1000);
  const items = [...byKey.values()].sort((a, b) => rank(a.key) - rank(b.key) || mm(a.box) - mm(b.box));
  const move = (e, dx, dz) => {
    for (const n of e.nodes) {
      n.position.x += dx;
      n.position.z += dz;
    }
  };
  const span = (sizes) => sizes.reduce((s, v) => s + v, 0) + gap * (sizes.length - 1);
  if (!columns) {
    let x = midX(all) - span(items.map((e) => width(e.box))) / 2;
    for (const e of items) {
      move(e, x - e.box.min.x, 0);
      x += width(e.box) + gap;
    }
    return;
  }
  const cols = Math.min(columns, items.length);
  const colW = new Array(cols).fill(0);
  const rowD = new Array(Math.ceil(items.length / cols)).fill(0);
  items.forEach((e, i) => {
    colW[i % cols] = Math.max(colW[i % cols], width(e.box));
    rowD[Math.floor(i / cols)] = Math.max(rowD[Math.floor(i / cols)], depth(e.box));
  });
  const colMid = [];
  let x = midX(all) - span(colW) / 2;
  for (const w of colW) {
    colMid.push(x + w / 2);
    x += w + gap;
  }
  const rowMid = [];
  let z = midZ(all) + span(rowD) / 2;
  for (const d of rowD) {
    rowMid.push(z - d / 2);
    z -= d + gap;
  }
  items.forEach((e, i) => move(e, colMid[i % cols] - midX(e.box), rowMid[Math.floor(i / cols)] - midZ(e.box)));
}
