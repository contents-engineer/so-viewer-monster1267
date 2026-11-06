# HAUS NOWHERE — 데스 스트랜딩 2 산악 지형 (ver=ds2) / Task 3: 산악 절벽 · 계곡 자연 포켓 · 산악 고가교 · 가공 송전선 · 전초기지 (NW_present).
# 실행: MCP(포트 9876)에서 exec(open('<ROOT>/tools/nowhere/blender/ds2_present.py').read(), {'__name__': '__main__'})
# 매 실행마다 NW_present · NW_anchors · NW_slots_present 를 비우고 처음부터 다시 만든다(멱등).
#
# 성수 2041(present.py)의 정밀 구조(GroundZ 실제 메시 샘플러, Poly Haven 스캔 에셋 Decimate & nw_tex 기록,
# lib.Mat 다중 노이즈 PBR + _streaks + _base_grime, 3단 스케일 바위·잡초 배치, PR_static_<재질> 병합)를
# 그대로 계승하면서, 배경을 데스 스트랜딩 2 스타일의 주상절리 현무암 대절벽·올리브 이끼 산악 계곡·산악 콘크리트 고가교·전초기지로 구축한다.
import bpy, bmesh, os, sys, math, random, importlib, time, re, json, zlib
from mathutils import Vector, Matrix, Euler

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

G = ground
GEN = os.path.join(lib.OUT, 'gen')
TAG = 'nw_present_src'
MATS = {}
STATIC = None

# ═════════════════════════════ 배치 상수 (Blender Z-up m) ═════════════════════════════
VIA_Y0, VIA_Y1 = 150.0, 160.0            # 북쪽 협곡을 가로지르는 산악 콘크리트 고가교(폭 10 m)
VIA_SPAN, VIA_PIER = 22.0, 2.4           # 경간 22 m, 교각 폭 2.4 m
VIA_PIERS = [-130.0 + VIA_SPAN * k for k in range(14)]
VIA_SPRING, VIA_CROWN = 5.4, 7.5
DECK_B, DECK_T = 7.9, 9.0
STATION = (24.0, 90.0)
# CAM_viaduct: 북쪽 산악 고가교 아치 아래에서 현무암 대절벽과 갈래 시냇물 계곡 너머 HAUS 타워를 바라보는 구도
CAM_VIA = ((32.5, 148.2, 19.2), (8.0, 0.0, 26.5), 21.0)


# ═════════════════════════════ 기하/누적기 도우미 (present.py 동일 규약) ═════════════════════════════
def newell(pts):
    nx = ny = nz = 0.0
    k = len(pts)
    for i in range(k):
        x1, y1, z1 = pts[i]; x2, y2, z2 = pts[(i + 1) % k]
        nx += (y1 - y2) * (z1 + z2); ny += (z1 - z2) * (x1 + x2); nz += (x1 - x2) * (y1 + y2)
    L = math.sqrt(nx * nx + ny * ny + nz * nz)
    if L < 1e-12:
        return (0.0, 0.0, 1.0), 0.0
    return (nx / L, ny / L, nz / L), 0.5 * L


def h01(*a):
    return random.Random(zlib.crc32(repr(a).encode('utf-8'))).random()


class Acc:
    def __init__(self):
        self.V = []; self.F = []; self.FM = []; self.UV = []; self.MK = []; self.TN = []; self.mats = []
        self.tint = (0.0, 0.0)

    def _mi(self, m):
        for i, x in enumerate(self.mats):
            if x == m:
                return i
        self.mats.append(m)
        return len(self.mats) - 1

    def poly(self, pts, uvs, mat, mk, want=None):
        n, area = newell(pts)
        if area < 1e-7:
            return
        pts = [tuple(p) for p in pts]; uvs = list(uvs)
        if callable(mk):
            mks = [mk(p, n) for p in pts]
        elif isinstance(mk[0], (tuple, list)):
            mks = list(mk)
        else:
            mks = [tuple(mk)] * len(pts)
        if want is not None and n[0] * want[0] + n[1] * want[1] + n[2] * want[2] < 0:
            pts.reverse(); uvs.reverse(); mks.reverse()
        base = len(self.V)
        self.V.extend(pts); self.MK.extend(mks); self.TN.extend([self.tint] * len(pts))
        self.F.append(tuple(range(base, base + len(pts))))
        self.FM.append(self._mi(mat)); self.UV.append(uvs)

    def box(self, c0, c1, mat, mk, faces='xXyYzZ', uvs=1.0, M=None):
        x0, y0, z0 = c0; x1, y1, z1 = c1
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
            uv = [tuple(c * uvs for c in uvf(p)) for p in pts]
            if M is not None:
                pts = [tuple(M @ Vector(p)) for p in pts]
                nrm = tuple((M.to_3x3() @ Vector(nrm)).normalized())
            self.poly(pts, uv, mat, mk, nrm)

    def cyl(self, p0, p1, r0, r1, sides, mat, mk, caps=(True, True), a0=0.0, uv_v=1.0):
        p0 = Vector(p0); p1 = Vector(p1); ax = p1 - p0; L = ax.length
        if L < 1e-6:
            return
        ax.normalize()
        ref = Vector((0, 0, 1)) if abs(ax.z) < 0.9 else Vector((1, 0, 0))
        e1 = ax.cross(ref).normalized(); e2 = ax.cross(e1).normalized()
        ring = lambda c, r, k: c + (e1 * math.cos(a0 + 2 * math.pi * k / sides) + e2 * math.sin(a0 + 2 * math.pi * k / sides)) * r
        for k in range(sides):
            a = ring(p0, r0, k); b = ring(p0, r0, k + 1); c = ring(p1, r1, k + 1); d = ring(p1, r1, k)
            u0 = 2 * math.pi * r0 * k / sides; u1 = 2 * math.pi * r0 * (k + 1) / sides
            mid = (a + b + c + d) / 4 - (p0 + p1) / 2
            self.poly([a, b, c, d], [(u0, 0), (u1, 0), (u1, L * uv_v), (u0, L * uv_v)], mat, mk, tuple(mid))
        for cap, c, r, s in ((caps[0], p0, r0, -1), (caps[1], p1, r1, 1)):
            if cap and r > 1e-5:
                pts = [ring(c, r, k) for k in range(sides)]
                self.poly(pts, [((p - c).dot(e1), (p - c).dot(e2)) for p in pts], mat, mk, tuple(ax * s))

    def mesh(self, M, V, F, mat, mk, uvfn=None):
        for f in F:
            lp = [Vector(V[i]) for i in f]
            if uvfn is not None:
                uv = [uvfn(p) for p in lp]
            else:
                n, _ = newell([tuple(p) for p in lp]); ax = max(range(3), key=lambda i: abs(n[i]))
                uv = [((p.y, p.z) if ax == 0 else (p.x, p.z) if ax == 1 else (p.x, p.y)) for p in lp]
            self.poly([tuple(M @ p) for p in lp], uv, mat, mk)

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
        st = [m[3] if len(m) > 3 else 0.0 for m in self.MK]
        if any(v > 0.0 for v in st):
            lib.write_float_attr(me, 'nw_streak', st)
        if any(t != (0.0, 0.0) for t in self.TN):
            lib.write_float_attr(me, 'nw_tint', self.TN, 'FLOAT2')
        if weld:
            bm = bmesh.new(); bm.from_mesh(me)
            bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
            bm.to_mesh(me); bm.free()
        if smooth:
            me.shade_smooth()
            if sharp is not None:
                me.set_sharp_from_angle(angle=math.radians(sharp))
        me[TAG] = 1
        return me

    def to_obj(self, name, c, surface, **kw):
        me = self.to_mesh(name, **kw)
        o = bpy.data.objects.new(name, me); c.objects.link(o)
        lib.tag(o, surface, nw_vmask=1.0)
        return o

    def extend(self, other):
        base = len(self.V)
        self.V.extend(other.V); self.MK.extend(other.MK); self.TN.extend(other.TN); self.UV.extend(other.UV)
        self.F.extend(tuple(base + i for i in f) for f in other.F)
        self.FM.extend(self._mi(other.mats[k]) for k in other.FM)

    def split(self):
        out = {}
        for fi, f in enumerate(self.F):
            m = self.mats[self.FM[fi]]
            a = out.get(m)
            if a is None:
                a = out[m] = Acc()
            base = len(a.V)
            a.V.extend(self.V[i] for i in f); a.MK.extend(self.MK[i] for i in f); a.TN.extend(self.TN[i] for i in f)
            a.F.append(tuple(range(base, base + len(f)))); a.FM.append(a._mi(m)); a.UV.append(self.UV[fi])
        return out


def place(name, me, c, loc, rz=0.0, s=1.0, rx=0.0, ry=0.0, surface='metal'):
    o = bpy.data.objects.new(name, me)
    o.location = loc; o.rotation_euler = (rx, ry, rz)
    o.scale = (s, s, s) if isinstance(s, (int, float)) else tuple(s)
    c.objects.link(o)
    lib.tag(o, surface, nw_vmask=1.0)
    return o


class GroundZ:
    """NW_ground 의 실제 메시 위 높이(계곡 분지·전정·보도·대지·차도·광역 산악 지형 순서로 조회)."""

    def __init__(self):
        self.s = []
        for nm in ('GR_vacant', 'GR_forecourt', 'GR_sidewalk', 'GR_blocklot', 'GR_road', 'GR_terrain'):
            o = bpy.data.objects.get(nm)
            if o is None:
                continue
            me = o.data
            V = [tuple(o.matrix_world @ v.co) for v in me.vertices]
            T = [tuple(p.vertices) for p in me.polygons]
            self.s.append(lib.Sampler(V, T, 2.5))

    def z(self, x, y, default=None):
        for s in self.s:
            z = s.z(x, y)
            if z is not None:
                return z
        return G.terrain_z(x, y) if default is None else default


# ═════════════════════════════ 그려 만드는 텍스처 & 재질 (lib.Mat) ═════════════════════════════
def _hex(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def _put(buf, w, x, y, c, a=1.0):
    i = (y * w + x) * 4
    buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = a


def gen_image(name, w, h, painter):
    os.makedirs(GEN, exist_ok=True)
    path = os.path.join(GEN, name + '.png')
    buf = [0.0] * (w * h * 4)
    painter(buf, w, h)
    im = bpy.data.images.get(name)
    if im is not None and (im.size[0] != w or im.size[1] != h):
        bpy.data.images.remove(im); im = None
    if im is None:
        im = bpy.data.images.new(name, w, h, alpha=True)
    im.pixels.foreach_set(buf)
    im.filepath_raw = path; im.file_format = 'PNG'
    im.save()
    im.source = 'FILE'; im.filepath = path
    im.reload()
    im[TAG] = 1
    return im


def paint_window(buf, w, h):
    rnd = random.Random(11)
    frame = _hex('#7A7D7E'); mull = _hex('#55595B')
    for y in range(h):
        for x in range(w):
            fx = x / w; fy = y / h
            edge = min(fx, 1 - fx, fy, 1 - fy)
            if edge < 0.035:
                c = frame
            elif abs(fx - 0.5) < 0.018 or abs(fy - 1 / 3) < 0.016 or abs(fy - 2 / 3) < 0.016:
                c = mull
            else:
                g = 0.10 + 0.07 * fy + 0.05 * max(0.0, 1 - abs((fx + fy) - 1.1) * 3.0) + rnd.uniform(-0.01, 0.01)
                c = (g * 0.82, g * 0.95, g)
            _put(buf, w, x, y, c)


def paint_hazard(buf, w, h):
    rnd = random.Random(5)
    yel = _hex('#F2C200'); blk = _hex('#1A1A1A')
    for y in range(h):
        for x in range(w):
            s = ((x + y) * 4 // w) % 2
            c = yel if s == 0 else blk
            if rnd.random() < 0.05:
                k = rnd.uniform(0.55, 0.85); c = (c[0] * k, c[1] * k, c[2] * k)
            _put(buf, w, x, y, c)


def paint_weeds(buf, w, h):
    """DS2 고산 풀·사초 아틀라스: 왼쪽 반 = 황갈색 마른 산악 억새, 오른쪽 반 = 올리브·암록색 고산 사초."""
    rnd = random.Random(41)
    half = w // 2
    for y in range(h):
        for x in range(w):
            _put(buf, w, x, y, _hex('#8A7B50') if x < half else _hex('#4E5E2A'), 0.0)
    for side in (0, 1):
        pal = [_hex(c) for c in (('#9E8B58', '#B29E68', '#837248', '#BDA872', '#6E5F3B') if side == 0 else
                                 ('#4E5E2A', '#627335', '#768542', '#3D4B20', '#58682F'))]
        for k in range(34):
            x0 = side * half + half * rnd.uniform(0.40, 0.60); y0 = 0.0
            ang = math.radians(rnd.uniform(-48, 48)); L = h * rnd.uniform(0.42, 0.96)
            bend = rnd.uniform(-0.75, 0.75); col = pal[rnd.randrange(len(pal))]
            wd = rnd.uniform(0.8, 1.5)
            steps = int(L / 1.2)
            for i in range(steps):
                t = i / steps
                a = ang + bend * t * t
                x = x0 + math.sin(a) * L * t; y = y0 + math.cos(a) * L * t
                r = wd * (1 - 0.8 * t)
                for yy in range(int(y - r) - 1, int(y + r) + 2):
                    for xx in range(int(x - r) - 1, int(x + r) + 2):
                        if 0 <= xx < w and 0 <= yy < h and side * half <= xx < (side + 1) * half and (xx - x) ** 2 + (yy - y) ** 2 <= r * r + 0.3:
                            sh = 0.72 + 0.28 * t
                            _put(buf, w, xx, yy, tuple(c * sh for c in col))


PALETTE = [
    ['#E8E6DF', '#2F4F8F', '#B4372E', '#F0C52E', '#3A6E4B', '#1F2A33', '#C8C8C2', '#8E2B2B'],
    ['#FFFFFF', '#D93A2E', '#F2C200', '#1A1A1A', '#1E5BB8', '#2E8B57', '#F28C28', '#DADADA'],
    ['#2F5D46', '#7A2E25', '#24395E', '#8C8C84', '#C9A227', '#5B4636', '#E0DED6', '#3B3B3B'],
    ['#2A2B2D', '#9EA2A1', '#6B6E70', '#B9B6AC', '#E33739', '#53C8D9', '#FDD25B', '#43ABA7'],
    ['#D9DAD6', '#BFC3C1', '#384C61', '#8A3B32', '#26292C', '#A7A9A4', '#4A5D46', '#C8B79A'],
] + [['#808080'] * 8] * 3


def pal_uv(r, c):
    return ((c + 0.5) / 8.0, 1.0 - (r + 0.5) / 8.0)


def paint_palette(buf, w, h):
    for y in range(h):
        r = 7 - (y * 8) // h
        for x in range(w):
            _put(buf, w, x, y, _hex(PALETTE[r][(x * 8) // w]))


def _guard(name):
    m = bpy.data.materials.get(name)
    G_ = bpy.data.collections.get('NW_ground')
    if m is not None and G_ is not None and any(m in [s.material for s in o.material_slots] for o in G_.all_objects if o.type == 'MESH'):
        raise RuntimeError(f'재질 이름 {name} 은 NW_ground 가 쓰는 재질이다 — 다른 이름을 쓴다')


def _streaks(M, color, amount, dark=(0.34, 0.31, 0.29, 1.0)):
    b = M.b
    attr = b.node('ShaderNodeAttribute', attribute_type='GEOMETRY', attribute_name='nw_streak')
    u = b.node('ShaderNodeUVMap', uv_map='UVMap')
    mp = b.node('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (2.4, 0.07, 1.0)
    b.L.new(u.outputs['UV'], mp.inputs['Vector'])
    mp2 = b.node('ShaderNodeMapping'); mp2.inputs['Scale'].default_value = (9.0, 0.55, 1.0)
    b.L.new(u.outputs['UV'], mp2.inputs['Vector'])
    s = b.smooth(0.44, 0.6, b.noise(mp.outputs['Vector'], 1.0, 3.0, 0.55))
    s = b.mul(s, b.remap(b.noise(mp2.outputs['Vector'], 1.0, 2.0, 0.5), 0.35, 0.65, 0.5, 1.0))
    f = b.mul(b.mul(s, attr.outputs['Fac']), amount)
    return b.col(f, color, b.col(1.0, color, dark, 'MULTIPLY'))


def _base_grime(M, color, soil='#2E2A22', amount=0.75):
    b = M.b
    attr = b.node('ShaderNodeAttribute', attribute_type='GEOMETRY', attribute_name='nw_mask')
    _, _, ao = b.sep(attr.outputs['Color'])
    jag = b.remap(b.noise(M.pos, 3.2, 3.0, 0.6), 0.3, 0.7, -0.12, 0.12)
    g = b.sub(1.0, b.smooth(0.3, 0.8, b.add(ao, jag)))
    return b.col(b.mul(g, amount), color, srgb(soil))


def mat_tex(name, tid, size, tint=None, sat=1.0, gain=1.0, res='2k', normal=1.0, base_wet=0.28, moss_bias=0.0,
            crevice_moss=2.5, porosity=0.5, wet_gloss=0.6, streak=0.0, rot=0.0, micro=0.0, surface='wall', var=0.16,
            streak_col=(0.34, 0.31, 0.29, 1.0)):
    _guard(name)
    M = lib.Mat(name); b = M.b
    vec = M.uv(size, rot=rot)
    t = M.texset(tid, vec, res, False, normal)
    nrm = M.micro(t['normal'], tid, size / 6.0, micro, res) if micro > 0 else t['normal']
    c = M.grade(t['color'], sat, tint, gain)
    c = M.macro_var(c, var, 0.07)
    if streak > 0:
        c = _streaks(M, c, streak, streak_col)
        c = _base_grime(M, c)
    mk = M.mask(base_wet, moss_bias, -1.0)
    s = M.surface(c, t['rough'], nrm, t['height'], mk, crevice_moss, 0.8, porosity, wet_gloss)
    m = M.finish(s.outputs['Color'], s.outputs['Roughness'], s.outputs['Normal'])
    m['nw_surface'] = surface
    m[TAG] = 1
    return m


def mat_flat(name, hexcol, rough=0.6, metal=0.0, var=0.12, surface='metal', base_wet=0.25, porosity=0.3, wet_gloss=0.5,
             crevice_moss=0.0, nscale=0.8, streak=0.0):
    _guard(name)
    M = lib.Mat(name); b = M.b
    n = b.noise(M.pos, nscale, 3.0, 0.6)
    base = srgb(hexcol)
    lo = tuple(v * (1 - var) for v in base[:3]) + (1.0,); hi = tuple(v * (1 + var * 0.7) for v in base[:3]) + (1.0,)
    c = b.col(b.smooth(0.3, 0.7, n), lo, hi)
    if streak > 0:
        c = _streaks(M, c, streak)
    r = b.remap(b.noise(M.pos, nscale * 3.1, 2.0, 0.5), 0.3, 0.7, rough * 0.85, min(1.0, rough * 1.15))
    mk = M.mask(base_wet, 0.0, -1.0)
    s = M.surface(c, r, M.geo.outputs['Normal'], 0.5, mk, crevice_moss, 0.8, porosity, wet_gloss)
    m = M.finish(s.outputs['Color'], s.outputs['Roughness'], s.outputs['Normal'], metallic=metal)
    m['nw_surface'] = surface
    m[TAG] = 1
    return m


def mat_image(name, im, rough=0.5, metal=0.0, surface='metal', base_wet=0.25, alpha=False, porosity=0.3, two_sided=False,
              uv_scale=(1.0, 1.0), streak=0.0, var=0.1, interp='Linear'):
    _guard(name)
    M = lib.Mat(name); b = M.b
    u = b.node('ShaderNodeUVMap', uv_map='UVMap')
    mp = b.node('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (uv_scale[0], uv_scale[1], 1.0)
    b.L.new(u.outputs['UV'], mp.inputs['Vector'])
    t = b.node('ShaderNodeTexImage'); t.image = im; t.interpolation = interp
    b.L.new(mp.outputs['Vector'], t.inputs['Vector'])
    M.meta['tex'].append({'image': im.name, 'file': os.path.basename(im.filepath), 'interp': interp})
    c = M.macro_var(t.outputs['Color'], var, 0.3)
    if streak > 0:
        c = _streaks(M, c, streak)
    mk = M.mask(base_wet, 0.0, -1.0)
    s = M.surface(c, rough, M.geo.outputs['Normal'], 0.5, mk, 0.0, 0.8, porosity, 0.5)
    m = M.finish(s.outputs['Color'], s.outputs['Roughness'], s.outputs['Normal'], metallic=metal)
    if alpha:
        rnd_ = b.math('ROUND', t.outputs['Alpha'])
        b.L.new(rnd_, M.bsdf.inputs['Alpha'])
    m.use_backface_culling = not two_sided
    m['nw_surface'] = surface
    m[TAG] = 1
    return m


def mat_glass(name, im):
    _guard(name)
    M = lib.Mat(name); b = M.b
    u = b.node('ShaderNodeUVMap', uv_map='UVMap')
    t = b.node('ShaderNodeTexImage'); t.image = im; t.interpolation = 'Linear'
    b.L.new(u.outputs['UV'], t.inputs['Vector'])
    lum = b.sep(t.outputs['Color'])[1]
    var = b.remap(b.noise(M.pos, 0.35, 1.0, 0.3), 0.35, 0.65, 0.65, 1.45)
    c = b.col(1.0, t.outputs['Color'], b.rgb(var, var, var), 'MULTIPLY')
    rough = b.remap(lum, 0.15, 0.35, 0.06, 0.45)
    M.meta['tex'].append({'image': im.name, 'file': os.path.basename(im.filepath), 'interp': 'Linear', 'coords': 'UVMap'})
    M.finish(c, rough, M.geo.outputs['Normal'], metallic=0.0, spec=0.6)
    M.m['nw_surface'] = 'glass'
    M.m[TAG] = 1
    return M.m


def materials():
    ims = {
        'window': gen_image('NW_gen_window', 192, 192, paint_window),
        'hazard': gen_image('NW_gen_hazard', 64, 64, paint_hazard),
        'palette': gen_image('NW_gen_palette', 64, 64, paint_palette),
        'weeds': gen_image('NW_gen_ds2_weeds', 256, 128, paint_weeds),
    }
    M = {}
    # 0) 빙하 표석 화강암 — 참조 화면의 회색 바위(윗면 이끼). lichen_rock 원본 평균 선형 알베도 ≈0.05 → ≈0.12
    M['granite'] = mat_tex('NW_granite', 'lichen_rock', 2.6, sat=0.32, tint=srgb('#EEF0EE'), gain=2.7,
                           crevice_moss=3.6, porosity=0.6, wet_gloss=0.6, base_wet=0.3, moss_bias=0.15,
                           surface='rock', micro=0.5, streak=0.35)
    # 1) 어두운 현무암 (dark_rock 원본 ≈0.0125 → ≈0.05: 젖은 개울 바위·잡석)
    M['basalt'] = mat_tex('NW_basalt', 'dark_rock', 2.4, sat=0.5, tint=srgb('#E4E8E6'), gain=5.0,
                          crevice_moss=3.8, porosity=0.68, wet_gloss=0.72, base_wet=0.38, moss_bias=0.18,
                          surface='rock', micro=0.55, streak=0.55)
    # 2) 층리 암반 & 지의류 바위 (≈0.08)
    M['strata'] = mat_tex('NW_cliff_strata', 'lichen_rock', 3.2, sat=0.6, tint=srgb('#DDE2DA'), gain=2.2,
                          crevice_moss=4.2, porosity=0.62, wet_gloss=0.65, base_wet=0.34, moss_bias=0.22,
                          surface='rock', micro=0.5, streak=0.65)
    # 3) 브루탈리즘 산악 교량·전초기지 노출 콘크리트 (거푸집 패널 줄 concrete_slab_wall_02)
    M['conc'] = mat_tex('NW_concrete_wall', 'concrete_slab_wall_02', 2.6, tint=srgb('#C2C5C8'), sat=0.38, streak=0.95,
                        crevice_moss=3.2, porosity=0.48, micro=0.35, surface='wall')
    M['trim'] = bpy.data.materials['NW_concrete']
    M['corr'] = mat_tex('NW_corrugated', 'corrugated_iron_03', 1.6, res='1k', tint=srgb('#B8C2BE'), sat=0.65, streak=1.0, normal=1.6,
                        porosity=0.15, wet_gloss=0.7, surface='metal', streak_col=(0.62, 0.36, 0.22, 1.0))
    M['ribbed'] = mat_tex('NW_ribbed_metal', 'painted_metal_shutter', 1.8, res='1k', tint=srgb('#D2D8D4'), sat=0.5, rot=math.pi / 2,
                          porosity=0.15, surface='metal', streak=0.5)
    M['glass'] = mat_glass('NW_glass_window', ims['window'])
    M['dark'] = mat_flat('NW_interior_dark', '#202426', rough=0.7, var=0.2, surface='wall')
    M['steel'] = mat_flat('NW_steel_black', '#232527', rough=0.55, metal=0.55, surface='metal', streak=0.3)
    M['galv'] = mat_flat('NW_steel_galv', '#8A8F8E', rough=0.42, metal=0.8, surface='metal', var=0.16)
    M['wire'] = mat_flat('NW_cable', '#151617', rough=0.45, var=0.05, surface='metal', base_wet=0.2)
    M['white'] = mat_flat('NW_paint_offwhite', '#DADBD5', rough=0.55, metal=0.1, surface='metal', var=0.06)
    M['line'] = mat_flat('NW_paint_line', '#DCDCD6', rough=0.6, metal=0.0, surface='ground', var=0.1, base_wet=0.3, porosity=0.2)
    M['hazard'] = mat_image('NW_hazard_stripe', ims['hazard'], rough=0.45, surface='metal')
    M['sign'] = mat_image('NW_sign_panel', ims['palette'], rough=0.45, metal=0.15, surface='metal', var=0.04, interp='Closest', streak=0.5)
    M['weeds'] = mat_image('NW_weeds', ims['weeds'], rough=0.75, surface='foliage', alpha=True, two_sided=True, porosity=0.2, var=0.2)
    return M


# ═════════════════════════════ Poly Haven 스캔 에셋 임포트 (present.py 동일) ═════════════════════════════
PH = {
    'rock_face': ('rock_face_01', None, 0.08, 'center'),
    'boulder': ('boulder_01', None, 0.04, 'center'),
    'rock_a': ('rock_moss_set_01', ['rock_moss_set_01_rock02'], 0.11, 'center'),
    'rock_b': ('rock_moss_set_01', ['rock_moss_set_01_rock04'], 0.11, 'center'),
    'rock_c': ('rock_moss_set_01', ['rock_moss_set_01_rock06'], 0.11, 'center'),
    'rock_d': ('rock_moss_set_02', ['rock_moss_set_02_rock11'], 0.14, 'center'),
    'rock_e': ('rock_moss_set_02', ['rock_moss_set_02_rock13'], 0.14, 'center'),
    'shrub': ('shrub_02', ['shrub_02_b'], 0.45, 'base'),
    'barrier': ('concrete_road_barrier', None, 0.03, 'base'),
    'car': ('covered_car', None, 0.16, 'base'),
    'ubox': ('utility_box_02', None, 0.18, 'base'),
}


def _base(n):
    return re.sub(r'\.\d{3}$', '', n)


def cleanup_imports():
    for m in [m for m in bpy.data.materials if m.get(TAG)]:
        if m.users == 0:
            bpy.data.materials.remove(m)
    for me in [me for me in bpy.data.meshes if me.get(TAG) and me.users == 0]:
        bpy.data.meshes.remove(me)
    for im in [im for im in bpy.data.images if im.get(TAG) == 2 and im.users == 0]:
        bpy.data.images.remove(im)


def _upstream_image(sock, depth=0):
    if depth > 8 or not sock.links:
        return None
    l = sock.links[0]; n = l.from_node
    if n.type == 'TEX_IMAGE' and n.image is not None:
        return {'image': n.image.name, 'file': os.path.basename(n.image.filepath), 'output': l.from_socket.name}
    for s2 in n.inputs:
        if s2.links:
            r = _upstream_image(s2, depth + 1)
            if r is not None:
                if n.type == 'SEPARATE_COLOR':
                    r['channel'] = l.from_socket.name
                return r
    return None


def _record_gltf_textures(m, model_id):
    bsdf = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    rec = {'kind': 'gltf', 'model': model_id}
    if bsdf is not None:
        for key, sock in (('base', 'Base Color'), ('rough', 'Roughness'), ('metal', 'Metallic'), ('normal', 'Normal'), ('alpha', 'Alpha')):
            r = _upstream_image(bsdf.inputs[sock])
            if r is not None:
                rec[key] = r
    rec['blend'] = getattr(m, 'surface_render_method', None)
    m['nw_tex'] = json.dumps(rec, ensure_ascii=False)


def _grime_material(m, tint_rgb=None, sat_mul=1.0, val_mul=1.0):
    nt = m.node_tree
    if nt is None:
        return
    if getattr(m, 'surface_render_method', None) == 'BLENDED':
        m.surface_render_method = 'DITHERED'
    bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if bsdf is None:
        return
    b = lib.NB(nt)
    at = b.node('ShaderNodeAttribute', attribute_type='GEOMETRY', attribute_name='nw_mask')
    moss, wet, ao = b.sep(at.outputs['Color'])
    k = b.mul(b.flt(0.82, 1.0, ao), b.sub(1.0, b.mul(wet, 0.35)))
    sock = bsdf.inputs['Base Color']
    src = sock.links[0].from_socket if sock.links else None
    base = src if src is not None else tuple(sock.default_value)
    if sat_mul != 1.0 or val_mul != 1.0:
        hs = b.node('ShaderNodeHueSaturation')
        hs.inputs['Hue'].default_value = 0.5
        hs.inputs['Saturation'].default_value = sat_mul
        hs.inputs['Value'].default_value = val_mul
        b.put(hs.inputs['Color'], base)
        base = hs.outputs['Color']
    if tint_rgb is not None:
        base = b.col(1.0, base, tint_rgb + (1.0,), 'MULTIPLY')
    c = b.col(1.0, base, b.rgb(k, k, k), 'MULTIPLY')
    # 윗면(moss > 0.35)에는 DS2 올리브 이끼 색(#4C5B28) 살짝 블렌딩
    moss_fac = b.mul(b.smooth(0.32, 0.78, moss), 0.52)
    c = b.col(moss_fac, c, srgb('#4E5D29'))
    for l in list(sock.links):
        nt.links.remove(l)
    b.L.new(c, sock)
    rs = bsdf.inputs['Roughness']
    rsrc = rs.links[0].from_socket if rs.links else rs.default_value
    r = b.mul(rsrc, b.sub(1.0, b.mul(wet, 0.45)))
    for l in list(rs.links):
        nt.links.remove(l)
    b.L.new(r, rs)


def _join_proto(name, objs, canon, ratio, origin, sc, tmp):
    V = []; F = []; FM = []; UV = []; mats = []
    for o in objs:
        me = o.data; mw = o.matrix_world
        base = len(V)
        V.extend(tuple(mw @ v.co) for v in me.vertices)
        uvl = me.uv_layers.active
        for p in me.polygons:
            F.append(tuple(base + i for i in p.vertices))
            sm = me.materials[p.material_index] if me.materials else None
            cm = canon.get('PH_' + _base(sm.name), sm) if sm is not None else None
            if cm not in mats:
                mats.append(cm)
            FM.append(mats.index(cm))
            UV.append([tuple(uvl.data[li].uv) for li in p.loop_indices] if uvl else [(0, 0)] * len(p.loop_indices))
    xs = [v[0] for v in V]; ys = [v[1] for v in V]; zs = [v[2] for v in V]
    off = ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs)) if origin in ('base', 'center') else (0.0, 0.0, 0.0)
    V = [(x - off[0], y - off[1], z - off[2]) for x, y, z in V]
    me = bpy.data.meshes.new(name + '_src')
    me.from_pydata(V, [], F)
    for m in mats:
        me.materials.append(m)
    me.polygons.foreach_set('material_index', FM)
    lib.set_uv(me, 'UVMap', None, per_loop=[uv for f in UV for uv in f])
    me.shade_smooth()
    if ratio < 0.999:
        bm = bmesh.new(); bm.from_mesh(me)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        bm.to_mesh(me); bm.free()
        o = bpy.data.objects.new(name + '_tmp', me); tmp.objects.link(o)
        mod = o.modifiers.new('dec', 'DECIMATE'); mod.ratio = ratio; mod.use_collapse_triangulate = True
        dg = sc.view_layers[0].depsgraph; dg.update()
        me2 = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        bpy.data.objects.remove(o, do_unlink=True); bpy.data.meshes.remove(me)
        me = me2
    old = bpy.data.meshes.get(name)
    if old is not None and old.users == 0:
        bpy.data.meshes.remove(old)
    me.name = name
    me.set_sharp_from_angle(angle=math.radians(40))
    h = max(0.05, max(v.co.z for v in me.vertices) - min(v.co.z for v in me.vertices))
    zmin = min(v.co.z for v in me.vertices)

    def mk(co, n):
        z = co.z - zmin
        low = 1 - smoothstep(0.0, min(0.4, 0.45 * h), z)
        top = smoothstep(0.5, 0.9, n.z) * smoothstep(0.3 * h, 0.85 * h, z)
        return (0.82 * top + 0.25 * low, 0.4 + 0.5 * low, 1 - 0.45 * low)
    lib.write_mask(me, mk)
    me[TAG] = 1
    return me


def import_protos(sc):
    tmp = lib.coll('NW_tmp_import', sc)
    files = {}
    for key, (mid, keep, ratio, origin) in PH.items():
        files.setdefault(mid, []).append(key)
    protos = {}
    for mid, keys in files.items():
        before_img = set(bpy.data.images); before_mat = set(bpy.data.materials)
        objs = lib.import_gltf(os.path.join(lib.SRC, 'model', mid, f'{mid}_1k.gltf'), tmp, sc)
        new_mats = [m for m in bpy.data.materials if m not in before_mat]
        for im in bpy.data.images:
            if im not in before_img:
                im[TAG] = 2
        canon = {}
        for m in new_mats:
            bn = 'PH_' + _base(m.name)
            if bn not in canon:
                want = bn; k = 1
                while True:
                    old = bpy.data.materials.get(want)
                    if old is None or old is m:
                        break
                    if old.get(TAG) and old not in new_mats:
                        bpy.data.materials.remove(old)
                        break
                    want = f'{bn}_nw{k}'; k += 1
                m.name = want; m[TAG] = 1
                _record_gltf_textures(m, mid)
                # 스캔 바위(rock_face_01, boulder_01, rock_moss_set_*)는 따뜻한 황토빛 채도를 낮추고 차가운 현무암 톤으로 그레이딩
                if mid in ('rock_face_01', 'boulder_01', 'rock_moss_set_01', 'rock_moss_set_02'):
                    _grime_material(m, tint_rgb=(0.80, 0.83, 0.84), sat_mul=0.45, val_mul=0.92)
                else:
                    _grime_material(m)
                canon[bn] = m
        meshes = [o for o in objs if o.type == 'MESH']
        for key in keys:
            _, keep, ratio, origin = PH[key]
            sel = [o for o in meshes if keep is None or _base(o.name) in keep]
            protos[key] = _join_proto('PR_ph_' + key, sel, canon, ratio, origin, sc, tmp)
        for o in objs:
            me = o.data if o.type == 'MESH' else None
            bpy.data.objects.remove(o, do_unlink=True)
            if me is not None and me.users == 0:
                bpy.data.meshes.remove(me)
        for m in new_mats:
            if m.name not in canon and m.users == 0:
                bpy.data.materials.remove(m)
    bpy.data.collections.remove(tmp)
    return protos


# ═════════════════════════════ 1. 주상절리 현무암 대절벽 · 암벽 단애 (STATIC 에 병합 → Cycles AO 베이킹 대상!) ═════════════════════════════
def _basalt_column_world(acc, cx, cy, z_base, sides, r, h, rnd, mat, tilt=0.10, lean=(0.0, 0.0)):
    """월드 좌표(cx, cy, z_base)에 세우는 다단 주상절리 기둥. 윗면과 단차 턱에는 올리브 이끼(R)가 맺히고,
    수직 절벽면에는 빗물 줄무늬(nw_streak=A)와 하단 접지 습기(G)·AO(B)가 들어간다."""
    angs = [2 * math.pi * k / sides + rnd.uniform(-0.16, 0.16) for k in range(sides)]
    rad = [r * rnd.uniform(0.85, 1.14) for _ in range(sides)]
    tx, ty = rnd.uniform(-tilt, tilt), rnd.uniform(-tilt, tilt)
    lx, ly = lean
    taper = rnd.uniform(0.85, 0.96)

    def ring(z_rel, k_r, dz=0.0):
        out = []
        for k in range(sides):
            x = rad[k] * k_r * math.cos(angs[k])
            y = rad[k] * k_r * math.sin(angs[k])
            zf = z_base + z_rel + dz + (tx * x + ty * y) * (z_rel / max(h, 1e-3))
            out.append((cx + x + lx * z_rel, cy + y + ly * z_rel, zf))
        return out

    bev = rnd.uniform(0.05, 0.11) * h
    r0 = ring(-1.2, 1.06)
    r_mid = ring(h * 0.52, (1.0 + taper) * 0.5)
    r1 = ring(h - bev, taper)
    r2 = [
        (
            p[0] - (p[0] - cx - lx * h) * 0.14,
            p[1] - (p[1] - cy - ly * h) * 0.14,
            p[2] + bev + rnd.uniform(-0.04, 0.04) * h,
        )
        for p in r1
    ]
    zmax = max(p[2] for p in r2)

    def mk(p, n):
        z_rel = p[2] - z_base
        topf = smoothstep(0.45, 0.88, n[2])
        low = 1.0 - smoothstep(-0.2, min(3.5, 0.32 * h), z_rel)
        moss = clamp01(0.94 * topf + 0.38 * low)
        wet = clamp01(0.38 + 0.55 * low)
        ao = clamp01(1.0 - 0.58 * low)
        streak = clamp01(0.85 * math.exp(-max(0.0, (z_base + h) - p[2]) / max(3.5, 0.45 * h)) * (1.0 - topf))
        return (moss, wet, ao, streak)

    for a, b in ((r0, r_mid), (r_mid, r1), (r1, r2)):
        for k in range(sides):
            k2 = (k + 1) % sides
            u0 = k * r * 0.85; u1 = (k + 1) * r * 0.85
            va = (a[k][2] - z_base); vb = (b[k][2] - z_base)
            acc.poly([a[k], a[k2], b[k2], b[k]], [(u0, va), (u1, va), (u1, vb), (u0, vb)], mat, mk)
    c_top = (
        sum(p[0] for p in r2) / sides + rnd.uniform(-0.1, 0.1) * r,
        sum(p[1] for p in r2) / sides + rnd.uniform(-0.1, 0.1) * r,
        sum(p[2] for p in r2) / sides + rnd.uniform(-0.04, 0.05) * h,
    )
    for k in range(sides):
        k2 = (k + 1) % sides
        acc.poly([r2[k], r2[k2], c_top], [(0, 0), (r, 0), (r * 0.5, r)], mat, mk)
    return zmax


def _emit_boulder(acc, geo, x, y, z0, sx, sy, sz, rz, mat):
    """ds2_rocks.boulder_geom 표석을 월드 좌표에 찍는다(면 주축 박스 투영 UV(m), 윗면 이끼 마스크)."""
    import ds2_rocks
    V, F, gh = geo
    ca, sa = math.cos(rz), math.sin(rz)
    W = [(x + vx * sx * ca - vy * sy * sa, y + vx * sx * sa + vy * sy * ca, z0 + vz * sz) for vx, vy, vz in V]
    mk0 = ds2_rocks.boulder_mask(gh * sz, seed=x * 0.013)

    def mk(p, n):
        return mk0((p[0] - x, p[1] - y, p[2] - z0), n)
    for f in F:
        pts = [W[i] for i in f]
        n, _ = newell(pts)
        ax = max(range(3), key=lambda i: abs(n[i]))
        uv = [((q[1], q[2]) if ax == 0 else (q[0], q[2]) if ax == 1 else (q[0], q[1])) for q in pts]
        acc.poly(pts, uv, mat, mk)
    return z0 + gh * sz


def build_mountain_cliffs_and_outcrops(C, M, P, gz):
    """계곡 분지를 둘러싼 산자락의 빙하 표석 들판(큰 표석 + 위성 바위) + 스캔 암벽(rock_face_01).
    참조 화면처럼 상자형 주상절리 대신 둥글고 각진 회색 표석이 이끼 사면에 촘촘히 박힌 모습으로 만든다."""
    import ds2_rocks
    importlib.reload(ds2_rocks)
    rnd = random.Random(2041)
    cliffs = Acc()
    geos = [ds2_rocks.boulder_geom(1200 + i, subdiv=2, cuts=7, squash=0.66, lump=0.24) for i in range(6)]

    def pile(cx, cy, w, h, mat, n_sat=3):
        g = geos[rnd.randrange(len(geos))]
        _emit_boulder(cliffs, g, cx, cy, gz.z(cx, cy) - 0.2 * h, w, w * rnd.uniform(0.72, 0.98), h / g[2],
                      rnd.uniform(0, 6.3), mat)
        for _ in range(n_sat):
            a = rnd.uniform(0, 2 * math.pi); d = w * rnd.uniform(0.7, 1.35)
            sx, sy = cx + d * math.cos(a), cy + d * math.sin(a)
            ww = w * rnd.uniform(0.28, 0.6); hh = h * rnd.uniform(0.3, 0.6)
            g2 = geos[rnd.randrange(len(geos))]
            _emit_boulder(cliffs, g2, sx, sy, gz.z(sx, sy) - 0.22 * hh, ww, ww * rnd.uniform(0.7, 1.0), hh / g2[2],
                          rnd.uniform(0, 6.3), mat)

    # 1) 산자락 표석 띠 (A → B 를 따라 큰 표석 + 위성 바위). 높이는 기존 단애의 0.45배 — 바위 들판 스케일
    boulder_chains = [
        ((-98.0, 68.0), (-34.0, 114.0), 11, 4.6, 3.2, 7.0, 'granite'),       # 북서 산자락
        ((-32.0, 104.0), (14.0, 132.0), 9, 4.8, 3.4, 7.2, 'granite'),
        ((54.0, 128.0), (128.0, 82.0), 12, 4.8, 3.4, 7.6, 'granite'),        # 북동 계곡 상류 사면
        ((-86.0, -16.0), (-44.0, 14.0), 7, 3.8, 2.4, 5.0, 'granite'),        # 서쪽 국도변 (CAM_street 좌측)
        ((138.0, -20.0), (152.0, 66.0), 10, 4.4, 3.0, 6.4, 'strata'),        # 동쪽 FaceArch 배후
        ((-76.0, -98.0), (-12.0, -114.0), 9, 4.2, 2.8, 5.6, 'granite'),      # 남쪽 협곡 건너편
        ((56.0, -108.0), (128.0, -90.0), 9, 4.2, 2.8, 5.8, 'strata'),
    ]
    for (ax, ay), (bx, by), count, w_base, h_min, h_max, mkey in boulder_chains:
        for i in range(count):
            t = i / max(1, count - 1)
            cx = ax + (bx - ax) * t + rnd.uniform(-4.0, 4.0)
            cy = ay + (by - ay) * t + rnd.uniform(-4.0, 4.0)
            h = rnd.uniform(h_min, h_max) * (0.75 + 0.35 * math.sin(math.pi * t))
            pile(cx, cy, w_base * rnd.uniform(0.85, 1.3), h, M[mkey], n_sat=rnd.choice((2, 3, 4)))

    # 2) 계곡 입구·하류 협곡의 큰 표석 무더기 (참조 화면 중경의 이끼 모자 바위 언덕)
    outcrops = [
        ((24.0, 62.0), 4.6, 4.4), ((66.0, 60.0), 5.2, 5.0), ((16.0, 88.0), 5.8, 6.0), ((56.0, 90.0), 6.2, 6.4),
        ((-36.0, 34.0), 4.4, 4.0), ((136.0, 42.0), 5.0, 4.8), ((24.0, -68.0), 4.2, 3.8), ((52.0, -72.0), 4.6, 4.2),
    ]
    for (cx, cy), w, h in outcrops:
        pile(cx, cy, w, h, M['granite'], n_sat=5)

    STATIC.extend(cliffs)

    # 3) Poly Haven 스캔 암벽(rock_face_01) 배치: 산비탈에 깊숙이 묻어 자연 암반 사면이 돌출된 것처럼 연출
    cliff_faces = [
        ((-64.0, 74.0), 0.42, 2.6, 1.8),
        ((-16.0, 96.0), -0.18, 2.8, 2.0),
        ((64.0, 92.0), -0.52, 2.7, 1.9),
        ((96.0, 76.0), -0.78, 2.5, 1.8),
        ((138.0, 26.0), -1.48, 2.3, 1.6),
        ((-68.0, -8.0), 0.35, 2.1, 1.5),
        ((-42.0, -82.0), 2.65, 2.2, 1.6),
        ((72.0, -80.0), -2.45, 2.3, 1.6),
        ((20.0, 72.0), 0.25, 2.2, 1.5),
        ((58.0, 70.0), -0.45, 2.3, 1.6),
    ]
    for i, ((x, y), rz, sc_f, sink_z) in enumerate(cliff_faces):
        z = gz.z(x, y) - sink_z
        place(f'PR_ph_rock_face.{i:03d}', P['rock_face'], C, (x, y, z), rz, sc_f, surface='rock')


# ═════════════════════════════ 2. 계곡 자연 포켓 (build_lot_pocket — present.py 와 동일한 정밀 밀도) ═════════════════════════════
def _basalt_column_local(acc, cx, cy, sides, r, h, rnd, M, tilt=0.12, lean=(0.0, 0.0)):
    angs = [2 * math.pi * k / sides + rnd.uniform(-0.18, 0.18) for k in range(sides)]
    rad = [r * rnd.uniform(0.88, 1.1) for _ in range(sides)]
    tx, ty = rnd.uniform(-tilt, tilt), rnd.uniform(-tilt, tilt)
    lx, ly = lean
    taper = rnd.uniform(0.86, 0.96)

    def ring(z, k_r, dz=0.0):
        out = []
        for k in range(sides):
            x = rad[k] * k_r * math.cos(angs[k]); y = rad[k] * k_r * math.sin(angs[k])
            out.append((cx + x + lx * z, cy + y + ly * z, z + dz + (tx * x + ty * y) * (z / max(h, 1e-3))))
        return out
    bev = rnd.uniform(0.05, 0.11) * h
    r0 = ring(-0.3, 1.0); r1 = ring(h - bev, taper)
    r2 = [(p[0] - (p[0] - cx - lx * h) * 0.12, p[1] - (p[1] - cy - ly * h) * 0.12, p[2] + bev + rnd.uniform(-0.04, 0.04) * h) for p in r1]
    zmax = max(p[2] for p in r2)

    def mk(p, n):
        topf = smoothstep(0.5, 0.9, n[2]) * smoothstep(0.55 * zmax, 0.95 * zmax, p[2])
        low = 1 - smoothstep(-0.1, 0.3 * zmax, p[2])
        return (0.95 * topf + 0.35 * low, 0.45 + 0.5 * low, 1 - 0.55 * low, 0.0)
    m = M['basalt']
    for a, b in ((r0, r1), (r1, r2)):
        for k in range(sides):
            k2 = (k + 1) % sides
            acc.poly([a[k], a[k2], b[k2], b[k]], [(0, 0), (1, 0), (1, 1), (0, 1)], m, mk)
    c = (sum(p[0] for p in r2) / sides + rnd.uniform(-0.1, 0.1) * r, sum(p[1] for p in r2) / sides + rnd.uniform(-0.1, 0.1) * r,
         sum(p[2] for p in r2) / sides + rnd.uniform(-0.06, 0.04) * h)
    for k in range(sides):
        k2 = (k + 1) % sides
        acc.poly([r2[k], r2[k2], c], [(0, 0), (1, 0), (0.5, 1)], m, mk)
    return zmax


def basalt_mesh(name, seed, cols, M):
    rnd = random.Random(seed)
    acc = Acc()
    lean = (rnd.uniform(-0.06, 0.06), rnd.uniform(-0.06, 0.06))
    for x, y, sides, r, h in cols:
        _basalt_column_local(acc, x, y, sides, r, h, rnd, M, lean=lean)
    me = acc.to_mesh(name)
    lib.box_uv(me, 1.0)
    return me


def boulder_mesh(name, seed, M, w, d, h, mkey='granite', subdiv=2, cuts=6):
    """근경 인스턴스용 표석 메시(로컬, 바닥 z=0). 박스 투영 UV(m), 용접 + 스무스(파쇄면 모서리는 날카롭게)."""
    import ds2_rocks
    V, F, gh = ds2_rocks.boulder_geom(seed, subdiv=subdiv, cuts=cuts, squash=0.68, lump=0.22)
    acc = Acc()
    _emit_boulder(acc, (V, F, gh), 0.0, 0.0, 0.0, w, d, h / gh, 0.0, M[mkey])
    me = acc.to_mesh(name, weld=True, smooth=True, sharp=40)
    return me


def weed_mesh(name, M, u0, u1, hgt=0.75, n=3):
    acc = Acc()
    w = hgt * 1.0
    for k in range(n):
        a = math.pi * k / n + 0.2 * k
        e = Vector((math.cos(a), math.sin(a), 0)) * w / 2
        acc.poly([tuple(-e), tuple(e), tuple(e + Vector((0, 0, hgt))), tuple(-e + Vector((0, 0, hgt)))], [(u0, 0), (u1, 0), (u1, 1), (u0, 1)],
                 M['weeds'], [(0.0, 0.4, 0.8, 0), (0.0, 0.4, 0.8, 0), (0.0, 0.2, 1.0, 0), (0.0, 0.2, 1.0, 0)])
    return acc.to_mesh(name)


def chunk_proto(name, seed, flat, M):
    V, F, h = G.chunk_mesh(seed, flat)
    acc = Acc()

    def mk(p, n):
        topf = smoothstep(0.5, 0.9, n[2]) * smoothstep(0.4 * h, 0.85 * h, p[2])
        low = 1 - smoothstep(0.0, 0.35 * h, p[2])
        return (0.85 * topf + 0.3 * low, 0.45 + 0.5 * low, 1 - 0.5 * low, 0.0)
    acc.mesh(Matrix.Identity(4), V, F, M['basalt'], mk)
    me = acc.to_mesh(name)
    lib.box_uv(me, 1.0)
    return me, h


def build_valley_nature(c, M, P, gz):
    """계곡 분지(LOT) 및 주변 산자락의 바위 3단 스케일(대형 현무암 기둥군 + Poly Haven 스캔 바위 + 소형 잔돌) + 수변 사초·관목."""
    rnd = random.Random(2041)
    lx0, ly0, lx1, ly1 = G.LOT

    # 큰 표석(근경 군집 중심) 2종 + 중형 표석 5종 — 참조 화면의 윗면 이끼 회색 바위
    big_a = boulder_mesh('PR_lot_boulder_big_a', 7, M, 2.7, 2.2, 2.5)
    big_b = boulder_mesh('PR_lot_boulder_big_b', 13, M, 3.1, 2.4, 2.9)
    meds = [boulder_mesh(f'PR_lot_boulder_m{i}', 20 + i, M, w, d, h, mk, subdiv=1 if i % 2 else 2)
            for i, (w, d, h, mk) in enumerate(((1.0, 0.8, 0.95, 'granite'), (1.25, 0.9, 0.8, 'granite'),
                                               (0.85, 0.75, 1.05, 'strata'), (1.35, 1.05, 0.7, 'granite'),
                                               (0.95, 0.7, 0.6, 'basalt')))]
    smalls = [chunk_proto(f'PR_lot_basalt_s{i}', 300 + i, (0.55, 0.8, 0.4)[i], M) for i in range(3)]
    phm = [P['rock_a'], P['rock_b'], P['rock_c'], P['rock_d'], P['rock_e'], P['boulder']]
    pools = [((x, y), r) for (x, y), r in G.POOLS]

    def free_lot(x, y, rr):
        if not (lx0 + 1.0 < x < lx1 - 1.0 and ly0 + 1.0 < y < ly1 - 1.0):
            return False
        return all(math.hypot(x - px, y - py) > pr + rr for (px, py), pr in pools)

    clusters = [
        ((50.5, 4.5), big_a, 14, 40, 5.0),
        ((58.5, 24.5), big_b, 12, 30, 4.4),
        ((33.5, 21.0), big_b, 11, 28, 4.0),
        ((39.5, -14.0), None, 10, 34, 3.6),     # CAM_lot / CAM_ground 근경
        ((59.5, -14.0), big_a, 10, 24, 3.6),
        ((43.5, 34.5), None, 10, 26, 3.8),
        ((57.0, 44.5), big_a, 10, 24, 3.8),
        ((33.0, 46.5), None, 10, 24, 3.8),
        ((30.5, 4.0), None, 8, 20, 3.2),        # 개울 서안
        ((62.0, 8.0), None, 8, 20, 3.4),        # 개울 동안
    ]
    j = 0
    for idx_c, ((cx, cy), big_me, nm, ns, rad) in enumerate(clusters):
        if big_me is not None:
            z = gz.z(cx, cy)
            place(f'PR_lot_basalt_big.{idx_c}', big_me, c, (cx, cy, z - 0.12), 0.6 + idx_c, 1.0, rx=0.08, ry=-0.05, surface='rock')
        placed = 0; tries = 0
        while placed < nm and tries < 220:
            tries += 1
            a = rnd.uniform(0, 2 * math.pi); d = rad * math.sqrt(rnd.uniform(0.15, 1.0)) * (1.25 if big_me else 1.0)
            x, y = cx + d * math.cos(a), cy + d * math.sin(a)
            if not free_lot(x, y, 0.55) or (big_me and math.hypot(x - cx, y - cy) < 2.0):
                continue
            if rnd.random() < 0.52:
                me = meds[rnd.randrange(len(meds))]; s = rnd.uniform(0.78, 1.35); sink = 0.12
            else:
                me = phm[rnd.randrange(len(phm))]; s = rnd.uniform(0.48, 0.92); sink = 0.18
            place(f'PR_lot_rock.{j:03d}', me, c, (x, y, gz.z(x, y) - sink * s), rnd.uniform(0, 6.3), s,
                  rx=rnd.uniform(-0.12, 0.12), ry=rnd.uniform(-0.12, 0.12), surface='rock')
            j += 1; placed += 1
        for _ in range(ns):
            a = rnd.uniform(0, 2 * math.pi); d = rad * 1.45 * math.sqrt(rnd.random())
            x, y = cx + d * math.cos(a), cy + d * math.sin(a)
            if not (lx0 + 0.8 < x < lx1 - 0.8 and ly0 + 0.8 < y < ly1 - 0.8):
                continue
            me, h = smalls[rnd.randrange(3)]
            s = rnd.uniform(0.12, 0.38)
            place(f'PR_lot_chip.{j:03d}', me, c, (x, y, gz.z(x, y) - h * s * 0.3), rnd.uniform(0, 6.3), (s * rnd.uniform(0.8, 1.3), s, s),
                  rx=rnd.uniform(-0.3, 0.3), ry=rnd.uniform(-0.3, 0.3), surface='rock')
            j += 1

    # 광역 산악 사면(GR_terrain) 주요 시야 지점에도 스캔 볼더·현무암 중형 바위 군집 배치
    slope_clusters = [
        ((-46.0, -24.0), 7.5, 12, 18),    # CAM_street 좌측 산자락
        ((-76.0, -26.0), 8.5, 13, 20),    # CAM_street 좌측 전경 산자락
        ((-56.0, -64.0), 8.0, 7, 12),     # CAM_street 우측 남쪽 사면
        ((18.0, 56.0), 8.5, 8, 14),       # 계곡 북서 입구
        ((68.0, 54.0), 8.5, 8, 14),       # 계곡 북동 입구
        ((32.0, 74.0), 9.0, 14, 20),      # 상류 계곡물 양안
        ((52.0, 78.0), 9.0, 14, 20),
        ((36.0, 102.0), 10.0, 14, 20),
        ((44.0, 126.0), 11.0, 12, 18),
        ((90.0, 40.0), 10.0, 10, 16),     # FaceArch 북서 이끼 언덕
        ((-20.0, 60.0), 10.0, 10, 16),    # HAUS 북쪽 이끼 언덕
        ((38.0, -64.0), 8.0, 7, 14),      # 국도 남쪽 하류 협곡
    ]
    for (cx, cy), rad, nm, ns in slope_clusters:
        for _ in range(nm):
            a = rnd.uniform(0, 2 * math.pi); d = rad * math.sqrt(rnd.uniform(0.08, 1.0))
            x, y = cx + d * math.cos(a), cy + d * math.sin(a)
            if G.mountain_boundary_dist(x, y) < 1.5:
                continue
            me = phm[rnd.randrange(len(phm))] if rnd.random() < 0.65 else meds[rnd.randrange(len(meds))]
            s = rnd.uniform(0.65, 1.45)
            place(f'PR_lot_rock.{j:03d}', me, c, (x, y, gz.z(x, y) - 0.18 * s), rnd.uniform(0, 6.3), s,
                  rx=rnd.uniform(-0.15, 0.15), ry=rnd.uniform(-0.15, 0.15), surface='rock')
            j += 1
        for _ in range(ns):
            a = rnd.uniform(0, 2 * math.pi); d = rad * 1.3 * math.sqrt(rnd.random())
            x, y = cx + d * math.cos(a), cy + d * math.sin(a)
            if G.mountain_boundary_dist(x, y) < 1.0:
                continue
            me, h = smalls[rnd.randrange(3)]
            s = rnd.uniform(0.16, 0.44)
            place(f'PR_lot_chip.{j:03d}', me, c, (x, y, gz.z(x, y) - h * s * 0.3), rnd.uniform(0, 6.3), (s * rnd.uniform(0.8, 1.3), s, s),
                  rx=rnd.uniform(-0.3, 0.3), ry=rnd.uniform(-0.3, 0.3), surface='rock')
            j += 1

    # 잡초·고산 사초·관목 배치
    gk = ['weed_green', 'weed_green', 'weed_green', 'weed_dry', 'weed_dry_t']   # 참조 화면: 초록 풀 위주, 마른 풀은 드문드문
    g = 0; s_cnt = 0
    spots = []
    for (cx, cy), *_ in clusters:
        for _ in range(26):
            a = rnd.uniform(0, 2 * math.pi); d = rnd.uniform(0.9, 6.0)
            spots.append((cx + d * math.cos(a), cy + d * math.sin(a)))
    for (cx, cy), rad, *_ in slope_clusters:
        for _ in range(12):
            a = rnd.uniform(0, 2 * math.pi); d = rnd.uniform(0.8, rad)
            spots.append((cx + d * math.cos(a), cy + d * math.sin(a)))
    for poly in G.FOUNDATION:
        for (ax, ay), (bx, by) in zip(poly, poly[1:] + poly[:1]):
            for _ in range(5):
                t = rnd.random(); spots.append((ax + (bx - ax) * t + rnd.uniform(-0.6, 0.6), ay + (by - ay) * t + rnd.uniform(-0.6, 0.6)))
    for x, y in spots:
        if G._rect_d(G.LOT, x, y) < 0 and not free_lot(x, y, 0.35):
            continue
        if abs(x - 43.8) < 1.5 and y < 0:
            continue
        z = gz.z(x, y)
        if rnd.random() < 0.38:
            place(f'PR_ph_shrub.v{s_cnt:03d}', P['shrub'], c, (x, y, z - 0.04), rnd.uniform(0, 6.3), rnd.uniform(0.32, 0.58), surface='foliage')
            s_cnt += 1
        else:
            key = gk[rnd.randrange(len(gk))]
            place(f'PR_lot_weed.{g:03d}', P[key], c, (x, y, z - 0.03), rnd.uniform(0, 6.3), rnd.uniform(0.72, 1.38), surface='foliage')
            g += 1

    # 상류 계곡 바닥(MASK_RECT 북쪽 바깥, CAM_valley 근경): 개울 둑의 표석·호박돌 + 관목·풀 — 참조 화면 전경
    import ds2_backdrop as B
    importlib.reload(B)
    for _ in range(420):
        y = rnd.uniform(246.0, 430.0)
        side = rnd.choice((-1.0, 1.0))
        off = rnd.uniform(5.0, 70.0) ** 1.0 * (0.4 + 0.6 * rnd.random())
        x = B.stream_x(y) + side * max(5.2, off)
        z = B.outer_mountain_z(x, y)
        r = rnd.random()
        if r < 0.22:
            me = meds[rnd.randrange(len(meds))] if rnd.random() < 0.6 else phm[rnd.randrange(len(phm))]
            sc_ = rnd.uniform(0.7, 2.2) * (1.4 if off > 20 else 1.0)
            place(f'PR_up_rock.{j:03d}', me, c, (x, y, z - 0.18 * sc_), rnd.uniform(0, 6.3), sc_,
                  rx=rnd.uniform(-0.12, 0.12), ry=rnd.uniform(-0.12, 0.12), surface='rock')
            j += 1
        elif r < 0.5:
            place(f'PR_ph_shrub.u{s_cnt:03d}', P['shrub'], c, (x, y, z - 0.05), rnd.uniform(0, 6.3), rnd.uniform(0.45, 0.9), surface='foliage')
            s_cnt += 1
        else:
            key = ('weed_green', 'weed_green', 'weed_dry')[rnd.randrange(3)]
            place(f'PR_up_weed.{g:03d}', P[key], c, (x, y, z - 0.03), rnd.uniform(0, 6.3), rnd.uniform(0.8, 1.5), surface='foliage')
            g += 1
    for k_ in range(240):                    # 개울 가장자리·바닥의 젖은 호박돌(반쯤 잠겨 수면을 깨뜨린다)
        y = rnd.uniform(240.0, 560.0)
        x = B.stream_x(y) + rnd.choice((-1.0, 1.0)) * (rnd.uniform(3.0, 7.0) if k_ % 2 else rnd.uniform(0.0, 3.8))
        z = B.outer_mountain_z(x, y)
        me, h = smalls[rnd.randrange(3)]
        sc_ = rnd.uniform(0.5, 1.4)
        place(f'PR_up_chip.{j:03d}', me, c, (x, y, z - h * sc_ * 0.25), rnd.uniform(0, 6.3), (sc_ * rnd.uniform(0.8, 1.3), sc_, sc_),
              rx=rnd.uniform(-0.3, 0.3), ry=rnd.uniform(-0.3, 0.3), surface='rock')
        j += 1

    print('valley nature: rocks/chips', j, 'weeds', g, 'shrubs', s_cnt)


# ═════════════════════════════ 3. 북쪽 산악 콘크리트 고가교 (PR_via.* — ds2_future LED 슬롯 호환) ═════════════════════════════
def _za(x, xa, xb):
    t = (x - 0.5 * (xa + xb)) / (0.5 * (xb - xa))
    return VIA_SPRING + (VIA_CROWN - VIA_SPRING) * math.sqrt(max(0.0, 1 - t * t))


def via_span_mesh(M):
    """산악 협곡을 가로지르는 브루탈리즘 콘크리트 아치 고가교 경간 모듈(22 m).
    남쪽 상판 테두리(y −0.7, z 7.9) 아래 모서리는 Task 4 시안색 카이랄 LED 선 자리로 비워 둔다."""
    acc = Acc()
    hw = VIA_PIER / 2; xa, xb = hw, VIA_SPAN - hw; W = VIA_Y1 - VIA_Y0
    N = 14
    xs = [xa + (xb - xa) * i / N for i in range(N + 1)]
    zs = [_za(x, xa, xb) for x in xs]

    def pm(p, n):
        h = p[2]
        return (0.95 * (1 - smoothstep(0.0, 1.2, h)) + 0.45 * smoothstep(0.6, 0.9, n[2]),
                0.35 + 0.6 * (1 - smoothstep(0.0, 1.8, h)),
                1 - 0.55 * (1 - smoothstep(-0.2, 1.4, h)),
                0.8 * math.exp(-(DECK_B - h) / 3.2))

    C_ = M['conc']
    # 산악 지형 높낮이에 맞춰 교각 뿌리가 깊게 박히도록 하단을 z = -8.0 m 까지 내린다
    z_foot = -8.0
    for sx in (-1, 1):
        x = sx * hw
        acc.poly([(x, 0, z_foot), (x, W, z_foot), (x, W, VIA_SPRING), (x, 0, VIA_SPRING)],
                 [(0, z_foot), (W, z_foot), (W, VIA_SPRING), (0, VIA_SPRING)], C_, pm, (sx, 0, 0))
    for yy, sy in ((0.0, -1), (W, 1)):
        acc.poly([(-hw, yy, z_foot), (hw, yy, z_foot), (hw, yy, DECK_B), (-hw, yy, DECK_B)],
                 [(-hw, z_foot), (hw, z_foot), (hw, DECK_B), (-hw, DECK_B)], C_, pm, (0, sy, 0))
        for i in range(N):
            acc.poly([(xs[i], yy, zs[i]), (xs[i + 1], yy, zs[i + 1]), (xs[i + 1], yy, DECK_B), (xs[i], yy, DECK_B)],
                     [(xs[i], zs[i]), (xs[i + 1], zs[i + 1]), (xs[i + 1], DECK_B), (xs[i], DECK_B)], C_, pm, (0, sy, 0))
        acc.box((-hw - 0.12, yy - (0.12 if sy < 0 else 0.0), VIA_SPRING - 0.45), (hw + 0.12, yy + (0.12 if sy > 0 else 0.0), VIA_SPRING),
                M['trim'], (0.5, 0.6, 0.9, 0.0), faces='xXyYzZ'.replace('y' if sy > 0 else 'Y', ''))
    for i in range(N):
        acc.poly([(xs[i], 0, zs[i]), (xs[i + 1], 0, zs[i + 1]), (xs[i + 1], W, zs[i + 1]), (xs[i], W, zs[i])],
                 [(xs[i], 0), (xs[i + 1], 0), (xs[i + 1], W), (xs[i], W)], C_, (0.0, 0.4, 0.9, 0.0), (0, 0, -1))
    x_0, x_1 = -hw, VIA_SPAN - hw
    for yy, sy in ((0.0, -1), (W, 1)):
        ye = yy + sy * 0.7
        acc.poly([(x_0, yy, DECK_B), (x_1, yy, DECK_B), (x_1, ye, DECK_B), (x_0, ye, DECK_B)],
                 [(x_0, 0), (x_1, 0), (x_1, 0.7), (x_0, 0.7)], C_, (0.0, 0.4, 0.6, 0.0), (0, 0, -1))
        acc.poly([(x_0, ye, DECK_B), (x_1, ye, DECK_B), (x_1, ye, DECK_T + 1.1), (x_0, ye, DECK_T + 1.1)],
                 [(x_0, DECK_B), (x_1, DECK_B), (x_1, DECK_T + 1.1), (x_0, DECK_T + 1.1)], C_,
                 lambda p, n: (0.0, 0.3, 0.95, 0.6 * smoothstep(DECK_B + 0.4, DECK_T + 1.1, p[2])), (0, sy, 0))
        yi = ye - sy * 0.25
        acc.poly([(x_0, ye, DECK_T + 1.1), (x_1, ye, DECK_T + 1.1), (x_1, yi, DECK_T + 1.1), (x_0, yi, DECK_T + 1.1)],
                 [(x_0, 0), (x_1, 0), (x_1, 0.25), (x_0, 0.25)], M['trim'], (0.55, 0.6, 0.95, 0.0), (0, 0, 1))
        acc.poly([(x_0, yi, DECK_T + 0.3), (x_1, yi, DECK_T + 0.3), (x_1, yi, DECK_T + 1.1), (x_0, yi, DECK_T + 1.1)],
                 [(x_0, 0), (x_1, 0), (x_1, 0.8), (x_0, 0.8)], C_, (0.3, 0.6, 0.7, 0.0), (0, -sy, 0))
    yi0, yi1 = -0.7 + 0.25, W + 0.7 - 0.25
    acc.poly([(x_0, yi0, DECK_T + 0.3), (x_1, yi0, DECK_T + 0.3), (x_1, yi1, DECK_T + 0.3), (x_0, yi1, DECK_T + 0.3)],
             [(x_0, yi0), (x_1, yi0), (x_1, yi1), (x_0, yi1)], M['basalt'], (0.2, 0.55, 0.8, 0.0), (0, 0, 1))
    return acc.to_mesh('PR_via_span')


def build_viaduct(c, M):
    span = via_span_mesh(M)
    for k, x in enumerate(VIA_PIERS):
        # 산악 협곡 상단(z = +18 m 기준)을 수평으로 가로지르는 대교량
        place(f'PR_via.{k:03d}', span, c, (x, VIA_Y0, 16.0), surface='wall')
    return span


# ═════════════════════════════ 4. 산악 배전/통신 전주 · 처진 케이블 · 국도 시설 · 탐사 전초기지 ═════════════════════════════
POLE_H = 12.0
RUNS = {
    'S': [(-100.0, -53.8), (-61.0, -53.8), (-22.0, -53.8), (17.0, -53.8), (56.0, -53.8), (95.0, -53.8), (134.0, -53.8)],
    'E': [(66.4, -29.0), (66.4, 8.0), (66.4, 36.0)],
}
WIRE_PTS = [
    (-0.85, 11.45, 0.42, 0.011, 'hv'), (0.0, 11.62, 0.38, 0.011, 'hv'), (0.85, 11.45, 0.45, 0.011, 'hv'),
    (-0.6, 10.55, 0.62, 0.014, 'lv'), (0.6, 10.55, 0.66, 0.014, 'lv'),
    (0.24, 7.05, 1.05, 0.042, 'tel'), (-0.24, 6.8, 1.2, 0.034, 'tel'),
]


def pole_mesh(M):
    acc = Acc()
    mk = lambda p, n: (0.6 * (1 - smoothstep(0.0, 0.5, p[2])), 0.3 + 0.55 * (1 - smoothstep(0.0, 1.0, p[2])),
                       1 - 0.45 * (1 - smoothstep(0, 1, p[2])), 0.4 * smoothstep(9.0, 12.0, p[2]))
    acc.cyl((0, 0, -0.4), (0, 0, POLE_H), 0.19, 0.12, 10, M['conc'], mk, caps=(False, True))
    acc.cyl((0, 0, 0.0), (0, 0, 1.8), 0.205, 0.198, 10, M['hazard'], (0.0, 0.5, 0.85, 0.0), caps=(False, True), uv_v=1 / 0.6)
    for z, L in ((11.4, 2.1), (10.5, 1.6)):
        acc.box((-L / 2, -0.06, z - 0.07), (L / 2, 0.06, z + 0.03), M['galv'], (0.0, 0.4, 0.9, 0.1))
        acc.cyl((-L / 2 + 0.2, 0, z - 0.05), (0, 0, z - 0.7), 0.018, 0.018, 4, M['galv'], (0, 0.4, 0.9, 0))
    for x, z, *_ in WIRE_PTS[:5]:
        acc.cyl((x, 0, z - 0.12), (x, 0, z + 0.05), 0.05, 0.035, 6, M['white'], (0.0, 0.3, 1.0, 0.0))
    return acc.to_mesh('PR_pole', weld=True, smooth=True, sharp=50)


def transformer_mesh(M):
    acc = Acc()
    mk = (0.0, 0.4, 0.9, 0.35)
    acc.cyl((0.55, 0, 8.4), (0.55, 0, 9.5), 0.3, 0.3, 12, M['galv'], mk)
    acc.cyl((0.55, 0, 9.5), (0.55, 0, 9.58), 0.33, 0.25, 12, M['galv'], mk)
    acc.box((0.12, -0.08, 8.6), (0.26, 0.08, 9.35), M['steel'], mk)
    return acc.to_mesh('PR_transformer', weld=True, smooth=True, sharp=45)


def catenary(a, b, sag, n=14):
    return [Vector(a).lerp(Vector(b), i / n) - Vector((0, 0, 4 * sag * (i / n) * (1 - i / n))) for i in range(n + 1)]


def tube(acc, pts, r, mat, sides=3):
    rings = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        ref = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
        e1 = t.cross(ref).normalized(); e2 = t.cross(e1).normalized()
        rings.append([p + (e1 * math.cos(2 * math.pi * k / sides) + e2 * math.sin(2 * math.pi * k / sides)) * r for k in range(sides)])
    s = 0.0
    mk = (0.0, 0.3, 1.0, 0.0)
    for i in range(len(pts) - 1):
        d = (pts[i + 1] - pts[i]).length
        for k in range(sides):
            a, b = rings[i][k], rings[i][(k + 1) % sides]; c, dd = rings[i + 1][(k + 1) % sides], rings[i + 1][k]
            mid = (a + b + c + dd) / 4 - (pts[i] + pts[i + 1]) / 2
            acc.poly([a, b, c, dd], [(k / sides, s), ((k + 1) / sides, s), ((k + 1) / sides, s + d), (k / sides, s + d)], mat, mk, tuple(mid))
        s += d


def pole_frames(gz):
    poles = {}
    for run, pts in RUNS.items():
        for i, p in enumerate(pts):
            q0 = pts[max(0, i - 1)]; q1 = pts[min(len(pts) - 1, i + 1)]
            ang = math.atan2(q1[1] - q0[1], q1[0] - q0[0])
            key = (round(p[0], 2), round(p[1], 2))
            if key not in poles:
                poles[key] = (ang - math.pi / 2, gz.z(p[0], p[1], 0.0))
    return poles


def attach(pole, k):
    (x, y), (rz, z0) = pole
    lx, lz = WIRE_PTS[k][0], WIRE_PTS[k][1]
    return Vector((x + math.cos(rz) * lx, y + math.sin(rz) * lx, z0 + lz))


def build_wires(c, M, poles):
    acc = Acc()
    rnd = random.Random(70)
    pk = {k: v for k, v in poles.items()}
    for run, pts in RUNS.items():
        for i in range(len(pts) - 1):
            A = ((round(pts[i][0], 2), round(pts[i][1], 2)), pk[(round(pts[i][0], 2), round(pts[i][1], 2))])
            B = ((round(pts[i + 1][0], 2), round(pts[i + 1][1], 2)), pk[(round(pts[i + 1][0], 2), round(pts[i + 1][1], 2))])
            span = math.dist(A[0], B[0])
            for k, (lx, lz, sag, r, tier) in enumerate(WIRE_PTS):
                a = attach(A, k); b = attach(B, k)
                s = sag * (span / 40.0) ** 2 * rnd.uniform(0.85, 1.2)
                tube(acc, catenary(a, b, s), r, M['wire'])
    return acc.to_obj('PR_wires', c, 'metal', weld=True, smooth=True, sharp=80)


def streetlight_mesh(M):
    acc = Acc()
    mk = lambda p, n: (0.3 * (1 - smoothstep(0, 0.4, p[2])), 0.3 + 0.5 * (1 - smoothstep(0, 1, p[2])), 1 - 0.4 * (1 - smoothstep(0, 1, p[2])), 0.3)
    acc.cyl((0, 0, -0.2), (0, 0, 0.5), 0.17, 0.15, 10, M['galv'], mk)
    acc.cyl((0, 0, 0.5), (0, 0, 8.4), 0.11, 0.07, 10, M['galv'], mk)
    pts = [Vector((0.0, 0, 8.3)), Vector((0.3, 0, 8.85)), Vector((0.9, 0, 9.1)), Vector((2.3, 0, 9.15))]
    for i in range(len(pts) - 1):
        acc.cyl(pts[i], pts[i + 1], 0.06, 0.05, 8, M['galv'], mk, caps=(False, False))
    acc.box((2.1, -0.17, 8.98), (2.85, 0.17, 9.22), M['galv'], (0, 0.4, 0.9, 0.2))
    acc.box((2.15, -0.13, 8.94), (2.8, 0.13, 8.98), M['white'], (0, 0.3, 1.0, 0.0), faces='z')
    return acc.to_mesh('PR_streetlight', weld=True, smooth=True, sharp=40)


def bollard_mesh(M):
    acc = Acc()
    acc.cyl((0, 0, -0.1), (0, 0, 0.82), 0.07, 0.07, 10, M['galv'], lambda p, n: (0.0, 0.3 + 0.5 * (1 - smoothstep(0, 0.4, p[2])), 1 - 0.3 * (1 - smoothstep(0, 0.4, p[2])), 0.0))
    acc.cyl((0, 0, 0.82), (0, 0, 0.87), 0.07, 0.03, 10, M['galv'], (0, 0.3, 1, 0))
    acc.cyl((0, 0, 0.62), (0, 0, 0.67), 0.072, 0.072, 10, M['hazard'], (0, 0.3, 1, 0), caps=(False, False))
    return acc.to_mesh('PR_bollard', weld=True, smooth=True, sharp=50)


def bench_mesh(M):
    acc = Acc()
    mk = lambda p, n: (0.4 * smoothstep(0.6, 0.9, n[2]), 0.35 + 0.45 * (1 - smoothstep(0.0, 0.3, p[2])), 1 - 0.4 * (1 - smoothstep(0, 0.3, p[2])), 0.0)
    acc.box((-0.9, -0.3, -0.05), (0.9, 0.3, 0.44), M['trim'], mk)
    return acc.to_mesh('PR_bench')


def container_mesh(M):
    """UCA/브리짓 스타일 산악 관측·전초기지 컨테이너 모듈(6.06 × 2.44 × 2.6 m)."""
    acc = Acc()
    mk = lambda p, n: (0.28 * smoothstep(0.6, 0.9, n[2]), 0.38 + 0.5 * (1 - smoothstep(0.2, 0.9, p[2])),
                       1 - 0.45 * (1 - smoothstep(0.2, 0.9, p[2])), 0.55)
    x0, x1, y0, y1, z0, z1 = -3.03, 3.03, -1.22, 1.22, 0.2, 2.8
    acc.box((x0, y0, z0), (x1, y1, z1), M['corr'], mk, faces='xXyYZ')
    acc.box((x0, y0, z1), (x1, y1, z1 + 0.08), M['steel'], (0.3, 0.55, 0.9, 0.0), faces='ZxXyY')
    # 측면 관측 창
    acc.poly([(-1.2, y0 - 0.01, 1.2), (1.2, y0 - 0.01, 1.2), (1.2, y0 - 0.01, 2.1), (-1.2, y0 - 0.01, 2.1)],
             [(0, 0), (2, 0), (2, 1), (0, 1)], M['glass'], (0, 0.2, 1, 0), (0, -1, 0))
    for x in (x0 + 0.3, x1 - 0.3):
        for y in (y0 + 0.3, y1 - 0.3):
            acc.box((x - 0.2, y - 0.2, -0.15), (x + 0.2, y + 0.2, z0), M['trim'], (0.3, 0.6, 0.6, 0.0), faces='xXyYZ')
    return acc.to_mesh('PR_container')


def truck_mesh(M, col):
    """탐사 물류 화물차(캡 + 경사 앞유리 + 적재함 + 바퀴)."""
    acc = Acc()
    uv = pal_uv(4, col); mk = (0.0, 0.4, 0.9, 0.2)
    cab = [(-0.85, 1.25, 0.5), (0.85, 1.25, 0.5), (0.85, 2.7, 0.5), (-0.85, 2.7, 0.5)]
    top = [(-0.82, 1.3, 2.0), (0.82, 1.3, 2.0), (0.82, 2.35, 2.0), (-0.82, 2.35, 2.0)]
    mid = [(-0.85, 2.7, 1.25), (0.85, 2.7, 1.25)]
    S_ = M['sign']
    acc.poly([cab[0], cab[1], top[1], top[0]], [uv] * 4, S_, mk, (0, -1, 0))
    acc.poly([cab[1], cab[2], mid[1], top[2], top[1]], [uv] * 5, S_, mk, (1, 0, 0))
    acc.poly([cab[3], cab[0], top[0], top[3], mid[0]], [uv] * 5, S_, mk, (-1, 0, 0))
    acc.poly([cab[2], cab[3], mid[0], mid[1]], [uv] * 4, S_, mk, (0, 1, 0))
    acc.poly([mid[1], mid[0], top[3], top[2]], [(0, 0), (1, 0), (1, 1), (0, 1)], M['glass'], (0, 0.2, 1, 0), (0, 0.6, 0.4))
    acc.poly(top, [uv] * 4, S_, mk, (0, 0, 1))
    acc.box((-0.85, -2.1, 0.62), (0.85, 1.2, 0.8), M['steel'], mk)
    for sx in (-1, 1):
        acc.box((sx * 0.85 - (0.04 if sx > 0 else 0), -2.1, 0.8), (sx * 0.85 + (0.0 if sx > 0 else 0.04), 1.2, 1.2), M['galv'], (0, 0.4, 0.9, 0.2))
    acc.box((-0.85, -2.1, 0.8), (0.85, -2.06, 1.2), M['galv'], (0, 0.4, 0.9, 0.2))
    for x in (-0.78, 0.78):
        for y in (-1.3, 1.95):
            acc.cyl((x - 0.1, y, 0.32), (x + 0.1, y, 0.32), 0.32, 0.32, 10, M['steel'], (0, 0.5, 0.7, 0))
    me = acc.to_mesh(f'PR_truck{col}', weld=False)
    for p in me.polygons:
        p.use_smooth = False
    return me


def build_outposts_and_roadside(c, M, P, protos, gz):
    """국도변 가로등(PR_light.* — 밤 조명 호환), 볼라드, 콘크리트 방호벽, 탐사 전초기지 컨테이너 & 차량 배치."""
    rnd = random.Random(99)
    lt = protos['light']
    k = 0
    for x in (-95, -65, -35, -5, 32, 62, 92, 122, 152):
        y = G.TT[1] + 0.55
        place(f'PR_light.{k:03d}', lt, c, (x, y, gz.z(x, y)), -math.pi / 2, surface='metal'); k += 1
    for x in (-75, -45, 15, 45, 75, 105, 135):
        y = G.TT[0] - 0.55
        place(f'PR_light.{k:03d}', lt, c, (x, y, gz.z(x, y)), math.pi / 2, surface='metal'); k += 1

    bo = protos['bollard']; kb = 0
    for y in (G.TT[1] + 0.45, G.TT[0] - 0.45):
        for x in (G.XW - 2.2, G.XW - 1.1, G.XW, G.XW + 1.1, G.XW + 2.2):
            place(f'PR_bollard.{kb:03d}', bo, c, (x, y, gz.z(x, y)), 0.0, surface='metal'); kb += 1

    # 국도변 및 계곡 진입로 콘크리트 방호벽
    barriers = [
        (-56.0, -34.2, 0.0), (-54.2, -34.3, 0.04),
        (36.8, -28.5, 0.02), (38.6, -28.4, -0.03),
        (48.8, -28.4, 0.03), (50.6, -28.5, -0.02),
        (74.8, 34.0, math.pi / 2), (74.8, 36.0, math.pi / 2),
    ]
    for i, (x, y, rz) in enumerate(barriers):
        place(f'PR_ph_barrier.{i:03d}', P['barrier'], c, (x, y, gz.z(x, y)), rz, surface='wall')

    # 분전함(utility box)
    for i, (x, y, rz) in enumerate(((-70.0, -53.2, 0.0), (-28.0, -53.2, 0.0), (65.8, -26.0, math.pi / 2), (74.6, 18.0, -math.pi / 2))):
        place(f'PR_ph_ubox.{i:03d}', P['ubox'], c, (x, y, gz.z(x, y)), rz, surface='metal')

    # 산악 탐사 전초기지 컨테이너 & 탐사 트럭 (계곡 입구 동편 및 FaceArch 지원 패드)
    for i, (x, y, rz) in enumerate(((57.5, -21.5, 0.04), (82.0, -24.0, 0.0), (82.0, 28.0, -0.05))):
        place(f'PR_container.{i:03d}', protos['container'], c, (x, y, gz.z(x, y)), rz, surface='metal')
    for i, (x, y, rz) in enumerate(((44.8, -30.5, 0.08), (78.5, -14.0, math.pi / 2), (88.0, -24.0, 0.0))):
        place(f'PR_truck.{i:03d}', protos['truck_w' if i % 2 == 0 else 'truck_b'], c, (x, y, gz.z(x, y)), rz, surface='metal')
    for i, (x, y, rz) in enumerate(((76.5, 4.0, math.pi / 2), (94.0, -24.0, 0.03))):
        place(f'PR_ph_car.{i:03d}', P['car'], c, (x, y, gz.z(x, y)), rz, surface='metal')

    # HAUS 전정 벤치 2개 및 화단 관목
    for i in range(2):
        s = bpy.data.objects.get(f'SLOT_bench_{i}')
        if s:
            place(f'PR_bench.{i}', protos['bench'], c, tuple(s.location), s.rotation_euler.z, surface='wall')
        s = bpy.data.objects.get(f'SLOT_planting_{i}')
        if s:
            w = s['size'][0]
            for j in range(5):
                x = s.location.x - w / 2 + 1.2 + (w - 2.4) * j / 4
                place(f'PR_ph_shrub.{i}{j}', P['shrub'], c, (x, s.location.y, s.location.z), rnd.uniform(0, 6.3),
                      (rnd.uniform(0.38, 0.5),) * 3, surface='foliage')

    # 남측 보도 가로수 구덩이에도 고산 관목 식재
    for i, (x, y) in enumerate(G.PITS):
        if i % 2 == 0:
            place(f'PR_ph_shrub.pit{i:02d}', P['shrub'], c, (x, y, gz.z(x + 0.8, y, -0.03)), rnd.uniform(0, 6.3),
                  rnd.uniform(0.45, 0.68), surface='foliage')


# ═════════════════════════════ 앵커 · 카메라 · 슬롯 ═════════════════════════════
ANCHORS = [
    ('haus_podium', 'building', 'HAUS 포디움 1–5F', (0.0, -26.0, 11.0)),
    ('haus_tower', 'building', 'HAUS 타워 6–11F', (0.0, -20.0, 42.0)),
    ('haus_crown', 'building', 'HAUS 크라운 11–14F', (0.0, -26.0, 70.0)),
    ('haus_garden', 'building', '전정 — 흰 자갈 화단과 석재 마당', (-12.0, -28.0, 0.8)),
    ('facearch_eyes', 'building', 'FaceArch 두 면의 눈', (100.7, 8.4, 17.0)),
    ('facearch_legs', 'building', 'FaceArch 필로티 다리', (108.0, 14.0, 4.5)),
    ('facearch_body', 'building', 'FaceArch 둥근 삼각 매스', (105.0, 15.0, 25.0)),
    ('viaduct', 'present', '빙하 계곡 층리 대암벽과 산악 고가교', (38.0, VIA_Y0 - 4.5, 24.0)),
    ('brick_belt', 'present', '계곡 입구의 빙하 표석 무더기', (66.0, 60.0, 11.5)),
    ('cafe_canopy', 'present', '산악 전초기지 컨테이너 모듈', (57.5, -21.5, 2.8)),
    ('wires', 'present', '산악 횡단 국도 가공선과 황흑 전주', (17.0, -53.8, 9.5)),
    ('lot_moss', 'nature', '고산 올리브 이끼 군락 — 윗면·수변', (53.0, 16.2, 0.3)),
    ('lot_water', 'nature', '갈래 시냇물과 거울 물웅덩이', (39.5, 2.5, 0.0)),
    ('lot_rocks', 'nature', '표석·잡석 3단 스케일', (50.5, 4.5, 1.8)),
    ('ginkgo', 'nature', '수변 고산 관목과 사초 다발', (33.5, 21.0, 1.2)),
]


def _eye_anchor():
    vs = []
    ref = bpy.data.collections.get('NW_ref_facearch')
    for o in (ref.all_objects if ref else []):
        if o.type == 'MESH' and any(s.material and s.material.name.startswith('eyeball') for s in o.material_slots):
            vs += [o.matrix_world @ v.co for v in o.data.vertices]
    if not vs:
        return None
    c = sum(vs, Vector()) / len(vs)
    ax = max(range(2), key=lambda i: max(v[i] for v in vs) - min(v[i] for v in vs))
    side = [v for v in vs if v[ax] < c[ax]]
    other = [v for v in vs if v[ax] >= c[ax]]
    ca = sum(side, Vector()) / len(side); cb = sum(other, Vector()) / len(other)
    best = min((ca, cb), key=lambda p: p.y + 0.5 * p.x)
    return tuple(best)


def build_anchors(sc, gz):
    A = lib.coll('NW_anchors', sc)
    for e in list(A.objects):
        bpy.data.objects.remove(e, do_unlink=True)
    for aid, layer, title, pos in ANCHORS:
        if aid == 'facearch_eyes':
            pos = _eye_anchor() or pos
        elif aid in ('lot_moss', 'lot_water'):
            pos = (pos[0], pos[1], gz.z(pos[0], pos[1]) + 0.05)
        e = bpy.data.objects.new(f'ANCHOR_{aid}', None)
        e.empty_display_type = 'SPHERE'; e.empty_display_size = 1.5
        e.location = pos
        e['nw_layer'] = layer; e['nw_title'] = title
        A.objects.link(e)
    return A


def build_camera(sc):
    lay = lib.coll('NW_layout', sc)
    nm = 'CAM_viaduct'
    loc, tgt, lens = CAM_VIA
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
    cam.data.lens = lens; cam.data.sensor_width = 36.0
    cam.data.clip_start = 0.1; cam.data.clip_end = 4000.0
    cam['target'] = list(tgt)
    return cam


def build_slots(sc):
    S = lib.coll('NW_slots_present', sc)
    for e in list(S.objects):
        bpy.data.objects.remove(e, do_unlink=True)
    x0, x1 = VIA_PIERS[0] - 1.2, VIA_PIERS[-1] + VIA_SPAN - 1.2
    e = bpy.data.objects.new('SLOT_viaduct_led', None)
    e.empty_display_type = 'PLAIN_AXES'; e.empty_display_size = 2.0
    e.location = ((x0 + x1) / 2, VIA_Y0 - 0.7, 16.0 + DECK_B)
    e['x0'] = x0; e['x1'] = x1; e['y'] = VIA_Y0 - 0.7; e['z'] = 16.0 + DECK_B
    e['station'] = [STATION[0] - 1.2, STATION[1] + 1.2, VIA_Y0 - 0.7, 16.0 + DECK_B]
    S.objects.link(e)
    S.hide_render = True
    return S


# ═════════════════════════════ 조립 ═════════════════════════════
GZ = None


def clear_present(sc):
    P = lib.coll('NW_present', sc)
    lib.clear_coll(P)
    for nm in ('NW_tmp_import',):
        c = bpy.data.collections.get(nm)
        if c is not None:
            for o in list(c.objects):
                bpy.data.objects.remove(o, do_unlink=True)
            bpy.data.collections.remove(c)
    cleanup_imports()
    return P


def build():
    global GZ, STATIC
    t0 = time.time()
    sc = lib.get_scene(True)
    if bpy.data.objects.get('GR_vacant') is None or bpy.data.objects.get('GR_terrain') is None:
        G.build()
    lib.setup_render(sc)
    lib.setup_world(sc)
    C = clear_present(sc)
    GZ = GroundZ()
    print('ground sampler', round(time.time() - t0, 1))
    M = materials()
    MATS.clear(); MATS.update(M)
    STATIC = Acc()
    P = import_protos(sc)
    print('imports', round(time.time() - t0, 1))
    protos = dict(P)
    protos.update({
        'light': streetlight_mesh(M),
        'bollard': bollard_mesh(M),
        'bench': bench_mesh(M),
        'container': container_mesh(M),
        'truck_w': truck_mesh(M, 0),
        'truck_b': truck_mesh(M, 2),
    })
    P['weed_dry'] = weed_mesh('PR_weed_dry', M, 0.0, 0.5, 0.82)
    P['weed_dry_t'] = weed_mesh('PR_weed_dry_t', M, 0.0, 0.5, 1.18, 4)
    P['weed_green'] = weed_mesh('PR_weed_green', M, 0.5, 1.0, 0.74)

    # 1. 산악 대절벽 + 노두 + 스캔 암벽
    build_mountain_cliffs_and_outcrops(C, M, P, GZ)
    # 2. 북쪽 산악 콘크리트 고가교
    build_viaduct(C, M)
    # 3. 전주 & 처진 케이블
    pm = pole_mesh(M); tm = transformer_mesh(M)
    poles = pole_frames(GZ)
    for i, (key, (rz, z0)) in enumerate(sorted(poles.items())):
        place(f'PR_pole.{i:03d}', pm, C, (key[0], key[1], z0), rz, surface='wall')
        if i % 3 == 1:
            place(f'PR_transformer.{i:03d}', tm, C, (key[0], key[1], z0), rz + math.pi / 2, surface='metal')
    build_wires(C, M, poles)
    # 4. 국도 시설 & 전초기지
    build_outposts_and_roadside(C, M, P, protos, GZ)
    # 5. 계곡 분지 자연 포켓 (3단 바위·사초·관목)
    build_valley_nature(C, M, P, GZ)

    # 정적 절벽 묶음 → 재질별 메시 PR_static_<재질> (Cycles 정점 AO 베이킹 대상!)
    for m, sub in sorted(STATIC.split().items(), key=lambda kv: kv[0].name):
        sub.to_obj(f'PR_static_{m.name}', C, m.get('nw_surface', 'rock'), weld=True, smooth=True, sharp=40)

    build_anchors(sc, GZ)
    build_camera(sc)
    build_slots(sc)
    for me in [me for me in bpy.data.meshes if me.get(TAG) and me.users == 0]:
        bpy.data.meshes.remove(me)
    print('light probes', lib.bake_light_probes(sc), round(time.time() - t0, 1))
    r = report()
    print('done', round(time.time() - t0, 1))
    return r


def report():
    C = bpy.data.collections['NW_present']
    objs = [o for o in C.all_objects if o.type == 'MESH']
    tri_total = lib.tri_count(objs)
    mats = sorted({s.material.name for o in objs for s in o.material_slots if s.material})
    out = {'objects': len(objs), 'tris_render': tri_total, 'materials': len(mats), 'mat_names': mats}
    print('NW_present (DS2)', out)
    return out


def render_views(suffix='', res=(1280, 720), samples=32, cams=('street', 'viaduct', 'lot', 'aerial')):
    sc = lib.get_scene(True)
    out = []
    for c in cams:
        p = os.path.join(lib.OUT, 'renders', f'ds2-t3-{c}{suffix}.png')
        lib.render(sc, bpy.data.objects[f'CAM_{c}'], p, res, samples)
        out.append(p)
    sc.render.resolution_x, sc.render.resolution_y = 1280, 720
    sc.camera = bpy.data.objects['CAM_street']
    return out


if __name__ == '__main__':
    build()
