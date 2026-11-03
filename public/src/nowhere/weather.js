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
  },
};

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

export function createWeatherController({ world, post, renderer, initialPreset = 'overcast', duration = 2.5 }) {
  let currentName = PRESETS[initialPreset] ? initialPreset : 'overcast';
  let fromState = { ...PRESETS[currentName] };
  let targetState = { ...PRESETS[currentName] };
  let currentState = { ...PRESETS[currentName] };
  let elapsed = duration;

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
      world.updateEnvironmentMap(st.skyHorizon, st.skyZenith, st.skyGround, st.envIntensity);
    }
  }

  applyStateToScene(currentState, true);

  function setPreset(name, instant = false) {
    if (!PRESETS[name]) return currentState;
    currentName = name;
    fromState = { ...currentState };
    targetState = { ...PRESETS[name] };
    if (instant) {
      elapsed = duration;
      currentState = { ...targetState };
      applyStateToScene(currentState, true);
    } else {
      elapsed = 0;
    }
    return currentState;
  }

  function update(dt) {
    if (elapsed < duration) {
      elapsed = Math.min(duration, elapsed + dt);
      const rawT = duration > 0 ? elapsed / duration : 1;
      const smoothT = rawT * rawT * (3 - 2 * rawT);
      currentState = lerp(fromState, targetState, smoothT);
      const done = elapsed >= duration;
      applyStateToScene(currentState, done);
    }
    return currentState;
  }

  return {
    getPresetName: () => currentName,
    getState: () => currentState,
    setPreset,
    update,
  };
}
