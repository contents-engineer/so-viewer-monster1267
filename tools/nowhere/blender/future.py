# HAUS NOWHERE — 성수 2041 / Task 4: 미래 층(근미래 모티프 6가지 + 보조 장치).
# 실행: MCP 에서 exec(open('<ROOT>/tools/nowhere/blender/future.py').read(), {'__name__': '__main__'})
#       헤드리스: blender -b --factory-startup --python-expr "exec(open('.../future.py').read(), {'__name__': '__main__'})"
#       (NW_present 가 없으면 present.build() 를 먼저 부른다 → 빈 파일에서도 같은 결과)
# 매 실행마다 NW_future · NW_fx_night 를 비우고 처음부터 다시 만든다(멱등). 이 스크립트의 재질은 NWF_ 접두어,
# 객체는 FU_ 접두어, 그린 이미지는 NWF_gen_* 라서 NW_ground·NW_present 의 이름과 겹치지 않는다(_guard 가 확인).
#
# 세계 규칙(DBH, §2.1): 철거가 아니라 덧댐. 옛 기둥·벽돌·간판은 그대로 두고 새 장치를 겹쳐 단다. 모두 독자 디자인이고
# 상표·실존 기업 문구·게임 고유 형태(삼각 드론, 하트형 신호, 안드로이드 표식)는 없다. 글자는 우리가 지은 문구뿐이다.
#
# 만드는 것
#   NW_future (→ nowhere-future.glb)
#     (1) FU_viaduct_led        2호선 고가 상판 양쪽 하부 모서리의 파란 LED 선 #3E8AD0(SLOT_viaduct_led 자리, 원경 고가까지 이어짐)
#     (2) FU_screen_*           벽돌 창고 B5 지붕 위 비계 프레임 + LED 스크린(그린 추상 화면, 글자 없음)
#     (3) FU_crossing_*         뚝섬로 횡단보도(x −14) 가장자리 발광선 + 바닥형 보행신호 + 연석 LED #43ABA7
#     (4) FU_busstop_*          북측 보도 스마트 정류장(유리 쉘터, 도착 안내) + 독립 키오스크
#     (5) FU_taxi.*             창이 상태 스크린인 둥근 자율 택시 3대(링크 복제)
#     (6) FU_drone_*            보안 드론 FU_drone_sec(서치라이트 원뿔 = holo) + 배송 드론 FU_drone_d1 … d5(소포를 매단 단일 사용자 메시)
#     이동체(Task 11): 포드 · 열차 · 배송로봇 · 드론은 한 재질 NWF_mover(paint_mover 아틀라스). 경로 표는 mover_table() → 장면 속성
#                      nw_movers(JSON) → export.py 가 layout.movers 로 낸다(웹 movers.js 가 움직인다)
#     보조: FU_smart_head.*(옛 가로등 기둥에 덧단 LED 헤드·센서 포드 3), FU_ev_post.*(EV 충전 기둥 2, LED 링),
#           FU_shop_display(카페 진열창의 투명 디스플레이), FU_holo_ad(홀로그램 광고 한 곳, holo)
#     (7) FU_tower_T1 … T4      성수 2041 신축 유리 타워 4동(TOWERS, 장면 밖 원경 대지). 커튼월 NWF_curtain(밤 창 35 %) + 셋백 테라스 ·
#                               발코니 식재 띠 · 계단 정원 · 크라운 정원(유리 난간 NWF_glass_rail, 화단 NW_meadow, 관목 카드), T1 옥상
#                               태양광 줄, T3 태양광 캐노피. nw_solid=1(layout.solids)
#         FU_turbine_mast.<n> · FU_turbine_rotor.<n>   풍력 5기(T1 옥상 3 · T4 크라운 2, 방위 200°). 회전자 원점 = 허브, 축 = 로컬 +x
#         FU_plaza · FU_plaza_tree.<n>                 타워 둘레 광장(Task 7 이 비운 필지): 보도블록 · 잔디 화단 · 느티나무
#   NW_anchors   ANCHOR_<id>(nw_layer=future, nw_title) 6개 추가
#   NW_layout    CAM_night(밤 히어로 컷) · CAM_future(2041 골목, 맑음)
#   NW_fx_night  밤 무드 전용 조명(가로등 웅덩이, LED 반사광, HAUS 외벽 조명) — 내보내지 않는다. lib.apply_mood 가 켜고 끈다
#
# 규약(§5, lib.py 머리말)
#   - 모든 메시: 정점색 nw_mask(R 이끼 0, G 젖음, B AO, A 1) 활성·렌더 색, 객체 nw_surface·nw_vmask=1.
#   - 발광 재질: 세기 = day + night·nw_night(장면 속성, lib.emit_strength), 재질 nw_emit(JSON) 기록, 객체 nw_night=1.
#   - holo: 웹 전용 셰이더(스캔선·깜빡임)로 바뀐다. Blender 에서는 가산(투명 + 발광)으로 보이게만 한다.
#   - 반복 소품(스마트 헤드·EV 기둥 등)은 링크 복제 → GPU 인스턴싱. 이동체(포드·열차·배송로봇·드론·풍력 회전자)는 각자 단일 사용자 메시
#     (같은 모양 사본은 정점 AO 를 조금씩 달리 써서 gltf-transform dedup · instance 가 노드 이름을 지우지 않게 한다).
import bpy, bmesh, os, sys, math, random, importlib, json
from mathutils import Vector, Matrix, Euler

ROOT = os.environ.get('NW_ROOT', '/Users/gm_yeonho/new-work/so/so-viewer-monster1267')
sys.dont_write_bytecode = True          # tools/ 아래에 __pycache__ 를 만들지 않는다
_HERE = os.path.join(ROOT, 'tools', 'nowhere', 'blender')
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)
import lib
importlib.reload(lib)
from lib import srgb, smoothstep, clamp01

import numpy as np

GEN = os.path.join(lib.OUT, 'gen')
TAG = 'nw_future_src'                    # 이 스크립트가 만든 이미지 표식(다음 실행에서 고아면 지운다)
FONT_FILE = os.path.join(lib.SRC, 'fonts', 'NotoSansKR-Bold.otf')

# ═════════════════════════════ 배치 상수 (§3, Blender 좌표 m) ═════════════════════════════
VIA_RIM_Y0, VIA_RIM_Y1 = 149.3, 160.7    # 상판 하부 모서리(남·북, 테두리 포함), present.py SLOT_viaduct_led 와 같다. present.VIA_Y0/Y1(150 · 160)은
                                         # 고가 몸체 면 — 여기 값 = 그 바깥 0.7 m 상판 테두리 끝 = 승강장 선로 쪽 끝(이름이 겹치지 않게 RIM)
DECK_B = 7.9                             # 상판 하면
ST_X = (22.8, 91.2)                      # 성수역형 승강장 구간(양쪽 3.6 m 내밂, 하면 7.45)
ST_D, ST_B = 3.6, 7.45
LED_W, LED_H = 0.09, 0.05                # LED 선 단면(폭·높이)
VIA_EXT = (-760.0, 780.0)                # 원경 고가(backdrop.py)와 같은 끝 — 파란 선이 안개 속까지 이어진다
XW, CW = -14.0, 2.5                      # 뚝섬로 횡단보도 중심 x, 반폭(ground.py)
TT = (-48.5, -35.5)                      # 뚝섬로 남·북 경계석 선
SCREEN = dict(x0=-15.0, x1=-1.0, y=126.6, z0=15.2, w=12.0, h=6.75)   # B5 지붕 위(용마루 13.54 m, 북쪽 처마 y 130)
SHELTER = dict(x=-46.0, y0=-33.35, y1=-34.85)                          # 북측 보도(경계석 y −35.5)
KIOSK = (-41.6, -34.55)
SMART_POLES = ('PR_light.001', 'PR_light.010', 'PR_light.017')       # 뚝섬로 북측 x −65, 남측 x −45, 골목 y 125
EV_POSTS = [(31.0, 150.55), (35.6, 150.55)]                            # 고가 아래 아치 주차(승강장 구간) 남쪽 끝
DISPLAY = dict(x=40.5, y=127.66, w=4.6, z0=0.55, h=2.3)                # B6 카페 북면 진열창(유리 y 127.7)
HOLO = (66.0, 131.6)                                                    # B6 동쪽 모서리 앞 보도(골목 입구) — 홀로그램 광고 한 곳

# 드론 경로(고리). 첫 점 = 지금 놓인 자리(정지 위치). 웹이 이 순서로 잇고 마지막 → 처음으로 돈다.
DRONE_PATHS = {
    'sec': [(5.0, 122.0, 19.0), (-30.0, 140.0, 18.0), (-70.0, 120.0, 22.0), (-50.0, 75.0, 24.0), (0.0, 62.0, 25.0),
            (50.0, 70.0, 24.0), (66.0, 110.0, 21.0), (40.0, 138.0, 18.0)],
    'd1': [(52.0, 8.0, 34.0), (90.0, -10.0, 40.0), (140.0, 30.0, 44.0), (110.0, 75.0, 40.0), (60.0, 60.0, 36.0)],
    'd2': [(-60.0, -42.0, 30.0), (20.0, -42.0, 32.0), (100.0, -42.0, 36.0), (100.0, -90.0, 46.0), (-60.0, -95.0, 46.0)],   # Task 11: 셋째 점 z 30 → 36(남쪽으로 꺾을 때 MX 지붕 36.2 m 에서 3 m)
    'd3': [(30.0, 110.0, 28.0), (-10.0, 112.0, 30.0), (-40.0, 85.0, 32.0), (10.0, 80.0, 30.0)],
    # Task 11(§4.4): d4 = 뚝섬로 위 낮은 왕복 고리(거리 시점), d5 = 동쪽 골목 위(2041 골목 시점)
    'd4': [(-80.0, -42.0, 18.0), (0.0, -40.0, 20.0), (80.0, -44.0, 18.0), (150.0, -42.0, 22.0), (80.0, -38.0, 24.0), (0.0, -46.0, 22.0),
           (-80.0, -40.0, 20.0)],
    'd5': [(70.0, -20.0, 16.0), (70.0, 60.0, 18.0), (70.0, 130.0, 17.0), (66.0, 170.0, 24.0), (40.0, 120.0, 22.0), (64.0, 40.0, 20.0)],
}
DRONE_SPEED = {'sec': 4.0, 'd1': 9.0, 'd2': 11.0, 'd3': 7.0, 'd4': 9.0, 'd5': 7.0}   # m/s(웹 애니메이션 기본값)
PARCEL = (0.5, 0.4, 0.35)                # 배송 드론 소포(x · y · z m, 골판지 #B98C5A)
PARCEL_DROP = 0.6                        # 몸체 아래면 → 소포 윗면(가는 줄 4 개)

CAM_NIGHT = ((56.0, 147.5, 1.5), (-4.0, 102.0, 14.8), 19.0)    # 고가 하부 가로에서 서남서: 오른쪽 위에서 이어지는 고가 파란 LED 선, 젖은 노면 반사, 카페·간판, 비계 스크린, 드론, HAUS
# ↑ 최종 수정 C1: y 145.6 은 포드 고리 서행 차로(y 144.5)에서 1.1 m 라 포드가 렌즈 옆을 스쳤다 → 북쪽 보도(VR 북쪽 끝 146.5 너머) y 147.5.
#   차로에서 3.0 m(차체 반폭 0.925 를 빼면 2.1 m). 반대 차로(y 140.5)는 고가 · 파란 LED 선이 화면 오른쪽 밖으로 빠져 구도가 무너졌다
CAM_FUTURE = ((71.6, 8.0, 1.7), (71.6, 150.0, 14.0), 22.0)   # 동쪽 골목에서 북쪽: 양쪽 벽돌, 스카이브리지, 고가 튜브, 뒤편 타워(레퍼런스 구도)
# ↑ 최종 수정 C1: 골목 가운데 x 70 은 포드 고리 북행 차로였다 → 포드는 골목 서쪽 차로 x 69.0(POD_LOOP), 카메라는 동쪽 x 71.6
#   (차로에서 2.6 m, 차체 반폭을 빼면 1.7 m). 보는 방향은 그대로 북쪽(대상도 같은 만큼 옮긴 평행 이동).
#   수정 2회차: 서쪽 x 68.2 에서는 공원 느티나무(64.25, 17.0) 수관이 T2 방위(−7° … −14°)를 덮어 T2 가 사라졌다 → 동쪽으로 맞바꿨다
BEAM_AIM = (12.0, 139.0, 0.0)                                   # 보안 드론 서치라이트가 비추는 고가 하부 가로

# 신축 타워(§4.2): 장면 사각형 밖, 원경 BD_mid 를 비운 대지(backdrop.py 가 이 표로 비운다)
TOWERS = [
    dict(id='T1', c=(92.0, 234.0), size=(32.0, 26.0), h=128.0, form='setback', setbacks=(40.0, 80.0), inset=2.0, turbines=3),
    # ↑ Task 8b: (−40, 205) 는 CAM_future 에서 왼쪽 공원 느티나무에 가렸다 → 골목 북쪽 연장 도로(x 67…73) 바로 동쪽, T3 뒤(북)에 세워
    #   골목 끝 고가 너머에서 T2(왼쪽) · T1(가운데 오른쪽) · T3(오른쪽 앞)이 겹쳐 선다. 서쪽 블록(x ≤ 67)에 두면 T2 를 앞에서 가린다
    dict(id='T2', c=(30.0, 228.0), size=(28.0, 28.0), h=104.0, form='rounded', r=6.0, green_every=3, turbines=0),
    dict(id='T3', c=(110.0, 196.0), size=(36.0, 22.0), h=84.0, form='stepped',
         steps=((0.0, 40.0, 1.0), (40.0, 64.0, 2.0 / 3.0), (64.0, 84.0, 1.0 / 3.0)), turbines=0),
    dict(id='T4', c=(205.0, 0.0), size=(30.0, 30.0), h=116.0, form='crown', crown=8.0, turbines=2),    # CP1 전: (205, 40) 은 거리 시점에서 HAUS 상부 뒤에 숨었다
]
TOWER_SITE_MARGIN = 12.0
# 2호선 유리 튜브: 단면(y = 고가 중심 155 기준, z 절대), 장면 층 일반 구간(서 · 동). 그 사이 승강장 구간 ST_X 는 넓은 단면
# TUBE_ST_PROFILE(Task 11b, CP2: 녹색 곡면 지붕을 걷고 유리 튜브로)이 덮는다
TUBE_Y = 155.0
TUBE_PROFILE = [(-4.7, 9.0), (-4.7, 11.6), (-3.3, 13.9), (-1.2, 15.0), (1.2, 15.0), (3.3, 13.9), (4.7, 11.6), (4.7, 9.0)]
TUBE_SPANS = [(-300.0, 22.8), (91.2, 420.0)]
# 승강장 구간 넓은 단면: 승강장은 상판 테두리 끝(VIA_RIM_Y0 = 149.3, 고가 중심 −5.7)에서 바깥으로 ST_D 3.6 → 승강장 바깥 끝 ±9.3
# (145.7 · 164.3, present.via_station), 바깥 난간 ±9.2, 바닥 present.ST_FLOOR_Z = 10.0. 유리는 승강장 끝에서 0.4 m 바깥 ±9.7
# (리브 안쪽 면 ±9.55 — 난간과 0.3 m). 아래 끝 = 유리 받침 띠 윗면(TUBE_ST_SILL). 일반 단면과 같은 8 점(세로벽 → 어깨 → 완만한 지붕 →
# 평평한 꼭대기 z 15.0). 어깨 (±6.7, 14.6) = 세로벽(높이 13.0)에서 3.0 m 안쪽: 승강장 선로 쪽 끝(±5.7)이 완만한 지붕 아래(바닥 + 4.7 m)에,
# 승강장 가운데(±7.5)는 바닥 + 4.2 m, 난간 위 3.3 m. 꼭대기 평평한 폭 ±2.4 는 등줄기 LED(z 14.95)를 일반 구간과 같은 높이로 잇는다
TUBE_ST_PROFILE = [(-9.7, 10.15), (-9.7, 13.0), (-6.7, 14.6), (-2.4, 15.0), (2.4, 15.0), (6.7, 14.6), (9.7, 13.0), (9.7, 10.15)]
TUBE_ST_SILL = (9.7, 10.15, 9.3, 9.9)    # 유리 받침 띠(강재): 아래 · 윗면 z, 안쪽(= 승강장 바깥 끝 ±9.3에 붙는다) · 바깥(리브 바깥 면 ±9.85 너머) |y − 155|
# 타워 공통(Task 8). 층 띠는 아틀라스 각 층 맨 위 0.3 m 라 z = 4k(테라스 · 옥상 · 크라운 바닥)가 슬래브 끝에 맞는다
CW_TILE = (12.0, 8.0)                  # 커튼월 아틀라스 한 장 = 둘레 12 m × 높이 8 m(1 칸 1.5 × 4.0 m, 가로 8칸 × 2층). 1024² 라
                                       # optimize(--texture-size 1024)를 지나도 85 × 128 px/m 를 지킨다(2048 변은 반으로 줄었다)
FLOOR_GF = 6.0                         # 1층(로비) 층고. 로비는 아틀라스 한 층의 시야 유리(0.42 … 3.66 m)를 늘여 붙인다
CURTAIN_PBR = (0.1, 0.5)               # 커튼월 NWF_curtain (거칠기, 금속성) — CP1: 0.35 · 0(창백한 회백색) → 하늘을 비추는 푸른 유리
RAIL_H = 1.1                           # 테라스 · 옥상 · 크라운 유리 난간(NWF_glass_rail, 알파 0.3)
BED_IN, BED_W, BED_H = 1.0, 1.2, 0.5   # 테라스 화단(윗면 NW_meadow): 가장자리에서 들임 · 폭 · 높이
TURBINE_AZ = 200.0                     # 모든 풍력 터빈이 보는 방위(+Y = 0°, 시계 방향)
MAST_R, MAST_H = 0.18, 8.0             # 마스트 원통 반지름 · 높이
NACELLE = (1.2, 0.6, 0.6)              # 나셀 길이 · 폭 · 높이
BLADE_L = 2.8                          # 날개 길이(허브 반지름 0.15 m 바깥)
HUB = (0.85, 0.3)                      # 마스트 원점 → 허브 중심(앞 +x, 마스트 꼭대기 위 높이)
# 타워 둘레 광장(Task 7 이 비운 필지 = backdrop.build_mid 의 void, CAM_aerial 로 정함): (x0, y0, x1, y1), 윗면 PLAZA_Z
PLAZAS = [(2.5, 176.0, 67.0, 250.0), (-1.96, 221.72, 2.5, 250.0),      # T2: 서쪽 블록 동쪽 필지 4(Task 8b: T1 이 떠나 x < 2.5 필지 5개는 다시 건물)
          (73.0, 176.0, 143.9, 250.0),                                # T3 · T1(Task 8b): 동쪽 블록 서쪽 필지 4
          (166.0, -31.5, 230.0, 66.0)]                                # T4 (205, 0): 블록 전체(필지 5개가 모두 대지 + 12 m 와 겹친다)
PLAZA_Z = 0.15                         # 보도블록 윗면(원경 지면 z 0 위 연석 높이 — 멀리서 깊이 다툼이 없다)


# ═════════════════════════════ 작은 도우미 ═════════════════════════════
def _guard(name):
    """우리 재질 이름이 다른 층(지면·현재) 재질과 겹치면 멈춘다 — lib.Mat 은 같은 이름 재질을 비우고 다시 만든다."""
    if not name.startswith('NWF_'):
        raise ValueError(f'future 재질 이름은 NWF_ 로 시작해야 한다: {name}')
    m = bpy.data.materials.get(name)
    if m is not None and not m.get(TAG):
        raise ValueError(f'이미 다른 스크립트가 쓰는 재질 이름: {name}')
    return name


def _new_mat(name):
    _guard(name)
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    m.node_tree.nodes.clear()
    m[TAG] = 1
    for k in ('nw_emit', 'nw_night', 'nw_tex'):
        if k in m.keys():
            del m[k]
    return m


def _hexs(h):
    """'#RRGGBB' → sRGB 0..1 튜플(그리기용)."""
    h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)], dtype=np.float32)


class GroundZ:
    """NW_ground 실제 메시 위 높이(present.py 와 같은 조회 순서)."""

    def __init__(self):
        self.s = []
        for nm in ('GR_vacant', 'GR_forecourt', 'GR_sidewalk', 'GR_blocklot', 'GR_road'):
            o = bpy.data.objects.get(nm)
            if o is None:
                continue
            V = [tuple(o.matrix_world @ v.co) for v in o.data.vertices]
            T = [tuple(p.vertices) for p in o.data.polygons]
            self.s.append((nm, lib.Sampler(V, T, 2.0)))

    def z(self, x, y, default=0.0, only=None):
        for nm, s in self.s:
            if only and nm != only:
                continue
            z = s.z(x, y)
            if z is not None:
                return z
        return default


# ═════════════════════════════ 메시 조립기 ═════════════════════════════
class MB:
    """면마다 재질 번호·루프 UV 를 갖는 단순 메시 조립기. 변환 행렬 T(로컬 → 이 메시 좌표)를 쌓아 쓴다."""

    def __init__(self):
        self.V = []; self.F = []; self.FM = []; self.UV = []
        self.T = Matrix.Identity(4)

    def v(self, p):
        self.V.append(tuple(self.T @ Vector(p))); return len(self.V) - 1

    def face(self, pts, mat, uv=None):
        idx = [self.v(p) for p in pts]
        if uv is None:
            uv = [(0.0, 0.0)] * len(idx)
        self.F.append(idx); self.FM.append(mat); self.UV.append(list(uv))

    def quad(self, a, b, c, d, mat, rect=(0, 0, 1, 1)):
        u0, v0, u1, v1 = rect
        self.face([a, b, c, d], mat, [(u0, v0), (u1, v0), (u1, v1), (u0, v1)])

    def box(self, c0, c1, mat, rect=(0, 0, 1, 1), faces='xXyYzZ', fmat=None):
        """축 정렬 상자(로컬). fmat = {면 문자: 재질} 로 면마다 재질을 바꿀 수 있다. rect = 모든 면의 UV 사각형."""
        x0, y0, z0 = c0; x1, y1, z1 = c1
        P = {
            'x': [(x0, y1, z0), (x0, y0, z0), (x0, y0, z1), (x0, y1, z1)],
            'X': [(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)],
            'y': [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)],
            'Y': [(x1, y1, z0), (x0, y1, z0), (x0, y1, z1), (x1, y1, z1)],
            'z': [(x0, y1, z0), (x1, y1, z0), (x1, y0, z0), (x0, y0, z0)],
            'Z': [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)],
        }
        for f in faces:
            m = (fmat or {}).get(f, mat)
            r = rect[f] if isinstance(rect, dict) else rect
            self.quad(*P[f], m, r)

    def cyl(self, a, b, r0, r1, n, mat, caps=(True, True), rect=(0, 0, 1, 1), phase=0.0):
        a = Vector(a); b = Vector(b); ax = (b - a)
        ax = ax.normalized() if ax.length > 1e-9 else Vector((0, 0, 1))
        t = ax.orthogonal().normalized(); s = ax.cross(t)
        ring = lambda c, r: [c + (t * math.cos(phase + 2 * math.pi * i / n) + s * math.sin(phase + 2 * math.pi * i / n)) * r for i in range(n)]
        A = ring(a, r0); B = ring(b, r1)
        u0, v0, u1, v1 = rect
        for i in range(n):
            j = (i + 1) % n
            self.face([A[i], A[j], B[j], B[i]], mat, [(u0 + (u1 - u0) * i / n, v0), (u0 + (u1 - u0) * (i + 1) / n, v0),
                                                     (u0 + (u1 - u0) * (i + 1) / n, v1), (u0 + (u1 - u0) * i / n, v1)])
        cu = (u0 + u1) / 2; cv = (v0 + v1) / 2
        if caps[0]:
            self.face(list(reversed(A)), mat, [(cu, cv)] * n)
        if caps[1]:
            self.face(B, mat, [(cu, cv)] * n)

    def tube(self, pts, r, n, mat, rect=(0, 0, 1, 1)):
        for i in range(len(pts) - 1):
            self.cyl(pts[i], pts[i + 1], r, r, n, mat, caps=(False, False), rect=rect)

    def to_mesh(self, name, mats, smooth=False, sharp=None, mask=None):
        me = bpy.data.meshes.get(name)
        if me is not None and me.users == 0:
            bpy.data.meshes.remove(me)
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.V, [], [tuple(f) for f in self.F])
        me.validate(clean_customdata=False)
        per = [uv for f in self.UV for uv in f]
        lib.set_uv(me, 'UVMap', None, per_loop=per)
        for m in mats:
            me.materials.append(m)
        me.polygons.foreach_set('material_index', self.FM)
        if smooth:
            me.shade_smooth()
            if sharp is not None:
                me.set_sharp_from_angle(angle=math.radians(sharp))
        else:
            me.shade_flat()
        mk = mask or (lambda co: (0.0, 0.25, 0.6 + 0.4 * smoothstep(0.0, 1.2, co[2])))
        lib.write_mask_values(me, [mk(v.co) for v in me.vertices])
        me[TAG] = 1
        return me


def obj(name, me, C, loc=(0, 0, 0), rz=0.0, surface='metal', night=False, mw=None, **props):
    o = bpy.data.objects.get(name)
    if o is not None:
        bpy.data.objects.remove(o, do_unlink=True)
    o = bpy.data.objects.new(name, me)
    C.objects.link(o)
    if mw is not None:
        o.matrix_world = mw
    else:
        o.location = loc; o.rotation_euler = (0, 0, rz)
    lib.tag(o, surface)
    o['nw_vmask'] = 1.0
    if night:
        o['nw_night'] = 1
    for k, v in props.items():
        o[k] = v
    return o


# ═════════════════════════════ 그린 텍스처(독자 디자인, 글자 없음) ═════════════════════════════
def _canvas(w, h, col):
    a = np.zeros((h, w, 4), np.float32); a[..., :3] = col; a[..., 3] = 1.0
    return a


def _rect(a, x0, y0, x1, y1, col, alpha=None):
    h, w = a.shape[:2]
    X0, X1 = int(max(0, x0)), int(min(w, x1)); Y0, Y1 = int(max(0, y0)), int(min(h, y1))
    if X1 > X0 and Y1 > Y0:
        a[Y0:Y1, X0:X1, :3] = col
        if alpha is not None:
            a[Y0:Y1, X0:X1, 3] = alpha


def _ring(a, cx, cy, r, wdt, col, k=1.0):
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.abs(np.hypot(xx - cx, yy - cy) - r)
    f = np.clip(1.0 - d / wdt, 0, 1)[..., None] * k
    a[..., :3] = a[..., :3] * (1 - f) + col * f


SEG = {'0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgedc', '7': 'abc',
       '8': 'abcdefg', '9': 'abfgcd', 'N': 'ecbaf', ' ': ''}


def _digits(a, x, y, s, text, col):
    """7 세그먼트 숫자(가상 노선 번호·도착 분). s = 글자 높이 px."""
    t = max(2, s // 8); w = s // 2
    for ch in text:
        segs = SEG.get(ch, '')
        R = {'a': (x, y + s - t, x + w, y + s), 'g': (x, y + s // 2 - t // 2, x + w, y + s // 2 + t // 2), 'd': (x, y, x + w, y + t),
             'f': (x, y + s // 2, x + t, y + s), 'b': (x + w - t, y + s // 2, x + w, y + s),
             'e': (x, y, x + t, y + s // 2), 'c': (x + w - t, y, x + w, y + s // 2)}
        for sg in segs:
            _rect(a, *R[sg], col)
        x += w + t * 2


def paint_ui():
    """UI 아틀라스 1024² (4×4 칸, 아래 행부터). 알베도와 발광 두 장. 칸 배치는 UI 사전 참조."""
    alb, emi = _ui_arrays()
    a = lib.save_image('NWF_gen_ui', alb, os.path.join(GEN, 'NWF_gen_ui.png'), TAG)
    e = lib.save_image('NWF_gen_ui_emit', emi, os.path.join(GEN, 'NWF_gen_ui_emit.png'), TAG)
    return a, e


def _ui_arrays():
    """paint_ui 의 알베도 · 발광 배열(h × w × 4, 아래 행부터). paint_mover 가 칸을 베껴 쓴다."""
    W = 1024; C = 256
    alb = _canvas(W, W, _hexs('#0B0E12')); emi = _canvas(W, W, np.zeros(3, np.float32))
    teal = _hexs('#43ABA7'); white = _hexs('#EEF3F5'); blue = _hexs('#3E8AD0'); amber = _hexs('#F2B84B'); red = _hexs('#E33739')
    navy = _hexs('#0F1D33')

    def both(x0, y0, x1, y1, col, e=None):
        _rect(alb, x0, y0, x1, y1, col); _rect(emi, x0, y0, x1, y1, col if e is None else e)

    # 행 0: 단색 발광(흰 LED, 미등 빨강, 청록, 호박)
    both(0, 0, C, C, white); both(C, 0, 2 * C, C, red); both(2 * C, 0, 3 * C, C, teal); both(3 * C, 0, 4 * C, C, amber)
    # 행 1: 골판지(비발광), 어두운 유리(비발광), EV 화면, 도착 안내(BIS)
    _rect(alb, 0, C, C, 2 * C, _hexs('#9C7B55')); _rect(alb, C, C, 2 * C, 2 * C, _hexs('#101418'))
    x0 = 2 * C; y0 = C                                         # EV 충전 화면: 충전 막대 5칸 + 진행 띠
    _rect(alb, x0, y0, x0 + C, y0 + C, navy)
    for k in range(5):
        col = teal if k < 3 else _hexs('#1C3A44')
        both(x0 + 40 + k * 36, y0 + 110, x0 + 68 + k * 36, y0 + 180, col)
    both(x0 + 40, y0 + 70, x0 + 216, y0 + 82, _hexs('#25505A')); both(x0 + 40, y0 + 70, x0 + 150, y0 + 82, teal)
    x0 = 3 * C                                                 # 버스 도착 안내: 가상 노선 번호와 남은 분(7 세그먼트)
    _rect(alb, x0, y0, x0 + C, y0 + C, _hexs('#050607'))
    for r, (route, mins) in enumerate((('2041', '3'), ('N62', '12'), ('734', '27'))):
        yy = y0 + 180 - r * 64
        _digits(alb, x0 + 18, yy, 34, route, amber); _digits(emi, x0 + 18, yy, 34, route, amber)
        _digits(alb, x0 + 190, yy, 34, mins, white); _digits(emi, x0 + 190, yy, 34, mins, white)
    # 행 2 왼쪽 두 칸: 택시 창 상태 화면(가로 2:1) — 빈 차 표시 고리, 진행 화살, 정보 막대
    x0, y0 = 0, 2 * C
    _rect(alb, x0, y0, x0 + 2 * C, y0 + C, _hexs('#06090C'))
    _ring(alb, x0 + 96, y0 + 128, 54, 7, teal); _ring(emi, x0 + 96, y0 + 128, 54, 7, teal)
    _ring(alb, x0 + 96, y0 + 128, 20, 9, teal); _ring(emi, x0 + 96, y0 + 128, 20, 9, teal)
    for k in range(3):                                         # > > > 진행 화살(사선 막대 두 개씩)
        cx = x0 + 190 + k * 34
        for t in range(18):
            both(cx + t, y0 + 128 + t, cx + t + 6, y0 + 132 + t, teal * (0.5 + 0.25 * k))
            both(cx + t, y0 + 124 - t, cx + t + 6, y0 + 128 - t, teal * (0.5 + 0.25 * k))
    for k, (ln, col) in enumerate(((210, white), (150, _hexs('#8FA6B0')), (180, _hexs('#8FA6B0')))):
        both(x0 + 310, y0 + 170 - k * 40, x0 + 310 + ln, y0 + 184 - k * 40, col)
    both(x0 + 30, y0 + 28, x0 + 2 * C - 30, y0 + 34, _hexs('#1E3C44')); both(x0 + 30, y0 + 28, x0 + 300, y0 + 34, teal)
    # 행 2~3 셋째 칸: 키오스크 세로 화면(1:2) — 노선 선·정류장 점·머리 띠·지도 격자
    x0, y0 = 2 * C, 2 * C
    _rect(alb, x0, y0, x0 + C, y0 + 2 * C, navy)
    both(x0, y0 + 2 * C - 52, x0 + C, y0 + 2 * C, _hexs('#1F4E79'))
    both(x0 + 24, y0 + 2 * C - 34, x0 + 150, y0 + 2 * C - 20, white)
    both(x0 + 58, y0 + 60, x0 + 66, y0 + 2 * C - 80, teal)
    for k in range(8):
        yy = y0 + 70 + k * 46
        _ring(alb, x0 + 62, yy, 9, 4, white); _ring(emi, x0 + 62, yy, 9, 4, white)
        both(x0 + 90, yy - 5, x0 + 90 + 60 + (k * 37) % 90, yy + 5, _hexs('#9FB3C8'))
    for gx in range(4):
        both(x0 + 170 + gx * 20, y0 + 60, x0 + 172 + gx * 20, y0 + 200, _hexs('#24405E'))
    for gy in range(8):
        both(x0 + 170, y0 + 60 + gy * 20, x0 + 232, y0 + 62 + gy * 20, _hexs('#24405E'))
    _ring(alb, x0 + 201, y0 + 130, 10, 5, amber); _ring(emi, x0 + 201, y0 + 130, 10, 5, amber)
    # 행 3 왼쪽 두 칸: 진열창 투명 디스플레이(어두운 곳 = 투명). 겹친 고리 형태 + 부드러운 빛 + 얇은 띠(추상, 상표 없음)
    x0, y0 = 0, 3 * C
    _rect(alb, x0, y0, x0 + 2 * C, y0 + C, _hexs('#000000'))
    sub = alb[y0:y0 + C, x0:x0 + 2 * C]; sube = emi[y0:y0 + C, x0:x0 + 2 * C]
    yy, xx = np.mgrid[0:C, 0:2 * C]
    glow = np.exp(-(((xx - 256) / 170.0) ** 2 + ((yy - 128) / 90.0) ** 2))[..., None]
    gcol = _hexs('#2A6F8A') * 0.8
    sub[..., :3] += glow * gcol; sube[..., :3] += glow * gcol
    for cx in (200, 312):
        _ring(sub, cx, 140, 52, 6, _hexs('#DDEFF3')); _ring(sube, cx, 140, 52, 6, _hexs('#DDEFF3'))
    both(x0 + 236, y0 + 140, x0 + 276, y0 + 146, _hexs('#DDEFF3'))
    both(x0 + 150, y0 + 52, x0 + 362, y0 + 58, _hexs('#9CC9D2'))
    both(x0 + 196, y0 + 36, x0 + 316, y0 + 41, _hexs('#5E8C96'))
    # 행 2~3 넷째 칸: 홀로그램 내용(세로) — 겹 고리 조각 + 세로 띠, 배경 0(가산이라 투명)
    x0, y0 = 3 * C, 2 * C
    _rect(alb, x0, y0, x0 + C, y0 + 2 * C, np.zeros(3, np.float32)); _rect(emi, x0, y0, x0 + C, y0 + 2 * C, np.zeros(3, np.float32))
    sub = alb[y0:y0 + 2 * C, x0:x0 + C]; sube = emi[y0:y0 + 2 * C, x0:x0 + C]
    hcol = _hexs('#7FE3F0')
    for k, (cy, r) in enumerate(((330, 70), (330, 48), (250, 58), (170, 40))):
        _ring(sub, 128, cy, r, 5, hcol, 0.9 - 0.15 * k); _ring(sube, 128, cy, r, 5, hcol, 0.9 - 0.15 * k)
    yy, xx = np.mgrid[0:2 * C, 0:C]
    col = np.exp(-((xx - 128) / 60.0) ** 2) * (0.25 + 0.75 * (yy / (2 * C)))
    for arr in (sub, sube):
        arr[..., :3] += col[..., None] * hcol * 0.35
        arr[..., :3] *= (0.75 + 0.25 * (np.sin(yy * 0.9) > 0))[..., None]     # 스캔선
    np.clip(alb, 0, 1, out=alb); np.clip(emi, 0, 1, out=emi)
    emi[..., 3] = 1.0
    return alb, emi


C4 = 0.25
UI = {   # UV 사각형(u0, v0, u1, v1) — paint_ui 의 칸
    'white': (0.02, 0.02, 0.23, 0.23), 'red': (0.27, 0.02, 0.48, 0.23), 'teal': (0.52, 0.02, 0.73, 0.23), 'amber': (0.77, 0.02, 0.98, 0.23),
    'card': (0.02, 0.27, 0.23, 0.48), 'glass': (0.27, 0.27, 0.48, 0.48), 'ev': (0.5, 0.25, 0.75, 0.5), 'bis': (0.75, 0.25, 1.0, 0.5),
    'taxi': (0.0, 0.5, 0.5, 0.75), 'kiosk': (0.5, 0.5, 0.75, 1.0), 'display': (0.0, 0.75, 0.5, 1.0), 'holo': (0.75, 0.5, 1.0, 1.0),
}

# 이동체 아틀라스(Task 11): 웹에서 이동체는 정적 병합에서 빠져 재질마다 그리기 1 이 든다 → 포드 · 열차 · 배송로봇 · 드론의 재질을
# NWF_mover 한 장으로 합친다(이동체 하나 = 그리기 하나). 이동체가 쓰던 UI 칸(행 0 단색 발광, 택시 화면, 골판지)은 paint_ui 와
# 같은 자리라 UI 사각형을 그대로 쓰고, 나머지 재질은 단색 칸 가운데 한 점으로 UV 를 모은다(mover_atlas).
MOVER_CELL = {   # 재질 이름 → paint_mover 단색 칸 가운데(u, v)
    'NWF_glass_dark': (0.375, 0.375), 'NWF_pearl': (0.625, 0.375), 'NWF_train_white': (0.875, 0.375),
    'NWF_black': (0.625, 0.625), 'NWF_led_cyan': (0.875, 0.625), 'NWF_train_stripe': (0.875, 0.625),
    'NWF_led_blue': (0.125, 0.8125), 'NWF_led_white': (0.375, 0.8125), 'NWF_led_teal': (0.625, 0.125),
}
MOVER_BAND = (0.882, 0.993)   # 열차 창 띠(v): 아틀라스 맨 위 128 px 를 가로 전체로 쓴다(창 모듈 4 개 = u 1 → 가로 반복)
MOVER_PBR = (0.3, 0.1)        # NWF_mover (거칠기, 금속성): 진주색 · 흰 차체(0.28 … 0.32 · 0.1 … 0.15)에 맞춤. export 가 nw_pbr 을 읽는다


def paint_mover():
    """이동체 아틀라스 1024²(아래 행부터, 칸 256). 알베도 · 발광 두 장.
    행 0 = paint_ui 행 0(흰 · 빨강 · 청록 #43ABA7 · 호박, 발광) · 행 1 = 골판지 #B98C5A(테이프 띠) · 어두운 유리 · 진주색 차체 · 흰 열차 차체 ·
    행 2 = paint_ui 택시 상태 화면(두 칸) · 검정 · 스마트 청록 #39C6E0(발광) · 행 3 아래 절반 = 파랑 LED · 흰 LED(발광), 위 절반(128 px) =
    열차 창 띠(paint_train_window 를 가로로 4 번, 밤에만 켜지는 따뜻한 흰빛)."""
    W = 1024; C = 256
    ua, ue = _ui_arrays()
    alb = _canvas(W, W, _hexs('#0B0E12')); emi = _canvas(W, W, np.zeros(3, np.float32))
    alb[0:C] = ua[0:C]; emi[0:C] = ue[0:C]                                     # 행 0: 단색 발광 4
    alb[2 * C:3 * C, 0:2 * C] = ua[2 * C:3 * C, 0:2 * C]; emi[2 * C:3 * C, 0:2 * C] = ue[2 * C:3 * C, 0:2 * C]   # 택시 화면
    for (x0, y0, w, h), col, lit in (((0, C, C, C), '#B98C5A', False), ((C, C, C, C), '#0C1013', False), ((2 * C, C, C, C), '#C9CDD0', False),
                                     ((3 * C, C, C, C), '#EEF1F2', False), ((2 * C, 2 * C, C, C), '#121416', False),
                                     ((3 * C, 2 * C, C, C), SMART_CYAN, True), ((0, 3 * C, C, C // 2), '#3E8AD0', True)):
        _rect(alb, x0, y0, x0 + w, y0 + h, _hexs(col))
        if lit:
            _rect(emi, x0, y0, x0 + w, y0 + h, _hexs(col))
    _rect(alb, C, 3 * C, 2 * C, 3 * C + C // 2, _hexs('#C8CDD0')); _rect(emi, C, 3 * C, 2 * C, 3 * C + C // 2, _hexs('#E4EEF5'))
    _rect(alb, C // 2 - 14, C, C // 2 + 14, 2 * C, _hexs('#A27846'))         # 골판지 칸 가운데 세로 테이프
    ta, te = _train_window_arrays()
    for k in range(4):
        alb[W - C // 2:W, k * C:(k + 1) * C] = ta; emi[W - C // 2:W, k * C:(k + 1) * C] = te
    np.clip(alb, 0, 1, out=alb); np.clip(emi, 0, 1, out=emi)
    emi[..., 3] = 1.0
    a = lib.save_image('NWF_gen_mover', alb, os.path.join(GEN, 'NWF_gen_mover.png'), TAG)
    e = lib.save_image('NWF_gen_mover_emit', emi, os.path.join(GEN, 'NWF_gen_mover_emit.png'), TAG)
    return a, e


def mover_atlas(me, M):
    """여러 재질로 만든 이동체 메시 → NWF_mover 한 재질. NWF_ui 면은 UV 그대로(같은 칸), 열차 창 면은 창 띠로, 나머지는 MOVER_CELL 한 점."""
    names = [m.name for m in me.materials]
    uv = me.uv_layers['UVMap'].data
    b0, b1 = MOVER_BAND
    for p in me.polygons:
        nm = names[p.material_index]
        if nm == 'NWF_ui':
            continue
        for li in p.loop_indices:
            if nm == 'NWF_train_window':
                u, v = uv[li].uv
                uv[li].uv = (u / 4.0, b0 + v * (b1 - b0))
            else:
                uv[li].uv = MOVER_CELL[nm]
    me.materials.clear()
    me.materials.append(M['mover'])
    me.polygons.foreach_set('material_index', [0] * len(me.polygons))
    me.update()
    return me


def paint_screen():
    """대형 LED 스크린 내용(1024 × 576): 추상 색면 — 깊은 청록 바탕에 흐르는 띠와 작은 주황 점, LED 화소 격자. 글자 없음."""
    W, H = 1024, 576
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    u = xx / W; v = yy / H
    base = np.zeros((H, W, 3), np.float32)
    c0 = _hexs('#0E2A3A'); c1 = _hexs('#1F6F8B'); c2 = _hexs('#C9E4EC'); c3 = _hexs('#E07A3A')
    f = 0.5 + 0.5 * np.sin(u * 5.0 + np.sin(v * 3.0) * 1.6)
    base = c0 * (1 - f[..., None]) + c1 * f[..., None]
    for k, (ph, amp, wdt) in enumerate(((0.3, 0.12, 0.035), (1.7, 0.09, 0.02), (2.9, 0.15, 0.05))):
        cy = 0.52 + amp * np.sin(u * (4.0 + k) + ph) + 0.05 * np.sin(u * 13.0 + ph * 2)
        band = np.exp(-((v - cy) / wdt) ** 2)
        base = base * (1 - 0.8 * band[..., None]) + c2 * (0.8 * band[..., None]) * (0.55 + 0.15 * k)
    dot = np.exp(-(((u - 0.74) / 0.035) ** 2 + ((v - 0.30) / 0.062) ** 2))
    base = base * (1 - dot[..., None]) + c3 * dot[..., None]
    vig = (1 - 0.35 * ((u - 0.5) ** 2 * 2.4 + (v - 0.5) ** 2 * 2.0))
    base *= vig[..., None]
    grid = ((xx % 4) < 3) & ((yy % 4) < 3)                       # LED 화소 사이 검은 틈(가까이서만 보임)
    base *= np.where(grid, 1.0, 0.45)[..., None]
    out = np.ones((H, W, 4), np.float32); out[..., :3] = np.clip(base, 0, 1)
    return lib.save_image('NWF_gen_screen', out, os.path.join(GEN, 'NWF_gen_screen.png'), TAG)


def _lowfreq(rng, h, w, lx, ly):
    """이음 없는(주기 경계) 저주파 노이즈 h × w — 평균 0, 표준편차 1. lx, ly = 대략의 파장(px). 백색 잡음을 FFT 로 거른다."""
    F = np.fft.rfft2(rng.standard_normal((h, w)))
    fy = np.fft.fftfreq(h)[:, None]; fx = np.fft.rfftfreq(w)[None, :]
    F *= np.exp(-((fx * lx) ** 2 + (fy * ly) ** 2))
    r = np.fft.irfft2(F, s=(h, w)).astype(np.float32)
    return (r - r.mean()) / (r.std() + 1e-9)


CW_FLOORS = int(round(CW_TILE[1] / 4.0))    # 아틀라스 한 장의 층 수(2)


def _curtain_px(W, H):
    """커튼월 아틀라스 W × H 의 px/m(가로 · 세로)와 칸 크기(px): 1 칸 = 1.5 × 4.0 m, 가로 8칸 × CW_FLOORS 층(아래 행부터)."""
    return W / CW_TILE[0], H / CW_TILE[1], W // 8, H // CW_FLOORS


def paint_curtain():
    """커튼월 낮 아틀라스 1024 × 1024. 1 칸 = 1.5 × 4.0 m, 가로 8칸 × 2층 → 둘레 12 m × 높이 8 m(u = 둘레 m / 12, v = z / 8).
    (§5 의 1024 × 2048 · 4층은 optimize 가 512 × 1024 로 줄여 출하했다 → 한 장이 덮는 높이를 반으로 줄여 출하 해상도를 2 배로)
    층마다 아래부터 스팬드럴 0 … 0.35 m, 가로 멀리언 0.35 … 0.40, 시야 유리 0.40 … 3.70, 층 띠 3.70 … 4.00(#3C4A55, 돌출 없음).
    유리 #8FB4CF → #CFE0EC: 판마다 위로 밝아지는 하늘 반사 + 세로로 긴 저주파 노이즈 줄(이음 없이 반복). 어두운 칸 #5F7E96(블라인드 ·
    깊은 실내) 20 %, 세로 멀리언 #DDE3E7 0.06 m. 바탕은 _canvas, 칸 · 띠 · 멀리언은 _rect, 유리 기울기만 numpy 로 칠한다."""
    W, H = 1024, 1024
    pu, pv, cw, fh = _curtain_px(W, H)
    rng = np.random.default_rng(8041)
    c0, c1, dark = _hexs('#8FB4CF'), _hexs('#CFE0EC'), _hexs('#5F7E96')
    mull, band = _hexs('#DDE3E7'), _hexs('#3C4A55')
    A = _canvas(W, H, c0)
    streak = _lowfreq(rng, H, W, W / 2.5, H / 1.2)                 # 파장 ≈ 가로 4.8 m · 세로 13 m: 세로로 긴 반사 줄
    zf = ((np.arange(H, dtype=np.float32) / pv) % 4.0)[:, None]
    jit = np.repeat(np.repeat(rng.uniform(-0.1, 0.1, (CW_FLOORS, 8)).astype(np.float32), fh, 0), cw, 1)
    t = np.clip(0.12 + 0.5 * np.clip((zf - 0.4) / 3.3, 0, 1) + 0.22 * streak + jit, 0, 1)[..., None]
    A[..., :3] = c0 * (1 - t) + c1 * t
    dk = rng.random((CW_FLOORS, 8)) < 0.2
    for f in range(CW_FLOORS):
        y0 = f * fh
        for c in range(8):
            if dk[f, c]:                                            # 어두운 칸
                q = A[y0:y0 + fh, c * cw:(c + 1) * cw, :3]; q[...] = q * 0.35 + dark * 0.65
        q = A[y0:y0 + int(0.35 * pv), :, :3]; q[...] = q * 0.5 + dark * 0.4            # 스팬드럴(슬래브 앞 불투명 유리)
        _rect(A, 0, y0 + 0.35 * pv, W, y0 + 0.40 * pv, mull)                           # 가로 멀리언
    for c in range(9):                                              # 세로 멀리언(양 끝은 반씩 → 이어 붙이면 한 줄)
        _rect(A, c * cw - 0.03 * pu, 0, c * cw + 0.03 * pu, H, mull)
    for f in range(CW_FLOORS):                                      # 층 띠(멀리언 위를 덮는다)
        _rect(A, 0, f * fh + 3.70 * pv, W, (f + 1) * fh, band)
    np.clip(A, 0, 1, out=A)
    return lib.save_image('NWF_gen_curtain', A, os.path.join(GEN, 'NWF_gen_curtain.png'), TAG)


def paint_curtain_night():
    """커튼월 밤 발광 512 × 512(낮 아틀라스와 같은 칸): 16 칸 중 6 칸(≈ 35 %)의 시야 유리만 켠다(_rect). 따뜻한 흰빛 70 % ·
    차가운 흰빛 30 %, 칸마다 세기 0.6 … 1.0, 천장 쪽이 조금 밝다. 멀리언 · 층 띠 · 스팬드럴 · 꺼진 칸은 0."""
    W, H = 512, 512
    pu, pv, cw, fh = _curtain_px(W, H)
    rng = np.random.default_rng(8042)
    E = _canvas(W, H, np.zeros(3, np.float32))
    n = CW_FLOORS * 8
    lit = rng.choice(n, int(round(0.35 * n)), replace=False)
    warm = rng.random(n) < 0.7
    k = rng.uniform(0.6, 1.0, n).astype(np.float32)
    for i in lit:
        f, c = divmod(int(i), 8)
        _rect(E, c * cw + 0.04 * pu, f * fh + 0.42 * pv, (c + 1) * cw - 0.04 * pu, f * fh + 3.68 * pv,
              (_hexs('#FFD9A0') if warm[i] else _hexs('#E6EEFF')) * k[i])
    ramp = 0.78 + 0.22 * np.clip(((np.arange(H, dtype=np.float32) / pv) % 4.0 - 0.4) / 3.3, 0, 1)
    E[..., :3] *= ramp[:, None, None]
    np.clip(E, 0, 1, out=E)
    return lib.save_image('NWF_gen_curtain_night', E, os.path.join(GEN, 'NWF_gen_curtain_night.png'), TAG)


# ═════════════════════════════ 재질 ═════════════════════════════
def mat_basic(name, col, rough, metal=0.0, surface='metal', spec=0.5, clearcoat=0.0):
    m = _new_mat(name); b = lib.NB(m.node_tree)
    out = b.node('ShaderNodeOutputMaterial'); bs = b.node('ShaderNodeBsdfPrincipled')
    b.L.new(bs.outputs[0], out.inputs['Surface'])
    bs.inputs['Base Color'].default_value = srgb(col); bs.inputs['Roughness'].default_value = rough
    bs.inputs['Metallic'].default_value = metal; bs.inputs['Specular IOR Level'].default_value = spec
    if clearcoat:
        bs.inputs['Coat Weight'].default_value = clearcoat; bs.inputs['Coat Roughness'].default_value = 0.08
    m['nw_surface'] = surface
    m['nw_tex'] = json.dumps({'kind': 'flat', 'color': col, 'rough': rough, 'metal': metal}, ensure_ascii=False)
    return m


def mat_emit(name, col, day, night, base='#15191C', rough=0.35):
    """단색 발광(LED). 세기 = day + night·nw_night."""
    m = _new_mat(name); b = lib.NB(m.node_tree)
    out = b.node('ShaderNodeOutputMaterial'); bs = b.node('ShaderNodeBsdfPrincipled')
    b.L.new(bs.outputs[0], out.inputs['Surface'])
    bs.inputs['Base Color'].default_value = srgb(base); bs.inputs['Roughness'].default_value = rough
    bs.inputs['Emission Color'].default_value = srgb(col)
    b.put(bs.inputs['Emission Strength'], lib.emit_strength(b, day, night))
    m['nw_surface'] = 'emissive'
    lib.emit_meta(m, col, None, day, night)
    return m


def mat_ui(name, alb, emi, day, night, rough=0.25, surface='emissive', alpha_from_emit=False):
    """그린 이미지 재질: 알베도 + 발광 이미지(같은 UV). alpha_from_emit=True 면 발광이 없는 곳은 투명(진열창 디스플레이)."""
    m = _new_mat(name); b = lib.NB(m.node_tree)
    out = b.node('ShaderNodeOutputMaterial'); bs = b.node('ShaderNodeBsdfPrincipled')
    b.L.new(bs.outputs[0], out.inputs['Surface'])
    uv = b.node('ShaderNodeUVMap', uv_map='UVMap')
    ta = b.node('ShaderNodeTexImage'); ta.image = alb; ta.interpolation = 'Linear'; b.L.new(uv.outputs['UV'], ta.inputs['Vector'])
    te = b.node('ShaderNodeTexImage'); te.image = emi; te.interpolation = 'Linear'; b.L.new(uv.outputs['UV'], te.inputs['Vector'])
    b.L.new(ta.outputs['Color'], bs.inputs['Base Color'])
    b.L.new(te.outputs['Color'], bs.inputs['Emission Color'])
    b.put(bs.inputs['Emission Strength'], lib.emit_strength(b, day, night))
    bs.inputs['Roughness'].default_value = rough
    if alpha_from_emit:
        lum = b.node('ShaderNodeRGBToBW'); b.L.new(te.outputs['Color'], lum.inputs['Color'])
        b.L.new(b.math('MINIMUM', b.mul(lum.outputs[0], 3.0), 0.92), bs.inputs['Alpha'])
        m.surface_render_method = 'BLENDED'; m.use_backface_culling = False
    m['nw_surface'] = surface
    m['nw_tex'] = json.dumps({'kind': 'gen', 'albedo': alb.name, 'emissive': emi.name,
                              'alpha': 'emissive luminance ×3' if alpha_from_emit else None}, ensure_ascii=False)
    lib.emit_meta(m, None, emi.name, day, night)
    return m


def mat_glass(name, col='#1E2A30', alpha=0.28):
    m = _new_mat(name); b = lib.NB(m.node_tree)
    out = b.node('ShaderNodeOutputMaterial'); bs = b.node('ShaderNodeBsdfPrincipled')
    b.L.new(bs.outputs[0], out.inputs['Surface'])
    bs.inputs['Base Color'].default_value = srgb(col); bs.inputs['Roughness'].default_value = 0.06
    bs.inputs['Alpha'].default_value = alpha
    m.surface_render_method = 'BLENDED'; m.use_backface_culling = False
    m['nw_surface'] = 'glass'
    m['nw_tex'] = json.dumps({'kind': 'flat', 'color': col, 'alpha': alpha}, ensure_ascii=False)
    return m


def mat_holo(name, img, col, day, night, falloff='v'):
    """holo(웹 전용 셰이더로 바뀜): 가산 = 투명 + 발광. falloff 'v' = UV v 를 따라 사라짐(서치라이트 원뿔), 'img' = 이미지 내용."""
    m = _new_mat(name); b = lib.NB(m.node_tree)
    out = b.node('ShaderNodeOutputMaterial')
    tr = b.node('ShaderNodeBsdfTransparent'); em = b.node('ShaderNodeEmission')
    add = b.node('ShaderNodeAddShader')
    b.L.new(tr.outputs[0], add.inputs[0]); b.L.new(em.outputs[0], add.inputs[1]); b.L.new(add.outputs[0], out.inputs['Surface'])
    uv = b.node('ShaderNodeUVMap', uv_map='UVMap')
    lw = b.node('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.35
    face = b.sub(1.0, lw.outputs['Facing'])                         # 정면 1, 가장자리 0 → 원뿔 윤곽이 부드럽다
    strength = lib.emit_strength(b, day, night)
    if falloff == 'v':
        _, v, _ = b.sepxyz(uv.outputs['UV'])
        fade = b.math('POWER', b.sub(1.0, v, clamp=True), 1.6)
        k = b.mul(b.mul(fade, face), strength)
        em.inputs['Color'].default_value = srgb(col)
        b.L.new(k, em.inputs['Strength'])
    else:
        t = b.node('ShaderNodeTexImage'); t.image = img; b.L.new(uv.outputs['UV'], t.inputs['Vector'])
        c = b.col(1.0, t.outputs['Color'], srgb(col), 'MULTIPLY')
        b.L.new(c, em.inputs['Color'])
        b.L.new(b.mul(strength, b.add(0.35, b.mul(face, 0.65))), em.inputs['Strength'])
    m.surface_render_method = 'BLENDED'; m.use_backface_culling = False
    try:
        m.use_transparency_overlap = True
    except AttributeError:
        pass
    m['nw_surface'] = 'holo'
    lib.emit_meta(m, col, img.name if (img is not None and falloff != 'v') else None, day, night, additive=True, fade=falloff)
    return m


def materials():
    ui_a, ui_e = paint_ui()
    scr = paint_screen()
    M = {
        'led_blue': mat_emit('NWF_led_blue', '#3E8AD0', 6.0, 26.0),
        'led_teal': mat_emit('NWF_led_teal', '#43ABA7', 3.0, 16.0),
        'led_white': mat_emit('NWF_led_white', '#E4EEF5', 2.0, 30.0, base='#C8CDD0'),
        'alu': mat_basic('NWF_alu_dark', '#2A2D31', 0.38, 0.85),
        'steel': mat_basic('NWF_steel_scaffold', '#6B6E70', 0.55, 0.9),
        'black': mat_basic('NWF_black', '#121416', 0.6, 0.0, spec=0.4),
        'pearl': mat_basic('NWF_pearl', '#C9CDD0', 0.32, 0.15, clearcoat=0.6),
        'glass': mat_glass('NWF_glass'),
        'glass_dark': mat_basic('NWF_glass_dark', '#0C1013', 0.07, 0.0, surface='glass', spec=0.7),
        'ui': mat_ui('NWF_ui', ui_a, ui_e, 1.4, 6.0),
        'display': mat_ui('NWF_display', ui_a, ui_e, 1.2, 4.0, alpha_from_emit=True),
        'screen': mat_ui('NWF_screen', scr, scr, 2.2, 7.0, rough=0.3),
        'holo': mat_holo('NWF_holo', ui_e, '#9FEAF5', 1.5, 5.0, falloff='img'),
        'beam': mat_holo('NWF_beam', None, '#DDEBFF', 0.15, 1.2, falloff='v'),
        # 신축 타워(Task 8): 커튼월(밤 창 35 %), 유리 난간, 흰 알루미늄(난간대 · 크라운 틀 · 캐노피 · 화분 상자 · 태양광 뒷판 · 테라스 바닥 · 풍력)
        'curtain': mat_ui('NWF_curtain', paint_curtain(), paint_curtain_night(), 0.0, 1.1, rough=CURTAIN_PBR[0], surface='glass'),
        'rail': mat_glass('NWF_glass_rail', '#BFD8E6', 0.3),
        'white': mat_basic('NWF_tower_white', '#E4E8EA', 0.35, 0.3),
        'bark': mat_basic('NWF_bark_flat', '#5E544A', 0.85, 0.0, surface='foliage'),    # 광장 느티나무 줄기(원경: 텍스처 없이)
    }
    M['glass']['nw_surface'] = 'glass'
    # 2호선 튜브 · 열차 · 스카이브리지(Task 9, §4.2)
    tr_a, tr_e = paint_train_window()
    M.update({
        'tube_steel': mat_basic('NWF_tube_steel', '#E6E9EA', 0.35, 0.3),
        # 튜브 유리(Task 12): 옅은 #BFD8E6 · 알파 0.22 는 2041 골목 끝(약 100 m)에서 흰 리브만 남아 '흰 난간선'으로 읽혔다 →
        # 짙은 청회색 · 알파 0.55 로 흰 리브와 대비를 주고 하늘 반사가 보이게(형상 그대로). 웹 불투명도는 world.js GLASS_OPACITY 와 같은 값
        'tube_glass': mat_glass('NWF_tube_glass', TUBE_GLASS[0], TUBE_GLASS[1]),
        'tube_led': mat_emit('NWF_tube_led', '#DDF4FA', 0.0, 2.0),
        'white_conc': mat_basic('NWF_white_concrete', '#E3E1DB', 0.75, 0.0, surface='wall'),
        'train_white': mat_basic('NWF_train_white', '#EEF1F2', 0.28, 0.1),
        'train_window': mat_ui('NWF_train_window', tr_a, tr_e, 0.0, 1.2, rough=0.1, surface='glass'),
        'train_stripe': mat_emit('NWF_train_stripe', '#39C6E0', 0.4, 1.5),
        'bridge_led': mat_emit('NWF_led_bridge', '#39C6E0', 0.3, 1.6),
    })
    # 스마트 거리(Task 10, §4.2 · §4.3): 태양광 노면, 청록 발광선, 청록 LED(횡단보도 · 배송로봇 띠), 투명 키오스크 유리, 파라솔 천, 티크 좌판
    M.update({
        # 태양광 노면(Task 12): 거칠기 0.2 · 금속 0.25 는 비스듬히 보면 하늘을 비춰 밝은 회청색 → 0.65 · 0 으로 짙은 남색 셀이 남게
        'road_pv': mat_tex('NWF_road_pv', paint_pv_road(), 0.65, 0.0, surface='metal'),
        'road_led': mat_emit('NWF_road_led', SMART_CYAN, 0.5, 2.2),
        'led_cyan': mat_emit('NWF_led_cyan', SMART_CYAN, 3.0, 16.0),
        'kiosk_glass': mat_ui('NWF_kiosk_glass', ui_a, ui_e, 1.4, 6.0, rough=0.08, surface='glass'),
        'parasol': mat_basic('NWF_parasol', '#F2EFE6', 0.85, 0.0, surface='wall'),
        'teak': mat_basic('NWF_teak', '#9A7452', 0.6, 0.0, surface='wall'),
    })
    # 이동체 한 장 재질(Task 11, paint_mover): 웹에서는 발광 맵이 있는 비 NWF_ui 재질이라 밤에만 켜진다(LED · 열차 창)
    mv_a, mv_e = paint_mover()
    M['mover'] = mat_ui('NWF_mover', mv_a, mv_e, 0.4, 3.0, rough=MOVER_PBR[0], surface='metal')
    next(n for n in M['mover'].node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Metallic'].default_value = MOVER_PBR[1]
    M['mover']['nw_pbr'] = MOVER_PBR
    kg = M['kiosk_glass']                     # 알파 0.55(웹은 world.js GLASS_OPACITY 가 같은 값으로 투명 · 깊이 쓰기 끔)
    next(n for n in kg.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Alpha'].default_value = 0.55
    kg.surface_render_method = 'BLENDED'; kg.use_backface_culling = False
    kg['nw_tex'] = json.dumps({**json.loads(kg['nw_tex']), 'alpha': 0.55}, ensure_ascii=False)
    next(n for n in M['tube_glass'].node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Roughness'].default_value = 0.05
    M['tube_glass']['nw_tex'] = json.dumps({'kind': 'flat', 'color': TUBE_GLASS[0], 'alpha': TUBE_GLASS[1], 'rough': 0.05}, ensure_ascii=False)
    # 커튼월(CP1): 반금속 · 매끈 → 하늘을 비추는 푸른 유리(알베도 아틀라스가 반사를 물들인다). export 가 nw_pbr 을 읽는다
    next(n for n in M['curtain'].node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Metallic'].default_value = CURTAIN_PBR[1]
    M['curtain']['nw_pbr'] = CURTAIN_PBR
    # 현재 층(present.py · ground.py)이 만든 재질을 이름으로 다시 쓴다: 화단 윗면, 태양광, 보도블록(광장), 잎 덩이(관목 · 늘어진 잎 카드)
    for k, nm in (('meadow', 'NW_meadow'), ('pv', 'NW_pv'), ('deck', 'NW_pavers'), ('leaves', 'NW_zelkova_leaves'), ('ivy', 'NW_ivy')):
        M[k] = bpy.data.materials[nm]
    return M


# ═════════════════════════════ (1) 고가 하부 파란 LED 선 ═════════════════════════════
def led_path(side):
    """side +1 = 남쪽 모서리, −1 = 북쪽. 반환: [(x, y, z)] 꺾은선(상판 하부 모서리 → 승강장 구간은 승강장 끝 아래)."""
    ye = VIA_RIM_Y0 + 0.07 if side > 0 else VIA_RIM_Y1 - 0.07
    ys = (VIA_RIM_Y0 - ST_D + 0.07) if side > 0 else (VIA_RIM_Y1 + ST_D - 0.07)
    zd = DECK_B - 0.012; zs = ST_B - 0.012
    a, b = ST_X
    return [(VIA_EXT[0], ye, zd), (a, ye, zd), (a + 0.05, ye, zs), (a + 0.05, ys, zs), (b - 0.05, ys, zs),
            (b - 0.05, ye, zs), (b, ye, zd), (VIA_EXT[1], ye, zd)]


def build_led(C, M):
    mb = MB()
    for side in (1, -1):
        P = led_path(side)
        for i in range(len(P) - 1):
            p0 = Vector(P[i]); p1 = Vector(P[i + 1]); d = p1 - p0
            if d.length < 1e-6:
                continue
            if abs(d.z) > 1e-3 and abs(d.x) < 0.2 and abs(d.y) < 0.2:      # 상판 → 승강장 높이 계단(짧은 세로 조각)
                x0, x1 = sorted((p0.x, p1.x)); y = p0.y
                mb.box((x0 - LED_W / 2, y - LED_W / 2, min(p0.z, p1.z)), (x0 + LED_W / 2, y + LED_W / 2, max(p0.z, p1.z)), 1,
                       faces='xXyY')
                continue
            if abs(d.x) >= abs(d.y):
                x0, x1 = sorted((p0.x, p1.x)); y = p0.y; z = p0.z
                mb.box((x0, y - LED_W / 2 - 0.015, z - 0.018), (x1, y + LED_W / 2 + 0.015, z), 1, faces='yYz')     # 알루미늄 채널
                mb.box((x0, y - LED_W / 2, z - 0.018 - LED_H), (x1, y + LED_W / 2, z - 0.018), 0, faces='yYz')     # 확산판(발광)
            else:
                y0, y1 = sorted((p0.y, p1.y)); x = p0.x; z = p0.z
                mb.box((x - LED_W / 2 - 0.015, y0, z - 0.018), (x + LED_W / 2 + 0.015, y1, z), 1, faces='xXz')
                mb.box((x - LED_W / 2, y0, z - 0.018 - LED_H), (x + LED_W / 2, y1, z - 0.018), 0, faces='xXz')
    me = mb.to_mesh('FU_viaduct_led', [M['led_blue'], M['alu']], mask=lambda co: (0.0, 0.1, 1.0))
    o = obj('FU_viaduct_led', me, C, surface='emissive', night=True, nw_motif='viaduct_led')
    return o


# ═════════════════════════════ (2) 비계 LED 스크린 ═════════════════════════════
def build_screen(C, M, gz):
    s = SCREEN
    x0 = (s['x0'] + s['x1']) / 2 - s['w'] / 2; x1 = x0 + s['w']
    y = s['y']; z0 = s['z0']; z1 = z0 + s['h']
    # 화면: 앞면(+y) 발광, 테두리·뒷판은 알루미늄
    mb = MB()
    mb.quad((x1, y + 0.02, z0), (x0, y + 0.02, z0), (x0, y + 0.02, z1), (x1, y + 0.02, z1), 0, (0, 0, 1, 1))   # 앞면은 +y(북)를 본다
    mb.box((x0 - 0.12, y - 0.32, z0 - 0.12), (x1 + 0.12, y, z1 + 0.12), 1, faces='xXyzZ')
    for zz in (z0 - 0.12, z1 + 0.12):                                     # 앞 테두리
        mb.box((x0 - 0.12, y, zz - 0.06), (x1 + 0.12, y + 0.06, zz + 0.06), 1)
    for xx in (x0 - 0.12, x1 + 0.12):
        mb.box((xx - 0.06, y, z0 - 0.12), (xx + 0.06, y + 0.06, z1 + 0.12), 1)
    me = mb.to_mesh('FU_screen_face', [M['screen'], M['alu']], mask=lambda co: (0.0, 0.15, 1.0))
    face = obj('FU_screen_face', me, C, surface='emissive', night=True, nw_motif='led_screen')
    # 비계: 앞·뒤 두 줄 세로 관(4 m 간격 → 6본), 가로 띠 4단, 앞뒤 연결, 사선 가새, 지붕 위 받침판(지붕 높이를 실제로 잰다)
    mb = MB(); r = 0.03; n = 6; rect = (0, 0, 1, 1)
    xs = [x0 - 0.4 + (s['w'] + 0.8) * k / 3 for k in range(4)]
    rows = {'front': y - 0.5, 'back': y - 3.6}
    feet = {}
    for key, yy in rows.items():
        for xx in xs:
            zb = gz.roof(xx, yy)
            feet[(key, xx)] = zb
            mb.cyl((xx, yy, zb), (xx, yy, z1 + 0.6), r, r, n, 0, caps=(False, True))
            mb.box((xx - 0.22, yy - 0.22, zb - 0.02), (xx + 0.22, yy + 0.22, zb + 0.05), 1)          # 받침판(침목)
        for zz in [z0 - 0.4, (z0 + z1) / 2, z1 + 0.4] + [max(feet[(key, xx)] for xx in xs) + 0.6]:
            mb.cyl((xs[0], yy, zz), (xs[-1], yy, zz), r, r, n, 0, caps=(False, False))
        for i in range(3):                                                # 앞·뒤 면 사선 가새
            mb.cyl((xs[i], yy, max(feet[(key, xs[i])], z0 - 3) + 0.6), (xs[i + 1], yy, z1 + 0.4), r * 0.8, r * 0.8, n, 0, caps=(False, False))
    for xx in xs:                                                         # 앞뒤 연결·옆 가새
        for zz in (z0 - 0.4, z1 + 0.4):
            mb.cyl((xx, rows['back'], zz), (xx, rows['front'], zz), r, r, n, 0, caps=(False, False))
        mb.cyl((xx, rows['back'], feet[('back', xx)] + 0.6), (xx, rows['front'], z0 - 0.4), r * 0.8, r * 0.8, n, 0, caps=(False, False))
    for xx in (xs[0] + 0.5, xs[-1] - 0.5):                                # 화면 고정 브래킷
        for zz in (z0 + 0.6, z1 - 0.6):
            mb.box((xx - 0.05, rows['front'], zz - 0.05), (xx + 0.05, y - 0.32, zz + 0.05), 1)
    # 케이블 트레이: 화면 뒤에서 지붕 → 처마 → 벽으로(덧댄 흔적)
    tx = x1 - 0.8
    mb.box((tx - 0.1, rows['back'], z0 - 0.5), (tx + 0.1, y - 0.35, z0 - 0.42), 1)
    zr = gz.roof(tx, rows['back'] - 0.2)
    mb.box((tx - 0.1, rows['back'] - 0.2, zr + 0.05), (tx + 0.1, rows['back'], z0 - 0.42), 1)
    me = mb.to_mesh('FU_screen_frame', [M['steel'], M['alu']], smooth=True, sharp=40, mask=lambda co: (0.0, 0.3, 1.0))
    frame = obj('FU_screen_frame', me, C, surface='metal')
    return face, frame


# ═════════════════════════════ (3) 발광 횡단보도·바닥 신호·연석 LED ═════════════════════════════
def build_crossing(C, M, gz):
    mb = MB()
    road = lambda x, y: gz.z(x, y, -0.1, only='GR_road')
    for xe in (XW - CW - 0.16, XW + CW + 0.16):                            # 횡단보도 양 가장자리 발광선(폭 0.12 m)
        n = 26
        for i in range(n):
            ya = TT[1] - 0.25 - (TT[1] - TT[0] - 0.5) * i / n; yb = TT[1] - 0.25 - (TT[1] - TT[0] - 0.5) * (i + 1) / n
            za = road(xe, ya) + 0.008; zb = road(xe, yb) + 0.008
            mb.face([(xe - 0.06, ya, za), (xe - 0.06, yb, zb), (xe + 0.06, yb, zb), (xe + 0.06, ya, za)], 0)
    # 바닥형 보행 신호(보도 쪽 경계석 뒤 0.25 m 띠, 횡단보도 폭) — 한국 바닥 신호등을 2041 년형 청록으로
    for yy, sgn in ((TT[1] + 0.35, 1), (TT[0] - 0.35, -1)):
        x0, x1 = XW - CW, XW + CW
        z = gz.z((x0 + x1) / 2, yy, 0.0) + 0.006
        for k in range(10):                                               # 짧은 모듈 10장(이음 틈)
            a = x0 + (x1 - x0) * k / 10 + 0.02; b2 = x0 + (x1 - x0) * (k + 1) / 10 - 0.02
            mb.face([(a, yy - 0.12, z), (b2, yy - 0.12, z), (b2, yy + 0.12, z), (a, yy + 0.12, z)], 0)
    # 연석 앞면 LED(횡단보도 양쪽 12 m + 북측 정류장 구간) — 경계석 앞면(측구 위 2~6 cm)
    for yc, face_dir in ((TT[1], -1), (TT[0], 1)):
        spans = [(XW - CW - 12.0, XW - CW - 0.4), (XW + CW + 0.4, XW + CW + 12.0)]
        if face_dir < 0:
            spans.append((-56.0, -38.0))
        for xa, xb in spans:
            n = 12
            for i in range(n):
                a = xa + (xb - xa) * i / n; b2 = xa + (xb - xa) * (i + 1) / n
                zg = road((a + b2) / 2, yc + face_dir * 0.12)
                yf = yc + face_dir * 0.006
                p = [(a, yf, zg + 0.035), (b2, yf, zg + 0.035), (b2, yf, zg + 0.065), (a, yf, zg + 0.065)]
                mb.face(p if face_dir < 0 else p[::-1], 0)
    me = mb.to_mesh('FU_crossing_led', [M['road_led']], mask=lambda co: (0.0, 0.6, 1.0))   # Task 10: #43ABA7 → 스마트 청록 #39C6E0(노면 발광선과 같은 재질 = 웹 병합 1 그리기)
    return obj('FU_crossing_led', me, C, surface='emissive', night=True, nw_motif='smart_crossing')


# ═════════════════════════════ (4) 스마트 정류장 + 키오스크 ═════════════════════════════
def build_busstop(C, M, gz, kit):
    s = SHELTER; x = s['x']; yb, yf = s['y0'], s['y1']          # 뒤(보도 쪽) · 앞(차도 쪽)
    z = gz.z(x, (yb + yf) / 2, 0.0)
    W = 3.2; H = 2.65; x0, x1 = x - W / 2, x + W / 2
    mb = MB()
    a = 0; g = 1; ui = 2; led = 3                                  # 재질 번호: 알루미늄, 유리, UI, LED 흰색
    for xx in (x0, x1):                                            # 기둥 4(뒤 2, 앞 2는 얇게)
        mb.box((xx - 0.05, yb - 0.05, z), (xx + 0.05, yb + 0.05, z + H), a)
        mb.box((xx - 0.035, yf + 0.25 - 0.035, z), (xx + 0.035, yf + 0.25 + 0.035, z + H - 0.05), a)
    mb.box((x0 - 0.2, yf - 0.1, z + H), (x1 + 0.2, yb + 0.15, z + H + 0.12), a)            # 지붕 판(얇은 알루미늄)
    mb.box((x0 - 0.2, yf - 0.1, z + H - 0.02), (x1 + 0.2, yf - 0.04, z + H + 0.1), led, faces='y')   # 지붕 앞 가장자리 LED
    mb.box((x0 + 0.1, yf + 0.1, z + H - 0.03), (x1 - 0.1, yb - 0.1, z + H), led, faces='z')         # 지붕 밑 면 조명(얇은 띠)
    mb.box((x0 + 0.06, yb - 0.02, z + 0.12), (x1 - 0.06, yb + 0.02, z + H - 0.08), g, faces='yY')  # 뒤 유리
    mb.box((x1 - 0.02, yb - 0.02, z + 0.12), (x1 + 0.02, yf + 0.55, z + H - 0.08), g, faces='xX')  # 동쪽 옆 유리
    mb.box((x0 - 0.06, yb - 0.05, z + 0.3), (x0 + 0.06, yf + 0.5, z + 2.3), a)                       # 서쪽 끝 노선 안내판 틀
    mb.box((x0 - 0.065, yb - 0.0, z + 0.4), (x0 + 0.065, yf + 0.45, z + 2.2), ui, faces='xX',
           rect={'x': UI['kiosk'], 'X': UI['kiosk']})
    mb.box((x0 + 0.4, yb - 0.45, z + 0.42), (x1 - 0.5, yb - 0.05, z + 0.48), a)                     # 의자
    for xx in (x0 + 0.6, x1 - 0.7):
        mb.box((xx - 0.03, yb - 0.4, z), (xx + 0.03, yb - 0.1, z + 0.42), a)
    bx = x + 0.2                                                    # 지붕 밑 도착 안내(BIS) — 양면
    mb.box((bx - 0.55, yf + 0.35, z + H - 0.42), (bx + 0.55, yf + 0.5, z + H - 0.04), a)
    mb.box((bx - 0.5, yf + 0.33, z + H - 0.38), (bx + 0.5, yf + 0.52, z + H - 0.08), ui, faces='yY', rect={'y': UI['bis'], 'Y': UI['bis']})
    mb.box((bx - 0.02, yf + 0.4, z + H - 0.04), (bx + 0.02, yf + 0.45, z + H), a)
    # 정류장 이름(가상): 지붕 앞 처마 판 위 흰 글자 — 우리가 지은 문구
    if kit is not None:
        V, F, w, h = kit.glyphs('공장길 · Factory-gil', 0.15, 0.008)
        base = len(mb.V)
        for vx, vy, vz in V:
            mb.V.append((x0 + 0.25 + w / 2 + vx, yf - 0.105 - vz, z + H + 0.06 + vy))
        for f in F:
            mb.F.append([base + i for i in f]); mb.FM.append(led); mb.UV.append([(0.5, 0.5)] * len(f))
    me = mb.to_mesh('FU_busstop', [M['alu'], M['glass'], M['ui'], M['led_white']], mask=lambda co: (0.0, 0.3, 0.55 + 0.45 * smoothstep(0, 1.0, co[2] - z)))
    o1 = obj('FU_busstop', me, C, surface='metal', night=True, nw_motif='bus_kiosk')
    # 키오스크: 얇은 기둥형 양면 화면(0.9 × 1.8, 바닥 0.25 m)
    kx, ky = KIOSK; kz = gz.z(kx, ky, 0.0)
    mb = MB()
    mb.box((kx - 0.08, ky - 0.5, kz), (kx + 0.08, ky + 0.5, kz + 2.2), 0)
    mb.box((kx - 0.085, ky - 0.45, kz + 0.3), (kx + 0.085, ky + 0.45, kz + 2.1), 2, faces='xX', rect={'x': UI['kiosk'], 'X': UI['kiosk']})
    mb.box((kx - 0.1, ky - 0.52, kz + 2.2), (kx + 0.1, ky + 0.52, kz + 2.26), 1, faces='zZxXyY')
    mb.box((kx - 0.12, ky - 0.55, kz - 0.05), (kx + 0.12, ky + 0.55, kz + 0.06), 0)
    me = mb.to_mesh('FU_kiosk', [M['alu'], M['led_white'], M['ui']], mask=lambda co: (0.0, 0.3, 0.55 + 0.45 * smoothstep(0, 1.0, co[2] - kz)))
    o2 = obj('FU_kiosk', me, C, surface='metal', night=True, nw_motif='bus_kiosk')
    return o1, o2


# ═════════════════════════════ (5) 둥근 자율 택시 ═════════════════════════════
def taxi_mesh(M):
    """독자 디자인: 앞뒤가 같은 둥근 캡슐 차체(4.3 × 1.85 × 1.55), 창 띠 = 상태 화면, 아래 청록 상태 띠, 지붕 센서 돔.
    로컬 +x 가 진행 방향. 재질: 0 진주색 차체, 1 UI(창 화면·등), 2 검정(타이어·하부), 3 어두운 유리(앞뒤 창)."""
    mb = MB()
    L2, W2, Ht = 2.15, 0.925, 1.55
    nu, nv = 20, 8                                   # Task 10: 28 × 10 → 20 × 8(포드 5 대가 각자 메시라 모바일 삼각형 예산)
    def se(t, e):                                    # 초타원 단면
        c, s = math.cos(t), math.sin(t)
        return (math.copysign(abs(c) ** e, c), math.copysign(abs(s) ** e, s))
    rows = []
    for j in range(nv + 1):
        f = j / nv                                    # 0 = 아래(문턱) … 1 = 지붕
        z = 0.32 + (Ht - 0.32) * (math.sin(f * math.pi / 2) ** 0.9)
        k = 1.0 - 0.32 * f ** 2.2                     # 위로 갈수록 좁아짐(둥근 지붕)
        kx = 1.0 - 0.42 * f ** 1.6
        ring = []
        for i in range(nu):
            px, py = se(2 * math.pi * i / nu, 0.42)
            ring.append((px * L2 * kx, py * W2 * k, z))
        rows.append(ring)
    def zone(i, j):
        px = math.cos(2 * math.pi * (i + 0.5) / nu)
        side = abs(px) < 0.72
        if 3 <= j <= 5:
            return 1 if side else 3                    # 옆 = 상태 화면, 앞뒤 = 어두운 유리
        return 0
    for j in range(nv):
        for i in range(nu):
            i2 = (i + 1) % nu
            m = zone(i, j)
            P = [rows[j][i], rows[j][i2], rows[j + 1][i2], rows[j + 1][i]]
            if m == 1:
                # 창 띠 = 상태 화면. 옆에서 볼 때 화면 내용이 바로 읽히도록 +y 쪽은 u 를 뒤집는다(밖에서 보면 +x 가 왼쪽).
                u0, v0, u1, v1 = UI['taxi']
                plus = math.sin(2 * math.pi * (i + 0.5) / nu) > 0
                jj = [j, j, j + 1, j + 1]
                uv = []
                for p, jc in zip(P, jj):
                    t = (p[0] / (L2 * 0.9) + 1) / 2
                    t = 1 - t if plus else t
                    uv.append((u0 + (u1 - u0) * min(1.0, max(0.0, t)), v0 + (v1 - v0) * (jc - 3) / 3))
            else:
                uv = [(0.5, 0.5)] * 4
            mb.face(P, m, uv)
    top = rows[-1]
    mb.face(top, 0, [(0.5, 0.5)] * nu)
    bot = [(x, y, 0.32) for x, y, _ in rows[0]]
    mb.face(list(reversed(bot)), 2, [(0.5, 0.5)] * nu)
    # 아래 청록 상태 띠(문턱 둘레) — 얇은 고리
    for i in range(nu):
        i2 = (i + 1) % nu
        a = rows[0][i]; b = rows[0][i2]
        mb.quad((a[0] * 1.004, a[1] * 1.004, 0.36), (b[0] * 1.004, b[1] * 1.004, 0.36), (b[0] * 1.004, b[1] * 1.004, 0.4),
                (a[0] * 1.004, a[1] * 1.004, 0.4), 1, UI['teal'])
    # 앞뒤 등(가는 가로 띠): 앞 흰색, 뒤 빨강
    for sx, r in ((1, UI['white']), (-1, UI['red'])):
        x = sx * (L2 * 0.985)
        mb.quad((x, -0.62 * sx, 0.74), (x, 0.62 * sx, 0.74), (x, 0.62 * sx, 0.79), (x, -0.62 * sx, 0.79), 1, r)
    # 바퀴 4(반쯤 차체에 묻힘)
    for wx in (-1.38, 1.38):
        for wy in (-0.86, 0.86):
            mb.cyl((wx, wy - 0.12, 0.34), (wx, wy + 0.12, 0.34), 0.34, 0.34, 10, 2, phase=0.1)
    # 지붕 센서 돔
    mb.cyl((0.2, 0, Ht - 0.02), (0.2, 0, Ht + 0.07), 0.2, 0.17, 10, 2, caps=(False, False))
    mb.cyl((0.2, 0, Ht + 0.07), (0.2, 0, Ht + 0.1), 0.17, 0.12, 10, 1, rect=UI['teal'], caps=(False, True))
    return mover_atlas(mb.to_mesh('FU_taxi', [M['pearl'], M['ui'], M['black'], M['glass_dark']], smooth=True, sharp=50,
                                  mask=lambda co: (0.0, 0.35, 0.55 + 0.45 * smoothstep(0.1, 0.9, co[2]))), M)


def build_taxis(C, M, gz):
    """자율주행 포드 5 대(§4.4): 각 경로의 시작점(위상 0.5 는 경로 길이의 절반 지점)에 진행 방향(앞 = 로컬 +x)으로 세운다.
    이동체라 각자 단일 사용자 메시(me.copy())이고, 사본마다 정점 AO(nw_mask B)를 조금씩 달리 써서 gltf-transform dedup · instance 가
    FU_taxi.<n> 노드 이름을 지우지 않게 한다(build_trains 와 같은 방법)."""
    me = taxi_mesh(M)
    out = []
    for i, (nm, rid, mode, speed, phase, pts) in enumerate(POD_ROUTES):
        (x, y), rz = _route_at(pts, phase, closed=(mode == 'loop'))
        z = _road_base(gz, x, y)
        m2 = me.copy(); m2.name = f'FU_taxi_{i}'
        k = 1.0 - 0.025 * i
        lib.write_mask_values(m2, [(0.0, 0.35, k * (0.55 + 0.45 * smoothstep(0.1, 0.9, v.co.z))) for v in m2.vertices])
        out.append(obj(nm, m2, C, (x, y, z), rz, surface='metal', night=True, nw_motif='robotaxi', nw_route=rid, nw_mode=mode,
                       nw_speed=speed, nw_phase=phase))
    bpy.data.meshes.remove(me)
    _assert_unique(out, '포드')
    print('pods', [(o.name, o['nw_route'], tuple(round(c, 2) for c in o.location), round(math.degrees(o.rotation_euler.z), 1)) for o in out])
    return out


def _assert_unique(objs, label):
    sig = [tuple(round(c, 4) for c in lib_mask_b(o.data)) for o in objs]
    if len(set(sig)) != len(sig):
        raise RuntimeError(f'{label}: 사본 메시가 같다 — dedup · instance 가 노드 이름을 지운다')


# ═════════════════════════════ (8) 스마트 거리(Task 10: §4.2 노면 · §4.3 소품 · §4.4 이동체 시작점) ═════════════════════════════
SMART_CYAN = '#39C6E0'
TT_FAR_Z = -0.12                          # backdrop.build_ground: 장면 밖 도로 BD_roads 노면 z(차선 BD_marks 는 그 위 +0.01)
PV_Y, PV_X = (-43.0, -41.0), (-260.0, 420.0)
PV_DZ, PV_DZ_FAR = 0.012, 0.014           # §4.2 는 +0.008 — 장면 안 노면이 2.5 m 안에서도 ±3 mm 출렁이고 황색 중앙선(GR_mark_yellow +0.005)이
                                          # 띠 위로 비쳐(look r1) 0.012 로 올렸다. 장면 밖은 BD_marks(+0.01) 위로
PV_TILE = (4.0, 2.0)                      # paint_pv_road 한 장 = 4 × 2 m(0.5 m 타일 8 × 4)
ROAD_GAPS_X = [(-108.0, -102.0), (XW - CW, XW + CW), (67.0, 73.0)]   # 서쪽 이면도로 교차로 · 횡단보도 · 동쪽 골목 교차로
RLED_W, RLED_DZ = 0.18, 0.018                # §4.2 는 +0.010 — 5 m 마디 사이 노면 출렁임(연석 쪽 측구 포함)에 묻히지 않게 0.018
                                          # 폭: 0.10 은 조감 거리(≈ 130 m)에서 1 화소보다 가늘어 밤 조감에 선이 거의 안 보였다(최종 수정 I3) → 0.18(삼각형 수 같음)
RLED_TT_Y = (-35.75, -48.25, -43.05, -40.95)                        # 연석 안쪽 2 · 태양광 띠 가장자리 2
RLED_AL = ((67.25, 72.75), [(-31.5, 67.0), (73.0, 135.0)])          # 동쪽 골목(x) — 북쪽 이면도로 교차로(y 67…73)에서 끊는다
RLED_NR = ((67.25, 72.75), [(-102.0, 67.0)])                        # 북쪽 이면도로(y)
STEP_IN, STEP_FAR = 5.0, 20.0             # 리본 마디: 장면 안은 GroundZ 를 5 m 마다(태양광 띠는 PV_STEP), 장면 밖(평평)은 20 m(UV 양자화 범위를 좁게)
PV_STEP = 2.5
CURB_STEP = 2.0                           # 연석 안쪽 발광선 마디(측구 패임을 따라간다, build_road_led)
KIOSK_GLASS = [(-96.0, -34.2), (40.0, -34.2), (-30.0, -50.9), (90.0, -50.9), (74.6, 20.0), (74.6, 60.0)]
KIOSK_HALF = (0.14, 0.56)                 # 발판 반폭(x · y, rz 0): 화면은 ±x 를 본다(보도를 따라 걷는 사람 · 골목 쪽)
TERRACES = [(28.0, 131.0), (36.0, 131.0), (44.0, 131.0), (52.0, 131.0), (38.0, 33.0), (44.0, 31.0)]
TERRACE_HALF = (1.4, 1.4)                 # 파라솔 반지름(의자는 그 안)
STREET_BENCHES = [(70.0, -34.2), (130.0, -34.2)]
BENCH_HALF = (1.25, 0.3)                  # 벤치 1.6 m + 화분 0.6 m(x) × 0.6 m(y)
AVOID_PREFIX = ('PR_light', 'PR_signal', 'PR_bollard', 'PR_planter', 'PR_pot', 'PR_ph_ubox', 'PR_ph_trash', 'PR_ph_extinguisher',
                'PR_ph_shrub', 'PR_scooter', 'PR_bench', 'PR_park_bench', 'PR_park_stone', 'PR_basalt', 'PR_zelkova', 'PR_ginkgo',
                'FU_busstop', 'FU_kiosk', 'FU_ev_post', 'FU_holo_base', 'FU_bridge_SB1_col', 'FU_bridge_SB2_col')
TRUNKS = ('PR_zelkova', 'PR_ginkgo')      # 나무는 수관 상자 대신 줄기(반경 0.5 m)만 피한다
# 배송로봇 · 포드 경로(§4.4). 이동은 Task 11(movers.js) — 여기서는 이름 · 시작점 · 진행 방향만 정한다
BOT_STARTS = [('FU_bot.0', 'bot0', (-95.0, -32.2), (60.0, -32.2)), ('FU_bot.1', 'bot1', (73.9, -28.0), (73.9, 132.0)),
              ('FU_bot.2', 'bot2', None, None)]                    # None = PARK_PATH 첫 점 → 둘째 점
BOT_LANE_GAP = 0.35                       # bot1 길(BOT1_LANE, 반폭 0.375) 둘레 여유: 경로 중심 → solid(키오스크) 0.7 m(tests/nowhere-clearance (d))
BOT = dict(L=0.7, W=0.55, H=0.6, r=0.1, clear=0.1, wheel=0.1)       # 흰 몸통(윗모서리 0.1 둥글게), 바닥 틈 0.1, 바퀴 반지름 0.1 × 6
POD_LOOP = [(-106.5, 144.5), (-106.5, -43.625), (69.0, -43.625), (69.0, 144.5)]   # 반시계: 서쪽 이면도로 남행 → 뚝섬로 안쪽 동행 → 골목 북행 → 고가 하부 서행
# ↑ 최종 수정 C1(2회차): 동쪽 골목(x 67…73, 6 m 일방통행)은 가운데 x 70 이 아니라 서쪽 차로 x 69.0 으로 달린다 — 2041 골목 카메라(x 71.6)와
#   동쪽 보도 배송로봇 bot1(x 73.9)에서 떨어지게. 일방통행이라 어느 쪽 차로든 어색하지 않다(1회차 x 71.0 은 카메라를 서쪽으로 밀어 T2 가 가렸다).
#   rounded_loop 가 이 모서리점으로 원호를 만든다(반지름 6 m — 원호는 뚝섬로 · 고가 하부 가로 안에서 끝난다)
POD_ROUTES = [   # (객체, id, 모드, 속도, 위상, 꺾은선)
    ('FU_taxi.0', 'pod_e1', 'wrap', 10.0, 0.0, [(-260.0, -46.875), (420.0, -46.875)]),
    ('FU_taxi.1', 'pod_e2', 'wrap', 8.5, 0.5, [(-260.0, -46.875), (420.0, -46.875)]),
    ('FU_taxi.2', 'pod_w1', 'wrap', 9.5, 0.0, [(420.0, -40.375), (-260.0, -40.375)]),
    ('FU_taxi.3', 'pod_l1', 'loop', 8.0, 0.0, 'POD_LOOP'),
    ('FU_taxi.4', 'pod_l2', 'loop', 8.0, 0.5, 'POD_LOOP'),
]


def rounded_loop(corners, r=6.0, step=1.5):
    """닫힌 직각 꺾은선(모서리점) → 모서리를 반지름 r 원호로 편 점열(step m 마다). 첫 점 = 첫 모서리 원호가 끝나는 곳."""
    n = len(corners); P = [Vector((x, y, 0.0)) for x, y in corners]
    out = []
    for i in range(n):
        c, nx_, nn = P[i], P[(i + 1) % n], P[(i + 2) % n]
        a = c + (nx_ - c).normalized() * r                       # 이 모서리 원호 끝(직선 시작)
        b = nx_ + (c - nx_).normalized() * r                     # 다음 모서리 원호 시작
        L = (b - a).length; k = max(1, int(math.ceil(L / step)))
        out += [a.lerp(b, j / k) for j in range(k)]
        u_in = (c - nx_).normalized(); u_out = (nn - nx_).normalized()
        ctr = nx_ + (u_in + u_out) * r
        a0 = math.atan2(b.y - ctr.y, b.x - ctr.x); e = nx_ + u_out * r
        a1 = math.atan2(e.y - ctr.y, e.x - ctr.x)
        da = (a1 - a0 + math.pi) % (2 * math.pi) - math.pi
        m = max(2, int(math.ceil(abs(da) * r / step)))
        out += [ctr + Vector((math.cos(a0 + da * j / m), math.sin(a0 + da * j / m), 0.0)) * r for j in range(m)]
    return [(round(p.x, 4), round(p.y, 4)) for p in out]


def _route_at(pts, phase, closed=False):
    """꺾은선 위 위상(0…1, 길이 비율) 자리와 진행 방향(rz) → ((x, y), rz)."""
    if pts == 'POD_LOOP':
        pts = rounded_loop(POD_LOOP)
    seq = list(pts) + ([pts[0]] if closed else [])
    seg = [(Vector(seq[i]), Vector(seq[i + 1])) for i in range(len(seq) - 1)]
    total = sum((b - a).length for a, b in seg); s = phase * total
    for a, b in seg:
        L = (b - a).length
        if s <= L or (a, b) == seg[-1]:
            p = a.lerp(b, min(1.0, s / max(L, 1e-9))); d = b - a
            return (p.x, p.y), math.atan2(d.y, d.x)
        s -= L


def _inside_x(x):
    return lib.MASK_RECT[0] <= x <= lib.MASK_RECT[2]


def _road_base(gz, x, y):
    """노면 높이: 장면 안은 GR_road(GroundZ), 밖은 원경 'tt' 노면 TT_FAR_Z."""
    return gz.z(x, y, TT_FAR_Z, only='GR_road') if _inside_x(x) else TT_FAR_Z


def _road_top(gz, x, y, dx, dy):
    """리본 꼭짓점 높이의 바탕: (x, y) 둘레 5 × 5 점(±dx, ±dx/2, ±dy, ±dy/2)의 노면 높이 가운데 가장 높은 값. 꼭짓점 한 점만 읽으면
    맨홀 둘레 침하(ground.py, 반경 1.1 m · 1.4 cm) 같은 국소 패임에 꼭짓점이 끌려 내려가거나 마디 사이의 좁은 턱(x −39.25, +1.5 cm)을
    놓쳐 노면이 띠 위로 비쳤다(수정 1회차, 웹 수직 광선 검사)."""
    if not _inside_x(x):
        return TT_FAR_Z
    K = (-1.0, -0.5, 0.0, 0.5, 1.0)
    return max(gz.z(x + i * dx, y + j * dy, TT_FAR_Z, only='GR_road') for i in K for j in K)


def _stations(a, b, step_in=STEP_IN):
    """a…b 마디점: 장면 안은 step_in m 격자, 밖은 STEP_FAR m 격자 + 장면 경계."""
    pts = {a, b}
    for e in (lib.MASK_RECT[0], lib.MASK_RECT[2]):
        if a < e < b:
            pts.add(e)
    for st, inside in ((step_in, True), (STEP_FAR, False)):
        k = math.ceil(a / st) * st
        while k < b:
            if _inside_x(k) == inside and a < k:
                pts.add(float(k))
            k += st
    return sorted(pts)


def _spans(a, b, gaps):
    out = [(a, b)]
    for g0, g1 in gaps:
        nxt = []
        for s0, s1 in out:
            if g1 <= s0 or g0 >= s1:
                nxt.append((s0, s1)); continue
            if s0 < g0:
                nxt.append((s0, g0))
            if g1 < s1:
                nxt.append((g1, s1))
        out = nxt
    return out


def paint_pv_road():
    """태양광 노면 타일(512 × 256 = 4 × 2 m, 128 px/m). 0.5 m 강화유리 타일(테두리 · 격자 #8A97AB) 안에 셀 4 × 4(#13213F),
    유리 윗면의 옅은 하늘 반사, 띠 양 가장자리(v 0 · 1)의 어두운 테두리 띠와 0.25 m 마다 LED 점(밝은 청록, 그린 점 — 발광 아님).
    Task 12: 셀이 타일의 77 %(전 66 %)를 덮고 셀을 짙은 남색으로 — 멀리서 밉맵 평균이 밝은 회청색이던 것을 레퍼런스처럼 짙은 남색 + 가는 밝은 격자로
    (전: 셀 #1E2C44 · 13 px / 14.5 px 간격 · 여백 3, 격자 #9AA7B5, 틀 #C9CED3, 사선 반사 0.06)."""
    W, H = 512, 256
    rng = np.random.default_rng(1041)
    cell, grid = _hexs('#13213F'), _hexs('#8A97AB')
    A = _canvas(W, H, grid)
    T = 64
    for ty in range(H // T):
        for tx in range(W // T):
            x0, y0 = tx * T, ty * T
            k = rng.uniform(0.9, 1.1)
            for cy in range(4):
                for cx in range(4):
                    _rect(A, x0 + 2 + cx * 15, y0 + 2 + cy * 15, x0 + 2 + cx * 15 + 14, y0 + 2 + cy * 15 + 14,
                          np.clip(cell * k * rng.uniform(0.92, 1.08), 0, 1))
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    sheen = (0.03 * np.exp(-(((xx % T) - (yy % T)) / 22.0) ** 2))[..., None]     # 타일마다 사선 반사(유리, Task 12: 0.06 → 0.03)
    A[..., :3] = A[..., :3] * (1 - sheen) + 1.0 * sheen
    for yb in ((0, 7), (H - 7, H)):                                                  # 띠 가장자리 테두리 + LED 점
        _rect(A, 0, yb[0], W, yb[1], _hexs('#39434D'))
        for x in range(16, W, 32):
            _rect(A, x - 2, yb[0] + 2, x + 2, yb[1] - 2, _hexs('#BFF1F8'))
    np.clip(A, 0, 1, out=A)
    return lib.save_image('NWF_gen_road_pv', A, os.path.join(GEN, 'NWF_gen_road_pv.png'), TAG)


def mat_tex(name, img, rough, metal, surface='metal'):
    """그린 이미지 한 장(반복 UV) + 고정 거칠기 · 금속(export 5 번 경로: nw_tex.tex[0].image, nw_pbr)."""
    m = _new_mat(name); b = lib.NB(m.node_tree)
    out = b.node('ShaderNodeOutputMaterial'); bs = b.node('ShaderNodeBsdfPrincipled')
    b.L.new(bs.outputs[0], out.inputs['Surface'])
    uv = b.node('ShaderNodeUVMap', uv_map='UVMap')
    t = b.node('ShaderNodeTexImage'); t.image = img; t.interpolation = 'Linear'; b.L.new(uv.outputs['UV'], t.inputs['Vector'])
    b.L.new(t.outputs['Color'], bs.inputs['Base Color'])
    bs.inputs['Roughness'].default_value = rough; bs.inputs['Metallic'].default_value = metal
    m['nw_surface'] = surface; m['nw_pbr'] = (rough, metal); m['nw_alpha_clip'] = 0.0
    m['nw_tex'] = json.dumps({'kind': 'gen', 'tex': [{'image': img.name, 'interp': 'Linear'}]}, ensure_ascii=False)
    return m


RIBBON_CHUNK = 32.0                      # 노면 리본 조각 길이(m): optimize 의 위치 양자화(메시 상자 기준 14 bit)가 680 m 한 메시면 3.3 cm
                                          # 간격이라 띠가 노면 아래로 묻혔다(웹 r1) → 조각마다 따로 객체(≤ 2 mm). 웹 정적 병합이 재질별로 다시 1 그리기로 묶는다


def _chunk_key(x):
    if x < lib.MASK_RECT[0]:
        return 'w'
    if x > lib.MASK_RECT[2]:
        return 'e'
    return int(math.floor(x / RIBBON_CHUNK))


def _chunk_objs(name, chunks, mats, C, mask, **kw):
    out = []
    for k, key in enumerate(sorted(chunks, key=str)):
        nm = f'{name}.{k:03d}'
        out.append(obj(nm, chunks[key].to_mesh(nm, mats, mask=mask), C, **kw))
    return out


def build_road_pv(C, M, gz):
    """FU_road_pv: 뚝섬로 가운데 태양광 띠(y −43…−41, x −260…420, 횡단보도 · 교차로에서 끊김). 노면 + PV_DZ, 가로 3 줄(가운데 볼록
    노면을 따른다) × 세로 마디(_stations). 면마다 UV 를 그 면 시작 타일로 당겨 둔다(양자화 범위 ≤ 6 장)."""
    chunks = {}
    ys = (PV_Y[0], (PV_Y[0] + PV_Y[1]) / 2, PV_Y[1])
    zf = lambda x, y: _road_top(gz, x, y, PV_STEP / 2, 0.5) + (PV_DZ if _inside_x(x) else PV_DZ_FAR)
    for a, b in _spans(*PV_X, ROAD_GAPS_X):
        xs = _stations(a, b, PV_STEP)
        for x0, x1 in zip(xs, xs[1:]):
            u0 = math.floor(x0 / PV_TILE[0])
            mb = chunks.setdefault(_chunk_key((x0 + x1) / 2), MB())
            for y0, y1 in zip(ys, ys[1:]):
                P = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
                mb.face([(x, y, zf(x, y)) for x, y in P], 0, [(x / PV_TILE[0] - u0, (y - PV_Y[0]) / PV_TILE[1]) for x, y in P])
    return _chunk_objs('FU_road_pv', chunks, [M['road_pv']], C, lambda co: (0.0, 0.35, 0.95), surface='metal', nw_motif='smart_road')


def build_road_led(C, M, gz):
    """FU_road_led: 청록 발광선(폭 RLED_W 0.18, 노면 + RLED_DZ) — 뚝섬로 4 줄 · 동쪽 골목 2 줄 · 북쪽 이면도로 2 줄. emissive(보행은 통과).
    연석 안쪽 0.25 m 선(뚝섬로 양쪽 · 골목 · 이면도로)은 측구가 빗물받이마다 패여 5 m 마디면 마디 사이 높은 곳을 따라 최대 10 cm 떴다
    (수정 1회차, 웹 수직 광선 검사) → CURB_STEP 마디 · ±CURB_STEP/2 둘레만 본다. 띠 가장자리 두 줄은 5 m 그대로."""
    chunks = {}; h = RLED_W / 2

    def zf(x, y, st):                                             # x 를 따라가는 선
        return _road_top(gz, x, y, st / 2, 0.05) + RLED_DZ

    def zfy(x, y, st):                                            # y 를 따라가는 선(골목)
        return _road_top(gz, x, y, 0.05, st / 2) + RLED_DZ

    def along_x(key, y, a, b, st):
        xs = _stations(a, b, st)
        for x0, x1 in zip(xs, xs[1:]):
            mb = chunks.setdefault(key((x0 + x1) / 2), MB())
            mb.face([(x0, y - h, zf(x0, y - h, st)), (x1, y - h, zf(x1, y - h, st)), (x1, y + h, zf(x1, y + h, st)),
                     (x0, y + h, zf(x0, y + h, st))], 0)
    for y in RLED_TT_Y:
        st = CURB_STEP if y in (RLED_TT_Y[0], RLED_TT_Y[1]) else STEP_IN
        for a, b in _spans(*PV_X, ROAD_GAPS_X):
            along_x(_chunk_key, y, a, b, st)
    for x in RLED_AL[0]:                                          # 골목: y 를 따라
        for a, b in RLED_AL[1]:
            k = max(1, int(math.ceil((b - a) / CURB_STEP)))
            for j in range(k):
                y0, y1 = a + (b - a) * j / k, a + (b - a) * (j + 1) / k
                mb = chunks.setdefault(('al', int(math.floor((y0 + y1) / 2 / RIBBON_CHUNK))), MB())
                mb.face([(x + h, y0, zfy(x + h, y0, CURB_STEP)), (x + h, y1, zfy(x + h, y1, CURB_STEP)),
                         (x - h, y1, zfy(x - h, y1, CURB_STEP)), (x - h, y0, zfy(x - h, y0, CURB_STEP))], 0)
    for y in RLED_NR[0]:                                          # 북쪽 이면도로: x 를 따라
        for a, b in RLED_NR[1]:
            along_x(lambda xm: ('nr', int(math.floor(xm / RIBBON_CHUNK))), y, a, b, CURB_STEP)
    return _chunk_objs('FU_road_led', chunks, [M['road_led']], C, lambda co: (0.0, 0.5, 1.0), surface='emissive', night=True,
                       nw_motif='smart_road')


def kiosk_glass_mesh(M):
    """투명 키오스크(로컬, 원점 = 발판 가운데 바닥): 기존 FU_kiosk 형태(화면 0.9 × 1.8, 바닥에서 0.3 m)에서 가운데 몸통을 걷어
    양쪽 기둥 · 위 LED 덮개 · 아래 띠만 남기고, 화면 자리에 유리 판 한 장(NWF_kiosk_glass: UI 키오스크 칸 발광 + 알파 0.55, 양면)."""
    mb = MB()
    AL, LED, GL = 0, 1, 2
    mb.box((-0.14, -0.56, -0.05), (0.14, 0.56, 0.06), AL, faces='xXyYZ')                    # 발판
    for s in (-1, 1):                                                                       # 양쪽 기둥
        ya, yb = sorted((s * 0.45, s * 0.52))
        mb.box((-0.06, ya, 0.06), (0.06, yb, 2.2), AL, faces='xXyY')
    mb.box((-0.06, -0.45, 0.06), (0.06, 0.45, 0.28), AL, faces='xXZ')                        # 아래 띠(화면 밑)
    mb.box((-0.1, -0.53, 2.2), (0.1, 0.53, 2.27), LED, faces='xXyYzZ')                       # 위 덮개(흰 LED)
    u0, v0, u1, v1 = UI['kiosk']
    mb.face([(0.0, 0.45, 0.3), (0.0, -0.45, 0.3), (0.0, -0.45, 2.1), (0.0, 0.45, 2.1)], GL, [(u0, v0), (u1, v0), (u1, v1), (u0, v1)])
    return mb.to_mesh('FU_kiosk_glass', [M['alu'], M['led_white'], M['kiosk_glass']],
                      mask=lambda co: (0.0, 0.3, 0.55 + 0.45 * smoothstep(0, 1.0, co[2])))


def umbrella_set_mesh(M):
    """카페 테라스 한 벌(로컬, 원점 = 파라솔 기둥 바닥): 8 각 파라솔(반지름 1.4, 꼭대기 2.4, 천 #F2EFE6, 아래면 · 늘어진 단 포함),
    둥근 탁자(r 0.4, 높이 0.74, 받침 원판), 의자 3(좌판 · 등판 + 썰매 다리, 탁자를 본다). 재질은 알루 · 파라솔 천 둘뿐(탁자 상판 · 의자도
    같은 크림색 천 재질) — 모바일 그리기 예산(≤ 180)에서 테라스가 더하는 그리기를 1 로 줄인다(티크는 벤치만 쓰고 벤치는 모바일에서 숨긴다)."""
    mb = MB()
    AL, CLOTH = 0, 1
    TOP = CLOTH
    n, R, zr, zt = 8, 1.4, 2.08, 2.4
    mb.cyl((0, 0, 0.0), (0, 0, zt + 0.08), 0.025, 0.025, 6, AL, caps=(False, True))           # 기둥
    rim = [(R * math.cos(2 * math.pi * i / n + math.pi / 8), R * math.sin(2 * math.pi * i / n + math.pi / 8), zr) for i in range(n)]
    for i in range(n):
        a, b = rim[i], rim[(i + 1) % n]
        mb.face([a, b, (0, 0, zt)], CLOTH, [(0.5, 0.5)] * 3)                                   # 윗면
        mb.face([b, a, (0, 0, zt - 0.04)], CLOTH, [(0.5, 0.5)] * 3)                            # 아랫면
        mb.face([(a[0], a[1], zr - 0.14), (b[0], b[1], zr - 0.14), b, a], CLOTH, [(0.5, 0.5)] * 4)   # 늘어진 단(바깥)
        mb.face([b, a, (a[0], a[1], zr - 0.14), (b[0], b[1], zr - 0.14)], CLOTH, [(0.5, 0.5)] * 4)   # 늘어진 단(안)
    mb.cyl((0, 0, 0.71), (0, 0, 0.75), 0.4, 0.4, 10, TOP)                                     # 탁자 상판
    mb.cyl((0, 0, 0.0), (0, 0, 0.03), 0.26, 0.24, 8, AL, caps=(False, True))                  # 받침
    for k in range(3):
        a = math.radians(90 + 120 * k)
        mb.T = Matrix.Translation((0.78 * math.cos(a), 0.78 * math.sin(a), 0.0)) @ Matrix.Rotation(a, 4, 'Z')
        mb.box((-0.21, -0.21, 0.43), (0.21, 0.21, 0.47), CLOTH, faces='xXyYzZ')               # 좌판(로컬 −x = 탁자 쪽)
        mb.box((0.19, -0.21, 0.47), (0.22, 0.21, 0.86), CLOTH, faces='xXyYZ')                 # 등판(바깥)
        for s in (-1, 1):
            mb.box((-0.2, s * 0.2 - 0.012, 0.0), (0.2, s * 0.2 + 0.012, 0.43), AL, faces='xXyY')   # 썰매 다리
        mb.T = Matrix.Identity(4)
    return mb.to_mesh('FU_terrace', [M['alu'], M['parasol']],
                      mask=lambda co: (0.0, 0.3, 0.6 + 0.4 * smoothstep(0.0, 1.0, co[2])))


def bench_set_mesh(M):
    """거리 벤치 + 화분(로컬, 원점 = 벤치 가운데 바닥, 길이 = x): 흰 콘크리트 받침 2 위 나무 좌판 1.6 × 0.5(높이 0.45), +x 끝에
    0.6 × 0.6 × 0.5 화분(윗면 NW_meadow)."""
    mb = MB()
    CONC, WOOD, MEAD = 0, 1, 2
    for x in (-0.6, 0.45):
        mb.box((x - 0.08, -0.22, 0.0), (x + 0.08, 0.22, 0.4), CONC, faces='xXyY')
    mb.box((-0.8, -0.25, 0.4), (0.65, 0.25, 0.46), WOOD, faces='xXyYzZ')
    mb.box((0.65, -0.3, 0.0), (1.25, 0.3, 0.5), CONC, faces='xXyYZ', fmat={'Z': MEAD})
    return mb.to_mesh('FU_bench', [M['white_conc'], M['teak'], M['meadow']], mask=lambda co: (0.0, 0.3, 0.6 + 0.4 * smoothstep(0.0, 0.5, co[2])))


def bot_mesh(M):
    """배송로봇(로컬, 앞 = +x, 원점 = 바닥 가운데): 흰 몸통 0.7 × 0.55 × 0.6(바닥 틈 0.1, 윗모서리 0.1 를 두 마디로 둥글게),
    몸통 둘레 청록 띠(발광), 앞면 작은 상태 화면, 바퀴 6(반지름 0.1)."""
    b = BOT; mb = MB()
    WH, CY, BK, UIm = 0, 1, 2, 3
    hx, hy, z0, z1, r = b['L'] / 2, b['W'] / 2, b['clear'], b['clear'] + b['H'], b['r']
    def ring(z, d):
        return [(hx - d, -hy + d, z), (hx - d, hy - d, z), (-hx + d, hy - d, z), (-hx + d, -hy + d, z)]
    lv = [ring(z0, 0.0), ring(z1 - r, 0.0)] + [ring(z1 - r + r * math.sin(t), r * (1 - math.cos(t))) for t in (math.pi / 4, math.pi / 2)]
    for A, B in zip(lv, lv[1:]):
        for i in range(4):
            j = (i + 1) % 4
            mb.face([A[i], A[j], B[j], B[i]], WH, [(0.5, 0.5)] * 4)
    mb.face(lv[-1], WH, [(0.5, 0.5)] * 4)
    mb.face(list(reversed(lv[0])), BK, [(0.5, 0.5)] * 4)
    zb0, zb1 = z0 + 0.3, z0 + 0.35                                 # 청록 띠(몸통보다 4 mm 밖)
    band = [ring(zb0, -0.004), ring(zb1, -0.004)]
    for i in range(4):
        j = (i + 1) % 4
        mb.face([band[0][i], band[0][j], band[1][j], band[1][i]], CY, [(0.5, 0.5)] * 4)
    u0, v0, u1, v1 = UI['taxi']
    mb.face([(hx + 0.005, -0.18, z0 + 0.4), (hx + 0.005, 0.18, z0 + 0.4), (hx + 0.005, 0.18, z0 + 0.52), (hx + 0.005, -0.18, z0 + 0.52)], UIm,
            [(u0, v0), (u0 + (u1 - u0) * 0.4, v0), (u0 + (u1 - u0) * 0.4, v1), (u0, v1)])
    for wx in (-0.25, 0.0, 0.25):
        for s in (-1, 1):
            mb.cyl((wx, s * (hy - 0.02), b['wheel']), (wx, s * (hy + 0.04), b['wheel']), b['wheel'], b['wheel'], 8, BK, caps=(False, True))
    return mover_atlas(mb.to_mesh('FU_bot', [M['train_white'], M['led_cyan'], M['black'], M['ui']], smooth=True, sharp=40,
                                  mask=lambda co: (0.0, 0.3, 0.6 + 0.4 * smoothstep(0.0, 0.6, co[2]))), M)


def _obstacles():
    """free_spot 이 모르는 기존 거리 소품의 바닥 사각형(x0, y0, x1, y1): 가로등 · 신호 · 볼라드 · 화분 · 휴지통 · 오토바이 · 벤치 ·
    조경석 · 정류장 · 키오스크 · EV · 홀로그램 · 스카이브리지 기둥 · 나무 줄기 · 입간판."""
    out = []
    for o in bpy.data.objects:
        if o.type != 'MESH' or not o.name.startswith(AVOID_PREFIX):
            continue
        if o.name.startswith(TRUNKS):
            x, y = o.matrix_world.translation.xy
            out.append((x - 0.5, y - 0.5, x + 0.5, y + 0.5)); continue
        P = [o.matrix_world @ Vector(c) for c in o.bound_box]
        xs = [p.x for p in P]; ys = [p.y for p in P]
        if max(xs) - min(xs) > 8.0 or max(ys) - min(ys) > 8.0:
            continue
        out.append((min(xs), min(ys), max(xs), max(ys)))
    import present
    out += [(x - 0.4, y - 0.4, x + 0.4, y + 0.4) for x, y, _ in present.AFRAME_SIGNS]     # 입간판은 한 객체로 합쳐져 이름으로 못 찾는다
    return out


def _overlap(a, b, gap):
    return a[0] - gap < b[2] and b[0] - gap < a[2] and a[1] - gap < b[3] and b[1] - gap < a[3]


def place_spots(label, cands, r, tall, half, taken):
    """§4.3 배치: present.free_spot(x, y, r, tall) + 뚝섬로 북측 보도는 북쪽 끝 y ≤ ROBOT_PROP_Y + 배송로봇 길 · 기존 소품 · 이미 놓은
    새 소품과 겹치지 않음(0.3 m) + 공원 안은 산책로 · 물길 · 웅덩이에서 떨어짐. 못 지나면 ±3 m(0.25 m 격자) 안 가장 가까운 점, 없으면 뺀다."""
    import present
    G = present.G
    obst = _obstacles()
    out = []
    for (x, y) in cands:
        def ok(a, b):
            if not present.free_spot(a, b, r, tall=tall):
                return False
            fp = (a - half[0], b - half[1], a + half[0], b + half[1])
            if TT[1] < b < TT[1] + 6.0 and fp[3] > present.ROBOT_PROP_Y + 1e-9:
                return False
            if _overlap(fp, present.BOT1_LANE, BOT_LANE_GAP) or any(_overlap(fp, q, 0.3) for q in obst + taken):   # 뚝섬로 북측 길은 ROBOT_PROP_Y
                return False
            lx0, ly0, lx1, ly1 = G.LOT
            if lx0 < a < lx1 and ly0 < b < ly1:
                dp, dc, dw, de = present._park_d(a, b)
                if dp < G.PARK_PATH_W / 2 + max(half) + 0.3 or dc < 0.8 + max(half) or dw < max(half) + 0.4:
                    return False
            return True
        res = present._nearest_ok(x, y, ok)
        p = None if res is None else (round(res[1], 2), round(res[2], 2))
        out.append(((x, y), p))
        if p is not None:
            taken.append((p[0] - half[0], p[1] - half[1], p[0] + half[0], p[1] + half[1]))
    print(label, out)
    return out


def build_smart_street(C, M, gz):
    """태양광 띠 · 발광선 · 투명 키오스크 · 카페 테라스 · 벤치 · 배송로봇(Task 10)."""
    out = build_road_pv(C, M, gz) + build_road_led(C, M, gz)
    taken = []
    rows = {}
    km = kiosk_glass_mesh(M)
    rows['kiosk'] = place_spots('kiosk_glass', KIOSK_GLASS, 0.6, True, KIOSK_HALF, taken)
    for i, p in enumerate(p for _, p in rows['kiosk'] if p is not None):
        out.append(obj(f'FU_kiosk_glass.{i}', km, C, (p[0], p[1], gz.z(*p, 0.0)), 0.0, surface='metal', night=True, nw_motif='smart_kiosk',
                       nw_solid=1))
    tm = umbrella_set_mesh(M)
    rows['terrace'] = place_spots('terrace', TERRACES, 1.6, True, TERRACE_HALF, taken)
    for i, p in enumerate(p for _, p in rows['terrace'] if p is not None):
        out.append(obj(f'FU_terrace.{i}', tm, C, (p[0], p[1], gz.z(*p, 0.0)), math.radians(22.5 * (i % 3)), surface='metal',   # 'metal': 알루가 기존 버킷에 합쳐진다
                       nw_motif='cafe_terrace'))
    bm = bench_set_mesh(M)
    rows['bench'] = place_spots('bench', STREET_BENCHES, 1.0, False, BENCH_HALF, taken)
    for i, p in enumerate(p for _, p in rows['bench'] if p is not None):
        out.append(obj(f'FU_bench.{i}', bm, C, (p[0], p[1], gz.z(*p, 0.0)), 0.0, surface='wall', nw_motif='street_bench'))
    # 배송로봇 3: 각자 단일 사용자 메시(이동체). 사본마다 AO 를 조금씩 달리 써서 dedup · instance 가 이름을 지우지 않게 한다
    me = bot_mesh(M)
    bots = []
    import present
    for i, (nm, rid, p0, p1) in enumerate(BOT_STARTS):
        if p0 is None:
            p0, p1 = present.PARK_PATH[0], present.PARK_PATH[1]
        rz = math.atan2(p1[1] - p0[1], p1[0] - p0[0])
        m2 = me.copy(); m2.name = f'FU_bot_{i}'
        k = 1.0 - 0.03 * i
        lib.write_mask_values(m2, [(0.0, 0.3, k * (0.6 + 0.4 * smoothstep(0.0, 0.6, v.co.z))) for v in m2.vertices])
        bots.append(obj(nm, m2, C, (p0[0], p0[1], gz.z(p0[0], p0[1], 0.0)), rz, surface='metal', night=True, nw_motif='delivery_bot',
                        nw_route=rid))
    bpy.data.meshes.remove(me)
    _assert_unique(bots, '배송로봇')
    out += bots
    tris = lambda me: sum(len(p.vertices) - 2 for p in me.polygons)
    agg = {}
    for o in out:
        key = o.name.split('.')[0] if o.name.startswith('FU_road_') else o.data.name
        agg[key] = agg.get(key, 0) + (tris(o.data) if (o.name.startswith('FU_road_') or key not in agg) else 0)
    print('smart street tris', agg, 'objects', len(out), 'ribbon chunks', sum(o.name.startswith('FU_road_') for o in out))
    print('smart street spots', rows)
    return out


# ═════════════════════════════ (6) 드론 ═════════════════════════════
def sec_drone_mesh(M):
    """보안 드론(독자 형태): 납작한 원반 몸체 Ø0.9 + 덕트 로터 고리 4 + 아래 서치라이트 짐벌. 삼각 몸체가 아니다."""
    mb = MB()
    mb.cyl((0, 0, -0.06), (0, 0, 0.06), 0.36, 0.3, 20, 0)
    mb.cyl((0, 0, 0.06), (0, 0, 0.1), 0.3, 0.16, 20, 0)
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        cx, cy = 0.5 * math.cos(a), 0.5 * math.sin(a)
        mb.cyl((cx * 0.6, cy * 0.6, 0.0), (cx, cy, 0.0), 0.025, 0.025, 6, 1, caps=(False, False))
        for t in range(12):                                         # 덕트 고리(관 12 마디)
            a0 = 2 * math.pi * t / 12; a1 = 2 * math.pi * (t + 1) / 12
            mb.cyl((cx + 0.17 * math.cos(a0), cy + 0.17 * math.sin(a0), 0.0), (cx + 0.17 * math.cos(a1), cy + 0.17 * math.sin(a1), 0.0),
                   0.03, 0.03, 6, 1, caps=(False, False))
        mb.cyl((cx, cy, -0.005), (cx, cy, 0.005), 0.15, 0.15, 12, 1)  # 회전면(흐릿한 원판)
    mb.cyl((0.12, 0, -0.06), (0.12, 0, -0.16), 0.07, 0.07, 10, 1)       # 짐벌
    mb.cyl((0.12, 0, -0.16), (0.2, 0, -0.24), 0.08, 0.09, 12, 1, caps=(True, False))
    mb.cyl((0.2, 0, -0.24), (0.205, 0, -0.245), 0.09, 0.09, 12, 2)       # 렌즈(흰 LED)
    mb.cyl((0, 0, -0.065), (0, 0, -0.075), 0.25, 0.25, 20, 3, caps=(False, True))   # 아래 상태 고리(파랑)
    return mover_atlas(mb.to_mesh('FU_drone_sec', [M['pearl'], M['black'], M['led_white'], M['led_blue']], smooth=True, sharp=40,
                                  mask=lambda co: (0.0, 0.15, 1.0)), M)


def del_drone_mesh(M):
    """배송 드론: X 프레임 4로터 + 몸체 + 0.6 m 아래 가는 줄 4 개에 매단 골판지 소포 0.5 × 0.4 × 0.35(드론과 한 메시, 골판지 칸)."""
    mb = MB()
    mb.box((-0.16, -0.11, -0.05), (0.16, 0.11, 0.07), 0)
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        cx, cy = 0.33 * math.cos(a), 0.33 * math.sin(a)
        mb.cyl((0, 0, 0.03), (cx, cy, 0.03), 0.018, 0.018, 6, 1, caps=(False, False))
        mb.cyl((cx, cy, 0.0), (cx, cy, 0.07), 0.03, 0.03, 8, 1)
        mb.cyl((cx, cy, 0.075), (cx, cy, 0.08), 0.15, 0.15, 12, 1)
    zt = -0.05 - PARCEL_DROP; hx, hy, hz = PARCEL[0] / 2, PARCEL[1] / 2, PARCEL[2]
    mb.box((-hx, -hy, zt - hz), (hx, hy, zt), 3, rect=UI['card'])                  # 소포
    for sx in (-1, 1):                                                              # 줄 4(몸체 아래 모서리 → 소포 윗면 모서리)
        for sy in (-1, 1):
            mb.cyl((sx * 0.12, sy * 0.08, -0.05), (sx * (hx - 0.02), sy * (hy - 0.02), zt), 0.008, 0.008, 3, 1, caps=(False, False))
    mb.cyl((0, 0, -0.05), (0, 0, -0.06), 0.06, 0.06, 10, 2, caps=(False, True))   # 청록 상태등
    return mover_atlas(mb.to_mesh('FU_drone_del', [M['pearl'], M['black'], M['led_teal'], M['ui']], smooth=True, sharp=40,
                                  mask=lambda co: (0.0, 0.15, 1.0)), M)


def beam_mesh(length=15.0, r=2.6, n=20):
    """서치라이트 원뿔(holo): 꼭짓점 = 원점, −z 쪽으로 열린다. UV v = 0(꼭짓점) → 1(끝)."""
    mb = MB()
    for i in range(n):
        a0 = 2 * math.pi * i / n; a1 = 2 * math.pi * (i + 1) / n
        p0 = (r * math.cos(a0), r * math.sin(a0), -length); p1 = (r * math.cos(a1), r * math.sin(a1), -length)
        mb.face([(0, 0, 0), p0, p1], 0, [(i / n, 0.0), (i / n, 1.0), ((i + 1) / n, 1.0)])
    return mb


def build_drones(C, M):
    out = []
    sm = sec_drone_mesh(M)
    p0 = DRONE_PATHS['sec'][0]; p1 = DRONE_PATHS['sec'][1]
    yaw = math.atan2(p1[1] - p0[1], p1[0] - p0[0])
    d = obj('FU_drone_sec', sm, C, p0, yaw, surface='metal', night=True, nw_motif='drone', nw_route='sec',
            nw_speed=DRONE_SPEED['sec'], nw_kind='security')
    out.append(d)
    # 서치라이트 원뿔: 드론 렌즈에서 앞아래로(지면까지 ~17 m), 원뿔 끝 반지름 2.6 m
    ln = (Vector(BEAM_AIM) - Vector(p0)).length
    bm = beam_mesh(ln, ln * math.tan(math.radians(8.5))).to_mesh('FU_drone_sec_beam', [M['beam']], mask=lambda co: (0.0, 0.0, 1.0))
    beam = obj('FU_drone_sec_beam', bm, C, surface='holo', night=True, nw_motif='drone')
    # 드론의 월드 행렬은 위치 · 방위로 직접 만든다: 새 객체의 d.matrix_world 는 depsgraph 갱신 전이라 단위 행렬이다(Task 11 전에는
    # 그래서 원뿔이 드론 둘레에서 거의 수평으로 옆을 비췄다). 웹은 원뿔의 수평 방위만 진행 방향에 맞추고 숙임(앞아래)은 이대로 쓴다
    dmw = Matrix.LocRotScale(Vector(p0), Euler((0.0, 0.0, yaw)), None)
    lens = dmw @ Vector((0.2, 0.0, -0.245))
    aim = Vector(BEAM_AIM) - lens
    world = Matrix.LocRotScale(lens, aim.to_track_quat('-Z', 'Y'), None)
    beam.parent = d
    beam.matrix_parent_inverse = Matrix.Identity(4)
    beam.matrix_basis = dmw.inverted() @ world                   # 원뿔 축(−z)이 BEAM_AIM 을 향한다(드론을 따라 움직인다)
    beam['nw_length'] = aim.length
    out.append(beam)
    # 배송 드론 d1 … d5: 각자 단일 사용자 메시(이동체). 사본마다 AO 를 조금씩 달리 써서 dedup · instance 가 이름을 지우지 않게 한다
    dm = del_drone_mesh(M)
    dels = []
    for i, key in enumerate(k for k in DRONE_PATHS if k != 'sec'):
        p0 = DRONE_PATHS[key][0]; p1 = DRONE_PATHS[key][1]
        yaw = math.atan2(p1[1] - p0[1], p1[0] - p0[0])
        m2 = dm.copy(); m2.name = f'FU_drone_{key}'
        lib.write_mask_values(m2, [(0.0, 0.15, 1.0 - 0.03 * i)] * len(m2.vertices))
        dels.append(obj(f'FU_drone_{key}', m2, C, p0, yaw, surface='metal', night=True, nw_motif='drone', nw_route=key,
                        nw_speed=DRONE_SPEED[key], nw_kind='delivery'))
    bpy.data.meshes.remove(dm)
    _assert_unique(dels, '배송 드론')
    return out + dels


# ═════════════════════════════ 보조: 스마트 헤드·EV 기둥·진열창 디스플레이·홀로그램 ═════════════════════════════
def smart_head_mesh(M):
    """옛 코브라헤드(가로등 로컬 x 2.1~2.85, z 8.98~9.22)를 감싸는 얇은 LED 등기구 + 팔 위 센서 포드 + 기둥 6 m 소형 기지국 함.
    로컬 좌표 = 가로등 원형(PR_streetlight)과 같다 → 기둥 객체의 행렬을 그대로 쓴다."""
    mb = MB()
    mb.box((1.92, -0.25, 8.92), (3.02, 0.25, 9.3), 0, faces='xXyYZ')            # 새 등기구 껍데기(옛 헤드를 덮는다)
    mb.box((1.97, -0.21, 8.9), (2.97, 0.21, 8.92), 1, faces='z')                # 아래 LED 면(차가운 흰색)
    mb.box((1.92, -0.25, 8.9), (3.02, 0.25, 8.92), 0, faces='xXyY')
    mb.cyl((1.1, 0, 9.12), (1.1, 0, 9.44), 0.085, 0.07, 12, 0)                  # 센서 포드
    mb.cyl((1.1, 0, 9.44), (1.1, 0, 9.5), 0.07, 0.03, 12, 0)
    mb.cyl((1.1, 0, 9.3), (1.1, 0, 9.33), 0.088, 0.088, 12, 2, caps=(False, False))   # 청록 상태 고리
    mb.cyl((1.1, 0, 9.12), (1.18, 0, 9.06), 0.035, 0.035, 8, 0)                 # 카메라 눈
    mb.box((0.12, -0.13, 5.6), (0.36, 0.13, 6.25), 0)                           # 기지국 함(기둥에 덧댐)
    mb.box((0.05, -0.04, 5.75), (0.12, 0.04, 6.1), 0)
    mb.box((0.1, -0.02, 0.3), (0.14, 0.02, 5.6), 0)                             # 기둥 따라 내려가는 케이블 덮개
    return mb.to_mesh('FU_smart_head', [M['alu'], M['led_white'], M['led_teal']], smooth=True, sharp=40,
                      mask=lambda co: (0.0, 0.2, 0.6 + 0.4 * smoothstep(0.0, 1.0, co[2])))


def ev_post_mesh(M):
    """EV 충전 기둥(0.35 × 0.25 × 1.4): 진주색 몸체, 위 LED 고리, 화면, 케이블 고리."""
    mb = MB()
    mb.box((-0.175, -0.125, 0.0), (0.175, 0.125, 1.3), 0)
    mb.cyl((0, 0, 1.3), (0, 0, 1.36), 0.15, 0.15, 16, 0)
    mb.cyl((0, 0, 1.36), (0, 0, 1.4), 0.15, 0.15, 16, 1, caps=(False, True))   # LED 고리(청록)
    mb.box((-0.12, -0.128, 0.85), (0.12, -0.125, 1.15), 2, faces='y', rect=UI['ev'])
    mb.box((-0.19, -0.13, -0.04), (0.19, 0.13, 0.05), 3)
    pts = [(0.17, -0.02, 0.9), (0.26, -0.05, 0.6), (0.27, -0.06, 0.3), (0.2, -0.05, 0.25), (0.18, -0.02, 0.55)]
    mb.tube(pts, 0.018, 6, 3)
    return mb.to_mesh('FU_ev_post', [M['pearl'], M['led_teal'], M['ui'], M['black']], smooth=True, sharp=40,
                      mask=lambda co: (0.0, 0.3, 0.55 + 0.45 * smoothstep(0, 0.8, co[2])))


def build_helpers(C, M, gz):
    out = []
    hm = smart_head_mesh(M)
    for i, pn in enumerate(SMART_POLES):
        p = bpy.data.objects.get(pn)
        if p is None:
            print('스마트 헤드: 기둥 없음', pn); continue
        out.append(obj(f'FU_smart_head.{i}', hm, C, surface='metal', night=True, mw=p.matrix_world.copy(), nw_motif='smart_light',
                       nw_pole=pn))
    em = ev_post_mesh(M)
    for i, (x, y) in enumerate(EV_POSTS):
        z = gz.z(x, y, 0.0)
        out.append(obj(f'FU_ev_post.{i}', em, C, (x, y, z), math.pi, surface='metal', night=True, nw_motif='ev_post'))
    # 진열창 투명 디스플레이(유리 바로 바깥 2 mm 판)
    d = DISPLAY; mb = MB()
    x0, x1 = d['x'] - d['w'] / 2, d['x'] + d['w'] / 2
    mb.quad((x1, d['y'] + 0.06, d['z0']), (x0, d['y'] + 0.06, d['z0']), (x0, d['y'] + 0.06, d['z0'] + d['h']),
            (x1, d['y'] + 0.06, d['z0'] + d['h']), 0, (UI['display'][2], UI['display'][1], UI['display'][0], UI['display'][3]))
    me = mb.to_mesh('FU_shop_display', [M['display']], mask=lambda co: (0.0, 0.0, 1.0))
    out.append(obj('FU_shop_display', me, C, surface='emissive', night=True, nw_motif='shop_display'))
    # 홀로그램 광고(한 곳): 바닥 투사기 + 교차 판 2장(높이 2.8 m) — holo
    hx, hy = HOLO; hz = gz.z(hx, hy, 0.0)
    mb = MB()
    mb.cyl((hx, hy, hz), (hx, hy, hz + 0.12), 0.42, 0.4, 20, 0)
    mb.cyl((hx, hy, hz + 0.12), (hx, hy, hz + 0.14), 0.3, 0.3, 20, 1, caps=(False, True))
    me = mb.to_mesh('FU_holo_base', [M['alu'], M['led_teal']], smooth=True, sharp=40, mask=lambda co: (0.0, 0.4, 0.8))
    out.append(obj('FU_holo_base', me, C, surface='metal', night=True, nw_motif='holo_ad'))
    mb = MB(); w2 = 0.75; h0 = hz + 0.25; h1 = hz + 3.05
    for a in (math.radians(20), math.radians(110)):
        c, s = math.cos(a) * w2, math.sin(a) * w2
        mb.quad((hx - c, hy - s, h0), (hx + c, hy + s, h0), (hx + c, hy + s, h1), (hx - c, hy - s, h1), 0, UI['holo'])
    me = mb.to_mesh('FU_holo_ad', [M['holo']], mask=lambda co: (0.0, 0.0, 1.0))
    out.append(obj('FU_holo_ad', me, C, surface='holo', night=True, nw_motif='holo_ad'))
    return out


# ═════════════════════════════ (7) 신축 타워 4동 · 풍력 · 광장(§4.2, Task 8) ═════════════════════════════
TOWER_MATS = ('curtain', 'rail', 'white', 'meadow', 'pv', 'leaves')
CUR, RAIL, WHITE, MEAD, PVM, LEAF = range(len(TOWER_MATS))
# 화분 상자 옆면 · 태양광 뒷판 · 테라스 바닥도 흰 알루미늄 한 재질: 웹은 (재질, 표면)마다 묶음 하나(그림자 패스까지 2 콜)라 재질 수 = 그리기 수
BED = GALV = DECK = WHITE


def _rrect(cx, cy, hx, hy, r=0.0, n=6):
    """반시계(위에서 볼 때) 둥근 사각형 꼭짓점. r ≤ 0 이면 직사각형 4점, 아니면 모서리마다 n 마디(4·(n + 1)점).
    r > 0 이고 n 이 같으면 점 수와 순서가 같아, 들인 둘레와 짝지어 테(띠 · 화단 · 소핏)를 만들 수 있다."""
    if r <= 1e-6:
        return [(cx - hx, cy - hy), (cx + hx, cy - hy), (cx + hx, cy + hy), (cx - hx, cy + hy)]
    pts = []
    for sx, sy, a0 in ((1, -1, -90.0), (1, 1, 0.0), (-1, 1, 90.0), (-1, -1, 180.0)):
        ox, oy = cx + sx * (hx - r), cy + sy * (hy - r)
        for j in range(n + 1):
            a = math.radians(a0 + 90.0 * j / n)
            pts.append((ox + r * math.cos(a), oy + r * math.sin(a)))
    return pts


def _box_rect(x0, y0, x1, y1):
    return _rrect((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2)


class _TB:
    """타워 한 동의 메시 조립(월드 좌표, 재질 번호 = TOWER_MATS). 커튼월 UV: u = u0 + 둘레 누적 m / CW_TILE[0], v = z / CW_TILE[1](12 · 8)."""

    def __init__(self, seed, meadow_tile):
        self.mb = MB(); self.rnd = random.Random(seed); self.mt = meadow_tile

    def walls(self, poly, z0, z1, u0=0.0):
        """닫힌 둘레(반시계) 외벽: 변마다 quad. z0 = 0 이면 1층(0 … FLOOR_GF)은 로비 유리(아틀라스 한 층의 시야 유리를 늘인다)."""
        su, sv = CW_TILE
        spans = [(z0, z1, z0 / sv, z1 / sv)]
        if z0 <= 0.0 < FLOOR_GF < z1:
            spans = [(z0, FLOOR_GF, 0.42 / sv, 3.66 / sv), (FLOOR_GF, z1, FLOOR_GF / sv, z1 / sv)]
        s = u0
        for i, p in enumerate(poly):
            q = poly[(i + 1) % len(poly)]
            L = math.dist(p, q)
            for za, zb, va, vb in spans:
                self.mb.quad((p[0], p[1], za), (q[0], q[1], za), (q[0], q[1], zb), (p[0], p[1], zb), CUR, (s / su, va, (s + L) / su, vb))
            s += L

    def cap(self, poly, z, m, down=False, scale=1.0):
        """수평 다각형 면(볼록). UV = (x, y) / scale(m)."""
        P = poly[::-1] if down else poly
        self.mb.face([(x, y, z) for x, y in P], m, [(x / scale, y / scale) for x, y in P])

    def ring(self, outer, inner, z, m, down=False, scale=1.0):
        """같은 점 수의 두 둘레 사이 수평 테."""
        n = len(outer)
        for i in range(n):
            j = (i + 1) % n
            P = [outer[i], outer[j], inner[j], inner[i]]
            if down:
                P = P[::-1]
            self.mb.face([(x, y, z) for x, y in P], m, [(x / scale, y / scale) for x, y in P])

    def side(self, poly, z0, z1, m, inward=False, closed=True):
        """둘레를 따라 선 옆면(바깥을 본다, inward=True 면 안쪽을 본다). UV = m."""
        s = 0.0
        for i in range(len(poly) if closed else len(poly) - 1):
            p, q = poly[i], poly[(i + 1) % len(poly)]
            L = math.dist(p, q)
            a, b = (q, p) if inward else (p, q)
            self.mb.quad((a[0], a[1], z0), (b[0], b[1], z0), (b[0], b[1], z1), (a[0], a[1], z1), m, (s, z0, s + L, z1))
            s += L

    def rail(self, path, z, closed=True):
        """유리 난간(RAIL_H, 양면 재질 한 장) + 흰 난간대(윗면 · 바깥면 띠). path 는 반시계 방향(바깥 = 진행 방향 오른쪽)."""
        zt = z + RAIL_H; w = 0.035
        for i in range(len(path) if closed else len(path) - 1):
            p, q = path[i], path[(i + 1) % len(path)]
            L = math.dist(p, q)
            nx, ny = (q[1] - p[1]) / L, -(q[0] - p[0]) / L
            self.mb.quad((p[0], p[1], z), (q[0], q[1], z), (q[0], q[1], zt - 0.05), (p[0], p[1], zt - 0.05), RAIL)
            po, qo = (p[0] + nx * w, p[1] + ny * w), (q[0] + nx * w, q[1] + ny * w)
            pi, qi = (p[0] - nx * w, p[1] - ny * w), (q[0] - nx * w, q[1] - ny * w)
            self.mb.quad((po[0], po[1], zt), (qo[0], qo[1], zt), (qi[0], qi[1], zt), (pi[0], pi[1], zt), WHITE)
            self.mb.quad((po[0], po[1], zt - 0.06), (qo[0], qo[1], zt - 0.06), (qo[0], qo[1], zt), (po[0], po[1], zt), WHITE)

    def shrub(self, x, y, z, s=1.0):
        """관목 카드: 엇갈린 세로 quad 2 장(폭 1.5·s, 높이 1.0·s), NW_zelkova_leaves 아틀라스 잎 덩이 4종 중 하나."""
        a = self.rnd.uniform(0.0, math.pi)
        q = self.rnd.randrange(4); cu, cv = (q % 2) * 0.5, (q // 2) * 0.5
        w, h = 0.75 * s, 1.0 * s
        for b in (a, a + math.pi / 2):
            c, sn = math.cos(b) * w, math.sin(b) * w
            self.mb.quad((x - c, y - sn, z - 0.08), (x + c, y + sn, z - 0.08), (x + c, y + sn, z + h), (x - c, y - sn, z + h), LEAF,
                         (cu + 0.006, cv + 0.006, cu + 0.494, cv + 0.494))

    def hang(self, path, z, drop, step, out=0.06, closed=True):
        """늘어진 잎 카드: 둘레(반시계)를 따라 바깥 out m 에 세운 quad 한 장씩(z + 0.3 → z − drop·0.75 … 1.2, 폭 1.4·step 으로
        겹친다). 화단 가장자리에서 넘쳐 흐르는 덩굴 — 멀리서 테라스 · 띠가 초록 선으로 읽힌다."""
        acc = self.rnd.uniform(0.0, step)
        for i in range(len(path) if closed else len(path) - 1):
            p, q = path[i], path[(i + 1) % len(path)]
            L = math.dist(p, q)
            tx, ty = (q[0] - p[0]) / L, (q[1] - p[1]) / L
            nx, ny = ty * out, -tx * out
            while acc < L:
                w = step * 0.7 * self.rnd.uniform(0.9, 1.15)
                a0, a1 = max(0.0, acc - w), min(L, acc + w)
                pa = (p[0] + tx * a0 + nx, p[1] + ty * a0 + ny); pb = (p[0] + tx * a1 + nx, p[1] + ty * a1 + ny)
                zb = z - drop * self.rnd.uniform(0.75, 1.2)
                k = self.rnd.randrange(4); cu, cv = (k % 2) * 0.5, (k // 2) * 0.5
                self.mb.quad((pa[0], pa[1], zb), (pb[0], pb[1], zb), (pb[0], pb[1], z + 0.3), (pa[0], pa[1], z + 0.3), LEAF,
                             (cu + 0.006, cv + 0.006, cu + 0.494, cv + 0.494))
                acc += step * self.rnd.uniform(0.8, 1.2)
            acc -= L

    def shrubs_along(self, path, z, step, s=1.0, closed=True):
        acc = self.rnd.uniform(0.0, step)
        for i in range(len(path) if closed else len(path) - 1):
            p, q = path[i], path[(i + 1) % len(path)]
            L = math.dist(p, q)
            while acc < L:
                t = acc / L
                self.shrub(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, z, s * self.rnd.uniform(0.8, 1.15))
                acc += step * self.rnd.uniform(0.7, 1.3)
            acc -= L

    def bed_ring(self, fp, z, inset, step=0.0, s=1.0):
        """테 화단: fp(d) = d 만큼 들인 둘레. 바깥 inset … inset + BED_W, 높이 BED_H, 옆 흰 상자(BED), 윗면 NW_meadow."""
        out, inn = fp(inset), fp(inset + BED_W)
        self.ring(out, inn, z + BED_H, MEAD, scale=self.mt)
        self.side(out, z, z + BED_H, BED)
        self.side(inn, z, z + BED_H, BED, inward=True)
        if step:
            self.shrubs_along(fp(inset + BED_W / 2), z + BED_H, step, s=s)

    def bed_rect(self, x0, y0, x1, y1, z, shrubs=0):
        mt = self.mt
        self.mb.box((x0, y0, z), (x1, y1, z + BED_H), BED, faces='xXyYZ', fmat={'Z': MEAD},
                    rect={f: ((x0 / mt, y0 / mt, x1 / mt, y1 / mt) if f == 'Z' else (0, 0, 1, 1)) for f in 'xXyYZ'})
        for _ in range(shrubs):
            self.shrub(self.rnd.uniform(x0 + 0.4, x1 - 0.4), self.rnd.uniform(y0 + 0.3, y1 - 0.3), z + BED_H, self.rnd.uniform(0.9, 1.3))

    def pv_rows(self, x0, y0, x1, y1, z, P):
        """평지붕 태양광 줄(present.py Task 6 규칙): 남쪽 PV_TILT°, 경사 1.7 m, 줄 간격 PV_ROW_PITCH, 레일 PV_RAIL. 줄 = 윗면 + 뒷판."""
        pw, ph, tilt, pitch, rail = P
        tl = math.radians(tilt); dh, dz = ph * math.cos(tl), ph * math.sin(tl)
        zl = z + rail; zh = zl + dz
        n = int((y1 - y0 - dh) / pitch) + 1
        off = (y1 - y0 - (dh + (n - 1) * pitch)) / 2
        k = int((x1 - x0) / pw + 1e-6); xa = x0 + ((x1 - x0) - k * pw) / 2; xb = xa + k * pw
        for r in range(n):
            ya = y0 + off + r * pitch; yb = ya + dh
            self.mb.quad((xa, ya, zl), (xb, ya, zl), (xb, yb, zh), (xa, yb, zh), PVM, (0, 0, k, 1))
            self.mb.quad((xb, yb, z), (xa, yb, z), (xa, yb, zh), (xb, yb, zh), GALV)
        return n * k

    def canopy(self, cx, ys, yn, z, P, nu=20, nv=3, clear=2.05):
        """태양광 캐노피: 기둥 4 + 남쪽 PV_TILT° 로 기운 판(윗면 NW_pv 패널 nu × nv, 흰 밑면 · 테). 낮은 끝 z + clear."""
        pw, ph, tilt = P[0], P[1], P[2]
        tl = math.radians(tilt)
        W = nu * pw; D = nv * ph * math.cos(tl); R = nv * ph * math.sin(tl); th = 0.08
        xa, xb = cx - W / 2, cx + W / 2
        ya = (ys + yn) / 2 - D / 2; yb = ya + D
        zl = z + clear; zh = zl + R
        mb = self.mb
        mb.quad((xa, ya, zl), (xb, ya, zl), (xb, yb, zh), (xa, yb, zh), PVM, (0, 0, nu, nv))
        mb.quad((xa, yb, zh - th), (xb, yb, zh - th), (xb, ya, zl - th), (xa, ya, zl - th), WHITE)
        mb.quad((xa, ya, zl - th), (xb, ya, zl - th), (xb, ya, zl), (xa, ya, zl), WHITE)
        mb.quad((xb, yb, zh - th), (xa, yb, zh - th), (xa, yb, zh), (xb, yb, zh), WHITE)
        mb.quad((xb, ya, zl - th), (xb, yb, zh - th), (xb, yb, zh), (xb, ya, zl), WHITE)
        mb.quad((xa, yb, zh - th), (xa, ya, zl - th), (xa, ya, zl), (xa, yb, zh), WHITE)
        for px in (xa + 0.6, xb - 0.6):
            for py in (ya + 0.6, yb - 0.6):
                zt = zl + (py - ya) / D * R - th
                mb.box((px - 0.1, py - 0.1, z), (px + 0.1, py + 0.1, zt), WHITE, faces='xXyY')
        return zh


def _tower_setback(t, tb, P):
    """T1: 직육면체, setbacks 높이마다 사방 inset 셋백 테라스(유리 난간 · 가장자리 화단 · 관목 · 늘어진 잎). 옥상: 서쪽 절반 태양광 줄,
    동쪽 절반 풍력 3기(8 m 간격, 방위 150° 대각선 — 정면 200° 에서 서로 덜 가린다). → 풍력 자리"""
    cx, cy = t['c']; hx, hy = t['size'][0] / 2, t['size'][1] / 2; h = t['h']
    zs = (0.0,) + tuple(t['setbacks']) + (h,)
    tiers = [(hx - k * t['inset'], hy - k * t['inset']) for k in range(len(zs) - 1)]
    for k, (ax, ay) in enumerate(tiers):
        tb.walls(_rrect(cx, cy, ax, ay), zs[k], zs[k + 1], u0=0.37 * k)
    for k in range(1, len(tiers)):
        (ox, oy), (ix, iy) = tiers[k - 1], tiers[k]
        fp = lambda d, ox=ox, oy=oy: _rrect(cx, cy, ox - d, oy - d)
        tb.ring(fp(0.0), _rrect(cx, cy, ix, iy), zs[k], DECK)
        tb.rail(fp(0.08), zs[k])
        # 화단: 가장자리에서 BED_IN 들이되, 2 m 테라스에서는 벽 앞 0.6 m 통로를 남기도록 줄인다(→ 난간 뒤 0.2 m)
        tb.bed_ring(fp, zs[k], max(0.15, min(BED_IN, (ox - ix) - BED_W - 0.6)), step=1.3, s=1.3)
        tb.hang(fp(-0.06), zs[k], 1.4, 1.3)
    ax, ay = tiers[-1]
    tb.cap(_rrect(cx, cy, ax, ay), h, DECK)
    tb.rail(_rrect(cx, cy, ax - 0.08, ay - 0.08), h)
    tb.pv_rows(cx - ax + 1.2, cy - ay + 1.2, cx - 0.8, cy + ay - 1.2, h, P)
    a = math.radians(150.0); ex = cx + ax / 2
    return [(ex + math.sin(a) * 8.0 * j, cy + math.cos(a) * 8.0 * j, h) for j in (-1, 0, 1)][:t['turbines']]


def _tower_rounded(t, tb, P):
    """T2: 모서리 반지름 r 둥근 사각, 3층(12 m)마다 발코니 식재 띠(깊이 0.6, 높이 0.5: 흰 띠 · 흰 소핏 · 윗면 NW_meadow + 관목 · 늘어진 잎),
    옥상정원(유리 난간 · 테 화단 · 가운데 화단 2)."""
    cx, cy = t['c']; hx, hy = t['size'][0] / 2, t['size'][1] / 2; r = t['r']; h = t['h']
    fp = lambda d: _rrect(cx, cy, hx - d, hy - d, max(r - d, 0.05))
    tb.walls(fp(0.0), 0.0, h)
    step = 4.0 * t['green_every']
    z = step
    while z < h - 6.0:
        band, face = fp(-0.6), fp(0.0)
        tb.ring(band, face, z + BED_H, MEAD, scale=tb.mt)
        tb.ring(band, face, z, WHITE, down=True)
        tb.side(band, z, z + BED_H, WHITE)
        tb.shrubs_along(fp(-0.3), z + BED_H, 2.2, s=0.95)
        tb.hang(fp(-0.66), z + BED_H, 1.3, 1.4)
        z += step
    tb.cap(fp(0.0), h, DECK)
    tb.rail(fp(0.08), h)
    tb.bed_ring(fp, h, BED_IN, step=1.6, s=1.2)
    for sy in (-1, 1):
        tb.bed_rect(cx - 7.0, cy + sy * 3.0 - 0.6, cx + 7.0, cy + sy * 3.0 + 0.6, h, shrubs=7)
    return []


def _tower_stepped(t, tb, P):
    """T3: 3단 계단식(steps = (z0, z1, 북쪽 비율)). 계단 윗면은 정원(남 · 동 · 서 열린 변 유리 난간, ㄷ자 화단 + 가운데 화단 줄, 계단 끝 늘어진 잎),
    맨 위는 유리 난간 + 태양광 캐노피(기둥 4 + 남쪽 10° 판, 높은 끝 h + 2.94) + 양 끝 화단."""
    cx, cy = t['c']; hx, hy = t['size'][0] / 2, t['size'][1] / 2
    x0, x1, yN = cx - hx, cx + hx, cy + hy
    tiers = [(z0, z1, yN - 2 * hy * f) for z0, z1, f in t['steps']]
    for k, (z0, z1, ys) in enumerate(tiers):
        tb.walls(_box_rect(x0, ys, x1, yN), z0, z1, u0=0.37 * k)
    e, b0, b1 = 0.08, BED_IN, BED_IN + BED_W
    for k in range(len(tiers) - 1):
        z = tiers[k][1]; ys, yn = tiers[k][2], tiers[k + 1][2]
        tb.cap(_box_rect(x0, ys, x1, yn), z, DECK)
        tb.rail([(x0 + e, yn), (x0 + e, ys + e), (x1 - e, ys + e), (x1 - e, yn)], z, closed=False)
        tb.bed_rect(x0 + b0, ys + b0, x1 - b0, ys + b1, z, shrubs=22)
        tb.bed_rect(x0 + b0, ys + b1, x0 + b1, yn - 0.3, z, shrubs=4)
        tb.bed_rect(x1 - b1, ys + b1, x1 - b0, yn - 0.3, z, shrubs=4)
        ym = (ys + b1 + yn) / 2
        tb.bed_rect(x0 + 6.0, ym - 0.6, x1 - 6.0, ym + 0.6, z, shrubs=14)
        tb.hang([(x0 - 0.06, yn), (x0 - 0.06, ys - 0.06), (x1 + 0.06, ys - 0.06), (x1 + 0.06, yn)], z, 1.4, 1.3, out=0.0, closed=False)
    z = t['h']; ys = tiers[-1][2]
    tb.cap(_box_rect(x0, ys, x1, yN), z, DECK)
    tb.rail(_box_rect(x0 + e, ys + e, x1 - e, yN - e), z)
    tb.canopy(cx, ys, yN, z, P)
    tb.bed_rect(x0 + 1.0, ys + 1.2, x0 + 7.0, yN - 1.2, z, shrubs=6)
    tb.bed_rect(x1 - 7.0, ys + 1.2, x1 - 1.0, yN - 1.2, z, shrubs=6)
    return []


def _tower_crown(t, tb, P):
    """T4: 직육면체, 꼭대기 crown m 는 크라운 정원 — 바닥(h − crown)에 유리 난간 · 테 화단 · 화단 2 줄, 둘레는 흰 크라운 틀
    (모서리 기둥 4 + 변마다 5 m 간격 핀 5 + 꼭대기 테 보, 윗면 = h) · 크라운 바닥 가장자리에서 늘어진 잎. 풍력 2기는 크라운 바닥에. → 풍력 자리"""
    cx, cy = t['c']; hx, hy = t['size'][0] / 2, t['size'][1] / 2; h = t['h']; zc = h - t['crown']
    fp = lambda d: _rrect(cx, cy, hx - d, hy - d)
    tb.walls(fp(0.0), 0.0, zc)
    tb.cap(fp(0.0), zc, DECK)
    x0, y0, x1, y1 = cx - hx, cy - hy, cx + hx, cy + hy
    zt, d, f = h - 0.6, 0.6, 0.15
    for px, py in ((x0, y0), (x1 - d, y0), (x1 - d, y1 - d), (x0, y1 - d)):
        tb.mb.box((px, py, zc), (px + d, py + d, zt), WHITE, faces='xXyY')
    for k in range(1, 6):
        x = x0 + 2 * hx * k / 6; y = y0 + 2 * hy * k / 6
        tb.mb.box((x - f, y0, zc), (x + f, y0 + d, zt), WHITE, faces='xXyY')
        tb.mb.box((x - f, y1 - d, zc), (x + f, y1, zt), WHITE, faces='xXyY')
        tb.mb.box((x0, y - f, zc), (x0 + d, y + f, zt), WHITE, faces='xXyY')
        tb.mb.box((x1 - d, y - f, zc), (x1, y + f, zt), WHITE, faces='xXyY')
    tb.ring(fp(0.0), fp(1.0), h, WHITE)
    tb.ring(fp(0.0), fp(1.0), zt, WHITE, down=True)
    tb.side(fp(0.0), zt, h, WHITE)
    tb.side(fp(1.0), zt, h, WHITE, inward=True)
    tb.rail(fp(0.7), zc)
    tb.bed_ring(fp, zc, BED_IN, step=1.5, s=1.3)
    tb.hang(fp(-0.06), zc, 1.6, 1.4)
    for sy in (-1, 1):
        tb.bed_rect(cx - 9.0, cy + sy * 9.0 - 0.6, cx + 9.0, cy + sy * 9.0 + 0.6, zc, shrubs=12)
    return [(cx - 6.0, cy + 1.5, zc), (cx + 6.0, cy + 1.5, zc)][:t['turbines']]


TOWER_FORMS = {'setback': _tower_setback, 'rounded': _tower_rounded, 'stepped': _tower_stepped, 'crown': _tower_crown}


def build_towers(C, M):
    """신축 타워 4동(TOWERS): 객체 FU_tower_<id>(nw_solid=1, nw_surface='glass', 커튼월 NWF_curtain + 테라스 · 옥상 설비). → (객체, 풍력 자리)"""
    import present
    P = (present.PV_PANEL[0], present.PV_PANEL[1], present.PV_TILT, present.PV_ROW_PITCH, present.PV_RAIL)
    mats = [M[k] for k in TOWER_MATS]
    out, spots, tris = [], [], {}
    for i, t in enumerate(TOWERS):
        tb = _TB(800 + i, present.MEADOW_TILE)
        spots += TOWER_FORMS[t['form']](t, tb, P)
        nm = f'FU_tower_{t["id"]}'
        me = tb.mb.to_mesh(nm, mats, mask=lambda co: (0.0, 0.2, 0.65 + 0.35 * smoothstep(0.0, 2.5, co[2])))
        out.append(obj(nm, me, C, surface='glass', night=True, nw_solid=1, nw_motif='tower', nw_tower=t['id']))
        tris[t['id']] = sum(len(p.vertices) - 2 for p in me.polygons)
    print('towers tris', tris, 'turbine spots', [tuple(round(v, 2) for v in s) for s in spots])
    return out, spots


def turbine_mesh(M):
    """소형 수평축 풍력(독자 형태, 글자 · 상표 없음). 마스트와 회전자를 따로 돌려준다(둘 다 흰 알루미늄 한 재질).
    마스트: 원점 = 바닥. 받침판 + 원통(r 0.18, 높이 8 m) + 나셀 1.2 × 0.6 × 0.6(앞 = 로컬 +x) + 꼬리 붐 · 꼬리 날개(뒤 −x).
    회전자: 원점 = 허브, 회전축 = 로컬 +x. 날개 3장(길이 2.8 m, 뿌리 → 끝으로 좁아지고 비틀린 다이아몬드 단면) + 원뿔 허브."""
    mb = MB()
    mb.box((-0.35, -0.35, 0.0), (0.35, 0.35, 0.1), 0, faces='xXyYZ')
    mb.cyl((0, 0, 0.1), (0, 0, MAST_H), MAST_R, MAST_R, 10, 0, caps=(False, False))
    L, Wn, Hn = NACELLE; xf = HUB[0] - 0.15                          # 나셀 앞면 = 허브 뒷면
    mb.box((xf - L, -Wn / 2, MAST_H), (xf, Wn / 2, MAST_H + Hn), 0)
    mb.box((xf - L - 1.0, -0.03, MAST_H + Hn / 2 - 0.05), (xf - L, 0.03, MAST_H + Hn / 2 + 0.05), 0, faces='yYzZ')
    mb.box((xf - L - 1.8, -0.015, MAST_H + 0.05), (xf - L - 0.9, 0.015, MAST_H + 1.0), 0)
    mast = mb.to_mesh('FU_turbine_mast', [M['white']], mask=lambda co: (0.0, 0.2, 1.0))
    rb = MB()
    rb.cyl((-0.15, 0, 0), (0.12, 0, 0), 0.17, 0.17, 10, 0, caps=(True, False))
    rb.cyl((0.12, 0, 0), (0.45, 0, 0), 0.17, 0.02, 10, 0, caps=(False, True))
    secs = ((0.15, 0.18, 0.07, 24.0), (0.95, 0.30, 0.05, 13.0), (0.15 + BLADE_L, 0.09, 0.015, 4.0))   # (반지름, 시위, 두께, 피치°)
    X = Vector((1.0, 0.0, 0.0))
    for k in range(3):
        th = math.pi / 2 + 2 * math.pi * k / 3
        er = Vector((0.0, math.cos(th), math.sin(th))); et = Vector((0.0, -math.sin(th), math.cos(th)))
        rings = []
        for r, c, d, pitch in secs:
            b = math.radians(pitch)
            ec = et * math.cos(b) + X * math.sin(b)
            en = er.cross(ec).normalized()
            o = er * r
            rings.append([o + ec * (c / 2), o + en * (d / 2), o - ec * (c / 2), o - en * (d / 2)])
        for ra, rb_ in zip(rings, rings[1:]):
            for i in range(4):
                j = (i + 1) % 4
                rb.face([ra[i], ra[j], rb_[j], rb_[i]], 0)
        rb.face(rings[-1], 0)
    rotor = rb.to_mesh('FU_turbine_rotor', [M['white']], mask=lambda co: (0.0, 0.2, 1.0))
    return mast, rotor


def _sphere_dirs(n=32):
    """단위구 위 고른 방향 n 개(골든 나선)."""
    ga = math.pi * (3.0 - math.sqrt(5.0)); out = []
    for i in range(n):
        z = 1.0 - 2.0 * (i + 0.5) / n; r = math.sqrt(max(0.0, 1.0 - z * z))
        out.append(Vector((math.cos(ga * i) * r, math.sin(ga * i) * r, z)))
    return out


def _ray_ao(sc, dg, o, mw, reach=12.0):
    """객체 o(월드 행렬 mw)의 정점 AO 를 장면 광선(정점 법선 쪽 반구, reach m)으로 구해 nw_mask B 에 쓴다. → B 값 목록"""
    me = o.data; nm = mw.to_3x3(); D = _sphere_dirs(); vals = []
    for v in me.vertices:
        p = mw @ v.co; nrm = (nm @ v.normal).normalized()
        use = [d for d in D if d.dot(nrm) > 0.05]
        hit = sum(1 for d in use if sc.ray_cast(dg, p + nrm * 0.02, d, distance=reach)[0])
        occ = hit / max(1, len(use))
        vals.append((0.0, 0.2, (1.0 - 0.6 * occ) * (0.7 + 0.3 * smoothstep(0.0, 1.0, v.co.z))))
    lib.write_mask_values(me, vals)
    return [round(b, 4) for _, _, b in vals]


def build_turbines(C, M, sc, spots):
    """풍력 터빈(spots = 마스트 바닥 자리). 모두 방위 TURBINE_AZ 를 본다(rotation_euler.z, 로컬 +x → (sin az, cos az)).
    - 회전자 FU_turbine_rotor.<n>: 원점 = 허브, 축 = 로컬 +x. 기체마다 날개 위상(37°·n)을 메시에 구운 단일 사용자 메시 —
      모양이 같으면 gltf-transform 의 dedup 이 사본을 한 메시로 합치고 instance 가 노드 이름을 지운다(Task 11 이 이름으로 돌린다).
    - 마스트 FU_turbine_mast.<n>: 움직이지 않지만 역시 단일 사용자 메시. 자리마다 장면 광선으로 구운 AO(nw_mask B)가 달라
      dedup 되지 않는다(인스턴싱되면 모바일이 5 기 → 1 기로 솎아 회전자만 떠 보인다)."""
    mast, rotor = turbine_mesh(M)
    az = math.radians(TURBINE_AZ); rz = math.atan2(math.cos(az), math.sin(az))
    R = Matrix.Rotation(rz, 4, 'Z')
    masts = []; out = []
    for i, (x, y, z) in enumerate(spots):
        me = mast.copy(); me.name = f'FU_turbine_mast.{i}'
        mo = obj(f'FU_turbine_mast.{i}', me, C, (x, y, z), rz, surface='metal', nw_motif='wind_turbine')
        masts.append((mo, Matrix.Translation((x, y, z)) @ R))
        rm = rotor.copy(); rm.name = f'FU_turbine_rotor.{i}'
        rm.transform(Matrix.Rotation(math.radians(37.0 * i), 4, 'X'))
        hub = Vector((x, y, z)) + (R @ Vector((HUB[0], 0.0, MAST_H + HUB[1])))
        out.append(obj(f'FU_turbine_rotor.{i}', rm, C, tuple(hub), rz, surface='metal', nw_motif='wind_turbine',
                       nw_spin_axis='+X', nw_turbine=i))
    bpy.data.meshes.remove(mast); bpy.data.meshes.remove(rotor)
    dg = sc.view_layers[0].depsgraph; dg.update()
    sig = [tuple(_ray_ao(sc, dg, mo, mw)) for mo, mw in masts]
    rsig = [tuple(round(c, 5) for v in o.data.vertices for c in v.co) for o in out]
    ok_r, ok_m = len(set(rsig)) == len(rsig), len(set(sig)) == len(sig)
    print('turbines', len(spots), 'rotor distinct', ok_r, 'mast AO distinct', ok_m, 'mean AO', [round(sum(s) / len(s), 3) for s in sig])
    if not (ok_r and ok_m):
        raise RuntimeError('풍력: 같은 모양의 회전자(위상) 또는 마스트(AO) 메시가 있다 — gltf-transform dedup · instance 가 합쳐 '
                           '노드 이름 FU_turbine_* 를 지운다(Task 11 이 이름으로 돌린다)')
    return [m for m, _ in masts] + out


PLAZA_LAWNS = [(4.0, 180.0, 14.0, 210.0), (0.0, 226.0, 10.0, 246.0), (50.0, 186.0, 62.0, 236.0),        # T2 블록(T2 x 16…44, y 214…242)
               (78.0, 209.5, 104.0, 218.5), (132.0, 184.0, 141.0, 244.0),                             # T3 · T1 사이 띠, 동쪽 띠
               (170.0, -26.0, 184.0, 14.0), (194.0, 26.0, 226.0, 44.0)]                               # T4 서쪽 · 북쪽
PLAZA_TREES = [(24.0, 184.0), (56.0, 244.0), (9.0, 214.0), (9.0, 238.0), (40.0, 186.0),            # T2 블록
               (84.0, 184.0), (88.0, 214.0), (114.0, 214.0), (136.5, 214.0), (118.0, 232.0),       # T3 · T1(T1 x 76…108, y 221…247)
               (178.0, 34.0)]                                  # 느티나무 711 tris × 11 + 판(광장 ≤ 10k)


def build_plaza(C, M):
    """타워 둘레 광장(PLAZAS): 보도블록 판(NW_pavers, UV = m, 윗면 PLAZA_Z) + 연석 옆면, 잔디 화단(PLAZA_LAWNS, NW_meadow, 높이 0.35),
    느티나무(PLAZA_TREES, present 의 PR_zelkova_a 메시 사본 FU_plaza_zelkova 를 링크 복제). 장면 밖이라 nw_solid 는 없다. 표면은 'wall' —
    웹 'ground' 는 정점 마스크 A(= 1)를 웅덩이로 읽어 비 오는 날 광장 전체가 거울이 된다."""
    import present
    mt = present.MEADOW_TILE
    mb = MB(); z = PLAZA_Z
    for x0, y0, x1, y1 in PLAZAS:
        mb.face([(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], 0, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)])
        P = _box_rect(x0, y0, x1, y1); s = 0.0
        for i in range(4):
            p, q = P[i], P[(i + 1) % 4]; L = math.dist(p, q)
            mb.quad((p[0], p[1], -0.05), (q[0], q[1], -0.05), (q[0], q[1], z), (p[0], p[1], z), 0, (s, 0.0, s + L, z))
            s += L
    for x0, y0, x1, y1 in PLAZA_LAWNS:
        mb.box((x0, y0, z), (x1, y1, z + 0.35), 0, faces='xXyYZ', fmat={'Z': 1},
               rect={f: ((x0 / mt, y0 / mt, x1 / mt, y1 / mt) if f == 'Z' else (0, 0, 1, 1)) for f in 'xXyYZ'})
    me = mb.to_mesh('FU_plaza', [M['deck'], M['meadow']], mask=lambda co: (0.0, 0.3, 0.85))
    out = [obj('FU_plaza', me, C, surface='wall', nw_motif='tower_plaza')]
    src = bpy.data.objects.get('PR_zelkova_a.000')
    if src is None:
        raise RuntimeError('광장 느티나무: present 의 PR_zelkova_a.000 이 없다(present.build() 를 먼저)')
    # present 원형 메시를 그대로 쓰면 다음 --rebuild 의 present.build() 가 "아직 쓰이는 메시"로 멈춘다 → 사본 한 벌을 링크 복제
    tm = bpy.data.meshes.get('FU_plaza_zelkova')
    if tm is not None:
        bpy.data.meshes.remove(tm)
    tm = src.data.copy(); tm.name = 'FU_plaza_zelkova'; tm[TAG] = 1
    for k, m in enumerate(tm.materials):              # 200 m 밖 줄기: NW_bark(텍스처 3장 ≈ 0.3 MB)를 단색으로
        if m is not None and m.name == 'NW_bark':
            tm.materials[k] = M['bark']
    rnd = random.Random(2048)
    for i, (x, y) in enumerate(PLAZA_TREES):
        o = obj(f'FU_plaza_tree.{i:02d}', tm, C, (x, y, z - 0.05), rnd.uniform(0, 2 * math.pi), surface='foliage')
        s = rnd.uniform(0.92, 1.08); o.scale = (s, s, s)
        out.append(o)
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in out)
    print('plaza', len(PLAZAS), 'lawns', len(PLAZA_LAWNS), 'trees', len(out) - 1, 'tris', tris)
    return out


# ═════════════════════════════ (8) 2호선 유리 튜브 · 열차 · 스카이브리지(§4.2, Task 9) ═════════════════════════════
TUBE_RIB_PITCH = 5.5                    # 리브 간격(m): 구간마다 이 값 이하의 같은 간격으로 나눠 양 끝(원경 외피 이음 · 승강장 끝)에도 리브
TUBE_RIB = (0.2, 0.3)                   # 리브 단면: x 폭 · 꺾은선 법선 깊이(꺾은선이 가운데 — 유리가 리브 한가운데를 지난다)
TUBE_STRINGER = 0.1                     # 꺾임점 6 곳을 잇는 세로 띠(정사각 단면 변)
TUBE_LED = (14.95, 0.08, 0.03)          # 등줄기 LED: 아래면 z, 폭, 두께
TUBE_GLASS = ('#456F88', 0.55)          # 튜브 유리 색 · 알파(Task 12 조율, 전 #BFD8E6 · 0.22)
TUBE_PLANTERS = ((149.2, 150.3), (159.7, 160.8))   # 상판 바깥 화단 y(남 · 북). 상판 테두리(149.3 · 160.7, 턱 9.3)를 덮는다
TUBE_PLANTER_Z = (8.9, 9.6)             # 화단 상자 아래 · 윗면(NW_meadow)
VINE_DROP, VINE_W, VINE_COVER = 0.8, 1.0, 0.85  # 늘어진 덩굴 카드: 길이(윗면 아래), 폭, 덮는 비율(덩이마다 끊긴다). 모바일은 world.js 가 숨긴다
VINE_CELL = (0.5, 0.0)                  # NW_ivy 아틀라스 칸 (½, 0) = Task 5 의 '밀도 0.6' 칸(Task 8b 가 IVY_DENS 를 0.5 로 낮췄다)
TRAIN = dict(cars=4, L=17.0, W=2.9, H=3.4, gap=0.6, nose=2.2, ch=0.35, win=(1.2, 2.4), stripe=(0.98, 1.10), module=17.0 / 8)
TRAINS = [('FU_train_a', (-200.0, 152.6, 9.3)), ('FU_train_b', (240.0, 157.4, 9.3))]   # 원점 = 열차 가운데 바닥, 앞 = 로컬 +x
BRIDGES = [   # 상판 (x0, x1), (y0, y1), 윗면, 두께, 기둥 자리, 기둥 지름, 화단(6 m 마다)
    # SB1(Task 11b 수정 1회차): 골목 중간 V8 동면 ↔ E1d 서면. 옛 자리(y 112 … 115.2, B6 박공 ↔ B10)는 2041 골목 시점에서 승강장 튜브와
    # 같은 앙각(3.4 … 5.3°)에 걸려 튜브 · 열차를 가렸다 → 카메라에서 42 … 45 m 로 당겨 상판 밑이 앙각 9.1° 위로 오른다.
    # y 49.85 … 53.05 = E1d 4 층 발코니(y 47.05 … 49.65 · 56.95 … 59.55, 판 z 8.35 … 8.5) 사이 벽 — 상판이 x 76 벽까지 닿는다.
    # 윗면 9.35 = E1d 4 층 창(y 50.85 … 52.45) 창턱(9.36) 바로 아래: 그 창이 다리 출입구로 읽힌다. 밑면 8.9 는 V8 3 층 창 머리(8.85) 위라
    # V8 창을 막지 않고, 난간 꼭대기 10.47 ≈ V8 파라펫(10.4). 기둥은 두 벽의 창 사이 벽 앞: 서쪽 (65.4, 51.45) = V8 창 사이(50.6 … 52.3)
    # 가운데, V8 세로 간판(y 50.85 … 51.15, x ≤ 64.85) · 3 층 발코니(y 51.8 …, x ≤ 64.95)를 비키도록 벽에서 1.4 m.
    # 동쪽 (75.4, 50.25) = E1d 창 사이(49.15 … 50.85) — 4 층 발코니(… 49.65)와 0.4 m, 배송로봇 bot1 길(x 73.9)에서 1.3 m
    dict(id='SB1', x=(64.0, 76.0), y=(49.85, 53.05), top=9.35, th=0.45, cols=((65.4, 51.45), (75.4, 50.25)), d=0.45, beds=False),
    dict(id='SB2', x=(128.0, 131.2), y=(-60.0, -29.0), top=10.0, th=0.5, cols=((129.6, -33.6), (129.6, -54.2)), d=0.6, beds=True),
]
BRIDGE_BED = (1.2, 0.5, 0.45)           # SB2 화단: 길이(상판 방향) · 폭 · 높이
BRIDGE_BED_STEP = 6.0


def _offset_profile(P, d):
    """꺾은선 P[(y, z)] 를 바깥(진행 방향 오른쪽 = 남쪽 아래 → 꼭대기 → 북쪽 아래에서 바깥) 쪽으로 d 만큼 민 꺾은선(꺾임점은 이등분 마이터)."""
    out = []
    n = len(P)
    nrm = []
    for i in range(n - 1):
        (ya, za), (yb, zb) = P[i], P[i + 1]
        L = math.hypot(yb - ya, zb - za)
        nrm.append(((zb - za) / L * -1.0, (yb - ya) / L))      # 바깥 법선 = 진행 방향을 반시계 90° → (−dz, dy)
    for i in range(n):
        if i == 0:
            ny, nz = nrm[0]; k = 1.0
        elif i == n - 1:
            ny, nz = nrm[-1]; k = 1.0
        else:
            ay, az = nrm[i - 1]; by, bz = nrm[i]
            ny, nz = ay + by, az + bz; L = math.hypot(ny, nz); ny, nz = ny / L, nz / L
            k = 1.0 / max(0.5, ny * by + nz * bz)
        out.append((P[i][0] + ny * d * k, P[i][1] + nz * d * k))
    return out


def _tube_rib(mb, pin, pout, x0, x1, skip=()):
    """리브 하나: 안쪽 꺾은선 pin 과 바깥 꺾은선 pout 사이 띠를 x0 … x1 로 민다(변마다 안쪽 · 바깥 · −x · +x 면). skip = 건너뛸 변 번호."""
    for i in range(len(pin) - 1):
        if i in skip:
            continue
        a, b, c, d = pin[i], pin[i + 1], pout[i + 1], pout[i]
        mb.quad((x1, a[0], a[1]), (x0, a[0], a[1]), (x0, b[0], b[1]), (x1, b[0], b[1]), 0)     # 안쪽 면(튜브 안을 본다)
        mb.quad((x0, d[0], d[1]), (x1, d[0], d[1]), (x1, c[0], c[1]), (x0, c[0], c[1]), 0)     # 바깥 면
        mb.quad((x0, a[0], a[1]), (x0, d[0], d[1]), (x0, c[0], c[1]), (x0, b[0], b[1]), 0)     # −x 옆
        mb.quad((x1, d[0], d[1]), (x1, a[0], a[1]), (x1, b[0], b[1]), (x1, c[0], c[1]), 0)     # +x 옆


def _tube_ribs(P, xa, xb, solid_ends=False):
    """구간 xa … xb 의 리브(단면 P): TUBE_RIB_PITCH 이하 같은 간격으로 나눠 양 끝에도 리브. → (ribs, fine) 조립기.
    짝수 번째 리브 + 꺾임점 세로 띠 → ribs, 홀수 번째 → fine(모바일은 world.js 가 숨긴다 → 간격 두 배).
    solid_ends: 마지막 리브도 번호와 관계없이 ribs 에(승강장 구간 양 끝 = 단면이 바뀌는 끝 틀이라 모바일에서도 그린다)."""
    pin, pout = _offset_profile(P, -TUBE_RIB[1] / 2), _offset_profile(P, TUBE_RIB[1] / 2)
    hw = TUBE_RIB[0] / 2
    n = max(1, math.ceil((xb - xa) / TUBE_RIB_PITCH - 1e-6))
    ribs, fine = MB(), MB()
    for k in range(n + 1):
        x = xa + (xb - xa) * k / n
        x0, x1 = max(xa, x - hw), min(xb, x + hw)
        _tube_rib(ribs if k % 2 == 0 or (solid_ends and k == n) else fine, pin, pout, x0, x1)
    s = TUBE_STRINGER / 2
    for y, z in P[1:-1]:                                       # 꺾임점 세로 띠(바깥 면 · 안쪽 면 · 위 · 아래)
        ribs.box((xa, y - s, z - s), (xb, y + s, z + s), 0, faces='yYzZ')
    return ribs, fine


def _tube_glass(g, PG, xa, xb):
    """유리: 꺾은선 PG 의 변마다 xa … xb 한 장(리브가 판을 나눠 보이게 한다). 남쪽 아래 → 꼭대기 → 북쪽 아래 순서 = 바깥 법선."""
    sv = 0.0
    for (ya, za), (yb, zb) in zip(PG, PG[1:]):
        sl = math.hypot(yb - ya, zb - za)
        g.quad((xa, ya, za), (xb, ya, za), (xb, yb, zb), (xa, yb, zb), 0, (xa / 20.0, sv, xb / 20.0, sv + sl))
        sv += sl


def build_tube(C, M):
    """2호선 유리 튜브(§4.2): TUBE_SPANS 두 구간(서 w · 동 e)마다 리브 · 유리 · 화단(+ 늘어진 덩굴), 그 사이 승강장 구간(s, ST_X)은
    넓은 단면 리브 · 유리, 세 구간을 잇는 등줄기 LED 한 줄.
    - FU_tube_ribs_<w|s|e>(nw_solid=1): 리브 짝수 번째 + 꺾임점 세로 띠, FU_tube_ribs_fine_<w|s|e>: 리브 홀수 번째(모바일은 world.js 가 숨긴다 → 간격 두 배)
    - FU_tube_glass_<w|s|e>: 단면 7 변을 x 로 민 판(NWF_tube_glass, 양면 · TUBE_GLASS 알파 0.55). 그림자 · 정적 병합 제외는 world.js
    - FU_tube_planter_<w|e>: 상판 바깥 화단 상자(옆 NWF_white_concrete, 윗면 NW_meadow), FU_tube_planter_vines_<w|e>: 늘어진 덩굴 카드(NW_ivy)
    - 승강장 구간(Task 11b): TUBE_ST_PROFILE(±9.7 — 승강장 · 바깥 난간까지) 리브 · 유리 + 유리 받침 띠(승강장 끝 → 유리 바깥). 양 끝은
      단면이 바뀌므로 일반 단면 리브 고리(끝 틀)와 두 단면 사이를 막는 유리 끝벽을 둔다. 덩굴 화단은 없다(승강장이 상판 테두리를 덮는다)."""
    import present
    P = [(y + TUBE_Y, z) for y, z in TUBE_PROFILE]
    pin, pout = _offset_profile(P, -TUBE_RIB[1] / 2), _offset_profile(P, TUBE_RIB[1] / 2)
    hw = TUBE_RIB[0] / 2
    out, tris = [], {}
    led = MB()
    rnd = random.Random(2041)
    mt = present.MEADOW_TILE
    for key, (xa, xb) in zip(('w', 'e'), TUBE_SPANS):
        ribs, fine = _tube_ribs(P, xa, xb)
        me = ribs.to_mesh(f'FU_tube_ribs_{key}', [M['tube_steel']], mask=lambda co: (0.0, 0.15, 1.0))
        out.append(obj(f'FU_tube_ribs_{key}', me, C, surface='metal', nw_solid=1, nw_motif='tube'))
        me = fine.to_mesh(f'FU_tube_ribs_fine_{key}', [M['tube_steel']], mask=lambda co: (0.0, 0.15, 1.0))
        out.append(obj(f'FU_tube_ribs_fine_{key}', me, C, surface='metal', nw_motif='tube'))
        # 유리 아래 끝은 화단 윗면(9.6)부터: 그 아래는 화단 안쪽 면(y 150.3 · 159.7)과 같은 면이라 깊이 다툼이 난다
        PG = [(P[0][0], TUBE_PLANTER_Z[1])] + P[1:-1] + [(P[-1][0], TUBE_PLANTER_Z[1])]
        g = MB()
        _tube_glass(g, PG, xa, xb)
        me = g.to_mesh(f'FU_tube_glass_{key}', [M['tube_glass']], mask=lambda co: (0.0, 0.0, 1.0))
        out.append(obj(f'FU_tube_glass_{key}', me, C, surface='glass', nw_motif='tube'))
        # 등줄기 LED(꼭대기 안쪽): 아래 · 옆 · 위 면
        z0, w, t = TUBE_LED
        led.box((xa, TUBE_Y - w / 2, z0), (xb, TUBE_Y + w / 2, z0 + t), 0, faces='yYzZ')
        # 상판 바깥 화단 + 늘어진 덩굴 카드
        pl, vn = MB(), MB()
        za, zt = TUBE_PLANTER_Z
        for (y0, y1), out_y in zip(TUBE_PLANTERS, (TUBE_PLANTERS[0][0], TUBE_PLANTERS[1][1])):
            pl.box((xa, y0, za), (xb, y1, zt), 0, faces='xXyYzZ', fmat={'Z': 1},
                   rect={f: ((xa / mt, y0 / mt, xb / mt, y1 / mt) if f == 'Z' else (0, 0, (xb - xa) / 4.0, 1)) for f in 'xXyYzZ'})
            sg = -1.0 if out_y == y0 else 1.0                  # 바깥 방향(남 −y, 북 +y)
            x = xa + rnd.uniform(0.0, 1.0)
            while x < xb - 0.3:
                run = rnd.uniform(3.0, 9.0)                    # 덩이 길이 · 빈틈(덮는 비율 VINE_COVER)
                xe = min(xb, x + run)
                while x < xe - 0.3:
                    wv = min(VINE_W * rnd.uniform(0.8, 1.0), xe - x)
                    drop = VINE_DROP * rnd.uniform(0.75, 1.15)
                    yt = out_y + sg * 0.03; yb_ = out_y + sg * (0.03 + 0.12 * drop)   # 아래 끝이 조금 바깥으로 들린다
                    cu, cv = VINE_CELL; fl = rnd.random() < 0.5
                    us = 0.5 * wv / present.IVY_CELL                  # 아틀라스 칸 하나(½) = 1 m
                    u0, u1 = (cu + us - 0.003, cu + 0.003) if fl else (cu + 0.003, cu + us - 0.003)
                    vh = min(0.494, 0.5 * (drop + 0.12) / present.IVY_CELL)
                    q = [(x, yb_, zt - drop), (x + wv, yb_, zt - drop), (x + wv, yt, zt + 0.12), (x, yt, zt + 0.12)]
                    if sg > 0:
                        q = [q[1], q[0], q[3], q[2]]; u0, u1 = u1, u0
                    vn.quad(*q, 0, (u0, cv + 0.003, u1, cv + vh))
                    x += wv * rnd.uniform(0.85, 1.0)
                x = xe + run * (1.0 - VINE_COVER) / VINE_COVER * rnd.uniform(0.6, 1.4)
        me = pl.to_mesh(f'FU_tube_planter_{key}', [M['white_conc'], M['meadow']], mask=lambda co: (0.0, 0.3, 0.9))
        out.append(obj(f'FU_tube_planter_{key}', me, C, surface='wall', nw_motif='tube'))
        me = vn.to_mesh(f'FU_tube_planter_vines_{key}', [M['ivy']], mask=lambda co: (0.0, 0.2, 0.85))
        out.append(obj(f'FU_tube_planter_vines_{key}', me, C, surface='foliage', nw_motif='tube'))
    # ── 승강장 구간 s(Task 11b): 넓은 단면. 리브 간격 규칙은 같고, 양 끝 리브는 모바일에서도 그린다(끝 틀)
    xa, xb = ST_X
    Q = [(y + TUBE_Y, z) for y, z in TUBE_ST_PROFILE]
    ribs, fine = _tube_ribs(Q, xa, xb, solid_ends=True)
    sz0, sz1, si, so = TUBE_ST_SILL
    for sg in (-1.0, 1.0):                                     # 유리 받침 띠: 승강장 바깥 끝(±9.3) → 리브 바깥(±9.85) 너머, 윗면 = 유리 아래 끝
        y0, y1 = sorted((TUBE_Y + sg * si, TUBE_Y + sg * so))
        ribs.box((xa, y0, sz0), (xb, y1, sz1), 0)
    g = MB()
    _tube_glass(g, Q, xa, xb)
    # 양 끝(단면이 바뀌는 곳): 일반 단면 리브 고리를 승강장 쪽 반 폭(0.1 m)으로 — 서 · 동 구간 끝 리브와 붙어 한 리브 폭이 된다.
    # 꼭대기 변(3)은 넓은 단면 끝 리브의 평평한 꼭대기와 겹쳐 뺀다. 유리 끝벽은 끝 리브 폭 가운데(xm)에서 두 단면 사이 고리를 막는다:
    # 아래는 도상(present.TRACK_BED_Z) · 승강장 바닥(present.ST_FLOOR_Z)까지 내려 하늘이 새는 틈이 없다(승강장 판 끝면 x = xa · xb 와 겹치지 않는다)
    N, Wd = TUBE_PROFILE, TUBE_ST_PROFILE
    zb, zf = present.TRACK_BED_Z, present.ST_FLOOR_Z
    ye = VIA_RIM_Y0 - TUBE_Y                                       # 상판 테두리 끝 = 승강장 선로 쪽 끝(−5.7, VIA_RIM_Y0 = 테두리 포함 149.3)
    end_polys = [[(N[0][0], zb), (ye, zb), (ye, zf), (N[0][0], zf)],     # 남쪽 반(고가 중심 기준), 바깥 법선 −x 순서
                 [(N[0][0], zf), (Wd[0][0], zf), Wd[1], N[1]],
                 [N[1], Wd[1], Wd[2], N[2]],
                 [N[2], Wd[2], Wd[3], N[3]]]                         # N[3] … N[4] 꼭대기는 두 단면이 같은 z 15.0 → 막을 것이 없다
    for xe, sx in ((xa, -1.0), (xb, 1.0)):
        x0, x1 = (xe, xe + hw) if sx < 0 else (xe - hw, xe)
        _tube_rib(ribs, pin, pout, x0, x1, skip=(3,))
        xm = (x0 + x1) / 2
        for sg in (1.0, -1.0):                                 # 남(그대로) · 북(거울)
            for poly in end_polys:
                pts = [(xm, TUBE_Y + sg * y, z) for y, z in poly]
                if sx * sg > 0:                                # 동쪽 끝(+x 법선) 또는 북쪽 거울 → 순서를 뒤집어 바깥 법선을 맞춘다
                    pts.reverse()
                g.face(pts, 0, [(p[1] / 20.0, p[2]) for p in pts])
    me = ribs.to_mesh('FU_tube_ribs_s', [M['tube_steel']], mask=lambda co: (0.0, 0.15, 1.0))
    out.append(obj('FU_tube_ribs_s', me, C, surface='metal', nw_solid=1, nw_motif='tube'))
    me = fine.to_mesh('FU_tube_ribs_fine_s', [M['tube_steel']], mask=lambda co: (0.0, 0.15, 1.0))
    out.append(obj('FU_tube_ribs_fine_s', me, C, surface='metal', nw_motif='tube'))
    me = g.to_mesh('FU_tube_glass_s', [M['tube_glass']], mask=lambda co: (0.0, 0.0, 1.0))
    out.append(obj('FU_tube_glass_s', me, C, surface='glass', nw_motif='tube'))
    z0, w, t = TUBE_LED                                        # 등줄기 LED: 서 · 동 구간 사이를 이어 −300 … 420 한 줄
    led.box((xa, TUBE_Y - w / 2, z0), (xb, TUBE_Y + w / 2, z0 + t), 0, faces='yYzZ')
    me = led.to_mesh('FU_tube_led', [M['tube_led']], mask=lambda co: (0.0, 0.0, 1.0))
    out.append(obj('FU_tube_led', me, C, surface='emissive', night=True, nw_motif='tube'))
    for o in out:
        tris[o.name] = sum(len(p.vertices) - 2 for p in o.data.polygons)
    print('tube tris', tris)
    return out


def paint_train_window():
    """열차 창 띠(256 × 128, 가로 반복 = 창 모듈 TRAIN['module'] m, 세로 = 창 띠 1.2 m). 낮 알베도: 어두운 유리(위로 옅은 하늘 반사) +
    어두운 창 기둥 · 위아래 틀. 밤 발광: 유리 칸만 따뜻한 흰빛(기둥 · 틀 0)."""
    alb, emi = _train_window_arrays()
    a = lib.save_image('NWF_gen_train', alb, os.path.join(GEN, 'NWF_gen_train.png'), TAG)
    e = lib.save_image('NWF_gen_train_emit', emi, os.path.join(GEN, 'NWF_gen_train_emit.png'), TAG)
    return a, e


def _train_window_arrays():
    """paint_train_window 의 알베도 · 발광 배열(128 × 256 × 4). paint_mover 가 열차 창 띠로 베껴 쓴다."""
    W, H = 256, 128
    alb = _canvas(W, H, _hexs('#20262A')); emi = _canvas(W, H, np.zeros(3, np.float32))
    p0, p1 = int(W * 0.08), int(W * 0.92)                        # 창 기둥 = 양 끝 8 %
    q0, q1 = int(H * 0.1), int(H * 0.9)
    v = (np.arange(q1 - q0, dtype=np.float32) / (q1 - q0))[:, None, None]
    alb[q0:q1, p0:p1, :3] = _hexs('#0E151A') * (1 - v * 0.6) + _hexs('#2E4352') * (v * 0.6)
    emi[q0:q1, p0:p1, :3] = _hexs('#FFE4BE') * (0.82 + 0.18 * v)
    _rect(alb, p0, int(H * 0.62), p1, int(H * 0.64), _hexs('#1A2126'))           # 창 가로대(낮에만)
    np.clip(alb, 0, 1, out=alb); np.clip(emi, 0, 1, out=emi)
    return alb, emi


TRAIN_MATS = ('train_white', 'train_window', 'train_stripe', 'black', 'glass_dark', 'ui')
TW, TWIN, TSTR, TBLK, TGLS, TUI = range(len(TRAIN_MATS))


def _train_section():
    """차체 단면(y, z) 16 점(아래 왼쪽 → 아래 오른쪽 → 오른쪽 옆 위로 → 지붕 → 왼쪽 옆 아래로)과 변마다 재질. 8 각(모서리 ch 깎음)이고
    옆면을 청록 띠 · 창 띠 높이에서 나눴다."""
    t = TRAIN; hw, H, c = t['W'] / 2, t['H'], t['ch']
    s0, s1 = t['stripe']; w0, w1 = t['win']
    side = [c, s0, s1, w0, w1, H - c]
    pts = [(-hw + c, 0.0), (hw - c, 0.0)] + [(hw, z) for z in side] + [(hw - c, H), (-hw + c, H)] + [(-hw, z) for z in reversed(side)]
    mats = [TBLK, TBLK, TW, TSTR, TW, TWIN, TW, TW, TW, TW, TW, TWIN, TW, TSTR, TW, TBLK]
    return pts, mats


def train_mesh(M):
    """흰 4 량 튜브 열차(§4.2): 1 량 17.0 × 2.9 × 3.4, 차량 사이 0.6 m(검은 연결막), 양 끝 둥근 코 2.2 m(1 · 4 량 안), 전장 69.8 m.
    원점 = 열차 가운데 바닥, 앞 = 로컬 +x(양 끝이 같은 모양이라 뒤로 달려도 돌지 않는다). 창 띠 1.2 … 2.4 m(NWF_train_window: 낮 어두운 유리,
    밤 따뜻한 흰빛), 청록 띠 0.12 m(NWF_train_stripe), 코: 어두운 앞유리 · 전조등(흰) · 미등(빨강)."""
    t = TRAIN
    L_all = t['cars'] * t['L'] + (t['cars'] - 1) * t['gap']
    S, SM = _train_section()
    n = len(S)
    mb = MB()
    corner = [S[0], S[1], S[2], S[7], S[8], S[9], S[10], S[15]]            # 8 각 꼭짓점(끝면용)

    def ring(x, k_y=1.0, k_z=1.0, zb=0.25):
        return [(x, y * k_y, zb + (z - zb) * k_z) for y, z in S]

    def loft(A, B, nose=False, k=0):
        for i in range(n):
            j = (i + 1) % n
            m = SM[i]
            if nose and m in (TWIN, TW) and S[i][1] >= t['win'][0] - 1e-6 and S[j][1] >= t['win'][0] - 1e-6:
                m = TGLS if (k >= 2 or m == TWIN) else m                 # 코: 창 띠는 앞유리, 코 앞쪽 절반은 창 띠 위 전체가 앞유리
            if m == TWIN:
                x0, x1 = A[i][0], B[i][0]
                u0, u1 = x0 / t['module'], x1 / t['module']
                va, vb = (0.0, 1.0) if S[i][0] > 0 else (1.0, 0.0)      # 아래 = v 0(+y 옆은 위로, −y 옆은 아래로 돈다)
                mb.face([A[i], A[j], B[j], B[i]], m, [(u0, va), (u0, vb), (u1, vb), (u1, va)])
                continue
            mb.face([A[i], A[j], B[j], B[i]], m, [(0.5, 0.5)] * 4)      # 단면 반시계(+x 에서 볼 때) → 바깥 법선

    def cap(x, sgn, k_y=1.0, k_z=1.0, zb=0.25):
        pts = [(x, y * k_y, zb + (z - zb) * k_z) for y, z in corner]
        mb.face(pts if sgn > 0 else pts[::-1], TBLK if abs(k_y - 1.0) < 1e-6 else TW, [(0.5, 0.5)] * len(pts))

    x = -L_all / 2
    for car in range(t['cars']):
        xa, xb = x, x + t['L']
        ba = xa + (t['nose'] if car == 0 else 0.0); bb = xb - (t['nose'] if car == t['cars'] - 1 else 0.0)
        loft(ring(ba), ring(bb))
        for xe, sgn, is_nose in ((ba, -1, car == 0), (bb, 1, car == t['cars'] - 1)):
            if not is_nose:
                cap(xe, sgn)
                continue
            N = 4; prev = ring(xe)
            for k in range(1, N + 1):
                f = k / N
                ky, kz = 1.0 - 0.55 * f ** 2, 1.0 - 0.6 * f ** 1.5
                cur = ring(xe + sgn * t['nose'] * (1.0 - (1.0 - f) ** 1.6), ky, kz)
                (loft(prev, cur, True, k) if sgn > 0 else loft(cur, prev, True, k))
                prev = cur
            xt = prev[0][0]
            cap(xt, sgn, ky, kz)
            for yy, zz, cell in ((-0.36, 0.62, 'white'), (0.36, 0.62, 'white'), (-0.5, 0.42, 'red'), (0.5, 0.42, 'red')):
                yw, hh = 0.12, 0.05
                xq = xt + sgn * 0.01
                q = [(xq, yy - yw, zz - hh), (xq, yy + yw, zz - hh), (xq, yy + yw, zz + hh), (xq, yy - yw, zz + hh)]
                mb.face(q if sgn > 0 else q[::-1], TUI, [(UI[cell][0], UI[cell][1]), (UI[cell][2], UI[cell][1]),
                                                         (UI[cell][2], UI[cell][3]), (UI[cell][0], UI[cell][3])])
        if car < t['cars'] - 1:                                            # 연결막(검정)
            hy = t['W'] / 2 - t['ch']
            mb.box((xb, -hy, 0.4), (xb + t['gap'], hy, t['H'] - 0.3), TBLK, faces='yYZ')
        x = xb + t['gap']
    return mover_atlas(mb.to_mesh('FU_train', [M[k] for k in TRAIN_MATS], mask=lambda co: (0.0, 0.2, 1.0)), M)


def build_trains(C, M):
    """열차 2 편성: 각자 단일 사용자 메시(me.copy()). 두 사본은 모양이 같아 gltf-transform dedup · instance 가 합쳐 노드 이름을 지운다 →
    차량마다 정점 AO(nw_mask B)를 열차별로 조금 다르게 써서 바이트가 다르게 한다(Task 11 이 FU_train_a/b 이름으로 움직인다)."""
    me = train_mesh(M)
    out = []
    t = TRAIN
    L_all = t['cars'] * t['L'] + (t['cars'] - 1) * t['gap']
    for i, (nm, loc) in enumerate(TRAINS):
        m2 = me.copy(); m2.name = nm
        shade = [0.97, 0.93, 0.95, 0.91] if i == 0 else [0.92, 0.96, 0.9, 0.94]
        vals = []
        for v in m2.vertices:
            car = min(t['cars'] - 1, max(0, int((v.co.x + L_all / 2) / (t['L'] + t['gap']))))
            vals.append((0.0, 0.2, shade[car] * (0.8 + 0.2 * smoothstep(0.0, 0.6, v.co.z))))
        lib.write_mask_values(m2, vals)
        out.append(obj(nm, m2, C, loc, 0.0, surface='metal', night=True, nw_motif='tube_train', nw_train=i))
    bpy.data.meshes.remove(me)
    sig = [tuple(round(c, 4) for c in lib_mask_b(o.data)) for o in out]
    if len(set(sig)) != len(sig):
        raise RuntimeError('열차: 두 편성 메시가 같다 — dedup · instance 가 FU_train_a/b 이름을 지운다')
    print('trains', [(o.name, tuple(round(c, 1) for c in o.location), sum(len(p.vertices) - 2 for p in o.data.polygons)) for o in out],
          'length', L_all)
    return out


def lib_mask_b(me):
    """nw_mask 정점색 B 값 목록(열차 사본 구분 확인)."""
    a = me.color_attributes.get('nw_mask')
    if a is None:
        return []
    return [d.color[2] for d in a.data][:64]


def build_bridges(C, M, gz):
    """보행 스카이브리지 2 개(BRIDGES): 상판 FU_bridge_<id>_deck(흰 콘크리트 상자 · 윗면 보도블록 · 양쪽 유리 난간 1.1 m + 위 흰 레일 ·
    소핏 양 가장자리 청록 LED · SB2 는 6 m 마다 화단)과 기둥 FU_bridge_<id>_col.<k>(원통 12 면, 지면 → 상판 밑). 모두 nw_solid=1 —
    상판과 기둥을 따로 두어 상판 아래 차도가 '막힘' 상자에 들지 않는다."""
    import present
    mt = present.MEADOW_TILE
    out = []
    # 상부 레일은 흰 콘크리트와 같은 흰 재질(STEEL = WC): 상판 객체 표면이 'wall' 이라 강재(리브 'metal')와 묶이지 않고 그리기가 는다
    WC, PAV, RAILG, LED, MEAD = range(5)
    STEEL = WC
    mats = [M['white_conc'], M['deck'], M['rail'], M['bridge_led'], M['meadow']]
    for b in BRIDGES:
        (x0, x1), (y0, y1) = b['x'], b['y']
        zt, zb = b['top'], b['top'] - b['th']
        along_x = (x1 - x0) >= (y1 - y0)
        mb = MB()
        mb.box((x0, y0, zb), (x1, y1, zt), WC, faces='xXyYz', rect={f: (0, 0, 1, 1) for f in 'xXyYz'})
        mb.face([(x0, y0, zt), (x1, y0, zt), (x1, y1, zt), (x0, y1, zt)], PAV, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)])
        e, rh, rr = 0.06, RAIL_H, 0.03
        if along_x:
            edges = [((x0, y0 + e), (x1, y0 + e), -1), ((x0, y1 - e), (x1, y1 - e), 1)]
        else:
            edges = [((x0 + e, y0), (x0 + e, y1), -1), ((x1 - e, y0), (x1 - e, y1), 1)]
        for (pa, pb, sg) in edges:
            mb.quad((pa[0], pa[1], zt), (pb[0], pb[1], zt), (pb[0], pb[1], zt + rh - 0.04), (pa[0], pa[1], zt + rh - 0.04), RAILG)
            if along_x:
                mb.box((pa[0], pa[1] - rr, zt + rh - 0.04), (pb[0], pa[1] + rr, zt + rh + 0.02), STEEL, faces='yYzZ')
                yl = (y0 + 0.12) if sg < 0 else (y1 - 0.12)
                mb.box((x0, yl - 0.03, zb - 0.04), (x1, yl + 0.03, zb), LED, faces='yYz')
            else:
                mb.box((pa[0] - rr, pa[1], zt + rh - 0.04), (pa[0] + rr, pb[1], zt + rh + 0.02), STEEL, faces='xXzZ')
                xl = (x0 + 0.12) if sg < 0 else (x1 - 0.12)
                mb.box((xl - 0.03, y0, zb - 0.04), (xl + 0.03, y1, zb), LED, faces='xXz')
        if b['beds']:
            L, Wd, Hb = BRIDGE_BED
            n = int(((y1 - y0) if not along_x else (x1 - x0)) // BRIDGE_BED_STEP)
            s0 = ((y1 - y0) if not along_x else (x1 - x0)) / 2 - (n - 1) * BRIDGE_BED_STEP / 2
            for k in range(n):
                c = (y0 if not along_x else x0) + s0 + k * BRIDGE_BED_STEP
                for sg in (-1, 1):
                    if along_x:
                        yy = (y0 + 0.15) if sg < 0 else (y1 - 0.15 - Wd)
                        c0, c1 = (c - L / 2, yy, zt), (c + L / 2, yy + Wd, zt + Hb)
                    else:
                        xx = (x0 + 0.15) if sg < 0 else (x1 - 0.15 - Wd)
                        c0, c1 = (xx, c - L / 2, zt), (xx + Wd, c + L / 2, zt + Hb)
                    mb.box(c0, c1, WC, faces='xXyYZ', fmat={'Z': MEAD},
                           rect={f: ((c0[0] / mt, c0[1] / mt, c1[0] / mt, c1[1] / mt) if f == 'Z' else (0, 0, 1, 1)) for f in 'xXyYZ'})
        nm = f'FU_bridge_{b["id"]}_deck'
        me = mb.to_mesh(nm, mats, mask=lambda co: (0.0, 0.25, 0.95))
        out.append(obj(nm, me, C, surface='wall', night=True, nw_solid=1, nw_motif='skybridge', nw_bridge=b['id']))
        for k, (cx, cy) in enumerate(b['cols']):
            z0 = gz.z(cx, cy, 0.0)
            cb = MB()
            cb.cyl((cx, cy, z0 - 0.05), (cx, cy, zb), b['d'] / 2, b['d'] / 2, 12, 0, caps=(False, False))
            nm = f'FU_bridge_{b["id"]}_col.{k}'
            me = cb.to_mesh(nm, [M['tube_steel']], smooth=True, sharp=40,
                            mask=lambda co, z0=z0: (0.0, 0.3, 0.6 + 0.4 * smoothstep(z0, z0 + 1.5, co[2])))
            out.append(obj(nm, me, C, surface='metal', nw_solid=1, nw_motif='skybridge', nw_bridge=b['id']))
    print('bridges', [(o.name, sum(len(p.vertices) - 2 for p in o.data.polygons)) for o in out])
    return out


# ═════════════════════════════ 앵커 · 카메라 · 밤 조명 ═════════════════════════════
ANCHORS = [   # (id, 위치, 제목)
    ('led_line', (52.0, 145.7, 7.2), '2호선 고가 하부의 파란 LED 선'),
    ('led_screen', (-8.0, 126.6, 18.6), '벽돌 창고 위 비계 LED 스크린'),
    ('smart_crossing', (-14.0, -42.0, 0.6), '가장자리가 빛나는 횡단보도와 바닥 신호'),
    ('bus_kiosk', (-46.0, -34.1, 2.4), '스마트 정류장과 키오스크'),
    ('robotaxi', (-54.0, -40.375, 1.6), '창이 상태 화면인 자율주행 포드'),   # 최종 수정 M4: 옛 정차 자리(y −36.95, 빈 차로) → pod_w1 이 지나는 서행 차로
    ('drone_patrol', (10.0, 142.0, 17.0), '보안 드론의 서치라이트 순찰'),
]


def build_anchors(sc):
    A = lib.coll('NW_anchors', sc)
    for e in [o for o in A.objects if o.get('nw_layer') == 'future']:
        bpy.data.objects.remove(e, do_unlink=True)
    for aid, pos, title in ANCHORS:
        nm = f'ANCHOR_{aid}'
        e = bpy.data.objects.get(nm)
        if e is not None:
            bpy.data.objects.remove(e, do_unlink=True)
        e = bpy.data.objects.new(nm, None)
        e.empty_display_type = 'SPHERE'; e.empty_display_size = 1.5
        e.location = pos
        e['nw_layer'] = 'future'; e['nw_title'] = title
        A.objects.link(e)
    return A


def build_camera(sc):
    """future 층의 카메라: CAM_night(밤 히어로 컷) · CAM_future(2041 골목, 맑음). 반환: {이름: 카메라 객체}."""
    lay = lib.coll('NW_layout', sc)
    out = {}
    for nm, (loc, tgt, lens), mood in [('CAM_night', CAM_NIGHT, 'night'), ('CAM_future', CAM_FUTURE, 'clear')]:
        cam = bpy.data.objects.get(nm)
        if cam is None or cam.type != 'CAMERA':
            if cam is not None:
                bpy.data.objects.remove(cam, do_unlink=True)
            cd = bpy.data.cameras.get(nm) or bpy.data.cameras.new(nm)
            cam = bpy.data.objects.new(nm, cd)
        if cam.name not in lay.objects:
            lay.objects.link(cam)
        cam.location = loc
        cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        cam.data.lens = lens; cam.data.sensor_width = 36.0
        cam.data.clip_start = 0.1; cam.data.clip_end = lib.FAR_CLIP
        cam['target'] = list(tgt); cam['nw_mood'] = mood
        out[nm] = cam
    return out


def _light(NC, name, kind, loc, energy, color=None, kelvin=None, rot=None, size=None, spot=None, blend=0.6, shadow=True,
           volume=1.0, shape=None, size_y=None):
    ld = bpy.data.lights.get(name)
    if ld is not None and ld.type != kind:
        bpy.data.lights.remove(ld); ld = None
    ld = ld or bpy.data.lights.new(name, kind)
    ld.energy = energy
    if kelvin is not None:
        ld.use_temperature = True; ld.temperature = kelvin; ld.color = (1, 1, 1)
    else:
        ld.use_temperature = False; ld.color = srgb(color)[:3] if color else (1, 1, 1)
    ld.use_shadow = shadow
    ld.volume_factor = volume
    if kind == 'SPOT':
        ld.spot_size = math.radians(spot or 90); ld.spot_blend = blend; ld.shadow_soft_size = size or 0.2
    elif kind == 'AREA':
        ld.shape = shape or 'RECTANGLE'; ld.size = size or 1.0
        if ld.shape in ('RECTANGLE', 'ELLIPSE'):
            ld.size_y = size_y or 0.1
    elif kind == 'POINT':
        ld.shadow_soft_size = size or 0.1
    o = bpy.data.objects.get(name)
    if o is not None and o.data != ld:
        bpy.data.objects.remove(o, do_unlink=True); o = None
    o = o or bpy.data.objects.new(name, ld)
    if o.name not in NC.objects:
        NC.objects.link(o)
    o.location = loc
    o.rotation_euler = rot or (0, 0, 0)
    return o


def build_night_rig(sc):
    """밤 무드 전용 조명(NW_fx_night, 내보내지 않음). 웹은 발광 재질·nw_night 와 자체 조명으로 같은 효과를 낸다.
    옛 가로등 = 따뜻한 흰색 2900 K, 새 장치(스마트 헤드·키오스크) = 차가운 6000 K, LED 선 = 파랑, 스크린 = 화면 평균색."""
    NC = lib.coll(lib.NIGHT_COLL, sc)
    for o in list(NC.objects):
        ld = o.data
        bpy.data.objects.remove(o, do_unlink=True)
        if ld is not None and ld.users == 0:
            bpy.data.lights.remove(ld)
    smart = {bpy.data.objects[p].name for p in SMART_POLES if bpy.data.objects.get(p)}
    n = 0
    for o in sorted([o for o in bpy.data.objects if o.name.startswith('PR_light.')], key=lambda o: o.name):
        p = o.matrix_world @ Vector((2.47, 0.0, 8.86))
        if o.name in smart:
            _light(NC, f'FX_night_lamp_{n:02d}', 'SPOT', p, 900, kelvin=6000, spot=118, blend=0.75, size=0.35, volume=0.6)
        else:
            _light(NC, f'FX_night_lamp_{n:02d}', 'SPOT', p, 650, kelvin=2900, spot=112, blend=0.8, size=0.25, volume=0.7)
        n += 1
    # 파란 LED 선: 상판 모서리 아래 긴 면광(아래·바깥을 본다) — 교각·젖은 노면에 파란 빛
    k = 0
    for side, y in ((1, VIA_RIM_Y0 - 0.1), (-1, VIA_RIM_Y1 + 0.1)):
        for xa in range(-130, 178, 22):
            xc = xa + 11.0
            yy = y if not (ST_X[0] < xc < ST_X[1]) else (VIA_RIM_Y0 - ST_D - 0.1 if side > 0 else VIA_RIM_Y1 + ST_D + 0.1)
            zz = (DECK_B if not (ST_X[0] < xc < ST_X[1]) else ST_B) - 0.1
            _light(NC, f'FX_night_led_{k:02d}', 'AREA', (xc, yy, zz), 260, color='#3E8AD0', size=20.0, size_y=0.12,
                   rot=(math.radians(-20 * side), 0, 0), shadow=False, volume=0.5)
            k += 1
    # LED 스크린: 화면 앞 면광(화면 평균색, 북쪽을 본다)
    s = SCREEN; xc = (s['x0'] + s['x1']) / 2
    _light(NC, 'FX_night_screen', 'AREA', (xc, s['y'] + 0.4, s['z0'] + s['h'] / 2), 2400, color='#4F9CB4', size=s['w'],
           size_y=s['h'], rot=(math.radians(90), 0, 0), shadow=False, volume=0.4)
    # 정류장·키오스크·카페 진열창·홀로그램·EV 기둥: 작은 차가운 빛
    _light(NC, 'FX_night_busstop', 'AREA', (SHELTER['x'], (SHELTER['y0'] + SHELTER['y1']) / 2, 2.5), 160, kelvin=6200, size=3.0,
           size_y=1.2, shadow=False)
    _light(NC, 'FX_night_kiosk', 'POINT', (KIOSK[0] - 0.4, KIOSK[1], 1.3), 25, kelvin=7000, size=0.3, shadow=False)
    _light(NC, 'FX_night_display', 'AREA', (DISPLAY['x'], DISPLAY['y'] + 0.5, 1.7), 180, color='#7FC3D2', size=4.4, size_y=2.0,
           rot=(math.radians(90), 0, 0), shadow=False)
    _light(NC, 'FX_night_holo', 'POINT', (HOLO[0], HOLO[1], 1.6), 60, color='#9FEAF5', size=0.5, shadow=False)
    for i, (x, y) in enumerate(EV_POSTS):
        _light(NC, f'FX_night_ev_{i}', 'POINT', (x, y - 0.3, 1.35), 6, color='#43ABA7', size=0.1, shadow=False)
    # 가게 창 불빛(현재 층 간판·진열창): 고가 하부 가로 쪽 카페·상가 안쪽의 따뜻한 빛
    for i, (x, y, z) in enumerate(((30.5, 125.5, 2.2), (41.0, 125.5, 2.2), (57.0, 125.5, 2.2), (-20.0, 106.0, 2.4), (-5.0, 128.5, 2.2))):
        _light(NC, f'FX_night_shop_{i}', 'POINT', (x, y, z), 120, kelvin=3200, size=0.8, shadow=False, volume=0.2)
    # 보안 드론 서치라이트(밤): 원뿔과 같은 방향의 스폿(볼륨 산란으로 빛줄기)
    d = bpy.data.objects.get('FU_drone_sec')
    if d is not None:
        bm = bpy.data.objects.get('FU_drone_sec_beam')
        rot = (bm.matrix_world.to_euler() if bm is not None else (0, 0, 0))
        _light(NC, 'FX_night_searchlight', 'SPOT', d.matrix_world @ Vector((0.2, 0, -0.3)), 2600, kelvin=6800, spot=17, blend=0.35,
               size=0.05, rot=tuple(rot), volume=2.5)
    # HAUS 외벽 조명(매장의 밤): 전정에서 올려 비추는 넓은 스폿 + 북·동면 약한 면광
    for i, (x, y) in enumerate(((-18.0, -31.0), (0.0, -31.5), (18.0, -31.0))):
        _light(NC, f'FX_night_haus_up_{i}', 'SPOT', (x, y, 0.4), 5200, kelvin=3600, spot=60, blend=0.9, size=0.3,
               rot=(math.radians(166), 0, 0), volume=0.15)
    for i, (loc, rot) in enumerate((((0.0, 34.0, 30.0), (math.radians(-70), 0, 0)), ((34.0, 0.0, 30.0), (0, math.radians(70), 0)))):
        _light(NC, f'FX_night_haus_wash_{i}', 'AREA', loc, 9000, kelvin=4000, size=40.0, size_y=30.0, rot=rot, shadow=False, volume=0.0)
    NC.hide_render = True; NC.hide_viewport = True
    return NC


# ═════════════════════════════ 이동체 표(Task 11, §4.4) ═════════════════════════════
BOT_RUN = {'bot0': ('pingpong', 1.4), 'bot1': ('pingpong', 1.5), 'bot2': ('loop', 1.2)}   # BOT_STARTS id → (모드, m/s)
TRAIN_RUNS = [('train_a', 16.0, 0.0, -700.0, 700.0), ('train_b', 14.0, 0.5, 700.0, -700.0)]  # TRAINS 순서: (id, m/s, 위상, x 시작, x 끝)
TURBINE_RPM = 18.0


def _densify(pts, step=2.0):
    out = []
    for a, b in zip(pts, pts[1:]):
        a, b = Vector(a), Vector(b)
        n = max(1, int((b - a).length / step))
        out.extend(tuple(a.lerp(b, k / n)) for k in range(n))
    out.append(tuple(pts[-1]))
    return out


def _catmull_closed(pts, step=2.0):
    """닫힌 균일 Catmull-Rom(장력 0.5 — three 'catmullrom' 0.5 와 같은 식)을 step m 꺾은선으로 편다."""
    P = [Vector(p) for p in pts]; n = len(P); out = []
    for i in range(n):
        p0, p1, p2, p3 = P[(i - 1) % n], P[i], P[(i + 1) % n], P[(i + 2) % n]
        seg = max(1, int((p2 - p1).length / step))
        for k in range(seg):
            t = k / seg; t2 = t * t; t3 = t2 * t
            v = 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
            out.append(tuple(v))
    return out


def _closed_dense(pts, step=2.0):
    """닫힌 꺾은선을 촘촘하게(마지막 → 처음 구간 포함). 끝에 처음 점을 다시 넣지 않는다(web buildTrack 이 닫는다)."""
    return _densify(list(pts) + [pts[0]], step)[:-1]


def mover_table(gz):
    """이동체 표(§4.4, Blender 좌표). export.py 가 three 좌표로 바꿔 layout.movers 로 낸다. gz = GroundZ(포드는 _road_base, 로봇은 지면).
    포드 · 배송로봇 경로는 Task 10 의 POD_ROUTES · rounded_loop(POD_LOOP, 반시계) · BOT_STARTS, 열차는 TRAINS 의 y · z 를 쓴다.
    origin · yaw0 = 객체의 Blender 원점 · 방위(rotation_euler.z). optimize 의 위치 양자화가 노드 원점을 메시 상자 가운데로 옮기므로
    웹은 이 자리에 피벗을 두고 객체를 붙여 움직인다(풍력 회전자는 허브가 상자 가운데가 아니다)."""
    import present
    road = lambda pts: [(x, y, _road_base(gz, x, y)) for x, y, *_ in pts]
    walk = lambda pts: [(x, y, gz.z(x, y, 0.0)) for x, y, *_ in pts]

    def row(name, **kw):
        o = bpy.data.objects[name]
        return dict(object=name, origin=tuple(o.location), yaw0=round(o.rotation_euler.z, 6), **kw)   # 이동체는 부모가 없다(matrix_world 는 아직 갱신 전일 수 있다)

    rows = []
    for i, did in enumerate(DRONE_PATHS):     # 드론 앞 = 로컬 +X(렌즈 · 몸통 긴 축, build_drones 가 진행 방향으로 세운다) → yawOffset 0
        rows.append(row(f'FU_drone_{did}', id=did, kind='drone', mode='loop', speed=DRONE_SPEED[did], phase=round(0.27 * i, 3), bob=0.28,
                        beam='FU_drone_sec_beam' if did == 'sec' else None, path=_catmull_closed(DRONE_PATHS[did])))
    for nm, rid, mode, speed, phase, pts in POD_ROUTES:
        line = rounded_loop(POD_LOOP) if pts == 'POD_LOOP' else pts
        rows.append(row(nm, id=rid, kind='pod', mode=mode, speed=speed, phase=phase,
                        path=road(_closed_dense(line) if mode == 'loop' else _densify(line))))
    for (nm, (_, y, z)), (rid, speed, phase, x0, x1) in zip(TRAINS, TRAIN_RUNS):
        rows.append(row(nm, id=rid, kind='train', mode='pingpong', speed=speed, phase=phase, path=_densify([(x0, y, z), (x1, y, z)], 10.0)))
    for nm, rid, p0, p1 in BOT_STARTS:
        mode, speed = BOT_RUN[rid]
        line = _closed_dense(present.PARK_PATH) if p0 is None else _densify([p0, p1])
        rows.append(row(nm, id=rid, kind='bot', mode=mode, speed=speed, path=walk(line), **({'flipYaw': True} if mode == 'pingpong' else {})))
    for o in sorted((o for o in bpy.data.objects if o.name.startswith('FU_turbine_rotor.')), key=lambda o: o['nw_turbine']):
        rows.append(row(o.name, id=f"turbine_{o['nw_turbine']}", kind='spin', rpm=TURBINE_RPM))
    print('movers', [(r['id'], r['object'], len(r.get('path', ()))) for r in rows])
    return rows


# ═════════════════════════════ 조립 ═════════════════════════════
class _Roof(GroundZ):
    """지붕 높이: 위에서 아래로 광선(현재 층 정적 메시에 맞는다)."""

    def __init__(self, sc):
        super().__init__()
        self.sc = sc
        self.dg = bpy.context.evaluated_depsgraph_get()

    def roof(self, x, y):
        hit, loc, n, i, ob, m = self.sc.ray_cast(self.dg, Vector((x, y, 60.0)), Vector((0, 0, -1)))
        k = 0
        while hit and ob is not None and (ob.name.startswith('FX_') or ob.name.startswith('FU_')) and k < 6:
            hit, loc, n, i, ob, m = self.sc.ray_cast(self.dg, loc - Vector((0, 0, 0.01)), Vector((0, 0, -1))); k += 1
        return loc.z if hit else 12.0


class _Kit:
    """글자 메시(우리가 지은 문구만): 글꼴 곡선 → 메시. present.py TextKit 과 같은 방식, 끝나면 임시 데이터를 지운다."""

    def __init__(self, sc):
        self.sc = sc
        self.font = bpy.data.fonts.load(FONT_FILE, check_existing=True) if os.path.exists(FONT_FILE) else None

    def glyphs(self, body, size, extrude=0.0):
        cu = ob = me = None
        try:
            cu = bpy.data.curves.new('NWF_tmp_text', 'FONT')
            cu.font = self.font; cu.body = body; cu.size = size; cu.extrude = extrude; cu.resolution_u = 2
            cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
            ob = bpy.data.objects.new('NWF_tmp_text', cu); self.sc.collection.objects.link(ob)
            dg = self.sc.view_layers[0].depsgraph; dg.update()
            me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
            V = [tuple(v.co) for v in me.vertices]; F = [tuple(p.vertices) for p in me.polygons]
        finally:
            if ob is not None:
                bpy.data.objects.remove(ob, do_unlink=True)
            if cu is not None:
                bpy.data.curves.remove(cu)
            if me is not None:
                bpy.data.meshes.remove(me)
        xs = [v[0] for v in V] or [0.0]; ys = [v[1] for v in V] or [0.0]; zs = [v[2] for v in V] or [0.0]
        cx = (min(xs) + max(xs)) / 2; cy = (min(ys) + max(ys)) / 2; z0 = min(zs)
        w = max(xs) - min(xs); h = max(ys) - min(ys)
        k = size / max(1e-6, h)
        return [((x - cx) * k, (y - cy) * k, z - z0) for x, y, z in V], F, w * k, h * k

    def close(self):
        for cu in [cu for cu in bpy.data.curves if cu.name.startswith('NWF_tmp_text') and cu.users == 0]:
            bpy.data.curves.remove(cu)
        if self.font is not None and not any(getattr(c, 'font', None) == self.font for c in bpy.data.curves):
            bpy.data.fonts.remove(self.font, do_unlink=True)
        self.font = None


def clear_future(sc):
    C = lib.coll('NW_future', sc)
    for o in list(C.all_objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for me in [me for me in bpy.data.meshes if me.get(TAG) and me.users == 0]:
        bpy.data.meshes.remove(me)
    for cu in [cu for cu in bpy.data.curves if cu.name.startswith('NWF_tmp_text') and cu.users == 0]:
        bpy.data.curves.remove(cu)
    return C


def build():
    import time
    t0 = time.time()
    sc = lib.get_scene(True)
    if bpy.data.collections.get('NW_present') is None or bpy.data.objects.get('PR_light.000') is None:
        import present
        importlib.reload(present)
        present.build()
    C = clear_future(sc)
    M = materials()
    gz = _Roof(sc)
    kit = _Kit(sc)
    try:
        build_led(C, M)
        build_screen(C, M, gz)
        build_crossing(C, M, gz)
        build_busstop(C, M, gz, kit if kit.font is not None else None)
    finally:
        kit.close()
    build_taxis(C, M, gz)
    build_drones(C, M)
    build_helpers(C, M, gz)
    _, spots = build_towers(C, M)
    build_turbines(C, M, sc, spots)
    build_plaza(C, M)
    build_tube(C, M)
    build_trains(C, M)
    build_bridges(C, M, gz)
    build_smart_street(C, M, gz)          # 스카이브리지 기둥 · 정류장 · 기존 소품을 피해 놓으므로 그 뒤에
    sc['nw_movers'] = json.dumps(mover_table(gz))   # 이동체 표(Task 11) → export.py layout.movers
    build_anchors(sc)
    build_camera(sc)
    # 현재 층 간판 글자(nw_night): 밤에만 켜지는 발광(낮 렌더는 그대로)
    lib.night_hook(bpy.data.materials.get('NW_sign_letters'), 7.0)
    build_night_rig(sc)
    lib.set_far_clip(sc)
    for m in [m for m in bpy.data.materials if m.get(TAG) and m.users == 0]:
        bpy.data.materials.remove(m)
    for im in [im for im in bpy.data.images if im.get(TAG) and im.users == 0]:
        bpy.data.images.remove(im)
    print('light probes', lib.bake_light_probes(sc))
    r = report()
    print('done', round(time.time() - t0, 1))
    return r


def report():
    C = bpy.data.collections['NW_future']
    objs = [o for o in C.all_objects if o.type == 'MESH']
    pairs = set(); tri_total = 0; uniq = {}
    for o in objs:
        me = o.data
        t = sum(len(p.vertices) - 2 for p in me.polygons)
        tri_total += t; uniq[me.name] = t
        for i in {p.material_index for p in me.polygons}:
            m = me.materials[i] if i < len(me.materials) else None
            pairs.add((me.name, m.name if m else None))
    mats = sorted({p[1] for p in pairs if p[1]})
    out = {'objects': len(objs), 'empties': len([o for o in C.all_objects if o.type == 'EMPTY']), 'unique_meshes': len(uniq),
           'pairs': len(pairs), 'tris_render': tri_total, 'tris_unique': sum(uniq.values()), 'materials': len(mats)}
    print('NW_future', out)
    print('meshes', sorted(uniq.items(), key=lambda kv: -kv[1]))
    return out


if __name__ == '__main__':
    build()
