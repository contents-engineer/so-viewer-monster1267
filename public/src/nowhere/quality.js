// HAUS NOWHERE — 성수 2041: 기기 등급 판정(desktop / mobile) · 기기 구분(desktop / tablet / phone) 및 예산 설정.

const MOBILE_UA_RE = /Android|iPhone|iPad|iPod|Mobile|Windows Phone|BlackBerry|Opera Mini/i;
// 휴대폰 UA. 안드로이드는 따로 본다('Mobile' 이 있으면 휴대폰, 없으면 태블릿). iPad UA 에도 'Mobile/15E148' 이 있어 iPad 를 먼저 본다
const PHONE_UA_RE = /Mobi|iPhone|iPod|Windows Phone|BlackBerry|Opera Mini/i;

export function detectQualityTier(env = {}) {
  const ua =
    env.userAgent ??
    (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  const width =
    env.width ??
    (typeof window !== 'undefined' ? window.innerWidth : 1440);
  const height =
    env.height ??
    (typeof window !== 'undefined' ? window.innerHeight : 900);
  const deviceMemory =
    env.deviceMemory ??
    (typeof navigator !== 'undefined' ? navigator.deviceMemory : undefined);

  const maxTouchPoints =
    env.maxTouchPoints ??
    (typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0);

  if (MOBILE_UA_RE.test(ua)) return 'mobile';
  // iPadOS Safari 는 기본이 데스크톱 모드라 UA 에 iPad 대신 Macintosh 가 들어간다. 터치 Mac 은 없으니 터치 지점이 2 개 이상이면 아이패드다.
  if (/Macintosh/.test(ua) && maxTouchPoints > 1) return 'mobile';
  if (Math.min(width, height) <= 540 || width <= 768) return 'mobile';
  if (typeof deviceMemory === 'number' && deviceMemory <= 4) return 'mobile';
  return 'desktop';
}

/**
 * 기기 구분 — 날으는 로드스터를 휴대폰에서 빼는 데 쓴다(자산 등급은 detectQualityTier 그대로, 태블릿 · 휴대폰 모두 모바일 자산).
 *   태블릿: iPad(UA iPad, 또는 Macintosh + 터치 지점 2 개 이상 = iPadOS 데스크톱 모드), 안드로이드 중 UA 에 Mobile 이 없는 것,
 *           그 밖의 터치 기기 중 min(screen.width, screen.height) ≥ 600
 *   휴대폰: 그 밖의 모바일(Mobi · iPhone · Android … Mobile)과 화면이 600 보다 작은 터치 기기
 */
export function detectDeviceClass(env = {}) {
  const ua = env.userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  const maxTouchPoints = env.maxTouchPoints ?? (typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0) ?? 0;
  const screenW = env.screenWidth ?? (typeof screen !== 'undefined' ? screen.width : 1440);
  const screenH = env.screenHeight ?? (typeof screen !== 'undefined' ? screen.height : 900);
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)) return 'tablet';
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? 'phone' : 'tablet';
  if (PHONE_UA_RE.test(ua)) return 'phone';
  if (maxTouchPoints > 0) return Math.min(screenW, screenH) >= 600 ? 'tablet' : 'phone';
  return 'desktop';
}

/** 주소 ?tier= 와 기기 판정 → { tier, device }. tablet = 모바일 등급 + 태블릿(시험용), mobile = 휴대폰, desktop = 데스크톱, 그 밖(없음)은 판정 */
export function resolveTier(forced, env = {}) {
  if (forced === 'tablet') return { tier: 'mobile', device: 'tablet' };
  if (forced === 'mobile') return { tier: 'mobile', device: 'phone' };
  if (forced === 'desktop') return { tier: 'desktop', device: 'desktop' };
  return { tier: detectQualityTier(env), device: detectDeviceClass(env) };
}

export function getQualityConfig(tier = 'desktop', worldVer = 'seongsu', device = tier === 'mobile' ? 'phone' : 'desktop') {
  const ver = worldVer === 'ds2' ? 'ds2' : 'seongsu';
  const baseDir = ver === 'ds2' ? 'assets/nowhere-ds2' : 'assets/nowhere';
  // 주인공 건물: 데스크톱은 원본, 모바일은 텍스처를 1024 로 줄인 사본(npm run nowhere:heroes:mobile)
  const heroUrls =
    tier === 'mobile'
      ? { haus: 'assets/mobile/gm_building.glb', facearch: 'assets/mobile/facearch.glb' }
      : { haus: 'assets/gm_building.glb', facearch: 'assets/facearch.glb' };
  // 날으는 로드스터(성수): 데스크톱 · 태블릿만 — 휴대폰은 로드스터 · 분사 · 정차 포드를 그리지 않는다(world.js)
  const roadsters = device !== 'phone';
  // 블록 바깥 중경 도시 링(BD_mid) · 구조물 인스턴스(아파트 · 고가 경간 · 아치, world.js MOBILE_STRUCT_INST): 데스크톱 · 태블릿은 다 그린다.
  // 휴대폰만 예산(0.9 M) 때문에 숨기거나 솎는다 — 인트로 · 거리 시점이 블록 가장자리 큰길을 따라가 이것이 없으면 길 건너가 빈 땅이라 맵이 잘린 듯 보인다.
  // 태블릿 예산: 그리기 ≤ 186(그대로) · 삼각형 0.92 → 0.98 M(성수 실측 최대 조감 177 · 0.952 M, 로드스터 최악 +20 K 포함 ≤ 0.98 M)
  const cityEdge = device !== 'phone';
  if (tier === 'mobile') {
    return {
      tier: 'mobile',
      device,
      roadsters,
      cityEdge,
      worldVer: ver,
      baseDir,
      assetDir: `${baseDir}/mobile`,
      heroUrls,
      maskUrl: `${baseDir}/nowhere-ground-mask.webp`,
      layoutUrl: `${baseDir}/layout.json`,
      anchorsUrl: `${baseDir}/anchors.ko.json`,
      hdrUrl: null,
      rainCount: 1800,
      bloom: false,
      maxPixelRatio: 1.5,
      shadowMapSize: 1024,
      sunShadows: false,
      maxLabels: 6,
    };
  }
  return {
    tier: 'desktop',
    device,
    roadsters,
    cityEdge,
    worldVer: ver,
    baseDir,
    assetDir: baseDir,
    heroUrls,
    maskUrl: `${baseDir}/nowhere-ground-mask.webp`,
    layoutUrl: `${baseDir}/layout.json`,
    anchorsUrl: `${baseDir}/anchors.ko.json`,
    hdrUrl: `${baseDir}/sky-1k.hdr`,
    rainCount: 6000,
    bloom: true,
    maxPixelRatio: 1.75,
    shadowMapSize: 2048,
    sunShadows: true,
    maxLabels: 24,
  };
}
