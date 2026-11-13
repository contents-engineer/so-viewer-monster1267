// HAUS NOWHERE — 성수 2041: 월드 로더 및 씬 그래프 조립.
// GLB 4종(ground, present, future, backdrop) + 영웅 건물 2종(gm_building, facearch) + layout.json + 지면 마스크 로드.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { getQualityConfig } from './quality.js';
import {
  createSharedUniforms,
  prepareMeshAttributes,
  resolveSurfaceType,
  patchSurfaceMaterial,
} from './surface.js';
import { createSkyDome } from './sky.js';
import { createHeightGrid, createGroundQuery, createOccupancyGrid, isBlockedAt, obstacleTopAt } from './terrain.js';
import { rasterizeMeshes, markObstacleMeshes } from './terrain-mesh.js';
import { buildTrack, moverPose, spinAngle, roadsterPose, plumeMorph, PLUME_MIN } from './movers.js';

// 경로 이동체 노드(layout.movers 의 object): 정적 병합 · 보행 장애물에서 뺀다(날으는 로드스터 차체 · 분사 포함)
const MOVER_NODE = /^FU_(drone|taxi|train|bot|turbine_rotor|roadster)/;
// 날으는 로드스터 전용 노드(차체 · 분사 · 정차 포드): 휴대폰(quality.roadsters 거짓)에서는 그리지 않고 보행 장애물에서도 뺀다
const ROADSTER_ONLY = /^FU_(roadster|parked_pod)/;

export async function createWorld({
  renderer,
  scene,
  tier = 'desktop',
  device,
  worldVer = 'seongsu',
  onProgress = null,
}) {
  const quality = getQualityConfig(tier, worldVer, device);   // device 가 없으면 등급에서(모바일 → 휴대폰)

  // 1) layout.json 로드
  const layoutRes = await fetch(quality.layoutUrl || 'assets/nowhere/layout.json');
  if (!layoutRes.ok) {
    throw new Error(`layout.json 로드 실패: ${layoutRes.status}`);
  }
  const layout = await layoutRes.json();
  const maskRect = layout.maskRect || [-170, -210, 220, 210];

  // 2) 지면 마스크(2048 WebP, 비색상 RGBA) 로드
  const texLoader = new THREE.TextureLoader();
  const groundMaskTex = await new Promise((resolve, reject) => {
    texLoader.load(
      quality.maskUrl,
      (t) => {
        t.colorSpace = THREE.NoColorSpace;
        t.flipY = true;
        t.wrapS = THREE.ClampToEdgeWrapping;
        t.wrapT = THREE.ClampToEdgeWrapping;
        t.minFilter = THREE.LinearFilter;
        t.magFilter = THREE.LinearFilter;
        t.needsUpdate = true;
        resolve(t);
      },
      undefined,
      reject,
    );
  });

  const uniforms = createSharedUniforms(groundMaskTex, maskRect);

  // DS2 산악 월드 룩(참조 화면: 빙하 계곡 역광 헤이즈) — Blender tools/nowhere/blender/ds2_look.py 와 같은 해 방향.
  // 해: 방위 32°(북북동, 계곡 상류) · 고도 26° → Three (x, y, z) = (0.476, 0.438, -0.762)
  const sunCfg = layout.sun || (worldVer === 'ds2' ? { dir: [0.4764, 0.4384, -0.7624] } : null);
  if (sunCfg?.dir) uniforms.uSunDir.value.fromArray(sunCfg.dir).normalize();
  const sunBaseDir = uniforms.uSunDir.value.toArray();
  if (worldVer === 'ds2') {
    uniforms.uMossSoft.value = 1.0;
    uniforms.uMossColor.value.set('#34431F');
    uniforms.uMossColor2.value.set('#6F7B31');
    uniforms.uHeatherColor.value.set('#5C3526');
    uniforms.uPudColor.value.setRGB(0.3, 0.34, 0.36);   // 계곡 개울: 회청색 반사 수면(성수의 은빛 거울보다 어둡게)
    uniforms.uPudMetal.value = 0.85;
  }
  // 성수 2041: 복원·정돈된 도시 — 틈의 이끼를 30 % 로(구운 마스크는 그대로, 비 · 눈 무드에서도 같다)
  const SEONGSU_MOSS = 0.3;
  if (worldVer !== 'ds2') uniforms.uMoss.value = SEONGSU_MOSS;
  // 성수 2041 밤 거리 반사광(Task 12): 가로등 · 상점 창 불빛이 벽 아랫부분 · 노면에 번지는 세기(surface.js uNightFill)
  const SEONGSU_NIGHT_FILL = 0.25;
  if (worldVer !== 'ds2') uniforms.uNightFill.value = SEONGSU_NIGHT_FILL;
  // 포켓 공원 물길 정원(최종 수정 I1): 공원 사각형(tools/nowhere/blender/ground.py LOT, Blender x0 · y0 · x1 · y1) 안의 웅덩이 · 물길은
  // 맑음(uWet 0.05)에도 물이 차 수면(웅덩이 반사)으로 보인다(surface.js uPondWet — 그리기 · 삼각형은 그대로). DS2 는 0(끔)
  const SEONGSU_POND_RECT = [28.0, -22.0, 65.8, 40.0];
  const SEONGSU_POND_WET = 0.85;
  if (worldVer !== 'ds2') {
    uniforms.uPondWet.value = SEONGSU_POND_WET;
    uniforms.uPondRect.value.fromArray(SEONGSU_POND_RECT);
  }

  // 3) 하늘 돔 + 조명 + 환경 반사맵(PMREM) 구성
  const sky = createSkyDome(uniforms);
  scene.add(sky.mesh);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  // DS 시그니처 #4: 젖은 노면이 어두운 집/나무 대신 밝은 흐린 하늘을 비추도록 하늘 돔 기반 PMREM 생성
  const envScene = new THREE.Scene();
  const envSkyClone = createSkyDome(uniforms);
  // 반사용 하늘에는 태양 헤이즈를 넣지 않는다: 역광 쪽 거친 지면·풀밭이 헤이즈를 정반사해 우윳빛으로 뜨는 것을 막는다
  envSkyClone.uniforms.uSunHaze = { value: 0.0 };
  envScene.add(envSkyClone.mesh);
  let envRT = pmrem.fromScene(envScene, 0.03);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.85;

  function updateEnvironmentMap(horizonHex, zenithHex, groundHex = '#3E423F', envIntensity = 0.85) {
    envSkyClone.uniforms.uSkyHorizon.value.set(horizonHex);
    envSkyClone.uniforms.uSkyZenith.value.set(zenithHex);
    envSkyClone.uniforms.uSkyGround.value.set(groundHex);
    const nextRT = pmrem.fromScene(envScene, 0.03);
    if (envRT) envRT.dispose();
    envRT = nextRT;
    scene.environment = envRT.texture;
    scene.environmentIntensity = envIntensity;
  }

  // 데스크톱에서는 sky-1k.hdr 도 백그라운드로 예열 로드(자산 계약 충족)
  if (quality.hdrUrl) {
    const rgbe = new RGBELoader();
    rgbe.load(quality.hdrUrl, (hdrTex) => {
      hdrTex.mapping = THREE.EquirectangularReflectionMapping;
      hdrTex.dispose();
    });
  }

  // 키 라이트(Blender FX_sun: azimuth 215°, elevation 34° → Three 좌표 (-0.47, 0.56, 0.68)) + 반구광
  const hemiLight = new THREE.HemisphereLight('#E7E9E4', '#3E423F', 0.95);
  hemiLight.position.set(0, 120, 0);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight('#FFF4E6', 1.35);
  sunLight.position.set(-115, 135, 165);
  if (sunCfg?.dir) sunLight.position.copy(uniforms.uSunDir.value).multiplyScalar(240);
  // 맑음의 해 그림자(성수 · 데스크톱): 카메라 앞 ±SHADOW_HALF m 를 덮는 직교 그림자. followSun 이 매 프레임 옮긴다.
  const SHADOW_HALF = 110;
  const SHADOW_AHEAD = 70;
  const SHADOW_DIST = 300;
  const shadowsOn = Boolean(quality.sunShadows) && worldVer !== 'ds2';
  sunLight.castShadow = shadowsOn;
  if (shadowsOn) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    sunLight.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
    Object.assign(sunLight.shadow.camera, { left: -SHADOW_HALF, right: SHADOW_HALF, top: SHADOW_HALF, bottom: -SHADOW_HALF, near: 1, far: 700 });
    sunLight.shadow.camera.updateProjectionMatrix();
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.5;
    scene.add(sunLight.target);
  }
  scene.add(sunLight);

  // 4) GLTFLoader + MeshoptDecoder 준비
  if (MeshoptDecoder && MeshoptDecoder.ready) {
    await MeshoptDecoder.ready;
  }
  const gltfLoader = new GLTFLoader();
  gltfLoader.setMeshoptDecoder(MeshoptDecoder);

  const tasks = [
    { key: 'ground', url: `${quality.assetDir}/nowhere-ground.glb`, fallbackSurface: 'ground' },
    { key: 'present', url: `${quality.assetDir}/nowhere-present.glb`, fallbackSurface: 'wall' },
    { key: 'future', url: `${quality.assetDir}/nowhere-future.glb`, fallbackSurface: 'metal' },
    { key: 'backdrop', url: `${quality.assetDir}/nowhere-backdrop.glb`, fallbackSurface: 'wall' },
    { key: 'haus', url: quality.heroUrls.haus, fallbackSurface: 'building' },
    { key: 'facearch', url: quality.heroUrls.facearch, fallbackSurface: 'building' },
  ];

  let completed = 0;
  const total = tasks.length;
  const report = (label) => {
    if (typeof onProgress === 'function') {
      onProgress({ loaded: completed, total, ratio: completed / total, label });
    }
  };
  report('장면 자산 준비 중');

  const loadedMap = {};
  await Promise.all(
    tasks.map(async (item) => {
      const gltf = await gltfLoader.loadAsync(item.url);
      loadedMap[item.key] = { gltf, fallbackSurface: item.fallbackSurface };
      completed += 1;
      report(item.key);
    }),
  );

  // 5) 건물 배치 및 표면별 메시 분류·셰이더 패치 + 정적 동일 재질 메시 병합(Draw Call 최적화)
  const meshesBySurface = {};
  const layerGroups = {};
  const patchedMaterials = new WeakSet();
  const sigClones = new Map();

  // 경로 이동체(Task 11, layout.movers): 드론 · 포드 · 튜브 열차 · 배송로봇 · 풍력 회전자는 정적 병합과 보행 장애물에서 뺀다
  // (DS2 의 옛 드론 이름 'FU_drone_del_mesh_*' 같은 '…drone…' 도 그대로 뺀다)
  function isAnimatedNode(node) {
    for (let cur = node; cur; cur = cur.parent) {
      if (typeof cur.name === 'string' && (MOVER_NODE.test(cur.name) || cur.name.includes('drone'))) return true;
    }
    return false;
  }

  // 날으는 로드스터 전용 노드인지(조상까지). GLTFLoader 이름: FU_parked_pod.0 → FU_parked_pod0, 인스턴스 정차 포드는 메시 이름 FU_parked_pod
  function isRoadsterOnly(node) {
    for (let cur = node; cur; cur = cur.parent) {
      if (typeof cur.name === 'string' && ROADSTER_ONLY.test(cur.name)) return true;
    }
    return false;
  }

  // 장면 밖 원경(성수 2041 신축 타워 · 둘레 광장 · 풍력): 카메라를 따라가는 해 그림자 상자에 들지 않으므로 드리우지 않는다(받기는 그대로).
  // 병합되면 이름이 NW_Merged_* 로 바뀌므로 병합할 때 묶음이 모두 원경이면 nw_noCast 를 단다.
  // 노면에 붙은 태양광 띠(FU_road_pv.*, Task 10)도 같은 규칙으로 드리우지 않는다(노면 + 1 cm 판이 그림자 여드름만 만든다).
  const FAR_CASTER = /^FU_(tower|plaza|turbine|road_pv)/;
  // 깊이를 쓰지 않는 반투명 유리(재질 이름 → 불투명도). 그림자도 드리우지 않는다(불투명 그림자가 된다)
  const GLASS_OPACITY = { NWF_tube_glass: 0.55, NWF_glass_rail: 0.3, NWF_kiosk_glass: 0.55 };   // 키오스크 유리 판(Task 10): UI 칸 발광 + 알파 0.55
  // 정적 병합에서 빼는 반투명 재질. 병합은 재질(uuid)별 버킷이라 반투명이 불투명과 합쳐지는 일은 없다. 반투명 전체를 빼면
  // HAUS 유리 9 조각 · 유리 난간 6 조각이 따로 남아(양면 반투명 = 객체마다 2 그리기) 메인 패스가 +26 그리기 → 튜브 유리만 뺀다
  const NO_MERGE = new Set(['NWF_tube_glass']);
  // 밤 조율(성수 Task 12): 재질별 발광 곱 [낮, 밤] — surface.js 발광 규칙(항상 · 밤에만 · 창)을 거친 값에 mix(낮, 밤, uNight) 를 곱한다.
  // Blender 의 발광 세기(nw_emit day · night)는 웹 GLB 로 넘어오지 않으므로(발광 1.0 고정) 웹 세기는 여기서 정한다. DS2 는 쓰지 않는다
  // 목표: 길(청록)과 튜브(흰빛)가 선으로 읽히고, 타워 · 상점 창은 따뜻한 실내등 정도로 낮춰 흰 판 · 블룸 번짐이 없게 한다
  const NIGHT_EMIT = {
    NWF_curtain: [1, 0.25],      // 신축 타워 창(밤에만): 흰 베이지 판 → 따뜻한 창
    NWB_city: [1, 0.5],          // 원경 아파트 · 타워 창(밤에만)
    NW_glass_window: [1, 0.35],  // 현재 층 상점 · 공장 창(밤에만): 1.35 배 흰 판이 블룸 문턱을 넘던 것을 낮춤
    NWF_tube_led: [1, 3.0],      // 튜브 등줄기 LED: 화소보다 가는 선이 점선으로 끊기던 것 → 블룸으로 한 줄
    NWF_road_led: [1, 0.6],      // 노면 청록 발광선: 밤에 흰색으로 날아가던 것 → 청록이 남게
    NWF_led_bridge: [1, 0.8],    // 스카이브리지 소핏 LED
    NWF_mover: [1, 0.6],         // 이동체 아틀라스(열차 창 · 포드 LED · 상태 화면, 밤에만): 열차 창 흰 판 → 따뜻한 창
    NWF_tube_glass: [0, 0.25],   // 튜브 유리 밤 발광(아래 TUBE_GLASS_NIGHT 색, 낮 0)
    NWB_tube: [0, 0.14],         // 원경 튜브 외피(불투명): 장면 튜브 유리(0.25 × 알파 0.55)와 같은 밤 밝기
  };
  // 태양광 노면 띠(성수 최종 수정 I2): 알베도 곱(텍스처 × 이 색, 선형). 거리 시점 맑음 14:00 에서 셀이 청회색(≈ 97, 112, 134)이었다.
  // 비스듬히 보는 띠는 밉맵이 남색 셀과 밝은 격자를 섞고, 그 위에 해 · 하늘(반구광) 확산광이 얹힌 값이다 — 정반사를 꺼도 −6,
  // 환경맵 세기는 0 으로 해도 화소가 같았다(웹 측정) → 확산 알베도를 남색 쪽으로 낮춘다. 셀 ≈ (64, 81, 110), 격자는 그 위로 밝게 남는다
  const PV_TINT = [0.24, 0.32, 0.5];
  // 튜브 유리 밤 발광(성수): 등줄기 LED 가 비추는 차가운 흰빛으로 유리 몸통이 밤에도 튜브로 읽히게 한다(낮 곱 0 = 낮에는 없음)
  const TUBE_GLASS_NIGHT = '#BFE3F0';
  // 모바일 삼각형 예산(0.9 M, 성수만 — DS2 는 이 표를 쓰지 않는다): 튜브 리브 홀수 번째(→ 11 m 간격) · 화단의 늘어진 덩굴 카드를 그리지 않는다
  // · 거리 벤치(Task 10: 티크 재질 그리기 1 과 삼각형. 카페 테라스는 레퍼런스의 핵심이라 모바일에서도 그린다)
  // · 원경 BD_far_desk(Task 12: BD_far 에서 걸러진 원경 동 — 데스크톱만 그린다. 백드롭 GLB 는 데스크톱 · 모바일 공용)
  const MOBILE_HIDE = /^(FU_(tube_(ribs_fine|planter_vines)_|bench)|BD_far_desk)/;
  // 모바일에서도 솎지 않는 인스턴스(Task 12, 성수만): 공원 느티나무 PR_zelkova_a(8 그루, 711 tris) · 카페 테라스 FU_terrace(6 조, 236 tris).
  // 늘어난 삼각형(+5.2 K)은 원경 크림색 상자(backdrop.py FAR_*_KEEP, 줄이기 순서 1)를 덜어 맞춘다. 화분 가로수(PR_zelkova_b · PR_planter)는
  // 예산이 모자라 아래 규칙대로 솎는다(Task 12 Step 2 줄이기 3: 화분형 가로수 수)
  const MOBILE_FULL_INST = /^(PR_zelkova_a|FU_terrace)/;
  // 태블릿(quality.cityEdge)에서는 솎지 않는 구조물 인스턴스(성수만): 아파트 PR_apt(3 동) · 2호선 고가 경간 PR_via_span · 아래 벽돌 아치 PR_via_infill.
  // 소품과 달리 빠지면 건물 · 고가가 끊겨 보인다(+약 9.9 K 삼각형, 병합되어 그리기는 늘지 않음). 휴대폰은 예산 때문에 위 규칙대로 솎는다
  const MOBILE_STRUCT_INST = /^(PR_apt|PR_via_(span|infill))(_\d+)?$/;
  function isFarCaster(node) {
    for (let cur = node; cur; cur = cur.parent) {
      if (typeof cur.name === 'string' && FAR_CASTER.test(cur.name)) return true;
    }
    return false;
  }

  function normalizeGeometryForMerge(geom, worldMat, hasVertMask) {
    let g = geom.index ? geom.toNonIndexed() : geom.clone();
    const count = g.attributes.position.count;

    const extract = (attr, itemSize, fallback) => {
      const out = new Float32Array(count * itemSize);
      if (attr) {
        for (let i = 0; i < count; i++) {
          for (let k = 0; k < itemSize; k++) {
            out[i * itemSize + k] = attr.getComponent(i, k);
          }
        }
      } else if (fallback) {
        for (let i = 0; i < count; i++) {
          for (let k = 0; k < itemSize; k++) {
            out[i * itemSize + k] = fallback[k];
          }
        }
      }
      return new THREE.BufferAttribute(out, itemSize, false);
    };

    const outGeom = new THREE.BufferGeometry();
    outGeom.setAttribute('position', extract(g.attributes.position, 3));
    if (g.attributes.normal) {
      outGeom.setAttribute('normal', extract(g.attributes.normal, 3));
    } else {
      outGeom.computeVertexNormals();
    }
    outGeom.setAttribute('uv', extract(g.attributes.uv, 2, [0, 0]));
    if (hasVertMask) {
      outGeom.setAttribute('nwMask', extract(g.attributes.nwMask, 4, [0, 0.25, 1, 0]));
    }
    outGeom.applyMatrix4(worldMat);
    return outGeom;
  }

  function processRoot(root, layerKey, fallbackSurface) {
    root.name = `NW_Layer_${layerKey}`;
    root.updateMatrixWorld(true);
    const rootInv = root.matrixWorld.clone().invert();
    const mergeBuckets = new Map();

    root.traverse((node) => {
      if (!node.isMesh) return;
      node.userData.nw_layer = layerKey;
      const hasVertMask = prepareMeshAttributes(node);

      const mats = Array.isArray(node.material) ? node.material : [node.material];
      const nextMats = mats.map((m) => {
        if (!m) return m;
        const surf = resolveSurfaceType(node, m, fallbackSurface);
        node.userData.nw_surface = surf;

        // 같은 재질이라도 정점 마스크 유무나 표면 종류가 다르면 복제해 패치
        const sig = `${surf}_${hasVertMask ? 1 : 0}`;
        // 복제본은 (재질, 표면 서명)마다 하나만 둔다: 같은 재질을 다른 표면 객체가 번갈아 쓰면(타워 유리 난간 'glass' ↔ 스카이브리지 'wall')
        // 만날 때마다 새 복제본이 생겨 같은 서명 노드끼리도 병합되지 않았다
        let targetMat = m;
        if (patchedMaterials.has(m) && m.userData._nwSig !== sig) {
          const ck = `${m.uuid}|${sig}`;
          targetMat = sigClones.get(ck);
          if (!targetMat) {
            targetMat = m.clone();
            sigClones.set(ck, targetMat);
          }
        }
        targetMat.userData._nwSig = sig;
        if (worldVer !== 'ds2' && targetMat.name === 'NWF_road_pv') targetMat.color.setRGB(...PV_TINT);
        if (worldVer !== 'ds2' && NIGHT_EMIT[targetMat.name]) {
          targetMat.userData.nwEmitGain = NIGHT_EMIT[targetMat.name];
          if (targetMat.name === 'NWF_tube_glass' || targetMat.name === 'NWB_tube') targetMat.emissive.set(TUBE_GLASS_NIGHT);
        }
        patchSurfaceMaterial(targetMat, surf, uniforms, hasVertMask);
        // 2호선 유리 튜브(Task 9) · 유리 난간: 깊이를 쓰지 않는 반투명(튜브 안 열차 · 뒤 하늘이 비친다). 정적 병합 · 그림자에서 뺀다(아래)
        const glassOpacity = GLASS_OPACITY[targetMat.name];
        if (glassOpacity !== undefined) {
          targetMat.transparent = true;
          targetMat.opacity = glassOpacity;
          targetMat.depthWrite = false;
          // 튜브 유리(Task 11b): 양면 반투명은 three 가 뒷면 → 앞면으로 두 번 그린다(객체마다 그리기 2). 한 색 · 한 알파라 섞는 순서가
          // 바뀌어도 차이는 알파² × (앞 · 뒷면 음영 차) → 한 번에 그린다(승강장 구간 FU_tube_glass_s 를 더해도 모바일 조감 그리기 ≤ 180).
          // Task 12 에 알파를 0.22 → 0.55 로 올려 그 비율이 5 % → 30 % 가 됐지만 앞 · 뒷면이 같은 색 · 같은 밤 발광이라 조감 · 골목 · 근접 캡처에서
          // 순서 오류는 보이지 않았다
          if (targetMat.name === 'NWF_tube_glass') targetMat.forceSinglePass = true;
        }
        patchedMaterials.add(targetMat);
        return targetMat;
      });

      node.material = Array.isArray(node.material) ? nextMats : nextMats[0];

      // 휴대폰(quality.roadsters 거짓): 날으는 로드스터 · 분사 · 정차 포드를 그리지 않는다. 숨긴 메시는 병합되지 않고, 보행 장애물 격자(getWalkBlocker 의
      // pick)도 숨긴 메시를 건너뛴다 → 정차 포드가 길을 막지 않는다
      if (worldVer !== 'ds2' && !quality.roadsters && isRoadsterOnly(node)) {
        node.visible = false;
        return;
      }

      // 고폴리 반복 소품(덮개 차량 등) 및 모바일 등급 소품 감축으로 데스크톱(≤2.0M)·모바일(≤0.9M) 예산 충족
      if (quality.tier === 'mobile') {
        // 중경 링 BD_mid 는 휴대폰만 숨긴다(태블릿은 quality.cityEdge — 길 건너가 비지 않게, +4 그리기 · +42.7 K 삼각형)
        if (node.name === 'PR_wires' || (!quality.cityEdge && node.name.startsWith('BD_mid_')) || (worldVer !== 'ds2' && MOBILE_HIDE.test(node.name))) {
          node.visible = false;
          return;
        }
      }
      if (node.isInstancedMesh) {
        const triPerInst = (node.geometry?.index ? node.geometry.index.count : (node.geometry?.attributes?.position?.count || 0)) / 3;
        if (quality.tier === 'mobile' && worldVer !== 'ds2' && (MOBILE_FULL_INST.test(node.name) || (quality.cityEdge && MOBILE_STRUCT_INST.test(node.name)))) {
          // 솎지 않음(모바일 공원 느티나무 · 카페 테라스 — MOBILE_FULL_INST, 태블릿 구조물 — MOBILE_STRUCT_INST)
        } else if (quality.tier === 'mobile') {
          if (triPerInst > 350) {
            node.count = Math.min(node.count, 2);
          } else if (node.count > 2) {
            node.count = Math.max(1, Math.ceil(node.count * 0.18));
          }
        } else if (triPerInst > 1500 && node.count > 16) {
          node.count = 16;
        }
      }

      // 정적 단일 재질 메시(일반 Mesh 및 소형 InstancedMesh)를 (재질, 정점 마스크 유무) 기준으로 병합 버킷에 등록
      // (backdrop 은 사방 360° 배치이므로 프러스텀 컬링 효율을 위해 개별 객체 유지)
      const instanceCount = node.isInstancedMesh ? node.count : 1;
      const vertCount = (node.geometry?.attributes?.position?.count || 0) * instanceCount;
      if (
        layerKey !== 'backdrop' &&
        !Array.isArray(node.material) &&
        node.material &&
        !NO_MERGE.has(node.material.name) && // 큰 반투명 튜브 유리는 객체마다 깊이 정렬되도록 합치지 않는다(아래 NO_MERGE)
        node.geometry &&
        !isAnimatedNode(node) &&
        vertCount <= 120000
      ) {
        const bKey = `${node.material.uuid}|${hasVertMask ? 1 : 0}`;
        if (!mergeBuckets.has(bKey)) {
          mergeBuckets.set(bKey, {
            material: node.material,
            surface: node.userData.nw_surface,
            hasVertMask,
            nodes: [],
          });
        }
        mergeBuckets.get(bKey).nodes.push(node);
      }
    });

    // 버킷별로 지오메트리를 하나로 병합해 Draw Call 수를 대폭 절감
    const instMat = new THREE.Matrix4();
    for (const [, bucket] of mergeBuckets) {
      const totalInstances = bucket.nodes.reduce(
        (acc, n) => acc + (n.isInstancedMesh ? n.count : 1),
        0,
      );
      if (bucket.nodes.length < 2 && totalInstances < 2) continue;

      const geoms = [];
      let ok = true;
      for (const n of bucket.nodes) {
        try {
          const baseRel = rootInv.clone().multiply(n.matrixWorld);
          if (n.isInstancedMesh) {
            for (let i = 0; i < n.count; i++) {
              n.getMatrixAt(i, instMat);
              const m = baseRel.clone().multiply(instMat);
              geoms.push(normalizeGeometryForMerge(n.geometry, m, bucket.hasVertMask));
            }
          } else {
            geoms.push(normalizeGeometryForMerge(n.geometry, baseRel, bucket.hasVertMask));
          }
        } catch {
          ok = false;
          break;
        }
      }
      if (!ok || geoms.length < 2) continue;
      const rawMerged = mergeGeometries(geoms, false);
      if (!rawMerged) continue;
      const merged = mergeVertices(rawMerged, 1e-4);
      const mergedMesh = new THREE.Mesh(merged, bucket.material);
      mergedMesh.name = `NW_Merged_${layerKey}_${bucket.material.name || 'mat'}`;
      mergedMesh.userData.nw_layer = layerKey;
      mergedMesh.userData.nw_surface = bucket.surface;
      mergedMesh.userData.nw_noCast = bucket.nodes.every(isFarCaster);
      root.add(mergedMesh);
      for (const n of bucket.nodes) {
        if (n.parent) n.parent.remove(n);
      }
    }

    root.traverse((node) => {
      if (!node.isMesh) return;
      const surf = node.userData.nw_surface || fallbackSurface;
      if (!meshesBySurface[surf]) meshesBySurface[surf] = [];
      meshesBySurface[surf].push(node);
    });

    scene.add(root);
    layerGroups[layerKey] = root;
  }

  for (const key of ['ground', 'present', 'future', 'backdrop']) {
    processRoot(loadedMap[key].gltf.scene, key, loadedMap[key].fallbackSurface);
  }

  // HAUS NOWHERE 및 FaceArch 배치
  const hausRoot = loadedMap.haus.gltf.scene;
  const hausCfg = layout.buildings?.haus || { pos: [0, 0, 0], rotY: 0 };
  hausRoot.position.fromArray(hausCfg.pos);
  hausRoot.rotation.y = THREE.MathUtils.degToRad(hausCfg.rotY || 0);
  // 건물 월드 경계 상자(아카이브 이름표 자리 · 자유 시점 건물 클릭) — 배치 직후, processRoot 가 메시를 합치기 전에 잰다
  const buildingBoxes = { haus: new THREE.Box3().setFromObject(hausRoot) };
  processRoot(hausRoot, 'building_haus', 'building');

  const facearchRoot = loadedMap.facearch.gltf.scene;
  const faceCfg = layout.buildings?.facearch || { pos: [105, 0, -15], rotY: 27 };
  facearchRoot.position.fromArray(faceCfg.pos);
  facearchRoot.rotation.y = THREE.MathUtils.degToRad(faceCfg.rotY || 0);
  buildingBoxes.facearch = new THREE.Box3().setFromObject(facearchRoot);
  processRoot(facearchRoot, 'building_facearch', 'building');

  if (shadowsOn) {
    const NO_CAST = new Set(['holo', 'emissive', 'water']);
    for (const key of ['ground', 'present', 'future', 'building_haus', 'building_facearch']) {
      layerGroups[key]?.traverse((n) => {
        if (!n.isMesh) return;
        n.receiveShadow = true;
        n.castShadow = key !== 'ground' && !NO_CAST.has(n.userData?.nw_surface) && !/^FU_tube_glass/.test(n.name) &&
          !(n.material?.name in GLASS_OPACITY) && !n.userData?.nw_noCast && !isFarCaster(n);
      });
    }
  }

  const _fwd = new THREE.Vector3();
  const _focus = new THREE.Vector3();
  const _toSun = new THREE.Vector3();
  const _lightRot = new THREE.Matrix4();
  const _lx = new THREE.Vector3();
  const _ly = new THREE.Vector3();
  const _lz = new THREE.Vector3();
  const _origin = new THREE.Vector3();
  const SHADOW_TEXEL = (2 * SHADOW_HALF) / (quality.shadowMapSize || 1);   // 그림자 맵 한 텍셀의 월드 크기(m)
  /** 그림자 상자를 카메라 앞 SHADOW_AHEAD m 로 옮긴다. 광원 공간(그림자 카메라의 가로 · 세로 축)에서 텍셀 단위로 붙여 걸을 때 그림자
   *  가장자리가 떨지 않게 한다 — 그림자 카메라 위치의 가로 · 세로 성분이 텍셀의 배수면 텍셀 격자가 월드에 고정된다. 옛 방식(월드 축 1 m
   *  반올림)은 1 m 가 텍셀(≈ 0.107 m)의 배수가 아니고 광원 축과도 어긋나 격자가 매번 다른 자리에 걸렸다(최종 수정 M3). */
  function followSun(camera) {
    if (!shadowsOn) return;
    camera.getWorldDirection(_fwd);
    _fwd.y = 0;
    if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1);
    _fwd.normalize();
    _focus.copy(camera.position).addScaledVector(_fwd, SHADOW_AHEAD);
    _focus.y = 0;
    _toSun.copy(sunLight.position).sub(sunLight.target.position).normalize();
    // 그림자 카메라와 같은 기저: LightShadow 는 광원 위치에서 대상을 lookAt 한다(z = 해 쪽, up = 그림자 카메라 up)
    _lightRot.lookAt(_toSun, _origin, sunLight.shadow.camera.up);
    _lightRot.extractBasis(_lx, _ly, _lz);
    const u = Math.round(_focus.dot(_lx) / SHADOW_TEXEL) * SHADOW_TEXEL;
    const v = Math.round(_focus.dot(_ly) / SHADOW_TEXEL) * SHADOW_TEXEL;
    sunLight.target.position.copy(_lx).multiplyScalar(u).addScaledVector(_ly, v).addScaledVector(_lz, _focus.dot(_lz));
    sunLight.target.updateMatrixWorld();
    sunLight.position.copy(sunLight.target.position).addScaledVector(_toSun, SHADOW_DIST);
  }

  // 지형 높이 격자: 카메라가 지면 아래로 내려가 지형이 뒷면 컬링으로 사라지는("바닥 아래가 비쳐 보이는") 상태 방지.
  // 지면 레이어 전체 + 원경 지형 메시(계곡 바닥·암벽·암괴·개울·강·도로)를 로드 시 한 번 래스터화한다.
  //   고해상도 2 m: 분지와 주 시점 주변 / 저해상도 24 m: 반경 6.3 km 전체
  const fineGrid = createHeightGrid({ x0: -420, z0: -1300, x1: 520, z1: 420, cell: 2 });
  const coarseGrid = createHeightGrid({ x0: -6300, z0: -6300, x1: 6300, z1: 6300, cell: 24 });
  const BACKDROP_GROUND = /^BD_(ground|tors|stream|river|roads|park)/;
  const pickGrids = (ax, az) => (Math.max(Math.abs(ax), Math.abs(az)) < 1400 ? [fineGrid, coarseGrid] : [coarseGrid]);
  const groundMeshes = [];
  layerGroups.ground?.traverse((n) => {
    if (n.isMesh && !n.isInstancedMesh) groundMeshes.push(n);
  });
  layerGroups.backdrop?.traverse((n) => {
    if (n.isMesh && !n.isInstancedMesh && BACKDROP_GROUND.test(n.name)) groundMeshes.push(n);
  });
  rasterizeMeshes(groundMeshes, pickGrids);
  const groundHeightAt = createGroundQuery([fineGrid, coarseGrid], 0);

  // 보행 충돌용 장애물 점유 격자(0.5 m): 건물·바위·전주·교량·원경 암괴 등의 몸통 높이 부분.
  // 풀·관목(foliage)·홀로그램·발광 띠·수면·움직이는 드론은 통과. 보행 시점에 처음 들어갈 때 한 번만 만든다.
  let walkBlocker = null;
  function getWalkBlocker() {
    if (walkBlocker) return walkBlocker;
    const t0 = performance.now();
    const occ = createOccupancyGrid({ x0: -300, z0: -1300, x1: 420, z1: 300, cell: 0.5 });
    const PASS_SURFACES = new Set(['foliage', 'holo', 'water', 'emissive']);
    const obstacleMeshes = [];
    const pick = (n) => {
      if (!n.isMesh || !n.visible) return;
      if (PASS_SURFACES.has(n.userData?.nw_surface) || isAnimatedNode(n)) return;
      obstacleMeshes.push(n);
    };
    for (const key of ['ground', 'present', 'future', 'building_haus', 'building_facearch']) {
      layerGroups[key]?.traverse(pick);
    }
    layerGroups.backdrop?.traverse((n) => {
      if (/^BD_(tors|mid_)/.test(n.name)) pick(n);
    });
    const tris = markObstacleMeshes(occ, obstacleMeshes, groundHeightAt);
    walkBlocker = {
      // clearance: 발 높이 + 오를 수 있는 턱(지면 위 m). 그보다 높은 장애물이 몸 반경 안에 있으면 막힘
      isBlocked: (x, z, clearance = 0, radius = 0.35) => isBlockedAt(occ, x, z, radius, clearance),
      // 발밑 장애물 윗면(지면 위 m, 없으면 0) — 바위 위에 올라서기·착지
      topAt: (x, z, radius = 0.2) => obstacleTopAt(occ, x, z, radius),
    };
    console.info(`[nowhere] 보행 충돌 격자 ${occ.nx}×${occ.nz} (${tris} tris) ${Math.round(performance.now() - t0)} ms`);
    return walkBlocker;
  }

  // 6) 경로 이동체(드론 · 포드 · 열차 · 배송로봇 · 풍력 회전자) — layout.movers(Blender future.py mover_table)
  //    옛 layout.drones 만 있는 월드(DS2)는 Task 11 전 드론 비행을 그대로 쓴다(legacyDrones · updateLegacyDrones)
  const futureRoot = layerGroups.future;
  const moverActors = [];
  const legacyDrones = [];
  if (futureRoot && Array.isArray(layout.movers)) {
    const byGltfName = new Map();   // GLTFLoader 는 노드 이름의 '.' 을 지운다(FU_taxi.0 → FU_taxi0) — 원래 이름은 userData.name
    futureRoot.traverse((n) => {
      if (n.userData?.name) byGltfName.set(n.userData.name, n);
    });
    const plumeMat = createPlumeMaterial();   // 날으는 로드스터 분사(두 대가 함께 쓴다)
    for (const def of layout.movers) {
      if (def.kind === 'roadster' && !quality.roadsters) continue;   // 휴대폰: 로드스터를 만들지 않는다(메시는 processRoot 가 숨겼다)
      const obj = byGltfName.get(def.object) || futureRoot.getObjectByName(def.object);
      if (!obj) {
        console.warn(`[nowhere] 이동체 ${def.id}: ${def.object} 없음`);
        continue;
      }
      // optimize 의 위치 양자화가 노드 원점을 메시 상자 가운데로 옮겼다 → Blender 원점 · 방위(origin · yaw0)에 피벗을 두고 붙여 그 피벗을 움직인다
      let target = obj;
      if (def.origin) {
        target = new THREE.Group();
        target.name = `${def.object}_pivot`;
        target.position.fromArray(def.origin);
        target.rotation.y = def.yaw0 || 0;
        futureRoot.add(target);
        target.updateMatrixWorld(true);
        target.attach(obj);
      }
      if (def.kind === 'roadster') {
        // 분사(Blender 에서 차체의 자식): 웹 재질로 바꾸고 그림자를 끈다. 모양 키 번호는 이름(rear · bottom)으로, 없으면 Blender 순서 0 · 1
        // 분사의 로컬 변환(optimize 의 위치 양자화 되돌림)은 건드리지 않는다 — 모양 키 영향 · 보임만 정한다
        let plume = null;
        (byGltfName.get(def.plume) || futureRoot.getObjectByName(def.plume))?.traverse((n) => {
          if (!plume && n.isMesh) plume = n;
        });
        if (plume) {
          plume.material = plumeMat;
          plume.castShadow = false;
          plume.receiveShadow = false;
          plume.visible = false;
        } else {
          console.warn(`[nowhere] 이동체 ${def.id}: 분사 ${def.plume} 없음`);
        }
        const dict = plume?.morphTargetDictionary || {};
        target.visible = false;   // 첫 프레임 전까지(보이는 구간 밖이면 updateMoverActors 가 계속 숨긴다)
        moverActors.push({ def, object: target, plume, morph: { rear: dict.rear ?? 0, bottom: dict.bottom ?? 1 } });
        continue;
      }
      if (def.kind === 'spin') {
        moverActors.push({ def, object: target, base: target.quaternion.clone() });
        continue;
      }
      let beam = def.beam ? futureRoot.getObjectByName(def.beam) : null;
      let beamYaw = 0;
      if (beam) {
        beam = pivotBeam(beam, def.path[0], futureRoot);
        // 원뿔 축의 수평 방위를 진행 방향(앞 = 로컬 +X 를 yawOffset 만큼 돌린 쪽)에 맞춘다
        const axis = beamAxis(beam, def.path[0]);
        beamYaw = Math.PI / 2 - (def.yawOffset || 0) - Math.atan2(axis.x, axis.z);
      }
      moverActors.push({ def, object: target, beam, beamYaw, track: buildTrack(def.path, def.mode === 'loop') });
    }
  } else if (futureRoot && Array.isArray(layout.drones)) {
    // DS2: Task 11 전 드론 블록 그대로(후보 이름 · 빔 피벗 · 닫힌 Catmull-Rom 곡선 · 위상 = 찾은 순번 × 0.27)
    for (const d of layout.drones) {
      const candidates = [
        d.object,
        d.object.replace('.', '_'),
        d.object.replace('FU_drone_del.', 'FU_drone_del_mesh_'),
      ];
      let obj = null;
      for (const name of candidates) {
        obj = futureRoot.getObjectByName(name);
        if (obj) break;
      }
      let beam = d.beam ? futureRoot.getObjectByName(d.beam) : null;
      if (beam && Array.isArray(d.path) && d.path.length) beam = pivotBeam(beam, d.path[0], futureRoot);
      if (obj && Array.isArray(d.path) && d.path.length >= 2) {
        const pts = d.path.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
        const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
        legacyDrones.push({
          id: d.id,
          object: obj,
          beam,
          speed: d.speed || 8.0,
          curve,
          length: Math.max(1, curve.getLength()),
          phase: legacyDrones.length * 0.27,
        });
      }
    }
  }

  return {
    layout,
    quality,
    meshesBySurface,
    layerGroups,
    buildings: { haus: hausRoot, facearch: facearchRoot },
    buildingBoxes,   // { haus, facearch }: THREE.Box3(월드) — 배치 직후 잰 것
    uniforms,
    sky,
    lights: { hemiLight, sunLight },
    moverActors,
    legacyDrones,
    groundHeightAt,
    getWalkBlocker,
    followSun,
    // 14:00 기준 해 방향(성수 = Blender FX_sun 남서 34°, DS2 = layout.sun 북북동 26°) — 기상·시간 컨트롤러가 시각에 따라 돌린다
    sunBaseDir: sunBaseDir,
    updateEnvironmentMap,
  };
}

/** 날으는 로드스터 분사 재질(웹에서 NWF_plume 을 바꾼다): 흰 압축공기 — 반투명, 노즐에서 끝으로 옅어지는 알파(UV v), 깊이 쓰기 · 그림자 없음, 양면.
 *  Lambert 라 낮에는 밝고 밤에는 거리 조명만큼만 보인다(혼자 빛나지 않는다).
 *  알파 지도 2 열 = 원뿔 종류(future.py PLUME_U: u 0.25 뒤 · 0.75 바닥). 바닥 분사는 CP(2026-11-12)대로 더 옅게 — 최대 알파를 낮추고 노즐부터
 *  끝까지 곧바로 줄며, 시선과 거의 나란한 가장자리(|법선 · 시선| 작음)를 지워 원뿔 윤곽선이 남지 않는다. 뒤 분사는 그대로(뒤에서 보면 원뿔
 *  안쪽을 들여다보는 각이라 가장자리 감쇠를 걸면 사라진다).
 *  한 번에 그린다(forceSinglePass): 양면 반투명은 three 가 뒷면 → 앞면 두 번 그리는데(차마다 그리기 +1), 한 색 · 깊이 쓰기 없음이라 순서가
 *  바뀌어도 색은 같다. FrontSide 로 줄이면 뒤에서 열린 끝을 들여다볼 때 보이는 안쪽 면(뒷면)이 빠져 뒤 분사가 사라진다. */
function createPlumeMaterial() {
  const n = 32;
  const data = new Uint8Array(2 * n * 4);
  for (let i = 0; i < n; i++) {
    // 행 i = glTF v = i / (n − 1). glTF 는 Blender UV 의 v 를 뒤집으므로 노즐(Blender v 0) = 마지막 행, 끝(Blender v 1) = 0 행 → 0
    const v = i / (n - 1);
    const rear = Math.round(255 * 0.75 * Math.pow(v, 1.6));   // 뒤: 노즐 0.75 → 끝 0(처음 값 그대로)
    const bottom = Math.round(255 * 0.4 * Math.pow(v, 2.2));  // 바닥: 노즐 0.4 → 끝 0, 더 빨리 옅어진다
    data.set([rear, rear, rear, 255, bottom, bottom, bottom, 255], i * 8);
  }
  const alphaMap = new THREE.DataTexture(data, 2, n);
  alphaMap.magFilter = THREE.LinearFilter;
  alphaMap.minFilter = THREE.LinearFilter;
  alphaMap.needsUpdate = true;
  const mat = new THREE.MeshLambertMaterial({
    color: '#F4F7F8',
    emissive: '#2E3236',
    alphaMap,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  mat.forceSinglePass = true;
  mat.onBeforeCompile = (shader) => {
    // 바닥 원뿔(u > 0.5)만: 가장자리 감쇠 — 원뿔 가운데(시선과 수직인 면)는 그대로, 윤곽(시선과 나란한 면)은 0
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
      float nwPlumeFace = abs( dot( normal, normalize( vViewPosition ) ) );
      diffuseColor.a *= mix( 1.0, smoothstep( 0.1, 0.8, nwPlumeFace ), step( 0.5, vAlphaMapUv.x ) );`,
    );
  };
  mat.name = 'NWF_plume_web';
  return mat;
}

/** 서치라이트 원뿔을 꼭짓점(apex = 드론 경로 첫 점 = Blender 원점)에 둔 피벗에 붙인다 → 피벗(THREE.Group).
 *  meshopt 양자화로 빔 메시의 원점이 원뿔 중심(bbox 중심)으로 옮겨져 있다. 그대로 드론 위치에 두면 원뿔 가운데가 드론에 붙어
 *  위아래로 뻗는다 → Blender 원점(= 원뿔 꼭짓점)에 피벗을 두고 붙인다. */
function pivotBeam(beam, apex, root) {
  const apexWorld = new THREE.Vector3().fromArray(apex);
  beam.updateWorldMatrix(true, false);
  const apexLocal = beam.worldToLocal(apexWorld.clone());
  beam.traverse((n) => {
    if (!n.isMesh || !n.geometry?.attributes?.position) return;
    const bp = n.geometry.attributes.position;
    let len = 0;
    for (let i = 0; i < bp.count; i++) {
      len = Math.max(len, Math.hypot(bp.getX(i) - apexLocal.x, bp.getY(i) - apexLocal.y, bp.getZ(i) - apexLocal.z));
    }
    for (const m of Array.isArray(n.material) ? n.material : [n.material]) {
      if (!m) continue;
      m.userData.nwBeamApex = apexLocal.toArray();   // 셰이더 축 감쇠 기준(로컬 양자화 단위)
      m.userData.nwBeamLen = len;
    }
  });
  const pivot = new THREE.Group();
  pivot.name = `${beam.name}_pivot`;
  pivot.position.copy(apexWorld);
  root.add(pivot);
  pivot.updateMatrixWorld(true);
  pivot.attach(beam);
  return pivot;
}

/** 원뿔 축(월드, 꼭짓점 → 정점 무게중심). 테두리 정점이 축 둘레로 고르게 있어 무게중심이 축 위에 놓인다. */
function beamAxis(pivot, apex) {
  const sum = new THREE.Vector3();
  const v = new THREE.Vector3();
  let k = 0;
  pivot.updateMatrixWorld(true);
  pivot.traverse((n) => {
    const bp = n.isMesh ? n.geometry?.attributes?.position : null;
    if (!bp) return;
    for (let i = 0; i < bp.count; i++, k++) sum.add(v.fromBufferAttribute(bp, i).applyMatrix4(n.matrixWorld));
  });
  return sum.divideScalar(Math.max(k, 1)).sub(new THREE.Vector3().fromArray(apex));
}

const _qSpin = new THREE.Quaternion();
const _xAxis = new THREE.Vector3(1, 0, 0);
/** 매 프레임: 경로 위 위치 · 방향, 회전자 각도, 드론 서치라이트. */
export function updateMoverActors(actors, elapsed) {
  for (const a of actors) {
    if (a.def.kind === 'roadster') {
      const p = roadsterPose(a.def, elapsed);
      a.object.visible = p.visible;
      if (!p.visible) continue;
      a.object.position.set(p.pos[0], p.pos[1], p.pos[2]);
      // 머리 방향 → 들림 → 롤: 'YZX' = 세계 y(yaw)로 돌린 뒤 차의 옆축 z(pitch, + 코가 위), 마지막에 차의 앞 = 진행 방향 축 x(roll)
      a.object.rotation.set(p.roll, p.yaw, p.pitch, 'YZX');
      if (a.plume) {
        const on = p.thrust > PLUME_MIN;
        a.plume.visible = on;
        const inf = a.plume.morphTargetInfluences;
        if (on && inf) {
          const m = plumeMorph(p.thrust);   // 길이 ∝ thrust(뒤), 바닥은 0.5 넘는 부분
          inf[a.morph.rear] = m.rear;
          inf[a.morph.bottom] = m.bottom;
        }
      }
      continue;
    }
    if (a.def.kind === 'spin') {
      a.object.quaternion.copy(a.base).multiply(_qSpin.setFromAxisAngle(_xAxis, spinAngle(a.def, elapsed)));
      continue;
    }
    const p = moverPose(a.def, a.track, elapsed);
    a.object.position.set(p.pos[0], p.pos[1], p.pos[2]);
    a.object.rotation.set(0, p.yaw, 0);
    if (a.beam) {
      // 원뿔 수평 방위 = 진행 방향(beamYaw 로 맞춤) + 예전과 같은 흔들림
      a.beam.position.copy(a.object.position);
      a.beam.rotation.y = p.yaw + a.beamYaw + Math.sin(elapsed * 1.1) * 0.22;
    }
  }
}

const _legPos = new THREE.Vector3();
const _legNext = new THREE.Vector3();
const _legLook = new THREE.Vector3();
/** DS2(옛 layout.drones) 드론 비행 — Task 11 전 camera.js 의 갱신 식 그대로: 곡선 길이 비례 위치, 0.015 앞을 lookAt(앞 = +Z),
 *  흔들림 0.28 m, 빔은 객체 rotation.y + 흔들림. */
export function updateLegacyDrones(drones, elapsed) {
  if (!Array.isArray(drones)) return;
  for (const d of drones) {
    const u = ((elapsed * d.speed) / d.length + d.phase) % 1.0;
    const uNext = (u + 0.015) % 1.0;
    d.curve.getPointAt(u, _legPos);
    d.curve.getPointAt(uNext, _legNext);
    _legPos.y += Math.sin(elapsed * 2.4 + d.phase * 10) * 0.28;
    d.object.position.copy(_legPos);

    _legLook.copy(_legNext);
    _legLook.y = _legPos.y;
    d.object.lookAt(_legLook);

    if (d.beam) {
      d.beam.position.copy(_legPos);
      d.beam.rotation.y = d.object.rotation.y + Math.sin(elapsed * 1.1) * 0.22;
    }
  }
}
