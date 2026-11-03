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

    # 1) 중경 광역 산악 지표: 다중 노이즈 + 2종 암반 텍스처(coast_sand_rocks_02 + dark_rock) 합성 노드 그래프
    M_gnd = lib.Mat(_guard('NWB_ground')); b_g = M_gnd.b
    t = M_gnd.texset('coast_sand_rocks_02', M_gnd.uv(6.8))
    t2 = M_gnd.texset('dark_rock', M_gnd.uv(8.5, offset=(0.25, 0.65)))
    P = M_gnd.pos
    soil = M_gnd.grade(t['color'], 0.65, srgb('#9AAA74'), 1.15)
    basalt = M_gnd.grade(t2['color'], 0.55, srgb('#8A8E90'), 1.05)
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


# ═════════════════════════════ 3) 연속 3D 산악 고원 지형 (MASK_RECT 경계 ~ 6.2 km) ═════════════════════════════
def dist_rect(x, y):
    dx = max(RECT[0] - x, 0.0, x - RECT[2])
    dy = max(RECT[1] - y, 0.0, y - RECT[3])
    return math.hypot(dx, dy)


def outer_mountain_z(x, y):
    """MASK_RECT 경계에서는 ground.terrain_z(x, y) 와 100% 일치하고,
    외곽으로 갈수록 거대한 초록 이끼 산악 능선과 현무암 봉우리(높이 35~290m)로 솟아오르는 연속 높이 함수."""
    d_edge = dist_rect(x, y)
    if d_edge < 1e-4:
        return ground.terrain_z(x, y)

    # 가장 가까운 MASK_RECT 테두리 점의 높이에서 출발 (경계면 틈 0.0m 보장)
    cx = min(max(x, RECT[0]), RECT[2])
    cy = min(max(y, RECT[1]), RECT[3])
    z_edge = ground.terrain_z(cx, cy)

    r = math.hypot(x, y)
    ang = math.atan2(y, x)

    # 서쪽 진입로 협곡(y ~ -42, x < -112)과 남동쪽 개울 협곡(x > 50, y < -162)은 계곡 통로로 낮게 열어 둔다
    west_pass = math.exp(-((y + 42.0) / 48.0) ** 2) * smoothstep(-60.0, -160.0, x)
    se_gorge = math.exp(-((x - 115.0 - (-y - 162.0) * 0.45) / 65.0) ** 2) * smoothstep(-120.0, -240.0, y)
    valley_mask = clamp01(1.0 - 0.80 * max(west_pass, se_gorge))

    # 거리에 따른 산악 고도 상승 (중경 120~1400m: 급경사 능선과 봉우리, 원경 1400~3600m: 대산맥)
    rise_near = smoothstep(0.0, 260.0, d_edge)
    rise_mid = smoothstep(80.0, 880.0, d_edge)
    rise_far = smoothstep(420.0, 2400.0, d_edge)
    fade_outer = 1.0 - smoothstep(3800.0, 5800.0, r)

    # Ridged multifractal 산악 능선 (1 - |noise|) 으로 칼날 능선과 골짜기 형성
    r1 = 1.0 - abs(n2(x, y, 0.0022, 13.7, 3))
    r2 = 1.0 - abs(n2(x * 0.8 - y * 0.6, x * 0.6 + y * 0.8, 0.0052, 29.1, 3))
    r3 = 1.0 - abs(n2(x, y, 0.012, 53.4, 2))
    ridged = (r1 ** 1.6) * 0.55 + (r2 ** 1.8) * 0.32 + (r3 ** 1.5) * 0.13

    ridge_wave = (
        0.62 + 0.38 * math.sin(ang * 3.0 + 0.6)
        + 0.28 * math.cos(ang * 5.0 - 0.8)
        + 0.22 * math.sin(ang * 7.0 + 1.4)
    )

    mtn_h = (
        rise_near * (54.0 * (r2 ** 1.5) + 22.0 * r3)
        + rise_mid * (118.0 * ridged * max(0.35, ridge_wave))
        + rise_far * (145.0 * (r1 ** 1.4) * max(0.4, ridge_wave))
    ) * valley_mask * fade_outer

    # 경계(d_edge = 0)에서 75m 사이에 z_edge → z_edge + mtn_h 로 매끄럽게 이어 붙인다
    blend = smoothstep(0.0, 75.0, d_edge)
    return z_edge * (1.0 - blend * 0.45) + mtn_h


def build_mountain_ground(C, M):
    """MASK_RECT 바깥에서 반경 R_DISC(6.2 km)까지 이어지는 3D 산악 고원 메시 (BD_ground)."""
    x0, y0, x1, y1 = RECT

    # 내부 사각형 테두리를 3.4m 간격(ds2_ground 와 동일)으로 촘촘히 샘플링해 경계 정점을 맞춘다
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

    outer_loop = lib.poly_circle(0.0, 0.0, R_DISC, 144)

    def inside(x, y):
        if math.hypot(x, y) > R_DISC - 1.0:
            return False
        if x0 + 0.1 < x < x1 - 0.1 and y0 + 0.1 < y < y1 - 0.1:
            return False
        return True

    # 동심원 표본점: 근·중경(180~1600m)은 촘촘하게 배치해 산악 능선과 골짜기가 자연스러운 3D 지형으로 드러나게 한다
    pts = []
    for pad in (8.0, 18.0, 30.0, 45.0, 64.0, 88.0, 118.0, 155.0):
        rr = lib.RRect(x0 - pad, y0 - pad, x1 + pad, y1 + pad)
        pts.extend(rr.outline(step=max(7.5, pad * 0.24)))

    radii = (
        195, 225, 260, 300, 345, 400, 465, 540, 630, 740, 870,
        1020, 1200, 1420, 1700, 2060, 2520, 3120, 3880, 4780, 5600,
    )
    for r in radii:
        n_ang = max(64, int(round(2.0 * math.pi * r / max(18.0, r * 0.044))))
        for k in range(n_ang):
            a = 2.0 * math.pi * (k + 0.5 * (r % 2)) / n_ang
            px, py = r * math.cos(a), r * math.sin(a)
            if inside(px, py) and dist_rect(px, py) > 32.0:
                pts.append((px, py))

    V2, T = lib.cdt([outer_loop, inner_loop], pts, inside, eps=1e-3)
    acc = Acc()
    for f in T:
        tri_pts = [(V2[i][0], V2[i][1], outer_mountain_z(V2[i][0], V2[i][1])) for i in f]
        tri_uvs = [(V2[i][0], V2[i][1]) for i in f]
        acc.poly(tri_pts, tri_uvs)

    def mtn_mask(co):
        x, y, z = co[0], co[1], co[2]
        # 사면 기울기 및 노이즈에 따라 초록 이끼 사면(R=0.65..0.98)과 검은 현무암 암릉(R=0.04..0.28) 교차
        eps = 4.0
        dzx = (outer_mountain_z(x + eps, y) - outer_mountain_z(x - eps, y)) / (2.0 * eps)
        dzy = (outer_mountain_z(x, y + eps) - outer_mountain_z(x, y - eps)) / (2.0 * eps)
        slope = math.hypot(dzx, dzy)
        steep_rock = smoothstep(0.32, 0.72, slope)
        m_noise = 0.5 + 0.5 * n2(x, y, 0.009, 19.3, 3)
        alt_rock = smoothstep(75.0, 185.0, z)
        moss = clamp01((0.92 - 0.68 * steep_rock - 0.35 * alt_rock) * (0.55 + 0.65 * m_noise))
        wet = clamp01(0.35 + 0.35 * (1.0 - smoothstep(0.0, 55.0, z)) + 0.20 * steep_rock)
        ao = clamp01(0.68 + 0.32 * smoothstep(0.0, 45.0, z) - 0.18 * steep_rock)
        return (moss, wet, ao)

    o_gnd = acc.to_obj('BD_ground', C, [M['ground']], 'rock', mask=mtn_mask, smooth=True, sharp=None)
    print(f'[ds2_backdrop] BD_ground tris={acc.tris()}')
    return o_gnd


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


def build_crags_and_relays(C, M):
    """중경(반경 220m ~ 1,650m) 산악 사면과 능선 위에 비대칭 주상절리 암벽 군락(Outcrop)과 능선 중계탑, 원경 실폭포를 배치한다."""
    rnd = random.Random(2049)
    crag_acc = Acc()

    # 주요 방위별 주상절리 대암릉 군락 (cx, cy, span, height, ang, n_cols)
    hero_crags = [
        # 북서~북동 배후 대암릉 (거리 시점·조감 시점 정면 배경 — 넓고 계단식인 현무암 단애)
        (-165.0, 265.0, 145.0, 14.0, 0.18, 15),
        (-32.0, 295.0, 168.0, 16.0, -0.08, 17),
        (108.0, 275.0, 155.0, 15.0, 0.22, 16),
        (225.0, 195.0, 135.0, 14.0, -0.38, 14),
        # 동측·남동측 협곡 암봉 (가로로 긴 계단식 암반 단애)
        (245.0, 48.0, 140.0, 14.0, 1.45, 14),
        (220.0, -135.0, 138.0, 14.0, 1.15, 14),
        # 남측·남서측 구릉 암봉
        (-58.0, -245.0, 145.0, 14.0, 0.12, 14),
        (-195.0, -185.0, 138.0, 15.0, -0.45, 14),
        # 서측 협곡 양안 암봉
        (-225.0, 42.0, 132.0, 15.0, 1.38, 13),
        (-205.0, 155.0, 128.0, 14.0, 0.95, 13),
    ]

    relay_tops = []
    for i, (cx, cy, span, h, ang, n_cols) in enumerate(hero_crags):
        zb = outer_mountain_z(cx, cy)
        top_pt = _add_crag_outcrop(crag_acc, cx, cy, zb, span, h, ang, rnd, n_cols=n_cols)

    # 반경 420m ~ 1,550m 중경 산악 지대에 28개의 계단식 암벽 노두 및 원경 중계탑 추가 배치
    for i in range(28):
        brg = (i * 360.0 / 28.0) + rnd.uniform(-4.5, 4.5)
        r = rnd.uniform(420.0, 1520.0)
        rad = math.radians(brg)
        cx, cy = r * math.sin(rad), r * math.cos(rad)
        if abs(cy + 42.0) < 48.0 and cx < -110.0 and cx > -520.0:
            continue
        zb = outer_mountain_z(cx, cy)
        scale_d = 1.0 + (r / 1100.0)
        span = rnd.uniform(75.0, 125.0) * scale_d
        h = rnd.uniform(12.0, 24.0) * (0.8 + 0.30 * (r / 1200.0))
        ang = rad + math.pi * 0.5 + rnd.uniform(-0.25, 0.25)
        top_pt = _add_crag_outcrop(crag_acc, cx, cy, zb, span, h, ang, rnd, n_cols=11)
        if i % 3 == 0:
            relay_tops.append(top_pt)

    # 원경 능선 꼭대기 카이랄 중계탑 배치
    for tx, ty, tz in relay_tops[:10]:
        _add_relay_tower(crag_acc, tx, ty, tz - 1.0, height=rnd.uniform(16.0, 24.0))

    def crag_mask(co):
        # 상부 및 평탄 턱에 이끼(R), 하부에 AO
        z = co[2]
        m = clamp01(0.58 * (1.0 - smoothstep(45.0, 140.0, z)) + 0.25 * (0.5 + 0.5 * n2(co[0], co[1], 0.02, 7.1, 2)))
        w = clamp01(0.45 + 0.35 * (1.0 - smoothstep(0.0, 45.0, z)))
        ao = clamp01(0.62 + 0.38 * smoothstep(0.0, 55.0, z))
        return (m, w, ao)

    o_crags = crag_acc.to_obj('BD_mid_crags', C, [M['crag']], 'rock', mask=crag_mask, smooth=True, sharp=None)
    o_crags['nw_night'] = 1

    # 원경 암벽 실폭포 & 원경 개울 수로 (BD_waterfalls, DS 시그니처 #1: 산악 사면을 따라 흐르는 가는 실폭포)
    wf_acc = Acc()
    waterfalls = [
        ((-32.0, 345.0), (-26.0, 205.0), 1.6),
        ((98.0, 335.0), (82.0, 205.0), 1.5),
        ((-158.0, 320.0), (-128.0, 200.0), 1.4),
    ]
    for (x0, y0), (x1, y1), w_half in waterfalls:
        dx, dy = x1 - x0, y1 - y0
        L = math.hypot(dx, dy)
        tx, ty = -dy / L * w_half, dx / L * w_half
        n_wf = 8
        for k in range(n_wf):
            t0 = k / n_wf
            t1 = (k + 1) / n_wf
            xa, ya = x0 + dx * t0, y0 + dy * t0
            xb, yb = x0 + dx * t1, y0 + dy * t1
            za = outer_mountain_z(xa, ya) + 0.35
            zb = outer_mountain_z(xb, yb) + 0.35
            wf_acc.poly(
                [(xa - tx, ya - ty, za), (xa + tx, ya + ty, za), (xb + tx, yb + ty, zb), (xb - tx, yb - ty, zb)],
                [(0, t0), (1, t0), (1, t1), (0, t1)],
            )
    o_wf = wf_acc.to_obj('BD_waterfalls', C, [M['water']], 'water', mask=lambda co: (0.0, 1.0, 1.0), smooth=True)
    print(f'[ds2_backdrop] BD_mid_crags tris={crag_acc.tris()}, waterfalls={wf_acc.tris()}')
    return [o_crags, o_wf]


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
    build_ridges(C, M)
    lib.setup_render(sc)
    lib.setup_fog(sc, lib.coll('NW_fx', sc))
    lib.set_far_clip(sc)
    set_aerial(sc)
    print(f'[ds2_backdrop] built in {round(time.time() - t0, 1)} s, total tris={lib.tri_count(C.all_objects)}')
    return C


if __name__ == '__main__':
    build()
