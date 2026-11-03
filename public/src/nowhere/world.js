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

  // 3) 하늘 돔 + 조명 + 환경 반사맵(PMREM) 구성
  const sky = createSkyDome(uniforms);
  scene.add(sky.mesh);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  // DS 시그니처 #4: 젖은 노면이 어두운 집/나무 대신 밝은 흐린 하늘을 비추도록 하늘 돔 기반 PMREM 생성
  const envScene = new THREE.Scene();
  const envSkyClone = createSkyDome(uniforms);
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
      const beam = d.beam ? futureRoot.getObjectByName(d.beam) : null;
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
    updateEnvironmentMap,
  };
}
