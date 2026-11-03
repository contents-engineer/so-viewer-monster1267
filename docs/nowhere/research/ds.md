# Death Stranding (1 / 2: On the Beach) 비주얼 품질 타깃 리서치

목적: 에셋 복제 없이 "Death Stranding 급으로 읽히는" 시각 원칙을 추출해, CC0 텍스처(Poly Haven 등) + Blender 지오메트리 + Three.js r170 커스텀 셰이더로 재현한다.
레퍼런스 이미지 12장: 프로젝트 밖 내부 레퍼런스로 보관, 배포 안 함. 출처 URL은 `ds-image-sources.md`. 이미지는 내부 참고용이며 출하하지 않는다.

## 0. 읽는 법과 신뢰도

- **[확인]** 1차/준1차 자료에서 확인한 사실. URL을 붙였다.
- **[관찰]** 공식 스크린샷 12장을 직접 보고 측정한 값. hex는 최종 화면(톤매핑/그레이딩 이후, sRGB) 영역 중앙값이라 알베도가 아니다. 알베도로 쓰려면 라이팅과 그레이딩 손실을 감안해 약간 밝게 잡는다.
- **[제안]** 우리 파이프라인용 해석이다. 근거가 약하면 그렇게 쓴다.
- 솔직한 한계: Death Stranding의 지형 셰이더, 젖음(wetness), 이끼 블렌딩의 내부 구현을 직접 공개한 GDC/CEDEC 환경아트 발표는 찾지 못했다. 공개된 것은 (1) Kojima Productions의 height fog 발표, (2) 같은 엔진(Decima)을 쓰는 Guerrilla의 배치 시스템 발표, (3) RenderDoc 프레임 분석, (4) 개발진 AMA/인터뷰 정도다. 나머지는 스크린샷 관찰에서 역산했다.

## 1. 환경과 지형 언어

**실제 근거 [확인]**
- 환경 아티스트가 아이슬란드 현지 답사로 자료를 수집했고, 찍어온 실제 자연 사진을 포토그래메트리로 3D 데이터화해 바위, 절벽, 용암, 지형 에셋으로 썼다. Kojima Productions 테크니컬 아트 디렉터 Hideki Sasaki의 AMA 답변: https://deathstrandingpc.505games.com/ru/?p=7760
- 지형 렌더링은 특별한 기법보다 "고폴리 지형 메시 + POM(Parallax Occlusion Mapping) + 고해상도 텍스처"의 조합으로 소형 자갈/돌을 만들고 큰 바위는 실제 지오메트리라는 분석(분석가 견해, 일부 추정): https://gamingbolt.com/death-stranding-graphical-analysis-pushing-the-ps4-to-its-max-limit
- RenderDoc 프레임 분석: 지형은 여러 Terrain 버텍스 포맷(Terrain I~IV)으로 그려지고, "아티스트가 만든 월드 displacement map"을 버텍스 셰이더에 넘기는 방식이다. 눈/진흙은 플레이어 주변 top-view 1024x1024 depth 패스로 변형 텍스처를 만든다: https://mamoniem.com/behind-the-pretty-frames-death-stranding/
- DS2: 눈 덮인 산에 시간을 크게 투자했고 오픈월드에 새 낮/밤 사이클을 넣었다(Takayuki Uchida, Lead Environment Artist): https://blog.playstation.com/2025/06/25/death-stranding-2-on-the-beach-launch-interview/

**지형 구성 요소 [관찰]**
- 검은 현무암 평원과 자갈, 마른 갈색 풀 다발(ds-01), 기둥형(주상절리) 현무암 절벽과 각진 블록 필드(ds-06), 적갈색 화산암 지표(ds-09), 밝은 층리 암반 슬랩(ds-08), 얕은 갈래 개울과 습지(ds-04, ds-07), 먼 설산(ds-02, ds-07).
- **바위는 3단 스케일**로 읽힌다 (ds-06): (1) 절벽 = 수 m 단위 큰 평면과 수직 균열, (2) 중형 = 0.5~2 m 각진 블록이 무더기로 쌓임, (3) 소형 = 잔 자갈. 모서리가 각져 있고 둥근 하천석이 거의 없다. 그래서 "지질학적으로 믿을 만한" 인상을 준다.
- **이끼는 아무 데나 있지 않다.** 물이 모이는 오목한 곳, 개울 둑, 바위 윗면에 선명한 패치로 모이고 수직 절벽면에는 거의 없다(ds-06). 이끼가 칠해진 곳과 헐벗은 곳의 대비가 지형을 읽게 한다.
- **거리 읽기** [관찰]
  - 근경(0~15 m): 가장 어둡고 가장 대비가 크다. 젖은 지면, 개별 자갈, 풀 다발, POM 디테일.
  - 중경(15~150 m): 바위 군집과 이끼 패치가 덩어리로 보이고, 밝기가 오르며 푸른 회색이 섞이기 시작한다.
  - 원경(150 m~): 능선 실루엣이 3~4겹. 겹마다 더 밝고, 더 푸르고, 더 평평해진다. 디테일은 없고 윤곽만 있다(ds-01, ds-03, ds-04).
- 물: 폭이 좁고 얕은 여러 갈래, 바위 주변에만 흰 거품, 원경에 가는 폭포(ds-03, ds-04, ds-06).

## 2. 재질과 팔레트

**측정 팔레트 [관찰]** (화면 영역 중앙값, 알베도 아님)

| 대상 | hex | 출처 컷 |
|---|---|---|
| 흐린 낮 하늘 | #E7E9E4, #F0F1E6, 어두운 쪽 #C5CFCF | ds-02, 03, 04, 01 |
| 원경 안개/능선 | #9EA9AE, #D2D9D7 (밝은 쪽), 푸른 쪽 #77828F, #697989 | ds-01, 03 |
| 젖은 검은 현무암(근경) | #273133, #333738, 하이라이트 #4C5A61 | ds-01, 02 |
| 건조한 바위 블록 | #373C31, #46473B, 하이라이트 #7C8881 | ds-06 |
| 밝은 층리 암반(DS1/DS2) | #8D8170, #A8A084 | ds-08, 11 |
| 이끼(전체 중앙값) | #3A461C, #3C452C, 하이라이트 #5C652D | ds-03, 06 |
| 마른 풀 다발 | #231F11 (매우 어두운 황갈색) | ds-01 |
| 적갈색 화산암 | #32251C (그늘), 하늘 #E5DCCB | ds-09 |
| 주황 포인트(운송 트럭 페인트) | #D4820F | ds-08 |
| Timefall(비) | 하늘/안개 #4F6A76, 근경 #202F32 | ds-05 |
| DS2 황혼 | 하늘 #F1BE84, 중경 #804F2D | ds-12 |
| DS2 푸른 시간(폭풍 직전) | #3E5172, #5E739E, 근경 #212B42 | ds-10 |

- 전체 통계 [관찰]: 흐린 낮 컷의 평균 채도(HSV)는 0.11~0.20. 휘도 5퍼센트 지점이 약 31/255(블랙이 눌리지 않고 살짝 떠 있다), 95퍼센트 지점이 약 240(하늘은 거의 흰색). 비 장면(ds-05)은 95퍼센트 지점이 109로 상한이 낮다. 황혼(ds-12)은 평균 채도 0.55로 급상승한다. 즉 "평소엔 저채도, 이벤트(황혼/비/먼지)에서만 색이 한쪽으로 쏠린다".
- 이끼는 화면상 중앙값은 어둡지만(#3A461C) 채도가 높은 올리브-그린이라 선명하게 읽힌다. 명도보다 채도로 읽힌다.

**젖음 [관찰]**
- 젖은 현무암(ds-01, ds-02)은 알베도가 거의 검정까지 어두워지고, 러프니스가 낮아져 흐린 하늘을 푸르스름하게 반사한다. 평평한 면일수록 반사가 강하고, 얼룩 형태(저지대, 오목한 곳, 개울 근처)로 분포한다. 비 장면에서는 전역 젖음(ds-05).
- 팬 재현 사례(80.lv)도 "월드 좌표 기반 젖음 마스크 + 알베도/러프니스 상수 조정 + 개울 가장자리 우선"으로 구현했다: https://80.lv/articles/death-stranding-style-scene-assets-vegetation-composition-workflow, https://80.lv/articles/the-stranding-project-combining-houdini-and-ue4-in-environment-art/

**마스크 설계 힌트 [확인, 같은 엔진]**: Guerrilla의 WorldData 맵 목록에 `Variance_RockColor`, `Variance_Lichen_Density`, `Erosion_Wear/Flow/Deposition`, `Terrain_Cavity`, `Water_Flow`가 있다. 바위 색 변이, 지의류 밀도, 침식 마모/흐름/퇴적, 요철(cavity)이 재질을 몬다는 뜻이다. https://www.guerrilla-games.com/media/News/Files/GDC2017_VanMuijden_GPUBasedProceduralPlacementInHorizonZeroDawn.pdf (DS가 동일 맵을 쓴다는 직접 증거는 없다.)

**인공물 재질 [관찰]**: 콘크리트는 중회색에 하단 오염, 금속 패널은 어두운 청회색에 약한 반사, 주황/노랑은 "작은 면적의 고채도 포인트"로만 쓰고 페인트 긁힘/먼지/접지부 오염을 얹는다(ds-08). 청색 발광은 점 단위의 작은 포인트로만 쓴다.

## 3. 조명과 대기

- **Height fog [확인]**: Kojima Productions(Kohei Ishiyama)가 SIGGRAPH 2017에서 발표했다. 사진 같은 공기 원근(aerial perspective)과 연출용 두꺼운/색 있는 안개를 하나의 모델로 처리하려고, **해석적 height fog 모델**을 **사전계산 대기산란(Bruneton/Elek 기반 LUT)** 에 결합했다. transmittance LUT 자리에 sunlight/skylight LUT를 넣어 안개 모델에 직접 공급하고, "맑음"과 "짙은 안개" 두 날씨만 사전계산해 그 사이를 보간한다. 가정은 단일 산란 + 단일 scale height(지수 밀도 감쇠). 최종 = 배경 방사(하늘) x α(투과율) + 태양 단일산란 + 상수 환경광의 합이다. 슬라이드: https://www.advances.realtimerendering.com/s2017/DecimaSiggraph2017.pdf , 요약: https://www.dualshockers.com/death-stranding-fog-model-ps4/ (수식 슬라이드는 이미지라 코드는 직접 확인하지 못했다.)
- **AO는 약하다 [확인]**: "Death Stranding goes light on the ambient occlusion"(흐린 날씨라 접촉 그림자도 약함). https://gamingbolt.com/death-stranding-graphical-analysis-pushing-the-ps4-to-its-max-limit
- **후처리 체인 [확인, RenderDoc]**: bloom, 저해상도 bokeh DOF, light shaft, lens flare, noise/grain, 색보정(대비/노출/화이트밸런스), 비네팅, 32x32x32 LUT 컬러 그레이딩, 톤매핑, 모션블러, TAA. 비 구름 밀도는 128x128 weather map에서 파생. https://mamoniem.com/behind-the-pretty-frames-death-stranding/
- **확산광 [관찰]**: 하늘 전체가 큰 소프트박스라 그림자가 거의 없고, 구름 틈에서 간헐적으로 빛줄기가 내려온다(ds-03 원경 폭포 위, ds-10 구름 사이).
- **안개 색은 지역/상황마다 다르다 [관찰]**: 흐린 낮 = 차가운 흰-청(#9EA9AE ~ #77828F), 화산 지대 = 따뜻한 회색(ds-09), 황혼/먼지 = 오렌지(#F1BE84), Timefall = 청록(#4F6A76), DS2 푸른 시간 = 보라 기운 청(#5E739E). 안개 색이 곧 장면의 감정이다.
- **낮 vs 황혼**: 낮은 저채도/저대비/흰 하늘, 황혼은 하늘이 따뜻한 오렌지가 되고 중경이 갈색으로 눌린다(ds-12). DS2는 새 낮/밤 사이클을 넣었다.
- **Timefall**: 휘도 상한을 눌러 장면 전체를 한 덩어리로 묶고(95퍼센트 휘도 109), 빗줄기 층과 검게 젖은 지면, 짧아진 시야, 입자 불꽃이 들어간다(ds-05).

## 4. 인공 구조물의 언어 [관찰, 원리만]

- **매스**: 큰 직육면체/경사 슬랩/트러스 위주의 단순한 덩어리. 곡면이 거의 없고 모서리는 얇은 챔퍼. 교량은 트러스 실루엣(ds-09 원경), 통신/중계탑은 가는 수직선(ds-03, ds-09), 도로는 단순한 2차선 + 마모된 노란 중앙선(ds-02).
- **패널 이음**: 깊이가 균일한 분할선, 큰 패널 위주, 리벳은 드물게. 이음선에 오염이 모인다.
- **색 포인트**: 본체는 중채도 회색/청회색. 주황(운송), 노랑(화물), 청 발광(위치 표시)은 작은 면적에만 쓴다.
- **풍경과의 관계**: 인공물은 화면에서 작고(ds-03 시설은 화면 폭의 1/4 미만), 안개에 반쯤 잠기며, 하단은 이끼/흙/젖은 얼룩으로 지면에 접지된다. 자연이 스케일로 압도하는 구도다.
- 로고/문구/차량/캐릭터 디자인은 복제하지 않는다. 가져올 것은 "단순 매스 + 접지 오염 + 작은 고채도 포인트 + 안개 속 실루엣"이라는 규칙뿐이다.

## 5. 제작 방식 정리

- 현지 답사 + 포토그래메트리 + 작가 후가공 [확인: AMA]. DS2의 아웃소싱 바위 제작 페이지에는 "산은 바위와 같은 프로세스로 만들고 여러 버전을 블렌딩한 뒤 마이크로 디테일 텍스처를 얹는다"는 요지가 있다(검색 요약만 확인, 페이지는 403): https://jockeyj.artstation.com/projects/P60ve3 , https://bigbeluga.artstation.com/projects/g0aP5e
- 자연물 배치는 밀도 맵 + 디더 기반 GPU 배치, ecotope별 에셋/색/날씨 정의(에셋 500종+, 오브젝트 10만+, GPU 평균 약 250us)가 Decima 계열의 방식이다 [확인, Horizon 발표]. DS 직접 근거는 아니라 "엔진 계열 원리"로만 쓴다.
- 팬 재현 사례(UE)는 텍스처 4종(이끼/자갈/모래/바위)만으로 커버+블렌드+젖음을 만들고, 조명은 방향광 + 대기뿐이며 "차가운 흰-청 안개"가 핵심이라고 했다: https://80.lv/articles/death-stranding-style-scene-assets-vegetation-composition-workflow . 재질 수를 줄이고 마스크로 변이를 만든다는 교훈이다.

## 6. "Death Stranding 급으로 읽히는" 시각 시그니처 15개와 구현법

비용 표기(모바일 GPU 기준): **cheap** = 프레임에 거의 영향 없음, **medium** = 눈에 띄는 비용이라 예산 관리 필요, **expensive** = 모바일에서는 대체안 사용.

1. **거의 흰색의 흐린 하늘, 그림자 없는 확산광**
   구현: 하늘 셰이더로 지평선 #E7E9E4 → 천정 #C5CFCF 그라디언트 + 저주파 fbm 구름 2~3옥타브. 라이팅은 HemisphereLight/약한 IBL이 주(主)이고 DirectionalLight는 낮게(그림자 없음 또는 부드러운 1장). SSAO는 쓰지 않고 Blender에서 AO를 구워 vertex color/텍스처로 넣는다. **cheap**.
2. **3~4겹의 공기 원근(원경이 밝고 푸르고 평평함)**
   구현: 커스텀 높이 지수 안개(아래 코드). Blender에서 원경 능선을 3~4겹의 저폴리 실루엣 메시로 배치하고 겹마다 거리만 벌린다(안개가 명도/색을 알아서 올린다). 안개색은 근경 #9EA9AE → 원경 하늘색으로 거리 보간. **cheap** (프래그먼트당 exp 몇 번).
3. **근경은 어둡고 원경은 밝은 역(逆) 명암 구조 + 눌리지 않은 블랙**
   구현: 톤매핑은 AgX/ACES 계열의 부드러운 어깨, exposure ~0.8~1.0, 블랙 리프트 5~8퍼센트(`c = c*(1-l) + l`), 채도 0.7~0.8, 대비는 낮게. 근경 지면 알베도는 어둡게(0.03~0.08 선형), 하늘이 밝아 보이게 둔다. 그레이딩은 풀스크린 패스 1개에 합친다. **cheap**.
4. **젖은 검은 현무암과 물 광택**
   구현(머티리얼 `onBeforeCompile`): `w = saturate(uWet * (maskG + 0.35*cavity - 0.2)); albedo *= mix(1.0, 0.45, w); rough = mix(rough, 0.18, w);` 반사는 정적 PMREM(흐린 하늘) + Fresnel로 푸른 광택. 마스크 G는 Blender에서 저지대/오목/개울 거리 + 노이즈로 구운 vertex color. `uWet` 하나로 맑음→비 전역 전환. SSR은 쓰지 않는다. **cheap~medium** (환경맵 샘플 1회).
5. **이끼는 윗면, 오목한 곳, 물가에만**
   구현: Blender Geometry Nodes/Attribute로 `normal.z > 0.6` & cavity & 개울 거리 마스크를 만들어 vertex color R에 굽는다. 셰이더에서 높이 블렌드(`moss if heightMoss + mask > t`)로 가장자리를 들쭉날쭉하게. 색은 올리브 #3A461C ~ #5C652D에 채도 높게, 수직면 제외. **cheap**(vertex color) / **medium**(이끼 텍스처 추가 샘플).
6. **바위 3단 스케일과 군집**
   구현: Blender에서 기본 바위 6~10종(각진 블록형, 200~1500 tri) + 절벽 평면 모듈 2~3종을 만들고 Geometry Nodes로 밀도 맵(경사, 개울 거리) 기반 분포 + 군집(대형 1 : 중형 5~8 : 소형 다수). GLB에 변형별 1메시로 내보내고 Three `InstancedMesh`로 인스턴싱, 원거리는 LOD/컬링. 인스턴스 총량은 수천 이하로 시작. **medium**.
7. **마이크로 디테일(근경 노말) 이중 타일링**
   구현: triplanar 또는 UV 2중 노말(주기 약 4 m + 약 0.5 m), 거리에 따라 fade. DS 근경은 POM이 자갈을 만들지만 모바일에서는 POM 대신 근경 타일만 버텍스 displacement 메시 + 높이 기반 블렌드로 대체. **cheap**(노말 2장) / **expensive**(POM).
8. **지형 거시 구조: 어두운 평원 + 층층 능선, 거의 평평한 지평선**
   구현: Blender로 heightmap 지형(근경 고밀도 1만~2만 tri, 중경 저밀도, 원경 실루엣 카드). 침식/적층은 노이즈 + 경사 마스크로. 지평선은 낮게, 하늘이 화면의 40~55퍼센트. **cheap**.
9. **얕은 갈래 개울(braided stream)**
   구현: 평면 메시 여러 갈래 + flow-map 스크롤 노말 2샘플 + 투명도는 vertex color 가장자리 알파, 바위 접촉부 흰 거품은 vertex color 마스크. 반사는 PMREM 재사용. **medium** (투명 오버드로우 주의, 면적 제한).
10. **구름 틈 빛줄기(원경 한두 곳)**
    구현: 가산 블렌딩 반투명 카드 메시 1~2장(거리 fade, 안개색 곱) 또는 방사 블러 god-ray 후처리. 카드 방식을 기본으로. **cheap**(카드) / **medium**(후처리).
11. **Timefall(비) 무드 전환**
    구현: 상태 값 한 세트로 전환 — `uWet=1`, 안개 밀도 x2~3, 안개/하늘색 #4F6A76 쪽, exposure 0.7, 휘도 상한 낮춤. 빗줄기는 카메라에 붙인 인스턴스 스트릭(속도 방향으로 늘린 얇은 quad 2~3층), 웅덩이는 낮은 러프니스(~0.05) 평면 데칼 + 정적 환경 반사. **medium**.
12. **인공물 재질: 접지 오염, 패널 이음, 작은 고채도 포인트**
    구현: 콘크리트 + 얕은 베벨/이음 노말, 월드 y 기반 하단 오염 그라디언트(흙색 #2E2A22), 세로 빗물 얼룩 텍스처, 접지부에 이끼 마스크. 주황/노랑은 소면적 + 가장자리 스크래치(금속 노출), 청 발광은 bloom threshold 위로만. **cheap**.
13. **스케일 대비 구도(건축은 작게, 자연이 압도)**
    구현: 카메라/배치 규칙으로 처리. 건축은 화면 폭의 20~30퍼센트, 전경에 이끼 낀 바위, 중경에서 안개에 반쯤 잠기게 한다. 비용 없음(아트 디렉션). **cheap**.
14. **절제된 그레이딩: 섀도 청록, 하이라이트 따뜻한 흰색, 약한 그레인/비네팅**
    구현: 한 패스에 섀도 틴트(#1F3A3F 방향), 하이라이트 틴트(#F4F1E6), 채도 0.7~0.8, 필름 그레인 sigma 0.02~0.03, 비네팅 약, bloom은 threshold 높게(발광점에만), 저해상도 bokeh DOF는 모바일에서 생략. **cheap~medium**.
15. **공기 중 입자(먼지/재/빗방울 불꽃)**
    구현: 카메라 주변 박스에 100~300개 포인트 스프라이트, 소프트 파티클 없이 알파 + 거리 fade, 느린 노이즈 이동. Blender 필요 없음. **cheap**.

**높이 지수 안개 해석해 (우리 구현용 GLSL, 직접 도출)**
```glsl
// 지수 밀도 b*exp(-k*y) 를 카메라→프래그먼트 선분으로 적분한 폐형 해
float heightFog(vec3 cam, vec3 pos, float b, float k) {
  vec3 d = pos - cam; float len = length(d);
  float t = abs(k*d.y) > 1e-4 ? (exp(-k*cam.y) - exp(-k*pos.y)) / (k*d.y) : exp(-k*cam.y);
  return 1.0 - exp(-b * len * t);          // fog 양(0..1), 1-fog = 투과율 α
}
// color = mix(sceneColor, fogColor, fog);  fogColor = 하늘 지평선색 + 태양방향 약한 따뜻한 틴트(단일산란 흉내)
```

## 7. 파이프라인 적용 요약 (Blender → GLB → Three r170)

- **마스크는 vertex color로 굽는다**: glTF는 `COLOR_0`만 안정적으로 쓴다. R=이끼, G=젖음, B=cavity/AO로 패킹하고 `onBeforeCompile`에서 직접 읽는다(three의 기본 vertexColors는 albedo 곱이므로 쓰지 말고 attribute를 직접 사용). Blender 쪽은 Float/Byte Color 속성 + "Active"로 내보냈는지 확인한다.
- **재질 수는 적게**: 지형은 4재질(검은 현무암 자갈, 바위, 이끼, 마른 풀 흙)을 triplanar + vertex color 마스크로 섞는다. 텍스처는 2K 이하, KTX2(Basis)로 압축.
- **모바일 예산**: 풀스크린 패스는 합쳐서 1~2개(톤매핑+그레이딩+그레인+비네팅 통합), SSAO/SSR/볼류메트릭 레이마치는 쓰지 않고 구운 AO + PMREM + 높이 안개로 대체한다.
- **상태 한 세트로 무드 전환**: `{uWet, fogDensity, fogColor, exposure, skyTop, skyHorizon, saturation}`를 낮/비/황혼 프리셋으로 둔다. 안개색을 지역/시간마다 바꾸는 것이 DS의 감정 연출 핵심이다.
- **Poly Haven CC0 후보 (API로 존재 확인, https://polyhaven.com/a/<id> )**
  - 바위/지형 텍스처: `rock_boulder_dry`, `rock_pitted_mossy`, `mossy_rock`, `lichen_rock`, `dark_rock_02`, `rocks_ground_01`~`09`, `rocky_terrain`, `rocky_terrain_02`, `aerial_rocks_02`, `coast_sand_rocks_02`, `dry_river_pebbles`, `river_small_rocks`, `clean_pebbles`
  - 도로/콘크리트/금속: `asphalt_02`, `worn_asphalt`, `road_damaged`, `concrete_wall_007`, `rough_concrete`, `preconcrete_wall_001`, `rebar_reinforced_concrete`, `painted_concrete`, `metal_plate`, `rusty_metal_02`
  - 모델: `rock_moss_set_01`, `rock_moss_set_02`, `boulder_01`, `namaqualand_boulder_02`~`06`, `moss_01`
  - 환경 반사용 HDRI(하늘 렌더 자체는 셰이더로): `kloofendal_overcast_puresky`, `kloofendal_misty_morning_puresky`, `kloofendal_28d_misty_puresky`
  - 주의: 이 목록은 이름 기반 선별이라 실제 색/스케일은 가져온 뒤 확인해야 한다. 검은 현무암은 정확히 같은 텍스처가 없어서 `dark_rock_02`/`rocks_ground_*`를 어둡게 잡거나 회색 바위 알베도를 곱셈으로 눌러야 할 수 있다.

## 8. 레퍼런스 보드 (12장, 상세 출처는 `ds-image-sources.md`)

| 파일 | 용도 |
|---|---|
| ds-01 basalt-plain-overcast-fog | 젖은 검은 평원, 3겹 안개, 근경 어둡고 원경 밝음 |
| ds-02 wet-road-basalt-moss | 젖은 도로, 현무암, 이끼 둑 |
| ds-03 moss-ridge-distant-facility-haze | 이끼 전경, 안개 속 시설, 능선 4겹 |
| ds-04 overcast-valley-stream-vista | 흐린 와이드, 개울, 하늘-원경 융합 |
| ds-05 timefall-rain-wet-ground | 비, 전역 젖음, 낮은 휘도 상한 |
| ds-06 boulder-field-stream-cliff | 바위 3단 스케일, 물가 이끼, 개울 |
| ds-07 braided-wetland-snow-peaks-structure | 갈래 물길 습지, 설산, 어두운 인공물 실루엣 |
| ds-08 rock-slab-weathered-orange-truck | 암반 슬랩, 주황 포인트, 페인트 마모 |
| ds-09 volcanic-red-rock-relay-haze | 따뜻한 안개, 적갈색 화산암, 중계 시설 |
| ds-10 ds2-dusk-storm-cliff-fog | DS2 푸른 시간, 젖은 암벽 |
| ds-11 ds2-rocky-peaks-scree-grass | DS2 각진 봉우리, 스크리, 흙길 |
| ds-12 ds2-golden-dusk-dust-pylons | DS2 황혼/먼지 그레이딩 |

## 9. 한계와 주의

- Death Stranding 지형/젖음/이끼 셰이더의 1차 공개 자료는 확인하지 못했다. 위 구현법은 스크린샷 역산과 같은 엔진 계열 자료, 팬 재현 사례에 기반한 [제안]이다.
- ArtStation(DS2 아웃소싱) 페이지 2개와 Push Square 갤러리, Digital Foundry 원문(Eurogamer)은 접근이 막혀 검색 요약으로만 참조했다.
- 색 hex는 모두 화면 측정치이며 알베도가 아니다.
- 스크린샷/로고/문구(BRIDGES 등)/차량·캐릭터 디자인은 어떤 형태로도 에셋에 쓰지 않는다. 팔레트와 규칙만 가져온다.
