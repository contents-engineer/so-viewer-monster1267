# HAUS NOWHERE — DS2 산악 월드 / Task 1: 초록 이끼 & 현무암 대산맥 원경 (NW_backdrop, 반경 6.2 km).
# 실행: 헤드리스 blender -b --factory-startup --python tools/nowhere/blender/ds2_backdrop.py
import bpy, bmesh, os, sys, math, random, importlib, json, time
from mathutils import Vector, Matrix

ROOT = os.environ.get('NW_ROOT', '/Users/gm_yeonho/new-work/so/so-viewer-monster1267')
sys.dont_write_bytecode = True
_HERE = os.path.join(ROOT, 'tools', 'nowhere', 'blender')
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)
import lib
importlib.reload(lib)
import ds2_ground as ground
importlib.reload(ground)
from lib import srgb, smoothstep, clamp01, n2

import numpy as np

GEN = os.path.join(lib.OUT, 'gen')
TAG = 'nw_backdrop_src'
RECT = lib.MASK_RECT    # (-112.0, -162.0, 162.0, 172.0)
R_DISC = 6200.0
EYE = 15.0


def _hx(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)], np.float32)


def _noise(rng, h, w, amp, cell=4):
    a = rng.standard_normal((h // cell + 2, w // cell + 2)).astype(np.float32)
    a = np.repeat(np.repeat(a, cell, 0), cell, 1)[:h, :w]
    return 1.0 + amp * a


# ═════════════════════════════ 1) DS2 산악 암벽·이끼·비콘 아틀라스 & 능선 텍스처 ═════════════════════════════
def paint_ds2_crag_atlas():
    """중경 주상절리 암봉·단애·원경 중계탑용 512×512 아틀라스 (낮 알베도 + 밤 비콘 발광).
    행 구간(v):
      0.00..0.38 : 짙은 올리브 이끼가 덮인 하부 사면 (#2F3B18 ~ #4A5724)
      0.38..0.90 : 어두운 주상절리 현무암 암벽과 불규칙 이끼 패치 (#21282A ~ #373D39)
      0.92..1.00 : 카이랄 중계탑 금속 몸체 & 청록/주황 비콘 발광 (밤에도 점등)
    """
    H, W = 512, 512
    rng = np.random.default_rng(2042)
    alb = np.zeros((H, W, 3), np.float32)
    emi = np.zeros((H, W, 3), np.float32)

    moss_dark = _hx('#2D3917')
    moss_mid = _hx('#435121')
    rock_wet = _hx('#1F2628')
    rock_dry = _hx('#323836')
    rock_edge = _hx('#484E4A')

    y_grid = np.linspace(0.0, 1.0, H, dtype=np.float32)[:, None]
    x_grid = np.linspace(0.0, 1.0, W, dtype=np.float32)[None, :]

    n_coarse = _noise(rng, H, W, 0.24, 16) - 1.0
    n_med = _noise(rng, H, W, 0.18, 4) - 1.0
    n_fine = _noise(rng, H, W, 0.10, 2) - 1.0

    for y in range(int(H * 0.92)):
        vf = y / H
        # 불규칙한 이끼 침투 경계
        moss_weight = np.clip((0.46 - vf + 0.22 * n_coarse[y] + 0.10 * n_med[y]) * 3.2, 0.0, 1.0)[:, None]
        rk = rock_wet * (1.0 - vf * 0.65) + rock_dry * (vf * 0.65)
        rk = rk + rock_edge * np.clip(n_med[y, :, None] * 0.8, 0.0, 0.35)
        ms = moss_dark * (1.0 - vf) + moss_mid * vf
        alb[y] = rk * (1.0 - moss_weight) + ms * moss_weight

    # 세로 주상절리 균열 음영
    col_ribs = 0.86 + 0.16 * np.sin(x_grid * 48.0 * math.pi + n_coarse * 2.2)
    alb[:int(H * 0.92)] *= col_ribs[:int(H * 0.92), :, None] * (1.0 + n_fine[:int(H * 0.92), :, None])

    # 0.92..1.00: 중계탑 몸체(0.92..0.96) + 비콘 발광(0.96..1.00)
    y0 = int(H * 0.92)
    y1 = int(H * 0.96)
    alb[y0:y1] = _hx('#2D3338')
    alb[y1:] = _hx('#53C8D9')
    emi[y1:, :W // 2] = _hx('#53C8D9') * 1.4
    emi[y1:, W // 2:] = _hx('#3E8AD0') * 1.4

    out_a = np.ones((H, W, 4), np.float32)
    out_a[..., :3] = np.clip(alb, 0.0, 1.0)
    out_e = np.ones((H, W, 4), np.float32)
    out_e[..., :3] = np.clip(emi, 0.0, 1.0)
    im_a = lib.save_image('NWB_gen_ds2_crag', out_a, os.path.join(GEN, 'NWB_gen_ds2_crag.png'), TAG)
    im_e = lib.save_image('NWB_gen_ds2_crag_night', out_e, os.path.join(GEN, 'NWB_gen_ds2_crag_night.png'), TAG)
    return im_a, im_e


def paint_ds2_ridge():
    """원경 4겹 산악 능선 텍스처 (512×256):
    하단(v=0..0.45)은 짙은 올리브-초록 이끼 사면(#38451D ~ #4F5D2B),
    중단(v=0.45..0.82)은 어두운 현무암·화산암 암릉(#2D3436 ~ #484C46),
    상단(v=0.82..1.0)은 고산 층리 암반과 만년설/서리 자국(#7D8482 ~ #B8C2C4).
    """
    H, W = 256, 512
    rng = np.random.default_rng(99)
    v = np.linspace(0.0, 1.0, H, dtype=np.float32)[:, None]
    u = np.linspace(0.0, 1.0, W, dtype=np.float32)[None, :]

    moss_lo = _hx('#33401A')
    moss_hi = _hx('#4E5C29')
    basalt = _hx('#2C3335')
    strata = _hx('#565B54')
    summit = _hx('#9DA6A8')

    jag = 0.08 * np.sin(u * 38.0) + 0.05 * np.cos(u * 91.0)
    vv = np.clip(v + jag, 0.0, 1.0)

    col = np.zeros((H, W, 3), np.float32)
    for y in range(H):
        for x in range(W):
            t = vv[y, x]
            if t < 0.48:
                k = t / 0.48
                c = moss_lo * (1.0 - k) + moss_hi * k
            elif t < 0.82:
                k = (t - 0.48) / 0.34
                c = moss_hi * (1.0 - k) + (basalt * 0.65 + strata * 0.35) * k
            else:
                k = (t - 0.82) / 0.18
                c = basalt * (1.0 - k * 0.65) + summit * (k * 0.65)
            col[y, x] = c

    col *= _noise(rng, H, W, 0.09, 2)[..., None]
    out = np.ones((H, W, 4), np.float32)
    out[..., :3] = np.clip(col, 0.0, 1.0)
    return lib.save_image('NWB_gen_ds2_ridge', out, os.path.join(GEN, 'NWB_gen_ds2_ridge.png'), TAG)


# ═════════════════════════════ 2) 재질 조립 ═════════════════════════════
def _guard(name):
    if not name.startswith('NWB_'):
        raise ValueError(f'backdrop 재질 이름은 NWB_ 로 시작해야 한다: {name}')
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


def materials():
    ia, ie = paint_ds2_crag_atlas()
    ir = paint_ds2_ridge()

    # 1) 빙하 계곡 암벽·바닥: 회색 층리 암반(dark_rock_02, 웹으로 나가는 첫 텍스처) + 지의류 암반(lichen_rock) 합성.
    #    초록은 정점 마스크 R(선반·완사면 이끼)이 얹는다 — 참조 화면의 "회색 단애 + 초록 선반".
    M_gnd = lib.Mat(_guard('NWB_ground')); b_g = M_gnd.b
    t = M_gnd.texset('dark_rock_02', M_gnd.uv(9.5))
    t2 = M_gnd.texset('lichen_rock', M_gnd.uv(7.5, offset=(0.25, 0.65)))
    P = M_gnd.pos
    # 원본 평균 선형 알베도 ≈0.036(dark_rock_02)·0.05(lichen_rock) → 참조 화면의 중간 회색 암반(≈0.10)으로 끌어올린다
    soil = M_gnd.grade(t['color'], 0.30, srgb('#F0F2F1'), 3.2)
    basalt = M_gnd.grade(t2['color'], 0.35, srgb('#E6EAE8'), 2.9)
    pm = b_g.mul(b_g.smooth(0.45, 0.68, b_g.noise(P, 0.045, 4.0, 0.6, dist=0.35)), 0.85)
    col_g = b_g.col(pm, soil, basalt)
    rgh_g = b_g.flt(pm, t['rough'], t2['rough'])
    hgt_g = b_g.flt(pm, t['height'], t2['height'])
    nrm_g = b_g.mix('VECTOR', pm, t['normal'], t2['normal'])
    col_g = M_gnd.macro_var(col_g, 0.08, 0.06)
    mk_g = M_gnd.mask(base_wet=0.35, moss_bias=0.25, puddle_bias=-1.0)
    s_g = M_gnd.surface(col_g, rgh_g, nrm_g, hgt_g, mk_g, crevice_moss=2.8, crevice_puddle=0.2, porosity=0.55, wet_gloss=0.22)
    m_ground = M_gnd.finish(s_g.outputs['Color'], s_g.outputs['Roughness'], s_g.outputs['Normal'], spec=0.38)
    m_ground[TAG] = 1
    m_ground['nw_surface'] = 'rock'

    # 2) 중경 주상절리 암봉·단애·원경 중계탑 재질 (NWB_city 슬롯 이름 유지로 호환성 확보하되 DS2 암봉 아틀라스 연결)
    m_crag = _new_mat('NWB_city')
    b = lib.NB(m_crag.node_tree)
    out = b.node('ShaderNodeOutputMaterial')
    bs = b.node('ShaderNodeBsdfPrincipled')
    b.L.new(bs.outputs[0], out.inputs['Surface'])
    uv = b.node('ShaderNodeUVMap', uv_map='UVMap')
    ta = b.node('ShaderNodeTexImage')
    ta.image = ia
    ta.interpolation = 'Linear'
    b.L.new(uv.outputs['UV'], ta.inputs['Vector'])
    te = b.node('ShaderNodeTexImage')
    te.image = ie
    te.interpolation = 'Linear'
    b.L.new(uv.outputs['UV'], te.inputs['Vector'])
    b.L.new(ta.outputs['Color'], bs.inputs['Base Color'])
    b.L.new(te.outputs['Color'], bs.inputs['Emission Color'])
    b.put(bs.inputs['Emission Strength'], lib.emit_strength(b, 0.25, 3.5))
    bs.inputs['Roughness'].default_value = 0.78
    m_crag['nw_surface'] = 'rock'
    m_crag['nw_tex'] = json.dumps({'kind': 'atlas', 'albedo': ia.name, 'emissive': ie.name}, ensure_ascii=False)
    lib.emit_meta(m_crag, None, ie.name, 0.25, 3.5)

    # 3) 4겹 대산맥 능선 재질
    m_ridge = _new_mat('NWB_ridge')
    b = lib.NB(m_ridge.node_tree)
    out = b.node('ShaderNodeOutputMaterial')
    bs = b.node('ShaderNodeBsdfPrincipled')
    b.L.new(bs.outputs[0], out.inputs['Surface'])
    uv = b.node('ShaderNodeUVMap', uv_map='UVMap')
    t = b.node('ShaderNodeTexImage')
    t.image = ir
    t.extension = 'EXTEND'
    b.L.new(uv.outputs['UV'], t.inputs['Vector'])
    b.L.new(t.outputs['Color'], bs.inputs['Base Color'])
    bs.inputs['Roughness'].default_value = 0.92
    m_ridge['nw_surface'] = 'rock'
    m_ridge['nw_tex'] = json.dumps({'kind': 'gen', 'albedo': ir.name}, ensure_ascii=False)

    # 4) 원경 개울 수면 & 실폭포(waterfall) 재질
    m_water = _new_mat('NWB_water')
    b = lib.NB(m_water.node_tree)
    out = b.node('ShaderNodeOutputMaterial')
    bs = b.node('ShaderNodeBsdfPrincipled')
    b.L.new(bs.outputs[0], out.inputs['Surface'])
    bs.inputs['Base Color'].default_value = srgb('#1B2427')
    bs.inputs['Roughness'].default_value = 0.06
    m_water['nw_surface'] = 'water'
    m_water['nw_tex'] = json.dumps({'kind': 'flat', 'color': '#1B2427', 'rough': 0.06}, ensure_ascii=False)

    return {'ground': m_ground, 'crag': m_crag, 'ridge': m_ridge, 'water': m_water}


# ═════════════════════════════ 메시 누적기 ═════════════════════════════
class Acc:
    def __init__(self):
        self.V = []
        self.F = []
        self.UV = []
        self.FM = []

    def poly(self, pts, uvs, mat=0):
        b = len(self.V)
        self.V.extend(tuple(p) for p in pts)
        self.F.append(list(range(b, b + len(pts))))
        self.UV.append(list(uvs))
        self.FM.append(mat)

    def tris(self):
        return sum(len(f) - 2 for f in self.F)

    def to_obj(self, name, C, mats, surface='rock', mask=None, smooth=False, sharp=None):
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
            if sharp is not None:
                me.set_sharp_from_angle(angle=math.radians(sharp))
        mk = mask or (lambda co: (0.65, 0.35, 0.88))
        lib.write_mask_values(me, [mk(v.co) for v in me.vertices])
        me[TAG] = 1
        o = bpy.data.objects.new(name, me)
        C.objects.link(o)
        lib.tag(o, surface)
        o['nw_vmask'] = 1.0
        return o


# ═════════════════════════════ 3) DS2 빙하 U자 계곡 (MASK_RECT 경계 ~ 6.2 km) ═════════════════════════════
# 참조 화면: 계곡 바닥(이끼·풀·바위·개울)을 양쪽에서 가파른 층리 암벽이 감싸고, 상류로 갈수록 두 암벽이 겹쳐
# V자 소실점을 만든다. 암벽은 수평 지층 선반(이끼)과 가파른 단애(회색 암반), 사면 하향 걸리(낙석 골)로 읽힌다.
VALLEY_X = 27.0         # 분지 구간 계곡 중심선 x (HAUS x=0 와 FaceArch x=105 사이, 개울 x≈40)
VALLEY_HALF = 165.0     # 분지 구간 계곡 바닥 반폭 → 서쪽 암벽 기저 x≈-138, 동쪽 x≈192 (MASK_RECT 바로 바깥)
ROAD_Y = -42.0          # 산악 국도(TT) 중심선 — 서·동 암벽을 깎아 낸 지류 협곡으로 빠져나간다
STRATA = 32.0           # 층리 두께(m)


def dist_rect(x, y):
    dx = max(RECT[0] - x, 0.0, x - RECT[2])
    dy = max(RECT[1] - y, 0.0, y - RECT[3])
    return math.hypot(dx, dy)


def valley_axis(y):
    """계곡 중심선 x(y): 분지는 x≈27 직선, 북쪽 상류는 동쪽으로 굽었다가 휘어 들어가 시야 끝에서 암벽이 겹친다."""
    north = 85.0 * math.sin((y - 160.0) / 780.0) * smoothstep(160.0, 900.0, y)
    south = -55.0 * smoothstep(-170.0, -1200.0, y)
    return VALLEY_X + north + south


def valley_half_width(y, side):
    """계곡 바닥 반폭(side −1 서쪽 / +1 동쪽): 분지 165 m → 북쪽 2.6 km 에서 53 m 로 좁아진다."""
    w = VALLEY_HALF
    if y > 160.0:
        w -= 112.0 * smoothstep(160.0, 2600.0, y)
    elif y < -170.0:
        w -= 70.0 * smoothstep(-170.0, -1700.0, y)
    return w + 20.0 * n2(y, side * 37.0, 1.0 / 240.0, 41.0, 2)


def valley_floor_z(x, y):
    """MASK_RECT 바깥 계곡 바닥: 상류(북)로 완만히 오르는 빙퇴석 구릉 + 가운데를 흐르는 개울 골."""
    north = 28.0 * smoothstep(150.0, 480.0, y) + 0.055 * max(0.0, y - 480.0)
    south = 9.0 * smoothstep(-150.0, -360.0, y) - 0.03 * max(0.0, -360.0 - y)
    hum = 5.0 * n2(x, y, 1.0 / 70.0, 113.0, 3) + 1.4 * n2(x, y, 1.0 / 15.0, 127.0, 2)
    xs = stream_x(y)
    out = max(smoothstep(172.0, 250.0, y), smoothstep(-162.0, -240.0, y))
    cut = 3.4 * math.exp(-((x - xs) / 8.5) ** 2) * out
    return north + south + hum - cut


def stream_x(y):
    """원경 개울 중심선: MASK_RECT 의 상류 출구(22, 172)·하류 출구(14, −162)에서 이어져 계곡 축 주변을 굽이친다."""
    free = valley_axis(y) + 10.0 + 24.0 * n2(3.3, y, 1.0 / 260.0, 131.0, 2)
    if y >= 0.0:
        return 22.0 + (free - 22.0) * smoothstep(172.0, 330.0, y)
    return 14.0 + (free - 14.0) * smoothstep(-162.0, -320.0, y)


def wall_profile(x, y):
    """(암벽 높이, 측면, p, 걸리 g, 단애 띠 rb): p = 계곡 바닥 가장자리에서 암벽 쪽으로 잰 수평 거리(p ≤ 0 이면 계곡 바닥).
    rb 는 층리 계단의 가파른 단애 구간(1)·이끼 선반(0) — 정점 마스크가 회색 암반 띠와 초록 선반을 가른다."""
    xc = valley_axis(y)
    side = 1.0 if x >= xc else -1.0
    p = abs(x - xc) - valley_half_width(y, side)
    if p <= 0.0:
        return 0.0, side, p, 0.0, 0.0
    # 동쪽(역광 해 방향) 암벽이 더 높고 험하다 — 참조 화면 오른쪽 대암벽
    H = (580.0 if side > 0 else 480.0) * (0.80 + 0.32 * (0.5 + 0.5 * n2(y, side * 7.0, 1.0 / 650.0, 61.0, 2)))
    notch = math.exp(-((y - ROAD_Y) / (68.0 + 0.07 * p)) ** 2)        # 국도 지류 협곡 안부
    H *= 1.0 - 0.78 * notch
    base = H * (1.0 - math.exp(-((p / 225.0) ** 1.42)))
    # 능선 돌출부(spur)와 골(사면 하향 x 로 늘인 저주파 노이즈) — 암벽이 매끈한 원뿔로 읽히지 않게
    spur = 62.0 * n2(p * 0.08, y, 1.0 / 380.0, 151.0 + side, 2) * smoothstep(25.0, 260.0, p) * (1.0 - 0.5 * notch)
    # 세로 걸리: ridged noise → 좁고 깊은 낙석 골
    gy = y + 35.0 * n2(x, y, 1.0 / 320.0, 71.0, 2)
    g = (1.0 - abs(n2(p * 0.16, gy, 1.0 / 80.0, 83.0 + side, 2))) ** 5
    gully = g * 68.0 * smoothstep(15.0, 150.0, p) * (1.0 - 0.6 * smoothstep(650.0, 1200.0, p))
    # 중간 주파수 암반 요철(≈45 m): 층리 선반이 매끈한 등고선 계단으로 읽히지 않게 깨뜨린다
    rough = 15.0 * n2(x, y, 1.0 / 45.0, 181.0, 2) * smoothstep(20.0, 120.0, p)
    crest = 170.0 * (1.0 - abs(n2(x, y, 1.0 / 400.0, 97.0, 3))) ** 2.2 * smoothstep(200.0, 700.0, p) * (1.0 - 0.6 * notch)
    h = base + spur - gully + crest + rough
    # 층리: 북쪽으로 살짝 기울고 물결치는 지층면 기준 계단화 → 이끼 선반 + 가파른 회색 단애 띠(강도는 위치마다 다르게)
    s = h + 0.045 * y + 18.0 * n2(x, y, 1.0 / 220.0, 163.0, 2)
    st = STRATA * (0.85 + 0.3 * (0.5 + 0.5 * n2(y, side, 1.0 / 900.0, 171.0, 1)))
    f = s / st
    fi = math.floor(f)
    fr = f - fi
    stepped = (fi + smoothstep(0.38, 0.92, fr)) * st
    k = (0.35 + 0.6 * (0.5 + 0.5 * n2(x, y, 1.0 / 260.0, 177.0, 2))) * smoothstep(20.0, 100.0, p) * (1.0 - smoothstep(900.0, 1500.0, p))
    h += (stepped - s) * k
    rb = smoothstep(0.38, 0.48, fr) * (1.0 - smoothstep(0.84, 0.94, fr)) * k
    return max(0.0, h), side, p, g, rb


def outer_mountain_z(x, y):
    """MASK_RECT 경계에서는 ground.terrain_z 와 일치하고, 바깥으로 계곡 바닥 → 층리 대암벽으로 이어지는 높이 함수."""
    d_edge = dist_rect(x, y)
    if d_edge < 1e-4:
        return ground.terrain_z(x, y)
    cx = min(max(x, RECT[0]), RECT[2])
    cy = min(max(y, RECT[1]), RECT[3])
    z_edge = ground.terrain_z(cx, cy)
    blend = smoothstep(0.0, 140.0, d_edge)
    z = z_edge * (1.0 - blend) + valley_floor_z(x, y) * blend
    wall = wall_profile(x, y)[0]
    fade_outer = 1.0 - smoothstep(4200.0, 6000.0, math.hypot(x, y))
    return z + wall * smoothstep(0.0, 18.0, d_edge) * fade_outer


def _valley_points():
    """적응형 표본점: 시야에 크게 걸리는 암벽 하부(p −40..520 m, y −700..1500 m)는 7 m, 계곡 바닥 14 m,
    암벽 상부 18 m, 바깥 고원 34 m, 그 너머(> 3.6 km)는 동심원 고리."""
    rnd = random.Random(77)
    pts = []
    cell = 48.0
    X0, X1, Y0, Y1 = -1700.0, 1800.0, -2400.0, 3600.0
    nx, ny = int((X1 - X0) / cell), int((Y1 - Y0) / cell)
    for gx in range(nx):
        for gy in range(ny):
            cx = X0 + (gx + 0.5) * cell
            cy = Y0 + (gy + 0.5) * cell
            if math.hypot(cx, cy) > R_DISC - 80.0:
                continue
            _, side, p, _, _ = wall_profile(cx, cy)
            near_stream = abs(cx - stream_x(cy)) < 40.0 and (172.0 < cy < 1750.0 or -950.0 < cy < -162.0)
            if near_stream:
                s = 3.5 if cy < 700.0 else 6.0     # 개울 골(σ≈8.5 m)을 메시가 표현하도록
            elif -60.0 < p < 520.0:
                s = 7.0 if -700.0 < cy < 1500.0 else 12.0
            elif p <= -60.0:
                s = 7.0 if 160.0 < cy < 520.0 else 14.0   # CAM_valley 근경
            elif p < 1100.0:
                s = 18.0
            else:
                s = 34.0
            n = max(1, int(round(cell / s)))
            st = cell / n
            for i in range(n):
                for j in range(n):
                    x = cx - cell * 0.5 + (i + 0.5 + rnd.uniform(-0.32, 0.32)) * st
                    y = cy - cell * 0.5 + (j + 0.5 + rnd.uniform(-0.32, 0.32)) * st
                    if dist_rect(x, y) > 3.0:
                        pts.append((x, y))
    # 상자 바깥 원경 고리
    for r in (3700, 4000, 4350, 4780, 5250, 5750):
        n_ang = max(96, int(round(2.0 * math.pi * r / 60.0)))
        for k in range(n_ang):
            a = 2.0 * math.pi * (k + 0.5 * (r % 2)) / n_ang
            px, py = r * math.cos(a), r * math.sin(a)
            if not (X0 < px < X1 and Y0 < py < Y1):
                pts.append((px, py))
    return pts


def build_mountain_ground(C, M):
    """MASK_RECT 바깥에서 반경 R_DISC(6.2 km)까지 이어지는 U자 빙하 계곡 메시 (BD_ground, 정점 공유·스무스)."""
    x0, y0, x1, y1 = RECT
    nx_inner = int(round((x1 - x0) / 3.4))
    ny_inner = int(round((y1 - y0) / 3.4))
    inner_loop = []
    for i in range(nx_inner):
        inner_loop.append((x0 + (x1 - x0) * (i / nx_inner), y0))
    for j in range(ny_inner):
        inner_loop.append((x1, y0 + (y1 - y0) * (j / ny_inner)))
    for i in range(nx_inner):
        inner_loop.append((x1 - (x1 - x0) * (i / nx_inner), y1))
    for j in range(ny_inner):
        inner_loop.append((x0, y1 - (y1 - y0) * (j / ny_inner)))
    outer_loop = lib.poly_circle(0.0, 0.0, R_DISC, 288)

    def inside(x, y):
        if math.hypot(x, y) > R_DISC - 1.0:
            return False
        return not (x0 + 0.1 < x < x1 - 0.1 and y0 + 0.1 < y < y1 - 0.1)

    t0 = time.time()
    V2, T = lib.cdt([outer_loop, inner_loop], _valley_points(), inside, eps=1e-3)
    Z = [outer_mountain_z(x, y) for x, y in V2]
    print(f'[ds2_backdrop] valley CDT verts={len(V2)} tris={len(T)} ({round(time.time() - t0, 1)} s)')

    # 정점 속성: 경사·고도·걸리 기반 이끼(R) / 젖음(G) / AO(B)
    def vmask(i):
        x, y = V2[i]
        z = Z[i]
        e = 3.0
        dzx = (outer_mountain_z(x + e, y) - outer_mountain_z(x - e, y)) / (2 * e)
        dzy = (outer_mountain_z(x, y + e) - outer_mountain_z(x, y - e)) / (2 * e)
        slope = math.hypot(dzx, dzy)
        _, side, p, g, rb = wall_profile(x, y)
        zf = z - valley_floor_z(x, y) if p > 0 else 0.0
        mn = 0.5 + 0.5 * n2(x, y, 1.0 / 55.0, 19.3, 3)
        ledge = 1.0 - smoothstep(0.55, 1.25, slope)
        talus = 1.0 - smoothstep(60.0, 180.0, zf)                    # 암벽 하부 애추·완사면은 풀·이끼로 덮인다
        moss = (0.28 + 0.85 * ledge) * (0.62 + 0.55 * mn)
        moss *= 1.0 - 0.80 * rb * (1.0 - 0.6 * talus)                # 층리 단애 띠 = 회색 암반 노출
        moss *= 1.0 - 0.50 * smoothstep(300.0, 620.0, zf)           # 상부 암봉은 암반 위주
        moss *= 1.0 - 0.55 * g * smoothstep(30.0, 120.0, p)         # 걸리 바닥은 낙석·젖은 암반
        moss = max(moss, 0.85 * talus * (0.55 + 0.6 * mn) * (1.0 - 0.5 * g))
        if p <= 0.0:                                                 # 계곡 바닥: 풀·이끼로 덮인 빙퇴석 평원
            moss = 0.78 + 0.3 * mn
        wet = 0.30 + 0.32 * g + 0.25 * (1.0 - smoothstep(0.0, 60.0, zf))
        ao = 0.94 - 0.36 * g * smoothstep(20.0, 120.0, p) - 0.18 * rb - 0.12 * (1.0 - smoothstep(0.0, 40.0, zf)) * smoothstep(0.0, 40.0, p)
        return (clamp01(moss), clamp01(wet), clamp01(ao))

    # UV: 계곡 축 직교 방향 v 에 암벽 높이를 더해(접힘 없는 연속 좌표) 수직 단애의 텍스처 늘어짐을 줄인다
    def uv_of(i):
        x, y = V2[i]
        w, side, p, _, _ = wall_profile(x, y)
        return (y, (x - valley_axis(y)) + side * w * 0.85)

    name = 'BD_ground'
    o = bpy.data.objects.get(name)
    if o is not None:
        bpy.data.objects.remove(o, do_unlink=True)
    me = bpy.data.meshes.get(name)
    if me is not None and me.users == 0:
        bpy.data.meshes.remove(me)
    me = bpy.data.meshes.new(name)
    me.from_pydata([(V2[i][0], V2[i][1], Z[i]) for i in range(len(V2))], [], [tuple(f) for f in T])
    me.validate(clean_customdata=False)
    for poly in me.polygons:                      # 모든 면이 위(+Z)를 보도록
        if poly.normal.z < 0.0:
            poly.flip()
    uvs = [uv_of(i) for i in range(len(V2))]
    lib.set_uv(me, 'UVMap', None, per_loop=[uvs[me.loops[li].vertex_index] for li in range(len(me.loops))])
    me.materials.append(M['ground'])
    me.shade_smooth()
    lib.write_mask_values(me, [vmask(i) for i in range(len(V2))])
    me[TAG] = 1
    o = bpy.data.objects.new(name, me)
    C.objects.link(o)
    lib.tag(o, 'rock')
    o['nw_vmask'] = 1.0
    print(f'[ds2_backdrop] BD_ground tris={len(T)} built in {round(time.time() - t0, 1)} s')
    return o


# ═════════════════════════════ 4) 중경 바위 산봉우리(Alpine Crag Massif) · 원경 폭포 & 중계탑 ═════════════════════════════
def _add_crag_outcrop(acc, cx, cy, z_base, span, height, ang, rnd, n_cols=11):
    """중경 산악 사면 위에 자연스럽게 솟아오른 비대칭 계단식 현무암 단애·대암릉(Stepped Basalt Ridge Massif).
    뾰족한 삼각뿔 실루엣을 배제하고, 넓은 기저부와 다중 안부(saddle)·상부 단차 선반(ledge)을 가진 암반 능선으로 구성한다.
    """
    ca, sa = math.cos(ang), math.sin(ang)
    n_seg = max(8, n_cols)
    width_base = span * 0.46
    highest_pt = (cx, cy, z_base)

    # 능선 방향(u = -0.5 .. +0.5)을 따라 이어지는 상부 단차 선반(crest_l, crest_r)과 좌/우 기저부·중턱 정점 열 생성
    rows = []
    for i in range(n_seg):
        t = i / max(1, n_seg - 1)
        u = t - 0.5
        # 완만한 사다리꼴 엔벨로프 + 다중 봉우리/안부 변조 (뾰족한 단일 피크 방지)
        arch = math.sin(math.pi * t) ** 0.45
        multi_peak = 0.76 + 0.24 * math.cos(2.0 * math.pi * (t * 2.2 + 0.15))
        jag = 0.82 + 0.28 * (0.5 + 0.5 * n2(cx + i * 19.3, cy - i * 13.7, 0.25, 9.1, 2))
        h_local = height * arch * multi_peak * jag

        lx_c = u * span + rnd.uniform(-span * 0.03, span * 0.03)
        ly_c = rnd.uniform(-width_base * 0.10, width_base * 0.10)
        w_local = width_base * (0.45 + 0.55 * arch)
        w_top = w_local * 0.28

        def to_world(lx, ly):
            return (cx + lx * ca - ly * sa, cy + lx * sa + ly * ca)

        wx_l0, wy_l0 = to_world(lx_c, ly_c - w_local)
        wx_l1, wy_l1 = to_world(lx_c + rnd.uniform(-2.0, 2.0), ly_c - w_local * 0.55)
        wx_cl, wy_cl = to_world(lx_c, ly_c - w_top)
        wx_cr, wy_cr = to_world(lx_c, ly_c + w_top)
        wx_r1, wy_r1 = to_world(lx_c + rnd.uniform(-2.0, 2.0), ly_c + w_local * 0.55)
        wx_r0, wy_r0 = to_world(lx_c, ly_c + w_local)

        z_l0 = outer_mountain_z(wx_l0, wy_l0) - 4.0
        z_r0 = outer_mountain_z(wx_r0, wy_r0) - 4.0
        z_c0 = outer_mountain_z(wx_cr, wy_cr)
        z_top_l = z_c0 + h_local
        z_top_r = z_c0 + h_local * rnd.uniform(0.88, 1.04)
        z_l1 = z_l0 * 0.38 + z_top_l * 0.62 + rnd.uniform(-1.5, 1.5)
        z_r1 = z_r0 * 0.38 + z_top_r * 0.62 + rnd.uniform(-1.5, 1.5)

        if z_top_l > highest_pt[2]:
            highest_pt = (wx_cl, wy_cl, z_top_l)

        rows.append([
            (wx_l0, wy_l0, z_l0, 0.08),
            (wx_l1, wy_l1, z_l1, 0.46),
            (wx_cl, wy_cl, z_top_l, 0.84),
            (wx_cr, wy_cr, z_top_r, 0.22),
            (wx_r1, wy_r1, z_r1, 0.46),
            (wx_r0, wy_r0, z_r0, 0.08),
        ])

    for i in range(n_seg - 1):
        r0 = rows[i]
        r1 = rows[i + 1]
        u0 = i * 1.4
        u1 = (i + 1) * 1.4
        for k in range(5):
            a, b, c, d = r0[k], r1[k], r1[k + 1], r0[k + 1]
            acc.poly([a[:3], b[:3], c[:3], d[:3]], [(u0, a[3]), (u1, b[3]), (u1, c[3]), (u0, d[3])])

    # 양 끝단 사면 마감
    for end_row, flip in ((rows[0], False), (rows[-1], True)):
        p_l0, p_l1, p_cl, p_cr, p_r1, p_r0 = [p[:3] for p in end_row]
        if flip:
            acc.poly([p_l0, p_l1, p_cl], [(0.1, 0.08), (0.3, 0.46), (0.45, 0.84)])
            acc.poly([p_l0, p_cl, p_cr, p_r0], [(0.1, 0.08), (0.45, 0.84), (0.55, 0.84), (0.9, 0.08)])
            acc.poly([p_cr, p_r1, p_r0], [(0.55, 0.84), (0.7, 0.46), (0.9, 0.08)])
        else:
            acc.poly([p_cl, p_l1, p_l0], [(0.45, 0.84), (0.3, 0.46), (0.1, 0.08)])
            acc.poly([p_r0, p_cr, p_cl, p_l0], [(0.9, 0.08), (0.55, 0.84), (0.45, 0.84), (0.1, 0.08)])
            acc.poly([p_r0, p_r1, p_cr], [(0.9, 0.08), (0.7, 0.46), (0.55, 0.84)])

    return highest_pt


def _add_relay_tower(acc, cx, cy, z_base, height=18.0):
    """DS 시그니처 #4: 산악 능선 위에 서 있는 가늘고 높은 카이랄 통신/중계탑 + 상단 비콘."""
    r_bot = 0.42
    r_top = 0.14
    z_mid = z_base + height * 0.86
    z_top = z_base + height
    sides = 6
    for z0, z1, ra, rb, v0, v1 in (
        (z_base - 1.5, z_mid, r_bot, r_top, 0.925, 0.955),
        (z_mid, z_top, r_top * 1.35, r_top * 0.85, 0.965, 0.995),
    ):
        for k in range(sides):
            a0 = 2.0 * math.pi * k / sides
            a1 = 2.0 * math.pi * (k + 1) / sides
            p0 = (cx + ra * math.cos(a0), cy + ra * math.sin(a0), z0)
            p1 = (cx + ra * math.cos(a1), cy + ra * math.sin(a1), z0)
            p2 = (cx + rb * math.cos(a1), cy + rb * math.sin(a1), z1)
            p3 = (cx + rb * math.cos(a0), cy + rb * math.sin(a0), z1)
            acc.poly([p0, p1, p2, p3], [(k / sides, v0), ((k + 1) / sides, v0), ((k + 1) / sides, v1), (k / sides, v1)])


def _wall_point(y, side, p_target):
    """계곡 축에서 side 방향으로 바닥 반폭 + p_target 만큼 떨어진 암벽 위 점."""
    x = valley_axis(y) + side * (valley_half_width(y, side) + p_target)
    return x, y, outer_mountain_z(x, y)


def build_crags_and_relays(C, M):
    """계곡 바닥(MASK_RECT 바깥)의 빙하 표석 들판과 대형 암괴(tor), 암벽 어깨의 카이랄 중계탑."""
    import ds2_rocks
    importlib.reload(ds2_rocks)
    rnd = random.Random(2049)

    # 1) 계곡 바닥 표석·암괴 (참조 화면 가운데의 이끼 덮인 대형 암괴 + 원경으로 이어지는 바위 들판)
    tor_acc = Acc()
    masks = []
    protos = [ds2_rocks.boulder_geom(900 + i, subdiv=2, cuts=8, squash=0.6, lump=0.28) for i in range(4)]
    protos_lo = [ds2_rocks.boulder_geom(950 + i, subdiv=1, cuts=5, squash=0.7) for i in range(5)]

    def put(geo, x, y, sx, sy, sz, rz, sink=0.18):
        V, F, h = geo
        z0 = outer_mountain_z(x, y) - sink * h * sz
        ca, sa = math.cos(rz), math.sin(rz)
        mk = ds2_rocks.boulder_mask(h * sz, moss_amt=1.0, seed=x * 0.01)
        W = []
        for vx, vy, vz in V:
            lx, ly = vx * sx, vy * sy
            W.append((x + lx * ca - ly * sa, y + lx * sa + ly * ca, z0 + vz * sz))
        for f in F:
            pts = [W[i] for i in f]
            # 박스 투영 UV(m) — 면 법선 주축
            ax = (pts[1][0] - pts[0][0], pts[1][1] - pts[0][1], pts[1][2] - pts[0][2])
            bx = (pts[2][0] - pts[0][0], pts[2][1] - pts[0][1], pts[2][2] - pts[0][2])
            n = (ax[1] * bx[2] - ax[2] * bx[1], ax[2] * bx[0] - ax[0] * bx[2], ax[0] * bx[1] - ax[1] * bx[0])
            k = max(range(3), key=lambda i: abs(n[i]))
            uvs = [((q[1], q[2]) if k == 0 else (q[0], q[2]) if k == 1 else (q[0], q[1])) for q in pts]
            tor_acc.poly(pts, uvs)
            ln = math.sqrt(n[0] ** 2 + n[1] ** 2 + n[2] ** 2) or 1.0
            nn = (n[0] / ln, n[1] / ln, n[2] / ln)
            masks.extend(mk((q[0] - x, q[1] - y, q[2] - z0), nn) for q in pts)

    # 1-a) 대형 암괴(tor): 상류 계곡 바닥 가운데에 솟은 층진 암괴 언덕 — 큰 표석 2~3개를 겹쳐 쌓아
    #      참조 화면 중앙의 '윗면에 이끼가 앉은 각진 바위 언덕' 실루엣을 만든다 (폭 22~60 m)
    tors = [(0.42, 380.0, 52.0, 26.0), (-0.35, 560.0, 38.0, 20.0), (0.15, 820.0, 60.0, 30.0),
            (-0.55, 1120.0, 44.0, 24.0), (0.5, 1450.0, 56.0, 28.0), (-0.2, -420.0, 40.0, 20.0),
            (0.6, -700.0, 48.0, 24.0)]
    for frac, y, w, hgt in tors:
        side = 1.0 if frac >= 0 else -1.0
        x = valley_axis(y) + frac * valley_half_width(y, side)
        rz0 = rnd.uniform(0, 6.3)
        for part in range(3):
            g = protos[rnd.randrange(len(protos))]
            ww = w * (0.5, 0.36, 0.26)[part]
            hh = hgt * (1.0, 0.78, 0.55)[part]
            a = rz0 + part * 2.1
            d = (0.0, 0.42, 0.55)[part] * w * 0.5
            put(g, x + d * math.cos(a), y + d * math.sin(a), ww, ww * rnd.uniform(0.65, 0.95), hh / max(g[2], 0.1),
                rz0 + rnd.uniform(-0.6, 0.6), sink=0.22)
        for _ in range(9):          # 암괴 발치의 낙석
            a = rnd.uniform(0, 2 * math.pi); d = w * rnd.uniform(0.5, 1.1)
            g2 = protos_lo[rnd.randrange(len(protos_lo))]
            s = rnd.uniform(2.5, 7.5)
            put(g2, x + d * math.cos(a), y + d * math.sin(a), s, s * rnd.uniform(0.7, 1.0), s * rnd.uniform(0.6, 0.9), rnd.uniform(0, 6.3))

    # 1-b) 표석 들판: MASK_RECT 바깥 계곡 바닥(북 172..1700 m, 남 −162..−900 m) — 가까운 구간일수록 촘촘하게
    n_field = 0
    tries = 0
    while n_field < 620 and tries < 9000:
        tries += 1
        y = 172.0 + 1530.0 * rnd.random() ** 1.6 if rnd.random() < 0.75 else -170.0 - 730.0 * rnd.random() ** 1.6
        side = 1.0 if rnd.random() < 0.5 else -1.0
        frac = rnd.uniform(0.0, 1.1)
        x = valley_axis(y) + side * frac * valley_half_width(y, side)
        if dist_rect(x, y) < 6.0 or abs(x - stream_x(y)) < 7.0:
            continue
        g = protos_lo[rnd.randrange(len(protos_lo))]
        s = rnd.uniform(1.2, 4.8) * (1.0 + 0.7 * smoothstep(300.0, 1500.0, abs(y)))
        if rnd.random() < 0.3:                      # 참조 화면처럼 개울 둑에 몰린 자갈·호박돌
            x = stream_x(y) + rnd.choice((-1.0, 1.0)) * rnd.uniform(4.5, 11.0)
            s *= 0.35
            if dist_rect(x, y) < 6.0:
                continue
        put(g, x, y, s, s * rnd.uniform(0.7, 1.0), s * rnd.uniform(0.55, 0.85), rnd.uniform(0, 6.3))
        n_field += 1

    o_tor = tor_acc.to_obj('BD_tors', C, [M['ground']], 'rock', mask=None, smooth=False)
    me = o_tor.data
    # 정점이 면마다 분리돼 있으므로 마스크를 정점 순서로 그대로 쓴 뒤 용접 + 스무스(파쇄면 모서리는 날카롭게)
    lib.write_mask_values(me, [m[:3] for m in masks])
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-3)
    bm.to_mesh(me); bm.free()
    me.shade_smooth()
    me.set_sharp_from_angle(angle=math.radians(38.0))

    # 2) 암벽 어깨(p 160~320 m) 위 카이랄 중계탑 + 상단 비콘 (NWB_city 아틀라스 발광, 모바일은 숨김)
    crag_acc = Acc()
    for y, side, pp in ((260.0, -1.0, 210.0), (620.0, 1.0, 240.0), (980.0, -1.0, 260.0), (1500.0, 1.0, 200.0),
                        (-380.0, 1.0, 230.0), (90.0, 1.0, 300.0)):
        x, yy, z = _wall_point(y, side, pp)
        _add_relay_tower(crag_acc, x, yy, z - 1.0, height=rnd.uniform(18.0, 26.0))
    o_crags = crag_acc.to_obj('BD_mid_crags', C, [M['crag']], 'rock', mask=lambda co: (0.0, 0.3, 0.9), smooth=False)
    o_crags['nw_night'] = 1

    # (참조 화면에 없는 직선 실폭포 카드는 두지 않는다 — 암벽의 젖은 걸리는 정점 마스크 G/B 로 표현)
    print(f'[ds2_backdrop] BD_tors tris={tor_acc.tris()} (field {n_field}), relays={crag_acc.tris()}')
    return [o_tor, o_crags]


def build_stream(C, M):
    """계곡 바닥 골을 따라 상류(북 172 → 1.7 km)·하류(남 −162 → −900 m)로 이어지는 개울 수면 띠(BD_stream).
    참조 화면 가운데로 흘러드는 어두운 개울. 수면은 골 바닥 + 0.8 m(이동 평균), 폭 6~10 m, 가장자리는 둑 아래로 숨는다."""
    acc = Acc()
    for y0, y1 in ((174.0, 1700.0), (-164.0, -900.0)):
        step = 3.0 if y1 > y0 else -3.0
        n = int(abs(y1 - y0) / abs(step))
        rows = []
        for k in range(n + 1):
            y = y0 + k * step
            xs = stream_x(y)
            dxdy = (stream_x(y + 2.0) - stream_x(y - 2.0)) / 4.0
            nx, ny = 1.0, -dxdy
            ln = math.hypot(nx, ny)
            nx, ny = nx / ln, ny / ln
            # 좌우 가장자리를 따로 흔들어 직선 수로처럼 보이지 않게(폭 6~10 m)
            hl = 4.2 + 1.1 * n2(y, 7.0, 1.0 / 40.0, 191.0, 2)
            hr = 4.2 + 1.1 * n2(y, 9.0, 1.0 / 37.0, 193.0, 2)
            zc = outer_mountain_z(xs, y)
            zbank = min(outer_mountain_z(xs - nx * hl, y - ny * hl), outer_mountain_z(xs + nx * hr, y + ny * hr))
            rows.append([xs, y, nx, ny, hl, hr, zc, zbank])
        # 수위: 골 바닥 + 0.8 m 를 이동 평균(±4행)으로 매끈하게 한 뒤, 양쪽 둑보다 0.35 m 낮게 제한
        raw = [r[6] + 0.8 for r in rows]
        sm = [sum(raw[max(0, i - 4):i + 5]) / len(raw[max(0, i - 4):i + 5]) for i in range(len(raw))]
        prev = None
        for (xs, y, nx, ny, hl, hr, zc, zbank), zw in zip(rows, sm):
            zw = max(zc + 0.15, min(zw, zbank - 0.35))
            row = ((xs - nx * hl, y - ny * hl, zw), (xs + nx * hr, y + ny * hr, zw))
            if prev is not None:
                a_, b_ = (prev, row) if step > 0 else (row, prev)
                acc.poly([a_[0], a_[1], b_[1], b_[0]],
                         [(0.0, a_[0][1] / 8.0), (1.0, a_[0][1] / 8.0), (1.0, b_[0][1] / 8.0), (0.0, b_[0][1] / 8.0)])
            prev = row
    o = acc.to_obj('BD_stream', C, [M['water']], 'water', mask=lambda co: (0.0, 1.0, 1.0), smooth=True)
    print(f'[ds2_backdrop] BD_stream tris={acc.tris()}')
    return o


CAM_VALLEY_Y = (238.0, 1150.0)


def set_valley_cam(sc):
    """참조 화면 구도: 상류 개울 둑에서 계곡 상류를 바라보며 양쪽 층리 암벽이 V자로 겹치는 시점(CAM_valley)."""
    y0, y1 = CAM_VALLEY_Y
    x0 = stream_x(y0) - 6.5
    loc = Vector((x0, y0, outer_mountain_z(x0, y0) + 1.8))
    x1 = stream_x(y1) - 10.0
    tgt = Vector((x1, y1, outer_mountain_z(x1, y1) + 36.0))
    cd = bpy.data.cameras.get('CAM_valley') or bpy.data.cameras.new('CAM_valley')
    cam = bpy.data.objects.get('CAM_valley') or bpy.data.objects.new('CAM_valley', cd)
    lay = lib.coll('NW_layout', sc)
    if cam.name not in lay.objects:
        lay.objects.link(cam)
    cam.location = loc
    cam.rotation_euler = (tgt - loc).to_track_quat('-Z', 'Y').to_euler()
    cd.lens = 22.0
    cd.sensor_width = 36.0
    cd.clip_start = 0.1
    cd.clip_end = 20000.0
    cam['target'] = list(tgt)
    return cam


# ═════════════════════════════ 5) 원경 4겹 대산맥 능선 (3.8 ~ 6.0 km) ═════════════════════════════
def polar(bearing, d):
    a = math.radians(bearing)
    return d * math.sin(a), d * math.cos(a)


def keep_angle(h, d_real, d_new):
    return EYE + (h - EYE) * (d_new / d_real)


RIDGES = {
    1: (
        3900.0,
        [
            (15.0, 480, 4.6, 11.0, 0.35), (34.0, 420, 4.8, 10.0, 0.25), (62.0, 390, 4.5, 11.5, 0.2),
            (115.0, 440, 5.2, 12.0, 0.3), (152.0, 510, 5.8, 11.0, 0.45), (205.0, 460, 5.0, 12.0, 0.3),
            (258.0, 380, 4.2, 10.5, 0.2), (298.0, 490, 4.8, 11.0, 0.4), (338.0, 430, 4.5, 11.5, 0.3),
        ],
        1.0,
        'DS2 제1능선 — 초록 이끼 고원과 현무암 단애',
    ),
    2: (
        4800.0,
        [
            (8.0, 680, 6.2, 11.5, 0.55), (48.0, 610, 6.5, 10.5, 0.45), (88.0, 590, 6.2, 12.0, 0.4),
            (138.0, 720, 7.0, 11.0, 0.65), (182.0, 660, 6.8, 11.5, 0.5), (228.0, 640, 6.4, 12.0, 0.45),
            (278.0, 740, 6.8, 10.5, 0.7), (318.0, 690, 6.5, 11.0, 0.6),
        ],
        1.0,
        'DS2 제2능선 — 주상절리 협곡 산맥',
    ),
    3: (
        5550.0,
        [
            (24.0, 980, 9.0, 10.0, 0.85), (72.0, 890, 8.8, 11.0, 0.75), (122.0, 940, 9.2, 10.5, 0.8),
            (168.0, 1050, 9.8, 11.0, 0.95), (215.0, 920, 9.0, 10.5, 0.8), (262.0, 990, 9.4, 10.0, 0.9),
            (312.0, 1120, 9.6, 10.5, 1.0), (346.0, 960, 9.0, 10.0, 0.85),
        ],
        1.0,
        'DS2 제3능선 — 고산 암봉과 운해 능선',
    ),
    4: (
        6000.0,
        [
            (0.0, 1180, 11.5, 14.0, 0.9), (90.0, 1120, 11.5, 14.0, 0.85),
            (180.0, 1240, 12.0, 14.0, 0.95), (270.0, 1200, 11.8, 14.0, 0.9),
        ],
        1.0,
        'DS2 제4능선 — 원경 설산·화산 대산맥(360° 수평선 차폐)',
    ),
}


def ridge_height(layer, brg):
    R, peaks, base, _ = RIDGES[layer]
    h = 0.0
    rock = 0.25
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
            h = hh
            rock = max(rock, rk * prof)
    if accum > 0.0:
        h = max(h, (accum ** (1.0 / 2.2)) * 0.88)
    if base:
        base_h = {1: 115.0, 2: 155.0, 3: 210.0, 4: 245.0}[layer]
        h = max(h, base_h + 65.0 * (0.5 + 0.5 * n2(brg * 0.9, 3.1 + layer, 0.05, 11.0, 3)) + 28.0 * n2(brg, 7.7, 0.4, 3.0, 2))
    jag = 0.10 + 0.12 * rock
    h *= 1.0 + jag * n2(brg * 4.5, layer * 13.0, 0.35, 5.0 + layer, 3) + 0.05 * n2(brg * 11.0, layer * 29.0, 0.5, 9.0 + layer, 2)
    return h, rock


def build_ridges(C, M):
    out = []
    for layer, (R, peaks, base, title) in RIDGES.items():
        acc = Acc()
        step = 0.35 if layer < 4 else 0.5
        n = int(round(360.0 / step))
        prev = None
        for i in range(n + 1):
            brg = i * step
            h, rock = ridge_height(layer, brg)
            vtop = 0.94 if rock > 0.45 else (0.62 + 0.25 * rock)
            rows = [
                (R - max(320.0, h * 3.6), -12.0, 0.04),
                (R - h * 1.4, h * 0.58, vtop * 0.52),
                (R, h, vtop),
                (R + max(220.0, h * 2.2), -12.0, 0.06),
            ]
            col = [(polar(brg, r)[0], polar(brg, r)[1], z, v) for r, z, v in rows]
            if prev is not None:
                u0 = (brg - step) / 3.0
                u1 = brg / 3.0
                for k in range(3):
                    a, b, c, d = prev[k], col[k], col[k + 1], prev[k + 1]
                    acc.poly([a[:3], b[:3], c[:3], d[:3]], [(u0, a[3]), (u1, b[3]), (u1, c[3]), (u0, d[3])])
            prev = col
        if acc.F:
            o = acc.to_obj(
                f'BD_ridge_{layer}', C, [M['ridge']], 'rock',
                mask=lambda co, lyr=layer: (clamp01(0.75 - 0.15 * lyr), 0.25, 0.95),
                smooth=True,
            )
            o['nw_layer_ring'] = 2 + layer if layer < 4 else 6
            o['nw_title'] = title
            o['nw_radius_m'] = R
            out.append(o)
            print(f'[ds2_backdrop] ridge {layer} tris={acc.tris()}')
    return out


CAM_AERIAL = ((148.0, -138.0, 92.0), (-12.0, 52.0, 24.0), 24.0)


def set_aerial(sc):
    cam = bpy.data.objects.get('CAM_aerial')
    if cam is None:
        return None
    loc, tgt, lens = CAM_AERIAL
    cam.location = loc
    cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = lens
    cam['target'] = list(tgt)
    return cam


def build():
    t0 = time.time()
    sc = lib.get_scene(True)
    if bpy.data.objects.get('GR_terrain') is None:
        ground.build()
    C = lib.coll('NW_backdrop', sc)
    lib.clear_coll(C)
    M = materials()
    build_mountain_ground(C, M)
    build_crags_and_relays(C, M)
    build_stream(C, M)
    build_ridges(C, M)
    lib.setup_render(sc)
    lib.setup_fog(sc, lib.coll('NW_fx', sc))
    lib.set_far_clip(sc)
    set_aerial(sc)
    set_valley_cam(sc)
    print(f'[ds2_backdrop] built in {round(time.time() - t0, 1)} s, total tris={lib.tri_count(C.all_objects)}')
    return C


if __name__ == '__main__':
    build()
