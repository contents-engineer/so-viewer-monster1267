# HAUS NOWHERE — 성수 2041 / Task 5: GLB 4개 · layout.json · sky-1k.hdr · 렌더 WebP 내보내기.
# 실행: 헤드리스 blender -b build/nowhere/nowhere.blend --python-expr "exec(open('.../export.py').read(), {'__name__': '__main__'})"
#
# 하는 일
#   1) public/assets/nowhere/layout.json 생성:
#      - buildings (BLD_haus, BLD_facearch)
#      - cameras (CAM_street, CAM_aerial, CAM_viaduct, CAM_night, CAM_ground, CAM_lot, CAM_future)
#      - anchors (ANCHOR_* 24개: id, layer, pos, title, facts, lore, source, render)
#      - movers (이동체 표: future.py 가 장면 속성 nw_movers 에 기록한 드론 · 포드 · 열차 · 배송로봇 · 풍력 회전자)
#      - solids (경로 여유 검사용 상자: 건물 표 · 아파트 · 고가 상판 · HAUS · FaceArch · nw_solid=1 객체, solid_boxes())
#      모든 좌표는 Blender Z-up (x, y, z) → Three.js Y-up (x, z, −y) 로 변환.
#   2) public/assets/nowhere/sky-1k.hdr 복사 (build/nowhere-src/hdri/urban_street_03_1k.hdr).
#   3) 히어로·카메라 렌더를 WebP(1280×720)로 public/assets/nowhere/renders/*.webp 에 저장.
#   4) glTF 내보내기용 재질 단순화:
#      Blender 의 NW_Surface / _grime_material 노드 그룹은 웹(surface.js)이 실시간 GLSL 로 처리하므로,
#      glTF 내보내기 직전에 각 재질의 Principled BSDF 에 (색 보정이 적용된) 알베도·ARM·노멀·발광 텍스처를 직접 연결한다.
#      (원본 .blend 파일은 덮어쓰지 않으므로 Blender EEVEE 용 노드 트리는 nowhere.blend 에 그대로 보존된다.)
#   5) 정점 속성 정리:
#      - NW_ground 광역 지면 메시에서 nw_drive(FLOAT_COLOR)를 제거해 COLOR_0 으로 나가지 않게 하고,
#        UVMap_mask 가 두 번째 UV(TEXCOORD_1)로 나가도록 정리.
#   6) 컬렉션별 원시 GLB 내보내기 → build/nowhere/raw/nowhere-{ground,present,future,backdrop}.glb
import bpy, os, sys, math, json, shutil, time, importlib
import numpy as np
from mathutils import Vector

ROOT = os.environ.get('NW_ROOT', '/Users/gm_yeonho/new-work/so/so-viewer-monster1267')
sys.dont_write_bytecode = True
_HERE = os.path.join(ROOT, 'tools', 'nowhere', 'blender')
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)
import lib
importlib.reload(lib)
from lib import srgb

RAW_DIR = os.path.join(lib.OUT, 'raw')
PUB_DIR = os.path.join(ROOT, 'public', 'assets', 'nowhere')
PUB_MOB_DIR = os.path.join(PUB_DIR, 'mobile')
PUB_REN_DIR = os.path.join(PUB_DIR, 'renders')
GEN_EXP_DIR = os.path.join(lib.OUT, 'gen', 'export_tex')

# ───────────────────────────── 좌표 변환: Blender (x, y, z) → Three.js (x, z, -y)
def to_three(v):
    return [round(float(v[0]), 3), round(float(v[2]), 3), round(float(-v[1]), 3)]


# ───────────────────────────── 카메라 · 앵커 메타데이터
# 렌더 원본(build/nowhere/renders): Task 12 부터 7 장 모두 웹 캡처(맑음 14:00, 밤거리는 21:30, 1600 × 900 → 1280 × 720, UI 없이 캔버스만).
# lib.MOODS 에 'clear' 가 없어 Blender 렌더로는 2041 모습(맑음 · 해 그림자)을 만들 수 없다. 옛 렌더는 renders/old-hero-t12/ · t2-* · t4-* 에 남아 있다
CAM_ORDER = [
    ('street',  '거리 시점 — 연무장길',       'hero-street.png',  'hero-street.webp'),
    ('aerial',  '조감 — 성수 블록과 4겹 능선', 'hero-aerial.png',  'hero-aerial.webp'),
    ('viaduct', '2호선 고가 하부',            'hero-viaduct.png', 'hero-viaduct.webp'),
    ('night',   '밤거리 — 상점 불빛과 청록 발광선', 'hero-night.png', 'hero-night.webp'),
    ('ground',  '노면 근접 — 연석 · 청록 발광선', 'hero-ground.png', 'hero-ground.webp'),
    ('lot',     '포켓 공원',                  'hero-lot.png',     'hero-lot.webp'),
    ('future', '2041 골목 — 고가 튜브와 새 타워', 'hero-future.png', 'hero-future.webp'),
]

# 각 앵커별 기본 요약(Task 8 의 anchors.ko.json 과 연동되며 layout.json 스키마도 충족)
ANCHOR_META = {
    'haus_podium': {
        'facts': [['구간', '포디움 1–5F'], ['전체 규모', '50 × 52 m, 높이 81 m']],
        'lore': '비 잦은 2041년에도 1–5층 노출 콘크리트 포디움과 깊은 캔틸레버 처마는 연무장길 보행자의 비가림 쉼터로 작동한다.',
        'source': 'public/assets/record.json',
        'render': 'assets/nowhere/renders/hero-street.webp',
    },
    'haus_tower': {
        'facts': [['구간', '타워 6–11F'], ['원본', 'GM_building_temp.fbx (Blender 5.2.2)']],
        'lore': '성수 저층 벽돌 창고 띠 위로 솟은 중층 매스가 주변 산능선 안개 속에서 블록의 방위 기준점이 된다.',
        'source': 'public/assets/record.json',
        'render': 'assets/nowhere/renders/hero-street.webp',
    },
    'haus_crown': {
        'facts': [['구간', '크라운 11–14F, 정상 81 m'], ['최적화', '121.5 MB → 2.4 MB (12.8만 tri)']],
        'lore': '해발 81m 상부 크라운은 강변 안개층과 맞닿으며 야간에는 절제된 간접 세척광으로 윤곽만 드러낸다.',
        'source': 'public/assets/record.json',
        'render': 'assets/nowhere/renders/hero-aerial.webp',
    },
    'haus_garden': {
        'facts': [['구성', '전정 흰 자갈 화단 · 식재 플랜터 · 벤치'], ['배치', '포디움 남측 y −25…−31 m']],
        'lore': '캔틸레버 낙수선을 따라 깔린 흰 자갈 화단이 처마에서 떨어지는 빗물을 집수해 배수로로 흘려보낸다.',
        'source': 'docs/nowhere/research/seongsu.md',
        'render': 'assets/nowhere/renders/hero-street.webp',
    },
    'facearch_eyes': {
        'facts': [['부위', '두 면의 눈 (eyeball_shd)'], ['야간 발광', '#CFE6FF, 강도 1.1']],
        'lore': '동쪽 일방 골목 건너편에서 뚝섬로와 HAUS 사이를 응시하는 두 눈 매스는 밤마다 창백한 푸른 빛을 띤다.',
        'source': 'public/assets/facearch.json',
        'render': 'assets/nowhere/renders/hero-aerial.webp',
    },
    'facearch_legs': {
        'facts': [['부위', '필로티 다리 (leg_shd) · 계단 2개'], ['규모', '22 × 18 m, 높이 31 m']],
        'lore': '지면에서 들어 올려진 필로티 다리 아래로 빗물에서 피신한 보행자와 배송 로봇의 동선이 이어진다.',
        'source': 'public/assets/facearch.json',
        'render': 'assets/nowhere/renders/hero-aerial.webp',
    },
    'facearch_body': {
        'facts': [['부위', '둥근 삼각 매스 (body_shd)'], ['최적화', '24.5 MB + 텍스처 208 MB → 3.5 MB (26만 tri)']],
        'lore': '성수의 직각 벽돌 창고와 대비되는 곡면 매스가 골목 어귀의 조형적 랜드마크를 이룬다.',
        'source': 'public/assets/facearch.json',
        'render': 'assets/nowhere/renders/hero-aerial.webp',
    },
    'viaduct': {
        'facts': [['구조', '콘크리트 아치 교각 + 적벽돌 충전벽, 경간 22 m'], ['높이', '레일면 9.0 m, 유리 튜브 꼭대기 15 m(성수역 승강장 구간은 승강장까지 덮는 넓은 튜브)'], ['그 위', '유리 튜브 안으로 열차 2편이 오가고, 상판 바깥 가장자리에는 화단과 덩굴이 있다'], ['소재', 'concrete_slab_wall_02 · brick_wall_001 · CC0']],
        'lore': '1980년대 건설된 2호선 고가교는 2041년에도 철거되지 않고 아치 하부를 자재 창고·이륜차 주차장으로 품은 채 블록 북쪽을 가로지른다.',
        'source': 'docs/nowhere/research/seongsu.md',
        'render': 'assets/nowhere/renders/hero-viaduct.webp',
    },
    'brick_belt': {
        'facts': [['규모', '2–4F, 30–65 × 12–25 m 직사각 동 열주 배치'], ['지붕·녹화', '박공 지붕은 해 쪽 면 태양광, 평지붕은 태양광 줄 + 옥상정원. 벽에는 담쟁이 · 수직정원'], ['소재', 'church_bricks_02 · brick_wall_001 · CC0']],
        'lore': '1970–80년대 준공업지역 적벽돌 공장과 창고들이 헐리지 않은 채 공방·로스터리·작업실로 겹겹이 고쳐 쓰이며 성수의 바탕 결을 유지한다.',
        'source': 'docs/nowhere/research/seongsu.md',
        'render': 'assets/nowhere/renders/hero-viaduct.webp',
    },
    'cafe_canopy': {
        'facts': [['유형', '적벽돌 창고 1층 개조 카페 + 무광 흑색 강판 캐노피'], ['부품', 'modular_factory_facade 창호 · 북면 진열창의 투명 디스플레이 · 앞 보도 파라솔 테라스 4조'], ['소재', 'brick_wall_001 · modular_factory_facade · CC0']],
        'lore': '낡은 조적조 벽체 1층을 터서 강철 프레임 통유리와 무광 흑색 캐노피를 끼워 넣은 성수동 특유의 리노베이션 어휘가 그대로 남아 있다. 2041년에는 벽의 실외기를 걷어내 외벽이 말끔해졌고, 앞 보도에는 파라솔 테라스가 놓였다.',
        'source': 'docs/nowhere/research/seongsu.md',
        'render': 'assets/nowhere/renders/hero-night.webp',
    },
    'restored_brick': {
        'facts': [['구현', 'present.py AGE_SCALE 0.35 — 벽 정점 마스크의 그을음·빗물 얼룩·하단 이끼를 옛 세기의 35 %로'], ['걷어낸 것', '옥상 물탱크·실외기·옥상 광고판, 내려진 셔터(1층은 유리 상점)'], ['소재', 'church_bricks_02 · brick_wall_001 · CC0']],
        'lore': '2041년 성수 도시재생 사업은 골목 위 전선 다발을 땅속으로 묻고(지중화), 공장 띠의 적벽돌은 헐지 않고 세척했다. 그을음과 빗물 자국을 걷어내자 붉은 벽이 다시 드러났고, 내려져 있던 셔터 자리에는 유리 상점이 들어섰다.',
        'source': 'docs/nowhere/research/seongsu.md',
        'render': 'assets/nowhere/renders/hero-viaduct.webp',
    },
    'workshop': {
        'facts': [['유형', '1–2F 골함석 지붕·외벽 소규모 금속·수제화 작업동'], ['부품', '1층 개구부는 유리 상점(내려진 셔터는 철거) · 박공 지붕 해 쪽 면 태양광'], ['소재', 'corrugated_iron_03 · CC0']],
        'lore': '녹슨 골함석 외벽 안쪽에서 소규모 금속 가공과 수제화 공방의 백열 작업등이 새어 나온다. 2041년에는 내려져 있던 셔터 자리가 유리 개구부로 바뀌어 작업하는 모습이 거리에서 보이고, 박공 지붕 남쪽 면에는 태양광이 얹혔다.',
        'source': 'docs/nowhere/research/seongsu.md',
        'render': 'assets/nowhere/renders/hero-viaduct.webp',
    },
    'villas': {
        'facts': [['규모', '4–5F 다세대·연립주택, 1층 필로티 주차 및 근린상가'], ['특징', '외부 철제 계단 · 옥상 태양광 줄 + 옥상정원(물탱크·실외기는 철거)'], ['부품', 'modular_fire_escape · CC0']],
        'lore': '공장 지대와 맞닿은 1990년대 적벽돌 연립주택들이 옥상에는 물탱크 대신 태양광 줄과 작은 정원을 이고, 외부 철제 계단과 필로티 주차의 중층 주거 결을 지킨다.',
        'source': 'docs/nowhere/research/seongsu.md',
        'render': 'assets/nowhere/renders/hero-aerial.webp',
    },
    'apartments': {
        'facts': [['규모', '12–13F 판상형 아파트 3동 (높이 36–39 m) + 9F 복합동'], ['외벽 배색', '크림 도장 #D9D3B8 · 회백색 측벽 띠 #BFC3C6'], ['녹화·태양광', '북면 층마다 발코니 식재 띠, 옥상 태양광 70 % + 옥상정원(복합동 옥상은 태양광 90 %)'], ['배치', '뚝섬로 남측 y −70…−150 m']],
        'lore': '뚝섬로 건너편을 따라 나란히 서 있는 한국형 판상 아파트 단지가 성수 저층 블록 남쪽의 수평 장벽과 야간 생활광을 이룬다.',
        'source': 'docs/nowhere/research/seongsu.md',
        'render': 'assets/nowhere/renders/hero-street.webp',
    },
    'park_lawn': {
        'facts': [['잔디', 'aerial_grass_rock 2k를 녹색으로 보정(NW_turf), 지면 기복 ±0.25 m'], ['산책로', '닫힌 고리 폭 2.0 m, concrete_pavers_02 보도블록, 잔디 + 0.02 m'], ['식재', '관목 화단 4곳(shrub_02 0.6배) · 벤치 6 · 느티나무 8그루']],
        'lore': '공사 가림막 뒤에 오래 방치됐던 철거 빈터는 2041년 주민 참여형 도시재생으로 잔디와 둘레 산책로를 갖춘 포켓 공원이 됐다. 점심이면 근처 공방 사람들이 벤치에 나와 앉는다.',
        'source': 'docs/nowhere/research/seongsu.md',
        'render': 'assets/nowhere/renders/hero-lot.webp',
    },
    'park_water': {
        'facts': [['구현', '웅덩이 3곳의 수평 수면 + 얕은 물길, 지면 마스크 A채널'],
                  ['경계석', '현무암 작은 기둥(직접 모델링) 0.4 m 간격']],
        'lore': '빗물이 고이던 낮은 땅은 빗물을 모아 흘려보내는 물길 정원으로 다듬어졌다. 비가 오면 물길이 차오르고 맑은 날에는 하늘을 비춘다.',
        'source': 'docs/nowhere/research/seongsu.md',
        'render': 'assets/nowhere/renders/hero-lot.webp',
    },
    'park_stones': {
        'facts': [['구성', '주상절리 현무암 덩어리 3개(직접 모델링)'], ['소재', 'dark_rock (CC0)']],
        'lore': '빈터 시절부터 있던 현무암 덩어리 가운데 큰 세 개는 치우지 않고 공원의 조경석으로 남겼다.',
        'source': 'docs/nowhere/research/seongsu.md',
        'render': 'assets/nowhere/renders/hero-lot.webp',
    },
    'ginkgo': {
        'facts': [['배치', '뚝섬로 남측 보도 8 m 간격 가로수 구덩이 8기'], ['구현', '저폴리 교차 수관 카드 메시 + 1.2 m 주철 보호판'], ['수종', '서울 가로수 대표 수종 은행나무 (2041 맑은 여름: 녹색 잎)']],
        'lore': '은행나무 가로수 띠가 회색 보도블록과 차가운 근미래 안내광 사이로 여름 녹음의 수관 그늘을 드리운다.',
        'source': 'docs/nowhere/research/seongsu.md',
        'render': 'assets/nowhere/renders/hero-street.webp',
    },
    'led_line': {
        'facts': [['설계 모티프', '근미래 모티프 #1 — 기존 고가 상판 하부 연속 발광선'], ['색상·파장', '청색 #3E8AD0 (주간 은은한 유도광 / 야간 고휘도)'], ['연장 구간', '블록 내부 고가 양측 모서리 전 구간']],
        'lore': '1980년대 콘크리트 고가 상판 하부 모서리에 덧대어진 파란 자율교통 유도선이 노면 위에 긴 반사 띠를 만든다. 비 오는 밤에는 젖은 노면에 번진다.',
        'source': 'docs/nowhere/research/dbh.md',
        'render': 'assets/nowhere/renders/hero-night.webp',
    },
    'led_screen': {
        'facts': [['모티프', '근미래 모티프 #2 — 벽돌 창고 위 비계 LED 스크린'], ['규모', '12.0 × 6.75 m, 아연도금 비계 프레임']],
        'lore': '붉은 벽돌 창고 지붕을 헐지 않고 철제 비계로 얹은 대형 상태 스크린이 구역 기상·대기 지수를 표시한다.',
        'source': 'docs/nowhere/research/dbh.md',
        'render': 'assets/nowhere/renders/hero-night.webp',
    },
    'smart_crossing': {
        'facts': [['설계 모티프', '근미래 모티프 #3 — 노면 매립 발광 횡단보도·연석'], ['색상', '청록 #43ABA7 · 백색 #E4EEF5'], ['노면', '뚝섬로 가운데 폭 2 m 태양광 노면 띠, 띠 가장자리와 연석 안쪽에 청록 발광선'], ['위치', '뚝섬로 중앙 횡단보도 (x ≈ −14 m) 및 정류장 연석']],
        'lore': '마모된 백색 도색 옆에 매립된 방수 바닥 LED 바가 길 가운데 태양광 노면 띠와 이어져, 자율주행 포드와 보행자의 우선권을 나눈다.',
        'source': 'docs/nowhere/research/dbh.md',
        'render': 'assets/nowhere/renders/hero-street.webp',
    },
    'bus_kiosk': {
        'facts': [['설계 모티프', '근미래 모티프 #4 — 유리 캐노피 정류장 & 투명 키오스크'], ['프레임', '다크 알루미늄 #2A2D31 · 6200K 주백색 천장 라인'], ['배치', '북측 보도 정류장 쉘터 1곳 · 독립 키오스크 1기, 뚝섬로 양쪽 보도와 동쪽 골목에 투명 키오스크 6기']],
        'lore': '기존 보도블록 위에 설치된 얇은 알루미늄 유리 쉘터와 투명 정보 키오스크가 무인 셔틀 배차 간격과 침수 우회로를 표시한다.',
        'source': 'docs/nowhere/research/dbh.md',
        'render': 'assets/nowhere/renders/hero-street.webp',
    },
    'robotaxi': {
        'facts': [['설계 모티프', '근미래 모티프 #5 — 측면 상태창 자율주행 포드'], ['배치', '5대: 뚝섬로를 오가는 3대 + 이면도로·골목을 도는 2대(layout.movers 경로)'], ['외장', '무광 펄 그레이 #C9CDD0 · 시안 상태 디스플레이, 포드마다 한 재질(공용 아틀라스)']],
        'lore': '운전석 없이 대칭 캡슐 형태로 다듬어진 자율주행 포드가 측면 창 띠에 탑승 가능 상태와 목적지 구역 코드를 띄운 채 길을 오간다.',
        'source': 'docs/nowhere/research/dbh.md',
        'render': 'assets/nowhere/renders/hero-street.webp',
    },
    'drone_patrol': {
        'facts': [['설계 모티프', '근미래 모티프 #6 — 탐조등 보안 드론 1기 + 소포를 매단 배송 드론 5기(d1–d5)'], ['비행 고도', '보안 순찰 18–25 m, 소포 배송 16–46 m'], ['경로', 'Catmull-Rom 폐곡선 궤도 실시간 비행(layout.movers)']],
        'lore': '고가 하부와 적벽돌 골목 상공을 순회하는 쿼드로터 보안 드론이 옅은 원뿔형 탐조등 빛줄기를 드리우고, 소포를 매단 배송 드론들이 뚝섬로와 골목 위를 오간다.',
        'source': 'docs/nowhere/research/dbh.md',
        'render': 'assets/nowhere/renders/hero-night.webp',
    },
}


# ───────────────────────────── 렌더 WebP 변환 및 HDRI 복사
def export_renders_and_hdri(sc):
    os.makedirs(PUB_REN_DIR, exist_ok=True)
    # CAM_lot 렌더가 없으면 한 장 렌더해 둔다
    lot_png = os.path.join(lib.OUT, 'renders', 't2-lot.png')
    if not os.path.exists(lot_png) and bpy.data.objects.get('CAM_lot') is not None:
        lib.apply_mood(sc, 'overcast', bake=False)
        lib.render(sc, bpy.data.objects['CAM_lot'], lot_png, res=(1280, 720), samples=32)

    converted = []
    for cid, _, src_name, dst_name in CAM_ORDER:
        src = os.path.join(lib.OUT, 'renders', src_name)
        if not os.path.exists(src):
            # 대체 후보
            for alt in (f'hero-{cid}.png', f't4-{cid}-iter2.png', f't3-{cid}.png', f't2-{cid}.png', 'hero-street.png'):
                p = os.path.join(lib.OUT, 'renders', alt)
                if os.path.exists(p):
                    src = p
                    break
        dst = os.path.join(PUB_REN_DIR, dst_name)
        im = bpy.data.images.load(src, check_existing=False)
        _ = im.pixels[0]  # filepath_raw 변경 전에 픽셀 버퍼를 메모리에 강제 로드
        im.filepath_raw = dst
        im.file_format = 'WEBP'
        im.save()
        bpy.data.images.remove(im)
        converted.append((dst_name, os.path.getsize(dst)))

    hdr_src = os.path.join(lib.SRC, 'hdri', 'urban_street_03_1k.hdr')
    hdr_dst = os.path.join(PUB_DIR, 'sky-1k.hdr')
    os.makedirs(PUB_DIR, exist_ok=True)
    shutil.copy2(hdr_src, hdr_dst)
    print('exported renders:', converted, 'sky-1k.hdr:', os.path.getsize(hdr_dst))
    return converted


# ───────────────────────────── layout.json 생성
def _box_three(id_, mn, mx):
    a = to_three(mn); b = to_three(mx)
    return {'id': id_, 'min': [round(min(a[i], b[i]), 2) for i in range(3)], 'max': [round(max(a[i], b[i]), 2) for i in range(3)]}


def solid_boxes():
    """인트로·투어 비행·이동체 경로의 여유 검사용 상자(three 좌표, m).
    건물 표(present.BELT·C1·E1·SOUTH, 박공은 용마루까지), 아파트, 고가 상판, HAUS·FaceArch, nw_solid=1 객체(월드 AABB)."""
    import present
    out = []
    for specs in (present.BELT, present.C1, present.E1, present.SOUTH):
        for sp in specs:
            x0, y0, x1, y1 = sp['rect']
            h = sp['gf'] + (sp['fl'] - 1) * sp['fh'] + sp.get('par', 0.0)
            if sp.get('roof') == 'gable':
                half = ((y1 - y0) if sp.get('ridge', 'x') == 'x' else (x1 - x0)) / 2.0
                h += half * math.tan(math.radians(sp.get('pitch', 12)))
            out.append(_box_three(sp['name'], (x0, y0, 0.0), (x1, y1, h)))
    for i, ((cx, cy), s) in enumerate(present.APTS):
        out.append(_box_three(f'APT{i}', (cx - 16.5, cy - 6.5, 0.0), (cx + 16.5, cy + 6.5, present.APT_H * s)))
    out.append(_box_three('VIA_deck', (present.VIA_PIERS[0], present.VIA_Y0, present.DECK_B),
                          (present.VIA_PIERS[-1], present.VIA_Y1, present.DECK_T)))
    out.append(_box_three('HAUS', (-25.15, -25.9, 0.0), (25.15, 25.9, 81.0)))
    fa = bpy.data.objects.get('BLD_facearch')
    fx, fy = (fa.location.x, fa.location.y) if fa else (105.0, 15.0)
    rz = fa.rotation_euler.z if fa else math.radians(27.0)
    c, s = math.cos(rz), math.sin(rz)
    corners = [(fx + u * c - v * s, fy + u * s + v * c) for u in (-11.0, 11.0) for v in (-9.0, 9.0)]   # 22 × 18 필로티 대지
    out.append(_box_three('FACEARCH', (min(p[0] for p in corners), min(p[1] for p in corners), 0.0),
                          (max(p[0] for p in corners), max(p[1] for p in corners), 31.0)))
    for o in bpy.data.objects:
        if o.type == 'MESH' and o.get('nw_solid'):
            ws = [o.matrix_world @ Vector(cn) for cn in o.bound_box]
            out.append(_box_three(o.name, tuple(min(v[i] for v in ws) for i in range(3)),
                                  tuple(max(v[i] for v in ws) for i in range(3))))
    return out


def export_layout(sc):
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
    for cid, label, _, webp_name in CAM_ORDER:
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
            'mood': cam.get('nw_mood', 'overcast'),
            'render': f'assets/nowhere/renders/{webp_name}',
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
            meta = ANCHOR_META.get(aid, {})
            anchors.append({
                'id': aid,
                'layer': layer,
                'pos': to_three(e.location),
                'title': title,
                'facts': meta.get('facts', [['분류', layer]]),
                'lore': meta.get('lore', f'2041년 성수 블록의 {title} 지점.'),
                'source': meta.get('source', 'docs/nowhere/research/seongsu.md'),
                'render': meta.get('render', 'assets/nowhere/renders/hero-street.webp'),
            })

    movers = json.loads(sc.get('nw_movers', '[]'))
    for m in movers:
        if 'path' in m:
            m['path'] = [to_three(p) for p in m['path']]
        if 'origin' in m:
            m['origin'] = to_three(m['origin'])
        if m.get('beam') is None:
            m.pop('beam', None)

    x0, y0, x1, y1 = lib.MASK_RECT
    layout = {
        'buildings': buildings,
        'cameras': cameras,
        'anchors': anchors,
        'movers': movers,
        'solids': solid_boxes(),
        'maskRect': [x0, y0, x1, y1],
    }
    out_path = os.path.join(PUB_DIR, 'layout.json')
    os.makedirs(PUB_DIR, exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(layout, f, ensure_ascii=False, indent=2)
    print(f'wrote {out_path}: {len(cameras)} cameras, {len(anchors)} anchors, {len(movers)} movers, {len(layout["solids"])} solids')
    return layout


# ───────────────────────────── glTF 내보내기용 재질·텍스처 준비
def _srgb_to_lin(arr):
    return np.where(arr <= 0.04045, arr / 12.92, ((arr + 0.055) / 1.055) ** 2.4)


def _lin_to_srgb(arr):
    arr = np.clip(arr, 0.0, 1.0)
    return np.where(arr <= 0.0031308, arr * 12.92, 1.055 * (arr ** (1.0 / 2.4)) - 0.055)


def _grade_diff_image(mat_name, tid, res, sat=1.0, tint=None, gain=1.0, paint_hex=None, brick=None):
    """Poly Haven 알베도 이미지에 Blender 재질의 grade(sat, tint, gain) 및 도장(paint_hex)을 적용한
    1024 px PNG 를 만들어 이미지 데이터블록으로 돌려준다.
    brick(성수 2041 Task 8b, present.brick_prep): 벽돌색 흔들림을 평균 벽돌색 쪽으로 줄이고 줄눈 마스크 위를 밝은 회백으로."""
    os.makedirs(GEN_EXP_DIR, exist_ok=True)
    out_path = os.path.join(GEN_EXP_DIR, f'exp_{mat_name}_diff.png')
    f = lib.tex_files(tid, res)
    src_im = lib.img(f['diff'], False)
    w, h = src_im.size[0], src_im.size[1]
    buf = np.zeros(w * h * 4, dtype=np.float32)
    src_im.pixels.foreach_get(buf)
    rgba = buf.reshape((h, w, 4))
    # 2k → 1k 다운샘플(메모리·속도 최적화)
    if h >= 2048 and w >= 2048:
        rgba = 0.25 * (rgba[0::2, 0::2] + rgba[1::2, 0::2] + rgba[0::2, 1::2] + rgba[1::2, 1::2])
        h, w = rgba.shape[:2]

    lin = _srgb_to_lin(rgba[..., :3])
    raw_lum = lin @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    if sat != 1.0:
        lum = (0.2126 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.0722 * lin[..., 2])[..., None]
        lin = lum + (lin - lum) * sat
    if tint is not None:
        lin = lin * np.array(tint[:3], dtype=np.float32)[None, None, :]
    if gain != 1.0:
        lin = lin * float(gain)
    if brick:
        lin = lin + (np.array(brick['flat'], dtype=np.float32)[None, None, :] - lin) * float(brick['amt'])
        mim = bpy.data.images.get(brick['mask']) or lib.img(brick['file'], True)
        mw, mh = mim.size[0], mim.size[1]
        mbuf = np.zeros(mw * mh * 4, dtype=np.float32)
        mim.pixels.foreach_get(mbuf)
        m = mbuf.reshape((mh, mw, 4))[..., 0]
        if (mh, mw) != (h, w):
            raise RuntimeError(f'{mat_name}: 줄눈 마스크 {mw}×{mh} 가 알베도 {w}×{h} 와 다르다')
        k = np.clip(np.sqrt(raw_lum / float(brick['mref'])), 0.8, 1.15)[..., None]
        mcol = np.array(srgb(brick['mortar'])[:3], dtype=np.float32)[None, None, :] * k
        lin = lin * (1.0 - m[..., None]) + mcol * m[..., None]
    if paint_hex is not None:
        # NW_brick_painted: 도장색 위에 벽돌 줄눈 명암과 약간의 박리 반영
        pc = np.array(srgb(paint_hex)[:3], dtype=np.float32)[None, None, :]
        lum = np.clip(lin[..., 1:2] * 3.8 + 0.75, 0.80, 1.06)
        painted = pc * lum
        lin = painted * 0.84 + lin * 0.16

    out_rgba = np.ones((h, w, 4), dtype=np.float32)
    out_rgba[..., :3] = _lin_to_srgb(lin)
    return lib.save_image(f'exp_{mat_name}_diff', out_rgba, out_path, noncolor=False)


def _gen_gravel_tex():
    """NW_gravel 절차적 흰 자갈을 256×256 타일 텍스처로 굽는다."""
    os.makedirs(GEN_EXP_DIR, exist_ok=True)
    out_path = os.path.join(GEN_EXP_DIR, 'exp_NW_gravel_diff.png')
    rng = np.random.default_rng(77)
    H = W = 256
    base = np.zeros((H, W, 3), dtype=np.float32)
    base[...] = [0.76, 0.75, 0.72]
    n = rng.uniform(-0.12, 0.12, (H // 2, W // 2, 1)).astype(np.float32)
    n = np.repeat(np.repeat(n, 2, 0), 2, 1)
    rgba = np.ones((H, W, 4), dtype=np.float32)
    rgba[..., :3] = np.clip(base + n, 0.0, 1.0)
    return lib.save_image('exp_NW_gravel_diff', rgba, out_path, noncolor=False)


# 평면색 재질(mat_flat 등)의 대표 색상·거칠기·금속성 표
FLAT_MAT_SPECS = {
    'NW_iron':           ('#36322E', 0.65, 0.45, 1.0),
    'NW_paint_white':    ('#D6D4CE', 0.52, 0.0,  1.0),
    'NW_paint_yellow':   ('#C49E38', 0.55, 0.0,  1.0),
    'NW_asphalt_dark':   ('#2E3132', 0.78, 0.0,  1.0),
    'NW_cable':          ('#151617', 0.45, 0.0,  1.0),
    'NW_gas_yellow':     ('#D2A62C', 0.50, 0.30, 1.0),
    'NW_hedge':          ('#3D5434', 0.85, 0.0,  1.0),
    'NW_interior_dark':  ('#24282A', 0.70, 0.0,  1.0),
    'NW_net':            ('#2A3029', 0.60, 0.0,  0.32),
    'NW_paint_line':     ('#DCDCD6', 0.60, 0.0,  1.0),
    'NW_paint_offwhite': ('#DADBD5', 0.55, 0.10, 1.0),
    'NW_paint_red':      ('#A3352C', 0.50, 0.20, 1.0),
    'NW_station_green':  ('#3F7A55', 0.45, 0.30, 1.0),
    'NW_steel_black':    ('#232425', 0.55, 0.55, 1.0),
    'NW_steel_galv':     ('#8E9291', 0.42, 0.80, 1.0),
    'NW_field_turf':     ('#3C5A3A', 0.85, 0.0,  1.0),   # 학교 운동장 인조잔디(공원 잔디 NW_turf 는 aerial_grass_rock 텍스처 경로)
    'NW_roof_planter':   ('#5E5A52', 0.80, 0.0,  1.0),   # 성수 2041 옥상 화단 옆면(Task 6)
    'NW_stone_trim':     ('#D8D2C6', 0.75, 0.0,  1.0),   # 성수 2041 벽돌 동 창턱 · 인방(Task 8b, present.STONE_HEX)
    'NWF_alu_dark':      ('#2A2D31', 0.38, 0.85, 1.0),
    'NWF_black':         ('#121416', 0.60, 0.0,  1.0),
    'NWF_pearl':         ('#C9CDD0', 0.32, 0.15, 1.0),
    'NWF_steel_scaffold':('#6B6E70', 0.55, 0.90, 1.0),
    'NWF_glass':         ('#1E2A30', 0.08, 0.0,  0.28),
    'NWF_glass_dark':    ('#0C1013', 0.07, 0.0,  1.0),
    'NWB_water':         ('#1B2427', 0.06, 0.0,  1.0),
}


def _wire_gltf_pbr(m, diff_im, arm_im=None, nor_im=None, tile_m=None, rot=0.0, offset=(0.0, 0.0),
                   normal_scale=1.0, rough_val=0.7, metal_val=0.0, emit_im=None, emit_col=None, emit_str=0.0,
                   alpha_im=False, alpha_val=1.0, interp='Linear', alpha_clip=None):
    """alpha_clip(예: 0.5)이 있으면 텍스처 알파와 BSDF 알파 사이에 Math(ROUND / GREATER_THAN)를 끼워 glTF MASK 로 나가게 한다
    (없으면 알파를 그대로 이어 BLEND)."""
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(bsdf.outputs[0], out.inputs['Surface'])
    bsdf.inputs['Roughness'].default_value = rough_val
    bsdf.inputs['Metallic'].default_value = metal_val
    bsdf.inputs['Alpha'].default_value = alpha_val

    vec_sock = None
    if tile_m is not None or diff_im is not None or arm_im is not None or nor_im is not None or emit_im is not None:
        uv = nt.nodes.new('ShaderNodeUVMap')
        uv.uv_map = 'UVMap'
        vec_sock = uv.outputs['UV']
        if tile_m is not None and tile_m > 0:
            mp = nt.nodes.new('ShaderNodeMapping')
            mp.inputs['Scale'].default_value = (1.0 / tile_m, 1.0 / tile_m, 1.0)
            mp.inputs['Rotation'].default_value = (0.0, 0.0, rot)
            mp.inputs['Location'].default_value = (offset[0], offset[1], 0.0)
            nt.links.new(vec_sock, mp.inputs['Vector'])
            vec_sock = mp.outputs['Vector']

    if diff_im is not None:
        td = nt.nodes.new('ShaderNodeTexImage')
        td.image = diff_im
        td.interpolation = interp
        nt.links.new(vec_sock, td.inputs['Vector'])
        nt.links.new(td.outputs['Color'], bsdf.inputs['Base Color'])
        if alpha_im:
            a_sock = td.outputs['Alpha']
            if alpha_clip is not None:
                mth = nt.nodes.new('ShaderNodeMath')
                if abs(alpha_clip - 0.5) < 1e-6:
                    mth.operation = 'ROUND'                 # glTF 내보내기: Round → MASK, cutoff 0.5
                else:
                    mth.operation = 'GREATER_THAN'; mth.inputs[1].default_value = alpha_clip
                nt.links.new(a_sock, mth.inputs[0])
                a_sock = mth.outputs[0]
            nt.links.new(a_sock, bsdf.inputs['Alpha'])

    if arm_im is not None:
        ta = nt.nodes.new('ShaderNodeTexImage')
        ta.image = arm_im
        nt.links.new(vec_sock, ta.inputs['Vector'])
        sep = nt.nodes.new('ShaderNodeSeparateColor')
        nt.links.new(ta.outputs['Color'], sep.inputs['Color'])
        nt.links.new(sep.outputs['Green'], bsdf.inputs['Roughness'])
        nt.links.new(sep.outputs['Blue'], bsdf.inputs['Metallic'])

    if nor_im is not None:
        tn = nt.nodes.new('ShaderNodeTexImage')
        tn.image = nor_im
        nt.links.new(vec_sock, tn.inputs['Vector'])
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nm.inputs['Strength'].default_value = normal_scale
        nt.links.new(tn.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])

    if emit_im is not None:
        te = nt.nodes.new('ShaderNodeTexImage')
        te.image = emit_im
        te.interpolation = interp
        nt.links.new(vec_sock, te.inputs['Vector'])
        nt.links.new(te.outputs['Color'], bsdf.inputs['Emission Color'])
        bsdf.inputs['Emission Strength'].default_value = max(1.0, float(emit_str))
    elif emit_col is not None:
        bsdf.inputs['Emission Color'].default_value = srgb(emit_col)
        bsdf.inputs['Emission Strength'].default_value = max(1.0, float(emit_str))
        if diff_im is None:
            bsdf.inputs['Base Color'].default_value = srgb(emit_col)


def prepare_materials_for_export():
    """모든 컬렉션의 재질을 glTF 2.0 표준 PBR 노드 트리로 변환한다."""
    paint_map = {'NW_brick_painted': '#D6D3CB'}
    converted = 0
    for m in list(bpy.data.materials):
        if not m.use_nodes or m.node_tree is None:
            continue
        name = m.name
        tex_json = m.get('nw_tex')
        emit_json = m.get('nw_emit')
        meta = json.loads(tex_json) if tex_json else {}
        emeta = json.loads(emit_json) if emit_json else None

        # 1) 평면색 지정 재질(노면 페인트·금속·유리·수면 등)
        if name in FLAT_MAT_SPECS:
            hexcol, rough, metal, alpha = FLAT_MAT_SPECS[name]
            nor_im = None
            tile_m = None
            if name in ('NW_paint_white', 'NW_paint_yellow'):
                f = lib.tex_files('clean_asphalt', '2k')
                nor_im = lib.img(f['nor_gl'], True)
                tile_m = 3.5
            _wire_gltf_pbr(m, None, None, nor_im, tile_m=tile_m, normal_scale=0.7,
                           rough_val=rough, metal_val=metal, alpha_val=alpha)
            bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
            bsdf.inputs['Base Color'].default_value = srgb(hexcol)
            if alpha < 1.0:
                m.surface_render_method = 'BLENDED'
            converted += 1
            continue

        # 2) 흰 자갈(절차적 → 타일 텍스처)
        if name == 'NW_gravel':
            gim = _gen_gravel_tex()
            _wire_gltf_pbr(m, gim, tile_m=0.8, rough_val=0.72, metal_val=0.0)
            converted += 1
            continue

        # 3) Poly Haven 가져온 소품 재질(kind == 'gltf'): _grime_material 이 끼운 곱셈 노드를 제거하고 원본 연결 복원
        if meta.get('kind') == 'gltf':
            nt = m.node_tree
            bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
            if bsdf is not None:
                for key, sock_name in (('base', 'Base Color'), ('rough', 'Roughness')):
                    info = meta.get(key)
                    if not info:
                        continue
                    im_node = next((n for n in nt.nodes if n.type == 'TEX_IMAGE' and n.image and n.image.name == info.get('image')), None)
                    if im_node is None:
                        continue
                    for l in list(bsdf.inputs[sock_name].links):
                        nt.links.remove(l)
                    if info.get('channel') and key == 'rough':
                        sep = next((n for n in nt.nodes if n.type == 'SEPARATE_COLOR'), None)
                        if sep is not None and info['channel'] in sep.outputs:
                            nt.links.new(sep.outputs[info['channel']], bsdf.inputs[sock_name])
                            continue
                    nt.links.new(im_node.outputs.get(info.get('output', 'Color'), im_node.outputs['Color']), bsdf.inputs[sock_name])
            converted += 1
            continue

        # 4) Poly Haven 타일링 텍스처 재질(meta.tex[0].tid)
        tex_list = meta.get('tex', [])
        if tex_list and 'tid' in tex_list[0]:
            t0 = tex_list[0]
            tid = t0['tid']
            res = t0.get('res', '2k')
            tile_m = t0.get('tile_m', 2.5)
            rot = t0.get('rot', 0.0)
            offset = t0.get('offset', [0.0, 0.0])
            normal_scale = t0.get('normal', 1.0)
            grades = meta.get('grade', [])
            g0 = next((g for g in grades if g.get('tex', 0) == 0), grades[0] if grades else {})
            sat = g0.get('sat', 1.0)
            tint = g0.get('tint', None)
            gain = g0.get('gain', 1.0)
            diff_im = _grade_diff_image(name, tid, res, sat=sat, tint=tint, gain=gain, paint_hex=paint_map.get(name), brick=g0.get('brick'))
            files = lib.tex_files(tid, res)
            arm_im = lib.img(files['arm'], True) if 'arm' in files else None
            nor_im = lib.img(files['nor_gl'], True) if 'nor_gl' in files else None
            _wire_gltf_pbr(m, diff_im, arm_im, nor_im, tile_m=tile_m, rot=rot, offset=offset, normal_scale=normal_scale)
            converted += 1
            continue

        # 5) 그려 만든 이미지 재질(NW_gen_*, NWF_*, NWB_*)
        if tex_list and 'image' in tex_list[0]:
            t0 = tex_list[0]
            im = bpy.data.images.get(t0['image'])
            interp = t0.get('interp', 'Linear')
            is_foliage = m.get('nw_surface') == 'foliage'
            is_glass = m.get('nw_surface') == 'glass'
            emit_im = im if (emeta and emeta.get('tex') == 'Base Color') else None
            # nw_alpha_clip(present.mat_image 가 단다): > 0 → MASK(알파 시험, 정렬 없음), 0 → 불투명. 없으면 옛 규칙(잎 = 알파 BLEND)
            clip = m.get('nw_alpha_clip')
            use_alpha = is_foliage if clip is None else clip > 0
            # nw_pbr(거칠기, 금속)이 있으면 그 값(present.py 태양광 NW_pv), 없으면 옛 기본값
            pbr = m.get('nw_pbr')
            _wire_gltf_pbr(m, im, rough_val=float(pbr[0]) if pbr else (0.18 if is_glass else 0.55),
                            metal_val=float(pbr[1]) if pbr else (0.1 if not (is_foliage or is_glass) else 0.0),
                           emit_im=emit_im, emit_str=1.0 if emit_im else 0.0,
                           alpha_im=use_alpha, interp=interp, alpha_clip=float(clip) if (clip is not None and clip > 0) else None)
            if is_foliage:
                m.surface_render_method = 'DITHERED'
            converted += 1
            continue

        # 6) backdrop / future 의 atlas · gen · palette · 발광 재질
        if meta.get('kind') in ('atlas', 'gen', 'palette') or emeta is not None:
            alb_name = meta.get('albedo')
            emi_name = meta.get('emissive') or (emeta.get('tex') if emeta else None)
            alb_im = bpy.data.images.get(alb_name) if alb_name else None
            emi_im = bpy.data.images.get(emi_name) if (emi_name and emi_name != 'Base Color') else None
            emit_col = emeta.get('color') if emeta else None
            is_holo = m.get('nw_surface') == 'holo' or (emeta and emeta.get('additive'))
            alpha_val = 0.35 if is_holo else 1.0
            pbr = m.get('nw_pbr')            # (거칠기, 금속) — future.py 커튼월 NWF_curtain(CP1). 없으면 옛 기본값
            _wire_gltf_pbr(m, alb_im, rough_val=float(pbr[0]) if pbr else (0.35 if emeta else 0.85),
                           metal_val=float(pbr[1]) if pbr else 0.0,
                           emit_im=emi_im, emit_col=emit_col, emit_str=1.0 if (emi_im or emit_col) else 0.0,
                           alpha_val=alpha_val, interp='Closest' if meta.get('kind') == 'palette' else 'Linear')
            if is_holo or meta.get('alpha'):
                m.surface_render_method = 'BLENDED'
            converted += 1

    print('prepare_materials_for_export: converted', converted, 'materials')
    return converted


def prepare_meshes_for_export():
    """1) 모든 메시와 재질에 nw_surface 태그를 복제해 gltf-transform 후에도 유지되게 한다.
    2) NW_ground 에서 nw_drive 를 제거하고, nw_mask 전용 소품에서는 UVMap_mask 를 제거한다.
    3) nw_streak · nw_tint 정점 속성을 제거해 불필요한 버퍼 용량을 줄인다.
    (이동체 FU_drone_d1 … d5 · FU_taxi.* · FU_bot.* 는 future.py 가 이미 각자 단일 사용자 메시로 만든다.)"""
    for cname in ('NW_ground', 'NW_present', 'NW_future', 'NW_backdrop'):
        c = bpy.data.collections.get(cname)
        if c is None:
            continue
        for o in c.all_objects:
            if o.type != 'MESH':
                continue
            me = o.data
            surf = o.get('nw_surface')
            if surf:
                me['nw_surface'] = surf
                for s in o.material_slots:
                    if s.material and not s.material.get('nw_surface'):
                        s.material['nw_surface'] = surf

            # nw_streak · nw_tint 제거 (bake.py 에서 이미 nw_mask 에 합성됨)
            for aname in ('nw_streak', 'nw_tint'):
                a = me.attributes.get(aname)
                if a is not None:
                    me.attributes.remove(a)

            if cname == 'NW_ground':
                drv = me.color_attributes.get('nw_drive')
                if drv is not None:
                    me.color_attributes.remove(drv)
                # nw_mask 가 있는 소품(잡석·맨홀·기초 등)은 정점색(COLOR_0)을 쓰고 UVMap_mask 는 지운다
                if me.color_attributes.get('nw_mask') is not None:
                    lib._make_render_color(me, 'nw_mask')
                    uvm = me.uv_layers.get('UVMap_mask')
                    if uvm is not None:
                        me.uv_layers.remove(uvm)
            else:
                if me.color_attributes.get('nw_mask') is not None:
                    lib._make_render_color(me, 'nw_mask')


def export_collection_glbs():
    """bpy.context.scene 에 대상 컬렉션만 하나씩 연결해 build/nowhere/raw/nowhere-<layer>.glb 로 내보낸다."""
    os.makedirs(RAW_DIR, exist_ok=True)
    ctx_sc = bpy.context.scene
    # 기존 링크 백업
    orig_objs = list(ctx_sc.collection.objects)
    orig_ch = list(ctx_sc.collection.children)
    # 이동체 표(장면 속성 nw_movers, 약 180 KB JSON)는 layout.movers 로 이미 나갔다 — export_extras 가 GLB 마다 장면 extras 로 싣지 않게 잠시 뺀다
    movers_prop = ctx_sc.pop('nw_movers', None)

    out_files = {}
    try:
        for o in list(ctx_sc.collection.objects):
            ctx_sc.collection.objects.unlink(o)
        for ch in list(ctx_sc.collection.children):
            ctx_sc.collection.children.unlink(ch)

        for layer in ('ground', 'present', 'future', 'backdrop'):
            cname = f'NW_{layer}'
            target_coll = bpy.data.collections.get(cname)
            if target_coll is None:
                raise RuntimeError(f'컬렉션이 없다: {cname}')
            target_coll.hide_viewport = False
            target_coll.hide_render = False
            # 빈 객체는 GLB 에서 숨긴다(이동체 경로는 layout.movers 로 나간다)
            hidden_empties = []
            for o in target_coll.all_objects:
                if o.type == 'EMPTY':
                    hidden_empties.append((o, o.hide_viewport))
                    o.hide_viewport = True

            ctx_sc.collection.children.link(target_coll)
            out_path = os.path.join(RAW_DIR, f'nowhere-{layer}.glb')
            bpy.ops.export_scene.gltf(
                filepath=out_path,
                export_format='GLB',
                use_visible=True,
                export_yup=True,
                export_apply=False,
                export_texcoords=True,
                export_normals=True,
                export_vertex_color='NAME',
                export_vertex_color_name='nw_mask',
                export_all_vertex_colors=False,
                export_active_vertex_color_when_no_material=False,
                export_attributes=False,
                export_extras=True,
                export_cameras=False,
                export_lights=False,
            )
            ctx_sc.collection.children.unlink(target_coll)
            for o, hv in hidden_empties:
                o.hide_viewport = hv
            sz = os.path.getsize(out_path)
            out_files[layer] = (out_path, sz)
            print(f'exported {out_path}: {sz / (1024 * 1024):.2f} MB')
    finally:
        for o in list(ctx_sc.collection.objects):
            ctx_sc.collection.objects.unlink(o)
        for ch in list(ctx_sc.collection.children):
            ctx_sc.collection.children.unlink(ch)
        for o in orig_objs:
            ctx_sc.collection.objects.link(o)
        for ch in orig_ch:
            ctx_sc.collection.children.link(ch)
        if movers_prop is not None:
            ctx_sc['nw_movers'] = movers_prop

    return out_files


def export_all():
    t0 = time.time()
    sc = lib.get_scene(True)
    export_renders_and_hdri(sc)
    export_layout(sc)
    prepare_materials_for_export()
    prepare_meshes_for_export()
    glbs = export_collection_glbs()
    print('export_all finished in', round(time.time() - t0, 1), 's')
    return glbs


if __name__ == '__main__':
    export_all()
