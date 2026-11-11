// HAUS NOWHERE — 성수 2041: 기기 등급 판정(desktop / mobile) 및 예산 설정.

const MOBILE_UA_RE = /Android|iPhone|iPad|iPod|Mobile|Windows Phone|BlackBerry|Opera Mini/i;

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

export function getQualityConfig(tier = 'desktop', worldVer = 'seongsu') {
  const ver = worldVer === 'ds2' ? 'ds2' : 'seongsu';
  const baseDir = ver === 'ds2' ? 'assets/nowhere-ds2' : 'assets/nowhere';
  // 주인공 건물: 데스크톱은 원본, 모바일은 텍스처를 1024 로 줄인 사본(npm run nowhere:heroes:mobile)
  const heroUrls =
    tier === 'mobile'
      ? { haus: 'assets/mobile/gm_building.glb', facearch: 'assets/mobile/facearch.glb' }
      : { haus: 'assets/gm_building.glb', facearch: 'assets/facearch.glb' };
  if (tier === 'mobile') {
    return {
      tier: 'mobile',
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
