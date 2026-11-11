# HAUS NOWHERE — 성수 2041 / Task 2: 지면과 거리(현재의 성수 바닥). Task 4(2026-11-10): 빈터 → 포켓 공원, 차도 보수 패치 끄기.
# 실행: MCP 에서 exec(open('<ROOT>/tools/nowhere/blender/ground.py').read(), {'__name__': '__main__'})
#       헤드리스: blender -b --python-expr "exec(open('.../ground.py').read(), {'__name__': '__main__'})"
# 매 실행마다 NW_ground 컬렉션을 비우고 처음부터 다시 만든다(멱등). 좌표는 Blender Z-up 미터, HAUS 원점(§3).
#
# 만드는 것
#   NW_ground  (→ nowhere-ground.glb) 차도·보도·경계석·대지·포켓 공원(잔디·산책로·물길 정원)·전정·노면 표시·점자블록·맨홀·빗물받이·
#              가로수 보호판
#   NW_layout  CAM_street · CAM_ground · CAM_aerial, BLD_haus · BLD_facearch (export.py 가 layout.json 으로)
#   NW_slots   SLOT_* 빈 객체 — Task 3 이 벤치·꽃·가로수를 놓을 자리(내보내지 않음)
#   NW_ref     두 건물 원본(배치 확인용, 내보내지 않음)
#   NW_fx      FX_fog(높이 지수 안개 상자, 내보내지 않음)
import bpy, os, sys, math, random, importlib, time
from mathutils import Vector, Matrix, Euler

ROOT = os.environ.get('NW_ROOT', '/Users/gm_yeonho/new-work/so/so-viewer-monster1267')
sys.dont_write_bytecode = True          # tools/ 아래에 __pycache__ 를 만들지 않는다
_HERE = os.path.join(ROOT, 'tools', 'nowhere', 'blender')
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)
import lib
importlib.reload(lib)
from lib import RRect, n2, smoothstep, clamp01, srgb

# ═════════════════════════════ 배치 상수 (§3) ═════════════════════════════
X0, Y0, X1, Y1 = lib.MASK_RECT
CURB_W, CURB_H = 0.18, 0.15        # 경계석 폭·높이(측구 위 15 cm), 모서리 챔퍼 2 cm
Z_GUT = -0.19                      # 차도 가장자리(측구) 기준 높이. 대지·건물 바닥 = 0
Z_CURB = Z_GUT + CURB_H            # 경계석 윗면 = 보도 바깥 끝(−0.04). 보도는 대지 쪽으로 올라가 0 이 된다
R_C = 3.5                          # 교차로 모서리 반지름
TT = (-48.5, -35.5)                # 뚝섬로 4차로(차로 3.25 m), 중심선 y −42
TT_MEDIAN = (-43.1, -40.9)          # 성수 2041(Task 10): 뚝섬로 가운데 태양광 띠(future.PV_Y −43 … −41)와 가장자리 청록선 — 황색 중앙선 대신
WR = (-108.0, -102.0)              # 서쪽 이면도로(x −105, 6 m, 양방향)
AL = (67.0, 73.0)                  # 동쪽 일방 골목(x +70, 6 m)
NR = (67.0, 73.0)                  # 북쪽 이면도로(y +70, 6 m)
VR = (138.5, 146.5)                # 고가 하부 가로(y +135…+150 띠 안의 8 m 차도)
XW, CW = -14.0, 2.5                # 뚝섬로 횡단보도 중심 x, 반폭(폭 5 m)
XV = 22.0                          # 고가 하부 가로 횡단보도 x
LOT = (28.0, -22.0, 65.8, 40.0)    # 옛 빈터 → 포켓 공원(동쪽 끝은 골목 보도 안쪽 선)
HAUS_BB = RRect(-25.15, -25.9, 25.15, 25.9)   # 캔틸레버 포함 외곽 — 그 아래는 비를 맞지 않는다
FORE = (-26.0, -31.5, 26.0, -17.0)            # 전정: 보도 안쪽 선 ~ 1층 벽 안쪽
GRAVEL = [(-24.6, -27.7, -3.6, -26.05), (3.6, -27.7, 24.6, -26.05)]   # 흰 자갈 화단(처마 낙수선)
PLANTERS = [(-21.0, -30.1, -9.0, -28.5), (9.0, -30.1, 21.0, -28.5)]   # 꽃 화단(높이 0.45 m)

# 블록 = 둥근 사각형, 변별 보도 폭(아래, 오른쪽, 위, 왼쪽). 장면 경계에 닿는 변은 0.
BLOCKS = {
    'S':  (RRect(X0, Y0, X1, TT[0]),                         (0.0, 0.0, 7.5, 0.0)),   # 남측 보도 + 은행나무 띠
    'W':  (RRect(X0, TT[1], WR[0], VR[0], (0, R_C, R_C, 0)),  (4.0, 1.2, 3.5, 0.0)),
    'C1': (RRect(WR[1], TT[1], AL[0], NR[0], (R_C,) * 4),     (4.0, 1.2, 1.2, 1.2)),   # HAUS 블록
    'E1': (RRect(AL[1], TT[1], X1, NR[0], (R_C, 0, 0, R_C)),  (4.0, 0.0, 1.2, 1.2)),   # FaceArch 블록
    'C2': (RRect(WR[1], NR[1], AL[0], VR[0], (R_C,) * 4),     (1.2, 1.2, 3.5, 1.2)),   # 벽돌 공장 띠
    'E2': (RRect(AL[1], NR[1], X1, VR[0], (R_C, 0, 0, R_C)),  (1.2, 0.0, 3.5, 1.2)),
    'N':  (RRect(X0, VR[1], X1, Y1),                          (3.5, 0.0, 0.0, 0.0)),   # 고가 쪽
}
INNER = {k: rr.inset_sides(*w) for k, (rr, w) in BLOCKS.items()}
CURBIN = {k: rr.inset_sides(*[CURB_W if v > 0 else 0.0 for v in w]) for k, (rr, w) in BLOCKS.items()}

# 맨홀(차로 안, 원형 주철 Ø 0.8 테두리)과 빗물받이(측구, 0.9 × 0.4)
MANHOLES = [(-95, -40.4), (-62, -44.0), (-31, -38.6), (8, -45.6), (36, -40.1), (74, -44.3), (110, -38.4), (142, -45.0),
            (-105.4, 12), (-104.6, 96), (70.3, 22), (69.6, 108), (-40, 69.6), (110, 70.4),
            (-60, 140.9), (58, 144.2), (120, 140.6)]
DRAINS = []   # (x, y, 각도) — 경계석을 따라
for x in (-92, -68, -44, -24, 4, 28, 52, 92, 116, 140):
    DRAINS.append((x, TT[1] - 0.24, 0.0))
for x in (-98, -74, -50, -24, 6, 30, 54, 78, 102, 126, 150):
    DRAINS.append((x, TT[0] + 0.24, 0.0))
for x in (-90, -50, -10, 40, 90, 130):
    DRAINS.append((x, VR[0] + 0.24, 0.0)); DRAINS.append((x + 20, VR[1] - 0.24, 0.0))
for y in (0, 40, 100):
    DRAINS.append((AL[0] + 0.24, y, 90.0)); DRAINS.append((WR[1] - 0.24, y + 12, 90.0))
# 남측 보도 가로수 구덩이(1.2 m 정사각, 8 m 간격, 경계석 뒤 0.4 m) — 횡단보도 앞은 비운다
PITS = [(x, TT[0] - CURB_W - 0.4 - 0.6) for x in range(-106, 160, 8) if abs(x - XW) > 6]
PIT_H = 0.6
# 블록 안 필지 경계(아스팔트 / 콘크리트 마당을 나누는 직선)
PARCEL_X = [-80.0, -55.0, -31.0, 31.0, 50.0, 95.0, 122.0, 141.0]
PARCEL_Y = [-75.0, -95.0, -120.0, -140.0, 27.0, 50.0, 95.0, 118.0, 155.0]

# 포켓 공원(옛 빈터, Task 4): 웅덩이(중심, 반지름) = 물길 정원의 수면, 둔덕(중심, 반지름, 옛 높이), 물길(폴리라인), 산책로
POOLS = [((39.5, 3.0), 3.6), ((53.0, 19.0), 2.6), ((38.5, 28.5), 2.2)]   # 셋째는 산책로와 겹치지 않게 (36, 29) → (38.5, 28.5)
MOUNDS = [((58.5, -9.0), 4.5, 0.55), ((33.5, -13.0), 3.5, 0.42), ((47.5, 33.5), 4.0, 0.45), ((60.5, 30.0), 3.0, 0.35)]
MOUND_K = 0.45                     # 잔디 둔덕: 옛 잔해 더미 높이의 45 %(가장 높은 것 0.25 m)
LOT_SINK = 0.12                    # 공원 안쪽이 대지보다 낮은 깊이(옛 빈터 0.34 m)
CHANNEL = [(63.8, 38.5), (59.5, 31.5), (56.0, 24.5), (53.0, 19.0), (49.5, 12.5), (44.5, 6.5), (39.5, 3.0),
           (36.5, -2.5), (35.0, -8.0), (36.5, -15.0)]
PARK_PATH = [(32.0, -18.0), (60.0, -18.0), (63.0, 10.0), (58.0, 37.0), (34.0, 37.0), (31.0, 10.0)]   # 닫힌 산책로(present.PARK_PATH)
PARK_PATH_W = 2.0                  # 산책로 폭(보도블록 concrete_pavers_02, 잔디 + 0.02 m)
PAINT_WEAR = 0.2                   # 차선·정지선 마모(닳아 아스팔트가 비치는 정도의 최대값). 성수 2041: 다시 칠했다(옛 1.0)
# 성수 2041(Task 8b): 다시 포장한 차도. 바퀴 자국(소성 변형) 깊이 · 그 자국에 고이는 물을 이 비율로(옛 1.0). 웹 맑은 낮 골목의 밝은
# 십자형 얼룩은 이 물 고임이 지면 마스크 A(웅덩이)로 구워져 uWet 0.05 에서도 밝은 uPudColor 가 비친 것이었다(보고서 Step 1)
RUT_K = 0.0
CRACK_K = 0.0                      # 실링 균열(타르 줄, Blender 재질) 세기(옛 1.0) — 새로 포장한 길이라 끈다


# ═════════════════════════════ 높이·마스크 구동 함수 ═════════════════════════════
def d_curb(x, y):
    """차도 위 점에서 가장 가까운 경계석 면까지 거리(차도 안 ≥ 0)."""
    return min(rr.sdf(x, y) for rr, _ in BLOCKS.values())


def _g(t, w=0.26):
    return math.exp(-(t / w) ** 2)


WHEEL_TT = [c + s for c in (-37.125, -40.375, -43.625, -46.875) for s in (-0.85, 0.85)]
WHEEL_VR = [c + s for c in (140.5, 144.5) for s in (-0.85, 0.85)]


def rut(x, y):
    """바퀴 자국(소성 변형) 띠 0..1."""
    r = 0.0
    if TT[0] <= y <= TT[1]:
        r = max(_g(y - w) for w in WHEEL_TT)
    if VR[0] <= y <= VR[1]:
        r = max(r, max(_g(y - w) for w in WHEEL_VR))
    if TT[1] <= y <= VR[0]:
        if WR[0] <= x <= WR[1]:
            r = max(r, max(_g(x + 105 - o) for o in (-2.3, -0.7, 0.7, 2.3)))
        if AL[0] <= x <= AL[1]:
            r = max(r, max(_g(x - 70 - o) for o in (-0.85, 0.85)))
    if NR[0] <= y <= NR[1] and x >= WR[1]:
        r = max(r, max(_g(y - 70 - o) for o in (-2.3, -0.7, 0.7, 2.3)))
    return r


def undul(x, y):
    """노면의 긴 파장 처짐(±1). 낮은 곳에 물이 고인다."""
    return n2(x, y, 1 / 21.0, seed=3.3, octaves=2)


def ramp_drop(x, y):
    """횡단보도 앞 보도 턱 낮춤 깊이(경계석 윗면이 측구 위 2 cm 까지 내려간다)."""
    for cx, ys in ((XW, (TT[0], TT[1])), (XV, (VR[0], VR[1]))):
        if any(abs(y - yc) < 3.0 for yc in ys):
            return 0.13 * (1 - smoothstep(CW, CW + 1.2, abs(x - cx)))
    return 0.0


def _near(pts, x, y, w):
    return max((math.exp(-((x - px) ** 2 + (y - py) ** 2) / (w * w)) for px, py in pts), default=0.0)


DRAIN_XY = [(d[0], d[1]) for d in DRAINS]


def road_z(x, y):
    d = max(0.0, d_curb(x, y))
    z = Z_GUT + 0.02 * min(d, 6.5)                 # 횡단 경사 2 %(가장자리 측구 → 중앙)
    z -= 0.022 * math.exp(-d / 0.28)               # 측구: 경계석 앞 오목한 물길
    z -= 0.016 * RUT_K * rut(x, y)                  # 바퀴 자국 1.6 cm(성수 2041: 다시 포장 → RUT_K)
    z += 0.028 * undul(x, y) * (0.5 + 0.5 * smoothstep(0.0, 1.2, d))
    z -= 0.014 * _near(MANHOLES, x, y, 1.1)        # 맨홀 둘레 침하
    z -= 0.012 * _near(DRAIN_XY, x, y, 0.8)        # 빗물받이로 모이는 경사
    return z


def road_drive(x, y):
    d = max(0.0, d_curb(x, y))
    u = undul(x, y)
    low = clamp01(0.5 - 0.9 * u)
    g = math.exp(-d / 0.75)
    rt = rut(x, y)
    water = max(g * (0.6 + 0.6 * low), RUT_K * rt * (0.02 + 1.15 * low))   # 성수 2041: 바퀴 자국 물 고임 → RUT_K
    water = max(water, 0.75 * _near(MANHOLES, x, y, 1.0) * (0.4 + 0.6 * low), 0.8 * _near(DRAIN_XY, x, y, 0.9))
    shelter = 0.9 * math.exp(-d / 0.22) + 0.45 * _near(MANHOLES, x, y, 0.55)
    traffic = smoothstep(0.5, 1.6, d) * (0.55 + 0.45 * rt)
    shelter *= (1 - 0.7 * traffic)
    return (clamp01(water), clamp01(shelter), 1.0, 0.0)


def pit_dist(x, y):
    return min((max(abs(x - px), abs(y - py)) - PIT_H for px, py in PITS), default=99.0)


def walk_ab(key, x, y):
    a = -CURBIN[key].sdf(x, y)          # 경계석 뒤에서 안쪽으로
    b = INNER[key].sdf(x, y)            # 대지 경계까지
    return max(0.0, a), max(0.0, b)


def walk_z(key, x, y):
    a, b = walk_ab(key, x, y)
    t = b / max(1e-6, a + b)
    z = Z_CURB * t
    # 가라앉은 보도블록(이웃 메시와 만나는 가장자리에서는 0 — 틈이 생기지 않게)
    z += 0.006 * n2(x, y, 1 / 2.4, seed=11.0) * smoothstep(0.0, 0.35, a) * smoothstep(0.0, 0.35, b)
    z -= ramp_drop(x, y) * (1 - smoothstep(0.2, 1.6, a))
    return z


def walk_drive(key, x, y):
    a, b = walk_ab(key, x, y)
    settle = n2(x, y, 1 / 2.4, seed=11.0)
    water = clamp01(-settle * 1.4 - 0.15) * 0.75
    rd = ramp_drop(x, y)
    if rd > 0:
        water = max(water, rd / 0.13 * (1 - smoothstep(0.0, 1.3, a)) * 0.85)
    dp = pit_dist(x, y)
    shelter = 0.85 * math.exp(-b / 0.9) + 0.75 * math.exp(-a / 0.55) + 0.8 * math.exp(-max(0.0, dp) / 0.6) + 0.25
    traffic = smoothstep(0.6, 1.6, min(a, b)) * 0.8
    shelter *= (1 - 0.5 * traffic)
    return (clamp01(water), clamp01(shelter), 1.0, 0.0)


def covered(x, y):
    """HAUS 캔틸레버 아래(비를 맞지 않음) 0..1."""
    return smoothstep(0.5, -0.5, HAUS_BB.sdf(x, y))


def lot_z(key, x, y):
    e = -INNER[key].sdf(x, y)
    f = smoothstep(0.0, 0.6, e)
    if key == 'C1':
        f *= smoothstep(0.0, 0.6, min(_rect_d(FORE, x, y), _rect_d(LOT, x, y)))
    return 0.008 * n2(x, y, 1 / 6.0, seed=31.0) * f


def lot_drive(key, x, y):
    e = -INNER[key].sdf(x, y)
    water = clamp01(-n2(x, y, 1 / 6.0, seed=31.0) * 1.3 - 0.1) * 0.6
    shelter = 0.65 * math.exp(-max(0.0, e) / 0.7)
    cv = covered(x, y)
    shelter = max(shelter, 0.85 * cv)
    return (water, clamp01(shelter), 1 - cv, 0.0)


def fore_z(x, y):
    e = min(-_rect_d(FORE, x, y), min(_rect_d(h, x, y) for h in GRAVEL + PLANTERS))
    return 0.004 * n2(x, y, 1 / 3.0, seed=41.0) * smoothstep(0.0, 0.4, e)


def fore_drive(x, y):
    cv = covered(x, y)
    near_bed = min(_rect_d(r, x, y) for r in GRAVEL + PLANTERS)
    shelter = 0.7 * math.exp(-max(0.0, near_bed) / 0.25) + 0.85 * cv
    water = clamp01(-n2(x, y, 1 / 3.0, seed=41.0) * 1.2 - 0.2) * 0.6
    return (water, clamp01(shelter), 1 - cv, 0.0)


def _rect_d(r, x, y):
    x0, y0, x1, y1 = r
    dx = max(x0 - x, 0, x - x1); dy = max(y0 - y, 0, y - y1)
    inside = x0 <= x <= x1 and y0 <= y <= y1
    if inside:
        return -min(x - x0, x1 - x, y - y0, y1 - y)
    return math.hypot(dx, dy)


def seg_dist(px, py, poly):
    best = 1e9
    for (ax, ay), (bx, by) in zip(poly[:-1], poly[1:]):
        vx, vy = bx - ax, by - ay; L2 = vx * vx + vy * vy
        t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((px - ax) * vx + (py - ay) * vy) / L2))
        best = min(best, math.hypot(px - ax - t * vx, py - ay - t * vy))
    return best


# ═════════════════════════════ 재질(≤ 8) ═════════════════════════════
def _uvsep(M, name='UVMap'):
    u = M.b.node('ShaderNodeUVMap', uv_map=name)
    return M.b.sepxyz(u.outputs['UV'])


ASPHALT_GAIN = 1.2      # 차도 아스팔트 알베도 이득(CP1: 맑은 낮에 거의 검게 읽혀 +20 %). export 는 첫 grade 의 gain 을 굽는다


def mat_asphalt():
    """뚝섬로·이면도로·대지 아스팔트: clean_asphalt + road_damaged 보수 패치 + 실링 균열(타르 줄)."""
    M = lib.Mat('NW_asphalt'); b = M.b
    t = M.texset('clean_asphalt', M.uv(3.5))
    t2 = M.texset('road_damaged', M.uv(3.0, offset=(0.3, 0.6)))
    P = M.pos
    # 보수 패치(차도 객체만, 객체 속성 nw_roadwork): 굴착 복구 직사각형 + 차로를 따라 긴 관로 복구 띠
    rw = b.node('ShaderNodeAttribute', attribute_type='OBJECT', attribute_name='nw_roadwork').outputs['Fac']

    def cells(size, prob, xr, yr, seed):
        cell = b.vmath('DIVIDE', b.vmath('ADD', P, (seed, seed * 0.37, 0.0)), size)
        fl = b.vmath('FLOOR', cell); fr = b.vmath('FRACTION', cell)
        wn = b.node('ShaderNodeTexWhiteNoise'); wn.noise_dimensions = '3D'; b.L.new(fl, wn.inputs['Vector'])
        fx, fy, _ = b.sepxyz(fr)
        rx, ry, rz = b.sep(wn.outputs['Color'])
        inx = b.mul(b.math('GREATER_THAN', fx, b.mul(rx, xr)), b.math('LESS_THAN', fx, b.sub(1.0, b.mul(ry, xr))))
        y0 = b.add(yr[0], b.mul(rz, yr[1]))
        iny = b.mul(b.math('GREATER_THAN', fy, y0), b.math('LESS_THAN', fy, b.add(y0, yr[2])))
        return b.mul(b.mul(inx, iny), b.math('GREATER_THAN', wn.outputs['Value'], 1.0 - prob))

    patch = b.mx(cells((8.5, 3.25, 1.0), 0.07, 0.4, (0.1, 0.35, 0.45), 3.1),
                 cells((37.0, 3.25, 1.0), 0.16, 0.25, (0.15, 0.4, 0.22), 11.7))
    patch = b.mul(patch, rw)
    c1 = M.grade(t['color'], 0.55, srgb('#E4E2DE'), ASPHALT_GAIN)
    c2 = M.grade(t2['color'], 0.2, None, 0.55)
    col = b.col(patch, c1, c2)
    rough = b.flt(patch, t['rough'], t2['rough'])
    hgt = b.flt(patch, t['height'], t2['height'])
    nrm = b.mix('VECTOR', patch, t['normal'], t2['normal'])
    # 골재가 드러난 마모(라벨링): 밝고 거칠다
    rav = b.mul(b.smooth(0.55, 0.68, b.noise(P, 0.16, 5.0, 0.65)), b.sub(1.0, patch))
    col = b.col(b.mul(rav, 0.6), col, b.col(1.0, c1, (1.4, 1.4, 1.4, 1.0), 'MULTIPLY'))
    nrm = b.mix('VECTOR', b.mul(rav, 0.85), nrm, t2['normal'])
    rough = b.flt(rav, rough, 0.95)
    hgt = b.flt(rav, hgt, t2['height'])
    # 실링 균열: 노이즈 등고선 한 줄(드문드문)
    cn = b.noise(P, 0.22, 3.0, 0.55, dist=0.4)
    line = b.sub(1.0, b.smooth(0.0, 0.009, b.math('ABSOLUTE', b.sub(cn, 0.5))))
    gate = b.smooth(0.5, 0.6, b.noise(P, 0.05, 2.0, 0.5))
    crack = b.mul(b.mul(line, gate), CRACK_K)                  # 성수 2041: 새로 포장한 길(CRACK_K)
    col = b.col(crack, col, srgb('#1A1918'))
    rough = b.flt(crack, rough, 0.38)
    hgt = b.flt(crack, hgt, 0.15)
    nrm = M.micro(nrm, 'clean_asphalt', 0.55, 0.7)
    col = M.macro_var(col, 0.18)
    # 기름·타이어 얼룩: 차로 가운데가 약간 어둡다
    stain = b.mul(b.smooth(0.5, 0.75, b.noise(P, 0.35, 4.0, 0.6)), 0.35)
    col = b.col(stain, col, srgb('#2A2927'))
    mk = M.mask(base_wet=0.4, moss_bias=-0.12)
    s = M.surface(col, rough, nrm, hgt, mk, crevice_moss=2.6, crevice_puddle=0.7, porosity=0.55, wet_gloss=0.72)
    return M.finish(s.outputs['Color'], s.outputs['Roughness'], s.outputs['Normal'])


def mat_paint(name, hexcol, tactile=False):
    """노면 표시(흰·황색). 칠이 닳은 곳은 아래 아스팔트가 드러난다. 황색은 점자블록도 겸한다(UV u 오프셋으로 구분:
    u ∈ [500, 1500) 선형 블록, u ≥ 1500 점형 블록 — 웹에서는 타일 반복이라 영향 없음)."""
    M = lib.Mat(name); b = M.b
    t = M.texset('clean_asphalt', M.uv(3.5))
    P = M.pos
    wear = b.add(b.noise(P, 1.1, 4.0, 0.6), b.mul(b.sub(b.noise(P, 7.0, 2.0, 0.6), 0.5), 0.5))
    wear = b.mul(b.smooth(0.56, 0.64, wear), PAINT_WEAR)        # 성수 2041: 다시 칠한 선(마모 ≤ 0.2)
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
        # 선형 블록: 블록마다 4줄 돌기(진행 방향 = u)
        fb = b.math('FRACT', b.mul(fv, 4.0))
        bar = b.mul(b.sub(1.0, b.smooth(0.22, 0.3, b.math('ABSOLUTE', b.sub(fb, 0.5)))),
                    b.mul(b.smooth(0.04, 0.09, fu), b.smooth(0.96, 0.91, fu)))
        # 점형 블록: 6 × 6 돌기
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
    mk = M.mask(base_wet=0.4, moss_bias=-0.25)
    s = M.surface(col, rough, nrm, hgt, mk, crevice_moss=2.0, crevice_puddle=0.6, porosity=0.35, wet_gloss=0.6)
    return M.finish(s.outputs['Color'], s.outputs['Roughness'], s.outputs['Normal'])


def mat_pavers():
    """보도블록(서울 회색 200 mm): concrete_pavers_02 를 회색으로. 이끼는 줄눈에만(높이 블렌드)."""
    M = lib.Mat('NW_pavers'); b = M.b
    t = M.texset('concrete_pavers_02', M.uv(2.0))
    col = M.grade(t['color'], 0.22, srgb('#D8DAD9'), 1.0)
    nrm = M.micro(t['normal'], 'concrete_floor_worn_001', 0.6, 0.6)
    col = M.macro_var(col, 0.16)
    P = M.pos
    # 서울 보도의 얼룩(껌·기름·흙탕물 자국)과 블록마다 다른 톤
    blot = b.mul(b.smooth(0.56, 0.72, b.noise(P, 0.55, 5.0, 0.62)), 0.45)
    col = b.col(blot, col, srgb('#4A4943'))
    tone = b.node('ShaderNodeTexVoronoi', voronoi_dimensions='2D', feature='F1'); tone.inputs['Scale'].default_value = 5.0
    b.L.new(M.uv(1.0), tone.inputs['Vector'])
    tv = b.remap(b.sep(tone.outputs['Color'])[0], 0.0, 1.0, 0.86, 1.08)
    col = b.col(1.0, col, b.rgb(tv, tv, tv), 'MULTIPLY')
    mk = M.mask(base_wet=0.45, moss_bias=-0.02)
    s = M.surface(col, t['rough'], nrm, t['height'], mk, crevice_moss=5.0, crevice_puddle=1.0, porosity=0.48, wet_gloss=0.5)
    return M.finish(s.outputs['Color'], s.outputs['Roughness'], s.outputs['Normal'])


def mat_concrete():
    """경계석·화단 벽·가림막 기초·잔해: concrete_floor_worn_001. 경계석(UV v ≥ 500)은 1 m 마다 줄눈."""
    M = lib.Mat('NW_concrete'); b = M.b
    t = M.texset('concrete_floor_worn_001', M.uv(2.2))
    u, v, _ = _uvsep(M)
    is_curb = b.math('GREATER_THAN', v, 500.0)
    ju = b.math('ABSOLUTE', b.sub(b.math('FRACT', b.add(u, 0.5)), 0.5))
    joint = b.mul(b.sub(1.0, b.smooth(0.003, 0.011, ju)), is_curb)
    vv = b.sub(v, 1000.0)
    grime = b.mul(b.sub(1.0, b.smooth(0.1, 0.24, vv)), is_curb)        # 측구 쪽 아랫단 오염(#12)
    col = M.grade(t['color'], 0.5, srgb('#D9D9D6'))
    col = b.col(b.mul(grime, 0.55), col, srgb('#3B3A35'))
    col = b.col(b.mul(joint, 0.8), col, srgb('#2A2926'))
    hgt = b.mul(t['height'], b.sub(1.0, b.mul(joint, 0.95)))
    bump = b.node('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.6; bump.inputs['Distance'].default_value = 0.01
    b.put(bump.inputs['Height'], b.sub(1.0, joint)); b.put(bump.inputs['Normal'], t['normal'])
    nrm = M.micro(bump.outputs['Normal'], 'concrete_floor_worn_001', 0.5, 0.5)
    col = M.macro_var(col, 0.12, 0.08)
    mk = M.mask(base_wet=0.36, moss_bias=0.0)
    s = M.surface(col, t['rough'], nrm, hgt, mk, crevice_moss=2.6, crevice_puddle=0.8, porosity=0.45, wet_gloss=0.55)
    return M.finish(s.outputs['Color'], s.outputs['Roughness'], s.outputs['Normal'])


def mat_lot():
    """빈터 흙·잡석(coast_sand_rocks_02 를 탈색해 흙으로) + 부서진 기초 콘크리트 자갈 + 화단 흙."""
    M = lib.Mat('NW_lot'); b = M.b
    t = M.texset('coast_sand_rocks_02', M.uv(3.6))
    t2 = M.texset('concrete_floor_worn_001', M.uv(2.4, offset=(0.2, 0.7)))
    P = M.pos
    soil = M.grade(t['color'], 0.4, srgb('#C4B8A2'), 1.55)
    soil = b.col(0.25, soil, srgb('#2E2A24'))          # 대비를 조금 눌러 흙이 고르게 어둡도록
    crushed = M.grade(t2['color'], 0.4, srgb('#BDBBB4'), 0.8)
    pm = b.mul(b.smooth(0.62, 0.68, b.noise(P, 0.11, 4.0, 0.6, dist=0.3)), 0.8)
    col = b.col(pm, soil, crushed)
    rough = b.flt(pm, t['rough'], t2['rough'])
    hgt = b.flt(pm, t['height'], t2['height'])
    nrm = b.mix('VECTOR', pm, t['normal'], t2['normal'])
    nrm = M.micro(nrm, 'coast_sand_rocks_02', 0.5, 0.6)
    col = M.macro_var(col, 0.2, 0.07)
    mk = M.mask(base_wet=0.32, moss_bias=-0.04)
    s = M.surface(col, rough, nrm, hgt, mk, crevice_moss=1.4, crevice_puddle=0.6, porosity=0.5, wet_gloss=0.15)
    return M.finish(s.outputs['Color'], s.outputs['Roughness'], s.outputs['Normal'], spec=0.35)


TURF_TILE = 12.0                                  # 잔디 텍스처 한 장(m). 원본 aerial_grass_rock 은 15 m 를 찍은 것(6 m 는 조감에서 격자가 보였다)
TURF_GRADE = dict(sat=1.0, tint=(0.5, 1.1, 0.55, 1.0), gain=1.0)    # 올리브 이끼·흙 → 여름 잔디 녹색(§5 잎 #4E7A3A 근처). B 를 낮춰 자갈이 푸르게 뜨지 않게


def mat_turf():
    """포켓 공원 잔디(Task 4): aerial_grass_rock(Poly Haven CC0, 2k)을 여름 잔디 녹색으로 보정. 웹은 export 가 같은 보정을 구운
    알베도·ARM·노멀을 쓴다(export.FLAT_MAT_SPECS 에 넣지 않는다)."""
    M = lib.Mat('NW_turf'); b = M.b
    t = M.texset('aerial_grass_rock', M.uv(TURF_TILE))
    col = M.grade(t['color'], TURF_GRADE['sat'], TURF_GRADE['tint'], TURF_GRADE['gain'])
    nrm = M.micro(t['normal'], 'aerial_grass_rock', 0.9, 0.5)
    col = M.macro_var(col, 0.16, 0.06)
    mk = M.mask(base_wet=0.3, moss_bias=-0.2)
    s = M.surface(col, t['rough'], nrm, t['height'], mk, crevice_moss=0.8, crevice_puddle=0.6, porosity=0.6, wet_gloss=0.25)
    return M.finish(s.outputs['Color'], s.outputs['Roughness'], s.outputs['Normal'], spec=0.35)


def mat_gravel():
    """HAUS 전정 흰 자갈(절차적 조약돌, 지름 약 3 cm)."""
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
    mk = M.mask(base_wet=0.3, moss_bias=-0.3)
    s = M.surface(col, rough, bump.outputs['Normal'], peb, mk, crevice_moss=2.0, crevice_puddle=0.5, porosity=0.35, wet_gloss=0.45)
    return M.finish(s.outputs['Color'], s.outputs['Roughness'], s.outputs['Normal'])


def mat_iron():
    """주철 맨홀·빗물받이·가로수 보호판·철근(절차적). UV u 의 10 단위 구간이 종류: 0 맨홀, 10 빗물받이,
    20 가로수 보호판, 30 철근(녹)."""
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
    # 맨홀: 동심원 홈 + 미끄럼 방지 격자
    ring = b.sub(1.0, b.smooth(0.006, 0.018, b.math('ABSOLUTE', b.sub(b.math('FRACT', b.mul(r, 9.0)), 0.5))))
    gx = b.math('ABSOLUTE', b.sub(b.math('FRACT', b.mul(lu, 34.0)), 0.5))
    gy = b.math('ABSOLUTE', b.sub(b.math('FRACT', b.mul(v, 34.0)), 0.5))
    knurl = b.mul(b.smooth(0.3, 0.2, gx), b.smooth(0.3, 0.2, gy))
    h0 = b.mul(b.sub(1.0, ring), b.add(0.5, b.mul(knurl, 0.5)))
    # 빗물받이: 긴 방향 살(u 방향 살 사이가 구멍)
    slot = b.math('ABSOLUTE', b.sub(b.math('FRACT', b.mul(v, 11.0)), 0.5))
    bars = b.smooth(0.18, 0.26, slot)
    frame1 = b.sub(1.0, b.mul(b.mul(b.smooth(0.05, 0.08, lu), b.smooth(0.95, 0.92, lu)),
                               b.mul(b.smooth(0.08, 0.14, v), b.smooth(0.92, 0.86, v))))
    h1 = b.mx(bars, frame1)
    # 가로수 보호판: 격자 슬롯(살 + 가로대) + 가운데 줄기 구멍(흙), 두 쪽 이음
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
def finalize(o, surface, drive=None, mask_fn=None):
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
    """폴리라인 중심, 폭 w 의 띠 → (verts2d, quads)."""
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
    """축 정렬 사각형을 격자로(노면 표시용)."""
    nx = max(1, int(math.ceil((x1 - x0) / step)))
    ny = max(1, int(math.ceil((y1 - y0) / (step_across or step))))
    V = [(x0 + (x1 - x0) * i / nx, y0 + (y1 - y0) * j / ny) for j in range(ny + 1) for i in range(nx + 1)]
    F = [(j * (nx + 1) + i, j * (nx + 1) + i + 1, (j + 1) * (nx + 1) + i + 1, (j + 1) * (nx + 1) + i)
         for j in range(ny) for i in range(nx)]
    return V, F


class Acc:
    """여러 조각을 한 메시로 모은다."""

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
    """profile [(r, z)] 첫 점은 r=0(중심). → verts, faces, loop UV(평면 투영 0..1)."""
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
    """rings [(hx, hy, z)] 안쪽부터. 첫 고리는 면으로 막는다. → verts, faces."""
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
    lib.setup_fog(sc, FX)
    MAT = {
        'asphalt': mat_asphalt(), 'white': mat_paint('NW_paint_white', '#E9E9E4'),
        'yellow': mat_paint('NW_paint_yellow', '#CFA932', tactile=True), 'pavers': mat_pavers(),
        'concrete': mat_concrete(), 'lot': mat_lot(), 'gravel': mat_gravel(), 'iron': mat_iron(), 'turf': mat_turf(),
    }
    print('materials', round(time.time() - t0, 1))

    # ── 1. 차도(모든 도로를 한 메시로): 블록 외곽선이 제약선, 점은 측구 고리 + 바퀴 자국 줄 + 격자
    loops = [rr.outline(2.0, 0.35) for rr, _ in BLOCKS.values()]
    scene_loop = []
    for i in range(int(X1 - X0)):
        scene_loop.append((X0 + i, Y0))
    for i in range(int(Y1 - Y0)):
        scene_loop.append((X1, Y0 + i))
    for i in range(int(X1 - X0)):
        scene_loop.append((X1 - i, Y1))
    for i in range(int(Y1 - Y0)):
        scene_loop.append((X0, Y1 - i))
    pts = []
    for rr, _ in BLOCKS.values():
        ol = rr.outline(0.8, 0.3)
        for d in (0.11, 0.34, 0.8):
            pts.extend(lib.offset_ring(ol, -d))
    xs = [X0 + 0.6 * i for i in range(int((X1 - X0) / 0.6) + 1)]
    for wy in WHEEL_TT + WHEEL_VR:
        for o in (-0.22, 0.0, 0.22):
            pts.extend((x, wy + o) for x in xs[::2])
    ys_side = [TT[1] + 0.6 * i for i in range(int((VR[0] - TT[1]) / 0.6) + 1)]
    for o in (-2.3, -0.7, 0.7, 2.3):
        for s in (-0.19, 0.19):
            pts.extend((-105 + o + s, y) for y in ys_side[::2])
            pts.extend((x, 70 + o + s) for x in xs[::2] if x > WR[1])
    for o in (-0.85, 0.85):
        for s in (-0.19, 0.19):
            pts.extend((70 + o + s, y) for y in ys_side[::2])
    for (mx, my) in MANHOLES:
        pts.extend(lib.poly_circle(mx, my, 0.9, 10)); pts.extend(lib.poly_circle(mx, my, 0.5, 8))
    pts.extend(lib.grid_points(X0, Y0, X1, Y1, 1.3, jitter=0.3, seed=5))
    pts = [p for p in dedupe(pts) if in_scene(p[0], p[1], 0.05) and d_curb(*p) > 0.05]
    road_inside = lambda x, y: in_scene(x, y) and d_curb(x, y) > 0
    road, rv, rt = make_surface('GR_road', G, MAT['asphalt'], loops + [scene_loop], pts, road_inside, road_z, road_drive)
    road['nw_roadwork'] = 0.0               # 성수 2041: 굴착 복구 패치(road_damaged)를 끈다 — 다시 포장한 차도
    road_s = lib.Sampler(rv, rt, 2.0)
    print('road', len(rt), round(time.time() - t0, 1))

    # ── 2. 경계석: 블록 외곽선을 따라 단면 스윕(높이 15 cm, 챔퍼 2 cm). 장면 경계 위 변은 뺀다
    prof = [(0.0, -0.27), (0.0, -0.02), (0.02, 0.0), (0.16, 0.0), (0.18, -0.02), (0.18, -0.08)]
    paint_prof = [(-0.004, -0.15), (-0.004, -0.02), (0.019, 0.003), (0.15, 0.003)]
    cacc = []; yacc = []

    def on_boundary(p):
        return abs(p[0] - X0) < 1e-6 or abs(p[0] - X1) < 1e-6 or abs(p[1] - Y0) < 1e-6 or abs(p[1] - Y1) < 1e-6

    def yellow_curb(x, y):
        alley = (abs(x - AL[0]) < 0.3 or abs(x - AL[1]) < 0.3) and (-31.0 < y < 63.0 or 77.0 < y < 134.0)
        near_cw = (abs(y - TT[1]) < 0.3 or abs(y - TT[0]) < 0.3) and (-29.0 < x < -18.0)
        return alley or near_cw

    for key, (rr, w) in BLOCKS.items():
        ol = rr.outline(1.0, 0.25)
        n = len(ol)
        segs = [(ol[i], ol[(i + 1) % n]) for i in range(n)]
        keep = [not (on_boundary(a) and on_boundary(b)) for a, b in segs]
        closed = all(keep)
        runs = []
        if closed:
            runs.append((ol + [], True))
        else:
            start = keep.index(False)
            cur = []
            for k in range(n):
                i = (start + 1 + k) % n
                if keep[i]:
                    if not cur:
                        cur.append(segs[i][0])
                    cur.append(segs[i][1])
                elif cur:
                    runs.append((cur, False)); cur = []
            if cur:
                runs.append((cur, False))
        for path2, cl in runs:
            path = [(x, y, Z_CURB - ramp_drop(x, y) + 0.003 * n2(x, y, 0.9, 51.0)) for x, y in path2]
            V, F, UV = lib.sweep(path, prof, closed=cl)
            cacc.append((V, F, [[(u, vv + 1000.0) for u, vv in q] for q in UV]))
            # 황색 연석 표시
            cur = []
            for p in path + ([path[0]] if cl else []):
                if yellow_curb(p[0], p[1]):
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

    def curb_drive(x, y, z):
        h = z - Z_GUT
        wr = road_drive(x, y)[0] if d_curb(x, y) > -0.2 else 0.0
        low = 1 - smoothstep(-0.02, 0.08, h)
        return (wr * low, 0.3 + 0.55 * low, 1.0, 0.0)

    lib.write_drive(curb.data, [curb_drive(v.co.x, v.co.y, v.co.z) for v in curb.data.vertices])
    lib.tag(curb, 'ground')
    V, F, UV = merge(yacc)
    cpaint = lib.mesh_obj('GR_curb_paint', V, F, G, MAT['yellow'], smooth=True, sharp_angle=35)
    lib.set_uv(cpaint.data, 'UVMap', None, per_loop=[c for q in UV for c in q])
    lib.write_drive(cpaint.data, [curb_drive(v.co.x, v.co.y, v.co.z) for v in cpaint.data.vertices])
    lib.tag(cpaint, 'ground')
    print('curb', lib.tri_count([curb, cpaint]), round(time.time() - t0, 1))

    # ── 3. 보도(블록마다 경계석 뒤 ~ 대지 경계 띠), 가로수 구덩이는 구멍
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

    # ── 4. 대지(블록 안쪽): 아스팔트 마당. HAUS 블록은 전정·빈터를 구멍으로
    lv_all = []; lf_all = []; ld_all = []
    for key in BLOCKS:
        inner = INNER[key]
        lp = [inner.outline(3.0, 0.5)]
        holes = []
        if key == 'C1':
            holes = [FORE, LOT]
            for hr in holes:
                lp.append(RRect(*hr).outline(1.5))

        def inside(x, y, inner=inner, holes=holes):
            if not in_scene(x, y) or inner.sdf(x, y) > 0:
                return False
            return all(_rect_d(h, x, y) > 0 for h in holes)

        p = lib.grid_points(inner.x0, inner.y0, inner.x1, inner.y1, 3.0, jitter=0.3, seed=7)
        p += lib.offset_ring(inner.outline(1.5, 0.5), 0.5)
        if key == 'C1':
            p += lib.grid_points(-27, -27, 27, 27, 1.5, jitter=0.2, seed=8)   # 캔틸레버 낙수선 해상도
        p = [q for q in dedupe(p, 0.3) if inside(*q) and -inner.sdf(*q) > 0.1 and min(_rect_d(h, *q) for h in holes or [(1e5, 1e5, 1e5 + 1, 1e5 + 1)]) > 0.1]
        pl = [[(x, inner.y0 - 1), (x, inner.y1 + 1)] for x in PARCEL_X if inner.x0 < x < inner.x1]
        pl += [[(inner.x0 - 1, y), (inner.x1 + 1, y)] for y in PARCEL_Y if inner.y0 < y < inner.y1]
        v2, tris = lib.cdt(lp, p, inside, lines=pl)
        b0 = len(lv_all)
        lv_all.extend((x, y, lot_z(key, x, y)) for x, y in v2)
        ld_all.extend(lot_drive(key, x, y) for x, y in v2)
        lf_all.extend(tuple(b0 + i for i in f) for f in tris)
    lot = lib.mesh_obj('GR_blocklot', lv_all, lf_all, G, [MAT['asphalt'], MAT['concrete']])
    # 필지마다 아스팔트 마당 / 콘크리트 마당을 섞는다(약 24 × 18 m 칸). HAUS 대지는 콘크리트 광장.
    mi = []
    for f in lot.data.polygons:
        cx, cy = f.center.x, f.center.y
        if -31 < cx < 31 and -32 < cy < 27:
            mi.append(1); continue
        r = random.Random(sum(1 for v in PARCEL_X if v < cx) * 7919 + sum(1 for v in PARCEL_Y if v < cy) * 104729).random()
        mi.append(1 if r < 0.42 else 0)
    lot.data.polygons.foreach_set('material_index', mi)
    lib.write_drive(lot.data, ld_all); lib.tag(lot, 'ground')
    print('blocklot', len(lf_all), round(time.time() - t0, 1))

    # ── 5. HAUS 전정: 보도블록 마당 + 흰 자갈 화단(낙수선) + 꽃 화단 + 벤치 자리
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
    # 화단 테두리(자갈: 낮은 경계, 꽃 화단: 0.45 m 벽)
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
        finalize(o, 'ground', lambda x, y: (0.35, 0.55, 1.0, 0.0))
        cx, cy = (px0 + px1) / 2, (py0 + py1) / 2
        slot(SL, f'SLOT_planting_{i}', (cx, cy, 0.4), 0.0, size=(px1 - px0, py1 - py0))
        slot(SL, f'SLOT_bench_{i}', (cx, py0 - 0.75, 0.0), math.pi, size=(1.8, 0.6))
    print('forecourt', round(time.time() - t0, 1))

    # ── 6. 포켓 공원(옛 빈터): 잔디 기복 ±0.25 m, 물길 정원(웅덩이 3곳의 수면은 지형을 수평으로 잘라 만든 실제 평면), 산책로
    build_lot(G, SL, MAT)
    print('pocket park', round(time.time() - t0, 1))

    # ── 7. 노면 표시·점자블록
    build_markings(G, MAT, road_s, walk_s)
    print('markings', round(time.time() - t0, 1))

    # ── 8. 맨홀·빗물받이·가로수 보호판(링크 복제 = GPU 인스턴스)
    build_iron(G, SL, MAT, road_s, walk_s)
    print('iron', round(time.time() - t0, 1))

    # ── 9. 두 건물(참고용)과 카메라
    build_refs(sc)
    build_cameras(sc, LAY)
    report()
    print('done', round(time.time() - t0, 1))


def slot(c, name, loc, rz=0.0, size=(1, 1)):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = 'CUBE'; e.empty_display_size = 0.5
    e.location = loc; e.rotation_euler = (0, 0, rz)
    e['size'] = list(size)
    c.objects.link(e)
    return e


# ═════════════════════════════ 포켓 공원(옛 빈터) ═════════════════════════════
def path_dist(x, y):
    """포켓 공원 산책로(PARK_PATH, 닫힌 꺾은선) 중심선까지 거리(m)."""
    return seg_dist(x, y, PARK_PATH + PARK_PATH[:1])


def build_lot(G, SL, MAT):
    """옛 빈터 → 포켓 공원(Task 4). 잔디(NW_turf) 지면은 기복 ±0.25 m 와 완만한 둔덕(MOUNDS), 물길 정원은 웅덩이 3곳의
    수평 수면 + 얕은 물길(CHANNEL, 산책로 아래는 암거로 묻는다), 산책로(PARK_PATH)는 보도블록 띠.
    잡석·깨진 슬래브·철근·기초 벽·가림막 기초는 걷어냈다. 현무암 경계석·조경석·관목·벤치는 present.build_lot_park 가 놓는다."""
    lx0, ly0, lx1, ly1 = LOT
    step = 0.34
    nx = int(round((lx1 - lx0) / step)); ny = int(round((ly1 - ly0) / step))
    sx = (lx1 - lx0) / nx; sy = (ly1 - ly0) / ny
    H = [[0.0] * (nx + 1) for _ in range(ny + 1)]
    CH = [[0.0] * (nx + 1) for _ in range(ny + 1)]
    for j in range(ny + 1):
        y = ly0 + j * sy
        for i in range(nx + 1):
            x = lx0 + i * sx
            e = min(x - lx0, lx1 - x, y - ly0, ly1 - y)
            h = -LOT_SINK * smoothstep(0.2, 2.6, e)
            rel = 0.09 * n2(x, y, 1 / 11.0, 21.0, 3) + 0.03 * n2(x, y, 1 / 3.2, 22.0, 2)
            h += rel * smoothstep(0.6, 3.5, e)
            wx = x + 1.2 * n2(x, y, 0.15, 24.0); wy = y + 1.2 * n2(x, y, 0.15, 25.0)
            fe = smoothstep(0.3, 2.5, e)      # 테두리에서는 0 — 대지 아스팔트와 틈 없이 만난다
            for (cx, cy), r, hg in MOUNDS:
                h += fe * hg * MOUND_K * math.exp(-((wx - cx) ** 2 + (wy - cy) ** 2) / (r * r))
            for (cx, cy), r in POOLS:
                h -= fe * 0.42 * math.exp(-((wx - cx) ** 2 + (wy - cy) ** 2) / (r * r))
            # 물길: 다듬은 수로라 꺾은선을 그대로 따른다(현무암 경계석이 같은 선을 따른다). 산책로 밑 2.6 m 안은 암거
            ch = math.exp(-(seg_dist(x, y, CHANNEL) / 0.5) ** 2) * smoothstep(1.4, 2.6, path_dist(x, y))
            h -= 0.17 * ch * smoothstep(0.5, 2.0, e)
            H[j][i] = h; CH[j][i] = ch
    # 오목함(라플라시안, 약 1 m 간격)
    def lap(i, j, k=3):
        i0, i1 = max(0, i - k), min(nx, i + k); j0, j1 = max(0, j - k), min(ny, j + k)
        return (H[j][i0] + H[j][i1] + H[j0][i] + H[j1][i]) * 0.25 - H[j][i]
    # 웅덩이 수위: 가장 깊은 곳 + 0.2 m. 잔디 기복을 낮춘 뒤로는 옛 35 % 분위수 상한이 웅덩이를 반지름의 0.6 배로
    # 줄여 물길 정원에서 수면이 거의 보이지 않았다 → 상한을 뺀다(수면 반지름 ≈ 0.8 r)
    levels = []
    for (cx, cy), r in POOLS:
        hs = []
        for j in range(ny + 1):
            for i in range(nx + 1):
                x = lx0 + i * sx; y = ly0 + j * sy
                if (x - cx) ** 2 + (y - cy) ** 2 < r * r:
                    hs.append(H[j][i])
        levels.append(min(hs) + 0.2)
    verts = []; drive = []
    for j in range(ny + 1):
        y = ly0 + j * sy
        for i in range(nx + 1):
            x = lx0 + i * sx
            h = H[j][i]; fill = 0.0; shore = 0.0
            for ((cx, cy), r), L in zip(POOLS, levels):
                dd = math.hypot(x - cx, y - cy)
                if dd < 1.7 * r:
                    if h < L:
                        fill = max(fill, (L - h) / 0.2); h = L
                    shore = max(shore, math.exp(-((H[j][i] - L) / 0.12) ** 2) * (1 - smoothstep(1.2 * r, 1.7 * r, dd)))
            conc = clamp01(lap(i, j, 6) / 0.09); convex = clamp01(-lap(i, j, 6) / 0.09)
            conc_s = clamp01(lap(i, j, 2) / 0.04)
            e = min(x - lx0, lx1 - x, y - ly0, ly1 - y)
            chw = CH[j][i] ** 2.2                       # 물은 물길 바닥에만, 둑은 젖음
            water = clamp01(0.95 * chw + 0.75 * conc + 0.45 * shore)
            shelter = clamp01(0.22 + 1.25 * conc + 0.4 * conc_s + 1.1 * shore + 0.7 * CH[j][i] * (1 - chw) - 1.1 * convex
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
    o = lib.mesh_obj('GR_vacant', verts, faces, G, MAT['turf'])
    lib.write_drive(o.data, drive); lib.tag(o, 'ground')
    zs = [v[2] for k, v in enumerate(verts) if drive[k][3] <= 0.0]
    print('park lawn relief', round(min(zs), 3), round(max(zs), 3), 'pool levels', [round(L, 3) for L in levels])

    def hz(x, y):
        fi = (x - lx0) / sx; fj = (y - ly0) / sy
        i = min(nx - 1, max(0, int(fi))); j = min(ny - 1, max(0, int(fj)))
        tx = fi - i; ty = fj - j
        z = lambda ii, jj: verts[jj * (nx + 1) + ii][2]
        return (z(i, j) * (1 - tx) + z(i + 1, j) * tx) * (1 - ty) + (z(i, j + 1) * (1 - tx) + z(i + 1, j + 1) * tx) * ty

    build_park_path(G, MAT, hz)


def build_park_path(G, MAT, hz, step=0.5):
    """포켓 공원 닫힌 산책로: 폭 PARK_PATH_W 보도블록(NW_pavers), 잔디 + 0.02 m. 꺾이는 점은 마이터로 잇고, 단면은 3 점
    (가운데 점이 있어야 둔덕 위에서 잔디가 길 가운데로 솟지 않는다)."""
    P = PARK_PATH; n = len(P); hw = PARK_PATH_W / 2
    tang = []
    for k in range(n):
        (ax, ay), (bx, by) = P[k], P[(k + 1) % n]
        L = math.hypot(bx - ax, by - ay); tang.append(((bx - ax) / L, (by - ay) / L, L))
    sec = []                                          # (중심 x, y, 왼쪽 오프셋 x, y)
    for k in range(n):
        tx, ty, L = tang[k]
        px, py, _ = tang[k - 1]
        nxa, nya = -py, px; nxb, nyb = -ty, tx        # 앞·뒤 변의 왼쪽 법선
        mx, my = nxa + nxb, nya + nyb; ml = math.hypot(mx, my); mx, my = mx / ml, my / ml
        k_m = hw / max(0.3, mx * nxb + my * nyb)      # 마이터 길이
        m = max(1, int(math.ceil(L / step)))
        for i in range(m):
            t = i / m
            cx, cy = P[k][0] + tx * L * t, P[k][1] + ty * L * t
            ox, oy = (mx * k_m, my * k_m) if i == 0 else (nxb * hw, nyb * hw)
            sec.append((cx, cy, ox, oy))
    V = []; F = []
    for cx, cy, ox, oy in sec:
        for s_ in (1.0, 0.0, -1.0):
            x, y = cx + ox * s_, cy + oy * s_
            V.append((x, y, hz(x, y) + 0.02))
    N = len(sec)
    for k in range(N):
        a = 3 * k; b2 = 3 * ((k + 1) % N)
        F.append((a, a + 1, b2 + 1, b2)); F.append((a + 1, a + 2, b2 + 2, b2 + 1))
    o = lib.mesh_obj('GR_park_path', V, F, G, MAT['pavers'])
    lib.write_drive(o.data, [(0.12, 0.3 + 0.3 * (1 - smoothstep(0.0, 0.4, abs(path_dist(v[0], v[1]) - hw))), 1.0, 0.0) for v in V])
    lib.tag(o, 'ground')
    return o


# ═════════════════════════════ 노면 표시 ═════════════════════════════
def build_markings(G, MAT, road_s, walk_s):
    W = Acc(); Y = Acc(); T = Acc()

    def dashes(x0, x1, y, w, on=3.0, off=5.0, skip=()):
        x = x0
        while x < x1:
            a, b = x, min(x + on, x1)
            if not any(s0 < b and a < s1 for s0, s1 in skip):
                W.add(*strip([(a, y), (b, y)], w))
            x += on + off

    def hline(acc, x0, x1, y, w):
        acc.add(*strip([(x0, y), (x1, y)], w))

    def vline(acc, y0, y1, x, w):
        acc.add(*strip([(x, y0), (x, y1)], w))

    # 뚝섬로: 백색 차선(3 m 칠 / 5 m 빈칸, 정지선 앞 30 m 실선), 정지선, 횡단보도. 성수 2041(Task 10): 황색 이중 중앙선은 걷었다 —
    # 가운데를 태양광 띠(future FU_road_pv, TT_MEDIAN)가 덮고, 노면 표시(+0.005)가 띠(+0.012) 위로 비쳤다. 정지선도 띠 가장자리에서 끊는다
    sb_w = XW - CW - 2.0; sb_e = XW + CW + 2.0
    hline(W, sb_w - 30.0, sb_w, -45.25, 0.15)
    dashes(X0 + 1.0, sb_w - 30.0, -45.25, 0.15)
    dashes(sb_e, X1, -45.25, 0.15)
    hline(W, sb_e, sb_e + 30.0, -38.75, 0.15)
    dashes(X0 + 1.0, sb_w, -38.75, 0.15)
    dashes(sb_e + 30.0, X1, -38.75, 0.15)
    vline(W, TT[0] + 0.25, TT_MEDIAN[0] - 0.05, sb_w - 0.225, 0.45)
    vline(W, TT_MEDIAN[1] + 0.05, TT[1] - 0.25, sb_e + 0.225, 0.45)
    for k in range(14):
        yc = TT[1] - 0.425 - 0.225 - k * 0.9
        V, F = rect_strip(XW - CW, yc - 0.225, XW + CW, yc + 0.225, 0.5, 0.15)
        W.add(V, F)
    # 진행 방향 화살표(직진)
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
    # 고가 하부 가로: 황색 이중 중앙선, 횡단보도, 정지선
    vc = (VR[0] + VR[1]) / 2
    for yo in (-0.125, 0.125):
        hline(Y, X0 + 0.3, XV - CW - 2.0, vc + yo, 0.15); hline(Y, XV + CW + 2.0, X1 - 0.3, vc + yo, 0.15)
    for k in range(9):
        yc = VR[0] + 0.175 + 0.225 + k * 0.9
        V, F = rect_strip(XV - CW, yc - 0.225, XV + CW, yc + 0.225, 0.5, 0.15)
        W.add(V, F)
    vline(W, VR[0] + 0.25, vc - 0.25, XV - CW - 2.0 - 0.225, 0.45)
    vline(W, vc + 0.25, VR[1] - 0.25, XV + CW + 2.0 + 0.225, 0.45)
    # 이면도로: 입구 정지선, 골목(일방) 황색 실선(주정차 금지), 진행 화살표
    for xc in (-105.0, 70.0):
        hline(W, xc - 2.7, xc + 2.7, TT[1] + 2.0, 0.4)
        hline(W, xc - 2.7, xc + 2.7, VR[0] - 2.0, 0.4)
    vline(W, 67.3, 72.7, WR[1] + 2.0, 0.4)
    vline(W, 67.3, 70.0, AL[0] - 2.0, 0.4); vline(W, 70.0, 72.7, AL[1] + 2.0, 0.4)
    hline(W, AL[0] + 0.3, AL[1] - 0.3, NR[0] - 2.0, 0.4)
    for xe in (AL[0] + 0.35, AL[1] - 0.35):
        vline(Y, TT[1] + 4.0, NR[0] - 4.0, xe, 0.15); vline(Y, NR[1] + 4.0, VR[0] - 4.0, xe, 0.15)
    for yy in (8.0, 104.0):
        poly = [(-0.1, 0), (-0.1, 3.4), (-0.38, 3.4), (0.0, 5.0), (0.38, 3.4), (0.1, 3.4), (0.1, 0)]
        pw = [(70 + px, yy + py) for px, py in poly][::-1]
        v2, tris = lib.cdt([pw], [(70, yy + t) for t in (0.8, 1.6, 2.4, 3.2, 4.2)], lambda a, b, pw=pw: lib.point_in_poly(a, b, pw))
        W.add(v2, tris)

    rz = lambda x, y: road_s.z(x, y, road_z(x, y))
    acc_obj('GR_mark_white', W, G, MAT['white'], rz, 'ground', road_drive, offset=0.005)
    acc_obj('GR_mark_yellow', Y, G, MAT['yellow'], rz, 'ground', road_drive, offset=0.005)

    # 점자블록(300 mm): 보도를 따라 선형 블록, 횡단보도 앞은 점형 블록. UV u 오프셋 1000(선형)/2000(점형)
    def tactile_line(x0, x1, y):
        V, F = rect_strip(x0, y - 0.15, x1, y + 0.15, 0.6, 0.3)
        T.add(V, F, lambda p: (p[0] + 1000.0, p[1]))

    def tactile_v(y0, y1, x):
        V, F = rect_strip(x - 0.15, y0, x + 0.15, y1, 0.3, 0.6)
        T.add(V, F, lambda p: (p[1] + 1000.0, p[0]))

    def tactile_pad(x0, x1, y0, y1):
        V, F = rect_strip(x0, y0, x1, y1, 0.3, 0.3)
        T.add(V, F, lambda p: (p[0] + 2000.0, p[1]))

    n_line = TT[1] + 4.0 - 0.75           # 북측 보도: 대지 경계에서 0.75 m
    s_line = TT[0] - 7.5 + 0.75
    for (a, b2) in ((WR[1] + R_C + 0.5, XW - 0.15), (XW + 0.15, AL[0] - R_C - 0.5)):
        tactile_line(a, b2, n_line)
    tactile_line(AL[1] + R_C + 0.5, X1 - 1.0, n_line)
    tactile_line(X0 + 1.0, X1 - 1.0, s_line)
    for yy, sgn in ((TT[1], 1), (TT[0], -1)):
        yb = yy + sgn * (CURB_W + 0.05)
        tactile_pad(XW - CW, XW + CW, min(yb, yb + sgn * 0.6), max(yb, yb + sgn * 0.6))
        line_y = n_line if sgn > 0 else s_line
        tactile_v(min(yb + sgn * 0.6, line_y - sgn * 0.15), max(yb + sgn * 0.6, line_y - sgn * 0.15), XW)
    v_s = VR[0] - 3.5 + 0.75; v_n = VR[1] + 3.5 - 0.75
    for (a, b2) in ((WR[1] + R_C + 0.5, AL[0] - R_C - 0.5), (AL[1] + R_C + 0.5, X1 - 1.0)):
        tactile_line(a, b2, v_s)
    tactile_line(X0 + 1.0, X1 - 1.0, v_n)
    for yy, sgn, line_y in ((VR[0], -1, v_s), (VR[1], 1, v_n)):
        yb = yy + sgn * (CURB_W + 0.05)
        tactile_pad(XV - CW, XV + CW, min(yb, yb + sgn * 0.6), max(yb, yb + sgn * 0.6))
    wz = lambda x, y: walk_s.z(x, y, 0.0)

    def tdrive(x, y):
        for key in ('C1', 'S', 'C2', 'N', 'W', 'E1', 'E2'):
            if BLOCKS[key][0].sdf(x, y) < 0:
                return walk_drive(key, x, y)
        return (0.2, 0.3, 1.0, 0.0)

    acc_obj('GR_tactile', T, G, MAT['yellow'], wz, 'ground', tdrive, offset=0.006)


# ═════════════════════════════ 주철 ═════════════════════════════
def build_iron(G, SL, MAT, road_s, walk_s):
    def mmask(co, n):
        rim = smoothstep(0.3, 0.4, math.hypot(co.x, co.y))
        return (0.25 * rim, 0.6 + 0.3 * rim, 1 - 0.35 * rim)
    # 맨홀 Ø 0.83: 덮개는 테두리보다 8 mm 낮다
    V, F = revolve([(0.0, -0.002), (0.325, -0.002), (0.335, 0.004), (0.40, 0.006), (0.415, -0.02), (0.415, -0.06)], 28)
    mh = proto_mesh('GR_manhole', V, F, MAT['iron'], lambda co: (co[0] / 0.83 + 0.5, co[1] / 0.83 + 0.5), mmask, smooth=True)
    mh.set_sharp_from_angle(angle=math.radians(30))
    for i, (x, y) in enumerate(MANHOLES):
        place(f'GR_manhole.{i:03d}', mh, G, (x, y, road_s.z(x, y, road_z(x, y)) + 0.002), random.Random(i).uniform(0, 6.3))
    # 빗물받이 0.9 × 0.4: 격자는 테두리보다 1 cm 낮다
    V, F = rect_rings([(0.42, 0.17, -0.006), (0.42, 0.17, 0.004), (0.45, 0.2, 0.004), (0.45, 0.2, -0.06)])
    dr = proto_mesh('GR_drain', V, F, MAT['iron'], lambda co: (10.0 + co[0] / 0.9 + 0.5, co[1] / 0.4 + 0.5),
                    lambda co, n: (0.15, 0.85, 0.75))
    for i, (x, y, a) in enumerate(DRAINS):
        z = road_s.z(x, y, road_z(x, y))
        place(f'GR_drain.{i:03d}', dr, G, (x, y, z + 0.002), math.radians(a))
    # 가로수 보호판 1.2 m(두 쪽), 줄기 구멍 지름 0.5 m
    V, F = rect_rings([(0.6, 0.6, -0.004), (0.6, 0.6, -0.08)])
    tg = proto_mesh('GR_treegrate', V, F, MAT['iron'], lambda co: (20.0 + co[0] / 1.2 + 0.5, co[1] / 1.2 + 0.5),
                    lambda co, n: (0.35 * smoothstep(0.45, 0.6, max(abs(co.x), abs(co.y))), 0.55, 0.8))
    for i, (x, y) in enumerate(PITS):
        z = walk_s.z(x + PIT_H + 0.05, y, -0.03)
        place(f'GR_treegrate.{i:03d}', tg, G, (x, y, z), 0.0)
        slot(SL, f'SLOT_tree_{i:02d}', (x, y, z), 0.0, size=(1.2, 1.2))


# ═════════════════════════════ 건물(참고)·카메라 ═════════════════════════════
FACEARCH_RZ = 27.0   # 도 — 얼굴 모서리가 골목 건너 남서(뚝섬로·HAUS 사이)를 보게


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
    # 이름: (위치, 바라보는 점, 렌즈 mm)
    'CAM_street': ((-105.0, -50.2, 1.7), (-30.0, -31.0, 5.0), 28.0),   # 남측 보도 1.7 m → 뚝섬로 건너 HAUS(화면 폭 ~35 %)
    'CAM_ground': ((-26.4, -39.6, 3.0), (-21.4, -34.6, 0.0), 32.0),    # 지면 3 m 근접: 빗물받이·측구·경계석·보도·턱 낮춤
    'CAM_aerial': ((88.0, -84.0, 100.0), (22.0, -14.0, 0.0), 28.0),   # 45° 부감(남동쪽에서: 포켓 공원·뚝섬로·HAUS·FaceArch)
    'CAM_lot': ((44.5, -24.5, 1.7), (43.0, 2.0, -0.6), 24.0),        # (추가) 포켓 공원 남쪽 입구(뚝섬로 쪽)에서 북쪽으로 본 공원
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
    print('NW_ground objects', len(objs), 'tris', tris, 'materials', len(mats), mats)
    return {'objects': len(objs), 'tris': tris, 'materials': mats}


def render_views(suffix='', res=(1280, 720), samples=32, cams=('street', 'ground', 'aerial')):
    """build/nowhere/renders/t2-<cam><suffix>.png 로 EEVEE 렌더."""
    sc = lib.get_scene(True)
    out = []
    for c in cams:
        p = os.path.join(lib.OUT, 'renders', f't2-{c}{suffix}.png')
        lib.render(sc, bpy.data.objects[f'CAM_{c}'], p, res, samples)
        out.append(p)
    sc.render.resolution_x, sc.render.resolution_y = 1280, 720
    return out


if __name__ == '__main__':
    build()
