// HAUS NOWHERE — 1F 디스플레이 화면: 문구(순수) + CanvasTexture 화면(THREE 를 인자로 받아 node:test 에서 three 없이 import).
// 테스트: tests/nowhere-inner-display.test.mjs. 화면 메시는 빌드가 만든 EX_display_screen(UV 0…1, +x 를 봄).

import { clockText } from './weather.js';

export const DISPLAY_TITLE = 'HAUS NOWHERE SEOUL';
export const WEATHER_LABEL = { overcast: '흐림', rain: '비', snow: '눈' };

/** [제목, 시각 글자('HH:MM' — 월드 시각이면 clockText(hour), HUD 와 같은 글자), 기상 이름(모르면 그대로)] */
export function displayLines(time, weatherName) {
  return [DISPLAY_TITLE, time, WEATHER_LABEL[weatherName] ?? (weatherName || '')];
}

/** 월드 시각을 모를 때 쓰는 실제 시계 'HH:MM' */
export function nowClockText(d = new Date()) {
  return clockText(d.getHours() + d.getMinutes() / 60);
}

/** 같은 시각 글자(분) · 같은 기상이면 다시 그리지 않도록 쓰는 키 */
export function displayKey(time, weatherName) {
  return `${time}|${weatherName || ''}`;
}

/**
 * mesh(EX_display_screen)에 캔버스 화면을 입힌다. update(time) 은 시각 글자('HH:MM') · 기상이 바뀔 때만 다시 그린다(스펙: 1 분마다 갱신).
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

  function draw(timeText, weatherName) {
    const [title, time, wx] = displayLines(timeText, weatherName);
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

  function update(time = nowClockText()) {
    const w = getWeather();
    const k = displayKey(time, w);
    if (k === lastKey) return false;
    lastKey = k;
    draw(time, w);
    return true;
  }

  update();
  return { update, texture, canvas };
}
