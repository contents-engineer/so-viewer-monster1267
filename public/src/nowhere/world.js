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

export async function createWorld({
  renderer,
  scene,
  tier = 'desktop',
  worldVer = 'seongsu',
  onProgress = null,
}) {
  const quality = getQualityConfig(tier, worldVer);

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
  sunLight.castShadow = false;
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
    { key: 'haus', url: 'assets/gm_building.glb', fallbackSurface: 'building' },
    { key: 'facearch', url: 'assets/facearch.glb', fallbackSurface: 'building' },
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

  function isAnimatedNode(node) {
    let cur = node;
    while (cur) {
      if (typeof cur.name === 'string' && cur.name.includes('drone')) return true;
      cur = cur.parent;
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
        let targetMat = m;
        if (patchedMaterials.has(m) && m.userData._nwSig !== sig) {
          targetMat = m.clone();
        }
        targetMat.userData._nwSig = sig;
        patchSurfaceMaterial(targetMat, surf, uniforms, hasVertMask);
        patchedMaterials.add(targetMat);
        return targetMat;
      });

      node.material = Array.isArray(node.material) ? nextMats : nextMats[0];

      // 고폴리 반복 소품(덮개 차량 등) 및 모바일 등급 소품 감축으로 데스크톱(≤2.0M)·모바일(≤0.9M) 예산 충족
      if (quality.tier === 'mobile') {
        if (node.name === 'PR_wires' || node.name.startsWith('BD_mid_')) {
          node.visible = false;
          return;
        }
      }
      if (node.isInstancedMesh) {
        const triPerInst = (node.geometry?.index ? node.geometry.index.count : (node.geometry?.attributes?.position?.count || 0)) / 3;
        if (quality.tier === 'mobile') {
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
  processRoot(hausRoot, 'building_haus', 'building');

  const facearchRoot = loadedMap.facearch.gltf.scene;
  const faceCfg = layout.buildings?.facearch || { pos: [105, 0, -15], rotY: 27 };
  facearchRoot.position.fromArray(faceCfg.pos);
  facearchRoot.rotation.y = THREE.MathUtils.degToRad(faceCfg.rotY || 0);
  processRoot(facearchRoot, 'building_facearch', 'building');

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
      if (PASS_SURFACES.has(n.userData?.nw_surface) || /^FU_drone/.test(n.name)) return;
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

  // 6) 드론 객체 연결 (Task 7 비행 애니메이션용)
  const futureRoot = layerGroups.future;
  const droneActors = [];
  if (futureRoot && Array.isArray(layout.drones)) {
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
      if (beam && Array.isArray(d.path) && d.path.length) {
        // meshopt 양자화로 빔 메시의 원점이 원뿔 중심(bbox 중심)으로 옮겨져 있다. 그대로 드론 위치에 두면
        // 원뿔 가운데가 드론에 붙어 위아래로 뻗는다 → Blender 원점(= 원뿔 꼭짓점 = 드론 경로 첫 점)에 피벗을 두고 붙인다.
        const apexWorld = new THREE.Vector3().fromArray(d.path[0]);
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
        futureRoot.add(pivot);
        pivot.updateMatrixWorld(true);
        pivot.attach(beam);
        beam = pivot;
      }
      if (obj && Array.isArray(d.path) && d.path.length >= 2) {
        const pts = d.path.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
        const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
        droneActors.push({
          id: d.id,
          object: obj,
          beam,
          speed: d.speed || 8.0,
          curve,
          length: Math.max(1, curve.getLength()),
          phase: droneActors.length * 0.27,
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
    uniforms,
    sky,
    lights: { hemiLight, sunLight },
    droneActors,
    groundHeightAt,
    getWalkBlocker,
    // 14:00 기준 해 방향(성수 = Blender FX_sun 남서 34°, DS2 = layout.sun 북북동 26°) — 기상·시간 컨트롤러가 시각에 따라 돌린다
    sunBaseDir: sunBaseDir,
    updateEnvironmentMap,
  };
}
