# HAUS NOWHERE — DS2 산악 월드 / Task 2: 헤드리스 전체 빌드 · 지면 마스크 베이킹 · 7종 렌더 · GLB 내보내기.
# 실행:
#   /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python tools/nowhere/blender/ds2_build.py
import bpy, os, sys, math, time, json, shutil, importlib
import numpy as np

ROOT = os.environ.get('NW_ROOT', '/Users/gm_yeonho/new-work/so/so-viewer-monster1267')
sys.dont_write_bytecode = True
_HERE = os.path.join(ROOT, 'tools', 'nowhere', 'blender')
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

import lib
importlib.reload(lib)
from lib import smoothstep, clamp01, srgb

BLEND_PATH = os.path.join(lib.OUT, 'nowhere-ds2.blend')
RAW_DIR = os.path.join(lib.OUT, 'raw-ds2')
PUB_DIR = os.path.join(ROOT, 'public', 'assets', 'nowhere-ds2')
PUB_MOB_DIR = os.path.join(PUB_DIR, 'mobile')
PUB_REN_DIR = os.path.join(PUB_DIR, 'renders')
MASK_OUT = os.path.join(PUB_DIR, 'nowhere-ground-mask.webp')

CAM_ORDER = [
    ('street',  '개척로 시점 — 산악 협곡과 HAUS',     'ds2-street.png',  'hero-street.webp',  'overcast'),
    ('aerial',  '조감 — 초록 이끼 분지와 4겹 대산맥', 'ds2-aerial.png',  'hero-aerial.webp',  'overcast'),
    ('viaduct', '협곡 상류 — 주상절리 절벽과 개울',   'ds2-viaduct.png', 'hero-viaduct.webp', 'overcast'),
    ('night',   '산악의 밤 — 비콘과 점등된 건축',     'ds2-night.png',   'hero-night.webp',   'night'),
    ('ground',  '갈래 개울 근접 — 물웅덩이와 이끼',   'ds2-ground.png',  'hero-ground.webp',  'overcast'),
    ('lot',     '주상절리 포켓과 개척 교량',          'ds2-lot.png',     'hero-lot.webp',     'overcast'),
    ('valley',  '빙하 계곡 — 겹쳐지는 층리 암벽과 개울', 'ds2-valley.png',  'hero-valley.webp',  'overcast'),
]

DS2_ANCHORS_META = {
    'haus_podium': {
        'layer': 'building',
        'kicker': 'BUILDING · HAUS NOWHERE',
        'title': 'HAUS NOWHERE — 포디움(1–5F)',
        'summary': '50×52 m · 1–5F 노출 콘크리트',
        'priority': 100,
        'render': 'assets/nowhere-ds2/renders/hero-street.webp',
        'facts': [
            ['구간', '포디움 1–5F (깊은 캔틸레버 처마)'],
            ['전체 규모', '50 × 52 m, 최고 높이 81 m'],
            ['접지 방식', '산악 분지 중앙 노출 콘크리트 기초 패드 (z=0.0m)'],
        ],
        'lore': '초록 이끼와 검은 현무암으로 둘러싸인 고원 분지 한가운데서 1–5층 노출 콘크리트 포디움과 처마는 타임폴(Timefall) 비를 피하는 개척 거점의 회랑 역할을 한다.',
        'sources': [
            {'label': 'record.json', 'url': 'assets/record.json'},
            {'label': 'DS 비주얼 리서치', 'url': 'docs/nowhere/research/ds.md'},
        ],
    },
    'haus_tower': {
        'layer': 'building',
        'kicker': 'BUILDING · HAUS NOWHERE',
        'title': 'HAUS NOWHERE — 타워(6–11F)',
        'summary': '6–11F · 유리 커튼월과 수직 루버',
        'priority': 92,
        'render': 'assets/nowhere-ds2/renders/hero-street.webp',
        'facts': [
            ['구간', '중층 타워 6–11F'],
            ['야간 연출', '층·베이별 따뜻한 실내광 발광 (#FFA347~#FFE0AD)'],
            ['최적화', '121.5 MB → 2.4 MB (meshopt + WebP)'],
        ],
        'lore': '주상절리 절벽 위로 솟아오른 중층 타워는 낮에는 흐린 고원 하늘과 산능선 안개를 비추고, 밤에는 격자형 창문마다 따뜻한 실내 등불을 밝혀 협곡의 등대가 된다.',
        'sources': [
            {'label': 'record.json', 'url': 'assets/record.json'},
        ],
    },
    'haus_crown': {
        'layer': 'building',
        'kicker': 'BUILDING · HAUS NOWHERE',
        'title': 'HAUS NOWHERE — 크라운(11–14F)',
        'summary': '정상 81 m · 11–14F',
        'priority': 96,
        'render': 'assets/nowhere-ds2/renders/hero-aerial.webp',
        'facts': [
            ['구간', '상부 크라운 11–14F'],
            ['최고 높이', '분지 바닥 기준 +81.0 m'],
            ['대기 효과', '고도 지수 안개(Height Fog) 상층부와 교차'],
        ],
        'lore': '해발 고도가 높은 산악 분지의 짙은 골짜기 안개 위로 81m 상부 크라운이 부유하듯 솟아올라, 4겹 대산맥 능선과 수평적 대조를 이룬다.',
        'sources': [
            {'label': 'record.json', 'url': 'assets/record.json'},
        ],
    },
    'haus_garden': {
        'layer': 'building',
        'kicker': 'BUILDING · FORECOURT',
        'title': 'HAUS 전정 — 콘크리트 패드와 배수 자갈',
        'summary': 'y −25…−31 m · 빗물 집수 띠',
        'priority': 76,
        'render': 'assets/nowhere-ds2/renders/hero-street.webp',
        'facts': [
            ['구성', '풍화된 콘크리트 패드 · 배수 자갈 띠 · 고산 관목 플랜터'],
            ['접지 오염', '패드 가장자리를 따라 침투한 올리브 이끼와 습기'],
        ],
        'lore': '자연 산악 지형 위에 타설된 콘크리트 기초 패드 가장자리로 고산 이끼가 서서히 침식해 들어오며 인공 구조물과 자연 지형을 하나로 묶는다.',
        'sources': [
            {'label': 'DS 비주얼 리서치', 'url': 'docs/nowhere/research/ds.md'},
        ],
    },
    'facearch_eyes': {
        'layer': 'building',
        'kicker': 'BUILDING · FACEARCH',
        'title': 'FaceArch — 두 면의 눈',
        'summary': 'eyeball_shd · 창백한 청백색 발광',
        'priority': 95,
        'render': 'assets/nowhere-ds2/renders/hero-aerial.webp',
        'facts': [
            ['부위', '두 정면의 조형 안구 (eyeball_shd)'],
            ['야간 발광', '#CFE6FF (강도 1.1)'],
        ],
        'lore': '갈래 개울 건너편 동쪽 암반 대지 위에서 협곡과 HAUS NOWHERE를 응시하는 두 눈은 황혼과 밤이 찾아오면 서늘한 청백색 빛을 발한다.',
        'sources': [
            {'label': 'facearch.json', 'url': 'assets/facearch.json'},
        ],
    },
    'facearch_legs': {
        'layer': 'building',
        'kicker': 'BUILDING · FACEARCH',
        'title': 'FaceArch — 필로티 다리',
        'summary': '22×18 m · 지면 부양 필로티',
        'priority': 84,
        'render': 'assets/nowhere-ds2/renders/hero-aerial.webp',
        'facts': [
            ['구조', '필로티 다리 (leg_shd) 및 외부 계단'],
            ['지면 반응', '필로티 하부 비 가림(B=0) 및 그늘 AO 반영'],
        ],
        'lore': '거친 산악 지형과 습기 위에서 매스를 들어 올린 필로티 구조 아래로 개척자들과 배송 로봇이 비를 피해 머무는 그늘이 만들어진다.',
        'sources': [
            {'label': 'facearch.json', 'url': 'assets/facearch.json'},
        ],
    },
    'facearch_body': {
        'layer': 'building',
        'kicker': 'BUILDING · FACEARCH',
        'title': 'FaceArch — 둥근 삼각 매스',
        'summary': '높이 31 m · 3.5 MB',
        'priority': 88,
        'render': 'assets/nowhere-ds2/renders/hero-aerial.webp',
        'facts': [
            ['규모', '22 × 18 m, 높이 31 m'],
            ['배경 대비', '배후의 각진 주상절리 암벽과 대비되는 유기적 곡면'],
        ],
        'lore': '수직으로 쪼개진 날카로운 주상절리 절벽들 앞에서 매끄러운 곡면 삼각 매스가 초현실적인 조형적 긴장감을 자아낸다.',
        'sources': [
            {'label': 'facearch.json', 'url': 'assets/facearch.json'},
        ],
    },
    'viaduct': {
        'layer': 'present',
        'kicker': 'TERRAIN · GLACIAL VALLEY',
        'title': '빙하 계곡 층리 대암벽과 산악 고가교',
        'summary': '암벽 높이 460–580 m · 상류로 V자 수렴',
        'priority': 90,
        'render': 'assets/nowhere-ds2/renders/hero-viaduct.webp',
        'facts': [
            ['지형', 'U자 빙하 계곡 — 바닥 반폭 165 m, 상류 2.6 km 에서 53 m'],
            ['암벽 구조', '수평 층리 선반(이끼) + 회색 단애 띠 + 세로 낙석 걸리'],
            ['고가교', '계곡을 가로지르는 22 m 경간 콘크리트 아치'],
        ],
        'lore': '분지 양쪽에서 솟아오른 수백 미터의 층리 암벽은 선반마다 초록 이끼를 이고 있고, 그 사이를 가로지르는 고가교가 계곡의 스케일을 가늠하게 한다. 상류로 갈수록 두 암벽은 겹쳐져 안개 속 소실점이 된다.',
        'sources': [
            {'label': 'DS 비주얼 리서치 §1·§6', 'url': 'docs/nowhere/research/ds.md'},
        ],
    },
    'brick_belt': {
        'layer': 'present',
        'kicker': 'TERRAIN · ERRATIC BOULDERS',
        'title': '계곡 입구의 빙하 표석 무더기',
        'summary': '폭 4–6 m 표석 + 위성 바위 · 윗면 이끼',
        'priority': 82,
        'render': 'assets/nowhere-ds2/renders/hero-valley.webp',
        'facts': [
            ['소재', 'Poly Haven lichen_rock · dark_rock · rock_face_01 (CC0)'],
            ['형태', '둥근 덩어리 + 평평한 파쇄면 + 땅에 박힌 납작한 바닥'],
        ],
        'lore': '빙하가 물러나며 떨궈 놓은 회색 표석들이 계곡 입구와 산자락에 무더기로 박혀 있다. 비에 젖은 아랫부분은 어둡고, 해를 향한 윗면에는 이끼가 모자처럼 앉았다.',
        'sources': [
            {'label': 'DS 비주얼 리서치 §2', 'url': 'docs/nowhere/research/ds.md'},
        ],
    },
    'cafe_canopy': {
        'layer': 'present',
        'kicker': 'PIONEER · ROAD',
        'title': '개척 진입로 — 현무암 골재 노면',
        'summary': '폭 5.7 m · 마모된 황색 중앙선',
        'priority': 78,
        'render': 'assets/nowhere-ds2/renders/hero-street.webp',
        'facts': [
            ['구조', '서쪽 협곡 패스 ~ HAUS ~ FaceArch 연결 2차선 개척로'],
            ['표면', 'road_damaged 2k + 가장자리 이끼 침식'],
        ],
        'lore': '바위와 이끼 구릉 사이를 최소한의 절토로 잇는 좁은 개척 도로는 잦은 타임폴 비에 젖어 하늘빛을 반사하며 두 건축 거점을 연결한다.',
        'sources': [
            {'label': 'DS 비주얼 리서치 §4', 'url': 'docs/nowhere/research/ds.md'},
        ],
    },
    'wires': {
        'layer': 'present',
        'kicker': 'PIONEER · FOUNDATION',
        'title': '접지 콘크리트 패드와 침식 경계',
        'summary': '풍화 콘크리트 · 연석 경계',
        'priority': 74,
        'render': 'assets/nowhere-ds2/renders/hero-street.webp',
        'facts': [
            ['소재', 'concrete_floor_worn_001 · concrete_slab_wall_02'],
            ['특징', '하단 접지 오염 및 이끼/물웅덩이 마스크 연동'],
        ],
        'lore': '야생의 산악 고원 위에 건물을 앉히기 위해 다져 넣은 노출 콘크리트 패드는 가장자리부터 물기와 이끼에 잠식되어 지형과 자연스럽게 동화된다.',
        'sources': [
            {'label': 'DS 비주얼 리서치 §4', 'url': 'docs/nowhere/research/ds.md'},
        ],
    },
    'lot_moss': {
        'layer': 'nature',
        'kicker': 'NATURE · MOSS BIOME',
        'title': '고산 올리브 이끼 군락',
        'summary': '#3A461C ~ #5C652D · 윗면·수변 분포',
        'priority': 91,
        'render': 'assets/nowhere-ds2/renders/hero-lot.webp',
        'facts': [
            ['분포 규칙', '경사 완만부 · 오목 지형 · 개울 수변에 집중'],
            ['색상 팔레트', '올리브 그린 #3A461C ~ #5C652D (DS 시그니처 #5)'],
        ],
        'lore': '고산 협곡 산악 지형의 핵심인 초록 이끼는 아무 곳에나 자라지 않고 물이 모이는 완만한 구릉 윗면과 개울 둑에 선명한 군락을 이루어 검은 바위와 대비된다.',
        'sources': [
            {'label': 'DS 비주얼 리서치 §1·§2', 'url': 'docs/nowhere/research/ds.md'},
        ],
    },
    'lot_water': {
        'layer': 'nature',
        'kicker': 'NATURE · BRAIDED STREAM',
        'title': '갈래 개울(Braided Stream)과 수변 웅덩이',
        'summary': '거울 반사(roughness 0.035) · 빗물 파문',
        'priority': 89,
        'render': 'assets/nowhere-ds2/renders/hero-ground.webp',
        'facts': [
            ['유로', '북서 협곡에서 분지 중앙을 거쳐 남동 계곡으로 흐르는 3갈래 수로'],
            ['셰이더', '흐린 하늘 PMREM 반사 + 우천 시 동심원 파문(nwPuddleRipple)'],
        ],
        'lore': '검은 현무암 자갈밭 사이를 여러 갈래로 얕게 흐르는 산악 개울은 흐린 백색 하늘과 솟아오른 HAUS 타워를 차갑고 맑게 비춘다.',
        'sources': [
            {'label': 'DS 비주얼 리서치 §6 #9', 'url': 'docs/nowhere/research/ds.md'},
        ],
    },
    'lot_rocks': {
        'layer': 'nature',
        'kicker': 'NATURE · 3-TIER ROCKS',
        'title': '3단 스케일 표석·잡석 군집',
        'summary': '큰 표석(1단) : 중형 바위(2단) : 잔돌(3단)',
        'priority': 86,
        'render': 'assets/nowhere-ds2/renders/hero-lot.webp',
        'facts': [
            ['구성', '회색 화강암 표석 · Poly Haven 이끼 바위 6종 · 각진 쇄석'],
            ['질감', '윗면 이끼 모자 · 젖은 하부는 알베도 0.42배 감쇠'],
        ],
        'lore': '회색 표석들이 대·중·소 3단 스케일로 개울 둑과 이끼 언덕에 흩어져 있다. 큰 바위 곁에는 반드시 떨어져 나간 위성 바위와 잔돌이 모여, 계곡 바닥의 바위 들판이 우연이 아니라 오랜 시간의 결과로 읽힌다.',
        'sources': [
            {'label': 'DS 비주얼 리서치 §1·§6 #6', 'url': 'docs/nowhere/research/ds.md'},
        ],
    },
    'ginkgo': {
        'layer': 'nature',
        'kicker': 'NATURE · ALPINE FLORA',
        'title': '수변 고산 관목과 사초 다발',
        'summary': 'shrub_02 · 황갈색·올리브 풀 다발',
        'priority': 75,
        'render': 'assets/nowhere-ds2/renders/hero-ground.webp',
        'facts': [
            ['구성', '고산 관목(shrub_02) 및 교차 알파 카드 사초 다발'],
            ['색조', '어두운 황갈색(#2E2716)과 이끼 녹색(#4B5924)의 저채도 조화'],
        ],
        'lore': '거센 산바람과 차가운 비를 견디는 키 낮은 고산 관목과 사초 다발이 바위 틈새와 물가를 따라 군락을 이룬다.',
        'sources': [
            {'label': 'DS 비주얼 리서치 §2', 'url': 'docs/nowhere/research/ds.md'},
        ],
    },
    'viaduct_led': {
        'layer': 'future',
        'kicker': 'PIONEER · TRUSS BRIDGE',
        'title': '개척 트러스 교량과 도하 유도광',
        'summary': '강재 트러스 · 청색 LED #3E8AD0',
        'priority': 87,
        'render': 'assets/nowhere-ds2/renders/hero-lot.webp',
        'facts': [
            ['구조', '갈래 개울 본류를 건너 두 건물을 잇는 직선형 강재 트러스 교량'],
            ['포인트', '청회색 본체 + 교대 주황 포인트(#D4820F) + 측면 청색 유도 LED'],
        ],
        'lore': '비가 오면 급격히 불어나는 산악 갈래 개울을 안전하게 건너기 위해 가설된 금속 트러스 교량이 차가운 푸른 유도선으로 동선을 밝힌다.',
        'sources': [
            {'label': 'DS 비주얼 리서치 §4', 'url': 'docs/nowhere/research/ds.md'},
        ],
    },
    'rooftop_screen': {
        'layer': 'future',
        'kicker': 'PIONEER · CHIRAL BEACON',
        'title': '카이랄 통신 비콘 — 능선 중계망',
        'summary': '높이 5.2 m · 청록 발광 #43ABA7',
        'priority': 85,
        'render': 'assets/nowhere-ds2/renders/hero-night.webp',
        'facts': [
            ['배치', '개척 진입로·교량·암릉 거점 12개소 + 원경 산봉우리 중계탑'],
            ['색상', '상단 청록 발광 링(#43ABA7) + 하단 고채도 주황 칼라(#D4820F)'],
        ],
        'lore': '안개 낀 산악 지형에서 길을 잃지 않도록 일정 간격으로 세워진 수직 비콘 기둥들이 원경 산봉우리의 중계탑까지 점점이 이어진다.',
        'sources': [
            {'label': 'DS 비주얼 리서치 §4', 'url': 'docs/nowhere/research/ds.md'},
        ],
    },
    'smart_crossing': {
        'layer': 'future',
        'kicker': 'PIONEER · ROAD BRIDGE',
        'title': '남측 도하 교량 — 침수 방지 데크',
        'summary': '폭 6.2 m · 운송 차량·보행 겸용',
        'priority': 80,
        'render': 'assets/nowhere-ds2/renders/hero-night.webp',
        'facts': [
            ['위치', '남측 개척 진입로 개울 도하 구간 (x 36…64 m)'],
            ['조명', '야간 수면에 반사되는 측면 청색 안전 LED'],
        ],
        'lore': '서쪽 협곡에서 진입한 수송 동선이 개울 본류를 건너 FaceArch로 이어지도록 지지하는 중하중 강재 데크 교량이다.',
        'sources': [
            {'label': 'DS 비주얼 리서치 §4', 'url': 'docs/nowhere/research/ds.md'},
        ],
    },
    'bus_shelter': {
        'layer': 'future',
        'kicker': 'PIONEER · HOLO SCANNER',
        'title': '기상·타임폴 홀로그램 스캐너',
        'summary': '시안 홀로그램 #53C8D9 · 스캔 링',
        'priority': 83,
        'render': 'assets/nowhere-ds2/renders/hero-night.webp',
        'facts': [
            ['위치', 'HAUS 동측 전정 패드 및 개울 교량 진입부'],
            ['셰이더', '실시간 스캔라인 점멸 홀로그램(uNwSurfaceKind=8)'],
        ],
        'lore': '산악 분지의 급격한 기상 변화와 타임폴 강우 밀도, 주변 지형 등고선을 입체 홀로그램 링으로 투영하는 현장 관측 단말이다.',
        'sources': [
            {'label': 'DS 비주얼 리서치 §4', 'url': 'docs/nowhere/research/ds.md'},
        ],
    },
    'auto_taxi': {
        'layer': 'future',
        'kicker': 'PIONEER · CARGO POD',
        'title': '방수 화물 포드 — 주황 고채도 마커',
        'summary': '#D4820F 포인트 · 호박색 상태등',
        'priority': 77,
        'render': 'assets/nowhere-ds2/renders/hero-street.webp',
        'facts': [
            ['색채 규칙', '저채도 풍경 속 소면적 고채도 주황(#D4820F) 포인트'],
            ['배치', 'HAUS 및 FaceArch 접지 패드 가장자리 6개소'],
        ],
        'lore': '온통 무채색 바위와 저채도 이끼로 뒤덮인 산악 풍경 속에서 작은 면적의 선명한 주황색 화물 포드가 시각적 초점과 인공물의 존재감을 드러낸다.',
        'sources': [
            {'label': 'DS 비주얼 리서치 §2·§4', 'url': 'docs/nowhere/research/ds.md'},
        ],
    },
    'patrol_drone': {
        'layer': 'future',
        'kicker': 'PIONEER · AERIAL DRONE',
        'title': '산악 협곡 순찰·화물 드론 편대',
        'summary': '정찰 1기(탐조등) + 화물 드론 3기',
        'priority': 81,
        'render': 'assets/nowhere-ds2/renders/hero-night.webp',
        'facts': [
            ['구성', '원뿔형 탐조등을 비추는 정찰 드론 1기 + 주황 화물 컨테이너 드론 3기'],
            ['비행 고도', '분지 상공 18–42 m 폐곡선 순항'],
        ],
        'lore': '험준한 바위 절벽과 개울 위로 자율 비행 드론 편대가 화물 컨테이너를 매달고 두 거점 사이를 묵묵히 오간다.',
        'sources': [
            {'label': 'DS 비주얼 리서치 §4', 'url': 'docs/nowhere/research/ds.md'},
        ],
    },
}


def to_three(v):
    return [round(float(v[0]), 3), round(float(v[2]), 3), round(float(-v[1]), 3)]


def update_ds2_ground_drive(sc):
    """HAUS 캔틸레버 하부 · FaceArch 필로티 하부 · 개척 교량 하부의 비 가림과 AO 그늘을 nw_drive 에 반영한다."""
    import bake
    G = bpy.data.collections.get('NW_ground')
    if G is None:
        return 0
    rects = [(-25.0, -25.8, 25.0, 25.8)]
    updated = 0
    for o in G.all_objects:
        if o.type != 'MESH':
            continue
        me = o.data
        drv = me.color_attributes.get('nw_drive')
        if drv is None:
            continue
        n = len(me.vertices)
        buf = [0.0] * (n * 4)
        drv.data.foreach_get('color', buf)
        mw = o.matrix_world
        for i, v in enumerate(me.vertices):
            co = mw @ v.co
            x, y = co.x, co.y
            r, g, b, a = buf[4 * i : 4 * i + 4]
            fc = bake._facearch_cover(x, y)
            if fc > 0.0:
                b = min(b, 1.0 - 0.72 * fc)
                g = max(g, 0.65 * fc)
            bd = min((bake._rect_dist(x, y, rc) for rc in rects), default=99.0)
            if bd < 2.2:
                wall_sh = (1.0 - smoothstep(0.0, 2.2, max(0.0, bd))) * 0.78
                g = max(g, wall_sh)
            buf[4 * i : 4 * i + 4] = [clamp01(r), clamp01(g), clamp01(b), clamp01(a)]
        drv.data.foreach_set('color', buf)
        updated += 1
    return updated


def apply_overcast(sc):
    """흐림 무드 + DS2 역광 헤이즈 룩(ds2_look: 북북동 낮은 해, 태양 헤이즈 하늘, 전방 산란 안개, 고대비 톤)."""
    import ds2_look
    importlib.reload(ds2_look)
    lib.apply_mood(sc, 'overcast', bake=False)
    ds2_look.apply(sc)


def bake_ds2(sc):
    import bake
    importlib.reload(bake)
    bake.MASK_OUT = MASK_OUT
    bake.MASK_RGB_PNG = os.path.join(lib.OUT, 'renders', 'ds2-ground-mask-rgb.png')
    bake.MASK_PUD_PNG = os.path.join(lib.OUT, 'renders', 'ds2-ground-mask-puddle.png')
    os.makedirs(PUB_DIR, exist_ok=True)
    apply_overcast(sc)
    update_ds2_ground_drive(sc)
    gm = bake.bake_ground_mask(sc, bake.MASK_SIZE)
    # PR_via.* 및 FU_bridge_* 도 Cycles AO 베이킹 대상에 포함되도록 별칭 보강
    vao = bake.bake_vertex_ao(sc)
    return {'ground_mask': gm, 'vertex_ao': vao}


def render_ds2_views(sc):
    os.makedirs(PUB_REN_DIR, exist_ok=True)
    os.makedirs(os.path.join(lib.OUT, 'renders'), exist_ok=True)

    current_mood = None
    converted = []
    for cid, _, png_name, webp_name, mood in CAM_ORDER:
        cam = bpy.data.objects.get(f'CAM_{cid}')
        if cam is None:
            continue
        if mood != current_mood:
            if mood == 'overcast':
                apply_overcast(sc)
            else:
                lib.apply_mood(sc, mood, bake=False)
            current_mood = mood
        png_path = os.path.join(lib.OUT, 'renders', png_name)
        lib.render(sc, cam, png_path, res=(1280, 720), samples=28)
        dst_webp = os.path.join(PUB_REN_DIR, webp_name)
        im = bpy.data.images.load(png_path, check_existing=False)
        _ = im.pixels[0]
        im.filepath_raw = dst_webp
        im.file_format = 'WEBP'
        im.save()
        bpy.data.images.remove(im)
        converted.append((webp_name, os.path.getsize(dst_webp)))

    if current_mood != 'overcast':
        apply_overcast(sc)

    hdr_src = os.path.join(lib.SRC, 'hdri', 'urban_street_03_1k.hdr')
    hdr_dst = os.path.join(PUB_DIR, 'sky-1k.hdr')
    shutil.copy2(hdr_src, hdr_dst)
    print(f"[ds2_build] rendered {len(converted)} views:", converted)
    return converted


def export_ds2_layout_and_anchors(sc):
    import ds2_future as future
    haus = bpy.data.objects.get('BLD_haus')
    fa = bpy.data.objects.get('BLD_facearch')
    buildings = {
        'haus': {
            'pos': to_three(haus.location if haus else (0.0, 0.0, 0.0)),
            'rotY': round(math.degrees(haus.rotation_euler.z) if haus else 0.0, 2),
        },
        'facearch': {
            'pos': to_three(fa.location if fa else (105.0, 15.0, 0.0)),
            'rotY': round(math.degrees(fa.rotation_euler.z) if fa else 27.0, 2),
        },
    }

    cameras = []
    for cid, label, _, webp_name, mood in CAM_ORDER:
        cam = bpy.data.objects.get(f'CAM_{cid}')
        if cam is None or cam.type != 'CAMERA':
            continue
        loc = cam.location
        tgt = cam.get('target', [0.0, 0.0, 0.0])
        lens = cam.data.lens
        sw = cam.data.sensor_width or 36.0
        sh = sw * 9.0 / 16.0
        vfov = round(2.0 * math.degrees(math.atan((sh * 0.5) / lens)), 2)
        cameras.append({
            'id': cid,
            'label': label,
            'pos': to_three(loc),
            'target': to_three(tgt),
            'fov': vfov,
            'mood': mood,
            'render': f'assets/nowhere-ds2/renders/{webp_name}',
        })

    anchors = []
    A = bpy.data.collections.get('NW_anchors')
    if A is not None:
        for e in sorted(A.objects, key=lambda o: o.name):
            if not e.name.startswith('ANCHOR_'):
                continue
            aid = e.name[len('ANCHOR_'):]
            layer = str(e.get('nw_layer', 'present'))
            title = str(e.get('nw_title', aid))
            meta = DS2_ANCHORS_META.get(aid, {})
            anchors.append({
                'id': aid,
                'layer': layer,
                'pos': to_three(e.location),
                'title': meta.get('title', title),
                'facts': meta.get('facts', [['분류', layer]]),
                'lore': meta.get('lore', f'DS2 산악 월드의 {title} 지점.'),
                'source': meta.get('sources', [{'url': 'docs/nowhere/research/ds.md'}])[0]['url'],
                'render': meta.get('render', 'assets/nowhere-ds2/renders/hero-street.webp'),
            })

    drones = []
    for did, pts in future.DRONE_PATHS.items():
        obj_name = 'FU_drone_sec' if did == 'sec' else f'FU_drone_del.{int(did[1:]) - 1}'
        drones.append({
            'id': did,
            'object': obj_name,
            'beam': 'FU_drone_sec_beam' if did == 'sec' else None,
            'speed': future.DRONE_SPEED.get(did, 8.0),
            'path': [to_three(p) for p in pts],
        })

    import ds2_look
    x0, y0, x1, y1 = lib.MASK_RECT
    layout = {
        'world': 'ds2',
        'title': 'HAUS NOWHERE — DS2 산악 고원',
        # 웹(world.js) 키 라이트·하늘 헤이즈·안개 산란광이 Blender FX_sun 과 같은 해 방향을 쓰도록 기록
        'sun': {'dir': ds2_look.sun_dir_three(), 'color': ds2_look.SUN_COLOR,
                'azimuth': ds2_look.SUN_AZIMUTH, 'elevation': ds2_look.SUN_ELEVATION},
        'buildings': buildings,
        'cameras': cameras,
        'anchors': anchors,
        'drones': drones,
        'maskRect': [x0, y0, x1, y1],
    }
    os.makedirs(PUB_DIR, exist_ok=True)
    layout_path = os.path.join(PUB_DIR, 'layout.json')
    with open(layout_path, 'w', encoding='utf-8') as f:
        json.dump(layout, f, ensure_ascii=False, indent=2)

    anchors_path = os.path.join(PUB_DIR, 'anchors.ko.json')
    with open(anchors_path, 'w', encoding='utf-8') as f:
        json.dump(DS2_ANCHORS_META, f, ensure_ascii=False, indent=2)

    print(f'[ds2_build] wrote {layout_path} and {anchors_path} ({len(anchors)} anchors)')
    return layout


def bake_and_export_live():
    """라이브 Blender 세션에 이미 빌드된 DS2 씬에서 베이킹 · .blend 저장 · 7종 렌더 · GLB 내보내기를 수행한다."""
    t0 = time.time()
    import export
    importlib.reload(export)
    sc = lib.get_scene(True)
    for other_sc in list(bpy.data.scenes):
        if other_sc != sc:
            bpy.data.scenes.remove(other_sc, do_unlink=True)

    print('[ds2_build] 1) Baking ground mask (2048x2048) & Cycles vertex AO...')
    bake_ds2(sc)
    apply_overcast(sc)
    lib.bake_light_probes(sc)
    sc['nw_baked'] = True

    os.makedirs(os.path.dirname(BLEND_PATH), exist_ok=True)
    bpy.data.libraries.write(BLEND_PATH, {sc}, compress=True)
    print(f'[ds2_build] Saved {BLEND_PATH} ({os.path.getsize(BLEND_PATH) / (1024 * 1024):.2f} MB)')

    print('[ds2_build] 2) Rendering 6 camera views & exporting layout.json / anchors.ko.json...')
    render_ds2_views(sc)
    export_ds2_layout_and_anchors(sc)

    print('[ds2_build] 3) Converting materials & exporting raw GLBs...')
    export.RAW_DIR = RAW_DIR
    export.PUB_DIR = PUB_DIR
    export.PUB_MOB_DIR = PUB_MOB_DIR
    export.PUB_REN_DIR = PUB_REN_DIR
    export.FLAT_MAT_SPECS['NWF_cargo_orange'] = ('#D4820F', 0.42, 0.25, 1.0)
    export.prepare_materials_for_export()
    export.prepare_meshes_for_export()
    export.export_collection_glbs()
    print(f'[ds2_build] Live bake & export done in {round(time.time() - t0, 1)} s')


def main():
    t0 = time.time()
    import ds2_ground, ds2_present, ds2_future, ds2_backdrop
    importlib.reload(ds2_ground)
    importlib.reload(ds2_present)
    importlib.reload(ds2_future)
    importlib.reload(ds2_backdrop)

    print('[ds2_build] Building DS2 mountain scene (ground -> present -> future -> backdrop)...')
    for default_name in ('Cube', 'Camera', 'Light'):
        obj = bpy.data.objects.get(default_name)
        if obj is not None:
            bpy.data.objects.remove(obj, do_unlink=True)
    ds2_ground.build()
    ds2_present.build()
    ds2_future.build()
    ds2_backdrop.build()
    bake_and_export_live()
    print(f'[ds2_build] Total done in {round(time.time() - t0, 1)} s')


if __name__ == '__main__':
    main()
