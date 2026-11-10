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
