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
#     (6) FU_drone_*            보안 드론 1(서치라이트 원뿔 = holo) + 배송 드론 3(링크 복제), PATH_drone_<id>_<n> 경로 빈 객체
#     보조: FU_smart_head.*(옛 가로등 기둥에 덧단 LED 헤드·센서 포드 3), FU_ev_post.*(EV 충전 기둥 2, LED 링),
#           FU_shop_display(카페 진열창의 투명 디스플레이), FU_holo_ad(홀로그램 광고 한 곳, holo)
#   NW_anchors   ANCHOR_<id>(nw_layer=future, nw_title) 6개 추가
#   NW_layout    CAM_night(밤 히어로 컷)
#   NW_fx_night  밤 무드 전용 조명(가로등 웅덩이, LED 반사광, HAUS 외벽 조명) — 내보내지 않는다. lib.apply_mood 가 켜고 끈다
#
# 규약(§5, lib.py 머리말)
#   - 모든 메시: 정점색 nw_mask(R 이끼 0, G 젖음, B AO, A 1) 활성·렌더 색, 객체 nw_surface·nw_vmask=1.
#   - 발광 재질: 세기 = day + night·nw_night(장면 속성, lib.emit_strength), 재질 nw_emit(JSON) 기록, 객체 nw_night=1.
#   - holo: 웹 전용 셰이더(스캔선·깜빡임)로 바뀐다. Blender 에서는 가산(투명 + 발광)으로 보이게만 한다.
#   - 반복 소품(택시·배송 드론·스마트 헤드·EV 기둥)은 링크 복제 → GPU 인스턴싱.
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
VIA_Y0, VIA_Y1 = 149.3, 160.7            # 상판 하부 모서리(남·북), present.py SLOT_viaduct_led 와 같다
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
TAXIS = [((-54.0, -36.95, 0.0), math.pi), ((52.0, -44.4, 0.0), 0.0), ((118.0, -47.05, 0.0), 0.0)]   # (위치, 진행 방향)
SMART_POLES = ('PR_light.001', 'PR_light.010', 'PR_light.017')       # 뚝섬로 북측 x −65, 남측 x −45, 골목 y 125
EV_POSTS = [(31.0, 150.55), (35.6, 150.55)]                            # 고가 아래 아치 주차(승강장 구간) 남쪽 끝
DISPLAY = dict(x=40.5, y=127.66, w=4.6, z0=0.55, h=2.3)                # B6 카페 북면 진열창(유리 y 127.7)
HOLO = (66.0, 131.6)                                                    # B6 동쪽 모서리 앞 보도(골목 입구) — 홀로그램 광고 한 곳

# 드론 경로(고리). 첫 점 = 지금 놓인 자리(정지 위치). 웹이 이 순서로 잇고 마지막 → 처음으로 돈다.
DRONE_PATHS = {
    'sec': [(5.0, 122.0, 19.0), (-30.0, 140.0, 18.0), (-70.0, 120.0, 22.0), (-50.0, 75.0, 24.0), (0.0, 62.0, 25.0),
            (50.0, 70.0, 24.0), (66.0, 110.0, 21.0), (40.0, 138.0, 18.0)],
    'd1': [(52.0, 8.0, 34.0), (90.0, -10.0, 40.0), (140.0, 30.0, 44.0), (110.0, 75.0, 40.0), (60.0, 60.0, 36.0)],
    'd2': [(-60.0, -42.0, 30.0), (20.0, -42.0, 32.0), (100.0, -42.0, 30.0), (100.0, -90.0, 46.0), (-60.0, -95.0, 46.0)],
    'd3': [(30.0, 110.0, 28.0), (-10.0, 112.0, 30.0), (-40.0, 85.0, 32.0), (10.0, 80.0, 30.0)],
}
DRONE_SPEED = {'sec': 4.0, 'd1': 9.0, 'd2': 11.0, 'd3': 7.0}   # m/s(웹 애니메이션 기본값)

CAM_NIGHT = ((56.0, 145.6, 1.5), (-4.0, 102.0, 14.8), 19.0)    # 고가 하부 가로에서 서남서: 오른쪽 위에서 이어지는 고가 파란 LED 선, 젖은 노면 반사, 카페·간판, 비계 스크린, 드론, HAUS
BEAM_AIM = (12.0, 139.0, 0.0)                                   # 보안 드론 서치라이트가 비추는 고가 하부 가로


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
    a = lib.save_image('NWF_gen_ui', alb, os.path.join(GEN, 'NWF_gen_ui.png'), TAG)
    e = lib.save_image('NWF_gen_ui_emit', emi, os.path.join(GEN, 'NWF_gen_ui_emit.png'), TAG)
    return a, e


C4 = 0.25
UI = {   # UV 사각형(u0, v0, u1, v1) — paint_ui 의 칸
    'white': (0.02, 0.02, 0.23, 0.23), 'red': (0.27, 0.02, 0.48, 0.23), 'teal': (0.52, 0.02, 0.73, 0.23), 'amber': (0.77, 0.02, 0.98, 0.23),
    'card': (0.02, 0.27, 0.23, 0.48), 'glass': (0.27, 0.27, 0.48, 0.48), 'ev': (0.5, 0.25, 0.75, 0.5), 'bis': (0.75, 0.25, 1.0, 0.5),
    'taxi': (0.0, 0.5, 0.5, 0.75), 'kiosk': (0.5, 0.5, 0.75, 1.0), 'display': (0.0, 0.75, 0.5, 1.0), 'holo': (0.75, 0.5, 1.0, 1.0),
}


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
    }
    M['glass']['nw_surface'] = 'glass'
    return M


# ═════════════════════════════ (1) 고가 하부 파란 LED 선 ═════════════════════════════
def led_path(side):
    """side +1 = 남쪽 모서리, −1 = 북쪽. 반환: [(x, y, z)] 꺾은선(상판 하부 모서리 → 승강장 구간은 승강장 끝 아래)."""
    ye = VIA_Y0 + 0.07 if side > 0 else VIA_Y1 - 0.07
    ys = (VIA_Y0 - ST_D + 0.07) if side > 0 else (VIA_Y1 + ST_D - 0.07)
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
    me = mb.to_mesh('FU_crossing_led', [M['led_teal']], mask=lambda co: (0.0, 0.6, 1.0))
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
    nu, nv = 28, 10
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
        if 4 <= j <= 7:
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
                    uv.append((u0 + (u1 - u0) * min(1.0, max(0.0, t)), v0 + (v1 - v0) * (jc - 4) / 4))
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
            mb.cyl((wx, wy - 0.12, 0.34), (wx, wy + 0.12, 0.34), 0.34, 0.34, 14, 2, phase=0.1)
    # 지붕 센서 돔
    mb.cyl((0.2, 0, Ht - 0.02), (0.2, 0, Ht + 0.07), 0.2, 0.17, 14, 2)
    mb.cyl((0.2, 0, Ht + 0.07), (0.2, 0, Ht + 0.1), 0.17, 0.12, 14, 1, rect=UI['teal'])
    return mb.to_mesh('FU_taxi', [M['pearl'], M['ui'], M['black'], M['glass_dark']], smooth=True, sharp=50,
                      mask=lambda co: (0.0, 0.35, 0.55 + 0.45 * smoothstep(0.1, 0.9, co[2])))


def build_taxis(C, M, gz):
    me = taxi_mesh(M)
    out = []
    for i, ((x, y, _), rz) in enumerate(TAXIS):
        z = gz.z(x, y, -0.1, only='GR_road')
        out.append(obj(f'FU_taxi.{i}', me, C, (x, y, z), rz, surface='metal', night=True, nw_motif='robotaxi'))
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
    return mb.to_mesh('FU_drone_sec', [M['pearl'], M['black'], M['led_white'], M['led_blue']], smooth=True, sharp=40,
                      mask=lambda co: (0.0, 0.15, 1.0))


def del_drone_mesh(M):
    """배송 드론: X 프레임 4로터 + 몸체 + 집게에 든 상자(골판지)."""
    mb = MB()
    mb.box((-0.16, -0.11, -0.05), (0.16, 0.11, 0.07), 0)
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        cx, cy = 0.33 * math.cos(a), 0.33 * math.sin(a)
        mb.cyl((0, 0, 0.03), (cx, cy, 0.03), 0.018, 0.018, 6, 1, caps=(False, False))
        mb.cyl((cx, cy, 0.0), (cx, cy, 0.07), 0.03, 0.03, 8, 1)
        mb.cyl((cx, cy, 0.075), (cx, cy, 0.08), 0.15, 0.15, 12, 1)
    for sx in (-1, 1):                                              # 집게
        mb.box((sx * 0.13 - 0.01, -0.02, -0.25), (sx * 0.13 + 0.01, 0.02, -0.05), 1)
    mb.box((-0.14, -0.12, -0.36), (0.14, 0.12, -0.12), 3, rect=UI['card'])         # 상자
    mb.cyl((0, 0, -0.05), (0, 0, -0.06), 0.06, 0.06, 10, 2, caps=(False, True))   # 청록 상태등
    return mb.to_mesh('FU_drone_del', [M['pearl'], M['black'], M['led_teal'], M['ui']], smooth=True, sharp=40,
                      mask=lambda co: (0.0, 0.15, 1.0))


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
    d = obj('FU_drone_sec', sm, C, p0, yaw, surface='metal', night=True, nw_motif='drone', nw_path='PATH_drone_sec',
            nw_speed=DRONE_SPEED['sec'], nw_kind='security')
    out.append(d)
    # 서치라이트 원뿔: 드론 렌즈에서 앞아래로(지면까지 ~17 m), 원뿔 끝 반지름 2.6 m
    ln = (Vector(BEAM_AIM) - Vector(p0)).length
    bm = beam_mesh(ln, ln * math.tan(math.radians(8.5))).to_mesh('FU_drone_sec_beam', [M['beam']], mask=lambda co: (0.0, 0.0, 1.0))
    beam = obj('FU_drone_sec_beam', bm, C, surface='holo', night=True, nw_motif='drone')
    lens = d.matrix_world @ Vector((0.2, 0.0, -0.245))
    aim = Vector(BEAM_AIM) - lens
    world = Matrix.LocRotScale(lens, aim.to_track_quat('-Z', 'Y'), None)
    beam.parent = d
    beam.matrix_parent_inverse = Matrix.Identity(4)
    beam.matrix_basis = d.matrix_world.inverted() @ world        # 원뿔 축(−z)이 BEAM_AIM 을 향한다(드론을 따라 움직인다)
    beam['nw_length'] = aim.length
    out.append(beam)
    dm = del_drone_mesh(M)
    for i, key in enumerate(('d1', 'd2', 'd3')):
        p0 = DRONE_PATHS[key][0]; p1 = DRONE_PATHS[key][1]
        yaw = math.atan2(p1[1] - p0[1], p1[0] - p0[0])
        out.append(obj(f'FU_drone_del.{i}', dm, C, p0, yaw, surface='metal', night=True, nw_motif='drone',
                       nw_path=f'PATH_drone_{key}', nw_speed=DRONE_SPEED[key], nw_kind='delivery'))
    # 경로 빈 객체: PATH_drone_<id>_<n>
    P = []
    for key, pts in DRONE_PATHS.items():
        for n, p in enumerate(pts):
            e = bpy.data.objects.new(f'PATH_drone_{key}_{n}', None)
            e.empty_display_type = 'PLAIN_AXES'; e.empty_display_size = 1.0
            e.location = p
            e['nw_path'] = f'PATH_drone_{key}'; e['nw_index'] = n; e['nw_loop'] = 1
            e['nw_speed'] = DRONE_SPEED[key]
            C.objects.link(e); P.append(e)
    return out, P


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


# ═════════════════════════════ 앵커 · 카메라 · 밤 조명 ═════════════════════════════
ANCHORS = [   # (id, 위치, 제목)
    ('led_line', (52.0, 145.7, 7.2), '2호선 고가 하부의 파란 LED 선'),
    ('led_screen', (-8.0, 126.6, 18.6), '벽돌 창고 위 비계 LED 스크린'),
    ('smart_crossing', (-14.0, -42.0, 0.6), '가장자리가 빛나는 횡단보도와 바닥 신호'),
    ('bus_kiosk', (-46.0, -34.1, 2.4), '스마트 정류장과 키오스크'),
    ('robotaxi', (-54.0, -36.95, 1.6), '창이 상태 화면인 자율 택시'),
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
    lay = lib.coll('NW_layout', sc)
    nm = 'CAM_night'
    loc, tgt, lens = CAM_NIGHT
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
    cam['target'] = list(tgt); cam['nw_mood'] = 'night'
    return cam


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
    for side, y in ((1, VIA_Y0 - 0.1), (-1, VIA_Y1 + 0.1)):
        for xa in range(-130, 178, 22):
            xc = xa + 11.0
            yy = y if not (ST_X[0] < xc < ST_X[1]) else (VIA_Y0 - ST_D - 0.1 if side > 0 else VIA_Y1 + ST_D + 0.1)
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
