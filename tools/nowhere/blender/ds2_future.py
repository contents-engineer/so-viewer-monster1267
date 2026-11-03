# HAUS NOWHERE — DS2 산악 월드 / Task 1: DS 스타일 절제된 개척 인프라 (트러스 교량 · 카이랄 비콘 · 화물 포드 · 드론).
# 실행: 헤드리스 blender -b --factory-startup --python tools/nowhere/blender/ds2_future.py
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
from lib import srgb, smoothstep, clamp01

import numpy as np

GEN = os.path.join(lib.OUT, 'gen')
TAG = 'nw_future_src'

# 드론 순항 경로 (산악 협곡 · 개울 · 두 영웅 건물 순회)
DRONE_PATHS = {
    'sec': [
        (36.0, 18.0, 18.0), (12.0, 52.0, 22.0), (-34.0, 44.0, 24.0), (-42.0, -18.0, 20.0),
        (8.0, -34.0, 19.0), (58.0, -22.0, 18.0), (84.0, 8.0, 21.0), (62.0, 38.0, 20.0),
    ],
    'd1': [
        (48.0, 4.0, 32.0), (88.0, -12.0, 38.0), (132.0, 28.0, 42.0), (96.0, 74.0, 38.0), (42.0, 56.0, 34.0),
    ],
    'd2': [
        (-64.0, -38.0, 28.0), (18.0, -36.0, 30.0), (92.0, -18.0, 30.0), (78.0, -78.0, 42.0), (-48.0, -82.0, 40.0),
    ],
    'd3': [
        (28.0, 88.0, 28.0), (-22.0, 92.0, 32.0), (-52.0, 48.0, 30.0), (14.0, 46.0, 26.0),
    ],
}
DRONE_SPEED = {'sec': 4.2, 'd1': 9.0, 'd2': 11.0, 'd3': 7.5}

CAM_NIGHT = ((46.0, -39.5, 2.8), (-4.0, 6.0, 21.0), 22.0)
BEAM_AIM = (44.0, 8.0, 0.0)


def _guard(name):
    if not name.startswith('NWF_'):
        raise ValueError(f'future 재질 이름은 NWF_ 로 시작해야 한다: {name}')
    return name


def newell(pts):
    nx = ny = nz = 0.0
    k = len(pts)
    for i in range(k):
        x1, y1, z1 = pts[i]
        x2, y2, z2 = pts[(i + 1) % k]
        nx += (y1 - y2) * (z1 + z2)
        ny += (z1 - z2) * (x1 + x2)
        nz += (x1 - x2) * (y1 + y2)
    L = math.sqrt(nx * nx + ny * ny + nz * nz)
    return ((nx / L, ny / L, nz / L), 0.5 * L) if L > 1e-12 else ((0.0, 0.0, 1.0), 0.0)


class Acc:
    def __init__(self):
        self.V = []
        self.F = []
        self.FM = []
        self.UV = []
        self.MK = []
        self.mats = []

    def _mi(self, m):
        for i, x in enumerate(self.mats):
            if x == m:
                return i
        self.mats.append(m)
        return len(self.mats) - 1

    def poly(self, pts, uvs, mat, mk=(0.0, 0.35, 0.92), want=None):
        n, area = newell(pts)
        if area < 1e-7:
            return
        pts = [tuple(p) for p in pts]
        uvs = list(uvs)
        mks = [mk(p, n) for p in pts] if callable(mk) else ([tuple(mk)] * len(pts))
        if want is not None and n[0] * want[0] + n[1] * want[1] + n[2] * want[2] < 0:
            pts.reverse()
            uvs.reverse()
            mks.reverse()
        b = len(self.V)
        self.V.extend(pts)
        self.MK.extend(mks)
        self.F.append(tuple(range(b, b + len(pts))))
        self.FM.append(self._mi(mat))
        self.UV.append(uvs)

    def box(self, c0, c1, mat, mk=(0.0, 0.35, 0.92), faces='xXyYzZ', M=None):
        x0, y0, z0 = c0
        x1, y1, z1 = c1
        q = {
            'x': ([(x0, y1, z0), (x0, y0, z0), (x0, y0, z1), (x0, y1, z1)], (-1, 0, 0), lambda p: (p[1], p[2])),
            'X': ([(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)], (1, 0, 0), lambda p: (p[1], p[2])),
            'y': ([(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)], (0, -1, 0), lambda p: (p[0], p[2])),
            'Y': ([(x1, y1, z0), (x0, y1, z0), (x0, y1, z1), (x1, y1, z1)], (0, 1, 0), lambda p: (p[0], p[2])),
            'z': ([(x0, y1, z0), (x1, y1, z0), (x1, y0, z0), (x0, y0, z0)], (0, 0, -1), lambda p: (p[0], p[1])),
            'Z': ([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], (0, 0, 1), lambda p: (p[0], p[1])),
        }
        for f in faces:
            pts, nrm, uvf = q[f]
            uv = [uvf(p) for p in pts]
            if M is not None:
                pts = [tuple(M @ Vector(p)) for p in pts]
                nrm = tuple((M.to_3x3() @ Vector(nrm)).normalized())
            self.poly(pts, uv, mat, mk, nrm)

    def cyl(self, p0, p1, r0, r1, sides, mat, mk=(0.0, 0.35, 0.92), caps=(True, True), v_norm=False):
        p0 = Vector(p0)
        p1 = Vector(p1)
        ax = p1 - p0
        L = ax.length
        if L < 1e-6:
            return
        ax.normalize()
        ref = Vector((0, 0, 1)) if abs(ax.z) < 0.9 else Vector((1, 0, 0))
        e1 = ax.cross(ref).normalized()
        e2 = ax.cross(e1).normalized()
        ring = lambda c, r, k: c + (e1 * math.cos(2 * math.pi * k / sides) + e2 * math.sin(2 * math.pi * k / sides)) * r
        v_end = 1.0 if v_norm else L
        for k in range(sides):
            a = ring(p0, r0, k)
            b = ring(p0, r0, k + 1)
            c = ring(p1, r1, k + 1)
            d = ring(p1, r1, k)
            u0 = k / sides
            u1 = (k + 1) / sides
            mid = (a + b + c + d) / 4 - (p0 + p1) / 2
            self.poly([a, b, c, d], [(u0, 0.0), (u1, 0.0), (u1, v_end), (u0, v_end)], mat, mk, tuple(mid))
        for cap, c, r, s in ((caps[0], p0, r0, -1), (caps[1], p1, r1, 1)):
            if cap and r > 1e-5:
                pts = [ring(c, r, k) for k in range(sides)]
                self.poly(pts, [(0, 0)] * sides, mat, mk, tuple(ax * s))

    def to_mesh(self, name, weld=False, smooth=False, sharp=None):
        me = bpy.data.meshes.get(name)
        if me is not None and me.users == 0:
            bpy.data.meshes.remove(me)
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.V, [], self.F)
        for m in self.mats:
            me.materials.append(m)
        if self.mats:
            me.polygons.foreach_set('material_index', self.FM)
        lib.set_uv(me, 'UVMap', None, per_loop=[uv for f in self.UV for uv in f])
        lib.write_mask_values(me, self.MK)
        if weld:
            bm = bmesh.new()
            bm.from_mesh(me)
            bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
            bm.to_mesh(me)
            bm.free()
        if smooth:
            me.shade_smooth()
            if sharp is not None:
                me.set_sharp_from_angle(angle=math.radians(sharp))
        me[TAG] = 1
        return me

    def to_obj(self, name, c, surface='metal', night=False, **kw):
        me = self.to_mesh(name, **kw)
        o = bpy.data.objects.new(name, me)
        c.objects.link(o)
        lib.tag(o, surface, nw_vmask=1.0)
        if night:
            o['nw_night'] = 1
        return o


def place(name, me, c, loc, rz=0.0, s=1.0, surface='metal', night=False):
    o = bpy.data.objects.new(name, me)
    o.location = loc
    o.rotation_euler = (0.0, 0.0, rz)
    o.scale = (s, s, s) if isinstance(s, (int, float)) else tuple(s)
    c.objects.link(o)
    lib.tag(o, surface, nw_vmask=1.0)
    if night:
        o['nw_night'] = 1
    return o


# ═════════════════════════════ 재질 생성 ═════════════════════════════
def _mat_flat(name, hexcol, rough=0.45, metal=0.8, surface='metal', alpha=1.0):
    _guard(name)
    M = lib.Mat(name)
    M.finish(srgb(hexcol), rough, M.geo.outputs['Normal'], metallic=metal)
    M.bsdf.inputs['Alpha'].default_value = alpha
    if alpha < 1.0:
        M.m.surface_render_method = 'BLENDED'
    M.m['nw_surface'] = surface
    M.m[TAG] = 1
    return M.m


def _mat_emit(name, hexcol, day_s, night_s, surface='emissive', alpha=1.0, holo=False):
    _guard(name)
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    m.node_tree.nodes.clear()
    b = lib.NB(m.node_tree)
    out = b.node('ShaderNodeOutputMaterial')
    bsdf = b.node('ShaderNodeBsdfPrincipled')
    b.L.new(bsdf.outputs[0], out.inputs['Surface'])
    col = srgb(hexcol)
    bsdf.inputs['Base Color'].default_value = col
    bsdf.inputs['Roughness'].default_value = 0.22
    bsdf.inputs['Emission Color'].default_value = col
    b.put(bsdf.inputs['Emission Strength'], lib.emit_strength(b, day_s, night_s))
    bsdf.inputs['Alpha'].default_value = alpha
    if holo or alpha < 1.0:
        m.surface_render_method = 'BLENDED'
        m.use_backface_culling = False
    m['nw_surface'] = 'holo' if holo else surface
    m[TAG] = 1
    lib.emit_meta(m, hexcol, None, day_s, night_s, additive=holo)
    return m


def _mat_holo(name, hexcol, day_s, night_s, falloff='v'):
    """가산 투명 홀로그램/서치라이트 재질: Transparent + Emission + AddShader + LayerWeight 윤곽 감쇠."""
    _guard(name)
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    m.node_tree.nodes.clear()
    b = lib.NB(m.node_tree)
    out = b.node('ShaderNodeOutputMaterial')
    tr = b.node('ShaderNodeBsdfTransparent')
    em = b.node('ShaderNodeEmission')
    add = b.node('ShaderNodeAddShader')
    b.L.new(tr.outputs[0], add.inputs[0])
    b.L.new(em.outputs[0], add.inputs[1])
    b.L.new(add.outputs[0], out.inputs['Surface'])
    uv = b.node('ShaderNodeUVMap', uv_map='UVMap')
    lw = b.node('ShaderNodeLayerWeight')
    lw.inputs['Blend'].default_value = 0.35
    face = b.sub(1.0, lw.outputs['Facing'])
    strength = lib.emit_strength(b, day_s, night_s)
    em.inputs['Color'].default_value = srgb(hexcol)
    if falloff == 'v':
        _, v, _ = b.sepxyz(uv.outputs['UV'])
        fade = b.math('POWER', b.sub(1.0, v, clamp=True), 1.65)
        k = b.mul(b.mul(fade, face), strength)
        b.L.new(k, em.inputs['Strength'])
    else:
        b.L.new(b.mul(strength, b.add(0.25, b.mul(face, 0.75))), em.inputs['Strength'])
    m.surface_render_method = 'BLENDED'
    m.use_backface_culling = False
    try:
        m.use_transparency_overlap = True
    except AttributeError:
        pass
    m['nw_surface'] = 'holo'
    m[TAG] = 1
    lib.emit_meta(m, hexcol, None, day_s, night_s, additive=True, fade=falloff)
    return m


def materials():
    M = {}
    M['alu_dark'] = _mat_flat('NWF_alu_dark', '#2A2D31', rough=0.38, metal=0.85, surface='metal')
    M['scaffold'] = _mat_flat('NWF_steel_scaffold', '#6B6E70', rough=0.52, metal=0.88, surface='metal')
    M['black'] = _mat_flat('NWF_black', '#121416', rough=0.58, metal=0.25, surface='metal')
    M['pearl'] = _mat_flat('NWF_pearl', '#C9CDD0', rough=0.34, metal=0.20, surface='metal')
    # DS 시그니처 #12: 작은 면적의 고채도 주황 포인트 (#D4820F)
    M['orange'] = _mat_flat('NWF_cargo_orange', '#D4820F', rough=0.42, metal=0.25, surface='metal')
    M['led_blue'] = _mat_emit('NWF_led_blue', '#3E8AD0', 1.8, 7.5, surface='emissive')
    M['led_teal'] = _mat_emit('NWF_led_teal', '#43ABA7', 1.8, 7.5, surface='emissive')
    M['led_amber'] = _mat_emit('NWF_led_amber', '#F2A83B', 1.4, 5.5, surface='emissive')
    M['holo'] = _mat_holo('NWF_holo_cyan', '#53C8D9', 1.2, 4.2, falloff='ring')
    M['beam'] = _mat_holo('NWF_beam_cone', '#DDEBFF', 0.08, 0.95, falloff='v')
    return M


# ═════════════════════════════ 1) 개척 트러스 교량 2개 ═════════════════════════════
def _build_truss_bridge(acc, led_acc, p0, p1, width, deck_z, M):
    """p0 → p1 직선형 DS 스타일 강재 트러스 교량 + 측면 청색/청록 안전 유도 LED."""
    a = Vector((p0[0], p0[1], deck_z))
    b = Vector((p1[0], p1[1], deck_z))
    d = b - a
    L = d.length
    ang = math.atan2(d.y, d.x)
    hw = width * 0.5
    n_bays = max(4, int(round(L / 4.2)))
    bay_l = L / n_bays
    truss_h = 1.35

    Xform = Matrix.Translation(a) @ Matrix.Rotation(ang, 4, 'Z')

    # 상판 데크 및 하부 거더
    acc.box((0.0, -hw, -0.22), (L, hw, 0.0), M['alu_dark'], (0.15, 0.55, 0.82), M=Xform)
    acc.box((0.0, -hw + 0.25, 0.0), (L, hw - 0.25, 0.04), M['scaffold'], (0.1, 0.6, 0.88), M=Xform)

    # 양끝 교대(abutment) 및 주황색 경고 띠
    for x_ab in (0.0, L - 0.8):
        acc.box((x_ab, -hw - 0.2, -1.8), (x_ab + 0.8, hw + 0.2, 0.12), M['alu_dark'], (0.35, 0.75, 0.65), M=Xform)
        acc.box((x_ab + 0.1, -hw - 0.22, 0.12), (x_ab + 0.7, -hw + 0.15, 0.42), M['orange'], (0.0, 0.3, 0.95), M=Xform)
        acc.box((x_ab + 0.1, hw - 0.15, 0.12), (x_ab + 0.7, hw + 0.22, 0.42), M['orange'], (0.0, 0.3, 0.95), M=Xform)

    # 양측 트러스 난간 (수직재 + 상현재 + 사재)
    for sy in (-1, 1):
        y_rail = sy * (hw - 0.12)
        # 상현재
        acc.box((0.0, y_rail - 0.06, truss_h - 0.08), (L, y_rail + 0.06, truss_h), M['alu_dark'], M=Xform)
        # 측면 청색 유도 LED 라인
        led_acc.box((0.2, y_rail - 0.03, 0.14), (L - 0.2, y_rail + 0.03, 0.20), M['led_blue'], M=Xform)
        for i in range(n_bays + 1):
            x = i * bay_l
            acc.box((x - 0.06, y_rail - 0.06, 0.0), (x + 0.06, y_rail + 0.06, truss_h), M['alu_dark'], M=Xform)
            if i < n_bays:
                p_bot = Xform @ Vector((x, y_rail, 0.05))
                p_top = Xform @ Vector((x + bay_l, y_rail, truss_h - 0.05))
                acc.cyl(p_bot, p_top, 0.035, 0.035, 6, M['scaffold'])


def build_bridges(C, M):
    acc = Acc()
    led_acc = Acc()
    # 교량 1: HAUS 동측 전정 ~ 개울 본류 ~ FaceArch 서측을 잇는 보행·화물 트러스 교량
    _build_truss_bridge(acc, led_acc, (29.0, 6.0), (62.0, 11.0), 3.6, 0.45, M)
    # 교량 2: 북측 상류 갈래 개울과 웅덩이를 건너는 상류 개척 트러스 교량
    _build_truss_bridge(acc, led_acc, (31.0, 31.0), (61.0, 34.0), 4.0, 0.52, M)
    acc.to_obj('FU_bridge_struct', C, surface='metal', smooth=False)
    led_acc.to_obj('FU_bridge_led', C, surface='emissive', night=True, smooth=False)

    # 북측 산악 고가 하부 청색 안전 유도 LED 라인 (SLOT_viaduct_led 연동)
    slot = bpy.data.objects.get('SLOT_viaduct_led')
    vy = slot.location.y if slot else 149.3
    vz = slot.location.z if slot else 23.9
    v_housing = Acc()
    v_led = Acc()
    v_housing.box((-112.0, vy - 0.14, vz - 0.04), (162.0, vy + 0.14, vz + 0.12), M['alu_dark'], (0.15, 0.45, 0.85))
    v_led.box((-112.0, vy - 0.08, vz - 0.10), (162.0, vy + 0.08, vz - 0.03), M['led_blue'], (0.0, 0.2, 1.0))
    # 남측 개척로 횡단보도(x = -14.0) 매립 청록 유도 LED 바
    for cx in (-16.8, -11.2):
        v_housing.box((cx - 0.12, -49.2, -0.14), (cx + 0.12, -35.8, -0.095), M['alu_dark'])
        v_led.box((cx - 0.06, -49.0, -0.10), (cx + 0.06, -36.0, -0.082), M['led_teal'], (0.0, 0.2, 1.0))
    v_housing.to_obj('FU_viaduct_housing', C, surface='metal', smooth=False)
    v_led.to_obj('FU_viaduct_led', C, surface='emissive', night=True, smooth=False)


# ═════════════════════════════ 2) 카이랄/통신 비콘 기둥 & 화물 포드 ═════════════════════════════
def beacon_proto(M):
    """DS 스타일 수직 통신/유도 비콘 기둥 (높이 5.2 m, 하단 주황 포인트 + 상단 청록 발광 링)."""
    acc = Acc()
    # 삼각 받침대 & 하부 주황 칼라
    acc.cyl((0, 0, -0.25), (0, 0, 0.45), 0.28, 0.22, 6, M['alu_dark'], (0.3, 0.65, 0.7))
    acc.cyl((0, 0, 0.45), (0, 0, 0.78), 0.22, 0.19, 6, M['orange'], (0.05, 0.35, 0.92))
    # 주 마스트
    acc.cyl((0, 0, 0.78), (0, 0, 4.35), 0.13, 0.08, 6, M['alu_dark'], (0.0, 0.3, 0.95))
    # 상단 센서 핀 3개
    for k in range(3):
        a = 2.0 * math.pi * k / 3.0
        dx, dy = math.cos(a), math.sin(a)
        acc.box((dx * 0.08 - 0.02, dy * 0.08 - 0.02, 3.6), (dx * 0.26 + 0.02, dy * 0.26 + 0.02, 4.85), M['scaffold'])
    # 상단 청록 발광 비콘 코어
    acc.cyl((0, 0, 4.35), (0, 0, 5.15), 0.095, 0.075, 8, M['led_teal'], (0.0, 0.1, 1.0))
    return acc.to_mesh('FU_beacon_proto', smooth=True, sharp=42)


def cargo_pod_proto(M):
    """방수 화물 보관 포드 + 주황색 보호 프레임 + 상태 표시 LED."""
    acc = Acc()
    acc.box((-0.65, -0.48, -0.05), (0.65, 0.48, 0.12), M['alu_dark'], (0.25, 0.6, 0.7))
    acc.box((-0.58, -0.42, 0.12), (0.58, 0.42, 0.92), M['pearl'], (0.05, 0.35, 0.92))
    acc.box((-0.60, -0.44, 0.68), (0.60, 0.44, 0.84), M['orange'], (0.0, 0.25, 0.95))
    acc.box((-0.25, -0.45, 0.48), (0.25, -0.43, 0.62), M['led_amber'], (0.0, 0.1, 1.0))
    return acc.to_mesh('FU_cargo_pod_proto', smooth=False)


def build_beacons_and_pods(C, M, GZ):
    b_me = beacon_proto(M)
    p_me = cargo_pod_proto(M)

    beacon_spots = [
        (-86.0, -35.2), (-48.0, -35.0), (-22.0, -33.0), (24.0, -31.0),
        (33.0, -18.0), (66.0, -18.0), (86.0, -2.0),
        (28.0, 8.0), (63.0, 13.0), (44.0, 38.0), (-16.0, 58.0), (74.0, 48.0),
    ]
    for i, (x, y) in enumerate(beacon_spots):
        z = GZ.z(x, y)
        place(f'FU_beacon.{i:03d}', b_me, C, (x, y, z), i * 0.55, 1.0, surface='emissive', night=True)

    pod_spots = [
        (-21.0, -26.8, 0.0), (21.5, -26.8, 0.15), (27.5, 2.5, -0.4),
        (94.0, 4.5, 0.45), (96.2, 6.2, -1.1), (-50.0, -35.0, 0.2),
    ]
    for i, (x, y, rz) in enumerate(pod_spots):
        z = GZ.z(x, y)
        place(f'FU_pod.{i:03d}', p_me, C, (x, y, z), rz, 1.0, surface='metal', night=True)


# ═════════════════════════════ 3) 기상·지형 홀로그램 스캐너 ═════════════════════════════
def build_holo_scanner(C, M, GZ):
    x, y = 26.5, -18.5
    z = GZ.z(x, y)
    base_acc = Acc()
    base_acc.cyl((x, y, z - 0.1), (x, y, z + 1.15), 0.36, 0.28, 8, M['alu_dark'])
    base_acc.cyl((x, y, z + 1.15), (x, y, z + 1.28), 0.30, 0.34, 8, M['led_teal'])
    base_acc.to_obj('FU_scanner_base', C, surface='metal', night=True, smooth=True, sharp=40)

    holo_acc = Acc()
    # 산악 등고선 형태를 투영하는 반투명 홀로그램 링·패널 (surface='holo')
    for k, (rz_h, rad) in enumerate(((1.55, 1.35), (2.05, 1.05), (2.55, 0.72))):
        pts = [
            (x + rad * math.cos(2 * math.pi * i / 12), y + rad * math.sin(2 * math.pi * i / 12), z + rz_h + 0.18 * math.sin(i * 1.5))
            for i in range(12)
        ]
        for i in range(12):
            p0 = pts[i]
            p1 = pts[(i + 1) % 12]
            holo_acc.poly(
                [p0, p1, (p1[0], p1[1], p1[2] + 0.28), (p0[0], p0[1], p0[2] + 0.28)],
                [(i / 12, 0), ((i + 1) / 12, 0), ((i + 1) / 12, 1), (i / 12, 1)],
                M['holo'],
            )
    holo_acc.to_obj('FU_holo_ad', C, surface='holo', night=True)


# ═════════════════════════════ 4) 산악 순찰·배송 드론 4기 ═════════════════════════════
def build_drones(C, M):
    # 보안/정찰 드론 (FU_drone_sec + 서치라이트 원뿔 FU_drone_sec_beam)
    p_sec = DRONE_PATHS['sec'][0]
    sec = Acc()
    sec.cyl((0, 0, -0.18), (0, 0, 0.22), 0.72, 0.55, 8, M['alu_dark'])
    sec.cyl((0, 0, -0.26), (0, 0, -0.16), 0.32, 0.24, 8, M['led_blue'])
    for k in range(4):
        a = math.pi * 0.25 + k * math.pi * 0.5
        rx, ry = math.cos(a) * 1.15, math.sin(a) * 1.15
        sec.box((rx * 0.3 - 0.06, ry * 0.3 - 0.06, 0.0), (rx + 0.06, ry + 0.06, 0.08), M['scaffold'])
        sec.cyl((rx, ry, -0.04), (rx, ry, 0.14), 0.42, 0.42, 10, M['black'], caps=(False, False))
    o_sec = sec.to_obj('FU_drone_sec', C, surface='metal', night=True, smooth=True, sharp=42)
    o_sec.location = p_sec

    beam = Acc()
    aim = Vector(BEAM_AIM) - Vector(p_sec)
    beam.cyl((0, 0, -0.2), tuple(aim), 0.18, 2.8, 16, M['beam'], caps=(False, False), v_norm=True)
    o_beam = beam.to_obj('FU_drone_sec_beam', C, surface='holo', night=True, smooth=True)
    o_beam.location = p_sec

    # 화물 배송 드론 3기 (FU_drone_del.0..2, 주황 화물 컨테이너 탑재)
    del_acc = Acc()
    del_acc.box((-0.55, -0.45, 0.0), (0.55, 0.45, 0.24), M['alu_dark'])
    del_acc.box((-0.42, -0.34, -0.42), (0.42, 0.34, 0.0), M['orange'])
    del_acc.box((-0.44, -0.36, -0.24), (0.44, 0.36, -0.16), M['led_teal'])
    for sx in (-0.85, 0.85):
        for sy in (-0.75, 0.75):
            del_acc.cyl((sx, sy, 0.05), (sx, sy, 0.18), 0.34, 0.34, 8, M['black'], caps=(False, False))
    del_me = del_acc.to_mesh('FU_drone_del_proto', smooth=True, sharp=42)

    for i, did in enumerate(('d1', 'd2', 'd3')):
        place(f'FU_drone_del.{i}', del_me, C, DRONE_PATHS[did][0], 0.0, 1.0, surface='metal', night=True)

    # 경로 빈 객체 (export.py 가 layout.json 으로 내보낸다)
    for did, pts in DRONE_PATHS.items():
        for k, pt in enumerate(pts):
            nm = f'PATH_drone_{did}_{k}'
            e = bpy.data.objects.get(nm)
            if e is None:
                e = bpy.data.objects.new(nm, None)
            if e.name not in C.objects:
                C.objects.link(e)
            e.empty_display_type = 'PLAIN_AXES'
            e.empty_display_size = 1.2
            e.location = pt
            e['nw_drone'] = did
            e['nw_index'] = k
            e['nw_speed'] = DRONE_SPEED[did]


# ═════════════════════════════ 앵커 6개 & 야간 카메라·조명 ═════════════════════════════
FUTURE_ANCHORS = [
    ('viaduct_led', 'future', '개척 트러스 교량과 도하 유도광', (45.5, 8.5, 1.6)),
    ('rooftop_screen', 'future', '카이랄 통신 비콘 — 능선 중계망', (44.0, 38.0, 4.8)),
    ('smart_crossing', 'future', '상류 도하 교량 — 침수 방지 데크', (46.0, 32.5, 1.6)),
    ('bus_shelter', 'future', '기상·타임폴 홀로그램 스캐너', (26.5, -18.5, 2.2)),
    ('auto_taxi', 'future', '방수 화물 포드 — 주황 고채도 마커', (21.5, -26.8, 0.9)),
    ('patrol_drone', 'future', '산악 협곡 순찰·화물 드론 편대', (36.0, 18.0, 18.0)),
]


def build_anchors_and_night(sc):
    A = lib.coll('NW_anchors', sc)
    for aid, layer, title, pos in FUTURE_ANCHORS:
        nm = f'ANCHOR_{aid}'
        old = bpy.data.objects.get(nm)
        if old is not None:
            bpy.data.objects.remove(old, do_unlink=True)
        e = bpy.data.objects.new(nm, None)
        e.empty_display_type = 'SPHERE'
        e.empty_display_size = 1.5
        e.location = pos
        e['nw_layer'] = layer
        e['nw_title'] = title
        A.objects.link(e)

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
    d = Vector(tgt) - Vector(loc)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = lens
    cam.data.sensor_width = 36.0
    cam.data.clip_start = 0.1
    cam.data.clip_end = 8000.0
    cam['target'] = list(tgt)

    # 밤 렌더 전용 포인트 라이트 (내보내지 않음)
    nc = lib.coll(lib.NIGHT_COLL, sc)
    lib.clear_coll(nc)
    night_lights = [
        ('FX_night_bridge', (45.0, 8.5, 3.2), '#3E8AD0', 260.0, 22.0),
        ('FX_night_road_br', (50.0, -28.0, 3.0), '#43ABA7', 220.0, 22.0),
        ('FX_night_crossing', (-14.0, -42.5, 2.2), '#43ABA7', 160.0, 16.0),
        ('FX_night_scanner', (26.5, -18.5, 2.8), '#53C8D9', 140.0, 14.0),
        ('FX_night_haus_front', (0.0, -28.0, 6.0), '#FFA852', 460.0, 34.0),
        ('FX_night_haus_east', (26.0, 0.0, 14.0), '#FFB86B', 380.0, 30.0),
        ('FX_night_haus_crown', (0.0, -18.0, 58.0), '#FFD29E', 680.0, 48.0),
        ('FX_night_facearch', (98.0, 12.0, 14.0), '#CFE6FF', 360.0, 30.0),
        ('FX_night_viaduct_w', (-30.0, 148.5, 22.5), '#3E8AD0', 280.0, 28.0),
        ('FX_night_viaduct_e', (35.0, 148.5, 22.5), '#3E8AD0', 280.0, 28.0),
    ]
    # 가로등(PR_light.*) 위치마다 따뜻한 나트륨/LED 가로등 포인트 라이트 추가
    P = bpy.data.collections.get('NW_present')
    if P is not None:
        for o in P.all_objects:
            if o.name.startswith('PR_light.'):
                lx, ly, lz = o.location
                night_lights.append((f'FX_{o.name}', (lx, ly, lz + 7.2), '#FFBA6A', 190.0, 20.0))

    for lnm, lpos, lhex, power, dist in night_lights:
        ld = bpy.data.lights.get(lnm) or bpy.data.lights.new(lnm, 'POINT')
        ld.energy = power
        ld.color = srgb(lhex)[:3]
        ld.shadow_soft_size = 2.2
        if hasattr(ld, 'use_custom_distance'):
            ld.use_custom_distance = True
            ld.cutoff_distance = dist
        lo = bpy.data.objects.new(lnm, ld)
        lo.location = lpos
        nc.objects.link(lo)
    nc.hide_render = True
    nc.hide_viewport = True


def render_views(suffix='', res=(1280, 720), samples=32):
    sc = lib.get_scene(False)
    out = os.path.join(lib.OUT, 'renders')
    os.makedirs(out, exist_ok=True)
    lib.apply_mood(sc, 'overcast', bake=False)
    for k in ('street', 'viaduct', 'lot', 'aerial'):
        cam = bpy.data.objects.get(f'CAM_{k}')
        if cam is not None:
            lib.render(sc, cam, os.path.join(out, f'ds2-t4-{k}{suffix}.png'), res=res, samples=samples)
    cam_n = bpy.data.objects.get('CAM_night')
    if cam_n is not None:
        lib.apply_mood(sc, 'night', bake=False)
        lib.render(sc, cam_n, os.path.join(out, f'ds2-t4-night{suffix}.png'), res=res, samples=samples)
        lib.apply_mood(sc, 'overcast', bake=False)


def build(reset=False, render_previews=False):
    t0 = time.time()
    sc = lib.get_scene(True)
    import ds2_present
    importlib.reload(ds2_present)
    if bpy.data.objects.get('PR_static_NW_basalt') is None:
        ds2_present.build()
    GZ = ds2_present.GroundZ()
    C = lib.coll('NW_future', sc)
    lib.clear_coll(C)
    M = materials()
    build_bridges(C, M)
    build_beacons_and_pods(C, M, GZ)
    build_holo_scanner(C, M, GZ)
    build_drones(C, M)
    build_anchors_and_night(sc)
    print(f'[ds2_future] built in {round(time.time() - t0, 1)} s, tris={lib.tri_count(C.all_objects)}')
    if render_previews:
        render_views()
    return C


if __name__ == '__main__':
    build()
