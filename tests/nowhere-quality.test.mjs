import test from 'node:test';
import assert from 'node:assert/strict';
import { detectQualityTier, getQualityConfig } from '../public/src/nowhere/quality.js';

test('(a) detectQualityTier: UA·화면 크기·deviceMemory 조합별 등급 판정', () => {
  assert.equal(
    detectQualityTier({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
      width: 390,
      height: 844,
      deviceMemory: 4,
    }),
    'mobile',
  );

  assert.equal(
    detectQualityTier({
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36',
      width: 412,
      height: 915,
      deviceMemory: 8,
    }),
    'mobile',
  );

  assert.equal(
    detectQualityTier({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 Chrome/125.0 Safari/537.36',
      width: 640,
      height: 800,
      deviceMemory: 8,
    }),
    'mobile',
  );

  assert.equal(
    detectQualityTier({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 Chrome/125.0 Safari/537.36',
      width: 1440,
      height: 900,
      deviceMemory: 2,
    }),
    'mobile',
  );

  assert.equal(
    detectQualityTier({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 Chrome/125.0 Safari/537.36',
      width: 1440,
      height: 900,
      deviceMemory: 8,
    }),
    'desktop',
  );

  // Safari/Firefox 데스크톱처럼 deviceMemory 가 undefined 인 경우
  assert.equal(
    detectQualityTier({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15',
      width: 1440,
      height: 900,
    }),
    'desktop',
  );

  // iPadOS Safari 는 기본이 데스크톱 모드라 UA 가 Macintosh 다 — 터치 지점이 2 개 이상이면 아이패드로 본다
  const IPADOS_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
  assert.equal(detectQualityTier({ userAgent: IPADOS_UA, width: 1024, height: 768, maxTouchPoints: 5 }), 'mobile');
  assert.equal(detectQualityTier({ userAgent: IPADOS_UA, width: 1440, height: 900, maxTouchPoints: 5 }), 'mobile', '화면이 커도 터치 Mac 은 아이패드');
  assert.equal(detectQualityTier({ userAgent: IPADOS_UA, width: 1440, height: 900, maxTouchPoints: 0 }), 'desktop', '터치 없는 Mac 은 데스크톱');
  assert.equal(detectQualityTier({ userAgent: IPADOS_UA, width: 1440, height: 900, maxTouchPoints: 1 }), 'desktop', '터치 지점 1 개는 아이패드로 보지 않는다');
  assert.equal(detectQualityTier({ userAgent: IPADOS_UA, width: 1440, height: 900 }), 'desktop', 'maxTouchPoints 를 안 주면 터치 없음으로 본다(테스트 환경에 navigator 없음)');
  // Windows 터치 노트북은 Macintosh 가 아니므로 영향이 없다
  assert.equal(
    detectQualityTier({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36', width: 1920, height: 1080, maxTouchPoints: 10 }),
    'desktop',
  );
});

test('(b) getQualityConfig: 데스크톱(1024/6000/bloom on) vs 모바일(512/1800/bloom off) 설정 반환', () => {
  const desktop = getQualityConfig('desktop');
  const mobile = getQualityConfig('mobile');

  assert.equal(desktop.tier, 'desktop');
  assert.equal(desktop.assetDir, 'assets/nowhere');
  assert.equal(desktop.rainCount, 6000);
  assert.equal(desktop.bloom, true);
  assert.ok(desktop.maxPixelRatio >= 1.5 && desktop.maxPixelRatio <= 2.0);

  assert.equal(mobile.tier, 'mobile');
  assert.equal(mobile.assetDir, 'assets/nowhere/mobile');
  assert.equal(mobile.rainCount, 1800);
  assert.equal(mobile.bloom, false);
  assert.ok(mobile.maxPixelRatio <= 1.5);

  const ds2Desktop = getQualityConfig('desktop', 'ds2');
  const ds2Mobile = getQualityConfig('mobile', 'ds2');
  assert.equal(ds2Desktop.worldVer, 'ds2');
  assert.equal(ds2Desktop.assetDir, 'assets/nowhere-ds2');
  assert.equal(ds2Desktop.layoutUrl, 'assets/nowhere-ds2/layout.json');
  assert.equal(ds2Mobile.worldVer, 'ds2');
  assert.equal(ds2Mobile.assetDir, 'assets/nowhere-ds2/mobile');
  assert.equal(ds2Mobile.maskUrl, 'assets/nowhere-ds2/nowhere-ground-mask.webp');
});

test('(s) 해 그림자: 데스크톱만 켠다(모바일은 그림자 패스 비용 없이)', () => {
  assert.equal(getQualityConfig('desktop').sunShadows, true);
  assert.equal(getQualityConfig('mobile').sunShadows, false);
  assert.equal(getQualityConfig('desktop', 'ds2').sunShadows, true, 'DS2 는 world.js 에서 끈다(등급 값은 공통)');
});

test('(t) heroUrls: 데스크톱은 원본, 모바일은 assets/mobile 사본(성수·DS2 공통)', () => {
  for (const ver of ['seongsu', 'ds2']) {
    assert.deepEqual(getQualityConfig('desktop', ver).heroUrls, { haus: 'assets/gm_building.glb', facearch: 'assets/facearch.glb' });
    assert.deepEqual(getQualityConfig('mobile', ver).heroUrls, { haus: 'assets/mobile/gm_building.glb', facearch: 'assets/mobile/facearch.glb' });
  }
});
