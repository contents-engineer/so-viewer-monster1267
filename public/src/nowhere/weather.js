// HAUS NOWHERE — 성수 2041: 기상·시간 프리셋 5종(흐림·비·황혼·밤·눈) 및 선형 RGB / 수치 보간 순수 함수.

export function srgbToLinear(c) {
  const v = Math.max(0, Math.min(1, c));
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function linearToSrgb(c) {
  const v = Math.max(0, Math.min(1, c));
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

export function parseHexLinear(hex) {
  const s = String(hex).replace('#', '').trim();
  const num = parseInt(s, 16);
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  return [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
}

export function formatHexFromLinear([lr, lg, lb]) {
  const r = Math.round(linearToSrgb(lr) * 255);
  const g = Math.round(linearToSrgb(lg) * 255);
  const b = Math.round(linearToSrgb(lb) * 255);
  const to2 = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0').toUpperCase();
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

export function lerpColorHex(hexA, hexB, t) {
  const u = Math.max(0, Math.min(1, t));
  const a = parseHexLinear(hexA);
  const b = parseHexLinear(hexB);
  return formatHexFromLinear([
    a[0] + (b[0] - a[0]) * u,
    a[1] + (b[1] - a[1]) * u,
    a[2] + (b[2] - a[2]) * u,
  ]);
}

export const PRESETS = {
  overcast: {
    uWet: 0.55,
    uRain: 0.0,
    uSnow: 0.0,
    uNight: 0.0,
    uFogB: 0.0026,
    uFogK: 0.045,
    fogColor: '#D2D9D7',
    fogFarColor: '#C4CDCF',
    skyHorizon: '#E7E9E4',
    skyZenith: '#C5CFCF',
    skyGround: '#3E423F',
    exposure: 0.80,
    saturation: 0.78,
    uEmitGain: 0.30,
    sunIntensity: 1.35,
    sunColor: '#FFF4E6',
    hemiIntensity: 0.95,
    envIntensity: 0.85,
    sunHaze: 0.0,
  },
  rain: {
    uWet: 1.0,
    uRain: 1.0,
    uSnow: 0.0,
    uNight: 0.15,
    uFogB: 0.0072,
    uFogK: 0.035,
    fogColor: '#4F6A76',
    fogFarColor: '#465D68',
    skyHorizon: '#6E838C',
    skyZenith: '#3E4F57',
    skyGround: '#242E33',
    exposure: 0.72,
    saturation: 0.70,
    uEmitGain: 0.60,
    sunIntensity: 0.45,
    sunColor: '#C8D8E0',
    hemiIntensity: 0.72,
    envIntensity: 0.75,
    sunHaze: 0.0,
  },
  dusk: {
    uWet: 0.40,
    uRain: 0.0,
    uSnow: 0.0,
    uNight: 0.42,
    uFogB: 0.0036,
    uFogK: 0.050,
    fogColor: '#E9B886',
    fogFarColor: '#C99B78',
    skyHorizon: '#F1BE84',
    skyZenith: '#8A90A0',
    skyGround: '#322B28',
    exposure: 0.86,
    saturation: 0.95,
    uEmitGain: 0.80,
    sunIntensity: 1.55,
    sunColor: '#FFB870',
    hemiIntensity: 0.80,
    envIntensity: 0.78,
    sunHaze: 0.0,
  },
  night: {
    uWet: 0.80,
    uRain: 0.25,
    uSnow: 0.0,
    uNight: 1.0,
    uFogB: 0.0048,
    uFogK: 0.040,
    fogColor: '#1E2A3A',
    fogFarColor: '#162030',
    skyHorizon: '#2A3550',
    skyZenith: '#0B1020',
    skyGround: '#07090C',
    exposure: 0.82,
    saturation: 0.85,
    uEmitGain: 1.0,
    sunIntensity: 0.22,
    sunColor: '#6E86B0',
    hemiIntensity: 0.55,
    envIntensity: 0.65,
    sunHaze: 0.0,
  },
  snow: {
    uWet: 0.20,
    uRain: 0.0,
    uSnow: 1.0,
    uNight: 0.0,
    uFogB: 0.0058,
    uFogK: 0.030,
    fogColor: '#E2DDD3',
    fogFarColor: '#D6D3CB',
    skyHorizon: '#EDEAE3',
    skyZenith: '#C9CCCD',
    skyGround: '#6B6E6E',
    exposure: 0.88,
    saturation: 0.65,
    uEmitGain: 0.50,
    sunIntensity: 0.85,
    sunColor: '#F7F5EE',
    hemiIntensity: 1.05,
    envIntensity: 0.90,
    sunHaze: 0.0,
  },
};

// DS2 산악 월드 덮어쓰기 — 참조 화면(빙하 계곡 역광 헤이즈)의 읽기:
//   해는 계곡 상류(북북동) 암벽 너머 낮은 고도, 그 주변 하늘이 하얗게 번진다(sunHaze).
//   계곡 공기는 회청색 연무가 높이까지 차 있어(uFogK 작게) 300 m 밖 암벽부터 밝게 지워지고, 근경은 역광이라 어둡고 대비가 강하다.
//   Blender 쪽 같은 값: tools/nowhere/blender/ds2_look.py
export const DS2_OVERRIDES = {
  overcast: {
    uWet: 0.5,
    uFogB: 0.0015,
    uFogK: 0.012,
    fogColor: '#AEB6B8',
    fogFarColor: '#C8CED0',
    skyHorizon: '#C9CECD',
    skyZenith: '#9FA8AB',
    skyGround: '#2C302C',
    exposure: 0.8,
    saturation: 0.84,
    sunIntensity: 2.3,
    sunColor: '#FFF0DC',
    hemiIntensity: 0.8,
    envIntensity: 0.8,
    sunHaze: 1.0,
  },
  rain: { uFogB: 0.0042, uFogK: 0.012, sunHaze: 0.12 },
  dusk: { uFogB: 0.0024, uFogK: 0.014, sunHaze: 0.85 },
  night: { uFogB: 0.0032, uFogK: 0.014, sunHaze: 0.0 },
  snow: { uFogB: 0.0036, uFogK: 0.012, sunHaze: 0.45 },
};

/** 월드 버전별 프리셋 표(성수 = PRESETS 그대로, DS2 = DS2_OVERRIDES 덮어쓰기). */
export function getPresets(worldVer = 'seongsu') {
  if (worldVer !== 'ds2') return PRESETS;
  const out = {};
  for (const [name, base] of Object.entries(PRESETS)) {
    out[name] = { ...base, ...(DS2_OVERRIDES[name] || {}) };
  }
  return out;
}

export function lerp(a, b, t) {
  const u = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
  const out = {};
  for (const key of Object.keys(a)) {
    const va = a[key];
    const vb = b[key];
    if (typeof va === 'number' && typeof vb === 'number') {
      out[key] = va + (vb - va) * u;
    } else if (typeof va === 'string' && va.startsWith('#') && typeof vb === 'string' && vb.startsWith('#')) {
      out[key] = lerpColorHex(va, vb, u);
    } else {
      out[key] = u < 0.5 ? va : vb;
    }
  }
  return out;
}

// ── 기상 × 시간 분리 ──────────────────────────────────────────────────────────────
// 기상(흐림·비·눈)과 시간(0~24시)을 따로 고른다. 기존 '황혼'·'밤' 프리셋은 시간 키프레임이 되고,
// 최종 상태 = 시간이 정하는 빛(밤 정도·해 색과 세기·하늘/안개 색) × 기상이 주는 변화(젖음·비·눈·안개 밀도·하늘색 비율).
// 14:00 에서는 기존 흐림·비·눈 프리셋과 같은 값이 나온다(테스트 tests/nowhere-weather.test.mjs).

export const WEATHER_NAMES = ['overcast', 'rain', 'snow'];
export const DAY_HOUR = 14;          // 기준 시각: 각 월드의 설계 해 방향(대표 렌더)과 같은 시각
export const TIME_QUICK = { day: 14, dusk: 18.5, night: 21.5 };
const SUNRISE = 6.0;
const SUNSET = 18.5;
// [시각, 시간 프리셋]: 이 사이를 선형 보간
const TIME_KEYS = [
  [0, 'night'], [4.5, 'night'], [6.25, 'dusk'], [8.5, 'overcast'],
  [16.5, 'overcast'], [18.5, 'dusk'], [20.5, 'night'], [24, 'night'],
];
const COLOR_KEYS = ['fogColor', 'fogFarColor', 'skyHorizon', 'skyZenith', 'skyGround', 'sunColor'];

function clampHour(h) {
  return Math.max(0, Math.min(24, Number.isFinite(h) ? h : DAY_HOUR));
}

/** 시각 hour 의 '흐림 기준' 빛 상태(시간 키프레임 보간). */
export function timeLight(presets, hour) {
  const h = clampHour(hour);
  for (let i = 0; i < TIME_KEYS.length - 1; i++) {
    const [h0, p0] = TIME_KEYS[i];
    const [h1, p1] = TIME_KEYS[i + 1];
    if (h >= h0 && h <= h1) return lerp(presets[p0], presets[p1], (h - h0) / (h1 - h0));
  }
  return { ...presets.night };
}

// 선형 RGB 채널별로 base × (weather / day) — 기상이 하늘·안개 색을 얼마나 바꾸는지를 시간의 색에 곱한다
function mulRatioHex(baseHex, weatherHex, dayHex) {
  const b = parseHexLinear(baseHex);
  const w = parseHexLinear(weatherHex);
  const d = parseHexLinear(dayHex);
  return formatHexFromLinear(b.map((v, i) => Math.min(1, (d[i] > 1e-4 ? w[i] / d[i] : 1) * v)));
}

/** 기상 weatherName × 시각 hour 의 최종 상태(키 집합은 프리셋과 같다). */
export function composeState(presets, weatherName, hour) {
  const day = presets.overcast;
  const w = presets[weatherName] || day;
  const t = timeLight(presets, hour);
  const ratio = (k) => (day[k] !== 0 ? w[k] / day[k] : 1);
  const out = { ...t };
  for (const k of COLOR_KEYS) out[k] = mulRatioHex(t[k], w[k], day[k]);
  out.uNight = Math.max(t.uNight, w.uNight);
  out.uRain = w.uRain;
  out.uSnow = w.uSnow;
  out.uWet = Math.min(1, w.uWet + (t.uWet - day.uWet) * (1 - w.uWet));   // 밤이슬 등 시간에 따른 젖음은 마른 기상일수록 더 보탠다
  out.uFogB = t.uFogB * ratio('uFogB');
  out.uFogK = t.uFogK * ratio('uFogK');
  out.exposure = t.exposure + (w.exposure - day.exposure);
  out.saturation = t.saturation * ratio('saturation');
  out.uEmitGain = Math.max(t.uEmitGain, w.uEmitGain);
  out.sunIntensity = t.sunIntensity * ratio('sunIntensity');
  out.hemiIntensity = t.hemiIntensity * ratio('hemiIntensity');
  out.envIntensity = t.envIntensity * ratio('envIntensity');
  out.sunHaze = day.sunHaze > 0 ? t.sunHaze * (w.sunHaze / day.sunHaze) : t.sunHaze;
  return out;
}

/**
 * 시각 hour 의 해 방향(Three.js 단위 벡터)과 조명 방향. baseDir 는 기준 시각(14:00)의 해 방향(월드 설계값).
 * 해는 06:00 에 떠서 18:30 에 지고(고도 사인 곡선, 14:00 에 baseDir 고도), 방위는 시간당 15° 돈다.
 * 해가 지평선 아래면 조명은 달빛 방향(해 반대 방위, 고도 35°)으로 넘어간다.
 */
export function sunDirAt(hour, baseDir, baseHour = DAY_HOUR) {
  const h = clampHour(hour);
  const L = Math.hypot(baseDir[0], baseDir[1], baseDir[2]) || 1;
  const bx = baseDir[0] / L;
  const by = baseDir[1] / L;
  const bz = baseDir[2] / L;
  const az0 = Math.atan2(bx, -bz);
  const el0 = Math.asin(Math.max(-1, Math.min(1, by)));
  const dayLen = SUNSET - SUNRISE;
  const s0 = Math.sin((Math.PI * (baseHour - SUNRISE)) / dayLen);
  const elMax = s0 > 1e-3 ? el0 / s0 : el0;
  const el = elMax * Math.sin((Math.PI * (h - SUNRISE)) / dayLen);
  const az = az0 + ((h - baseHour) * 15 * Math.PI) / 180;
  const dir = (a, e) => ({ x: Math.sin(a) * Math.cos(e), y: Math.sin(e), z: -Math.cos(a) * Math.cos(e) });
  const sun = dir(az, el);
  const moon = dir(az0 + Math.PI, (35 * Math.PI) / 180);
  const k = Math.max(0, Math.min(1, (el + 0.05) / 0.13));
  const t = k * k * (3 - 2 * k);
  const sunUp = dir(az, Math.max(el, 0.02));
  const lx = moon.x + (sunUp.x - moon.x) * t;
  const ly = moon.y + (sunUp.y - moon.y) * t;
  const lz = moon.z + (sunUp.z - moon.z) * t;
  const ll = Math.hypot(lx, ly, lz) || 1;
  return { sun, light: { x: lx / ll, y: ly / ll, z: lz / ll }, elevation: el };
}

/** URL time= 값: '21.5' 또는 '21:30' → 21.5 (0~24 밖·형식 오류는 null). */
export function parseTimeParam(v) {
  if (v == null) return null;
  const m = String(v).trim().match(/^(\d{1,2})(?::(\d{1,2}))?$|^(\d{1,2}(?:\.\d+)?)$/);
  if (!m) return null;
  const h = m[3] != null ? parseFloat(m[3]) : parseInt(m[1], 10) + (m[2] != null ? parseInt(m[2], 10) / 60 : 0);
  return h >= 0 && h <= 24 ? h : null;
}

/** '18:30 · 황혼' 형식의 시각·시간대 이름. */
export function timeLabel(hour) {
  const h = clampHour(hour);
  let hh = Math.floor(h);
  let mm = Math.round((h - hh) * 60);
  if (mm === 60) {
    hh += 1;
    mm = 0;
  }
  const name = h < 5 ? '밤' : h < 7 ? '새벽' : h < 17 ? '낮' : h < 19.5 ? '황혼' : '밤';
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · ${name}`;
}

/**
 * 기상·시간 컨트롤러. 기상은 setWeather('overcast'|'rain'|'snow'), 시간은 setTime(0~24).
 * 기존 API setPreset('overcast'|'rain'|'dusk'|'night'|'snow') 도 유지한다(dusk·night 는 시간으로 옮겨 적용).
 * sunBaseDir 가 있으면 시각에 따라 해(하늘 헤이즈·안개 산란광)와 키 라이트(밤엔 달빛) 방향을 움직인다.
 */
export function createWeatherController({
  world,
  post,
  renderer,
  initialPreset = 'overcast',
  initialHour = null,
  duration = 2.5,
  timeDuration = 0.6,
  presets = PRESETS,
  sunBaseDir = null,
}) {
  let weatherName = WEATHER_NAMES.includes(initialPreset) ? initialPreset : 'overcast';
  let hour = Number.isFinite(initialHour)
    ? clampHour(initialHour)
    : initialPreset === 'dusk'
      ? TIME_QUICK.dusk
      : initialPreset === 'night'
        ? TIME_QUICK.night
        : DAY_HOUR;
  let currentState = composeState(presets, weatherName, hour);
  let fromState = { ...currentState };
  let targetState = { ...currentState };
  let currentHour = hour;
  let fromHour = hour;
  let targetHour = hour;
  let curDuration = duration;
  let elapsed = duration;
  let lastEnvAt = 0;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  function applySun(h) {
    if (!sunBaseDir || !world.uniforms.uSunDir) return;
    const sd = sunDirAt(h, sunBaseDir);
    world.uniforms.uSunDir.value.set(sd.sun.x, sd.sun.y, sd.sun.z);
    world.lights.sunLight.position.set(sd.light.x * 240, sd.light.y * 240, sd.light.z * 240);
  }

  function applyStateToScene(st, refreshEnv = false) {
    const u = world.uniforms;
    u.uWet.value = st.uWet;
    u.uRain.value = st.uRain;
    u.uSnow.value = st.uSnow;
    u.uNight.value = st.uNight;
    u.uFogB.value = st.uFogB;
    u.uFogK.value = st.uFogK;
    u.uFogColor.value.set(st.fogColor);
    u.uFogFarColor.value.set(st.fogFarColor);
    u.uEmitGain.value = st.uEmitGain;
    if (u.uSunHaze) u.uSunHaze.value = st.sunHaze ?? 0;

    world.sky.uniforms.uSkyHorizon.value.set(st.skyHorizon);
    world.sky.uniforms.uSkyZenith.value.set(st.skyZenith);
    world.sky.uniforms.uSkyGround.value.set(st.skyGround);

    world.lights.sunLight.intensity = st.sunIntensity;
    world.lights.sunLight.color.set(st.sunColor);
    world.lights.hemiLight.intensity = st.hemiIntensity;
    world.lights.hemiLight.color.set(st.skyHorizon);
    world.lights.hemiLight.groundColor.set(st.skyGround);

    renderer.toneMappingExposure = st.exposure;
    if (post?.gradePass) {
      post.gradePass.uniforms.uSaturation.value = st.saturation;
    }
    if (post?.bloomPass) {
      post.bloomPass.strength = 0.18 + st.uEmitGain * 0.28;
    }
    if (refreshEnv && typeof world.updateEnvironmentMap === 'function') {
      lastEnvAt = now();
      world.updateEnvironmentMap(st.skyHorizon, st.skyZenith, st.skyGround, st.envIntensity);
    }
  }

  applyStateToScene(currentState, true);
  applySun(currentHour);

  function retarget(dur) {
    fromState = { ...currentState };
    fromHour = currentHour;
    targetState = composeState(presets, weatherName, hour);
    targetHour = hour;
    curDuration = dur;
    if (dur <= 0) {
      elapsed = curDuration;
      currentState = { ...targetState };
      currentHour = targetHour;
      applyStateToScene(currentState, true);
      applySun(currentHour);
    } else {
      elapsed = 0;
    }
    return currentState;
  }

  function setWeather(name, instant = false) {
    if (!WEATHER_NAMES.includes(name)) return currentState;
    weatherName = name;
    return retarget(instant ? 0 : duration);
  }

  function setTime(h, instant = false) {
    hour = clampHour(h);
    return retarget(instant ? 0 : timeDuration);
  }

  /** 기존 프리셋 이름 호환: 흐림·비·눈은 기상, 황혼·밤은 시간(18:30·21:30)으로 적용한다. */
  function setPreset(name, instant = false) {
    if (WEATHER_NAMES.includes(name)) return setWeather(name, instant);
    if (name === 'dusk') {
      hour = TIME_QUICK.dusk;
      return retarget(instant ? 0 : duration);
    }
    if (name === 'night') {
      hour = TIME_QUICK.night;
      return retarget(instant ? 0 : duration);
    }
    return currentState;
  }

  function update(dt) {
    if (elapsed < curDuration) {
      elapsed = Math.min(curDuration, elapsed + dt);
      const rawT = curDuration > 0 ? elapsed / curDuration : 1;
      const smoothT = rawT * rawT * (3 - 2 * rawT);
      currentState = lerp(fromState, targetState, smoothT);
      currentHour = fromHour + (targetHour - fromHour) * smoothT;
      const done = elapsed >= curDuration;
      // 반사 환경맵은 전환이 끝날 때, 슬라이더를 끄는 동안에는 0.4 초마다 갱신
      applyStateToScene(currentState, done || now() - lastEnvAt > 400);
      applySun(currentHour);
    }
    return currentState;
  }

  return {
    getPresetName: () => weatherName,
    getWeather: () => weatherName,
    getHour: () => hour,
    getTimeLabel: () => timeLabel(hour),
    getState: () => currentState,
    setWeather,
    setTime,
    setPreset,
    update,
  };
}
