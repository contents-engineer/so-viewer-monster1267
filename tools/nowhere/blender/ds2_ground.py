# HAUS NOWHERE — 데스 스트랜딩 2 산악 지형 (ver=ds2) / Task 2: 지면과 계곡 바닥.
# 실행: MCP(포트 9876)에서 exec(open('<ROOT>/tools/nowhere/blender/ds2_ground.py').read(), {'__name__': '__main__'})
# 매 실행마다 NW_ground 컬렉션을 비우고 처음부터 다시 만든다(멱등).
#
# 성수 2041(ground.py)의 정밀 CDT 분할 + 라플라시안 고밀도 물길/웅덩이 수면 절단 + lib.Mat 다중 노이즈 PBR 구성을
# 그대로 계승하되, 도시 블록 대신 DS2 특유의 현무암·올리브 이끼 산악 지형과 계곡 분지로 구성한다.
import bpy, bmesh, os, sys, math, random, importlib, time
from mathutils import Vector, Matrix, Euler

ROOT = os.environ.get('NW_ROOT', '/Users/gm_yeonho/new-work/so/so-viewer-monster1267')
sys.dont_write_bytecode = True
_HERE = os.path.join(ROOT, 'tools', 'nowhere', 'blender')
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)
import lib
importlib.reload(lib)
from lib import RRect, n2, smoothstep, clamp01, srgb

# ═════════════════════════════ 배치 상수 (Blender Z-up m, HAUS 원점) ═════════════════════════════
X0, Y0, X1, Y1 = lib.MASK_RECT     # (-112, -162, 162, 172)
CURB_W, CURB_H = 0.18, 0.15        # 경계석 폭·높이(측구 위 15 cm), 챔퍼 2 cm
Z_GUT = -0.19                      # 차도 가장자리(측구) 기준 높이. 대지·건물 바닥 = 0
Z_CURB = Z_GUT + CURB_H            # 경계석 윗면(−0.04)
R_C = 3.5                          # 교차로 모서리 반지름
TT = (-48.5, -35.5)                # 산악 횡단 국도 4차로(폭 13 m), 중심선 y −42
TT_C = -42.0
WR = (-108.0, -102.0)              # 서쪽 산악 진입로(x −105, 폭 6 m)
AL = (67.0, 73.0)                  # 동쪽 FaceArch 진입 지선 도로(x +70, 폭 6 m)
NR = (67.0, 73.0)                  # present 호환용 상수
VR = (138.5, 146.5)                # 북쪽 고가/송전선 횡단선 기준 상수
XW, CW = -14.0, 2.5                # 횡단보도 중심 x, 반폭(폭 5 m)
XV = 22.0

# 고밀도 자연 계곡 분지(HAUS 와 FaceArch 사이 + 북쪽 계곡 입구까지 이어지는 0.42 m 고해상도 지형 패치)
LOT = (26.5, -28.0, 67.0, 56.0)
HAUS_BB = RRect(-25.15, -25.9, 25.15, 25.9)   # HAUS 캔틸레버 외곽
FORE = (-26.0, -31.5, 26.0, -17.0)            # HAUS 전정
GRAVEL = [(-24.6, -27.7, -3.6, -26.05), (3.6, -27.7, 24.6, -26.05)]   # 흰 자갈 화단(처마 낙수선)
PLANTERS = [(-21.0, -30.1, -9.0, -28.5), (9.0, -30.1, 21.0, -28.5)]   # 화단(높이 0.45 m)

# HAUS 대지 패드(C1)와 FaceArch 대지 패드(E1), 남측 갓길 보도(S)
BLOCKS = {
    'S':  (RRect(X0, -54.5, X1, TT[0]),                              (0.0, 0.0, 6.0, 0.0)),   # 국도 남측 보도/갓길 띠
    'C1': (RRect(-32.0, TT[1], 26.5, 27.5, (R_C, R_C, R_C, R_C)),    (4.0, 0.0, 1.2, 1.2)),   # HAUS 건축 대지 패드
    'E1': (RRect(AL[1], TT[1], 134.0, 38.0, (R_C, R_C, R_C, R_C)),   (4.0, 1.2, 1.2, 1.2)),   # FaceArch 건축 대지 패드
    'LOT_S': (RRect(26.5, TT[1], AL[0], -28.0, (0.0, R_C, 0.0, 0.0)), (7.5, 0.0, 0.0, 0.0)),  # 계곡 남측 국도변 보도·배수 사면 띠
}
INNER = {k: rr.inset_sides(*w) for k, (rr, w) in BLOCKS.items()}
CURBIN = {k: rr.inset_sides(*[CURB_W if v > 0 else 0.0 for v in w]) for k, (rr, w) in BLOCKS.items()}

# 맨홀과 빗물받이(산악 국도 배수구)
MANHOLES = [(-95, -40.4), (-62, -44.0), (-31, -38.6), (8, -45.6), (36, -40.1), (74, -43.3), (110, -38.4), (142, -45.0),
            (70.3, 12.0)]
DRAINS = []
for x in (-92, -68, -44, -24, 4, 28, 52, 92, 116, 140):
    DRAINS.append((x, TT[1] - 0.24, 0.0))
for x in (-98, -74, -50, -24, 6, 30, 54, 78, 102, 126, 150):
    DRAINS.append((x, TT[0] + 0.24, 0.0))
for y in (-15, 10):
    DRAINS.append((AL[0] + 0.24, y, 90.0)); DRAINS.append((AL[1] - 0.24, y, 90.0))

PITS = [(x, TT[0] - CURB_W - 0.4 - 0.6) for x in range(-98, 148, 16) if abs(x - XW) > 8 and not (30 < x < 58)]
PIT_H = 0.6

# ── 계곡 분지(LOT) 내부의 물웅덩이(수평 절단 수면), 이끼 언덕(MOUNDS), 갈래 물길(CHANNEL), 탐사 차량 바퀴 자국(TRACK)
POOLS = [
    ((39.5, 2.5), 4.2),     # 근경 대형 거울 웅덩이 (CAM_lot 정면)
    ((53.5, 18.5), 3.4),    # 중경 동쪽 웅덩이
    ((36.5, 29.5), 2.9),    # 중경 서쪽 웅덩이
    ((48.0, 43.0), 3.6),    # 북쪽 상류 웅덩이
    ((46.0, -11.5), 2.8),   # 국도 옆 하류 웅덩이
]
MOUNDS = [
    ((58.5, -8.5), 5.2, 0.68),
    ((32.5, -13.5), 4.2, 0.52),
    ((48.5, 34.0), 4.8, 0.62),
    ((60.5, 30.5), 3.8, 0.50),
    ((33.0, 14.5), 4.5, 0.58),
    ((57.0, 8.0), 4.0, 0.54),
    ((36.0, 46.5), 4.6, 0.64),
    ((59.5, 47.0), 4.2, 0.60),
]
# 주 계곡 물길 (북동 상류 → 웅덩이들을 거쳐 남서 국도 암거로 흐름)
CHANNEL = [
    (61.0, 54.5), (54.0, 48.5), (48.0, 43.0), (49.5, 35.0), (53.5, 26.5),
    (53.5, 18.5), (49.0, 11.5), (44.0, 6.0), (39.5, 2.5), (37.5, -3.5),
    (41.5, -8.5), (46.0, -11.5), (44.0, -18.5), (42.5, -26.5),
]
# 서쪽 지류 물길 (북서 계곡 → 서쪽 웅덩이 → 주 물길 합류)
CHANNEL_W = [
    (29.5, 53.0), (33.5, 44.0), (35.0, 36.5), (36.5, 29.5),
    (38.0, 21.0), (41.0, 12.5), (39.5, 2.5),
]
TRACK = [(43.5, -27.5), (44.2, -19.0), (43.8, -10.5), (41.8, -3.5), (39.8, 1.5)]
TRACK_HALF = 0.9

# ── 광역 산악 계곡 물길 (GR_terrain 위의 상류·하류 연속 수로)
UPPER_STREAM = [
    (22.0, 170.0), (26.0, 142.0), (34.0, 115.0), (42.0, 88.0), (49.0, 68.0), (60.0, 56.0),
]
LOWER_STREAM = [
    (42.5, -28.0), (41.0, -42.0), (38.0, -62.0), (31.0, -88.0), (22.0, -120.0), (14.0, -160.0),
]

FOUNDATION = [
    [(31.5, 18.5), (44.5, 18.5), (44.5, 30.5), (31.5, 30.5)],
    [(49.0, -18.5), (62.0, -18.5), (62.0, -5.5), (49.0, -5.5)],
]


# ═════════════════════════════ 높이·마스크 구동 함수 ═════════════════════════════
def _rect_d(r, x, y):
    x0, y0, x1, y1 = r
    dx = max(x0 - x, 0, x - x1); dy = max(y0 - y, 0, y - y1)
    if x0 <= x <= x1 and y0 <= y <= y1:
        return -min(x - x0, x1 - x, y - y0, y1 - y)
    return math.hypot(dx, dy)


def seg_dist(px, py, poly):
    best = 1e9
    for (ax, ay), (bx, by) in zip(poly[:-1], poly[1:]):
        vx, vy = bx - ax, by - ay; L2 = vx * vx + vy * vy
        t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((px - ax) * vx + (py - ay) * vy) / L2))
        best = min(best, math.hypot(px - ax - t * vx, py - ay - t * vy))
    return best


def in_road_corridor(x, y):
    """차도 영역 판정: 국도(TT) + 동쪽 FaceArch 지선(AL, y ∈ [-35.5, 38.0])."""
    if TT[0] <= y <= TT[1]:
        return True
    if AL[0] <= x <= AL[1] and TT[1] <= y <= 38.0:
        return True
    # 교차로 가각 회전 반지름 보정
    for rx in (AL[0] - R_C, AL[1] + R_C):
        if abs(x - (AL[0] + AL[1]) * 0.5) < (AL[1] - AL[0]) * 0.5 + R_C and TT[1] <= y <= TT[1] + R_C:
            if math.hypot(x - rx, y - (TT[1] + R_C)) > R_C:
                return True
    return False


def d_curb(x, y):
    """차도 위 점에서 가장 가까운 경계석까지 거리."""
    d_tt = min(abs(y - TT[0]), abs(y - TT[1])) if TT[0] <= y <= TT[1] else 99.0
    d_al = min(abs(x - AL[0]), abs(x - AL[1])) if (AL[0] <= x <= AL[1] and TT[1] <= y <= 38.0) else 99.0
    if TT[0] <= y <= TT[1] and AL[0] <= x <= AL[1]:
        return max(d_tt, d_al)
    return min(d_tt, d_al)


def _g(t, w=0.26):
    return math.exp(-(t / w) ** 2)


WHEEL_TT = [c + s for c in (-37.125, -40.375, -43.625, -46.875) for s in (-0.85, 0.85)]


def rut(x, y):
    r = 0.0
    if TT[0] <= y <= TT[1]:
        r = max(_g(y - w) for w in WHEEL_TT)
    if AL[0] <= x <= AL[1] and TT[1] <= y <= 38.0:
        r = max(r, max(_g(x - 70.0 - o) for o in (-0.85, 0.85)))
    return r


def undul(x, y):
    return n2(x, y, 1 / 21.0, seed=3.3, octaves=2)


def ramp_drop(x, y):
    if any(abs(y - yc) < 3.0 for yc in (TT[0], TT[1])):
        return 0.13 * (1 - smoothstep(CW, CW + 1.2, abs(x - XW)))
    return 0.0


def _near(pts, x, y, w):
    return max((math.exp(-((x - px) ** 2 + (y - py) ** 2) / (w * w)) for px, py in pts), default=0.0)


DRAIN_XY = [(d[0], d[1]) for d in DRAINS]


def road_z(x, y):
    d = max(0.0, min(6.5, d_curb(x, y)))
    z = Z_GUT + 0.02 * d
    z -= 0.022 * math.exp(-d / 0.28)
    z -= 0.016 * rut(x, y)
    z += 0.028 * undul(x, y) * (0.5 + 0.5 * smoothstep(0.0, 1.2, d))
    z -= 0.014 * _near(MANHOLES, x, y, 1.1)
    z -= 0.012 * _near(DRAIN_XY, x, y, 0.8)
    return z


def road_drive(x, y):
    d = max(0.0, min(6.5, d_curb(x, y)))
    u = undul(x, y)
    low = clamp01(0.5 - 0.9 * u)
    g = math.exp(-d / 0.75)
    rt = rut(x, y)
    water = max(g * (0.65 + 0.6 * low), rt * (0.05 + 1.15 * low))
    water = max(water, 0.75 * _near(MANHOLES, x, y, 1.0) * (0.4 + 0.6 * low), 0.8 * _near(DRAIN_XY, x, y, 0.9))
    # 계곡 물길이 국도를 가로지르는 구간(x 38..48)은 노면 위 물기·이끼 증가
    cross_stream = math.exp(-((x - 42.5) / 5.5) ** 2)
    water = clamp01(water + 0.45 * cross_stream)
    shelter = 0.92 * math.exp(-d / 0.32) + 0.45 * _near(MANHOLES, x, y, 0.55) + 0.45 * cross_stream
    traffic = smoothstep(0.5, 1.6, d) * (0.55 + 0.45 * rt)
    shelter *= (1 - 0.65 * traffic)
    return (clamp01(water), clamp01(shelter), 1.0, 0.0)


def pit_dist(x, y):
    return min((max(abs(x - px), abs(y - py)) - PIT_H for px, py in PITS), default=99.0)


def walk_ab(key, x, y):
    a = -CURBIN[key].sdf(x, y)
    b = INNER[key].sdf(x, y)
    return max(0.0, a), max(0.0, b)


def walk_z(key, x, y):
    a, b = walk_ab(key, x, y)
    t = b / max(1e-6, a + b)
    z = Z_CURB * t
    z += 0.006 * n2(x, y, 1 / 2.4, seed=11.0) * smoothstep(0.0, 0.35, a) * smoothstep(0.0, 0.35, b)
    z -= ramp_drop(x, y) * (1 - smoothstep(0.2, 1.6, a))
    return z


def walk_drive(key, x, y):
    a, b = walk_ab(key, x, y)
    settle = n2(x, y, 1 / 2.4, seed=11.0)
    water = clamp01(-settle * 1.4 - 0.12) * 0.78
    rd = ramp_drop(x, y)
    if rd > 0:
        water = max(water, rd / 0.13 * (1 - smoothstep(0.0, 1.3, a)) * 0.85)
    dp = pit_dist(x, y)
    shelter = 0.88 * math.exp(-b / 1.1) + 0.78 * math.exp(-a / 0.65) + 0.8 * math.exp(-max(0.0, dp) / 0.6) + 0.32
    traffic = smoothstep(0.6, 1.6, min(a, b)) * 0.7
    shelter *= (1 - 0.45 * traffic)
    return (clamp01(water), clamp01(shelter), 1.0, 0.0)


def covered(x, y):
    return smoothstep(0.5, -0.5, HAUS_BB.sdf(x, y))


def lot_z(key, x, y):
    e = -INNER[key].sdf(x, y)
    f = smoothstep(0.0, 0.6, e)
    if key == 'C1':
        f *= smoothstep(0.0, 0.6, _rect_d(FORE, x, y))
    return 0.008 * n2(x, y, 1 / 6.0, seed=31.0) * f


def lot_drive(key, x, y):
    e = -INNER[key].sdf(x, y)
    water = clamp01(-n2(x, y, 1 / 6.0, seed=31.0) * 1.3 - 0.08) * 0.65
    shelter = 0.72 * math.exp(-max(0.0, e) / 0.9) + 0.22
    cv = covered(x, y)
    shelter = max(shelter, 0.85 * cv)
    return (water, clamp01(shelter), 1 - cv, 0.0)


def fore_z(x, y):
    e = min(-_rect_d(FORE, x, y), min(_rect_d(h, x, y) for h in GRAVEL + PLANTERS))
    return 0.004 * n2(x, y, 1 / 3.0, seed=41.0) * smoothstep(0.0, 0.4, e)


def fore_drive(x, y):
    cv = covered(x, y)
    near_bed = min(_rect_d(r, x, y) for r in GRAVEL + PLANTERS)
    shelter = 0.72 * math.exp(-max(0.0, near_bed) / 0.28) + 0.85 * cv
    water = clamp01(-n2(x, y, 1 / 3.0, seed=41.0) * 1.2 - 0.18) * 0.65
    return (water, clamp01(shelter), 1 - cv, 0.0)


# ── 광역 산악 지형 높이 함수 (대지 패드·도로·계곡 분지 경계에서는 0으로 매끄럽게 수렴)
def mountain_boundary_dist(x, y):
    """도로·보도·건축 패드·계곡 분지(LOT) 바깥에서 가장 가까운 경계까지의 거리."""
    d_c1 = BLOCKS['C1'][0].sdf(x, y)
    d_e1 = BLOCKS['E1'][0].sdf(x, y)
    d_s  = BLOCKS['S'][0].sdf(x, y)
    d_lot = _rect_d(LOT, x, y)
    d_tt = max(TT[0] - y, y - TT[1])
    d_al = max(AL[0] - x, x - AL[1], TT[1] - y, y - 38.0)
    return max(0.0, min(d_c1, d_e1, d_s, d_lot, d_tt, d_al))


def terrain_z(x, y):
    """주변 산악 지형 높이: 경계에서 0으로 시작해 북·동·서쪽 산비탈과 남쪽 협곡/능선으로 자연스럽게 이어진다."""
    bd = mountain_boundary_dist(x, y)
    edge_fade = smoothstep(0.0, 3.2, bd)
    if edge_fade <= 1e-5:
        return 0.0

    # 1. 북쪽 대산악 사면 (y > 28 → +172 m 에서 최대 +38 m, 단 계곡 물길 통로 x ≈ 22..50 은 완만한 협곡 바닥)
    ny = smoothstep(26.0, 168.0, y)
    # 상류 계곡 물길까지의 거리
    d_up = seg_dist(x + 2.5 * n2(x, y, 0.03, 14.0), y, UPPER_STREAM)
    gorge_cut = 1.0 - 0.72 * math.exp(-(d_up / 26.0) ** 2)
    h_north = 36.0 * (ny ** 1.32) * gorge_cut

    # 2. 서쪽 산악 능선 (x < -32 → -112 m 에서 최대 +26 m, 국도 주변은 낮음)
    rd_tt = smoothstep(4.0, 26.0, max(0.0, TT[0] - y, y - TT[1]))
    wx = smoothstep(-30.0, -110.0, x) * rd_tt
    h_west = 24.0 * (wx ** 1.35)

    # 3. 동쪽 산악 능선 (FaceArch 동쪽 x > 130 또는 북동쪽 x > 73, y > 38)
    ex1 = smoothstep(128.0, 162.0, x) * rd_tt
    ex2 = smoothstep(68.0, 155.0, x) * smoothstep(36.0, 135.0, y)
    h_east = 22.0 * (ex1 ** 1.3) + 25.0 * (ex2 ** 1.25)

    # 4. 남쪽 협곡(y -58..-95)과 남쪽 건너편 이끼 언덕 능선(y -95..-162)
    d_low = seg_dist(x + 2.0 * n2(x, y, 0.04, 18.0), y, LOWER_STREAM)
    s_gorge = math.exp(-((y + 74.0) / 16.0) ** 2) * smoothstep(0.0, 8.0, -54.5 - y)
    h_south_gorge = -4.2 * s_gorge * (0.55 + 0.45 * math.exp(-(d_low / 28.0) ** 2))
    sy = smoothstep(-86.0, -160.0, y)
    h_south_ridge = (18.5 * (sy ** 1.25) + 7.5 * smoothstep(-20.0, -105.0, x) * sy) * (1.0 - 0.55 * math.exp(-(d_low / 22.0) ** 2))

    # 5. 다중 옥타브 산악 기복 및 단구(terrace) 층리
    n_macro = 5.5 * n2(x, y, 1 / 48.0, seed=101.0, octaves=3)
    n_mid   = 1.8 * n2(x, y, 1 / 16.0, seed=202.0, octaves=2)
    n_micro = 0.32 * n2(x, y, 1 / 4.2, seed=303.0, octaves=2)
    relief_scale = smoothstep(1.5, 18.0, bd) * rd_tt

    # 상류·하류 물길 바닥 파임
    stream_cut = 0.95 * math.exp(-(d_up / 2.2) ** 2) * smoothstep(45.0, 62.0, y)
    stream_cut += 0.85 * math.exp(-(d_low / 2.4) ** 2) * smoothstep(-54.5, -62.0, y)

    h = h_north + h_west + h_east + h_south_gorge + h_south_ridge
    h += (n_macro + n_mid) * relief_scale + n_micro * smoothstep(0.5, 4.0, bd)
    h -= stream_cut

    # 단구(테라스) 효과: 중간 고도에서 데스 스트랜딩 특유의 계단식 암반 + 이끼 평탄면 형성
    if h > 2.5:
        terrace = math.sin(h * 0.85) * 0.32 * smoothstep(2.5, 12.0, h)
        h += terrace

    return h * edge_fade


def terrain_drive(x, y):
    """광역 산악 지형의 nw_drive (R 물 모임, G 이끼/그늘 잠재력, B 비 노출=1, A 고인 물=0).
    주의: A(Fill)는 성긴 격자에서 계단 현상을 일으키므로 0으로 두고, R(water)과 G(shelter)로 NW_GroundMask 의
    월드 노이즈(nL, nM, nS)가 자연스러운 물길·이끼 경계를 생성하게 한다."""
    z = terrain_z(x, y)
    eps = 1.2
    zx = (terrain_z(x + eps, y) - terrain_z(x - eps, y)) / (2 * eps)
    zy = (terrain_z(x, y + eps) - terrain_z(x, y - eps)) / (2 * eps)
    slope = math.hypot(zx, zy)
    lap = (terrain_z(x + eps, y) + terrain_z(x - eps, y) + terrain_z(x, y + eps) + terrain_z(x, y - eps)) * 0.25 - z
    conc = clamp01(lap / 0.28)

    d_up = seg_dist(x + 1.2 * n2(x, y, 0.08, 14.0), y, UPPER_STREAM)
    d_low = seg_dist(x + 1.2 * n2(x, y, 0.08, 18.0), y, LOWER_STREAM)
    # 상류(y > 56)에서도 경사도가 가파른 폭포 구간은 흰 반사 웅덩이 대신 젖은 어두운 바위+이끼만 남도록 제한
    s_ch = max(
        math.exp(-(d_up / 1.45) ** 2) * smoothstep(54.0, 62.0, y) * (1.0 - 0.85 * smoothstep(0.18, 0.42, slope)),
        math.exp(-(d_low / 1.65) ** 2) * smoothstep(-53.5, -58.0, y) * (1.0 - 0.85 * smoothstep(0.18, 0.42, slope)),
    )

    water = clamp01((0.52 * (s_ch ** 1.8) + 0.34 * conc + 0.24 * smoothstep(-1.2, -3.8, z)) * (1.0 - smoothstep(0.22, 0.48, slope)))
    # 완만한 사면·오목부·물가에는 짙은 올리브 이끼(G 높음), 가파른 절벽면(slope > 0.75)은 바위 노출
    flatness = 1.0 - smoothstep(0.38, 0.92, slope)
    moss_patch = 0.5 + 0.5 * n2(x, y, 1 / 18.0, seed=404.0, octaves=2)
    shelter = clamp01((0.50 + 0.48 * moss_patch + 0.65 * conc + 0.55 * s_ch) * flatness + 0.15 * conc)
    return (water, shelter, 1.0, 0.0)


# ═════════════════════════════ 재질(lib.Mat 기반, ≤ 8) ═════════════════════════════
def _uvsep(M, name='UVMap'):
    u = M.b.node('ShaderNodeUVMap', uv_map=name)
    return M.b.sepxyz(u.outputs['UV'])


def mat_asphalt():
    """산악 국도 노면: clean_asphalt + road_damaged 균열·마모 + 타르 실링 줄."""
    M = lib.Mat('NW_asphalt'); b = M.b
    t = M.texset('clean_asphalt', M.uv(3.5))
    t2 = M.texset('road_damaged', M.uv(3.0, offset=(0.3, 0.6)))
    P = M.pos
    c1 = M.grade(t['color'], 0.5, srgb('#DFDDD8'))
    c2 = M.grade(t2['color'], 0.25, None, 0.58)
    rav = b.smooth(0.48, 0.66, b.noise(P, 0.14, 5.0, 0.65))
    col = b.col(b.mul(rav, 0.65), c1, c2)
    rough = b.flt(rav, t['rough'], t2['rough'])
    hgt = b.flt(rav, t['height'], t2['height'])
    nrm = b.mix('VECTOR', b.mul(rav, 0.85), t['normal'], t2['normal'])
    # 실링 균열
    cn = b.noise(P, 0.22, 3.0, 0.55, dist=0.4)
    line = b.sub(1.0, b.smooth(0.0, 0.009, b.math('ABSOLUTE', b.sub(cn, 0.5))))
    gate = b.smooth(0.48, 0.6, b.noise(P, 0.05, 2.0, 0.5))
    crack = b.mul(line, gate)
    col = b.col(crack, col, srgb('#1A1918'))
    rough = b.flt(crack, rough, 0.38)
    hgt = b.flt(crack, hgt, 0.15)
    nrm = M.micro(nrm, 'clean_asphalt', 0.55, 0.7)
    col = M.macro_var(col, 0.18)
    stain = b.mul(b.smooth(0.5, 0.75, b.noise(P, 0.35, 4.0, 0.6)), 0.35)
    col = b.col(stain, col, srgb('#282725'))
    mk = M.mask(base_wet=0.42, moss_bias=-0.04)
    s = M.surface(col, rough, nrm, hgt, mk, crevice_moss=2.8, crevice_puddle=0.75, porosity=0.55, wet_gloss=0.72)
    return M.finish(s.outputs['Color'], s.outputs['Roughness'], s.outputs['Normal'])


def mat_paint(name, hexcol, tactile=False):
    M = lib.Mat(name); b = M.b
    t = M.texset('clean_asphalt', M.uv(3.5))
    P = M.pos
    wear = b.add(b.noise(P, 1.1, 4.0, 0.6), b.mul(b.sub(b.noise(P, 7.0, 2.0, 0.6), 0.5), 0.5))
    wear = b.smooth(0.54, 0.63, wear)
    paint = b.col(1.0, srgb(hexcol), b.rgb(0.78, 0.78, 0.76), 'MULTIPLY')
    asph = M.grade(t['color'], 0.55, srgb('#E4E2DE'))
    col = b.col(wear, paint, asph)
    rough = b.flt(wear, 0.52, t['rough'])
    hgt = b.flt(wear, 0.62, t['height'])
    nrm = t['normal']
    if tactile:
        u, v, _ = _uvsep(M)
        bar_mode = b.mul(b.math('GREATER_THAN', u, 500.0), b.math('LESS_THAN', u, 1500.0))
        dot_mode = b.math('GREATER_THAN', u, 1500.0)
        tmode = b.mx(bar_mode, dot_mode)
        lu = b.math('MODULO', b.sub(u, 0.0), 0.3); lv = b.math('MODULO', b.add(v, 300.0), 0.3)
        fu = b.math('DIVIDE', lu, 0.3); fv = b.math('DIVIDE', lv, 0.3)
        fb = b.math('FRACT', b.mul(fv, 4.0))
        bar = b.mul(b.sub(1.0, b.smooth(0.22, 0.3, b.math('ABSOLUTE', b.sub(fb, 0.5)))),
                    b.mul(b.smooth(0.04, 0.09, fu), b.smooth(0.96, 0.91, fu)))
        du = b.sub(b.math('FRACT', b.mul(fu, 6.0)), 0.5); dv = b.sub(b.math('FRACT', b.mul(fv, 6.0)), 0.5)
        r = b.math('SQRT', b.add(b.mul(du, du), b.mul(dv, dv)))
        dot = b.sub(1.0, b.smooth(0.26, 0.34, r))
        joint = b.mul(b.smooth(0.0, 0.03, fu), b.mul(b.smooth(1.0, 0.97, fu), b.mul(b.smooth(0.0, 0.03, fv), b.smooth(1.0, 0.97, fv))))
        th = b.flt(dot_mode, bar, dot)
        th = b.mul(b.add(b.mul(th, 0.7), 0.3), joint)
        bump = b.node('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.8; bump.inputs['Distance'].default_value = 0.006
        b.put(bump.inputs['Height'], th)
        tcol = srgb('#B0953A')
        grime = b.smooth(0.4, 0.75, b.noise(P, 2.2, 3.0, 0.6))
        tcol = b.col(b.add(b.mul(grime, 0.45), b.mul(b.sub(1.0, th), 0.35)), tcol, srgb('#4E4430'))
        col = b.col(tmode, col, tcol)
        rough = b.flt(tmode, rough, 0.62)
        hgt = b.flt(tmode, hgt, th)
        nrm = b.mix('VECTOR', tmode, nrm, bump.outputs['Normal'])
    col = M.macro_var(col, 0.1)
    mk = M.mask(base_wet=0.4, moss_bias=-0.2)
    s = M.surface(col, rough, nrm, hgt, mk, crevice_moss=2.0, crevice_puddle=0.6, porosity=0.35, wet_gloss=0.6)
    return M.finish(s.outputs['Color'], s.outputs['Roughness'], s.outputs['Normal'])


def mat_pavers():
    """HAUS 전정·보도블록: concrete_pavers_02 회색 석재 + 줄눈 이끼."""
    M = lib.Mat('NW_pavers'); b = M.b
    t = M.texset('concrete_pavers_02', M.uv(2.0))
    col = M.grade(t['color'], 0.22, srgb('#D4D6D4'), 0.96)
    nrm = M.micro(t['normal'], 'concrete_floor_worn_001', 0.6, 0.6)
    col = M.macro_var(col, 0.16)
    P = M.pos
    blot = b.mul(b.smooth(0.54, 0.72, b.noise(P, 0.55, 5.0, 0.62)), 0.45)
    col = b.col(blot, col, srgb('#44453E'))
    mk = M.mask(base_wet=0.45, moss_bias=0.05)
    s = M.surface(col, t['rough'], nrm, t['height'], mk, crevice_moss=5.0, crevice_puddle=1.0, porosity=0.48, wet_gloss=0.5)
    return M.finish(s.outputs['Color'], s.outputs['Roughness'], s.outputs['Normal'])


def mat_concrete():
    """경계석·화단 벽·대지 패드·암거 기초: concrete_floor_worn_001."""
    M = lib.Mat('NW_concrete'); b = M.b
    t = M.texset('concrete_floor_worn_001', M.uv(2.2))
    u, v, _ = _uvsep(M)
    is_curb = b.math('GREATER_THAN', v, 500.0)
    ju = b.math('ABSOLUTE', b.sub(b.math('FRACT', b.add(u, 0.5)), 0.5))
    joint = b.mul(b.sub(1.0, b.smooth(0.003, 0.011, ju)), is_curb)
    vv = b.sub(v, 1000.0)
    grime = b.mul(b.sub(1.0, b.smooth(0.1, 0.24, vv)), is_curb)
    col = M.grade(t['color'], 0.48, srgb('#D5D5D2'))
    col = b.col(b.mul(grime, 0.55), col, srgb('#383933'))
    col = b.col(b.mul(joint, 0.8), col, srgb('#282724'))
    hgt = b.mul(t['height'], b.sub(1.0, b.mul(joint, 0.95)))
    bump = b.node('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.6; bump.inputs['Distance'].default_value = 0.01
    b.put(bump.inputs['Height'], b.sub(1.0, joint)); b.put(bump.inputs['Normal'], t['normal'])
    nrm = M.micro(bump.outputs['Normal'], 'concrete_floor_worn_001', 0.5, 0.5)
    col = M.macro_var(col, 0.14, 0.08)
    mk = M.mask(base_wet=0.38, moss_bias=0.04)
    s = M.surface(col, t['rough'], nrm, hgt, mk, crevice_moss=2.8, crevice_puddle=0.8, porosity=0.45, wet_gloss=0.55)
    return M.finish(s.outputs['Color'], s.outputs['Roughness'], s.outputs['Normal'])


def mat_lot():
    """DS2 산악 계곡 토양·화산쇄설물·현무암 바닥: coast_sand_rocks_02 + dark_rock 노이즈 블렌딩 + 근경 마이크로 노멀.
    (인공 보도블록인 mossy_cobblestone 은 절대 쓰지 않는다!)"""
    M = lib.Mat('NW_lot'); b = M.b
    t = M.texset('coast_sand_rocks_02', M.uv(3.4))
    t2 = M.texset('dark_rock', M.uv(2.8, offset=(0.25, 0.65)))
    P = M.pos
    # 참조 화면의 계곡 바닥 = 초록·황록 이끼와 풀 사이로 회색 돌이 드러난 땅: coast_sand_rocks_02(원래 이끼+돌)의 채도를 살린다
    soil = M.grade(t['color'], 1.05, srgb('#D2DAB4'), 1.55)
    soil = b.col(0.12, soil, srgb('#232A19'))
    basalt = M.grade(t2['color'], 0.5, srgb('#E4E8E6'), 4.6)
    pm = b.mul(b.smooth(0.56, 0.70, b.noise(P, 0.09, 4.0, 0.6, dist=0.35)), 0.55)
    col = b.col(pm, soil, basalt)
    rough = b.flt(pm, t['rough'], t2['rough'])
    hgt = b.flt(pm, t['height'], t2['height'])
    nrm = b.mix('VECTOR', pm, t['normal'], t2['normal'])
    nrm = M.micro(nrm, 'coast_sand_rocks_02', 0.48, 0.65)
    col = M.macro_var(col, 0.22, 0.06)
    mk = M.mask(base_wet=0.32, moss_bias=0.30)
    s = M.surface(col, rough, nrm, hgt, mk, crevice_moss=1.8, crevice_puddle=0.65, porosity=0.52, wet_gloss=0.22)
    return M.finish(s.outputs['Color'], s.outputs['Roughness'], s.outputs['Normal'], spec=0.38)


def mat_rock_slope():
    """가파른 산악 암반 사면·바위 슬래브: dark_rock + lichen_rock 노이즈 블렌딩."""
    M = lib.Mat('NW_rock_slope'); b = M.b
    t = M.texset('dark_rock', M.uv(3.6))
    t2 = M.texset('lichen_rock', M.uv(2.6, offset=(0.4, 0.2)))
    P = M.pos
    # 원본 평균 선형 알베도 dark_rock ≈0.0125·lichen_rock ≈0.05 → 참조 화면의 회색 암반(≈0.07~0.11)
    c1 = M.grade(t['color'], 0.5, srgb('#E2E6E4'), 4.6)
    c2 = M.grade(t2['color'], 0.5, srgb('#E0E4DC'), 2.3)
    pm = b.smooth(0.45, 0.65, b.noise(P, 0.08, 4.0, 0.6, dist=0.3))
    col = b.col(pm, c1, c2)
    rough = b.flt(pm, t['rough'], t2['rough'])
    hgt = b.flt(pm, t['height'], t2['height'])
    nrm = b.mix('VECTOR', pm, t['normal'], t2['normal'])
    nrm = M.micro(nrm, 'dark_rock', 0.55, 0.6)
    col = M.macro_var(col, 0.20, 0.05)
    mk = M.mask(base_wet=0.32, moss_bias=0.14)
    s = M.surface(col, rough, nrm, hgt, mk, crevice_moss=2.8, crevice_puddle=0.5, porosity=0.55, wet_gloss=0.55)
    return M.finish(s.outputs['Color'], s.outputs['Roughness'], s.outputs['Normal'], spec=0.45)


def mat_gravel():
    M = lib.Mat('NW_gravel'); b = M.b
    u = b.node('ShaderNodeUVMap', uv_map='UVMap')
    vor = b.node('ShaderNodeTexVoronoi', voronoi_dimensions='2D', feature='F1')
    vor.inputs['Scale'].default_value = 30.0; vor.inputs['Randomness'].default_value = 0.9
    b.L.new(u.outputs['UV'], vor.inputs['Vector'])
    vor2 = b.node('ShaderNodeTexVoronoi', voronoi_dimensions='2D', feature='F1')
    vor2.inputs['Scale'].default_value = 47.0; vor2.inputs['Randomness'].default_value = 1.0
    b.L.new(u.outputs['UV'], vor2.inputs['Vector'])
    p1 = b.sub(1.0, b.smooth(0.12, 0.5, vor.outputs['Distance']))
    p2 = b.mul(b.sub(1.0, b.smooth(0.1, 0.48, vor2.outputs['Distance'])), 0.8)
    peb = b.mx(p1, p2)
    tone = b.sep(vor.outputs['Color'])[0]
    col = b.col(tone, srgb('#B9B7B0'), srgb('#E3E1DA'))
    col = b.col(b.sub(1.0, b.smooth(0.05, 0.35, peb)), col, srgb('#55534D'))
    bump = b.node('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.9; bump.inputs['Distance'].default_value = 0.012
    b.put(bump.inputs['Height'], peb)
    rough = b.flt(peb, 0.85, 0.55)
    col = M.macro_var(col, 0.08, 0.3)
    mk = M.mask(base_wet=0.3, moss_bias=-0.25)
    s = M.surface(col, rough, bump.outputs['Normal'], peb, mk, crevice_moss=2.0, crevice_puddle=0.5, porosity=0.35, wet_gloss=0.45)
    return M.finish(s.outputs['Color'], s.outputs['Roughness'], s.outputs['Normal'])


def mat_iron():
    M = lib.Mat('NW_iron'); b = M.b
    u, v, _ = _uvsep(M)
    mode = b.math('FLOOR', b.math('DIVIDE', u, 10.0))
    lu = b.sub(u, b.mul(mode, 10.0))
    m0 = b.math('LESS_THAN', mode, 0.5)
    m1 = b.mul(b.math('GREATER_THAN', mode, 0.5), b.math('LESS_THAN', mode, 1.5))
    m2 = b.mul(b.math('GREATER_THAN', mode, 1.5), b.math('LESS_THAN', mode, 2.5))
    m3 = b.math('GREATER_THAN', mode, 2.5)
    cx = b.sub(lu, 0.5); cy = b.sub(v, 0.5)
    r = b.math('SQRT', b.add(b.mul(cx, cx), b.mul(cy, cy)))
    ring = b.sub(1.0, b.smooth(0.006, 0.018, b.math('ABSOLUTE', b.sub(b.math('FRACT', b.mul(r, 9.0)), 0.5))))
    gx = b.math('ABSOLUTE', b.sub(b.math('FRACT', b.mul(lu, 34.0)), 0.5))
    gy = b.math('ABSOLUTE', b.sub(b.math('FRACT', b.mul(v, 34.0)), 0.5))
    knurl = b.mul(b.smooth(0.3, 0.2, gx), b.smooth(0.3, 0.2, gy))
    h0 = b.mul(b.sub(1.0, ring), b.add(0.5, b.mul(knurl, 0.5)))
    slot = b.math('ABSOLUTE', b.sub(b.math('FRACT', b.mul(v, 11.0)), 0.5))
    bars = b.smooth(0.18, 0.26, slot)
    frame1 = b.sub(1.0, b.mul(b.mul(b.smooth(0.05, 0.08, lu), b.smooth(0.95, 0.92, lu)),
                               b.mul(b.smooth(0.08, 0.14, v), b.smooth(0.92, 0.86, v))))
    h1 = b.mx(bars, frame1)
    su = b.math('ABSOLUTE', b.sub(b.math('FRACT', b.mul(lu, 16.0)), 0.5))
    sv = b.math('ABSOLUTE', b.sub(b.math('FRACT', b.mul(v, 4.0)), 0.5))
    gbars = b.mx(b.smooth(0.2, 0.27, su), b.smooth(0.38, 0.45, sv))
    rim = b.sub(1.0, b.mul(b.mul(b.smooth(0.03, 0.06, lu), b.smooth(0.97, 0.94, lu)), b.mul(b.smooth(0.03, 0.06, v), b.smooth(0.97, 0.94, v))))
    hole = b.smooth(0.2, 0.22, r)
    h2 = b.mul(b.mx(gbars, rim), hole)
    h = b.add(b.add(b.mul(h0, m0), b.mul(h1, m1)), b.add(b.mul(h2, m2), b.mul(0.6, m3)))
    iron = srgb('#2C2B29'); rust = srgb('#5A3B27'); soil = srgb('#1E1A15')
    rn = b.noise(M.pos, 6.0, 4.0, 0.6)
    col = b.col(b.smooth(0.45, 0.7, b.add(b.mul(b.sub(1.0, h), 0.6), b.mul(rn, 0.5))), iron, rust)
    col = b.col(m3, col, b.col(b.smooth(0.4, 0.6, rn), srgb('#6E3D22'), srgb('#3F2618')))
    deep = b.mul(b.sub(1.0, h), b.add(m1, m2))
    col = b.col(b.mul(deep, 0.85), col, soil)
    rough = b.flt(h, 0.85, 0.72)
    rough = b.flt(m3, rough, 0.85)
    metal = b.flt(b.add(b.add(m3, b.mul(m2, 0.7)), b.mul(deep, 1.0)), b.mul(h, 0.45), 0.0)
    bump = b.node('ShaderNodeBump'); bump.inputs['Strength'].default_value = 1.0; bump.inputs['Distance'].default_value = 0.01
    b.put(bump.inputs['Height'], h)
    mk = M.mask(base_wet=0.4, moss_bias=-0.2)
    s = M.surface(col, rough, bump.outputs['Normal'], h, mk, crevice_moss=1.0, crevice_puddle=0.4, porosity=0.25, wet_gloss=0.35)
    return M.finish(s.outputs['Color'], s.outputs['Roughness'], s.outputs['Normal'], metallic=metal)


# ═════════════════════════════ 메시 도우미 ═════════════════════════════
def finalize(o, surface, drive=None):
    lib.tag(o, surface)
    if drive is not None:
        lib.write_drive(o.data, [drive(v.co.x, v.co.y) for v in o.data.vertices])
    return o


def make_surface(name, c, mat, loops, points, inside, zfn, drive, surface='ground', min_gap=0.06, dist_fn=None):
    v2, tris = lib.cdt(loops, points, inside, min_gap=min_gap, dist_fn=dist_fn)
    verts = [(x, y, zfn(x, y)) for x, y in v2]
    o = lib.mesh_obj(name, verts, tris, c, mat)
    finalize(o, surface, drive)
    return o, verts, tris


def dedupe(pts, cell=0.14):
    seen = set(); out = []
    for p in pts:
        k = (round(p[0] / cell), round(p[1] / cell))
        if k not in seen:
            seen.add(k); out.append(p)
    return out


def in_scene(x, y, m=0.0):
    return X0 + m <= x <= X1 - m and Y0 + m <= y <= Y1 - m


def strip(pts_xy, w, step=0.5):
    V = []; F = []
    for (ax, ay), (bx, by) in zip(pts_xy[:-1], pts_xy[1:]):
        L = math.hypot(bx - ax, by - ay); n = max(1, int(math.ceil(L / step)))
        tx, ty = (bx - ax) / L, (by - ay) / L; nx, ny = -ty * w / 2, tx * w / 2
        base = len(V)
        for i in range(n + 1):
            px, py = ax + (bx - ax) * i / n, ay + (by - ay) * i / n
            V.append((px - nx, py - ny)); V.append((px + nx, py + ny))
        for i in range(n):
            a = base + 2 * i
            F.append((a, a + 2, a + 3, a + 1))
    return V, F


def rect_strip(x0, y0, x1, y1, step=0.5, step_across=None):
    nx = max(1, int(math.ceil((x1 - x0) / step)))
    ny = max(1, int(math.ceil((y1 - y0) / (step_across or step))))
    V = [(x0 + (x1 - x0) * i / nx, y0 + (y1 - y0) * j / ny) for j in range(ny + 1) for i in range(nx + 1)]
    F = [(j * (nx + 1) + i, j * (nx + 1) + i + 1, (j + 1) * (nx + 1) + i + 1, (j + 1) * (nx + 1) + i)
         for j in range(ny) for i in range(nx)]
    return V, F


class Acc:
    def __init__(self):
        self.V = []; self.F = []; self.UV = []

    def add(self, V, F, uvfn=None):
        base = len(self.V)
        self.V.extend(V)
        for f in F:
            self.F.append(tuple(base + i for i in f))
            self.UV.append([uvfn(V[i]) if uvfn else (V[i][0], V[i][1]) for i in f])


def acc_obj(name, acc, c, mat, zfn, surface, drive, offset=0.0, uv_override=True):
    verts = [(x, y, zfn(x, y) + offset) for x, y in acc.V]
    o = lib.mesh_obj(name, verts, acc.F, c, mat)
    if uv_override:
        lib.set_uv(o.data, 'UVMap', None, per_loop=[uv for f in acc.UV for uv in f])
    finalize(o, surface, drive)
    return o


def revolve(profile, seg=28):
    V = [(0.0, 0.0, profile[0][1])]
    for r, z in profile[1:]:
        for k in range(seg):
            a = 2 * math.pi * k / seg
            V.append((r * math.cos(a), r * math.sin(a), z))
    F = []
    for k in range(seg):
        F.append((0, 1 + k, 1 + (k + 1) % seg))
    for ring in range(len(profile) - 2):
        b0 = 1 + ring * seg; b1 = b0 + seg
        for k in range(seg):
            k2 = (k + 1) % seg
            F.append((b0 + k, b1 + k, b1 + k2, b0 + k2))
    return V, F


def rect_rings(rings):
    V = []; F = []
    for hx, hy, z in rings:
        V.extend([(-hx, -hy, z), (hx, -hy, z), (hx, hy, z), (-hx, hy, z)])
    F.append((0, 1, 2, 3))
    for i in range(len(rings) - 1):
        a = 4 * i; b = a + 4
        for k in range(4):
            k2 = (k + 1) % 4
            F.append((a + k, b + k, b + k2, a + k2))
    return V, F


def proto_mesh(name, V, F, mat, uvfn, mask_fn, smooth=False):
    me = bpy.data.meshes.get(name)
    if me is not None and me.users == 0:
        bpy.data.meshes.remove(me)
    me = bpy.data.meshes.new(name)
    me.from_pydata(V, [], F); me.validate()
    lib.orient_up(me)
    if uvfn is not None:
        lib.set_uv(me, 'UVMap', uvfn)
    me.materials.append(mat)
    if smooth:
        me.shade_smooth()
    lib.write_mask(me, mask_fn)
    return me


def place(name, me, c, loc, rz=0.0, rx=0.0, ry=0.0, s=1.0, surface='metal'):
    o = bpy.data.objects.new(name, me)
    o.location = loc; o.rotation_euler = (rx, ry, rz)
    o.scale = (s, s, s) if isinstance(s, (int, float)) else s
    c.objects.link(o)
    lib.tag(o, surface, nw_vmask=1.0)
    return o


def slot(c, name, loc, rz=0.0, size=(1, 1)):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = 'CUBE'; e.empty_display_size = 0.5
    e.location = loc; e.rotation_euler = (0, 0, rz)
    e['size'] = list(size)
    c.objects.link(e)
    return e


def chunk_mesh(seed, flat):
    """각진 현무암 잡석(볼록 껍질)."""
    rnd = random.Random(seed)
    bm = bmesh.new()
    for _ in range(14):
        v = Vector((rnd.gauss(0, 1), rnd.gauss(0, 1), rnd.gauss(0, 1))).normalized()
        v.x *= rnd.uniform(0.8, 1.25); v.y *= rnd.uniform(0.7, 1.15); v.z *= flat * rnd.uniform(0.75, 1.1)
        bm.verts.new(v * 0.5)
    res = bmesh.ops.convex_hull(bm, input=list(bm.verts))
    for el in res.get('geom_interior', []) + res.get('geom_unused', []):
        if isinstance(el, bmesh.types.BMVert) and el.is_valid:
            bm.verts.remove(el)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    zmin = min(v.co.z for v in bm.verts)
    for v in bm.verts:
        v.co.z -= zmin
    V = [tuple(v.co) for v in bm.verts]
    idx = {v: i for i, v in enumerate(bm.verts)}
    F = [tuple(idx[v] for v in f.verts) for f in bm.faces]
    h = max(v[2] for v in V)
    bm.free()
    return V, F, h


# ═════════════════════════════ 조립 ═════════════════════════════
def build():
    t0 = time.time()
    sc = lib.get_scene(True)
    lib.setup_render(sc)
    lib.setup_world(sc)
    G = lib.coll('NW_ground', sc)
    FX = lib.coll('NW_fx', sc)
    LAY = lib.coll('NW_layout', sc)
    SL = lib.coll('NW_slots', sc)
    for c in (G, SL):
        lib.clear_coll(c)
    lib.setup_fog(sc, FX, base=0.0034, haze=0.00055)

    MAT = {
        'asphalt': mat_asphalt(),
        'white': mat_paint('NW_paint_white', '#E9E9E4'),
        'yellow': mat_paint('NW_paint_yellow', '#CFA932', tactile=True),
        'pavers': mat_pavers(),
        'concrete': mat_concrete(),
        'lot': mat_lot(),
        'rock_slope': mat_rock_slope(),
        'gravel': mat_gravel(),
        'iron': mat_iron(),
    }
    print('materials', round(time.time() - t0, 1))

    # ── 1. 차도(산악 국도 TT + 동쪽 FaceArch 지선 AL): 정밀 CDT
    road_poly = [
        (X0, TT[0]), (X1, TT[0]), (X1, TT[1]),
        (AL[1], TT[1]), (AL[1], 38.0), (AL[0], 38.0), (AL[0], TT[1]),
        (X0, TT[1]),
    ]
    road_loop = []
    n_rp = len(road_poly)
    for i in range(n_rp):
        a, b = road_poly[i], road_poly[(i + 1) % n_rp]
        L = math.dist(a, b); steps = max(1, int(math.ceil(L / 1.5)))
        for k in range(steps):
            t = k / steps
            road_loop.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))

    pts = []
    xs = [X0 + 0.6 * i for i in range(int((X1 - X0) / 0.6) + 1)]
    for wy in WHEEL_TT + [TT[0] + 0.15, TT[0] + 0.4, TT[1] - 0.15, TT[1] - 0.4]:
        for o in (-0.2, 0.0, 0.2):
            pts.extend((x, wy + o) for x in xs[::2])
    ys_al = [TT[1] + 0.6 * i for i in range(int((38.0 - TT[1]) / 0.6) + 1)]
    for ox in (-2.7, -0.85, 0.85, 2.7):
        pts.extend((70.0 + ox, y) for y in ys_al[::2])
    for (mx, my) in MANHOLES:
        pts.extend(lib.poly_circle(mx, my, 0.9, 10)); pts.extend(lib.poly_circle(mx, my, 0.5, 8))
    pts.extend(lib.grid_points(X0, TT[0], X1, 38.0, 1.3, jitter=0.25, seed=5))
    road_inside = lambda x, y: in_scene(x, y, 0.02) and (
        (TT[0] < y < TT[1]) or (AL[0] < x < AL[1] and TT[1] <= y < 38.0)
    )
    pts = [p for p in dedupe(pts) if road_inside(p[0], p[1]) and d_curb(*p) > 0.08]
    road, rv, rt = make_surface('GR_road', G, MAT['asphalt'], [road_loop], pts, road_inside, road_z, road_drive)
    road['nw_roadwork'] = 1.0
    road_s = lib.Sampler(rv, rt, 2.0)
    print('road', len(rt), round(time.time() - t0, 1))

    # ── 2. 경계석(15 cm 3D 챔퍼 스윕): 국도 남·북 연석 및 지선 도로 연석
    prof = [(0.0, -0.27), (0.0, -0.02), (0.02, 0.0), (0.16, 0.0), (0.18, -0.02), (0.18, -0.08)]
    paint_prof = [(-0.004, -0.15), (-0.004, -0.02), (0.019, 0.003), (0.15, 0.003)]
    cacc = []; yacc = []
    curb_runs = [
        [(X1 - i * 1.0, TT[0]) for i in range(int(X1 - X0) + 1)],          # 남측 연석 (진행 왼쪽 = -Y 보도)
        [(X0 + i * 1.0, TT[1]) for i in range(int(AL[0] - X0) + 1)],       # 북측 서반부 연석
        [(AL[1] + i * 1.0, TT[1]) for i in range(int(X1 - AL[1]) + 1)],    # 북측 동반부 연석
        [(AL[0], 38.0 - i * 1.0) for i in range(int(38.0 - TT[1]) + 1)],   # 지선 서측 연석
        [(AL[1], TT[1] + i * 1.0) for i in range(int(38.0 - TT[1]) + 1)],  # 지선 동측 연석
    ]
    for run in curb_runs:
        path = [(x, y, Z_CURB - ramp_drop(x, y) + 0.003 * n2(x, y, 0.9, 51.0)) for x, y in run]
        V, F, UV = lib.sweep(path, prof, closed=False)
        cacc.append((V, F, [[(u, vv + 1000.0) for u, vv in q] for q in UV]))
        cur = []
        for p in path:
            if (abs(p[0] - XW) < 11.0 and abs(abs(p[1] - TT_C) - 6.5) < 0.4) or (abs(p[0] - 70.0) < 3.4 and p[1] > TT[1]):
                cur.append(p)
            elif cur:
                if len(cur) > 1:
                    yacc.append(lib.sweep(cur, paint_prof, False))
                cur = []
        if len(cur) > 1:
            yacc.append(lib.sweep(cur, paint_prof, False))

    def merge(parts):
        V = []; F = []; UV = []
        for v, f, uv in parts:
            b0 = len(V); V.extend(v); F.extend(tuple(b0 + i for i in q) for q in f); UV.extend(uv)
        return V, F, UV

    V, F, UV = merge(cacc)
    curb = lib.mesh_obj('GR_curb', V, F, G, MAT['concrete'], smooth=True, sharp_angle=35)
    lib.set_uv(curb.data, 'UVMap', None, per_loop=[c for q in UV for c in q])
    curb_drive = lambda x, y, z: (
        road_drive(x, y)[0] * (1 - smoothstep(-0.02, 0.08, z - Z_GUT)),
        0.35 + 0.55 * (1 - smoothstep(-0.02, 0.08, z - Z_GUT)),
        1.0, 0.0
    )
    lib.write_drive(curb.data, [curb_drive(v.co.x, v.co.y, v.co.z) for v in curb.data.vertices])
    lib.tag(curb, 'ground')

    V, F, UV = merge(yacc)
    cpaint = lib.mesh_obj('GR_curb_paint', V, F, G, MAT['yellow'], smooth=True, sharp_angle=35)
    lib.set_uv(cpaint.data, 'UVMap', None, per_loop=[c for q in UV for c in q])
    lib.write_drive(cpaint.data, [curb_drive(v.co.x, v.co.y, v.co.z) for v in cpaint.data.vertices])
    lib.tag(cpaint, 'ground')
    print('curb', lib.tri_count([curb, cpaint]), round(time.time() - t0, 1))

    # ── 3. 보도(S 남측 갓길 보도, C1 HAUS 보도, E1 FaceArch 보도): 정밀 CDT
    wv_all = []; wf_all = []; wd_all = []
    for key, (rr, w) in BLOCKS.items():
        if max(w) <= 0:
            continue
        outer = CURBIN[key]; inner = INNER[key]
        lp = [outer.outline(1.0, 0.3), inner.outline(1.0, 0.3)]
        holes = []
        if key == 'S':
            for px, py in PITS:
                lp.append(RRect(px - PIT_H, py - PIT_H, px + PIT_H, py + PIT_H).outline(0.4))
                holes.append((px, py))

        def inside(x, y, outer=outer, inner=inner, holes=holes):
            if not in_scene(x, y) or outer.sdf(x, y) > 0 or inner.sdf(x, y) < 0:
                return False
            return all(max(abs(x - hx), abs(y - hy)) > PIT_H for hx, hy in holes)

        p = lib.grid_points(rr.x0, rr.y0, rr.x1, rr.y1, 1.0, jitter=0.25, seed=sum(map(ord, key)))
        p += lib.offset_ring(outer.outline(0.7, 0.3), 0.3) + lib.offset_ring(inner.outline(1.0, 0.3), -0.35)
        for hx, hy in holes:
            p += RRect(hx - PIT_H - 0.3, hy - PIT_H - 0.3, hx + PIT_H + 0.3, hy + PIT_H + 0.3).outline(0.5)
        p = [q for q in dedupe(p) if inside(*q) and min(-outer.sdf(*q), inner.sdf(*q)) > 0.08 and pit_dist(*q) > 0.08]
        v2, tris = lib.cdt(lp, p, inside)
        b0 = len(wv_all)
        wv_all.extend((x, y, walk_z(key, x, y)) for x, y in v2)
        wd_all.extend(walk_drive(key, x, y) for x, y in v2)
        wf_all.extend(tuple(b0 + i for i in f) for f in tris)
    walk = lib.mesh_obj('GR_sidewalk', wv_all, wf_all, G, MAT['pavers'])
    lib.write_drive(walk.data, wd_all); lib.tag(walk, 'ground')
    walk_s = lib.Sampler(wv_all, wf_all, 2.0)
    print('sidewalk', len(wf_all), round(time.time() - t0, 1))

    # ── 4. 건축 대지 패드(C1 HAUS 콘크리트 광장, E1 FaceArch 암반·콘크리트 기단): 정밀 CDT
    lv_all = []; lf_all = []; ld_all = []
    for key in ('C1', 'E1'):
        inner = INNER[key]
        lp = [inner.outline(2.5, 0.5)]
        holes = [FORE] if key == 'C1' else []
        for hr in holes:
            lp.append(RRect(*hr).outline(1.2))

        def inside(x, y, inner=inner, holes=holes):
            if not in_scene(x, y) or inner.sdf(x, y) > 0:
                return False
            return all(_rect_d(h, x, y) > 0 for h in holes)

        p = lib.grid_points(inner.x0, inner.y0, inner.x1, inner.y1, 2.2, jitter=0.25, seed=7)
        p += lib.offset_ring(inner.outline(1.2, 0.5), 0.5)
        if key == 'C1':
            p += lib.grid_points(-26, -26, 26, 26, 1.4, jitter=0.2, seed=8)
        p = [q for q in dedupe(p, 0.25) if inside(*q) and -inner.sdf(*q) > 0.1
             and min(_rect_d(h, *q) for h in holes or [(1e5, 1e5, 1e5 + 1, 1e5 + 1)]) > 0.1]
        v2, tris = lib.cdt(lp, p, inside)
        b0 = len(lv_all)
        lv_all.extend((x, y, lot_z(key, x, y)) for x, y in v2)
        ld_all.extend(lot_drive(key, x, y) for x, y in v2)
        lf_all.extend(tuple(b0 + i for i in f) for f in tris)
    lot = lib.mesh_obj('GR_blocklot', lv_all, lf_all, G, [MAT['concrete'], MAT['rock_slope']])
    mi = [0 if f.center.x < 50.0 else 1 for f in lot.data.polygons]
    lot.data.polygons.foreach_set('material_index', mi)
    lib.write_drive(lot.data, ld_all); lib.tag(lot, 'ground')
    print('blocklot', len(lf_all), round(time.time() - t0, 1))

    # ── 5. HAUS 전정: 보도블록 마당 + 흰 자갈 화단(낙수선) + 화단 벽
    holes = GRAVEL + PLANTERS
    lp = [RRect(*FORE).outline(1.0)] + [RRect(*h).outline(0.5) for h in holes]
    fin = lambda x, y: _rect_d(FORE, x, y) < 0 and all(_rect_d(h, x, y) > 0 for h in holes)
    p = lib.grid_points(FORE[0], FORE[1], FORE[2], FORE[3], 0.8, jitter=0.2, seed=9)
    p = [q for q in p if fin(*q) and min(_rect_d(h, *q) for h in holes) > 0.08 and -_rect_d(FORE, *q) > 0.08]
    make_surface('GR_forecourt', G, MAT['pavers'], lp, p, fin, fore_z, fore_drive)
    for i, (gx0, gy0, gx1, gy1) in enumerate(GRAVEL):
        V, F = rect_strip(gx0, gy0, gx1, gy1, 0.18)
        gz = lambda x, y: -0.012 + 0.012 * n2(x, y, 1 / 0.45, 61.0) + 0.008 * smoothstep(0.0, 0.4, -_rect_d((gx0, gy0, gx1, gy1), x, y))
        o = lib.mesh_obj(f'GR_gravel_{i}', [(x, y, gz(x, y)) for x, y in V], F, G, MAT['gravel'])
        finalize(o, 'ground', lambda x, y: (0.25, 0.25 + 0.5 * math.exp(-max(0.0, -_rect_d((gx0, gy0, gx1, gy1), x, y)) / 0.15), 1 - covered(x, y), 0.0))
    eacc = []
    edge_prof = [(-0.04, -0.06), (-0.04, 0.03), (0.04, 0.03), (0.04, -0.06)]
    for r in GRAVEL:
        pl = [(x, y, 0.0) for x, y in RRect(*r).outline(1.0)]
        eacc.append(lib.sweep(pl, edge_prof, True))
    wall_prof = [(-0.15, -0.05), (-0.15, 0.43), (-0.13, 0.45), (-0.02, 0.45), (0.0, 0.43), (0.0, 0.30)]
    for r in PLANTERS:
        pl = [(x, y, 0.0) for x, y in RRect(*r).outline(1.0)]
        eacc.append(lib.sweep(pl, wall_prof, True))
    V, F, UV = merge(eacc)
    edges = lib.mesh_obj('GR_planter_walls', V, F, G, MAT['concrete'], smooth=True, sharp_angle=35)
    lib.set_uv(edges.data, 'UVMap', None, per_loop=[(u, v + 1000.0) for q in UV for (u, v) in q])
    lib.write_drive(edges.data, [(0.1, 0.25 + 0.5 * (1 - smoothstep(0.0, 0.15, v.co.z)), 1 - covered(v.co.x, v.co.y), 0.0)
                                 for v in edges.data.vertices])
    lib.tag(edges, 'wall')
    for i, (px0, py0, px1, py1) in enumerate(PLANTERS):
        V, F = rect_strip(px0, py0, px1, py1, 0.3)
        sz = lambda x, y: 0.36 + 0.05 * smoothstep(0.0, 0.7, -_rect_d((px0, py0, px1, py1), x, y)) + 0.015 * n2(x, y, 1.5, 71.0)
        o = lib.mesh_obj(f'GR_planter_soil_{i}', [(x, y, sz(x, y)) for x, y in V], F, G, MAT['lot'])
        finalize(o, 'ground', lambda x, y: (0.45, 0.65, 1.0, 0.0))
        cx, cy = (px0 + px1) / 2, (py0 + py1) / 2
        slot(SL, f'SLOT_planting_{i}', (cx, cy, 0.4), 0.0, size=(px1 - px0, py1 - py0))
        slot(SL, f'SLOT_bench_{i}', (cx, py0 - 0.75, 0.0), math.pi, size=(1.8, 0.6))
    print('forecourt', round(time.time() - t0, 1))

    # ── 6. 고해상도 계곡 분지(GR_vacant, 0.42 m 간격): 실제 수평 수면으로 잘라낸 웅덩이 5곳 + 갈래 물길 + 이끼 언덕 + 암석 슬래브/잡석
    build_lot(G, SL, MAT)
    print('valley basin (GR_vacant)', round(time.time() - t0, 1))

    # ── 7. 광역 산악 지형(GR_terrain): 도로·패드·보도·계곡 분지 바깥 전체를 빈틈없이 메우는 CDT 산악 지형
    build_mountain_terrain(G, MAT)
    print('mountain terrain (GR_terrain)', round(time.time() - t0, 1))

    # ── 8. 노면 표시·점자블록·맨홀·빗물받이
    build_markings(G, MAT, road_s, walk_s)
    build_iron(G, SL, MAT, road_s, walk_s)
    print('markings & iron', round(time.time() - t0, 1))

    # ── 9. 두 건물(참고용)과 카메라
    build_refs(sc)
    build_cameras(sc, LAY)
    report()
    print('done', round(time.time() - t0, 1))


# ═════════════════════════════ 고해상도 계곡 분지 (build_lot) ═════════════════════════════
def build_lot(G, SL, MAT):
    lx0, ly0, lx1, ly1 = LOT
    step = 0.42
    nx = int(round((lx1 - lx0) / step)); ny = int(round((ly1 - ly0) / step))
    sx = (lx1 - lx0) / nx; sy = (ly1 - ly0) / ny
    H = [[0.0] * (nx + 1) for _ in range(ny + 1)]
    CH = [[0.0] * (nx + 1) for _ in range(ny + 1)]
    TR = [[0.0] * (nx + 1) for _ in range(ny + 1)]
    for j in range(ny + 1):
        y = ly0 + j * sy
        for i in range(nx + 1):
            x = lx0 + i * sx
            e = min(x - lx0, lx1 - x, y - ly0, ly1 - y)
            h = -0.34 * smoothstep(0.2, 2.8, e)
            rel = 0.34 * n2(x, y, 1 / 11.0, 21.0, 3) + 0.14 * n2(x, y, 1 / 3.2, 22.0, 2) + 0.04 * n2(x, y, 1 / 0.8, 23.0, 1)
            h += rel * smoothstep(0.6, 3.5, e)
            wx = x + 1.2 * n2(x, y, 0.15, 24.0); wy = y + 1.2 * n2(x, y, 0.15, 25.0)
            fe = smoothstep(0.3, 2.5, e)
            for (cx, cy), r, hg in MOUNDS:
                h += fe * hg * math.exp(-((wx - cx) ** 2 + (wy - cy) ** 2) / (r * r))
            for (cx, cy), r in POOLS:
                h -= fe * 0.44 * math.exp(-((wx - cx) ** 2 + (wy - cy) ** 2) / (r * r))
            px_w = x + 0.55 * n2(x, y, 0.3, 26.0); py_w = y + 0.55 * n2(x, y, 0.3, 27.0)
            dch = min(seg_dist(px_w, py_w, CHANNEL), seg_dist(px_w, py_w, CHANNEL_W))
            ch = math.exp(-(dch / 0.55) ** 2)
            h -= 0.19 * ch * smoothstep(0.4, 2.0, e)
            dt = min(abs(seg_dist(x, y, [(p[0] + s * TRACK_HALF, p[1]) for p in TRACK])) for s in (-1, 1))
            tr = math.exp(-(dt / 0.24) ** 2) * (1 - smoothstep(-5.0, 2.0, y))
            h -= 0.075 * tr * smoothstep(0.0, 0.6, e)
            H[j][i] = h; CH[j][i] = ch; TR[j][i] = tr

    def lap(i, j, k=3):
        i0, i1 = max(0, i - k), min(nx, i + k); j0, j1 = max(0, j - k), min(ny, j + k)
        return (H[j][i0] + H[j][i1] + H[j0][i] + H[j1][i]) * 0.25 - H[j][i]

    levels = []
    for (cx, cy), r in POOLS:
        hs = []
        for j in range(ny + 1):
            for i in range(nx + 1):
                x = lx0 + i * sx; y = ly0 + j * sy
                if (x - cx) ** 2 + (y - cy) ** 2 < r * r:
                    hs.append(H[j][i])
        hs.sort()
        levels.append(min(hs[0] + 0.22, hs[int(len(hs) * 0.38)]))

    verts = []; drive = []
    for j in range(ny + 1):
        y = ly0 + j * sy
        for i in range(nx + 1):
            x = lx0 + i * sx
            h = H[j][i]; fill = 0.0; shore = 0.0
            for ((cx, cy), r), L in zip(POOLS, levels):
                dd = math.hypot(x - cx, y - cy)
                if dd < 1.75 * r:
                    if h < L:
                        fill = max(fill, (L - h) / 0.2); h = L
                    shore = max(shore, math.exp(-((H[j][i] - L) / 0.13) ** 2) * (1 - smoothstep(1.2 * r, 1.75 * r, dd)))
            conc = clamp01(lap(i, j, 6) / 0.09); convex = clamp01(-lap(i, j, 6) / 0.09)
            conc_s = clamp01(lap(i, j, 2) / 0.04)
            e = min(x - lx0, lx1 - x, y - ly0, ly1 - y)
            chw = CH[j][i] ** 2.2
            water = clamp01(0.96 * chw + 0.82 * TR[j][i] ** 1.5 + 0.78 * conc + 0.48 * shore)
            shelter = clamp01(0.28 + 1.25 * conc + 0.42 * conc_s + 1.15 * shore + 0.78 * CH[j][i] * (1 - chw) - 0.95 * convex
                              + 0.25 * (1 - smoothstep(0.0, 1.5, e)))
            verts.append((x, y, h)); drive.append((water, shelter, 1.0, clamp01(fill)))

    faces = []
    for j in range(ny):
        for i in range(nx):
            a = j * (nx + 1) + i
            if (i + j) % 2:
                faces.append((a, a + 1, a + nx + 2)); faces.append((a, a + nx + 2, a + nx + 1))
            else:
                faces.append((a, a + 1, a + nx + 1)); faces.append((a + 1, a + nx + 2, a + nx + 1))
    o = lib.mesh_obj('GR_vacant', verts, faces, G, MAT['lot'])
    lib.write_drive(o.data, drive); lib.tag(o, 'ground')

    def hz(x, y):
        fi = (x - lx0) / sx; fj = (y - ly0) / sy
        i = min(nx - 1, max(0, int(fi))); j = min(ny - 1, max(0, int(fj)))
        tx = fi - i; ty = fj - j
        z = lambda ii, jj: verts[jj * (nx + 1) + ii][2]
        return (z(i, j) * (1 - tx) + z(i + 1, j) * tx) * (1 - ty) + (z(i, j + 1) * (1 - tx) + z(i + 1, j + 1) * tx) * ty

    def in_pool(x, y):
        for ((cx, cy), r), L in zip(POOLS, levels):
            if math.hypot(x - cx, y - cy) < 1.75 * r and hz(x, y) <= L + 0.005:
                return True
        return False

    build_rubble(G, MAT, hz, in_pool)
    build_foundation(G, MAT, hz)


def build_foundation(G, MAT, hz):
    """계곡 안에 반쯤 묻힌 옛 콘크리트 구조물 기초 흔적(물이 고이고 이끼가 낀 폐허 옹벽)."""
    rnd = random.Random(2041)
    V = []; F = []
    th = 0.28
    for poly in FOUNDATION:
        n = len(poly)
        for k in range(n):
            (ax, ay), (bx, by) = poly[k], poly[(k + 1) % n]
            L = math.hypot(bx - ax, by - ay); tx, ty = (bx - ax) / L, (by - ay) / L; nx, ny = -ty * th / 2, tx * th / 2
            s0 = 0.0
            while s0 < L - 0.3:
                seg = min(L - s0, rnd.uniform(1.0, 3.2))
                if rnd.random() < 0.72:
                    p0 = (ax + tx * s0, ay + ty * s0); p1 = (ax + tx * (s0 + seg), ay + ty * (s0 + seg))
                    zb = min(hz(*p0), hz(*p1)) - 0.35
                    h0 = hz(*p0) + rnd.uniform(0.08, 0.65); h1 = hz(*p1) + rnd.uniform(0.08, 0.65)
                    b0 = len(V)
                    for (px, py), zt in ((p0, h0), (p1, h1)):
                        V += [(px - nx, py - ny, zb), (px + nx, py + ny, zb), (px + nx, py + ny, zt), (px - nx, py - ny, zt + rnd.uniform(-0.06, 0.06))]
                    F += [(b0 + 0, b0 + 1, b0 + 2, b0 + 3)[::-1], (b0 + 4, b0 + 5, b0 + 6, b0 + 7),
                          (b0 + 0, b0 + 4, b0 + 7, b0 + 3), (b0 + 1, b0 + 2, b0 + 6, b0 + 5),
                          (b0 + 3, b0 + 7, b0 + 6, b0 + 2), (b0 + 0, b0 + 1, b0 + 5, b0 + 4)]
                s0 += seg + rnd.uniform(0.0, 0.28)
    o = lib.mesh_obj('GR_foundation', V, F, G, MAT['concrete'], smooth=False)
    lib.recalc_normals(o.data)
    lib.box_uv(o.data, 1.0)
    lib.write_mask(o, lambda co, nn: (0.88 * smoothstep(0.55, 0.9, nn.z) + 0.48 * (1 - smoothstep(-0.05, 0.25, co.z - hz(co.x, co.y))),
                                      0.52 + 0.45 * (1 - smoothstep(0.0, 0.3, co.z - hz(co.x, co.y))),
                                      1 - 0.6 * (1 - smoothstep(-0.05, 0.3, co.z - hz(co.x, co.y)))))
    lib.tag(o, 'wall')
    return o


def build_rubble(G, MAT, hz, in_pool):
    """바위 3단 스케일(#6): 대형 반쯤 묻힌 현무암 판석(GR_slab_*) + 중형 암석 군집 + 소형 잔돌 다수(링크 복제)."""
    rnd = random.Random(1267)
    protos = []
    for k in range(6):
        V, F, h = chunk_mesh(100 + k, (0.45, 0.6, 0.75, 0.5, 0.9, 0.35)[k])

        def m(co, n, h=h):
            top = smoothstep(0.45, 0.9, n.z) * smoothstep(0.3 * h, 0.75 * h, co.z)
            low = 1 - smoothstep(0.0, 0.35 * h, co.z)
            return (0.85 * top + 0.35 * low, 0.5 + 0.45 * low, 1 - 0.55 * low)

        me = proto_mesh(f'GR_rubble_{k}', V, F, MAT['rock_slope'], None, m)
        lib.box_uv(me, 1.0)
        protos.append((me, h))

    slabs = [
        ((50.5, -4.5), 3.4, 0.35, (0.05, -0.08)),
        ((33.8, 13.0), 2.9, 0.8, (0.14, 0.04)),
        ((58.5, 8.5), 2.4, 2.1, (-0.06, 0.24)),
        ((41.5, 37.0), 2.2, -0.5, (0.18, -0.1)),
        ((55.0, 44.0), 2.8, 1.2, (-0.12, 0.08)),
    ]
    centers = []
    for si, ((cx, cy), r, rz, (tx, ty)) in enumerate(slabs):
        rs = random.Random(si * 7 + 3)
        n = 9
        poly = [(r * rs.uniform(0.7, 1.15) * math.cos(2 * math.pi * i / n + rs.uniform(-0.2, 0.2)),
                 r * 0.75 * rs.uniform(0.7, 1.15) * math.sin(2 * math.pi * i / n + rs.uniform(-0.2, 0.2))) for i in range(n)]
        v2, tris = lib.cdt([poly], [], lambda x, y, poly=poly: lib.point_in_poly(x, y, poly))
        th = 0.32
        V = [(x, y, th) for x, y in v2] + [(x, y, 0.0) for x, y in v2]
        F = [tuple(f) for f in tris] + [tuple(reversed([i + len(v2) for i in f])) for f in tris]
        bidx = [min(range(len(v2)), key=lambda k: (v2[k][0] - px) ** 2 + (v2[k][1] - py) ** 2) for px, py in poly]
        for i in range(n):
            a, b2 = bidx[i], bidx[(i + 1) % n]
            F.append((a, a + len(v2), b2 + len(v2), b2)[::-1])
        z = hz(cx, cy) - 0.12
        mw = Matrix.Translation((cx, cy, z)) @ Euler((tx, ty, rz)).to_matrix().to_4x4()
        VW = [tuple(mw @ Vector(v)) for v in V]
        o = lib.mesh_obj(f'GR_slab_{si}', VW, F, G, MAT['rock_slope'], smooth=False, mask_uv=True)
        lib.recalc_normals(o.data)
        lib.box_uv(o.data, 1.0)
        lib.write_mask(o, lambda co, nn: (0.85 * smoothstep(0.6, 0.95, nn.z) * smoothstep(0.38, 0.68, n2(co.x, co.y, 0.9, 81.0) * 0.5 + 0.5)
                                          + 0.4 * (1 - smoothstep(-0.1, 0.15, co.z - hz(co.x, co.y))),
                                          0.55 + 0.4 * (1 - smoothstep(0.0, 0.2, co.z - hz(co.x, co.y))),
                                          1 - 0.6 * (1 - smoothstep(-0.05, 0.2, co.z - hz(co.x, co.y)))))
        lib.tag(o, 'rock')
        centers.append(((cx, cy), r))

    clusters = [(c, r * 1.3, 18, 34) for (c, r, _) in MOUNDS] + [(c, r * 1.6, 8, 16) for c, r in centers]
    clusters += [((x, y), 1.3, 2, 7) for (x, y) in CHANNEL[1:-1] + CHANNEL_W[1:-1]]
    clusters += [((39.5, -15.5), 2.5, 6, 14), ((50.5, -13.0), 2.6, 7, 15), ((47.5, -2.0), 1.8, 4, 10)]
    clusters += [((rnd.uniform(LOT[0] + 2, LOT[2] - 2), rnd.uniform(LOT[1] + 2, LOT[3] - 2)), 2.5, 2, 6) for _ in range(16)]
    k = 0
    for (cx, cy), rad, nmed, nsmall in clusters:
        for size_cls, count in (('m', nmed), ('s', nsmall)):
            for _ in range(count):
                a = rnd.uniform(0, 2 * math.pi); d = rad * math.sqrt(rnd.random()) * (0.8 if size_cls == 'm' else 1.2)
                x = cx + d * math.cos(a); y = cy + d * math.sin(a)
                if _rect_d(LOT, x, y) > -0.8:
                    continue
                if in_pool(x, y) and rnd.random() > 0.12:
                    continue
                me, h = protos[rnd.randrange(len(protos))]
                s = rnd.uniform(0.42, 1.15) if size_cls == 'm' else rnd.uniform(0.08, 0.26)
                z = hz(x, y) - h * s * rnd.uniform(0.2, 0.45)
                place(f'GR_rubble.{k:04d}', me, G, (x, y, z), rnd.uniform(0, 6.3), rnd.uniform(-0.35, 0.35), rnd.uniform(-0.35, 0.35),
                      (s * rnd.uniform(0.85, 1.2), s * rnd.uniform(0.85, 1.2), s), surface='rock')
                k += 1
    print('rubble instances', k)


# ═════════════════════════════ 광역 산악 지형 (build_mountain_terrain) ═════════════════════════════
def build_mountain_terrain(G, MAT):
    """도로·보도·건축 패드·계곡 분지(LOT) 바깥 전체를 덮는 정밀 CDT 산악 지형(GR_terrain)."""
    # 바깥 장면 경계 루프
    scene_loop = []
    step_b = 2.0
    for i in range(int((X1 - X0) / step_b)):
        scene_loop.append((X0 + i * step_b, Y0))
    for i in range(int((Y1 - Y0) / step_b)):
        scene_loop.append((X1, Y0 + i * step_b))
    for i in range(int((X1 - X0) / step_b)):
        scene_loop.append((X1 - i * step_b, Y1))
    for i in range(int((Y1 - Y0) / step_b)):
        scene_loop.append((X0, Y1 - i * step_b))

    # 중앙 개발 벨트(도로 + 보도 + HAUS 패드 + 계곡 분지 + 동쪽 지선 도로 + FaceArch 패드)의 외곽선을
    # 정확히 따라가는 두 개의 비겹침 구멍 루프로 구성하여 빈틈을 완전히 제거한다.
    south_loop = []
    for i in range(int((X1 - X0) / 1.5)):
        south_loop.append((X0 + i * 1.5, -54.5))
    south_loop.append((X1, -54.5))
    for i in range(int((X1 - X0) / 1.5)):
        south_loop.append((X1 - i * 1.5, TT[1]))
    south_loop.append((X0, TT[1]))

    # 북측 중앙 벨트 외곽 다각형: (-32, -35.5) -> (134, -35.5) -> (134, 38) -> (67, 38) -> (67, 56) -> (26.5, 56) -> (26.5, 27.5) -> (-32, 27.5)
    north_Belt_corners = [
        (-32.0, TT[1]),
        (134.0, TT[1]),
        (134.0, 38.0),
        (67.0, 38.0),
        (67.0, 56.0),
        (26.5, 56.0),
        (26.5, 27.5),
        (-32.0, 27.5),
    ]
    north_loop = []
    n_nb = len(north_Belt_corners)
    for i in range(n_nb):
        a, b = north_Belt_corners[i], north_Belt_corners[(i + 1) % n_nb]
        L = math.dist(a, b); steps = max(1, int(math.ceil(L / 1.4)))
        for k in range(steps):
            t = k / steps
            north_loop.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))

    loops = [scene_loop, south_loop, north_loop]

    def inside_mtn(x, y):
        if not in_scene(x, y, 0.02):
            return False
        if -54.5 <= y <= TT[1]:
            return False
        if lib.point_in_poly(x, y, north_Belt_corners):
            return False
        return True

    pts = lib.grid_points(X0 + 1.5, Y0 + 1.5, X1 - 1.5, Y1 - 1.5, 2.8, jitter=0.28, seed=19)
    # 상류·하류 물길 주변은 0.9 m 간격으로 조밀하게 표본점 추가(계단 현상 원천 차단)
    for stream in (UPPER_STREAM, LOWER_STREAM):
        for (ax, ay), (bx, by) in zip(stream[:-1], stream[1:]):
            L = math.hypot(bx - ax, by - ay); n = max(2, int(L / 1.1))
            tx, ty = (bx - ax) / L, (by - ay) / L; nx_, ny_ = -ty, tx
            for i in range(n + 1):
                px, py = ax + (bx - ax) * i / n, ay + (by - ay) * i / n
                for off in (-3.2, -1.6, -0.6, 0.0, 0.6, 1.6, 3.2):
                    pts.append((px + nx_ * off, py + ny_ * off))

    pts = [p for p in dedupe(pts, 0.45) if inside_mtn(p[0], p[1]) and mountain_boundary_dist(p[0], p[1]) > 0.35]
    v2, tris = lib.cdt(loops, pts, inside_mtn)
    verts = [(x, y, terrain_z(x, y)) for x, y in v2]
    o = lib.mesh_obj('GR_terrain', verts, tris, G, [MAT['lot'], MAT['rock_slope']], smooth=True)
    # 경사가 가파르거나 고도가 높은 암반 삼각형은 rock_slope 재질(슬롯 1), 완만한 계곡/이끼 사면은 lot 재질(슬롯 0)
    mi = []
    for p in o.data.polygons:
        slope_nz = p.normal.z
        cz = p.center.z
        mi.append(1 if (slope_nz < 0.78 or cz > 14.0) else 0)
    o.data.polygons.foreach_set('material_index', mi)
    lib.write_drive(o.data, [terrain_drive(v.co.x, v.co.y) for v in o.data.vertices])
    lib.tag(o, 'ground')
    return o


# ═════════════════════════════ 노면 표시 & 주철 ═════════════════════════════
def build_markings(G, MAT, road_s, walk_s):
    W = Acc(); Y = Acc(); T = Acc()

    def dashes(x0, x1, y, w, on=3.0, off=5.0):
        x = x0
        while x < x1:
            a, b = x, min(x + on, x1)
            W.add(*strip([(a, y), (b, y)], w))
            x += on + off

    def hline(acc, x0, x1, y, w):
        acc.add(*strip([(x0, y), (x1, y)], w))

    def vline(acc, y0, y1, x, w):
        acc.add(*strip([(x, y0), (x, y1)], w))

    for yo in (-0.125, 0.125):
        hline(Y, X0 + 0.3, XW - CW - 2.0, TT_C + yo, 0.15)
        hline(Y, XW + CW + 2.0, X1 - 0.3, TT_C + yo, 0.15)
    sb_w = XW - CW - 2.0; sb_e = XW + CW + 2.0
    hline(W, sb_w - 30.0, sb_w, -45.25, 0.15)
    dashes(X0 + 1.0, sb_w - 30.0, -45.25, 0.15)
    dashes(sb_e, X1, -45.25, 0.15)
    hline(W, sb_e, sb_e + 30.0, -38.75, 0.15)
    dashes(X0 + 1.0, sb_w, -38.75, 0.15)
    dashes(sb_e + 30.0, X1, -38.75, 0.15)
    vline(W, TT[0] + 0.25, TT_C - 0.25, sb_w - 0.225, 0.45)
    vline(W, TT_C + 0.25, TT[1] - 0.25, sb_e + 0.225, 0.45)
    for k in range(14):
        yc = TT[1] - 0.425 - 0.225 - k * 0.9
        V, F = rect_strip(XW - CW, yc - 0.225, XW + CW, yc + 0.225, 0.5, 0.15)
        W.add(V, F)

    def arrow(x, y, dirx):
        poly = [(0, -0.1), (3.4, -0.1), (3.4, -0.38), (5.0, 0.0), (3.4, 0.38), (3.4, 0.1), (0, 0.1)]
        poly = [(x + dirx * px, y + py) for px, py in poly]
        if dirx < 0:
            poly = poly[::-1]
        pts = [(x + dirx * t, y) for t in (0.6, 1.2, 1.8, 2.4, 3.0, 3.8, 4.4)]
        v2, tris = lib.cdt([poly], pts, lambda a, b, poly=poly: lib.point_in_poly(a, b, poly))
        W.add(v2, tris)

    for yl in (-43.625, -46.875):
        arrow(sb_w - 12.0, yl, 1); arrow(sb_w - 42.0, yl, 1)
    for yl in (-37.125, -40.375):
        arrow(sb_e + 12.0, yl, -1); arrow(sb_e + 42.0, yl, -1)

    # 동쪽 지선 정지선 및 황색 가장자리선
    hline(W, 67.3, 72.7, TT[1] + 2.0, 0.4)
    for xe in (AL[0] + 0.35, AL[1] - 0.35):
        vline(Y, TT[1] + 4.0, 34.0, xe, 0.15)

    rz = lambda x, y: road_s.z(x, y, road_z(x, y))
    acc_obj('GR_mark_white', W, G, MAT['white'], rz, 'ground', road_drive, offset=0.005)
    acc_obj('GR_mark_yellow', Y, G, MAT['yellow'], rz, 'ground', road_drive, offset=0.005)

    # 점자블록
    def tactile_line(x0, x1, y):
        V, F = rect_strip(x0, y - 0.15, x1, y + 0.15, 0.6, 0.3)
        T.add(V, F, lambda p: (p[0] + 1000.0, p[1]))

    def tactile_pad(x0, x1, y0, y1):
        V, F = rect_strip(x0, y0, x1, y1, 0.3, 0.3)
        T.add(V, F, lambda p: (p[0] + 2000.0, p[1]))

    n_line = TT[1] + 4.0 - 0.75
    s_line = TT[0] - 6.0 + 0.75
    tactile_line(-28.0, XW - 0.15, n_line)
    tactile_line(XW + 0.15, 24.0, n_line)
    tactile_line(X0 + 2.0, X1 - 2.0, s_line)
    for yy, sgn in ((TT[1], 1), (TT[0], -1)):
        yb = yy + sgn * (CURB_W + 0.05)
        tactile_pad(XW - CW, XW + CW, min(yb, yb + sgn * 0.6), max(yb, yb + sgn * 0.6))
    wz = lambda x, y: walk_s.z(x, y, 0.0)
    acc_obj('GR_tactile', T, G, MAT['yellow'], wz, 'ground', lambda x, y: (0.2, 0.35, 1.0, 0.0), offset=0.006)


def build_iron(G, SL, MAT, road_s, walk_s):
    def mmask(co, n):
        rim = smoothstep(0.3, 0.4, math.hypot(co.x, co.y))
        return (0.25 * rim, 0.6 + 0.3 * rim, 1 - 0.35 * rim)
    V, F = revolve([(0.0, -0.002), (0.325, -0.002), (0.335, 0.004), (0.40, 0.006), (0.415, -0.02), (0.415, -0.06)], 28)
    mh = proto_mesh('GR_manhole', V, F, MAT['iron'], lambda co: (co[0] / 0.83 + 0.5, co[1] / 0.83 + 0.5), mmask, smooth=True)
    mh.set_sharp_from_angle(angle=math.radians(30))
    for i, (x, y) in enumerate(MANHOLES):
        place(f'GR_manhole.{i:03d}', mh, G, (x, y, road_s.z(x, y, road_z(x, y)) + 0.002), random.Random(i).uniform(0, 6.3))
    V, F = rect_rings([(0.42, 0.17, -0.006), (0.42, 0.17, 0.004), (0.45, 0.2, 0.004), (0.45, 0.2, -0.06)])
    dr = proto_mesh('GR_drain', V, F, MAT['iron'], lambda co: (10.0 + co[0] / 0.9 + 0.5, co[1] / 0.4 + 0.5),
                    lambda co, n: (0.15, 0.85, 0.75))
    for i, (x, y, a) in enumerate(DRAINS):
        z = road_s.z(x, y, road_z(x, y))
        place(f'GR_drain.{i:03d}', dr, G, (x, y, z + 0.002), math.radians(a))
    V, F = rect_rings([(0.6, 0.6, -0.004), (0.6, 0.6, -0.08)])
    tg = proto_mesh('GR_treegrate', V, F, MAT['iron'], lambda co: (20.0 + co[0] / 1.2 + 0.5, co[1] / 1.2 + 0.5),
                    lambda co, n: (0.35 * smoothstep(0.45, 0.6, max(abs(co.x), abs(co.y))), 0.55, 0.8))
    for i, (x, y) in enumerate(PITS):
        z = walk_s.z(x + PIT_H + 0.05, y, -0.03)
        place(f'GR_treegrate.{i:03d}', tg, G, (x, y, z), 0.0)
        slot(SL, f'SLOT_tree_{i:02d}', (x, y, z), 0.0, size=(1.2, 1.2))


# ═════════════════════════════ 건물(참고)·카메라 ═════════════════════════════
FACEARCH_RZ = 27.0


def build_refs(sc):
    ref = lib.coll('NW_ref', sc)
    lay = lib.coll('NW_layout', sc)
    ref.hide_render = False
    for nm, f, sub in (('BLD_haus', 'gm_building.glb', 'NW_ref_haus'), ('BLD_facearch', 'facearch.glb', 'NW_ref_facearch')):
        e = bpy.data.objects.get(nm)
        if e is None:
            e = bpy.data.objects.new(nm, None)
        if e.name not in lay.objects:
            lay.objects.link(e)
        e.empty_display_type = 'ARROWS'; e.empty_display_size = 6.0
        c = lib.coll(sub, sc, parent=ref)
        if not any(o.type == 'MESH' for o in c.objects):
            lib.import_gltf(os.path.join(ROOT, 'public', 'assets', f), c, sc)
        for o in c.objects:
            if o.parent is None:
                o.parent = e
    bpy.data.objects['BLD_haus'].location = (0, 0, 0)
    bpy.data.objects['BLD_haus'].rotation_euler = (0, 0, 0)
    fa = bpy.data.objects['BLD_facearch']
    fa.location = (105.0, 15.0, 0.0)
    fa.rotation_euler = (0, 0, math.radians(FACEARCH_RZ))


CAMS = {
    'CAM_street': ((-105.0, -50.2, 1.7), (-30.0, -31.0, 5.0), 28.0),
    'CAM_ground': ((42.5, -16.5, 2.3), (41.5, 4.5, -0.2), 28.0),      # 계곡 시냇물·웅덩이·현무암 판석·올리브 이끼 근접 컷
    'CAM_aerial': ((88.0, -84.0, 100.0), (22.0, -14.0, 0.0), 28.0),
    'CAM_lot': ((44.5, -24.5, 1.7), (43.0, 2.0, -0.6), 24.0),
}


def build_cameras(sc, lay):
    for nm, (loc, tgt, lens) in CAMS.items():
        cam = bpy.data.objects.get(nm)
        if cam is None or cam.type != 'CAMERA':
            if cam is not None:
                bpy.data.objects.remove(cam, do_unlink=True)
            cam = bpy.data.objects.new(nm, bpy.data.cameras.new(nm))
        if cam.name not in lay.objects:
            lay.objects.link(cam)
        cam.location = loc
        d = Vector(tgt) - Vector(loc)
        cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        cam.data.lens = lens; cam.data.sensor_width = 36.0
        cam.data.clip_start = 0.1; cam.data.clip_end = 3000.0
        cam['target'] = list(tgt)
    sc.camera = bpy.data.objects['CAM_street']


def report():
    G = bpy.data.collections['NW_ground']
    objs = [o for o in G.all_objects if o.type == 'MESH']
    mats = sorted({s.material.name for o in objs for s in o.material_slots if s.material})
    tris = lib.tri_count(objs)
    print('NW_ground (DS2) objects', len(objs), 'tris', tris, 'materials', len(mats), mats)
    return {'objects': len(objs), 'tris': tris, 'materials': mats}


def render_views(suffix='', res=(1280, 720), samples=32, cams=('street', 'ground', 'lot', 'aerial')):
    sc = lib.get_scene(True)
    out = []
    for c in cams:
        p = os.path.join(lib.OUT, 'renders', f'ds2-t2-{c}{suffix}.png')
        lib.render(sc, bpy.data.objects[f'CAM_{c}'], p, res, samples)
        out.append(p)
    sc.render.resolution_x, sc.render.resolution_y = 1280, 720
    return out


if __name__ == '__main__':
    build()
