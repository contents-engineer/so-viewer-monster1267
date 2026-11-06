// HAUS NOWHERE — 보행 시점 키 시선(게임 방식): ↑/↓ 올려다보기·내려다보기, ←/→ 좌우로 돌아보기.
// 이동은 WASD 가 맡는다. three 의존 없는 순수 모듈(테스트: tests/nowhere-look.test.mjs). 좌표는 Three.js(시선 기본 −Z, 위 +Y).

export const LOOK_LIMIT = (80 * Math.PI) / 180;   // 상하 시선 한계 ±80°

/**
 * 현재 시선 방향 dir 에 누르고 있는 시선 키(keys: KeyboardEvent.code 집합)를 dt 초만큼 반영한 단위 방향을 돌려준다.
 * yaw(방위)는 +Y 축 기준, pitch(앙각)는 수평면 기준이며 ±LOOK_LIMIT 로 제한한다.
 */
export function stepLook(dir, keys, dt, { yawSpeed = (100 * Math.PI) / 180, pitchSpeed = (70 * Math.PI) / 180, limit = LOOK_LIMIT } = {}) {
  let yaw = Math.atan2(dir.x, dir.z);
  let pitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
  if (keys.has('ArrowLeft')) yaw += yawSpeed * dt;
  if (keys.has('ArrowRight')) yaw -= yawSpeed * dt;
  if (keys.has('ArrowUp')) pitch += pitchSpeed * dt;
  if (keys.has('ArrowDown')) pitch -= pitchSpeed * dt;
  pitch = Math.max(-limit, Math.min(limit, pitch));
  const c = Math.cos(pitch);
  return { x: c * Math.sin(yaw), y: Math.sin(pitch), z: c * Math.cos(yaw) };
}
