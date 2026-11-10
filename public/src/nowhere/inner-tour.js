// HAUS NOWHERE — 실내 층 둘러보기: tour 지점 구간 경로(순수) + 재생기(첫 지점은 화면 전환 컷 · 이후 끊을 수 있는 카메라 비행 · 자막).
// 테스트: tests/nowhere-inner-tour.test.mjs. 입력이 있으면 멈추고 그 자리에서 자유 이동(카메라가 비행을 끊고, 머무는 중 입력은 interior.js 가 stop()).

export const TOUR_DWELL_MS = 1500;   // 지점에 도착해 자막을 읽는 시간
export const LEG_MIN_S = 2;
export const LEG_MAX_S = 8;

/** 시작 시점 → 첫 지점 → 다음 지점 … 구간들. duration 은 그 지점까지 비행 시간(2~8 초로 묶음). */
export function buildTourLegs(start, stops) {
  const legs = [];
  let prev = start;
  for (const s of stops) {
    legs.push({
      points: [prev.pos, s.pos],
      targets: [prev.target, s.target],
      duration: Math.min(LEG_MAX_S, Math.max(LEG_MIN_S, s.duration ?? 4)),
      caption: s.caption || '',
    });
    prev = s;
  }
  return legs;
}

const defaultWait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * camCtrl: { flyTo(path, { interruptible }), stopFlight() }, getView(): { pos, target }(지금 카메라),
 * showCaption(text): 자막 표시('' 이면 숨김). play 를 다시 부르거나 stop() 하면 앞선 재생은 조용히 멈춘다.
 * cut({ pos, target, isCurrent }) (선택, async): 있으면 첫 지점까지는 비행 대신 이것으로 옮긴다(화면 전환 컷) —
 * 사용자가 어디서 시작하든 시작 위치 → 첫 지점 직선 비행이 전시물을 뚫고 지나가지 않게. 지점 사이 구간은 그대로 비행.
 * isCurrent(): 이 재생이 아직 살아 있는지(컷 도중 stop() · 다시 play() 면 false) — 컷은 옮기기 전에 이것으로 확인한다.
 */
export function createTourPlayer({ camCtrl, getView, showCaption, wait = defaultWait, cut = null }) {
  let token = 0;
  let playing = false;

  async function play(stops) {
    const my = ++token;
    playing = true;
    try {
      const legs = buildTourLegs(getView(), stops);
      for (let i = 0; i < legs.length; i++) {
        const leg = legs[i];
        showCaption(leg.caption);
        if (i === 0 && cut) {
          await cut({ pos: stops[0].pos, target: stops[0].target, isCurrent: () => my === token });
          if (my !== token) return 'stopped';   // 컷 도중 stop() · 다시 play()
        } else {
          const r = await camCtrl.flyTo({ points: leg.points, targets: leg.targets, duration: leg.duration }, { interruptible: true });
          if (my !== token || r !== 'done') return 'stopped';
        }
        await wait(TOUR_DWELL_MS);
        if (my !== token) return 'stopped';
      }
      return 'done';
    } finally {
      if (my === token) {
        playing = false;
        showCaption('');
      }
    }
  }

  function stop() {
    if (!playing) return;
    token++;
    playing = false;
    showCaption('');
    camCtrl.stopFlight();
  }

  return { play, stop, isPlaying: () => playing };
}
