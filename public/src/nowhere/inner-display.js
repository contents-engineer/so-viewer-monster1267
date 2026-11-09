// HAUS NOWHERE — 1F 디스플레이 화면: 문구(순수) + CanvasTexture 화면(THREE 를 인자로 받아 node:test 에서 three 없이 import).
// 테스트: tests/nowhere-inner-display.test.mjs. 화면 메시는 빌드가 만든 EX_display_screen(UV 0…1, +x 를 봄).

export const DISPLAY_TITLE = 'HAUS NOWHERE SEOUL';
export const WEATHER_LABEL = { overcast: '흐림', rain: '비', snow: '눈' };

/** [제목, 'HH:MM'(24시, 두 자리), 기상 이름(모르면 그대로)] */
export function displayLines(date, weatherName) {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return [DISPLAY_TITLE, `${hh}:${mm}`, WEATHER_LABEL[weatherName] ?? (weatherName || '')];
}

/**
 * 월드 시각(시간 슬라이더 hour, 0~24 소수) → 오늘 날짜의 그 시 · 분 Date. HUD(weather.js timeLabel)처럼 분은 반올림하고
 * 60 분이면 다음 시로 넘긴다. Date 는 24:00 을 못 나타내므로 24 는 같은 순간인 다음 날 00:00 이 된다.
 */
export function worldHourDate(hour, base = new Date()) {
  let hh = Math.floor(hour);
  let mm = Math.round((hour - hh) * 60);
  if (mm === 60) {
    hh += 1;
    mm = 0;
  }
  const d = new Date(base.getTime());
  d.setHours(hh, mm, 0, 0);
  return d;
}

/** 같은 분 · 같은 기상이면 다시 그리지 않도록 쓰는 키 */
export function displayKey(date, weatherName) {
  return `${Math.floor(date.getTime() / 60000)}|${weatherName || ''}`;
}

/**
 * mesh(EX_display_screen)에 캔버스 화면을 입힌다. update(date) 는 분 · 기상이 바뀔 때만 다시 그린다(스펙: 1 분마다 갱신).
 * glTF UV 는 위가 v=0 이라 flipY=false. 화면은 조명과 무관하게 밝게(MeshBasicMaterial, toneMapped=false).
 */
export function createDisplayScreen({ THREE, mesh, getWeather, width = 1024, height = 512 }) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.anisotropy = 4;
  mesh.material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  let lastKey = null;

  // 글자 크기 · 세로 위치는 캔버스 높이에 비례(512 px 기준값), 왼쪽 여백은 폭에 비례(1024 px 기준) — 화면 비율에 맞춘 캔버스에서도 같은 배치
  const u = height / 512;
  const px = (n) => Math.round(n * u);
  const left = Math.round(64 * (width / 1024));

  function draw(date, weatherName) {
    const [title, time, wx] = displayLines(date, weatherName);
    ctx.fillStyle = '#05070A';
    ctx.fillRect(0, 0, width, height);
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#6FD3FF';
    ctx.font = `600 ${px(56)}px ui-monospace, "SFMono-Regular", Menlo, monospace`;
    ctx.fillText(title, left, px(64));
    ctx.fillStyle = '#F4F1EA';
    ctx.font = `700 ${px(180)}px ui-monospace, "SFMono-Regular", Menlo, monospace`;
    ctx.fillText(time, left, px(150));
    ctx.fillStyle = '#B9C7CC';
    ctx.font = `500 ${px(56)}px system-ui, sans-serif`;
    ctx.fillText(wx, left, px(370));
    texture.needsUpdate = true;
  }

  function update(date = new Date()) {
    const w = getWeather();
    const k = displayKey(date, w);
    if (k === lastKey) return false;
    lastKey = k;
    draw(date, w);
    return true;
  }

  update();
  return { update, texture, canvas };
}
