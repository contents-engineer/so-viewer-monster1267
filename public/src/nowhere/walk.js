// HAUS NOWHERE — 보행 시점 몸 물리(게임 방식): Shift 달리기, Space 점프, 중력 낙하·착지.
// three 의존 없는 순수 모듈(테스트: tests/nowhere-walk.test.mjs). 높이는 Three.js y(위 +).

export const WALK_SPEED = 5.0;    // m/s
export const RUN_SPEED = 10.0;    // m/s (Shift)
export const JUMP_SPEED = 7.0;    // m/s → 최고 높이 v²/2g ≈ 1.11 m, 체공 ≈ 0.64 s
export const GRAVITY = 22.0;      // m/s² (게임처럼 실제보다 강하게 — 경쾌한 점프)
export const SNAP_DOWN = 0.5;     // 접지 중 이보다 큰 낙차(바위·낭떠러지에서 내려섬)는 떨어진다
export const STEP_UP = 0.35;      // 이 높이까지의 턱은 걸어서 오른다
export const MAX_CLIMB = 1.2;     // 보행으로 오를 수 있는 최대 경사(높이/수평 ≈ 50°) — 암벽은 걸어 오를 수 없다(길 찾기도 같은 값)

export function walkSpeed(keys) {
  return keys.has('ShiftLeft') || keys.has('ShiftRight') ? RUN_SPEED : WALK_SPEED;
}

/**
 * 몸의 수직 상태 body = { feetY, vy, grounded } 를 dt 초 진행한다. support 는 지금 발밑 표면 높이(지면 또는 올라선 바위 윗면).
 * jump 는 이번 프레임에 눌린 점프 입력(접지 중일 때만 유효 — 이단 점프 없음).
 */
export function stepBody(body, support, dt, jump = false) {
  if (body.grounded) {
    if (jump) {
      body.vy = JUMP_SPEED;
      body.grounded = false;
    } else if (support < body.feetY - SNAP_DOWN) {
      body.vy = 0;
      body.grounded = false;
    } else {
      body.feetY = support;
      body.vy = 0;
      return body;
    }
  }
  body.vy -= GRAVITY * dt;
  body.feetY += body.vy * dt;
  if (body.feetY <= support) {
    body.feetY = support;
    body.vy = 0;
    body.grounded = true;
  }
  return body;
}
