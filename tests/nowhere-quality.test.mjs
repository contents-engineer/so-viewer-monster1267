import test from 'node:test';
import assert from 'node:assert/strict';
import { detectQualityTier, detectDeviceClass, resolveTier, getQualityConfig } from '../public/src/nowhere/quality.js';
import { existsSync } from 'node:fs';

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
    for (const tier of ['desktop', 'mobile']) {
      for (const url of Object.values(getQualityConfig(tier, ver).heroUrls)) {
        assert.ok(existsSync(new URL(`../public/${url}`, import.meta.url)), `${ver}/${tier}: ${url} 파일이 없다`);
      }
    }
  }
});

// 기기 구분(날으는 로드스터: 데스크톱 · 태블릿 표시, 휴대폰 제외 — 스펙 §4)
const UA = {
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  ipadDesktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  androidTab: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  androidPhone: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 Chrome/125.0 Safari/537.36',
  win: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36',
  linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36',
};
const pickDevice = (q) => ({ tier: q.tier, device: q.device, roadsters: q.roadsters });

test('(u) detectDeviceClass: 태블릿(iPad 두 UA · 안드로이드 Mobile 없음 · 그 밖의 터치 600+) · 휴대폰 · 데스크톱', () => {
  const T = [
    [{ userAgent: UA.ipad, maxTouchPoints: 5, screenWidth: 820, screenHeight: 1180 }, 'tablet', 'iPad UA(Mobile/15E148 이 있어도 iPad 가 먼저)'],
    [{ userAgent: UA.ipadDesktop, maxTouchPoints: 5, screenWidth: 1024, screenHeight: 768 }, 'tablet', 'iPadOS 데스크톱 모드(Macintosh + 터치 2+)'],
    [{ userAgent: UA.androidTab, maxTouchPoints: 10, screenWidth: 800, screenHeight: 1280 }, 'tablet', '안드로이드 태블릿(UA 에 Mobile 없음)'],
    [{ userAgent: UA.androidPhone, maxTouchPoints: 5, screenWidth: 412, screenHeight: 915 }, 'phone', '안드로이드 휴대폰'],
    [{ userAgent: UA.iphone, maxTouchPoints: 5, screenWidth: 390, screenHeight: 844 }, 'phone', 'iPhone'],
    [{ userAgent: UA.mac, maxTouchPoints: 0, screenWidth: 1440, screenHeight: 900 }, 'desktop', '터치 없는 Mac'],
    [{ userAgent: UA.ipadDesktop, maxTouchPoints: 0, screenWidth: 1440, screenHeight: 900 }, 'desktop', '터치 없는 Safari Mac'],
    [{ userAgent: UA.win, maxTouchPoints: 0, screenWidth: 1920, screenHeight: 1080 }, 'desktop', 'Windows 데스크톱'],
    [{ userAgent: UA.linux, maxTouchPoints: 10, screenWidth: 1280, screenHeight: 800 }, 'tablet', '그 밖의 터치 기기 600+'],
    [{ userAgent: UA.linux, maxTouchPoints: 10, screenWidth: 360, screenHeight: 740 }, 'phone', '그 밖의 작은 터치 기기'],
    // 스펙 규칙대로 Windows 터치 노트북도 '그 밖의 터치 기기'라 tablet 이다 — 등급(detectQualityTier)은 desktop 그대로이고 로드스터도 보여 영향이 없다
    [{ userAgent: UA.win, maxTouchPoints: 10, screenWidth: 1920, screenHeight: 1080 }, 'tablet', 'Windows 터치 노트북'],
  ];
  for (const [env, want, label] of T) assert.equal(detectDeviceClass(env), want, label);
});

test('(v) resolveTier: ?tier=tablet = 모바일 등급 + 태블릿, mobile = 휴대폰, desktop = 데스크톱, 그 밖은 판정', () => {
  assert.deepEqual(resolveTier('tablet'), { tier: 'mobile', device: 'tablet' });
  assert.deepEqual(resolveTier('mobile'), { tier: 'mobile', device: 'phone' });
  assert.deepEqual(resolveTier('desktop'), { tier: 'desktop', device: 'desktop' });
  assert.deepEqual(
    resolveTier(null, { userAgent: UA.ipadDesktop, maxTouchPoints: 5, width: 1024, height: 768, screenWidth: 1024, screenHeight: 768 }),
    { tier: 'mobile', device: 'tablet' },
  );
  assert.deepEqual(
    resolveTier('', { userAgent: UA.iphone, maxTouchPoints: 5, width: 390, height: 844, screenWidth: 390, screenHeight: 844 }),
    { tier: 'mobile', device: 'phone' },
  );
  assert.deepEqual(
    resolveTier('weird', { userAgent: UA.mac, maxTouchPoints: 0, width: 1440, height: 900, deviceMemory: 8, screenWidth: 1440, screenHeight: 900 }),
    { tier: 'desktop', device: 'desktop' },
  );
});

test('(w) getQualityConfig: device · roadsters(휴대폰만 끔), device 를 안 주면 등급에서(모바일 → 휴대폰), 태블릿 · 휴대폰은 같은 모바일 자산', () => {
  assert.deepEqual(pickDevice(getQualityConfig('desktop', 'seongsu', 'desktop')), { tier: 'desktop', device: 'desktop', roadsters: true });
  assert.deepEqual(pickDevice(getQualityConfig('mobile', 'seongsu', 'tablet')), { tier: 'mobile', device: 'tablet', roadsters: true });
  assert.deepEqual(pickDevice(getQualityConfig('mobile', 'seongsu', 'phone')), { tier: 'mobile', device: 'phone', roadsters: false });
  assert.deepEqual(pickDevice(getQualityConfig('mobile')), { tier: 'mobile', device: 'phone', roadsters: false });
  assert.deepEqual(pickDevice(getQualityConfig('desktop')), { tier: 'desktop', device: 'desktop', roadsters: true });
  assert.equal(getQualityConfig('mobile', 'seongsu', 'tablet').assetDir, getQualityConfig('mobile', 'seongsu', 'phone').assetDir);
  assert.deepEqual(getQualityConfig('mobile', 'seongsu', 'tablet').heroUrls, getQualityConfig('mobile', 'seongsu', 'phone').heroUrls);
});
