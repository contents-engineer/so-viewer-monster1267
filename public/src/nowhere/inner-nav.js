// HAUS NOWHERE — 실내 층 이동 · 영역 판정(순수, three 없음). 테스트: tests/nowhere-inner-nav.test.mjs

/** 엘리베이터 패널처럼 위층부터(13 · 12 · 1 · B1). 원본 배열은 바꾸지 않는다. */
export function floorOrder(layout) {
  return [...layout.floors].sort((a, b) => b.elevation - a.elevation);
}

/** HUD 층 버튼 문구: b1 → 'B1', 그 밖은 id 그대로('1' · '12' · '13') */
export function shortLabel(floor) {
  return floor.id === 'b1' ? 'B1' : String(floor.id);
}

/** 「층 선택」 모달 버튼: 현재 층을 뺀 층 이름(위층부터) + 닫기(취소) */
export function elevatorButtons(layout, currentId) {
  return [
    ...floorOrder(layout)
      .filter((f) => f.id !== currentId)
      .map((f) => ({ id: f.id, label: f.label })),
    { id: 'close', label: '닫기', cancel: true },
  ];
}

/** 수평 거리(x, z)로 원형 영역 안인지 — area: { pos: [x, y, z], radius } */
export function inArea(pos, area) {
  return Math.hypot(pos.x - area.pos[0], pos.z - area.pos[2]) <= area.radius;
}

/**
 * 영역에 들어갈 때 한 번만 true. 나갔다 다시 들어오면 또 true.
 * enabled=false(보행 아님)면 묻지 않되 무장은 유지한다 — 영역 안에서 보행으로 바꾸면 그때 묻는다.
 */
export function createAreaTrigger() {
  let armed = true;
  return {
    update(inside, enabled = true) {
      if (!inside) {
        armed = true;
        return false;
      }
      if (armed && enabled) {
        armed = false;
        return true;
      }
      return false;
    },
    reset() {
      armed = true;
    },
  };
}

// 노드 이름 사슬('자기|부모|…|')에서 규칙 이름(IN_floor* · IN_ceiling*)이 어느 노드 이름의 앞머리에 있는지 — 중간 일치는 제외
export const isFloorChain = (chain) => /(^|\|)IN_floor/.test(chain);
export const isCeilingChain = (chain) => /(^|\|)IN_ceiling/.test(chain);
