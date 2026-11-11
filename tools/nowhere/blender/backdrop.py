# HAUS NOWHERE — 성수 2041 / Task 4: 원경(중경 도시 링 + 스카이라인 3겹 + 능선 4겹).
# 실행: MCP 에서 exec(open('<ROOT>/tools/nowhere/blender/backdrop.py').read(), {'__name__': '__main__'})
#       헤드리스: blender -b --factory-startup --python-expr "exec(open('.../backdrop.py').read(), {'__name__': '__main__'})"
#       (NW_ground 가 없으면 ground.build() 를 먼저 부른다. 순서: ground → present → future → backdrop)
# 매 실행마다 NW_backdrop 를 비우고 처음부터 다시 만든다(멱등). 재질 NWB_ 접두어, 객체 BD_ 접두어, 그린 이미지 NWB_gen_*.
#
# 만드는 것(NW_backdrop → nowhere-backdrop.glb)
#   BD_ground, BD_roads, BD_marks   장면 가장자리(MASK_RECT)에서 반경 6.2 km 까지 끊김 없는 지면, 이어지는 도로(뚝섬로·
#                                   고가 하부 가로 등)와 차선, 한강(BD_river, y −338 … −1160)
#   BD_mid_*                         중경 도시 링(장면 가장자리 ~ 700 m): 블록·필지 → 벽돌 공장·연립·상가·지식산업센터·아파트.
#                                   한 장의 외벽 아틀라스(NWB_gen_city, 층마다 띠) + 한 장의 밤 창 발광(NWB_gen_city_night)
#   BD_far                           0.7 ~ 3 km 저층 지붕 바다 + 아파트 판상·타워(서울의 수평선)
#   BD_infra                         2호선 고가 연장(파란 LED 선은 future.py 가 같은 끝까지), 강변북로 고가
#   BD_tube_w, BD_tube_e             고가 위 유리 튜브의 원경 외피(future.TUBE_PROFILE 단면, 장면 층 튜브 바깥 ~ VIA_EXT, NWB_tube)
#   BD_layer1, BD_layer2, BD_lotte, BD_namsan_tower   스카이라인 1겹(1 ~ 1.5 km)·2겹(2.5 ~ 3 km) 실루엣
#   BD_ridge_1 … BD_ridge_4, BD_park 능선 4겹(4.0 · 4.9 · 5.6 · 6.0 km)과 서울숲 수관
# 방위·고도각(성수 리서치 §4): 장면 방위(+Y = 0°, 시계 방향)를 지키고 거리만 6 km 안으로 당긴다. 높이는 눈높이 15 m 에서
# 본 고도각이 같도록 h' = 15 + (h − 15)·(d'/d). 상표·간판은 없다. 명도·푸른 기는 안개(lib.setup_fog 의 원경 연무)가 올린다.
import bpy, bmesh, os, sys, math, random, importlib, json
from mathutils import Vector, Matrix

ROOT = os.environ.get('NW_ROOT', '/Users/gm_yeonho/new-work/so/so-viewer-monster1267')
sys.dont_write_bytecode = True
_HERE = os.path.join(ROOT, 'tools', 'nowhere', 'blender')
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)
import lib
importlib.reload(lib)
from lib import srgb, smoothstep, clamp01, n2

import numpy as np

GEN = os.path.join(lib.OUT, 'gen')
TAG = 'nw_backdrop_src'
RECT = lib.MASK_RECT                         # (−112, −162, 162, 172): 근경·중경(NW_ground)이 덮는 사각형
R_MID = 700.0                                # 중경 도시 링 끝
R_FAR = 3000.0                               # 저층·판상 채움 끝
R_DISC = 6200.0                              # 지면 원판(마지막 능선 6.0 km 뒤)
EYE = 15.0                                   # 고도각 기준 눈높이(성수 리서치 §4)
VIA_EXT = (-760.0, 780.0)                    # future.py 와 같다
RIVER = (-1160.0, -338.0)                    # 한강(장면 y). 강변북로는 y −322 … −300
ROAD_W = {'tt': (-48.5, -35.5)}

# 도로 띠(건물이 들어가지 않는 곳). (x0, y0, x1, y1). 장면 사각형 안은 NW_ground 가 맡으므로 그 밖만 쓴다.
CORR_Y = [(-56.0, -31.5, 1500.0), (66.0, 74.0, R_MID), (135.0, 172.0, 1500.0), (250.0, 260.0, R_MID), (383.0, 397.0, R_MID),
          (530.0, 550.0, R_MID), (-122.0, -114.0, R_MID), (-221.0, -209.0, R_MID), (-338.0, -290.0, 1500.0)]   # (y0, y1, 반경)
CORR_X = [(-510.0, -490.0), (-369.0, -361.0), (-236.0, -224.0), (-108.0, -102.0), (67.0, 73.0), (230.0, 240.0), (315.0, 345.0),
          (451.0, 459.0), (582.0, 598.0)]
ROADS = [   # 실제 노면 띠(차도): (축, 중심, 반폭, 끝 반경) — 차선은 'tt'·'via' 만
    ('y', -42.0, 6.5, 1500.0, 'tt'), ('y', 142.5, 4.0, 1500.0, 'via'), ('y', 70.0, 3.0, R_MID, None), ('y', 255.0, 5.0, R_MID, None),
    ('y', 390.0, 7.0, R_MID, None), ('y', 540.0, 10.0, R_MID, None), ('y', -118.0, 4.0, R_MID, None), ('y', -215.0, 6.0, R_MID, None),
    ('y', -311.0, 9.0, 1500.0, None),
    ('x', -500.0, 10.0, R_MID, None), ('x', -365.0, 4.0, R_MID, None), ('x', -230.0, 6.0, R_MID, None), ('x', -105.0, 3.0, R_MID, None),
    ('x', 70.0, 3.0, R_MID, None), ('x', 235.0, 5.0, R_MID, None), ('x', 330.0, 15.0, R_MID, None), ('x', 455.0, 4.0, R_MID, None),
    ('x', 590.0, 8.0, R_MID, None),
]

# ═════════════════════════════ 외벽 아틀라스(1024 × 2048, 띠 32개 × 64 px, 띠마다 가로 8칸) ═════════════════════════════
STRIPS = ['roof_grey', 'roof_green', 'roof_dark', 'concrete', 'brick_gf', 'brick_up', 'villa_gf', 'villa_up', 'shop_gf', 'mixed_up',
          'apt_gf', 'apt_up', 'apt_end', 'office_up', 'office_gf', 'tower4', 'apt4', 'villa3', 'brick2', 'mixed3', 'corrugated',
          'beacon', 'apt_up_b', 'apt4_b', 'tower4_b', 'tile_up']
NS = 32
SPX = 64
ATW, ATH = 1024, NS * SPX
PAD = 1.5 / ATH
S = {n: i for i, n in enumerate(STRIPS)}


def vr(name):
    k = S[name]
    return (k / NS + PAD, (k + 1) / NS - PAD)


def _hx(h):
    h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)], np.float32)


def _noise(rng, h, w, amp, cell=4):
    a = rng.standard_normal((h // cell + 2, w // cell + 2)).astype(np.float32)
    a = np.repeat(np.repeat(a, cell, 0), cell, 1)[:h, :w]
    return 1.0 + amp * a


def paint_city():
    """외벽 아틀라스(낮 알베도) + 밤 창 발광. 띠 하나 = 한 층(또는 여러 층 묶음) × 가로 8칸(칸 = 창 하나의 폭)."""
    rng = np.random.default_rng(41)
    alb = np.zeros((ATH, ATW, 3), np.float32); emi = np.zeros((ATH, ATW, 3), np.float32)
    BW = ATW // 8
    warm = [_hx('#FFC98A'), _hx('#FFD9A8'), _hx('#FFE6C2'), _hx('#F7B871')]
    cool = [_hx('#D6E6FF'), _hx('#E8F0F7')]
    neon = [_hx('#E33739'), _hx('#53C8D9'), _hx('#FDD25B'), _hx('#F2F2EE'), _hx('#43ABA7')]

    def band(name):
        k = S[name]; return alb[k * SPX:(k + 1) * SPX], emi[k * SPX:(k + 1) * SPX]

    def wallfill(A, col, amp=0.06, cell=4):
        h, w = A.shape[:2]
        A[...] = col * _noise(rng, h, w, amp, cell)[..., None]

    def rect(A, x0, y0, x1, y1, col):
        A[int(y0):int(y1), int(x0):int(x1)] = col

    def windows(name, floors, wall, win, glass, frame, lit_p, lit_cols, fx=(0.2, 0.8), fy=(0.3, 0.82), frame_px=3, amp=0.06,
                split=False, sill=None):
        A, E = band(name)
        wallfill(A, _hx(wall), amp)
        fh = SPX / floors
        for f in range(floors):
            for b in range(8):
                x0 = b * BW + fx[0] * BW; x1 = b * BW + fx[1] * BW
                y0 = f * fh + fy[0] * fh; y1 = f * fh + fy[1] * fh
                rect(A, x0 - frame_px, y0 - frame_px, x1 + frame_px, y1 + frame_px, _hx(frame))
                g = _hx(glass) * (0.85 + 0.3 * rng.random())
                rect(A, x0, y0, x1, y1, g)
                # 하늘 반사(위쪽 밝게)
                A[int((y0 + y1) / 2):int(y1), int(x0):int(x1)] *= 1.18
                if split:
                    rect(A, (x0 + x1) / 2 - 1, y0, (x0 + x1) / 2 + 1, y1, _hx(frame))
                if sill:
                    rect(A, x0 - frame_px - 2, y0 - frame_px - 3, x1 + frame_px + 2, y0 - frame_px, _hx(sill))
                if rng.random() < lit_p:
                    c = lit_cols[rng.integers(len(lit_cols))] * (0.55 + 0.45 * rng.random())
                    rect(E, x0, y0, x1, y1, c)
                    if rng.random() < 0.35:                                   # 커튼 반쯤
                        rect(E, x0, y0 + (y1 - y0) * 0.55, x1, y1, c * 0.35)
        return A, E

    # 지붕·콘크리트
    for nm, col, amp in (('roof_grey', '#8C8D89', 0.09), ('roof_green', '#5E7A66', 0.08), ('roof_dark', '#5A5E60', 0.07),
                         ('concrete', '#8A8B8E', 0.06)):
        A, _ = band(nm); wallfill(A, _hx(col), amp, 8)
    A, _ = band('concrete')
    for x in range(0, ATW, 37):                                               # 세로 빗물 얼룩
        A[:, x:x + 3] *= 0.9
    # 벽돌 공장
    A, E = band('brick_gf'); wallfill(A, _hx('#9C6652'), 0.07)
    for b in range(8):
        x0 = b * BW + 10; x1 = (b + 1) * BW - 10
        if b % 3 != 2:                                                        # 셔터
            rect(A, x0, 4, x1, 44, _hx('#7A7F7D'))
            for y in range(6, 44, 4):
                A[y:y + 1, x0:x1] *= 0.82
        else:                                                                 # 가게 유리 + 간판
            rect(A, x0, 4, x1, 42, _hx('#2B3134'))
            if rng.random() < 0.8:
                rect(E, x0, 4, x1, 42, warm[rng.integers(4)] * 0.8)
        sc = [_hx('#3D5A80'), _hx('#9E3B36'), _hx('#C9A43A'), _hx('#E9E6DC'), _hx('#3E6D5A')][rng.integers(5)]
        rect(A, x0, 48, x1, 58, sc)
        if rng.random() < 0.6:
            rect(E, x0, 48, x1, 58, neon[rng.integers(len(neon))] * 0.9)
    windows('brick_up', 1, '#A06A55', None, '#2B3236', '#5A5E60', 0.22, warm + cool[:1], fx=(0.18, 0.82), fy=(0.25, 0.8), sill='#8D8A84')
    windows('brick2', 2, '#9A6450', None, '#2B3236', '#5A5E60', 0.22, warm, fx=(0.18, 0.82), fy=(0.25, 0.8), sill='#8D8A84')
    # 연립
    A, E = band('villa_gf'); wallfill(A, _hx('#1F2022'), 0.05)
    for b in range(8):
        rect(A, b * BW, 0, b * BW + 12, SPX, _hx('#BDB6A6'))                   # 필로티 기둥
        rect(A, b * BW, SPX - 8, (b + 1) * BW, SPX, _hx('#BDB6A6'))
        if rng.random() < 0.3:
            rect(E, b * BW + 20, 30, b * BW + 40, 50, cool[0] * 0.6)          # 필로티 조명
    windows('villa_up', 1, '#CDBFA6', None, '#2E363A', '#C9C9C4', 0.45, warm, fx=(0.28, 0.72), fy=(0.3, 0.78), sill='#E2DFD6')
    windows('tile_up', 1, '#D8D5CC', None, '#2E363A', '#A9ACA8', 0.42, warm, fx=(0.25, 0.75), fy=(0.3, 0.78))
    windows('villa3', 3, '#C9BCA4', None, '#2E363A', '#C9C9C4', 0.45, warm, fx=(0.28, 0.72), fy=(0.3, 0.78), frame_px=1)
    # 상가
    A, E = band('shop_gf'); wallfill(A, _hx('#6E6C68'), 0.05)
    for b in range(8):
        x0 = b * BW + 6; x1 = (b + 1) * BW - 6
        rect(A, x0, 3, x1, 40, _hx('#262C30'))
        A[22:40, x0:x1] *= 1.25
        if rng.random() < 0.85:
            rect(E, x0, 3, x1, 40, (warm + cool)[rng.integers(6)] * (0.7 + 0.3 * rng.random()))
        sc = [_hx('#2F4E7A'), _hx('#A33A33'), _hx('#D0A940'), _hx('#ECE9E2'), _hx('#2F6B60'), _hx('#5B4A7A')][rng.integers(6)]
        rect(A, x0, 44, x1, 58, sc * 0.85)
        if rng.random() < 0.85:
            rect(E, x0, 44, x1, 58, neon[rng.integers(len(neon))])
    windows('mixed_up', 1, '#B3AFA6', None, '#29323A', '#8E9190', 0.3, warm + cool, fx=(0.04, 0.96), fy=(0.3, 0.75), frame_px=2)
    windows('mixed3', 3, '#ADA9A0', None, '#29323A', '#8E9190', 0.3, warm + cool, fx=(0.04, 0.96), fy=(0.3, 0.75), frame_px=1)
    # 아파트(크림·회백, 남면 발코니 유리 띠)
    for nm, wall, floors in (('apt_up', '#D9D3B8', 1), ('apt_up_b', '#DCDCD6', 1), ('apt4', '#D6D0B6', 4), ('apt4_b', '#D9D9D3', 4)):
        A, E = band(nm); wallfill(A, _hx(wall), 0.04)
        fh = SPX / floors
        for f in range(floors):
            y0 = f * fh
            rect(A, 0, y0 + fh * 0.12, ATW, y0 + fh * 0.42, _hx('#E4E2DA'))     # 발코니 난간 띠
            rect(A, 0, y0 + fh * 0.42, ATW, y0 + fh * 0.86, _hx('#4D5A60'))     # 유리
            A[int(y0 + fh * 0.64):int(y0 + fh * 0.86)] *= 1.15
            for b in range(8):
                rect(A, b * BW, y0 + fh * 0.12, b * BW + 6, y0 + fh * 0.9, _hx('#CFC9B0'))   # 세대 경계 벽
                for half in (0, 1):
                    if rng.random() < 0.5:
                        x0 = b * BW + 6 + half * (BW - 6) / 2; x1 = x0 + (BW - 6) / 2
                        rect(E, x0, y0 + fh * 0.44, x1, y0 + fh * 0.84, warm[rng.integers(4)] * (0.5 + 0.5 * rng.random()))
    A, E = band('apt_gf'); wallfill(A, _hx('#2A2B2D'), 0.04)
    for b in range(8):
        rect(A, b * BW, 0, b * BW + 14, SPX, _hx('#D3CDB4'))
        if b % 4 == 1:
            rect(A, b * BW + 30, 4, b * BW + 100, 48, _hx('#5A6870')); rect(E, b * BW + 30, 4, b * BW + 100, 48, cool[1] * 0.8)
    A, E = band('apt_end'); wallfill(A, _hx('#D5CFB5'), 0.03)
    for b in range(8):
        if b in (3, 4):
            rect(A, b * BW + 40, 18, b * BW + 88, 48, _hx('#3E4A50'))         # 계단실 작은 창
            if rng.random() < 0.6:
                rect(E, b * BW + 40, 18, b * BW + 88, 48, cool[0] * 0.5)
    rect(A, 0, 0, 30, SPX, _hx('#7E978C'))                                    # 색 띠(단지 도색, 글자 없음)
    # 업무·지식산업센터·타워(커튼월)
    # 성수 2041(Task 7): 밝은 청유리 + 흰 멀리언. 띠 안 세로 위치 v(0 = 아래, 1 = 위)로 하늘 반사(glass → #D6E6F1, 0.35·v),
    # 유리 칸 4개 중 하나는 블라인드로 10 % 어둡게. 블라인드는 따로 둔 난수(rb)로 고른다 — rng 순서가 그대로라 밤 발광
    # 아틀라스(NWB_gen_city_night)와 다른 띠의 무늬는 바뀌지 않는다.
    sky = _hx('#D6E6F1'); rb = np.random.default_rng(2041)
    tv = 0.35 * (np.arange(SPX, dtype=np.float32) + 0.5) / SPX                # 행마다 0.35·v(행 0 = 아래)
    for nm, floors, glass, mull, p in (('office_up', 1, '#7FA6C4', '#DDE3E7', 0.35), ('tower4', 4, '#8FB4CF', '#DDE3E7', 0.3),
                                       ('tower4_b', 4, '#A9C6DA', '#E4E8EA', 0.3)):
        A, E = band(nm); fh = SPX / floors
        wallfill(A, _hx(glass), 0.05)
        A[...] = A * (1.0 - tv)[:, None, None] + sky * tv[:, None, None]
        for f in range(floors):
            for b in range(16):
                if rb.random() < 0.25:
                    A[int(f * fh):int((f + 1) * fh), b * BW // 2:(b + 1) * BW // 2] *= 0.9
        for f in range(floors):
            y0 = f * fh
            rect(A, 0, y0, ATW, y0 + max(1, fh * 0.18), _hx('#3D4850'))      # 스팬드럴
            A[int(y0 + fh * 0.6):int(y0 + fh)] *= 1.12
            for x in range(0, ATW, BW // 2):
                rect(A, x, y0, x + 2, y0 + fh, _hx(mull))
            for b in range(16):
                if rng.random() < p:
                    c = (cool + warm[:2])[rng.integers(4)] * (0.5 + 0.4 * rng.random())
                    rect(E, b * BW // 2 + 3, y0 + fh * 0.22, (b + 1) * BW // 2 - 1, y0 + fh * 0.95, c)
    A, E = band('office_gf'); wallfill(A, _hx('#3A444B'), 0.04)
    for b in range(8):
        rect(A, b * BW, 0, b * BW + 4, SPX, _hx('#A9B0B4'))
        rect(E, b * BW + 6, 4, (b + 1) * BW - 2, 54, cool[1] * 0.9)
    # 골함석 작업동(한 층 6 m, 위 고창)
    A, E = band('corrugated'); wallfill(A, _hx('#7D8380'), 0.05)
    for x in range(0, ATW, 6):
        A[:, x:x + 2] *= 0.85
    for b in range(8):
        rect(A, b * BW + 16, 46, (b + 1) * BW - 16, 56, _hx('#3A4246'))
        if rng.random() < 0.3:
            rect(E, b * BW + 16, 46, (b + 1) * BW - 16, 56, warm[0] * 0.5)
    A, E = band('beacon'); A[...] = _hx('#B8262A'); E[...] = _hx('#FF2A22')
    a4 = np.ones((ATH, ATW, 4), np.float32); a4[..., :3] = np.clip(alb, 0, 1)
    e4 = np.ones((ATH, ATW, 4), np.float32); e4[..., :3] = np.clip(emi, 0, 1)
    ia = lib.save_image('NWB_gen_city', a4, os.path.join(GEN, 'NWB_gen_city.png'), TAG)
    ie = lib.save_image('NWB_gen_city_night', e4, os.path.join(GEN, 'NWB_gen_city_night.png'), TAG)
    return ia, ie


def paint_ridge():
    """능선 텍스처 512²: v 0 ~ 0.5 = 숲(아래 어둡게), v 0.5 ~ 1 = 숲 → 화강암 능선(완만한 색 변화, 흰 고깔 현상 방지)."""
    rng = np.random.default_rng(7)
    H = W = 512
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    v = yy / H
    forest0 = _hx('#263134'); forest1 = _hx('#334044'); rock = _hx('#465258')
    f = np.clip(v / 0.55, 0, 1)
    col = forest0 * (1 - f[..., None]) + forest1 * f[..., None]
    top = np.clip((v - 0.55) / 0.45, 0, 1)
    n = _noise(rng, H, W, 0.35, 8)
    rk = np.clip(top * (0.5 + 0.4 * (n - 1.0)), 0, 1) * (v > 0.45)
    col = col * (1 - rk[..., None]) + rock * rk[..., None]
    col *= _noise(rng, H, W, 0.08, 2)[..., None]
    out = np.ones((H, W, 4), np.float32); out[..., :3] = np.clip(col, 0, 1)
    return lib.save_image('NWB_gen_ridge', out, os.path.join(GEN, 'NWB_gen_ridge.png'), TAG)


def paint_paint():
    out = np.ones((4, 16, 4), np.float32)
    out[:, :8, :3] = _hx('#E6E6E0'); out[:, 8:, :3] = _hx('#D2AA3A')
    return lib.save_image('NWB_gen_paint', out, os.path.join(GEN, 'NWB_gen_paint.png'), TAG)


# ═════════════════════════════ 재질 ═════════════════════════════
def _guard(name):
    if not name.startswith('NWB_'):
        raise ValueError(f'backdrop 재질 이름은 NWB_ 로 시작해야 한다: {name}')
    m = bpy.data.materials.get(name)
    if m is not None and not m.get(TAG):
        raise ValueError(f'이미 다른 스크립트가 쓰는 재질 이름: {name}')
    return name


def _new_mat(name):
    _guard(name)
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True; m.node_tree.nodes.clear(); m[TAG] = 1
    for k in ('nw_emit', 'nw_night', 'nw_tex'):
        if k in m.keys():
            del m[k]
    return m


def mat_city(alb, emi):
    m = _new_mat('NWB_city'); b = lib.NB(m.node_tree)
    out = b.node('ShaderNodeOutputMaterial'); bs = b.node('ShaderNodeBsdfPrincipled'); b.L.new(bs.outputs[0], out.inputs['Surface'])
    uv = b.node('ShaderNodeUVMap', uv_map='UVMap')
    ta = b.node('ShaderNodeTexImage'); ta.image = alb; ta.interpolation = 'Linear'; b.L.new(uv.outputs['UV'], ta.inputs['Vector'])
    te = b.node('ShaderNodeTexImage'); te.image = emi; te.interpolation = 'Linear'; b.L.new(uv.outputs['UV'], te.inputs['Vector'])
    c = b.col(1.0, ta.outputs['Color'], (0.92, 0.92, 0.92, 1), 'MULTIPLY')
    b.L.new(c, bs.inputs['Base Color'])
    b.L.new(te.outputs['Color'], bs.inputs['Emission Color'])
    b.put(bs.inputs['Emission Strength'], lib.emit_strength(b, 0.0, 3.2))
    bs.inputs['Roughness'].default_value = 0.72; bs.inputs['Specular IOR Level'].default_value = 0.45
    m['nw_surface'] = 'wall'
    m['nw_tex'] = json.dumps({'kind': 'atlas', 'albedo': alb.name, 'emissive': emi.name, 'strips': STRIPS, 'strip_px': SPX,
                              'size': [ATW, ATH], 'bays': 8}, ensure_ascii=False)
    lib.emit_meta(m, None, emi.name, 0.0, 3.2)
    return m


def mat_ridge(img):
    m = _new_mat('NWB_ridge'); b = lib.NB(m.node_tree)
    out = b.node('ShaderNodeOutputMaterial'); bs = b.node('ShaderNodeBsdfPrincipled'); b.L.new(bs.outputs[0], out.inputs['Surface'])
    uv = b.node('ShaderNodeUVMap', uv_map='UVMap')
    t = b.node('ShaderNodeTexImage'); t.image = img; t.extension = 'EXTEND'; b.L.new(uv.outputs['UV'], t.inputs['Vector'])
    b.L.new(t.outputs['Color'], bs.inputs['Base Color'])
    bs.inputs['Roughness'].default_value = 0.95; bs.inputs['Specular IOR Level'].default_value = 0.2
    m['nw_surface'] = 'foliage'
    m['nw_tex'] = json.dumps({'kind': 'gen', 'albedo': img.name, 'u': 'bearing', 'v': '0..0.5 forest, 0.5..1 forest→granite'}, ensure_ascii=False)
    return m


def mat_water():
    m = _new_mat('NWB_water'); b = lib.NB(m.node_tree)
    out = b.node('ShaderNodeOutputMaterial'); bs = b.node('ShaderNodeBsdfPrincipled'); b.L.new(bs.outputs[0], out.inputs['Surface'])
    bs.inputs['Base Color'].default_value = srgb('#1B2427'); bs.inputs['Roughness'].default_value = 0.06
    bs.inputs['Specular IOR Level'].default_value = 0.5
    geo = b.node('ShaderNodeNewGeometry')
    bump = b.node('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.08
    b.put(bump.inputs['Height'], b.noise(geo.outputs['Position'], 0.25, 3.0, 0.6))
    b.L.new(bump.outputs['Normal'], bs.inputs['Normal'])
    m['nw_surface'] = 'water'
    m['nw_tex'] = json.dumps({'kind': 'flat', 'color': '#1B2427', 'rough': 0.06, 'ripple': 'noise 4 m'}, ensure_ascii=False)
    return m


def mat_paint(img):
    m = _new_mat('NWB_paint'); b = lib.NB(m.node_tree)
    out = b.node('ShaderNodeOutputMaterial'); bs = b.node('ShaderNodeBsdfPrincipled'); b.L.new(bs.outputs[0], out.inputs['Surface'])
    uv = b.node('ShaderNodeUVMap', uv_map='UVMap')
    t = b.node('ShaderNodeTexImage'); t.image = img; t.interpolation = 'Closest'; b.L.new(uv.outputs['UV'], t.inputs['Vector'])
    b.L.new(b.col(1.0, t.outputs['Color'], (0.8, 0.8, 0.8, 1), 'MULTIPLY'), bs.inputs['Base Color'])
    bs.inputs['Roughness'].default_value = 0.45
    m['nw_surface'] = 'ground'
    m['nw_tex'] = json.dumps({'kind': 'palette', 'albedo': img.name, 'cells': {'white': [0.25, 0.5], 'yellow': [0.75, 0.5]}}, ensure_ascii=False)
    return m


def mat_tube():
    """2호선 유리 튜브의 원경 외피(Task 7): 불투명 청유리 금속. 멀리서는 하늘을 비추는 반사 띠로 읽힌다."""
    m = _new_mat('NWB_tube'); b = lib.NB(m.node_tree)
    out = b.node('ShaderNodeOutputMaterial'); bs = b.node('ShaderNodeBsdfPrincipled'); b.L.new(bs.outputs[0], out.inputs['Surface'])
    bs.inputs['Base Color'].default_value = srgb('#9FC3D6'); bs.inputs['Roughness'].default_value = 0.15
    bs.inputs['Metallic'].default_value = 0.6
    m['nw_surface'] = 'glass'
    m['nw_tex'] = json.dumps({'kind': 'flat', 'color': '#9FC3D6', 'rough': 0.15, 'metal': 0.6}, ensure_ascii=False)
    return m


def materials():
    ia, ie = paint_city()
    M = {
        'city': mat_city(ia, ie),
        'tube': mat_tube(),
        'ground': lib.pbr(_guard('NWB_ground'), 'clean_asphalt', size_m=5.0, base_wet=0.35, moss_bias=-0.2, puddle_bias=-1.0,
                          sat=0.45, normal=0.6),
        'ridge': mat_ridge(paint_ridge()),
        'water': mat_water(),
        'paint': mat_paint(paint_paint()),
    }
    M['ground'][TAG] = 1; M['ground']['nw_surface'] = 'ground'
    return M


# ═════════════════════════════ 메시 누적기(UV·재질) ═════════════════════════════
class Acc:
    def __init__(self):
        self.V = []; self.F = []; self.UV = []; self.FM = []

    def poly(self, pts, uvs, mat=0):
        b = len(self.V)
        self.V.extend(tuple(p) for p in pts)
        self.F.append(list(range(b, b + len(pts)))); self.UV.append(list(uvs)); self.FM.append(mat)

    def tris(self):
        return sum(len(f) - 2 for f in self.F)

    def to_obj(self, name, C, mats, surface='wall', mask=None, smooth=False):
        o = bpy.data.objects.get(name)
        if o is not None:
            bpy.data.objects.remove(o, do_unlink=True)
        me = bpy.data.meshes.get(name)
        if me is not None and me.users == 0:
            bpy.data.meshes.remove(me)
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.V, [], [tuple(f) for f in self.F])
        me.validate(clean_customdata=False)
        lib.set_uv(me, 'UVMap', None, per_loop=[uv for f in self.UV for uv in f])
        for m in mats:
            me.materials.append(m)
        if len(mats) > 1:
            me.polygons.foreach_set('material_index', self.FM)
        if smooth:
            me.shade_smooth()
        mk = mask or (lambda co: (0.0, 0.2, 0.75 + 0.25 * smoothstep(0.0, 6.0, co[2])))
        lib.write_mask_values(me, [mk(v.co) for v in me.vertices])
        me[TAG] = 1
        o = bpy.data.objects.new(name, me); C.objects.link(o)
        lib.tag(o, surface); o['nw_vmask'] = 1.0
        return o


def _uv_row(strip, z0, z1, floor_h):
    """한 줄(띠 하나 = floor_h 높이)의 v 범위. 줄 높이가 floor_h 와 다르면 띠를 늘이거나 줄인다(한 줄 = 띠 하나)."""
    lo, hi = vr(strip)
    return lo, hi


def walls(acc, fp, z0, z1, strip, bay_w, uoff, strip_of_edge=None):
    """외곽선 fp(반시계)의 벽 한 줄(z0 → z1)을 띠 strip 으로. u = 둘레 길이 / (8·bay_w) + uoff."""
    n = len(fp)
    for i in range(n):
        a = fp[i]; b = fp[(i + 1) % n]
        L = math.dist(a, b)
        st = strip_of_edge(i, L) if strip_of_edge else strip
        lo, hi = vr(st)
        u0 = uoff + (i * 0.375); u1 = u0 + L / (8.0 * bay_w)
        acc.poly([(a[0], a[1], z0), (b[0], b[1], z0), (b[0], b[1], z1), (a[0], a[1], z1)], [(u0, lo), (u1, lo), (u1, hi), (u0, hi)])


def roof_flat(acc, fp, z, strip):
    lo, hi = vr(strip)
    xs = [p[0] for p in fp]; ys = [p[1] for p in fp]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    uv = [((p[0] - x0) / 30.0, lo + (hi - lo) * (p[1] - y0) / max(1e-6, (y1 - y0))) for p in fp]
    acc.poly([(p[0], p[1], z) for p in fp], uv)


def rect_fp(cx, cy, L, D, ang=0.0):
    c, s = math.cos(ang), math.sin(ang)
    pts = [(-L / 2, -D / 2), (L / 2, -D / 2), (L / 2, D / 2), (-L / 2, D / 2)]
    return [(cx + x * c - y * s, cy + x * s + y * c) for x, y in pts]


def gable(acc, cx, cy, L, D, ang, ze, pitch, wall_strip, roof_strip):
    """박공지붕(용마루 = 장축). 경사면 2 + 박공 삼각형 2."""
    zr = ze + D / 2 * math.tan(math.radians(pitch))
    c, s = math.cos(ang), math.sin(ang)
    P = lambda x, y, z: (cx + x * c - y * s, cy + x * s + y * c, z)
    lo, hi = vr(roof_strip)
    acc.poly([P(-L / 2, -D / 2, ze), P(L / 2, -D / 2, ze), P(L / 2, 0, zr), P(-L / 2, 0, zr)], [(0, lo), (L / 20, lo), (L / 20, hi), (0, hi)])
    acc.poly([P(L / 2, D / 2, ze), P(-L / 2, D / 2, ze), P(-L / 2, 0, zr), P(L / 2, 0, zr)], [(0, lo), (L / 20, lo), (L / 20, hi), (0, hi)])
    wl, wh = vr(wall_strip)
    acc.poly([P(L / 2, -D / 2, ze), P(L / 2, D / 2, ze), P(L / 2, 0, zr)], [(0, wl), (0.3, wl), (0.15, wh)])
    acc.poly([P(-L / 2, D / 2, ze), P(-L / 2, -D / 2, ze), P(-L / 2, 0, zr)], [(0, wl), (0.3, wl), (0.15, wh)])
    return zr


def boxtop(acc, cx, cy, w, d, z0, h, strip='concrete', ang=0.0):
    fp = rect_fp(cx, cy, w, d, ang)
    walls(acc, fp, z0, z0 + h, strip, 2.0, 0.0)
    roof_flat(acc, fp, z0 + h, 'roof_grey')


# ═════════════════════════════ 건물 유형 ═════════════════════════════
TYPES = {   # 1층 띠, 위층 띠, 층고(1층, 위층), 칸 폭, 먼 거리용 묶음 띠(층 수)
    'factory': dict(gf='brick_gf', up='brick_up', h=(4.5, 3.8), bay=4.6, far=('brick2', 2)),
    'villa': dict(gf='villa_gf', up='villa_up', h=(3.0, 2.8), bay=3.6, far=('villa3', 3)),
    'villa_t': dict(gf='villa_gf', up='tile_up', h=(3.0, 2.8), bay=3.4, far=('villa3', 3)),
    'shop': dict(gf='shop_gf', up='mixed_up', h=(4.0, 3.3), bay=4.0, far=('mixed3', 3)),
    'office': dict(gf='office_gf', up='office_up', h=(5.0, 3.8), bay=3.0, far=('tower4_b', 4)),
    'apt': dict(gf='apt_gf', up='apt_up', h=(4.5, 2.8), bay=2.9, far=('apt4', 4)),
    'apt_b': dict(gf='apt_gf', up='apt_up_b', h=(4.5, 2.8), bay=2.9, far=('apt4_b', 4)),
}


def building(acc, rnd, kind, fp, floors, near, roof='flat', rect=None, rooftop=True):
    """fp(반시계) 위에 kind 건물. near=True 면 층마다 한 줄, 아니면 묶음 띠(먼 거리). 반환: 지붕 높이."""
    T = TYPES[kind]
    gh, uh = T['h']
    z = 0.0
    is_apt = kind.startswith('apt')

    def edge_strip(st):
        if not is_apt:
            return None
        return lambda i, L: (st if L > 20.0 else 'apt_end')

    walls(acc, fp, z, gh, T['gf'], T['bay'], rnd.randrange(8) / 8.0, edge_strip(T['gf']))
    z = gh
    up = floors - 1
    if near:
        for f in range(up):
            walls(acc, fp, z, z + uh, T['up'], T['bay'], rnd.randrange(8) / 8.0, edge_strip(T['up']))
            z += uh
    else:
        st, k = T['far']
        while up > 0:
            n = min(k, up)
            walls(acc, fp, z, z + uh * n, st, T['bay'], rnd.randrange(8) / 8.0, edge_strip(st))
            z += uh * n; up -= n
    if roof == 'gable' and rect is not None:
        cx, cy, L, D, ang = rect
        return gable(acc, cx, cy, L, D, ang, z, rnd.uniform(9, 16), T['gf'] if not near else T['up'], 'roof_dark')
    par = 0.9 if not is_apt else 1.4
    walls(acc, fp, z, z + par, 'concrete', 4.0, rnd.random())
    z += par
    roof_flat(acc, fp, z, rnd.choice(('roof_grey', 'roof_green', 'roof_green', 'roof_grey')) if not is_apt else 'roof_grey')
    if rooftop and rect is not None:
        cx, cy, L, D, ang = rect
        if is_apt:                                                     # 승강기탑 2 + 지붕 장식 틀
            for sx in (-0.3, 0.3):
                boxtop(acc, cx + math.cos(ang) * L * sx, cy + math.sin(ang) * L * sx, 5.0, D * 0.55, z, 4.5, 'apt_end', ang)
        elif rnd.random() < 0.45:
            boxtop(acc, cx + rnd.uniform(-L, L) * 0.25, cy + rnd.uniform(-D, D) * 0.2, 3.5, 3.0, z, 2.8, 'concrete', ang)
    return z


# ═════════════════════════════ 중경 도시 링 ═════════════════════════════
def in_rect(x, y, r, m=0.0):
    return r[0] - m < x < r[2] + m and r[1] - m < y < r[3] + m


def rect_minus(a, b):
    """사각형 a − b → 사각형 목록(최대 4)."""
    ax0, ay0, ax1, ay1 = a; bx0, by0, bx1, by1 = b
    if bx1 <= ax0 or bx0 >= ax1 or by1 <= ay0 or by0 >= ay1:
        return [a]
    out = []
    if by0 > ay0:
        out.append((ax0, ay0, ax1, by0))
    if by1 < ay1:
        out.append((ax0, by1, ax1, ay1))
    yl, yh = max(ay0, by0), min(ay1, by1)
    if bx0 > ax0:
        out.append((ax0, yl, bx0, yh))
    if bx1 < ax1:
        out.append((bx1, yl, ax1, yh))
    return [r for r in out if r[2] - r[0] > 6 and r[3] - r[1] > 6]


def zone(x, y):
    if y < RIVER[1] + 48:
        return None
    if y < -160:
        return 'apt'
    if -160 <= y < -56:
        return 'mix'
    if x > 160 and -56 <= y < 172:
        return 'ind'
    if 172 <= y < 420 and -240 < x < 460:
        return 'ind'
    if y >= 420 or x <= -360 or x >= 455:
        return 'apt2'
    return 'mix'


def blocks():
    xs = sorted([(-R_MID - 50, -R_MID - 50)] + CORR_X + [(R_MID + 50, R_MID + 50)])
    ys = sorted([(-R_MID - 50, -R_MID - 50)] + [(c[0], c[1]) for c in CORR_Y] + [(R_MID + 50, R_MID + 50)])
    out = []
    for i in range(len(xs) - 1):
        for j in range(len(ys) - 1):
            b = (xs[i][1], ys[j][1], xs[i + 1][0], ys[j + 1][0])
            if b[2] - b[0] < 8 or b[3] - b[1] < 8:
                continue
            out.extend(rect_minus(b, (RECT[0] - 4, RECT[1] - 4, RECT[2] + 4, RECT[3] + 4)))
    return out


def split(r, rnd, target, stop_p=0.0, depth=0):
    x0, y0, x1, y1 = r
    w, h = x1 - x0, y1 - y0
    if max(w, h) <= target or (depth > 1 and rnd.random() < stop_p):
        return [r]
    f = rnd.uniform(0.38, 0.62)
    if w >= h:
        xm = x0 + w * f; return split((x0, y0, xm, y1), rnd, target, stop_p, depth + 1) + split((xm, y0, x1, y1), rnd, target, stop_p, depth + 1)
    ym = y0 + h * f
    return split((x0, y0, x1, ym), rnd, target, stop_p, depth + 1) + split((x0, ym, x1, y1), rnd, target, stop_p, depth + 1)


def dist_rect(x, y):
    dx = max(RECT[0] - x, 0, x - RECT[2]); dy = max(RECT[1] - y, 0, y - RECT[3])
    return math.hypot(dx, dy)


def build_mid(C, M):
    rnd = random.Random(2041)
    accs = {k: Acc() for k in ('n', 's', 'e', 'w')}
    stats = {}
    # 성수 2041 신축 타워 대지(future.TOWERS + 12 m 여유): 걸린 필지는 지면만 남긴다. 그 필지의 건물은 버리는 누적기(void)에
    # 지어 난수 순서를 지킨다 → 대지 밖 도시는 그대로다.
    import future
    sites = [(t['c'][0] - t['size'][0] / 2 - future.TOWER_SITE_MARGIN, t['c'][1] - t['size'][1] / 2 - future.TOWER_SITE_MARGIN,
              t['c'][0] + t['size'][0] / 2 + future.TOWER_SITE_MARGIN, t['c'][1] + t['size'][1] / 2 + future.TOWER_SITE_MARGIN)
             for t in future.TOWERS]
    overlaps = lambda r: any(r[0] < s[2] and s[0] < r[2] and r[1] < s[3] and s[1] < r[3] for s in sites)
    void = Acc(); cleared = {t['id']: 0 for t in future.TOWERS}
    for blk in blocks():
        cx, cy = (blk[0] + blk[2]) / 2, (blk[1] + blk[3]) / 2
        if math.hypot(cx, cy) > R_MID + 40:
            continue
        z = zone(cx, cy)
        if z is None:
            continue
        sector = 'n' if cy > 172 else ('s' if cy < -162 else ('e' if cx > 0 else 'w'))
        acc = accs[sector]
        if z == 'apt' or (z == 'apt2' and rnd.random() < 0.55 and (blk[2] - blk[0]) > 60 and (blk[3] - blk[1]) > 50):
            # 아파트 단지: 판상 동을 줄지어(남향 = 장축 x, 또는 강 방향 +19°)
            ang = 0.0 if rnd.random() < 0.6 else math.radians(19.0)
            kind = 'apt' if rnd.random() < 0.6 else 'apt_b'
            floors = rnd.randint(15, 25)
            row = 0
            y = blk[1] + 16
            while y < blk[3] - 14:
                x = blk[0] + 12
                while x < blk[2] - 30:
                    L = min(rnd.uniform(48, 86), blk[2] - 12 - x)
                    if L < 34:
                        break
                    bcx, bcy = x + L / 2, y + 7
                    if math.hypot(bcx, bcy) < R_MID + 40 and dist_rect(bcx, bcy) > 20:
                        fp = rect_fp(bcx, bcy, L, 13.5, ang)
                        near = math.hypot(bcx, bcy) < 360
                        building(acc, rnd, kind, fp, floors + rnd.randint(-2, 2), near, rect=(bcx, bcy, L, 13.5, ang))
                        stats['apt'] = stats.get('apt', 0) + 1
                    x += L + rnd.uniform(14, 26)
                y += rnd.uniform(42, 52); row += 1
            continue
        target = {'ind': 46.0, 'mix': 24.0, 'apt2': 26.0}[z]
        for p in split(blk, rnd, target, stop_p=0.25 if z == 'ind' else 0.1):
            px0, py0, px1, py1 = p
            al = rnd.uniform(1.5, 2.5)
            px0 += al; py0 += al; px1 -= al; py1 -= al
            w, h = px1 - px0, py1 - py0
            if w < 7 or h < 7:
                continue
            bcx, bcy = (px0 + px1) / 2, (py0 + py1) / 2
            if math.hypot(bcx, bcy) > R_MID + 30:
                continue
            near = math.hypot(bcx, bcy) < 380
            dr = dist_rect(bcx, bcy)
            r = rnd.random()
            if r < 0.07:
                continue                                               # 빈 필지·주차장
            pa = acc
            if overlaps(p):                                            # 타워 대지: 지면만(건물은 void 로)
                pa = void
                for t, s in zip(future.TOWERS, sites):
                    cleared[t['id']] += int(p[0] < s[2] and s[0] < p[2] and p[1] < s[3] and s[1] < p[3])
            L, D = max(w, h), min(w, h); ang = 0.0 if w >= h else math.pi / 2
            fp = rect_fp(bcx, bcy, w, h)
            if z == 'ind':
                if w * h > 1100 and r > 0.72 and dr > 45:
                    building(pa, rnd, 'office', rect_fp(bcx, bcy, w * 0.85, h * 0.85), rnd.randint(10, 17), near,
                             rect=(bcx, bcy, w * 0.85, h * 0.85, 0.0)); stats['office'] = stats.get('office', 0) + 1
                elif r > 0.6:
                    building(pa, rnd, 'shop' if rnd.random() < 0.4 else 'factory', fp, rnd.randint(3, 5), near, rect=(bcx, bcy, w, h, 0.0))
                elif r > 0.45:                                          # 골함석 작업동(1층 6 m, 박공)
                    walls(pa, fp, 0.0, 6.0, 'corrugated', 5.0, rnd.random())
                    gable(pa, bcx, bcy, L, D, ang, 6.0, rnd.uniform(8, 14), 'corrugated', 'roof_dark')
                    stats['shed'] = stats.get('shed', 0) + 1
                else:
                    fl = rnd.randint(2, 4)
                    building(pa, rnd, 'factory', fp, fl, near, roof='gable' if rnd.random() < 0.45 else 'flat', rect=(bcx, bcy, L, D, ang))
                    stats['factory'] = stats.get('factory', 0) + 1
            else:
                if dr < 40:
                    fl = rnd.randint(2, 5)
                elif r > 0.93 and w * h > 500:
                    fl = rnd.randint(8, 13)
                else:
                    fl = rnd.randint(3, 6)
                kind = 'shop' if (r > 0.62 or fl >= 8) else ('villa' if rnd.random() < 0.6 else 'villa_t')
                if z == 'apt2' and r > 0.9:
                    kind = 'office'; fl = rnd.randint(9, 14)
                building(pa, rnd, kind, fp, fl, near, rect=(bcx, bcy, w, h, 0.0)); stats[kind] = stats.get(kind, 0) + 1
    out = []
    for k, acc in accs.items():
        if acc.F:
            out.append(acc.to_obj(f'BD_mid_{k}', C, [M['city']], 'wall'))
    print('mid ring', stats, {k: a.tris() for k, a in accs.items()}, 'tower sites cleared', cleared, void.tris())
    return out


# ═════════════════════════════ 먼 채움(0.7 ~ 3 km) ═════════════════════════════
PARK = ((-1576.0, 278.0), 390.0)            # 서울숲(장면 방위 ~280°, 1.6 km)


def blocked_far(x, y):
    r = math.hypot(x, y)
    if RIVER[0] - 30 < y < RIVER[1] + 40:
        return True
    if math.hypot(x - PARK[0][0], y - PARK[0][1]) < PARK[1]:
        return True
    if (-58 < y < -28 or 132 < y < 174) and abs(x) < 1500:          # 뚝섬로·고가 띠
        return True
    return False


FAR_LOW_KEEP = 0.25     # 성수 2041(Task 8b 0.35 → Task 10 0.25): 모바일 삼각형 예산(0.9 M) — 먼 저층 상자 · 판상 아파트를 이 비율만 남긴다(전역 제약의
FAR_SLAB_KEEP = 0.45    # (Task 10: 0.55 → 0.45) 줄이기 순서 1: 원경 크림색 상자). 고르는 난수는 따로 써서 남는 동의 자리 · 크기는 예전과 같다


def build_far(C, M):
    rnd = random.Random(707)
    keep = random.Random(708)
    acc = Acc()
    n_low = n_slab = 0
    # 저층 지붕 바다(0.7 ~ 1.6 km): 50 m 격자, 한 칸에 낮은 상자 하나(벽 한 줄 = 묶음 띠, 지붕)
    step = 50.0
    k = int(1700 / step)
    for i in range(-k, k + 1):
        for j in range(-k, k + 1):
            x = i * step + rnd.uniform(-12, 12); y = j * step + rnd.uniform(-12, 12)
            r = math.hypot(x, y)
            if r < R_MID + 20 or r > 1650 or blocked_far(x, y) or rnd.random() < 0.18:
                continue
            w = rnd.uniform(16, 34); d = rnd.uniform(14, 28)
            fl = rnd.randint(2, 5)
            st = rnd.choice(('villa3', 'brick2', 'mixed3', 'villa3'))
            fp = rect_fp(x, y, w, d)
            h = fl * 3.0
            uo = rnd.random(); rm = rnd.choice(('roof_grey', 'roof_green', 'roof_dark'))
            if keep.random() >= FAR_LOW_KEEP:
                continue
            walls(acc, fp, 0.0, h, st, 3.6, uo)
            roof_flat(acc, fp, h, rm)
            n_low += 1
    # 판상 아파트·타워(0.7 ~ 3 km): 단지 단위로 3 ~ 6동씩
    nclus = 70
    for c in range(nclus):
        for _ in range(30):
            a = rnd.uniform(0, 2 * math.pi); r = math.sqrt(rnd.uniform((R_MID + 80) ** 2, (R_FAR - 100) ** 2))
            x, y = r * math.sin(a), r * math.cos(a)
            if not blocked_far(x, y):
                break
        ang = 0.0 if rnd.random() < 0.55 else math.radians(19.0)
        tower = rnd.random() < 0.18
        kind = rnd.choice(('apt4', 'apt4_b'))
        nb = rnd.randint(3, 6)
        for b in range(nb):
            ox = (b % 3) * 95 + rnd.uniform(-10, 10); oy = (b // 3) * 55 + rnd.uniform(-8, 8)
            bx = x + ox * math.cos(ang) - oy * math.sin(ang); by = y + ox * math.sin(ang) + oy * math.cos(ang)
            if blocked_far(bx, by):
                continue
            if tower:
                h = rnd.uniform(95, 150); s = rnd.uniform(26, 34)
                fp = rect_fp(bx, by, s, s * rnd.uniform(0.8, 1.0), ang)
                st = rnd.choice(('tower4', 'tower4_b'))
            else:
                h = rnd.uniform(40, 72)
                fp = rect_fp(bx, by, rnd.uniform(55, 85), 14.0, ang)
                st = kind
            rows = max(1, int(round(h / 11.2)))
            hh = h / rows
            uos = [rnd.random() for _ in range(rows)]
            if keep.random() >= FAR_SLAB_KEEP:
                continue
            for q in range(rows):
                walls(acc, fp, q * hh, (q + 1) * hh, st, 2.9, uos[q],
                      (lambda i, L, st=st: st if L > 20 else 'apt_end') if not tower else None)
            roof_flat(acc, fp, h, 'roof_grey')
            if h > 110:
                boxtop(acc, bx, by, 2.0, 2.0, h, 1.5, 'beacon', ang)
            n_slab += 1
    o = acc.to_obj('BD_far', C, [M['city']], 'wall')
    print('far', n_low, n_slab, acc.tris())
    return o


# ═════════════════════════════ 스카이라인 1 · 2겹 ═════════════════════════════
def polar(bearing, d):
    a = math.radians(bearing)
    return d * math.sin(a), d * math.cos(a)


def keep_angle(h, d_real, d_new):
    """눈높이 15 m 에서 본 고도각이 같도록 높이를 옮긴다."""
    return EYE + (h - EYE) * (d_new / d_real)


def tower(acc, cx, cy, h, w, d, sides=8, strip='tower4', ang=0.0, taper=0.0, round_k=0.6, crown=None, beacon=True):
    """둥근 사각 단면(초타원 sides 각) 타워. 줄 = 13.6 m(4개 층 띠 하나). taper = 꼭대기에서 줄어드는 비율."""
    rows = max(2, int(round(h / 13.6)))

    def sec(t):
        k = 1.0 - taper * t ** 1.3
        pts = []
        for i in range(sides):
            a = 2 * math.pi * (i + 0.5) / sides
            c, s = math.cos(a), math.sin(a)
            px = math.copysign(abs(c) ** round_k, c) * w / 2 * k; py = math.copysign(abs(s) ** round_k, s) * d / 2 * k
            pts.append((cx + px * math.cos(ang) - py * math.sin(ang), cy + px * math.sin(ang) + py * math.cos(ang)))
        return pts
    lo, hi = vr(strip)
    for q in range(rows):
        A = sec(q / rows); B = sec((q + 1) / rows)
        z0 = h * q / rows; z1 = h * (q + 1) / rows
        per = 0.0
        for i in range(sides):
            j = (i + 1) % sides
            L = math.dist(A[i], A[j]); u0 = per / 23.2; u1 = (per + L) / 23.2; per += L
            acc.poly([(A[i][0], A[i][1], z0), (A[j][0], A[j][1], z0), (B[j][0], B[j][1], z1), (B[i][0], B[i][1], z1)],
                     [(u0, lo), (u1, lo), (u1, hi), (u0, hi)])
    top = sec(1.0)
    roof_flat(acc, top, h, 'roof_green' if (round(cx) + round(cy)) % 2 == 0 else 'roof_grey')   # 성수 2041: 옥상 녹화 절반
    if crown:
        crown(acc, top, h)
    if beacon:
        boxtop(acc, cx, cy, 2.0, 2.0, h, 1.6, 'beacon', ang)


LAYER1 = [   # (방위°, 실제 거리 km, 높이 m, 폭, 깊이, 단면 각, 띠) — 성수 리서치 §4 의 1겹(1 ~ 1.5 km 로)
    (70.0, 1.15, 192, 30, 26, 10, 'tower4'), (72.5, 1.20, 180, 30, 26, 10, 'tower4'), (75.0, 1.25, 165, 34, 24, 8, 'tower4_b'),
    (77.0, 1.30, 155, 32, 24, 8, 'tower4_b'),                                                  # 자양동 강변 타워
    (255.0, 1.25, 200, 30, 30, 12, 'tower4'), (257.5, 1.28, 200, 30, 30, 12, 'tower4'), (260.0, 1.30, 200, 30, 30, 12, 'tower4'),
    (262.0, 1.33, 200, 30, 30, 12, 'tower4'),                                                   # 서울숲 쪽 4동
    (267.0, 1.40, 200, 32, 28, 10, 'tower4_b'), (269.5, 1.42, 200, 32, 28, 10, 'tower4_b'),    # 서울숲 쪽 2동
    (276.0, 1.60, 171, 36, 22, 8, 'tower4'), (280.0, 1.70, 171, 36, 22, 8, 'tower4'),          # 1.5 km 로 당김
]
LAYER2 = [   # 2겹(2.5 ~ 3 km 로 당김, 고도각 유지)
    (157.0, 2.3, 176, 2.5, 'tower4_b'), (158.5, 2.6, 190, 2.6, 'tower4'), (160.0, 2.9, 200, 2.75, 'tower4_b'), (161.0, 3.2, 228, 2.9, 'tower4'),
    (95.0, 3.3, 189, 2.9, 'tower4'),                                                           # 테크노마트
    (184.0, 5.5, 234, 2.9, 'tower4_b'), (185.0, 5.5, 220, 2.95, 'tower4_b'), (186.0, 5.5, 210, 2.9, 'tower4_b'),   # 도곡
    (323.0, 4.6, 199, 2.7, 'tower4'), (325.0, 4.6, 192, 2.72, 'tower4'), (326.5, 4.6, 180, 2.7, 'tower4_b'), (328.0, 4.6, 150, 2.68, 'tower4'),
]


def lotte_crown(acc, top, h):
    """롯데월드타워 꼭대기: 좁아지며 두 갈래로 갈라지는 쐐기(실루엣)."""
    cx = sum(p[0] for p in top) / len(top); cy = sum(p[1] for p in top) / len(top)
    lo, hi = vr('tower4_b')
    for sgn in (-1, 1):
        a = [(cx + (p[0] - cx), cy + (p[1] - cy), h) for p in top]
        b = [(cx + (p[0] - cx) * 0.35 + sgn * 2.2, cy + (p[1] - cy) * 0.35, h + 22.0) for p in top]
        n = len(top)
        for i in range(n):
            j = (i + 1) % n
            acc.poly([a[i], a[j], b[j], b[i]], [(i / n, lo), ((i + 1) / n, lo), ((i + 1) / n, hi), (i / n, hi)])
        acc.poly(b, [(0.5, (lo + hi) / 2)] * n)


def build_layers(C, M):
    a1 = Acc(); a2 = Acc(); al = Acc(); an = Acc()
    for brg, dkm, h, w, d, sides, st in LAYER1:
        dn = min(dkm * 1000.0, 1500.0)
        hh = keep_angle(h, dkm * 1000.0, dn)
        x, y = polar(brg, dn)
        tower(a1, x, y, hh, w, d, sides, st, ang=math.radians(-brg + 90), taper=0.05)
    for brg, dkm, h, dn, st in LAYER2:
        hh = keep_angle(h, dkm * 1000.0, dn * 1000.0)
        x, y = polar(brg, dn * 1000.0)
        tower(a2, x, y, hh, 34, 30, 10, st, ang=math.radians(-brg + 90), taper=0.08)
    # 롯데월드타워: 107°, 4.8 km → 2.8 km, 555 m → 고도각 유지 높이. 둥근 정사각 단면이 위로 가늘어진다
    dn = 2800.0; hh = keep_angle(555.0, 4800.0, dn)
    x, y = polar(107.0, dn)
    tower(al, x, y, hh - 22.0, 44, 44, 16, 'tower4_b', ang=math.radians(-17), taper=0.58, round_k=0.45, crown=lotte_crown, beacon=False)
    boxtop(al, x, y, 1.6, 1.6, hh, 1.4, 'beacon')
    print('lotte', round(hh, 1), 'm at', (round(x), round(y)))
    o = [a1.to_obj('BD_layer1', C, [M['city']], 'wall'), a2.to_obj('BD_layer2', C, [M['city']], 'wall'),
         al.to_obj('BD_lotte', C, [M['city']], 'wall')]
    for ob in o:
        ob['nw_layer_ring'] = {'BD_layer1': 1, 'BD_layer2': 2, 'BD_lotte': 2}[ob.name]
    o[2]['nw_landmark'] = '롯데월드타워(실루엣)'
    return o


# ═════════════════════════════ 능선 4겹 ═════════════════════════════
RIDGES = {   # 겹: (반경 m, [(방위°, 실제 높이 m, 실제 거리 km, 반폭°, 바위 0..1)], 바탕 높이(빈 곳), 이름)
    1: (4000.0, [(23.0, 348, 4.9, 10.5, 0.1), (32.0, 296, 5.0, 9.5, 0.1), (12.0, 185, 4.2, 8.5, 0.0), (42.0, 220, 5.2, 8.0, 0.0),
                 (147.0, 293, 7.0, 9.0, 0.0), (160.0, 306, 8.0, 10.0, 0.0), (336.0, 175, 4.2, 12.0, 0.0), (352.0, 155, 4.2, 10.0, 0.0),
                 (266.0, 95, 2.8, 5.5, 0.0), (295.0, 130, 3.8, 10.0, 0.0), (315.0, 145, 4.0, 11.0, 0.0)],
        0.0, '용마산·아차산 / 대모산·구룡산 / 북쪽 낮은 구릉 / 응봉산'),
    2: (4900.0, [(265.0, 262, 6.5, 11.0, 0.0), (252.0, 165, 6.5, 9.0, 0.0), (282.0, 338, 8.5, 9.5, 0.3), (291.0, 342, 8.5, 8.5, 0.2),
                 (200.0, 632, 13.0, 11.0, 0.6), (209.0, 520, 13.0, 9.0, 0.4), (167.0, 618, 13.0, 11.0, 0.2),
                 (235.0, 200, 8.0, 12.0, 0.0), (320.0, 260, 7.5, 14.0, 0.1), (342.0, 230, 7.5, 12.0, 0.1)],
        0.0, '남산(N서울타워) / 인왕산·북악산 / 관악산 / 청계산'),
    3: (5600.0, [(313.0, 836, 15.0, 8.5, 1.0), (305.0, 710, 15.0, 9.5, 0.8), (318.0, 760, 15.0, 7.5, 1.0), (324.0, 580, 16.0, 8.0, 0.6),
                 (329.0, 740, 18.0, 8.5, 0.9), (338.0, 490, 17.5, 9.0, 0.4), (347.0, 638, 18.0, 9.0, 0.5), (354.0, 508, 14.0, 8.0, 0.6),
                 (296.0, 520, 15.0, 9.5, 0.3), (286.0, 390, 14.5, 9.0, 0.2), (4.0, 360, 14.0, 9.0, 0.2)],
        0.0, '북한산 / 도봉산 / 수락산 / 불암산'),
    4: (6000.0, [], 1.0, '먼 낮은 능선(360°, 원판 끝을 가린다)'),
}


def ridge_height(layer, brg):
    R, peaks, base, _ = RIDGES[layer]
    h = 0.0; rock = 0.0
    # 겹마다 두 봉우리 이상이 겹칠 때 안부(고개)가 자연스럽게 이어지도록 부드러운 합산(soft-max)을 섞는다
    accum = 0.0
    for b0, hr, dkm, wdeg, rk in peaks:
        db = (brg - b0 + 540.0) % 360.0 - 180.0
        if abs(db) > wdeg * 2.5:
            continue
        top = keep_angle(hr, dkm * 1000.0, R)
        t = abs(db) / wdeg
        prof = math.exp(-t * t * 1.15)
        hh = top * prof
        accum += hh ** 2.2
        if hh > h:
            h = hh; rock = rk * prof
    if accum > 0.0:
        h = max(h, (accum ** (1.0 / 2.2)) * 0.88)
    if base:
        h = max(h, 95.0 + 55.0 * (0.5 + 0.5 * n2(brg * 0.9, 3.1, 0.05, 11.0, 3)) + 25.0 * n2(brg, 7.7, 0.4, 3.0, 2))
    if h > 0:
        jag = 0.08 + 0.10 * rock
        h *= 1.0 + jag * n2(brg * 4.2, layer * 13.0, 0.35, 5.0 + layer, 3) + 0.04 * n2(brg * 11.0, layer * 29.0, 0.5, 9.0 + layer, 2)
    return h, rock


def build_ridges(C, M):
    out = []
    for layer, (R, peaks, base, title) in RIDGES.items():
        acc = Acc()
        step = 0.25 if layer < 4 else 0.4
        n = int(round(360.0 / step))
        prev = None
        for i in range(n + 1):
            brg = i * step
            h, rock = ridge_height(layer, brg)
            col = None
            if h > 6.0:
                vtop = 0.95 if rock > 0.25 else 0.45 + 0.1 * rock
                rows = [(R - max(250.0, h * 4.0), -6.0, 0.02), (R - h * 1.5, h * 0.62, vtop * 0.55), (R, h, vtop),
                        (R + max(200.0, h * 2.5), -6.0, 0.05)]
                col = [(polar(brg, r)[0], polar(brg, r)[1], z, v) for r, z, v in rows]
            if col is not None and prev is not None:
                u0 = (brg - step) / 3.0; u1 = brg / 3.0
                for k in range(3):
                    a, b, c, d = prev[k], col[k], col[k + 1], prev[k + 1]
                    acc.poly([a[:3], b[:3], c[:3], d[:3]], [(u0, a[3]), (u1, b[3]), (u1, c[3]), (u0, d[3])])
            prev = col
        if acc.F:
            o = acc.to_obj(f'BD_ridge_{layer}', C, [M['ridge']], 'foliage', mask=lambda co: (0.0, 0.1, 1.0), smooth=True)
            o['nw_layer_ring'] = 2 + layer if layer < 4 else 6
            o['nw_title'] = title
            o['nw_radius_m'] = R
            out.append(o)
            print('ridge', layer, acc.tris())
    return out


def build_namsan_tower(C, M):
    """N서울타워(실루엣): 남산(겹 2, 265°) 꼭대기 위. 실제 6.5 km → 4.9 km, 고도각 유지(꼭대기 해발 479 m)."""
    R = RIDGES[2][0]
    best = max((ridge_height(2, 265.0 + d * 0.25)[0], 265.0 + d * 0.25) for d in range(-8, 9))
    hz, brg = best
    x, y = polar(brg, R)
    top = keep_angle(479.0, 6500.0, R)
    acc = Acc()
    H = top - hz
    shaft = H * 0.52; pod0 = shaft; pod1 = shaft + H * 0.07
    z0 = hz - 8.0
    A = Acc()
    lo, hi = vr('concrete')

    def cyl(z_a, z_b, r_a, r_b, n=12, st='concrete'):
        l, h2 = vr(st)
        for i in range(n):
            a0 = 2 * math.pi * i / n; a1 = 2 * math.pi * (i + 1) / n
            acc.poly([(x + r_a * math.cos(a0), y + r_a * math.sin(a0), z_a), (x + r_a * math.cos(a1), y + r_a * math.sin(a1), z_a),
                      (x + r_b * math.cos(a1), y + r_b * math.sin(a1), z_b), (x + r_b * math.cos(a0), y + r_b * math.sin(a0), z_b)],
                     [(i / n, l), ((i + 1) / n, l), ((i + 1) / n, h2), (i / n, h2)])
    cyl(z0, hz + shaft, 6.0, 4.2)
    cyl(hz + pod0, hz + pod0 + 3.0, 4.2, 9.5, 14, 'concrete')
    cyl(hz + pod0 + 3.0, hz + pod1, 9.5, 9.0, 14, 'tower4')
    cyl(hz + pod1, hz + pod1 + 4.0, 9.0, 3.0, 14, 'concrete')
    cyl(hz + pod1 + 4.0, top - 2.0, 1.6, 0.5, 8, 'concrete')
    cyl(top - 2.0, top, 0.6, 0.6, 6, 'beacon')
    o = acc.to_obj('BD_namsan_tower', C, [M['city']], 'wall')
    o['nw_landmark'] = 'N서울타워(실루엣, 남산)'; o['nw_layer_ring'] = 4
    print('namsan tower base', round(hz, 1), 'top', round(top, 1), 'brg', brg)
    return o


def build_park(C, M):
    """서울숲 수관(겹 1 근처, 낮고 울퉁불퉁한 원판) — 부감에서 공원으로 읽힌다."""
    (cx, cy), R = PARK
    acc = Acc()
    nr, na = 6, 48
    rings = []
    for i in range(nr + 1):
        r = R * i / nr
        ring = []
        for j in range(na):
            a = 2 * math.pi * j / na
            rr = r * (1.0 + 0.12 * n2(math.cos(a) * 3, math.sin(a) * 3, 1.0, 2.0, 2))
            x, y = cx + rr * math.cos(a), cy + rr * math.sin(a)
            z = (14.0 + 6.0 * n2(x, y, 0.02, 4.0, 2)) * smoothstep(1.0, 0.75, i / nr) - 1.0
            ring.append((x, y, z, 0.12 + 0.25 * (z / 20.0)))
        rings.append(ring)
    for i in range(nr):
        for j in range(na):
            k = (j + 1) % na
            a, b, c, d = rings[i][j], rings[i][k], rings[i + 1][k], rings[i + 1][j]
            acc.poly([a[:3], b[:3], c[:3], d[:3]], [(j / 8, a[3]), ((j + 1) / 8, b[3]), ((j + 1) / 8, c[3]), (j / 8, d[3])])
    o = acc.to_obj('BD_park', C, [M['ridge']], 'foliage', mask=lambda co: (0.0, 0.2, 0.9), smooth=True)
    o['nw_title'] = '서울숲(수관 실루엣)'
    return o


# ═════════════════════════════ 지면 · 도로 · 강 · 인프라 ═════════════════════════════
def road_rects():
    out = []
    for ax, c, hw, rmax, kind in ROADS:
        if ax == 'y':
            r = (-rmax, c - hw, rmax, c + hw)
        else:
            r = (c - hw, -rmax, c + hw, rmax)
        if ax == 'x' and kind is None and c - hw > RECT[0] and c + hw < RECT[2]:
            r = (r[0], RECT[3], r[2], rmax)                     # 장면 안을 지나는 남북 길은 장면 북쪽으로만
            if c in (-105.0, 70.0):
                r = (r[0], RECT[3], r[2], 250.0)
        if ax == 'y' and c < RIVER[1]:
            continue
        for q in rect_minus(r, RECT):
            # 원판 안으로 자른다(대략: 끝 반경)
            out.append((q, kind, ax))
    return out


def build_ground(C, M):
    # 지면: 원판 − 장면 사각형 − 도로 − 강
    rr = road_rects()
    holes = [RECT] + [q for q, k, ax in rr] + [(-R_DISC, RIVER[0], R_DISC, RIVER[1])]

    def inside(x, y):
        if math.hypot(x, y) > R_DISC:
            return False
        for h in holes:
            if h[0] < x < h[2] and h[1] < y < h[3]:
                return False
        return True
    outer = lib.poly_circle(0.0, 0.0, R_DISC, 192)
    loops = [outer]
    for h in holes:
        x0, y0, x1, y1 = max(h[0], -R_DISC), max(h[1], -R_DISC), min(h[2], R_DISC), min(h[3], R_DISC)
        loops.append([(x0, y0), (x1, y0), (x1, y1), (x0, y1)])
    pts = []
    for r in (180, 300, 450, 650, 900, 1300, 1800, 2500, 3300, 4200, 5200):
        n = max(24, int(2 * math.pi * r / max(60.0, r * 0.08)))
        pts.extend(lib.poly_circle(0.0, 0.0, r, n))
    V2, T = lib.cdt(loops, [p for p in pts if inside(*p)], inside, eps=1e-3)
    acc = Acc()
    for f in T:
        acc.poly([(V2[i][0], V2[i][1], 0.0) for i in f], [(V2[i][0], V2[i][1]) for i in f])
    o = acc.to_obj('BD_ground', C, [M['ground']], 'ground', mask=lambda co: (0.0, 0.3, 0.9))
    # 도로(장면 가장자리 노면 높이 −0.12 근처, 장면 쪽 끝은 같은 높이)
    ra = Acc(); ma = Acc()
    for (x0, y0, x1, y1), kind, ax in rr:
        z = -0.12
        ra.poly([(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], [(x0, y0), (x1, y0), (x1, y1), (x0, y1)])
        if kind == 'tt':                                       # 황색 이중 중앙선 + 백색 점선(3 m 칠 / 5 m 빈칸)
            import future                                      # 성수 2041(Task 10): 태양광 띠(future.PV_X)가 덮는 구간은 중앙선을 빼고 띠 밖만
            for xa, xb in ((x0, min(x1, future.PV_X[0])), (max(x0, future.PV_X[1]), x1)):
                if xb - xa < 1.0:
                    continue
                for yc, cell in ((-41.8, 0.75), (-42.2, 0.75)):
                    ma.poly([(xa, yc - 0.075, z + 0.01), (xb, yc - 0.075, z + 0.01), (xb, yc + 0.075, z + 0.01), (xa, yc + 0.075, z + 0.01)],
                            [(cell, 0.5)] * 4)
            for yc in (-38.75, -45.25):
                x = x0 + 1.0
                while x + 3.0 < x1:
                    ma.poly([(x, yc - 0.075, z + 0.01), (x + 3.0, yc - 0.075, z + 0.01), (x + 3.0, yc + 0.075, z + 0.01), (x, yc + 0.075, z + 0.01)],
                            [(0.25, 0.5)] * 4)
                    x += 8.0
        elif kind == 'via':
            for yc in (142.3, 142.7):
                ma.poly([(x0, yc - 0.06, z + 0.01), (x1, yc - 0.06, z + 0.01), (x1, yc + 0.06, z + 0.01), (x0, yc + 0.06, z + 0.01)],
                        [(0.75, 0.5)] * 4)
    o2 = ra.to_obj('BD_roads', C, [M['ground']], 'ground', mask=lambda co: (0.0, 0.85, 0.95))
    o3 = ma.to_obj('BD_marks', C, [M['paint']], 'ground', mask=lambda co: (0.0, 0.7, 1.0))
    # 한강
    wa = Acc()
    wa.poly([(-R_DISC, RIVER[0], -1.4), (R_DISC, RIVER[0], -1.4), (R_DISC, RIVER[1], -1.4), (-R_DISC, RIVER[1], -1.4)],
            [(0, 0), (1, 0), (1, 1), (0, 1)])
    o4 = wa.to_obj('BD_river', C, [M['water']], 'water', mask=lambda co: (0.0, 1.0, 1.0))
    print('ground', acc.tris(), 'roads', ra.tris(), 'marks', ma.tris())
    return [o, o2, o3, o4]


def build_infra(C, M):
    """2호선 고가 연장(present 의 끝 −131.2 / 176.8 에서 VIA_EXT 까지)과 강변북로 고가. 실루엣 수준."""
    import future
    acc = Acc()
    y0, y1 = 149.3, 160.7
    for xa, xb in ((VIA_EXT[0], -131.2), (176.8, VIA_EXT[1])):
        fp = [(xa, y0), (xb, y0), (xb, y1), (xa, y1)]
        walls(acc, fp, 7.9, 9.3, 'concrete', 3.0, 0.0)
        lo, hi = vr('concrete')
        acc.poly([(xa, y0, 7.9), (xa, y1, 7.9), (xb, y1, 7.9), (xb, y0, 7.9)], [(0, lo), (0.2, lo), (0.2, hi), (0, hi)])
        roof_flat(acc, fp, 9.3, 'roof_dark')
        # 방음벽 패널: 장면 층 튜브 구간(future.TUBE_SPANS, Task 9)에서는 그 자리에 튜브 바깥 화단(y 149.2 … 150.3 · 159.7 … 160.8)이 놓여 뺀다
        ba, bb = (xa, future.TUBE_SPANS[0][0]) if xb < 0 else (future.TUBE_SPANS[-1][1], xb)
        for yy in (y0, y1 - 0.3):
            walls(acc, [(ba, yy), (bb, yy), (bb, yy + 0.3), (ba, yy + 0.3)], 9.3, 11.2, 'corrugated', 2.0, 0.3)
        k0 = math.ceil((xa + 130.0) / 22.0); k1 = math.floor((xb + 130.0) / 22.0)
        for k in range(k0, k1 + 1):
            px = -130.0 + 22.0 * k
            if -131.2 <= px <= 176.8:
                continue
            fpp = rect_fp(px, (y0 + y1) / 2, 2.4, 10.0)
            walls(acc, fpp, 0.0, 7.9, 'concrete', 3.0, 0.0)
            if k % 2 == 0:                                          # 벽돌 충전벽(셔터) — 교각 사이 절반
                inf = [(px + 1.2, y0 + 0.6), (px + 20.8, y0 + 0.6), (px + 20.8, y0 + 0.9), (px + 1.2, y0 + 0.9)]
                walls(acc, inf, 0.0, 7.9, 'brick_gf', 5.0, 0.0)
    # 강변북로(y −322 … −300, 상판 9 ~ 10.6 m, 교각 35 m)
    xa, xb = -1500.0, 1500.0
    fp = [(xa, -322.0), (xb, -322.0), (xb, -300.0), (xa, -300.0)]
    walls(acc, fp, 9.0, 10.6, 'concrete', 3.0, 0.0)
    lo, hi = vr('concrete')
    acc.poly([(xa, -322.0, 9.0), (xa, -300.0, 9.0), (xb, -300.0, 9.0), (xb, -322.0, 9.0)], [(0, lo), (0.2, lo), (0.2, hi), (0, hi)])
    roof_flat(acc, fp, 10.6, 'roof_dark')
    x = xa
    while x <= xb:
        walls(acc, rect_fp(x, -311.0, 2.0, 8.0), 0.0, 9.0, 'concrete', 3.0, 0.0)
        x += 35.0
    o = acc.to_obj('BD_infra', C, [M['city']], 'wall')
    print('infra', acc.tris())
    # 2호선 유리 튜브 외피(Task 7): 장면 층 튜브(future.TUBE_SPANS) 바깥을 같은 단면으로 VIA_EXT 끝까지. 리브 · 끝 마개 없음
    out = [o]
    for nm, xa, xb in (('BD_tube_w', VIA_EXT[0], future.TUBE_SPANS[0][0]), ('BD_tube_e', future.TUBE_SPANS[-1][1], VIA_EXT[1])):
        ta = Acc(); P = future.TUBE_PROFILE; sv = 0.0
        for (ya, za), (yb, zb) in zip(P, P[1:]):                    # 남쪽 아래 → 꼭대기 → 북쪽 아래(법선 바깥)
            sl = math.hypot(yb - ya, zb - za); ya += future.TUBE_Y; yb += future.TUBE_Y
            ta.poly([(xa, ya, za), (xb, ya, za), (xb, yb, zb), (xa, yb, zb)],
                    [(xa / 20.0, sv), (xb / 20.0, sv), (xb / 20.0, sv + sl), (xa / 20.0, sv + sl)])
            sv += sl
        t = ta.to_obj(nm, C, [M['tube']], 'glass')
        print('tube', nm, round(xb - xa, 1), 'm', ta.tris())
        out.append(t)
    return out


# ═════════════════════════════ 조립 ═════════════════════════════
def clear_backdrop(sc):
    C = lib.coll('NW_backdrop', sc)
    for o in list(C.all_objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for me in [me for me in bpy.data.meshes if me.get(TAG) and me.users == 0]:
        bpy.data.meshes.remove(me)
    return C


def build():
    import time
    t0 = time.time()
    sc = lib.get_scene(True)
    if bpy.data.objects.get('GR_road') is None:
        import ground
        importlib.reload(ground)
        ground.build()
    C = clear_backdrop(sc)
    M = materials()
    print('materials', round(time.time() - t0, 1))
    build_ground(C, M)
    build_mid(C, M)
    build_far(C, M)
    build_layers(C, M)
    build_ridges(C, M)
    build_namsan_tower(C, M)
    build_park(C, M)
    build_infra(C, M)
    # 안개·먼 클립: 원경 링(≤ 6 km)을 덮도록(ground.py·present.py 를 다시 돌린 뒤에도 이 스크립트가 맞춘다)
    lib.setup_render(sc)
    lib.setup_fog(sc, lib.coll('NW_fx', sc))
    lib.set_far_clip(sc)
    set_aerial(sc)
    for m in [m for m in bpy.data.materials if m.get(TAG) and m.users == 0]:
        bpy.data.materials.remove(m)
    for im in [im for im in bpy.data.images if im.get(TAG) and im.users == 0]:
        bpy.data.images.remove(im)
    r = report()
    print('done', round(time.time() - t0, 1))
    return r


# CAM_aerial(Task 2 정의를 Task 4 가 바꾼다): 남동쪽 높은 곳에서 북서 — 블록·고가·스카이라인(청량리·북한산·서울숲)과 수평선
CAM_AERIAL = ((148.0, -138.0, 92.0), (-18.0, 68.0, 26.0), 24.0)


def set_aerial(sc):
    cam = bpy.data.objects.get('CAM_aerial')
    if cam is None:
        return None
    loc, tgt, lens = CAM_AERIAL
    cam.location = loc
    cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = lens
    cam['target'] = list(tgt)
    cam['nw_changed_by'] = 'Task 4 backdrop.py (원경 링이 보이는 높은 부감)'
    return cam


def report():
    C = bpy.data.collections['NW_backdrop']
    objs = [o for o in C.all_objects if o.type == 'MESH']
    pairs = set(); tri_total = 0; per = {}
    for o in objs:
        me = o.data
        t = sum(len(p.vertices) - 2 for p in me.polygons)
        tri_total += t; per[o.name] = t
        for i in {p.material_index for p in me.polygons}:
            m = me.materials[i] if i < len(me.materials) else None
            pairs.add((me.name, m.name if m else None))
    out = {'objects': len(objs), 'pairs': len(pairs), 'tris': tri_total,
           'materials': sorted({p[1] for p in pairs if p[1]})}
    print('NW_backdrop', out)
    print('per object', sorted(per.items(), key=lambda kv: -kv[1]))
    return out


if __name__ == '__main__':
    build()
