# HAUS NOWHERE — 성수 2041 / Task 3: 현재 층(성수 블록)과 자연 포켓.
# 실행: MCP 에서 exec(open('<ROOT>/tools/nowhere/blender/present.py').read(), {'__name__': '__main__'})
#       헤드리스: blender -b --factory-startup --python-expr "exec(open('.../present.py').read(), {'__name__': '__main__'})"
#       (NW_ground 가 없으면 ground.build() 를 먼저 부른다 → 빈 파일에서도 같은 결과)
# 매 실행마다 NW_present · NW_anchors · NW_slots_present 를 비우고 처음부터 다시 만든다(멱등).
# Poly Haven 모델은 매번 데이터로만 다시 읽고(gltf), 이 스크립트가 만든 데이터블록에는 nw_present_src 표식을 달아
# 다음 실행 때 지운다(다른 씬·룩뎁이 쓰는 같은 이름의 재질·이미지는 건드리지 않는다).
#
# 만드는 것
#   NW_present (→ nowhere-present.glb)
#     PR_bldg_*      건물 합친 메시(지역별): 벽돌 공장 띠, 연립·상가주택, 길 건너 상가·9F 복합, FaceArch 블록
#     PR_apt.*       12~13F 아파트 판상 3동(한 메시의 링크 복제)
#     PR_via.*       2호선 고가: 아치 교각 경간(링크 복제) + 벽돌 충전벽 + 성수역형 녹색 승강장 지붕
#     PR_pole.*, PR_wires   전신주(황흑 보호대·변압기·애자)와 처진 전선 다발
#     PR_light.*, PR_signal.*, PR_bollard.*   가로등(한국형 단주)·신호기둥·볼라드
#     PR_ph_*.*      Poly Haven 소품(Decimate, 링크 복제): 셔터, 실외기, 분전함, 공중전화, 소화기함, CCTV, 휴지통,
#                    덮개 씌운 차, 방호벽, 홈통, 비상계단, 공장 창·차고 문, 바위, 이끼, 풀, 관목
#     PR_lot_*       빈터 자연 포켓: 공사 가림막(일부 기울고 쓰러짐), 현무암 조경석·잡석 3단 스케일, 이끼, 잡초·마른 풀
#     PR_ginkgo.*    은행나무 가로수(저폴리 줄기 + 알파 카드)
#   NW_anchors        ANCHOR_* 빈 객체(nw_layer ∈ building·present·nature, nw_title) — layout.json 으로만 나간다
#   NW_layout         CAM_viaduct 추가(ground.py 의 카메라는 건드리지 않는다)
#   NW_slots_present  SLOT_viaduct_led — Task 4 가 고가 하부에 파란 LED 선을 붙일 자리(내보내지 않음)
#
# 규약(§5, lib.py 머리말)
#   - 모든 메시는 정점색 nw_mask(R 이끼, G 젖음, B AO)를 활성·렌더 색으로 가진다. 벽은 A = 빗물 얼룩 세기(창턱·
#     파라펫 아래에서 아래로 흐름)를 추가로 쓴다 — Task 5/6 은 A 를 무시해도 되고, 쓰면 같은 의미다.
#   - 객체에는 nw_surface 와 nw_vmask=1. 재질에도 nw_surface 힌트를 단다(합친 건물 메시 안의 유리 슬롯 등).
#   - UVMap 은 미터 단위(벽: u = 외곽선 누적 길이, v = 높이). 창 유리 면만 창 한 칸 = 0..n(창살 모듈 반복).
#     간판 면은 간판 아틀라스의 칸(u 0..1/8 단위). NW_ground 와 달리 UVMap_mask 는 만들지 않는다.
import bpy, bmesh, os, sys, math, random, importlib, time, re, json, zlib
from mathutils import Vector, Matrix, Euler

ROOT = os.environ.get('NW_ROOT', '/Users/gm_yeonho/new-work/so/so-viewer-monster1267')
sys.dont_write_bytecode = True          # tools/ 아래에 __pycache__ 를 만들지 않는다
_HERE = os.path.join(ROOT, 'tools', 'nowhere', 'blender')
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)
import lib
importlib.reload(lib)
import ground                            # 배치 상수(블록·보도·빈터·가로수 구덩이)를 같은 정의에서 읽는다
importlib.reload(ground)
from lib import srgb, smoothstep, clamp01, n2

G = ground
GEN = os.path.join(lib.OUT, 'gen')       # 이 스크립트가 그려 만드는 작은 텍스처(창살·황흑 줄무늬·은행잎·가림막·간판)
TAG = 'nw_present_src'                   # 이 스크립트가 가져온 재질·이미지 표식
INST = []                                # (proto 키, 위치, 회전 z, 배율) — 건물 생성 중 쌓아 두었다가 한꺼번에 배치

# ═════════════════════════════ 배치 상수 (§3, Blender 좌표 m) ═════════════════════════════
VIA_Y0, VIA_Y1 = 150.0, 160.0            # 2호선 고가 폭 10 m
VIA_SPAN, VIA_PIER = 22.0, 2.4           # 경간 22 m, 교각 폭
VIA_PIERS = [-130.0 + VIA_SPAN * k for k in range(14)]          # −130 … +156 (서쪽 끝 장면 밖까지)
VIA_SPRING, VIA_CROWN = 5.4, 7.5          # 아치 기점·정점 높이
DECK_B, DECK_T = 7.9, 9.0                 # 상판 하면·상면(자갈 도상 +0.3 → 레일면 약 9.3 m)
STATION = (24.0, 90.0)                    # 성수역형 승강장 3경간(교각 24·46·68·90 사이)
CAM_VIA = ((13.0, 159.2, 1.65), (13.0, 0.0, 26.5), 20.0)   # 고가 아래 아치 안에서 남쪽 공장 띠 너머 HAUS 타워

# ═════════════════════════════ 작은 도우미 ═════════════════════════════
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
    """해시 → 0..1. zlib.crc32 라 프로세스·PYTHONHASHSEED 와 무관하게 결정적."""
    return random.Random(zlib.crc32(repr(a).encode('utf-8'))).random()


class Acc:
    """여러 재질 슬롯을 가진 합친 메시. 면마다 고유 정점(평면 셰이딩, 면별 정점 마스크가 정확).
    weld=True 로 메시를 만들면 같은 위치 정점을 합쳐 부드러운 셰이딩(원통·전선·줄기)."""

    def __init__(self):
        self.V = []; self.F = []; self.FM = []; self.UV = []; self.MK = []; self.TN = []; self.mats = []
        self.tint = (0.0, 0.0)      # 지금 더하는 면들의 nw_tint(색상, 명도) — building() 이 동마다 바꾼다

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
        """축 정렬 상자(c0 최소, c1 최대). M 이 있으면 변환 행렬을 적용(UV 는 로컬 미터)."""
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
        """p0→p1 원통(반지름 r0→r1). UV u = 둘레 m, v = 길이 m × uv_v."""
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
        """임의 메시(V, F)를 변환 M 으로 더한다. uvfn(로컬 좌표) → (u, v), 없으면 면 축 투영(미터)."""
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
        if me is not None:
            if me.users == 0:
                bpy.data.meshes.remove(me)
            else:
                raise RuntimeError(f'메시 {name} 가 아직 쓰이고 있다(정리 순서 확인)')
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.V, [], self.F)
        if len(me.polygons) != len(self.F):
            raise RuntimeError(f'{name}: 면 수 불일치')
        for m in self.mats:
            me.materials.append(m)
        me.polygons.foreach_set('material_index', self.FM)
        lib.set_uv(me, 'UVMap', None, per_loop=[uv for f in self.UV for uv in f])
        lib.write_mask_values(me, self.MK)                     # COLOR_0 = RGB, A = 1
        st = [m[3] if len(m) > 3 else 0.0 for m in self.MK]
        if any(v > 0.0 for v in st):
            lib.write_float_attr(me, 'nw_streak', st)          # 빗물 얼룩 세기는 별도 속성(머리말)
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

    def tris(self):
        return sum(len(f) - 2 for f in self.F)

    def extend(self, other):
        """다른 Acc 를 그대로 덧붙인다(재질 슬롯은 객체로 맞춰 다시 번호)."""
        base = len(self.V)
        self.V.extend(other.V); self.MK.extend(other.MK); self.TN.extend(other.TN); self.UV.extend(other.UV)
        self.F.extend(tuple(base + i for i in f) for f in other.F)
        self.FM.extend(self._mi(other.mats[k]) for k in other.FM)

    def split(self):
        """재질별 Acc 로 나눈다(정점은 면마다 고유라 그대로 옮긴다)."""
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
    """NW_ground 의 실제 메시 위 높이(보도·대지·빈터·전정·차도 순서로 조회)."""

    def __init__(self):
        self.s = []
        for nm in ('GR_vacant', 'GR_forecourt', 'GR_sidewalk', 'GR_blocklot', 'GR_road'):
            o = bpy.data.objects.get(nm)
            if o is None:
                continue
            me = o.data
            V = [tuple(o.matrix_world @ v.co) for v in me.vertices]
            T = [tuple(p.vertices) for p in me.polygons]
            self.s.append(lib.Sampler(V, T, 2.0))

    def z(self, x, y, default=0.0):
        for s in self.s:
            z = s.z(x, y)
            if z is not None:
                return z
        return default


# ═════════════════════════════ 그려 만드는 텍스처 ═════════════════════════════
def _hex(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def gen_image(name, w, h, painter):
    """painter(buf, w, h) 가 sRGB 0..1 RGBA 리스트를 채운다 → build/nowhere/gen/<name>.png 로 저장(결정적)."""
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


def _put(buf, w, x, y, c, a=1.0):
    i = (y * w + x) * 4
    buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = a


def paint_window(buf, w, h):
    """창 한 칸(가로 2 × 세로 3 판유리, 강철 창틀). 성수 공장 철제 창과 연립 알루미늄 창의 공통 모듈."""
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
    """황흑 사선 줄무늬(전주 보호대), 닳은 자국."""
    rnd = random.Random(5)
    yel = _hex('#F2C200'); blk = _hex('#1A1A1A')
    for y in range(h):
        for x in range(w):
            s = ((x + y) * 4 // w) % 2
            c = yel if s == 0 else blk
            if rnd.random() < 0.05:
                k = rnd.uniform(0.55, 0.85); c = (c[0] * k, c[1] * k, c[2] * k)
            _put(buf, w, x, y, c)


def paint_leaves(buf, w, h):
    """은행잎 덩어리(늦가을 황록). 부채꼴 잎을 덩어리 안에 흩뿌리고, 덩어리 밖은 투명."""
    rnd = random.Random(23)
    pal = [_hex(c) for c in ('#D9BE38', '#E3C84A', '#C9A92E', '#E8CF5C', '#B9AA3A', '#DDB93A', '#A9A23C', '#EBD36A')]
    for i in range(w * h):
        buf[i * 4:i * 4 + 4] = [0.75, 0.66, 0.2, 0.0]
    lobes = [(rnd.uniform(0.3, 0.7), rnd.uniform(0.3, 0.7), rnd.uniform(0.18, 0.3)) for _ in range(7)]
    for k in range(1900):
        for _ in range(20):
            x = rnd.random(); y = rnd.random()
            if any((x - cx) ** 2 + (y - cy) ** 2 < r * r for cx, cy, r in lobes):
                break
        R = rnd.uniform(5.0, 9.0); ang = rnd.uniform(0, 2 * math.pi); spr = math.radians(rnd.uniform(90, 130))
        base = pal[rnd.randrange(len(pal))]
        shade = 0.62 + 0.38 * y + rnd.uniform(-0.08, 0.08)      # 아래쪽 잎은 그늘
        col = tuple(min(1.0, c * shade) for c in base)
        px, py = int(x * w), int(y * h)
        r = int(R) + 1
        for yy in range(max(0, py - r), min(h, py + r + 1)):
            for xx in range(max(0, px - r), min(w, px + r + 1)):
                dx = xx - px; dy = yy - py; d = math.hypot(dx, dy)
                if d > R:
                    continue
                a = math.atan2(dy, dx) - ang
                a = (a + math.pi) % (2 * math.pi) - math.pi
                if abs(a) < spr / 2 or d < 1.2:
                    c = tuple(v * (0.82 + 0.18 * d / R) for v in col)
                    _put(buf, w, xx, yy, c, 1.0)


def paint_hoarding(buf, w, h):
    """공사 가림막 패널 아틀라스: 왼쪽 반 = 흰 골판 + 아래 녹색 띠, 오른쪽 반 = 회색 골판. 아래쪽 오염·세로 얼룩."""
    rnd = random.Random(9)
    wht = _hex('#D7D9D3'); grn = _hex('#5E8268'); gry = _hex('#A3A7A3')
    streak = [rnd.uniform(0.0, 1.0) for _ in range(w)]
    for y in range(h):
        fy = y / h
        for x in range(w):
            half = x >= w // 2
            lx = (x % (w // 2)) / (w // 2)
            c = gry if half else (grn if fy < 0.13 else wht)
            rib = 0.93 if (x % 12) in (0, 1) else 1.0
            dirt = 1.0 - 0.35 * max(0.0, 0.25 - fy) / 0.25
            st = 1.0 - (0.12 if streak[x] > 0.86 and fy < 0.85 else 0.0) * (1 - fy)
            k = rib * dirt * st * rnd.uniform(0.97, 1.03)
            _put(buf, w, x, y, (c[0] * k, c[1] * k, c[2] * k))


def paint_weeds(buf, w, h):
    """잡초·마른 풀 다발 카드 아틀라스: 왼쪽 반 = 마른 풀(DS 의 짙은 황갈색 다발), 오른쪽 반 = 늦가을 황록 잡초. 아래 가운데에서
    부채꼴로 뻗는 가는 잎과 이삭. 나머지는 투명."""
    rnd = random.Random(41)
    half = w // 2
    for y in range(h):
        for x in range(w):
            _put(buf, w, x, y, _hex('#9A8A5C') if x < half else _hex('#8C8E48'), 0.0)   # 투명 영역도 잎 색(가장자리 번짐 방지)
    for side in (0, 1):
        pal = [_hex(c) for c in (('#B3A06A', '#C4AF78', '#9C8A5A', '#D0BC86', '#857650') if side == 0 else
                                 ('#8E9A48', '#A9A64C', '#C2B35A', '#7C8640', '#9E8E4A'))]
        for k in range(30):
            x0 = side * half + half * rnd.uniform(0.42, 0.58); y0 = 0.0
            ang = math.radians(rnd.uniform(-50, 50)); L = h * rnd.uniform(0.4, 0.97)
            bend = rnd.uniform(-0.8, 0.8); col = pal[rnd.randrange(len(pal))]
            wd = rnd.uniform(0.7, 1.4)
            steps = int(L / 1.2)
            for i in range(steps):
                t = i / steps
                a = ang + bend * t * t
                x = x0 + math.sin(a) * L * t; y = y0 + math.cos(a) * L * t
                r = wd * (1 - 0.8 * t)
                for yy in range(int(y - r) - 1, int(y + r) + 2):
                    for xx in range(int(x - r) - 1, int(x + r) + 2):
                        if 0 <= xx < w and 0 <= yy < h and side * half <= xx < (side + 1) * half and (xx - x) ** 2 + (yy - y) ** 2 <= r * r + 0.3:
                            sh = 0.75 + 0.25 * t
                            _put(buf, w, xx, yy, tuple(c * sh for c in col))
            if rnd.random() < 0.35:               # 이삭
                for j in range(26):
                    t = 1.0 - j / 120.0
                    a = ang + bend * t * t
                    x = x0 + math.sin(a) * L * t + rnd.uniform(-1.5, 1.5); y = y0 + math.cos(a) * L * t
                    xx, yy = int(x), int(y)
                    if 0 <= xx < w and 0 <= yy < h and side * half <= xx < (side + 1) * half:
                        _put(buf, w, xx, yy, tuple(c * 1.1 for c in pal[3]))


# 간판·차양·차량 색 팔레트(8 × 8 칸, sRGB, 위 행부터). 간판 재질 2개가 이 한 장을 공유한다 — 색은 면의 UV 가 고른 칸.
PALETTE = [
    ['#E8E6DF', '#2F4F8F', '#B4372E', '#F0C52E', '#3A6E4B', '#1F2A33', '#C8C8C2', '#8E2B2B'],   # 0 간판 바탕
    ['#FFFFFF', '#D93A2E', '#F2C200', '#1A1A1A', '#1E5BB8', '#2E8B57', '#F28C28', '#DADADA'],   # 1 글자
    ['#2F5D46', '#7A2E25', '#24395E', '#8C8C84', '#C9A227', '#5B4636', '#E0DED6', '#3B3B3B'],   # 2 차양
    ['#2A2B2D', '#9EA2A1', '#6B6E70', '#B9B6AC', '#E33739', '#53C8D9', '#FDD25B', '#43ABA7'],   # 3 틀·포인트
    ['#D9DAD6', '#BFC3C1', '#4F6B8A', '#8A3B32', '#2C2E30', '#A7A9A4', '#5E7A5A', '#C8B79A'],   # 4 차체(흰·회·청·적·흑·은·녹·베이지)
] + [['#808080'] * 8] * 3


def pal_uv(r, c):
    return ((c + 0.5) / 8.0, 1.0 - (r + 0.5) / 8.0)


def paint_palette(buf, w, h):
    for y in range(h):
        r = 7 - (y * 8) // h
        for x in range(w):
            _put(buf, w, x, y, _hex(PALETTE[r][(x * 8) // w]))


# ═════════════════════════════ 재질 ═════════════════════════════
def _guard(name):
    """지면(NW_ground)이 쓰는 재질 이름과 겹치면 멈춘다 — lib.Mat 는 같은 이름 재질을 비우고 다시 만들기 때문(Task 2 재질 보호)."""
    m = bpy.data.materials.get(name)
    G_ = bpy.data.collections.get('NW_ground')
    if m is not None and G_ is not None and any(m in [s.material for s in o.material_slots] for o in G_.all_objects if o.type == 'MESH'):
        raise RuntimeError(f'재질 이름 {name} 은 NW_ground 가 쓰는 재질이다 — 다른 이름을 쓴다')


def _streaks(M, color, amount, dark=(0.34, 0.31, 0.29, 1.0)):
    """세로 빗물 얼룩: UV(u 가로 m, v 높이 m)에서 세로로 늘인 노이즈 × 정점 속성 nw_streak(창턱·파라펫 아래 흐름 세기).
    dark: 얼룩 쪽 곱셈 색(벽돌·미장은 그을음 회갈, 골함석은 녹 갈색)."""
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


def mat_tex(name, tid, size, tint=None, sat=1.0, gain=1.0, res='2k', normal=1.0, base_wet=0.25, moss_bias=0.0,
            crevice_moss=2.0, porosity=0.5, wet_gloss=0.6, streak=0.0, rot=0.0, micro=0.0, surface='wall', var=0.14,
            streak_col=(0.34, 0.31, 0.29, 1.0), tint_var=False, paint=None):
    """텍스처 PBR + 정점 마스크(이끼·젖음·AO) + 빗물 얼룩. 벽·지붕·교각 공용."""
    _guard(name)
    M = lib.Mat(name); b = M.b
    vec = M.uv(size, rot=rot)
    t = M.texset(tid, vec, res, False, normal)
    nrm = M.micro(t['normal'], tid, size / 6.0, micro, res) if micro > 0 else t['normal']
    c = M.grade(t['color'], sat, tint, gain)
    c = M.macro_var(c, var, 0.07)
    if tint_var:
        c = _tint_var(M, c)
    if paint is not None:
        c = _paint_over(M, c, paint)
    if streak > 0:
        c = _streaks(M, c, streak, streak_col)
        c = _base_grime(M, c)
    mk = M.mask(base_wet, moss_bias, -1.0)
    s = M.surface(c, t['rough'], nrm, t['height'], mk, crevice_moss, 0.8, porosity, wet_gloss)
    m = M.finish(s.outputs['Color'], s.outputs['Roughness'], s.outputs['Normal'])
    m['nw_surface'] = surface
    return m


def _tint_var(M, color):
    """동마다의 색 변이(정점 속성 nw_tint = (색상, 명도), −1..1): 색상 ±5°, 명도 ±10 %. 속성이 없으면 0 → 변화 없음."""
    b = M.b
    at = b.node('ShaderNodeAttribute', attribute_type='GEOMETRY', attribute_name='nw_tint')
    h, v, _ = b.sepxyz(at.outputs['Vector'])
    hs = b.node('ShaderNodeHueSaturation')
    b.put(hs.inputs['Hue'], b.add(0.5, b.mul(h, 5.0 / 360.0)))
    b.put(hs.inputs['Value'], b.add(1.0, b.mul(v, 0.10)))
    b.put(hs.inputs['Color'], color)
    return hs.outputs['Color']


def _paint_over(M, color, paint):
    """벽돌 위 도장(흰·회색): 도장색이 덮고, 0.6 m 노이즈 + 하단(AO 낮은 곳)에서 벗겨져 벽돌이 드러난다."""
    b = M.b
    u = b.node('ShaderNodeUVMap', uv_map='UVMap')
    peel = b.smooth(0.6, 0.66, b.noise(u.outputs['UV'], 1.6, 4.0, 0.6))
    attr = b.node('ShaderNodeAttribute', attribute_type='GEOMETRY', attribute_name='nw_mask')
    _, _, ao = b.sep(attr.outputs['Color'])
    peel = b.mx(peel, b.sub(1.0, b.smooth(0.35, 0.75, ao)))
    lum = b.sep(color)[1]
    pc = b.col(1.0, srgb(paint), b.rgb(b.remap(lum, 0.02, 0.25, 0.82, 1.06), b.remap(lum, 0.02, 0.25, 0.82, 1.06), b.remap(lum, 0.02, 0.25, 0.82, 1.06)), 'MULTIPLY')
    return b.col(peel, pc, color)


def _base_grime(M, color, soil='#3A332A', amount=0.75):
    """#12 접지 오염 색: 정점 AO(B)가 낮은 곳(벽 하단 1 m, 개구부 안)을 흙빛 그을음으로. 그림자처럼 어둡기만 하지 않고
    색이 바뀌어야 '흙이 튄 자국'으로 읽힌다. 경계는 0.3 m 노이즈로 들쭉날쭉."""
    b = M.b
    attr = b.node('ShaderNodeAttribute', attribute_type='GEOMETRY', attribute_name='nw_mask')
    _, _, ao = b.sep(attr.outputs['Color'])
    jag = b.remap(b.noise(M.pos, 3.2, 3.0, 0.6), 0.3, 0.7, -0.12, 0.12)
    g = b.sub(1.0, b.smooth(0.3, 0.8, b.add(ao, jag)))
    return b.col(b.mul(g, amount), color, srgb(soil))


def mat_flat(name, hexcol, rough=0.6, metal=0.0, var=0.12, surface='metal', base_wet=0.25, porosity=0.3, wet_gloss=0.5,
             crevice_moss=0.0, nscale=0.8, streak=0.0):
    """텍스처 없는 재질(도장 금속·전선·잔디 등): 색 + 저주파 얼룩 + 정점 마스크 반응."""
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
    return m


def mat_image(name, im, rough=0.5, metal=0.0, surface='metal', base_wet=0.25, alpha=False, porosity=0.3, two_sided=False,
              uv_scale=(1.0, 1.0), streak=0.0, var=0.1, interp='Linear'):
    """그려 만든 이미지 텍스처 + 마스크. alpha=True 면 알파 클립(glTF MASK 로 나가게 반올림)."""
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
    return m


def mat_glass(name, im):
    """창 유리: 창살 모듈 텍스처, 낮은 거칠기(흐린 하늘을 비춘다), 창마다 실내 밝기 차이(월드 노이즈)."""
    _guard(name)
    M = lib.Mat(name); b = M.b
    u = b.node('ShaderNodeUVMap', uv_map='UVMap')
    t = b.node('ShaderNodeTexImage'); t.image = im; t.interpolation = 'Linear'
    b.L.new(u.outputs['UV'], t.inputs['Vector'])
    lum = b.sep(t.outputs['Color'])[1]
    var = b.remap(b.noise(M.pos, 0.35, 1.0, 0.3), 0.35, 0.65, 0.65, 1.45)
    c = b.col(1.0, t.outputs['Color'], b.rgb(var, var, var), 'MULTIPLY')
    rough = b.remap(lum, 0.15, 0.35, 0.06, 0.45)
    M.meta['tex'].append({'image': im.name, 'file': os.path.basename(im.filepath), 'interp': 'Linear', 'coords': 'UVMap(창 한 칸 = 0..n)'})
    M.finish(c, rough, M.geo.outputs['Normal'], metallic=0.0, spec=0.6)
    M.m['nw_surface'] = 'glass'
    return M.m


def mat_alpha_flat(name, hexcol, alpha=0.35, rough=0.6, surface='metal'):
    _guard(name)
    M = lib.Mat(name)
    M.finish(srgb(hexcol), rough, M.geo.outputs['Normal'])
    M.bsdf.inputs['Alpha'].default_value = alpha
    M.m.use_backface_culling = False
    M.m['nw_surface'] = surface
    return M.m


BRICK_TINT = {'brick': (2.05, 1.1, 0.84, 1.0), 'brick_old': (2.1, 1.15, 0.88, 1.0)}   # 렌더 측정으로 맞춘 값(보고서 휘도 절)
BRICK_GAIN = {'brick': 1.6, 'brick_old': 1.85}
BRICK_SAT = {'brick': 1.15, 'brick_old': 0.95}


def materials():
    """NW_present 재질. 벽돌은 성수 적벽돌 #A86B55(젖음·그을음 #6C544F)로 맞춘다."""
    ims = {
        'window': gen_image('NW_gen_window', 192, 192, paint_window),
        'hazard': gen_image('NW_gen_hazard', 64, 64, paint_hazard),
        'leaves': gen_image('NW_gen_ginkgo', 384, 384, paint_leaves),
        'hoarding': gen_image('NW_gen_hoarding', 256, 128, paint_hoarding),
        'palette': gen_image('NW_gen_palette', 64, 64, paint_palette),
        'weeds': gen_image('NW_gen_weeds', 256, 128, paint_weeds),
    }
    M = {}
    # 붉은 벽돌 두 가지: 고른 주황 벽돌(church_bricks_02, 3.6 m 타일)과 그을린 옛 벽돌(brick_wall_001, 1.35 m)
    M['brick'] = mat_tex('NW_brick_red', 'church_bricks_02', 3.6, tint=BRICK_TINT['brick'], sat=BRICK_SAT['brick'], gain=BRICK_GAIN['brick'], streak=1.0,
                         crevice_moss=3.0, porosity=0.55, wet_gloss=0.45, micro=0.4, tint_var=True)
    M['brick_old'] = mat_tex('NW_brick_old', 'brick_wall_001', 1.35, tint=BRICK_TINT['brick_old'], sat=BRICK_SAT['brick_old'], gain=BRICK_GAIN['brick_old'],
                             streak=1.0, crevice_moss=3.0, porosity=0.55, wet_gloss=0.45, tint_var=True)
    # 벽돌 위 흰·회색 도장, 연립의 흰 타일(성수 리서치 §2·§6)
    M['brick_paint'] = mat_tex('NW_brick_painted', 'church_bricks_02', 3.6, tint=BRICK_TINT['brick'], sat=0.9, gain=BRICK_GAIN['brick'],
                               streak=1.0, crevice_moss=2.5, porosity=0.4, normal=0.7, tint_var=True, paint='#D6D3CB')
    M['tile_white'] = mat_tex('NW_tile_white', 'church_bricks_02', 1.5, tint=(5.2, 6.0, 7.2, 1), sat=0.06, streak=0.9, normal=0.6,
                              porosity=0.25, crevice_moss=2.0, var=0.08, tint_var=True)
    # 도장·미장(아파트 크림 #D9D3B8, 회백 #BFC3C6, 연립 베이지) — concrete_slab_wall_02 거푸집 줄이 패널 이음으로 읽힌다
    M['apt'] = mat_tex('NW_paint_cream', 'concrete_slab_wall_02', 4.0, tint=srgb('#F4EBCB'), sat=0.25, gain=1.35, streak=0.7,
                       porosity=0.35, var=0.08)
    M['stucco'] = mat_tex('NW_stucco_grey', 'concrete_slab_wall_02', 3.0, tint=srgb('#E3E6E6'), sat=0.15, gain=1.2, streak=0.8,
                          porosity=0.4, var=0.1)
    M['tile'] = mat_tex('NW_tile_beige', 'church_bricks_02', 3.0, tint=(3.3, 2.75, 2.1, 1), sat=0.18, streak=0.8,
                        porosity=0.3, var=0.1, crevice_moss=2.5)
    # 노출 콘크리트(고가·전주·창턱·띠) — 지면 NW_concrete 와 같은 텍스처(concrete_floor_worn_001)를 다시 쓰지 않고
    # 고가는 거푸집 패널 줄이 있는 concrete_slab_wall_02 로(성수 고가 #76777E)
    M['conc'] = mat_tex('NW_concrete_wall', 'concrete_slab_wall_02', 2.6, tint=srgb('#C9CACF'), sat=0.4, streak=0.9,
                        porosity=0.45, micro=0.35)
    M['trim'] = bpy.data.materials['NW_concrete']          # 지면과 같은 콘크리트(창턱·띠·벤치·잔해)
    M['corr'] = mat_tex('NW_corrugated', 'corrugated_iron_03', 1.6, res='1k', tint=srgb('#C4CCC8'), sat=0.7, streak=1.0, normal=1.6,
                        porosity=0.15, wet_gloss=0.7, surface='metal', streak_col=(0.62, 0.36, 0.22, 1.0))
    M['ribbed'] = mat_tex('NW_ribbed_metal', 'painted_metal_shutter', 1.8, res='1k', tint=srgb('#DCE1DD'), sat=0.5, rot=math.pi / 2,
                          porosity=0.15, surface='metal', streak=0.5)
    M['roof'] = mat_tex('NW_roof_green', 'concrete_floor_worn_001', 3.0, tint=srgb('#9DC3A0'), sat=1.3, gain=1.55,
                        crevice_moss=2.5, porosity=0.4, base_wet=0.4, surface='ground')
    M['basalt'] = mat_tex('NW_basalt', 'dark_rock', 2.2, sat=0.6, gain=1.15, crevice_moss=3.5, porosity=0.65, wet_gloss=0.75,
                          base_wet=0.35, surface='rock', micro=0.5)
    M['bark'] = mat_tex('NW_bark', 'dark_rock_02', 0.9, tint=srgb('#B9B2A8'), sat=0.5, porosity=0.5, crevice_moss=3.0, surface='foliage')
    M['glass'] = mat_glass('NW_glass_window', ims['window'])
    M['dark'] = mat_flat('NW_interior_dark', '#24282A', rough=0.7, var=0.2, surface='wall')
    M['steel'] = mat_flat('NW_steel_black', '#232425', rough=0.55, metal=0.55, surface='metal', streak=0.3)
    M['galv'] = mat_flat('NW_steel_galv', '#8E9291', rough=0.42, metal=0.8, surface='metal', var=0.16)
    M['wire'] = mat_flat('NW_cable', '#151617', rough=0.45, var=0.05, surface='metal', base_wet=0.2)
    M['green'] = mat_flat('NW_station_green', '#3F7A55', rough=0.45, metal=0.3, surface='metal', var=0.08, streak=0.4)
    M['red'] = mat_flat('NW_paint_red', '#A3352C', rough=0.5, metal=0.2, surface='metal')
    M['gas'] = mat_flat('NW_gas_yellow', '#D2A62C', rough=0.5, metal=0.3, surface='metal', var=0.15)
    M['turf'] = mat_flat('NW_turf', '#3C5A3A', rough=0.85, surface='ground', nscale=0.15, var=0.18)
    # 주의: NW_paint_white 는 지면(Task 2) 노면 표시 재질 이름이다 — 겹치면 lib.Mat 가 그 재질을 비우고 다시 만든다
    M['white'] = mat_flat('NW_paint_offwhite', '#DADBD5', rough=0.55, metal=0.1, surface='metal', var=0.06)
    # 주차 구획·운동장 선(바닥 도색): 금속 도장(NW_paint_offwhite)과 나눈 바닥 재질 — nw_surface=ground
    M['line'] = mat_flat('NW_paint_line', '#DCDCD6', rough=0.6, metal=0.0, surface='ground', var=0.1, base_wet=0.3, porosity=0.2)
    M['net'] = mat_alpha_flat('NW_net', '#2A3029', alpha=0.32)
    M['hazard'] = mat_image('NW_hazard_stripe', ims['hazard'], rough=0.45, surface='metal')
    M['leaves'] = mat_image('NW_ginkgo_leaves', ims['leaves'], rough=0.7, surface='foliage', alpha=True, two_sided=True, porosity=0.2)
    M['hoard'] = mat_image('NW_hoarding_panel', ims['hoarding'], rough=0.5, metal=0.3, surface='metal', streak=0.5)
    # 간판: 판·차양(NW_sign_panel)과 글자(NW_sign_letters, 밤 발광 후보 nw_night=1)가 팔레트 한 장을 공유
    M['sign'] = mat_image('NW_sign_panel', ims['palette'], rough=0.45, metal=0.15, surface='metal', var=0.04, interp='Closest', streak=0.5)
    M['letters'] = mat_image('NW_sign_letters', ims['palette'], rough=0.3, metal=0.1, surface='metal', var=0.02, interp='Closest')
    M['letters']['nw_night'] = 1
    M['hedge'] = mat_flat('NW_hedge', '#3D5434', rough=0.85, var=0.3, surface='foliage', nscale=2.4)
    M['asph_dark'] = mat_flat('NW_asphalt_dark', '#2E3132', rough=0.78, var=0.22, surface='ground', nscale=0.5, base_wet=0.05)
    M['weeds'] = mat_image('NW_weeds', ims['weeds'], rough=0.75, surface='foliage', alpha=True, two_sided=True, porosity=0.2, var=0.2)
    M['glass']['nw_surface'] = 'glass'
    return M


# ═════════════════════════════ Poly Haven 소품(데이터로만 읽음) ═════════════════════════════
# 키: (모델 id, 남길 메시 이름(접미 .NNN 무시, None = 전부), Decimate 비율, 바닥 기준 원점 정렬)
PH = {
    'shutter': ('rollershutter_door', ['rollershutter_door'], 0.5, 'keep'),
    'fac_window': ('modular_factory_facade', ['window_centered_large_01'], 0.55, 'center'),
    'fac_garage': ('modular_factory_facade', ['door_garage_double_01'], 0.6, 'center'),
    'aircon': ('exterior_aircon_unit', ['exterior_aircon_unit_rusted'], 0.05, 'base'),
    'ubox': ('utility_box_02', None, 0.18, 'base'),
    'payphone': ('korean_public_payphone_01', None, 0.05, 'base'),
    'extinguisher': ('korean_fire_extinguisher_01', None, 0.12, 'base'),
    'cctv': ('security_camera_01', None, 0.08, 'keep'),
    'trash': ('metal_trash_can', ['metal_trash_can', 'metal_trash_can_handle_left', 'metal_trash_can_handle_right',
                                  'metal_trash_can_lid'], 0.18, 'base'),
    'car': ('covered_car', None, 0.16, 'base'),
    'barrier': ('concrete_road_barrier', None, 0.025, 'base'),
    'pipe': ('modular_metal_gutter', ['modular_metal_gutter_section'], 0.12, 'base'),
    'pipe_out': ('modular_metal_gutter', ['modular_metal_gutter_outlet'], 0.15, 'base'),
    'fire_escape': ('modular_fire_escape', None, 0.4, 'center'),
    'rock_a': ('rock_moss_set_01', ['rock_moss_set_01_rock02'], 0.09, 'center'),
    'rock_b': ('rock_moss_set_01', ['rock_moss_set_01_rock04'], 0.09, 'center'),
    'rock_c': ('rock_moss_set_01', ['rock_moss_set_01_rock06'], 0.09, 'center'),
    'rock_d': ('rock_moss_set_02', ['rock_moss_set_02_rock11'], 0.12, 'center'),
    'rock_e': ('rock_moss_set_02', ['rock_moss_set_02_rock13'], 0.12, 'center'),
    'boulder': ('boulder_01', None, 0.03, 'center'),
    'shrub': ('shrub_02', ['shrub_02_b'], 0.45, 'base'),
}


def _base(n):
    return re.sub(r'\.\d{3}$', '', n)


def cleanup_imports():
    """지난 실행이 가져온 재질·이미지(TAG 표식)와 남은 메시를 지운다."""
    for m in [m for m in bpy.data.materials if m.get(TAG)]:
        bpy.data.materials.remove(m)
    for me in [me for me in bpy.data.meshes if me.get(TAG) and me.users == 0]:
        bpy.data.meshes.remove(me)
    for im in [im for im in bpy.data.images if im.get(TAG) == 2 and im.users == 0]:
        bpy.data.images.remove(im)


def _upstream_image(sock, depth=0):
    """소켓 위쪽으로 링크를 따라가 처음 만나는 이미지와 경로상의 채널(Separate Color 출력 이름)을 돌려준다."""
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
    """A2: 곱셈 노드를 끼우기 전에 원래 glTF 재질의 이미지·소켓을 m['nw_tex'](JSON)로 남긴다(Task 5 굽기·내보내기용)."""
    bsdf = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    rec = {'kind': 'gltf', 'model': model_id}
    if bsdf is not None:
        for key, sock in (('base', 'Base Color'), ('rough', 'Roughness'), ('metal', 'Metallic'), ('normal', 'Normal'), ('alpha', 'Alpha')):
            r = _upstream_image(bsdf.inputs[sock])
            if r is not None:
                rec[key] = r
    rec['blend'] = getattr(m, 'surface_render_method', None)
    m['nw_tex'] = json.dumps(rec, ensure_ascii=False)


def _grime_material(m, dry=False):
    """가져온 재질에 정점 마스크 반응을 꽂는다(#12 접지 오염): 색 × AO, 젖으면 어둡고 매끈하게."""
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
    _, wet, ao = b.sep(at.outputs['Color'])
    k = b.mul(b.flt(0.85, 1.0, ao), b.sub(1.0, b.mul(wet, 0.3)))
    sock = bsdf.inputs['Base Color']
    src = sock.links[0].from_socket if sock.links else None
    base = src if src is not None else tuple(sock.default_value)
    if dry:
        hs = b.node('ShaderNodeHueSaturation')
        hs.inputs['Hue'].default_value = 0.44; hs.inputs['Saturation'].default_value = 0.55; hs.inputs['Value'].default_value = 0.8
        b.put(hs.inputs['Color'], base); base = hs.outputs['Color']
    c = b.col(1.0, base, b.rgb(k, k, k), 'MULTIPLY')
    for l in list(sock.links):
        nt.links.remove(l)
    b.L.new(c, sock)
    rs = bsdf.inputs['Roughness']
    rsrc = rs.links[0].from_socket if rs.links else rs.default_value
    r = b.mul(rsrc, b.sub(1.0, b.mul(wet, 0.45)))
    for l in list(rs.links):
        nt.links.remove(l)
    b.L.new(r, rs)


def import_protos(sc, M):
    """Poly Haven 모델을 임시 컬렉션으로 읽어 필요한 부분만 합치고(재질은 기본 이름으로 묶어 슬롯 수를 줄임)
    Decimate 를 적용한 원형 메시 PR_ph_<key> 로 만든다. 가져온 객체·원본 메시는 지운다."""
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
        # 같은 기본 이름의 재질은 하나로(covered_car ×2, gutter ×2 등) → PH_<이름>.
        # 표식 없는 같은 이름 재질(다른 씬·사용자 것)은 지우지 않고 이름을 비켜 간다(A3).
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
                        bpy.data.materials.remove(old)        # 지난 실행이 남긴 우리 재질
                        break
                    want = f'{bn}_nw{k}'; k += 1
                m.name = want; m[TAG] = 1
                _record_gltf_textures(m, mid)
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
    # 쓰지 않게 된 가져온 재질·이미지(예: 녹슨 휴지통·깨끗한 실외기 변형)는 바로 지운다
    for m in [m for m in bpy.data.materials if m.get(TAG) and m.users == 0]:
        bpy.data.materials.remove(m)
    for im in [im for im in bpy.data.images if im.get(TAG) == 2 and im.users == 0]:
        bpy.data.images.remove(im)
    return protos


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
    if origin in ('base', 'center'):          # 둘 다 가로 중심·바닥 = 0 (이름은 배치 의도 구분용)
        off = ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs))
    else:
        off = (0.0, 0.0, 0.0)
    V = [(x - off[0], y - off[1], z - off[2]) for x, y, z in V]
    me = bpy.data.meshes.new(name + '_src')
    me.from_pydata(V, [], F)
    for m in mats:
        me.materials.append(m)
    me.polygons.foreach_set('material_index', FM)
    lib.set_uv(me, 'UVMap', None, per_loop=[uv for f in UV for uv in f])
    me.shade_smooth()
    if ratio < 0.999:
        # glTF 는 UV 이음매마다 정점을 나눠 두어 Decimate 가 경계로 여겨 줄이지 못한다 → 같은 위치 정점을 먼저 합친다
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
        low = 1 - smoothstep(0.0, min(0.35, 0.4 * h), z)
        top = smoothstep(0.6, 0.95, n.z) * smoothstep(0.4 * h, 0.9 * h, z)
        return (0.25 * top + 0.15 * low, 0.35 + 0.5 * low, 1 - 0.45 * low)
    lib.write_mask(me, mk)
    me[TAG] = 1
    return me


# ═════════════════════════════ 벽 · 개구부 · 지붕 ═════════════════════════════
SPLASH = (0.45, 1.1)          # 빗물 튐 띠(하단 1 m) 경계 — 정점이 있어야 마스크 경사가 생긴다


def wall_mask(age, H, ops, par_top):
    """벽 정점 마스크(u, v → R 이끼, G 젖음, B AO, A 빗물 얼룩)."""
    def mk(u, v):
        h = v
        moss = age * (0.25 + 0.75 * (1 - smoothstep(0.0, 0.5, h))) * (1 - smoothstep(0.3, 0.9, h))
        wet = 0.28 + 0.68 * (1 - smoothstep(0.0, 1.2, h))
        ao = 1 - 0.72 * (1 - smoothstep(-0.1, 1.2, h))
        st = 0.0
        for o in ops:
            if o.get('streak', True) and o['u0'] - 0.15 <= u <= o['u1'] + 0.15 and v <= o['v0'] + 1e-4:
                st = max(st, 0.95 * math.exp(-(o['v0'] - v) / 4.5))
        if par_top is not None:
            st = max(st, (0.35 + 0.4 * h01(int(u / 1.9), 7)) * math.exp(-(par_top - v) / 4.5))
        return (moss, wet, ao, st * min(1.0, 0.55 + 0.6 * age))
    return mk


def wall(acc, a, b, H, ops, M, u_off, vb=-0.3, ubands=(), vbands=(), lintel=0.0, age=1.0, par_top=None, wmat='wall'):
    """a → b 벽(외곽선 반시계 → 바깥은 진행 방향 오른쪽). 높이 vb..H(대지 = 0). ops: 개구부 dict 목록
    (u0, u1, v0, v1, d 깊이, back 재질 키, sill 창턱, pane 창살 모듈 폭, inst 셔터 등 소품). 반환: 벽 길이."""
    ax, ay = a; bx, by = b
    L = math.hypot(bx - ax, by - ay)
    tx, ty = (bx - ax) / L, (by - ay) / L; nx, ny = ty, -tx

    def P(u, v, d=0.0):
        return (ax + tx * u - nx * d, ay + ty * u - ny * d, v)
    us = {0.0, L}; vs = {vb, H}
    vs |= {s for s in SPLASH if vb < s < H}
    for o in ops:
        us |= {o['u0'], o['u1']}; vs |= {o['v0'], o['v1']}
        if lintel and o.get('lintel', True):
            vs.add(min(H, o['v1'] + lintel))
    for u0, u1 in ubands:
        us |= {max(0.0, u0), min(L, u1)}
    for v0, v1 in vbands:
        vs |= {max(vb, v0), min(H, v1)}
    us = sorted(u for u in us if -1e-6 <= u <= L + 1e-6)
    vs = sorted(v for v in vs if vb - 1e-6 <= v <= H + 1e-6)
    mk = wall_mask(age, H, ops, par_top)
    for i in range(len(us) - 1):
        u0, u1 = us[i], us[i + 1]
        if u1 - u0 < 1e-4:
            continue
        uc = 0.5 * (u0 + u1)
        for j in range(len(vs) - 1):
            v0, v1 = vs[j], vs[j + 1]
            if v1 - v0 < 1e-4:
                continue
            vc = 0.5 * (v0 + v1)
            if any(o['u0'] < uc < o['u1'] and o['v0'] < vc < o['v1'] for o in ops):
                continue
            mat = M[wmat]
            if any(p0 < uc < p1 for p0, p1 in ubands) or any(p0 < vc < p1 for p0, p1 in vbands):
                mat = M['trim']
            elif lintel and any(o['u0'] < uc < o['u1'] and o['v1'] < vc < o['v1'] + lintel and o.get('lintel', True) for o in ops):
                mat = M['trim']
            acc.poly([P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)],
                     [(u_off + u0, v0), (u_off + u1, v0), (u_off + u1, v1), (u_off + u0, v1)], mat,
                     [mk(u0, v0), mk(u1, v0), mk(u1, v1), mk(u0, v1)], (nx, ny, 0))
    for o in ops:
        opening(acc, P, (tx, ty), (nx, ny), o, M, u_off, wmat)
    return L


def opening(acc, P, t, n, o, M, u_off, wmat):
    u0, u1, v0, v1, d = o['u0'], o['u1'], o['v0'], o['v1'], o.get('d', 0.18)
    rev = M[o.get('rev', wmat)]
    mrev = (0.0, 0.35, 0.62, 0.0)
    T = (t[0], t[1], 0.0); N = (n[0], n[1], 0.0)
    acc.poly([P(u0, v0, 0), P(u0, v1, 0), P(u0, v1, d), P(u0, v0, d)],
             [(u_off + u0, v0), (u_off + u0, v1), (u_off + u0 + d, v1), (u_off + u0 + d, v0)], rev, mrev, T)
    acc.poly([P(u1, v0, 0), P(u1, v1, 0), P(u1, v1, d), P(u1, v0, d)],
             [(u_off + u1, v0), (u_off + u1, v1), (u_off + u1 - d, v1), (u_off + u1 - d, v0)], rev, mrev, (-T[0], -T[1], 0))
    acc.poly([P(u0, v1, 0), P(u1, v1, 0), P(u1, v1, d), P(u0, v1, d)],
             [(u_off + u0, v1), (u_off + u1, v1), (u_off + u1, v1 + d), (u_off + u0, v1 + d)], rev, mrev, (0, 0, -1))
    acc.poly([P(u0, v0, 0), P(u1, v0, 0), P(u1, v0, d), P(u0, v0, d)],
             [(u_off + u0, v0), (u_off + u1, v0), (u_off + u1, v0 - d), (u_off + u0, v0 - d)], rev,
             (0.15, 0.55, 0.75, 0.0), (0, 0, 1))
    back = o.get('back', 'glass')
    if back:
        if back == 'glass':
            nu = max(1, round((u1 - u0) / o.get('pane', 1.3))); nv = max(1, round((v1 - v0) / o.get('paneh', 1.6)))
            uv = [(0, 0), (nu, 0), (nu, nv), (0, nv)]
            mkb = (0.0, 0.25, 1.0, 0.0)
        else:
            uv = [(u_off + u0, v0), (u_off + u1, v0), (u_off + u1, v1), (u_off + u0, v1)]
            mkb = (0.0, 0.3, 0.55, 0.0)
        acc.poly([P(u0, v0, d), P(u1, v0, d), P(u1, v1, d), P(u0, v1, d)], uv, M[back], mkb, N)
    if o.get('sill'):
        e = 0.06; s0 = v0 - 0.09; out = -0.07
        top = (0.3, 0.7, 0.9, 0.0); side = (0.05, 0.45, 0.85, 0.0)
        acc.poly([P(u0 - e, v0, out), P(u1 + e, v0, out), P(u1 + e, v0, 0), P(u0 - e, v0, 0)],
                 [(u_off + u0, 0), (u_off + u1, 0), (u_off + u1, 0.07), (u_off + u0, 0.07)], M['trim'], top, (0, 0, 1))
        acc.poly([P(u0 - e, s0, out), P(u1 + e, s0, out), P(u1 + e, v0, out), P(u0 - e, v0, out)],
                 [(u_off + u0, s0), (u_off + u1, s0), (u_off + u1, v0), (u_off + u0, v0)], M['trim'], side, N)
        acc.poly([P(u0 - e, s0, out), P(u1 + e, s0, out), P(u1 + e, s0, 0), P(u0 - e, s0, 0)],
                 [(u_off + u0, 0), (u_off + u1, 0), (u_off + u1, 0.07), (u_off + u0, 0.07)], M['trim'], side, (0, 0, -1))
        for uu, sg in ((u0 - e, -1), (u1 + e, 1)):
            acc.poly([P(uu, s0, out), P(uu, v0, out), P(uu, v0, 0), P(uu, s0, 0)],
                     [(0, s0), (0, v0), (0.07, v0), (0.07, s0)], M['trim'], side, (T[0] * sg, T[1] * sg, 0))
    inst = o.get('inst')
    if inst:
        key, w0, h0, depth = inst
        uc = 0.5 * (u0 + u1)
        x, y, z = P(uc, v0, depth)
        INST.append((key, (x, y, z), math.atan2(t[1], t[0]), ((u1 - u0) / w0, 1.0, (v1 - v0) / h0)))


def roof_flat(acc, rect, H, par, M, age=1.0, pt=0.25, rmat='roof'):
    """평지붕: 파라펫 갓돌 링 + 안쪽 면 + 3 m 격자 지붕면(이끼·물 고임 마스크)."""
    x0, y0, x1, y1 = rect
    ix0, iy0, ix1, iy1 = x0 + pt, y0 + pt, x1 - pt, y1 - pt
    zt = H + par
    cap = (0.45 * age, 0.6, 0.95, 0.0)
    ring_o = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]; ring_i = [(ix0, iy0), (ix1, iy0), (ix1, iy1), (ix0, iy1)]
    for k in range(4):
        a, b = ring_o[k], ring_o[(k + 1) % 4]; c, d = ring_i[(k + 1) % 4], ring_i[k]
        acc.poly([(a[0], a[1], zt), (b[0], b[1], zt), (c[0], c[1], zt), (d[0], d[1], zt)],
                 [a, b, c, d], M['trim'], cap, (0, 0, 1))
        # 안쪽 면(지붕 쪽을 본다)
        nrm = ((c[1] - d[1]), -(c[0] - d[0]), 0)
        acc.poly([(d[0], d[1], H), (c[0], c[1], H), (c[0], c[1], zt), (d[0], d[1], zt)],
                 [(0, H), (math.dist(c, d), H), (math.dist(c, d), zt), (0, zt)], M['trim'],
                 [(0.4 * age, 0.65, 0.55, 0.0)] * 2 + [(0.2, 0.5, 0.9, 0.0)] * 2, (-nrm[0], -nrm[1], 0))
    nxs = max(1, int((ix1 - ix0) / 3.0)); nys = max(1, int((iy1 - iy0) / 3.0))
    for i in range(nxs):
        for j in range(nys):
            ax0 = ix0 + (ix1 - ix0) * i / nxs; ax1 = ix0 + (ix1 - ix0) * (i + 1) / nxs
            ay0 = iy0 + (iy1 - iy0) * j / nys; ay1 = iy0 + (iy1 - iy0) * (j + 1) / nys

            def rm(p, n):
                e = min(p[0] - ix0, ix1 - p[0], p[1] - iy0, iy1 - p[1])
                nn = n2(p[0], p[1], 0.25, 77.0)
                return (age * clamp01(0.25 + 0.7 * nn + 0.5 * math.exp(-e / 0.8)), clamp01(0.5 + 0.4 * nn), 1 - 0.4 * math.exp(-e / 0.6), 0.0)
            acc.poly([(ax0, ay0, H), (ax1, ay0, H), (ax1, ay1, H), (ax0, ay1, H)],
                     [(ax0, ay0), (ax1, ay0), (ax1, ay1), (ax0, ay1)], M[rmat], rm, (0, 0, 1))


def roof_gable(acc, rect, He, ridge, pitch, M, ov=0.45, th=0.12, age=1.0, rmat='corr', ends=False):
    """박공지붕(골함석): 두 경사면 위·아래 + 처마·박공 테두리. ridge = 'x' 면 용마루가 x 방향."""
    x0, y0, x1, y1 = rect
    if ridge == 'x':
        D = y1 - y0; rise = D / 2 * math.tan(math.radians(pitch))
        A0, A1, B0, B1 = x0 - ov, x1 + ov, y0 - ov, y1 + ov
        mid = (y0 + y1) / 2
        W = lambda a, bb, z: (a, bb, z)
    else:
        D = x1 - x0; rise = D / 2 * math.tan(math.radians(pitch))
        A0, A1, B0, B1 = y0 - ov, y1 + ov, x0 - ov, x1 + ov
        mid = (x0 + x1) / 2
        W = lambda a, bb, z: (bb, a, z)
    ze = He - ov * math.tan(math.radians(pitch)); zr = He + rise
    slope = math.hypot(mid - B0, zr - ze)
    segs = max(1, int((A1 - A0) / 4.0))
    for side, (bb0, bb1) in enumerate(((B0, mid), (B1, mid))):
        for k in range(segs):
            a0 = A0 + (A1 - A0) * k / segs; a1 = A0 + (A1 - A0) * (k + 1) / segs

            def rm(p, n):
                eave = (p[2] - ze) / max(1e-3, zr - ze) * slope          # 처마에서 경사 따라 거리
                ed = 1 - smoothstep(0.0, slope * 0.5, eave)
                nn = n2(p[0], p[1], 0.3, 91.0)
                return (age * clamp01(0.15 + 0.5 * nn + 0.35 * ed), clamp01(0.45 + 0.3 * ed), 1 - 0.2 * ed, 0.0)
            top = [W(a0, bb0, ze), W(a1, bb0, ze), W(a1, bb1, zr), W(a0, bb1, zr)]
            uv = [(a0, 0), (a1, 0), (a1, slope), (a0, slope)]
            want = (0, 0, 1)
            acc.poly(top, uv, M[rmat], rm, want)
            bot = [(p[0], p[1], p[2] - th) for p in top]
            acc.poly(bot, uv, M[rmat], (0.0, 0.35, 0.6, 0.0), (0, 0, -1))
        # 처마 테두리
        e0 = W(A0, bb0, ze); e1 = W(A1, bb0, ze)
        out = (0, -1 if bb0 < mid else 1, 0) if ridge == 'x' else (-1 if bb0 < mid else 1, 0, 0)
        acc.poly([e0, e1, (e1[0], e1[1], ze - th), (e0[0], e0[1], ze - th)], [(A0, 0), (A1, 0), (A1, th), (A0, th)],
                 M['steel'], (0.1, 0.5, 0.8, 0.0), out)
    # 박공 끝 테두리(verge)
    for a in (A0, A1):
        for bb0 in (B0, B1):
            p0 = W(a, bb0, ze); p1 = W(a, mid, zr)
            acc.poly([p0, p1, (p1[0], p1[1], zr - th), (p0[0], p0[1], ze - th)], [(0, 0), (slope, 0), (slope, th), (0, th)],
                     M['steel'], (0.1, 0.5, 0.8, 0.0), (-1, 0, 0) if (ridge == 'x' and a == A0) else (1, 0, 0) if ridge == 'x' else
                     ((0, -1, 0) if a == A0 else (0, 1, 0)))
    if ends:
        for a in (A0, A1):
            acc.poly([W(a, B0, ze), W(a, B1, ze), W(a, mid, zr)], [(B0, ze), (B1, ze), (mid, zr)], M['wall'], (0.0, 0.3, 0.9, 0.2),
                     (-1, 0, 0) if (ridge == 'x' and a == A0) else (1, 0, 0) if ridge == 'x' else ((0, -1, 0) if a == A0 else (0, 1, 0)))
    return rise


# ═════════════════════════════ 건물 생성기 ═════════════════════════════
WIN = {   # 창 종류: 칸 폭, 창 폭·높이, 창턱 높이, 창살 모듈
    'factory': dict(bay=4.2, ww=2.9, wh=1.75, sill=1.0, pane=1.45, paneh=1.75),
    'villa': dict(bay=3.3, ww=1.6, wh=1.3, sill=0.95, pane=0.8, paneh=1.3),
    'office': dict(bay=3.0, ww=2.5, wh=1.7, sill=0.8, pane=1.25, paneh=1.7),
    'shop': dict(bay=3.6, ww=2.4, wh=1.5, sill=0.95, pane=1.2, paneh=1.5),
}


def bays(L, bay, margin=0.9):
    n = max(1, int((L - 2 * margin) / bay))
    m = (L - n * bay) / 2
    return [m + bay * (k + 0.5) for k in range(n)], m


def facade_ops(sp, role, L, H, seed, face=''):
    """면 역할(street·back·side·blank)에 따라 개구부 목록을 만든다."""
    rnd = random.Random(seed)
    ops = []
    if role == 'blank':
        return ops
    W_ = WIN[sp.get('win', 'factory')]
    fl, gf, fh = sp['fl'], sp['gf'], sp['fh']
    cs, m = bays(L, W_['bay'])
    gfk = sp.get('gfk', 'shutter')
    # 위층 창
    for f in range(1, fl):
        vb = gf + (f - 1) * fh
        for k, uc in enumerate(cs):
            if role == 'side' and (k + f) % 2:
                continue
            if role == 'back' and rnd.random() < 0.18:
                continue
            ww = W_['ww'] * (0.6 if (role == 'side' and sp.get('win') == 'villa') else 1.0)
            if face in sp.get('phwin', ()):
                # Poly Haven 공장 창 부품(window_centered_large_01, 2.22 × 1.74)을 개구부 안에 끼운다
                ops.append(dict(u0=uc - 1.12, u1=uc + 1.12, v0=vb + 0.9, v1=vb + 2.66, d=0.3, back='dark', sill=True,
                                inst=('fac_window', 2.24, 1.76, 0.13)))
                continue
            ops.append(dict(u0=uc - ww / 2, u1=uc + ww / 2, v0=vb + W_['sill'], v1=vb + W_['sill'] + W_['wh'], d=0.2,
                            back='glass', sill=sp.get('sills', True), pane=W_['pane'], paneh=W_['paneh']))
    # 1층
    if gfk == 'pilotis' and role in ('street', 'side'):
        return ops
    if role == 'street':
        gbay = 4.0 if gfk in ('shutter', 'mixed') else 4.6 if gfk == 'garage' else 3.6
        gcs, _ = bays(L, gbay, 0.7)
        for k, uc in enumerate(gcs):
            kind = gfk
            if gfk == 'mixed':
                kind = ('shutter', 'shop', 'door')[k % 3]
            elif k % 4 == 3:
                kind = 'door'
            if gfk == 'garage':
                if k % 2:
                    continue
                ops.append(dict(u0=uc - 3.7, u1=uc + 3.7, v0=0.0, v1=2.8, d=0.42, back='dark', streak=False, lintel=False,
                                inst=('fac_garage', 7.4, 2.8, 0.27)))
                continue
            if kind == 'shutter':
                w = 3.2; h = min(gf - 0.7, 3.1)
                ops.append(dict(u0=uc - w / 2, u1=uc + w / 2, v0=0.0, v1=h, d=0.36, back='dark', streak=False, lintel=False,
                                inst=('shutter', 1.08, 2.4, 0.33)))
            elif kind == 'shop':
                w = gbay - 0.5
                ops.append(dict(u0=uc - w / 2, u1=uc + w / 2, v0=0.4, v1=gf - 1.05, d=0.3, back='glass', pane=1.2, paneh=2.4,
                                streak=False, lintel=False, shopfront=True))
            else:
                w = 1.3
                ops.append(dict(u0=uc - w / 2, u1=uc + w / 2, v0=0.0, v1=2.3, d=0.25, back='steel', streak=False, lintel=False))
    elif role == 'back':
        uc = cs[rnd.randrange(len(cs))]
        ops.append(dict(u0=uc - 0.6, u1=uc + 0.6, v0=0.0, v1=2.2, d=0.2, back='steel', streak=False, lintel=False))
        for uc2 in cs:
            if abs(uc2 - uc) > 1.5 and rnd.random() < 0.5:
                ops.append(dict(u0=uc2 - 0.7, u1=uc2 + 0.7, v0=gf - 1.6, v1=gf - 0.7, d=0.18, back='glass', sill=True, pane=0.7, paneh=0.9))
    return ops


def building(acc, sp, M):
    """사각 평면 건물 1동. sp: rect, fl, gf, fh, wall, roof(flat/gable), faces{S,E,N,W: 역할}, win, gfk, frame, extras."""
    x0, y0, x1, y1 = sp['rect']
    fl, gf, fh = sp['fl'], sp['gf'], sp['fh']
    H = gf + (fl - 1) * fh
    roof = sp.get('roof', 'flat'); par = sp.get('par', 0.9) if roof == 'flat' else 0.0
    age = sp.get('age', 1.0)
    seed = sp.get('seed', int(x0 * 7 + y0 * 13))
    W_ = WIN[sp.get('win', 'factory')]
    MM = dict(M); MM['wall'] = M[sp.get('wall', 'brick')]; MM['trim'] = M[sp.get('trim', 'trim')]
    ridge = sp.get('ridge', 'x' if (x1 - x0) >= (y1 - y0) else 'y')
    rise = 0.0
    if roof == 'gable':
        D = (y1 - y0) if ridge == 'x' else (x1 - x0)
        rise = D / 2 * math.tan(math.radians(sp.get('pitch', 14)))
    corners = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    names = ['S', 'E', 'N', 'W']
    faces = sp.get('faces', {})
    u_off = 0.0
    pil = sp.get('gfk') == 'pilotis'
    nm = sp.get('name', str(seed))
    acc.tint = (2 * h01(nm, 'hue') - 1, 2 * h01(nm, 'val') - 1)     # 동마다 색상 ±5°·명도 ±10 %(B4)
    face_ops = {}
    for k in range(4):
        a, b = corners[k], corners[(k + 1) % 4]
        L = math.dist(a, b)
        role = faces.get(names[k], 'side')
        ops = facade_ops(sp, role, L, H, seed + k * 31, names[k])
        face_ops[names[k]] = (role, ops)
        ub = []; vbands = []
        if sp.get('frame'):
            cs, m = bays(L, W_['bay'])
            edges = [m + W_['bay'] * i for i in range(len(cs) + 1)]
            ub = [(e - 0.22, e + 0.22) for e in edges[1:-1]] + [(0.0, 0.32), (L - 0.32, L)]
            vbands = [(gf + (f - 1) * fh - 0.08, gf + (f - 1) * fh + 0.32) for f in range(1, fl)]
            if roof == 'flat':
                vbands.append((H - 0.05, H + par))
        elif sp.get('plinth', False):
            vbands = [(-0.3, 0.45)]
        vb = gf if (pil and role in ('street', 'side')) else -0.3
        top = H + par
        is_gable_end = roof == 'gable' and ((ridge == 'x' and names[k] in ('E', 'W')) or (ridge == 'y' and names[k] in ('S', 'N')))
        wall(acc, a, b, top, ops, MM, u_off, vb=vb, ubands=ub, vbands=vbands, lintel=0.22 if sp.get('lintel', True) else 0.0,
             age=age, par_top=top)
        if is_gable_end:
            tx, ty = (b[0] - a[0]) / L, (b[1] - a[1]) / L
            pk = (a[0] + tx * L / 2, a[1] + ty * L / 2, H + rise)
            def gm(p, n):
                return (0.0, 0.3, 1.0, 0.35 * math.exp(-(H + rise - p[2]) / 3.0))
            acc.poly([(a[0], a[1], H), (b[0], b[1], H), pk], [(u_off, H), (u_off + L, H), (u_off + L / 2, H + rise)], MM['wall'], gm,
                     (ty, -tx, 0))
        u_off += L
    if roof == 'flat':
        roof_flat(acc, (x0, y0, x1, y1), H, par, MM, age, rmat=sp.get('rmat', 'roof' if h01(seed, 17) < 0.62 else 'trim'))
    else:
        roof_gable(acc, (x0, y0, x1, y1), H, ridge, sp.get('pitch', 14), MM, age=age, rmat=sp.get('roofmat', 'corr'))
    if pil:
        pilotis(acc, sp, MM, H)
    if sp.get('win') in ('villa', 'shop'):
        gas_and_balconies(acc, sp, MM, H, faces, seed)
    acc.tint = (0.0, 0.0)
    extras(acc, sp, MM, H, par, rise, ridge)
    shop_signs(sp, face_ops, H)
    return H


def _face(sp, side):
    x0, y0, x1, y1 = sp['rect']
    a, b = {'S': ((x0, y0), (x1, y0)), 'E': ((x1, y0), (x1, y1)), 'N': ((x1, y1), (x0, y1)), 'W': ((x0, y1), (x0, y0))}[side]
    L = math.dist(a, b); t = ((b[0] - a[0]) / L, (b[1] - a[1]) / L); n = (t[1], -t[0])
    P = lambda u, v, d=0.0: Vector((a[0] + t[0] * u + n[0] * d, a[1] + t[1] * u + n[1] * d, v))   # d > 0 = 바깥
    return P, L, t, n


def gas_and_balconies(acc, sp, M, H, faces, seed):
    """한국 연립·상가주택 디테일: 외벽을 따라 도는 노란 가스관(층마다 가로 + 모서리 세로), 위층 작은 발코니(슬래브 + 철제 난간)."""
    rnd = random.Random(seed + 77)
    gf, fh, fl = sp['gf'], sp['fh'], sp['fl']
    mk = (0.0, 0.35, 0.9, 0.3)
    for side, role in faces.items():
        if role != 'street':
            continue
        P, L, t, n = _face(sp, side)
        ue = L - 0.35 if rnd.random() < 0.5 else 0.35
        acc.cyl(P(ue, 0.3, 0.12), P(ue, H - 0.4, 0.12), 0.032, 0.032, 6, M['gas'], mk)
        for f in range(1, fl):
            v = gf + (f - 1) * fh + 0.3
            ua = ue; ub = L * rnd.uniform(0.25, 0.6) if ue > L / 2 else L * rnd.uniform(0.4, 0.75)
            acc.cyl(P(ua, v, 0.12), P(ub, v, 0.12), 0.025, 0.025, 6, M['gas'], mk)
            acc.box(tuple(P(ub, v - 0.12, 0.0)), tuple(P(ub, v - 0.12, 0.0) + Vector((0.18, 0.18, 0.24))), M['gas'], mk)
        if sp.get('win') != 'villa':
            continue
        cs, _ = bays(L, WIN['villa']['bay'])
        for f in range(2, fl):
            vb = gf + (f - 1) * fh
            for k, uc in enumerate(cs):
                if (k + f) % 3:
                    continue
                w = 2.6; dep = 0.95
                q = [P(uc - w / 2, vb - 0.15, 0), P(uc + w / 2, vb - 0.15, 0), P(uc + w / 2, vb - 0.15, dep), P(uc - w / 2, vb - 0.15, dep)]
                top = [p + Vector((0, 0, 0.15)) for p in q]
                acc.poly(top, [(0, 0), (w, 0), (w, dep), (0, dep)], M['trim'], (0.35, 0.65, 0.9, 0.0), (0, 0, 1))
                acc.poly(q, [(0, 0), (w, 0), (w, dep), (0, dep)], M['trim'], (0.0, 0.4, 0.75, 0.3), (0, 0, -1))
                acc.poly([q[3], q[2], top[2], top[3]], [(0, 0), (w, 0), (w, 0.15), (0, 0.15)], M['trim'], (0.0, 0.4, 0.9, 0.5), (n[0], n[1], 0))
                for e0, e1, sg in ((0, 3, -1), (1, 2, 1)):
                    acc.poly([q[e0], q[e1], top[e1], top[e0]], [(0, 0), (dep, 0), (dep, 0.15), (0, 0.15)], M['trim'], (0, 0.4, 0.9, 0.3),
                             (t[0] * sg, t[1] * sg, 0))
                rail = [p + Vector((0, 0, 1.05)) for p in top]
                acc.cyl(rail[0], rail[3], 0.025, 0.025, 4, M['steel'], mk)
                acc.cyl(rail[3], rail[2], 0.025, 0.025, 4, M['steel'], mk)
                acc.cyl(rail[2], rail[1], 0.025, 0.025, 4, M['steel'], mk)
                for j in range(7):
                    pp = top[3].lerp(top[2], j / 6)
                    acc.cyl(pp, pp + Vector((0, 0, 1.05)), 0.012, 0.012, 4, M['steel'], mk, caps=(False, False))


def pilotis(acc, sp, M, H):
    """연립 1층 필로티 주차장: 기둥 + 천장 + 뒤쪽 계단실."""
    x0, y0, x1, y1 = sp['rect']; gf = sp['gf']
    c = (0.1, 0.4, 0.75, 0.0)
    acc.poly([(x0, y0, gf), (x0, y1, gf), (x1, y1, gf), (x1, y0, gf)], [(x0, y0), (x0, y1), (x1, y1), (x1, y0)], M['trim'],
             (0.0, 0.2, 0.45, 0.0), (0, 0, -1))
    nx = max(1, int((x1 - x0) / 5.5)); s = 0.45
    for i in range(nx + 1):
        x = x0 + s / 2 + (x1 - x0 - s) * i / nx
        for y in (y0 + s / 2, (y0 + y1) / 2):
            acc.box((x - s / 2, y - s / 2, -0.3), (x + s / 2, y + s / 2, gf), M['trim'],
                    lambda p, n: (0.6 * (1 - smoothstep(0.0, 0.5, p[2])), 0.3 + 0.5 * (1 - smoothstep(0.0, 1.0, p[2])), 1 - 0.4 * (1 - smoothstep(0, 1, p[2])), 0.0),
                    faces='xXyY')
    # 계단실(뒤쪽 반)
    cx0, cx1 = x0, x0 + min(4.5, (x1 - x0) * 0.35)
    cy0 = (y0 + y1) / 2
    def cm(p, n):
        return (0.7 * (1 - smoothstep(0.0, 0.5, p[2])), 0.3 + 0.55 * (1 - smoothstep(0.0, 1.1, p[2])), 1 - 0.5 * (1 - smoothstep(0, 1, p[2])), 0.0)
    acc.box((cx0 + 0.01, cy0, -0.3), (cx1, y1 - 0.01, gf), M['wall'], cm, faces='xXy')
    acc.poly([(cx0 + 1.0, cy0 - 0.001, 0), (cx0 + 2.2, cy0 - 0.001, 0), (cx0 + 2.2, cy0 - 0.001, 2.2), (cx0 + 1.0, cy0 - 0.001, 2.2)],
             [(0, 0), (1, 0), (1, 1), (0, 1)], M['glass'], (0, 0.2, 1, 0), (0, -1, 0))


def extras(acc, sp, M, H, par, rise, ridge):
    """옥상 물탱크·계단실·실외기, 외부 철제 계단, 흑색 강판 캐노피, 돌출 간판, 홈통."""
    x0, y0, x1, y1 = sp['rect']; gf = sp['gf']; fh = sp['fh']; fl = sp['fl']
    rnd = random.Random(sp.get('seed', int(x0 * 7 + y0 * 13)) + 5)
    for ex in sp.get('extras', ()):
        kind = ex[0]
        if kind == 'tank' and sp.get('roof', 'flat') == 'flat':
            px = x0 + (x1 - x0) * ex[1]; py = y0 + (y1 - y0) * ex[2]
            INST.append(('tank', (px, py, H), rnd.choice((0.0, math.pi / 2)), 1.0))
        elif kind == 'stairhouse':
            px = x0 + (x1 - x0) * ex[1]; py = y0 + (y1 - y0) * ex[2]
            hx, hy = 1.8, 2.4
            mk = lambda p, n: (0.25 if n[2] > 0.5 else 0.0, 0.45, 0.9 if n[2] > 0.5 else 0.8, 0.3)
            acc.box((px - hx, py - hy, H), (px + hx, py + hy, H + 2.7), M['wall'], mk, faces='xXyY')
            acc.box((px - hx - 0.15, py - hy - 0.15, H + 2.7), (px + hx + 0.15, py + hy + 0.15, H + 2.9), M['trim'], (0.4, 0.55, 0.95, 0.0))
            acc.poly([(px - 0.5, py - hy - 0.001, H), (px + 0.5, py - hy - 0.001, H), (px + 0.5, py - hy - 0.001, H + 2.1),
                      (px - 0.5, py - hy - 0.001, H + 2.1)], [(0, 0), (1, 0), (1, 2), (0, 2)], M['steel'], (0, 0.3, 0.8, 0), (0, -1, 0))
        elif kind == 'aircon_roof':
            for i in range(ex[1]):
                px = rnd.uniform(x0 + 1.5, x1 - 1.5); py = rnd.uniform(y0 + 1.5, y1 - 1.5)
                INST.append(('aircon', (px, py, H + (0.0 if sp.get('roof', 'flat') == 'flat' else rise * 0.0)), rnd.uniform(0, 6.3), 1.0))
        elif kind == 'aircon_wall':
            side, n = ex[1], ex[2]
            for i in range(n):
                f = rnd.randrange(1, max(2, fl))
                z = gf + (f - 1) * fh + 0.4 if fl > 1 else 0.05
                if side in ('S', 'N'):
                    px = rnd.uniform(x0 + 1.2, x1 - 1.2); py = (y0 - 0.25) if side == 'S' else (y1 + 0.25)
                    rz = 0.0 if side == 'S' else math.pi
                else:
                    py = rnd.uniform(y0 + 1.2, y1 - 1.2); px = (x1 + 0.25) if side == 'E' else (x0 - 0.25)
                    rz = math.pi / 2 if side == 'E' else -math.pi / 2
                if fl == 1 or rnd.random() < 0.3:
                    z = 0.05      # 땅 위 실외기
                    if side in ('S', 'N'):
                        py += (-0.25 if side == 'S' else 0.25)
                    else:
                        px += (0.25 if side == 'E' else -0.25)
                INST.append(('aircon', (px, py, z), rz, 1.0))
                if z > 1.0:
                    # 실외기 받침(앵글 브래킷)
                    d = Vector((math.sin(rz), -math.cos(rz), 0))
                    base = Vector((px, py, z))
                    for s in (-0.3, 0.3):
                        e = Vector((math.cos(rz), math.sin(rz), 0)) * s
                        a = base + e - d * 0.25; b2 = base + e + d * 0.2
                        acc.cyl(a + Vector((0, 0, -0.02)), b2 + Vector((0, 0, -0.02)), 0.02, 0.02, 4, M['steel'], (0, 0.4, 0.8, 0.2))
        elif kind == 'stairs':
            ext_stairs(acc, sp, M, ex[1], H)
        elif kind == 'canopy':
            side, a0, a1 = ex[1], ex[2], ex[3]
            z = gf - 0.35; dep = ex[4] if len(ex) > 4 else 2.2
            mk = (0.1, 0.4, 0.85, 0.0)
            if side == 'N':
                acc.box((x0 + a0, y1, z), (x0 + a1, y1 + dep, z + 0.34), M['steel'], mk)
                if sp.get('sign') == 'canopy':
                    cx = x0 + (a0 + a1) / 2
                    _letters(_frame(Vector((cx, y1 + dep + 0.002, z + 0.17)), Vector((-1, 0, 0)), Vector((0, 0, 1)), Vector((0, 1, 0))),
                             biz_name(sp), 0.24, 0.03, pal_uv(1, 0))
                for xx in (x0 + a0 + 0.3, x0 + a1 - 0.3):
                    acc.cyl((xx, y1 + dep - 0.1, z + 0.18), (xx, y1 + 0.05, z + 1.4), 0.02, 0.02, 4, M['steel'], mk)
            elif side == 'S':
                acc.box((x0 + a0, y0 - dep, z), (x0 + a1, y0, z + 0.18), M['steel'], mk)
                for xx in (x0 + a0 + 0.3, x0 + a1 - 0.3):
                    acc.cyl((xx, y0 - dep + 0.1, z + 0.18), (xx, y0 - 0.05, z + 1.4), 0.02, 0.02, 4, M['steel'], mk)
            elif side == 'W':
                acc.box((x0 - dep, y0 + a0, z), (x0, y0 + a1, z + 0.18), M['steel'], mk)
            elif side == 'E':
                acc.box((x1, y0 + a0, z), (x1 + dep, y0 + a1, z + 0.18), M['steel'], mk)
        elif kind == 'vsign':
            side, a = ex[1], ex[2]
            vsign(sp, side, a, gf + 0.3, min(H - 0.3, gf + 0.3 + 4.2), biz_name(sp, side), ex[3] if len(ex) > 3 else 0)
        elif kind == 'billboard':
            side, a, w, hh = ex[1], ex[2], ex[3], ex[4]
            billboard(sp, side, a, w, hh, H + par, ex[5] if len(ex) > 5 else '임대문의')
        elif kind == 'pipes':
            for (px, py) in ((x0 - 0.1, y0 - 0.1), (x1 + 0.1, y0 - 0.1), (x1 + 0.1, y1 + 0.1), (x0 - 0.1, y1 + 0.1))[:ex[1]]:
                INST.append(('pipe', (px, py, 0.4), 0.0, (1.0, 1.0, max(1.0, H + par - 0.6))))
                INST.append(('pipe_out', (px, py, 0.0), rnd.uniform(0, 6.3), 1.0))
        elif kind == 'fire_escape':
            side, a = ex[1], ex[2]
            zf = gf + 0.2                     # 원형 바닥 = 0 → 2층 바닥부터 지붕 아래까지(약 9.8 m)
            if side == 'E':
                INST.append(('fire_escape', (x1 + 0.75, y0 + a, zf), math.pi / 2, 1.0))
            elif side == 'W':
                INST.append(('fire_escape', (x0 - 0.75, y0 + a, zf), -math.pi / 2, 1.0))
            elif side == 'N':
                INST.append(('fire_escape', (x0 + a, y1 + 0.75, zf), math.pi, 1.0))
            else:
                INST.append(('fire_escape', (x0 + a, y0 - 0.75, zf), 0.0, 1.0))


def ext_stairs(acc, sp, M, side, H):
    """외부 철제 계단(연립·상가주택 측면): 층마다 꺾이는 경사판 + 참 + 난간."""
    x0, y0, x1, y1 = sp['rect']; gf, fh, fl = sp['gf'], sp['fh'], sp['fl']
    mk = (0.05, 0.4, 0.85, 0.25)
    w = 1.1
    if side in ('E', 'W'):
        xo = x1 if side == 'E' else x0 - w
        ya, yb = y0 + 0.6, y0 + 0.6 + 5.0
        levels = [0.0] + [gf + (f - 1) * fh for f in range(1, fl)]
        for i in range(len(levels) - 1):
            za, zb = levels[i], levels[i + 1]
            ys, ye = (ya, yb) if i % 2 == 0 else (yb, ya)
            # 경사판
            p = [(xo, ys, za), (xo + w, ys, za), (xo + w, ye, zb), (xo, ye, zb)]
            acc.poly(p, [(0, 0), (w, 0), (w, 5.6), (0, 5.6)], M['steel'], mk, (0, 0, 1))
            acc.poly([(q[0], q[1], q[2] - 0.12) for q in p], [(0, 0), (w, 0), (w, 5.6), (0, 5.6)], M['steel'], mk, (0, 0, -1))
            # 참
            yl = ye
            acc.box((xo, min(yl, yl + (1.2 if ye > ys else -1.2)), zb - 0.12), (xo + w, max(yl, yl + (1.2 if ye > ys else -1.2)), zb),
                    M['steel'], mk)
            # 난간(바깥쪽 한 줄)
            xr = xo + (w if side == 'E' else 0.0)
            acc.cyl((xr, ys, za + 1.0), (xr, ye, zb + 1.0), 0.025, 0.025, 4, M['steel'], mk)
            acc.cyl((xr, ye, zb), (xr, ye, zb + 1.0), 0.025, 0.025, 4, M['steel'], mk)
    else:
        yo = y0 - w if side == 'S' else y1
        xa, xb = x0 + 0.6, x0 + 5.6
        levels = [0.0] + [gf + (f - 1) * fh for f in range(1, fl)]
        for i in range(len(levels) - 1):
            za, zb = levels[i], levels[i + 1]
            xs, xe = (xa, xb) if i % 2 == 0 else (xb, xa)
            p = [(xs, yo, za), (xe, yo, zb), (xe, yo + w, zb), (xs, yo + w, za)]
            acc.poly(p, [(0, 0), (5.6, 0), (5.6, w), (0, w)], M['steel'], mk, (0, 0, 1))
            acc.poly([(q[0], q[1], q[2] - 0.12) for q in p], [(0, 0), (5.6, 0), (5.6, w), (0, w)], M['steel'], mk, (0, 0, -1))
            xl = xe
            acc.box((min(xl, xl + (1.2 if xe > xs else -1.2)), yo, zb - 0.12), (max(xl, xl + (1.2 if xe > xs else -1.2)), yo + w, zb),
                    M['steel'], mk)
            yr = yo + (0.0 if side == 'S' else w)
            acc.cyl((xs, yr, za + 1.0), (xe, yr, zb + 1.0), 0.025, 0.025, 4, M['steel'], mk)
            acc.cyl((xe, yr, zb), (xe, yr, zb + 1.0), 0.025, 0.025, 4, M['steel'], mk)


# ═════════════════════════════ 한글 간판(B2) ═════════════════════════════
# 가로 채널 간판(판 + 돌출 글자), 세로 돌출 간판, 차양, 옥상 광고판, A형 입간판. 상호는 모두 가상의 일반 업종명이다.
# 글꼴: Noto Sans KR Bold(OFL, build/nowhere-src/fonts) — Blender 텍스트를 메시로 바꿔 합친다(글꼴 파일은 출하하지 않음).
# 재질 2개(NW_sign_panel·NW_sign_letters)가 팔레트 텍스처 한 장을 공유하고 색은 UV 칸으로 고른다(조합 예산).
FONT_FILE = os.path.join(lib.SRC, 'fonts', 'NotoSansKR-Bold.otf')
SIGNS = {}                 # 'panel' / 'letters' → Acc (build() 가 만든다)
KIT = None
MATS = {}                  # build() 의 재질 표(간판 함수가 쓴다)
STATIC = None              # 정적 비인스턴스 부품 묶음(Acc) — build() 끝에서 재질별 메시로 나뉜다
BIZ = {   # 건물 → 상호(가상의 일반 업종명)
    'B1': '동광피혁', 'B2': '새한인쇄', 'B3': '성일정밀', 'B4': '제일카센터', 'B5': '한결수제화', 'B6': '다온커피', 'B7': '일신철공',
    'B8': '대명금속', 'B9': '삼원제본', 'B10': '명진기계', 'B11': '신흥공업사', 'W1': '태광목형', 'W2': '금성도장',
    'F1': '부흥슈퍼', 'F2': '성수철물', 'F3': '세진타이어', 'M1': '우성상사', 'M2': '동신피혁', 'V3': '소담분식', 'V6': '미성세탁',
    'V8': '정원수선', 'E1a': '한빛가죽', 'E1b': '진주식당', 'E1c': '행운부동산', 'E1e': '우리문구', 'E1f': '동아보일러',
    'SH1': '대성상회', 'SH2': '한마음식당', 'SH3': '나래학원', 'SH4': '서울용접', 'MX': '성수빌딩',
}
SIGN_COLORS = [(0, 0, 1, 1), (0, 1, 1, 0), (0, 2, 1, 0), (0, 3, 1, 3), (0, 4, 1, 0), (0, 5, 1, 2), (0, 6, 1, 4), (0, 7, 1, 0)]
#               (바탕 행, 바탕 칸, 글자 행, 글자 칸): 흰/빨강, 남색/흰, 빨강/흰, 노랑/검정, 초록/흰, 검정/노랑, 회색/파랑, 적갈/흰


def biz_name(sp, side=''):
    return BIZ.get(sp.get('name', ''), '성수상회')


class TextKit:
    """한글 글자 메시 만들기(글꼴 곡선 → 메시). 같은 문구·크기는 한 번만 만든다. close() 가 임시 데이터를 모두 지운다."""

    def __init__(self, sc):
        self.sc = sc
        self.font = bpy.data.fonts.load(FONT_FILE, check_existing=True)
        self.tmp = bpy.data.collections.new('NW_tmp_text')
        sc.collection.children.link(self.tmp)
        self.cache = {}

    def glyphs(self, body, size, extrude=0.0, vertical=False):
        key = (body, round(size, 3), round(extrude, 3), vertical)
        if key in self.cache:
            return self.cache[key]
        cu = ob = me = None
        try:                                        # 중간에 실패해도 임시 곡선·객체·메시를 남기지 않는다
            cu = bpy.data.curves.new('NW_tmp_text', 'FONT')
            cu.font = self.font; cu.body = '\n'.join(body) if vertical else body
            cu.size = size; cu.extrude = extrude; cu.resolution_u = 2
            cu.align_x = 'CENTER'; cu.align_y = 'CENTER'; cu.space_line = 0.92
            ob = bpy.data.objects.new('NW_tmp_text', cu); self.tmp.objects.link(ob)
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
        # 글꼴 크기 단위가 글꼴마다 달라서(이 글꼴은 크기 1 ≈ 글자 0.3 m) 실제 글자 높이(세로쓰기는 폭)가 size 가 되게 맞춘다
        k = size / max(1e-6, w if vertical else h) if body.strip() else 1.0
        V = [((x - cx) * k, (y - cy) * k, z - z0) for x, y, z in V]   # 가운데 정렬, 뒷면 z = 0, 두께는 그대로
        out = (V, F, w * k, h * k)
        self.cache[key] = out
        return out

    def close(self):
        cleanup_text_tmp()
        # 임시 글꼴 곡선은 모두 지웠다. 글꼴 사용자 수가 의존 그래프 캐시 때문에 남아 있어도 데이터블록을 떼어 지운다.
        f = bpy.data.fonts.get(self.font.name) if self.font is not None else None
        if f is not None and not any(getattr(c, 'font', None) == f for c in bpy.data.curves):
            bpy.data.fonts.remove(f, do_unlink=True)
        self.font = None


def cleanup_text_tmp():
    """TextKit 의 임시 컬렉션 NW_tmp_text 와 그 안 객체, 이름이 NW_tmp_text 인 글꼴 곡선을 지운다(실패한 지난 실행 포함)."""
    for c in [c for c in bpy.data.collections if c.name.startswith('NW_tmp_text')]:
        for o in list(c.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.collections.remove(c)
    for o in [o for o in bpy.data.objects if o.name.startswith('NW_tmp_text')]:
        bpy.data.objects.remove(o, do_unlink=True)
    for cu in [cu for cu in bpy.data.curves if cu.name.startswith('NW_tmp_text') and cu.users == 0]:
        bpy.data.curves.remove(cu)


def _frame(origin, right, up, out):
    """열 벡터(오른쪽, 위, 바깥)와 원점으로 변환 행렬."""
    m = Matrix.Identity(4)
    for i, v in enumerate((right, up, out)):
        for r in range(3):
            m[r][i] = v[r]
    for r in range(3):
        m[r][3] = origin[r]
    return m


def _pbox(acc, M, c0, c1, mat, uv, mk, faces='xXyYzZ'):
    """변환 M 안의 상자, 모든 면이 같은 UV(팔레트 칸)."""
    x0, y0, z0 = c0; x1, y1, z1 = c1
    q = {'x': ([(x0, y1, z0), (x0, y0, z0), (x0, y0, z1), (x0, y1, z1)], (-1, 0, 0)),
         'X': ([(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)], (1, 0, 0)),
         'y': ([(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)], (0, -1, 0)),
         'Y': ([(x1, y1, z0), (x0, y1, z0), (x0, y1, z1), (x1, y1, z1)], (0, 1, 0)),
         'z': ([(x0, y1, z0), (x1, y1, z0), (x1, y0, z0), (x0, y0, z0)], (0, 0, -1)),
         'Z': ([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], (0, 0, 1))}
    R = M.to_3x3()
    for f in faces:
        pts, nrm = q[f]
        acc.poly([tuple(M @ Vector(p)) for p in pts], [uv] * 4, mat, mk, tuple(R @ Vector(nrm)))


def _letters(M, body, size, extrude, uv, vertical=False):
    V, F, w, h = KIT.glyphs(body, size, extrude, vertical)
    SIGNS['letters'].mesh(M, V, F, MATS['letters'], (0.0, 0.3, 0.95, 0.1), uvfn=lambda p, uv=uv: uv)
    return w, h


def board_sign(P, t, n, uc, vc, name, colors, size=0.5, depth=0.14, maxw=None, raceway=False):
    """가로 채널 간판: 바탕 판(두께 depth) 위에 돌출 글자(0.05 m). raceway=True 면 판 없이 가는 철제 받침대 위 글자만."""
    br, bc, lr, lc = colors
    V, F, w, h = KIT.glyphs(name, size, 0.05)
    W = w + size * 1.4
    if maxw is not None and W > maxw:
        size *= maxw / W; V, F, w, h = KIT.glyphs(name, size, 0.05); W = w + size * 1.4
    up = Vector((0, 0, 1)); right = Vector((t[0], t[1], 0)); out = Vector((n[0], n[1], 0))
    M0 = _frame(P(uc, vc, 0.0), right, up, out)
    if raceway:
        _pbox(SIGNS['panel'], M0, (-w / 2, -0.06, 0.0), (w / 2, 0.06, 0.08), MATS['steel'], pal_uv(3, 0), (0, 0.4, 0.9, 0.3))
        _letters(M0 @ Matrix.Translation((0, 0, 0.08)), name, size, 0.05, pal_uv(lr, lc))
        return
    H_ = size * 1.55
    _pbox(SIGNS['panel'], M0, (-W / 2, -H_ / 2, 0.0), (W / 2, H_ / 2, depth), MATS['sign'], pal_uv(br, bc), (0.0, 0.35, 0.9, 0.5))
    _pbox(SIGNS['panel'], M0, (-W / 2 - 0.04, -H_ / 2 - 0.04, depth), (W / 2 + 0.04, -H_ / 2, depth + 0.03), MATS['sign'], pal_uv(3, 1),
          (0.0, 0.4, 0.9, 0.2), faces='yZXx')
    _letters(M0 @ Matrix.Translation((0, 0, depth + 0.004)), name, size, 0.05, pal_uv(lr, lc))


def shop_signs(sp, face_ops, H):
    """B2: 길·골목 쪽 1층 위 간판, 진열창 위 차양. 공장·공방(셔터)은 셔터 위 간판."""
    gfk = sp.get('gfk', 'shutter'); gf = sp['gf']
    if gfk == 'pilotis' or sp.get('name') not in BIZ:
        return
    name = biz_name(sp)
    k = int(h01(sp['name'], 'sign') * len(SIGN_COLORS))
    for side, (role, ops) in face_ops.items():
        if role != 'street':
            continue
        P, L, t, n = _face(sp, side)
        tops = [o['v1'] for o in ops if o['v0'] < 0.5]
        v0 = max([gf - 0.95] + [v + 0.15 for v in tops if v < gf - 0.3])
        if sp.get('awning') is not None and any(o.get('shopfront') for o in ops):
            v0 = max(v0, max(o['v1'] for o in ops if o.get('shopfront')) + 0.5)     # 차양(진열창 위 0.45 m) 위로
        vc = v0 + 0.45
        if sp.get('sign') == 'canopy':
            continue                                  # 카페: 캐노피 앞판 글자(extras 'canopy' 가 만든다)
        cols = SIGN_COLORS[k % len(SIGN_COLORS)]
        if L > 26:
            board_sign(P, t, n, L * 0.3, vc, name, cols, maxw=L * 0.45)
            board_sign(P, t, n, L * 0.72, vc, name, SIGN_COLORS[(k + 3) % len(SIGN_COLORS)], maxw=L * 0.4)
        else:
            board_sign(P, t, n, L / 2, vc, name, cols, maxw=L - 1.2)
        k += 1
        if sp.get('awning') is not None:
            for o in ops:
                if o.get('shopfront'):
                    awning(P, t, n, o['u0'] - 0.15, o['u1'] + 0.15, o['v1'] + 0.02, sp['awning'])


def awning(P, t, n, u0, u1, v, color_col):
    """천 차양: 벽에서 1.1 m 내밀고 0.45 m 내려간 경사판 + 앞 드림(0.22 m) + 옆 삼각."""
    acc = SIGNS['panel']; uv = pal_uv(2, color_col); mk = (0.0, 0.45, 0.9, 0.4)
    a = P(u0, v + 0.45, 0.0); b = P(u1, v + 0.45, 0.0); c = P(u1, v, 1.1); d = P(u0, v, 1.1)
    up = Vector((0, 0, 1))
    acc.poly([a, b, c, d], [uv] * 4, MATS['sign'], mk, tuple((Vector((n[0], n[1], 0)) * 0.4 + up).normalized()))
    acc.poly([a, b, c, d], [uv] * 4, MATS['sign'], (0.0, 0.3, 0.6, 0.0), tuple(-(Vector((n[0], n[1], 0)) * 0.4 + up).normalized()))
    acc.poly([d, c, c - up * 0.22, d - up * 0.22], [uv] * 4, MATS['sign'], mk, (n[0], n[1], 0))
    for e0, e1, sg in ((a, d, -1), (b, c, 1)):
        acc.poly([e0, e1, e1 - up * 0.22], [uv] * 3, MATS['sign'], mk, (t[0] * sg, t[1] * sg, 0))


def vsign(sp, side, a, z0, z1, name, k=0):
    """세로 돌출 간판(벽에서 0.25…0.85 m, 두께 0.3 m): 양면에 세로 글자."""
    P, L, t, n = _face(sp, side)
    cols = SIGN_COLORS[(int(h01(sp.get('name', ''), 'v') * 8) + k) % len(SIGN_COLORS)]
    br, bc, lr, lc = cols
    chars = name if len(name) <= 5 else name[:5]
    size = min(0.42, (z1 - z0 - 0.4) / max(1, len(chars)) / 1.05)
    hgt = len(chars) * size * 1.05 + 0.4
    z1 = z0 + hgt
    T = Vector((t[0], t[1], 0)); N = Vector((n[0], n[1], 0)); up = Vector((0, 0, 1))
    base = P(a, z0, 0.0)
    M0 = _frame(base, T, up, N)             # 로컬 x = 벽 따라, z = 바깥
    _pbox(SIGNS['panel'], M0, (-0.15, 0.0, 0.25), (0.15, hgt, 0.85), MATS['sign'], pal_uv(br, bc), (0.0, 0.35, 0.9, 0.5))
    for zz in (0.35, hgt - 0.35):
        _pbox(SIGNS['panel'], M0, (-0.03, zz, 0.0), (0.03, zz + 0.06, 0.25), MATS['steel'], pal_uv(3, 0), (0, 0.4, 0.9, 0.2))
    mid = base + up * (hgt / 2) + N * 0.55
    for f in (T, -T):
        d = -f; right = Vector((d.y, -d.x, 0))
        _letters(_frame(mid + f * 0.152, right, up, f), chars, size, 0.0, pal_uv(lr, lc), vertical=True)


def billboard(sp, side, a, w, hh, ztop, text):
    """옥상 광고판: 철골 기둥·버팀 + 바탕 판 + 큰 글자."""
    P, L, t, n = _face(sp, side)
    acc = SIGNS['panel']
    T = Vector((t[0], t[1], 0)); N = Vector((n[0], n[1], 0)); up = Vector((0, 0, 1))
    zb = ztop + 1.2
    org = P(a, zb, -1.2)
    M0 = _frame(org, T, up, N)
    k = int(h01(sp.get('name', ''), 'bb') * 8)
    br, bc, lr, lc = SIGN_COLORS[k % len(SIGN_COLORS)]
    _pbox(acc, M0, (-w / 2, 0.0, -0.15), (w / 2, hh, 0.0), MATS['sign'], pal_uv(br, bc), (0.0, 0.3, 0.95, 0.5))
    for j in range(3):
        x = -w / 2 + w * (j + 0.5) / 3
        _pbox(acc, M0, (x - 0.08, -(zb - ztop) - 0.0, -0.3), (x + 0.08, 0.0, -0.15), MATS['steel'], pal_uv(3, 0), (0, 0.4, 0.85, 0.2))
        pp = M0 @ Vector((x, hh * 0.7, -0.3)); q = M0 @ Vector((x, -(zb - ztop), -1.8))
        acc.cyl(pp, q, 0.05, 0.05, 4, MATS['steel'], (0, 0.4, 0.85, 0.2))
    V, F, tw, th = KIT.glyphs(text, hh * 0.45, 0.06)
    size = hh * 0.45 * min(1.0, (w * 0.86) / max(0.1, tw))
    _letters(M0 @ Matrix.Translation((0, hh / 2, 0.004)), text, size, 0.06, pal_uv(lr, lc))


def aframe_sign(x, y, z, rz, text, k):
    """A형 입간판(0.56 × 0.95 m): 양면 판 + 글자."""
    acc = SIGNS['panel']
    br, bc, lr, lc = SIGN_COLORS[k % len(SIGN_COLORS)]
    R = Matrix.Translation((x, y, z)) @ Matrix.Rotation(rz, 4, 'Z')
    for sy in (-1, 1):
        tilt = Matrix.Rotation(sy * math.radians(12), 4, 'X')
        M0 = R @ Matrix.Translation((0, sy * 0.01, 0)) @ tilt
        out = Vector((0, sy, 0))
        pts = [Vector((-0.28, sy * 0.0, 0.0)), Vector((0.28, 0.0, 0.0)), Vector((0.28, 0.0, 0.95)), Vector((-0.28, 0.0, 0.95))]
        acc.poly([tuple(M0 @ p) for p in pts], [pal_uv(br, bc)] * 4, MATS['sign'], (0.0, 0.4, 0.9, 0.0), tuple((M0.to_3x3() @ out)))
        acc.poly([tuple(M0 @ (p - out * 0.015)) for p in pts], [pal_uv(3, 0)] * 4, MATS['steel'], (0.0, 0.4, 0.85, 0.0),
                 tuple(-(M0.to_3x3() @ out)))
        d = -(M0.to_3x3() @ out); right = Vector((d.y, -d.x, 0)).normalized() if Vector((d.y, -d.x, 0)).length > 1e-6 else Vector((1, 0, 0))
        upv = (M0.to_3x3() @ Vector((0, 0, 1))).normalized()
        f = (M0.to_3x3() @ out).normalized()
        c = M0 @ Vector((0, 0.0, 0.55)) + f * 0.004
        _letters(_frame(c, right, upv, f), text, 0.17, 0.0, pal_uv(lr, lc), vertical=len(text) <= 2)


# ═════════════════════════════ 블록별 건물 표 ═════════════════════════════
# rect = (x0, y0, x1, y1). 면 역할: S/E/N/W → street(길·골목 쪽 정면), back, side, blank.
# 성수 공장·창고 띠(§3, 리서치 키트 #1~#3): 2~4F, 30~65 × 12~25 m 직사각 동이 같은 방향(장축 x)으로 줄짓는다.
BELT = [
    dict(name='B1', rect=(-99.0, 76.5, -64.0, 92.0), fl=3, gf=4.2, fh=3.6, wall='brick_old', roof='gable', ridge='x', pitch=12,
         faces={'S': 'street', 'N': 'back', 'E': 'side', 'W': 'side'}, gfk='shutter', age=1.0,
         extras=[('pipes', 2), ('aircon_wall', 'E', 2), ('vsign', 'S', 4.0, 0)]),
    dict(name='B2', rect=(-60.0, 76.5, -24.5, 90.0), fl=2, gf=4.5, fh=3.8, wall='brick', roof='flat', par=0.8,
         faces={'S': 'street', 'N': 'back', 'E': 'side', 'W': 'side'}, gfk='mixed', age=0.9,
         extras=[('tank', 0.2, 0.7), ('aircon_roof', 2), ('pipes', 2), ('aircon_wall', 'S', 2), ('vsign', 'S', 30.0, 1)]),
    dict(name='B3', rect=(-20.0, 76.5, 30.0, 97.0), fl=4, gf=4.5, fh=3.7, wall='brick', roof='flat', par=1.0, frame=True,
         faces={'S': 'street', 'N': 'street', 'E': 'side', 'W': 'side'}, gfk='shutter', age=1.0,
         extras=[('tank', 0.8, 0.3), ('stairhouse', 0.15, 0.5), ('aircon_roof', 4), ('pipes', 4), ('aircon_wall', 'N', 3),
                 ('vsign', 'N', 12.0, 2)]),
    dict(name='B4', rect=(34.0, 76.5, 62.5, 88.5), fl=2, gf=4.0, fh=3.0, wall='corr', trim='steel', roof='gable', ridge='x', pitch=15,
         faces={'S': 'street', 'N': 'back', 'E': 'street', 'W': 'side'}, gfk='shutter', age=0.7, lintel=False, sills=False,
         extras=[('aircon_wall', 'E', 2), ('vsign', 'E', 4.0, 2)]),
    dict(name='B5', rect=(-34.0, 108.0, 3.0, 130.0), fl=3, gf=4.2, fh=3.6, wall='brick_old', roof='gable', ridge='x', pitch=11,
         faces={'S': 'back', 'N': 'street', 'E': 'street', 'W': 'side'}, gfk='mixed', age=1.1,
         extras=[('pipes', 3), ('aircon_wall', 'E', 3), ('stairs', 'E'), ('vsign', 'N', 5.0, 1)]),
    dict(name='B6', rect=(19.0, 106.0, 64.0, 128.0), fl=2, gf=4.6, fh=4.0, wall='brick', sign='canopy', roof='gable', ridge='x', pitch=16,
         faces={'S': 'back', 'N': 'street', 'E': 'side', 'W': 'street'}, gfk='shop', age=0.9,
         phwin=('N',), extras=[('canopy', 'N', 1.0, 15.0, 3.0), ('canopy', 'W', 2.0, 14.0, 2.0), ('pipes', 2),
                               ('aircon_wall', 'S', 3), ('vsign', 'N', 30.0, 0)]),
    dict(name='B7', rect=(36.0, 93.0, 62.5, 102.0), fl=1, gf=4.0, fh=3.0, wall='corr', trim='steel', roof='gable', ridge='x', pitch=10,
         faces={'S': 'side', 'N': 'street', 'E': 'side', 'W': 'street'}, gfk='shutter', age=0.6, lintel=False, sills=False, extras=[]),
    dict(name='B8', rect=(76.0, 76.5, 116.0, 92.0), fl=3, gf=4.2, fh=3.6, wall='brick_old', roof='flat', par=0.9,
         faces={'S': 'street', 'N': 'back', 'E': 'side', 'W': 'street'}, gfk='mixed', age=1.0,
         extras=[('tank', 0.7, 0.5), ('aircon_roof', 3), ('pipes', 2), ('aircon_wall', 'W', 3), ('vsign', 'W', 4.0, 0)]),
    dict(name='B9', rect=(120.0, 76.5, 160.0, 94.0), fl=2, gf=4.4, fh=3.6, wall='brick', roof='gable', ridge='x', pitch=13,
         faces={'S': 'street', 'N': 'back', 'E': 'side', 'W': 'side'}, gfk='shutter', age=0.9, extras=[('pipes', 2)]),
    dict(name='B10', rect=(76.0, 108.0, 110.0, 131.0), fl=4, gf=4.4, fh=3.6, wall='brick', roof='flat', par=1.0, frame=True,
         faces={'S': 'back', 'N': 'street', 'E': 'side', 'W': 'street'}, gfk='garage', age=1.0,
         extras=[('tank', 0.3, 0.4), ('aircon_roof', 3), ('pipes', 2), ('fire_escape', 'W', 8.0)]),
    dict(name='B11', rect=(114.0, 112.0, 160.0, 131.0), fl=2, gf=4.2, fh=3.4, wall='brick_paint', roof='gable', ridge='x', pitch=12,
         faces={'S': 'back', 'N': 'street', 'E': 'side', 'W': 'side'}, gfk='shutter', age=1.1, extras=[('pipes', 2)]),
    dict(name='B12', rect=(-99.5, 93.5, -62.0, 101.0), fl=3, gf=3.6, fh=3.4, wall='stucco', roof='flat', par=0.9,
         faces={'S': 'back', 'N': 'street', 'E': 'side', 'W': 'side'}, gfk='door', win='office', age=0.6,
         extras=[('tank', 0.85, 0.5), ('stairhouse', 0.15, 0.5)]),
    # 빈 마당을 채우는 1층 골함석 작업동(B3)
    dict(name='W1', rect=(-33.0, 98.5, -15.0, 105.5), fl=1, gf=4.2, fh=3.0, wall='corr', trim='steel', roof='gable', ridge='x', pitch=12,
         faces={'S': 'side', 'N': 'street', 'E': 'street', 'W': 'side'}, gfk='shutter', age=0.8, lintel=False, sills=False, extras=[]),
    dict(name='W2', rect=(140.0, 97.0, 159.5, 106.0), fl=1, gf=4.4, fh=3.0, wall='corr', trim='steel', roof='gable', ridge='x', pitch=12,
         faces={'S': 'street', 'N': 'side', 'E': 'side', 'W': 'street'}, gfk='shutter', age=0.9, lintel=False, sills=False, extras=[]),
]

# HAUS 블록(C1): 뚝섬로 앞 상가(HAUS 서쪽은 길 건너 시점에서 HAUS 를 가리지 않게 낮게·띄워서) + 북쪽 노후 연립 4~5F
C1 = [
    dict(name='F1', rect=(-99.5, -29.0, -84.0, -13.0), fl=4, gf=4.0, fh=3.0, wall='tile', roof='flat', par=0.8, awning=0, win='villa',
         faces={'S': 'street', 'W': 'street', 'N': 'back', 'E': 'side'}, gfk='shop', age=0.7,
         extras=[('tank', 0.3, 0.6), ('stairhouse', 0.7, 0.6), ('aircon_wall', 'E', 3), ('vsign', 'S', 13.5, 0), ('stairs', 'E')]),
    dict(name='F2', rect=(-80.0, -30.0, -62.5, -12.0), fl=2, gf=4.2, fh=3.4, wall='brick', roof='flat', par=0.8, win='shop',
         faces={'S': 'street', 'W': 'side', 'N': 'back', 'E': 'side'}, gfk='mixed', age=0.8,
         extras=[('tank', 0.75, 0.6), ('aircon_wall', 'E', 2), ('pipes', 2), ('vsign', 'S', 15.5, 2), ('billboard', 'S', 8.0, 9.0, 3.2, '성수철물')]),
    dict(name='F3', rect=(-59.0, -30.0, -49.0, -20.0), fl=1, gf=4.6, fh=3.0, wall='corr', trim='steel', roof='gable', ridge='y', pitch=12,
         faces={'S': 'street', 'E': 'side', 'N': 'side', 'W': 'side'}, gfk='shutter', age=0.6, lintel=False, sills=False, extras=[]),
    dict(name='M1', rect=(-98.0, -6.0, -78.0, 20.0), fl=3, gf=3.8, fh=3.4, wall='brick_paint', roof='flat', par=0.8, win='office',
         faces={'S': 'street', 'N': 'back', 'E': 'street', 'W': 'street'}, gfk='door', age=1.0,
         extras=[('tank', 0.3, 0.5), ('aircon_roof', 2), ('pipes', 2)]),
    dict(name='M2', rect=(-72.0, 4.0, -50.0, 24.0), fl=2, gf=4.4, fh=3.6, wall='brick', roof='gable', ridge='x', pitch=12,
         faces={'S': 'street', 'N': 'back', 'E': 'side', 'W': 'side'}, gfk='shutter', age=1.0, extras=[('pipes', 2)]),
    dict(name='V1', rect=(-98.0, 34.0, -82.0, 50.0), fl=4, gf=2.8, fh=2.8, wall='brick_old', roof='flat', par=0.9, win='villa',
         faces={'S': 'street', 'N': 'back', 'E': 'side', 'W': 'street'}, gfk='pilotis', age=1.0,
         extras=[('tank', 0.7, 0.7), ('stairhouse', 0.3, 0.7), ('aircon_wall', 'S', 3), ('pipes', 2)]),
    dict(name='V2', rect=(-76.0, 38.0, -60.0, 58.0), fl=5, gf=2.9, fh=2.8, wall='tile_white', roof='flat', par=0.9, win='villa',
         faces={'S': 'street', 'N': 'back', 'E': 'side', 'W': 'side'}, gfk='pilotis', age=0.8,
         extras=[('tank', 0.3, 0.3), ('stairhouse', 0.7, 0.75), ('aircon_wall', 'E', 4)]),
    dict(name='V3', rect=(-54.0, 32.0, -40.0, 48.0), fl=4, gf=3.6, fh=2.8, wall='brick_old', roof='flat', par=0.9, awning=4, win='villa',
         faces={'S': 'street', 'N': 'back', 'E': 'side', 'W': 'side'}, gfk='shop', age=1.0,
         extras=[('tank', 0.5, 0.6), ('stairs', 'W'), ('aircon_wall', 'S', 2)]),
    dict(name='V4', rect=(-34.0, 36.0, -18.0, 56.0), fl=5, gf=2.9, fh=2.8, wall='brick', roof='flat', par=0.9, win='villa',
         faces={'S': 'street', 'N': 'back', 'E': 'side', 'W': 'side'}, gfk='pilotis', age=0.9,
         extras=[('tank', 0.3, 0.7), ('stairhouse', 0.7, 0.7), ('aircon_wall', 'W', 3), ('pipes', 2)]),
    dict(name='V5', rect=(-12.0, 34.0, 6.0, 50.0), fl=4, gf=2.8, fh=2.8, wall='tile_white', roof='flat', par=0.9, win='villa',
         faces={'S': 'street', 'N': 'back', 'E': 'side', 'W': 'side'}, gfk='pilotis', age=0.8,
         extras=[('tank', 0.5, 0.7), ('aircon_wall', 'S', 3)]),
    dict(name='V6', rect=(10.0, 38.0, 26.0, 60.0), fl=4, gf=3.6, fh=2.8, wall='brick_old', roof='flat', par=0.9, awning=2, win='villa',
         faces={'S': 'street', 'N': 'back', 'E': 'side', 'W': 'side'}, gfk='shop', age=1.0,
         extras=[('tank', 0.4, 0.75), ('stairs', 'E'), ('aircon_wall', 'E', 3)]),
    dict(name='V7', rect=(31.0, 46.0, 48.0, 62.5), fl=5, gf=2.9, fh=2.8, wall='brick', roof='flat', par=0.9, win='villa',
         faces={'S': 'street', 'N': 'back', 'E': 'side', 'W': 'side'}, gfk='pilotis', age=1.0,
         extras=[('tank', 0.6, 0.6), ('stairhouse', 0.25, 0.7), ('aircon_wall', 'S', 4), ('pipes', 2)]),
    dict(name='V8', rect=(52.0, 47.0, 64.0, 62.5), fl=3, gf=3.6, fh=3.0, wall='brick_old', roof='flat', par=0.8, win='villa',
         faces={'S': 'side', 'N': 'back', 'E': 'street', 'W': 'side'}, gfk='shop', age=1.1,
         extras=[('tank', 0.5, 0.5), ('aircon_wall', 'E', 2), ('vsign', 'E', 4.0, 1)]),
]

# FaceArch 블록(E1): FaceArch 앞(남서쪽)은 비워 길 건너에서 얼굴이 보이게
E1 = [
    dict(name='E1a', rect=(124.0, -29.0, 158.0, -12.0), fl=4, gf=4.2, fh=3.3, wall='brick_paint', roof='flat', par=0.9, win='shop',
         faces={'S': 'street', 'W': 'street', 'N': 'back', 'E': 'side'}, gfk='mixed', age=0.9,
         extras=[('tank', 0.7, 0.6), ('aircon_wall', 'W', 3), ('pipes', 2), ('vsign', 'S', 5.0, 0)]),
    dict(name='E1b', rect=(76.0, 25.0, 88.0, 35.5), fl=2, gf=4.0, fh=3.4, wall='brick_old', roof='flat', par=0.8, awning=0, win='shop',
         faces={'S': 'street', 'W': 'street', 'N': 'side', 'E': 'side'}, gfk='shop', age=0.8,
         extras=[('canopy', 'S', 0.8, 11.2, 1.8), ('aircon_wall', 'E', 2)]),
    dict(name='E1c', rect=(128.0, -6.0, 158.0, 20.0), fl=3, gf=4.0, fh=3.4, wall='stucco', roof='flat', par=0.8, win='office',
         faces={'S': 'street', 'W': 'street', 'N': 'back', 'E': 'side'}, gfk='door', age=0.7, extras=[('tank', 0.3, 0.6), ('aircon_roof', 2)]),
    dict(name='E1d', rect=(76.0, 38.0, 96.0, 62.0), fl=5, gf=2.9, fh=2.8, wall='brick_old', roof='flat', par=0.9, win='villa',
         faces={'W': 'street', 'S': 'street', 'N': 'back', 'E': 'side'}, gfk='pilotis', age=1.0,
         extras=[('tank', 0.5, 0.7), ('stairhouse', 0.5, 0.25), ('aircon_wall', 'W', 4)]),
    dict(name='E1e', rect=(102.0, 40.0, 126.0, 62.0), fl=4, gf=3.6, fh=2.8, wall='tile', roof='flat', par=0.9, awning=5, win='villa',
         faces={'S': 'street', 'N': 'back', 'E': 'side', 'W': 'side'}, gfk='shop', age=0.8,
         extras=[('tank', 0.6, 0.6), ('aircon_wall', 'S', 3)]),
    dict(name='E1f', rect=(132.0, 30.0, 160.0, 62.0), fl=3, gf=4.2, fh=3.6, wall='brick', roof='gable', ridge='y', pitch=12,
         faces={'W': 'street', 'S': 'side', 'N': 'side', 'E': 'side'}, gfk='shutter', age=1.0, extras=[('pipes', 2)]),
]

# 뚝섬로 남쪽(S): 상가, 9F 복합(결정 1: x +85…+155, y −58…−100)
SOUTH = [
    dict(name='SH1', rect=(-110.0, -72.0, -90.0, -57.5), fl=3, gf=4.2, fh=3.2, wall='tile', roof='flat', par=0.8, awning=1, win='shop',
         faces={'N': 'street', 'E': 'street', 'S': 'back', 'W': 'side'}, gfk='shop', age=0.8,
         extras=[('tank', 0.5, 0.4), ('aircon_wall', 'E', 3), ('vsign', 'N', 15.0, 3), ('billboard', 'N', 10.0, 10.0, 3.4, '대성상회')]),
    dict(name='SH2', rect=(-86.0, -74.0, -66.0, -57.5), fl=4, gf=4.2, fh=3.2, wall='tile', roof='flat', par=0.8, awning=2, win='shop',
         faces={'N': 'street', 'E': 'side', 'S': 'back', 'W': 'side'}, gfk='mixed', age=0.9,
         extras=[('tank', 0.7, 0.4), ('aircon_wall', 'E', 3), ('pipes', 2), ('vsign', 'N', 4.0, 0)]),
    dict(name='SH3', rect=(50.0, -71.0, 80.0, -57.5), fl=2, gf=4.4, fh=3.4, wall='stucco', roof='flat', par=0.8, win='office',
         faces={'N': 'street', 'E': 'side', 'S': 'back', 'W': 'side'}, gfk='shop', age=0.7,
         extras=[('aircon_roof', 3), ('vsign', 'N', 6.0, 1)]),
    dict(name='SH4', rect=(152.0, -71.0, 161.0, -59.0), fl=1, gf=4.5, fh=3.0, wall='corr', trim='steel', roof='gable', ridge='y', pitch=12,
         faces={'N': 'street', 'E': 'side', 'S': 'side', 'W': 'side'}, gfk='shutter', age=0.9, lintel=False, sills=False, extras=[]),
    dict(name='MX', rect=(88.0, -78.0, 150.0, -60.0), fl=9, gf=4.6, fh=3.8, wall='stucco', trim='galv', roof='flat', par=1.2,
         win='office', frame=True, faces={'N': 'street', 'E': 'side', 'S': 'back', 'W': 'street'}, gfk='shop', age=0.5, sills=False,
         lintel=False, extras=[('stairhouse', 0.2, 0.5), ('aircon_roof', 6), ('tank', 0.8, 0.5), ('billboard', 'N', 22.0, 14.0, 4.5, '임대문의')]),
]


def build_region(name, specs, acc, M):
    """블록의 건물들을 정적 묶음(STATIC)에 더한다 — 나중에 재질별 메시로 나뉜다(B5: 조합 수 절약)."""
    for sp in specs:
        building(acc, sp, M)


# ═════════════════════════════ 아파트(판상 12~13F) ═════════════════════════════
APTS = [((-43.5, -80.5), 1.0), ((-3.5, -80.5), 0.97), ((23.5, -126.5), 1.03)]    # (중심, 높이 배율) 33 × 17 m — x −60…+40


def apartment_mesh(M):
    """판상 아파트 1동(로컬 원점 = 바닥 중심, 장축 x). 남면 발코니 유리, 북면(도로 쪽) 복도 띠 + 계단실 2개,
    옥상 승강기탑 박공 장식. 크림 도장 #D9D3B8, 회백 띠 #BFC3C6."""
    acc = Acc()
    MM = dict(M); MM['wall'] = M['apt']; MM['trim'] = M['stucco']
    Lx, Dy = 33.0, 13.0; x0, x1, y0, y1 = -Lx / 2, Lx / 2, -Dy / 2, Dy / 2
    fl = 13; gf = 3.0; fh = 2.8
    H = gf + (fl - 1) * fh; par = 1.2
    fb = [gf + (f - 1) * fh for f in range(1, fl)]
    levels = [0.0] + fb
    # 남면(−y): 세대 4 × (거실 4.4 + 침실 2.4)
    ops = []
    unit = Lx / 4
    for f, vb in enumerate(levels):
        if f == 0:
            continue
        for k in range(4):
            a = k * unit
            ops.append(dict(u0=a + 0.5, u1=a + 4.9, v0=vb + 0.25, v1=vb + 2.35, d=0.9, back='glass', pane=1.1, paneh=2.1, rev='trim', lintel=False))
            ops.append(dict(u0=a + 5.5, u1=a + 7.8, v0=vb + 0.9, v1=vb + 2.3, d=0.3, back='glass', pane=1.15, paneh=1.4, lintel=False))
    vb_ = [(v - 0.05, v + 0.22) for v in fb] + [(H - 0.05, H + par)]
    u = 0.0
    u += wall(acc, (x0, y0), (x1, y0), H + par, ops, MM, u, vbands=vb_, age=0.5, par_top=H + par)
    # 동쪽 끝벽: 작은 창 + 세로 회백 띠
    ops = [dict(u0=1.0, u1=2.1, v0=vb + 1.0, v1=vb + 2.0, d=0.2, back='glass', pane=1.1, paneh=1.0, sill=True) for vb in fb]
    u += wall(acc, (x1, y0), (x1, y1), H + par, ops, MM, u, ubands=[(5.0, 8.0)], age=0.5, par_top=H + par)
    # 북면(+y, 도로 쪽): 복도 띠(계단실 두 곳 빼고)
    cores = [(6.0, 10.0), (23.0, 27.0)]
    ops = []
    for vb in fb:
        segs = [(1.2, cores[0][0] - 0.3), (cores[0][1] + 0.3, cores[1][0] - 0.3), (cores[1][1] + 0.3, Lx - 1.2)]
        for a, bb in segs:
            ops.append(dict(u0=a, u1=bb, v0=vb + 1.05, v1=vb + 2.55, d=1.4, back='trim', rev='trim', lintel=False, streak=True))
    u += wall(acc, (x1, y1), (x0, y1), H + par, ops, MM, u, vbands=vb_, age=0.5, par_top=H + par)
    ops = [dict(u0=10.9, u1=12.0, v0=vb + 1.0, v1=vb + 2.0, d=0.2, back='glass', pane=1.1, paneh=1.0, sill=True) for vb in fb]
    u += wall(acc, (x0, y1), (x0, y0), H + par, ops, MM, u, ubands=[(5.0, 8.0)], age=0.5, par_top=H + par)
    roof_flat(acc, (x0, y0, x1, y1), H, par, MM, 0.5)
    # 계단실(북면 돌출, 옥상까지 + 승강기탑)
    for a, bb in cores:
        cx0, cx1 = x1 - bb, x1 - a          # 북면은 x1 → x0 방향으로 u 가 는다
        sp = dict(rect=(cx0, y1, cx1, y1 + 2.6), fl=1, gf=H + par + 3.0, fh=3.0)
        cops = []
        corner = [(cx0, y1), (cx1, y1), (cx1, y1 + 2.6), (cx0, y1 + 2.6)]
        for k in range(4):
            p, q = corner[k], corner[(k + 1) % 4]
            L = math.dist(p, q)
            if k == 0:
                continue                    # 본동 벽에 붙는 면
            o2 = []
            if k == 2:
                o2 = [dict(u0=L / 2 - 0.35, u1=L / 2 + 0.35, v0=vb + 1.2, v1=vb + 2.4, d=0.15, back='glass', pane=0.7, paneh=1.2)
                      for vb in fb]
            wall(acc, p, q, H + par + 3.0, o2, MM, 0.0, ubands=[], vbands=[(H + par + 2.6, H + par + 3.0)], age=0.5, par_top=H + par + 3.0)
        roof_gable(acc, (cx0 - 0.3, y1 - 2.0, cx1 + 0.3, y1 + 2.9), H + par + 3.0, 'x', 28, MM, ov=0.3, age=0.4,
                   rmat='trim', ends=True)
    return acc.to_mesh('PR_apt')


# ═════════════════════════════ 2호선 고가 ═════════════════════════════
def _za(x, xa, xb):
    t = (x - 0.5 * (xa + xb)) / (0.5 * (xb - xa))
    return VIA_SPRING + (VIA_CROWN - VIA_SPRING) * math.sqrt(max(0.0, 1 - t * t))


def via_span_mesh(M):
    """경간 모듈(로컬 x: 교각 중심 0 … 다음 교각 22, y: 0 … 10 = 고가 폭). 교각 + 아치 + 상판 + 난간·방음벽 + 도상·레일.
    남쪽 상판 테두리(y −0.7, z 7.9) 아래 모서리는 깨끗이 비워 둔다(Task 4 파란 LED 선 자리)."""
    acc = Acc()
    hw = VIA_PIER / 2; xa, xb = hw, VIA_SPAN - hw; W = VIA_Y1 - VIA_Y0
    N = 14
    xs = [xa + (xb - xa) * i / N for i in range(N + 1)]
    zs = [_za(x, xa, xb) for x in xs]

    def pm(p, n):     # 교각: 하단 1 m 오염·이끼(#12), 윗면 이끼
        h = p[2]
        return (0.95 * (1 - smoothstep(0.0, 0.8, h)) + 0.4 * smoothstep(0.6, 0.9, n[2]), 0.3 + 0.6 * (1 - smoothstep(0.0, 1.3, h)),
                1 - 0.55 * (1 - smoothstep(-0.2, 1.1, h)), 0.75 * math.exp(-(DECK_B - h) / 3.0))
    C = M['conc']
    # 교각 옆면(아치 기점 아래), 앞뒤면(전체 높이)
    for sx in (-1, 1):
        x = sx * hw
        acc.poly([(x, 0, -0.3), (x, W, -0.3), (x, W, VIA_SPRING), (x, 0, VIA_SPRING)], [(0, -0.3), (W, -0.3), (W, VIA_SPRING), (0, VIA_SPRING)],
                 C, pm, (sx, 0, 0))
    for yy, sy in ((0.0, -1), (W, 1)):
        # 교각 앞면 + 아치 위 벽(스팬드럴)
        acc.poly([(-hw, yy, -0.3), (hw, yy, -0.3), (hw, yy, DECK_B), (-hw, yy, DECK_B)], [(-hw, -0.3), (hw, -0.3), (hw, DECK_B), (-hw, DECK_B)],
                 C, pm, (0, sy, 0))
        for i in range(N):
            acc.poly([(xs[i], yy, zs[i]), (xs[i + 1], yy, zs[i + 1]), (xs[i + 1], yy, DECK_B), (xs[i], yy, DECK_B)],
                     [(xs[i], zs[i]), (xs[i + 1], zs[i + 1]), (xs[i + 1], DECK_B), (xs[i], DECK_B)], C, pm, (0, sy, 0))
        # 기점 띠(임포스트) 돌출
        acc.box((-hw - 0.12, yy - (0.12 if sy < 0 else 0.0), VIA_SPRING - 0.45), (hw + 0.12, yy + (0.12 if sy > 0 else 0.0), VIA_SPRING),
                M['trim'], (0.5, 0.6, 0.9, 0.0), faces='xXyYzZ'.replace('y' if sy > 0 else 'Y', ''))
    # 아치 밑면(볼트)
    for i in range(N):
        acc.poly([(xs[i], 0, zs[i]), (xs[i + 1], 0, zs[i + 1]), (xs[i + 1], W, zs[i + 1]), (xs[i], W, zs[i])],
                 [(xs[i], 0), (xs[i + 1], 0), (xs[i + 1], W), (xs[i], W)], C, (0.0, 0.4, 0.9, 0.0), (0, 0, -1))
    # 상판: 양쪽 0.7 m 내민 테두리
    x_0, x_1 = -hw, VIA_SPAN - hw
    for yy, sy in ((0.0, -1), (W, 1)):
        ye = yy + sy * 0.7
        acc.poly([(x_0, yy, DECK_B), (x_1, yy, DECK_B), (x_1, ye, DECK_B), (x_0, ye, DECK_B)], [(x_0, 0), (x_1, 0), (x_1, 0.7), (x_0, 0.7)],
                 C, (0.0, 0.4, 0.6, 0.0), (0, 0, -1))
        acc.poly([(x_0, ye, DECK_B), (x_1, ye, DECK_B), (x_1, ye, DECK_T + 1.1), (x_0, ye, DECK_T + 1.1)],
                 [(x_0, DECK_B), (x_1, DECK_B), (x_1, DECK_T + 1.1), (x_0, DECK_T + 1.1)], C,
                 lambda p, n: (0.0, 0.3, 0.95, 0.6 * smoothstep(DECK_B + 0.4, DECK_T + 1.1, p[2])), (0, sy, 0))
        yi = ye - sy * 0.25
        acc.poly([(x_0, ye, DECK_T + 1.1), (x_1, ye, DECK_T + 1.1), (x_1, yi, DECK_T + 1.1), (x_0, yi, DECK_T + 1.1)],
                 [(x_0, 0), (x_1, 0), (x_1, 0.25), (x_0, 0.25)], M['trim'], (0.55, 0.6, 0.95, 0.0), (0, 0, 1))
        acc.poly([(x_0, yi, DECK_T + 0.3), (x_1, yi, DECK_T + 0.3), (x_1, yi, DECK_T + 1.1), (x_0, yi, DECK_T + 1.1)],
                 [(x_0, 0), (x_1, 0), (x_1, 0.8), (x_0, 0.8)], C, (0.3, 0.6, 0.7, 0.0), (0, -sy, 0))
        # 방음벽: 기둥(2.2 m) + 패널(가로 골판)
        for k in range(10):
            px = x_0 + 1.1 + 2.2 * k
            acc.box((px - 0.07, yi - (0.16 if sy > 0 else 0.0), DECK_T + 1.1), (px + 0.07, yi + (0.16 if sy < 0 else 0.0), DECK_T + 2.9),
                    M['galv'], (0.0, 0.4, 0.9, 0.0), faces='xXyYZ')
        yp = yi - sy * 0.06
        acc.poly([(x_0, yp, DECK_T + 1.1), (x_1, yp, DECK_T + 1.1), (x_1, yp, DECK_T + 2.8), (x_0, yp, DECK_T + 2.8)],
                 [(x_0, 0), (x_1, 0), (x_1, 1.7), (x_0, 1.7)], M['ribbed'], (0.0, 0.35, 0.95, 0.4), (0, sy, 0))
        acc.poly([(x_0, yp, DECK_T + 1.1), (x_1, yp, DECK_T + 1.1), (x_1, yp, DECK_T + 2.8), (x_0, yp, DECK_T + 2.8)],
                 [(x_0, 0), (x_1, 0), (x_1, 1.7), (x_0, 1.7)], M['ribbed'], (0.0, 0.35, 0.8, 0.2), (0, -sy, 0))
    # 도상(자갈) + 레일 4줄
    yi0, yi1 = -0.7 + 0.25, W + 0.7 - 0.25
    acc.poly([(x_0, yi0, DECK_T + 0.3), (x_1, yi0, DECK_T + 0.3), (x_1, yi1, DECK_T + 0.3), (x_0, yi1, DECK_T + 0.3)],
             [(x_0, yi0), (x_1, yi0), (x_1, yi1), (x_0, yi1)], M['basalt'], (0.2, 0.55, 0.8, 0.0), (0, 0, 1))
    for yc in (2.7, 7.3):
        for s in (-0.75, 0.75):
            acc.box((x_0, yc + s - 0.04, DECK_T + 0.3), (x_1, yc + s + 0.04, DECK_T + 0.48), M['steel'], (0.0, 0.3, 0.9, 0.0), faces='yYZ')
    return acc.to_mesh('PR_via_span')


def via_infill_mesh(M):
    """아치 안 벽돌 충전벽(남·북 두 면, 기점 아래 사각 + 아치까지 채움). 남면에 셔터 2 + 문 1(고가 하부 창고)."""
    acc = Acc()
    hw = VIA_PIER / 2; xa, xb = hw, VIA_SPAN - hw; W = VIA_Y1 - VIA_Y0
    MM = dict(M); MM['wall'] = M['brick_old']
    N = 14
    xs = [xa + (xb - xa) * i / N for i in range(N + 1)]; zs = [_za(x, xa, xb) for x in xs]
    n0 = len(INST)
    for yy, front in ((0.45, True), (W - 0.45, False)):
        a, b = ((xa, yy), (xb, yy)) if not front else ((xa, yy), (xb, yy))
        L = xb - xa
        ops = []
        if front:
            ops = [dict(u0=3.0, u1=6.4, v0=0.0, v1=3.0, d=0.36, back='dark', streak=False, lintel=False, inst=('shutter', 1.08, 2.4, 0.33)),
                   dict(u0=8.9, u1=10.2, v0=0.0, v1=2.3, d=0.2, back='steel', streak=False, lintel=False),
                   dict(u0=13.2, u1=16.6, v0=0.0, v1=3.0, d=0.36, back='dark', streak=False, lintel=False, inst=('shutter', 1.08, 2.4, 0.33)),
                   dict(u0=8.0, u1=11.6, v0=3.6, v1=4.6, d=0.2, back='glass', pane=1.2, paneh=1.0, sill=True)]
        # 남면은 바깥 = −y → 진행 방향 +x 이면 오른쪽 = −y ✓. 북면은 바깥 = +y → b → a 방향으로
        if front:
            wall(acc, (xa, yy), (xb, yy), VIA_SPRING, ops, MM, 0.0, age=1.2, par_top=None)
            nrm = (0, -1, 0)
        else:
            wall(acc, (xb, yy), (xa, yy), VIA_SPRING, ops, MM, 0.0, age=1.2, par_top=None)
            nrm = (0, 1, 0)
        for i in range(N):
            acc.poly([(xs[i], yy, VIA_SPRING), (xs[i + 1], yy, VIA_SPRING), (xs[i + 1], yy, zs[i + 1]), (xs[i], yy, zs[i])],
                     [(xs[i], VIA_SPRING), (xs[i + 1], VIA_SPRING), (xs[i + 1], zs[i + 1]), (xs[i], zs[i])], MM['wall'],
                     (0.0, 0.3, 0.85, 0.2), nrm)
    # 위 INST 의 셔터 위치는 로컬 좌표 → via 배치 때 변환한다(여기서 꺼내 둔다)
    loc_inst = INST[n0:]
    del INST[n0:]
    return acc.to_mesh('PR_via_infill'), loc_inst


def via_station(M, acc):
    """성수역형 승강장: 3경간 상판 양쪽 3.6 m 승강장 + 녹색 곡면 지붕(기둥 11 m 간격). 고가 하부 가로 위로 내민다."""
    xa, xb = STATION[0] - 1.2, STATION[1] + 1.2
    W = VIA_Y1 - VIA_Y0
    pw = 3.6; zf = DECK_T + 1.0; zs = DECK_B - 0.45
    for y_in, y_out in ((VIA_Y0 - 0.7, VIA_Y0 - 0.7 - pw), (VIA_Y1 + 0.7, VIA_Y1 + 0.7 + pw)):
        sy = 1 if y_out > y_in else -1
        lo, hi = min(y_in, y_out), max(y_in, y_out)
        acc.poly([(xa, lo, zf), (xb, lo, zf), (xb, hi, zf), (xa, hi, zf)], [(xa, lo), (xb, lo), (xb, hi), (xa, hi)], M['trim'],
                 (0.15, 0.5, 0.9, 0.0), (0, 0, 1))
        acc.poly([(xa, lo, zs), (xb, lo, zs), (xb, hi, zs), (xa, hi, zs)], [(xa, lo), (xb, lo), (xb, hi), (xa, hi)], M['conc'],
                 (0.0, 0.35, 0.45, 0.0), (0, 0, -1))
        acc.poly([(xa, y_out, zs), (xb, y_out, zs), (xb, y_out, zf), (xa, y_out, zf)], [(xa, zs), (xb, zs), (xb, zf), (xa, zf)], M['green'],
                 lambda p, n: (0.0, 0.3, 0.95, 0.5 * smoothstep(zs, zf, p[2])), (0, sy, 0))
        for x in (xa, xb):
            acc.poly([(x, lo, zs), (x, hi, zs), (x, hi, zf), (x, lo, zf)], [(lo, zs), (hi, zs), (hi, zf), (lo, zf)], M['conc'],
                     (0.0, 0.4, 0.8, 0.0), (-1 if x == xa else 1, 0, 0))
        # 승강장 바깥 난간 + 지붕 기둥
        yr = y_out - sy * 0.1
        acc.cyl((xa, yr, zf + 1.1), (xb, yr, zf + 1.1), 0.04, 0.04, 4, M['galv'], (0, 0.4, 0.9, 0))
        for k in range(int((xb - xa) / 2.0) + 1):
            px = xa + 2.0 * k
            acc.cyl((px, yr, zf), (px, yr, zf + 1.1), 0.025, 0.025, 4, M['galv'], (0, 0.4, 0.9, 0))
        for k in range(7):
            px = xa + 1.0 + (xb - xa - 2.0) * k / 6
            acc.box((px - 0.15, yr - sy * 0.6 - 0.15, zf), (px + 0.15, yr - sy * 0.6 + 0.15, zf + 4.2), M['galv'], (0, 0.35, 0.9, 0.2),
                    faces='xXyY')
    # 녹색 곡면 지붕(양쪽 승강장과 선로 위 한 덩어리)
    ya, yb = VIA_Y0 - 0.7 - pw - 0.6, VIA_Y1 + 0.7 + pw + 0.6
    ze, zc = zf + 4.0, zf + 6.4
    NS = 12
    ptsy = [ya + (yb - ya) * i / NS for i in range(NS + 1)]
    zz = [ze + (zc - ze) * (1 - ((y - 0.5 * (ya + yb)) / (0.5 * (yb - ya))) ** 2) for y in ptsy]
    for i in range(NS):
        for top in (True, False):
            dz = 0.0 if top else -0.25
            p = [(xa - 1.0, ptsy[i], zz[i] + dz), (xb + 1.0, ptsy[i], zz[i] + dz), (xb + 1.0, ptsy[i + 1], zz[i + 1] + dz),
                 (xa - 1.0, ptsy[i + 1], zz[i + 1] + dz)]
            acc.poly(p, [(xa, ptsy[i]), (xb, ptsy[i]), (xb, ptsy[i + 1]), (xa, ptsy[i + 1])], M['green'] if top else M['galv'],
                     (0.25 if top else 0.0, 0.5, 0.95 if top else 0.6, 0.0), (0, 0, 1) if top else (0, 0, -1))
    for x, sx in ((xa - 1.0, -1), (xb + 1.0, 1)):
        for i in range(NS):
            acc.poly([(x, ptsy[i], zz[i] - 0.25), (x, ptsy[i + 1], zz[i + 1] - 0.25), (x, ptsy[i + 1], zz[i + 1]), (x, ptsy[i], zz[i])],
                     [(0, 0), (1, 0), (1, 0.25), (0, 0.25)], M['green'], (0, 0.4, 0.9, 0), (sx, 0, 0))
    # 승강장 아래 받침 브래킷(교각마다)
    for px in (STATION[0], STATION[0] + VIA_SPAN, STATION[0] + 2 * VIA_SPAN, STATION[1]):
        for y_in, y_out in ((VIA_Y0 - 0.7, VIA_Y0 - 0.7 - pw), (VIA_Y1 + 0.7, VIA_Y1 + 0.7 + pw)):
            lo, hi = min(y_in, y_out), max(y_in, y_out)
            acc.box((px - 0.4, lo + 0.2, zs - 1.2), (px + 0.4, hi - 0.2, zs), M['conc'], (0, 0.35, 0.55, 0.3), faces='xXyYz')
    return acc


def build_viaduct(c, M):
    span = via_span_mesh(M)
    infill, sh_local = via_infill_mesh(M)
    k = 0
    for x in VIA_PIERS:
        place(f'PR_via.{k:03d}', span, c, (x, VIA_Y0, 0.0), surface='wall')
        k += 1
    # 충전벽: 승강장 아래와 카메라 아치(2…24)는 비워 통로로
    j = 0
    for x in VIA_PIERS[:-1]:
        x_mid = x + VIA_SPAN / 2
        if STATION[0] < x_mid < STATION[1] or 2.0 < x_mid < 24.0 or x_mid > 150:
            continue
        place(f'PR_via_infill.{j:03d}', infill, c, (x, VIA_Y0, 0.0), surface='wall')
        for key, loc, rz, s in sh_local:
            INST.append((key, (loc[0] + x, loc[1] + VIA_Y0, loc[2]), rz, s))
        j += 1
    via_station(M, STATIC)
    # LED 자리(Task 4): 남쪽 상판 테두리 아래 모서리
    return span


# ═════════════════════════════ 전신주 · 전선 ═════════════════════════════
POLE_H = 12.0
# 전주 줄(장면 좌표): 뒷골목 y 70 양쪽 보도·동쪽 골목 x 70·서쪽 이면도로 x −105·고가 하부 가로 남측·뚝섬로 남측 보도 뒤
RUNS = {
    'N': [(-101.6, 74.7), (-61.0, 73.6), (-22.0, 73.6), (17.0, 73.6), (56.0, 73.6), (65.6, 74.4), (76.6, 73.6), (115.0, 73.6), (154.0, 73.6)],
    'E': [(66.5, -29.0), (66.5, 10.0), (66.5, 49.0), (65.6, 74.4), (66.5, 103.0), (66.3, 137.6)],
    'W': [(-101.5, -28.0), (-101.5, 11.0), (-101.5, 50.0), (-101.6, 74.7), (-101.5, 104.0), (-101.4, 137.6)],
    'V': [(-101.4, 137.6), (-62.0, 137.7), (-23.0, 137.7), (4.5, 137.7), (43.5, 137.7), (66.3, 137.6), (77.0, 137.7), (116.0, 137.7),
          (155.0, 137.7)],
    'S': [(-100.0, -55.4), (-61.0, -55.4), (-22.0, -55.4), (17.0, -55.4), (56.0, -55.4)],
}
# 전선 고정점(로컬: 완목은 x 방향, 선로는 y 방향): (x, z, 처짐 m, 반지름 m, 단)
WIRE_PTS = [(-0.85, 11.45, 0.42, 0.011, 'hv'), (0.0, 11.62, 0.38, 0.011, 'hv'), (0.85, 11.45, 0.45, 0.011, 'hv'),
            (-0.6, 10.55, 0.62, 0.014, 'lv'), (0.6, 10.55, 0.66, 0.014, 'lv'),
            (0.24, 7.05, 1.05, 0.042, 'tel'), (0.27, 6.55, 1.3, 0.03, 'tel'), (-0.24, 6.8, 1.2, 0.034, 'tel')]


def pole_mesh(M):
    """한국형 콘크리트 전주 12 m: 10각 테이퍼 + 완목 2단 + 애자 + 통신 밴드 + 황흑 보호대(0~1.8 m)."""
    acc = Acc()

    def mk(p, n):
        h = p[2]
        return (0.6 * (1 - smoothstep(0.0, 0.5, h)), 0.3 + 0.55 * (1 - smoothstep(0.0, 1.0, h)), 1 - 0.45 * (1 - smoothstep(0, 1, h)),
                0.4 * smoothstep(9.0, 12.0, h))
    acc.cyl((0, 0, -0.3), (0, 0, POLE_H), 0.19, 0.12, 10, M['conc'], mk, caps=(False, True))
    acc.cyl((0, 0, 0.0), (0, 0, 1.8), 0.205, 0.198, 10, M['hazard'], (0.0, 0.5, 0.85, 0.0), caps=(False, True), uv_v=1 / 0.6)
    for z, L in ((11.4, 2.1), (10.5, 1.6)):
        acc.box((-L / 2, -0.06, z - 0.07), (L / 2, 0.06, z + 0.03), M['galv'], (0.0, 0.4, 0.9, 0.1))
        acc.cyl((-L / 2 + 0.2, 0, z - 0.05), (0, 0, z - 0.7), 0.018, 0.018, 4, M['galv'], (0, 0.4, 0.9, 0))
    for x, z, *_ in WIRE_PTS[:5]:
        acc.cyl((x, 0, z - 0.12), (x, 0, z + 0.05), 0.05, 0.035, 6, M['white'], (0.0, 0.3, 1.0, 0.0))
    for z in (7.05, 6.55, 6.8):
        acc.cyl((0, 0, z - 0.05), (0, 0, z + 0.05), 0.2, 0.2, 10, M['steel'], (0, 0.4, 0.9, 0), caps=(True, True))
    # 발판 볼트(작은 막대)
    for k in range(10):
        z = 2.6 + 0.45 * k
        a = (k % 2) * math.pi
        acc.cyl((0.15 * math.cos(a), 0.15 * math.sin(a), z), (0.32 * math.cos(a), 0.32 * math.sin(a), z), 0.012, 0.012, 4, M['galv'], (0, 0.4, 0.9, 0),
                caps=(False, False))
    return acc.to_mesh('PR_pole', weld=True, smooth=True, sharp=50)


def transformer_mesh(M):
    acc = Acc()
    mk = (0.0, 0.4, 0.9, 0.35)
    acc.cyl((0.55, 0, 8.4), (0.55, 0, 9.5), 0.3, 0.3, 12, M['galv'], mk)
    acc.cyl((0.55, 0, 9.5), (0.55, 0, 9.58), 0.33, 0.25, 12, M['galv'], mk)
    acc.box((0.12, -0.08, 8.6), (0.26, 0.08, 9.35), M['steel'], mk)
    for dx in (-0.12, 0.12):
        acc.cyl((0.55 + dx, 0, 9.58), (0.55 + dx, 0, 9.85), 0.04, 0.03, 6, M['white'], mk)
    return acc.to_mesh('PR_transformer', weld=True, smooth=True, sharp=45)


def catenary(a, b, sag, n=14):
    return [Vector(a).lerp(Vector(b), i / n) - Vector((0, 0, 4 * sag * (i / n) * (1 - i / n))) for i in range(n + 1)]


def tube(acc, pts, r, mat, sides=3):
    """폴리라인을 따라가는 가는 관(전선). 고리마다 진행 방향에 수직인 삼각형 단면."""
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


def pole_frames():
    """전주 위치마다 완목 방향(선로 진행 방향에 수직)을 정한다. 반환: {(x, y): (각도, 높이 z0)}."""
    gz = GZ
    poles = {}
    for run, pts in RUNS.items():
        for i, p in enumerate(pts):
            q0 = pts[max(0, i - 1)]; q1 = pts[min(len(pts) - 1, i + 1)]
            ang = math.atan2(q1[1] - q0[1], q1[0] - q0[0])      # 선로 방향
            key = (round(p[0], 2), round(p[1], 2))
            if key not in poles:
                poles[key] = (ang - math.pi / 2, gz.z(p[0], p[1], 0.0))
    return poles


def attach(pole, k):
    (x, y), (rz, z0) = pole
    lx, lz = WIRE_PTS[k][0], WIRE_PTS[k][1]
    return Vector((x + math.cos(rz) * lx, y + math.sin(rz) * lx, z0 + lz))


def build_wires(c, M, poles, drops):
    """전주 사이 2~3단 처진 전선(고압 3·저압 2·통신 다발 3) + 다발 옆 가는 선 + 예비 케이블 고리 + 인입선."""
    acc = Acc()
    rnd = random.Random(70)
    pk = {k: v for k, v in poles.items()}
    for run, pts in RUNS.items():
        for i in range(len(pts) - 1):
            A = ((round(pts[i][0], 2), round(pts[i][1], 2)), pk[(round(pts[i][0], 2), round(pts[i][1], 2))])
            B = ((round(pts[i + 1][0], 2), round(pts[i + 1][1], 2)), pk[(round(pts[i + 1][0], 2), round(pts[i + 1][1], 2))])
            span = math.dist(A[0], B[0])
            for k, (lx, lz, sag, r, tier) in enumerate(WIRE_PTS):
                if run == 'S' and tier == 'hv' and k == 1:
                    continue
                a = attach(A, k); b = attach(B, k)
                s = sag * (span / 40.0) ** 2 * rnd.uniform(0.85, 1.2)
                tube(acc, catenary(a, b, s), r, M['wire'])
                if tier == 'tel' and rnd.random() < 0.7:
                    # 다발에 붙은 가는 선(조금 다르게 처짐)
                    off = Vector((rnd.uniform(-0.08, 0.08), rnd.uniform(-0.08, 0.08), rnd.uniform(-0.1, 0.05)))
                    tube(acc, catenary(a + off, b + off, s * rnd.uniform(1.05, 1.3)), 0.012, M['wire'])
    # 예비 케이블 고리(전주에 감아 둔 통신선 — 성수 골목 사진의 흔한 모습)
    for j, (key, (rz, z0)) in enumerate(pk.items()):
        if j % 3:
            continue
        side = Vector((math.cos(rz), math.sin(rz), 0)); along = Vector((-math.sin(rz), math.cos(rz), 0))
        ctr = Vector((key[0], key[1], z0 + 5.5)) + side * 0.24
        ring = [ctr + along * 0.36 * math.cos(2 * math.pi * k / 12) + Vector((0, 0, 0.36 * math.sin(2 * math.pi * k / 12))) for k in range(13)]
        tube(acc, ring, 0.03, M['wire'])
    # 인입선(전주 → 건물 벽)
    for a, b in drops:
        tube(acc, catenary(a, b, 0.25 + 0.01 * math.dist(a, b), 10), 0.009, M['wire'])
    return acc.to_obj('PR_wires', c, 'metal', weld=True, smooth=True, sharp=80)


def service_drops(poles, rects):
    """전주마다 가까운 건물(18 m 안) 1~2동에 인입선: 통신 고정점 → 건물 외곽의 가장 가까운 점, 높이 5.5~7 m."""
    rnd = random.Random(12)
    out = []
    for key, (rz, z0) in poles.items():
        cands = []
        for (x0, y0, x1, y1, h) in rects:
            qx = min(max(key[0], x0), x1); qy = min(max(key[1], y0), y1)
            d = math.dist(key, (qx, qy))
            if 3.0 < d < 18.0:
                cands.append((d, (qx, qy, min(h - 0.8, rnd.uniform(5.5, 7.0)))))
        cands.sort()
        for d, q in cands[:rnd.choice((1, 2))]:
            a = attach((key, (rz, z0)), 5)
            out.append((a, Vector(q)))
    return out


# ═════════════════════════════ 가로등 · 신호기둥 · 볼라드 · 물탱크 · 오토바이 · 간판 ═════════════════════════════
def streetlight_mesh(M):
    """한국형 단주 가로등 9 m: 테이퍼 기둥 + 굽은 팔 + 코브라헤드(옛 등: 따뜻한 흰빛 — 밤은 Task 4)."""
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


def signal_mesh(M):
    """신호기둥 + 가로 팔(6 m) + 4색 가로형 신호등 + 보행 신호등."""
    acc = Acc()
    mk = (0.0, 0.4, 0.9, 0.2)
    acc.cyl((0, 0, -0.2), (0, 0, 6.6), 0.15, 0.12, 10, M['galv'], mk)
    acc.cyl((0, 0, 6.2), (6.2, 0, 6.35), 0.08, 0.06, 8, M['galv'], mk)
    acc.cyl((0, 0, 5.4), (2.2, 0, 6.2), 0.03, 0.03, 4, M['galv'], mk)
    acc.box((4.6, -0.17, 5.75), (6.0, 0.17, 6.15), M['steel'], mk)
    for k in range(4):
        acc.cyl((4.8 + 0.34 * k, -0.18, 5.95), (4.8 + 0.34 * k, -0.24, 5.95), 0.11, 0.11, 10, M['steel'], mk, caps=(False, True))
    acc.box((-0.22, -0.4, 2.4), (0.22, -0.14, 3.3), M['steel'], mk)
    return acc.to_mesh('PR_signal', weld=True, smooth=True, sharp=40)


def bollard_mesh(M):
    acc = Acc()
    acc.cyl((0, 0, -0.1), (0, 0, 0.82), 0.07, 0.07, 10, M['galv'], lambda p, n: (0.0, 0.3 + 0.5 * (1 - smoothstep(0, 0.4, p[2])), 1 - 0.3 * (1 - smoothstep(0, 0.4, p[2])), 0.0))
    acc.cyl((0, 0, 0.82), (0, 0, 0.87), 0.07, 0.03, 10, M['galv'], (0, 0.3, 1, 0))
    acc.cyl((0, 0, 0.62), (0, 0, 0.67), 0.072, 0.072, 10, M['hazard'], (0, 0.3, 1, 0), caps=(False, False))
    return acc.to_mesh('PR_bollard', weld=True, smooth=True, sharp=50)


def tank_mesh(M):
    """옥상 물탱크(FRP 원통) + 철제 받침."""
    acc = Acc()
    acc.cyl((0, 0, 0.6), (0, 0, 2.2), 0.85, 0.85, 14, M['white'], (0.05, 0.45, 0.9, 0.5))
    acc.cyl((0, 0, 2.2), (0, 0, 2.45), 0.85, 0.3, 14, M['white'], (0.3, 0.5, 0.95, 0.0))
    for sx in (-0.6, 0.6):
        for sy in (-0.6, 0.6):
            acc.box((sx - 0.04, sy - 0.04, 0.0), (sx + 0.04, sy + 0.04, 0.62), M['steel'], (0.1, 0.5, 0.8, 0.0), faces='xXyY')
    acc.box((-0.75, -0.75, 0.55), (0.75, 0.75, 0.62), M['steel'], (0.1, 0.5, 0.8, 0.0))
    return acc.to_mesh('PR_tank', weld=True, smooth=True, sharp=50)


def scooter_mesh(M):
    """배달 오토바이(저폴리 실루엣): 바퀴 2 + 차체 + 핸들 + 빨간 배달통(작은 고채도 포인트, #12)."""
    acc = Acc()
    mk = (0.0, 0.4, 0.9, 0.0)
    for x in (-0.62, 0.62):
        acc.cyl((x, -0.05, 0.27), (x, 0.05, 0.27), 0.27, 0.27, 12, M['steel'], mk)
    acc.box((-0.55, -0.16, 0.3), (0.5, 0.16, 0.55), M['steel'], mk)
    acc.box((-0.6, -0.17, 0.55), (0.05, 0.17, 0.78), M['white'], mk)
    acc.cyl((0.55, 0, 0.35), (0.42, 0, 1.0), 0.04, 0.04, 6, M['galv'], mk)
    acc.cyl((0.42, -0.35, 1.0), (0.42, 0.35, 1.0), 0.02, 0.02, 6, M['galv'], mk)
    acc.box((-0.82, -0.25, 0.8), (-0.32, 0.25, 1.25), M['red'], (0.0, 0.35, 0.95, 0.2))
    return acc.to_mesh('PR_scooter', weld=True, smooth=True, sharp=35)


def pot_mesh(M):
    acc = Acc()
    acc.cyl((0, 0, 0), (0, 0, 0.62), 0.32, 0.38, 12, M['trim'], lambda p, n: (0.25 * (1 - smoothstep(0, 0.2, p[2])), 0.45, 0.85, 0.3))
    acc.poly([(0.36 * math.cos(2 * math.pi * k / 12), 0.36 * math.sin(2 * math.pi * k / 12), 0.56) for k in range(12)], [(0, 0)] * 12,
             M['dark'], (0.2, 0.6, 0.7, 0.0), (0, 0, 1))          # 흙(지면 NW_lot 재질을 끌어오지 않게 단색)
    return acc.to_mesh('PR_pot', weld=True, smooth=True, sharp=50)


def bench_mesh(M):
    acc = Acc()
    mk = lambda p, n: (0.4 * smoothstep(0.6, 0.9, n[2]), 0.35 + 0.45 * (1 - smoothstep(0.0, 0.3, p[2])), 1 - 0.4 * (1 - smoothstep(0, 0.3, p[2])), 0.0)
    acc.box((-0.9, -0.3, -0.05), (0.9, 0.3, 0.44), M['trim'], mk)
    return acc.to_mesh('PR_bench')


# ═════════════════════════════ 자연 포켓(빈터) ═════════════════════════════
def _basalt_column(acc, cx, cy, sides, r, h, rnd, M, tilt=0.12, lean=(0.0, 0.0)):
    """주상절리 기둥 하나: 아래(묻힘) → 위로 약간 가늘어지고, 윗면은 기울어 깨지고 가장자리는 모따기."""
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
    """현무암 블록(주상절리, 직접 모델링). cols: [(x, y, 변 수, 반지름, 높이)] — 여러 기둥을 한 덩어리로(대형 조경석)."""
    rnd = random.Random(seed)
    acc = Acc()
    lean = (rnd.uniform(-0.06, 0.06), rnd.uniform(-0.06, 0.06))
    for x, y, sides, r, h in cols:
        _basalt_column(acc, x, y, sides, r, h, rnd, M, lean=lean)
    me = acc.to_mesh(name)
    lib.box_uv(me, 1.0)
    return me


def weed_mesh(name, M, u0, u1, hgt=0.75, n=3):
    """잡초 다발: 교차 카드 n 장(아틀라스 u0..u1). 로컬 바닥 = 0."""
    acc = Acc()
    w = hgt * 1.0
    for k in range(n):
        a = math.pi * k / n + 0.2 * k
        e = Vector((math.cos(a), math.sin(a), 0)) * w / 2
        acc.poly([tuple(-e), tuple(e), tuple(e + Vector((0, 0, hgt))), tuple(-e + Vector((0, 0, hgt)))], [(u0, 0), (u1, 0), (u1, 1), (u0, 1)],
                 M['weeds'], [(0.0, 0.4, 0.8, 0), (0.0, 0.4, 0.8, 0), (0.0, 0.2, 1.0, 0), (0.0, 0.2, 1.0, 0)])
    return acc.to_mesh(name)


def chunk_proto(name, seed, flat, M):
    V, F, h = ground.chunk_mesh(seed, flat)
    acc = Acc()

    def mk(p, n):
        topf = smoothstep(0.5, 0.9, n[2]) * smoothstep(0.4 * h, 0.85 * h, p[2])
        low = 1 - smoothstep(0.0, 0.35 * h, p[2])
        return (0.85 * topf + 0.3 * low, 0.45 + 0.5 * low, 1 - 0.5 * low, 0.0)
    acc.mesh(Matrix.Identity(4), V, F, M['basalt'], mk)
    me = acc.to_mesh(name)
    lib.box_uv(me, 1.0)
    return me, h


def hoarding_mesh(name, M, u0, u1):
    """가림막 패널 1.5 × 2.4 m(두께 4 cm) + 뒤 버팀 각관. 로컬: x 폭, y 두께(앞면 −y), z 높이. 아틀라스 u0..u1."""
    acc = Acc()
    w, h, t = 0.76, 2.4, 0.02
    mk = lambda p, n: (0.0, 0.3 + 0.55 * (1 - smoothstep(0, 0.5, p[2])), 1 - 0.45 * (1 - smoothstep(0, 0.6, p[2])), 0.6 * smoothstep(1.6, 2.4, p[2]))
    acc.poly([(-w, -t, 0), (w, -t, 0), (w, -t, h), (-w, -t, h)], [(u0, 0), (u1, 0), (u1, 1), (u0, 1)], M['hoard'], mk, (0, -1, 0))
    acc.poly([(-w, t, 0), (w, t, 0), (w, t, h), (-w, t, h)], [(u1, 0), (u0, 0), (u0, 1), (u1, 1)], M['hoard'], mk, (0, 1, 0))
    acc.box((-w, -t, h), (w, t, h + 0.03), M['galv'], (0.2, 0.5, 0.9, 0.0), faces='Z')
    acc.cyl((w - 0.03, 0.04, 0.0), (w - 0.03, 0.04, h), 0.03, 0.03, 4, M['galv'], (0.0, 0.4, 0.85, 0.0))
    acc.cyl((w - 0.03, 0.06, h * 0.7), (w - 0.03, 1.1, 0.0), 0.022, 0.022, 4, M['galv'], (0.0, 0.4, 0.85, 0.0))
    return acc.to_mesh(name)


def build_lot_pocket(c, M, P, gz):
    """철거 후 방치된 빈터(x +28…+66, y −22…+40): 가림막(일부 기울고 쓰러짐), 바위 3단 스케일, 이끼, 잡초·마른 풀."""
    rnd = random.Random(2041)
    lx0, ly0, lx1, ly1 = G.LOT
    # ── 가림막: 지면 태스크가 놓은 기초 블록(GR_footing.*) 위에 하나씩
    hw = hoarding_mesh('PR_lot_hoarding_w', M, 0.0, 0.5)
    hg = hoarding_mesh('PR_lot_hoarding_g', M, 0.5, 1.0)
    feet = sorted([o for o in bpy.data.objects if o.name.startswith('GR_footing.')], key=lambda o: o.name)
    k = 0
    for fi, o in enumerate(feet):
        x, y, z = o.location; rz = o.rotation_euler.z
        cx, cy = (lx0 + lx1) / 2, (ly0 + ly1) / 2
        # 앞면(−y 로컬)이 빈터 바깥을 보게: 로컬 −y 가 (바깥) 방향
        out = Vector((x - cx, y - cy, 0))
        if abs(x - lx0) < 0.5 or abs(x - lx1) < 0.5:
            out = Vector((1 if x > cx else -1, 0, 0))
        else:
            out = Vector((0, 1 if y > cy else -1, 0))
        ang = math.atan2(out.x, -out.y)            # 로컬 −y → out
        me = hg if h01(fi, 3) < 0.35 else hw          # 기초 블록 번호로 고른다(빠진 패널이 뒤 패널에 번지지 않게)
        lean = 0.0
        r = h01(fi, 5)
        if r < 0.12:
            lean = rnd.uniform(0.08, 0.22)             # 바깥으로 기울어짐
        elif r < 0.18:
            lean = -rnd.uniform(0.06, 0.15)
        if r > 0.985:
            continue                                   # 빠진 패널
        place(f'PR_lot_hoarding.{k:03d}', me, c, (x, y, z + 0.36), ang, 1.0, rx=lean, surface='metal')
        k += 1
    # 서쪽 빠진 구간(y 8…15.5)의 쓰러진 패널 — 잡석 위에 누움
    for i, (yy, rot) in enumerate(((9.2, 0.15), (11.0, -0.1), (13.4, 0.3))):
        x = lx0 + 1.6 + 0.4 * i
        place(f'PR_lot_hoarding_fallen.{i}', hw if i != 1 else hg, c, (x, yy, gz.z(x, yy) + 0.08), -math.pi / 2 + rot, 1.0,
              rx=-(math.pi / 2 - 0.06 - 0.04 * i), surface='metal')
    # 공사 문: 한 짝은 열어 젖힌 상태(4 m 패널 = 1.5 m 패널 × 배율)
    place('PR_lot_gate.0', hw, c, (40.9, ly0 - 0.2, 0.0), math.radians(-62), (2.6, 1.0, 1.0), surface='metal')
    # ── 바위 3단 스케일(#6): 대형 1(현무암 조경석) : 중형 5~8 : 소형 다수, 군집
    big = basalt_mesh('PR_lot_basalt_big', 7, [(0.0, 0.0, 6, 0.62, 2.3), (1.05, 0.25, 6, 0.55, 1.75), (0.45, -0.95, 5, 0.58, 1.4),
                                                (-0.95, -0.4, 6, 0.5, 1.95), (-0.5, 0.85, 5, 0.52, 1.15), (0.9, -0.95, 6, 0.42, 0.8)], M)
    meds = [basalt_mesh(f'PR_lot_basalt_m{i}', 20 + i, cols, M) for i, cols in enumerate((
        [(0, 0, 6, 0.42, 0.95)], [(0, 0, 5, 0.5, 0.65), (0.62, 0.2, 6, 0.36, 0.9)], [(0, 0, 6, 0.36, 1.2)],
        [(0, 0, 7, 0.55, 0.5), (-0.5, 0.45, 5, 0.3, 0.7)]))]
    smalls = [chunk_proto(f'PR_lot_basalt_s{i}', 300 + i, (0.55, 0.8, 0.4)[i], M) for i in range(3)]
    phm = [P['rock_a'], P['rock_b'], P['rock_c'], P['rock_d'], P['rock_e'], P['boulder']]
    pools = [((x, y), r) for (x, y), r in G.POOLS]

    def free(x, y, rr):
        if not (lx0 + 1.0 < x < lx1 - 1.0 and ly0 + 1.0 < y < ly1 - 1.0):
            return False
        return all(math.hypot(x - px, y - py) > pr + rr for (px, py), pr in pools)
    clusters = [  # (중심, 대형?, 중형 수, 소형 수, 반경)
        ((49.5, 4.0), True, 7, 34, 4.2),
        ((58.0, 23.5), False, 6, 26, 3.4),
        ((33.5, 22.0), False, 5, 22, 3.0),
        ((40.0, -14.5), False, 6, 30, 3.0),   # 공사 문 앞(CAM_lot 근경)
        ((60.5, -15.0), False, 5, 18, 2.8),
        ((44.0, 33.5), False, 5, 20, 3.0),
    ]
    j = 0
    for (cx, cy), has_big, nm, ns, rad in clusters:
        if has_big:
            z = gz.z(cx, cy)
            place('PR_lot_basalt_big.0', big, c, (cx, cy, z - 0.1), 0.6, 1.0, rx=0.1, ry=-0.06, surface='rock')
        placed = 0; tries = 0
        while placed < nm and tries < 200:
            tries += 1
            a = rnd.uniform(0, 2 * math.pi); d = rad * math.sqrt(rnd.uniform(0.15, 1.0)) * (1.25 if has_big else 1.0)
            x, y = cx + d * math.cos(a), cy + d * math.sin(a)
            if not free(x, y, 0.6) or (has_big and math.hypot(x - cx, y - cy) < 2.0):
                continue
            if rnd.random() < 0.55:
                me = meds[rnd.randrange(len(meds))]; s = rnd.uniform(0.75, 1.3); sink = 0.12
                surf = 'rock'
            else:
                me = phm[rnd.randrange(len(phm))]; s = rnd.uniform(0.45, 0.8); sink = 0.18
                surf = 'rock'
            place(f'PR_lot_rock.{j:03d}', me, c, (x, y, gz.z(x, y) - sink * s), rnd.uniform(0, 6.3), s,
                  rx=rnd.uniform(-0.12, 0.12), ry=rnd.uniform(-0.12, 0.12), surface=surf)
            j += 1; placed += 1
        for i in range(ns):
            a = rnd.uniform(0, 2 * math.pi); d = rad * 1.4 * math.sqrt(rnd.random())
            x, y = cx + d * math.cos(a), cy + d * math.sin(a)
            if not (lx0 + 0.8 < x < lx1 - 0.8 and ly0 + 0.8 < y < ly1 - 0.8):
                continue
            me, h = smalls[rnd.randrange(3)]
            s = rnd.uniform(0.12, 0.38)
            place(f'PR_lot_chip.{j:03d}', me, c, (x, y, gz.z(x, y) - h * s * 0.3), rnd.uniform(0, 6.3), (s * rnd.uniform(0.8, 1.3), s, s),
                  rx=rnd.uniform(-0.3, 0.3), ry=rnd.uniform(-0.3, 0.3), surface='rock')
            j += 1
    # ── 이끼: 별도 패치 메시를 두지 않는다. 바위·현무암은 정점 마스크 R(윗면만)로, 물가는 지면 마스크(Task 2)로 이끼가 난다.
    #    (moss_01 의 2~4 cm 덩어리를 키우면 이 거리에서 검은 자갈처럼 읽혀 뺐다)
    m = 0
    # ── 잡초·마른 풀: 가림막 안쪽 줄, 기초 벽, 더미 가장자리, 바위 밑동(물 안·통행 바퀴 자국 제외)
    gk = ['weed_dry', 'weed_dry', 'weed_green', 'weed_dry_t']
    g = 0
    spots = []
    for i in range(70):
        t = rnd.random()
        side = rnd.randrange(4)
        if side == 0:
            spots.append((lx0 + 1.0 + t * (lx1 - lx0 - 2), ly0 + rnd.uniform(0.9, 1.8)))
        elif side == 1:
            spots.append((lx1 - rnd.uniform(0.9, 1.8), ly0 + 1.0 + t * (ly1 - ly0 - 2)))
        elif side == 2:
            spots.append((lx0 + 1.0 + t * (lx1 - lx0 - 2), ly1 - rnd.uniform(0.9, 1.8)))
        else:
            spots.append((lx0 + rnd.uniform(0.9, 1.8), ly0 + 1.0 + t * (ly1 - ly0 - 2)))
    for (cx, cy), *_ in clusters:
        for i in range(10):
            a = rnd.uniform(0, 2 * math.pi); d = rnd.uniform(1.0, 4.5)
            spots.append((cx + d * math.cos(a), cy + d * math.sin(a)))
    for poly in G.FOUNDATION:
        for (ax, ay), (bx, by) in zip(poly, poly[1:] + poly[:1]):
            for i in range(4):
                t = rnd.random(); spots.append((ax + (bx - ax) * t + rnd.uniform(-0.6, 0.6), ay + (by - ay) * t + rnd.uniform(-0.6, 0.6)))
    for x, y in spots:
        if not free(x, y, 0.4):
            continue
        if abs(x - 44.0) < 1.6 and y < 0:        # 공사 차량 바퀴 자국 위는 비움
            continue
        key = gk[rnd.randrange(len(gk))]
        place(f'PR_lot_weed.{g:03d}', P[key], c, (x, y, gz.z(x, y) - 0.03), rnd.uniform(0, 6.3), rnd.uniform(0.7, 1.35), surface='foliage')
        g += 1
    # 방호벽(공사 문 안쪽)
    for i, (x, y, r) in enumerate(((46.8, -20.0, 0.1), (48.4, -19.6, -0.25))):
        place(f'PR_lot_barrier.{i}', P['barrier'], c, (x, y, gz.z(x, y)), r, 1.0, surface='wall')
    print('lot pocket: hoarding', k, 'rocks/chips', j, 'moss', m, 'grass', g)


# ═════════════════════════════ 은행나무 ═════════════════════════════
def ginkgo_mesh(name, seed, M, height=9.0):
    """저폴리 은행나무: 8각 줄기 + 위로 뻗는 가지 5 + 원뿔형 수관의 알파 카드(늦가을 황록)."""
    rnd = random.Random(seed)
    acc = Acc()
    bk = lambda p, n: (0.35 * (1 - smoothstep(0, 0.8, p[2])), 0.35 + 0.4 * (1 - smoothstep(0, 1.2, p[2])), 1 - 0.4 * (1 - smoothstep(0, 1, p[2])), 0.0)
    lean = Vector((rnd.uniform(-0.15, 0.15), rnd.uniform(-0.15, 0.15), 0))
    p0 = Vector((0, 0, -0.2)); p1 = Vector((0, 0, height * 0.55)) + lean * 0.5; p2 = Vector((0, 0, height * 0.95)) + lean
    acc.cyl(p0, p1, 0.17, 0.11, 8, M['bark'], bk, caps=(False, False))
    acc.cyl(p1, p2, 0.11, 0.04, 6, M['bark'], bk, caps=(False, True))
    tips = []
    for k in range(6):
        z = height * rnd.uniform(0.3, 0.7)
        a = 2 * math.pi * k / 6 + rnd.uniform(-0.3, 0.3)
        base = Vector((0, 0, z)) + lean * (z / height)
        L = height * rnd.uniform(0.22, 0.32)
        tip = base + Vector((math.cos(a) * L * 0.55, math.sin(a) * L * 0.55, L * 0.8))
        acc.cyl(base, tip, 0.05, 0.02, 5, M['bark'], bk, caps=(False, True))
        tips.append(tip)
    # 수관 카드: 원뿔(아래 넓고 위 좁음) 안에 무작위 방향 카드 — 아래 2.6 m 는 비움(보행자 높이)
    n = 46
    for i in range(n):
        z = height * (0.32 + 0.66 * (i / n) ** 0.9) + rnd.uniform(-0.4, 0.4)
        rmax = (height * 1.02 - z) * 0.42 + 0.5
        a = rnd.uniform(0, 2 * math.pi); r = rmax * math.sqrt(rnd.uniform(0.15, 1.0))
        c = Vector((math.cos(a) * r, math.sin(a) * r, z)) + lean * (z / height)
        s = rnd.uniform(1.3, 2.1)
        yaw = rnd.uniform(0, math.pi); tilt = rnd.uniform(-0.5, 0.5)
        e1 = Vector((math.cos(yaw), math.sin(yaw), 0)) * s / 2
        e2 = (Vector((0, 0, 1)) * math.cos(tilt) + Vector((-math.sin(yaw), math.cos(yaw), 0)) * math.sin(tilt)) * s / 2
        fl = rnd.random() < 0.5
        uv = [(0, 0), (1, 0), (1, 1), (0, 1)] if not fl else [(1, 0), (0, 0), (0, 1), (1, 1)]
        shade = 0.55 + 0.45 * smoothstep(height * 0.3, height, z) * (0.6 + 0.4 * r / max(0.1, rmax))
        acc.poly([c - e1 - e2, c + e1 - e2, c + e1 + e2, c - e1 + e2], uv, M['leaves'], (0.0, 0.3, shade, 0.0))
    return acc.to_mesh(name)


# ═════════════════════════════ 배치 ═════════════════════════════
def flush_inst(c, protos):
    """건물 생성 중 쌓인 INST 를 링크 복제로 놓는다."""
    cnt = {}
    for key, loc, rz, s in INST:
        me = protos.get(key)
        if me is None:
            raise KeyError(f'flush_inst: 원형이 없는 키 {key!r} — PH 표나 build() 의 protos 를 확인')
        i = cnt.get(key, 0); cnt[key] = i + 1
        surf = 'wall' if key in ('tank',) else 'metal'
        place(f'PR_{"ph_" if key in PH else ""}{key}.{i:03d}', me, c, loc, rz, s, surface=surf)
    INST.clear()
    return cnt


def build_street(c, M, P, protos, gz):
    """가로등·신호기둥·볼라드·은행나무·거리 소품·전정 벤치와 화단."""
    rnd = random.Random(99)
    lt = protos['light']
    k = 0
    for x in (-95, -65, -35, -5, 32, 62, 92, 122, 152):
        y = G.TT[1] + 0.55
        place(f'PR_light.{k:03d}', lt, c, (x, y, gz.z(x, y)), -math.pi / 2, surface='metal'); k += 1
    for x in (-75, -45, 15, 45, 75, 105, 135):
        y = G.TT[0] - 0.55
        place(f'PR_light.{k:03d}', lt, c, (x, y, gz.z(x, y)), math.pi / 2, surface='metal'); k += 1
    for y in (100.0, 125.0):
        place(f'PR_light.{k:03d}', lt, c, (G.AL[0] - 0.6, y, gz.z(G.AL[0] - 0.6, y)), 0.0, surface='metal'); k += 1
    # 신호기둥(횡단보도 x −14 양쪽)
    sg = protos['signal']
    place('PR_signal.000', sg, c, (G.XW + 2.9, G.TT[1] + 0.5, gz.z(G.XW + 2.9, G.TT[1] + 0.5)), -math.pi / 2, surface='metal')
    place('PR_signal.001', sg, c, (G.XW - 2.9, G.TT[0] - 0.5, gz.z(G.XW - 2.9, G.TT[0] - 0.5)), math.pi / 2, surface='metal')
    # 볼라드: 횡단보도 양 끝, 골목 입구
    bo = protos['bollard']; k = 0
    for y in (G.TT[1] + 0.45, G.TT[0] - 0.45):
        for x in (G.XW - 2.2, G.XW - 1.1, G.XW, G.XW + 1.1, G.XW + 2.2):
            place(f'PR_bollard.{k:03d}', bo, c, (x, y, gz.z(x, y)), 0.0, surface='metal'); k += 1
    for x, y in ((65.9, -33.5), (65.9, -32.3), (74.1, -33.5), (74.1, -32.3)):
        place(f'PR_bollard.{k:03d}', bo, c, (x, y, gz.z(x, y)), 0.0, surface='metal'); k += 1
    # 은행나무 8그루(남측 보도 구덩이; 카메라 바로 앞은 비움)
    trees = [protos['ginkgo_a'], protos['ginkgo_b']]
    pits = [p for p in G.PITS if p[0] in (-58, -42, -26, -2, 14, 30, 46, 62)]
    for i, (x, y) in enumerate(pits):
        place(f'PR_ginkgo.{i:03d}', trees[i % 2], c, (x, y, gz.z(x + 0.8, y, -0.03)), rnd.uniform(0, 6.3), rnd.uniform(0.92, 1.08), surface='foliage')
    # 거리 소품(Poly Haven)
    items = [
        ('payphone_post', (-86.0, -55.3), 0.0), ('ubox', (-70.0, -55.6), 0.0), ('ubox', (-30.0, -55.6), 0.0), ('trash', (-79.0, -55.3), 0.0),
        ('trash', (6.0, -55.3), 0.3), ('ubox', (-95.0, -31.9), math.pi), ('trash', (-90.0, -32.0), 2.0), ('extinguisher', (-84.2, -14.0), -math.pi / 2),
        ('ubox', (66.3, 60.0), math.pi / 2), ('trash', (66.2, 30.0), 1.0), ('trash', (73.9, 70.0 + 9.0), 0.5), ('extinguisher', (75.8, 41.0), math.pi / 2),
        ('ubox', (-100.6, 60.0), -math.pi / 2), ('trash', (-62.0, 74.0), 0.2), ('ubox', (17.8, 73.6), 0.0), ('trash', (40.0, 136.0), 0.0),
        ('extinguisher', (31.0, 96.3), math.pi), ('ubox', (-10.0, 136.2), math.pi), ('trash', (90.0, 136.0), 0.4),
    ]
    k = {}
    for key, (x, y), rz in items:
        z = gz.z(x, y)
        i = k.get(key, 0); k[key] = i + 1
        if key == 'payphone_post':
            place(f'PR_payphone_post.{i}', protos['payphone_post'], c, (x, y, z), rz, surface='metal')
            place(f'PR_ph_payphone.{i}', P['payphone'], c, (x, y + 0.2, z + 1.0), rz + math.pi, surface='metal')
            continue
        place(f'PR_ph_{key}.{i:03d}', P[key], c, (x, y, z + (1.0 if key == 'extinguisher' else 0.0)), rz, surface='metal')
    # 덮개 씌운 차(주차장·골목·이면도로) + 방호벽
    cars = [((75.8, 30.0), 0.0), ((-45.0, 71.2), math.pi / 2), ((25.0, 71.0), math.pi / 2 + 0.03), ((-87.0, 42.0), 0.0),
            ((-68.0, 45.0), 0.02), ((84.0, 50.0), 0.0), ((-3.0, 139.7), math.pi / 2 + 0.02), ((112.0, 145.2), math.pi / 2)]
    for i, ((x, y), rz) in enumerate(cars):       # 길가·필로티 차량(주차장 차량은 build_fill)
        place(f'PR_ph_car.r{i:02d}', P['car'], c, (x, y, gz.z(x, y)), rz, surface='metal')
    for i, (x, y, rz) in enumerate(((-56.0, -31.0, 0.0), (-54.3, -31.1, 0.05), (69.0, 136.5, 0.0), (2.6, 151.2, 1.45), (23.4, 151.0, 1.7),
                                    (38.6, -23.0, 0.0), (36.9, -23.1, 0.04), (50.3, -23.0, -0.03), (52.0, -23.1, 0.0))):   # 끝 넷: 빈터 공사 문 양옆
        place(f'PR_ph_barrier.{i:03d}', P['barrier'], c, (x, y, gz.z(x, y)), rz, surface='wall')
    # CCTV(골목 전주)
    for i, (x, y, rz) in enumerate(((66.5, 10.0, math.pi), (66.5, 49.0, math.pi), (-101.5, 11.0, 0.0), (66.3, 137.6, math.pi / 2))):
        place(f'PR_ph_cctv.{i:03d}', P['cctv'], c, (x + (0.2 if rz == 0 else -0.2), y, gz.z(x, y) + 4.4), rz - math.pi / 2, surface='metal')
    # 배달 오토바이(고가 아래)
    # 배달 오토바이: 저폴리 실루엣이라 15 m 밖(고가 하부 가로 남측 보도·카페 앞)에만 둔다
    for i, (x, y, rz) in enumerate(((-6.5, 136.7, 0.15), (-5.2, 136.5, 0.3), (36.0, 136.9, 3.0), (-30.0, 148.6, 0.0), (60.0, 148.4, 3.1))):
        place(f'PR_scooter.{i:03d}', protos['scooter'], c, (x, y, gz.z(x, y)), rz, surface='metal')
    # 입간판·화분(카페·가게 앞)
    for i, (x, y, rz) in enumerate(((27.5, 130.3, 0.2), (-92.0, -31.0, 0.1), (-76.0, -56.6, 2.9), (73.6, 26.5, 1.5), (-10.0, 131.3, -0.2),
                                    (-48.0, 49.0, 0.4), (121.0, 132.0, 0.0))):
        aframe_sign(x, y, gz.z(x, y), rz, ('커피', '영업중', '수선', '식사', '세탁', '분식', '주차금지')[i], i + 2)
    for i, (x, y) in enumerate(((20.6, 129.4), (23.2, 129.5), (32.6, 129.4), (18.0, 125.0), (18.0, 121.5), (73.6, 33.8))):
        z = gz.z(x, y)
        place(f'PR_pot.{i:03d}', protos['pot'], c, (x, y, z), 0.0, surface='wall')
        place(f'PR_ph_shrub.p{i}', P['shrub'], c, (x, y, z + 0.5), rnd.uniform(0, 6.3), (0.24, 0.24, 0.3), surface='foliage')
    # HAUS 전정: 벤치 2 + 화단 관목
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


def payphone_post_mesh(M):
    acc = Acc()
    mk = (0.0, 0.4, 0.85, 0.2)
    acc.box((-0.05, -0.05, -0.1), (0.05, 0.05, 2.1), M['galv'], mk)
    acc.box((-0.35, -0.08, 2.0), (0.35, 0.42, 2.1), M['steel'], mk)
    acc.box((-0.3, -0.02, 0.85), (0.3, 0.05, 1.9), M['galv'], mk, faces='yYxX')
    return acc.to_mesh('PR_payphone_post')


def truck_mesh(M, col):
    """소형 화물차(1톤급 일반형, 특정 차종 디자인 아님): 캡 + 경사 앞유리 + 적재함 + 바퀴. 차체 색은 팔레트 칸(간판 재질 공유)."""
    acc = Acc()
    uv = pal_uv(4, col); mk = (0.0, 0.4, 0.9, 0.2)
    cab = [(-0.85, 1.25, 0.5), (0.85, 1.25, 0.5), (0.85, 2.7, 0.5), (-0.85, 2.7, 0.5)]
    top = [(-0.82, 1.3, 2.0), (0.82, 1.3, 2.0), (0.82, 2.35, 2.0), (-0.82, 2.35, 2.0)]
    mid = [(-0.85, 2.7, 1.25), (0.85, 2.7, 1.25)]
    S_ = MATS['sign']
    acc.poly([cab[0], cab[1], top[1], top[0]], [uv] * 4, S_, mk, (0, -1, 0))                          # 뒷벽
    acc.poly([cab[1], cab[2], mid[1], top[2], top[1]], [uv] * 5, S_, mk, (1, 0, 0))                  # 옆
    acc.poly([cab[3], cab[0], top[0], top[3], mid[0]], [uv] * 5, S_, mk, (-1, 0, 0))
    acc.poly([cab[2], cab[3], mid[0], mid[1]], [uv] * 4, S_, mk, (0, 1, 0))                            # 앞 범퍼 쪽
    acc.poly([mid[1], mid[0], top[3], top[2]], [(0, 0), (1, 0), (1, 1), (0, 1)], M['glass'], (0, 0.2, 1, 0), (0, 0.6, 0.4))   # 앞유리
    acc.poly(top, [uv] * 4, S_, mk, (0, 0, 1))
    for sx in (-1, 1):                                                                                 # 옆 창
        x = sx * 0.852
        acc.poly([(x, 1.5, 1.35), (x, 2.2, 1.35), (x, 2.2, 1.85), (x, 1.5, 1.85)], [(0, 0), (1, 0), (1, 1), (0, 1)], M['glass'],
                 (0, 0.2, 1, 0), (sx, 0, 0))
    acc.box((-0.85, -2.1, 0.62), (0.85, 1.2, 0.8), M['steel'], mk)                                     # 적재함 바닥
    for sx in (-1, 1):
        acc.box((sx * 0.85 - (0.04 if sx > 0 else 0), -2.1, 0.8), (sx * 0.85 + (0.0 if sx > 0 else 0.04), 1.2, 1.2), S_, (0, 0.4, 0.9, 0.2))
    acc.box((-0.85, -2.1, 0.8), (0.85, -2.06, 1.2), S_, (0, 0.4, 0.9, 0.2))
    for x in (-0.78, 0.78):
        for y in (-1.3, 1.95):
            acc.cyl((x - 0.1, y, 0.32), (x + 0.1, y, 0.32), 0.32, 0.32, 10, M['steel'], (0, 0.5, 0.7, 0))
    me = acc.to_mesh(f'PR_truck{col}', weld=False)
    for p in me.polygons:
        p.use_smooth = False
    return me


def container_mesh(M):
    """컨테이너 사무실(6.06 × 2.44 × 2.6 m): 골함석 벽 + 문 + 창 + 받침 블록."""
    acc = Acc()
    mk = lambda p, n: (0.25 * smoothstep(0.6, 0.9, n[2]), 0.35 + 0.5 * (1 - smoothstep(0.2, 0.9, p[2])), 1 - 0.4 * (1 - smoothstep(0.2, 0.9, p[2])), 0.5)
    MM = dict(M); MM['wall'] = M['corr']; MM['trim'] = M['steel']
    x0, x1, y0, y1, z0, z1 = -3.03, 3.03, -1.22, 1.22, 0.2, 2.8
    ops_s = [dict(u0=0.6, u1=1.5, v0=z0 + 0.05, v1=z0 + 2.1, d=0.06, back='steel', streak=False, lintel=False),
             dict(u0=2.4, u1=3.8, v0=z0 + 1.0, v1=z0 + 2.0, d=0.06, back='glass', pane=0.7, paneh=1.0, sill=False, lintel=False),
             dict(u0=4.4, u1=5.6, v0=z0 + 1.0, v1=z0 + 2.0, d=0.06, back='glass', pane=0.6, paneh=1.0, sill=False, lintel=False)]
    for (a, b), ops in ((((x0, y0), (x1, y0)), ops_s), (((x1, y0), (x1, y1)), []), (((x1, y1), (x0, y1)), []), (((x0, y1), (x0, y0)), [])):
        wall(acc, a, b, z1, [dict(o, v0=o['v0'], v1=o['v1']) for o in ops], MM, 0.0, vb=z0, age=0.6, par_top=z1)
    acc.box((x0, y0, z1), (x1, y1, z1 + 0.08), M['corr'], (0.3, 0.55, 0.9, 0.0), faces='ZxXyY')
    for x in (x0 + 0.3, x1 - 0.3):
        for y in (y0 + 0.3, y1 - 0.3):
            acc.box((x - 0.2, y - 0.2, -0.1), (x + 0.2, y + 0.2, z0), M['trim'], (0.3, 0.6, 0.6, 0.0), faces='xXyYZ')
    return acc.to_mesh('PR_container')


def parking(acc, x0, x1, y0, y1, gz, along='x', stall=2.5, row=('S',)):
    """주차 구획 도색(폭 0.12 m 흰 선). along='x': 칸이 x 로 늘어서고 깊이는 y. row 의 'S'/'N' 은 차 머리 쪽 기준선.
    반환: 칸 중심 목록 [(x, y, 회전)] — 차는 칸 깊이 방향으로 선다."""
    mk = (0.0, 0.4, 0.95, 0.0); w = 0.06; out = []
    def strip(ax, ay, bx, by):
        dx, dy = bx - ax, by - ay; L = math.hypot(dx, dy); nx, ny = -dy / L * w, dx / L * w
        n = max(1, int(L / 1.2))
        for i in range(n):
            t0, t1 = i / n, (i + 1) / n
            pts = [(ax + dx * t0 - nx, ay + dy * t0 - ny), (ax + dx * t1 - nx, ay + dy * t1 - ny), (ax + dx * t1 + nx, ay + dy * t1 + ny),
                   (ax + dx * t0 + nx, ay + dy * t0 + ny)]
            acc.poly([(px, py, gz.z(px, py) + 0.012) for px, py in pts], [(0, 0), (1, 0), (1, 1), (0, 1)], MATS['line'], mk, (0, 0, 1))
    if along == 'x':
        n = int((x1 - x0) / stall)
        for i in range(n + 1):
            strip(x0 + i * stall, y0, x0 + i * stall, y1)
        strip(x0, y0, x0 + n * stall, y0) if 'S' in row else strip(x0, y1, x0 + n * stall, y1)
        out = [(x0 + (i + 0.5) * stall, (y0 + y1) / 2, 0.0) for i in range(n)]
    else:
        n = int((y1 - y0) / stall)
        for i in range(n + 1):
            strip(x0, y0 + i * stall, x1, y0 + i * stall)
        strip(x0, y0, x0, y0 + n * stall)
        out = [((x0 + x1) / 2, y0 + (i + 0.5) * stall, math.pi / 2) for i in range(n)]
    return out


def build_fill(c, M, P, protos, gz):
    """B3: 근·중경에 맨 슬래브로 읽히던 필지를 채운다 — 주차 구획 도색 + 덮개 씌운 차·소형 화물차, 컨테이너 사무실, 띠 녹지(산울타리)."""
    rnd = random.Random(515)
    paint = Acc(); hedge = Acc()
    cars = []; trucks = []
    def fill(stalls, frac, truck_every=0, jitter=0.12):
        k = 0
        for (x, y, rz) in stalls:
            r = rnd.random()
            if r < frac:
                if truck_every and k % truck_every == truck_every - 1:
                    trucks.append((x, y, rz + rnd.uniform(-0.04, 0.04) + (math.pi if rnd.random() < 0.5 else 0.0)))
                else:
                    cars.append((x + rnd.uniform(-jitter, jitter), y + rnd.uniform(-jitter, jitter), rz + rnd.uniform(-0.05, 0.05)))
                k += 1
    # HAUS 서쪽 주차장(뚝섬로 앞, x −47…−29.5): 마주 보는 두 줄
    fill(parking(paint, -47.0, -29.5, -29.8, -24.8, gz, row=('S',)), 0.6, 4)
    fill(parking(paint, -47.0, -29.5, -18.8, -13.8, gz, row=('N',)), 0.45)
    # FaceArch 앞 마당(x 90…122)
    fill(parking(paint, 90.0, 122.0, -29.8, -24.8, gz, row=('S',)), 0.5, 5)
    # 아파트 단지 앞뜰
    fill(parking(paint, -62.0, -19.5, -66.2, -61.2, gz, row=('S',)), 0.55)
    fill(parking(paint, -9.0, 43.5, -66.2, -61.2, gz, row=('S',)), 0.5, 7)
    # HAUS 북쪽 좁은 띠(x −24…24, y 26.8…31.8)
    fill(parking(paint, -24.0, 24.0, 26.8, 31.8, gz, row=('N',)), 0.35)
    # FaceArch 블록 서쪽 골목변(x 75…80.5): 골목을 따라 늘어선 칸(얼굴 앞은 낮은 차만)
    fill(parking(paint, 75.0, 80.5, -27.0, 22.0, gz, along='y', stall=2.5), 0.5, 6)
    fill(parking(paint, 86.5, 92.0, -27.0, -0.5, gz, along='y', stall=2.5), 0.45)
    # 동쪽 공장 마당(x 122…138, y 96.5…101.5)
    fill(parking(paint, 122.0, 137.5, 96.5, 101.5, gz, row=('S',)), 0.6, 3)
    # 고가 아래 아치 공간(충전벽 없는 경간 = 카메라 경간 + 승강장 3경간): 재포장한 어두운 주차장 바닥 + 평행 주차(칸 6.5 m)
    floor = Acc()
    for xa in (3.0, 25.0, 47.0, 69.0):
        x0f, x1f = xa + 0.22, xa + VIA_SPAN - 2.22          # 교각 면(교각 중심 ±1.2) 사이
        nx_, ny_ = 10, 5
        for i in range(nx_):
            for j in range(ny_):
                a0 = x0f + (x1f - x0f) * i / nx_; a1 = x0f + (x1f - x0f) * (i + 1) / nx_
                b0 = VIA_Y0 + 0.05 + 9.9 * j / ny_; b1 = VIA_Y0 + 0.05 + 9.9 * (j + 1) / ny_
                def fm(p, n):
                    inner = 1 - abs((p[1] - (VIA_Y0 + 5.0)) / 5.0)          # 상판 한가운데일수록 더 가려짐
                    return (0.0, 0.12, 0.62 - 0.22 * inner, 0.0)            # 비를 맞지 않아 마른 바닥, AO 낮음
                floor.poly([(a0, b0, gz.z(a0, b0) + 0.006), (a1, b0, gz.z(a1, b0) + 0.006), (a1, b1, gz.z(a1, b1) + 0.006),
                            (a0, b1, gz.z(a0, b1) + 0.006)], [(a0, b0), (a1, b0), (a1, b1), (a0, b1)], M['asph_dark'], fm, (0, 0, 1))
    STATIC.extend(floor)
    for xa in (3.0, 25.0, 47.0, 69.0):
        st = parking(paint, xa, xa + 19.5, 150.6, 153.0, gz, along='x', stall=6.5, row=('S',))
        st = [(x, y, math.pi / 2) for x, y, _ in st]
        if xa == 3.0:
            cars += [(st[0][0] + 0.15, 152.0, math.pi / 2 + 0.05), (st[2][0] - 0.1, 152.2, math.pi / 2 - 0.06)]   # CAM_viaduct 근경 좌우
        else:
            fill(st, 0.55, 3, jitter=0.05)
    for i, (x, y, rz) in enumerate(cars):
        place(f'PR_ph_car.{i:03d}', P['car'], c, (x, y, gz.z(x, y)), rz, surface='metal')
    trucks += [(8.0, 101.2, 0.25), (-47.0 + 1.5, -9.5, math.pi / 2), (128.0, 104.0, 1.65), (44.6, -26.2, 0.05)]   # 마지막: 빈터 공사 문 앞
    for i, (x, y, rz) in enumerate(trucks):
        place(f'PR_truck.{i:03d}', protos['truck_w' if i % 3 else 'truck_b'], c, (x, y, gz.z(x, y)), rz, surface='metal')
    # 컨테이너 사무실: 공장 마당·빈터 공사 문 안쪽(현장 사무실)·고가 아래
    for i, (x, y, rz) in enumerate(((15.6, 103.6, math.pi / 2 + 0.03), (-8.5, 102.0, 0.02), (133.0, 104.2, 0.0), (55.5, -18.5, 0.0),
                                    (-36.0, -6.8, 0.0), (82.0, 155.5, 0.0))):
        place(f'PR_container.{i:03d}', protos['container'], c, (x, y, gz.z(x, y)), rz, surface='metal')
    # 띠 녹지(산울타리 1.0 m) — 주차장·아파트 담장 안쪽·FaceArch 앞 경계
    hm = lambda p, n: (0.3 * smoothstep(0.5, 0.9, n[2]), 0.45 + 0.3 * (1 - smoothstep(0, 0.6, p[2] - gz.z(p[0], p[1]))), 0.75 + 0.25 * smoothstep(0, 0.9, p[2] - gz.z(p[0], p[1])), 0.0)
    for x0, y0, x1, y1 in ((-47.0, -31.2, -29.5, -30.4), (89.0, -31.2, 123.0, -30.4), (-62.0, -58.4, -19.5, -57.6), (-9.0, -58.4, 43.5, -57.6),
                           (-48.6, -29.5, -47.8, -8.0), (122.0, 95.4, 138.0, 96.0)):
        z = gz.z((x0 + x1) / 2, (y0 + y1) / 2)
        hedge.box((x0, y0, z - 0.05), (x1, y1, z + 0.3), M['trim'], (0.3, 0.6, 0.6, 0.0), faces='xXyYZ')
        hedge.box((x0 + 0.06, y0 + 0.06, z + 0.3), (x1 - 0.06, y1 - 0.06, z + 1.0 + 0.15 * h01(x0, y0)), M['hedge'], hm, faces='xXyYZ')
    STATIC.extend(paint); STATIC.extend(hedge)
    print('fill: cars', len(cars), 'trucks', len(trucks))


def build_apt_fence(c, M, gz):
    """아파트 단지 담장(뚝섬로 남측 보도 뒤): 낮은 콘크리트 담 0.6 m + 철제 울타리, 횡단보도 앞(x −14)은 단지 입구로 비움."""
    acc = Acc()
    y = G.TT[0] - 7.5 - 0.6
    mk = lambda p, n: (0.6 * (1 - smoothstep(0.0, 0.3, p[2] - gz.z(p[0], p[1]))) + 0.3 * smoothstep(0.6, 0.9, n[2]),
                       0.35 + 0.5 * (1 - smoothstep(0.0, 0.5, p[2] - gz.z(p[0], p[1]))), 1 - 0.45 * (1 - smoothstep(0, 0.5, p[2] - gz.z(p[0], p[1]))), 0.3)
    for x0, x1 in ((-64.0, -18.0), (-10.0, 46.0)):
        acc.box((x0, y - 0.15, -0.2), (x1, y + 0.15, 0.6), M['trim'], mk, faces='xXyYZ')
        n = int((x1 - x0) / 2.0)
        for i in range(n + 1):
            x = x0 + (x1 - x0) * i / n
            acc.box((x - 0.03, y - 0.03, 0.6), (x + 0.03, y + 0.03, 1.8), M['steel'], (0.0, 0.4, 0.9, 0.2), faces='xXyY')
        for z in (0.75, 1.75):
            acc.box((x0, y - 0.025, z - 0.025), (x1, y + 0.025, z + 0.025), M['steel'], (0.0, 0.4, 0.9, 0.2), faces='yYzZ')
        for i in range(int((x1 - x0) / 0.16)):
            x = x0 + 0.08 + 0.16 * i
            acc.box((x - 0.008, y - 0.008, 0.75), (x + 0.008, y + 0.008, 1.75), M['steel'], (0.0, 0.4, 0.9, 0.2), faces='y')
    STATIC.extend(acc)


def build_field(c, M, gz):
    """학교 운동장 개방부(x −57, y +115 근처): 인조잔디 + 낮은 펜스 + 높은 공 막이 그물."""
    x0, y0, x1, y1 = -88.0, 104.0, -38.0, 133.5
    acc = Acc()
    nx, ny = 13, 9
    for i in range(nx):
        for j in range(ny):
            a0 = x0 + (x1 - x0) * i / nx; a1 = x0 + (x1 - x0) * (i + 1) / nx
            b0 = y0 + (y1 - y0) * j / ny; b1 = y0 + (y1 - y0) * (j + 1) / ny
            acc.poly([(a0, b0, 0.03), (a1, b0, 0.03), (a1, b1, 0.03), (a0, b1, 0.03)], [(a0, b0), (a1, b0), (a1, b1), (a0, b1)], M['turf'],
                     lambda p, n: (0.0, clamp01(0.4 + 0.35 * n2(p[0], p[1], 0.15, 3.0)), 0.95, 0.0), (0, 0, 1))
    # 흰 선(가장자리 띠)
    for (a0, b0, a1, b1) in ((x0 + 2, y0 + 2, x1 - 2, y0 + 2.12), (x0 + 2, y1 - 2.12, x1 - 2, y1 - 2), (x0 + 2, y0 + 2, x0 + 2.12, y1 - 2),
                             (x1 - 2.12, y0 + 2, x1 - 2, y1 - 2), ((x0 + x1) / 2 - 0.06, y0 + 2, (x0 + x1) / 2 + 0.06, y1 - 2)):
        acc.poly([(a0, b0, 0.035), (a1, b0, 0.035), (a1, b1, 0.035), (a0, b1, 0.035)], [(0, 0), (1, 0), (1, 1), (0, 1)], M['line'],
                 (0.0, 0.4, 1.0, 0.0), (0, 0, 1))
    # 펜스 기둥 + 그물(짧은 변 8 m, 긴 변 3 m)
    ring = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    for k in range(4):
        (ax, ay), (bx, by) = ring[k], ring[(k + 1) % 4]
        L = math.hypot(bx - ax, by - ay); h = 8.0 if k in (1, 3) else 3.2
        n = max(2, int(L / 4.0))
        for i in range(n + 1):
            t = i / n; x = ax + (bx - ax) * t; y = ay + (by - ay) * t
            acc.cyl((x, y, -0.1), (x, y, h), 0.05, 0.05, 6, M['galv'], (0.0, 0.4, 0.9, 0.0))
        nrm = ((by - ay) / L, -(bx - ax) / L, 0)
        acc.poly([(ax, ay, 0), (bx, by, 0), (bx, by, h), (ax, ay, h)], [(0, 0), (L, 0), (L, h), (0, h)], M['net'], (0, 0.3, 1, 0), nrm)
        acc.cyl((ax, ay, h), (bx, by, h), 0.04, 0.04, 6, M['galv'], (0.0, 0.4, 0.9, 0.0))
    STATIC.extend(acc)


# ═════════════════════════════ 앵커 · 카메라 · 자리 ═════════════════════════════
ANCHORS = [
    # (id, layer, title, 위치)
    ('haus_podium', 'building', '포디움 1–5F', (0.0, -26.0, 11.0)),
    ('haus_tower', 'building', '타워 6–11F', (0.0, -20.0, 42.0)),
    ('haus_crown', 'building', '크라운 11–14F', (0.0, -26.0, 70.0)),
    ('haus_garden', 'building', '전정 — 흰 자갈 화단과 꽃', (-12.0, -28.0, 0.8)),
    ('facearch_eyes', 'building', 'FaceArch 두 면의 눈', (100.7, 8.4, 17.0)),
    ('facearch_legs', 'building', 'FaceArch 필로티 다리', (108.0, 14.0, 4.5)),
    ('facearch_body', 'building', 'FaceArch 둥근 삼각 매스', (105.0, 15.0, 25.0)),
    ('viaduct', 'present', '2호선 고가와 성수역형 승강장', (57.0, VIA_Y0 - 4.5, 13.0)),
    ('brick_belt', 'present', '붉은 벽돌 공장·창고 띠', (5.0, 97.5, 9.0)),
    ('cafe_canopy', 'present', '벽돌 개조 카페 — 흑색 강판 캐노피', (27.0, 129.5, 4.4)),
    ('wires', 'present', '가공선 다발과 황흑 전주', (65.6, 74.4, 9.5)),
    ('workshop', 'present', '골함석 공방', (62.5, 82.0, 5.0)),
    ('villas', 'present', '노후 연립 — 필로티·외부 철제 계단', (-26.0, 35.5, 8.0)),
    ('apartments', 'present', '길 건너 12~13F 아파트', (-43.5, -71.5, 30.0)),
    ('lot_moss', 'nature', '빈터의 이끼 — 윗면·물가에만', (53.0, 16.2, 0.3)),
    ('lot_water', 'nature', '고인 물과 물길', (39.5, 3.0, 0.0)),
    ('lot_rocks', 'nature', '현무암·잡석 3단 스케일', (49.5, 4.0, 1.6)),
    ('ginkgo', 'nature', '은행나무 가로수', (-2.0, -49.7, 7.0)),
]


def _eye_anchor():
    """FaceArch 눈(eyeball 재질 메시)의 두 덩어리 중 뚝섬로 쪽(남서) 눈의 표면 근처 점."""
    vs = []
    ref = bpy.data.collections.get('NW_ref_facearch')          # 다른 씬(룩뎁)의 같은 모델은 빼고 NW_World 의 참고 건물만
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
    best = min((ca, cb), key=lambda p: p.y + 0.5 * p.x)      # 남서쪽(뚝섬로·HAUS 쪽)
    return tuple(best)


def build_anchors(sc):
    A = lib.coll('NW_anchors', sc)
    for e in list(A.objects):
        bpy.data.objects.remove(e, do_unlink=True)
    for aid, layer, title, pos in ANCHORS:
        if aid == 'facearch_eyes':
            pos = _eye_anchor() or pos
        elif aid in ('lot_moss', 'lot_water'):
            pos = (pos[0], pos[1], GZ.z(pos[0], pos[1]) + 0.05)
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
    cam.data.clip_start = 0.1; cam.data.clip_end = 3000.0
    cam['target'] = list(tgt)
    return cam


def build_slots(sc):
    S = lib.coll('NW_slots_present', sc)
    for e in list(S.objects):
        bpy.data.objects.remove(e, do_unlink=True)
    x0, x1 = VIA_PIERS[0] - 1.2, VIA_PIERS[-1] + VIA_SPAN - 1.2
    e = bpy.data.objects.new('SLOT_viaduct_led', None)
    e.empty_display_type = 'PLAIN_AXES'; e.empty_display_size = 2.0
    e.location = ((x0 + x1) / 2, VIA_Y0 - 0.7, DECK_B)
    e['x0'] = x0; e['x1'] = x1; e['y'] = VIA_Y0 - 0.7; e['z'] = DECK_B
    e['note'] = '남쪽 상판 테두리 아래 모서리(깨끗이 비움). 승강장 구간은 y −4.3, z 7.45 의 녹색 테두리 아래'
    e['station'] = [STATION[0] - 1.2, STATION[1] + 1.2, VIA_Y0 - 0.7 - 3.6, DECK_B - 0.45]
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
    cleanup_text_tmp()
    for me in [me for me in bpy.data.meshes if me.get(TAG) and me.users == 0]:
        bpy.data.meshes.remove(me)
    return P


def build():
    global GZ
    t0 = time.time()
    sc = lib.get_scene(True)
    if bpy.data.objects.get('GR_vacant') is None or bpy.data.materials.get('NW_concrete') is None:
        ground.build()
    INST.clear()
    lib.setup_render(sc)                     # 공유 조명(키 라이트·AO)까지 — ground.py 를 다시 돌리지 않아도 최신으로
    lib.setup_world(sc)
    C = clear_present(sc)
    GZ = GroundZ()
    print('ground sampler', round(time.time() - t0, 1))
    M = materials()
    MATS.clear(); MATS.update(M)
    global STATIC
    STATIC = Acc()
    SIGNS.clear(); SIGNS['panel'] = Acc(); SIGNS['letters'] = Acc()
    global KIT
    KIT = TextKit(sc)
    try:
        return _build_rest(sc, C, M, t0)
    finally:
        if KIT is not None and KIT.font is not None:
            KIT.close()                              # 도중에 실패해도 임시 텍스트 데이터를 남기지 않는다


def _build_rest(sc, C, M, t0):
    print('materials', round(time.time() - t0, 1))
    P = import_protos(sc, M)
    print('imports', round(time.time() - t0, 1))
    protos = dict(P)
    protos.update({
        'tank': tank_mesh(M), 'light': streetlight_mesh(M), 'signal': signal_mesh(M), 'bollard': bollard_mesh(M),
        'scooter': scooter_mesh(M), 'bench': bench_mesh(M), 'payphone_post': payphone_post_mesh(M), 'pot': pot_mesh(M),
        'truck_w': truck_mesh(M, 0), 'truck_b': truck_mesh(M, 2), 'container': container_mesh(M),
        'ginkgo_a': ginkgo_mesh('PR_ginkgo_a', 3, M, 9.5), 'ginkgo_b': ginkgo_mesh('PR_ginkgo_b', 8, M, 8.0),
    })
    P['weed_dry'] = weed_mesh('PR_weed_dry', M, 0.0, 0.5, 0.8)
    P['weed_dry_t'] = weed_mesh('PR_weed_dry_t', M, 0.0, 0.5, 1.15, 4)
    P['weed_green'] = weed_mesh('PR_weed_green', M, 0.5, 1.0, 0.7)
    # 건물
    rects = []
    for nm, specs in (('PR_bldg_belt', BELT), ('PR_bldg_haus_block', C1), ('PR_bldg_facearch_block', E1), ('PR_bldg_south', SOUTH)):
        build_region(nm, specs, STATIC, M)
        for sp in specs:
            x0, y0, x1, y1 = sp['rect']
            rects.append((x0, y0, x1, y1, sp['gf'] + (sp['fl'] - 1) * sp['fh']))
    print('buildings', round(time.time() - t0, 1))
    apt = apartment_mesh(M)
    for i, ((x, y), s) in enumerate(APTS):
        place(f'PR_apt.{i}', apt, C, (x, y, 0.0), 0.0, (1.0, 1.0, s), surface='wall')
    build_viaduct(C, M)
    print('viaduct', round(time.time() - t0, 1))
    # 전주·전선
    pm = pole_mesh(M); tm = transformer_mesh(M)
    poles = pole_frames()
    for i, (key, (rz, z0)) in enumerate(sorted(poles.items())):
        place(f'PR_pole.{i:03d}', pm, C, (key[0], key[1], z0), rz, surface='wall')
        if i % 3 == 1:
            place(f'PR_transformer.{i:03d}', tm, C, (key[0], key[1], z0), rz + math.pi / 2, surface='metal')
    drops = service_drops(poles, rects)
    build_wires(C, M, poles, drops)
    print('wires', round(time.time() - t0, 1))
    cnt = flush_inst(C, protos)
    print('instances', cnt)
    build_street(C, M, P, protos, GZ)
    build_field(C, M, GZ)
    build_apt_fence(C, M, GZ)
    build_fill(C, M, P, protos, GZ)
    STATIC.extend(SIGNS['panel']); STATIC.extend(SIGNS['letters'])
    KIT.close()
    # 정적 묶음 → 재질별 메시 PR_static_<재질>(건물·승강장·간판·운동장·담장·산울타리·주차선·고가 하부 바닥)
    for m, sub in sorted(STATIC.split().items(), key=lambda kv: kv[0].name):
        o = sub.to_obj(f'PR_static_{m.name}', C, m.get('nw_surface', 'wall'))
        if m.get('nw_night'):
            o['nw_night'] = 1                     # 간판 글자: 밤 발광 후보(발광은 Task 4)
    build_lot_pocket(C, M, P, GZ)
    print('street + lot', round(time.time() - t0, 1))
    build_anchors(sc)
    build_camera(sc)
    build_slots(sc)
    for me in [me for me in bpy.data.meshes if me.get(TAG) and me.users == 0]:
        bpy.data.meshes.remove(me)                 # 놓이지 않은 원형
    print('light probes', lib.bake_light_probes(sc), round(time.time() - t0, 1))
    for m in [m for m in bpy.data.materials if m.get(TAG) and m.users == 0]:
        bpy.data.materials.remove(m)               # 그 원형만 쓰던 가져온 재질·이미지(고아로 남기지 않는다)
    for im in [im for im in bpy.data.images if im.get(TAG) == 2 and im.users == 0]:
        bpy.data.images.remove(im)
    r = report()
    print('done', round(time.time() - t0, 1))
    return r


def report():
    C = bpy.data.collections['NW_present']
    objs = [o for o in C.all_objects if o.type == 'MESH']
    pairs = set(); tri_total = 0; uniq = {}
    for o in objs:
        me = o.data
        t = sum(len(p.vertices) - 2 for p in me.polygons)
        tri_total += t; uniq[me.name] = t
        used = {p.material_index for p in me.polygons}
        for i in used:
            m = me.materials[i] if i < len(me.materials) else None
            pairs.add((me.name, m.name if m else None))
    mats = sorted({p[1] for p in pairs if p[1]})
    out = {'objects': len(objs), 'unique_meshes': len(uniq), 'pairs': len(pairs), 'tris_render': tri_total,
           'tris_unique': sum(uniq.values()), 'materials': len(mats)}
    print('NW_present', out)
    big = sorted(uniq.items(), key=lambda kv: -kv[1])[:12]
    print('largest meshes', big)
    return out


def render_views(suffix='', res=(1280, 720), samples=32, cams=('street', 'viaduct', 'aerial')):
    """build/nowhere/renders/t3-<cam><suffix>.png 로 EEVEE 렌더."""
    sc = lib.get_scene(True)
    out = []
    for c in cams:
        p = os.path.join(lib.OUT, 'renders', f't3-{c}{suffix}.png')
        lib.render(sc, bpy.data.objects[f'CAM_{c}'], p, res, samples)
        out.append(p)
    sc.render.resolution_x, sc.render.resolution_y = 1280, 720
    sc.camera = bpy.data.objects['CAM_street']
    return out


if __name__ == '__main__':
    build()
